# 名库 v3.21 附录提案 · B2.5c-2c

日期：2026-10-11。交 Trae 按授权落盘；GPT 不修改 docs/NAMEBOOK.md 或 docs/spec/stage-1.md。沿用 v3.19/v3.20 四类定义：**A 已冻结，B 候选未冻结，C 明确排除，D 延期。** 方案/测试注入能力不冒充延期机制的生产实现。最终验收状态以 delivery-report 和原始证据为准。

## A · 冻结名、归属及本轮增量

| 名称 | 正式归属 | 职责 |
|---|---|---|
| RelayStorage | server/src/RelayStorage.ts | 有限密文与公共 proof 的事务队列、原位置/receipt、recipient/ACK；按 world 清理所有 generation 的到期载荷，floor 仅当前 generation；持久 generation |
| RelayService | server/src/RelayService.ts | submit/pull/acknowledge；只验证公开来源/摘要/作者签名，不掌握群 key、不声称正文 AEAD 或地图权限 |
| RelayRoute / relayRoutes | server/src/RelayRoute.ts | 模块名/注册函数；固定三条 shared POST、各自 bodyLimit/错误 wire，保全旧全局 auth guard |
| RealCommitRelayAdapter | src/presentation/RealCommitRelayAdapter.ts | ExternalService；relay 同 submit；pull；实际完整 validator 验真和独立耐久缓存回读后签 ACK |
| RelayStoredStream / RelayStoredCommit | RelayStorage 模块 | 两个服务器公开行类型；cursor 用十进制 uint64 字符串，不等同作者序号/事件总序/settle 边界 |
| buildRelayServer / buildIsolatedRelayServer | server/src/buildRelayServer.ts | 新独立服务器装配及显式隔离 clock 测试入口；同一 clock 初始化一次并注入原 authority 与新 Relay |

前四个模块沿 v3.19 已冻名落实。最后四个公开声明（两个行类型、两个 builder 函数）正式限域冻结于相应服务器模块，不新增产品概念。旧 buildSharedServer/shared-main、RealServiceBuilder 和 SharedRelayPrototypeBuilder 不修改；新 Relay 通过独立装配/验收 harness 调用，不能据此声称产品主链或 c-2e 组合根已经扩展。

`SharedCommitValidator`、`ValidatedSharedCommit`、`SharedValidationResult` 是 c-1 既有声明，本轮仅在 IntentPort 尾部新增一条 type-only export 语句重导出三名，不新增定义、不产生 runtime director import。其余新增 helper、内部 `RelayPullResultMemory`、方法/字段/局部绑定由完整机械命名清单记录，只作用于自身模块。

## A · 已批准的契约窄例外

P10（VERDICT-448）：session shared request 仅对已严格验证的 pull 使用 wait+7000ms（7000..32000），其余 shared/auth 仍 12000；旧 session 其余字节保全。

P11（VERDICT-449）：pull 请求结果只记轻量原签名 wrapper 元数据、queue 位置/identity/digest 引用和 wire 摘要；每次同 nonce 先验当前准入/generation/floor/expiry/缺载。保留期内从唯一队列重建逐字原 Batch，边界变化后签 Gap，不把密文复制到 authority 请求账。ordinary authority/submit/ACK 的至少 7 日轻量原结果与永久 nonce/hash 记忆保持。

内部元数据版本/种类与字段不是 HTTP wire 新 schema；现有 strict codec、三类 Gap、P3 suite/签名域、三类变化、G/B/U/H/retention、001/002 均不修改。旧主链、本地七项/主 key/锁/目录 commit point 及迁移不受新 Relay 授权改变。

## A · 两个 .shared-kernel 路径关系（以下段落逐字交 Trae 落盘）

