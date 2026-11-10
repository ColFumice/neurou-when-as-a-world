﻿﻿﻿# 旧名库全景索引（refactor-r0 / 任务 1）

- 源文件：`docs/NAMEBOOK.md`（178559 字节，SHA256 `398ED2E5AE2581094708FD5EDBEF958E9FCA20A3CBCCBC79F1A8CF7D9D381DAC`，止于名库 v3.21 / VERDICT-451）
- 生成时间：2026-10-18（Asia/Shanghai）
- 生成者：Trae（EXECUTOR），只读提取，不修改源文件
- 用途：重构 R0 拍照存证，供 PROTOCOL 起草重构边界与命名空间裁定使用

## 判定规则（机械，不臆造）

按以下优先级命中即定：

1. 名称为 Cocos / 表现层组件或组合根（FrameDriver、CameraRig、InputCollector、ProtagonistView、ChartPadView、PerceptionFilter、TrailRender、LineEraseEffect、SceneBuilder、DebugPanel、各 *View / *Builder / presentation 表现接线名等）→ **废止**
2. 名称涉及引导线谱面（GuidanceChart、GuidanceLine、HeadNode、TapNode、DragNode、HoldNode、resolveGridKeyAt、HEAD_WINDOW_MS 及全部 Guidance* 实现名）→ **废止**（用户已明确取消引导线，改为 8 格网格）
3. 名称涉及 20 维 / 痕 / 账本 / 魔王曲 → **保留**
4. 名称涉及认证 / 账号 / 状态 / 跨设备 / 分叉 / Relay / 共享契约 → **重审**（技术栈变更，服务端去留未定）
5. 其余 → **重审**

同时命中多条时按优先级取先，备注于语义列。无法机械判定的标 **待裁定**。

## 版本标签约定

名库 v2.5 之前为无编号平铺段，按行位机械标注：

| 标签 | 行区间 | 内容提示 |
|---|---|---|
| v0 | 1~16 | 名库 v0 表 |
| v0.1 | 19~51 | v0.1 增补 |
| 段① | 53~67 | 事件空间/感绪/魔王曲/同步机制/空间单位批 |
| 段② | 69~83 | 共享/权限/合并/服务/魔王曲更名批 |
| 段③ | 85~99 | 地图权限/异痕/AI/谱面体系批 |
| 段④ | 101~115 | 瞬间/共情/入口/感知模式/共同开发批 |
| 段⑤ | 117~141 | 自动接管/账本附加/章节/直译结构批 |
| 段⑥ | 143~157 | 彼岸/时长上限/迁移/回映批 |
| 段⑦ | 159~171 | 彼岸设定/叙事目标批 |
| 段⑧ | 173~187 | 终末彼岸/恢复/主界面批 |
| 段⑨ | 189~203 | 主界面状态/源码立方/诗批 |
| 段⑩ | 205~219 | 向量错乱/文本档案批 |
| ROUND-12 | 221~227 | HANDOFF-ROUND-12 补登 |
| 段⑪ | 229~243 | 主界面恢复/收录/20 维批 |
| T0 批 | 247~259 | 同步验证/表现层骨架/意图接口批 |
| T1~T5 批 | 263~271 | 主角/表现组件/纵深批 |
| 跳跃批 | 275~301 | Jump/垂直物理批 |
| T6 批 | 305~351 | 可见性/节奏敲击/键位修订批 |

---

## 1. 世界 / 地图 / 空间

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| WorldInstance | v0 | — | 世界运行实例 | 重审 |
| WorldKind（Primary / Shore） | v0 | — | 世界类别判别 | 重审 |
| WorldLink | v0 | — | 彼岸世界弱引用 | 重审（规则 4：v3.10 起为七项状态之一） |
| Layer | v0 | — | 世界分层 | 重审 |
| WorldMap / CommunityMap | v0 | — | 世界地图 / 社区共享地图 | 重审 |
| ForeignAnchor | v0 | — | 外来锚点 | 重审 |
| LinkState（Bound / Orphaned） | v0.1 | — | 引用绑定/孤立状态 | 重审 |
| SpawnPoint / SpawnZone | v0.1 | — | 生成点 / 生成区 | 重审 |
| EventSpaceCenter | v0.1（v3.8 复活） | — | 事件空间初始球心（20 维配置） | 重审 |
| WorldMeter / ScaleRef / MapScaleCalibration | 段① | — | 世界长度单位与刻度校准 | 重审 |
| LateralAxis / DepthAxis | 段① | — | 横轴 / 纵深轴 | 重审 |
| MapCenter / CenterDistance / EventDistance | 段① | — | 地图中点与两类距离 | 重审 |
| ViewDistance | 段① | — | 视距 | 重审 |
| MapEditPermission / MapEditCommit | 段③ | — | 地图编辑权限与提交 | 重审（规则 4：共享契约沿用） |
| EditTarget | 段④ | — | 共同开发编辑目标 | 重审 |
| GatePosition | 段⑤ | — | 星门坐标（LateralAxis/DepthAxis 承载） | 重审 |
| WorldThemeColor | ROUND-12 | — | 世界主题色字段 | 重审 |
| DEPTH_RANGE_WM | T1~T5 批 | — | 纵深总跨度常量 | 重审 |
| VerticalAxis | 跳跃批 | src/world/VerticalAxis.ts | 垂直轴（WorldMeter 向上） | 重审 |
| moveAlongAxes / MoveInput / MovementResult | ROUND-12 追认 | world 域 | 双轴移动推进 | 重审 |
| calculateCenterDistance | ROUND-12 追认 | world 域 | 距中点距离计算 | 重审 |
| WorldGameplayContext | v3.8 | director / assets/scripts | 世界玩法上下文契约 | 重审 |
| WorldNarrativeContent / WorldNarrativeChoice / parseWorldNarrativeContent | v3.8 | director | Primary 世界最小叙事内容结构 | 重审 |
| EmptyWorld | v3.6 | — | 目录模板判别值 | 重审 |
| MinimalWorldBuilder | v3.6 | assets/scripts | 最小箱庭装配组合根（规则 1） | 废止 |
| SharedPosition | v3.17 | — | 共享地图整数 milli 坐标 | 重审（规则 4） |
| SharedContentReference | v3.17 | — | 批准内容引用 | 重审（规则 4） |
| SharedMapEntityDefinition / SharedTriggerDefinition | v3.17 | — | 共享实体/触发器定义 | 重审（规则 4） |
| MapEditOperation | v3.17 | — | 地图编辑操作联合 | 重审（规则 4） |
| SharedEntityRecord / SharedTriggerRecord | v3.17 | — | 共享实体/触发器记录（含 tombstone） | 重审（规则 4） |

