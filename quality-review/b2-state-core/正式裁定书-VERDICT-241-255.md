# B2.2d-1 正式裁定书 · VERDICT-241～255

本裁定仅实现权威 Ledger、PuzzleProgress、FormatTime。B2.2d-2 四项与 B2.3 留待后续。既有 B2.2a/b/c 的账号事实、完整快照品牌、完整恢复拒绝、真实通关判据继续有效。此文件是交付材料，不改写 docs、名库或参照文件。

| 裁定 | 落地口径 |
| --- | --- |
| VERDICT-241 权威载体与归属 | director 校验、编排、构造恢复对象；presentation 的 `WorldCoreStateStorage` 适配本地存储与 Web Locks。所有三项共享既有主 key `neurou-world-state-v1:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)。不新增三份独立 key。|
| VERDICT-242 部分文档 | 使用严格 `WorldCoreStateSnapshot`：保留 schemaVersion/accountId/worldId/worldKind/shoreOrigin/revision/capturedAt 七个头字段，新增 `kind='Core'` 与 sections{Ledger,PuzzleProgress,FormatTime}。三个 section 可以显式 null；缺失不是零值。Core 不取得 `WorldStateSnapshot` 完整品牌。目录创建时未知种类用 Unavailable；只有正式内容可确认 Primary/null。|
| VERDICT-243 角色与内容身份 | Ledger 内按 characterId 分账；完整隔离索引为 [accountId,worldId,characterId]。主角来自已发布 Primary 世界叙事配置的 protagonistCharacterId，不取 presentation、目录 template 或账号默认值。恢复严格绑定 contentId/contentRevision、20 维、有限非负值、累计不溢出、事件顺序与唯一 ID。|
| VERDICT-244 同源持久追加 | 保留一次 `bindLedgerSource` 配对读写。WorldClearSession 对完整候选 Ledger 校验后同步保存，成功才发布内存、一次穿越与入口。保存失败不发布事件、选择、序号或穿越，也不提交通关账号事实。|
| VERDICT-245 无副作用 hydration | 读取未知 JSON → 严格版本/身份/内容/引用校验和深拷贝 → 新建未激活对象图 → constructor seed + 一次控制状态回填 → 启用输入、揭示和唯一 FrameDriver。禁止重放追加或意图，禁止由 hydration 触发穿越、动画、谱面、账号记录/投影写入。任一校验失败不改存储；新图保持未激活。|
| VERDICT-246 必要账本控制 | Ledger 携带选择 ID、原穿越事实、唯一入口、事件序号、完成事件 ID。这些是 Ledger 事实的防重/来源控制，不是 ChartSnapshot。恢复时只读核对合法历史前缀，绝不执行 SphereCrossing.onLedgerAppended。账号 WorldClearRecord 不嵌入本世界文档。|
| VERDICT-247 事件 ID | B2.2c 两种 WORLD_* 时间戳/序号 ID 保留，并恢复 sequence，禁止回退或重用。旧 T6/T7 的固定 ID 保留，唯一性位于账号/世界/角色内；恢复完整终点和首演防重后不会重复追加。旧灰盒向量不补值、不重写。|
| VERDICT-248 Puzzle 完整字段 | 存 schemaVersion/accountId/worldId/chainId/deepTraceId/ruleVersion/chartId；chain 存 stage、sustainedStartMs、sustainedElapsedMs、lastHitBeatTimeMs、nextBeatTimeMs、beatIntervalMs、requiredSustainedMs；control 存 currentPerceptionMode、beatClockOffsetMs、endpointSettled、deepTraceTriggered、chartCompletionRecorded、revealPhase、chartEntryScheduled、worldMotionGated。最后两项在支持边界恒为 false。正式索引为 [accountId,worldId,chainId]。|
| VERDICT-249 稳定边界 | 支持无持续计时的 Step1/AwaitingStrike，以及终点已结算、揭示已结束、谱面已退出的 Completed。活动七秒、揭示 Playing/Flash、已触发但未开始揭示、谱面 Ready 入场/Playing/Paused 均 UnsupportedBoundary；捕获拒绝，不清计时、不伪称媒体续播。ruleVersion=1 绑定现有 60 BPM、7000ms、接近/区域/节奏窗口算法，不改 T6 判定。|
| VERDICT-250 终点与入口一致 | endpointSettled、DeepTrace triggered 与唯一 T6 Entry 严格一致；chartCompletionRecorded 与唯一合法 T7 PremiereCompleted 严格一致。恢复 reveal 仅 seed Idle/Finished，不播放、不自动 EnterChart。T7 中途退出可保存已结束揭示的入口，后续从头进入；已完成 T7 继续防重。终点新事件先 durable 时旧 flags 尚未发布，原子写 Ledger + PuzzleProgress=null；转场/演奏退出后才原子写一致稳定 Puzzle。若此窗口崩溃或退出，重入明确 UnsupportedBoundary，保留账本，不伪造默认防重状态。|
| VERDICT-251 FormatTime 冻结 | WorldInstance 自身 immutable 现实创建时间正式冻结 `{ readonly epochMs:number }`，非负安全整数。新增 `FormatTimeStorage` 是同一主 key 的 section facade；真实新世界目录发布前，在该新世界租约内独立采样 Date.now 并保存 revision=0。目录 createdAt 不作为来源。历史 key/value 缺失保持 null/Unavailable，读取和重入不补值。已有值不可修改；未来 B2.3 分叉须继承原值，本批不实装分叉。|
| VERDICT-252 七项与完整判别 | Ledger/PuzzleProgress/FormatTime codec 元数据变 Implemented；RecallCount/WorldLink/ChartSnapshot/ChartScore 保持 NotImplemented。有效的三项在 capturedParts 中返回，但 capture 仍 Incomplete。必须七项全部实装并校验才可能 Complete；`restoreWorldState` 和完整 `WorldStateStorage.saveSnapshot` 继续拒绝。|
| VERDICT-253 锁、版本与通关顺序 | 激活前取得账号/世界独占 Web Lock，持有到退出销毁与所有 retained 账号提交结束。无锁能力拒绝激活/写入，没有无锁 fallback。顺序：world lease → durable Ledger 完成引用 → B2.2c account lock → WorldClearRecord → FirstWorldCleared projection。`retainUntil` 防止退出提前放锁；不嵌套同一 account lock。单 key 严格校验、当前期望比较、revision 单调递增、前缀只增与控制单向保护。|
| VERDICT-254 墓碑与失败 | 保持 B2.1 墓碑只写目录元数据。保留 Core 字节，不删除世界状态或账号通关事实；每次打开和保存重查活动目录，墓碑阻止正常读取入口与保存。陈旧、损坏、身份/版本不符、配额写失败均拒绝；保留原持久值。hydrate 不自动补账号事实；若完成账本已 durable 而账号提交未完成，只允许显式 RetryWorldClear 提交原完成候选，不生成新完成事件。|
| VERDICT-255 验收与范围 | 契约测试使用隔离存储/时钟/组件 seam，单独报告。生产验收使用 Cocos 实际编译预览、正式叙事选择、真实媒体与自然 T6 输入，双分辨率截图与源码映射验证。三项恢复是核心部分 hydration，不宣称完整世界恢复。其余四项、WorldFork/FileCarryPayload/WorldRegistry/跨设备/同步/服务/AccessCode 均未扩展。|

本批不采用 `LedgerStorage`、`PuzzleProgressStorage` 两个额外类：它们的独立读写会掩盖跨 section 原子一致性。唯一 Core 适配器提交整个三项文档，LedgerHydration/PuzzleHydration 保持业务校验边界。`deriveLedgerPosition` 使用 B2.2c 的真实累计函数，未增加第二套坐标计算。

旧行为保护例外仅为必要状态接口：PuzzleProgress/Chain、DeepTrace 和 reveal 增加 seed/capture；DirectorSession 增加激活前 hydration 与已完成首演防重。既有节奏、运动、演奏、退出、灰盒向量和结果计算未重写。Regular 的 Inspector 配置与旧 T7 确定性 fallback 沿用原行为。
