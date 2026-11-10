# B2.5c-2a HTTP / 端口冻结契约

日期：2026-10-11（Asia/Shanghai）。本轮纯文档，不创建源码、路由或迁移。状态：用户P7/P8/P9已正式采纳；以下按VERDICT-426～440冻结为c-2在线原型实施契约，**文档冻结不表示代码已存在或获得本轮实施授权**。P3/c-1 的54种共享schema、签名/AAD字节、identity、policy和reducer语义不修改。本文接口/路由/值域均正式冻结；审计推荐与正文不一致时，以正式裁定及本文为准。未列扩展不得由实现自由猜测。

## 1. 端口选择与层级

保留 RealWorldAuthorityPort 现有 mode/context/readAccountFacts；新 RealWorldAuthorityProtocolPort 组合继承，只为c-2批准的轻量事实增加方法。保留 RealCommitRelayPort<TWorldCommit,TRelayReceipt>.relay；新 RealCommitRelayProtocolPort 继承其 AdmittedWorldCommit/RelaySubmitReceipt 实例并增加 submit/pull/acknowledge。relay(commit)严格转同submit路径，无弱校验路径。真实 mode 逐字 ExternalService。

冻结方法集合（表中P3 mutation结果在HTTP上统一包入§6的AuthorityResult signed wrapper，内层receipt保持原字节）：

| 端口 | 方法 | 输入 / 结果 |
|---|---|---|
| authority兼容面 | readAccountFacts | b原有 ServiceReply<SignedServiceReceipt<RealAccountFacts>>，不扩为world/归属/迁移载荷 |
| shared权威 | readServiceStatus | 32-byte requestNonce → SharedTransportReceipt（SharedServiceStatus）；只建立clock generation/policy/服务身份信任 |
| shared权威 | registerWorld | 获操作员带外批准的world/map/root/Genesis/manifest摘要绑定+根/注册设备签名 → SharedTransportReceipt<WorldRegistrationProposal> |
| shared权威 | readWorldFacts | worldId/nonce → 公共root摘要、当前epoch/policy/seal/准入轻量事实；无state/包/个人层 |
| shared权威 | requestCredentialChallenge / registerAgreementCredential | 目标独立ECDH公钥与当前设备 → 服务一次possession challenge；持有证明+设备签名 → 公共绑定receipt |
| shared权威 | setAccessCode / requestObserverChallenge / redeemObserverChallenge | P9已批准的最小协议；正确六位码自动 WorldObserver，key交付独立 |
| shared权威 | publishMembershipEpoch | WorldMembershipChange+注册设备签名；根已签proposal、CAS及既有资格 → SharedAuthorityReceipt<WorldMembershipEpoch> |
| shared权威 | readMembershipEpoch | worldId/epoch/nonce → 原签名epoch或FactUnavailable；只给获批准历史读取资格的成员 |
| shared权威 | allocateSegment | worldId/currentEpoch/nonce → SharedAuthorityReceipt<AuthorSequenceSegment>；账号/设备从会话取 |
| shared权威 | issueAppendPermit | worldId/identity/segmentId/epoch/keyEpoch/changeClass/nonce → SharedAuthorityReceipt<WorldAppendPermit>；无客户端时间 |
| shared权威 | admitCommit | SignedWorldCommitAdmissionClaim + 原permit/segment receipts → admission或已签rejection；禁止envelope/body字段 |
| shared权威 | readAdmission | worldId/identity/envelopeSha256/nonce → 原accepted/rejection receipt；不签新accepted，不接受payload |
| shared权威 | sealPrefix | worldId/cutoff/expectedPreviousSealSha256/nonce → SharedAuthorityReceipt<RelaySettlementSeal>，服务计算count/prefix |
| Relay | submit / relay | 完整 AdmittedWorldCommit + nonce → RelaySubmitReceipt，已有同identity/digest返原位置 |
| Relay | pull | worldId/after/maximumCount/maximumWaitMs/nonce → 签名wrapper内的既有 RelayPullReply |
| Relay | acknowledge | worldId/世代+每项position/identity/digest+nonce → RelayAckReceipt；注册设备签名绑定batch |

