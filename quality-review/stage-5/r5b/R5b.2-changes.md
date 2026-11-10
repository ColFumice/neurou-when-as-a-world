# R5b.2 · P0 变更说明

时间：2026-10-26（Asia/Shanghai）
范围：R5b.2.0 / .1 / .2 / .3 / .5
状态：**P0 完成**；R5b.2.4 抗抖与真实声卡矩阵未做（按计划等数据），R5b.2.6 A3 未批准，R5b.2.7 未做。

## 0. 决策与边界

- Analyze Beats 采用 **B+**：Manual 一等公民，Analyzer 只做辅助；不重开 R5a 冻结。
- 真实声卡可用（用户确认）；本批只加 CLOCK DEBUG 观测，不改阈值、不改 reanchor、不改抗抖。
- 视频保留 fallback：active 用 72s theme pair，旧 8s pair 不删除。
- 不改 R4a–R4f / R5a 判定逻辑；不改 `beatAnalyzer` / `beatsSidecar` 的 schema 与判定；不改 R5a.2 reanchor 逻辑。
- 不改 Cocos `.meta`；不替换 `head-logo.png`。

## 1. R5b.2.0 · fixture 隔离

旧 R4f / R5a e2e 假设 8s、6 notes、旧 audio；R5b.2 的 demo 已是 72s/12 notes/theme.wav，直接跑会回归。处理：

- 新建 `v4/.stereo-demo/fixtures/r4f-8s/`：
  - 旧 6 帧 `chart-w1.editor.json` + `.bak` + holds；
  - 旧 8s 左右眼视频与 `58798dbd9bacfa2f/audio.wav`；
  - 旧 manifest（只含旧 pair）；
  - 空 `worlds/w1`（ledger 由 e2e 写入/恢复）。
- 新建 `fallback-pair/`：同 8s fixture，但 `activePairId=ffffffffffffffff`；含 world/theme 底图，用于 fallback 链与无视频底图验收。
- `v4/app/tests/e2e/r4f-fixtures.mjs`：
  - `PROJECT` 默认指向 `fixtures/r4f-8s`；`NEUROU_E2E_PROJECT` 可覆盖；
  - 备份目录按 fixture 分离为 `quality-review/stage-4/r4f/backup-fixture`；
  - `startVite(projectRoot)` 设置 `VITE_NEUROU_PROJECT_ROOT`。
- `r5a.e2e.mjs` 默认随 `PROJECT` 使用 fixture；备份目录 `quality-review/stage-5/r5a/backup-fixture`。
- `projectRoot.ts` / `editor/model.ts` 读取 `VITE_NEUROU_PROJECT_ROOT`；生产/普通 dev 不设置时仍走原 demo 路径。这是配置注入，不是游戏逻辑变更。
- demo project 在 R5b.2.0 验证期间未改动。

验证：

- `node v4/app/tests/e2e/r4f.e2e.mjs` → 6/6 notes，ledger valid，`restored=true`。
- `node v4/app/tests/e2e/r4f-fault.e2e.mjs` → `error:null`，`restored=true`。
- `node v4/app/tests/e2e/r5a.e2e.mjs` → `error:null`，Analyze READY，HUD `BPM 119.94`（fixture 的 8s 合成节拍）。

## 2. R5b.2.1 · active 媒体接入

### manifest

- `media/manifest.json` 顶层新增 `activePairId`，当前值 `eb5ad96b7054921c`。
- 旧 pair `58798dbd9bacfa2f` 保留；`apply-demo.mjs` 以后也会写 `activePairId`。
- `world.json` 的 `media.activePairId` 与 `theme.json` 的 `activePairId` 同步。

### chartLoader

- `loadMedia` 改为：
  1. `activePairId` 优先；
  2. active pair 不存在、资源不完整或左右眼文件不可读时，按 manifest 倒序回退；
  3. 回退成功时推送 `MEDIA FALLBACK / <requested> → <actual>` 警告，HUD 明文显示；
  4. 全部不可用时返回 `null`，由 GameStage/无视频路径继续。
- `GameMedia` 新增 `requestedPairId` / `fallback` 字段；旧 manifest 没有 `activePairId` 时仍按“最后一个 pair”兼容。

### 编辑器

