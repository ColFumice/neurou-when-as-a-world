# B2.3 正式裁定书 · VERDICT-271～285 落地版

本交付文件记录本批已实现且经 PROTOCOL 正式验收的业务口径。名库 v3.11 名称与生产装配 Implemented 已追认，Trae 后续的正式名库及 B2.3 stage-1 更新已观察落盘。本批实施未编辑 docs、名库或参照文件；两处同期修改已确认是 PROTOCOL 授权的 Trae 落盘，保留原差异和归因记录，后续文档落盘另存证据。VERDICT-014 的世界分叉、VERDICT-030 的合法首演完成引用以及 VERDICT-057 的最终彼岸限制沿用；B2.2a 的账号投影、B2.2c 的制作方内容和真实通关、B2.2d 的七项严格认证与恢复契约继续有效。

## VERDICT-271 · 分叉的权威与权限

`WorldFork` 仍只有 `{kind:'WorldFork',worldId}`。presentation 提交来源世界 ID，director 从同账号目录和持久化状态取得来源；玩家不提供目标身份、向量、权限值、快照或成绩。`WorldForkSession.prepareWorldFork` 要求同账号合法只读里程碑，`CopyPermission === FirstWorldCleared === true`。未知账号、错误投影、未取得权限均拒绝。

权限和内容完整性校验通过后，才调用目标世界 ID、事务 ID 和时钟工厂。新世界使用正式 `world-` + UUID v4；不存在来源替换、直接赋权限或重用已存在/已删除世界 ID 的分支。

## VERDICT-272 · Complete 来源与稳定边界

来源必须属于当前目录且未删除，必须是当前运行时 `WorldStateCodec.parseComplete` 认证的同账号七项完整检查点，并经正式 Primary 内容绑定验证器再次验证。普通 JSON、强制类型转换、伪造品牌、克隆对象和历史 Incomplete 数据没有分叉资格。缺账本、解谜、创建时刻、回忆、链接、首演实际内容或成绩时保持拒绝。

生产来源为 Primary / shoreOrigin=null；FinalShore 明确不可分叉，BugShore 和其他来源本批返回不支持。源世界独占租约取得失败表示世界仍被占用，不使用旧稳定存档替代活动演奏、揭示或其他未支持的运行状态。正式分叉从世界文件夹执行，来源运行实例先退出。

## VERDICT-273 · 七项精确继承与身份重键

目标只新增世界实例身份与创建事务见证。Core 头、Ledger、PuzzleProgress、RecallCount、WorldLink、ChartSnapshot、ChartScore 的 account/world 复合身份统一重键到新 worldId；accountId 保持。

主角与其他角色 characterId、解谜 chainId、traceId、eventId、chartId 均保留世界内局部 ID。制作内容仍绑定同一主角 ID，不改写正式内容。Ledger 事件的顺序、完整向量、InputSource、AppendedAt、ChapterTag、ChartRef.state，以及解谜私有计时和控制事实、回忆计数与痕绑定、首演内容及全部成绩均精确保留。

SphereCrossing 的既有入口 worldId 重键；entryId 重新派生为 `JSON.stringify([accountId,targetWorldId,protagonistCharacterId,'SphereCrossing'])`。FormatTime 保留来源 immutable epochMs，不采样新的世界记忆创建时刻。目标 Core revision=0，capturedAt 为这次 forkedAt。候选再次通过七项完整验证，使用独立深克隆冻结对象图。

## VERDICT-274 · 永久实例来源见证

新增 `WorldForkOrigin` 是 Core 可选头 `forkOrigin`，不是第八项玩法状态。字段为 schemaVersion=1、accountId、sourceWorldId、sourceRevision、sourceCapturedAt、targetWorldId、protagonistCharacterId、transactionId、forkedAt、inheritedCompletionEventId。

见证要求来源/目标不同、身份一致、非负安全整数时刻与版本、forkedAt>=sourceCapturedAt；存在见证时 Ledger 不得为 null，世界必须 Primary/null，后续 capturedAt 不得早于 forkedAt。非 null 的继承完成 ID 必须匹配主角账本控制事实以及合法 Player World 首演完成事件。

创建后普通保存不得补写、改写或删除 forkOrigin。旧文档没有此头时保持原格式与行为，不自动迁移。初始未完成分叉的 inheritedCompletionEventId 永久为 null，即使目标之后真实完成首演；这是区分继承事实与自己新增事实的依据。来源以后修改或删除不影响目标恢复，不建立运行时回指或 lineage registry。

