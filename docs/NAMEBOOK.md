﻿﻿领域 冻结名（名库 v0） 备注

世界 WorldInstance、WorldKind(Primary / Shore)、WorldLink、Layer 代码中禁用单字“世界”

地图 WorldMap、CommunityMap、ForeignAnchor 社区地图全局共享，进度归存档

事件 NarrativeEvent、LiveWorldEvent、Trigger、Note、PuzzleChain、PuzzleProgress 代码中禁用单字“事件”

元素 ElementType（6个值），其中“雨”为 Residue，其余5个待定 待定项列入下一轮

痕 Trace、TraceTier(Common / Deep / Rain)、TraceOrigin(Normal / Anomalous)、DeepTrace、RainTrace、RainTraceTint 雨痕与雨元素彻底分开

权限 ControlGrant、ChartEntry、SwitchEligibility、WitnessSight 权限全部由账本派生

表现 RainMode、RainSubtitle、Raindrop 禁用单独的 Rain 命名

新增/修订领域：

领域 冻结名（v0.1 增补） 说明

账号 AccountProfile、AccountGrant 账号层，主角雨痕的归属地

世界 WorldLink（弱引用）、LinkState(Bound / Orphaned)、AIProfileSnapshot 彼岸的引用与孤立逻辑

元素 ElementType 定稿：Initial / Process / Trace / Highlight / Commented / Residue 实体层只允许4个值：Initial、Process、Trace、Residue

可见性 VisibilityState(Revealed / Concealed) 状态转换：Trigger/Recall/CacheWarm/Forget

痕 AnomalyDisclosure(Masked / Disclosed)、WitnessSight（语义已定） 异痕的感知状态

回忆 RecallCount、Recall、Replay 回忆不写账本，只影响解谜难度

空间 SpawnPoint、SpawnZone、EventSpaceCenter 避免与 Initial 和 Origin 撞名

保留字 日志必须用 Log，UI 选中用 Focus / Selection，运行实例用 Runtime / Session 全局规则，禁止滥用通用词

账号体系：AccountMilestone、FirstWorldCleared、WorldClearRecord、CopyPermission

能力来源：SightSource(Publication / WorldCompletion)

谱面体系：CharacterBossChart、WorldBossChart、FinalBossChart、FinalBossFile

路线体系：RouteSignature、DivergenceAxis(6大情感维度)、RouteCoverage

现实提示：RealityHint（纯本地，不上传）

存档体系：WorldRegistry、DuplicateWorld、WorldFork

时间体系：WallClock、FormatTime

颜色体系：EmotionToTrailColor、TrailColor、TrailRender、TrailLength、SpeedStreak、MoveSpeed

领域 冻结的新增/修订名称

事件空间 LedgerPosition、SphereCrossing、CharacterUnlock；ChartEntry 来源扩展

感绪 EmotionWindow、AppendedAt、EmotionWindowSum；修订 EmotionToTrailColor 输入（感绪+发色基准）

最终魔王曲 FinalBossPremiere、FinalBossReplay、FinalEnding、FinalBossSnapshot、FinalBossScore

同步机制 Observer、ObserverSync、ObserverLayer、SharedWorldState、WorldChangeLog、WorldCommit、WorldObserver、ObserverSyncChannel、FileCarry、CommitRelay、OfflineSession

空间 WorldMeter、ScaleRef、MapScaleCalibration、LateralAxis、DepthAxis、MapCenter、CenterDistance、EventDistance、ViewDistance

保留字 代码中的 Window 只用于时间窗口，界面窗口用 Panel 或 View

包名 记入 backlog，上架前更改

领域 冻结的新增/修订名称

共享 SharingCriteria（三条判定规则）、TraceTouch；共享层和个人层完整清单

权限 WorldDeveloper、StudioDeveloper、AccessCode；禁止单独使用 Developer

合并 WorldCheckpoint、SettleHorizon

服务 OfflineGrace（1小时）、SafePoint、AuthService、CommitRelay 边界清单

魔王曲 BossTier、BossPremiere、BossReplay、BossSnapshot、BossScore；废止 FinalBossPremiere、FinalBossReplay、FinalBossSnapshot、FinalBossScore

外观 HairColor、DecorationPalette

修订 VERDICT-018 第5条转为正式；VERDICT-019 的四个命名改为通用名；VERDICT-020 的离线有效期由 OfflineGrace 确定

领域 冻结的新增/修订名称

地图权限 MapEditPermission、MapEditCommit；世界开发者暂不可转让

世界提交 CommitClass（Monotonic / AddOnly / SingleWriter）；提交 ID 改为“账号+设备+序号”

异痕 AnomalyCause（ForcedRollback / MergeConflict / OrphanCommit / RevertedEdit）

痕 TraceOrigin 扩展为 Normal / Anomalous / Echo；EchoTrace；TraceTouch 定义确认

AI AIProvider、CloudProvider、LocalProvider、TemplateProvider、AITaskRoute、FallbackChain

谱面 ChartTier（Regular / Character / World / Final）、ChartPremiere、ChartReplay、ChartSnapshot、ChartScore、ChartRef、ReplayEntry（VectorEntry / FileEntry）、EventSpaceView

废止 BossTier、BossPremiere、BossReplay、BossSnapshot、BossScore

领域 冻结的新增/修订名称

事件空间视图 MomentCapture、MomentInfo；重玩入口挂在截图界面上

共情 EmpathyScaling、ScalingBasis；孤儿提交异痕转换出的情感维度只能是黑白灰；“玩家共情程度”由规则引擎在写入时确定

入口 ConstellationGate、IdleThreshold（20秒）、StarPoint、StarLine、LinkStroke

感知模式 PerceptionMode（Normal / Triggered / Rain）

共同开发 CoDeveloper、DeveloperRoster、EditTarget、EditPresence

改名 CommitClass.SingleWriter 改为 RestrictedWrite

修订 VERDICT-022、027、030、031；简报中“共情由 AI 实时计算”

领域 冻结的新增/修订名称

星图 ConstellationGate 在三种感知模式下全部生效；雨模式中连线是唯一被允许的操作

自动接管 Autopilot、AutopilotThreshold（30秒）、IdleTimer、StarWindow

账本附加信息 InputSource（Player / Autopilot）、ChapterTag，与 AppendedAt 并列，均不属于 20 维向量

窗口 LedgerWindow（通用）、ScalingWindow（1小时）；EmotionWindow 归入 LedgerWindow

瞬间信息 DimensionReadout、ToneSummary；禁止情绪词汇；禁止显示派生量和阈值

截图 MomentCapturePostProcess；截取后立即处理，不保存原图

章节类型名：Chapter（归入 S5 叙事导演域）

六维成员名（只冻结两维）：DivergenceAxis.Understanding、DivergenceAxis.Empathy（其余四维继续空占位）

账本容器类型名：Ledger

截图/图片对象类型名：MomentImage（原图）、ProcessedMomentImage（经过后处理图）

直译结构名追认：GatePosition（承载 LateralAxis/DepthAxis）、ConstellationGateState、SECONDS 单位后缀

HANDOFF 缺失名追认：ScalingWindow（1小时）、AutopilotThreshold（30秒），符合命名规范，正式冻结。

领域 冻结的新增/修订名称

彼岸 ShoreOrigin（BugShore / FinalShore）；终末彼岸只属于本人、不可复制、可迁移

最终魔王曲 在终末彼岸中触发；快照和得分移到终末彼岸的个人层；重玩只通过选中向量进入

废止 FileEntry、FinalBossFile（作为谱面文件的含义）

时长上限 MixedVideoDurationCap、GlitchGapDurationCap；两者比例之和必须小于 1

迁移 RealityPause（以服务器时间为准；时长不短于离线宽限；冻结整个账号，发起设备不能切换账号）

回映 StackedFrame；结局清单增加生成设备信息

修订 VERDICT-013、019、025、030、052、053、054、056

领域 冻结的新增/修订名称

彼岸 ShoreSetting（叙事地点，不是世界）、ShorePrologue、EditorTutorial、StudioOrigin、FinalShoreArc

目标 NarrativeGoal（Recollection / Guidance），只是叙事解读

里程碑 AccountMilestone.PrologueCompleted

叙事导演 新增账号级范围，只能写里程碑

转为正式 VERDICT-057（终末彼岸删除规则，附“假设接受”标注）、VERDICT-059（冻结整个账号）

数值 混剪 30%、缺口 10%、截图 60%（暂定，由 PROTOCOL 维护）

领域 冻结的新增/修订名称

终末彼岸 FinalShoreState（Present / DeletionIllusion）；数据保存在私有存储中，Neurou文件夹只显示入口

恢复 SourceCube、RestorationSet、RestorationProgress、ShoreRestoration；源码收集不写账本

分类 新增“观察层对象”：外来锚点、源码立方

主界面 ShoreHub、HubEventSpace、HubOrigin；VectorEntry 适用场所扩大到主界面

制作流程 GreyboxFirst、ArtReviewGate；阶段 1 新增 AC-29

废止 VERDICT-063 全文；VERDICT-057 第 3 条中的两条删除规则

修订 VERDICT-030（VectorEntry 适用场所）、VERDICT-062（启动流程）

领域 冻结的新增/修订名称

主界面 ShoreHubState（Absent / Damaged / Active）；AccountMilestone.ShoreRestored；启用条件改为“大结局之后，并且恢复过”

存储边界 设备存储被清空时，所有本地存档（包括终末彼岸）都会真正丢失；必须明确告知玩家

源码立方 SourceCubeDialogue、CubeSecret（PublicPerception / ToneClue / StudioPoem）

诗与名言 StudioPoem、StudioPoemLibrary、PoemProfile、QuoteLibrary；只检索、不生成、逐字一致

AI 路由 新增“立方对话”和“挑选诗”两项任务；展示前校验新增三项

恢复 恢复所需世界集合和反复恢复转为正式；共同开发者的世界不计入；迁移后以新设备上实际存在的世界为准

修订 VERDICT-029、066、067、068

领域 冻结的新增/修订名称

大结局后 锁定、终末彼岸进入删除假象、冻结恢复集合，三项一次性同时生效；源码立方自动出现

主界面 推导规则简化为三条；废止 AccountMilestone.ShoreRestored

诗的标签 PoemProfile 由用户标注；按归一化后的分布方向比较

立方对话 CubeSecret 修订为 PublicPerception / StudioPoem；废止 ToneClue；诗不做内容过滤

向量错乱 VectorScramble、VectorAccess（Usable / Scrambled）、UsableVectorRatio（三分之一）、ScrambleCycle；可解性优先于比例；只影响主界面

文本档案 TextArchive、ArchiveEntry、TextProvenance（Original / PublicDomain）、TextKind（Poem / Quote）；废止 QuoteLibrary、StudioPoemLibrary

修订 VERDICT-067、071、073、078

领域 冻结的新增/修订名称（HANDOFF-ROUND-12 补登）

世界与时间 WorldThemeColor（世界主题色，WorldInstance 的字段）、WallClock（时间结构 { epochMs: number }）、OFFLINE\_GRACE\_HOURS（离线宽限常量，取值 1）、HairColor（发色基准，等同于 BaseHairColor）、Chapter（章节类型，S5 叙事导演域，文件 src/director/Chapter.ts）

回映与结局 EndingScope（结局级别 World / Final）、EndingManifest（结局清单，含播放顺序与时长）、EndingItem（清单条目结构）、EmpathyWeightedShare（按共情值分配截图时长）、EndingProgress（回映播放进度）、EndingWindow（结局共情窗口 1小时）、RecentEmpathy（近期共情结果）、EndingMemoryDuration（回映总时长 60\~300秒）、LocalEndingStorage（本地回映存储载体）、GlitchGap（故障缺口本体；此前仅有其 Cap 上限名）

迁移与服务 MigrationRelease（迁移释放归属）、MigrationClaim（迁移认领归属）、fetchServerTime（AuthService 获取服务器时间的方法签名）、GlitchGapSegment（缺口段，特别优先追认冻结）

领域 冻结的新增/修订名称

主界面恢复 ProgressiveVectorRecovery；可用比例只约束周期开始时的选取

存储边界 设备存储被清空后，向量错乱永久存在；世界内的视图不受影响

朗读 不读作者和出处，但画面上必须显示

收录 ProvenanceRecord、ProvenanceStatus（Pending / Confirmed）；未确认的公共领域条目不得进入正式版本

20 维 NarrativeDimension（按简报顺序，情感在前）；第 17 维为 TruthLevel；非负实数；有序数组加 VectorSchemaVersion = 1；禁止数字下标；PoemProfile 格式随之冻结

阶段 1 结构 8 个模块；依赖方向矩阵；event 改名为 ledger；账本的读取接口与追加接口分开；移除 boss、sync、service

文档 规格与验收清单存放在 docs/spec/，EXECUTOR 只读；AC-29 正式条文与验证方法



领域	冻结的新增/修订名称

同步验证	SyncVerificationRecord；T0 只对 Chromium/Electron 有效；SYNC\_TOLERANCE\_MS 必须严格小于 PERFECT\_WINDOW\_MS

表现层骨架	FrameDriver、CameraRig、InputCollector，均为 src/presentation/ 下的 Cocos 组件

意图接口	PlayerIntent（移动 / 敲击 / 切换感知模式 / 进入谱面 / 退出谱面）、IntentPort，放在 src/director/

引擎隔离	逻辑模块不得引用 cc；表现层可以保存显示状态，但逻辑层不得读取

感知模式	当前感知模式由 director 保存，不写入账本；trace 以模式为参数

流程	交付与裁定不一致时，必须主动列为偏差



领域	冻结的新增/修订名称

角色	Protagonist，src/character/Protagonist.ts；承载主角玩法状态，不引用 cc

表现层	DebugPanel，src/presentation/DebugPanel.ts；ProtagonistView，src/presentation/ProtagonistView.ts；均为 Cocos 组件

承载形式	PerceptionMode 为字符串字面量联合类型；PlayerIntent 为判别联合类型，kind 使用字符串字面量；保持 I 边只允许 import type，不放宽

纵深语义	DEPTH\_RANGE\_WM 表示总跨度（非单侧距离）；裁剪以 MapCenter 为基准，两侧各 ±半个总跨度；必须计入中点偏移



领域	冻结的新增/修订名称

意图	Jump（第 6 种 PlayerIntent，无载荷）

输入映射	空格键 = Jump；鼠标左键 = Strike；撤销原空格 Strike 绑定；Jump 按按下边沿提交一次

跳跃常量	JUMP\_INITIAL\_SPEED\_WM\_PER\_SECONDS、GRAVITY\_WM\_PER\_SECONDS\_SQUARED（放入 constants/index.ts）

Y 轴	VerticalAxis（src/world/VerticalAxis.ts，单位 WorldMeter，正方向向上）；Protagonist 新增 vertical 和 verticalSpeed

账本边界	跳跃不写账本，不产生 Trace，不授予任何权限

验收	新增 AC-30；阶段 1 完成条件修订为 AC-01 \~ 30 全部通过



领域	冻结的新增/修订名称

跳跃意图	Jump 修订为“每帧检测空格按住状态，按住时该帧提交一个无载荷 Jump”；空中请求不缓存；落地帧若有有效请求则立即重新起跳

垂直推进	tickVertical 由 DirectorSession.submitFrameIntents 调用；每帧只推进一次；执行顺序冻结为：汇总有效意图 → 已落地时处理 Jump → 推进一次垂直物理 → 落地且有 Jump 则重新起跳 → 表现层读取

紧贴地面	限定为逻辑落地判定的数值容差（本批不冻结容差名称或数值）；从画面或节点位置判断视为违规

AC-30 修订	按 VERDICT-107 第 7 条新条文；旧实测证据不能直接证明修订后通过，需补测

拖尾	3D 跟随：currentPos 读 vertical，distanceMoved 加 Y 分量，跳跃期间继续显示



类别	追认名

枚举	VisibilityTransitionReason（Trigger / Recall / CacheWarm / Forget）

trace 域	ElementEntitySeed、ElementEntityPosition、isRevealed、applyVisibility、getElementType、getVisibilityState

director 域	bindVisibilityTrackedEntities、updateElementVisibility

表现层	bindCamera、bindIntentPort

内部占位常量	GROUND\_TOLERANCE\_WM = 0.05、TRIGGER\_DISTANCE\_WM = 2、FORGET\_DISTANCE\_WM = 5



AC-10 状态	分项记录：Triggered 可见 Concealed 实体 ✅ 通过；Normal 低饱和 ⏳ 待补验；AC-10 整体为“待补验”，必须在阶段 1 完成前补齐

表现实现	PerceptionFilter 可用低饱和材质、资源配置或颜色处理实现，不强制后处理/LUT；世界观允许的少量色彩可保留，但必须明确配置

世界运动门控	必须与受限制状态同时交付：T6 若引入禁止转场就 T6 接入，最迟 T7；不批准“停止整个 FrameDriver”；只暂停世界运动部分，意图采集与谱面刷新继续

同域引用	ElementEntity 与 applyTransition 同域引用不违反依赖矩阵；同文件无需拆分；跨文件须补充运行时初始化证据



领域	冻结的新增/修订名称

节奏敲击	RhythmStrike（trace 模块）；RHYTHM\_STRIKE\_WINDOW\_MS = 100；TraceProximityVolume

深痕触发	DeepTraceRevealSequence（presentation）；ScreenInvertRipple（presentation）；ExposurePulse（可选表现）

谱面入口	深痕触发序列结束后自动切换至谱面场景；接入 VERDICT-111 世界运动门控

深痕身份	TraceTier = Deep，但触发前与普通痕无视觉区别；TraceTier 不替代 ElementType

解谜链	两步链：第一步“接近+屏幕投影进入敲击区”→ PuzzleProgress 推进；第二步 RhythmStrike ±100ms → 终点；中间不写账本，终点恰好一条



领域	冻结的新增/修订名称

键位修订	数字键 0\~9（主键盘 + 小键盘，物理键识别，不依赖 NumLock）= Strike；Tab = 往返切换感知模式；撤销鼠标左键 Strike、DIGIT\_1 / DIGIT\_2 切模式、NumLock 方案

持续期	7 秒（非 7 拍）正式冻结；持续区间 \[首次命中时刻, 首次命中时刻 + 7000ms)；requiredSustainedMs = 7000 留 PuzzleChain 内部

拍点时钟	采用"拍点时钟对齐实际音频输出时间线"口径；优先 getOutputTimestamp()；新增 beatClockOffsetMs（默认 0，加到输出对齐后的拍点时钟上）；不新增 AudioLatencyCompensation / BeatClockOffset 类型

临时插桩	\[ChainDebug] / \[RevealDebug] / \[StrikeDebug] 在阶段 1 完成前删除；若与 T7 同时收口，必须在该次收口前删除


## 名库 v2.5 附录 · VERDICT-121~126 完整词表

### VERDICT-121 键盘打击垫
- KeyboardPadLayout（layoutVersion、slots；归属 chart）
- KeyPadSlot（keyId、padKind、u、v、width、height）
- ChartKeyId（键位白名单规范标识）
- ChartPadKind（Regular / Drum / Heavy）
- 键位白名单：
  - KeyA ~ KeyZ → Regular
  - Backquote, Minus, Equal, BracketLeft, BracketRight, Backslash, Semicolon, Quote, Comma, Period, Slash → Regular
  - Digit0 ~ Digit9 → Drum
  - Space → Heavy
  - Shift 不产生额外槽位；同一物理键大小写/上下档共享槽位
  - Numpad0 ~ Numpad9 规范化为 Digit0 ~ Digit9（同编号鼓槽的兼容输入）

### VERDICT-122 Strike 载荷
- Strike：保留 videoTimeMs，新增可选 keyId（ChartKeyId）
- 不增加 padSlot 载荷
- 谱面消费时 keyId 必需；世界探索时可选

### VERDICT-123 Note 与判定
- Note：最小成员 timeMs、keyId
- 判定：时间有效 + 槽位匹配
- Perfect：绝对偏差 ≤ PERFECT_WINDOW_MS（100ms）
- Good：> Perfect 且 ≤ GOOD_WINDOW_MS（200ms）
- Miss：超出 Good 窗口未命中
- 一次按下最多消费一条 Note

### VERDICT-124 上下文覆盖
- 谱面 Playing / Paused 期间：
  - W/A/S/D → Regular 打击垫
  - 数字键 → Drum 打击垫
  - Space → Heavy 打击垫
  - Tab → 不切换感知模式
  - ESC → 暂停切换
- 世界探索期间：原键位不变（WASD 移动、数字键 RhythmStrike、Space Jump、Tab 感知模式）
- 门控必须在 Move / Jump / 物理推进前检查

### VERDICT-125 暂停与恢复
- ToggleChartPause（videoTimeMs）
- ChartPlaybackState（Ready / Playing / Paused / Completed / Exited）
- 暂停冻结媒体位置、判定窗口、演奏进度
- 恢复重建音频输出时间映射（VERDICT-120）
- 暂停不写账本；主动退出执行 AC-21

### VERDICT-126 HANDOFF 修订
- 撤销"指针定位 + 数字键 Strike"建议
- 新增子任务 7（键盘打击垫输入层）、子任务 8（暂停与恢复）
- 坐标算法保留用于布局绘制、分辨率适配、像素定位

### T7 已冻结的其他名称（承接 v2.4 及之前）
- ChartRef（constants）、ChartTier（Regular / Character / World / Final）
- ChartPremiere、ChartReplay、ChartSnapshot、ChartScore
- ChartPlaybackState、ToggleChartPause
- KeyboardPadLayout、KeyPadSlot、ChartKeyId、ChartPadKind
- ScreenInvertRipple、DeepTraceRevealSequence、ExposurePulse
- RhythmStrike、RHYTHM_STRIKE_WINDOW_MS、TraceProximityVolume
- PuzzleChain、PuzzleProgress、PuzzleChainStage
- AudioOutputClock（承载 VERDICT-120 时钟对齐）
- beatClockOffsetMs、bindBeatClockProbe、beatClockProbe
- CHART_BASE_SCORE、CHART_TRANSPARENCY_BONUS_MAX
- PAD_LAYOUT_VERSION、createDefaultKeyboardPadLayout

### 修复批次追认（GPT 修复批次）
- AudioOutputClock（及全部私有成员）
- getLedgerEvents、evaluatePuzzleApproach
- nextBeatTimeMs、resetSustained、beatIntervalMs
- worldStrikeResetter、chartContextProvider、bindChartContextProvider、worldMotionProvider、bindWorldMotionProvider、clearHeldInput、bindWorldStrikeResetter
- rows、rowHeight、row、a、b（布局计算局部变量）
- 其余 84 项私有成员与局部变量，见 quality-review/新增命名清单.md

## 名库 v2.6 附录 · VERDICT-127~135 引导线玩法层

### 引导线结构
- GuidanceChart（chart）：独立引导线谱面数据；成员 schemaVersion、chartId、tier、layoutVersion、aspectRatio、lines
- GuidanceLine（chart）：一条独立生成、启动及运行的引导线；成员 id、head、path、speed、nodes
- GuidanceNode（chart）：Tap / Drag / Hold 的判别联合类型，不要求实现继承式基类
- HeadNode（chart）：空格启动入口，不参与网格取键；成员 id、spawnTimeMs
- TapNode（chart）：动态取键节点；成员 id、kind=Tap、pathDistance；keyId 禁止出现
- DragNode（chart）：独立绑定按键、经过时检查按住状态；成员 id、kind=Drag、pathDistance、keyId（禁止 Space）
- HoldNode（chart）：固定起点键、持续按住到尾端；成员 id、kind=Hold、pathDistance、endPathDistance、keyId（禁止 Space）
- ChartNodeKind（chart）：取值 Tap / Drag / Hold；不含 Head
- NodePath（chart）：可计算位置与弧长的路径数据；首版仅 Polyline，points 数组
- JudgmentPoint（chart）：判定点的逻辑位置与进度
- LineEraseEffect（presentation）：根据逻辑进度擦除线段的视觉效果
- resolveGridKeyAt（chart）：根据归一化坐标查询网格键，返回 Exclude<ChartKeyId, 'Space'> | null
- HEAD_WINDOW_MS（constants）：头节点启动窗口，值 1000

