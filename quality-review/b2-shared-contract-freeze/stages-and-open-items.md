# P3之后的B2.5c拆分及前置

2026-10-11（Asia/Shanghai）。P3只冻结规范，以下为后续实施拆分，**不是本轮开工授权**。

| 子阶段 | 工作范围 | 实施前条件 | 独立验收 |
|---|---|---|---|
| B2.5c-1 契约与确定性重放 | 增量type-only契约、严格canonical codec/bytes、签名/AAD验证、三类变化和历史权限、coverage/seal/Gap；隔离测试而非改旧主链 | 明确授权c-1；world/内容manifest正式批准入口、root注册与信任pin流程、future端口/HTTP错误wire的可执行绑定；逻辑零cc | 篡改/额外字段/同身份异摘要/多设备号段/同毫秒总序；不同对象独立、删除不复活、撤权按总序；正常触痕唯一计数/自身Unknown；seal≤S-H、坏body精确摘要分类、缺key/缺载不推进；三门禁和SHA |
| B2.5c-2 真实轻量权威与Relay | server独立PG事务账号序号段、permit/admission/rejection/seal、轻量成员epoch事实；HTTP submit+pull+耐久ACK、bounded密文队列/限流/Gap | c-1验收、明确授权c-2；可信服务clock、不回填已封边的账号/成员事实；开发者长期root与成员ECDH凭据实际来源/保管，key包带外交付；不云存包 | 真PG+socket loopback两客户端，序号并发/幂等、epoch原子切换、服务重启、未知/过期/失信/撤销拒绝、拒绝个人payload、作者proof/根pin错配拒绝；队列保留条件实证 |
| B2.5c-3 真实Relay集成验收 | 多真实客户端受限在线profile；提交→网络拉取→验真→本地耐久ACK→完整前缀重放；网络故障/Gap/保留与密钥边界 | c-2通过及明确授权；如接真实世界主链，须P4保护存储/七项不变式路径；未经授权不接编辑器/产品ObserverSync | Relay单独停机时Auth可用、不切fixture；权威失信仅候选；retention过期/恶意密文/乱序撤权/重复/重启/epoch边界；两个客户端同Genesis+同完整admitted前缀投影及拒绝一致 |

ContractAdapter可以在后续明确授权的测试轮新增隔离fixture，但本轮没有实现，未来也不能成为真实服务的故障回退。旧AuthService/CommitRelay同步签名与b保留泛型port不改；新方法的正式声明、结果wire、路由和模块放置在c-1结合命名/依赖审查绑定，不能把现在的候选接口当既有源码导出。

## 已冻结与延期边界

| 项目 | 本轮状态 | 下一个落地条件 |
|---|---|---|
| 新二元identity/账号全局分段 | 规范冻结 | 服务事务+持lease消费证据；旧027三元迁移不在c默认范围 |
| 在线AppendedAt/claim/admission/seal | 规范冻结，b接口未变 | c轻量authority实现与signed root配置，不把b一次time sample作permit |
| 三类变化/单对象编辑/DeveloperRoster | v1有限数据schema冻结 | 内容manifest来源及生产边界批准；更丰富Trigger/社区地图需新version，不用unknown绕过 |
| AccessCode与成员key | 正确码自动Observer、key交接独立冻结 | world注册/root pin/key包交付实际入口和受保护private key保管；首次加入产品UI未授权 |
| Web离线新共享提交 | 拒绝，RegisteredCredential在线受限 | P5批准host/boot/uptime/time uncertainty/OfflineGrant后新profile，不改本v1伪装支持 |
| 外部FileCarry与陌生checkpoint | schema冻结，缺来源证明保持Gap/CheckpointUnverifiable | P4冻结完整共享/个人载荷、原始签名可重放证据、旧epoch key/manifest provenance、媒体和账号保护 |
| 自身TraceTouch精确贡献 | 私人域、缺证明Unknown | P4恢复方式与既有七项归属，不新增第八项、不发布身份表 |
| 开发者注销 | closure事实与总序规则冻结，b未实现注销API | 可信账号事实生产者保证有效时刻不回填、随log/checkpoint保留，单独验收；不存在API时null不自报注销 |
| 长期开发者root/群key恢复 | 可信来源与失败边界冻结，保管未实现 | P4受保护vault/用户外部保管和恢复流程；b ephemeral credential不能成为长期root |
| key publisher消失 | KeyPublisherUnavailable；既有合法epoch/CoDeveloper可在线编辑 | 不擅加管理员；新加入/密码学撤销等待原root或另行批准恢复，不能宣称旧key可追回 |
| 网络有界延迟 | 条件性B及H/retention不等式冻结 | 实测健康前提；任意断网无SLA，超界冻结结算 |
| 生产HTTPS/外部部署 | 非本轮工作 | B2.5f明确部署、TLS/Secure、key保管/备份负责人；loopback证据不当生产验收 |

