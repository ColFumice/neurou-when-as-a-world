# 名库 v3.14 附录提案 · B2.4d

依据 VERDICT-326～345。本文是 quality-review 内的冻结交付提案，供 Trae 合入正式名库；本提案不直接落盘至 docs、正式名库或参照文件。保护审计发现两份正式文档相对基线漂移、写入来源未知，不能据此宣称整个工作区文档未变，详见 observed-doc-drift.json。B2.4d 的“已冻结”仅表示本轮代码、契约与验收使用该精确名称，不表示已接真实外部服务。

## 历史名与语义补登

| 名称 | 状态 | 精确语义 |
|---|---|---|
| WorldMigration | 历史名，d 语义冻结 | 同账号、同 worldId 转移 HomeDevice；不分叉、不重键、不要求 CopyPermission。 |
| MigrationRelease / MigrationClaim | 历史名，d 执行契约冻结 | Release 接受源主动排空并开始账号冷静期；冷静期结束发布 Released；另设备 Claim。 |
| RealityPause | 历史名，d 机制冻结 | 全账号、全部设备与世界关闭新准入；已在活动边界只允许真实自然排空。 |
| HomeState / Homed / Released | 历史名，沿用 | PauseActive 时仍 Homed；实际 Released 与 Claim 各递增一次 homeRevision。 |
| Migrated | 历史名，d 准入结果冻结 | 当前 HomeDevice 已转往其他设备的服务归属诊断，不写源墓碑。 |
| SafePoint / OfflineGrace | 历史名，沿用 | 源排空确认不是计时替代；RealityPause ≥ OfflineGrace；本轮不实现平台离线累计运行时长。 |

## 领域导出名

以下全部已在 d 冻结，来源为 `src/director/WorldMigration.ts`，逻辑层零 cc。

| 导出名 | 用途与边界 |
|---|---|
| SafePointDrainWorld | 排空世界索引：worldId、revision、coreDigest。 |
| SafePointDrainConfirmation | 排空数据声明：账号、源设备、drainId、目录摘要及全部未删世界。 |
| SafePointDrainCapability | 仅当前持真实 lease 的 composition 能力，含 confirmation / assertCurrent / revoke；不序列化。 |
| SafePointDrainAcceptance | 服务接受确认与服务时间 30 秒寿命；不是客户端授权缓存。 |
| SafePointDrainPort | withDrain 回调执行端口，保留真实世界/账号锁直到 Release 操作结束。 |
| MigrationReleaseRequest | schemaVersion / migrationId / worldId / expectedHomeRevision / drainId；账号设备来自绑定端口。 |
| MigrationClaimRequest | schemaVersion / migrationId / worldId / expectedHomeRevision（Released 版本）。 |
| RealityPauseRecord | 全账号服务暂停记录；起止均为服务器 epoch 毫秒。 |
| DeviceAccountBinding | 服务持久发起设备账号绑定；活动暂停中不能绑定其他账号。 |
| RestrictedMigrationCorePayload | 受限同 ID、七项 Core 载荷，不是 FileCarryPayload。 |
| MigrationReceipt | kind = PauseActive / Released / Claimed；保留原期望归属版本及服务证据。 |
| MigrationAdmission | Allowed / PauseActive / Released / Migrated，鲜读服务当前归属。 |
| MigrationAuthorityPort | 扩展 WorldHomeAuthorityPort 的独立 d 端口，不修改旧 b/c 边界。 |
| WorldMigrationPhase | Prepared / PauseActive / Released / Claimed / LocalPublished。 |
| WorldMigrationEntry | role = Source / Target，phase、冻结载荷、服务 receipt。 |
| WorldMigrationJournal | 设备账号 entries 日志；历史同世界多迁移可留存，migrationId 唯一。 |
| WorldMigrationStorageReceipt | 本地执行结果；Pending / PauseActive / Released / LocalPublished，含 phase 与 error。 |
| MigrationCompleteValidator | 接收端 parseComplete 与正式内容验证器能力类型。 |
| WorldMigrationCodec | 严格 data-only、身份/版本/引用/phase 一致性解码器。 |
| RealityPauseBoundary | director 新增意图准入策略；既有自然活动必要输入与新活动分离。 |

## 平台与组合根导出名

