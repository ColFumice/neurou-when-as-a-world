# PROTOCOL-B2.2-001 · 世界通关链路与完整恢复的新前置

日期：2026-10-10。状态：等待范围裁定；生产代码未修改。停工来源：本轮用户约束“若发现新的架构冲突或‘前置缺失’，先停止，提交 PROTOCOL”。不是权限工具拒绝，也不是技能附加的审批要求。

## 已先提出的拆分

B2.2a 做账号事实的本地投影与 CopyPermission 派生；真实触发必须保留 WorldBossChart，不能用 T7 普通完成替代。B2.2b 先做世界状态契约和诊断捕获；完整恢复前置必须单列。WorldFork 与 FileCarryPayload 仍归 B2.3。详细十五项设计裁定见 VERDICT-211-225.md。

## 新增缺失与冲突证据

| 问题 | 精确证据 | 为什么不能直接实施交接里的完整验收 |
| --- | --- | --- |
| WorldBossChart 不只是换 tier | 历史 JSONL:74 VERDICT-017；:132 VERDICT-042。现行入口要求 Player 追加、主角坐标在球面上/外、角色尚未穿越。src/ledger/LedgerPosition.ts:35 只有基础坐标运算；src 中无 SphereCrossing 业务实现。 | 必须补账本驱动入口、球心/半径来源、世界身份和合法内容装配；把现有 T7 标为 World 会绕过已冻结条件。archive/ledger/SphereCrossing.ts:65 还是旧比较且等号在内，不能直接搬入。 |
| 通关记录缺少路线签名来源 | 历史 JSONL:62 VERDICT-013；当前 IntentPort.ts:668/930 是零向量灰盒；docs/spec/stage-1.md:404 明许灰盒并将真实向量推迟。 | 世界通关必须生成带 RouteSignature 的账号记录。旧灰盒必须原样保留，不追溯补向量；零向量不会达到正半径，也没有全零/并列方向的合法分类实现。随机方向或把 score 当路线都没有授权；只写布尔不是完整世界通关事实。 |
| T6 的 ChartRef 与首演判据存在兼容问题 | IntentPort.ts:928/940 在解谜终点尚未完整演奏时已带 ChartRef；:674/682 又在 T7 完成写同谱面引用。VERDICT-030（历史:97）要求完成账本引用作为首演事实。 | 不能扫描到任何 ChartRef 就宣称首演完成/分叉具备快照，更不能据它开放复制。兼容既有 T6/T7 记录需要明确识别方案，用户同时禁止改其核心。 |
| 账本读取并非必然权威 | IntentPort.ts:261/272 默认数组和 getLedgerEvents；:350/351 bindLedgerAppend 可替换实际 sink；ledger/LedgerRead.ts:35 只有接口。 | 读取默认数组可能漏账本。捕获完整性不能仅由“读口返回数组”判断；必须有同一权威载体和角色归属。 |
| PuzzleProgress 不是只有 stage | PuzzleChain.ts:88/91/94/97 连续计时与拍点；IntentPort.ts:301/306/309/323 结算/入口/完成闸；DeepTrace.ts:46 触发态。 | 恢复 Completed 到旧逻辑却不恢复结算闸，可再次进入 IntentPort.ts:857→907 的终点结算。七秒进度直接归零同样改变玩法结果。 |
| 谱面结果不是冻结快照或续演状态 | ChartPremiere.ts:63 ChartPlaybackResult；:122～136 判定/进度/媒体/反馈私有状态；Note.ts:33、GuidanceChart.ts:76、KeyboardPadLayout.ts:132 是输入数据；SceneBuilder.ts:867～911 媒体与谱面加载。 | 只有 chartId/score 不能重玩历史内容；路径变更不能改变已经冻结的快照。Playing/Paused 的完整续演额外涉及逻辑时钟与资源生命周期。 |
| 新里程碑 key 已被序章占用 | presentation/FolderStartupView.ts:32，AccountStartupStorage 保存 `{PrologueCompleted:true}`。 | 新存储若复用 `neurou-account-milestone-v1:` 独立 setItem 会覆盖序章；本轮裁定使用不同 key，避免要求修改 B1。 |
| 部分机制仅有名词/空接口 | WorldInstance.ts:39 FormatTime 空接口；RecallCount/WorldLink/ChartSnapshot 无现行载体；Bootstrap.ts:54 RuntimeGraph 没有 WorldInstance 实例身份。 | 最小 JSON 载体可另做，但不能自动等于机制已实装或世界快照已完整。必须建立所有权、合法写入边界和初始化/恢复生命周期。WorldLink 的孤立恢复还依赖最后进入时冻结的 AIProfileSnapshot（历史:51 VERDICT-009），不能只恢复链接 ID。 |

