# B2.5c-2b 实施计划与授权范围

日期：2026-10-11（Asia/Shanghai）。用户通过粘贴授权包明确启动c-2b；c-2a/PROTOCOL审阅与v3.19落盘已完成，P7/P8/P9保持闭合。本文件记录实施入口，实际完成状态见delivery-report.md。

| 顺序 | stage c-2b条目 | 新增文件 / 唯一允许旧文件变化 | 验证 |
|---|---|---|---|
| 1 | 保护入场 | quality-review/b2-5c-2b/evidence内immutable baseline、精确新增名单 | 7179旧文件SHA；IntentPort原字节前缀及type-only AST |
| 2 | type-only协议/窄capability/wire | src/director/SharedServiceProtocolContracts.ts、SharedServiceProtocolCodec.ts；IntentPort只追加type-only suffix | 严格canonical/unknown边界；纯ES2020无DOM/Node编译；c-1字节及154历史回归 |
| 3 | 独立session owner/signing/真实authority客户端 | src/presentation/RealSharedServiceSessionAdapter.ts、RealWorldAuthorityAdapter.ts；assets/scripts/SharedRelayPrototypeBuilder.ts | ContractOracle、独立注册签名/nonce字节、注销失效；实际loopback适配器单独验证 |
| 4 | 同PG会话/真实clock/迁移/组合 | server/src/SharedSessionVerifier.ts、RealAuthorityClock.ts、SharedMigrationRunner.ts、SharedReceiptSigner.ts、SharedServerConfig.ts、buildSharedServer.ts、shared-main.ts、shared-cli.ts；server/sql/002_shared_authority.sql；server/SharedBuild.mjs、tsconfig.shared.json | PG17、auth实时核验、18表/schema checksum与锁序；生产clock与注入clock分列 |
| 5 | root/world/code/ECDH/epoch/段/permit/admission/seal | server/src/WorldAuthorityService.ts、WorldAuthorityStorage.ts、AuthorityRoute.ts、SharedCryptoProof.ts；server/test/shared-http.test.ts、shared-clock-migration.test.ts | 全15authority route真实HTTP/PG、signature/CSRF/nonce/rollback/限流拒绝，幂等原receipt、全局序号 |
| 6 | 交付 | 本轮verdicts增量、v3.20 A/B/C/D提案、完整diff、delivery-report、protected-final-audit | 三旧门禁、server独立typecheck/build/test、历史427项回归、只允许IntentPort type-only旧文件变化 |

server/sql/002_shared_authority.sql采用最新用户授权包要求；旧server/migrations/001.sql、db.ts runner、app/config/main/crypto与package/tsconfig都不改。新SharedBuild只读编译同一pure kernel，生成server/.shared-kernel及server/shared-dist；缓存不是维护第二份schema，原输入SHA可核对。测试/构建新增路径固定于evidence精确名单，不对白名单或整目录放宽。

只有15authority HTTP路由实施；18 route联合含未来3Relay契约，Relay服务/路由/客户端、群key producer/package交付、耐久ACK、双端完整共享链与LAN TLS均不实现。002内18表含冻结Relay存储占位，不意味着Relay上线；运行证据检查这些表未被业务填充。不接旧Builder/UI/产品主链。

操作员正式world/root/Genesis/manifest公开pins尚未提供时，独立本机开发基线使用测试进程明确安装并批准的临时公开元组及内存root；服务仍真实验证root/注册设备签名，普通Observer仍真实六位码准入。该证据只证明loopback开发原型，不冒称既有正式内容世界注册或持久root恢复。测试私key/密码/pepper/群key不落交付文书。
