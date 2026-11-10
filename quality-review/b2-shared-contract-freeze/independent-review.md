# P3规范独立复审记录

2026-10-11（Asia/Shanghai）。root与三个子代理完成历史核对、成员/密码学审查、门禁/SHA和确定性重放审查。所有检查为文档语义或既有代码门禁，不宣称执行新codec、契约实现或真实Relay测试。代理只写本轮新增目录，生产源码未变。

| 审查问题 | 最终处理 |
|---|---|
| B2.5a早期候选遗漏035、028、031后续规则 | 保留原材料；新裁定明确RestrictedWrite/CoDeveloper/按对象无网络锁、历史OrphanCommit与Echo精确扣自身条件。二元新格式按最新用户口径、历史027三元隔离不静默迁移。 |
| 权威只收digest却声称验证覆盖完整密文的签名 | 改为独立SignedWorldCommitAdmissionClaim签header+最终envelope摘要；authorKeyBindingReceipt验来源；完整envelope签名/AEAD在Relay/接收端验证。receipt不证明正文合法。 |
| receipt声称合法但作者密文/签名实际坏 | wire保留精确字节；有可信claim/receipt且exact摘要相等才技术InvalidChange覆盖，不执行不可信payload；字节缺失/替换/缺群key仍Gap，不能假拒正文推进seal。 |
| checkpoint提前封边、清log丢排序字段 | seal≤S−H且单调，checkpoint边界等于seal；coverage留AppendedAt/admissionRevision，不用maxSequence吞号段洞。 |
| 未结算冲突提前写终局诊断、coverage跳过旧Applied | 暂态尾部从稳定checkpoint重放；applyResult与finalDiagnostic分开，不能跳过曾有效后被覆盖的单步。父coverage已有诊断不回退，新sealed合法覆盖才允许null→MergeConflict，旧checkpoint字节不改。同账号多设备冲突不豁免。 |
| atomic多目标批次牵连不同对象 | 每commit一个EditTarget/operation；多对象明确保存拆独立identity；非法对象不让另一合法对象一起拒绝。 |
| state更新/NoEffect/InvalidChange不精确 | §6.1逐行规定创建/替换/删除与createdBy/lastEditedBy/deletedBy、显露/触痕、名单和悬空Trigger；重复Delete明确NoEffect/null。 |
| Normal来源由任意新建实体自报 | 必须受审manifest唯一认证来源/tier/traceTouchId，非null不是证明；Create不升级Echo/Anomalous。 |
| 饱和触痕总量无法扣自身 | exact uint128总量与渲染min65535分开；自身私人贡献缺证明Unknown，不生Echo；P4恢复前置保持。 |
| root首成员没有AccessCode准入fact | credential.observerAdmissionRevision仅root可null，须正式world/root注册证明；普通成员必须真实≥1签名fact。AccessCode仍开发者可自行选择合法6位，CSPRNG是推荐生成，不改023。 |
| 单纯revision不证明成员或名单目标资格 | 每admitted条目附membershipEpochReceipt/authorKeyBindingReceipt，名单subtype附rosterObserverAdmissionReceipt；Add另外由admission签出AppendedAt时有效资格，Remove可清理已退出旧名单。缺证明Gap，不自报授权。 |
| developer注销/根不可用造成CoDeveloper被全部禁用或擅取管理权 | closure轻量签名事实、不回填seal，名单冻结而旧合法CoDeveloper继续编辑；新密钥交接/密码学撤销Pending/KeyPublisherUnavailable，不能假撤销完成或追回历史key。 |
| seal前缀摘要被误说等于state/checkpoint摘要 | 三种本地摘要分别自洽；只有准入前缀count/prefix等于seal。seal不证明state、全员收件或陌生checkpoint可信性。 |
| 全部ACK导致队列在H前提前清空 | retention是从admittedAt计的最短密文保留期，ACK不绕过retention≥H；到期未收件为Gap。完整commit验真并本地耐久可ACK，不需等H产生checkpoint。 |
| v3.16外部同步与禁止本轮修改docs冲突 | 用户确认Trae授权来源；追加closure，7042项原baseline与first raw FAIL保留，不重写成PASS、不回滚外部文档。 |

已知延期为P4的外部checkpoint/历史证明、秘密长期存储/恢复/个人自身贡献和P5原生time proof；world注册/root pin实际入口、publisher保管人与key包交付方式是c实施配置/前置。当前未发现必须新增授权才能解决的P3架构冲突，不以既知延期阻断纯文档交付。

审查不构成生产安全证书。Auth/轻量权威的身份/时间事实与开发者key publisher是受信边界；恶意客户端、XSS/扩展/OS管理员、合法成员复制数据/密钥不由群加密消除，RegisteredCredential不是PhysicalDevice。原始签名提交和Relay元数据可归因，“无身份”只覆盖触痕聚合投影。
