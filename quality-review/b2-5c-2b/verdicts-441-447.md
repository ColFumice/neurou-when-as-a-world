# B2.5c-2b 增量裁定 · VERDICT-441～447

日期：2026-10-11（Asia/Shanghai）。依据用户c-2b正式实施授权及c-2a已冻结边界。只裁定本轮实现归属与具体工程选择；不重开P7/P8/P9或12项，不改c-2a文书/名库。实现验收状态另见delivery-report.md。

## VERDICT-441 · c-2b实施边界与保护

正式实施共享authority与客户端独立认证/signing/wire能力，按stage c-2b入场。旧b入口/guard/001/runner/tsconfig/package、旧AuthAdapter/RealServiceContracts/RealServiceBuilder、c-1五模块、产品核心全部保全。IntentPort是唯一允许变化的旧源码，只增type-only suffix并保全原字节前缀。新source/测试/SQL/构建路径使用精确名单，不准整目录放宽。未授Relay/c-2d/e/f或产品接线。

## VERDICT-442 · SharedServiceProtocolCodec及type-only补名

正式实现名SharedServiceProtocolCodec，归director新纯模块。复用原SharedCanonicalBytes与SharedCommitCodec作为严格字节和P3 schema来源；不修改或复制另一份宽松核心。所有18操作请求/返回shape精确验证、签名输入仅6固定用途；验shape不自授签名、权限、clock或存储信任。

SharedProtocolPayloadMap/SharedProtocolValueMap/SharedProtocolReply、SharedProtocolCodecPort、SharedProtocolSignatureKind与SharedServiceStatusPayload作为冻结wire的type-only映射与注入能力正式命名；可选requestNonce仅端口内存调用参数，wire仍全required。presentation只type-import IntentPort，由新独立Builder注入纯codec。逻辑模块不读时间/存储，不导入cc/DOM/Node/网络。

## VERDICT-443 · 独立server构建与最新SQL路径

采用用户最新包指定server/sql/002_shared_authority.sql；此路径替代c-2a规划的server/migrations/002.sql，不改旧001或旧文书。新SharedMigrationRunner执行已校验001与002，并保留checksum/advisory lock/18表语义。

旧server tsconfig rootDir与Node ESM不能直接维护另一份schema或改配置。新增SharedBuild.mjs只读编译同一root纯源码为带声明的CJS kernel，生成server/.shared-kernel与server/shared-dist/.shared-kernel；新tsconfig.shared独立构建共享服务，保存input-hashes证明来源。旧b构建在生成依赖就绪后独立回归，旧源码与配置不改。

## VERDICT-444 · 同服务签名根的增量签发器

SharedReceiptSigner复用已授权b服务签名key material/pin，但采用冻结shared-transport/shared-authority域；不提取旧ReceiptSigner私有字段，不把服务key当开发者root。SharedCryptoProof只实现服务ECDH注册challenge：fresh secret32/ephemeral/salt32/nonce12、固定HKDF/AAD/HMAC，PG留public challenge/expectedTagSHA；不做群key package/producer。

新增SharedOperatorWorldPin/SharedSession/SharedServiceFailure/AuthorityClockSample/IsolatedClockSource/StoredWorld与有限辅助函数名归新server边界；精确名单见v3.20附录。server有Node/PG/clock能力，不能反向导入产品逻辑；RegisteredCredential不升级PhysicalDevice。

## VERDICT-445 · 原请求字节与历史receipt

ES256签名每次可能不同；同nonce逻辑调用必须复用首次完整canonical请求字节，不能重签后把它当同一个PG请求摘要。新session owner在同context下缓存operation/actor/不可逆payload摘要与首次设备authorization，合并同nonce并发；后续同摘要输入重构同一canonical字节，不在nonce缓存中保留code/password或完整body。异operation/payload/actor冲突，logout/换context失效。即时重传最多2次、无新nonce/fixture fallback。

authority原nonce重传返回原完整wrapper；新nonce复取只签AuthorityResult当前nonce包装，P3内层原receipt/签名/nonce不改。HTTP错误与原结果事务保存；临时网络/DB/clock/CSRF/格式/限流失败不伪终局。旧b错误通过新child handler映射成准确shared fault，不修改guard；严格canonical解码后明确的outer安全整数未知版本按冻结§6返回400/VersionUnsupported，缺字段/非整数仍SchemaInvalid，重复键/非规范字节优先CanonicalInvalid。会话logout是本轮验收范围，不新增账号closure生产者。

## VERDICT-446 · 限流、跨账号成员核验与clock事务

Observer challenge按(account,world)10/min；设备route-class限流另保持。AccessCode失败5/account-world/15分、20/真实后端peerIP/15分、100/world/小时；IP预算跨world保存，不能换world逃脱。本机peer来源不信任XFF；未来TLS edge另有获批准真实来源IP闸。持久轻量IP hash counter归authority_clock_state内部列，不新建第19表，不存code或凭据；重启/改码不清预算。

membership激活需要完整合法credential集合的账号/device Active事实。先取得session身份与合法目标集合，按稳定顺序锁所有账号、所有设备，再family/token、clock/world及共享facts；不得world之后反向拿其他auth锁。最终签发前核实事实，在同事务固定epoch/time。服务失信latch需持久，不用max(wall,floor+1)；隔离注入clock不接生产入口。admission拒绝优先级按P3：已accepted同摘要→来源→IdentityConflict→EpochClosed→PermitExpired→TimeTooLate→准入。

## VERDICT-447 · 本机开发验收与正式资源区别

资源未就绪时用户已授权先实施loopback本机开发基线。测试进程明确安装临时world/account/map/root/Genesis/manifest公开元组、内存root与独立真实注册凭据；普通Observer用真实code准入，无管理员seed。该证据授独立本机开发原型，不声称操作员正式world内容已注册，不提供长期root恢复。

真实wall/mono生产buildSharedServer HTTP/PG证据与隔离buildIsolatedSharedServer clock/seal证据分列。若没有实际等待H，注入非空seal测试只证算法/事务与不回填，不能报生产跨H结算。契约Oracle不计真实HTTP验收，历史154/227/b回归不替代本轮authority测试。后续Relay/key/双端/UI/LAN/P4/P5仍按已冻阶段推进。
