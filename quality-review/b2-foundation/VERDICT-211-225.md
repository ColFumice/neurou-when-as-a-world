# VERDICT-211～225 · B2.2a + B2.2b 落地裁定书

日期：2026-10-10（Asia/Shanghai）。依据：用户《PROTOCOL 裁定回复 · B2.2 范围确认（方案 A）》及已实现源码。本轮授权范围已解除阻断，实施范围为账号里程碑投影基础和状态捕获/恢复契约基础；真实通关、完整玩法恢复、WorldFork 仍按下表延后。本文件作为交付证据，供 PROTOCOL / Trae 同步；不修改 docs、名库或参照文件。

## 子阶段拆分表

| 子阶段 | 范围与当前定位 | 完成边界 / 依赖 |
| --- | --- | --- |
| B2.2a · 本轮 | AccountMilestoneStorage；AccountMilestoneProjection / Snapshot / Reader；FirstWorldCleared 严格读取；CopyPermission 只读派生；目录分别显示权限状态与功能实施状态。 | 只有本地投影适配和读取面；没有生产通关写入调用者。合法 true 输入仅能用于标识清楚的契约验证，不能证明真实通关。 |
| B2.2b · 本轮 | WorldStateSession / Snapshot / CaptureResult / RestoreResult / Diagnostic / Reader；WorldStateStorage；候选头部；七项归属契约；不可变缺失诊断；Complete / Incomplete 判别；完整恢复明确拒绝。 | 当前 captureWorldState 在有效诊断时间下始终返回 Incomplete；restoreWorldState 始终返回 Rejected；saveSnapshot 始终抛错且不写存储。没有完整状态成功保存/恢复路径。 |
| B2.2c · 后续 | SphereCrossing 业务实现；WorldBossChart 合法内容来源与装配；从账本坐标派生的权威 RouteSignature；T6 endpoint ChartRef 与 VERDICT-030 首演判据的兼容处理。 | 沿用 VERDICT-042 最新修订的 Player 写入和账本驱动入口。禁止普通 T7 替代世界通关、伪造方向、灰盒零向量冒充路线。 |
| B2.2d · 后续 | 同一权威账本读写源、角色身份与无副作用 hydration；PuzzleProgress 完整私有及控制状态；RecallCount 正式载体和合法行为；WorldLink 创建/孤立与 AIProfileSnapshot；ChartSnapshot 首演冻结；ChartScore 持久化更新语义。 | 建立七项有效载荷、关联校验、序列化及恢复边界后，才可能产出 Complete 或 Restored；本轮不提前补做这些机制。 |
| B2.3 · 后续 | WorldFork 实装与 FileCarryPayload。 | 依赖 B2.2c + B2.2d；本轮 WorldForkAvailability 固定 NotImplemented。 |
| B2.4 / B2.5 · 后续 | 跨设备以及服务接入。 | WorldHomeRegistry、CrossDeviceDuplicate、WorldMigration、RealityPause、AuthService、CommitRelay、OfflineGrace 按既定阶段推进。 |

## 正式裁定

