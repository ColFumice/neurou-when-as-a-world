# 名库 v3.17 附录提案 · P3 共享契约补冻

2026-10-11（Asia/Shanghai）。交 Trae 落盘；本文件不修改 `docs/NAMEBOOK.md`、参照记录或既有源码。依据本轮 VERDICT-391～410、`contracts-draft.md` 与 `membership-and-security.md`。**“已冻结”指本轮纯文档契约名称、字段和值域；不表示已经存在 TypeScript 导出、codec、ContractAdapter、真实 Relay、世界编辑器入口或产品 ObserverSync。** 文档接口中的 `unknown` 是未来验证边界，不能作为正文 schema 的宽松旁门。

本附录只列本轮增补及必须纠正的历史关系。精确字段白名单和签名输入以本轮契约规范为准；后续实现不得按下面的简写遗漏必填字段、放宽值域、混用历史 fixture 或导出未批准的平台能力。

## 1. 历史沿用与新旧格式边界

| 历史名称 | 本轮处理 |
|---|---|
| WorldCommit / AppendedAt / WorldChangeLog / SharedWorldState | 沿用语义；新 ExternalService schema 1 增补精确数据形状，archive 空骨架不改。共享提交不含 NarrativeEvent、Ledger、任何 20 维向量或七项 Core。AppendedAt 值仍为 `{epochMs:number}`，共享来源规则不回改账本时钟。 |
| CommitClass | 沿用最新历史值 `Monotonic / AddOnly / RestrictedWrite`；历史 VERDICT-035 已将 SingleWriter 改名，不能重新冻结 SingleWriter。新 WorldChangeClass 是精确正文判别，两者严格映射。 |
| MapEditCommit / MapEditPermission / WorldDeveloper / CoDeveloper / DeveloperRoster / EditTarget | 沿用 VERDICT-035：地图允许名单内写入者，名单变更仅 WorldDeveloper；按单个实体或 Trigger 定义合并，无共享编辑锁。新 schema 不把权限退回“仅 WorldDeveloper 编辑地图”。 |
| SharingCriteria | 沿用三条件及 035 修订的“只有授权写入者能写”；所有新变化均须满足，与个人账本/进度分离。 |
| TraceTouch / EchoTrace / TraceOrigin | TraceTouch 是共享聚合投影，只有 Normal 来源痕收集可产生；Echo/Anomalous/Recall/Replay 不产生。EchoTrace 属个人层，沿用精确扣自身贡献后仍有他人部分的条件，本轮不实现。 |
| WorldCheckpoint / SettleHorizon | 沿用本地检查点、足够早且完整的结算前缀、迟到不纳入。服务器不保存共享状态/检查点。 |
| AnomalyCause / OrphanCommit / MergeConflict / RevertedEdit | **历史名称，不是本轮新增。** 028/035 的终局拒绝、个人诊断和不复活语义保留；未结算暂态不能冒称已产生终局异痕。 |
| AccessCode | 沿用 6 位数字、首次准入、修改不踢旧成员；是准入门槛，不是 WorldRelayKey、账号 key 或其派生材料。 |
| Observer / WorldObserver / ObserverLayer / ObserverSync / ObserverSyncChannel / FileCarry / CommitRelay | 沿用分层与传输边界。本轮仅契约补冻，不开启产品 ObserverSync、首次加入 UI、完整 FileCarry 或真实 Relay。 |
| OfflineGrace / OfflineGrant / RegisteredCredential / PhysicalDevice | 已批准 Web 仅 RegisteredCredential；本轮不授 OfflineGrant、不用应用运行时长或墙钟模拟平台 OfflineGrace，不提高设备可信级。 |
| ExternalService / RealCommitRelayPort / RealWorldAuthorityPort / RealAuthServicePort | 沿用 B2.5b 真实模式与独立端口；不改旧同步签名、b 泛型保留端口、fixture guard 或失败路由。 |

本轮用户明确的新 `WorldCommitIdentity` 为 `authorAccountId + authorSequence`。历史 VERDICT-027 三元“账号＋设备＋序号”仍保留其历史解释；新 schema 显式拒绝 `LegacyIdentityUnsupported`，不拼接、去设备字段、重键或静默迁移。设备/世代保留在来源认证、序号段和签名绑定中，不参加新身份的唯一键。旧格式兼容/迁移需要独立授权。

## 2. 已冻结的新增契约类型名

以下是文档名称；字段均 readonly，所有对象使用精确字段白名单，显式 null 表示无值。无字段授权的运行时实现类、文件名或模块放置不从本表推导。

