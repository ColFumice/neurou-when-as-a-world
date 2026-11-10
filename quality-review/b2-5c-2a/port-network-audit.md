# B2.5c-2a 端口、会话与网络只读审计

日期：2026-10-11（Asia/Shanghai）。本审计只读现有生产文件和已冻结 P3/c-1 交接；没有实施端口、路由、客户端接线或服务器配置。下列内容为 ARCHITECT 的冻结输入，不自行扩充旧契约。

## 已验证的当前事实

| 当前文件 | 已有事实 | c-2 不可假定已有的能力 |
|---|---|---|
| src/director/RealServiceContracts.ts | RealWorldAuthorityPort 只有 mode/context/readAccountFacts；RealCommitRelayPort 为泛型 mode/relay | 没有序号段、permit、admission、seal、member、submit/pull/ACK 方法 |
| src/presentation/RealAuthServiceAdapter.ts | 精确同源 HTTP/HTTPS 请求；设备 ES256 私钥、context、csrfToken 均为 private；key 只在内存 | 公共 RealAuthServicePort 没有作者签名、CSRF 共享、目标 ECDH key 注册能力 |
| assets/scripts/RealServiceBuilder.ts | 独立 buildRealAuthService；不接产品主链 | 没有 SharedRelayPrototype 或群 key publisher |
| server/src/config.ts | host=127.0.0.1；只接受 exact HTTP loopback origin | 不能直接改成 LAN HTTP 绑定，不能把 HTTPS 公共 Origin 直接送给现有后端 guard |
| server/src/app.ts | Host/Origin 精确匹配、trustProxy=false；全局 bodyLimit=16384；cookie HttpOnly/SameSite=Strict/secure=false；无 CORS 放行 | family/CSRF/clockGeneration/now 为 buildApp 私有闭包；不能由新 plugin 假定可访问 |
| server/migrations/001.sql | accounts/devices/auth_families/auth_tokens；device 只有 ES256 key；service_clock_generation | 没有 world/ECDH credentials/seq/permit/admission/seal/relay 表；不存在注销业务事实生产器 |

## 端口与客户端建议

1. 保留旧 RealWorldAuthorityPort 与 RealCommitRelayPort 定义和既有 IntentPort 导出；旧同步 archive 端口不动。新增独立 director 协议契约文件，由具体 authority adapter 同时实现旧只读能力与新协议能力。新增 required 方法不原位加到旧接口上，避免破坏既有消费者或冒称已有实施。
2. RealCommitRelayProtocolPort 正式化 submit/pull/acknowledge；RealCommitRelayAdapter 可额外实现 RealCommitRelayPort<AdmittedWorldCommit, 新正式 submit reply>，relay 与 submit 进入同一个幂等传输路径，不另造弱校验路径。pull/ACK 不是 relay 泛型返回值的隐式扩展。
3. RealWorldAuthorityAdapter / RealCommitRelayAdapter 归 src/presentation；纯请求/响应/编排契约归 src/director；独立 composition 归 assets/scripts。纯逻辑模块仍不导入 fetch/DOM/cc/Node；presentation 从 IntentPort 读取 type-only 协议，assets 组合两边，不由 director 反向导入适配器。
4. 原 RealAuthServiceAdapter 不能通过其 public AuthPort 提供签名和 CSRF。需在本轮正式决定一个增量的 presentation 会话/注册凭据 owner，使独立 prototype 的认证、作者签名、acceptance 签名来自同一真实注册设备；该 owner 实施既有 RealAuthServicePort，但不修改旧 adapter、不读取 private、不导出 raw 私钥/密码/cookie/CSRF 到 director。若不批准此新增能力，则作者签名与 key possession 无实际来源，c-2b 入场不得声称前置闭合。
5. ECDH key 独立生成并以注册 ES256 凭据对服务一次 challenge 签名，再由服务将账号/设备/世代/world/key 绑定为轻量成员事实。不得把 b 签名 key 直接当 ECDH key，不能以 WorldMemberCredential 文件自述完成注册。

## 同实例、认证和故障边界

建议同一 server/ Fastify 实例、同一 PostgreSQL 17、同一 serviceInstanceId 与服务签名根、同一浏览器 session cookie。authority/relay 使用同账号/设备/session/CSRF 事实，但必须每次从实际会话校验而非只接受旧 readonly context；logout/revocation/refresh 对三者一致生效。Relay 独立不可用时 Auth 和轻量 admission 仍须可用，不把 HTTP relay 队列故障绑成 Auth failure。

新增 shared routes 必须明确获得新 session verifier 能力。现有 buildApp 内的 family 不可直接复用；新增 verifier 可读同 auth 表并逐条遵循现有 Access token、used、绝对/Access expiry、账号 disabled、device Active、generation、CSRF 检查及 account→device→family→token 锁序，不修改旧认证 guard。新的服务时钟也不能直接使用闭包内的 clockGeneration：c-2 实施前需绑定精确 clock producer、generation 发布来源与失信 latch，不以 b readServerTime 的 generation 默认为另一个新 clock 的 generation。

## 本机与局域网

