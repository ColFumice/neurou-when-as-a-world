# B2.5b 真实契约与安全模型

2026-10-11（Asia/Shanghai），依据376～390。实施边界为本机HTTP loopback真实认证、签名时间和轻量账号/设备事实。完整共享、文件加密、原生设备/OfflineGrace仍待c/d/e补冻。

## 端口与接线

纯数据定义在src/director/RealServiceContracts.ts，由IntentPort追加type-only导出。presentation的RealAuthServiceAdapter与assets的buildRealAuthService组成独立ExternalService链。旧同步服务和B2.4组合根不改，没有失败切ContractAdapter；没有产品登录UI或Creator场景接入声明。

```ts
interface RealAuthServicePort {
  readonly mode: 'ExternalService';
  login(request: AccountLoginRequest): Promise<ServiceReply<AuthenticatedServiceContext>>;
  logout(): Promise<ServiceReply<{ readonly serverRevoked: true }>>;
  verify(): Promise<ServiceReply<AuthenticatedServiceContext>>;
  refresh(): Promise<ServiceReply<AuthenticatedServiceContext>>;
  fetchServerTime(): Promise<number>;
  readServerTime(): Promise<ServiceReply<SignedServiceReceipt<ServerTimeSample>>>;
  readAccountFacts(): Promise<ServiceReply<SignedServiceReceipt<RealAccountFacts>>>;
}
```

ServiceReply为Accepted/value或Rejected/fault；客户端code为Unauthenticated、DeviceUntrusted、AuthorityUnavailable、TimeUntrusted、VersionUnsupported、Conflict、RateLimited、InvalidData、Forbidden。服务器当前schema1无VersionUnsupported路由分支。故障不是离线授权；fetchServerTime拒绝Promise，不以Date.now、performance.now或fixture填补。

RealWorldAuthorityPort只保留context及轻量readAccountFacts接口，RealCommitRelayPort只保留泛型异步relay接口，都没有机制实现。这个保留不冻结WorldCommit正文或迁移完整结构。

## HTTP schema 1

全部业务接口POST JSON，精确Host/Origin匹配；无跨源CORS。客户端与/api必须同源，服务目前没有静态游戏资产托管，独立adapter实测使用仅loopback cookie-jar transport。缺字段、多字段、重复键、unsafe整数、畸形Unicode被严格验证；adapter还拒绝负数/负零的整数响应字段。请求上限16KiB，adapter响应上限1MiB、deadline12秒、重定向拒绝。

| 路径 | 请求精确字段 | 成功签名payload/用途 |
|---|---|---|
| /api/v1/device/challenge | purpose、accountName、publicKeyJwk、deviceId、requestNonce | DeviceChallenge；purpose为LoginDevice或RegisterDevice |
| /api/v1/auth/login | accountName、password、challengeId、signatureBase64Url、deviceLabel、requestNonce | Authentication：requestNonce/sessionId/csrfToken/account/device/expiresAtServerEpochMs |
| /api/v1/auth/verify | requestNonce | 同Authentication |
| /api/v1/auth/refresh | requestNonce | 同Authentication并旋转两枚cookie |
| /api/v1/auth/logout | requestNonce | Logout：requestNonce/sessionId/revoked=true |
| /api/v1/time | requestNonce | ServerTime：requestNonce/serverEpochMs/clockGeneration/clockStatus |
| /api/v1/account/facts | requestNonce | AccountFacts：requestNonce/account/devices/revision=0 |
| /api/v1/device/register | challengeId、signatureBase64Url、deviceLabel、requestId、requestNonce | DeviceFacts：requestNonce/device |

verify/refresh/logout/time/facts/register及RegisterDevice challenge需要HttpOnly会话cookie和X-CSRF-Token。首次login/challenge用密码与新注册公钥持有证明，deviceId=null；既有设备登录带服务签发ID并核对账号/公钥/世代。device register需现有已认证会话，challenge绑定owner session；不是跨设备迁移协议。register按accountId/requestId幂等，摘要包含**全部请求字段及requestNonce**，重试需重用完整原请求；改nonce或label即Conflict。

account只有accountId/accountName；device只有deviceId/generation/keyFingerprint/assurance/label/status。服务生成UUID，generation初始1，assurance唯一RegisteredCredential，每账号最多256设备。标签仅注册时写入。本轮没有标签更新、凭据撤销/轮换、密码重置、OAuth、自助注册、通关事实或world归属API。revision=0是保留字段，不作元数据CAS或游戏revision。

GET /health/ready无Origin要求但仍检查Host、DB及clock状态；Untrusted返回503。GET /api/v1/service/keys需要精确Origin，只展示公开诊断，**不得用作首次信任引导**。没有Relay/FileCarry/readMigrationPayload/OfflineGrant接口。

## 签名与时间

