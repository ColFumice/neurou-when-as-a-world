import type { LedgerSnapshot } from './LedgerHydration';
import type { PuzzleProgressSnapshot } from './PuzzleHydration';
import type { RecallCountSnapshot } from './RecallCountSession';
import type { WorldLinkSnapshot } from './WorldLinkSession';
import type { ChartSnapshotCollection, ChartScoreSnapshot } from './ChartArchive';
import type { WorldStateSnapshot } from './WorldStateSession';
import { validateWorldForkOrigin } from './WorldForkOrigin';
import type { WorldForkOrigin } from './WorldForkOrigin';

/** A three-section document is deliberately distinct from the seven-section brand. */
export interface WorldCoreStateSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary' | 'Shore' | 'Unavailable';
  readonly shoreOrigin: 'BugShore' | 'FinalShore' | null | 'Unavailable';
  readonly revision: number;
  readonly capturedAt: number;
  readonly kind: 'Core';
  /** Immutable instance provenance, separate from the seven gameplay sections. */
  readonly forkOrigin?: WorldForkOrigin;
  readonly sections: {
    readonly Ledger: LedgerSnapshot | null;
    readonly PuzzleProgress: readonly PuzzleProgressSnapshot[] | null;
    readonly FormatTime: FormatTimeSnapshot | null;
    readonly RecallCount?: RecallCountSnapshot | null;
    readonly WorldLink?: WorldLinkSnapshot | null;
    readonly ChartSnapshot?: ChartSnapshotCollection | null;
    readonly ChartScore?: ChartScoreSnapshot | null;
  };
}

export interface FormatTimeSnapshot { readonly epochMs: number }

/** Non-enumerable runtime certification does not enter the stored Core envelope. */
const completeStates = new WeakSet<object>();
export function isValidatedWorldStateSnapshot(raw: unknown): raw is WorldStateSnapshot {
  return raw !== null && typeof raw === 'object' && completeStates.has(raw);
}

/** Bound domain validators carry the published content and reference context. */
export class WorldStateCodec {
  constructor(private readonly validators: {
    readonly Ledger?: (raw: unknown) => LedgerSnapshot;
    readonly PuzzleProgress?: (raw: unknown, ledger: LedgerSnapshot | null) => PuzzleProgressSnapshot;
    readonly RecallCount?: (raw: unknown, ledger: LedgerSnapshot | null) => RecallCountSnapshot;
    readonly WorldLink?: (raw: unknown) => WorldLinkSnapshot;
    readonly ChartSnapshot?: (raw: unknown, ledger: LedgerSnapshot | null) => ChartSnapshotCollection;
    readonly ChartScore?: (raw: unknown, snapshots: ChartSnapshotCollection | null, ledger: LedgerSnapshot | null) => ChartScoreSnapshot;
    /** Strict cross-section completeness, including every completed chart reference. */
    readonly Complete?: (core: WorldCoreStateSnapshot) => void;
  } = {}) {}

