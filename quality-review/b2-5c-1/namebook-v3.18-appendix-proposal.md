# 名库 v3.18 附录提案 · B2.5c-1 实际源码命名清单

状态：**交 Trae 落盘的附录提案**。Codex 本轮没有修改名库、docs、参照文件或 P3 冻结文件。`docs/NAMEBOOK.md`、`docs/spec/stage-1.md` 在 c-1 baseline 后出现的外部变化，已获本次独立用户确认“确认：Trae 授权同步 v3.17/P3”；`evidence/source-attribution-closure.md` / `.json` 按路径和 SHA256 闭合归因，历史 raw SHA FAIL 原样保留。这不表示全域 docs 字节未变，也不表示本 v3.18 提案已落入名库。本提案记录 B2.5c-1 已批准的五份独立源码；不授予 B2.5c-2 网络、密钥分发、存储或产品接线权限。

机械清单为 `evidence/new-names.json`，使用工作区 TypeScript Compiler AST 扫描五份源码，记录源文件 SHA256、位置、全部顶层声明、类型字段/类成员、参数及局部声明。扫描排除 import 和普通属性使用，避免把引用旧名称列为新声明。54 个 P3 schema 与 `SharedSchemaMap` 的 54 个 key 一一核对。源码目录为 `src/director/`，没有恢复 `archive/service/sync`。

## 1. 命名状态与来源

| 分类 | 数量/范围 | 本轮状态 |
|---|---|---|
| P3 已冻数据 schema 的 type-only 复写 | 54 | 沿用 v3.17/P3 的名称、字段、值域和语义；首次源码承载不构成重新命名 |
| codec 辅助类型 | 4 | 本轮新增实现类型；不进入 wire、不授予验证能力 |
| 公开实现类 | 5 | 四个正式类名 `SharedCanonicalBytes`、`SharedCommitCodec`、`SharedCommitValidator`、`SharedWorldReducer` 保持逐字；另含边界错误类 `SharedSchemaError` |
| validator 本地 API 类型 | 8 | 密码学注入、受信上下文、结果及本实例能力；不作为服务 wire |
| reducer 本地 API 类型 | 4 | 输入、结果、个人诊断提案及暂态 coverage；不扩展 checkpoint wire |
| 实现常量/内部名 | AST 清单逐项列出 | 私有实现细节；没有新导出的常量或全局会话 |
| future ports/routes | B2.5c-2 候选 | 本轮没有生产导出、HTTP route、真实 Relay 或 Auth 接线 |

五份源码共 75 个顶层公开声明：54 + 4 + 5 + 8 + 4。该数不将公开方法、schema 字段或局部绑定重复计为顶层导出。

## 2. P3 已冻的 54 个数据名称

`SharedCommitContracts.ts` 只提供类型声明。以下是已经冻结的数据契约的源码复写，精确字段/联合分支见源码及 AST 清单；不创建同名旧同步服务实现，不把历史三元身份转换为新二元身份。

| 名称集合 | 内容与边界 |
|---|---|
| `WorldCommitIdentity`、`SharedPosition`、`SharedContentReference`、`WorldSharedGenesis` | 二元账号/序号身份、整数位置、批准内容引用及受信世界初始态 |
| `AuthorSequenceSegment`、`SharedAppendedAt`、`WorldAppendPermit`、`WorldCommitAdmission`、`WorldCommitAdmissionClaim`、`SignedWorldCommitAdmissionClaim`、`WorldDeveloperClosureFact`、`WorldCommitRejection`、`WorldAuthorKeyBinding` | 轻量权威事实及签名载体；`AppendedAt` 来源不变成客户端时钟 |
| `WorldChangeClass`、`SharedCommitClass`、`MonotonicRevealChange`、`TraceTouchChange`、`EditTarget`、`SharedMapEntityDefinition`、`SharedTriggerDefinition`、`MapEditOperation`、`MapEditCommitChange`、`DeveloperRosterChange`、`WorldChange` | 三类允许变化与精确分支；有限地图 schema 不表示编辑器/ObserverSync 产品机制上线 |
| `WorldCommit`、`RestrictedWriteHeader`、`RelayCommitHeader`、`WrappedRelayDataKey`、`RelayCommitEnvelope`、`AdmittedWorldCommit` | 正文、外层分类、DEK 包裹及精确原始字节准入容器 |
| `SharedEntityRecord`、`SharedTriggerRecord`、`TraceTouchAggregate`、`DeveloperRosterState`、`SharedWorldState`、`WorldChangeLogWire` | 共享投影、稳定 ID/tombstone、聚合计数及共享日志；不包含个人七项 Core 或迁移 journal |
| `RelaySettlementSeal`、`CheckpointCoverageEntry`、`WorldCheckpointWire`、`SharedSettlementPolicy`、`RelayCursor`、`RelayPullReply`、`SharedAuthorityReceipt` | 封边、精确 coverage、checkpoint、G/B/U/H/retention 约束、接收 cursor 及服务 receipt |
| `WorldKeyAgreementPublicKey`、`WorldDeveloperTrustAnchor`、`WorldObserverAdmissionFact`、`WorldMemberCredential`、`WorldRelayKeyDescriptor`、`WorldMembershipEpoch`、`WorldMembershipEpochProposal`、`WorldMembershipChange`、`WorldRelayKeyPackageContext`、`WorldRelayKeyPackage`、`WorldRelayKeyAcceptance` | 成员/根 pin/ECDH/epoch/key 包数据形状；**key 包及 acceptance 在 c-1 仅有 codec 结构校验，没有包密码学验证或分发机制** |