### 数据约束（冻结）
- points[0] 是头节点位置；普通节点位置由 pathDistance 查询得出
- nodes 按 pathDistance 升序排列；每个节点及引导线均有稳定唯一 ID
- 路径至少包含两个不同点；速度为有限正数；节点距离必须在路径范围内
- Hold 必须满足 endPathDistance > pathDistance
- 折线内部转折点必须对应 Tap 或 Hold 起点；Drag 不得单独构成转折
- 首版只接收 Polyline；未来贝塞尔路径通过版本化扩展 NodePath
- 移动采用弧长匀速，不采用各段等时间插值
- 段长公式：段长 = √((Δu × aspectRatio)² + Δv²)
- 目标时间 = startedAtMs + pathDistance / speed × 1000
- 分辨率变化不改变路径距离、速度或判定时间

### Tap 动态取键（冻结）
- Tap 不允许默认键、备用键或节点自带判定键
- Tap 判定时使用当前 JudgmentPoint 在输入时间戳对应的位置查询网格
- 网格边界使用确定性半开区间；共享边界只归属一格
- 间隙、布局外及 Space 区域返回 null，不得采用最近键兜底
- Tap 命中必须同时满足：未判定 + 输入在窗口内 + 查询有效 + 输入键与查询一致

### 头节点（冻结）
- HEAD_WINDOW_MS = 1000，独立于普通节点窗口
- 有效区间：spawnTimeMs ≤ 输入时间 ≤ spawnTimeMs + HEAD_WINDOW_MS
- 仅新的 Space 按下边沿可启动；生成前已按住 Space 不算启动；长按重复不算
- 成功后头节点立即失去输入资格
- 超时后该线终止且不可复活，所属未决节点各记一次 Miss
- 头节点本身只负责启动，不单独计分

### 节点判定（冻结）
- Tap：按下边沿；时间窗内按下当时动态解析出的网格键
- Drag：按住状态；判定点到达该节点时独立绑定键处于按下状态
- Hold：判定点到达起点时起点键须已按下，随后持续按住至尾端；无需随路径切换键位
- Tap 沿用 Perfect / Good / Miss；Drag / Hold 首版成功记 Perfect、失败记 Miss
- 必须采集带时间戳的按下/松开边沿；Drag 不能只检查渲染帧的键状态
- 单次输入最多消费一个普通节点；多候选按时间差、目标时间、引导线 ID、节点 ID 排序
- 多个头节点同时等待时，一次 Space 也只启动一条，按生成时间及 ID 排序

### 擦除边界（冻结）
- LineEraseEffect 属 presentation；逻辑仅提供路径进度 s
- 视觉擦除范围为路径起点到判定点当前位置；默认不保留额外尾迹
- 不新增"已消耗区域"玩法概念
- 线已擦除不妨碍尚在有效时间窗内的 Tap 判定
- 对重叠、交织的线分别按各自路径进度擦除

### 与现有 T7 模块的关系（冻结）
- ChartPremiere：扩展，保留公共生命周期、结果接口及 R26 完成条件
- ChartScore：扩展复用，保留既有分数与透明度加成；按节点最终判定计分；Head 不单独计分；Hold 不按帧计分
- ChartPlaybackState：保持不变
- ChartPadView：保留并扩展显示接线；轨迹、节点、判定点与擦除在独立表现组件中实现
- AudioOutputClock：复用，继续提供媒体时间、结束及异常状态
- KeyboardPadLayout / KeyPadSlot：数据结构保持不变，在 chart 增加纯函数 resolveGridKeyAt
- ChartKeyId / ChartPadKind：保持不变
- ChartData / Note：保留兼容，新增独立 GuidanceChart
### 名库 v2.7 附录 · A 步引导线实现追认

- GuidancePosition
- parseGuidanceChart
- measurePathLength
- positionAtPathDistance
- GuidanceLineRuntime
- GuidanceLineState
- GuidanceJudgement
- GuidanceNodeSnapshot
- GuidanceLineSnapshot
- getGuidanceSnapshot
- bindHeadLogo / bindHeadPosition / bindContentSize / clearVisuals
- bindChartMediaProbe
- UseGuidanceChart
- phase / Down / Up
- schemaVersion = 1（GuidanceChart 独立格式版本）

私有成员、局部变量、状态字面、资源 ID 详见 quality-review/guidance-a/logic-names.json、presentation-names.json、integration-names.json，一并追认。

## 名库 v2.8 附录 · B 步引导线混合节点实现追认

### 公开接口
- slicePathByDistance：按起止距离截取路径折线
- getTotalNodeCount：返回引导线全部节点总数
- releaseWhilePaused：暂停时释放已按住输入并锁定 Hold 失败

### 状态字段
- disappearAtMs：Hold 起点开始消失动画的时间
- holdActive：Hold 起点当前是否处于持续区间
- holdRemainingPoints：Hold 从当前位置到尾端剩余折线

### 内部承载
- GuidanceNodeStatus：节点运行时状态
- GuidanceArrival：节点到达事件
- advanceTimeline：按时间推进节点判定
- holdStarted / holdInterrupted：Hold 起点状态标志
- drawHoldRange：Hold 长条绘制

### 资源 ID
- guidance-b-1、line-b-1、head-b-1、drag-b-1、hold-b-1、tap-b-corner、tap-b-end

### 其他
- 全部解析器词形、表现词形、私有成员、局部变量，见 quality-review/guidance-b/新增命名清单.json、parser-names.json、presentation-names.json，一并追认。

## 名库 v2.9 附录 · C 步多线实现追认

### 冻结名（PROTOCOL 正式）
- GuidanceChartRuntime（chart）：多线协调、Tap/Head 仲裁、边沿与生命周期广播、结算汇总
- getGuidanceSnapshots（chart 只读接口）：返回冻结的所有线快照数组；旧 ChartData 返回空数组

### 公开技术追认
- getTapCandidate：单线只读 Tap 仲裁候选
- allowTap / allowHead：多线协调器向单线广播的边沿消费资格，默认 true 保留单线兼容
- lineId：GuidanceLineRuntime 可选构造参数，指定独立运行的线
- headPosition：GuidanceLineSnapshot 的冻结路径首点，Head 动画不随路径进度移动
- headSprites：每条线的独立 Head Sprite 映射

### 数据结构追认
- GuidanceChart.schemaVersion：类型为 `1 | 2`；v1 恰一条线；v2 至少一条、无硬上限
- GuidanceLine：id / head / path / speed / nodes 不变
- HeadNode / TapNode / DragNode / HoldNode：字段不变
- 节点按弧长与 ID 规范排序；ID 全谱面唯一；输入复制后深冻结

### 输入路由追认
- 单消费仅限制 Tap。新非 Space Down 按时间差 → 目标时间 → 线 ID → 节点 ID 最多命中一个 Tap
- 新 Space Down 按生成时间 → 线 ID → Head ID 最多启动一条
- 物理按住状态向所有线广播；Drag 到达、Hold 起点/尾端独立检查，可共享同一按住键同时成功
- Up 全线广播；保留 B 步：Hold 尾端同刻 Up 有效、Drag 到达同刻 Up 无效、暂停释放锁定 Hold 中断
- 保留工程已实施的目标本键及第一层直接接触邻键容错

### 完成条件追认
- 所有线全部普通节点有最终 Perfect/Good/Miss 且媒体结束才 Completed
- 超时线全部已决，满足该线结算要求
- 保留 R26/A/B 媒体异常不可用的独立超时兜底，暂停不积累该超时
- Head 不计分
- 完成与退出仍经 director 唯一写账本；独立线完成不写账本

### 资源 ID
- guidance-c-1、line-c-a、line-c-b、head-c-a、head-c-b、line-c-a-conflict、line-c-b-conflict、drag-c-a-1、drag-c-b-1、hold-c-a-1、hold-c-b-1、tap-c-a-corner、tap-c-a-end、tap-c-b-corner、tap-c-b-end

### 其他
- 解析器词形（rawLine / required）、协调器词形（heads / taps）、表现层词形（snapshots），见 quality-review/guidance-c/新增命名清单.json，一并追认。

## 名库 v3.0 附录 · 引导线编辑器（VERDICT-147 ~ 157）

### 领域类型（16 个）
- NoteColor（editor）：sRGB uint8 的 r/g/b 三通道，不关联 TrailColor
- MidiNoteEvent（editor）：已换算媒体绝对毫秒、位置及颜色的源事件，禁用单字 Event
- ChartSourceData（editor）：schema 1 的上游版本化源快照，provenance 为 Mock / Midi
- GuidanceVisualData（editor）：schema 1 颜色伴随 JSON，只含 chartId 和节点颜色关联
- EditorSelection（editor）：源事件节点类型 / Head / Hold 尾端选择
- EditorHistory（editor）：有界选择修订链及 cursor，独立于玩法账本
- GuidanceEditorDocument（editor）：schema 1 可恢复草稿，包含源、选择、历史、媒体引用
- GuidanceEditorSession（editor）：草稿控制器与隔离预览协调者
- GuidanceEditorReader（editor）：表现层可持有的只读接口
- GuidanceEditorIntent（editor）：编辑、导入、预览生命周期意图联合
- GuidanceEditorPort（editor）：仅提交编辑意图的接口
- TimedGuidanceLine（chart）：v3 无 speed、具有绝对时间表的线；旧 GuidanceLine 保留
- GuidanceNodeTiming（chart）：普通节点 targetTimeMs，Hold 专有 endTargetTimeMs
- GuidanceTimeAnchor（chart）：pathDistance / targetTimeMs 的分段插值锚点
- GuidanceEditorView（presentation）：游戏内 Cocos 浏览器编辑器 UI
- GuidanceEditorBuilder（assets/scripts）：独立编辑器模式组合根

### 公开函数 / 接口成员
- parseNoteColor、parseChartSourceData、parseGuidanceVisualData、getLineTimeAnchors、guidanceDistanceAtTime、guidanceNodeTime、getDocument、getPreview、getPreviewData、getLayout、exportChart、submitEditorIntent、bindEditor、bindNodeColors
- 已存在方法名如 getLayout 若在其他域同名，不表示修改原职责；本附录限定接收者 GuidanceEditorReader / GuidanceEditorSession。getPreviewData 是 chart/visual 只读文件数据，不暴露 preview 的写方法；getPreview 返回 ChartPremiereReader

### 新增字段
- sourceId、sourceRevision、provenance、mappingVersion、mediaDurationMs、trackId、lineId、timeMs、position、color、pitch、drumType、velocity、endTimeMs、emphasis、documentId、source、selection、history、heads、holdEndEventId、entries、before、after、cursor、media、videoPath、audioPath、timing、nodeId、targetTimeMs、endTargetTimeMs。其他同名既有字段复用，不改原语义

### 意图判别值
- LoadSource、LoadDraft、LoadPreview、SetKind、SetHead、SetHoldEnd、SetMedia、Undo、Redo、StartPreview、StopPreview、Seek、Advance、Strike、Pause

### 预览模式
- Manual / Rehearsal；来源序列化值 Midi，在 UI 显示 MIDI

### 不予追认
- EditorDirectoryHandle：私有平台适配接口，仅用于浏览器目录导出，不是玩法领域实体，不纳入世界名库
- GridPosition：不新增，复用 GuidancePosition
- UndoStack：不新增，统一为 EditorHistory
- EditorDraft：不新增，统一为 GuidanceEditorDocument

本附录由 PROTOCOL 于引导线编辑器阶段正式追认。

已存在的 editor 模块已正式登记于 docs/spec/stage-1.md §3 / §6。第 29 批早期交付报告中的"editor 未登记、两个 E6"是历史状态，已被本轮同步。

## 名库 v3.1 附录 · VERDICT-158~168 世界文件夹与编辑器目录

### 领域名称
- WorldFolderView（presentation）：登录及首次序章后的统一世界文件夹界面
- WorldFolderEntry（presentation）：只读世界入口描述
- WorldFolderReader（presentation）：当前账号与其可进入世界列表的读取面
- InitialWorld（presentation）：唯一初始世界入口常量
- EditorFolderView（presentation）：世界编辑器目录树及可用性反馈
- EditorFolderEntry（presentation）：entryId / title / availability / children
- EditorCatalog（presentation）：getRoot 返回目录根
- FolderStartupView（presentation）：本地登录、简短序章及错误显示
- AccountStartupStorage（presentation）：浏览器本地账号序章完成事实存储适配
- FolderPresentationTheme（presentation）：可替换美术参数；文件 FolderTheme.ts
- AccountStartupSession（director）：零 cc 账号启动编排
- AccountStartupSnapshot（director）：accountId / phase / PrologueCompleted
- AccountStartupIntent（director）：Login / CompletePrologue
- AccountStartupReader（director）：启动快照与序章文本读取面
- AccountStartupPort（director）：submitStartupIntent 意图发送端
- WorldFolderBuilder（assets/scripts）：外层组合根

### 编辑器目录 ID（15 项）
EditorRoot、MusicEditor、RgbWavetableEditor、GridEditor、MidiTrackEditor、MapEditor、NarrativeEventEditor、StoryEditor、PasserbyEditor、SubtitleEditor、ChartEditor、GuidanceEditor、VideoTimingEditor、PositionEditor、SpecialNarrativeEventEditor

### 判别值
- availability：Folder / Implemented / Placeholder
- phase：Login / Prologue / WorldFolder
- AccountStartupIntent.kind：Login / CompletePrologue

### 正式修订
- VERDICT-062 第 3 条：启动流程修订为 登录 → ShorePrologue（首次一次）→ WorldFolderView
- VERDICT-068 第 2 条：ShoreHub 不再是默认启动入口，未来功能入口另议
- ShoreHub / ShoreHubState / AccessCode 保留，不删除
- AccountMilestone.PrologueCompleted 复用，不扩展全量 schema

### 存储保留字
- 本地完成事实保存键：`neurou-account-milestone-v1:` 加 encodeURIComponent(accountId)
- 值为 `{ PrologueCompleted: true }`（浏览器开发投影，不是正式跨设备存档）

### 其他
- 全部字段、公开成员、私有词形见 quality-review/world-folder/新增命名清单.md 与 new-names.json，一并追认。

## 名库 v3.2 附录 · 判定窗口修订（2026-10-10）

### 正式修订
- VERDICT-113 第 2 条：`RHYTHM_STRIKE_WINDOW_MS` 从 50 → 100。目标拍点前后各 100ms，绝对偏差 ≤100ms 成功，含端点。
- VERDICT-123 第 5 条：`PERFECT_WINDOW_MS` 从 50 → 100；`GOOD_WINDOW_MS` 从 120 → 200。
  - Perfect：绝对偏差 ≤100ms
  - Good：100ms < 绝对偏差 ≤200ms
  - Miss：> 200ms
- VERDICT-093 同步不变式保留：SYNC_TOLERANCE_MS（30）< PERFECT_WINDOW_MS（100）✅

### 不变范围
- Head 窗口保持 `HEAD_WINDOW_MS = 1000`，未改。
- T6 不新增 Good 档。
- Drag / Hold 判定规则不变（到达时按住状态；无新增 Good 时间窗）。
- 7 秒半开持续区间、终点拍点排除规则不变。
- 判定逻辑本身不变，只改常量值。

### 历史记录保留
- 旧 T0 同步验证记录（100ms 合格线）保留原样，不作为当前 SYNC_TOLERANCE_MS 值。
- 旧批次验收记录不回写。

## 名库 v3.3 附录 · VERDICT-180~190 音频编辑器最小交付

### 模块
- musicEditor：独立音乐创作纯逻辑模块，零 cc

### 领域类型
- MusicProjectData（schema1 音乐工程；不是引导线输入）
- TrackDefinition / NoteDefinition（音轨及音符定义）
- TempoPoint / MusicTimeSignature（tempo 分段点与拍号；PPQ 基准是四分音符）
- MusicEditorDocument / MusicEditorHistory（含版本、工程快照、revision 和 100 项有界撤销历史）
- MusicEditorSession（草稿唯一状态维护者）
- MusicEditorReader / MusicEditorPort / MusicEditorIntent（只读面、意图提交端、用户操作联合）
- ChartSourceBuilder / buildChartSource（音乐工程→冻结 ChartSourceData 的转换层/函数）
- MusicPlaybackNote（换算为绝对毫秒的只读音符试听信息）
- MusicEditorView / MusicPreviewAudio（presentation 音乐工作区/简易离线 PCM 试听适配）
- MusicEditorBuilder（音乐与引导线会话的独立组合根）

### 公开纯函数
- buildChartSource、parseMusicProjectData、createDefaultMusicProject、parseMusicEditorDocument、tickToTimeMs、timeMsToTick、musicProjectDurationMs、musicMeasureTicks、midiPitchToFrequency

### 意图判别值
- MusicEditorIntent.kind：LoadProject / LoadDraft / AddNote / ChangeNote / DeleteNote / SetTempo / Undo / Redo

### 预留不实现
- WavetableDefinition / GridDefinition：后续音色/网格创作定义的预留提案；本批不建立类型/schema/实现

### 复用
- ChartSourceData / MidiNoteEvent / NoteColor / GuidancePosition / KeyboardPadLayout / FolderPresentationTheme
- 不新增裸 Event、GridPosition、音轨版 WorldMeter 或 TrailColor 映射

### 字段与范围
- MusicProjectData：schemaVersion=1、projectId、title、ppq、tempoMap、timeSignature、durationTicks、layoutVersion、aspectRatio、mappingVersion、tracks
- TrackDefinition：id、title、lineId、offsetMs、color、notes
- NoteDefinition：id、tick、durationTicks、pitch、velocity、position（复用 GuidancePosition）、color（复用 NoteColor）
- TempoPoint：tick、bpm；首项 tick=0，时点唯一
- MusicTimeSignature：numerator、denominator（1/2/4/8/16/32）
- tick 为安全整数；ppq=1~32767；工程时长 ≤ PPQ×4096；BPM=20~320；pitch/velocity=0~127；position 为 0~1 无量纲 UV

### 目录可用性更新
- MusicEditor：从 Placeholder 升为 Folder
- MidiTrackEditor：从 Placeholder 升为 Implemented
- RGB波表编辑器 / 网格编辑器：继续 Placeholder

## 名库 v3.4 附录 · VERDICT-191~195 音乐编辑器批量操作

### 新意图判别值
- MusicEditorIntent.kind 新增：DeleteNotes / MoveNotes / PasteNotes
- MusicEditorHistory.entry.label 扩展同上三个值

### 新字段
- DeleteNotes：noteIds（只读、安全、唯一、已有 ID 数组）
- MoveNotes：noteIds + deltaTick（安全整数时间增量）+ deltaPitch（安全整数半音增量）
- PasteNotes：trackId + notes（NoteDefinition 数组）

### UI 私有状态（不进 schema1）
- selectedNoteIds（Set，全项目多选）
- anchorNoteId（范围选择锚点）
- clipboard（UI 内存，不用系统剪贴板）
- pointerGesture / pointerPosition / marqueeWidth / marqueeHeight

### 批量操作边界
- 一个成功批量操作只递增一次 revision、生成一项同名历史事务，Undo/Redo 整组恢复。
- 移动整组一旦有成员越界或产生负媒体时间，全部拒绝；不自动延长工程、不逐个夹取、不丢弃非法成员。
- 粘贴跨轨内容 flatten 到当前选中轨道；新 ID 由 UI 产生并由逻辑验证全项目唯一性。
- 选择/anchor/剪贴板/手势不进草稿历史；恢复工程或草稿清选择。

### 旧程序兼容性
- 新历史 label 可由当前版恢复；旧程序不保证加载新历史草稿。

### 其他
- 114 项 AST 新增实现声明，见 quality-review/music-editor-operations/新增命名清单.md，一并追认。

---

## 名库 v3.5 附录 · VERDICT-196~200 B1 谱面接入游戏入口

### 新增命名
- ChartResourcePath（assets/scripts/SceneBuilder · Inspector 配置字段）：无扩展名的 Cocos resources 相对谱面路径；默认 chart/guidance_c。不能作为 chartId、文件系统绝对路径或世界身份。
- chartResourcePath（SceneBuilder.start · 局部变量）：本次资源加载使用的路径快照。
- showChartLoadError（SceneBuilder · 私有方法）：主谱面资源边界失败时创建可读错误信息，保持拒绝加载和返回世界的原入口行为。
- bindNodeColors（ChartPadView · 表现接线方法扩展）：接收已校验的 GuidanceVisualData.nodes。
- nodeColors（ChartPadView · 私有表现状态扩展）：缓存可选伴随颜色。

### 明确不新增
- ChartRegistry / ChartCatalog / ChartResourceLoader / EditorExportTarget 均不引入。

### 延用既有名称
- GuidanceVisualData、parseGuidanceVisualData、parseGuidanceChart、ChartPremiere、ChartRef、NarrativeEvent、UseGuidanceChart。

### 语义要点
- 游戏资源身份由 JSON 的 chartId 决定；资源路径只用于定位。
- 颜色文件按所选资源路径的 .visual 后缀寻址，再按 chartId / nodeId 配对校验。
- RGB 仅表现，不进入 GuidanceChart、判定、得分或账本。

### 阶段 2 候选（未登记为已实施）
- 世界文件夹中的谱面列表
- 多媒体资源配置
- 显式导出目标管理

---

## 名库 v3.6 附录 · VERDICT-201~210 B2.1 本地多世界

### 领域类型
- WorldFolderRecord（director / WorldFolderSession）：目录元数据记录，readonly worldId / title / description / createdAt / deletedAt / template
- WorldFolderSnapshot（director）：schemaVersion=1 / accountId / records
- WorldFolderIntent（director）：CreateWorld / DeleteWorld / WorldFork（WorldFork 复用冻结名，仅作未开放意图）
- WorldFolderPort（director）：submitWorldFolderIntent
- WorldFolderSession（director）：目录决策、严格校验、初次默认项、创建、墓碑、先保存后发布，零 cc
- WorldLocalStorage（presentation）：浏览器按账号隔离的 JSON 目录适配
- MinimalWorldBuilder（assets/scripts 组合根）：最小箱庭装配，复用原移动/跳跃

### 意图判别值
- CreateWorld：新建 EmptyWorld 元数据 + 独立最小箱庭入口
- DeleteWorld：只新增目录墓碑
- WorldFork：复用冻结名，本批只作未开放意图

### 模板判别值
- EmptyWorld：目录 template 判别值，不是 WorldKind 新增值
- InitialWorld：复用冻结名

### 方法/成员
- submitWorldFolderIntent、getWorldRecord、getSnapshot（Session）
- readSnapshot、saveSnapshot（WorldLocalStorage）
- bindEntry（MinimalWorldBuilder）
- refresh、showStatus（WorldFolderView）
- loadFolderSession（WorldFolderBuilder 私有装配方法）

### 存储 key
- neurou-world-folder-v1: + encodeURIComponent(accountId)

### DOM ID（presentation 选择器）
- create-world、world-create-form、world-title、world-description、confirm-create-world、cancel-create-world、world-delete-confirm、world-delete-title、world-delete-message、confirm-delete-world、cancel-delete-world、refresh-worlds、world-folder-status、minimal-world-info

### data-action 值
- open-world、delete-world、fork-world

### 明确不新增
- WorldRegistry / DuplicateWorld / CopyPermission / FirstWorldCleared / WorldClearRecord（B2.2 或更后）

### 其他
- 181 项私有/局部声明，见 quality-review/b2-local-worlds/新增命名清单.json，一并追认。

---

## 名库 v3.7 附录 · VERDICT-211~225 B2.2 账号里程碑与状态契约

