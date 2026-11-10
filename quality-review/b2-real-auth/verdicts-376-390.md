# 《雨若》B2.5a 落地裁定 · VERDICT-376～390

2026-10-11（Asia/Shanghai）。依据：用户本轮《PROTOCOL裁定回复·B2.5a P1～P6 + 授权B2.5b》。**P1/P2裁定闭合，B2.5b正式准入。P3/P4/P5的原则、延后补冻和能力限制已经裁定，其完整实施契约仍待c/d/e入场补齐，不再阻断b。** 本文覆盖356～375及旧PROTOCOL中“b不得启动/全部等待”的过时停止结论；旧文件与raw保护FAIL保留点时证据，不回写。

## VERDICT-376 · 正式回复效力与阶段恢复【冻结】

裁定：接受本轮全部PROTOCOL回复，进入仅b授权范围；不用再次请求已给出的端口、loopback、服务安装运行或测试授权。B2.4契约级闭合保持，b不会自动变成完整跨设备/文件/物理验收。影响：阶段准入与后续Trae同步。可逆：以后显式改裁，不改历史证据。

## VERDICT-377 · P1真实端口与ExternalService【冻结】

裁定：新增RealAuthServicePort、RealCommitRelayPort、RealWorldAuthorityPort，真实mode逐字ExternalService。旧AuthService.login/logout/verify与CommitRelay.relay同步签名、archive、原ContractAdapter类型/guard/receipt/key/锁原样保留。允许新增契约、type-only导出、独立组合根、模式分流；不放宽旧guard、不冒标签、不失败切fixture。影响：新director纯数据契约、presentation适配、assets组合根和独立server包。可逆：增量路径可版本化，不能隐藏跨模式转换。

## VERDICT-378 · P2真实权威不得承载payload【冻结】

裁定：服务允许账号事实、归属、暂停、设备绑定、幂等请求、不可逆载荷摘要及轻量receipt，禁存世界文件/七项/媒体/共享状态，真实API不提供readMigrationPayload。完整文件由用户FileCarry搬运；源本地消费live drain能力并持锁至release完成，网络只发确认摘要、一次challenge和注册设备签名。影响：以后真实迁移接口，b不实施迁移。可逆：不得以密文存档“仍看不懂”为理由改成云备份。

## VERDICT-379 · P3共享补冻在c之前【冻结边界；内部schema候选】

裁定：补冻AppendedAt来源/同序冲突、三类变化字段、作者多设备序号与离线段、开发者权限、成员/AccessCode密钥交接、TraceTouch聚合、检查点覆盖/迟到及有界中继延迟。不以NarrativeEvent/Core作共享提交，不暗开AccessCode/ObserverSync。补冻可与b文档工作并行，不实现Relay或共享机制。影响：c/d入场门槛。可逆：候选可修订，历史024拉取/不透明正文、022归属不回退。

## VERDICT-380 · P4加密存储先准备后提交【冻结原则；细化候选】

裁定：批准新增真实加密适配路径，七项结构/归属、revision、逻辑主key与锁顺序保留；异步准备密文→有效lease下可验证耐久提交→目录追加。所有个人journal/暂存/缩略图/截图/入场视频/媒体同保护，旧明文转换有独立一次迁移协议。细化在d前，不阻塞b，b不新增个人世界数据或文件加密机制。影响：d存储/恢复协议。可逆：算法/容器升版须显式，不能后台未写完返回成功。

## VERDICT-381 · P5选择A：物理保证留原生可信平台【冻结边界】

裁定：Web只RegisteredCredential；未知平台无OfflineGrant，在线受限验证，不称PhysicalDevice。严格设备级暂停绑定/OfflineGrace只在批准原生host/硬件方案验收，明确TPM/attestation/清安装/OS重装/攻击者边界。应用时间不降级为设备uptime。平台细化e前，b不实现host、grant或物理防重装。影响：b身份assurance固定，e验收。可逆：产品承诺改裁必须显式。

## VERDICT-382 · P6外部报告归因闭合，历史raw FAIL保持【冻结】

裁定：用户确认docs/B2.4-overall-report.md、quality-review/B2.4-overall-report.md为Trae按PROTOCOL授权落盘。追加本轮closure记录归因为TraeAuthorized，不回写a的UnknownExternal观测、6,937→6,939、raw exit1或first FAIL。本轮baseline在两项已存在后捕获。影响：来源审计；不把授权等同SHA相等。可逆：字节历史不可重写。

## VERDICT-383 · b服务包与运行时【冻结】

裁定：独立server/包，Node.js24 LTS、Fastify5、PostgreSQL17，真实loopback HTTP开发；数据库独立进程与耐久事务。无Docker环境可用官方来源portable PG17，不能用内存/SQLite/pg-mem冒充PG。服务器不恢复archive/service/sync、不进入Cocos模块树，独立锁文件/构建/测试/迁移。影响：服务运维与本机证据。可逆：容器/原生运行方式可换，真实版本/语义必须如实记录。

