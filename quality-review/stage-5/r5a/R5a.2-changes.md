# R5a.2 变更说明 · AudioOutputClock re-anchor

日期：2026-10-25  
状态：**R5a.2 完成，可进入 R5a.3**。

## 1. AudioOutputClock.reanchor 实现

文件：`v4/core/chart/clock.ts`

```ts
reanchor(): number
```

语义：

- 运行中取当前 `nowMs()`；
- 用当前 `sampleOutputSeconds()` 重设 `_anchorChartMs` / `_anchorOutputSeconds`；
- `_lastMs = current`，保持 playhead 连续；
- 清除 `_waitingForAnchor`；
- 不 seek、不改 duration、不调用 ChartSnapshot；
- 未运行时返回 `_lastMs`，不抛错。

核心行为：

```text
before reanchor: playhead = P
reanchor()     : return P
after reanchor : playhead = P（下一次输出推进后 P + delta）
```

## 2. WebAudioOutputClock / GameClock 窄口

文件：`v4/app/src/game/audioClock.ts`

- `GameClock.reanchor?(): void` 可选窄口。
- `WebAudioOutputClock.reanchor()`：
  - disposed / 未 started / clock 未 running → 直接返回；
  - 委托内部 `AudioOutputClock.reanchor()`；
  - 异常 catch 静默，不阻塞帧循环。
- `PerformanceOutputClock.reanchor()` 同样静默委托。
- `WebAudioOutputClock` 沿用现有 `readOutputSeconds()`（getOutputTimestamp 优先，currentTime fallback）。

## 3. ClockDriftMonitor 触发 / 2s 限频

文件：`v4/app/src/game/GameScreen.tsx`

每 30 帧：

1. `driftMonitor.sample(now, sampleWall)`。
2. `shouldReanchor` 且 `canReanchor(sampleWall, lastReanchorWallRef)`：
   - 调 `clock.reanchor?.()`；
   - 记录 `lastReanchorWallRef = sampleWall`；
   - 调试计数 `__R4F_REANCHOR_COUNT__`（测试 seam）；
   - 2s 内不重复。
3. `>50ms` 非 critical：设置一帧 `CLOCK DRIFT`，下一 `requestAnimationFrame` 清 HUD。
4. `>100ms`：
   - 仍只校时；
   - 保持 `AUDIO OFFLINE` HUD（不自动清）；
   - `inputPausedRef=true`，`submitStrike` / pointer strike 暂停。

`canReanchor` / `REANCHOR_COOLDOWN_MS` 在 `audioClock.ts`（X 层），不新增 A 名。

## 4. HUD 清除策略

- 清除不是等下一次 30 帧采样，而是下一帧 `requestAnimationFrame`。
- 保留一帧 `CLOCK DRIFT` 可见状态，随后 class 移除。
- critical 不清除，保留 `AUDIO OFFLINE`。
- pause / resume / finish / exit / start 时 `clearDriftHud()` 取消待执行 rAF 并清空 critical。

## 5. 测试

`v4/tests/r5a/reanchor.test.ts`（5）：

- fake 0/30/60/120ms → Stable/Warning/Reanchor/Critical；
- reanchor 后 playhead 连续，无跳变；
- ChartSnapshot counts/pending/revision 不变；
- pause/resume/seek 不回归；
- 2s 窗口只允许 2 次（0ms、2000ms）。

`v4/tests/r5a/hud-clear-after-reanchor.test.ts`（3）：

- warning → reanchor → HUD 立即（模型层）null；
- critical → AUDIO OFFLINE + inputPaused；
- 2s 内第二次 reanchor 被抑制。

R5a.2 新增：**8 tests**。  
R5a 总：**22 tests**。全仓：**396 / 396**。

R4f 主 E2E 回归：Perfect 6/6、ledger 1、重开不重复、treeVisible、restored=true。

## 6. 自跑

```text
npm run typecheck:v4   exit 0
npm run test:v4        396 / 396 pass，85 suites
npm run check:v4       4 gates 0 ERROR / allPassed=true
v4/app typecheck       exit 0
v4/app build           890 modules / built in 2.69s
cargo test             31 / 31
```

日志：`quality-review/stage-5/r5a/`
（`test-v4.log`、`gates.log`、`typecheck-v4.log`、`app-typecheck.log`、`app-build.log`、`cargo-test.log`）。

## 7. 实机验收

使用 seam：

```js
window.__R4F_CLOCK_DRIFT_ONCE_MS__ = 60;
```

注入到 `WebAudioOutputClock.readOutputSeconds()` 一次；随后 GameScreen 自动 reanchor。

实测（`reanchor-live.json`）：

```text
reanchorCount = 1
HUD log:
  19295ms  game-hud__clock is-error  CLOCK DRIFT
  19312ms  （空）
finalHud = null
```

- HUD 红色 `CLOCK DRIFT` 出现约 1 帧；
- 自动 reanchor 一次；
- 下一帧清除；
- 第二次 1s 内注入被 2s gate 抑制，count 仍为 1。
- 截图：`reanchor-clear.png`（清除后正常 HUD）。

R4f 主 E2E 回归：`quality-review/stage-4/r4f/evidence/e2e-run.json`，最终 `restored=true`。

判定：探针中 `miss=1` 来自未输入，不是 reanchor；单测单独断言 counts/pending/revision 不变。

## 8. 限制

- 真实 WebAudio 调用未单测；用 fake output / 单元测试覆盖映射。
- HUD 红色只保留一帧，截图主要记录清除后状态；错误 class 由 MutationObserver 日志证明。
- 2s 限频为 wall time；极端卡顿帧可能延迟触发，不会提前。
- `reanchor` 失败静默（wrapper catch），不会崩溃。
- 未接 beats.json / Downbeat HUD / UI（R5a.3）。

## 9. 一行状态

**R5a.2 完成，可进入 R5a.3。**