冻结建议：HTTP 例外仅为 127.0.0.1/::1 的开发链；局域网浏览器只能使用已受信 HTTPS，页面与 /api 同一 exact origin，cookie Secure/HttpOnly/SameSite=Strict，禁 CORS wildcard、redirect 降级或明文 LAN。TLS 不能由开发者签名 pin 替代：pin 验签不保护密码、cookie、CSRF 和 AccessCode 在传输中的泄露。

若要保留 b config/app 原字节，可新增受信 TLS edge：后端仍绑定 127.0.0.1；edge 先核验公共 Host/Origin 再向固定 loopback upstream 转发，并只对通过检查的请求生成 backend Host/Origin、对既有会话 Set-Cookie 强制 Secure。edge 必须拒绝缺失/异源 Origin、外部传入的伪代理头及非预期 upstream；来源 IP 限流由 edge 承担，后端 trustProxy 仍为 false。此 edge 是明确新增受信边界，不能仅透传任意请求后重写 Origin，也不能借其宽化旧 guard。若选择直接 Fastify TLS，则修改 b shared bootstrap/transport profile 的精确允许范围必须先由本轮明确，不可称为已有 b 能力。

两客户端网络证据包含隔离 cookie jar/注册 device key；LAN HTTPS 证书须由操作者安装 CA/信任证书并匹配 SAN。自行关闭证书验证不算 HTTPS 验收。localhost 以外的 LAN HTTP 不能通过 browser secure-context gate；原 adapter 已拒绝该形态。

## HTTP wire 实施入场

建议 ARCHITECT 指定路径、精确 body/reply、HTTP status 和错误 code；不允许 implementation 自由猜测 P3 未冻结部分。统一 nonce、幂等 scope、同 requestId 异摘要冲突规则，失败重放与成功重取语义按 P3；不能给 source-valid admission receipt 宣称正文已合法。

| 事项 | 必须落实的边界 |
|---|---|
| 请求 | exact JSON schema、canonical bytes、Content-Type application/json、零额外字段、同源 POST、32-byte requestNonce、12 秒 client 请求上限按长轮询另设 |
| CSRF | 同会话 cookie + X-CSRF-Token；未认证/失效不得以 worldId/公钥代替；加入码只在 body |
| 限流 | 原 Auth 30/240 每分钟不可偷偷变；新增 authority/member/relay quotas 与来源 IP 信任明确分开 |
| AccessCode | P3 候选 5 次失败/账号-world/15 分钟、20 次/IP/15 分钟、100 次/world/小时及 30 秒一次 challenge，若实施成员准入应正式定版；不因不提供产品 UI 而跳过协议的码/成员规则 |
| bodyLimit | 原 b 16384 不足以容纳合法 64KiB envelope 的 base64 与 proof；仅新增路由指定足够且有界的 limit，不能全局提高旧 Auth limit |
| pull | P3 每批≤256、canonical response≤1MiB、单 envelope≤64KiB、wait=0..25000ms；不能把 12000ms b Auth timeout 直接用于25秒 pull |
| ACK | cursor 是收件顺序；仅本地完整验真并耐久后声明；server 不声称已验证真实磁盘；ACK 不允许提前突破 retention≥H 删除 |
| 缺载 | admission 可存在而 queue 无 envelope；pull 必须显式 MissingAdmittedEnvelope Gap，不把空 batch 伪装完整 |

## 必须精确冻结而不能由实现补猜的前置

- world 注册与 Genesis/manifest 摘要及开发者 root/account 的正式绑定生产者；authority 不保存完整 Genesis/state/checkpoint。
- 根 pin 由开发者实际控制的带外介质安装，包含完整 anchor 和显式 fingerprint 对比，不从 server /keys 或 key package 首次自动信任；未知 pin 返回 Pending/拒绝，禁止 TOFU。
- publisher 私钥保管和最小 key package 用户带外入口。publisher 在服务外持群 key，服务不能保存包或验证 HMAC possession；服务只可保存 publisher 签名确认后的摘要/轻量 delivery fact。
- publisher 不在线、新成员无 ECDH possession、旧 epoch/revoked device、错误根/包/nonce/acceptance 均有精确拒绝/Pending，不把已授 Observer fact 撤回。
- shared authority clock 与 b clock 的 generation/source 接线；生产禁 fixture、禁 HTTP 调时参数、禁 backfill AppendedAt/seal/epoch/closure。
- 服务重启后通过 PostgreSQL 持久 high-water/已封边边界阻止回填；clock rollback latch 必須拒绝新的 permit/admission/seal，已有同摘要 accepted 重取保持原 receipt。
- PostgreSQL 增量 migration runner/ledger 与新表事务：旧 db.migrate 只执行001.sql，不能假定会自动应用002。新迁移不改001，不恢复 archive，不新增清理 auth 事实的级联操作。
- b 没有开发者账号注销生产 API；c-2 不能把 null closure 改为客户端自报事实。若需新真实生产器，必须明确授权其最小含义与不可回填入口。

这些属于本次12项裁定的必要实施输入。根/会话/clock/deploy/publisher 的确切方案冻结并形成 c-2b 入场检查之前，不实施对应机制；也不把已知未建能力报告成新真实服务测试已通过。
