# VERDICT-201～210 · B2.1 本地多世界目录基础落地裁定

日期：2026-10-10。依据：用户已正式采纳 PROTOCOL-B2.1-001 方案 A 与 201～210 提案，授权继续实施。行为规则以此次回复为准；本批新名称仍是待 PROTOCOL 追认候选。本文位于交付证据目录，不修改 docs、名库和参照。

| 编号 | 落地结论 | 实现与边界 |
| --- | --- | --- |
| 201 | WorldFolderReader 只读，getWorlds 动态返回冻结数组；WorldFolderEntry.worldId 扩展为 string，字段仍仅 worldId/title/description。View 只读并提交目录意图，director 的 WorldFolderSession 决定创建和删除。 | FolderCatalog 每次投影并冻结条目，不向 UI 暴露元数据写权限。目录意图与每帧 PlayerIntent 分离，经既有 IntentPort 仅类型窄路转发。 |
| 202 | 使用账号隔离的浏览器本地 JSON 元数据集合，不使用真实世界文件或完整世界状态。 | key 为 `neurou-world-folder-v1:` + encodeURIComponent(accountId)。集合 schemaVersion=1/accountId/records；每条仅 worldId/title/description/createdAt/deletedAt/template。时间为非负安全整数纪元毫秒，属于目录元数据，不是 FormatTime。与序章里程碑、编辑器草稿 key 独立。 |
| 203 | InitialWorld 仅在该账号目录从未初始化（key 不存在）时成为默认首项；随后按动态记录处理。 | InitialWorld 的 template 为 InitialWorld；创建的其他项为 EmptyWorld。InitialWorld 也可墓碑删除；刷新、退出返回与浏览器重启均不重种已删除项，已初始化的空列表保持为空。既有 InitialWorld 常量继续供展示默认值兼容，不是存档实例。 |
| 204 | CreateWorld 产生全新 ID 与独立最小箱庭；DeleteWorld 只写 deletedAt。持久化成功后才发布新快照。 | ID 为 `world-` 加浏览器 UUID，包含已删除记录在内检查重复。title 为 1～80 字符、description 为 0～300 字符，提交时 trim。墓碑删除幂等，不减账本、不改账户事实、不删除通关记录。存储失败保留原快照和表单输入；已观察到的过期目录提交被拒绝，显式刷新后重试。 |
| 205 | 完整 WorldFork 及 CopyPermission / FirstWorldCleared 前置移出 B2.1，冻结 VERDICT-014/030 原样保留。 | 可见“分叉”按钮只发意图并得到“分叉尚未开放”，不写 storage、不分配新 ID、不注入权限、不复制元数据冒充 WorldFork。 |
| 206 | 多项列表、新建表单、删除确认、取消、状态反馈及刷新按钮。打开前核对当前账号实际存储、世界存在且未删除。 | 只保留 InitialWorld 的旧 `open-initial-world` 导航 ID；其他项使用 data-world-id 与 data-action。文本通过 textContent 显示。同步运行装配失败会失活/销毁部分节点，目录错误保留可见；正常退出沿用原 after-draw 销毁完成后刷新。 |
| 207 | 编辑器目录维持全局顶层入口，不绑定世界。 | EditorCatalog 树及已实现编辑器路由保留；引导线、音乐编辑器核心、草稿和导出不变。VERDICT-165 的无锁仅作用于编辑器，不取消分叉权限。 |
| 208 | 复用 director/world/presentation 与 assets/scripts 组合根，不新增模块，不放宽依赖矩阵。 | WorldFolderSession 为纯 director；WorldLocalStorage 为 presentation 平台适配，仅 type 导入 IntentPort；组合根注入存储、ID、挂钟和场景运行节点。WorldRegistry 继续保留原件/复制品及位置登记语义，B2.2 再实现。 |
| 209 | B1 ChartResourcePath 继续采用入口 SceneBuilder 全局 Inspector 配置。 | SceneBuilder 本轮没有修改；InitialWorld 使用原 factory 并继续复制全局配置。EmptyWorld 不创建痕/深痕/谱面/媒体入口。没有每世界 ChartResourcePath 字段。 |
| 210 | 验收默认项、唯一 ID、动态多项、独立最小箱庭、墓碑、进入/返回/重启刷新、账号隔离、存储失败、两分辨率与三门禁。 | 最小箱庭复用 Bootstrap、InputCollector、FrameDriver、CameraRig、ProtagonistView 的既有移动和跳跃；运行时 fresh，不捕获/保存/恢复 gameplay。成功分叉明确排除，不计作本轮完成项。 |

理由：以上将目录管理与世界存档、复制权限、玩法事实分别保持在已有边界内；既有只读读取面、意图窄路与组合根足够实现本轮范围，无需添加新模块或服务依赖。

可逆性：目录 UI 与最小箱庭表现可替换；本地元数据 schema 后续升级必须明确迁移。已有墓碑不复用 ID；不得因目录删除收回账户级通关记录。冻结的复制权限和完整状态继承不在本批重新裁定。

存储范围：同一浏览器 profile、同一 origin、同一本地账号。端口也是 origin 的一部分。刷新预览/重启浏览器保留目录元数据；切换浏览器、端口或设备不构成迁移。localStorage 保存前的 expected 比较防止已可观察到的过期覆盖，不宣称跨页面同时写入的原子 CAS 或跨设备一致性。

正式裁定与实现证据分开：本文件记录已授权行为，门禁、双档 Creator 实测和受保护哈希另见交付报告。没有把测试注入的存储失败环境或 ID 源用于产品流程。

