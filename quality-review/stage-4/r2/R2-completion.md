# R2 完成说明

- 阶段：R2（P0 ~ P8）
- 日期：2026-10-19（Asia/Shanghai）
- 状态：待 PROTOCOL 审阅
- 依据：R1 冻结基线（docs/NAMEBOOK-v4.0.md、docs/spec/stage-4.md、docs/refactor-r1/verdicts-refactor-r1.md）

## 1. R2 范围与出口

- 范围：K/L/T/W/M/C/H + 存储端口 + 层分值 + 新门禁（stage-4 §12 R2）。
- 出口 AC：AC4-01 / 02 / 03 / 11 / 12 / 13 / 27 / 40。
- 实际落地 A 类：**84 / 271**。
  - K 4 + L 16 + T 13 + W 24 + M 6 + C 13 + H 5 + S 3 = 84。
- 未实现 A 类：**187**（R3~R4 覆盖，详见 §6）。
- A 类计数由 `check-naming-v4` 解析 NAMEBOOK 验证为 271，已实现 84，未实现 187。

## 2. 逐条 AC 实现位置与验证方式

| AC | 实现位置 | 验证方式（测试文件 + 测试名） | 证据路径 |
|---|---|---|---|
| AC4-01 单机无账号 | `v4/core/studio/types.ts`：`StudioProfile.instance` / `displayName` / `interfaceLanguage` / `defaultExportDirectory` | `v4/tests/ac4-01-studio-profile.test.ts`：① StudioProfile 是单例且默认值固定；② core 与 namebook 工具无 Account/Login/Auth，无网络 API | `quality-review/stage-4/r2/tests/ac4-01-studio-profile.log` |
| AC4-02 项目目录布局 | `v4/core/studio/ProjectStore.ts`：`ProjectStore.create` / `ProjectStore.open`；`v4/adapters/node/NodeProjectIo.ts`：`ensureLayout` / `readProjectJson` / `writeProjectJson` / `readEventTreeJson` / `writeEventTreeJson` | `v4/tests/ac4-02-project-layout.test.ts`：create 写入 project/event-tree 与三个目录，open 可读回 | `quality-review/stage-4/r2/tests/ac4-02-project-layout.log` |
| AC4-03 JSON 原子写 + .bak | `v4/adapters/node/AtomicJsonFile.ts`：`writeJson` / `readJson` / `exists`；四个崩溃钩子 | `v4/tests/ac4-03-atomic-json.test.ts`：① 首次写入不生成 .bak；② 四种崩溃情形 | `quality-review/stage-4/r2/tests/ac4-03-atomic-json.log` |
| AC4-11 账本 append-only | `v4/core/ledger/store.ts`：`LedgerStore` / `appendNarrativeEvent` / `LedgerReader`；`v4/adapters/node/NdjsonLedgerFile.ts`：`appendLine` / `writeHead` | `v4/tests/ac4-11-ledger-append-only.test.ts`：连续追加、单写者、head 更新与 .bak 保留 | `quality-review/stage-4/r2/tests/ac4-11-ledger-append-only.log` |
| AC4-12 账本损坏诊断 | `v4/core/ledger/store.ts`：`LedgerReader.readAll` | `v4/tests/ac4-12-ledger-corruption.test.ts`：head/末行/checksum 三种篡改均只读拒绝，不截断不重建 | `quality-review/stage-4/r2/tests/ac4-12-ledger-corruption.log` |
| AC4-13 20 维向量 | `v4/core/ledger/vector.ts`：`validateNarrativeVector` / `deriveLedgerPosition` / `classifyDivergenceAxis` / `deriveRouteSignature` | `v4/tests/ac4-13-narrative-vector.test.ts`：① validateNarrativeVector 拒绝非法向量；② deriveLedgerPosition 空/单/双事件；③ classifyDivergenceAxis 六情感与全零；④ deriveRouteSignature 空/单/双事件 | `quality-review/stage-4/r2/tests/ac4-13-narrative-vector.log` |
| AC4-27 逻辑层零引擎 | `tools/check-zero-engine-v4.cjs`：扫描 `v4/core` 的禁止 import 与全局标识符 | `v4/tests/ac4-27-zero-engine.test.ts`：check-zero-engine 真实运行 exit 0；同时引用门禁日志 | `quality-review/stage-4/r2/tests/ac4-27-zero-engine.log`；`quality-review/stage-4/r2/gates/check-zero-engine.log` |
| AC4-40 层分值 | `v4/core/chart/layer.ts`：`ChartLayerScoring.scoreFor` | `v4/tests/ac4-40-chart-layer-scoring.test.ts`：① 默认 base=800 的等比递减与最低保护；② 自定义 base 与异常参数 | `quality-review/stage-4/r2/tests/ac4-40-chart-layer-scoring.log` |