- 素材栏显示名改为 manifest 实际 basename：
  - `theme.wav`
  - `rain-night-right-loop.mp4`
  - `rain-night-mark`（Logo 显示名；绑定 id 仍为 `asset:guidance:head-logo`，避免 R4b 绑定回归）
- `MediaPanel` 默认路径改为 `media/theme/rain-night-*-loop.mp4`，不再默认 `source/left.mp4` / `source/right.mp4`。
- 新增 **Load theme**：
  - 直接读取 manifest `activePairId`，用 `readMediaFile` 恢复左右眼，不改 manifest、不重新导入；
  - 避免 `importStereo` 对无音轨 loop 视频生成静音 WAV；
  - 成功后立即关闭面板；失败显示错误。
- `Import stereo` 保持原转码路径，适合外部左右眼素材。

### e2e 结果

- demo：视频 `duration=72`、`readyState=4`，无 `MEDIA FALLBACK` 警告。
- fallback fixture：警告文本
  `MEDIA FALLBACK / activePairId ffffffffffffffff 不存在 · MEDIA FALLBACK / ffffffffffffffff → 58798dbd9bacfa2f`，
  视频回退到 8s，`readyState=4`。
- 移除旧 pair 文件后：无可用资源，GameStage 显示 1920×1080 世界底图，HUD 仍为 8s 谱面。

## 3. R5b.2.2 · 透明 Logo / 无视频底图 / START 主题图

### Logo mark

- 新增 `assets/resources/guidance/rain-night-mark.png`：512×512、RGBA 透明底、14,719 bytes。
- 生成器：`v4/app/tools/assets/generate-logo-mark.mjs`（纯 JS 像素绘制 + `rgbaToPng`，无 Canvas/外部素材）。
- 镜像副本：`media/images/logo-mark-transparent.png`。
- `GAME_LOGO_PATH` 默认指向新 mark；`VITE_NEUROU_LOGO_PATH` 可覆盖。
- 旧 `head-logo.png` 与 `.meta` 原样保留，未替换。
- 编辑器资源栏加 `data-asset-id`，e2e 验证 `<img>` `naturalWidth=512`、`naturalHeight=512`、`complete=true`。
- 缩略图增加 `brightness(1.45) + drop-shadow`，但**没有**把 1920×1080 海报当小图标。

### GameStage 无视频底图

- `GameStage` 新增可选 `fallbackImageUrl`；`GameNeuStage` 透传。
- 无 media 时显示 `media/images/world-rain-night.webp`，`object-fit: cover`、压暗，文字 fallback 保留；图片加载失败仍显示文字。
- 无 media 时隐藏 NEU 全屏 lights（只影响无舞台可照的 fallback，不改有 media 的光效）。
- e2e：无媒体时 `[data-fallback-image]` `complete=true`、`naturalWidth=1920`、`data-visible=true`。

### START 标题层

- GameScreen 在 START overlay 内加 `game-overlay__theme-bg`，背景为 `media/images/theme-rain-night.webp`，半透明压暗，z-index 在 HUD 之下、游戏画面之上。
- e2e：`[data-theme-image="true"]` 存在，截图见证据。

## 4. R5b.2.3 · CLOCK DEBUG 观测

只加观测，未改判定/阈值/抗抖/reanchor。

### 采样

- `ClockDriftMonitor` 增加 600 样本环形缓冲，按 0.5s 采样约 5 分钟；覆盖最旧样本。
- 每样本：
  - `seq` / `wallMs` / `playheadMs` / `driftMs` / `status` / `action` / `reanchored` / `inputPaused`
  - `telemetry.contextTime`
  - `telemetry.timestampPerformanceTime` / `timestampContextTime`
  - `telemetry.baseLatency` / `outputLatency`
  - `telemetry.contextState` / `audioReadyState`
  - `telemetry.visibilityState`
  - `telemetry.reanchorCount`
  - `telemetry.source`（`timestamp` / `fallback`）
- WebAudio 的 `audioReadyState` 以 buffer 就绪映射为 4（WebAudio 没有 HTMLAudioElement）；文档已注明。
- `PerformanceOutputClock` 返回 `source:'fallback'`、`contextState:'performance'`。

### 导出

`window.__NEUROU_CLOCK_DEBUG__`：

