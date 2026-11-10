# B2.5a 安全模型提案

2026-10-11（Asia/Shanghai）。**候选模型，不是已通过真实安全验收的实现。** P1～P5 未裁，不能据本文件称 B2.5a 全量冻结。账户、服务、世界/群密钥、个人文件、物理平台分别有信任边界。

## 信任与攻击者

| 对象 | 信任/验证范围 | 不构成的证明 |
|---|---|---|
| AuthService | 账号/设备/成员准入、轻量账号事实、归属CAS、暂停、服务时间/receipt签名 | 不掌握世界存档或明文个人/群密钥；签名不证明服务器时钟正确 |
| Relay | 成员身份、外壳签名/开发者权限、幂等、有限密文队列/ACK/游标 | 不能读取提交正文、持久化状态/检查点或替客户端合并 |
| 本机纯逻辑 | 校验、准备、正式内容再认证，保持七项/品牌/领域不变式 | 自报账号/deviceId/文件签名不能授予权限 |
| 浏览器凭据 | origin下已注册key持有及认证会话 | 不能证明唯一物理机/OS boot；不能阻止XSS/恶意扩展调用key |
| 可信原生host | 经批准的设备密钥、OS boot/uptime、持久设备绑定 | 普通helper/系统API不自动对抗恶意管理员；TPM也不保证整机不可换身份 |
| 用户携入文件 | 一律隔离、严格codec/hash/签名/本人AEAD/内容绑定 | 不信任其路径、权限、通关、服务器时间或运行时品牌 |

模型应防网络窃听/修改/重放、文件替换/错账号、nonce复用、其他账号窥读个人层、旧receipt/fixture混入真实域、普通本地静态文件泄露。服务器受信维持身份/权限/时钟；Relay 可丢弃/重排但不能伪造合法正文。本阶段不承诺抵御已控制客户端执行环境、恶意OS管理员、恶意Auth替换身份公钥或从已解密会话复制明文；严格物理保证的实际攻击者边界须P5批准。不能在报告中把这些边界隐藏成“WebAuthn可信物理ID”。

## 账号认证

密码经TLS提交，仅用于认证。Argon2id建议基线m=64MiB/t=3/p=1、16-byte随机salt、32-byte输出；服务实际资源压测后才能升版配置，禁止降低到弱明文/通用hash。账号注册由本地部署管理员或显式注册流程创建，不预置可公开的生产密码。登录、注册、恢复/challenge/AccessCode分别限流，错误避免泄露账号存在性。

服务使用高熵不透明会话/刷新凭据；数据库仅存摘要，15分钟访问资格、7日绝对刷新家族寿命，刷新旋转并复用检测撤销家族。Web同origin cookie为HttpOnly/SameSite=Strict，真实HTTPS启用Secure；loopback HTTP仅开发，cookie例外不计真实设备安全验收。精确校验Origin/CSRF/Host，不开放通配CORS。原生凭据OS vault，响应/URL/log不含秘密，设备挑战短寿命一次消费。

登出先关本地新准入并撤销解密capability，再发服务撤销。网络失败明确serverRevoked尚未确认，记录不含凭据的待办；不能通过登出删本地数据解除RealityPause/DeviceAccountBinding。新的登录/切账号先服务查询物理绑定；P5不满足时不能称严格物理限制已经实现。

## 账号密钥与恢复

AccountKey为客户端CSPRNG产生的256-bit随机根，账号ID/keyId只是标签。服务按认证账号管理少量wrapped AccountKey、已批准设备公钥、key epoch与恢复包摘要；不保存世界内容、明文根/DEK/WorldRelayKey，也不通过密码重置下发能解密旧个人层的明文key。

首次建立根后生成独立256-bit AccountRecoverySecret，用户线下保存。HKDF-SHA256对recovery secret按accountId/keyId/epoch/serviceInstanceId派生恢复包装key，以AES-GCM包装根；秘密不上传，仅加密包装可存服务轻量key vault。已批准设备重新认证后，可用目标设备ECDH P-256+HKDF-SHA256+AES-GCM的标准封装建立密钥交接，验证双方注册身份并绑定challenge；不自创公钥加密算法。具体互操作向量在b/d实施前验证。

新设备必须先正常账号认证，再凭可信设备批准或恢复秘密解包；**登录成功本身不保证新设备能解密历史文件**。这仍依赖Auth提供的账号认证/授权凭据，禁止匿名解密生产路径。离线仅已认证、拥有有效OfflineGrant且本机安全解锁的批准原生设备能取得key capability。Web不授予此离线资格。

设备缓存根只保存在OS vault或受限WebCrypto不可导出key的包装中；浏览器key强度只宣称RegisteredCredential，不能用localStorage裸key。解密明文只在必要内存中，日志/缩略图/临时文件/崩溃dump不得扩大保存；JS无法保证彻底内存擦除，应缩短生命周期，不声称防OS读内存。

