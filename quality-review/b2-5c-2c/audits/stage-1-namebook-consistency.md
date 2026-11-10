# 审计报告 · stage-1 与 NAMEBOOK 一致性核对

- 生成时间：2026-10-11 12:18:28 UTC
- 输入 1：`docs/spec/stage-1.md`（108712 字节，SHA256 `c4e9a3090bc96d2204e57401b57f788b448386d822ada7edae6874c68ac63fce`，共 1137 行）
- 输入 2：`docs/NAMEBOOK.md`（178559 字节，SHA256 `398ed2e5ae2581094708fd5edbef958e9fca20a3cbccbc79f1a8cf7d9d381dac`，共 2016 行；v3.21 附录 L1959–L2016）
- 提取规则：自 stage-1 全文提取大写驼峰（PascalCase，两峰以上）与全大写下划线（UPPER_SNAKE）标识符；逐名以词边界正则在名库全文检索同形条目。
- 判定规则：名库全文无同形 → 未注册；全部出现行含 废止/不予追认/作废/不采纳 → 版本过旧（仅废止语境）；全部出现均位于候选/未冻结/延期/排除类小节 → 未注册（仅候选/延期/排除区）；其余 → 已引用。首现行号与所属小节/版本作为出处证据。本报告只记录机械核对事实，不含修复建议。
- 注意：stage-1 中大量普通英文/技术词（如 GitHub 等）同属大写驼峰形态，一律机械纳入、不做语义筛选；"未注册"仅表示名库无同形条目，是否应为冻结名由 PROTOCOL 判定。

## 1. 重点核对：出现在含"冻结/VERDICT"标记行上的标识符（146 项）

