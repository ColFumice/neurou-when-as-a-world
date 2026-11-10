# B2.4d 迁移与账号暂停契约

依据 VERDICT-326～345。实现与测试仅 ContractAdapter、两个逻辑设备及受限 Core；正式外部服务未接入。所有 data-only 结构 schemaVersion 为 1，严格拒绝未知 / 缺失字段、访问器、symbol、非 plain 原型、稀疏数组、循环和非有限值。运行时能力与 WorldStateSnapshot 品牌不通过 JSON 传输。

## 同 ID 迁移载荷

```ts
interface RestrictedMigrationCorePayload {
  schemaVersion: 1;
  kind: 'RestrictedMigrationCore';
  migrationId: string;
  sourceDeviceId: string;
  expectedHomeRevision: number;
  record: WorldFolderRecord;
  state: WorldCoreStateSnapshot & {
    sections: {
      Ledger: LedgerSnapshot;
      PuzzleProgress: readonly PuzzleProgressSnapshot[];
      FormatTime: FormatTimeSnapshot;
      RecallCount: RecallCountSnapshot;
      WorldLink: WorldLinkSnapshot;
      ChartSnapshot: ChartSnapshotCollection;
      ChartScore: ChartScoreSnapshot;
    };
  };
}
```

载荷保持账号、worldId、七项、FormatTime、forkOrigin、revision 和 capturedAt 原值。源 revision 可以是任意合法非负安全整数；目标通过持真实 lease 的独立窄 CAS 写口保存原版本。该操作不调用 rebaseWorldState，不新建 UUID，不产生新 forkOrigin，不强行改为 revision 0。目标重新 parseComplete 并验证正式叙事、谱面、冻结媒体引用，随后丢弃传输品牌并建立接收端认证。

InitialWorld 参与源账号排空、RealityPause 准入，始终不登记、不迁移。待迁移世界必须非 InitialWorld、静止 Primary、七项 Complete；BugShore / FinalShore 不支持。CopyPermission 与迁移资格无关。账号 WorldClearRecord / FirstWorldCleared 继续使用同账号受信读口，载荷不携带、不重新制造账号事实。已有 fork 的 Inherited 保持原义。

## 主动排空与单次确认

```ts
interface SafePointDrainConfirmation {
  schemaVersion: 1;
  accountId: string;
  sourceDeviceId: string;
  drainId: string;
  directoryDigest: string; // SHA-256
  worlds: readonly { worldId: string; revision: number; coreDigest: string }[];
}
interface SafePointDrainCapability {
  confirmation: SafePointDrainConfirmation;
  assertCurrent(): void;
  revoke(): void;
}
interface SafePointDrainAcceptance {
  schemaVersion: 1;
  confirmation: SafePointDrainConfirmation;
  acceptedAtServerEpochMs: number;
  expiresAtServerEpochMs: number; // accepted + 30000
}
```

排空集合是源设备该账号目录全部未删世界，含 InitialWorld 与空世界。空世界以严格 Core 保存，没有玩法内容不得伪造七项；正式世界需稳定 Ledger / Puzzle / FormatTime，迁移目标另需完整七项。排空关闭源新准入，获取世界真实 lease，验证当前 runtime 不处在活动状态、没有待恢复发布事务，账号通关与里程碑均已结算。非继承完成 Ledger 找不到对应合法账号记录时拒绝，不能以 reconcileAccount 补里程碑后冒充排空。

真实 SafePointDrainStorage 通过模块 WeakSet 签发能力；authority 不接受序列化 confirmation 或自造 assertCurrent 对象。能力只在当前关闭准入、持真实 leases 的世代有效。assertCurrent 现场复查目录、Core、账号事实摘要及活动 / 在途事务；首次复查失败自动撤销，即使恢复旧字节也不能复活。回调结束必撤销并释放 locks / admission。服务 acceptDrain 给予 30 秒服务时间寿命，Release 验证后单次消费，服务已成功而响应丢失用同 migrationId 查询，不重启冷静期。

