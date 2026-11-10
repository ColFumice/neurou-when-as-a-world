import type {
  CrossDeviceImportPlan, CrossDeviceImportReceipt, CrossDeviceImportJournal,
  CrossDeviceAuthorityPort, WorldHomeContext, WorldHomeRegistrationRequest,
  WorldHomeRegistrationReply, WorldHomeRegistrySnapshot, WorldFolderSnapshot,
  WorldStateSnapshot,
} from '../director/IntentPort';
import type { WorldStateLock } from './WorldCoreStateStorage';

/** Complete/reference codecs and target lease capability are supplied by composition. */
export interface CrossDeviceImportStorageBindings {
  readonly context: WorldHomeContext;
  readonly authority: CrossDeviceAuthorityPort | null;
  validatePlan(raw: unknown): CrossDeviceImportPlan;
  validateJournal(raw: unknown): CrossDeviceImportJournal;
  validateFolder(raw: unknown, accountId: string): WorldFolderSnapshot;
  parseRegistrationReply(raw: unknown, context: WorldHomeContext,
    request: WorldHomeRegistrationRequest): WorldHomeRegistrationReply;
  parseRegistry(raw: unknown, accountId: string): WorldHomeRegistrySnapshot;
  assertTargetLease(plan: CrossDeviceImportPlan): void;
  writeTarget(state: WorldStateSnapshot): void;
  readTarget(accountId: string, worldId: string): unknown | null;
  /** Must parseComplete against the receiver's published content before returning. */
  validateCurrentTarget(raw: unknown, accountId: string, worldId: string): WorldStateSnapshot;
  verifyAuthoritySource(plan: CrossDeviceImportPlan): Promise<void>;
}

type ImportEntry = CrossDeviceImportJournal['entries'][number];
export type CrossDeviceImportRecoveryResult = CrossDeviceImportReceipt
  | { readonly kind: 'NoPending'; readonly mode: 'ContractAdapter' };

/**
 * Service-first, journal-coordinated publication. This transaction has only a
 * real target lease; it never fabricates a remote source lease or calls Fork.
 * Published receipts remain durable and gate every subsequent target opening.
 */