轮换生成独立新keyId/epoch用于新写，只通过当前批准设备公钥/合法恢复key封装分发；可用新根包装旧历史根保持可读，**不以旧根包装新根**。泄露轮换同时撤销设备、更新恢复秘密及服务epoch，疑泄露旧根不能推导新根；其已经取得的旧根无法远程收回，需本地重加密数据及明确历史泄露范围。丢失所有可信设备与recovery secret意味着旧密文不可恢复。恢复包只能恢复密钥，不能恢复不在用户本地的世界文件。密码重设不重置epoch、不伪造旧恢复能力；恢复须重新核对暂停/设备绑定。

## 个人层/媒体的AEAD与容器

选AES-256-GCM、96-bit nonce、128-bit tag、HKDF-SHA256、SHA256、JCS；suite逐字为AES-256-GCM-HKDF-SHA256-v1。新的导出/真实存储对象CSPRNG产生全新256-bit DEK和exportId/objectId；不跨重试重用key生成不同明文。幂等重试复用**同一已持久化完整密文对象**；若任何明文/AAD变化，重新生成对象/key。

个人JSON也作为加密条目。每条目key=`HKDF(DEK, salt=UTF8(exportId), info=UTF8(JCS({purpose,entryId})), 32bytes)`；nonce=`0x00000000 || uint64be(chunkIndex)`，同一条目key内chunkIndex从0连续唯一、chunkCount<2^32。每对象DEK不同，逻辑entryId唯一、物理块(entryId,chunkIndex)唯一；禁止空缺/重排/重块。key包装另用AccountKey经HKDF派生一次性wrap key，salt=UTF8(exportId)、info=UTF8(JCS({purpose,wrapId}))，与独立随机96-bit nonce；同wrapId只允许一份持久密文，重包生成新wrapId。purpose使用精确域字面量，禁止歧义拼接；签名/包摘要按entryId规范字节序、块数值序排序。

AAD规范对象绑定：purpose/FileCarry或LocalStorage、formatVersion、serviceInstanceId、worldId、senderAccountId、keyId/keyEpoch、exportId/objectId、sharedDigest（本地存储按独立context）、entryId、chunkIndex/chunkCount、plaintextByteLength；本地存储额外绑定逻辑主key/事务类型/事务ID/存储世代。媒体kind/MIME/明文hash/归属索引在本人加密JSON内，对应entryId不可在不同媒体间替换。共享层变化须重新生成本人密文对象；不能修改原共享摘要仍保留旧tag。

公开manifest只暴露世界/发送账号、key标签、密文entryID/数量/长度/hash/签名与共享摘要，允许流式预检；大小/数量的侧信道不承诺隐藏。明文媒体SHA256只在本人密文索引，公开hash只针对密文。解密后按私有MIME白名单、字节magic、长度/hash验证；未知/缺块/多块/坏tag全部拒绝，不输出部分个人层给正式恢复。

包摘要覆盖无digest/signature字段的规范manifest、有序shared字节摘要及有序ciphertext条目摘要/长度；发送者注册ES256签名使用独立FileCarry域。JCS只用于严格允许的数据值，先拒绝重复键及不安全数再规范化。签名公钥需真实账号认证/可信离线证据，不信任包里自带公钥。发送者签名是搬运声明，不重签成世界开发者事实，也不从文件生成服务权限。

共享层是可读数据，不能用AccountKey封入整包。接收其他账号文件保留原本人密文而不解密；转发用合法共享层、删除前发送者个人密文、构建当前本人个人层。新exportId/new DEK/new签名；不能继续转发包含别人层的旧包并声称满足046。无当前本人全部合法数据时不造Complete。

ZIP64 STORE容器在隔离流式staging读取，严格路径/重复项/限额/entry计数；不直接解包、不开外部URL、不执行文件，资源打开须通过可信媒体解码器。本机导出失败保留原数据，未完整落盘的包不宣布成功。

## Relay端到端加密

WorldRelayKey为世界成员共享随机256-bit群密钥，每membership epoch不同；不从account key或6位AccessCode派生。Auth/Relay只有成员公钥、轻量权限/epoch与密文key封装，成员密钥交接须受认证/用户批准；FileCarry共享内容可读不表示持文件者自动成为Relay成员或WorldDeveloper。成员加入/撤销、世界key的可信分发、开发者公钥pinning与AccessCode关系均P3前置，不假装已落协议。

