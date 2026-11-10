# 审计报告 · stage-1 未注册名二次核对（宽松匹配）

- 生成时间：2026-10-11 12:40:58 UTC
- 输入 1（上轮报告）：`quality-review/b2-5c-2c/audits/stage-1-namebook-consistency.md`（42643 字节，SHA256 `19011bfa555826353f206c5897fecca0f1fd73956fdf91a0fccb61f38a4e3066`）
- 输入 2：`docs/NAMEBOOK.md`（178559 字节，SHA256 `398ed2e5ae2581094708fd5edbef958e9fca20a3cbccbc79f1a8cf7d9d381dac`，共 2016 行）
- 输入 3：`docs/spec/stage-1.md`（108712 字节，SHA256 `c4e9a3090bc96d2204e57401b57f788b448386d822ada7edae6874c68ac63fce`）
- 提取：自上轮报告 §1/§2 提取判定含"未注册"的行 28 项、§3 专项提取 5 项，合计 33 项。
- 宽松匹配规则（本轮专用，依序尝试，命中即止）：①严格同形；②反引号内含 N；③转义下划线（如 `FORGET\_DISTANCE\_WM`）；④分组条目内嵌（剔除「、，,；;（）「」引号/斜杠/空白」后整行包含 N）；⑤大小写不敏感同形；⑥语义等价候选（名库标识符形态词元中与 N 首字母相同、编辑距离 ≤3 者）。
- 判定映射：命中规则 1~5 → 假阳性（规则 X）；仅命中规则 6 → 边界案例（语义等价为启发式，需 PROTOCOL 裁定）；全部未命中 → 真遗漏。

## 1. 主清单明细（28 项，按名称字典序）

