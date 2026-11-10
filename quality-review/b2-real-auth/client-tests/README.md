# B2.5b 客户端独立验收

2026-10-11（Asia/Shanghai）。本目录属于质量审查材料，不修改 docs、名库或参照文件。

运行（工程根，Node.js 24 LTS）：

```powershell
& 'C:\Program Files\nodejs\node.exe' quality-review/b2-real-auth/client-tests/run.cjs
& 'C:\Program Files\nodejs\node.exe' quality-review/b2-real-auth/client-tests/run.cjs --http
```

第一条运行 24 项契约/对抗检查。契约测试使用明确的测试传输与测试签名根，ES256、P1363、JCS、nonce、purpose、实例、严格 schema 检查仍全部执行。这些结果不冒充真实服务器证据。期限回归在真实 WebCrypto ES256 验签成功后推进测试单调时钟，确认签验阶段越过 12 秒仍会拒绝；没有跳过或伪造验签结果。

第二条先运行上述 24 项，再以服务器独立 server/ 包的 buildApp、真正 TCP loopback HTTP、真实 PostgreSQL 17 运行 6 项客户端检查。服务器包必须已构建且数据库已迁移。数据库连接只从 `B25_CONNECTION_FILE` 指定的私密 JSON，或隔离 runtime/.local/connection.json 读取；不输出到证据。新增唯一测试账号，不删除或重置数据库。测试服务器端口为 43126，finally 关闭该测试监听；PG 由 runtime 独立管理。

HTTP 测试用 1500ms access TTL，使实际 access 到期→verify 拒绝→仍有效的 refresh family 验证→刷新→verify 成功可执行。生产默认 access TTL 仍为 15 分钟。本机 HTTP 测试显式注入 cookie jar 与 Origin；浏览器真实传输为 credentials include、同 origin POST、exact Origin + CSRF。测试注入不跳过任何客户端签验规则。

结果：results-contract.json 为 24 项 PASS；results-contract-and-http.json 为 30 项 PASS；http-requests.json 仅保留方法、路径与状态，无账号密码、Cookie、CSRF、私钥或数据库连接。类型检查：工程根 `node node_modules/typescript/bin/tsc --noEmit` PASS（ES2015 target）。

## 本轮客户端接线与局限

新增 `src/director/RealServiceContracts.ts`（纯类型）、`src/presentation/RealAuthServiceAdapter.ts`（HTTP/WebCrypto）、`assets/scripts/RealServiceBuilder.ts`（显式独立组合根）。IntentPort 仅追加 type-only 导出。未将真实适配自动挂入 Creator 玩法/UI 主链，未修改既有 fixture、guard、同步 archive 接口或存储域。

组合根必须由可信安装配置提供固定 origin、serviceInstanceId、公钥与 RFC7638 指纹。客户端不从 /service/keys 自动建立信任。服务失败始终报告拒绝，mode 保持 ExternalService。fetchServerTime 只返回通过 nonce、purpose、实例、公钥签名、clockStatus Trusted 与采样往返限制的服务毫秒，失败不使用本地挂钟。

浏览器设备私钥为 nonextractable P-256 CryptoKey，仅存活于当前适配器内存。注册凭据证明密钥控制，不证明物理设备；无 OfflineGrant、PhysicalDevice 或应用运行时长降级。页面重载后必须重新密码登录并注册新凭据，不能仅靠遗留 HttpOnly Cookie 自动恢复没有内存 CSRF/私钥的新适配器。当前实例登出后可复用尚在内存的凭据。最多保留 16 个账号的内存凭据，服务端最多 256 项设备事实；可用的持久凭据管理/撤销 UI 留待后续阶段。

Access 到期导致当前操作 Rejected；只保留内存绑定与 CSRF 供服务器验证 refresh，缓存无公开准入 getter。refresh 被拒绝、设备不可信、非法响应、Forbidden 或登出结束均关闭本地认证缓存。登出期间独占锁拒绝新调用，服务器登出失败也会清本地缓存，并报告未确认远端撤销。

AccountFacts 仅含账号标识、RegisteredCredential 设备清单与 revision 0；拒绝任何 core、Ledger、通关/CopyPermission 写入字段。RealWorldAuthorityPort 与泛型 RealCommitRelayPort 本轮只有增量契约边界，无世界迁移、暂停、Relay 或共享 codec 实现。

## 新增公开名称

已实施契约/客户端名称：RealServiceMode、RegisteredDeviceAssurance、ServicePublicKey、AuthorityTrustAnchor、RealServiceEnvironment、RealAccountFact、RealRegisteredDeviceFact、AuthenticatedServiceContext、AccountLoginRequest、ServiceFault、ServiceReply、ServiceReceiptPurpose、SignedServiceReceipt、DeviceChallenge、ServiceAuthenticationPayload、ServerTimeSample、RealAccountFacts、RealAuthServicePort、RealAuthServiceAdapter、buildRealAuthService。

已冻结增量边界但机制仍待补冻：RealWorldAuthorityPort、RealCommitRelayPort。后者泛型参数不宣称已定义 WorldCommit 正文，也不将 NarrativeEvent 或七项 Core 变为共享提交。
