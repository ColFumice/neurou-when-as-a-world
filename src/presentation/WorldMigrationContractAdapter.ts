import type {
  WorldHomeContext, WorldHomeRecord, WorldHomeRegistrySnapshot, WorldHomeRegistrationRequest,
  WorldHomeRegistrationReply, MigrationAuthorityPort, SafePointDrainCapability, SafePointDrainConfirmation,
  SafePointDrainAcceptance, MigrationReleaseRequest, MigrationClaimRequest, RealityPauseRecord,
  DeviceAccountBinding, RestrictedMigrationCorePayload, MigrationReceipt, MigrationAdmission,
} from '../director/IntentPort';

export interface WorldMigrationAuthorityLock {
  request<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

/** This clock belongs to the shared service fixture; client clocks are never consulted. */
export interface WorldMigrationContractBindings {
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'>;
  readonly locks?: WorldMigrationAuthorityLock | null;
  readonly serviceNow: () => number;
  readonly offlineGraceMs: number;
  readonly parseContext: (raw: unknown) => WorldHomeContext;
  readonly parseRegistrationRequest: (raw: unknown) => WorldHomeRegistrationRequest;
  readonly parseRegistry: (raw: unknown, accountId: string) => WorldHomeRegistrySnapshot;
  readonly parseRegistrationReply: (raw: unknown, context: WorldHomeContext,
    request: WorldHomeRegistrationRequest) => WorldHomeRegistrationReply;
  readonly parseConfirmation: (raw: unknown, context?: WorldHomeContext) => SafePointDrainConfirmation;
  readonly parseDrainAcceptance: (raw: unknown, confirmation?: SafePointDrainConfirmation) => SafePointDrainAcceptance;
  readonly parseReleaseRequest: (raw: unknown) => MigrationReleaseRequest;
  readonly parseClaimRequest: (raw: unknown) => MigrationClaimRequest;
  readonly parsePause: (raw: unknown, accountId?: string) => RealityPauseRecord;
  readonly parseDeviceBinding: (raw: unknown, deviceId?: string) => DeviceAccountBinding;
  readonly parsePayload: (raw: unknown) => RestrictedMigrationCorePayload;
  readonly parseReceipt: (raw: unknown, payload?: RestrictedMigrationCorePayload) => MigrationReceipt;
  readonly parseAdmission: (raw: unknown, context?: WorldHomeContext, worldId?: string) => MigrationAdmission;
  readonly verifyDrainCapability: (raw: unknown) => boolean;
  readonly digestState: (state: RestrictedMigrationCorePayload['state']) => string;
}

interface MigrationValue {
  readonly releaseRequest: MigrationReleaseRequest;
  readonly payload: RestrictedMigrationCorePayload;
  receipt: MigrationReceipt;
  claim: { readonly deviceId: string; readonly request: MigrationClaimRequest } | null;
}
interface RegistrationValue {
  readonly context: WorldHomeContext;
  readonly request: WorldHomeRegistrationRequest;
  readonly initialKind: WorldHomeRegistrationReply['kind'];
}
interface AuthoritySnapshot {
  readonly schemaVersion: 1;
  readonly kind: 'ContractMigrationAuthority';
  observedAtServerEpochMs: number;
  registries: WorldHomeRegistrySnapshot[];
  migrations: MigrationValue[];
  bindings: DeviceAccountBinding[];
  registrations: RegistrationValue[];
}
interface AcceptedDrain {
  readonly capability: SafePointDrainCapability;
  readonly acceptance: SafePointDrainAcceptance;
}

/**
 * Persistent, shared ContractAdapter authority. This is a service fixture, not
 * external authentication. A single durable service snapshot commits ownership,
 * pause and device binding together; local world publication remains separate.
 */
export class WorldMigrationContractAdapter {
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  private readonly locks: WorldMigrationAuthorityLock | null;
  private readonly accepted = new Map<string, AcceptedDrain>();
  private available = true;
  private readonly pauseMs: number;
  private readonly key = 'neurou-migration-contract-authority-v1';

