# VERDICT-226～240 · B2.2c 正式裁定书（落地版）

日期：2026-10-10（Asia/Shanghai）。角色：ARCHITECT + IMPLEMENTER。范围：SphereCrossing、WorldBossChart 合法内容装配、权威 RouteSignature、T6 ChartRef 与首演判据兼容，以及用户 PROTOCOL 回复正式授权的最小世界叙事内容生产者；保持同一批次。

**状态：PROTOCOL-B2.2c-001 的内容生产前置已获用户正式授权并解除，业务与内容已落地。验收结果以本目录最终门禁、契约报告和实际 Cocos 生产证据为准。** 本文件描述当前实现，不预先宣称预览通过。名库和依赖说明以提案交 Trae 落盘；本批不修改 docs、名库、archive 或参照文件。

前置状态按用户 PROTOCOL 回复确认。VERDICT-013 / 014 / 030 / 042 / 057 及既有修订保持冻结；本批落实调用链，不重新裁定。B2.2a/b 核心、七项 WorldStateSession 契约及 WorldForkAvailability=NotImplemented 均受保护。

## VERDICT-226 · 事件空间几何来自不可变世界内容配置

- 球心沿用 `EventSpaceCenter`；半径沿用既有冻结概念 `EventDistance`。不新增同义领域名 SphereRadius。
- 配置归于世界内容中的主角事件空间，装配时按 accountId / worldId / protagonistCharacterId 绑定。球心是完整 20 维初始坐标，本轮新建主角空间取零坐标；半径有限且严格大于零，由制作方的世界内容配置给出。
- 几何是创建时固定的内容配置，不是每帧动态属性。不从屏幕投影、玩家当前坐标、得分、UI 参数或账号权限反推。
- 采用完整 20 维欧氏距离，无额外权重或归一化；`Math.hypot` 或等价稳定算法应避免平方溢出。20 维逐项有限、非负，所有访问通过 NarrativeDimension 成员。
- 正式文件 `assets/resources/world/primary-rain-dialogue.json` 发布零球心、`EventDistance=3`、Primary 和主角 `protagonist-1`，版本 `1.0.0`。三个分支分别对应共同避雨、读车票找回约定和承诺同行，完整向量与解释随内容发布；全部球心距大于 3。半径由该制作内容明确给出。
- `WorldNarrativeContent` / `parseWorldNarrativeContent` 在 director 验证来源、版本、身份、完整向量、唯一选择 ID 与包内资源路径。`PlayerIntent.ChooseWorldNarrative` 只携带选择 ID；director 解析合法分支并构造唯一 Player NarrativeEvent。同一运行只接受该交互的一个选择，其他选择和重复请求均不追加第二条。

## VERDICT-227 · SphereCrossing 的精确触发条件

成功追加后，在当前主角权威账本上执行：

```text
event.InputSource === Player
&& targetCharacterId === protagonistCharacterId
&& !alreadyCrossed
&& distance(currentLedgerPosition, EventSpaceCenter) >= EventDistance
```

等号算触发。不要求上一次坐标在球内，不要求本次 Player 向量非零：合法 Autopilot 事件可累计至球外，下一次合法 Player 追加才触发。Autopilot 自身只改变坐标，不授予入口。追加失败不判定；只读刷新、重入世界、按帧检测、媒体进度和 UI 操作不触发。这实现 VERDICT-042 最新修订，不能照搬 archive 的 inside→outside / 等号在内规则。

## VERDICT-228 · 调用边界与一次性闸

director 的受控追加编排为：校验事件和目标身份 → 同一权威载体 append → 从该载体重新派生主角坐标 → Player 条件判定 → 原子更新内存中的穿越事实及入口集合。SphereCrossing 业务类置于 `src/director/SphereCrossing.ts`，复用冻结名称、重新实现；archive 保持只读。

