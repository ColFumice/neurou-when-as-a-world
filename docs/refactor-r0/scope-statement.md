# 《雨若》重构 R1 · Scope Statement（重构边界声明·定稿）

- 文档状态：定稿（v1）
- 文档性质：R1 的输入文档，不是最终契约
- 决策日期：2026-10-18
- 与 R0 的关系：R0 是旧口径机械清单；本文档是新口径重判定稿
- 落盘后不再修改；如需修订，另起 v2

---

## 1. 重构定性

产品形态级重构，不是增量演进。

| 维度 | 旧体系 | 新体系 |
|---|---|---|
| 产品形态 | 箱庭探索 + 独立音游 | 2.5D 视差视听解谜沙盒 + 事件蓝图引擎 |
| 技术栈 | Cocos Creator 3.8.8 | Tauri 2 + React 19 + PixiJS + Web Audio API + Rust SGBM |
| 用户角色 | 玩家（探索者） | 创作者（导演 + 作曲家） |
| 谱面定位 | 独立关卡 | 蓝图动作节点 |
| 主界面 | 世界文件夹 | DAG 事件树（节点 ≠ 世界，节点指向世界） |
| 服务端 | 真实认证 + Relay + 跨设备 | 不留（纯单机） |

---

## 2. 三大决策（用户 2026-10-18 明确）

1. **服务端不留**：纯单机编辑器沙盒。`server/` 目录、B2.2 / B2.4 / B2.5a/b / P3 / B2.5c-1 / B2.5c-2a/b/c 全部废止。
2. **事件树节点 ≠ 世界**：世界是独立实体，事件树节点指向世界。
3. **旧名库保留清单已裁定**：35 项 R1 清单已逐项裁定（见附录 A）。

---

## 3. 四类归属定义

| 类别 | 定义 | 后续动作 |
|---|---|---|
| 保留 | 名字保留，语义可重定义 | v4.0 A 类，标注"继承自 v3.21" |
| 重命名 | 概念保留，名字修改 | v4.0 A 类，标注"重命名自 v3.21 的 XXX" |
| 新增 | v4.0 全新领域 | v4.0 A 类，无继承标注 |
| 废止 | v4.0 不再使用 | v4.0 C 类；旧名库归档保留 |

---

## 4. 服务端不留 · 领域级废止

以下领域整体废止：

### 4.1 账号与里程碑（B2.2）
AccountProfile / AccountGrant / AccountMilestone / FirstWorldCleared / CopyPermission / AccountStartupSession / AccountStartupSnapshot / AccountStartupIntent / AccountStartupReader / AccountStartupPort / AccountStartupStorage / AccountMilestoneStorage / AccountMilestoneProjection / AccountMilestoneSnapshot / AccountMilestoneReader / createAccountMilestoneReader / SightSource

### 4.2 状态契约与七项载体（B2.2d / B2.3.7）
WorldStateSession / WorldStateSnapshot / WorldStateCaptureResult / WorldStateRestoreResult / WorldStateDiagnostic / WorldStateReader / WorldStateStorage / validateWorldStateHeader / WorldCoreStateSnapshot / WorldStateCodec / WorldStatePreparedRestore / createPrimaryWorldStateCodec / isValidatedWorldStateSnapshot / WorldCoreStateStorage / FormatTimeStorage / WorldStateLock / WorldStateLease / WorldRuntimeIdentity / LedgerSnapshot / LedgerHydration / LedgerHydrateResult / validateLedgerNarrativeEvent / PuzzleChainPrivateState / PuzzleProgressSnapshot / PuzzleControlState / 全部 validate* / RecallCountSession / RecallCountSnapshot / RecallCountContext / RecallCountCallbacks / RecallCountHydrateResult / RecallCountOperationResult / WorldLinkContext / WorldLinkSnapshot / WorldLinkSource / WorldLinkSourceReader / WorldLinkSession / validateWorldLinkSnapshot / AIProfile / AIProfileSnapshot / AIProviderConfiguration / AIProvider / CloudProvider / LocalProvider / TemplateProvider / AITaskRoute / FallbackChain / validateAIProfile / ChartArchive / ChartArchiveContext / ChartMediaIdentity / ChartVisualSnapshot / ChartContentManifest / ChartSnapshotRecord / ChartSnapshotCollection / ChartScorePlay / ChartScoreRecord / ChartScoreSnapshot / ChartArchiveCandidate / ChartPremiereArchiveInput / ChartReplayArchiveInput / parseChartContentManifest / chartContentDigest / ChartReplaySession

