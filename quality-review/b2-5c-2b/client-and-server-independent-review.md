# B2.5c-2b 客户端实现与服务边界独立复审

日期：2026-10-11（Asia/Shanghai）。复审范围为新客户端 owner / adapter / 独立 Builder，以及只读检查新服务 session / clock / authority / route / storage / builder。服务源码由服务实施方维护；本复审未修改服务文件、旧模块、c-1 五模块或 docs。

## 客户端实现

`RealSharedServiceSessionAdapter` 独立持有注册 ES256 私钥与 CSRF，复用既有真实 b 认证协议，不提取旧 adapter 的私有字段。公开能力限既有认证接口、18 条固定路由、六种固定签名用途；不提供秘密 getter、任意 URL、domain 或 raw bytes 签名接口。服务根 pin 在构造时复制并验证 RFC7638 指纹；客户端保持精确同源与 loopback HTTP / HTTPS 边界。

HTTP unknown 回复经注入的纯 codec 严格解析，再验证服务 wrapper 及所有嵌套 authority receipts 的域、实例、pin、P1363 签名。流读取受 1MiB 限额；请求逐路由限额，最多两次网络异常重传且复用原 nonce / 原字节。nonce 缓存只保留 actor / operation / 不可逆 payload 摘要与首次签名 authorization，不保留码、密码或完整 body。相同 nonce 异输入拒绝；相同输入重构同一 canonical wire，避免 ECDSA 随机签名改变请求摘要。

logout 立即取消本地准入与签名，独立尝试真实会话家族撤销。迟到 verify / 请求不能恢复已撤销 context；logout 期间新认证调用拒绝。HTTP401 使公开 context 与签名能力失效，只保留私有 refresh 绑定供真实服务器重新核验，不以缓存 context 证明会话有效。

`RealWorldAuthorityAdapter` 覆盖十五种增量方法及原 account-facts 方法。类型化输入和未知返回仍经过严格 codec；包含当前 nonce 的根 / membership / proof / claim 输入按该 nonce 调用，不覆盖 nested 历史 receipt nonce。`SharedRelayPrototypeBuilder` 注入纯 codec 与新 presentation adapters，独立返回 auth / session / signer / authority，不接产品主链或 Relay。

## 服务复审与修正核对

复审识别并由服务实施方修正了以下实现缺陷，未放宽冻结 guard：

| 项目 | 修正后的行为 |
|---|---|
| Observer redeem 世界定位 | 从已严格解析的 challengeReceipt.payload.worldId 提取 world，真实普通 Observer 可准入 |
| 旧 guard 到新 wire 的映射 | child handler 保持 Host / Origin / Content-Type / 限流拒绝语义，产生精确 shared fault；旧 guard 不改 |
| 错误 nonce 提取 | 只从严格解析的 canonical 请求提取，无法安全解析时为 null；不以普通 JSON.parse 接受重复键 |
| Observer challenge 配额 | 按 account / world 的10次每分钟，换逻辑设备不能绕过 |
| AccessCode 来源 IP 失败预算 | 跨 world 的持久 IP hash 预算，真实后端 peer 来源，不信任 XFF；重启与改码不清计数 |
| membership 跨账号快照 | 目标 account / device 稳定排序上锁，先于 family / token / clock / world；Active / generation / 准入事实事务内核对 |

实时 session 核验与 b 同 PG，遵循账号 disabled、设备 Active、世代、Access expiry / used、family revoked / absolute expiry、CSRF。新 clock 生产入口读取真实 wall / monotonic，低于 durable floor、回退或偏离大于2000ms latch 失信；不制造未来时间。新事实与原 canonical receipt / nonce 原结果同事务，COMMIT 成功后输出。账号序号和 identity 不加 world / device 维度；admission 的旧摘要事实优先复取，seal 串行检查 cutoff≤S-H 和整个 admitted 前缀，不回填已封边。

本次复审未留下需要重开 P7/P8/P9 或改变 c-2a 冻结的架构冲突。

## 独立证据与限制

| 证据 | 结果 | 证据性质 |
|---|---:|---|
| client-contract-tests.cjs | 18/18 PASS | ContractOracle；独立 Node ES256 oracle，固定域、nonce、canonical / 篡改 / 限额 / logout / refresh；不是 HTTP / PG 验收 |
| client-real-http.cjs | 11/11 PASS | 同独立生产 Builder / session / adapter，经真实 HTTP / Fastify / PG17 / 生产真实 clock；十五增量方法加旧 account-facts 共16种 |
| evidence/client-real-http-run/verified | 独立重复执行 PASS | 证据采集方保存 raw log、command、源码 SHA 与公开结果 |

真实客户端验收使用新本机开发世界的显式公开 pin 元组与内存根，不代表既有运营世界已注册。普通 Observer 由实际六位码准入；ECDH challenge 的 GCM 解封、HMAC possession 和注册 ES256 proof 均真实执行。该证明使用独立 Node 密码学 oracle，不宣称 c-2d 平台群 key 交付 provider 已完成。

authority 只接收签名 claim 和摘要，客户端验收的 admission 为 **digest-only 轻量事实**，不声称已实现加密提交 producer / Relay。生产真实 clock 仅验空 seal；没有实际等待 H 的非空历史生产结算。root + Observer 是本轮准入与权限所需独立认证上下文，未执行 c-2e 的双端 submit / pull / durable ACK / replay 链。Relay、群 key package / acceptance、产品 UI、LAN / PhysicalDevice / P4 均留后续阶段。
