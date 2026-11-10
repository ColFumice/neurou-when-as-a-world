# 《雨若》P3 共享契约补冻 · VERDICT-391～410

2026-10-11（Asia/Shanghai）。依据：用户本轮《IMPLEMENTER交接·B2.5c前P3共享契约补冻》及已闭合的376～390。**P3以纯文档完成补冻；不实现Relay、不新增契约源码/ContractAdapter、不启动c运行机制。** 精确规范由本裁定、contracts-draft.md、membership-and-security.md共同组成；后续实现必须满足全部来源/权限/拒绝规则，不能只抄interface。名库v3.17仅交Trae的附录提案，正式docs、参照和名库不由本轮修改。

本轮历史核对纳入023/024/027/028/031/035的后续修订，纠正旧B2.5a准备材料只写单开发者等不完整候选。旧材料/raw证据保留，不回写历史。新在线profile的二元身份来自用户本轮明确指令，旧三元格式不静默迁移。下列“冻结”均指规范，不是已实施能力；c/d/e实施授权及已明确延期的P4/P5前置仍分别适用。

## VERDICT-391 · 范围与交付方式【冻结】

裁定：本轮只新增quality-review/b2-shared-contract-freeze下的规范与审查证据。零生产源码变更，零ContractAdapter扩展，零服务器新路由；不执行真实Relay、完整FileCarry、原生OfflineGrace、PhysicalDevice或ObserverSync。以精确数据结构、验证次序、拒绝/降级语义完成P3。影响：c实施前置；不是c开工授权。

## VERDICT-392 · 版本、规范字节与来源【冻结】

裁定：新共享schemaVersion=1、profile逐字ExternalSharedOnlineV1，mode沿用ExternalService。精确字段白名单、显式null、canonical UTF-8/JCS整数子集、安全整数、UUID稳定ID与分域签名/摘要。Genesis及内容manifest来自正式受审内容或带外确认的开发者根，不以自签FileCarry、服务器返回自带key、账号登录或未验证checkpoint授信。v1只覆盖明确的有限地图/Trigger子集，完整编辑器能力不由unknown扩展。

## VERDICT-393 · WorldCommitIdentity与历史027【冻结】

裁定：按用户本轮明确口径，新ExternalService唯一身份为authorAccountId+authorSequence；同服务实例的同账号跨世界共用序号空间。设备/世代/world是验证绑定，不参与新身份键。027三元身份仍属于历史格式，输入新profile拒LegacyIdentityUnsupported；不去设备字段、拼接、重键或去重迁移。旧格式迁移另有独立协议，不改B2.4存量数据。

## VERDICT-394 · 多设备序号段与离线边界【冻结】

裁定：权威事务按账号原子分配不重叠1024号段，绑定设备/世代/world/member epoch，寿命1h；号码只消费不归还，崩溃空洞/备份恢复弃段、耗尽拒绝。客户端持有效lease耐久消费，未知消费状态不复用；无锁拒绝。c可先只在线内存持段、重建弃段，不能称耐久离线能力。号段不是OfflineGrant；原生离线来源证明待P5，Web拒离线有效共享提交，不用应用运行时长或Date.now冒充。

## VERDICT-395 · AppendedAt、总序与时间真实性【冻结】

裁定：值沿用{epochMs:number}，共享来源采用一次服务签名WorldAppendPermit；30s内使用其可信服务epoch作为逻辑追加时刻，正文/header/claim/receipt相等，作者签名和AEAD绑定。不是Relay收件时间或本地墙钟，不回改Ledger/NarrativeEvent。总序为epochMs→账号ASCII→authorSequence；同毫秒不同身份正常排序，同身份不同摘要/上下文为IdentityConflict，不last-writer-wins。原生离线time anchor/boot/uptime证明不在本profile冒领。

## VERDICT-396 · 三类精确变化与历史CommitClass【冻结】

裁定：MonotonicReveal→Monotonic，仅有效Residue entityId的revealed=true，OR；TraceTouch→AddOnly，仅批准Normal Trace的traceTouchId/normalTraceEntityId/touchUnits=1；DeveloperMapChange→RestrictedWrite，含MapEditCommit及DeveloperRosterChange两个subtype。地图每条commit一个EditTarget/operation；entity/Trigger创建、完整替换、删除字段白名单见schema。不写个人显露、Recall/Replay、Ledger、七项Core、20维向量、谱面/媒体或CommunityMap。不把035已改的RestrictedWrite写回SingleWriter。

## VERDICT-397 · 稳定对象与按对象合并【冻结】

