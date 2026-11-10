# B2.5c-2c 证据记录状态

当前状态：P10 与 P11 已由用户批准，源码稳定后的构建、门禁、SHA 审计及分类测试证据已记录。本说明是证据索引；阶段实施结论见 delivery-report.md，最终验收由 PROTOCOL 审阅，不由机械审计代替。

最终版说明：收尾复核发现旧 generation 清理遗漏，仅修复新增 RelayStorage 的到期 UPDATE 范围，当前 floor 仍独立计算。最终 server 完整 20、首次入队并发 2、旧 generation retention 2 与 client 22 的原始证据均在 after-retention-fix/；validation-retention-final-lineage.json 绑定最终源 SHA 与执行结果。门禁/build 使用 retention-final/；最终 diff/清单为 source-final.diff、changed-files-final.json、new-names-final.json，保护为 protected-retention-final-audit.json 与根 canonical protected-final-audit.json。原 final、delivery、run05 与先前完整清单均保留为修复前时间快照，不冒称最终 Storage 字节。45 契约与 508 历史回归记录保持，相关旧核心/adapter 源未再变化；最终完整 artifact-inventory-final.json 排除自身和私有 runtime，不构成递归哈希声明。

不可覆盖的原始记录：

- `protected-baseline.json`：本轮初始 7435 文件基线。
- `protected-final-audit.json`：机制实施前的只读前置审计；文件名沿用最初请求，不是 Relay 实施完成审计。
- `protected-implementation-interim-audit.json`：实施期间的精确范围审计。
- `protected-implementation-paused-audit.json`、`wip-code.diff`、`wip-changed-files.json`、`wip-new-names.json`：P11 暂停时状态快照。
- `gate-runs/current-paused-source-state/` 与 `server-paused-noemit-results.json`：暂停时可编译性检查，未包含最终 Relay 验收。
- `paused-evidence-summary.json`：暂停时证据解释，保留原时间与状态；其中的 PausedP11 是历史事实，不能代表恢复后的当前状态。

最终产物使用新名称，不回写上列历史记录：`protected-implementation-final-audit.json`、`gate-runs/final/`、`code.diff`、`changed-files.json`、`new-names.json`。根目录 `protected-final-audit.json` 克隆最终保护事实并显式保留基线、最初只读审计、暂停快照及 Intent runtime 证明的 SHA 引用；其当前保护范围说明与继承的旧前置时态分列。

历史回归完成 508 项：B2.4e 227、c-1 154、旧 b 服务器 16 与客户端 30、c-2b 纯协议 32 与客户端 oracle 18、c-2b authority 服务器 20 与真实 authority adapter 11。各类证据独立，不能将合计写成 508 项 Relay 生产验收。

`history-c2b-http/results.json` 的 false/-1 是新包装脚本只识别 TAP 前缀造成的计数解析错误；真实子进程与 31 项用例均通过。原记录未改，`verified-results.json` 以原日志重新解析 Node specs 的 `ℹ` 前缀。此修正不改变用例、断言或日志。

两份 `.shared-kernel` 均纳入 SHA 保护：`server/.shared-kernel` 为中间编译产物，`server/shared-dist/.shared-kernel` 为有意复制的运行布局产物。二者不是独立实现，也不重复计入源码/用例数。最终审计仅允许新增四个精确 Relay 运行 JS 路径，所有已存在的 kernel 与其他生成物仍必须字节相同。

命名计数统一按新增实施 TS 文件中的顶层公开声明统计。既有 c-2b 为 17 份新增实施 TS、64 个公开顶层声明，其中 SharedServiceProtocolContracts 有 37 个公开类型；IntentPort 重导出不重复计入。最终 c-2c 增量为五份新增实施 TS、八个公开顶层声明，累计 22 份与 72 个；37 个协议公开类型不变。局部变量、属性、方法、import、重导出、测试及生成副本不计公开声明。

最终行为验证命令与源码 SHA 见 `validation-final-lineage.json`：服务器真实 HTTP/PG 完整 20 项、追加首次入队并发两项、真实客户端 HTTP/PG 22 项、客户端契约 oracle 32 项与 P10 deadline oracle 13 项。追加并发分支改变了新测试 harness 的整份文件；完整 20 项原用例/断言未改，此时态在 lineage 中披露。运行环境为本机开发世界，真实 wall clock 与明确隔离 clock 的边界分列；native crypto 与 WAL host cache 注入不冒称 c-2d/e 的完整生产机制。