```js
window.__NEUROU_CLOCK_DEBUG__.export()  // JSON 字符串
window.__NEUROU_CLOCK_DEBUG__.get()     // 对象
window.__NEUROU_CLOCK_DEBUG__.clear()   // 清空环形缓冲
```

`export()` 结构：

```json
{
  "schemaVersion": 1,
  "capacity": 600,
  "count": 8,
  "exportedAt": "2026-10-26T...",
  "samples": [
    {
      "seq": 0,
      "wallMs": 22073.2,
      "playheadMs": 471.46,
      "driftMs": -29.996,
      "status": "Warning",
      "action": "Warn",
      "reanchored": false,
      "inputPaused": false,
      "telemetry": {
        "contextTime": 3.97,
        "timestampPerformanceTime": 22066.8,
        "timestampContextTime": 3.918,
        "baseLatency": 0.01,
        "outputLatency": 0.04,
        "contextState": "running",
        "audioReadyState": 4,
        "visibilityState": "visible",
        "reanchorCount": 0,
        "source": "timestamp"
      }
    }
  ]
}
```

### 本次观测

- e2e（headless / 无声卡）8 个样本，全部 `source=timestamp`，`contextState=running`，`baseLatency=0.01`、`outputLatency=0.04`。
- drift 约 **−30ms**，稳定处于 Warning；这与 R5b.1 的 headless `CLOCK DRIFT WARNING` 一致，不据此改阈值。
- 真实声卡的有线/USB/蓝牙 5 分钟矩阵尚未采集；按计划留给 R5b.2.4。抗抖 N=3 也尚未实现。

## 5. R5b.2.5 · Analyze Beats B+ Manual UX

- BPM 直接输入（60–200，0.01 步进）。
- Tap：记录最近 4 次；≥3 次时用 `manualBpm` 计算并回填 BPM。
- offset：ms 输入 +/−10；`beatGrid` 按 BPM 归一化到 `[0, period)`，避免首拍越过 duration。
- 节拍网格预览：前 64 个 beat 的条形图，downbeat 高亮；显示 beats / downbeats / duration。
- Sidecar 导入/导出：
  - Export：读取当前 sidecar，生成下载并同时显示可复制 JSON；
  - Import：文件选择 → `parseBeatsSidecar`（chartId、duration、audioSha256）→ `audioAssetId` 匹配校验。
- 覆盖确认：已有 sidecar 时，Analyze / Manual / Import 都进入 **Overwrite / Cancel** 内联确认。
- 删除：二次确认后删除 sidecar。
- 提示：始终显示“氛围 / 持续低音素材建议 Manual；Analyzer 的 LowConfidence 不会被隐藏”。
- Manual 写盘：`source='Manual'`、`confidence=1`，与 `beatsSidecar` 共用同一路径/schema。
- Analyzer / sidecar schema 未改；`viewFromSidecar` 形态未改，404 旧测试保持通过。

e2e：

- demo sidecar READY / 90 BPM / offset 0 / 109 beats / 28 downbeats / CONF 100% / SOURCE Manual。
- Tap 4 次得到约 **116.6 BPM**（间隔 500ms，计时抖动导致非精确 120），回填成功。
- 手工设回 90 BPM/offset 0 → Save Manual → 覆盖确认 → Overwrite → READY 90.00 / Manual / 100%。
- Export JSON 长度 1853，含 `"source": "Manual"` 与 `"beatsMs"`。
- Load theme 按钮存在、无错误。

## 6. 测试覆盖

| 项 | 结果 |
|---|---|
| `npm run typecheck:v4` | exit 0 |
| `npm run check:v4` | totalErrors=0，allPassed=true |
| `npm run test:v4` | **408 / 408 pass**（404 旧 + 4 新 R5b.2） |
| 资产校验 | `verify-assets.mjs` **72 checks PASS**（原 68 + activePairId + logoMark 3 项） |
| App build | `npm --prefix v4/app run build` 成功；仅既有 dynamic import / chunk size 警告 |
| Cargo | `cargo test --quiet` → **31 passed** |
| R4f e2e | 6/6 notes，ledger valid，restored=true |
| R4f fault e2e | `error:null`，restored=true |
| R5a e2e（fixture） | `error:null`，Analyze READY，HUD BPM 119.94 |
| R5b.2 e2e | `error:null`；active 72s、fallback 8s、fallback 底图 1920、logo 512、clock 8 samples、Manual 全流程 |