  parse(raw: unknown, expectedAccountId?: string, expectedWorldId?: string): WorldCoreStateSnapshot {
    if (expectedAccountId !== undefined) { identity(expectedAccountId, 64, '账号'); }
    if (expectedWorldId !== undefined) { identity(expectedWorldId, 128, '世界'); }
    const hasForkOrigin = Object.prototype.hasOwnProperty.call(descriptorsOf(raw), 'forkOrigin');
    const data = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'worldKind',
      'shoreOrigin', 'revision', 'capturedAt', 'kind', 'sections', ...(hasForkOrigin ? ['forkOrigin'] : [])]);
    if (data.schemaVersion !== 1 || data.kind !== 'Core') { throw new Error('世界三项状态文档版本或种类不受支持'); }
    identity(data.accountId, 64, '账号'); identity(data.worldId, 128, '世界');
    if ((expectedAccountId !== undefined && data.accountId !== expectedAccountId) ||
        (expectedWorldId !== undefined && data.worldId !== expectedWorldId)) { throw new Error('世界三项状态文档身份不匹配'); }
    const worldKind = data.worldKind;
    const shoreOrigin = data.shoreOrigin;
    if ((worldKind === 'Primary' && shoreOrigin !== null) ||
        (worldKind === 'Shore' && shoreOrigin !== 'BugShore' && shoreOrigin !== 'FinalShore') ||
        (worldKind === 'Unavailable' && shoreOrigin !== 'Unavailable') ||
        (worldKind !== 'Primary' && worldKind !== 'Shore' && worldKind !== 'Unavailable')) {
      throw new Error('世界三项状态文档种类与彼岸来源不一致');
    }
    nonnegativeInteger(data.revision, '世界状态版本计数');
    nonnegativeInteger(data.capturedAt, '世界状态捕获时刻');
    const sectionDescriptors = descriptorsOf(data.sections);
    const extensionNames = ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore'] as const;
    const extensionCount = extensionNames.filter(name => Object.prototype.hasOwnProperty.call(sectionDescriptors, name)).length;
    if (extensionCount !== 0 && extensionCount !== 4) { throw new Error('世界扩展四项必须同组存在，不得部分迁移'); }
    const sections = fields(data.sections, extensionCount === 0 ? ['Ledger', 'PuzzleProgress', 'FormatTime']
      : ['Ledger', 'PuzzleProgress', 'FormatTime', ...extensionNames]);
    let Ledger: LedgerSnapshot | null = null;
    if (sections.Ledger !== null) {
      if (this.validators.Ledger === undefined) { throw new Error('账本状态验证器尚未装配'); }
      Ledger = cloneData(this.validators.Ledger(sections.Ledger)) as unknown as LedgerSnapshot;
      const ledgerIdentity = fieldsContaining(Ledger, ['accountId', 'worldId']);
      if (ledgerIdentity.accountId !== data.accountId || ledgerIdentity.worldId !== data.worldId) {
        throw new Error('账本状态与世界文档身份不匹配');
      }
    }
    let PuzzleProgress: readonly PuzzleProgressSnapshot[] | null = null;
    if (sections.PuzzleProgress !== null) {
      if (this.validators.PuzzleProgress === undefined) { throw new Error('解谜状态验证器尚未装配'); }
      const puzzles: PuzzleProgressSnapshot[] = [];
      const chainIds = new Set<string>();
      for (const item of arrayData(sections.PuzzleProgress)) {
        const puzzle = cloneData(this.validators.PuzzleProgress(item, Ledger)) as unknown as PuzzleProgressSnapshot;
        const puzzleIdentity = fieldsContaining(puzzle, ['accountId', 'worldId', 'chainId']);
        identity(puzzleIdentity.chainId, 128, '解谜链');
        if (puzzleIdentity.accountId !== data.accountId || puzzleIdentity.worldId !== data.worldId ||
            chainIds.has(puzzleIdentity.chainId)) { throw new Error('解谜状态身份不匹配或链标识重复'); }
        chainIds.add(puzzleIdentity.chainId); puzzles.push(puzzle);
      }
      PuzzleProgress = Object.freeze(puzzles);
    }
    let FormatTime: FormatTimeSnapshot | null = null;
    if (sections.FormatTime !== null) {
      const time = fields(sections.FormatTime, ['epochMs']);
      nonnegativeInteger(time.epochMs, '世界创建时刻');
      FormatTime = Object.freeze({ epochMs: time.epochMs });
    }
    const extensions: { RecallCount?: RecallCountSnapshot | null; WorldLink?: WorldLinkSnapshot | null;
      ChartSnapshot?: ChartSnapshotCollection | null; ChartScore?: ChartScoreSnapshot | null } = {};
    if (extensionCount === 4) {
      const checkIdentity = <T>(rawSection: T): T => {
        const sectionIdentity = fieldsContaining(rawSection, ['accountId', 'worldId']);
        if (sectionIdentity.accountId !== data.accountId || sectionIdentity.worldId !== data.worldId) {
          throw new Error('世界扩展状态与文档账号/世界身份不匹配');
        }
        return rawSection;
      };
      if (sections.RecallCount === null) { extensions.RecallCount = null; }
      else {
        if (this.validators.RecallCount === undefined) { throw new Error('回忆计数验证器尚未装配'); }
        extensions.RecallCount = checkIdentity(cloneData(this.validators.RecallCount(sections.RecallCount, Ledger)) as unknown as RecallCountSnapshot);
      }
      if (sections.WorldLink === null) { extensions.WorldLink = null; }
      else {
        if (this.validators.WorldLink === undefined) { throw new Error('世界链接验证器尚未装配'); }
        const link = checkIdentity(cloneData(this.validators.WorldLink(sections.WorldLink)) as unknown as WorldLinkSnapshot);
        if (link.worldKind !== worldKind || link.shoreOrigin !== shoreOrigin ||
            (Ledger !== null && link.protagonistCharacterId !== Ledger.protagonistCharacterId)) {
          throw new Error('世界链接与正式世界/角色身份不匹配');
        }
        extensions.WorldLink = link;
      }
      if (sections.ChartSnapshot === null) { extensions.ChartSnapshot = null; }
      else {
        if (this.validators.ChartSnapshot === undefined) { throw new Error('谱面快照验证器尚未装配'); }
        extensions.ChartSnapshot = checkIdentity(cloneData(this.validators.ChartSnapshot(sections.ChartSnapshot, Ledger)) as unknown as ChartSnapshotCollection);
      }
      if (sections.ChartScore === null) { extensions.ChartScore = null; }
      else {
        if (this.validators.ChartScore === undefined) { throw new Error('谱面成绩验证器尚未装配'); }
        extensions.ChartScore = checkIdentity(cloneData(this.validators.ChartScore(sections.ChartScore,
          extensions.ChartSnapshot ?? null, Ledger)) as unknown as ChartScoreSnapshot);
      }
    }
    if (hasForkOrigin && Ledger === null) { throw new Error('分叉来源头部必须关联已校验的权威账本'); }
    const forkOrigin = hasForkOrigin ? validateWorldForkOrigin(data.forkOrigin, data.accountId, data.worldId, Ledger) : undefined;
    if (forkOrigin && (worldKind !== 'Primary' || shoreOrigin !== null || data.capturedAt < forkOrigin.forkedAt)) {
      throw new Error('分叉实例来源必须匹配正式 Primary 身份与创建边界');
    }
    return Object.freeze({ schemaVersion: 1, accountId: data.accountId, worldId: data.worldId,
      worldKind, shoreOrigin: shoreOrigin as WorldCoreStateSnapshot['shoreOrigin'],
      revision: data.revision, capturedAt: data.capturedAt, kind: 'Core',
      ...(forkOrigin ? { forkOrigin } : {}),
      sections: Object.freeze({ Ledger, PuzzleProgress, FormatTime, ...extensions }) });
  }

  parseComplete(raw: unknown, expectedAccountId?: string, expectedWorldId?: string): WorldStateSnapshot {
    const core = this.parse(raw, expectedAccountId, expectedWorldId);
    if (core.worldKind === 'Unavailable' || core.sections.Ledger === null || core.sections.PuzzleProgress === null ||
        core.sections.FormatTime === null || core.sections.RecallCount == null || core.sections.WorldLink == null ||
        core.sections.ChartSnapshot == null || core.sections.ChartScore == null) {
      throw new Error('世界七项状态存在缺失，不能取得 Complete');
    }
    if (this.validators.Complete === undefined) { throw new Error('世界七项完整引用验证器尚未装配'); }
    this.validators.Complete(core);
    completeStates.add(core);
    return core as unknown as WorldStateSnapshot;
  }
}