## 2. 事件 / 账本 / 维度（20 维）

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| NarrativeEvent | v0 | ledger 域 | 叙事事件（账本条目） | 保留 |
| LiveWorldEvent | v0 | — | 现场世界事件 | 保留 |
| Trigger | v0 | — | 触发器 | 重审（地图交互对象） |
| PuzzleChain / PuzzleProgress | v0 | — | 解谜链与进度 | 重审（解谜概念存续，实现重审） |
| Ledger | 段⑤ | ledger 域 | 账本容器类型 | 保留 |
| LedgerPosition | 段① | ledger 域 | 账本向量累计和 | 保留 |
| AppendedAt | 段① | — | 账本追加时刻 | 保留 |
| EmotionWindow / EmotionWindowSum | 段① | — | 感绪窗口与合计 | 保留 |
| InputSource（Player / Autopilot） | 段⑤ | — | 账本输入来源标记 | 保留 |
| ChapterTag | 段⑤ | — | 账本章节标签 | 保留 |
| LedgerWindow / ScalingWindow | 段⑤ | — | 账本窗口 / 共情换算窗口（1 小时） | 保留 |
| Chapter | 段⑤ | src/director/Chapter.ts | 章节类型（S5 叙事导演域） | 重审 |
| NarrativeDimension（20 维，第 17 维 TruthLevel） | 段⑪ | — | 20 维叙事维度定义 | 保留 |
| VectorSchemaVersion = 1 | 段⑪ | — | 向量结构版本 | 保留 |
| DivergenceAxis | 段⑤（两维）/ v3.8（六色） | director | 六大情感维度轴 | 保留 |
| RouteSignature / RouteCoverage | v0.1（v3.8 精确化） | — | 路线签名与覆盖 | 保留 |
| classifyDivergenceAxis / deriveRouteSignature | v3.8 | director | 维度分类与路线推导 | 保留 |
| deriveLedgerPosition | v3.8 | ledger | 账本位置推导 | 保留 |
| validateNarrativeVector | v3.8 | ledger | 20 维向量校验 | 保留 |
| DimensionReadout / ToneSummary | 段⑤ | — | 维度读出 / 基调摘要 | 保留 |
| EmpathyScaling / ScalingBasis | 段④ | — | 共情换算与基准 | 保留 |
| RecentEmpathy / EmpathyWeightedShare | ROUND-12 | — | 近期共情 / 截图时长分配 | 保留 |
| EmotionToTrailColor / TrailColor | v0.1 | — | 感绪→拖尾色映射与色值 | 保留（渲染实现见规则 1） |
| SphereCrossing | 段①（v3.8 重实现） | director | 球面穿越业务事件 | 保留（账本来源事件） |
| CharacterUnlock | 段① | — | 角色解锁 | 重审 |
| getLedgerEvents | v2.5 修复批 | — | 账本事件读取 | 保留 |
| bindLedgerSource | v3.8 | DirectorSession | 账本源绑定 | 保留 |
| LedgerSnapshot / LedgerHydration / LedgerHydrateResult / validateLedgerNarrativeEvent | v3.9 | director | 账本快照与水合校验 | 保留（兼规则 4 状态恢复，按规则 3 优先） |
| ChartEntry | v0（v3.8 扩展 source） | — | 谱面进入权限（账本派生） | 保留 |
| ControlGrant / SwitchEligibility | v0 | — | 权限授予 / 切换资格（账本派生） | 保留 |
| WorldClearRecord | v0.1（v3.8 实装） | director | Primary 首通账号记录 | 重审（规则 4：账号事实） |
| WorldClearSession / WorldClearStorage / WorldClearProjection / WorldClearSnapshot / WorldClearReader / WorldClearCallbacks | v3.8 | director / presentation | 通关链路会话与载体 | 重审（规则 4） |
| WorldClearCompletionStatus（NotCleared / Pending / Failed / Completed / Inherited） | v3.8（v3.11 增 Inherited） | director | 通关完成状态 | 重审（规则 4） |
| validateWorldClearRecord / validateWorldClearProjection / commitRecord / reconcileAccount | v3.8 | director / presentation | 通关记录校验与提交 | 重审（规则 4） |
| ChartReferenceClassification / classifyChartReference / hasChartPremiereCompleted | v3.8 | director | 谱面引用分类（魔王曲首演事实判定） | 保留 |
| WorldClearAccountLock | v3.8 | presentation | 账号提交锁适配 | 重审（规则 4） |
| WorldClearView / WorldChartView | v3.8 | presentation | 通关/谱面 UI 视图（规则 1） | 废止 |
| ChooseWorldNarrative / EnterWorldChart / RetryWorldClear | v3.8 | PlayerIntent.kind | 三种玩家意图判别值 | 重审 |
| WORLD_PREMIERE_COMPLETED / WORLD_NARRATIVE_CHOICE 事件 ID 格式 | v3.8 | — | 完成/选择事件 ID 模板 | 重审 |

## 3. 痕 / 元素 / 可见性

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| Trace | v0 | trace 域 | 痕 | 保留 |
| TraceTier（Common / Deep / Rain） | v0 | trace 域 | 痕层级 | 保留 |
| TraceOrigin（Normal / Anomalous / Echo） | v0（段③扩 Echo） | trace 域 | 痕来源 | 保留 |
| DeepTrace | v0 | trace 域 | 深痕 | 保留 |
| RainTrace / RainTraceTint | v0 | trace 域 | 雨痕与着色 | 保留 |
| EchoTrace | 段③ | trace 域 | 回响痕（个人层） | 保留 |
| TraceTouch | 段② | — | 触痕共享聚合投影 | 保留（共享实现按规则 4 重审） |
| AnomalyDisclosure（Masked / Disclosed） | v0.1 | — | 异痕披露状态 | 保留 |
| AnomalyCause（ForcedRollback / MergeConflict / OrphanCommit / RevertedEdit） | 段③ | — | 异痕成因 | 保留 |
| WitnessSight | v0 | — | 目击视觉（异痕感知） | 保留 |
| RhythmStrike | T6 批 | trace 模块 | 节奏敲击 | 保留 |
| RHYTHM_STRIKE_WINDOW_MS = 100 | T6 批（v3.2 修订 50→100） | constants | 节奏敲击窗口 | 保留 |
| TraceProximityVolume | T6 批 | trace 域 | 痕接近体积 | 保留 |
| bindT6Trace / traceBindings | v3.10 | director | 痕-事件绑定记录 | 保留 |
| DeepTraceRevealSequence / ScreenInvertRipple / ExposurePulse | T6 批 | presentation | 深痕揭示表现序列（规则 1，概念保留实现废止） | 废止 |
| ElementType（Initial / Process / Trace / Highlight / Commented / Residue；实体层 4 值） | v0 / v0.1 | — | 元素类型 | 重审 |
| VisibilityState（Revealed / Concealed） | v0.1 | — | 可见性状态 | 重审 |
| VisibilityTransitionReason（Trigger / Recall / CacheWarm / Forget） | T6 批 | trace 域 | 可见性转换原因 | 重审 |
| ElementEntitySeed / ElementEntityPosition | T6 批 | trace 域 | 元素实体种子与坐标 | 重审 |
| isRevealed / applyVisibility / getElementType / getVisibilityState | T6 批 | trace 域 | 可见性查询/应用 | 重审 |
| bindVisibilityTrackedEntities / updateElementVisibility | T6 批 | director 域 | 可见性实体绑定与更新 | 重审 |
| PerceptionMode（Normal / Triggered / Rain） | 段④ | director（运行时状态） | 感知模式 | 重审 |
| PerceptionFilter | T6 批 | presentation | 感知滤镜表现（规则 1） | 废止 |
| GROUND_TOLERANCE_WM = 0.05 / TRIGGER_DISTANCE_WM = 2 / FORGET_DISTANCE_WM = 5 | T6 批 | 占位常量 | 落地容差/触发距离/遗忘距离 | 重审 |
| TraceTouchChange / TraceTouchAggregate | v3.17 | — | 触痕变化与聚合（共享契约） | 保留（规则 3 优先，共享实现随规则 4 重审） |
| MonotonicRevealChange | v3.17 | — | 单调显露共享变化 | 重审（规则 4） |

