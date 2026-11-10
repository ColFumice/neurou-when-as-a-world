# B2.5c-2a 正式裁定书 · VERDICT-426～440

日期：2026-10-11（Asia/Shanghai）。裁定对象：《雨若》真实轻量权威与 Relay 的独立在线原型。状态：**冻结完成；本轮零实现，后续各阶段须按入场条件实施与验收**。

依据：P3 VERDICT-391～410、c-1 VERDICT-411～425、实际源码只读审计，以及用户对 PROTOCOL P7/P8/P9 的本次正式回复。v3.18已由Trae同步；本轮不修改名库。本文与[HTTP/端口契约](http-and-port-draft.md)、[根与群key契约](key-delivery-and-pins.md)、[阶段与遗留](stages-and-open-items.md)共同构成冻结包；两份audit仅记录审计输入，正式决定以此冻结包为准。

## VERDICT-426 · 本轮与 c-2 的授权边界

c-2a只新增quality-review/b2-5c-2a内文书/基线证据，不创建TypeScript、SQL、路由、TLS edge或产品接线。c-2目标为真实Auth基础上的轻量authority、有限Relay、HTTP submit/pull/ACK、最小真实key交接和独立组合根。排除完整FileCarry/P4、平台OfflineGrace/P5、PhysicalDevice/bootId、旧身份迁移、非Primary生产迁移、WorldRegistry本机位置API、产品ObserverSync/首次加入/AccessCode UI、地图编辑器/EditPresence、云部署。本轮不启动c-2b实施。

## VERDICT-427 · 端口采用兼容面与增量协议面

保留RealServiceContracts.ts中两旧接口逐字不变；旧authority全部既有方法readAccountFacts、旧Relay泛型relay均应在c-2真实adapter实现。**不是实施一个尚不存在的“全部世界业务方法集合”**。新增RealWorldAuthorityProtocolPort继承旧authority，新增RealCommitRelayProtocolPort继承RealCommitRelayPort<AdmittedWorldCommit,RelaySubmitReceipt>。方法、输入与结果按HTTP契约冻结；relay严格等价submit。

批准status/world注册与轻量facts、ECDH注册challenge/proof、最小set-code/challenge/redeem、epoch发布/历史读取、sequence/permit/admission/readAdmission/seal，以及Relay submit/pull/acknowledge。未列迁移/暂停/HomeDevice/CopyPermission/closure生产者/根转让方法不实施。mode逐字ExternalService，失败不切fixture、不冒用ContractAdapter、不放宽guard。

## VERDICT-428 · P7闭合：独立真实会话 owner

用户裁定原文：**“采纳：新增独立会话 owner，保留旧源码”**。新增RealSharedServiceSessionAdapter，实现既有RealAuthServicePort及SharedServiceSessionPort/RegisteredAuthorSigningPort窄能力；复用b真实login/logout/verify/refresh/CSRF/PG会话协议。旧AuthAdapter私有字段不能抽取、反射或复制未注册key；原源码保留。

cookie/CSRF/注册ES256私key留presentation内存/浏览器会话边界。director只见类型化context、固定路由请求与固定用途签名；不提供任意URL/domain签名或秘密getter。refresh/logout/撤销/世代改变令相关能力同步失效。新增SharedSessionVerifier读取同PG并逐项遵循b session/CSRF/disabled/Active-device/generation/expiry规则；不能借context快照绕过实时检查。

## VERDICT-429 · 同实例、同 PG、同会话，存储职责分离

沿用Node24 LTS/Fastify5/PostgreSQL17、同server/、serviceInstanceId、服务签名根和同一neurou_access/neurou_refresh会话family。新增独立buildSharedServer组合旧buildApp及shared插件；旧b入口/guard/001迁移保持。Relay队列/worker可独立失败；其失败不阻塞Auth和轻量admission。

