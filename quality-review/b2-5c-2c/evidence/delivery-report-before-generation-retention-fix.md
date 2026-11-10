# B2.5c-2c 实施交付报告

日期：2026-10-11。状态：**c-2c 真实 Relay 实施与范围内验证完成，提交 PROTOCOL 审阅**。依据 c-2a VERDICT-438、stages-and-open-items.md 的 c-2c 行及用户本轮实施授权。P10、P11 已由用户分别批准并落实，当前没有阻塞实施的待回复 PROTOCOL。本报告不代替 PROTOCOL 最终验收，也不授权后续 c-2d/e/f 或产品主链接线。

## 实现结果与文件清单

Relay 提供三个增量 POST 路由和 ExternalService 客户端 adapter，复用未修改的真实账号、注册设备会话、轻量 authority、clock 与 001/002 表结构。新增服务器组合仅初始化一次 clock，并将同一实例交给 authority 与 Relay；通过独立本机 harness 调用，不改旧 server 入口或客户端 Builder。

| 源文件 | 变化 | 实施职责 |
|---|---|---|
| server/src/RelayStorage.ts | 新增 | 原密文字节、公共 proof、位置/receipt 同事务；ACK；到期 tombstone/floor；持久 generation 与丢段检测 |
| server/src/RelayService.ts | 新增 | 已 admitted 的精确提交；来源/摘要/作者签名；pull 缺载/到期/世代 Gap；P11 引用重建；ACK 与限流 |
| server/src/RelayRoute.ts | 新增 | strict canonical wire、独立 route bodyLimit、错误 wire；继承旧 Host/Origin/session/CSRF 边界 |
| server/src/buildRelayServer.ts | 新增 | buildRelayServer 真实 clock 入口与 buildIsolatedRelayServer 显式隔离测试入口；单 clock 组合 |
| src/presentation/RealCommitRelayAdapter.ts | 新增 | relay=submit、pull、完整 c-1 validator 验真、耐久回读后注册设备签 ACK |
| src/presentation/RealSharedServiceSessionAdapter.ts | 修改 | 仅已批准 P10 的 request 局部截止修正；其他请求及旧会话逻辑保全 |
| src/director/IntentPort.ts | 修改 | 原 50175 字节前缀保全，追加 199 字节 type-only suffix；一条 export type 重导出三个既有 validator 类型 |

新增实施源码 **5 份**，既有源码修改 **2 份**。构建另新增 server/shared-dist/src 下 RelayStorage.js、RelayService.js、RelayRoute.js、buildRelayServer.js 四份运行产物，清单与 SHA 单列，不算新增源码。所有新测试、脚本、证据和交付文书均在本阶段 quality-review/b2-5c-2c/；最终完整索引见 evidence/artifact-inventory-delivery.json，之前清单保留为过程快照。

工作区不是 Git checkout；[完整源码 diff](evidence/code.diff) 按原基线/批准前快照生成，覆盖上述七份源码，61156 字节，SHA256 `cb8c2e9037974fe2fef09e833daa4e7b1c048f9f63ba42fb0c1646653e113c84`。[changed-files.json](evidence/changed-files.json) 记录每份 before/after SHA、字节数及四份生成物；其机械状态字段不替代本报告实施结论。

## 协议及持久语义

**submit / relay**：只收已经真实 authority admitted 的精确 envelope 与 public proof，校验 canonical bytes、摘要、来源 receipt、作者签名与注册设备绑定。位置递增、queue 原字节和原 receipt 在同一 PG 事务提交；同 nonce 重传返回逐字原回复，fresh nonce 同 identity/摘要保留原位置和事实、以当前 nonce 新签 wrapper；异摘要冲突，失败回滚位置和请求记忆。服务器不持群 key，不解密正文，不声称正文 AEAD、地图权限或共享 state 已验真。

**pull**：先验证当前会话、CSRF 和成员权限，检查 generation/floor/到期，并对 authority admission 摘要账做从未入 queue 检测。短 admit→submit 窗口也保守返回 MissingAdmittedEnvelope。三种签名 Gap 为 RetentionExpired、RelayGenerationChanged、MissingAdmittedEnvelope；空 Batch 不证明全量。cursor.position 是十进制 uint64，和作者序号、事件总序、结算边界分开；adapter 校验 next=after+count，拒绝跳位及空批推进，避免 Number 截断。

