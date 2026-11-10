# B2.5a 契约草案 · 数据结构与能力边界

2026-10-11（Asia/Shanghai）。**Proposal / Blocked，不是已完整冻结的生产契约。** 仅 Markdown 中的类型片段，无 `.ts`、实现、依赖、编译装配或存储写入。P1～P5 见 PROTOCOL-B2.5a-001；完整共享内部 schema 有明确缺口，本文不以空类型宣称 codec 完整。

通用约束：接口不可把用户 JSON 当认证；外部输入入口为 unknown，验证后才返回精确不可变 data-only 值。拒绝未知版本/字段、访问器/非数据属性、非法原型、重复 JSON 键、symbol、函数、循环、稀疏数组、非有限数、不安全整数、重复 ID、错身份/长度/摘要。网络所有 ID 从认证 context 交叉校验；失败保留源文件与原 journal。正文签名用规范 UTF-8/JCS，摘要 SHA-256 小写 hex，签名与 nonce 用无填充 base64url。时间毫秒均非负安全整数。

## 1. 环境与认证（P1/P5）

```ts
type ServiceMode = 'ContractAdapter' | 'ExternalService';
type DeviceAssurance = 'RegisteredCredential' | 'PhysicalDevice';

interface ServiceEnvironment {
  readonly mode: ServiceMode;
  readonly serviceInstanceId: string;
  readonly apiOrigin: string;       // 明确配置并固定，不从携入文件读取
  readonly storageDomainId: string;
  readonly authorityTrustAnchors: readonly AuthorityTrustAnchor[];
}
interface AuthorityTrustAnchor {
  readonly keyId: string;
  readonly publicKeyJwk: { readonly kty: 'EC'; readonly crv: 'P-256';
    readonly x: string; readonly y: string };
  readonly jwkSha256: string;      // 可信引导配置的规范公钥指纹
}
interface AuthenticatedServiceContext {
  readonly accountId: string;
  readonly deviceId: string;
  readonly deviceAssurance: DeviceAssurance;
  readonly deviceGeneration: number;
  readonly authenticationId: string;
  readonly expiresAtServerEpochMs: number;
  readonly serviceInstanceId: string;
}
interface AccountLoginRequest {
  readonly accountName: string;
  readonly password: string;       // 短暂输入，仅 TLS 登录调用，不序列化留存
  readonly deviceChallengeId: string;
  readonly deviceAssertion: DeviceAssertion;
}
interface DeviceAssertion {
  readonly deviceId: string;
  readonly generation: number;
  readonly challengeId: string;
  readonly signatureBase64Url: string;
}
interface ServiceFault {
  readonly code: 'Unauthenticated' | 'DeviceUntrusted' | 'AuthorityUnavailable'
    | 'PauseActive' | 'TimeUntrusted' | 'VersionUnsupported' | 'Conflict'
    | 'RateLimited' | 'InvalidData';
  readonly requestId: string;
  readonly retryAfterMs: number | null;
}
type ServiceReply<T> = { readonly kind: 'Accepted'; readonly value: T }
  | { readonly kind: 'Rejected'; readonly fault: ServiceFault };

interface RealAuthServicePort {
  readonly mode: 'ExternalService';
  login(request: AccountLoginRequest): Promise<ServiceReply<AuthenticatedServiceContext>>;
  logout(): Promise<ServiceReply<{ readonly serverRevoked: true }>>;
  verify(): Promise<ServiceReply<AuthenticatedServiceContext>>;
  refresh(): Promise<ServiceReply<AuthenticatedServiceContext>>;
  fetchServerTime(): Promise<number>;
  readServerTime(requestNonce: string): Promise<SignedServiceReceipt<ServerTimeSample>>;
}
interface ServerTimeSample {
  readonly serverEpochMs: number;
  readonly requestNonce: string;
  readonly clockGeneration: number;
  readonly clockStatus: 'Trusted';
}
interface SignedServiceReceipt<T> {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly purpose: 'ServerTime' | 'Authority' | 'Drain' | 'OfflineGrant' | 'Device';
  readonly receiptId: string;
  readonly keyId: string;
  readonly issuedAtServerEpochMs: number;
  readonly payload: T;
  readonly signatureBase64Url: string; // ES256，64 字节 P1363，不混用 DER
}
```

