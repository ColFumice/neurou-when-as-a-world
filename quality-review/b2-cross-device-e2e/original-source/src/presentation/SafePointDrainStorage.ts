import type { WorldCoreStateSnapshot, WorldFolderSnapshot, WorldHomeContext, SafePointDrainCapability,
  SafePointDrainConfirmation, SafePointDrainPort, WorldClearRecord } from '../director/IntentPort';
import type { WorldStateLease, WorldStateLock } from './WorldCoreStateStorage';

export interface SafePointDrainAccountFacts {
  readonly records: readonly WorldClearRecord[];
  readonly FirstWorldCleared: boolean;
}
export interface SafePointDrainBindings {
  readonly context: WorldHomeContext;
  /** Root closes new inputs/entries before any asynchronous work; never destroys an active graph. */
  readonly holdAdmission: () => { assertClosed(): void; release(): void };
  readonly assertRuntimeSafe: () => void;
  readonly assertNoPendingTransactions: () => void;
  readonly readFolder: () => unknown;
  readonly validateFolder: (raw: unknown, accountId: string) => WorldFolderSnapshot;
  readonly readCore: (worldId: string) => unknown;
  readonly validateCore: (raw: unknown, accountId: string, worldId: string) => WorldCoreStateSnapshot;
  /** These facts come from validated account storage, not a transferred world payload. */
  readonly readAccountFacts: () => SafePointDrainAccountFacts;
  readonly acquireWorldLease: (worldId: string) => Promise<WorldStateLease>;
  readonly hasWorldLease: (worldId: string) => boolean;
  readonly digest: (raw: unknown) => string;
  readonly validateConfirmation: (raw: unknown) => SafePointDrainConfirmation;
  readonly createDrainId: () => string;
  /** Composition may share the journal adapter's current coordination-lock capability. */
  readonly withCoordination?: <T>(operation: () => Promise<T>) => Promise<T>;
}

const liveCapabilities = new WeakSet<object>();
/** Authority uses this production issuer identity, in addition to assertCurrent and service TTL. */
export function isLiveSafePointDrainCapability(raw: unknown): raw is SafePointDrainCapability {
  return raw !== null && typeof raw === 'object' && liveCapabilities.has(raw);
}

/** No local time proves drain. A capability remains valid only while these real leases are held. */
export class SafePointDrainStorage implements SafePointDrainPort {
  private draining = false;
  constructor(private readonly bindings: SafePointDrainBindings, private readonly locks: WorldStateLock | null = browserLocks()) {}

  async withDrain<T>(operation: (capability: SafePointDrainCapability) => Promise<T>): Promise<T> {
    if (this.draining) { throw new Error('账号排空不可重入'); }
    if (!this.locks) { throw new Error('无 Web Locks；不能确认账号排空'); }
    const context = this.bindings.context;
    validId(context.accountId, 64); validId(context.deviceId, 128);
    this.draining = true;
    let gate: { assertClosed(): void; release(): void } | null = null;
    try {
      gate = this.bindings.holdAdmission();
      const heldGate = gate;
      const coordinate = this.bindings.withCoordination ?? (<R>(body: () => Promise<R>): Promise<R> =>
        this.locks!.request('neurou-cross-device:' + encodeURIComponent(context.accountId), body));
      return await coordinate(async () => {
        heldGate.assertClosed(); this.bindings.assertRuntimeSafe(); this.bindings.assertNoPendingTransactions();
        const initial = this.folder(), worlds = initial.records.filter(record => record.deletedAt === null)
          .map(record => record.worldId).sort(), leases: WorldStateLease[] = [];
        try {
          for (const worldId of worlds) {
            heldGate.assertClosed(); this.bindings.assertRuntimeSafe();
            leases.push(await this.bindings.acquireWorldLease(worldId));
          }
          return await this.locks!.request('neurou-world-clear:' + encodeURIComponent(context.accountId), async () => {
            let capability: SafePointDrainCapability | null = null;
            await this.locks!.request('neurou-world-folder:' + encodeURIComponent(context.accountId), async () => {
              heldGate.assertClosed(); this.bindings.assertRuntimeSafe(); this.bindings.assertNoPendingTransactions();
              const folder = this.folder();
              if (this.bindings.digest(folder) !== this.bindings.digest(initial)) { throw new Error('目录在获取世界租约期间变化；排空撤销'); }
              const states = worlds.map(worldId => this.core(worldId));
              const facts = this.accountFacts(states), factsDigest = this.bindings.digest(facts);
              const confirmation = this.bindings.validateConfirmation({ schemaVersion: 1, accountId: context.accountId,
                sourceDeviceId: context.deviceId, drainId: this.bindings.createDrainId(), directoryDigest: this.bindings.digest(folder),
                worlds: states.map(state => ({ worldId: state.worldId, revision: state.revision, coreDigest: this.bindings.digest(state) })) });
              let revoked = false;
              const issued: SafePointDrainCapability = Object.freeze({ confirmation,
                assertCurrent: (): void => {
                  try {
                    if (revoked || !liveCapabilities.has(issued)) { throw new Error('排空确认已撤销或已消费'); }
                    heldGate.assertClosed(); this.bindings.assertRuntimeSafe(); this.bindings.assertNoPendingTransactions();
                    if (this.bindings.digest(this.folder()) !== confirmation.directoryDigest) { throw new Error('排空后目录变化'); }
                    const current = worlds.map(worldId => this.core(worldId));
                    if (current.some((state, index) => state.revision !== confirmation.worlds[index].revision ||
                        this.bindings.digest(state) !== confirmation.worlds[index].coreDigest) ||
                        this.bindings.digest(this.accountFacts(current)) !== factsDigest) { throw new Error('排空后 Core 或账号事实变化'); }
                  } catch (error: unknown) { issued.revoke(); throw error; }
                },
                revoke: (): void => { revoked = true; liveCapabilities.delete(issued); },
              });
              liveCapabilities.add(issued); issued.assertCurrent(); capability = issued;
            });
            // Service await is outside the final directory lock. World/account leases and gate remain held.
            if (capability === null) { throw new Error('排空确认未签发'); }
            const issued: SafePointDrainCapability = capability;
            try { issued.assertCurrent(); return await operation(issued); }
            finally { issued.revoke(); }
          });
        } finally { for (const lease of [...leases].reverse()) { lease.release(); } }
      });
    } finally { try { gate?.release(); } finally { this.draining = false; } }
  }