主角穿越后本运行期间不撤销。入口按 `[accountId, worldId, protagonistCharacterId, source=SphereCrossing]` 唯一，装配或通知重试不能产生第二入口。退出 World 首演保留同一入口。B2.2d 的世界状态恢复、跨刷新穿越状态 hydration 不在本批宣称范围；已存在账号通关记录时关闭该世界的再次首演通关路径。

不新增跨角色传播机制。其他角色事件不直接参加主角求和；只有干扰已合法形成主角账本事件时才参加。位置算法留在 ledger 的纯读取侧，director 承担业务，不引入 ledger→chart / ledger→world。

## VERDICT-229 · WorldBossChart 是制作内容，不是系统占位

WorldBossChart 是世界内容清单中指定的唯一 World 级谱面。制作方通过既有音乐/引导线编辑器流程制作，使用已支持的 World tier 草稿导入和 exportChart 导出，交付 `schemaVersion=3`、`tier='World'` 的 GuidanceChart，以及对应的视觉伴随文件与媒体。

每个世界内容版本恰好绑定一首 WorldBossChart；多个世界可绑定同一作品，不要求随机生成或每世界改写音符。身份由世界作用域与稳定 ChartRef / 内容版本共同确定。系统只校验、加载和装配，不在运行时把 Regular 改 tier、换 chartId 或生成空谱面使权限达标。

已发布 `primary-rain-world-1`：制作脚本实际调用 MusicEditorSession.LoadProject → exportSource → GuidanceEditorSession.LoadDraft（草稿原生 tier=World）→ exportChart，得到 v3 World、单引导线五个 Tap 节点与视觉伴随数据。原创音乐工程同时渲染六秒 PCM WAV，媒体没有借用素材。输入、草稿、导出及 SHA-256 见 `content-production-evidence.md` 和 `content-export-manifest.json`。

## VERDICT-230 · ChartEntry 统一描述两种入口来源

新增 `src/chart/ChartEntry.ts` 数据契约，`source: 'DeepTrace' | 'SphereCrossing'`。入口至少含 entryId、worldId、characterId、ChartRef、tier 和 source；账号作用域由持有该入口集合的 session 承担。

DeepTrace 分支保持既有 T6 终点写入、揭示和门控时序。SphereCrossing 分支只由 VERDICT-227 的成功判定授予，指向内容清单中的 WorldBossChart。入口引用不是完成事实，不能用于 FirstWorldCleared、首演完成判断或路线覆盖。

采用 `WorldBossChartSource` 作为 chart 域只读内容装配描述，包含稳定 chartId、contentRevision、chartResourcePath、visualResourcePath 和 mediaResourcePath；实际载荷须经现行 parser 校验。它表达内容来源，不另造一套谱面播放状态机。

## VERDICT-231 · World 首演完成沿用现行 C 判据

复用 ChartPremiere 的完整演奏判据，所有音符/节点已决且媒体到既有完成边界；保留现行媒体结束/异常超时规则，不以分数或最后一次输入替代 Completed。WorldChartView 使用 Cocos 加载的 AudioClip.nativeUrl，以真实 HTMLAudioElement.currentTime/ended 作媒体探针；正常生产验收须证明真实媒体结束，而异常兜底须另列契约证据。

完整演奏 WorldBossChart 算通关，与分数无关，包括全 Miss 的完整演奏。中途退出不写完成账本、不生成 WorldClearRecord、不写里程碑，原入口保留。重复处理同一 Completed 回调、重复通知或已完成世界的再开尝试不得追加第二个完成事实或账号记录。

World 使用独立 ChartPremiere 实例和 director 通关编排，不直接重绑既有 Regular 实例，不清除其全局 chartCompletionRecorded/endpointSettled 闸。组合根通过新增意图和只读活动谱面路由接入 World 分支，既有 T6/T7 分支的结果、退出、重入与帧门控保持原行为。完整 ChartSnapshot / 重玩与续演恢复仍属 B2.2d；本批不实现 World 重玩产品入口。

