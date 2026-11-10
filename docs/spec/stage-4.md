# stage-4

阶段：R1 冻结基线对应阶段规格
版本：v1.4（R3.6 项目树增补）
生成：2026-10-19（Asia/Shanghai）
依据：R1 草案 v2.2 + 补丁 01
状态：R1 冻结候选；经 PROTOCOL 审阅、Trae 落盘、三门禁通过后生效
编码：UTF-8 无 BOM
路径：docs/spec/stage-4.md

---

## §1 目标与非目标

### 1.1 目标

1. 定义 v4.0 的模块职责、数据存储、依赖矩阵、常量、验收标准（AC4-01~44）。
2. 作为 R2~R5 的实现契约；每个 AC 必须可机械验证。
3. 与 `NAMEBOOK-v4.0.md` 一一对应：AC 中出现的名字必须在 A 类中；A 类中的名字必须有归属模块。
4. 明确“服务端不留”“事件树节点 ≠ 世界”“逻辑层零引擎”三条硬边界。

### 1.2 非目标

1. 不定义 UI 视觉细节（颜色、字号、动效曲线）；这些属于 R3/R4 实现，stage-4 只定义行为。
2. 不定义具体算法实现（如 SGBM 参数、视差因子数值）；只定义接口与可观察行为。
3. 不定义发布链（导出格式、创意工坊）；这些属于 D 类。
4. 不兼容 v3.21 的任何数据格式；v4.0 是全新命名空间。

---

## §2 技术基线

| 层 | 技术 | 约束 |
|---|---|---|
| 桌面壳 | Tauri 2 | 唯一允许值引用 Tauri 的层是 app |
| 前端框架 | React 19 + TypeScript | 唯一允许值引用 React 的层是 presentation |
| 2.5D 渲染 | PixiJS | 唯一允许值引用 PixiJS 的层是 presentation |
| 音频 | Web Audio API | 唯一允许值引用 Web Audio 的层是 presentation |
| 深度图 / 抽帧 | Rust（本地 SGBM） | 通过 Tauri command 暴露；逻辑层只依赖端口 |
| 禁止 | Cocos Creator | 任何版本均不得引入 |
| 禁止 | 自建服务端（Node / Fastify / PG / Relay） | 不运营任何 Neurou 服务端 |
| 允许 | 客户端直连用户自有第三方 API | CloudProvider / 天气 API；必须由 app/adapters 实现 |

---

## §3 模块职责

| 模块 | 代号 | 职责 | 禁止 |
|---|---|---|---|
| constants | K | 全局常量与窗口 | 不得 import 任何其他模块 |
| ledger | L | 20 维账本、append-only 存储、派生量 | 不得 import director / presentation |
| trace | T | 痕、可见性、判定结果 | 不得 import chart / director |
| world | W | 世界实例、2.5D 视差配置、移动 | 不得 import presentation |
| timeline | M | 时间轴状态机、播放状态 | 不得 import presentation |
| chart | C | 谱面、动态图层、8 格、Logo、魔王曲 | 不得 import trace / editor |
| eventgraph | G | 世界内动作蓝图 | 不得 import presentation / director |
| media | D | 媒体源、深度图、音频段 | 不得 import presentation |
| ai | A | AI 提供者、任务路由、降级链 | 不得直接发网络请求；只依赖注入端口 |
| studio | S | 单机身份、项目清单、存储端口 | 不得直接碰 fs；文件适配器在 app/adapters |
| editor | E | 编辑器视图模型、谱面编辑 | 不得 import director / ledger |
| musicEditor | U | 音乐工程、草稿、试听 | 不得 import director / ledger |
| character | H | 主角纯逻辑（去 Cocos） | 不得 import presentation |
| director | R | 玩家意图、唯一账本写入口 | 不得 import presentation |
| presentation | P | React / PixiJS / Web Audio 表现层 | 不得直接写账本；只通过 IntentPort |
| app | X | Tauri 组合根、适配器注入 | 唯一允许值引用 Tauri 的层 |

---


### 3.0 .tsx 架构约定

- `v4/core/presentation/` 下需要使用 Pixi / React 等 app 依赖的文件，一律使用 `.tsx` 扩展名。
- 这些文件由 `v4/app/tsconfig.json` 负责类型检查；root `v4/tsconfig.json` 不包含 `.tsx`。
- `check-naming` 扫描范围包含 `.tsx`；`check-zero-engine` 排除 `presentation`。

