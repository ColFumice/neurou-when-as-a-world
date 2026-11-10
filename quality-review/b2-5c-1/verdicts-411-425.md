# B2.5c-1 正式裁定书 · VERDICT-411～425

日期：2026-10-11（Asia/Shanghai）。依据：本轮 IMPLEMENTER 授权、VERDICT-391～410、P3 的 contracts-draft.md / membership-and-security.md。效力：本轮冻结并实现独立纯逻辑契约、验真、重放；后续真实服务实施需下一阶段授权。

## VERDICT-411 · 范围与文件边界

批准本轮增量实现，文件固定为 src/director 下的 SharedCommitContracts.ts、SharedCanonicalBytes.ts、SharedCommitCodec.ts、SharedCommitValidator.ts、SharedWorldReducer.ts，以及 quality-review/b2-5c-1 下的隔离测试和交付证据。旧源文件仅 IntentPort.ts 允许保留原字节前缀、追加 type-only 导出。服务器、旧客户端主链、编辑器、A/B/C/T6/T7、B2.1～B2.5b 核心和 archive/service/sync 均不接入或改造。

P3 中原计划 c-1 绑定的 HTTP 路径、CSRF、错误 wire、限流数值和 future 网络端口，依据本轮明确“无网络、无服务器路由”的实施范围，留 c-2 开工前冻结。纯逻辑验证使用显式安装的测试信任上下文；没有把未建设的 world/root/manifest 产品入口当作现有能力。

## VERDICT-412 · 数据契约与旧服务契约分离

SharedCommitContracts 为唯一新增纯数据契约文件，逐项落实 P3 的 54 种 schema；旧 RealServiceContracts.ts 和旧同步 AuthService / CommitRelay 签名保持原状。SharedSchemaMap / SharedSchemaKind 是 codec 类型映射，SharedAuthorityPayload 是八种 purpose 对应载荷的联合，SharedSchemaErrorCode 是本地解析错误类别。它们不授予网络、存储或验真能力。

新身份仍为 authorAccountId + authorSequence；service/world/device 是验证上下文，不拼入身份。schemaVersion=1、profile=ExternalSharedOnlineV1、真实模式 ExternalService 逐字沿用。拒绝旧三元输入及多余字段；不做隐式迁移。

## VERDICT-413 · IntentPort 仅 type-only 追加

IntentPort 追加从 ./SharedCommitContracts 导出的 58 个类型，不追加运行时对象、创建 adapter、监听网络或接入 reducer。原 47617 字节前缀保全，尾部新增 1425 字节。所有 Codec / Validator / Reducer 运行时类均从其独立模块使用，不经 IntentPort 接到产品主链。

## VERDICT-414 · Codec 实现名

正式冻结 SharedCommitCodec。一个实例通过 validate(kind, unknown)、encode(kind, unknown)、decode(kind, Uint8Array) 统一处理精确 schema，包括 WorldCommit、WorldCheckpointWire、WorldChangeLogWire 和成员数据。不新增同职责的 WorldCommitCodec / WorldCheckpointCodec / SharedSchemaCodec 别名。codec 只验证结构、值域、内在关系并生成冻结副本；不证明签名、批准内容、历史权限或检查点来源。

## VERDICT-415 · Canonical bytes

正式冻结 SharedCanonicalBytes 与 SharedSchemaError。采用独立手写 UTF-8 与严格 JSON reader，按 RFC8785/JCS 的安全整数子集生成唯一字节；键用 UTF-16 排序，不用 localeCompare。decode 必须重新编码后逐字相同。拒绝重复键及转义后重名、BOM、非法 UTF-8/Unicode、负零、非安全或小数数字、非规范数字/转义/空白、额外输入、accessor、symbol、非法 prototype、稀疏数组和循环。

CANONICAL_DEPTH_LIMIT=128 是实现资源守卫；超限返回 LimitExceeded，不扩大 P3 wire 能力。base64url 无 padding，检查长度及尾部规范位；固定长度和容量在分配前预检。不会使用 TextEncoder、DOM、Node Buffer 或平台 JSON 宽松解析代替此边界。

## VERDICT-416 · 验真模块与密码学端口

正式冻结 SharedCommitValidator、SharedCryptoPort、SharedValidationContext 与 SharedValidationResult。沿用 B2.5b 的 ES256/P1363、RFC7638 根指纹与信任 pin 语义；为满足零 DOM/平台的隔离要求，新 validator 依赖注入 sha256 / verifyEs256 / hkdfSha256 / decryptAes256Gcm，不导入旧浏览器验签器。生产模块不产生 key/nonce，不写秘密，不调用网络。

