# B2.2d-2 完整状态恢复前置 · 交付报告

本批实现完成。RecallCount、WorldLink、ChartSnapshot、ChartScore 已接入既有单世界载体，七项 codec 均为 Implemented。正式 Primary 的稳定捕获可以产出 Complete；退出重入和同 profile 新窗口通过实际未激活对象图发布产出 Restored。WorldForkAvailability 继续 NotImplemented。

**最终结果：新增契约 159/159、既有回归 189/189、三条门禁全部通过；实际 Cocos 1920×1080 与 2560×1440 均通过。** 本目录提供36张未修改原始截图、源码/编译映射及逐项持久化证据。机器汇总见 [delivery-results.json](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/delivery-results.json)。

## 正式裁定与名库提案

- [VERDICT-256～270 落地版](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/正式裁定书-VERDICT-256-270.md)：四项机制、七项完整判别、恢复边界、事务顺序、清理与 B2.3 前置结论。
- [名库 v3.10 附录提案与新增命名清单](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/NAMEBOOK-v3.10-appendix-proposal.md)：交 Trae 落盘；本轮未修改 docs/NAMEBOOK。
- [依赖矩阵核对提案](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/dependency-proposal.md)：无需新增模块或矩阵边；平台存储/媒体仍在 presentation 与组合根，逻辑层零 cc。

RecallCount 自己回忆与 T6 痕 Replay 共用来源事件计数，ChartReplay 不加计数。WorldLink 由权威世界身份决定适用性；BugShore 保持单层来源与最后实际进入的完整 AIProfileSnapshot，Unknown 不冒充 Orphaned。正式 Primary 保存合法 NotApplicable 声明。

首演按实际 Completed 结果冻结谱面、完整布局、视觉、透明度及稳定媒体版本/原字节摘要。重演从已完成账本向量选择冻结内容，完整演奏只更新 best/latest/次数/唯一 playId，退出不记成绩。最高分仅严格更高时替换、平局保留旧最佳；存储保护拒绝改写历史最佳或跳增多场。

## 修改文件与 diff

共 **10 个既有文件扩展、16 个新增文件，无删除**。本轮修改前基线用于实际统一 diff；Cocos `assets/scripts/src` / `constants` junction 只按根文件计数。

| 修改文件 | 实现作用 |
|---|---|
| `src/director/WorldStateCodec.ts` | 旧三项兼容、新四项整组、七项严格校验/完整引用与运行时认证 |
| `src/director/WorldStateSession.ts` | 四项 ownership 更新、完整来源与未激活恢复发布契约 |
| `src/director/PlayerIntent.ts` | 仅新增 RecallEvent / ReplayTrace / ReplayChart 选择 ID |
| `src/director/IntentPort.ts` | 仅增加 type reexports，原 T6/T7 业务不改 |
| `src/presentation/WorldCoreStateStorage.ts` | 同 key/lease 的扩展历史保护、完整 writer、墓碑后图谱清理 |
| `src/presentation/WorldStateStorage.ts` | 完整认证后委托既有 leased writer，未绑定拒绝 |
| `src/presentation/WorldCoreStateView.ts` | 七项计数、Complete/Restored 和原 FormatTime 显示 |
| `src/presentation/WorldFolderView.ts` | 等待删除编排结果并显示失败 |
| `assets/scripts/SceneBuilder.ts` | 四项 seed、真实媒体校验、首演原子归档、稳定完整恢复、回忆/重演视图接线 |
| `assets/scripts/WorldFolderBuilder.ts` | 正式内容绑定七项解码、完整目录诊断、墓碑先行与可重试清理；GC 失败保留活动目录 |

新增7个 TS 及各自 `.meta`：`RecallCountSession`、`WorldLinkSession`、`ChartArchive`、`PrimaryWorldState`、`ChartReplaySession`、`ChartReplayView`、`WorldMemoryView`。另新增实际资源清单 `assets/resources/chart/content-manifest.json` 及 `.meta`，不修改任何已发布谱面、媒体或编辑器算法。