  constructor(private readonly bindings: WorldMigrationContractBindings) {
    this.bindings = Object.freeze({ ...bindings });
    this.storage = bindings.storage ?? localStorage;
    this.locks = bindings.locks === undefined ? browserAuthorityLock() : bindings.locks;
    if (!Number.isSafeInteger(bindings.offlineGraceMs) || bindings.offlineGraceMs < 0) {
      throw new Error('OfflineGrace 服务时长无效');
    }
    this.pauseMs = Math.max(60 * 60 * 1000, bindings.offlineGraceMs);
  }

  bindDevice(raw: WorldHomeContext): MigrationAuthorityPort {
    const context = this.bindings.parseContext(raw);
    return Object.freeze({ mode: 'ContractAdapter' as const, context,
      readRegistry: (): Promise<unknown> => this.operation(context, (state, now) => this.registry(state, context.accountId, now)),
      registerWorldHome: (request: WorldHomeRegistrationRequest): Promise<unknown> =>
        this.operation(context, (state, now) => this.register(state, context, request, now)),
      readAdmission: (worldId?: string): Promise<unknown> =>
        this.operation(context, (state, now) => this.admission(state, context, worldId, now)),
      acceptDrain: (capability: SafePointDrainCapability): Promise<unknown> => this.acceptDrain(context, capability),
      releaseMigration: (request: MigrationReleaseRequest, payload: RestrictedMigrationCorePayload): Promise<unknown> =>
        this.release(context, request, payload),
      readMigration: (migrationId: string): Promise<unknown> => this.operation(context, (state, now) => {
        identity(migrationId, '迁移');
        const migration = this.migration(state, context.accountId, migrationId);
        return migration ? this.observeReceipt(migration, now) : null;
      }),
      readMigrationPayload: (migrationId: string): Promise<unknown> => this.operation(context, state => {
        identity(migrationId, '迁移');
        const migration = this.migration(state, context.accountId, migrationId);
        return migration ? this.bindings.parsePayload(migration.payload) : null;
      }),
      claimMigration: (request: MigrationClaimRequest): Promise<unknown> =>
        this.operation(context, (state, now) => this.claim(state, context, request, now)),
      readDeviceBinding: (): Promise<unknown> => this.checkDeviceAccount(context),
    });
  }

  async checkDeviceAccount(raw: WorldHomeContext): Promise<DeviceAccountBinding> {
    const context = this.bindings.parseContext(raw);
    return this.operation(context, state => this.deviceBinding(state, context.deviceId));
  }

  /** Final synchronous read guard inside a local commit lock; never infers expiry. */
  assertAdmissionNow(raw: WorldHomeContext, worldId?: string): void {
    this.assertAvailable();
    const context = this.bindings.parseContext(raw), state = this.readSnapshot();
    this.assertDeviceBinding(state, context);
    this.requireAllowed(this.admission(state, context, worldId, state.observedAtServerEpochMs));
  }

  setAvailable(value: boolean): void {
    if (typeof value !== 'boolean') { throw new Error('服务可用性须为布尔值'); }
    this.available = value;
  }

  private async operation<T>(context: WorldHomeContext,
    action: (state: AuthoritySnapshot, now: number) => T,
    committed?: () => void): Promise<T> {
    this.assertAvailable();
    if (!this.locks) { throw new Error('无 Web Locks；迁移契约服务显式拒绝'); }
    return this.locks.request('neurou-migration-authority', async () => {
      this.assertAvailable();
      const state = this.readSnapshot(), now = this.bindings.serviceNow();
      if (!Number.isSafeInteger(now) || now < state.observedAtServerEpochMs || now < 0) {
        throw new Error('服务时间无效或回退；权威状态保留');
      }
      state.observedAtServerEpochMs = now;
      this.endPauses(state, now);
      this.assertDeviceBinding(state, context);
      const value = action(state, now);
      // Strict parsing finishes before a single durable publication. A failed
      // write consumes neither capability nor any global ownership transition.
      const validated = this.parseSnapshot(state);
      this.storage.setItem(this.key, JSON.stringify(validated));
      committed?.();
      return value;
    });
  }

