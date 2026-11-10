# P3 共享契约 schema 1 · 纯文档规范

2026-10-11（Asia/Shanghai），对应VERDICT-391～410。本文中的TypeScript是数据结构记法，**不新增.ts文件、codec、ContractAdapter或Relay实现**。外部输入始终unknown，经过字段、规范字节、来源和权限验证后才成为合法数据。冻结的是新ExternalService在线profile；原生离线时间证明依赖已明确延期的P5，未批准平台拒绝生成/接收新的离线共享提交，不以应用时长降级。

## 1. 标量、编码和版本

全部对象只允许列出的own enumerable data字段；拒绝额外/缺失字段、重复JSON键、非数据属性、非法原型、symbol/函数、循环/稀疏数组、非法Unicode、非有限/非安全整数、负零。所有optional语义用显式null，禁止遗漏字段。UTF-8无BOM，规范JSON为RFC8785/JCS的整数子集；数组顺序按下文固定，不以localeCompare排序。

| 标量 | 精确值域 |
|---|---|
| WorldId / AccountId / DeviceId / CommitPermitId / SegmentId | 小写canonical UUID；既有fixture非UUID标识不自动转换 |
| serviceInstanceId | 沿用b的ASCII [A-Za-z0-9_.-]{3,128}，逐字等于安装pin配置；不是UUID或跨实例通用域 |
| receipt.keyId / developerSigningKeyId | 对应P-256公钥RFC7638 SHA256 base64url指纹，与pin相等；群worldRelayKeyId另为UUID |
| AuthorSequence | 1..Number.MAX_SAFE_INTEGER安全整数；0不是提交 |
| EpochMs / Revision / Count | 非负安全整数；epoch/revision用于实际版本时从1开始 |
| Sha256Hex | 64位小写hex，摘要均对规范UTF-8字节，不hash运行时对象 |
| KeyFingerprint | RFC7638 EC/P-256四字段JWK，SHA256无填充base64url，沿用b |
| Base64Url | canonical无填充编码，重编码必须逐字相同 |
| StableMapId / MapEntityId / TriggerId / TraceTouchId | 小写UUID；world作用域内唯一、永久不复用 |
| WorldMeterMilli | 有符号整数-1,000,000,000..1,000,000,000；1000单位=1 WorldMeter；不改变旧运行时坐标 |
| TouchCount | decimal字符串，正则0或非零首位后0..38位数字，值≤2^128-1；不转JS number |

所有新共享codec使用schemaVersion=1、profile='ExternalSharedOnlineV1'，不接受archive空骨架或CoreTransferPayload充当本schema。未来扩展触发器动作、浮点值、原生离线profile或suite都需显式版本/补冻；未知不尝试宽松兼容。

```ts
interface WorldCommitIdentity {
  readonly authorAccountId: string;
  readonly authorSequence: number;
}
interface SharedPosition {
  readonly lateralMilli: number;
  readonly depthMilli: number;
}
interface SharedContentReference {
  readonly contentId: string;          // ASCII [A-Za-z0-9_.:/-]{1,128}
  readonly contentSha256: string;
}
interface WorldSharedGenesis {
  readonly schemaVersion: 1;
  readonly profile: 'ExternalSharedOnlineV1';
  readonly worldId: string;
  readonly mapId: string;
  readonly contentRevision: number;
  readonly contentManifestSha256: string;
  readonly worldDeveloperAccountId: string;
  readonly developerTrustAnchor: WorldDeveloperTrustAnchor;
  readonly initialState: SharedWorldState;
}
```

Genesis只在用户本地；来自正式受审内容/带外信任的WorldDeveloper签名内容源，不从未验证文件自动信任。实体/Trigger引用的contentId+hash必须在正式批准的内容manifest中唯一解析；不是URL、资源下载权或可执行脚本。本schema只冻结以下有限数据子集，不声称所有未来地图编辑器内容均已覆盖。Genesis建立/分叉重命名与内容批准的实际入口留c实施准入/P4文件接入，不修改B2.3。

## 2. 全局作者序号与设备段

新二元身份按本轮用户明确口径冻结。authorSequence在**同serviceInstanceId的作者账号全部世界**上单调分配；worldId和deviceId是验证上下文，不参加身份唯一键。总序：appendedAt.epochMs升序→authorAccountId ASCII字节序→authorSequence数值升序。相同时间不同身份不是冲突；相同身份不同world/设备/时间/密文摘要为IdentityConflict。

```ts
interface AuthorSequenceSegment {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly segmentId: string;
  readonly authorAccountId: string;
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly worldId: string;
  readonly membershipEpoch: number;
  readonly firstSequence: number;
  readonly lastSequence: number;       // 包含端点，恰好1024个
  readonly issuedAtServerEpochMs: number;
  readonly expiresAtServerEpochMs: number;
}
```

服务事务锁账号计数器，原子增加1024并签发段receipt；段不相交，达到MAX_SAFE_INTEGER前拒绝分配SequenceExhausted，不环绕。段绑定设备/世代/世界/成员epoch，寿命3600000ms。服务重启、撤销、epoch切换、请求失败均不归还号码；重复相同幂等分配请求返回原段，不再扣号。账号计数器与已签发段摘要是轻量事实，不是世界存档。

本机在持有效lease下先耐久消费nextSequence，再准备提交；崩溃留下空洞，不复用；跨窗口共享同一消费日志和锁。无锁/消费存储不能耐久则拒绝。重建/备份恢复/未知本机世代废弃剩余段，重新在线申请；禁止复制段给另一设备或从checkpoint最大值倒推下一号。c首次实现可只用内存段并要求重建弃段、在线重新分配，不能把它称可恢复离线存储。离线段仅是“号码预分配”，不授OfflineGrant、真实时间或设备权限；P5批准前不能生成离线有效提交。

