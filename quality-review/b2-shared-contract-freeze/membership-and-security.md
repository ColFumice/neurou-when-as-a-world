# P3 成员、AccessCode 与群密钥安全契约

2026-10-11（Asia/Shanghai）。本文件为 `contracts-draft.md` 的成员与密钥规范部分：**文档契约冻结，机制未实现**。不新增接口源码、服务路由、ContractAdapter、密钥库、ObserverSync 或产品入口；本批整体保护审计与准入状态以交付报告为准。历史 VERDICT-023 正确六位 AccessCode 自动授予 WorldObserver、VERDICT-035 开发者名单与共同编辑规则继续有效。

## 1. 四种资格分开验证

| 资格 | 来源与范围 | 不附带的能力 |
|---|---|---|
| 已认证账号 / RegisteredCredential | B2.5b 密码与注册凭据 challenge、真实会话 | 不是 PhysicalDevice、OfflineGrant、世界开发者或群密钥 |
| WorldObserver | 正确 AccessCode 的自动准入事实；账号与 world 绑定 | 不是 MapEditPermission；没有群 key 不冒称已经能解密 Relay |
| 当前 epoch 的 Relay 成员凭据 | 有效 WorldObserver、设备凭据、目标 ECDH key 绑定、当前成员事实与合法 key package | 不授个人账本、通关、归属、迁移或开发者权限 |
| WorldDeveloper / CoDeveloper | 既有开发者根身份及按提交总序生效的 DeveloperRoster | 不授 StudioDeveloper、账号恢复、根身份转让或群 key 发布者身份 |

服务成员事实是协议授权数据，不是 ObserverSync 产品运行机制。P3 不启动观察会话、不更改世界游玩模式、不自动拉取或水合世界、不添加产品 AccessCode UI。以后 c 的真实成员接口须独立授权、严格字段与真实证据；b 的现有账号事实没有这些字段或 API。

WorldObserver 准入与加密入群是两个状态。正确码立即产出有效准入事实，**不增加人工审批来改变 023**；随后系统按有效资格执行 key 交付。publisher 未运行、目标 key 未证明、世界根 pin 缺失或包未完整验证，分别使加密入群保持 Pending / 拒绝，不能把这种技术未完成报告成 AccessCode 错误或偷偷收回已授 WorldObserver。

## 2. 开发者根 pin 与公开字段

下列对象遵循主契约的严格 own 字段、UUID、JCS 整数子集、canonical base64url、SHA256 和 RFC7638 指纹规则。EC 公钥只允许四个字段，x/y 各解码为 32 字节；不得带 d、key_ops、alg 或未经冻结扩展。解析后还须验证确实为 P-256 曲线上的合法点。

`developerSigningKeyId` 必须逐字等于该世界已 pin 开发者公钥的 RFC7638 SHA256/base64url 指纹；`SharedAuthorityReceipt.keyId` 必须等于对应已 pin 服务公钥的同类指纹，二者不互换。`worldRelayKeyId` 仍是独立 UUID，不是签名公钥指纹；`serviceInstanceId` 沿用 b 的 ASCII 字符串值域，不按 UUID 解析。

```ts
interface WorldKeyAgreementPublicKey {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly x: string;
  readonly y: string;
}
interface WorldDeveloperTrustAnchor {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly worldDeveloperAccountId: string;
  readonly developerSigningKeyId: string;
  readonly developerPublicKey: WorldKeyAgreementPublicKey;
  readonly developerPublicKeyFingerprint: string;
}
interface WorldObserverAdmissionFact {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly observerAccountId: string;
  readonly observerAdmissionRevision: number;
  readonly accessCodeRevision: number;
  readonly admittedAtServerEpochMs: number;
  readonly developerTrustAnchorSha256: string;
}
interface WorldMemberCredential {
  readonly accountId: string;
  readonly observerAdmissionRevision: number | null;
  readonly deviceId: string;
  readonly deviceGeneration: number;
  readonly registeredSigningKeyFingerprint: string;
  readonly keyAgreementPublicKey: WorldKeyAgreementPublicKey;
  readonly keyAgreementKeyFingerprint: string;
}
```

