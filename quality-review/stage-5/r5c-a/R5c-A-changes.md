# R5c-A · 单目转双目 + 编辑器精修 + 用户三新需求

时间：2026-10-26（Asia/Shanghai）
状态：**R5c-A 完成**；未触碰 R4a.1 判定数学、R4b/R4c/R4d/R4f 生产逻辑、AudioOutputClock、账本单写者。

## 1. A.0 · Logo 恢复

- `GAME_LOGO_PATH` 默认改回：
  `assets/resources/guidance/head-logo.png`
- `rain-night-mark.png` **保留在仓库**，但降级为历史/显式 fallback：
  - 仅 `VITE_NEUROU_LOGO_PATH` 显式指向时启用；
  - 不再出现在默认 runtime、资源栏名称、EventBlueprint 文案中；
  - 不删除文件，不修改 `head-logo.png.meta`。
- 编辑器资源栏显示 `head-logo`；`NoteLogoLayer` 逻辑未改。
- E2E：`head-logo.png` `naturalWidth=172`、`naturalHeight=168`，src 包含 `head-logo.png`。

## 2. A.1 · Layer 3+ 审计

审计结果：**当前实现已基本支持 Layer 3+，没有重复造功能。**

- `EditorTimelineView` 已有 `LAYER 3+` 行；
- `EditorInspectorPanel` 已有 `Layer 3+` 选项；
- `EditorWorldFile` 支持 1–32 层，`exportV2` 将 3+ 导出为 `FullScreen`；
- demo `chart-w1` **原本已有 3 个 L3 keyframe**（10667 / 37333 / 61333ms）；
- R4a.1 `ChartSnapshot` 已有 L3 判定测试。

本批补的是验收：

- 在时间轴双击 Layer 3+ 行创建 keyframe；
- 保存后 `editor.json` 出现 `chartLayerIndex: 3`；
- 进入游戏在 10.587s 命中 L3，HUD 得到 `SCORE 003000`、`PERFECT 1`；
- Layer Audio debug 记录 `layerIndex:3`、`asset:audio:sfx-layer3`。

保留单一 `LAYER 3+` 轨道，不拆成 3/4/5 多行。

## 3. A.2 · Layer Audio Trigger

### 3.1 editor.json schema

根级可选字段，`schemaVersion: 2` 不变：

```json
{
  "schemaVersion": 2,
  "layerAudio": {
    "1": "asset:audio:sfx-layer1",
    "2": "asset:audio:sfx-layer2",
    "3": "asset:audio:sfx-layer3"
  }
}
```

规则：

- key：十进制字符串层号 1–32；
- value：`asset:audio:*` 或 `null`；
- 每层最多一个；
- 旧文件无字段 → `{}`；
- 不进入 `exportV2()`；
- `EditorWorldFile` 提供 `layerAudio` getter 与 `setLayerAudio(layer, assetId|null)`；
- `null` 在编辑器中保留为显式未绑定，runtime 归一化时排除。

校验：

- layer 必须是 1–32 整数；
- assetId 必须以 `asset:audio:` 开头；
- `asset:audio:main`（BGM）禁止绑定：chartLoader 生成 HUD warning 并忽略；
- manifest 找不到 / 非 Audio：warning + 静默降级。

### 3.2 运行时

- `chartLoader` 新增 additive 字段：
  - `LoadGameChart.layerAudio: ReadonlyMap<number, string>`
  - `LoadGameChart.audioAssets: ReadonlyMap<string, string>`
- `GameScreen` 内集中 `submitStrike`；`snapshot.submit` 后读取 `snapshot.lastEvent`；
- `judgement !== 'Miss'` 时调用 `emitLayerAudio(layerIndex, atMs)`；
- **0 侵入 R4a.1**：`ChartSnapshot` 未改。
- 命中语义：
  - Perfect/Good 初始命中触发一次；
  - Hold 续接/完成不重复；
  - Miss / Up / 过早按键不触发；
  - 同层同 tick 去重。
- 优先级：
  - `LayerAudioGate` 16ms 窗口；
  - Layer Audio 命中后直接播放，并设置 guard；
  - `GamePlaybackSink` 的 audio wrapper 在 guard 内丢弃非 BGM 的 binding/NEU 音频；
  - 未命中/无绑定不设置 guard，原行为不变；
  - 同一 assetId 窗口内只播一次；
  - 不做严格前置优先（需要延迟队列，改变手感，不做）。
- 不写账本。

### 3.3 短 SFX

生成器：`v4/app/tools/assets/generate-sfx.mjs`

| 层 | 文件 | 频率 | 时长 | assetId |
|---|---|---|---|---|
| 1 | `media/audio/sfx-hit-layer1.wav` | 220Hz | 150ms | `asset:audio:sfx-layer1` |
| 2 | `media/audio/sfx-hit-layer2.wav` | 440Hz | 150ms | `asset:audio:sfx-layer2` |
| 3 | `media/audio/sfx-hit-layer3.wav` | 880Hz | 150ms | `asset:audio:sfx-layer3` |

- 48kHz / 16-bit mono PCM；
- 4ms attack、≈42ms 指数衰减、8ms 尾淡出、峰值约 −7.5 dBFS；
- 已登记到 `media/manifest.json`；
- `chart-w1.editor.json` 默认绑定 L1/L2/L3；
- 后续替换真实 SFX 只改 assetId 映射。

## 4. A.3 · 单目转双目

### 4.1 Rust command

新增 `media_import_mono_stereo(sourcePath, offsetMs)`：

- probe 源视频 fps；
- 请求 offset 量化为整数帧：
  - 24fps / 33ms → 1 帧 / 42ms；
  - 30fps / 33ms → 1 帧 / 33ms；
  - 60fps / 33ms → 2 帧 / 33ms；
  - 30fps 请求 50ms → 1 帧 / 33ms（避免超过 UI 上限的 66ms）。
