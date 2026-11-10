﻿# B2.5c-2c 交付物索引

生成：2026-10-11，由 Trae（EXECUTOR）按用户授权生成本轮交付物索引。所有路径相对 `quality-review/b2-5c-2c/`，均为该目录下实际存在的文件；目录条目仅统计文件数与合计字节，SHA256 列标 `DIR`（不对目录作单文件哈希）。源文件一律保留原样，本索引只读引用。

## 交付文书与裁定

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| namebook-v3.21-appendix-proposal.md | 7418 | 27dda96209de0ef682ab2d289765bce2d9b039c2beb33cfe6e50d0484f664a6c | v3.21 名库附录提案（A/B/C/D 四类），已由 Trae 落盘 |
| delivery-report.md | 17828 | 5a0539215c2dadcdcd4ef854b942d7b543221e444dff1b678e1abfab637a64ad | c-2c 实施交付报告，最终验收状态以它和原始证据为准 |
| implementation-plan.md | 4333 | c5670099800072172a1bf9a400a6593b4d781e34f10266995dcca066adc1da1e | 本阶段实施计划 |
| verdicts-448-451.md | 4440 | 5ca97670eac24d5c6c01da86f802dce404f848e0b65989da607c1dc79e553424 | VERDICT-448～451 裁定汇总（P10/P11 恢复后最终适用范围） |
| verdicts-448.md | 1095 | 29175db14d9e316f92b96d285c0396c4272864831595afe1f44ad6619b3d3907 | VERDICT-448（P10）原单份，保留历史时态 |
| verdicts-449.md | 1317 | c8fa75c8b9099837a39fe5cd66f27da18e9d9e4979daf9c476c75fc5ca102ceb | VERDICT-449（P11）原单份，保留历史时态 |
| independent-final-review.md | 2184 | 1dff752955d75ff82d24f899f4527719cc01eb03a466459712e439cc7f11826f | 独立交叉源码复审原结论与 retention 局部复核范围 |
| independent-prerequisite-review.md | 2010 | 4f4b221cf7a76b61adb0c58aa11d81ad198f8dec1ebb780ed4da336953d6e0a2 | 实施前置独立只读审计 |
| protocol-prerequisites.md | 4758 | 7394d80a1ee7afa9b0941d18edf3206289fe1086d0a42e449da4b51a5071a636 | P10/P11 前置说明（暂停期间产出，保留原时态） |
| protocol-p11-pull-retention.md | 6066 | 7e7bad49646ad9ba12fef017a6fd717d21827b03ff974e62b391129902ce59d4 | P11 pull 保留期方案说明（暂停期间产出，保留原时态） |

## 源码增量

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/source-final.diff | 61312 | a7b48f31c72304efeb1675267802a9228efcc9d8ac6fa4eb767796c6b1ad0523 | 最终完整源码 diff，覆盖 7 份源码（5 新增 + 2 修改） |
| evidence/changed-files-final.json | 3726 | fa04863ff229c5a9d58894bbc3d8cf0078ab3898b19e8786aec933ccf2dae5ac | 每份源码 before/after SHA、字节数及四份生成物记录 |
| evidence/new-names-final.json | 109353 | 8b75ae8727356930db60a151e14b43ac674517ea393d9018c87badbfc296635f | 机械命名完整清单（全部声明/字段/局部名） |
| evidence/artifact-inventory-final.json | 80229 | 4cbf509509bc022729735b295765bcc317dd43e207ded533ecb3bf7a442d73de | 最终完整交付物清单 |
| evidence/intent-before-c2c.ts | 50175 | 1e29ebc8f7cf1bfef700eea7fc1bae8a09e6cdb4e1f39d9e2ef07549991649a3 | IntentPort.ts 修改前原字节快照（原 50175 字节前缀保全依据） |
| evidence/session-before-p10.ts | 44370 | 46238bab2bd3d082622d0b22ba2e3cb82f0330b40f77d70c4de6b229b8af1f8e | RealSharedServiceSessionAdapter.ts P10 修改前原字节快照 |
| evidence/intent-type-erasure-final.json | 1279 | 559774bbd67ce466c5948734f1995587074eb2f1275a3de656b8470302210e9a | IntentPort type-only suffix 前后 emitted JS 相同证明 |