段/permit时间窗均含issued/appended起点、不含expires端点；可信服务S>=expires即过期，S早于起点拒绝TimeUntrusted。authorSequence是分配序列而非跨设备实际追加时间顺序，设备较早取得的小号可以较晚追加；事件顺序只用§2总序。admissionRevision在world作用域从1事务递增唯一，只作准入账位置，不替代总序；observerAdmissionRevision为独立成员事实版本，不是该字段或membershipEpoch。

历史027三元身份保留历史解释与文件，不直接拼接/去设备字段转换到此身份；旧格式输入返回LegacyIdentityUnsupported。不存在静默重键/世界合并；旧→新迁移要独立批准。

## 3. AppendedAt与轻量提交准入

AppendedAt数据值仍为{epochMs:number}，不改ledger的同名结构；**共享域来源规则不回改NarrativeEvent的时间或账本**。外层与正文完全相等。在线先取得一次时间许可，在准备密文和本机追加时采用其服务epoch作为本次逻辑追加时刻；它不是relay收到时刻，也不是客户端Date.now。

```ts
interface SharedAppendedAt { readonly epochMs: number; } // 文档结构别名，沿用AppendedAt语义
interface WorldAppendPermit {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly permitId: string;
  readonly requestNonce: string;           // 32字节
  readonly worldId: string;
  readonly identity: WorldCommitIdentity;
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly segmentId: string;
  readonly membershipEpoch: number;
  readonly keyEpoch: number;
  readonly changeClass: WorldChangeClass;
  readonly appendedAt: SharedAppendedAt;
  readonly expiresAtServerEpochMs: number; // appendedAt+30000
  readonly clockGeneration: number;
  readonly clockStatus: 'Trusted';
}
interface WorldCommitAdmission {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly identity: WorldCommitIdentity;
  readonly envelopeSha256: string;
  readonly appendedAt: SharedAppendedAt;
  readonly admittedAtServerEpochMs: number;
  readonly admissionRevision: number;
  readonly membershipEpoch: number;
  readonly rosterTargetObserverActiveAtAppendedAt: boolean | null; // 仅AddCoDeveloper是boolean
}
interface WorldCommitAdmissionClaim {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly requestNonce: string;             // 32字节，一次请求上下文
  readonly header: RelayCommitHeader;
  readonly envelopeSha256: string;           // 最终完整envelope的摘要
}
interface SignedWorldCommitAdmissionClaim {
  readonly claim: WorldCommitAdmissionClaim;
  readonly authorSignatureBase64Url: string; // 独立64字节ES256/P1363签名
}
interface WorldDeveloperClosureFact {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly worldDeveloperAccountId: string;
  readonly effectiveAtServerEpochMs: number;
  readonly accountFactRevision: number;
}
interface WorldCommitRejection {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly identity: WorldCommitIdentity;
  readonly envelopeSha256: string;
  readonly appendedAt: SharedAppendedAt;
  readonly rejectedAtServerEpochMs: number;
  readonly reason: 'TimeTooLate' | 'PermitExpired' | 'EpochClosed' | 'IdentityConflict';
  readonly previouslyAdmitted: false; // 指本identity+摘要对；IdentityConflict可能已有别的摘要accepted
}
interface WorldAuthorKeyBinding {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly authorAccountId: string;
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly authorSigningPublicJwk: { readonly kty: 'EC'; readonly crv: 'P-256'; readonly x: string; readonly y: string };
  readonly authorSigningKeyFingerprint: string;
  readonly registeredAtServerEpochMs: number;
  readonly assurance: 'RegisteredCredential';
}
```

这些是**未来c的纯轻量权威协议**，不是b已有API。服务签名沿用b受信根与P1363、另用域Neurou/shared-authority/v1\0，purpose分别SequenceSegment/WorldAppendPermit/WorldCommitAdmission/WorldCommitRejection/AuthorKeyBinding/RelaySettlementSeal/WorldMembership/WorldDeveloperClosure。purpose不可混用b的ServerTime/Authentication。每个响应必须绑定请求nonce/实例；错误不回填时间。authority签名覆盖除signatureBase64Url外的整个receipt，而非只签payload；域/nonce/purpose/实例/keyId/clockGeneration同被签。

在线permit申请时核对认证账号/设备、段、当前成员epoch、服务clockTrusted。密文生成后提交SignedWorldCommitAdmissionClaim及已签许可/段receipt；独立作者签名覆盖UTF8('Neurou/commit-admission-claim/v1\0')||JCS(claim)。权威能在**不接收密文**的情况下核对claim签名、header与permit的全部重复字段、注册公钥/设备世代、成员epoch、许可期限和摘要绑定。admission不声称envelope作者签名/正文/地图权限已验真；这些由Relay和接收端持完整字节验证。permit+identity一次消费，服务只保存不可逆摘要和轻量receipt，**不接收正文、state、checkpoint或个人层**。相同identity+最终envelope摘要及相同header重复返回原admission；异摘要/异header为IdentityConflict、原accepted不改变、隔离冲突段。已接受的幂等重取先查原receipt，不因permit后来过期/撤销改为拒绝；尚未接受的请求失败不改成accepted，相同nonce失败重放仍为原结果，要新nonce和仍有效许可才可新尝试，不能绕过封边/撤权。

权威的DeveloperRoster镜像只作轻量预检/诊断；尚未封边的权限按总序可能重排，不能以“当前镜像不在名单”终局拒绝较早合法MapEditCommit。最低成员准入、签名、许可、epoch和身份仍严格验证；最终MapEditPermission由接收端对完整总序判断。DeveloperRosterChange只能由固定WorldDeveloper账号签名提出，目标observerAdmissionRevision引用的准入来源必须可验；AddCoDeveloper另由签名admission.rosterTargetObserverActiveAtAppendedAt给出在逻辑追加时刻有效资格，true才可加入，false为正文InvalidChange，未知事实不签该准入而报FactUnavailable。RemoveCoDeveloper沿用旧准入来源但无需目标今天仍观察，不因已撤销而阻止清理旧名单。其它subtype此字段严格null。服务承诺的是不可逆摘要准入与其维护的轻量资格事实，不是授予地图编辑权，也不放宽任何旧guard。

