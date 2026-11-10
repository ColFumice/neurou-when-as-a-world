import type { WorldForkPlan, WorldFolderSnapshot, WorldStateSnapshot } from '../director/IntentPort';
import type { WorldStateLock } from './WorldCoreStateStorage';

export interface WorldForkStorageBindings {
  validatePlan(raw: unknown): WorldForkPlan;
  validateFolder(raw: unknown, accountId: string): WorldFolderSnapshot;
  /** Re-read active, Complete source under the source world lease. */
  validateSource(plan: WorldForkPlan): void;
  /** Must reject before a journal write unless this target's world lease is held. */
  assertTargetLease(plan: WorldForkPlan): void;
  writeTarget(state: WorldStateSnapshot): void;
  /** Root verifies the target is unpublished and the exact expected bytes still exist. */
  deleteTargetExpected(state: WorldStateSnapshot, expectedRaw: string): void;
}

export type WorldForkCommitResult =
  | { readonly kind: 'Committed'; readonly transactionId: string; readonly targetWorldId: string;
      readonly cleanupPending: boolean; readonly error: string | null }
  | { readonly kind: 'Pending'; readonly transactionId: string; readonly targetWorldId: string;
      readonly phase: 'Rollback'; readonly error: string };

export type WorldForkRecoveryResult = WorldForkCommitResult
  | { readonly kind: 'NoPending' }
  | { readonly kind: 'RolledBack'; readonly transactionId: string; readonly targetWorldId: string };

interface WorldForkJournal {
  readonly schemaVersion: 1;
  readonly kind: 'PendingWorldFork';
  readonly accountId: string;
  readonly plan: WorldForkPlan;
}

/**
 * A short-lived journal bridges two atomic localStorage writes. The target Core
 * precedes directory publication; the directory append is the sole commit point.
 * No source state, account fact or long-lived lineage registry is written here.
 */
