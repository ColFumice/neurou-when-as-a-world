# 名库 v3.10 附录提案 · B2.2d-2

交 Trae 审阅并落盘。本文件只提供与已落地代码一致的附录提案；没有直接修改 docs / 名库 / 参照文件。v3.9 的 Ledger / PuzzleProgress / FormatTime 名称与结构保持，v3.8 的真实通关、RouteSignature、ChartRef.state 和账号 key 保持。

## 新增公开名称

下表列出相对 B2.2d-1 基线新增的全部顶层公开导出。既有领域词 AIProfile、WorldLink、ChartSnapshot、ChartScore 的语义继续沿用；这里冻结的是本轮实装的数据/行为承载，不另造同义核心名。

| 归属 / 文件 | 公开名称 | 含义 |
| --- | --- | --- |
| director / RecallCountSession.ts | RecallCountSession | 同世界观察者的正式回忆与痕来源事件共计数机制 |
| 同上 | RecallCountSnapshot | schemaVersion=1 / accountId / worldId / records / traceBindings |
| 同上 | RecallCountContext | accountId / worldId / protagonistCharacterId / 已验证 regularChartId |
| 同上 | RecallCountCallbacks | readLedger / persistSnapshot / 可选 appendForeignEvent / now，由 director/组合根装配 |
| 同上 | RecallCountHydrateResult | Hydrated snapshot 或 Rejected issues，不发布活动图 |
| 同上 | RecallCountOperationResult | Recalled / Replayed / Experienced，或 ChartReplayIgnored |
| director / WorldLinkSession.ts | AIProviderConfiguration | CloudProvider / LocalProvider / TemplateProvider 的严格配置联合 |
| 同上 | AIProfile | schemaVersion=1 的完整提供方、任务与降级链配置数据 |
| 同上 | AIProfileSnapshot | schemaVersion=1 / sourceWorldId / capturedAt / profile |
| 同上 | WorldLinkContext | 权威账号、世界、种类、彼岸来源、主角与可选来源世界身份 |
| 同上 | WorldLinkSnapshot | 显式 NotApplicable 或 BugShore Linked 的严格判别联合 |
| 同上 | WorldLinkSource | Present Primary / Deleted / Unknown 的权威读取结果 |
| 同上 | WorldLinkSourceReader | 只接收 sourceWorldId 的纯来源读取接口 |
| 同上 | WorldLinkSession | 来源进入捕获、合法配置读取、孤立生命周期提交 |
| 同上 | validateWorldLinkSnapshot | 严格身份、单层来源、配置快照及墓碑状态校验 |
| 同上 | validateAIProfile | schema v1 完整配置结构与任务降级引用校验 |
| director / ChartArchive.ts | ChartArchive | 首演冻结与重演成绩的纯候选生成、严格校验 |
| 同上 | ChartArchiveContext | accountId / worldId / protagonistCharacterId / worldKind / shoreOrigin |
| 同上 | ChartMediaIdentity | 稳定媒体内容 ID、版本、资源路径与真实原字节 SHA256 / 长度 |
| 同上 | ChartVisualSnapshot | schemaVersion=1 / chartId / 实际 nodes[{nodeId,color{r,g,b}}] |
| 同上 | ChartContentManifest | schemaVersion=1 / 制作来源 source / 主媒体 media / 谱面来源 charts |
| 同上 | ChartSnapshotRecord | 单谱面实际首演内容、完成引用、归属、冻结时间、透明度与摘要 |
| 同上 | ChartSnapshotCollection | 世界观察者的 schemaVersion=1 首演冻结记录集合 |
| 同上 | ChartScorePlay | ChartPlaybackResult 加唯一 playId 与当场 guideTransparency |
| 同上 | ChartScoreRecord | 首演关联、snapshotDigest、scoringVersion、best/latest/count/IDs |
| 同上 | ChartScoreSnapshot | 世界观察者的 schemaVersion=1 持久成绩集合 |
| 同上 | ChartArchiveCandidate | snapshots / scores 两个独立深冻结候选，由外层单 key 提交 |
| 同上 | ChartPremiereArchiveInput | 同次完成事件及实际播放谱面/布局/视觉/媒体/透明度/结果 |
| 同上 | ChartReplayArchiveInput | 既有 chartId、唯一 playId、当场透明度与完整真实结果 |
| 同上 | parseChartContentManifest | 严格制作清单解析；不加载媒体、不调用平台 |
| 同上 | chartContentDigest | 普通数据规范 JSON 的纯 SHA256，用于实际冻结内容摘要 |
| director / ChartReplaySession.ts | ChartReplaySession | 选择自己合法完成向量后使用冻结内容的演奏编排 |
| director / PrimaryWorldState.ts | createPrimaryWorldStateCodec | 正式 Primary 内容绑定的七项统一解码/认证工厂 |
| director / WorldStateCodec.ts | isValidatedWorldStateSnapshot | 检查本运行时七项 codec 认证，普通 JSON / clone 不通过 |
| director / WorldStateSession.ts | WorldStatePreparedRestore | publish():boolean / discard()，未激活恢复对象图的发布边界 |
| presentation / WorldMemoryView.ts | WorldMemoryView | 自己的事件/痕回忆、完成旋律选择及成绩只读视图 |
| presentation / ChartReplayView.ts | ChartReplayView | 冻结谱面/布局/视觉和真实媒体的重演呈现 |

