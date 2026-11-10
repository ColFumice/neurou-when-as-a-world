import type { WorldHomeAuthorityPort, WorldHomeContext, WorldHomeRecord } from './WorldHomeRegistry';
import { WorldHomeRegistryCodec } from './WorldHomeRegistry';
import type { WorldFolderRecord } from './WorldFolderSession';
import type { WorldCoreStateSnapshot } from './WorldStateCodec';
import { isValidatedWorldStateSnapshot } from './WorldStateCodec';
import type { WorldStateSnapshot } from './WorldStateSession';
import { chartContentDigest } from './ChartArchive';
import { copyTransferData, transferFields } from './CoreTransfer';
import { OFFLINE_GRACE_HOURS } from '../../constants';

export interface SafePointDrainWorld {
  readonly worldId: string;
  readonly revision: number;
  readonly coreDigest: string;
}
export interface SafePointDrainConfirmation {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly sourceDeviceId: string;
  readonly drainId: string;
  readonly directoryDigest: string;
  readonly worlds: readonly SafePointDrainWorld[];
}
/** ContractAdapter trusts this live composition capability, never serialized assertions. */
export interface SafePointDrainCapability {
  readonly confirmation: SafePointDrainConfirmation;
  assertCurrent(): void;
  revoke(): void;
}
export interface SafePointDrainAcceptance {
  readonly schemaVersion: 1;
  readonly confirmation: SafePointDrainConfirmation;
  readonly acceptedAtServerEpochMs: number;
  readonly expiresAtServerEpochMs: number;
}
export interface SafePointDrainPort {
  withDrain<T>(operation: (capability: SafePointDrainCapability) => Promise<T>): Promise<T>;
}
export interface MigrationReleaseRequest {
  readonly schemaVersion: 1;
  readonly migrationId: string;
  readonly worldId: string;
  readonly expectedHomeRevision: number;
  readonly drainId: string;
}
export interface MigrationClaimRequest {
  readonly schemaVersion: 1;
  readonly migrationId: string;
  readonly worldId: string;
  readonly expectedHomeRevision: number;
}
export interface RealityPauseRecord {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly migrationId: string;
  readonly initiatingDeviceId: string;
  readonly startedAtServerEpochMs: number;
  readonly resumeNotBeforeServerEpochMs: number;
  readonly endedAtServerEpochMs: number | null;
}
export interface DeviceAccountBinding {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly boundAccountId: string | null;
  readonly migrationId: string | null;
  readonly pause: RealityPauseRecord | null;
}
/** Same identity and exact state; JSON never carries receiver certification. */
export interface RestrictedMigrationCorePayload {
  readonly schemaVersion: 1;
  readonly kind: 'RestrictedMigrationCore';
  readonly migrationId: string;
  readonly sourceDeviceId: string;
  readonly expectedHomeRevision: number;
  readonly record: WorldFolderRecord;
  readonly state: WorldCoreStateSnapshot & { readonly sections: WorldStateSnapshot['sections'] };
}
export interface MigrationReceipt {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly migrationId: string;
  readonly worldId: string;
  readonly sourceDeviceId: string;
  readonly claimDeviceId: string | null;
  readonly expectedHomeRevision: number;
  readonly kind: 'PauseActive' | 'Released' | 'Claimed';
  readonly record: WorldHomeRecord;
  readonly pause: RealityPauseRecord;
  readonly observedAtServerEpochMs: number;
}
export interface MigrationAdmission {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly deviceId: string;
  readonly worldId: string | null;
  readonly kind: 'Allowed' | 'PauseActive' | 'Released' | 'Migrated';
  readonly record: WorldHomeRecord | null;
  readonly pause: RealityPauseRecord | null;
  readonly observedAtServerEpochMs: number;
}
export interface MigrationAuthorityPort extends WorldHomeAuthorityPort {
  readAdmission(worldId?: string): Promise<unknown>;
  acceptDrain(capability: SafePointDrainCapability): Promise<unknown>;
  releaseMigration(request: MigrationReleaseRequest, payload: RestrictedMigrationCorePayload): Promise<unknown>;
  readMigration(migrationId: string): Promise<unknown>;
  readMigrationPayload(migrationId: string): Promise<unknown>;
  claimMigration(request: MigrationClaimRequest): Promise<unknown>;
  readDeviceBinding(): Promise<unknown>;
}
export type WorldMigrationPhase = 'Prepared' | 'PauseActive' | 'Released' | 'Claimed' | 'LocalPublished';
export interface WorldMigrationEntry {
  readonly role: 'Source' | 'Target';
  readonly phase: WorldMigrationPhase;
  readonly payload: RestrictedMigrationCorePayload;
  readonly receipt: MigrationReceipt | null;
}
export interface WorldMigrationJournal {
  readonly schemaVersion: 1;
  readonly kind: 'WorldMigrationJournal';
  readonly accountId: string;
  readonly deviceId: string;
  readonly entries: readonly WorldMigrationEntry[];
}
export interface WorldMigrationStorageReceipt {
  readonly mode: 'ContractAdapter';
  readonly kind: 'Pending' | 'PauseActive' | 'Released' | 'LocalPublished';
  readonly phase: WorldMigrationPhase;
  readonly migrationId: string;
  readonly worldId: string;
  readonly error: string | null;
}
export type MigrationCompleteValidator = (raw: unknown, accountId: string, worldId: string) => WorldStateSnapshot;

