# R4c.2 变更说明 · 视差框键盘与视觉层

日期：2026-10-25

范围：

- `FrameController`：Shift + 方向键移动框；
- `GameScreen`：R4c 输入分流、rAF 接入、生命周期；
- `TraceRuntime` / `TriggerRuntime` 接入；
- `FrameLayer` 动态化、`TraceLayer`、R4c HUD 与提示；
- 不改 R4a/R4b 的判定与执行文件。

## 1. 输入分流实现

新增 `v4/app/src/game/frameController.ts` 中的纯函数 `routeFrameInput`：

```text
Shift + Arrow*       → frame-move
Shift + Enter        → frame-strike
其他键               → r4a
Shift/Ctrl/Alt/Meta  → ignore
```

规则：

- 仅当 `hasTraces && phase === 'playing' && !commandOpen` 时启用；
- 无 trace sidecar / TraceRuntime 未创建时 `hasTraces=false`，所有键回到原 `strikeFromKey` 路径；
- `Shift+Arrow*` 被 keydown 消费，并记录在 `consumedFrameCodesRef`；对应 keyup 也消费，防止 R4a 收到孤立 Up；
- `Shift+Enter` 同样消费 keydown/keyup，调用 `TraceRuntime.strike`，不进入 `ChartSnapshot`；
- `Shift` 释放时清空 held，已消费的方向键仍由 keyup 清理；
- 窗口失焦、暂停、退出、结算清空 held + consumed；
- `preventDefault()` 阻止方向键滚动。

未启用时（无痕）R4a 的 L3+ 任意键行为完全保留。

## 2. FrameController 与 TraceRuntime 时序

`FrameController`：

- 初始 rect `0.16 / 0.18 / 0.68 / 0.58`；
- 速度 `0.55 /s`，对角线归一化；
- `dtMs` 上限 50ms；
- clamp 到 `[0, 1-width] / [0, 1-height]`；
- `setActive(false)` 暂停冻结，`reset()` 回初始；
- `deltaX` 供 TriggerParallax 使用。

GameScreen 主循环：

```text
now = clock.nowMs()
advanceGameFrame(snapshot, neuRuntime, now, true)   // R4a + R4b，原路径
frameController.update(now - lastNow, held)
traceRuntime.advanceTo(now, frameController.rect)
triggerRuntime.advanceTo(now, frameController.rect, frameController.deltaX)
```

- FrameController 在 R4a/R4b 之后、TraceRuntime 之前更新；
- trace/trigger 每步单独 try/catch；异常只写 HUD warning，rAF 继续；
- 暂停/退出/结算/卸载 reset 或 dispose TraceRuntime / TriggerRuntime，清空 held；
- 暂停时 frameController 冻结，恢复时 `lastFrameNow=null` 避免 dt 跳变。

## 3. 视觉层

### FrameLayer

- 接收动态 `rect`、`FrameTracking`、`VisualFrameTargetLock`、`enabled`；
- inline 百分比定位，不再静态；
- 有痕时显示 `VISUAL FRAME / SHIFT+ARROWS` 与动态状态；无痕时保持静态。

### TraceLayer

- 渲染所有 traces；
- Concealed：低透明度、虚线边框；
- Revealed：高对比实线、玻璃背景、外发光、label；
- Touched：命中后 320ms 闪光动画；
- 位置为归一化屏幕坐标，pointer-events none。

### R4c HUD

- 液态玻璃小面板：
  - `FRAME` / `LOCK`
  - `TRACE REVEALED x / total`
  - `TRIGGER · kind / triggerId`
- `hasTraces` 时显示；无痕时不占界面；
- START 覆盖层另有一行键盘提示；
- 开始游戏后 HUD 显示 `Shift + 方向键移动框 · Shift + Enter 对准`，约 7s 后淡出。

### TriggerRuntime