| 名称 | 字段与职责 |
|---|---|
| WorldCommitIdentity | `authorAccountId`、`authorSequence`；同 serviceInstanceId 的作者账号全部世界共用分配序列，序号 1..MAX_SAFE_INTEGER，不复用、不环绕。 |
| SharedAppendedAt | 文档结构别名，字段 `epochMs`；值为非负安全整数。线上由服务签名 permit 给出逻辑追加时刻，正文/外壳相等、签名与 AEAD 绑定。 |
| AuthorSequenceSegment | `schemaVersion`、`serviceInstanceId`、`segmentId`、`authorAccountId`、`authorDeviceId`、`authorDeviceGeneration`、`worldId`、`membershipEpoch`、`firstSequence`、`lastSequence`、`issuedAtServerEpochMs`、`expiresAtServerEpochMs`；含两端点的 1024 个号码，绑定设备/世界/epoch。 |
| WorldAppendPermit | `schemaVersion`、`serviceInstanceId`、`permitId`、`requestNonce`、`worldId`、`identity`、`authorDeviceId`、`authorDeviceGeneration`、`segmentId`、`membershipEpoch`、`keyEpoch`、`changeClass`、`appendedAt`、`expiresAtServerEpochMs`、`clockGeneration`、`clockStatus`；一次准入时间许可，不是离线时间证明。 |
| WorldCommitAdmissionClaim | `schemaVersion`、`serviceInstanceId`、`requestNonce`、`header`、`envelopeSha256`；作者向轻量权威提交的外层准入声明，不向权威发送正文、密文字节、世界状态、检查点或个人层。 |
| SignedWorldCommitAdmissionClaim | `claim`、`authorSignatureBase64Url`；与 WorldCommit 正文作者签名分域，签名/摘要绑定必须与最终 envelope 一致。不是成员匿名凭据。 |
| WorldCommitAdmission | `schemaVersion`、`serviceInstanceId`、`worldId`、`identity`、`envelopeSha256`、`appendedAt`、`admittedAtServerEpochMs`、`admissionRevision`、`membershipEpoch`、`rosterTargetObserverActiveAtAppendedAt`；admissionRevision 在 world 范围内分配，不是作者序号；最后字段 boolean/null，仅 AddCoDeveloper 使用服务可信轻量事实判断目标在 AppendedAt 的有效 Observer 资格，Remove 与其他变化为 null。轻量准入事实不能代替本地正文合法性/重放验证。 |
| WorldCommitRejection | `schemaVersion`、`serviceInstanceId`、`worldId`、`identity`、`envelopeSha256`、`appendedAt`、`rejectedAtServerEpochMs`、`reason`、`previouslyAdmitted:false`；真实拒绝证明，不把未经认证文件或本地墙钟当 TimeTooLate。 |
| WorldAuthorKeyBinding | `schemaVersion`、`serviceInstanceId`、`authorAccountId`、`authorDeviceId`、`authorDeviceGeneration`、`authorSigningPublicJwk`、`authorSigningKeyFingerprint`、`registeredAtServerEpochMs`、`assurance:'RegisteredCredential'`；受信服务根签名的历史作者公钥绑定，当前撤销不抹掉已经准入的历史证明。 |
| WorldDeveloperClosureFact | `schemaVersion`、`serviceInstanceId`、`worldId`、`worldDeveloperAccountId`、`effectiveAtServerEpochMs`、`accountFactRevision`；未来可信账号注销生产者的签名轻量事实，同毫秒先于 WorldCommit 生效，不能回填已封边前缀。本轮不实现账号注销 API。 |
| WorldChangeClass | 精确字面值 `MonotonicReveal / TraceTouch / DeveloperMapChange`。 |
| SharedCommitClass | 文档中的历史 CommitClass 映射类型：`Monotonic / AddOnly / RestrictedWrite`；不是第四种合并模型。 |
| MonotonicRevealChange | `changeClass:'MonotonicReveal'`、`commitClass:'Monotonic'`、`entityId`、`revealed:true`；只针对有效 Residue 的单向共享显露。 |
| TraceTouchChange | `changeClass:'TraceTouch'`、`commitClass:'AddOnly'`、`traceTouchId`、`normalTraceEntityId`、`touchUnits:1`；正文不含访客表、账本、得分或个人进度。 |
| MapEditCommitChange | `changeClass:'DeveloperMapChange'`、`commitClass:'RestrictedWrite'`、`subtype:'MapEditCommit'`、`edit:MapEditOperation`；**一条提交只有一个对象、一个操作**，一次编辑器明确保存可产生多条独立提交，不以 atomic 多目标批次牵连其他对象。 |
| DeveloperRosterChange | `changeClass:'DeveloperMapChange'`、`commitClass:'RestrictedWrite'`、`subtype:'DeveloperRosterChange'`、`operation`、`accountId`、`observerAdmissionRevision`；operation 只有 AddCoDeveloper/RemoveCoDeveloper，均引用已验证的旧 AdmissionFact；Add 另须目标在 AppendedAt 的有效 Observer 资格，Remove 不要求目标今天仍 active，不让已撤销 Observer 阻碍移出开发者名单。 |
| WorldChange | 上述四个结构的 discriminated union；后三类中的地图与名单 subtype 都属于第三类，没有第四种 changeClass。 |
| MapEditOperation | CreateEntity/ReplaceEntity/DeleteEntity/CreateTrigger/ReplaceTrigger/DeleteTrigger；`operation`、`target`，创建/替换另有 `definition`，删除不得附任意 definition。 |
| SharedPosition | `lateralMilli`、`depthMilli`；整数 milli WorldMeter 表示，不替换旧核心坐标类型。 |
| SharedContentReference | `contentId`、`contentSha256`；必须被正式批准 manifest 唯一解析，不是 URL、脚本、下载权或任意资源引用。 |
| SharedMapEntityDefinition | `entityId`、`elementType`、`position`、`content`、`normalTrace`；elementType 为 Initial/Process/Trace/Residue；normalTrace 为 null 或 `{traceTouchId,tier}`，仅正式 manifest 可证明 Normal 资格。 |
| SharedTriggerDefinition | `triggerId`、`anchorEntityId`、`activation`、`action`；activation 为 Proximity/radiusMilli 或 Interaction；v1 action 只 RevealResidue/targetEntityId，不含任意表达式/个人解谜状态。 |
| WorldSharedGenesis | `schemaVersion`、`profile`、`worldId`、`mapId`、`contentRevision`、`contentManifestSha256`、`worldDeveloperAccountId`、`developerTrustAnchor`、`initialState`；受信本地共享起点，不上传。 |
| RestrictedWriteHeader | null 或 MapEditCommit subtype 或 DeveloperRosterChange 的轻量名单 delta；不公开地图对象/位置/Trigger 正文，不是完整 SharedWorldState。 |
| RelayCommitHeader | `schemaVersion`、`profile`、`kind`、`serviceInstanceId`、`worldId`、`identity`、`authorDeviceId`、`authorDeviceGeneration`、`authorSigningKeyFingerprint`、`segmentId`、`permitId`、`membershipEpoch`、`keyEpoch`、`worldRelayKeyId`、`appendedAt`、`changeClass`、`commitClass`、`restrictedWrite`、`cipherSuite`。 |
| WrappedRelayDataKey | `nonceBase64Url`、`ciphertextAndTagBase64Url`；正文新随机 DEK 的群域包装，不是账号个人层 key 包。 |
| RelayCommitEnvelope | `header`、`wrappedCommitDataKey`、`nonceBase64Url`、`ciphertextAndTagBase64Url`、`authorSignatureBase64Url`；重试复用同一完整字节，不重新随机加密/签名。 |
| AdmittedWorldCommit | `envelopeBytesBase64Url`、`appendPermitReceipt`、`sequenceSegmentReceipt`、`admissionReceipt`、`admissionClaim`、`authorKeyBindingReceipt`、`membershipEpochReceipt`、`rosterObserverAdmissionReceipt`；最后字段仅名单 subtype 为对应签名事实，其他变化必须 null，裸 observerAdmissionRevision 不是授权证据。envelope 为精确 UTF-8 字节的 canonical base64url，先验证受信摘要再 unknown 解析，保留已准入坏正文的可验证分类能力；缺字节/错摘要仍是 Gap。对方仍须验签/解密/严格正文/权限校验。 |
| SharedEntityRecord / SharedTriggerRecord | `definition`、`createdBy`、`lastEditedBy`、`deletedBy`；null 有明确 Genesis/未修改/未删除含义；tombstone 永久阻止同 ID 复活。 |
| TraceTouchAggregate | `traceTouchId`、`normalTraceEntityId`、`totalTouchUnits`、`aggregateStrength`；exact uint128 总量与饱和画面强度分开，不保存贡献者列表。 |
| DeveloperRosterState | `worldDeveloperAccountId`、`coDeveloperAccountIds`、`frozen`；不承载成员设备、AccessCode、群 key、会话或通关事实。 |
| WorldChangeLogWire | `schemaVersion`、`profile`、`worldId`、`genesisSha256`、`baseCheckpointSha256`、`developerClosure`、`commits`；developerClosure 为签名事实或 null，不是 WorldCommit 第四类；签名提交总序日志的 wire 载体，不是事务 journal。 |
| RelaySettlementSeal | `schemaVersion`、`serviceInstanceId`、`worldId`、`sealRevision`、`policySha256`、`issuedAtServerEpochMs`、`sealedThroughEpochMs`、`admittedCommitCount`、`admittedPrefixSha256`、`developerClosureSha256`、`previousSealSha256`；只证明准入摘要前缀封闭，不证明正文/state 或全员收件正确。 |
| CheckpointCoverageEntry | `identity`、`envelopeSha256`、`appendedAt`、`admissionRevision`、`applyResult`、`finalDiagnostic`；时间/身份/摘要结果保留，号码段有洞，不能用最大作者序号代替精确覆盖。applyResult 与终局诊断分开。 |
| WorldCheckpointWire | `schemaVersion`、`profile`、`worldId`、`genesisSha256`、`parentCheckpointSha256`、`coveredThroughEpochMs`、`settlementSeal`、`developerClosure`、`coverage`、`coverageSha256`、`state`、`stateSha256`、`checkpointSha256`；只本地，developerClosure 是签名事实或 null，hash 本身不授予陌生 checkpoint 可信性。 |
| SharedSettlementPolicy | `schemaVersion`、`offlineGraceMs`、`boundedRelayDelayMs`、`timeUncertaintyAllowanceMs`、`settleHorizonMs`、`retentionMs`；固定 policy hash，变更不能静默改变已封边历史。 |
| RelayCursor | `relayGeneration`、`position`；队列接收位置，与作者序号/事件总序/结算边界分开。 |
| RelayPullReply | Batch 或 Gap 的纯数据载体；共有 worldId/after/retentionFloor，Batch 有 next/commits，Gap 有 reason。正式 API 返回码/route/CSRF 绑定留 c-1。 |
| SharedAuthorityReceipt<T> | `schemaVersion`、`serviceInstanceId`、`purpose`、`receiptId`、`keyId`、`requestNonce`、`issuedAtServerEpochMs`、`clockGeneration`、`clockStatus:'Trusted'`、`payload`、`signatureBase64Url`；purpose 与 b 的认证/服务器时间 receipt 分域。 |

