# B2.5c-1 门禁、保护与代码差异证据

| 既有门禁 | 结果 | exit | ERROR | WARN | WARN 新增 / 消失 |
|---|---|---:|---|---|---|
| `check-naming` | PASS | 0 | 0 | 45 | 23 / 0 |
| `check-dependencies` | PASS | 0 | 0 | 未报告 | 0 / 0 |
| `typecheck` | PASS | 0 | 无诊断 | 未报告 | 0 / 0 |

原有三条门禁脚本、规则和白名单未改。原始输出与 SHA、逐条 WARN 差异保留在 [baseline](baseline-gates/results.json)、[final](final-gates/results.json) 和 [机器摘要](evidence-summary.json)。baseline 命名 WARN 为 22 条；新增 WARN 须单列语义复核，不可把启发式告警当新增契约失败，也不可写成零增量。

保护基线 `2026-10-11T04:05:40.542Z`，最终比较 `2026-10-11T04:51:23.968Z`：7070→7075 项。原范围修改 3、新增 5、删除 0；未授权修改/新增 2/0，保护 **FAIL**。

本次 raw **FAIL** 保留，`rawHashEquality=false`。[独立来源闭合](source-attribution-closure.md) 按用户本次“确认：Trae 授权同步 v3.17/P3”逐路径/逐 hash 归因两项 docs 修改；`reviewedClosurePass=true`、`attributionPending=false`，其余保护范围无异常。这不是 docs 未变或 raw PASS。

IntentPort 原始 `47617` 字节前缀保全：`true`；type-only 纯追加：`true`；尾部新增 `1425` 字节。旧 P3、B2.5b、docs/名库/参照、archive/core/server 文件均在保护范围，排除依赖、缓存/编译产物、私密本机状态/密钥与运行二进制；本轮不覆盖写入既有交付。

[保护基线](protected-baseline.json)、[保护比较](protected-comparison.json)、[修改文件与 SHA](changed-files.json)、[完整代码 diff](code.diff)。代码差异仅含准许的五个新增 director 文件以及 IntentPort type-only 导出尾部。

最终 [隔离契约测试](test-runs/final-verified/results.json) **154/154 PASS**：validator 47、codec 76、replay 31，零 skip/cancel/todo。严格隔离编译只使用 ES2020，`types=[]`，零 DOM/cc 声明；测试与生产输入前后 SHA 稳定；4 个进程网络尝试均为 0。真实 Node 内存 ES256/AES-GCM/HKDF-SHA256 后端，不落私钥或群密钥，不接 HTTP/DB。零网络是被测执行路径证据，不是 OS sandbox。

[IntentPort 编译擦除证据](intent-type-erasure.json)：前缀 47,617 字节完整保全，type-only 尾部 1,425 字节；ES2015 无注释运行时代码前后完全相同（17,548 字节），没有 SharedCommitContracts 运行时依赖。

命名 WARN 22→45，新增 23 条逐条语义在机器摘要中核对：均为 `TraceTouchChange` / `TraceTouchAggregate` / `traceTouchId` / `normalTraceEntityId` / `normalTrace` / `traceTouches` 的痕域契约字段，非日志；不改规则或白名单、不写成零增量。

新增名称的 TypeScript AST 全量清单及五源码 SHA 见 [new-names.json](new-names.json)；[名库 v3.18 附录提案](../namebook-v3.18-appendix-proposal.md) 交 Trae 落盘，两份 artifact 的 SHA 收入机器摘要。本轮只生成附录提案。

[154 项验收索引](acceptance-index.md) 与 [机械索引](acceptance-index.json) 按最终 TAP 逐项对应；五源码 AST 纯逻辑 profile 与测试 SHA 一致。[本轮交付链接检查](artifact-links.json) 无缺失本地目标。正式裁定、验收说明、待裁定清单、独立复审及交付报告 SHA 也收进机器摘要。

三门禁与 SHA 来源复核不代替实际产品和真实服务验收。本轮不宣称真实 Relay、成员产品机制、P4/P5 或完整 FileCarry 已实现。历史所有 FAIL/TAP/JUnit 结果保留，正式验收仅用 final-verified。
