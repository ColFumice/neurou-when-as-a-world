# 「项目树 / 项目 cmp」影响评估 v1

- 日期：2026-10-20（Asia/Shanghai）
- 角色：DSH 架构评估，供 PROTOCOL 裁定
- 结论：这不是单纯美术调整，而是**产品层级 + 数据模型 + 主界面 + 存储 + 已有 AC 语义**的变更
- 当前状态：R3.3b-2 已落盘但尚未人工验收；本文件不建议直接开工

## 1. 我理解的新层级

用户描述的生产层级是：

```text
Workspace（项目树/工作区）
  └─ ProjectFolder（项目文件夹；可包含多个项目）
       └─ Project（项目；可包含多个世界）
            └─ World（世界；可包含多个场景）
                 └─ Scene（场景，R4+）
```

- 主界面方框代表 **Project 或 ProjectFolder**，不再是 World。
- 一个 Project 内部有多个 World；Project 的主题通常贯通其世界。
- 双击 Project 进入 **项目 cmp**；在项目 cmp 中列出 World；进入 World 触发加载与进入世界过渡。
- ProjectFolder / Project 在文件资源管理器中是真实文件夹，可由用户传输/编辑。
- 首次游玩只有一个居中 ProjectFolder + 两个相连 Project；后续才扩展。

## 2. 与现有冻结实现的冲突

| 现有实现/AC | 新需求 | 影响 |
|---|---|---|
| `StudioProject` 是单个项目根，`project.json` 在根下 | Workspace → ProjectFolder → Project 多级目录 | AC4-02 项目目录布局需重裁；`ProjectStore`/Node/Tauri IO 的根语义改变 |
| `EventTreeDAG` 的节点是 `worldId`，主界面是事件树 | 主界面方框是 Project/ProjectFolder | AC4-04/05/06 的“事件树/单根/Primary world”需确定是**项目内世界图**还是被项目树取代 |
| `EventTreeView` 是主界面 | 新主界面是项目树 | R3.2 已冻结 UI 可能被替换或降级为项目内视图 |
| `WorldFolderConsole` 有左目录/右输出/设置栏 | 项目 cmp **纯文本，无其他栏目** | AC4-29/42/43/44 的 console 语义与布局需重裁；“项目 cmp”与“世界 console”是否两个界面未定 |
| `WorldFileEntry` 是世界文件条目 | 项目 cmp 列 World、项目树列 Project/ProjectFolder | 需要新的项目/文件夹条目模型；现有纯逻辑可复用一部分 |
| `ProjectStore` schemaVersion 1、projectId 为普通 string | 项目编号 8 位数字（显示时第 4/5 位间空格）、作者/创建/完成/世界数/主题/序言 | 需要 schema v2/迁移；R2 AC4-02 测试与既有项目文件受影响 |
| 无 ProjectFolder / ProjectTree / ProjectConsole 等 A 类名 | 需要项目树、项目 cmp 的公开模型 | NAMEBOOK A 类冻结；必须裁定新增名字或明确复用旧名 |
| 无时间回溯/撤销/重做/音量手势 | 左右方向键倒放/加速、右键撤回、3 秒内撤回撤回、音量拖拽、亮度反馈 | 新增交互/历史系统，不在现有 stage-4 范围 |
| 无 3D 项目树/主题图背景/鱼眼 | 方框 RGB→XYZ、近大远小、游走、背景主题图、鱼眼/暗角/反色涟漪 | R3.4 视差之外的新渲染子系统；需资产与性能预算 |
| 无项目级元数据/项目加载序列 | 项目 cmp 头部、世界加载、像素点黑屏、亮屏糊化 | 需要新的加载状态机与项目文件读取 |

## 3. 建议的方向（待裁定）

### 3.1 不要直接“替换 EventTreeDAG”

建议保留 `EventTreeDAG` 作为 **Project 内部的世界编排图**，在项目 cmp/项目内视图中使用；主界面新加 **ProjectTree** 作为更高层。

理由：

- R3.2 的 5 个 G 类、MainScreenView、EventTreeView、AC4-04~06 已冻结；直接替换会让这些工作失效。
- 新模型仍需要“项目内多个世界如何连接/进入”的数据；EventTreeDAG 可承担这个职责。
- 主界面项目树与项目内世界图是不同层级，不应混成一张 DAG。

代价：主界面不再是 EventTreeView；AC4-04~06 需要重新解释为“项目内世界图”。

### 3.2 项目树与项目 cmp 分层

建议：

- `ProjectTreeView`（P，新名或复用 MainScreenView）：ProjectFolder/Project 方框、3D 布局、主题背景、鱼眼/暗角、WASD/缩放/音量/时间回溯。
- `ProjectConsole`（P，新名）：纯文本项目 cmp；列出项目元数据与 World；进入 World。
- `WorldConsole`：现有 `WorldFolderConsole` 可作为 World 内 console，但新需求只描述了项目 cmp；是否保留需裁定。
- 状态与时间回溯逻辑放在 P/编辑器共享的 history 模块；不写账本。

