# B2.5 子阶段与遗留事项

2026-10-11（Asia/Shanghai）。b已获授权；c/d/e以下表补冻准入，文档准备不等于机制实现授权。

| 阶段 | 范围/实际状态 | 实施前置 | 验收要求 |
|---|---|---|---|
| B2.5b | 真实Auth login/logout/verify/refresh、签名时间、轻量账号/注册设备；独立loopback Node24/Fastify5/PG17 | P1/P2闭合；本轮376～390 | 三门禁、新端口契约、真PG+socket HTTP、pinning拒绝、刷新重用/并发、重启持久、保护SHA/diff |
| B2.5c | CommitRelay；未实现 | P3全部精确补冻，尤其AppendedAt/序号/三类正文/开发者/成员key/TraceTouch/checkpoint迟到/有界延迟 | 不透明WorldCommit正文、只中继、幂等、批次/Gap、迟到/断线、密钥epoch；不暗开AccessCode/ObserverSync |
| B2.5d | 完整FileCarry与真实轻量迁移权威；未实现 | P3共享codec及P4异步加密存储/恢复/旧明文一次迁移；P2 live drain协议完整字段 | 完整个体媒体、账号加密/恢复/nonce/AAD、lease复验与耐久提交后目录追加、断电/容量/源确认/无payload服务器 |
| B2.5e | 原生可信OfflineGrace/PhysicalDevice；未实现 | P5原生host/TPM/attestation/boot/重装/攻击者边界批准，d保护数据基础 | 真实设备uptime、boot变化/睡眠/清安装/OS重装、无host拒grant、严格暂停绑定与自然SafePoint，INV保持 |
| B2.5f | 端到端+真实外部HTTPS部署；未实施 | c/d/e闭合，生产同源部署与pin/密钥/备份负责人明确 | 多真实设备、故障与恢复、独立服务部署、TLS/Secure、端到端数据保护、无fixture替代 |

## b交付的明确限制

1. 独立adapter/组合根已实现并以真HTTP测试，但没有改产品登录UI或旧世界主链，未做Creator视觉/物理设备验收。
2. 浏览器凭据只驻内存，重载需登录/新注册；新key对应新deviceId，最多256/账号，无设备管理/清理API。持久凭据/跨安装映射待明确契约，不能冒称PhysicalDevice。
3. 账号由管理员建立；无OAuth、自助注册、密码找回/更换、设备标签更新或凭据撤销/轮换。登出只撤销当前会话家族。
4. CLOCK_TRUSTED由运维断言，签名与跳变监测不独立验证UTC准确度；绝对授时监测和生产key轮换仍需运维方案。
5. 保留端口没有Relay、迁移、共享codec、FileCarry加密、OfflineGrant、host机制；没有服务不可用时的新离线准入。旧fixture离线/锁行为继续原样，不扩成真实保证。
6. refresh旋转丢失响应不自动重试旧token，避免重用；需重新登录。幂等register必须重用全部请求字段。
7. 测试PG为专用cluster，保存随机测试轻量行方便审查；无既有DB修改。服务测试结束关闭监听，数据库运行/停止状态见交付报告与runtime脚本，停止不删数据。

## 待裁定/待外部行动

P3/P4/P5详细清单见deferred-contract-preparation.md；完整schema、状态机、拒绝和恢复条件待各轮正式裁定。本轮没有新增阻断b的架构PROTOCOL。正式v3.16由Trae按最终附录落盘；不等待此动作重复申请b授权。

本轮无需云账号。f外部部署需要用户确定自建/云主机、域名/TLS、可信pin分发、签名key与数据库备份/恢复负责人；这是后续部署前置，当前loopback开发已经可执行。生产会话生命周期、旧token/challenge清理和审计/账号恢复应在f前补齐运维验收。
