import type { WorldCoreStateSnapshot } from '../director/IntentPort';

/** Browser capability; the callback must remain pending until its lease is released. */
export interface WorldStateLock {
  request<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

export interface WorldStateLease {
  release(): void;
  /** A queued account commit must settle before its outer world lease is freed. */
  retainUntil(operation: Promise<unknown>): void;
}

/**
 * Three-section adapter, separate from the seven-section WorldStateStorage.
 * A world lease must be held across graph activation, writes and World clear
 * submission. Lock ordering is world lease first, then the existing account lock.
 */
export class WorldCoreStateStorage {
  private readonly leases = new Map<string, { active: boolean; release: (() => void) | null }>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly worldLock: WorldStateLock | null = browserWorldLock(),
    private validateCore?: (
      raw: unknown, accountId: string, worldId: string,
    ) => WorldCoreStateSnapshot,
    private readonly isActive?: (accountId: string, worldId: string) => boolean,
  ) {}

  /** Composition-root wiring only; no data is read or written by binding a codec. */
  bindValidator(validator: (raw: unknown, accountId: string, worldId: string) => WorldCoreStateSnapshot): void {
    this.validateCore = validator;
  }

  validateCoreState(raw: unknown): WorldCoreStateSnapshot {
    const identity = snapshotIdentity(raw);
    return this.validate(raw, identity.accountId, identity.worldId);
  }

  /** Unknown JSON is never a validated or complete world state. Reads do not migrate. */
  readCoreState(accountId: string, worldId: string): unknown | null {
    const raw = this.storage.getItem(this.key(accountId, worldId));
    if (raw === null) { return null; }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('世界三项状态 JSON 损坏；原始数据已保留'); }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('世界三项状态存储格式无效；原始数据已保留');
    }
    return parsed;
  }

  readValidatedCoreState(accountId: string, worldId: string): WorldCoreStateSnapshot | null {
    const raw = this.readCoreState(accountId, worldId);
    return raw === null ? null : this.validate(raw, accountId, worldId);
  }

  /** Acquire once per runtime identity. A missing Web Locks capability rejects. */
  async acquireWorldLease(accountId: string, worldId: string): Promise<WorldStateLease> {
    const key = this.key(accountId, worldId);
    if (this.worldLock === null) { throw new Error('当前环境没有世界独占锁；未激活世界或写入存储'); }
    if (this.leases.has(key)) { throw new Error('本实例已持有或正在取得该世界独占锁'); }
    const pending = { active: false, release: null as (() => void) | null };
    this.leases.set(key, pending);
    return new Promise<WorldStateLease>((resolve, reject) => {
      const remove = (): void => { if (this.leases.get(key) === pending) { this.leases.delete(key); } };
      let request: Promise<void>;
      try { request = this.worldLock!.request('neurou-world-state:' + encodeURIComponent(accountId) + ':' +
        encodeURIComponent(worldId), async () => {
        pending.active = true;
        await new Promise<void>(release => {
          pending.release = release;
          let retained = 0; let releaseRequested = false;
          const finishRelease = (): void => {
            if (!pending.active || !releaseRequested || retained > 0) { return; }
            pending.active = false; remove(); release();
          };
          resolve(Object.freeze({
            release: (): void => { releaseRequested = true; finishRelease(); },
            retainUntil: (operation: Promise<unknown>): void => {
              if (!pending.active || releaseRequested) { throw new Error('世界租约已请求释放，不能登记新账号提交'); }
              retained++;
              const settled = (): void => { retained--; finishRelease(); };
              void Promise.resolve(operation).then(settled, settled);
            },
          }));
        });
        pending.active = false; remove();
      }); } catch (error: unknown) { remove(); reject(error); return; }
      // Keep the lock promise observed even after the acquired lease was returned.
      void request.catch((error: unknown) => {
        pending.active = false; pending.release?.(); remove(); reject(error);
      });
    });
  }

  /** Locked, re-read expected-state comparison plus monotonic revision; one key write. */
  saveCoreState(snapshot: WorldCoreStateSnapshot, expected: unknown | null): WorldCoreStateSnapshot {
    // Safely obtain identity before consulting a lease or invoking a validator.
    const identity = snapshotIdentity(snapshot);
    const key = this.key(identity.accountId, identity.worldId);
    if (this.leases.get(key)?.active !== true) { throw new Error('世界三项状态保存须持有该世界独占租约'); }
    if (this.isActive !== undefined && !this.isActive(identity.accountId, identity.worldId)) {
      throw new Error('世界不存在或已删除；世界三项状态未写入');
    }
    const candidate = this.validate(snapshot, identity.accountId, identity.worldId);
    const prior = expected === null ? null : this.validate(expected, identity.accountId, identity.worldId);
    const current = this.readValidatedCoreState(identity.accountId, identity.worldId);
    if (JSON.stringify(current) !== JSON.stringify(prior)) {
      throw new Error('世界三项状态版本已变化；拒绝陈旧写入');
    }
    if (JSON.stringify(candidate) === JSON.stringify(current)) { return candidate; }
    const nextRevision = prior === null ? 0 : prior.revision + 1;
    if (!Number.isSafeInteger(nextRevision) || candidate.revision !== nextRevision) {
      throw new Error('世界三项状态版本计数必须按持久版本递增');
    }
    if (prior !== null && JSON.stringify(candidate.sections.FormatTime) !== JSON.stringify(prior.sections.FormatTime)) {
      // In particular, an old missing FormatTime cannot be fabricated on re-entry.
      throw new Error('世界创建时刻不可修改或补写；历史缺失值保持不可用');
    }
    if (prior !== null) { preservePriorState(prior, candidate); }
    this.storage.setItem(key, JSON.stringify(candidate));
    return candidate;
  }

  private validate(raw: unknown, accountId: string, worldId: string): WorldCoreStateSnapshot {
    if (this.validateCore === undefined) { throw new Error('世界三项状态完整验证器尚未装配；未写入存储'); }
    const candidate = this.validateCore(raw, accountId, worldId);
    if (candidate.accountId !== accountId || candidate.worldId !== worldId || candidate.kind !== 'Core') {
      throw new Error('世界三项状态验证结果身份或文档种类不匹配');
    }
    return candidate;
  }

  private key(accountId: string, worldId: string): string {
    validId(accountId, 64, '账号'); validId(worldId, 128, '世界');
    return 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(worldId);
  }
}