  private folder(): WorldFolderSnapshot {
    const accountId = this.bindings.context.accountId;
    const result = this.bindings.validateFolder(this.bindings.readFolder(), accountId);
    if (result.accountId !== accountId || !result.records.some(record => record.worldId === 'InitialWorld' && record.deletedAt === null)) {
      throw new Error('账号排空目录身份或 InitialWorld 缺失');
    }
    return result;
  }
  private core(worldId: string): WorldCoreStateSnapshot {
    const accountId = this.bindings.context.accountId;
    if (!this.bindings.hasWorldLease(worldId)) { throw new Error('排空必须持有每个世界的真实独占 lease'); }
    const raw = this.bindings.readCore(worldId), state = this.bindings.validateCore(raw, accountId, worldId);
    if (state.accountId !== accountId || state.worldId !== worldId || state.kind !== 'Core' ||
        this.bindings.digest(raw) !== this.bindings.digest(state)) { throw new Error('排空 Core 身份/内容与持久值不一致'); }
    if (!state.sections.FormatTime) { throw new Error('排空世界缺少不可补造的 FormatTime'); }
    if (state.worldKind === 'Unavailable') {
      if (state.shoreOrigin !== 'Unavailable' || state.sections.Ledger !== null || state.sections.PuzzleProgress !== null || state.forkOrigin) {
        throw new Error('未知/空世界的排空状态矛盾');
      }
    } else if (!state.sections.Ledger || !state.sections.PuzzleProgress?.length) {
      throw new Error('UnsupportedBoundary: 正式世界缺少稳定 Ledger/Puzzle Core，不可宣称排空');
    }
    return state;
  }
  private accountFacts(states: readonly WorldCoreStateSnapshot[]): SafePointDrainAccountFacts {
    const facts = this.bindings.readAccountFacts(), accountId = this.bindings.context.accountId;
    if (!facts || !Array.isArray(facts.records) || typeof facts.FirstWorldCleared !== 'boolean') { throw new Error('账号排空事实读取无效'); }
    if (facts.records.length > 0 && !facts.FirstWorldCleared) { throw new Error('账号事实投影尚未结算'); }
    const ids = new Set<string>();
    for (const record of facts.records) {
      if (record.accountId !== accountId || ids.has(record.worldId)) { throw new Error('账号通关记录身份或重复事实无效'); }
      ids.add(record.worldId);
    }
    for (const state of states) {
      const ledger = state.sections.Ledger, completion = ledger?.control.completionEventId;
      if (!completion || state.forkOrigin?.inheritedCompletionEventId === completion) { continue; }
      const record = facts.records.find(item => item.worldId === state.worldId);
      const event = ledger!.characters.find(character => character.characterId === ledger!.protagonistCharacterId)!
        .events.find(item => item.eventId === completion);
      if (!record || record.completionEventId !== completion || record.protagonistCharacterId !== ledger!.protagonistCharacterId ||
          record.contentRevision !== ledger!.contentRevision || !event || this.bindings.digest(record.ChartRef) !== this.bindings.digest(event.ChartRef) ||
          this.bindings.digest(record.clearedAt) !== this.bindings.digest(event.AppendedAt)) { throw new Error('未提交的账号通关事实；须真实重试结算后排空'); }
    }
    return facts;
  }
}
function browserLocks(): WorldStateLock | null {
  if (typeof navigator === 'undefined' || !navigator.locks) { return null; }
  return { request: (name, operation) => navigator.locks.request(name, { mode: 'exclusive' }, operation) };
}
function validId(value: string, maximum: number): void {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) { throw new Error('排空上下文身份无效'); }
  try { encodeURIComponent(value); } catch { throw new Error('排空上下文身份编码无效'); }
}