`WorldObserverAdmissionFact` 是不可变的准入事实，以主契约 `SharedAuthorityReceipt` 的 purpose=`WorldMembership` 签发。撤销及其生效时刻是新的轻量成员事实，不回写旧签名事实，不把已准入历史改成从未加入。WorldMemberCredential.observerAdmissionRevision 的 null 仅限该 world 根开发者账号凭正式世界注册/root 证据加入；普通 WorldObserver 与 CoDeveloper 必须为≥1的实际 revision，并有已验证的签名 AdmissionFact，不能随意填 null 绕过成员准入。开发者本人首次世界注册的根身份/成员初始化另由正式世界注册入口证明，不伪造一次 AccessCode 准入；其最初账号与根 anchor 绑定入口仍是 c 实施前置。

开发者根 anchor 来自正式受审内容源或带外人工核对的 worldId、账号、公钥指纹；公开 key 可随文件携带以便验签，但 **pin 本身不能从该文件自举**。6 位码、Relay 响应、包内签名、自报 developerAccountId、b `/service/keys` 或注册设备签名均不证明世界根身份。服务签名根与世界开发者签名根分别配置、分别核对，禁止替代。

根私钥用于 ES256/P1363 签名；成员目标 key 用于 ECDH P-256。上文公钥形状相同只是一种编码，**不允许同一 key material 同时承担 ES256 与 ECDH**。b 注册签名凭据对一次服务 challenge 签名，绑定 world、账号、设备/世代、目标 ECDH 公钥及指纹、requestNonce；服务从真实会话核对身份，不能接受包里自带的“我的设备”声明。持有证明不提高 RegisteredCredential 的物理可信度。

b 浏览器 adapter 的 ES256 key 是内存 credential，reload 后可能重新注册，不能拿它当永久世界根 pin。长期开发者私钥的保管、恢复、轮换与受保护存储必须有独立方案；P3 不在 localStorage、源码、日志、临时明文文件或 Auth 数据库创建根私钥。正常根 key 更新须明确的受信旧根授权与带外更新策略；旧根疑泄露/全部丢失不能靠服务响应或新账号登录自动替换 pin，此恢复协议留实施前补冻。

## 3. AccessCode 只做自动准入

AccessCode 是 `^[0-9]{6}$` 字符串，保留前导零；不得先转整数，不接受空格、Unicode 数字或宽松补零。码由 WorldDeveloper 选择；CSPRNG 是推荐生成路径，允许开发者自行设定合法六位码，不能把生成方式新增为准入限制。WorldDeveloper 可显式轮换当前 codeRevision；轮换码不撤回既有 WorldObserver、不重置成员 epoch、不给 MapEditPermission。CoDeveloper 不能仅因能编辑地图而变成码/群 key 管理者。

验证只在真实已认证会话、world 绑定的一次短寿命 challenge 下进行，身份从会话取得；code 只在请求 body 传输，禁 URL、日志、analytics、报错回显、浏览器持久缓存和 FileCarry manifest。在线网络应为 TLS；本机 HTTP 仅沿用 b 的精确 loopback 开发例外，不承诺公网安全。不以码包装或加密群 key，不提供可离线枚举的一百万候选码包。

若服务保存 verifier，使用带独立高熵服务器 pepper 的 HMAC-SHA256，输入为域 `Neurou/access-code/v1\0` 加规范 `{serviceInstanceId,worldId,codeRevision,accessCode}`；pepper 不进入数据库/日志，轮换和丢失时码 verifier 必须按明确管理操作更新。数据库中只有 verifier 和轻量版本事实，没有明文码。错误使用统一拒绝响应，码是否正确、账号是否已有资格或 challenge 是否被消费不扩展未认证信息面。

