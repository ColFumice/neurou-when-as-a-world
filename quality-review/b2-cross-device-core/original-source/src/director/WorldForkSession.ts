import type { AccountMilestoneReader } from './AccountMilestone';
import type { WorldFolderRecord, WorldFolderSnapshot } from './WorldFolderSession';
import type { WorldStateSnapshot } from './WorldStateSession';
import { isValidatedWorldStateSnapshot } from './WorldStateCodec';
import { chartContentDigest } from './ChartArchive';
import { validateWorldForkOrigin } from './WorldForkOrigin';
import type { WorldForkOrigin } from './WorldForkOrigin';

export interface WorldForkPlan {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly transactionId: string;
  readonly sourceWorldId: string;
  readonly targetWorldId: string;
  readonly sourceRevision: number;
  readonly sourceDigest: string;
  readonly targetRecord: WorldFolderRecord;
  readonly targetState: WorldStateSnapshot;
}

export interface WorldForkBindings {
  readonly createWorldId: () => string;
  readonly createTransactionId: () => string;
  readonly now: () => number;
  readonly validateComplete: (raw: unknown, accountId: string, worldId: string) => WorldStateSnapshot;
}

/** Prepares an isolated candidate. Journal persistence and publication are injected elsewhere. */
export class WorldForkSession {
  constructor(private readonly accountId: string, private readonly milestoneReader: AccountMilestoneReader,
    private readonly bindings: WorldForkBindings) { identity(accountId, '账号', 64); }

  prepareWorldFork(sourceWorldId: string, folder: WorldFolderSnapshot, source: WorldStateSnapshot): WorldForkPlan {
    identity(sourceWorldId, '来源世界');
    requireCertified(source, this.accountId, sourceWorldId);
    requireSourceKind(source);
    const validated = this.bindings.validateComplete(source, this.accountId, sourceWorldId);
    requireCertified(validated, this.accountId, sourceWorldId);
    requireSourceKind(validated);
    if (chartContentDigest(validated) !== chartContentDigest(source)) { throw new Error('来源完整校验改变了当前检查点'); }
    const directory = parseFolder(folder, this.accountId);
    const record = directory.records.find(item => item.worldId === sourceWorldId);
    if (!record || record.deletedAt !== null) { throw new Error('来源世界不存在或已删除'); }
    const milestone = fields(this.milestoneReader.getMilestoneSnapshot(),
      ['accountId', 'FirstWorldCleared', 'CopyPermission'], '账号里程碑读取');
    if (milestone.accountId !== this.accountId || typeof milestone.FirstWorldCleared !== 'boolean' ||
        typeof milestone.CopyPermission !== 'boolean' || milestone.CopyPermission !== milestone.FirstWorldCleared) {
      throw new Error('复制权限缺少同账号合法只读投影');
    }
    if (!milestone.CopyPermission) { throw new Error('CopyPermissionDenied: 尚未完成首次世界通关'); }
    // No identity/clock callback is reached until every source and permission check succeeds.
    const targetWorldId = this.bindings.createWorldId();
    targetId(targetWorldId);
    if (directory.records.some(item => item.worldId === targetWorldId)) { throw new Error('目标世界标识已存在或已成为墓碑'); }
    const transactionId = this.bindings.createTransactionId();
    identity(transactionId, '分叉事务');
    if (source.forkOrigin?.transactionId === transactionId) { throw new Error('分叉事务不能复用来源事务'); }
    const forkedAt = this.bindings.now(); integer(forkedAt, '分叉时刻');
    const origin = validateWorldForkOrigin({ schemaVersion: 1, accountId: this.accountId,
      sourceWorldId, sourceRevision: validated.revision, sourceCapturedAt: validated.capturedAt,
      targetWorldId, protagonistCharacterId: validated.sections.Ledger.protagonistCharacterId,
      transactionId, forkedAt, inheritedCompletionEventId: validated.sections.Ledger.control.completionEventId },
    this.accountId, targetWorldId, null);
    const targetState = rebaseWorldState(validated, targetWorldId, origin, this.bindings.validateComplete);
    const targetRecord: WorldFolderRecord = Object.freeze({ worldId: targetWorldId,
      title: copyTitle(record.title), description: record.description, createdAt: forkedAt,
      deletedAt: null, template: 'EmptyWorld' });
    return validateWorldForkPlan({ schemaVersion: 1, accountId: this.accountId, transactionId,
      sourceWorldId, targetWorldId, sourceRevision: validated.revision, sourceDigest: chartContentDigest(validated),
      targetRecord, targetState }, this.bindings.validateComplete);
  }
}