## VERDICT-275 · 已完成继承不能再次首演或提交账号事实

VERDICT-030 的账本合法完成引用决定首演状态。分叉继承账本、首演快照和成绩，但不继承 WorldClearRecord。`ForkWorldClearSession` 扩展既有 WorldClearSession，保持旧算法；继承完成时公开 completionStatus=Inherited、record=null、completionError=null。

此状态过滤 EnterWorldChart 与 RetryWorldClear，且在账号 commitRecord 回调再次阻断继承候选，避免基类恢复产生的待重试候选被写成新世界通关记录。构造、读取、恢复均不触发账号写入、账本追加或时钟采样。其余既有玩法意图继续委派。界面隐藏首演入口和保存重试，清楚说明首演事实继承、通关记录未继承。

## VERDICT-276 · 未完成副本的真实新通关

来源尚未 World 首演完成时，目标见证 inheritedCompletionEventId=null，后续仍沿用正式制作选择 ID、director 解析非零向量、同源追加、SphereCrossing、World 首演与 WorldClearStorage 提交流程。真正完成产生目标自己的合法 WorldClearRecord；中途退出不通关，入口保留。

新完成的账号保存失败可显式重试，恢复时不能误判为继承完成。相同 account/world 幂等；账号 projection 已 true 时不重复 saveProjection。FirstWorldCleared、CopyPermission 和既有账号记录始终属于账号，不进入七项快照，不随分叉复制。

## VERDICT-277 · 独立记忆、成绩与冻结内容

每个世界具有独立账本、解谜、回忆计数、链接配置、冻结谱面与成绩载体。分叉后目标自己的合法 Recall / ReplayTrace 只改目标 RecallCount；合法 ReplayChart 只使用目标已经继承的实际首演内容，完整结束仅改目标成绩与完成次数，中途退出不更新。

已完成继承的 World 谱面只能重演，重演不会追加完成账本、生成 WorldClearRecord、增加 RecallCount 或改账号投影。制作方 World 资源与媒体沿用其合法来源和内容摘要，不把 Regular 改 tier，也不从现有资源补历史缺失。内容摘要不含 worldId，故身份重键保留原冻结摘要。

## VERDICT-278 · 两 key 提交与唯一发布点

`WorldForkStorage` 使用短期日志桥接目标 Core key 与账号目录 key。顺序为：验证日志/计划及目录预期值 → 写 PendingWorldFork 日志 → 持目标租约写完整目标 Core → 回读确认 → 再比较目录 → 追加目标目录记录 → 清理日志。

目录追加是唯一提交点。未发布目标不能打开；源目录记录保持 active，源 Core 与账号记录/投影不写入。目标目录 template 仍为 EmptyWorld，title 在现有 80 字符约束内追加“ 的副本”，description 保留来源文字。是否使用正式 Primary 运行接线由合法 forkOrigin 和 Complete 状态判断，不能把所有 EmptyWorld 当正式 Primary。

## VERDICT-279 · 租约、目录锁与顺序

组合根先取得来源世界租约，再取得新目标世界租约，最后取得同账号目录独占锁。Web Locks 的 ifAvailable 检查使活动来源立即拒绝；缺少锁能力不采用无锁写入。目标是唯一新 UUID，不与既有实例争用。目录锁回调内不等待世界租约。

新建、删除、分叉和恢复统一使用 `neurou-world-folder:` + encodeURIComponent(accountId) 的目录锁；新建、删除和再次分叉的目录写入受 pending guard 保护，目标打开先完成日志恢复。目录读取与只读状态诊断仍可执行。普通运行的世界锁和账号通关锁保留既有顺序。回滚与日志恢复只需目标租约及目录锁，不再次等待源租约，不引入跨设备协调。

## VERDICT-280 · 陈旧计划与精确目标校验

分叉计划保存 sourceRevision 与来源规范 SHA256。最终提交在源租约内重新读取 active 来源和 Complete Core，校验原版本、原摘要、同账号权限及目录预期状态，并重新执行同一 rebase，确认目标候选精确等于当前来源继承结果，目录 title/description 也来自当前来源。

