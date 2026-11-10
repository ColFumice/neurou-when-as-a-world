﻿\# 阶段 1 系统边界与验收标准

> 本文件最近更新：HANDOFF-ROUND-18，纳入 VERDICT-121 ~ 126（T7 视频谱面 + 键盘打击垫 + 暂停）。

> 本文件最近更新：引导线编辑器阶段，纳入 VERDICT-147 ~ 157（v3 时间模型 + editor 模块 + 颜色伴随文件）。

> 本文件最近更新：世界文件夹阶段，纳入 VERDICT-158 ~ 168（登录 → 序章 → 世界文件夹启动流程 + 编辑器目录框架）。

> 本文件最近更新：音频编辑器阶段，纳入 VERDICT-180 ~ 190（MIDI 音轨编辑器最小交付 + musicEditor 模块）。

> 本文件最近更新：音乐编辑器批量操作 + B1 谱面接入，纳入 VERDICT-191 ~ 200。

> 本文件最近更新：B2.1 本地多世界基础，纳入 VERDICT-201 ~ 210。

> 本文件最近更新：B2.2 账号里程碑与状态契约，纳入 VERDICT-211 ~ 225。

> 本文件最近更新：B2.2c 真实通关链路落地，纳入 VERDICT-226 ~ 240 及最小内容生产者授权。

> 本文件最近更新：B2.2d-1 完整状态恢复前置（核心机制），纳入 VERDICT-241 ~ 255。

> 本文件最近更新：B2.2d 完整状态恢复前置（核心 + 扩展），纳入 VERDICT-241 ~ 270。



> 依据：名库 v1.6、简报"开发路线·阶段 1：核心玩法原型（Cocos 2D 移动 + 箱庭 + 一个视频谱面）"

> 目标：用最小的可玩闭环，验证"移动 → 发现痕 → 解谜 → 获得深痕 → 进入视频谱面 → 结算写回账本"这条主干链路。



\## 1. 阶段目标



玩家在一个手工搭建的箱庭场景中移动主角，通过一个节奏敲击机制解开一条短解谜链，获得一枚深痕，进入一张视频谱面完成演奏，结算结果作为一条叙事事件写入账本。



\## 2. 技术基线



| 项目 | 基线 |

|---|---|

| 引擎 | Cocos Creator 3.8.8 |

| 语言 | TypeScript |

| 平台 | 只做 PC |

| 视频 | mp4，H.264，1920×1080 和 2560×1440 两档 |

| 视频解码 | 优先 Cocos 自带 VideoPlayer |

| 外部服务 | 本阶段不接入 |



\## 3. 本阶段涉及的系统（10 个模块）



| 目录 | 系统 | 职责 |

|---|---|---|

| constants | 共享词汇 | 枚举、ID类型、常量定义。只有定义，不能有逻辑 |

| ledger | S4 事件图（桩实现） | 只追加的账本。读取接口和追加接口分开存放 |

| world | S2 地图 | 世界地图、坐标轴、地图中点、距中点距离、镜头空间信息 |

| character | S6 角色 | 主角移动、移动速度、逻辑拖尾色 |

| trace | S3 元素与痕 | 场景实体、可见性状态、痕、深痕、节奏敲击、解谜进度 |

| chart | S7 谱面 | 谱面数据、时间码对齐、判定、引导透明度、得分 |

| editor | 引导线编辑器 | 引导线编辑器纯逻辑模块（零 cc、零 UI） |

| musicEditor | 音乐编辑器 | 音乐创作纯逻辑模块（零 cc） |

| director | S5 叙事导演 | 解谜链编排、谱面入口、全工程唯一调用账本追加接口的模块，当前感知模式保存，垂直物理推进编排（tickVertical 调用方，每帧一次） ，世界运动门控（受限制状态下暂停世界运动，不缓存请求，不补算暂停时长）|

| presentation | S8 表现 | 所有渲染、镜头、转场、拖尾渲染、输入采集 |



\*\*重要：`event` 目录已改名为 `ledger`。移除 `boss`、`sync`、`service` 目录（归档后移除）。\*\*



\## 4. 明确不在本阶段的内容



\- AI 中间层全部内容

\- 服务器认证、世界事件推送、中继、观察者同步

\- 多世界创建与管理、存档复制 / 分叉 / 迁移

\- 本批有限音乐编辑器以外的新音乐 / 地图 / 剧情编辑器

\*\*v3.1 / VERDICT-158 ~ 168 纳入的有限范围（世界文件夹阶段）\*\*

\- 开发阶段本地账号登录 + 由 director 编排的一次简短序章灰盒

\- 登录/首次序章之后统一进入 WorldFolderView

\- 唯一 InitialWorld 入口接通现有 A/B/C/T6/T7 gameplay

\- 世界编辑器目录 15 项，GuidanceEditor 及 MidiTrackEditor 可打开；MusicEditor 为分组目录，RGB 与网格占位

\- 世界/编辑器退出回 WorldFolderView

\- 所有启动链接（含旧 ?guidanceEditor=1）经过统一入口

\*\*v3.3 / VERDICT-180 ~ 190 纳入的有限范围（音频编辑器阶段）\*\*

\- MIDI 音轨时间轴、音符放删改、有界 undo/redo

\- 音乐草稿保存恢复

\- 离线简易试听

\- ChartSourceData 导出及引导线消费

\- RGB 波表 / 网格及实时 DSP / AudioTrack / WebSynth / JNI、标准 .mid、音频片段 / 录音 / 完整混音继续排除

\- 地图编辑器、街景图片生成地图

\- 路人、招募、操控切换、自动接管、待机动作

\- 事件空间视图、星图入口、瞬间截图、结局回映