### 3.1 NAMEBOOK section 归属

| NAMEBOOK section | 数量 | 归属模块 | 说明 |
|---|---:|---|---|
| §1.5 视差框 | 8 | W（world） | W 的子域；不新增顶层模块 |
| §1.6 触发器 | 10 | W（world） | W 的子域；不新增顶层模块 |
| §1.12 事件树 | 5 | G（eventgraph） | G 的子域；不新增顶层模块 |
| §1.21 projecttree | 12 | S（studio） | S 的子域 |
| §1.22 interaction | 3 | P（presentation） | P 的子域 |

---

## §4 数据与存储

### 4.1 项目目录



<Project>/
project.json
event-tree.json
worlds/<worldId>/world.json
worlds/<worldId>/ledger.ndjson
worlds/<worldId>/ledger.head.json
worlds/<worldId>/charts/<chartId>.json
media/manifest.json
media/<assetId>.<ext>
drafts/

### 4.2 事件树（event-tree.json）

- 只存 DAG：`nodes[]`（`nodeId`、`worldId`、`entryAnchor`、画布坐标）、`edges[]`、`rootNodeId`。
- 节点不内嵌世界；节点只存 `worldId` 与入口锚点。
- 全项目恰好一个 Primary 世界，且等于 `rootNodeId` 指向的世界。

### 4.3 账本（ledger.ndjson + ledger.head.json）

- `ledger.ndjson`：一行一条 `NarrativeEvent`，只追加。
- `ledger.head.json`：`schemaVersion` / `eventCount` / `lastEventId` / `positionSum` / `checksum`。
- 唯一写入口：`appendNarrativeEvent`，只允许 director 调用。
- `LedgerStore` 不暴露 update / delete。
- 损坏策略：head 与末行不一致 → 拒绝加载并给只读诊断，不自动截断、不静默重建。

### 4.4 谱面（ChartSourceData v2）

- `schemaVersion = 2`。
- 外壳：`chartId` / `provenance` / `layers[]` / `notes[]`。
- 音符字段：`timeMs` / `durationMs` / `chartLayerIndex` / `gridCellId?` / `chartKeyId?` / `chartPadKind`。
- Hold：`durationMs`；第 2 层用 `HoldGridLine`；第 1/3+ 层用 `SpaceHoldOverflow`。
- 不做 v1 兼容：`parseChartSourceData` 只接受 v2；旧文件拒绝并给明确诊断。

### 4.5 原子写

- JSON 文档：临时文件 + `fsync` + `rename`；保留一代 `.bak`。
- NDJSON：追加写 + `fsync`；head 单独原子写。
- 崩溃后重开：`.bak` 回退；NDJSON 末行不完整 → 拒绝加载并只读诊断。

---

## §5 依赖矩阵

模块：constants(K)、ledger(L)、trace(T)、world(W)、timeline(M)、chart(C)、eventgraph(G)、media(D)、ai(A)、studio(S)、editor(E)、musicEditor(U)、character(H)、director(R)、presentation(P)、app(X)。

| 模块 | 可值依赖 | 仅类型（R / I） |
|---|---|---|
| K | — | — |
| L | K | — |
| T | K | W |
| W | K、M | — |
| M | K | — |
| C | K | M |
| D | K | — |
| G | K | W、C、D |
| A | K | D、G |
| S | K、L | W、G、C、D、E |
| E | K、C、M | W、D、U、G |
| U | K、C | E |
| H | K、W | — |
| R | K、L（append）、T、W、M、C、G、D、A、H | S |
| P | K | 全部逻辑模块 R/I |
| X | 全部 | — |

### 5.1 子域允许边

| 子域 | 归属 | 允许依赖 |
|---|---|---|
| console | presentation | K（值）、W（R）、S（R/I） |
| rain-visual | presentation | K（值）、W（R） |
| weather | app/adapters | K（值） |
| ai-adapter | app/adapters | K（值）、A（R） |

### 5.2 规则