**ACK**：adapter 使用实际 c-1 SharedCommitValidator.validateCommit/ownsCommit，绑定完整候选原 wire、identity、摘要及当前会话；独立共享密文缓存 persistAndVerify 后再次 read，比较完整原 wire/密文字节并重算 SHA，再用 adapter 自有 nonce 调注册设备签名能力。调用者预签名不转发。缺 key、缺来源、Gap、HostFailure、错误回读或会话变化不发 ACK。来源完整且技术验证得到 InvalidChange 的原 wire 可耐久 ACK，状态应用另行决定。服务器在同一事务核验 recipient/position/digest/设备签名并写 ACK/原 receipt，坏批次整体回滚。

**retention / generation**：retainedUntil=admittedAt+86400000ms，全部 ACK 不触发提前删除。到期通过每个 world 的 Relay 事务惰性清理原 envelope/public proof，并保留轻量 tombstone、floor 与 receipt；迟到首次 enqueue 在同一事务转为 tombstone，不返回可读取过期载荷。确证丢段推进持久 generation 一次并返回 Gap；重启不任意重置 generation。没有后台全库即时擦除任务，不能把本轮逻辑过期拒绝宣称为物理介质立即清除。

**P11 请求记忆**：只对 pull 保存轻量原签名 wrapper、queue 引用和原 wire SHA，不把 ciphertext/public proof 再复制到至少七日请求结果表。同 nonce 先验当前成员与边界，保留期内从 queue 重建逐字原 Batch 并核验 SHA/服务签名；到期、丢段或缺载改返回当前签名 Gap，撤员拒绝。永久 nonce/hash、异请求 Conflict 及普通 authority/submit/ACK 的轻量原结果规则保持。

## 资源与结算政策

| 冻结条目 | 本轮实现 |
|---|---|
| pull 数量 | 1..256，默认 128；不截断单条 commit，不跳 cursor |
| pull 等待 / 截止 | wait 0..25000ms，默认 25000；P10 deadline=wait+7000，最多 32000ms |
| 普通 shared/auth 截止 | 保持 12000ms |
| Relay route bodyLimit | submit 512KiB；pull 16KiB；ACK 64KiB；不改旧 auth 全局 16KiB，既有 authority 各路由限额保持 |
| 完整签名回复 | 最多 1MiB，含 wrapper/proof；超限明确拒绝，不以部分 commit 成功 |
| 限流 / 长轮询 | submit/pull 120 次/分钟/账号设备；ACK 240；world submit 600；每账号设备最多一个 pending pull；旧全局 guard 继续适用；等待不持 PG 业务锁 |
| G / B / U / H / retention | 3600000 / 300000 / 60000 / 3960000 / 86400000ms；不修改，H≥G+B+U 且 retention≥H |

B 仍是健康网络、及时 pull、耐久保存的条件假设；25 秒长轮询不证明 B，不延长 OfflineGrant。超 B 或 Gap 不推进 checkpoint。seal 只证摘要前缀封闭，不证正文、state 或全员收件；本轮没有 checkpoint 产品链。

## 门禁、分类测试与实际运行证据

最终命令、退出码、原始日志/结果 SHA 与源码 lineage 见 [validation-final-lineage.json](evidence/validation-final-lineage.json)。命名及依赖门禁保持原脚本，不加目录白名单。