\- 雨模式、雨痕、异痕、回响痕、触痕

\- 章节判定

\- 谱面的快照与重玩、魔王曲

\*\*v3.7 / VERDICT-211 ~ 225 纳入的有限范围（B2.2 账号里程碑与状态契约；仅 B2.2a + B2.2b）\*\*

\- 账号里程碑本地投影基础（FirstWorldCleared 读取 + CopyPermission 派生）

\- 状态捕获/恢复契约基础（Complete / Incomplete 判别 + 七项归属 + 诊断）

\- 目录权限显示（权限已取得 / 未取得 + 分叉未实施）

\- 明确排除：真实世界通关写入、完整 gameplay 恢复成功、WorldFork 实装、FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入

### B2.2c 真实通关链路授权范围（VERDICT-226 ~ 240）

1. **SphereCrossing 业务实现**：按 VERDICT-227 精确触发条件重建，归 director；复用冻结名，archive 保持只读。

2. **WorldBossChart 合法内容装配**：由制作方经既有编辑器导出 schemaVersion=3 / tier='World' 的 GuidanceChart；每世界内容版本绑定唯一一首；禁止运行时 Regular 改 tier 或空占位。

3. **权威 RouteSignature**：World 首演 Completed 后从同一权威账本累计坐标冻结；6 个 DivergenceAxis 按正最大值归类，正并列按 Red→Green→Blue→Black→White→Grey 选首项，六情感全零返回 null。

4. **T6 ChartRef 与首演判据兼容**：ChartRef 新增可选 state: Entry / PremiereCompleted；T6 终点写 state='Entry'；T7/World 完成写 state='PremiereCompleted'；旧 T6/T7 只读兼容、不回写、不补 state。

5. **最小正式世界叙事内容生产者**：制作方编写 Primary 世界叙事交互内容（schemaVersion=1 / contentId / contentRevision / worldKind='Primary' / protagonistCharacterId / EventSpaceCenter / EventDistance / source / interaction / worldBossChartSource）；玩家通过 PlayerIntent 仅提交 choiceId；director 解析内容构造非零 20 维 NarrativeEvent 并合法追加。旧 T6/T7 灰盒行为保持。

**明确排除**：完整自动感绪计算、完整 20 维感绪系统、状态 hydration（B2.2d）、WorldFork 实装（B2.3）、FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入、AccessCode。

**v3.9 / VERDICT-241 ~ 255 纳入的有限范围（B2.2d-1 完整状态恢复前置 · 核心机制）**

- 授权范围：权威账本（Ledger）、PuzzleProgress、FormatTime 三个 section 的持久化与恢复；无副作用 validate/hydrate；单主 key 原子提交、版本/前缀防回退、世界 lease 与活动目录验证
- 明确排除：RecallCount / WorldLink / ChartSnapshot / ChartScore / WorldFork；Ledger section 校验通过不等同 WorldState 完整恢复

**v3.10 / VERDICT-256 ~ 270 纳入的有限范围（B2.2d-2 完整状态恢复前置 · 扩展四项与七项完成）**

- 授权范围：七项（Ledger / PuzzleProgress / FormatTime / RecallCount / WorldLink / ChartSnapshot / ChartScore）全部持久化；Complete / Restored 可产出（七项全非空且通过内容绑定引用校验的运行时认证后）
- 明确排除：WorldFork（实装仍延后）；B2.3 身份 rebasing；FileCarryPayload



\## 5. 架构不变式（INV-1 \~ INV-9）



| 编号 | 不变式 | 依据 |

|---|---|---|

| INV-1 | 账本只能追加 | 初始架构原则 2 |

| INV-2 | 只有叙事导演能追加账本 | VERDICT-003、020 |

| INV-3 | 表现层只读 | 初始架构原则 3 |

| INV-4 | 解谜链只在终点写入账本 | VERDICT-003 |

| INV-5 | 谱面首演中途退出不写入任何东西 | VERDICT-017、025 |

| INV-6 | 逻辑拖尾色与渲染分离 | VERDICT-016 |

| INV-7 | 场景实体的元素类型只允许 4 种 | VERDICT-011 |

| INV-8 | 命名合规（禁止裸 Event、Developer、Rain 等） | VERDICT-003、004、011、023、039 |

| INV-9 | 全游戏只有一种距离单位 WorldMeter | VERDICT-021 |
- **INV-10（世界运动门控）**：谱面及禁止世界运动的转场期间，世界运动暂停推进，暂停时长不补算。门控必须与受限状态同时交付，最迟 T7。禁止“停止整个 FrameDriver”作为通用门控；只暂停世界运动部分，意图采集、谱面刷新、表现刷新继续。

- **INV-11（表现不写状态）**：`DeepTraceRevealSequence` / `ScreenInvertRipple` / `ExposurePulse` 等表现效果不得修改 `TraceTier`、解谜进度、账本或世界运动门控。逻辑层确认深痕触发，表现层只播放效果并报告播放结束或跳过。

- **INV-12（音频时间线）**：`Strike`、目标拍点、持续期计时统一使用同一条音频时间线。优先使用 Web Audio 的 `getOutputTimestamp()` 建立音频时间与 `performance.now()` 的映射；无可靠输出时间戳时可用平台延迟信息估算或多次采样校准。暂停、恢复、重新起播后必须重建映射。不得对已对齐输出的时钟重复扣减延迟。不批准无测量依据的固定补偿，也不批准首次敲击后自动校准。

- **INV-13（上下文覆盖）**：世界探索与谱面演奏是两套输入上下文。同一物理键在明确的玩法上下文中承担不同动作，不得将谱面键位覆盖传播到世界探索，也不得反向。世界运动门控（INV-10）必须在 Move、Jump 和世界物理推进前检查。


