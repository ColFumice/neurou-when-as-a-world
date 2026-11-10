# 名库 v3.11 附录提案 · B2.3 WorldFork

本提案的全部名称已由 PROTOCOL 正式追认，交 Trae 落盘。本文件依据本批实际代码列出新增公开词汇与既有结构增量；本批实施未编辑 docs / 名库 / 参照文件。两处同期变更已归因给 PROTOCOL 授权的 Trae 并发落盘，原样保留。v3.8 的真实通关、v3.9 的状态基础、v3.10 的七项完整认证及实际谱面归档继续沿用。

## 新增公开名称

| 文件 / 模块 | 名称 | 职责 |
| --- | --- | --- |
| director / WorldForkOrigin.ts | WorldForkOrigin | 目标实例永久且不可补写/改写/删除的分叉来源头 |
| 同上 | validateWorldForkOrigin | 严格身份、时序、结构和继承完成见证校验；无平台调用 |
| director / WorldForkSession.ts | WorldForkPlan | 已校验来源摘要、目标目录记录与完整状态的纯提交候选 |
| 同上 | WorldForkBindings | createWorldId / createTransactionId / now / validateComplete 注入边界 |
| 同上 | WorldForkSession | 检验同账号权限、active Complete Primary 来源并生成独立候选 |
| 同上 | rebaseWorldState | 精确继承七项；仅重键世界复合身份并附加 origin |
| 同上 | validateWorldForkPlan | 日志及持久化调用共同使用的计划严格解码边界 |
| director / ForkWorldClearSession.ts | ForkWorldClearSession | 扩展旧 WorldClearSession，将继承完成与目标真实新完成分开 |
| presentation / WorldForkStorage.ts | WorldForkStorageBindings | validatePlan / validateFolder / validateSource / assertTargetLease / writeTarget / deleteTargetExpected |
| 同上 | WorldForkCommitResult | Committed 或 Pending/Rollback，区分目录提交与清理状态 |
| 同上 | WorldForkRecoveryResult | WorldForkCommitResult 或 NoPending / RolledBack |
| 同上 | WorldForkStorage | 同账号目录锁、短期日志、目标暂存、发布、回滚与恢复 |

共 12 个新增顶层公开导出。WorldForkOrigin 与 WorldForkPlan 通过 IntentPort 的 export type 转发，presentation 不 value-import director 验证器。既有 WorldFork 是意图名，不新增 DuplicateWorld、WorldRegistry 或另一分叉意图。

## 数据结构

| 结构 | 冻结字段与规则 |
| --- | --- |
| WorldForkOrigin | schemaVersion=1 / accountId / sourceWorldId / sourceRevision / sourceCapturedAt / targetWorldId / protagonistCharacterId / transactionId / forkedAt / inheritedCompletionEventId:string或null |
| WorldForkPlan | schemaVersion=1 / accountId / transactionId / sourceWorldId / targetWorldId / sourceRevision / sourceDigest / targetRecord / targetState |
| WorldForkBindings | createWorldId():string；createTransactionId():string；now():number；validateComplete(raw,accountId,worldId):WorldStateSnapshot |
| WorldForkStorageBindings | validatePlan(raw):WorldForkPlan；validateFolder(raw,accountId):WorldFolderSnapshot；validateSource(plan):void；assertTargetLease(plan):void；writeTarget(state):void；deleteTargetExpected(state,expectedRaw):void；所有 void 注入操作同步完成，拒绝 Promise/thenable |
| WorldForkCommitResult.Committed | kind=Committed / transactionId / targetWorldId / cleanupPending:boolean / error:string或null；目录发布后清理失败仍为 Committed |
| WorldForkCommitResult.Pending | kind=Pending / transactionId / targetWorldId / phase=Rollback / error:string；未发布且回滚尚未完成 |
| WorldForkRecoveryResult | 上述两个结果，或 `{kind:'NoPending'}`，或 `{kind:'RolledBack',transactionId,targetWorldId}` |

`WorldForkJournal` 是非导出、但由 readPending 公开读取返回的短期存储结构名：schemaVersion=1 / kind=PendingWorldFork / accountId / plan:WorldForkPlan。它与永久 forkOrigin 不同，成功提交或回滚完成后删除；不是长期世界注册表。未知版本与坏日志不清空、不吞错误。

sourceDigest 为规范 Core 数据的 SHA256，来源版本与摘要在提交时重新验证。目标 worldId 使用 `world-` + 正式 UUID v4，transactionId 由组合根独立工厂产生（当前 `fork-` + UUID）；业务逻辑不自行调用 UUID 或平台时钟。

## 继承身份与首演语义

世界 ID 是实例隔离边界；characterId、chainId、traceId、chartId、eventId 为世界内 ID。继承事件所有值与次序保持，只有七项载体的 worldId、Core 头、SphereCrossing entry.worldId 与 entryId 重键。入口唯一键沿用 `JSON.stringify([accountId,worldId,protagonistCharacterId,'SphereCrossing'])`。

FormatTime 的来源 epochMs 保留；目标 Core revision=0 / capturedAt=forkedAt。原 ChartSnapshot / ChartScore records、媒体身份和内容摘要保持。目标对象图独立深冻结，不与源实例共享可变状态。

