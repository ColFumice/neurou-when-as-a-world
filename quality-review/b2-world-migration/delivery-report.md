# B2.4d 交付报告 · WorldMigration + RealityPause

本轮已实现同账号、同 worldId 的 HomeDevice 转移、源账号主动 SafePoint 排空、服务权威冷静期与设备账号绑定，并通过下列 106 项新增 ContractAdapter 契约用例及 65 项 B2.4c 回归用例。三条静态门禁、Creator 1920×1080 / 2560×1440 双档实际运行均通过；Creator 最终结果完成于 2026-10-10T15:35:45.622Z。运行与契约验收 PASS，保护审计限制如下。

**保护审计另有未解决事项：全保护 SHA 审计为 FAIL。** `docs/NAMEBOOK.md`、`docs/spec/stage-1.md` 相对本轮基线发生变化；当前内容与 B2.4c / v3.13 落盘相符，但写入者未知，未保存原始文档字节，无法证明全部差异仅属于 c。固定允许清单未放宽，当前文档予以保留，未回退他人写入。授权源码范围为 PASS，不能据此把全保护审计改报 PASS。证据见 [保护审计](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/protected-final-audit.json) 与 [文档漂移记录](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/observed-doc-drift.json)。

最终证据主索引见 [validation-summary.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/validation-summary.json)：implementationValidationPass / evidenceIntegrityPass 均为 true，completeProtectedAuditPass 为 false；汇总 106 + 65 用例、三门禁、34 张 PNG / 33 模块编译对应及四改十二新增的 diff 源码一致性。

## 1. 正式裁定与契约

完整正式裁定见 [VERDICT-326～345](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/verdicts-326-345.md)，接口、结构、锁序及逐阶段恢复见 [迁移契约](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/migration-contract.md)。

| 裁定 | 本轮冻结结果 |
|---|---|
| 326～327 | 同 ID 迁移，独立 `MigrationAuthorityPort` / `WorldMigrationContractAdapter`；不调用 rebase、不分叉、不要求 CopyPermission，不扩大旧 b/c 首次归属契约。 |
| 328～330 | `SafePointDrainConfirmation` 覆盖源设备账号全部未删世界，含 InitialWorld / 空世界；真实 leases 与当前活动探针签发单次能力。失效立即永久撤销；服务接收确认仅有 30 秒服务时间寿命，Release 原子消费。 |
| 331～333 | Release / Claim 请求与 receipt 严格版本化；Release 同事务发布 RealityPause 和设备绑定。暂停 `max(3600000, OfflineGrace 毫秒)`，仅服务时钟判定。Released / Claim 分别将原 homeRevision 加 1 / 加 2。 |
| 334～335 | 全账号所有设备、所有世界拒绝新准入；已有活动保留必要输入与自然时序，实际安全后退场。发起设备在活动暂停中不能绑定另一账号，其他窗口 / 客户端重建仍受服务绑定约束。 |
| 336～338 | `RestrictedMigrationCorePayload` 仅七项受限 Core，重新 parseComplete 与正式引用验证。独立 journal 五阶段；独立协调锁，最终目录锁内无服务 await。 |
| 339～341 | 源 Core / 目录 / 文件原字节保留，无墓碑。服务归属权威、目标目录唯一新本地发布点；逐阶段保留 journal 恢复，不删除已发布世界伪装回滚。迁回须新事务，同值目标允许，异值 / 墓碑拒绝。 |
| 342～345 | 共享持久 ContractAdapter 服务 fixture，不接真实外部服务；无 Web Locks 明确拒绝。沿用 INV-10 / INV-12 / INV-13、七项主 key 与持 lease 才写。B2.4e 在相同受限原型范围入场。 |

排空不以“等一小时”替代源确认，也不强制结束谱面。活动演奏 / 暂停 / 重演、揭示、七秒持续期、排队入口、未结算账号事实、未恢复发布事务均不属于排空完成。非 InitialWorld、静止 Primary、七项 Complete 才可迁移；InitialWorld 始终不进入 HomeRegistry 或迁移载荷。

源锁序为：共享账号协调锁 → 按 worldId 排序的全部真实世界 leases → 账号事实锁 → 最终目录锁；最终目录同步检查完成后释放目录锁，再在前序 leases / 账号锁 / 准入关闭仍有效时请求服务。目标为：协调锁 → 目标真实 lease → 服务 Claim → 最终目录发布。ContractAdapter 权威锁不反取世界 / 目录锁。

## 2. 名库 v3.14 附录提案及新增命名

