import type { WorldCoreStateSnapshot } from './WorldStateCodec';
import { isValidatedWorldStateSnapshot } from './WorldStateCodec';
import type { WorldStateSnapshot } from './WorldStateSession';
import { WorldHomeRegistryCodec } from './WorldHomeRegistry';
import type { WorldHomeAuthorityPort, WorldHomeContext, WorldHomeRecord, WorldHomeRegistrationReply } from './WorldHomeRegistry';
import { WorldFolderSession } from './WorldFolderSession';
import type { WorldFolderSnapshot, WorldFolderRecord } from './WorldFolderSession';
import type { AccountMilestoneReader } from './AccountMilestone';
import { rebaseWorldState } from './WorldForkSession';
import { chartContentDigest } from './ChartArchive';
import { validateWorldForkOrigin } from './WorldForkOrigin';

/** Serialized values deliberately have no WorldStateSnapshot runtime certification. */
export interface CoreTransferPayload {
  readonly schemaVersion: 1;
  readonly kind: 'RestrictedCoreTransfer';
  readonly transferId: string;
  readonly sourceDeviceId: string;
  readonly sourceHomeRevision: 1;
  readonly state: WorldCoreStateSnapshot & { readonly sections: WorldStateSnapshot['sections'] };
}
export interface CoreTransferProof {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly sourceDeviceId: string;
  readonly transferId: string;
  readonly sourceHomeRevision: 1;
  readonly sourceDigest: string;
}
export interface CrossDeviceAuthorityPort extends WorldHomeAuthorityPort {
  publishTransfer(payload: CoreTransferPayload): Promise<unknown>;
  verifyTransfer(payload: CoreTransferPayload): Promise<unknown>;
}
export interface CrossDeviceImportRequest {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly description: string;
}
export type CrossDeviceDuplicateResult =
  | { readonly kind: 'Homed' | 'CrossDeviceDuplicate' | 'Released'; readonly mode: 'ContractAdapter'; readonly record: WorldHomeRecord }
  | { readonly kind: 'Migrated'; readonly mode: 'ContractAdapter'; readonly record: WorldHomeRecord }
  | { readonly kind: 'AuthorityUnavailable' | 'UnsupportedBoundary'; readonly mode: 'ContractAdapter'; readonly detail: string };
export interface CrossDeviceImportPlan {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly deviceId: string;
  readonly transactionId: string;
  readonly registrationId: string;
  readonly targetWorldId: string;
  readonly payload: CoreTransferPayload;
  readonly targetRecord: WorldFolderRecord;
  readonly targetState: WorldStateSnapshot;
}
export type CrossDeviceImportPhase = 'Prepared' | 'HomeRegistered' | 'Published';
export interface CrossDeviceImportEntry {
  readonly phase: CrossDeviceImportPhase;
  readonly plan: CrossDeviceImportPlan;
  readonly homeReply: WorldHomeRegistrationReply | null;
}
export interface CrossDeviceImportJournal {
  readonly schemaVersion: 1;
  readonly kind: 'CrossDeviceImportJournal';
  readonly accountId: string;
  readonly deviceId: string;
  readonly entries: readonly CrossDeviceImportEntry[];
}
export interface CrossDeviceImportReceipt {
  readonly kind: 'Published' | 'Pending';
  readonly mode: 'ContractAdapter';
  readonly transactionId: string;
  readonly targetWorldId: string;
  readonly phase: CrossDeviceImportPhase;
  readonly error: string | null;
}
export type CoreTransferCompleteValidator = (raw: unknown, accountId: string, worldId: string) => WorldStateSnapshot;

/** Data-only transport boundary, always reconstructing receiver-local certification. */
export class CoreTransferCodec {
  readonly home = new WorldHomeRegistryCodec();
  constructor(private readonly validateComplete: CoreTransferCompleteValidator) {}

