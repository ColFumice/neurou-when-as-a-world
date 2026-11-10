# 名库 v3.12 冻结附录 · VERDICT-301～310 / B2.4b

本文件为正式本轮冻结/实施依据，交 Trae 后续落盘；未编辑 docs/NAMEBOOK.md。覆盖旧 v3.12 提案的受阻标记；不把候选等同已实现。用户明确授权 b，无须先等正式文档落盘。

## 历史名补登（语义已冻结，机制状态另列）

| 名称 | 本次语义/机制状态 |
|---|---|
| WorldRegistry / DuplicateWorld | 本机位置表/复制品加载状态；b 不实现，留 c |
| WorldHomeRegistry / HomeDevice | 账号×非 InitialWorld 世界→设备归属索引；b 实装契约级最小闭环 |
| HomeState | Homed / Released；b 只产生 Homed，Released 仅 codec 历史 schema 校验，不产生迁移 |
| CrossDeviceDuplicate / WorldFork | 检测结果/新 ID 操作；b 不把 HomeConflict 当已判复制，c 受限原型处理；B2.3 本机原机制保持 |
| WorldMigration / MigrationRelease / MigrationClaim / Migrated | 源主动安全点确认→Release/冷静期→Released/Claim；同 ID 迁移/原设备拒载且文件保留；d 实施 |
| RealityPause / OfflineGrace / SafePoint | 全账号服务器冷静期≥1h且≥宽限；源主动排空证明停止；不引 bootId；d 细化，不实装于 b |
| AuthService / fetchServerTime | 轻量认证/归属服务与 fetchServerTime():Promise<number> 历史方法；b 不真实接入 |
| CommitRelay / FileCarryPayload | 中继/完整共享层+本人账号加密个人层；迁移不经 relay；完整 FileCarry 留 B2.5 |

InitialWorld 完全不进入跨设备索引/检测/传输。所有本轮索引 source 必须是当前账号合法 active 自建/分叉目录记录，非其他账号加入世界。

## B2.4b 已冻结类型与文件（本次实施）

`src/director/WorldHomeRegistry.ts`：HomeState、WorldHomeContext、WorldHomeRecord、WorldHomeRegistrySnapshot、WorldHomeRegistrationRequest、WorldHomeRegistrationReply、WorldHomeRegistryDiagnostic、WorldHomeRegistryReadResult、WorldHomeRegistrationResult、WorldHomeAuthorityPort、WorldHomeRegistryBindings、WorldHomeRegistryCodec、WorldHomeRegistrySession。

`src/presentation/WorldHomeContractAdapter.ts`：WorldHomeContractBindings、WorldHomeContractAdapter。type-only 通过 IntentPort 取得上列契约，不值导入 director 验证器；全部严格验证回调由组合根注入。

`src/director/IntentPort.ts`：只追加 type export，旧代码字节前缀保持，不增玩家意图/逻辑行为。

## b 数据字段与字面量（schemaVersion=1）

- WorldHomeContext：accountId / deviceId；trim、可编码、1～64/128字符，来源是绑定的测试会话。
- WorldHomeRecord：schemaVersion / accountId / worldId / homeState / homeDeviceId / homeRevision / updatedAtServerEpochMs。worldId 沿既有 `world-[A-Za-z0-9-]{1,80}`；InitialWorld 拒绝。Homed 对应非 null device，Released 对应 null。homeRevision 为正安全整数，首次=1。
- WorldHomeRegistrySnapshot：schemaVersion / accountId / registryRevision / observedAtServerEpochMs / records。revision 非负安全整数、world 唯一、每项账号一致，record.updatedAt≤observedAt、homeRevision≤registryRevision；返回按 worldId 排序、深克隆冻结。
- WorldHomeRegistrationRequest：schemaVersion / worldId / registrationId，registrationId 1～128 可编码字符，account/device 不可从 request 覆盖。
- WorldHomeRegistrationReply：schemaVersion / accountId / deviceId / registrationId / kind / registryRevision / observedAtServerEpochMs / record；kind 为 Registered / AlreadyHomed / HomeConflict。前二项记录必须 Homed 于当前设备，HomeConflict 必须 Homed 于另一设备。
- WorldHomeRegistryDiagnostic：code / accountId / deviceId / worldId:string或null / detail；code 为 ExcludedWorld / InvalidLocalDirectory / WorldUnavailable / ServiceUnavailable / InvalidAuthorityResponse / InvalidRequest。
- WorldHomeRegistryReadResult：{kind:Available,mode:ContractAdapter,snapshot} 或 {kind:Unavailable,mode:ContractAdapter,diagnostic}。
- WorldHomeRegistrationResult：{kind:Registered或AlreadyHomed或HomeConflict,mode:ContractAdapter,reply} 或 {kind:Unavailable,mode:ContractAdapter,diagnostic,registrationId:string或null}。
- 不暴露缓存 Homed 成功；请求/响应异常均显式诊断。session 观察到的 registryRevision 不回退、已观察 record 不无故消失/改变；无合法服务响应不更新观察状态。b session 只接受 homeRevision=1/Homed 的首次登记索引，完整读取 records.length==registryRevision；Released/其他正归属版本仅 codec 的历史 schema 能识别，不能从中宣称 b 执行了释放/迁移。