### 领域类型
- AccountMilestoneStorage（presentation）：FirstWorldCleared 本地投影的平台适配
- AccountMilestoneProjection（director 契约）：schemaVersion / accountId / FirstWorldCleared，不含 CopyPermission
- AccountMilestoneSnapshot（director 契约）：只读账号投影结果，包含派生 CopyPermission
- AccountMilestoneReader（director 契约）：只读 getMilestoneSnapshot()
- WorldStateSession（director）：七项跨域聚合及完整性/恢复事务协调
- WorldStateSnapshot（director 契约）：完整验证通过的七项世界状态投影；不是 FileCarryPayload
- WorldStateCaptureResult（director 契约）：Complete 携带完整快照；Incomplete 携带部分及缺失诊断
- WorldStateRestoreResult（director 契约）：恢复成功/明确拒绝/校验失败
- WorldStateDiagnostic（director 契约）：缺少权威载体、机制、身份或保存边界的原因
- WorldStateReader（director 契约）：读取状态完整性与操作结果
- WorldStateStorage（presentation）：按账号与世界隔离的本地完整状态平台适配
- WorldForkAvailability（director 读取契约）：产品实现状态；B2.2 固定为 NotImplemented

### 公开方法
- captureWorldState / restoreWorldState（WorldStateSession）
- getMilestoneSnapshot（AccountMilestoneReader）
- readProjection / saveProjection（AccountMilestoneStorage）
- getLastCaptureResult（WorldStateReader）
- readSnapshot / saveSnapshot（WorldStateStorage）

### 实施直译名（由 PROTOCOL 于 B2.2c 阶段追认）
- createAccountMilestoneReader（director / AccountMilestone.ts）
- validateWorldStateHeader（director / WorldStateSession.ts）

### 判别值
- WorldStateCaptureResult.kind：Complete / Incomplete
- WorldStateRestoreResult.kind：Restored / Rejected
- WorldForkAvailability：NotImplemented（B2.2 固定）
- WorldStateDiagnostic.section：Ledger / PuzzleProgress / RecallCount / FormatTime / WorldLink / ChartSnapshot / ChartScore / RuntimeBoundary
- WorldStateDiagnostic.reason：MechanismMissing / ProjectionUndefined / AuthorityUnavailable / IdentityUnavailable / RestoreUnsupported / UnsupportedBoundary / InvalidSnapshot / SchemaUnsupported / IdentityMismatch / ReferenceMismatch / StaleRevision

### 存储 key
- 既有序章（保留）：neurou-account-milestone-v1:<encodeURIComponent(accountId)>
- 新增首次通关投影：neurou-account-first-world-cleared-v1:<encodeURIComponent(accountId)>
- 既有目录（保留）：neurou-world-folder-v1:<encodeURIComponent(accountId)>
- 新增世界完整状态：neurou-world-state-v1:<encodeURIComponent(accountId)>:<encodeURIComponent(worldId)>

### 七项归属表
- Ledger：WorldInstance 的观察者个人层；accountId / worldId / characterId；每角色 append-only
- PuzzleProgress：世界观察者个人层；chainId
- RecallCount：世界观察者个人层；characterId + NarrativeEventId
- FormatTime：世界自身 immutable 创建现实时间；Shore 自有，分叉继承
- WorldLink：BugShore 世界自身的单一来源弱引用；sourceWorldId + LinkState；孤立恢复依赖 AIProfileSnapshot
- ChartSnapshot：世界观察者个人层；ChartRef；Final 属于 FinalShore 个人层
- ChartScore：世界观察者个人层；ChartRef；Final 同上

### 账号层
- AccountMilestone.PrologueCompleted（既有）
- AccountMilestone.FirstWorldCleared（待 B2.2c 真实写入）
- WorldClearRecord / RouteSignature（账号层，不进入 WorldStateSnapshot）
- CopyPermission：账号事实的派生量，不持久化

### 提案结构（提案，B2.2d 再正式冻结）
- FormatTime 最小结构：{ epochMs: number }（提案，B2.2d 再正式冻结）

### 明确不新增（B2.3 或更后）
- WorldRegistry / DuplicateWorld / CrossDeviceDuplicate / WorldMigration / RealityPause / FileCarryPayload / ObserverSync / AuthService / CommitRelay / OfflineGrace / AccessCode 实装

---

## 名库 v3.8 附录 · VERDICT-226~240 B2.2c 真实通关链路

### 沿用/复活的冻结名
- EventSpaceCenter：主角事件空间初始球心，完整 20 维不可变内容配置
- EventDistance：有限、严格正的球面半径
- LedgerPosition：当前 accountId/worldId/protagonistCharacterId 权威账本所有向量累计和
- SphereCrossing：director 业务类，重新实现（archive 不修改）
- ChartEntry：source 扩展为 DeepTrace / SphereCrossing
- WorldBossChart：世界内容清单中唯一 World 级作者谱面
- ChartRef：新增可选 state: Entry / PremiereCompleted
- RouteSignature：完成追加后主角真实累计坐标的不可变快照
- DivergenceAxis：六个 NarrativeDimension 情感成员的联合类型
- WorldClearRecord：Primary 首次合法通关的账号记录

### 新增命名
- WorldGameplayContext（director 契约 / assets/scripts 接线）
- WorldBossChartSource（chart）
- WorldClearSession（director）
- WorldClearStorage（presentation）
- WorldClearProjection（director 契约）
- deriveLedgerPosition（ledger）
- classifyDivergenceAxis（director）
- classifyChartReference（director）
- hasChartPremiereCompleted（director）
- readWorldClearRecords（WorldClearStorage）
- saveWorldClearRecord（WorldClearStorage）

### 最小内容生产者追加命名（VERDICT-240 授权后落地）
- WorldNarrativeContent / WorldNarrativeChoice（director）
- parseWorldNarrativeContent（director）
- WorldClearSnapshot / WorldClearReader（director）
- WorldClearCallbacks（director）
- WorldClearCompletionStatus（director）：NotCleared / Pending / Failed / Completed
- ChartReferenceClassification（director）：Entry / PremiereCompleted / Unclassified
- validateNarrativeVector（ledger）
- deriveRouteSignature / validateWorldClearRecord / validateWorldClearProjection（director）
- WorldClearAccountLock（presentation）
- commitRecord / reconcileAccount（WorldClearStorage）
- WorldClearView / WorldChartView（presentation）
- ChooseWorldNarrative / EnterWorldChart / RetryWorldClear（PlayerIntent.kind）
- bindLedgerSource（DirectorSession）

### 追加存储 key 与 ID 格式
- 账号提交锁名：neurou-world-clear:<encodeURIComponent(accountId)>
- 完成事件 ID：WORLD_PREMIERE_COMPLETED:<epochMs>:<sequence>
- 选择事件 ID：WORLD_NARRATIVE_CHOICE:<epochMs>:<sequence>

### 内容结构
- WorldNarrativeContent：schemaVersion=1 / contentId / contentRevision / worldKind='Primary' / protagonistCharacterId / EventSpaceCenter / EventDistance / source{author,version,description} / interaction{title,prompt,choices} / worldBossChartSource
- WorldNarrativeChoice：choiceId / label / meaning / 完整 vector

### 结构
- ChartEntry：entryId / worldId / characterId / ChartRef / tier / source
- ChartRef.state：Entry / PremiereCompleted
- 只读引用分类：Entry / PremiereCompleted / Unclassified
- RouteSignature：VectorSchemaVersion=1 / ledgerPosition / classificationVersion=1 / divergenceAxis / narrativeTime
- WorldClearRecord：schemaVersion=1 / accountId / worldId / worldKind='Primary' / protagonistCharacterId / ChartRef / contentRevision / completionEventId / clearedAt / routeSignature
- WorldClearProjection：schemaVersion=1 / accountId / records

### 存储 key
- neurou-account-world-clears-v1:<encodeURIComponent(accountId)>

### 6 个 DivergenceAxis
NarrativeDimension.Red / Green / Blue / Black / White / Grey
（旧 .Understanding / .Empathy 不映射为颜色、不复活）

### 分类算法
- 正最大值严格为正时选最大者
- 正并列按 Red → Green → Blue → Black → White → Grey 选首项
- 六情感全零、其余维非零 → divergenceAxis=null
- 完整零向量 → 不生成合法通关路线

### 修订
- VERDICT-030 精确为"账本存在合法首演完成引用"，T6 Entry 保留
- 旧 T6/T7 只读兼容、不回写

### 保持
- FirstWorldCleared / CopyPermission 核心
- 七项 WorldState 契约
- WorldForkAvailability=NotImplemented
- 完整 20 维感绪系统（阶段 4）

### 明确不新增
- WorldFork / FileCarryPayload / WorldRegistry / 跨设备 / 观察者同步 / 服务 / AccessCode

---

## 名库 v3.9 附录 · VERDICT-241~255 B2.2d-1 完整状态恢复前置（核心机制）

### 新增命名
- LedgerSnapshot（director）：每角色有序账本、正式内容来源与追加防重控制的严格不可变载荷
- LedgerHydration / LedgerHydrateResult（director）：无副作用 validate/hydrate；Hydrated 仅表示 Ledger section 校验成功，不是 WorldState 完整恢复
- validateLedgerNarrativeEvent（director）：20 维、版本、来源、时间、引用的完整不可变事件克隆
- PuzzleChainPrivateState / validatePuzzleChainPrivateState（trace）：完整阶段和私有计时快照及规则/稳定边界验证
- PuzzleProgressSnapshot / PuzzleControlState（director）：链身份、规则和 ChartRef 关联、终点/深痕/首演防重、入口及揭示终态
- validatePuzzleProgressSnapshot / validatePuzzleControlState（director）：严格私有状态校验与权威账本关联校验
- WorldCoreStateSnapshot（director）：kind='Core'、三个可用/不可用 section 的部分世界文档，永不等同完整 WorldStateSnapshot
- WorldStateCodec（director）：data-only 深拷贝、身份/头部与 section 验证聚合；通过注入的内容绑定校验器解析
- FormatTimeSnapshot（director）：冻结的现实创建时间值 { readonly epochMs: number }；世界已有 FormatTime 同形冻结
- WorldCoreStateStorage（presentation）：单主 key 原子提交、版本/前缀防回退、世界 lease 与活动目录验证
- FormatTimeStorage（presentation）：Core 的 FormatTime section facade，不另建 key，不读取补值
- WorldStateLock / WorldStateLease（presentation）：平台世界独占锁与运行生命周期 lease；release 延迟到 retainUntil 的提交全部结束
- WorldRuntimeIdentity（assets/scripts）：组合根账号/世界/已获存储 lease，只用于装配，不提供给玩家输入
- WorldCoreStateView（presentation）：账本条数、恢复状态、Puzzle、FormatTime 与 Incomplete 的只读展示

### 新增方法
- LedgerHydration.validate / hydrate
- WorldClearSession.getLedgerSnapshot
- WorldClearCallbacks.persistLedger
- PuzzleChain.capturePrivateState
- DirectorSession.getPuzzleControlState / hydratePuzzleControlState
- DeepTraceRevealSequence.getTerminalPhase / hydrateTerminalPhase
- WorldStateSession.bindCoreSource
- WorldStateCodec.parse
- WorldCoreStateStorage.bindValidator / validateCoreState / readCoreState / readValidatedCoreState / acquireWorldLease / saveCoreState
- WorldStateLease.retainUntil / release
- FormatTimeStorage.readFormatTime / initializeFormatTime
- WorldFolderBuilder.bindRegularChartSource

### 组合根内部辅助名（不构成新增玩家意图或跨域权限接口）
- prepareCoreRuntime / buildWorldRuntime / loadJson / showCoreError / capturePuzzle / saveStableCore / persistCore / initializeCreatedWorld / initializeDirectory / prepareCoreValidator / isWorldActive

### 正式内容索引
- chainId = T6_MAIN_CHAIN
- deepTraceId = T6_MAIN_DEEP_TRACE
- ruleVersion = 1
- Ledger 的角色身份来自 Primary 正式内容；不建立 WorldRegistry 或完整角色系统

### 存储 key
- 世界状态主 key（保持）：neurou-world-state-v1:<encodeURIComponent(accountId)>:<encodeURIComponent(worldId)>
- 世界锁名：neurou-world-state:<encodeURIComponent(accountId)>:<encodeURIComponent(worldId)>
- 没有 neurou-ledger-v1 / neurou-puzzle-progress-v1 / neurou-format-time-v1 新键

### 明确不追认（未采用）
- LedgerStorage / PuzzleProgressStorage
- 额外 LedgerPosition 算法
- 全量 WorldStateCodec complete/hydrate 接口

### 命名告警语义说明
- 当前命名门禁的 Trace 告警指深痕业务，Window 告警指节奏判定窗口，均经人工复核；不是日志或 UI 窗口

---

## 名库 v3.10 附录 · VERDICT-256~270 B2.2d-2 完整状态恢复前置（扩展四项与七项完成）

### 新增公开名称（按归属）
- RecallCountSession / RecallCountSnapshot / RecallCountContext / RecallCountCallbacks / RecallCountHydrateResult / RecallCountOperationResult（director / RecallCountSession.ts）
- AIProviderConfiguration / AIProfile / AIProfileSnapshot / WorldLinkContext / WorldLinkSnapshot / WorldLinkSource / WorldLinkSourceReader / WorldLinkSession / validateWorldLinkSnapshot / validateAIProfile（director / WorldLinkSession.ts）
- ChartArchive / ChartArchiveContext / ChartMediaIdentity / ChartVisualSnapshot / ChartContentManifest / ChartSnapshotRecord / ChartSnapshotCollection / ChartScorePlay / ChartScoreRecord / ChartScoreSnapshot / ChartArchiveCandidate / ChartPremiereArchiveInput / ChartReplayArchiveInput / parseChartContentManifest / chartContentDigest（director / ChartArchive.ts）
- ChartReplaySession（director / ChartReplaySession.ts）
- createPrimaryWorldStateCodec（director / PrimaryWorldState.ts）
- isValidatedWorldStateSnapshot（director / WorldStateCodec.ts）
- WorldStatePreparedRestore（director / WorldStateSession.ts）：publish():boolean / discard()，未激活恢复对象图的发布边界
- WorldMemoryView（presentation）：自己的事件/痕回忆、完成旋律选择及成绩只读视图
- ChartReplayView（presentation）：冻结谱面/布局/视觉和真实媒体的重演呈现

### 新增公开方法
- WorldStateCodec.parseComplete、WorldStateSession.bindCompleteSource、WorldStateStorage.bindCompleteWriter、WorldCoreStateStorage.clearDeletedChartState
- RecallCountSession：validate / hydrate / getSnapshot / getCount / recall / replay / bindT6Trace / experienceForeignEvent / chartReplay
- WorldLinkSession：validate / getSnapshot / enterFromSource / refreshSourceState / readEffectiveProfile / canReturnToSource
- ChartArchive：emptySnapshots / emptyScores / validateSnapshots / validateScores / preparePremiere / prepareReplay
- ChartReplaySession：bindMedia / isActive / getReader
- 视图仅 mount / refresh / setVisible / destroy 及重演只读媒体探针，不提供业务写入能力

### 意图扩展（PlayerIntent 新增三种仅含选择 ID 的变体）
- RecallEvent{eventId} / ReplayTrace{traceId} / ReplayChart{completionEventId}
- 不接受向量、NarrativeEvent、计数、成绩、快照、媒体 URL 或权限值
- experienceForeignEvent 没有新增 presentation 意图与正式生产选择入口，本轮只开放 director 合法业务 API 并契约验证
- 本批没有新增 VectorEntry 数据接口/类型；ReplayChart.completionEventId 关联当前主角的权威完成事件，不能把 T6 Entry 当完成

### 数据结构冻结（schemaVersion=1）
- RecallCountSnapshot：records 为 {characterId,eventId,count}；traceBindings 为 {traceId,characterId,eventId}；只接受本批真实原终点绑定，未知/重复/错角色拒绝
- AIProviderConfiguration：CloudProvider{providerId,kind,model,endpoint,credentialRef,systemPrompt} / LocalProvider{providerId,kind,model,modelRevision,systemPrompt} / TemplateProvider{providerId,kind,contentId,contentRevision,templates[{templateId,text}]}
- AIProfile：profileId / revision / providers / taskRoutes[{task,fallbackChain}]；任务 Narrative / Dialogue / RealityHint / OutputValidation；降级以模板结束，私有提示与校验不能走云端
- WorldLinkSnapshot：通用 schemaVersion/accountId/worldId/protagonistCharacterId；Primary/null 与 Shore/FinalShore 为 NotApplicable；Shore/BugShore 为 Linked + sourceWorldId + linkState Bound/Orphaned + aiProfileSnapshot
- ChartMediaIdentity：kind Audio/Video；contentId / contentRevision / resourcePath / sha256 / byteLength；资源为稳定 audio/ 或 video/ 路径，无扩展名与临时 URL
- ChartSnapshotRecord：chartId / ChartRef.state=PremiereCompleted / completionEventId / owner WorldObserver或FinalShorePersonal / frozenAt / chart / layout / visual / media / guideTransparency / contentDigest
- ChartScoreRecord：chartId / ChartRef.state=PremiereCompleted / completionEventId / snapshotDigest / scoringVersion=1 / best / latest / completedPlayCount / completedPlayIds
- ChartSnapshotCollection、ChartScoreSnapshot：schemaVersion=1 / accountId / worldId / protagonistCharacterId / records
- ChartContentManifest：source{author,version,description}；media 为真实媒体身份数组；charts[{chartId,sourceKind Published/LegacyFallback,resourcePath 可为null,sourcePath,contentRevision,chartDigest,visualDigest,mediaContentId}]
- WorldStatePreparedRestore：publish true 才代表实际对象图发布；discard 清理未发布图，不能将失败变成功
- 通用约束：计数、完成次数、时刻、revision 为规定范围内安全整数；布局/向量/分数/透明度必须有限并符合原领域约束；快照与成绩均深克隆冻结，访问器、异原型、稀疏数组、循环、未知字段和错版本拒绝

### 沿用结构的增量
- WorldCoreStateSnapshot.sections 保留 Ledger / PuzzleProgress / FormatTime，并可同组增加 RecallCount / WorldLink / ChartSnapshot / ChartScore 四项；schemaVersion=1、kind=Core 与既有主 key 不变；旧三项仍严格可读；四项不能只出现部分字段
- WorldStateSnapshot 是七项全非空且通过内容绑定引用校验的运行时认证结果，新增编译品牌与不可序列化 WeakSet 认证；存储仍是 Core；Complete 和 Restored 的既有名称保持，只在真正通过认证/发布时可返回
- WorldStateReader.ownership 七项 codec 元数据均 Implemented；旧 NotImplemented 元数据描述更新为"七项已实装但必须逐载体严格校验"；worldForkAvailability 仍固定 NotImplemented
- ChartScore 既有纯计分器名称不改；新增 ChartScoreSnapshot 是持久成绩承载，两者职责不同

### 存储 key
- 沿用 neurou-world-state-v1:<encodeURIComponent(accountId)>:<encodeURIComponent(worldId)> 主 key 与 neurou-world-state:<encodeURIComponent(accountId)>:<encodeURIComponent(worldId)> 锁名；本批没有新增四份 section key；账号记录 key 不变

### 明确不冻结
- B2.3 身份 rebasing、WorldFork、FileCarryPayload 结构

---

## 名库 v3.11 附录 · VERDICT-271~285 B2.3 WorldFork 实装

### 新增公开名称（12 个顶层公开导出，按归属）
- WorldForkOrigin / validateWorldForkOrigin（director / WorldForkOrigin.ts）：目标实例永久且不可补写/改写/删除的分叉来源头；严格身份、时序、结构和继承完成见证校验
- WorldForkPlan / WorldForkBindings / WorldForkSession / rebaseWorldState / validateWorldForkPlan（director / WorldForkSession.ts）
- ForkWorldClearSession（director / ForkWorldClearSession.ts）：扩展旧 WorldClearSession，将继承完成与目标真实新完成分开
- WorldForkStorageBindings / WorldForkCommitResult / WorldForkRecoveryResult / WorldForkStorage（presentation / WorldForkStorage.ts）
- WorldForkOrigin 与 WorldForkPlan 经 IntentPort 的 export type 转发；presentation 不 value-import director 验证器
- 既有 WorldFork 是意图名，不新增 DuplicateWorld、WorldRegistry 或另一分叉意图

### 数据结构
- WorldForkOrigin：schemaVersion=1 / accountId / sourceWorldId / sourceRevision / sourceCapturedAt / targetWorldId / protagonistCharacterId / transactionId / forkedAt / inheritedCompletionEventId:string或null
- WorldForkPlan：schemaVersion=1 / accountId / transactionId / sourceWorldId / targetWorldId / sourceRevision / sourceDigest / targetRecord / targetState
- WorldForkBindings：createWorldId():string / createTransactionId():string / now():number / validateComplete(raw,accountId,worldId):WorldStateSnapshot
- WorldForkStorageBindings：validatePlan / validateFolder / validateSource / assertTargetLease / writeTarget / deleteTargetExpected；所有 void 注入操作同步完成，拒绝 Promise/thenable
- WorldForkCommitResult.Committed：kind=Committed / transactionId / targetWorldId / cleanupPending:boolean / error:string或null；目录发布后清理失败仍为 Committed
- WorldForkCommitResult.Pending：kind=Pending / transactionId / targetWorldId / phase=Rollback / error:string；未发布且回滚尚未完成
- WorldForkRecoveryResult：WorldForkCommitResult 或 {kind:'NoPending'} 或 {kind:'RolledBack',transactionId,targetWorldId}
- WorldForkJournal（非导出，由 readPending 公开读取返回的短期存储结构名）：schemaVersion=1 / kind=PendingWorldFork / accountId / plan:WorldForkPlan；与永久 forkOrigin 不同，成功提交或回滚完成后删除；不是长期世界注册表；未知版本与坏日志不清空、不吞错误
- sourceDigest 为规范 Core 数据的 SHA256，来源版本与摘要在提交时重新验证
- 目标 worldId 使用 world- + 正式 UUID v4，transactionId 由组合根独立工厂产生（当前 fork- + UUID）；业务逻辑不自行调用 UUID 或平台时钟

### 继承身份与首演语义
- 世界 ID 是实例隔离边界；characterId、chainId、traceId、chartId、eventId 为世界内 ID
- 继承事件所有值与次序保持，只有七项载体的 worldId、Core 头、SphereCrossing entry.worldId 与 entryId 重键；入口唯一键沿用 JSON.stringify([accountId,worldId,protagonistCharacterId,'SphereCrossing'])
- FormatTime 的来源 epochMs 保留；目标 Core revision=0 / capturedAt=forkedAt；原 ChartSnapshot / ChartScore records、媒体身份和内容摘要保持；目标对象图独立深冻结，不与源实例共享可变状态
- inheritedCompletionEventId 非 null 表示目标已经继承合法 World 首演事实，必须匹配主角 Ledger.control.completionEventId 和实际完成事件；公开状态为 Inherited，WorldClearRecord 不继承、不补造；该 World 谱面允许 ReplayChart 更新目标自己的成绩，禁止再次首演和 RetryWorldClear；初始未完成分叉的 null 见证永久不变；目标随后自己的真实完成仍可生成自己的账号记录

### 既有结构与公开方法增量
- WorldCoreStateSnapshot / WorldStateSnapshot：可选头 forkOrigin?:WorldForkOrigin；schemaVersion=1 / kind=Core / 七项 sections 与品牌保持；旧无头文档不补写
- WorldStateCodec：parse 与 parseComplete 校验可选 origin；origin 要求非 null Ledger、Primary/null 与合法完成见证
- WorldClearCompletionStatus：原 NotCleared / Pending / Failed / Completed 增加 Inherited
- WorldForkAvailability：原 NotImplemented 增加 Implemented
- WorldStateSession：constructor 第四参数 readonly worldForkAvailability，默认 NotImplemented；B2.3 组合根显式 Implemented
- WorldStateLock：可选 requestIfAvailable<T>(name,operation):Promise<T>；占用或能力缺失拒绝，不无锁降级
- WorldCoreStateStorage.acquireWorldLease：第三可选参数 ifAvailable=false；分叉使用 true 检查源/目标是否可立即取得
- WorldCoreStateStorage.hasWorldLease：新公开 hasWorldLease(accountId,worldId):boolean；只读检查本适配器当前是否持有指定世界租约，不取得锁、不写存储
- WorldCoreStateStorage.removeUnpublishedCoreState(expected,expectedRaw):void：只可回滚持租约、revision=0、未发布且精确匹配日志的目标 Core
- WorldCoreStateStorage.saveCoreState：已存 origin 在普通保存中严格 immutable，不得新增/变更/移除
- WorldFolderView：最后可选 constructor 参数 forkAvailability 读取器；已配置路径异步等待分叉、pending 禁重、按权限与 Complete Primary 启用；无参数旧行为保留
- WorldClearView：Inherited 显示继承事实与账号权限，隐藏首演/保存重试，recordCount=0
- 新类主要公开行为：WorldForkSession.prepareWorldFork；ForkWorldClearSession 覆盖 getWorldClearSnapshot / submitFrameIntents，其余沿用 WorldClearSession；WorldForkStorage.withDirectoryLock / readPending / assertNoPending / commitWorldFork / recoverWorldFork
- WorldFolderIntent、PlayerIntent 没有新增变体；WorldFolderPort.submitWorldFolderIntent 的既有 void 签名保持；分叉按钮 payload 仍严格仅 kind/worldId

