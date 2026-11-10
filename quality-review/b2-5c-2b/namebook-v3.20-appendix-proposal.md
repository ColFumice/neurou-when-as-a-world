# 名库 v3.20 附录提案 · B2.5c-2b 实际实现

日期：2026-10-11（Asia/Shanghai）。交 Trae 按授权纯追加落盘；本文件不修改 docs/NAMEBOOK.md、docs/spec/stage-1.md 或历史附录。依据用户 c-2b 实施包、v3.19、VERDICT-441～447。保持 v3.19 的 A/B/C/D 含义：A 已冻结；B 候选、未冻结；C 明确排除；D 延期。只有 A 进入本轮正式冻结表；已冻结但尚未实现的后续能力必须保留其阶段标记。

本轮只实施 authority 与独立认证/session/signing；18 操作数据契约不表示 18 个真实路由全部开放。实际服务器开放 15 条 authority 路由，Relay 的 3 条只存在类型与严格 codec。机械完整新增声明、字段、方法、局部绑定及源码 SHA 见 `evidence/new-names.json`；实际增量与原字节前缀保护见 `evidence/changed-files.json`、`evidence/code.diff`、`evidence/protected-final-audit.json`。

## A 类 · 已冻结的实现名与归属

| 名称 | 正式文件 | 本轮状态与职责 |
|---|---|---|
| SharedServiceProtocolContracts | src/director/SharedServiceProtocolContracts.ts | 已实现；纯数据、type-only port/wire，零平台能力 |
| SharedServiceProtocolCodec | src/director/SharedServiceProtocolCodec.ts | 本轮正式冻结并实现；18 操作严格 canonical request/reply 与固定用途签名输入 schema |
| RealSharedServiceSessionAdapter | src/presentation/RealSharedServiceSessionAdapter.ts | 已实现；独立 b 认证/session/CSRF、内存注册签名凭据、严格 shared transport |
| RealWorldAuthorityAdapter | src/presentation/RealWorldAuthorityAdapter.ts | 已实现；15 authority 操作与 b 兼容 readAccountFacts，mode=ExternalService |
| SharedRelayPrototypeBuilder | assets/scripts/SharedRelayPrototypeBuilder.ts | 已实现 authority 组合根；不接产品 Builder，不声称完整 SharedRelayPrototype 链 |
| SharedSessionVerifier | server/src/SharedSessionVerifier.ts | 已实现；同 PG 实时 access/session/CSRF/account/device 核验与前置锁 |
| RealAuthorityClock | server/src/RealAuthorityClock.ts | 已实现；真实 wall/monotonic、generation/floor 与持久失信 latch |
| SharedMigrationRunner | server/src/SharedMigrationRunner.ts | 已实现；原 001 SHA、PG17、advisory lock、002 checksum ledger |
| SharedServerConfig | server/src/SharedServerConfig.ts | 已实现；exact IPv4 HTTP loopback 与操作员批准公开 pins |
| WorldAuthorityService / WorldAuthorityStorage | server/src/WorldAuthorityService.ts / WorldAuthorityStorage.ts | 已实现；轻量事实、注册、code/ECDH、epoch/segment/permit/admission/seal 与原结果事务 |
| AuthorityRoute | server/src/AuthorityRoute.ts | 已实现模块；15 POST 路由、精确 body limits、shared error wire |
| buildSharedServer | server/src/buildSharedServer.ts | 已实现生产真实 clock 装配，复用旧 b buildApp 与 PG/signing material |
| SharedReceiptSigner | server/src/SharedReceiptSigner.ts | 本轮正式冻结并实现；独立 shared 域签发器，不提取旧 signer 私有字段 |
| SharedCryptoProof | server/src/SharedCryptoProof.ts | 本轮正式冻结并实现辅助模块；仅服务 ECDH credential challenge，不是群 key producer |
| SharedBuild | server/SharedBuild.mjs | 本轮正式冻结并实现独立构建工具；只读编译同一 director 内核，不改旧 server 构建配置 |

新增入口为 `server/src/shared-main.ts`、`server/src/shared-cli.ts`；独立配置为 `server/tsconfig.shared.json`。新迁移实际路径为 `server/sql/002_shared_authority.sql`，遵循用户最新实施包，旧 `server/migrations/001.sql` 与 runner 不变。18 张共享表按 v3.19 已冻清单创建；其中 4 张 relay 表本轮为空、没有路由/生产者。跨 world 来源 IP 失败预算存 `authority_clock_state.ip_failure_counters`（轻量 hash/counter），不增加第 19 表。

## A 类 · 增量纯类型

下列 31 项沿 v3.19 已冻结名实现为 type-only：

| 分组 | 名称 |
|---|---|
| Wire / authority wrapper | SharedHttpRequest、SharedHttpReply、SharedServiceFault、SharedServiceErrorCode、SharedTransportReceipt、SharedOperationAuthorization、AuthorityProtocolResult |
| 注册 / facts / code | WorldRegistrationProposal、WorldRegistrationRequest、AccessCodeChangeProposal、AccessCodeChangeRequest、WorldServiceFacts、WorldAgreementCredentialFact、WorldObserverChallenge |
| ECDH public possession | WorldMemberCredentialChallengeContext、WorldMemberCredentialChallenge、WorldMemberCredentialProof |
| Relay 数据契约 | RelaySubmitFact、RelayAckRequest、RelayAckFact、RelaySubmitReceipt、RelayAckReceipt |
| 协议 / 窄能力 | SharedProtocolOperation、RealWorldAuthorityProtocolPort、RealCommitRelayProtocolPort、SharedServiceSessionPort、RegisteredAuthorSigningPort、WorldDeveloperSigningPort、WorldKeyAgreementPort、SharedCommitSealingPort、SharedRelayDurableCachePort |