## PROTOCOL与待裁定

本轮曾因两份禁止本轮修改的docs在基线后变化停止“全量冻结已闭合”声明；用户已确认两项来自Trae授权B2.5b/v3.16同步，归因闭合。保留raw SHA FAIL，详见evidence/source-attribution-closure.json。没有新增未闭合的P3架构PROTOCOL；以下是**已知延期/实现输入**，不是重复请求已给的P3补冻许可。

1. 实施c时指定world注册/Genesis与正式内容manifest生产者、开发者root pin交付与私key保管人、成员key包交付路径；这些没有b既有API可冒用。
2. 若要求云端保存wrapped群key包、服务器保存checkpoint/完整状态、签名原始触痕也绝对匿名、CoDeveloper在root失踪时擅自管理成员，则与现冻结边界冲突，必须先PROTOCOL。
3. 若要求Web离线或真实物理保证，先P5，不以序号段/应用时长降级；若要求c即导入陌生checkpoint、完整FileCarry或长期静态key存储，先P4。
4. 旧三元identity输入要真实迁移、扩充地图动作/坐标值域或改变身份/时间profile须独立格式/迁移裁定。未授权时精确拒绝。
5. v3.17附录由Trae正式落盘；本轮不修改docs、NAMEBOOK或参照，不等同已经同步v3.17。

## 规范复审场景（未执行的实现验收要求）

| 输入/故障 | 规定结果 |
|---|---|
| 两设备同时申请同账号段 | 段不重叠；旧段重试返回同段；序号空洞不被checkpoint最大值覆盖 |
| 同毫秒不同identity | 按账号ASCII/序号确定总序；同identity异header/摘要IdentityConflict |
| 只有轻量claim，没有密文 | 可验证claim但receipt不证明正文；没有精确字节不推进checkpoint |
| 可信claim/receipt+精确匹配但坏AEAD/schema | 技术InvalidChange纳入coverage，无游戏/叙事副作用 |
| 网络改字节/缺旧key/缺前缀 | Gap/KeyUnavailable/CheckpointUnverifiable，不假拒正文、不ACK/跳过 |
| 较早合法撤权在未封边尾部后到 | 从稳定checkpoint重放；权限/暂态赢家重算，终局诊断等待封边 |
| 两对象保存，其中一对象已删 | 两条独立identity；有效另一对象可以应用，不整批拒绝 |
| 后序修改已删除对象 | 拒复活；保留覆盖/拒绝记忆；终局个人诊断不上传 |
| 正确前导零AccessCode/root publisher不在线 | 自动Observer事实；KeyPublisherUnavailable/Pending，未取得key不称加密入群 |
| root注销但有效CoDeveloper在线 | 名单冻结；已有合法key/权限可编辑，不自动取得key管理员权 |
| TraceTouch总量超过65535/自身贡献未知 | 精确总量仍加1、渲染饱和；不据饱和推断他人贡献，不生成Echo |
| 服务给seal边界>S−H | 拒seal；不提前结算；checkpoint边界必须等于合法seal |
| 旧已admitted提交很晚经文件到达 | 已accepted事实不变；无完整前缀是Gap，不因当前墙钟生成Orphan |
| 未获准提交真正TimeTooLate | 可信绑定拒绝证明、撤候选、028个人一次Orphan、不复活；PermitExpired不是该证明 |

以上是文档语义交叉审查和未来测试目标，不是已执行契约测试或真实HTTP证据。本轮只运行既有三门禁与文件保护审计。