历史 AuthService/CommitRelay/OfflineGrace 原文件与同步签名原样保留在 archive。该 RealAuthServicePort 不宣称可直接赋给旧接口；fetchServerTime 从 readServerTime 校验结果投影，样本不授予准入。签名输入为 `UTF8("Neurou/service/v1\0") || UTF8(JCS(除 signature 字段外的全部 receipt))`，签名验证的目的/实例/keyId 必须精确匹配。服务器签名只证明被信任服务的声明，不证明其时钟永不出错。

AuthorityTrustAnchor由可信安装配置/操作者带外确认引导，不能从待验服务响应、FileCarry或自签公钥注册成信任根。正常轮换用既有可信key签发新公钥及有效期、重叠验证期；疑似根泄露必须带外更新。发送设备公钥/certificate链、离线历史签名有效期与撤销策略仍须P1/P3补冻，缺合法可信证据时拒绝认证，不只比较keyId。

网络路径提案：同 origin `/api/v1/auth/login|logout|verify|refresh`；`POST /api/v1/time` 带随机 requestNonce；密码及 session 绝不入 URL。注册、恢复与设备 challenge 是独立账号管理读写口，不从 world payload 提取身份。

## 2. 真实归属与迁移，服务器无 payload（P1/P2）

WorldHomeRecord、RealityPauseRecord、DeviceAccountBinding、MigrationReleaseRequest、MigrationClaimRequest、SafePointDrainConfirmation 沿用 d/b 的精确字段和语义。下列新端口只是推荐分离方式，不扩展旧 MigrationAuthorityPort 的 payload 方法，不创建真实 readMigrationPayload。

```ts
interface DrainChallenge {
  readonly challengeId: string;
  readonly nonceBase64Url: string;    // 32 字节随机
  readonly accountId: string;
  readonly sourceDeviceId: string;
  readonly migrationId: string;
  readonly expiresAtServerEpochMs: number;
}
interface SignedDrainStatement {
  readonly schemaVersion: 1;
  readonly challenge: DrainChallenge;
  readonly confirmation: SafePointDrainConfirmation; // 既有 d 载体
  readonly payloadDigest: string;
  readonly deviceGeneration: number;
  readonly signatureBase64Url: string;
}
interface RealMigrationReleaseRequest {
  readonly request: MigrationReleaseRequest;
  readonly payloadDigest: string;    // 完整候选文件规范摘要，不上传文件
  readonly drainReceiptId: string;
}
interface RealMigrationClaimRequest {
  readonly request: MigrationClaimRequest;
  readonly payloadDigest: string;
}
interface RealDrainAcceptance {
  readonly acceptance: SafePointDrainAcceptance; // 旧d字段原样嵌入
  readonly challengeId: string;
  readonly migrationId: string;
  readonly payloadDigest: string;
}
interface RealMigrationReceipt {
  readonly schemaVersion: 1;
  readonly migrationId: string;
  readonly accountId: string;
  readonly worldId: string;
  readonly sourceDeviceId: string;
  readonly claimDeviceId: string | null;
  readonly expectedHomeRevision: number;
  readonly payloadDigest: string;
  readonly record: WorldHomeRecord;
  readonly pause: RealityPauseRecord;
  readonly kind: 'PauseActive' | 'Released' | 'Claimed';
}
interface RealWorldAuthorityPort {
  readonly mode: 'ExternalService';
  readonly context: AuthenticatedServiceContext;
  readWorldHome(worldId: string): Promise<ServiceReply<SignedServiceReceipt<WorldHomeRecord>>>;
  createDrainChallenge(migrationId: string): Promise<ServiceReply<SignedServiceReceipt<DrainChallenge>>>;
  acceptDrain(statement: SignedDrainStatement): Promise<ServiceReply<SignedServiceReceipt<RealDrainAcceptance>>>;
  releaseMigration(request: RealMigrationReleaseRequest): Promise<ServiceReply<SignedServiceReceipt<RealMigrationReceipt>>>;
  readMigration(migrationId: string): Promise<ServiceReply<SignedServiceReceipt<RealMigrationReceipt>>>;
  claimMigration(request: RealMigrationClaimRequest): Promise<ServiceReply<SignedServiceReceipt<RealMigrationReceipt>>>;
  readDeviceBinding(): Promise<ServiceReply<SignedServiceReceipt<DeviceAccountBinding>>>;
}
```

注册世界/准入/账号事实读口也必须由认证 context 绑定，沿用原 CAS、幂等 ID 和不可变来源认证；其真实 wire 在 P1 的最小接线清单补齐，本文不把以上迁移子集宣称全 authority API。服务轻量 receipt 不包含 state、record 内容资源、Ledger 或个人数据。payloadDigest 需要绑定 source worldId/revision 和完整候选，不能用 UI 摘要或未认证输入。