### 3.3 存储草案

```text
<workspace>/
  workspace.json
  <project-folder-id>/
    folder.json
    <project-id>/
      project.json          # schemaVersion 2; 8-digit ID; author/times/theme/prologue/worldIds
      event-tree.json       # 项目内世界图（复用 EventTreeDAG）
      worlds/
      media/
      drafts/
```

- `project-folder-id` / `project-id` 的实际文件夹名建议用稳定的 8 位编号，显示时加空格。
- 现有单项目 `<Project>/project.json` 需要迁移策略（自动识别旧布局，或新建 workspace 包裹）。
- 用户可外部编辑：读取时校验 schema/ID；不静默覆盖；冲突诊断。

## 4. 分阶段建议（不直接排进 R3.4/R3.5）

这些需求体量超过 R3.4 视差或 R3.5 编辑器单阶段，建议新开 **R3.6 或 R4.0**，先数据后视觉：

| 阶段 | 内容 | 出口 |
|---|---|---|
| A. 数据/存储 | Workspace / ProjectFolder / Project 元数据、schema v2、目录布局、迁移、项目编号 | 自动测试 + 旧项目兼容 |
| B. 项目树视觉 | 方框、RGB→XYZ、近大远小、游走、主题图、鱼眼/暗角、缩放/鼠标视差 | 人工视觉验收 |
| C. 项目 cmp | 纯文本、项目元数据、World 列表、命令、进入世界加载 | AC 新条目 |
| D. 交互/时间 | WASD 正交选择、右键/ESC 撤回、左右时间倒放/加速、音量拖拽/亮度反馈 | 交互测试 |
| E. 素材 | 主题图、CRT/雨/旧电脑素材、授权清单、统一调色 | 资产清单 |

## 5. 必须先裁定的问题（P-PT）

### P-PT-01 项目树与事件树的关系
- 方案 A（建议）：ProjectTree 是新主界面；EventTreeDAG 降为 Project 内部世界图。
- 方案 B：ProjectTree 完全取代 EventTreeDAG；R3.2 的 G/P 语义重写。
- 方案 C：项目树只是 EventTreeView 的换皮，节点仍是 World；不满足“项目含多个世界”的描述。

### P-PT-02 A 类名
当前 NAMEBOOK 没有 ProjectFolder / ProjectTree / ProjectTreeView / ProjectConsole 等名字。必须二选一：
- 发 NAMEBOOK v4.1，新增项目层级名字（推荐，语义清晰）；
- 复用现有 A 名（如 MainScreenView / WorldFolderConsole），但语义会漂移，测试/审计困难。

### P-PT-03 存储与迁移
- Workspace 根如何选择？
- 旧单项目布局是否自动包一层 ProjectFolder？
- ProjectFolder 是否允许递归嵌套？
- Project ID 如何生成（随机 8 位/递增/用户输入）？冲突如何处理？

### P-PT-04 Project schema v2
需要新增字段：author、createdAt、completedAt、worldCount（派生或存储）、theme、prologue、projectId（8 位显示格式）。
- 是扩展 `StudioProject` 还是新建独立 metadata 文件？
- “项目完成时间”未完成时是 null 还是空字符串？
- R2 AC4-02 的 schemaVersion 1 测试如何处理（迁移/双版本/更新测试）？

### P-PT-05 项目 cmp 与 world console
- 项目 cmp 是否完全取代 R3.3b-2 的 WorldFolderConsole？
- 现有 `WorldFolderConsole` 左目录/右输出/设置面板与新“纯文本、无栏目”冲突；R3.3b-2 是否冻结为“世界 console 原型”？
- AC4-29/42/43/44 是否改挂到项目 cmp，还是保留 world console 另立 AC？

### P-PT-06 项目树图语义
- ProjectFolder/Project 之间是否也是有向图？是否允许环？
- ProjectFolder 展开后的项目散开位置如何计算？
- 项目树的“单根/多根/Primary”是否还存在？
- 项目间“链接”是编辑操作还是仅视觉连线？

### P-PT-07 时间回溯/撤销
- “左方向键倒放所有动效”是否包含**真实鼠标轨迹**？真实 OS 光标不能被应用回放；建议只回放方框/相机/背景/音量等应用内动画。
- 撤销栈是否持久化？重启后是否保留？
- “3 秒内再次右键撤回撤回”是 redo 还是 undo of undo？需要明确历史模型。
- 右方向键“加速”是否改变历史推进速度，还是只加速动画？
- 撤回/倒放期间是否禁止编辑命令？