WorldDeveloperClosureFact是未来账号注销生产者签出的轻量事实，不是第四类WorldCommit，更不是b新增注销API。effectiveAt取事实耐久提交的可信服务时刻，禁止回填到已seal的前缀；与共享提交同毫秒时该事实先于提交生效。它使名单frozen=true、WorldDeveloper不再发起有效变化，不移除现有CoDeveloper。签名fact在日志/检查点保留；其摘要纳入seal。没有可信注销事实不由文件自报frozen或注销时间；没有相关API的c-1/c-2可以只产null，不能声称已支持账号注销验收。

admission在relay独立故障时仍可由轻量权威完成，用户随后用文件传已admitted共享提交，不要求relay队列可用才能游玩/携带；若认证/轻量权威也不可用，c在线profile只能保留候选，不能伪造共享已结算。该分离守住024“Relay失效不等于Auth失效”，不开放完整FileCarry机制。以后原生离线profile需P5给签名time anchor、boot/uptime/不确定度与grant绑定的完整证明；目前这种输入返回OfflineProofUnsupported，既有b签名时间加performance.now不是该证明。

## 4. 三类变化和历史CommitClass

```ts
type WorldChangeClass = 'MonotonicReveal' | 'TraceTouch' | 'DeveloperMapChange';
type SharedCommitClass = 'Monotonic' | 'AddOnly' | 'RestrictedWrite';
interface MonotonicRevealChange {
  readonly changeClass: 'MonotonicReveal';
  readonly commitClass: 'Monotonic';
  readonly entityId: string;
  readonly revealed: true;
}
interface TraceTouchChange {
  readonly changeClass: 'TraceTouch';
  readonly commitClass: 'AddOnly';
  readonly traceTouchId: string;
  readonly normalTraceEntityId: string;
  readonly touchUnits: 1;
}
type EditTarget = { readonly kind: 'Entity'; readonly entityId: string }
  | { readonly kind: 'Trigger'; readonly triggerId: string };
interface SharedMapEntityDefinition {
  readonly entityId: string;
  readonly elementType: 'Initial' | 'Process' | 'Trace' | 'Residue';
  readonly position: SharedPosition;
  readonly content: SharedContentReference;
  readonly normalTrace: { readonly traceTouchId: string; readonly tier: 'Common' | 'Deep' | 'Rain' } | null;
}
interface SharedTriggerDefinition {
  readonly triggerId: string;
  readonly anchorEntityId: string;
  readonly activation: { readonly kind: 'Proximity'; readonly radiusMilli: number }
    | { readonly kind: 'Interaction' };
  readonly action: { readonly kind: 'RevealResidue'; readonly targetEntityId: string };
}
type MapEditOperation =
  | { readonly operation: 'CreateEntity'; readonly target: { readonly kind: 'Entity'; readonly entityId: string }; readonly definition: SharedMapEntityDefinition }
  | { readonly operation: 'ReplaceEntity'; readonly target: { readonly kind: 'Entity'; readonly entityId: string }; readonly definition: SharedMapEntityDefinition }
  | { readonly operation: 'DeleteEntity'; readonly target: { readonly kind: 'Entity'; readonly entityId: string } }
  | { readonly operation: 'CreateTrigger'; readonly target: { readonly kind: 'Trigger'; readonly triggerId: string }; readonly definition: SharedTriggerDefinition }
  | { readonly operation: 'ReplaceTrigger'; readonly target: { readonly kind: 'Trigger'; readonly triggerId: string }; readonly definition: SharedTriggerDefinition }
  | { readonly operation: 'DeleteTrigger'; readonly target: { readonly kind: 'Trigger'; readonly triggerId: string } };
interface MapEditCommitChange {
  readonly changeClass: 'DeveloperMapChange';
  readonly commitClass: 'RestrictedWrite';
  readonly subtype: 'MapEditCommit';
  readonly edit: MapEditOperation;
}
interface DeveloperRosterChange {
  readonly changeClass: 'DeveloperMapChange';
  readonly commitClass: 'RestrictedWrite';
  readonly subtype: 'DeveloperRosterChange';
  readonly operation: 'AddCoDeveloper' | 'RemoveCoDeveloper';
  readonly accountId: string;
  readonly observerAdmissionRevision: number;
}
type WorldChange = MonotonicRevealChange | TraceTouchChange | MapEditCommitChange | DeveloperRosterChange;
```

MonotonicReveal只更新已存在Residue实体的共享revealed=true，OR合并；不能写Concealed/Forget、个人可见性、谱面/雨痕、角色账本、来源、控制权或坐标。实体已删时记录NoEffect，不能复活；不是把所有ElementEntity.visibilityState变成共享。删除后同ID不得Create。

TraceTouch只来自**已批准Normal来源Trace收集**；该实体definition.normalTrace非null且elementType=Trace。非null不是来源证明，正式批准manifest必须唯一认证entityId/contentId、elementType、TraceOrigin=Normal、tier及traceTouchId；CreateEntity不能自报Normal资格或把Echo/Anomalous升成Normal。Echo/Anomalous、Recall/Replay不产生触痕；正文不携带访客身份、角色、账本、回忆计数、得分/输入时间线。normalTraceEntityId与traceTouchId必须匹配manifest/当前有效定义，traceTouchId稳定，不因重绘/移位改变。以唯一已准入commit身份去重，不以签名随机字节/网络cursor去重。触碰真实性依赖正确游戏生产端，签名不证明真实操作；c无生产入口不能声称防恶意刷量。

