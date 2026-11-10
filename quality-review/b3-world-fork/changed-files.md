# B2.3 修改文件清单

共 9 个既有文件修改、4 个新实现及 4 个配套 .meta；完整新文件与修改上下文见 production.diff。Cocos junction aliases 不重复计数。

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| [assets/scripts/SceneBuilder.ts](/D:/Project/A_New_Begin/Neurou_official/assets/scripts/SceneBuilder.ts) | Modified | 按 forkOrigin 装配继承首演保护子类；沿用未激活七项恢复/发布；普通保存保留 origin；注入 Implemented。 |
| [assets/scripts/WorldFolderBuilder.ts](/D:/Project/A_New_Begin/Neurou_official/assets/scripts/WorldFolderBuilder.ts) | Modified | 资源绑定严格 Complete 验证；权限/来源重读；世界租约→目录锁；分叉、日志恢复和独立目标入口；原新建/删除共享目录锁。 |
| [src/director/ForkWorldClearSession.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/ForkWorldClearSession.ts) | Added | 继承首演不新增账号事实；未完成副本仍可真实新首演。 |
| [src/director/ForkWorldClearSession.ts.meta](/D:/Project/A_New_Begin/Neurou_official/src/director/ForkWorldClearSession.ts.meta) | Added | 新增实现配套的 Cocos TypeScript asset 元数据。 |
| [src/director/IntentPort.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/IntentPort.ts) | Modified | type-only 转发 WorldForkOrigin / WorldForkPlan。 |
| [src/director/WorldClearSession.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldClearSession.ts) | Modified | 仅 completion status 类型联合增加 Inherited；原类算法不变。 |
| [src/director/WorldForkOrigin.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldForkOrigin.ts) | Added | 不可变永久实例来源及完成见证验证。 |
| [src/director/WorldForkOrigin.ts.meta](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldForkOrigin.ts.meta) | Added | 新增实现配套的 Cocos TypeScript asset 元数据。 |
| [src/director/WorldForkSession.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldForkSession.ts) | Added | 纯权限/源认证、身份工厂、七项精确重键候选。 |
| [src/director/WorldForkSession.ts.meta](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldForkSession.ts.meta) | Added | 新增实现配套的 Cocos TypeScript asset 元数据。 |
| [src/director/WorldStateCodec.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldStateCodec.ts) | Modified | 可选 forkOrigin 头严格校验；七项认证算法与旧无头格式保留。 |
| [src/director/WorldStateSession.ts](/D:/Project/A_New_Begin/Neurou_official/src/director/WorldStateSession.ts) | Modified | 快照增加可选头、availability 类型和构造装配参数；捕获/恢复方法保持。 |
| [src/presentation/WorldClearView.ts](/D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldClearView.ts) | Modified | 展示继承首演、记录未继承；隐藏首演与保存重试。 |
| [src/presentation/WorldCoreStateStorage.ts](/D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldCoreStateStorage.ts) | Modified | 非等待租约、来源头不可变、持租约精确暂存回滚。 |
| [src/presentation/WorldFolderView.ts](/D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldFolderView.ts) | Modified | 只读权限+Complete Primary 门控，异步 pending/错误重试，旧路径兼容。 |
| [src/presentation/WorldForkStorage.ts](/D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldForkStorage.ts) | Added | 短期日志、目录提交点、发布前回滚/发布后清理与恢复。 |
| [src/presentation/WorldForkStorage.ts.meta](/D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldForkStorage.ts.meta) | Added | 新增实现配套的 Cocos TypeScript asset 元数据。 |

上述 B2.3 实施之外的两处变更已归因：PROTOCOL 授权 Trae 并发落盘 docs/spec/stage-1.md 的 d-2 证据标签及 scripts/check-naming.js 的 v3.10 痕域白名单。原差异、摘要和文件名保留供历史核验，详见 protocol-acceptance.json / concurrent-external-changes.json / concurrent-external.diff。

Trae 随后已落盘 v3.11 名库附录，以及 B2.3 的 stage-1 授权范围和证据标签。后续文档快照、摘要与差异见 post-acceptance-trae-landings.json / post-acceptance-trae.diff；不计入上述原实施清单。原验收保护字节由 accepted-protected-manifest.json 核验，重建来源与时间已注明。
