# PROTOCOL-B2.5a-001 · 从 fixture 到真实服务的前置裁定

日期：2026-10-11（Asia/Shanghai）。状态：**待 PROTOCOL；停止受影响契约的最终冻结，不准入 B2.5b～f。** 本轮没有机制实现。依据用户本轮约束：“若发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL。”本文提交具体冲突、最小建议与验收条件；建议不是已经取得的变更授权。

B2.4 的 P1～P4 已由 VERDICT-301～310 闭合，不重新阻断或否定 B2.4。以下问题来自把已经验收的 ContractAdapter 范围扩大到真实服务。正式 NAMEBOOK 当前已有 v3.15（docs/NAMEBOOK.md:1337）；本轮不改正式文件，也不把历史报告“待合并”改写成当前状态。

## P1 · 真实模式与同步历史签名

证据：archive/service/AuthService.ts:21/24/27 冻结 login():void、logout():void、verify():boolean，:37 为 fetchServerTime():Promise<number>；archive/service/CommitRelay.ts:22 冻结 relay(commit):void。src/director/WorldHomeRegistry.ts:66/226、CoreTransfer.ts:257、src/presentation/CrossDeviceImportStorage.ts:343、WorldMigrationStorage.ts:383 明确只接受 ContractAdapter，结果与 receipt 也带此标签。

冲突：异步网络登录不能静默替换同步签名；ExternalService 不能通过现有 guard。冒用 ContractAdapter 标签或放宽验证器都不是合法接入。

推荐裁定：保留旧接口、旧 fixture、key/锁/恢复协议，新增 RealAuthServicePort、RealCommitRelayPort、RealWorldAuthorityPort，真实 mode 逐字为 ExternalService。允许后续阶段**列清单的新增契约、type-only 导出、组合根接线及模式分流**，保持领域算法不变；真实链有独立验收证据，禁止失败时切 fixture。若“B2.4 核心零改”连模式/类型边界扩展也禁止，真实端到端接入保持停止，只能独立验证服务器。

解冻条件：PROTOCOL 明确最小允许文件/职责边界；不能凭本文添加 src/service 或恢复 archive 模块，不能预先认为核心扩展已授权。

## P2 · fixture 搬运存档与进程内排空能力不能直接网络化

证据：src/director/WorldMigration.ts:103～106 把 SafePointDrainCapability 与完整 RestrictedMigrationCorePayload 交权威，并从权威取回载荷。src/presentation/WorldMigrationContractAdapter.ts:38/100/147/231 在服务 fixture 快照保存、返回完整 Core；WorldMigrationStorage.ts:90/113/142 依赖这个行为。SafePointDrainCapability 的 assertCurrent/revoke 是当前进程能力，不是 JSON 权限。

历史边界：根参照 jsonl:74 的 VERDICT-020“世界存档永远不上传到服务器”；jsonl:85 的 VERDICT-024 禁止个人层、共享状态/检查点和可理解正文上中继；B2.4 本身已明确只是 fixture 范围。

推荐裁定：真实权威只保存账号事实、归属、暂停、设备绑定、幂等请求、**不可逆载荷摘要**及轻量 receipt；完整文件由用户 FileCarry 搬运，不提供真实 readMigrationPayload 服务。源本地消费当前 live drain 能力，持锁至 release 完成；网络传确认摘要、一次性服务 challenge 与注册设备签名。服务验证凭据与确认一致性，不能宣称远端证明了 Web Locks、未修改客户端或物理机停机。跨设备 release 必须拿到源当前确认，丢失源设备不伪造排空。

解冻条件：批准新的真实迁移端口与本机协调路径；冻结 challenge 30 秒服务寿命、一次性消费、重试幂等/过期重排空及 receipt 与 payloadDigest 绑定。既有 d 的五 phase、源保留、本地目录提交原则不回退。未批准前不能把真实服务器视为 fixture 的 HTTP 包装。

## P3 · 完整共享 codec 与 Relay 的生产语义前置

证据：archive/sync/WorldCommit.ts:16 的 AppendedAt、WorldCheckpoint.ts:14、SharedWorldState.ts:14 是空接口；WorldChangeLog.ts:13 是空算法骨架。src 中没有对应完整共享生产链。历史有规则，却没有完整的 wire schema、共享元素稳定身份、Trigger/地图修改载体、共享来源认证、检查点生成/重放的生产契约。

历史必须保留：WorldCommit ID=作者账号+该账号自序号；不含任何 20 维向量；日志 ID 并集去重、AppendedAt 后 ID 排序（020）。SharingCriteria 三条件同时满足、解谜/收集仍个人层（022）。地图仅 WorldDeveloper 写，首次加入 AccessCode 与限流、WorldCheckpoint 只本地、SettleHorizon≥OfflineGrace+中继延迟（023）。Relay 客户端拉取且服务器只看外层（024）。

推荐裁定：为 B2.5c/d 增加一次**共享数据契约补冻**，覆盖 AppendedAt 来源/同序冲突、三类允许变化的精确字段、作者序号多设备分配与离线段、开发者权限、成员/AccessCode 密钥交接、TraceTouch 聚合、检查点覆盖与迟到语义、有限中继延迟假设。不把 Ledger NarrativeEvent 或七项 Core 当共享提交。

解冻条件：明确是否授权上述最小共享生产/准入契约，或将 c/d 标为仅服务壳验证并保留完整 FileCarry 未交付。本轮不拿泛型、unknown、空数组冒充完整 codec。AccessCode/ObserverSync 历史留后续，不能为了 Relay 暗开这些产品机制，也不能绕过首次加入约束。