- `new TriggerRuntime(TriggerInstance[], TriggerSink, onError)`；
- 每帧 `update` 五类信号并转发；
- 单个实例异常由 `onError` 接收，不打断同帧其他实例；
- 本轮仅写 HUD 最近事件，不写账本、不调 NEU。

## 4. 自跑结果

```text
npm run test:v4
  tests 251
  suites 55
  pass 251
  fail 0
  新增 R4c.2 19 项
  R4a 183 + R4b 25 + R4c.0/1 24 = 232 零退化

npm run check:v4
  totalErrors=0 allPassed=true

cd v4/app && npm run build
  typecheck pass
  857 modules transformed
  built in 2.58s
```

新增测试：

- `frame-controller.test.ts`（7 项）：初始/速度/dt 上限/clamp/暂停冻结/reset/对角线；
- `trace-input-routing.test.ts`（7 项）：Shift+方向、Shift+Enter、其他键、无 trace、非 playing/command、Shift 忽略、路由可驱动 FrameController + TraceRuntime；
- `trigger-runtime.test.ts`（5 项）：五信号转发、reset、异常隔离、onError 抛错隔离、dispose。

### 实机冒烟

用 Tauri debug + WebView2 CDP，临时添加 `chart-w1.traces.json` / `.triggers.json`：

- 按 `Shift+ArrowRight`：`.game-frame` 从 `left:16%` 移动到 `left:32%`，HUD `FRAME Tracking`；
- 在 playhead `990ms` 发出 `Shift+Enter`：
  - `.game-trace` 变为 `game-trace--revealed game-trace--touched`；
  - HUD 显示 `FRAME Locked / LOCK Locked / TRACE 1 / 1`；
  - trigger HUD 显示 `TriggerOccupancy · trig-live-1`；
- 无 warning；测试 sidecar 已删除。

截图：`r4c2-evidence/r4c2-live-revealed.png`。

## 5. 人工验收清单

- [ ] 给当前 chart 增加 `charts/chart-<worldId>.traces.json`，至少 1 个 trace；进入世界。
- [ ] START 页面出现 `SHIFT + 方向键移动框 · SHIFT + ENTER 对准`。
- [ ] 进入 playing 后 HUD 出现 R4C 面板，`TRACE 0 / N`。
- [ ] 按住 Shift + 方向键：框持续移动、clamp 到画面内，`FRAME` 显示 Tracking。
- [ ] 框覆盖 trace 中心，且在 `beatTimeMs ±100ms` 按 Shift+Enter：trace 变 Revealed，HUD `TRACE 1 / N`、`LOCK Locked`。
- [ ] 在窗口外/错拍按 Shift+Enter：trace 保持 Concealed。
- [ ] 让框离开 trace 中心：Revealed → Concealed，reason FrameLost。
  - 默认框 68%×58% 较大；建议把测试 trace 放在画面边缘，便于触发 FrameLost。
- [ ] 暂停：框/痕冻结，held 清空；恢复后继续。
- [ ] 失焦/切后台：框停止，不残留按键。
- [ ] 退出/结算：R4c 覆盖层消失，R4a 分数/判定不受影响。
- [ ] 无 traces sidecar 的谱面：无 R4c HUD/提示；Shift+方向/Enter 仍走 R4a 原路径。
- [ ] 有 `triggers.json` 时，HUD `TRIGGER` 显示最近 Enter/Exit/Dwell/Occupancy/Parallax。
- [ ] 回归：R4a 6 note 全连仍为 `PERFECT 6 / 010260`，R4b NEU 仍正常。

## 6. 已知边界

- 默认 demo 没有 traces/triggers sidecar；需手工新增才能看到 R4c 视觉。
- 默认视差框较大，中心痕很难 FrameLost；验收用边缘痕。
- 触发器只写 HUD，不写账本/NEU。
- 没有编辑器 UI；sidecar 手写。
- 只有有 TraceRuntime 的谱面才启用 Shift 组合键；否则 R4a L3+ 任意键完全保留。