function identity(raw: unknown, maximum: number, label: string): asserts raw is string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(label + '标识无效');
  }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '标识编码无效'); }
}

function nonnegativeInteger(raw: unknown, label: string): asserts raw is number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) { throw new Error(label + '必须为非负安全整数'); }
}

function descriptorsOf(raw: unknown): PropertyDescriptorMap {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(); }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) { throw new Error(); }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string') ||
        Object.values(descriptors).some(descriptor => !Object.prototype.hasOwnProperty.call(descriptor, 'value'))) {
      throw new Error();
    }
    return descriptors;
  } catch { throw new Error('世界三项状态文档字段无法安全读取'); }
}

function fieldsContaining(raw: unknown, names: readonly string[]): Record<string, unknown> {
  const descriptors = descriptorsOf(raw);
  const data = Object.create(null) as Record<string, unknown>;
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined) { throw new Error('世界三项状态文档缺少自有字段'); }
    data[name] = descriptor.value;
  }
  return data;
}

function fields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  const descriptors = descriptorsOf(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error('世界三项状态文档字段无效'); }
  const data = Object.create(null) as Record<string, unknown>;
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined) { throw new Error('世界三项状态文档缺少自有字段'); }
    data[name] = descriptor.value;
  }
  return data;
}

function arrayData(raw: unknown): readonly unknown[] {
  try {
    if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error(); }
    const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
    const lengthDescriptor = descriptors.length;
    if (lengthDescriptor === undefined || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) { throw new Error(); }
    const length: unknown = lengthDescriptor.value;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 ||
        Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error(); }
    const data: unknown[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error(); }
      data.push(descriptor.value);
    }
    return Object.freeze(data);
  } catch { throw new Error('世界三项状态文档数组无法安全读取'); }
}

/** Freeze a data-only clone of validated section output; no caller aliases survive. */
function cloneData(raw: unknown, ancestors: Set<object> = new Set<object>()): unknown {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') { return raw; }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) { throw new Error('世界三项状态文档包含非有限数值'); }
    return raw;
  }
  if (typeof raw !== 'object') { throw new Error('世界三项状态文档包含非数据值'); }
  if (ancestors.has(raw)) { throw new Error('世界三项状态文档包含循环引用'); }
  ancestors.add(raw);
  try {
    if (Array.isArray(raw)) { return Object.freeze(arrayData(raw).map(value => cloneData(value, ancestors))); }
    const descriptors = descriptorsOf(raw);
    const data: Record<string, unknown> = {};
    for (const name of Object.keys(descriptors)) {
      Object.defineProperty(data, name, { value: cloneData(descriptors[name].value, ancestors), enumerable: true });
    }
    return Object.freeze(data);
  } finally { ancestors.delete(raw); }
}