本机流程：关闭新准入→真实 leases/账号事实排空→拿 live capability→获取 challenge→本地 assertCurrent→签名/acceptDrain→assertCurrent→release→回读同 migration/摘要 receipt；源能力/锁到 release 完成才释放。challenge/acceptance 最大 30 秒服务时间，过期不得用旧确认续命。首个有效 release 原子消费 drainId，启动暂停与发起绑定，重复相同幂等请求返回同 receipt，异摘要拒绝。Claim 与摘要、世界、homeRevision、目标设备绑定。

目标文件由用户携入，先完整 codec/本人解密/正式内容认证，再取得 Claim；服务 Claim 与本地目录是两个提交域。Claim 后本地失败保留恢复证据，不反向撤销权威或删除已发布世界。没有足够源确认/文件时拒绝，不因账号重新登录制造源数据。

## 3. Relay wire 外壳（P3；正文 schema 尚未冻结）

```ts
interface WorldCommitIdentity {
  readonly authorAccountId: string;
  readonly authorSequence: number; // 非负安全整数，作者账号全局唯一序号
}
interface RelayCommitEnvelope {
  readonly schemaVersion: 1;
  readonly kind: 'RelayWorldCommit';
  readonly worldId: string;
  readonly commitIdentity: WorldCommitIdentity;
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly membershipRevision: number;
  readonly keyEpoch: number;
  readonly changeClass: 'MonotonicReveal' | 'TraceTouch' | 'DeveloperMapChange';
  readonly cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1';
  readonly wrappedCommitDataKey: WrappedRelayDataKey;
  readonly nonceBase64Url: string;
  readonly ciphertextAndTagBase64Url: string;
  readonly authorSignatureBase64Url: string;
}
interface WrappedRelayDataKey {
  readonly wrapId: string;
  readonly nonceBase64Url: string;
  readonly ciphertextAndTagBase64Url: string;
}
interface RelayCursor {
  readonly relayGeneration: number;
  readonly cursor: string;  // 服务不透明分页 cursor，不是作者序号
}
type RelayPullReply = { readonly kind: 'Batch'; readonly next: RelayCursor;
  readonly commits: readonly RelayCommitEnvelope[] }
  | { readonly kind: 'Gap'; readonly next: RelayCursor };
interface RealCommitRelayPort {
  readonly mode: 'ExternalService';
  submit(commit: RelayCommitEnvelope): Promise<ServiceReply<RelayCursor>>;
  pull(worldId: string, after: RelayCursor | null, maximumWaitMs: number): Promise<ServiceReply<RelayPullReply>>;
  acknowledge(worldId: string, durableThrough: RelayCursor): Promise<ServiceReply<RelayCursor>>;
}
```

主协议：POST `/api/v1/relay/commit|pull|ack`；pull 可等待≤25,000ms，最多256条且总响应≤1MiB；一条密文外壳≤64KiB。账号由会话核对 commitIdentity，服务验作者签名、成员准入、外层 changeClass 的开发者资格；接收端核对解密正文和 changeClass 一致、世界与作者一致，再正式 schema 校验。身份与相同规范密文摘要幂等；同身份异内容 Conflict 并保留诊断。作者签名私钥泄露不能被群加密掩盖。

以上RelayCommitEnvelope**还缺中继可见的外层AppendedAt精确载体**：024要求中继可见提交时间，不能只放密文内；该值须与正文相同、受作者签名与AEAD绑定，时间来源/离线证明是P3补冻项。当前片段因此不是完整wire。保留期必须满足 `retention >= SettleHorizon >= OfflineGrace + boundedRelayDelay`；24h仅在此不等式经配置校验后可用。

作者多设备/离线自序号推荐服务器分配互不重叠的有限段；本机原子耐久递增，耗尽停止共享提交，新登记设备不复用段。序号段、AppendedAt 真实性/离线来源、settlement 与同序不同内容处置均待 P3，不在客户端猜时间。

WorldCommit 的**密文内精确正文**、SharedWorldState、WorldChangeLogWire、WorldCheckpointWire 暂未给出可实施定义：尚缺共享实体/地图/Trigger 稳定 ID、允许变化的值结构与版本、AppendedAt、检查点覆盖边界/迟到证明与来源认证。不能把这个 Relay 外壳当完整 WorldCommit codec。