| 编号 | 落地结论 | 实现对应与边界 |
| --- | --- | --- |
| VERDICT-211 | 采纳方案 A，B2.2 拆成 a / b / c / d，本轮只交付 a + b。 | 基础接口交付不能被表述为真实世界通关或完整 gameplay 恢复完成。既有前置已由 PROTOCOL 分期处理，不再次以同一原因停工。 |
| VERDICT-212 | FirstWorldCleared 不采用普通 T7、T6 终点或其他现有事件作临时替代。 | 沿用 VERDICT-012 的账号首次完成合法 WorldBossChart 触发语义及 VERDICT-030 的既有首演规则；真实触发移至 B2.2c。本轮生产组合根只读新投影，不调用 saveProjection 产生通关事实。 |
| VERDICT-213 | 世界魔王曲入口和路线权威来源留待 B2.2c。 | SphereCrossing 按 VERDICT-042 最新修订实现 Player 写入与账本驱动入口；RouteSignature 来自真实账本坐标。现有灰盒事件、普通 T7 完成和测试注入不证明满足这些规则。 |
| VERDICT-214 | 新增独立 AccountMilestoneStorage，保留序章 key。 | 新 key 为 `neurou-account-first-world-cleared-v1:` + encodeURIComponent(accountId)。既有 `neurou-account-milestone-v1:` + encodeURIComponent(accountId) 完全保留，不迁移、不覆盖；AccountStartupSnapshot 不扩展。 |
| VERDICT-215 | CopyPermission 为 AccountMilestoneSnapshot 的只读派生量。 | `CopyPermission === FirstWorldCleared`；持久化投影严格只有 schemaVersion / accountId / FirstWorldCleared。缺 key 读取为 false；损坏、未知版本、错误身份或非法字段显式失败，不能降级为 false 或 true。 |
| VERDICT-216 | FirstWorldCleared 保持单向事实；账号事实与世界状态分离。 | saveProjection 校验当前值及 expected，拒绝 true→false 和已观察到的陈旧写入；false→true / true→true 通过适配器契约验证。失败保留原 key。真实写入权威和多 key 一致性协议由 B2.2c 建立。本轮不实现 WorldClearRecord。 |
| VERDICT-217 | 状态聚合承载于现有 director 模块中的 WorldStateSession。 | captureWorldState / restoreWorldState / getLastCaptureResult 已提供；逻辑不引用 cc / 浏览器存储。presentation 经 IntentPort 仅类型引用，组合根负责装配，不新增模块、不修改依赖矩阵。 |
| VERDICT-218 | 七项世界内状态采用下述归属及业务索引契约。 | WorldStateReader.ownership 暴露冻结的七项 owner / indexes / codec / requires 元数据；它们不是实际捕获载荷。账号里程碑、CopyPermission 和 WorldClearRecord 不属于七项继承域。 |
| VERDICT-219 | Complete 与 Incomplete 严格区分。 | Complete 只接受带私有品牌的 WorldStateSnapshot；本轮没有生产者、完整 codec 或从 unknown/JSON 强转的成功通道。当前 Incomplete 的 capturedParts 是冻结空对象，明确表示没有捕获权威 gameplay 数据，不能作为完整存档。 |
| VERDICT-220 | 当前捕获提供候选头部及七项缺失和控制边界诊断。 | 候选头部具有 schemaVersion / accountId / worldId / worldKind / shoreOrigin / revision / capturedAt；未知 worldKind / shoreOrigin / revision 为 Unavailable，不伪造 Primary / null / 0。恢复始终 Rejected，合法头部也附 RestoreUnsupported；原状态和存储不变。 |
| VERDICT-221 | FormatTime `{ epochMs: number }` 只作为最小结构提案。 | 未改变既有 WorldInstance.FormatTime 占位接口；ownership 中的 proposal 为结构/数值规则说明，未生成 FormatTime 值。目录 createdAt、诊断 capturedAt、当前 Date.now 均不能替代未知历史创建时间。B2.2d 再冻结正式载体。 |
| VERDICT-222 | RecallCount、WorldLink、ChartSnapshot 机制及其他完整恢复前置移至 B2.2d。 | 不以零计数、null 链接、空快照、只读阶段或运行分数包装完整状态。当前七项 codec 均 NotImplemented；WorldLink 不适用与机制未知不能混淆，现目录模板不足以认定真实世界种类。 |
| VERDICT-223 | WorldStateStorage 每账号每世界独立 key，和 WorldFolderRecord 元数据分离。 | key 为 `neurou-world-state-v1:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)。readSnapshot 返回 unknown 候选或缺失 null，损坏/存储 null/非对象显式拒绝并保留；director 再校验头部和身份。saveSnapshot 当前禁止所有输入，零写入。 |
| VERDICT-224 | 账号权限、状态完整性和分叉实施状态分别显示。 | 目录显示“复制权限：未取得 / 已取得”与“分叉功能尚未实施”；读取失败显示失败，不显示默认授权结果。WorldForkAvailability 始终 NotImplemented，CopyPermission=true 也不开放分叉。状态诊断和恢复可用性检查都不进入 gameplay。 |
| VERDICT-225 | 按收敛后的 13 项基础接口验收，契约测试与生产预览证据分开。 | 本文件记录裁定及实现边界，最终门禁结果、两档分辨率截图和逐项证据由交付报告另行汇总；不据本文件宣称截图或成功通关。VERDICT-014 / 030 / 013 及既有后续修订均不重新裁定。 |

## 七项归属与类型契约

`accountId + worldId` 为本地隔离外层。`WorldObserver` 是 ownership 元数据中“世界观察者个人层”的取值，不新增模块或运行实体；`WorldInstance` 表示世界自身。下表和源码中的 readonly 字面量/元组类型一致，所有 codec 当前为 NotImplemented。

| 七项 | 世界内归属 | indexes 类型契约 | B2.2b 诊断与 B2.2d 前置 |
| --- | --- | --- | --- |
| Ledger | 世界观察者个人层 | readonly [accountId, worldId, characterId] | AuthorityUnavailable；同一权威读写源、角色身份、有序事件、无副作用 hydration。 |
| PuzzleProgress | 世界观察者个人层 | readonly [accountId, worldId, chainId] | ProjectionUndefined；私有链计时、终点防重、DeepTrace、入口生命周期。 |
| RecallCount | 世界观察者个人层 | readonly [accountId, worldId, characterId, NarrativeEventId] | MechanismMissing；权威计数、合法回忆行为、账本事件引用校验。 |
| FormatTime | 世界自身 | readonly [accountId, worldId] | AuthorityUnavailable；权威创建现实时间、不可变值及结构正式冻结。`{ epochMs: number }` 仍是提案。 |
| WorldLink | BugShore 世界自身 | readonly [accountId, worldId, sourceWorldId] | MechanismMissing；真实 WorldKind / ShoreOrigin、单一来源弱引用、孤立语义与 AIProfileSnapshot。Primary / FinalShore 的不适用须有权威身份依据。 |
| ChartSnapshot | 世界观察者个人层 | readonly [accountId, worldId, ChartRef] | MechanismMissing；首演冻结、稳定内容引用及账本关联。Final 继续按既有修订归 FinalShore 个人层。 |
| ChartScore | 世界观察者个人层 | readonly [accountId, worldId, ChartRef] | ProjectionUndefined；持久化计分档案策略、快照关联及重玩更新语义，保持既有评分规则。 |

账号层单列：序章完成事实、FirstWorldCleared、WorldClearRecord / RouteSignature 仍属于 AccountProfile；CopyPermission 由账号事实派生。以上账号数据不作为 WorldFork 继承载荷。WorldFolderRecord 仍仅保存目录元数据，通过相同 worldId 关联独立 WorldStateStorage；B2.1 删除继续只写墓碑，不清理账号通关事实，也不借本轮实施新的世界状态清理语义。

## 已实施接口的精确能力

- `createAccountMilestoneReader(accountId, stored)` 生成冻结读取面；getMilestoneSnapshot 返回冻结投影和派生权限。账号 ID 为不带首尾空白的 1～64 字符，并验证可编码。账号投影要求恰好三个自有数据字段，拒绝访问器、非法原型、错误版本、非布尔值、账号不匹配和额外 CopyPermission 字段。
- `AccountMilestoneStorage.saveProjection(projection, expected)` 是未来可信编排和隔离契约测试的适配器入口。它不是产品通关按钮；目录与玩法没有生产调用者。current 与 expected 检查是已观察更新的保护，不宣称浏览器跨 tab 原子 compare-and-swap 或多 key 事务。
- `WorldStateSession(accountId, worldId, now?)` 从目录级身份建立诊断边界，worldId 为 1～128 字符且可编码。未读取或变更 gameplay 实例；capture 仅发布最近一次不可变结果。诊断时间非法时抛错，并保留上一次结果。
- `WorldStateSnapshot` 完整头部约束：schemaVersion=1；worldKind 为 Primary / Shore；Primary 的 shoreOrigin 必须为 null，Shore 必须为 BugShore / FinalShore；revision / capturedAt 为非负安全整数。该合法 null 仅表达已知 Primary 不适用，不用于未知候选头部。
- `validateWorldStateHeader` 只验证候选头部，不验证七项完整载荷，不生成 Complete。缺少自有数据字段、访问器、非法原型、无法安全读取、版本、身份、种类/来源冲突和非法版本计数/时间分别形成诊断。`StaleRevision` 为预留诊断理由，本轮没有权威 revision，不能宣称已实现完整过期快照比较。
- `restoreWorldState(raw)` 对所有输入明确拒绝，除头部错误外始终附 RestoreUnsupported；`WorldStateRestoreResult.Restored` 仅保留未来契约分支，没有本轮成功返回路径。`WorldStateStorage.saveSnapshot` 始终抛错，不执行 getItem / setItem，不因伪造 Complete 标签而放行。
- 目录“状态诊断”展示当前 Incomplete 和缺项；“检查恢复可用性”读取独立世界 key 后调用拒绝接口。组合根检查活动目录成员，不为诊断创建 gameplay；墓碑世界不能借旧卡片进入诊断或恢复操作。

## 验收边界与明确延后

本轮验收对应用户收敛的 13 项：独立账号 key；严格解析、隔离、失败保留；只读 CopyPermission；单向事实；损坏/版本/身份拒绝；候选头部；七项归属；Complete / Incomplete 契约；真实缺失诊断；恢复拒绝；NotImplemented 分叉；目录权限/功能状态区别；两档分辨率及三门禁。最终证据以交付报告逐项关联的实际日志和新截图为准。

合法投影的存储适配器测试、CopyPermission=true 的输入、品牌不可构造检查、各种恢复拒绝及零写入验证均须标 CONTRACT_TEST。测试准备的 true 投影截图只能说明读取和显示，不得作为生产世界通关或首演完成证据。生产预览可验证正常账号路径的未取得权限、Incomplete 诊断及恢复拒绝；不沿用 B2.1 旧截图冒充本轮。

真实世界通关写入由 B2.2c 验收，完整 gameplay 恢复成功由 B2.2d 验收，WorldFork 由 B2.3 验收。本轮不做 FileCarryPayload、WorldRegistry、跨设备重复识别/迁移、观察者同步、服务接入或 AccessCode，不修改 B1、A/B/C/T6/T7、编辑器核心逻辑。已授权范围内没有以缺失机制为理由伪造成功的例外。
