# B2.4e 交付报告 · 跨设备整体端到端验收

2026-10-11（Asia/Shanghai）。B2.4e实际运行、回归、三门禁、源码保护 / 授权分类与证据一致性均通过：**227 / 227 ContractAdapter回归、Creator双档40张PNG / 39模块编译核对、生产文件改动0。** 同一实际链验证c新UUID复制与d原ID迁移独立、全账号暂停含复制目标拒入、客户端重建绑定及原生媒体自然结束后安全退场。B2.4受限Core / 两逻辑设备 / ContractAdapter整体范围闭合。

本轮只新增质量目录验收脚本、结果、截图及交付文本，未新增运行时名 / 接口 / key / schema / journal phase，未修改生产核心机制。并发正式文档同步按用户明确授权记TraeAuthorized；本轮`sourceProtectionPass:true` / 审计`pass:true`，但`rawHashEquality:false`。d历史raw保护FAIL与基线不回写。

## 交付入口

| 用户交付项 | 文件与结果 |
|---|---|
| 最终证据主索引 | [validation-summary.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/validation-summary.json)，pass / evidenceIntegrityPass / sourceProtectionPass / authorizedProtectionPolicyPass均true，rawProtectedHashEquality=false。 |
| 正式裁定346～355 | [验收冻结](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/verdicts-346-355.md)，运行前落盘，沿用既有协议。 |
| v3.15名库提案 | [附录提案](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/namebook-v3.15-appendix-proposal.md)，只补验收语义，交Trae正式合并。 |
| B2.4整体阶段表 / e入场 / B2.5 | [整体报告](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/b24-overall-acceptance-report.md)。 |
| 实际端到端 / 双档结果 | [Creator结果](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/creator-preview-results.json)，每档20张PNG、同语义结果。 |
| 契约回归 | [本轮227项汇总](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/contract-regression-results.json)，各隔离副本报告及原始log在contract-regressions。 |
| 三门禁 | [最终结果](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/gate-results.json)，完整log在final-gates。 |
| 零生产改动 / 修改清单 / diff | [完整e清单](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/change-files.json)、[测试代码diff](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/code.diff)、[整合harness增量](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/acceptance-harness.diff)、[保护审计](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/protected-final-audit.json)、[生产空diff](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/production-code.diff)、[授权文档diff](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/authorized-docs.diff)。 |
| d后续PROTOCOL闭合 | [闭合记录](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/d-audit-protocol-closure.json)，用户Trae授权确认，raw不相等保持。 |
| 复核 | [冻结 / 实际结果只读复核](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/peer-review-e-freeze.md)、peer-review-contract-and-harness.md、baseline-review.md；[独立Creator证据审计](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/peer-evidence-integrity-results.json)40PNG/39模块PASS。早期点时结论与最终结果分开。 |

## 三条门禁与回归

| 门禁 | 本轮最终结果 |
|---|---|
| npm run check:naming | PASS，0 ERROR / 22既有WARN，未放宽规则。 |
| npm run typecheck | PASS，exitCode0。 |
| npm run check:dependencies | PASS，120 TS / 约423静态依赖 / 0ERROR。 |

最终三门禁完成于2026-10-10T16:25:50.328Z；基线三门禁也通过，结果分别保存，不能混作一次运行。

| ContractAdapter既有套件 | e本轮隔离重跑 |
|---|---:|
| b WorldHomeRegistry | 34 / 34 PASS |
| c领域 / 存储主组 | 59 / 59 PASS，内含storage30，不重复累计 |
| c正式内容 / 共享权威 | 22 / 22 PASS |
| c实际组合 | 6 / 6 PASS |
| d主动排空 | 20 / 20 PASS |
| d活动边界 | 8 / 8 PASS |
| d服务权威 | 32 / 32 PASS |
| d迁移存储 | 34 / 34 PASS |
| d实际组合 | 12 / 12 PASS |
| 合计 | **227 / 227 PASS，0FAIL** |