export class CrossDeviceImportStorage {
  private readonly importAccounts = new Set<string>();
  private readonly directoryAccounts = new Set<string>();
  private readonly operatingAccounts = new Set<string>();
  private readonly context: WorldHomeContext;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly locks: WorldStateLock | null = browserImportLock(),
    private readonly bindings?: CrossDeviceImportStorageBindings,
  ) {
    const context = this.requireBindings().context;
    validId(context.accountId, 64, '账号'); validId(context.deviceId, 128, '设备');
    this.context = Object.freeze({ accountId: context.accountId, deviceId: context.deviceId });
  }

  /** Order: import lock -> target lease -> directory lock. Never acquire source. */
  async withImportLock<T>(accountId: string, operation: () => T | Promise<T>): Promise<T> {
    this.assertAccount(accountId);
    if (this.locks === null) { throw new Error('当前环境没有导入独占锁；未写入跨设备导入或目录'); }
    if (this.importAccounts.has(accountId)) { throw new Error('同一账号导入锁不可重入'); }
    return this.locks.request('neurou-cross-device-import:' + encodeURIComponent(accountId), async () => {
      if (this.importAccounts.has(accountId)) { throw new Error('导入锁适配器没有提供独占访问'); }
      this.importAccounts.add(accountId);
      try { return await operation(); }
      finally { this.importAccounts.delete(accountId); }
    });
  }

  readJournal(accountId: string): CrossDeviceImportJournal | null {
    this.assertAccount(accountId);
    const bytes = this.storage.getItem(this.journalKey(accountId));
    if (bytes === null) { return null; }
    const journal = this.requireBindings().validateJournal(parseJson(bytes, '跨设备导入日志'));
    if (journal.accountId !== this.context.accountId || journal.deviceId !== this.context.deviceId) {
      throw new Error('导入日志账号或设备身份不匹配；原始日志已保留');
    }
    return journal;
  }

  /** Inspection precedes acquiring the pending target's real lease. */
  readPending(accountId: string): ImportEntry | null {
    return this.readJournal(accountId)?.entries.find(entry => entry.phase !== 'Published') ?? null;
  }

  /** No authority or directory mutation occurs until the complete plan is durable. */
  prepare(raw: CrossDeviceImportPlan): ImportEntry {
    const plan = this.plan(raw);
    this.requireImportLock(plan.accountId);
    this.assertLease(plan);
    if (this.operatingAccounts.has(plan.accountId)) { throw new Error('导入提交进行中；不能重入准备'); }
    const journal = this.readJournal(plan.accountId);
    const existing = journal?.entries.find(entry => entry.plan.transactionId === plan.transactionId);
    if (existing) {
      this.assertSamePlan(existing.plan, plan);
      return existing;
    }
    if (journal?.entries.some(entry => entry.plan.targetWorldId === plan.targetWorldId)) {
      throw new Error('导入目标已属于另一日志；原始数据已保留');
    }
    if (journal?.entries.some(entry => entry.phase !== 'Published')) {
      throw new Error('当前账号尚有待恢复导入；新导入未准备');
    }
    if (this.readFolder(plan.accountId).records.some(record => record.worldId === plan.targetWorldId) ||
        this.readTarget(plan) !== null) {
      throw new Error('新导入目标已存在或曾被删除；禁止覆盖');
    }
    const entry: ImportEntry = { phase: 'Prepared', plan, homeReply: null };
    const next: CrossDeviceImportJournal = { schemaVersion: 1, kind: 'CrossDeviceImportJournal', accountId: plan.accountId,
      deviceId: this.context.deviceId, entries: [...(journal?.entries ?? []), entry] };
    this.writeJournal(next, journal);
    return this.entry(plan);
  }

  /** The root holds the import lock and target lease across the service await. */
  async registerAndPublish(raw: CrossDeviceImportPlan): Promise<CrossDeviceImportReceipt> {
    const plan = this.plan(raw);
    this.requireImportLock(plan.accountId);
    this.assertLease(plan);
    const initial = this.entry(plan);
    if (this.operatingAccounts.has(plan.accountId)) { throw new Error('同一账号导入提交不可重入'); }
    this.operatingAccounts.add(plan.accountId);
    let authorityConfirmed = false;
    try {
      const bindings = this.requireBindings();
      await bindings.verifyAuthoritySource(plan);
      this.assertLease(plan);
      const authority = this.authority();
      const request: WorldHomeRegistrationRequest = { schemaVersion: 1,
        worldId: plan.targetWorldId, registrationId: plan.registrationId };
      const reply = bindings.parseRegistrationReply(await authority.registerWorldHome(request), this.context, request);
      this.assertReply(plan, reply);
      // A fresh registry read also rejects a replay whose target was moved or vanished.
      const registry = bindings.parseRegistry(await authority.readRegistry(), plan.accountId);
      this.assertRegistryHome(plan, registry, reply);
      authorityConfirmed = true;
      this.assertLease(plan);
      const current = this.entry(plan);
      if (current.phase !== 'Published') { this.updateEntry(plan, { phase: 'HomeRegistered', plan, homeReply: reply }); }
      await this.withDirectoryLock(plan.accountId, () => {
        this.assertLease(plan);
        const published = this.published(plan);
        if (this.entry(plan).phase === 'Published') {
          if (!published) { throw new Error('已发布导入目录缺失；禁止重新创建已删除世界'); }
          this.verifyPublishedTarget(plan);
          this.updateEntry(plan, { phase: 'Published', plan, homeReply: reply });
          return;
        }
        const staged = this.readTarget(plan);
        if (staged === null) {
          requireSynchronous(bindings.writeTarget(plan.targetState), '导入目标持久提交');
        }
        this.verifyStagedTarget(plan);
        if (!published) {
          const folder = this.readFolder(plan.accountId);
          const candidate = bindings.validateFolder({ ...folder, records: [...folder.records, plan.targetRecord] }, plan.accountId);
          requireSynchronous(candidate, '导入目录完整验证');
          if (JSON.stringify(this.readFolder(plan.accountId)) !== JSON.stringify(folder)) {
            throw new Error('导入暂存期间世界目录已变化；禁止陈旧目录覆盖');
          }
          // The only local publication point. The target Core remains when this fails.
          try {
            this.storage.setItem(this.folderKey(plan.accountId), JSON.stringify(candidate));
          } catch (error: unknown) {
            if (!this.published(plan)) { throw error; }
          }
          if (!this.published(plan)) { throw new Error('导入目标目录追加未持久成功'); }
        }
        this.updateEntry(plan, { phase: 'Published', plan, homeReply: reply });
      });
      return receipt(plan, 'Published', null);
    } catch (error: unknown) {
      // An adapter may throw after a successful atomic Published write.
      let phase: ImportEntry['phase'] = initial.phase;
      try {
        phase = this.entry(plan).phase;
        if (phase === 'Published' && this.published(plan)) {
          this.verifyPublishedTarget(plan);
          // A journal adapter may throw after its atomic Published write succeeded.
          if (authorityConfirmed) { return receipt(plan, 'Published', null); }
        }
      } catch { /* Preserve damaged or unreachable data; the original error is reported. */ }
      return receipt(plan, phase, errorText(error));
    } finally { this.operatingAccounts.delete(plan.accountId); }
  }

  /** Explicit target selection permits Published receipt reconciliation as well. */
  async recover(accountId: string, targetWorldId?: string): Promise<CrossDeviceImportRecoveryResult> {
    this.requireImportLock(accountId);
    const journal = this.readJournal(accountId);
    const entry = targetWorldId === undefined
      ? journal?.entries.find(value => value.phase !== 'Published')
      : journal?.entries.find(value => value.plan.targetWorldId === targetWorldId);
    if (!entry) { return Object.freeze({ kind: 'NoPending' as const, mode: 'ContractAdapter' as const }); }
    return this.registerAndPublish(entry.plan);
  }

  /** This checks current service ownership; a historical receipt is insufficient. */
  async assertCanOpen(accountId: string, targetWorldId: string): Promise<void> {
    this.assertAccount(accountId); validId(targetWorldId, 128, '目标世界');
    const journal = this.readJournal(accountId);
    const entry = journal?.entries.find(value => value.plan.targetWorldId === targetWorldId);
    if (!entry || entry.phase !== 'Published' || entry.homeReply === null) {
      throw new Error('跨设备导入尚未完成服务与本地对账；拒绝打开');
    }
    const plan = this.plan(entry.plan);
    this.assertLease(plan);
    const registry = this.requireBindings().parseRegistry(await this.authority().readRegistry(), accountId);
    this.assertLease(plan);
    this.assertRegistryHome(plan, registry, entry.homeReply);
    const latest = this.entry(plan);
    if (latest.phase !== 'Published' || !this.published(plan)) {
      throw new Error('跨设备导入发布凭据或目录已变化；拒绝打开');
    }
    this.verifyPublishedTarget(plan);
  }

  private async withDirectoryLock<T>(accountId: string, operation: () => T): Promise<T> {
    this.requireImportLock(accountId);
    if (this.locks === null) { throw new Error('当前环境没有目录独占锁；未发布导入世界'); }
    if (this.directoryAccounts.has(accountId)) { throw new Error('同一账号目录锁不可重入'); }
    return this.locks.request('neurou-world-folder:' + encodeURIComponent(accountId), async () => {
      if (this.directoryAccounts.has(accountId)) { throw new Error('目录锁适配器没有提供独占访问'); }
      this.directoryAccounts.add(accountId);
      try { return operation(); }
      finally { this.directoryAccounts.delete(accountId); }
    });
  }

  private plan(raw: unknown): CrossDeviceImportPlan {
    const plan = this.requireBindings().validatePlan(raw);
    if (plan.accountId !== this.context.accountId || plan.deviceId !== this.context.deviceId) {
      throw new Error('导入计划与绑定账号或接收设备不匹配');
    }
    return plan;
  }

  private entry(plan: CrossDeviceImportPlan): ImportEntry {
    const entry = this.readJournal(plan.accountId)?.entries.find(value => value.plan.transactionId === plan.transactionId);
    if (!entry) { throw new Error('完整导入计划尚未持久准备；未登记或发布'); }
    this.assertSamePlan(entry.plan, plan);
    return entry;
  }

  private updateEntry(plan: CrossDeviceImportPlan, entry: ImportEntry): void {
    this.requireImportLock(plan.accountId); this.assertLease(plan);
    const current = this.readJournal(plan.accountId);
    if (current === null) { throw new Error('导入日志已丢失；原始世界数据保留'); }
    this.entry(plan);
    const next: CrossDeviceImportJournal = { ...current,
      entries: current.entries.map(value => value.plan.transactionId === plan.transactionId ? entry : value) };
    this.writeJournal(next, current);
  }

  private writeJournal(raw: CrossDeviceImportJournal, expected: CrossDeviceImportJournal | null): void {
    this.requireImportLock(raw.accountId);
    const candidate = this.requireBindings().validateJournal(raw);
    if (candidate.accountId !== this.context.accountId || candidate.deviceId !== this.context.deviceId) {
      throw new Error('新导入日志与绑定身份不匹配；未写入');
    }
    if (JSON.stringify(this.readJournal(raw.accountId)) !== JSON.stringify(expected)) {
      throw new Error('导入日志已变化；禁止覆盖其他事务');
    }
    this.storage.setItem(this.journalKey(raw.accountId), JSON.stringify(candidate));
    if (JSON.stringify(this.readJournal(raw.accountId)) !== JSON.stringify(candidate)) {
      throw new Error('导入日志写入未持久成功；须恢复后重试');
    }
  }

  private published(plan: CrossDeviceImportPlan): boolean {
    const record = this.readFolder(plan.accountId).records.find(value => value.worldId === plan.targetWorldId);
    if (record === undefined) { return false; }
    if (JSON.stringify(record) !== JSON.stringify(plan.targetRecord)) {
      throw new Error('导入目标目录记录与日志冲突或已删除；原始数据已保留');
    }
    return true;
  }

  private verifyStagedTarget(plan: CrossDeviceImportPlan): void {
    if (JSON.stringify(this.readTarget(plan)) !== JSON.stringify(plan.targetState)) {
      throw new Error('导入目标 Core 与完整暂存计划不一致；禁止覆盖');
    }
  }

  private verifyPublishedTarget(plan: CrossDeviceImportPlan): void {
    const target = this.readTarget(plan);
    if (target === null || target.accountId !== plan.accountId || target.worldId !== plan.targetWorldId ||
        target.revision < plan.targetState.revision ||
        (target.revision === plan.targetState.revision && JSON.stringify(target) !== JSON.stringify(plan.targetState)) ||
        JSON.stringify(target.forkOrigin) !== JSON.stringify(plan.targetState.forkOrigin) ||
        JSON.stringify(target.sections.FormatTime) !== JSON.stringify(plan.targetState.sections.FormatTime)) {
      throw new Error('已发布导入 Core 身份、来源或创建时刻不一致；拒绝打开');
    }
  }

  private readTarget(plan: CrossDeviceImportPlan): WorldStateSnapshot | null {
    const value = this.requireBindings().readTarget(plan.accountId, plan.targetWorldId);
    requireSynchronous(value, '导入目标完整回读');
    if (value === null) { return null; }
    const target = this.requireBindings().validateCurrentTarget(value, plan.accountId, plan.targetWorldId);
    requireSynchronous(target, '导入目标完整解析');
    if (target.accountId !== plan.accountId || target.worldId !== plan.targetWorldId) {
      throw new Error('导入目标完整回读身份不匹配');
    }
    return target;
  }

  private readFolder(accountId: string): WorldFolderSnapshot {
    const bytes = this.storage.getItem(this.folderKey(accountId));
    if (bytes === null) { throw new Error('接收设备世界目录不存在；导入未发布'); }
    const folder = this.requireBindings().validateFolder(parseJson(bytes, '接收设备世界目录'), accountId);
    requireSynchronous(folder, '接收设备世界目录完整验证');
    if (folder.accountId !== accountId) { throw new Error('接收设备世界目录账号不匹配'); }
    return folder;
  }

  private assertReply(plan: CrossDeviceImportPlan, reply: WorldHomeRegistrationReply): void {
    if (reply.kind === 'HomeConflict' || reply.record.accountId !== plan.accountId ||
        reply.record.worldId !== plan.targetWorldId || reply.record.homeState !== 'Homed' ||
        reply.record.homeDeviceId !== this.context.deviceId || reply.record.homeRevision !== 1) {
      throw new Error('导入目标归属冲突或不支持；保留日志，未发布目标');
    }
  }

  private assertRegistryHome(plan: CrossDeviceImportPlan, registry: WorldHomeRegistrySnapshot,
    reply: WorldHomeRegistrationReply): void {
    const home = registry.records.find(record => record.worldId === plan.targetWorldId);
    if (registry.accountId !== plan.accountId || registry.registryRevision < reply.registryRevision ||
        registry.observedAtServerEpochMs < reply.observedAtServerEpochMs || !home ||
        home.accountId !== plan.accountId || home.homeState !== 'Homed' || home.homeRevision !== 1 ||
        home.homeDeviceId !== this.context.deviceId || JSON.stringify(home) !== JSON.stringify(reply.record)) {
      throw new Error('导入目标服务归属缺失、回退或冲突；等待对账，拒绝打开');
    }
  }

  private assertLease(plan: CrossDeviceImportPlan): void {
    requireSynchronous(this.requireBindings().assertTargetLease(plan), '导入目标真实租约检查');
  }

  private assertSamePlan(left: CrossDeviceImportPlan, right: CrossDeviceImportPlan): void {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error('导入事务标识被复用于不同计划；原始日志已保留');
    }
  }

  private authority(): CrossDeviceAuthorityPort {
    const authority = this.requireBindings().authority;
    if (!authority || authority.mode !== 'ContractAdapter' ||
        authority.context.accountId !== this.context.accountId || authority.context.deviceId !== this.context.deviceId ||
        typeof authority.readRegistry !== 'function' || typeof authority.registerWorldHome !== 'function') {
      throw new Error('跨设备契约权威不可用或绑定身份不匹配；未登记或打开');
    }
    return authority;
  }

  private assertAccount(accountId: string): void {
    validId(accountId, 64, '账号');
    if (accountId !== this.context.accountId) { throw new Error('导入存储不能跨越绑定账号读取或写入'); }
  }
  private requireImportLock(accountId: string): void {
    this.assertAccount(accountId);
    if (!this.importAccounts.has(accountId)) { throw new Error('跨设备导入须持有同一账号导入独占锁'); }
  }
  private requireBindings(): CrossDeviceImportStorageBindings {
    if (this.bindings === undefined) { throw new Error('跨设备导入完整验证器、权威及目标租约能力尚未装配'); }
    return this.bindings;
  }
  private folderKey(accountId: string): string { return 'neurou-world-folder-v1:' + encodeURIComponent(accountId); }
  private journalKey(accountId: string): string { return 'neurou-cross-device-import-v1:' + encodeURIComponent(accountId); }
}