\## 6. 依赖方向矩阵（行依赖列）



图例：✓ 允许　✗ 禁止　R 只能使用读取接口　I 只能使用意图接口



| 从 ＼ 到 | constants | ledger | world | character | trace | chart | editor | musicEditor | director | presentation |

|---|---|---|---|---|---|---|---|---|---|---|

| constants | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| ledger | ✓ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| world | ✓ | ✗ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| character | ✓ | ✗ | ✓ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| trace | ✓ | ✗ | ✓ | R | — | ✗ | ✗ | ✗ | ✗ | ✗ |

| chart | ✓ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ | ✗ | ✗ |

| editor | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | — | ✗ | ✗ | ✗ |

| musicEditor | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | R | — | ✗ | ✗ |

| director | ✓ | ✓（追加+读取） | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | — | ✗ |

| presentation | ✓ | R | R | R | R | R | R + I（仅类型） | R + I（仅类型） | I | — |



\*\*规则：\*\*

\- `constants` 是叶子，被所有模块依赖，自己不依赖任何模块

\- `ledger` 只依赖 `constants`，只引用 ID

\- `director` 是逻辑层最上层，其他逻辑模块不能反过来依赖它

\- `presentation` 只读，对所有逻辑模块只能使用读取接口

\- 意图接口（I）只接收"玩家想做什么"，不暴露写入能力

\- 账本的读取接口和追加接口放在 `ledger` 目录下两个不同文件，只有 `director` 可以引用追加接口

\- `editor` 可值依赖 `constants`、`chart`；对 `presentation`、`director`、`ledger`、`world`、`character`、`trace` 一律 ✗，且零 `cc` 引用（E8）

\- `presentation` → `editor` 为 R + I（仅 `import type`）：只读接口 `GuidanceEditorReader`、意图联合 `GuidanceEditorIntent`、发送端 `GuidanceEditorPort`；类型擦除后不存在值依赖，UI 不获得直接改 selection / chart / score 的能力。其他逻辑模块 → `editor` 一律 ✗

\- `assets/scripts/GuidanceEditorBuilder` 是独立编辑器模式组合根，可实例化 editor 与 UI，不以资产路径绕过逻辑域门禁；编辑器不连接 director / ledger

\- `musicEditor` 可值依赖 `constants`、`chart`；对 `editor` 为 R（仅 `import type` 冻结源契约 `ChartSourceData` / `MidiNoteEvent` / `NoteColor`）；对 `presentation`、`director`、`ledger`、`world`、`character`、`trace` 一律 ✗，且零 `cc` 引用（E8）。其他逻辑模块 → `musicEditor` 一律 ✗

\- `presentation` → `musicEditor` 为 R + I（仅 `import type`）：只读接口 `MusicEditorReader`、意图联合 `MusicEditorIntent`、发送端 `MusicEditorPort`；类型擦除后不存在值依赖。`assets/scripts/MusicEditorBuilder` 是音乐与引导线会话的独立组合根，不连接 director / ledger



\## 7. 本阶段需要的常量



| 常量 | 单位 | 范围 | 单调性与效果 |

|---|---|---|---|

| ScaleRef（角色身高） | WorldMeter | 1.6 | 全游戏唯一尺度锚点 |

| 主角最大移动速度 | WorldMeter/秒 | > 0 | — |

| 纵深可移动范围 | WorldMeter | > 0，远小于地图横向 | 少量靠近和远离 |

| ViewDistance（视距） | 无量纲倍率 | 有上下限 | 越大可视范围越大 |

| TrailLength（拖尾长度） | WorldMeter | ≥ 0，有上限 | 随移动速度增加只增不减 |

| GuideTransparency（引导透明度） | 百分比 | 0% \~ 100% | 越大越看不见，得分加成随透明度增加只增不减 |

| Perfect 判定窗口 | 毫秒 | > 0 | 必须严格小于 Good 窗口 |

| Good 判定窗口 | 毫秒 | > Perfect 窗口 | 超出即为 Miss |

| SYNC_TOLERANCE_MS | 毫秒 | 默认 30 | 音画同步容差；T0 实测偏差 16.87ms / 16.53ms，均在 30ms 内 |

| DEPTH_RANGE_WM | WorldMeter | 大于 0，远小于地图横向 | **总跨度**（非单侧距离）；裁剪以 MapCenter 为基准，两侧各 ±半个总跨度；必须计入中点偏移 |

| JUMP_INITIAL_SPEED_WM_PER_SECONDS | WorldMeter/秒 | 有限且 > 0 | 起跳瞬间向上的速度 |
| GRAVITY_WM_PER_SECONDS_SQUARED | WorldMeter/秒² | 有限且 > 0 | 向下重力加速度的正值幅度 |

| RHYTHM_STRIKE_WINDOW_MS | 毫秒 | 有限且 > 0，默认 100 | 节奏敲击判定窗口；目标拍点前后各 100ms，绝对偏差 ≤100ms 为成功 |

| beatClockOffsetMs | 毫秒 | 默认 0 | 加到输出对齐后的拍点时钟上的校准偏移；用户敲击稳定晚于目标时，所需偏移为负 |


\*\*特别说明：代码中禁止使用 `GuideOpacity`，只能用 `GuideTransparency`。\*\*

**拖尾 3D 跟随**：TrailRenderer 的段位置包含 Y 分量（vertical），拖尾在空中画出弧形 3D 轨迹。原地跳跃时拖尾在垂直方向拉伸。



### 7.1 纵深范围语义（VERDICT-100）

