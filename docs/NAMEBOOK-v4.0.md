# NAMEBOOK v4.0

版本：v4.4（R4e.1a AI 基础层）
生成：2026-10-19（Asia/Shanghai）
依据：R1 草案 v2.2 + 补丁 01（AC4-31 层级约束）
状态：R1 冻结候选；经 PROTOCOL 审阅、Trae 落盘、三门禁通过后生效
编码：UTF-8 无 BOM
路径：docs/NAMEBOOK-v4.0.md

---

## §0 版本轴与规则

### 0.1 版本轴

| 版本 | 性质 | 状态 |
|---|---|---|
| v3.21 | 旧体系最后版本 | 已归档（archive/legacy-v3.21/NAMEBOOK.md） |
| v4.0 | 新体系命名空间 | 本文档；R1 冻结候选 |

v4.0 是全新命名空间。v3.21 的名字除 A 类明确继承/改名/重定义者外，一律不进入 v4.0 代码，不做兼容层。

### 0.2 四类归属

| 类别 | 定义 | 后续动作 |
|---|---|---|
| A | 冻结名 | 进入 v4.0 代码；每个名有且只有一个归属模块 |
| B | 候选名 | 不冻结；R2 起可提议升级为 A |
| C | 明确排除 | 不进入 v4.0；旧名库归档保留 |
| D | 延期 | R5 或更后再评估 |

### 0.3 状态标注

| 标注 | 含义 |
|---|---|
| 继承 | 名字与语义均来自 v3.21 |
| 改名 | 概念保留，名字修改 |
| 重定义 | 名字保留，语义重定义 |
| 新增 | v4.0 全新领域，无继承标注 |

### 0.4 命名规则

1. 禁止裸 `Event` / `Developer` / `Rain`。
2. `Window` 只用于时间窗口；界面窗口用 `Panel` / `View`。
3. `Log` 必须用 `Log`；UI 选中用 `Focus` / `Selection`；运行实例用 `Runtime` / `Session`。
4. 每个冻结名必须进 A 类；候选名进 B 类；明确排除进 C 类；延期进 D 类。
5. 同名不得跨模块重复冻结。
6. 名字必须可机械检查：保留字规则 + 新禁名表进 `check-naming`。

---

## §1 A 类（325 项，按模块）

### 1.1 constants（4）

| 名称 | 状态 | 语义 |
|---|---|---|
| VectorSchemaVersion | 继承 | 20 维向量版本，固定 1 |
| GRID_PERFECT_WINDOW_MS | 改名自 PERFECT_WINDOW_MS | 8 格 Perfect 窗口 |
| GRID_GOOD_WINDOW_MS | 改名自 GOOD_WINDOW_MS | 8 格 Good 窗口 |
| FRAME_ALIGNED_WINDOW_MS | 新增 | 视差框对准窗口 |

### 1.2 ledger（19）

| 名称 | 状态 | 语义 |
|---|---|---|
| NarrativeEvent | 继承 | 叙事事件 |
| Ledger | 继承 | 账本容器 |
| LedgerPosition | 继承 | 累计位置 |
| NarrativeDimension | 继承 | 20 维 |
| AppendedAt | 继承 | 追加时刻 |
| RecallCount | 继承 | 回忆计数 |
| Recall | 继承 | 回忆 |
| Replay | 继承 | 重玩 |
| RouteSignature | 继承 | 路线签名 |
| RouteCoverage | 继承 | 路线覆盖 |
| DivergenceAxis | 继承 | 六情感分歧轴 |
| classifyDivergenceAxis | 继承 | 分歧轴分类 |
| deriveRouteSignature | 继承 | 派生路线签名 |
| deriveLedgerPosition | 继承 | 派生账本位置 |
| validateNarrativeVector | 继承 | 校验 20 维向量 |
| LedgerStore | 新增 | 单机 append-only 存储 |
| LedgerReader | 新增 | 账本读取 |
| LedgerCheckpoint | 新增 | 周期性摘要（非全量快照） |
| appendNarrativeEvent | 新增 | 唯一追加函数 |

### 1.3 trace（13）

