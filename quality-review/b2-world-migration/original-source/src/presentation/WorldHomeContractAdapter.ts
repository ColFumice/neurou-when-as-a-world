import type {
  WorldHomeContext, WorldHomeAuthorityPort, WorldHomeRegistrationRequest,
  WorldHomeRegistrationReply, WorldHomeRegistrySnapshot,
} from '../director/IntentPort';

/** Strict codec callbacks are supplied by a composition root; no director value import. */
export interface WorldHomeContractBindings {
  readonly now: () => number;
  readonly validateContext: (raw: unknown) => WorldHomeContext;
  readonly validateRequest: (raw: unknown) => WorldHomeRegistrationRequest;
  readonly validateSnapshot: (raw: unknown, expectedAccountId: string) => WorldHomeRegistrySnapshot;
  readonly validateReply: (raw: unknown, context: WorldHomeContext,
    request: WorldHomeRegistrationRequest) => WorldHomeRegistrationReply;
}

type RecordValue = WorldHomeRegistrySnapshot['records'][number];
interface ReplayValue {
  readonly worldId: string;
  readonly kind: WorldHomeRegistrationReply['kind'];
  readonly record: RecordValue;
}

/**
 * A shared, in-memory authority for contract tests using two bound logical devices.
 * Binding is a test seam, not authentication. This adapter has no network, clock
 * fallback, platform locks, storage writes, gameplay state or ownership transfers.
 */
export class WorldHomeContractAdapter {
  private readonly bindings: WorldHomeContractBindings;
  private readonly accounts = new Map<string, WorldHomeRegistrySnapshot>();
  private readonly replays = new Map<string, ReplayValue>();
  private available = true;
  private operating = false;

  constructor(bindings: WorldHomeContractBindings) {
    this.bindings = Object.freeze({
      now: bindings.now, validateContext: bindings.validateContext,
      validateRequest: bindings.validateRequest, validateSnapshot: bindings.validateSnapshot,
      validateReply: bindings.validateReply,
    });
  }

  bindDevice(context: WorldHomeContext): WorldHomeAuthorityPort {
    const validated = this.bindings.validateContext(context);
    const bound = Object.freeze({ accountId: validated.accountId, deviceId: validated.deviceId });
    return Object.freeze({
      mode: 'ContractAdapter' as const, context: bound,
      readRegistry: async (): Promise<unknown> => this.operation(() => this.read(bound)),
      registerWorldHome: async (request: WorldHomeRegistrationRequest): Promise<unknown> =>
        this.operation(() => this.register(bound, request)),
    });
  }

  setAvailable(available: boolean): void {
    if (typeof available !== 'boolean') { throw new Error('归属契约服务可用性须为布尔值'); }
    if (this.operating) { throw new Error('归属契约服务操作期间不能切换可用性'); }
    this.available = available;
  }

  /** No await occurs inside the authority operation or before its publication. */
  private operation<T>(callback: () => T): T {
    if (!this.available) { throw new Error('归属契约服务不可用；未读取或登记世界归属'); }
    if (this.operating) { throw new Error('归属契约服务操作不可重入'); }
    this.operating = true;
    try { return callback(); }
    finally { this.operating = false; }
  }

  private read(context: WorldHomeContext): WorldHomeRegistrySnapshot {
    const previous = this.accounts.get(context.accountId);
    const observedAtServerEpochMs = this.sampleTime(previous);
    const candidate = this.snapshot(context.accountId,
      previous?.registryRevision ?? 0, observedAtServerEpochMs, previous?.records ?? []);
    // Tracking a successful observation creates no world and advances no revision.
    this.accounts.set(context.accountId, candidate);
    return copySnapshot(candidate);
  }