  private async acceptDrain(context: WorldHomeContext, capability: SafePointDrainCapability): Promise<SafePointDrainAcceptance> {
    let accepted: AcceptedDrain | null = null;
    const result = await this.operation(context, (state, now) => {
      this.requireAllowed(this.admission(state, context, undefined, now));
      if (this.bindings.verifyDrainCapability(capability) !== true) { throw new Error('排空须来自当前真实持锁能力，不能接受序列化断言'); }
      capability.assertCurrent();
      const confirmation = this.bindings.parseConfirmation(capability.confirmation, context);
      const key = drainKey(context, confirmation.drainId);
      if (state.migrations.some(entry => entry.receipt.accountId === context.accountId &&
          entry.receipt.sourceDeviceId === context.deviceId && entry.releaseRequest.drainId === confirmation.drainId)) {
        throw new Error('排空确认已消费；新迁移必须重新主动排空');
      }
      const previous = this.accepted.get(key);
      if (previous) {
        if (previous.capability !== capability || JSON.stringify(previous.acceptance.confirmation) !== JSON.stringify(confirmation) ||
            now >= previous.acceptance.expiresAtServerEpochMs) {
          throw new Error('排空确认已过期或标识冲突；必须重新主动排空');
        }
        return this.bindings.parseDrainAcceptance(previous.acceptance, confirmation);
      }
      if (now > Number.MAX_SAFE_INTEGER - 30000) { throw new Error('服务排空确认截止时间溢出'); }
      const acceptance = this.bindings.parseDrainAcceptance({ schemaVersion: 1, confirmation,
        acceptedAtServerEpochMs: now, expiresAtServerEpochMs: now + 30000 }, confirmation);
      accepted = { capability, acceptance };
      return acceptance;
    }, () => {
      if (accepted) { this.accepted.set(drainKey(context, accepted.acceptance.confirmation.drainId), accepted); }
    });
    return result;
  }

  private async release(context: WorldHomeContext, rawRequest: MigrationReleaseRequest,
    rawPayload: RestrictedMigrationCorePayload): Promise<MigrationReceipt> {
    let consumedKey: string | null = null;
    return this.operation(context, (state, now) => {
      const request = this.bindings.parseReleaseRequest(rawRequest), payload = this.bindings.parsePayload(rawPayload);
      if (payload.state.accountId !== context.accountId || payload.sourceDeviceId !== context.deviceId ||
          payload.migrationId !== request.migrationId || payload.state.worldId !== request.worldId ||
          payload.expectedHomeRevision !== request.expectedHomeRevision) {
        throw new Error('迁移 Release 请求与绑定身份/载荷不匹配');
      }
      const previous = this.migration(state, context.accountId, request.migrationId);
      if (previous) {
        if (JSON.stringify(previous.releaseRequest) !== JSON.stringify(request) || JSON.stringify(previous.payload) !== JSON.stringify(payload)) {
          throw new Error('迁移标识已绑定其他请求或载荷；权威值保留');
        }
        return this.observeReceipt(previous, now);
      }
      this.requireAllowed(this.admission(state, context, request.worldId, now));
      const home = this.home(state, context.accountId, request.worldId);
      if (!home || home.homeState !== 'Homed' || home.homeDeviceId !== context.deviceId || home.homeRevision !== request.expectedHomeRevision) {
        throw new Error('Release 来源 HomeDevice 或 expectedHomeRevision 冲突');
      }
      const key = drainKey(context, request.drainId), accepted = this.accepted.get(key);
      if (state.migrations.some(entry => entry.receipt.accountId === context.accountId &&
          entry.receipt.sourceDeviceId === context.deviceId && entry.releaseRequest.drainId === request.drainId)) {
        throw new Error('排空确认已消费；不能用于另一个迁移');
      }
      if (!accepted || accepted.acceptance.expiresAtServerEpochMs <= now || this.bindings.verifyDrainCapability(accepted.capability) !== true) {
        throw new Error('排空确认已过期/撤销/消费；必须重新主动排空');
      }
      accepted.capability.assertCurrent();
      const confirmation = this.bindings.parseConfirmation(accepted.capability.confirmation, context);
      if (JSON.stringify(confirmation) !== JSON.stringify(accepted.acceptance.confirmation)) {
        throw new Error('排空确认已经改变');
      }
      const source = confirmation.worlds.find(world => world.worldId === request.worldId);
      if (!source || source.revision !== payload.state.revision || source.coreDigest !== this.bindings.digestState(payload.state)) {
        throw new Error('迁移载荷不是排空确认的精确世界状态');
      }
      if (now > Number.MAX_SAFE_INTEGER - this.pauseMs) { throw new Error('RealityPause 服务截止时间溢出'); }
      const pause = this.bindings.parsePause({ schemaVersion: 1, accountId: context.accountId,
        migrationId: request.migrationId, initiatingDeviceId: context.deviceId, startedAtServerEpochMs: now,
        resumeNotBeforeServerEpochMs: now + this.pauseMs, endedAtServerEpochMs: null }, context.accountId);
      const receipt = this.bindings.parseReceipt({ schemaVersion: 1, accountId: context.accountId,
        migrationId: request.migrationId, worldId: request.worldId, sourceDeviceId: context.deviceId,
        claimDeviceId: null, expectedHomeRevision: request.expectedHomeRevision, kind: 'PauseActive', record: home,
        pause, observedAtServerEpochMs: now }, payload);
      state.migrations.push({ releaseRequest: request, payload, receipt, claim: null });
      state.bindings.push(this.bindings.parseDeviceBinding({ schemaVersion: 1, deviceId: context.deviceId,
        boundAccountId: context.accountId, migrationId: request.migrationId, pause }, context.deviceId));
      consumedKey = key;
      return receipt;
    }, () => { if (consumedKey) { this.accepted.delete(consumedKey); } });
  }