1. director 是唯一可值引用 `appendNarrativeEvent` 的模块；`LedgerStore` 可被 studio/app 构造，但写方法只由 director 调用。
2. presentation → director 只允许 `IntentPort` / `PlayerIntent` 类型（I 边）。
3. 逻辑模块（K~R）零 React / PixiJS / Web Audio / Tauri / Node fs。
4. editor 不得依赖 director / ledger；musicEditor 不得依赖 director / ledger。
5. studio 只定义存储端口，不直接碰文件系统；文件适配器在 app/adapters。
6. EventGraph 与 EventTreeDAG 是两张图；eventgraph 不得反向依赖 presentation。
7. `Strike`（director）与 `GridStrike`（trace）不得互相引用；chart 不得 import trace；trace 不得 import chart。
8. `ChartLayer` 的类型与分值在 chart；`AddChartLayer` / `RemoveChartLayer` 在 editor；editor → chart 为值依赖，chart 不反向依赖 editor。

### 5.3 禁止边

- chart → trace；trace → chart。
- trace → eventgraph / director；eventgraph → director。
- editor → director / ledger；musicEditor → director / ledger。
- 逻辑模块 → React / PixiJS / Web Audio / Tauri / Node fs。
- console 绕过 presentation 直接 import studio 的写方法。
- 任何模块直接调用 `LedgerStore.append` 以外的账本写路径。

---

## §6 常量

| 常量 | 值 | 说明 |
|---|---|---|
| VectorSchemaVersion | 1 | 20 维向量版本 |
| GRID_PERFECT_WINDOW_MS | 待 R2 冻结 | 8 格 Perfect 窗口 |
| GRID_GOOD_WINDOW_MS | 待 R2 冻结 | 8 格 Good 窗口 |
| FRAME_ALIGNED_WINDOW_MS | 待 R2 冻结 | 视差框对准窗口 |
| CHART_LAYER_BASE_SCORE | 待 R2 冻结（B 类候选） | 层基准分；示例 800 仅说明 |

窗口常量具体数值由 R2 冻结；R1 只冻结名字与语义。

---

## §7 AC4-01 ~ AC4-44

标记：[修订] = v1 已有、v2 修改；[新增] = v2 新增；无标记 = v1 原样。

### AC4-01 单机无账号

无登录 UI、无网络请求；`StudioProfile` 单例。

### AC4-02 项目目录布局固定

`project.json` / `event-tree.json` / `worlds/` / `media/`。

### AC4-03 JSON 原子写 + .bak 回退

临时文件 + `fsync` + `rename`；保留一代 `.bak`；崩溃后重开一致。验证四种情形：崩溃在 `.bak` 写入前 / 后 / `rename` 前 / 后，重开均一致。

### AC4-04 事件树 DAG

增删节点/边、环检测、单根。

### AC4-05 节点只存 worldId

世界删除 → 节点标 orphan，不静默级联删除；orphan 节点在 UI 中灰显并带警告图标，可从 DAG 手动删除。

### AC4-06 全项目恰好一个 Primary 世界

且等于 `rootNodeId` 指向世界。

### AC4-07 世界至少三层视差

层速比可配且不影响判定。

### AC4-08 左右移动映射时间轴进度

方向/边界/暂停冻结。

### AC4-09 [修订] 视差框

矩形、每层因子、目标入框判定、`FrameTracking`、`VisualFrameTargetLock`；`VisualFrameSaturation` / `GlobalSaturation` 只读，逻辑层不读取渲染颜色。

### AC4-10 痕显现

`FrameAligned` + 节拍才 `Revealed`；`FrameLost` / 退出恢复；四类转换原因。

### AC4-11 账本 append-only

无 update/delete API；单写者；序号连续。

### AC4-12 head 与末行不一致

→ 只读诊断，不截断、不重建。

### AC4-13 20 维向量

顺序 / 非负 / `VectorSchemaVersion=1`；`validateNarrativeVector` 拒绝非法。

### AC4-14 [修订] 8 格仅用于 ChartLayerIndex=2

布局 2 行 × 4 列 = 8 格；第 1 层与第 3+ 层为全屏判定，不使用 8 格。

### AC4-15 判定窗口

`GRID_PERFECT_WINDOW_MS` / `GRID_GOOD_WINDOW_MS` 生效；同音符至多一次；暂停冻结。

### AC4-16 [修订] Hold 归属单一 ChartLayerIndex

第 2 层用 `HoldGridLine`；第 1/3+ 层用 `SpaceHoldOverflow`；禁止跨层 Hold。

### AC4-17 [修订] 分层判定

第 1 层 TopMost 空格全屏判定；第 2 层 8 格；第 3+ 层任意区域点击；同刻冲突按层序先判，同一输入不重复计分。

### AC4-18 BlindMode

隐藏视觉引导（含 `NoteLogoGuide` 与网格线），判定窗口不变。

