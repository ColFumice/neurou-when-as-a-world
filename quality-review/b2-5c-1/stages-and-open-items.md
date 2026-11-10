# B2.5c-1 交接与遗留

日期：2026-10-11。c-1 本轮已实现并独立验证；下列后续阶段不因当前交付获得实施授权。

| 子阶段 | 范围 | 开工前必须具体化 | 独立验收 |
|---|---|---|---|
| B2.5c-1（本轮） | type-only schema、canonical bytes、source/签名/AEAD validator、三类变化/历史权限、coverage/seal/Gap、纯逻辑replay | 本轮用户已授权；隔离安装受信crypto/Genesis/pin/manifest/key capabilities | 154/154、三门禁、完整diff、保护raw与来源归因闭合 |
| B2.5c-2 | server/ 独立真实轻量权威 + Relay；PG事务序号段、permit/admission/rejection/seal、成员轻量事实、HTTP submit/pull/ACK、队列与Gap | 明确c-2授权；网络端口/HTTP request/error/CSRF/幂等/限流数值冻结；world/manifest注册、开发者root pin来源与长期私key保管、成员ECDH凭据来源/possession、群key包显式带外交付；可信clock和不回填封边事实保证 | 真PG+loopback两客户端；账号跨世界/多设备号段并发幂等与耗尽；严格payload限制；重启、epoch/许可/撤销、保留与durableACK；不切fixture |
| B2.5c-3 | 真实两客户端提交→拉取→验真→本地耐久→ACK→完整前缀一致重放；故障/Gap/延迟条件验证 | c-2通过与下一轮授权；若接旧世界主链先P4存储保护/七项/锁/commit point准入；产品ObserverSync、UI/编辑器入口单独授权 | Relay独停时Auth继续；权威失信只候选；恶意包/缺载/乱序撤权/重试/重启/retention/clock故障，两客户端结果一致 |

## 必须保留的边界

1. RealServiceContracts 与同步 archive 端口保持旧签名；ContractAdapter 保留测试域，真实失败不得切fixture或借旧标签。c-1没有扩充ContractAdapter或真实adapter。
2. source容器与成员/密钥数据类型落地不等于服务器会保存它们。权威仍只保留批准的轻量事实/摘要/receipt；Relay仅获准密文commit队列，不持个人层、SharedWorldState/checkpoint、完整FileCarry或云key包。
3. B2.4 CrossDeviceImportJournal / WorldMigrationJournal 与 WorldChangeLog 各自归属，存储主key、锁顺序、phase、七项和目录追加唯一commit point均保持原冻结；本轮没有存储发布入口。
4. RegisteredCredential不是PhysicalDevice。当前ExternalSharedOnlineV1不接受Web新增离线提交，不将号码段、b签名time sample或应用uptime当OfflineGrant。P5 host/TPM/attestation/boot边界继续延期。
5. 当前trusted checkpoint是同reducer实例内存能力；重启后陌生快照不能直接恢复其信任。P4须定义原始证据、旧key/manifest provenance、完整载荷与账号加密存储的耐久恢复协议。
6. 个人diagnostic仅返回提案；接入个人事件去重、本人贡献恢复和完整个人媒体属于后续P4/明确产品接线，不新增第八项Core。触痕签名不证明真实操作，不能宣称反作弊完备。
7. 可信root注销fact语义已实现为纯重放规则，真实注销生产者仍缺；c-2未批准时保持null，不能把测试签发fact当b已有账号注销API。

## 遗留 / 待裁定事项

| 项目 | 当前状态 | 后续动作 |
|---|---|---|
| 名库 v3.18 | 本轮附录提案与新增名清单完成；v3.17/P3已由Trae外部同步获确认 | Trae按本次提案落盘；不在本輪编辑名库 |
| future port和HTTP wire、限流具体数值 | P3候选；本轮因零网络明确留后续 | c-2开工前冻结；不冒用b现有认证路由 |
| world/Genesis/正式manifest注册与root pin交付 | 测试用显式受信能力；真实入口未实现 | 指定权威生产者、操作者和持久保护，防文件自举信任 |
| 开发者长期root、成员ECDH credential和群key包 | 结构与成员签名验证完成；包解密/possession/交付未实现 | c-2/P4具体化；服务不云存包，不复用签名/ECDH私key |
| global author allocator /本地durable号段消费 | 验签范围/观察冲突可验证；无服务器分配及lease消费实现 | c-2事务＋后续受保护客户端消费协议，跨world全局不重复 |
| 实际B/clock/non-backdating/retention保证 | 逻辑不等式和seal验证完成；无网络或durable队列实证 | c-2/c-3健康前提和故障实测；超界保持Gap |
| P4异步密文存储/完整FileCarry/旧明文迁移 | 未实现 | 先补冻一次性迁移、journal/media同保护、可信恢复及陌生checkpoint证据 |
| P5 OfflineGrace/PhysicalDevice | 未实现 | 可信原生host方案补冻与物理验收；Web禁止降级 |
| 旧三元identity、完整地图动作/新suite/profile | 精确拒绝；无自动迁移 | 独立PROTOCOL裁定和版本迁移，不扩unknown字段 |
| 外部部署/生产HTTPS | 本轮未涉及 | B2.5f授权、TLS/Secure、长期key备份/恢复责任与部署验收 |

本轮没有新增未闭合架构冲突。SHA外部变更曾提交PROTOCOL来源核对：docs/NAMEBOOK.md、docs/spec/stage-1.md 的本轮两次变化，用户明确确认为Trae授权v3.17/P3同步；raw FAIL保留，追加closure。这与上轮v3.16归因不是同一个事件，不重置baseline。