| 名称 | 类别 | stage-1 次数 | stage-1 出现行（前5） | NAMEBOOK 首现（行/版本） | 首现所属小节 | 判定 | 备注 |
|---|---|---|---|---|---|---|---|
| AccessCode | PascalCase | 13 | 189,205,221,227,233…共13处 | L73（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| AddOnly | PascalCase | 2 | 237,904 | L89（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| AppendedAt | PascalCase | 3 | 903,916,946 | L57（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| AudioOutputClock | PascalCase | 1 | 531 | L412（v2.5） | `L404 ### T7 已冻结的其他名称（承接 v2.4 及之前）` | 已引用 |  |
| AuthorityTrustAnchor | PascalCase | 1 | 889 | L1374（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| AuthorSequenceSegment | PascalCase | 1 | 901 | L1455（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| AuthService | PascalCase | 8 | 221,227,231,232,835…共8处 | L77（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| BoundViolated | PascalCase | 1 | 919 | L1559（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| CANONICAL_DEPTH_LIMIT | UPPER_SNAKE | 1 | 934 | L1710（v3.18） | `L1704 ### E 类 · 实现常量与内部名（模块私有，不导出）` | 已引用 |  |
| ChartPlaybackResult | PascalCase | 1 | 709 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| ChartSnapshot | PascalCase | 4 | 194,198,708,724 | L97（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ChartSnapshotRecord | PascalCase | 1 | 709 | L1039（v3.10） | `L1036 ### 新增公开名称（按归属）` | 已引用 |  |
| ChartSourceData | PascalCase | 4 | 151,374,593,594 | L583（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| CheckpointCoverageEntry | PascalCase | 1 | 946 | L1486（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| CheckpointUnverifiable | PascalCase | 2 | 916,949 | L1559（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| CoDeveloper | PascalCase | 3 | 907,907,946 | L111（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| CommitClass | PascalCase | 1 | 904 | L89（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| CommitRelay | PascalCase | 7 | 221,227,232,835,865…共7处 | L61（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| CommunityMap | PascalCase | 1 | 904 | L5（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ContractAdapter | PascalCase | 15 | 209,220,226,238,772…共15处 | L1205（v3.13） | `L1203 ### 本轮冻结的 director 公开名称（src/director/CoreTransfer.…` | 已引用 |  |
| ContractServiceClock | PascalCase | 1 | 853 | L1312（v3.14） | `L1299 ### 平台与组合根导出名` | 已引用 |  |
| CopyPermission | PascalCase | 12 | 169,215,220,644,683…共12处 | L37（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| CoreTransferPayload | PascalCase | 3 | 215,778,916 | L1204（v3.13） | `L1203 ### 本轮冻结的 director 公开名称（src/director/CoreTransfer.…` | 已引用 |  |
| CrossDeviceDuplicate | PascalCase | 7 | 27,210,211,213,215…共7处 | L887（v3.7） | `L886 ### 明确不新增（B2.3 或更后）` | 已引用 |  |
| CrossDeviceImportJournal | PascalCase | 1 | 916 | L1212（v3.13） | `L1203 ### 本轮冻结的 director 公开名称（src/director/CoreTransfer.…` | 已引用 |  |
| DeveloperMapChange | PascalCase | 3 | 237,904,946 | L1463（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| DeveloperRosterChange | PascalCase | 1 | 904 | L1468（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| DivergenceAxis | PascalCase | 1 | 183 | L43（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| EchoTrace | PascalCase | 2 | 240,913 | L93（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| EditPresence | PascalCase | 2 | 240,922 | L111（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| EditTarget | PascalCase | 1 | 907 | L111（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ElementType | PascalCase | 1 | 525 | L9（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ExternalService | PascalCase | 7 | 237,269,873,874,898…共7处 | L1371（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| ExternalSharedOnlineV1 | PascalCase | 3 | 237,898,931 | L1525（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| FileCarry | PascalCase | 12 | 211,216,221,227,233…共12处 | L61（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| FirstWorldCleared | PascalCase | 9 | 169,642,683,718,784…共9处 | L37（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| FormatTime | PascalCase | 9 | 193,198,689,724,787…共9处 | L49（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| GuidanceNodeTiming | PascalCase | 1 | 1025 | L593（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| HomeConflict | PascalCase | 4 | 759,760,790,850 | L1151（v3.12） | `L1147 ### 历史名补登与职责澄清` | 已引用 |  |
| HomeDevice | PascalCase | 6 | 220,751,790,790,808…共6处 | L1149（v3.12） | `L1147 ### 历史名补登与职责澄清` | 已引用 |  |
| HomeRevision | PascalCase | 2 | 847,847 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| HostFailure | PascalCase | 4 | 244,272,937,943 | L1665（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| HttpOnly | PascalCase | 2 | 231,886 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| IdentityConflict | PascalCase | 1 | 904 | L1548（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| InitialWorld | PascalCase | 21 | 135,210,220,225,628…共21处 | L627（v3.1） | `L623 ### 领域名称` | 已引用 |  |
| IntentPort | PascalCase | 11 | 244,253,265,269,278…共11处 | L253（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| InvalidChange | PascalCase | 2 | 919,943 | L1549（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| KeyPublisherUnavailable | PascalCase | 1 | 910 | L1515（v3.17） | `L1495 #### A 类 · 成员与群 key 命名边界` | 已引用 |  |
| LegacyIdentityUnsupported | PascalCase | 2 | 237,901 | L1445（v3.17） | `L1429 ### 历史沿用与新旧格式边界` | 已引用 |  |
| LimitExceeded | PascalCase | 1 | 934 | L1673（v3.18） | `L1669 ### B 类 · codec 辅助类型（4 项，本轮冻结）` | 已引用 |  |
| LocalPublished | PascalCase | 4 | 220,832,832,850 | L1291（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| MapEditCommit | PascalCase | 1 | 904 | L87（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| MergeConflict | PascalCase | 3 | 907,916,916 | L91（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| MidiNoteEvent | PascalCase | 1 | 374 | L582（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| MigrationClaim | PascalCase | 1 | 850 | L227（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| MigrationRelease | PascalCase | 1 | 850 | L227（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| MissingAdmittedEnvelope | PascalCase | 3 | 271,271,922 | L1550（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| MonotonicReveal | PascalCase | 3 | 237,904,946 | L1463（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| NarrativeEvent | PascalCase | 7 | 187,494,551,619,680…共7处 | L7（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| NoteColor | PascalCase | 1 | 374 | L581（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| ObserverSync | PascalCase | 12 | 221,227,233,240,247…共12处 | L61（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| OfflineGrace | PascalCase | 13 | 221,227,233,240,247…共13处 | L77（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| OfflineGrant | PascalCase | 3 | 240,901,919 | L1413（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| OrphanCommit | PascalCase | 1 | 919 | L91（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| PERFECT_WINDOW_MS | UPPER_SNAKE | 3 | 435,1116,1117 | L377（v2.5） | `L374 ### VERDICT-123 Note 与判定` | 已引用 |  |
| PermitExpired | PascalCase | 1 | 919 | L1548（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| PersonalDiagnosticBoundary | PascalCase | 1 | 949 | L1698（v3.18） | `L1693 ### D 类 · reducer 本地类型（4 项，本轮冻结）` | 已引用 |  |
| PhysicalDevice | PascalCase | 5 | 233,240,247,895,898 | L1413（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| PremiereCompleted | PascalCase | 5 | 185,185,674,674,709 | L900（v3.8） | `L893 ### 沿用/复活的冻结名` | 已引用 |  |
| RealAccountFacts | PascalCase | 2 | 231,892 | L1386（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RealAuthServicePort | PascalCase | 3 | 231,252,874 | L1387（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RealCommitRelayPort | PascalCase | 3 | 232,874,874 | L1365（v3.16） | `L1363 ## 名库 v3.16 附录 · VERDICT-376~390 B2.5a 冻结 + B2.5b …` | 已引用 |  |
| RealityPause | PascalCase | 14 | 29,211,216,218,220…共14处 | L153（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RealServiceBuilder | PascalCase | 2 | 253,892 | L1389（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RealServiceContracts | PascalCase | 1 | 931 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| RealSharedServiceSessionAdapter | PascalCase | 4 | 252,260,269,274 | L1771（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| RealWorldAuthorityPort | PascalCase | 3 | 232,874,874 | L1365（v3.16） | `L1363 ## 名库 v3.16 附录 · VERDICT-376~390 B2.5a 冻结 + B2.5b …` | 已引用 |  |
| RecallCount | PascalCase | 7 | 194,198,693,697,724…共7处 | L31（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RegisteredCredential | PascalCase | 2 | 883,913 | L1372（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RelayCursor | PascalCase | 2 | 237,922 | L1410（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| RelayGenerationChanged | PascalCase | 2 | 271,922 | L1550（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| RelaySettlementSeal | PascalCase | 2 | 237,916 | L1485（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| ReplayChart | PascalCase | 2 | 697,736 | L1056（v3.10） | `L1055 ### 意图扩展（PlayerIntent 新增三种仅含选择 ID 的变体）` | 已引用 |  |
| ReplayTrace | PascalCase | 2 | 697,736 | L1056（v3.10） | `L1055 ### 意图扩展（PlayerIntent 新增三种仅含选择 ID 的变体）` | 已引用 |  |
| RestrictedWrite | PascalCase | 3 | 237,904,904 | L113（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RetentionExpired | PascalCase | 2 | 271,922 | L1550（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| RevertedEdit | PascalCase | 1 | 907 | L91（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RouteSignature | PascalCase | 3 | 183,667,668 | L43（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SafePoint | PascalCase | 4 | 220,813,844,856 | L77（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SameSite | PascalCase | 2 | 231,886 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| SceneBuilder | PascalCase | 3 | 253,615,892 | L760（v3.5） | `L759 ### 新增命名` | 已引用 |  |
| SequenceExhausted | PascalCase | 1 | 901 | L1559（v3.17） | `L1519 ### B 类 · 已冻结字段值域与契约常量` | 已引用 |  |
| SharedAppendedAt | PascalCase | 1 | 904 | L1454（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| SharedAuthorityPayload | PascalCase | 2 | 244,931 | L1674（v3.18） | `L1669 ### B 类 · codec 辅助类型（4 项，本轮冻结）` | 已引用 |  |
| SharedCanonicalBytes | PascalCase | 3 | 244,928,934 | L1598（v3.18） | `L1596 ## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（…` | 已引用 |  |
| SharedCommitCodec | PascalCase | 3 | 244,928,934 | L1598（v3.18） | `L1596 ## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（…` | 已引用 |  |
| SharedCommitContracts | PascalCase | 3 | 244,928,931 | L1598（v3.18） | `L1596 ## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（…` | 已引用 |  |
| SharedCommitValidator | PascalCase | 5 | 244,269,272,928,937 | L1598（v3.18） | `L1596 ## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（…` | 已引用 |  |
| SharedCryptoPort | PascalCase | 2 | 244,937 | L1649（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedProvisionalCoverageEntry | PascalCase | 1 | 946 | L1699（v3.18） | `L1693 ### D 类 · reducer 本地类型（4 项，本轮冻结）` | 已引用 |  |
| SharedRelayPrototypeBuilder | PascalCase | 2 | 253,260 | L1774（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| SharedReplayDiagnostic | PascalCase | 1 | 946 | L1698（v3.18） | `L1693 ### D 类 · reducer 本地类型（4 项，本轮冻结）` | 已引用 |  |
| SharedReplayRequest | PascalCase | 1 | 946 | L1667（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedReplayResult | PascalCase | 1 | 946 | L1667（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedSchemaError | PascalCase | 1 | 934 | L1622（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedSchemaErrorCode | PascalCase | 2 | 244,931 | L1624（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedSchemaKind | PascalCase | 2 | 244,931 | L1639（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedSchemaMap | PascalCase | 2 | 244,931 | L1598（v3.18） | `L1596 ## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（…` | 已引用 |  |
| SharedValidationContext | PascalCase | 2 | 244,937 | L1649（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedValidationResult | PascalCase | 2 | 269,937 | L1658（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| SharedWorldReducer | PascalCase | 3 | 244,928,946 | L1598（v3.18） | `L1596 ## 名库 v3.18 附录 · VERDICT-411~425 B2.5c-1 契约与确定性重放（…` | 已引用 |  |
| SingleWriter | PascalCase | 1 | 904 | L89（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SphereCrossing | PascalCase | 4 | 179,659,694,733 | L55（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SYNC_TOLERANCE_MS | UPPER_SNAKE | 4 | 404,439,1116,1117 | L670（v3.2） | `L664 ### 正式修订` | 已引用 |  |
| SyncVerificationRecord | PascalCase | 3 | 1120,1135,1137 | L249（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TimedGuidanceLine | PascalCase | 1 | 1025 | L592（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| TimeTooLate | PascalCase | 1 | 919 | L1460（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| ToggleChartPause | PascalCase | 1 | 437 | L393（v2.5） | `L392 ### VERDICT-125 暂停与恢复` | 已引用 |  |
| TraceTouch | PascalCase | 7 | 237,240,247,904,912…共7处 | L71（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TraceTouchAggregate | PascalCase | 1 | 913 | L1482（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| TraeAuthorized | PascalCase | 2 | 841,871 | L1360（v3.15） | `L1357 ### 证据边界与后续` | 已引用 |  |
| TrailColor | PascalCase | 1 | 525 | L51（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TypeScript | PascalCase | 3 | 71,238,251 | L1427（v3.17） | `L1425 ## 名库 v3.17 附录 · VERDICT-391~410 P3 共享契约补冻（纯文档冻结）` | 已引用 |  |
| UnknownExternal | PascalCase | 1 | 871 | L1360（v3.15） | `L1357 ### 证据边界与后续` | 已引用 |  |
| WeakSet | PascalCase | 2 | 245,937 | L1076（v3.10） | `L1074 ### 沿用结构的增量` | 已引用 |  |
| WorldAppendPermit | PascalCase | 2 | 237,904 | L1456（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| WorldChangeClass | PascalCase | 1 | 904 | L1434（v3.17） | `L1429 ### 历史沿用与新旧格式边界` | 已引用 |  |
| WorldChangeLogWire | PascalCase | 2 | 237,916 | L1484（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| WorldClearRecord | PascalCase | 7 | 665,683,733,736,787…共7处 | L37（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldCommit | PascalCase | 2 | 913,922 | L61（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldCommitIdentity | PascalCase | 2 | 237,901 | L1410（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| WorldCommitRejection | PascalCase | 1 | 919 | L1460（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| WorldDeveloper | PascalCase | 4 | 751,907,907,910 | L73（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldDeveloperClosureFact | PascalCase | 1 | 907 | L1462（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| WorldDeveloperTrustAnchor | PascalCase | 1 | 913 | L1497（v3.17） | `L1495 #### A 类 · 成员与群 key 命名边界` | 已引用 |  |
| WorldFolderBuilder | PascalCase | 3 | 253,598,892 | L639（v3.1） | `L623 ### 领域名称` | 已引用 |  |
| WorldFork | PascalCase | 8 | 23,175,189,194,199…共8处 | L47（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldHomeRegistry | PascalCase | 6 | 209,210,748,751,844…共6处 | L1149（v3.12） | `L1147 ### 历史名补登与职责澄清` | 已引用 |  |
| WorldMeter | PascalCase | 14 | 310,388,390,392,396…共14处 | L63（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldMigration | PascalCase | 6 | 29,211,216,218,220…共6处 | L887（v3.7） | `L886 ### 明确不新增（B2.3 或更后）` | 已引用 |  |
| WorldMigrationJournal | PascalCase | 3 | 220,832,916 | L1178（v3.12） | `L1176 ### c/d 实施时再冻结` | 已引用 |  |
| WorldObserver | PascalCase | 3 | 907,910,922 | L61（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldRegistry | PascalCase | 8 | 175,189,205,221,227…共8处 | L47（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldRelayKey | PascalCase | 3 | 237,909,910 | L1410（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| WorldRelayKeyAcceptance | PascalCase | 1 | 913 | L1511（v3.17） | `L1495 #### A 类 · 成员与群 key 命名边界` | 已引用 |  |
| WorldRelayKeyPackage | PascalCase | 1 | 913 | L1510（v3.17） | `L1495 #### A 类 · 成员与群 key 命名边界` | 已引用 |  |

