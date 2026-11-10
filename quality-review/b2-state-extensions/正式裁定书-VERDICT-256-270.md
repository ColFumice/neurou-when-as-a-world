# B2.2d-2 正式裁定书 · VERDICT-256～270 落地版

本轮接续 VERDICT-241～255，补齐 RecallCount、WorldLink、ChartSnapshot、ChartScore，并在既有 Ledger、PuzzleProgress、FormatTime 上建立严格七项认证与稳定恢复。B2.2a/b/c 的账号事实、真实通关判据和防重契约继续有效。本文件是交付裁定材料；没有修改 docs、名库、参照文件，也不声称已实装 WorldFork。

## VERDICT-256 · 载体、归属与边界

七项保持既有归属：Ledger / PuzzleProgress / RecallCount / ChartSnapshot / ChartScore 属于本世界观察者，FormatTime / WorldLink 属于世界实例。索引继续以 accountId / worldId 隔离，再分别细化角色、事件、链、谱面与来源世界。Final 谱面是 FinalShore 个人层的严格归属例外，不能装入 Primary 或 BugShore。账号 WorldClearRecord、FirstWorldCleared、CopyPermission 不进入世界七项文档。

不新增模块。director 负责合法行为、纯数据校验、候选与对象图编排；presentation 负责本地存储、锁、实际媒体字节和视图；assets/scripts 负责组合根接线。所有逻辑模块保持零 cc、DOM、存储和网络调用。

## VERDICT-257 · 回忆自己的既有事件

`RecallCountSession` 以同一权威 Ledger 校验来源。`RecallEvent(eventId)` 只能选择当前主角已有事件；每次合法回忆使同一 `[characterId,eventId]` 计数加一。计数为非负安全整数，零表示真实载体中尚未发生回忆，不是为历史缺失载体补造默认值。

操作先构造和严格校验完整 RecallCount 候选，再由整个世界文档持久化；成功后才发布内存计数。失败、溢出、未知事件、身份不符或重入均拒绝。回忆不追加向量，不执行 SphereCrossing，不写账号事实。constructor / hydrate / getSnapshot 不重放行为、不采样时钟、不调用持久写入。

## VERDICT-258 · 痕回放共享来源事件计数

本批真实痕绑定限定为 `T6_MAIN_DEEP_TRACE` → 当前主角的原 `T6_ENDPOINT_PLACEHOLDER`。绑定必须与同一正式 Regular 身份、Player、原零向量、合法 Entry 终点一致；绑定来自原终点事实，不生成第二个叙事事件。

`ReplayTrace(traceId)` 与直接回忆该来源事件共用同一计数。任意痕 ID、伪造绑定、错角色或错谱面不能获得合法回放。`ReplayChart` 是独立演奏行为；`chartReplay(chartId)` 返回 `ChartReplayIgnored`，不增加 RecallCount，不触发其写入。

## VERDICT-259 · 他人事件的第一次经历

director 的 `experienceForeignEvent(sourceCharacterId,eventId)` 只接受同一账号/世界权威账本中的已知其他角色与正式 Regular 叙事 Entry。调用只提交来源角色与事件 ID，presentation 不提供向量、事件载荷、角色冒充或计数值。第一次尚未存在于自己账本时，director 复制已验证来源的 vector / VectorSchemaVersion / ChartRef，重建 Player、当次 AppendedAt 与空 ChapterTag，走现有同源追加；追加成功后返回 Experienced / count=0。后续同 ID 且同 vector / ChartRef 才按自己的事件回忆加一。

制作方 WORLD_* 选择、T6 终点、T7 完成、任何首演完成引用、未知角色/事件、内容冲突、未装配追加能力均拒绝。首次经历属于普通追加，所以允许由既有合法追加链执行其业务判定；不单独制造穿越或通关事实。本批没有正式 foreign 生产叙事内容，以上仅有契约覆盖。

## VERDICT-260 · WorldLink 的真实适用性

