# B2.5c-2c 实施计划与完成对应

日期：2026-10-11。c-2c 已正式授权，P10/P11 均已批准并落实。当前状态：**计划范围实施及验证完成，交 PROTOCOL 审阅**。依据 b2-5c-2a/stages-and-open-items.md 的 c-2c 行与 VERDICT-438；原 P11 暂停版本保存在 evidence/implementation-plan-p11-paused.md，不回写原暂停审计及 raw FAIL。

| 顺序 | 文件 / 变化 | 冻结职责 | 完成证据 |
|---|---|---|---|
| 0 | RealSharedServiceSessionAdapter.ts；仅批准 P10 局部修改 | 合法 pull deadline=wait+7000，其他 shared/auth 12000 | deadline oracle 13/13；真实客户端 13 秒 pull 与真实服务器默认 25 秒等待 |
| 1 | server/src/RelayStorage.ts；新增 | queue 原字节/位置/receipt、ACK 同事务，retention tombstone/floor、generation | server 完整 20/20、首次入队并发 2/2、PG 只读 row/SHA/ACK 证明 |
| 2 | server/src/RelayService.ts；新增 | admitted 公共来源/签名、缺载、三种 Gap、ACK；批准 P11 引用重建 | server 缺载/到期/丢段/撤权/重建；42 pull 记录无 ciphertext/proof 副本 |
| 3 | server/src/RelayRoute.ts；新增 | strict wire、route bodyLimit、Host/Origin/CSRF 与限流；不改旧 guard | 真实 HTTP 拒绝、超过旧 16KiB submit、完整 response 上界及长轮询不持业务锁 |
| 3a | server/src/buildRelayServer.ts；新增 | 单 clock 新独立服务器装配；真实入口与显式隔离 clock 入口分列 | production-real-wall 与 isolated-injected-clock 测试分类；旧 buildSharedServer/shared-main 零差异 |
| 4 | src/presentation/RealCommitRelayAdapter.ts；新增 | ExternalService、relay=submit、pull、完整 validator→耐久回读→签 ACK | adapter 契约 32/32、实际 adapter HTTP/PG 22/22；缺 key/source/HostFailure 不 ACK |
| 4a | IntentPort.ts；仅 type-only suffix | 重导出三种既有 validator 类型，原前缀保全，director 零平台能力 | +199 字节、一条语句三名、emitted JS 相同、dependencies PASS |
| 5 | quality-review/b2-5c-2c/；新增测试/证据 | 契约 oracle、真实 HTTP/PG 与加速 clock 独立，历史套件新输出/DB | 45 契约、20+2 server、22 client、508 历史回归；实际命令/exit/log/SHA lineage |
| 6 | 本阶段报告、v3.21 提案、裁定增量、diff、审计 | A/B/C/D 名库、统一声明计数及 kernel 解释、诚实过程偏差 | delivery-report.md、verdicts-448-451.md、protected-final-audit.json 与 evidence 索引 |

先运行新增能力的对应契约/事务测试，再做依赖项和真实 HTTP；源码稳定后门禁及 server build/noEmit 已通过。独立只读最终复审无阻塞发现。各阶段检查的执行时态及原 FAIL 留在日志；最终成绩不能从“源码存在”推导。

源文件共 5 新增、2 修改；生成运行 JS 4 新增。其余旧源码、001/002、产品 Builder/UI、c-1 五模块、docs/名库/参照最终 SHA 保持。P10 之外不改变 c-2b；P11 只改变新 Relay 的 pull 请求记忆和复取边界，不改旧 schema/事务。

独立 server builder 可被 harness 直接调用；不先调用持有私有 clock 的旧 builder 再初始化另一 clock。客户端通过既有窄 session/signing/codec/cache 能力和 IntentPort 的 type-only validator 引用组装；生产 key/producer、完整双客户端组合及 LAN TLS 留 c-2d/e/f。

统一命名口径：c-2b 17 份新增实施 TS、64 个公开顶层声明（协议类型 37）；c-2c 5 份、8 名；累计 22 份、72 名。IntentPort 重导出、字段、方法、局部绑定、harness 与生成副本不算新增公开声明。两份 kernel 是中间编译目录与有意运行布局复制，本轮既有字节不变；精确解释交 v3.21 提案逐字落盘。

本轮实施不授权 c-2d/e/f 或 c-3；下一阶段仍按已冻结入场资源与用户正式授权执行。最终测试与保护证据均由 delivery-report 对应，PROTOCOL 审阅尚待进行。
