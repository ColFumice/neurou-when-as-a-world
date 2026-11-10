/** B2.4b / VERDICT-301~310: lightweight account/device ownership only. */
export type HomeState = 'Homed' | 'Released';

export interface WorldHomeContext {
  readonly accountId: string;
  readonly deviceId: string;
}

export interface WorldHomeRecord {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly homeState: HomeState;
  readonly homeDeviceId: string | null;
  readonly homeRevision: number;
  readonly updatedAtServerEpochMs: number;
}

export interface WorldHomeRegistrySnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly registryRevision: number;
  readonly observedAtServerEpochMs: number;
  readonly records: readonly WorldHomeRecord[];
}

/** Identity is supplied by the bound authority session, never by this request. */
export interface WorldHomeRegistrationRequest {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly registrationId: string;
}

export interface WorldHomeRegistrationReply {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly deviceId: string;
  readonly registrationId: string;
  readonly kind: 'Registered' | 'AlreadyHomed' | 'HomeConflict';
  readonly registryRevision: number;
  readonly observedAtServerEpochMs: number;
  readonly record: WorldHomeRecord;
}

export interface WorldHomeRegistryDiagnostic {
  readonly code: 'ExcludedWorld' | 'InvalidLocalDirectory' | 'WorldUnavailable'
    | 'ServiceUnavailable' | 'InvalidAuthorityResponse' | 'InvalidRequest';
  readonly accountId: string;
  readonly deviceId: string;
  readonly worldId: string | null;
  readonly detail: string;
}

export type WorldHomeRegistryReadResult =
  | { readonly kind: 'Available'; readonly mode: 'ContractAdapter'; readonly snapshot: WorldHomeRegistrySnapshot }
  | { readonly kind: 'Unavailable'; readonly mode: 'ContractAdapter'; readonly diagnostic: WorldHomeRegistryDiagnostic };

export type WorldHomeRegistrationResult =
  | { readonly kind: 'Registered' | 'AlreadyHomed' | 'HomeConflict'; readonly mode: 'ContractAdapter';
      readonly reply: WorldHomeRegistrationReply }
  | { readonly kind: 'Unavailable'; readonly mode: 'ContractAdapter'; readonly diagnostic: WorldHomeRegistryDiagnostic;
      readonly registrationId: string | null };

/** Contract identity binding is a fixture, not real authentication. */
export interface WorldHomeAuthorityPort {
  readonly mode: 'ContractAdapter';
  readonly context: WorldHomeContext;
  readRegistry(): Promise<unknown>;
  registerWorldHome(request: WorldHomeRegistrationRequest): Promise<unknown>;
}

export interface WorldHomeRegistryBindings {
  readonly authority: WorldHomeAuthorityPort | null;
  readonly readFolder: () => unknown;
  readonly createRegistrationId: () => string;
}

/** Strict data-only copies. Released is decoded for schema compatibility, never produced here. */
export class WorldHomeRegistryCodec {
  parseContext(raw: unknown): WorldHomeContext {
    const data = fields(raw, ['accountId', 'deviceId']);
    identity(data.accountId, 64, '账号'); identity(data.deviceId, 128, '设备');
    return Object.freeze({ accountId: data.accountId, deviceId: data.deviceId });
  }

  parseRegistrationRequest(raw: unknown): WorldHomeRegistrationRequest {
    const data = fields(raw, ['schemaVersion', 'worldId', 'registrationId']);
    version(data.schemaVersion); worldIdentity(data.worldId); identity(data.registrationId, 128, '登记请求');
    return Object.freeze({ schemaVersion: 1, worldId: data.worldId, registrationId: data.registrationId });
  }