新增公开方法：`WorldStateCodec.parseComplete`、`WorldStateSession.bindCompleteSource`、`WorldStateStorage.bindCompleteWriter`、`WorldCoreStateStorage.clearDeletedChartState`。

新类主要公开行为同时按代码冻结：RecallCountSession 的 validate / hydrate / getSnapshot / getCount / recall / replay / bindT6Trace / experienceForeignEvent / chartReplay；WorldLinkSession 的 validate / getSnapshot / enterFromSource / refreshSourceState / readEffectiveProfile / canReturnToSource；ChartArchive 的 emptySnapshots / emptyScores / validateSnapshots / validateScores / preparePremiere / prepareReplay；ChartReplaySession 的 bindMedia / isActive / getReader 及既有 IntentPort 四项实现。视图仅 mount / refresh / setVisible / destroy 及重演只读媒体探针，不提供业务写入能力。

## 意图扩展

既有 PlayerIntent 新增三种仅含选择 ID 的变体：`RecallEvent{eventId}`、`ReplayTrace{traceId}`、`ReplayChart{completionEventId}`。不接受向量、NarrativeEvent、计数、成绩、快照、媒体 URL 或权限值。`experienceForeignEvent` 没有新增 presentation 意图与正式生产选择入口，本轮只开放 director 合法业务 API 并契约验证。

本批没有新增 `VectorEntry` 数据接口/类型。既有合法向量选择语义由 `ReplayChart.completionEventId` 关联当前主角的权威完成事件，不能把 T6 Entry 当完成。

## 数据结构冻结提案

| 结构 | v1 字段与约束 |
| --- | --- |
| RecallCountSnapshot | records 为 `{characterId,eventId,count}`；traceBindings 为 `{traceId,characterId,eventId}`；只接受本批真实原终点绑定，未知/重复/错角色拒绝 |
| AIProviderConfiguration | CloudProvider{providerId,kind,model,endpoint,credentialRef,systemPrompt}；LocalProvider{providerId,kind,model,modelRevision,systemPrompt}；TemplateProvider{providerId,kind,contentId,contentRevision,templates[{templateId,text}]} |
| AIProfile | schemaVersion=1 / profileId / revision / providers / taskRoutes[{task,fallbackChain}]；任务 Narrative / Dialogue / RealityHint / OutputValidation；降级以模板结束，私有提示与校验不能走云端 |
| WorldLinkSnapshot | 通用 schemaVersion/accountId/worldId/protagonistCharacterId；Primary/null 与 Shore/FinalShore 为 NotApplicable；Shore/BugShore 为 Linked + sourceWorldId + linkState Bound/Orphaned + aiProfileSnapshot |
| ChartMediaIdentity | kind Audio/Video；contentId / contentRevision / resourcePath / sha256 / byteLength；资源为稳定 audio/ 或 video/ 路径，无扩展名与临时 URL |
| ChartSnapshotRecord | chartId / ChartRef.state=PremiereCompleted / completionEventId / owner WorldObserver或FinalShorePersonal / frozenAt / chart / layout / visual / media / guideTransparency / contentDigest |
| ChartScoreRecord | chartId / ChartRef.state=PremiereCompleted / completionEventId / snapshotDigest / scoringVersion=1 / best / latest / completedPlayCount / completedPlayIds |
| ChartSnapshotCollection、ChartScoreSnapshot | schemaVersion=1 / accountId / worldId / protagonistCharacterId / records |
| ChartContentManifest | source{author,version,description}；media 为真实媒体身份数组；charts[{chartId,sourceKind Published/LegacyFallback,resourcePath 可为null,sourcePath,contentRevision,chartDigest,visualDigest,mediaContentId}] |
| WorldStatePreparedRestore | publish true 才代表实际对象图发布；discard 清理未发布图，不能将失败变成功 |

计数、完成次数、时刻、revision 为规定范围内安全整数；布局/向量/分数/透明度必须有限并符合原领域约束。快照与成绩均深克隆冻结，访问器、异原型、稀疏数组、循环、未知字段和错版本拒绝。

## 沿用结构的增量

`WorldCoreStateSnapshot.sections` 保留 Ledger / PuzzleProgress / FormatTime，并可同组增加 RecallCount / WorldLink / ChartSnapshot / ChartScore 四项。schemaVersion=1、kind=Core 与既有主 key 不变。旧三项仍严格可读；四项不能只出现部分字段。

`WorldStateSnapshot` 是七项全非空且通过内容绑定引用校验的运行时认证结果，新增编译品牌与不可序列化 WeakSet 认证；存储仍是 Core。`WorldStateCaptureResult.Complete` 和 `WorldStateRestoreResult.Restored` 的既有名称保持，只在真正通过认证/发布时可返回。

WorldStateReader.ownership 七项 codec 元数据均 Implemented；worldForkAvailability 仍固定 NotImplemented。ChartScore 既有纯计分器名称不改；新增 ChartScoreSnapshot 是持久成绩承载，两者职责不同。

存储 key 沿用 `neurou-world-state-v1:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)；本批没有新增四份 section key。锁名沿用 `neurou-world-state:` + encodeURIComponent(accountId) + `:` + encodeURIComponent(worldId)，账号记录 key 不变。

本附录不冻结未实现的 B2.3 身份 rebasing、WorldFork 或 FileCarryPayload 结构。正式落盘时请将旧 NotImplemented 元数据描述更新为“七项已实装但必须逐载体严格校验”，并保留历史阶段的诚实验收记录。
