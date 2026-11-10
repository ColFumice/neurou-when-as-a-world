# B2.5c-2a · 根 pin、目标凭据与最小群 key 交付

日期：2026-10-11（Asia/Shanghai）。本文件是 c-2a 最终冻结的密码学/信任边界，不实现注册、路由、publisher、平台存储或产品入口。P3 的 `WorldRelayKeyPackage`、`WorldRelayKeyAcceptance`、域分离及算法逐字沿用；c-1 的五个纯逻辑文件和 `SharedCryptoPort` 不修改。

**当前状态：用户已正式采纳 PROTOCOL P7 / P8 / P9。** 独立真实会话 owner、受信 TLS edge、最小协议级 AccessCode 自动准入均已获范围裁定；没有产品 AccessCode/ObserverSync UI。下列新增 schema、值域与流程已冻结为后续实施依据，冻结不表示已有代码。本机两个同账号注册设备，以及非 root 通过真实 AccessCode 准入，均属于未来验收。

## 1. 当前真实能力与缺口

| 证据 | 已有能力 | 不可由已有结果推出 |
|---|---|---|
| P3 membership-and-security.md §§2、5 | 精确 ECDH/HKDF/GCM 包、开发者签名、HMAC acceptance 契约 | 部署好的 root publisher、注册 ECDH 私钥 possession、真实包交付 |
| c-1 SharedCommitCodec | 包及 acceptance 的精确字段/值域检查 | 开发者来源可信、成功解包、接收者持群 key |
| c-1 SharedCommitValidator | 使用注入的可信群 key 验证提交 | 群 key 的实际注册/交付生产者 |
| B2.5b RealAuthServiceAdapter | 真实账号/RegisteredCredential、私有内存 ES256 key 与 CSRF | 可供 shared adapter 使用的签名能力、ECDH key、永久世界根 |

注册 ES256 签名把某个 ECDH 公钥绑定到真实账号/设备，单凭这项签名不能证明客户端持有对应 ECDH 私钥。因此 c-2 最小注册协议必须增加真实解封挑战，不接受只填 `WorldMemberCredential` 或直接插测试 seed 的“注册”。新能力是 RegisteredCredential 级，不能宣称 PhysicalDevice。

## 2. 世界根与服务根的带外交付

根安装必须包含完整 `WorldDeveloperTrustAnchor`、`serviceInstanceId`、`worldId`、WorldDeveloper 账号 ID、开发者 RFC7638 指纹以及受审 Genesis / content manifest 的 SHA256。服务签名根另从 B2.5b 的 `AuthorityTrustAnchor` 安装与核对。两条信任链分别检查，TLS CA 信任也另行检查。

最小本机/LAN 原型的部署仪式如下，作为 c-2b 入场前置：

1. 操作者先通过真实 Auth 取得开发者账号 ID；从独立、明确解锁的 publisher 生成/持有开发者 ES256 根能力。根与 Auth 注册 ES256、成员 ECDH、服务签名 key 使用不同 key material。
2. publisher 只呈现公开 anchor / 指纹及受审 Genesis / manifest 摘要。操作者在服务器安装配置与每个独立组合根中逐项核对，并明确批准相同 world / account / fingerprint / 摘要组合；不把包内自带公钥、Relay 响应、正确码或 `/service/keys` 当成批准来源。
3. 新世界注册只接受已安装组合、当前开发者真实会话与根签名。服务只存 root/public key 与独立摘要，不存完整 Genesis / SharedWorldState / checkpoint。客户端实际 Genesis 来自受审输入并与安装摘要核对。
4. 未安装 pin、任一指纹不匹配或世界/账号不匹配时拒绝，不启用 TOFU。安装动作的公开配置摘要与核对结果可进入证据，私钥和群 key 不进入配置、日志或交付报告。