  parseRecord(raw: unknown, expectedAccountId: string): WorldHomeRecord {
    identity(expectedAccountId, 64, '账号');
    const data = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'homeState', 'homeDeviceId',
      'homeRevision', 'updatedAtServerEpochMs']);
    version(data.schemaVersion); identity(data.accountId, 64, '账号'); worldIdentity(data.worldId);
    if (data.accountId !== expectedAccountId) { throw new Error('归属记录账号不匹配'); }
    if (data.homeState === 'Homed') { identity(data.homeDeviceId, 128, '归属设备'); }
    else if (data.homeState !== 'Released' || data.homeDeviceId !== null) { throw new Error('归属状态与设备不匹配'); }
    integer(data.homeRevision, 1, '归属版本'); integer(data.updatedAtServerEpochMs, 0, '服务更新时间');
    return Object.freeze({ schemaVersion: 1, accountId: data.accountId, worldId: data.worldId,
      homeState: data.homeState as HomeState, homeDeviceId: data.homeDeviceId as string | null,
      homeRevision: data.homeRevision, updatedAtServerEpochMs: data.updatedAtServerEpochMs });
  }

  parseSnapshot(raw: unknown, expectedAccountId: string): WorldHomeRegistrySnapshot {
    identity(expectedAccountId, 64, '账号');
    const data = fields(raw, ['schemaVersion', 'accountId', 'registryRevision', 'observedAtServerEpochMs', 'records']);
    version(data.schemaVersion); identity(data.accountId, 64, '账号');
    if (data.accountId !== expectedAccountId) { throw new Error('归属索引账号不匹配'); }
    integer(data.registryRevision, 0, '索引版本'); integer(data.observedAtServerEpochMs, 0, '服务观察时间');
    const ids = new Set<string>();
    const records = arrayData(data.records).map(item => {
      const record = this.parseRecord(item, expectedAccountId);
      if (ids.has(record.worldId)) { throw new Error('归属索引世界重复'); }
      ids.add(record.worldId);
      if (record.homeRevision > (data.registryRevision as number) ||
          record.updatedAtServerEpochMs > (data.observedAtServerEpochMs as number)) {
        throw new Error('归属记录版本或时刻超出索引观察边界');
      }
      return record;
    });
    if (records.length > data.registryRevision || (records.length === 0 && data.registryRevision !== 0)) {
      throw new Error('归属索引计数与版本不一致');
    }
    records.sort((a, b) => a.worldId < b.worldId ? -1 : a.worldId > b.worldId ? 1 : 0);
    return Object.freeze({ schemaVersion: 1, accountId: data.accountId, registryRevision: data.registryRevision,
      observedAtServerEpochMs: data.observedAtServerEpochMs, records: Object.freeze(records) });
  }

  parseRegistrationReply(raw: unknown, context: WorldHomeContext,
    request: WorldHomeRegistrationRequest): WorldHomeRegistrationReply {
    const expected = this.parseContext(context), input = this.parseRegistrationRequest(request);
    const data = fields(raw, ['schemaVersion', 'accountId', 'deviceId', 'registrationId', 'kind',
      'registryRevision', 'observedAtServerEpochMs', 'record']);
    version(data.schemaVersion); identity(data.accountId, 64, '账号'); identity(data.deviceId, 128, '设备');
    identity(data.registrationId, 128, '登记请求');
    if (data.accountId !== expected.accountId || data.deviceId !== expected.deviceId ||
        data.registrationId !== input.registrationId) { throw new Error('登记响应会话或请求身份不匹配'); }
    integer(data.registryRevision, 1, '索引版本'); integer(data.observedAtServerEpochMs, 0, '服务观察时间');
    const record = this.parseRecord(data.record, expected.accountId);
    if (record.worldId !== input.worldId || record.homeState !== 'Homed' ||
        record.homeRevision > data.registryRevision || record.updatedAtServerEpochMs > data.observedAtServerEpochMs) {
      throw new Error('登记响应世界或版本/时刻不匹配');
    }
    if (data.kind === 'Registered' || data.kind === 'AlreadyHomed') {
      if (record.homeDeviceId !== expected.deviceId) { throw new Error('登记成功响应并不属于当前设备'); }
    } else if (data.kind !== 'HomeConflict' || record.homeDeviceId === expected.deviceId) {
      throw new Error('登记响应结果与归属设备不匹配');
    }
    if (data.kind === 'Registered' && record.homeRevision !== 1) { throw new Error('首次登记必须为归属版本一'); }
    return Object.freeze({ schemaVersion: 1, accountId: data.accountId, deviceId: data.deviceId,
      registrationId: data.registrationId, kind: data.kind as WorldHomeRegistrationReply['kind'],
      registryRevision: data.registryRevision, observedAtServerEpochMs: data.observedAtServerEpochMs, record });
  }
}

/** No world writes, clock calls or permission changes. Every success has a fresh authority response. */
export class WorldHomeRegistrySession {
  private readonly context: WorldHomeContext;
  private readonly codec = new WorldHomeRegistryCodec();
  private readonly requests = new Map<string, WorldHomeRegistrationRequest>();
  private readonly observedRecords = new Map<string, WorldHomeRecord>();
  private observedRevision = 0;

  constructor(context: WorldHomeContext, private readonly bindings: WorldHomeRegistryBindings) {
    this.context = this.codec.parseContext(context);
  }