WorldCommit、SharedWorldState、EditTarget 和 WorldCheckpoint 是历史概念的本轮精确增补，不列为全新产品机制。新 SharedWorldState 字段为 `schemaVersion/profile/worldId/mapId/contentManifestSha256/entities/triggers/revealedResidueEntityIds/traceTouches/developerRoster`；新 WorldCommit 明文为 `schemaVersion/profile/worldId/mapId/contentManifestSha256/identity/authorDeviceId/authorDeviceGeneration/segmentId/permitId/membershipEpoch/keyEpoch/appendedAt/change`。

## 3. 已冻结字段值域与契约常量

这里冻结 wire 值、政策字段与默认值。UPPER_SNAKE_CASE 源码标识属于 §5 候选，不表示本轮向 constants 新增导出。

| 字段/契约值 | 冻结值域或规则 |
|---|---|
| schemaVersion / profile / mode | 新共享 schemaVersion=1；profile 逐字 ExternalSharedOnlineV1；真实 port mode 逐字 ExternalService。历史 fixture 不自动套新 profile。 |
| kind / cipherSuite | Relay header kind=RelayWorldCommit；cipherSuite=AES-256-GCM-HKDF-SHA256-v1。未知 suite 不宽松降级。 |
| authorAccountId / worldId / deviceId / permitId / segmentId / 稳定对象 ID | 小写 canonical UUID；同一 world 内对象/触痕 ID 永不复用。serviceInstanceId 与受信部署配置匹配，不把跨服务序号默认为同域。 |
| serviceInstanceId | 沿用 b 的 ASCII `[A-Za-z0-9_.-]{3,128}`，逐字等于安装 pin 配置；不是 UUID 或跨实例通用域。 |
| receipt.keyId / developerSigningKeyId / worldRelayKeyId | 前两者为各自 P-256 公钥 RFC7638 SHA256 无填充 base64url 指纹且等于对应 pin；群 worldRelayKeyId 单独为新 canonical UUID，不能混用服务/开发者签名 keyId。 |
| authorSequence / firstSequence / lastSequence | 安全整数，authorSequence≥1；每段含两端点正好 1024 号，账号事务分配，不归还、不复用，耗尽拒绝。 |
| authorDeviceGeneration / membershipEpoch / keyEpoch / revision | 实际生效世代/epoch/revision≥1 的安全整数；旧 epoch 不自行升级，新 key 不从旧 key 推导。 |
| epochMs / issuedAtServerEpochMs / expiresAtServerEpochMs | 非负安全整数；序号段寿命 3600000ms；在线许可期限 appendedAt+30000ms；服务时刻 S≥expiresAt 即过期，不含到期端点；失信或缺服务证明拒绝。 |
| requestNonce | canonical base64url 编码的 32 随机字节；签名 receipt 与请求逐字绑定。 |
| Sha256 字段 | 64 位小写 hex；对规定 JCS/UTF-8 字节摘要，不 hash 运行时对象。 |
| authorSigningKeyFingerprint / 根 key fingerprint | EC/P-256 JWK 的 RFC7638 SHA256 无填充 base64url，沿用 b；不是短名或未验证响应自带公钥。 |
| lateralMilli / depthMilli | -1000000000..1000000000 整数；1000=1 WorldMeter；禁止浮点/负零，不改既有坐标。 |
| contentId | ASCII `[A-Za-z0-9_.:/-]{1,128}`，与 contentSha256 在批准 manifest 内唯一对应。 |
| radiusMilli | 1..1000000 整数；target/anchor ID 必须在有效定义中存在、类型相符。 |
| revealed / touchUnits | 分别固定 true / 1，不允许隐藏、衰减、负贡献、任意强度增量。 |
| totalTouchUnits | canonical 无前导零十进制字符串，0..2^128-1；不转 JS number，溢出拒绝。 |
| aggregateStrength | `min(65535,totalTouchUnits)` 的精确整数；只用于画面，不以饱和值推断他人贡献。 |
| authorSignatureBase64Url / signatureBase64Url | ES256/P1363，64 字节；base64url 无填充且重编码逐字一致。 |
| nonceBase64Url / wrappedCommitDataKey.ciphertextAndTagBase64Url | AES-GCM 独立 12 字节 nonce；DEK 包装密文为 32 字节 DEK+16 字节 tag；正文 tag 为 16 字节。 |
| 明文/单 envelope/批次限额 | 明文≤49152 bytes；完整 envelope≤65536 bytes，两项都满足；批≤256 条且规范响应≤1048576 bytes，不保存半条或截断字段。 |
| maximumWaitMs | 0..25000；25 秒长轮询时限不等于有界中继延迟 B。 |
| RelayCursor.position | canonical 十进制 uint64 字符串，0 或非零首位，无前导零；generation 实际版本≥1。 |
| purpose | SequenceSegment / WorldAppendPermit / WorldCommitAdmission / WorldCommitRejection / AuthorKeyBinding / RelaySettlementSeal / WorldMembership / WorldDeveloperClosure；不能与 b 的 ServerTime/Authentication 相互替用。 |
| WorldCommitRejection.reason | TimeTooLate / PermitExpired / EpochClosed / IdentityConflict；只 TimeTooLate 对应历史 OrphanCommit，线上 30 秒许可通常先过期，不能用 PermitExpired 假称真实离线迟到验收。 |
| CheckpointCoverageEntry.applyResult / finalDiagnostic | 单步结果 Applied/NoEffect/RevertedEdit/InvalidChange；终局诊断 MergeConflict/RevertedEdit/InvalidChange/null。Applied 后被覆盖可同时有 MergeConflict，不能因终局诊断跳过历史单步重放。 |
| Gap.reason | RetentionExpired / RelayGenerationChanged / MissingAdmittedEnvelope；Gap 不是跳过成功，不能自动推进状态/覆盖/ACK。 |
| SharedSettlementPolicy 初始开发政策 | G=3600000ms、B=300000ms、U=60000ms、H=3960000ms、retention=86400000ms；始终 H≥G+B+U、retention≥H。24 小时仅在不等式成立时可用。 |

