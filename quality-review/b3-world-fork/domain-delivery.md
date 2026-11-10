# B2.3 纯领域与既有链路回归交付

此交付仅包含领域实现和契约证据。Cocos 两档分辨率、真实媒体及用户操作生产验收由主任务独立出证，不用下列夹具替代。

## 实现归属

- `src/director/WorldForkOrigin.ts` / `.meta`：不可变实例来源头，严格纯数据校验；同账号、源/目标异号、版本和时序校验；非空继承见证必须匹配本人合法 World 首演完成事件和同谱入口。源未完成的 `null` 见证在未来真实首次完成后仍保留。
- `src/director/WorldForkSession.ts` / `.meta`：先验证当前 Complete 认证、正式 Primary、活跃目录和只读复制权限，再调用 UUID 与时间工厂。显式重键七项，保持事件、局部 ID、原始 FormatTime、谱面快照和成绩；目标 revision=0。计划携带 sourceRevision 与整源 canonical SHA-256；存储必须在源租约内重读核对并验证精确继承。
- 没有修改既有生产源。主任务拥有 codec/header、IntentPort、存储防改来源及组合根接线；其他子任务拥有事务存储与继承完成保护包装器。

冻结公开接口：`WorldForkOrigin`、`validateWorldForkOrigin(raw, accountId, worldId, ledger)`；`WorldForkPlan`、`WorldForkBindings`、`WorldForkSession.prepareWorldFork(sourceWorldId, folder, source)`；`rebaseWorldState(source, targetWorldId, origin, validateComplete)`；`validateWorldForkPlan(raw, validateComplete)`。

`WorldForkPlan` 字段为 schemaVersion=1 / accountId / transactionId / sourceWorldId / targetWorldId / sourceRevision / sourceDigest / targetRecord / targetState。目标目录保留既有六字段，template=EmptyWorld；游戏来源来自已持久 `forkOrigin`，不能由目录模板猜测。

## 本批契约

- `domain.contract.cjs` / `domain-results.json`：54 PASS，0 FAIL。覆盖七项精确继承、真实已完成与已穿越未完成源、零副作用拒绝边界、UUID 与墓碑防重、严格数据/访问器/稀疏数组/循环拒绝、源和目标认证、继承完成见证、后代副本和不可变性。
- `legacy-wiring.contract.cjs` / `legacy-wiring-results.json`：11 PASS，0 FAIL。沿用 B2.2d-2 原套件所有断言，只为目录探针增加新 no-pending recovery 能力与前置 validator no-op，验证实际 SceneBuilder 首演、媒体、durable-before-account、旧三项不静默迁移和目录 GC 重试语义。
- `folder-regression.contract.cjs` / `folder-regression-results.json`：12 PASS，0 FAIL。执行实际 WorldFolderBuilder 和实际 director/storage，仅 Cocos 生命周期、资源加载、视图为环境适配；覆盖 startup/create/delete/GC/exit/corruption/editor 和异步资源/租约接线。

## 未改历史套件原文回归

`regression-runner.cjs` 不改历史套件原文、filename 或 require 上下文，仅将 JSON 写入 `regression-results/`，因此此前验收证据未被覆盖。

| 套件 | 原文结果 |
| --- | --- |
| B2.2a account milestone | 26 PASS / 0 FAIL |
| B2.2c domain / account storage | 49 / 56 PASS，0 FAIL |
| B2.2d-2 aggregate / chart / recall / replay / storage / WorldLink | 23 / 24 / 31 / 23 / 23 / 24 PASS，0 FAIL |
| B2.2d-1 Ledger / Puzzle / storage | 44 / 14 / 40 PASS，0 FAIL |
| B2.1 directory logic / account startup | 15 / 4 PASS，0 FAIL |
| B2.2d-2 historical runtime wiring | 9 PASS / 1 FAIL，见下方夹具缺项 |
| B2.2d-1 historical aggregate | 0 PASS / 1 FAIL，见下方过期断言 |
| B2.2d-1 historical runtime wiring | 0 PASS / 1 FAIL，见下方三项夹具 |
| B2.1 historical synchronous builder boundary | 0 PASS / 9 FAIL，见下方异步边界 |

四组失败保持原始结果，不汇报成 PASS：

1. d-2 runtime 目录探针没有新 `recoverPendingFork`；最后 corruption 探针还缺 `prepareCoreValidator`。仅补这些明确环境能力的派生套件保留原 11 条断言并全部通过。
2. d-1 aggregate 第一条要求仅 Ledger/Puzzle/FormatTime 三项 Implemented、其余四项 NotImplemented。B2.2d-2 已完成七项，且 B2.3 baseline 已为七项，故历史阶段断言失效。当前正式 aggregate 23 条通过。
3. d-1 runtime 夹具只装三项验证器，而实际 SceneBuilder 已会写四扩展。错误为“谱面快照验证器尚未装配”；B2.3 baseline 已有该四扩展生产接线。当前七项实际 SceneBuilder 接线 11 条通过。
4. B2.1 builder 夹具同步访问 `boot()` 返回后的 folderView，不等待 account reconcile / resources / lease。B2.3 baseline 的 `showWorldFolder`、`renderWorldFolder`、`createWorld`、`openWorld` 已异步。当前异步环境适配的实际 builder 12 条通过。

新能力边界不废止未来规则：BugShore 当前返回 UnsupportedSourceKind；FinalShore 始终硬拒绝。没有新增 FileCarry、WorldRegistry、服务或跨设备机制。
