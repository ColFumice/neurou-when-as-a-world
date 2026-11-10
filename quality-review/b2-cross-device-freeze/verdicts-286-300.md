# 《雨若》ARCHITECT 正式裁定书 · 第 34 批 · VERDICT-286～300

日期：2026-10-10（Asia/Shanghai）。范围：B2.4a 命名与契约审查；无生产实现。

**总裁定：B2.4a 尚未全量冻结，B2.4b 不得启动。** 只读核对发现现有世界身份、两套时间基准、全局归属提交与完整迁移载体的前置缺口。依本轮用户约束“若发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL”，停止受影响契约的最终冻结，提交 `PROTOCOL-B2.4a-001.md`。本文是正式审查裁定，既有规则的确认有效；标为“受阻”的新增设计不是实施授权，也不得作为已冻结条目交给 Trae。

依据：当前 `docs/NAMEBOOK.md` v3.11；历史 VERDICT-014/020/024/046/047/053/059；B2.2d-2 和 B2.3 当前源码及 VERDICT-271～285。历史 VERDICT-059 对迁移顺序的修订优先于 VERDICT-053 的原始流程。

## VERDICT-286 · 两层登记表，互不替代【确认】

`WorldRegistry` 是本账号、本设备内的复制检测登记表，识别世界 ID 与本机登记位置是否一致。不是账号世界目录，也不是 B2.3 的短期 fork journal。其 B2.4 职责是本机原件识别、同 ID 多位置检测及加载资格；当前尚未实装，不得说 B2.3 已有完整本地登记表。

`WorldHomeRegistry` 是 AuthService 侧的账号级轻量归属登记，逻辑键为 `(accountId, worldId)`，值含 `HomeDevice` 与 `HomeState`。本地存储仅是缓存/事务证据，不能自称跨设备权威。登记表不保存世界七项、个人媒体、共享日志或检查点。

两个检查都应通过：本机登记位置一致不代表当前设备仍是 HomeDevice；服务器 HomeDevice 一致也不代表本机第二份同 ID 文件是原件。首次归属登记必须由同一账号权威原子判定，不能让两个设备各自用本地“无记录”完成登记。固定 InitialWorld 的身份问题见 P1，在解冻前不得按此键自动判定它是跨设备复制品。

## VERDICT-287 · 检测结果、状态、操作分层【确认】

| 名称 | 层级与触发 | 处理路径 |
|---|---|---|
| DuplicateWorld | 复制品加载资格状态；本机非登记原件，或已被确认为跨设备复制品 | 无 CopyPermission：拒载，表现“档案损坏”，内部记复制被拒；不改/删输入文件。有权限：进入分叉准备 |
| CrossDeviceDuplicate | 跨设备检测结果；同账号同一可信世界身份、HomeState=Homed、HomeDevice 为另一设备，且不存在本次合法迁移认领，也不属于已有合法迁移撤销的原设备副本 | 映射到 DuplicateWorld，按同一 CopyPermission 规则处理；不是服务错误或文件真实损坏 |
| WorldFork | 创建不同 ID 的世界实例的操作；B2.3 生产入口目前是同设备目录内来源 | 本机来源走既有 B2.3；远端来源走独立载荷认证/导入边界后复用重键算法，见 288 |

`HomeState=Released` 的输入不是自动 CrossDeviceDuplicate，也不是自动自由加载：必须在线取得合法 `MigrationClaim`。已被迁移撤销的原设备世界应为 Migrated 拒载，不能仅凭 HomeDevice!=本机把它自动分叉；对应迁移历史证据与检测分流待 P3。无可信归属、陈旧缓存、未知设备身份都不能猜成 DuplicateWorld 或 Homed，应拒绝新增跨设备动作并保留输入。不同账号文件进入既有“加入他人世界”规则，本批不开放该生产路径，不把它当跨设备复制。

本轮补登历史名：WorldHomeRegistry、HomeDevice、HomeState(Homed/Released)、CrossDeviceDuplicate、Migrated、FileCarryPayload；它们不是本轮新发明。新增结构名称的候选清单见名库提案，未批准的结构不落代码。

