import type {
  RestrictedMigrationCorePayload, MigrationAuthorityPort, MigrationReceipt, MigrationAdmission,
  SafePointDrainCapability, SafePointDrainAcceptance, WorldMigrationJournal, WorldMigrationEntry,
  WorldMigrationStorageReceipt, WorldHomeContext, WorldFolderSnapshot, WorldStateSnapshot,
} from '../director/IntentPort';
import type { WorldStateLock } from './WorldCoreStateStorage';

/** The narrow writer accepts the unchanged original revision, under a real target lease and CAS. */
export interface WorldMigrationStorageBindings {
  readonly context: WorldHomeContext;
  readonly authority: MigrationAuthorityPort | null;
  validatePayload(raw: unknown): RestrictedMigrationCorePayload;
  validateJournal(raw: unknown): WorldMigrationJournal;
  validateFolder(raw: unknown, accountId: string): WorldFolderSnapshot;
  parseReceipt(raw: unknown, payload: RestrictedMigrationCorePayload): MigrationReceipt;
  parseAdmission(raw: unknown, context: WorldHomeContext, worldId?: string): MigrationAdmission;
  parseDrainAcceptance(raw: unknown, confirmation: SafePointDrainCapability['confirmation']): SafePointDrainAcceptance;
  assertTargetLease(payload: RestrictedMigrationCorePayload): void;
  writeTarget(state: WorldStateSnapshot, expected: null): void;
  readTarget(accountId: string, worldId: string): unknown | null;
  validateCurrentTarget(raw: unknown, accountId: string, worldId: string): WorldStateSnapshot;
  /** Composition checks the shared authority synchronously again at each final local write. */
  assertAdmissionNow?(worldId?: string): void;
}

export type WorldMigrationRecoveryResult = WorldMigrationStorageReceipt
  | { readonly kind: 'NoPending'; readonly mode: 'ContractAdapter' };

/**
 * Independent two-domain migration journal. It neither rebases nor writes the source.
 * Global Claim precedes the only new local publication: adding the unchanged directory record.
 * Historical LocalPublished entries remain durable; current authority always gates opening.
 */