- [完整修改清单与 SHA256](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/changed-files.json)
- [实际代码 diff](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/production.diff)
- [保护范围审计](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/protected-final-audit.json)：32个 docs/名库/参照/检查器/归档保护文件未改；既有 Ledger/Puzzle/FormatTime/Account/WorldClear/谱面/编辑器核心保持，逻辑 cc import=0。

## 存储、提交与失败保全

继续唯一 `neurou-world-state-v1:<encoded account>:<encoded world>`，四项在内部 section，不引入四个分散 writer。持有世界独占租约进行单 key 写入、expected 重读比较及 revision +1；首演将完成 Ledger + 实际快照 + 成绩一起持久化，然后走既有账号锁、WorldClearRecord、单向 milestone 投影。账号提交失败可沿既有路径重试；单 key 原子提交不宣称跨 key 全局事务。

恢复不执行新事件、穿越、揭示或账号写入。旧三项文档读取不自动迁移；历史缺 FormatTime、快照或成绩不补当前值。七项认证与跨项引用通过才能 Complete；restore 还必须真实装配并发布对象图，只有验证器的目录边界不会冒称 Restored。

删除沿用目录墓碑作为权限事实，再取得同世界租约清理 ChartSnapshot/ChartScore，保留 d1 三项、其他保留项和账号记录。清理失败不复活世界、不清空已加载活动目录，刷新可重试。

## 门禁与验收证据

| 门禁 | 最终结果 |
|---|---|
| typecheck | PASS |
| dependencies | PASS，0 ERROR |
| naming | PASS，0 ERROR / 27 语义 WARN |

[门禁原始结果及日志索引](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/gate-results.json)。27条 WARN 涉及判定时间窗与实际痕域命名，人工复核说明见验收证据。

[验收逐条对应](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/acceptance-evidence.md) 将159条新增契约、189条回归与实际生产流程分别列出。受控 fixture 不充当生产验收。[最终 Cocos 机器结果](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/creator-preview-results.json) 验证36个相关源映射与当前源一致，运行前后无变化，实际原生媒体、无运行错误和外部服务请求。

生产流程：新世界 FormatTime → 正式玩家选择 → 非零向量/穿越 → World 首演 → 七项持久化/账号事实 → 自然 T6/T7 → 自己回忆与痕 Replay count=2 → 冻结 World 重演次数=2 → 完整捕获 → 退出重入 Restored。两档最终均账本4条、快照2、成绩2、回忆2、7/7完整载荷，账号通关记录各1条，原 FormatTime 及持久字节保持。

| 截图 | 1920×1080 | 2560×1440 |
|---|---|---|
| 首演及七项持久化 | [04](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/1920x1080-04-world-completed-durable-ledger-account-record.png) | [04](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/2560x1440-04-world-completed-durable-ledger-account-record.png) |
| 完整目录捕获 | [16](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/1920x1080-16-directory-seven-sections-complete.png) | [16](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/2560x1440-16-directory-seven-sections-complete.png) |
| 七项恢复 / Complete / Restored | [17](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/1920x1080-17-seven-sections-restored-with-recall-and-score.png) | [17](/D:/Project/A_New_Begin/Neurou_official/quality-review/b2-state-extensions/2560x1440-17-seven-sections-restored-with-recall-and-score.png) |

## 遗留与下一轮

无新增架构阻断或本轮待裁定事项。活动七秒、揭示、Ready/Playing/Paused 演奏/重演继续 UnsupportedBoundary，未做进行中续演。BugShore/FinalShore/他人初次经历只有契约覆盖；正式内容和实际入口未纳入本批 Primary 生产验收。历史缺真实归档保持 Incomplete。

B2.3 可以启动稳定 Primary 本地分叉，仍须在该批实现新身份/引用重绑定、目标世界创建、继承提交与发布；当前可恢复的完整状态不等于分叉已实现。FileCarryPayload 不是本地分叉启动的隐含前置。WorldRegistry、同步、跨设备、服务、AccessCode 和完整感绪系统继续范围外。
