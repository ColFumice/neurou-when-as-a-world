# 第 30 批 PROTOCOL 追认与落盘请求

本轮用户已确认三项决策并授权 ARCHITECT + IMPLEMENTER 直接实现：登录/首次序章后进入世界文件夹；初始世界包含现有 A/B/C 完整成果；开发阶段世界编辑器目录无 AccessCode 锁。VERDICT-158～168 已在本批实现范围内正式裁定。本请求用于共享真源追认与后续事项登记，不是要求用户重复批准已授权的实现。

## 请求追认并交 Trae 落盘

| 项目 | 本批裁定与建议落点 |
| --- | --- |
| VERDICT-062 正式修订 | 登录 → ShorePrologue（首次一次）→ WorldFolderView；保留 director 账号编排、不创建世界、不写账本/录像/截图 |
| VERDICT-068 默认入口修订 | 默认启动不再自动进入 ShoreHub；ShoreHub/终末彼岸机制及既有命名保留，未来功能入口另议 |
| 名库 v3.1 附录 | WorldFolderView / InitialWorld / EditorFolderView / EditorFolderEntry / EditorCatalog 等公开名称，以及 15 项目录 ID、字段与公开成员 |
| 账号本地投影 | AccountStartupSession 只处理启动；PrologueCompleted 是既有完成事实的本地投影，不定义全量 AccountMilestone/AccountProfile schema |
| editor 目录可用性 | Folder / Implemented / Placeholder；有子项不表示已实现，StoryEditor 仍 Placeholder |
| 模块与矩阵 | 不新增 worldFolder；目录与样式 presentation，账号叙事 director；仅既有类型窄路，无新 chart/editor 业务接口；矩阵不变 |
| 阶段范围 | 用户直接授权有限扩展本地登录/序章、单世界入口和编辑器目录；旧服务/多世界/新编辑器排除继续保留 |
| AC-29 与本批验收 | FolderPresentationTheme/CSS 变量配置、两档分辨率、三条门禁与真实 Cocos 链路证据；验收结果见最终报告 |
| 兼容行为变化 | 旧 `?guidanceEditor=1` 及快捷启动链接经过登录/序章/目录，不再直接绕过统一入口 |

独立附件：`VERDICT-158-168.md`、`名库v3.1附录提案.md`、`依赖矩阵扩展提案.md`；完整新增词形机器清单随本批交付补齐。实施者未修改 docs、名库或参照，也没有通过工具代发 Trae/PROTOCOL 消息。

## 无新增架构停工项

stage-1 §4 旧排除登录与 Neurou 文件夹，本轮用户的明确扩展授权优先，有限范围已在裁定中写明，不构成未授权冲突。VERDICT-023 的 AccessCode 原为首次加入他人世界的访问码，当前目录无锁不与原文冲突。现有 editor 已登记于规格与门禁，不能把历史 E6 状态当成当前阻断。

AccountStartupSession 无 cc、无世界 ledger；完成候选先经浏览器适配保存，成功后提交逻辑快照。presentation 不直接改逻辑完成状态；新启动类型从 IntentPort 进行 export type 转发，保留 presentation→director 唯一窄路。组合根负责创建和销毁既有运行实例，未改变 A/B/C 核心规则。

## 后续待裁定事项

1. **真实账号服务与完成事实迁移**：当前“登录”仅开发阶段本地账号标识。PrologueCompleted 只在同浏览器存储、同账号下保持；真实服务接入、跨设备归并及旧本地完成状态迁移须明确设计。
2. **完整序章/教程内容**：本轮为简短灰盒文本，未交付完整 ShoreSetting 场景、StudioOrigin 叙事或完整 EditorTutorial。保留 062 名称与里程碑关系，内容制作另议。
3. **世界存档与重入**：本轮退出销毁 gameplay 会话及其独立拥有的 Scene 3D 世界根，重入 fresh；入口框架不需要新增存档接口，没有新增世界进度保存、恢复或账号多世界管理承诺。若需要继续上次世界，另立存储契约并补验。
4. **ShoreHub 功能入口**：统一默认启动入口已确认；未来 ShoreHub/终末彼岸从何处进入待功能实装时裁定，不删除现有世界观机制。
5. **其他编辑器与权限**：音乐/地图/剧情及引导线子项仅占位，未来实现时逐项裁定 Reader/Intent/Port 与权限；AccessCode 不自动转为编辑器锁。
6. **平台适配**：本轮沿用 Cocos 浏览器预览与 DOM UI；原生打包平台的账号存储、目录 UI 和编辑器文件 API 适配另议。

上述事项不阻断当前已授权的本地灰盒入口闭环。最终测试状态、截图与遗留运行限制由主交付报告记录，本请求不预先声明验收通过。

## 原文来源

- `641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl:85`：VERDICT-023，AccessCode/WorldDeveloper 原规则。
- 同文件 `:179`：VERDICT-062，账号级序章及完成里程碑边界。
- 同文件 `:191`：VERDICT-068，对默认启动路由的既有修订。
- 同文件 `:202`、`:214`：VERDICT-071/076，ShoreHubState 与废止 ShoreRestored。
- `quality-review/guidance-editor/VERDICT-147-157.md:11`：VERDICT-151，编辑器目录框架。
- `docs/spec/stage-1.md:83`、`:85`：旧阶段排除；`:143`～`:185`：已登记九模块矩阵；`:382`：AC-29 美术可替换。
