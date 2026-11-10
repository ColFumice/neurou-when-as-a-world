# 《雨若》正式落地裁定 · VERDICT-301～310

日期：2026-10-10（Asia/Shanghai）。依据：本轮 PROTOCOL 对 P1～P4 的正式回复及直接启动 B2.4b 的授权。本文覆盖旧 286～300、旧 PROTOCOL/草案/拆分中已过时的阻塞结论，旧文件保留点时证据，不回写。

## VERDICT-301 · InitialWorld 完全排除跨设备

InitialWorld 不进入 WorldHomeRegistry，不参与 CrossDeviceDuplicate，不迁移、不传输为本批跨设备世界；各设备独立初始化互不影响。不改原 ID、Core、目录、引用或通关链。B2.4 仅针对本账号自己创建/分叉且非 InitialWorld 的世界；既有 InitialWorld 可以作为 B2.3 本机分叉来源，产生的新 UUID 世界属于本批范围。其他账号加入世界不属于本批。

P1 以明确范围排除闭合，不再要求旧初始世界身份升级。新的索引不能扫描所有目录条目后无差别登记；对 InitialWorld 操作应在网络和 ID/时钟工厂调用前拒绝为 ExcludedWorld。

## VERDICT-302 · WorldHomeRegistry 最小闭环与两层表

WorldHomeRegistry 是账号级轻量归属索引，逻辑键 accountId×worldId，HomeDevice 是设备归属，不是 WorldDeveloper 所有权转让。WorldRegistry 仍是本机位置检测表，历史语义保留，**B2.4b 不实装 WorldRegistry**。

b 仅实装首次登记、同设备重复登记、已有其他设备归属冲突、账号索引读取、严格 schema/身份隔离和服务不可用诊断。服务首次登记原子且不可覆盖已有归属；新登记 homeRevision=1，全账号 registryRevision 每新增一个世界递增一次。重试/读操作不增加归属版本。不产生 Released、Migrated 或迁移行为。

登记来源由注入的同账号本机合法目录读取器确认：非 InitialWorld、合法 world- ID、active、EmptyWorld template；已删除/未知/错账号/损坏目录不登记。目录数据来自组合根，不作为玩家提供任意归属的能力。最小闭环不修改已有创建/分叉提交点，不在这两条旧链中插入服务调用。

## VERDICT-303 · 复制检测与处理分阶段

CrossDeviceDuplicate 是跨设备检测结果；DuplicateWorld 是复制品加载资格；WorldFork 是新 ID 操作。b 的 HomeConflict **只是“已有另一设备归属”的服务结果**，不自动等价为已确认复制品，不载入/复制/改写世界。

c 在受限 Core 原型范围完成可信来源验证、复制权限与新 UUID 重键/目录发布。沿用 Primary/null 来源、七项严格认证、FormatTime 保留、Inherited 首演规则与账号事实不复制；不能放松旧 B2.3 源 lease/目录验证器来导入远端来源。迁移后原设备分流 Migrated 的证据和规则在 d 冻结，不能仅凭不同 HomeDevice 自动把迁移源分叉。

## VERDICT-304 · 主动源设备 SafePoint 确认

迁移发起前，**源设备先对该账号所有世界完成 SafePoint 排空，全部世界状态已持久化至 Core，且无未结算写入**；获得主动确认后才向服务器 MigrationRelease。确认至请求接受之间必须保持该账号暂停准入，不允许重新推进制造陈旧确认。具体确认结构、寿命、撤销和在途写入处理在 d 实施前冻结。

任意同账号已登录设备可以作为请求者，但不能替源设备编造确认；必须取得当前来源设备的主动排空确认。源关机/不可联络时不自动 Release，返回安全诊断，原设备丢失后的迁移能力因此按本次回复收紧。不再采用“等一小时证明源已停”的隐式论证。b 不实现该协议，也不因此新增 b 入场阻塞。

## VERDICT-305 · RealityPause 是强制冷静期

服务器接受 Release 后启动全账号、所有设备、所有世界的 RealityPause；持续至少 1 小时且≥OfflineGrace。它是强制冷静期，**不是旧设备停止推进的证明**。RealityPause 起止/Released/Claim 资格只由服务器时间判定；客户端仅倒计时，不取本地差或两者较晚。结束才 Released，此后在线 Claim。

不引入 bootId/跨睡眠重启机制作为本批前置。OfflineGrace 历史设备开机累计运行时长和 SafePoint 语义不混入 RealityPause 计时。d 应落实全账号准入/活动安全边界和发起设备不可切账号的强制约束，细节在 d 冻结；b 不接入 OfflineGrace、暂停或账号切换限制。

