# c-2c 前置独立复核

日期：2026-10-11。复核人：独立只读子代理 `c2c_prerequisite_review`。本文件记录前置源码/契约比对，不是实现、密码学或真实服务验收。

## 已证实阻塞

P10 唯一已证实：session owner 的 shared request 固定 12000ms 与冻结 pull `maximumWaitMs+7000` 不符。具体位置为 `RealSharedServiceSessionAdapter.ts:21/242/260/269`；依据为 `b2-5c-2a/http-and-port-draft.md:113`。现有 SharedServiceSessionPort 无 deadline 能力，私字段不可被新 adapter 绕过。建议只豁免该函数中已校验 pull 的局部 deadline，其他请求/auth 保持 12 秒；尚未应用。

## 可新增实现的事项

**ACK：**新 adapter 可私有持有 nonce，注入实际 SharedCommitValidator 的 validateCommit/ownsCommit 能力，逐项验真，再调用独立缓存 persistAndVerify/read 并核对精确 envelope/SHA，最后 signRelayAck。外来预签 ACK 不能直接转发：RelayAckRequest 不包含其签名绑定的 requestNonce，不能自动对应 adapter 新 nonce。应由 adapter 在验证与耐久证据齐全后制作最终签名；不能为此发明 wire schema 禁止的 null/占位值。缺 key、缺源、HostFailure 或缓存失败均不 ACK。c-2c 注入隔离 backend 测试要明确标注；生产 crypto/key 和完整双客户端闭环仍属 c-2d/e。

**服务器组合：**可纯新增 builder，复用旧 buildApp 与 authority classes/routes，只初始化一次 RealAuthorityClock，同一实例注入 authority 和 Relay。旧 buildSharedServer 只返回 Fastify app，不应先调用它再初始化另一 clock；后者会变更 PG generation。现有 tsconfig.shared 的 src/**/*.ts 与 002 的四张 Relay 表足以覆盖新增模块，无需修改旧 builder、迁移或入口。

## 保护结论

复核代理未编辑源码或机制文件。P7/P8/P9 不重开，既有 12 项不重裁。当前只请求 P10 新例外；其他潜在实施细节不能被此报告当作扩大阶段授权。
