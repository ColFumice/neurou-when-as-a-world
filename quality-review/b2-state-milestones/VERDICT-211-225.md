# VERDICT-211～225 · B2.2 实施边界裁定书

日期：2026-10-10（Asia/Shanghai）。身份：ARCHITECT + IMPLEMENTER。状态：设计裁定已出具；生产实施因新增前置缺失暂停，范围调整待 PROTOCOL 确认。本文是本轮交付证据，不修改 docs、名库或参照。新结构名为候选，交 Trae 追认落盘；不冒称已冻结或已实装。

## 先行拆分建议

| 分批 | 可以独立实施的内容 | 不能算作本批已具备的能力 |
| --- | --- | --- |
| B2.2a · 账号事实投影基础 | 新增独立 AccountMilestoneStorage、AccountMilestoneReader；严格解析 FirstWorldCleared 本地投影；CopyPermission 只读派生；账号隔离、失败保留、幂等、损坏显式错误；目录展示权限与功能开放分别表达。 | 真实通关触发需要 SphereCrossing → WorldBossChart → 首演完成 → WorldClearRecord/RouteSignature。当前缺失，普通 T7、开发按钮或测试注入都不能替代。此基础交付不等于 B2.2a 世界通关端到端完成。 |
| B2.2b · 状态契约及诊断捕获 | director 聚合捕获/恢复契约；七项归属与完整性定义；独立 WorldStateStorage 边界；已有数据的不可变诊断投影；FormatTime 的最小结构提案；账本、进度、得分受控恢复的后续接入设计。 | 当前不存在能够完整恢复现有 gameplay 的接口。只读阶段/分数/默认数组不是完整状态，Incomplete 不得作为正式世界存档、不得用于分叉。 |
| 延后 · 完整恢复前置 | 权威账本读写载体与角色身份；PuzzleChain 计时/防重及媒体生命周期 hydration；RecallCount 的合法行为与索引；WorldLink 的来源与孤立处理；ChartSnapshot 的首演冻结和稳定内容引用。 | 必须在 B2.3 启用 WorldFork 前完成；其中真实通关链路宜另立 B2.2a 前置批，不能让 B2.3 分叉实现掩盖其缺失。 |
| B2.3 及之后 | WorldFork、新 ID、完整继承/验证、FileCarryPayload；B2.4 跨设备及 B2.5 服务。 | 本轮不做 Registry、重复副本识别、观察者同步、AccessCode、网络服务、世界文件导入/导出。 |

本轮实际状态：发现交接中未列出的 SphereCrossing/路线签名前置和恢复控制状态缺失后，按用户停工约束停止生产修改。以上是恢复实施后的明确范围建议；不是完成声明。

## 正式裁定