  parsePayload(raw: unknown): CoreTransferPayload {
    const value = transferFields(raw, ['schemaVersion', 'kind', 'transferId', 'sourceDeviceId', 'sourceHomeRevision', 'state']);
    if (value.schemaVersion !== 1 || value.kind !== 'RestrictedCoreTransfer' || value.sourceHomeRevision !== 1) {
      throw new Error('受限 Core 载荷版本或来源归属版本不支持');
    }
    transferIdentity(value.transferId); transferIdentity(value.sourceDeviceId);
    const data = copyTransferData(value.state) as Record<string, unknown>;
    transferWorldId(data.worldId);
    transferIdentity(data.accountId, 64);
    const complete = this.validateComplete(data, data.accountId, data.worldId);
    requireComplete(complete, data.accountId, data.worldId);
    if (complete.worldKind !== 'Primary' || complete.shoreOrigin !== null) { throw new Error('UnsupportedBoundary: 仅支持静止 Primary Core'); }
    if (chartContentDigest(data) !== chartContentDigest(complete)) { throw new Error('完整解码不得改变载荷内容'); }
    return Object.freeze({ schemaVersion: 1, kind: 'RestrictedCoreTransfer', transferId: value.transferId,
      sourceDeviceId: value.sourceDeviceId, sourceHomeRevision: 1,
      state: copyTransferData(complete) as CoreTransferPayload['state'] });
  }

  parseProof(raw: unknown, payload: CoreTransferPayload): CoreTransferProof {
    const value = transferFields(raw, ['schemaVersion', 'accountId', 'worldId', 'sourceDeviceId', 'transferId', 'sourceHomeRevision', 'sourceDigest']);
    if (value.schemaVersion !== 1 || value.accountId !== payload.state.accountId || value.worldId !== payload.state.worldId ||
        value.sourceDeviceId !== payload.sourceDeviceId || value.transferId !== payload.transferId ||
        value.sourceHomeRevision !== payload.sourceHomeRevision || value.sourceDigest !== chartContentDigest(payload.state)) {
      throw new Error('传输权威 proof 与载荷身份或精确内容不匹配');
    }
    return Object.freeze(value) as unknown as CoreTransferProof;
  }

  parseRequest(raw: unknown): CrossDeviceImportRequest {
    const value = transferFields(raw, ['schemaVersion', 'title', 'description']);
    if (value.schemaVersion !== 1) { throw new Error('导入请求版本不支持'); }
    text(value.title, 1, 80); text(value.description, 0, 300);
    return Object.freeze({ schemaVersion: 1, title: value.title, description: value.description });
  }

  parsePlan(raw: unknown): CrossDeviceImportPlan {
    const value = transferFields(raw, ['schemaVersion', 'accountId', 'deviceId', 'transactionId', 'registrationId', 'targetWorldId', 'payload', 'targetRecord', 'targetState']);
    if (value.schemaVersion !== 1) { throw new Error('导入计划版本不支持'); }
    const context = this.home.parseContext({ accountId: value.accountId, deviceId: value.deviceId });
    transferWorldId(value.targetWorldId, true);
    if (typeof value.transactionId !== 'string' || !/^import-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.transactionId)) {
      throw new Error('导入事务须为 import-UUIDv4');
    }
    this.home.parseRegistrationRequest({ schemaVersion: 1, worldId: value.targetWorldId, registrationId: value.registrationId });
    const payload = this.parsePayload(value.payload);
    if (payload.state.accountId !== context.accountId || payload.sourceDeviceId === context.deviceId || payload.state.worldId === value.targetWorldId) {
      throw new Error('导入来源账号、设备或目标身份不匹配');
    }
    const source = this.validateComplete(payload.state, context.accountId, payload.state.worldId);
    requireComplete(source, context.accountId, payload.state.worldId);
    const targetState = this.validateComplete(copyTransferData(value.targetState), context.accountId, value.targetWorldId);
    requireComplete(targetState, context.accountId, value.targetWorldId);
    const origin = targetState.forkOrigin;
    if (!origin || origin.transactionId !== value.transactionId || targetState.revision !== 0 || targetState.capturedAt !== origin.forkedAt ||
        source.forkOrigin?.transactionId === value.transactionId) { throw new Error('导入目标来源头部不匹配'); }
    const expected = rebaseWorldState(source, value.targetWorldId, origin, this.validateComplete);
    if (chartContentDigest(expected) !== chartContentDigest(targetState)) { throw new Error('导入目标七项不符合精确重键'); }
    const record = transferFields(value.targetRecord, ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template']);
    text(record.title, 1, 80); text(record.description, 0, 300);
    if (record.worldId !== value.targetWorldId || record.createdAt !== origin.forkedAt || record.deletedAt !== null || record.template !== 'EmptyWorld') {
      throw new Error('导入目录记录与目标不一致');
    }
    return Object.freeze({ schemaVersion: 1, ...context, transactionId: value.transactionId,
      registrationId: value.registrationId as string, targetWorldId: value.targetWorldId, payload,
      targetRecord: Object.freeze(record) as unknown as WorldFolderRecord, targetState });
  }