  async readRegistry(): Promise<WorldHomeRegistryReadResult> {
    let authority: WorldHomeAuthorityPort;
    try { authority = this.requireAuthority(); }
    catch (error: unknown) { return this.readFailure(this.bindings.authority === null ? 'ServiceUnavailable'
      : 'InvalidAuthorityResponse', error); }
    let raw: unknown;
    try { raw = await authority.readRegistry(); }
    catch (error: unknown) { return this.readFailure('ServiceUnavailable', error); }
    try {
      const snapshot = this.codec.parseSnapshot(raw, this.context.accountId);
      this.validateObservation(snapshot.registryRevision, snapshot.records, true);
      this.rememberObservation(snapshot.registryRevision, snapshot.records);
      return Object.freeze({ kind: 'Available', mode: 'ContractAdapter', snapshot });
    } catch (error: unknown) { return this.readFailure('InvalidAuthorityResponse', error); }
  }

  async registerWorldHome(worldId: string): Promise<WorldHomeRegistrationResult> {
    if (worldId === 'InitialWorld') { return this.registrationFailure('ExcludedWorld', worldId, null,
      'InitialWorld 不参与跨设备归属登记'); }
    try { worldIdentity(worldId); }
    catch (error: unknown) { return this.registrationFailure('InvalidRequest', null, null, error); }
    let active: boolean;
    try { active = activeLocalWorld(this.bindings.readFolder(), this.context.accountId, worldId); }
    catch (error: unknown) { return this.registrationFailure('InvalidLocalDirectory', worldId, null, error); }
    if (!active) { return this.registrationFailure('WorldUnavailable', worldId, null, '世界未知或已删除，未登记'); }
    let authority: WorldHomeAuthorityPort;
    try { authority = this.requireAuthority(); }
    catch (error: unknown) { return this.registrationFailure(this.bindings.authority === null ? 'ServiceUnavailable'
      : 'InvalidAuthorityResponse', worldId, null, error); }
    let request: WorldHomeRegistrationRequest;
    try {
      const prior = this.requests.get(worldId);
      request = prior || this.codec.parseRegistrationRequest({ schemaVersion: 1, worldId,
        registrationId: this.bindings.createRegistrationId() });
      if (!prior && Array.from(this.requests.values()).some(item => item.registrationId === request.registrationId)) {
        throw new Error('登记 ID 工厂复用了其他世界的请求身份');
      }
      this.requests.set(worldId, request);
    } catch (error: unknown) { return this.registrationFailure('InvalidRequest', worldId, null, error); }
    let raw: unknown;
    try { raw = await authority.registerWorldHome(request); }
    catch (error: unknown) { return this.registrationFailure('ServiceUnavailable', worldId, request.registrationId, error); }
    try {
      const reply = this.codec.parseRegistrationReply(raw, this.context, request);
      this.validateObservation(reply.registryRevision, [reply.record], false);
      this.rememberObservation(reply.registryRevision, [reply.record]);
      return Object.freeze({ kind: reply.kind, mode: 'ContractAdapter', reply });
    } catch (error: unknown) {
      return this.registrationFailure('InvalidAuthorityResponse', worldId, request.registrationId, error);
    }
  }

  private requireAuthority(): WorldHomeAuthorityPort {
    const authority = this.bindings.authority;
    if (authority === null) { throw new Error('没有共享权威服务适配器，未使用本地归属替代'); }
    const bound = this.codec.parseContext(authority.context);
    if (authority.mode !== 'ContractAdapter' || bound.accountId !== this.context.accountId ||
        bound.deviceId !== this.context.deviceId || typeof authority.readRegistry !== 'function' ||
        typeof authority.registerWorldHome !== 'function') { throw new Error('归属端口的模式或绑定会话不匹配'); }
    return authority;
  }

  private validateObservation(revision: number, records: readonly WorldHomeRecord[], full: boolean): void {
    if (revision < this.observedRevision) { throw new Error('服务索引版本回退，未使用陈旧归属'); }
    if ((full && records.length !== revision) || records.some(record =>
      record.homeState !== 'Homed' || record.homeRevision !== 1)) {
      throw new Error('B2.4b 仅支持首次登记索引，不执行释放或归属版本变更');
    }
    const incoming = new Map(records.map(record => [record.worldId, record]));
    if (new Set([...this.observedRecords.keys(), ...incoming.keys()]).size > revision) {
      throw new Error('服务索引版本不足以包含已观察的全部归属');
    }
    for (const [worldId, previous] of this.observedRecords) {
      const next = incoming.get(worldId);
      if (full && !next) { throw new Error('已观察归属从服务索引消失'); }
      if (next && JSON.stringify(previous) !== JSON.stringify(next)) {
        throw new Error('B2.4b 不支持已登记归属修改或迁移');
      }
    }
  }

