# R2 测试报告

- 日期：2026-10-19（Asia/Shanghai）
- 范围：AC4-01 / 02 / 03 / 11 / 12 / 13 / 27 / 40
- 结论：14 / 14 测试通过；四门禁 0 ERROR / 0 WARN；legacy 无回退

## 1. 环境

| 项 | 值 |
|---|---|
| Node | v24.19.0 |
| TypeScript | 5.5.4（`node_modules/typescript/package.json`） |
| OS | Windows 11（NT 10.0.26200.0） |
| 测试框架 | `node:test` + `node:assert/strict` |

## 2. 命令与结果

| 命令 | exit | 输出摘要 |
|---|---:|---|
| `npm run typecheck:v4` | 0 | `tsc -p v4/tsconfig.json`，0 诊断 |
| `npm run test:v4` | 0 | `tests 14` / `suites 8` / `pass 14` / `fail 0` |
| `npm run check:v4` | 0 | 四门禁均 exit 0 / ERROR 0 / WARN 0；`totalErrors=0`，`allPassed=true` |
| `npm run verify`（legacy） | 0 | check-naming 0 ERROR / 45 既有 WARN；tsc 0 诊断 |
| `npm run check:dependencies`（legacy） | 0 | 132 个 .ts / 约 448 条依赖子句；0 ERROR |

> `npm run verify:v4` 为上述三个 R2 子命令的组合，由用户在 R2 完成包落盘后执行；本报告不重复声明其结果。

## 3. 逐 AC 测试结果

| AC | 测试文件 | 测试数 | 通过 / 总数 |
|---|---|---:|---:|
| AC4-01 | `v4/tests/ac4-01-studio-profile.test.ts` | 2 | 2 / 2 |
| AC4-02 | `v4/tests/ac4-02-project-layout.test.ts` | 1 | 1 / 1 |
| AC4-03 | `v4/tests/ac4-03-atomic-json.test.ts` | 2 | 2 / 2 |
| AC4-11 | `v4/tests/ac4-11-ledger-append-only.test.ts` | 1 | 1 / 1 |
| AC4-12 | `v4/tests/ac4-12-ledger-corruption.test.ts` | 1 | 1 / 1 |
| AC4-13 | `v4/tests/ac4-13-narrative-vector.test.ts` | 4 | 4 / 4 |
| AC4-27 | `v4/tests/ac4-27-zero-engine.test.ts` | 1 | 1 / 1 |
| AC4-40 | `v4/tests/ac4-40-chart-layer-scoring.test.ts` | 2 | 2 / 2 |
| **合计** | 8 个测试文件 | **14** | **14 / 14** |

测试文件名对应日志：`quality-review/stage-4/r2/tests/<测试文件基名>.log`。

## 4. 失败明细

无失败。`npm run test:v4` 的 `fail 0`、`cancelled 0`、`skipped 0`。

## 5. 证据

- AC 测试日志：`quality-review/stage-4/r2/tests/`
- 门禁日志：`quality-review/stage-4/r2/gates/check-naming.log`、`check-dependencies.log`、`check-zero-engine.log`、`check-ledger-single-writer.log`
- 门禁汇总：`quality-review/stage-4/r2/gates/gates-results.json`
- AC 索引：`quality-review/stage-4/r2/ac-coverage.md`
- 完成说明：`quality-review/stage-4/r2/R2-completion.md`