活动谱面（含暂停 / 重演 / World 演奏）、揭示、七秒持续期、排队入口及账号提交 Pending / Failed 都不是安全点。不强制退谱、清计时、跳揭示或销毁活动图制造确认。本轮生产迁移发起仅文件夹空闲时执行；其他窗口的已在活动边界按自然状态继续排空。暂停过滤拒绝新移动 / 跳跃 / 感知 / 叙事 / 回忆 / 重演 / 演奏；已在谱面保留 Strike / ToggleChartPause / ExitChart，已在七秒持续期保留必要世界 Strike，RetryWorldClear 保留合法账号结算。已触发揭示自然 Finished 的系统提交口允许一次旧 EnterChart continuation；普通新 EnterChart 不因此获准。自然时钟保持 INV-10 / INV-12 / INV-13，实际 Complete 且账号写结算后再退出只读目录。

## 服务执行端口与时间

```ts
interface MigrationAuthorityPort extends WorldHomeAuthorityPort {
  readAdmission(worldId?: string): Promise<unknown>;
  acceptDrain(capability: SafePointDrainCapability): Promise<unknown>;
  releaseMigration(request: MigrationReleaseRequest, payload: RestrictedMigrationCorePayload): Promise<unknown>;
  readMigration(migrationId: string): Promise<unknown>;
  readMigrationPayload(migrationId: string): Promise<unknown>;
  claimMigration(request: MigrationClaimRequest): Promise<unknown>;
  readDeviceBinding(): Promise<unknown>;
}
```

ReleaseRequest 为 schemaVersion / migrationId / worldId / expectedHomeRevision / drainId；ClaimRequest 为 schemaVersion / migrationId / worldId / expectedHomeRevision，后者期望 Released 版本。账号 / deviceId 由绑定端口给出，不能请求覆盖。MigrationReceipt 含 schemaVersion、账号 / migration / world、source / claim device、原 expectedHomeRevision、kind、record、pause 与 observedAtServerEpochMs。准入 Allowed / PauseActive / Released / Migrated 必须鲜读服务；服务不可用拒绝新准入与 Claim，活动只排到安全点。

Release 在一个服务权威快照发布归属证据、RealityPauseRecord 和 DeviceAccountBinding。PauseActive 内仍 Homed 原源设备；服务时间达到截止才发布 Released，homeRevision = 原版本 + 1；Claim 后 Homed 目标设备，homeRevision = 原版本 + 2。账号 registryRevision 随实际归属转变递增。历史 receipt 记录当时归属，不随后来迁回倒退或夺回权威；打开始终另查当前服务归属。

RealityPauseRecord 是 schemaVersion / accountId / migrationId / initiatingDeviceId / startedAtServerEpochMs / resumeNotBeforeServerEpochMs / endedAtServerEpochMs。时长至少 max(3600000, OfflineGrace 毫秒)，只有服务时间决定结束，客户端计时不影响资格。设备绑定为 schemaVersion / deviceId / boundAccountId / migrationId / pause；发起设备活动暂停中登录或切另一账号拒绝，其他窗口及应用客户端重建重读服务域。删客户端缓存不能解绑；只服务结束清空绑定。

ContractServiceClock、服务时钟 key 与权威快照是明确隔离的 ContractAdapter fixture。验收推进服务 fixture 一小时，不声称玩家已实际等待一小时或真实物理跨设备认证。无需 bootId，不以 RealityPause 证明旧设备停止，也不混入 OfflineGrace 平台累计运行时间。

## 双存储域、日志与锁

WorldMigrationJournal 为 schemaVersion / kind = WorldMigrationJournal / accountId / deviceId / entries；entry 为 role Source | Target、phase、payload、receipt。Prepared 的 receipt 为 null；其余 phase 与 receipt.kind 对应，LocalPublished 对应 Claimed。Source 观察 Claimed 后结束，Target 到 LocalPublished 才结束；历史保留，同 worldId 可有多个 migrationId，单设备账号最多一个未完成迁移。

服务 Claim 是全局归属权威点；目标目录追加是唯一新的本地发布点。独立 journal 协调两域，不要求一个跨服务与本地原子点；不存在 CleanupPending phase。服务成功本地失败保留 Claimed 重试；本地已发布服务未知 / 冲突拒开等对账，不删除已发布世界伪装回滚。LocalPublished receipt 留存；源 Core / 目录 / 文件始终原字节，不删除、不墓碑，源“去往别处”来自服务诊断。

