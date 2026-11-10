# B2.3 依赖矩阵提案

无需扩展依赖方向，也没有新增模块。check:dependencies 对 109 个逻辑 TypeScript 文件、约 386 条静态依赖检查为 0 ERROR。

| 实现 | 归属及依赖 |
| --- | --- |
| WorldForkSession / WorldForkOrigin / ForkWorldClearSession | 现有 director；复用同域 AccountMilestone、七项 codec、账本校验与 WorldClearSession；WorldForkOrigin 的 InputSource 来自既有 ledger 边 |
| WorldForkStorage | presentation；经 IntentPort type-only 读取计划/快照类型；注入严格验证、leased Core writer/remove 和目录锁能力 |
| WorldCoreStateStorage | presentation；扩展现有世界锁和来源头保护，保留既有持久化路径 |
| WorldFolderView / WorldClearView | presentation；提交既有 kind/worldId 意图，展示只读能力和继承状态 |
| SceneBuilder / WorldFolderBuilder | assets/scripts 组合根；Cocos、浏览器身份工厂、资源、租约与对象图发布 |

逻辑层 cc import 为零；director 无 DOM、localStorage、Web Locks 或实际 UUID/时钟调用。没有引入 WorldRegistry、服务、同步或导入/导出边。

docs / 名库 / 依赖参照文件由 Trae 管理。本批已由 PROTOCOL 正式验收，名称追认完成。同期 stage-1 d-2 证据标签是 PROTOCOL 授权的 Trae 落盘，另有原始独立 diff，本批没有编辑或回退它。