没有 readMigrationPayload、HomeDevice归属写、迁移/暂停/CopyPermission、WorldRegistry本机位置、账号注销、根转让、产品ObserverSync方法。WorldDeveloperClosureFact在本轮真实链恒null；c-1已有closure验真/replay规则保持。

类型承载 src/director/SharedServiceProtocolContracts.ts；仅接口、数据与type-only窄capability。协议纯逻辑编排 src/director/SharedRelayPrototype.ts、WorldRelayKeyDelivery.ts；只注入平台/crypto/耐久能力，不使用cc/DOM/网络/Node。平台实现 src/presentation/RealWorldAuthorityAdapter.ts、RealCommitRelayAdapter.ts，以及P7已批准的 RealSharedServiceSessionAdapter.ts、SharedCryptoAdapter.ts、SharedRelayDurableCache.ts。组合根 assets/scripts/SharedRelayPrototypeBuilder.ts；保留原 RealServiceBuilder，避免误接旧boot链。

presentation 到 director 只有通过 IntentPort 的type-only导入；不直接value import五个c-1类。assets组合根可以组装director内核与presentation能力。新增未来SharedServiceProtocolContracts类型仅追加IntentPort type-only，旧runtime字节保持。server为独立Node包，未来通过只读构建输入编译同一纯schema/codecs，不复制宽松schema旁门、不把Node源码导入Cocos树。

## 2. HTTP outer wire

所有业务路由POST exact application/json、request body为canonical JCS安全整数子集；拒重复键、多余/缺失字段、未知版本/suite、非法Unicode、unsafe/negative-zero数字。显式null不得省略。所有输入先unknown验证；旧b auth请求及16KiB限制不改。

```ts
interface SharedHttpRequest<T> {
  readonly schemaVersion: 1;
  readonly requestNonce: string; // 32 random bytes canonical base64url
  readonly payload: T;
  readonly authorization: SharedOperationAuthorization | null;
}
type SharedHttpReply<T> =
  { readonly kind: 'Accepted'; readonly value: T } |
  { readonly kind: 'Rejected'; readonly fault: SharedServiceFault };
interface SharedServiceFault {
  readonly code: 'Unauthenticated' | 'DeviceUntrusted' | 'AuthorityUnavailable'
    | 'TimeUntrusted' | 'VersionUnsupported' | 'Conflict' | 'RateLimited'
    | 'InvalidData' | 'Forbidden'; // 沿用b粗分类，不改b接口
  readonly layer: 'Authority' | 'Relay' | 'Session';
  readonly detail: SharedServiceErrorCode;
  readonly requestId: string; // opaque correlation id, never a credential
  readonly requestNonce: string | null; // null仅未能安全解析请求时
  readonly retryAfterMs: number | null;
}
```

Rejected fault只是传输/业务错误，不授 TimeTooLate/InvalidChange/Orphan 等终局事实。需要终局拒绝证明时必须返回并验真P3 SharedAuthorityReceipt<WorldCommitRejection>；不能拿HTTP409或本地超时生成个人事件。旧auth路由仍返回原ServiceFault，Session owner按旧协议解析。

Relay/注册/状态成功的signed wrapper不扩P3 SharedAuthorityReceipt.purpose：

```ts
interface SharedTransportReceipt<T> {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly purpose: 'SharedServiceStatus' | 'WorldRegistration' | 'WorldFacts'
    | 'AgreementCredentialChallenge' | 'AgreementCredential'
    | 'AccessCodeUpdated' | 'ObserverChallenge' | 'AuthorityResult'
    | 'MembershipRead' | 'AdmissionRead' | 'RelaySubmit' | 'RelayPull' | 'RelayAck';
  readonly receiptId: string;
  readonly requestNonce: string;
  readonly keyId: string;
  readonly payload: T;
  readonly signatureBase64Url: string; // ES256/P1363 64-byte
}
```