| 名称 | 状态 | 语义 |
|---|---|---|
| Trace | 继承 | 痕 |
| TraceTier | 继承 | 痕层级 |
| TraceOrigin | 继承 | 痕来源 |
| DeepTrace | 继承 | 深痕 |
| EchoTrace | 继承 | 回声痕 |
| TraceTouch | 继承 | 痕触碰 |
| AnomalyDisclosure | 继承 | 异痕披露 |
| AnomalyCause | 继承 | 异痕成因 |
| WitnessSight | 继承 | 目击视野 |
| VisibilityState | 继承 | Revealed / Concealed |
| VisibilityTransitionReason | 改名值 | FrameAligned / FrameLost / EnterPerception / ExitPerception |
| FrameAlignedStrike | 改名自 RhythmStrike | 框对准判定；trace 域，只含数值与判定枚举，不 import chart，不引用 Strike |
| GridStrike | 改名自 RhythmStrike | 8 格判定；trace 域，只含数值与判定枚举，不 import chart，不引用 Strike |

### 1.4 world（24）

| 名称 | 状态 | 语义 |
|---|---|---|
| WorldInstance | 重定义 | 2.5D 视差配置 + 时间轴状态 + 世界序言(prologue) |
| WorldKind | 继承 | 名字保留；值 Primary（继承）+ Secondary（新增值，无继承标注）；Shore 见 C |
| WorldMap | 重定义 | PixiJS 挂载点 |
| Layer | 重定义 | 视差层 |
| WorldThemeColor | 重定义 | 世界主题色 |
| SpawnPoint | 继承 | 生成点 |
| SpawnZone | 继承 | 生成区 |
| MapCenter | 继承 | 地图中点 |
| CenterDistance | 继承 | 中心距离 |
| EventDistance | 继承 | 事件距离 |
| WorldMeter | 继承 | 世界长度单位 |
| ScaleRef | 继承 | 刻度参照 |
| MapScaleCalibration | 继承 | 地图刻度校准 |
| LateralAxis | 继承 | 横轴 |
| WorldFolder | 继承 | 节点指向容器 |
| InitialWorld | 继承 | 初始世界入口模板 |
| EmptyWorld | 继承 | 空世界模板 |
| moveAlongAxes | 重定义 | 单轴移动推进（DepthAxis 废止） |
| MoveInput | 重定义 | 移动输入 |
| MovementResult | 重定义 | 移动结果 |
| calculateCenterDistance | 重定义 | 计算中心距离 |
| PerceptionMode | 继承 | Normal / Triggered / Rain |
| RainIntensity | 新增 | Light / Moderate / Heavy |
| RainModeState | 新增 | 雨态（含 degradedReason 字段，值 LocationUnavailable / WeatherUnavailable / NetworkUnavailable） |

### 1.5 视差框（8）

| 名称 | 状态 | 语义 |
|---|---|---|
| VisualFrame | 新增 | 屏幕框 |
| VisualFrameRect | 新增 | 框矩形 |
| VisualFrameParallaxFactor | 新增 | 每层视差因子 |
| VisualFrameSaturation | 新增 | 框内饱和度 |
| GlobalSaturation | 新增 | 全场景饱和度（只读反馈） |
| FrameTarget | 新增 | 目标 |
| FrameTracking | 新增 | 跟踪状态 |
| VisualFrameTargetLock | 新增 | 目标锁定 |

### 1.6 触发器（10）

| 名称 | 状态 | 语义 |
|---|---|---|
| TriggerInstance | 改名自 Trigger | 触发器运行实例 |
| TriggerId | 新增 | 触发器 ID |
| EventSignalId | 新增 | 事件信号 ID |
| TriggerRegion | 新增 | 触发区域 |
| TriggerEnter | 新增 | 进入信号 |
| TriggerExit | 新增 | 退出信号 |
| TriggerDwell | 新增 | 停留信号 |
| TriggerOccupancy | 新增 | 占用信号 |
| TriggerParallax | 新增 | 视差触发信号 |
| ParallaxLayer | 新增 | 视差层定义（前景/中景/背景） |

### 1.7 timeline（6）

| 名称 | 状态 | 语义 |
|---|---|---|
| TimelineStateMachine | 新增 | 时间轴状态机 |
| TimelineProgress | 新增 | 时间轴进度 |
| TimelineDirection | 新增 | 时间轴方向 |
| TimelineMovementMapping | 新增 | 移动 → 时间映射 |
| TimelineBoundary | 新增 | 时间轴边界 |
| PlaybackState | 改名自 ChartPlaybackState | Ready / Playing / Paused / Completed / Exited |

### 1.8 chart 与动态图层（28）

