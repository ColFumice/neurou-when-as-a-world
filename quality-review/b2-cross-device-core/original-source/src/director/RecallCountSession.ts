// VERDICT-010 / VERDICT-218: one world observer's counts, separate from its Ledger.
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent } from '../ledger/NarrativeEvent';
import { classifyChartReference } from './ChartReference';
import { validateLedgerNarrativeEvent } from './LedgerHydration';
import type { LedgerSnapshot } from './LedgerHydration';

export interface RecallCountSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly records: readonly { readonly characterId: string; readonly eventId: string; readonly count: number }[];
  readonly traceBindings: readonly { readonly traceId: string; readonly characterId: string; readonly eventId: string }[];
}

export interface RecallCountContext {
  readonly accountId: string;
  readonly worldId: string;
  readonly protagonistCharacterId: string;
  readonly regularChartId: string;
}

export interface RecallCountCallbacks {
  /** The same validated world carrier used for appending and world-state capture. */
  readLedger(): LedgerSnapshot;
  /** Return only after the complete document containing this counter is durable. */
  persistSnapshot(snapshot: RecallCountSnapshot): void;
  /** Director-only, bound to the current protagonist's ordinary narrative append. */
  appendForeignEvent?(event: NarrativeEvent): void;
  now(): number;
}

export type RecallCountHydrateResult =
  | { readonly kind: 'Hydrated'; readonly snapshot: RecallCountSnapshot }
  | { readonly kind: 'Rejected'; readonly issues: readonly string[] };

export type RecallCountOperationResult =
  | { readonly kind: 'Recalled' | 'Replayed' | 'Experienced'; readonly characterId: string;
      readonly eventId: string; readonly count: number }
  | { readonly kind: 'ChartReplayIgnored'; readonly chartId: string };

const t6TraceId = 'T6_MAIN_DEEP_TRACE';
const t6EventId = 'T6_ENDPOINT_PLACEHOLDER';

function fields(raw: unknown, names: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(label + '格式无效'); }
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error(label + '原型无效'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(label + '字段无效'); }
  const data: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(label + '字段不可安全读取');
    }
    data[name] = descriptor.value;
  }
  return data;
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
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(label + '数组不可安全读取');
    }
    result.push(descriptor.value);
  }
  return result;
}

function id(raw: unknown, label: string, maximum = 128): asserts raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(label + '标识无效');
  }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '标识编码无效'); }
}

function count(raw: unknown): asserts raw is number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) { throw new Error('回忆计数须为非负安全整数'); }
}

interface LedgerIndex {
  readonly characters: ReadonlyMap<string, ReadonlyMap<string, NarrativeEvent>>;
  readonly traceBindings: RecallCountSnapshot['traceBindings'];
}

/** No append, clock or storage callback runs in construction/hydration/capture. */
export class RecallCountSession {
  private readonly context: RecallCountContext;
  private records: RecallCountSnapshot['records'] = Object.freeze([]);
  private mutationActive = false;

  constructor(context: RecallCountContext, private readonly callbacks: RecallCountCallbacks,
    hydrated?: RecallCountSnapshot) {
    const value = fields(context, ['accountId', 'worldId', 'protagonistCharacterId', 'regularChartId'], '回忆上下文');
    id(value.accountId, '账号', 64); id(value.worldId, '世界');
    id(value.protagonistCharacterId, '主角'); id(value.regularChartId, '正式常规谱面');
    if (value.regularChartId === 'CHART_NOT_BOUND') { throw new Error('回忆机制要求已验证的常规谱面身份'); }
    this.context = Object.freeze({ accountId: value.accountId, worldId: value.worldId,
      protagonistCharacterId: value.protagonistCharacterId, regularChartId: value.regularChartId });
    // An empty collection is legal only after the real carrier/context is checked.
    const ledger = callbacks.readLedger();
    this.readIndex(ledger);
    if (hydrated !== undefined) { this.records = this.validate(hydrated, ledger).records; }
  }

