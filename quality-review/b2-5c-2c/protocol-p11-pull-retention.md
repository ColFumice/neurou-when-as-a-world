# PROTOCOL P11 · pull 原回复幂等与有限密文保留的冲突

日期：2026-10-11。原提交状态：待裁定，Relay 实施/验收暂停。**后续用户已明确批准：“批准 P11 引用重建与边界 Gap 例外，继续 c-2c”。对应正式落地 VERDICT-449，实施已恢复。** 下文保留原问题、方案和提交时证据，不把暂停时的“未执行”理解为最终验收状态。c-2c 授权和已批准 P10 均继续有效，不重复申请既有授权。

## 冻结依据与已证实冲突

1. `b2-5c-2a/http-and-port-draft.md:84` 要求原 nonce 重传返回原完整 wrapper 字节，新 nonce 才新签响应 wrapper。
2. 同文 §4（尤其第 139 行）要求 shared 幂等原结果与事实同事务、普通完整结果至少 7 日；`storage-and-clock-contract.md:13/36/42` 同样要求原 canonical 结果及永久 nonce/hash tombstone。
3. 同文 §5 和 `storage-and-clock-contract.md:50/52` 要求 pull 检查 generation/floor/缺载，到期设备下一次必须 Gap；retention 从 admittedAt 计算 86400000ms。全部 ACK 不提前删除，expiry 保留轻量 tombstone/floor/身份记忆。
4. 本轮用户 Relay 硬边界：只保存有限期 exact ciphertext 与 public proof/cursor/ACK；轻量权威不保存正文载荷，不以旧结果绕过 Gap。
5. 当前新增 `RelayService.handle()` 按通用幂等模板把包含完整 `commits[]` 的 pull Batch 存入 `authority_requests.result_wire`。其 prior-result 分支在当前 world/member、expiry、generation/floor/缺载检查之前返回原 wire。于是 queue 24h 到期清掉密文后，该表仍保存密文副本且原 nonce 可再次取得；成员被撤也可能走旧成功回复。两位独立代理与 root 均确认这一问题。

**结论：**同时逐字执行“所有 pull 完整原结果至少 7 日”和“只在队列保留期内提供密文，之后下一次 pull 必须 Gap”不成立。不能自行延长队列至 7 日、默默删通用原结果、重评估旧 nonce 并冒充原字节回复，或把密文搬到轻量权威表后声称仍是有限队列。

## 推荐最小裁定：pull 独立结果策略

请求只对 `/relay/pull` 明确以下例外；**不修改任何 c-2b authority/session/clock/PG 源码、001/002 或普通事实幂等政策。**

1. `authority_requests` 对 pull 只记轻量 nonce/operation/world/device/generation/requestSHA、结果摘要、原 wrapper 的 receiptId/keyId/signature 和有序 queue 引用（position/identity/digest、after/next/floor）。**不存 envelope 或整套 public proof 副本。**只有 Relay queue 存载荷。
2. 同 nonce 复取必须先完成真实 session/CSRF、当前世界成员、当前 stream generation/floor、expiry 和 authority 缺载检查，不能先返回历史成功 Batch。普通鉴权/撤员失败继续明确拒绝；不伪 Gap 掩盖 Unauthenticated/Forbidden。
3. 所有引用仍在有效保留期且 generation/floor 可用时，从 queue 精确原字节和 public proof 重建原 wrapper，核原 wire SHA/签名，返回逐字相同原回复。失配/HostFailure 明确拒绝，不重签一个“相同成功”。
4. 到期、世代改变或缺载时，允许该旧 pull nonce 得到当前签名 Gap（RetentionExpired / RelayGenerationChanged / MissingAdmittedEnvelope）。这是**明确批准的 pull 幂等例外**：只读响应随可用性变化，不重新执行提交或 ACK，也不重新发送旧密文。轻量 nonce/hash 记忆永久保留，同 nonce 异请求仍 Conflict。
5. ordinary authority / Relay submit / ACK 的轻量完整原结果至少 7 日、永久 tombstone 和原 nonce 原字节规则均保持。pull 不声称保存完整回复 7 日；其可重建载荷寿命受 queue retention 支配。空 Batch/Gap 本身无密文，可存轻量原响应，但每次复取仍先检查当前准入及 stream 边界。
6. 该实现仅用新 RelayService/Storage 自己的内部结果格式和现有 bytea 容器；内部格式带版本/种类并严格校验。旧 authority 只接受自身 operation；跨 operation nonce 已由原 guard Conflict 拒绝。无新增服务 payload API，无新迁移，无 generic savePayload。实际实施若仍需旧源码/迁移变化，另报偏差。

## 为什么选择引用重建

在保留期内保全断网/丢响应/重启后的原回复字节，同时让 queue 成为唯一密文来源；到期后以批准的 Gap 例外保住有限保留边界。只存 tombstone 并对所有旧 pull nonce 返回 IdempotencyExpired 也可安全拒绝，但会放弃保留期内原回复复取；本报告优先推荐引用重建方案。

## 批准后必须补的证据

- 真实 PG：authority_requests 中 pull 结果只有轻量引用，搜索/解码检查不存在 envelope 或 public proof 副本。
- 相同 nonce 在保留期内丢响应/重启后逐字原 Batch；同 nonce 异 payload Conflict；新 nonce wrapper 不冒充旧 nonce。
- 加速隔离时间跨 24h 后，同旧 nonce 与新 nonce 均返回签名 RetentionExpired Gap，queue 密文/public proof 清空，只留 tombstone/floor。不得称真实等待了 24h。
- generation 丢段后旧 nonce Gap；当前成员撤销后旧 nonce 拒绝；缺载短窗口原 nonce 不绕过检测。
- 普通 authority、submit、ACK 的原字节、期限与历史回归保持；格式/CSRF/限流/HostFailure 不消费业务 nonce。

## 当前状态

P10 已按用户批准最小应用，客户端 30 项 Relay 契约与 13 项 deadline 契约已通过（隔离测试，不是新 Relay HTTP 服务验收）。新增四个服务器模块与客户端 adapter 已草拟，可编译；未执行 Relay PG/HTTP 测试，未达 c-2c 完成。

实施级问题“格式错误不消费 nonce”和“已到期首次 submit 不短暂保留可用 body”已列待修，不需要改变架构冻结；批准 P11 恢复后按既有条款修复并测试。当前停止对应机制修改。

**请求裁定：批准以上 pull 引用重建及边界变化转 Gap 的窄例外，保持普通轻量事实 7 日幂等和其他冻结不变。**
