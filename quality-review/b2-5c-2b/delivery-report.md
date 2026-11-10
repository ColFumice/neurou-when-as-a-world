# B2.5c-2b 实施交付报告

日期：2026-10-11（Asia/Shanghai）。实施授权来源：用户本轮粘贴授权包，已明确授权 c-2b；P7/P8/P9 已闭合。依据 v3.19 与 c-2a 的 stages / HTTP / key / storage-clock 冻结文件，本轮新增 authority、独立 session/signing、严格协议与组合根。v3.20 为提案，由 Trae 后续落盘；GPT 未修改 docs 或历史裁定。

## 1. 实现结果与验收范围

c-2b 的 15 个增量 authority 操作已实现。新客户端实际通过 loopback HTTP / Fastify5 / PG17 调用全部 15 项和旧 readAccountFacts；独立 b 认证实现真实 login/verify/refresh/logout/readServerTime。签名输入和响应使用严格 canonical bytes 与已批准服务 pin，mutation 用新的 AuthorityResult wrapper 保留原 P3 receipt/nonce/签名。

独立 server 与旧 b 共用同一实例、PG、cookie/session 协议、服务签名 key material。新 session owner、实时 SharedSessionVerifier、新 shared error handler 独立实现，不提取旧 AuthAdapter 私有能力，不修改旧 guard；失效、格式/签名错误不会切 fixture。开发 HTTP 仅 exact IPv4 loopback，默认生产浏览器适配要求 HTTPS；本机验收使用显式 loopback cookie transport 入口，仍运行同一生产适配器和验证器。

本轮 18 操作协议是纯数据/codec；实际路由为 15 条 authority。Relay 3 路由不存在。群 key package/producer、完整双客户端重放、LAN TLS、FileCarry/P4、OfflineGrace/P5、产品主链不在本轮实现与验收中。浏览器设备保持 RegisteredCredential；developerClosure 恒 null。

## 2. 完整文件增量

实现 diff 是 `evidence/code.diff`，清单/每文件 before/after SHA 为 `evidence/changed-files.json`。没有 Git checkout，diff 依据保护基线原字节和新增文件生成，不以“git clean”代替保护证明。

| 区域 | 新增文件 |
|---|---|
| director · 2 | src/director/SharedServiceProtocolContracts.ts；src/director/SharedServiceProtocolCodec.ts |
| presentation · 2 | src/presentation/RealSharedServiceSessionAdapter.ts；src/presentation/RealWorldAuthorityAdapter.ts |
| 独立组合根 · 1 | assets/scripts/SharedRelayPrototypeBuilder.ts |
| server/src · 12 | RealAuthorityClock.ts；SharedSessionVerifier.ts；SharedMigrationRunner.ts；SharedReceiptSigner.ts；SharedServerConfig.ts；SharedCryptoProof.ts；WorldAuthorityService.ts；WorldAuthorityStorage.ts；AuthorityRoute.ts；buildSharedServer.ts；shared-main.ts；shared-cli.ts |
| server 构建/迁移 · 3 | server/SharedBuild.mjs；server/tsconfig.shared.json；server/sql/002_shared_authority.sql |
| server 隔离测试 · 2 | server/test/shared-http.test.ts；server/test/shared-clock-migration.test.ts |

共 20 个新实施源码/配置/SQL、2 个新 server 测试、1 个旧文件修改，共 23 个 implementation diff 文件。唯一旧源码修改为 `src/director/IntentPort.ts` 的 1133 字节 type-only suffix，原字节前缀完整。37 个公开纯类型尾部导出；运行时 emitted bytes 与原版相同。

另在本轮 quality-review 目录新增三份运行器：`protocol-contract-tests.cjs`、`client-contract-tests.cjs`、`client-real-http.cjs`；它们属于隔离测试与证据，不混进生产源码。源码新增/保护清单在保护审计，本轮非私密文书/证据清单另见 `evidence/delivery-artifacts-complete.json`（时间点快照、不包含自身及后产 QA）；本轮 quality-review 目录不计入旧文件保护比较。`server/.shared-kernel` 和 `server/shared-dist` 是本轮新建的已批准生成路径，没有授权修改原源码或扩大原有排除策略。旧 server/package/tsconfig/001/runner、c-1 五模块、旧 AuthAdapter/RealServiceContracts/RealServiceBuilder、产品核心和 docs 均保全。

## 3. 三门禁、独立 server 与历史回归