父 checkpoint 的 identity/摘要/时间/admissionRevision/applyResult 在后代 coverage 不改，已有非 null 终局诊断不回退、不换因；null 只表示该边界尚无诊断，不保证永久赢家。后代仅由新已封边合法同 target 编辑及可验证父 state/checkpoint 链演进 null→MergeConflict，旧 checkpoint 字节永不回写；沿用 027/035，不新增同账号覆盖豁免，同账号不同设备也可产生冲突诊断，不能凭文件自称覆盖改诊断。本地 state/coverage/checkpoint 摘要分别自洽，仅完整已准入前缀的 count/prefix 摘要与 seal 相等，seal 不认证本地 state。

新签名/加密域是 wire 固定 UTF-8 字节常量：`Neurou/shared-authority/v1\0`、`Neurou/commit-admission-claim/v1\0`、`Neurou/world-commit/v1\0`、`Neurou/relay-dek/v1\0`、`Neurou/relay-wrap/v1\0`、`Neurou/relay-body/v1\0`。此处 `\0` 表示终止 NUL 字节，不是反斜杠和字符 0；规范明确覆盖字段/规范化顺序，不能仅凭域名验证正文。

## 4. 成员与群 key 命名边界

`WorldRelayKey` 是本轮群域随机 256-bit key 契约名：绑定 world/membership epoch，与本人账号加密 key 分离，不从 6 位 AccessCode 派生；服务不持明文群 key。`WorldDeveloperTrustAnchor` 是本轮受信 WorldDeveloper 根 pin 名：带外批准/可信正式来源，不能从首次不可信文件或 `/service/keys` 自动取信。