export class WorldMigrationStorage {
  private readonly coordinating = new Set<string>();
  private readonly directories = new Set<string>();
  private readonly operating = new Set<string>();
  private readonly context: WorldHomeContext;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly locks: WorldStateLock | null = browserMigrationLock(),
    private readonly bindings?: WorldMigrationStorageBindings,
  ) {
    const context = this.requireBindings().context;
    identity(context.accountId, 64, '账号'); identity(context.deviceId, 128, '设备');
    this.context = Object.freeze({ accountId: context.accountId, deviceId: context.deviceId });
  }

  /** Acquire this before source sorted world leases or the single target lease; directory is last. */
  async withMigrationLock<T>(accountId: string, operation: () => T | Promise<T>): Promise<T> {
    this.assertAccount(accountId);
    if (this.locks === null) { throw new Error('无 Web Locks 迁移协调锁；未释放、认领或发布世界'); }
    if (this.coordinating.has(accountId)) { throw new Error('同账号迁移协调锁不可重入'); }
    return this.locks.request('neurou-cross-device:' + encodeURIComponent(accountId), async () => {
      if (this.coordinating.has(accountId)) { throw new Error('迁移协调锁适配器未提供独占访问'); }
      this.coordinating.add(accountId);
      try { return await operation(); }
      finally { this.coordinating.delete(accountId); }
    });
  }

  readJournal(accountId: string): WorldMigrationJournal | null {
    this.assertAccount(accountId);
    const text = this.storage.getItem(this.journalKey(accountId));
    if (text === null) { return null; }
    const journal = this.requireBindings().validateJournal(parseJson(text, '迁移日志'));
    synchronous(journal, '迁移日志验证');
    if (journal.accountId !== this.context.accountId || journal.deviceId !== this.context.deviceId) {
      throw new Error('迁移日志账号或设备不匹配；原值保留');
    }
    return journal;
  }

  readPending(accountId: string): WorldMigrationEntry | null {
    return this.readJournal(accountId)?.entries.find(isPending) ?? null;
  }

  /** A complete source payload must be durable before any Release side effect. */
  prepareSource(raw: RestrictedMigrationCorePayload): WorldMigrationEntry {
    const payload = this.payload(raw);
    this.requireCoordination(payload.state.accountId);
    if (payload.sourceDeviceId !== this.context.deviceId) { throw new Error('源迁移日志只能由载荷来源设备准备'); }
    return this.prepare(payload, 'Source');
  }

  /** Authoritative read carries no local source assertion and does not itself publish a target. */
  async readAuthoritativePayload(migrationId: string): Promise<RestrictedMigrationCorePayload> {
    identity(migrationId, 128, '迁移');
    const raw = await this.authority().readMigrationPayload(migrationId);
    if (raw === null) { throw new Error('服务迁移载荷尚不存在；拒绝本地自造来源'); }
    const payload = this.payload(raw);
    if (payload.migrationId !== migrationId) { throw new Error('服务迁移载荷标识与请求不匹配'); }
    return payload;
  }

  /** Target collision is checked before service Claim, while holding its actual lease. */
  prepareTarget(raw: RestrictedMigrationCorePayload): WorldMigrationEntry {
    const payload = this.payload(raw);
    this.requireCoordination(payload.state.accountId); this.assertLease(payload);
    if (payload.sourceDeviceId === this.context.deviceId) { throw new Error('迁移认领须由另一个设备执行'); }
    this.assertCollisionCompatible(payload);
    return this.prepare(payload, 'Target');
  }

  /** Prepared recovery without a live drain can only observe an already accepted Release. */
  async releaseSource(migrationId: string, capability?: SafePointDrainCapability): Promise<WorldMigrationStorageReceipt> {
    const initial = this.entry(migrationId, 'Source');
    const payload = initial.payload, accountId = payload.state.accountId;
    this.requireCoordination(accountId); this.begin(accountId);
    try {
      let raw = await this.authority().readMigration(migrationId);
      if (raw !== null) { this.samePayload(payload, await this.readAuthoritativePayload(migrationId)); }
      if (raw === null) {
        if (!capability) { throw new Error('源排空世代已不存在；须重新主动排空后才能 MigrationRelease'); }
        synchronous(capability.assertCurrent(), '源主动排空确认');
        const confirmation = capability.confirmation;
        if (confirmation.accountId !== accountId || confirmation.sourceDeviceId !== this.context.deviceId) {
          throw new Error('源主动排空确认与迁移设备或账号不匹配');
        }
        this.requireBindings().parseDrainAcceptance(await this.authority().acceptDrain(capability), confirmation);
        synchronous(capability.assertCurrent(), '服务受理前源主动排空确认');
        raw = await this.authority().releaseMigration({ schemaVersion: 1, migrationId,
          worldId: payload.state.worldId, expectedHomeRevision: payload.expectedHomeRevision,
          drainId: confirmation.drainId }, payload);
      }
      const reply = this.receipt(raw, payload);
      this.update(payload, { role: 'Source', phase: reply.kind, payload, receipt: reply });
      return storageReceipt(this.entry(migrationId, 'Source'), null);
    } catch (error: unknown) { return this.failure(initial, error); }
    finally { this.operating.delete(accountId); }
  }

  /** The caller holds coordination and target lease throughout service await, never directory lock. */
  async claimAndPublish(migrationId: string): Promise<WorldMigrationStorageReceipt> {
    const initial = this.entry(migrationId, 'Target');
    const payload = initial.payload, accountId = payload.state.accountId;
    this.requireCoordination(accountId); this.assertLease(payload); this.begin(accountId);
    let authorityConfirmed = false;
    try {
      const authoritative = await this.readAuthoritativePayload(migrationId);
      this.samePayload(payload, authoritative); this.assertLease(payload);
      const before = this.receipt(await this.authority().readMigration(migrationId), payload);
      if (before.kind === 'PauseActive') {
        this.update(payload, { role: 'Target', phase: 'PauseActive', payload, receipt: before });
        return storageReceipt(this.entry(migrationId, 'Target'), null);
      }
      if (initial.phase !== 'LocalPublished') { this.assertCollisionCompatible(payload); }
      let reply = before;
      if (before.kind === 'Released') {
        this.update(payload, { role: 'Target', phase: 'Released', payload, receipt: before });
        reply = this.receipt(await this.authority().claimMigration({ schemaVersion: 1,
          migrationId, worldId: payload.state.worldId, expectedHomeRevision: payload.expectedHomeRevision + 1 }), payload);
      }
      if (reply.kind !== 'Claimed' || reply.claimDeviceId !== this.context.deviceId) {
        throw new Error('世界已由其他设备认领；本地原值与迁移日志保留');
      }
      this.assertLease(payload);
      await this.currentOwnership(payload, reply);
      this.assertLease(payload); authorityConfirmed = true;
      if (this.entry(migrationId, 'Target').phase !== 'LocalPublished') {
        this.update(payload, { role: 'Target', phase: 'Claimed', payload, receipt: reply });
      }
      await this.withDirectoryLock(accountId, () => {
        this.assertLease(payload); this.admissionNow(payload.state.worldId);
        const entry = this.entry(migrationId, 'Target');
        if (entry.phase === 'LocalPublished') {
          if (!this.published(payload)) { throw new Error('已发布迁移目录缺失；禁止复活已删除世界'); }
          this.verifyPublishedTarget(payload);
          return;
        }
        this.assertCollisionCompatible(payload);
        const target = this.readTarget(payload);
        if (target === null) {
          const complete = this.requireBindings().validateCurrentTarget(payload.state, accountId, payload.state.worldId);
          synchronous(complete, '迁移目标正式 Complete 解析');
          this.admissionNow(payload.state.worldId); this.assertLease(payload);
          try { synchronous(this.requireBindings().writeTarget(complete, null), '迁移目标原版本 CAS 写入'); }
          catch (error: unknown) { if (!this.exactTarget(payload)) { throw error; } }
        }
        if (!this.exactTarget(payload)) { throw new Error('迁移目标 Core 回读与源载荷不同；禁止发布'); }
        if (!this.published(payload)) {
          const folder = this.readFolder(accountId);
          const candidate = this.requireBindings().validateFolder({ ...folder,
            records: [...folder.records, payload.record] }, accountId);
          synchronous(candidate, '迁移目录严格验证');
          if (!same(this.readFolder(accountId), folder)) { throw new Error('迁移目录已变化；禁止陈旧覆盖'); }
          this.admissionNow(payload.state.worldId); this.assertLease(payload);
          try { this.storage.setItem(this.folderKey(accountId), JSON.stringify(candidate)); }
          catch (error: unknown) { if (!this.published(payload)) { throw error; } }
          if (!this.published(payload)) { throw new Error('迁移目录追加未持久成功'); }
        }
        this.update(payload, { role: 'Target', phase: 'LocalPublished', payload, receipt: reply });
      });
      return storageReceipt(this.entry(migrationId, 'Target'), null);
    } catch (error: unknown) {
      const latest = this.failure(initial, error);
      if (authorityConfirmed && latest.phase === 'LocalPublished') {
        try { if (this.published(payload)) { this.verifyPublishedTarget(payload); return storageReceipt(this.entry(migrationId, 'Target'), null); } }
        catch { /* Keep the published data and the actionable diagnostic. */ }
      }
      return latest;
    } finally { this.operating.delete(accountId); }
  }

  async recover(accountId: string, migrationId?: string,
    capability?: SafePointDrainCapability): Promise<WorldMigrationRecoveryResult> {
    this.requireCoordination(accountId);
    const journal = this.readJournal(accountId);
    const entry = migrationId === undefined ? journal?.entries.find(isPending)
      : journal?.entries.find(value => value.payload.migrationId === migrationId);
    if (!entry) { return Object.freeze({ kind: 'NoPending', mode: 'ContractAdapter' }); }
    return entry.role === 'Source' ? this.releaseSource(entry.payload.migrationId, capability)
      : this.claimAndPublish(entry.payload.migrationId);
  }

  /** Fresh admission and ownership must agree with this exact Claim; historical receipts cannot authorize. */
  async assertCanOpen(accountId: string, worldId: string): Promise<void> {
    this.assertAccount(accountId); identity(worldId, 128, '世界');
    const entries = this.readJournal(accountId)?.entries.filter(entry => entry.role === 'Target' &&
      entry.phase === 'LocalPublished' && entry.payload.state.worldId === worldId) ?? [];
    if (!entries.length) { throw new Error('迁移本地发布尚未完成对账；拒绝打开'); }
    // A later return migration supersedes earlier receipts for the same local world.
    const entry = entries[entries.length - 1], payload = entry.payload;
    if (!entry.receipt || entry.receipt.kind !== 'Claimed') { throw new Error('迁移 Claim 凭据缺失；拒绝打开'); }
    this.assertLease(payload);
    const authoritative = await this.readAuthoritativePayload(payload.migrationId);
    this.samePayload(payload, authoritative);
    await this.currentOwnership(payload, entry.receipt);
    this.assertLease(payload); this.admissionNow(worldId);
    const latest = this.entry(payload.migrationId, 'Target');
    if (latest.phase !== 'LocalPublished' || !this.published(payload)) { throw new Error('迁移发布目录或凭据已变化；拒绝打开'); }
    this.verifyPublishedTarget(payload);
  }

  private prepare(payload: RestrictedMigrationCorePayload, role: WorldMigrationEntry['role']): WorldMigrationEntry {
    const accountId = payload.state.accountId;
    if (this.operating.has(accountId)) { throw new Error('迁移进行中，不能重入准备'); }
    const journal = this.readJournal(accountId);
    const prior = journal?.entries.find(entry => entry.payload.migrationId === payload.migrationId);
    if (prior) {
      if (prior.role !== role) { throw new Error('同迁移 ID 不能改变本机参与角色'); }
      this.samePayload(prior.payload, payload); return prior;
    }
    if (journal?.entries.some(isPending)) { throw new Error('账号尚有未结算迁移，必须先恢复'); }
    const entry: WorldMigrationEntry = { role, phase: 'Prepared', payload, receipt: null };
    this.writeJournal({ schemaVersion: 1, kind: 'WorldMigrationJournal', accountId,
      deviceId: this.context.deviceId, entries: [...(journal?.entries ?? []), entry] }, journal);
    return this.entry(payload.migrationId, role);
  }

  private async currentOwnership(payload: RestrictedMigrationCorePayload, reply: MigrationReceipt): Promise<void> {
    const admission = this.requireBindings().parseAdmission(await this.authority().readAdmission(payload.state.worldId),
      this.context, payload.state.worldId);
    const record = admission.record;
    if (admission.kind !== 'Allowed' || admission.pause?.endedAtServerEpochMs === null || !record ||
        record.homeState !== 'Homed' || record.homeDeviceId !== this.context.deviceId ||
        !same(record, reply.record) || admission.observedAtServerEpochMs < reply.observedAtServerEpochMs) {
      throw new Error('当前服务暂停、归属缺失或已迁往别处；等待对账，拒绝本地发布或打开');
    }
  }

  private update(payload: RestrictedMigrationCorePayload, next: WorldMigrationEntry): void {
    this.requireCoordination(payload.state.accountId);
    if (next.role === 'Target') { this.assertLease(payload); }
    const current = this.readJournal(payload.state.accountId);
    if (current === null) { throw new Error('迁移日志缺失；原始世界数据保留'); }
    const previous = this.entry(payload.migrationId, next.role);
    this.samePayload(previous.payload, payload);
    if (rank(next.phase) < rank(previous.phase)) { throw new Error('迁移日志阶段回退；历史归属不能恢复权威'); }
    this.writeJournal({ ...current, entries: current.entries.map(entry =>
      entry.payload.migrationId === payload.migrationId ? next : entry) }, current);
  }

  private writeJournal(raw: WorldMigrationJournal, expected: WorldMigrationJournal | null): void {
    this.requireCoordination(raw.accountId);
    const candidate = this.requireBindings().validateJournal(raw);
    synchronous(candidate, '迁移日志严格验证');
    if (candidate.accountId !== this.context.accountId || candidate.deviceId !== this.context.deviceId) {
      throw new Error('迁移日志写入身份不匹配');
    }
    if (!same(this.readJournal(raw.accountId), expected)) { throw new Error('迁移日志已变化；禁止覆盖其他事务'); }
    try { this.storage.setItem(this.journalKey(raw.accountId), JSON.stringify(candidate)); }
    catch (error: unknown) { if (!same(this.readJournal(raw.accountId), candidate)) { throw error; } }
    if (!same(this.readJournal(raw.accountId), candidate)) { throw new Error('迁移日志没有持久成功；须恢复重试'); }
  }

  private entry(migrationId: string, role?: WorldMigrationEntry['role']): WorldMigrationEntry {
    identity(migrationId, 128, '迁移');
    const entry = this.readJournal(this.context.accountId)?.entries.find(value => value.payload.migrationId === migrationId);
    if (!entry || (role !== undefined && entry.role !== role)) { throw new Error('完整迁移计划尚未持久准备或角色不匹配'); }
    return entry;
  }

  private payload(raw: unknown): RestrictedMigrationCorePayload {
    const payload = this.requireBindings().validatePayload(raw);
    synchronous(payload, '迁移载荷完整解析');
    if (payload.state.accountId !== this.context.accountId) { throw new Error('迁移载荷不能跨越绑定账号'); }
    return payload;
  }

  private receipt(raw: unknown, payload: RestrictedMigrationCorePayload): MigrationReceipt {
    if (raw === null) { throw new Error('服务迁移状态缺失；保留本地日志等待对账'); }
    const reply = this.requireBindings().parseReceipt(raw, payload);
    synchronous(reply, '迁移服务响应严格解析');
    return reply;
  }

  private assertCollisionCompatible(payload: RestrictedMigrationCorePayload): void {
    const exists = this.published(payload), target = this.readTarget(payload);
    if (exists && target === null) { throw new Error('同 ID 已发布目录缺失 Core；禁止重建或覆盖'); }
    if (target !== null && !same(target, payload.state)) {
      throw new Error('同 ID 目标 Core 进展不同；迁回碰撞保留原值，不认领或覆盖');
    }
  }

  private published(payload: RestrictedMigrationCorePayload): boolean {
    const record = this.readFolder(payload.state.accountId).records.find(value => value.worldId === payload.state.worldId);
    if (!record) { return false; }
    if (!same(record, payload.record)) { throw new Error('同 ID 目标目录不同或已墓碑；禁止覆盖或复活'); }
    return true;
  }

  private exactTarget(payload: RestrictedMigrationCorePayload): boolean { return same(this.readTarget(payload), payload.state); }

  private verifyPublishedTarget(payload: RestrictedMigrationCorePayload): void {
    const current = this.readTarget(payload), original = payload.state;
    if (!current || current.accountId !== original.accountId || current.worldId !== original.worldId ||
        current.revision < original.revision || (current.revision === original.revision && !same(current, original)) ||
        !same(current.forkOrigin, original.forkOrigin) || !same(current.sections.FormatTime, original.sections.FormatTime)) {
      throw new Error('已发布迁移 Core 身份、原版本、来源或 FormatTime 不一致；拒绝打开');
    }
  }

  private readTarget(payload: RestrictedMigrationCorePayload): WorldStateSnapshot | null {
    const raw = this.requireBindings().readTarget(payload.state.accountId, payload.state.worldId);
    synchronous(raw, '迁移目标 Core 回读');
    if (raw === null) { return null; }
    const target = this.requireBindings().validateCurrentTarget(raw, payload.state.accountId, payload.state.worldId);
    synchronous(target, '迁移目标 Complete 与正式内容回读');
    if (target.accountId !== payload.state.accountId || target.worldId !== payload.state.worldId) { throw new Error('迁移目标 Core 回读身份不符'); }
    return target;
  }

  private readFolder(accountId: string): WorldFolderSnapshot {
    const text = this.storage.getItem(this.folderKey(accountId));
    if (text === null) { throw new Error('迁移接收目录尚未初始化'); }
    const folder = this.requireBindings().validateFolder(parseJson(text, '迁移设备目录'), accountId);
    synchronous(folder, '迁移目录严格验证');
    if (folder.accountId !== accountId) { throw new Error('迁移目录账号不符'); }
    return folder;
  }

  private async withDirectoryLock<T>(accountId: string, operation: () => T): Promise<T> {
    this.requireCoordination(accountId);
    if (this.locks === null) { throw new Error('无 Web Locks 目录锁；未发布迁移世界'); }
    if (this.directories.has(accountId)) { throw new Error('同账号目录锁不可重入'); }
    return this.locks.request('neurou-world-folder:' + encodeURIComponent(accountId), async () => {
      if (this.directories.has(accountId)) { throw new Error('迁移目录锁没有提供独占访问'); }
      this.directories.add(accountId);
      try { return operation(); }
      finally { this.directories.delete(accountId); }
    });
  }

  private failure(initial: WorldMigrationEntry, error: unknown): WorldMigrationStorageReceipt {
    let entry = initial;
    try { entry = this.entry(initial.payload.migrationId, initial.role); } catch { /* Preserve unreadable raw journal. */ }
    return storageReceipt(entry, error instanceof Error ? error.message : String(error));
  }
  private samePayload(left: RestrictedMigrationCorePayload, right: RestrictedMigrationCorePayload): void {
    if (!same(left, right)) { throw new Error('同迁移 ID 载荷被改变；原始计划保留'); }
  }
  private admissionNow(worldId?: string): void {
    const hook = this.requireBindings().assertAdmissionNow;
    if (hook) { synchronous(hook(worldId), '最终本地发布前服务准入复查'); }
  }
  private assertLease(payload: RestrictedMigrationCorePayload): void {
    synchronous(this.requireBindings().assertTargetLease(payload), '迁移目标真实租约检查');
  }
  private authority(): MigrationAuthorityPort {
    const authority = this.requireBindings().authority;
    if (!authority || authority.mode !== 'ContractAdapter' || authority.context.accountId !== this.context.accountId ||
        authority.context.deviceId !== this.context.deviceId || typeof authority.readMigration !== 'function' ||
        typeof authority.releaseMigration !== 'function' || typeof authority.claimMigration !== 'function' ||
        typeof authority.readMigrationPayload !== 'function' || typeof authority.readAdmission !== 'function' ||
        typeof authority.acceptDrain !== 'function') { throw new Error('迁移权威不可用或绑定身份不符'); }
    return authority;
  }
  private assertAccount(accountId: string): void {
    identity(accountId, 64, '账号');
    if (accountId !== this.context.accountId) { throw new Error('迁移存储不能跨越绑定账号读取或写入'); }
  }
  private requireCoordination(accountId: string): void {
    this.assertAccount(accountId);
    if (!this.coordinating.has(accountId)) { throw new Error('迁移必须持有同账号跨设备协调锁'); }
  }
  private begin(accountId: string): void {
    if (this.operating.has(accountId)) { throw new Error('同账号迁移提交不可重入'); }
    this.operating.add(accountId);
  }
  private requireBindings(): WorldMigrationStorageBindings {
    if (!this.bindings) { throw new Error('迁移完整验证器、权威与目标真实租约尚未装配'); }
    return this.bindings;
  }
  private folderKey(accountId: string): string { return 'neurou-world-folder-v1:' + encodeURIComponent(accountId); }
  private journalKey(accountId: string): string { return 'neurou-migration-v1:' + encodeURIComponent(accountId); }
}