上下文必须由可信调用方安装：服务 pin、开发者 pin、Genesis 摘要、world/map/manifest、受信 clock generation、正式内容批准函数、对应 epoch key 查询能力。不得从输入文件取出这些字段后自行设为信任根。Injected crypto 和 manifest producer 的实际部署、生命周期及私钥保护留后续；测试使用内存真实 Node 密码学证据。

## VERDICT-417 · 域、签名与 AAD 绑定

以下是正式固定字节域，本轮以 validator 中的字符串字面量及 SharedCanonicalBytes.domain 编码，不新建可替换的全局常量导出。末尾 \0 是实际 NUL 字节：

| 域 | 本轮验证覆盖 |
|---|---|
| Neurou/shared-authority/v1\0 | receipt 除 signatureBase64Url 的全部字段，purpose/nonce/实例/keyId/clock 共同签入 |
| Neurou/commit-admission-claim/v1\0 | 完整 claim；注册作者独立签名 |
| Neurou/world-commit/v1\0 | envelope 除作者签名的全部字段 |
| Neurou/world-membership/v1\0 | epoch proposal 除 developerSignatureBase64Url、activatedAtServerEpochMs；开发者根签名 |
| Neurou/relay-dek/v1\0 | HKDF info 绑定完整 header，salt=SHA256(JCS(identity)) |
| Neurou/relay-wrap/v1\0 | DEK wrapping AAD 绑定完整 header |
| Neurou/relay-body/v1\0 | body AAD 绑定 header 与 wrappedCommitDataKey |

ES256 签名为 64 字节 P1363；nonce 12 字节、AES-256-GCM tag 16 字节。重算每个已签 epoch 成员 ECDH 指纹，拒绝复用该成员注册签名 key、开发者签名根或服务签名根。无包解密、包分发、acceptance HMAC 的生产验收声明。

## VERDICT-418 · 来源失败、坏正文与主机故障

validateCommit 的顺序为精确容器→受信 receipt/claim、注册作者/成员/段/许可/历史时窗→精确 envelope 摘要→可用且 commitment 匹配的 epoch key→envelope 签名、wrap/body AEAD→明文 schema、内外重复字段和 manifest。

来源可信且完整字节摘要相同后，坏 canonical/body/签名/tag 才形成 invalid=true 的本地能力；reducer 可纳入 InvalidChange coverage。缺 key、缺字节、摘要不符、未知证明或错误 pin 为 Gap，禁止形成终局拒绝或推进检查点。backend 异常、错误输出形状和内容 producer 故障为 HostFailure，不能伪装 InvalidChange。历史提交按签名 admittedAt 验许可时窗，不以当前墙钟使已准入事实失效。

## VERDICT-419 · Reducer 与输入输出

正式冻结 SharedWorldReducer、SharedReplayRequest、SharedReplayResult、SharedReplayDiagnostic、SharedProvisionalCoverageEntry。replay 从受信 Genesis 或同实例可信 parent 开始，对完整 admitted 集进行验证、去重及总序排序，再重放。调用方可以传任意拉取顺序，结果不依赖输入数组顺序。

返回 state 是包含未封边尾部的投影；coverage 和 checkpoint.state 是已封边前缀；provisionalCoverage 使用独立本地类型、finalDiagnostic 固定 null，不得序列化成正式 CheckpointCoverageEntry。没有 seal 时不会生成 checkpoint。所有输入在第一个 await 前复制；结果包含冻结数据。selfContribution 固定 Unknown。

## VERDICT-420 · 三类变化、单对象与历史权限

MonotonicReveal 只 OR 加入有效 Residue 显露集合；TraceTouch 只按唯一成功应用 identity 加一；DeveloperMapChange 只包含单目标 MapEditCommit 与 DeveloperRosterChange。名单权限在 AppendedAt→账号 ASCII→序号的总序位置判断，网络到达顺序不授予权限。WorldDeveloper 是固定根，CoDeveloper 可编辑任一目标；仅根改名单。

不同对象独立；删除永久保留 tombstone，map/entity/trigger/touch 稳定 ID 共用 world 内唯一域，已用 ID 不复用。合法后序 Replace/Delete 标记较早有效编辑 MergeConflict，同账号两设备无豁免。无共享编辑锁、CAS、upsert 或多对象原子编辑。独立 closure 在同毫秒先于提交使根/名单冻结，保留现有 CoDeveloper；即使没有后续提交，也更新暂态投影，不回写较早 checkpoint。