## 推荐范围 A · 独立基础先交付

恢复实施以下明确项目，核心玩法保持既有行为：

1. AccountMilestoneStorage/Reader：独立账号 key、严格版本和账号校验、CopyPermission 派生、失败保留与缺失/损坏区分；不产生真实通关记录。更新口仅预留给未来 director 的合法事实处理，产品 UI 不提供写 true 的按钮。
2. 目录添加权限读取展示，WorldForkAvailability 仍 NotImplemented；显示权限未取得/已取得与功能未实施的准确区别；已有 WorldFolderRecord、新建/删除逻辑不扩。
3. WorldStateCaptureResult 的 Complete/Incomplete 契约、七项索引、诊断投影；当前已知缺失保持 Incomplete。部分快照只用于诊断与契约验证，不能作为正常存档，也不能用于分叉。
4. WorldStateStorage 边界与完整 schema 校验规划，FormatTime 最小载体/初始化规则另附候选；不让空值通过完整性检查，不实施既有 runtime hydration。
5. 契约级验证覆盖账号隔离、key 不覆盖序章、派生量不保存、非法投影拒绝、捕获缺失诊断、完整恢复拒绝、目录墓碑不改账号投影。Cocos 可验目录读取展示和 Incomplete 提示；不能验真实通关/完整恢复成功。

必须同意把本批验收命名为“B2.2 基础接口”，真实世界通关写入与完整 gameplay 恢复成功移出，另立前置批。测试合法输入存储可以验证适配器，但必须标为契约测试，不能拿测试输入得到的 CopyPermission=true 截图充当生产通关流程。

## 范围 B · 保留完整 B2.2 验收，扩大前置实施

若本轮必须看到真实“通关事实写入 + CopyPermission 解锁 + 完整捕获恢复”，需明确纳入并允许增量接入这些范围：

- 最新 SphereCrossing、账本驱动入口、WorldBossChart 的合法内容来源与装配、WorldInstance/角色身份；球心/半径配置和路线签名输入不能由实施端伪造。
- 权威账本载体，T6 endpoint ChartRef 与 VERDICT-030 首演判据的兼容处理，稳定事件/角色索引，新增受控 hydration 接口；明确“允许必要接口接入而保留规则”对原“不改核心逻辑”约束的适用边界。
- RecallCount 合法行为、WorldLink 创建/孤立语义、ChartSnapshot 首演冻结、ChartScore 持久更新语义。
- 选定稳定保存边界或明确进行中续演要求；恢复时防重闸/深痕/媒体时钟的接入；世界账本/快照与账号通关记录的可恢复提交/对账方案。

以上都保留现行冻结语义，不重新裁定 013/014/030/042/057。不扩进 WorldFork、FileCarryPayload、WorldRegistry、跨设备、服务、观察者同步或 AccessCode。完成这些前置后，B2.3 才能安全实现 WorldFork。

路线分类实现必须核对最新成员冻结和并列规则，不能照搬早期六色标签或 archive 的未完备枚举。当前本轮不实现分类、不追溯改灰盒账本，也不重新选择分歧方向。

## 本次可核实交付

十五项设计裁定、七项归属表、存储/API 提案、名库 v3.7 附录、逐条验收映射、基线三门禁/源码保护哈希/预览编译只读证据已准备。未修改生产代码；没有 B2.2 实现成功 diff 或三张请求场景截图。

需要裁定的是具体实施范围 A 或 B。推荐 A；不能默认把“拆分建议”当作用户已经接受削减真实通关与完整恢复验收。