## VERDICT-288 · 跨设备复制复用七项算法与本地发布原则【确认；完整导入受 P1/P3/P4 阻塞】

回答事项 10：**复用，但仅复用其合法边界。** 输入必须为同账号可信来源载荷，解密后在目标本地重新执行七项 `parseComplete` 与正式内容绑定验证。现有 `rebaseWorldState` 只支持 Primary / shoreOrigin=null；FinalShore 不可复制，BugShore 当前 UnsupportedSourceKind，不因 Complete 而开放。合法 Primary 使用现有继承规则：新 world-UUID v4；accountId 不变；七项复合世界身份和 SphereCrossing 入口重键；局部角色/痕/事件/谱面/链 ID 与 FormatTime 保留；目标 revision=0，获得自身不可变 forkOrigin；不制造新的账号通关记录。

目标暂存 Core 的回读验证后，以目标设备目录追加作为**本地发布的唯一提交点**；未发布不可打开，发布后日志清理失败仍属本地已提交。输入文件和远端来源不改写。

不能直接调用既有生产 `WorldForkSession.prepareWorldFork`/`WorldForkStorage` 当远端导入器：它们要求本机 active 来源目录、本机来源 lease 和提交时本机源 Core 回读。不得伪造来源 lease、伪造本机目录、放松旧验证器或用缓存替代远端来源证明。新增导入适配与完整载荷必须另行冻结；本轮不实现。

## VERDICT-289 · WorldMigration 转移设备归属，保持实例【确认；发布事务受 P3 阻塞】

迁移是同账号同一世界的 **HomeDevice 转移**，不是 WorldFork，不是转让 WorldDeveloper 或账号所有权。accountId、worldId 不变，不要求 CopyPermission。允许任意一台已登录该账号的设备发起 MigrationRelease，以支持原设备丢失；发起者必须经账号服务授权，不能因此取得原设备尚未携出的世界数据。

源设备下一次联网核对发现归属已迁走，加载资格为 `Migrated`，展示“去往别处”。**不修改、不删除源文件，不写源 Core 墓碑，不调用现有 DeleteWorld。** 当前删除路径会清除谱面/成绩，违反迁移数据保留。Migrated 应由归属证据和设备侧登记派生，区别于目录 `deletedAt` 的删除事实；是否需要独立迁移登记记录见契约候选。

迁移目标保持原 revision、capturedAt、七项、既有 forkOrigin 与局部 ID，不新增 forkOrigin，不把 revision 清零。同 ID 本地已有 active 文件、不同 Core 或删除墓碑时不得直接覆盖/复活；迁回和重复投递的精确规则属于 P3，未冻结前显式拒绝。

## VERDICT-290 · 迁移与复制的继承对照【确认】

| 内容 | 跨设备复制/WorldFork | WorldMigration |
|---|---|---|
| worldId | 新实例、新 ID | 原实例、原 ID |
| 七项与 FormatTime | 按 B2.3 精确保留值并重键；FormatTime 不刷新 | 保持原身份和值；FormatTime 不刷新 |
| WorldClearRecord | 不在目标新 ID 下复制或补造 | 原账号原 worldId 记录继续有效；同步/读取既有事实，不新增记录 |
| FirstWorldCleared | 既有账号里程碑保持；不进入世界文件 | 同一账号既有事实保持；由账号服务同步，不从载荷赋值 |
| CopyPermission | 由 FirstWorldCleared 派生，作为复制准入 | 仍派生，迁移不以它为门槛 |
| 已完成首演 | 继承完成按 Inherited，只可重演，不靠复制取得新通关 | 保留原实例完成状态，不改成 Inherited；原为分叉且 Inherited 时也保持原事实 |
| 个人媒体/共享层 | 完整复制范围尚需 P4；不能只证明七项就宣称文件完整 | 全部合法载体应保持；不存在的数据不凭账号记录重建 |

