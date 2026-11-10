# VERDICT-449 · P11 pull 轻量引用重建与边界 Gap 例外

日期：2026-10-11。裁定来源：用户对新 PROTOCOL P11 的明确回复：**“批准 P11 引用重建与边界 Gap 例外，继续 c-2c”。**

仅对 `/relay/pull` 采用 `protocol-p11-pull-retention.md` §推荐最小裁定的 1～6 项：请求表不存 envelope/public proof 副本，只存轻量原签名包装元数据、有序 queue 引用和原 wire 摘要。相同 nonce 的复取先验当前真实准入、generation/floor、expiry 和缺载；保留期内从 queue 重建并核验逐字原 Batch，边界变化后返回当前签名 Gap，撤员/未认证仍明确拒绝。nonce/hash 永久记忆与异请求 Conflict 保持。

普通 authority / submit / ACK 的轻量完整原结果至少 7 日及原字节规则不变；queue retention 86400000ms，不复制或延长载荷寿命。不得以新增私有格式修改旧 authority、旧 PG schema/事务、001/002 或扩大 payload API。该规则不声称群 key / 正文 / 地图权限已经验真。

P11 是对纯读取结果寿命及复取顺序的明确例外，不重新执行提交或 ACK。测试区分真实 HTTP/PG 与隔离加速 24h clock；后者不称生产真实经过 retention。实施/验收实际成绩另见最终报告，本裁定不等同 stage Complete。