**限流原则冻结、以下数值是候选开发配置，需 c-1 真实压测/错误契约验收后定版：** account/world 5 次失败/15 分钟、来源 IP 20 次失败/15 分钟、world 100 次失败/小时；challenge 寿命 30 秒，一次消费；达任一阈值拒绝新验证。认证/挑战/码验证分别计数，不以创建新 browser credential 清除账号/world 限额；代理部署前必须批准可信来源 IP 的取得方式，不能盲信客户端 X-Forwarded-For。并发消费、服务重启、码轮换、过期和重放都不得重发旧准入或绕过限流。

正确码为同账号/world 产出幂等的 `WorldObserverAdmissionFact`，重复正确验证不增加权限、设备或群 key，不自动加入 DeveloperRoster。WorldDeveloper 在 035 规则下把已有有效 WorldObserver 加入 CoDeveloper 名单，仍是合法 `DeveloperRosterChange` WorldCommit；码不能代替该提交。

## 4. 随机群 key 与成员 epoch

```ts
interface WorldRelayKeyDescriptor {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly membershipEpoch: number;
  readonly keyEpoch: number;
  readonly worldRelayKeyId: string;
  readonly keyCommitmentSha256: string;
}
interface WorldMembershipEpoch {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly membershipEpoch: number;
  readonly previousMembershipEpoch: number | null;
  readonly key: WorldRelayKeyDescriptor;
  readonly credentials: readonly WorldMemberCredential[];
  readonly developerTrustAnchorSha256: string;
  readonly activatedAtServerEpochMs: number;
  readonly developerSignatureBase64Url: string;
}
type WorldMembershipEpochProposal = Omit<WorldMembershipEpoch, 'activatedAtServerEpochMs'>;
interface WorldMembershipChange {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly changeId: string;
  readonly requestNonce: string;
  readonly worldId: string;
  readonly expectedMembershipEpoch: number | null;
  readonly reason: 'Initial' | 'MemberAdded' | 'MemberRemoved'
    | 'CredentialAdded' | 'CredentialRemoved' | 'KeyCompromise';
  readonly next: WorldMembershipEpochProposal;
}
```

WorldRelayKey 是客户端 CSPRNG 生成的 32-byte 随机秘密，每次新成员、撤销、凭据集合改变或 key 疑泄露都产生 **独立新 key**。不得从账号 key、密码、AccessCode、worldId、设备 ID 或上一 epoch key 推导。`keyCommitmentSha256=SHA256(32-byte raw WorldRelayKey)`，仅校验合法接收者所得 key 一致，不把它当 key 或访问凭据；它针对高熵随机秘密，不套用于密码/码。

本 v1 的 membershipEpoch 与 keyEpoch 从 1 开始，每次发布同时加 1，禁止跳回/复用；两个字段保留不同语义，当前逐字数值相等。keyId 是新 UUID。`credentials` 按 accountId、deviceId、deviceGeneration 数值序排序，无重复；同设备在一个 epoch 只有一份 signing/ECDH key 绑定。成员凭据不携带角色、世界进度、个人层或编辑资格。每个 account 的 WorldObserver 资格独立于其多个设备；重新注册设备不是复制旧 credential 或复用旧 seq 段。

publisher 用开发者根私钥对域 `Neurou/world-membership/v1\0` 加 `WorldMembershipEpochProposal` 除 developerSignatureBase64Url 外全部规范字节签名。Proposal 逐字含上述 epoch 的所有字段，但没有 activatedAtServerEpochMs；publisher 不伪造尚未发生的服务激活时刻。服务验证 world root pin、当前认证发布者、当前 epoch CAS、有效 WorldObserver、设备签名与 ECDH 绑定及变更 reason 和精确集合差异，在事务内补入 activatedAtServerEpochMs 得到最终 WorldMembershipEpoch，再用 purpose=`WorldMembership` 的服务 receipt 覆盖完整最终对象。开发者签名验证始终移除 signature 与 authority 产生的 activatedAt；激活时间只由受信服务签名验证，不能由文件或 publisher 自报。最初 epoch 的 previousMembershipEpoch / expectedMembershipEpoch 为 null，此后恰为当前 epoch；changeId 为 UUID，重复同摘要请求返回原结果，异摘要拒绝。