目标 key 已存在、目标 ID 已在目录或墓碑中、来源被修改/删除、目录变化、目标含篡改的向量/成绩/计数或伪造角色，均拒绝覆盖。访问器、异原型、符号字段、稀疏数组、循环、未知字段和未知版本在相应边界拒绝。目标写入与回滚注入必须同步完成，不能用未 await 的异步能力宣称持久成功。

## VERDICT-281 · 故障、恢复与数据保留

首个原子日志写入失败时，不调用同步 writeTarget，也不写目标 Core 或目录；日志清理失败适用已提交规则。日志成功后，writeTarget 必须同步持久完成，返回 Promise/thenable 明确拒绝。提交点前失败只回滚当前日志匹配、revision=0、尚未发布且持目标租约的精确暂存 Core。回滚失败返回 Pending/phase=Rollback，保留日志供刷新重试。不能删除活动世界或其他事务字节。

目录已成功发布即为 Committed；日志清理失败返回 cleanupPending=true，不能把已发布世界当失败回滚。恢复按目录是否已包含精确目标记录决定继续完成或回滚：已发布目标缺 Core 可从日志中严格验证的原暂存计划同步恢复，冲突 Core/目录/日志均保留并报错。恢复完成后才开放目标与其他目录写入；这不阻断目录读取和只读诊断。

## VERDICT-282 · 文件夹入口与可见状态

B2.3 组合根显式注入 WorldForkAvailability=Implemented，旧 WorldStateSession 构造默认仍为 NotImplemented。文件夹只在 CopyPermission、同账号 Complete Primary 与可读合法来源条件满足时启用分叉按钮；UI 结果仍须经过 director 最终校验。

点击等待异步提交，展示 pending，并禁止重复点击；失败显示错误且允许重试；成功刷新目录。仅在配置新 availability 读取器时扩展按钮规则，旧无此参数视图保留 NotImplemented 的原点击拒绝行为。状态诊断解释“打开世界以恢复稳定记忆”，诊断本身不激活世界。

## VERDICT-283 · 兼容与冻结核心

B2.2a 里程碑读写与 CopyPermission 派生算法、B2.2c 的 SphereCrossing/RouteSignature/World 内容、B2.2d 七项归属和品牌认证、A/B/C/T6/T7 与编辑器判定均保持。本批只扩展分叉领域、实例来源头、组合根调用链及 presentation；T6/T7 的零向量不回写、不赋新权重。

旧三项/七项 Core 可继续读取，普通稳定重入不迁移字节。旧空世界仍使用 MinimalWorldBuilder；复制出的正式 Primary 通过既有 SceneBuilder 和七项 constructor seeds 恢复，唯一输入/driver 发布成功才称 Restored。恢复不重放叙事选择、不播放首演、不刷新 FormatTime。

## VERDICT-284 · 模块与范围

WorldForkSession、WorldForkOrigin、ForkWorldClearSession 位于既有 director；纯逻辑无 cc、DOM、Storage、Web Locks、UUID 或真实时钟调用。平台租约、目录日志和持久化位于 presentation，类型经 IntentPort 转发。assets/scripts 负责资源、身份工厂、租约顺序、严格来源/目标验证与运行实例发布。

未新增模块或依赖矩阵方向，director 使用既有同域及领域依赖；presentation 对 director 保持 type-only 窄边。未实现 FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入、AccessCode 或 BugShore/FinalShore 新生产入口。

## VERDICT-285 · 验收证据口径

契约测试与生产验收分开。domain-results.json、storage.contract-results.json、inheritance.contract-results.json 使用真实领域类和严格七项 codec，控制时钟/锁/存储或 Chromium 输入为明示契约适配器；证明验证边界、继承、幂等、故障与账号隔离，不冒称真实 Creator 流程。

生产验收以 creator-preview-results.json 的实际 pass、编译源映射、served chunk 摘要、直接截图及每档状态为准；只从正式用户控制、原媒体和自然玩法完成真实链路。正式证据必须包含权限取得、目录分叉、新 UUID、七项继承、Inherited、目标回忆/重演独立变更、原世界与账号字节不变、同 profile 新窗口恢复及 1920×1080 / 2560×1440 一致性。尚无成功结果时不能提前宣称生产通过。

三条门禁为 check:naming、typecheck、check:dependencies。命名 WARN 需按原语义说明，不将 WARN 计为 ERROR，也不以契约 PASS 替代生产验收。