## 4. 完整 FileCarry 外层与分层（P3/P4）

继续使用 FileCarryPayload 表示完整语义，FileCarryEnvelope 表示可交付格式。不同于 `CoreTransferPayload.kind=RestrictedCoreTransfer` 与 `RestrictedMigrationCorePayload.kind=RestrictedMigrationCore`，拒绝互相换 kind。共享为可读规范 JSON；个人数据与媒体独立加密。禁止把整包加密给发送者导致共享不可读。

推荐单文件 ZIP64 **STORE 模式**（不压缩、不执行、无外链），目录项只有 manifest.json、shared.json、personal/下的不透明 entry ID；拒绝重复路径、大小写碰撞、绝对路径、反斜杠、点目录、symlink、加密 ZIP、自解压、多磁盘与未知项。所有条目先在隔离 staging 校验，不直接解包到用户路径；流式读写。最大2GiB、4096条目，共享/个人 JSON 各≤16MiB，单媒体≤512MiB，分块≤4MiB。限额是本轮候选，不能据此证明现有生产媒体已兼容。

逻辑entryId唯一，物理密文分块以 `(entryId,chunkIndex)` 唯一，路径为 `personal/<entryId>/<chunkIndex>.bin`；同一entry内chunkCount一致、index连续。Artifact.entryIds引用逻辑entry且不能交叉归属；本人JSON为独立逻辑entry。摘要/签名中的顺序按entryId规范字节序、chunkIndex数值序确定，不用locale排序。nonce由格式唯一计划计算，不需每块额外传nonce。

```ts
interface EncryptedPersonalLayer {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly keyId: string;
  readonly keyEpoch: number;
  readonly cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1';
  readonly wrappedDataKey: WrappedAccountDataKey;
  readonly entries: readonly EncryptedMediaEntry[];
}
interface WrappedAccountDataKey {
  readonly wrapId: string;
  readonly nonceBase64Url: string;
  readonly ciphertextAndTagBase64Url: string;
}
interface EncryptedMediaEntry {
  readonly entryId: string;
  readonly chunkIndex: number;
  readonly chunkCount: number;
  readonly byteLength: number;       // 密文字节含16-byte tag
  readonly ciphertextSha256: string;
}
interface FileCarryEnvelope {
  readonly schemaVersion: 1;
  readonly formatVersion: 1;
  readonly kind: 'FileCarry';
  readonly serviceInstanceId: string;
  readonly exportId: string;
  readonly worldId: string;
  readonly senderAccountId: string;
  readonly sharedDigest: string;     // SHA256(shared.json规范字节)
  readonly encryptedPersonalLayer: EncryptedPersonalLayer;
  readonly senderDeviceId: string;
  readonly senderDeviceGeneration: number;
  readonly senderSigningKeyId: string;
  readonly envelopeDigest: string;
  readonly senderSignatureBase64Url: string;
}
interface FileCarryArtifact {
  readonly artifactId: string;
  readonly kind: 'ProcessedMomentImage' | 'EntryVideo';
  readonly mediaType: 'image/png' | 'image/jpeg' | 'video/mp4' | 'video/webm';
  readonly byteLength: number;       // 明文字节，位于本人密文索引
  readonly contentSha256: string;
  readonly entryIds: readonly string[];
}
interface FileCarryPersonalLayer {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly sections: {
    readonly Ledger: LedgerSnapshot;
    readonly PuzzleProgress: readonly PuzzleProgressSnapshot[];
    readonly RecallCount: RecallCountSnapshot;
    readonly ChartSnapshot: ChartSnapshotCollection;
    readonly ChartScore: ChartScoreSnapshot;
  };
  readonly artifacts: readonly FileCarryArtifact[];
  // 截图 MomentInfo/后处理参数、视频采集归属与NotCaptured清单须P4补冻；
  // 这里不是“全部个人层”最终完整类型，不能据此签发完整载荷。
}
```

本类型片段故意不声明可实施 FileCarryPayload.sharedLayer 的内部类型，也不以 `any`、`{}` 或任意 JSON 填满。完整 FileCarryPayload 的精确结构/codec 必须在 P3/P4 补冻后才准入；以上 Envelope/Artifact 是容器候选。截图仅携实际保存的ProcessedMomentImage像素、合法元信息/缩略图，MomentImage是立即处理后丢弃的瞬时输入，不保存/恢复/携带原图（NAMEBOOK:129）。保存的本人入场视频也在个人密文内；ChartSnapshot/Score是结构化JSON，不误称视频。官方音视频可以严格内容hash/version引用且接收端正式内容验证，个人字节不能外部URL代替。

