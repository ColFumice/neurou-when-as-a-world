# R5c-B · GameMode 架构与视频谱面定位修正

时间：2026-10-26（Asia/Shanghai）
状态：**R5c-B 完成**；R5c-B 未改 R4a.1 判定数学、`AudioOutputClock`、`ChartPremiereDirector`、账本单写者。

## 1. GameMode 状态机

新增 `v4/app/src/game/gameMode.ts`：

```ts
GameModeState =
  | { mode: 'Explore'; status: 'loading'|'ready'|'error'; ... }
  | { mode: 'Rhythm'; phase: RhythmPhase; chartId; entrySource; ... }
  | { mode: 'Cutscene'; phase: 'loading'|'playing'|'error'; cutsceneId; ... }
```

- `GameMode`：Explore / Rhythm / Cutscene
- `RhythmPhase`：loading / ready / countdown / playing / paused / completed / error
- 两者正交；Explore / Cutscene 没有 RhythmPhase。
- 转换函数 + transition lock：
  - Explore → Rhythm 只允许 ready 且无锁；
  - `ExitToExplore` 幂等；
  - Rhythm 内忽略 EnterRhythm / PlayCutscene；
  - Cutscene 只从 Explore 进入；
  - 非法转换返回同一 state 引用。
- `App` 把初始 mode 传给 `GameScreen`；默认 Explore。
- `?mode=rhythm` 长期 debug 入口；`/rhythm` 命令同效。
- debug 标记只在 `?mode=rhythm` 时由 `index.html` 预写 `sessionStorage`，用于兜住 Tauri 导航丢 query；App 模块消费后立即删除。`closeGame` / `openEditor` 重置 Explore，`?mode=explore` 强制 Explore。**不是粘性模式**；详见 R5c-B-patch。

## 2. GameScreen 宿主 / Explore

- `GameScreen` 持有 `modeState`/`modeRef`、共享 chart/media，按模式路由。
- 默认进入世界：**Explore**，无 START、无 8 格、无 Score 判定。
- Explore：
  - `ExploreClock`（`performance.now()` 轻量时钟），**不创建/不启动 AudioOutputClock，不启动 BGM**；
  - `GameStage` 视差、Rain、Trace、Frame、Trigger 复用；
  - `ExploreHud`（液态玻璃）；
  - Shift+方向键移动框，Shift+Enter 痕对齐；不接收 note 键；
  - `/rhythm` 调试进入。
- Rhythm：
  - 懒创建 `ChartSnapshot` + `AudioOutputClock` + 完整 NEU；
  - 复用现有 8 格 / HUD / 判定；
  - 正常 EnterRhythm 自动 countdown；`?mode=rhythm` 保留 ready + START + completed 旧行为。
- Exit / 完成回 Explore：
  - 只销毁 Rhythm session（clock/snapshot/完整 NEU），保留 Explore 的 chart/media/Explore NEU/trace/trigger；
  - 正常完成显示结果页 → `RETURN TO EXPLORE`；
  - debug completed 仍为旧 `BACK / ENTER`。
- Cutscene 暂停 Explore clock/输入；结束/跳过回 Explore。

## 3. NeuControlSignal 路由

- 新类型在 `v4/app/src/game/neuControl.ts`，**不进入** `GamePlaybackSink`：

```ts
interface NeuControlSignal {
  kind: 'Control';
  moduleId: string;
  action: 'EnterRhythmMode' | 'PlayCutscene' | 'ExitToExplore';
  chartId: string | null;
  cutsceneId: string | null;
  atMs: number;
  sourceId: string | null;
}
```

- `NeuModuleType` 增加三类节点；`EditorNeuPanel` 有最小 inspector。
- `NeuRuntime` 新增：
  - `onControl` 回调；
  - `activation: 'Explore' | 'Rhythm'`；
  - Explore 跳过 RhythmPoint / Binding，支持时间根与虚拟脉冲；
  - Rhythm 忽略 Control。
- `GameNeuRuntime`：
  - `activation`；
  - `pulse(sourceId)`：Trace/Trigger 以 `trace:<id>` / `trigger:<id>` 注入图根；
  - Explore 跳过 binding。
- `GameScreen` 控制路由：
  - EnterRhythmMode(chartId) → 校验当前 chart → 懒建 Rhythm → 自动 countdown；
  - PlayCutscene(cutsceneId) → Cutscene；
  - ExitToExplore → 幂等回 Explore；
  - 未知 chart/cutscene 只 HUD 告警。
- `NeuRuntime` 的 Control 信号不进 `NeuSignal`，`GamePlaybackSink` 不感知。

## 4. Cutscene schema v1

`cutscenes/<id>.json`：

```json
{
  "schemaVersion": 1,
  "cutsceneId": "cs-intro",
  "durationMs": 3000,
  "video": { "assetId": "asset:video:cutscene-intro" },
  "audio": null,
  "subtitles": [
    { "startMs": 0, "endMs": 900, "text": "雨夜，先停一下。" }
  ],
  "skippable": true,
  "skipAfterMs": 100,
  "endAction": "ReturnToExplore"
}
```

- `video/audio` 支持 `assetId` 或受控 `relPath`（media/assets）；可为 null。
- 字幕排序、不重叠、结束不超过 duration。
- `skippable` / `skipAfterMs` / `endAction`（当前仅 ReturnToExplore）。
- `CutsceneMode`：全屏视频、独立音频、字幕 overlay、SKIP/Esc；结束/跳过回 Explore。
- 未定义 cutsceneId / 读取失败 / schema 非法：HUD warning，留在 Explore，不崩溃。
- 不做 cutscene 编辑器；不写账本。

## 5. 9 个旧 e2e 改造