  private rememberObservation(revision: number, records: readonly WorldHomeRecord[]): void {
    this.observedRevision = revision;
    for (const record of records) { this.observedRecords.set(record.worldId, record); }
  }

  private diagnostic(code: WorldHomeRegistryDiagnostic['code'], worldId: string | null,
    error: unknown): WorldHomeRegistryDiagnostic {
    return Object.freeze({ code, accountId: this.context.accountId, deviceId: this.context.deviceId,
      worldId, detail: error instanceof Error ? error.message : typeof error === 'string' ? error : '归属操作失败，未使用未验证数据' });
  }

  private readFailure(code: WorldHomeRegistryDiagnostic['code'], error: unknown): WorldHomeRegistryReadResult {
    return Object.freeze({ kind: 'Unavailable', mode: 'ContractAdapter', diagnostic: this.diagnostic(code, null, error) });
  }

  private registrationFailure(code: WorldHomeRegistryDiagnostic['code'], worldId: string | null,
    registrationId: string | null, error: unknown): WorldHomeRegistrationResult {
    return Object.freeze({ kind: 'Unavailable', mode: 'ContractAdapter', registrationId,
      diagnostic: this.diagnostic(code, worldId, error) });
  }
}

/** Read the existing local metadata schema without constructing/mutating its session. */
function activeLocalWorld(raw: unknown, accountId: string, worldId: string): boolean {
  const data = fields(raw, ['schemaVersion', 'accountId', 'records']);
  version(data.schemaVersion); identity(data.accountId, 64, '目录账号');
  if (data.accountId !== accountId) { throw new Error('本机来源目录账号不匹配'); }
  const ids = new Set<string>();
  let active = false;
  for (const item of arrayData(data.records)) {
    const record = fields(item, ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template']);
    if (record.worldId !== 'InitialWorld') { worldIdentity(record.worldId); }
    if (typeof record.worldId !== 'string' || ids.has(record.worldId)) { throw new Error('本机目录世界重复或身份无效'); }
    ids.add(record.worldId);
    if (record.template !== (record.worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld')) {
      throw new Error('本机目录模板与身份不匹配');
    }
    text(record.title, 1, 80); text(record.description, 0, 300); integer(record.createdAt, 0, '创建时间');
    if (record.deletedAt !== null) {
      integer(record.deletedAt, 0, '删除时间');
      if (record.deletedAt < record.createdAt) { throw new Error('目录删除时间早于创建时间'); }
    }
    if (record.worldId === worldId) { active = record.deletedAt === null; }
  }
  return active;
}

function fields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(); }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) { throw new Error(); }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Reflect.ownKeys(descriptors).length !== names.length || !names.every(name => {
      const descriptor = descriptors[name];
      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    })) { throw new Error(); }
    const data: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names) { data[name] = descriptors[name].value; }
    return data;
  } catch { throw new Error('归属契约必须为严格自有数据字段，禁止未知字段或访问器'); }
}

function arrayData(raw: unknown): readonly unknown[] {
  try {
    if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error(); }
    const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
    const length: unknown = descriptors.length?.value;
    integer(length, 0, '数组长度');
    if (Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error(); }
    const values: unknown[] = [];
    for (let i = 0; i < length; i++) {
      const descriptor = descriptors[String(i)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error(); }
      values.push(descriptor.value);
    }
    return values;
  } catch { throw new Error('归属契约数组必须稠密且只含数据索引'); }
}

function identity(raw: unknown, maximum: number, label: string): asserts raw is string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(label + '身份格式无效');
  }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '身份编码无效'); }
}

function worldIdentity(raw: unknown): asserts raw is string {
  identity(raw, 128, '世界');
  if (!/^world-[A-Za-z0-9-]{1,80}$/.test(raw)) { throw new Error('跨设备索引只接受非 InitialWorld 的合法自建世界 ID'); }
}

function version(raw: unknown): void {
  if (raw !== 1) { throw new Error('归属契约版本不支持'); }
}

function integer(raw: unknown, minimum: number, label: string): asserts raw is number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < minimum) { throw new Error(label + '须为规定范围内安全整数'); }
}

function text(raw: unknown, minimum: number, maximum: number): void {
  if (typeof raw !== 'string' || raw.length < minimum || raw.length > maximum || raw !== raw.trim()) {
    throw new Error('本机目录文字格式无效');
  }
}