原型可以在内存中新生成根，然后由操作者通过另一明确的配置安装步骤批准其公开 anchor；不得把“刚读到 incoming 文件的 key”自动写成可信 pin。该做法证明的是受操作员批准的原型世界，不能冒称既有正式内容世界已经完成根迁移。

P4 前 publisher 根私钥只存在于当前显式解锁的内存能力，不能创建明文私钥文件、localStorage、Auth 数据库记录、恢复包或第八项 Core。进程/reload 后该根无法恢复：公开 pin 仍在，世界管理/key 交付返回 `KeyPublisherUnavailable`；不自动换根、不转交 CoDeveloper、不声称永久密钥保管已交付。根恢复/轮换不是 c-2 的隐含功能。

## 3. ECDH 私钥 possession 的精确增量契约

此节新增 schema 仅属于 c-2 独立协议模块。它不增加 P3 `SharedAuthorityReceipt.purpose` 的取值，也不改 c-1 codec。c-2 外层逐字使用 `SharedTransportReceipt<WorldMemberCredentialChallenge>` 的 purpose=`AgreementCredentialChallenge`，成功注册使用 `SharedTransportReceipt<WorldAgreementCredentialFact>` 的 purpose=`AgreementCredential`。该事实包含已验证/入库的 public credential、原 challenge 摘要、服务注册时刻/generation，以及服务同事务产生的原 P3 `AuthorKeyBinding` receipt 和合法 observer receipt；没有额外 key/secret/自报时刻。外层不自行声称可信时间；challenge 到期时间由受信 shared clock 产生，服务时间/clock 握手按主 HTTP 契约验证。

```ts
interface WorldMemberCredentialChallengeContext {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly challengeId: string;                 // UUID
  readonly requestNonce: string;                // canonical base64url, 32 bytes
  readonly recipient: WorldMemberCredential;
  readonly developerTrustAnchorSha256: string;
  readonly challengeNonceBase64Url: string;     // CSPRNG 32 bytes
  readonly expiresAtServerEpochMs: number;
}
interface WorldMemberCredentialChallenge {
  readonly context: WorldMemberCredentialChallengeContext;
  readonly ephemeralKeyAgreementPublicKey: WorldKeyAgreementPublicKey;
  readonly saltBase64Url: string;               // 32 bytes
  readonly nonceBase64Url: string;              // 12 bytes
  readonly ciphertextAndTagBase64Url: string;   // 48 bytes
}
interface WorldMemberCredentialProof {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly challengeId: string;
  readonly requestNonce: string;
  readonly challengeSha256: string;
  readonly recipient: WorldMemberCredential;
  readonly proofTagBase64Url: string;           // HMAC-SHA256, 32 bytes
  readonly recipientSignatureBase64Url: string; // ES256/P1363, 64 bytes
}
interface WorldAgreementCredentialFact {
  readonly credential: WorldMemberCredential;
  readonly challengeSha256: string;
  readonly registeredAtServerEpochMs: number;
  readonly clockGeneration: number;
  readonly authorKeyBinding: SharedAuthorityReceipt<WorldAuthorKeyBinding>;
  readonly observerAdmission: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
}
```

所有 shape 精确，无可选字段/额外字段/浮点数；UUID、JCS 整数子集、公钥、canonical base64url 与 lowerhex SHA256 沿用 P3。challenge 服务产生，不接受请求自报账号/设备/世代/签名指纹；`recipient` 的这些值从当前真实会话与数据库 Active credential 取得。ECDH 公钥由客户端提供，曲线点/指纹/分用途检查先完成；非 root 还必须有有效 WorldObserver admission，root 的 null revision 只由已安装注册根证据允许。

服务用一次性 ECDH P-256 key 与目标公钥计算 Z，生成独立随机 32-byte secret、32-byte salt、12-byte nonce。算法如下：

