import { NarrativeDimension, VectorSchemaVersion } from '../../constants/index';
import type {
  AccountMilestoneProjection, RouteSignature, WorldClearRecord, WorldClearProjection,
} from '../director/IntentPort';

/** Platform capability: every writer for an account must use this exclusive lock. */
export interface WorldClearAccountLock {
  request<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

/**
 * Local account adapter. The two storage writes are ordered, not atomic.
 * Public synchronous insertion is available only inside this adapter's account
 * lock; production callers use commitRecord / reconcileAccount. There is no
 * unlocked fallback when the browser lacks Web Locks.
 */
export class WorldClearStorage {
  private readonly insertionAccounts = new Set<string>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly accountLock: WorldClearAccountLock | null = browserAccountLock(),
  ) {}

  /** A missing key is an empty collection. Corruption fails without clearing it. */
  readWorldClearRecords(accountId: string): readonly WorldClearRecord[] {
    validId(accountId, 64, '账号');
    const stored = this.storage.getItem(this.key(accountId));
    if (stored === null) { return Object.freeze([]); }
    let raw: unknown;
    try { raw = JSON.parse(stored); }
    catch { throw new Error('世界通关记录 JSON 损坏；原始数据已保留'); }
    return parseClearProjection(raw, accountId).records;
  }

  /** Same account/world and identical record is a no-write retry; conflict fails. */
  saveWorldClearRecord(record: WorldClearRecord): readonly WorldClearRecord[] {
    const candidate = parseClearRecord(record);
    if (!this.insertionAccounts.has(candidate.accountId)) {
      throw new Error('世界通关记录须由 commitRecord 在账号独占锁内保存');
    }
    const records = this.readWorldClearRecords(candidate.accountId);
    const previous = records.find(item => item.worldId === candidate.worldId);
    if (previous !== undefined) {
      if (JSON.stringify(previous) !== JSON.stringify(candidate)) {
        throw new Error('同一账号世界已有不同通关记录；禁止覆盖既有路线');
      }
      return records;
    }
    const next = Object.freeze([...records, candidate]);
    const projection: WorldClearProjection = Object.freeze({
      schemaVersion: 1, accountId: candidate.accountId, records: next,
    });
    // If this write fails, commitRecord never reaches the milestone write.
    this.storage.setItem(this.key(candidate.accountId), JSON.stringify(projection));
    return next;
  }

  async commitRecord(
    record: WorldClearRecord,
    milestoneStorage: {
      readProjection(accountId: string): unknown | null;
      saveProjection(projection: AccountMilestoneProjection, expected: unknown | null): void;
    },
  ): Promise<readonly WorldClearRecord[]> {
    const candidate = parseClearRecord(record);
    return this.withAccountLock(candidate.accountId, () => {
      let records: readonly WorldClearRecord[];
      this.insertionAccounts.add(candidate.accountId);
      try { records = this.saveWorldClearRecord(candidate); }
      finally { this.insertionAccounts.delete(candidate.accountId); }
      // A failed projection keeps the durable record. Reconciliation retries it.
      this.reconcileProjection(candidate.accountId, records, milestoneStorage);
      return records;
    });
  }

  async reconcileAccount(
    accountId: string,
    milestoneStorage: {
      readProjection(accountId: string): unknown | null;
      saveProjection(projection: AccountMilestoneProjection, expected: unknown | null): void;
    },
  ): Promise<boolean> {
    validId(accountId, 64, '账号');
    return this.withAccountLock(accountId, () => this.reconcileProjection(
      accountId, this.readWorldClearRecords(accountId), milestoneStorage,
    ));
  }

  private reconcileProjection(
    accountId: string,
    records: readonly WorldClearRecord[],
    milestoneStorage: {
      readProjection(accountId: string): unknown | null;
      saveProjection(projection: AccountMilestoneProjection, expected: unknown | null): void;
    },
  ): boolean {
    const raw = milestoneStorage.readProjection(accountId);
    const previous = raw === null ? null : parseMilestone(raw, accountId);
    // Preserve the B2.2a meaning of an existing true, including legacy accounts.
    if (previous?.FirstWorldCleared) { return true; }
    if (records.length === 0) { return false; }
    milestoneStorage.saveProjection(Object.freeze({
      schemaVersion: 1, accountId, FirstWorldCleared: true,
    }), previous);
    return true;
  }

