# B2.5c-2c 历史偏差与决策台账

- 生成：2026-10-12，Trae（EXECUTOR）机械派生索引；只读源材料，未修改任何已有文件。
- 编号规则：D-01 起连续编号；"是否已闭合"只填 是 / 否。
- 原始暂停报告与修复前快照均原样保留、未回写为 PASS（出处：delivery-report.md L103-111"原始暂停/FAIL 保留，不回写为 PASS"）。

| 编号 | 现象 | 处置 | 影响面 | 是否已闭合 | 出处 |
|---|---|---|---|---|---|
| D-01 | P10 前置冲突：冻结 pull 默认等待 25 秒/deadline 32 秒，与受保护 owner 内部固定 12 秒截止冲突；实施暂停，未启动 PG、未出完成报告 | VERDICT-448 批准最小例外：仅在 RealSharedServiceSessionAdapter.request() 内、strict codec 通过后对 /relay/pull 使用 maximumWaitMs+7000（wait 仍 0..25000、deadline 7000..32000ms），其余 shared/auth 保持 12000ms；落实后恢复实施，真实客户端合法 13000ms wait 实测约 13030ms 成功、P10 deadline 契约 oracle 13/13 | 仅该一处 request 局部修正；guard/session/signing/nonce/schema 不变，旧 session 其余字节保全 | 是 | evidence/delivery-report-p10-paused.md；verdicts-448.md（原单份裁定）；delivery-report.md L68、L105；changed-files-final.json（session 前/后 SHA） |
| D-02 | P11 前置冲突：pull 请求结果若按至少七日轻量原结果规则复制 ciphertext/public proof，与载荷寿命/当前准入边界冲突；发现后停止机制实施/验收（未验收 WIP） | VERDICT-449 批准 pull 引用重建：pull 只保存轻量原签名 wrapper、queue 位置/identity/digest 引用与原 wire SHA；保留期内从唯一 queue 重建逐字原 Batch 并核 SHA/服务签名；到期/丢段/缺载返回当前签名 Gap，撤员拒绝；最终检查 42 条 pull 记录均为轻量引用、ciphertext/proof 副本 0 | 仅新 Relay 的 pull 请求记忆与复取边界；不改旧 schema/事务与普通 authority/submit/ACK 规则 | 是 | evidence/implementation-plan-p11-paused.md；verdicts-449.md（原单份裁定）；delivery-report.md L33、L66、L105；evidence/relay-pull-metadata-inspection.json |
| D-03 | 旧 generation 保留期清理遗漏：最终复核发现 RelayStorage.expire 原 UPDATE 只清当前 generation，切代后旧 generation 存活行跨 TTL 遗留载荷 | 只改本轮新增 Storage 的 UPDATE：覆盖该 world 全部 generation，floor SELECT 仍仅当前 generation；补测旧 generation 2 项并重跑 server 20、并发 2、client 22、门禁/build；原成功记录与完成稿保存为修复前快照，未将原通过误称已覆盖该边界 | 仅本轮新增 RelayStorage 及其生成 JS；旧核心/adapter/owner/codec/validator 未再修改 | 是 | delivery-report.md L110；evidence/canonical-audit-before-retention-fix.json；evidence/after-retention-fix/server-old-generation-retention-results.json；delivery-report.md L21（原 code.diff/changed-files.json 保留为修复前快照） |
| D-04 | server run01 卡壳：测试构造遗漏 header.kind | 修正测试构造；未放宽 guard/codec | 测试 harness，非产品源码 | 是 | delivery-report.md L106 |
| D-05 | server run02 卡壳：篡改摘要被 strict codec 正确拒绝为 400，测试原预期 409 | 修正测试预期（服务器行为正确）；未放宽 guard/codec | 测试 harness，非产品源码 | 是 | delivery-report.md L106 |
| D-06 | server run04 卡壳：删除整账号却断言 CredentialRemoved | 修正测试为 MemberRemoved；最终 run05 20/20，未放宽 guard/codec | 测试 harness，非产品源码 | 是 | delivery-report.md L106 |
| D-07 | 初始 PG 启动 shell 因 Windows 输出继承停滞 | 仅终止该 setup shell，后续接健康新 cluster；原不完整日志保留 | 运行时基础设施，非源码 | 是 | delivery-report.md L107；evidence/runtime-start-incomplete.log |
| D-08 | 客户端任务误跑旧 c-2b contract runner，曾临时重编旧 evidence 中 owner JS | 按保留 snapshot 与原 compiler options 恢复逐字原件，最终 SHA 证明恢复成功；此后历史 runner 输出必须定向新的本阶段目录；不能声称整个会话从未写过旧生成缓存 | 旧 evidence 生成缓存（已恢复），历史回归输出目录约定 | 是 | delivery-report.md L108 |
| D-09 | 旧 c-2b HTTP wrapper 初次只识别 TAP，误报 false/-1 | 保留原 results.json，以原 specs 日志另产 verified-results.json，31 项实际通过 | 历史回归结果呈现方式，测试本体不变 | 是 | delivery-report.md L95；evidence/history-c2b-http/verified-results.json |
| D-10 | 客户端复跑的首次执行已留 22 项结果，但子任务后续会话异常未返完整执行来源 | 该结果保留；根任务以只替换三处输出/缓存路径、断言逐字不变的新 driver 再执行，自动记录实际 exit 0、命令、前后 source SHA；最终引用这一有执行 lineage 的记录，不猜测旧子任务退出状态 | 客户端真实 HTTP/PG 测试证据链 | 是 | delivery-report.md L111；evidence/after-retention-fix/client-run-lineage.json |
| D-11 | 完整 server 20 项完成后，新增 harness 追加 --concurrency-only 分支两项补测（过程时点偏差，防倒称） | 原 20 项断言未改；lineage 记录交付 harness 的后续 SHA，不倒称 run05 时整份 harness 已是该字节版本 | 服务器测试 harness 的版本时点记录 | 是 | delivery-report.md L109 |
| D-12 | canonical 审计存在一次上下文口径修复（修复前快照与修复脚本存在于证据目录；交付报告未单列叙述） | 证据目录保留 canonical-audit-before-context-fix.json 与 repair-canonical-audit-context.cjs；最终以 retention-final 审计为 canonical（根审计 interpretation：canonical artifact now clones the passing retention-final scoped audit） | canonical 审计记录链 | 是 | evidence/canonical-audit-before-context-fix.json；evidence/repair-canonical-audit-context.cjs；protected-final-audit.json interpretation 字段 |

## 脚注

- 交付报告过程偏差清单（delivery-report.md L106）仅单列 run01/run02/run04；**run03 未找到专门偏差记录**（源中未找到，不猜测替代）。
- 上述 12 条全部闭合于 c-2c 最终交付态（delivery-report.md 状态行 L3：c-2c 真实 Relay 实施与范围内验证完成，提交 PROTOCOL 审阅）。