MapEditCommit仅明确“保存”产生，**每commit恰好一个edit/一个EditTarget**。一次UI保存涉及多个对象时，未来生产端拆成不同身份的提交，互不原子绑定，不新增batch事务机制。一个对象非法/被删不牵连另一对象；同对象有效Replace在总序后者覆盖先者。非法结构/内容来源为InvalidChange；Create到已用ID或Replace已删除目标为NoEffect并在结算后给MergeConflict，重复Delete已删目标为NoEffect/null，已撤权为RevertedEdit。删除成为永久tombstone，后续修改拒绝，不允许upsert复活；后序删除生效。**没有共享编辑锁、expectedRevision CAS或单开发者排他**；本地lease只保护存储提交，与035禁止网络编辑锁不同。

同ID的Replace不得改变elementType、normalTrace身份/等级或content所属实体类别；可以改position与批准content引用。新实体的初始个人可见性由正式内容初始化，不在共享提交中授予个人进度。Trace定义变化不得把Echo/Anomalous升为Normal。radiusMilli=1..1,000,000整数；引用必须存在、类型匹配，删除实体不顺带删除触发器，悬空trigger停用并保留定义直到显式编辑。没有向量、任意脚本/表达式、AI提示、URL/二进制、谱面生产、社区发布/CommunityMap编辑、世界拓扑/fork身份变更。更完整Trigger/地图schema要新版本，不在codec用unknown正文旁门。

DeveloperRosterChange仍归第三类，保留035名单变更本身WorldCommit。仅WorldDeveloper写，Add目标须已有有效WorldObserver事实，Remove可移除既有名单账号而不要求其资格仍有效；不得把本人删除、转让根身份或添加StudioDeveloper权限。按提交总序到该位置的DeveloperRoster判定MapEditPermission，名单内任一CoDeveloper可编辑任何EditTarget；没有擅加目标级授权。重复Add/Remove是NoEffect。WorldDeveloper账号注销后名单冻结，既有CoDeveloper仍可编辑；注销生效由上文签名WorldDeveloperClosureFact精确绑定。

## 5. 明文提交、外壳和加密绑定

```ts
interface WorldCommit {
  readonly schemaVersion: 1;
  readonly profile: 'ExternalSharedOnlineV1';
  readonly worldId: string;
  readonly mapId: string;
  readonly contentManifestSha256: string;
  readonly identity: WorldCommitIdentity;
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly segmentId: string;
  readonly permitId: string;
  readonly membershipEpoch: number;
  readonly keyEpoch: number;
  readonly appendedAt: SharedAppendedAt;
  readonly change: WorldChange;
}
type RestrictedWriteHeader = null
  | { readonly subtype: 'MapEditCommit' }
  | { readonly subtype: 'DeveloperRosterChange'; readonly operation: 'AddCoDeveloper' | 'RemoveCoDeveloper'; readonly accountId: string; readonly observerAdmissionRevision: number };
interface RelayCommitHeader {
  readonly schemaVersion: 1;
  readonly profile: 'ExternalSharedOnlineV1';
  readonly kind: 'RelayWorldCommit';
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly identity: WorldCommitIdentity;
  readonly authorDeviceId: string;
  readonly authorDeviceGeneration: number;
  readonly authorSigningKeyFingerprint: string;
  readonly segmentId: string;
  readonly permitId: string;
  readonly membershipEpoch: number;
  readonly keyEpoch: number;
  readonly worldRelayKeyId: string;
  readonly appendedAt: SharedAppendedAt;
  readonly changeClass: WorldChangeClass;
  readonly commitClass: SharedCommitClass;
  readonly restrictedWrite: RestrictedWriteHeader;
  readonly cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1';
}
interface WrappedRelayDataKey {
  readonly nonceBase64Url: string;              // 12字节
  readonly ciphertextAndTagBase64Url: string;   // 32字节DEK+16字节tag
}
interface RelayCommitEnvelope {
  readonly header: RelayCommitHeader;
  readonly wrappedCommitDataKey: WrappedRelayDataKey;
  readonly nonceBase64Url: string;              // 12字节
  readonly ciphertextAndTagBase64Url: string;
  readonly authorSignatureBase64Url: string;    // 64字节ES256/P1363
}
interface AdmittedWorldCommit {
  readonly envelopeBytesBase64Url: string; // 精确UTF8 wire字节；先对receipt验摘要，再unknown解析
  readonly appendPermitReceipt: SharedAuthorityReceipt<WorldAppendPermit>;
  readonly sequenceSegmentReceipt: SharedAuthorityReceipt<AuthorSequenceSegment>;
  readonly admissionReceipt: SharedAuthorityReceipt<WorldCommitAdmission>;
  readonly admissionClaim: SignedWorldCommitAdmissionClaim;
  readonly authorKeyBindingReceipt: SharedAuthorityReceipt<WorldAuthorKeyBinding>;
  readonly membershipEpochReceipt: SharedAuthorityReceipt<WorldMembershipEpoch>;
  readonly rosterObserverAdmissionReceipt: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
}
```

header的type与历史CommitClass严格配对，restrictedWrite只在第三类非null且与解密subtype/delta相等。公开名单delta只含035所需轻量写权限，Relay可保存/按总序核对开发者名单的权限事实；不暴露地图目标/坐标/Trigger/触痕/正文、不保存SharedWorldState。它不是第四类或AccessCode明文变更提交。仅凭群key不能写RestrictedWrite；服务外层检查与接收端按总序重放权限检查都必须完成，网络准入receipt不等同正文合法性。authorKeyBindingReceipt来自安装已pin的服务根，绑定公钥/账号/设备世代/RegisteredCredential，注册时间≤许可时间，fingerprint严格重算并与header相等；不信任外壳自带公钥。接受后历史公钥证明随commit保留，当前设备撤销不抹去已经admitted的历史证明；不能把它提升成PhysicalDevice。