- `DEPTH_RANGE_WM` 表示纵深可移动区间的**总跨度**，不表示每侧距离。
- 当前数值：总跨度 5 WorldMeter，地图中点纵深坐标两侧各允许 2.5 WorldMeter。
- 合法区间：`[MapCenter.depth - DEPTH_RANGE_WM / 2, MapCenter.depth + DEPTH_RANGE_WM / 2]`，两端均包含。
- **实现铁律**：不得把“围绕零裁剪”无条件等同于“围绕 MapCenter 裁剪”。如果纵深坐标使用绝对坐标且中点不为零，必须计入中点偏移。
- 视距调整和镜头路线旋转不改变此逻辑区间。


### T7 视频谱面（VERDICT-121 ~ 126 细化）

**键盘打击垫**：谱面游玩时，英文键 + 符号键（Regular）、数字键 0~9（Drum）、空格键（Heavy）按键盘物理位置映射到屏幕，形成打击垫。ESC 为暂停键。谱面期间 WASD 不移动、数字键不触发世界解谜敲击、空格不跳跃。

**Note 判定**：Note 最小成员为 `timeMs` + `keyId`。判定要求时间有效 + 槽位匹配。三档 Perfect / Good / Miss，判定窗口沿用 `PERFECT_WINDOW_MS = 100`、`GOOD_WINDOW_MS = 200`。一次按下最多消费一条 Note。

**暂停**：`ToggleChartPause` 携带 `videoTimeMs`。暂停冻结媒体位置、Note 判定窗口及演奏进度；恢复时重建音频输出时间映射（VERDICT-120）。暂停不写账本；主动退出执行 AC-21。

**同步容差**：两档分辨率重新测量，按 `SYNC_TOLERANCE_MS = 30ms` 验收。

\## 8. 验收标准（AC-01 \~ AC-29）



\### A. 移动与箱庭

\- \*\*AC-01\*\*：主角可以沿横轴和纵深轴移动，纵深移动幅度明显小于横向移动

\- \*\*AC-02\*\*：镜头中心始终是主角

\- \*\*AC-03\*\*：玩家可以调节视距；调节视距不改变主角纵深坐标和距中点距离

\- \*\*AC-04\*\*：箱庭至少有三层纵深，前后景随镜头移动产生视差；至少有一段路线会让镜头随路线旋转

\- \*\*AC-05\*\*：调试面板显示主角距中点距离，单位为 WorldMeter，同时计入横轴和纵深轴

\- \*\*AC-06\*\*：主角画面高度与 1.6 WorldMeter 尺度一致



\### B. 拖尾

\- \*\*AC-07\*\*：拖尾长度随移动速度增加只增不减；静止时拖尾收拢

\- \*\*AC-08\*\*：拖尾颜色使用占位逻辑拖尾色，本阶段固定不变；任何逻辑不读取渲染出的颜色



\### C. 元素、可见性与解谜

\- \*\*AC-09\*\*：场景中至少有一个 Initial 实体、一个 Process 实体、一枚普通痕；元素类型只能是 4 种允许值之一

- **AC-10（待补验）**：普通模式下画面为低饱和；切换到触发模式后，可以看到处于形态（Concealed）的实体。
  - ✅ 分项 1（已通过）：Triggered 模式下可见 Concealed 实体（用户人工测试确认）。
  - ⏳ 分项 2（待补验）：Normal 模式下画面主体低饱和（背景变色不算；必须让场景主体确实呈低饱和，可用材质/资源配置/颜色处理实现，不强制后处理/LUT）。
  - 必须在阶段 1 完成前补齐并复验。

\- \*\*AC-11\*\*：一个形态实体在触发条件满足后变为明态；移出屏幕后变回形态

> **阶段 1 距离占位**：AC-11 的"移出屏幕后变回形态"在阶段 1 用"距离 ≥ FORGET_DISTANCE_WM 触发 Forget"作为占位实现。阶段 4 若引入屏幕可见性探针，由 presentation 向 director 暴露只读探针替代距离判断。阶段 1 保持距离占位。

### AC-12 节奏敲击（VERDICT-118 修订）

痕在场景中位置固定。主角移动使痕的屏幕投影进入指定敲击区域，同时背景音乐响起，越靠近痕音量越大（`TraceProximityVolume`）。在背景音乐的节拍上执行 `RhythmStrike`，判定窗口为目标拍点前后各 100ms（`RHYTHM_STRIKE_WINDOW_MS = 100`）。
- 输入：数字键 0~9（主键盘 + 小键盘，物理键识别，不依赖 NumLock）触发 Strike；每次独立按下触发一次，长按不产生连续 Strike。
- 感知模式切换：Tab 往返切换 Normal / Triggered。
- 敲击成功推进解谜链，失败保留待敲击阶段。
### AC-13 两步解谜链（VERDICT-119 修订）

第一步：主角移动，使固定痕满足指定接近距离，并使其屏幕投影进入指定敲击区域；条件成立后 `PuzzleProgress` 显式推进至"待敲击"阶段。离开有效范围则退回第一步。
第二步：在第一步条件仍成立时，对该痕完成一次 `RhythmStrike`，时间偏差 ≤100ms。**持续期规则**：第一次有效命中启动 7 秒持续期；有效区间为 `[首次命中时刻, 首次命中时刻 + 7000ms)`，区间内无 miss 则满 7000ms 完成。
**终点排除规则**：目标拍点时刻等于或晚于持续期终点的拍点，不计入本轮持续判定；归属以目标拍点时刻判断，不以按键事件或更新帧的处理顺序判断。
**终点前拍点仍须判定**：若其判定窗口尚未闭合，不得因已满七秒而提前宣布成功。
中间步骤只更新 `PuzzleProgress`，不写账本；链终点恰好写入一条 `NarrativeEvent`，并防止重复结算。