源顺序：共享 withCoordination（neurou-cross-device 账号锁）→ 按 worldId 排序的所有源世界 leases → neurou-world-clear 账号事实锁 → neurou-world-folder 目录锁。目录锁只覆盖最终同步集合 / Core / 事实检查与确认签发，随后释放；服务 accept / Release await 在目录锁外，保持前序真实 world / account locks 与关闭准入。组合注入 journal adapter 的 withMigrationLock，避免嵌套同名协调锁重入。

目标顺序：neurou-cross-device → 原 worldId 真实目标 lease → 服务 Claim await → neurou-world-folder 最终本地发布。服务权威锁 neurou-migration-authority 独立，不反取世界 / 目录锁。所有新准入等待后复查；旧 Fork / import 的既有核心锁顺序不变。无 Web Locks 明确拒绝。

## 崩溃点与恢复

| 持久状态 / 崩溃点 | 恢复策略 |
|---|---|
| 尚无 Prepared | 不请求服务；全部源文件保留；重新主动排空建立新事务。 |
| Prepared 已写、服务尚无 Release | 原冻结载荷保留；旧运行时能力无效，只查询服务；重新排空并复核完全同值才能继续。 |
| acceptDrain 后、Release 前 | 30 秒服务确认不替代真实 leases；能力失效或过期需重新排空；不制造 PauseActive。 |
| Release 服务写成功、响应或本地 PauseActive 写失败 | 查询同 migrationId 与权威 payload；复用服务原 receipt，不重复启动一小时。 |
| PauseActive | 所有设备新准入拒绝；仅服务时间到期转换，客户端重启 / 本地时间跃迁不结束。 |
| Released | 归属无 HomeDevice，等待合法另设备 Claim；源不能对同 migrationId 自己 Claim 取消。 |
| Target Prepared / PauseActive | 持原计划查询服务；PauseActive 不 Claim；Released 后进入原请求；本地尚未发布。 |
| Claim 服务成功、响应或 Claimed 写失败 | 同 migrationId 查询 / 重放；检查 claimDeviceId 与当前归属后补 Claimed；其他设备已认领则冲突保留。 |
| Claimed、Core 未写 | 保持原 payload、真实 target lease、null CAS 写原 revision，不改源。 |
| Core 已写、目录未追加 | 回读必须完全同值；相同暂存重用，异值拒绝；目录追加仍是本地唯一发布点。 |
| 目录已追加、LocalPublished 未写 | 回读目录记录与 Core 判定已发布；补 LocalPublished，不删除已发布世界。 |
| LocalPublished | 只校验当前服务归属与合法已发布 Core；历史 receipt 不能授权未来已迁走的世界。 |
| setItem 已落值后抛错 | 回读原 key 判断是否提交；按真实持久状态推进或保留 Pending，不凭异常假定回滚。 |

幂等的前提是同 migrationId、请求、payload、device 与期望版本。同 ID 异值拒绝。迁回必须新事务、由当前 HomeDevice 重新排空 / Release、另设备 Claim；同一迁移的源不能 Claim 自己。目标已有完整相同 Core 与相同目录记录可原值迁回；已有异值 / 进展差异 / 墓碑拒绝，不覆盖、不复活、不重放旧 receipt 改归属。Claim 不可取消。

## B2.4e 入场与后续

B2.4e 可以在同一受限原型范围端到端验收，入场需共享持久 ContractAdapter、稳定非 Initial Primary Complete 载荷、正式内容与媒体可用、全部组合准入接线、自然 SafePoint 续行及三门禁健康。验收明确区分契约服务可控时钟与 Creator 两档实际运行。Trae 将本轮附录合入正式名库不构成重复请示前置。

完整 FileCarry、真实外部 AuthService / CommitRelay、平台 OfflineGrace、非 Primary 生产迁移、WorldRegistry 本机位置 API、AccessCode / ObserverSync 不在本轮。逻辑设备固定 deviceId 是 fixture 边界，重装或伪造物理身份防御不是当前产品能力。