签名域 Neurou/shared-transport/v1\0，覆盖除signatureBase64Url外全部字段；purpose/nonce/实例/pin精确匹配。该wrapper只证明服务响应来源，不替代内层permit/epoch/admission/seal或正文验真。状态payload单独含clockGeneration、clockStatus、serverEpochMs:number|null、lastSignedEpochMs:number|null、policy和policySha256；Untrusted时serverEpochMs必须null。外层不自报可信时间。Trusted样本经过生产clock闸门；历史原receipt可重取但不是当前可信sample。

所有SharedTransportReceipt的requestNonce与当前请求outer nonce相同；本次**新产生**的P3事实receipt也匹配该nonce。内层本次WorldMembershipChange.requestNonce、admissionClaim.claim.requestNonce、credential proof的requestNonce必须相同；nested历史receipt/challenge保持其原nonce。authority六类mutation统一返回purpose=AuthorityResult的signed wrapper，payload为{operation,receipt}，故新nonce查询同账号已准入fact、同cutoff seal、已accepted同摘要时可以包原业务receipt，不篡改历史nonce/签名。原nonce重传返回原完整wrapper字节；新nonce重取只新签响应wrapper，不新签或重执行事实。MembershipRead/AdmissionRead亦签当前nonce wrapper包原receipt。跨新nonce不接受裸旧receipt作为顶层成功结果。

### 具体冻结路由

统一新前缀 /api/v1/shared；worldId在JSON body中，不把code/token/签名/包放URL。

| 路由尾部（全部POST） | 端口操作 | 最大canonical body |
|---|---|---:|
| /status | readServiceStatus | 16KiB |
| /world/register | registerWorld | 32KiB |
| /world/facts | readWorldFacts | 16KiB |
| /credential/challenge | requestCredentialChallenge | 32KiB |
| /credential/register | registerAgreementCredential | 32KiB |
| /access-code/set | setAccessCode | 16KiB |
| /observer/challenge | requestObserverChallenge | 16KiB |
| /observer/redeem | redeemObserverChallenge | 16KiB |
| /membership/publish | publishMembershipEpoch | 512KiB |
| /membership/read | readMembershipEpoch | 16KiB |
| /sequence/allocate | allocateSegment | 16KiB |
| /append/permit | issueAppendPermit | 32KiB |
| /commit/admit | admitCommit | 64KiB |
| /commit/admission | readAdmission | 16KiB |
| /settlement/seal | sealPrefix | 16KiB |
| /relay/submit | submit / relay | 512KiB |
| /relay/pull | pull | 16KiB |
| /relay/ack | acknowledge | 64KiB |

只有新route覆盖bodyLimit；旧Fastify全局16KiB及auth guard不改。new route replies含signed outerwrapper的完整canonical HTTP response≤1MiB，pull≤256条且按剩余bytes截批，不把单envelope64KiB等同完整proof载体大小。成员epoch最多256 credentials，这是c-2服务资源限制，不改c-1 schema；超限返回ResourceLimit，不能截断epoch成员或保存半条commit。

pull maximumCount=1..256、wait=0..25000，默认count=128/wait=25000。一般请求deadline12000ms；pull deadline=maximumWaitMs+7000ms，最大32000ms。timeout/Abort为AuthorityUnavailable/RelayUnavailable或BoundViolated的调用结果，不切fixture、不自动新nonce重试；read和幂等mutation最多2次重传原字节，明确取消停止，无无限退避超B。

## 3. Error code / status

| HTTP | 粗code | detail枚举 |
|---|---|---|
| 400 | InvalidData | SchemaInvalid / CanonicalInvalid / RequestNonceInvalid / LegacyIdentityUnsupported / OfflineProofUnsupported / VersionUnsupported |
| 401 | Unauthenticated | SessionMissing / SessionExpired / SessionRevoked / AuthenticationMismatch |
| 403 | Forbidden / DeviceUntrusted | OriginRejected / CsrfRejected / CredentialMismatch / RootPinMismatch / MemberNotActive / PermissionDenied |
| 409 | Conflict | IdentityConflict / IdempotencyConflict / EpochClosed / MembershipConflict / SequenceExhausted / PermitConsumed / PermitExpired / TimeTooLate / SealBoundaryConflict / PackageConflict / IdempotencyExpired / MemberAdmissionRejected |
| 413 | InvalidData | ResourceLimit |
| 429 | RateLimited | RateLimitExceeded |
| 503 | AuthorityUnavailable / TimeUntrusted | ServiceUnavailable / RelayUnavailable / DatabaseUnavailable / FactUnavailable / KeyPublisherUnavailable / ClockUntrusted |

