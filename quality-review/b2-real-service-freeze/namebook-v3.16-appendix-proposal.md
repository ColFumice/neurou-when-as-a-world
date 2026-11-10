# 名库 v3.16 附录提案 · 交 Trae 审阅

2026-10-11（Asia/Shanghai），对应VERDICT-356～375。当前正式名库已含v3.15；**本文仅提案，P1～P6待裁，不可作为已冻结v3.16合并**。Trae应在PROTOCOL闭合后按最终裁定筛选/逐字同步，本文不改docs/NAMEBOOK.md或规格/参照。

## 沿用并确认的历史名称

AuthService、CommitRelay、fetchServerTime、OfflineGrace、SafePoint、WorldCommit、AppendedAt、WorldChangeLog、WorldCheckpoint、SharedWorldState、SharingCriteria、TraceTouch、SettleHorizon、WorldDeveloper、AccessCode、FileCarryPayload、FileCarry、WorldHomeRegistry、WorldRegistry、HomeDevice、HomeState(Homed/Released)、WorldMigration、RealityPause。

保留B2.4全部结构/品牌：CoreTransferPayload/RestrictedCoreTransfer、RestrictedMigrationCorePayload/RestrictedMigrationCore、SafePointDrainConfirmation/Capability/Acceptance/Port、MigrationReleaseRequest/ClaimRequest、MigrationReceipt、RealityPauseRecord、DeviceAccountBinding、WorldMigrationJournal五phase、WorldStateSnapshot/Complete/Restored。InitialWorld排除跨设备登记保持。历史同步login/logout/verify/relay/startTiming/checkGrace签名不改。

## 新名称候选（不是当前实施冻结）

| 名称 | 归属/职责 | 状态/约束 |
|---|---|---|
| ServiceMode | 纯数据环境值ContractAdapter / ExternalService | P1；旧端口标签/旧receipt不改 |
| ServiceEnvironment | 服务实例、apiOrigin、storageDomain、pinning配置 | P1/P4；禁止文件提供origin或跨域凭据 |
| AuthorityTrustAnchor | ES256可信公钥/JWK与规范指纹 | P1；keyId标签不是公钥信任 |
| AuthenticatedServiceContext | 服务认证绑定的账号/设备/assurance/expiry | P1/P5；普通JSON不是授权品牌 |
| RealAuthServicePort | 新异步login/logout/verify/refresh、逐字fetchServerTime | P1；不覆写历史AuthService |
| AccountLoginRequest / DeviceAssertion | 短暂登录输入、一次challenge签名 | P1/P5；不持久秘密 |
| ServiceFault / ServiceReply | 明确成功/拒绝数据结果 | 候选错误集合见contracts-draft |
| ServerTimeSample / SignedServiceReceipt | nonce/clock世代、ES256服务声明 | P1；不是准入能力 |
| RealWorldAuthorityPort | 无payload的真实归属/迁移端口 | P1/P2；不提供readMigrationPayload |
| DrainChallenge / SignedDrainStatement | 30秒一次服务challenge + 源本地live能力消费后的声明 | P2/P5；不是远程Web Locks证明 |
| RealDrainAcceptance | 嵌入旧d受理及challenge/migration/payloadDigest绑定 | P2；不改旧SafePointDrainAcceptance |
| RealMigrationReleaseRequest / RealMigrationClaimRequest / RealMigrationReceipt | 请求/receipt绑定payloadDigest | P2；轻量数据、不携七项 |
| WorldCommitIdentity | authorAccountId + authorSequence全局身份 | P3；服务cursor不是这个序号 |
| RelayCommitEnvelope / WrappedRelayDataKey | 只有外壳、正文密文与DEK封装 | P3；不叫完整WorldCommit codec |
| RelayCursor / RelayPullReply / RealCommitRelayPort | POST submit/pull/ack、Batch/Gap、异步网络 | P3；客户端拉取，有限队列 |
| WorldRelayKey | 成员域随机群key/epoch | P3；与账号key分离，不从AccessCode派生 |
| FileCarryEnvelope | 可读共享条目+本人密文的单文件容器头 | P3/P4；完整内部schema未闭合 |
| FileCarryPersonalLayer / FileCarryArtifact | 本人结构化数据及媒体加密索引 | P4；截图/入场视频来源/元信息仍须补冻 |
| EncryptedPersonalLayer / EncryptedMediaEntry | 本人keyId/epoch、密文块索引 | P4；公开只有密文hash，私有索引保密 |
| WrappedAccountDataKey | 每对象新DEK的账号根封装 | P4；不是服务器明文key |
| AccountKey / AccountRecoverySecret | 随机账号根与本人线下恢复秘密 | P4；先登录/授权后解包，不等同账号密码 |
| DeviceAssurance | RegisteredCredential / PhysicalDevice | P5；WebAuthn不自动PhysicalDevice |
| DeviceUptimeSample / DeviceUptimePort | 可信host的bootId/uptime/includesSuspend | P5；不增加应用计时替代 |
| OfflineGrant | 签名预算/boot/账号设备/归属世代 | P5；缓存或time请求不签发 |