authority只存公开批准根、world/Genesis/manifest摘要、账号/设备/成员/权限轻量事实、段/许可/不可逆载荷摘要、幂等/拒绝/seal原receipt。Relay只存有限期WorldCommit精确密文字节及公共proof/cursor/ACK。不保存完整Genesis/manifest/state/checkpoint/FileCarry/个人七项/媒体/journal，或任何群key包/根私key/账号key。无真实readMigrationPayload；文件继续由用户FileCarry搬运。

## VERDICT-430 · P8闭合：loopback基线与受信 LAN TLS edge

用户裁定原文：**“采纳：loopback 基线 + 受信 LAN TLS edge”**。必测开发基线为b现有精确127.0.0.1 HTTP（端口43125默认），不把通用localhost/::1/0.0.0.0自动加入旧profile。LAN必须同源HTTPS。

后续新增SharedTlsEdge：先严格核验唯一公共Host/Origin/证书，再显式转换至同机固定loopback后端Host/Origin。拒绝客户端代理头、任意upstream、异源/缺失Origin、HTTP降级和redirect；后端trustProxy=false及旧限制保持。所有session设置与清除cookie强制Secure/HttpOnly/SameSite=Strict；来源IP限流由edge的真实socket来源执行。PG/旧后端不暴露LAN。操作者提供固定LAN origin、SAN证书/CA及每客户端信任安装；没有这些条件则LAN未验收，不关闭证书验证。

## VERDICT-431 · 开发者根与服务根分别带外安装

WorldDeveloperTrustAnchor、服务AuthorityTrustAnchor、TLS信任三者独立。操作员批准world/account/map/完整root指纹/Genesis和manifest摘要组合；服务器与每个独立客户端核对相同公开配置。root-only首次world注册必须真实开发者会话、已安装组合、根签名与注册设备签名；不从incoming包/Relay/code/服务自报key建立TOFU。

原型根/群key/成员ECDH私key仅驻当前解锁内存；公开pins可保存。reload后不得自动换根或声称恢复；publisher不可用即KeyPublisherUnavailable。根长期保护、恢复/轮换、旧世界根迁移留P4或另行裁定；当前证明的是操作员批准的独立原型世界。

## VERDICT-432 · 最小key交付必须真实解包与acceptance

结构检查不足以完成c-2。新WorldMemberCredentialChallengeContext/Challenge/Proof精确schema及ECDH私钥possession按key文档冻结；注册ES256与ECDH/root/service key分用途。一次服务challenge30秒、绑定world/session/device/generation、公钥、32-byte随机secret的GCM解封+HMAC tag+注册签名，PG仅留public wire/expectedTagSHA/消费事实。

WorldRelayKeyPackage与Acceptance逐字沿用P3 ECDH-P256/HKDF-SHA256/AES-256-GCM/ES256/HMAC域、context及长度。群key随机256bit，包≤16KiB，每包fresh ephemeral/salt32/nonce12；acceptanceNonce32、30秒、一次消费。publisher实际验HMAC与注册签名后本地确认；Auth/Relay无群key，不能声称目击解包。

本轮冻结explicit内存bytes bridge/操作员带外交接；不把包传Auth/authority/Relay、不新增delivery-confirmation路由/表、不落秘密文件/log。WorldRelayKeyDelivery负责纯编排，平台通过WorldKeyAgreementPort/WorldDeveloperSigningPort注入。真实WorldCommit生产另由SharedCommitSealingPort固定suite封装，c-1 crypto接口不改。自动网络包分发与持久保护仍为候选。

## VERDICT-433 · 正式归属与依赖方向

新增协议数据/窄port归src/director/SharedServiceProtocolContracts.ts；纯SharedRelayPrototype与WorldRelayKeyDelivery归director，零cc/DOM/网络/Node。RealWorldAuthorityAdapter、RealCommitRelayAdapter、独立session owner、SharedCryptoAdapter、SharedRelayDurableCache归src/presentation。独立组合根assets/scripts/SharedRelayPrototypeBuilder.ts；旧RealServiceBuilder保持，不扩旧boot链。