  private claim(state: AuthoritySnapshot, context: WorldHomeContext, raw: MigrationClaimRequest, now: number): MigrationReceipt {
    const request = this.bindings.parseClaimRequest(raw), migration = this.migration(state, context.accountId, request.migrationId);
    if (!migration || migration.payload.state.worldId !== request.worldId || request.expectedHomeRevision !== migration.payload.expectedHomeRevision + 1) {
      throw new Error('Claim 缺少同账号迁移或 expectedHomeRevision 冲突');
    }
    if (migration.payload.sourceDeviceId === context.deviceId) { throw new Error('同一迁移的源设备不能 Claim 自己；迁回须新迁移'); }
    if (migration.claim) {
      if (migration.claim.deviceId !== context.deviceId || JSON.stringify(migration.claim.request) !== JSON.stringify(request)) {
        throw new Error('迁移已被其他 Claim 请求/设备认领');
      }
      return this.observeReceipt(migration, now);
    }
    if (migration.receipt.kind !== 'Released') { throw new Error('RealityPause 仍活动；服务尚未 Released'); }
    this.requireAllowed(this.admission(state, context, undefined, now));
    const home = this.home(state, context.accountId, request.worldId);
    if (!home || home.homeState !== 'Released' || home.homeRevision !== request.expectedHomeRevision) {
      throw new Error('Claim 当前权威归属冲突');
    }
    const record = this.replaceHome(state, context.accountId, { ...home, homeState: 'Homed', homeDeviceId: context.deviceId,
      homeRevision: home.homeRevision + 1, updatedAtServerEpochMs: now }, now);
    const receipt = this.bindings.parseReceipt({ ...migration.receipt, kind: 'Claimed', claimDeviceId: context.deviceId,
      record, observedAtServerEpochMs: now }, migration.payload);
    migration.receipt = receipt; migration.claim = { deviceId: context.deviceId, request };
    return receipt;
  }

  private endPauses(state: AuthoritySnapshot, now: number): void {
    for (const migration of state.migrations) {
      const receipt = migration.receipt;
      if (receipt.kind !== 'PauseActive' || now < receipt.pause.resumeNotBeforeServerEpochMs) { continue; }
      const home = this.home(state, receipt.accountId, receipt.worldId);
      if (!home || home.homeState !== 'Homed' || home.homeDeviceId !== receipt.sourceDeviceId || home.homeRevision !== receipt.expectedHomeRevision) {
        throw new Error('活动迁移与当前归属冲突；不猜测 Released');
      }
      const pause = this.bindings.parsePause({ ...receipt.pause, endedAtServerEpochMs: now }, receipt.accountId);
      const record = this.replaceHome(state, receipt.accountId, { ...home, homeState: 'Released', homeDeviceId: null,
        homeRevision: home.homeRevision + 1, updatedAtServerEpochMs: now }, now);
      migration.receipt = this.bindings.parseReceipt({ ...receipt, kind: 'Released', pause, record,
        observedAtServerEpochMs: now }, migration.payload);
      state.bindings = state.bindings.filter(binding => binding.migrationId !== receipt.migrationId || binding.boundAccountId !== receipt.accountId);
    }
  }

