# B2.4c 交付报告 · CrossDeviceDuplicate 受限 Core 原型

2026-10-10。B2.4c 已完成：先冻结 VERDICT-311～325，再以独立远端适配器完成可信载荷验证、复制权限、新 UUID 七项重键、服务先登记、本地目录发布、journal 恢复与打开准入。三门禁、三组 ContractAdapter 契约和实际 Creator 双档 A→B 验收通过；保护审计通过。没有待处理 PROTOCOL 阻断。

## 正式裁定与 Trae 材料

- [VERDICT-311～325](verdicts-311-325.md)：15 条正式裁定，覆盖 A～F。
- [名库 v3.13 冻结附录提案](namebook-v3.13-frozen-appendix.md)：历史补登、本轮冻结 API/key/phase/组合名、后续尚未冻结项。交 Trae 落盘；本轮未修改或发送正式名库。
- [接口/数据形状/崩溃恢复契约](contract-schema.md)：七项线格式、proof、request/plan/journal/receipt、锁与恢复表。

A：冻结 CoreTransferPayload / CrossDeviceImportAdapter / CrossDeviceImportJournal / CrossDeviceImportReceipt 和独立 `neurou-cross-device-import-v1:<encodedAccount>`。

B：schemaVersion=1、kind=RestrictedCoreTransfer；state 保持既有 Core v1 七个具名 sections。品牌不传输；接收端重新 parseComplete 加正式发布 chart/visual/media 清单验证。

C：直接复用 rebaseWorldState 和同一本地目录追加发布语义；不调用 prepareWorldFork，不复用旧 Fork journal/事务，不伪造来源 lease。

D：服务先登记，接收设备为新 UUID HomeDevice；源归属不变。源 HomeConflict 必须有精确源 proof 与当前归属才分流复制；目标 HomeConflict 永远拒绝本地发布。

E：Prepared → HomeRegistered → Published；永久保留 Published receipt。服务成功本地失败重试同 ID；本地已发布服务缺失拒开并对账。目录成功但标记失败也拒开；不删除已发布世界伪装回滚。详细故障表见契约稿。

F：新增 CrossDeviceContractAdapter 包装共享 WorldHomeContractAdapter；原 b adapter 不改。增加绑定端口 publishTransfer/verifyTransfer，源发布 proof 与当前服务归属检测分开。

## 修改文件与 diff

[完整代码 diff](code.diff) / [机器可读清单](change-files.json) / [保护 SHA 审计](protected-final-audit.json)。没有 Git 仓库；diff 使用改动前逐文件原始副本与 SHA256，不宣称 Git 提交。

|源码|改动|
|---|---|
|src/director/CoreTransfer.ts（新）|线格式 codec、六路结果、接收端认证、权限、远端重键计划和 journal 解码。|
|src/director/CoreTransferContent.ts（新）|正式冻结谱面、视觉和媒体描述符引用核验。|
|src/presentation/CrossDeviceContractAdapter.ts（新）|共享权威包装、绑定发布/精确历史 proof 验证。|
|src/presentation/CrossDeviceImportStorage.ts（新）|独立导入 journal/锁、服务登记、目标 Core、目录追加、恢复和当前归属打开 guard。|
|assets/scripts/CrossDevicePrototype.ts（新）|Cocos 组合根/受限原型面板、独立 B 存储和真实 lease、资源及宿主生命周期。|
|src/director/IntentPort.ts|仅在原文后追加冻结的 type-only 导出。|
|assets/scripts/WorldFolderBuilder.ts|仅插入独立原型接线/生命周期/正式运行入口；所有旧行保留，旧本机 Fork 事务不改。|

5 个新 TS 各带独立 .meta，合计 12 个 canonical 源码/元数据文件。junction 下是同一文件别名。603 个原保护路径扩展到 621，原路径仅两份实际源码扩展（IntentPort 的 junction 别名计为第三路径）；无意外修改、新增或删除。344 份原始源码/配置副本完整。旧 B2.1/B2.2/B2.3/B2.4b 核心、A/B/C/T6/T7/编辑器、docs/正式名库/参照及检查脚本 SHA 保持。纯逻辑零 cc；presentation→director 仅 IntentPort type-only。