BoundViolated/CheckpointUnverifiable/KeyUnavailable主要是本地验真/重放结果，不把它们强塞成服务器证明。RelayPullReply.kind=Gap在HTTP200签名reply内返回，reason只沿用RetentionExpired/RelayGenerationChanged/MissingAdmittedEnvelope；不得把Gap写成409后自动跳cursor。服务日志不含请求body、密码/code/cookie/CSRF/raw包/私key、shared plaintext或个人facts。

## 4. CSRF、认证、限流与幂等

所有shared路由要求真实Access session及X-CSRF-Token，即使只读POST/status/pull也校验；TLS/loopback exact Origin和Host必需，无跨源CORS、无Location重定向，cookie不读入director。account/device/generation以session查PG为准，payload重复字段必须相等；不能readonly context自证未注销。设备注册签名、公钥与ECDH持有证明另验，不因cookie有效省略。

一般authority/relay请求对(account,device,route class)固定60秒窗口：authority120/min、submit120/min、pull120/min（每设备至多一个pending pull）、ACK240/min，membership/admin30/min、ECDH挑战10/min；同时world submit600/min、TLS edge来源IP总1000/min。必须同时满足b未变的后端generic240/min/IP，单instance prototype没有宣称规模SLA；edge转发会令b看到loopbackIP，其更严格总闸仍可触发。不得为提高性能放宽b限流。

AccessCode：account/world最多5失败/900000ms、edge可信来源IP20失败/900000ms、world100失败/3600000ms；达到阈值拒新验证。challenge每account/world10/min，寿命30000ms、一次消费；正确码自动Observer；失败、到期、已消费统一MemberAdmissionRejected，不回显码或账户资格。计数在PG或明确受信edge计数器保存，服务重启/换browser key不清账号/world阈值。P9已批准，只有独立组合根可以调用；不开放产品入口。

幂等scope为(serviceInstanceId,accountId,requestNonce)，绑定operation/worldId/deviceId/generation/canonical请求SHA。成功和验证后业务失败同事务保存结果；同nonce异operation/world/device/摘要返回IdempotencyConflict。认证/CSRF失败、格式错误、rate limit、临时DB/网络HostFailure不消费业务nonce，不能固化成终局拒绝。

ordinary完整幂等results最少保留7日，之后保留nonce/hash/operation/result类别tombstone；一次challenge在完整幂等result期限内保留public原wire，之后保留消费记忆，identity/segment/permit/admission/rejection/seal历史不能随7日窗口清空。旧nonce已无完整结果时返回IdempotencyExpired或需要read status确认，不能把原请求重新执行；不能用任意环形cache再用nonce。新增identity全局去重与封边始终独立保障。IdempotencyExpired与MemberAdmissionRejected正式纳入409/Conflict的detail；不冒用429/TimeTooLate。

## 5. Relay完整性与ACK

submit只收已经admitted的WorldCommit精确envelope及公共proof，不收裸shared state/个人data。Relay无群key；验公开header/来源claim+receipts/作者envelope签名及exact digest，不能验body AEAD或授地图权限。坏envelope可拒queue，但authorityadmission摘要不得删除；最终InvalidChange需要合法源持有者补齐原字节，不从HTTP错码生成。

pull先检查generation/retentionFloor，再按cursor取batch；同步检查同world authoritative admission摘要账是否存在从未成功入queue的承诺项。发现缺字节即Gap MissingAdmittedEnvelope，不把queue空batch冒称完整世界。正常生产者已admit尚未submit的短窗口也可保守Gap，之后成功submit可明确fresh pull重验；没有新增Waiting wire或绕过seal前缀。网络cursor不是作者序号/事件总序/已验证coverage，空batch无全量证明。