## 2. 全量扫描：其余标识符（141 项）

| 名称 | 类别 | stage-1 次数 | stage-1 出现行（前5） | NAMEBOOK 首现（行/版本） | 首现所属小节 | 判定 | 备注 |
|---|---|---|---|---|---|---|---|
| AccountFacts | PascalCase | 1 | 231 | L1381（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| AccountMilestoneReader | PascalCase | 1 | 784 | L834（v3.7） | `L830 ### 领域类型` | 已引用 |  |
| AlreadyHomed | PascalCase | 1 | 757 | L1166（v3.12） | `L1164 ### 判别值` | 已引用 |  |
| AudioContext | PascalCase | 1 | 592 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| AudioTrack | PascalCase | 1 | 153 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| AuthAdapter | PascalCase | 1 | 252 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| AuthorityUnavailable | PascalCase | 1 | 781 | L860（v3.7） | `L855 ### 判别值` | 已引用 |  |
| BugShore | PascalCase | 3 | 205,703,721 | L145（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| CameraRig | PascalCase | 2 | 1092,1092 | L251（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ChapterTag | PascalCase | 2 | 551,551 | L123（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ChartPremiere | PascalCase | 2 | 594,622 | L97（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ChartRef | PascalCase | 6 | 185,185,549,619,622…共6处 | L97（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ChartReplayIgnored | PascalCase | 1 | 697 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| ChartResourcePath | PascalCase | 1 | 615 | L760（v3.5） | `L759 ### 新增命名` | 已引用 |  |
| ChartScore | PascalCase | 4 | 194,198,711,724 | L97（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ChartScoreRecord | PascalCase | 1 | 712 | L1039（v3.10） | `L1036 ### 新增公开名称（按归属）` | 已引用 |  |
| CleanupPending | PascalCase | 1 | 832 | L1328（v3.14） | `L1314 ### key、锁与判别值` | 已引用 |  |
| CloudProvider | PascalCase | 2 | 706,706 | L95（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ContractOracle | PascalCase | 1 | 263 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| DeepTraceRevealSequence | PascalCase | 2 | 313,498 | L333（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| DEPTH_RANGE_WM | UPPER_SNAKE | 4 | 406,424,426,426 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| DeveloperRoster | PascalCase | 1 | 906 | L111（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| DeviceAccountBinding | PascalCase | 2 | 220,829 | L1178（v3.12） | `L1176 ### c/d 实施时再冻结` | 已引用 |  |
| EmptyWorld | PascalCase | 1 | 754 | L796（v3.6） | `L795 ### 意图判别值` | 已引用 |  |
| EnterWorldChart | PascalCase | 1 | 730 | L930（v3.8） | `L918 ### 最小内容生产者追加命名（VERDICT-240 授权后落地）` | 已引用 |  |
| EventDistance | PascalCase | 2 | 187,680 | L63（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| EventSpaceCenter | PascalCase | 2 | 187,680 | L33（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ExcludedWorld | PascalCase | 1 | 748 | L1167（v3.12） | `L1164 ### 判别值` | 已引用 |  |
| ExposurePulse | PascalCase | 1 | 313 | L333（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| FileCarryPayload | PascalCase | 4 | 175,189,199,205 | L836（v3.7） | `L830 ### 领域类型` | 已引用 |  |
| FinalShore | PascalCase | 2 | 703,721 | L145（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| FORGET_DISTANCE_WM | UPPER_SNAKE | 1 | 480 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| ForkWorldClearSession | PascalCase | 1 | 730 | L1093（v3.11） | `L1090 ### 新增公开名称（12 个顶层公开导出，按归属）` | 已引用 |  |
| FrameDriver | PascalCase | 3 | 311,1091,1091 | L251（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| GOOD_WINDOW_MS | UPPER_SNAKE | 1 | 435 | L378（v2.5） | `L374 ### VERDICT-123 Note 与判定` | 已引用 |  |
| GRAVITY_WM_PER_SECONDS_SQUARED | UPPER_SNAKE | 1 | 409 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| GuidanceChart | PascalCase | 3 | 181,511,1021 | L428（v2.6） | `L427 ### 引导线结构` | 已引用 |  |
| GuidanceEditor | PascalCase | 1 | 137 | L642（v3.1） | `L641 ### 编辑器目录 ID（15 项）` | 已引用 |  |
| GuidanceEditorBuilder | PascalCase | 1 | 372 | L596（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| GuidanceEditorIntent | PascalCase | 1 | 370 | L590（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| GuidanceEditorPort | PascalCase | 1 | 370 | L591（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| GuidanceEditorReader | PascalCase | 1 | 370 | L589（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| GuidanceEditorSession | PascalCase | 2 | 594,598 | L588（v3.0） | `L580 ### 领域类型（16 个）` | 已引用 |  |
| GuideOpacity | PascalCase | 1 | 416 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| GuideTransparency | PascalCase | 2 | 398,416 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| InfluenceRadius | PascalCase | 1 | 1003 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| InputCollector | PascalCase | 2 | 1093,1093 | L251（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| JUMP_INITIAL_SPEED_WM_PER_SECONDS | UPPER_SNAKE | 1 | 408 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| KeyPackage | PascalCase | 1 | 237 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| LineEraseEffect | PascalCase | 1 | 594 | L438（v2.6） | `L427 ### 引导线结构` | 已引用 |  |
| LocalProvider | PascalCase | 1 | 706 | L95（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| MapCenter | PascalCase | 4 | 406,426,426,427 | L63（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| MidiTrackEditor | PascalCase | 2 | 137,598 | L642（v3.1） | `L641 ### 编辑器目录 ID（15 项）` | 已引用 |  |
| MigrationAuthorityPort | PascalCase | 1 | 811 | L1290（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| MigrationClaimRequest | PascalCase | 1 | 823 | L1284（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| MigrationReceipt | PascalCase | 1 | 823 | L1288（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| MigrationReleaseRequest | PascalCase | 1 | 823 | L1178（v3.12） | `L1176 ### c/d 实施时再冻结` | 已引用 |  |
| MoveNotes | PascalCase | 1 | 606 | L729（v3.4） | `L728 ### 新意图判别值` | 已引用 |  |
| MusicEditor | PascalCase | 1 | 137 | L642（v3.1） | `L641 ### 编辑器目录 ID（15 项）` | 已引用 |  |
| MusicEditorBuilder | PascalCase | 1 | 376 | L698（v3.3） | `L688 ### 领域类型` | 已引用 |  |
| MusicEditorIntent | PascalCase | 1 | 376 | L694（v3.3） | `L688 ### 领域类型` | 已引用 |  |
| MusicEditorPort | PascalCase | 1 | 376 | L694（v3.3） | `L688 ### 领域类型` | 已引用 |  |
| MusicEditorReader | PascalCase | 1 | 376 | L694（v3.3） | `L688 ### 领域类型` | 已引用 |  |
| NarrativeDimension | PascalCase | 1 | 1009 | L239（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| NarrativeTime | PascalCase | 1 | 1001 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| NotApplicable | PascalCase | 1 | 703 | L1065（v3.10） | `L1061 ### 数据结构冻结（schemaVersion=1）` | 已引用 |  |
| NotImplemented | PascalCase | 1 | 652 | L842（v3.7） | `L830 ### 领域类型` | 已引用 |  |
| NumLock | PascalCase | 1 | 485 | L345（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| OFFLINE_GRACE_HOURS | UPPER_SNAKE | 2 | 220,826 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| OfflineTimeProof | PascalCase | 1 | 240 | L1592（v3.17） | `L1587 ### D 类 · 延期区` | 未注册（仅候选/延期/排除区） | 出现均位于候选/未冻结/延期/排除类小节，未入冻结表 |
| OutputValidation | PascalCase | 1 | 706 | L1064（v3.10） | `L1061 ### 数据结构冻结（schemaVersion=1）` | 已引用 |  |
| PauseActive | PascalCase | 3 | 220,823,832 | L1273（v3.14） | `L1269 ### 历史名与语义补登` | 已引用 |  |
| PendingWorldFork | PascalCase | 1 | 739 | L1106（v3.11） | `L1098 ### 数据结构` | 已引用 |  |
| PlayerEmpathy | PascalCase | 2 | 1005,1112 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| PlayerIntent | PascalCase | 4 | 187,1093,1094,1094 | L253（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| PuzzleProgress | PascalCase | 6 | 193,198,490,494,688…共6处 | L7（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RealAccountFact | PascalCase | 1 | 231 | L1376（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RealAuthServiceAdapter | PascalCase | 1 | 231 | L1388（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RealCommitRelayAdapter | PascalCase | 2 | 260,269 | L1770（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| RealityHint | PascalCase | 1 | 706 | L45（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RealityPauseRecord | PascalCase | 1 | 826 | L1178（v3.12） | `L1176 ### c/d 实施时再冻结` | 已引用 |  |
| RealRegisteredDeviceFact | PascalCase | 1 | 231 | L1377（v3.16） | `L1367 ### 已冻结并用于 b 源码` | 已引用 |  |
| RealWorldAuthorityAdapter | PascalCase | 1 | 260 | L1769（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| RecallCountSession | PascalCase | 1 | 694 | L1037（v3.10） | `L1036 ### 新增公开名称（按归属）` | 已引用 |  |
| RecallEvent | PascalCase | 1 | 694 | L1056（v3.10） | `L1055 ### 意图扩展（PlayerIntent 新增三种仅含选择 ID 的变体）` | 已引用 |  |
| RegisteredAuthorSigningPort | PascalCase | 1 | 252 | L1792（v3.19） | `L1787 ### A 类 · 已冻结 · 增量类型` | 已引用 |  |
| RelayCommitEnvelope | PascalCase | 1 | 237 | L1410（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| RelayPullReply | PascalCase | 1 | 237 | L1410（v3.16） | `L1404 ### 候选区（c/d/e，未冻结）` | 已引用 |  |
| RelayRoute | PascalCase | 2 | 260,269 | L1777（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| RelayService | PascalCase | 2 | 260,269 | L1776（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| RelayStorage | PascalCase | 2 | 260,269 | L1776（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| RestrictedCoreTransfer | PascalCase | 1 | 778 | L1204（v3.13） | `L1203 ### 本轮冻结的 director 公开名称（src/director/CoreTransfer.…` | 已引用 |  |
| RestrictedMigrationCorePayload | PascalCase | 1 | 832 | L1287（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| RetryWorldClear | PascalCase | 1 | 730 | L930（v3.8） | `L918 ### 最小内容生产者追加命名（VERDICT-240 授权后落地）` | 已引用 |  |
| RHYTHM_STRIKE_WINDOW_MS | UPPER_SNAKE | 2 | 411,484 | L410（v2.5） | `L404 ### T7 已冻结的其他名称（承接 v2.4 及之前）` | 已引用 |  |
| RhythmStrike | PascalCase | 2 | 484,491 | L331（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| RouteCoverage | PascalCase | 1 | 671 | L43（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SafePointDrainConfirmation | PascalCase | 1 | 814 | L1279（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| SafePointDrainPort | PascalCase | 1 | 817 | L1282（v3.14） | `L1277 ### 领域导出名（src/director/WorldMigration.ts，逻辑层零 cc）` | 已引用 |  |
| ScaleRef | PascalCase | 1 | 388 | L63（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| ScreenInvertRipple | PascalCase | 2 | 313,498 | L333（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SettleHorizon | PascalCase | 1 | 918 | L75（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| SharedBuild | PascalCase | 1 | 260 | L1880（v3.20） | `L1862 ### A 类 · 已冻结的实现名与归属` | 已引用 |  |
| SharedServiceProtocolCodec | PascalCase | 1 | 260 | L1867（v3.20） | `L1862 ### A 类 · 已冻结的实现名与归属` | 已引用 |  |
| SharedServiceProtocolContracts | PascalCase | 1 | 260 | L1766（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| SharedServiceSessionPort | PascalCase | 1 | 252 | L1792（v3.19） | `L1787 ### A 类 · 已冻结 · 增量类型` | 已引用 |  |
| SharedTlsEdge | PascalCase | 1 | 252 | L1781（v3.19） | `L1762 ### A 类 · 已冻结 · 类 / 模块与正式归属` | 已引用 |  |
| T6_ENDPOINT_PLACEHOLDER | UPPER_SNAKE | 2 | 674,697 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| T6_MAIN_DEEP_TRACE | UPPER_SNAKE | 1 | 697 | L1015（v3.9） | `L1013 ### 正式内容索引` | 已引用 |  |
| T7_COMPLETION_PLACEHOLDER | UPPER_SNAKE | 1 | 674 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| TemplateProvider | PascalCase | 2 | 706,706 | L95（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TraceProximityVolume | PascalCase | 1 | 484 | L331（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TraceTier | PascalCase | 2 | 313,498 | L11（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TrailLength | PascalCase | 1 | 396 | L51（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| TrailRenderer | PascalCase | 1 | 418 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| TruthLevel | PascalCase | 1 | 999 | L239（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| UnsupportedBoundary | PascalCase | 2 | 715,781 | L860（v3.7） | `L855 ### 判别值` | 已引用 |  |
| ValidatedSharedCommit | PascalCase | 1 | 269 | L1654（v3.18） | `L1620 ### A 类 · 本轮正式冻结实现类（5 项）` | 已引用 |  |
| VectorSchemaVersion | PascalCase | 1 | 1013 | L239（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| VideoPlayer | PascalCase | 1 | 77 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| ViewDistance | PascalCase | 1 | 394 | L63（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WebLocks | PascalCase | 1 | 832 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| WebSynth | PascalCase | 1 | 153 | L0（） | `` | 未注册 | 名库全文无同形条目 |
| WorldBossChart | PascalCase | 3 | 181,661,683 | L41（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldChangeLog | PascalCase | 1 | 915 | L61（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldCheckpointWire | PascalCase | 1 | 237 | L1487（v3.17） | `L1447 ### A 类 · 已冻结的新增契约类型名` | 已引用 |  |
| WorldClearSession | PascalCase | 1 | 730 | L908（v3.8） | `L905 ### 新增命名` | 已引用 |  |
| WorldClearStorage | PascalCase | 1 | 733 | L909（v3.8） | `L905 ### 新增命名` | 已引用 |  |
| WorldFolderView | PascalCase | 2 | 133,139 | L624（v3.1） | `L623 ### 领域名称` | 已引用 |  |
| WorldForkAvailability | PascalCase | 1 | 652 | L842（v3.7） | `L830 ### 领域类型` | 已引用 |  |
| WorldForkOrigin | PascalCase | 2 | 726,727 | L1091（v3.11） | `L1090 ### 新增公开名称（12 个顶层公开导出，按归属）` | 已引用 |  |
| WorldForkSession | PascalCase | 1 | 718 | L1092（v3.11） | `L1090 ### 新增公开名称（12 个顶层公开导出，按归属）` | 已引用 |  |
| WorldForkStorage | PascalCase | 1 | 739 | L1094（v3.11） | `L1090 ### 新增公开名称（12 个顶层公开导出，按归属）` | 已引用 |  |
| WorldLink | PascalCase | 4 | 194,198,702,724 | L3（（名库前置正文）） | `（名库起始正文）` | 已引用 |  |
| WorldLinkSnapshot | PascalCase | 1 | 703 | L1038（v3.10） | `L1036 ### 新增公开名称（按归属）` | 已引用 |  |
| WorldMigrationContractAdapter | PascalCase | 1 | 811 | L1306（v3.14） | `L1299 ### 平台与组合根导出名` | 已引用 |  |
| WorldObserverAdmissionFact | PascalCase | 1 | 237 | L1503（v3.17） | `L1495 #### A 类 · 成员与群 key 命名边界` | 已引用 |  |
| WorldState | PascalCase | 1 | 194 | L969（v3.8） | `L967 ### 保持` | 已引用 |  |
| WorldStateCodec | PascalCase | 2 | 715,721 | L988（v3.9） | `L980 ### 新增命名` | 已引用 |  |
| WorldStatePreparedRestore | PascalCase | 1 | 715 | L1043（v3.10） | `L1036 ### 新增公开名称（按归属）` | 已引用 |  |
| WorldStateSnapshot | PascalCase | 3 | 647,677,715 | L836（v3.7） | `L830 ### 领域类型` | 已引用 |  |

