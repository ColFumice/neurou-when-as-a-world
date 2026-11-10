# P3 补冻门禁与保护证据

本轮只新增文档和证据；没有 Relay、ContractAdapter、运行时数据契约或任何现有源码修改。

| 现有门禁 | 结果 | exit | ERROR | WARN | 与 B2.5b final / P3 baseline 原始输出 |
|---|---|---:|---|---|---|
| `check-naming` | PASS | 0 | 0 | 22 | 逐字相同 |
| `check-dependencies` | PASS | 0 | 0 | 未报告 WARN | 逐字相同 |
| `typecheck` | PASS | 0 | 无诊断 | 未报告 WARN | 逐字相同 |

P3 基线：`2026-10-11T03:22:00.381Z`。最终比较：`2026-10-11T03:57:05.029Z`。受保护 `7042` 项（包含 2 个 Junction 目标文本），最终 `7042` 项；修改/删除/范围外新增为 `2/0/0`，原始保护结果 **FAIL**。其中旧 quality-review 文件 `6622` 项、server 包 `19` 项。

用户已确认 `docs/NAMEBOOK.md`、`docs/spec/stage-1.md` 两项改动由 Trae 授权同步 B2.5b/v3.16，来源归因 **闭合**。这是归因闭合，**rawHashEquality=false、原始保护仍 FAIL**；原基线、[首次 FAIL](first-protection-failure/protected-comparison.json) 保留，不回写为 PASS、不重新捕获基线。除这两项确认外部改动，范围内无其他修改/删除/新增。[归因 closure](source-attribution-closure.json)。

现有命名 WARN 共 22 条：4 条 R7（Window 语义复核）、18 条 R4（Trace 语义复核）。与 B2.5b final 比较新增/消失 WARN 均为 0；历史 raw FAIL 不回写。

证据：[baseline 三门禁](baseline-gates/results.json)、[final 三门禁](final-gates/results.json)、[SHA 基线](protected-baseline.json)、[SHA 保护结果](protected-comparison.json)、[机器摘要](evidence-summary.json)。每份原始 `.log` 保留在相应门禁目录。

保护排除规则与 Junction 处理详见 SHA 基线；排除本轮目录、依赖、缓存/编译产物、`.local` 等私密本机状态、密钥及 PostgreSQL 运行二进制，不读取私密材料。门禁只验证既有源码健康，不能代替 P3 文档语义审查、未来契约实现测试或真实 Relay 验收。

复现：在项目根运行 `node quality-review/b2-shared-contract-freeze/evidence/run-gates.cjs final`，再运行 `node quality-review/b2-shared-contract-freeze/evidence/protect-files.cjs compare`、`node quality-review/b2-shared-contract-freeze/evidence/summarize-evidence.cjs`；不得重建本轮已捕获基线。