| 验证 | 最终结果 | 证据 |
|---|---:|---|
| check:naming | PASS；0 ERROR / 45 既有 WARN，新增 WARN=0 | evidence/gate-runs/version-final/results.json 与 check-naming.log |
| check:dependencies | PASS；0 ERROR | 同目录 check-dependencies.log |
| root typecheck | PASS；exit 0 | 同目录 typecheck.log |
| 独立 server typecheck / build | PASS；各 exit 0 | evidence/server-shared-typecheck-version-final.log；server-shared-build-version-final.log |
| 独立 server test | 20/20 PASS | evidence/server-shared-tests-version-final.log；server-validation-results.json |
| 纯协议/字节/shape | 32/32 PASS | evidence/protocol/results.json；protocol-final-build-consistency.json |
| 客户端 ContractOracle | 18/18 PASS | evidence/client-contract-run/signing-coverage/results.json |
| 新生产客户端 + 真实 HTTP/PG | 11/11 PASS | evidence/client-real-http-run/verified/results.json、http.log、run-metadata.json |
| B2.4e 原隔离回归 | 227/227 PASS | evidence/history-b24/final/results.json |
| c-1 原隔离回归 | 154/154 PASS | evidence/history-c1/final/results.json |
| b 原 server 回归 | 16/16 PASS | evidence/history-b-auth/final/results.json / old-server-http.log |
| b 原 client 回归 | 30/30 PASS：24 契约 + 6 实 HTTP/PG | 同目录 results.json / old-client-contract-and-http.log |

历史合计 427/427，原测试断言/源文件/历史 evidence 不回写，隔离拷贝运行并独立输出本轮目录。原始 17 项 client、19 项 server、pre-version 三门禁/保护/diff 证据全部保留；最终 18/20 仅代表扩测，不用最终 PASS 覆盖原记录。原 protocol build 与当前最终纯源码输出 SHA 一致，32 项无需重复制造新结果。

纯逻辑另以 ES2020、types=[]、无 DOM/Node 库独立编译通过；证据 `evidence/logic-isolated-final/results.json`。IntentPort AST type-only 和 runtime type-erasure 证据为 `evidence/intent-type-erasure.json`。三门禁只是本库静态约束，不代替真实 HTTP/PG、crypto 或生产资源验收。

11 项新客户端真实 HTTP 验收发生在最后版本错误映射修正之前；最后仅改 AuthorityRoute 的该负例映射和 server 测试，所有客户端/Builder/纯 codec 字节及正向路由保持，未宣称客户端再次验过这条新反例。SHA 与范围说明见 `evidence/compatibility-source-change-note.json`；新负例在最终 server 20 项中真实验过。

## 4. 契约测试与真实证据逐项对应

| c-2b 条目 | 实施 / 可审查证据 | 分类与实际边界 |
|---|---|---|
| type-only 18 操作 / 严格 wire | 37 公开类型；codec canonical round-trip、重复键/额外字段/省略 null/非法 Unicode/unsafe/-0/ACK 数值序/uint64 边界拒绝 | 32 项纯协议测试；不证签名真实性或 Relay 路由 |
| 新 session owner 与固定 signer | 独立注册 ES256、私有 cookie/CSRF、六个固定用途签名、递归服务 receipt 验签、相同 nonce 原授权重构同 bytes、logout 并发失效 | 18 项 ContractOracle + 新客户端真实 login/verify/refresh/logout/time/facts；Oracle 不计真实 HTTP |
| 实时 session/CSRF/disabled/device | server 每次从 PG 核验；目标账号/设备按序锁于 family/token/clock/world 之前；并发 disable 阻止 epoch activation；logout family 失效 | 真实 HTTP/PG，非 context 快照；注册凭据不升级物理设备 |
| clock/status | production Node wall/monotonic + PG generation/floor；重启 floor/generation、签名状态；回退/drift/低于 floor latch、不造未来 | 真实 wall 与显式隔离注入分列，详见下节 |
| 002 与事务 | 18 表、PG17、advisory lock、001 原 SHA、002 checksum、并发 migrate/漂移拒绝、原结果同事务、tombstone 不重执行 | 实 PG；定稿 checksum 使用全新测试 DB，不修改已应用 ledger |
| world/root | 带外显式安装公开元组，真实 developer session + root/device 双签，坏 pin/摘要/key 用途拒绝 | 临时新开发世界；不宣称操作员既有内容世界的 pins/原文已就绪 |
| AccessCode 准入 | 六位字符串含前导零、CAS、一次 30s challenge、错误/消费重放统一拒绝、正确码自动产生 Observer | 实 HTTP/PG；没有 fixture/管理员 seed 成员；跨 world IP20/15min 预算及 restart 保留已测 |
| ECDH credential | 服务 fresh ECDH/secret32/HKDF/GCM/HMAC、真实私钥解封+tag+注册设备签名、session/device/generation/nonce/world 绑定；PG 只 public challenge/expectedTagSHA/消费事实 | 服务端真实实现 + 独立 Node crypto oracle；不声称 c-2d 平台群 key provider/包交付已实现 |
| epoch | root 签名、完整已证明凭据集合、Observer fact、CAS、成员撤销/重键、历史 epoch 读取权限 | 实 HTTP/PG；用于 c-2b 轻量元数据，无真实群 key 包 |
| 全局 sequence | 同账号两个真实注册 device 并发 1024 段、1h、互不重叠、restart 不回收 | 实 HTTP/PG；identity 跨 world/account 全局存储唯一，cursor schema 保持十进制 string |
| permit/admission | 30s 服务 AppendedAt、绑定原段/permit/key/epoch、registered claim/signature、全局 identity/digest、原 receipt、新 nonce wrapper/read、不存 envelope/body | 实 HTTP/PG；digest-only authority，不证正文 AEAD/三类变化本轮网络闭环 |
| seal | 服务计算 ordered prefix/count/hash；S-H 上界、CAS/旧 receipt、隔离非空 seal 与 EpochClosed/PermitExpired 优先级 | 生产仅空旧时间前缀；非空与时间到期在隔离 clock 中验 |
| HTTP 错误与边界 | 旧 Host/Origin/content-type 保持；CSRF/签名/nonce/schema/CanonicalInvalid/ResourceLimit/version 分类拒绝 | 未知 outer 安全整数版本 → 400 VersionUnsupported；字符串/缺字段仍 SchemaInvalid；非规范/重复键优先 CanonicalInvalid |
| 独立组合根 | 新 Builder 注入原纯 codec 和新真实 adapters；真实覆盖 15 authority + 1 b 兼容方法 | 11 项真实 HTTP/PG；root/Observer principal 用于 authority 协议，不等于 c-2e 双客户端 commit/Relay/replay 链 |