### 存储 key 与锁
- 新增短期日志 key：neurou-world-fork-journal-v1:<encodeURIComponent(accountId)>
- 新增账号目录锁名：neurou-world-folder:<encodeURIComponent(accountId)>
- 既有 key 不变：目录 neurou-world-folder-v1:、目标七项状态 neurou-world-state-v1:、世界租约 neurou-world-state:、账号通关与首次通关投影 key
- 提交顺序：journal → 同步 target Core → directory → journal cleanup；目录追加为唯一 commit point；首个原子日志写失败不调用 writeTarget、不写目标或目录；日志清理失败仍按 Committed/cleanupPending 处理；回滚仅删除精确未发布目标，已发布目标不回滚；普通新建/删除/再次分叉共享目录锁与 pending guard，不覆盖未恢复日志；打开目标先完成日志恢复，目录读取与只读状态诊断不因 pending 被禁止

### 沿用范围与未实现内容
- 正式 Primary 副本通过已有内容和 SceneBuilder 恢复，普通新建 EmptyWorld 仍走原最小世界；不新增世界内容或改编辑器核心；七项核心归属没有变化，forkOrigin 是实例头，账号事实仍不进入世界快照
- 没有新增模块，依赖矩阵方向不扩展；director 零 cc/DOM/Storage/平台时钟，presentation 只通过 IntentPort 读取 director 类型，assets/scripts 为组合根
- B2.3 只开放正式 Primary 来源；不新增 BugShore/FinalShore 内容或入口、不实现 FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入、AccessCode

---

## 名库 v3.12 附录 · VERDICT-301~310 / B2.4b

### 历史名补登与职责澄清
- WorldRegistry / DuplicateWorld：本机位置表 / 复制品加载状态；b 不实现，留 c
- WorldHomeRegistry / HomeDevice：账号 × 非 InitialWorld 世界 → 设备归属索引；b 实装契约级最小闭环
- HomeState：Homed / Released；b 只产生 Homed
- CrossDeviceDuplicate / WorldFork：检测结果 / 新 ID 操作；b 不把 HomeConflict 当已判复制
- WorldMigration / MigrationRelease / MigrationClaim / Migrated：d 实施
- RealityPause / OfflineGrace / SafePoint：d 细化
- AuthService / fetchServerTime：轻量认证服务；b 不真实接入
- CommitRelay / FileCarryPayload：完整共享层 + 本人账号加密个人层；完整 FileCarry 留 B2.5

### InitialWorld 排除
InitialWorld 不进入 WorldHomeRegistry，不参与 CrossDeviceDuplicate，不迁移、不传输为本批跨设备世界。

### B2.4b 已冻结类型
WorldHomeRegistry.ts：HomeState / WorldHomeContext / WorldHomeRecord / WorldHomeRegistrySnapshot / WorldHomeRegistrationRequest / WorldHomeRegistrationReply / WorldHomeRegistryDiagnostic / WorldHomeRegistryReadResult / WorldHomeRegistrationResult / WorldHomeAuthorityPort / WorldHomeRegistryBindings / WorldHomeRegistryCodec / WorldHomeRegistrySession
WorldHomeContractAdapter.ts：WorldHomeContractBindings / WorldHomeContractAdapter

### 判别值
- HomeState：Homed / Released
- WorldHomeRegistrationReply.kind：Registered / AlreadyHomed / HomeConflict
- WorldHomeRegistryDiagnostic.code：ExcludedWorld / InvalidLocalDirectory / WorldUnavailable / ServiceUnavailable / InvalidAuthorityResponse / InvalidRequest
- WorldHomeRegistryReadResult.kind：Available / Unavailable
- WorldHomeRegistrationResult.kind：Registered / AlreadyHomed / HomeConflict / Unavailable

### 存储 key 前缀（b 不写）
- neurou-world-home-registry-v1:<encodeURIComponent(accountId)>
- neurou-reality-pause-v1:<encodeURIComponent(accountId)>
- neurou-migration-v1:<encodeURIComponent(accountId)>

### c/d 实施时再冻结
- c：受限 Core 原型载荷名称 / CrossDeviceImportRequest / 导入 receipt/journal/key
- d：MigrationReleaseRequest/ClaimRequest/Receipt/WorldMigrationJournal / RealityPauseRecord / DeviceAccountBinding
- B2.5：FileCarryEnvelope / 加密个人层 / 完整媒体 / 共享 codec

### 明确不新增
- 完整 FileCarry / 真实外部服务认证 / WorldRegistry 本机位置 API / 账号切换执行端口

---

## 名库 v3.13 附录 · VERDICT-311~325 B2.4c CrossDeviceDuplicate 受限 Core 原型

v3.12 已冻结的 b 名称与语义保持；下列 c 候选本轮正式冻结，候选身份结束。名称冻结不代表完整 FileCarry 或真实服务已交付。

### 历史名补登与继承关系
- WorldHomeRegistry / WorldHomeRegistryCodec / WorldHomeRegistrySession / WorldHomeContractAdapter：v3.12 已正式冻结的账号级非 InitialWorld 归属索引、严格 codec、session 与契约权威；本轮组合复用，原文件不改、不改名
- HomeDevice / HomeState / Homed / Released / HomeConflict：账号×世界归属设备、Homed/Released 状态与登记冲突；本轮只新建 homeRevision=1/Homed，Released 只检测后拒绝 claim；HomeConflict 本身不是已认证复制证据
- WorldRegistry / DuplicateWorld：本设备内位置登记与复制品加载状态；本轮不实现位置 API，也不把跨设备归属索引改名为 WorldRegistry；v3.12 中将位置 API 放到 c 的方向描述，由本轮明确排除范围取代
- WorldFork / WorldForkSession / WorldForkStorage / rebaseWorldState / WorldForkOrigin：B2.3 本机事务与七项重键算法；本轮仅直接复用 rebaseWorldState 与既有来源头，不调用 prepareWorldFork、不复用 Fork 存储事务
- WorldCoreStateSnapshot / WorldStateSnapshot / Complete / Restored：既有 Core v1 存储壳、接收进程内七项完整认证、完整产出/恢复状态；线上数据不能传递品牌，接收端重新 parseComplete
- Ledger / PuzzleProgress / FormatTime / RecallCount / WorldLink / ChartSnapshot / ChartScore：七个既有 Core section 名，保持大小写与结构，仍存入一个主 key，不新增七个 section key
- Inherited / WorldClearRecord / FirstWorldCleared / CopyPermission：完成事件随新来源头继承为 Inherited，不创建通关事实；接收权限来自同账号既有只读事实源，账号事实不进入载荷、不随世界复制
- CrossDeviceDuplicate / CrossDeviceDuplicateResult：已验证同账号传输的来源世界仍归属另一设备时允许进入 c 复制；六路结果正式落为判别联合
- FileCarryPayload / AuthService / CommitRelay：历史完整 FileCarry 与外部服务名称保持；当前载荷不称 FileCarryPayload，不包含共享层 codec、完整媒体或加密 suite，不接真实 AuthService/CommitRelay
- WorldMigration / MigrationRelease / MigrationClaim / Migrated / RealityPause / OfflineGrace / SafePoint：历史语义和 P1~P4 裁定继续有效；本轮不实现迁移或暂停，d 数据结构、执行端口、journal phase、协调锁与时间协议尚未在 c 冻结
- InitialWorld 不进入跨设备登记、检测、传输，各设备自行初始化；InitialWorld 经 B2.3 本机分叉形成的新 UUID 世界可成为本轮来源

### 本轮冻结的 director 公开名称（src/director/CoreTransfer.ts）
- CoreTransferPayload：schemaVersion=1、kind=RestrictedCoreTransfer、transferId、sourceDeviceId、sourceHomeRevision=1、state；state 是七项 Core 的 data-only 值，含既有可选 forkOrigin
- CoreTransferProof：schemaVersion=1、accountId、worldId、sourceDeviceId、transferId、sourceHomeRevision=1、sourceDigest；同一共享权威对精确已发布载荷的证明，是 ContractAdapter fixture 证明，不是加密签名或真实认证凭证
- CrossDeviceAuthorityPort：extends WorldHomeAuthorityPort；沿用 mode=ContractAdapter/context/readRegistry/registerWorldHome，新增 publishTransfer(payload):Promise<unknown>、verifyTransfer(payload):Promise<unknown>
- CrossDeviceImportRequest：schemaVersion=1、title、description；不能覆盖账号或设备
- CrossDeviceDuplicateResult：kind/mode；Homed、CrossDeviceDuplicate、Released、Migrated 携带 record；AuthorityUnavailable、UnsupportedBoundary 携带 detail
- CrossDeviceImportPlan：schemaVersion=1、accountId、deviceId、transactionId、registrationId、targetWorldId、payload、targetRecord、targetState；本地恢复时重新认证完整目标
- CrossDeviceImportPhase：Prepared / HomeRegistered / Published
- CrossDeviceImportEntry：phase、plan、homeReply；Prepared 时 homeReply=null，其余两相必须有合法 Homed/homeRevision1 接收设备登记回复
- CrossDeviceImportJournal：schemaVersion=1、kind=CrossDeviceImportJournal、accountId、deviceId、entries；同设备账号最多一条非 Published，事务/目标/registration 标识各自唯一；Published entries 永久保留于 c
- CrossDeviceImportReceipt：kind=Published或Pending、mode=ContractAdapter、transactionId、targetWorldId、phase、error:string或null；receipt.kind 与 journal.phase 是不同字段
- CoreTransferCompleteValidator：(raw:unknown,accountId,worldId) => WorldStateSnapshot；必须产出当前进程正式认证，并结合已发布内容引用验证
- CrossDeviceImportBindings：authority、milestoneReader、validateComplete、createWorldId、createTransactionId、createRegistrationId、now；接收器不接受本机来源 lease/目录/源 Core 写入端口
- CoreTransferCodec：constructor(validateComplete)；readonly home 使用既有 WorldHomeRegistryCodec
- CrossDeviceImportAdapter：constructor(context,bindings)；readonly context / codec；独立远端计划准备和当前来源检测

### 公开方法名冻结
- CoreTransferCodec：parsePayload(raw) / parseProof(raw,payload) / parseRequest(raw) / parsePlan(raw) / parseJournal(raw)
- CrossDeviceImportAdapter：verifyAuthoritySource(payload) / detectCrossDeviceDuplicate(raw) / prepareImport(raw,request,folder) / requirePermission()
- CoreTransfer 公共辅助函数：validateTransferFolder(raw,accountId) / transferFields(raw,names) / copyTransferData(raw,ancestors?)
- CoreTransferContent.ts：validateCoreTransferContent(state,rawManifest):void；先 Complete 品牌，再校验正式发布的谱面、视觉、媒体身份与叙事版本；CoreTransferContentRequired 是未先认证时的诊断文本标记

### 六路分流冻结解释
- Homed：当前可信来源 HomeDevice 正是接收设备；不是跨设备导入，不走复制，首次登记仍使用 b registerWorldHome
- CrossDeviceDuplicate：proof 精确匹配、同账号、来源当前 homeRevision1/Homed 且 HomeDevice 为另一设备；唯一可走 c 复制的分支
- Released：历史 proof 有效且当前 Released；c 拒绝 claim，交 d
- Migrated：名称与联合类型保留；c 无明确迁移证明，不产出此分支
- AuthorityUnavailable：服务/端口/证明不可用或不可信；拒绝导入
- UnsupportedBoundary：InitialWorld、不支持的 Core/活动边界、未来归属版本或来源设备已改变；拒绝导入，不猜测 Migrated

### 本轮冻结的 presentation 公开名称
- CrossDeviceContractAdapter.ts / CrossDeviceContractBindings：parsePayload、parseProof、parseRegistry、parseContext、digestState 验证/摘要注入；无 director 值导入
- CrossDeviceContractAdapter：constructor(homeAdapter,bindings)、bindDevice(context):CrossDeviceAuthorityPort；共享原 b 权威，源发布核对当前归属，verifyTransfer 核对精确历史发布值；当前归属分流另由 director 检测器负责
- CrossDeviceImportStorage.ts / CrossDeviceImportStorageBindings：context、authority、validatePlan、validateJournal、validateFolder、parseRegistrationReply、parseRegistry、assertTargetLease、writeTarget、readTarget、validateCurrentTarget、verifyAuthoritySource；持久写/回读/租约验证须同步，来源权威验证可异步
- CrossDeviceImportRecoveryResult：CrossDeviceImportReceipt 或 {kind:NoPending,mode:ContractAdapter}
- CrossDeviceImportStorage：constructor(storage,locks,bindings)；withImportLock(accountId,operation)、readJournal(accountId)、readPending(accountId)、prepare(plan)、registerAndPublish(plan)、recover(accountId,targetWorldId?)、assertCanOpen(accountId,targetWorldId)
- assertCanOpen 必须在真实目标 lease 下执行，服务 await 前后都验 lease；检查 Published receipt、当前服务 Homed/homeRevision1/接收设备与目录/Core 一致性；初始 revision0 Core 必须与完整计划精确相等，较高 revision 允许合法游戏进展，但世界身份、forkOrigin、FormatTime 不得改变

### 本轮冻结的组合根名称与存储/锁
- assets/scripts/CrossDevicePrototype.ts 是附加组合根：CrossDevicePrototypeBindings / CrossDevicePrototype；公开 constructor、mount、unmount、dispose；Bindings 为 accountId、readSourceFolder、readSource、acquireSourceLease、milestoneReader、validateComplete、isIdle、openTarget
- 组合辅助名 LogicalDeviceStorage / prototypeLocks 隔离逻辑设备 B 的本地世界存储与锁；同一 realm 的 ContractAdapter 演示方式；设备上下文为 logical-device-a / logical-device-b
- WorldFolderBuilder 只追加 crossDevicePrototype 字段、mountCrossDevicePrototype 与 openImportedRuntime，沿用既有正式 factory 与退出流程

### key / 锁 / 载体
- 导入 journal key：neurou-cross-device-import-v1:<encodeURIComponent(accountId)>；独立于 Fork journal，schemaVersion=1
- 导入协调锁：neurou-cross-device-import:<encodeURIComponent(accountId)>
- 账号目录锁：复用 neurou-world-folder:<encodeURIComponent(accountId)>，始终最后取得；目录锁期间不 await 服务
- Core / 目录 key：沿用 neurou-world-state-v1: + encodedAccount + : + encodedWorld / neurou-world-folder-v1: + encodedAccount
- Fork journal key：沿用 neurou-world-fork-journal-v1: + encodedAccount；c 不读写该事务
- B 演示存储包装：neurou-contract-device-b: + encodeURIComponent(原完整key)；不复制账号事实，世界/目录/journal 使用独立 B 域
- B 演示锁包装：neurou-contract-device-b: + 原锁名；逻辑设备 B 有自己的世界/目录/导入锁域
- UUID / 事务标识：目标 world-UUIDv4；transactionId=import-UUIDv4；transferId/registrationId 独立可编码身份，本轮生产分别生成 transfer-UUIDv4 / registration-UUIDv4
- 原型面板 DOM 名：cross-device-prototype、cross-device-source、cross-device-export、cross-device-import、cross-device-open、cross-device-recover、cross-device-status；dataset.mode=ContractAdapter、dataset.prototype=RestrictedCoreTransfer；sourceWorldId/targetWorldId/receipt/error 仅呈现观测
- 锁顺序：独立账号导入锁 → 真实新目标世界 lease → 账号目录锁；服务等待在持导入锁/目标 lease 时执行，在取得目录锁之前结束；不持远端源 lease；A 导出单独持 A 来源真实 lease 并检查 active 本机目录，不得将这个来源 capability 伪造到 B；B2.3 的源→目标→目录锁顺序保持
- 源世界 HomeConflict 只能在精确 proof 与当前来源归属都通过后分流为 CrossDeviceDuplicate；目标新 UUID 登记返回 HomeConflict 永远拒绝发布或覆盖；新目标 HomeDevice=接收 B，来源 HomeDevice=A 不变

### 后续阶段尚未冻结的实施细节
- B2.4d：SafePoint 主动排空确认载体、MigrationRelease/Claim 请求与 receipt、WorldMigrationJournal 完整结构/phase、RealityPauseRecord/设备绑定/账号切换执行端口、恢复与协调锁具体协议仍须在 d 入场冻结；不从本轮 import journal 推断或冒充迁移契约；历史同 ID 迁移与全账号暂停语义、P1~P4、RealityPause≥OfflineGrace 约束保持
- B2.5：完整 FileCarry 共享层 codec、个人媒体、账号加密与密钥 suite、真实 AuthService/CommitRelay/fetchServerTime 服务实现尚未冻结
- WorldRegistry 本机位置 API、AccessCode/ObserverSync、本机账号切换执行端口均未在本轮新增
- 沿用 INV-10/12/13、活动状态 UnsupportedBoundary、七项主 key、目录追加唯一本地发布点、持真实 lease 才写/无 Web Locks 显式拒绝；服务登记与本地目录是两个存储域，以独立 journal 协调，不宣称全局单一原子点；损坏/碰撞/未知身份保留原值，不删除已发布世界伪装回滚

## 名库 v3.14 附录 · VERDICT-326~345 B2.4d WorldMigration + RealityPause

依据 VERDICT-326～345。v3.13 中 c 已冻结名称与语义保持；下列 d 候选本轮正式冻结，候选身份结束。B2.4d 的“已冻结”仅表示本轮代码、契约与验收使用该精确名称，不表示已接真实外部服务。

### 历史名与语义补登
- WorldMigration：历史名，d 语义冻结；同账号、同 worldId 转移 HomeDevice；不分叉、不重键、不要求 CopyPermission
- MigrationRelease / MigrationClaim：历史名，d 执行契约冻结；Release 接受源主动排空并开始账号冷静期；冷静期结束发布 Released；另设备 Claim
- RealityPause：历史名，d 机制冻结；全账号、全部设备与世界关闭新准入；已在活动边界只允许真实自然排空
- HomeState / Homed / Released：历史名，沿用；PauseActive 时仍 Homed；实际 Released 与 Claim 各递增一次 homeRevision
- Migrated：历史名，d 准入结果冻结；当前 HomeDevice 已转往其他设备的服务归属诊断，不写源墓碑
- SafePoint / OfflineGrace：历史名，沿用；源排空确认不是计时替代；RealityPause ≥ OfflineGrace；本轮不实现平台离线累计运行时长

### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）
- SafePointDrainWorld：排空世界索引；worldId、revision、coreDigest
- SafePointDrainConfirmation：排空数据声明；账号、源设备、drainId、目录摘要及全部未删世界
- SafePointDrainCapability：仅当前持真实 lease 的 composition 能力，含 confirmation / assertCurrent / revoke；不序列化
- SafePointDrainAcceptance：服务接受确认与服务时间 30 秒寿命；不是客户端授权缓存
- SafePointDrainPort：withDrain 回调执行端口，保留真实世界/账号锁直到 Release 操作结束
- MigrationReleaseRequest：schemaVersion / migrationId / worldId / expectedHomeRevision / drainId；账号设备来自绑定端口
- MigrationClaimRequest：schemaVersion / migrationId / worldId / expectedHomeRevision（Released 版本）
- RealityPauseRecord：全账号服务暂停记录；起止均为服务器 epoch 毫秒
- DeviceAccountBinding：服务持久发起设备账号绑定；活动暂停中不能绑定其他账号
- RestrictedMigrationCorePayload：受限同 ID、七项 Core 载荷，不是 FileCarryPayload
- MigrationReceipt：kind = PauseActive / Released / Claimed；保留原期望归属版本及服务证据
- MigrationAdmission：Allowed / PauseActive / Released / Migrated，鲜读服务当前归属
- MigrationAuthorityPort：扩展 WorldHomeAuthorityPort 的独立 d 端口，不修改旧 b/c 边界
- WorldMigrationPhase：Prepared / PauseActive / Released / Claimed / LocalPublished
- WorldMigrationEntry：role = Source / Target，phase、冻结载荷、服务 receipt
- WorldMigrationJournal：设备账号 entries 日志；历史同世界多迁移可留存，migrationId 唯一
- WorldMigrationStorageReceipt：本地执行结果；Pending / PauseActive / Released / LocalPublished，含 phase 与 error
- MigrationCompleteValidator：接收端 parseComplete 与正式内容验证器能力类型
- WorldMigrationCodec：严格 data-only、身份/版本/引用/phase 一致性解码器
- RealityPauseBoundary：director 新增意图准入策略；既有自然活动必要输入与新活动分离

### 平台与组合根导出名
- SafePointDrainAccountFacts：d 已冻结；presentation 排空所读受信通关记录与 FirstWorldCleared
- SafePointDrainBindings：d 已冻结；排空读口、验证器、真实 leases、准入世代及共享协调锁
- isLiveSafePointDrainCapability：d 已冻结；WeakSet 签发验证；阻止自造 noop assertCurrent 冒充排空
- SafePointDrainStorage：d 已冻结；真实排序 lease、账号事实锁与最终目录同步验证的执行适配器
- WorldMigrationAuthorityLock：d 已冻结；ContractAdapter 权威独占锁能力
- WorldMigrationContractBindings：d 已冻结；服务 fixture 时间、持久域、严格 codecs 与排空能力验证
- WorldMigrationContractAdapter：d 已冻结；持久共享契约权威，原子保存归属 / pause / device binding；不是真实 AuthService
- WorldMigrationStorageBindings：d 已冻结；独立迁移日志与同 ID 原版本 target CAS 窄口
- WorldMigrationRecoveryResult：d 已冻结；WorldMigrationStorageReceipt 或 NoPending
- WorldMigrationStorage：d 已冻结；双存储域恢复与目录追加发布，源文件不写
- WorldMigrationPrototypeBindings：d 已冻结，组合内部；Cocos 组合根接线、目录 / Core / account 读口及准入
- WorldMigrationPrototype：d 已冻结，受限原型；A / B 两逻辑设备共享权威的生产组合与演示
- ContractServiceClock：ContractAdapter 内部名；可控测试服务时钟；推进服务 fixture，禁止解释为真实服务器或客户端一小时授权

### key、锁与判别值
- 迁移 journal key：neurou-migration-v1: + encodeURIComponent(accountId)；d 已冻结，WorldMigrationJournal v1；不同设备由注入存储域隔离
- pause 缓存前缀：neurou-reality-pause-v1: + encodeURIComponent(accountId)；历史前缀，d 缓存用途冻结；仅诊断缓存，不能授予准入或解除暂停
- 协调锁：neurou-cross-device: + encodeURIComponent(accountId)；d 已冻结；源排空 / 迁移 / 当前新增准入的设备账号协调锁
- 既有 lease 锁：neurou-world-state: + encoded account + : + encoded world；沿用，不新增独立 section key
- 既有账号事实锁：neurou-world-clear: + encodeURIComponent(accountId)；排空沿用
- 既有最终目录锁：neurou-world-folder: + encodeURIComponent(accountId)；本地发布最后取得
- neurou-migration-contract-authority-v1：ContractAdapter 内部 fixture key；独立权威持久快照，不进入世界 Core 或完整服务命名
- neurou-migration-authority：ContractAdapter 内部全局权威锁；服务不反取世界 / 目录锁
- neurou-contract-service-clock-v1：ContractAdapter 内部可控时钟 key；不作产品服务器时间协议
- neurou-contract-device-b:：沿用 c 的逻辑 B 存储 / 锁隔离 fixture 前缀，不声称物理设备认证
- RestrictedMigrationCore：d 载荷 kind
- WorldMigrationJournal：d journal kind
- ContractMigrationAuthority：ContractAdapter 内部持久权威快照 kind
- Prepared / PauseActive / Released / Claimed / LocalPublished：d 全部 journal phase；不使用 CleanupPending
- Source / Target：d journal role
- Allowed / PauseActive / Released / Migrated：d 当前服务准入 kind
- NoPending：d 恢复无在途日志结果

