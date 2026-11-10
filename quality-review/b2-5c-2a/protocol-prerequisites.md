# B2.5c-2a · 新接入前置 PROTOCOL

日期：2026-10-11（Asia/Shanghai）。状态：已收到用户本次三项正式裁定，P7/P8/P9闭合，恢复文档冻结工作；不实现任何机制、不修改旧源码。触发规则来自本轮用户约束：“若发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL”。既有三门禁健康并不证明下面的接入能力存在。

## P7 · 真实会话与注册签名能力缺少可组合入口

证据：RealWorldAuthorityPort 当前只有 context/readAccountFacts；RealCommitRelayPort 只有泛型 relay。RealAuthServiceAdapter 内的 credentials/privateKey、csrfToken、context 均 private，公开 RealAuthServicePort 不提供 shared HTTP 或作者签名 capability。服务器 family()/now()/clockGeneration 也在 buildApp 的私有闭包内。新 adapter 不能取私有字段、复用未注册 key、自报设备或改旧封装。

推荐裁定：保留全部旧签名与源码；批准后续新增 RealSharedServiceSessionAdapter（presentation，独立会话/内存注册签名凭据 owner，复用 b 的真实认证 HTTP 协议与 PG 会话），对 director 只提供类型化 SharedServiceSessionPort / RegisteredAuthorSigningPort 的窄能力。私钥、cookie、CSRF 不暴露为字段；session更新/注销令共享准入能力失效。新 server shared plugin 从同PG按b既有规则核验会话/CSRF，使用独立 SharedSessionVerifier，不能读闭包或绕过真实认证。新 owner 不是 fixture、长期根或物理设备。

保留旧 RealWorldAuthorityPort，通过新增 RealWorldAuthorityProtocolPort 组合继承；新 RealCommitRelayProtocolPort 组合继承旧泛型端口。relay 作为 submit 的兼容同语义别名。server clock另设受信shared状态握手，不把b的clock generation自动当成新权威generation。

## P8 · 局域网与既有精确loopback部署的接入边界

证据：environmentConfig 强制127.0.0.1 HTTP；buildApp严格校验config.origin的Host/Origin、trustProxy=false、cookie secure=false。P3已规定在线网络TLS，HTTP仅精确loopback例外。直接把host改0.0.0.0、宽化Origin、裸LAN HTTP都违反旧边界；没有现有HTTPS部署能力可直接复用。

推荐裁定：loopback为必测基线；LAN同源HTTPS为c-2f独立验收条件。未来新增server/src/SharedTlsEdge.ts和独立启动配置，不改b后端源码。TLS edge先校验唯一批准公共Host/Origin/TLS证书、拒绝客户端代理头，再把获准请求转给同机127.0.0.1后端的精确内网Host/Origin；该转换必须作为显式受信网关边界获得批准，不能偷偷冒用Origin绕guard。edge强制所有session设置/清除cookie的Secure/HttpOnly/SameSite=Strict、禁止跨源/重定向缓存；只向本机公开backend，PG不监听LAN。代理连接来源IP仅由edge验证后用于限流；客户端传入X-Forwarded-For一律不信。

TLS证书/局域网固定地址/每客户端信任根安装需要操作者参与。没有受信证书或缺实机LAN客户端时只产loopback证据，LAN状态保持未验收，不“接受证书警告”或退回HTTP。

## P9 · 普通成员准入与“排除AccessCode产品入口”的精确含义

证据：P3 WorldMemberCredential 对非WorldDeveloper要求真实WorldObserverAdmissionFact，正确六位AccessCode自动产生该事实；b没有世界观察者准入API。不能用管理员seed或fixture签发普通成员事实当真实准入；只完成key包结构/解密也不授成员资格。

推荐裁定：c-2允许最小协议级AccessCode challenge/redeem及开发者set-code路由，仅从独立组合根显式调用，没有首次加入UI、产品入口、自动观察会话或ObserverSync。正确码自动准入、不增加人工审批；群key交付独立，包不经Auth/Relay上传。初始根与受审Genesis/manifest通过显式带外安装配置建立，不从文件自举pin。

若排除项也禁止协议级AccessCode，应将c-2真实验收收窄为同WorldDeveloper账号的两个注册设备，仅初始epoch/设备凭据变化，普通Observer/CoDeveloper入群、MemberAdded/MemberRemoved、码限流保持未实施。不能一面宣称全成员方法完成，一面用test seed替代准入。

## 建议的一次闭合选择

上述都是本轮冻结后未来实施的边界，当前不写源码、不运行真实服务、不修改旧guard。本次问题组ID为 request_user_input_async / call_79a1b1a53236479c9fa94dcc0bd70c69，用户逐字回复：

| 项目 | 用户本次正式回复 | 结果 |
|---|---|---|
| P7（item 0） | 采纳：新增独立会话 owner，保留旧源码 | 闭合：后续新增窄能力与新会话adapter，旧源码不改 |
| P8（item 1） | 采纳：loopback 基线 + 受信 LAN TLS edge | 闭合：LAN TLS edge是显式受信边界，不是放宽旧guard |
| P9（item 2） | 允许最小协议，无产品入口/UI | 闭合：最小真实code协议纳入，产品入口/ObserverSync排除 |

据此继续完成VERDICT-426～440及v3.19附录。该回复授权本轮冻结相应边界，不是本轮实施代码或后续全部c-2b～f自动开工授权。