| 名称 | 状态 | 语义 |
|---|---|---|
| ChartRef | 继承 | 谱面引用 |
| ChartTier | 继承 | 谱面层级 |
| ChartPremiere | 继承 | 首演 |
| ChartReplay | 继承 | 重演 |
| ChartSnapshot | 继承 | 谱面快照 |
| ChartScore | 继承 | 谱面成绩 |
| ChartEntry | 继承 | 谱面入口 |
| WorldBossChart | 继承 | 世界魔王曲 |
| CharacterBossChart | 继承 | 角色魔王曲 |
| FinalBossChart | 继承 | 最终魔王曲 |
| WorldBossChartSource | 继承 | 世界魔王曲源 |
| ChartKeyId | 继承 + 重定义 | 逻辑键身份 |
| ChartPadKind | 继承 + 重定义 | Pad 类型 Light / Heavy / TopMost；与 ChartLayerIndex 解耦（Layer 2 可 Heavy/Light；Layer 3+ 为 Light；分值只看 LayerIndex） |
| ChartLayer | 新增 | 动态层 |
| ChartLayerIndex | 新增 | 1 基索引 |
| ChartLayerScoring | 新增 | 层分值（max(1, floor(prev×0.5))） |
| FullScreenJudgementLayer | 新增 | 全屏层（Space 或 Pointer） |
| GridScaleRestoreCondition | 新增 | 恢复条件 ClickOutsideEnlargedRect / SessionReset |
| HoldGridOverflow | 新增 | 网格越界（与 DynamicGridScale 解耦） |
| SpaceHoldOverflow | 新增 | 空格越界（与 DynamicGridScale 解耦） |
| NoteLogoGuide | 新增 | Logo 引导（仅 Layer 1/2） |
| NoteLogoAppearance | 新增 | Logo 出现动效 |
| NoteLogoDisappear | 新增 | Logo 消失动效 |
| NoteLogoMiss | 新增 | Logo Miss |
| NoteLogoLeadTimeMs | 新增 | 提前量 |
| NoteLogoLifetimeMs | 新增 | 存活时长 |
| NoteLogoHoldExtensionMs | 新增 | Hold 延长 |
| GridLineVisibility | 新增 | Concealed / Revealed；默认 Concealed；点击成功后该格 Revealed，恢复后 Concealed |

### 1.9 8 格网格（10）

| 名称 | 状态 | 语义 |
|---|---|---|
| GridLayout | 新增 | 2×4 布局 |
| GridCell | 新增 | 格 |
| GridRow | 新增 | 行（Top / Bottom） |
| GridCellId | 新增 | 格位 1..8 |
| DynamicGridScale | 新增 | per-cell 1.0/1.5（点击成功放大，点击格外恢复） |
| HoldGridLine | 新增 | 跨格 Hold |
| GridKeyHold | 新增 | 按住 |
| BlindMode | 新增 | 盲打 |
| GridNote | 新增 | 音符 |
| AudioOutputClock | 重写 | Web Audio 输出时钟 |

### 1.10 media（8）

| 名称 | 状态 | 语义 |
|---|---|---|
| MediaSource | 新增 | 媒体源 |
| MediaImport | 新增 | 媒体导入 |
| MediaTrim | 新增 | 媒体裁剪 |
| DepthMap | 新增 | 深度图 |
| DepthThreshold | 新增 | 深度阈值 |
| AudioSegment | 新增 | 音频段 |
| AudioMarker | 新增 | 音频标记 |
| Downbeat | 新增 | 重拍 |

### 1.11 事件蓝图（19）

| 名称 | 状态 | 语义 |
|---|---|---|
| EventGraph | 新增 | 世界内动作蓝图 |
| EventNode | 新增 | 蓝图节点 |
| EventGraphPort | 新增 | 蓝图端口 |
| EventGraphConnection | 新增 | 蓝图连接 |
| InputPort | 新增 | 输入端口 |
| EventSignalInput | 新增 | 事件信号输入 |
| AndGate | 新增 | 与门 |
| OrGate | 新增 | 或门 |
| NotGate | 新增 | 非门 |
| CycleWarning | 新增 | 环告警 |
| NarrativeAction | 新增 | 叙事动作 |
| DynamicAction | 新增 | 动态动作 |
| EmergentAction | 新增 | 涌现动作 |
| RandomAction | 新增 | 随机动作 |
| DelayAction | 新增 | 延时动作 |
| LoopAction | 新增 | 循环动作 |
| EventGraphBuilder | 新增 | 文档 → 运行时装配 |
| RandomSeed | 新增 | 种子 |
| RandomPreviewMode | 新增 | Seeded / Live |

### 1.12 事件树（5）