`WorldLinkSnapshot` 为严格判别联合：Primary / null 与 Shore / FinalShore 只能显式 NotApplicable；Shore / BugShore 必须 Linked，携带单层 sourceWorldId、Bound / Orphaned 与完整 AIProfileSnapshot。NotApplicable 必须由权威世界身份验证，不等价于缺字段、空对象或 null。

BugShore 来源 ID 必须来自权威彼岸身份，不能从存档字段反推；禁止自引用、彼岸套彼岸、跨账号与来源身份不符。Primary 生产流的 NotApplicable 已验证；本轮没有新 BugShore / FinalShore 生产内容或创建入口。

## VERDICT-261 · AIProfile 完整配置快照

`AIProfile` schemaVersion=1 保存 profileId / revision / providers / taskRoutes。提供方仅允许严格 CloudProvider、LocalProvider、TemplateProvider 数据；模板必须含实际非空内容。降级链引用唯一有效提供方并以 TemplateProvider 结束。任务仅 Narrative / Dialogue / RealityHint / OutputValidation；RealityHint 与 OutputValidation 不得走 CloudProvider，名言不进入生成路由。

CloudProvider 只保存 https endpoint、模型、systemPrompt 与 credentialRef；LocalProvider 保存模型及 modelRevision；TemplateProvider 保存 contentId / contentRevision 与完整 templates。它们是配置数据，不接入 AI 服务，不读取凭据、不发请求。未知版本、字段、提供方、任务、坏引用、非数据对象均拒绝；不使用任意 JSON 深拷贝冒充完整 AIProfile。

## VERDICT-262 · 单层弱引用与孤立

来源读取器必须返回同账号、同来源身份的 Present Primary / Deleted / Unknown。Unknown 明确拒绝，不能猜测删除。仅合法的来源到 BugShore 进入可以刷新并持久保存 AIProfileSnapshot；普通读取、验证与恢复不刷新快照。

已知墓碑使 Bound 派生 Orphaned；生命周期提交使用显式 refreshSourceState。Orphaned 永久保留最后合法快照，不重新绑定、不因 ID 重新出现而恢复来源，不允许返回来源。Bound 读取当前合法来源配置；Orphaned 读取已保存配置。写失败不发布新链接状态。此部分的进入、删除、孤立与恢复为契约证据，不冒称生产彼岸流程。

## VERDICT-263 · 首演实际内容冻结

首演只关联同次合法 PremiereCompleted 账本事件与真实 `ChartPlaybackResult.completed=true`。`ChartSnapshotRecord` 保存实际播放的 ChartData / GuidanceChart、完整 KeyboardPadLayout、视觉节点 RGB、稳定媒体身份、当次 guideTransparency、完成事件 ID、冻结时间、归属和 contentDigest。视觉空节点只允许表示该次实际使用的默认呈现，不用于补历史。

媒体身份含 kind / contentId / contentRevision / resourcePath / SHA256 / byteLength；临时 URL、遍历路径、错种类、坏摘要或空字节拒绝。发布清单从真实资源与原 fallback 函数生成，单独标识 LegacyFallback。组合根在演奏前核验实际媒体字节；冻结媒体未验证、身份不符或缺实际结果时，不得写首演完成及账号成功。既有 Regular 资源与 fallback 不改 tier。

contentDigest 为实际谱面、布局、视觉、媒体身份、透明度的规范 JSON SHA256；快照深克隆并冻结，同谱面首演不得覆盖。旧精确零向量 T7 的快照还必须由实际冻结的 Regular 身份验证；旧 T6 仍只是 Entry。历史缺实际播放内容或成绩保持缺失，禁止从现有资源回填。

## VERDICT-264 · 合法谱面向量选择与重演

`ReplayChart(completionEventId)` 只提交当前主角账本中既有合法首演完成引用的选择 ID。director 查找该完成事件已冻结的快照；新建 ChartPremiere 使用原谱面、完整原布局、视觉、媒体与透明度，不重新从当前资源生成谱面，不再次宣告首演。

