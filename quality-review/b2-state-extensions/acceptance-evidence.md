# B2.2d-2 验收证据对应

本文件明确区分契约测试与实际 Cocos 生产验收。所有路径均以本目录为证据根；未修改 docs、名库、参照文件。机器结果见 `delivery-results.json`。

## 契约测试

测试使用真实逻辑类、正式发布内容和受控持久化/媒体/时钟夹具。夹具中的 Completed、七项状态或账号事实不构成 Cocos 生产证据。

| 验收要求 | 实际契约覆盖 | 结果文件 |
|---|---|---|
| RecallCount round-trip、深拷贝、无副作用、事件与角色存在性 | 31 条；自己回忆与 T6 痕 Replay 共用精确事件计数，持久化成功后发布，失败保持原计数/字节 | `recall.contract-results.json` |
| 别人初次经历写自己的账本、ChartReplay 不增加回忆 | 首次经注入权威追加器构造自己的 Player 事件；后续共用回忆计数；拒绝搬运 World/T6/T7/首演事实；ChartReplay 零回忆写入 | `recall.contract-results.json`、`replay.contract-results.json` |
| WorldLink round-trip、Bound/Orphaned 与完整 AIProfileSnapshot | 24 条；Primary/FinalShore 显式不适用；BugShore 单层弱引用、实际进入捕获、来源墓碑冻结、Unknown 拒绝、失败不发布 | `world-link.contract-results.json` |
| ChartSnapshot round-trip、实际首演冻结、重玩复用 | 24 条归档测试；完整谱面、布局、视觉 RGB、透明度、媒体版本/原始字节摘要；首演引用严格关联、旧缺失拒绝补造、FinalShore 个人归属 | `chart-contract-results.json` |
| ChartScore 更新策略 | 最高/最近/完成次数/已完成 playId；平局保留早先最佳；原计分算法与合法 Miss 语义保持 | `chart-contract-results.json` |
| 一次写入与不可改写历史 | 23 条；同 key、同世界租约、CAS/版本递增、一次加一、最高成绩赢家校验、旧完成 ID 前缀、冻结内容不可替换 | `storage.contract-results.json` |
| 冻结重演生命周期 | 23 条；只选自己首演完成 VectorEntry；退出无分数写入、完成仅更新成绩；失败以相同 playId 重试；媒体故障沿既有兜底规则 | `replay.contract-results.json` |
| 七项 Implemented 后 Complete、严格引用、稳定 Restored | 23 条；七项全有及完整关联才认证；JSON/头部不能伪造；先校验/未激活装配/单次发布；失败丢弃候选并保留旧图 | `aggregation.contract-results.json` |
| 跨账号/世界/角色、损坏/版本拒绝 | 四项各自校验与聚合、存储交叉校验；访问器/异原型/稀疏数组/未知字段/非法内容均拒绝 | 上述全部分项 JSON |
| 实际组合根事务与失败边界 | 11 条，提取并执行真实 SceneBuilder/WorldFolderBuilder 方法体；首演 Ledger+快照+成绩先原子保存、后账号事实；当前活动态不能读取旧检查点冒充 Complete；GC 失败保留目录且可重试 | `runtime-wiring.contract-results.json` |

新增契约合计 **159 PASS / 0 FAIL**。

既有逻辑回归独立保存于本目录，不覆盖以前的验收文件：Ledger **44**、PuzzleProgress **14**、B2.2a 账号 **26**、B2.2c 业务 **49**、B2.2c 存储 **56**，合计 **189 PASS / 0 FAIL**。FormatTime 创建/缺失/不可补写与账本恢复属于 Ledger 回归覆盖。

## Cocos 生产验收

运行既有 Cocos Creator 3.8.8 实际预览 `http://localhost:7456/`。验收脚本为 `creator-preview.cjs`，入口 `run-preview.cjs`。使用隔离本地测试账号/浏览器 profile；通过产品控件与 GameCanvas 键盘输入推进原玩法，读取状态与持久化字节用于断言。无 setItem 造状态、无向量注入、无私有玩法写入口、无替换媒体时钟。

每档各 **18 张原始 PNG**、**14 项生产检查**，共 36 张。截图名以下列序号为准，前缀分别为 `1920x1080-` / `2560x1440-`。完整状态、截图摘要、源文件与编译块摘要见 `creator-preview-results.json`，进程退出记录见 `creator-preview-lifecycle.json`。