  private register(state: AuthoritySnapshot, context: WorldHomeContext, raw: WorldHomeRegistrationRequest, now: number): WorldHomeRegistrationReply {
    const request = this.bindings.parseRegistrationRequest(raw);
    this.requireAllowed(this.admission(state, context, undefined, now));
    const replay = state.registrations.find(value => value.context.accountId === context.accountId &&
      value.context.deviceId === context.deviceId && value.request.registrationId === request.registrationId);
    if (replay && replay.request.worldId !== request.worldId) { throw new Error('登记标识不可绑定另一个世界'); }
    let home = this.home(state, context.accountId, request.worldId), kind: WorldHomeRegistrationReply['kind'];
    if (!home) {
      if (replay) { throw new Error('登记回放的世界归属缺失'); }
      home = this.replaceHome(state, context.accountId, { schemaVersion: 1, accountId: context.accountId,
        worldId: request.worldId, homeState: 'Homed', homeDeviceId: context.deviceId, homeRevision: 1,
        updatedAtServerEpochMs: now }, now); kind = 'Registered';
    } else {
      if (home.homeState === 'Released') { throw new Error('Released 世界必须通过 MigrationClaim；不可重新登记夺取'); }
      kind = home.homeDeviceId === context.deviceId ? 'AlreadyHomed' : 'HomeConflict';
      if (replay && home.homeRevision === 1) { kind = replay.initialKind; }
    }
    const registry = this.registry(state, context.accountId, now);
    const reply = this.bindings.parseRegistrationReply({ schemaVersion: 1, ...context,
      registrationId: request.registrationId, kind, registryRevision: registry.registryRevision,
      observedAtServerEpochMs: now, record: home }, context, request);
    if (!replay) { state.registrations.push({ context, request, initialKind: kind }); }
    return reply;
  }

  private admission(state: AuthoritySnapshot, context: WorldHomeContext, worldId: string | undefined, now: number): MigrationAdmission {
    if (worldId !== undefined) { identity(worldId, '世界'); }
    const pause = state.migrations.find(value => value.receipt.accountId === context.accountId &&
      value.receipt.pause.endedAtServerEpochMs === null)?.receipt.pause ?? null;
    const record = worldId === undefined || worldId === 'InitialWorld' ? null : this.home(state, context.accountId, worldId);
    const kind = pause ? 'PauseActive' : record?.homeState === 'Released' ? 'Released' :
      record && record.homeDeviceId !== context.deviceId ? 'Migrated' : 'Allowed';
    return this.bindings.parseAdmission({ schemaVersion: 1, ...context, worldId: worldId ?? null, kind,
      record, pause, observedAtServerEpochMs: now }, context, worldId);
  }
  private requireAllowed(admission: MigrationAdmission): void {
    if (admission.kind !== 'Allowed') { throw new Error(admission.kind + ': 账号/世界当前拒绝准入'); }
  }
  private registry(state: AuthoritySnapshot, accountId: string, now: number): WorldHomeRegistrySnapshot {
    const previous = state.registries.find(value => value.accountId === accountId);
    return this.bindings.parseRegistry({ schemaVersion: 1, accountId, registryRevision: previous?.registryRevision ?? 0,
      observedAtServerEpochMs: now, records: previous?.records ?? [] }, accountId);
  }
  private home(state: AuthoritySnapshot, accountId: string, worldId: string): WorldHomeRecord | null {
    return state.registries.find(value => value.accountId === accountId)?.records.find(record => record.worldId === worldId) ?? null;
  }
  private replaceHome(state: AuthoritySnapshot, accountId: string, record: WorldHomeRecord, now: number): WorldHomeRecord {
    const previous = this.registry(state, accountId, now);
    const next = this.bindings.parseRegistry({ ...previous, registryRevision: previous.registryRevision + 1,
      records: [...previous.records.filter(value => value.worldId !== record.worldId), record] }, accountId);
    state.registries = [...state.registries.filter(value => value.accountId !== accountId), next];
    return next.records.find(value => value.worldId === record.worldId)!;
  }
  private migration(state: AuthoritySnapshot, accountId: string, migrationId: string): MigrationValue | undefined {
    return state.migrations.find(value => value.receipt.accountId === accountId && value.receipt.migrationId === migrationId);
  }
  private observeReceipt(migration: MigrationValue, now: number): MigrationReceipt {
    return this.bindings.parseReceipt({ ...migration.receipt, observedAtServerEpochMs: now }, migration.payload);
  }
  private deviceBinding(state: AuthoritySnapshot, deviceId: string): DeviceAccountBinding {
    return this.bindings.parseDeviceBinding(state.bindings.find(value => value.deviceId === deviceId) ??
      { schemaVersion: 1, deviceId, boundAccountId: null, migrationId: null, pause: null }, deviceId);
  }
  private assertDeviceBinding(state: AuthoritySnapshot, context: WorldHomeContext): void {
    const binding = this.deviceBinding(state, context.deviceId);
    if (binding.boundAccountId !== null && binding.boundAccountId !== context.accountId) {
      throw new Error('DeviceAccountBinding: 发起设备冷静期内不可切换账号');
    }
  }
  private assertAvailable(): void {
    if (!this.available) { throw new Error('迁移契约服务不可用；拒绝准入，权威状态保留'); }
  }
  private readSnapshot(): AuthoritySnapshot {
    const text = this.storage.getItem(this.key);
    if (text === null) { return { schemaVersion: 1, kind: 'ContractMigrationAuthority', observedAtServerEpochMs: 0,
      registries: [], migrations: [], bindings: [], registrations: [] }; }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error('持久迁移契约服务 JSON 损坏；拒绝准入'); }
    return this.parseSnapshot(raw);
  }