## VERDICT-232 · 权威 LedgerPosition 的定义

`LedgerPosition = Σ vector(event)`，求和范围严格为当前 `[accountId, worldId, protagonistCharacterId]` 的同一权威账本，按追加顺序逐维累计，含 Player 与 Autopilot 事件。零向量旧记录保留且自然贡献零；不追溯补值，不用最近一条向量、窗口累计、主角地图坐标、得分或屏幕投影代替。

ledger 提供纯读取计算 `deriveLedgerPosition`，校验版本、20 维形状、有限性及非负值；累计溢出明确失败，不静默裁剪。B2.2c 接入同一读写源是本次路线派生的最小必要边界，不实施 B2.2d 的序列化、无副作用 hydration 或完整恢复。

只绑定 LedgerAppend 而读取 DirectorSession 默认内部数组不具备权威性；生产装配必须同时绑定来自同一载体的只读视图与受控追加口，无法证明配对时拒绝通关编排。

## VERDICT-233 · RouteSignature 在完成追加后冻结

World 首演达到 Completed 后，director 构造带 `ChartRef.state='PremiereCompleted'` 的完成 NarrativeEvent，成功追加，再从同一主角账本取完整累计坐标，生成不可变 RouteSignature。这一事务边界中的坐标是“世界通关那一刻”的值；不能复用穿越时快照。

提案结构：

```ts
type DivergenceAxis = NarrativeDimension.Red | NarrativeDimension.Green
  | NarrativeDimension.Blue | NarrativeDimension.Black
  | NarrativeDimension.White | NarrativeDimension.Grey;

interface RouteSignature {
  readonly VectorSchemaVersion: 1;
  readonly ledgerPosition: NarrativeVector;
  readonly classificationVersion: 1;
  readonly divergenceAxis: DivergenceAxis | null;
  readonly narrativeTime: number; // ledgerPosition[NarrativeDimension.NarrativeTime]
}

interface WorldClearRecord {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary';
  readonly protagonistCharacterId: string;
  readonly ChartRef: ChartRef;
  readonly contentRevision: string;
  readonly completionEventId: NarrativeEventId;
  readonly clearedAt: AppendedAt;
  readonly routeSignature: RouteSignature;
}
```

这些结构已在 `src/director/RouteSignature.ts` 落地；WorldClearRecord 的 ChartRef 进一步要求 state 必为 PremiereCompleted。narrativeTime 是叙事维度累计值，clearedAt 是真实完成时刻。`deriveRouteSignature`、`validateWorldClearRecord` 和 `validateWorldClearProjection` 验证/冻结结构。完成事件 ID 采用 `WORLD_PREMIERE_COMPLETED:<epochMs>:<sequence>`，同一候选重试沿用原 ID、时间和路线；叙事选择采用 `WORLD_NARRATIVE_CHOICE:<epochMs>:<sequence>`。

## VERDICT-234 · 六色情感归类与并列

`classifyDivergenceAxis` 只比较 Red / Green / Blue / Black / White / Grey 六个分量。最大值严格为正时选最大者；正最大值并列则按冻结顺序 Red → Green → Blue → Black → White → Grey 选首项，使用精确数值比较，不追加 epsilon、随机数、时钟或账号影响。

分类版本为 1，首条生产 WorldClearRecord 之后不静默改算法。v3.8 明确路线体系的 DivergenceAxis 是这六个情感成员联合类型；旧名库 DivergenceAxis.Understanding/Empathy 是旧指标命名冲突，不能映射为两种颜色，不另猜其余四名。现有 ScalingBasis、EmpathyScaling、EndingWindow 的 Understanding/Empathy 数值行为保持；只在提案中澄清语义，docs/archive 本轮不改。

## VERDICT-235 · 零向量和没有突出情感的坐标