| 编号 | 结论 | 实施边界 / 验收含义 |
| --- | --- | --- |
| 211 | B2.2 分成账号事实投影基础与状态契约基础；真实世界通关和完整恢复单列前置。 | 不把接口存在当作机制实装，不把部分快照当完整。范围收敛见 PROTOCOL-B2.2-001。 |
| 212 | FirstWorldCleared 不使用现有事件替代。唯一合法触发是账号首次完成一个 Primary 世界中合法开放的 WorldBossChart 首演。 | 普通 T7 完成、T6 终点、Character/Final 谱面、测试写值、重玩均不触发；中途退出不触发；完整演奏与分数无关。WorldBossChart 必须遵守 SphereCrossing 来源条件。 |
| 213 | 球面穿越沿用最新冻结修订 VERDICT-042：来源 Player 的账本追加后，角色坐标在球面上/外且尚未穿越，才产生一次入口。 | 不是简单移回 archive 的旧 inside→outside 算法；Autopilot 追加参与坐标，但不直接开放入口。半径/球心/真实向量来源不凭空定值。 |
| 214 | AccountMilestoneStorage 是 FirstWorldCleared 的浏览器本地投影适配；使用独立账号 key。 | `neurou-account-first-world-cleared-v1:` + encodeURIComponent(accountId)。现有序章 key `neurou-account-milestone-v1:` 完全保留，不迁移、不重写；AccountStartupStorage 不承担本次新事实。 |
| 215 | CopyPermission 只由 AccountMilestoneReader 返回的 FirstWorldCleared 派生，不持久化，不加入 AccountStartupSnapshot。 | 增设 AccountMilestoneSnapshot 读取面，CopyPermission === FirstWorldCleared。错误不能降级为 false 或默认授权。presentation 仅 type 经 IntentPort 窄路，业务更新由 director 的合法通关处理决定。 |
| 216 | WorldClearRecord 与 FirstWorldCleared 都属于 AccountProfile；通关生成路线签名，世界删除不撤销账号事实。 | 本地投影不能代替带 RouteSignature 的真实通关记录。账号记录不放入世界状态快照，不通过恢复、分叉或刷新生成；新世界不得继承通关记录，继承完成账本也不得重首演刷记录。 |
| 217 | 世界状态聚合命名 WorldStateSnapshot；操作 captureWorldState / restoreWorldState；承载于现有 director 模块中的 WorldStateSession。 | 不新增模块；world 不反向依赖 ledger/trace/chart；组合根注入对象及平台存储；presentation 仅获取读取面和操作结果，不直接改业务对象或账本。 |
| 218 | 七项归属采用下表；世界身份和个人状态的索引必须显式。 | `accountId + worldId` 是本地隔离外层；角色、链、谱面 ID 属于内层业务索引，不从目录标题/占位事件 ID 猜测。 |
| 219 | 区分 Complete 与 Incomplete；只有前者携带 WorldStateSnapshot；后者只有 capturedParts 与缺失诊断。 | 七项及其必要控制状态全部验证后才能 Complete。缺少机制不是“空数据”；未实装 WorldLink 不是已知无链接；结果面不能让调用者手动置 complete/forkReady。 |
| 220 | 当前账本、PuzzleProgress、ChartScore 可以设计/实现诊断投影，但现有实例的完整持久化 + 恢复均有额外前置。 | 账本必须核对实际读写源；PuzzleProgress 包括链计时/结算语义；ChartScore 结果投影不是 Playing/Paused 续演状态。受控恢复要先生成未激活的新对象图，验证后一次发布，不能改写已有账本。 |
| 221 | FormatTime 最小结构建议为 readonly `{ epochMs: number }`，代表世界创建的现实纪元毫秒，分叉保留原值。 | 当前 FormatTime 是空接口，故此是结构提案而非已有能力。普通重入不重设，Shore 自有创建时刻，不混用叙事时间或快照 capturedAt。B2.1.createdAt 不直接认作已有 gameplay FormatTime；历史世界缺失时不得静默用 Date.now 补成真实旧值。 |
| 222 | RecallCount、WorldLink、ChartSnapshot 必须先建立真实载体和合法生产边界，再加入完整捕获/恢复。 | 可先定契约，不用计数按钮、空对象、ChartPlaybackResult 或资源路径清单冒充机制实装。详情见七项表与 PROTOCOL。 |
| 223 | WorldStateStorage 使用每账号、每世界的独立浏览器本地 key，与 WorldFolderRecord 分离。 | `neurou-world-state-v1:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)。WorldFolderRecord 不新增状态字段；通过同一 worldId 关联。存储缺失/损坏/版本不支持/身份不匹配须区分；拒绝 Incomplete 正式保存。 |
| 224 | 权限、快照完整性、产品功能开放分别表达。B2.2 的 WorldForkAvailability 固定为 NotImplemented。 | CopyPermission 为真仍不能执行本轮分叉；不以“权限未取得”解释功能未实装。界面可显示“复制权限已取得；分叉尚未开放”。仅 B2.3 完整验证并实装后才计算可执行性；FinalShore 的不可复制例外保留。 |
| 225 | 三门禁、保护哈希、契约验证、状态覆盖及真实 Cocos 用户流程分别验收。 | 本次三门禁仅证明现有基线通过。本轮未实施，不宣称通关事实写入、权限新 UI、状态恢复截图通过；验收逐项映射见交付报告。冻结 013/014/030 及其后续既有修订均不重新裁定。 |

## 七项明确归属及实施清单

| 内容 | 所属层及业务索引 | 现状 | 恢复实施后本批最小部分 | 必须延后至完整性成立 |
| --- | --- | --- | --- | --- |
| 账本 Ledger | WorldInstance 的观察者个人层；accountId/worldId/characterId；每角色 append-only。 | DirectorSession 默认主角内存数组；可注入另一 LedgerAppend，读取面未随之切换；无角色归属载体。 | 权威来源已核实情况下的不可变事件投影，保留所有冻结附加项、顺序和向量；未核实则返回 Incomplete。 | 权威持久载体、角色账本读取口、无副作用 hydration、稳定 ID 与重复占位 ID 的兼容；不能删除活跃账本后回放 append 冒充恢复。 |
| PuzzleProgress | 世界观察者个人层；chainId。 | 有 stage；PuzzleChain 持有连续拍点计时；director 持有终点结算与自动进入控制状态。 | stage 和已有公开持续时长的诊断捕获；注明未捕获项。 | 链私有状态、终点防重、DeepTrace、入口和揭示生命周期一致恢复；必要时定义稳定保存边界，不能 silently 归零七秒进度。 |
| RecallCount | 世界观察者个人层；characterId + NarrativeEventId。 | 仅冻结语义，无正式载体/行为。 | 契约与缺失诊断。 | 自己账本回忆/痕 Replay 共用计数；别人账本的初次经历写自己的账本；ChartReplay 不增加；事件存在性与角色身份校验。本轮不定难度公式。 |
| FormatTime | 世界自身 immutable 创建现实时间；Shore 自有，分叉继承。 | WorldInstance 空接口字段。 | 最小 epochMs 结构和新世界初始化设计，可独立验证数据载体；历史值没有来源则 Unavailable。 | 挂接世界创建生命周期与历史缺失处理；CacheWarm 和服务时钟另期，不由目录 createdAt 自动推导。 |
| WorldLink | BugShore 世界自身的单一来源弱引用；sourceWorldId + LinkState；孤立恢复还依赖 AIProfileSnapshot。Primary/FinalShore 不使用此链接。 | 仅 LinkState 枚举，无链接载体/彼岸创建。 | 契约、不适用与未实装分开。 | 来源身份/单层弱引用/来源删除孤立处理与恢复；保存最后进入时冻结的 AIProfileSnapshot 等必要支持状态，缺失则 Incomplete。捕获单个指向而非递归复制来源世界。当前只知目录模板，不足以断言所有实例 kind。 |
| ChartSnapshot | 世界观察者个人层；ChartRef。Final 也属于 FinalShore 个人层（VERDICT-057 修订）。 | 有谱面输入与媒体路径，无首演冻结快照。 | 数据来源审计、契约与缺失诊断。 | 保存完整谱面内容/布局版本/稳定媒体内容引用/已有表现或 AI 内容；首演完成冻结、重玩复用；不能只保存 chartId 或完成结果。不存在的剪辑/AI 不臆造为捕获成功。 |
| ChartScore | 世界观察者个人层；ChartRef；Final 同上。 | ChartScore 计数与总分为运行态；ChartPremiere 重入会重建计分器。 | 已有计数/总分/完成结果的只读投影；明确结果域，和首演快照关联。 | 持久计分档案的语义、恢复实例和重玩更新链；若要求进行中续演，还需判定/时钟/媒体状态。保留原评分规则，不擅定最高分或最新分覆盖策略。 |

账号层另列：AccountMilestone.PrologueCompleted、AccountMilestone.FirstWorldCleared、WorldClearRecord/RouteSignature 属于 AccountProfile。CopyPermission 是账号事实的派生量。四者全部不作为 WorldFork 继承载荷。

“完整状态”在这里是七项继承域连同使其恢复后行为一致的必要控制状态，不自动扩成所有任意帧的存档。是否支持七秒挑战中途/Playing/Paused 续演，需要明确保存边界；未确定前不能声称完整恢复。主角坐标、视角、输入队列、cc 对象和媒体句柄不直接序列化，未被用户选入继承清单；若某状态恢复依赖它们，应报告 UnsupportedBoundary，而不是静默补值。

## 存储与提交契约

- 账号投影候选 schema：`{schemaVersion:1, accountId, FirstWorldCleared:boolean}`；读 key 不存在为尚无本地投影，不能据此推断未实现的跨设备账号事实。CopyPermission 不在 JSON 中。通过 director 的真实通关链路更新，View 不获得“设置权限”入口。合法更新只允许 false→true 或 true→true；禁止 true→false，目录删除、恢复、重启都不清零。
- WorldStateSnapshot 候选头部：schemaVersion、accountId、worldId、worldKind、shoreOrigin、revision、capturedAt；载荷七项及必要恢复支持状态。shoreOrigin 用于区分 BugShore/FinalShore，Primary 则不适用。capturedAt 是诊断挂钟，不替代 FormatTime。未实装项不得以 null 或空数组洗成完整状态。
- 所有恢复先校验版本、账号/世界身份、事件结构、索引、谱面引用及支持状态，再对未激活新图 hydration。失败保留当前对象图和持久化；成功才发布新图。hydration 不经过普通 LedgerAppend 产生新事实，不产生通关或权限副作用。
- 保存先成功后发布内存快照；expected/revision 防止已观察到的旧写覆盖。不宣称 localStorage 有跨 key 原子事务或跨 tab CAS。真实通关涉及世界账本、快照和账号记录，必须单列可恢复提交/对账协议；投影适配不能解决这项原子性。
- B2.1 删除仍只写目录墓碑。worldId 用作独立状态 lookup，不扩展目录元数据。墓碑使入口不可用，但不能清除账号通关事实。一旦开始保存正式 ChartSnapshot/ChartScore，世界删除处理必须逻辑禁用并清理对应世界历史个人状态，保留账号 WorldClearRecord；不能永久把隐藏目录行当作完整删除。本轮仅设计/诊断、不正式保存，故不借 metadata 墓碑偷偷执行状态 GC。

## 既有冻结证据

只读来源：历史 JSONL 第 51 行 VERDICT-010；第 62 行 VERDICT-012/013/014/015；第 74 行 VERDICT-017；第 85 行 VERDICT-022/025；第 97 行 VERDICT-030；第 132 行 VERDICT-042；第 167 行 VERDICT-057。历史文件：`641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl`。

最新修订优先：VERDICT-042 的 Player 条件修订原球面穿越；VERDICT-030 的继承快照/得分修订早期“不继承”；VERDICT-057 将 Final 快照/得分移至终末彼岸个人层。这是沿用既有冻结链，不是本轮重新裁定。