export class WorldForkStorage {
  private readonly directoryAccounts = new Set<string>();
  private readonly mutationAccounts = new Set<string>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
    private readonly locks: WorldStateLock | null = browserDirectoryLock(),
    private readonly bindings?: WorldForkStorageBindings,
  ) {}

  /** World leases are acquired outside this final lock, never inside its callback. */
  async withDirectoryLock<T>(accountId: string, operation: () => T | Promise<T>): Promise<T> {
    validId(accountId, 64, '账号');
    if (this.locks === null) { throw new Error('当前环境没有目录独占锁；未写入世界分叉或目录'); }
    if (this.directoryAccounts.has(accountId)) { throw new Error('同一账号目录锁不可重入'); }
    return this.locks.request('neurou-world-folder:' + encodeURIComponent(accountId), async () => {
      if (this.directoryAccounts.has(accountId)) { throw new Error('目录锁适配器没有提供独占访问'); }
      this.directoryAccounts.add(accountId);
      try { return await operation(); }
      finally { this.directoryAccounts.delete(accountId); }
    });
  }

  /** Pure inspection lets the root discover a pending target before taking its lease. */
  readPending(accountId: string): WorldForkJournal | null {
    validId(accountId, 64, '账号');
    const bytes = this.storage.getItem(this.journalKey(accountId));
    if (bytes === null) { return null; }
    const raw = parseJson(bytes, '世界分叉日志');
    const value = fields(raw, ['schemaVersion', 'kind', 'accountId', 'plan']);
    if (value.schemaVersion !== 1 || value.kind !== 'PendingWorldFork' || value.accountId !== accountId) {
      throw new Error('世界分叉日志版本、类型或账号不匹配；原始数据已保留');
    }
    const plan = this.plan(value.plan);
    if (plan.accountId !== accountId) { throw new Error('世界分叉日志计划与账号不匹配'); }
    return Object.freeze({ schemaVersion: 1, kind: 'PendingWorldFork', accountId, plan });
  }

  /** Every ordinary directory create/delete writer shares this guard and lock. */
  assertNoPending(accountId: string): void {
    this.requireDirectoryLock(accountId);
    if (this.readPending(accountId) !== null) { throw new Error('世界分叉事务尚未恢复；目录操作未发布，请刷新重试'); }
  }

  /** Synchronous journal, target and folder writes inside the held directory lock. */
  commitWorldFork(raw: WorldForkPlan, expectedFolder: unknown): WorldForkCommitResult {
    const plan = this.plan(raw);
    return this.mutate(plan.accountId, () => {
      const bindings = this.requireBindings();
      requireSynchronous(bindings.assertTargetLease(plan), '目标租约检查');
      this.assertNoPending(plan.accountId);
      const current = this.readFolder(plan.accountId);
      if (current.records.some(record => record.worldId === plan.targetWorldId)) {
        if (this.published(plan)) { this.verifyTarget(plan); return committed(plan, false, null); }
      }
      requireSynchronous(bindings.validateSource(plan), '来源权威检查');
      const expected = bindings.validateFolder(expectedFolder, plan.accountId);
      if (JSON.stringify(current) !== JSON.stringify(expected)) { throw new Error('世界目录已变化；拒绝陈旧分叉计划'); }
      if (this.targetBytes(plan) !== null) {
        throw new Error('分叉目标标识已存在或曾被删除；禁止覆盖');
      }
      const folder = bindings.validateFolder({ ...current, records: [...current.records, plan.targetRecord] }, plan.accountId);
      const journal: WorldForkJournal = { schemaVersion: 1, kind: 'PendingWorldFork', accountId: plan.accountId, plan };
      // An atomic journal failure has no other side effect and needs no rollback.
      this.storage.setItem(this.journalKey(plan.accountId), JSON.stringify(journal));
      try {
        requireSynchronous(bindings.writeTarget(plan.targetState), '目标持久提交');
        this.verifyTarget(plan);
        // Compare again immediately before the commit point; callbacks cannot erase another directory update.
        if (JSON.stringify(this.readFolder(plan.accountId)) !== JSON.stringify(current)) {
          throw new Error('世界目录已在暂存期间变化；目标未发布');
        }
        this.storage.setItem(this.folderKey(plan.accountId), JSON.stringify(folder));
      } catch (error: unknown) {
        // The published record decides the outcome even if an adapter threw after a successful atomic write.
        const published = this.published(plan);
        if (published) { return this.finishCommitted(plan); }
        try { this.rollback(plan); }
        catch (rollbackError: unknown) { return pending(plan, errorText(error) + '；回滚待重试：' + errorText(rollbackError)); }
        throw error;
      }
      return this.finishCommitted(plan);
    });
  }

  /** Recovery only needs the pending target lease; source changes cannot undo a committed fork. */
  recoverWorldFork(accountId: string): WorldForkRecoveryResult {
    return this.mutate(accountId, () => {
      const journal = this.readPending(accountId);
      if (journal === null) { return Object.freeze({ kind: 'NoPending' as const }); }
      const plan = journal.plan;
      requireSynchronous(this.requireBindings().assertTargetLease(plan), '目标租约检查');
      if (this.published(plan)) {
        // No gameplay may open a pending target. Its original staged document must still match.
        if (this.targetBytes(plan) === null) { requireSynchronous(this.requireBindings().writeTarget(plan.targetState), '目标持久提交'); }
        this.verifyTarget(plan);
        return this.finishCommitted(plan);
      }
      try { this.rollback(plan); }
      catch (error: unknown) { return pending(plan, errorText(error)); }
      return Object.freeze({ kind: 'RolledBack' as const, transactionId: plan.transactionId, targetWorldId: plan.targetWorldId });
    });
  }

  private published(plan: WorldForkPlan): boolean {
    const record = this.readFolder(plan.accountId).records.find(value => value.worldId === plan.targetWorldId);
    if (record === undefined) { return false; }
    if (JSON.stringify(record) !== JSON.stringify(plan.targetRecord)) {
      throw new Error('分叉目标目录记录与日志冲突；原始目录、状态与日志均保留');
    }
    return true;
  }

  private verifyTarget(plan: WorldForkPlan): string {
    const bytes = this.targetBytes(plan);
    if (bytes === null || JSON.stringify(parseJson(bytes, '分叉目标状态')) !== JSON.stringify(plan.targetState)) {
      throw new Error('分叉目标状态与完整暂存计划不一致；原始数据已保留');
    }
    return bytes;
  }

  private rollback(plan: WorldForkPlan): void {
    const bytes = this.targetBytes(plan);
    if (bytes !== null) {
      this.verifyTarget(plan);
      requireSynchronous(this.requireBindings().deleteTargetExpected(plan.targetState, bytes), '目标暂存回滚');
      if (this.targetBytes(plan) !== null) { throw new Error('分叉暂存状态尚未成功移除'); }
    }
    this.removeJournal(plan);
  }

  private finishCommitted(plan: WorldForkPlan): WorldForkCommitResult {
    try {
      this.verifyTarget(plan);
      this.removeJournal(plan);
      return committed(plan, false, null);
    } catch (error: unknown) { return committed(plan, true, errorText(error)); }
  }

  private removeJournal(plan: WorldForkPlan): void {
    const current = this.readPending(plan.accountId);
    if (current === null || JSON.stringify(current.plan) !== JSON.stringify(plan)) {
      throw new Error('世界分叉日志已变化；禁止清理其他事务');
    }
    this.storage.removeItem(this.journalKey(plan.accountId));
    if (this.storage.getItem(this.journalKey(plan.accountId)) !== null) { throw new Error('世界分叉日志清理未完成'); }
  }

  private plan(raw: unknown): WorldForkPlan {
    const value = this.requireBindings().validatePlan(raw);
    const data = fields(value, ['schemaVersion', 'accountId', 'transactionId', 'sourceWorldId', 'targetWorldId',
      'sourceRevision', 'sourceDigest', 'targetRecord', 'targetState']);
    if (data.schemaVersion !== 1) { throw new Error('分叉计划版本不受支持'); }
    validId(data.accountId, 64, '账号'); validId(data.transactionId, 128, '分叉事务');
    validId(data.sourceWorldId, 128, '来源世界'); validId(data.targetWorldId, 128, '目标世界');
    if (data.sourceWorldId === data.targetWorldId || typeof data.sourceRevision !== 'number' ||
        !Number.isSafeInteger(data.sourceRevision) || data.sourceRevision < 0 ||
        typeof data.sourceDigest !== 'string' || !/^[0-9a-f]{64}$/u.test(data.sourceDigest)) {
      throw new Error('分叉来源版本、摘要或新目标身份无效');
    }
    const state = data.targetState as WorldStateSnapshot;
    const record = data.targetRecord as WorldForkPlan['targetRecord'];
    if (state.accountId !== data.accountId || state.worldId !== data.targetWorldId || state.revision !== 0 ||
        record.worldId !== data.targetWorldId || record.deletedAt !== null) { throw new Error('分叉目标状态与目录身份不一致'); }
    return value;
  }

  private readFolder(accountId: string): WorldFolderSnapshot {
    const bytes = this.storage.getItem(this.folderKey(accountId));
    if (bytes === null) { throw new Error('世界目录不存在；分叉事务未发布'); }
    return this.requireBindings().validateFolder(parseJson(bytes, '世界目录'), accountId);
  }

  private mutate<T>(accountId: string, operation: () => T): T {
    this.requireDirectoryLock(accountId);
    if (this.mutationAccounts.has(accountId)) { throw new Error('世界分叉存储提交不可重入'); }
    this.mutationAccounts.add(accountId);
    try { return operation(); }
    finally { this.mutationAccounts.delete(accountId); }
  }

  private requireDirectoryLock(accountId: string): void {
    validId(accountId, 64, '账号');
    if (!this.directoryAccounts.has(accountId)) { throw new Error('世界分叉和目录操作须持有同一账号目录独占锁'); }
  }
  private requireBindings(): WorldForkStorageBindings {
    if (this.bindings === undefined) { throw new Error('世界分叉完整验证器及持租约写入能力尚未装配'); }
    return this.bindings;
  }
  private targetBytes(plan: WorldForkPlan): string | null {
    return this.storage.getItem('neurou-world-state-v1:' + encodeURIComponent(plan.accountId) + ':' + encodeURIComponent(plan.targetWorldId));
  }
  private folderKey(accountId: string): string { return 'neurou-world-folder-v1:' + encodeURIComponent(accountId); }
  private journalKey(accountId: string): string { return 'neurou-world-fork-journal-v1:' + encodeURIComponent(accountId); }
}