presentation通过IntentPort仅type-only依赖director；不value-import c-1五类。组合根组装纯内核与平台实现。server独立包可以把同一纯schema/codec作为只读构建输入编译，不复制宽松旁门、不把Node源码导入Cocos。未来IntentPort只增type-only suffix；本轮不改任何源码。

## VERDICT-434 · ARCHITECT冻结 wire/route/error/resource

全部新业务POST /api/v1/shared，exact JSON/JCS安全整数子集，nonce32、显式null、unknown入口验证，拒绝重复键/额外字段/非规范字节。18条route、请求字段、reply/签名purpose、HTTP错误detail、资源值均以HTTP契约为正式界限。新增SharedTransportReceipt使用Neurou/shared-transport/v1\0，不扩改c-1 SharedAuthorityReceipt.purpose；原业务receipt不重签或改变nonce；六类P3 mutation统一AuthorityResult签名wrapper，跨新nonce只签响应包装，原事实保持。

各route bodyLimit16/32/64/512KiB独立列出；旧auth全局16KiB不改。成员epoch≤256凭据，完整response≤1MiB；pull≤256/default128、wait≤25000/default25000ms，一般deadline12000ms、pull wait+7000≤32000ms。超限拒绝，不能截epoch/半条commit。HTTP fault不授TimeTooLate/InvalidChange/Orphan终局，必须检验相应P3签名证明或完整精确源字节。

## VERDICT-435 · P9闭合、CSRF、限流与幂等

用户裁定原文：**“允许最小协议，无产品入口/UI”**。正确六位AccessCode自动产生WorldObserverAdmissionFact；不是群key派生/密钥分发，不人工审批。独立root set-code和challenge/redeem路由获准；无产品入口/UI、无ObserverSync。普通成员必须真实code准入，不能fixture/管理员seed。

所有shared POST含只读status/pull都验真实Access会话、精确Host/Origin和CSRF。code HMAC verifier+独立高熵服务pepper，限流按HTTP契约固定：account/world5失败/15分、来源IP20/15分、world100/小时；challenge30秒一次消费。其余设备/world/admin/edge速率亦固定；同时保持b240/min/backendIP更严格原闸。

幂等键(instance,account,nonce)绑定operation/world/device/generation/请求SHA；mutation事实+原结果同事务。完整结果≥7日，之后保留nonce/hash/result tombstone，旧nonce不重执行。身份/admission/段/seal持久语义不被普通结果TTL清空。临时网络/DB/CSRF/格式/限流失败不伪终局；同nonce异摘要Conflict，不靠换nonce逃封边。

## VERDICT-436 · 真实clock、代次与非回填

新增RealAuthorityClock只在生产取真实Node wall/monotonic、PG generation及操作员信任配置。共享status用服务签名明确发布clockGeneration/policy/可信状态；b generation不能自动冒充另一个clock的信任。PG authority_clock_state保存durable lastSigned下限；事务内持锁重采样，墙钟回退、低于durable floor或wall/monotonic偏离>2000ms即latch Untrusted。禁止max(wall,floor+1)人造未来、客户端AppendedAt、DB now替代或HTTP回填。

restart增加服务clock generation并保留floor；历史原receipt可以原样读取，不成为当前时间样本。失信禁止新准入/epoch/许可/拒绝/seal；恢复必须明确操作员处置与新generation验收。在线permit AppendedAt来自事务S、30秒；同毫秒仍按account/sequence总序。同world admission/epoch/seal串行，seal cutoff≤S−H且不回退；封边后不追加旧时刻事实。S是权威逻辑生效时刻，不声称精确WAL fsync物理时间。

fixture clock只可由隔离测试builder注入；生产入口无env/HTTP fixture开关。人工加速fixture证据不得称生产真实时间/离线证明。

## VERDICT-437 · PG表/迁移/事务由ARCHITECT指定