Core 组装候选映射：本人五项来自本人解密载体，FormatTime/WorldLink 来自仍须补冻的世界元数据区；不能把整个 Core 放个人层改写所有权，不能把个人 section 放 shared.json。保持 Core 头、世界类型、forkOrigin、revision/capturedAt 与既有正式认证约束；跨账号收到他人个人密文只能原样保留，不能用对方数据 hydrate 自己或以零值补 Complete。转发保留合法共享来源、移除上一发送者密文，加入当前本人层。

认证分两条路径：共享接收先隔离读入→容器/限额→规范共享字节摘要/共享来源→发送者签名/包摘要，其他账号可读/验证合法共享层并原样保留他人密文；不解密他人层、不据此签发个人Complete。同账号完整恢复在上述基础上要求本人身份匹配且已登录的key capability→全部本人AEAD/媒体hash→分层组装→WorldStateCodec.parseComplete与正式内容重新绑定→正常导入/迁移准备。Complete运行时品牌仍接收端生成；Restored还要求正式对象图与唯一输入/driver发布。hash、签名和decrypt成功不能直接授予CopyPermission/通关/归属；跨账号生产加入路径仍需P3准入契约，不能仅因共享可读就开新玩法。

## 5. 平台时间与离线资格（P5）

```ts
interface DeviceUptimeSample {
  readonly bootId: string;
  readonly uptimeMs: number;
  readonly source: 'TrustedNativeHost';
  readonly includesSuspend: true;
}
interface DeviceUptimePort {
  readUptime(): Promise<ServiceReply<DeviceUptimeSample>>;
}
interface OfflineGrant {
  readonly schemaVersion: 1;
  readonly authorizationId: string;
  readonly serviceInstanceId: string;
  readonly accountId: string;
  readonly deviceId: string;
  readonly deviceGeneration: number;
  readonly bootId: string;
  readonly contactedAtUptimeMs: number;
  readonly contactedAtServerEpochMs: number;
  readonly graceDurationMs: number;
  readonly authorizationGeneration: number;
  readonly homeRevisions: readonly { readonly worldId: string; readonly homeRevision: number }[];
}
```

grant 是 SignedServiceReceipt<OfflineGrant> 验证结果，不由客户端自行创建。成功认证联系并确认归属/无活动暂停后才可授予，单纯 time/ping/网络恢复不是续期。引导服务将可信 host challenge 所绑定 boot/uptime 与同一账号设备确认；签名不让普通客户端上报变可信。最后成功请求采样必须扣除网络往返耗时（使用请求前可信 uptime 作预算基点，不以响应后采样增加宽限）。同 boot 内 `0 <= nowUptime-contactedAtUptime < graceDuration` 才有效；达到阈值关闭新准入并自然 drain；重启、倒退、host失联、签名/设备世代/服务实例不符拒绝。

当前graceDurationMs必须等于 `OFFLINE_GRACE_HOURS * 3600000 = 3600000`，拒绝超长或不一致值，即使签名合法也不启用。未来配置变更需正式改裁且同步提高RealityPause下界。引入bootId、跨boot拒绝与includesSuspend是本轮平台提案，并非声称历史已有这些字段。

Web 返回 DeviceUntrusted，不产生 pseudo bootId 或应用计时 grant。grant 不让 InitialWorld 成为全球登记实例，账号暂停/源排空仍包括它；不能声称在完全离线时瞬间知晓服务器撤销，最长延迟由有效预算与已批准源主动排空限定。

## 6. 加密存储端口必须单独补冻（P4）

真实生产层需“异步密文准备→有效 lease/expected 复验→耐久提交/回读→本地目录发布”，所有个人 journal/暂存同保护；主 key逻辑身份、七项/品牌/目录发布规则不变。尚未冻结的部分包括同步 JSON 视图与原密文字节 CAS 的关系、旧明文迁移、存储世代/加密 nonce 预分配、跨窗口 key 生命周期、崩溃恢复、容量/GC及清理失败。

因此本文**不伪造一个 setItem:void 加密 facade 或可直接替换的完整 storage port**。后续先补精确准备/提交/恢复契约，再判断哪些最小适配文件获 P1/P4 授权；禁止后台加密未完成就返回保存/Published。