  private async withAccountLock<T>(accountId: string, operation: () => T): Promise<T> {
    if (this.accountLock === null) {
      throw new Error('当前环境没有账号独占锁；世界通关提交不可用，未写入存储');
    }
    // All callback work is synchronous under the cross-tab exclusive account
    // lock. Every record and milestone is re-read after acquiring that lock.
    return this.accountLock.request(
      'neurou-world-clear:' + encodeURIComponent(accountId),
      () => Promise.resolve(operation()),
    );
  }

  private key(accountId: string): string {
    validId(accountId, 64, '账号');
    return 'neurou-account-world-clears-v1:' + encodeURIComponent(accountId);
  }
}

function browserAccountLock(): WorldClearAccountLock | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) { return null; }
  return {
    request: <T>(name: string, operation: () => Promise<T>): Promise<T> =>
      navigator.locks.request(name, { mode: 'exclusive' }, operation),
  };
}

// This codec intentionally repeats the domain contract at the platform boundary.
// Presentation cannot value-import the director validator through its I edge.
const DIMENSIONS: readonly NarrativeDimension[] = Object.values(NarrativeDimension)
  .filter((value): value is NarrativeDimension => typeof value === 'number');
const EMOTION_AXES: readonly NonNullable<RouteSignature['divergenceAxis']>[] = Object.freeze([
  NarrativeDimension.Red, NarrativeDimension.Green, NarrativeDimension.Blue,
  NarrativeDimension.Black, NarrativeDimension.White, NarrativeDimension.Grey,
]);

function parseClearProjection(raw: unknown, accountId: string): WorldClearProjection {
  const fields = ownFields(raw, ['schemaVersion', 'accountId', 'records']);
  if (fields.schemaVersion !== 1) { throw new Error('世界通关记录集合版本不受支持'); }
  validId(fields.accountId, 64, '账号');
  if (fields.accountId !== accountId) { throw new Error('世界通关记录集合账号不匹配'); }
  const rawRecords = ownArray(fields.records);
  const records = rawRecords.map(item => parseClearRecord(item, accountId));
  const worldIds = new Set<string>();
  for (const record of records) {
    if (worldIds.has(record.worldId)) { throw new Error('世界通关记录集合包含重复世界'); }
    worldIds.add(record.worldId);
  }
  return Object.freeze({ schemaVersion: 1, accountId, records: Object.freeze(records) });
}

function parseClearRecord(raw: unknown, accountId?: string): WorldClearRecord {
  const fields = ownFields(raw, [
    'schemaVersion', 'accountId', 'worldId', 'worldKind', 'protagonistCharacterId',
    'ChartRef', 'contentRevision', 'completionEventId', 'clearedAt', 'routeSignature',
  ]);
  if (fields.schemaVersion !== 1) { throw new Error('世界通关记录版本不受支持'); }
  validId(fields.accountId, 64, '账号');
  if (accountId !== undefined && fields.accountId !== accountId) {
    throw new Error('世界通关记录账号不匹配');
  }
  if (fields.worldKind !== 'Primary') { throw new Error('世界通关记录仅接受 Primary 世界'); }
  validId(fields.worldId, 128, '世界');
  validId(fields.protagonistCharacterId, 128, '主角');
  validId(fields.contentRevision, 128, '内容版本');
  validId(fields.completionEventId, 128, '完成事件');
  const reference = ownFields(fields.ChartRef, ['chartId', 'state']);
  validId(reference.chartId, 128, '谱面');
  if (reference.state !== 'PremiereCompleted' || reference.chartId === 'CHART_NOT_BOUND') {
    throw new Error('世界通关记录必须引用合法首演完成');
  }
  const timestamp = ownFields(fields.clearedAt, ['epochMs']);
  if (typeof timestamp.epochMs !== 'number' || !Number.isSafeInteger(timestamp.epochMs)
      || timestamp.epochMs < 0) { throw new Error('世界通关时刻必须为非负安全整数毫秒'); }
  const routeSignature = parseRoute(fields.routeSignature);
  return Object.freeze({
    schemaVersion: 1, accountId: fields.accountId, worldId: fields.worldId,
    worldKind: 'Primary', protagonistCharacterId: fields.protagonistCharacterId,
    ChartRef: Object.freeze({ chartId: reference.chartId, state: 'PremiereCompleted' }),
    contentRevision: fields.contentRevision, completionEventId: fields.completionEventId,
    clearedAt: Object.freeze({ epochMs: timestamp.epochMs }), routeSignature,
  });
}