## VERDICT-421 · 触痕与个人边界

TraceTouch 要求受信 Genesis/manifest 的 Normal 资格与当前实体匹配；Echo/Anomalous/Recall/Replay 不获得共享触痕入口。精确 decimal uint128 总量与饱和渲染强度分离，溢出不环绕，不创建个人异痕。共享聚合没有访客身份表；原始签名提交和 coverage 含作者身份，不承诺匿名传输。游戏操作真实性仍依赖正确 producer，签名不能防恶意生产端刷量。

diagnostics 是确定性个人边界提案，不执行 NarrativeEvent/S5、不修改七项 Core、不执行 Echo。本人贡献不完整时保持 Unknown；将来的身份去重叙事消费者、P4 个人贡献恢复和正式生产入口均另行验收。

## VERDICT-422 · Coverage、seal 与有限延迟

覆盖保留每项 identity/摘要/AppendedAt/admissionRevision/结果，按总序排序，不使用 maxSequence。seal 必须满足 cutoff≤签名 S−H、H≥G+B+U、retention≥H，policy 摘要和前驱 seal 可信；时间前缀完整 count/digest 与 seal 一致后才创建 checkpoint。

缺 admitted 项、Gap、未处理候选、未知 parent、seal/policy/closure 不符或封边后新插入旧时间身份，均停止推进。已及时 admitted 的旧事实不因晚拉取变 Orphan。TimeTooLate / PermitExpired 等 rejection 独立验真，本轮没有候选撤回或个人 Orphan 事件消费。网络有界 B 仍为有条件部署假设；本轮没有网络 SLA 实证。

## VERDICT-423 · 本地可信检查点与继承

序列化 brand/hash/state 自洽不授予检查点信任。reducer 只继承本实例生成、完整字节相同的 parent；陌生快照返回 CheckpointUnverifiable。已有非 null diagnostic 不退回，新增已封边合法同目标覆盖可让 null→MergeConflict；旧 checkpoint 字节不改。同一 seal 重取返回原 checkpoint，不伪造新 parent 链。

本地 registry 保留已验 source 容器摘要与观察到的段/permit 事实。逐字相同已覆盖重复无需旧 epoch key，改变任一证明仍走完整验真；新增项缺 key 仍为 Gap。跨可信 parent 检查已观察段重叠/permit 复用，不证明未观察的全球分配账正确，不新建全球 allocator。registry 不持久化、不对外导出信任；清正文/恢复 registry/陌生 FileCarry 证明留 P4。

## VERDICT-424 · 验收与命名告警裁定

本轮验收为纯逻辑 codec / validator / reducer 隔离测试与既有三门禁。154/154 PASS：codec 76、真实密码学 validator 47、replay 31。最终隔离编译 target=ES2020、lib=ES2020、types=[]，没有 DOM/Node/引擎声明；既有项目门禁另检查 ES2015 目标兼容。测试中四个进程网络尝试计数均 0，源码和测试输入 SHA 在运行前后稳定。

check-naming：0 ERROR、45 WARN；基线 22、新增 23，新增均为 Trace 痕域语义，不是日志名。依赖门禁 0 ERROR；既有 typecheck 通过。保留全部 WARN，不修改门禁或 whitelist。三门禁不替代实际密码学/重放验收，不将测试成功写成真实 Relay、物理设备或 Cocos 视觉验收。

## VERDICT-425 · 文件保护归因、交接与遗留

原始保护基线为 2026-10-11T04:05:40.542Z、7070 项；本轮发现 docs/NAMEBOOK.md 与 docs/spec/stage-1.md 在基线后变化，先保留 raw FAIL 并提交独立来源确认。用户本次正式回复“确认：Trae 授权同步 v3.17/P3”，归因闭合。保留首次 FAIL / 原比较 / 基线，另附逐 SHA 绑定的来源确认；不改写历史 raw、不把本轮两份外部文档变化描述为零变化。

名库 v3.18 仅交付附录提案，由 Trae 后续正式落盘。本轮实现没有改 docs/名库/参照。下一段 c-2 涉及真实轻量权威、Relay、事务/路由/准入/队列/ACK，需明确实施授权并补齐真实 world/root/manifest/key 交接前置。P4/P5、旧身份迁移、完整编辑器及 ObserverSync 产品接线继续延期；本轮无新增未闭合架构冲突。