表分组、约束及事务方案见[存储冻结](storage-and-clock-contract.md)。新增002.sql及SharedMigrationRunner，旧001/runner不改；checksum ledger与单迁移advisory lock。identity唯一(accountId,authorSequence)，跨world全局，号段1024/1小时、永不回收。cursor用numeric(20,0)+uint64约束与wire十进制string，不经Number。

保持auth锁序account→device→family→token，后接clock→world→sequence/permit→admission/epoch/seal或relay；多行稳定排序、无反向锁。public事实+canonical receipt bytea+幂等原结果同事务，COMMIT成功才发响应；重取原字节不重签。authority不收envelope/body，Relay密文bytea独立表；数据库失败不冒充已签业务拒绝。

## VERDICT-438 · Relay、耐久ACK、Gap与有限B

submit只收已admitted精确envelope/publicproof，验摘要/来源/作者签名，不声称正文AEAD/地图权限。queue位置与原receipt同事务；重复同摘要原位置，异摘要拒绝。pull检查generation/floor且对authority摘要账检测从未入queue缺载；空batch不证明全量，短admit→submit窗口亦保守MissingAdmittedEnvelope Gap。

客户端完整SharedCommitValidator验真后，独立共享密文缓存原子保存并回读原字节/SHA，再签ACK；缺key/缺源/HostFailure不ACK。服务只证见ACK声明，不能证硬件磁盘。缓存无secret/个人/明文state/checkpoint，不替代P4。

G=3600000、B=300000、U=60000、H=3960000、retention=86400000ms，H≥G+B+U、retention≥H。全部ACK也不能早于admittedAt+retention删除；过期/丢段保持tombstone/floor并Gap。B是健康网络/及时pull/耐久的条件假设；超B/Gap不得推进checkpoint，不能把25秒长轮询当B或延长OfflineGrant。seal仅证摘要前缀封闭。

## VERDICT-439 · c-2必须真实双客户端与独立组合根

c-2e就必须至少两个隔离principal/cookiejar/注册签名key/ECDH key通过真实loopback HTTP与真实PG完成producer/receiver submit/pull/耐久ACK。不能留到c-3或用同一个mock实例换device字段。含WorldDeveloper与真实code准入Observer、同账号两设备全局号段，并发/重启/会话logout/epoch撤销、两端同前缀确定性重放。

SharedRelayPrototypeBuilder独立组装director内核与presentation adapters；验收harness调用同一组合根能力，不接WorldFolderBuilder/SceneBuilder/产品UI。c-2f另验受信LAN HTTPS、真实两设备与证书边界。内存key桥与HTTP证据分别记录；不把key桥报成自动LAN分发。阶段c-2b～f及入场条件按阶段表执行。

## VERDICT-440 · 不变式、门禁与冻结结论

沿用INV-10/12/13；目录追加仍是本地发布唯一commit point；持lease才写、无Web Locks显式拒绝；七项仍并入主逻辑key；源主动排空/发起账号绑定/RealityPause≥OfflineGrace及FileCarry按账号加密均不变。c-2独立cipher缓存不触旧主key/锁序/journal，更不授迁移/暂停/OfflineGrant。CrossDeviceImportJournal/WorldMigrationJournal不并进共享日志；三类WorldCommit不包括Ledger NarrativeEvent/七项Core。ContractAdapter保留测试，真实链独立证据。

三旧门禁基线全部PASS：命名0 ERROR/45既有WARN（与c-1文本一致，增量0），依赖0 ERROR（127TS/437依赖），tsc --noEmit exit0。本轮只验证基线健康，**没有真实Relay、密码学交付、LAN或c-2运行测试结果**；c-1历史154/154不是本轮重跑。保护SHA按本轮7154文件基线完成终检，原始证据独立保存。P7～P9已获回复并闭合，无需再次申请相同授权；若后续发现新冲突，继续遵循先PROTOCOL。
