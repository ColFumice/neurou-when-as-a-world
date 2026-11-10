# B2.4a 契约草案 · 只供审阅

这些 TypeScript 片段是接口/数据结构候选，未创建 `.ts` 文件，未加入编译与运行装配，未提供任何方法实现。所有新增字段/方法须在 P1～P4 解冻后逐字落名库，不能凭本文启动实现。数值均为非负安全整数（除已有领域另有规定），ID 使用现有长度/可编码约束，所有边界拒绝未知版本、未知字段、访问器、异原型、循环、稀疏数组和身份/内容引用错误，失败保留原字节。

## 1. 登记与检测

```ts
type HomeState = 'Homed' | 'Released'; // 历史取值；没有 Pausing

interface WorldHomeRecord {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly homeState: HomeState;
  readonly homeDeviceId: string | null;
  readonly homeRevision: number; // 服务单调归属版本；不是 Core.revision
  readonly updatedAtServerEpochMs: number;
}

interface WorldHomeRegistrySnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly observedAtServerEpochMs: number;
  readonly records: readonly WorldHomeRecord[];
}

interface WorldRegistrySnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly deviceId: string;
  readonly records: readonly {
    readonly worldId: string;
    readonly registeredLocationId: string;
  }[];
}

type CrossDeviceDuplicateResult =
  | { readonly kind: 'Homed'; readonly home: WorldHomeRecord }
  | { readonly kind: 'CrossDeviceDuplicate'; readonly home: WorldHomeRecord }
  | { readonly kind: 'Migrated'; readonly home: WorldHomeRecord;
      readonly migrationId: string }
  | { readonly kind: 'Released'; readonly home: WorldHomeRecord }
  | { readonly kind: 'AuthorityUnavailable'; readonly detail: string }
  | { readonly kind: 'UnsupportedBoundary'; readonly detail: string };
```

约束：Homed 必须有合法 homeDeviceId，Released 必须为 null；每账号世界唯一，homeRevision 由服务比较交换更新，不能由客户端自增变成授权。快照是已验证服务响应的本地缓存，普通 JSON 不带信任。LocationId 是本机载体句柄，不上传本机路径；实际文件系统/虚拟载体 API 与本地登记 key 未冻结。P1 关闭前 InitialWorld 返回 UnsupportedBoundary，不能未经批准将其登记到 global key；是否允许这一有限范围也须 P1 决定。

检测输入是经认证的 accountId/deviceId 与可信世界身份，不是 UI 提供的权限值。Homed 分支还要核对当前设备、账号暂停及有效运行资格；CrossDeviceDuplicate 结果只说明后续走 DuplicateWorld 处理，尚未分叉成功。Migrated 必须有服务迁移历史对本设备原归属的撤销证明，不能只依据 HomeDevice!=self 推出；该证据载体与接口待 P3。Migrated 原设备拒载并保留文件，不自动进入复制分叉。Released 必须在线 Claim，不能自由加载。

## 2. 暂停、设备绑定与离线时间（P2 受阻草案）

```ts
interface RealityPauseRecord {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly migrationId: string;
  readonly initiatingDeviceId: string;
  readonly startedAtServerEpochMs: number;
  readonly resumeNotBeforeServerEpochMs: number;
  readonly endedAtServerEpochMs: number | null;
}

interface DeviceAccountBinding {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly boundAccountId: string;
  readonly migrationId: string;
  readonly pause: RealityPauseRecord;
}

interface DeviceUptimeSample {
  readonly bootId: string;
  readonly uptimeMs: number;
}

interface DeviceUptimePort {
  readUptime(): DeviceUptimeSample;
}

interface OfflineGrant {
  readonly accountId: string;
  readonly deviceId: string;
  readonly bootId: string;
  readonly contactedAtUptimeMs: number;
  readonly contactedAtServerEpochMs: number;
  readonly graceDurationMs: number;
  readonly homeRevisions: readonly {
    readonly worldId: string;
    readonly homeRevision: number;
  }[];
  readonly authorizationId: string;
}

interface AccountBindingPort {
  readDeviceAccountBinding(): Promise<DeviceAccountBinding | null>;
}
```

`resumeNotBefore` 只是最早解冻时刻；只有服务确认结束且发布 Released 才能 Claim。endedAt=null 不论客户端倒计时是否归零都按活动暂停处理。时长≥一小时且≥OfflineGrace；不能用较晚本地时间做结束判据。发起设备的绑定需服务验证才能清除，UI/本地删除不解除。