## 4. 谱面 / 音游

### 4a. 魔王曲与谱面生命周期（非引导线）

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| CharacterBossChart / WorldBossChart / FinalBossChart | v0.1 | — | 三级魔王曲谱面 | 保留 |
| FinalBossFile | v0.1 | — | 终末魔王曲文件（段⑥内部废止，概念存档） | 保留 |
| ChartTier（Regular / Character / World / Final） | 段③ | constants | 谱面层级 | 保留 |
| ChartPremiere / ChartReplay / ChartSnapshot / ChartScore | 段③ | — | 首演/重玩/快照/成绩（魔王曲机制） | 保留 |
| ChartRef | 段③（v3.8 增 state） | constants | 谱面引用 | 保留 |
| ReplayEntry（VectorEntry / FileEntry） | 段③ | — | 重玩入口（FileEntry 段⑥内部废止） | 保留 |
| EventSpaceView | 段③ | — | 事件空间视图（重玩入口挂靠） | 保留 |
| BossTier / BossPremiere / BossReplay / BossSnapshot / BossScore | 段② | — | 魔王曲五级体系（段③内部废止，由 Chart* 接替） | 保留 |
| FinalBossPremiere / FinalBossReplay / FinalEnding / FinalBossSnapshot / FinalBossScore | 段① | — | 终末首演体系（段②内部废止四项） | 保留 |
| WorldBossChartSource | v3.8 | chart 域 | 世界魔王曲来源 | 保留 |
| ChartPlaybackState（Ready / Playing / Paused / Completed / Exited） | v2.5 | chart 域 | 谱面播放状态机 | 重审 |
| ToggleChartPause | v2.5 | 意图 | 暂停切换意图 | 重审 |
| Note（timeMs / keyId） | v0（v2.5 谱面化） | chart 域 | 谱面条目 | 重审 |
| KeyboardPadLayout / KeyPadSlot / ChartKeyId / ChartPadKind（Regular / Drum / Heavy） | v2.5 | chart 域 | 键盘打击垫布局与键位白名单 | 重审 |
| PERFECT_WINDOW_MS = 100 / GOOD_WINDOW_MS = 200 | v2.5（v3.2 修订） | constants | 判定窗口 | 重审 |
| Strike（videoTimeMs / keyId 载荷） | T0 批（v2.5 扩载荷） | PlayerIntent | 敲击意图 | 重审 |
| AudioOutputClock / beatClockOffsetMs / bindBeatClockProbe / beatClockProbe | v2.5 | chart 域 | 输出对齐拍点时钟与偏移 | 重审 |
| nextBeatTimeMs / resetSustained / beatIntervalMs | v2.5 修复批 | — | 拍点推进内部名 | 重审 |
| CHART_BASE_SCORE / CHART_TRANSPARENCY_BONUS_MAX | v2.5 | constants | 谱面计分常量 | 重审 |
| PAD_LAYOUT_VERSION / createDefaultKeyboardPadLayout | v2.5 | chart 域 | 布局版本与默认构造 | 重审 |
| worldStrikeResetter / chartContextProvider / bindChartContextProvider / worldMotionProvider / bindWorldMotionProvider / clearHeldInput / bindWorldStrikeResetter | v2.5 修复批 | — | 谱面-世界接线 | 重审 |
| evaluatePuzzleApproach | v2.5 修复批 | — | 解谜接近评估 | 重审 |
| PuzzleChainStage | v2.5 | — | 解谜链阶段 | 重审 |
| ChartPadView | T7（v2.5 前） | presentation | 打击垫表现组件（规则 1） | 废止 |
| ChartArchive / ChartArchiveContext / ChartMediaIdentity / ChartVisualSnapshot / ChartContentManifest / ChartSnapshotRecord / ChartSnapshotCollection / ChartScorePlay / ChartScoreRecord / ChartScoreSnapshot / ChartArchiveCandidate / ChartPremiereArchiveInput / ChartReplayArchiveInput / parseChartContentManifest / chartContentDigest | v3.10 | src/director/ChartArchive.ts | 谱面快照/成绩持久档案 | 重审（规则 4 状态载体，魔王曲概念保留） |
| ChartReplaySession | v3.10 | src/director/ChartReplaySession.ts | 谱面重演会话 | 重审 |
| ChartReplayView | v3.10 | presentation | 重演呈现视图（规则 1） | 废止 |
| ReplayChart / RecallEvent / ReplayTrace（PlayerIntent 变体） | v3.10 | PlayerIntent | 三种重玩/回忆意图 | 重审 |