## VERDICT-384 · b认证与设备凭据【冻结】

裁定：账号密码经Argon2id验证；首次登录以新P-256注册凭据的challenge持有证明+密码注册RegisteredCredential并由服务签发deviceId，既有凭据登录核对challenge/账号/公钥/世代。不产生匿名游客权限、不从fixture继承账号事实，不把注册公钥当硬件认证。账号由显式管理员CLI创建，无默认生产账号；通关事实/CopyPermission不允许普通客户端赋值。影响：login、challenge、轻量device操作；密钥包装恢复不是b范围。可逆：未来OAuth可另裁，不能重定义账号ID或提高assurance。

## VERDICT-385 · b会话、刷新与登出【冻结】

裁定：随机不透明访问/刷新凭据，DB只存摘要；访问15分钟，刷新家族7日绝对寿命；旋转单次刷新、重用检测/事务撤销，HttpOnly/SameSite=Strict cookie。loopback HTTP例外只开发，真实TLS须Secure（本轮服务器只允许loopback HTTP，不提供TLS生产模式），精确Host/Origin/CSRF校验。adapter登出期间先阻止新调用，结束或失败均清本地认证缓存；服务失败保留失败结果，不声称已经服务撤销；无localStorage token/密码/key。影响：auth API与浏览器适配。可逆：TTL变更需契约版本/验收，不能无声放大旧会话。

## VERDICT-386 · b签名服务器时间【冻结】

裁定：fetchServerTime():Promise<number>保留逐字签名，仅从真实已认证服务、请求nonce/实例/keyId/clockGeneration的ES256(P1363)签名receipt校验后投影非负安全整数epochMs。可信公钥由安装配置/带外引导，不信任响应自带key；失败拒绝，不Date.now/performance.now/fixture回填。一次时间样本不授准入/结束RealityPause。影响：time API、pinning、时钟健康；b没有暂停/Claim实现。可逆：服务签名key轮换有独立信任更新，keyId不是证明。

## VERDICT-387 · 轻量账号/设备事实边界【冻结】

裁定：b用户API可读取自己账号/注册设备事实，以challenge持有证明注册凭据并在注册时写显示标签；登出撤销当前会话家族。本轮没有设备标签更新、凭据撤销/轮换或账号事实更新API，不能写device assurance、公钥世代、通关记录、FirstWorldCleared、CopyPermission、worldId/HomeDevice或世界payload。普通API严格字段白名单、身份从会话绑定，设备注册通过challenge与服务事务，不接受UI自报PhysicalDevice。AccountFacts.revision固定0，仅保留字段，不是世界revision或元数据CAS。影响：真实轻量读写，账号事实类型不替代既有milestone主链。可逆：未来服务允许事实生产必须另有证据，不从文件自赋值。

## VERDICT-388 · 新组合根保留旧主链【冻结】

裁定：RealServiceBuilder只装配新真实auth能力、受信配置/凭据/transport；production adapter不携fixture引用。原WorldFolderBuilder/SceneBuilder/B2.4会话与guard不改；b真实HTTP链以新组合根/adapter独立验证，尚不声称旧世界迁移或产品登录UI已经转真实。presentation仅IntentPort type-only窄边，纯director契约零cc/平台。影响：最小增量代码diff。可逆：以后有授权才接UI/真实权威主链，不在b偷扩。

## VERDICT-389 · b门禁与真实证据【冻结验收口径】

裁定：现有check:naming/check:dependencies/typecheck必须实测，保留既有WARN不放白名单；server独立typecheck/build/test与真实PG17+HTTP loopback正反例、重启持久、adapter验签/失败路径证据单列。测试须监听真实端口/访问真实DB，inject-only不当真实HTTP；用临时隔离测试账号/DB，不删除外部数据或输出秘密。输出新增文件全量diff与IntentPort纯追加diff、SHA保护/授权分类。影响：交付评审。可逆：可加实质失败覆盖，不能用fake或重复空测刷通过。

## VERDICT-390 · 延期项与不变式【冻结】

裁定：b不含Relay、完整FileCarry、个人静态加密迁移、平台OfflineGrace/PhysicalDevice/原生host、真实Release/Claim、AccessCode/ObserverSync产品机制。P3/P4/P5准备文档可并行；分别c/d/e前补冻。沿用INV-10/12/13、B2.3目录追加唯一本地发布点、持lease/无Web Locks拒绝、七项主key、RealityPause≥OfflineGrace、源主动排空与发起设备账号绑定、046账号个人层加密/共享可读；本轮不改核心以模拟这些能力。新架构冲突则具体PROTOCOL，不把环境安装、已授权接线或历史已闭合项重复当审批阻断。