ACK payload为{worldId,relayGeneration,entries:[{position,identity,envelopeSha256}],authorDeviceId,authorDeviceGeneration,deviceSignatureBase64Url}；≤256项，position严格升序、同一batch无duplicate。注册ES256签名域Neurou/relay-ack/v1\0加{serviceInstanceId,requestNonce,payload除deviceSignatureBase64Url}。服务核对真实session、cursor指向的identity/digest、deliveryrecipient集合，事务耐久后发signedRelayAck。只表示设备提交ACK声明，服务不能见证磁盘物理正确。

客户端只有完整SharedCommitValidator验真、写独立共享密文缓存并回读字节+SHA成功后才ACK；bad-body技术InvalidChange来源完整/已耐久时可ACK已保存字节，不代表其状态应用。missingkey/source/hostfailure不ACK。独立共享密文缓存不存明文state/checkpoint/个人Core或key，不构成P4；Node两个cookiejar客户端可用独立进程/目录共享密文文件回读，浏览器如用IndexedDB仅此密文与publicproof。未来不得把API成功或UI显示当耐久证据。

retention从authority admittedAt起至少86400000ms，全部ACK也不能提前删除。到期未ACK设备下一次必须Gap；队列保持轻量tombstone/retentionfloor/accepted摘要。restart保持cursor/generation；只在确证重建/丢段时增generation且返回RelayGenerationChanged，不假成功。retention过期后重新submit不保证恢复完整历史；不能恢复早于floor的旧position或倒写ACK，需要用户合法补载和后续独立恢复流程。

## 6. 精确增量 payload 与结果

这是未来 `SharedServiceProtocolContracts.ts` 的类型草案，**不是已落源码**。下列字段全部 required；只有明确标出的 null 可为空。UUID、公钥、SHA256 lowerhex、安全整数及 canonical base64url 规则继承 c-1；requestNonce 是32-byte base64url。未列字段一律拒绝。操作名逐字为上表路由尾部（含首个 `/`）。外层 authorization 的普通只读/status/challenge 请求为 null；其余 mutation 必须有当前注册设备签名。ACK/proof 内层的用途签名仍独立验证。

```ts
interface SharedOperationAuthorization {
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly deviceSignatureBase64Url: string; // ES256/P1363 64 bytes
}
interface WorldRegistrationProposal {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly mapId: string;
  readonly worldDeveloperAccountId: string;
  readonly developerTrustAnchorSha256: string;
  readonly genesisSha256: string;
  readonly contentManifestSha256: string;
}
interface WorldRegistrationRequest {
  readonly proposal: WorldRegistrationProposal;
  readonly developerSignatureBase64Url: string;
}
interface AccessCodeChangeProposal {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly requestNonce: string;
  readonly expectedCodeRevision: number | null;
  readonly accessCode: string; // exactly six ASCII digits, incl leading zero
}
interface AccessCodeChangeRequest {
  readonly proposal: AccessCodeChangeProposal;
  readonly developerSignatureBase64Url: string;
}
interface WorldServiceFacts {
  readonly registration: WorldRegistrationProposal;
  readonly currentMembership: SharedAuthorityReceipt<WorldMembershipEpoch> | null;
  readonly requestedObserver: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
  readonly latestSeal: SharedAuthorityReceipt<RelaySettlementSeal> | null;
  readonly developerClosure: null; // c-2 has no account closure producer
  readonly policy: SharedSettlementPolicy;
  readonly policySha256: string;
}
interface WorldAgreementCredentialFact {
  readonly credential: WorldMemberCredential;
  readonly challengeSha256: string;
  readonly registeredAtServerEpochMs: number;
  readonly clockGeneration: number;
  readonly authorKeyBinding: SharedAuthorityReceipt<WorldAuthorKeyBinding>;
  readonly observerAdmission: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
}
interface WorldObserverChallenge {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly challengeId: string;
  readonly observerAccountId: string;
  readonly deviceId: string;
  readonly deviceGeneration: number;
  readonly nonceBase64Url: string;
  readonly accessCodeRevision: number;
  readonly developerTrustAnchorSha256: string;
  readonly expiresAtServerEpochMs: number;
}
interface RelaySubmitFact {
  readonly worldId: string;
  readonly identity: WorldCommitIdentity;
  readonly envelopeSha256: string;
  readonly cursor: RelayCursor;
  readonly admittedAtServerEpochMs: number;
  readonly retainedUntilServerEpochMs: number;
}
interface RelayAckRequest {
  readonly worldId: string;
  readonly relayGeneration: number;
  readonly entries: readonly {
    readonly position: string;
    readonly identity: WorldCommitIdentity;
    readonly envelopeSha256: string;
  }[];
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly deviceSignatureBase64Url: string;
}
interface RelayAckFact {
  readonly worldId: string;
  readonly relayGeneration: number;
  readonly accountId: string;
  readonly deviceId: string;
  readonly deviceGeneration: number;
  readonly entriesSha256: string;
  readonly acknowledgedCount: number;
}
type RelaySubmitReceipt = SharedTransportReceipt<RelaySubmitFact>;
type RelayAckReceipt = SharedTransportReceipt<RelayAckFact>;
interface AuthorityProtocolResult<T> {
  readonly operation: '/observer/redeem' | '/membership/publish'
    | '/sequence/allocate' | '/append/permit' | '/commit/admit' | '/settlement/seal';
  readonly receipt: SharedAuthorityReceipt<T>;
}
```

