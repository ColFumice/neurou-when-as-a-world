# P3/P4/P5并行文档准备 · 无机制实现

2026-10-11（Asia/Shanghai）。本轮用户允许b期间准备这些文档。下表是下一补冻轮材料清单与候选决策，不冒称完整schema已经冻结，也不阻断已授权b。

| 事项 | 冻结原则 | 待补精确数据/恢复契约 |
|---|---|---|
| P3 AppendedAt | 外层中继可见，与正文一致、签名/AEAD绑定；日志按时间后ID排序 | server在线时间证明、离线时间锚/范围、同作者序号冲突与迟到的规则，禁止账本向量混入 |
| P3三类变化 | 单向雨元素显露、非独占TraceTouch、仅WorldDeveloper地图/Trigger定义修改 | 稳定实体ID/version、位置坐标范围/值schema、开发者单写版本CAS、去重/重放 |
| P3作者序号 | 作者账号+自序号全局唯一，跨设备有限离线段 | 段分配/耗尽/崩溃耐久/撤销段，不能复用或本地时间造号 |
| P3成员与world key | Relay只看外层，正文E2EE、作者签名；AccessCode非密钥 | 最小准入授权范围、challenge限流、成员epoch/WorldRelayKey封装、撤销/历史key、开发者公钥信任 |
| P3 TraceTouch | 聚合只保留强度、不记录访问者个人账本 | 聚合单元/衰减/上界/幂等来源，如何避免无限ID与隐私暴露 |
| P3 checkpoint/horizon | checkpoint只本地，retention≥horizon≥OfflineGrace+有界relay延迟 | 已覆盖commit范围/摘要/认证、fork世界identity与日志来源，过迟提交不进共享、Gap用户文件补齐 |
| P4存储 | 异步准备密文→lease复验→耐久写/回读→目录追加 | storage snapshot token的原密文字节CAS、逻辑明文视图、nonce/key生命周期、容量失败/日志恢复/GC |
| P4旧明文迁移 | 独立一次性协议，个人主key/journal/媒体同保护 | 识别源版本、只读原字节备份、迁移journal/原子切换/回滚界限、完成证明/清理、不可重跑覆盖进展 |
| P4个人媒体 | 全部本人实字节，截图只已处理图，不保存原图 | MomentInfo与处理参数/缩略图、EntryVideo生产归属、NotCaptured与缺损清单、流式容器/块索引认证 |
| P4账号key | 已认证账号+合法解密能力，随机根与新DEK、撤销不让旧根推导新根 | 新key独立分发/恢复秘密/历史key链、旧key疑泄露的本地重加密、源文件保留与导出恢复关系 |
| P5身份 | Web仅RegisteredCredential，strict PhysicalDevice在批准原生host | TPM key attestation、服务允许硬件/隐私pinning，OS重装/安装清除/硬件替换/共享OS、恢复/管理员边界 |
| P5时间 | 设备开机累计时长，禁止app/wallclock降级 | OS boot世代/休眠/快速启动/重启语义，host挑战与grant绑定、断host/回退/boot变更失效 |
| P5暂停绑定 | 发起设备服务绑定、源live主动排空，不能倒计时解锁 | hardware credential跨profile稳定映射、换安装不解锁、撤销/丢设备时人工恢复与正在活动排空证明 |

b实际注册设备只提供credential持有证明、会话、注册时label和当前会话家族登出撤销，没有设备label更新或credential revoke API；不提前实现上述world成员、账号根key、platform grant或硬件attestation。服务time是本轮真实能力，却不被用于提前Claim/修改T7音频时间。后续补冻应输出完整拒绝条件、精确字段、状态机与正反例，不能由实现者自行把候选类型升成完整生产结构。
