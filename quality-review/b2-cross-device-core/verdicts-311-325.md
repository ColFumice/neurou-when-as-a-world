# B2.4c 正式裁定 · VERDICT-311～325

依据：本轮 IMPLEMENTER 授权、VERDICT-301～310。仅受限 Core 传输原型；本文件是本轮冻结依据，正式 docs/名库由 Trae 落盘。

|裁定|冻结内容|
|---|---|
|311|载荷名 `CoreTransferPayload`，kind=`RestrictedCoreTransfer`，schemaVersion=1；不称 FileCarryPayload。仅封装七项 Core 的 data-only 值及传输身份头，不携带账号事实、媒体文件、品牌或凭证。|
|312|载荷字段：schemaVersion、kind、transferId、sourceDeviceId、sourceHomeRevision=1、state。state 沿用 Core v1 头及 sections：Ledger、PuzzleProgress、FormatTime、RecallCount、WorldLink、ChartSnapshot、ChartScore，可含既有 forkOrigin。接收端严格数据复制，重新 published-content-bound parseComplete；摘要不替代正式谱面/视觉/媒体引用核验。|
|313|`CrossDeviceImportRequest`（schemaVersion/title/description）、`CrossDeviceImportAdapter`、`CrossDeviceImportPlan`、`CrossDeviceImportReceipt`、`CrossDeviceImportJournal` 正式冻结。远端导入独立于 WorldForkSession.prepareWorldFork 与 WorldForkStorage 事务；直接复用 rebaseWorldState 算法。|
|314|独立 key `neurou-cross-device-import-v1:`+encodeURIComponent(accountId)。journal v1 是账号/设备绑定的 entries 数组；entry phase=Prepared/HomeRegistered/Published，含完整计划及 homeReply。Published entry 保留作 receipt/open guard，c 不清理已发布 receipt。旧 fork key 不变。|
|315|`CrossDeviceContractAdapter` 是新组合包装器，共享既有 WorldHomeContractAdapter；不改 b 核心。绑定端口 `CrossDeviceAuthorityPort` 在原读/登记外提供 publishTransfer/verifyTransfer。源端真实 lease+active 本机目录+Complete 回读后发布；包装器核对当前源 HomeDevice 并记录精确 data-only 载荷，签发 `CoreTransferProof`。接收端需向同一权威验证载荷，不能以载荷自称 deviceId/digest 或 HomeConflict 充当认证。仅 ContractAdapter 测试身份 seam，非密码学/真实 AuthService。|
|316|`CrossDeviceDuplicateResult` 保留六分支。Homed=当前设备首次归属；CrossDeviceDuplicate=已验证传输的源设备仍为 homeRevision1 归属且不同接收设备；Released=已释放但 c 拒绝 claim；Migrated 仅 d 的明确迁移证据可产出，c 不产出；未来归属版本/不支持边界返回 UnsupportedBoundary；服务缺失/无有效 proof 返回 AuthorityUnavailable。InitialWorld 在读取服务/分配 ID 前排除。|
|317|仅 CrossDeviceDuplicate 可走 c 复制。接收账号既有 AccountMilestoneReader 验证 CopyPermission 与 FirstWorldCleared 同账号合法投影。无权限拒载显示“档案损坏”，不改源/载荷/目录，不调用 ID 工厂；不把账号事实放入载荷或写进接收世界。|
|318|新目标 world-UUIDv4，transactionId=`import-`+UUIDv4；源 accountId 保持，目标 revision0、新 capturedAt/forkOrigin、七项身份重键；FormatTime 原值、完成继承 Inherited，不生成 WorldClearRecord/FirstWorldCleared。目标目录 title/description 来自请求，template=EmptyWorld。Primary/null 且静止 Complete 才支持；活动、BugShore/FinalShore 不支持。|
|319|顺序：持独立账号导入锁 → 真实新目标 lease → 写 Prepared journal → 服务 registerWorldHome（幂等 registrationId）→ HomeRegistered journal → 账号目录锁内目标 Core 写/Complete 回读/追加目录 → Published receipt。目录追加是本地唯一发布点；服务登记是另一域的权威点。服务 await 不持目录锁，不持远端源 lease。新增导入锁 `neurou-cross-device-import:`+encoded accountId；本地 fork 原源→目标→目录顺序不变。|
|320|源 HomeConflict 可由已验证 proof 分流成复制；目标登记 HomeConflict 永远拒绝发布/覆盖，保留日志诊断。新 UUID 的 HomeDevice=接收设备，源世界 HomeDevice 不改。这不是迁移。|
|321|崩溃点：日志前无副作用；Prepared 后重用同 plan/ID；服务受理响应丢失重放同 registrationId；服务成功日志失败仍以 Prepared 重试；Core 写后目录前保留暂存重试；目录原子写已成功但异常以目录回读判定；Published 标记失败阻止打开并恢复；Published 后不删除目录/Core。不把服务成功伪装撤销。|
|322|恢复以 journal 解析、权威 proof/当前归属、目标真实 lease、目标 Core/目录一致性协调。已发布但服务缺失/不可用/冲突拒绝打开，登记同 ID 对账后才开放；不删除已发布世界。篡改、错误身份、损坏日志、目标碰撞保留原值并阻断。c 不实现服务登记补偿删除；因此未发布服务孤儿保留待恢复。|
|323|生产原型同一 realm 的 A/B 逻辑设备共享一个 ContractAdapter；B 使用独立持久化世界存储命名空间。接收端 CopyPermission 来自同账号既有只读事实源，不随载荷复制。源 A 由真实 InitialWorld 通关后本机 fork 创建非 Initial UUID。独立新增原型面板明确标注受限/ContractAdapter；B 的打开必须先权威归属+receipt 门控，随后真实目标 lease 和既有正式 World factory。不宣称物理双设备或外部认证。|
|324|沿用 INV-10/12/13、七项主 key、品牌重建、持 lease 才写/无 Web Locks 拒绝、目录追加唯一本地发布点。只追加新模块/组合接线，不改变旧 Fork/Registry/游戏/编辑器逻辑，不修改 docs、名库、参照或放宽门禁。|
|325|验收：ContractAdapter 的七项 roundtrip、内容再认证、权限/拒载、UUID重键/继承、来源及账号事实保持、幂等、两域失败、崩溃恢复、无锁拒绝；实际 Creator 双逻辑设备 A→B 与两档分辨率；三门禁及保护 SHA/diff。真实服务、完整 FileCarry、Migration/RealityPause、WorldRegistry 位置 API、账号切换端口、AccessCode/ObserverSync 留后续。|

冻结时间在实现之前。实现细部类型见代码和 v3.13 附录；新真实冲突仍按 PROTOCOL 停止受影响路径。
