# B2.5c 系列新增公开类型索引（c-1 / c-2b / c-2c）

- 生成：2026-10-12，Trae（EXECUTOR）机械派生索引；只读源材料，未修改任何已有文件。
- 数据源：quality-review/b2-5c-1/evidence/new-names.json（exportedTopLevelCount=75）、quality-review/b2-5c-2b/evidence/new-names.json（publicExportCount=64）、quality-review/b2-5c-2c/evidence/new-names-final.json（publicExportCount=8）。
- 冻结状态判定：名称是否出现在对应轮次提案的 A 类（已冻结）章节中，机械核验；c-1 按 new-names.json 的 category 字段映射到 v3.18 提案章节。只列公开顶层类型与正式公开方法；私有成员、局部变量、harness 与生成副本不列。
- 统计：c-1 共 75 项（其中 54 项为 P3 已冻 schema 复写）；c-2b 共 64 项；c-2c 共 8 项；合计 147 条，去重后唯一名称 147 个。

## 一、director（src/director）（113 项）

| 类型名 | 类别 | 归属文件 | 行 | 首次引入轮次 | 冻结状态 |
|---|---|---|---|---|---|
| AdmittedWorldCommit | 接口 | src/director/SharedCommitContracts.ts | 219 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| AuthorSequenceSegment | 接口 | src/director/SharedCommitContracts.ts | 26 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| CheckpointCoverageEntry | 接口 | src/director/SharedCommitContracts.ts | 288 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| DeveloperRosterChange | 接口 | src/director/SharedCommitContracts.ts | 158 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| DeveloperRosterState | 接口 | src/director/SharedCommitContracts.ts | 248 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| EditTarget | 类型别名 | src/director/SharedCommitContracts.ts | 129 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| MapEditCommitChange | 接口 | src/director/SharedCommitContracts.ts | 152 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| MapEditOperation | 类型别名 | src/director/SharedCommitContracts.ts | 145 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| MonotonicRevealChange | 接口 | src/director/SharedCommitContracts.ts | 116 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| RelayCommitEnvelope | 接口 | src/director/SharedCommitContracts.ts | 212 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| RelayCommitHeader | 接口 | src/director/SharedCommitContracts.ts | 187 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| RelayCursor | 接口 | src/director/SharedCommitContracts.ts | 320 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| RelayPullReply | 类型别名 | src/director/SharedCommitContracts.ts | 324 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| RelaySettlementSeal | 接口 | src/director/SharedCommitContracts.ts | 275 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| RestrictedWriteHeader | 类型别名 | src/director/SharedCommitContracts.ts | 184 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedAppendedAt | 接口 | src/director/SharedCommitContracts.ts | 41 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedAuthorityPayload | 类型别名 | src/director/SharedCommitContracts.ts | 449 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §3 codec 辅助类型与错误类） |
| SharedAuthorityReceipt | 接口 | src/director/SharedCommitContracts.ts | 334 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedCommitClass | 类型别名 | src/director/SharedCommitContracts.ts | 115 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedContentReference | 接口 | src/director/SharedCommitContracts.ts | 10 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedEntityRecord | 接口 | src/director/SharedCommitContracts.ts | 230 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedMapEntityDefinition | 接口 | src/director/SharedCommitContracts.ts | 131 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedPosition | 接口 | src/director/SharedCommitContracts.ts | 6 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedSchemaErrorCode | 类型别名 | src/director/SharedCommitContracts.ts | 448 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §3 codec 辅助类型与错误类） |
| SharedSchemaKind | 类型别名 | src/director/SharedCommitContracts.ts | 508 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §3 codec 辅助类型与错误类） |
| SharedSchemaMap | 接口 | src/director/SharedCommitContracts.ts | 452 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §3 codec 辅助类型与错误类） |
| SharedSettlementPolicy | 接口 | src/director/SharedCommitContracts.ts | 312 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedTriggerDefinition | 接口 | src/director/SharedCommitContracts.ts | 138 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedTriggerRecord | 接口 | src/director/SharedCommitContracts.ts | 236 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedWorldState | 接口 | src/director/SharedCommitContracts.ts | 253 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SignedWorldCommitAdmissionClaim | 接口 | src/director/SharedCommitContracts.ts | 79 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| TraceTouchAggregate | 接口 | src/director/SharedCommitContracts.ts | 242 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| TraceTouchChange | 接口 | src/director/SharedCommitContracts.ts | 122 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldAppendPermit | 接口 | src/director/SharedCommitContracts.ts | 42 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldAuthorKeyBinding | 接口 | src/director/SharedCommitContracts.ts | 102 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldChange | 类型别名 | src/director/SharedCommitContracts.ts | 166 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldChangeClass | 类型别名 | src/director/SharedCommitContracts.ts | 114 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldChangeLogWire | 接口 | src/director/SharedCommitContracts.ts | 265 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldCheckpointWire | 接口 | src/director/SharedCommitContracts.ts | 296 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldCommit | 接口 | src/director/SharedCommitContracts.ts | 168 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldCommitAdmission | 接口 | src/director/SharedCommitContracts.ts | 60 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldCommitAdmissionClaim | 接口 | src/director/SharedCommitContracts.ts | 72 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldCommitIdentity | 接口 | src/director/SharedCommitContracts.ts | 2 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldCommitRejection | 接口 | src/director/SharedCommitContracts.ts | 91 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldDeveloperClosureFact | 接口 | src/director/SharedCommitContracts.ts | 83 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldDeveloperTrustAnchor | 接口 | src/director/SharedCommitContracts.ts | 355 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldKeyAgreementPublicKey | 接口 | src/director/SharedCommitContracts.ts | 349 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldMemberCredential | 接口 | src/director/SharedCommitContracts.ts | 373 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldMembershipChange | 接口 | src/director/SharedCommitContracts.ts | 404 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldMembershipEpoch | 接口 | src/director/SharedCommitContracts.ts | 391 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldMembershipEpochProposal | 类型别名 | src/director/SharedCommitContracts.ts | 403 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldObserverAdmissionFact | 接口 | src/director/SharedCommitContracts.ts | 363 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldRelayKeyAcceptance | 接口 | src/director/SharedCommitContracts.ts | 435 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldRelayKeyDescriptor | 接口 | src/director/SharedCommitContracts.ts | 383 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldRelayKeyPackage | 接口 | src/director/SharedCommitContracts.ts | 427 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldRelayKeyPackageContext | 接口 | src/director/SharedCommitContracts.ts | 416 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WorldSharedGenesis | 接口 | src/director/SharedCommitContracts.ts | 14 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| WrappedRelayDataKey | 接口 | src/director/SharedCommitContracts.ts | 208 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §2「P3 已冻的 54 个数据名称」，沿用 v3.17/P3） |
| SharedCanonicalBytes | 类 | src/director/SharedCanonicalBytes.ts | 179 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §4 正式公开实现类与参数 API） |
| SharedSchemaError | 类 | src/director/SharedCanonicalBytes.ts | 4 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §4 正式公开实现类与参数 API） |
| SharedCommitCodec | 类 | src/director/SharedCommitCodec.ts | 577 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §4 正式公开实现类与参数 API） |
| SharedCommitValidator | 类 | src/director/SharedCommitValidator.ts | 104 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §4 正式公开实现类与参数 API） |
| SharedCryptoPort | 接口 | src/director/SharedCommitValidator.ts | 13 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| SharedValidationContext | 接口 | src/director/SharedCommitValidator.ts | 22 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| SharedValidationResult | 类型别名 | src/director/SharedCommitValidator.ts | 38 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| TrustedVerifiedGenesis | 接口 | src/director/SharedCommitValidator.ts | 42 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| ValidatedSharedClosure | 接口 | src/director/SharedCommitValidator.ts | 66 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| ValidatedSharedCommit | 接口 | src/director/SharedCommitValidator.ts | 46 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| ValidatedSharedRejection | 接口 | src/director/SharedCommitValidator.ts | 71 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| ValidatedSharedSeal | 接口 | src/director/SharedCommitValidator.ts | 61 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §5 validator 本地类型与能力） |
| SharedProvisionalCoverageEntry | 类型别名 | src/director/SharedWorldReducer.ts | 31 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §6 reducer 本地结果与 wire 的区分） |
| SharedReplayDiagnostic | 接口 | src/director/SharedWorldReducer.ts | 24 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §6 reducer 本地结果与 wire 的区分） |
| SharedReplayRequest | 接口 | src/director/SharedWorldReducer.ts | 14 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §6 reducer 本地结果与 wire 的区分） |
| SharedReplayResult | 类型别名 | src/director/SharedWorldReducer.ts | 32 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §6 reducer 本地结果与 wire 的区分） |
| SharedWorldReducer | 类 | src/director/SharedWorldReducer.ts | 246 | B2.5c-1（v3.18） | 已冻结（v3.18 提案 §4 正式公开实现类与参数 API） |
| AccessCodeChangeProposal | 接口 | src/director/SharedServiceProtocolContracts.ts | 58 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| AccessCodeChangeRequest | 接口 | src/director/SharedServiceProtocolContracts.ts | 66 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| AuthorityProtocolResult | 接口 | src/director/SharedServiceProtocolContracts.ts | 131 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RealCommitRelayProtocolPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 255 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RealWorldAuthorityProtocolPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 238 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RegisteredAuthorSigningPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 265 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RelayAckFact | 接口 | src/director/SharedServiceProtocolContracts.ts | 120 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RelayAckReceipt | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 130 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RelayAckRequest | 接口 | src/director/SharedServiceProtocolContracts.ts | 108 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RelaySubmitFact | 接口 | src/director/SharedServiceProtocolContracts.ts | 100 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RelaySubmitReceipt | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 129 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedCommitSealingPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 273 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedHttpReply | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 11 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedHttpRequest | 接口 | src/director/SharedServiceProtocolContracts.ts | 5 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedOperationAuthorization | 接口 | src/director/SharedServiceProtocolContracts.ts | 39 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedProtocolCodecPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 281 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedProtocolOperation | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 177 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedProtocolPayloadMap | 接口 | src/director/SharedServiceProtocolContracts.ts | 197 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedProtocolReply | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 237 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedProtocolSignatureKind | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 280 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedProtocolValueMap | 接口 | src/director/SharedServiceProtocolContracts.ts | 217 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedRelayDurableCachePort | 接口 | src/director/SharedServiceProtocolContracts.ts | 276 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServiceErrorCode | 类型别名 | src/director/SharedServiceProtocolContracts.ts | 178 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServiceFault | 接口 | src/director/SharedServiceProtocolContracts.ts | 14 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServiceProtocolCodec | 类 | src/director/SharedServiceProtocolCodec.ts | 122 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServiceSessionPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 260 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServiceStatusPayload | 接口 | src/director/SharedServiceProtocolContracts.ts | 189 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedTransportReceipt | 接口 | src/director/SharedServiceProtocolContracts.ts | 25 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldAgreementCredentialFact | 接口 | src/director/SharedServiceProtocolContracts.ts | 79 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldDeveloperSigningPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 166 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldKeyAgreementPort | 接口 | src/director/SharedServiceProtocolContracts.ts | 288 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldMemberCredentialChallenge | 接口 | src/director/SharedServiceProtocolContracts.ts | 148 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldMemberCredentialChallengeContext | 接口 | src/director/SharedServiceProtocolContracts.ts | 137 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldMemberCredentialProof | 接口 | src/director/SharedServiceProtocolContracts.ts | 155 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldObserverChallenge | 接口 | src/director/SharedServiceProtocolContracts.ts | 87 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldRegistrationProposal | 接口 | src/director/SharedServiceProtocolContracts.ts | 44 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldRegistrationRequest | 接口 | src/director/SharedServiceProtocolContracts.ts | 54 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldServiceFacts | 接口 | src/director/SharedServiceProtocolContracts.ts | 70 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |

## 丁、presentation（src/presentation）（3 项）

| 类型名 | 类别 | 归属文件 | 行 | 首次引入轮次 | 冻结状态 |
|---|---|---|---|---|---|
| RealSharedServiceSessionAdapter | 类 | src/presentation/RealSharedServiceSessionAdapter.ts | 35 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RealWorldAuthorityAdapter | 类 | src/presentation/RealWorldAuthorityAdapter.ts | 8 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RealCommitRelayAdapter | 类 | src/presentation/RealCommitRelayAdapter.ts | 16 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |

## 丂、server（server/src）（29 项）

| 类型名 | 类别 | 归属文件 | 行 | 首次引入轮次 | 冻结状态 |
|---|---|---|---|---|---|
| AuthorityClockSample | 接口 | server/src/RealAuthorityClock.ts | 5 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| authorityRoutes | 公开函数 | server/src/AuthorityRoute.ts | 23 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| buildIsolatedSharedServer | 公开函数 | server/src/buildSharedServer.ts | 14 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| buildSharedServer | 公开函数 | server/src/buildSharedServer.ts | 12 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| IsolatedClockSource | 接口 | server/src/RealAuthorityClock.ts | 6 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| makeCredentialChallenge | 公开函数 | server/src/SharedCryptoProof.ts | 6 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| RealAuthorityClock | 类 | server/src/RealAuthorityClock.ts | 7 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| sharedCanonical | 公开函数 | server/src/SharedReceiptSigner.ts | 8 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| sharedEnvironmentConfig | 公开函数 | server/src/SharedServerConfig.ts | 25 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedMigrationRunner | 类 | server/src/SharedMigrationRunner.ts | 15 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedOperatorWorldPin | 接口 | server/src/SharedServerConfig.ts | 9 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedReceiptSigner | 类 | server/src/SharedReceiptSigner.ts | 13 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServerConfig | 接口 | server/src/SharedServerConfig.ts | 19 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedServiceFailure | 类 | server/src/SharedSessionVerifier.ts | 7 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedSession | 接口 | server/src/SharedSessionVerifier.ts | 10 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| SharedSessionVerifier | 类 | server/src/SharedSessionVerifier.ts | 14 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| sharedUnsigned | 公开函数 | server/src/SharedReceiptSigner.ts | 9 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| StoredWorld | 接口 | server/src/WorldAuthorityStorage.ts | 4 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| validateSharedConfig | 公开函数 | server/src/SharedServerConfig.ts | 35 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| verifySharedSignature | 公开函数 | server/src/SharedReceiptSigner.ts | 10 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldAuthorityService | 类 | server/src/WorldAuthorityService.ts | 27 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| WorldAuthorityStorage | 类 | server/src/WorldAuthorityStorage.ts | 5 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| buildIsolatedRelayServer | 公开函数 | server/src/buildRelayServer.ts | 20 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |
| buildRelayServer | 公开函数 | server/src/buildRelayServer.ts | 15 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |
| relayRoutes | 公开函数 | server/src/RelayRoute.ts | 24 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |
| RelayService | 类 | server/src/RelayService.ts | 34 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |
| RelayStorage | 类 | server/src/RelayStorage.ts | 28 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |
| RelayStoredCommit | 接口 | server/src/RelayStorage.ts | 12 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |
| RelayStoredStream | 接口 | server/src/RelayStorage.ts | 5 | B2.5c-2c（v3.21） | 已冻结（v3.21 提案 A 类） |