  parseJournal(raw: unknown): CrossDeviceImportJournal {
    const value = transferFields(raw, ['schemaVersion', 'kind', 'accountId', 'deviceId', 'entries']);
    const context = this.home.parseContext({ accountId: value.accountId, deviceId: value.deviceId });
    if (value.schemaVersion !== 1 || value.kind !== 'CrossDeviceImportJournal') { throw new Error('导入日志版本/种类不支持'); }
    const ids = new Set<string>(), targets = new Set<string>(), registrations = new Set<string>();
    const entries = transferArray(value.entries).map(rawEntry => {
      const entry = transferFields(rawEntry, ['phase', 'plan', 'homeReply']);
      const plan = this.parsePlan(entry.plan);
      if (plan.accountId !== context.accountId || plan.deviceId !== context.deviceId || ids.has(plan.transactionId) ||
          targets.has(plan.targetWorldId) || registrations.has(plan.registrationId)) { throw new Error('导入日志身份冲突'); }
      ids.add(plan.transactionId); targets.add(plan.targetWorldId); registrations.add(plan.registrationId);
      if (entry.phase !== 'Prepared' && entry.phase !== 'HomeRegistered' && entry.phase !== 'Published') { throw new Error('导入日志阶段不支持'); }
      const homeReply = entry.homeReply === null ? null : this.home.parseRegistrationReply(entry.homeReply, context,
        { schemaVersion: 1, worldId: plan.targetWorldId, registrationId: plan.registrationId });
      if ((entry.phase === 'Prepared' && homeReply !== null) || (entry.phase !== 'Prepared' &&
          (!homeReply || homeReply.kind === 'HomeConflict' || homeReply.record.homeRevision !== 1))) { throw new Error('导入日志阶段与归属 receipt 不一致'); }
      return Object.freeze({ phase: entry.phase, plan, homeReply });
    });
    if (entries.filter(entry => entry.phase !== 'Published').length > 1) { throw new Error('同设备账号只允许一项待恢复导入'); }
    return Object.freeze({ schemaVersion: 1, kind: 'CrossDeviceImportJournal', ...context, entries: Object.freeze(entries) });
  }
}

export interface CrossDeviceImportBindings {
  readonly authority: CrossDeviceAuthorityPort | null;
  readonly milestoneReader: AccountMilestoneReader;
  readonly validateComplete: CoreTransferCompleteValidator;
  readonly createWorldId: () => string;
  readonly createTransactionId: () => string;
  readonly createRegistrationId: () => string;
  readonly now: () => number;
}

/** Remote preparation has no local source lease, source directory or source read port. */
export class CrossDeviceImportAdapter {
  readonly context: WorldHomeContext;
  readonly codec: CoreTransferCodec;
  constructor(context: WorldHomeContext, private readonly bindings: CrossDeviceImportBindings) {
    this.codec = new CoreTransferCodec(bindings.validateComplete);
    this.context = this.codec.home.parseContext(context);
  }

