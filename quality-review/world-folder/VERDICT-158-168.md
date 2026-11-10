# 第 30 批正式裁定：世界文件夹界面与编辑器框架目录

依据：用户已确认入口 A、初始世界 B、开发阶段编辑器权限 A，并授权 ARCHITECT + IMPLEMENTER 直接实现。本文件属于独立交付证据；不修改 docs、名库或参照文件。本批命名和规则在本次实现范围内正式冻结；共享名库与规格真源的追认、落盘交 PROTOCOL → Trae，不宣称已经完成。

## VERDICT-158　正式修订 VERDICT-062 的启动流程

**裁定结论**

VERDICT-062 第 3 条的启动时机及启动流程修订为：**登录 → ShorePrologue（账号首次，仅一次）→ WorldFolderView**。已完成序章的账号登录后直接进入世界文件夹。VERDICT-068 第 2 条所增加的“ShoreHub 已启用则自动进入 ShoreHub”默认路由由本条取代；ShoreHub、ShoreHubState、终末彼岸及其恢复规则继续保留，后续功能入口另行裁定。

保留 VERDICT-062 的叙事边界：序章不创建 WorldInstance，不写世界账本，不生成开场录像或截图；完成事实对应既有 AccountMilestone.PrologueCompleted；EditorTutorial 仍与序章共用完成事实。账号级叙事编排属于 director，只能产生账号完成事实，不能追加世界账本。

本轮没有已存在的远程登录服务可接入，交付开发阶段**本地账号登录及简短序章灰盒文本**。用户输入本地账号标识，浏览器按账号保存完成状态。这不是远程身份验证、完整 ShoreSetting 场景或完整 EditorTutorial 内容的交付。本轮不定义、不扩展 AccountMilestone 的全量枚举或存储结构，仅提供 PrologueCompleted 的本地投影。

**理由**

1. 用户明确选择世界文件夹作为登录后的统一入口。
2. 账号级序章发生在所有世界之外，必须保留与世界账本隔离的边界。
3. 本地灰盒足以验证入口闭环，避免把尚未接入的账号服务作为已实现功能。

**影响范围**：修订 VERDICT-062 第 3 条及 VERDICT-068 默认启动路由；涉及 AccountStartupSession、FolderStartupView、AccountStartupStorage、WorldFolderBuilder。AccountMilestone、ShorePrologue、ShoreHub 等既有命名不改。

**是否可逆**：入口呈现与本地适配可逆；已经完成的序章事实不得因普通界面导航撤销。真实服务迁移须显式裁定。

## VERDICT-159　世界文件夹与初始世界命名

**裁定结论**

统一采用 WorldFolderView、WorldFolderEntry、WorldFolderReader；唯一入口常量及 worldId 均为 InitialWorld，显示名“初始世界”。不另立 NeurouFolderView，不把本界面称为 ShoreHub。

InitialWorld 表示现有 Neurou_official 可玩运行链路的入口描述；不新增 WorldInstance 类型、WorldKind 值或新的世界数据格式，也不把 WorldRegistry 改为纯 UI 列表。

**理由**

1. WorldFolderView 直接表达用户面对的功能。
2. InitialWorld 区分唯一初始入口与未来其他世界，避免裸 World 命名。
3. 入口描述与世界玩法实例分别承担展示和运行职责。

**影响范围**：presentation/FolderCatalog、WorldFolderView；组合根按 worldId 选择现有运行链路。

**是否可逆**：显示文案可逆；公开入口 ID 变更须维护兼容映射。

## VERDICT-160　世界文件夹数据结构

**裁定结论**

WorldFolderEntry 固定为只读 worldId、title、description；WorldFolderReader 提供 getAccountId 与 getWorlds。阶段 1 的每个已登录本地账号读取恰好一项 InitialWorld，数组与条目冻结。

本轮列表表示该账号可进入的已交付世界，不提供新增、删除、复制、分叉、迁移或世界进度存档。账号标识只决定启动完成事实的本地隔离，不重新解释既有 WorldInstance 归属规则。

**理由**

1. 阶段 1 只有一个世界入口，不需要提前制造多世界管理业务。
2. 只读数据让表现层仅绘制和发送导航请求。
3. 把入口目录与未来存档注册区分，防止展示字段进入冻结玩法数据。

**影响范围**：presentation/FolderCatalog、WorldFolderView；不修改 world、chart、ledger 数据结构。

**是否可逆**：可通过扩展只读入口列表增加世界；当前条目不构成公开玩法存档格式。

## VERDICT-161　编辑器文件夹命名

**裁定结论**

统一采用 EditorFolderView、EditorFolderEntry、EditorCatalog。EditorFolderEntry 字段为 entryId、title、availability、children；availability 取 Folder / Implemented / Placeholder。EditorCatalog 提供 getRoot，根为 EditorRoot，显示“编辑器”。

