# B2.5 子阶段与遗留清单

2026-10-11（Asia/Shanghai）。本轮B2.5a审查交付；**整体Frozen=false，P1～P6待PROTOCOL，b～f不准入实现**。旧B2.4验收/历史P1～P4闭合保持。

## b～f拆分表

| 阶段 | 范围 | 入场前置 | 出场证据 |
|---|---|---|---|
| B2.5b 真实Auth + fetchServerTime | 独立本地服务器/DB、账号登录/登出/verify/refresh、服务签名时间、轻量归属/暂停读写壳；不上传payload | P1允许新端口/模式接线，P2真实权威边界冻结，账号注册/设备最低级别契约；服务器包独立门禁 | 本机真实HTTP而非fixture、密码hash/刷新重用/CSRF、时间nonce/坏签名/失败不回填、DB重启/CAS/暂停持久；现有三门禁/旧回归/保护 |
| B2.5c 真实CommitRelay | POST提交+cursor增量拉取/长轮询+ACK/TTL；正文E2EE、作者签名/准入/序号段 | P3完整WorldCommit/AppendedAt/成员开发者/首次加入/序号与key分发补冻；不得绕AccessCode或暗开ObserverSync | 两真实客户端服务请求、有限耐久队列/幂等/同ID异内容/越权/Gap/重放/撤销；证明服务无正文key/世界状态，断网不丢本机已发布事实 |
| B2.5d 完整FileCarry | 完整共享codec/checkpoint来源、本人所有载体/媒体、账号key/恢复/轮换、个人静态存储与文件容器 | P3完整SharedWorldState/log/checkpoint与SettleHorizon；P4媒体来源/加密提交/旧明文迁移/恢复协议；本轮草案不是完整schema | 真实来源完整往返、共享可读/本人可解/他人不可解/转发移除、全部媒体实字节、AAD/分块/截断/未知字段拒绝、主key/journal/staging不落个人明文、正式parseComplete再认证 |
| B2.5e 平台OfflineGrace + 物理设备 | 可信host boot/uptime/硬件身份、grant、账号设备绑定、自然SafePoint | P5批准平台/物理身份攻击者边界；P2源声明消费；b真实账号/时间、d密钥和耐久存储 | 原生boot/sleep/重启/回退/清profile/账号切换/撤销验证；无能力Web拒grant；预算到期和服务暂停已有活动自然结束；INV-10/12/13、全源排空/30秒确认 |
| B2.5f 端到端 + 真实服务验收 | b～e组合、两真实物理设备、TLS、真实文件搬运/故障恢复、本地/局域网部署与运维 | 前述阶段完整出场，P6来源结论记录；硬件/CA/DNS齐备，所有服务/host包及客户端门禁 | 正式世界主链→复制新UUID→迁移同ID→源保留/新归属恢复；真实等待≥一小时、无fixture快进计入；双档Creator+旧契约回归+真实断网/服务/DB重启/Claim后崩溃；最小服务存储审计/备份恢复/部署revision |

P项可以独立裁定以推进不依赖的文档细化；当前没有任何b实现授权。c与d不能先做服务壳/容器就标Complete。b若仅验证独立服务器，必须明确没有接入现有Cocos真实跨设备主链；f不能用两个profile或逻辑A/B替物理设备，也不能拿fixture推进一小时替真实经过。

## 尚缺的精确补冻材料

| 项目 | 已有规则 | 尚缺/必须决策 |
|---|---|---|
| 真实接线 | mode必须真实；领域/旧fixture不变 | 可改类型/guard/IntentPort/组合边界清单，旧receipt兼容与真实存储域编码 |
| 真实迁移 | 源主动排空+pause+claim+目录双域 | 不上传payload的新请求/receipt、摘要确切算法/来源、challenge单次/幂等、本机journal与用户文件恢复 |
| WorldCommit | 作者账号+自序号，不含向量，日志ID去重/时间再ID排序 | AppendedAt来源/数字结构、允许变化精确schema、跨设备离线序号段、防同ID异内容 |
| 共享状态/检查点 | SharingCriteria三条件、Developer唯一写、checkpoint本地 | 地图/Trigger版本与稳定ID、TraceTouch聚合、覆盖证明/重放一致性、迟到与SettleHorizon有界延迟 |
| 成员准入 | 首次加入AccessCode/限流，6位不是加密 | 最小Relay成员管理是否纳入本阶段、WorldRelayKey分发/轮换/撤销、开发者授权证明 |
| 本人媒体 | 截图/全部本人层随文件，媒体字节同加密 | 截图像素/MomentInfo/后处理参数、入场视频生产来源/归属、NotCaptured合法清单、缺损拒绝 |
| 本地加密 | 主key仍唯一，所有个人journal/媒体同保护 | 同步存储与异步准备提交/密文CAS，旧明文迁移、崩溃回读/清理/容量与密钥锁定 |
| 物理设备 | 服务签发deviceId，Web不承诺唯一硬件 | 原生host/TPM attestation/注册限制、OS重装/硬件替换/失窃恢复、攻击者与隐私范围 |
| 设备开机计时 | 1h、不是墙钟/应用时间、预算到期自然排空 | OS boot世代/快速启动/suspend语义、host信任、grant握手的uptime绑定 |
| 来源审计 | 本轮代理只写新交付目录 | docs/B2.4-overall-report.md与quality-review/B2.4-overall-report.md两项外部新增分别确认来源授权，raw新增证据保持 |

## 保持留后续，不能默默扩大

非Primary生产迁移、WorldRegistry本机位置API、完整ObserverSync玩法/产品账号切换执行端口、第三方OAuth与公网商业部署不是本轮自动批准范围。AccessCode已有历史安全语义，与Relay入场有依赖；仅为最小准入需要的协议须P3明确批准，否则c受阻，不把“留后续”当绕过权限的理由。

本轮没有源码/机制测试、Creator新机制画面、真实服务安全认证、实际一小时或部署成功证据。三门禁检验当前源码、候选Markdown不在扫描范围。保护异常来源独立报告，用户确认后仍不把SHA差异改成历史相等。
