# B2.4d 正式裁定 · VERDICT-326～345

依据本轮授权及301～325；先冻结后实现，不改正式docs/名库。仅受限Core、逻辑设备、ContractAdapter。

|裁定|正式规则|
|---|---|
|326|WorldMigration转移同账号同worldId的HomeDevice；不用rebaseWorldState，不重键、不新forkOrigin、不改变revision/capturedAt/FormatTime/七项。不要求CopyPermission。InitialWorld不迁移；非Primary生产迁移拒绝。|
|327|新增MigrationAuthorityPort与WorldMigrationContractAdapter；不扩大旧b/c首次归属契约。d参与的全部准入读同一持久权威；旧c操作额外受d准入/归属guard，迁移后版本>1仍不走c复制。|
|328|SafePointDrainConfirmation：schemaVersion/accountId/sourceDeviceId/drainId/directoryDigest/worlds（worldId/revision/coreDigest）；包括源设备账号全部未删世界（含InitialWorld/空世界）。仅迁移世界必须Primary七项Complete，其他世界严格Core及安全边界验证。排空不得只看磁盘旧值而忽略活动图。|
|329|SafePointDrainPort持单次当前排空世代能力；关闭源新准入后取得排序世界真实leases，排尽在途世界/账号事实并重读目录/Core。Pending/Failed/缺失非继承通关记录、活动演奏/重演/揭示/七秒计时/排队入口/未恢复发布事务均未排空。不得强制结束谱面、跳过揭示或清计时伪造安全点。|
|330|确认随lease世代失效、集合变化、恢复写入或显式撤销立即无效；服务接收确认后另给服务时间30秒有效期，Release原子消费。服务调用失败/响应丢失可用migrationId查询；不能重用确认启动第二迁移。无bootId要求。|
|331|MigrationReleaseRequest：schemaVersion/migrationId/worldId/expectedHomeRevision/drainId；MigrationClaimRequest：schemaVersion/migrationId/worldId/expectedHomeRevision。绑定账号/device来自端口；不得自报覆盖。MigrationReceipt.kind=PauseActive/Released/Claimed，含归属、pause、服务观察时间、source/claim device证据。|
|332|RealityPauseRecord：schemaVersion/accountId/migrationId/initiatingDeviceId/startedAtServerEpochMs/resumeNotBeforeServerEpochMs/endedAtServerEpochMs。Release与pause/绑定在同一权威事务产生；期间Home仍Homed，结束服务发布Released，Claim再Homed。homeRevision每次实际释放/认领+1，账号registryRevision同样递增。|
|333|时长max(3600000,OFFLINE_GRACE_HOURS×3600000)，只服务时钟判定。客户端无解除/缩短端口。ContractAdapter注入独立服务fixture时钟；测试推进的是服务时钟，必须明示不是等待真实一小时。生产原型也不声称外部服务器；客户端墙钟/倒计时不参与资格。|
|334|全账号所有设备/世界立即拒绝新进入、创建/删除/分叉/导入/迁移/新演奏/新叙事活动。已在活动边界仅保留当前活动必要输入和自然媒体/时序，待真实Complete且账号事实结算后安全退至只读目录，不强退活动。InitialWorld同样暂停；服务不明时拒绝新准入，活动仅排到安全点。|
|335|DeviceAccountBinding：schemaVersion/deviceId/boundAccountId/migrationId/pause，由服务持久保存。暂停活动中发起device登录/切换另一账号拒绝，包括其他窗口/客户端重建；本地删除缓存不能解除服务绑定。只服务结束才解绑。ContractAdapter固定逻辑deviceId不冒充物理认证，重装/伪造身份非本批能力。|
|336|RestrictedMigrationCorePayload：schemaVersion/kind/migrationId/sourceDeviceId/expectedHomeRevision/record/state；data-only且重新parseComplete+正式内容引用验证，保持原头及七项。源WorldClearRecord/FirstWorldCleared继续同账号事实，从受信账号读口读，不进入载荷、不重造。|
|337|WorldMigrationJournal v1按设备账号保存entries，phase=Prepared/PauseActive/Released/Claimed/LocalPublished。Prepared完整冻结载荷；Claim成功先日志、再目标Core、目录追加唯一新本地发布点、LocalPublished receipt永久留。候选CleanupPending不作为本轮阶段，清理失败以receipt诊断表达，无删除已发布世界。|
|338|独立key neurou-migration-v1:+encoded account；pause缓存neurou-reality-pause-v1:+encoded account仅诊断。新增协调锁neurou-cross-device:+encoded account。源：协调→排序所有世界leases→账号事实锁→目录；目标：协调→目标lease→目录。服务await不得持最终目录锁；原Fork/import顺序保持。ContractAdapter权威独立全局锁，不反取世界/目录锁。|
|339|源文件/Core/目录字节不改、不删、不写墓碑；Migrated只来自鲜读服务归属+迁移证据，源显示“去往别处”，阻止旧c复制/加载。目标目录仅新增原记录。已存在完全一致Core/记录允许幂等或原值迁回；不同Core/记录/墓碑拒绝，不覆盖或复活。进展不同的迁回本轮明确冲突，保留两端与服务日志。|
|340|服务Claim是全局权威点，本地目录是本地发布点，用独立journal协调。不要求跨域单一原子点。不把Claim失败当本地回滚，不删除已发布目标；服务成功本地失败保留Claimed重试；已本地发布服务未知/冲突拒开等待对账。|
|341|每phase重试同migrationId/期望归属，Release响应丢失查服务不重复pause；等待到期服务read迁移使Released；Claim响应丢失同ID查/重放，不夺取其他claimer。日志/Core/目录原子写后抛错回读判定；旧迁移receipt重放不回退当前归属。|
|342|独立权威快照持久化供ContractAdapter客户端窗口/应用重建，服务状态和device绑定不依赖客户端UI实例。该存储域是测试服务fixture，禁止与世界主key互相代替；无WebLocks明确拒绝。无真实Auth/OfflineGrace平台计时实现，本轮离线路径拒绝新准入/Claim，不以本地缓存或时间恢复授权。|
|343|沿用INV-10/12/13、品牌重建、七项主key、目标持真实lease才写、目录追加唯一新发布点。新组合hook默认空保持旧行为；不更改旧游戏/编辑器算法、旧b/c codec/事务。若自然安全点迟迟未到，显示待排空，不能强行成功。|
|344|d验收区分ContractAdapter可控服务时钟与Creator正式运行：两逻辑设备同权威、A主动排空→Release→pause拒入→服务一小时到期→BClaim同ID→正式恢复。测试时钟由服务fixture推进，零客户端时间裁决。双档、逐phase故障、绑定重建与三门禁/SHA/diff必须有证据。|
|345|d交付后e可在相同ContractAdapter/受限Core范围整体验收；e仍需服务fixture可用、稳定Primary载荷/正式媒体、全组合准入接线及本轮门禁健康。真实外部服务/完整FileCarry/非Primary迁移/WorldRegistry位置/AccessCode/ObserverSync留后续。Trae正式附录落盘不是重复请示前置。|

已裁P1～P4不重开。本轮潜在活动延迟/设备模拟/服务fixture边界按上述明确限制，不宣称真实离线物理全设备瞬时停止。