候选methods：RealAuthServicePort.login/logout/verify/refresh/readServerTime/fetchServerTime；RealWorldAuthorityPort.readWorldHome/createDrainChallenge/acceptDrain/releaseMigration/readMigration/claimMigration/readDeviceBinding；RealCommitRelayPort.submit/pull/acknowledge；DeviceUptimePort.readUptime。这些仅存在Markdown，不添加源码导出。最终全部字段与enum应以补冻后的完整契约为准，不能仅从本表抄方法名开始实现。

## 格式/枚举候选与拒绝

FileCarryEnvelope.kind=FileCarry、formatVersion=1候选，cipherSuite=AES-256-GCM-HKDF-SHA256-v1；ServiceFault候选Unauthenticated/DeviceUntrusted/AuthorityUnavailable/PauseActive/TimeUntrusted/VersionUnsupported/Conflict/RateLimited/InvalidData；RelayPullReply为Batch或Gap；三类外壳changeClass为MonotonicReveal/TraceTouch/DeveloperMapChange，**正文与SharedWorldState字段未冻结**。

FileCarryArtifact.kind仅使用历史ProcessedMomentImage及候选EntryVideo字面值；MomentImage是瞬时原图，不保存/携带，保持截图立即处理历史规则。它不是新媒体捕获实现名。个人媒体索引/元信息/NotCaptured结构未齐，不宣称上述类型已覆盖全部个人层。不新增FullFileCarryPayload，不把七项或CoreTransfer改名完整FileCarry，不把NarrativeEvent当WorldCommit，不使用Trace作为日志、Window作为界面、Event/Developer/Rain单字新类型。

## key、锁与模块边界

本轮不新增/改写任何key、锁、phase、Core.schemaVersion。旧ContractAdapter fixture key/锁冻结继续；ExternalService独立数据域的确切编码/迁移协议是P1/P4待裁，不先宣布新前缀。七项仍同逻辑主key；本地目录追加唯一发布点、服务归属是另一个权威点。

未来纯数据/验证仍director，通过IntentPort type-only导出窄边；presentation平台适配与assets/scripts装配，零cc逻辑保持。服务器独立server/包、可信原生host候选platform-host/包须正式准入及独立门禁，不恢复archive/service/sync，不新增未登记src模块。

## Trae落盘条件

先收到P1～P5最终裁定与补冻后的完整共享/加密存储/设备契约；P6来源另确认并保留raw差异。保留历史同步签名、046分层、024拉取/不透明正文；将当前“Proposal/Blocked”准确改为最终批准状态，未批准名称不进正式冻结表。不能把三门禁通过解释为这些候选类型已经编译或实现。