裁定：world内map/entity/Trigger/traceTouch稳定UUID永不复用；编辑位置用整数milli WorldMeter，只作新wire表达，不改核心坐标。同对象后序有效修改胜，后序删除胜，删除后不复活；不同对象独立，一次多对象保存拆多条提交，无atomic跨对象牵连、共享编辑锁或开发者revision CAS。正文定义由批准manifest校验，Create不能自报Normal来源。终局冲突/撤权沿用MergeConflict/RevertedEdit个人诊断，未封边暂态结果不先写不可逆个人事实。

## VERDICT-398 · DeveloperRoster与注销【冻结】

裁定：沿用035：唯一WorldDeveloper不可转让；CoDeveloper必须已是WorldObserver；名单内任一开发者可编辑所有EditTarget，只有WorldDeveloper增删名单/修改AccessCode。按总序位置判权限，服务未封边镜像不作为提前终局拒绝依据，最终接收端严格验证。开发者注销采用签名轻量WorldDeveloperClosureFact，不由文件自报，生效时刻不得回填已封边前缀，同毫秒先于commit；名单冻结而既有CoDeveloper继续编辑。此fact不是第四类共享变化，b没有新增注销API；根不可用不擅给CoDeveloper密钥管理员权。

## VERDICT-399 · WorldRelayKey与分域加密【冻结】

裁定：WorldRelayKey为成员域随机256-bit群key，与账号个人层key、六位AccessCode、作者身份key分离；每次key epoch用全新随机值，不从旧key派生。每commit随机256-bit DEK，HKDF-SHA256群域wrap、AES256-GCM独立96-bit nonce/128-bit tag；header+包裹字段进AAD、作者ES256签完整密文。完整identity、设备/epoch/时间/类别及world绑定；重试复用已耐久的完全相同envelope，包括ECDSA签名。异摘要隔离，不重加密同identity。不实现P4个人加密存储或文件codec。

## VERDICT-400 · AccessCode仅首次准入【冻结】

裁定：沿用023，恰好6位数字、保留前导零、由WorldDeveloper选择；正确码自动使首次账号成为WorldObserver，不能替换为人工开发者审批。改码不踢旧成员，不授开发者权，也不派生key/认证根pin。在线认证+精确限流+服务端带pepper verifier，无码日志/URL；具体限流数值为候选配置，不冒称已部署。正确码与密钥送达是分开的事实，密钥Pending不收回Observer资格；本地文件码可被穷举，不能称密码学保护。

## VERDICT-401 · 成员、epoch与目标密钥交接【冻结】

裁定：开发者长期签名根由受信Genesis/带外pin；b内存RegisteredCredential不是长期开发者根或硬件认证。目标接收key用独立ECDH P-256，经注册设备签challenge证明；WorldRelayKeyPackage用临时ECDH、HKDF、AES-GCM及开发者签名，精确绑定world/成员epoch/key epoch/key commitment/账号/设备/世代/目标公钥/packageId。key包由用户/受控点对点搬运，不存Relay/Auth云vault、不进WorldCommit。成员加入/撤销以新随机key的epoch原子激活为边界，关闭旧许可/段；已admitted历史保持，未admitted旧epoch拒绝，不重加密原identity。root缺失时KeyPublisherUnavailable，不能伪称撤销完成；已取得历史key不可追回。长期私key保护/恢复和历史文件证据待P4。

## VERDICT-402 · TraceTouch聚合及身份承诺【冻结】

裁定：唯一成功应用commit加1，uint128 decimal精确总量、画面强度min(65535,total)，去重不加、溢出拒绝，无衰减/贡献者表/排名。仅聚合投影不记录访客身份；原始签名提交、coverage和Relay作者设备元数据可归因，不能宣称端到端匿名。031“精确扣本人后仍有他人贡献”保留；本人贡献缺证明为Unknown，不用饱和值推断、不生成EchoTrace。恢复归P4，不能新增第八项Core，本轮不接产品触痕/Echo入口。

## VERDICT-403 · WorldChangeLog与B2.4 journal关系【冻结】

裁定：WorldChangeLogWire是三类共享事实的签名提交日志；CrossDeviceImportJournal是七项导入事务恢复；WorldMigrationJournal是迁移phase恢复。三者不统一、不互转、不借后两者充共享历史，也不新增统一主key。B2.4 key、锁顺序、phase和CoreTransferPayload归属保持。完整FileCarry可以将来独立携带共享log/checkpoint及账号个人层，但本轮不新增载荷/codec或服务器readMigrationPayload。

## VERDICT-404 · Checkpoint精确覆盖与验证【冻结】

