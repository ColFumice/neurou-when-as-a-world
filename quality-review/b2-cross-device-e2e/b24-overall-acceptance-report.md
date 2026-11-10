# B2.4 整体阶段与验收报告

2026-10-11（Asia/Shanghai）。本轮 e 已冻结并完成整体验收，沿用 a/b/c/d 协议，生产文件变更为零。**Creator 双档各 20 张 PNG、共 40 张及 39 模块编译对应通过；227 / 227 ContractAdapter 回归、三门禁、本轮源码保护、授权分类及证据一致性通过。** B2.4 受限 Core / 两逻辑设备 / ContractAdapter 范围的整体运行验收闭合，最终主索引见 [validation-summary.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/validation-summary.json)。

正式裁定见 [VERDICT-346～355](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/verdicts-346-355.md)，Trae 同步材料见 [v3.15 附录提案](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/namebook-v3.15-appendix-proposal.md)。本轮新增运行时命名 / 接口 / key / phase = 0。

## a～e 阶段事实

| 阶段 | 冻结与交付 | 历史实际验证 | 当前整体解释 |
|---|---|---|---|
| B2.4a | 286～300 首轮审查；301～310 回应 P1～P4、补齐 v3.12 冻结。 | 首轮三门禁、564 路径零改；首轮报告停在 P1～P4。 | 冻结已经 301～310 闭合，旧停止材料是点时证据，不是现行阻断。 |
| B2.4b | WorldHomeRegistry / WorldHomeContractAdapter 账号归属最小闭环，InitialWorld 排除。 | 34 / 34 ContractAdapter；三门禁与保护 PASS。 | b 是契约级索引，不把 b 的内存权威单独夸大为持久外部服务或生产 UI。d 组合提供后续共享持久权威。 |
| B2.4c | 311～325，v3.13；新 UUID、七项重键、正式内容再认证、独立导入 journal / 目录发布。 | 主组 59（含 storage 30）+ 内容组 22 + 组合组 6 = 87 ContractAdapter；Creator 双档、三门禁与保护 PASS。 | 合法跨设备复制保留源 Home=A，新目标 Home=B；不冒充完整 FileCarry。 |
| B2.4d | 326～345，v3.14；同 ID 迁移、主动全账号 SafePoint、RealityPause、设备绑定、迁移 journal。 | 新增 106 ContractAdapter，另 c 回归 65；Creator 双档 34 PNG / 33 模块、三门禁 PASS。原全保护 SHA 为 FAIL。 | 用户正式验收 d / 追认 v3.14，并确认 Trae 授权文档同步；该来源 PROTOCOL 闭合，原 raw 差异 / FAIL 不改。 |
| B2.4e | 346～355，v3.15；只整体端到端、双档、回归、门禁与源保护证据。 | 227 / 227 契约回归；Creator 双档 40 PNG / 39 模块、三门禁 / 证据一致性 PASS；productionFileCount=0、sourceProtectionPass=true，授权文档同步另记 rawHashEquality=false。 | 实际 c 新 UUID复制目标与 d 同 ID迁移目标独立，全账号暂停及原生活动自然结束通过。 |

阶段交付入口：[a 首轮](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-freeze/delivery-report.md)、[a 闭合与 b](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-home-registry/delivery-report.md)、[c](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-core/delivery-report.md)、[d](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/delivery-report.md)。

## 后续 PROTOCOL 闭合与正式文档状态

P1～P4 的范围及协议依据 301～310 已闭合：InitialWorld 排除跨设备；源主动确认、冷静期不证明旧设备停止；两存储域 + journal；受限七项 Core 不等于完整 FileCarry。

本轮用户后续确认 d 所观察文档变化由 Trae 授权，并正式验收 d、追认 v3.14；来源授权问题按 VERDICT-347 闭合，明确记录在 [d 历史审计 PROTOCOL 闭合](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/d-audit-protocol-closure.json)。该后续确认没有改变历史字节事实：d 的 [原保护审计](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/protected-final-audit.json)、[漂移记录](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/observed-doc-drift.json)、[原验证索引](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-world-migration/validation-summary.json) 保持 `completeProtectedAuditPass:false`。不能将用户认可改写成历史 SHA 相等。