### 后续范围
- B2.4e 不另造迁移协议，只在本轮受限 Core、共享 ContractAdapter、双逻辑设备及自然安全点范围整体验收
- 真实 AuthService / CommitRelay、完整 FileCarry 的共享 codec / 个人媒体 / 加密 suite、平台 OfflineGrace、非 Primary 迁移、WorldRegistry 本机位置、AccessCode / ObserverSync 未在本轮冻结实施结构；按后续阶段另行冻结

## 名库 v3.15 附录 · VERDICT-346~355 B2.4e 整体验收

依据 VERDICT-346～355。v3.15 是验收语义与阶段边界补登，**新增运行时名、接口、key、schema、journal phase 均为零**；b/c/d 已冻结名称、结构与内部分域全部沿用。

### 沿用名称的本轮验收语义
- WorldRegistry / WorldHomeRegistry：本机位置检测层与账号 HomeDevice 归属层继续分开；e 不补做本机位置 API；服务归属鲜读，不以本地缓存或 HomeConflict 自证所有权
- InitialWorld：不进入跨设备归属 / c 载荷 / d 迁移，每逻辑设备独立初始化；参与源全部世界主动排空与全账号 RealityPause
- WorldFork / CrossDeviceDuplicate / DuplicateWorld：本机分叉操作、跨设备检测结果、复制品加载资格继续各司其职；e 主链 c 目标使用新 UUID，与 d 原 ID 迁移目标独立
- CoreTransferPayload / RestrictedCoreTransfer：c 七项 data-only 受限载荷，接收端重新正式内容绑定 parseComplete；保持原有 c 结构与品牌边界，不叫 FileCarryPayload
- CrossDeviceImportAdapter / CrossDeviceImportJournal / CrossDeviceImportReceipt：独立远端复制事务，复用现有 rebaseWorldState 与目录发布；phase 原为 Prepared / HomeRegistered / Published，e 不新增阶段
- WorldMigration / RestrictedMigrationCorePayload / RestrictedMigrationCore：d 同账号、同 worldId 归属转移，保持原七项及原版本 / 时间 / forkOrigin；不同于 c 重键
- MigrationAuthorityPort / WorldMigrationContractAdapter：沿用 d 的独立持久权威端口；c 与 d 在实际组合中共享权威；受控身份仅两个逻辑设备，不等同外部登录或物理认证
- SafePointDrainConfirmation / SafePointDrainCapability / SafePointDrainAcceptance：源全账号当前真实 leases / Core / 活动 / 账号事实排空；能力单次、可撤销、不可序列化；30 秒服务确认寿命沿用，不用冷静期替代排空
- MigrationReleaseRequest / MigrationClaimRequest / MigrationReceipt：Release → PauseActive → Released → Claim；d 的原请求及 receipt 结构保持，e 不增加字段、分支或执行端口
- WorldMigrationJournal / WorldMigrationPhase：原 Prepared / PauseActive / Released / Claimed / LocalPublished 保持；服务权威与目录发布双域协调，不新增 CleanupPending
- RealityPause / RealityPauseRecord / DeviceAccountBinding / RealityPauseBoundary：全账号所有设备 / 世界拒绝新准入，发起设备绑定；已有活动自然排空，不强退；≥1 小时且≥OfflineGrace，仅服务时间判定
- ContractServiceClock / ContractAdapter：仅现有独立服务时钟 fixture；主链推进一小时须标 realElapsedHour:false，活动补验推进 0；不能解释为真实服务器 / 真实一小时 / 平台 OfflineGrace
- Complete / Restored / Inherited / FormatTime / forkOrigin：Complete 重新认证，Restored 实际正式恢复；c 完成继承 Inherited，d 原值保持；e 记录两目标独立与原账号事实保持
- WorldClearRecord / FirstWorldCleared / CopyPermission：同账号受信事实不随载荷传输；CopyPermission 用于 c，迁移 d 不依赖；通关 / 里程碑不被复制或重复制造

### 证据边界与后续
- 既有 key 与锁沿用 v3.13 / v3.14 的精确名称和内部分域；本轮不将验收脚本 / 截图文件 / JSON 结果字段登记为新的领域名；只读观察、隔离测试 profile、服务 fixture 时间推进属于验收证据，不是新玩家能力
- d 文档变化已由用户确认系 Trae 授权同步，d 已验收、v3.14 已追认，来源问题按 PROTOCOL 闭合；历史 SHA 差异与 raw FAIL 不回写、不追改历史审计为 PASS，也不把追认与落盘混写
- VERDICT-382 归因补登（TraeAuthorized）：用户确认 docs/B2.4-overall-report.md、quality-review/B2.4-overall-report.md 为 Trae 按 PROTOCOL 授权落盘；本条仅追加来源归因，不回写 a 的 UnknownExternal 观测、6,937→6,939、raw exit1 或 first FAIL，不改旧 SHA 记录，不把授权等同 SHA 相等
- 本附录不冻结完整 FileCarry 共享 codec / 本人媒体 / 账号加密 suite、真实外部服务、平台 OfflineGrace、非 Primary 生产迁移、WorldRegistry 本机位置、AccessCode / ObserverSync 的实施名称；这些留 B2.5 或后续范围

## 名库 v3.16 附录 · VERDICT-376~390 B2.5a 冻结 + B2.5b 真实认证服务

依据 VERDICT-376～390（补充上一轮 356～375）与《名库 v3.16 最终附录提案》落盘，2026-10-11（Asia/Shanghai）。P1/P2 已闭合；下列 b 名称已冻结并已用于 b 源码；RealWorldAuthorityPort / RealCommitRelayPort 为保留端口，**边界冻结/机制未实施**；c/d/e 内部结构仅登记于本附录候选区，**未冻结**，完成各补冻轮前不得转为已实施契约。旧 a 附录的“P1～P6全部待裁、b停止”仅为历史状态。

### 已冻结并用于 b 源码

| 逐字名称 | 归属/职责 | 冻结范围 |
|---|---|---|
| RealServiceMode / ExternalService | director纯数据类型/唯一真实mode字面值 | 不扩旧ContractAdapter联合，不冒用旧标签 |
| RegisteredDeviceAssurance / RegisteredCredential | Web凭据持有保证 | 不含PhysicalDevice |
| ServicePublicKey | EC/P-256公开JWK四字段 | kty/crv/x/y，不带私钥或可执行值 |
| AuthorityTrustAnchor | 带外安装的keyId/publicKeyJwk/jwkSha256 | RFC7638 SHA-256无填充base64url；取代旧a候选的hex编码 |
| RealServiceEnvironment | mode/serviceInstanceId/apiOrigin/authorityTrustAnchor | 不来自FileCarry；不含storageDomain或fixture配置 |
| RealAccountFact | accountId/accountName身份 | 不含通关、CopyPermission或其他游戏事实 |
| RealRegisteredDeviceFact | deviceId/generation/keyFingerprint/assurance/label/status | 注册ID属于凭据；b世代为1，status允许Active/Revoked而无客户端撤销API |
| AuthenticatedServiceContext | 服务验证的账号/设备/会话/过期/实例投影 | 普通JSON快照不是世界准入能力或物理品牌 |
| AccountLoginRequest | accountName/password/deviceLabel短暂输入 | 不持久化密码 |
| ServiceFault / ServiceReply | 明确拒绝/Accepted结果 | 九类客户端错误；无失败fixture fallback |
| ServiceReceiptPurpose | 六种receipt用途 | DeviceChallenge/Authentication/Logout/ServerTime/AccountFacts/DeviceFacts |
| SignedServiceReceipt | schemaVersion/instance/purpose/receiptId/keyId/issuedAt/payload/signature | ES256(P1363)，nonce在各payload内绑定 |
| DeviceChallenge | 一次LoginDevice/RegisterDevice挑战 | 服务nonce、账号、公钥指纹、设备ID/世代、到期、实例及请求nonce |
| ServiceAuthenticationPayload | 会话/CSRF/身份/过期签名载荷 | 不含访问或刷新token，token只在HttpOnly cookie中 |
| ServerTimeSample | 已验收Trusted时间投影 | serverEpochMs/clockGeneration/clockStatus/requestNonce；服务器wire也可为Untrusted，adapter拒绝投影 |
| RealAccountFacts | 本人身份、设备列表、requestNonce、revision | revision固定0，不是世界revision或CAS |
| RealAuthServicePort | 新异步真实认证端口 | login/logout/verify/refresh/fetchServerTime/readServerTime/readAccountFacts |
| RealAuthServiceAdapter | presentation网络/WebCrypto适配 | 同源、pinning、内存凭据；forLoopbackHttpTest仅实测传输入口 |
| buildRealAuthService / RealServiceBuilder | assets独立组合函数/源文件 | 新真实链装配，不改旧场景/UI/WorldFolderBuilder |

RealServiceContracts为新增director文件名；IntentPort只追加上述类型的type-only导出。server独立包内的ServiceConfig、ReceiptSigner、AuthenticationFact、AccountIdentity、RegisteredDeviceFact、AccountFacts、P256PublicJwk等是内部镜像/实现名称，不另造游戏层名义权威。API、签名字节及错误集合见本目录contracts-and-security.md；完整字段以源码为准。

### 保留端口（边界冻结/机制未实施）

下列两个 port 仅冻结端口边界，**内部 schema 待补冻、机制未实施**；源码中只有类型定义，没有实现。

| 名称 | 现在允许 | 未批准实施 |
|---|---|---|
| RealWorldAuthorityPort | ExternalService、context、只读轻量readAccountFacts的保留接口 | 归属/暂停/release/claim/drain完整结构；没有readMigrationPayload |
| RealCommitRelayPort | 泛型异步relay边界，真实mode | WorldCommit实际wire schema、成员准入、cursor/长轮询、共享日志 |

这两个port在源码只有类型定义，没有实现；并不把b认证适配器当世界权威。旧同步AuthService.login/logout/verify、CommitRelay.relay原样保留。旧名fetchServerTime继续逐字使用，新真实端口返回Promise<number>，失败拒绝。

### 候选区（c/d/e，未冻结）

以下候选名称与结构为**未冻结**状态，不进已实施冻结表；必须先完成对应补冻轮，才得转冻结。

| 阶段 | 候选名称/结构 | 必须先完成 |
|---|---|---|
| c/P3 | WorldCommitIdentity、RelayCommitEnvelope、RelayCursor、RelayPullReply、WorldRelayKey、WrappedRelayDataKey | AppendedAt与同序冲突、三类正文精确字段、多设备作者序号/离线段、开发者权限、成员与密钥交接、TraceTouch、检查点覆盖/迟到、有界延迟 |
| d/P2/P4 | DrainChallenge、SignedDrainStatement、RealDrainAcceptance、RealMigrationReleaseRequest/ClaimRequest/Receipt | 源本地live drain消费和持锁至release、服务一次challenge/摘要/凭据签名、纯轻量幂等/恢复结构 |
| d/P3/P4 | FileCarryEnvelope、FileCarryPersonalLayer、FileCarryArtifact、EncryptedPersonalLayer、EncryptedMediaEntry、WrappedAccountDataKey、AccountKey、AccountRecoverySecret | 完整共享codec、媒体实字节、账号加密suite与密钥恢复、异步加密耐久提交、旧明文一次迁移 |
| e/P5 | DeviceAssurance、DeviceUptimeSample、DeviceUptimePort、OfflineGrant、PhysicalDevice、bootId | 批准的原生host/硬件attestation、TPM/清安装/重装/休眠边界、可信设备uptime和严格暂停绑定 |

沿用FileCarryPayload，不新增FullFileCarryPayload；CoreTransferPayload保持受限Core范围。历史ProcessedMomentImage保留，EntryVideo及NotCaptured的完整媒体结构仍待d前冻结。候选AES-256-GCM-HKDF-SHA256-v1不因b使用ES256而获得文件加密验收。AccessCode/ObserverSync没有在b或Relay保留接口中开放。

### 保留规则

不改旧key、锁、Core结构/版本、migration phase或B2.4 guard。INV-10/12/13、七项同主key、持lease/无Web Locks拒绝、目录追加唯一本地发布点、RealityPause≥OfflineGrace、源主动排空、发起设备账号绑定、VERDICT-046均继续。

### P6 归因补登

用户确认 docs/B2.4-overall-report.md、quality-review/B2.4-overall-report.md 由 Trae 按 PROTOCOL 授权落盘。原 raw FAIL 保留。

## 名库 v3.17 附录 · VERDICT-391~410 P3 共享契约补冻（纯文档冻结）

依据 VERDICT-391～410 与《名库 v3.17 附录提案 · P3 共享契约补冻》（contracts-draft.md、membership-and-security.md）落盘，2026-10-11（Asia/Shanghai）。本轮为**纯文档冻结**：“已冻结”仅指文档契约名称、字段和值域，不表示已经存在 TypeScript 导出、codec、ContractAdapter、真实 Relay、世界编辑器入口或产品 ObserverSync；源码增量为零。文档接口中的 `unknown` 是未来验证边界，不能作为正文 schema 的宽松旁门。本附录分 A 类（已冻结文档契约名）、B 类（已冻结字段/值域/契约常量）、C 类（候选实现名，未冻结）、D 类（延期名称）四区；精确字段白名单和签名输入以本轮契约规范为准，后续实现不得按简写遗漏必填字段、放宽值域、混用历史 fixture 或导出未批准的平台能力。

### 历史沿用与新旧格式边界

| 历史名称 | 本轮处理 |
|---|---|
| WorldCommit / AppendedAt / WorldChangeLog / SharedWorldState | 沿用语义；新 ExternalService schema 1 增补精确数据形状，archive 空骨架不改。共享提交不含 NarrativeEvent、Ledger、任何 20 维向量或七项 Core。AppendedAt 值仍为 `{epochMs:number}`，共享来源规则不回改账本时钟。 |
| CommitClass | 沿用最新历史值 `Monotonic / AddOnly / RestrictedWrite`；历史 VERDICT-035 已将 SingleWriter 改名，不能重新冻结 SingleWriter。新 WorldChangeClass 是精确正文判别，两者严格映射。 |
| MapEditCommit / MapEditPermission / WorldDeveloper / CoDeveloper / DeveloperRoster / EditTarget | 沿用 VERDICT-035：地图允许名单内写入者，名单变更仅 WorldDeveloper；按单个实体或 Trigger 定义合并，无共享编辑锁。新 schema 不把权限退回“仅 WorldDeveloper 编辑地图”。 |
| SharingCriteria | 沿用三条件及 035 修订的“只有授权写入者能写”；所有新变化均须满足，与个人账本/进度分离。 |
| TraceTouch / EchoTrace / TraceOrigin | TraceTouch 是共享聚合投影，只有 Normal 来源痕收集可产生；Echo/Anomalous/Recall/Replay 不产生。EchoTrace 属个人层，沿用精确扣自身贡献后仍有他人部分的条件，本轮不实现。 |
| WorldCheckpoint / SettleHorizon | 沿用本地检查点、足够早且完整的结算前缀、迟到不纳入。服务器不保存共享状态/检查点。 |
| AnomalyCause / OrphanCommit / MergeConflict / RevertedEdit | **历史名称，不是本轮新增。** 028/035 的终局拒绝、个人诊断和不复活语义保留；未结算暂态不能冒称已产生终局异痕。 |
| AccessCode | 沿用 6 位数字、首次准入、修改不踢旧成员；是准入门槛，不是 WorldRelayKey、账号 key 或其派生材料。 |
| Observer / WorldObserver / ObserverLayer / ObserverSync / ObserverSyncChannel / FileCarry / CommitRelay | 沿用分层与传输边界。本轮仅契约补冻，不开启产品 ObserverSync、首次加入 UI、完整 FileCarry 或真实 Relay。 |
| OfflineGrace / OfflineGrant / RegisteredCredential / PhysicalDevice | 已批准 Web 仅 RegisteredCredential；本轮不授 OfflineGrant、不用应用运行时长或墙钟模拟平台 OfflineGrace，不提高设备可信级。 |
| ExternalService / RealCommitRelayPort / RealWorldAuthorityPort / RealAuthServicePort | 沿用 B2.5b 真实模式与独立端口；不改旧同步签名、b 泛型保留端口、fixture guard 或失败路由。 |

本轮用户明确的新 `WorldCommitIdentity` 为 `authorAccountId + authorSequence`。历史 VERDICT-027 三元“账号＋设备＋序号”仍保留其历史解释；新 schema 显式拒绝 `LegacyIdentityUnsupported`，不拼接、去设备字段、重键或静默迁移。设备/世代保留在来源认证、序号段和签名绑定中，不参加新身份的唯一键。旧格式兼容/迁移需要独立授权。

### A 类 · 已冻结的新增契约类型名

以下是文档名称；字段均 readonly，所有对象使用精确字段白名单，显式 null 表示无值。无字段授权的运行时实现类、文件名或模块放置不从本表推导。

| 名称 | 字段与职责 |
|---|---|
| WorldCommitIdentity | `authorAccountId`、`authorSequence`；同 serviceInstanceId 的作者账号全部世界共用分配序列，序号 1..MAX_SAFE_INTEGER，不复用、不环绕。 |
| SharedAppendedAt | 文档结构别名，字段 `epochMs`；值为非负安全整数。线上由服务签名 permit 给出逻辑追加时刻，正文/外壳相等、签名与 AEAD 绑定。 |
| AuthorSequenceSegment | `schemaVersion`、`serviceInstanceId`、`segmentId`、`authorAccountId`、`authorDeviceId`、`authorDeviceGeneration`、`worldId`、`membershipEpoch`、`firstSequence`、`lastSequence`、`issuedAtServerEpochMs`、`expiresAtServerEpochMs`；含两端点的 1024 个号码，绑定设备/世界/epoch。 |
| WorldAppendPermit | `schemaVersion`、`serviceInstanceId`、`permitId`、`requestNonce`、`worldId`、`identity`、`authorDeviceId`、`authorDeviceGeneration`、`segmentId`、`membershipEpoch`、`keyEpoch`、`changeClass`、`appendedAt`、`expiresAtServerEpochMs`、`clockGeneration`、`clockStatus`；一次准入时间许可，不是离线时间证明。 |
| WorldCommitAdmissionClaim | `schemaVersion`、`serviceInstanceId`、`requestNonce`、`header`、`envelopeSha256`；作者向轻量权威提交的外层准入声明，不向权威发送正文、密文字节、世界状态、检查点或个人层。 |
| SignedWorldCommitAdmissionClaim | `claim`、`authorSignatureBase64Url`；与 WorldCommit 正文作者签名分域，签名/摘要绑定必须与最终 envelope 一致。不是成员匿名凭据。 |
| WorldCommitAdmission | `schemaVersion`、`serviceInstanceId`、`worldId`、`identity`、`envelopeSha256`、`appendedAt`、`admittedAtServerEpochMs`、`admissionRevision`、`membershipEpoch`、`rosterTargetObserverActiveAtAppendedAt`；admissionRevision 在 world 范围内分配，不是作者序号；最后字段 boolean/null，仅 AddCoDeveloper 使用服务可信轻量事实判断目标在 AppendedAt 的有效 Observer 资格，Remove 与其他变化为 null。轻量准入事实不能代替本地正文合法性/重放验证。 |
| WorldCommitRejection | `schemaVersion`、`serviceInstanceId`、`worldId`、`identity`、`envelopeSha256`、`appendedAt`、`rejectedAtServerEpochMs`、`reason`、`previouslyAdmitted:false`；真实拒绝证明，不把未经认证文件或本地墙钟当 TimeTooLate。 |
| WorldAuthorKeyBinding | `schemaVersion`、`serviceInstanceId`、`authorAccountId`、`authorDeviceId`、`authorDeviceGeneration`、`authorSigningPublicJwk`、`authorSigningKeyFingerprint`、`registeredAtServerEpochMs`、`assurance:'RegisteredCredential'`；受信服务根签名的历史作者公钥绑定，当前撤销不抹掉已经准入的历史证明。 |
| WorldDeveloperClosureFact | `schemaVersion`、`serviceInstanceId`、`worldId`、`worldDeveloperAccountId`、`effectiveAtServerEpochMs`、`accountFactRevision`；未来可信账号注销生产者的签名轻量事实，同毫秒先于 WorldCommit 生效，不能回填已封边前缀。本轮不实现账号注销 API。 |
| WorldChangeClass | 精确字面值 `MonotonicReveal / TraceTouch / DeveloperMapChange`。 |
| SharedCommitClass | 文档中的历史 CommitClass 映射类型：`Monotonic / AddOnly / RestrictedWrite`；不是第四种合并模型。 |
| MonotonicRevealChange | `changeClass:'MonotonicReveal'`、`commitClass:'Monotonic'`、`entityId`、`revealed:true`；只针对有效 Residue 的单向共享显露。 |
| TraceTouchChange | `changeClass:'TraceTouch'`、`commitClass:'AddOnly'`、`traceTouchId`、`normalTraceEntityId`、`touchUnits:1`；正文不含访客表、账本、得分或个人进度。 |
| MapEditCommitChange | `changeClass:'DeveloperMapChange'`、`commitClass:'RestrictedWrite'`、`subtype:'MapEditCommit'`、`edit:MapEditOperation`；**一条提交只有一个对象、一个操作**，一次编辑器明确保存可产生多条独立提交，不以 atomic 多目标批次牵连其他对象。 |
| DeveloperRosterChange | `changeClass:'DeveloperMapChange'`、`commitClass:'RestrictedWrite'`、`subtype:'DeveloperRosterChange'`、`operation`、`accountId`、`observerAdmissionRevision`；operation 只有 AddCoDeveloper/RemoveCoDeveloper，均引用已验证的旧 AdmissionFact；Add 另须目标在 AppendedAt 的有效 Observer 资格，Remove 不要求目标今天仍 active，不让已撤销 Observer 阻碍移出开发者名单。 |
| WorldChange | 上述四个结构的 discriminated union；后三类中的地图与名单 subtype 都属于第三类，没有第四种 changeClass。 |
| MapEditOperation | CreateEntity/ReplaceEntity/DeleteEntity/CreateTrigger/ReplaceTrigger/DeleteTrigger；`operation`、`target`，创建/替换另有 `definition`，删除不得附任意 definition。 |
| SharedPosition | `lateralMilli`、`depthMilli`；整数 milli WorldMeter 表示，不替换旧核心坐标类型。 |
| SharedContentReference | `contentId`、`contentSha256`；必须被正式批准 manifest 唯一解析，不是 URL、脚本、下载权或任意资源引用。 |
| SharedMapEntityDefinition | `entityId`、`elementType`、`position`、`content`、`normalTrace`；elementType 为 Initial/Process/Trace/Residue；normalTrace 为 null 或 `{traceTouchId,tier}`，仅正式 manifest 可证明 Normal 资格。 |
| SharedTriggerDefinition | `triggerId`、`anchorEntityId`、`activation`、`action`；activation 为 Proximity/radiusMilli 或 Interaction；v1 action 只 RevealResidue/targetEntityId，不含任意表达式/个人解谜状态。 |
| WorldSharedGenesis | `schemaVersion`、`profile`、`worldId`、`mapId`、`contentRevision`、`contentManifestSha256`、`worldDeveloperAccountId`、`developerTrustAnchor`、`initialState`；受信本地共享起点，不上传。 |
| RestrictedWriteHeader | null 或 MapEditCommit subtype 或 DeveloperRosterChange 的轻量名单 delta；不公开地图对象/位置/Trigger 正文，不是完整 SharedWorldState。 |
| RelayCommitHeader | `schemaVersion`、`profile`、`kind`、`serviceInstanceId`、`worldId`、`identity`、`authorDeviceId`、`authorDeviceGeneration`、`authorSigningKeyFingerprint`、`segmentId`、`permitId`、`membershipEpoch`、`keyEpoch`、`worldRelayKeyId`、`appendedAt`、`changeClass`、`commitClass`、`restrictedWrite`、`cipherSuite`。 |
| WrappedRelayDataKey | `nonceBase64Url`、`ciphertextAndTagBase64Url`；正文新随机 DEK 的群域包装，不是账号个人层 key 包。 |
| RelayCommitEnvelope | `header`、`wrappedCommitDataKey`、`nonceBase64Url`、`ciphertextAndTagBase64Url`、`authorSignatureBase64Url`；重试复用同一完整字节，不重新随机加密/签名。 |
| AdmittedWorldCommit | `envelopeBytesBase64Url`、`appendPermitReceipt`、`sequenceSegmentReceipt`、`admissionReceipt`、`admissionClaim`、`authorKeyBindingReceipt`、`membershipEpochReceipt`、`rosterObserverAdmissionReceipt`；最后字段仅名单 subtype 为对应签名事实，其他变化必须 null，裸 observerAdmissionRevision 不是授权证据。envelope 为精确 UTF-8 字节的 canonical base64url，先验证受信摘要再 unknown 解析，保留已准入坏正文的可验证分类能力；缺字节/错摘要仍是 Gap。对方仍须验签/解密/严格正文/权限校验。 |
| SharedEntityRecord / SharedTriggerRecord | `definition`、`createdBy`、`lastEditedBy`、`deletedBy`；null 有明确 Genesis/未修改/未删除含义；tombstone 永久阻止同 ID 复活。 |
| TraceTouchAggregate | `traceTouchId`、`normalTraceEntityId`、`totalTouchUnits`、`aggregateStrength`；exact uint128 总量与饱和画面强度分开，不保存贡献者列表。 |
| DeveloperRosterState | `worldDeveloperAccountId`、`coDeveloperAccountIds`、`frozen`；不承载成员设备、AccessCode、群 key、会话或通关事实。 |
| WorldChangeLogWire | `schemaVersion`、`profile`、`worldId`、`genesisSha256`、`baseCheckpointSha256`、`developerClosure`、`commits`；developerClosure 为签名事实或 null，不是 WorldCommit 第四类；签名提交总序日志的 wire 载体，不是事务 journal。 |
| RelaySettlementSeal | `schemaVersion`、`serviceInstanceId`、`worldId`、`sealRevision`、`policySha256`、`issuedAtServerEpochMs`、`sealedThroughEpochMs`、`admittedCommitCount`、`admittedPrefixSha256`、`developerClosureSha256`、`previousSealSha256`；只证明准入摘要前缀封闭，不证明正文/state 或全员收件正确。 |
| CheckpointCoverageEntry | `identity`、`envelopeSha256`、`appendedAt`、`admissionRevision`、`applyResult`、`finalDiagnostic`；时间/身份/摘要结果保留，号码段有洞，不能用最大作者序号代替精确覆盖。applyResult 与终局诊断分开。 |
| WorldCheckpointWire | `schemaVersion`、`profile`、`worldId`、`genesisSha256`、`parentCheckpointSha256`、`coveredThroughEpochMs`、`settlementSeal`、`developerClosure`、`coverage`、`coverageSha256`、`state`、`stateSha256`、`checkpointSha256`；只本地，developerClosure 是签名事实或 null，hash 本身不授予陌生 checkpoint 可信性。 |
| SharedSettlementPolicy | `schemaVersion`、`offlineGraceMs`、`boundedRelayDelayMs`、`timeUncertaintyAllowanceMs`、`settleHorizonMs`、`retentionMs`；固定 policy hash，变更不能静默改变已封边历史。 |
| RelayCursor | `relayGeneration`、`position`；队列接收位置，与作者序号/事件总序/结算边界分开。 |
| RelayPullReply | Batch 或 Gap 的纯数据载体；共有 worldId/after/retentionFloor，Batch 有 next/commits，Gap 有 reason。正式 API 返回码/route/CSRF 绑定留 c-1。 |
| SharedAuthorityReceipt<T> | `schemaVersion`、`serviceInstanceId`、`purpose`、`receiptId`、`keyId`、`requestNonce`、`issuedAtServerEpochMs`、`clockGeneration`、`clockStatus:'Trusted'`、`payload`、`signatureBase64Url`；purpose 与 b 的认证/服务器时间 receipt 分域。 |

