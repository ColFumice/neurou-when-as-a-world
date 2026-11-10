# B2.5c-2c 实施计划（前置冲突暂停）

日期：2026-10-11。c-2c 已正式授权。本计划对应 `b2-5c-2a/stages-and-open-items.md` 的 c-2c 行与 VERDICT-438。P10 已获批准并落实；四个服务器模块和 adapter 已草拟，新增契约测试通过，但发现 P11 后停止机制实施/验收。现状是**未验收 WIP，P11 待裁定**，不是 Complete。

## 文件清单与顺序

| 顺序 | 计划文件 | 职责及冻结条目 | 对应验收 |
|---|---|---|---|
| 0 | `src/presentation/RealSharedServiceSessionAdapter.ts`（仅 P10 批准后局部修改） | 兑现冻结的 pull `wait+7000` 截止，其他请求 12000ms | 等待 0/25000 边界、严格拒绝越界、真实大于 12 秒的 pull；原 auth/session 回归 |
| 1 | `server/src/RelayStorage.ts`（新增） | VERDICT-438 queue 原字节/位置/原 receipt 同事务；identity 去重；ACK；tombstone/floor/持久 generation | 真实 PG 同摘要原位置、异摘要冲突、回滚、并发重复、重启；ACK 不提前删除 |
| 2 | `server/src/RelayService.ts`（新增） | 只收已 admitted envelope/public proof；验摘要/来源/作者签名；缺载/到期/世代 Gap | admitted 未 enqueue 的短窗口同样 Gap；三种 Gap；不声称正文/地图验真；有限期密文 |
| 3 | `server/src/RelayRoute.ts`（新增） | 严格 submit/pull/ACK wire；原 session/CSRF/Host/Origin；route bodyLimit 与限流；长轮询不持业务锁 | 真实 HTTP 拒绝/幂等/断网/timeout；pull 数量/等待/完整响应上界 |
| 3a | `server/src/buildRelayServer.ts`（新增组合文件，名称仅计划候选） | 不改旧 builder；复用旧 buildApp、authority service/routes；clock 只初始化一次，并向 authority 与 Relay 注入同一实例 | 真实与隔离 clock 入口分列；不重复增加 generation；旧入口零触碰 |
| 4 | `src/presentation/RealCommitRelayAdapter.ts`（新增） | ExternalService；submit=relay；pull；完整 validator 能力验真后独立耐久缓存写入并回读，最后签 ACK | 缺 key / 缺源 / HostFailure 不 ACK；原字节/SHA 回读；失败无 fixture fallback |
| 5 | `quality-review/b2-5c-2c/` 内隔离测试与证据（新增） | 只在独立 harness 组装新 Relay 与不改源码的 authority/session/clock，按阶段边界验收 | 真实 PG/HTTP 与契约 oracle 分列；不冒称 c-2d key/producer、c-2e 双客户端闭环或 c-2f LAN |
| 6 | 同目录的 `delivery-report.md`、`namebook-v3.21-appendix-proposal.md`、完整 diff、审计/命名统计；必要的新 verdict | 实施完成后按 A/B/C/D 名库类别及统一统计口径交付；当前不生成已完成报告 | 三门禁、server typecheck/build/test、历史回归、SHA 保护与 diff 对应 |

表内 0 已获 P10 最小局部授权。其余旧源码、迁移、产品 Builder、c-1 五模块、docs/名库/参照均受保护。IntentPort 已 type-only suffix 追加三种既有 validator 类型，原字节前缀保持。没有新增纯逻辑实现模块。

新 builder 是独立服务器组合，不能先调用私有持有 clock 的旧 buildSharedServer 再初始化另一个 clock。客户端所需 validator/cache 注入能力保持窄接口，经 IntentPort type-only 追加后使用；若需新增公开类型，将在实施报告和 v3.21 提案中按实际声明单列。SharedCryptoAdapter/key producer 与完整双客户端链仍留 c-2d/e。

## 执行原则

逐项实现后先运行对应契约/事务测试，再继续依赖项。最终运行三门禁与 server 独立 checks，记录实际命令、退出码、测试清单和原始日志。只有真实 PG 原字节/位置/ACK、缺载、并发、网络/重启、到期及不提前删除均取得证据，才能宣称 c-2c 完成。

当前已完成：前置基线证据、P10 局部修正、五个新模块 WIP、客户端 Relay 30/30 与 P10 13/13 隔离契约；旧回归在新输出/新 DB 独立运行。当前未完成：P11 裁定及相应实现修正、真实 Relay HTTP/PG、最终全项验收/交付。计划表中的验收不能按“源码存在”自动认定完成。

## 已接受口径（留最终 v3.21 提案逐字解释）

- c-2b `exportCount: 1` 指 IntentPort 新增尾部的一条 `export type` 语句，内含 37 个类型名，不是全文件 export 数。
- c-2b “64 个公开导出”统计 17 份新增实施 TS 中的公开顶层声明：37 个契约类型 + 1 个 Codec 类 + 2 个 Adapter 类 + 2 个 Builder 函数 + 22 个 server 声明；不计字段、方法、局部变量、import、IntentPort 重导出与生成副本。37 只统计协议契约类型。c-2c 最终报告将用同一口径单列本轮增量和累计。
- `server/.shared-kernel` 是共享逻辑内核的中间编译产物；`server/shared-dist/.shared-kernel` 是 SharedBuild.mjs 有意生成的运行产物副本，用于 shared-dist 相对模块解析。不是第二份源契约，也不是两个独立逻辑内核；重复字节属于运行布局复制，不作为独立实现/测试数量或额外缓存能力。当前两树均受保护，尚未重新 build。
