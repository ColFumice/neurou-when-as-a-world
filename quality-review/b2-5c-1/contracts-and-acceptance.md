# B2.5c-1 可执行契约与逐项验收

日期：2026-10-11。最终源码与 SHA 以 evidence/changed-files.json 为准；本文是本轮调用边界与验收索引，P3 wire 字段仍以 SharedCommitContracts.ts 的精确声明及原冻结文档为准。

逐测试名称及编号见 [154项完整索引](evidence/acceptance-index.md) 和 [机械索引](evidence/acceptance-index.json)。V01～V47、C01～C76 为索引编号，R01～R31 为原测试编号；索引从最终 TAP 自动提取，不重命名原测试或回写结果。

## 1. 模块调用边界

| 模块 | 导出 / 入口 | 信任与副作用 |
|---|---|---|
| SharedCommitContracts.ts | 54 schema 类型、SharedSchemaMap/Kind/AuthorityPayload/ErrorCode | 纯类型；不授 crypto/source 信任 |
| SharedCanonicalBytes.ts | SharedCanonicalBytes 的 encode/decode/utf8/text/base64UrlEncode/base64UrlDecode/equalBytes/domain；SharedSchemaError.code | 平台无关规范字节；decode 输出 unknown |
| SharedCommitCodec.ts | new SharedCommitCodec().validate/encode/decode | 精确 schema；冻结副本；不验证密码学 |
| SharedCommitValidator.ts | new SharedCommitValidator(crypto, context)；validateGenesis/Commit/Seal/Closure/Rejection；owns* | 异步注入密码学/受信 producer；每实例 WeakSet 管理已验能力 |
| SharedWorldReducer.ts | new SharedWorldReducer(validator, crypto).replay(request) | 纯重放；同实例内存可信 parent registry；不存储/联网/发游戏事件 |

codec 三入口为：

```ts
validate<K extends SharedSchemaKind>(kind: K, input: unknown): SharedSchemaMap[K];
encode<K extends SharedSchemaKind>(kind: K, input: unknown): Uint8Array;
decode<K extends SharedSchemaKind>(kind: K, bytes: Uint8Array): SharedSchemaMap[K];
```

生产密码学端口逐字依赖为：

```ts
interface SharedCryptoPort {
  sha256(bytes: Uint8Array): Promise<string>; // lowercase hex SHA256
  verifyEs256(jwk: WorldKeyAgreementPublicKey,
    signature: Uint8Array, message: Uint8Array): Promise<boolean>;
  hkdfSha256(ikm: Uint8Array, salt: Uint8Array,
    info: Uint8Array, length: number): Promise<Uint8Array>;
  decryptAes256Gcm(key: Uint8Array, nonce: Uint8Array,
    ciphertextAndTag: Uint8Array, aad: Uint8Array): Promise<Uint8Array | null>;
}
```

decrypt 的 null 只表示已检查的 tag 验证失败；backend 故障必须 throw，返回错误类型也是 HostFailure。与 B2.5b 使用相同 suite/指纹语义，但本轮没有 browser WebCrypto 包装或其 runtime 依赖。测试实现位于 evidence/fixtures.cjs，私钥和随机群 key 只驻内存。

SharedValidationContext 包含 serviceInstanceId/servicePublicKeyJwk/serviceKeyFingerprint/clockGeneration、developerTrustAnchor、genesisSha256/worldId/mapId/contentManifestSha256，以及 isEntityDefinitionApproved / lookupWorldRelayKey。这些是受信调用者输入，不来自 incoming file。后者返回恰好 32 字节原始群 key 或 null；会核验其 commitment。批准函数须验证全部实体类别、content 与 Normal/tier/touch 资格，不能只核对“存在一个 contentId”。

验证结果为 Verified(value) / Gap(reason) / HostFailure(reason)。ownsGenesis/Commit/Seal/Closure/Rejection 只承认同 validator 的运行时能力；复制、序列化或结构伪造不会继承 WeakSet 信任。

## 2. 重放请求与结果

```ts
interface SharedReplayRequest {
  readonly genesis: unknown;
  readonly parentCheckpoint: unknown | null;
  readonly commits: readonly unknown[];
  readonly settlementSeal: unknown | null;
  readonly developerClosure: unknown | null;
  readonly policy: SharedSettlementPolicy;
  readonly gaps: readonly string[];
  readonly pendingCandidateCount: number;
}
```

这八字段必须精确存在，null 不可遗漏。gaps 非空返回 BoundViolated；pendingCandidateCount>0 返回 PendingCandidates。commits 是完整来源载体 AdmittedWorldCommit 的 unknown 输入；reducer 内部执行验真、identity 去重、摘要一致性与总序排序。输入在首个 await 前 canonical 复制，调用方异步修改不会改变本次计算。

Replayed 返回 state、coverage、provisionalCoverage、checkpoint|null、diagnostics、selfContribution:{kind:'Unknown'}。state 包含尾部暂态；只有 coverage / checkpoint.state 是完成封边的结果。provisionalCoverage 的 finalDiagnostic 始终 null，本地类型 SharedProvisionalCoverageEntry 不属于共享 wire。Gap/HostFailure 不含 checkpoint，也不注册新的可信 parent。

diagnostics 按 identity 返回本次新成立的 MergeConflict/RevertedEdit/InvalidChange 提案，scope=PersonalDiagnosticBoundary。相同 root 请求重放仍可给相同确定性输出；将来的个人消费者须按 identity 去重。这里没有执行/上传 NarrativeEvent、Core 或第八项个人数据。