| 本轮冻结文档类型 | 精确字段与归属 |
|---|---|
| WorldKeyAgreementPublicKey | `kty:'EC'`、`crv:'P-256'`、`x`、`y`；只有四字段，x/y 各 canonical base64url 的 32 字节。相同公钥编码可用于根签名 key 的表示，ES256/ECDH 私钥材料仍不得复用。 |
| WorldDeveloperTrustAnchor | `schemaVersion`、`worldId`、`worldDeveloperAccountId`、`developerSigningKeyId`、`developerPublicKey`、`developerPublicKeyFingerprint`；独立于 b 服务签名根与内存注册凭据。 |
| WorldObserverAdmissionFact | `schemaVersion`、`serviceInstanceId`、`worldId`、`observerAccountId`、`observerAdmissionRevision`、`accessCodeRevision`、`admittedAtServerEpochMs`、`developerTrustAnchorSha256`；正确码产生的不可变账号/world 准入事实，用 WorldMembership 服务 receipt 签发。 |
| WorldMemberCredential | `accountId`、`observerAdmissionRevision`、`deviceId`、`deviceGeneration`、`registeredSigningKeyFingerprint`、`keyAgreementPublicKey`、`keyAgreementKeyFingerprint`；observerAdmissionRevision 为 number 或 null，null 仅该 world 根账号凭正式世界注册/root 证据初始化；非根 Observer/CoDeveloper 必须为≥1并有可信 AdmissionFact。不含角色、个人进度或群秘密。 |
| WorldRelayKeyDescriptor | `schemaVersion`、`worldId`、`membershipEpoch`、`keyEpoch`、`worldRelayKeyId`、`keyCommitmentSha256`；最后字段为 32-byte 随机 key 原始字节的 SHA256，不是 key 或访问凭据。 |
| WorldMembershipEpoch | `schemaVersion`、`serviceInstanceId`、`worldId`、`membershipEpoch`、`previousMembershipEpoch`、`key`、`credentials`、`developerTrustAnchorSha256`、`activatedAtServerEpochMs`、`developerSignatureBase64Url`；服务签完整最终 epoch，根签除 signature/authority 激活时刻外的 proposal。 |
| WorldMembershipEpochProposal | 上述 epoch 除 `activatedAtServerEpochMs` 外全部字段；publisher 不自报尚未发生的服务激活时刻。 |
| WorldMembershipChange | `schemaVersion`、`serviceInstanceId`、`changeId`、`requestNonce`、`worldId`、`expectedMembershipEpoch`、`reason`、`next`；reason 为 Initial/MemberAdded/MemberRemoved/CredentialAdded/CredentialRemoved/KeyCompromise；next 是根签 proposal，不是上传秘密。 |
| WorldRelayKeyPackageContext | `schemaVersion`、`serviceInstanceId`、`worldId`、`packageId`、`descriptor`、`recipient`、`developerTrustAnchorSha256`、`developerSigningKeyId`、`cipherSuite`；目标、世代、epoch、world 与根摘要全部绑定。 |
| WorldRelayKeyPackage | `context`、`ephemeralKeyAgreementPublicKey`、`saltBase64Url`、`nonceBase64Url`、`ciphertextAndTagBase64Url`、`developerSignatureBase64Url`；用户携带/显式点对点包，不是 FileCarry 完整载荷、Relay 消息或云 key vault 对象。 |
| WorldRelayKeyAcceptance | `schemaVersion`、`serviceInstanceId`、`worldId`、`packageId`、`packageSha256`、`descriptor`、`recipient`、`acceptanceNonce`、`keyPossessionTagBase64Url`、`recipientSignatureBase64Url`；publisher 用群 key 验 HMAC 与目标设备签名，不让无 key 的服务冒称见证成功解包。 |