`SharedAuthorityReceipt<T>` 的泛型不产生新 purpose；只能使用 P3 已冻 purpose。`WorldMembershipEpochProposal` 是既有 epoch 数据的提案投影，不能用没有权威 activation 的对象冒充有效 epoch。

## 3. 四个 codec 辅助类型与错误类

| 名称 | 精确职责 |
|---|---|
| `SharedSchemaErrorCode` | `'CanonicalInvalid' \| 'SchemaInvalid' \| 'ValueInvalid' \| 'InvariantInvalid' \| 'LimitExceeded'`；本地解析错误类别，不是 HTTP error wire |
| `SharedAuthorityPayload` | 现有权威 payload 的联合类型，供 codec schema map 使用；不扩大 receipt purpose |
| `SharedSchemaMap` | 54 个精确 schema key 到对应类型的映射，所有属性 readonly |
| `SharedSchemaKind` | `keyof SharedSchemaMap`；泛型选型，不是输入包的自由 schema 字段 |
| `SharedSchemaError` | `Error` 子类；构造器 `constructor(readonly code: SharedSchemaErrorCode, message: string = code)`；运行时边界错误位于 `SharedCanonicalBytes.ts` |

## 4. 正式公开实现类与参数 API

### SharedCanonicalBytes

静态参数 API；无平台 codec、网络、时钟或密码学实现。严格 canonical JSON 整数子集、UTF8 及无填充 base64url；decode 要求输入精确等于规范重编码结果。符号、getter、重复 JSON key、非规范数字、非法 Unicode、稀疏数组和隐藏字段被拒绝。

| 方法 | 签名 |
|---|---|
| `encode` | `(value: unknown): Uint8Array` |
| `decode` | `(bytes: Uint8Array): unknown` |
| `utf8` | `(text: string): Uint8Array` |
| `text` | `(bytes: Uint8Array): string` |
| `base64UrlEncode` | `(bytes: Uint8Array): string` |
| `base64UrlDecode` | `(text: string, expectedLength?: number): Uint8Array` |
| `equalBytes` | `(first: Uint8Array, second: Uint8Array): boolean` |
| `domain` | `(domainString: string, value: unknown): Uint8Array`；连接所给域 UTF8 与规范 JSON，不能自行补/替换域字节 |

### SharedCommitCodec

实例参数 API；`K extends SharedSchemaKind`。输入先复制到规范数据边界，严格形状/值域/交叉字段验证后深冻结。有效 shape 不等于密码学或来源已验证。

| 方法 | 签名 |
|---|---|
| `validate` | `<K extends SharedSchemaKind>(kind: K, value: unknown): SharedSchemaMap[K]` |
| `encode` | `<K extends SharedSchemaKind>(kind: K, value: unknown): Uint8Array` |
| `decode` | `<K extends SharedSchemaKind>(kind: K, bytes: Uint8Array): SharedSchemaMap[K]` |