### 4b. 引导线谱面（整体废止）

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| GuidanceChart / GuidanceLine / GuidanceNode | v2.6 | chart 域 | 引导线谱面/线/节点联合 | 废止 |
| HeadNode / TapNode / DragNode / HoldNode | v2.6 | chart 域 | 四类引导线节点 | 废止 |
| ChartNodeKind（Tap / Drag / Hold） | v2.6 | chart 域 | 节点类别 | 废止 |
| NodePath（Polyline） | v2.6 | chart 域 | 节点路径 | 废止 |
| JudgmentPoint | v2.6 | chart 域 | 判定点 | 废止 |
| LineEraseEffect | v2.6 | presentation | 线擦除表现 | 废止 |
| resolveGridKeyAt | v2.6 | chart 域 | 网格取键 | 废止 |
| HEAD_WINDOW_MS = 1000 | v2.6（v2.6 修订自 100） | constants | 头节点启动窗口 | 废止 |
| GuidancePosition / parseGuidanceChart / measurePathLength / positionAtPathDistance | v2.7 | chart 域 | 引导线坐标与解析 | 废止 |
| GuidanceLineRuntime / GuidanceLineState / GuidanceJudgement | v2.7 | chart 域 | 单线运行时 | 废止 |
| GuidanceNodeSnapshot / GuidanceLineSnapshot / getGuidanceSnapshot | v2.7 | chart 域 | 线快照 | 废止 |
| bindHeadLogo / bindHeadPosition / bindContentSize / clearVisuals / bindChartMediaProbe | v2.7 | presentation | 头节点表现接线 | 废止 |
| UseGuidanceChart / phase / Down / Up | v2.7 | — | 引导线谱面使用标记 | 废止 |
| slicePathByDistance / getTotalNodeCount / releaseWhilePaused | v2.8 | chart 域 | 路径截取与暂停释放 | 废止 |
| disappearAtMs / holdActive / holdRemainingPoints | v2.8 | chart 域 | Hold 状态字段 | 废止 |
| GuidanceNodeStatus / GuidanceArrival / advanceTimeline / holdStarted / holdInterrupted / drawHoldRange | v2.8 | chart 域 | 节点推进内部名 | 废止 |
| GuidanceChartRuntime / getGuidanceSnapshots / getTapCandidate / allowTap / allowHead / lineId / headPosition / headSprites | v2.9 | chart 域 | 多线协调器 | 废止 |
| TimedGuidanceLine / GuidanceNodeTiming / GuidanceTimeAnchor | v3.0 | chart 域 | 绝对时间表引导线 | 废止 |
| GuidanceVisualData | v3.0 | editor 域 | 节点颜色伴随数据 | 废止 |
| ChartResourcePath / chartResourcePath / showChartLoadError | v3.5 | assets/scripts SceneBuilder | 谱面资源路径接线（规则 1） | 废止 |
| bindNodeColors / nodeColors | v3.5 | ChartPadView | 颜色表现接线（规则 1） | 废止 |
| SceneBuilder | v3.5 等 | assets/scripts | 场景组合根（规则 1） | 废止 |
| 引导线资源 ID（guidance-b-1、line-c-a 等 22 项） | v2.8 / v2.9 | assets | 测试资源标识 | 废止 |

## 5. 编辑器 / 音乐编辑器

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| NoteColor | v3.0 | editor 域 | 节点颜色（sRGB uint8） | 重审 |
| MidiNoteEvent | v3.0 | editor 域 | MIDI 源事件 | 重审 |
| ChartSourceData | v3.0 | editor 域 | 谱面上游源快照 | 重审 |
| EditorSelection / EditorHistory | v3.0 | editor 域 | 编辑选择与有界历史 | 重审 |
| GuidanceEditorDocument / GuidanceEditorSession / GuidanceEditorReader / GuidanceEditorIntent / GuidanceEditorPort | v3.0 | editor 域 | 引导线编辑器草稿体系（规则 2） | 废止 |
| GuidanceEditorView | v3.0 | presentation | 编辑器 Cocos UI（规则 1+2） | 废止 |
| GuidanceEditorBuilder | v3.0 | assets/scripts | 编辑器组合根（规则 1+2） | 废止 |
| parseNoteColor / parseChartSourceData | v3.0 | editor 域 | 源数据解析 | 重审 |
| parseGuidanceVisualData / getLineTimeAnchors / guidanceDistanceAtTime / guidanceNodeTime | v3.0 | editor / chart 域 | 引导线时间换算（规则 2） | 废止 |
| getDocument / getPreview / getPreviewData / getLayout / exportChart / submitEditorIntent / bindEditor | v3.0 | editor 域 | 编辑器会话接口（规则 2） | 废止 |
| 编辑器意图判别值（LoadSource / LoadDraft / LoadPreview / SetKind / SetHead / SetHoldEnd / SetMedia / Undo / Redo / StartPreview / StopPreview / Seek / Advance / Strike / Pause） | v3.0 | editor 域 | 编辑操作判别值（规则 2） | 废止 |
| 预览模式 Manual / Rehearsal | v3.0 | editor 域 | 预览模式（规则 2） | 废止 |
| 编辑器目录 ID（15 项）：EditorRoot / MusicEditor / RgbWavetableEditor / GridEditor / MidiTrackEditor / MapEditor / NarrativeEventEditor / StoryEditor / PasserbyEditor / SubtitleEditor / VideoTimingEditor / PositionEditor / SpecialNarrativeEventEditor | v3.1 | — | 编辑器目录树标识 | 重审 |
| ChartEditor / GuidanceEditor（目录 ID） | v3.1 | — | 谱面/引导线编辑器目录标识（规则 2） | 废止 |
| musicEditor（模块） | v3.3 | src/musicEditor | 音乐创作纯逻辑模块 | 重审 |
| MusicProjectData / TrackDefinition / NoteDefinition / TempoPoint / MusicTimeSignature | v3.3 | musicEditor | 音乐工程数据结构 | 重审 |
| MusicEditorDocument / MusicEditorHistory / MusicEditorSession / MusicEditorReader / MusicEditorPort / MusicEditorIntent | v3.3 | musicEditor | 音乐编辑器草稿体系 | 重审 |
| ChartSourceBuilder / buildChartSource | v3.3 | musicEditor | 工程→ChartSourceData 转换 | 重审 |
| MusicPlaybackNote | v3.3 | musicEditor | 试听音符 | 重审 |
| MusicEditorView / MusicPreviewAudio | v3.3 | presentation | 音乐工作区 UI 与试听适配（规则 1） | 废止 |
| MusicEditorBuilder | v3.3 | assets/scripts | 音乐编辑器组合根（规则 1） | 废止 |
| parseMusicProjectData / createDefaultMusicProject / parseMusicEditorDocument / tickToTimeMs / timeMsToTick / musicProjectDurationMs / musicMeasureTicks / midiPitchToFrequency | v3.3 | musicEditor | 音乐纯函数组 | 重审 |
| MusicEditorIntent 判别值（LoadProject / LoadDraft / AddNote / ChangeNote / DeleteNote / SetTempo / Undo / Redo / DeleteNotes / MoveNotes / PasteNotes） | v3.3 / v3.4 | musicEditor | 音乐编辑操作 | 重审 |
| selectedNoteIds / anchorNoteId / clipboard / pointerGesture / pointerPosition / marqueeWidth / marqueeHeight | v3.4 | UI 私有 | 批量选择 UI 状态 | 重审 |
| WavetableDefinition / GridDefinition | v3.3 | 预留 | 音色/网格预留提案 | 重审 |

