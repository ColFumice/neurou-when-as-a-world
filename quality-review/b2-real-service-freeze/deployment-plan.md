# B2.5 真实服务部署提案

2026-10-11（Asia/Shanghai）。本轮仅提出后续可执行方案，**没有创建服务器代码/Compose、拉镜像、开端口、注册账号或启动部署**。P1/P2/P3/P5 未闭合，以下命令路径是未来阶段交付要求，不是现有可运行文件。

## 部署选择

采用“服务器端代码 + 本地真实HTTP服务”，同一代码可原生或容器运行，不做两个不同语义的实现。开发用loopback HTTP；两台真实设备访问用局域网HTTPS。云自建只是同一包的可选发布目标，无第三方OAuth/托管认证/云数据库依赖。

| 部署档 | 目的 | 地址/可信边界 | 可验收范围 |
|---|---|---|---|
| 本机原生开发 | 最小真实Auth/时间/DB/Relay网络失败验证 | 127.0.0.1，仅loopback HTTP；同origin代理客户端 | 真实独立服务协议，不是物理双设备/TLS验收 |
| 本机Compose | 同代码可复制运行、DB重启/事务恢复 | app+PostgreSQL独立持久volume；外部只代理端口 | b/c服务壳、真实网络/故障/重启 |
| 局域网双设备 | f真实网络/设备/文件携带与真实时间验收 | Caddy HTTPS+固定DNS主机名，双方信任内部CA；固定RP ID | 达到平台保证的两物理设备链路 |
| 自托管公网（可选） | 外部访问部署 | 域名、公网TLS/443、持久DB；不把DB暴露公网 | 部署运维；需另有用户提供基础资源 |

选型提案：Node.js24 LTS、Fastify5、PostgreSQL17、Caddy2。服务器目录server/是独立package/tsconfig，不属于Cocos的src树，不恢复archive/service/sync；版本在b按锁文件和镜像digest固定。服务器独立lint/typecheck/必要服务测试加入b/f门禁，现有三门禁不会扫描这个未来包。平台可信host若P5批准另独立platform-host/包，不伪装Cocos逻辑模块。

## 数据责任

Auth数据库可有account、password_hash、session_hash/refresh_family、device_public_key/generation/assurance、wrapped_account_key、轻量里程碑/通关事实、world_home、reality_pause/device_binding、migration_receipt/payload_digest、幂等记录。不能有Core、Ledger、截图/视频、FileCarry、WorldCheckpoint/SharedWorldState列或上传端点。wrappedkey不是世界备份，限制尺寸并独立日志脱敏。

Relay只存有限未送达WorldCommit外壳/密文、world_member/开发者资格、ACK/cursor、到期信息/幂等摘要；无正文解密key、无共享状态。数据库可以与Auth同实例，但角色/表权限与客户端端口分离；建议单服务进程两个路由域，避免起步增加微服务。数据库事务实现(homeRevision CAS、pause+binding+release幂等)原子性；本机目录仍是另一个域。

所有事务必须绑定认证account/device/serviceInstance，unique约束覆盖账号世界归属、请求幂等与作者序号；服务重启读回真实DB，不重建fixture“初始状态”。备份只含上述服务允许的轻量数据，密钥签名私钥放服务secret，不写镜像/源码/日志；密钥恢复与clockGeneration恢复须有运维审计。

## 后续实施顺序与运行入口

1. b先交付独立server源码、锁文件、env.example（仅占位）、schema migration、原生启动和Compose配置；配置包含serviceInstanceId、DB连接、cookie/CSRF origin、签名key路径、可信时钟策略。无默认生产密码或内置固定签名私钥。
2. 本机原生运行的约定入口为server包`npm ci`、`npm run db:migrate`、`npm run dev`；Compose约定为`docker compose --project-name neurou-b25 up --build -d`。这些脚本/配置本轮不存在，b必须实现并验证后才能贴成可运行命令。
3. 显式创建开发账号与注册设备，client配置ExternalService与固定本机origin。关闭fixture seed/clock advance，测试真实login/verify/logout/refresh/time、跨进程共享DB、故障不伪造receipt。密码不可作个人key恢复替代。
4. c在共享schema/成员权限补冻后实现POST提交、pull/ACK、持久cursor/TTL/限流；坏正文/错误签名/越权/重放/Gap真实测。Relay不能用上传检查点修补长期离线。
5. d/e按获准加密存储与平台方案接入客户端；局域网配置固定DNS（例neurou.test仅示例）、HTTPS内部CA及稳定WebAuthn RP ID。更改hostname会改变凭据域，不临时用两套IP绕过。
6. f双设备真实TLS/账号/设备注册与FileCarry手工携入；从真实主链生产世界，真实等待≥1小时，原生boot/sleep/重启与服务时钟异常、断服务/重连/Claim崩溃恢复，保持双档Creator与原有契约回归。进程/时钟快进仅故障测试单列，不能计真实一小时。
7. 交付部署revision/digest、DB migration版本、health/ready结果、允许表/日志审计、备份恢复记录、退出/重启步骤。回滚只对兼容schema切服务包，不能随便down -v或删DB/用户文件。

健康口分离liveness（进程）与readiness（DB、签名配置、时钟信任、迁移版本）；未ready返回AuthorityUnavailable/TimeUntrusted，不能返回假时间或fixture数据。请求有有界超时/重试退避，幂等写超时先查同requestId状态，不能换新ID重复Claim。日志只记录requestId、脱敏身份/错误码/延时，不记录密码、token、私钥、个人字段或提交正文。

## 需要用户参与的资源（本轮不申请）

| 资源 | 何时需要 | 用户参与 |
|---|---|---|
| 本机Node/PostgreSQL或Docker Desktop运行环境 | b实际部署 | 环境未具备时安装/许可与磁盘容量；无需云账号 |
| 局域网双真实设备、稳定DNS与可信HTTPS | f前 | 用户提供设备/网络；为两设备信任内部CA、允许指定LAN端口；不关整机防火墙 |
| 可信原生host/硬件身份与OS uptime | e前 | P5批准平台范围、测试硬件/凭据、必要attestation/安装权限；纯Web不可替代 |
| 离线账号恢复secret保存 | d账号key首建 | 用户本人安全保存；服务不代替保管明文secret |
| 公网主机/域名/云账号（可选） | 用户明确要公网时 | 用户申请并提供资源、TLS/DNS/预算；不是B2.5本地/局域网接入前置 |

“真实外部服务验收”至少是独立进程/持久DB/网络协议、两真实设备对同一服务，而非两个fixture窗口；不把“外部”自动解释为必须付费云。若产品要求公网实际上线，f需另行确认目标并有用户资源，局域网结果不能冒称公网发布。
