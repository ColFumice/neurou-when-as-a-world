# B2.5c-1 独立复审记录

2026-10-11（Asia/Shanghai）。本记录为共享契约内核的安全与重放复审，未把 c-1 解释为真实 Relay、成员服务或产品同步验收。评审时只读其他作者负责的 `SharedWorldReducer.ts`、契约/codec 与隔离测试证据；本报告不修改源码、旧 docs、名库或参照文件。

## 结论与证据

最终范围内未发现未处理的必修矛盾。来源可信度、精确字节绑定、InvalidChange / Gap / HostFailure、确定性重放和实例内可信 checkpoint 边界彼此一致。此结论依赖下述显式信任前置，不表示抵御已控制客户端、任意恶意注入 backend 或未见过的全球作者分配冲突。

已读取 `evidence/test-runs/final-verified/results.json` 和相关 raw log/test source：隔离编译 exit 0，154/154 项通过、0 fail/cancelled/skipped/todo；其中 reducer 重放测试 R01～R31 为 31/31。结果记录五个生产文件与测试输入前后 SHA 相等，no-network instrumentation 的四个进程计数均为 0。该 instrumentation 是本次被执行代码的证据，不是 OS 网络 sandbox，也不是任何真实服务测试。

复审特别核对 R28～R31：已覆盖精确重送在旧 epoch key 被移除后沿用本地可信 parent 而不重复应用；新条目缺 key 仍 Gap，改 receipt 的重复包不能借此绕过；稳定 ID 在实体/Trigger/TraceTouch/map 及 tombstone 间不复用；独立 closure 的空尾部投影不回填早于 closure 的 checkpoint；已观察签名分配冲突在可信 checkpoint 推进后仍可识别。较早测试 failure raw 由原证据目录保留，本记录不回写失败历史。

## 已审查的修正

| 发现与最终修正 | 判断依据与影响 |
|---|---|
| closure 过去只在后续 commit 或 seal 覆盖时投影；现已在完整尾部后独立投影 | 有签名 closure、尾部为空时 full state.frozen=true；更早 seal 的 checkpoint.state 保持原值。现有 CoDeveloper 不因根注销而被全部撤权 |
| provisionalCoverage 曾复用正式 coverage 类型；现为本机 provisional 输出 | 未封边的 RevertedEdit / InvalidChange 不伪装成正式诊断，也不进入已结算 checkpoint；正式 wire 的结果/诊断 invariant 保留 |
| covered duplicate 曾在解密后识别；现先核对本地 parent 记录的完整 admitted wire 摘要 | 只接受先前完整验证的精确字节；同 identity 异内容、receipt 替换或陌生 parent 仍拒绝。新的正文仍须当前可取得的合法 key |
| 分配检查曾只覆盖当批；现保留 parent 的 observed allocations | 同 segmentId 异事实、账号段重叠和 permit 跨 identity 在该实例观察到的可信历史与新后缀间可识别；不拿作者 maxSequence 吞掉合法空洞 |
| ECDH 指纹/用途核对补齐 | 重算 RFC7638 指纹；禁止复用该成员、开发者根或服务签名公钥材料；普通成员不能以 null admissionRevision 绕过准入 |

上述修正已由生产作者完成并进入 final-verified 的稳定源记录。评审没有把局部 type brand、文件 hash 或任意成员签名当成 state 已正确重放的证明。

## 安全与确定性边界

Validator 先核对安装 pin、来源 receipt/作者 claim、历史注册 key、成员 epoch、许可/段/准入的重复字段与**当时已签 admitted 时刻**，再验精确 envelope 字节摘要。旧 accepted receipt 不因今天的本地墙钟或设备撤销被重新拒绝。完整来源与 exact digest 成立之后，坏 canonical bytes、envelope 签名、AEAD 或正文 schema 可形成技术 InvalidChange；缺字节、错摘要、缺必需来源/epoch key 是 Gap；注入 crypto/key lookup/manifest producer 的抛错是 HostFailure。backend 故障不能成为“作者提交确实坏了”的事实。

Genesis 由 constructor 的明确安装能力给出的 expected digest、世界/map、内容 manifest 与根 pin 承认，未从陌生文件自签 bootstrap。entity definition 的合法来源与 Normal Trace 资格由显式 `isEntityDefinitionApproved` producer 证明。公钥指纹、非负时间、成员 revision 是数据，不是独立授权；作者 key binding、成员 epoch 与 roster Observer 准入证明必须完整。未知历史资格不变成自报有效权限。

Reducer 按 AppendedAt→作者账号→作者序号总序，从已验证 Genesis 或该实例实际生成的 trusted parent 继承状态/coverage；陌生 checkpoint 即使内部摘要自洽也保持 CheckpointUnverifiable。seal 的 policy/hash、H 时刻边界、完整 admitted 前缀 count/digest、closure 摘要与 parent 链全部对齐后才产生新 checkpoint。已覆盖单步结果不倒退，已成立诊断不删除；合法后续覆盖可使原 null 诊断变为 MergeConflict，旧 checkpoint 字节不回写。未封边尾部和名单权限可重放改变，不把暂态输家提前写成不可逆个人事实。

TraceTouch 聚合采用精确 uint128 计数、渲染强度饱和、按唯一身份去重；溢出/删除目标不增加贡献。公开聚合没有访客表，但原始签名/coverage 仍可归因，不宣称端到端匿名。`selfContribution` 明确 Unknown，未根据共享总量猜测本人贡献，不产生 EchoTrace；diagnostic 只是结构化 `PersonalDiagnosticBoundary`，没有追加 NarrativeEvent、个人账本或触发 T6/T7/表现。

## 保持未实现的事项

注入 `SharedCryptoPort` 与 manifest/root 配置是受信 composition 能力，生产 backend 尚未在本轮接入。隔离测试采用真实 Node native ES256/P1363、AES-GCM、SHA256 与 RFC5869 HKDF，不能替代未来平台 crypto backend 的互操作、秘密保护和生产能力验收。签名证明凭据持有，不证明真实触碰或诚实游戏 producer；恶意合法成员可以签无真实交互的候选，c-1 不承诺反作弊或物理操作认证。

checkpoint registry、完整 admitted wire 摘要和 observed allocations 仅存在于同一 reducer/validator 实例内。reload/new instance/序列化恢复不自动恢复 capability；外部 checkpoint 的可重放证明、持久恢复及长期 key 生命周期留 P4。局部观察无法证明未见过的跨世界/跨设备全球分配从无冲突，全球唯一性仍依赖真实轻量 authority 的账号计数器事务与不复用规则；本轮没有该服务的实现或证据。

WorldRelayKeyPackage 的类型/codec roundtrip 不等于 ECDH key 分发机制。本轮没有 publisher、用户交付入口、群 key 云存、AccessCode 产品 UI、真实成员准入 API、ObserverSync、网络 Relay、完整 FileCarry、加密存储、OfflineGrant 或 PhysicalDevice。后续 c-2/P4/P5 必须在其授权与前置内取得独立证据，不能沿用本 154 项测试声称已接入真实共享服务。