OfflineGrant 是经认证服务确认及本机可信时间绑定后的资格候选，不是可由 JSON 自行创建的权限。实际签名/认证、不可伪造品牌或验签 receipt、跨休眠含义、bootId 来源、资格撤销与 safe-point 排空仍待 P2，**此结构不构成可实施的安全证明**。同一 bootId 内本机离线预算概念为 `uptimeNow-contactedAtUptime >= graceDuration`；负差、bootId 变化或缺可信时钟均不能续期。不得把网络失败算成功，也不得把应用/会话时间当设备运行时长。

SafePoint 不是仅 `chart.isActive=false` 的 UI 布尔值。候选判据包括：无活动谱面/结局/未终结揭示、无未稳定世界事实、同步 Core 已完成、被 lease.retainUntil 保留的账号提交已结算、没有尚未恢复的发布事务。最终集合与正在演奏到期如何落盘由 P2 裁定；不能在本轮新增“强制结束谱面”的机制。

## 3. 服务能力（与旧骨架分开）

```ts
// 历史签名保持，原文件留在 archive，不恢复到生产树。
interface AuthService {
  login(): void;
  logout(): void;
  verify(): boolean;
  fetchServerTime(): Promise<number>;
}

// 新增候选端口，不静默改旧 login/logout/verify 的同步签名。
// account/device 来自组合根已认证会话，不允许玩家指定。
interface CrossDeviceAuthorityPort {
  readonly mode: 'ContractAdapter' | 'ExternalService';
  readWorldHome(worldId: string): Promise<WorldHomeRecord | null>;
  readWorldAdmission(worldId: string): Promise<CrossDeviceDuplicateResult>;
  registerWorldHome(request: {
    readonly worldId: string;
    readonly registrationId: string;
  }): Promise<WorldHomeRecord>;
  readRealityPause(): Promise<RealityPauseRecord | null>;
  migrationRelease(request: MigrationReleaseRequest): Promise<MigrationReceipt>;
  readMigration(migrationId: string): Promise<MigrationReceipt>;
  migrationClaim(request: MigrationClaimRequest): Promise<MigrationReceipt>;
}

// 保留旧语义：迁移不经过 relay，也不新增 WorldCommit。
interface CommitRelay {
  relay(commit: WorldCommit): void;
}

// 异步失败反馈如后续需要另设新端口，不能改 relay:void 假称兼容。
interface CrossDeviceCommitRelayPort<TWorldCommit> {
  relayCommit(commit: TWorldCommit): Promise<void>;
}
```

fetchServerTime 返回服务器 epochMs 的非负安全整数；失败 Promise 拒绝，绝不 Date.now 降级。它只提供时间，不能单独完成登录、归属、暂停或认证。read/register 的结果必须经过服务身份/版本验证；并发首次登记只有一个设备成功，重复 registrationId 返回同一结果，另一设备不得覆盖。P1 的不可变来源证明未解决前上述 register 请求还不完整，不能投入实现。

测试适配器是两个逻辑设备共享的一个权威实例，有可控服务时钟、版本 CAS 和故障注入；本机 cache 与设备存储分别隔离。测试快进服务一小时必须标为契约时间，不能当用户经历了一小时或真实外部服务验证。真实模式需要后续认证/传输/部署契约。旧 verify:boolean 未承载身份/凭据结构，不能用其 true 当作强认证证明。

AuthService 保存轻量账号事实和归属/暂停；同步 WorldClearRecord、FirstWorldCleared 的验证归属和防降级仍沿用旧算法，不能通过 FileCarry 授予 CopyPermission。CommitRelay 的 WorldCommit 在片段中是对历史类型名的不透明引用，仍缺完整生产载体；旧接口不是泛型接口。它不是 FileCarry 的传输/存储服务；本轮不部署中继或新增共享合并算法。

## 4. 文件携带（P4 受阻，保留分层）