  private parseSnapshot(raw: unknown): AuthoritySnapshot {
    const value = fields(raw, ['schemaVersion', 'kind', 'observedAtServerEpochMs', 'registries', 'migrations', 'bindings', 'registrations']);
    if (value.schemaVersion !== 1 || value.kind !== 'ContractMigrationAuthority' || !Number.isSafeInteger(value.observedAtServerEpochMs) ||
        (value.observedAtServerEpochMs as number) < 0) { throw new Error('持久迁移契约服务 schema/time 无效'); }
    const now = value.observedAtServerEpochMs as number;
    const registries = array(value.registries).map(rawRegistry => {
      const record = fields(rawRegistry, ['schemaVersion', 'accountId', 'registryRevision', 'observedAtServerEpochMs', 'records']);
      identity(record.accountId, '账号');
      const parsed = this.bindings.parseRegistry(rawRegistry, record.accountId as string);
      if (parsed.observedAtServerEpochMs > now) { throw new Error('归属观察时刻超出服务快照'); }
      return parsed;
    });
    unique(registries.map(registry => registry.accountId), '账号索引');
    const migrations = array(value.migrations).map(rawMigration => {
      const entry = fields(rawMigration, ['releaseRequest', 'payload', 'receipt', 'claim']);
      const releaseRequest = this.bindings.parseReleaseRequest(entry.releaseRequest), payload = this.bindings.parsePayload(entry.payload);
      const receipt = this.bindings.parseReceipt(entry.receipt, payload);
      if (releaseRequest.migrationId !== payload.migrationId || releaseRequest.worldId !== payload.state.worldId ||
          releaseRequest.expectedHomeRevision !== payload.expectedHomeRevision || receipt.observedAtServerEpochMs > now ||
          receipt.pause.resumeNotBeforeServerEpochMs - receipt.pause.startedAtServerEpochMs < this.pauseMs) {
        throw new Error('持久迁移请求/载荷/receipt 不一致');
      }
      let claim: MigrationValue['claim'] = null;
      if (entry.claim !== null) {
        const claimed = fields(entry.claim, ['deviceId', 'request']); identity(claimed.deviceId, 'Claim设备');
        const request = this.bindings.parseClaimRequest(claimed.request);
        if (request.migrationId !== payload.migrationId || request.worldId !== payload.state.worldId ||
            request.expectedHomeRevision !== payload.expectedHomeRevision + 1 || receipt.kind !== 'Claimed' || receipt.claimDeviceId !== claimed.deviceId) {
          throw new Error('持久 Claim 与迁移 receipt 不一致');
        }
        claim = { deviceId: claimed.deviceId as string, request };
      } else if (receipt.kind === 'Claimed') { throw new Error('持久 Claimed 缺少原始 Claim 请求'); }
      return { releaseRequest, payload, receipt, claim };
    });
    unique(migrations.map(entry => JSON.stringify([entry.receipt.accountId, entry.receipt.migrationId])), '迁移标识');
    const active = migrations.filter(entry => entry.receipt.kind === 'PauseActive');
    unique(active.map(entry => entry.receipt.accountId), '活动账号暂停');
    unique(active.map(entry => entry.receipt.sourceDeviceId), '活动发起设备');
    const deviceBindings = array(value.bindings).map(binding => this.bindings.parseDeviceBinding(binding));
    unique(deviceBindings.map(binding => binding.deviceId), '设备绑定');
    for (const binding of deviceBindings) {
      const migration = active.find(entry => entry.receipt.accountId === binding.boundAccountId && entry.receipt.migrationId === binding.migrationId);
      if (!migration || migration.receipt.sourceDeviceId !== binding.deviceId || JSON.stringify(binding.pause) !== JSON.stringify(migration.receipt.pause)) {
        throw new Error('持久设备绑定与当前活动暂停不一致');
      }
    }
    if (deviceBindings.length !== active.length) { throw new Error('活动暂停缺少设备绑定'); }
    for (const migration of migrations) {
      const current = registries.find(registry => registry.accountId === migration.receipt.accountId)?.records
        .find(record => record.worldId === migration.receipt.worldId);
      if (!current || current.homeRevision < migration.receipt.record.homeRevision ||
          ((migration.receipt.kind !== 'Claimed' || current.homeRevision === migration.receipt.record.homeRevision) &&
            JSON.stringify(current) !== JSON.stringify(migration.receipt.record))) {
        throw new Error('持久迁移与当前归属索引不一致');
      }
    }
    const registrations = array(value.registrations).map(rawReplay => {
      const replay = fields(rawReplay, ['context', 'request', 'initialKind']);
      const context = this.bindings.parseContext(replay.context), request = this.bindings.parseRegistrationRequest(replay.request);
      if (replay.initialKind !== 'Registered' && replay.initialKind !== 'AlreadyHomed' && replay.initialKind !== 'HomeConflict') {
        throw new Error('持久登记回放结果无效');
      }
      if (!registries.find(registry => registry.accountId === context.accountId)?.records.some(record => record.worldId === request.worldId)) {
        throw new Error('持久登记回放缺少对应世界');
      }
      return { context, request, initialKind: replay.initialKind as WorldHomeRegistrationReply['kind'] };
    });
    unique(registrations.map(entry => JSON.stringify([entry.context.accountId, entry.context.deviceId, entry.request.registrationId])), '登记回放');
    return { schemaVersion: 1, kind: 'ContractMigrationAuthority', observedAtServerEpochMs: now, registries,
      migrations, bindings: deviceBindings, registrations };
  }
}

function browserAuthorityLock(): WorldMigrationAuthorityLock | null {
  if (typeof navigator === 'undefined' || !navigator.locks) { return null; }
  return { request: (name, operation) => navigator.locks.request(name, () => operation()) };
}
function drainKey(context: WorldHomeContext, drainId: string): string { return JSON.stringify([context.accountId, context.deviceId, drainId]); }
function identity(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128 || value !== value.trim()) { throw new Error(label + '身份无效'); }
  try { encodeURIComponent(value); } catch { throw new Error(label + '身份编码无效'); }
}
function fields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) { throw new Error('服务快照对象无效'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw), keys = Reflect.ownKeys(raw);
  if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key))) { throw new Error('服务快照字段不严格'); }
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) { throw new Error('服务快照字段不是data-only值'); }
    result[name] = descriptor.value;
  }
  return result;
}
function array(raw: unknown): unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype ||
      Reflect.ownKeys(raw).length !== raw.length + 1) { throw new Error('服务快照数组不严格'); }
  const result: unknown[] = [];
  for (let index = 0; index < raw.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) { throw new Error('服务快照数组不稠密或存在getter'); }
    result.push(descriptor.value);
  }
  return result;
}
function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) { throw new Error('服务快照' + label + '重复'); }
}