| 名称 | 状态 | 语义 |
|---|---|---|
| EventTreeNode | 新增 | 项目级世界编排节点 |
| EventTreeEdge | 新增 | 事件树边 |
| EventTreeDAG | 新增 | 项目级世界编排 DAG |
| EventTreeDocument | 新增 | 事件树文档 |
| EventTreeBuilder | 新增 | 事件树装配 |

### 1.13 editor（49）

| 名称 | 状态 | 语义 |
|---|---|---|
| EditorTimeline | 新增 | 编辑器时间轴视图模型 |
| EditorPlayhead | 新增 | 播放头 |
| EditorTrack | 新增 | 轨道 |
| EditorClip | 新增 | 剪辑 |
| EditorCanvas | 新增 | 画布 |
| EditorInspector | 新增 | 检查器 |
| EditorProjectFile | 新增 | 项目文件描述 |
| EditorWorldFile | 新增 | 世界文件描述 |
| NoteColor | 继承 | 音符颜色 |
| MidiNoteEvent | 继承 | MIDI 音符事件 |
| ChartSourceData | 继承（升 v2） | 谱面源数据 |
| EditorSelection | 继承 | 选择 |
| EditorHistory | 继承 | 有界历史 |
| parseNoteColor | 继承 | 解析音符颜色 |
| parseChartSourceData | 继承 | 解析谱面源数据（只接受 v2） |
| AddChartLayer | 新增 | 图层增删命令：添加 |
| RemoveChartLayer | 新增 | 图层增删命令：删除 |
| ChartEditMode | 新增 | 谱面编辑模式 |
| KeyframeTrack | 新增 | 关键帧轨道 |
| ChartKeyframe | 新增 | 谱面关键帧 |
| ChartKeyframeAnimation | 新增 | 关键帧动画（长条） |
| ChartKeyframeProperty | 新增 | 关键帧属性 |
| LogoPositionPicker | 新增 | logo 选位 |
| LogoRandomPlacement | 新增 | logo 随机放置 |
| ChartEditUndo | 新增 | 撤销 |
| AIKeyframeGeneration | 新增 | AI 关键帧生成 |
| EditorBinding | 新增 | 资产→关键帧触发绑定 |
| EditorEffectKind | 新增 | 10 种动效接口类型 |
| EditorEffectParams | 新增 | 动效参数 |
| EditorEffectInterface | 新增 | 动效接口定义 |
| EditorLightPreset | 新增 | 全屏/局部光效预设 |
| EditorRuntimeDocument | 新增 | 编辑器运行时持久化聚合 |
| NeuModule | 新增 | NEU 蓝图模块 |
| NeuModuleType | 新增 | NEU 模块类型 |
| NeuModuleParams | 新增 | NEU 模块参数 |
| NeuInput | 新增 | NEU 输入端口连接 |
| NeuOutput | 新增 | NEU 输出端口连接 |
| NeuPortTarget | 新增 | NEU 端口目标 |
| NeuRuntime | 新增 | NEU playhead 执行器 |
| NeuSignal | 新增 | NEU 运行时信号 |
| NeuGraphCompileResult | 新增 | NEU 图编译结果 |
| compileNeuGraph | 新增 | NEU 拓扑排序/环检测 |
| ActiveStageEffect | 新增 | 当前激活动效 |
| StageOverlay | 新增 | Stage overlay 描述 |
| StageEffectState | 新增 | Stage 合成结果 |
| EMPTY_EFFECT_STATE | 新增 | 空动效状态 |
| composeStageEffects | 新增 | 多动效合成 |
| ActiveLight | 新增 | 当前激活光效 |
| composeStageLights | 新增 | 多光效合成 |

### 1.14 musicEditor（22）

| 名称 | 状态 | 语义 |
|---|---|---|
| MusicProjectData | 继承 | 音乐工程 |
| TrackDefinition | 继承 | 轨定义 |
| NoteDefinition | 继承 | 音符定义 |
| TempoPoint | 继承 | 速度点 |
| MusicTimeSignature | 继承 | 拍号 |
| MusicEditorDocument | 继承 | 草稿 |
| MusicEditorHistory | 继承 | 历史 |
| MusicEditorSession | 继承 | 会话 |
| MusicEditorReader | 继承 | 读取 |
| MusicEditorPort | 继承 | 端口 |
| MusicEditorIntent | 继承 | 意图 |
| ChartSourceBuilder | 继承 | 导出 v2 |
| buildChartSource | 继承 | 构建谱面源 |
| MusicPlaybackNote | 继承 | 试听 |
| parseMusicProjectData | 继承 | 解析音乐工程 |
| createDefaultMusicProject | 继承 | 创建默认音乐工程 |
| parseMusicEditorDocument | 继承 | 解析草稿 |
| tickToTimeMs | 继承 | tick → 毫秒 |
| timeMsToTick | 继承 | 毫秒 → tick |
| musicProjectDurationMs | 继承 | 工程时长 |
| musicMeasureTicks | 继承 | 小节 tick |
| midiPitchToFrequency | 继承 | MIDI 音高 → 频率 |