/** Strict per-round domain boundary. All parse methods clone and freeze their data. */
export class WorldMigrationCodec {
  readonly home = new WorldHomeRegistryCodec();
  constructor(private readonly validateComplete: MigrationCompleteValidator) {}
  parseConfirmation(raw: unknown, context?: WorldHomeContext): SafePointDrainConfirmation {
    const data = transferFields(raw, ['schemaVersion', 'accountId', 'sourceDeviceId', 'drainId', 'directoryDigest', 'worlds']);
    version(data.schemaVersion); const identity = this.home.parseContext({ accountId: data.accountId, deviceId: data.sourceDeviceId });
    if (context && (context.accountId !== identity.accountId || context.deviceId !== identity.deviceId)) { throw new Error('排空确认身份不匹配'); }
    id(data.drainId, '排空'); digest(data.directoryDigest);
    const ids = new Set<string>();
    const worlds = dense(data.worlds).map(item => {
      const world = transferFields(item, ['worldId', 'revision', 'coreDigest']);
      id(world.worldId, '世界'); integer(world.revision, 0, 'Core版本'); digest(world.coreDigest);
      if (ids.has(world.worldId)) { throw new Error('排空确认世界重复'); } ids.add(world.worldId);
      return Object.freeze({ worldId: world.worldId, revision: world.revision, coreDigest: world.coreDigest });
    });
    if (!ids.has('InitialWorld')) { throw new Error('账号排空必须包括 InitialWorld'); }
    const sorted = [...worlds].sort((a, b) => a.worldId < b.worldId ? -1 : a.worldId > b.worldId ? 1 : 0);
    if (worlds.some((world, index) => world.worldId !== sorted[index].worldId)) { throw new Error('排空世界须排序'); }
    return Object.freeze({ schemaVersion: 1, accountId: identity.accountId, sourceDeviceId: identity.deviceId,
      drainId: data.drainId, directoryDigest: data.directoryDigest, worlds: Object.freeze(worlds) });
  }
  parseDrainAcceptance(raw: unknown, confirmation?: SafePointDrainConfirmation): SafePointDrainAcceptance {
    const data = transferFields(raw, ['schemaVersion', 'confirmation', 'acceptedAtServerEpochMs', 'expiresAtServerEpochMs']);
    version(data.schemaVersion); const parsed = this.parseConfirmation(data.confirmation);
    integer(data.acceptedAtServerEpochMs, 0, '服务接受时刻'); integer(data.expiresAtServerEpochMs, 0, '确认过期时刻');
    if (data.expiresAtServerEpochMs !== data.acceptedAtServerEpochMs + 30000 ||
        (confirmation && chartContentDigest(confirmation) !== chartContentDigest(parsed))) { throw new Error('服务排空确认期限或内容不匹配'); }
    return Object.freeze({ schemaVersion: 1, confirmation: parsed, acceptedAtServerEpochMs: data.acceptedAtServerEpochMs,
      expiresAtServerEpochMs: data.expiresAtServerEpochMs });
  }
  parseReleaseRequest(raw: unknown): MigrationReleaseRequest {
    const data = transferFields(raw, ['schemaVersion', 'migrationId', 'worldId', 'expectedHomeRevision', 'drainId']);
    version(data.schemaVersion); id(data.migrationId, '迁移'); worldId(data.worldId); integer(data.expectedHomeRevision, 1, '期望归属版本'); id(data.drainId, '排空');
    return Object.freeze(data) as unknown as MigrationReleaseRequest;
  }
  parseClaimRequest(raw: unknown): MigrationClaimRequest {
    const data = transferFields(raw, ['schemaVersion', 'migrationId', 'worldId', 'expectedHomeRevision']);
    version(data.schemaVersion); id(data.migrationId, '迁移'); worldId(data.worldId); integer(data.expectedHomeRevision, 2, '期望释放版本');
    return Object.freeze(data) as unknown as MigrationClaimRequest;
  }
  parsePause(raw: unknown, accountId?: string): RealityPauseRecord {
    const data = transferFields(raw, ['schemaVersion', 'accountId', 'migrationId', 'initiatingDeviceId', 'startedAtServerEpochMs',
      'resumeNotBeforeServerEpochMs', 'endedAtServerEpochMs']);
    version(data.schemaVersion); id(data.accountId, '账号', 64); id(data.migrationId, '迁移'); id(data.initiatingDeviceId, '发起设备');
    integer(data.startedAtServerEpochMs, 0, '服务开始时刻'); integer(data.resumeNotBeforeServerEpochMs, 0, '服务最早结束时刻');
    if ((accountId !== undefined && data.accountId !== accountId) ||
        data.resumeNotBeforeServerEpochMs - data.startedAtServerEpochMs < Math.max(3600000, OFFLINE_GRACE_HOURS * 3600000)) {
      throw new Error('RealityPause 账号或最短时长不匹配');
    }
    if (data.endedAtServerEpochMs !== null) {
      integer(data.endedAtServerEpochMs, data.resumeNotBeforeServerEpochMs, '服务结束时刻');
    }
    return Object.freeze(data) as unknown as RealityPauseRecord;
  }
  parseDeviceBinding(raw: unknown, deviceId?: string): DeviceAccountBinding {
    const data = transferFields(raw, ['schemaVersion', 'deviceId', 'boundAccountId', 'migrationId', 'pause']);
    version(data.schemaVersion); id(data.deviceId, '设备');
    if (deviceId !== undefined && data.deviceId !== deviceId) { throw new Error('设备账号绑定身份不匹配'); }
    if (data.boundAccountId === null) {
      if (data.migrationId !== null || data.pause !== null) { throw new Error('未绑定设备不得有活动暂停'); }
      return Object.freeze(data) as unknown as DeviceAccountBinding;
    }
    id(data.boundAccountId, '绑定账号', 64); id(data.migrationId, '迁移');
    const pause = this.parsePause(data.pause, data.boundAccountId);
    if (pause.migrationId !== data.migrationId || pause.initiatingDeviceId !== data.deviceId || pause.endedAtServerEpochMs !== null) {
      throw new Error('设备绑定须对应当前发起暂停');
    }
    return Object.freeze({ schemaVersion: 1, deviceId: data.deviceId, boundAccountId: data.boundAccountId, migrationId: data.migrationId, pause });
  }
  parsePayload(raw: unknown): RestrictedMigrationCorePayload {
    const data = transferFields(raw, ['schemaVersion', 'kind', 'migrationId', 'sourceDeviceId', 'expectedHomeRevision', 'record', 'state']);
    version(data.schemaVersion);
    if (data.kind !== 'RestrictedMigrationCore') { throw new Error('不是受限迁移 Core 载荷'); }
    id(data.migrationId, '迁移'); id(data.sourceDeviceId, '源设备'); integer(data.expectedHomeRevision, 1, '期望归属版本');
    const copied = copyTransferData(data.state) as Record<string, unknown>; id(copied.accountId, '账号', 64); worldId(copied.worldId);
    const state = this.validateComplete(copied, copied.accountId, copied.worldId);
    if (!isValidatedWorldStateSnapshot(state) || state.accountId !== copied.accountId || state.worldId !== copied.worldId) { throw new Error('接收端七项认证或身份缺失'); }
    if (state.worldKind !== 'Primary' || state.shoreOrigin !== null) { throw new Error('UnsupportedBoundary: 本批仅静止 Primary 迁移'); }
    if (chartContentDigest(copied) !== chartContentDigest(state)) { throw new Error('迁移解码不得改变同ID状态'); }
    const record = transferFields(data.record, ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template']);
    text(record.title, 1, 80); text(record.description, 0, 300); integer(record.createdAt, 0, '目录创建时刻');
    if (record.worldId !== state.worldId || record.deletedAt !== null || record.template !== 'EmptyWorld') { throw new Error('迁移目录记录与同ID载荷不匹配'); }
    return Object.freeze({ schemaVersion: 1, kind: 'RestrictedMigrationCore', migrationId: data.migrationId, sourceDeviceId: data.sourceDeviceId,
      expectedHomeRevision: data.expectedHomeRevision, record: Object.freeze(record) as unknown as WorldFolderRecord,
      state: copyTransferData(state) as RestrictedMigrationCorePayload['state'] });
  }
  parseReceipt(raw: unknown, payload?: RestrictedMigrationCorePayload): MigrationReceipt {
    const data = transferFields(raw, ['schemaVersion', 'accountId', 'migrationId', 'worldId', 'sourceDeviceId', 'claimDeviceId',
      'expectedHomeRevision', 'kind', 'record', 'pause', 'observedAtServerEpochMs']);
    version(data.schemaVersion); id(data.accountId, '账号', 64); id(data.migrationId, '迁移'); worldId(data.worldId); id(data.sourceDeviceId, '源设备');
    integer(data.expectedHomeRevision, 1, '原归属版本'); integer(data.observedAtServerEpochMs, 0, '服务观察时刻');
    const record = this.home.parseRecord(data.record, data.accountId), pause = this.parsePause(data.pause, data.accountId);
    if (record.worldId !== data.worldId || record.updatedAtServerEpochMs > data.observedAtServerEpochMs ||
        pause.migrationId !== data.migrationId || pause.initiatingDeviceId !== data.sourceDeviceId || pause.startedAtServerEpochMs > data.observedAtServerEpochMs) {
      throw new Error('迁移 receipt 身份或服务时刻不匹配');
    }
    if (payload && (payload.migrationId !== data.migrationId || payload.state.accountId !== data.accountId ||
        payload.state.worldId !== data.worldId || payload.sourceDeviceId !== data.sourceDeviceId || payload.expectedHomeRevision !== data.expectedHomeRevision)) {
      throw new Error('迁移 receipt 与冻结载荷不匹配');
    }
    if (data.kind === 'PauseActive') {
      if (data.claimDeviceId !== null || record.homeState !== 'Homed' || record.homeDeviceId !== data.sourceDeviceId ||
          record.homeRevision !== data.expectedHomeRevision || pause.endedAtServerEpochMs !== null || data.observedAtServerEpochMs >= pause.resumeNotBeforeServerEpochMs) {
        throw new Error('PauseActive receipt 状态不匹配');
      }
    } else if (data.kind === 'Released') {
      if (data.claimDeviceId !== null || record.homeState !== 'Released' || record.homeRevision !== data.expectedHomeRevision + 1 ||
          pause.endedAtServerEpochMs === null || pause.endedAtServerEpochMs > data.observedAtServerEpochMs) { throw new Error('Released receipt 状态不匹配'); }
    } else if (data.kind === 'Claimed') {
      id(data.claimDeviceId, '认领设备');
      if (record.homeState !== 'Homed' || record.homeDeviceId !== data.claimDeviceId || record.homeRevision !== data.expectedHomeRevision + 2 ||
          pause.endedAtServerEpochMs === null || pause.endedAtServerEpochMs > data.observedAtServerEpochMs) { throw new Error('Claimed receipt 状态不匹配'); }
    } else { throw new Error('迁移 receipt 种类无效'); }
    return Object.freeze({ ...data, record, pause }) as unknown as MigrationReceipt;
  }
  parseAdmission(raw: unknown, context?: WorldHomeContext, expectedWorldId?: string): MigrationAdmission {
    const data = transferFields(raw, ['schemaVersion', 'accountId', 'deviceId', 'worldId', 'kind', 'record', 'pause', 'observedAtServerEpochMs']);
    version(data.schemaVersion); const identity = this.home.parseContext({ accountId: data.accountId, deviceId: data.deviceId });
    if (context && (context.accountId !== identity.accountId || context.deviceId !== identity.deviceId)) { throw new Error('准入响应账号/设备不匹配'); }
    if (data.worldId !== null) { id(data.worldId, '世界'); }
    if (expectedWorldId !== undefined && data.worldId !== expectedWorldId) { throw new Error('准入响应世界不匹配'); }
    integer(data.observedAtServerEpochMs, 0, '服务观察时刻');
    const record = data.record === null ? null : this.home.parseRecord(data.record, identity.accountId);
    const pause = data.pause === null ? null : this.parsePause(data.pause, identity.accountId);
    if (record && (data.worldId !== record.worldId || record.updatedAtServerEpochMs > data.observedAtServerEpochMs)) { throw new Error('准入记录身份或观察时刻不匹配'); }
    if (pause && (pause.startedAtServerEpochMs > data.observedAtServerEpochMs ||
        (pause.endedAtServerEpochMs !== null && pause.endedAtServerEpochMs > data.observedAtServerEpochMs))) { throw new Error('准入暂停超出服务观察时刻'); }
    if (data.kind === 'PauseActive') {
      if (!pause || pause.endedAtServerEpochMs !== null || data.observedAtServerEpochMs >= pause.resumeNotBeforeServerEpochMs) { throw new Error('暂停准入缺失活动服务暂停'); }
    } else {
      if (pause?.endedAtServerEpochMs === null) { throw new Error('活动暂停不能准入'); }
      if (data.kind === 'Released') { if (!record || record.homeState !== 'Released') { throw new Error('释放准入状态不匹配'); } }
      else if (data.kind === 'Migrated') { if (!record || record.homeState !== 'Homed' || record.homeDeviceId === identity.deviceId) { throw new Error('迁往别处准入状态不匹配'); } }
      else if (data.kind !== 'Allowed' || (record && (record.homeState !== 'Homed' || record.homeDeviceId !== identity.deviceId))) { throw new Error('准入结果与归属不匹配'); }
    }
    return Object.freeze({ ...data, record, pause }) as unknown as MigrationAdmission;
  }
  parseJournal(raw: unknown): WorldMigrationJournal {
    const data = transferFields(raw, ['schemaVersion', 'kind', 'accountId', 'deviceId', 'entries']);
    version(data.schemaVersion); if (data.kind !== 'WorldMigrationJournal') { throw new Error('迁移日志种类无效'); }
    const context = this.home.parseContext({ accountId: data.accountId, deviceId: data.deviceId }), ids = new Set<string>();
    let active = 0;
    const entries = dense(data.entries).map(item => {
      const value = transferFields(item, ['role', 'phase', 'payload', 'receipt']), payload = this.parsePayload(value.payload);
      if (payload.state.accountId !== context.accountId || ids.has(payload.migrationId)) { throw new Error('迁移日志账号或重复事务无效'); } ids.add(payload.migrationId);
      if (value.role !== 'Source' && value.role !== 'Target') { throw new Error('迁移日志角色无效'); }
      if (value.role === 'Source' && payload.sourceDeviceId !== context.deviceId) { throw new Error('源迁移日志设备不匹配'); }
      if (!['Prepared', 'PauseActive', 'Released', 'Claimed', 'LocalPublished'].includes(value.phase as string)) { throw new Error('迁移日志 phase 无效'); }
      const receipt = value.receipt === null ? null : this.parseReceipt(value.receipt, payload);
      if (value.phase === 'Prepared') { if (receipt !== null) { throw new Error('Prepared 日志不能有 receipt'); } }
      else if (!receipt || receipt.kind !== (value.phase === 'LocalPublished' ? 'Claimed' : value.phase)) { throw new Error('日志 phase 与 receipt 不匹配'); }
      if (value.role === 'Source' && value.phase === 'LocalPublished') { throw new Error('源不发布迁移目标'); }
      if (value.role === 'Target' && (value.phase === 'Claimed' || value.phase === 'LocalPublished') && receipt?.claimDeviceId !== context.deviceId) { throw new Error('目标迁移 receipt 属于其他设备'); }
      if (!(value.role === 'Source' && value.phase === 'Claimed') && value.phase !== 'LocalPublished') { active++; }
      return Object.freeze({ role: value.role, phase: value.phase, payload, receipt }) as WorldMigrationEntry;
    });
    if (active > 1) { throw new Error('同设备账号只能有一个未完成迁移'); }
    return Object.freeze({ schemaVersion: 1, kind: 'WorldMigrationJournal', ...context, entries: Object.freeze(entries) });
  }
}

function version(value: unknown): void { if (value !== 1) { throw new Error('迁移 schemaVersion 不支持'); } }
function id(value: unknown, label: string, maximum = 128): asserts value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) { throw new Error(label + '身份无效'); }
  try { encodeURIComponent(value); } catch { throw new Error(label + '身份编码无效'); }
}
function worldId(value: unknown): asserts value is string {
  id(value, '世界'); if (!/^world-[A-Za-z0-9-]{1,80}$/.test(value)) { throw new Error('UnsupportedBoundary: InitialWorld 不参与迁移'); }
}
function integer(value: unknown, minimum: number, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) { throw new Error(label + '须为安全整数'); }
}
function digest(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) { throw new Error('排空摘要须为 SHA-256'); }
}
function text(value: unknown, minimum: number, maximum: number): asserts value is string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < minimum || value.length > maximum) { throw new Error('迁移目录文字无效'); }
}
function dense(value: unknown): readonly unknown[] {
  const cloned = copyTransferData(value); if (!Array.isArray(cloned)) { throw new Error('迁移集合须为密集数组'); } return cloned;
}