e 入场只读正式文件是 NAMEBOOK v3.13 / 311～325 与 stage-1 的 c 最新项；运行期间 Trae 授权同步后，终态已见 NAMEBOOK 第 1265 行 v3.14 / 326～345 附录及 stage-1 第 29 行 d 最新项和 d-01～10。实现代理未写这些正式文件。本轮 [保护审计](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/protected-final-audit.json) 将两项同步单列 TraeAuthorized，保留 `rawHashEquality:false`；production / 配置 / 其余参照零改、授权政策通过。

| 正式文件 | 入场 SHA-256 → 终态 SHA-256 | 观察 |
|---|---|---|
| docs/NAMEBOOK.md | `27b6ae1d…f8bed` → `7bb54b18…6641c` | 84404 → 91494 字节；终态 v3.14 / d 附录，TraeAuthorized。完整 hash 见审计。 |
| docs/spec/stage-1.md | `19fb77c3…0a9` → `43519613…93496` | 53741 → 60206 字节；终态 d 最新项及细化验收，TraeAuthorized。 |

## e 入场前置

| 条件 | 依据与状态 |
|---|---|
| a 命名 / 层 / 范围 / 时间 / 双域契约闭合 | 301～310；已就绪。 |
| 同账号两逻辑设备共享权威及固定身份 | b 归属契约、c proof、d 持久 WorldMigrationContractAdapter；已就绪。固定 deviceId 是 fixture，不是物理认证。 |
| 正式 Complete 七项及冻结叙事 / chart / visual / media | B2.2d-2、c 内容验证、d 正式 Creator；已就绪。e 仍须从真实主链生产，不 seed 文件。 |
| c 合法复制与独立目标发布 / receipt / 打开 | 本轮两档 transferAcceptance PASS。 |
| d 源全账号排空、同 ID迁移、全账号暂停与设备绑定 | 本轮两档 migrationAcceptance PASS。 |
| 活动状态自然完成、SafePoint 退场 | 本轮两档 activeReplayPauseAcceptance PASS，native 6 秒 ended、结算后退场。 |
| 本轮三门禁 / 固定 SHA / 编译字节 / 证据一致性 | 三门禁、固定 SHA / 授权分类、39模块首尾编译对应及最终证据索引全部PASS。 |
| 文档来源授权 | 用户后续确认已闭合；历史 raw FAIL 保留；本轮并发 TraeAuthorized docs 同步单列。 |

未发现新的未裁架构前置；如果实际 e 遇到机制缺口，记录具体 PROTOCOL，不在证据轮改生产。

## 本轮链路与验收证据映射

| 验收项 | e 必需实际证据 | 历史参考与当前结果 |
|---|---|---|
| 实际来源生产 | 登录 → 序章 → InitialWorld 正式通关 → 本机 Fork 非 Initial UUID；世界 Core、通关事实、FormatTime、正式媒体事件。 | PASS，两档实际 00～06截图，无玩法 / 文件种植。 |
| WorldHomeRegistry | 两设备同账号读取服务归属、InitialWorld 排除、c 源 A 合法登记。 | PASS，本轮 b34回归、两档 transferAcceptance.initialWorldNotRegistered。 |
| c 成功复制 | CopyPermission 来自账号读口；A proof → B 新 UUID，七项重键 / FormatTime / Inherited；service Home=B、Published receipt。 | PASS，两档 07～09截图，transferAcceptance，c87回归。 |
| d 同 ID迁移 | A 源全账号排空 → Release → pause → service Released → B Claim → LocalPublished → Restored / Complete。 | PASS，两档 10～16截图，migrationAcceptance，d106回归。 |
| 两 B 目标独立 | c UUID ≠ d 原 ID；两目录记录 / Core / Home / receipt 独立；c 先正式打开，d 全链与暂停拒入后 c Core / import journal 保持原字节，迁移未覆盖 c 目标。 | PASS，两档 integratedAcceptance.idsDistinct / copySurvivesMigrationAndPause / journalsIndependent。 |
| RealityPause 全账号 | A / B、InitialWorld、c 复制目标、待迁原 ID、其他世界均拒新准入；发起 device 跨窗口 / 重建绑定。 | PASS，两档 11～12截图及 allAccountNewAdmissionRejected / initiatingDeviceBindingSurvivesRebuild。 |
| 服务时间标签 | 主链 fixture advance 3600000、realElapsedHour:false；客户端本地时间不能解除；活动补验 service advance 0。 | PASS，两档主链及补验字段明确，A03～A05 / MP07回归。 |
| 源与事实保护 | c 源不改；d 源 Core / 目录不改不删无墓碑；同账号事实不被传输或制造。d FormatTime / forkOrigin / revision 原值。 | PASS，两档 transfer / migration / integratedAcceptance 与 c / d回归。 |
| 活动自然退场 | 两窗口不同稳定源迁移与 B 原生回放并行；拒新活动，必要输入与音频继续；真实 ended、结算、SafePoint 后退场。 | PASS，两档 17～19截图、nativeDurationSeconds:6、noForcedMediaEnd / noSeekOrTimelineReset / naturalSafePointRetirement，completedPlayCount+1。 |
| 双档一致 | 1920×1080 / 2560×1440 独立干净 profile，实际尺寸、截图、相同语义结果。 | PASS，本轮40张PNG / resolutionComparison.pass:true，39模块 compilationUnchanged:true。 |
| 崩溃 / 幂等 / 迁回 / 断服务 | 重跑现有契约中的每持久阶段、源能力、注册 / Claim lost response、collision、当前服务未知拒开。 | PASS，本轮隔离副本 b34 + c87 + d106 = 227。 |
| 三门禁 / 源码保护 | 三现有 npm命令、固定本轮 SHA、junction、docs / refs、served源码映射首尾与外部请求。 | PASS，三门禁 / sourceProtectionPass / 授权政策 / junction；raw docs差异单列，外部请求及renderer/runtime errors均0。 |