### 4.3 跨设备与分叉（B2.4 / B2.3）
WorldHomeRegistry / HomeDevice / HomeState(Homed/Released) / WorldHomeContext / WorldHomeRecord / 全部 WorldHome* 子名 / CrossDeviceDuplicate / CrossDeviceDuplicateResult / CoreTransferPayload / CoreTransferProof / CoreTransferCodec / CrossDeviceAuthorityPort / CrossDeviceImportRequest / CrossDeviceImportPlan / CrossDeviceImportPhase / CrossDeviceImportEntry / CrossDeviceImportJournal / CrossDeviceImportReceipt / CrossDeviceImportBindings / CrossDeviceImportAdapter / 全部 CrossDevice* 子名 / CrossDeviceContractAdapter / CrossDeviceImportStorage / CrossDevicePrototype / LogicalDeviceStorage / prototypeLocks / WorldRegistry / DuplicateWorld / WorldForkAvailability / WorldFork / WorldForkOrigin / WorldForkPlan / WorldForkSession / WorldForkStorage / ForkWorldClearSession / rebaseWorldState / validateWorldForkPlan / validateWorldForkOrigin / WorldForkJournal / WorldMigration / MigrationRelease / MigrationClaim / Migrated / RealityPause / OfflineGrace / SafePoint / 全部 SafePointDrain* / 全部 Migration* / 全部 RealityPause* / DeviceAccountBinding / WorldMigrationCodec / WorldMigrationJournal / WorldMigrationEntry / WorldMigrationPhase / WorldMigrationStorageReceipt / WorldMigrationContractAdapter / WorldMigrationStorage / WorldMigrationPrototype / ContractServiceClock

### 4.4 共享契约（P3 / c-1）
SharedCommitContracts / SharedCanonicalBytes / SharedCommitCodec / SharedCommitValidator / SharedWorldReducer / SharedSchemaError / 全部 Shared* 类型 / 全部 P3 schema / 全部成员与群 key 契约 / 全部 B 类契约常量

### 4.5 真实服务（B2.5b / c-2a / b / c）
全部 RealService* / RealAuthServicePort / RealAuthServiceAdapter / buildRealAuthService / RealServiceBuilder / RealWorldAuthorityPort / RealCommitRelayPort / 全部 v3.19 / v3.20 / v3.21 服务端命名 / server/ 目录下全部类 / 全部 neurou-* 存储 key / 锁名

### 4.6 主界面与账号关联
ShoreHub / ShoreHubState / AccountMilestone.ShoreRestored / HubEventSpace / HubOrigin / ConstellationGate / ConstellationGateState / StarPoint / StarLine / LinkStroke / IdleThreshold / IdleTimer / StarWindow / Autopilot / AutopilotThreshold / VectorScramble / VectorAccess / UsableVectorRatio / ScrambleCycle / ProgressiveVectorRecovery

---

## 5. 世界概念 · 只保留名字骨架

### 5.1 保留（名字骨架，语义重定义）

| 名称 | 保留 | 语义重定义要点 |
|---|---|---|
| WorldInstance | ✅ | 字段改为 2.5D 视差配置 + 时间轴状态 |
| WorldKind (Primary / Shore) | ✅ | 世界类别（重构后是否保留 Shore 待 R1） |
| WorldMap | ✅ | 挂载改为 PixiJS Container |
| Layer | ✅ | 世界分层 |
| SpawnPoint / SpawnZone | ✅ | 生成点 / 生成区 |
| MapCenter / CenterDistance / EventDistance | ✅ | 地图中点与两类距离 |
| WorldMeter / ScaleRef / MapScaleCalibration | ✅ | 长度单位与刻度校准 |
| LateralAxis | ✅ | 横轴 |
| WorldThemeColor | ✅ | 世界主题色 |
| WorldFolder | ✅ | 事件树节点指向的实体容器 |
| InitialWorld | ✅ | 初始世界入口 |
| EmptyWorld | ✅ | 空世界模板 |

### 5.2 废止

- WorldLink / LinkState(Bound/Orphaned) — 用户裁定：重构后无彼岸概念
- WorldRegistry / DuplicateWorld / WorldForkAvailability / WorldFork 系列
- DepthAxis / VerticalAxis / DEPTH_RANGE_WM — 用户裁定：纵深相关废止（2.5D 视差不需要 3D 纵深）
- 全部 4.1~4.6 涉及的世界相关名字

---

## 6. 纯逻辑模块 · 逐项裁定

### 6.1 保留（名字留、纯逻辑移植）