```text
wrapKey = HKDF-SHA256(Z, salt,
  UTF8('Neurou/world-member-credential-proof-key/v1\0') || JCS(context), 32)
aad = UTF8('Neurou/world-member-credential-proof-aad/v1\0') ||
  JCS({context,ephemeralKeyAgreementPublicKey,saltBase64Url})
ciphertextAndTag = AES-256-GCM(wrapKey, nonce, secret, aad)
expectedTag = HMAC-SHA256(secret,
  UTF8('Neurou/world-member-credential-possession/v1\0') || JCS(完整Challenge))
expectedTagSha256 = SHA256(expectedTag)
```

PG 只持久保存 public Challenge / challenge 摘要、expectedTagSha256、绑定的账号/设备/世代/会话家族、服务到期时刻、消费状态及请求摘要。服务在 challenge 构造后释放 ephemeral 私钥、Z、wrapKey、secret 与 expectedTag；对可变字节尽力清零，但不声明 JS/Node 能彻底擦除内存。public Challenge 不是群 key package，也没有群 key；它的持久记录不违反“Auth/Relay 不云存群 key 包”。

客户端先检查服务 root 签名、世界 root/recipient/nonce/30 秒寿命与当前身份，使用自己的独立 ECDH 私钥解出 secret，计算相同 expectedTag。注册 ES256 能力签域 `Neurou/world-member-credential-proof-signature/v1\0` 加整个 Proof 除 signature 字段的 JCS bytes。Proof.requestNonce 是 `/credential/register` 的新 outer requestNonce，与 challenge 签发请求的 nonce 不同；完整 challengeSha256 绑定原 challenge/context，不能用新 nonce 替换原 challenge 的绑定。服务按固定长度对 SHA256(proofTag) 与 expectedTagSha256 做恒时比较，并验证当前注册 ES256 签名及全部绑定。

challenge 寿命固定 **30000ms**，服务时钟判断到期；不存在客户端时间续期。nonce 单次原子消费，绑定同一 world / account / device / generation / session family。一个经身份核对、格式完整的 proof 进入单次 terminal 消费；成功后同摘要重取原结果，不再次注册；异摘要重放拒绝。失败仍不能借换 requestNonce 绕过消耗/限流。新设备、key 变化或世代变化须重新证明，不能覆盖旧成员历史；入 epoch 还须独立的 publisher proposal / CAS 激活。

成功同事务签 `WorldAgreementCredentialFact` 及其 authorKeyBinding。authorKeyBinding 的账号/设备/世代/ES256公钥与真实 Auth 注册凭据相同，指纹严格重算，RegisteredCredential 级不提升；该原 P3 receipt 为后续 `AdmittedWorldCommit.authorKeyBindingReceipt` 的真实生产来源。注册时刻由受信 shared clock 产生，不从客户端回填，Fact 与新 receipt 的 generation 一致。普通成员引用已验 `WorldObserverAdmissionFact`，只有正式注册根账号允许 observerAdmission=null。历史原 observer receipt 的原nonce/时刻/generation保持不变，不为了本次注册重签它。

P7 已批准新增 `RealSharedServiceSessionAdapter` 提供 `RegisteredAuthorSigningPort` 窄能力，上述 ES256 签名必须来自该能力；不得提取旧 adapter 私有字段或重新生成未注册 key。只实现曲线/shape 检查不满足此节验收。

## 4. 最小真实 WorldRelayKeyDelivery

`WorldRelayKeyDelivery` 正式归 `src/director/WorldRelayKeyDelivery.ts`，只做纯协议编排。新增 `WorldKeyAgreementPort` 与 `WorldDeveloperSigningPort` 通过独立 type-only 端口注入；`SharedCryptoAdapter` 在 presentation 提供平台密码学能力，不改 c-1 `SharedCryptoPort`。独立组合根持有 publisher/recipient 能力并负责显式启动交接，director 不导入 WebCrypto / DOM / fetch / cc / Node。

最小交付必须同时完成以下步骤，结构 codec 单独通过不算完成：