## 3. 门禁结果

| 门禁 | 脚本 | 结果 | 证据 |
|---|---|---|---|
| E1 命名 | `tools/check-naming-v4.cjs` | 0 ERROR / 0 WARN；A 类 271 / 已实现 84 / 未实现 187；禁名 0；同名跨模块 0 | `quality-review/stage-4/r2/gates/check-naming.log` |
| E2 依赖 | `tools/check-dependencies-v4.cjs` | 0 ERROR / 0 WARN；扫描 18 文件 / 13 条边 | `quality-review/stage-4/r2/gates/check-dependencies.log` |
| E3 零引擎 | `tools/check-zero-engine-v4.cjs` | 0 ERROR / 0 WARN；扫描 15 个 core 文件 | `quality-review/stage-4/r2/gates/check-zero-engine.log` |
| E4 单写者 | `tools/check-ledger-single-writer-v4.cjs` | 0 ERROR / 0 WARN；扫描 18 文件 / 1 个允许调用点 | `quality-review/stage-4/r2/gates/check-ledger-single-writer.log` |

- 汇总：`totalErrors=0`，`allPassed=true`（`quality-review/stage-4/r2/gates/gates-results.json`，2026-10-19 22:52:55 +08:00）。
- E5 原子写由 AC4-03 的四情形测试覆盖；E6（端到端）、E7（外部网络）按 P-R2-07 延至 R4。

## 4. 遗留与审计记录

a. **TraceOrigin.Echo**：继承 v3.21 段③（`archive/legacy-v3.21/NAMEBOOK.md` 第 93 行：“痕 TraceOrigin 扩展为 Normal / Anomalous / Echo”），**不是 R2 新增**。
b. **ChartTier 值域**：沿用 v3.21 第 97 行（Regular / Character / World / Final 为 v3.21 已有）；R4 可调。
c. **AnomalyCause 值域**：v3.21 遗留（ForcedRollback / MergeConflict / OrphanCommit / RevertedEdit）；单机语义待 R4 重审。
d. **store.ts 死代码清理**：删除 `append()` 与 `readAll()` 中各 3 行不可达的 `head.schemaVersion !== LEDGER_SCHEMA_VERSION` 判断（`isLedgerCheckpoint` 已保证该条件）；文件 8701 → 8431 字节。
e. **GridStrike.gridCellId 用 number**：遵守 trace 不 import chart 的禁止边；1..8 语义写在注释中。
f. **WorldMap 为空标记接口**：R2 零引擎约束；R3 填入 Pixi Container。
g. **moveAlongAxes 直通实现**：时间轴边界 clamp（AC4-08）留 R4。

## 5. stage-4 §3 补遗建议

R1 冻结的 stage-4 §3 模块职责表遗漏三个 NAMEBOOK section 的模块归属：

| NAMEBOOK section | 数量 | 建议模块 |
|---|---:|---|
| §1.5 视差框 | 8 | W（world） |
| §1.6 触发器 | 10 | W（world） |
| §1.12 事件树 | 5 | G（eventgraph） |

R2 期间门禁临时映射：`tools/lib/namebook-v4.cjs` 的 `SECTION_MODULES` 已标注 `provisional: true`。R2 未修改 stage-4。请 PROTOCOL 决定出 `stage-4.v1.1`（补一行）或追加裁定书 `V-R2-001`。

## 6. 未实现 A 类清单（按模块）

