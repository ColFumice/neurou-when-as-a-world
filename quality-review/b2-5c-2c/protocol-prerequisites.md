# B2.5c-2c · 新前置冲突 P10（待 PROTOCOL 裁定）

日期：2026-10-11。原提交状态：P10 待裁定；下文保留当时的问题和未应用 diff。**后续用户已回复“批准 P10 最小局部修正，继续 c-2c”，已按 VERDICT-448 落实。** c-2c 正式授权、P7/P8/P9 与既有 12 项裁定保持闭合；不重复阶段授权。原报告中“尚未修改/未应用”描述提交时状态，最终状态见 delivery-report。

## P10 · protected session owner 的 pull deadline 与冻结 wire 冲突

**已证实事实：**

1. `quality-review/b2-5c-2a/http-and-port-draft.md:113` 冻结：pull 的 `maximumWaitMs` 为 0..25000，默认 25000；客户端 deadline 为 `maximumWaitMs + 7000`，最大 32000ms。一般请求仍为 12000ms。
2. `src/presentation/RealSharedServiceSessionAdapter.ts:21` 固定 `REQUEST_LIMIT_MS = 12000`。`request()` 在第 242 行 abort timer、第 260/269 行 elapsed 检查均无路由区分，pull 同样会在 12 秒截止。
3. `src/director/SharedServiceProtocolContracts.ts` 的 `SharedServiceSessionPort.request(operation, requestNonce, payload)` 不提供 deadline 参数。transport、CSRF 和 anchor 属于现有 owner 私有能力。新 Relay adapter 无法仅通过冻结窄端口获得 32 秒窗口。
4. 当前 owner 先在第 234 行调用严格 codec 校验 payload；`/relay/pull` 的等待范围已由既有 codec 限定为 0..25000，适合作为局部 deadline 的唯一来源。
5. 本轮用户硬约束原文：**“不改 c-2b 已交付的 authority / session / clock / PG 事务；如必须改，先停报 PROTOCOL。”** 所以本轮 c-2c 授权本身不能推导为该 session 源文件修改授权。

**冲突后果：**默认空队列长轮询允许等 25 秒，而 owner 在 12 秒先 abort。不能把 server wait 降到 12 秒内、拆多次短 pull、吞掉 timeout 或访问 owner 私字段来冒充已经满足冻结期限。

## 推荐最小方案（未应用）

请求只豁免 `src/presentation/RealSharedServiceSessionAdapter.ts` 的 `request()` 局部：

```diff
       this.codec.validatePayload(operation, payload);
+      const requestLimitMs = operation === '/relay/pull'
+        ? (payload as { readonly maximumWaitMs: number }).maximumWaitMs + 7000
+        : REQUEST_LIMIT_MS;
       decodeBase64Url(requestNonce, 32);
@@
-      timer = setTimeout(() => { if (controller) { controller.abort(); } }, REQUEST_LIMIT_MS);
+      timer = setTimeout(() => { if (controller) { controller.abort(); } }, requestLimitMs);
@@
-      if (!response || performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {
+      if (!response || performance.now() - started > requestLimitMs || controller.signal.aborted) {
@@
-      if (performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {
+      if (performance.now() - started > requestLimitMs || controller.signal.aborted) {
```

这份 diff 是审阅片段，不是已应用补丁。普通 shared 请求继续 12000ms；旧私有 auth `call()` 的 timer/elapsed、旧 adapter、guard、签名与 nonce、会话失效、codec schema、CSRF 及 receipt 验真均保全。不新增 secret getter 或通用可调 timeout 入口；不改 clock / authority / PG / 001 / 002。

批准后，保护审计只对上述文件的指定局部记录最小例外，保留批准前原字节及哈希；不放宽目录白名单。验证必须覆盖 `wait=0 → 7000`、`wait=25000 → 32000`、普通 shared/auth 仍为 12000、越界 wait 严格拒绝、长于 12 秒的合法真实 pull，以及原 nonce 重传/超时拒绝。静态检查和契约测试不能代替真实 HTTP 长轮询证据。

## 本次基线证据与状态

- 三门禁 PASS：naming 0 ERROR / 45 既有 WARN，警告逐行与 c-2b 最终版本一致；dependencies 0 ERROR；typecheck exit 0。
- `evidence/c2b-source-stability.json`：c-2b 23/23 实施文件与已验收 SHA 一致。
- `evidence/protected-final-audit.json`：保护范围 7435 → 7435，changed / added / removed 及 unauthorized 全空；两份既有 kernel 各 14 文件零变。
- 未启动 PG，未执行 server build/test、历史回归重跑或 Relay HTTP/PG 验收；以上只证明前置基线健康。
- 实施计划见 `implementation-plan.md`。c-2c 未完成；等待 P10 明确裁定后恢复实施。不据此生成正式新 VERDICT 或已冻结名库增量。

## 请求裁定

建议采纳：**仅允许 owner 的 shared `request()` 对已验证 `/relay/pull` 使用 `maximumWaitMs + 7000`，其他请求保持 12 秒；原文件其余逻辑不改。**

若不批准该最小例外，需要由 PROTOCOL 明确新的安全能力方案或调整既有期限契约；实施方不会自行修改冻结契约或绕过保护。