已完成来源分叉后的“重新打完”表述以 B2.3 的冻结规则为准：已有继承首演不能再次首演或提交目标账号通关事实；未完成分叉目标的真实新通关仍可产出自身 WorldClearRecord。本轮不回退 VERDICT-275/276。

## VERDICT-291 · MigrationRelease 与 RealityPause 必须绑定【确认】

服务器接受 `MigrationRelease` 即在同一账号权威事务中启动 `RealityPause`，冻结整个账号所有设备和世界，并绑定发起设备。不能先 Released 后冻结，不能只冻结待迁移世界。

在等待期，HomeState 仍为 Homed，活动 RealityPause 独立记录；不新增 HomeState.Pausing。**服务器确认冻结结束后才可变为 Released，此后目标在线 MigrationClaim 成功才成为新的 Homed。** 这是 VERDICT-059 对原 MigrationRelease 流程的修订。

迁移冻结最低时长为 1 小时，且始终满足 `RealityPause.duration >= OfflineGrace.duration`（当前 OFFLINE_GRACE_HOURS=1）。不得因迁移载荷提前准备好就缩短。是否须因旧离线资格/安全点未排空而延长，见 P2，尚不授权实现。

## VERDICT-292 · 两条时间线不可混用【既有语义确认；释放证明受 P2 阻塞】

`RealityPause` 的权威起点、截止时间和是否结束**仅取服务器时间**。不取本地 WallClock 差，不取两者较晚，不用客户端 Date.now 证明 Claim 资格。客户端倒计时仅表现；本地时钟调快、调慢、重启不能解除冻结。服务不可用时不自行解冻或迁移认领。

`OfflineGrace` 从最后成功联系 AuthService 起按设备开机累计运行时长计，阈值 1 小时；不按应用运行时间、performance.now 会话时间或可调墙钟计，失败请求不得续期。

新的前置缺失是：平台尚无可信跨睡眠/重启的开机累计时钟契约，且宽限到期后的 SafePoint 排空时间未定义。故 `RealityPause >= OfflineGrace` **只是时长约束，不能单独证明旧设备已停止推进**。具体 bootId、重启拒绝、服务归属版本/资格撤销、释放等待证明均交 P2，禁止在本轮暗定成既有能力。

## VERDICT-293 · 在线设备与发起设备的行为【产品规则确认；执行契约受 P2 阻塞】

其他在线设备收到权威活动 RealityPause 后，账号内所有世界禁止新进入、新分叉、新迁移及新的世界推进；目录只读、诊断和暂停说明可展示。重新联网、窗口恢复和打开世界之前都须重查服务，不以推送送达当作唯一保障。

已经在演奏/结局中的在线设备与“立即冻结整个账号”之间的安全退出/安全落盘顺序尚缺正式裁定；不能通过停止整个 FrameDriver 或随意中断音频违反 INV-10/12/13。由 P2 指定新准入拒绝、现有运行安全点以及正在提交操作的排空边界。无法收到通知的离线设备不能声称会瞬时获知冻结，必须由已批准的离线资格失效机制兜底。

发起设备禁止切换账号必须覆盖 UI、登出/登录、其他窗口和应用重启；只禁用按钮不构成强制。建议服务侧记录 deviceId→活动暂停账号/截止条件，登录或切换前验证，状态不确定时拒绝切换；设备身份、清缓存/重装边界和恢复方式待 P2。账号级本地 key 不足以完成该保证。

## VERDICT-294 · FileCarryPayload 是正式语义，完整结构尚不能冻结【受 P4 阻塞】

沿用 VERDICT-046：`FileCarryPayload = 共享层(WorldChangeLog + WorldCheckpoint) + 发送者本人全部个人层`；排除其他账号个人层，**本人个人层及其媒体按该账号凭据独立加密**，共享层仍可由其他账号接收者读取/合并；转发时重新组装当前发送者个人层，不继续夹带上一发送者的个人层。不能把整包仅按发送者账号加密而阻断共享层。