availability 与 children 独立：拥有子目录不表示已经实现编辑功能；已实现编辑器也可以拥有占位子目录。所有节点和 children 均冻结。

**理由**

1. 可用性决定点击执行，子目录决定展开结构，二者不能混用。
2. 只读目录允许完整呈现未来编辑器框架。
3. 使用 Entry 与 View 避免把 UI 目录当成运行中的编辑器 Session。

**影响范围**：presentation/FolderCatalog、EditorFolderView。

**是否可逆**：后续可将 Placeholder 显式升级为 Implemented；entryId 更名需追认兼容。

## VERDICT-162　VERDICT-151 目录树的游戏内投影

**裁定结论**

游戏内目录精确呈现下列 15 项，包含根节点。实体磁盘目录保留；游戏内读取 EditorCatalog，不扫描操作系统文件夹，不把真实目录权限作为可用性判断。

| entryId | 显示名 | 父节点 | availability |
| --- | --- | --- | --- |
| EditorRoot | 编辑器 | — | Folder |
| MusicEditor | 音乐编辑器 | EditorRoot | Placeholder |
| RgbWavetableEditor | RGB波表编辑器 | MusicEditor | Placeholder |
| GridEditor | 网格编辑器 | MusicEditor | Placeholder |
| MidiTrackEditor | MIDI以及音轨编辑器 | MusicEditor | Placeholder |
| MapEditor | 地图编辑器 | EditorRoot | Placeholder |
| NarrativeEventEditor | 事件编辑器 | MapEditor | Placeholder |
| StoryEditor | 剧情编辑器 | MapEditor | Placeholder |
| PasserbyEditor | 路人编辑器 | StoryEditor | Placeholder |
| SubtitleEditor | 字幕编辑器 | StoryEditor | Placeholder |
| ChartEditor | 谱面编辑器 | EditorRoot | Folder |
| GuidanceEditor | 引导线编辑器 | ChartEditor | Implemented |
| VideoTimingEditor | 视频卡点器 | GuidanceEditor | Placeholder |
| PositionEditor | 位置编辑器 | GuidanceEditor | Placeholder |
| SpecialNarrativeEventEditor | 特殊事件编辑器 | ChartEditor | Placeholder |

剧情编辑器保留可展开子目录，但本轮没有实现剧情编辑功能，故明确标记 Placeholder。音乐/地图/剧情等父项点击执行时同样提示“暂未实现”；其目录仍可展开或收起。谱面编辑器是分组目录，不伪装成新编辑器。

**理由**

1. 保持 VERDICT-151 已冻结的可见层次和名称。
2. 完整目录是产品框架；占位状态须准确反映实现范围。
3. 纯目录投影无需新增磁盘扫描或权限业务。

**影响范围**：EditorCatalog、EditorFolderView；音乐、地图、剧情等 editor 业务模块均不新增。

**是否可逆**：占位可逐步实现；目录身份与层次变更须另行裁定。

## VERDICT-163　已实现编辑器与占位执行规则

**裁定结论**

GuidanceEditor 项打开现有 GuidanceEditorBuilder / GuidanceEditorView，复用既有 GuidanceEditorSession、导入、草稿、导出和独立演奏预览。其 VideoTimingEditor、PositionEditor 子项只提示“暂未实现”。其他 Placeholder 点击后在目录内可见状态区域显示“名称：暂未实现”，不创建假编辑器或调用玩法逻辑。

编辑器与 gameplay 使用独立运行节点和实例；不创建或连接世界 DirectorSession / ledger。目录可打开编辑器不意味着取得直接改 chart、草稿、判定或得分的能力。

**理由**

1. 用户只授权接通已交付的引导线编辑器。
2. 占位反馈让目录可浏览且不会承诺未实现能力。
3. 复用第 29 批独立编辑器保留零世界账本边界。

**影响范围**：WorldFolderBuilder、EditorFolderView、GuidanceEditorBuilder；既有编辑器公开业务契约不变。

**是否可逆**：导航与反馈可逆；编辑器隔离边界持续保留。

## VERDICT-164　模块归属与依赖矩阵

**裁定结论**

WorldFolderView、EditorFolderView、FolderCatalog、FolderStartupView、FolderTheme 配置文件和浏览器存储适配属于 presentation；新增 AccountStartupSession 属于 director，零 cc、零世界账本依赖。WorldFolderBuilder 属于 assets/scripts 组合根，负责创建、注入和销毁运行实例。

不新增 worldFolder 模块，不改变现有九模块依赖矩阵。AccountStartupReader / AccountStartupPort / AccountStartupIntent / AccountStartupSnapshot 从现有 director/IntentPort 进行 export type 转发，presentation 只通过既有窄路 import type。没有新增 chart / editor 业务接口；目录导航和组合根生命周期回调属于表现与装配边界。

