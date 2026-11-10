# R4b.2 · 游戏运行时集成与视觉 Sink

日期：2026-10-24
范围：把 NEU 蓝图接入 GameScreen；Live 模式执行、音频/动效/光效/字幕 Sink、异常隔离。
未改动：`v4/core/chart/judge.ts`、`v4/app/src/game/audioClock.ts`、`v4/app/src/game/GameStage.tsx`。

## 1. chartLoader 扩展点

### 1.1 返回结构

`v4/app/src/game/chartLoader.ts` 的 `LoadedGameChart` 新增四个只读字段：

```ts
readonly neuModules: readonly NeuModule[];
readonly neuEffects: readonly EditorEffectInterface[];
readonly neuBindings: readonly EditorBinding[];
readonly editorSeed: number;
```

新增纯数据模块 `v4/app/src/game/neuChart.ts`：

- `neuChartFromEditor(editor)`：只从 `EditorWorldFile` 搬运 `neuModules / effects / bindings / seed`；
- `EMPTY_GAME_NEU_CHART`：空数组 + `editorSeed = 0`；
- `neuChartHudWarning(data)`：`neuModules.length === 0` 时返回 `无 NEU 图`。

### 1.2 缺失/失败降级

- `editor.json` 不存在、`EditorWorldFile.fromJson` 抛错、或 NEU 模块为空：
  - `neuModules / neuEffects / neuBindings` 返回空数组；
  - `editorSeed = 0`；
  - `warnings` 追加 `无 NEU 图`，HUD 警告区与 START 覆盖层都会显示；
  - 游戏仍进入 `ready`，R4a `notes / media` 解析完全不变。
- `fallbackChart`（无 editor/v2、或整体加载失败）也带空 NEU 字段和 `无 NEU 图`。
- `editorSeed` 只从已校验的 `EditorWorldFile.seed` 读取，范围 0..2^32-1。

### 1.3 不改 R4a

`readCrossings / buildNotes / layersOf / loadMedia` 未改；NEU 字段是在完成原解析后附加的。

## 2. GameSignalSink 实现

### 2.1 端口与实现

- R4b.1 的 `GameSignalSink` 仍是窄口接口；
- R4b.2 新增实现类 `GamePlaybackSink`（`v4/app/src/game/gameSignalSink.ts`，`implements GameSignalSink`）；
- 不依赖 React / DOM，音频宿主由 `GameScreen` 注入，单测可直接用 fake audio port。

### 2.2 Audio：双轨去重（重点）

两层去重：

1. **GameNeuRuntime 同帧优先 Binding**
   - 每次 `advanceTo` 先收集本帧命中的 binding，再执行 NEU；
   - 本帧已触发过同一 `assetId` 的 binding 时，NEU Audio 直接不投递；
   - 这里按“同一 advance 帧”而不是只按 `atMs` 差值判断，避免 60Hz 下一帧 16.7ms 导致漏判；
   - binding 之间同资产、±16ms 内也只投递一次。

2. **GamePlaybackSink ±16ms 兜底**
   - `GAME_AUDIO_DEDUPE_MS = 16`；
   - 同一 `assetId` 与已有 trace 的 `atMs` 差值 ≤16ms 时丢弃后到者；
   - 保留最近 4s 的 trace，支持跨帧兜底；
   - 正常顺序由 GameNeuRuntime 保证 Binding 先到，所以 Binding 优先。

`origin`：

- `GameSinkEvent.origin`：`Binding | NEU`；
- `GameAudioTrace.origin` + `lastTriggerOrigin` + `audioTraces`：供调试和测试断言；
- `droppedAudioCount` 记录被去重丢弃的音频数。

音频播放：

- 复用 `v4/app/src/editor/AudioTriggerRuntime.ts` 作为采样总线（`load / play / stopAll / dispose`）；
- 不新增 playhead / audioClock；所有触发时刻都来自 `clock.nowMs()`；
- BGM `asset:audio:main` 已由 R4a `WebAudioOutputClock` 持有，Sink 不再二次起播，避免双 BGM；
- 非 BGM 音频按 `asset:audio:*` 预加载，失败只影响该样本；
- 暂停时 `stopAll()`，退出/结算 `dispose()`。

### 2.3 Effect

- 收到 `Effect` 信号后按 `interfaceId` 查 `editorJson.effects`；
- 记录 `effectKind / params / startMs`；
- `GameNeuStage` 用 `composeStageEffects` 合成 `transform / filter / clipPath / opacity`；
- 作用在 `GameStage` 外层 `.game-neu-stage`，**没有修改 `GameStage.tsx`**。

### 2.4 Light

- `GamePlaybackSink` 记录全屏/局部 light；
- `GameNeuStage` 用 `composeStageLights`：
  - FullScreen：filter 合并进 stage 外壳，`overlays` 渲染到 `.game-neu-lights`（z-index 3）；
  - Local：不进入全屏 filter，只匹配 `targetAssetId` 相同的 Resource 覆盖层，并加径向 mask；