## 6. 认证 / 账号 / 状态 / 跨设备 / 分叉

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| AccountProfile / AccountGrant | v0.1 | — | 账号档案与授权 | 重审 |
| AccountMilestone / FirstWorldCleared / CopyPermission | v0.1 | — | 账号里程碑/首通/复制权限 | 重审 |
| SightSource（Publication / WorldCompletion） | v0.1 | — | 能力来源 | 重审 |
| AccountMilestone.PrologueCompleted | 段⑦ | — | 序章完成里程碑 | 重审 |
| AccountMilestone.ShoreRestored | 段⑨ | — | 主界面恢复里程碑（段⑩前已废止） | 重审 |
| RecallCount / Recall / Replay | v0.1 | — | 回忆计数与操作 | 重审 |
| WallClock / FormatTime | v0.1 | — | 现实时间结构 | 重审（FormatTime 兼规则 4 七项状态） |
| WorldRegistry / DuplicateWorld | v0.1 | — | 世界注册表/复制品（历史名，未实装） | 重审 |
| WorldFork | v0.1（v3.11 实装） | director | 世界分叉 | 重审 |
| OfflineSession | 段① | — | 离线会话 | 重审 |
| AccountStartupSession / AccountStartupSnapshot / AccountStartupIntent / AccountStartupReader / AccountStartupPort | v3.1 | director | 账号启动编排 | 重审 |
| AccountStartupStorage | v3.1 | presentation | 启动事实存储适配 | 重审 |
| WorldFolderRecord / WorldFolderSnapshot / WorldFolderIntent / WorldFolderPort / WorldFolderSession | v3.6 | director | 世界目录会话 | 重审 |
| WorldLocalStorage | v3.6 | presentation | 目录本地存储适配 | 重审 |
| AccountMilestoneStorage / AccountMilestoneProjection / AccountMilestoneSnapshot / AccountMilestoneReader / createAccountMilestoneReader | v3.7 | presentation / director | 里程碑投影链 | 重审 |
| WorldStateSession / WorldStateSnapshot / WorldStateCaptureResult / WorldStateRestoreResult / WorldStateDiagnostic / WorldStateReader / WorldStateStorage / validateWorldStateHeader | v3.7 | director / presentation | 七项世界状态契约 | 重审 |
| WorldForkAvailability（NotImplemented / Implemented） | v3.7（v3.11 增） | director | 分叉可用性 | 重审 |
| WorldCoreStateSnapshot / WorldStateCodec / FormatTimeSnapshot | v3.9 | director | Core 状态壳与编解码 | 重审 |
| WorldCoreStateStorage / FormatTimeStorage / WorldStateLock / WorldStateLease | v3.9 | presentation | Core 存储/锁/租约 | 重审 |
| WorldRuntimeIdentity | v3.9 | assets/scripts | 组合根运行身份 | 重审 |
| WorldCoreStateView | v3.9 | presentation | Core 状态只读视图（规则 1） | 废止 |
| PuzzleChainPrivateState / validatePuzzleChainPrivateState / PuzzleProgressSnapshot / PuzzleControlState / validatePuzzleProgressSnapshot / validatePuzzleControlState | v3.9 | trace / director | 解谜私有状态快照 | 重审 |
| T6_MAIN_CHAIN / T6_MAIN_DEEP_TRACE | v3.9 | — | 正式内容索引 ID | 重审 |
| RecallCountSession / RecallCountSnapshot / RecallCountContext / RecallCountCallbacks / RecallCountHydrateResult / RecallCountOperationResult | v3.10 | src/director/RecallCountSession.ts | 回忆计数会话 | 重审 |
| WorldLinkContext / WorldLinkSnapshot / WorldLinkSource / WorldLinkSourceReader / WorldLinkSession / validateWorldLinkSnapshot | v3.10 | src/director/WorldLinkSession.ts | 彼岸链接会话 | 重审 |
| createPrimaryWorldStateCodec / isValidatedWorldStateSnapshot / WorldStatePreparedRestore | v3.10 | director（PrimaryWorldState.ts / WorldStateCodec.ts / WorldStateSession.ts） | 状态编解码与预备恢复 | 重审 |
| WorldMemoryView | v3.10 | presentation | 回忆只读视图（规则 1） | 废止 |
| WorldForkOrigin / validateWorldForkOrigin | v3.11 | src/director/WorldForkOrigin.ts | 分叉来源头 | 重审 |
| WorldForkPlan / WorldForkBindings / WorldForkSession / rebaseWorldState / validateWorldForkPlan | v3.11 | src/director/WorldForkSession.ts | 分叉事务会话 | 重审 |
| ForkWorldClearSession | v3.11 | src/director/ForkWorldClearSession.ts | 分叉通关会话扩展 | 重审 |
| WorldForkStorageBindings / WorldForkCommitResult / WorldForkRecoveryResult / WorldForkStorage / WorldForkJournal | v3.11 | src/presentation/WorldForkStorage.ts | 分叉存储事务 | 重审 |
| requestIfAvailable / hasWorldLease / removeUnpublishedCoreState | v3.11 | presentation | 租约增量方法 | 重审 |
| WorldHomeRegistry / HomeDevice / HomeState（Homed / Released）/ WorldHomeContext / WorldHomeRecord / WorldHomeRegistrySnapshot / WorldHomeRegistrationRequest / WorldHomeRegistrationReply / WorldHomeRegistryDiagnostic / WorldHomeRegistryReadResult / WorldHomeRegistrationResult / WorldHomeAuthorityPort / WorldHomeRegistryBindings / WorldHomeRegistryCodec / WorldHomeRegistrySession | v3.12 | src/director/WorldHomeRegistry.ts | 账号×世界设备归属索引 | 重审 |
| WorldHomeContractBindings / WorldHomeContractAdapter | v3.12 | src/director/WorldHomeContractAdapter.ts | 归属契约适配 | 重审 |
| CrossDeviceDuplicate / CrossDeviceDuplicateResult | v3.13 | director | 跨设备复制检测 | 重审 |
| CoreTransferPayload / CoreTransferProof / CoreTransferCodec / CoreTransferCompleteValidator / validateCoreTransferContent | v3.13 | src/director/CoreTransfer.ts / CoreTransferContent.ts | 受限 Core 传输载荷 | 重审 |
| CrossDeviceAuthorityPort / CrossDeviceImportRequest / CrossDeviceImportPlan / CrossDeviceImportPhase / CrossDeviceImportEntry / CrossDeviceImportJournal / CrossDeviceImportReceipt / CrossDeviceImportBindings / CrossDeviceImportAdapter | v3.13 | src/director/CoreTransfer.ts | 跨设备导入事务 | 重审 |
| validateTransferFolder / transferFields / copyTransferData | v3.13 | src/director/CoreTransfer.ts | 传输辅助函数 | 重审 |
| CrossDeviceContractAdapter / CrossDeviceContractBindings | v3.13 | presentation | 跨设备契约适配（表现侧） | 重审 |
| CrossDeviceImportStorage / CrossDeviceImportStorageBindings / CrossDeviceImportRecoveryResult | v3.13 | presentation | 导入存储适配 | 重审 |
| CrossDevicePrototype / CrossDevicePrototypeBindings / LogicalDeviceStorage / prototypeLocks | v3.13 | assets/scripts/CrossDevicePrototype.ts | 双逻辑设备原型组合根（规则 1 兼规则 4，按规则 4） | 重审 |
| WorldMigration / MigrationRelease / MigrationClaim / Migrated | 段⑥ / v3.14 | director | 世界迁移 | 重审 |
| RealityPause / OfflineGrace / SafePoint | 段② / 段⑥ | — | 现实暂停/离线宽限/安全点 | 重审 |
| SafePointDrainWorld / SafePointDrainConfirmation / SafePointDrainCapability / SafePointDrainAcceptance / SafePointDrainPort | v3.14 | src/director/WorldMigration.ts | 排空确认体系 | 重审 |
| MigrationReleaseRequest / MigrationClaimRequest / MigrationReceipt / MigrationAdmission / MigrationAuthorityPort / MigrationCompleteValidator / WorldMigrationCodec / RealityPauseBoundary | v3.14 | src/director/WorldMigration.ts | 迁移请求/回执/准入 | 重审 |
| RealityPauseRecord / DeviceAccountBinding / RestrictedMigrationCorePayload / WorldMigrationPhase / WorldMigrationEntry / WorldMigrationJournal / WorldMigrationStorageReceipt | v3.14 | src/director/WorldMigration.ts | 暂停记录/绑定/迁移日志 | 重审 |
| SafePointDrainAccountFacts / SafePointDrainBindings / isLiveSafePointDrainCapability / SafePointDrainStorage | v3.14 | presentation | 排空执行适配 | 重审 |
| WorldMigrationAuthorityLock / WorldMigrationContractBindings / WorldMigrationContractAdapter / WorldMigrationStorageBindings / WorldMigrationRecoveryResult / WorldMigrationStorage / WorldMigrationPrototypeBindings / WorldMigrationPrototype / ContractServiceClock | v3.14 | presentation / assets/scripts | 迁移合约与原型 | 重审 |
| FormatTimeStorage / initializeFormatTime / readFormatTime | v3.9 | presentation | FormatTime 存储 facade | 重审 |
| AIProfileSnapshot | v0.1 | — | AI 档案快照（孤立恢复依赖） | 重审 |

