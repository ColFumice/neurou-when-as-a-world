# AC4-24 · 漂移检测报告（R4f-patch）

日期：2026-10-25  
状态：**PASS（HUD 接入 + 阈值/输入暂停）；Downbeat = R5 GAP；re-anchor 为监视器基准重置，未改 audioClock。**

## 实现

- 位置：`v4/app/src/game/clockDrift.ts`（原 R4f 诊断模型在此）。
- GameScreen 每 30 帧（约 0.5s）调用一次 `driftMonitor.sample(now, performance.now())`。
- HUD 接入 `GameHud`：
  - `<25ms`：无显示。
  - `25..50ms`：`CLOCK DRIFT WARNING`（`.is-warning`，黄色）。
  - `>50ms`：`CLOCK DRIFT`（`.is-error`，红色），monitor 重置自身基准（一次 re-anchor）。
  - `>100ms`：`AUDIO OFFLINE`（`.is-critical`），`inputPausedRef=true`，`submitStrike` 与 pointer strike 直接暂停。
- **不修改**：`audioClock.ts` / `AudioOutputClock` / `ChartSnapshot` playhead / judge.ts。
- 由于 `audioClock.ts` 是冻结的 R4a 逻辑，re-anchor 只重置**监视器基准**，不改音频时钟内部；HUD/判定不被 playhead 重置影响。

## 测试

`v4/tests/r4f/hud-drift-integration.test.ts`（4）：

- 30ms → Warning class / `CLOCK DRIFT WARNING`，不 reanchor。
- 60ms → error class / `CLOCK DRIFT`，`reanchored=true`，不改 playhead。
- 120ms → `AUDIO OFFLINE`，`inputPaused=true`，action Suspend。
- Stable 不显示；reset 清 inputPaused。

`v4/tests/r4f/clock-drift.test.ts`（5）：

- 180 秒输出样本；0/10/25/49/50/51/100ms；monotonic；pause/resume/seek；Downbeat GAP。

结果：9/9 pass。

## 实机

- 通过临时 `window.__R4F_DRIFT_OVERRIDE__`（已在代码中记录为测试 seam）注入 drift。
- 实机 Warning 截图：`quality-review/stage-4/r4f/evidence/hud-drift-warning.png`
- 实机 Critical 截图：`quality-review/stage-4/r4f/evidence/hud-drift-critical.png`（`is-critical` / AUDIO OFFLINE）
- 实机截图确认 HUD class 与文本；60ms error 由单元测试覆盖。

## 残留

- Downbeat：当前无 beat 数据/提取，按批准记为 **R5 GAP**。
- 真实声卡/蓝牙切换未测试。
- re-anchor 不修改已经冻结的 AudioOutputClock 内部；仅监视器基准重锚。

## 结论行

AC4-24：**漂移 HUD/阈值/输入暂停 PASS；Downbeat GAP R5；re-anchor monitor-only。**