七项 Core 是当前实装的世界状态投影，包含已冻结个人层状态与世界自身元数据，不是整个 FileCarryPayload；FormatTime、WorldLink 等各项归属保持原裁定。不能把整个 Core 简化归入个人层以改写所有权。WorldStateSnapshot 的不可序列化品牌不能传输；传输的是 data-only 序列化值，在接收端依完整文件分层组装 Core 并重新认证。普通 WorldCoreStateSnapshot 允许缺项，不能因类型名称便宣称完整。

当前没有共享 WorldChangeLog/WorldCheckpoint 的生产载体与完整导入 codec；七项也未覆盖全部个人媒体，例如历史个人层截图/入场视频。故本轮只能冻结分层原则，不能正式冻结完整 v1 FileCarry schema，更不能用空对象/空数组虚构已实现共享层。契约草案保留这些不透明前置类型，失败为 Incomplete/UnsupportedBoundary，绝不返回完整迁移成功。完整迁移与“仅 Core 的受限传输”须由 P4 选定范围。

## VERDICT-295 · 服务端口与适配范围【确认】

B2.4a 不接真实外部服务、不创建 service/sync 模块、不改依赖矩阵。本轮只提供 data-only 契约草案。建议 B2.4b～e 先用注入的本地**共享权威测试适配器**验证两设备协议；适配器必须明确标注 ContractAdapter，两个独立 localStorage 不能各自充当同一账号服务，不能宣称真实跨设备服务已验收。真实接入仍需解除 stage-1 的服务排除范围并提供服务端、认证、设备身份和部署责任。

`AuthService` 负责账号认证、允许同步的轻量账号事实、服务器时间、世界归属和账号暂停，不上传/备份世界存档。`CommitRelay` 只中继 WorldCommit，不保存个人层或完整共享状态/检查点；不能借迁移把 FileCarry 作为云端备份。FileCarry 是用户携出/携入载体。

`fetchServerTime` 必须来自已认证 AuthService 的服务器时间能力；真实适配器是经认证服务响应，测试适配器是可控服务器时钟。无服务不返回本机 Date.now 冒充服务器。无跨设备权威时拒绝新登记/复制判定/Release/Claim/解冻；已有本机世界仅能在将来被批准的有效离线资格中继续至 SafePoint。B2.3 原有本地功能基线本轮完全不改，不能把尚未实现的离线资格说成当前已有。

## VERDICT-296 · OfflineGrace 与 SafePoint 不能整体留到 B2.5【依赖裁定确认；平台契约受 P2 阻塞】

若 B2.4d 要交付真正迁移和 RealityPause，则 B2.4 必须同时具备 OfflineGrace、安全点准入与暂停边界，以及可信时钟/授权资格验证。否则无法论证全账号冻结及旧设备不能继续推进。不能仅把常量 1 小时接入 UI 就称宽限已实装。

可以将真实外部服务部署留到 B2.5；不能将 B2.4d 的安全所需机制全部延后却宣称迁移 Complete。宽限到期不打断演奏，下一 SafePoint 暂停；迁移发起在活动谱面、结局回映等未支持边界显式 UnsupportedBoundary。精确安全点集合及世界保存/账号提交排空证明交 P2。

## VERDICT-297 · 三个 key 前缀【命名确认；内部 schema 待冻结】

| key | 角色 | 权威限制 |
|---|---|---|
| `neurou-world-home-registry-v1:` + encodeURIComponent(accountId) | 本设备账号归属缓存与已验证服务 receipt | 服务器为真源；不得靠本地 cache 写入改变全局 HomeDevice |
| `neurou-reality-pause-v1:` + encodeURIComponent(accountId) | 暂停缓存/恢复证据 | 不是发起设备跨账号绑定的全部存储；本地删除/倒计时归零不能解冻 |
| `neurou-migration-v1:` + encodeURIComponent(accountId) | 本设备该账号的可恢复迁移事务日志 | 与归属表、永久 Core 分离；成功清理规则和事务 schema 受 P3/P4 阻塞 |