function preservePriorState(prior: WorldCoreStateSnapshot, candidate: WorldCoreStateSnapshot): void {
  if (prior.worldKind !== 'Unavailable' && (candidate.worldKind !== prior.worldKind || candidate.shoreOrigin !== prior.shoreOrigin)) {
    throw new Error('已知世界种类与彼岸来源不可改写');
  }
  const previous = prior.sections.Ledger;
  const next = candidate.sections.Ledger;
  if (previous === null) { return; }
  if (next === null || previous.protagonistCharacterId !== next.protagonistCharacterId ||
      previous.contentId !== next.contentId || previous.contentRevision !== next.contentRevision) {
    throw new Error('权威账本身份或正式内容版本不可改写');
  }
  for (const character of previous.characters) {
    const updated = next.characters.find(item => item.characterId === character.characterId);
    if (updated === undefined || updated.events.length < character.events.length ||
        character.events.some((narrativeEvent, index) => JSON.stringify(narrativeEvent) !== JSON.stringify(updated.events[index]))) {
      throw new Error('持久账本已有事件必须保持原顺序与原值，不可删除或改写');
    }
  }
  if ((previous.control.selectedChoiceId !== null && next.control.selectedChoiceId !== previous.control.selectedChoiceId) ||
      (previous.control.sphereCrossed && !next.control.sphereCrossed) ||
      (previous.control.entry !== null && JSON.stringify(next.control.entry) !== JSON.stringify(previous.control.entry)) ||
      next.control.eventSequence < previous.control.eventSequence ||
      (previous.control.completionEventId !== null && next.control.completionEventId !== previous.control.completionEventId)) {
    throw new Error('已产生的账本业务事实或防重序号不可回退');
  }
}

function browserWorldLock(): WorldStateLock | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) { return null; }
  return { request: <T>(name: string, operation: () => Promise<T>): Promise<T> =>
    navigator.locks.request(name, { mode: 'exclusive' }, operation) };
}

function validId(raw: unknown, maximum: number, label: string): asserts raw is string {
  if (typeof raw !== 'string' || !raw || raw.length > maximum || raw !== raw.trim()) { throw new Error(label + '标识无效'); }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '标识编码无效'); }
}

function snapshotIdentity(raw: unknown): { readonly accountId: string; readonly worldId: string } {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(); }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) { throw new Error(); }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const account = descriptors.accountId; const world = descriptors.worldId;
    if (account === undefined || world === undefined ||
        !Object.prototype.hasOwnProperty.call(account, 'value') || !Object.prototype.hasOwnProperty.call(world, 'value')) {
      throw new Error();
    }
    const accountId: unknown = account.value; const worldId: unknown = world.value;
    validId(accountId, 64, '账号'); validId(worldId, 128, '世界');
    return Object.freeze({ accountId, worldId });
  } catch { throw new Error('世界三项状态身份无法安全读取'); }
}