| 名字 | 类别/来源（stage-1 出处） | 严格匹配 | 宽松匹配 | 命中的 NAMEBOOK 条目（版本 + 行号/摘录） | 判定 |
|---|---|---|---|---|---|
| AudioContext | PascalCase（§2 全量，stage-1 L592） | 无 | 无 | — | 真遗漏 |
| AudioTrack | PascalCase（§2 全量，stage-1 L153） | 无 | 无 | — | 真遗漏 |
| AuthAdapter | PascalCase（§2 全量，stage-1 L252） | 无 | 规则4 命中 | L1771（v3.19）：\\| RealSharedServiceSessionAdapter \\| src/presentation/RealSharedService… | 假阳性（规则4） |
| ChartPlaybackResult | PascalCase（§1 重点，stage-1 L709） | 无 | 无 | — | 真遗漏 |
| ChartReplayIgnored | PascalCase（§2 全量，stage-1 L697） | 无 | 无 | — | 真遗漏 |
| ContractOracle | PascalCase（§2 全量，stage-1 L263） | 无 | 无 | — | 真遗漏 |
| DEPTH_RANGE_WM | UPPER_SNAKE（§2 全量，stage-1 L406,424,426,426） | 无 | 规则3 命中 | L271（（名库前置正文））：纵深语义	DEPTH\_RANGE\_WM 表示总跨度（非单侧距离）；裁剪以 MapCenter 为基准，两侧各 ±半个总跨度；必须计入中点… | 假阳性（规则3） |
| FORGET_DISTANCE_WM | UPPER_SNAKE（§2 全量，stage-1 L480） | 无 | 规则3 命中 | L315（（名库前置正文））：内部占位常量	GROUND\_TOLERANCE\_WM = 0.05、TRIGGER\_DISTANCE\_WM = 2、FORGET\_… | 假阳性（规则3） |
| GRAVITY_WM_PER_SECONDS_SQUARED | UPPER_SNAKE（§2 全量，stage-1 L409） | 无 | 规则3 命中 | L281（（名库前置正文））：跳跃常量	JUMP\_INITIAL\_SPEED\_WM\_PER\_SECONDS、GRAVITY\_WM\_PER\_SECONDS\… | 假阳性（规则3） |
| GuideOpacity | PascalCase（§2 全量，stage-1 L416） | 无 | 无 | — | 真遗漏 |
| GuideTransparency | PascalCase（§2 全量，stage-1 L398,416） | 无 | 规则5 命中 | L1067（v3.10）：- ChartSnapshotRecord：chartId / ChartRef.state=PremiereCompleted / com…；大小写变体：guideTransparency | 假阳性（规则5） |
| HomeRevision | PascalCase（§1 重点，stage-1 L847,847） | 无 | 规则4 命中 | L1204（v3.13）：- CoreTransferPayload：schemaVersion=1、kind=RestrictedCoreTransfer、tran… | 假阳性（规则4） |
| HttpOnly | PascalCase（§1 重点，stage-1 L231,886） | 无 | 规则4 命中 | L1384（v3.16）：\\| ServiceAuthenticationPayload \\| 会话/CSRF/身份/过期签名载荷 \\| 不含访问或刷新token，toke… | 假阳性（规则4） |
| InfluenceRadius | PascalCase（§2 全量，stage-1 L1003） | 无 | 无 | — | 真遗漏 |
| JUMP_INITIAL_SPEED_WM_PER_SECONDS | UPPER_SNAKE（§2 全量，stage-1 L408） | 无 | 规则3 命中 | L281（（名库前置正文））：跳跃常量	JUMP\_INITIAL\_SPEED\_WM\_PER\_SECONDS、GRAVITY\_WM\_PER\_SECONDS\… | 假阳性（规则3） |
| KeyPackage | PascalCase（§2 全量，stage-1 L237） | 无 | 规则4 命中 | L1509（v3.17）：\\| WorldRelayKeyPackageContext \\| `schemaVersion`、`serviceInstanceId`、`w… | 假阳性（规则4） |
| NarrativeTime | PascalCase（§2 全量，stage-1 L1001） | 无 | 规则5 命中 | L946（v3.8）：- RouteSignature：VectorSchemaVersion=1 / ledgerPosition / classificati…；大小写变体：narrativeTime | 假阳性（规则5） |
| OFFLINE_GRACE_HOURS | UPPER_SNAKE（§2 全量，stage-1 L220,826） | 无 | 规则3 命中 | L223（（名库前置正文））：世界与时间 WorldThemeColor（世界主题色，WorldInstance 的字段）、WallClock（时间结构 { epochM… | 假阳性（规则3） |
| OfflineTimeProof | PascalCase（§2 全量，stage-1 L240） | 有（L1592，共2处） | 规则1 命中 | L1592（v3.17）：- 原生 OfflineTimeProof / OfflineAuthorPermit 等类型：候选而非授权能力；P5 明确 boot/up… | 假阳性（规则1） |
| PlayerEmpathy | PascalCase（§2 全量，stage-1 L1005,1112） | 无 | 无 | — | 真遗漏 |
| RealServiceContracts | PascalCase（§1 重点，stage-1 L931） | 无 | 规则4 命中 | L1391（v3.16）：RealServiceContracts为新增director文件名；IntentPort只追加上述类型的type-only导出。serve… | 假阳性（规则4） |
| SameSite | PascalCase（§1 重点，stage-1 L231,886） | 无 | 无 | — | 真遗漏 |
| T6_ENDPOINT_PLACEHOLDER | UPPER_SNAKE（§2 全量，stage-1 L674,697） | 无 | 无 | — | 真遗漏 |
| T7_COMPLETION_PLACEHOLDER | UPPER_SNAKE（§2 全量，stage-1 L674） | 无 | 无 | — | 真遗漏 |
| TrailRenderer | PascalCase（§2 全量，stage-1 L418） | 无 | 规则6 命中 | TrailRender（差异 2 字符） | 边界案例（需 PROTOCOL 裁定） |
| VideoPlayer | PascalCase（§2 全量，stage-1 L77） | 无 | 无 | — | 真遗漏 |
| WebLocks | PascalCase（§2 全量，stage-1 L832） | 无 | 规则4 命中 | L1263（v3.13）：- 沿用 INV-10/12/13、活动状态 UnsupportedBoundary、七项主 key、目录追加唯一本地发布点、持真实 lea… | 假阳性（规则4） |
| WebSynth | PascalCase（§2 全量，stage-1 L153） | 无 | 无 | — | 真遗漏 |

## 2. 专项明细（5 项，上轮 §3 判"v3.21 附录未登记"者）

| 名字 | stage-1 出处 | 严格匹配 | 宽松匹配 | 命中的 NAMEBOOK 条目 | 判定 |
|---|---|---|---|---|
| HostFailure | stage-1 L267 | 有（L1665，共3处） | 规则1 命中 | L1665（v3.18）：`owns*` 依赖本实例私有 WeakSet；类型断言、结构对象、复制或从文件恢复的值均不能获得能力。已 admitted 来源完备而正文… | 假阳性（规则1，v3.21 附录未登记但名库其他版本已有） |
| MissingAdmittedEnvelope | stage-1 L267 | 有（L1550，共1处） | 规则1 命中 | L1550（v3.17）：\\| Gap.reason \\| RetentionExpired / RelayGenerationChanged / MissingAdmi… | 假阳性（规则1，v3.21 附录未登记但名库其他版本已有） |
| RealSharedServiceSessionAdapter | stage-1 L267 | 有（L1771，共4处） | 规则1 命中 | L1771（v3.19）：\\| RealSharedServiceSessionAdapter \\| src/presentation/RealSharedService… | 假阳性（规则1，v3.21 附录未登记但名库其他版本已有） |
| RelayGenerationChanged | stage-1 L267 | 有（L1550，共1处） | 规则1 命中 | L1550（v3.17）：\\| Gap.reason \\| RetentionExpired / RelayGenerationChanged / MissingAdmi… | 假阳性（规则1，v3.21 附录未登记但名库其他版本已有） |
| RetentionExpired | stage-1 L267 | 有（L1550，共1处） | 规则1 命中 | L1550（v3.17）：\\| Gap.reason \\| RetentionExpired / RelayGenerationChanged / MissingAdmi… | 假阳性（规则1，v3.21 附录未登记但名库其他版本已有） |

## 3. 汇总统计

- 合计 33 项：真遗漏 13、假阳性 19、边界案例 1。

## 附录 A：真遗漏清单（供 PROTOCOL 判断是否补正 NAMEBOOK 或 stage-1）

- AudioContext
- AudioTrack
- ChartPlaybackResult
- ChartReplayIgnored
- ContractOracle
- GuideOpacity
- InfluenceRadius
- PlayerEmpathy
- SameSite
- T6_ENDPOINT_PLACEHOLDER
- T7_COMPLETION_PLACEHOLDER
- VideoPlayer
- WebSynth

## 附录 B：边界案例清单

- TrailRenderer：仅规则6命中（TrailRender（差异 2 字符）），语义等价无法机械确认

方法说明：本核对为纯机械匹配；规则 4 的整行剔除分隔符包含匹配、规则 6 的编辑距离匹配均为本轮授权的宽松口径，其命中本质仍可能是巧合相似，已分别以"假阳性（规则 X）"/"边界案例"区分。本报告不含修复建议。