本轮证据：[Creator 双档结果](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/creator-preview-results.json)、[227项回归](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/contract-regression-results.json)、[最终三门禁](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/gate-results.json)、[保护与授权分类](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/protected-final-audit.json)、[生产空diff](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/production-code.diff)、[Trae文档diff](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/authorized-docs.diff)、[最终证据索引](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/validation-summary.json)。最终索引记录e各项hash一致并PASS，raw docs差异不隐藏。

40次实际capture共36份不同PNG字节；每档09 / 15 / 16恢复画面相同，因为继承内容与FormatTime相同。世界身份及两目标独立由同期JSON中的runtime worldId、Core / 目录 / Home / receipt证明，截图只证明当时呈现，不能单独证明身份。

## 回归计数规则

本轮全部隔离重跑 b 34、c 87（59 + 22 + 6）、d 106（20 + 8 + 32 + 34 + 12），227 / 227 PASS，完成于 2026-10-10T16:26:06.543Z。59 内的 storage30 不再累计；d 上次 c 回归 65 与 c 主 / 组合重复，不额外累计。使用 e目录副本，只调整copied workspace-root anchor；原脚本 / 已验收报告及127个生产TS路径前后SHA保持。Creator实际40截图不计为契约用例。

## B2.4 受限范围与 B2.5 剩余

B2.4 当前完成的是受限 Core、两逻辑设备与 ContractAdapter 的跨设备阶段。真实 Creator 是正式客户端运行证据，服务端仍是 fixture；不能从持久本地快照推导真实账号服务、物理双设备身份或实际离线防作弊能力。

| 留后续事项 | 当前边界 |
|---|---|
| 完整 FileCarry | 共享 WorldChangeLog / WorldCheckpoint codec、完整本人个人媒体、账号加密 / 密钥 suite / FileCarryEnvelope 未实现；不将七项载荷改称 FileCarryPayload。 |
| 真实服务 | AuthService / CommitRelay / fetchServerTime、外部持久权威与可信物理 deviceId 尚未接入；ContractAdapter 标签保持。 |
| 平台 OfflineGrace | 设备开机累计运行计时尚未实装；d 只保证 RealityPause 长度不等式及真实 SafePoint。 |
| 扩展世界类型 | 非 Primary 生产迁移 / 不支持活动边界不本轮扩展。 |
| 其他端口 | WorldRegistry 本机位置、AccessCode / ObserverSync、完整产品账号切换执行端口未通过 e 新增。d 的发起设备服务绑定继续有效。 |
| 断服务路径 | 新准入 / Claim 拒绝，保留数据及 journal；已在活动排到安全点。缓存 / 客户端墙钟不授予服务资格。 |
| 正式文档同步 | Trae已同步v3.14 / d；本轮v3.15附录待后续正式合并。本轮实施代理只交付质量目录材料。 |

整体运行、回归、门禁、源码 / 授权分类及证据一致性结论为 **PASS**。历史d raw保护FAIL保持，本轮e `rawHashEquality:false` 仅因已明确授权的Trae docs同步，不能表述为全工作区字节未变。