membershipEpoch 与 keyEpoch 在 v1 从 1 开始，每次发布同时恰好加 1，两个字段不同语义但当前值相等；初始 previousMembershipEpoch/expectedMembershipEpoch 为 null，之后恰为当前 epoch。credentials 按账号、设备、世代排序且无重复；WorldRelayKey/每包 ephemeral key/salt/nonce 均独立 CSPRNG 材料。包正文恰好 32-byte 群 key，盐 32-byte、nonce 12-byte、ciphertext+tag 48-byte、ES256/P1363 签名 64-byte；acceptanceNonce 与 keyPossessionTag 各 32-byte。重试同 packageId 必须同完整包摘要，不重新随机包装。

新增成员安全固定域为 `Neurou/access-code/v1\0`、`Neurou/world-membership/v1\0`、`Neurou/world-relay-key/v1\0`、`Neurou/world-relay-key-aad/v1\0`、`Neurou/world-relay-key-package/v1\0`、`Neurou/world-relay-key-acceptance/v1\0`、`Neurou/world-relay-key-acceptance-signature/v1\0`。世界根包签名/acceptance 签名不是 SharedAuthorityReceipt 的 service purpose，不能加入服务 receipt enum 以绕过独立签名验证。成员签名/ECDH/nonce/AAD 的全部覆盖规则按成员规范执行，不仅比对这些域名。