重演保留既有演奏判定与暂停/退出语义，门控世界输入。完整结束才提交真实成绩；中途退出不更新成绩或完成次数。重演不追加账本向量、不增加 RecallCount、不生成第二条 WorldClearRecord，不再次改账号里程碑。未知、Entry、他人完成引用、历史快照缺失或媒体未验证均拒绝。完整结果持久化失败保留原分数与次数和当场待提交的完成结果，不能伪称重演提交成功。

## VERDICT-265 · 最高、最近、次数与防重

`ChartScoreSnapshot` / `ChartScoreRecord` schemaVersion=1，scoringVersion=1。首演真实结果成为 best / latest，completedPlayCount=1，首个 completedPlayIds 为 completionEventId。每场完整重演仅追加一个唯一 playId，次数严格 +1，latest 更新为当场结果；仅严格高分才替换 best，同分保留原最佳。

分数按既有 Perfect / Good 同价规则和实际透明度验证；Guidance 节点判定总数须与节点数一致。旧 ChartData 的错误槽位 Miss 不消费 Note，所以保留合法的额外 Miss，不能强行要求 hit+miss 等于 Note 数。成绩与冻结快照摘要、谱面和完成事件严格关联。

存储拒绝删除或替换已冻结快照、回退计数/最佳分、替换完成 ID 前缀、同次数篡改成绩、一次跳增多场或违反同分策略。坏结果、未完成、重复 playId、坏计分版本和关联均拒绝，不以零分补历史成绩。

## VERDICT-266 · 七项严格认证与旧文档兼容

同一 schemaVersion=1 / kind=Core 文档支持旧三项与新七项。扩展 RecallCount / WorldLink / ChartSnapshot / ChartScore 必须四项同组存在；允许显式 null 表达真实缺失，禁止部分字段迁移。旧三项读取和稳定无变化重入保持原字节，不悄悄补四项；新合法玩法提交可显式建立新增载体，但历史缺首演数据仍保持不完整。

`WorldStateCodec.parseComplete` 只有在七项全非空、权威身份/版本/归属/结构/跨项引用全部通过，并由内容绑定 Complete 验证器认证后才产生 `WorldStateSnapshot`。全部历史合法首演完成引用必须有实际快照及真实成绩。只通过头部、强制类型转换、任意完整字段对象、普通 JSON 或深克隆都没有认证资格；运行时 WeakSet 认证不进入存储。

新真实 Primary 可有合法空记录集合；其零值合法性来自已建立且已验证的载体。历史缺失载体、创建时刻、实际内容、成绩、机制或引用返回 Incomplete / Rejected。worldForkAvailability 仍固定 NotImplemented。

## VERDICT-267 · 稳定捕获与真正恢复

捕获以当前实时账本和解谜边界为准，必须与已持久化稳定状态一致，不能因旧存储曾稳定而把当前演奏/揭示误报 Complete。活动持续计时、揭示 Playing / Flash、入场门控、World 首演、重演、Playing / Paused 等不支持媒体续播恢复的边界明确 UnsupportedBoundary，不清空计时伪造稳定状态。

完整恢复先严格认证、安装七项 constructor seeds 和既有一次控制回填，形成未激活对象图，再由 `WorldStatePreparedRestore.publish()` 成功启用唯一输入/driver；只有实际发布成功返回 Restored。缺装配、校验失败、图准备失败或 publish 非 true 都 Rejected，并 discard 未发布图。读取、hydration 和恢复不重放意图，不写新账本/账号事实，不刷新来源配置，不重新采样 FormatTime，不自动播放痕揭示或谱面。

旧三项的 d1 部分 hydration 保持可用，但不能称完整 Restored。FormatTime 保留原 immutable 创建时刻；历史缺失不补当前时间或目录时间。

## VERDICT-268 · 同 key、租约与账号顺序