## 3. B2.5c-2c 章节专项核对（× v3.21 附录）

stage-1 中 B2.5c-2c 章节位于 L267–L279；章节内出现的全部标识符逐名核对是否出现在 v3.21 附录（名库 L1959–L2016）：

| 名称 | stage-1 出现位置 | NAMEBOOK 出处 | 判定 | 备注 |
|---|---|---|---|---|
| ExternalService | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1371，v3.16） |
| HostFailure | stage-1 L267 | v3.21 附录未出现同形条目 | 未注册（v3.21 附录无） | 名库全文有同形（首现 L1665，v3.18） |
| IntentPort | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L253，（名库前置正文）） |
| MissingAdmittedEnvelope | stage-1 L267 | v3.21 附录未出现同形条目 | 未注册（v3.21 附录无） | 名库全文有同形（首现 L1550，v3.17） |
| RealCommitRelayAdapter | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1770，v3.19） |
| RealSharedServiceSessionAdapter | stage-1 L267 | v3.21 附录未出现同形条目 | 未注册（v3.21 附录无） | 名库全文有同形（首现 L1771，v3.19） |
| RelayGenerationChanged | stage-1 L267 | v3.21 附录未出现同形条目 | 未注册（v3.21 附录无） | 名库全文有同形（首现 L1550，v3.17） |
| RelayRoute | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1777，v3.19） |
| RelayService | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1776，v3.19） |
| RelayStorage | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1776，v3.19） |
| RetentionExpired | stage-1 L267 | v3.21 附录未出现同形条目 | 未注册（v3.21 附录无） | 名库全文有同形（首现 L1550，v3.17） |
| SharedCommitValidator | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1598，v3.18） |
| SharedValidationResult | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1658，v3.18） |
| ValidatedSharedCommit | stage-1 L267 | v3.21 附录（名库 L1959–L2016） | 已引用（v3.21） | 名库全文有同形（首现 L1654，v3.18） |

## 4. 汇总统计

- 提取标识符总数：287（重点 146 + 全量其余 141）。
- 判定分布：已引用 259；未注册（含仅候选/延期/排除区）28；版本过旧（仅废止语境）0。
- B2.5c-2c 专项：章节标识符 14 项，其中 v3.21 附录可追溯 9 项、未注册 5 项。
- 未注册明细见上表判定列；名库无同形条目属机械事实，是否构成问题由 PROTOCOL 判定。