同一 world 的 map/entity/trigger/touch 稳定 ID 共域唯一，tombstone 继续占用；正常引用及聚合引用不是再定义 ID。`createdBy != null` 必须伴随 `lastEditedBy != null`。raw admitted envelope 保留精确字节，不先丢弃坏正文再伪造无效项。

### SharedCommitValidator

构造器 `constructor(crypto: SharedCryptoPort, context: SharedValidationContext)`；输入为参数，密码学与受信来源显式注入，没有环境时钟、网络或存储。source receipt、claim/作者签名、membership 签名、注册公钥/指纹、DEK/HKDF/GCM、精确 envelope 摘要与正文重复字段沿 P3 边界验证。

| 方法 | 签名 |
|---|---|
| `ownsGenesis` | `(value: unknown): value is TrustedVerifiedGenesis` |
| `ownsCommit` | `(value: unknown): value is ValidatedSharedCommit` |
| `ownsSeal` | `(value: unknown): value is ValidatedSharedSeal` |
| `ownsClosure` | `(value: unknown): value is ValidatedSharedClosure` |
| `ownsRejection` | `(value: unknown): value is ValidatedSharedRejection` |
| `validateGenesis` | `(input: unknown): Promise<SharedValidationResult<TrustedVerifiedGenesis>>` |
| `isApprovedEntityDefinition` | `(input: unknown): boolean` |
| `validateCommit` | `(input: unknown): Promise<SharedValidationResult<ValidatedSharedCommit>>` |
| `validateSeal` | `(input: unknown, policyInput: SharedSettlementPolicy, previous: ValidatedSharedSeal \| null = null): Promise<SharedValidationResult<ValidatedSharedSeal>>` |
| `validateClosure` | `(input: unknown): Promise<SharedValidationResult<ValidatedSharedClosure>>` |
| `validateRejection` | `(input: unknown): Promise<SharedValidationResult<ValidatedSharedRejection>>` |

`owns*` 依赖本实例私有 WeakSet；类型断言、结构对象、复制或从文件恢复的值均不能获得能力。已 admitted 来源完备而正文不可用的项可以被明确归类为 `invalid`，不能因此授予一个正常 `WorldCommit`。缺来源/字节摘要不符/缺群 key 返回 Gap，host/backend 故障返回 HostFailure。

### SharedWorldReducer

构造器 `constructor(validator: SharedCommitValidator, crypto: SharedCryptoPort)`；公开方法 `replay(input: SharedReplayRequest): Promise<SharedReplayResult>`。确定性重放使用已验证能力、总序、权限/存在性规则、精确身份去重及封边；本地 checkpoint 信任由 reducer 私有 `Map<string, TrustedCheckpoint>` 保存，只接受本实例已产生、且完整规范内容相等的 checkpoint，并复核 seal/closure 能力，不靠陌生文件的 hash 自称可信。同一实例可以重取已知 checkpoint 的等值副本，跨实例/重启后的陌生 checkpoint 无此本地记录。内核不写存储、不追加个人 NarrativeEvent、不发布诊断、不调用实时服务。

## 5. validator 本地类型与能力

| 名称 | 分类与关键字段 |
|---|---|
| `SharedCryptoPort` | 依赖注入 port，四个方法：`sha256(bytes): Promise<string>`、`verifyEs256(jwk, signature, message): Promise<boolean>`、`hkdfSha256(ikm, salt, info, length): Promise<Uint8Array>`、`decryptAes256Gcm(key, nonce, ciphertextAndTag, aad): Promise<Uint8Array \| null>`；检查过的认证失败为 null，backend 故障须 throw |
| `SharedValidationContext` | caller 安装的受信配置：service instance/root fingerprint、clockGeneration 上限、developerTrustAnchor、批准 Genesis/world/map/content 摘要及两个来源 callback；不从输入文件构造信任 |
| `SharedValidationResult<T>` | 本地结果联合：`Verified/value`、`Gap/reason`、`HostFailure/reason` |
| `TrustedVerifiedGenesis` | 本实例拥有的 `{genesis, genesisSha256}` 验证能力 |
| `ValidatedSharedCommit` | 本实例能力；包含 wire/精确 envelope 字节、identity/AppendedAt/digest/admissionRevision、header/sequenceSegment、可空正文/change 与 invalid 分类 |
| `ValidatedSharedSeal` | 本实例能力，含 seal wire、payload 和 receiptSha256 |
| `ValidatedSharedClosure` | 本实例能力，含 closure wire、payload 和 receiptSha256 |
| `ValidatedSharedRejection` | 本实例能力，含 rejection wire、payload 和 receiptSha256 |