```ts
// 三个泛型是尚未冻结的生产载体/codec 输出，不是 {}、any 或空数组。
// 未获得真实合法来源，不能创建合法 FileCarryPayload。
interface FileCarryPayload<WorldChangeLog, WorldCheckpoint, PersonalData> {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly senderAccountId: string;
  readonly sharedLayer: {
    readonly WorldChangeLog: WorldChangeLog;
    readonly WorldCheckpoint: WorldCheckpoint;
  };
  readonly personalLayer: FileCarryPersonalLayer<PersonalData>;
}

interface FileCarryPersonalLayer<PersonalData> {
  readonly accountId: string;
  readonly data: PersonalData;
  readonly artifacts: readonly FileCarryArtifact[];
}

interface FileCarryArtifact {
  readonly artifactId: string;
  readonly contentSha256: string;
  readonly byteLength: number;
  readonly mediaType: string;
}

interface EncryptedPersonalLayer {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly keyId: string;
  readonly cipherSuite: string;
  readonly nonceBase64: string;
  readonly ciphertextBase64: string;
  readonly authenticationTagBase64: string;
}

interface FileCarryEnvelope<WorldChangeLog, WorldCheckpoint> {
  readonly schemaVersion: 1;
  readonly kind: 'FileCarry';
  readonly worldId: string;
  readonly senderAccountId: string;
  readonly sharedLayer: {
    readonly WorldChangeLog: WorldChangeLog;
    readonly WorldCheckpoint: WorldCheckpoint;
  };
  readonly encryptedPersonalLayer: EncryptedPersonalLayer;
}

interface FileCarryCodecPort<WorldChangeLog, WorldCheckpoint, PersonalData> {
  decodeAndAuthenticate(envelope: unknown):
    Promise<FileCarryEnvelope<WorldChangeLog, WorldCheckpoint>>;
  decryptOwnPersonalLayer(envelope: FileCarryEnvelope<WorldChangeLog, WorldCheckpoint>):
    Promise<FileCarryPersonalLayer<PersonalData>>;
  encodeAndEncrypt(payload: FileCarryPayload<WorldChangeLog, WorldCheckpoint, PersonalData>):
    Promise<FileCarryEnvelope<WorldChangeLog, WorldCheckpoint>>;
}
```

约束：personalLayer.accountId==senderAccountId；不携别人的个人层。sharedLayer 可由其他账号接收者读取/认证，个人层及媒体字节独立按发送者账号加密；跨账号读取只得到原样个人密文，不能调用 decryptOwnPersonalLayer 获得他人数据。再次转发时保留合法共享层、移除原发送者密文、加入当前发送者本人加密层，不需要解密原发送者。encodeAndEncrypt 只加密个人层，不把共享层封入仅原发送者可读的整包密文。

加密依账号密钥，禁止裸账号字符串当 key，也不从世界文件获得账号权限。cipherSuite 不是任意可用字符串：待 P4 选定认证加密 suite、密钥来源/恢复/轮换、nonce 与 AAD 绑定、共享外壳认证、字节格式和大小限制，未选定前不接受算法。artifact 描述及其媒体内容全部属于个人层加密范围，不能只加密指针却泄露媒体字节；不用远端 URL 当已完整媒体。具体媒体类别、存储与内容字节载体待冻结。

七项 Core 跨越个人状态与世界元数据的既有归属，不把全部 Core 值强行放个人层。FileCarry 导入 codec 必须依据共享/个人来源组装 data-only Core，由当前正式 WorldStateCodec.parseComplete 和内容绑定器重新生成本机 WorldStateSnapshot 品牌。FormatTime/WorldLink 等所有权不改变，缺共享层或任一个必需个人载体不能 Complete。该归属组装表与全量载体 codec 是 P4 的待交付清单，本草案未定义它们。

若 PROTOCOL 选择受限 Core 原型，可在独立契约中携序列化 WorldCoreStateSnapshot，但必须另名且明确不完整；本轮不冻结该替代品，以免把它又认成 FileCarryPayload。

## 5. 迁移请求、权威 receipt 与本机 journal（P2/P3/P4 受阻）

```ts
interface MigrationReleaseRequest {
  readonly migrationId: string;
  readonly worldId: string;
  readonly expectedHomeRevision: number;
}

interface MigrationClaimRequest {
  readonly migrationId: string;
  readonly worldId: string;
  readonly expectedHomeRevision: number;
}

type MigrationReceipt =
  | { readonly schemaVersion: 1; readonly migrationId: string;
      readonly kind: 'PauseActive'; readonly home: WorldHomeRecord;
      readonly pause: RealityPauseRecord }
  | { readonly schemaVersion: 1; readonly migrationId: string;
      readonly kind: 'Released'; readonly home: WorldHomeRecord;
      readonly pause: RealityPauseRecord }
  | { readonly schemaVersion: 1; readonly migrationId: string;
      readonly kind: 'Claimed'; readonly home: WorldHomeRecord;
      readonly claimedAtServerEpochMs: number };

interface WorldMigrationJournal {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly deviceId: string;
  readonly migrationId: string;
  readonly worldId: string;
  readonly payloadDigest: string;
  readonly receipt: MigrationReceipt | null;
  readonly phase:
    | 'Prepared' | 'PauseActive' | 'Released'
    | 'Claimed' | 'LocalPublished' | 'CleanupPending';
}

interface CrossDeviceImportRequest {
  readonly importId: string;
  readonly envelope: unknown; // 外部不可信原值，由 codec 严格认证
}
```