[名库 v3.14 附录提案](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/namebook-v3.14-appendix-proposal.md) 交 Trae 合入正式名库。本轮仅在 quality-review 提供交付文本，不把候选名称视为真实外部服务承诺。33 个新增导出均已逐一补登：

| 范围 | 新增导出名 |
|---|---|
| 排空领域 | `SafePointDrainWorld`、`SafePointDrainConfirmation`、`SafePointDrainCapability`、`SafePointDrainAcceptance`、`SafePointDrainPort` |
| 迁移领域 | `MigrationReleaseRequest`、`MigrationClaimRequest`、`RealityPauseRecord`、`DeviceAccountBinding`、`RestrictedMigrationCorePayload`、`MigrationReceipt`、`MigrationAdmission`、`MigrationAuthorityPort`、`WorldMigrationPhase`、`WorldMigrationEntry`、`WorldMigrationJournal`、`WorldMigrationStorageReceipt`、`MigrationCompleteValidator`、`WorldMigrationCodec` |
| 活动边界 | `RealityPauseBoundary` |
| 排空适配 | `SafePointDrainAccountFacts`、`SafePointDrainBindings`、`isLiveSafePointDrainCapability`、`SafePointDrainStorage` |
| 权威适配 | `WorldMigrationAuthorityLock`、`WorldMigrationContractBindings`、`WorldMigrationContractAdapter` |
| 本地事务 | `WorldMigrationStorageBindings`、`WorldMigrationRecoveryResult`、`WorldMigrationStorage` |
| 组合原型 | `WorldMigrationPrototypeBindings`、`WorldMigrationPrototype`、`ContractServiceClock` |

已冻结 key：`neurou-migration-v1:` + encodeURIComponent(accountId)，内部 schemaVersion 1、kind `WorldMigrationJournal`、deviceId 隔离、entries 历史留存。`neurou-reality-pause-v1:` 为诊断缓存，无准入权。新增协调锁为 `neurou-cross-device:` + encodeURIComponent(accountId)。`neurou-migration-contract-authority-v1` / `neurou-migration-authority` / `neurou-contract-service-clock-v1` 仅是 ContractAdapter fixture 的持久域、锁与时钟，未伪称正式服务协议。

完整 phase 为 `Prepared / PauseActive / Released / Claimed / LocalPublished`；本轮不使用候选 `CleanupPending`。Source 观察 Claimed 即完成，Target 到 LocalPublished 才完成。各 phase 的崩溃点与恢复规则已列在契约中。

## 3. 修改文件与 diff

[修改清单](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/change-files.json) 与 [代码 diff](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/code.diff) 共 16 个 canonical 文件：六个新增模块、六份对应 meta、四个既有文件扩展。工作区无 Git，diff 依据保存的原始源码、SHA 清单生成，可追溯到 `original-source-index.json` / `baseline-before.json` / `baseline-after.json`。

| 文件 | 变更目的 |
|---|---|
| [WorldMigration.ts](D:/Project/A_New_Begin/Neurou_official/src/director/WorldMigration.ts) | 新增迁移 / 排空 / 暂停契约、严格 codec、原值七项载荷与日志。 |
| [RealityPauseBoundary.ts](D:/Project/A_New_Begin/Neurou_official/src/director/RealityPauseBoundary.ts) | 新增新活动拒绝与既有活动自然续行策略，逻辑层零 cc。 |
| [SafePointDrainStorage.ts](D:/Project/A_New_Begin/Neurou_official/src/presentation/SafePointDrainStorage.ts) | 新增真实 leases、当前状态复查、账号事实结算和单次排空能力签发。 |
| [WorldMigrationContractAdapter.ts](D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldMigrationContractAdapter.ts) | 新增共享持久权威、服务时间、Release / Claim / binding / admission。 |
| [WorldMigrationStorage.ts](D:/Project/A_New_Begin/Neurou_official/src/presentation/WorldMigrationStorage.ts) | 新增独立 journal、同 ID 原版本 CAS、目标目录发布与故障对账。 |
| [WorldMigrationPrototype.ts](D:/Project/A_New_Begin/Neurou_official/assets/scripts/WorldMigrationPrototype.ts) | 新增 A / B 逻辑设备组合根与明确隔离的服务时钟 fixture。 |
| [IntentPort.ts](D:/Project/A_New_Begin/Neurou_official/src/director/IntentPort.ts) | 只追加擦除后的类型导出，既有逻辑前缀保持。 |
| [SceneBuilder.ts](D:/Project/A_New_Begin/Neurou_official/assets/scripts/SceneBuilder.ts) | 附加暂停意图门控、实时 SafePoint 探针、既有系统 continuation。 |
| [WorldFolderBuilder.ts](D:/Project/A_New_Begin/Neurou_official/assets/scripts/WorldFolderBuilder.ts) | 附加账号绑定 / 准入校验、迁移界面与关闭准入时的自然退场。 |
| [CrossDevicePrototype.ts](D:/Project/A_New_Begin/Neurou_official/assets/scripts/CrossDevicePrototype.ts) | 使用共享 d 权威并附加准入 / 当前归属守卫及逻辑 B 锁命名空间。 |