/** Exact seven-section inheritance with new account/world composite identities only. */
export function rebaseWorldState(source: WorldStateSnapshot, targetWorldId: string, rawOrigin: WorldForkOrigin,
  validateComplete: WorldForkBindings['validateComplete']): WorldStateSnapshot {
  if (!isValidatedWorldStateSnapshot(source)) { throw new Error('CompleteSourceRequired: 重键要求七项完整认证检查点'); }
  requireCertified(source, source.accountId, source.worldId); requireSourceKind(source); targetId(targetWorldId);
  const origin = validateWorldForkOrigin(rawOrigin, source.accountId, targetWorldId, null);
  if (origin.sourceWorldId !== source.worldId || origin.sourceRevision !== source.revision ||
      origin.sourceCapturedAt !== source.capturedAt ||
      origin.protagonistCharacterId !== source.sections.Ledger.protagonistCharacterId ||
      origin.inheritedCompletionEventId !== source.sections.Ledger.control.completionEventId) {
    throw new Error('分叉来源与当前完整检查点不匹配');
  }
  const sections = source.sections;
  const entry = sections.Ledger.control.entry;
  const candidate = cloneData({ schemaVersion: 1, accountId: source.accountId, worldId: targetWorldId,
    worldKind: source.worldKind, shoreOrigin: source.shoreOrigin, revision: 0, capturedAt: origin.forkedAt,
    kind: 'Core', forkOrigin: origin, sections: {
      Ledger: { ...sections.Ledger, worldId: targetWorldId, control: { ...sections.Ledger.control,
        entry: entry === null ? null : { ...entry, worldId: targetWorldId,
          entryId: JSON.stringify([source.accountId, targetWorldId, origin.protagonistCharacterId, 'SphereCrossing']) } } },
      PuzzleProgress: sections.PuzzleProgress.map(puzzle => ({ ...puzzle, worldId: targetWorldId })),
      FormatTime: sections.FormatTime,
      RecallCount: { ...sections.RecallCount, worldId: targetWorldId },
      WorldLink: { ...sections.WorldLink, worldId: targetWorldId },
      ChartSnapshot: { ...sections.ChartSnapshot, worldId: targetWorldId },
      ChartScore: { ...sections.ChartScore, worldId: targetWorldId },
    } });
  const result = validateComplete(candidate, source.accountId, targetWorldId);
  requireCertified(result, source.accountId, targetWorldId);
  if (chartContentDigest(candidate) !== chartContentDigest(result)) { throw new Error('目标完整校验改变了七项继承内容'); }
  return result;
}

/** Journal decoders reuse this boundary; storage must additionally reread and compare the source digest. */
export function validateWorldForkPlan(raw: unknown,
  validateComplete: WorldForkBindings['validateComplete']): WorldForkPlan {
  const value = fields(raw, ['schemaVersion', 'accountId', 'transactionId', 'sourceWorldId', 'targetWorldId',
    'sourceRevision', 'sourceDigest', 'targetRecord', 'targetState'], '分叉计划');
  identity(value.accountId, '计划账号', 64); identity(value.transactionId, '计划事务');
  identity(value.sourceWorldId, '计划来源世界'); targetId(value.targetWorldId);
  integer(value.sourceRevision, '计划来源版本');
  if (value.schemaVersion !== 1 || value.sourceWorldId === value.targetWorldId ||
      typeof value.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceDigest)) {
    throw new Error('分叉计划版本、来源或摘要无效');
  }
  // Clone unknown data before handing it to the complete validator; accessors and aliases cannot leak through.
  const rawState = cloneData(value.targetState);
  const targetState = validateComplete(rawState, value.accountId, value.targetWorldId);
  requireCertified(targetState, value.accountId, value.targetWorldId); requireSourceKind(targetState);
  if (chartContentDigest(rawState) !== chartContentDigest(targetState) || !targetState.forkOrigin) {
    throw new Error('分叉计划目标不是精确完整的来源实例');
  }
  const origin = validateWorldForkOrigin(targetState.forkOrigin, value.accountId, value.targetWorldId, targetState.sections.Ledger);
  const targetRecord = parseRecord(value.targetRecord);
  if (targetState.revision !== 0 || targetState.capturedAt !== origin.forkedAt ||
      origin.sourceWorldId !== value.sourceWorldId || origin.sourceRevision !== value.sourceRevision ||
      origin.transactionId !== value.transactionId ||
      origin.inheritedCompletionEventId !== targetState.sections.Ledger.control.completionEventId ||
      targetRecord.worldId !== value.targetWorldId || targetRecord.deletedAt !== null ||
      targetRecord.template !== 'EmptyWorld' || targetRecord.createdAt !== origin.forkedAt) {
    throw new Error('分叉计划目标身份、初始版本、目录或继承见证不匹配');
  }
  return Object.freeze({ schemaVersion: 1, accountId: value.accountId, transactionId: value.transactionId,
    sourceWorldId: value.sourceWorldId, targetWorldId: value.targetWorldId, sourceRevision: value.sourceRevision,
    sourceDigest: value.sourceDigest, targetRecord, targetState });
}