## 三条门禁

|门禁|实现前|最终实现后|
|---|---|---|
|npm run check:naming|PASS，0 ERROR / 22 既有 WARN|PASS，0 ERROR / 相同 22 既有 WARN|
|npm run typecheck|PASS，exit 0|PASS，exit 0|
|npm run check:dependencies|PASS，111 TS / 388 依赖，0 ERROR|PASS，115 TS / 407 依赖，0 ERROR|

原 WARN 均既有痕域命名启发式结果，本轮没有新增 WARN 或放宽检查规则。基线 [results.json](baseline-gates/results.json)，最终 [gate-results.json](gate-results.json)，全部命令原始日志保留在对应目录。

## 契约测试 · 全部标注 ContractAdapter

|测试组|结果|证据|
|---|---|---|
|领域、导入、存储故障恢复|59/59 PASS；验证期间生产源 SHA 不变|[contract-results.json](contract-results.json)|
|共享权威包装与正式内容边界|22/22 PASS|[adapter-content.contract-results.json](adapter-content.contract-results.json)|
|实际原型组合根生命周期/初始化|6/6 PASS|[prototype-contract-results.json](prototype-contract-results.json)|

测试使用真实发布内容、真实领域 codec/重键/存储与真实 lease 实现，注入身份/时钟/锁/故障和组合根 cc 资源 seam。它们不是物理设备/真实认证/外部服务证据，也不替代以下 Creator 验收。[独立审查](peer-review.md) 已 PASS，所发现的锁反序、销毁后异步发布、revision0 合法替换、部分初始化失败均已修复并有回归。

## 验收证据逐条对应

|用户验收项|证据/结果|
|---|---|
|七项载荷 round-trip、接收端重新 parseComplete|C01～C05；无品牌传输、深冻结独立副本、缺/null/未知/访问器/symbol/循环/稀疏拒绝。|
|正式内容引用核验|C06～C08 + 内容组；即使自行重算内部摘要，非正式 chart/visual/media/narrative 引用仍拒绝。|
|CopyPermission / 无权限拒载|C17～C18；显示“档案损坏”，账号一致且 CopyPermission=FirstWorldCleared，只读事实源；拒绝前不调用 UUID/事务/时钟工厂，不修改载荷。|
|有权限 → 新 UUID、七项重键、目录追加|C19～C20、C24～C28、S01；独立适配器无需本机源目录/源 lease；目标真实 lease；源 ID 和目标 ID 不同。|
|FormatTime 保留 / Inherited|C20、C22～C23；实际 ForkWorldClearSession 不生成新通关事实；未完成源不制造完成。双档 09、10 PNG/只读状态。|
|源文件不改 / 账号事实不复制|C21～C23；双档 08～10 源 Core bytes 与 A account record/projection bytes 完全保持，B namespace 没有账号事实 key。|
|服务登记幂等、目标 HomeDevice B|C28、S06～S08、S23；同 registrationId，源 HomeDevice A 保持，新目标 B；目标 HomeConflict 不覆盖。|
|服务成功本地失败|S07、S09～S14；保留 Prepared/HomeRegistered 和暂存 Core，同计划恢复追加一次。|
|本地已发布服务缺失/失败|S16～S18；先拒开，随后同 ID 登记对账；不移除目录/Core；冲突仍拒开。|
|崩溃恢复|S04～S15；五个实际 durable write prefix 在新存储对象恢复；包括响应丢失、原子写后抛错、目录成功但 receipt 失败。|
|锁 / 无 Web Locks / 打开门控|S02～S03、S25～S28；import→真实 target→directory，服务等待不持目录锁；打开 await 前后查真实 target lease。|
|碰撞、破坏日志、revision0 替换、墓碑|S08、S19～S24、S29；保留原数据；合法 revision1 进展可打开，另一合法 revision0 不能替换计划。|
|Released/future ownership 不猜迁移|C16、S30；历史 proof 与当前归属分开，c 不产 Migrated、不执行 claim。|
|组合根安全与初始化恢复|P01～P06；Core 成功目录失败复用原 FormatTime，销毁后不继续发布/创建运行图，释放真实 lease。|
|A 创建世界 → B 导入，同一 ContractAdapter|Creator 两档实际控件完成 InitialWorld，自然原生 6 秒媒体结束获得账号事实；本机 Fork 为新 UUID，再 A 发送/B 导入；没有快照/存储/向量/时钟注入。|
|两档分辨率一致|1920×1080、2560×1440 各 11 张原始 CDP PNG；viewport/canvas/PNG 精确匹配；B Restored/Complete/Inherited、同七项和来源/账号事实保持、无横向溢出。|
|最终代码确实运行|31 个源码映射匹配本地源码，served chunk SHA 匹配 Creator 编译产物，验收前后不变；零 renderer/runtime 错误、零外部网络请求。|

