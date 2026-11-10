# B2.5c-2c 裁定增量 · VERDICT-448～451

日期：2026-10-11。依据 c-2c 本轮正式实施授权、VERDICT-438、已批准 P10/P11 和当前实施证据。448/449 的原单份文件保持历史时态，本文件汇总恢复后的最终适用范围；不重审 P7/P8/P9 或 c-2a 十二项，不扩大后续实施授权。

## VERDICT-448 · P10 的已批准最小例外

用户明确回复：“批准 P10 最小局部修正，继续 c-2c”。只在 RealSharedServiceSessionAdapter.request() 内，strict codec 通过后对 /relay/pull 使用 maximumWaitMs+7000，wait 仍为 0..25000、deadline 7000..32000ms；其余 shared 请求和 auth call 保持 12000ms。guard/session/signing/nonce/schema 不变。仅增加局部 requestLimitMs 与三处截止用途，原其余字节保全。

最终验真：实际 owner 的 deadline 契约 13/13；真实客户端 13000ms long poll 成功；真实服务器默认 25000ms long poll 成功。这个例外不改变 B、seal、OfflineGrant 或其他旧 c-2b 文件。

## VERDICT-449 · P11 的已批准 pull 例外

用户明确回复：“批准 P11 引用重建与边界 Gap 例外，继续 c-2c”。只对 pull 的请求结果保存轻量原签名 wrapper、queue 引用及原 wire SHA；不保存 envelope/public proof 副本。同 nonce 每次先检查当前真实会话/成员、generation/floor/expiry/缺载；保留期内从唯一 queue 重建原 Batch 并校验逐字原 wire SHA/服务签名，边界变化返回当前签名 Gap，撤员明确拒绝。

永久 nonce/hash 与异请求 Conflict 保持，普通 authority/submit/ACK 轻量原结果至少七日的规则不变。不能复制/延长 queue 密文寿命，不修改 001/002、旧 authority/PG 事务或扩展 payload API。真实 PG 42 条 pull 请求记录无 ciphertext/proof 副本；隔离 clock 覆盖到期、丢段、撤员与旧 nonce 重取。

## VERDICT-450 · 实施命名与独立装配归属

沿 v3.19 正式落实 RelayStorage、RelayService、RelayRoute/relayRoutes、RealCommitRelayAdapter；新增服务器公开行类型 RelayStoredStream/RelayStoredCommit，以及独立函数 buildRelayServer/buildIsolatedRelayServer，限域冻结于其源码模块。服务器只初始化一份真实 clock，隔离注入入口明确分离，旧入口及 builder 保持。

IntentPort 仅追加一条 export type，引用 SharedCommitValidator、ValidatedSharedCommit、SharedValidationResult 三个既有 c-1 声明；不重复定义、不引入 runtime director 依赖。v3.21 按 A/B/C/D 提案给 Trae 落盘，GPT 不修改 docs。公开声明统计统一为 c-2c 增量 5 份实施 TS/8 名，c-2b+c-2c 累计 22 份/72 名；37 仅协议公开类型，重导出/生成副本不重复计。

两份 .shared-kernel 分别是中间编译产物与有意运行布局副本，不是两套实现或性能缓存；v3.21 提案含逐字落盘段落。既有 kernel 输入与两目录旧字节保持。

## VERDICT-451 · 范围内实施交付与验收边界

c-2c 范围内实施/验证完成，提交 PROTOCOL 审阅：最终三门禁 PASS，server 独立 build/noEmit PASS；最终 server 真实 HTTP/PG 完整套件 20、首次入队并发补测 2、旧 generation retention 补测 2；最终实际 Relay adapter HTTP/PG 22。adapter 契约 32、P10 契约 13 与分类历史回归 508 保留修复前通过证据，相关旧核心/adapter 未再修改。真实 PG 原字节/位置/ACK、未 enqueue 缺载、并发/冲突、断网/timeout/重启、到期 Gap、不因全 ACK 提前删除逐项对应 delivery-report。

保留期采用事务惰性清理与永久轻量证据，不声称物理介质即时擦除。最终修复新 RelayStorage 的清理范围，覆盖同 world 全部 generation 的到期载荷，当前 floor 仍独立计算；该内部修复兑现原冻结，不形成新架构例外或旧核心变化。加速 retention/丢段/撤权 clock 是显式隔离测试，不声称生产等待 24 小时；native crypto oracle/WAL cache 注入不声称 c-2d/e 生产机制完成。完整生产 key/producer、双客户端 replay/coverage、LAN TLS、产品主链均延期。

保护审计只准两个既有变化（P10 和 type-only suffix）与五新增 TS/四新增 JS，unauthorized 全空；原始暂停/FAIL、wrapper 误计数与临时旧缓存重编后恢复等过程事实明列，未回写历史。当前无新待回复阻塞 PROTOCOL，最终阶段验收仍由 PROTOCOL 审阅完成。
