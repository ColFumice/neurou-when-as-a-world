# VERDICT-448 · P10 pull deadline 最小实施例外

日期：2026-10-11。裁定来源：用户对新 PROTOCOL P10 的明确回复：**“批准 P10 最小局部修正，继续 c-2c”。**

允许 `src/presentation/RealSharedServiceSessionAdapter.ts` 的 shared `request()` 在严格 codec 已通过后，仅对 `/relay/pull` 使用 `maximumWaitMs+7000`；wait 范围仍为 0..25000，deadline 为 7000..32000ms。其余 shared 请求、私有 auth `call()` 保持 12000ms，原 guard/session/signing/nonce/schema 均不改。

实施仅新增局部 `requestLimitMs` 和替换 timer/两处 elapsed 共三处用途。批准前原字节保存在 `evidence/session-before-p10.ts`，来源及 SHA 保存在 `evidence/p10-authorization.json`。P10 虚拟 deadline 契约 13/13 PASS；大于 12 秒真实 HTTP pull 仍待 c-2c Relay 验收。

该例外不授权其他 c-2b 变化、不调整任何结算政策或 boundedRelayDelay，不以 25 秒轮询声称有限 B 已证明，不开放任意 timeout 入口。P11 是另一个新未决冲突，见独立报告；本裁定不预先批准 P11。