**理由**

1. 文件夹需求是展示与导航，不是新的玩法规则域。
2. 账号序章由 director 决定，平台存储适配由 presentation 完成。
3. 现有类型读取、意图和组合根机制已足够表达所需关系。

**影响范围**：director/AccountStartupSession、director/IntentPort 的类型转发、presentation 和组合根。E1～E9 不放宽、不排除新增源码。

**是否可逆**：文件拆分可逆；逻辑零 cc、presentation 不取得逻辑写权限的边界保留。

## VERDICT-165　编辑器开发阶段权限

**裁定结论**

已登录账号可直接进入世界编辑器文件夹并打开已实现的引导线编辑器，无 AccessCode 输入、权限锁或隐藏门禁。本轮不删除、不实现或重新定义 VERDICT-023 的 AccessCode。

原 VERDICT-023 的 AccessCode 用于首次加入他人世界，是世界访问机制；本轮开发阶段的目录开放不把它改成编辑器密码。后续编辑权限或发布权限独立提请。

**理由**

1. 用户明确选择开发阶段无权限锁。
2. 原 AccessCode 语义与当前目录入口并不冲突。
3. 本轮无需权限业务即可完成统一入口。

**影响范围**：世界文件夹和编辑器目录导航；AccessCode 既有名库项保留。

**是否可逆**：未来可按正式裁定增加权限机制，但不得把本轮无锁状态描述成已实现安全认证。

## VERDICT-166　初始世界与 A/B/C、T6/T7 的关系

**裁定结论**

InitialWorld 选择后由原 SceneBuilder / Bootstrap 创建现有 gameplay：保留箱庭、主角移动/跳跃/感知、痕与深痕、T6 解谜链和转场、T7 谱面及暂停退出、引导线 A/B/C 已冻结实现。世界入口复制既有 Inspector 的 UseGuidanceChart 与 GuideTransparency 配置，不另改默认谱面或透明度语义。

本轮不修改 A/B/C 命名、schema、判定、计分、时间语义、解谜进度或 director 写账本规则。T7 内“退出谱面 → 世界”仍为已有玩法行为；新“退出整个世界 → 世界文件夹”是外层运行会话退出，二者独立。

**理由**

1. 用户确认现有工程整体就是初始世界。
2. 外层入口应接通原可玩闭环，而不重新实现或简化它。
3. 谱面退出与世界退出是不同层级的导航行为。

**影响范围**：SceneBuilder 启动装配与 WorldFolderBuilder；允许生命周期防护，不改 gameplay 核心。

**是否可逆**：入口接线可逆；既有 A/B/C 数据与核心语义不因本轮改变。

## VERDICT-167　退出返回与兼容入口

**裁定结论**

世界或编辑器运行时提供“退出…返回世界文件夹”外层控件。运行节点建立在 Canvas 下；现有 3D 世界根保持在 Scene 下、与 Canvas 为兄弟节点，并由该 gameplay 会话显式拥有。退出同步停用运行节点，通过 onDisable 停止 FrameDriver/输入、暂停视频并隐藏该独立世界根；onDestroy 销毁拥有的世界根，清理时钟、资源、媒体、DOM、输入监听、转场和资源异步回调。在 Cocos 延迟销毁完成后的 EVENT_AFTER_DRAW 显示 WorldFolderView。重复点击不创建重叠实例。

重新进入世界创建 fresh gameplay 会话；入口框架无需新增世界存档接口，本轮未增加世界进度持久化或继续上次世界会话的承诺。编辑器草稿仍使用原编辑器存储机制，目录退出不擅自改草稿格式。序章完成状态独立于世界和编辑器运行节点，退出不清除。

全部普通启动入口包括旧 `?guidanceEditor=1` 都进入新登录、序章判定与目录流程；旧外部快捷链接继续可启动预览服务，但不再绕过账号与目录直达编辑器。这是显式兼容行为变化，不宣称旧直达 URL 语义保持。

**理由**

1. 统一返回路径使世界与创作成为同一游戏入口下的完整产品。
2. 销毁和异步失效防护避免退出后重建已关闭的玩法或编辑器。
3. 统一启动入口避免快捷链接绕过首次序章。

**影响范围**：WorldFolderBuilder、SceneBuilder、GuidanceEditorBuilder 和必要表现生命周期清理；不改变谱面中途退出不写账本规则。

**是否可逆**：控件与导航可逆；未来需要保留世界会话或存档时须显式实现并补验。

## VERDICT-168　灰盒配置、范围与证据要求

**裁定结论**

文件夹、启动及外层退出 UI 为可替换灰盒，通过 presentation/FolderTheme 的 FolderPresentationTheme / CSS 变量配置字体、颜色、面板和边框等美术参数，遵守 AC-29。目录与账号叙事逻辑不读 CSS、节点位置或渲染状态。验证 1920×1080 和 2560×1440 的同一 UI 结构、可点击性、目录展开和返回流程。