WorldCommit、SharedWorldState、EditTarget 和 WorldCheckpoint 是历史概念的本轮精确增补，不列为全新产品机制。新 SharedWorldState 字段为 `schemaVersion/profile/worldId/mapId/contentManifestSha256/entities/triggers/revealedResidueEntityIds/traceTouches/developerRoster`；新 WorldCommit 明文为 `schemaVersion/profile/worldId/mapId/contentManifestSha256/identity/authorDeviceId/authorDeviceGeneration/segmentId/permitId/membershipEpoch/keyEpoch/appendedAt/change`。

#### A 类 · 成员与群 key 命名边界

`WorldRelayKey` 是本轮群域随机 256-bit key 契约名：绑定 world/membership epoch，与本人账号加密 key 分离，不从 6 位 AccessCode 派生；服务不持明文群 key。`WorldDeveloperTrustAnchor` 是本轮受信 WorldDeveloper 根 pin 名：带外批准/可信正式来源，不能从首次不可信文件或 `/service/keys` 自动取信。

| 本轮冻结文档类型 | 精确字段与归属 |
|---|---|
| WorldKeyAgreementPublicKey | `kty:'EC'`、`crv:'P-256'`、`x`、`y`；只有四字段，x/y 各 canonical base64url 的 32 字节。相同公钥编码可用于根签名 key 的表示，ES256/ECDH 私钥材料仍不得复用。 |
| WorldDeveloperTrustAnchor | `schemaVersion`、`worldId`、`worldDeveloperAccountId`、`developerSigningKeyId`、`developerPublicKey`、`developerPublicKeyFingerprint`；独立于 b 服务签名根与内存注册凭据。 |
| WorldObserverAdmissionFact | `schemaVersion`、`serviceInstanceId`、`worldId`、`observerAccountId`、`observerAdmissionRevision`、`accessCodeRevision`、`admittedAtServerEpochMs`、`developerTrustAnchorSha256`；正确码产生的不可变账号/world 准入事实，用 WorldMembership 服务 receipt 签发。 |
| WorldMemberCredential | `accountId`、`observerAdmissionRevision`、`deviceId`、`deviceGeneration`、`registeredSigningKeyFingerprint`、`keyAgreementPublicKey`、`keyAgreementKeyFingerprint`；observerAdmissionRevision 为 number 或 null，null 仅该 world 根账号凭正式世界注册/root 证据初始化；非根 Observer/CoDeveloper 必须为≥1并有可信 AdmissionFact。不含角色、个人进度或群秘密。 |
| WorldRelayKeyDescriptor | `schemaVersion`、`worldId`、`membershipEpoch`、`keyEpoch`、`worldRelayKeyId`、`keyCommitmentSha256`；最后字段为 32-byte 随机 key 原始字节的 SHA256，不是 key 或访问凭据。 |
| WorldMembershipEpoch | `schemaVersion`、`serviceInstanceId`、`worldId`、`membershipEpoch`、`previousMembershipEpoch`、`key`、`credentials`、`developerTrustAnchorSha256`、`activatedAtServerEpochMs`、`developerSignatureBase64Url`；服务签完整最终 epoch，根签除 signature/authority 激活时刻外的 proposal。 |
| WorldMembershipEpochProposal | 上述 epoch 除 `activatedAtServerEpochMs` 外全部字段；publisher 不自报尚未发生的服务激活时刻。 |
| WorldMembershipChange | `schemaVersion`、`serviceInstanceId`、`changeId`、`requestNonce`、`worldId`、`expectedMembershipEpoch`、`reason`、`next`；reason 为 Initial/MemberAdded/MemberRemoved/CredentialAdded/CredentialRemoved/KeyCompromise；next 是根签 proposal，不是上传秘密。 |
| WorldRelayKeyPackageContext | `schemaVersion`、`serviceInstanceId`、`worldId`、`packageId`、`descriptor`、`recipient`、`developerTrustAnchorSha256`、`developerSigningKeyId`、`cipherSuite`；目标、世代、epoch、world 与根摘要全部绑定。 |
| WorldRelayKeyPackage | `context`、`ephemeralKeyAgreementPublicKey`、`saltBase64Url`、`nonceBase64Url`、`ciphertextAndTagBase64Url`、`developerSignatureBase64Url`；用户携带/显式点对点包，不是 FileCarry 完整载荷、Relay 消息或云 key vault 对象。 |
| WorldRelayKeyAcceptance | `schemaVersion`、`serviceInstanceId`、`worldId`、`packageId`、`packageSha256`、`descriptor`、`recipient`、`acceptanceNonce`、`keyPossessionTagBase64Url`、`recipientSignatureBase64Url`；publisher 用群 key 验 HMAC 与目标设备签名，不让无 key 的服务冒称见证成功解包。 |

membershipEpoch 与 keyEpoch 在 v1 从 1 开始，每次发布同时恰好加 1，两个字段不同语义但当前值相等；初始 previousMembershipEpoch/expectedMembershipEpoch 为 null，之后恰为当前 epoch。credentials 按账号、设备、世代排序且无重复；WorldRelayKey/每包 ephemeral key/salt/nonce 均独立 CSPRNG 材料。包正文恰好 32-byte 群 key，盐 32-byte、nonce 12-byte、ciphertext+tag 48-byte、ES256/P1363 签名 64-byte；acceptanceNonce 与 keyPossessionTag 各 32-byte。重试同 packageId 必须同完整包摘要，不重新随机包装。

世界开发者根 pin 不意味着 PhysicalDevice，批准成员也不意味着已取得完整历史文件。AccessCode 由 WorldDeveloper 选择，CSPRNG 只是推荐生成路径，不禁止合法自选六位码。正确 AccessCode 自动授 WorldObserver，不暗加人工审批；key 交接未完成可 Pending/KeyPublisherUnavailable，但不能撤回准入事实。改 AccessCode、撤销成员/轮换 epoch、移出 CoDeveloper 名单、logout 是不同操作，不能互相冒用。

成员设备事实/开发者权限镜像是轻量权威域；WorldRelayKey 明文/个人层/共享 checkpoint 不进服务器。`RestrictedWriteHeader` 的名单 delta 是已批准权限事实，不能扩成地图状态或第四类变更。

### B 类 · 已冻结字段值域与契约常量

这里冻结 wire 值、政策字段与默认值。UPPER_SNAKE_CASE 源码标识属于 C 类候选，不表示本轮向 constants 新增导出。

| 字段/契约值 | 冻结值域或规则 |
|---|---|
| schemaVersion / profile / mode | 新共享 schemaVersion=1；profile 逐字 ExternalSharedOnlineV1；真实 port mode 逐字 ExternalService。历史 fixture 不自动套新 profile。 |
| kind / cipherSuite | Relay header kind=RelayWorldCommit；cipherSuite=AES-256-GCM-HKDF-SHA256-v1。未知 suite 不宽松降级。 |
| authorAccountId / worldId / deviceId / permitId / segmentId / 稳定对象 ID | 小写 canonical UUID；同一 world 内对象/触痕 ID 永不复用。serviceInstanceId 与受信部署配置匹配，不把跨服务序号默认为同域。 |
| serviceInstanceId | 沿用 b 的 ASCII `[A-Za-z0-9_.-]{3,128}`，逐字等于安装 pin 配置；不是 UUID 或跨实例通用域。 |
| receipt.keyId / developerSigningKeyId / worldRelayKeyId | 前两者为各自 P-256 公钥 RFC7638 SHA256 无填充 base64url 指纹且等于对应 pin；群 worldRelayKeyId 单独为新 canonical UUID，不能混用服务/开发者签名 keyId。 |
| authorSequence / firstSequence / lastSequence | 安全整数，authorSequence≥1；每段含两端点正好 1024 号，账号事务分配，不归还、不复用，耗尽拒绝。 |
| authorDeviceGeneration / membershipEpoch / keyEpoch / revision | 实际生效世代/epoch/revision≥1 的安全整数；旧 epoch 不自行升级，新 key 不从旧 key 推导。 |
| epochMs / issuedAtServerEpochMs / expiresAtServerEpochMs | 非负安全整数；序号段寿命 3600000ms；在线许可期限 appendedAt+30000ms；服务时刻 S≥expiresAt 即过期，不含到期端点；失信或缺服务证明拒绝。 |
| requestNonce | canonical base64url 编码的 32 随机字节；签名 receipt 与请求逐字绑定。 |
| Sha256 字段 | 64 位小写 hex；对规定 JCS/UTF-8 字节摘要，不 hash 运行时对象。 |
| authorSigningKeyFingerprint / 根 key fingerprint | EC/P-256 JWK 的 RFC7638 SHA256 无填充 base64url，沿用 b；不是短名或未验证响应自带公钥。 |
| lateralMilli / depthMilli | -1000000000..1000000000 整数；1000=1 WorldMeter；禁止浮点/负零，不改既有坐标。 |
| contentId | ASCII `[A-Za-z0-9_.:/-]{1,128}`，与 contentSha256 在批准 manifest 内唯一对应。 |
| radiusMilli | 1..1000000 整数；target/anchor ID 必须在有效定义中存在、类型相符。 |
| revealed / touchUnits | 分别固定 true / 1，不允许隐藏、衰减、负贡献、任意强度增量。 |
| totalTouchUnits | canonical 无前导零十进制字符串，0..2^128-1；不转 JS number，溢出拒绝。 |
| aggregateStrength | `min(65535,totalTouchUnits)` 的精确整数；只用于画面，不以饱和值推断他人贡献。 |
| authorSignatureBase64Url / signatureBase64Url | ES256/P1363，64 字节；base64url 无填充且重编码逐字一致。 |
| nonceBase64Url / wrappedCommitDataKey.ciphertextAndTagBase64Url | AES-GCM 独立 12 字节 nonce；DEK 包装密文为 32 字节 DEK+16 字节 tag；正文 tag 为 16 字节。 |
| 明文/单 envelope/批次限额 | 明文≤49152 bytes；完整 envelope≤65536 bytes，两项都满足；批≤256 条且规范响应≤1048576 bytes，不保存半条或截断字段。 |
| maximumWaitMs | 0..25000；25 秒长轮询时限不等于有界中继延迟 B。 |
| RelayCursor.position | canonical 十进制 uint64 字符串，0 或非零首位，无前导零；generation 实际版本≥1。 |
| purpose | SequenceSegment / WorldAppendPermit / WorldCommitAdmission / WorldCommitRejection / AuthorKeyBinding / RelaySettlementSeal / WorldMembership / WorldDeveloperClosure；不能与 b 的 ServerTime/Authentication 相互替用。 |
| WorldCommitRejection.reason | TimeTooLate / PermitExpired / EpochClosed / IdentityConflict；只 TimeTooLate 对应历史 OrphanCommit，线上 30 秒许可通常先过期，不能用 PermitExpired 假称真实离线迟到验收。 |
| CheckpointCoverageEntry.applyResult / finalDiagnostic | 单步结果 Applied/NoEffect/RevertedEdit/InvalidChange；终局诊断 MergeConflict/RevertedEdit/InvalidChange/null。Applied 后被覆盖可同时有 MergeConflict，不能因终局诊断跳过历史单步重放。 |
| Gap.reason | RetentionExpired / RelayGenerationChanged / MissingAdmittedEnvelope；Gap 不是跳过成功，不能自动推进状态/覆盖/ACK。 |
| SharedSettlementPolicy 初始开发政策 | G=3600000ms、B=300000ms、U=60000ms、H=3960000ms、retention=86400000ms；始终 H≥G+B+U、retention≥H。24 小时仅在不等式成立时可用。 |

父 checkpoint 的 identity/摘要/时间/admissionRevision/applyResult 在后代 coverage 不改，已有非 null 终局诊断不回退、不换因；null 只表示该边界尚无诊断，不保证永久赢家。后代仅由新已封边合法同 target 编辑及可验证父 state/checkpoint 链演进 null→MergeConflict，旧 checkpoint 字节永不回写；沿用 027/035，不新增同账号覆盖豁免，同账号不同设备也可产生冲突诊断，不能凭文件自称覆盖改诊断。本地 state/coverage/checkpoint 摘要分别自洽，仅完整已准入前缀的 count/prefix 摘要与 seal 相等，seal 不认证本地 state。

新签名/加密域是 wire 固定 UTF-8 字节常量：`Neurou/shared-authority/v1\0`、`Neurou/commit-admission-claim/v1\0`、`Neurou/world-commit/v1\0`、`Neurou/relay-dek/v1\0`、`Neurou/relay-wrap/v1\0`、`Neurou/relay-body/v1\0`。此处 `\0` 表示终止 NUL 字节，不是反斜杠和字符 0；规范明确覆盖字段/规范化顺序，不能仅凭域名验证正文。

成员安全固定域为 `Neurou/access-code/v1\0`、`Neurou/world-membership/v1\0`、`Neurou/world-relay-key/v1\0`、`Neurou/world-relay-key-aad/v1\0`、`Neurou/world-relay-key-package/v1\0`、`Neurou/world-relay-key-acceptance/v1\0`、`Neurou/world-relay-key-acceptance-signature/v1\0`。世界根包签名/acceptance 签名不是 SharedAuthorityReceipt 的 service purpose，不能加入服务 receipt enum 以绕过独立签名验证。成员签名/ECDH/nonce/AAD 的全部覆盖规则按成员规范执行，不仅比对这些域名。

契约语义结果标签：IdentityConflict、SequenceExhausted、LegacyIdentityUnsupported、OfflineProofUnsupported、TimeTooLate、PermitExpired、BoundViolated、CheckpointUnverifiable、InvalidChange、NoEffect 等是本轮**契约语义结果标签**；HTTP status、完整 error envelope 与源码 enum/type 另在 c-1 绑定。OrphanCommit/MergeConflict/RevertedEdit 是已有个人层异常原因，不借错误标签自动调用 S5 或上传个人诊断。

### A～F 关系与阶段交接

| 问题 | 本轮名称关系 |
|---|---|
| A 命名 | 本附录区分历史沿用、纯文档已冻结数据名/字段/值域、future port/route/源码常量候选。没有新增运行时导出。 |
| B 与 B2.4 | WorldChangeLog 是共享事实日志；CrossDeviceImportJournal 是 Core 导入事务恢复 journal；WorldMigrationJournal 是迁移 phase 恢复 journal。三者不统一、不互转，原存储 key、锁与 phase 不改。 |
| C AccessCode | 纯首次准入门槛；批准加入与可信成员 key 分发是不同验证步骤。AccessCode 不成为群 key、账号 key、签名根或恢复秘密。 |
| D ObserverSync | 契约补冻提供后续 Relay 数据边界，未开启产品 ObserverSync/共同开发入口；EchoTrace、异痕、地图编辑 UI 不在本轮实现。 |
| E 实现边界 | 只文档补冻，源码增量为零；没有纯类型源码实现、codec、ContractAdapter 或真实 Relay，不把 Markdown 中 interface 当现有能力。 |
| F B2.5c | c-1 可执行纯契约/codec/确定性合并与验证；c-2 独立轻量权威与真实 Relay；c-3 真实两客户端网络、队列/Gap/权限/密钥安全验收。每段另有实施授权，完整 P4/P5/产品接线不因本次冻结自动获得授权。 |

落盘保留历史修订链与本轮纯文档范围，尤其不能将二元新格式写成“027 从未修订”、将地图权限写回单 WorldDeveloper、将 OrphanCommit 降为候选、将 24 小时描述为无条件中继 SLA，或把 RegisteredCredential 写成可信物理设备。

### C 类 · 候选区（候选实现名，未冻结）

> 本节名称未冻结为实施契约；仅在 B2.5c 正式实施授权时考虑使用。

下列内容尚不是本轮代码冻结。c-1 实施前应核对 VERDICT 与 dependency/naming 门禁，不从文档名字自行创建模块或放宽 guard。

- RealCommitRelayProtocolPort：当前文档 future port；候选方法 submit/pull/acknowledge，mode=ExternalService。不改 b 已有泛型 RealCommitRelayPort 或 archive 同步 relay；正式导出/返回类型/错误路由在 c-1 冻结。
- 轻量权威 allocateSegment / issueAppendPermit / admitCommit / sealPrefix 的 port/route：操作语义已由数据契约限定；具体接口名、HTTP path、request/error wire、CSRF、幂等上限、服务源码类名仍 c-1 实施绑定，不是假称 b 已有 API。
- SharedWorldCodec / WorldCommitCodec / WorldCheckpointCodec / SharedWorldSession / RelayServiceAdapter 等实现名：仅描述可能的职责，未冻结这些实现标识、文件放置、导出或算法类；本轮不创建。
- 源码常量别名（建议未来源码常量别名；规范值已冻结，源码标识不在本轮落盘）：SHARED_SCHEMA_VERSION=1、SHARED_ONLINE_PROFILE=ExternalSharedOnlineV1、AUTHOR_SEQUENCE_SEGMENT_SIZE=1024、AUTHOR_SEQUENCE_SEGMENT_TTL_MS=3600000、WORLD_APPEND_PERMIT_TTL_MS=30000、TRACE_TOUCH_STRENGTH_CAP=65535、WORLD_COMMIT_PLAINTEXT_MAX_BYTES=49152、RELAY_ENVELOPE_MAX_BYTES=65536、RELAY_BATCH_MAX_COUNT=256、RELAY_BATCH_MAX_BYTES=1048576、RELAY_PULL_WAIT_MAX_MS=25000；BOUNDED_RELAY_DELAY_MS / SHARED_TIME_UNCERTAINTY_ALLOWANCE_MS / SETTLE_HORIZON_MS / RELAY_RETENTION_MS 值依 B 类初始 policy，必须按 G/B/U 不等式验证，不能当任意网络环境的保证。MAX_BYTES 是容量单位，勿复用玩法常量。
- AccessCode rate-limit/准入 challenge 开发数值（候选）：account/world 5 次失败/15 分钟、IP 20 次失败/15 分钟、world 100 次失败/小时、challenge 30 秒一次消费；限流原则冻结，数值/可信 IP 来源/真实压测在 c-1 定版，不把 6 位码历史规格扩写成这些数值历史已冻结。
- Publisher 部署、根 key 恢复/更新、成员 exact route、ECDH possession challenge、package 交付入口与限额：数据契约不等于完整实施前置；独立批准/证据后才落源码与持久秘密，不在本轮新造根继承者、明文 key 存储或消息发送授权。

### D 类 · 延期区

> 本节名称已明确延期，需独立前置裁定后才可冻结。

- 旧三元 WorldCommit 迁移类型/操作：延期，需独立身份转换与去重/碰撞协议；不得静默新增 Legacy adapter。
- 原生 OfflineTimeProof / OfflineAuthorPermit 等类型：候选而非授权能力；P5 明确 boot/uptime/attestation/grant/攻击者边界后另补 schema。Web 禁止应用时长降级。
- 自身 TraceTouch 贡献恢复与陌生 checkpoint 证明载体：P4 候选，不能新增第八项 Core、裸个人 key 或凭 hash 授 Complete；目前缺证明时 Unknown/CheckpointUnverifiable。
- 完整地图/Trigger 动作、EditPresence、ObserverSync 产品接线：留后续授权；v1 有限 schema 不等于编辑器全功能或共同开发 UI 已实现。

## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（纯逻辑实现冻结）