function parseRoute(raw: unknown): RouteSignature {
  const fields = ownFields(raw, [
    'VectorSchemaVersion', 'ledgerPosition', 'classificationVersion',
    'divergenceAxis', 'narrativeTime',
  ]);
  if (fields.VectorSchemaVersion !== VectorSchemaVersion || fields.classificationVersion !== 1) {
    throw new Error('通关路线向量或分类版本不受支持');
  }
  const ledgerPosition = ownArray(fields.ledgerPosition);
  if (ledgerPosition.length !== DIMENSIONS.length) { throw new Error('通关路线必须包含完整20维坐标'); }
  const position: number[] = [];
  let nonzero = false;
  for (const dimension of DIMENSIONS) {
    const value = ledgerPosition[dimension];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('通关路线坐标必须为有限非负数');
    }
    position[dimension] = value;
    if (value > 0) { nonzero = true; }
  }
  if (!nonzero) { throw new Error('全零坐标不能生成本批合法通关路线'); }
  let divergenceAxis: RouteSignature['divergenceAxis'] = null;
  let maximum = 0;
  for (const axis of EMOTION_AXES) {
    if (position[axis] > maximum) { maximum = position[axis]; divergenceAxis = axis; }
  }
  if (fields.divergenceAxis !== divergenceAxis) { throw new Error('通关路线分歧方向与坐标分类不一致'); }
  const narrativeTime = position[NarrativeDimension.NarrativeTime];
  if (fields.narrativeTime !== narrativeTime) { throw new Error('通关路线叙事时间与坐标不一致'); }
  return Object.freeze({
    VectorSchemaVersion, ledgerPosition: Object.freeze(position) as unknown as RouteSignature['ledgerPosition'],
    classificationVersion: 1, divergenceAxis, narrativeTime,
  });
}

function parseMilestone(raw: unknown, accountId: string): AccountMilestoneProjection {
  const fields = ownFields(raw, ['schemaVersion', 'accountId', 'FirstWorldCleared']);
  if (fields.schemaVersion !== 1 || fields.accountId !== accountId
      || typeof fields.FirstWorldCleared !== 'boolean') {
    throw new Error('首次世界通关投影无效；原始数据已保留');
  }
  return Object.freeze({ schemaVersion: 1, accountId, FirstWorldCleared: fields.FirstWorldCleared });
}

function validId(value: unknown, maxLength: number, label: string): asserts value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maxLength) {
    throw new Error(label + '标识须为不带首尾空白的 1～' + maxLength + ' 个字符');
  }
  try { encodeURIComponent(value); }
  catch { throw new Error(label + '标识编码无效'); }
}

/** Snapshot data descriptors once; never invoke an in-process getter. */
function ownFields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(); }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) { throw new Error(); }
    const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
    if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(); }
    const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new Error();
      }
      values[name] = descriptor.value;
    }
    return values;
  } catch { throw new Error('世界通关数据字段无效或无法安全读取'); }
}

/** Dense plain arrays only: no extra keys, symbols, sparse cells or accessors. */
function ownArray(raw: unknown): readonly unknown[] {
  try {
    if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error(); }
    const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
    const lengthDescriptor = descriptors.length;
    if (lengthDescriptor === undefined || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) {
      throw new Error();
    }
    const length: unknown = lengthDescriptor.value;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0
        || Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error(); }
    const values: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new Error();
      }
      values.push(descriptor.value);
    }
    return Object.freeze(values);
  } catch { throw new Error('世界通关数据数组无效或无法安全读取'); }
}