### AC-14 深痕产出与谱面入口（VERDICT-114 / 116 细化）

链终点若为深痕，同一次终点结算同时确定深痕产出并启动自动进入谱面的流程。深痕在触发前与普通痕无视觉区别（`TraceTier = Deep` 但表现层不显示特殊标记）。触发后播放 `DeepTraceRevealSequence`（阶段 1 灰盒：圆环缩放+淡出模拟 `ScreenInvertRipple`），序列结束后**自动**切换至谱面场景，不增加确认按钮或二次交互。视觉揭示、场景切换不额外写入该解谜链的账本事件。


\### D. 视频谱面

### AC-15 引导线谱面（VERDICT-133 修订）

谱面玩法保留键盘打击垫，并叠加白色引导线。头节点生成后 1000ms 内以 Space 按下边沿启动；判定点按路径弧长匀速移动。Tap 按输入时刻路径位置动态取网格键；Drag 检查独立绑定键的按住状态；Hold 持续按住固定起点键至尾端。多线具有独立运行状态。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：编辑器入口是独立入口，不需深痕授权、不启动世界，不代替本 AC。

### AC-16 视频与谱面数据分离（原条文保留）

视频与谱面数据分离。新增 GuidanceChart 作为独立数据；路径、节点、键绑定及速度不得编码进视频或由视频像素推导。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：v1/v2 固定速度相对实际启动；v3 采用绝对媒体目标时间，颜色是可选伴随文件；数据导出再加载，无色文件结果相同。

### AC-17 判定（VERDICT-133 修订）

判定以统一谱面时间轴、节点规则及物理键身份执行。Tap 保留 Perfect / Good / Miss；Drag / Hold 按已冻结规则记 Perfect 或 Miss。漏判、头节点超时、重复输入、多候选及按键边沿均具有确定性结果；每节点最多结算一次。暂停冻结判定，恢复不补算暂停时长。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：Tap ±100/200ms；v3 Drag/Hold 在绝对起/尾时刻检查，精确边界与晚 Head 不补发成功。

### AC-18 引导透明度与视觉（VERDICT-133 修订）

保留引导透明度调节及既有得分加成规则。引导线、节点、判定点采用白色，并按各自触发规则执行擦除或放大淡出。透明度、动画、擦除边界及帧率不得改变路径、键映射、时间窗口或判定结果。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：RGB 不作为 ElementType / TrailColor，不改变透明度或得分；本轮复用原计分实现，不增加新的颜色得分公式。

### AC-19 两档分辨率同步（原条文保留）

两档分辨率同步。引导线扩展须在原验收的两档分辨率下使用同一谱面坐标、弧长进度、网格映射及媒体时钟，继续满足原同步阈值。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：新编辑器在 1920×1080 / 2560×1440 下使用真实视频帧回调与 AudioOutputClock；同归一化数据、同输入判定一致。

### AC-20 完成与账本（VERDICT-133 修订，R26 B）

完整演奏采用 R26 B：全部判定对象已决且视频/音频媒体播放结束，才进入 Completed。头节点超时所属节点亦须全部终结。媒体异常无法结束时沿用独立超时兜底。完成后由 director 恰好写入一条带谱面引用的账本记录，与得分高低无关。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：v3 仍全部节点已决且媒体结束才 Completed；编辑器 preview Completed 零账本写入，gameplay 仍由 director 唯一追加。

### AC-21 中途退出与重入（VERDICT-133 修订）

中途退出立即终止未完成引导线、回收媒体与表现资源并返回世界，不写完整演奏账本。重入复位节点判定、启动时间、按键状态、得分、路径进度、媒体结束标志及超时计时；不重复写入既有解谜终点记录。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：preview 停止、Seek、重入不产生叙事事件；游戏入口与导演原逻辑不变。



\### E. 账本与架构

\- \*\*AC-22\*\*：每条叙事事件包含完整 20 维向量，以及写入时间、输入来源、章节标记、ChartRef

> **阶段 1 灰盒值允许**：阶段 1 的 NarrativeEvent 允许 vector 全零、ChapterTag 空对象、eventId 为占位字符串。感绪系统在阶段 4 实现（20 维真实值），章节系统在阶段 5 实现（ChapterTag 真实值）。阶段 4 / 5 接入后，新记录填真实值，旧记录保持灰盒，不做追溯补写。

\- \*\*AC-23\*\*：账本对外没有修改和删除记录的能力

\- \*\*AC-24\*\*：全工程中只有叙事导演调用了"追加账本"

\- \*\*AC-25\*\*：表现层模块不依赖任何账本写入能力

\- \*\*AC-26\*\*：命名检查：全工程不出现 INV-8 禁止的命名



\### F. 端到端

\- \*\*AC-27\*\*：一次完整流程：出生 → 移动 → 触发模式发现形态痕 → 完成两步解谜链 → 获得深痕 → 进入谱面 → 完整演奏 → 回到世界。账本恰好新增 2 条记录

\- \*\*AC-28\*\*：重复 AC-27 但谱面中途退出：账本只新增 1 条，再次进入完整演奏后最终是 2 条



\### G. 美术可替换（AC-29）

\- \*\*AC-29\*\*：所有占位美术（图片、动效参数、颜色、字体等）必须能在不修改任何逻辑代码的情况下被替换。美术资源与逻辑之间只通过配置或资源引用关联。

&#x20; - \*\*验证方法\*\*：任选一项占位资源，通过修改配置或替换资源文件将其换掉。检查两条：