## 7. 服务 / Relay / 共享契约

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| Observer / ObserverSync / ObserverLayer / WorldObserver / ObserverSyncChannel | 段① | — | 观察者同步体系 | 重审 |
| SharedWorldState / WorldChangeLog / WorldCommit | 段①（v3.17 精确化） | — | 共享状态/日志/提交 | 重审 |
| FileCarry / CommitRelay | 段① | — | 文件携带/提交中继 | 重审 |
| SharingCriteria | 段② | — | 共享三条判定规则 | 重审 |
| WorldDeveloper / StudioDeveloper / AccessCode | 段② | — | 开发者权限/准入码 | 重审 |
| WorldCheckpoint / SettleHorizon | 段② | — | 检查点/结算视界 | 重审 |
| AuthService / fetchServerTime | 段② / ROUND-12 | — | 认证服务/服务器时间 | 重审 |
| CoDeveloper / DeveloperRoster / EditPresence | 段④ | — | 共同开发名单/在场 | 重审 |
| RealServiceMode / ExternalService | v3.16 | src/director/RealServiceContracts.ts | 真实服务模式字面值 | 重审 |
| RegisteredDeviceAssurance / RegisteredCredential | v3.16 | 同上 | Web 凭据持有保证 | 重审 |
| ServicePublicKey / AuthorityTrustAnchor | v3.16 | 同上 | 服务公钥/信任锚 | 重审 |
| RealServiceEnvironment / RealAccountFact / RealRegisteredDeviceFact / AuthenticatedServiceContext / AccountLoginRequest / ServiceFault / ServiceReply / ServiceReceiptPurpose / SignedServiceReceipt / DeviceChallenge / ServiceAuthenticationPayload / ServerTimeSample / RealAccountFacts | v3.16 | 同上 | 真实认证契约类型组 | 重审 |
| RealAuthServicePort / RealAuthServiceAdapter | v3.16 | director / presentation | 真实认证端口与适配 | 重审 |
| buildRealAuthService / RealServiceBuilder | v3.16 | assets/scripts | 真实链装配（规则 1 兼规则 4，按规则 4） | 重审 |
| RealWorldAuthorityPort / RealCommitRelayPort | v3.16 | director | 保留端口（边界冻结/未实施） | 重审 |
| WorldCommitIdentity / SharedAppendedAt / AuthorSequenceSegment / WorldAppendPermit / WorldCommitAdmissionClaim / SignedWorldCommitAdmissionClaim / WorldCommitAdmission / WorldCommitRejection / WorldAuthorKeyBinding / WorldDeveloperClosureFact | v3.17 | —（v3.18 复写于 SharedCommitContracts.ts） | 共享提交身份与权威事实 | 重审 |
| WorldChangeClass / SharedCommitClass / WorldChange / MapEditCommitChange / DeveloperRosterChange | v3.17 | 同上 | 共享变化分类 | 重审 |
| WorldSharedGenesis / RestrictedWriteHeader / RelayCommitHeader / WrappedRelayDataKey / RelayCommitEnvelope / AdmittedWorldCommit | v3.17 | 同上 | 创世/外壳/信封 | 重审 |
| DeveloperRosterState / WorldChangeLogWire / RelaySettlementSeal / CheckpointCoverageEntry / WorldCheckpointWire / SharedSettlementPolicy / RelayCursor / RelayPullReply / SharedAuthorityReceipt&lt;T&gt; | v3.17 | 同上 | 名单/日志/封边/游标 | 重审 |
| WorldRelayKey / WorldDeveloperTrustAnchor / WorldKeyAgreementPublicKey / WorldObserverAdmissionFact / WorldMemberCredential / WorldRelayKeyDescriptor / WorldMembershipEpoch / WorldMembershipEpochProposal / WorldMembershipChange / WorldRelayKeyPackageContext / WorldRelayKeyPackage / WorldRelayKeyAcceptance | v3.17 | 同上 | 成员与群 key 契约 | 重审 |
| B 类契约值域（schemaVersion=1、ExternalSharedOnlineV1、AES-256-GCM-HKDF-SHA256-v1、ES256、1024 号段、G/B/U/H/retention、14 个签名域常量等） | v3.17 | — | 共享契约常量 | 重审 |
| SharedSchemaError / SharedCanonicalBytes / SharedCommitCodec / SharedCommitValidator / SharedWorldReducer | v3.18 | src/director/Shared*.ts（5 份） | 契约编解码/验证/重放实现 | 重审 |
| SharedSchemaErrorCode / SharedAuthorityPayload / SharedSchemaMap / SharedSchemaKind | v3.18 | src/director | codec 辅助类型 | 重审 |
| SharedCryptoPort / SharedValidationContext / SharedValidationResult&lt;T&gt; / TrustedVerifiedGenesis / ValidatedSharedCommit / ValidatedSharedSeal / ValidatedSharedClosure / ValidatedSharedRejection | v3.18 | src/director | 验证器本地 API | 重审 |
| SharedReplayRequest / SharedReplayDiagnostic / SharedProvisionalCoverageEntry / SharedReplayResult | v3.18 | src/director | 重放本地类型 | 重审 |
| SharedServiceProtocolContracts / SharedRelayPrototype / WorldRelayKeyDelivery | v3.19 | src/director | 协议契约/原型/key 交接 | 重审 |
| RealWorldAuthorityAdapter / RealCommitRelayAdapter / RealSharedServiceSessionAdapter / SharedCryptoAdapter / SharedRelayDurableCache | v3.19 | src/presentation | 真实服务适配器组 | 重审 |
| SharedRelayPrototypeBuilder | v3.19 | assets/scripts | 共享原型组合根（规则 1 兼规则 4，按规则 4） | 重审 |
| WorldAuthorityService / WorldAuthorityStorage / RelayService / RelayStorage / AuthorityRoute / RelayRoute / RealAuthorityClock / SharedSessionVerifier / SharedMigrationRunner / SharedTlsEdge / SharedServerConfig / buildSharedServer / shared-main | v3.19 | server/src | 服务器权威/中继/路由/时钟 | 重审 |
| 31 项增量纯类型（RealWorldAuthorityProtocolPort / RealCommitRelayProtocolPort / SharedServiceSessionPort / RegisteredAuthorSigningPort / WorldKeyAgreementPort / WorldDeveloperSigningPort / SharedCommitSealingPort / SharedRelayDurableCachePort / SharedHttpRequest / SharedHttpReply / SharedServiceFault / SharedServiceErrorCode / SharedTransportReceipt / SharedOperationAuthorization / AuthorityProtocolResult / WorldRegistrationProposal / WorldRegistrationRequest / AccessCodeChangeProposal / AccessCodeChangeRequest / WorldServiceFacts / WorldAgreementCredentialFact / WorldObserverChallenge / WorldMemberCredentialChallengeContext / WorldMemberCredentialChallenge / WorldMemberCredentialProof / RelaySubmitFact / RelayAckRequest / RelayAckFact / RelaySubmitReceipt / RelayAckReceipt / SharedProtocolOperation） | v3.19 | src/director | 协议 wire/port 类型 | 重审 |
| 9 个签名域常量与限额常量（SHARED_TRANSPORT_SIGNATURE_DOMAIN 等） | v3.19 | server | 签名域与限额 | 重审 |
| SharedServiceProtocolCodec / SharedReceiptSigner / SharedCryptoProof / SharedBuild | v3.20 | src/director / server | 协议编解码/签发/证明/构建 | 重审 |
| SharedProtocolPayloadMap / SharedProtocolValueMap / SharedProtocolReply / SharedProtocolSignatureKind / SharedProtocolCodecPort / SharedServiceStatusPayload | v3.20 | src/director | 协议映射类型 | 重审 |
| SharedOperatorWorldPin / SharedSession / SharedServiceFailure / AuthorityClockSample / IsolatedClockSource / StoredWorld / sharedEnvironmentConfig / validateSharedConfig / sharedCanonical / sharedUnsigned / verifySharedSignature / makeCredentialChallenge / authorityRoutes / buildSharedRelayPrototype / buildSharedRelayPrototypeForLoopbackHttpTest / buildIsolatedSharedServer | v3.20 | server / assets/scripts | 服务器辅助名 | 重审 |
| RelayStoredStream / RelayStoredCommit / buildRelayServer / buildIsolatedRelayServer / relayRoutes | v3.21 | server/src | Relay 存储行类型与装配 | 重审 |
| 存储 key / 锁名（neurou-* 全部前缀） | v3.1 ~ v3.14 | — | 本地/服务存储保留字 | 重审 |

