# B2.2a + B2.2b 代码审查

日期：2026-10-10（Asia/Shanghai）。审查结论：本批生产接口与用户收敛后的 1～12 项验收边界一致，未发现尚待修复的生产代码阻断问题。第 13 项两档 Cocos 预览与三条门禁由主任务最终运行并归档；本审查不把契约测试或代码阅读代称为生产截图验收。

审查对象：AccountMilestone.ts、AccountMilestoneStorage.ts、WorldStateSession.ts、WorldStateStorage.ts、WorldFolderView.ts、WorldFolderBuilder.ts、IntentPort.ts 新增类型转发及对应 meta。审查基于实际当前源码，不以旧 B2.1 截图作为证据。

| 用户验收项 | 源码证据及结果 |
| --- | --- |
| 1. 独立首次通关 key、保留序章 key | AccountMilestoneStorage.key 仅使用 `neurou-account-first-world-cleared-v1:`；既有 AccountStartupStorage 不在实施修改面。独立适配器契约覆盖编码账号及序章/目录原始字节保留。 |
| 2. 严格解析、隔离、失败保留 | 持久化 JSON 经适配器严格解析；缺失才返回 null，JSON null/损坏/非法字段不降级成 false。Reader 再做领域校验。所有适配器失败均不清理原始 key。 |
| 3. CopyPermission 只读派生 | Reader 仅从已校验 FirstWorldCleared 得到 CopyPermission；保存边界只允许 schemaVersion/accountId/FirstWorldCleared 三字段。生产搜索未发现 `saveProjection` 调用者或 FirstWorldCleared=true 生成路径。 |
| 4. 单向事实 | 保存检查实际 current 和 expected；两者任一为 true 都拒绝 false，因此过期 false reader 不能覆盖存储 true。合法 true→true 可通过；expected 过期显式拒绝。 |
| 5. 损坏/版本/身份显式拒绝 | 账号边界校验 canonical 1～64 字符及编码；字段必须恰为三个自有数据字段，版本为 1、身份相同、事实为 boolean。适配器/Reader 均拒绝访问器、异常 Proxy、继承对象。 |
| 6. WorldState 候选头部 | 完整品牌类型有七个候选头字段。目录捕获对尚无权威来源的 worldKind/shoreOrigin/revision 明确写 Unavailable，而非伪造 Primary/null/0；candidate 不具备完整快照品牌。 |
| 7. 七项归属类型契约 | WorldStateReader.ownership 为冻结 metadata；七项 codec 都固定 NotImplemented，FormatTime 的 `{epochMs}` 仍为 proposal。Observer 索引保留 world/account 身份；账号通关事实不混入世界状态。 |
| 8. Complete/Incomplete | CaptureResult 为判别联合；完整 Snapshot 的不可构造品牌隔开候选头部与有效完整状态。当前没有 Complete 生产者。 |
| 9. 缺失返回诊断 | captureWorldState 固定返回 Incomplete，逐项七项缺失 + 身份/版本/运行边界诊断。capturedParts 空对象明确表示未捕获权威载荷，不将空值包装成完整状态。 |
| 10. 完整恢复拒绝 | restoreWorldState 始终返回 Rejected + RestoreUnsupported；Header 校验通过也不会恢复成功。WorldStateStorage.saveSnapshot 始终抛错，Incomplete 和伪造 Complete 均无写路径。 |
| 11. Fork 固定未实施 | WorldForkAvailability 类型与 Session 值固定 NotImplemented；原 WorldFolderSession 的 WorldFork 拒绝行为未改。 |
| 12. 准确展示 | View 分别显示复制权限与分叉未实施。分叉按钮仍提交原 WorldFork 意图；仅将既有“分叉尚未开放”异常映射为重新读取后的真实复制权限文字 + “分叉功能尚未实施”，其他异常仍原样显示。Reader 错误显示失败且先清理旧 true attributes，不回退成“权限未取得”。新诊断先清空前次 completeness marker；刷新隐藏旧诊断面板。Builder 每次里程碑读取重读账号 key，诊断/恢复前重读并校验 active world 目录成员。 |
| 13. 两档预览/三门禁 | 独立于本审查，由主任务归档最终执行结果。契约测试真值 fixture 不视为通关流程，不应截为生产通关成功。 |

## 实施范围复核