### 1.15 AI（27）

| 名称 | 状态 | 语义 |
|---|---|---|
| AIProvider | 继承 | 提供者抽象 |
| LocalProvider | 继承 | 本地模型 |
| TemplateProvider | 继承 | 模板降级 |
| CloudProvider | 继承（恢复） | 客户端直连，用户自填 API Key |
| AITaskRoute | 继承 | AI 任务路由 |
| FallbackChain | 继承 | 降级链 |
| AIProviderMode | 新增 | Local / Cloud |
| AIProviderSettings | 新增 | 设置（endpoint、model、keyRef、timeout、fallback） |
| AITaskKind | 新增 | 5 类任务种类 |
| AITaskRequest | 新增 | 统一任务请求 |
| AITaskResult | 新增 | 统一任务结果 |
| AIHttpPort | 新增 | HTTP 注入端口；core AI 的纯类型契约 |
| AIKeyStorePort | 新增 | 钥匙串注入端口；core AI 的纯类型契约 |
| RealityHint | 继承 | 现实提示 |
| StudioPoem | 继承 | 工作室诗 |
| PoemProfile | 继承 | 诗配置 |
| TextArchive | 继承 | 文本档案 |
| ArchiveEntry | 继承 | 档案条目 |
| TextProvenance | 继承 | 文本来源 |
| TextKind | 继承 | 文本类型 |
| ProvenanceRecord | 继承 | 来源记录 |
| ProvenanceStatus | 继承 | 来源状态 |
| ParallaxExtractionTask | 新增 | 视差提取 |
| NarrativeVectorTask | 新增 | 向量生成 |
| RhythmGenerationTask | 新增 | 节奏生成 |
| SceneVisionTask | 新增 | 视觉 AI |
| SubtitleGenerationTask | 新增 | 字幕生成 |

### 1.16 studio（3）

| 名称 | 状态 | 语义 |
|---|---|---|
| StudioProfile | 新增 | 单机身份 |
| StudioProject | 新增 | 项目清单 |
| ProjectStore | 新增 | 项目读写（端口注入，不直接碰 fs） |

### 1.17 director（6）

| 名称 | 状态 | 语义 |
|---|---|---|
| PlayerIntent | 继承 | 玩家意图 |
| IntentPort | 继承 | 意图窄口 |
| submitFrameIntents | 继承 | 提交帧意图 |
| getCurrentPerceptionMode | 继承 | 当前感知模式 |
| Strike | 继承（P8 归 director） | 敲击意图载荷（timeMs + chartKeyId / gridCellId）；不得引用 GridStrike |
| ChartPremiereDirector | 新增 | 首演 20 维推导与唯一账本写入入口 |

### 1.18 character（5）

| 名称 | 状态 | 语义 |
|---|---|---|
| Protagonist | 继承 | 主角 |
| MoveSpeed | 继承 | 移动速度 |
| TrailLength | 继承 | 拖尾长度 |
| HairColor | 继承 | 发色 |
| DecorationPalette | 继承 | 装饰调色板 |

### 1.19 presentation（40）