- 只做最小 overlay，不做光效精修。

### 2.5 Resource / Subtitle

- Image / Video / VideoStatic：`assetResolver` 映射到 manifest 资源，最小 DOM 覆盖层；
- 支持模块 `durationMs / opacity`，结束时 260ms 淡出；
- Subtitle：底部居中最小字幕条，默认 2000ms；
- 覆盖层 z-index 位于 stage 之上、HUD 之下。

### 2.6 CycleWarning

- 收到 `CycleWarning` 后按 `moduleId` 去重；
- 通过 `onCycleWarning` 写入 `GameScreen.neuWarnings`；
- 与 chart warning 合并后传给 `GameHud.warning`，显示在 HUD 警告区。

### 2.7 生命周期

- `reset()`：开始一局时清空 effect/light/resource/subtitle/warning/audio trace；
- `prune(now)`：每帧删除结束超过 1s 的事件，避免长时间游玩累积；
- `dispose()`：停止采样并清空状态。

## 3. GameScreen 集成

### 3.1 创建

在 chart 与 clock 就绪后：

```ts
new GameNeuRuntime({
  modules: loaded.neuModules,
  effects: loaded.neuEffects,
  bindings: loaded.neuBindings,
  seed: new RandomSeed(loaded.editorSeed), // Live 模式仅遥测，不参与随机
  mode: RandomPreviewMode.Live,             // 游戏内固定 Live
  randomValue: cryptoRandomValue,           // crypto.getRandomValues 包装
  sink: new GamePlaybackSink(...),
  assetResolver: ...,
});
```

- 没有第二个 playhead / audioClock；
- `editorSeed` 不传给任何 Seeded 分支；
- NEU 初始化本身也在 try/catch 中，失败降级为 HUD warning，仍进入 ready。

### 3.2 rAF

主循环通过 `v4/app/src/game/gameFrame.ts`：

```ts
const frame = advanceGameFrame(
  { snapshot, neuRuntime },
  now,
  true,
);
if (frame.neuError !== null) reportNeuError(frame.neuError);
```

`advanceGameFrame` 固定：

1. `snapshot.advance(now)`（R4a 先执行，参数不变）；
2. `try { neuRuntime.advanceTo(now, true); } catch { return error; }`。

NEU 异常不会中断当前帧后续的 `syncHoldLocks / setPlayheadMs / rAF`，`reportNeuError` 每局只写一次 HUD。

### 3.3 暂停 / 恢复 / 退出 / 结算

- 开始：`snapshot.reset()` 后 `neuRuntime.reset(0)`、`sink.reset()`；
- 暂停：clock.pause + 停止 NEU 采样，NEU 状态冻结；
- 恢复：clock.resume + 继续同一 rAF；NEU 不重播已触发事件；
- 结算：先 `snapshot.advance(durationMs)`，再安全推进 NEU 到 duration，然后 dispose；
- 退出/卸载：dispose NEU / sink / AudioTriggerRuntime / clock / chart；
- 倒计时开始时在用户手势内 resume 采样 AudioContext。

## 4. 异常隔离策略

- **唯一捕获点**：`advanceGameFrame` 的 `try/catch`；`snapshot.advance` 在 try 外先执行，保证 R4a 判定已完成；
- **不抛出**：捕获后返回 `neuError`，GameScreen 只 `setNeuWarnings`；
- **不中断 rAF**：after catch 继续 `syncHoldLocks / setPlayhead / requestAnimationFrame`；
- **不重复刷屏**：`neuFailureReportedRef` 每局只报第一条 NEU 异常；
- **初始化隔离**：Sink/Runtime 构造失败只降级，不把 GameScreen 推进 `error` phase；
- **结算隔离**：finish 中的 NEU `advanceTo` 也单独 try/catch。

## 5. 测试与自跑结果

新增 `v4/tests/r4b/game-neu-integration.test.ts`，5 项：

1. Binding + NEU 同 tick（±16ms）只播一次，origin = Binding；
2. Sink 自身 ±16ms 兜底去重，窗口外恢复播放；
3. NeuRuntime 抛错不阻断 `snapshot.advance`，R4a 照常判 Miss；
4. 空 NEU 图：空数组 + HUD `无 NEU 图` + 游戏帧照常推进；
5. 视觉 Sink：Effect / Light / Resource / Subtitle / CycleWarning 落位与过期。

自跑：

```text
npm run test:v4
  tests 208
  suites 49
  pass 208
  fail 0
  R4a 既有 183 项零退化；新增 R4b.2 5 项，总数 203 → 208

npm run check:v4
  check-naming: exit=0 ERROR=0
  check-dependencies: exit=0 ERROR=0
  check-zero-engine: exit=0 ERROR=0
  check-ledger-single-writer: exit=0 ERROR=0
  totalErrors=0 allPassed=true

cd v4/app && npm run build
  typecheck: pass
  vite: 848 modules transformed
  built in 2.55s
```