服务只保存成员公钥/指纹、epoch、root pin、准入事实、当前权限镜像、独立摘要和轻量 receipt。**不保存明文群 key，也不保存密文群 key package 的云副本**。签名 key、群 key、member ECDH 私钥和密钥包均不进入 WorldCommit 正文或 Relay 队列。开发者名单权限态与群成员态分开：AddCoDeveloper/RemoveCoDeveloper 不改变本已为 observer 的群成员资格，不能把取消地图权限冒充撤销世界观察资格。

新 epoch 只在完整受信 publisher 过程及服务轻量事务成功后生效，旧 epoch 不提前失效以掩盖失败。本地准备的 next/key/package 尚未激活不能生成新有效提交。激活时不要求所有离线设备已经解包，但 publisher 必须为合法目标准备完整包，未取得/未验证新包的设备暂停本机共享发布与正文解密；不以旧 key 接新 epoch、不以 ACK 伪造已经解包。网络/文件交付失败属于 Availability，不把旧包的 descriptor 改成新 epoch。

epoch 激活前已获合法 admission 的旧提交保留其历史验证证据；激活后新递交旧 epoch、旧成员或旧设备段的提交拒绝。撤销不追溯抹去既有 accepted 历史，不能重包/重签同 Identity 回避拒绝。同身份跨 epoch 仍是 IdentityConflict；历史迟到/OrphanCommit 规则沿用主契约，不通过换号复活已拒变化。

## 5. 目标设备 key package

```ts
interface WorldRelayKeyPackageContext {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly packageId: string;
  readonly descriptor: WorldRelayKeyDescriptor;
  readonly recipient: WorldMemberCredential;
  readonly developerTrustAnchorSha256: string;
  readonly developerSigningKeyId: string;
  readonly cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1';
}
interface WorldRelayKeyPackage {
  readonly context: WorldRelayKeyPackageContext;
  readonly ephemeralKeyAgreementPublicKey: WorldKeyAgreementPublicKey;
  readonly saltBase64Url: string;
  readonly nonceBase64Url: string;
  readonly ciphertextAndTagBase64Url: string;
  readonly developerSignatureBase64Url: string;
}
interface WorldRelayKeyAcceptance {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly worldId: string;
  readonly packageId: string;
  readonly packageSha256: string;
  readonly descriptor: WorldRelayKeyDescriptor;
  readonly recipient: WorldMemberCredential;
  readonly acceptanceNonce: string;
  readonly keyPossessionTagBase64Url: string;
  readonly recipientSignatureBase64Url: string;
}
```

package 是独立用户携带或显式点对点交接的数据包，**不是 FileCarry 完整载荷、不提供服务 payload 存取口、不由 Relay 中继**。交付实际入口、媒体/附件格式、路由和运维流程留 c 实施准入；本契约不自动授权发送外部消息。packageId 为新 UUID，同 packageId 异摘要拒绝，同一完整包重试不再加密。

publisher 为每个包生成一次性 ECDH P-256 ephemeral key、32-byte 随机 salt 与 12-byte 随机 nonce。Z=ECDH(ephemeralPrivate, recipient.keyAgreementPublicKey)。包装 key 为 HKDF-SHA256(Z, salt, info=`UTF8('Neurou/world-relay-key/v1\0') || UTF8(JCS(context))`, L=32)。正文是恰好 32-byte WorldRelayKey；AES-256-GCM 的 AAD 为 `UTF8('Neurou/world-relay-key-aad/v1\0') || UTF8(JCS({context,ephemeralKeyAgreementPublicKey,saltBase64Url}))`，tag 为 16-byte；ciphertextAndTag 解码恰好 48-byte。salt/nonce/tag 长度及 context 内 descriptor/world/recipient 重复绑定全部严格校验。ephemeral 私钥不复用、不持久化。