固定保护审计中的 frozenCore 472 路径、legacyCrossDeviceCore 16 路径、settingsScenes 19 路径均 PASS；无未授权非文档变更，junction 别名保持。旧 B2.1 / B2.2 / B2.3 / b/c codec 与事务核心、A/B/C/T6/T7/编辑器算法未改写。组合根的授权接线完整呈现在 diff 中；SHA 审计不替代组合代码语义审查。两份独立复核及一份存储作者收尾复核分别见 `peer-review-authority.md`、`peer-review-drain.md`、`peer-review-storage.md`。

## 4. 三条门禁

最终门禁证据见 [gate-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/gate-results.json)，对应日志在 `final-gates/`。当前最后记录时间为 2026-10-10T15:32:34.975Z。

| 命令 | 结果 |
|---|---|
| `npm run check:naming` | PASS，0 ERROR / 22 既有 WARN。 |
| `npm run typecheck` | PASS，exitCode 0。 |
| `npm run check:dependencies` | PASS，120 个 TS 文件、约 423 条静态依赖、0 ERROR。 |

门禁结果仅证明其各自静态检查通过；双档 Creator、契约故障和保护审计另有独立证据与状态。

## 5. 契约测试结果（全部 ContractAdapter）

| 套件 / 证据 | 结果 | 主要覆盖 |
|---|---:|---|
| [drain-contract-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/drain-contract-results.json) | 20 / 20 PASS | 真实 leases、全账号集合、活动 / 账号事实 / 在途写、单次能力、严格 schema。 |
| [boundary-contract-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/boundary-contract-results.json) | 8 / 8 PASS | 旧批次保持、当前谱面必要输入、T7 自然完成、合法结算重试、揭示与七秒续行。 |
| [authority-contract-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/authority-contract-results.json) | 32 / 32 PASS | 服务时间、全账号暂停、绑定、Release / Claim 幂等、响应丢失与持久权威。 |
| [storage-contract-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/storage-contract-results.json) | 34 / 34 PASS | 锁序、原版本保存、全部持久前缀故障、迁回 / 冲突 / 日志恢复。 |
| [prototype-contract-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/prototype-contract-results.json) | 12 / 12 PASS | 实际新增组合根、A/B 全链、重建、异步 dispose、源 Prepared 与服务域丢失。 |
| 新增合计 | **106 / 106 PASS** | 五个套件均明确为 ContractAdapter。 |
| [B2.4c 主回归](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-core/contract-results.json) | 59 / 59 PASS | C01～C28 共 28、S01～S30 共 30、E01 共 1；storage 已包含在 59 中。 |
| [B2.4c 组合回归](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-core/prototype-contract-results.json) | 6 / 6 PASS | c 组合准入、恢复、dispose、真实 lease 释放。 |

新增及 c 回归共 171 项通过，不重复累计 storage 子套件。`storage-pre-clock-seam-diagnostic.json` 是服务 fixture 时钟尚未正确推进时的历史诊断，保留供追溯，不是当前套件结果。

## 6. 验收证据逐条对应