最终 [Creator JSON](creator-preview-results.json) / [运行日志](creator-preview.log) / [进程生命周期](creator-preview-lifecycle.json)。截图入口：

- [1920 B 发布](1920x1080-08-device-b-published-seven-section-copy.png)，[1920 正式恢复](1920x1080-09-device-b-restored-inherited-formal-runtime.png)。
- [2560 B 发布](2560x1440-08-device-b-published-seven-section-copy.png)，[2560 正式恢复](2560x1440-09-device-b-restored-inherited-formal-runtime.png)。

首轮成功但尚未加固的报告保留在 pre-hardening-preview；旧 Creator 缓存被编译一致性断言拦截的诊断在 stale-compilation-diagnostic。最终结论只使用根目录中加固后重跑的通过报告。刷新资源和正式预览使用 [computer-use 技能](C:/Users/Administrator/.codex/plugins/cache/openai-bundled/computer-use/26.1002.52244/skills/computer-use/SKILL.md)；没有向 Trae 或第三方发送消息。

## 新增命名与后续事项

新增核心名：CoreTransferPayload、CoreTransferProof、CoreTransferCodec、CoreTransferCompleteValidator、CrossDeviceAuthorityPort、CrossDeviceDuplicateResult、CrossDeviceImportRequest/Bindings/Adapter/Plan/Phase/Entry/Journal/Receipt/RecoveryResult、CrossDeviceContractAdapter/Bindings、CrossDeviceImportStorage/Bindings、validateCoreTransferContent、CrossDevicePrototype/Bindings、LogicalDeviceStorage。公开方法、内部组合/DOM 名、key/锁逐字清单见 v3.13 附录。

无本轮待裁定阻断。以下是明确的范围边界和后续实施项：

- ContractAdapter 是同 realm 两个逻辑设备的内存权威；B 仅世界存储持久化隔离，账号权限通过同账号既有受信只读源读取。测试可保留共享权威并重建本地对象验证崩溃恢复；整个权威进程重启后不具备服务持久化/真实登录。缺可信 proof/归属时拒开，不以 receipt 缓存伪装服务成功。
- Published receipt 在 c 永久保留完整计划，未实施压缩/容量上限/垃圾回收；不能由此宣称完整备份文件或媒体迁移。外部服务持久化、账号事实权威读取、认证与加密需 B2.5 冻结。
- Migrated 名称保留但 c 无迁移证据生产者；归属版本变化 UnsupportedBoundary，Released 拒绝 claim。d 入场仍须冻结主动 SafePoint 排空、MigrationRelease/Claim、RealityPause 全账号执行与时间协议，不在本批实现。
- 完整 FileCarry、WorldMigration/RealityPause、WorldRegistry 本机位置 API、账号切换执行端口、AccessCode/ObserverSync 均按本轮排除范围留后续。
- 正式名库 v3.13 的 Trae 落盘属于外部交接；当前冻结材料已交付，未改 docs 或等待其更新冒充代码前置。

复现命令：`node quality-review/b2-cross-device-core/contract-tests.cjs`、`node quality-review/b2-cross-device-core/adapter-content.contract.cjs`、`node quality-review/b2-cross-device-core/prototype-contract-tests.cjs`；Creator 已编译最终源时 `node quality-review/b2-cross-device-core/run-preview.cjs`。门禁和 SHA/diff 生成器保留于本目录。
