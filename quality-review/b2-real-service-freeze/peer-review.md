# B2.5a 独立复核记录

2026-10-11（Asia/Shanghai）。两名并行代理只读复核历史依据与本轮候选，不写生产文件；门禁/保护证据由第三名代理在本轮独立质量目录产生。审查不是密码学实现或物理设备安全认证。

| 复核问题 | 处理 |
|---|---|
| 当前正式v3.15与旧历史报告“待落盘”不同 | 以当前文件事实为准；不修改历史证据 |
| mode guard/历史同步签名、fixture服务完整payload与live能力 | P1/P2明确阻断真实包装；新异步端口/无payload服务只作提案 |
| 本地静态个人层/完整journals仍明文、异步加密不能同步返回成功 | P4新增存储/恢复契约前置；不把旧fixture认成历史失败 |
| 原图携带会违反截图立即处理规则 | 删除持久MomentImage候选，只携实际ProcessedMomentImage/合法元信息 |
| 旧根包装新根会让已撤销/泄露根继续解密 | 新根独立封给批准设备/恢复key，历史旧根由新根包装；泄露时更新恢复秘密 |
| Relay保留期缺历史关系、外壳缺时间/包装key/suite | 补retention≥SettleHorizon≥OfflineGrace+有界延迟、suite/wrappedDEK；AppendedAt精确外层仍P3补冻，明确不是完整wire |
| drain receipt缺challenge/migration/摘要绑定 | 新RealDrainAcceptance嵌入旧d值，加绑定；不改历史SafePointDrainAcceptance |
| FileCarry AAD的service实例无字段 | 外层补serviceInstanceId并签名覆盖 |
| 验签只列keyId，不能确定可信key | 新AuthorityTrustAnchor含P-256公钥JWK/指纹、带外引导/轮换规则 |
| 统一“本人AEAD后Complete”会阻断跨账号只读共享 | 分共享接收与同账号恢复；他人层只保留、不签发个人Complete |
| entry/chunk派生不一致、可导致nonce计划歧义 | 每逻辑entry子key，每chunk连续nonce；(entryId,chunkIndex)唯一、JCS域分离 |
| grant预算数值/boot字段与历史事实混写 | 当前严格3600000ms，异常签名预算拒绝；boot/grant是新平台提案 |
| d SafePoint验收不得扩大成未实装结局验证 | 写历史禁止集合+d已验收Primary排空；结局禁止规则保持 |

随机AccountKey、Auth管理wrapped-key与先登录再批准/恢复可作为046“Auth提供账号凭据”的细化提案；没有开放匿名生产解密或由密码重设获取旧数据。WebAuthn/安装凭据不等同物理设备，应用计时不等同设备uptime。最终整体状态仍Proposal/Blocked，P1～P6未闭合，不因复核修正或三门禁通过升级为Frozen。

修正后的第二次只读契约复核通过，未发现残留必须修复的一致性问题。最终保护比对独立记录两项外部报告新增，初始6,937→6,939、changed/removed均空、raw exit1，来源均UnknownExternal；未重建baseline、未把该来源问题当架构安全复核通过。