| 模块 | 保留项 | 备注 |
|---|---|---|
| character/ | Protagonist / MoveSpeed / TrailLength / HairColor / DecorationPalette | 去 Cocos，留纯计算 |
| world/ | moveAlongAxes / MoveInput / MovementResult / calculateCenterDistance | 保留 |
| trace/ | Trace / TraceTier / TraceOrigin / DeepTrace / EchoTrace / TraceTouch / AnomalyDisclosure / AnomalyCause / WitnessSight | 保留 |
| trace/ | VisibilityState / VisibilityTransitionReason | 保留，转换原因重命名 |
| ledger/ | NarrativeEvent / Ledger / LedgerPosition / NarrativeDimension / VectorSchemaVersion / AppendedAt / ChartRef | 保留；ChapterTag / InputSource 废止 |
| ledger/ | RecallCount / Recall / Replay | 保留 |
| ledger/ | RouteSignature / RouteCoverage / DivergenceAxis / classifyDivergenceAxis / deriveRouteSignature / deriveLedgerPosition / validateNarrativeVector | 保留 |
| chart/ | ChartRef / ChartTier / ChartPremiere / ChartReplay / ChartSnapshot / ChartScore / ChartEntry / WorldBossChart / CharacterBossChart / FinalBossChart / WorldBossChartSource | 保留（魔王曲概念） |
| chart/ | ChartKeyId / ChartPadKind(Regular/Drum/Heavy) | 保留；KeyboardPadLayout / KeyPadSlot 废止 |
| director/ | PlayerIntent / IntentPort / submitFrameIntents / getCurrentPerceptionMode | 保留 |
| musicEditor/ | 全部 Music* 类型与会话接口 | 保留（16~20 项） |
| editor/ | NoteColor / MidiNoteEvent / ChartSourceData / EditorSelection / EditorHistory / parseNoteColor / parseChartSourceData | 保留 |

### 6.2 重命名（概念留、名字改）

| 旧名 | 新名（R1 冻结） | 说明 |
|---|---|---|
| VisibilityTransitionReason(Trigger/Recall/CacheWarm/Forget) | 按新机制命名（R1 冻结） | 例如 FrameAligned / FrameLost / EnterPerception / ExitPerception |
| RhythmStrike | 拆分为 FrameAlignedStrike / GridStrike | 两个判定场景 |
| ChartPlaybackState | PlaybackState | 去掉 Chart 前缀 |
| PERFECT_WINDOW_MS | GRID_PERFECT_WINDOW_MS | 加 GRID 前缀 |
| GOOD_WINDOW_MS | GRID_GOOD_WINDOW_MS | 同上 |
| AudioOutputClock | 保留名字，实现重写 | Web Audio API |

### 6.3 废止（名字删、不再使用）

- trace/ElementEntity / ElementEntitySeed / ElementEntityPosition / bindVisibilityTrackedEntities / updateElementVisibility / applyVisibility / isRevealed / getElementType / getVisibilityState
- trace/PuzzleChain / PuzzleProgress / PuzzleChainStage / PuzzleChainPrivateState / evaluatePuzzleApproach
- trace/EmpathyScaling / ScalingBasis
- chart/KeyboardPadLayout / KeyPadSlot / PAD_LAYOUT_VERSION / createDefaultKeyboardPadLayout
- chart/ChartPlaybackState → 重命名
- director/Chapter / DirectorSession
- director/ 下全部 Cocos 接线（bindCamera / bindIntentPort / bindLedgerSource 等）
- 全部 Cocos 表现层组件（FrameDriver / CameraRig / InputCollector / ProtagonistView / ChartPadView / PerceptionFilter / TrailRender / LineEraseEffect / DebugPanel / SceneBuilder / 全部 *View / *Builder）

### 6.4 全部废止（引导线谱面）

GuidanceChart / GuidanceLine / GuidanceNode / HeadNode / TapNode / DragNode / HoldNode / ChartNodeKind / NodePath / JudgmentPoint / LineEraseEffect / resolveGridKeyAt / HEAD_WINDOW_MS / GuidancePosition / parseGuidanceChart / measurePathLength / positionAtPathDistance / GuidanceLineRuntime / GuidanceLineState / GuidanceJudgement / GuidanceNodeSnapshot / GuidanceLineSnapshot / getGuidanceSnapshot / bindHeadLogo / bindHeadPosition / bindContentSize / clearVisuals / bindChartMediaProbe / UseGuidanceChart / slicePathByDistance / getTotalNodeCount / releaseWhilePaused / disappearAtMs / holdActive / holdRemainingPoints / GuidanceNodeStatus / GuidanceArrival / advanceTimeline / holdStarted / holdInterrupted / drawHoldRange / GuidanceChartRuntime / getGuidanceSnapshots / getTapCandidate / allowTap / allowHead / lineId / headPosition / headSprites / TimedGuidanceLine / GuidanceNodeTiming / GuidanceTimeAnchor / GuidanceVisualData / ChartResourcePath / chartResourcePath / showChartLoadError / bindNodeColors / nodeColors / 全部 Guidance* / 全部引导线资源 ID