### AC4-19 首演

完成恰好 +1 条带 `ChartRef` 的 `NarrativeEvent`；中途退出 0；重演不重复首演。

### AC4-20 蓝图逻辑门

`And` / `Or` / `Not` 真值表正确。

### AC4-21 [修订] 随机

编辑预览用 `RandomSeed` 可复现；运行时真随机；延时按时间轴；循环有上限并产生 `CycleWarning`。

### AC4-22 [修订] 编辑预览同种子 + 同输入 + 同时间轴 → 同结果

运行时不可复现；重放不承诺一致。

### AC4-23 媒体导入

视频/音频/深度；trim；失败回滚。

### AC4-24 AudioOutputClock 对齐媒体

漂移阈值；`Downbeat` 标记。

### AC4-25 编辑器 undo/redo 有界

保存/加载 round-trip；导出 v2。

### AC4-26 五类 AI 任务路由

失败降级 `Local` / `Template`；AI 不写账本。

### AC4-27 逻辑层零引擎

零 React / Pixi / WebAudio / Tauri / fs；依赖门禁 E1~E9 = 0 ERROR。

### AC4-28 端到端

新建 → 世界 → 事件树 → 谱面 → 试玩 → 账本 +1 → 重开一致；外部网络 0（Cloud AI / 天气仅按用户配置显式触发）。

### AC4-29 [新增] cmd 风格世界文件夹

prompt、命令、输出、环境文本、效果、世界文件条目、导出/导入、加载序列、设置；键盘可完成打开项目/进入世界/导出/导入/设置；不出现账号与登录。

### AC4-30 [新增] 分层判定

第 1 层空格全屏；第 2 层 8 格；第 3+ 层全屏点击；`AddChartLayer` 追加全屏层；`RemoveChartLayer` 只删第 3+ 空层；第 1/2 层不可删；索引与分值同步重算；`ChartPadKind` 与 `ChartLayerIndex` 解耦（Layer 1 TopMost；Layer 2 可 Heavy/Light 共用 8 格；Layer 3+ Light；分值只看 LayerIndex）。

### AC4-31 [新增] Logo 引导

提前 `NoteLogoLeadTimeMs` 出现；存活 `NoteLogoLifetimeMs`；Hold 延长 `NoteLogoHoldExtensionMs`；Miss 触发 `NoteLogoMiss`；`BlindMode` 隐藏引导但不改判定；`GridLineVisibility` 见 AC4-32；`NoteLogoGuide` 仅用于 `ChartLayerIndex ≤ 2`（Layer 1 与 Layer 2）；Layer 3+ 不生成 Logo，玩家在任意区域按判定时间点击即可。

### AC4-32 [新增] 动态网格

点击某格成功 → 该格 `DynamicGridScale = 1.5`；点击到该格放大后矩形之外 → 恢复 `1.0`；每格独立维护放大状态；放大不改变 cell → key 映射与判定窗口。`GridLineVisibility` 默认 `Concealed`；点击该格成功 → 该格 `Revealed` 并随 `DynamicGridScale` 放大；恢复 `1.0` → `Concealed`（stage-4 细则：可定义短暂保留可见）。

### AC4-33 [新增] 长按越界重按

`HoldGridOverflow` / `SpaceHoldOverflow` 终止当前段，必须重新按下才能续接；重按成功延续，失败记 Miss；不重复计分；越界只影响 Hold 段，不改变 `DynamicGridScale`。

**时序细则**：Hold 提示（可能移动）越过判定网格线的时刻，即对应区域新键需按下的时刻。越界后未按 → Miss；按对 → 续接；按错 → Miss 并终止当前段。

### AC4-34 [新增] 编辑器谱面编辑

`ChartEditMode` 切换；`KeyframeTrack` / `ChartKeyframe` 编辑；`LogoPositionPicker` / `LogoRandomPlacement`；`ChartEditUndo`；`AIKeyframeGeneration`；预览使用 `RandomSeed`。

**右栏交互细则**：

1. 选中关键帧后，右栏才显示编辑选项；未选中时不显示。
2. 预览窗口支持双击选择、拖动。
3. 起始 / 结束 / 中间关键帧分别设置位置、大小、拉伸、出现/消失动效。
4. 中间关键帧自动生成移动动画（起始 → 中间 → 结束）。
5. 右栏“选位”→ 点击预览窗口某位置 → 创建引导 logo。
6. 右栏可删除关键帧及其关联 logo。

