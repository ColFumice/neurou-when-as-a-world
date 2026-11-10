# B2.5c-2b～f 子阶段与入场前置

日期：2026-10-11。依据VERDICT-426～440；仅冻结后续计划，**本轮不实现，也不将方案冻结当作实现授权/验收**。P7/P8/P9已正式闭合，精确回复保留在protocol-prerequisites.md。

## 子阶段拆分

| 阶段 | 实施范围 | 入场前置 | 完成证据 |
|---|---|---|---|
| c-2b · 协议/真实会话/轻量authority | 新type-only协议、独立session owner/signing、SharedSessionVerifier、真实clock/status、002/PG事务、world/root注册、code协议、ECDH公共绑定、epoch/段/permit/admission/seal、RealWorldAuthorityAdapter | 本冻结包审阅落盘；b健康；操作员world/service/root/Genesis/manifest公开pin配置；独立内存publisher持根；明确当轮实施授权。不以fixture替代普通Observer事实 | 真实loopback+PG端口方法证据；六位码真实自动准入、session/CSRF/nonce/签名/rollback拒绝；并发号段及原receipt幂等；clock/seal隔离注入与真实clock证据分列；b旧路由回归 |
| c-2c · 真实Relay | RelayService/Storage/Route、RealCommitRelayAdapter、submit/relay/pull/ACK、缺载/retention/generation持久规则 | c-2b真实admission/epoch/session/clock已验；严格wire和authority独立职责可检验；当轮授权 | 真实PG原字节/位置/ACK事务，admitted未enqueue→Gap、并发重复/冲突、断网/timeout/重启、到期Gap，不把全部ACK当提前删除条件 |
| c-2d · 最小真实key/producer | WorldRelayKeyDelivery、SharedCryptoAdapter和窄ports、SharedCommitSealingPort、真实ECDH/HKDF/GCM/HMAC/ES256、内存包桥与publisher acceptance | c-2b真实Observer/ECDH challenge/epoch/注册签名能力；根/pins及内存secret隔离；当轮授权。可在c-2b后与c-2c并行，不能提前宣称Relay闭环 | key文档K01～K15；独立Node crypto oracle/公开向量；实解32-byte key、AEAD/context/root篡改拒绝、跨包/target/epoch/nonce重放拒绝；无key包/秘密落库/log |
| c-2e · 独立组合根与loopback双客户端 | SharedRelayPrototype/Builder、独立cipher缓存、同一组合根调用的两个真实隔离principal/cookiejar/device/ECDH、生产commit→admit→submit→pull→validate→耐久回读→ACK→确定性replay | c-2b/c/d分别验收；受审本地Genesis/manifest原文与pin相符；独立耐久backend与隔离目录；当轮授权 | root+真实codeObserver、同账号多设备号段、三类变化/历史权限/成员撤销/rekey、两端同输入同state/coverage、缺key/源不ACK、不推进checkpoint、logout失效、PG与客户端重启/丢响应幂等；产品主链无引用 |
| c-2f · LAN HTTPS/安全与总验收 | 新SharedTlsEdge、独立shared启动、受信同源LAN双设备、网络/secret边界回归、全部交付索引 | c-2e完成；操作员真实LAN origin/SAN证书/CA trust安装；至少两台可控客户端且允许防火墙该端口；PG/backend只loopback；当轮授权 | 正常受信HTTPS真实设备 submit/pull/ACK；坏证书/Host/Origin/代理头/CSRF/HTTP降级拒绝；cookie设置与清除Secure；b guard/三旧门禁回归、泄露审计；LAN没实测不得称c-2f完成 |

每阶段保持旧模块、产品Builder/UI/服务器旧Auth逻辑不改的增量方式；若必须动冻结旧核心，先PROTOCOL。各阶段代码/HTTP/canonical契约测试按当轮变化运行；本轮不会预先执行这些计划。c-3是否以及何时接产品主链另行裁定，不能用c-2b～f授权推导产品接线。

