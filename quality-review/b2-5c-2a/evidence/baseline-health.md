# B2.5c-2a 冻结轮基线健康证据

本轮只检查既有基线，未修改生产代码、三门禁脚本或命名白名单。下列三条既有门禁各执行一次；本轮未重跑 c-1 隔离测试、未启动服务器，也不把历史 154/154 测试当作本轮网络验收。

| 既有门禁 | 命令 | 结果 | 原始日志 |
| --- | --- | --- | --- |
| 命名 | `node scripts/check-naming.js` | PASS，0 ERROR / 45 WARN | [check-naming.log](baseline-gates/check-naming.log) |
| 依赖 | `node scripts/check-dependencies.js` | PASS，0 ERROR；扫描 127 个 TS 文件、437 条静态依赖 | [check-dependencies.log](baseline-gates/check-dependencies.log) |
| 类型 | `node node_modules/typescript/bin/tsc --noEmit` | PASS，exit 0 | [typecheck.log](baseline-gates/typecheck.log) |

执行区间：2026-10-11 14:27:48～14:27:50（Asia/Shanghai）。机器记录保留 UTC。详见 [results.json](baseline-gates/results.json)。

命名 WARN 与 c-1 最终门禁逐条比对：新增 0、移除 0、总数差 0；保留旧告警，不放宽白名单。既有 c-1 对痕域语义的人工复核仍在原交付证据中。

保护基线于 2026-10-11 14:27:23（Asia/Shanghai）捕获，共 7154 个非排除旧文件，SHA-256 为 `f01d9bebb8dcf2efcc3ee250f70f795787da1121cf113691e5576000465526bc`。本轮没有生产文件变动授权；保护 c-1 五份纯逻辑源码、IntentPort、旧交付及证据、server、docs、名库与参照。仅本轮新增目录及已列明依赖/cache/秘密/二进制范围排除，详见 [protected-baseline.json](protected-baseline.json) 与 [protect-files.cjs](protect-files.cjs)。

基线时 `docs/NAMEBOOK.md` 与 `docs/spec/stage-1.md` 已包含 v3.18/c-1 同步内容；对应字节摘要和五份 c-1 源文件摘要在 [initial-state.json](initial-state.json)。该记录是现存字节观察，不替未来外部改动预先归因。历史 P3/c-1 raw SHA FAIL 保持原样。

核心冻结文书完成后，于 2026-10-11 14:51:35（Asia/Shanghai）执行独立 SHA 比对：**PASS，7154 → 7154；changed / removed / added 均为空**。最终不可变原始结果在 [protected-comparison.json](protected-comparison.json)，机器汇总在 [evidence-summary.json](evidence-summary.json)。没有外部保护变化，也未重置基线；此前历史 FAIL 未改写。