全项目生产搜索 `FirstWorldCleared|CopyPermission|saveProjection|restoreWorldState|captureWorldState`：新增 FirstWorldCleared 保存能力仅存在适配器方法，生产组合根只有读取调用。没有按普通 T7 完成写入首次世界通关，没有权限 setter/模拟通关意图。状态诊断在目录中构造 Session，不装配 gameplay 对象、不访问 DirectorSession 账本、不加载或恢复世界实例。UI 捕获文本只称“状态捕获基础接口”和 Incomplete，不声称当前运行世界已保存。

基线比对：现有业务源码只改 WorldFolderBuilder、WorldFolderView 和 IntentPort；IntentPort 保留原文件完整前缀，只追加 type exports。WorldFolderRecord、WorldFolderSession、AccountStartupSession、T6/T7、编辑器及其他核心逻辑均未出现基线内容变化。`assets/scripts/src` 是指向根 src 的既有 Junction；不是第二份被遗漏的源码。

## 审查中已修复的问题

首次通关 parser 原先检查 descriptor 后再次读取 raw 字段；在实际 JSON 路径外，恶意进程内 Proxy 可让校验值和发布值不同。经主任务明确授权，仅修改两个新增 milestone 文件：一次读取自有 descriptor 值，拒绝非 plain/null prototype、访问器和异常 Proxy，并移除保存时预读 `projection.accountId`。未新增公开 API、模块或依赖。新增三项契约测试：不触发 get trap 的 descriptor capture、revoked Proxy/继承对象拒绝、accountId getter 不执行。

`account-milestone.contract-results.json`：26/26 通过，全部标为 ContractTest。世界状态和 DOM 契约由主任务在最终源码上刷新结果；旧 source hash 不代替最终源码证据。

最终按钮文案复核：WorldFolderView fork catch 只匹配 Error.message 恰为“分叉尚未开放”的既有错误，不修改 Session、意图提交或可用性。该分支先 refreshMilestones，再读取权限元素实际文字，因此显示未取得、已取得或读取失败都与最新读取一致；不会将“功能未实施”写成“权限缺失”。DOM 契约 D06 已针对已取得 fixture 断言“复制权限：已取得”与“分叉功能尚未实施”同时存在，且目录快照不变；该 fixture 仍只属于契约测试。

## 并发外部文档变化（单列，不恢复）

审查发现 docs/NAMEBOOK.md 和 docs/spec/stage-1.md 相比任务起始 baseline-files.json 有变化。此审查 agent 从未写入这两个文件；本轮所有写入工具只涉及任务分配的新 milestone 源码/meta、契约测试与本审查报告。未修改、恢复或覆盖外部文档变化。

只读观察：NAMEBOOK 最后修改时间为 2026-10-10 17:15:00，尾部新增名库 v3.7；stage-1 最后修改时间为 17:15:23。时间与内容提示并发外部同步，但文件时间与内容不足以证明作者，报告不作作者归因。主任务需在最终变更清单将其与本实施产物分列，不能声称所有受保护文档与起始基线字节相同。

当前 SHA-256：NAMEBOOK `1f9f2c7ad622f7551f8539d1882aa47e7c73cf5014cad02ba5c8439c7c8ad170`；stage-1 `2169145d5bcc0ead9da062cd0170ddfa85044679d8dfa811ce65fa158b3c4b88`。

## 审查源码指纹

| 文件 | SHA-256 |
| --- | --- |
| src/director/AccountMilestone.ts | ea937e6676b97cafd8a726d051db54d16077a9fe82438cce8374a4635d1b846e |
| src/presentation/AccountMilestoneStorage.ts | ec36e1490443d5ca59c983119e56f5273a0d62e8522f9171fb21be7b05c0ac19 |
| src/director/WorldStateSession.ts | dee799181f9216ce6244c0087ba5dba830ea481cd8140591ec0f7ad099ecfecb |
| src/presentation/WorldStateStorage.ts | 95e03b7610946041e0aa635d37cf5790b17cdd37d3ed7272080a5b69815e8056 |
| src/presentation/WorldFolderView.ts | 6d728d3fc775065b46921864f013d9575c964004f60918508f352d2f3e4d9a7d |
| assets/scripts/WorldFolderBuilder.ts | 1f27ca70c8ce82fefca4731fb3655edb8d542937933313faf3985362bbab52d2 |
| src/director/IntentPort.ts | b6ec38dbf2e9915cfc3a70d9ab41ac501dd14d22ec49ba94af5763caf3f1365c |
