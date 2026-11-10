# R4b.2 实机验收记录

日期：2026-10-24
环境：Tauri debug 窗口（1280×800）+ Vite `localhost:1420` + WebView2 CDP（9222）。
方法：真实进入世界 `w1`；临时给 `chart-w1.editor.json` 增加 NEU 测试模块；通过 CDP `Runtime.evaluate` 读 DOM / React fiber 中的 `GamePlaybackSink`，并用 `Page.captureScreenshot` 截图。
测试数据已恢复：`v4/.stereo-demo/project/charts/chart-w1.editor.json` 已从备份还原，SHA256 与测试前一致（`8BAF1C8E…68182`）。

## 1. 结果总览

| 清单项 | 结果 | 证据 |
|---|---|---|
| 进入世界、NEU 模式下正常 START | **通过** | `01-playing-effect-light-subtitle-image.png` |
| Subtitle 覆盖层 | **通过** | 截图底部 `R4B.2 NEU SUBTITLE / 字幕` |
| Image 覆盖层 | **通过** | 截图中央 head-logo；DOM `IMG` + asset URL |
| Video 覆盖层 | **通过** | `02-playing-video-resource.png`；DOM `VIDEO` + blob URL，`readyState=4` |
| Effect 接入 EffectCompositor | **通过** | `.game-neu-stage` inline transform `translateX(...) skewX(...)` |
| FullScreen Light filter + overlay | **通过** | `FlashWhite` 生成 `.game-neu-light--flashWhite`，opacity `0.2075` |
| CycleWarning 写入 HUD | **通过** | HUD 文本 `NEU 循环告警：r4b2-test-loop @ 0ms（GraphCycle）` |
| Binding / NEU Audio 同 tick 去重 | **通过（trace 级）** | 首个 tick 仅 1 条 trace：origin=`Binding`，asset=`asset:audio:main`，at=`0` |
| 暂停/恢复 | **通过** | `PAUSED` 覆盖层；暂停 1.6s playhead 冻结在 `005.871`，恢复后推进到 `007.135` |
| 结算/卸载 | **通过** | `CHART COMPLETE`；Subtitle/Resource/Light 全部消失 |
| 空 NEU 图 | **通过** | HUD 与 START 覆盖层均显示 `无 NEU 图`；游戏照常运行 |
| NEU 异常隔离 | **通过（注入）** | 注入 `advanceTo` throw 后 HUD 出现 `NEU 执行异常（已隔离）`，playhead 继续到 `001.926`，MISS 继续累计 |
| 非 BGM 音频可听性 | **未验证** | demo 只有 `asset:audio:main`，且 BGM 由 R4a 持有，trace 为 `played:false` |
| Local Light 局部遮罩 | **未验证** | 本轮测试 Light 为 `FullScreen`；需要额外 target asset 场景 |
| 编辑器 UI 添加/保存模块 | **未走 UI** | 测试模块由 JSON 直接写入，走 `EditorWorldFile.fromJson` 校验路径 |

## 2. 关键观测

### 2.1 首个 tick 的音频 trace

在 playhead `000.739` 时，从运行中的 `GamePlaybackSink` 读到：

```json
{
  "lastOrigin": "Binding",
  "dropped": 0,
  "traces": [
    {
      "asset": "asset:audio:main",
      "at": 0,
      "origin": "Binding",
      "played": false
    }
  ]
}
```

- 同一 tick 的 Binding 与 NEU Audio 只产生一条 trace；
- `origin` 为 `Binding`，符合 Binding 优先；
- `played:false` 是因为 BGM 已由 R4a `audioClock` 持有，Sink 不二次起播。

完整 trace 文件：`r4b2-live-audio-trace.json`。

### 2.2 Effect / Light

运行中 DOM：

```text
stageStyle:
opacity: 1;
transform: translateX(-6.98px) skewX(-2.09deg);
filter: hue-rotate(-14deg);
```

- Effect `Glitch` 已作用在 GameStage 外壳；
- Light `FlashWhite` 创建了 `.game-neu-light--flashWhite`，`opacity=0.207529`；
- 另一个 Vivid 场景中 stage filter 为 `hue-rotate(...) saturate(1.31486)`。

### 2.3 暂停 / 恢复

- CDP 发送 Escape 后出现 `PAUSED`；
- 暂停 1.6s 后 playhead 仍为 `005.871`；
- 恢复后 1.2s playhead 到 `007.135`；
- 暂停期间 Subtitle 保留在冻结帧，动效/光源按冻结 playhead 取值。

### 2.4 异常隔离

在游戏运行时把 `GameNeuRuntime.advanceTo` 替换为抛错函数：

```text
playhead = 001.926（继续推进）
warning = 无 NEU 图 · NEU 执行异常（已隔离）：R4B2 injected NEU failure
counts = PERFECT 0 / GOOD 0 / MISS 2
```

- rAF 未中断；
- R4a 判定继续；
- HUD 只显示一次异常；
- 当前空 NEU 场景无额外 overlay。

### 2.5 空 NEU 图

有效 editor 文档、`neuModules=[]`：

```text
chart = chart-w1
source = WORLD w1 · EDITOR
warning = 无 NEU 图
playhead = 000.756
counts = MISS 1
resources = 0
lights = 0
stage = opacity: 1;
```

游戏正常运行，无 NEU 事件/覆盖层。

## 3. 截图

- `r4b2-evidence/01-playing-effect-light-subtitle-image.png`
- `r4b2-evidence/02-playing-video-resource.png`
- `r4b2-evidence/03-paused.png`
- `r4b2-evidence/04-complete.png`
- `r4b2-evidence/05-empty-neu-ready.png`
- `r4b2-evidence/06-empty-neu-playing.png`
- `r4b2-evidence/07-neu-exception-isolated.png`
- `r4b2-evidence/08-first-tick-audio-binding.png`

## 4. 边界与未覆盖

- 本轮只验证了 FullScreen Light；Local Light 的 `targetAssetId`/mask 未实机覆盖。
- 未验证真实“非 BGM 音频”可听性：demo 只有 BGM 资产，且 R4a 独占 BGM。
- 未通过编辑器 UI 手动添加节点；测试数据直接写入 editor.json 并经过 `EditorWorldFile.fromJson` 校验。
- 异常隔离是通过 CDP 注入 runtime throw 验证的，不是用户可自然触发的游戏内操作。
- 测试期间临时数据已恢复，未保留对 demo 项目的修改。