| 导出名 | 状态 | 来源 / 用途 |
|---|---|---|
| SafePointDrainAccountFacts | d 已冻结 | presentation 排空所读受信通关记录与 FirstWorldCleared。 |
| SafePointDrainBindings | d 已冻结 | 排空读口、验证器、真实 leases、准入世代及共享协调锁。 |
| isLiveSafePointDrainCapability | d 已冻结 | WeakSet 签发验证；阻止自造 noop assertCurrent 冒充排空。 |
| SafePointDrainStorage | d 已冻结 | 真实排序 lease、账号事实锁与最终目录同步验证的执行适配器。 |
| WorldMigrationAuthorityLock | d 已冻结 | ContractAdapter 权威独占锁能力。 |
| WorldMigrationContractBindings | d 已冻结 | 服务 fixture 时间、持久域、严格 codecs 与排空能力验证。 |
| WorldMigrationContractAdapter | d 已冻结 | 持久共享契约权威，原子保存归属 / pause / device binding；不是真实 AuthService。 |
| WorldMigrationStorageBindings | d 已冻结 | 独立迁移日志与同 ID 原版本 target CAS 窄口。 |
| WorldMigrationRecoveryResult | d 已冻结 | WorldMigrationStorageReceipt 或 NoPending。 |
| WorldMigrationStorage | d 已冻结 | 双存储域恢复与目录追加发布，源文件不写。 |
| WorldMigrationPrototypeBindings | d 已冻结，组合内部 | Cocos 组合根接线、目录 / Core / account 读口及准入。 |
| WorldMigrationPrototype | d 已冻结，受限原型 | A / B 两逻辑设备共享权威的生产组合与演示。 |
| ContractServiceClock | ContractAdapter 内部名 | 可控测试服务时钟；推进服务 fixture，禁止解释为真实服务器或客户端一小时授权。 |

## key、锁与判别值

| 精确名称 | 冻结状态 / 用途 |
|---|---|
| `neurou-migration-v1:` + encodeURIComponent(accountId) | d 已冻结；WorldMigrationJournal v1。不同设备由注入存储域隔离。 |
| `neurou-reality-pause-v1:` + encodeURIComponent(accountId) | 历史前缀，d 缓存用途冻结；仅诊断缓存，不能授予准入或解除暂停。 |
| `neurou-cross-device:` + encodeURIComponent(accountId) | d 已冻结；源排空 / 迁移 / 当前新增准入的设备账号协调锁。 |
| `neurou-world-state:` + encoded account + `:` + encoded world | 既有 lease 锁；沿用，不新增独立 section key。 |
| `neurou-world-clear:` + encodeURIComponent(accountId) | 既有账号事实锁；排空沿用。 |
| `neurou-world-folder:` + encodeURIComponent(accountId) | 既有最终目录锁；本地发布最后取得。 |
| `neurou-migration-contract-authority-v1` | ContractAdapter 内部 fixture key；独立权威持久快照，不进入世界 Core 或完整服务命名。 |
| `neurou-migration-authority` | ContractAdapter 内部全局权威锁；服务不反取世界 / 目录锁。 |
| `neurou-contract-service-clock-v1` | ContractAdapter 内部可控时钟 key；不作产品服务器时间协议。 |
| `neurou-contract-device-b:` | 沿用 c 的逻辑 B 存储 / 锁隔离 fixture 前缀，不声称物理设备认证。 |
| `RestrictedMigrationCore` | d 载荷 kind。 |
| `WorldMigrationJournal` | d journal kind。 |
| `ContractMigrationAuthority` | ContractAdapter 内部持久权威快照 kind。 |
| Prepared / PauseActive / Released / Claimed / LocalPublished | d 全部 journal phase；不使用 CleanupPending。 |
| Source / Target | d journal role。 |
| Allowed / PauseActive / Released / Migrated | d 当前服务准入 kind。 |
| NoPending | d 恢复无在途日志结果。 |

## 后续范围

B2.4e 不另造迁移协议，只在本轮受限 Core、共享 ContractAdapter、双逻辑设备及自然安全点范围整体验收。真实 AuthService / CommitRelay、完整 FileCarry 的共享 codec / 个人媒体 / 加密 suite、平台 OfflineGrace、非 Primary 迁移、WorldRegistry 本机位置、AccessCode / ObserverSync 未在本轮冻结实施结构；按后续阶段另行冻结。