`lookupWorldRelayKey(descriptor)` 的类型为 `Promise<Uint8Array | null>`，本轮只是 caller 已安装的受保护 key 查询能力；没有创建秘密存储或分发入口。`isEntityDefinitionApproved(definition)` 必须检查正式内容和 Normal Trace 资格，presence 不替代来源批准。历史签名 clockGeneration 可处于独立可信上限之下，不用当前墙钟抹除既有历史许可。

## 6. reducer 本地结果与 wire 的区分

| 名称 | 分类与语义 |
|---|---|
| `SharedReplayRequest` | 本地输入：genesis、parentCheckpoint、commits、settlementSeal、developerClosure、policy、gaps、pendingCandidateCount；外来证据仍从 unknown 验证 |
| `SharedReplayDiagnostic` | `{identity, cause, scope:'PersonalDiagnosticBoundary'}`；cause 只为已有 MergeConflict/RevertedEdit/InvalidChange；是确定性提案，未写入个人账本 |
| `SharedProvisionalCoverageEntry` | `Omit<CheckpointCoverageEntry, 'finalDiagnostic'> & {readonly finalDiagnostic:null}`；本地暂态投影，**不作为 wire coverage entry 或可序列化 checkpoint 准入依据** |
| `SharedReplayResult` | `Replayed` 含 state、coverage、provisionalCoverage、checkpoint、diagnostics、selfContribution；或 Gap/HostFailure。state 包含暂态尾部，只有 checkpoint.state 是已封边前缀 |

`coverage` 对应已结算 `CheckpointCoverageEntry`；`provisionalCoverage` 单列未结算尾部，不能混入已封边集合或提前形成个人不可逆诊断。`selfContribution.kind` 本轮仍为 `Unknown`，没有恢复个人贡献证明。

## 7. 实现常量与内部名

这些名称只供实现追踪。完整 scoped 参数/局部绑定及源码行号在 AST JSON 中；它们不升级为产品概念、service wire 或全局可变状态。

| 文件 | 顶层实现常量/注册表 |
|---|---|
| `SharedCanonicalBytes.ts` | `BASE64_URL_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'`；`CANONICAL_DEPTH_LIMIT=128`。128 是恶意嵌套的解析安全上限，不是新协议版本或权威 policy |
| `SharedCommitCodec.ts` | `version`、`profile`、`uuid`、`instance`、`digest`、`fingerprint`、`nonnegative`、`positive`、`bool`、`signature`、`nonce`、`uint128`、`uint64`、`key`、`recordFields`、`triggerRecordFields`、`membershipFields`、`schemaRules`；均未导出 |
| `SharedWorldReducer.ts` | `UINT128_MAX='340282366920938463463374607431768211455'`；`sharedCodec`，均模块私有 |

| 文件 | 模块私有类型/类/函数 |
|---|---|
| `SharedCanonicalBytes.ts` | `invalid`、`scalarString`、`descriptors`、`canonical`、`SharedJsonReader`、`assertBytes` |
| `SharedCommitCodec.ts` | `SharedData`、`SharedRule`、`SharedFields`；`fail`、`data`、`fields`、`literal`、`oneOf`、`stringPattern`、`integer`、`nullable`、`array`、`alternative`、`reference`、`binary`、`decimal`、`requireInvariant`、`same`、`sorted`、`identityKey`、`order`、`receiptPayload`、`inspect`、`authorityReceiptInvariants`、`admittedInvariants`、`membershipInvariants`、`stateInvariants`、`genesisInvariants`、`logInvariants`、`checkpointInvariants`、`pullInvariants`、`immutable` |
| `SharedCommitValidator.ts` | `SharedVerificationGap`、`SharedCryptoHostFailure`、`requireSource`、`sameData`、`unsigned`、`hashBytes`、`owns` |
| `SharedWorldReducer.ts` | `MutableEntityRecord`、`MutableTriggerRecord`、`MutableCoverage`、`ReplayState`、`AppliedChange`、`TrustedCheckpoint`、`ObservedAllocations`、`SharedReplayGap`；`requireReplay`、`compareText`、`identityKey`、`sameData`、`compareEntry`、`stateFrom`、`stateSnapshot`、`activeEntity`、`validTrigger`、`nextTouchCount`、`touchStrength`、`applied`、`invalidChange`、`mapEdit`、`usedStableId`、`unusedTouchId`、`rosterEdit`、`applyCommit` |

