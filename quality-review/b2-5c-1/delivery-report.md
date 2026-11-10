# B2.5c-1 交付报告 · 契约与确定性重放

2026-10-11（Asia/Shanghai）。状态：本轮授权范围完成，纯逻辑验收通过；SHA外部同步归因闭合，历史raw FAIL保留。下一阶段真实Relay、服务器与客户端接线不在本次交付。

## 1. 八项交付索引

| 用户要求 | 交付 |
|---|---|
| 正式裁定 VERDICT-411～425 | [verdicts-411-425.md](verdicts-411-425.md)，15项逐条裁定 |
| 名库 v3.18 附录提案 | [namebook-v3.18-appendix-proposal.md](namebook-v3.18-appendix-proposal.md)，交Trae正式落盘 |
| 修改文件清单及完整代码diff | [changed-files.json](evidence/changed-files.json)、[code.diff](evidence/code.diff) |
| 三条门禁 | [evidence-summary.md](evidence/evidence-summary.md)、[final-gates/results.json](evidence/final-gates/results.json) |
| 隔离测试 | [final-verified/results.json](evidence/test-runs/final-verified/results.json)、[原始TAP](evidence/test-runs/final-verified/contract-tests.log)、[JUnit](evidence/test-runs/final-verified/junit.xml) |
| 验收证据逐条对应 | [contracts-and-acceptance.md](contracts-and-acceptance.md)、[154项索引](evidence/acceptance-index.md) |
| 新增命名清单 | [AST清单new-names.json](evidence/new-names.json)，75顶层导出、23公开方法，含字段/参数/内部声明/源位置与SHA |
| 遗留/待裁定与后续拆分 | [stages-and-open-items.md](stages-and-open-items.md)、[独立复审](independent-review.md) |

## 2. 正式实现裁定

纯数据契约独立放入 SharedCommitContracts.ts，RealServiceContracts.ts 与旧同步接口保持原状；IntentPort仅type-only追加。Codec正式名称 SharedCommitCodec，canonical工具 SharedCanonicalBytes，签名/source/AEAD边界 SharedCommitValidator，reducer SharedWorldReducer。未增加同义类别名或 future 网络端口导出。

JCS限定安全整数子集，精确UTF8/base64url规范化；拒重复键、非规范bytes、accessor、非法prototype、未知字段/值域和旧格式。验签沿用B2.5b的ES256/P1363/根指纹语义，通过注入纯密码学端口实现；生产模块零cc/DOM/Node/network/clock。七个实际域的覆盖字段、NUL与HKDF/AAD规则见裁定417和安全验收文档。

Reducer接受受信Genesis或同实例可信parent、完整admitted提交集、可选seal/closure、固定policy及明确Gap/候选状态；自己验真、identity去重和总序排序。返回完整暂态state、已封边coverage/checkpoint、独立provisionalCoverage、结构化个人diagnostic提案与本人贡献Unknown。无存储/ACK/个人事件/产品副作用。

source-bound坏正文可技术InvalidChange；缺来源、字节、key或未知parent是Gap；主机故障为HostFailure。完整前缀count/digest、policy/hash、S−H与parent/closure全部吻合才产生checkpoint。已删ID不复用，三类变化、历史名单权限、独立closure、诊断单向演进均按P3；不同对象独立，同账号设备冲突没有豁免。

## 3. 源码修改清单

| 文件 | 改动 | 目的 |
|---|---|---|
| src/director/SharedCommitContracts.ts | 新增，22261 bytes | P3的54数据schema + 4codec类型映射/错误辅助类型 |
| src/director/SharedCanonicalBytes.ts | 新增，13285 bytes | 独立规范JSON reader、UTF8、base64url、domain bytes；depth守卫128 |
| src/director/SharedCommitCodec.ts | 新增，43479 bytes | 54精确schema与内在关系、immutable副本、wire容量与stable ID规则 |
| src/director/SharedCommitValidator.ts | 新增，32121 bytes | 安装pin、receipt/claim/注册key/成员、签名/HKDF/GCM、source三类结果与能力 |
| src/director/SharedWorldReducer.ts | 新增，27557 bytes | 确定性三类重放、sealed/provisional、coverage/hash、可信parent及观察冲突 |
| src/director/IntentPort.ts | 仅尾部type-only追加，1425 bytes | 58个纯类型导出，原47617-byte前缀完整保全 |

新增测试/交付目录为quality-review/b2-5c-1；测试使用真实Node密码学fixture，与生产代码分离。本工作区不是Git checkout，完整unified diff依据保存的原IntentPort字节和五个新增文件生成，而非虚构git状态；code.diff为143278 bytes，SHA256 `84eff5735e5932a91feed62162c3ba48cb5973ec10563554e4d1be4aabb18373`。文件manifest另附全部前/后SHA。