&#x20;   - 所有逻辑目录（constants、ledger、world、character、trace、chart、director）代码无任何改动

&#x20;   - AC-01 \~ 28 依然全部通过

### AC-30 跳跃（VERDICT-107 修订）

世界探索中，主角位于地面或满足逻辑落地容差时，按下或持续按住空格可起跳；单次跳跃上升、下降并准确落回地面。持续按住空格时，每次落地立即再次起跳，实现连续弹跳；松开空格后不再自动起跳，但已开始的跳跃继续完成。空中不能再次起跳，上升阶段不得因接近地面重复起跳。跳跃期间允许原有横轴与纵深移动；原地跳跃不改变横轴、纵深及距中点距离。跳跃不增加账本记录、不自动生成痕；谱面及禁止操作的转场期间不接受起跳请求，也不缓存请求。

**验证覆盖**：单次起跳、按住连续起跳、松开后停止、空中再按无效、落地后继续按住仍可起跳、移动中跳跃、原地跳跃不改变距中点距离、拖尾 3D 跟随、镜头不跟随 Y 轴、谱面／转场中的无效请求。

### H. 音频编辑器最小交付（ME-01 ~ ME-10）

- **ME-01**：加载音乐工程（Mock 或 MIDI provenance），显示音轨时间轴与音符
- **ME-02**：音符放/删/改操作正常，时间轴与音轨实时更新
- **ME-03**：undo/redo 有界（≤100 项），撤销后新编辑截断 redo；草稿保存/恢复正常
- **ME-04**：离线简易试听（单次 PCM 渲染），播放/暂停/停止/seek 依据 AudioContext 时间
- **ME-05**：严格导出 ChartSourceData（schemaVersion=1、provenance='Midi'），通过 parseChartSourceData 校验
- **ME-06**：导出的 ChartSourceData 可被既有 GuidanceEditorSession 消费并经真实 ChartPremiere/LineEraseEffect 演奏
- **ME-07**：1920×1080 与 2560×1440 两档分辨率下时间轴、音符位置及试听一致
- **ME-08**：退出释放资源，重入复位草稿状态；不产生叙事事件，不连接 director / ledger
- **ME-09**：musicEditor 逻辑模块零 cc 引用；E1~E9 门禁全部通过
- **ME-10**：既有 GuidanceEditorSession / View / Builder 核心未修改；WorldFolderBuilder 仅新增 MidiTrackEditor 路由

### ME-11 ~ ME-19 音乐编辑器批量操作（VERDICT-191~195）

- ME-11：单选 / 多选（Ctrl+点击、Shift+点击、Ctrl+Shift 范围）
- ME-12：框选（空白拖动 > 4px，与实际 noteRect 相交的音符全部选中，可跨轨）
- ME-13：Ctrl+A 全选当前轨；Esc 取消选择
- ME-14：Ctrl+C / Ctrl+V（UI 内存剪贴板；pointer 优先，否则播放头；跨轨 flatten 到当前轨）
- ME-15：拖拽移动（整组 ghost 实时显示，mouseUp 只提交一次 MoveNotes）
- ME-16：Delete / Backspace 删除选中集合
- ME-17：批量操作的 Undo / Redo 整组恢复
- ME-18：恢复工程 / 草稿清选择；重启工作区清剪贴板
- ME-19：文本输入控件（input / textarea / select / contenteditable）不抢快捷键

### B1-01 ~ B1-11 B1 谱面接入游戏入口（VERDICT-196~200）

- B1-01：编辑器导出 `{chartId}.json` 与可选 `{chartId}.visual.json` 成对复制到 `assets/resources/chart/`
- B1-02：SceneBuilder Inspector 字段 ChartResourcePath 配置谱面资源路径（默认 `chart/guidance_c`）
- B1-03：主谱面缺失 / 路径非法 / 数据非法时拒绝加载，不以另一张谱面回退
- B1-04：颜色文件缺失时降级为默认颜色，不阻断谱面加载
- B1-05：颜色文件存在时经 parseGuidanceVisualData 严格校验 schema / chartId / nodeId / 8 位 RGB
- B1-06：完整首演完成后 director 同帧恰好追加一条带 ChartRef 的 NarrativeEvent（+1）
- B1-07：中途退出不新增完整演奏事件，重入不重复 T6
- B1-08：编辑器预览零游戏账本，不连接 director / ledger
- B1-09：v3 谱面复用既有 ChartPremiere / ChartRef / 判定 / 计分 / 完成逻辑
- B1-10：1920×1080 与 2560×1440 两档分辨率下导出字节、节点 / 得分 / 完成结果、账本增量一致
- B1-11：三条门禁（check-naming / check-dependencies / tsc）独立通过

### B2.1-01 ~ B2.1-10 B2.1 本地多世界基础（VERDICT-201~210）

- B2.1-01：默认 InitialWorld
- B2.1-02：动态多项
- B2.1-03：独立最小箱庭
- B2.1-04：墓碑删除
- B2.1-05：InitialWorld 删除后不重种
- B2.1-06：退出返回刷新
- B2.1-07：重启刷新
- B2.1-08：账号隔离
- B2.1-09：存储失败
- B2.1-10：分叉延后反馈

### B2.2-01 ~ B2.2-13 B2.2 账号里程碑与状态契约（VERDICT-211~225）

- B2.2-01：独立 key 不覆盖序章 key
- B2.2-02：FirstWorldCleared 严格解析
- B2.2-03：账号隔离
- B2.2-04：CopyPermission 只读派生
- B2.2-05：单向事实 false→true / true→true
- B2.2-06：损坏/未知版本/身份不匹配拒绝
- B2.2-07：WorldStateSnapshot 头部结构
- B2.2-08：七项归属类型契约
- B2.2-09：Complete / Incomplete 判别
- B2.2-10：已知缺失返回 Incomplete
- B2.2-11：完整恢复请求拒绝
- B2.2-12：WorldForkAvailability=NotImplemented 显示
- B2.2-13：契约测试 vs 生产验收区分