Validator 私有成员为 codec、genesis/commit/seal/closure/rejectionCapabilities、context、构造器 crypto，以及 verifyMembership、verifyRosterOrigin、bodyMatchesHeader、requireHeaderContext、receipt、verifyInstalledPins、fingerprint、digest、verify、invalidCommit、capability、guard。Reducer 私有成员为 checkpoints、构造器 validator/crypto，以及 hash、readParent、apply、verifyObservedAllocations。内部成员名称按 AST 原拼写记录，不替换正式类名。

P3 候选的 `SHARED_SCHEMA_VERSION`、`AUTHOR_SEQUENCE_SEGMENT_SIZE`、`WORLD_APPEND_PERMIT_TTL_MS`、`RELAY_BATCH_MAX_COUNT` 等 UPPER_SNAKE_CASE 别名本轮未创建。既有 wire 数值通过内部规则落实，不将候选别名列为已导出常量。

## 8. 实际 validator 签名/加密域

以下七个字面量从 `SharedCommitValidator.ts` 的 AST 实际提取；`\0` 表示单个 NUL 字节。不是反斜杠和字符 0，也没有新增 wire 域。

| 实际域 | c-1 使用 |
|---|---|
| `Neurou/commit-admission-claim/v1\0` | 验作者 admission claim 签名 |
| `Neurou/world-commit/v1\0` | 验最终 envelope 的作者签名 |
| `Neurou/relay-dek/v1\0` | HKDF info 绑定 header |
| `Neurou/relay-wrap/v1\0` | 解包 commit DEK 的 AAD |
| `Neurou/relay-body/v1\0` | 解密正文的 AAD，绑定 header 与 wrappedCommitDataKey |
| `Neurou/world-membership/v1\0` | 验 membership 提案的开发者签名 |
| `Neurou/shared-authority/v1\0` | 验服务 receipt 的独立签名域 |

P3 中 AccessCode/key package/acceptance 相关域保留历史冻结：c-1 validator 没有调用这些域、没有 ECDH/key 包密码学/acceptance 校验或分发。测试 fixture 生成 key 包不构成生产实现或真实服务验收。

## 9. 留 B2.5c-2 的候选及 Trae 落盘要求

| 名称/机制 | 状态 |
|---|---|
| `RealCommitRelayProtocolPort` / `submit` / `pull` / `acknowledge` | future port 候选，c-2 正式绑定；本轮没有创建该生产导出，已有 b 泛型 RealCommitRelayPort 不改 |
| `allocateSegment` / `issueAppendPermit` / `admitCommit` / `sealPrefix` 轻量权威 ports/routes | 数据操作语义沿 P3；接口名、HTTP path/error/request、CSRF 与幂等服务实施绑定留 c-2 |
| `SharedWorldCodec` / `WorldCommitCodec` / `WorldCheckpointCodec` / `SharedWorldSession` / `RelayServiceAdapter` | 历史职责候选；本轮实际正式类名为上文四类，不替换为这些候选名字 |
| Publisher/key 包交付与 acceptance、根 key 保管/恢复/轮换、ECDH 持有 challenge、限流数值/可信 IP | 仍需实施前补冻及独立证据；codec shape 不授予秘密创建或消息发送权限 |
| OfflineTimeProof / OfflineAuthorPermit、旧三元身份迁移、自身贡献证明、完整 FileCarry、ObserverSync/编辑器接线 | 延期范围；本轮没有实现或新增授权 |

Trae 只在收到正式落盘授权后合并此附录与 v3.17 历史链，保留“P3 已冻复写 / c-1 本地 API / 内部实现 / c-2 候选”的区分。不可把 validator WeakSet 能力或 reducer 本地可信 checkpoint 记录写成可序列化 wire brand，不可把 provisionalCoverage 写为已结算 coverage，不可将 key 包形状校验写成 key 包密码学验收或 Relay 上线。本轮名库未落盘。