  async verifyAuthoritySource(raw: CoreTransferPayload): Promise<void> {
    const result = await this.detectCrossDeviceDuplicate(raw);
    if (result.kind !== 'CrossDeviceDuplicate') { throw new Error(result.kind + ': 来源当前不可复制'); }
  }

  private async verifyPublishedProof(raw: CoreTransferPayload): Promise<void> {
    const payload = this.codec.parsePayload(raw);
    const authority = this.authority();
    if (payload.state.accountId !== this.context.accountId) { throw new Error('传输账号与绑定会话不匹配'); }
    this.codec.parseProof(await authority.verifyTransfer(payload), payload);
  }

  async detectCrossDeviceDuplicate(raw: unknown): Promise<CrossDeviceDuplicateResult> {
    let payload: CoreTransferPayload;
    try { payload = this.codec.parsePayload(raw); }
    catch (error) { return Object.freeze({ kind: 'UnsupportedBoundary', mode: 'ContractAdapter', detail: String(error) }); }
    try {
      await this.verifyPublishedProof(payload);
      const snapshot = this.codec.home.parseSnapshot(await this.authority().readRegistry(), this.context.accountId);
      const record = snapshot.records.find(item => item.worldId === payload.state.worldId);
      if (!record) { throw new Error('可信来源缺少服务归属'); }
      if (record.homeState === 'Released') { return Object.freeze({ kind: 'Released', mode: 'ContractAdapter', record }); }
      if (record.homeRevision !== 1 || record.homeDeviceId !== payload.sourceDeviceId) {
        return Object.freeze({ kind: 'UnsupportedBoundary', mode: 'ContractAdapter', detail: '归属已变更；c 没有迁移证据，不猜测 Migrated' });
      }
      return Object.freeze({ kind: record.homeDeviceId === this.context.deviceId ? 'Homed' : 'CrossDeviceDuplicate', mode: 'ContractAdapter', record });
    } catch (error) { return Object.freeze({ kind: 'AuthorityUnavailable', mode: 'ContractAdapter', detail: String(error) }); }
  }

  async prepareImport(raw: unknown, rawRequest: CrossDeviceImportRequest, rawFolder: unknown): Promise<CrossDeviceImportPlan> {
    const payload = this.codec.parsePayload(raw);
    const request = this.codec.parseRequest(rawRequest);
    this.requirePermission();
    const folder = validateTransferFolder(rawFolder, this.context.accountId);
    const detection = await this.detectCrossDeviceDuplicate(payload);
    if (detection.kind !== 'CrossDeviceDuplicate') { throw new Error(detection.kind + ': 未进入跨设备复制'); }
    const targetWorldId = this.bindings.createWorldId(); transferWorldId(targetWorldId, true);
    if (folder.records.some(record => record.worldId === targetWorldId)) { throw new Error('目标已存在或已成为墓碑'); }
    const transactionId = this.bindings.createTransactionId();
    const registrationId = this.bindings.createRegistrationId();
    const forkedAt = this.bindings.now();
    const source = this.bindings.validateComplete(payload.state, this.context.accountId, payload.state.worldId);
    requireComplete(source, this.context.accountId, payload.state.worldId);
    const origin = validateWorldForkOrigin({ schemaVersion: 1, accountId: this.context.accountId,
      sourceWorldId: source.worldId, sourceRevision: source.revision, sourceCapturedAt: source.capturedAt,
      targetWorldId, protagonistCharacterId: source.sections.Ledger.protagonistCharacterId,
      transactionId, forkedAt, inheritedCompletionEventId: source.sections.Ledger.control.completionEventId }, this.context.accountId, targetWorldId, null);
    const targetState = rebaseWorldState(source, targetWorldId, origin, this.bindings.validateComplete);
    return this.codec.parsePlan({ schemaVersion: 1, ...this.context, transactionId, registrationId, targetWorldId, payload,
      targetRecord: { worldId: targetWorldId, title: request.title, description: request.description,
        createdAt: forkedAt, deletedAt: null, template: 'EmptyWorld' }, targetState });
  }