- 右眼按整数帧 seek；先做右眼，用右眼实际时长反推共同帧数，再生成左眼，保证左右等时长；
- 音频只保留源音轨一次，不偏移；
- 输出 `media/stereo/<pairId>/{left,right,audio}`；
- manifest pair 写：
  - `pseudoStereo: true`
  - `derivedFrom: <source sha256>`
  - `offsetMs`
  - `offsetFrames`
- 新增 Tauri capability：`allow-media-import-mono-stereo`。

### 4.2 UI

`MediaPanel` 增加“双目 / 单目 → 双目”模式：

- 单目源视频选择；
- offset 20–50ms 滑动条；
- 显示请求值/实际值；
- 提示“静态场景可能无有效视差”；
- 完成后加载 pair 并显示 `PAIR ...`。

### 4.3 E2E

- 源：`media/theme/rain-night-left-loop.mp4`（72s / 30fps）；
- 请求 33ms，实际 33ms / 1 帧；
- 输出 left/right 均 **71967ms**；
- pair `pseudoStereo=true`、`offsetMs=33`、`offsetFrames=1`；
- 输出三件：`left.mp4` / `right.mp4` / `audio.wav`。

## 5. A.4 · 编辑器 UI 精修

- 节拍网格：
  - 读取 active `beatsSidecar`；
  - 108 条 beat 线；downbeat 更亮；
  - 无 sidecar 不画。
- Beat Snap：
  - 与 `timeline.snap` 共存；
  - 开关状态 `BEAT SNAP OFF/ON`；
  - keyframe 创建/seek/拖拽使用。
- 多选：
  - Shift+点击范围；
  - Ctrl/Cmd+A 全选；
  - Shift+marquee 追加；
  - 组拖拽（所有选中 keyframe 同步）；
  - 组删除沿用现有批量删除。
- 拖拽：
  - 4px 启动阈值（沿用 E 层）；
  - 边缘自动滚动（`EditorTimeline.panForDrag`）；
  - snap 目标指示；
  - 组拖拽一次历史记录（`pushBatch`）。
- Layer Audio 左栏：
  - 每层显示绑定音频名 / `DROP AUDIO`；
  - 拖入 SFX 资产绑定；
  - × 清除；
  - `dropPointer` 优先命中 `[data-layer-audio-drop]`。

未做：Inspector 重构、主题换肤、复杂动画。

## 6. 测试覆盖

| 项 | 结果 |
|---|---|
| `npm run typecheck:v4` | exit 0 |
| `npm run test:v4` | **413 / 413 pass** |
| `npm run check:v4` | totalErrors=0，allPassed=true |
| `npm --prefix v4/app run build` | 成功（仅既有 chunk/dynamic import warning） |
| `cargo test` | **35 passed** |
| 资产校验 | **84 checks PASS**（activePair、logo mark、layerAudio、SFX） |
| R5c-A layer e2e | Logo 172×168；L3 命中 SCORE 003000 / PERFECT 1；Layer Audio count=1 |
| R5c-A media e2e | pseudo pair；left/right 71967ms；offset 33ms / 1 frame |
| R5c-A editor e2e | beat grid 108；Ctrl+A=12；组拖拽全部时间变化、数量不变 |
| R4f e2e | 6/6 notes，ledger valid，restored=true |
| R4f fault e2e | `error:null`，restored=true |
| R5a e2e | `error:null`，Analyze READY，BPM 119.94 |
| R5b2 e2e | `error:null`，fallback/logo/clock 正常 |

新增测试：

- `v4/tests/r5c/a.test.ts`：layerAudio round-trip/非法值、Layer 3+ FullScreen、组拖拽单 Undo、LayerAudioGate 16ms。
- Rust：`mono_offset_frames`（24/30/60fps）、单目导入等时长/伪双元数据、demo 源导入。

## 7. 实机验收清单

- [x] 编辑器资源栏、NoteLogo、NEU Logo 使用 `head-logo.png`。
- [x] 创建 L3 keyframe；Inspector 显示 Layer 3+；保存有 `chartLayerIndex:3`。
- [x] 进入游戏命中 L3；SCORE/PERFECT 增加；Layer Audio L3 音高触发。
- [x] Layer Audio 拖入/清除/重新绑定。
- [x] L1/L2/L3 命中分别播放 220/440/880Hz；未命中不响。
- [x] 单目转双目生成可播放 pair，left/right 等时长。
- [x] 节拍网格/Beat Snap/Ctrl+A/组拖拽。
- [x] 无新增 npm/Rust 依赖。

## 8. 已知限制

- Layer Audio 优先只抑制命中后的同 tick 音频；命中前已播放的声音无法追回（不做 16ms 延迟队列）。
- 单目命令未复用共享 `MediaLock`，由 UI `busy` 单飞串行；并发后端调用未做互斥。
- 单目 20–50ms 会按帧率量化，静态/高速横移场景效果有限。
- E2E 不能听声音；Layer Audio 通过 `window.__NEUROU_LAYER_AUDIO__` 与 `AudioTriggerRuntime` 返回值验证。
- 组拖拽目前只改时间，不跨层。

## 9. 一句话状态

**R5c-A 完成：head-logo 恢复、Layer 3+ 全屏命中验证、layerAudio + 16ms 优先级 + 220/440/880Hz SFX、单目整数帧伪双目（左右 71967ms）、节拍网格/多选/组拖拽；413 单测、35 Rust、84 资产检查、3 个 R5c-A e2e 与 R4f/R5a/R5b2 回归全绿。**