全 20 维为零不生成可用于本批真实通关的 RouteSignature，显式报告来源/坐标不满足不变量，不赋默认 Grey/Red。在零球心、正半径、非负 append-only 账本下，合法穿越后全零应不可达，因此这是错误诊断，不是额外得分门槛。

20 维非零但六个情感分量都为零时，保留真实快照，`divergenceAxis=null`，不贡献 RouteCoverage。它不伪造一个“最突出方向”，也不将合法 World 完成误判为未完成。所有非有限/负值/版本不符坐标拒绝。不实现最终路线覆盖产品或 FinalBossChart 解锁。

## VERDICT-236 · 新 ChartRef 明确引用状态

在共享 ChartRef 上增量加入 `readonly state?: 'Entry' | 'PremiereCompleted'`，chartId 身份保持。state 可选仅为兼容旧记录；新生产写入必须显式填写。

- T6 终点保留原 NarrativeEvent 类型、原写入一次行为、vector、eventId、chartId、深痕揭示和门控，只增 `state='Entry'`。
- T7 真正完成及 World 真正完成写 `state='PremiereCompleted'`；退出不产生该值。
- 实装 `classifyChartReference` 和 `hasChartPremiereCompleted` 读取判据，只有完成引用作为 VERDICT-030 的首演事实。state 是账本事件字段，不另持久化“已首演”布尔事实。

这是 VERDICT-030 已冻结口径“账本存在合法首演完成引用”的精确实现，不重新裁定原契约。不删除 T6 ChartRef，不减少既有 T6/T7 记录条数。

## VERDICT-237 · 历史 T6/T7 兼容不改账本

历史无 state 的记录按现有生产者的已知完整结构识别：T6_ENDPOINT_PLACEHOLDER 对应 Entry；T7_COMPLETION_PLACEHOLDER 对应 Regular 的 PremiereCompleted。识别需校验已知零向量灰盒形状、Player、有效 chartId 与附加字段，不能仅匹配一个字符串就授予世界权限。

旧 T6 的 CHART_NOT_BOUND 可识别为未解析 Entry，仅保留兼容诊断，不能装配谱面或转为完成。无 state 且无法识别来源的记录返回只读 `Unclassified`，不默认为完成。无效 state/字段为错误，不降级到 legacy 识别。历史 T7 识别还须与已验证的绑定常规谱面匹配，并保留其常规首演语义，不追溯生成 WorldClearRecord / RouteSignature / FirstWorldCleared。未知旧 World 记录的迁移策略等待实际载荷；本仓库没有这类合法生产记录。既有账本不回写、不补 state、不改向量。

## VERDICT-238 · 模块归属与世界身份

| 内容 | 归属 | 依赖 |
| --- | --- | --- |
| 账本追加载体及纯读取累计 | ledger 的读数据 / director 的写编排 | ledger→constants；仅 director 引用 LedgerAppend |
| SphereCrossing 业务、RouteSignature、WorldClearRecord、WorldClearSession | director | 已有 constants / ledger / world / chart 允许边 |
| ChartEntry、WorldBossChartSource | chart 纯数据契约 | chart→constants |
| WorldClearStorage、媒体与 UI | presentation | 对逻辑仅类型读取 / IntentPort 窄口；可引用 cc |
| account/world/主角/内容身份及平台适配接线 | assets/scripts 组合根 | 不让 director 导入 presentation |

不新增逻辑模块或矩阵依赖边。`WorldGameplayContext` 实际承载 accountId/worldId/worldKind='Primary'/protagonistCharacterId，contentId/contentRevision 来自同一已校验内容及读快照。Primary 来自世界内容配置的明确 worldKind，目录 InitialWorld/EmptyWorld 模板名不是种类证据。WorldFolderBuilder 进入前重新校验账号和世界存在性；Bootstrap/SceneBuilder factory 传真实账号世界身份，再加载正式内容构造 WorldClearSession。七项 WorldStateSession 核心保持原契约。

## VERDICT-239 · 账号通关提交链与幂等

