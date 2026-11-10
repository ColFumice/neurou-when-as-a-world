# PROTOCOL-B2.2c-001 · 真实事件向量生产者前置

日期：2026-10-10（Asia/Shanghai）。状态：已解除。用户正式采纳最小内容生产者，并授权原四项与该前置同批实施。以下保留原停工证据与解阻提案；当前落地及验收见 VERDICT-226-240.md、交付报告.md 和验收证据映射.md。

## 停工来源

本轮用户明确要求：**“若发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL。”** 同轮只授权四项，并要求不修改 A/B/C/T6/T7/编辑器核心（T6 ChartRef 兼容例外，保留原行为）。停工不来自技能规则、工具自动审批拒绝或请求普通可逆操作权限。

## 新前置及可复现证据

| 证据 | 结论 |
| --- | --- |
| src/director/IntentPort.ts:655、911 | 当前生产账本追加只调用这两个已绑定 sink 边界。 |
| 同文件:668（T7）、928（T6） | 两个事件构造均固定完整 20 维全零；InputSource.Player 不能使数值自动变成真实。 |
| docs/spec/stage-1.md:416 | 真实 20 维感绪值留到阶段 4；新值接入后旧记录仍保留灰盒、不追溯补写。 |
| quality-review/b2-foundation/VERDICT-211-225.md:11、22 | 已验收边界禁止普通 T7 替代世界通关、伪造方向、灰盒零向量或测试注入冒充路线。 |
| preflight-source-audit.json | AST 审查列出两个生产者及追加位置；两者 allZero=true。零坐标在零球心和任意正半径下恒在球内。算例半径 1 明确是审查 fixture，未写入生产配置。 |

缺失的是 **“真实玩家行为 → 制作方赋予语义的非零 NarrativeVector → director 合法追加”** 的生产者，而不是 LedgerPosition 求和算法。全零向量累计任意有限次仍为零；因此其余四项正确实现后，当前生产内容仍无法走到合法球面穿越。

当前 v3.7 内容确已在 docs/NAMEBOOK.md:827 之后，不再把“待 Trae 确认”当成停工理由。DivergenceAxis 旧同名指标、Primary 身份接线、只写 sink 与默认数组读口不一致、World 资源和首演闸问题，都已由本轮设计裁定处理为实施边界，不再另起阻断。

## 推荐解阻范围：在原整批中追加最小真实内容生产者

不拆 B2.2c，不提前实现完整感绪系统或 B2.2d。允许增加一段制作方编写的 Primary 世界叙事交互及其正式内容配置：

1. 新独立世界内容文件声明 worldKind=Primary、主角身份、EventSpaceCenter=零坐标、有限正 EventDistance，以及每个可选叙事分支的完整 20 维非负向量。
2. 每个向量须有可解释的叙事/情感意义，绑定真实世界内的玩家选择或交互结果；不是 debug 入口、任意 vector 文本框或“直接穿越/直接通关”按钮。制作方内容给出来源与版本，director 校验并决定合法写入。
3. 在独立的世界内容交互处，由 PlayerIntent 提交选择 ID；不得由 presentation 提交向量、账本事件或权限值。director 根据该已发布内容解析分支并构造唯一 NarrativeEvent。
4. 这一生产者走本轮同源账本追加编排，真实累计到球面上/外。旧 T6/T7 仍写原灰盒，仅按裁定扩展 ChartRef 状态，不赋临时权重、不补旧记录。
5. 一并经既有编辑器正式导出该世界唯一的 schemaVersion=3 / tier=World 谱面、视觉和媒体内容，并记录内容来源。不得把现有 Regular 运行时改 tier。
6. 允许在现有 assets/scripts 组合根和新 presentation 视图接入该交互、World 谱面入口和进度展示；旧玩法结果、门控、退出与记录条数保持。

这只补真实通关所需的正式内容生产前置。禁止扩到完整自动感绪计算、状态 hydration、WorldFork、FileCarryPayload、WorldRegistry、跨设备、服务、观察者同步或 AccessCode。

## 可替代的解阻输入

若已有合法生产者在别处，只需指定其仓库路径/模块、触发玩家行为、20 维语义规则、主角归属和接入边界；IMPLEMENTER 先验证其确为生产内容，再接入本批。只有一组测试向量、未执行的接口或历史测试截图不满足该输入。

## 建议 PROTOCOL 回复原文

> 同意在 B2.2c 原四项整批内加入“最小正式世界叙事内容生产者”：由 ARCHITECT + IMPLEMENTER 编写有明确语义和版本的 Primary 世界交互内容及非零 20 维向量，通过选择 ID 的意图由 director 合法追加。允许独立内容与调用链扩展；旧 T6/T7 灰盒原行为保持，只做 ChartRef 状态兼容。不实施完整感绪系统或 B2.2d。沿 VERDICT-226～240 一次完成原 B2.2c 全部实现、三门禁和两档 Cocos 真实链路验收。

此回复同时明确了制作方与最小内容授权；不是要求再次批准已授权的 SphereCrossing、World 内容装配、RouteSignature 或兼容实现。

## 本次已交付与未交付

已交付：十五项设计裁定、v3.8 附录提案、无需扩边的依赖说明、三份独立源码审查、源码前置审查、当前基线三门禁、保护哈希和修改清单、逐项验收映射。

未交付：B2.2c 生产代码、业务契约测试成功、Primary 真实通关、两档完整链路截图、实际 WorldClearRecord / FirstWorldCleared 新写入。production.diff 为空，原因是按本 PROTOCOL 停工，不能据门禁通过推导以上能力已存在。
