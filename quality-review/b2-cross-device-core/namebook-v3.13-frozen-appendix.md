# 名库 v3.13 冻结附录提案 · B2.4c / VERDICT-311～325

本文件是本轮受限 Core 原型的命名、契约与实施依据，交 Trae 合并到正式名库。未修改 docs、正式名库或参照文件。v3.12 中已冻结的 b 名称与语义保持；下列 c 候选在本轮正式冻结，候选身份结束。实现范围与生产证据应分别验收，名称冻结不代表完整 FileCarry 或真实服务已经交付。

## 历史名补登与继承关系

| 名称 | 已冻结语义与本轮边界 |
|---|---|
| WorldHomeRegistry / WorldHomeRegistryCodec / WorldHomeRegistrySession / WorldHomeContractAdapter | v3.12 已正式冻结的账号级非 InitialWorld 归属索引、严格 codec、session 与契约权威；本轮组合复用，原文件不改、不改名。 |
| HomeDevice / HomeState / Homed / Released / HomeConflict | 账号×世界归属设备、Homed/Released 状态与登记冲突；本轮只新建 homeRevision=1/Homed。Released 只检测后拒绝 claim。HomeConflict 本身不是已认证复制证据。 |
| WorldRegistry / DuplicateWorld | 本设备内位置登记与复制品加载状态；本轮不实现位置 API，也不把跨设备归属索引改名为 WorldRegistry。v3.12 中将位置 API 放到 c 的方向描述，由本轮明确排除范围取代。 |
| WorldFork / WorldForkSession / WorldForkStorage / rebaseWorldState / WorldForkOrigin | B2.3 本机事务与七项重键算法；本轮仅直接复用 rebaseWorldState 与既有来源头，不调用 prepareWorldFork、不复用 Fork 存储事务。 |
| WorldCoreStateSnapshot / WorldStateSnapshot / Complete / Restored | 既有 Core v1 存储壳、接收进程内七项完整认证、完整产出/恢复状态。线上数据不能传递品牌；接收端重新 parseComplete。 |
| Ledger / PuzzleProgress / FormatTime / RecallCount / WorldLink / ChartSnapshot / ChartScore | 七个既有 Core section 名，保持大小写与结构，仍存入一个主 key；不新增七个 section key。 |
| Inherited / WorldClearRecord / FirstWorldCleared / CopyPermission | 完成事件随新来源头继承为 Inherited，不创建通关事实。接收权限来自同账号既有只读事实源，账号事实不进入载荷、不随世界复制。 |
| CrossDeviceDuplicate / CrossDeviceDuplicateResult | 已验证同账号传输的来源世界仍归属另一设备时，允许进入 c 复制。六路结果正式落为下表联合类型。 |
| FileCarryPayload / AuthService / CommitRelay | 历史完整 FileCarry 与外部服务名称保持。当前载荷不称 FileCarryPayload，不包含共享层 codec、完整媒体或加密 suite；不接真实 AuthService/CommitRelay。 |
| WorldMigration / MigrationRelease / MigrationClaim / Migrated / RealityPause / OfflineGrace / SafePoint | 历史语义和用户 P1～P4 裁定继续有效；本轮不实现迁移或暂停。新的 d 数据结构、执行端口、journal phase、协调锁与时间协议尚未在 c 冻结。 |

InitialWorld 不进入跨设备登记、检测、传输；各设备自行初始化。InitialWorld 经 B2.3 本机分叉形成的新 UUID 世界可成为本轮来源。

## 本轮冻结的 director 公开名称

承载文件：`src/director/CoreTransfer.ts`。

