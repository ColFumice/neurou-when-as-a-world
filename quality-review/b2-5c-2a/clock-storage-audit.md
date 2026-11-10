# c-2a 服务 clock 与 PostgreSQL 边界审计

日期：2026-10-11（Asia/Shanghai）。本文件是冻结轮的只读架构审计及推荐方案；本轮没有修改 server/、c-1 模块、认证逻辑或数据库，也没有执行迁移/真实服务验收。正式决定以 VERDICT-426～440 为准。

## 已核实的现状

| 证据 | 当前真实能力 | c-2 不得误称已有 |
|---|---|---|
| server/src/config.ts | exact HTTP 127.0.0.1 origin/host；固定开发端口配置；CLOCK_TRUSTED 显式操作员开关 | LAN HTTP/TLS 配置、生产自动可信时钟 |
| server/src/app.ts | Node Date.now + performance.now；墙钟回退或差值偏离超过 2000ms 后永久降为 Untrusted；每次启动取得 PG clock generation | 跨重启的签名时间下限、authority 已封边非回填闸门 |
| server/src/db.ts、server/migrations/001.sql | PG17、真正事务、schema_versions、注册/刷新行锁、账号/设备/会话/challenge/轻量幂等表 | world、sequence allocator、admission 摘要账、epoch、密文队列、耐久 ACK |
| server/src/crypto.ts | 服务 P-256 ES256/P1363、稳定私钥文件、RFC7638 指纹、Neurou/service/v1 域 | Neurou/shared-authority/v1 域的 authority receipt 签发、开发者长期 root 保管、群 key possession |
| P3 contracts-draft.md §2/3/8/9、membership-and-security.md §2～6 | 世界共享、时间许可、精确覆盖、最短 retention、带外 root/key 包规则已经冻结 | HTTP 路由、数据库表和生产入口已经实现 |

P3 已明确在线 TLS、HTTP 仅本机 loopback 例外。LAN 验收应使用 HTTPS 和 Secure cookie；不能放宽旧 config/Origin/Host/CSRF guard 来开启裸 LAN HTTP。与 b 认证复用同实例、同 PG、同会话不意味着裸 LAN HTTP 获准。c-2 的新 LAN 配置/增量装配仍须保留旧 loopback profile 的拒绝面和回归证据。

## authority 与 Relay 的存储分界

authority 仅保存公共根 pin、批准世界/Genesis/内容摘要、账号全局段、注册公开凭据绑定、准入/撤销/epoch 事实、不可逆 commit 摘要/公开 header、许可/拒绝/seal、幂等结果和轻量 receipt。Relay 独立保存有限期、精确字节的 WorldCommit 密文外壳及公开验证证据、游标和交付集合/ACK。即使同一个 PG，也应分别限制两种存储接口及参数 schema；authority 的事务和路由不接收 envelopeBytes、WorldCommit 正文或任何个人数据。

以下对象不得入库：完整 Genesis/SharedWorldState/WorldCheckpoint、完整 manifest 内容、完整 FileCarry、个人七项/媒体/journal、明文群 key/账号 key/成员 ECDH 私钥、开发者根私钥、WorldRelayKeyPackage 的明文或密文副本。允许存 Genesis/manifest/pin/package/acceptance 的不可逆摘要；receipt 的 payload 仍须属于已批准的轻量 public 类型。不能用泛型 jsonb result 或“服务器看不懂密文”为由突破此边界。

## 推荐表分组与数据库约束

表名是 c-2a 审计推荐，最终冻结表以正式裁定/HTTP 契约为准。未来迁移文件建议 server/migrations/002.sql；本轮不创建 SQL。不得改写 001.sql 历史，不以 IF NOT EXISTS 掩盖不兼容旧结构。

