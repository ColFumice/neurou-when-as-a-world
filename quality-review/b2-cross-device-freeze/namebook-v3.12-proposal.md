# 名库 v3.12 附录提案 · B2.4a

交付对象：PROTOCOL 审阅后交 Trae 落盘。本轮没有修改 `docs/NAMEBOOK.md`，没有通过工具发送给 Trae。

**当前不是可直接全量追加的正式附录。** 既有规则确认与受阻新增结构必须分开；P1～P4 尚未闭合，Trae 不应把候选结构、可选锁或未冻结方法列作 Implemented。

## 历史冻结名补登与职责澄清

| 名称 | 语义 | 状态/依据 |
|---|---|---|
| WorldRegistry | 本设备内、本账号世界 ID 与登记位置的复制检测表，不是世界目录 | 既有 VERDICT-014；机制未实现 |
| DuplicateWorld | 本地/跨设备确认复制后的加载资格状态 | 既有 VERDICT-014/047 |
| WorldFork | 新 ID 分叉操作；B2.3 本机入口已实现，跨设备入口未实现 | 既有 VERDICT-014/271～285 |
| WorldHomeRegistry | AuthService 的 account×world→HomeDevice 轻量权威登记 | 既有 VERDICT-047 补登；P1 前置受阻 |
| HomeDevice | 世界当前归属设备，与 WorldDeveloper/账号所有权不同 | 既有 VERDICT-047/053 补登 |
| HomeState | Homed / Released；暂停等待期仍 Homed，另有 RealityPause | 既有 VERDICT-053，经 059 修订 |
| CrossDeviceDuplicate | 跨设备复制检测结果，随后映射 DuplicateWorld 并按权限分叉 | 既有 VERDICT-047 补登 |
| WorldMigration | 同账号同世界 ID 的设备归属转移，不要求 CopyPermission | 既有 VERDICT-053 |
| MigrationRelease / MigrationClaim | 服务授权的迁移释放/认领；前者启动账号暂停，到期才 Released，再在线 Claim | 历史名保留，新增接口结构待 P2/P3 |
| Migrated | 源设备知道已迁走后的加载资格/叙事状态，“去往别处”；不写源 Core/删除墓碑 | 既有 VERDICT-053 补登 |
| RealityPause | 全账号、全设备、全世界暂停；服务器时间；≥OfflineGrace；发起设备不可切账号 | 既有 VERDICT-059；执行机制 P2 受阻 |
| OfflineGrace / SafePoint | 最后成功联系 AuthService 后按设备开机累计运行时长，一小时，安全点暂停、不打断演奏 | 既有 VERDICT-024；时钟与排空 P2 受阻 |
| FileCarryPayload | 可读取的 WorldChangeLog+WorldCheckpoint 共享层，加发送者本人全部个人层；本人层及媒体按账号独立加密 | 既有 VERDICT-046 补登；完整 schema P4 受阻 |
| AuthService / CommitRelay | 登录轻量服务与 WorldCommit 中继；不作世界/个人层云端备份 | 既有 VERDICT-020/024 |

## 可确认的既有方法与 key 名

- `AuthService.fetchServerTime(): Promise<number>`：沿用 ROUND-09/11 的逐字签名；返回服务器 epochMs，与 WallClock.epochMs 同口径。不能改成 Promise<WallClock> 或以本机时钟降级。归档接口是命名证据，不恢复它的实现。
- 归档 `AuthService.login():void / logout():void / verify():boolean`、`CommitRelay.relay(commit:WorldCommit):void`、`OfflineGrace.startTiming():void / checkGrace():boolean` 是历史骨架签名。本轮不修改其签名、不当作真实认证/网络/离线能力。未来异步认证与中继结果应另设端口或经裁定版本化，不能同名静默替换。
- `neurou-world-home-registry-v1:<encodeURIComponent(accountId)>`：本地归属缓存/服务 receipt，不是全球真源。
- `neurou-reality-pause-v1:<encodeURIComponent(accountId)>`：本地账号暂停缓存；不能代替设备跨账号绑定。
- `neurou-migration-v1:<encodeURIComponent(accountId)>`：本地可恢复迁移日志。
- 以上 key 仅前缀和角色确认，内部 schema 待解冻；本轮不实际写 key。七项 Core 主 key、世界锁、目录 key/锁、fork journal、账号记录 key 均保持。

## 本轮新结构候选（全部 Proposed，不可直接落实现）

| 候选名称 | 放置建议/职责 | 前置 |
|---|---|---|
| WorldHomeRecord / WorldHomeRegistrySnapshot | director 的数据契约；账号归属记录与本地快照 | P1/P3 |
| WorldRegistrySnapshot | director 的数据契约；本机位置登记读取面 | P1/位置载体冻结 |
| RealityPauseRecord / DeviceAccountBinding | director 的数据契约；服务暂停事实与发起设备绑定证据 | P2 |
| DeviceUptimeSample / OfflineGrant | director 的注入契约；可信开机时间与离线资格 | P2，不能用纯本地缓存制造授权 |
| MigrationReleaseRequest / MigrationClaimRequest / MigrationReceipt / WorldMigrationJournal | director 的数据契约；服务幂等请求与本地恢复，不是 WorldForkPlan | P2/P3/P4 |
| CrossDeviceImportRequest / CrossDeviceDuplicateResult | director 的数据契约；可信文件导入与检测结果，不含玩家提供的权限/向量 | P1/P4 |
| CrossDeviceAuthorityPort / DeviceUptimePort / AccountBindingPort | 组合根注入纯逻辑的能力；测试与真实适配显式区分 | P1/P2/P3；认证/设备信任尚未实装 |
| FileCarryEnvelope / FileCarryPersonalLayer / EncryptedPersonalLayer / FileCarryArtifact / FileCarryCodecPort | 共享层可读外壳、独立账号加密个人完整载体、序列化/认证端口 | P4；共享 codec/媒体类别/加密 suite 未冻结 |
| CrossDeviceCommitRelayPort | 独立异步中继契约候选，避免修改旧 relay:void | WorldCommit 载体与真实服务后续冻结；迁移不经它 |

契约草案中所有新字段、方法与字面量都属于候选范围，详见 `contracts-draft.md`，不以“直译字段”绕过前置裁定。`DeviceId`/凭据结构不在现有名库，草案暂用 string 表示待认证 ID，不宣布已有正式设备标识。

## 明确不冻结为事实

- 旧 InitialWorld 的全局身份、全部世界已登记、跨设备接口 Implemented。
- `HomeState.Pausing`、WorldClearRecord 进入 Core、迁移刷新 FormatTime、迁移新增 forkOrigin。
- 用 deletedAt/删除 GC 处理 Migrated；复用 fork 的 revision=0 删除回滚处理迁移。
- “RealityPause 一小时保证离线设备都已停”“本地倒计时可解冻”“服务 fencing 单独阻止离线本地推进”。
- 把七项 Core/运行时品牌当整个 FileCarry；归档空共享类型当有效载体；虚构空共享层。
- 新 service/sync 模块或依赖矩阵方向、真实外部部署、AccessCode/ObserverSync 实装。

## 随正式附录保留的不变式

INV-10/12/13；七项同一主 key；Complete 重新验证、Restored 真实发布；活动 UnsupportedBoundary；持世界 lease 才写、无 Web Locks 拒绝；B2.3 源→新目标→目录锁；本地目录追加唯一发布点；RealityPause≥OfflineGrace（不代替排空证明）。正式迁移全局提交解释须等 P3，不能在附录里提前消解该冲突。