1. publisher 从合法根能力生成全新随机 32-byte WorldRelayKey，构造新 UUID keyId、当前合法的 membership/key epoch 与 commitment。为每个合法 recipient 准备独立完整 package，最多 **256** 个 credential；超限拒绝，不能截断成员集合。
2. 每个 package 全新 ephemeral P-256、salt32、nonce12；HKDF 与 AAD、48-byte ciphertext/tag、root64-byte ES256 签名逐字沿用 P3 §5，签名/ECDH 不复用 key material。publisher proposal 验证并由真实服务事务激活 epoch 后，才允许该 epoch 发布提交。
3. 接收方检查包 canonical bytes 限额、根 pin/开发者签名、自己的真实账号/设备/世代、已证明的目标 ECDH key、当前有效 epoch receipt，以及 descriptor / root SHA / package identity 全部绑定；再解封并核对 key 32-byte 长度与 commitment。
4. 成功 key 暂存于当前内存能力；任一步失败不返回部分秘密、不覆盖原有效 key、不变更已授 Observer fact。尚未激活 next 包只能保持准备态，不能作为当前发布 key。
5. publisher 对该包生成新的 **32-byte acceptanceNonce，30000ms 寿命，一次消费**。挑战不由接收者时钟或 packageId 单独代替。nonce 与完整包 SHA、recipient、descriptor 绑定，由 publisher 内存记录其到期与消费状态。publisher host 的相对计时只限制这次在线挑战，不产生 AppendedAt/OfflineGrace/离线证明；纯 director 接受窄的挑战有效性能力，不自行读取平台时钟。
6. recipient 产生 P3 原字段的 `WorldRelayKeyAcceptance`：HMAC-SHA256 使用已经解包的群 key 和 `Neurou/world-relay-key-acceptance/v1\0`；注册设备 ES256 签完整 unsigned acceptance 的 `Neurou/world-relay-key-acceptance-signature/v1\0` bytes。
7. publisher 检查当前 recipient 真实绑定、根/epoch/包摘要、未消费挑战、注册签名、HMAC，才产出本地已确认交付能力；重复同结果可重取，不能二次确认/改包摘要。跨包/跨 recipient/跨 epoch/tag 错一律拒绝。

包 canonical bytes 上限 **16384 bytes（16 KiB）**；acceptance/challenge/proof 的每个 canonical 外层也受独立 16 KiB 上限。包限额不扩大全局 Auth body limit。nonce12/tag16/key32/签名64 等算法长度不可因为资源上限被放宽。

服务没有群 key，不会独立验证 HMAC。c-2 只在服务外 publisher 的内存中确认交付，**不新增 deliveryConfirmation 路由或表**；Auth/Authority/Relay 不接收完整包、secret、群 key、目标私钥或为 HMAC 验证索要群 key。publisher 的验收结果不能冒称“服务器目击了解包”或“ACK 已证明拥有 key”。未来若批准服务轻量交付事实，也只能基于合法 publisher 签名的不可逆摘要与轻量状态，须另冻请求/签名/时间及事务，不由 implementation 临时发明 payload route。

## 5. 包的传输与 secret 存活

最小入口是独立组合根的显式内存 bytes 输入/输出：publisher 与 recipient 使用隔离的真实会话和不同私钥能力，交接完整 package bytes、挑战与 acceptance。Auth/Authority/Relay HTTP 不传包，Relay 仍只传 `WorldCommit`。

c-2 的双客户端 HTTP harness 可以在两个独立 principal context 间使用显式内存 bytes bridge 交接包；这是实际 ECDH 解封与 HMAC/ES256 possession 证据，不声称已经部署网络 key transport。LAN 分离设备如果由操作者显式输入 package/nonce 到独立原型 API，记录的是这次明确带外交付的验收；不新增产品 UI、不自动发外部消息、不声称 OS 剪贴板的长期保密性。若要求部署自动 P2P helper/附件/持久文件流程，必须另冻其传输、授权、资源与 P4 保护边界，当前列候选。