七项沿用唯一主 key：`neurou-world-state-v1:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)。不新增四个独立 section key。激活前取得账号/世界独占租约，持有至对象图销毁和 retained 账号提交结束；无 Web Locks、无正确租约、已墓碑、陈旧期望、revision 不连续、坏身份/版本、配额或写失败均拒绝生产激活或写入，无无锁 fallback。纯只读 Complete 是内容认证，不以锁能力代替内容判据；真正激活与生产恢复仍须具备租约。

首演顺序为 world lease → 单 key 持久化完成 Ledger + 实际 ChartSnapshot + ChartScore → account lock → WorldClearRecord → FirstWorldCleared projection。单 key 写入原子性不等于跨 key 全局事务。账号写失败不发布账号成功，保留合法 durable 完成引用供显式重试；不生成第二条完成事件。`retainUntil` 防止排队账号提交期间提前释放世界锁，不嵌套同一账号锁。

Recall、重演和稳定检查点也提交整个世界文档，先校验、重读期望值、核对单调历史与冻结内容，保存成功后才发布内存。`WorldStateStorage` 的完整写入须绑定七项 codec 与既有 leased writer；未绑定直接拒绝。

## VERDICT-269 · 删除与图谱清理

删除先落目录墓碑，再在已删除世界的独占租约中清理 ChartSnapshot / ChartScore；清理写入同一世界 key，将两项置 null 并 revision +1。它是显式生命周期清理例外，不能借普通保存删除冻结内容。墓碑继续阻止进入、普通写入与 Complete；GC 失败可重试，不恢复世界。

Ledger / PuzzleProgress / FormatTime、RecallCount、WorldLink 均保留；账号通关记录和单向里程碑不受世界墓碑影响。GC 配额失败保留原世界字节，目录仍可显示其他活动世界，并可在刷新时重试已有 deleted 项清理。没有实现 WorldRegistry、跨设备删除、观察者同步或服务 GC。

## VERDICT-270 · 验收与 B2.3 前置结论

契约测试与生产验收分别报告。契约覆盖 foreign 首次经历、BugShore 来源/孤立、FinalShore 归属、损坏/陈旧/缺失/失败/伪品牌、原子写与防回退；这些不等于对应内容的生产流程已存在。

Primary 最终生产复跑始于 2026-10-10T11:59:37.701Z，Cocos Creator 实际编译预览在 1920×1080 与 2560×1440 全 PASS，各 18 张原始截图、共 36 图；36 份实际源码映射吻合，编译产物与源代码未变化，预览进程正常退出。真实链路为新账号/FormatTime → 正式选择/非零 Ledger → 穿越/World → 真实媒体首演 → 完成账本/实际快照/真实成绩/账号事实 → 自然 T6/T7 → 自己回忆与痕共享计数 → 冻结 World 重演仅改成绩 → 七项 Complete → 退出和同 profile 新窗口 Restored。结果、PNG 摘要、源码映射与生命周期见同目录 `creator-preview-results.json` / `creator-preview-lifecycle.json`。输入不注入向量、快照、权限、存储、状态旗标或模拟媒体时钟。

本轮新增契约 159 / 159 与既有回归 189 / 189 PASS；三门禁 0 ERROR，命名检查保留 27 条判定窗口/痕域语义 WARN；32 项受保护文件核对 PASS。生产文件为 10 个既有文件接线/边界扩展与 16 个新增文件（7 个 TS + 7 个 meta + 内容清单及 meta）；详尽文件 diff 由整批交付报告列出。

B2.3 可在本地、稳定、经认证的 Primary 七项状态上开始分叉实现。新世界/角色身份分配、引用 rebasing、分叉事务、继承 FormatTime 和对象图发布属于 B2.3；本轮未实现且不以认证快照冒充分叉完成。FileCarryPayload 是导入/导出或携带机制，不是本地分叉启动的前置。WorldFork、FileCarryPayload、WorldRegistry、跨设备、同步、服务和 AccessCode 均保持范围外。

## 交付核对

新增公开名称见 `NAMEBOOK-v3.10-appendix-proposal.md`；依赖边核对见 `dependency-proposal.md`。代码、契约结果、真实预览与门禁应一起审阅，任何单项成功不得替代完整链路和稳定边界证据。