| 用户验收项 | 对应证据 | 当前判断 |
|---|---|---|
| SafePoint 排空确认 round-trip | D01、D15～D17；A08～A13、A29～A32 | PASS；传输数据重新严格解析，运行时能力不可序列化 / 自造，首次复查失败不可复活。 |
| 全账号所有源世界主动排空，无未结算写 | D01、D03～D14；MP01、MP05；B06 | PASS；含 InitialWorld / 空世界；真实 retainUntil 账号写阻塞 lease，缺失非继承通关记录或未结算 milestone 拒绝。 |
| 不强制结束活动 | B03～B08、MP05 | PASS；实际 Director / ChartPremiere / T7 / WorldClearSession 自然续行，Explicit Exit 不制造完成，健康显式退出沿用旧行为。 |
| Release → RealityPause → Released → Claim | A01、A14～A16、A21～A23；MP01 | PASS；原 expectedHomeRevision、服务时间截止与另设备 Claim 均校验。 |
| 服务时间权威，不接受客户端时钟 | A03～A05、A19、A27；MP07 | PASS；仅独立服务 fixture 变化可结束暂停；服务持久截止写失败不能解锁。 |
| 发起设备不能切换账号，跨窗口 / 重建 | A06、A07、A26；MP03 | PASS；服务 binding 持久化，删除本地诊断缓存不解除。逻辑 deviceId 是 fixture 身份。 |
| 全账号冻结，所有设备 / 世界含 InitialWorld | A02、A04、A18；MP02；B02～B08 | PASS；关闭新世界 / 新活动准入，现有活动保留必要自然输入。 |
| 源文件不改 / 不删 / 不写墓碑 | A24；MS01、MS05～MS10、MS32、MS34；MP06 | PASS；源事实与 Core 字节保护；Migrated 是服务当前归属诊断。 |
| FormatTime / forkOrigin / revision / 七项保留 | A13、A24；MS01、MS22、MS24、MS30、MS32 | PASS；同 ID、原任意合法 revision，独立 target CAS 保留；接收端重新 parseComplete + 正式引用验证。 |
| WorldClearRecord / FirstWorldCleared 继续有效 | D08～D10、D14；A24；MS32；MP06 | PASS；同账号受信读口继续使用，载荷无账号事实，不重复写通关 / 里程碑。 |
| Prepared 崩溃及 Release 响应丢失 | A15～A16；MS05～MS10、MS34；MP12 | PASS；保留冻结载荷，查询同 migrationId，源主动确认失效后须重新排空，不重启一小时。 |
| PauseActive / Released 崩溃恢复 | A01、A14、A19、A27；MS10、MS21、MS34 | PASS；仅服务时间转换；重建不能以本地时间 / 缓存绕过。 |
| Claim 响应丢失 / 日志失败 | A21～A22；MS12～MS14、MS21 | PASS；同 ID 查询 / 重放，别的 claimer 胜出则保留冲突，不本地发布。 |
| Claimed 后 Core / 目录失败及写后抛错 | MS15～MS18、MS21、MS24；MP08 | PASS；读回实际值，暂存同值重用；异值拒绝；目录失败保留 Claimed。 |
| LocalPublished 日志失败 / 本地已发布服务未知 | MS19～MS21、MS26、MS29、MS33；MP04 | PASS；补 receipt，对账前拒开；保留已发布数据，不删除或伪造服务登记。 |
| 迁回 / 碰撞 / 幂等 | A14、A20～A25、A30；MS22～MS25、MS27～MS28 | PASS；迁回新事务，源不可自行 Claim；同值可迁回，异值 / 墓碑拒绝，历史 receipt 不回退当前归属。 |
| 持 lease 才写 / 无 Web Locks 拒绝 | D06、D13；A18；MS02～MS04、MS31；MP09 | PASS；不伪造本机源 lease，不调用 Fork / import 本机来源事务。 |
| 异步销毁无遗留副作用 | MP10、MP11；c P03、P05、P06 | PASS；pending 资源或服务校验后 dispose 不进入 runtime，释放真实 target lease。 |
| 两逻辑设备共享权威，A Release → B 同 ID 打开 | MP01、MP04；Creator 00～13 场景 | 契约及 Creator 双档 PASS；A 排空 / 服务冷静期 / B 同 ID Claim / 正式恢复 / 客户端重建后重开。 |
| RealityPause 中各设备拒入 / 活动自然退场 | MP02、B03～B08；Creator 08～09、14～16 场景 | 契约及 Creator 双档 PASS；真实双窗口原生媒体 ended 后安全退场，账号事实保持。 |
| 两档分辨率一致 | `creator-preview-results.json`、两档各 17 张 PNG | PASS，1920×1080 / 2560×1440，共 34 张实际截图。 |
| 三条门禁 | `gate-results.json` / `final-gates/` | PASS；不代表全保护审计通过。 |

## 7. Creator 实际运行验收

证据入口为 [creator-preview-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/creator-preview-results.json)、`creator-preview.log`、`creator-preview-lifecycle.json` 及两档编号截图。执行的是 Creator 实际预览、正式剧情 / World 原生媒体 / 本地 Fork / Release / Claim / 同 ID 恢复控制；每档独立新 profile，两逻辑设备共享持久 ContractAdapter。读取实际游戏 / Core / 服务状态，检查 served 编译产物与源码对应，截图通过直接 CDP PNG 获取。