新增测试：`v4/tests/r5b2/integration.test.ts`
- Manual 90 BPM sidecar：Manual/confidence 1、109 beats、28 downbeats；
- offset 归一化；
- BPM 越界拒绝；
- CLOCK DEBUG 605 次写入后保留 600、seq/telemetry 正确、clear 生效。

证据：

- `quality-review/stage-5/r5b2/evidence/r5b2-e2e.json`
- `r5b2-game-active-start.png`
- `r5b2-editor-beats-manual.png`
- `r5b2-editor-beats-manual-ready.png`
- `r5b2-game-active-playing.png`
- `r5b2-clock-debug-demo.json`
- `r5b2-fallback-pair.png`
- `r5b2-fallback-image.png`

## 7. 实机验收清单

- [x] 进入 w1：72s 新视频、`theme.wav`、HUD BPM 90.00。
- [x] START 标题层：`theme-rain-night.webp` 半透明背景。
- [x] 编辑器资源栏：`rain-night-mark` / `theme.wav` / `rain-night-right-loop.mp4`。
- [x] 新透明 Logo mark：512×512，`complete=true`；游戏 NEU 资源层可见。
- [x] MediaPanel `Load theme`：加载 activePair，无错误。
- [x] Analyze Beats：Analyzer 保留；Manual BPM/Tap/offset/网格/导出可用；覆盖确认生效。
- [x] 导出 CLOCK DEBUG JSON：`window.__NEUROU_CLOCK_DEBUG__.export()`。
- [x] fallback 链：`MEDIA FALLBACK` 明文；8s 旧 pair 可用。
- [x] 无视频底图：1920×1080 世界图显示。
- [ ] 真实声卡 5 分钟矩阵 / N=3 抗抖：**R5b.2.4 待做**。
- [ ] 密集谱面 / 海报标题卡 / 项目树缩略图：**R5b.2.7 未做**。

## 8. 已知限制与风险

- **CLOCK 抗抖未实现**：本批只有观测。真实声卡矩阵完成前不改阈值，不宣称已修复 drift。
- **headless 漂移**：e2e 环境无声卡，仍显示 `CLOCK DRIFT WARNING`；这是预期，不是 R5b.2 回归。
- **fixture 是 8s 旧素材**：只服务旧 e2e；不是正式 demo 资产。
- **Manual offset 归一化**：输入 1000ms 在 90 BPM 下会归一化为约 333ms；保存后输入框显示归一化值。这是 beat grid 语义，不是丢值。
- **Load theme 不重新导入**：依赖 manifest activePair 已存在；缺失时回退到上一对。若一对都没有，会明确报错。
- **无媒体时隐藏 NEU 全屏 lights**：避免白色 light 覆盖 fallback 底图；有 media 时光效不变。
- **NoteLogoLayer 仍自动给 layer 1/2 的每个 note 加 Logo**：12 帧安全；24–32 帧密集谱面需先加 `logoEnabled`，留到 R5b.2.7。
- **视频体积未优化**：72s 左右眼约 44MB，解码/内存评估留到 R5b.3。
- **Logo mark 与应用资源**：新文件在 `assets/resources/guidance/`，不是 `media/` 生成物；未改任何 `.meta`。

## 9. 一句话状态

**R5b.2 P0 完成：fixture 隔离、active theme 媒体 + fallback、透明 Logo/底图、CLOCK DEBUG 导出、Manual BPM/Tap/网格/导入导出全部接入；408 单测、72 资产检查、R4f/R5a/R5b.2 e2e、app build、cargo test 全绿，真实声卡抗抖留 R5b.2.4。**

## 10. 已知未完成的架构级需求

> 本节是 R5b.2 实机验收记录的补充，不改变上文 P0 结论。
> 以下三项在 R5b.2 范围内**未实现、未验收**，统一归入 **R5c**，等待 PROTOCOL 的 R5c 计划授权。

### 10.1 AI 四任务真实实现（R5c.1–R5c.4）

R4e 只实现了 AI 路由、KeyManagement 与 `KeyframeGeneration` 的 UI/请求边界；以下四类任务尚未形成可用的真实处理链：