每项显式附membershipEpochReceipt，验证服务签名+开发者proposal签名、world/root anchor、epoch/key descriptor、激活时刻≤AppendedAt及作者credential精确匹配；它只含轻量公开事实，不带key包。DeveloperRosterChange另附rosterObserverAdmissionReceipt，account/revision/加入时刻与正文/outer匹配，非名单subtype严格null；历史fact在清log前由可信本地checkpoint已验证，不把裸revision当证明。外部checkpoint/P4需另冻结伴随的历史证据载体，不能只从可读state重建可信来源；缺任何必需证明为Gap，不降级成正文合法。

每个identity生成全新随机256-bit commit DEK；wrap key=HKDF-SHA256(WorldRelayKey, salt=SHA256(JCS(identity)), info=UTF8('Neurou/relay-dek/v1\0')||UTF8(JCS(header)), 32)。wrap AAD=UTF8('Neurou/relay-wrap/v1\0')||JCS(header)；正文AAD=UTF8('Neurou/relay-body/v1\0')||JCS({header,wrappedCommitDataKey})。AES256-GCM nonce各独立随机96bit、tag128bit；每个DEK只加密一份正文，包裹key只用一次规范DEK密文，原nonce不得配新明文；任何重试复用**同一完整envelope**。不能因epoch变化重加密/改签同一identity；重新产生合法新变化也不能复活028已拒的变化。

作者ES256签名域Neurou/world-commit/v1\0，覆盖{header,wrappedCommitDataKey,nonceBase64Url,ciphertextAndTagBase64Url}全部规范字节。envelopeSha256=SHA256(最终envelope精确UTF8 wire字节)，正常wire必须是包含最终signature字段的JCS；验签后仍需解密并核对所有内外重复字段、Manifest/ID/变化schema与SharingCriteria。AdmittedWorldCommit保留base64url精确字节而非先丢弃非法输入；接收端先核对admission承诺摘要再unknown解析，未验证对象不成为WorldCommit。对同一已经耐久envelope重复发送是幂等；不能每次重签ECDSA导致新摘要。单envelope≤65536字节；明文≤49152字节，metadata/wrap/编码后仍须满足外壳上限，超限拒绝，不拆半条保存。

## 6. SharedWorldState与WorldChangeLog

```ts
interface SharedEntityRecord {
  readonly definition: SharedMapEntityDefinition;
  readonly createdBy: WorldCommitIdentity | null;  // null=Genesis
  readonly lastEditedBy: WorldCommitIdentity | null;
  readonly deletedBy: WorldCommitIdentity | null;
}
interface SharedTriggerRecord {
  readonly definition: SharedTriggerDefinition;
  readonly createdBy: WorldCommitIdentity | null;
  readonly lastEditedBy: WorldCommitIdentity | null;
  readonly deletedBy: WorldCommitIdentity | null;
}
interface TraceTouchAggregate {
  readonly traceTouchId: string;
  readonly normalTraceEntityId: string;
  readonly totalTouchUnits: string;           // uint128精确总量
  readonly aggregateStrength: number;        // min(65535,totalTouchUnits)
}
interface DeveloperRosterState {
  readonly worldDeveloperAccountId: string;
  readonly coDeveloperAccountIds: readonly string[];
  readonly frozen: boolean;
}
interface SharedWorldState {
  readonly schemaVersion: 1;
  readonly profile: 'ExternalSharedOnlineV1';
  readonly worldId: string;
  readonly mapId: string;
  readonly contentManifestSha256: string;
  readonly entities: readonly SharedEntityRecord[];
  readonly triggers: readonly SharedTriggerRecord[];
  readonly revealedResidueEntityIds: readonly string[];
  readonly traceTouches: readonly TraceTouchAggregate[];
  readonly developerRoster: DeveloperRosterState;
}
interface WorldChangeLogWire {
  readonly schemaVersion: 1;
  readonly profile: 'ExternalSharedOnlineV1';
  readonly worldId: string;
  readonly genesisSha256: string;
  readonly baseCheckpointSha256: string | null;
  readonly developerClosure: SharedAuthorityReceipt<WorldDeveloperClosureFact> | null;
  readonly commits: readonly AdmittedWorldCommit[];
}
```

entity/trigger数组按稳定ID排序，触痕按traceTouchId、显露ID与coDeveloperAccountIds按ASCII排序，重复拒绝。tombstone保留定义的最后有效位置/身份用于冲突/迟到诊断，不再参与运行；位置不可靠时用原正式内容锚点，不能执行未验证正文定位。最初定义和普通地图属性不含个人账本或20维向量。MapDeveloperRoster是共享权限态；成员设备名单、AccessCode、群key、CSRF、会话和账号通关均不在该state内。

### 6.1 确定性单步状态规则

“存在/有效目标”指record存在且deletedBy=null；used ID集合从所有active record+tombstone重建。target ID与definition ID逐字相等，否则InvalidChange。Genesis记录createdBy/lastEditedBy/deletedBy均null，frozen=false、coDeveloper列表和显露/触痕初值由受信Genesis明确给出；Genesis触痕total可非零但须同样有可验证正式来源，不能信任文件自填累计数。

验证次序：精确字节与claim/receipt来源→envelope签名/AEAD→全部字段与manifest来源→总序权限→有效目标/业务操作→应用。InvalidChange永不因改包/换号被重新应用；未知成员/权限事实是Gap而非自报有效。表内diagnostic仅在有效封边后成为个人诊断边界，本轮不生产叙事。