固定约束继续沿用：段 1024/3600000ms，permit/challenge 30000ms，epoch ≤256 凭据，response ≤1048576 bytes，18 操作独立 body limits，G=3600000/B=300000/U=60000/H=3960000/retention=86400000ms。一般 route-class rate 与旧 b 240/min/backend-IP 都保留；prototype 不承诺规模 SLA。AccessCode 5/account-world/15min、20/backend peer IP/15min、100/world/h 保持持久预算，不信任 XFF。

## 5. 生产 clock 与隔离 clock 的证据边界

server 最终 20 场景分为 18 个 HTTP+PG 场景（17 使用真实 wall，1 使用显式隔离 clock）及 2 个 PG 场景（迁移 1、隔离 clock 1）。不能把 20 全称为 production clock 验收。

隔离 HTTP 场景为 `isolated clock rollback latches durably: signed status null time and new facts forbidden, historical readable`：显式推进 wall/mono后验证非空 seal 的 1 项已准入前缀及摘要；旧 epoch 同时到期/已封边时先 EpochClosed，当前 epoch 则先 PermitExpired；到期 ECDH proof 拒绝；再回退 wall 验失信、null 时间、拒新事实与保留历史原 receipt。独立 clock 场景覆盖同毫秒不造未来、>2000ms drift、重启 latch、明确新 trust revision、低于 durable floor 拒绝。生产入口 shared-main 不接 env/HTTP fixture 时间。

新客户端 11 项真实 HTTP 使用 production clock，没有隔离 clock；seal 只包含空的过去前缀，并验证不能提前覆盖新 admission。没有实际等待 H 跨越后的生产非空结算证据；不将加速测试包装为现实经过 H。

## 6. 保护审计与安全边界

原始保护基线覆盖 7179 个非排除的既存文件，SHA256：`e7ddbe5b1c6ec3815dfcd044f4f8cefe2acef37dd16104e0ebc858102c96972e`。最终 `evidence/protected-final-audit.json` 为 PASS：7179→7251，旧文件无删除、唯一变化 IntentPort，未授权修改/新增=0；验证 prefix/suffix 规则及精确新文件名单。审计原有排除项包括 dependency/cache、私密配置/二进制、本轮新 evidence，不将其说成全磁盘 SHA 覆盖。未放宽源码目录 whitelist，不修改 c-1、旧 b 或 docs。新增命名机械清单排除 import/引用/旧源码，列完整声明与 source SHA；公开导出为 64 个，其中纯协议类型 37 个。