`server/.shared-kernel` 是 SharedBuild.mjs 从同一份 director 源码编译得到的中间内核产物；`server/shared-dist/.shared-kernel` 是该中间产物的有意运行布局副本，供 shared-dist/src 的相对模块路径在 Node 运行时解析。两者不是两份独立源码、两套契约或两份业务实现，也不代表额外的生产缓存能力；重复字节是运行布局复制，而非用于加速的第二份缓存。SharedBuild 先编译中间目录，再构建 server 并复制到运行目录；输入哈希及受保护旧文件保证两者取同一内核。本轮构建不修改原内核输入及既有 kernel 字节；两个目录不能重复计入新增源码、公开导出或独立测试数量。

## A · 64 / 37 / 本轮增量统一统计口径

“公开导出”统一指**实施 TS 源文件中带 export 的顶层声明**，不计字段、方法、局部变量、import、IntentPort reexport、质量验收 harness 或生成 JS/d.ts 副本。

- c-2b：17 份新增实施 TS 中 64 个公开顶层声明 = 37 个协议契约类型 + 1 个 Codec 类 + 2 个 Adapter 类 + 2 个客户端 Builder 函数 + 22 个 server 声明。
- c-2b 的“37 个 A 类顶层公开类型”只计 SharedServiceProtocolContracts.ts；与全组 64 个口径不同，不能互减认定缺名。
- c-2b IntentPort `exportCount: 1` 是当轮尾部**一条** export type 语句、含 37 个类型名，不是整个 IntentPort 的 export 总数。
- c-2c：5 份新增实施 TS、8 个公开顶层声明 = 1 个 Adapter 类 + 7 个 server 声明（2 行类型、2 服务/存储类、1 route 注册函数、2服务器 builder 函数）。本轮新增协议契约定义 0；IntentPort 一条尾部 type-only reexport 含 3 个既有类型，不计入新增公开声明。
- 两轮累计：22 份新增实施 TS、72 个公开顶层声明 = 37 个协议契约类型 + 1 个 Codec 类 + 3 个 Adapter 类 + 2 个客户端 Builder 函数 + 29 个 server 声明。已有文件两处修改与生成副本另列 diff，不混入“新增源文件”数量。

最终源 SHA、全部声明/字段/局部名称与计数复核以 evidence/new-names-final.json、evidence/changed-files-final.json 和 evidence/source-final.diff 为准；原无 final 后缀记录保留为旧 generation 清理修复前快照。

## B · 候选，未冻结

自动 P2P 群 key 交付、长期 publisher、自动秘密恢复及未批准运维扩展仍为候选。没有因本轮新增自动交付/恢复机制；测试 native crypto oracle、隔离文件/WAL cache 不是产品能力命名或生产 backend。

## C · 明确排除

完整 FileCarry/个人七项与媒体/journal/checkpoint/Genesis/manifest/state 载荷、群 key 包或私 key 持久服务、readMigrationPayload；OfflineGrant/PhysicalDevice/bootId/原生 host；旧三元迁移/非 Primary 迁移/WorldRegistry 本机位置；产品 ObserverSync/首次加入/AccessCode UI/编辑器/Echo/EditPresence/S5；云部署。没有把 Ledger NarrativeEvent 或 Core 七项变为 WorldCommit。

## D · 延期能力与资源

WorldRelayKeyDelivery / SharedCryptoAdapter / 最小生产群 key package/acceptance / producer 留 c-2d；SharedRelayPrototype / SharedRelayDurableCache / 完整独立双客户端生产重放链留 c-2e；SharedTlsEdge / LAN HTTPS / 两台实际设备与证书边界留 c-2f；产品主链接线留 c-3 另议。测试注入的完整 validator/native crypto 与 fsync 文件能力不提前宣布上述能力完成。

P4 长期账号/root/key 保护恢复、完整 FileCarry/异步加密迁移，P5 trusted host/TPM/attestation/物理设备/平台 OfflineGrace 均保持延期。服务器独立函数可用于受批准本机原型，正式 world/Genesis/manifest/pins、长期 key、LAN 地址/SAN/CA 信任与防火墙仍需对应阶段操作员资源；无云账号依赖。

Trae 只按授权追加 A 类及 B/C/D 状态；历史 raw FAIL、暂停记录、既有名库与裁定不回写。本提案不是 GPT 修改 docs 的授权。