function receipt(plan: CrossDeviceImportPlan, phase: ImportEntry['phase'], error: string | null): CrossDeviceImportReceipt {
  return Object.freeze({ kind: error === null && phase === 'Published' ? 'Published' as const : 'Pending' as const,
    mode: 'ContractAdapter' as const, transactionId: plan.transactionId,
    targetWorldId: plan.targetWorldId, phase, error });
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function parseJson(bytes: string, label: string): unknown {
  try { return JSON.parse(bytes) as unknown; }
  catch { throw new Error(label + ' JSON 损坏；原始数据已保留'); }
}
function requireSynchronous(result: unknown, label: string): void {
  if (result !== null && (typeof result === 'object' || typeof result === 'function') &&
      typeof (result as { then?: unknown }).then === 'function') {
    void Promise.resolve(result).catch(() => undefined);
    throw new Error(label + '必须同步完成；未将 Promise 当作持久成功');
  }
}
function validId(value: unknown, maximum: number, label: string): asserts value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) { throw new Error(label + '标识无效'); }
  try { encodeURIComponent(value); } catch { throw new Error(label + '标识编码无效'); }
}
function browserImportLock(): WorldStateLock | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) { return null; }
  return { request: <T>(name: string, operation: () => Promise<T>): Promise<T> =>
    navigator.locks.request(name, { mode: 'exclusive' }, operation) };
}