| 验证分类 | 最终结果 | 证据 |
|---|---|---|
| check:naming | PASS，0 ERROR / 45 既有 WARN，警告逐行与基线相同 | evidence/gate-runs/final/results.json、check-naming.log |
| check:dependencies | PASS，0 ERROR；132 TS / 448 静态依赖子句 | 同目录 check-dependencies.log |
| repository typecheck | PASS，exit 0 | 同目录 typecheck.log |
| server 独立 build / typecheck | SharedBuild.mjs 与 tsconfig.shared.json --noEmit 均 exit 0 | evidence/server-build-checks/final/results.json |
| Relay adapter 契约 oracle | 32/32；实际 c-1 validator，虚拟 transport，测试缓存 | evidence/client-relay-contract/results.json |
| P10 deadline 契约 oracle | 13/13；实际 owner，虚拟 elapsed、观测 native timer | evidence/p10-deadline-results.json |
| server 真实 loopback HTTP / PG 完整套件 | 20/20；17 项真实 wall clock，3 项显式隔离 clock | evidence/server-relay-run-05/results.json、server-relay-run-05.log |
| server 真实 PG 首次入队并发补测 | 2/2，单列追加套件，不改称完整 22 项套件 | evidence/server-relay-concurrency/results.json、server-relay-concurrency.log |
| 生产 Relay adapter 真实 HTTP / PG | 22/22；真实 session/authority/Relay 与 clock，测试注入 crypto/cache | evidence/client-real-http-results.json、client-real-http-run-01.log |
| PG 只读原字节 / ACK / 请求记忆检查 | PASS；原 bytea SHA=提交摘要，ACK 与原 receipt 实存 | evidence/runtime-readonly-facts.json |
| P11 真实请求结果表检查 | 42 pull 记录均为轻量引用，ciphertext/proof 副本 0 | evidence/relay-pull-metadata-inspection.json |

真实服务器默认 long poll 等待 25016ms，客户端合法 13000ms wait 实测约 13028ms 成功，越过旧 12 秒截止；不以虚拟时钟冒充此两项。24 小时 retention、显式丢段与撤权边界使用隔离 clock/测试世界，**未声称生产实际等待 24 小时**。

本轮建立独立 PostgreSQL **17.11** cluster（127.0.0.1:55438），使用 Node **24.19.0**、既有 Fastify 5 依赖；新 app role 与分离的 Relay/client/history DB，不改旧数据库。全部运行结束后已正常停服，runtime-stop.log 保留成功停止证据，数据与私有连接元数据留在本阶段 runtime/.local/，不作为交付正文或分享素材。新组合入口只走 loopback HTTP；未实配 LAN HTTPS、云或物理双设备。

## VERDICT-438 / stage 完成证据对应

| 冻结验收项 | 证据与结果 |
|---|---|
| 真实 PG 原字节、位置、ACK 事务 | server 第 3/9 项；runtime-readonly-facts 的 bytea SHA、位置 1、ACK row/receipt；客户端第 18 项完整 validator→fsync WAL→回读→签 ACK |
| admitted 未 enqueue → Gap | server 第 2 项、客户端第 11 项：真实 authority 已 admission，Relay 返回签名 MissingAdmittedEnvelope |
| 并发重复 / 冲突 | server 第 4/5 项与单列首次 enqueue 并发 2 项；同 nonce 原 HTTP bytes、fresh nonce 同 digest 原位置，异 digest/坏作者签名拒绝 |
| 断网 / timeout / 重启 | server 第 11～15 项；客户端 Relay outage、第 13 项丢回复、第 20 项 13 秒等待、第 21 项重启；owner 超界/abort 契约测试；Auth/authority 仍可用，无 fixture 回退 |
| 到期 Gap / 持久 generation | server 第 18/19 项显式隔离 clock/丢段；same nonce 到期后 Gap，迟到重交不能复活正文，generation 持久 |
| 全 ACK 不能提前删除 | server 第 10 项及客户端第 19 项；原密文仍存在，只有 admittedAt+retention 到期后惰性转 tombstone |
| P11 不绕过当前准入与载荷寿命 | server 第 7/8/18/20 项及 42 条 PG 元数据检查；重建核 SHA/签名，坏 memory 拒绝，撤员不能复取旧正文 |

## 历史回归（本轮重跑，分类合计 508）

| 历史套件 | PASS | 本轮证据目录 |
|---|---|---|
| B2.4 ContractAdapter 逻辑 fixture | 227 | evidence/history-b24/ |
| c-1 canonical / validator / replay | 154 | evidence/history-c1/ |
| 旧 b auth | server 16 + client 30 = 46 | evidence/history-b-auth/ |
| c-2b protocol / transport oracle | 32 + 18 = 50 | evidence/history-c2b-pure/ |
| c-2b 真实 authority HTTP / PG | server 20 + adapter 11 = 31 | evidence/history-c2b-http/verified-results.json 与原日志 |

使用新的输出目录/独立 DB 运行，不将 508 项历史测试写成 Relay 生产验收。旧 c-2b HTTP wrapper 初次只识别 TAP，误报 false/-1；保留原 results.json，以原 specs 日志另产 verified-results.json，31 项实际通过。