| 推荐表 | 必需数据及唯一性 | 允许的存储 |
|---|---|---|
| authority_clock_state | serviceInstanceId 唯一；clockGeneration；lastSignedEpochMs；可信状态/人工恢复事实摘要 | 安全整数时间、公共状态，不保存测试 clock |
| authority_worlds | worldId 主键；固定根账号/pin/hash；Genesis/map/manifest 摘要；policy/hash；current epoch；admissionRevision；sealedThrough | 轻量注册、public pin、摘要与当前计数器 |
| authority_author_sequences | accountId 主键；nextSequence | PG bigint；JS 数值转换前检查 0..MAX_SAFE_INTEGER |
| authority_sequence_segments | segmentId 主键；账号、设备/世代、world、epoch、first/last、issued/expires、原 receipt | 1024 个连续号，不可重叠、不可退还；账号段分配行锁 |
| authority_requests | accountId + requestNonce 唯一；operation/world/严格请求摘要；结果类别、原始 receipt 字节/错误 wire | 复用 nonce 到另一操作/世界/摘要即 Conflict；业务失败也固定 |
| authority_append_permits | permitId 主键；identity、设备/世代、segment、epoch/class、AppendedAt、expires、consumedByDigest | 许可不可自报时间；一次消费 |
| authority_commit_admissions | 主键(accountId, authorSequence)，另唯一(worldId, admissionRevision)；header 摘要及必要 public header、envelopeSHA、AppendedAt、admittedAt、原 receipt | **身份键不加 world/device**；跨世界账号序号唯一；不保存密文 |
| authority_commit_rejections | 验证后的 identity/digest/nonce、reason、拒绝时刻、原 receipt | 不伪造未验来源 TimeTooLate；保留拒绝记忆 |
| authority_observer_facts / authority_membership_epochs | world/账号准入 revision、有效区间；epoch proposal/服务激活事实/签名；public credential 集合 | epoch/keyEpoch CAS 恰加1；历史事实不回写 |
| authority_access_codes / authority_challenges | world/codeRevision、HMAC verifier；一次短寿命 challenge；消费/限流事实 | 独立高熵 pepper 在服务私有配置，code 不入数据库/日志 |
| authority_settlement_seals | 唯一(worldId, sealRevision)及(worldId, cutoff)；count、prefixSHA、policySHA、previousSealSHA、closureSHA/null、原 receipt | 相同 cutoff 重取原字节，不能换前缀 |
| authority_key_delivery_facts | packageId/摘要、acceptance 摘要、publisher 确认、recipient/epoch | 可选轻量状态；不保存包、群 key 或 raw acceptance 来冒充服务验 possession |
| relay_streams | worldId 主键；generation；nextPosition；retentionFloor | generation 正整数；位置为 uint64 十进制，不是作者号/事件总序 |
| relay_commit_queue | 唯一(worldId,generation,position)及 identity；精确 envelope bytea、必要公开 source receipts、admittedAt、expiresNotBefore | 单 envelope ≤65536B；精确摘要；不重签/重加密 |
| relay_delivery_recipients / relay_acknowledgements | commit 交付集合；account/device/generation；cursor/identity/digest、确认时刻 | 不把后来加入设备算旧消息 ACK；撤销是集合变更，不是假成功 |

Relay uint64 位置用 numeric(20,0) 并约束 0..18446744073709551615；Node 收到/发出仍用严格十进制字符串，不能经 Number 丢精度，也不能用 PG signed bigint 覆盖完整 uint64。generation、revision 和时间遵循安全整数守卫。所有计数器到边界显式拒绝，不能环绕。

receipt 除可查询字段外应保留完整 canonical wire 的 bytea；重试返回完全相同已提交字节，不用 ECDSA 重签改变摘要。JSONB 仅作轻量查询镜像，不能取代已签原字节。迁移需 checksum/version 记录和单一 advisory migration lock；未来增量 runner 执行 001/002，旧 bootstrap 的回归保持。运维迁移与业务事务锁分离。

## 事务、幂等与非回填时钟

1. 保持 b 的认证锁序：account → device → auth family → auth token。c-2 之后依序锁 authority clock → world → account sequence/permit → admission/rejection → seal/epoch 或 Relay stream/recipient。任何路径不得先锁 world 再反向取认证锁。多行按稳定 ID 排序；等待网络、长轮询和用户密码学操作不得占有业务事务锁。
2. 原型可采用单个 authority_clock_state 行作为轻量签发串行闸门。可信 wall sample 必须在锁内再次取得并检查；若 wall < 已耐久 lastSignedEpochMs，立即 TimeUntrusted。**不使用 max(Date.now(), floor+1)、客户端时间、测试值或 DB now() 伪造可信恢复**。同毫秒允许，排序仍用 identity。检测 drift >2000ms 或回退后 latching Untrusted；新签发停止，恢复由明确操作员事实/新 generation 验收。
3. restart 增加已有 PG service_clock_generation，读取 durable floor；重启不会把 floor 清零或让旧时刻重新签发。历史已 accepted 的原 receipt 可以原样重取，不能因当前许可过期/epoch切换而重写历史；这不授新的准入或 seal 能力。
4. 请求可预检和解析，事务内再核对会话/设备/当前 epoch/许可及事实版本；幂等记录在更新前检查。已 accepted 同 identity、header、digest 优先重取；异摘要/异 header 为 IdentityConflict，保留原 accepted。尚未 accepted 的同 nonce 业务失败返回原结果，新 nonce 也不能绕过期限、撤销、封边或身份冲突。
5. 号段分配在账号 counter 行锁下原子增加 1024，数据库提交后才响应。事务失败不能泄露已签 receipt，已提交段不归还号码；缺失回应后的相同 nonce 从 PG 重取原段。允许空洞，不从 checkpoint 最大序号恢复消费。
6. permit AppendedAt 仅为本事务可信服务 S，expires=S+30000；禁止请求携带自定 AppendedAt。epoch 激活和准入/撤销有效时刻在最终写入前取受信 S、事务内固定，提交成功后才成为事实。这里是权威事务采用的逻辑生效时刻，不声称测得操作系统精确 WAL fsync 时间。
7. 同 world 的 admission、成员激活、准入/撤销及 seal 共用 world 行锁。seal 从已提交 admission 摘要账计算完整 AppendedAt≤cutoff 的有序 identity/digest/time 集合和 prefixSHA；cutoff≤S−H、cutoff≥旧seal，policy和前驱哈希绑定。后续新 admission 或权威有效事实不得插入已封闭前缀；旧事实不回填/更新。
8. 隔离 crypto/存储 HostFailure、PG连接错误不能被伪装成已签业务拒绝。原型允许有限数据库重试，必须保持原 nonce/摘要并重读已提交结果；每次真正新签发前重验 clock 和会话。签名+receipt插入与事实写入同一个事务；COMMIT 成功之后才发送响应。