```text
合法世界内容 + WorldGameplayContext
→ director 受控 Player 追加
→ 同源 ledger 读取累计
→ SphereCrossing → World ChartEntry
→ 独立 World ChartPremiere 真正 Completed
→ 合法完成 NarrativeEvent 追加
→ RouteSignature / WorldClearRecord
→ WorldClearStorage 持久保存账号记录
→ AccountMilestoneStorage.saveProjection({FirstWorldCleared:true}, expected)
→ 重新构造 AccountMilestoneReader → CopyPermission=true
```

WorldClearSession 是业务调用者；SceneBuilder 注入回调，调用 `WorldClearStorage.commitRecord(record,milestones)`。适配器在同一账号锁内调用 `saveWorldClearRecord`，随后读取当前投影并按需调用 `AccountMilestoneStorage.saveProjection`。WorldFolderBuilder 重新装配账号目录时调用 `reconcileAccount` 对账。saveProjection 本体和 B2.2a 读取/派生核心不修改；读面从最新持久投影重新创建，CopyPermission 仍只读派生。

账号层记录以 `[accountId, worldId]` 幂等；相同记录重试不写入，不同候选禁止覆盖原路线。projection 已 true 时跳过重复 saveProjection。同步 saveWorldClearRecord 仅允许在适配器持有该账号锁时使用，生产接线统一使用 commitRecord/reconcileAccount。

记录先持久化，投影后更新。写记录失败不发布账号通关成功；记录成功、投影失败则保留合法记录与待对账状态，后续账号装配读取校验后的记录再重试 false→true。新 key 独立于序章、目录和世界状态。两个 localStorage setItem 是顺序写入，不是原子事务。已接入 browser Web Locks 同一账号独占锁，锁内重读记录及投影；无锁能力显式拒绝提交，不使用陈旧 expected 覆盖事实。

同一运行中完成账本成功后后续步骤失败，保留唯一完成事件并重试提交，不复位闸重演写第二条。刷新前记录未持久化的世界账本恢复仍不在本批保证范围；不借本轮实现 B2.2d。账号记录已持久化后，重开该 worldId 不能再次授予通关。WorldForkAvailability 仍 NotImplemented；记录不进入 WorldStateSnapshot，不随世界墓碑删除。

## VERDICT-240 · 授权解除、实施边界与验收等级

用户已采纳 PROTOCOL-B2.2c-001，明确把最小正式世界叙事内容生产者纳入原四项整批。当前正式内容、选择 ID 意图、director 构造事件、同源追加、World 谱面/媒体、路线、账号存储与投影调用链均已落地；原阻断原因解除。

只补该真实通关前置。完整自动感绪计算、完整二十维感绪系统、B2.2d hydration、WorldFork、FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入与 AccessCode 均不实施。旧 T6/T7 继续原零向量，只有 ChartRef.state 增量；不补旧记录。

契约验收证明边界/算法/幂等/失败恢复：Player 与 Autopilot、球面等号、跨角色隔离、并列与零方向、T6/T7 兼容、退出保留、重复完成、账号锁和写失败顺序。它不证明实际资源播放或 Cocos 产品链路。

生产验收须在真实 Cocos 预览中，以真实账号和 Primary 世界，依次证明玩家选择 → 非零同源追加 → SphereCrossing 入口 → 正式 World 演奏 → 完成引用与 WorldClearRecord/RouteSignature → FirstWorldCleared false→true → CopyPermission true；另证中途退出、重入、重复不增写和两档分辨率一致。正常演奏的真实 native ended 与存储 payload 必须可核查。

三门禁须针对最终生产代码重跑；旧 preflight-source-audit 只保留历史前置审查身份。最终结果见 `gate-results.json`、业务/存储契约报告及主交付的 `验收证据映射.md`；本裁定书不把待采集截图或 fixture 冒充生产通过。新架构冲突或前置缺失仍按用户规则提交 PROTOCOL。
