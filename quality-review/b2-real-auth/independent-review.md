# B2.5b 独立审查结论

2026-10-11（Asia/Shanghai）。root与只读审查代理核对server/、纯director契约、presentation适配、新组合根、裁定和保护证据。没有发现新架构冲突或未授权核心改动。以下实现问题已修复并按实际影响验收，不需重复提交已闭合P1/P2。

| 问题/影响 | 最终处理与证据 |
|---|---|
| access过期的verify若清掉全部CSRF/家族材料，无法继续refresh | 过期操作仍Rejected；保留仅内存服务refresh材料，无公开离线准入getter。真HTTP短TTL：401→refresh200→verify200 |
| refresh重用撤销若在抛错后事务回滚，旋转新token可能继续有效 | 在事务内返回重用结果并COMMIT家族revoked，再401；真DB重用/并发断言撤销持久 |
| mutating auth的token/family与challenge/account锁顺序可交叉等待 | mutation统一account→device→family→token；login先account并复查disabled/hash，再challenge；实际refresh/register并发验收 |
| Windows mode0600不能等同私钥ACL | 默认忽略.local，initialize-private-directory.ps1受限ACL；server-private-acl.json实测当前用户/SYSTEM/Administrators |
| /account/facts GET同源浏览器不一定带Origin | 业务统一同源POST+精确Origin+CSRF，真实HTTP验证，未放宽旧guard |
| 12秒期限仅验签前检查，await验签后可能越过期限 | 验签成功后再次检查elapsed/abort；回归实际执行ES256再推进测试单调时钟，收到AuthorityUnavailable；末轮24契约+6HTTP PASS |

审查确认：mode为ExternalService，无fixture引用/失败降级；pin来自配置，不取响应自签key；严格字段/nonce/签名用途/实例/身份；Web不提升PhysicalDevice；Untrusted服务时间拒绝；普通账号事实没有Core/通关/CopyPermission/归属。保留端口没有Relay或迁移实现，server schema不接受payload。

保护SHA核验并非生产安全证书：只证明本轮受保护文件原字节与允许增量；独立开发服务的真实HTTP/PG通过也不构成TLS、多设备物理、原生OfflineGrace或Creator视觉验收。同源XSS、本机管理员/同用户执行权限、服务或DB控制位于当前可信边界之外；这些限度在安全文档明确记录。