群 key、根私钥、recipient ECDH 私钥及包不写 Auth/Relay/PG、localStorage、日志、截图、测试快照或临时文件。密码学测试只记录通过/失败、公开指纹、摘要与资源计数。package 重试复用同一完整 canonical bytes，不以同 packageId 重新随机加密；同 ID 异摘要拒绝。

logout/设备绑定失效/recipient context 更换时使当前准入与 key 使用能力失效并尽力清零可变 secret bytes；reload 后重新合法认证、ECDH 证明与 publisher 交接。保留已批准公开 pin 不等于旧 key 已恢复。历史 key 只由合法 publisher 显式逐 epoch 交付；无历史 key/可信 checkpoint 时保留 Gap，不用当前包推导历史。

## 6. 独立真实密码学验收计划

以下是未来 c-2b/c-2d/c-2e 的测试计划，**本轮未执行**。producer 和 recipient 分离：正式平台 provider 执行 WebCrypto，独立 Node crypto oracle 核对 RFC7638/SHA256/ECDH/HKDF/GCM/HMAC/P1363 bytes；公开算法已知向量不能只由同一实现自生成自验证。使用真实服务会话/凭据/ECDH challenge/membership receipt，不能用 fixture seed 替代 ordinary observer 准入。

| 编号 | 实际生产/验收动作 | 必须成立的证据 |
|---|---|---|
| K01 | operator 安装 root/service/Genesis/manifest pin，真实注册世界 | 缺 pin/错 world/错账号/包内换 key 拒绝，来源不从包自举 |
| K02 | 注册 ES256 与 ECDH 独立生成 | 同 material、坏曲线点、额外 JWK 字段、指纹不等拒绝 |
| K03 | 真实 ECDH challenge 解封 + HMAC + 注册 ES256 proof | 服务只存 expectedTagSha256；错误私钥/tag/signature/target/world/session拒绝 |
| K04 | 并发、30s 到期、重放、服务重启、logout | 单次消费/同摘要幂等，不重发新权限；不靠客户端时间续期 |
| K05 | publisher random256、完整合法成员集合、真实 epoch CAS | epoch 不提前激活；非root不得发布；MemberAdded/Removed 的精确集合差異 |
| K06 | publisher 与不同 target 进行真实 ECDH/HKDF/GCM 解封 | 独立 oracle 对照；明文恰好32-byte且 commitment相同 |
| K07 | 包签名/AAD/context 每一绑定字段逐个篡改 | 错根/目标/世代/epoch/盐/tag/ciphertext/descriptor拒绝；旧有效key不覆盖 |
| K08 | 相同完整包重试与同 packageId 改密文 | 前者保持同SHA；后者冲突，不能重包/改名伪造交付 |
| K09 | receiver 真实 acceptance + publisher验证 | HMAC与设备签名都验证；wrong secret、错nonce、跨包/epoch/recipient、过期/重复拒绝 |
| K10 | 服务外 publisher 内存确认，检查无 confirmation 路由/表 | DB无包/群key，不声称服务独立验HMAC |
| K11 | 超16KiB、超256 credentials、非规范/额外字段 | 解析前有界拒绝，资源超限不截断或宽松兼容 |
| K12 | 两隔离真实HTTP客户端解同epoch提交 | 两真实registeredkey/cookiejar，群key不经Auth/Relay交接，无fixture回退 |
| K13 | 缺包/publisher失联/reload/历史key缺失 | Pending/KeyPublisherUnavailable/Gap语义准确，不撤回正确码Observer事实 |
| K14 | 成员或credential撤销/rekey | 独立新random key，撤销者无新包；旧历史仍验真，不承诺追回旧明文 |
| K15 | 日志/DB/错误响应/交付目录泄露检查 | 无私钥/密码/码/群key/完整key包持久副本；私钥随机只驻内存 |