世界开发者根 pin 不意味着 PhysicalDevice，批准成员也不意味着已取得完整历史文件。AccessCode 由 WorldDeveloper 选择，CSPRNG 只是推荐生成路径，不禁止合法自选六位码。正确 AccessCode 自动授 WorldObserver，不暗加人工审批；key 交接未完成可 Pending/KeyPublisherUnavailable，但不能撤回准入事实。改 AccessCode、撤销成员/轮换 epoch、移出 CoDeveloper 名单、logout 是不同操作，不能互相冒用。

成员设备事实/开发者权限镜像是轻量权威域；WorldRelayKey 明文/个人层/共享 checkpoint 不进服务器。`RestrictedWriteHeader` 的名单 delta 是已批准权限事实，不能扩成地图状态或第四类变更。

## 5. 候选实现名称、future port 与延期名称

下列内容**尚不是本轮代码冻结**。c-1 实施前应核对 VERDICT 与 dependency/naming 门禁，不从文档名字自行创建模块或放宽 guard。

| 候选标识/类别 | 状态与准入条件 |
|---|---|
| RealCommitRelayProtocolPort | 当前文档 future port；候选方法 submit/pull/acknowledge，mode=ExternalService。不改 b 已有泛型 RealCommitRelayPort 或 archive 同步 relay；正式导出/返回类型/错误路由在 c-1 冻结。 |
| 轻量权威 allocateSegment / issueAppendPermit / admitCommit / sealPrefix 的 port/route | 操作语义已由数据契约限定；具体接口名、HTTP path、request/error wire、CSRF、幂等上限、服务源码类名仍 c-1 实施绑定，不是假称 b 已有 API。 |
| SharedWorldCodec / WorldCommitCodec / WorldCheckpointCodec / SharedWorldSession / RelayServiceAdapter 等实现名 | 仅描述可能的职责，未冻结这些实现标识、文件放置、导出或算法类；本轮不创建。 |
| SHARED_SCHEMA_VERSION / SHARED_ONLINE_PROFILE / AUTHOR_SEQUENCE_SEGMENT_SIZE | 建议未来源码常量别名；规范值分别 1 / ExternalSharedOnlineV1 / 1024 已冻结，源码标识不在本轮落盘。 |
| AUTHOR_SEQUENCE_SEGMENT_TTL_MS / WORLD_APPEND_PERMIT_TTL_MS | 建议别名；规范值 3600000 / 30000ms 已冻结。 |
| TRACE_TOUCH_STRENGTH_CAP / WORLD_COMMIT_PLAINTEXT_MAX_BYTES / RELAY_ENVELOPE_MAX_BYTES | 建议别名；值 65535 / 49152 / 65536 已冻结；MAX_BYTES 是容量单位，勿复用玩法常量。 |
| RELAY_BATCH_MAX_COUNT / RELAY_BATCH_MAX_BYTES / RELAY_PULL_WAIT_MAX_MS | 建议别名；值 256 / 1048576 / 25000 已冻结。 |
| BOUNDED_RELAY_DELAY_MS / SHARED_TIME_UNCERTAINTY_ALLOWANCE_MS / SETTLE_HORIZON_MS / RELAY_RETENTION_MS | 建议开发政策别名；值依 §3 初始 policy，必须按 G/B/U 不等式验证，不能当任意网络环境的保证。 |
| 旧三元 WorldCommit 迁移类型/操作 | 延期，需独立身份转换与去重/碰撞协议；不得静默新增 Legacy adapter。 |
| 原生 OfflineTimeProof / OfflineAuthorPermit 等类型 | 候选而非授权能力；P5 明确 boot/uptime/attestation/grant/攻击者边界后另补 schema。Web 禁止应用时长降级。 |
| 自身 TraceTouch 贡献恢复与陌生 checkpoint 证明载体 | P4 候选，不能新增第八项 Core、裸个人 key 或凭 hash 授 Complete；目前缺证明时 Unknown/CheckpointUnverifiable。 |
| 完整地图/Trigger 动作、EditPresence、ObserverSync 产品接线 | 留后续授权；v1 有限 schema 不等于编辑器全功能或共同开发 UI 已实现。 |
| AccessCode rate-limit/准入 challenge 开发数值 | 候选：account/world 5 次失败/15 分钟、IP 20 次失败/15 分钟、world 100 次失败/小时、challenge 30 秒一次消费；限流原则冻结，数值/可信 IP 来源/真实压测在 c-1 定版，不把 6 位码历史规格扩写成这些数值历史已冻结。 |
| Publisher 部署、根 key 恢复/更新、成员 exact route、ECDH possession challenge、package 交付入口与限额 | 数据契约不等于完整实施前置；独立批准/证据后才落源码与持久秘密，不在本轮新造根继承者、明文 key 存储或消息发送授权。 |

