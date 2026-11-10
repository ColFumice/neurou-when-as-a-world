# B2.5c-2c 关键证据 SHA 表

- 抽取源：protected-final-audit.json（根）、evidence/artifact-inventory-final.json、evidence/changed-files-final.json、evidence/validation-retention-final-lineage.json；路径一律相对 quality-review/b2-5c-2c/。
- 抽取原则：只列"若丢失将影响后续可验证性"的关键项（保护审计、IntentPort 前后 emitted JS、session adapter 前/后、Retention 修复前后 canonical 审计、server 20/20、client 22/22、历史 508 汇总等）。
- 字节/SHA256 逐字取自对应源 JSON；根 protected-final-audit.json 为本次实算（源 JSON 未提供其自身 SHA 处不推测）。
- 共 30 项（任务规格 20~30 项，取上限）。

| 类别 | 路径 | 字节 | SHA256 | 说明 | 前/后 | 来源 |
|---|---|---|---|---|---|---|
| 保护基线与最终审计 | protected-final-audit.json（根目录） | 1547402 | 80bf5d894eb5693b6aa59f07fb01b92e9690a8086aa570ff2272bc2adb1963c4 | 最终保护审计（canonical）：7435→7444，pass=True；changed 仅 IntentPort type-only suffix 与已批准 P10 session 两处，新增仅 5 份实施 TS + 4 份生成 JS，removed/unauthorized 全空 | —（当前终态） | 文件自身（本次实算） |
| 保护基线与最终审计 | evidence/protected-retention-final-audit.json | 1544269 | 83ddecdfdc72ac39aec95579374fd7b01cb654438593b46d78cadff5ba399485 | retention 修复后最终保护审计（根 canonical 审计的克隆源，7435→7444 PASS） | 修复后 | artifact-inventory-final.json |
| 保护基线与最终审计 | evidence/canonical-audit-before-retention-fix.json | 1546800 | 2e7794ee1943d00dcbbdb5933d62825150019b9e6c83154976f12c4942385011 | 旧 generation 保留期修复前的 canonical 审计快照（修复前时点原样保留） | 修复前 | artifact-inventory-final.json |
| 源码增量 | server/src/RelayRoute.ts | 3840 | d15e6323479eb36b8f7ada83578c628d287db252e2eb78e6f27799236971bd6b | 新增实施源码（c-2c 五份新增之一） | 新增（无前版） | changed-files-final.json / artifact-inventory-final.json |
| 源码增量 | server/src/RelayService.ts | 31208 | 55ffe45f60aeb69b9c32c1b4a3e498c8e184f921fdd4db23554f8baf85491549 | 新增实施源码（c-2c 五份新增之一） | 新增（无前版） | changed-files-final.json / artifact-inventory-final.json |
| 源码增量 | server/src/RelayStorage.ts | 4841 | 78ad6663951c166c16eb74dee259f62d8fde58484f0d778162c2f1dd3cb4e0d7 | 新增实施源码（c-2c 五份新增之一） | 新增（无前版） | changed-files-final.json / artifact-inventory-final.json |
| 源码增量 | server/src/buildRelayServer.ts | 2603 | 89f08e60c8c1a699c585384047bf003e981f19ba6b8043193712f10aa9798430 | 新增实施源码（c-2c 五份新增之一） | 新增（无前版） | changed-files-final.json / artifact-inventory-final.json |
| 源码增量 | src/director/IntentPort.ts | 50374 | 4348f4bdc950f1f9c6e224364fa77a80adeb0f2722c608e1dd961c0fe5a4e0a2 | IntentPort.ts：原 50175 字节前缀保全，追加 199 字节 type-only suffix，一条 export type 重导出三个既有 c-1 validator 类型 | 前 50175 字节 / 1e29ebc8f7cf1bfef700eea7fc1bae8a09e6cdb4e1f39d9e2ef07549991649a3 | changed-files-final.json（前 SHA 与 evidence/intent-before-c2c.ts 一致） |
| 源码增量 | src/presentation/RealCommitRelayAdapter.ts | 12005 | ec4b5d8cb11caf06f499d65706a64cd880ce8c7f3ba849ff557225cebd9fd9a9 | 新增实施源码（c-2c 五份新增之一） | 新增（无前版） | changed-files-final.json / artifact-inventory-final.json |
| 源码增量 | src/presentation/RealSharedServiceSessionAdapter.ts | 44528 | 8a1b8d778fc1d25e4c93855a2929b2c7fe3dded476599b250863a163edd2c452 | RealSharedServiceSessionAdapter.ts：仅已批准 P10 的 request 局部截止修正（pull deadline=wait+7000），其余字节保全 | 前 44370 字节 / 46238bab2bd3d082622d0b22ba2e3cb82f0330b40f77d70c4de6b229b8af1f8e | changed-files-final.json（前 SHA 与 evidence/session-before-p10.ts 一致） |
| 意图擦除 | evidence/IntentPort.before.emitted.js | 41756 | e382aee3d6c265b6a0df9037f4dee9ad320732311e130efd87173769c7f5e7b4 | IntentPort 编译产物（修改前）；与修改后产物逐字节相同，证明 type-only suffix 不改变运行时输出 | 修改前 | artifact-inventory-final.json |
| 意图擦除 | evidence/IntentPort.after.emitted.js | 41756 | e382aee3d6c265b6a0df9037f4dee9ad320732311e130efd87173769c7f5e7b4 | IntentPort 编译产物（修改后）；与修改前产物逐字节相同 | 修改后 | artifact-inventory-final.json |
| 意图擦除 | evidence/intent-type-erasure-final.json | 1279 | 559774bbd67ce466c5948734f1995587074eb2f1275a3de656b8470302210e9a | 意图擦除核验结果 JSON：前后 emitted JS 相同的机械记录 | — | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/client-relay-contract/results.json | 3719 | ee95a7d478f9f0adc4b3995b751b6a9042e391a29ac40306d653da2edd106aee | Relay adapter 契约 oracle：32/32（实际 c-1 validator，虚拟 transport，测试缓存） | — | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/p10-deadline-results.json | 1662 | 8788459a9c62b16504883173266b180b993da9a355f3296fe9ad782fe10801c8 | P10 deadline 契约 oracle：13/13（实际 owner，虚拟 elapsed，观测 native timer） | — | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/after-retention-fix/server-relay-results.json | 4380 | 85e63c837cf2dc2bb857b9ae981bbcc1aae158265d35218b16977d842901171f | server 真实 loopback HTTP/PG 完整套件：20/20（17 真实 wall clock + 3 显式隔离 clock），运行于最终 Storage | retention 修复后 | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/after-retention-fix/server-relay-concurrency-results.json | 696 | 21ea5cfceddde7da0cb983b8623c32baba3e63f64d82328c995af0df6f97d692 | server 真实 PG 首次入队并发补测：2/2（单列追加套件，不改称完整 22 项） | retention 修复后 | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/after-retention-fix/server-old-generation-retention-results.json | 748 | 008364993b0ecdd99d44a970fc742a555e47638524ba8f472c107bf04951fde1 | 旧 generation 保留期定向补测：2/2（TTL 前不删，切代后跨 TTL 清旧载荷且不污染当前 floor） | retention 修复后新增 | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/after-retention-fix/client-real-http-results.json | 5965 | 28f280fbcc185c74089a44c625432838f0265ebdb87feb8db8631a2a46fee9c1 | 生产 Relay adapter 真实 HTTP/PG：22/22（真实 session/authority/Relay 与 clock，测试注入 crypto/cache） | retention 修复后 | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/after-retention-fix/client-run-lineage.json | 2596 | 2d4834dfa6e1d54833476aa6a44baa8d1fd362c7df2b3b2ab354d6582480ebd6 | 客户端测试执行 lineage：实际 exit 0、命令、前后源码 SHA（解决首次执行无完整执行来源的偏差） | retention 修复后 | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/gate-runs/retention-final/results.json | 12177 | a10371f73cafe59b07620d35adb25995cb6512d23a935ecb53f6452c64926803 | 三条门禁最终结果：check:naming 0 ERROR/45 WARN、check:dependencies 0 ERROR（132 TS/448 子句）、typecheck exit 0 | retention 修复后 | artifact-inventory-final.json |
| 最终真实测试与门禁 | evidence/runtime-readonly-facts.json | 1854 | 9ed371f4b1a0165a17462c3a82d7d28632a9271d9166d3f7b329d92c23d68fd8 | PG 只读核验：原 bytea SHA=提交摘要、位置 1、ACK row/receipt 实存（最终完整套件再次验证对应事务） | 修复前记录，最终复验 | artifact-inventory-final.json |
| 历史回归 | evidence/history-c2b-http/verified-results.json | 3794 | 17a9cd25aa325fc92bbd1e5a45a1d869d8358e76d18bd6a2e7a357441bcbe3dd | c-2b 真实 authority HTTP/PG：31 项实际通过（wrapper 误报修正后 verified-results；目录共 19 文件/255064 字节） | 分类合计 508 的组成 | artifact-inventory-final.json / delivery-report.md §历史回归 |
| 历史回归 | evidence/history-c1/implementation/results.json | 8173 | 16586c5c5a3b4a6a19428f770f2152d1453e39b70df0ef4286143f66473d3fed | c-1 canonical/validator/replay：154 项 PASS（目录共 14 文件/286474 字节） | 分类合计 508 的组成 | artifact-inventory-final.json / delivery-report.md §历史回归 |
| 历史回归 | evidence/history-b24/implementation/results.json | 1522 | 701405268ecbdf6ba21f43d9a90d4b79f532dbc2ae96c343d0f160d5da56f8b8 | B2.4 ContractAdapter 逻辑 fixture：227 项 PASS（目录共 34 文件/379155 字节，代表文件为本行 SHA） | 分类合计 508 的组成 | artifact-inventory-final.json / delivery-report.md §历史回归 |
| 历史回归 | evidence/history-b-auth/implementation/results.json | 6883 | f3c011cefebba595fc9762d3a2133dd1588d6abf43121983d2737d4921e6e552 | 旧 b 认证：server 16 + client 30 = 46 项 PASS（目录共 20 文件/104602 字节） | 分类合计 508 的组成 | artifact-inventory-final.json / delivery-report.md §历史回归 |
| 历史回归 | evidence/history-c2b-pure/results.json | 3667 | 5a89fca8f1565da79a0ba15afee42618477fc6b8df2859105bf1cd992b369cb8 | c-2b protocol/transport oracle：32 + 18 = 50 项 PASS（目录共 19 文件/241478 字节） | 分类合计 508 的组成 | artifact-inventory-final.json / delivery-report.md §历史回归 |
| lineage 与 diff | evidence/validation-retention-final-lineage.json | 19025 | e99177f6061920fd2ffa4634c434cef132b0e9aee86753774105bd241ce758d9 | 最终验证 lineage：真实命令/退出码/原始日志与结果 SHA/源码 lineage 总账 | — | artifact-inventory-final.json |
| lineage 与 diff | evidence/changed-files-final.json | 3726 | fa04863ff229c5a9d58894bbc3d8cf0078ab3898b19e8786aec933ccf2dae5ac | 最终源码变化记录：每份 before/after SHA、字节数及四份生成物（本表源码增量组的来源） | — | artifact-inventory-final.json |
| lineage 与 diff | evidence/source-final.diff | 61312 | a7b48f31c72304efeb1675267802a9228efcc9d8ac6fa4eb767796c6b1ad0523 | 最终完整源码 diff：覆盖七份源码，按原基线/批准前快照生成 | — | artifact-inventory-final.json / delivery-report.md |

## 备注（"源未提供"标注）

- 根 protected-final-audit.json 自身 SHA256 不在其内容或四份抽取源 JSON 中以"根文件自身"名义提供，本表为本次实算值；changed-files-final.json 内的 finalProtectionAuditSha256=83ddecdf… 为其生成时点（2026-10-11T10:11:05Z）记录的 retention-final 审计哈希，与最终根文件时点不同，不作替代。
- 历史回归五个证据目录为多文件目录，SHA256 列为目录内代表性结果文件（逐文件 SHA 见 [b2-5c-2c-deliverables-index.md](b2-5c-2c-deliverables-index.md) 第五组），目录级聚合字节在说明列标注。
