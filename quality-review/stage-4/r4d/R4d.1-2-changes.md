# R4d.1 + R4d.2 变更说明 · 20 维推导与首演账本

日期：2026-10-25

范围：仅 core 层逻辑与单测；**未接 GameScreen / UI**。

## 1. 新增文件

### `v4/core/chart/ChartPremiere.ts`

复用 NAMEBOOK 已有 A 类名 `ChartPremiere`，承载一次首演的完整数据快照：

- `chartId` / `source` / `completed`
- `totalNotes` / `perfect` / `good` / `miss` / `maxCombo`
- Trace：`tracesTotal` / `tracesRevealed` / `tracesTouched` / `deepRevealed` / `anomalousRevealed` / `rainRevealed` / `frameLost`
- NEU：`neuAudioModules` / `neuEffectModules` / `neuLightModules` / `neuResourceModules` / `neuSubtitleModules`
- Trigger：`triggerEnter` / `triggerExit` / `triggerDwell` / `triggerOccupancy` / `triggerParallax`

校验：

- 计数为非负安全整数；
- `perfect + good + miss <= totalNotes`；
- `completed=true` 时所有 note 必须已决；
- `maxCombo <= perfect + good`；
- trace 子计数不超过总数，`tracesTouched <= tracesRevealed`；
- `source` 只允许 `editor / v2 / fallback`。

### `v4/core/director/ChartPremiereDirector.ts`

新增 A 类名 `ChartPremiereDirector`。

- `static deriveVector(premiere): NarrativeDimension`
  - 严格按照已批准的 R4d v1 权重表；
  - 输出 0..100 整数；
  - 显式检查 0..100，再调用 `validateNarrativeVector`；
  - 不读文件、不依赖时钟。
- `recordPremiere(premiere, nowMs): Promise<LedgerCheckpoint | null>`
  - 构造器注入 `LedgerStore` / `LedgerReader`；
  - 拒绝未完成、fallback、判定未收束；
  - `reader.readAll()` 损坏时返回 null，不抛异常；
  - 已有同 `chartRef` / 同 `eventId` 时跳过；
  - 首次完整构造并 `appendNarrativeEvent`；
  - `eventId = premiere:<chartId>`；
  - `chartRef = chartId`；
  - `appendedAt.epochMs = nowMs`；
  - 返回 `LedgerCheckpoint`；跳过/失败返回 `null`；
  - `lastDiagnostic` 暴露最近拒绝原因，供 R4d.3 HUD 使用；
  - 内部 Promise queue 串行化，避免并发重复首演；
  - **不重试** append，避免 head/line 崩溃窗口产生重复行。

## 2. NAMEBOOK / 门禁

- `docs/NAMEBOOK-v4.0.md`
  - §1 A 类：317 → 318；
  - §1.17 director：5 → 6；
  - 新增 `ChartPremiereDirector`；
  - §7.1 director 6、合计 318；
  - 版本记录新增 v4.3。
- `tools/lib/namebook-v4.cjs`
  - `TOTAL_A = 318`。
- `package.json`
  - `test:v4` 增加 `v4/.dist/tests/r4d/*.test.js`。

`check-naming` / `check-dependencies` / `check-zero-engine` / `check-ledger-single-writer` 全部 0 ERROR。

## 3. 推导规则

采用已批准的 R4d v1：

- 输入归一化：Perfect/Good/Miss 比例、maxCombo 比例、Trace 比例、NEU 去重模块比例、Trigger 去重信号种类比例、完成标志。
- 不做 `score` 二次计数。
- 每维 `0..100` 整数；`VectorSchemaVersion = 1`。
- 具体 20 维公式与 R4d 计划 §1.4 一致。

关键语义：

- Trace Revealed 只计唯一 trace；Touched 不计次数；
- Deep / Anomalous / Rain / FrameLost 按唯一 trace 计入；
- NEU 按 `moduleId` 去重；
- Trigger 按 5 类信号是否出现去重；
- 完整完成提供 `Initial` / `NarrativeTime` 加成。

## 4. 自跑结果

```text
npm run test:v4
  tests 262
  suites 57
  pass 262
  fail 0
  新增 R4d 11 项
  R4a/R4b/R4c 251 项零退化

npm run check:v4
  totalErrors=0 allPassed=true
```

新增测试：

- `v4/tests/r4d/narrative-derivation.test.ts`（8）
  - 全 Perfect 固定向量；
  - 全 Miss；
  - 混合判定；
  - 空 trace/NEU/trigger；
  - Trace 六项；
  - NEU 五类；
  - Trigger；
  - 全部样例 0..100 / finite / validate。
- `v4/tests/r4d/premiere-director.test.ts`（3）
  - 完整 +1、重复 0、重开仍不重复；
  - fallback / 未完成 0；
  - 账本损坏：拒绝、不抛、文件不变。

证据：

- `quality-review/stage-4/r4d/r4d1-2-test-run.log`
- `quality-review/stage-4/r4d/r4d1-2-baseline-251.log`（251/251 R4a~R4c 基线）
- `quality-review/stage-4/r4d/r4d1-2-gates.log`

## 5. 本批未做

- 未修改 `GameScreen.tsx`；
- 未接 `TraceEventSink` / `GamePlaybackSink` / `TriggerRuntime`；
- 未做 `projectRoot` 注入；
- 未写真实项目 `worlds/<worldId>/ledger.*`；
- 未做 R4d.3 的 UI / HUD 接线。

这些留给 R4d.3。

## 6. R4d.3 前置提醒

- `ChartPremiere.source` 必须由 `LoadedGameChart.source` 映射；fallback 不写；
- `recordPremiere` 的 skip 原因通过 `lastDiagnostic` 交给 HUD；
- `recordPremiere` 是异步，GameScreen 的 finish 需要 `finishingRef`；
- 账本路径在 `worlds/<worldId>/ledger.ndjson`，由 app/adapters 注入；
- 先读 `LedgerReader.readAll()`，损坏时不要尝试修复。