## 客户端证据

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| client-real-http.cjs | 35766 | bb413efa3cc6614159361ca651e8b2b836581a77d63f597456769a0b9e0d488f | 真实客户端 HTTP/PG 测试 harness 首版（修复前快照） |
| client-real-http-after-retention-fix.cjs | 35826 | 511646f1e2901e62d96422f0296dc88cd2cc14d6a6bb316e928d15d06154eff2 | retention 修复后客户端 harness |
| client-real-http-retention-final.cjs | 35818 | 3c1394d2b479deaf040efa03ab2514c4cd6e8b1182e1f165297540e3e4698e13 | 最终客户端 harness（仅替换输出/缓存路径，断言逐字不变，有执行 lineage） |
| real-client-helper-source.cjs | 3867 | 0aa76329f0fad4fd13a24587ee3962c760b744049bd4369a45b58186a0dd8029 | 客户端真实测试辅助源 |
| real-client-relay-cases.txt | 8835 | 8f5cc8cb438cf5cce3600c571f384abfe4789e8a0ab82db45a069ded32be38e4 | 22 项真实客户端用例清单 |
| prepare-real-client-test.cjs | 4543 | 3fb9b07e6ec30f2c2d89905245de0cdc7778900f7a11c940298f37ae04c5bafc | 真实客户端测试准备脚本 |
| evidence/after-retention-fix/client-real-http-results.json | 5965 | 28f280fbcc185c74089a44c625432838f0265ebdb87feb8db8631a2a46fee9c1 | 生产 Relay adapter 真实 HTTP/PG 22/22 最终结果 |
| evidence/after-retention-fix/client-real-http.log | 1966 | bb290f956b757cd103e6295c6fb0825542f34253bb5a0a70c673bf8e743d7b6a | 客户端最终运行日志（含 13000ms wait 约 13030ms 实测） |
| evidence/after-retention-fix/client-run-lineage.json | 2596 | 2d4834dfa6e1d54833476aa6a44baa8d1fd362c7df2b3b2ab354d6582480ebd6 | 最终客户端执行 lineage（exit 0、命令、前后源 SHA） |

## 服务器证据

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| server-relay-tests.mjs | 44634 | cf326ef6c033e8867ad1a9f124d7a21864cdbef741e2d4bc1c0961187ce61872 | server 真实 loopback HTTP/PG 完整套件（20 项 + 并发/保留期分支） |
| evidence/after-retention-fix/server-relay-results.json | 4380 | 85e63c837cf2dc2bb857b9ae981bbcc1aae158265d35218b16977d842901171f | server 完整套件 20/20 最终结果（17 真实 wall + 3 显式隔离 clock） |
| evidence/after-retention-fix/server-relay.log | 1878 | 7dc4590f4a1ee105c2d321bdbc228c9034dd35cc495a15713adea02298c2b43d | server 完整套件运行日志（默认 long poll 25014ms 实测） |
| evidence/after-retention-fix/server-relay-concurrency-results.json | 696 | 21ea5cfceddde7da0cb983b8623c32baba3e63f64d82328c995af0df6f97d692 | 首次入队并发补测 2/2 结果 |
| evidence/after-retention-fix/server-relay-concurrency.log | 199 | 273e20b74f302c726c5407b8f69e03002e255f4191a2b7ecb1e520f30117d7fd | 并发补测日志 |
| evidence/after-retention-fix/server-old-generation-retention-results.json | 748 | 008364993b0ecdd99d44a970fc742a555e47638524ba8f472c107bf04951fde1 | 旧 generation 保留期定向补测 2/2 结果（修复验证） |
| evidence/after-retention-fix/server-old-generation-retention.log | 215 | 58c41d032f91b3094b41bfa834119083f76a4f88b755b3d9fa5d22ab25a0cea7 | 旧 generation 补测日志 |
| evidence/server-build-checks/retention-final/results.json | 3007 | 1857be32ceb46f1e279fa38b977d4cb8fc557be9b455eca5e6216ac1503b425f | server 独立 build / typecheck 均 exit 0 最终记录 |
| evidence/runtime-readonly-facts.json | 1854 | 9ed371f4b1a0165a17462c3a82d7d28632a9271d9166d3f7b329d92c23d68fd8 | PG 只读原字节/ACK/请求记忆检查（bytea SHA=提交摘要） |
| evidence/relay-pull-metadata-inspection.json | 262 | a9468a1aa5e44e6730b624c06484329a8be1a2320a07a8c3423a6831ba8ea349 | P11 真实请求结果表检查（42 条 pull 记录无 ciphertext/proof 副本） |
| evidence/after-retention-fix/runtime-stop.log | 137 | 140787733b82669caf4a86e92d54ef0598c2241ba3f5d27a1a52511a8408063d | 全部运行结束后正常停服最终证据 |