developer ES256/P1363 签名覆盖域 `Neurou/world-relay-key-package/v1\0` 加整个包除 developerSignatureBase64Url 外的规范字节，签名为 64-byte。接收顺序为严格解析/限额→验证受信根 pin 和开发者签名→核对自身认证身份、目标 ECDH 指纹/世代、有效 epoch 事实→ECDH/HKDF/GCM解包→核对 32-byte 长度与 keyCommitment。坏签名/错目标/错 epoch/错 tag/冲突包一律拒绝，不返回部分秘密、不覆盖原有效 key，也不提升资格。

acceptanceNonce 为 publisher 针对此 package 发出的新 32-byte 一次随机挑战，不用客户端时间作 freshness。`keyPossessionTag=HMAC-SHA256(WorldRelayKey, UTF8('Neurou/world-relay-key-acceptance/v1\0') || UTF8(JCS(acceptance除tag/signature字段)))`，tag 为 32-byte；注册设备 ES256/P1363 对域 `Neurou/world-relay-key-acceptance-signature/v1\0` 加包含 tag 的 unsigned acceptance 签名。publisher 验当前 recipient key、nonce/包绑定和 HMAC 后才确认交付；重放不二次确认。持有群 key 的服务外部 publisher 可以验证 tag，**没有群 key 的 Auth/Relay 无法独立证明成功解包**，不能把设备自报成功当成服务器见证的密钥保密性。服务至多保存 publisher 确认的 package/acceptance 不可逆摘要和轻量交付状态，不接收/存储 key 包或 HMAC 所需秘密。

epoch/key 包与个人 AccountKey、FileCarry 账号加密和 relay 单提交 DEK 包装严格分 purpose。合法成员持有群 key 后能解密该 epoch 的合法共享提交，却不能伪造其他作者签名；泄露群 key 的后果是本 epoch 的共享正文保密性丢失，并不赋予账号认证/开发者权限。

## 6. 撤销、历史 key 与 publisher 不可用

密码重设、账号 logout、注册凭据撤销、WorldObserver 撤销、CoDeveloper 移出名单是不同事件。b 当前仅有会话家族 logout，不存在可用的 credential revoke/世界成员操作，不能把本契约当它们已经实现。会话失效必须停止该会话后续准入；取消 MapEditPermission 按历史名单总序拒绝编辑，不擅自同时注销 observer。

完成**加密成员撤销**必须当前有效 publisher 发布新 epoch 并只向保留凭据分发独立新 key。旧成员/设备不得获新包。此前拿到的旧 key、旧正文和用户携出共享文件不可追回；不会提供“远程抹除已经读到的世界”。新成员默认当前及以后 key，历史 key 逐 epoch 由有效 publisher 在确有历史读取资格时显式发布目标包，不因一个当前包就自动推导全部历史。

没有历史 key、完整可验证提交前缀或受信本地 checkpoint 的新设备必须返回 Gap / CheckpointUnverifiable。共享 FileCarry 可读不等于其中 state 已正确重放、成员已获历史 key 或发送者是原作者。P4 补外部 checkpoint/原始历史证据与自身触碰贡献恢复；在该前置闭合前不声称新成员历史 bootstrap 或 Complete 已实现。

按 035，WorldDeveloper 账号注销后 DeveloperRoster 冻结，现有 CoDeveloper 仍可编辑。根身份/密钥管理权**不自动转交** CoDeveloper、StudioDeveloper、Auth 管理员或最后在线成员。root key/publisher 不可用时：

- 已有当前 epoch、合法 key、有效在线会话和当时 MapEditPermission 的成员继续在线编辑；仅 publisher 失联不能偷偷撤掉全部 CoDeveloper 权限。
- 正确 AccessCode 仍自动授 WorldObserver 事实；需要群 key 加入/新 epoch 的动作保持 Pending，返回 `KeyPublisherUnavailable`，不伪称已完成加密入群。
- 要求 rekey 的成员撤销、新凭据加入或 key 泄露恢复动作暂停并报告 `KeyPublisherUnavailable`；未完成的请求不激活虚假新 epoch、不称已经完成密码学撤销，不把当前 key 移交给未经许可的新成员。
- 若账号/设备已被真实 Auth 强制撤销，立刻拒绝它的后续服务请求；这不等于旧群 key 被收回。要阻止它解密未来任何可能取得的密文，必须完成 rekey。key 已确认泄露或当前 epoch 不再满足安全策略时，停止该 epoch 的保密 Relay 发布/声明，保持本地编辑与合法个人结算可用；不伪造它仍是安全 key、不把网络限制写成 CoDeveloper 永久撤权。