  private register(context: WorldHomeContext,
    raw: WorldHomeRegistrationRequest): WorldHomeRegistrationReply {
    const validated = this.bindings.validateRequest(raw);
    const request = Object.freeze({ schemaVersion: validated.schemaVersion,
      worldId: validated.worldId, registrationId: validated.registrationId });
    const key = JSON.stringify([context.accountId, context.deviceId, request.registrationId]);
    const replay = this.replays.get(key);
    if (replay && replay.worldId !== request.worldId) {
      throw new Error('同一归属登记标识不可用于另一个世界；已有归属未改变');
    }
    const previous = this.accounts.get(context.accountId);
    const observedAtServerEpochMs = this.sampleTime(previous);
    const records = previous?.records ?? [];
    const existing = records.find(record => record.worldId === request.worldId);
    let registryRevision = previous?.registryRevision ?? 0;
    let nextRecords = records;
    let kind: WorldHomeRegistrationReply['kind'];
    let record: RecordValue;
    if (replay) {
      kind = replay.kind;
      record = replay.record;
    } else if (existing) {
      kind = existing.homeDeviceId === context.deviceId ? 'AlreadyHomed' : 'HomeConflict';
      record = existing;
    } else {
      kind = 'Registered';
      registryRevision += 1;
      record = Object.freeze({ schemaVersion: 1, accountId: context.accountId,
        worldId: request.worldId, homeState: 'Homed', homeDeviceId: context.deviceId,
        homeRevision: 1, updatedAtServerEpochMs: observedAtServerEpochMs });
      nextRecords = [...records, record];
    }
    const candidate = this.snapshot(context.accountId, registryRevision,
      observedAtServerEpochMs, nextRecords);
    const reply = copyReply(this.bindings.validateReply({ schemaVersion: 1,
      accountId: context.accountId, deviceId: context.deviceId,
      registrationId: request.registrationId, kind,
      registryRevision, observedAtServerEpochMs, record: copyRecord(record) }, context, request));
    // All clock/schema/identity callbacks finish before either authority map changes.
    this.accounts.set(context.accountId, candidate);
    if (!replay) {
      this.replays.set(key, Object.freeze({ worldId: request.worldId,
        kind: reply.kind, record: copyRecord(reply.record) }));
    }
    return copyReply(reply);
  }

  private snapshot(accountId: string, registryRevision: number,
    observedAtServerEpochMs: number, records: readonly RecordValue[]): WorldHomeRegistrySnapshot {
    return copySnapshot(this.bindings.validateSnapshot({ schemaVersion: 1,
      accountId, registryRevision, observedAtServerEpochMs,
      records: records.map(copyRecord).sort((left, right) =>
        left.worldId < right.worldId ? -1 : left.worldId > right.worldId ? 1 : 0) }, accountId));
  }

  private sampleTime(previous: WorldHomeRegistrySnapshot | undefined): number {
    const sample = this.bindings.now();
    if (typeof sample !== 'number' || !Number.isSafeInteger(sample) || sample < 0 ||
        (previous !== undefined && sample < previous.observedAtServerEpochMs)) {
      throw new Error('归属契约服务时间无效或回退；已有归属未改变');
    }
    return sample;
  }
}

function copyRecord(record: RecordValue): RecordValue {
  return Object.freeze({ schemaVersion: record.schemaVersion, accountId: record.accountId,
    worldId: record.worldId, homeState: record.homeState, homeDeviceId: record.homeDeviceId,
    homeRevision: record.homeRevision, updatedAtServerEpochMs: record.updatedAtServerEpochMs });
}

function copySnapshot(snapshot: WorldHomeRegistrySnapshot): WorldHomeRegistrySnapshot {
  return Object.freeze({ schemaVersion: snapshot.schemaVersion, accountId: snapshot.accountId,
    registryRevision: snapshot.registryRevision, observedAtServerEpochMs: snapshot.observedAtServerEpochMs,
    records: Object.freeze(snapshot.records.map(copyRecord)) });
}

function copyReply(reply: WorldHomeRegistrationReply): WorldHomeRegistrationReply {
  return Object.freeze({ schemaVersion: reply.schemaVersion, accountId: reply.accountId,
    deviceId: reply.deviceId, registrationId: reply.registrationId, kind: reply.kind,
    registryRevision: reply.registryRevision, observedAtServerEpochMs: reply.observedAtServerEpochMs,
    record: copyRecord(reply.record) });
}