registered shared-operation 签名域为 `Neurou/shared-device-operation/v1\0` 加 JCS({schemaVersion:1,serviceInstanceId,operation,requestNonce,authorDeviceId,authorDeviceGeneration,payload})。实例固定来自安装 environment，不接受任意 origin/实例签名。世界注册根签名为 `Neurou/world-registration/v1\0` 加 proposal；改码根签名为 `Neurou/world-access-code-change/v1\0` 加 proposal。root 与注册设备签名不可互代。其余 P3 claim/envelope/membership/package/acceptance 的既有域及正文一律不变。共同 nonce 必须匹配；仅 nested 历史 receipt/challenge 保持其原 nonce。

| operation | payload 的精确字段 | Accepted.value（签名 receipt 的 payload） |
|---|---|---|
| /status | `{}` | SharedTransportReceipt，purpose SharedServiceStatus：{clockGeneration,clockStatus:'Trusted'\|'Untrusted',serverEpochMs:number\|null,lastSignedEpochMs:number\|null,policy,policySha256} |
| /world/register | WorldRegistrationRequest | purpose WorldRegistration，payload 为原 proposal；服务签名表示安装组合已核对并注册 |
| /world/facts | {worldId,observerAccountId:string\|null}，null查询本人 | purpose WorldFacts，WorldServiceFacts |
| /credential/challenge | {worldId,keyAgreementPublicKey,keyAgreementKeyFingerprint} | purpose AgreementCredentialChallenge，WorldMemberCredentialChallenge（精确字段见 key-delivery-and-pins.md） |
| /credential/register | {challengeReceipt:SharedTransportReceipt<WorldMemberCredentialChallenge>,proof:WorldMemberCredentialProof} | purpose AgreementCredential，WorldAgreementCredentialFact |
| /access-code/set | AccessCodeChangeRequest | purpose AccessCodeUpdated：{worldId,accessCodeRevision,changedAtServerEpochMs,clockGeneration}；不回显code/verifier |
| /observer/challenge | {worldId,developerTrustAnchorSha256} | purpose ObserverChallenge，WorldObserverChallenge |
| /observer/redeem | {challengeReceipt:SharedTransportReceipt<WorldObserverChallenge>,accessCode:string} | AuthorityResult wrapper包WorldObserverAdmissionFact原receipt，内层purpose WorldMembership；正确码自动准入，无人工批准 |
| /membership/publish | {change:WorldMembershipChange} | AuthorityResult wrapper包WorldMembershipEpoch原receipt，内层purpose WorldMembership |
| /membership/read | {worldId,membershipEpoch:number} | purpose MembershipRead：{epochReceipt:SharedAuthorityReceipt<WorldMembershipEpoch>}，原receipt字节不重签 |
| /sequence/allocate | {worldId,membershipEpoch:number} | AuthorityResult wrapper包AuthorSequenceSegment原receipt，内层purpose SequenceSegment |
| /append/permit | {worldId,identity,segmentId,membershipEpoch,keyEpoch,changeClass} | AuthorityResult wrapper包WorldAppendPermit原receipt；服务从PG复核segment，不信客户端号段 |
| /commit/admit | {admissionClaim:SignedWorldCommitAdmissionClaim,appendPermitReceipt,sequenceSegmentReceipt} | AuthorityResult wrapper包WorldCommitAdmission或WorldCommitRejection原receipt，内层purpose精确对应；无envelopeBytes |
| /commit/admission | {worldId,identity,envelopeSha256} | purpose AdmissionRead：{receipt:SharedAuthorityReceipt<WorldCommitAdmission\|WorldCommitRejection>}；缺fact为 FactUnavailable |
| /settlement/seal | {worldId,sealedThroughEpochMs,expectedPreviousSealSha256:string\|null} | AuthorityResult wrapper包RelaySettlementSeal原receipt；服务计算count/prefix/previous，无客户端count/state |
| /relay/submit | {commit:AdmittedWorldCommit} | RelaySubmitReceipt，purpose RelaySubmit |
| /relay/pull | {worldId,after:RelayCursor,maximumCount:number,maximumWaitMs:number} | purpose RelayPull，原 c-1 RelayPullReply |
| /relay/ack | RelayAckRequest | RelayAckReceipt，purpose RelayAck |

