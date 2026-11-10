# B2.3 分叉存储与接线独立验收

本文件是本轮质量证据，不修改 docs、名库或冻结参照。契约使用实际域计划、七项验证器、存储适配器及根接线回调，时钟和 localStorage/Web Locks 使用隔离 fixture；不构成 Cocos 生产验收。生产预览和截图由主实现代理汇总。

## 修改文件

- 新增 `src/presentation/WorldForkStorage.ts` 及 `.meta`。
- 新增 `quality-review/b3-world-fork/storage.contract.cjs`、`storage.contract-results.json`。
- 新增 `quality-review/b3-world-fork/runtime-wiring.contract.cjs`、`runtime-wiring.contract-results.json`。

本分项没有修改既有生产源码。对 WorldCoreStateStorage、WorldFolderBuilder、WorldStateCodec 和实例继承的建议由所属实现代理处理。

## 持久化协议

单账号 journal key 为 `neurou-world-fork-journal-v1:` + `encodeURIComponent(accountId)`，严格数据形状为 `{schemaVersion:1, kind:'PendingWorldFork', accountId, plan}`。plan 使用域层 `WorldForkPlan` 完整验证，不保存源状态副本，只保存源版本/摘要、完整目标初始七项状态和精确目标目录记录。

根先取得 source 非等待世界租约，再取得 fresh target 租约，最后调用同账号目录锁 `neurou-world-folder:` + `encodeURIComponent(accountId)`。所有普通目录创建/删除也必须调用该锁与 `assertNoPending`。分叉只读账号权限，不取得账号写锁、不写账号事实。

提交顺序为 journal → target Core → directory append → journal remove。目录 append 是唯一提交点；target Core 的写/删仅经根绑定的持世界租约 writer 与精确 bytes 删除能力进行。journal/目录由本适配器写入。适配器不写源 key 或账号 key。

目录提交前失败时，仅回滚匹配计划的未发布 target，再清 journal。回滚失败返回 `Pending`，保留可恢复数据；完整回滚成功则抛原提交错误。目录提交后返回 `Committed`；清日志失败返回 `cleanupPending=true`，不会回滚已发布目标。相同精确计划的已提交重试无写入。

恢复只需要 target 租约与目录锁，不要求来源仍存在或版本不变。目标目录记录匹配则确认目标完全匹配计划，缺失时由完整 journal 通过 leased writer 修复，再清日志。目录无 target 则回滚精确暂存目标；记录/目标冲突与未知或损坏 journal 保留原 bytes 并拒绝清理。尚未清理的事务阻挡普通目录 mutation 与目标 graph 发布。

## 契约结果

| 证据 | 通过 | 失败 | 范围 |
| --- | ---: | ---: | --- |
| `storage.contract-results.json` | 41 | 0 | 实际域、七项 codec、Core writer/remove；正常顺序、各 stage quota、实际持久 prefix 新实例重启、目录双次 CAS、cleanup/rollback 失败、冲突保全、同事务幂等、锁与同步权限边界 |
| `runtime-wiring.contract-results.json` | 14 | 0 | 从当前 WorldFolderBuilder AST 提取 forkStorage 属性初始化器并执行真实回调；目标精确继承、合法篡改拒绝、来源/权限重读、reservation finally、无 Ledger provenance 拒绝、availability 默认与装配值 |

重启测试取正常执行实际写入后的每个持久 Map 前缀，分别建立全新适配器及 lease 后恢复，不依靠虚构阶段标志。它覆盖事务开始前、journal 后、target 后、目录提交后、清理后五个边界。每组还验证第二次恢复为 `NoPending`。

根接线测试特意构造仍能通过七项 Complete 的 target：额外 RecallCount、实际 ChartArchive.prepareReplay 生成的成绩、合法普通 Ledger 事件。实际来源回调的逐项重派生比较均在 journal 写入前拒绝，不以“合法状态”替代“精确继承”。

## 门禁与独立审查

- `npm run typecheck`：PASS。
- `npm run check:dependencies`：109 个逻辑文件，约 386 条静态依赖，0 ERROR。
- `npm run check:naming`：115 个文件，0 ERROR / 22 WARN，均为既有 Trace / Window 语义告警。

独立读审查确认根路径的锁顺序、目录新鲜读取、同步权限读取、源完整状态重新派生、target reservation 的 finally 清理及 Core rollback 防误删。没有发现新的架构阻断。

## 新增公开命名

`WorldForkStorage`、`WorldForkStorageBindings`、`WorldForkCommitResult`、`WorldForkRecoveryResult`。

方法：`withDirectoryLock`、`readPending`、`assertNoPending`、`commitWorldFork`、`recoverWorldFork`。

内部 journal 不作为长期历史、WorldRegistry 或 FileCarryPayload；永久来源由 Core `forkOrigin` 承载。`readPending` 为纯读取，任何缺失/损坏不自动创建、补值或清除。