## P4 · 静态个人层加密与同步持久化提交

证据：根参照 jsonl:132 VERDICT-046 要求个人层“在世界文件中按该账号加密存储”。src/presentation/WorldCoreStateStorage.ts:24/47/134 是同步 Storage/JSON 明文读写；WorldStateStorage.ts:6/12 同样。WorldForkStorage.ts:102、CrossDeviceImportStorage.ts:259 及 WorldMigrationStorage journal 保存完整明文计划/载荷。ChartMediaIdentity 只有引用，不是个人媒体字节。

冲突：只加密导出文件仍漏本机个人层、journal、媒体；把异步 WebCrypto 放入 setItem:void 后立即返回，会破坏写入完成、回读与目录发布顺序。固定主 key 不禁止密文，缺的是已冻结的加密存储/崩溃恢复协议，不能追溯把 fixture 的明文验收判为失败。

推荐裁定：批准新增真实加密存储适配路径，保留七项结构/归属、revision、现有逻辑主 key 与锁顺序；先异步准备密文，后在有效 lease 下完成可验证的存储提交，再目录追加。全部 journal、暂存、缩略图、截图、入场视频与个人媒体同保护；旧 fixture 域不改。旧明文转密文必须独立一次性迁移协议、保留可恢复证据，不默默重写旧源。

解冻条件：精确冻结存储端口、密钥就绪、原字节/逻辑视图比较、故障恢复、容量失败、旧明文迁移和 source bytes 保护策略；授权范围必须与“核心不修改”协调。没有这个裁定不能称完整账号加密已冻结可实施。

## P5 · Web 的凭据身份不能等同物理设备/开机时钟

证据：浏览器没有可信 OS bootId/开机累计时长 API；performance.now 不是 OS uptime。WebAuthn 证明某凭据持有，凭据可能同步、漫游或由另一设备提供；非可导出 WebCrypto key/安装令牌也不能跨 profile/重装锁定同一物理机。当前 WorldHomeContext.deviceId 是已绑定 fixture 身份，不是物理认证。

推荐裁定：浏览器只声称 RegisteredCredential 级，未知平台无 OfflineGrant，允许在线受限验证，不能冒充 PhysicalDevice。严格设备级暂停账号绑定与平台 OfflineGrace 只在批准的原生可信 host/硬件凭据方案验收；同一 OS boot session 的单调 uptime、休眠计入预算、重启/回滚拒绝，grant 不跨 boot 复用。应用运行时长不作为 OfflineGrace 降级，墙钟也不作为离线替代。

解冻条件：PROTOCOL 选择（A）保持物理设备承诺，准入原生平台/可信 helper 并明确 TPM、attestation、清安装/OS 重装及攻击者边界；或（B）把产品承诺收紧到注册凭据范围并显式改裁设备绑定语义。本报告推荐 A；纯 Web 保留受限能力。不能把普通 WebAuthn 或一个随机 deviceId 当 A 已完成。

## P6 · 运行中出现两项受保护报告新增，来源未确认

初始SHA清单为6,937路径；首次比对为6,938，新增docs/B2.4-overall-report.md。最终比对为6,939，另外发现quality-review/B2.4-overall-report.md。两次原有文件changed/removed均空；本轮代理只写新quality-review/b2-real-service-freeze，未写这两项外部文件。

| 外部新增 | 字节 | SHA-256 | CreationTimeUtc / LastWriteTimeUtc |
|---|---:|---|---|
| docs/B2.4-overall-report.md | 7947 | df314c242a746a0bd3e44e1b0fee76191ec36225654a69ce3a6b45f382e5eae1 | 2026-10-11T01:52:06.1125792Z / 01:52:06.1507988Z |
| quality-review/B2.4-overall-report.md | 7959 | fe19becbb0d549d5e935a0dfea8768acbe9a5c4432fa90c5ffe0fbc9b286481c | 2026-10-11T01:54:47.9705831Z / 01:54:48.0100979Z |

最终比较时点2026-10-11T02:05:47.9881061Z（上海10:05:47），raw exit1；首项hash保持相同，初始baseline与first FAIL未覆写。完整观测见evidence/observed-protected-drift.json。

处置：保留原baseline、差异与文件，两项source=UnknownExternal，不猜作者、不回删、不重建清单掩盖变化。需要PROTOCOL确认两项外部新增是否为授权同步；确认后也保留rawHashEquality=false，不回写历史FAIL。该来源问题与P1～P5架构问题分开；三门禁PASS不等于全工作区零变化。

## 待裁定回复清单

| 项 | 具体需要裁定 | 推荐 |
|---|---|---|
| P1 | 是否允许真实端口/模式/组合接线的最小扩展，保持领域算法不变 | 允许列明的新增路径，fixture 原协议保留 |
| P2 | 真实服务禁止 payload；批准摘要 receipt + 本地能力消费/签名确认 | 采用；不 HTTP 复制 fixture 存档 |
| P3 | 是否纳入最小共享 schema、作者序号、成员/AccessCode/密钥与检查点补冻 | 先补冻；未完成不进 c/d 正式实现 |
| P4 | 加密生产持久化路径及旧明文迁移的授权边界 | 先冻结异步提交/恢复协议 |
| P5 | 物理设备承诺与原生平台范围 | 保持承诺，批准可信 host；Web 明确受限 |
| P6 | 两项外部报告新增的来源/授权 | 分别确认，保留原SHA差异 |

本文没有请求云账号、购买资源、执行外部部署或修改生产。具体可审阅方案在 verdicts-356-375.md、contracts-draft.md、security-model.md、deployment-plan.md；这些提案可供下一 PROTOCOL 一次裁定。