下列 6 项本轮正式冻结，合计 37 个顶层公开类型：

| 新名称 | 定义 |
|---|---|
| SharedProtocolPayloadMap | 18 个精确 route 尾部到 request payload 的 type-only 映射 |
| SharedProtocolValueMap | 18 个 operation 到严格成功 value 的 type-only 映射 |
| SharedProtocolReply | 按 operation 索引的 SharedHttpReply 泛型 |
| SharedProtocolSignatureKind | AdmissionClaim / Envelope / CredentialProof / KeyAcceptance / SharedOperation / RelayAck 六个固定用途联合 |
| SharedProtocolCodecPort | encode / parseRequest / validatePayload / parseReply / validateSignatureInput 的纯注入能力 |
| SharedServiceStatusPayload | clockGeneration/status/sample/floor 与 policy/hash 的严格状态结构 |

全部从 IntentPort 仅 type-only suffix 追加导出，旧前缀与运行时输出保全。可选 requestNonce 只服务内存端口便利；wire 的 nonce/authorization/null 等字段始终 required。RealCommitRelayProtocolPort 等后续窄能力本轮仅类型，不产生 Relay、群 key、耐久缓存或产品调用。

## A 类 · 服务器辅助类型、函数与具体边界

| 新名称 | 归属 / 含义 |
|---|---|
| SharedOperatorWorldPin | SharedServerConfig；操作员批准 world/service/map/account/root/Genesis/manifest 公开元组 |
| SharedSession | SharedSessionVerifier；事务内实时核验会话事实，不对外暴露 cookie/CSRF/private key |
| SharedServiceFailure | SharedSessionVerifier；冻结 SharedServiceFault 的服务内部 HTTP/detail 错误映射 |
| AuthorityClockSample | RealAuthorityClock；trusted/sample/floor/generation，失信时 sample=null |
| IsolatedClockSource | RealAuthorityClock；显式隔离测试 wall/monotonic 注入能力，无生产 env/HTTP 入口 |
| StoredWorld | WorldAuthorityStorage；PG 轻量 world 行读取类型，非 SharedWorldState |
| sharedEnvironmentConfig / validateSharedConfig | SharedServerConfig；加载和核验独立 shared 配置 |
| sharedCanonical / sharedUnsigned / verifySharedSignature | SharedReceiptSigner；只读使用原严格内核及 ES256 域验证 |
| makeCredentialChallenge | SharedCryptoProof；真实一次 ECDH/HKDF/GCM/HMAC challenge 与 expectedTagSHA |
| authorityRoutes | AuthorityRoute；固定 15 条 authority 路由注册函数 |
| buildSharedRelayPrototype | SharedRelayPrototypeBuilder；独立生产 authority/session/signing 装配 |
| buildSharedRelayPrototypeForLoopbackHttpTest | 同一 Builder；隔离 cookie transport 的真实 HTTP 测试入口，仍使用生产适配器/验证器 |
| buildIsolatedSharedServer | buildSharedServer 模块；显式隔离 clock/seal 测试，不能宣称生产跨 H 等待 |

模块内部临时名称（如 Data / Rule / RequestData / MemoryDeviceCredential / ServiceClientFault / SharedRequestConflict）、方法、字段及局部 bindings 由机械清单完整记录，只属于对应模块，不创建同名全局业务概念。既有签名域、policy、18 路由值、body/response/timeout 限额沿 v3.19/P3；本轮未新增全局 constants 导出或替换原域。注册 signing / root signing / ECDH / service signing 的已知 key 用途分离；浏览器仍只声称 RegisteredCredential。

## B 类 · 候选，未冻结

自动 P2P 群 key helper、长期 publisher、自动秘密恢复与未批准运维扩展继续为候选。没有正式新增实现名；不得把本轮 ECDH credential challenge 或内存 root 测试当作自动群 key 交付。替代旧 RealServiceBuilder 的扩展方案不采纳。

## C 类 · 明确排除

本轮不纳入完整 FileCarryEnvelope / FileCarryPersonalLayer / EncryptedPersonalLayer / WrappedAccountDataKey、OfflineGrant / PhysicalDevice / DeviceUptimeSample / bootId、旧三元身份迁移、非 Primary 生产迁移、WorldRegistry 本机位置 API、产品 ObserverSync / AccessCode 首次加入 UI / EditPresence / 编辑器全功能。没有真实 readMigrationPayload；authority 不保存正文、个人层、群 key 包、群 key 或 root 私 key。

## D 类 · 已冻结能力的延期实现与待资源

RealCommitRelayAdapter / RelayService / RelayStorage / RelayRoute 留 c-2c；WorldRelayKeyDelivery / SharedCryptoAdapter / 群 key package/acceptance 生产实现留 c-2d；SharedRelayPrototype / SharedRelayDurableCache 及完整独立双客户端生产链留 c-2e；SharedTlsEdge 与真实 LAN HTTPS 留 c-2f。这些名字在 v3.19 已冻，不标“本轮实现”。

长期 root/账号密钥保护与恢复、完整 FileCarry/异步加密迁移留 P4；原生 host/TPM/attestation/PhysicalDevice/OfflineGrant 留 P5。账号 closure 本轮恒 null；产品主链接线留 c-3 另议。正式内容 world 的操作员公开 pins/Genesis/manifest、LAN origin/证书/两台设备仍需资源参与；本轮只验受明确批准的临时本机开发世界。

Trae 只追加本轮 A 类实际实现与命名，B/C/D 保留状态。历史 raw FAIL、SHA 归因、原名库字节不回写；v3.20 落盘不在 GPT 本轮实现范围。