恢复 publisher、开发者根 key 或 world root 更新需要已批准的恢复/带外信任协议；本轮未冻完整恢复机制，不新造继承者、不通过正确码接管根。此项是后续 c 实施前必须明确的部署/密钥持有前置，未满足的配置不启动需要它的动作。

## 7. 在线边界、存储和威胁模型

本规范仅 `ExternalSharedOnlineV1`。批准原生 host/OfflineGrant/time proof 之前，Web RegisteredCredential 不生成新的有效离线共享提交，应用时长、performance.now、缓存 b 时间 receipt 不降级代替可信平台时间。预分配序号、持有群 key、正确 AccessCode 都不续期会话或扩大 OfflineGrace。

群 key、developer 私钥、ECDH 私钥只存在于当前显式解锁的能力范围；c 若尚无 P4 受保护存储，仅可在线内存使用并在 reload 后重新完成合法交接，不宣称长期设备身份或恢复能力。公开 pin/指纹/epoch 事实可持久化；秘密、恢复包、临时密钥材料、journal 和缓存若要持久化，必须先通过 P4 的加密存储/耐久提交/恢复协议，不能新增明文 localStorage/key 文件或第八项 Core 绕开它。JS 不能保证彻底内存擦除，报告不得声称防恶意 OS 读内存。

该模型防网络篡改/重放、错误目标包、群 key 与账号 key 混用、成员伪造其他作者、服务/文件自带公钥替换 pin。Auth/轻量权威仍受信维护账号身份、成员事实和时钟；开发者根 publisher 受信维护群 key 分发和精确 epoch。控制客户端脚本、XSS/恶意扩展、OS 管理员、已授权成员复制明文/密钥或与撤销成员串通不被包装算法消除。Web 私钥不可导出不代表攻击者不能调用它，也不证明唯一物理设备。

TraceTouch 的“不记录身份”只适用于 shared/checkpoint 聚合投影。原始作者身份、设备、时间、changeClass、权限事实和 coverage 可被 Relay/成员看见，包收件元数据也不匿名。群加密隐藏正文，不隐藏数量/长度/时序或作者；不承诺端到端匿名。若产品另要求所有原始触碰提交不可归因，需要与冻结作者身份/签名一起提交新 PROTOCOL，不能用删除渲染姓名冒充完成。

## 8. 实施前置与候选事项

**已冻结：** 六位码自动 WorldObserver、资格分离、根 pin、签名/ECDH 分用途、随机群 key 与 epoch、精确 package/AAD/签名/acceptance、key 包不云存、不进 Relay/WorldCommit、历史/撤销限制、publisher 不可用与共同开发继续编辑的边界。

**未实现且须 c 实施准入明确：** 正式 world 注册与根绑定入口；AccessCode verifier 的管理、pepper 运行配置；成员事实的 exact HTTP 请求/响应/错误/CAS/幂等路由；publisher 在线部署与独立私钥保管；目标 ECDH possession challenge 的真实 wire；package 用户交付入口与限额；根 key 恢复/更新信任链；实际 rate-limit 数值/来源 IP/负载策略。上述限制不回改 b 的 API 或核心逻辑。

**P4 依赖：** 秘密和 key package 的持久保护、旧明文一次迁移、外部 checkpoint 可重放认证、历史包/本人触痕贡献恢复。**P5 依赖：** 原生可信 host、物理设备、OfflineGrant 和离线 AppendedAt proof。上述前置未闭合时必须保持拒绝/Unknown/Pending，不以本 Markdown 或 fixture 测试替代真实能力证据。