P9 已批准最小协议级自动准入，K05/K14 的普通成员分支必须使用真实 `WorldObserverAdmissionFact`，不能借 root-only 两设备正例报成全成员资格通过。K12 的 key bridge 证据与 HTTP submit/pull/ACK 的网络证据分开记录，不把内存交接包装成自动 LAN 分发。

## 7. 真正入场前置与留后事项

| 状态 | 项目 | 影响 |
|---|---|---|
| PROTOCOL P7 已闭合 | 独立真实会话 owner / 已注册签名窄能力 | 后续实施 ECDH proof、commit/acceptance 必须用真实同设备签名能力 |
| PROTOCOL P9 已闭合 | ordinary observer 自动 AccessCode protocol 准入 | 最小协议纳入、产品 UI 排除；不能给普通成员seed资格 |
| PROTOCOL P8 已闭合 | approved TLS edge | LAN 密码/cookie/码传输不允许裸 HTTP；证书操作仍须实配 |
| c-2b 前必须实配 | operator root/account/service/Genesis/manifest pin、内存publisher实际持钥 | 缺根时不启动管理/key交付，不自动选替代root |
| 本轮已冻结；c-2b 前按表实现 | c-2 challenge/proof purpose、HTTP 错误/限流/幂等/PG事务 | 不扩改c-1 schema，不临时发明服务payload；server delivery confirmation 当前不新增路由 |
| c-2 内验收 | 真实package解封与acceptance，不仅结构检查 | c-1 154项不替代本项密码学交付证据 |
| 留 P4 | 私钥/包持久保护、根恢复、历史key/bootstrap、本人触痕恢复 | 当前内存原型不声称耐久恢复/Complete |
| 候选 | 自动P2Phelper/附件/长期publisher运行 | 未冻传输与保护时不部署，不新增云包服务 |

本文件涉及的 ECDH possession 来源、根 pin 来源和 publisher 内存存活已纳入 P7/P9 以及主 c-2a 接入裁定；不存在要求修改 c-1 五文件的新冲突。公开部署 pin/证书与实际 publisher 能力属于后续实施入场配置，不能由本轮文档代替真实证据。

## 8. 新增窄能力与精确签名输入

以下为 type-only 契约冻结，放入未来 `src/director/SharedServiceProtocolContracts.ts`，本轮不创建源码。P3 `WorldMembershipEpochProposal` / `WorldRelayKeyPackage` / `WorldRelayKeyAcceptance` 本身仍是原 schema；此节 Omit 仅描述签名前的输入，不给 wire 添加新字段。

```ts
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
  readonly accessCode: string;                    // ^[0-9]{6}$, leading zero retained
}
interface AccessCodeChangeRequest {
  readonly proposal: AccessCodeChangeProposal;
  readonly developerSignatureBase64Url: string;
}
interface WorldDeveloperSigningPort {
  readonly trustAnchor: WorldDeveloperTrustAnchor;
  signWorldRegistration(proposal: WorldRegistrationProposal): Promise<string>;
  signAccessCodeChange(proposal: AccessCodeChangeProposal): Promise<string>;
  signMembershipProposal(proposal: Omit<WorldMembershipEpochProposal,
    'developerSignatureBase64Url'>): Promise<string>;
  signRelayKeyPackage(keyPackage: Omit<WorldRelayKeyPackage,
    'developerSignatureBase64Url'>): Promise<string>;
  release(): void;
}
interface WorldKeyAgreementPort {
  readonly publicKey: WorldKeyAgreementPublicKey;
  readonly keyAgreementKeyFingerprint: string;
  proveCredentialChallenge(challenge: WorldMemberCredentialChallenge): Promise<string>;
  unwrapRelayKeyPackage(keyPackage: WorldRelayKeyPackage): Promise<Uint8Array | null>;
  createWorldRelayKey(): Promise<Uint8Array>;
  createChallengeNonce(): Promise<string>;        // CSPRNG32-byte canonical base64url
  prepareRelayKeyPackage(key: Uint8Array,
    context: WorldRelayKeyPackageContext): Promise<Omit<WorldRelayKeyPackage,
      'developerSignatureBase64Url'>>;
  createRelayKeyAcceptanceTag(key: Uint8Array,
    acceptance: Omit<WorldRelayKeyAcceptance,
      'keyPossessionTagBase64Url' | 'recipientSignatureBase64Url'>): Promise<string>;
  release(): void;
}
```