裁定：覆盖=完整时间前缀+精确identity/摘要/AppendedAt/admissionRevision/applyResult/finalDiagnostic，不按作者最大序号吞号段空洞。必须可信本地Genesis/父checkpoint、精确已准入前缀与总序重放；state/coverage/checkpoint摘要分别自洽，只有完整已admitted前缀的count/prefix摘要与签名seal相等，seal不认证state。coverage时间保留可重算。applyResult是历史单步结果，不因最终MergeConflict而跳过旧单步；父coverage只在新合法封边覆盖时允许null→MergeConflict，既有非null诊断不回退，旧checkpoint不回写，同账号多设备不豁免冲突。回读耐久后才清原正文，coverage保留；暂无有界空间无限历史压缩承诺。陌生checkpoint无重放证明为CheckpointUnverifiable，hash/发送者签名不授Complete，外部文件来源认证留P4。

## VERDICT-405 · 迟到、封边与不复活【冻结】

裁定：seal边界≤可信服务S−H、单调、checkpoint边界与seal严格相等；封边后禁止新旧时刻准入。已及时admitted的历史不因今天才拉取变Orphan，缺载是Gap。可信WorldCommitRejection绑定真正TimeTooLate时沿用028个人Common/Anomalous/OrphanCommit、撤回共享候选、每identity一次、拒绝变化永不复活；本地墙钟/自报文件/网络垃圾不产生该事实。online许可通常先PermitExpired，不能冒称离线迟到验收。已准入精确字节匹配且正文无效可InvalidChange覆盖；字节缺失/错摘要/缺群key不终局拒绝、不推进checkpoint。

## VERDICT-406 · SettleHorizon与有限延迟【冻结】

裁定：H≥OfflineGrace(G)+boundedRelayDelay(B)+时间余量(U)，retention≥H。开发政策G=1h/B=5min/U=1min/H=66min/retention=24h，仅在不等式成立时24h可用。B包含补发、排队、pull、退避和耐久，非25s长轮询超时；是明确的网络恢复/活跃客户端健康条件假设，不是任意故障SLA。超B/Gap为BoundViolated，冻结结算与“全量”声明、不偷延OfflineGrant、不改变RealityPause/T7。seal证明准入前缀封闭，不能证明全员收件或state正确。

## VERDICT-407 · Relay边界与降级【冻结】

裁定：沿用024客户端HTTP pull，最多25s长轮询；bounded密文WorldCommit队列、轻量成员/权限/准入摘要与receipt，可认证/限流，不能保存共享state/checkpoint/世界文件/个人层/向量/群key包/可读正文。队列cursor不是事件总序，过retention/代际丢段/缺admitted字节返回Gap，不跳过成功；只有验证后本地耐久可ACK。Relay故障不等于Auth/轻量权威故障；已准入提交可由用户合法文件携带，权威也失效则保留候选、不声称新共享已确认。无fixture回退、不冒ContractAdapter标签。

## VERDICT-408 · ObserverSync和实施分段【冻结边界】

裁定：成员/WorldObserver事实不等于开启产品ObserverSync；本轮不接加入UI、触痕生产、地图编辑器、Echo、EditPresence或S5叙事。建议c-1纯codec/validator/确定性重放与隔离契约证据；c-2真实轻量权威+bounded Relay；c-3两客户端真实网络/密钥/Gap/故障验收。每段另需实施授权；B2.4 ContractAdapter仅保留测试，不在本輪增扩，也不被真实失败自动调用。

## VERDICT-409 · 门禁、保护与Trae归因【冻结验收口径】

裁定：三条既有门禁实测PASS，命名22 WARN无增量；它们不编译Markdown、不证明新codec/Relay可执行。7042项SHA保护raw FAIL，仅docs/NAMEBOOK.md、docs/spec/stage-1.md外部变更，用户明确确认Trae授权同步B2.5b/v3.16，来源归因闭合。原baseline/first FAIL/rawHashEquality=false保持；不改判为字节PASS。除两项归因外无其它范围外修改/删除/新增；本轮代理只写新交付目录。详见evidence/，不重复b真实HTTP测试冒充c验收。

## VERDICT-410 · 不变式、延期与闭合【冻结】

裁定：P3文档补冻闭合；本轮未发现需新授权才能解决的架构冲突，Trae来源PROTOCOL已闭合。沿用INV-10/12/13、目录追加唯一本地发布commit point、持lease/无Web Locks拒绝、七项归属/revision/逻辑主key/锁顺序、RealityPause≥OfflineGrace、源主动排空、发起设备账号绑定、046个人层按账号保护/共享层可读边界。共享传输群密文不将账号个人层变成群数据，也不改变FileCarry共享可读规则。P4外部checkpoint证明/个人自身贡献/长期key保护/异步存储、P5原生离线时间证明、旧身份迁移、world/root注册入口和生产保管负责人各有明确实施前置，不能借本轮绕过。详见stages-and-open-items.md；后续若提出云key包、三元静默转换、绝对匿名或未经批准原生能力，先PROTOCOL。