---

## 7. AI 模块 · 裁定

### 7.1 保留

- AIProvider 体系：`LocalProvider` / `TemplateProvider` / `AITaskRoute` / `FallbackChain`
- 现实提示：`RealityHint`
- 诗与文本：`StudioPoem` / `PoemProfile` / `TextArchive` / `ArchiveEntry` / `TextProvenance` / `TextKind` / `ProvenanceRecord` / `ProvenanceStatus`

### 7.2 删除

- `CloudProvider`（服务端不留）
- `AIProfileSnapshot`（单机不需快照）
- `AIProviderConfiguration` / `AIProfile` / `validateAIProfile`（旧配置体系被新的本地模型配置取代，待 R1 重设计）

### 7.3 新增 AI 任务（v4.0 全新）

| 任务 | 说明 | 新命名（R1 冻结） |
|---|---|---|
| 视差提取 | 双目 / 单目深度估计，切分前中后景 | 待冻结 |
| 向量生成 | 蓝图节点 + 提示词 → 20 维加成 | 待冻结 |
| 节奏生成 | 音频分析 → 8 格判定节奏点 | 待冻结 |
| 视觉 AI | 识别场景物体，辅助视差框 | 待冻结 |
| 字幕生成 | 字幕与字幕库选取 | 待冻结 |

---

## 8. 全新领域（v4.0 新冻结区，约 48 项）

### 8.1 事件蓝图（EventGraph）
EventGraph / EventNode / EventGraphPort / EventGraphConnection / InputPort / EventSignalInput / AndGate / OrGate / NotGate / NarrativeAction / DynamicAction / EmergentAction / RandomAction / DelayAction / LoopAction / CycleWarning / EventGraphView / EventGraphBuilder

### 8.2 8 格网格音游
GridLayout（2×4）/ GridCell / GridRow / GridLayer（Top / Bottom / TopMost）/ GridKeyId / GridPadKind（Heavy / Light / TopMost）/ DynamicGridScale / HoldGridLine / GridKeyHold / BlindMode / GRID_PERFECT_WINDOW_MS / GRID_GOOD_WINDOW_MS

### 8.3 视差框
VisualFrame / VisualFrameRect / VisualFrameParallaxFactor / FrameSaturation / FrameTarget / FrameTracking

### 8.4 时间轴状态机
TimelineStateMachine / TimelineProgress / TimelineDirection / TimelineMovementMapping / TimelineBoundary

### 8.5 触发器系统
TriggerInstance（语义重构）/ TriggerId / EventSignalId / TriggerRegion / TriggerEnter / TriggerExit / TriggerDwell / TriggerOccupancy / TriggerParallax

### 8.6 素材管线
MediaSource / MediaImport / MediaTrim / ParallaxLayer / DepthMap / DepthThreshold / AudioSegment / AudioMarker / Downbeat / AnomalyShader / GhostOverlay / SpatialDistortion

### 8.7 视差渲染
ParallaxRenderer / ParallaxCamera / ForegroundUV / MidgroundUV / BackgroundUV / Live2DBinding / SpineBinding / CharacterLighting

### 8.8 编辑器 UI
EditorTimeline / EditorPlayhead / EditorTrack / EditorClip / EditorCanvas / EditorInspector / EditorProjectFile / EditorWorldFile

### 8.9 事件树与主界面
EventTreeNode / EventTreeEdge / EventTreeDAG / EventTreeView / EventTreeBuilder / MainScreenView

### 8.10 新增 AI 任务（5 项）
待 R1 冻结具体名

---

## 9. 归档与版本轴

### 9.1 归档

- `docs/NAMEBOOK.md` v3.21 → `archive/legacy-v3.21/NAMEBOOK.md`（R0 已做）
- `docs/spec/stage-1.md` → `archive/legacy-v3.21/stage-1.md`（R0 已做）
- `server/` 目录 → `archive/legacy-v3.21/server/`（R1 完成后做）
- `quality-review/` 保留为历史参考，不删除