| 合法来源的输入 | applyResult / finalDiagnostic（本边界） | 精确状态更新 |
|---|---|---|
| MonotonicReveal有效Residue、尚未true | Applied / null | 显露ID集合加入一次并重排，不更新地图record |
| 重复显露true / 已删除Residue | NoEffect / null | 不改状态；不复活 |
| 显露未知ID或非Residue | InvalidChange / InvalidChange | 不改状态 |
| TraceTouch有效Normal、总量未溢出 | Applied / null | 对同traceTouchId精确+1；不存在聚合record时从0建；aggregateStrength重算 |
| TraceTouch目标已删且历史manifest资格正确 | NoEffect / null | 现有聚合保留不增；无聚合则不建 |
| 触痕未知/非Normal/不匹配/溢出 | InvalidChange / InvalidChange | 不改状态，不生成个人异常痕 |
| 地图作者在该位置无MapEditPermission | RevertedEdit / RevertedEdit | 不改状态；无旧名单完整证明先Gap |
| Create有效从未使用ID | Applied / null | 建record，definition=传入值，createdBy=identity，lastEditedBy=identity，deletedBy=null |
| Create已经active或tombstone的ID | NoEffect / MergeConflict | 不改状态，禁止复用 |
| Replace有效目标且定义不同 | Applied / null | 替换definition，createdBy不变，lastEditedBy=identity，deletedBy=null |
| Replace有效目标且JCS定义相等 | NoEffect / null | 不改record/lastEditedBy，不产生新胜者 |
| Replace已删除目标 | NoEffect / MergeConflict | 不改状态，不复活 |
| Delete有效目标 | Applied / null | 保留definition/createdBy，lastEditedBy=identity，deletedBy=identity；触发器运行可用性由active引用派生，不级联删除 |
| Delete已删除目标 | NoEffect / null | 保留原删除身份，不制造第二次删除冲突 |
| Replace/Delete未知ID、非法引用、Create/Replace初始悬空Trigger | InvalidChange / InvalidChange | 不改状态；现有Trigger因后来anchor删除而停用保留，与新造悬空不同 |
| Add/Remove合法CoDeveloper，确有集合差 | Applied / null | coDeveloper列表增/删并重排；不改群成员epoch |
| 重复Add已在/Remove已不在 | NoEffect / null | 不改状态 |
| 名单修改作者非WorldDeveloper、已注销/frozen | RevertedEdit / RevertedEdit | 不改名单，不转让权限 |
| 名单目标是WorldDeveloper本人，或Add目标不是该时刻有效WorldObserver | InvalidChange / InvalidChange | 不改名单；缺成员事实先Gap，不由自报授权；Remove不要求目标仍有效 |

实体Replace不改elementType/Normal身份/等级，地图引用必须指向批准内容；已存在且未编辑的悬空Trigger保持停用，不因别的对象编辑自动改record。合法后序Replace/Delete覆盖同target较早有效修改时，更新胜者record并标记先前编辑的终局MergeConflict（见§7），不把地图旧操作逆向执行。MonotonicReveal/TraceTouch不修改record的地图编辑归因字段。

TraceTouch每个唯一**成功应用**提交加1，重复与covered提交加0；总量uint128溢出拒绝且保留原值，不环绕，渲染强度饱和到65535，无衰减/访客数/排名。饱和只影响渲染，精确总量保留，不能用饱和值推断“他人贡献”。自身贡献是私人数据，将来由本人已确认提交导出/恢复并与覆盖边界一致；不在shared/checkpoint存访客表。本人贡献不完整时返回Unknown，不据此生成EchoTrace。本轮不实现EchoTrace，也不废除031“精确扣自己后才生成”的条件；个人贡献恢复归P4细化，不能新增第八项Core或裸个人key。

“不记录身份”仅指traceTouches聚合投影；签名原始提交、coverage与权限态有作者ID，Relay能看到作者/设备/时间/类别，**不承诺端到端匿名**。实体编辑署名与DeveloperRoster不是触痕访客表。Log只容纳三类提交，不容纳NarrativeEvent、Ledger、七项Core或迁移journal。verified shared base与未获准候选overlay分开；失败/迟到撤回overlay，不撤销个人正常结算。

## 7. 检查点覆盖与结算证明

```ts
interface RelaySettlementSeal {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly sealRevision: number;
  readonly policySha256: string;
  readonly issuedAtServerEpochMs: number;
  readonly sealedThroughEpochMs: number;        // 包含边界
  readonly admittedCommitCount: number;
  readonly admittedPrefixSha256: string;
  readonly developerClosureSha256: string | null; // 仅已在此边界生效的closure
  readonly previousSealSha256: string | null;
}
interface CheckpointCoverageEntry {
  readonly identity: WorldCommitIdentity;
  readonly envelopeSha256: string;
  readonly appendedAt: SharedAppendedAt;
  readonly admissionRevision: number;
  readonly applyResult: 'Applied' | 'NoEffect' | 'RevertedEdit' | 'InvalidChange';
  readonly finalDiagnostic: 'MergeConflict' | 'RevertedEdit' | 'InvalidChange' | null;
}
interface WorldCheckpointWire {
  readonly schemaVersion: 1;
  readonly profile: 'ExternalSharedOnlineV1';
  readonly worldId: string;
  readonly genesisSha256: string;
  readonly parentCheckpointSha256: string | null;
  readonly coveredThroughEpochMs: number;
  readonly settlementSeal: SharedAuthorityReceipt<RelaySettlementSeal>;
  readonly developerClosure: SharedAuthorityReceipt<WorldDeveloperClosureFact> | null;
  readonly coverage: readonly CheckpointCoverageEntry[];
  readonly coverageSha256: string;
  readonly state: SharedWorldState;
  readonly stateSha256: string;
  readonly checkpointSha256: string;
}
```

覆盖是**时间前缀+精确ID/摘要结果集**，不是每作者最大序号；号码段有洞，不能maxSequence吞迟到/遗漏号。coverage按总序，其appendedAt/admissionRevision从已验证permit/admission取得并保留，不能清正文后失去重算排序的字段。覆盖全部≤coveredThrough的admitted条目，包括正文业务拒绝/NoEffect，用于不复活/不重复诊断。序号从其他world耗用不在此coverage。prefixSHA=SHA256(JCS(时间前缀的有序{identity,envelopeSha256,appendedAt}数组))；developerClosureSha256独立绑定≤此边界的签名注销fact或null。seal由轻量权威对其已admitted摘要账证明，不保存state或checkpoint。服务封边后拒绝任何**新的**appendedAt≤sealedThrough提交；原admitted重取receipt不成为新的提交。