## 8. 主界面 / 文件夹 / 表现 / AI / 叙事配套

> 事件树：名库中无独立"事件树"冻结名；最接近者为 EditorFolder 目录树（v3.1）与 NarrativeEventEditor 目录 ID，已列入第 5 节。

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| ShoreHub / ShoreHubState（Absent / Damaged / Active） | 段⑧ / 段⑨ | — | 主界面枢纽与状态 | 重审 |
| HubEventSpace / HubOrigin | 段⑧ | — | 主界面事件空间/原点 | 重审 |
| ConstellationGate / ConstellationGateState | 段④ / 段⑤ | — | 星门入口与状态 | 重审 |
| StarPoint / StarLine / LinkStroke | 段④ | — | 星点/星线/连线笔画 | 重审 |
| IdleThreshold（20 秒）/ IdleTimer | 段④ / 段⑤ | — | 闲置阈值与计时 | 重审 |
| StarWindow | 段⑤ | — | 星窗 | 重审 |
| Autopilot / AutopilotThreshold（30 秒） | 段⑤ | — | 自动接管 | 重审 |
| VectorScramble / VectorAccess / UsableVectorRatio / ScrambleCycle / ProgressiveVectorRecovery | 段⑩ / 段⑪ | — | 向量错乱与渐进恢复 | 重审 |
| ShoreOrigin（BugShore / FinalShore） | 段⑥ | — | 彼岸来源 | 重审 |
| ShoreSetting / ShorePrologue / EditorTutorial / StudioOrigin / FinalShoreArc | 段⑦ | — | 彼岸叙事地点组 | 重审 |
| NarrativeGoal（Recollection / Guidance） | 段⑦ | — | 叙事目标 | 重审 |
| FinalShoreState（Present / DeletionIllusion） | 段⑧ | — | 终末彼岸状态 | 重审 |
| SourceCube / RestorationSet / RestorationProgress / ShoreRestoration | 段⑧ | — | 源码立方与恢复 | 重审 |
| SourceCubeDialogue / CubeSecret（PublicPerception / StudioPoem） | 段⑨ / 段⑩ | — | 立方对话与秘密 | 重审 |
| StudioPoem / PoemProfile | 段⑨ | — | 工作室诗与画像 | 重审 |
| QuoteLibrary / StudioPoemLibrary | 段⑨ | — | 名言/诗库（段⑩内部废止） | 重审 |
| TextArchive / ArchiveEntry / TextProvenance / TextKind | 段⑩ | — | 文本档案体系 | 重审 |
| ProvenanceRecord / ProvenanceStatus | 段⑪ | — | 收录记录与状态 | 重审 |
| MomentCapture / MomentInfo | 段④ | — | 瞬间截图 | 重审 |
| MomentImage / ProcessedMomentImage / MomentCapturePostProcess | 段⑤ | — | 截图图像与后处理 | 重审 |
| EndingScope / EndingManifest / EndingItem / EndingProgress / EndingWindow / EndingMemoryDuration / LocalEndingStorage | ROUND-12 | — | 结局回映体系 | 重审 |
| StackedFrame | 段⑥ | — | 回映叠帧 | 重审 |
| MixedVideoDurationCap / GlitchGapDurationCap / GlitchGap / GlitchGapSegment | 段⑥ / ROUND-12 | — | 混剪/故障缺口上限与本体 | 重审 |
| RealityHint | v0.1 | — | 现实提示（纯本地） | 重审 |
| RainMode / RainSubtitle / Raindrop | v0 | — | 雨表现（禁单独 Rain 命名） | 重审 |
| HairColor / DecorationPalette | 段② / ROUND-12 | — | 发色/装饰调色板 | 重审 |
| GreyboxFirst / ArtReviewGate | 段⑧ | — | 灰盒先行/美术评审门 | 重审 |
| AIProvider / CloudProvider / LocalProvider / TemplateProvider / AITaskRoute / FallbackChain | 段③ | — | AI 提供者与路由 | 重审 |
| AIProviderConfiguration / AIProfile / validateAIProfile | v3.10 | src/director/WorldLinkSession.ts | AI 配置与档案 | 重审 |
| WorldFolderView / WorldFolderEntry / WorldFolderReader | v3.1 | presentation | 世界文件夹 UI（规则 1） | 废止 |
| InitialWorld | v3.1 | presentation | 初始世界入口常量 | 重审 |
| EditorFolderView / EditorFolderEntry / EditorCatalog | v3.1 | presentation | 编辑器目录 UI（规则 1） | 废止 |
| FolderStartupView | v3.1 | presentation | 启动界面（规则 1） | 废止 |
| FolderPresentationTheme | v3.1 | presentation（FolderTheme.ts） | 可替换美术参数（规则 1） | 废止 |
| WorldFolderBuilder | v3.1 | assets/scripts | 文件夹组合根（规则 1） | 废止 |
| availability（Folder / Implemented / Placeholder）/ phase（Login / Prologue / WorldFolder） | v3.1 | — | 目录可用性/启动阶段判别值 | 重审 |
| AccountStartupIntent 判别值（Login / CompletePrologue） | v3.1 | director | 启动意图判别值 | 重审 |