| 模块 / section | 未实现 |
|---|---:|
| K constants | 0 |
| L ledger | 3（RecallCount / Recall / Replay，留 R4） |
| T trace | 0 |
| W world（§1.4） | 0 |
| M timeline | 0 |
| C chart + 8 格（§1.8 / §1.9） | 25（首演 / 魔王曲 / Logo / 动态网格 / Hold 等，留 R4） |
| H character | 0 |
| S studio | 0 |
| §1.5 视差框（临时映射 W） | 8 |
| §1.6 触发器（临时映射 W） | 10 |
| D media | 8 |
| G eventgraph + 事件树（§1.11 / §1.12） | 24（含事件树 5） |
| A AI | 22 |
| E editor | 26 |
| U musicEditor | 22 |
| R director | 5 |
| P presentation | 32 |
| X app/adapters | 2 |
| **合计** | **187** |

## 7. R2 源码清单

字节数为落盘后实测（不含 `v4/.dist`、`node_modules`）。

| 路径 | 字节 |
|---|---:|
| `.gitignore` | 513 |
| `package.json` | 1028 |
| `tools/check-all-v4.cjs` | 2418 |
| `tools/check-dependencies-v4.cjs` | 5501 |
| `tools/check-ledger-single-writer-v4.cjs` | 3116 |
| `tools/check-naming-v4.cjs` | 7996 |
| `tools/check-zero-engine-v4.cjs` | 4181 |
| `tools/lib/module-map-v4.cjs` | 3950 |
| `tools/lib/namebook-v4.cjs` | 4873 |
| `v4/adapters/node/AtomicJsonFile.ts` | 2444 |
| `v4/adapters/node/NdjsonLedgerFile.ts` | 1775 |
| `v4/adapters/node/NodeProjectIo.ts` | 1822 |
| `v4/core/character/types.ts` | 859 |
| `v4/core/chart/layer.ts` | 1428 |
| `v4/core/chart/types.ts` | 1406 |
| `v4/core/constants/index.ts` | 472 |
| `v4/core/ledger/store.ts` | 8431 |
| `v4/core/ledger/types.ts` | 2087 |
| `v4/core/ledger/vector.ts` | 3022 |
| `v4/core/studio/ProjectStore.ts` | 2965 |
| `v4/core/studio/types.ts` | 769 |
| `v4/core/timeline/types.ts` | 1228 |
| `v4/core/trace/strike.ts` | 559 |
| `v4/core/trace/types.ts` | 1741 |
| `v4/core/trace/visibility.ts` | 515 |
| `v4/core/world/movement.ts` | 934 |
| `v4/core/world/types.ts` | 3241 |
| `v4/tests/ac4-01-studio-profile.test.ts` | 1769 |
| `v4/tests/ac4-02-project-layout.test.ts` | 1601 |
| `v4/tests/ac4-03-atomic-json.test.ts` | 2452 |
| `v4/tests/ac4-11-ledger-append-only.test.ts` | 2559 |
| `v4/tests/ac4-12-ledger-corruption.test.ts` | 3479 |
| `v4/tests/ac4-13-narrative-vector.test.ts` | 3117 |
| `v4/tests/ac4-27-zero-engine.test.ts` | 652 |
| `v4/tests/ac4-40-chart-layer-scoring.test.ts` | 983 |
| `v4/tests/helpers/temp-dir.ts` | 361 |
| `v4/tsconfig.json` | 537 |
| `v4/tsconfig.test.json` | 343 |

文件分组：`v4/core` 15 + `v4/adapters/node` 3 + `v4/tests` 9 + `tools` 5 + `tools/lib` 2 + 2 个 tsconfig + `package.json` + `.gitignore`。

## 8. R3 入口建议

1. 进入 R3 的第一件事：接 Tauri 2 + React 19 外壳（`v4/app/`）。
2. 先做 `v4/app/` 最小骨架（Tauri command + React shell），再逐步接 studio / console / editor。
3. 若 stage-4 §3 补遗在 R2 冻结时未解决，R3 开始时必须先解决，否则门禁继续使用 provisional 映射。

R2 完成包 = 全部代码/测试/门禁落盘 + 三份文档（R2-completion / ac-coverage / test-report）；等待 PROTOCOL 审阅；审阅通过后 R2 冻结，进入 R3。