  /** Pure strict validation, also used by the seven-section codec for cross references. */
  validate(raw: unknown, ledger: LedgerSnapshot = this.callbacks.readLedger()): RecallCountSnapshot {
    const index = this.readIndex(ledger);
    const value = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'records', 'traceBindings'], '回忆快照');
    if (value.schemaVersion !== 1 || value.accountId !== this.context.accountId || value.worldId !== this.context.worldId) {
      throw new Error('回忆快照版本、账号或世界身份不匹配');
    }
    const keys = new Set<string>();
    const records = array(value.records, '回忆计数').map(item => {
      const record = fields(item, ['characterId', 'eventId', 'count'], '回忆计数记录');
      id(record.characterId, '回忆角色'); id(record.eventId, '回忆事件'); count(record.count);
      const key = JSON.stringify([record.characterId, record.eventId]);
      if (keys.has(key) || !index.characters.get(record.characterId)?.has(record.eventId)) {
        throw new Error('回忆计数角色/事件引用不存在于同角色权威账本，或索引重复');
      }
      keys.add(key);
      return Object.freeze({ characterId: record.characterId, eventId: record.eventId, count: record.count });
    });
    const bindings = array(value.traceBindings, '痕来源绑定').map(item => {
      const binding = fields(item, ['traceId', 'characterId', 'eventId'], '痕来源绑定');
      id(binding.traceId, '痕'); id(binding.characterId, '痕来源角色'); id(binding.eventId, '痕来源事件');
      return Object.freeze({ traceId: binding.traceId, characterId: binding.characterId, eventId: binding.eventId });
    });
    if (JSON.stringify(bindings) !== JSON.stringify(index.traceBindings)) {
      throw new Error('痕绑定必须对应本批已确认的 T6 深痕及其原终点事件');
    }
    return Object.freeze({ schemaVersion: 1, accountId: this.context.accountId, worldId: this.context.worldId,
      records: Object.freeze(records), traceBindings: Object.freeze(bindings) });
  }

  /** Returns data only; it never hydrates an active session by replaying actions. */
  hydrate(raw: unknown, ledger?: LedgerSnapshot): RecallCountHydrateResult {
    try { return Object.freeze({ kind: 'Hydrated', snapshot: this.validate(raw, ledger) }); }
    catch (error: unknown) { return Object.freeze({ kind: 'Rejected', issues: Object.freeze([
      error instanceof Error ? error.message : '回忆快照无法安全校验',
    ]) }); }
  }

  /** Candidate Ledger lets its terminal event and derived binding share one document write. */
  getSnapshot(ledger: LedgerSnapshot = this.callbacks.readLedger()): RecallCountSnapshot {
    const index = this.readIndex(ledger);
    return this.validate({ schemaVersion: 1, accountId: this.context.accountId, worldId: this.context.worldId,
      records: this.records, traceBindings: index.traceBindings }, ledger);
  }

  getCount(eventId: string): number {
    id(eventId, '回忆事件');
    const ledger = this.callbacks.readLedger();
    if (!this.readIndex(ledger).characters.get(this.context.protagonistCharacterId)!.has(eventId)) {
      throw new Error('当前主角账本中不存在待回忆事件');
    }
    return this.getSnapshot(ledger).records.find(record => record.characterId === this.context.protagonistCharacterId &&
      record.eventId === eventId)?.count ?? 0;
  }

  recall(eventId: string): RecallCountOperationResult { return this.increment(eventId, 'Recalled'); }

  replay(traceId: string): RecallCountOperationResult {
    id(traceId, '痕');
    const binding = this.getSnapshot().traceBindings.find(value => value.traceId === traceId);
    if (binding === undefined || binding.characterId !== this.context.protagonistCharacterId) {
      throw new Error('痕来源绑定不存在或不属于当前主角账本');
    }
    return this.increment(binding.eventId, 'Replayed');
  }

  /** T6's same terminal settlement is its source; this read introduces no extra fact/write. */
  bindT6Trace(): RecallCountSnapshot['traceBindings'][number] {
    const binding = this.getSnapshot().traceBindings.find(value => value.traceId === t6TraceId);
    if (binding === undefined) { throw new Error('合法 T6 终点事实尚不存在，不能绑定深痕来源'); }
    return binding;
  }

  /** Ordinary foreign first experience; UI cannot provide vectors or impersonate an actor. */
  experienceForeignEvent(sourceCharacterId: string, eventId: string): RecallCountOperationResult {
    if (this.mutationActive) { throw new Error('回忆事务不可重入'); }
    id(sourceCharacterId, '来源角色'); id(eventId, '来源事件');
    if (sourceCharacterId === this.context.protagonistCharacterId) { throw new Error('首次他人经历要求不同的已知来源角色'); }
    const ledger = this.callbacks.readLedger(); const index = this.readIndex(ledger);
    const source = index.characters.get(sourceCharacterId)?.get(eventId);
    if (source === undefined) { throw new Error('他人来源角色或事件不存在于权威账本'); }
    if (eventId.startsWith('WORLD_') || eventId === t6EventId || eventId === 'T7_COMPLETION_PLACEHOLDER' ||
        source.ChartRef.chartId !== this.context.regularChartId || source.ChartRef.state !== 'Entry' ||
        classifyChartReference(source, this.context.regularChartId) !== 'Entry') {
      throw new Error('他人首次经历只接受正式常规叙事来源，禁止搬运制作选择、解谜或首演完成事实');
    }
    const existing = index.characters.get(this.context.protagonistCharacterId)!.get(eventId);
    if (existing !== undefined) {
      if (JSON.stringify(existing.vector) !== JSON.stringify(source.vector) ||
          existing.ChartRef.chartId !== source.ChartRef.chartId || existing.ChartRef.state !== source.ChartRef.state) {
        throw new Error('同一叙事事件标识在角色账本中有不同内容来源');
      }
      return this.increment(eventId, 'Recalled');
    }
    if (this.callbacks.appendForeignEvent === undefined) { throw new Error('他人初次经历追加能力尚未装配'); }
    const timestamp = this.callbacks.now(); count(timestamp);
    const candidate = validateLedgerNarrativeEvent({ eventId: source.eventId, vector: source.vector,
      VectorSchemaVersion: source.VectorSchemaVersion, AppendedAt: { epochMs: timestamp },
      InputSource: InputSource.Player, ChapterTag: {}, ChartRef: source.ChartRef });
    this.mutationActive = true;
    try {
      this.callbacks.appendForeignEvent(candidate);
      const appended = this.readIndex(this.callbacks.readLedger()).characters.get(this.context.protagonistCharacterId)!.get(eventId);
      if (appended === undefined || JSON.stringify(appended) !== JSON.stringify(candidate)) {
        throw new Error('他人初次经历未由同一权威载体成功追加');
      }
      return Object.freeze({ kind: 'Experienced', characterId: this.context.protagonistCharacterId, eventId, count: 0 });
    } finally { this.mutationActive = false; }
  }

  /** Chart replay is a different interaction and never invokes Recall or its persistence. */
  chartReplay(chartId: string): RecallCountOperationResult {
    id(chartId, '重玩谱面');
    return Object.freeze({ kind: 'ChartReplayIgnored', chartId });
  }

  private increment(eventId: string, kind: 'Recalled' | 'Replayed'): RecallCountOperationResult {
    if (this.mutationActive) { throw new Error('回忆事务不可重入'); }
    id(eventId, '回忆事件'); const ledger = this.callbacks.readLedger();
    const prior = this.getSnapshot(ledger);
    if (!this.readIndex(ledger).characters.get(this.context.protagonistCharacterId)!.has(eventId)) {
      throw new Error('当前主角账本中不存在待回忆事件');
    }
    const position = prior.records.findIndex(record => record.characterId === this.context.protagonistCharacterId && record.eventId === eventId);
    const nextCount = (position < 0 ? 0 : prior.records[position].count) + 1; count(nextCount);
    const record = Object.freeze({ characterId: this.context.protagonistCharacterId, eventId, count: nextCount });
    const records = prior.records.slice(); if (position < 0) { records.push(record); } else { records[position] = record; }
    const next = this.validate({ ...prior, records }, ledger);
    this.mutationActive = true;
    try {
      // A throw leaves all published counts unchanged. No Ledger append/crossing path exists here.
      this.callbacks.persistSnapshot(next);
      this.records = next.records;
    } finally { this.mutationActive = false; }
    return Object.freeze({ kind, characterId: this.context.protagonistCharacterId, eventId, count: nextCount });
  }

  private readIndex(raw: LedgerSnapshot): LedgerIndex {
    const ledger = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'protagonistCharacterId',
      'contentId', 'contentRevision', 'characters', 'control'], '回忆权威账本');
    if (ledger.schemaVersion !== 1 || ledger.accountId !== this.context.accountId || ledger.worldId !== this.context.worldId ||
        ledger.protagonistCharacterId !== this.context.protagonistCharacterId) { throw new Error('回忆权威账本账号、世界或主角身份不匹配'); }
    id(ledger.contentId, '账本制作内容'); id(ledger.contentRevision, '账本制作版本');
    const characters = new Map<string, ReadonlyMap<string, NarrativeEvent>>();
    for (const item of array(ledger.characters, '回忆角色账本')) {
      const character = fields(item, ['characterId', 'events'], '回忆角色账本'); id(character.characterId, '账本角色');
      if (characters.has(character.characterId)) { throw new Error('回忆权威账本角色重复'); }
      const events = new Map<string, NarrativeEvent>();
      for (const itemEvent of array(character.events, '回忆角色事件')) {
        const narrativeEvent = validateLedgerNarrativeEvent(itemEvent);
        if (events.has(narrativeEvent.eventId)) { throw new Error('回忆权威账本事件索引重复'); }
        events.set(narrativeEvent.eventId, narrativeEvent);
      }
      characters.set(character.characterId, events);
    }
    const own = characters.get(this.context.protagonistCharacterId);
    if (own === undefined) { throw new Error('回忆机制缺少正式当前主角账本载体'); }
    const endpoint = own.get(t6EventId);
    let traceBindings: RecallCountSnapshot['traceBindings'] = Object.freeze([]);
    if (endpoint !== undefined) {
      if (endpoint.InputSource !== InputSource.Player || endpoint.ChartRef.chartId !== this.context.regularChartId ||
          endpoint.vector.some(component => component !== 0) ||
          classifyChartReference(endpoint, this.context.regularChartId) !== 'Entry') {
        throw new Error('T6 痕源必须是同主角、同正式常规谱面的合法原终点事件');
      }
      traceBindings = Object.freeze([Object.freeze({ traceId: t6TraceId,
        characterId: this.context.protagonistCharacterId, eventId: t6EventId })]);
    }
    return { characters, traceBindings };
  }
}