每WorldCommit新随机DEK，群根按worldId/epoch/作者账号+序号派生唯一wrap key包装该DEK；nonce/key域与个人层完全分离。正文AEAD的AAD包括worldId、commitIdentity、authorDevice/generation、membershipRevision、keyEpoch、changeClass、cipherSuite。作者ES256签名覆盖外壳、密文与wrapped DEK；收到者先验签再解密，再按精确正文schema/权限/SharingCriteria验证。相同群key持有者不能伪造其他作者签名，外层DeveloperMapChange仍须已验证WorldDeveloper。

撤销更新成员revision/keyEpoch，撤销设备不能获新key。旧密文/旧群密钥已交付给旧成员，无法追回；老提交有效性按提交时明确授权窗口/序号段/SettleHorizon验证，不能把新成员规则追溯任意改写历史。离线自序号必须有限、持久唯一，缺号/撞号不靠墙钟补。群密钥分发与正文schema未冻结前Relay只可作壳实验，不得宣称完整共享机制接入。

Relay拉取游标是服务队列位置，作者自序号是业务身份，两者不混。客户端在本机耐久验证/存储后ACK；保留期必须满足 `retention >= SettleHorizon >= OfflineGrace + boundedRelayDelay`，24h仅满足该校验才可作为候选，到期或全成员ACK删除，服务不无限保留历史。丢段/长期离线通过用户文件补共享层，不请求服务器WorldCheckpoint。网络不可用没有无限时延上界，超过期限的共享提交按历史规则不纳入共享层、保留诊断，不将其当个人账本丢弃。具体阈值与迟到证明留P3，不能用24h保留期自动代替settlement。AppendedAt还必须有中继可见外层值、与正文一致及签名/AAD绑定，精确载体/离线真实性仍P3待裁。

## 时间、离线与暂停

服务时间receipt随机requestNonce、实例/keyId/clockGeneration绑定，TLS+验签防重放，不给本地时间替代口。实际服务时钟须同步且有异常监控；暂停持久化起止与事务CAS。进程内用单调时间验证至少经过冷静期，重启恢复若无法证明时间健康/未提前则TimeUntrusted并保持冻结，人工恢复有审计；提前的UTC跳跃不能让暂停提前结束。服务管理员仍是时间信任主体，不把签名等同第三方时间证明。

Native uptime候选以OS boot session为单位、单调、休眠计入；bootId必须源于批准host的OS启动世代，不能随机每次开app生成，也不能通过文件复制跨boot。Windows uptime可从GetTickCount64等平台API读取，但需核对快速启动/休眠/恢复/重启语义、精度与host可信边界，不能仅调用一次API宣告安全认证。重新启动/host丢失/uptime回退立刻失去离线资格并要求在线。

签名OfflineGrant绑定账号/设备generation/bootId/uptime基点/serviceInstance/homeRevision/授权generation；时间请求、失败verify、ping或本地解锁不续期。请求前可信uptime作为预算基点，包含网络耗时避免增加宽限。有效预算只允许既有归属世界离线继续，不能离线登记/Claim/解冻/账号切换；到期关新准入并自然排空，正在演奏按INV-12真实音频时间线完成。禁止停止整个FrameDriver/清七秒计时/seek/伪造ended。

RealityPause≥max(1h,OfflineGrace)继续，但**不是离线设备停止证明**。源主动排空确认必需；已到期但未到安全点的活动仍可能延后，真实release必须靠源当前确认，不按倒计时猜结束。服务器签名排空receipt只表示它接受注册设备声明；本地live capability/锁与可信host保障需独立验证，恶意浏览器签名不能远程证明物理事实。

## 静态存储与恢复前置

真实加密范围为个人Core section、完整携带个人层的fork/import/migration journals、staging、媒体、缩略图和恢复文件；公开世界元数据/目录身份可保持可读，但不能泄漏个人section。七项仍一个逻辑主key，不新增section key。若选择整体Core物理加密，只能是本机存储保密实现，不把整个Core的所有权改为个人层，也不把同种整包策略应用到FileCarry共享层。

WebCrypto异步准备后必须等待密文真实提交/回读；不能同步Storage facade返回成功而后台再写。新增真实域、同步逻辑视图和密文CAS、nonce持久化、崩溃恢复/GC/旧明文迁移均P4阻断。未目录发布不得激活；目录发布后清理失败标pending不删世界；服务Claim已成而本机失败保留receipt/journal。任何清理必须证明对象未发布且无人持用，不为保护声明删除源文件。

## 后续必须验证的安全证据

实施阶段验证：真实服务器重启/CAS/刷新重用/CSRF、坏签名/nonce/AAD/错账号/分块截断、未知版本/同ID异正文、设备撤销/清安装/boot变化、sleep预算、真实一小时与服务器时钟异常、源活动自然排空、Claim后本机故障恢复、无Web Locks拒绝、所有静态个人数据和journal无明文落盘。c/d共享生产来源、P4存储及P5物理host前置没闭合前，不编造通过测试或真实安全承诺。