IntentPort原字节前缀与type-only格式检查通过。按ES2015、removeComments编译后，变更前后运行时JS均17548 bytes且完全相同，SHA256与具体命令见 [intent-type-erasure.json](evidence/intent-type-erasure.json)。没有SharedCommitContracts运行时require。

## 4. 验收结果与风险限度

| 检查 | 最终结果 |
|---|---|
| 严格隔离编译 | PASS：target ES2020、lib ES2020、types=[]，没有DOM/Node/引擎声明；既有项目门禁另检查ES2015目标兼容 |
| codec/canonical套件 | 76/76 PASS，其中54个schema正反向roundtrip，另22个拒绝/oracle/invariant组 |
| 真实密码学validator套件 | 47/47 PASS：ES256/P1363、AES-GCM、SHA256、RFC5869 HKDF及source/pin/成员/历史时窗/AEAD正反例 |
| reducer套件 | 31/31 PASS：三类精确结果、同毫秒、两设备/空洞/冲突、历史撤权、tombstone、coverage/seal/Gap与可信parent |
| 全部隔离测试 | 154/154 PASS；fail/cancelled/skipped/todo均0，源码与测试输入前后SHA稳定 |
| 网络instrumentation | 四进程尝试计数0；只证明本次执行路径，不是OS sandbox |
| 新源码AST profile | 五文件导入均在共享内核内；无cc/DOM/Node/network/clock禁止标识；SHA与最终测试一致 |
| check-naming | PASS：0 ERROR / 45 WARN，基线22、新增23；新增均为Trace痕域，逐条保留并复核 |
| check-dependencies | PASS：0 ERROR |
| 既有typecheck | PASS：exit0，无诊断 |

没有修改门禁脚本或白名单。最新测试使用Node v24.19.0；真实key/nonce只在内存生成，不落私钥或群秘密。已有失败记录均保留，修复了fixture时间/段复用/递归test glob和测试断言/构造，未放宽生产guard；完整来龙去脉见 [contract-test-history.md](evidence/contract-test-history.md)。

独立复审已核对：陌生checkpoint不获信；已覆盖逐字source重送在旧key遗失后可no-effect继承；新的缺key输入仍Gap；独立closure空尾部也投影；跨可信parent已观察号段/permit冲突保持可检测。registry仅本实例，不声称可恢复持久信任或证明未见过的全球allocator账。受信注入crypto/manifest/root/key能力仍是必要调用前提；签名不能证明真实游戏触碰。

## 5. SHA保护与独立来源闭合

基线UTC 2026-10-11T04:05:40.542Z，7070项，基线文件SHA256 `004da1c8a9f7d78e081f0d130e3401bb728d7240d581805427b1cd364a0047cb`。最终扫描7075项：五新源码、IntentPort纯追加、两项docs外部变化，无删除或其他新增/修改。

raw保护结果仍为FAIL：docs/NAMEBOOK.md、docs/spec/stage-1.md在本轮基线后变化。本轮独立提交来源核对，用户正式答复“确认：Trae 授权同步 v3.17/P3”。逐path/hash与问题ID绑定记录见 [source-attribution-closure.md](evidence/source-attribution-closure.md) / [JSON](evidence/source-attribution-closure.json)；reviewedClosurePass=true、attributionPending=false，其余范围符合授权。没有重置baseline或把原FAIL改PASS，也没有沿用上轮v3.16确认。

本轮Codex实现没有编辑docs/名库/参照；全工作区两项变化来自获确认的Trae同步。保留 [首次FAIL](evidence/protected-first-failure.json)、[原比较](evidence/protected-comparison.json)、[闭合复查](evidence/protected-closure-recheck.json)。排除依赖/缓存/编译产物、私密状态/key/运行二进制与本轮交付目录，具体范围在原保护JSON；不以排除项证明其未变。

## 6. 后续交接

c-2仍需新一轮实施授权以及真实world/manifest/root/pin/成员ECDH与群key交付方案、HTTP契约/CSRF/限流/幂等和服务clock不回填保证。当前HTTP错误wire/限流候选未按P3原先计划在c-1网络化；依据本轮明确零网络范围，裁定411将其具体化交给c-2前置。

P4的完整FileCarry、陌生checkpoint可重放证据、旧epoch key、异步加密存储/journal/媒体/明文迁移继续延期。P5的平台OfflineGrace/可信PhysicalDevice及原生host继续延期；Web不获OfflineGrant、不用应用uptime降级。生产HTTPS、产品ObserverSync/UI/编辑器、旧三元身份迁移均未实施。详见后续拆分表；本轮没有未闭合新架构PROTOCOL。