function requireCertified(raw: unknown, accountId: string, worldId: string): asserts raw is WorldStateSnapshot {
  if (!isValidatedWorldStateSnapshot(raw) || raw.accountId !== accountId || raw.worldId !== worldId) {
    throw new Error('CompleteSourceRequired: 分叉要求同账号当前七项完整认证检查点');
  }
}

function requireSourceKind(source: WorldStateSnapshot): void {
  if (source.worldKind === 'Shore' && source.shoreOrigin === 'FinalShore') {
    throw new Error('FinalShoreForkForbidden: 最终彼岸不可复制');
  }
  if (source.worldKind !== 'Primary' || source.shoreOrigin !== null) {
    throw new Error('UnsupportedSourceKind: 本批正式分叉只装配 Primary 来源');
  }
}

function targetId(raw: unknown): asserts raw is string {
  identity(raw, '新世界');
  if (!/^world-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(raw)) {
    throw new Error('新世界标识必须由正式 UUID v4 工厂生成');
  }
}

function parseFolder(raw: unknown, accountId: string): WorldFolderSnapshot {
  const value = fields(raw, ['schemaVersion', 'accountId', 'records'], '来源目录');
  if (value.schemaVersion !== 1 || value.accountId !== accountId) { throw new Error('来源目录版本或账号不匹配'); }
  const records = array(value.records).map(item => parseRecord(item));
  if (new Set(records.map(record => record.worldId)).size !== records.length) { throw new Error('来源目录世界标识重复'); }
  return Object.freeze({ schemaVersion: 1, accountId, records: Object.freeze(records) });
}

function parseRecord(raw: unknown): WorldFolderRecord {
  const value = fields(raw, ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template'], '世界目录记录');
  identity(value.worldId, '目录世界');
  if (value.worldId !== 'InitialWorld' && !/^world-[A-Za-z0-9-]{1,80}$/.test(value.worldId)) { throw new Error('目录世界标识无效'); }
  const title = text(value.title, 1, 80), description = text(value.description, 0, 300);
  integer(value.createdAt, '目录创建时刻');
  if (value.deletedAt !== null) { integer(value.deletedAt, '目录删除时刻'); }
  const template = value.worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld';
  if (value.template !== template || (value.deletedAt !== null && value.deletedAt < value.createdAt)) {
    throw new Error('目录模板或删除时刻无效');
  }
  return Object.freeze({ worldId: value.worldId, title, description, createdAt: value.createdAt,
    deletedAt: value.deletedAt as number | null, template });
}

function copyTitle(source: string): string {
  const suffix = ' 的副本'; let prefix = '';
  for (const character of Array.from(source)) {
    if (prefix.length + character.length > 80 - suffix.length) { break; }
    prefix += character;
  }
  return prefix.trimEnd() + suffix;
}

function fields(raw: unknown, names: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(label + '格式无效'); }
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error(label + '原型无效'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(label + '字段无效'); }
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error(label + '字段不可安全读取'); }
    result[name] = descriptor.value;
  }
  return result;
}

function array(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error('分叉数组格式无效'); }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
  const length: unknown = descriptors.length?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 ||
      Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error('分叉数组结构无效'); }
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error('分叉数组不可安全读取'); }
    result.push(descriptor.value);
  }
  return result;
}

function cloneData(raw: unknown, ancestors = new Set<object>()): unknown {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') { return raw; }
  if (typeof raw === 'number' && Number.isFinite(raw)) { return raw; }
  if (typeof raw !== 'object' || ancestors.has(raw)) { throw new Error('分叉检查点必须是无循环的纯数据'); }
  ancestors.add(raw);
  try {
    if (Array.isArray(raw)) { return array(raw).map(item => cloneData(item, ancestors)); }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) { throw new Error('分叉检查点原型无效'); }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') { throw new Error('分叉检查点不接受符号字段'); }
      const descriptor = descriptors[key];
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error('分叉检查点不接受访问器'); }
      result[key] = cloneData(descriptor.value, ancestors);
    }
    return result;
  } finally { ancestors.delete(raw); }
}

function identity(raw: unknown, label: string, maximum = 128): asserts raw is string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) { throw new Error(label + '标识无效'); }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '标识编码无效'); }
}

function text(raw: unknown, minimum: number, maximum: number): string {
  if (typeof raw !== 'string' || raw.length < minimum || raw.length > maximum || raw !== raw.trim()) { throw new Error('分叉目录文字长度无效'); }
  try { encodeURIComponent(raw); } catch { throw new Error('分叉目录文字编码无效'); }
  return raw;
}

function integer(raw: unknown, label: string): asserts raw is number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) { throw new Error(label + '须为非负安全整数'); }
}