function committed(plan: WorldForkPlan, cleanupPending: boolean, error: string | null): WorldForkCommitResult {
  return Object.freeze({ kind: 'Committed', transactionId: plan.transactionId, targetWorldId: plan.targetWorldId, cleanupPending, error });
}
function pending(plan: WorldForkPlan, error: string): WorldForkCommitResult {
  return Object.freeze({ kind: 'Pending', transactionId: plan.transactionId, targetWorldId: plan.targetWorldId, phase: 'Rollback', error });
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function requireSynchronous(result: unknown, label: string): void {
  if (result !== null && (typeof result === 'object' || typeof result === 'function') &&
      typeof (result as { then?: unknown }).then === 'function') {
    // Observe accidental async failures, but never treat their unresolved result as durable authority.
    void Promise.resolve(result).catch(() => undefined);
    throw new Error(label + '必须同步完成；未将 Promise 当作持久成功');
  }
}
function parseJson(bytes: string, label: string): unknown {
  try { return JSON.parse(bytes) as unknown; }
  catch { throw new Error(label + ' JSON 损坏；原始数据已保留'); }
}
function validId(value: unknown, maximum: number, label: string): asserts value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) { throw new Error(label + '标识无效'); }
  try { encodeURIComponent(value); } catch { throw new Error(label + '标识编码无效'); }
}
function fields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(); }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) { throw new Error(); }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(); }
    const data: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error(); }
      data[name] = descriptor.value;
    }
    return data;
  } catch { throw new Error('世界分叉日志或计划须为严格自有数据字段'); }
}
function browserDirectoryLock(): WorldStateLock | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) { return null; }
  return { request: <T>(name: string, operation: () => Promise<T>): Promise<T> =>
    navigator.locks.request(name, { mode: 'exclusive' }, operation) };
}
