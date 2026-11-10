# R5b.2-patch · CLOCK 阈值调整

时间：2026-10-26（Asia/Shanghai）
范围：只调整 `ClockDriftMonitor` 的 Warning 阈值；不改判定逻辑、不改 reanchor 逻辑、不改 HUD 样式、不加抗抖。

## 1. 依据

用户真实声卡数据：

| 环境 | 样本 | 观测 |
|---|---|---|
| 有线 | 143 | 固定约 **−29ms** 偏差，无抖动 |
| 蓝牙 | 143 | 1 次 Critical **118ms** 后 reanchor；后续全部 **±0.15ms** |

结论：

- 当前单次 reanchor 机制已足够，**不做连续 N 次抗抖**。
- 有线固定 −29ms 会持续触发旧 25ms Warning，造成无意义 HUD 闪烁；需要把 Warning 起点上移。

## 2. 裁定

| 阈值 | 旧值 | 新值 | 说明 |
|---|---:|---:|---|
| Warning 起点 | 25ms | **40ms** | `abs(drift) >= 40` 才 Warning |
| Reanchor | 50ms | **50ms（不变）** | `abs(drift) > 50` |
| Critical | 100ms | **100ms（不变）** | `abs(drift) > 100` |

边界语义保持不变：

- `39ms` → Stable
- `40ms` → Warning
- `50ms` → Warning
- `51ms` → Reanchor
- `100ms` → Reanchor
- `101ms` → Critical

## 3. 代码改动

只改 `v4/app/src/game/clockDrift.ts`：

- 注释：`25ms 预警` → `40ms 预警`；
- `classify` 的 Warning 分支：`absolute >= 25` → `absolute >= 40`。

未改：

- 判定 / `shouldReanchor` / `reanchor`
- Critical / 输入暂停
- HUD class / message
- `GameScreen` 采样或触发顺序
- CLOCK DEBUG 格式

## 4. 测试更新

- `v4/tests/r4f/clock-drift.test.ts`
  - 边界改为 `0/10/−29/39/40/49/50/51/100ms`；
  - 明确 `−29ms`（有线固定偏差）为 **Stable**；
  - 明确 `40ms` / `−40ms` 为 **Warning**；
  - `51ms` Reanchor、`101ms` Critical 保持。
- `v4/tests/r4f/hud-drift-integration.test.ts`
  - Warning 用例从 `30ms` 改为 `40ms`。
- `v4/tests/r5a/reanchor.test.ts`
  - 分类用例从 `30ms` 改为 `40ms`。
- `v4/tests/r5a/hud-clear-after-reanchor.test.ts`
  - Warning 起点样本从 `30ms` 改为 `40ms`。

结果：

| 命令 | 结果 |
|---|---|
| `npm run typecheck:v4` | exit 0 |
| `npm run test:v4` | **408 / 408 pass** |
| `npm run check:v4` | totalErrors=0，allPassed=true |

## 5. 实机验证

运行 `v4/app/tests/e2e/r5b2-patch-clock.e2e.mjs`（Tauri + 真实 demo 项目）：

- 实际输出最后一个样本：`driftMs = −29.765`；
- CLOCK DEBUG：`capacity=600`、`count=6`；
- 状态：**Stable**；
- HUD：`.game-hud__clock` **未渲染**（`hudText=null`、`hudVisible=false`）；
- 音频：`AUDIO / WEB`。

证据：

- `quality-review/stage-5/r5b2-patch/evidence/r5b2-patch-clock-e2e.json`
- `quality-review/stage-5/r5b2-patch/evidence/r5b2-patch-clock-wired.png`

> 说明：本次 Tauri 复验的实际输出偏差与用户有线数据一致（约 −29ms）；物理声卡听感复验仍以用户有线环境为准，本次不再重复采集蓝牙矩阵。

## 6. 一句话状态

**R5b.2-patch 完成：Warning 25ms → 40ms，Reanchor 50ms / Critical 100ms 不变；−29ms 有线固定偏差已不再触发 HUD Warning，408 单测与 Tauri 阈值复验通过。**