| 类型或类 | 字段/作用 |
|---|---|
| CoreTransferPayload | schemaVersion=1、kind=RestrictedCoreTransfer、transferId、sourceDeviceId、sourceHomeRevision=1、state。state 是七项 Core 的 data-only 值，含既有可选 forkOrigin。 |
| CoreTransferProof | schemaVersion=1、accountId、worldId、sourceDeviceId、transferId、sourceHomeRevision=1、sourceDigest；同一共享权威对精确已发布载荷的证明。ContractAdapter fixture 证明，不是加密签名或真实认证凭证。 |
| CrossDeviceAuthorityPort | extends WorldHomeAuthorityPort；沿用 mode=ContractAdapter/context/readRegistry/registerWorldHome，新增 publishTransfer(payload):Promise<unknown>、verifyTransfer(payload):Promise<unknown>。 |
| CrossDeviceImportRequest | schemaVersion=1、title、description；不能覆盖账号或设备。 |
| CrossDeviceDuplicateResult | kind/mode；Homed、CrossDeviceDuplicate、Released、Migrated 携带 record；AuthorityUnavailable、UnsupportedBoundary 携带 detail。 |
| CrossDeviceImportPlan | schemaVersion=1、accountId、deviceId、transactionId、registrationId、targetWorldId、payload、targetRecord、targetState；本地恢复时重新认证完整目标。 |
| CrossDeviceImportPhase | Prepared / HomeRegistered / Published。 |
| CrossDeviceImportEntry | phase、plan、homeReply。Prepared 时 homeReply=null；其余两相必须有合法 Homed/homeRevision1 接收设备登记回复。 |
| CrossDeviceImportJournal | schemaVersion=1、kind=CrossDeviceImportJournal、accountId、deviceId、entries；同设备账号最多一条非 Published，事务/目标/registration 标识各自唯一。Published entries 永久保留于 c。 |
| CrossDeviceImportReceipt | kind=Published或Pending、mode=ContractAdapter、transactionId、targetWorldId、phase、error:string或null；receipt.kind 与 journal.phase 是不同字段。 |
| CoreTransferCompleteValidator | (raw:unknown,accountId,worldId) => WorldStateSnapshot；必须产出当前进程正式认证，并结合已发布内容引用验证。 |
| CrossDeviceImportBindings | authority、milestoneReader、validateComplete、createWorldId、createTransactionId、createRegistrationId、now；接收器不接受本机来源 lease/目录/源 Core 写入端口。 |
| CoreTransferCodec | constructor(validateComplete)；readonly home 使用既有 WorldHomeRegistryCodec。 |
| CrossDeviceImportAdapter | constructor(context,bindings)；readonly context / codec；独立远端计划准备和当前来源检测。 |

公开方法名冻结：

| 所属 | 方法 |
|---|---|
| CoreTransferCodec | parsePayload(raw)、parseProof(raw,payload)、parseRequest(raw)、parsePlan(raw)、parseJournal(raw)。 |
| CrossDeviceImportAdapter | verifyAuthoritySource(payload)、detectCrossDeviceDuplicate(raw)、prepareImport(raw,request,folder)、requirePermission()。 |
| CoreTransfer 公共辅助函数 | validateTransferFolder(raw,accountId)、transferFields(raw,names)、copyTransferData(raw,ancestors?)。 |
| CoreTransferContent.ts | validateCoreTransferContent(state,rawManifest):void；先 Complete 品牌，再校验正式发布的谱面、视觉、媒体身份与叙事版本。CoreTransferContentRequired 是未先认证时的诊断文本标记。 |

六路分流的冻结解释：

| kind | c 的处理 |
|---|---|
| Homed | 当前可信来源 HomeDevice 正是接收设备；不是跨设备导入，不走复制。首次登记仍使用 b registerWorldHome。 |
| CrossDeviceDuplicate | proof 精确匹配、同账号、来源当前 homeRevision1/Homed 且 HomeDevice 为另一设备；唯一可走 c 复制的分支。 |
| Released | 历史 proof 有效且当前 Released；c 拒绝 claim，交 d。 |
| Migrated | 名称与联合类型保留；c 无明确迁移证明，不产出此分支。 |
| AuthorityUnavailable | 服务/端口/证明不可用或不可信；拒绝导入。 |
| UnsupportedBoundary | InitialWorld、不支持的 Core/活动边界、未来归属版本或来源设备已改变；拒绝导入，不猜测 Migrated。 |

## 本轮冻结的 presentation 公开名称

| 文件/名称 | 公开能力 |
|---|---|
| CrossDeviceContractAdapter.ts / CrossDeviceContractBindings | parsePayload、parseProof、parseRegistry、parseContext、digestState 验证/摘要注入；无 director 值导入。 |
| CrossDeviceContractAdapter | constructor(homeAdapter,bindings)、bindDevice(context):CrossDeviceAuthorityPort。共享原 b 权威；源发布核对当前归属，verifyTransfer 核对精确历史发布值；当前归属分流另由 director 检测器负责。 |
| CrossDeviceImportStorage.ts / CrossDeviceImportStorageBindings | context、authority、validatePlan、validateJournal、validateFolder、parseRegistrationReply、parseRegistry、assertTargetLease、writeTarget、readTarget、validateCurrentTarget、verifyAuthoritySource。持久写/回读/租约验证须同步，来源权威验证可异步。 |
| CrossDeviceImportRecoveryResult | CrossDeviceImportReceipt 或 {kind:NoPending,mode:ContractAdapter}。 |
| CrossDeviceImportStorage | constructor(storage,locks,bindings)；withImportLock(accountId,operation)、readJournal(accountId)、readPending(accountId)、prepare(plan)、registerAndPublish(plan)、recover(accountId,targetWorldId?)、assertCanOpen(accountId,targetWorldId)。 |