交付应附三条实际门禁日志、真实 Cocos 编译预览截图及启动/世界/T6/T7/编辑器/退出逐条证据；本裁定书不预先宣布验收结果。受保护 docs、名库与参照须以起始哈希复核未改写。

本轮用户直接授权覆盖 stage-1 §4 中“登录”“Neurou 文件夹”的旧阶段排除，仅扩展为本地登录、一次序章和单世界入口框架。服务器、多世界管理、世界存档迁移、未实现编辑器继续留待后续。规格同步作为提案交 Trae，不由实施者写 docs。

**理由**

1. 灰盒参数独立于规则，后续美术替换无需改逻辑。
2. 实际预览和门禁证据才能证明统一入口未截断原完整链路。
3. 明确授权范围扩展，既尊重本轮决策，也保留未授权功能边界。

**影响范围**：presentation 配置、交付证据和阶段范围同步提案；不新增门禁例外。

**是否可逆**：美术配置可逆；证据需随行为变更重测；真实账号服务与存档迁移另行裁定。

## 世界文件夹与编辑器目录契约

以下形状对应本轮源码，不替换任何 A/B/C 类型：

```ts
type WorldFolderEntry = {
  readonly worldId: 'InitialWorld';
  readonly title: string;
  readonly description: string;
};
interface WorldFolderReader {
  getAccountId(): string;
  getWorlds(): readonly WorldFolderEntry[];
}
interface EditorFolderEntry {
  readonly entryId: string;
  readonly title: string;
  readonly availability: 'Folder' | 'Implemented' | 'Placeholder';
  readonly children: readonly EditorFolderEntry[];
}
interface EditorCatalog { getRoot(): EditorFolderEntry }
interface AccountStartupSnapshot {
  readonly accountId: string | null;
  readonly phase: 'Login' | 'Prologue' | 'WorldFolder';
  readonly PrologueCompleted: boolean;
}
```

AccountStartupSession 接收 Login / CompletePrologue 意图。完成序章时先产生候选只读快照，调用组合根注入的持久化适配；保存成功后才提交完成快照并进入 WorldFolder。保存异常时保留 Prologue 状态，允许重试。浏览器以 `neurou-account-milestone-v1:` 加编码后的 accountId 保存 `{ PrologueCompleted: true }`；这个开发投影不是 AccountProfile 或 AccountMilestone 的全量正式 schema。

## 本批命名冻结表

| 名称 | 归属 | 职责 |
| --- | --- | --- |
| WorldFolderView | presentation | 世界列表及编辑器目录入口 |
| WorldFolderEntry / WorldFolderReader | presentation | 只读世界入口描述与账号列表读取 |
| InitialWorld | presentation | 唯一现有工程世界入口 |
| EditorFolderView | presentation | 递归目录、占位反馈和打开请求 |
| EditorFolderEntry / EditorCatalog | presentation | 只读目录项及目录读取 |
| FolderStartupView | presentation | 本地登录与简短序章灰盒 |
| AccountStartupStorage | presentation | 账号隔离的浏览器完成事实适配 |
| FolderPresentationTheme | presentation | 可替换 UI 美术配置；位于 FolderTheme.ts |
| AccountStartupSession | director | 账号启动编排与序章完成提交 |
| AccountStartupSnapshot / AccountStartupIntent | director | 冻结启动快照与玩家意图 |
| AccountStartupReader / AccountStartupPort | director | 读取面与意图发送端 |
| WorldFolderBuilder | assets/scripts | 外层组合根及运行节点生命周期 |

上述名称、本表目录 ID 和字段待 PROTOCOL 追认、Trae 落盘。新增私有成员、局部变量及平台 DOM 标识随交付机器清单一并说明，不将其扩大为世界观领域实体。

## 裁定来源与未变更边界

原 VERDICT-023 / 062 / 068 / 071 / 076 位于仓库历史参照 `641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl` 的第 85 / 179 / 191 / 202 / 214 行。VERDICT-151 位于 `quality-review/guidance-editor/VERDICT-147-157.md:11`。现有 editor 模块已由 `docs/spec/stage-1.md:65` 与第 6 节矩阵正式登记，不能沿用历史交付报告的“editor 未登记”结论。AC-29 正文位于同规格第 382 行。

本轮没有未授权架构冲突需要停工。仍待后续裁定：真实登录服务及账号完成事实迁移、完整序章/教程内容、其他世界与世界存档、ShoreHub 未来入口、原生打包平台的目录 UI 适配。浏览器本地状态只覆盖相同浏览器存储、相同本地账号；清空存储或换浏览器不构成已完成云端迁移。
