# R2 AC 覆盖表

- 日期：2026-10-19（Asia/Shanghai）
- 状态：8 / 8 PASS

| AC | 实现位置 | 验证方式 | 证据路径 | 状态 |
|---|---|---|---|---|
| AC4-01 单机无账号 | `v4/core/studio/types.ts`：`StudioProfile.instance` / `displayName` / `interfaceLanguage` / `defaultExportDirectory` | `v4/tests/ac4-01-studio-profile.test.ts`：StudioProfile 是单例且默认值固定；core 与 namebook 工具无 Account/Login/Auth，无网络 API | `quality-review/stage-4/r2/tests/ac4-01-studio-profile.log` | PASS |
| AC4-02 项目目录布局 | `v4/core/studio/ProjectStore.ts`：`ProjectStore.create` / `open`；`v4/adapters/node/NodeProjectIo.ts`：`ensureLayout` / read/write JSON | `v4/tests/ac4-02-project-layout.test.ts`：create 写入 project/event-tree 与三个目录，open 可读回 | `quality-review/stage-4/r2/tests/ac4-02-project-layout.log` | PASS |
| AC4-03 JSON 原子写 + .bak | `v4/adapters/node/AtomicJsonFile.ts`：`writeJson` / `readJson` / `exists`；四个崩溃钩子 | `v4/tests/ac4-03-atomic-json.test.ts`：首次写入不生成 .bak；四种崩溃情形 | `quality-review/stage-4/r2/tests/ac4-03-atomic-json.log` | PASS |
| AC4-11 账本 append-only | `v4/core/ledger/store.ts`：`LedgerStore` / `appendNarrativeEvent` / `LedgerReader`；`v4/adapters/node/NdjsonLedgerFile.ts` | `v4/tests/ac4-11-ledger-append-only.test.ts`：连续追加、单写者、head 更新与 .bak 保留 | `quality-review/stage-4/r2/tests/ac4-11-ledger-append-only.log` | PASS |
| AC4-12 账本损坏诊断 | `v4/core/ledger/store.ts`：`LedgerReader.readAll` | `v4/tests/ac4-12-ledger-corruption.test.ts`：head/末行/checksum 三种篡改均只读拒绝，不截断不重建 | `quality-review/stage-4/r2/tests/ac4-12-ledger-corruption.log` | PASS |
| AC4-13 20 维向量 | `v4/core/ledger/vector.ts`：`validateNarrativeVector` / `deriveLedgerPosition` / `classifyDivergenceAxis` / `deriveRouteSignature` | `v4/tests/ac4-13-narrative-vector.test.ts`：4 个测试（校验 / 位置 / 分类 / 路线） | `quality-review/stage-4/r2/tests/ac4-13-narrative-vector.log` | PASS |
| AC4-27 逻辑层零引擎 | `tools/check-zero-engine-v4.cjs`：扫描 `v4/core` 的禁止 import 与全局标识符 | `v4/tests/ac4-27-zero-engine.test.ts`：真实运行 check-zero-engine，exit 0 | `quality-review/stage-4/r2/tests/ac4-27-zero-engine.log`；`quality-review/stage-4/r2/gates/check-zero-engine.log` | PASS |
| AC4-40 层分值 | `v4/core/chart/layer.ts`：`ChartLayerScoring.scoreFor` | `v4/tests/ac4-40-chart-layer-scoring.test.ts`：默认 base=800 等比递减 + 自定义 base / 异常参数 | `quality-review/stage-4/r2/tests/ac4-40-chart-layer-scoring.log` | PASS |

汇总：AC4-01 / 02 / 03 / 11 / 12 / 13 / 27 / 40 全部 PASS；测试 14 / 14。