## 七、assets/scripts（c-2b 原型装配）（2 项）

| 类型名 | 类别 | 归属文件 | 行 | 首次引入轮次 | 冻结状态 |
|---|---|---|---|---|---|
| buildSharedRelayPrototype | 公开函数 | assets/scripts/SharedRelayPrototypeBuilder.ts | 10 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |
| buildSharedRelayPrototypeForLoopbackHttpTest | 公开函数 | assets/scripts/SharedRelayPrototypeBuilder.ts | 23 | B2.5c-2b（v3.20） | 已冻结（v3.20 提案 A 类） |

## 阶段统计

| 阶段 | 提案 | 公开顶层名 | 备注 |
|---|---|---|---|
| B2.5c-1 | namebook-v3.18-appendix-proposal.md | 75 | 54 项 P3 已冻 schema 复写 + 4 codec 辅助类型 + 5 公开实现类 + 8 validator 本地 API 类型 + 4 reducer 本地类型 |
| B2.5c-2b | namebook-v3.20-appendix-proposal.md | 64 | 37 协议契约类型 + 1 Codec 类 + 2 Adapter 类 + 2 Builder 函数 + 22 server 声明 |
| B2.5c-2c | namebook-v3.21-appendix-proposal.md | 8 | 5 类型/类 + 3 公开函数（relayRoutes/buildRelayServer/buildIsolatedRelayServer） |
| 合计 | — | 147 | 去重后唯一名称 147 个 |

## 说明

- assets/scripts 域（c-2b 的 SharedRelayPrototypeBuilder 两个装配函数）按数据实情单列一组，未强行并入三分域。
- c-2b 提案 A 类核验与 c-2c 提案 A 类核验均为机械字符串命中；若出现"核验未命中"行，需人工复核后才能采信（本轮输出上方控制台已列命中情况）。
- IntentPort 一条 type-only 语句重导出的三个既有 validator 类型（SharedCommitValidator、ValidatedSharedCommit、SharedValidationResult）为 c-1 已有名，不重复计入 c-2c 新名（口径见 delivery-report.md L117）。
