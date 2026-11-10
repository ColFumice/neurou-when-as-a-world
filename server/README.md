# B2.5b 独立真实账号服务

Node.js 24 LTS、Fastify 5、PostgreSQL 17。只提供账号认证、RegisteredCredential 设备登记、轻量事实、服务签名时间。没有 Relay、世界状态、迁移载荷、FileCarry、OfflineGrant、物理设备或通关权限 API。此包不依赖 Creator、archive 或客户端核心。

## 本机运行

1. 安装 Node 24 和 PostgreSQL 17；也可在本目录执行 `docker compose up -d postgres` 启动持久数据库（须先私密设置 POSTGRES_ADMIN_PASSWORD）。Docker 只承担数据库，Node 服务在宿主机运行。
2. 使用数据库管理员创建独立非超级用户应用角色并授予本数据库 schema CREATE/USAGE 与建表权限；连接必须指向本项目专用数据库，不复用游戏 fixture 数据。数据库要求 SCRAM-SHA-256；管理员密码不可当应用密码。
3. Windows 执行 `./initialize-private-directory.ps1`，再把配置保存在 `.local` 受限目录或当前进程环境；Linux/macOS 使用当前用户私有目录权限 0700 和文件权限 0600。Node 的 mode 0600 在 Windows 上不替代 ACL。
4. `npm ci`、`npm run build`，按 `.env.example` 设置 DATABASE_URL 等环境变量。可选 `.env` 自动读取；若使用该文件，操作者需保护其 ACL。生产凭据、签名私钥不入源码、日志或报告。
5. `npm run migrate` 创建版本 1 schema。迁移使用 advisory lock、单事务、只追加表/索引/版本，不删既有数据。
6. 将随机强密码放入当前进程 ACCOUNT_PASSWORD，再执行 `npm run account-create -- <accountName>`。密码不放命令行、不输出；客户端不允许自建权限或注入 fixture 事实。账号名逐字区分大小写，3～64 位 `[A-Za-z0-9_.-]`；密码12～1024字符且无控制字符。
7. `npm run trust-anchor` 在本机带外导出公钥配置，核对实例与 RFC7638 SHA-256 base64url 指纹后写入客户端可信安装配置。`/service/keys` 是诊断展示，不能自动成为信任根。私钥首次生成后持久复用；丢失私钥须带外重新引导，不让客户端接受任意自签公钥。
8. 确认 OS 同步健康后显式设置 CLOCK_TRUSTED=true，执行 `npm start`。默认时钟未被信任，`/health/ready` 返回503，时间样本声明 Untrusted。进程监测墙钟与单调时差>2秒或倒退并永久降级；重新确认后重启获得新的持久 clockGeneration。它不证明 NTP可信或暂停期经过。

服务仅监听127.0.0.1；HTTP是开发例外。Host和浏览器 POST Origin 必须精确等于 SERVICE_ORIGIN。无 CORS、无反向代理信任、无公网部署；LAN双设备需后续HTTPS部署与证书/域名配置，本轮没有宣称外部验收。客户端资源必须由同 origin 的可信宿主提供；开发时先用 Node HTTP契约验收，不能靠关闭Origin检查接跨域Creator。

## 固定 wire

所有 POST 为严格 JSON：拒绝未知字段、重复键、非安全整数、无效Unicode、深度>32、正文>16KiB。requestNonce是32-byte canonical base64url(43字符)，ID为小写UUID，签名为64-byte P1363 canonical base64url(86字符)。设备公钥只有 `{kty:'EC',crv:'P-256',x,y}`，拒绝私钥/其他字段；标签1～128字符、无控制字符。设备上限256/账号。

| 路径 | 输入/资格 | 签名 purpose |
|---|---|---|
| POST `/api/v1/device/challenge` | `{purpose:'LoginDevice',accountName,publicKeyJwk,deviceId:null或既有ID,requestNonce}`；注册新设备时purpose RegisterDevice，deviceId null且需会话+CSRF | DeviceChallenge |
| POST `/api/v1/auth/login` | `{accountName,password,challengeId,signatureBase64Url,deviceLabel,requestNonce}`，密码+一次设备proof | Authentication |
| POST `/api/v1/auth/verify` | `{requestNonce}`，会话+CSRF | Authentication |
| POST `/api/v1/auth/refresh` | `{requestNonce}`，refresh cookie+CSRF | Authentication |
| POST `/api/v1/auth/logout` | `{requestNonce}`，refresh cookie+CSRF | Logout |
| POST `/api/v1/time` | `{requestNonce}`，会话+CSRF | ServerTime |
| POST `/api/v1/account/facts` | `{requestNonce}`，会话+CSRF | AccountFacts |
| POST `/api/v1/device/register` | `{challengeId,signatureBase64Url,deviceLabel,requestId,requestNonce}`，会话+CSRF | DeviceFacts |

精确结构见 `src/contracts.ts`。SignedServiceReceipt正文签名为 `UTF8("Neurou/service/v1\0") || UTF8(JCS(除signatureBase64Url外全部receipt))`；设备proof为 `UTF8("Neurou/device/v1\0") || UTF8(JCS(DeviceChallenge))`。签名均P256/SHA256/ES256-P1363。challenge绑定服务、账号、公钥指纹、设备世代、用途、一次随机nonce和30秒绝对截止；登录成功事务消费，失败不生成会话。首次密码+proof可登记同账号新凭据；已有/撤销同fingerprint不能恢复更高可信度。RegisteredCredential只证明注册密钥持有，不证明物理机唯一。

账号facts仅identity和devices，revision固定0为B2.5b最小schema标记；没有授予玩法或归属权限。额外设备写口只登记RegisteredCredential；设备改标签/撤销API、恢复、OAuth、密码重置留后续。注册requestId按账号幂等，精确规范请求摘要不同返回Conflict；幂等重试必须使用相同完整请求字节数据（含nonce）。

成功响应为原始signed receipt。失败为 `{kind:'Rejected',fault:{code,requestId,retryAfterMs}}`，不披露数据库/密码/堆栈。登录/challenge按IP合计30次/分钟，其余240次/分钟；单进程开发配额，不宣称分布式限流。会话cookie为HttpOnly/SameSite=Strict，开发HTTP不设Secure；access15分钟、refresh家族7天绝对TTL，DB仅存随机token和CSRF的SHA256。刷新事务统一 account→device→family→token 锁顺序，旋转后旧token复用提交family撤销，再返回拒绝。客户端需串行refresh；合法并发两次刷新也会触发复用撤销。登出撤销服务family，不删除本地世界、不解除暂停。

## 验证

`B25B_DATABASE_URL`指向独立PostgreSQL17库后执行 `npm test`。测试创建唯一账号而不DROP/TRUNCATE/重置库，不提供内存替身；通过真实TCP HTTP监听验证账号、设备proof、严格JSON、CSRF/Host/Origin、签名、DB摘要存储、刷新旋转/复用/并发、服务重启持久会话、固定绝对TTL、登出与未可信时钟拒绝健康声明。测试账号留在专用验收数据库；数据库备份/留存清理由操作者决定，不自动删除用户数据。