| 名称 | 状态 | 语义 |
|---|---|---|
| ParallaxRenderer | 新增 | Pixi 视差渲染 |
| ParallaxCamera | 新增 | 视差相机 |
| ForegroundUV | 新增 | 前景 UV |
| MidgroundUV | 新增 | 中景 UV |
| BackgroundUV | 新增 | 背景 UV |
| EventGraphView | 新增 | 蓝图视图 |
| EventTreeView | 新增 | 事件树视图 |
| MainScreenView | 新增 | 主界面视图 |
| WorldFolderConsole | 新增 | cmd 风格世界文件夹 |
| ConsoleCommand | 新增 | 用户命令 |
| ConsoleOutput | 新增 | 命令行输出 |
| ConsolePrompt | 新增 | > 提示符 |
| WorldFileEntry | 新增 | 世界文件条目 |
| WorldFolderEntryKind | 新增 | File / Folder / Settings |
| ConsoleEnvironmentText | 新增 | 逐字闪现环境文本 |
| ConsoleEffect | 新增 | 鱼眼 / 随机刻故障特效 |
| WorldExportIntent | 新增 | 导出世界文件意图 |
| WorldImportAuto | 新增 | 文件资源管理器双击自动导入 |
| WorldLoadingSequence | 新增 | 加载序列 |
| SettingsConsole | 新增 | 设置命令列表（无边框 cmd 风格） |
| ConsoleDirectory | 新增 | 虚拟目录 |
| ConsoleDirectoryConstraint | 新增 | 仅主文件夹下层操作 |
| ConsoleCommandList | 新增 | 环境文本下方命令表 |
| WorldSelectionMode | 新增 | 上下键 / 回车 / 鼠标点击 / 掠过高亮 |
| WorldEntryHighlight | 新增 | 选中条目 > < 夹住 + 白底黑字 |
| ContextMenuAction | 新增 | 右键菜单（新建 / 删除 / 导出） |
| WorldLoadProgressBar | 新增 | 命令行风格进度条 |
| WorldPixelZoom | 新增 | 滚动加速 + 像素放大循环 |
| WorldEnterTransition | 新增 | 叠黑 + 世界序言黑屏字幕 + 闪光 + 显示世界 |
| RainVisualConfig | 新增 | Rain 视觉配置 |
| NoteLogoGlow | 新增 | logo 发光 |
| RainTintSource | 新增 | 视频谱面色调源 |


| ThemeBackground | 新增 | 动态主题图背景 |
| FisheyeEffect | 新增 | 鱼眼效果（项目树级） |
| VignetteEffect | 新增 | 暗角 |
| InvertRipple | 新增 | 反色涟漪（新建文件夹） |
| DesaturationEffect | 新增 | 饱和度降低（撤回） |

| ProjectTreeLayout | 新增 | 3D 布局（RGB→XYZ） |
| ProjectTreeView | 新增 | 项目树视图（P） |
| ProjectConsole | 新增 | 项目 cmp 界面（P） |
### 1.20 app/adapters（4）

| 名称 | 状态 | 语义 |
|---|---|---|
| LocationResolver | 新增 | IP 定位适配；app/adapters 层，依赖 K |
| WeatherResolver | 新增 | 天气 API 适配；app/adapters 层，依赖 K |
| LocationResult | 新增 | IP 定位结果结构 |
| WeatherResult | 新增 | 天气适配结果结构 |

---


### 1.21 projecttree（12）
| 名称 | 状态 | 语义 |
|---|---|---|
| Workspace | 新增 | 工作区根 |
| WorkspaceRoot | 新增 | 工作区根路径 |
| ProjectFolder | 新增 | 项目文件夹（包含多个项目） |
| ProjectFolderId | 新增 | 项目文件夹 ID |
| Project | 新增 | 项目（包含多个世界） |
| ProjectId | 新增 | 项目 ID（8 位数字字符串） |
| ProjectMeta | 新增 | 项目元数据（schema v2） |
| ProjectTheme | 新增 | 项目主题色 |
| ProjectPrologue | 新增 | 项目序言 |
| ProjectTree | 新增 | 项目树（数据结构） |
| ProjectTreeNode | 新增 | 项目树节点 |
| ProjectTreeEdge | 新增 | 项目树边 |

### 1.22 interaction（3）
| 名称 | 状态 | 语义 |
|---|---|---|
| TimeRewind | 新增 | 时间回溯状态 |
| UndoRedoStack | 新增 | 撤销重做栈（内存） |
| ProjectSelectionMode | 新增 | 项目树选择模式 |

## §2 B 类（候选，不冻结）

| 候选名 | 说明 |
|---|---|
| RainTrace / RainTraceTint | 雨痕是否作为独立痕类型保留，待用户确认 |
| WallClock | 本地时间类型是否保留 |
| ToggleChartPause | 是否作为独立意图 |
| CHART_LAYER_BASE_SCORE / scoring knobs | 层基准分与计分参数（示例 TopMost=800 不冻结） |
| GridJudgement / GridScore | 判定结果与计分明细 |


| PlaySession / PlaySessionState | 试玩运行时（替代旧 DirectorSession） |
| WorldStore / MediaStore / StudioSettings | 项目内其余存储 |
| GridKeyBinding | ChartKeyId ↔ GridCellId 重映射表 |
| EventGraphDocument / EventGraphEditorSession | 蓝图文档与编辑会话 |
| TimelineCue / SubtitleCue / SubtitleTrack | 时间轴提示与字幕 |
| ProjectId / WorldId / MediaAssetId | 品牌化 ID |
| EmotionToTrailColor / TrailColor | 20 维 → 拖尾色的纯映射是否保留 |
| WorldPackage / ExportManifest | 世界导出/导入包格式 |