inheritedCompletionEventId 非 null 表示目标已经继承合法 World 首演事实，必须匹配主角 Ledger.control.completionEventId 和实际完成事件；公开状态为 Inherited，WorldClearRecord 不继承、不补造。该 World 谱面允许 ReplayChart 更新目标自己的成绩，禁止再次首演和 RetryWorldClear。初始未完成分叉的 null 见证永久不变；目标随后自己的真实完成仍可生成自己的账号记录。

## 既有结构与公开方法增量

| 既有名称 | 本批增量 |
| --- | --- |
| WorldCoreStateSnapshot / WorldStateSnapshot | 可选头 `forkOrigin?:WorldForkOrigin`；schemaVersion=1 / kind=Core / 七项 sections 与品牌保持；旧无头文档不补写 |
| WorldStateCodec | parse 与 parseComplete 校验可选 origin；origin 要求非 null Ledger、Primary/null 与合法完成见证 |
| WorldClearCompletionStatus | 原 NotCleared / Pending / Failed / Completed 增加 Inherited |
| WorldForkAvailability | 原 NotImplemented 增加 Implemented |
| WorldStateSession | constructor 第四参数 readonly worldForkAvailability，默认 NotImplemented；B2.3 组合根显式 Implemented |
| WorldStateLock | 可选 requestIfAvailable<T>(name,operation):Promise<T>；占用或能力缺失拒绝，不无锁降级 |
| WorldCoreStateStorage.acquireWorldLease | 第三可选参数 ifAvailable=false；分叉使用 true 检查源/目标是否可立即取得 |
| WorldCoreStateStorage.hasWorldLease | 新公开 hasWorldLease(accountId,worldId):boolean；只读检查本适配器当前是否持有指定世界租约，不取得锁、不写存储 |
| WorldCoreStateStorage | 新公开 removeUnpublishedCoreState(expected,expectedRaw):void；只可回滚持租约、revision=0、未发布且精确匹配日志的目标 Core |
| WorldCoreStateStorage.saveCoreState | 已存 origin 在普通保存中严格 immutable，不得新增/变更/移除 |
| WorldFolderView | 最后可选 constructor 参数 forkAvailability 读取器；已配置路径异步等待分叉、pending 禁重、按权限与 Complete Primary 启用；无参数旧行为保留 |
| WorldClearView | Inherited 显示继承事实与账号权限，隐藏首演/保存重试，recordCount=0 |

新类主要公开行为：WorldForkSession.prepareWorldFork；ForkWorldClearSession 覆盖 getWorldClearSnapshot / submitFrameIntents，其余沿用 WorldClearSession；WorldForkStorage.withDirectoryLock / readPending / assertNoPending / commitWorldFork / recoverWorldFork。constructor 和局部私有变量属于实现词汇，不另造玩法名。

WorldFolderIntent、PlayerIntent 没有新增变体。WorldFolderPort.submitWorldFolderIntent 的既有 void 签名保持；组合根返回 Promise 的异步实现由 presentation 使用 Promise.resolve 等待。分叉按钮 payload 仍严格仅 kind/worldId。

## 存储 key 与锁

新增短期日志 key：`neurou-world-fork-journal-v1:` + encodeURIComponent(accountId)。新增账号目录锁名：`neurou-world-folder:` + encodeURIComponent(accountId)。

既有目录 key 仍为 `neurou-world-folder-v1:` + encodeURIComponent(accountId)；目标七项状态沿用 `neurou-world-state-v1:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)；世界租约沿用 `neurou-world-state:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)。账号通关和首次通关投影 key 均不变。

目录追加为唯一 commit point，journal → 同步 target Core → directory → journal cleanup。首个原子日志写失败不调用 writeTarget、不写目标或目录；日志清理失败仍按 Committed/cleanupPending 处理。回滚仅删除精确未发布目标；已发布目标不回滚。普通新建/删除/再次分叉的写操作共享目录锁与 pending guard，不覆盖未恢复日志；打开目标先完成日志恢复，目录读取与只读状态诊断不因 pending 被禁止。

## 沿用范围与未实现内容

正式 Primary 副本通过已有内容和 SceneBuilder 恢复，普通新建 EmptyWorld 仍走原最小世界；不新增世界内容或改编辑器核心。七项核心归属没有变化，forkOrigin 是实例头，账号事实仍不进入世界快照。

没有新增模块，依赖矩阵方向不扩展；director 零 cc/DOM/Storage/平台时钟，presentation 只通过 IntentPort 读取 director 类型，assets/scripts 为组合根。B2.3 只开放正式 Primary 来源；不新增 BugShore/FinalShore 内容或入口、不实现 FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入、AccessCode。

所有名称已由 PROTOCOL 正式追认，WorldForkAvailability 的生产装配 Implemented 同步追认；旧未装配默认 NotImplemented 的兼容行为保持。已观察到 Trae 将 v3.11 附录落入正式名库，后续文档证据见 post-acceptance-trae-landings.json。B2.3 正式验收确认见 protocol-acceptance.json；契约与生产原始结果分别保留。