### AC4-35 [新增] AI 双模式

`AIProviderMode` 切换 `Local` / `Cloud`；`Cloud` 使用用户自填 Key 直连；失败按 `FallbackChain` 降级；Key 不写项目/账本/日志；无 Neurou 服务端。

### AC4-36 [新增] Rain 激活

`PerceptionMode.Rain` 跟随 IP 地天气进入/退出；蓝图不得触发 Rain；实拍雨景可作为蓝图事件剪辑触发，但不改变 `PerceptionMode`。

### AC4-37 [新增] Rain 强度

天气映射到 `RainIntensity`（`Light` / `Moderate` / `Heavy`）；强度驱动雨丝密度与音量，不改变判定。

### AC4-38 [新增] Rain 视觉

低饱和 + `NoteLogoGlow`（雨丝可见）+ `RainTintSource`（视频谱面色调）；logo 可见；视差框可见（主要用于非谱面场景）。

### AC4-39 [新增] Rain 降级

`LocationUnavailable` / `WeatherUnavailable` / `NetworkUnavailable` → `RainModeState.degradedReason`；`PerceptionMode` 仍保持 Rain，仅有效视觉降为 Normal（不回写）；不改变玩家当前感知模式选择；恢复网络自动重试，成功回 Rain，失败保持 Normal。

### AC4-40 [新增] 层分值

`score(1) = base`；`score(n) = max(1, floor(score(n-1) × 0.5))`；示例 800→400→200→100→50→25→12→6→3→1→1…；增删层后重算。

### AC4-41 [新增] 随机分流

编辑预览 `RandomPreviewMode.Seeded` + `RandomSeed` 可复现；运行时 `RandomPreviewMode.Live` 真随机；同一输入运行两次结果可不同。

### AC4-42 [新增] 命令约束

`ConsoleDirectory` 虚拟目录（主文件夹 + 子目录）；`ConsoleDirectoryConstraint` 只允许主文件夹下层操作，`cd ..` 到上层被拒绝并提示；`ConsoleCommandList` 显示在 `ConsoleEnvironmentText` 下方；越界命令不改变当前目录。

### AC4-43 [新增] 选择与高亮

`WorldSelectionMode` 支持上下键 / 回车 / 鼠标点击 / 掠过高亮；`WorldEntryHighlight` 对 exe 与文件夹都用 `>` 和 `<` 夹住 + 白底黑字；`ContextMenuAction` 右键提供新建 / 删除 / 导出。

### AC4-44 [新增] 进入过渡

`WorldLoadingSequence` 依次执行 `WorldLoadProgressBar`（命令行风格、向下滚动）→ `WorldPixelZoom`（滚动加速 + 像素点放大循环）→ `WorldEnterTransition`（叠黑 + 闪光 + 显示世界）；过渡期间不写账本、不改变世界状态。

### AC4-45 Workspace / ProjectFolder / Project schema v2 与 v1 迁移

- Workspace 根含 workspace.json，记录 folders[] / projects[] / tree
- ProjectFolder schema v2：folderId / folderName / projectIds；不递归
- ProjectMeta schema v2：projectId（8 位）/ author / createdAt / completedAt（可 null）/ theme / prologue / worldIds
- ProjectTree 节点含 Folder 与 Project 两类；边只存显式 Link，包含关系由 folder.projectIds 派生
- v1 旧项目：只读识别 → 非破坏性复制迁移（失败回滚、旧目录不动、legacyProjectId 记录）
- 外部编辑冲突：mtime + size + hash 检测，冲突时只读诊断，不静默覆盖

### AC4-46 项目树 3D 布局

- RGB→XYZ：baseX / baseY / baseZ 由项目主题色映射；Folder 取子项目平均色
- 透视：近大远小；方框只做 scale，始终正对屏幕
- 相机：鼠标距中心越远 pan 越大；滚轮改 dolly（0.7~1.6）；有平滑插值
- 游走：每个 Project 的 Worlds 主题色映射为 Catmull-Rom 闭合路径；单世界退化为圆轨道；每节点独立相位

### AC4-47 项目树视觉

- FisheyeEffect：径向桶形畸变（Pixi 自定义 shader 或等效）
- VignetteEffect：径向暗角
- ThemeBackground：悬停 Project 交叉淡入项目主题图；移开保持最后一张
- InvertRipple：新建文件夹时从点击点扩张的差异圆
- DesaturationEffect：撤回时瞬间降饱和再恢复
- 滚轮缩放视距；选中项目放大 1.5× + 主题图 + 外部降亮/糊化