完整 code.diff 为 228732 字节，SHA256：`59f422eee4b2ea3a9984e0fbe6e0426b21ee539b9cf372ae6032490b1aafff9d`。定稿 002 SHA256：`8891dc04fc4c9c6aa35eabcfc2c3241176a6c6960fc9aef52edb1f4a288a2a59`。

最终公共交付一致性核对 45/45 PASS，见 `evidence/final-delivery-validation-corrected.json`。该核对器首次误把 client 契约结果的 `summary.passed` 当顶层 `passed`，形成的机械 FAIL 保留在 `evidence/final-delivery-validation.json`；修正只读元数据路径后通过，真实 18 项测试及 raw log 未修改。已知本机连接凭据/完整 private PEM 的文书复扫见 `evidence/shareable-complete-document-audit.json`，该扫描不声称任意秘密检测。

root 私 key、注册设备私 key、ECDH 私 key、运行时密码/CSRF/cookie/challenge secret/连接凭据均不进入交付日志/完整 diff；运行时 code/body 不记日志。测试源码中公开的试验六位码仅属于临时开发世界，不是用户或生产秘密。session nonce 缓存仅保存不可逆 payload hash 与第一次 authorization，供 caller 相同输入重构原字节。服务 code verifier 是独立高熵 pepper HMAC；authority 存轻量摘要/public receipt/注册绑定/消费事实。客户端与服务错误不会生成 signed final event，旧 c-1 校验/重放职责不转移到 authority。

测试 PG 使用本轮新建隔离 cluster，仅 127.0.0.1:55437；PG17.11 / Node24.19.0，应用角色无 superuser/createdb/createrole。初始化旧开发 002 校验和后，定稿改进使用全新 `c2b_authority_final`，不吞 checksum 漂移；客户端使用另一个 `c2b_client_authority`；旧 b 历史 DB 独立。私密连接只在 ACL 限当前操作员的 `evidence/runtime/.local`，不打印/导出。所有临时 HTTP listener 在 tests finally/after 关闭，PG停止后保留本轮数据与复现入口；旧数据库/服务不动。

## 7. 复现与操作员参与

从工程根执行三门禁保持旧脚本：

```powershell
npm run check:naming
npm run check:dependencies
npm run typecheck
node .\server\SharedBuild.mjs
node .\server\node_modules\typescript\bin\tsc -p .\server\tsconfig.shared.json --noEmit
```

本机 PG 启停与私密连接读取规则见 `evidence/runtime-reproduction.md`。server 测试 cwd 为 `server/`，先启动本轮 PG，再运行 `node --test shared-dist/test/shared-*.test.js`；真实 client 运行器为工程根 `node quality-review/b2-5c-2b/client-real-http.cjs`。运行前需 Node24/PG17 与私密测试连接就绪；不可把 connection JSON、环境秘密或用户密码写入命令输出。隔离 clock runner 只在测试使用。

独立真实入口从 `server/` cwd 运行 `node .\shared-dist\src\shared-main.js`；复用 b 原配置，另提供 SHARED_OPERATOR_PINS_PATH、SHARED_ACCESS_CODE_PEPPER、SHARED_CLOCK_TRUST_REVISION。pins 必须是操作员带外批准的 world/service/map/account/root/Genesis/manifest 公开元组；root只在独立 publisher 解锁内存。真实服务 PEM、DB URL、pepper 从私密配置给入，不能用测试 public tuple 冒充既有运营世界。局域网服务留 c-2f 受信 TLS edge，不允许裸 LAN HTTP。

## 8. 裁定、命名与遗留

本轮工程增量裁定见 `verdicts-441-447.md`，实现计划见 `implementation-plan.md`，独立复审见 `client-and-server-independent-review.md`。未重开 P7/P8/P9 或 12 项裁定，未修改 c-2a 文书。实现中发现的 schema/guard/worldId/idempotency/rate/lock/error-detail 问题均修至既有冻结契约；没有自行放宽 guard 或新增范围。

`namebook-v3.20-appendix-proposal.md` 按 A 已冻结 / B 候选 / C 排除 / D 延期列出；本轮新增正式 helper 名及完整机械命名清单交 Trae。v3.20 待 Trae 落盘，c-2b 交付待 PROTOCOL 审阅，不把本轮完成当作下阶段授权。

仍需后续授权与验收：c-2c Relay、c-2d 最小群 key package/acceptance producer、c-2e 完整独立双客户端重放、c-2f 真实 LAN HTTPS。正式内容 world 的公开 pins/Genesis/manifest、长期 root/账号秘密保护与恢复（P4）、原生 host/OfflineGrant/PhysicalDevice（P5）、账号 closure 生产者及产品 c-3 接线继续延期。当前无待回复的新 PROTOCOL 架构冲突。
