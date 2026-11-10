# B2.2d-2 最终域与存储只读审核

审核对象为冻结后的 `ChartReplaySession`、`RecallCountSession`、`ChartArchive`、`WorldCoreStateStorage` 及 `SceneBuilder` 的实际接线。此次未修改生产文件。结论：本轮关注范围未发现尚未修复的阻断缺陷。

| 关注点 | 核验结论 | 依据 |
| --- | --- | --- |
| VectorEntry 与冻结来源 | 只按当前主角账本中的完成事件 ID 选择既有快照；谱面 ID 必须一致。状态为 Entry 的制作选择及 T6 终点不成立。缺失首演实际内容时拒绝，不从当前资源生成快照。 | `ChartReplaySession.ts:62`；`replay.contract.cjs` 的自身完成、其他角色、Entry、缺快照与身份不符用例 |
| 重演实际内容 | 新建 ChartPremiere 直接使用冻结 `record.chart` / `record.layout` / `record.guideTransparency`；表现使用该记录的视觉与媒体身份。SceneBuilder 要求已加载媒体的实际 SHA-256 / 字节数校验结果与冻结媒体身份逐项相等。 | `ChartReplaySession.ts:75`；`SceneBuilder.ts:1479`、`:1645`；`ChartReplayView.ts` |
| 旧 T7 兼容 | 仅既有 T7 完成事件、实际冻结 Regular 快照和匹配的 chartId 可使用无 state 兼容。快照集合来自严格 codec；旧 T6 Entry 不会被当成首演。旧账本原值不回写。 | `ChartReplaySession.ts:70`；真实 Regular ChartPremiere 的旧 T7 契约、旧 T6 拒绝契约 |
| 完成与退出 | 必须有 ChartPremiere 的真实 Completed / completed 结果才提交成绩；判定全部结束但媒体未结束时继续等待。中途退出不提交。异常媒体走独立帧时钟及既有超时规则，暂停不累计。 | `ChartReplaySession.ts:86`、`:101`；重演退出、媒体等待、暂停、早结束与不可用媒体契约 |
| 成绩失败重试 | `saveResult` 返回前不退出或清空会话；失败后保留 Completed、同一 playId 和原档案，下一次重试只插入一次结果。SceneBuilder 先构造候选并完成单 key 持久化，再发布快照/成绩字段。 | `ChartReplaySession.ts:101`；`SceneBuilder.ts:1487`、`:1621`；失败重试契约 |
| 重演副作用 | 重演入口和结算没有 Ledger 追加、Recall 增量或账号写入口；外层保存使用相同 Ledger/Puzzle/Recall/WorldLink，并仅替换已校验成绩候选。整个进入/退出批次均门控旧玩法意图。 | `ChartReplaySession.ts:39`；`SceneBuilder.ts:1487`；账本、回忆、账号不变及批次门控契约 |
| 他人首次经历身份 | 必须从同账号、同世界权威载体中的不同已知角色读取真实事件；UI 不能提交向量或事件。仅正式 Regular 的普通 Entry 可接受，制作选择、T6/T7、首演完成及未知谱面均拒绝。 | `RecallCountSession.ts:189`；foreign 角色/事件/世界身份和禁止来源契约 |
| 他人首次经历追加 | director 复制校验后的事件 ID/vector/schema，重建当前 Player 来源、新 AppendedAt 与空 ChapterTag，经当前主角 `world.appendLegacyEvent` 的同源持久化追加。首次 count 为 0，后续相同 ID/向量/ChartRef 才进入 Recall。追加失败保持原载体与计数。 | `RecallCountSession.ts:210`；`SceneBuilder.ts:1472`；foreign 首次、失败重试、后续共享计数契约 |
| 回忆持久化与纯水合 | 自身 Recall / T6 Replay 共用角色+事件计数；先持久化后发布，失败与重入均不增量。构造、水合、捕获只严格校验/克隆/冻结，不重放追加、时钟或账号操作。 | `RecallCountSession.ts:231`；Recall 31 项契约 |
| 七项同 key 保存 | 精确账号/世界租约、当前版本重读比较、revision 连续递增、单次 setItem；失败原字节保留。扩展四项必须同组，既有七项不得退回三项。 | `WorldCoreStateStorage.ts:99`；storage 单 key、锁、CAS、失败与旧三项用例 |
| 已有事实保护 | Ledger 原顺序原值、FormatTime、回忆记录/绑定、冻结谱面记录不能删除或回退；成绩保存旧完成 ID 前缀，同次数记录不可替换；每场只加 1，best 按严格更高分选最新，平局保留旧 winner。 | `WorldCoreStateStorage.ts:159`、`:215`；删除、快照替换、历史 playId、best 伪造/平局与跳增契约 |
| 墓碑清理例外 | 只有已删除世界加精确世界租约才可清空 ChartSnapshot / ChartScore；其余五项保留。失败可重试且不复活世界，成功后重复清理不写。 | `WorldCoreStateStorage.ts:129`；GC 活跃世界拒绝、租约、失败原值与幂等用例 |

此次验证依据为已通过并落盘的契约结果：`recall.contract-results.json` 31/0、`storage.contract-results.json` 23/0、`replay.contract-results.json` 23/0，共 77 PASS / 0 FAIL。真实 ChartPremiere 与正式 World 内容用于隔离夹具，存储和媒体时钟受控；这些结果不充当 Cocos 生产验收。

生产覆盖边界保持明确：他人首次经历分支当前只有 director 契约覆盖，没有现成世界内容入口；BugShore / FinalShore 也没有本批生产入口。该边界不导致伪造快照、临时叙事生产者、旧零向量补写或额外服务接入。Root 的 Cocos 双分辨率证据单独证明其实际走过的 Primary 首演、重入、自身 Recall 与 ChartReplay 路径。

信任边界：ChartReplaySession 的读取回调由组合根提供已校验的同世界 Ledger 和 ChartSnapshot 集合；它不是接受任意外部原始快照的入口。组合根持久化回调必须保持同步“成功返回即持久化完成”契约。当前接线满足该条件。
