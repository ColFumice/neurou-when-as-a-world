# B2.5c-2a PG / clock 冻结契约

日期：2026-10-11。状态：纯文档，未建表、未迁移、未改server。VERDICT-429/436/437/438的实施边界如下。

## 表名与职责

| 冻结表名 | 必须保持的约束 / 字段类别 |
|---|---|
| authority_clock_state | instance唯一、generation、durable lastSignedEpochMs、Trusted/Untrusted latch；无fixture clock |
| authority_worlds | world主键、操作员批准公开root及map/Genesis/manifest/policy SHA、currentEpoch、admissionRevision、sealedThrough |
| authority_author_sequences | account主键、nextSequence安全整数；账号跨world序号全局 |
| authority_sequence_segments | segmentUUID唯一、actor device/gen/world/epoch、含首尾1024号、1小时TTL、原receipt；已发段永久不重用 |
| authority_requests | UNIQUE(instance,account,nonce)，operation/world/device/gen/requestSHA、原canonical结果和永久nonce tombstone；完整普通结果≥7日 |
| authority_append_permits | permitUUID、identity/segment/actor/epoch/class、AppendedAt/expiry/clockgen、已消费摘要；30秒一次许可 |
| authority_commit_admissions | PRIMARY KEY(account,sequence)，UNIQUE(world,admissionRevision)；public header/exact envelopeSHA/AppendedAt/admittedAt/原receipt；不存envelope |
| authority_commit_rejections | 已验identity/摘要/nonce/原因/原receipt；previouslyAdmitted只针对该identity+摘要对 |
| authority_observer_facts | world/account/不可回写admissionRevision、codeRevision、admittedAt/rootSHA、原receipt |
| authority_agreement_credentials | world/account/device/gen/ECDH指纹唯一、公共credential、challengeSHA/注册时刻/原binding receipt；无私钥 |
| authority_membership_epochs | UNIQUE(world,epoch)、原proposal/root签名/服务receipt/公共credential集合、激活时刻；CAS恰加1 |
| authority_access_codes | world/codeRevision/HMAC verifier、持久账号/world失败计数；无明文code；pepper另留服务秘密配置 |
| authority_challenges | UUID主键、kind Credential/Observer、public challenge/hash、绑定session family/actor/gen/world、expiry/消费/expectedTagSHA（仅Credential）；无解封secret/ephemeral私钥 |
| authority_settlement_seals | UNIQUE(world,sealRevision)及UNIQUE(world,cutoff)，count/prefix/policy/previous/closureSHA、原receipt |
| relay_streams | world主键、durable generation/nextPosition/retentionFloor |
| relay_commit_queue | UNIQUE(world,generation,position)及已accepted identity唯一、精确envelope bytea≤65536、公有proof、admittedAt/retainedUntil、tombstone |
| relay_delivery_recipients | commit/epoch snapshot的account/device/gen集合，不把之后加入者算旧消息ACK |
| relay_acknowledgements | UNIQUE(commit,recipient)、位置/identity/digest/确认摘要/原receipt；撤销不伪ACK |

不纳入authority_key_delivery_facts或delivery-confirmation路由；publisher本地确认即可。表结构的SQL内部列可以按冻结字段语义选择snake_case，但外部wire/身份唯一键/receipt字节/计数器不能更改；实现不得借generic JSONB塞入未批准payload。

world/member/设备轻量公共facts、root pin/摘要和receipt可存；完整Genesis/manifest/state/checkpoint/个人七项/媒体/journal、账号/群key、key package或私key不存。PG角色/查询API分别授authority事实和Relay队列能力，不能用同一泛型savePayload合并职责。

## 类型、迁移与原字节

cursor为0..18446744073709551615，PG numeric(20,0)加check，Node/wire严格十进制字符串；generation/revision/time/sequence为安全整数。边界到达拒绝，任何counter不环绕。identity唯一键**不加world/device**。account allocator每次原子预留1024，未用号洞永久保留。

新server/migrations/002.sql及server/src/SharedMigrationRunner.ts；001和旧runner保持。新runner对已存在001验证版本/checksum并执行002，迁移advisory lock；旧库不支持状态显式拒绝，不用IF NOT EXISTS吞结构分歧。运维迁移锁与业务锁分开。receipt存完整canonical bytea，JSONB只是查询镜像；幂等原回复不重新ES256签名。

## 事务顺序与clock

先解析/限额/crypto预检，事务内实时核对session/epoch/版本；锁序为accounts→devices→auth_families→auth_tokens→authority_clock_state→authority_worlds→sequence/permit→admission/epoch/seal或relay_stream/recipient。同类多行稳定排序；无反向取auth锁。网络等待、long-poll、用户交接及crypto耗时准备不持业务锁；事务最终签发前再次核实快照。

事实、canonical receipt、幂等结果原子提交；COMMIT成功才输出receipt。未知commit结果先以原nonce查询，不以新nonce重复新签事实。历史accepted同identity/header/digest优先取原receipt；异摘要Conflict。常规业务拒绝同事务记结果；未认证/CSRF/格式/限流/HostFailure不授终局。

RealAuthorityClock只取真实Date.now/performance.now，信任配置与b操作员clock授权一致但共享clock单独status握手。初始/重启使用PG服务generation并读取durable floor；在clock行锁内重新采样，wall<floor、任何回退或wall/mono偏差>2000ms立即latch失信。不用max(wall,floor+1)或client/DB time补回；同毫秒合法。Untrusted可签无可信时间status/读取旧receipt，不新发时间事实。恢复要求操作员重新校时/信任及新generation证据，不靠自动refresh。

新permit AppendedAt=S、expires=S+30000；epoch激活/准入/S在最终事务内固定。world行锁串行admission/epoch/seal，sealedThrough包含边界；seal计算整个admitted时间前缀的count和SHA，cutoff≤S−3960000且≥前seal，previous/policy绑定。封边后拒新事实回填≤cutoff；旧同摘要receipt复取不算追加。逻辑S不声明精确物理fsync时间。

## Relay事务与验收边界

submit exact摘要、公开来源及作者签名验证后，cursor分配/队列/proof/receipt/幂等原回复同事务。Relay无群key，不能校验正文AEAD/MapEditPermission。pull使用已提交快照/短事务，pending等待不占锁；查看authority摘要账缺未enqueue承诺时签Gap。ACK仅对真实session recipient与精确位置/identity/digest核对后耐久提交。

retention从authority admittedAt算86400000ms；全部ACK不得提前删除。expiry保持队列轻量tombstone/floor/identity记忆；restart保持generation/cursor/ACK。确证重建/丢段增generation→Gap，不能重置成空完整世界。超B/Gap冻结checkpoint推进。

fixture clock仅隔离builder，生产env/route禁时间注入。未来真实loopback证据与加速fixture证据分别标明：非空历史seal若未等真实H，只能在隔离注入测试证明算法，不能报告生产已经过H。当前文档并未执行上述测试。