四种根签名方法只允许固定域，返回严格64-byte P1363 canonical base64url：

| 方法 | 唯一签名域 | 绑定检查 |
|---|---|---|
| signWorldRegistration | `Neurou/world-registration/v1\0` + JCS(proposal) | world/account/root SHA 与 installed anchor / approved registration组合相同 |
| signAccessCodeChange | `Neurou/world-access-code-change/v1\0` + JCS(proposal) | world/实例/nonce/CAS与精确6位码；码不进入日志 |
| signMembershipProposal | P3 `Neurou/world-membership/v1\0` + JCS(unsigned proposal) | 根/world/实例/epoch与合法完整credential集合；无authority激活时刻 |
| signRelayKeyPackage | P3 `Neurou/world-relay-key-package/v1\0` + JCS(unsigned package) | context root ID/SHA/world与同root能力匹配，严格suite/资源上限 |

port 不提供 sign(bytes)、domain:string、raw private key 或导出私钥接口。`trustAnchor` 是操作者批准并与实际内存根能力核对的公开 anchor，不取自 incoming package。release 后所有签名操作拒绝，不能从公开 anchor 重建私钥。

`WorldKeyAgreementPort` 只提供固定 protocol 密码学操作，不提供任意 deriveBits/HMAC/decrypt 或 ECDH 私钥导出。proveCredentialChallenge 使用本节 §3 固定算法与完整 public challenge 计算32-byte proofTag；调用前 director 已核验服务签名/当前身份/时效，provider 仍核验目标ECDH公钥/指纹与自身能力相同。unwrap 使用 P3 固定包算法，null 只表示 GCM tag 不成立；provider 故障/无效输出必须抛错映射 HostFailure，不混入 tag 拒绝。

createWorldRelayKey 只返回全新CSPRNG32-byte key。createChallengeNonce 只生成新的32-byte acceptance 挑战，网络 requestNonce 由真实会话 owner 独立生成，不复用这次挑战。prepare 每次使用独立一次性 ephemeral key/salt/nonce，返回未签名 package；不能把自身长期设备 ECDH 私钥充当 ephemeral。createRelayKeyAcceptanceTag 只允许 P3 acceptance 固定域/HMAC32，不接受调用方自选 domain。收到/生成的 key 字节只是当前显式能力范围内的32-byte秘密，不属于 wire/public状态；director 可以核验 commitment，再提供 c-1 lookupWorldRelayKey 所需的临时副本。复制及持久化不自动获得许可。

此最小 provider 承担 c-1 验证所需 `SharedCryptoPort` 及上述两项窄能力，`SharedCryptoAdapter` 在 presentation 实施；独立组合根负责创建与隔离不同principal能力。正常作者的 commit/claim/credentialProof/acceptance/shared operation/ACK 签名来自 `RegisteredAuthorSigningPort` 的固定方法，具体签名输入按主 HTTP 契约；不能把世界根 port 当作者注册凭据，不能开放任意 bytes 签名来绕域检查。

真实提交的封装 producer 另由主 HTTP 契约附录的 `SharedCommitSealingPort.sealCommit(commit, header, key32, signer)` 注入。平台实现逐字使用 P3 的独立 commit DEK32、AES/HKDF、wrap/body AAD，作者签名仅调用已注册 signer 的固定 envelope 方法，输出完整 canonical envelope bytes；不修改 c-1 验证器/crypto端口，也不让 key package 的 ephemeral/root key 代替 commit作者。这项窄能力属于纯编排调用的平台实现边界，不增加 Relay payload 类别。