| 验收要求 | 真实运行观测与断言 | 截图序号 |
|---|---|---|
| 新世界与 FormatTime | 新账号目录创建时写入唯一权威 epochMs；正式进入后显示原值 | 00、01 |
| 真实世界通关后七项落盘 | 正式玩家选择产生非零向量与 SphereCrossing 入口；原生音频结束完成 World；Ledger=2、真实快照=1、真实成绩=1；RecallCount 正式空记录、WorldLink 合法 NotApplicable，单世界文档七项齐备 | 02、03、04、05 |
| 退出重入后的完整恢复 | 两条账本事件、原时间/顺序/防重/入口与七项原始字节保持；恢复不追加、不重穿越、不重写账号记录 | 06 |
| 旧 T6/T7 原链路与 Regular 归档 | 自然 KeyA 移动和原 60 BPM 节拍 Digit1 连续七秒、揭示、原生视频演奏；T6/T7 维持原零向量，累计账本4条；Puzzle Completed/终点已结算；快照2、成绩2 | 07、08 |
| PuzzleProgress/FormatTime 恢复 | Completed、内部计时、endpointSettled、T7 防重、Finished 揭示及原 FormatTime 重入保持；旧 Enter/Digit1 不重复结算 | 09、10 |
| 新窗口读取同一持久 profile | 销毁旧 BrowserWindow、新建同 profile/partition 的窗口，登录后完整恢复；无新事件、记录、投影写入 | 11、12 |
| 自己回忆 / 痕 Replay 共用计数 | 产品“回忆”及“触碰这枚痕”各一次；同 T6 事件 count=2，账本/账号字节不变 | 13 |
| 冻结 World 谱面重演 | 选择首演完成向量进入冻结内容；演奏进行中捕获为 Incomplete；提前退出不更改成绩；完整重演仅更新完成次数至2 | 14、15 |
| Complete 与最终 Restored | 目录完整捕获 Complete；再次重入显示 7/7、Complete、Restored，回忆2、快照2、成绩2、账本4；七项字节保持 | 16、17 |
| 两档一致 | 实际 viewport/canvas/PNG 尺寸分别 1920×1080、2560×1440；路线分类及稳定解谜事实一致、账号各仅一条通关记录；无横向溢出 | 两档全部 |
| 证据与最终源一致 | 36 个相关 TS 源映射与本地源一致、服务块等于 Creator 编译块，运行前后未改变；无运行时/renderer 错误、无外部服务请求 | 机器结果 compilation / compilationUnchanged |

最终生产结果：**2/2 分辨率 PASS**，真实完整首演允许全 Miss 零分，沿用“完整演奏即完成”的规则；高分提升及平局选择由契约测试覆盖。

## 门禁与保护范围

| 门禁 | 最终结果 | 原始日志 |
|---|---|---|
| `npm run typecheck` | PASS，exitCode=0 | `gate-typecheck.log` |
| `npm run check:dependencies` | PASS，0 ERROR | `gate-dependencies.log` |
| `npm run check:naming` | PASS，0 ERROR / 27 WARN | `gate-naming.log` |

27 条 WARN 是判定窗口命名和痕域 Trace 语义的人工复核项；本批 `traceBindings`、`DeepTrace` 用于正式痕来源，未用作日志名称。资源清单独立校验：7 个实际谱面身份、2 个实际主媒体摘要一致。

`protected-final-audit.json` 验证 32 个 docs/名库/参照/检查器/归档保护文件未改；所有既有账本、世界、解谜、谱面和编辑器核心算法保持，逻辑层 cc import=0。`changed-files.json` 与 `production.diff` 使用本轮修改前基线，排除 Cocos junction 重复路径：10 个既有文件扩展、16 个新增文件（含7个 `.meta` 和资源清单 `.meta`），无删除。

## 明确的覆盖限制

- BugShore 的 Bound→Orphaned/AIProfileSnapshot、FinalShore 的 Final 个人归属、他人初次经历：契约测试通过，本轮没有生产内容流或截图，未声称生产验收。
- 活动七秒、揭示、Ready/Playing/Paused 演奏与重演仍为 UnsupportedBoundary；未实现进行中续演。
- 历史三项文档可按 d1 原机制读取；读取与 hydration 不迁移、不补历史快照/成绩/FormatTime。历史合法完成引用缺实际内容时为 Incomplete，完整 restore 拒绝。
- 目录只读诊断可以 Complete；只有装配未激活对象图和一次发布的运行时边界能 Restored。未绑定发布器不会返回恢复成功。
- WorldForkAvailability 保持 NotImplemented。B2.3 可开始稳定 Primary 的本地分叉实现；新身份重绑定、目标创建及继承提交属于 B2.3。FileCarryPayload 不作为本地分叉的隐含前置。