---

## §3 C 类（明确排除）

### 3.0 未引入的提议名 / v1 草案退场

- GridKeyId / GridPadKind：P1 不引入，统一 ChartKeyId / GridCellId / ChartPadKind。
- GridLayer：与 ChartLayer / GridRow 重叠，退场；TopMost 由 ChartLayerIndex=1 表达。
- FrameSaturation：v1 草案名，由 VisualFrameSaturation 取代。
- WorldFileHighlight / WorldFolderHighlight：规则相同，合并为 WorldEntryHighlight，不单独冻结两名。

### 3.1 服务端 / 账号 / 里程碑

Account* / SightSource / FirstWorldCleared / CopyPermission / WorldClearRecord* / AccountStartup* / AccountMilestone* / WorldState* / LedgerSnapshot / LedgerHydration / RecallCountSession* / WorldLink* / AIProfile* / ChartArchive* / ChartReplaySession。

### 3.2 跨设备 / 分叉 / 迁移

WorldHome* / HomeDevice / CrossDevice* / CoreTransfer* / WorldRegistry / DuplicateWorld / WorldFork* / WorldMigration* / RealityPause / SafePoint / OfflineGrace。

### 3.3 共享契约 / 真实服务

Shared* / Real* / Relay* / AuthService / server/ 全部 / neurou-* key 与锁名。

### 3.4 Cocos 表现层

FrameDriver / CameraRig / InputCollector / *View / TrailRender / LineEraseEffect / PerceptionFilter / DebugPanel / SceneBuilder / *Builder 组合根。

### 3.5 引导线谱面

Guidance* / HeadNode / TapNode / DragNode / HoldNode / ChartNodeKind / NodePath / JudgmentPoint / HEAD_WINDOW_MS / GuidanceEditor*。

### 3.6 解谜 / 元素 / 共情

ElementEntity* / PuzzleChain* / PuzzleProgress* / evaluatePuzzleApproach / EmpathyScaling / ScalingBasis / ElementType。

### 3.7 旧状态壳

WorldState* / WorldCoreState* / FormatTimeStorage / WorldStateLock / WorldStateLease / 七项载体全部。

### 3.8 旧主界面 / 彼岸

ShoreHub* / ConstellationGate* / Star* / Autopilot* / VectorScramble* / Shore* / FinalShore* / SourceCube* / Ending*。

### 3.9 旧意图 / 导演 / 谱面

DirectorSession / Chapter / ChapterTag / InputSource / Jump / tickVertical / KeyboardPadLayout / KeyPadSlot / PAD_LAYOUT_VERSION / Note / CHART_* 旧常量。

### 3.10 旧 AI 配置

AIProfile / AIProfileSnapshot / AIProviderConfiguration / validateAIProfile（CloudProvider 已恢复为 A，不在 C）。

### 3.11 WorldKind.Shore

Shore 为废止值，C 类；不是 Secondary 的重命名源（P2）。

R0 已判废止 167 项全部进 C；scope §4.1~4.6 的领域级废止全部进 C。

---

## §4 D 类（延期）

| 项 | 说明 |
|---|---|
| 多 profile | 本机多创作者身份 |
| SQLite 事件存储 | 节点规模上千后再评估 |
| Live2D / Spine / 角色光照 | Live2DBinding / SpineBinding / CharacterLighting |
| 异常着色器 | AnomalyShader / GhostOverlay / SpatialDistortion |
| 云端 AI 托管 | 仅保留用户自填 Key 直连；不做 Neurou 托管 |
| 协作 / 分享 / 创意工坊 | 单机沙盒之外的发布链 |
| v1 谱面兼容 | 不提供 |
| TTS / 配音 | 字幕生成之后的语音层 |
| 移动端 / 触控 | 只做桌面 |
| 插件系统 | 第三方扩展 |

---

## §5 继承 / 重命名对照

### 5.1 继承（名字与语义均保留）

character/ 全部；ledger/ 核心 + 派生；trace/ 核心；world/ 骨架；chart/ 三级魔王曲与 ChartKeyId；musicEditor/ 全部；editor/ NoteColor / MidiNoteEvent / ChartSourceData / EditorSelection / EditorHistory / parseNoteColor / parseChartSourceData；AI/ AIProvider / LocalProvider / TemplateProvider / AITaskRoute / FallbackChain / RealityHint / StudioPoem / PoemProfile / TextArchive / ArchiveEntry / TextProvenance / TextKind / ProvenanceRecord / ProvenanceStatus；director/ PlayerIntent / IntentPort / submitFrameIntents / getCurrentPerceptionMode / Strike；constants/ VectorSchemaVersion。