### B2.2c-01 球面穿越触发
Player 写入后，主角权威账本累计坐标 on/outside 且未穿越才授予入口；等号算触发；不要求前一位置在球内。

### B2.2c-02 穿越不可撤销
主角穿越后本运行期间不撤销；入口按 [accountId, worldId, protagonistCharacterId, source=SphereCrossing] 唯一。

### B2.2c-03 WorldBossChart 装配
每世界内容版本恰好绑定一首 schemaVersion=3 / tier='World' 谱面；系统只校验、加载、装配，不运行时改 tier。

### B2.2c-04 World 首演完成判据
沿用现行 C 判据（全部节点已决 + 媒体到既有完成边界）；与分数无关；中途退出不写完成账本、不生成 WorldClearRecord。

### B2.2c-05 RouteSignature 冻结
完成追加后从同一主角账本取完整累计坐标生成不可变 RouteSignature；不复用穿越时快照。

### B2.2c-06 六情感分类
正最大值严格为正选最大；正并列按 Red→Green→Blue→Black→White→Grey 选首项；六情感全零、其余维非零 → divergenceAxis=null、不计 RouteCoverage；完整零向量 → 不生成合法通关路线。

### B2.2c-07 ChartRef.state 兼容
T6 终点写 state='Entry'；T7/World 完成写 state='PremiereCompleted'；旧记录无 state 只读识别（T6_ENDPOINT_PLACEHOLDER→Entry，T7_COMPLETION_PLACEHOLDER→Regular 的 PremiereCompleted）；未知返回 Unclassified；不追溯改账本。

### B2.2c-08 账号通关提交链与幂等
记录先持久化，投影后更新；[accountId, worldId] 幂等；projection 已 true 时跳过重复 saveProjection；记录不进入 WorldStateSnapshot，不随世界墓碑删除。

### B2.2c-09 最小内容生产者
制作方世界内容文件声明 worldKind=Primary / 主角身份 / EventSpaceCenter=零坐标 / 有限正 EventDistance / 每分支 20 维非负向量；玩家仅提交选择 ID；director 按内容解析构造唯一 NarrativeEvent；同一运行只接受该交互的一个选择。

### B2.2c-10 完整链路
Primary 世界 → 玩家选择 → 非零向量追加 → 球面穿越 → WorldBossChart 入口 → 首演完成 → WorldClearRecord → FirstWorldCleared 写入 → CopyPermission=true。

### B2.2d-1-01 ~ B2.2d-1-05 B2.2d-1 完整状态恢复前置（核心机制，VERDICT-241~255）

- B2.2d-1-01：账本 round-trip
- B2.2d-1-02：PuzzleProgress 完整状态
- B2.2d-1-03：FormatTime immutable
- B2.2d-1-04：无副作用 hydration
- B2.2d-1-05：跨账号跨世界拒绝



\## 9. 20 维向量顺序（已冻结）



| 序号 | 中文名 | 英文名 | 类别 |

|---|---|---|---|

| 1 | 红 | Red | 情感 |

| 2 | 绿 | Green | 情感 |

| 3 | 蓝 | Blue | 情感 |

| 4 | 黑 | Black | 情感 |

| 5 | 白 | White | 情感 |

| 6 | 灰 | Grey | 情感 |

| 7 | 物 | Initial | 元素 |

| 8 | 生 | Process | 元素 |

| 9 | 痕 | Trace | 元素 |

| 10 | 明 | Highlight | 元素 |

| 11 | 形 | Commented | 元素 |

| 12 | 雨 | Residue | 元素 |

| 13 | 信任 | Trust | 关系 |

| 14 | 亲近 | Closeness | 关系 |

| 15 | 理解 | Understanding | 关系 |

| 16 | 冲突 | Conflict | 关系 |

| 17 | 揭示程度 | TruthLevel | 真相 |

| 18 | 时间位置 | NarrativeTime | 时间 |

| 19 | 影响半径 | InfluenceRadius | 空间 |

| 20 | 玩家共情程度 | PlayerEmpathy | 共情 |



\- 枚举名：`NarrativeDimension`

\- 取值范围：每个维度都是非负实数

\- 存储格式：按上表顺序存为一个 20 位有序数组，附带 `VectorSchemaVersion = 1`

\- 代码中一律通过枚举名访问维度，禁止直接写数字下标



\*\*v3 时间模型说明（VERDICT-147 ~ 157；七项补充详见 quality-review/guidance-editor/VERDICT-147-157.md §v3 七项补充时间裁定）\*\*

\- `GuidanceChart.schemaVersion = 1 | 2 | 3`

\- v1 恰一条线；v2 至少一条线、固定速度；v3 至少一条线、采用绝对媒体时间表，线数无硬上限

\- v3 使用 `TimedGuidanceLine`（不携带 `speed`）与 `GuidanceNodeTiming`（普通节点 `targetTimeMs`，Hold 专有 `endTargetTimeMs`，以 `nodeId` 关联）；`targetTimeMs` 以视频/音轨开始为 0，暂停时媒体与谱面一起冻结，恢复不改变目标值

