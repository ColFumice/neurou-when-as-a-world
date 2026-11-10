# P3共享契约补冻交付报告

2026-10-11（Asia/Shanghai）。**本轮以纯文档完成VERDICT-391～410与P3补冻，不实现Relay或ContractAdapter。** 新ExternalService在线profile精确冻结身份/时间/三类变化/成员key/聚合/检查点/迟到与有限延迟；P4/P5未获得实施授权的能力保持拒绝、Gap、Unknown或Pending。不是B2.5c真实服务交付，不声称已经支持离线、陌生文件历史bootstrap、共同开发UI或产品ObserverSync。

| 交付要求 | 材料 |
|---|---|
| 1. 正式裁定391～410 | [裁定书](verdicts-391-410.md) |
| 2. 名库v3.17附录提案 | [附录](namebook-v3.17-appendix-proposal.md)，已冻结文档名/字段/值域与候选实现port/route/常量分列；由Trae正式落盘 |
| 3. 精确契约草案 | [共享schema](contracts-draft.md)、[成员/密钥与安全模型](membership-and-security.md)，全部为Markdown结构记法，无.ts导出 |
| 4. 三条门禁结果 | [原始证据摘要](evidence/evidence-summary.md)、[最终门禁机器结果](evidence/final-gates/results.json)、相应raw日志 |
| 5. B2.5c拆分 | [c-1契约、c-2权威/Relay、c-3网络验收](stages-and-open-items.md)；每段需后续明确实施授权 |
| 6. 遗留/待裁定 | [阶段前置与PROTOCOL边界](stages-and-open-items.md)、[独立复审](independent-review.md) |

本轮A～F裁定：新名称见v3.17提案；WorldChangeLog与两个B2.4恢复journal不统一；AccessCode纯首次准入、不能派生群key或替代root pin；ObserverSync继续留后续；只文档无契约级/ContractAdapter实现；c分三段独立验收。历史027三元与新二元显式隔离，035共同开发/RestrictedWrite及028/031异常/触痕规则保持。

| 门禁/审计 | 结果 | 说明 |
|---|---|---|
| check:naming | PASS，0 ERROR / 22 WARN | WARN与B2.5b final及本轮baseline相同，无新增/删除 |
| check:dependencies | PASS，0 ERROR | 122 TS / 425依赖子句；未新增生产源码依赖 |
| typecheck | PASS，exit0 | 现有源码通过；不编译本文Markdown schema |
| 新契约/真实Relay运行测试 | 未执行 | 本轮无机制实现，不把b认证测试或语义复审冒充c测试 |
| 7042项SHA原始字节保护 | **FAIL，2改/0删/0范围外增** | 仅NAMEBOOK/stage-1外部同步，不改写raw结果 |
| 两项外部变更来源 | **已闭合：TraeAuthorized** | 用户正式确认B2.5b/v3.16同步；原baseline/first FAIL保留，无其它未归因修改 |

三份raw门禁日志与B2.5b final逐字一致；详见SHA记录。三门禁PASS与SHA raw FAIL是不同结论，不合并成“全检查PASS”。来源闭合证明已获确认的外部归因，不证明两文件字节没变化；正式v3.17尚是交Trae的提案。保护范围包含旧quality-review材料、server包、源码和两项junction目标说明，排除本轮新增目录、依赖/编译缓存、私密.local、key和PG运行二进制；不读取秘密。

本轮代理仅新增本目录中的六份规范/交付Markdown、独立复审及evidence审查脚本/JSON/raw日志；这些审查脚本不提供共享运行能力。生产源码、archive、既有门禁、package依赖、B2.1～B2.5b和A/B/C/T6/T7/编辑器核心均无本轮修改；逻辑层未新增cc。docs/名库/参照未被本轮代理编辑，Trae两项外部同步单独归因。详见[原始保护结果](evidence/protected-comparison.json)、[首次FAIL](evidence/first-protection-failure/protected-comparison.json)、[归因闭合](evidence/source-attribution-closure.json)。

新协议用全局不重叠序号段与在线时间permit防碰撞/伪造时刻，轻量claim给权威可独立验签对象，正文仍仅bounded Relay密文或用户携带。成员群key不从码派生、不云保存包；精确aggregate与coverage保留迟到/重复边界；seal拒提前封边和backdate，坏来源/缺历史不冒称Complete。完整字段、签名输入和逐步reducer规则均在契约，不以这份摘要代替。

当前无新增未闭合P3架构PROTOCOL。下一步具备c-1规范前置，但本轮没有开始c-1实现；其world/manifest正式注册入口、root pin/长期保管/交付配置须随实施明确。P4秘密持久保护/外部checkpoint证明/本人贡献恢复和P5原生离线time proof继续分别补冻；若要求提前启用、云存payload/key包、静默旧身份迁移或绝对匿名，先提交PROTOCOL。