证据：

- `quality-review/stage-4/r4b/r4b2-test-run.log`
- `quality-review/stage-4/r4b/r4b2-gates.log`
- `quality-review/stage-4/r4b/r4b2-app-build.log`
- `quality-review/stage-4/r4b/R4b.2-live-verification.md`
- `quality-review/stage-4/r4b/r4b2-live-audio-trace.json`
- `quality-review/stage-4/r4b/r4b2-evidence/`

## 6. 人工验收清单

> 2026-10-24 已用 Tauri debug + WebView2 CDP 按本清单做了一轮实机验收：
> `R4b.2-live-verification.md`、`r4b2-evidence/`。
> 已验证：正常 NEU 播放、Subtitle/Image/Video、Effect transform、FullScreen Light overlay、
> CycleWarning、暂停/恢复、结算卸载、空 NEU 图、注入异常隔离、首 tick Binding trace。
> 未覆盖：编辑器 UI 手动加节点、Local Light、真实非 BGM 音频可听性。
> 下方清单保留为人工复验模板。

### 6.1 正常 NEU 图

- [ ] 打开编辑器 NEU 页，确认 `editor.json` 至少有一个 RhythmPoint 和一个下游节点；保存。
- [ ] 进入世界 → START → 倒计时结束；0ms 的 Binding 与 NEU Audio 同 tick 只保留一条触发记录，BGM 只起播一次。
- [ ] HUD 无 `NEU 执行异常`，无 `NEU 循环告警`。
- [ ] 在第 1 秒前放 Subtitle 节点（durationMs=2000），1s 时底部出现字幕，2s 后消失。
- [ ] 放 Image 节点，assetId=`asset:guidance:head-logo`，1s 时出现 logo 覆盖层；放 `Video`，assetId=`asset:video:foreground`，出现前景视频层。
- [ ] Effect 节点 interfaceId 指向 `fx-1`，1s 时 Stage 出现 EaseIn 缩放；Effect 结束自动剥离。
- [ ] Light 节点 `FlashWhite` 全屏闪白；`Invert` 全屏反色；`Local` + `targetAssetId` 只影响匹配的 Resource 覆盖层。
- [ ] 音频：同 tick 不出现双 BGM；当前 demo 只有 `asset:audio:main`（BGM 已由 R4a 持有），因此 NEU/Binding 音频只验证去重与 trace，不重复起播。接入非 BGM 样本后应能通过 AudioTriggerRuntime 听到。
- [ ] 暂停（Esc）时动效/字幕冻结、采样停止；恢复后继续；退出回到项目树。
- [ ] 结算页可正常出现，分数与 R4a 单独运行时一致。

### 6.2 循环告警

- [ ] 在 NEU 图构造 output→input feedback ring，使同一 playhead 达到 100 轮。
- [ ] HUD 警告区出现 `NEU 循环告警：<moduleId> @ ...ms（GraphCycle）`。
- [ ] 游戏不崩溃、不暂停、rAF 持续；谱面判定不受影响。

### 6.3 空 NEU 图

- [ ] 临时移走 `charts/chart-<world>.editor.json`（保留 v2），或使用无 `neuModules` 的 editor。
- [ ] START 覆盖层与 HUD 警告区显示 `无 NEU 图`。
- [ ] 游戏正常开始，note 判定、分数、暂停、结算全部正常；NEU 不投递任何事件。

### 6.4 异常隔离（开发态）

- [ ] 临时让 `neuRuntime.advanceTo` 抛错（或用单测注入），HUD 出现一次 `NEU 执行异常（已隔离）`。
- [ ] 游戏继续运行，note 仍可判定，rAF 不停止；错误信息不每帧刷屏。

## 7. 已知边界

- BGM 由 R4a audioClock 唯一持有；`asset:audio:main` 的 NEU/Binding 触发只做去重记录，不再二次起播。
- 非 BGM 音频需要 `resolveGameAsset` 有映射；当前 demo 只有 `asset:audio:main`，后续接资产库时补 resolver。
- Resource 只覆盖 Image / Video / VideoStatic / Subtitle；不做独立资产选择面板。
- 光效使用 R3.5h 既有 `composeStageLights` 最小 overlay；未做局部矩形作用域、光效精修。
- 视觉 Sink 全部为 DOM overlay，不修改 R4a `GameStage.tsx` 内部的 GLSL / 视频层。

## R5c-B v2 addendum（2026-10-26）

- `GamePlaybackSink` 不接收 Control 信号；Control 走 `NeuRuntime.onControl` → GameScreen control router。
- Explore 只执行非 RhythmPoint 的控制/资源流；Rhythm 恢复完整 binding / NEU 视觉。
- `GamePlaybackSink` 的视觉/音频信号契约、循环告警、16ms 音频去重均未改。
- 回归：R4b NEU 视觉/循环测试、R5b2 视觉 e2e 全绿。