依据 VERDICT-411～425 与《名库 v3.18 附录提案 · B2.5c-1 实际源码命名清单》落盘，2026-10-11（Asia/Shanghai）。本轮为**纯逻辑实现冻结**：不是服务或网络，没有 HTTP route、真实 Relay、Auth 接线、存储、时钟或产品接线；不授予 B2.5c-2 网络、密钥分发、存储或产品接线权限。实现边界为 src/director 下五份独立源码（SharedCommitContracts.ts、SharedCanonicalBytes.ts、SharedCommitCodec.ts、SharedCommitValidator.ts、SharedWorldReducer.ts）及 quality-review/b2-5c-1 下隔离测试与交付证据；IntentPort.ts 仅允许保留原字节前缀、追加 type-only 导出；没有恢复 archive/service/sync。机械清单为 evidence/new-names.json（工作区 TypeScript Compiler AST 扫描五份源码，记录源文件 SHA256、位置、全部顶层声明、类型字段/类成员、参数及局部声明；扫描排除 import 和普通属性使用，避免把引用旧名称列为新声明）。54 个 P3 schema 与 SharedSchemaMap 的 54 个 key 一一核对。五份源码共 75 个顶层公开声明：54 + 4 + 5 + 8 + 4；该数不将公开方法、schema 字段或局部绑定重复计为顶层导出。本附录分 P3 已冻复写、A 类（本轮正式冻结实现类）、B/C/D 类（辅助/本地 API 类型）、E 类（实现常量，模块私有，不导出）、F 类（域常量，字符串字面量，不导出）、候选区、延期区。

### P6 归因补登

> 用户确认 docs/NAMEBOOK.md、docs/spec/stage-1.md 在 c-1 基线后变化由 Trae 授权同步 v3.17/P3。原 raw FAIL 保留。

### P3 已冻数据 schema 的源码复写（54 项，沿用 v3.17 冻结名，不重新冻结）

SharedCommitContracts.ts 只提供类型声明。以下是已经冻结的数据契约的源码复写，精确字段/联合分支见源码及 AST 清单；不创建同名旧同步服务实现，不把历史三元身份转换为新二元身份。

| 名称集合 | 内容与边界 |
|---|---|
| `WorldCommitIdentity`、`SharedPosition`、`SharedContentReference`、`WorldSharedGenesis` | 二元账号/序号身份、整数位置、批准内容引用及受信世界初始态 |
| `AuthorSequenceSegment`、`SharedAppendedAt`、`WorldAppendPermit`、`WorldCommitAdmission`、`WorldCommitAdmissionClaim`、`SignedWorldCommitAdmissionClaim`、`WorldDeveloperClosureFact`、`WorldCommitRejection`、`WorldAuthorKeyBinding` | 轻量权威事实及签名载体；`AppendedAt` 来源不变成客户端时钟 |
| `WorldChangeClass`、`SharedCommitClass`、`MonotonicRevealChange`、`TraceTouchChange`、`EditTarget`、`SharedMapEntityDefinition`、`SharedTriggerDefinition`、`MapEditOperation`、`MapEditCommitChange`、`DeveloperRosterChange`、`WorldChange` | 三类允许变化与精确分支；有限地图 schema 不表示编辑器/ObserverSync 产品机制上线 |
| `WorldCommit`、`RestrictedWriteHeader`、`RelayCommitHeader`、`WrappedRelayDataKey`、`RelayCommitEnvelope`、`AdmittedWorldCommit` | 正文、外层分类、DEK 包裹及精确原始字节准入容器 |
| `SharedEntityRecord`、`SharedTriggerRecord`、`TraceTouchAggregate`、`DeveloperRosterState`、`SharedWorldState`、`WorldChangeLogWire` | 共享投影、稳定 ID/tombstone、聚合计数及共享日志；不包含个人七项 Core 或迁移 journal |
| `RelaySettlementSeal`、`CheckpointCoverageEntry`、`WorldCheckpointWire`、`SharedSettlementPolicy`、`RelayCursor`、`RelayPullReply`、`SharedAuthorityReceipt` | 封边、精确 coverage、checkpoint、G/B/U/H/retention 约束、接收 cursor 及服务 receipt |
| `WorldKeyAgreementPublicKey`、`WorldDeveloperTrustAnchor`、`WorldObserverAdmissionFact`、`WorldMemberCredential`、`WorldRelayKeyDescriptor`、`WorldMembershipEpoch`、`WorldMembershipEpochProposal`、`WorldMembershipChange`、`WorldRelayKeyPackageContext`、`WorldRelayKeyPackage`、`WorldRelayKeyAcceptance` | 成员/根 pin/ECDH/epoch/key 包数据形状；key 包及 acceptance 在 c-1 仅有 codec 结构校验，没有包密码学验证或分发机制 |

`SharedAuthorityReceipt<T>` 的泛型不产生新 purpose，只能使用 P3 已冻 purpose。`WorldMembershipEpochProposal` 是既有 epoch 数据的提案投影，不能用没有权威 activation 的对象冒充有效 epoch。

### A 类 · 本轮正式冻结实现类（5 项）

四个正式类名 SharedCanonicalBytes、SharedCommitCodec、SharedCommitValidator、SharedWorldReducer 保持逐字，另含边界错误类 SharedSchemaError。

**SharedSchemaError**：Error 子类；构造器 `constructor(readonly code: SharedSchemaErrorCode, message: string = code)`；运行时边界错误位于 SharedCanonicalBytes.ts。

**SharedCanonicalBytes**：静态参数 API；无平台 codec、网络、时钟或密码学实现。严格 canonical JSON 整数子集、UTF8 及无填充 base64url；decode 要求输入精确等于规范重编码结果。符号、getter、重复 JSON key、非规范数字、非法 Unicode、稀疏数组和隐藏字段被拒绝。

| 方法 | 签名 |
|---|---|
| `encode` | `(value: unknown): Uint8Array` |
| `decode` | `(bytes: Uint8Array): unknown` |
| `utf8` | `(text: string): Uint8Array` |
| `text` | `(bytes: Uint8Array): string` |
| `base64UrlEncode` | `(bytes: Uint8Array): string` |
| `base64UrlDecode` | `(text: string, expectedLength?: number): Uint8Array` |
| `equalBytes` | `(first: Uint8Array, second: Uint8Array): boolean` |
| `domain` | `(domainString: string, value: unknown): Uint8Array`；连接所给域 UTF8 与规范 JSON，不能自行补/替换域字节 |

**SharedCommitCodec**：实例参数 API；`K extends SharedSchemaKind`。输入先复制到规范数据边界，严格形状/值域/交叉字段验证后深冻结。有效 shape 不等于密码学或来源已验证。

| 方法 | 签名 |
|---|---|
| `validate` | `<K extends SharedSchemaKind>(kind: K, value: unknown): SharedSchemaMap[K]` |
| `encode` | `<K extends SharedSchemaKind>(kind: K, value: unknown): Uint8Array` |
| `decode` | `<K extends SharedSchemaKind>(kind: K, bytes: Uint8Array): SharedSchemaMap[K]` |

同一 world 的 map/entity/trigger/touch 稳定 ID 共域唯一，tombstone 继续占用；正常引用及聚合引用不是再定义 ID。`createdBy != null` 必须伴随 `lastEditedBy != null`。raw admitted envelope 保留精确字节，不先丢弃坏正文再伪造无效项。

**SharedCommitValidator**：构造器 `constructor(crypto: SharedCryptoPort, context: SharedValidationContext)`；输入为参数，密码学与受信来源显式注入，没有环境时钟、网络或存储。source receipt、claim/作者签名、membership 签名、注册公钥/指纹、DEK/HKDF/GCM、精确 envelope 摘要与正文重复字段沿 P3 边界验证。

| 方法 | 签名 |
|---|---|
| `ownsGenesis` | `(value: unknown): value is TrustedVerifiedGenesis` |
| `ownsCommit` | `(value: unknown): value is ValidatedSharedCommit` |
| `ownsSeal` | `(value: unknown): value is ValidatedSharedSeal` |
| `ownsClosure` | `(value: unknown): value is ValidatedSharedClosure` |
| `ownsRejection` | `(value: unknown): value is ValidatedSharedRejection` |
| `validateGenesis` | `(input: unknown): Promise<SharedValidationResult<TrustedVerifiedGenesis>>` |
| `isApprovedEntityDefinition` | `(input: unknown): boolean` |
| `validateCommit` | `(input: unknown): Promise<SharedValidationResult<ValidatedSharedCommit>>` |
| `validateSeal` | `(input: unknown, policyInput: SharedSettlementPolicy, previous: ValidatedSharedSeal \| null = null): Promise<SharedValidationResult<ValidatedSharedSeal>>` |
| `validateClosure` | `(input: unknown): Promise<SharedValidationResult<ValidatedSharedClosure>>` |
| `validateRejection` | `(input: unknown): Promise<SharedValidationResult<ValidatedSharedRejection>>` |

`owns*` 依赖本实例私有 WeakSet；类型断言、结构对象、复制或从文件恢复的值均不能获得能力。已 admitted 来源完备而正文不可用的项可以被明确归类为 invalid，不能因此授予一个正常 WorldCommit。缺来源/字节摘要不符/缺群 key 返回 Gap，host/backend 故障返回 HostFailure。

**SharedWorldReducer**：构造器 `constructor(validator: SharedCommitValidator, crypto: SharedCryptoPort)`；公开方法 `replay(input: SharedReplayRequest): Promise<SharedReplayResult>`。确定性重放使用已验证能力、总序、权限/存在性规则、精确身份去重及封边；本地 checkpoint 信任由 reducer 私有 `Map<string, TrustedCheckpoint>` 保存，只接受本实例已产生、且完整规范内容相等的 checkpoint，并复核 seal/closure 能力，不靠陌生文件的 hash 自称可信。同一实例可以重取已知 checkpoint 的等值副本，跨实例/重启后的陌生 checkpoint 无此本地记录。内核不写存储、不追加个人 NarrativeEvent、不发布诊断、不调用实时服务。

### B 类 · codec 辅助类型（4 项，本轮冻结）

| 名称 | 精确职责 |
|---|---|
| `SharedSchemaErrorCode` | `'CanonicalInvalid' \| 'SchemaInvalid' \| 'ValueInvalid' \| 'InvariantInvalid' \| 'LimitExceeded'`；本地解析错误类别，不是 HTTP error wire |
| `SharedAuthorityPayload` | 现有权威 payload 的联合类型，供 codec schema map 使用；不扩大 receipt purpose |
| `SharedSchemaMap` | 54 个精确 schema key 到对应类型的映射，所有属性 readonly |
| `SharedSchemaKind` | `keyof SharedSchemaMap`；泛型选型，不是输入包的自由 schema 字段 |

### C 类 · validator 本地 API 类型（8 项，本轮冻结）

| 名称 | 分类与关键字段 |
|---|---|
| `SharedCryptoPort` | 依赖注入 port，四个方法：`sha256(bytes): Promise<string>`、`verifyEs256(jwk, signature, message): Promise<boolean>`、`hkdfSha256(ikm, salt, info, length): Promise<Uint8Array>`、`decryptAes256Gcm(key, nonce, ciphertextAndTag, aad): Promise<Uint8Array \| null>`；检查过的认证失败为 null，backend 故障须 throw |
| `SharedValidationContext` | caller 安装的受信配置：service instance/root fingerprint、clockGeneration 上限、developerTrustAnchor、批准 Genesis/world/map/content 摘要及两个来源 callback；不从输入文件构造信任 |
| `SharedValidationResult<T>` | 本地结果联合：`Verified/value`、`Gap/reason`、`HostFailure/reason` |
| `TrustedVerifiedGenesis` | 本实例拥有的 `{genesis, genesisSha256}` 验证能力 |
| `ValidatedSharedCommit` | 本实例能力；包含 wire/精确 envelope 字节、identity/AppendedAt/digest/admissionRevision、header/sequenceSegment、可空正文/change 与 invalid 分类 |
| `ValidatedSharedSeal` | 本实例能力，含 seal wire、payload 和 receiptSha256 |
| `ValidatedSharedClosure` | 本实例能力，含 closure wire、payload 和 receiptSha256 |
| `ValidatedSharedRejection` | 本实例能力，含 rejection wire、payload 和 receiptSha256 |

`lookupWorldRelayKey(descriptor)` 的类型为 `Promise<Uint8Array \| null>`，本轮只是 caller 已安装的受保护 key 查询能力；没有创建秘密存储或分发入口。`isEntityDefinitionApproved(definition)` 必须检查正式内容和 Normal Trace 资格，presence 不替代来源批准。历史签名 clockGeneration 可处于独立可信上限之下，不用当前墙钟抹除既有历史许可。

### D 类 · reducer 本地类型（4 项，本轮冻结）

| 名称 | 分类与语义 |
|---|---|
| `SharedReplayRequest` | 本地输入：genesis、parentCheckpoint、commits、settlementSeal、developerClosure、policy、gaps、pendingCandidateCount；外来证据仍从 unknown 验证 |
| `SharedReplayDiagnostic` | `{identity, cause, scope:'PersonalDiagnosticBoundary'}`；cause 只为已有 MergeConflict/RevertedEdit/InvalidChange；是确定性提案，未写入个人账本 |
| `SharedProvisionalCoverageEntry` | `Omit<CheckpointCoverageEntry, 'finalDiagnostic'> & {readonly finalDiagnostic:null}`；本地暂态投影，**不作为 wire coverage entry 或可序列化 checkpoint 准入依据** |
| `SharedReplayResult` | `Replayed` 含 state、coverage、provisionalCoverage、checkpoint、diagnostics、selfContribution；或 Gap/HostFailure。state 包含暂态尾部，只有 checkpoint.state 是已封边前缀 |

coverage 对应已结算 CheckpointCoverageEntry；provisionalCoverage 单列未结算尾部，不能混入已封边集合或提前形成个人不可逆诊断。`selfContribution.kind` 本轮仍为 Unknown，没有恢复个人贡献证明。

### E 类 · 实现常量与内部名（模块私有，不导出）

这些名称只供实现追踪，为私有实现细节；完整 scoped 参数/局部绑定及源码行号在 AST JSON 中；它们不升级为产品概念、service wire 或全局可变状态；没有新导出的常量或全局会话。

| 文件 | 顶层实现常量/注册表 |
|---|---|
| `SharedCanonicalBytes.ts` | `BASE64_URL_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'`；`CANONICAL_DEPTH_LIMIT=128`。128 是恶意嵌套的解析安全上限，不是新协议版本或权威 policy |
| `SharedCommitCodec.ts` | `version`、`profile`、`uuid`、`instance`、`digest`、`fingerprint`、`nonnegative`、`positive`、`bool`、`signature`、`nonce`、`uint128`、`uint64`、`key`、`recordFields`、`triggerRecordFields`、`membershipFields`、`schemaRules`；均未导出 |
| `SharedWorldReducer.ts` | `UINT128_MAX='340282366920938463463374607431768211455'`；`sharedCodec`，均模块私有 |

| 文件 | 模块私有类型/类/函数 |
|---|---|
| `SharedCanonicalBytes.ts` | `invalid`、`scalarString`、`descriptors`、`canonical`、`SharedJsonReader`、`assertBytes` |
| `SharedCommitCodec.ts` | `SharedData`、`SharedRule`、`SharedFields`；`fail`、`data`、`fields`、`literal`、`oneOf`、`stringPattern`、`integer`、`nullable`、`array`、`alternative`、`reference`、`binary`、`decimal`、`requireInvariant`、`same`、`sorted`、`identityKey`、`order`、`receiptPayload`、`inspect`、`authorityReceiptInvariants`、`admittedInvariants`、`membershipInvariants`、`stateInvariants`、`genesisInvariants`、`logInvariants`、`checkpointInvariants`、`pullInvariants`、`immutable` |
| `SharedCommitValidator.ts` | `SharedVerificationGap`、`SharedCryptoHostFailure`、`requireSource`、`sameData`、`unsigned`、`hashBytes`、`owns` |
| `SharedWorldReducer.ts` | `MutableEntityRecord`、`MutableTriggerRecord`、`MutableCoverage`、`ReplayState`、`AppliedChange`、`TrustedCheckpoint`、`ObservedAllocations`、`SharedReplayGap`；`requireReplay`、`compareText`、`identityKey`、`sameData`、`compareEntry`、`stateFrom`、`stateSnapshot`、`activeEntity`、`validTrigger`、`nextTouchCount`、`touchStrength`、`applied`、`invalidChange`、`mapEdit`、`usedStableId`、`unusedTouchId`、`rosterEdit`、`applyCommit` |

Validator 私有成员为 codec、genesis/commit/seal/closure/rejectionCapabilities、context、构造器 crypto，以及 verifyMembership、verifyRosterOrigin、bodyMatchesHeader、requireHeaderContext、receipt、verifyInstalledPins、fingerprint、digest、verify、invalidCommit、capability、guard。Reducer 私有成员为 checkpoints、构造器 validator/crypto，以及 hash、readParent、apply、verifyObservedAllocations。内部成员名称按 AST 原拼写记录，不替换正式类名。

P3 候选的 SHARED_SCHEMA_VERSION、AUTHOR_SEQUENCE_SEGMENT_SIZE、WORLD_APPEND_PERMIT_TTL_MS、RELAY_BATCH_MAX_COUNT 等 UPPER_SNAKE_CASE 别名本轮未创建。既有 wire 数值通过内部规则落实，不将候选别名列为已导出常量。

### F 类 · 域常量（字符串字面量，不导出）

以下七个字面量从 SharedCommitValidator.ts 的 AST 实际提取；`\0` 表示单个 NUL 字节。不是反斜杠和字符 0，也没有新增 wire 域；不新建可替换的全局常量导出。

| 实际域 | c-1 使用 |
|---|---|
| `Neurou/commit-admission-claim/v1\0` | 验作者 admission claim 签名 |
| `Neurou/world-commit/v1\0` | 验最终 envelope 的作者签名 |
| `Neurou/relay-dek/v1\0` | HKDF info 绑定 header |
| `Neurou/relay-wrap/v1\0` | 解包 commit DEK 的 AAD |
| `Neurou/relay-body/v1\0` | 解密正文的 AAD，绑定 header 与 wrappedCommitDataKey |
| `Neurou/world-membership/v1\0` | 验 membership 提案的开发者签名 |
| `Neurou/shared-authority/v1\0` | 验服务 receipt 的独立签名域 |

P3 中 AccessCode/key package/acceptance 相关域保留历史冻结：c-1 validator 没有调用这些域、没有 ECDH/key 包密码学/acceptance 校验或分发。测试 fixture 生成 key 包不构成生产实现或真实服务验收。

### 候选区（留 B2.5c-2，未冻结）

> 本节名称未冻结为实施契约；仅在 B2.5c-2 正式实施授权时考虑使用。

- RealCommitRelayProtocolPort / submit / pull / acknowledge：future port 候选，c-2 正式绑定；本轮没有创建该生产导出，已有 b 泛型 RealCommitRelayPort 不改。
- 轻量权威 allocateSegment / issueAppendPermit / admitCommit / sealPrefix 的 port/route：数据操作语义沿 P3；接口名、HTTP path/error/request、CSRF 与幂等服务实施绑定留 c-2。
- SharedWorldCodec / WorldCommitCodec / WorldCheckpointCodec / SharedWorldSession / RelayServiceAdapter：历史职责候选；本轮实际正式类名为 A 类四类，不替换为这些候选名字。
- Publisher/key 包交付与 acceptance、根 key 保管/恢复/轮换、ECDH 持有 challenge、限流数值/可信 IP：仍需实施前补冻及独立证据；codec shape 不授予秘密创建或消息发送权限。

### 延期区

> 本节名称已明确延期，需独立前置裁定后才可冻结。

- OfflineTimeProof / OfflineAuthorPermit、旧三元身份迁移、自身贡献证明、完整 FileCarry、ObserverSync/编辑器接线：延期范围；本轮没有实现或新增授权。

边界保留：不可把 validator WeakSet 能力或 reducer 本地可信 checkpoint 记录写成可序列化 wire brand，不可把 provisionalCoverage 写为已结算 coverage，不可将 key 包形状校验写成 key 包密码学验收或 Relay 上线。

## 名库 v3.19 附录 · VERDICT-426~440 B2.5c-2a 冻结

依据 VERDICT-426～440 与《名库 v3.19 最终附录提案 · 交 Trae 落盘》落盘，2026-10-11（Asia/Shanghai）。本轮为 B2.5c-2a 冻结：零实现，不创建 TypeScript、SQL、路由、TLS edge 或产品接线；正式依据与冻结包为 quality-review/b2-5c-2a 下正式裁定书、HTTP/端口契约、根与群 key 契约、存储与时钟契约、阶段与遗留、协议前置回复及两项只读审计。本附录分 A 类（已冻结，进冻结表）、B 类（候选，未冻结）、C 类（明确排除）、D 类（延期）；候选/排除/延期条目不写入正式冻结表。

### A 类 · 已冻结 · 类 / 模块与正式归属

| 名称 | 后续正式归属 | 职责 |
|---|---|---|
| SharedServiceProtocolContracts | src/director/SharedServiceProtocolContracts.ts | c-2增量纯数据/port，type-only |
| SharedRelayPrototype | src/director/SharedRelayPrototype.ts | 独立共享在线原型纯编排，零平台依赖 |
| WorldRelayKeyDelivery | src/director/WorldRelayKeyDelivery.ts | 根/群key包/possession交接纯编排 |
| RealWorldAuthorityAdapter | src/presentation/RealWorldAuthorityAdapter.ts | 真实轻量authority HTTP适配 |
| RealCommitRelayAdapter | src/presentation/RealCommitRelayAdapter.ts | 真实submit/relay/pull/ACK HTTP适配 |
| RealSharedServiceSessionAdapter | src/presentation/RealSharedServiceSessionAdapter.ts | P7批准的独立真实认证/CSRF/注册签名owner，旧AuthAdapter保持 |
| SharedCryptoAdapter | src/presentation/SharedCryptoAdapter.ts | c-1 crypto验证与固定用途ECDH/HKDF/GCM/HMAC/封装平台实现 |
| SharedRelayDurableCache | src/presentation/SharedRelayDurableCache.ts | 独立共享密文及公共proof原子耐久/回读，不存秘密或个人层 |
| SharedRelayPrototypeBuilder | assets/scripts/SharedRelayPrototypeBuilder.ts | 独立组合根；不接旧Builder或产品UI |
| WorldAuthorityService / WorldAuthorityStorage | server/src/WorldAuthorityService.ts / WorldAuthorityStorage.ts | 轻量权威事务/PG事实访问 |
| RelayService / RelayStorage | server/src/RelayService.ts / RelayStorage.ts | 有限密文队列、cursor、交付/ACK |
| AuthorityRoute / RelayRoute | server/src/AuthorityRoute.ts / RelayRoute.ts | 本轮冻结HTTP wire与limits映射 |
| RealAuthorityClock | server/src/RealAuthorityClock.ts | 真实wall/monotonic+PG floor/generation，失信latch |
| SharedSessionVerifier | server/src/SharedSessionVerifier.ts | 同PG/b规则真实session与CSRF实时核验 |
| SharedMigrationRunner | server/src/SharedMigrationRunner.ts | checksum/锁/新增002增量迁移，旧runner保持 |
| SharedTlsEdge | server/src/SharedTlsEdge.ts | P8批准的LAN TLS公共边界与固定loopback转换 |
| SharedServerConfig | server/src/SharedServerConfig.ts | 精确公共origin/操作员pins/shared资源配置，无fixture入口 |
| buildSharedServer / shared-main | server/src/buildSharedServer.ts / shared-main.ts | 旧b buildApp与新shared插件独立装配；新shared-main.ts仅独立启动 |

文件路径本轮仅冻结，尚不存在并不算前置已实现。独立Node server可只读编译已有纯codec，不复制宽松格式；presentation→director仅IntentPort type-only。原RealServiceBuilder不扩展，IntentPort后续只追加type-only。

### A 类 · 已冻结 · 增量类型

