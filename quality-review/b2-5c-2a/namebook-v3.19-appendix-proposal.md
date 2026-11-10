# 名库 v3.19 最终附录提案 · 交 Trae 落盘

日期：2026-10-11。状态：本轮冻结包附件；**本文件不是docs/NAMEBOOK.md修改，Trae尚须按授权将附录落盘**。基于当前v3.18已同步及P3/c-1冻结命名；不覆盖历史正文，不创建实现。正式依据VERDICT-426～440。

## 已冻结 · 类/模块与正式归属

| 名称 | 后续正式归属 | 职责 |
|---|---|---|
| SharedServiceProtocolContracts | src/director/SharedServiceProtocolContracts.ts | c-2增量纯数据/port，type-only |
| SharedRelayPrototype | src/director/SharedRelayPrototype.ts | 独立共享在线原型纯编排，零平台依赖 |
| WorldRelayKeyDelivery | src/director/WorldRelayKeyDelivery.ts | 根/群key包/possession交接纯编排 |
| RealWorldAuthorityAdapter | src/presentation/RealWorldAuthorityAdapter.ts | 真实轻量authority HTTP适配 |
| RealCommitRelayAdapter | src/presentation/RealCommitRelayAdapter.ts | 真实submit/relay/pull/ACK HTTP适配 |
| RealSharedServiceSessionAdapter | src/presentation/RealSharedServiceSessionAdapter.ts | P7批准的独立真实认证/CSRF/注册签名owner，旧AuthAdapter保持 |
| SharedCryptoAdapter | src/presentation/SharedCryptoAdapter.ts | c-1 crypto验证与固定用途ECDH/HKDF/GCM/HMAC/封装平台实现 |
| SharedRelayDurableCache | src/presentation/SharedRelayDurableCache.ts | 独立共享密文及公共proof原子耐久/回读，不存秘密或个人层 |
| SharedRelayPrototypeBuilder | assets/scripts/SharedRelayPrototypeBuilder.ts | 独立组合根；不接旧Builder或产品UI |
| WorldAuthorityService / WorldAuthorityStorage | server/src/WorldAuthorityService.ts / WorldAuthorityStorage.ts | 轻量权威事务/PG事实访问 |
| RelayService / RelayStorage | server/src/RelayService.ts / RelayStorage.ts | 有限密文队列、cursor、交付/ACK |
| AuthorityRoute / RelayRoute | server/src/AuthorityRoute.ts / RelayRoute.ts | 本轮冻结HTTP wire与limits映射 |
| RealAuthorityClock | server/src/RealAuthorityClock.ts | 真实wall/monotonic+PG floor/generation，失信latch |
| SharedSessionVerifier | server/src/SharedSessionVerifier.ts | 同PG/b规则真实session与CSRF实时核验 |
| SharedMigrationRunner | server/src/SharedMigrationRunner.ts | checksum/锁/新增002增量迁移，旧runner保持 |
| SharedTlsEdge | server/src/SharedTlsEdge.ts | P8批准的LAN TLS公共边界与固定loopback转换 |
| SharedServerConfig | server/src/SharedServerConfig.ts | 精确公共origin/操作员pins/shared资源配置，无fixture入口 |
| buildSharedServer | server/src/buildSharedServer.ts | 旧b buildApp与新shared插件独立装配；新shared-main.ts仅独立启动 |

文件路径本轮仅冻结，尚不存在并不算前置已实现。独立Node server可只读编译已有纯codec，不复制宽松格式；presentation→director仅IntentPort type-only。原RealServiceBuilder不扩展，IntentPort后续只追加type-only。

## 已冻结 · 增量类型与用途

| 类型名称 | 精确契约来源 |
|---|---|
| RealWorldAuthorityProtocolPort / RealCommitRelayProtocolPort | http-and-port-draft.md §1/7；分别继承旧port，不原位改旧定义 |
| SharedServiceSessionPort / RegisteredAuthorSigningPort | HTTP §7；无secret getter/任意URL/domain签名 |
| WorldKeyAgreementPort / WorldDeveloperSigningPort | key-delivery-and-pins.md §4；固定用途与suite |
| SharedCommitSealingPort / SharedRelayDurableCachePort | HTTP §7；封装真实permit提交 / 密文耐久回读 |
| SharedHttpRequest / SharedHttpReply / SharedServiceFault | HTTP §2/6；严格outer wire |
| SharedServiceErrorCode / SharedTransportReceipt / SharedOperationAuthorization / AuthorityProtocolResult | HTTP §2/3/6；新错误detail、新用途签名wrapper、注册设备用途签名 |
| WorldRegistrationProposal / WorldRegistrationRequest | HTTP §6；批准轻量摘要/root签名 |
| AccessCodeChangeProposal / AccessCodeChangeRequest | HTTP §6；六位码CAS/root签名 |
| WorldServiceFacts / WorldAgreementCredentialFact / WorldObserverChallenge | HTTP §6；轻量facts/ECDH绑定/public准入挑战 |
| WorldMemberCredentialChallengeContext / WorldMemberCredentialChallenge / WorldMemberCredentialProof | key文档 §3；ECDH私钥真实possession |
| RelaySubmitFact / RelayAckRequest / RelayAckFact / RelaySubmitReceipt / RelayAckReceipt | HTTP §5/6；位置、摘要、ACK声明与服务来源 |
| SharedProtocolOperation | HTTP §6的18条route尾部精确联合（含首个/）；不得用任意string/URL |