### P-PT-08 输入手势优先级
以下手势可能冲突，需要优先级表：
- 左键双击空白：新建项目文件夹；右键/ESC：撤回；右键 3 秒内：redo。
- 左键单击项目：选中/放大；再次点击：全屏；双击项目：进入。
- 滚动：视距；按住鼠标上下拖：音量；WASD：移动选中；方向键：选择/时间回溯。
- 输入框聚焦时：上下键/回车归输入；全局键不得抢占。
- 右键项目：删除/链接；右键项目文件夹：删除/链接/新建项目。
- 需要明确“单击 vs 双击 vs 再次点击”的时序阈值。

### P-PT-09 音量/亮度
- R3 尚无 AudioOutputClock/音频引擎；音量是否只做 UI 状态 + 亮度反馈，真实音量接 R4/R5？
- 音量范围/默认值/是否持久化？

### P-PT-10 主题图与资产
- 动态主题图是图片序列/视频/程序化着色器/CSS 动效？
- 每个项目一张还是每个世界一张？
- 资产存储路径、分辨率、格式（WebP/AVIF/MP4）、性能预算？
- 免费图库素材的授权/署名/二次修改要求。

### P-PT-11 首次游玩 fixture
- 初始 ProjectFolder 与两个 Project 的名字、编号、主题色、序言、世界数？
- 是否作为内置示例项目，还是用户首次启动时生成？

### P-PT-12 真实文件系统
- 项目文件夹/项目在资源管理器可见；删除是移入回收站/重命名/永久删除？
- 外部编辑后如何检测冲突（mtime/hash）？
- “链接（输入项目文件夹编号）”是建快捷方式/软链/仅应用内引用？
- 无权限访问上级目录：Project cmp 的 cwd 根如何定义？

### P-PT-13 R3.3b-2 处置
- 当前 console 的左目录/右输出/设置面板与新项目 cmp 的“纯文本无栏目”直接冲突。
- 需要裁定：R3.3b-2 冻结为“世界 console 原型”，项目 cmp 新建；或将 R3.3b-2 标记为被新方向取代。

## 6. 需要用户确认的产品细节（U-PT）

1. “项目”方框里的“每个地图的序言字幕”具体是**项目序言**还是**项目内每个世界的序言**？
2. 方框主题色取 **项目主题色**，还是取项目内某个世界/地图的主题色？
3. ProjectFolder 是否允许嵌套项目文件夹，还是只有一层“文件夹 → 项目”？
4. 项目编号 8 位：随机生成、递增、用户输入？显示 `1234 5678`，内部是否存 `12345678`？
5. “项目完成时间”未完成时显示什么？
6. “cmp”是项目命令行界面的正式名称，还是 `cmd` 的笔误？
7. 项目 cmp 里 World 是作为子目录/条目列出，还是只显示编号与序言？
8. 左方向键倒放是否只回放应用内动画与操作，不回放真实鼠标光标？
9. 音量控制在 R3 只做 UI 状态 + 亮度反馈，还是必须真实控制音频？
10. 项目树首次进入的示例文件夹与两个项目，是否用固定名称/编号？

## 7. 素材来源建议

可用的知名免费图库/素材站（需逐一记录具体素材的授权）：

| 来源 | 适合 | 授权注意 |
|---|---|---|
| Unsplash | CRT/旧电脑/雨夜/城市/抽象纹理 | Unsplash License；可商用，建议署名 |
| Pexels | 同上，照片/短视频 | Pexels License；避免可识别品牌/人物不当使用 |
| Pixabay | 照片/插画/纹理/音效 | Pixabay Content License；检查单条素材 |
| OpenGameArt | 游戏 UI、CRT、像素、音效 | 混合 CC0/CC-BY；逐条记录 |
| Kenney | UI/输入/音效/原型素材 | CC0，适合占位 |
| Freesound | CRT 电流、雨声、故障、环境 | CC0/CC-BY；逐条署名 |
| Wikimedia Commons | 历史计算机/显示器照片 | 逐条 CC 授权；避免商标特写 |

建议：

- 先建立 `assets/theme/` 与 `ASSET-LICENSES.md`，每条记录 source URL、作者、license、修改、用途。
- 动态主题图优先用 **静帧 + 缓慢 Ken Burns/视差/噪点/RGB 偏移**，不要直接依赖随机图库视频。
- 风格统一：黑白/低饱和底图 + 每个项目一个主题色；CRT 扫描线、暗角、轻微色差；避免图库“通用商务感”。
- 我可按确认后的风格关键词（CRT、旧电脑、雨夜、液晶、模拟恐怖、极简）去搜具体候选，但在授权确认前不直接写入项目。

## 8. 建议下一步

1. PROTOCOL 先裁定 **P-PT-01 / 02 / 05 / 07 / 13**（项目树关系、A 名、console 归属、时间回溯、R3.3b-2 处置）。
2. 再裁定存储/schema/输入手势。
3. DSH 出 **R3.6 或 R4.0 实施计划**，先做 A（数据/存储），不先做 3D 视觉。
4. 在数据模型冻结前，不修改 R3.2/R3.3b-2 的 UI 代码；避免返工。
