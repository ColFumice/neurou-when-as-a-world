# B2.4d 排空与交付一致性独立复核

复核对象：VERDICT-326～345、migration-contract.md、namebook-v3.14-appendix-proposal.md，以及最终 WorldMigration / SafePointDrainStorage / RealityPauseBoundary / WorldMigrationContractAdapter / WorldMigrationStorage 和 Cocos 组合接线。该复核不修改 production、正式 docs 或名库；最终门禁与双档 Creator 结果由主代理执行和汇总。

结论：**未发现需要重新 PROTOCOL 的命名、phase、排空寿命、服务时间或双域契约冲突**。新文件 33 个 export 均被 v3.14 附录覆盖，缺失 0。逐条代码审查与当前已持久局部契约结果如下。

| 核查项 | 最终证据与结论 |
|---|---|
| 载荷身份与七项 | WorldMigrationCodec.parsePayload 精确 data-only clone、接收端真实 Complete 品牌验证、Primary边界及内容摘要一致；同worldId、任意合法源revision / capturedAt / FormatTime / forkOrigin / 七项保留，不调用重键。 |
| InitialWorld | parsePayload / Release / Claim 排除迁移；parseConfirmation 要求 InitialWorld，Drain 包括全部未删目录世界，空世界使用严格空Core。 |
| 单次排空 | SafePointDrainStorage 的 WeakSet 只由真实持锁 withDrain 签发；assertCurrent 失败自动revoke，恢复旧bytes也不能复活；callback finally撤销。 |
| 服务TTL | parseDrainAcceptance 要求 expiresAt = acceptedAt + 30000；authority accept重复不续期，Release在服务截止前且真实cap仍有效才消费。 |
| 源安全点 | 当前 runtime不安全 / 有pendingtxn拒绝；获取全部真实world lease，账号事实锁内检验FirstWorldCleared与非继承完成记录；没有用磁盘Core替代活动runtime证明。 |
| 锁序 | 源共享withCoordination → 排序world leases → clear账号锁 → 最终directory；服务await在最终directory释放后。目标coordination→target lease→serviceClaim→directory；独立authority锁不反取world。 |
| 服务暂停 | adapter pauseMs = max(3600000, offlineGraceMs)，parsePause进一步约束历史OFFLINE_GRACE_HOURS；只serviceNow参与expiry，client Date.now不裁决。 |
| 设备绑定 | Release服务单snapshot包含pause / ownership证据 / binding；authority每操作检查活动device binding；跨客户端重建读取同fixture域，不能靠删除诊断cache解除。 |
| 完整phase | Prepared / PauseActive / Released / Claimed / LocalPublished，源码无CleanupPending producer；Source Claimed结束、Target LocalPublished结束，永久receipt与历史迁移保留。 |
| 双域与恢复 | storage Release/Claim查authoritative payload，响应丢失同ID查询；Claim成功本地失败保留journal，Core/目录写后抛错回读，已发布不删除；打开鲜读当前归属，旧receipt不能授权迁回。 |
| 迁回 | authority拒同migration源自行Claim；另发新事务。目标exact同record/Core可原值迁回；异值、进展差异、墓碑拒绝，不覆盖复活。 |
| 新准入 | folder create/delete/fork/open与c复制/import额外共享d准入；有等待后的authority复查和最终同步guard。 |
| 活动自然续行 | closed允许既有chart Strike / ToggleChartPause / ExitChart、RetryWorldClear、已在七秒持续期必要无keyId世界Strike；系统已trigger且reveal Finished的专用口允许旧EnterChart继续。普通新EnterChart/WorldChart/replay拒绝。 |
| 活动安全退场 | SceneBuilder实时Complete capture要求Ledger/Puzzle与durableCore相同，Pending / Failed账号commit与排队worldIntents挡住暂停retirement；WorldFolderBuilder仅isRuntimeClosed时启用live probe阻止强退，健康显式退出沿用旧行为。 |
| e前置 / 后续 | 全部交付文本明确ContractAdapter / 受限Core / 正式内容媒体 / 自然安全点 / 三门禁入场；真实外部服务、完整FileCarry、平台OfflineGrace、非Primary迁移等未虚报完成。 |

## 已发现并修复的接线问题

1. 初版源assertPending调用旧forkStorage.assertNoPending，需要最终directory lock；Drain在取世界锁前也调用，会必然拒绝。最终composition改为纯readPending判定，不修改旧ForkStorage核心。
2. 初版revealFinished系统EnterChart仅检查isChartEntryScheduled；系统授予入口前该值false，暂停会吞掉自然continuation。最终专用systemport检查deepTrace已触发且revealSequence.getTerminalPhase()为Finished，再允许旧入口，普通玩家新入口仍拒绝。
3. 初版暂停过滤只保chart Strike，已在七秒持续期因此失去必要输入。最终只读capturePrivateState判断活动持续期，保留无keyId世界Strike；不能以该许可从稳定状态新建持续期或伪装chart输入。
4. Drain初版assertCurrent失败只抛异常而未永久撤销；最终失败即时revoke，恢复旧字节不可复活已失效能力。
5. 初版普通健康期返回文件夹也受Complete probe限制，构成不必要的旧体验变化。最终exitRuntime仅isRuntimeClosed时检查probe；createRuntime和真正retirement均清空probe，避免上个已销毁SceneBuilder的闭包误用于后继MinimalWorld。

## 局部验证及解释边界

当前 drain-contract-results.json：**20 / 20 PASS，ContractAdapter**。含真实现有Core codec / WorldCoreStateStorage租约、retainUntil在途账号写、InitialWorld/空世界、缺失账号事实、身份/严格schema、单次撤销与源字节保护。

当前 boundary-contract-results.json：**8 / 8 PASS，ContractAdapter**。真实Director / PuzzleChain七秒链 / ChartPremiere / WorldClearSession验证暂停下既有活动自然完成、Explicit Exit无伪造完成、合法RetryWorldClear补账号事实、系统continuation与新入口分离。

这些契约结果不替代Creator正式双档验收。ContractServiceClock推进是测试服务时间推进，不是真实等待一小时，也不冒充外部服务器或物理认证。

WorldFolderBuilder最终仅在账号 / 世界准入关闭时要求liveSafePointProbe后retirement；健康显式退出保持既有行为。isRuntimeClosed覆盖服务未知、RealityPause、Released / Migrated、源排空以及源pending迁移日志，因此这些状态不会借普通退出绕过活动自然排空。每次新runtime建立及真正退场清空旧probe，后继MinimalWorld使用自己的严格空Core安全边界。底层T6/T7算法、计时与谱面状态机未被改写。非Primary / 不能自然到达受支持安全点的活动保持待排空诊断，不能强行成功。