### 9.2 版本轴

| 版本 | 状态 | 说明 |
|---|---|---|
| v0 ~ v3.21 | 历史冻结 | 归档，不再修改；v3.21 是最后版本 |
| v4.0 | 待起草 | R1 完成后起草，新产品形态 |
| v4.0 及之后 | 当前生效 | 与 v3.21 完全独立，不继承 |

**关键规则**：v4.0 不修改 v3.21 的任何冻结名；保留项在 v4.0 标注"继承自 v3.21"；废止项不进入 v4.0。

---

## 10. R1 入场前置

1. **本声明落盘**：`docs/refactor-r0/scope-statement.md` 已落盘且经用户确认
2. **R0 归档完成**：`archive/legacy-v3.21/` 已建立
3. **GPT 额度恢复**：ARCHITECT 可正常工作
4. **v4.0 起草人确定**：PROTOCOL 起草骨架 → GPT 裁定 → 用户确认

R1 交付物：
- `docs/NAMEBOOK-v4.0.md`
- `docs/spec/stage-4.md`
- `docs/refactor-r1/verdicts-refactor-*.md`

---

## 11. 未决事项（R1 裁定）

1. 单机编辑器是否需要"账号"概念？还是本地 profile？
2. 事件树节点数据存在哪里？
3. 20 维账本在单机沙盒中的存储载体？
4. 用户的"导演"身份是否需要区分多个本地 profile？
5. `WorldKind(Shore)` 是否保留？（彼岸叙事是否在新架构中）
6. `ChartSourceData` 结构是否因 8 格网格重设计而改变？
7. 5 个新增 AI 任务的具体命名？

以上留 R1 裁定。

---

## 附录 A · 35 项 R1 裁定记录

（逐项记录，与正文交叉索引）

| # | 项目 | 决策 | 交叉引用 |
|---|---|---|---|
| 1 | Protagonist | A 保留 | §6.1 |
| 2 | world/ | B 部分保留 | §5.1 §5.2 §6.1 |
| 3 | trace/ 可见性 | B 部分保留 | §6.1 §6.3 |
| 4 | VisibilityState | A 重命名 | §6.2 |
| 5 | ElementEntity | C 废止 | §6.3 |
| 6 | RhythmStrike | B 重命名 | §6.2 §8.2 |
| 7 | PuzzleChain | C 废止 | §6.3 |
| 8 | EmpathyScaling | C 废止 | §6.3 |
| 9 | NarrativeEvent 字段 | B 部分保留 | §6.1 |
| 10 | PlayerIntent / IntentPort / DirectorSession | B 部分保留 | §6.1 §6.3 |
| 11 | Chapter | B 废止 | §6.3 |
| 12 | ChartPlaybackState | B 重命名 | §6.2 |
| 13 | 键位相关 | B 部分保留 | §6.1 §6.3 |
| 14 | 判定窗口常量 | B 重命名 | §6.2 §8.2 |
| 15 | AudioOutputClock | B 重写 | §6.2 |
| 16 | MusicProjectData 等 | A 保留 | §6.1 |
| 17 | TempoPoint / MusicTimeSignature | A 保留 | §6.1 |
| 18 | MusicEditorDocument / History | A 保留 | §6.1 |
| 19 | MusicEditorSession 等 | A 保留 | §6.1 |
| 20 | ChartSourceBuilder | A 保留 | §6.1 |
| 21 | WorldInstance | B 重定义 | §5.1 |
| 22 | WorldMap | B 重定义 | §5.1 |
| 23 | WorldFolder | A 保留 | §5.1 |
| 24 | EmptyWorld | A 保留 | §5.1 |
| 25 | InitialWorld | A 保留 | §5.1 |
| 26 | AIProvider | B 删除 CloudProvider | §7.1 §7.2 |
| 27 | AIProfileSnapshot | C 废止 | §7.2 |
| 28 | RealityHint | A 保留 | §7.1 |
| 29 | StudioPoem 等 | A 保留 | §7.1 |
| 30 | 新 AI 任务 | 新增 5 项 | §7.3 §8.10 |
| 31 | WorldLink / LinkState | 废止 | §5.2 |
| 32 | WorldFork 系列 | C 废止 | §4.3 |
| 33 | RecallCount 系列 | A 保留 | §6.1 |
| 34 | RouteSignature / RouteCoverage / NarrativeEvent | A 保留 | §6.1 |
| 35 | WorldClearRecord 系列 | C 废止 | §4.1 |