## 历史回归

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/history-b24 | DIR:34files:379155bytes | DIR | B2.4 ContractAdapter 逻辑 fixture 历史回归 227 项证据目录 |
| evidence/history-c1 | DIR:14files:286474bytes | DIR | c-1 canonical / validator / replay 历史回归 154 项证据目录 |
| evidence/history-b-auth | DIR:23files:137952bytes | DIR | 旧 b auth 历史回归 server 16 + client 30 证据目录 |
| evidence/history-c2b-pure | DIR:19files:241478bytes | DIR | c-2b protocol / transport oracle 历史回归 32 + 18 证据目录 |
| evidence/history-c2b-http | DIR:17files:255064bytes | DIR | c-2b 真实 authority HTTP/PG 历史回归 server 20 + adapter 11 证据目录 |
| evidence/history-c2b-http/verified-results.json | 3794 | 17a9cd25aa325fc92bbd1e5a45a1d869d8358e76d18bd6a2e7a357441bcbe3dd | c-2b HTTP wrapper 误报修复后 31 项实际通过的核验结果（原 results.json 保留） |

## 暂停记录与过程快照

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/delivery-report-p10-paused.md | 2486 | 86bcd02d9c9cec59a7645b485a286a3cf285a025bfc99070732a681332638ad3 | P10 原暂停报告，保留原时态不回写 |
| evidence/implementation-plan-p11-paused.md | 5097 | 3b3e596475ee4317c62e514876357002a3472b3a24b1745724a4879ad59c3353 | P11 原暂停计划，保留原时态不回写 |
| evidence/paused-evidence-summary.json | 4728 | 664ae6abeca0056f6644a719a5cd404304e0872f22d453cbfd2bf45e1dbaf369 | 暂停期证据汇总 |
| evidence/server-paused-noemit-results.json | 774 | 533a8153b3fb68f8356af4ca3e8c0ed949e4476dd50d81ff9b5dae8ff47942f4 | 暂停期 server no-emit 检查结果 |
| evidence/p10-authorization.json | 446 | 890106e447646815fe11aa1f1d023bdf101a8ae9df8a96f5675da5a8af64814f | P10 最小局部修正的用户批准记录 |
| evidence/delivery-report-before-generation-retention-fix.md | 15284 | b62b68a9b003f541ceb0788e8c51758b95766ccc9745f3b3ac31b0ede3f99d98 | 旧 generation 清理修复前的交付报告快照 |
| evidence/implementation-plan-before-generation-retention-fix.md | 3958 | 3588d5405124a457515f275f402dc5ddf77660e817134a15963fa0e67d4dbec4 | 修复前实施计划快照 |
| evidence/verdicts-before-generation-retention-fix.md | 4166 | a34d6efc51a52b37ab80cf177eabc56c3d703c2fade00a39a373fdb8501f6dac | 修复前裁定文书快照 |

## 契约测试

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| client-relay-contract-tests.cjs | 16054 | 8ad316aaeb3836e4a461cf2fd89c96cded185c8a7c38e7acb8573c3faaa951a8 | Relay adapter 契约 oracle 测试（实际 c-1 validator，虚拟 transport） |
| evidence/client-relay-contract/results.json | 3719 | ee95a7d478f9f0adc4b3995b751b6a9042e391a29ac40306d653da2edd106aee | Relay adapter 契约 oracle 32/32 结果 |
| evidence/client-relay-contract | DIR:97files:1062470bytes | DIR | 契约测试完整产物目录 |
| p10-deadline-tests.cjs | 11619 | f766bc93236782e8ca19439abeb5db1a6e1c6cdac803cfd79ee3075ba912749d | P10 deadline 契约 oracle 测试（实际 owner，虚拟 elapsed，观测 native timer） |
| evidence/p10-deadline-results.json | 1662 | 8788459a9c62b16504883173266b180b993da9a355f3296fe9ad782fe10801c8 | P10 deadline 契约 13/13 结果 |

## 保护审计与门禁

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| protected-final-audit.json | 1547402 | 80bf5d894eb5693b6aa59f07fb01b92e9690a8086aa570ff2272bc2adb1963c4 | 根保护审计 PASS（7435→7444，unauthorized 全空） |
| evidence/validation-retention-final-lineage.json | 19025 | e99177f6061920fd2ffa4634c434cef132b0e9aee86753774105bd241ce758d9 | 最终验证命令、退出码、原始日志/结果 SHA 与源码 lineage |
| evidence/gate-runs/retention-final/results.json | 12177 | a10371f73cafe59b07620d35adb25995cb6512d23a935ecb53f6452c64926803 | 三门禁最终汇总结果 |
| evidence/gate-runs/retention-final/check-naming.log | 9190 | ce11f2a1822b000b65d76cf4f9814970dcaae3a2819feae78273775aae5c4a76 | check:naming PASS 0 ERROR / 45 既有 WARN 日志 |
| evidence/gate-runs/retention-final/check-dependencies.log | 419 | 697624a8aeefce0d78a342372d570ee0432574785113b499cbae48de8bd3d113 | check:dependencies PASS 0 ERROR（132 TS / 448 子句）日志 |
| evidence/gate-runs/retention-final/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | typecheck exit 0 空日志（无错误输出即通过） |