IdentityConflict、SequenceExhausted、LegacyIdentityUnsupported、OfflineProofUnsupported、TimeTooLate、PermitExpired、BoundViolated、CheckpointUnverifiable、InvalidChange、NoEffect 等是本轮**契约语义结果标签**；HTTP status、完整 error envelope 与源码 enum/type 另在 c-1 绑定。OrphanCommit/MergeConflict/RevertedEdit 是已有个人层异常原因，不借错误标签自动调用 S5 或上传个人诊断。

## 6. A～F 关系与阶段交接

| 问题 | 本轮名称关系 |
|---|---|
| A 命名 | 上表区分历史沿用、纯文档已冻结数据名/字段/值域、future port/route/源码常量候选。没有新增运行时导出。 |
| B 与 B2.4 | WorldChangeLog 是共享事实日志；CrossDeviceImportJournal 是 Core 导入事务恢复 journal；WorldMigrationJournal 是迁移 phase 恢复 journal。三者不统一、不互转，原存储 key、锁与 phase 不改。 |
| C AccessCode | 纯首次准入门槛；批准加入与可信成员 key 分发是不同验证步骤。AccessCode 不成为群 key、账号 key、签名根或恢复秘密。 |
| D ObserverSync | 契约补冻提供后续 Relay 数据边界，未开启产品 ObserverSync/共同开发入口；EchoTrace、异痕、地图编辑 UI 不在本轮实现。 |
| E 实现边界 | 只文档补冻，源码增量为零；没有纯类型源码实现、codec、ContractAdapter 或真实 Relay，不把 Markdown 中 interface 当现有能力。 |
| F B2.5c | c-1 可执行纯契约/codec/确定性合并与验证；c-2 独立轻量权威与真实 Relay；c-3 真实两客户端网络、队列/Gap/权限/密钥安全验收。每段另有实施授权，完整 P4/P5/产品接线不因本次冻结自动获得授权。 |

Trae 落盘时保留历史修订链与本轮纯文档范围，尤其不能将二元新格式写成“027 从未修订”、将地图权限写回单 WorldDeveloper、将 OrphanCommit 降为候选、将 24 小时描述为无条件中继 SLA，或把 RegisteredCredential 写成可信物理设备。