## VERDICT-306 · 两存储域与可恢复 journal

服务归属是全局权威；服务 Claim 成功后，目标本地目录追加是本地发布唯一 commit point；以 WorldMigrationJournal 协调两个域，不要求一个原子点。Claim 后本机失败保留日志，重试恢复，不将服务成功当未发生，不删除已发布世界来伪装回滚。

迁移保持原 accountId/worldId/revision/forkOrigin/FormatTime/七项；源文件不修改、不删除，不走 deletedAt 墓碑及谱面 GC。WorldClearRecord/FirstWorldCleared 继续同账号既有事实，CopyPermission 仍派生，不制造新通关。日志 phase/碰撞/迁回/确认 receipt/清理协议在 d 冻结。c 新 UUID 服务登记与本地发布也按双域可恢复原则协调，具体导入日志在 c 冻结。

## VERDICT-307 · 七项受限 Core 传输原型

B2.4c 仅传输七项 WorldCoreStateSnapshot 的 data-only 序列化值，明确标注“受限 Core 传输原型”；接收端重新 parseComplete/正式内容引用验证，运行时品牌不序列化、不跨设备信任。缺项、未知版本、错误身份或内容不匹配拒绝，不能用旧数据补齐。

不实现共享 WorldChangeLog/WorldCheckpoint codec、完整个人媒体或加密 suite；不命名/宣称完整 FileCarryPayload。完整 FileCarry 留 B2.5。七项包含个人状态和世界元数据，既有归属不变。d 可以在明确限定的 Core 原型能力上裁定迁移流程，但不能宣称完整媒体/全存档迁移。P4 不再作为 b 或受限 c 的阻塞。

## VERDICT-308 · 共享权威 ContractAdapter

b 用一个共享权威内存 ContractAdapter 绑定两个独立逻辑设备会话。accountId/deviceId 在绑定时固定、冻结，请求无可覆盖身份字段；所有响应作为 unknown 重新严格解码。ContractAdapter 是测试身份边界，非真实登录、可信物理设备或外部 AuthService。

权威时钟注入，不用 Date.now 假装服务器。首次归属同步原子判定；registrationId 同账号/设备幂等，不得复用到其他世界；已登记归属不覆盖。服务 unavailable、缺端口、响应格式/身份/版本错误均返回明确诊断，不能用缓存回填成功。无本地 key 写入，不改变旧 lease、目录提交、账号保存或输入门控。

本批新增 director 逻辑与 presentation ContractAdapter；presentation 只通过 IntentPort type-only 边取得类型，纯逻辑零 cc/DOM/Storage/平台时间。无 service/sync 新模块、无真实网络、无新 UI/生产加载接线；验证为契约级两逻辑设备闭环，生产端到端/双档 Cocos 留 e。

## VERDICT-309 · v3.12 本轮冻结与后续细化

历史名补登与 b 具体类型/方法/字段在附录逐字冻结，作为当前 HANDOFF/实施依据；用户明确授权先冻结再直接实现 b，**无需等待 Trae 更新 docs 或再次请示**。正式 docs/名库仍由 Trae 后续落盘，本轮不改。

三个历史确认 key 前缀保持：neurou-world-home-registry-v1:（本地缓存/receipt）、neurou-reality-pause-v1:（账号暂停缓存）、neurou-migration-v1:（迁移日志），后缀均 encodeURIComponent(accountId)。b 为共享内存适配，不创建/写这些 key。c/d 内部 schema、导入日志 key/新增锁、迁移/暂停执行端口在对应阶段实施前细化冻结；B2.5 FileCarry 加密/媒体/外部认证未提前冻结。

## VERDICT-310 · 冻结闭合并直接进入 b

P1～P4 按本次范围与协议裁定闭合，B2.4a 冻结完成，直接进入 b 的已授权范围；旧“b 不得启动/先等 Trae/全 FileCarry 不齐则受限 c 不得实施”结论被覆盖。仅 b 获当前实现授权，c/d/e 留到相应阶段。

沿用 INV-10/12/13、七项同主 key、活动 UnsupportedBoundary、持 lease 才写/无 Web Locks 拒绝、B2.3 源→新目标→目录顺序与本地目录追加唯一发布点、Complete 重新认证/Restored 实际发布、RealityPause≥OfflineGrace。b 不新增世界写入，故不以 ContractAdapter 的同步内存操作绕过世界 lease。

冻结前与实现后三门禁分别记录，不拿基线通过替代新增实现验证；契约测试与实际 Cocos/真实服务证据分开。若出现新的真实架构冲突再提 PROTOCOL，本轮已解决的问题不重复索取授权。