编码沿用现有 encodeURIComponent(accountId)，不能采用裸账号、拼接未编码 ID 或冒出同义前缀。本轮冻结前缀及角色，**不写任何新 key**。保留 v1 不代表载荷 schema 已全部冻结。WorldRegistry 本机位置载体、设备级绑定存储与导入日志是否需要独立 key，均在协议解冻时正式补提，不复用 fork journal 填塞迁移数据。

## VERDICT-298 · 锁域与顺序【既有顺序确认；新协调锁为草案】

B2.3 不变：源世界 lease → 新目标世界 lease → 账号目录锁；目录锁最后，回调内不得等待世界 lease；持 lease 才写，无 Web Locks/ifAvailable 能力时明确拒绝。运行和账号通关的既有顺序不改。

Web Locks 仅覆盖本设备/同 origin 的锁域，不能被描述为跨设备源→目标全局锁。B2.4 候选顺序：本地所需世界 lease（本地分叉仍源→新目标；远端导入只取本地目标；迁移同 ID 只取本机一把）→ 本地账号跨设备事务协调锁 → 账号目录锁。不得在目录锁回调发网络请求或等待远端锁，也不得为获取世界锁而反向持有目录锁。远端归属操作应使用版本比较与幂等事务，而不是“跨设备 Web Lock”。

是否新增 `neurou-cross-device:<encodedAccountId>` 协调锁、怎样与账号通关在途事务和恢复共用，属于 P2/P3 的受阻草案，尚未正式冻结。旧锁顺序不能因新方案而暗改。

## VERDICT-299 · 目录唯一提交点的适用范围【本地规则确认；全局迁移事务受 P3 阻塞】

目录追加继续是 B2.3 和跨设备**新目标在本机发布**的唯一 commit point。世界未目录发布不可激活；发布后日志清理失败不能回滚该世界。该规则不意味着一个本地 localStorage 写能原子提交服务器 HomeState、账号暂停、源设备资格和目标目录。

WorldMigration 必须分别说明“服务归属认领权威点”与“本地目录发布点”，并用可恢复协议保证一致才开放世界。这是待 P3 批准的范围解释；若用户要求目录追加是整个全球迁移的唯一提交点，现有本地存储与外部服务无法满足，需要另行架构。

建议服务 Claim 成功后、目标发布前持续保留事务日志，失败不撤销已认领事实，不自动删日志；恢复到相同 receipt、载荷摘要与同 ID 目标时才开放。源资格失效由服务归属版本决定，不能等“源删文件”才生效。具体 journal phase、claim receipt、回退/迁回、碰撞与清理规则全部待 P3，不能套用 fork 的 revision=0 回滚删除器。

## VERDICT-300 · 子阶段与不变式【确认；整体进入实现受阻】

接受 B2.4a/b/c/d/e 的拆分方向，具体入场/出场门槛见 `stages-and-open-items.md`。B2.4b～e 的新增源码实现须等 P1～P4 的相关前置裁定闭合及 Trae 落盘正式名库/规格；不能把本轮草案自动升级为授权。

沿用 INV-10 世界运动门控、INV-12 同一音频时间线与暂停后映射重建、INV-13 输入上下文覆盖；不停止整个 FrameDriver，不补算暂停世界运动。沿用七项同主 key，不增加四份 section key；Complete 须七项及内容引用重新认证，Restored 须唯一输入/driver 与真实对象图发布成功；活动状态 UnsupportedBoundary；持 lease 才写、无锁显式拒绝；本地新目标目录追加唯一提交点。沿用 RealityPause≥OfflineGrace，同时不得把该不等式冒充跨设备排空证明。

不修改 B2.1/B2.2/B2.3、A/B/C/T6/T7/编辑器核心、docs/名库/参照；逻辑层零 cc，presentation/组合根平台适配边界保持。三条门禁真实运行结果见 `gate-results.json`，仅证明未改源码时基线健康；本轮没有机制测试或双档 Cocos 新机制验收。