本次code/claim/epoch各自 schemaVersion/实例/world/nonce重复值逐字一致；nested历史receipt/challenge保持原nonce；public read无跨世界枚举。world facts 查询需root或该world当前成员/合法Observer；查他人准入fact仅返回批准的公共事实。历史membership读取限root或该epoch中的本账号已注册credential，且当前会话仍有效；无后续epoch读取资格不泄露后续名单。首次root注册epoch前可读/管理自身世界。sequence/permit/admit/submit要求当前epoch内session精确device credential；epoch切换的旧已accepted同摘要重取不变。普通账号成功redeem后可证明ECDH，但进入群仍需根签epoch；根不得用seed代替正确码准入。ECDH proof到期/已消费/错误HMAC或签名统一403 DeviceUntrusted/CredentialMismatch，不回显私key差异；这只是world ECDH绑定失败，不撤销全局Auth device。AccessCode失败保持409 Conflict/MemberAdmissionRejected。

初次codeRevision=1、expectedCodeRevision=null；以后CAS当前revision恰加1。AccessCode正确重复准入返回当前同账号原fact，不制造第二份身份；code改变使旧未消费challenge无效，不撤销已准入fact或授群key。challenge TTL30000ms、固定会话家族、单次terminal消费；不提供observer撤销独立route，群credential撤销由批准的membership epoch变更实施。多设备必须各自有ECDH证明，账号observer fact可引用同revision，不能冒用另一设备key。

permit的actor由会话取得；roster AddCoDeveloper 的目标准入receipt由authority历史事实提供并在admission结果布尔证明中固定，不能把body权限判定转给Relay。所有 new P3 receipt都经过新可信clock；status Untrusted只签无当前可信时间的故障状态。Clock失信时历史原receipt可读，禁止新世界/准入/epoch/段/permit/admission/rejection/seal。

`SharedServiceErrorCode` 精确为§3表全部detail的联合，无自定义扩展。400的VersionUnsupported使用粗code VersionUnsupported；403的CredentialMismatch使用DeviceUntrusted，其余用Forbidden；503的ClockUntrusted用TimeUntrusted，其余用AuthorityUnavailable。其它HTTP粗code按表唯一对应。客户端HostFailure/Abort/网络无响应不是服务器signed rejection；作为本地TransportFailure保留，不伪造wire。`TimeTooLate` detail与结构化已签 WorldCommitRejection 不可互代。