全部从默认 Explore 改走 `?mode=rhythm`：

1. `r4f.e2e.mjs`
2. `r4f-fault.e2e.mjs`
3. `r5a.e2e.mjs`
4. `r5b1.e2e.mjs`
5. `r5b2.e2e.mjs`
6. `r5b2-patch-clock.e2e.mjs`
7. `r5c-a-layer.e2e.mjs`（两处导航）
8. `r5c-a-media.e2e.mjs`
9. `r5c-a-editor.e2e.mjs`

`?mode=rhythm` 下旧流程与旧断言不变；`r5b1` 仍需按其 72s demo 语义设置：

```powershell
$env:NEUROU_E2E_PROJECT='...\v4\.stereo-demo\project'
$env:NO_RECORD='1'
node v4/app/tests/e2e/r5b1.e2e.mjs
```

## 6. 账本

- 正常 Rhythm 自然完成且全部 note 已判 → 现有 `ChartPremiere` + `GameLedgerHost.recordPremiere`。
- 结果页 → 回 Explore；每 chart 一次首演不变；`PremiereRecorded` 不覆盖。
- `EXIT TO EXPLORE` / `ExitToExplore` / Cutscene / debug 中途退出：不写账本。
- R5c-B explore e2e：1 条；mid-exit：0；cutscene：0 + 未知 cutscene 仍 0。

## 7. 测试与验收

| 项 | 结果 |
|---|---|
| `npm run typecheck:v4` | exit 0 |
| `npm run test:v4` | **435 / 435 pass** |
| `npm run check:v4` | totalErrors=0，allPassed=true |
| `npm --prefix v4/app run build` | 成功（仅既有 chunk/dynamic import warning） |
| `cargo test` | **35 passed** |
| 资产校验 | **84 checks PASS** |
| R5c-B explore e2e | Explore 无 grid/START/score → EnterRhythm → grid → 完成 → 回 Explore；账本 1 |
| R5c-B mid-exit e2e | 中途 `ESC / EXPLORE` → 回 Explore；账本 0 |
| R5c-B cutscene e2e | cs-intro 字幕/SKIP → 回 Explore；账本 0；未知 id 只告警 |
| R4f e2e | 6/6 notes，ledger valid |
| R4f fault e2e | game ready，ledger corrupt 不写，restored=true |
| R5a e2e | Analyze READY，BPM 119.94，HUD downbeat |
| R5b1 e2e | demo 72s，HUD BPM 90 / 72.000（`NEUROU_E2E_PROJECT` + `NO_RECORD=1`） |
| R5b2 e2e | clock/fallback/visual 不回归 |
| R5b2 patch clock e2e | 通过 |
| R5c-A layer/media/editor | 3/3 通过（迁移 `?mode=rhythm` 后） |

新增单测：

- `v4/tests/r5c/b-game-mode.test.ts`：转换、transition lock、幂等 Exit、cutscene parser。
- `v4/tests/r5c/b-neu-control.test.ts`：时间根/虚拟脉冲、Explore 过滤、Rhythm ignore、control 不泄漏、editor round-trip。

## 8. 冻结文档 v2 addendum

- `quality-review/stage-4/r4/R4a-changes.md`：R5c-B v2 addendum
- `quality-review/stage-4/r4b/R4b.1-changes.md`
- `quality-review/stage-4/r4b/R4b.2-changes.md`
- `quality-review/stage-4/r4f/R4f-changes.md`
- `quality-review/stage-5/r5b/R5b.2-changes.md` §10 状态更新

采用 addendum，不重发整套 V 裁定书；若流程强制编号，可再补 `V-R4a.2-v2` / `V-R4b.1-v2` / `V-R4b.2-v2` / `V-R4f-v2` 一页编号件。

## 9. 实机验收清单

- [x] 进入世界默认 Explore；无 8 格/START/score。
- [x] NEU EnterRhythmMode 自动 countdown 进入 Rhythm。
- [x] Rhythm 8 格/判定/HUD 与旧流程一致。
- [x] 完成写账本 1 条并回 Explore。
- [x] 中途退出不写账本并回 Explore。
- [x] Cutscene 字幕/跳过；未知 id 只告警。
- [x] `?mode=rhythm` 旧流程可用；9 个旧 e2e 迁移。
- [x] R4a.1 判定测试零修改全绿。
- [x] 不新增 npm/Rust 依赖。

## 10. 已知限制

- Explore 复用 chart NEU 图，尚无 world-level NEU 图；该语义是 MVP 临时方案。
- Explore 不启动 BGM；只保留雨声/环境与可播放的探索资源。
- Trace/Trigger 的 runtime 对象在 Rhythm 期间沿用，返回 Explore 时其内部时间/可见状态已被谱面推进；独立 Explore/Rhythm trace 实例留后续。
- `?mode=rhythm` 是一次性 debug 入口；关闭世界/进入编辑器后回 Explore，刷新无 query 回 Explore。显式 URL 仍含 `?mode=rhythm` 时，刷新会再次作为一次新的 debug 入口。详见 `R5c-B-patch-changes.md`。
- Cutscene e2e 使用字幕-only fixture；视频/音频路径由 loader 支持，但本批未做真实 cutscene 媒体资产。
- 未做 cutscene 编辑器、AI 四任务、性能优化。

## 11. 一句话状态

**R5c-B 完成：默认 Explore + NEU 控制进入 Rhythm + 自动倒计时 + 完成/中途退出回 Explore + 首演账本 + Cutscene MVP；435 单测、35 Rust、84 资产检查、3 个 R5c-B e2e、9 个旧 e2e 迁移与 R4f/R5a/R5b2 回归全绿。**