回归完成于2026-10-10T16:26:06.543Z。执行e副本，原用例 / fixture不改，只调整copied workspace-root anchor指向当前生产；原脚本 / 已验收报告与127个生产TS路径前后SHA不变。`prior-205-contract-evidence`保存缺c内容22项时的中间回归，不代替最终227。ContractAdapter的受控身份、时钟、锁及故障不种植Creator profile，不当物理设备 / 外部服务证据。

## 双档实际链与逐项证据

两档Creator实际运行完成于2026-10-10T16:25:21.926Z，分别使用干净profile，各20张PNG，viewport / canvas为1920×1080及2560×1440、DPR1。两档`transferAcceptance / migrationAcceptance / integratedAcceptance / activeReplayPauseAcceptance / resolutionComparison`均PASS；39模块sourceMap含当前源码、served chunks等于编译输出，首尾`compilationUnchanged:true`。rendererErrors / runtimeErrors / externalRequests均0。

40次实际截图有36份不同PNG字节；每档09复制恢复、15同ID迁移恢复、16重开呈现相同继承内容 / FormatTime，画面可以完全相同。截图单独不能证明世界身份；两目标独立依据每次截图同时记录的runtime worldId、真实Core / 目录 / 服务归属、Published / LocalPublished receipt及前后字节比较确认，不以图像不同冒充身份不同。

| 验收项 | 本轮实际观察 / 契约映射 |
|---|---|
| 登录、序章、真实通关与本机来源 | 00～06截图；从InitialWorld正式通关和本机Fork生产非Initial源，无玩法或世界文件种植。 |
| InitialWorld边界 | transferAcceptance.initialWorldNotRegistered=true；源排空与账号暂停仍包括InitialWorld，b34及d排空回归验证。 |
| c可信复制 / 七项 / 新UUID / 继承 | 07～09截图；Published receipt、B正式Restored / Complete，七具名section重键、FormatTime / Inherited保留，源字节不改，账号事实不复制。c87回归含拒载 / CopyPermission / 正式引用再认证 / 故障。 |
| 同共享权威与两独立目标 | 两档integratedAcceptance.sharedAuthority / idsDistinct / journalsIndependent=true；B目录中c新UUID与d原ID并存，不复用receipt。 |
| d源主动排空 / Release / Pause / Claim | 10～16截图；全部源世界当前Core及账号事实稳定后Release，服务截止Released，B同worldId Claim，LocalPublished后正式Restored / Complete。d106回归覆盖确认能力 / 服务 / 每phase恢复。 |
| 同ID原值保留 / 源不改 / 不墓碑 | migrationAcceptance.sameWorldId / sevenSectionsExact / sourceCoreDirectoryUnchanged / formatTimeRevisionForkOriginPreserved=true；账号事实继续读，不随载荷制造。 |
| 全账号暂停 / 复制目标也拒入 | 11截图；A InitialWorld / 原源、B新导入 / 已复制目标打开、提前Claim拒绝；allAccountNewAdmissionRejected=true。新准入与既有活动不同。 |
| 发起设备绑定 / 重建 | 12截图及16重开；initiatingDeviceBindingSurvivesRebuild=true，发起设备不能登录另一账号；固定logical deviceId为fixture边界。 |
| 服务时钟权威 / 一小时标签 | 主链独立fixture推进3599999ms再1ms，serviceClockAdvancedMs:3600000 / realElapsedHour:false；客户端时间不参与。契约A03～A05 / MP07回归。 |
| c目标跨d全链保持 | integratedAcceptance.copySurvivesMigrationAndPause=true；copy Core及导入journal在迁移 / 暂停 / 最终活动补验后逐字节保持，copy HomeRevision仍1、迁移源HomeRevision3。 |
| 两窗口自然活动续行 | 17～19截图；另A窗口迁移不同稳定世界，B已在原生回放继续6秒音频，无forced ended / seek / timeline reset。closed期间显式返回folder等待SafePoint，实际ended / Core稳定后退场，completedPlayCount+1、账号事实保持，fixture补验推进0。 |
| 崩溃恢复 / 幂等 / 迁回 / 服务未知 | 隔离回归cS01～S30、dA/MS/MP套件；每持久prefix、lost responses、写后抛错、quota、同值迁回 / 异值拒绝、已发布服务未知拒开均通过。不将故障fixture写进Creator。 |
| 无WebLocks / 真实lease | b/c/d对应回归明确拒绝，无世界 / 日志 / 服务副作用；独立导入与迁移适配器不伪造本机来源lease。 |
| INV-10 / 12 / 13及旧核心 | 既有boundary / 自然回放及零生产diff；旧算法 / 活动时序未改。 |