## 9. 表现层骨架 / 输入 / 移动 / 保留字 / 常量

| 名称 | 首次引入版本 | 归属文件 | 一句话语义 | 三分类建议 |
|---|---|---|---|---|
| FrameDriver / CameraRig / InputCollector | T0 批 | src/presentation | 表现层三大 Cocos 组件（规则 1） | 废止 |
| FrameRefreshable / onFrameRefresh / bindWiring / addRefreshable | ROUND-12 追认 | presentation | 帧刷新协议（规则 1） | 废止 |
| setMoveAxis / pressStrike / request* / collectFrameIntents | ROUND-12 追认 | InputCollector | 输入采集方法（规则 1） | 废止 |
| adjustViewDistance / getViewDistance / setFollowTarget / rotateAlongRoute | ROUND-12 追认 | CameraRig | 镜头方法（规则 1） | 废止 |
| bindCamera / bindIntentPort | T6 批 | presentation | 表现接线（规则 1） | 废止 |
| DebugPanel | T1~T5 批 | src/presentation/DebugPanel.ts | 调试面板（规则 1） | 废止 |
| ProtagonistView | T1~T5 批 | src/presentation/ProtagonistView.ts | 主角表现组件（规则 1） | 废止 |
| TrailRender / TrailLength / SpeedStreak / MoveSpeed | v0.1 | presentation | 拖尾渲染与动态（规则 1） | 废止 |
| Protagonist | T1~T5 批 | src/character/Protagonist.ts | 主角玩法状态承载（纯逻辑） | 重审 |
| PlayerIntent / IntentPort | T0 批 | src/director | 意图联合与提交端口 | 重审 |
| DirectorSession | ROUND-12 追认 | src/director | 导演会话 | 重审 |
| submitFrameIntents / getCurrentPerceptionMode | ROUND-12 追认 | IntentPort | 帧意图提交/模式读取 | 重审 |
| Move / SwitchPerceptionMode / EnterChart / ExitChart（意图判别值） | ROUND-12 追认 | PlayerIntent | 移动/模式/进出谱面 | 重审 |
| Jump（第 6 种意图） | 跳跃批 | PlayerIntent | 跳跃意图 | 重审 |
| tickVertical / jump / isGrounded / getVertical / requestJump / onMouseDown / spacePressed | 跳跃批及追认 | director / presentation | 垂直物理与输入方法 | 重审 |
| JUMP_INITIAL_SPEED_WM_PER_SECONDS / GRAVITY_WM_PER_SECONDS_SQUARED | 跳跃批 | constants/index.ts | 跳跃物理常量 | 重审 |
| strikeKeysDown / onStrikeKeyUp / lastEvaluatedBeatTimeMs / getBeatClockOffsetMs / setBeatClockOffsetMs | T6~T7 追认 | — | 敲击输入与拍点偏移方法 | 重审 |
| SyncVerificationRecord / SYNC_TOLERANCE_MS = 30 | T0 批 | — | 同步验证记录/容差 | 重审 |
| OFFLINE_GRACE_HOURS = 1 | ROUND-12 | — | 离线宽限常量 | 重审 |
| SECONDS 单位后缀 | 段⑤ | — | 命名后缀约定 | 重审 |
| 保留字：Log / Focus / Selection / Runtime / Session | v0.1 | — | 全局保留字规则 | 重审 |
| 保留字：Window 仅时间窗口，界面用 Panel / View | 段① | — | 命名保留规则 | 重审 |

## 10. 按批整体判定（名库以引用方式冻结的外部清单）

| 清单 | 版本 | 位置 | 数量 | 整体判定 |
|---|---|---|---|---|
| GPT 修复批次私有名 | v2.5 | quality-review/新增命名清单.md | 84 项 | 重审 |
| A 步引导线逻辑/表现/集成命名 | v2.7 | quality-review/guidance-a/*.json | 见清单 | 废止 |
| B 步引导线解析/表现命名 | v2.8 | quality-review/guidance-b/*.json | 见清单 | 废止 |
| C 步多线命名 | v2.9 | quality-review/guidance-c/新增命名清单.json | 见清单 | 废止 |
| 世界文件夹字段/私有词形 | v3.1 | quality-review/world-folder/新增命名清单.md 与 new-names.json | 见清单 | 重审 |
| 音乐编辑器批量操作 AST 声明 | v3.4 | quality-review/music-editor-operations/新增命名清单.md | 114 项 | 重审 |
| B2.1 私有/局部声明 | v3.6 | quality-review/b2-local-worlds/新增命名清单.json | 181 项 | 重审 |
| B2.5c-1 AST 完整清单 | v3.18 | quality-review/b2-5c-1 evidence/new-names.json | 见清单 | 重审 |
| B2.5c-2b 机械新增声明 | v3.20 | quality-review/b2-5c-2b evidence/new-names.json | 见清单 | 重审 |
| B2.5c-2c 机械新增声明 | v3.21 | quality-review/b2-5c-2c evidence/ | 见清单 | 重审 |

## 11. 统计

计数约定：每个被冻结的独立名称 / 判别值计 1；单一类型后的括号取值说明（如 TraceTier（Common / Deep / Rain））随类型计 1；标注数量的批次行按标注数计（引导线资源 ID 计 22、v3.19 增量纯类型计 31、签名域常量计 9）；无法展开的批次行（B 类契约值域、存储 key / 锁名前缀）按 1 批计；第 10 节外部清单只列整体判定，不计入下列数字。

- 保留：82 项
- 重审：696 项
- 废止：167 项
- 待裁定：0 项

合计 945 项。结构复核：分类表共 316 行（保留 52 行 / 重审 210 行 / 废止 54 行），行数由 PowerShell 脚本机械核对；名称数为人工按上表逐行累计，约定如上。
