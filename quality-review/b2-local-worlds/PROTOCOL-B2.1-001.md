# PROTOCOL-B2.1-001 · 本地多世界与冻结分叉契约的范围冲突

日期：2026-10-10。状态：等待范围裁定。依据本轮用户约束“若发现架构冲突，先停止，提交 PROTOCOL”，已停止生产实施。此文件只记录冲突、证据及可审阅的解决方案；不修改 docs、名库或参照，不重新裁定 VERDICT-013/014/030/159/160/165/166。

## 需要解决的问题

本轮要求“点击分叉 → 复制 InitialWorld 为新世界”，同时要求遵守冻结 CopyPermission / WorldFork、不修改 A/B/C/T6/T7 冻结逻辑，且不做真实世界状态持久化。当前工程没有产生 FirstWorldCleared 的真实世界通关链路，也没有完整世界状态复制与恢复接口。

这不是动态列表本身的冲突，也不是说内存复制必然要求磁盘持久化。问题是：目前无法在现有冻结边界内，提供可自然取得权限、实际继承完整状态、可通过本轮端到端验收的 WorldFork。仅复制标题、创建时间与模板后创建 fresh gameplay 不能替代 WorldFork；为验收注入权限也不能证明用户流程可用。

## 已核实的冻结证据

| 契约 | 精确来源 | 原文 / 含义 |
| --- | --- | --- |
| CopyPermission 来源 | [历史裁定记录第 62 行](D:/Project/A_New_Begin/Neurou_official/641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl:62)，VERDICT-014 第 1 条 | “账号拥有 FirstWorldCleared 里程碑……这项权限就成立，不单独保存。” |
| 复制世界的开放 | 同上，VERDICT-014 第 4 条 | “拥有复制权限时……同时开放游戏内的‘复制世界’功能。” |
| 分叉继承 | 同上，VERDICT-014 第 5 条 | 继承账本、PuzzleProgress、RecallCount、FormatTime、彼岸 WorldLink；不继承 WorldClearRecord。 |
| 后续继承补充 | [历史裁定记录第 97 行](D:/Project/A_New_Begin/Neurou_official/641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl:97)，VERDICT-030 第 7 条 | 分叉还继承谱面快照和得分；通关记录不继承保持不变。 |
| 删除不收回通关记录 | 历史第 62 行，VERDICT-013 第 3 条 | WorldClearRecord 归账号所有，和世界文件是否存在无关。 |
| Registry 语义 | [世界文件夹裁定第 31 行](D:/Project/A_New_Begin/Neurou_official/quality-review/world-folder/VERDICT-158-168.md:31) | “也不把 WorldRegistry 改为纯 UI 列表。” |
| 动态入口扩展可行 | [同文件第 59 行](D:/Project/A_New_Begin/Neurou_official/quality-review/world-folder/VERDICT-158-168.md:59) | “可通过扩展只读入口列表增加世界”；当前条目不是公开玩法存档格式。 |
| 无权限锁的范围 | [同文件第 155 行](D:/Project/A_New_Begin/Neurou_official/quality-review/world-folder/VERDICT-158-168.md:155)，VERDICT-165 | 无锁针对开发阶段编辑器目录与已实现编辑器，不构成取消 CopyPermission 的依据。 |
| 现有重新进入语义 | [同文件第 193 行](D:/Project/A_New_Begin/Neurou_official/quality-review/world-folder/VERDICT-158-168.md:193) | 重新进入创建 fresh gameplay，会话保存和世界进度持久化尚未承诺。 |

## 当前实现证据

- [AccountStartupSession.ts](D:/Project/A_New_Begin/Neurou_official/src/director/AccountStartupSession.ts:2) 仅承载 PrologueCompleted 的开发投影，没有 FirstWorldCleared。
- [IntentPort.ts](D:/Project/A_New_Begin/Neurou_official/src/director/IntentPort.ts:261) 的 ledgerEvents 属于 DirectorSession 内存；[谱面完成实现](D:/Project/A_New_Begin/Neurou_official/src/director/IntentPort.ts:653) 追加普通谱面完成事件。占位事件 T7_COMPLETION_PLACEHOLDER 不是世界魔王曲通关事实。
- [WorldInstance.ts](D:/Project/A_New_Begin/Neurou_official/src/world/WorldInstance.ts:74) 现有 id/kind/formatTime/themeColor 是世界接口骨架；FormatTime、WorldThemeColor 仍为占位结构。不能把目录元数据冒充完整 WorldInstance 状态。
- [WorldFolderBuilder.ts](D:/Project/A_New_Begin/Neurou_official/assets/scripts/WorldFolderBuilder.ts:75) 只路由 InitialWorld，退出销毁运行节点；没有世界快照交接或恢复。
- 对 src/director、src/world 及相关实现的只读检索没有找到 FirstWorldCleared、CopyPermission、WorldClearRecord、WorldFork 的实现。名库中的冻结词条不能视为已经可调用的业务能力。