| 分辨率 | A原源 / d迁移worldId | B c复制worldId | 结果 |
|---|---|---|---|
| 1920×1080 | world-a6966e96-61f9-4f58-99fa-3f8729f90fc2 | world-fe22041e-4596-413f-8298-ea36c3cdbfa2 | 两目标独立、全部链与自然活动PASS |
| 2560×1440 | world-d369b9d3-29a1-4b8a-a0d3-3b301969eb6e | world-12149f4a-daea-4cc5-a50b-5b982a3dbd41 | 两目标独立、全部链与自然活动PASS |

双档比较语义与不变式，不要求独立profile的随机账号 / UUID / 墙钟逐字节相同。图示入口：[1920复制发布](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/1920x1080-08-b-copy-new-uuid-seven-parts-published.png)、[2560两目标并存](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/2560x1440-14-b-same-id-published-alongside-copy.png)、[1920自然ended后退场](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/1920x1080-19-native-ended-and-core-settled-before-retirement.png)、[2560活动时间线继续](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-cross-device-e2e/2560x1440-18-b-active-replay-keeps-native-timeline.png)。

## 保护、并发docs同步与新增文件

固定e基线643路径 → 终态643路径，369 canonical原始副本均可追溯。sourceProtectionPass=true、productionFileCount=0、coreAndComposition516 / settingsAndScenes19 / otherReferences34均PASS、junction不变，无unexpected增删改。唯一原字节变化为已列举的两项Trae授权正式Markdown同步，diff完整保留；不是笼统豁免参照文件。

| 分类 | 结果 |
|---|---|
| production / source / composition / config / 其余reference | 零改，sourceProtectionPass=true。 |
| NAMEBOOK / stage-1并发同步 | TraeAuthorized / protocolAttributionAccepted=true；v3.13→v3.14 / d实际落盘，rawHashEquality=false。 |
| d历史审计 | 用户后续PROTOCOL已闭合授权归因，historicalRawAuditPass=false保持，历史基线/最终审计未改。 |
| e新增文件 | change-files.json列24项测试/核验脚本（含隔离副本）及证据文件。仅quality-review验收脚本、结果JSON/log、PNG、裁定/提案/报告/复核；不是新运行时协议。 |
| 源码diff | production-code.diff为空；code.diff / acceptance-harness.diff是相对已验收父脚本的新增e测试审查比较，不是Git / 生产patch。授权文档变更由authorized-docs.diff单列。 |

## 剩余与下一阶段

本轮没有新增未裁架构PROTOCOL冲突。B2.4受限Core / ContractAdapter的跨设备运行范围完成；主链推进测试服务fixture一小时，`realElapsedHour:false`，不是实际等待或真实服务器。既有活动6秒媒体实际自然结束补验不推进服务时间。

完整FileCarry（共享codec、完整个人媒体、账号加密 / key suite）、真实AuthService / CommitRelay / fetchServerTime、平台OfflineGrace累计开机时间、可信物理deviceId、非Primary生产迁移、WorldRegistry本机位置、AccessCode / ObserverSync留B2.5或后续独立范围。v3.15正式名库落盘交Trae，本轮不自行修改docs；不自动启动下一实现阶段。

最终证据一致性索引完成于2026-10-10T16:48:23.660Z，运行 / 回归 / 门禁 / 源码与授权分类及证据hash均确认。该索引保留rawProtectedHashEquality=false、historicalRawAuditRewritten=false，不将授权归因改写成字节未变。