新seal边界必须≤该seal签发的可信服务时刻S−H，且≥上一seal边界；S<H时没有可封边非负时间前缀。外层receipt.issuedAtServerEpochMs与seal.issuedAtServerEpochMs相等，policy hash/clock generation必须可信，coveredThroughEpochMs严格等于相应seal.sealedThroughEpochMs。相同边界重取沿用原seal，不能换prefix，上一seal哈希/实例/world一致。两次seal间不追加旧边界事实；若账号事实生产者无法提供不回填保证则该能力不得上线。

applyResult表示完整有序重放到该项时的单步结果；finalDiagnostic表示**截至该封边已经成立**的不可逆个人诊断，null只表示此边界尚无诊断，不许诺永久赢家。已应用后又被覆盖的编辑可以是Applied+MergeConflict，不能在重放时因为finalDiagnostic而跳过它，否则会破坏后续存在性/引用检查。未封边的赢家/权限/冲突均为provisional；从稳定checkpoint重放尾部可以改暂态结果，只有seal后才形成终局不复活与一次个人诊断。

父checkpoint的identity/摘要/时间/admissionRevision/applyResult在后代coverage不可改，已有非null finalDiagnostic不可回退/换因；唯一可演进为null→MergeConflict，须新的**已封边**合法同target Replace/Delete实际覆盖父state.lastEditedBy所指的旧MapEditCommit。该新commit及父state/父checkpoint链给出可验证覆盖理由，不能凭远端声明改诊断。新checkpoint重算coverageSha，但旧checkpoint字节永不回写；本地个人诊断按旧identity去重一次。已输家不恢复，已经记录的RevertedEdit/InvalidChange不转成Applied；Genesis null归因不产生作者冲突。沿用035被覆盖修改的诊断，不擅加“同账号豁免”：同一账号两设备产生的冲突同样保留；v1不另造并发豁免规则。

stateSHA=SHA256(JCS(state))；coverageSHA=SHA256(JCS(coverage))；checkpointSHA=SHA256(JCS(除checkpointSha256外全部checkpoint))。parent链/Genesis/world/内容必须一致，coveredThrough只增不减。生成时从可信本地Genesis或父checkpoint开始；可信父覆盖前缀继承其已验证state/coverage，不要求重新取得按规范已清掉的旧正文。新增后缀必须每项精确字节验摘要、总序重放、同ID冲突排除、权限与业务结果一致；父coverage+新后缀的完整准入前缀count/digest等于seal。新增正常项必须原始签名/正文验真；无效项只有在可信admissionClaim/receipt和完整字节摘要完全相等后才可确定InvalidChange并纳入coverage。没有可信父而从Genesis独立验证陌生checkpoint时，必须有完整前缀原始证据，不能继承陌生快照自称的验证。存储耐久并回读后才清正文log；coverage身份/摘要/结果保留，不凭hash抹去迟到/拒绝记忆。

admission只承诺header和不可逆摘要，可能准入恶意作者签出的坏envelope。已验claim与receipt、完整字节exact digest相等之后，非法canonical JSON/作者envelope签名/AEAD/schema可确定为InvalidChange；不应用、不执行不可信坐标/动作、不生成来自未验证payload的叙事事件，仅本地技术诊断。若字节缺失、摘要不匹配、claim/receipt不可信或缺对应epoch群key，则是Gap/KeyUnavailable，不能凭网络替换字节伪造终局拒绝，不能推进checkpoint。中继可拒队列坏envelope并报告缺载，轻量准入摘要不因此删除；只有合法源持有者带回精确字节才能完成该项判断。

本轮冻结**本地验证后checkpoint**；序列化brand不可信，hash或任意成员签名不能证明state=正确重放。收到陌生checkpoint必须有可验证Genesis/前缀重放证据或既有可信本地同hash边界；没有则CheckpointUnverifiable，保留源，不接到主链、不对它ACK。P4须补完整FileCarry的外部checkpoint来源认证/可重放证据，不用b账号登录或文件发送者签名代替。codec字段冻结不等于陌生快照可直接授Complete；Relay不提供checkpoint给缺历史客户端。

coverage清理/可验证压缩是后续格式版本工作；v1保留每身份摘要，不冒称无限历史在固定空间可精确去重。bounded队列不保证bounded本地历史元数据。seal阻断新旧时刻提交、coverage处理已admitted重复，两者分工；Gap、未知前缀、未处理本机候选或时钟失信均禁止推进checkpoint。

## 8. 迟到、顺序和诊断

迟到采用权威一贯的事件时间规则：未admitted提交在当前可信服务时刻S满足S-appendedAt>SettleHorizonMs，或appendedAt≤sealedThrough，即TimeTooLate；在线permit过期更早拒绝PermitExpired，不伪装成TimeTooLate。拒绝优先级为已接受同摘要幂等重取→身份/来源/签名验证→IdentityConflict→EpochClosed→PermitExpired→TimeTooLate→准入。已及时admitted且在完整封边前缀内的历史提交不因“今天才拉取”重新变为Orphan；缺历史为Gap，需用户合法文件补齐，不回写旧checkpoint。这样arrival时间不让两端对同一accepted前缀作相反裁决。

真实TimeTooLate须有SharedAuthorityReceipt<WorldCommitRejection>绑定已验证身份/摘要/AppendedAt及未曾admitted事实；接收文件端核对该receipt或向真实权威核实，不能凭文件自称过期或本地墙钟生成Orphan。此online profile的30秒许可通常先触发PermitExpired，不能借它构造真实离线迟到验收；028完整离线语义仍在未来批准profile保持，当前只冻结可识别的拒绝证明接口。