  requirePermission(): void {
    const value = transferFields(this.bindings.milestoneReader.getMilestoneSnapshot(), ['accountId', 'FirstWorldCleared', 'CopyPermission']);
    if (value.accountId !== this.context.accountId || typeof value.FirstWorldCleared !== 'boolean' ||
        typeof value.CopyPermission !== 'boolean' || value.CopyPermission !== value.FirstWorldCleared) {
      throw new Error('账号复制权限投影无效');
    }
    if (!value.CopyPermission) { throw new Error('档案损坏'); }
  }
  private authority(): CrossDeviceAuthorityPort {
    const authority = this.bindings.authority;
    if (!authority) { throw new Error('共享权威服务不可用'); }
    const context = this.codec.home.parseContext(authority.context);
    if (authority.mode !== 'ContractAdapter' || context.accountId !== this.context.accountId || context.deviceId !== this.context.deviceId ||
        typeof authority.verifyTransfer !== 'function' || typeof authority.readRegistry !== 'function' || typeof authority.registerWorldHome !== 'function') {
      throw new Error('跨设备端口绑定身份不匹配');
    }
    return authority;
  }
}

export function validateTransferFolder(raw: unknown, accountId: string): WorldFolderSnapshot {
  if (raw === null) { throw new Error('接收设备目录未初始化'); }
  return new WorldFolderSession(accountId, copyTransferData(raw), () => { throw new Error('验证不可写入'); },
    () => { throw new Error('验证不可分配ID'); }, () => { throw new Error('验证不可采样时间'); }).getSnapshot();
}
export function transferFields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) {
    throw new Error('传输值须为 plain data-only 对象');
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error('传输对象有缺失或未知字段'); }
  const output: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error('传输值禁止访问器'); }
    output[name] = descriptor.value;
  }
  return output;
}
function transferArray(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error('传输数组无效'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== raw.length + 1) { throw new Error('传输数组禁止稀疏/扩展属性'); }
  return Array.from({ length: raw.length }, (_, i) => {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error('传输数组禁止访问器'); }
    return descriptor.value;
  });
}
export function copyTransferData(raw: unknown, ancestors = new Set<object>()): unknown {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') { return raw; }
  if (typeof raw === 'number' && Number.isFinite(raw)) { return raw; }
  if (typeof raw !== 'object' || ancestors.has(raw)) { throw new Error('传输值禁止函数/undefined/非有限数/循环/品牌'); }
  ancestors.add(raw);
  try {
    if (Array.isArray(raw)) { return Object.freeze(transferArray(raw).map(value => copyTransferData(value, ancestors))); }
    const names = Reflect.ownKeys(raw);
    if (names.some(name => typeof name !== 'string')) { throw new Error('传输值禁止 symbol/品牌'); }
    const fields = transferFields(raw, names as string[]);
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names as string[]) { output[name] = copyTransferData(fields[name], ancestors); }
    return Object.freeze(output);
  } finally { ancestors.delete(raw); }
}
function transferIdentity(value: unknown, maximum = 128): asserts value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) { throw new Error('传输身份无效'); }
  try { encodeURIComponent(value); } catch { throw new Error('传输身份编码无效'); }
}
function transferWorldId(value: unknown, uuid = false): asserts value is string {
  transferIdentity(value);
  if (!(uuid ? /^world-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i : /^world-[A-Za-z0-9-]{1,80}$/).test(value)) {
    throw new Error('UnsupportedBoundary: InitialWorld 或世界身份不支持');
  }
}
function text(value: unknown, minimum: number, maximum: number): asserts value is string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < minimum || value.length > maximum) { throw new Error('导入文字格式无效'); }
}
function requireComplete(value: WorldStateSnapshot, accountId: string, worldId: string): void {
  if (!isValidatedWorldStateSnapshot(value) || value.accountId !== accountId || value.worldId !== worldId) { throw new Error('接收端七项认证或身份缺失'); }
}