assertCanOpen 必须在真实目标 lease 下执行，服务 await 前后都验 lease；检查 Published receipt、当前服务 Homed/homeRevision1/接收设备与目录/Core 一致性。初始 revision0 Core 必须与完整计划精确相等；较高 revision 允许合法游戏进展，但世界身份、forkOrigin、FormatTime 不得改变。

## 本轮冻结的组合根名称与存储/锁

`assets/scripts/CrossDevicePrototype.ts` 是附加组合根：CrossDevicePrototypeBindings / CrossDevicePrototype；公开 constructor、mount、unmount、dispose。Bindings 为 accountId、readSourceFolder、readSource、acquireSourceLease、milestoneReader、validateComplete、isIdle、openTarget。

组合辅助名 LogicalDeviceStorage / prototypeLocks 隔离逻辑设备 B 的本地世界存储与锁；这是同一 realm 的 ContractAdapter 演示方式。设备上下文为 logical-device-a / logical-device-b。WorldFolderBuilder 只追加 crossDevicePrototype 字段、mountCrossDevicePrototype 与 openImportedRuntime，沿用既有正式 factory 与退出流程。

| key/锁/载体 | 冻结值与角色 |
|---|---|
| 导入 journal key | `neurou-cross-device-import-v1:` + encodeURIComponent(accountId)。独立于 Fork journal；schemaVersion=1。 |
| 导入协调锁 | `neurou-cross-device-import:` + encodeURIComponent(accountId)。 |
| 账号目录锁 | 复用 `neurou-world-folder:` + encodeURIComponent(accountId)，始终最后取得；目录锁期间不 await 服务。 |
| Core / 目录 key | 沿用 `neurou-world-state-v1:` + encodedAccount + `:` + encodedWorld / `neurou-world-folder-v1:` + encodedAccount。 |
| Fork journal key | 沿用 `neurou-world-fork-journal-v1:` + encodedAccount；c 不读写该事务。 |
| B 演示存储包装 | `neurou-contract-device-b:` + encodeURIComponent(原完整key)。不复制账号事实；世界/目录/journal 使用独立 B 域。 |
| B 演示锁包装 | `neurou-contract-device-b:` + 原锁名。逻辑设备 B 有自己的世界/目录/导入锁域。 |
| UUID / 事务标识 | 目标 world-UUIDv4；transactionId=import-UUIDv4。transferId/registrationId 是独立可编码身份，本轮生产分别生成 transfer-UUIDv4 / registration-UUIDv4。 |
| 原型面板 DOM 名 | cross-device-prototype、cross-device-source、cross-device-export、cross-device-import、cross-device-open、cross-device-recover、cross-device-status。dataset.mode=ContractAdapter、dataset.prototype=RestrictedCoreTransfer；sourceWorldId/targetWorldId/receipt/error 仅呈现观测。 |

锁顺序：独立账号导入锁 → 真实新目标世界 lease → 账号目录锁。服务等待在持导入锁/目标 lease 时执行，在取得目录锁之前结束。不持远端源 lease。A 导出单独持 A 来源真实 lease，并检查 active 本机目录；不得将这个来源 capability 伪造到 B。B2.3 的源→目标→目录锁顺序保持。

源世界 HomeConflict 只能在精确 proof 与当前来源归属都通过后分流为 CrossDeviceDuplicate；目标新 UUID 登记返回 HomeConflict 永远拒绝发布或覆盖。新目标 HomeDevice=接收 B，来源 HomeDevice=A 不变。

## 后续阶段尚未冻结的实施细节

B2.4d 的 SafePoint 主动排空确认载体、MigrationRelease/Claim 请求与 receipt、WorldMigrationJournal 完整结构/phase、RealityPauseRecord/设备绑定/账号切换执行端口、恢复与协调锁的具体协议仍须在 d 入场冻结；不从本轮 import journal 推断或冒充迁移契约。历史同 ID 迁移与全账号暂停语义、用户 P1～P4、RealityPause≥OfflineGrace 约束保持。

B2.5 的完整 FileCarry 共享层 codec、个人媒体、账号加密与密钥 suite、真实 AuthService/CommitRelay/fetchServerTime 服务实现尚未冻结。WorldRegistry 本机位置 API、AccessCode/ObserverSync、本机账号切换执行端口均未在本轮新增。

沿用 INV-10/12/13、活动状态 UnsupportedBoundary、七项主 key、目录追加唯一本地发布点、持真实 lease 才写/无 Web Locks 显式拒绝。服务登记与本地目录是两个存储域，以独立 journal 协调，不宣称全局单一原子点。损坏/碰撞/未知身份保留原值；不删除已发布世界伪装回滚。