SignedServiceReceipt精确外层为schemaVersion=1、serviceInstanceId、purpose、receiptId、keyId、issuedAtServerEpochMs、payload、signatureBase64Url。所有成功receipt使用P-256 ECDSA SHA-256，签名为64字节IEEE-P1363后base64url无填充，DER不接受。签名字节如下，NUL表示实际0x00；canonical是递归按键序排序的JSON子集，仅数据对象/数组、标量、安全整数。

```text
service: UTF8("Neurou/service/v1" + NUL + canonical(unsignedReceipt))
device:  UTF8("Neurou/device/v1"  + NUL + canonical(DeviceChallenge))
```

requestNonce为32字节CSPRNG base64url，绑定各receipt payload。DeviceChallenge另有32字节服务nonce、30秒到期、一次消费、purpose/账号/公钥指纹/设备ID与世代/实例/请求nonce。keyFingerprint与信任锚jwkSha256为RFC7638四字段JWK的SHA256 base64url；本轮keyId等于此指纹。配置带外安装实例、origin、keyId/JWK/指纹；adapter复制冻结配置、验指纹/公钥/签名/用途/schema/nonce/身份。不相信响应携带的新key，自动轮换/恢复尚未实现，换服务key需显式带外更新pin。

服务以Date.now产生epochMs，启动从PG sequence取得clockGeneration；CLOCK_TRUSTED=true是运维对系统授时状态的明确断言。默认Untrusted。wall与monotonic增量差超过2秒或墙钟倒退则本实例永久Untrusted。**这不验证NTP源或绝对UTC准确度**。性能时钟仅监测跳变/请求时限，不作为服务时间回填或设备uptime。time可以签名Untrusted，客户端必须拒绝；Trusted epochMs必须与receipt issuedAt一致且为安全整数。fresh nonce及12秒期限限制响应重放/延迟，但不能证明设备开机时间，不签发OfflineGrant，不结束RealityPause。

## 凭据、会话与故障

账号仅管理员CLI显式建立；Argon2id内存64MiB/t3/p1/32字节输出，密码12～1024字符且无控制字符。不存在默认fixture/生产账号。测试账号用随机名称/密码，仅本轮专用DB。服务只保存密码hash，随机256bit访问/刷新token的SHA256摘要及CSRF摘要，cookie HttpOnly/SameSite=Strict/path=/，loopback开发Secure=false。访问寿命15分钟，刷新家族7日绝对寿命，不因refresh延长；刷新单次旋转，重用旧refresh在事务中持久撤销整个家族后返回401，并发只允许一次成功。已开始请求不能因后续撤销追溯为未发生，本轮没有世界写入。

adapter每账号P-256私钥non-exportable且只在内存，最多16个账号凭据；CSRF、会话上下文也只内存，无localStorage密码/token/key。每次已绑定会话的业务操作访问真实服务，context快照不是离线准入。access过期verify返回Rejected，保留仅用于下一次服务refresh的内存家族材料；refresh/login返回Unauthenticated及InvalidData/DeviceUntrusted/Forbidden/VersionUnsupported关闭上下文，网络故障仍返回拒绝。logout无论远端成败均清本地会话/CSRF，设备私钥可在同adapter内存复用，失败明确Rejected，不声称serverRevoked。adapter禁止并发调用，返回Conflict；不自动重试旋转refresh，响应丢失需重新登录。重载页面没有持久device key/CSRF恢复，需重新登录并注册凭据；deviceId不能当跨安装稳定机器ID。

密码首次发往loopback HTTP。安全保证以本机OS/运行账号、安装pin和服务进程可信为前提；抵御网络字段伪造、跨源请求、签名篡改、挑战重用、refresh重用。**不抵御同源XSS、可执行同用户代码、管理员/服务DB控制、私钥提取能力或本机HTTP窃听**。RegisteredCredential只证明注册密钥持有，不是硬件/PhysicalDevice或WebAuthn attestation。真实外部网络必须另做HTTPS/Secure/TLS和部署验收，b拒绝非loopback监听。

## 存储与运维边界

PG17事务存账号/公钥注册/会话摘要/一次challenge/轻量幂等receipt，七个轻量表加clock sequence；没有world日志、checkpoint、文件、媒体、七项Core、个人向量或共享状态表。公开JWK与challenge不是个人世界payload。token/challenge保留清理、账号恢复、设备管理、服务key轮换、生产运维均列后续待办；本机开发限流敏感30/min和其他240/min，不宣称生产DoS保证。

独立server/使用Node24/Fastify5/PG17和独立package-lock，不进入Cocos编译树，不恢复archive/service/sync。私密连接、DB data、service signing key置受限.local目录，禁止进入代码diff/日志；运维管理员仍属于信任边界。来源及精确PG版本见evidence/runtime-provenance.json。本轮不需申请云账号；后续外部HTTPS需用户提供域名/主机与密钥备份负责人，再单独验收。