## 操作员参与与可执行部署

loopback方案继续使用本机Node24/Fastify5/PG17，后端127.0.0.1:43125默认。新增shared启动按002 checksum迁移、载入公开批准world/root配置、复用旧auth实例、注册shared插件；生产入口使用真实clock，不接受fixture时间。无需云账号，不部署云服务。

LAN默认edge端口43126；公共HTTPS origin必须显式配置唯一固定host/IP+port、SAN匹配，禁止通配或自发现TOFU。edge监听操作员批准的LAN地址，固定转发127.0.0.1:43125。通过本地CA/合法证书提供TLS，每台客户端安装信任并核对完整指纹，页面与/api同源。操作员配置LAN地址、证书/CA、信任安装和防火墙；PG端口与后端不对LAN开放，不通过“忽略证书警告”完成验收。证书私key按TLS部署边界保护，不与publisher/root/groupkey混用。

世界根生成/公开pin安装需操作员确认world/account/map/root/Genesis/manifest元组。当前publisher根只在解锁内存中，重启丢失时返回KeyPublisherUnavailable；只用受批准独立原型世界，不迁移既有世界根。公钥配置/receipt/摘要可作为证据；私key、密码、code、CSRF、群key、完整key包不得落交付目录或日志。

## 已闭合 PROTOCOL

| 项目 | 用户本次裁定 | 后续落实 |
|---|---|---|
| P7 | 采纳：新增独立会话 owner，保留旧源码 | 新owner/窄能力、同b真实auth/session；不用私有字段提取 |
| P8 | 采纳：loopback 基线 + 受信 LAN TLS edge | old guard不改，公共边界先严格验证再固定翻译；LAN必须证书信任 |
| P9 | 允许最小协议，无产品入口/UI | 最小set-code/challenge/redeem；普通Observer真实code准入，独立key交接 |

不存在待回复P7～P9，不重复询问。所列部署资源是后续实配条件，不能当本轮已有能力。

## 遗留与待裁定

| 项目 | 状态 / 对当前c-2的影响 |
|---|---|
| root/群key/ECDH长期保护与恢复，历史key bootstrap | 留P4；c-2只内存能力，reload缺key=Gap，不声称Complete/Restored |
| 外来checkpoint来源/完整FileCarry/个人媒体/异步加密迁移 | 留P4，Relay不提供checkpoint；不借cipher缓存暗做P4 |
| 原生trustedhost/TPM/attestation/清安装/OS重装/PhysicalDevice/OfflineGrant | 留P5；Web仅RegisteredCredential、未知平台无OfflineGrant，无应用运行时长降级 |
| 真实开发者账号closure/注销生产者 | c-2恒null且不造旧b API；后续另冻，不影响当前online原型但不宣称真实注销链 |
| root转让/既有内容根迁移/旧身份迁移/非Primary生产迁移/WorldRegistry位置 | 排除，新增要求先裁定 |
| 自动P2P群key传输/长期publisher | 候选，不部署；explicit内存/操作员带外输入单独标证据，不伪称网络自动分发 |
| 有限B条件与单实例吞吐 | B=300000为条件假设，任意故障超界停止checkpoint；b240/min/backendIP原闸仍在，无规模SLA |
| 本地精确coverage长期空间上界 | v1保留每identity摘要，不以压缩/环形cache丢精确拒绝或去重；后续格式版本 |
| 操作员LAN/证书/双设备与公开world pins | 实施入场资源，尚未实配/实测；不要求云账号；不足时报告未验收 |
| 产品主链接线/ObserverSync UI/加入UI/编辑器 | 后续另行产品阶段，不从独立prototype自动进入 |

本轮未发现需要推翻P3/c-1的未决新冲突。若未来server plugin不能在保留旧边界下安全接入、secret持久化或其他范围发生变化，执行用户要求先停止并提交新PROTOCOL。
