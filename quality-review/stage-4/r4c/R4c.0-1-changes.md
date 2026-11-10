# R4c.0 + R4c.1 变更说明

日期：2026-10-24

范围：

- R4c.0：触发器 A 类契约、traces/triggers sidecar、chartLoader 扩展；
- R4c.1：`TraceRuntime` 可见性状态机。

未接入：`GameScreen`、`FrameController`、`TraceLayer`、输入分流与触发 sink（R4c.2/R4c.3）。
未改动：`judge.ts`、`GameStage.tsx`、`neuRuntime.ts`、`GamePlaybackSink.ts`。

## 1. R4c.0 核心触发器契约

新增 `v4/core/world/trigger.ts`，实现 §1.6 的 10 个 A 类导出：

- `TriggerInstance`（class）
- `TriggerId` / `EventSignalId`
- `TriggerRegion`
- `ParallaxLayer`
- `TriggerEnter` / `TriggerExit` / `TriggerDwell` / `TriggerOccupancy` / `TriggerParallax`

`TriggerInstance.update` 的五类信号：

| 信号 | 规则 |
|---|---|
| `TriggerEnter` | 上一帧无重叠、本帧 occupancy > 0 |
| `TriggerExit` | 上一帧有重叠、本帧 occupancy = 0 |
| `TriggerDwell` | 连续重叠 ≥ `dwellMs`；每次进入最多一次；`dwellMs=0` 视为关闭 |
| `TriggerOccupancy` | occupancy ≥ threshold；进入后首次达到发一次，之后按 `occupancyIntervalMs` 节流；退出重置 |
| `TriggerParallax` | 重叠期间累计 `frameDeltaX * parallaxFactor`；超过 `parallaxStep` 发一次，带 layer/factor/direction |

`update` 返回的对象类型与输入类型不导出，避免 `check-naming` 把非 A 类名判为 core 导出。

## 2. R4c.0 sidecar 解析

新增 `v4/app/src/game/stageData.ts`：

- `parseTracesSidecar(raw, expectedChartId?)`
- `parseTriggersSidecar(raw, expectedChartId?)`
- 返回 `StageSidecarResult<T>`：`items` + `warnings`。

严格校验：

- `schemaVersion` 必须为 1；
- `chartId` 必须匹配 chartLoader 的 `chart.chartId`；
- 重复 traceId / triggerId；
- trace：tier/origin 枚举、beatTimeMs 安全整数；
- rect/region 归一化 0..1，宽高为正，且不越界；
- `layerIndex` 1..32、`parallaxFactor` -5..5；
- trigger：dwell/occupancy/parallax 参数范围；
- 未知字段/缺字段/非对象 → 返回空数组 + warning，不抛到 chartLoader 外层。

sidecar 文件：

- `charts/chart-<worldId>.traces.json`
- `charts/chart-<worldId>.triggers.json`

解析失败时 `traces / triggers = []`，`r4cWarnings` 记录错误，游戏继续。

## 3. chartLoader 扩展

`LoadedGameChart` 新增：

```ts
readonly traces: readonly GameTracePlacement[];
readonly triggers: readonly GameTriggerDefinition[];
readonly r4cWarnings: readonly string[];
```

- 两个 sidecar 的读取失败用 `.catch(() => null)` 局部降级，不触发整体 fallback；
- `r4cWarnings` 与 R4a 的 `warnings` 分离；
- `readCrossings / buildNotes / layersOf / loadMedia` 未改；
- fallback chart 返回空 traces/triggers/r4cWarnings。

## 4. R4c.1 痕状态机

新增 `v4/app/src/game/traceRuntime.ts`。

公开接口：

```ts
new TraceRuntime(traces, sink?)
  .advanceTo(nowMs, frameRect)
  .strike(nowMs, frameRect)
  .setPerception(active, nowMs)
  .reset()
  .views
  .primaryTracking
  .primaryLock
```

规则：

- `strike` 只在目标中心在框内且 `|now - beatTimeMs| <= 100` 时 `aligned=true`；
- 命中 → `VisibilityState.Revealed`，reason `FrameAligned`；
- 重复命中 → 保持 Revealed，`touchCount++`，事件 `Touched`；
- `advanceTo` 发现 Revealed 目标出框 → `Concealed`，reason `FrameLost`；
- 同拍多 trace 只选一个：beat 偏移最小 → 中心距最小 → 声明顺序；
- `VisualFrame.computeFrameTracking` / `computeTargetLock` 用于 tracking/lock；
- `EnterPerception` 按裁定**不直接 Reveal**；
- `ExitPerception` 把当前 Revealed 恢复为 Concealed；`EnterPerception` 只置 perception 标记；
- `reset` 清空状态，不发事件；
- 不依赖 React/DOM/Tauri，不创建第二个时钟。

## 5. 测试

新增 `v4/tests/r4c/`：

- `stage-data.test.ts`（6 项）：合法/默认值/重复 ID/非法枚举/越界坐标/chartId 不匹配/未知字段。
- `trace-visibility.test.ts`（9 项）：±100ms 边界、框外/错拍不 Reveal、FrameLost、多目标选一、重复 touch、tracking/lock、reset、Enter/ExitPerception。
- `trigger-instance.test.ts`（9 项）：Enter/Exit、Dwell 连续/重置、Occupancy 阈值/节流/退出、Parallax 累计/方向/离框清空、构造校验。

自跑：

```text
npm run test:v4
  tests 232
  suites 52
  pass 232
  fail 0
  新增 R4c 24 项；R4a 183 + R4b 25 = 208 零退化

npm run check:v4
  totalErrors=0 allPassed=true
  check-naming / check-dependencies / check-zero-engine / check-ledger-single-writer 全 0 ERROR

cd v4/app && npm run build
  typecheck pass
  851 modules transformed
  built in 2.62s
```

## 6. 已知边界

- 本批没有 `GameScreen` 接入；`TraceRuntime` 还未被游戏循环调用。
- 没有 FrameController/键盘映射/TraceLayer/HUD；R4c.2/R4c.3 接。
- `EnterPerception` 不 Reveal；`ExitPerception` 只负责恢复 Concealed。
- 痕坐标是归一化屏幕坐标；世界坐标投影留后续。
- 没有触发器的 app runtime/sink；`TriggerInstance` 已可独立测试。
- 没有编辑器 UI；sidecar 为手写/外部生成。