## 可供批准的方案

### A · 本轮收敛为多世界目录基础（建议）

交付动态只读列表、本地按账号持久化元数据、新建独立最小箱庭、墓碑删除、进入与返回刷新、双分辨率和三门禁。InitialWorld 原 gameplay 及 B1 入口继续保留。

完整 WorldFork 后移至真实通关事实与完整状态交接具备的阶段。本轮可以显示“分叉尚未开放”的准确反馈，但不得把它算作成功分叉验收，也不以开发按钮或元数据模板复制替代。

此方案改变本轮验收范围中的“成功分叉”一项，不改变 VERDICT-014 的权限或继承规则。

### B · 保留成功分叉验收，扩展本轮前置范围

先明确并实现真实 World 级通关事实、FirstWorldCleared 及 CopyPermission 派生；再补齐完整状态捕获/复制/恢复与生命周期契约，含账本、解谜、回忆、FormatTime、WorldLink、谱面快照和得分，排除 WorldClearRecord 继承。

至少需要允许新增相关账号与运行时状态交接接口，逐项确定和现有冻结 gameplay 的兼容边界。状态复制是否只在会话内还是需要跨重启，另须明确；不预设解除“不做真实世界状态持久化”的限制。真实通关玩法与完整快照并非当前 B2.1 最小目录实现所已有的能力，必须作为显式扩展验收，不能由实施端伪造。

## 方案 A 的具体实现提案（尚未冻结）

以下可直接作为恢复实施后的 VERDICT-201～210 输入；当前没有把这些建议当作正式裁定或落盘名库。

| 拟编号 | 提案 |
| --- | --- |
| 201 | WorldFolderReader 继续只读，getWorlds 返回冻结的动态列表；WorldFolderEntry 仍只有 readonly worldId/title/description，worldId 扩展为 string。View 只发意图，director 内 WorldFolderSession 决定创建与删除；不让 presentation 修改业务记录。 |
| 202 | B2.1 用按账号隔离的浏览器本地 JSON 元数据集合，独立于序章里程碑和编辑器草稿。不是 OS 中的 .world.json 文件，也不是 B2.2 可携带世界格式。候选 WorldFolderRecord 包括 worldId/title/description/createdAt/deletedAt 与最小模板标识；不存世界完整状态。 |
| 203 | InitialWorld 首次初始化时成为动态列表中的默认一项，默认展示在前。墓碑删除后不因刷新重新生成；已初始化的空列表保持为空。InitialWorld 的现有 gameplay factory 保留。 |
| 204 | CreateWorld 产生新 ID 和最小箱庭模板；ID 不复用墓碑。DeleteWorld 仅写 deletedAt、从活动列表过滤；不删除账户事实、通关记录或账本。存储先成功再提交快照，失败可重试。 |
| 205 | WorldFork 依冻结契约保留为后续能力，不实现“复制标题后 fresh runtime”的替代。没有 CopyPermission 时不执行分叉；编辑器无锁不影响此约束。 |
| 206 | 列表显示多项 title/description，新建表单、删除确认及可见反馈；保留 InitialWorld 旧导航标识，其他项使用唯一 ID/data-world-id。打开前重新核对账号、存在性和未删除，拒绝旧卡片。 |
| 207 | 编辑器目录维持全局顶层入口，不绑定选中世界；既有引导线、音乐编辑器核心与草稿边界保留。 |
| 208 | 复用 director/world/presentation 与组合根，不新增模块。presentation 只通过既有 IntentPort 类型窄口读取/发送目录意图；平台存储为注入适配。WorldRegistry 保留其原件/复制品及位置登记语义，B2.2 再实现，不挪用于纯目录。 |
| 209 | B1 ChartResourcePath 暂继续由入口 SceneBuilder 全局配置；实际 gameplay 世界共享配置。最小空世界不制造深痕或谱面入口；每世界独立谱面配置后续裁定。 |
| 210 | 验收默认项、创建唯一 ID、动态多项、空箱庭、墓碑删除、返回/重启刷新、账号隔离、存储失败、双分辨率及三门禁；成功完整分叉明确移出本轮，不声称交付。 |

## 当前交付状态

本次只有只读审计和证据目录新增：验收规划、环境 GET 探针、禁用 mutation workflow 的预览 harness 草案、本 PROTOCOL。没有修改生产代码、docs、名库、参照文件或编辑器核心；没有登录预览账号、写 localStorage、创建/删除/分叉世界。

三条门禁和 B2.1 端到端验收尚未执行；没有本轮成功实现截图。B1 的通过记录不计作 B2.1 验收。VERDICT-201～210、名库 v3.6 与代码 diff 待范围裁定后按实际实现交付。

请裁定采用 A，或采用 B 并明确扩展前置接口与验收范围。暂停来源是本轮用户的架构冲突停工约束与冻结 VERDICT-014/030；没有自动审批拒绝，也不是 computer-use 技能导致停工。
