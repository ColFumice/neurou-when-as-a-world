﻿领域 冻结名（名库 v0） 备注

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