| 类型名称 | 精确契约来源 |
|---|---|
| RealWorldAuthorityProtocolPort / RealCommitRelayProtocolPort | http-and-port-draft.md §1/7；分别继承旧port，不原位改旧定义 |
| SharedServiceSessionPort / RegisteredAuthorSigningPort | HTTP §7；无secret getter/任意URL/domain签名 |
| WorldKeyAgreementPort / WorldDeveloperSigningPort | key-delivery-and-pins.md §4；固定用途与suite |
| SharedCommitSealingPort / SharedRelayDurableCachePort | HTTP §7；封装真实permit提交 / 密文耐久回读 |
| SharedHttpRequest / SharedHttpReply / SharedServiceFault | HTTP §2/6；严格outer wire |
| SharedServiceErrorCode / SharedTransportReceipt / SharedOperationAuthorization / AuthorityProtocolResult | HTTP §2/3/6；新错误detail、新用途签名wrapper、注册设备用途签名 |
| WorldRegistrationProposal / WorldRegistrationRequest | HTTP §6；批准轻量摘要/root签名 |
| AccessCodeChangeProposal / AccessCodeChangeRequest | HTTP §6；六位码CAS/root签名 |
| WorldServiceFacts / WorldAgreementCredentialFact / WorldObserverChallenge | HTTP §6；轻量facts/ECDH绑定/public准入挑战 |
| WorldMemberCredentialChallengeContext / WorldMemberCredentialChallenge / WorldMemberCredentialProof | key文档 §3；ECDH私钥真实possession |
| RelaySubmitFact / RelayAckRequest / RelayAckFact / RelaySubmitReceipt / RelayAckReceipt | HTTP §5/6；位置、摘要、ACK声明与服务来源 |
| SharedProtocolOperation | HTTP §6的18条route尾部精确联合（含首个/）；不得用任意string/URL |

不另建AuthorityErrorCode/RelayErrorCode：统一SharedServiceErrorCode+fault.layer，只保留b粗code。不另建全新共享日志；WorldChangeLogWire/Checkpoint/WorldCommit等P3/c-1名继续沿用。

### A 类 · 已冻结 · 常量值 / 签名域 / 表名

| 常量 | 值 / 含义 |
|---|---|
| SHARED_TRANSPORT_SIGNATURE_DOMAIN | Neurou/shared-transport/v1\0 |
| SHARED_DEVICE_OPERATION_SIGNATURE_DOMAIN | Neurou/shared-device-operation/v1\0 |
| WORLD_REGISTRATION_SIGNATURE_DOMAIN | Neurou/world-registration/v1\0 |
| WORLD_ACCESS_CODE_CHANGE_SIGNATURE_DOMAIN | Neurou/world-access-code-change/v1\0 |
| WORLD_MEMBER_CREDENTIAL_PROOF_KEY_DOMAIN | Neurou/world-member-credential-proof-key/v1\0 |
| WORLD_MEMBER_CREDENTIAL_PROOF_AAD_DOMAIN | Neurou/world-member-credential-proof-aad/v1\0 |
| WORLD_MEMBER_CREDENTIAL_POSSESSION_DOMAIN | Neurou/world-member-credential-possession/v1\0 |
| WORLD_MEMBER_CREDENTIAL_PROOF_SIGNATURE_DOMAIN | Neurou/world-member-credential-proof-signature/v1\0 |
| RELAY_ACK_SIGNATURE_DOMAIN | Neurou/relay-ack/v1\0 |
| SHARED_CHALLENGE_TTL_MS | 30000；credential/Observer/publisher acceptance挑战分别记录，不能互代 |
| SHARED_MEMBER_CREDENTIAL_LIMIT | 256；完整epoch凭据上限 |
| SHARED_RESPONSE_LIMIT_BYTES | 1048576；完整canonical HTTP响应 |
| WORLD_RELAY_KEY_PACKAGE_LIMIT_BYTES | 16384；完整canonical key包 |
| SHARED_REQUEST_TIMEOUT_MS | 12000 |
| RELAY_PULL_TIMEOUT_MARGIN_MS | 7000；pull wait+margin最大32000 |
| SHARED_IDEMPOTENCY_RESULT_RETENTION_MS | 604800000；其后永久nonce/result tombstone |

表中 `\0` 表示单个 NUL 字节，不是反斜杠和字符 0。新增SharedTransportReceipt purpose精确联合：SharedServiceStatus、WorldRegistration、WorldFacts、AgreementCredentialChallenge、AgreementCredential、AccessCodeUpdated、ObserverChallenge、AuthorityResult、MembershipRead、AdmissionRead、RelaySubmit、RelayPull、RelayAck。这些不是c-1 SharedAuthorityReceipt purpose的扩展。P3既有G/B/U/H/retention、1024/1小时段、30秒permit、65536 envelope、uint64cursor/uint128触痕和签名/AEAD域继续沿用，不改名/重复另造定义。HTTP18路径/限额及速率固定值见HTTP冻结；PG17新表18项、002迁移及锁序见storage-and-clock-contract.md，不在此造别名。

### B 类 · 候选（未冻结，不写入冻结表）

> 本节名称未冻结为实施契约；仅在后续正式实施授权时考虑使用。

- 自动P2P key helper/自动网络包交付：候选，无正式类名；须另冻传输/授权/P4秘密保护，c-2不部署。
- 长期publisher/根恢复/根轮换：候选，P4或新PROTOCOL；内存原型不宣称恢复。
- authority_key_delivery_facts / 服务delivery-confirmation：本次不纳入，不建表/route；本地publisher验HMAC即可。
- RealServiceBuilder扩展：不采纳；采用新SharedRelayPrototypeBuilder。

### C 类 · 明确排除（不纳入）

- 完整FileCarryEnvelope/FileCarryPersonalLayer/EncryptedPersonalLayer/WrappedAccountDataKey：本次不新增，归P4冻结。
- OfflineGrant/PhysicalDevice/DeviceUptimeSample/bootId：本次不新增、不授原生host机制，归P5。
- WorldRegistry位置/旧三元身份迁移/非Primary迁移：明确排除。
- 产品ObserverSync/AccessCode首次加入UI/EditPresence/编辑器全功能：明确排除；协议级准入不能暗开产品机制。

### D 类 · 延期（留 P4 / P5 / 产品阶段）

> 本节名称已明确延期，需独立前置裁定后才可冻结。

- root/群key/ECDH私钥长期保护、恢复与轮换、历史key bootstrap：留P4或新PROTOCOL；c-2仅内存能力，reload缺key记Gap，不宣称Complete/Restored。
- 外来checkpoint来源、个人媒体、异步加密迁移：留P4；Relay不提供checkpoint，不借共享密文缓存暗做P4。
- 原生trustedhost/TPM/attestation/清安装/OS重装证明：留P5；Web仅RegisteredCredential，未知平台无OfflineGrant。
- 真实开发者账号closure/注销生产者：留后续独立冻结；c-2恒null且不造旧b API，不宣称真实注销链。
- 本地精确coverage长期空间上界：留后续格式版本；v1保留每identity摘要，不以压缩/环形cache丢精确拒绝或去重。
- 产品主链接线：留产品阶段；独立prototype不自动进入产品主链。

边界保留：不可把本附录冻结的文件路径与类型规划写成已实现，不可把候选/排除/延期条目写入正式冻结表；限流数值、key包验收、根恢复能力均以对应正式冻结与实施授权为准。

## 名库 v3.20 附录 · VERDICT-441~447 B2.5c-2b 实现

依据用户 c-2b 实施包、v3.19 与 VERDICT-441～447 落盘，2026-10-11（Asia/Shanghai）。保持 v3.19 的 A/B/C/D 含义：A 已冻结；B 候选、未冻结；C 明确排除；D 延期；只有 A 进入本轮正式冻结表，已冻结但尚未实现的后续能力保留阶段标记。本轮只实施 authority 与独立认证/session/signing；18 操作数据契约不表示 18 个真实路由全部开放，实际服务器开放 15 条 authority 路由，Relay 的 3 条只存在类型与严格 codec。机械完整新增声明、字段、方法、局部绑定及源码 SHA 见 quality-review/b2-5c-2b 下 evidence/new-names.json；实际增量与原字节前缀保护见 evidence/changed-files.json、evidence/code.diff、evidence/protected-final-audit.json。

### A 类 · 已冻结的实现名与归属

| 名称 | 正式文件 | 本轮状态与职责 |
|---|---|---|
| SharedServiceProtocolContracts | src/director/SharedServiceProtocolContracts.ts | 已实现；纯数据、type-only port/wire，零平台能力 |
| SharedServiceProtocolCodec | src/director/SharedServiceProtocolCodec.ts | 本轮正式冻结并实现；18 操作严格 canonical request/reply 与固定用途签名输入 schema |
| RealSharedServiceSessionAdapter | src/presentation/RealSharedServiceSessionAdapter.ts | 已实现；独立 b 认证/session/CSRF、内存注册签名凭据、严格 shared transport |
| RealWorldAuthorityAdapter | src/presentation/RealWorldAuthorityAdapter.ts | 已实现；15 authority 操作与 b 兼容 readAccountFacts，mode=ExternalService |
| SharedRelayPrototypeBuilder | assets/scripts/SharedRelayPrototypeBuilder.ts | 已实现 authority 组合根；不接产品 Builder，不声称完整 SharedRelayPrototype 链 |
| SharedSessionVerifier | server/src/SharedSessionVerifier.ts | 已实现；同 PG 实时 access/session/CSRF/account/device 核验与前置锁 |
| RealAuthorityClock | server/src/RealAuthorityClock.ts | 已实现；真实 wall/monotonic、generation/floor 与持久失信 latch |
| SharedMigrationRunner | server/src/SharedMigrationRunner.ts | 已实现；原 001 SHA、PG17、advisory lock、002 checksum ledger |
| SharedServerConfig | server/src/SharedServerConfig.ts | 已实现；exact IPv4 HTTP loopback 与操作员批准公开 pins |
| WorldAuthorityService / WorldAuthorityStorage | server/src/WorldAuthorityService.ts / WorldAuthorityStorage.ts | 已实现；轻量事实、注册、code/ECDH、epoch/segment/permit/admission/seal 与原结果事务 |
| AuthorityRoute | server/src/AuthorityRoute.ts | 已实现模块；15 POST 路由、精确 body limits、shared error wire |
| buildSharedServer | server/src/buildSharedServer.ts | 已实现生产真实 clock 装配，复用旧 b buildApp 与 PG/signing material |
| SharedReceiptSigner | server/src/SharedReceiptSigner.ts | 本轮正式冻结并实现；独立 shared 域签发器，不提取旧 signer 私有字段 |
| SharedCryptoProof | server/src/SharedCryptoProof.ts | 本轮正式冻结并实现辅助模块；仅服务 ECDH credential challenge，不是群 key producer |
| SharedBuild | server/SharedBuild.mjs | 本轮正式冻结并实现独立构建工具；只读编译同一 director 内核，不改旧 server 构建配置 |

新增入口为 server/src/shared-main.ts、server/src/shared-cli.ts；独立配置为 server/tsconfig.shared.json。新迁移实际路径为 server/sql/002_shared_authority.sql，遵循用户最新实施包，旧 server/migrations/001.sql 与 runner 不变。18 张共享表按 v3.19 已冻清单创建；其中 4 张 relay 表本轮为空、没有路由/生产者。跨 world 来源 IP 失败预算存 authority_clock_state.ip_failure_counters（轻量 hash/counter），不增加第 19 表。

### A 类 · 增量纯类型（31 项）

下列 31 项沿 v3.19 已冻结名实现为 type-only：

| 分组 | 名称 |
|---|---|
| Wire / authority wrapper（7） | SharedHttpRequest、SharedHttpReply、SharedServiceFault、SharedServiceErrorCode、SharedTransportReceipt、SharedOperationAuthorization、AuthorityProtocolResult |
| 注册 / facts / code（6） | WorldRegistrationProposal、WorldRegistrationRequest、AccessCodeChangeProposal、AccessCodeChangeRequest、WorldServiceFacts、WorldAgreementCredentialFact、WorldObserverChallenge |
| ECDH public possession（3） | WorldMemberCredentialChallengeContext、WorldMemberCredentialChallenge、WorldMemberCredentialProof |
| Relay 数据契约（5） | RelaySubmitFact、RelayAckRequest、RelayAckFact、RelaySubmitReceipt、RelayAckReceipt |
| 协议 / 窄能力（9） | SharedProtocolOperation、RealWorldAuthorityProtocolPort、RealCommitRelayProtocolPort、SharedServiceSessionPort、RegisteredAuthorSigningPort、WorldDeveloperSigningPort、WorldKeyAgreementPort、SharedCommitSealingPort、SharedRelayDurableCachePort |

### A 类 · 本轮正式冻结的新类型（6 项，合计 37 个顶层公开类型）

| 新名称 | 定义 |
|---|---|
| SharedProtocolPayloadMap | 18 个精确 route 尾部到 request payload 的 type-only 映射 |
| SharedProtocolValueMap | 18 个 operation 到严格成功 value 的 type-only 映射 |
| SharedProtocolReply | 按 operation 索引的 SharedHttpReply 泛型 |
| SharedProtocolSignatureKind | AdmissionClaim / Envelope / CredentialProof / KeyAcceptance / SharedOperation / RelayAck 六个固定用途联合 |
| SharedProtocolCodecPort | encode / parseRequest / validatePayload / parseReply / validateSignatureInput 的纯注入能力 |
| SharedServiceStatusPayload | clockGeneration/status/sample/floor 与 policy/hash 的严格状态结构 |

全部从 IntentPort 仅 type-only suffix 追加导出，旧前缀与运行时输出保全。可选 requestNonce 只服务内存端口便利；wire 的 nonce/authorization/null 等字段始终 required。RealCommitRelayProtocolPort 等后续窄能力本轮仅类型，不产生 Relay、群 key、耐久缓存或产品调用。

### A 类 · 服务器辅助类型、函数与具体边界

| 新名称 | 归属 / 含义 |
|---|---|
| SharedOperatorWorldPin | SharedServerConfig；操作员批准 world/service/map/account/root/Genesis/manifest 公开元组 |
| SharedSession | SharedSessionVerifier；事务内实时核验会话事实，不对外暴露 cookie/CSRF/private key |
| SharedServiceFailure | SharedSessionVerifier；冻结 SharedServiceFault 的服务内部 HTTP/detail 错误映射 |
| AuthorityClockSample | RealAuthorityClock；trusted/sample/floor/generation，失信时 sample=null |
| IsolatedClockSource | RealAuthorityClock；显式隔离测试 wall/monotonic 注入能力，无生产 env/HTTP 入口 |
| StoredWorld | WorldAuthorityStorage；PG 轻量 world 行读取类型，非 SharedWorldState |
| sharedEnvironmentConfig / validateSharedConfig | SharedServerConfig；加载和核验独立 shared 配置 |
| sharedCanonical / sharedUnsigned / verifySharedSignature | SharedReceiptSigner；只读使用原严格内核及 ES256 域验证 |
| makeCredentialChallenge | SharedCryptoProof；真实一次 ECDH/HKDF/GCM/HMAC challenge 与 expectedTagSHA |
| authorityRoutes | AuthorityRoute；固定 15 条 authority 路由注册函数 |
| buildSharedRelayPrototype | SharedRelayPrototypeBuilder；独立生产 authority/session/signing 装配 |
| buildSharedRelayPrototypeForLoopbackHttpTest | 同一 Builder；隔离 cookie transport 的真实 HTTP 测试入口，仍使用生产适配器/验证器 |
| buildIsolatedSharedServer | buildSharedServer 模块；显式隔离 clock/seal 测试，不能宣称生产跨 H 等待 |

模块内部临时名称（如 Data / Rule / RequestData / MemoryDeviceCredential / ServiceClientFault / SharedRequestConflict）、方法、字段及局部 bindings 由机械清单完整记录，只属于对应模块，不创建同名全局业务概念。既有签名域、policy、18 路由值、body/response/timeout 限额沿 v3.19/P3；本轮未新增全局 constants 导出或替换原域。注册 signing / root signing / ECDH / service signing 的已知 key 用途分离；浏览器仍只声称 RegisteredCredential。

### B 类 · 候选（未冻结，不写入冻结表）

> 本节名称未冻结为实施契约；仅在后续正式实施授权时考虑使用。

- 自动 P2P 群 key helper、长期 publisher、自动秘密恢复、未批准运维扩展：继续为候选，没有正式新增实现名；不得把本轮 ECDH credential challenge 或内存 root 测试当作自动群 key 交付。
- RealServiceBuilder 扩展方案：不采纳。

### C 类 · 明确排除（不纳入）

- 完整 FileCarryEnvelope / FileCarryPersonalLayer / EncryptedPersonalLayer / WrappedAccountDataKey：本轮不纳入。
- OfflineGrant / PhysicalDevice / DeviceUptimeSample / bootId：本轮不纳入。
- 旧三元身份迁移、非 Primary 生产迁移、WorldRegistry 本机位置 API：明确排除。
- 产品 ObserverSync / AccessCode 首次加入 UI / EditPresence / 编辑器全功能：明确排除。
- 没有真实 readMigrationPayload；authority 不保存正文、个人层、群 key 包、群 key 或 root 私 key。

### D 类 · 已冻结能力的延期实现与待资源

> 本节为已冻结能力的延期实现与待资源；相关名称沿用 v3.19 冻结状态，本轮不标"已实现"。

- RealCommitRelayAdapter / RelayService / RelayStorage / RelayRoute：留 c-2c。
- WorldRelayKeyDelivery / SharedCryptoAdapter / 群 key package / acceptance 生产实现：留 c-2d。
- SharedRelayPrototype / SharedRelayDurableCache / 完整独立双客户端生产链：留 c-2e。
- SharedTlsEdge / 真实 LAN HTTPS：留 c-2f。
- 长期 root / 账号密钥保护与恢复、完整 FileCarry / 异步加密迁移：留 P4。
- 原生 host / TPM / attestation / PhysicalDevice / OfflineGrant：留 P5。
- 账号 closure 生产者、产品主链接线：后续，账号 closure 本轮恒 null，产品主链接线留 c-3 另议。
- 正式内容 world 的操作员公开 pins/Genesis/manifest、LAN origin/证书/两台设备仍需资源参与；本轮只验受明确批准的临时本机开发世界。

边界保留：18 操作数据契约不等于 18 条真实路由开放，Relay 3 条路由仅存在类型与严格 codec；已冻结未实现能力保留阶段标记；历史 raw FAIL、SHA 归因与原名库字节不回写。

## 名库 v3.21 附录 · VERDICT-448~451 B2.5c-2c 实施与验收

日期：2026-10-11。交 Trae 按授权落盘；GPT 不修改 docs/NAMEBOOK.md 或 docs/spec/stage-1.md。沿用 v3.19/v3.20 四类定义：**A 已冻结，B 候选未冻结，C 明确排除，D 延期。** 方案/测试注入能力不冒充延期机制的生产实现。最终验收状态以 delivery-report 和原始证据为准。

### A 类 · 冻结名、归属及本轮增量

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

### A 类 · 已批准的契约窄例外

P10（VERDICT-448）：session shared request 仅对已严格验证的 pull 使用 wait+7000ms（7000..32000），其余 shared/auth 仍 12000；旧 session 其余字节保全。

P11（VERDICT-449）：pull 请求结果只记轻量原签名 wrapper 元数据、queue 位置/identity/digest 引用和 wire 摘要；每次同 nonce 先验当前准入/generation/floor/expiry/缺载。保留期内从唯一队列重建逐字原 Batch，边界变化后签 Gap，不把密文复制到 authority 请求账。ordinary authority/submit/ACK 的至少 7 日轻量原结果与永久 nonce/hash 记忆保持。

内部元数据版本/种类与字段不是 HTTP wire 新 schema；现有 strict codec、三类 Gap、P3 suite/签名域、三类变化、G/B/U/H/retention、001/002 均不修改。旧主链、本地七项/主 key/锁/目录 commit point 及迁移不受新 Relay 授权改变。

### A 类 · 两个 .shared-kernel 路径关系

`server/.shared-kernel` 是 SharedBuild.mjs 从同一份 director 源码编译得到的中间内核产物；`server/shared-dist/.shared-kernel` 是该中间产物的有意运行布局副本，供 shared-dist/src 的相对模块路径在 Node 运行时解析。两者不是两份独立源码、两套契约或两份业务实现，也不代表额外的生产缓存能力；重复字节是运行布局复制，而非用于加速的第二份缓存。SharedBuild 先编译中间目录，再构建 server 并复制到运行目录；输入哈希及受保护旧文件保证两者取同一内核。本轮构建不修改原内核输入及既有 kernel 字节；两个目录不能重复计入新增源码、公开导出或独立测试数量。

### A 类 · 64 / 37 / 本轮增量统一统计口径

“公开导出”统一指**实施 TS 源文件中带 export 的顶层声明**，不计字段、方法、局部变量、import、IntentPort reexport、质量验收 harness 或生成 JS/d.ts 副本。

- c-2b：17 份新增实施 TS 中 64 个公开顶层声明 = 37 个协议契约类型 + 1 个 Codec 类 + 2 个 Adapter 类 + 2 个客户端 Builder 函数 + 22 个 server 声明。
- c-2b 的“37 个 A 类顶层公开类型”只计 SharedServiceProtocolContracts.ts；与全组 64 个口径不同，不能互减认定缺名。
- c-2b IntentPort `exportCount: 1` 是当轮尾部**一条** export type 语句、含 37 个类型名，不是整个 IntentPort 的 export 总数。
- c-2c：5 份新增实施 TS、8 个公开顶层声明 = 1 个 Adapter 类 + 7 个 server 声明（2 行类型、2 服务/存储类、1 route 注册函数、2服务器 builder 函数）。本轮新增协议契约定义 0；IntentPort 一条尾部 type-only reexport 含 3 个既有类型，不计入新增公开声明。
- 两轮累计：22 份新增实施 TS、72 个公开顶层声明 = 37 个协议契约类型 + 1 个 Codec 类 + 3 个 Adapter 类 + 2 个客户端 Builder 函数 + 29 个 server 声明。已有文件两处修改与生成副本另列 diff，不混入“新增源文件”数量。

最终源 SHA、全部声明/字段/局部名称与计数复核以 evidence/new-names-final.json、evidence/changed-files-final.json 和 evidence/source-final.diff 为准；原无 final 后缀记录保留为旧 generation 清理修复前快照。

### B 类 · 候选（未冻结，不写入冻结表）

自动 P2P 群 key 交付、长期 publisher、自动秘密恢复及未批准运维扩展仍为候选。没有因本轮新增自动交付/恢复机制；测试 native crypto oracle、隔离文件/WAL cache 不是产品能力命名或生产 backend。

### C 类 · 明确排除（不纳入）

完整 FileCarry/个人七项与媒体/journal/checkpoint/Genesis/manifest/state 载荷、群 key 包或私 key 持久服务、readMigrationPayload；OfflineGrant/PhysicalDevice/bootId/原生 host；旧三元迁移/非 Primary 迁移/WorldRegistry 本机位置；产品 ObserverSync/首次加入/AccessCode UI/编辑器/Echo/EditPresence/S5；云部署。没有把 Ledger NarrativeEvent 或 Core 七项变为 WorldCommit。

### D 类 · 延期能力与资源

WorldRelayKeyDelivery / SharedCryptoAdapter / 最小生产群 key package/acceptance / producer 留 c-2d；SharedRelayPrototype / SharedRelayDurableCache / 完整独立双客户端生产重放链留 c-2e；SharedTlsEdge / LAN HTTPS / 两台实际设备与证书边界留 c-2f；产品主链接线留 c-3 另议。测试注入的完整 validator/native crypto 与 fsync 文件能力不提前宣布上述能力完成。

P4 长期账号/root/key 保护恢复、完整 FileCarry/异步加密迁移，P5 trusted host/TPM/attestation/物理设备/平台 OfflineGrace 均保持延期。服务器独立函数可用于受批准本机原型，正式 world/Genesis/manifest/pins、长期 key、LAN 地址/SAN/CA 信任与防火墙仍需对应阶段操作员资源；无云账号依赖。

Trae 只按授权追加 A 类及 B/C/D 状态；历史 raw FAIL、暂停记录、既有名库与裁定不回写。本提案不是 GPT 修改 docs 的授权。
