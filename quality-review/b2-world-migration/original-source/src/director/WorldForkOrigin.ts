import type { LedgerSnapshot } from './LedgerHydration';
import { validateLedgerNarrativeEvent } from './LedgerHydration';
import { InputSource } from '../ledger/NarrativeEvent';

/** Immutable instance provenance; this is not an eighth gameplay section. */
export interface WorldForkOrigin {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly sourceWorldId: string;
  readonly sourceRevision: number;
  readonly sourceCapturedAt: number;
  readonly targetWorldId: string;
  readonly protagonistCharacterId: string;
  readonly transactionId: string;
  readonly forkedAt: number;
  readonly inheritedCompletionEventId: string | null;
}

/** Pure validation never creates identities, samples time or repeats a premiere. */
export function validateWorldForkOrigin(raw: unknown, accountId: string, worldId: string,
  ledger: LedgerSnapshot | null): WorldForkOrigin {
  identity(accountId, '账号', 64); identity(worldId, '世界');
  const value = fields(raw, ['schemaVersion', 'accountId', 'sourceWorldId', 'sourceRevision',
    'sourceCapturedAt', 'targetWorldId', 'protagonistCharacterId', 'transactionId',
    'forkedAt', 'inheritedCompletionEventId'], '分叉来源');
  identity(value.accountId, '来源账号', 64); identity(value.sourceWorldId, '来源世界');
  identity(value.targetWorldId, '目标世界'); identity(value.protagonistCharacterId, '来源主角');
  identity(value.transactionId, '分叉事务');
  integer(value.sourceRevision, '来源版本'); integer(value.sourceCapturedAt, '来源捕获时刻');
  integer(value.forkedAt, '分叉时刻');
  if (value.schemaVersion !== 1 || value.accountId !== accountId || value.targetWorldId !== worldId ||
      value.sourceWorldId === value.targetWorldId || value.forkedAt < value.sourceCapturedAt) {
    throw new Error('分叉来源版本、身份或时序不匹配');
  }
  if (value.inheritedCompletionEventId !== null) { identity(value.inheritedCompletionEventId, '继承完成事件'); }
  if (ledger !== null) {
    // The content-bound Ledger validator runs first in WorldStateCodec. Read only
    // own data here as this exported boundary can also be called independently.
    const carrier = fields(ledger, ['schemaVersion', 'accountId', 'worldId', 'protagonistCharacterId',
      'contentId', 'contentRevision', 'characters', 'control'], '分叉账本');
    if (carrier.schemaVersion !== 1 || carrier.accountId !== accountId || carrier.worldId !== worldId ||
        carrier.protagonistCharacterId !== value.protagonistCharacterId) {
      throw new Error('分叉来源与目标账本角色身份不匹配');
    }
    const control = fields(carrier.control, ['selectedChoiceId', 'sphereCrossed', 'entry',
      'eventSequence', 'completionEventId'], '分叉账本控制');
    if (value.inheritedCompletionEventId !== null) {
      if (control.completionEventId !== value.inheritedCompletionEventId || control.sphereCrossed !== true) {
        throw new Error('继承完成事件与账本完成事实不匹配');
      }
      const entry = fields(control.entry, ['entryId', 'worldId', 'characterId', 'ChartRef', 'tier', 'source'], '继承 World 入口');
      const reference = fields(entry.ChartRef, ['chartId', 'state'], '继承 World 入口引用');
      if (entry.worldId !== worldId || entry.characterId !== value.protagonistCharacterId ||
          entry.tier !== 'World' || entry.source !== 'SphereCrossing' || reference.state !== 'Entry') {
        throw new Error('继承完成事实缺少同世界同主角的 World 入口');
      }
      const protagonists = array(carrier.characters, '分叉角色账本').map(item =>
        fields(item, ['characterId', 'events'], '分叉角色账本')).filter(item =>
        item.characterId === value.protagonistCharacterId);
      if (protagonists.length !== 1) { throw new Error('继承完成事实缺少唯一主角账本'); }
      const completed = array(protagonists[0].events, '分叉主角事件').map(item =>
        validateLedgerNarrativeEvent(item)).filter(item => item.eventId === value.inheritedCompletionEventId);
      if (completed.length !== 1 || completed[0].InputSource !== InputSource.Player ||
          completed[0].ChartRef.state !== 'PremiereCompleted' ||
          completed[0].ChartRef.chartId !== reference.chartId ||
          completed[0].vector.some(component => component !== 0) ||
          !completed[0].eventId.startsWith('WORLD_PREMIERE_COMPLETED:')) {
        throw new Error('继承完成事实不是合法 World 首演完成引用');
      }
    }
    // A null inherited witness stays null when this initially unfinished copy
    // later completes its own first premiere. The origin itself never changes.
  }
  return Object.freeze({ schemaVersion: 1, accountId, sourceWorldId: value.sourceWorldId,
    sourceRevision: value.sourceRevision, sourceCapturedAt: value.sourceCapturedAt,
    targetWorldId: worldId, protagonistCharacterId: value.protagonistCharacterId,
    transactionId: value.transactionId, forkedAt: value.forkedAt,
    inheritedCompletionEventId: value.inheritedCompletionEventId as string | null });
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
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(label + '字段不可安全读取');
    }
    result[name] = descriptor.value;
  }
  return result;
}

function array(raw: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error(label + '数组无效'); }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
  const length: unknown = descriptors.length?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 ||
      Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error(label + '数组结构无效'); }
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(label + '数组不可安全读取');
    }
    result.push(descriptor.value);
  }
  return result;
}

function identity(raw: unknown, label: string, maximum = 128): asserts raw is string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(label + '标识无效');
  }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '标识编码无效'); }
}

function integer(raw: unknown, label: string): asserts raw is number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) { throw new Error(label + '须为非负安全整数'); }
}