## 3. 安全与来源判定

| 条件 | 验证/重放结果 |
|---|---|
| pin、receipt/claim/作者绑定可信，精确 envelope 摘要相同，key 可用，正文合法 | Verified 合法 capability；随后按总序判业务 |
| 来源完整但 envelope 非规范、签名错误、wrap/body tag 错、明文坏 schema/内外不等 | Verified invalid capability；封边后技术 InvalidChange coverage，状态不应用 |
| 字节缺失/被替换、来源签名不可信、key 缺失/commitment不匹配、未来未知clock generation | Gap，不伪造正文终局拒绝 |
| crypto/backend/批准内容 producer 抛错或返回无效形状 | HostFailure，未形成新检查点 |
| trusted parent 中逐字已验容器重复、旧 epoch key 已清除 | 从本实例 source 容器摘要继承 no-effect，不需要旧正文解密 |
| parent 只在文件中自报 hash/brand，或复制到另一 reducer | CheckpointUnverifiable |

shared state/coverage 的 hash 自洽不等于来源可信。父快照注册只发生在完整结果成功后；保存的 source/段/permit 元数据是内存验证辅助，不进共享 state、checkpoint wire 或服务器。未知旧 key、跨进程恢复与陌生文件仍不能借此快照获信。

## 4. 本轮八项验收对应

| 用户验收项 | 可复核证据 | 最终结果 |
|---|---|---|
| codec 正/反向 round-trip 与拒绝 | tests/codec-tests.cjs：54 个 schema roundtrip；字段/值域/额外字段/拒绝组 | PASS |
| canonical 同输入同 bytes | UTF8 独立 Node oracle、JCS 已知向量、字节回编码、base64 oracle、NUL domain tests | PASS |
| 签名正/反例、AAD | evidence/validator-tests.cjs：真实四类作者、service/root/claim/envelope签名、wrap/body AAD、ECDH 指纹/用途负例 | PASS |
| reducer 同输入同结果 | R01/R02/R03；乱序、重复、同毫秒、两设备段；state/coverage/checkpoint三摘要独立核对 | PASS |
| 三类变化精确结果 | R06～R10、R21/R23/R24/R26/R27/R29/R30：显露、聚合、地图/名单、删除/归因、历史权限/closure | PASS |
| coverage / seal / Gap | R11～R20、R22/R25/R28/R31；validator seal/rejection；codec policy/精确coverage | PASS |
| 隔离测试 | final-verified/results.json、原 TAP 与 JUnit；codec76+validator47+replay31=154，无skip/todo/cancel | PASS |
| 三条门禁 | final-gates/results.json：naming/dependencies/typecheck；WARN增量另审 | PASS |

## 5. 用户列举及补充边界

| 边界 | 证据索引 |
|---|---|
| 篡改、额外/重复字段、同identity异摘要 | codec exact-schema/canonical组；validator source/envelope组；R05/R14/R15 |
| 多设备分段与序号空洞、同毫秒总序 | R02/R03/R04；R31 跨trusted parent已观察段冲突；账号全局真实分配留c-2 |
| 不同对象独立、删除不复活、稳定ID共域 | R06/R07/R23/R24/R29；codec world ID/tombstone拒绝组 |
| 撤权按总序、不以到达顺序判权 | R08/R09/R10；roster receipt历史资格正反例 |
| 唯一触痕、自身Unknown、饱和与溢出 | R01/R03/R26/R27；Normal资格来自受信manifest；无Echo/异常事件 |
| seal≤S−H、H/retention、缺前缀 | R11/R12/R13；validator seal/policy/chain；codec settlement inequalities |
| 精确source坏body vs 缺key/缺载 | R14/R15/R16；validator bad envelope/signature/AEAD/canonical 与 KeyUnavailable/HostFailure |
| 外部checkpoint不获信、诊断单向演进 | R17/R18/R19/R20/R22；父字节不改、null→MergeConflict |
| covered exact duplicate旧key遗失、新载仍拒 | R28；容器receipt改动不能绕过完整验真 |
| 独立closure无tail、同毫秒根冻结而CoDev保留 | R21/R22/R30 |
| 输入跨await不变、Gap/候选不推进 | R25；source/test SHA稳定、wrong host shape拒绝 |
| 分域公钥、非root准入来源 | validator每个epoch credential fingerprint、signing/root/service材料重用、非root null revision拒绝 |

## 6. 重现和证据限度

在项目根执行（新 runName 必须未使用，保留已有 raw）：

```powershell
node quality-review/b2-5c-1/evidence/run-tests.cjs review-reproduction
```

该脚本重新严格编译五模块并运行三套真实密码学/重放测试，写 TAP、JUnit、source/input SHA 与网络计数。Node v24.19.0 的本机结果见最终 JSON 的 nodeVersion；依赖使用项目既有 TypeScript。网络阻断 instrumentation 证明已执行路径的尝试计数，不是 OS sandbox，不证明未来调用方不会联网。

既往失败保留：错误fixture receipt时间、测试glob误递归、plain/null-prototype断言、测试误设签名/ECDH错误原因、自锚trigger构造，均有历史日志/说明；没有通过放宽guard纠正测试。final-verified 是最新源码/input哈希绑定的154项证据。

本轮没有真实HTTP/Relay、PG账号allocator、durable ACK、客户端安装/存储回读、成员publisher/包交付、OfflineGrace/PhysicalDevice、产品UI或Cocos视觉证据。key package / acceptance 类型只有结构codec；其密码学解包/possession与真实注册流程不在本轮验收。