### 5.2 改名（概念保留，名字修改）

| 旧名 | 新名 |
|---|---|
| PERFECT_WINDOW_MS | GRID_PERFECT_WINDOW_MS |
| GOOD_WINDOW_MS | GRID_GOOD_WINDOW_MS |
| RhythmStrike | FrameAlignedStrike + GridStrike（拆分） |
| ChartPlaybackState | PlaybackState |
| Trigger | TriggerInstance |

### 5.3 重定义（名字保留，语义重定义）

| 名称 | 重定义要点 |
|---|---|
| WorldInstance | 字段改为 2.5D 视差配置 + 时间轴状态 |
| WorldMap | 挂载改为 PixiJS Container |
| Layer | 视差层 |
| WorldThemeColor | 世界主题色 |
| moveAlongAxes / MoveInput / MovementResult / calculateCenterDistance | 单轴移动；DepthAxis 废止 |
| ChartKeyId | 逻辑键身份 |
| ChartPadKind | Pad 类型；与 ChartLayerIndex 解耦 |
| AudioOutputClock | 实现改为 Web Audio API |
| VisibilityTransitionReason | 值改为 FrameAligned / FrameLost / EnterPerception / ExitPerception |

### 5.4 新增

见 §1 中状态为“新增”的全部条目。

---

## §6 保留字与禁名

### 6.1 保留字

- Event（裸用禁止；必须带前缀，如 NarrativeEvent / MidiNoteEvent / EventNode）
- Developer（禁止）
- Rain（裸用禁止；必须带前缀，如 RainIntensity / RainModeState / RainVisualConfig）
- Window（只用于时间窗口；界面窗口用 Panel / View）
- Log（必须用 Log；UI 选中用 Focus / Selection；运行实例用 Runtime / Session）

### 6.2 新禁名表（进 check-naming）

- GridKeyId / GridPadKind（P1 不引入）
- GridLayer（退场）
- FrameSaturation（退场）
- WorldFileHighlight / WorldFolderHighlight（合并为 WorldEntryHighlight）
- Shore* / FinalShore* / SourceCube* / Ending*（彼岸废止）
- Account* / WorldState* / Shared* / Real* / Relay* / server/*（服务端废止）
- Guidance* / HeadNode / TapNode / DragNode / HoldNode（引导线废止）
- ElementEntity* / PuzzleChain* / EmpathyScaling（解谜废止）
- DirectorSession / Chapter / ChapterTag / InputSource（旧导演废止）

---

## §7 统计与审计

### 7.1 计数

| 模块 | A 类数 |
|---|---|
| constants | 4 |
| ledger | 19 |
| trace | 13 |
| world | 24 |
| 视差框 | 8 |
| 触发器 | 10 |
| timeline | 6 |
| chart 与动态图层 | 28 |
| 8 格网格 | 10 |
| media | 8 |
| 事件蓝图 | 19 |
| 事件树 | 5 |
| editor | 26 |
| musicEditor | 22 |
| AI | 27 |
| studio | 3 |
| director | 6 |
| character | 5 |
| presentation | 40 |
| projecttree | 12 |
| interaction | 3 |
| app/adapters | 4 |
| **合计** | **325** |

### 7.2 审计规则

1. 每次 A 类增删必须更新本表与 §1 对应模块。
2. `check-naming` 必须校验：A 类名存在、禁名表不出现、同名不跨模块。
3. `check-dependencies` 必须校验：依赖矩阵规则（见 stage-4 §5）。
4. R1 冻结后，A 类只允许通过“新裁定书”增删；不得直接改本文件。

### 7.3 版本记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v4.0 | 2026-10-19 | R1 冻结基线（271 项 A 类 + B/C/D + 继承对照 + 保留字禁名 + 统计） |
| v4.1 | 2026-10-20 | R3.4 冻结，新增项目树（23 项 A 类，合计 294） |
| v4.2 | 2026-10-23 | R3.5d 运行时常量（23 项 A 类，合计 317） |
| v4.3 | 2026-10-25 | R4d.1 新增 ChartPremiereDirector（1 项 A 类，合计 318） |
| v4.4 | 2026-10-25 | R4e.1a AI 基础层（7 项 B 类升 A，合计 325） |