所有对象 exact 自有数据字段，无 symbol/访问器/异原型/循环/未知字段；数组仅 length 和连续 index，不接受稀疏或自定义属性。时间/revision 规定范围内安全整数；输出深冻结独立对象。世界权威记录只包含轻量归属，不包含七项/权限/向量/个人媒体。

## b 方法与能力注入

- WorldHomeRegistryCodec：parseContext(raw) / parseRegistrationRequest(raw) / parseRecord(raw,expectedAccountId) / parseSnapshot(raw,expectedAccountId) / parseRegistrationReply(raw,context,request)。返回严格 data-only 冻结副本。
- WorldHomeAuthorityPort：readonly mode=ContractAdapter / readonly context；readRegistry():Promise<unknown> / registerWorldHome(request):Promise<unknown>。请求无账号/设备字段，响应再次解码。
- WorldHomeRegistryBindings：authority:WorldHomeAuthorityPort或null / readFolder():unknown / createRegistrationId():string。目录读取不写；ID 工厂只在合法来源通过后调用。
- WorldHomeRegistrySession：constructor(context,bindings) / readRegistry() / registerWorldHome(worldId)。每个 session/world 保持相同登记请求 ID 供失败重试；每次请求前重验 active 目录；重启无持久 journal，不耦合创建/发布（原世界已存在）。
- WorldHomeContractBindings：now():number / validateContext / validateRequest / validateSnapshot / validateReply，验证签名与上述 codec 对应。
- WorldHomeContractAdapter：constructor(bindings) / bindDevice(context):WorldHomeAuthorityPort / setAvailable(boolean):void。绑定上下文冻结；共享一次同步内存临界操作判定首次归属；不 await 后再写 Map，不调用平台锁或存储。
- 同 account/device/registrationId 必须同 worldId；重放保持同 outcome/record，观察时间与 registryRevision 可反映当前索引；读/重试不更改 homeRevision。不同设备登记已存在世界返回 HomeConflict，不能抢归属；不同账号同 worldId 独立。

## c/d 实施时再冻结（本轮仅方向）

- c：受限 Core 原型载荷名称/完整七项线格式、CrossDeviceImportRequest/导入 receipt/journal/key、服务登记与目录发布恢复；不叫 FileCarryPayload。
- d：源 SafePoint 排空确认类型/持续暂停/确认撤销，MigrationReleaseRequest/ClaimRequest/Receipt/WorldMigrationJournal 完整 phase，RealityPauseRecord/DeviceAccountBinding，迁回/碰撞/账号切换执行端口和协调锁。
- WorldRegistrySnapshot 的真实本机位置载体/API/key 也在 c 冻结，不顺带落 b。
- B2.5：FileCarryEnvelope/加密个人层/完整媒体/共享 codec/账号密钥、真实外部服务认证与部署。
- 不采用旧 DeviceUptimeSample/OfflineGrant/bootId 作为本轮新增安全前置；OfflineGrace 的历史语义保持，实际平台细节另阶段处理。

三个 key 前缀角色保持，b 不写。旧所有 key/锁、七项归属、不变式与核心逻辑保持。本附录的新名称只在当前授权文件内实施，正式文档由 Trae 后续落盘。