## 保护审计及过程偏差

[根 protected-final-audit.json](protected-final-audit.json) PASS：7435→7444，changed 仅 IntentPort 和已批准 P10 session；新增仅五份精确实施 TS 与四份精确生成 JS；removed、unauthorizedChanged/Added/Removed 全空。两份既有 kernel 树各 14 份旧文件零差异。原基线 SHA `93271a26ec10bc0b5cd2e82ed436d80e8c6db98d62c59e6e1e71ebc7d3e3b354`；Intent emitted JS 前后相同，见 evidence/intent-type-erasure-final.json。该审计覆盖显式范围字节，依赖/私有 runtime 等排除项明列，不等同数据库、全机器或物理介质审计。

旧 c-1、authority/session/clock/PG 核心（除 P10）、RealAuthServiceAdapter、RealServiceContracts、旧同步端口、旧 RealServiceBuilder、server 旧入口/guard/001/002、产品 Builder/UI、docs/名库/参照最终字节均保持。presentation 对 director 只有 IntentPort type-only 依赖，新增 director suffix 无 cc/DOM/Node/网络/时钟/存储实现。

原始暂停/FAIL 保留，不回写为 PASS：

- P10 原暂停报告保存为 evidence/delivery-report-p10-paused.md，P11 原暂停计划保存为 evidence/implementation-plan-p11-paused.md；原 prerequisite、448/449 单份裁定及暂停审计仍保留原时态。当前恢复结论由本报告与 verdicts-448-451.md 说明。
- server run01 测试构造遗漏 header.kind；run02 篡改摘要被 strict codec 正确拒绝为 400，测试原预期 409；run04 删除整账号却用 CredentialRemoved，修正测试为 MemberRemoved。最终 run05 20/20，未放宽 guard/codec。
- 初始 PG 启动 shell 因 Windows 输出继承停滞，仅终止该 setup shell 后续接健康新 cluster；原不完整日志保留。
- 客户端任务误跑旧 c-2b contract runner，曾临时重编旧 evidence 中 owner JS。随后按保留 snapshot 与原 compiler options 恢复逐字原件；最终 SHA 证明恢复成功。不能声称整个会话从未写过旧生成缓存。以后历史 runner 输出必须定向新的本阶段目录。
- 完整 server 20 项完成后，新增 harness 追加 --concurrency-only 分支两项补测；原 20 项断言未改。lineage 记录交付 harness 的后续 SHA，不倒称 run05 时整份 harness 已是该字节版本。

独立只读源码复审无新增阻塞发现，见 [independent-final-review.md](independent-final-review.md)。分享材料检查与交付 inventory 单列，不用原只读前置审计中的“未启动 PG”旧措辞描述实施后状态。

## 命名、剩余范围与后续入场

[v3.21 附录提案](namebook-v3.21-appendix-proposal.md) 按 A/B/C/D 分列，明确两个 .shared-kernel 为中间编译产物与有意运行布局副本。统一按新增实施 TS 的公开顶层声明计数：c-2b 17 份/64 名，其中协议类型 37；c-2c 新增 5 份/8 名；累计 22 份/72 名。IntentPort 一条 type-only 语句的三个既有重导出不重复计新名。

当前遗留均不阻塞本轮受限 Relay 范围：生产 key package/acceptance、SharedCryptoAdapter 与 producer 留 c-2d；完整生产耐久 backend、独立双客户端重放/coverage 闭环留 c-2e；受信 LAN HTTPS、证书/双物理设备与总验收留 c-2f。真实客户端测试使用 native crypto oracle 和隔离 WAL host cache 注入，验证 adapter 的能力边界，不能宣称这些延期生产机制已经实现。

P4 完整 FileCarry/长期账号与群 key 保护恢复/异步加密迁移，P5 可信 host/PhysicalDevice/bootId/OfflineGrace，旧身份迁移、产品 ObserverSync/首次加入 UI/编辑器及 c-3 主链接线保持原阶段状态。没有真实 readMigrationPayload、服务 key 包/秘密保存或可读正文 API。本轮不修改 docs，不向 Trae 发消息；提案与交付待 PROTOCOL 审阅，再按用户后续授权推进。