无admission、旧三元、错身份、未经可信摘要绑定的坏签名/错epoch/非法来源输入只隔离，不把不可信随机网络垃圾转为叙事异痕。可信摘要绑定的坏正文按§7技术InvalidChange分类，同样不授叙事事实。**真正TimeTooLate拒绝**沿用028：本机共享暂态撤回，每个客户端在自己的个人层按commitID一次生成Common/Anomalous/OrphanCommit；已拒变化永不重新应用、重新号/改密文不能复活。未封边地图冲突/撤权是暂态结构化结果，seal终局后才按035输出一次MergeConflict/RevertedEdit；诊断是个人层，不能上传为WorldCommit或生成TraceTouch。c只给结构化诊断边界，不在本轮或未授权阶段自动接S5/表现。

撤权判断以提交总序的DeveloperRoster为准；新到较早合法名单变更可以使未结算尾部重放结果改变，必须从稳定checkpoint重放尾部，不在已结算前缀插入。相同Identity异摘要属于IdentityConflict，不以last-writer-wins选正文。有限片段范围重放和保存原候选是确定性要求，不修改已经入个人账本的事件。

## 9. 延迟、保留、cursor和future ports

```ts
interface SharedSettlementPolicy {
  readonly schemaVersion: 1;
  readonly offlineGraceMs: number;
  readonly boundedRelayDelayMs: number;
  readonly timeUncertaintyAllowanceMs: number;
  readonly settleHorizonMs: number;
  readonly retentionMs: number;
}
interface RelayCursor {
  readonly relayGeneration: number;
  readonly position: string;             // 0或非零首位十进制uint64
}
type RelayPullReply = {
  readonly kind: 'Batch'; readonly worldId: string;
  readonly after: RelayCursor; readonly next: RelayCursor;
  readonly commits: readonly AdmittedWorldCommit[];
  readonly retentionFloor: RelayCursor;
} | {
  readonly kind: 'Gap'; readonly worldId: string;
  readonly after: RelayCursor; readonly retentionFloor: RelayCursor;
  readonly reason: 'RetentionExpired' | 'RelayGenerationChanged' | 'MissingAdmittedEnvelope';
};
interface SharedAuthorityReceipt<T> {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly purpose: 'SequenceSegment' | 'WorldAppendPermit' | 'WorldCommitAdmission' | 'WorldCommitRejection' | 'AuthorKeyBinding' | 'RelaySettlementSeal' | 'WorldMembership' | 'WorldDeveloperClosure';
  readonly receiptId: string;
  readonly keyId: string;
  readonly requestNonce: string;
  readonly issuedAtServerEpochMs: number;
  readonly clockGeneration: number;
  readonly clockStatus: 'Trusted';
  readonly payload: T;
  readonly signatureBase64Url: string;
}
interface RealCommitRelayProtocolPort { // 文档候选接口名，不改b泛型port
  readonly mode: 'ExternalService';
  submit(commit: AdmittedWorldCommit): Promise<unknown>;
  pull(worldId: string, after: RelayCursor, maximumWaitMs: number): Promise<unknown>;
  acknowledge(worldId: string, durableThrough: RelayCursor): Promise<unknown>;
}
```

H≥G+B+U，retention≥H；G当前3600000ms，B为最后合法生成/离线结束后到全部活跃已知观察者取得或被标明Gap的最大补发/排队/拉取/退避/本机耐久时间，**不是25秒长轮询超时**。U为时间区间保守余量；online许可不确定/过期按期限失败。初始开发政策B=300000、U=60000、H=3960000、retention=86400000ms，policy固定hash。24小时仅因该配置不等式成立而可用；更长B/G必须重新验证，超24h拒部署或提高retention，不能静默改H。

网络任意故障不能保证有限B。B是进程健康/网络最终恢复/活跃观察者及时拉取/耐久成功的**条件性假设**。超过B或发现Gap即BoundViolated，冻结checkpoint推进/拒称已全量，保留候选与原数据；允许游戏的个人事实正常结算，不自动延OfflineGrant、结束暂停或改变T7。seal只证明准入摘要前缀封闭，不证明所有观察者已经拿到正文，更不证明可见共享状态正确。

retention从各提交admittedAt算，作为配置的**最短密文保留期**；早于admittedAt+retentionMs不得因全部ACK而清密文，否则会绕过retention≥H。到期可以清队列，尚未ACK设备下一次拉取必须Gap，不伪称收件。ack不得由只解密/只看UI/尚未验证本地存储的客户端发送；完整commit验证并耐久后即可ACK，不要求等待H产生checkpoint。join新设备不追溯旧消息ACK集合，撤销可移出交付集合，但不会让尚活跃未ACK的设备被当成功收件。队列删除仍保留必要幂等摘要/轻量receipt到最大重试窗口；已封边旧时刻一律不新准入。无限离线成员不是无限保留承诺。

cursor是接收顺序，不是作者序号/事件总序/覆盖边界；重启保持持久generation，只有队列重建/确证丢段才加generation并返回Gap。batch按cursor升序，最多256条、规范响应≤1MiB，单条≤64KiB；maximumWaitMs为0..25000。Gap无“跳过即成功”，不得把next cursor当已恢复state。正式返回类型、路由/错误/CSRF/wire的可执行绑定留c-1，当前b RealCommitRelayPort泛型和同步archive签名不改。

## 10. 成员、根pin与密钥交接

详见membership-and-security.md，属于本规范必需部分。成员设备、AccessCode verifier、DeveloperRoster权限镜像、seq段、permits/admission摘要/seal都是轻量事实；正文只通过Relay有限密文队列或用户携带；**群key包不进Relay正文、Auth云key vault或WorldCommit**。服务不保存明文群key、完整共享state、checkpoint或个人数据。

源码能力为零，本规范未新增逻辑依赖，未引用cc。新suite、时间profile、个人self-contribution恢复/外部checkpoint验证、旧身份迁移与world服务首次注册入口都有下文明确前置，不能从Markdown复制类型后绕过实施授权。