### AC4-48 项目树交互

- 左键单击选中；再次点击进入/展开；双击空白新建 ProjectFolder
- 右键空白 undo；右键 3 秒内 redo；右键 Project/Folder 提供删除/链接/新建项目
- WASD 移动选中（方向点积 + 距离最近）；方向键上下调音量；方向键左右时间回溯
- 项目文件夹 / 项目在文件资源管理器可见；删除移入 .trash，撤销恢复
- 链接为应用内引用（输入 folderId），不建 OS 快捷方式

### AC4-49 ProjectConsole

- 纯文本界面，无栏目；仅命令行输入输出 + 鱼眼 / 暗角
- 头部输出：Author / Created / Completed / Worlds / Theme / Prologue（项目序言）/ Project ID（1234 5678）/ Type 'help'...
- 命令：ls / cd / pwd / help / clear / settings / open / export / import / exit
- 根目录 cd .. 被 ConsoleDirectoryConstraint 拒绝
- World 列表作为条目；cd / open 进入；exit 返回项目树

### AC4-50 世界进入过渡

- 从 ProjectConsole 选择 World → WorldLoadingSequence：
  1. WorldLoadProgressBar 滚动加载行 + 进度
  2. WorldPixelZoom 视角拉近到像素点
  3. 黑屏；WorldEnterTransition 中央显示 WorldInstance.prologue（世界序言，非项目序言），白色字幕淡入 / 停留 / 淡出
  4. 3s 后闪光 → 世界从模糊/过亮恢复至正常亮度与清晰度
- 过渡期间不写账本、不改变世界状态
- 字幕内容来自 WorldInstance.prologue；项目序言在 ProjectConsole 头部单独显示

### AC4-51 时间回溯与撤销重做

- UndoRedoStack<T>：commit / undo / redo / canUndo / canRedo / clear；容量 100
- HistorySnapshot 含 workspace / visual / trashRefs；不复制世界字节
- TimeRewind：按住左方向键回退到历史快照；右键或 Esc 取消回退
- 按住右方向键只加速动画，不重放鼠标轨迹
- 3 秒内再次右键识别为 redo
- 文件删除 / 新建通过 .trash 支持 undo；外部编辑冲突只读
- 输入优先级：文本输入 > 模态层 > 拖拽 > 项目树 > 世界/ProjectConsole

### AC4-04~06 适用范围修正

- EventTreeDAG 的 DAG / 单根 / Primary 世界语义改为"Project 内部的世界编排图"
- 全项目主界面由 ProjectTreeView 承担；EventTreeView 降为项目内视图


---

## §8 证据与门禁

### 8.1 证据

每个 AC 必须提供：

1. 实现位置（文件路径 + 函数名）。
2. 验证方式（单元测试 / 集成测试 / 手动步骤）。
3. 证据文件（测试报告 / 截图 / 日志），存放于 `quality-review/stage-4/`。

### 8.2 门禁

| 门禁 | 内容 | 通过条件 |
|---|---|---|
| E1 命名 | `check-naming`：A 类名存在、禁名表不出现、同名不跨模块 | 0 ERROR |
| E2 依赖 | `check-dependencies`：依赖矩阵规则 | 0 ERROR |
| E3 逻辑层零引擎 | 逻辑模块（K~R）零 React / Pixi / WebAudio / Tauri / fs | 0 ERROR |
| E4 账本单写者 | 只有 director 调用 `appendNarrativeEvent` | 0 ERROR |
| E5 原子写 | JSON + NDJSON 崩溃恢复 | 4 种情形全部通过 |
| E6 端到端 | AC4-28 | 通过 |
| E7 外部网络 | 默认 0 请求；Cloud / 天气仅显式触发 | 通过 |
| E8 编码 | 全部文档 UTF-8 无 BOM | 通过 |
| E9 归档 | v3.21 快照 SHA256 一致 | 通过 |

---

## §9 范围外

1. UI 视觉细节（颜色、字号、动效曲线）。
2. 具体算法实现（SGBM 参数、视差因子数值）。
3. 发布链（导出格式、创意工坊）。
4. v1 谱面兼容。
5. 移动端 / 触控。
6. 插件系统。
7. 云端 AI 托管。
8. 协作 / 分享。

以上属于 D 类或 R5 及更后。