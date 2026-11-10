# 名库 v3.16 最终附录提案 · 交 Trae 落盘

2026-10-11（Asia/Shanghai）。对应 VERDICT-376～390，补充上一轮356～375。本文是本轮交付材料，**不直接修改正式名库、docs或参照**。P1/P2已闭合，b新增名称可按下表落盘；c/d/e内部结构仍候选，不能合并成已实施契约。旧a附录的“P1～P6全部待裁、b停止”仅为历史状态。

## 已冻结并用于b源码

| 逐字名称 | 归属/职责 | 冻结范围 |
|---|---|---|
| RealServiceMode / ExternalService | director纯数据类型/唯一真实mode字面值 | 不扩旧ContractAdapter联合，不冒用旧标签 |
| RegisteredDeviceAssurance / RegisteredCredential | Web凭据持有保证 | 不含PhysicalDevice |
| ServicePublicKey | EC/P-256公开JWK四字段 | kty/crv/x/y，不带私钥或可执行值 |
| AuthorityTrustAnchor | 带外安装的keyId/publicKeyJwk/jwkSha256 | RFC7638 SHA-256无填充base64url；取代旧a候选的hex编码 |
| RealServiceEnvironment | mode/serviceInstanceId/apiOrigin/authorityTrustAnchor | 不来自FileCarry；不含storageDomain或fixture配置 |
| RealAccountFact | accountId/accountName身份 | 不含通关、CopyPermission或其他游戏事实 |
| RealRegisteredDeviceFact | deviceId/generation/keyFingerprint/assurance/label/status | 注册ID属于凭据；b世代为1，status允许Active/Revoked而无客户端撤销API |
| AuthenticatedServiceContext | 服务验证的账号/设备/会话/过期/实例投影 | 普通JSON快照不是世界准入能力或物理品牌 |
| AccountLoginRequest | accountName/password/deviceLabel短暂输入 | 不持久化密码 |
| ServiceFault / ServiceReply | 明确拒绝/Accepted结果 | 九类客户端错误；无失败fixture fallback |
| ServiceReceiptPurpose | 六种receipt用途 | DeviceChallenge/Authentication/Logout/ServerTime/AccountFacts/DeviceFacts |
| SignedServiceReceipt | schemaVersion/instance/purpose/receiptId/keyId/issuedAt/payload/signature | ES256(P1363)，nonce在各payload内绑定 |
| DeviceChallenge | 一次LoginDevice/RegisterDevice挑战 | 服务nonce、账号、公钥指纹、设备ID/世代、到期、实例及请求nonce |
| ServiceAuthenticationPayload | 会话/CSRF/身份/过期签名载荷 | 不含访问或刷新token，token只在HttpOnly cookie中 |
| ServerTimeSample | 已验收Trusted时间投影 | serverEpochMs/clockGeneration/clockStatus/requestNonce；服务器wire也可为Untrusted，adapter拒绝投影 |
| RealAccountFacts | 本人身份、设备列表、requestNonce、revision | revision固定0，不是世界revision或CAS |
| RealAuthServicePort | 新异步真实认证端口 | login/logout/verify/refresh/fetchServerTime/readServerTime/readAccountFacts |
| RealAuthServiceAdapter | presentation网络/WebCrypto适配 | 同源、pinning、内存凭据；forLoopbackHttpTest仅实测传输入口 |
| buildRealAuthService / RealServiceBuilder | assets独立组合函数/源文件 | 新真实链装配，不改旧场景/UI/WorldFolderBuilder |

RealServiceContracts为新增director文件名；IntentPort只追加上述类型的type-only导出。server独立包内的ServiceConfig、ReceiptSigner、AuthenticationFact、AccountIdentity、RegisteredDeviceFact、AccountFacts、P256PublicJwk等是内部镜像/实现名称，不另造游戏层名义权威。API、签名字节及错误集合见本目录contracts-and-security.md；完整字段以源码为准。

## 已冻结端口边界，内部schema仍待补冻

| 名称 | 现在允许 | 未批准实施 |
|---|---|---|
| RealWorldAuthorityPort | ExternalService、context、只读轻量readAccountFacts的保留接口 | 归属/暂停/release/claim/drain完整结构；没有readMigrationPayload |
| RealCommitRelayPort | 泛型异步relay边界，真实mode | WorldCommit实际wire schema、成员准入、cursor/长轮询、共享日志 |

这两个port在源码只有类型定义，没有实现；并不把b认证适配器当世界权威。旧同步AuthService.login/logout/verify、CommitRelay.relay原样保留。旧名fetchServerTime继续逐字使用，新真实端口返回Promise<number>，失败拒绝。

## 候选名称：不进已实施冻结表

| 阶段 | 候选名称/结构 | 必须先完成 |
|---|---|---|
| c/P3 | WorldCommitIdentity、RelayCommitEnvelope、RelayCursor、RelayPullReply、WorldRelayKey、WrappedRelayDataKey | AppendedAt与同序冲突、三类正文精确字段、多设备作者序号/离线段、开发者权限、成员与密钥交接、TraceTouch、检查点覆盖/迟到、有界延迟 |
| d/P2/P4 | DrainChallenge、SignedDrainStatement、RealDrainAcceptance、RealMigrationReleaseRequest/ClaimRequest/Receipt | 源本地live drain消费和持锁至release、服务一次challenge/摘要/凭据签名、纯轻量幂等/恢复结构 |
| d/P3/P4 | FileCarryEnvelope、FileCarryPersonalLayer、FileCarryArtifact、EncryptedPersonalLayer、EncryptedMediaEntry、WrappedAccountDataKey、AccountKey、AccountRecoverySecret | 完整共享codec、媒体实字节、账号加密suite与密钥恢复、异步加密耐久提交、旧明文一次迁移 |
| e/P5 | DeviceAssurance、DeviceUptimeSample、DeviceUptimePort、OfflineGrant、PhysicalDevice、bootId | 批准的原生host/硬件attestation、TPM/清安装/重装/休眠边界、可信设备uptime和严格暂停绑定 |

沿用FileCarryPayload，不新增FullFileCarryPayload；CoreTransferPayload保持受限Core范围。历史ProcessedMomentImage保留，EntryVideo及NotCaptured的完整媒体结构仍待d前冻结。候选AES-256-GCM-HKDF-SHA256-v1不因b使用ES256而获得文件加密验收。AccessCode/ObserverSync没有在b或Relay保留接口中开放。

## 保留规则与Trae落盘顺序

不改旧key、锁、Core结构/版本、migration phase或B2.4 guard。INV-10/12/13、七项同主key、持lease/无Web Locks拒绝、目录追加唯一本地发布点、RealityPause≥OfflineGrace、源主动排空、发起设备账号绑定、VERDICT-046均继续。

Trae可先同步本轮正式376～390与b已冻结名称，并标记两个保留端口“边界冻结/机制未实施”；c/d/e候选放单独待裁表，完成各补冻轮后才转冻结。P6只追加TraeAuthorized归因，不改a raw FAIL或旧SHA记录。正式名库是否已由Trae落盘是外部待办，本轮没有代其修改。