世界 ID/账号/设备从经认证的文件和会话交叉核对，不允许玩家填写向量、权限、成绩、目标新世界 ID、homeRevision 或已验证 receipt。Release 不要求原 HomeDevice 发起，但仍要求同账号授权与已知权威世界记录；离线失败不能本地生成 PauseActive/Released。Claim 与同一 release 绑定、只能成功认领一次；重复同一身份/idempotency 返回相同 receipt，不能后一次无条件夺走前一次归属。暂停未权威结束、无合法完整载荷、目标冲突一律不能打开。

上面 journal 尚缺完整载荷本机暂存句柄、精确预期目录值/目标原字节、认领恢复判据、receipt 验证证明与清理规则，故是结构草案而非可恢复实现。永久世界不新增此头，不改 Core.schemaVersion，不在七项里放迁移日志，不以重新认证改变 source bytes。具体传输摘要是否上传、服务 receipt 如何绑定目标载荷也待 P3/P4；不能把个人层上传 AuthService。

状态顺序候选为 Prepared→服务 PauseActive（HomeState=Homed）→服务 Released→服务 Claimed（新 HomeDevice/Homed）→目标本机目录追加 LocalPublished→cleanup。任意崩溃先恢复/核对相同 migrationId、同 ID、摘要和服务结果；没有完整协议前不能自行为其中一步回滚。源文件始终保留；目标目录已有记录/墓碑的迁回属于 P3，当前推荐拒绝而非覆盖。

跨设备复制的新 UUID 也有服务 registerWorldHome 与本地目录发布两个存储域。候选顺序是：独立导入事务持久化目标 UUID/完整候选/registrationId/预期目录→服务幂等登记→本机严格回读/目录追加发布→清理。登记成功、本机失败保留事务按同 registrationId 恢复；本地已发布但缺目标 HomeDevice 权威证明不得打开。该独立导入 journal/key 与恢复算法尚待 P3，不能混用迁移 key 或 B2.3 fork 日志，不因新目标产生而暗改旧提交器。

## 6. 锁与模块放置

纯逻辑数据/验证/状态准备建议继续放 director，所有时钟、UUID、存储、Web Locks、密码能力和网络通过组合根注入；无 cc/DOM/Storage 直接调用。presentation 实现平台适配时只通过 IntentPort 的 type-only 窄边获取契约，assets/scripts 负责装配，既有依赖矩阵不扩方向，不恢复 archive 的 service/sync 模块。

本地候选：所需世界 lease→账号跨设备协调锁→目录锁，目录锁最后且回调只做同步本地提交；网络在目录锁外执行，重新取得锁后重验 expected 状态。跨设备不取得另一设备 Web Lock。旧 B2.3 源→新目标→目录保持，旧账号通关/lease.retainUntil 不改。

`neurou-cross-device:<encodeURIComponent(accountId)>` 是可选协调锁名，尚待 P2/P3；三条新存储前缀见 VERDICT-297。新 journal 与 fork pending guard 的互斥/恢复顺序须正式冻结，不能持账号锁后等待一个已被正常运行持有的世界 lease，也不能绕开已有未恢复 fork 日志。

## 7. 无服务/缺能力结果

| 情况 | 候选行为 |
|---|---|
| AuthService 时间/归属不可用 | 不伪造服务时间、不新登记/认领/解冻；保留事务，展示 AuthorityUnavailable |
| 设备时钟/bootId 不可信 | 不授予或续离线宽限；未来离线写入拒绝；当前基线不因本轮改动 |
| 文件七项/共享层/媒体不完整 | 不以来源缓存补数据，Incomplete/UnsupportedBoundary，保留原文件 |
| 活动谱面/结局或来源租约占用 | UnsupportedBoundary/明确占用拒绝，不选用旧稳定快照 |
| 无 Web Locks/ifAvailable | 明确拒绝新增写入/导入/分叉动作，不无锁降级 |
| 服务已 Claim、本机发布未完成 | 事务保持待恢复，不打开，不当作“从未迁移” |
| 本地已发布且清理失败 | 本地已提交/cleanupPending；仍须权威归属匹配才准入，不删除已发布世界 |

这些表述是受阻契约的验收目标；目前没有新增机制生产者，不能返回新的 Complete/Restored/迁移成功。