生产入口只使用真实 Node wall/monotonic 观测、PG generation 和显式操作员信任配置。测试允许依赖注入 fixture clock，但只能通过隔离测试 builder/test runner，生产 environmentConfig/main 不接受固定 epoch、客户端 time override、任意 fixture 模式或 HTTP 后门。生产可控 OS clock 是信任边界，不是由服务签名自动得到的物理真实性；未来原生 host/boot/OfflineGrant不在这里。

## Relay 事务与保留/缺载

submit 验证 exact bytes/hash、source claim/receipt/作者签名和公开 schema；Relay 不持群 key，不能声称验证正文 AEAD/内容权限。该验证边界不同于接收端完整 SharedCommitValidator。queue 插入和 cursor 分配原子提交，再发成功；同 identity/digest 重试不再分配位置，异摘要保持 Conflict。authority admission 无需 Relay route/worker 正常才可成功。

pull 从已提交有序 cursor 获取最多256条、canonical响应≤1MiB，等待0..25000ms；不把长轮询25秒当 B=300000ms。同 PG admission 摘要账用于发现已准入但未提供精确密文的缺载；仅看 queue 游标无法证明完整前缀。未封边新 admission 的合理 submit 等待不得被报告成完整历史已取得；已被要求/封边的承诺项缺精确字节必须 MissingAdmittedEnvelope/Gap，不删除 admission，不伪 ACK。具体公开 pull 完整性范围在正式 HTTP wire 中冻结。

ACK 只在接收端完整验真并经独立本地耐久 backend 写入、回读确认后发送；服务检查会话、device/generation、游标/identity/digest和授权交付集合。服务不能把客户端自报 durable 当硬件见证；本轮独立原型只验证批准的共享密文缓存，不写个人七项/旧主key、不借此实现 P4 全量保护存储。

保留期从 authority admittedAt 计算，最早删除时刻为 admittedAt+retentionMs。P3最新规则明确：**全部 ACK 不能提前于该时刻清密文**，覆盖早期362“全部确认即删除”的初步表述。过期删除保留 tombstone/retentionFloor和必要身份摘要/receipt，未 ACK 活跃设备后续取得 Gap；重启保留 generation/cursor/ACK，只有确证队列重建或丢段才加 generation，返回 RelayGenerationChanged。

开发 policy：G=3600000、B=300000、U=60000、H=3960000、retention=86400000ms。H≥G+B+U、retention≥H；B超界/Gap停止checkpoint推进。24h 是这个固定policy下的有限队列保留，不是无限离线保证。authority seal不证明队列交付或所有观察者已完整收到。

## 真实冲突与后续入场项

未发现必须推翻 P3/c-1 的新增架构冲突。以下是 c-2a 可以明确解决的已知缺口：PG增量migration和receipt域签发、authority durable clock floor、HTTPS LAN安全profile、world/root/manifest摘要注册、内存/受保护私key的责任边界、显式带外 key package及真实 possession、严格 wire/限流/幂等、独立两客户端的durable缓存与ACK证据。

c-2真实开发者账号注销生产者未获准，可以 closure=null；不能添加/冒用 b 的注销API来制造测试fact。真实 credential撤销、账号删除和非Primary迁移也不能从通用“world authority”名义自动扩入。若要求裸LAN HTTP、服务器 key package备份、持久个人/完整世界载荷或无可信clock仍新签准入，应提交独立 PROTOCOL；本审计不授权这些改变。