## 7. 窄能力与兼容签名

未来新协议interface方法采用§1表输入；mutation由session owner生成/缓存32-byte请求nonce和固定用途签名，在同一个逻辑调用的重传中复用。只读重新调用可用新nonce；幂等复取必须传入此前已保留的请求描述，不能重新随机nonce。director只拿描述符和已解析的响应，不拿cookie/CSRF/私key。

`SharedServiceSessionPort` 冻结为 `currentContext(): AuthenticatedServiceContext|null`、`createRequestNonce(): string`、`request(operation,requestNonce,payload): Promise<SharedHttpReply<unknown>>`；operation必须为本文有限路由联合，未知响应在codec验真前不可作为事实。request内部验证精确同源、会话、CSRF、资源限制，生成author authorization；不接受 arbitrary URL/headers/cookie/任意domain。Auth能力使用旧 RealAuthServicePort 完整login/logout/verify/refresh/readServerTime/readAccountFacts；签名与准入能力在logout/更换context时同步失效。

`RegisteredAuthorSigningPort` 冻结有限用途方法：signAdmissionClaim(unsignedClaim)、signEnvelope(unsignedEnvelope)、signCredentialProof(unsignedProof)、signKeyAcceptance(unsignedAcceptance)、signSharedOperation(operation,requestNonce,payload)、signRelayAck(requestNonce,unsignedAck)。分别返回canonical64-byte signature，均绑定已注册当前device/context和上述固定域；signSharedOperation只允许本文精确route/schema，无任意字节签名入口。签名失败返回HostFailure能力错误，不能假签继续。WorldKeyAgreementPort / WorldDeveloperSigningPort 的精确方法见key文档。

`SharedCommitSealingPort.sealCommit(commit:WorldCommit,header:RelayCommitHeader,worldRelayKey:Uint8Array,signer:RegisteredAuthorSigningPort): Promise<Uint8Array>` 只制作P3 suite：验证正文/outer一致，fresh random32-byte DEK、fresh nonce12各用于wrap/body，固定HKDF/AAD域、注册作者envelope签名，然后输出严格canonical envelope bytes≤65536。不得自行分配AppendedAt/序号/权限；调用前必须有真实permit。nativecrypto由presentation SharedCryptoAdapter实施；原c-1 SharedCryptoPort不改。加密失败不发送claim、不输出半包。

`RealWorldAuthorityProtocolPort extends RealWorldAuthorityPort`：旧readAccountFacts签名原封不动，其余每项返回Promise<SharedHttpReply<该项value>>。六项P3 mutation value精确为SharedTransportReceipt<AuthorityProtocolResult<T>>（purpose AuthorityResult，T按路由表）；不能裸返回历史旧nonce receipt。`RealCommitRelayProtocolPort extends RealCommitRelayPort<AdmittedWorldCommit,RelaySubmitReceipt>`：submit(commit)、relay(commit)均返回Promise<SharedHttpReply<RelaySubmitReceipt>>；pull(worldId,after,maximumCount,maximumWaitMs)返回Promise<SharedHttpReply<SharedTransportReceipt<RelayPullReply>>>；acknowledge(request:RelayAckRequest)返回Promise<SharedHttpReply<RelayAckReceipt>>。SharedServiceFault结构性包含旧ServiceFault三字段，因此兼容旧ServiceReply，不修改旧类型联合。relay与submit指向同一提交/nonce生命周期，无弱验证分支。

`SharedRelayDurableCachePort` 冻结 persistAndVerify(commit:AdmittedWorldCommit):Promise<{envelopeSha256:string}>、read(identity:WorldCommitIdentity):Promise<AdmittedWorldCommit|null>；必须保存完整公共proof及精确密文字节、原子写入、耐久成功后回读验证。具体平台backend由presentation SharedRelayDurableCache提供，业务不由UI成功推断耐久。不保存secret或明文，不能替代P4。

共享独立prototype将codec/validator/reducer、以上窄能力与真实adapter显式组装；只有c-2实现与隔离验收后才可声称能力存在。本轮所有签名/端口代码块都是冻结草案。
