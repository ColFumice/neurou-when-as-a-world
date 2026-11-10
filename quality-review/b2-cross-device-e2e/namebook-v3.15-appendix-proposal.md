# 名库 v3.15 附录提案 · B2.4e 整体验收

2026-10-11（Asia/Shanghai）。依据 VERDICT-346～355。此文件供 Trae 同步正式名库，仅位于 quality-review，不编辑正式 docs / 名库 / 参照。v3.15 是验收语义与阶段边界补登，**新增运行时名、接口、key、schema、journal phase 均为零**。

| 沿用名称 | 本轮冻结的验收语义 |
|---|---|
| WorldRegistry / WorldHomeRegistry | 本机位置检测层与账号 HomeDevice 归属层继续分开；e 不补做本机位置 API。服务归属鲜读，不以本地缓存或 HomeConflict 自证所有权。 |
| InitialWorld | 不进入跨设备归属 / c 载荷 / d 迁移；每逻辑设备独立初始化。参与源全部世界主动排空与全账号 RealityPause。 |
| WorldFork / CrossDeviceDuplicate / DuplicateWorld | 本机分叉操作、跨设备检测结果、复制品加载资格继续各司其职。e 主链 c 目标使用新 UUID，与 d 原 ID 迁移目标独立。 |
| CoreTransferPayload / RestrictedCoreTransfer | c 七项 data-only 受限载荷，接收端重新正式内容绑定 parseComplete；保持原有 c 结构与品牌边界，不叫 FileCarryPayload。 |
| CrossDeviceImportAdapter / CrossDeviceImportJournal / CrossDeviceImportReceipt | 独立远端复制事务；复用现有 rebaseWorldState 与目录发布。phase 原为 Prepared / HomeRegistered / Published，e 不新增阶段。 |
| WorldMigration / RestrictedMigrationCorePayload / RestrictedMigrationCore | d 同账号、同 worldId 归属转移，保持原七项及原版本 / 时间 / forkOrigin；不同于 c 重键。 |
| MigrationAuthorityPort / WorldMigrationContractAdapter | 沿用 d 的独立持久权威端口；c 与 d 在实际组合中共享权威。受控身份仅两个逻辑设备，不等同外部登录或物理认证。 |
| SafePointDrainConfirmation / SafePointDrainCapability / SafePointDrainAcceptance | 源全账号当前真实 leases / Core / 活动 / 账号事实排空；能力单次、可撤销、不可序列化。30 秒服务确认寿命沿用，不用冷静期替代排空。 |
| MigrationReleaseRequest / MigrationClaimRequest / MigrationReceipt | Release → PauseActive → Released → Claim；d 的原请求及 receipt 结构保持，e 不增加字段、分支或执行端口。 |
| WorldMigrationJournal / WorldMigrationPhase | 原 Prepared / PauseActive / Released / Claimed / LocalPublished 保持；服务权威与目录发布双域协调，不新增 CleanupPending。 |
| RealityPause / RealityPauseRecord / DeviceAccountBinding / RealityPauseBoundary | 全账号所有设备 / 世界拒绝新准入，发起设备绑定；已有活动自然排空，不强退。≥1 小时且≥OfflineGrace，仅服务时间判定。 |
| ContractServiceClock / ContractAdapter | 仅现有独立服务时钟 fixture。主链推进一小时须标 realElapsedHour:false；活动补验推进 0。不能解释为真实服务器 / 真实一小时 / 平台 OfflineGrace。 |
| Complete / Restored / Inherited / FormatTime / forkOrigin | Complete 重新认证，Restored 实际正式恢复；c 完成继承 Inherited，d 原值保持。e 记录两目标独立与原账号事实保持。 |
| WorldClearRecord / FirstWorldCleared / CopyPermission | 同账号受信事实不随载荷传输。CopyPermission 用于 c，迁移 d 不依赖；通关 / 里程碑不被复制或重复制造。 |

既有 key 与锁沿用 v3.13 / v3.14 的精确名称和内部分域；本轮不将验收脚本 / 截图文件 / JSON 结果字段登记为新的领域名。只读观察、隔离测试 profile、服务 fixture 时间推进属于验收证据，不是新玩家能力。

用户后续确认 d 文档变化由 Trae 授权同步并验收 d / 追认 v3.14，来源 PROTOCOL 现已闭合；历史 SHA 差异与 raw FAIL 不回写。e 入场文件为 v3.13 / c，运行期间 Trae已落盘v3.14 / 326～345至NAMEBOOK与stage-1；本轮审计单列TraeAuthorized且rawHashEquality=false，生产源码零改。本验收v3.15附录仍由Trae后续合并，不把追认与落盘混写，也不回改旧点时证据。

本附录不冻结完整 FileCarry 共享 codec / 本人媒体 / 账号加密 suite、真实外部服务、平台 OfflineGrace、非 Primary 生产迁移、WorldRegistry 本机位置、AccessCode / ObserverSync 的实施名称；这些留 B2.5 或后续范围。