| 子任务 | 编辑器入口 | 输入 | 预期处理 | 输出 | 归属 |
|---|---|---|---|---|---|
| ParallaxExtractionTask | “提取视差层”按钮 | 双目视频或单目视频 | 双目直接分层；单目用 ffmpeg + 简单深度估计切三层 | `parallax-left` / `parallax-mid` / `parallax-right` 三层纹理 | R5c.1 |
| NarrativeVectorTask | 选中 NEU 节点后的“AI 生成向量” | 节点上下文 + 提示词 | AI 生成建议 | 20 维建议值；用户确认后应用到该节点的 `NarrativeEvent` | R5c.2 |
| RhythmGenerationTask | 节奏生成入口 | 音频文件 | Local Ollama 或 Cloud AI 真实分析（不是 Template fallback） | 节奏点列表，不是固定音符模板 | R5c.3 |
| SceneVisionTask | “识别物体”按钮 | 视频帧 | AI 物体检测 | 候选痕位置（高饱和框） | R5c.4 |

当前状态：四类任务均不具备端到端真实实现；R5b.2 的 Analyze Beats Manual UX **不能**视为 RhythmGenerationTask 的替代。

### 10.2 视频谱面定位（R5c.5，需重开 R4a/R4b 部分冻结）

当前 R4a 流程仍是“进入世界 → 直接打谱面”，属于独立音游形态：

```text
进入世界 → GameScreen 直接进入 Rhythm / 谱面判定
```

目标架构：

```text
进入世界 → Explore（视差探索 + 痕触发）
         → NEU 蓝图触发 EnterRhythmMode(chartId)
         → Rhythm（8 格判定）
         → 完成/退出 → 返回 Explore
         → Score 传入账本
```

需要的架构调整：

1. `GameScreen` 增加 `GameMode` 状态机：`Explore` / `Rhythm` / `Cutscene`。
2. NEU 新增节点类型：
   - `EnterRhythmMode(chartId)`
   - `PlayCutscene(cutsceneId)`
   - `ExitToExplore()`
3. 进入世界默认 `Explore`；不再默认直接进入谱面。
4. NEU 触发 `EnterRhythmMode` 时切到 `Rhythm`（现有 8 格判定）。
5. Rhythm 完成或退出后回 `Explore`，Score 写入账本。
6. 这是对 R4a/R4b 的架构调整，需要重开相关冻结；必须单独立项、单独验收，不能混入 R5b.2 P0。

当前状态：状态机、NEU 三类节点、Explore 默认入口、Score 回账本均未实现；现有 R5b.2 e2e 验证的仍是“直接进谱面”的旧路径。

### 10.3 单目转双目工具（R5c.6）

编辑器需要新增“单目转双目”入口：

- 输入：单个视频。
- 处理：ffmpeg 复制两份 + 时间偏移（一前一后，`Δt=20~50ms`）。
- 输出：`left.mp4` / `right.mp4`。
- 适用：有轻微运动的场景（雨夜、车流、人物走路）。
- 不适用：完全静止或高速横移场景；需要明确提示伪双目局限。

当前状态：未实现；`MediaPanel` 现有 `Import stereo` 仍要求用户提供两个视频，`Load theme` 只加载已有 activePair。

### 10.4 记录边界

- 上述三项**不计入 R5b.2 P0 完成度**；R5b.2 的 408 单测、72 资产检查、R5b.2 e2e 均未覆盖它们。
- R5c 计划授权前，不开始实现，也不修改相关冻结。
- CLOCK 真实声卡观测（R5b.2.4）继续，不受 R5c 影响；二者独立推进。

## R5c-B 实施状态（2026-10-26）

- §10.2 视频谱面定位的 GameMode 架构已实现：默认 Explore、NEU 控制进入 Rhythm、完成/退出回 Explore、Score 回账本。
- 新增 `?mode=rhythm` debug 入口与 `/rhythm` 命令；旧 e2e 迁移到该入口。
- Explore 复用 chart NEU 图并做模式过滤；world-level NEU 图仍不在本批。
- Cutscene MVP（schema v1 / 播放 / 字幕 / 跳过 / 未知 id 告警）已实现；不做 cutscene 编辑器。
- §10.3 单目转双目已在 R5c-A 完成；§10.1 AI 四任务仍属于 R5c-C，未开始。
- 本批没有新增 npm/Rust 依赖；R4a.1 / AudioOutputClock / ChartPremiereDirector / 账本单写者未改。
