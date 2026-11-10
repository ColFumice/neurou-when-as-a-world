import { NarrativeDimension, VectorSchemaVersion } from '../../constants';
import type { ChartRef, NarrativeEventId } from '../../constants';
import type { AppendedAt, NarrativeVector } from '../ledger/NarrativeEvent';
import { validateNarrativeVector } from '../ledger/deriveLedgerPosition';

export type DivergenceAxis = NarrativeDimension.Red | NarrativeDimension.Green |
  NarrativeDimension.Blue | NarrativeDimension.Black | NarrativeDimension.White | NarrativeDimension.Grey;

export interface RouteSignature {
  readonly VectorSchemaVersion: 1;
  readonly ledgerPosition: NarrativeVector;
  readonly classificationVersion: 1;
  readonly divergenceAxis: DivergenceAxis | null;
  readonly narrativeTime: number;
}

export interface WorldClearRecord {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary';
  readonly protagonistCharacterId: string;
  readonly ChartRef: ChartRef & { readonly state: 'PremiereCompleted' };
  readonly contentRevision: string;
  readonly completionEventId: NarrativeEventId;
  readonly clearedAt: AppendedAt;
  readonly routeSignature: RouteSignature;
}

export interface WorldClearProjection {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly records: readonly WorldClearRecord[];
}

const emotionDimensions: readonly DivergenceAxis[] = Object.freeze([
  NarrativeDimension.Red, NarrativeDimension.Green, NarrativeDimension.Blue,
  NarrativeDimension.Black, NarrativeDimension.White, NarrativeDimension.Grey,
]);

/** Exact positive maximum; ties keep the frozen first dimension. */
export function classifyDivergenceAxis(position: NarrativeVector): DivergenceAxis | null {
  const vector = validateNarrativeVector(position);
  let maximum = 0;
  let selected: DivergenceAxis | null = null;
  for (const dimension of emotionDimensions) {
    if (vector[dimension] > maximum) { maximum = vector[dimension]; selected = dimension; }
  }
  return selected;
}

export function deriveRouteSignature(position: NarrativeVector): RouteSignature {
  const ledgerPosition = validateNarrativeVector(position);
  if (!ledgerPosition.some(value => value > 0)) { throw new Error('全零账本坐标不能生成合法通关路线'); }
  return Object.freeze({ VectorSchemaVersion, ledgerPosition, classificationVersion: 1,
    divergenceAxis: classifyDivergenceAxis(ledgerPosition),
    narrativeTime: ledgerPosition[NarrativeDimension.NarrativeTime] });
}

function fields(raw: unknown, names: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(`${label}格式无效`); }
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error(`${label}原型无效`); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(`${label}字段无效`); }
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(`${label}字段不可安全读取`);
    }
    result[name] = descriptor.value;
  }
  return result;
}

function identity(raw: unknown, label: string, maximum = 128): string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(`${label}标识无效`);
  }
  try { encodeURIComponent(raw); } catch { throw new Error(`${label}编码无效`); }
  return raw;
}

export function validateWorldClearRecord(raw: unknown, expectedAccountId?: string): WorldClearRecord {
  const value = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'worldKind', 'protagonistCharacterId',
    'ChartRef', 'contentRevision', 'completionEventId', 'clearedAt', 'routeSignature'], '世界通关记录');
  if (value.schemaVersion !== 1 || value.worldKind !== 'Primary') { throw new Error('世界通关记录版本或世界种类无效'); }
  const accountId = identity(value.accountId, '账号', 64);
  if (expectedAccountId !== undefined && accountId !== expectedAccountId) { throw new Error('世界通关记录账号不匹配'); }
  const chart = fields(value.ChartRef, ['chartId', 'state'], '通关谱面引用');
  if (chart.state !== 'PremiereCompleted' || chart.chartId === 'CHART_NOT_BOUND') {
    throw new Error('通关记录必须引用合法首演完成');
  }
  const time = fields(value.clearedAt, ['epochMs'], '通关时间');
  if (typeof time.epochMs !== 'number' || !Number.isSafeInteger(time.epochMs) || time.epochMs < 0) {
    throw new Error('通关时间须为非负安全整数毫秒');
  }
  const route = fields(value.routeSignature, ['VectorSchemaVersion', 'ledgerPosition', 'classificationVersion',
    'divergenceAxis', 'narrativeTime'], '通关路线');
  if (route.VectorSchemaVersion !== VectorSchemaVersion || route.classificationVersion !== 1) {
    throw new Error('通关路线版本不受支持');
  }
  const routeSignature = deriveRouteSignature(validateNarrativeVector(route.ledgerPosition));
  if (route.divergenceAxis !== routeSignature.divergenceAxis || route.narrativeTime !== routeSignature.narrativeTime) {
    throw new Error('通关路线分类或叙事时间不匹配');
  }
  return Object.freeze({ schemaVersion: 1, accountId, worldId: identity(value.worldId, '世界'), worldKind: 'Primary',
    protagonistCharacterId: identity(value.protagonistCharacterId, '主角'),
    ChartRef: Object.freeze({ chartId: identity(chart.chartId, '谱面'), state: 'PremiereCompleted' }),
    contentRevision: identity(value.contentRevision, '内容版本'),
    completionEventId: identity(value.completionEventId, '完成事件'),
    clearedAt: Object.freeze({ epochMs: time.epochMs }), routeSignature });
}

export function validateWorldClearProjection(raw: unknown, expectedAccountId?: string): WorldClearProjection {
  const value = fields(raw, ['schemaVersion', 'accountId', 'records'], '账号通关记录投影');
  const accountId = identity(value.accountId, '账号', 64);
  if (value.schemaVersion !== 1 || (expectedAccountId !== undefined && accountId !== expectedAccountId)) {
    throw new Error('账号通关记录投影版本或身份不匹配');
  }
  if (!Array.isArray(value.records) || Object.getPrototypeOf(value.records) !== Array.prototype) {
    throw new Error('账号通关记录列表无效');
  }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(value.records as object);
  const length: unknown = descriptors.length?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 ||
      Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error('账号通关记录列表结构无效'); }
  const records: WorldClearRecord[] = [];
  const worldIds = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error('账号通关记录列表不可安全读取');
    }
    const record = validateWorldClearRecord(descriptor.value, accountId);
    if (worldIds.has(record.worldId)) { throw new Error('同一账号世界存在重复通关记录'); }
    worldIds.add(record.worldId); records.push(record);
  }
  return Object.freeze({ schemaVersion: 1, accountId, records: Object.freeze(records) });
}