最终持久结果 `pass: true`，完成于 2026-10-10T15:35:45.622Z：两档各 17 张 PNG，共 34 张；33 份源码 sourceMap 与实际源码相符、served 编译产物逐字节等于编译器输出，验收首尾一致。rendererErrors / runtimeErrors / 外部请求均为 0。两档的迁移主链、跨客户端重建及活动回放补验均通过。

| 双档共同证据 | 实际结果 |
|---|---|
| A 世界 → 主动全账号排空 → Release → B Claim | 同 worldId、七项 / FormatTime / forkOrigin / 原 revision 保留；源字节保持；服务 HomeDevice 转移。 |
| 暂停期间拒入与绑定 | A / B 及 InitialWorld / 其他世界拒绝新准入，重建后发起设备仍不能登录另账号。 |
| 已在 B 活动回放，另一 A 窗口迁移不同世界 | 两窗口共享账号暂停；B 原生音频 6 秒自然 ended，媒体时间持续前进，没有 seek / timeline reset / 强制 ended。 |
| 暂停中显式返回文件夹 | live SafePoint 探针阻止提前退场；原生 ended、实际完成且 Core 结算后才退至目录。 |
| 自然回放结算 | completedPlayCount +1，Ledger / FormatTime / forkOrigin / account facts 保持；补验服务时钟推进为 0。 |

主链测试显式推进 **ContractAdapter 独立服务 fixture 时钟** 一小时，`realElapsedHour: false`；活动回放补验不推进服务时钟。这不证明玩家实际等待一小时、不代表真实外部服务器。无玩法状态注入、无文件种植。此前第二窗口 Release 等待 PauseActive 超时，结果保存在 `preview-active-window-timeout-diagnostic.json`。补充 idle / panel-ready 前置检查与失败快照后复验成功，未修改生产机制；旧超时的具体原因未由旧证据确认。

## 8. 遗留事项与 B2.4e 入场

| 事项 | 状态 / 后续动作 |
|---|---|
| Creator 最终双档复验 | 已通过；结果 JSON / 34 张 PNG / 33 份编译映射已落盘，保留旧超时诊断以供追溯。 |
| 两份官方文档 SHA 漂移 | 全保护 FAIL，作者 / 完整变更范围未知；保留证据与当前文件，不自动归因 Trae、不改允许清单、不回退他人文档。 |
| v3.14 正式名库落盘 | 本轮交付附录提案给 Trae；不修改正式名库。正式同步不构成重新请示本轮契约的理由。 |
| 物理身份 / 离线 | 固定 logical deviceId 与共享持久服务 fixture 不等同物理设备认证。无真实服务时拒绝新准入 / Claim，缓存与本地时钟不能授权。 |
| 超出受支持边界 | 非 Primary / 无法自然进入支持的安全点保留待排空或 UnsupportedBoundary；不强行结束活动。进展不同的迁回明确冲突，不覆盖目标。 |
| 后续实现范围 | 完整 FileCarry、真实 AuthService / CommitRelay、平台 OfflineGrace、非 Primary 生产迁移、WorldRegistry 本机位置、AccessCode / ObserverSync 均未实现。 |

B2.4e 的协议、组合及本轮双档运行前置已在 d 提供，三门禁健康；入场时须如实保留文档漂移审计限制。没有新增未裁架构 PROTOCOL 冲突；不能把审计来源未知解释为保护要求已经满足。

| B2.4e 入场条件 | 当前状态 |
|---|---|
| b/c/d 共用持久 ContractAdapter、A/B 同账号身份与当前归属守卫 | 已就绪；无真实外部服务承诺。 |
| 正式非 Initial Primary Complete、七项及媒体引用有效 | 契约与 Creator 双档主链已覆盖。 |
| 源全部世界主动排空、真实 lease / journal / 账号事实结算 | 已实现并通过 20 项 drain 与组合契约。 |
| RealityPause 全账号准入、设备绑定、自然活动续行 | 已实现并通过 authority / boundary / composition 契约及实际双档自然续行。 |
| 同 ID Claim、目标目录唯一新发布点、逐阶段恢复 | 已实现并通过 34 项 storage 契约。 |
| 三门禁及范围证据 | 三门禁 PASS；授权源码 PASS；全保护 SHA FAIL 事项须保留。 |

本轮不自动启动 B2.4e；以上是 d 在受限 Core / ContractAdapter 范围的实际交付结果，保护审计的文档来源未知仍单独保留。