function storageReceipt(entry: WorldMigrationEntry, error: string | null): WorldMigrationStorageReceipt {
  const kind = error !== null ? 'Pending' : entry.phase === 'LocalPublished' ? 'LocalPublished'
    : entry.phase === 'PauseActive' ? 'PauseActive' : entry.phase === 'Released' ||
      (entry.role === 'Source' && entry.phase === 'Claimed') ? 'Released' : 'Pending';
  return Object.freeze({ mode: 'ContractAdapter', kind, phase: entry.phase,
    migrationId: entry.payload.migrationId, worldId: entry.payload.state.worldId, error });
}
function isPending(entry: WorldMigrationEntry): boolean {
  return entry.role === 'Source' ? entry.phase !== 'Claimed' : entry.phase !== 'LocalPublished';
}
function rank(phase: WorldMigrationEntry['phase']): number {
  return ['Prepared', 'PauseActive', 'Released', 'Claimed', 'LocalPublished'].indexOf(phase);
}
function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function parseJson(text: string, label: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { throw new Error(label + ' JSON 损坏；原值保留'); }
}
function synchronous(value: unknown, label: string): void {
  if (value !== null && (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function') {
    void Promise.resolve(value).catch(() => undefined);
    throw new Error(label + '必须同步完成');
  }
}
function identity(value: unknown, maximum: number, label: string): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > maximum || value !== value.trim()) { throw new Error(label + '标识无效'); }
  try { encodeURIComponent(value); } catch { throw new Error(label + '标识编码无效'); }
}
function browserMigrationLock(): WorldStateLock | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) { return null; }
  return { request: <T>(name: string, operation: () => Promise<T>): Promise<T> =>
    navigator.locks.request(name, { mode: 'exclusive' }, operation) };
}