不另建AuthorityErrorCode/RelayErrorCode：统一SharedServiceErrorCode+fault.layer，只保留b粗code。不另建全新共享日志；WorldChangeLogWire/Checkpoint/WorldCommit等P3/c-1名继续沿用。

## 已冻结 · 常量值、签名域、表名

后续常量名及值：

| 常量 | 值 / 含义 |
|---|---|
| SHARED_TRANSPORT_SIGNATURE_DOMAIN | Neurou/shared-transport/v1\0 |
| SHARED_DEVICE_OPERATION_SIGNATURE_DOMAIN | Neurou/shared-device-operation/v1\0 |
| WORLD_REGISTRATION_SIGNATURE_DOMAIN | Neurou/world-registration/v1\0 |
| WORLD_ACCESS_CODE_CHANGE_SIGNATURE_DOMAIN | Neurou/world-access-code-change/v1\0 |
| WORLD_MEMBER_CREDENTIAL_PROOF_KEY_DOMAIN | Neurou/world-member-credential-proof-key/v1\0 |
| WORLD_MEMBER_CREDENTIAL_PROOF_AAD_DOMAIN | Neurou/world-member-credential-proof-aad/v1\0 |
| WORLD_MEMBER_CREDENTIAL_POSSESSION_DOMAIN | Neurou/world-member-credential-possession/v1\0 |
| WORLD_MEMBER_CREDENTIAL_PROOF_SIGNATURE_DOMAIN | Neurou/world-member-credential-proof-signature/v1\0 |
| RELAY_ACK_SIGNATURE_DOMAIN | Neurou/relay-ack/v1\0 |
| SHARED_CHALLENGE_TTL_MS | 30000；credential/Observer/publisher acceptance挑战分别记录，不能互代 |
| SHARED_MEMBER_CREDENTIAL_LIMIT | 256；完整epoch凭据上限 |
| SHARED_RESPONSE_LIMIT_BYTES | 1048576；完整canonical HTTP响应 |
| WORLD_RELAY_KEY_PACKAGE_LIMIT_BYTES | 16384；完整canonical key包 |
| SHARED_REQUEST_TIMEOUT_MS | 12000 |
| RELAY_PULL_TIMEOUT_MARGIN_MS | 7000；pull wait+margin最大32000 |
| SHARED_IDEMPOTENCY_RESULT_RETENTION_MS | 604800000；其后永久nonce/result tombstone |

P3既有G/B/U/H/retention、1024/1小时段、30秒permit、65536 envelope、uint64cursor/uint128触痕和签名/AEAD域继续沿用，不改名/重复另造定义。`\0`表示编码后的单个NUL，不是反斜杠+0两字节。HTTP18路径/限额及速率固定值见HTTP冻结；PG17新表18项、002迁移及锁序见storage-and-clock-contract.md，不在此造别名。

新增SharedTransportReceipt purpose精确联合：SharedServiceStatus、WorldRegistration、WorldFacts、AgreementCredentialChallenge、AgreementCredential、AccessCodeUpdated、ObserverChallenge、AuthorityResult、MembershipRead、AdmissionRead、RelaySubmit、RelayPull、RelayAck。这些不是c-1 SharedAuthorityReceipt purpose的扩展。

## 候选 / 未冻结 / 排除

| 名称或能力 | 状态与前置 |
|---|---|
| 自动P2P key helper/自动网络包交付 | 候选，无正式类名；须另冻传输/授权/P4秘密保护，c-2不部署 |
| 长期publisher/根恢复/根轮换 | 候选，P4或新PROTOCOL；内存原型不宣称恢复 |
| authority_key_delivery_facts / 服务delivery-confirmation | 本次不纳入，不建表/route；本地publisher验HMAC即可 |
| RealServiceBuilder扩展 | 不采纳；采用新SharedRelayPrototypeBuilder |
| 完整FileCarryEnvelope/FileCarryPersonalLayer/EncryptedPersonalLayer/WrappedAccountDataKey | 本次不新增，归P4冻结 |
| OfflineGrant/PhysicalDevice/DeviceUptimeSample/bootId | 本次不新增、不授原生host机制，归P5 |
| WorldRegistry位置/旧三元身份迁移/非Primary迁移 | 明确排除 |
| 产品ObserverSync/AccessCode首次加入UI/EditPresence/编辑器全功能 | 明确排除；协议级准入不能暗开产品机制 |

Trae应只将“已冻结”条目按本次正式裁定附录落盘，候选明确标注，不把文件规划标成已实现；保持历史raw门禁证据与归因记录，不回写历史FAIL。