\- 时间—距离锚点为 Head（T0, 0）、普通节点起点（Ti, si）、Hold 尾端（Te, se），距离为 `aspectRatio` 加权弧长；时间升序、距离非递减。在 Ti ≤ t ≤ Ti+1 且 Ti+1 > Ti 时，位置函数分段插值：

  `s(t) = si + (si+1 − si) × (t − Ti) / (Ti+1 − Ti)`

  Head 以前 s=0，最后锚点以后 s=L；判定点位置仍由 `positionAtPathDistance(path, aspectRatio, s(t))` 给出，每线独立按 s(t) 擦除。



\## 10. 任务拆分顺序



| 顺序 | 任务 | 对应验收 | 说明 |

|---|---|---|---|

| T0 | 视频同步技术验证 | 第 7 节 | \*\*已完成，偏差 16.87ms / 16.53ms，通过\*\* |

| T1 | 工程骨架 + 命名检查脚本 | AC-24\~26 | \*\*需按 VERDICT-086 返工\*\* |

| T2 | 箱庭场景、主角移动、镜头、视距 | AC-01\~06 | — |

| T3 | 拖尾 | AC-07\~08 | — |

| T4 | 账本桩实现与叙事导演追加入口 | AC-22\~23 | \*\*依赖第 9 节维度顺序，已冻结，可开工\*\* |

| T5 | 元素、可见性、两种感知模式 | AC-09\~11 | — |

| T6 | 节奏敲击机制、解谜链、深痕 | AC-12\~14 | — |

| T7 | 视频谱面（判定、透明度、结算） | AC-15\~21 | 依赖 T0 通过 |

| T8 | 端到端联调 | AC-27\~28 | — |



\## 11. 测试与问题升级



\- 每个任务完成后由用户人工测试

\- EXECUTOR 连续两轮无法修复同一个人工测试问题时，由 PROTOCOL 整理现象、复现步骤和相关验收编号，交给 ARCHITECT 做根本原因分析

\- 任何"为了让测试通过而违反第 5 节不变式"的修改，一律视为失败



\## 12. 阶段 1 完成的定义



\- 第 8 节全部 29 条验收标准通过

\- 第 5 节全部不变式经代码审查确认没有被违反

\- 第 7 节技术验证有书面结论

\- 第 9 节维度顺序已经裁定并冻结

## 13. 表现层骨架命名（VERDICT-094）

| 文件 | 类型 | 职责 |
|---|---|---|
| src/presentation/FrameDriver.ts | FrameDriver（Cocos 组件） | 每帧驱动执行顺序：整理输入 → 交给意图接口 → 通知表现组件刷新 |
| src/presentation/CameraRig.ts | CameraRig（Cocos 组件） | 镜头对准主角、视距调整、沿路线旋转 |
| src/presentation/InputCollector.ts | InputCollector（Cocos 组件） | 采集原始输入，转换为 PlayerIntent |
| src/director/PlayerIntent.ts | PlayerIntent | 阶段 1 五种意图：移动、敲击、切换感知模式、进入谱面、退出谱面 |
| src/director/IntentPort.ts | IntentPort | presentation 通往 director 的唯一窄路 |

## 14. 引擎隔离规则（VERDICT-094）

- 逻辑模块（constants、ledger、world、character、trace、chart、editor、musicEditor、director）不得引用 `cc` 模块。
- 只有 `presentation` 可以引用 Cocos 引擎。
- 表现层可以保存显示状态（镜头参数、转场进度、渲染过渡色），但任何逻辑模块都不得读取这些状态。

## 15. 感知模式归属（VERDICT-094）

- 当前感知模式由 `director` 保存，作为运行时状态，不写入账本。
- `trace` 中判断可见性和交互的规则，以“当前感知模式”作为参数，`trace` 自身不保存模式。
- 表现层读取当前模式，用来切换低饱和滤镜。

## 16. 20 维序号对应关系（VERDICT-092）

- `docs/spec/stage-1.md` 第 9 节表格中的序号 1 ~ 20，对应代码中的 0 ~ 19。
- 即：表格序号 1（红，Red）= 代码 0；序号 20（玩家共情程度，PlayerEmpathy）= 代码 19。

## 17. 同步容差不变式（VERDICT-093）

- `SYNC_TOLERANCE_MS` 必须严格小于 `PERFECT_WINDOW_MS`。
- 当前占位值：`SYNC_TOLERANCE_MS = 30`、`PERFECT_WINDOW_MS = 100`（30 < 100 ✓；VERDICT-093 不变式仍成立）。
- 这条不变式必须加入自动化测试。

## 18. T0 同步验证记录（SyncVerificationRecord）

- 运行环境：桌面 Chromium 142（Electron 内核）
- 分辨率与最大偏差：1920×1080 → 16.87ms；2560×1440 → 16.53ms
- 样本数：各 10/10
- 素材规格：H.264/30fps/180帧/6.0s
- 判定圈编码对齐误差：0ms
- 容差：100ms，通过
- 结论：T0 通过，但仅对已测环境有效。正式发布用的运行环境必须做过同步验证。

## 19. 阶段 1 的 PC 构建目标（PROTOCOL 确认）

- 构建方式：**Web 桌面版 / 用 Electron 打包**
- 视频播放底层：浏览器内核的视频元素
- T0 覆盖情况：**已覆盖**，T0 结果直接生效，不需要在原生构建上补测。
- 新增规则：正式发布用的运行环境必须做过同步验证。每增加一个目标平台（包括以后的移动端），都要补一份同步验证记录（SyncVerificationRecord）。

- **Electron 版本锁定（Claude 补充）**：阶段 1 的 Electron 版本必须锁定为 T0 测试时使用的那个版本，在工程配置中写死，不允许宽松的版本范围。以后升级 Electron 大版本，算作"换了一个运行环境"，按 VERDICT-093 的规则补一份同步验证记录（SyncVerificationRecord）。
