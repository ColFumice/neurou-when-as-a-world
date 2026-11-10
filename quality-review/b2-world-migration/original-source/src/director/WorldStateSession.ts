/** B2.2b complete contract; B2.2d-1 adds validated partial capture only. */
import type { WorldCoreStateSnapshot } from './WorldStateCodec';
import type { LedgerSnapshot } from './LedgerHydration';
import type { PuzzleProgressSnapshot } from './PuzzleHydration';
import type { FormatTimeSnapshot } from './WorldStateCodec';
import { isValidatedWorldStateSnapshot } from './WorldStateCodec';
import type { RecallCountSnapshot } from './RecallCountSession';
import type { WorldLinkSnapshot } from './WorldLinkSession';
import type { ChartSnapshotCollection, ChartScoreSnapshot } from './ChartArchive';
import type { WorldForkOrigin } from './WorldForkOrigin';

/** Only the seven-section codec can certify this brand at runtime. */
declare const validatedWorldState: unique symbol;

/**
 * The stored envelope stays Core. The brand represents seven validated payloads
 * and complete references; it is never supplied by JSON or a presentation flag.
 */
export interface WorldStateSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary' | 'Shore';
  readonly shoreOrigin: 'BugShore' | 'FinalShore' | null;
  readonly revision: number;
  readonly capturedAt: number;
  readonly kind: 'Core';
  readonly forkOrigin?: WorldForkOrigin;
  readonly sections: {
    readonly Ledger: LedgerSnapshot;
    readonly PuzzleProgress: readonly PuzzleProgressSnapshot[];
    readonly FormatTime: FormatTimeSnapshot;
    readonly RecallCount: RecallCountSnapshot;
    readonly WorldLink: WorldLinkSnapshot;
    readonly ChartSnapshot: ChartSnapshotCollection;
    readonly ChartScore: ChartScoreSnapshot;
  };
  readonly [validatedWorldState]: true;
}

export interface WorldStateDiagnostic {
  readonly section:
    | 'Ledger' | 'PuzzleProgress' | 'RecallCount' | 'FormatTime'
    | 'WorldLink' | 'ChartSnapshot' | 'ChartScore' | 'RuntimeBoundary';
  readonly reason:
    | 'MechanismMissing' | 'ProjectionUndefined' | 'AuthorityUnavailable'
    | 'IdentityUnavailable' | 'RestoreUnsupported' | 'UnsupportedBoundary'
    | 'InvalidSnapshot' | 'SchemaUnsupported' | 'IdentityMismatch'
    | 'ReferenceMismatch' | 'StaleRevision';
  readonly detail: string;
}

export type WorldForkAvailability = 'NotImplemented' | 'Implemented';

/**
 * Ownership contracts are metadata, never captured gameplay data. Inner indexes
 * supplement the account/world isolation boundary. None belongs to AccountProfile.
 * FormatTime is frozen as an immutable { epochMs: number } in B2.2d-1.
 */
const stateOwnership = Object.freeze({
  Ledger: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'characterId'] as const),
    codec: 'Implemented' as const,
    requires: Object.freeze(['AuthoritativeReadWriteSource', 'RoleIdentity', 'OrderedEvents', 'SideEffectFreeHydration'] as const),
  }),
  PuzzleProgress: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'chainId'] as const),
    codec: 'Implemented' as const,
    requires: Object.freeze(['PrivateChainTiming', 'EndpointDeduplication', 'DeepTraceState', 'EntryLifecycle'] as const),
  }),
  RecallCount: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'characterId', 'NarrativeEventId'] as const),
    codec: 'Implemented' as const,
    requires: Object.freeze(['AuthoritativeCounter', 'LegalRecallBehavior', 'LedgerReferenceValidation'] as const),
  }),
  FormatTime: Object.freeze({
    owner: 'WorldInstance' as const,
    indexes: Object.freeze(['accountId', 'worldId'] as const),
    codec: 'Implemented' as const,
    proposal: Object.freeze({ epochMs: 'NonNegativeSafeInteger' as const }),
    requires: Object.freeze(['AuthoritativeCreationTime', 'ImmutableValue', 'ProposalFreeze'] as const),
  }),
  WorldLink: Object.freeze({
    owner: 'WorldInstance' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'sourceWorldId'] as const),
    codec: 'Implemented' as const,
    appliesTo: 'BugShore' as const,
    requires: Object.freeze(['WorldKindAndShoreOrigin', 'SingleWeakSource', 'OrphanedSemantics', 'AIProfileSnapshot'] as const),
  }),
  ChartSnapshot: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'ChartRef'] as const),
    codec: 'Implemented' as const,
    requires: Object.freeze(['PremiereFreeze', 'StableContentReference', 'LedgerAssociation'] as const),
  }),
  ChartScore: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'ChartRef'] as const),
    codec: 'Implemented' as const,
    requires: Object.freeze(['PersistentScorePolicy', 'SnapshotAssociation', 'ReplayUpdateSemantics'] as const),
  }),
});

export type WorldStateCaptureResult =
  | { readonly kind: 'Complete'; readonly snapshot: WorldStateSnapshot }
  | {
      readonly kind: 'Incomplete';
      /** Unknown identity/control fields are explicit, not invented Primary/null/0. */
      readonly candidate: {
        readonly schemaVersion: 1;
        readonly accountId: string;
        readonly worldId: string;
        readonly worldKind: 'Primary' | 'Shore' | 'Unavailable';
        readonly shoreOrigin: 'BugShore' | 'FinalShore' | null | 'Unavailable';
        readonly revision: number | 'Unavailable';
        readonly capturedAt: number;
      };
      readonly capturedParts: {
        readonly Ledger?: LedgerSnapshot;
        readonly PuzzleProgress?: readonly PuzzleProgressSnapshot[];
        readonly FormatTime?: FormatTimeSnapshot;
        readonly RecallCount?: RecallCountSnapshot;
        readonly WorldLink?: WorldLinkSnapshot;
        readonly ChartSnapshot?: ChartSnapshotCollection;
        readonly ChartScore?: ChartScoreSnapshot;
      };
      readonly issues: readonly WorldStateDiagnostic[];
    };

export type WorldStateRestoreResult =
  | { readonly kind: 'Restored'; readonly snapshot: WorldStateSnapshot }
  | { readonly kind: 'Rejected'; readonly issues: readonly WorldStateDiagnostic[] };

export interface WorldStateReader {
  readonly ownership: typeof stateOwnership;
  readonly worldForkAvailability: WorldForkAvailability;
  getLastCaptureResult(): WorldStateCaptureResult | null;
}

/** Prepared graph remains inactive. publish succeeds only after durable commit. */
export interface WorldStatePreparedRestore {
  publish(): boolean;
  discard(): void;
}

/** Aggregation boundary in the existing director module; no browser or cc access. */
export class WorldStateSession implements WorldStateReader {
  readonly ownership = stateOwnership;
  private lastCaptureResult: WorldStateCaptureResult | null = null;
  private coreSource: (() => WorldCoreStateSnapshot | null) | null = null;
  private completeBinding: {
    readonly source: () => WorldCoreStateSnapshot | null;
    readonly validate: (raw: unknown) => WorldStateSnapshot;
    readonly prepare?: (snapshot: WorldStateSnapshot) => WorldStatePreparedRestore;
  } | null = null;

  constructor(
    private readonly accountId: string,
    private readonly worldId: string,
    private readonly now: () => number = Date.now,
    readonly worldForkAvailability: WorldForkAvailability = 'NotImplemented',
  ) {
    validateIdentity(accountId, '账号', 64);
    validateIdentity(worldId, '世界', 128);
  }

  /** Composition root supplies a strict, content-bound codec reader; never a JSON cast. */
  bindCoreSource(source: () => WorldCoreStateSnapshot | null): void { this.coreSource = source; }

  bindCompleteSource(source: () => WorldCoreStateSnapshot | null,
    validateFull: (raw: unknown) => WorldStateSnapshot,
    prepareRestore?: (snapshot: WorldStateSnapshot) => WorldStatePreparedRestore): void {
    this.completeBinding = Object.freeze({ source, validate: validateFull, prepare: prepareRestore });
  }

  /** Read-only diagnostic capture; only the last result reference is published. */
  captureWorldState(): WorldStateCaptureResult {
    const capturedAt = this.now();
    if (!isTime(capturedAt)) { throw new Error('状态捕获时间无效'); }
    if (this.completeBinding !== null) { return this.captureComplete(capturedAt); }
    if (this.coreSource !== null) { return this.captureCore(capturedAt); }
    const issues: readonly WorldStateDiagnostic[] = Object.freeze([
      diagnostic('Ledger', 'AuthorityUnavailable', '账本缺少同一权威读写来源、角色身份和无副作用恢复。'),
      diagnostic('PuzzleProgress', 'ProjectionUndefined', '解谜进度缺少完整链计时、终点防重、深痕和入口生命周期。'),
      diagnostic('RecallCount', 'MechanismMissing', '回忆次数尚无正式载体和合法行为；不能用零值代替。'),
      diagnostic('FormatTime', 'AuthorityUnavailable', '格式化时间尚无权威创建时间；不能由目录时间或当前时间代替。'),
      diagnostic('WorldLink', 'MechanismMissing', '世界链接与孤立恢复尚未实现；不能视为已知无链接。'),
      diagnostic('ChartSnapshot', 'MechanismMissing', '谱面首演内容尚未冻结；运行结果不能代替谱面快照。'),
      diagnostic('ChartScore', 'ProjectionUndefined', '谱面成绩尚无持久化更新语义及快照关联。'),
      diagnostic('RuntimeBoundary', 'IdentityUnavailable', '世界种类与彼岸来源尚无权威实例身份，目录模板不能代替。'),
      diagnostic('RuntimeBoundary', 'AuthorityUnavailable', '世界状态版本尚无权威载体，不能虚构初始版本。'),
      diagnostic('RuntimeBoundary', 'UnsupportedBoundary', '当前仅捕获目录诊断，完整玩法恢复边界尚未建立。'),
    ]);
    const result: WorldStateCaptureResult = Object.freeze({
      kind: 'Incomplete' as const,
      candidate: Object.freeze({
        schemaVersion: 1 as const, accountId: this.accountId, worldId: this.worldId,
        worldKind: 'Unavailable' as const, shoreOrigin: 'Unavailable' as const,
        revision: 'Unavailable' as const, capturedAt,
      }),
      capturedParts: Object.freeze({}), issues,
    });
    this.lastCaptureResult = result;
    return result;
  }

  getLastCaptureResult(): WorldStateCaptureResult | null { return this.lastCaptureResult; }

  private captureComplete(capturedAt: number): WorldStateCaptureResult {
    let core: WorldCoreStateSnapshot | null = null;
    const issues: WorldStateDiagnostic[] = [];
    try {
      core = this.completeBinding!.source();
      if (core !== null) {
        const snapshot = this.completeBinding!.validate(core);
        this.requireCertified(snapshot);
        const result: WorldStateCaptureResult = Object.freeze({ kind: 'Complete', snapshot });
        this.lastCaptureResult = result; return result;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '世界七项完整引用校验失败';
      const reason = message.includes('UnsupportedBoundary') ? 'UnsupportedBoundary'
        : message.includes('AuthorityUnavailable') ? 'AuthorityUnavailable' : 'ReferenceMismatch';
      issues.push(diagnostic('RuntimeBoundary', reason, message));
    }
    return this.captureCore(capturedAt, core, issues, true);
  }

  private requireCertified(snapshot: WorldStateSnapshot): void {
    if (!isValidatedWorldStateSnapshot(snapshot) || snapshot.accountId !== this.accountId || snapshot.worldId !== this.worldId) {
      throw new Error('世界完整状态不是七项 codec 的认证结果，或账号/世界身份不匹配');
    }
  }

  private captureCore(capturedAt: number, provided?: WorldCoreStateSnapshot | null,
    initialIssues: readonly WorldStateDiagnostic[] = [], extensionsBound = false): WorldStateCaptureResult {
    let core: WorldCoreStateSnapshot | null = null;
    const issues: WorldStateDiagnostic[] = [...initialIssues];
    try {
      core = provided === undefined ? this.coreSource!() : provided;
      if (core !== null && (core.accountId !== this.accountId || core.worldId !== this.worldId || core.kind !== 'Core')) {
        throw new Error('核心状态身份或文档种类不匹配');
      }
    } catch (error: unknown) {
      issues.push(diagnostic('RuntimeBoundary', 'InvalidSnapshot', error instanceof Error ? error.message : '核心状态无法读取'));
      core = null;
    }
    const capturedParts: { Ledger?: LedgerSnapshot; PuzzleProgress?: readonly PuzzleProgressSnapshot[];
      FormatTime?: FormatTimeSnapshot; RecallCount?: RecallCountSnapshot; WorldLink?: WorldLinkSnapshot;
      ChartSnapshot?: ChartSnapshotCollection; ChartScore?: ChartScoreSnapshot } = {};
    if (core?.sections.Ledger) { capturedParts.Ledger = core.sections.Ledger; }
    else { issues.push(diagnostic('Ledger', 'AuthorityUnavailable', '本世界尚无已校验的权威账本。')); }
    if (core?.sections.PuzzleProgress?.length) { capturedParts.PuzzleProgress = core.sections.PuzzleProgress; }
    else { issues.push(diagnostic('PuzzleProgress', 'UnsupportedBoundary', '本世界无稳定解谜检查点；活动计时、揭示和演奏不支持部分恢复。')); }
    if (core?.sections.FormatTime) { capturedParts.FormatTime = core.sections.FormatTime; }
    else { issues.push(diagnostic('FormatTime', 'AuthorityUnavailable', '历史创建时刻缺失，保持 Unavailable；不补写当前时间或目录时间。')); }
    if (extensionsBound) {
      if (core?.sections.RecallCount) { capturedParts.RecallCount = core.sections.RecallCount; }
      else { issues.push(diagnostic('RecallCount', 'AuthorityUnavailable', '本世界缺少权威回忆计数载体；不补零值。')); }
      if (core?.sections.WorldLink) { capturedParts.WorldLink = core.sections.WorldLink; }
      else { issues.push(diagnostic('WorldLink', 'AuthorityUnavailable', '本世界缺少经权威身份验证的链接或显式不适用声明。')); }
      if (core?.sections.ChartSnapshot) { capturedParts.ChartSnapshot = core.sections.ChartSnapshot; }
      else { issues.push(diagnostic('ChartSnapshot', 'AuthorityUnavailable', '本世界缺少合法首演冻结快照载体。')); }
      if (core?.sections.ChartScore) { capturedParts.ChartScore = core.sections.ChartScore; }
      else { issues.push(diagnostic('ChartScore', 'AuthorityUnavailable', '本世界缺少与首演快照关联的成绩载体。')); }
    } else {
      issues.push(
        diagnostic('RecallCount', 'MechanismMissing', '当前读取边界未装配回忆计数机制。'),
        diagnostic('WorldLink', 'MechanismMissing', '当前读取边界未装配 WorldLink/AIProfileSnapshot 机制。'),
        diagnostic('ChartSnapshot', 'MechanismMissing', '当前读取边界未装配首演冻结快照。'),
        diagnostic('ChartScore', 'ProjectionUndefined', '当前读取边界未装配谱面成绩持久化更新语义。'),
      );
    }
    if (!core || core.worldKind === 'Unavailable') {
      issues.push(diagnostic('RuntimeBoundary', 'IdentityUnavailable', '本世界尚无正式内容声明的实例种类。'));
    }
    const result: WorldStateCaptureResult = Object.freeze({ kind: 'Incomplete',
      candidate: Object.freeze({ schemaVersion: 1, accountId: this.accountId, worldId: this.worldId,
        worldKind: core?.worldKind ?? 'Unavailable', shoreOrigin: core ? core.shoreOrigin : 'Unavailable',
        revision: core?.revision ?? 'Unavailable', capturedAt }),
      capturedParts: Object.freeze(capturedParts), issues: Object.freeze(issues) });
    this.lastCaptureResult = result;
    return result;
  }

  /** Validate, prepare an inactive graph, then publish once. Validation is not restoration. */
  restoreWorldState(raw: unknown): WorldStateRestoreResult {
    if (this.completeBinding !== null) {
      let prepared: WorldStatePreparedRestore | null = null;
      try {
        if (this.completeBinding.prepare === undefined) { throw new Error('完整恢复的未激活对象图装配与发布尚未绑定'); }
        const snapshot = this.completeBinding.validate(raw); this.requireCertified(snapshot);
        prepared = this.completeBinding.prepare(snapshot);
        if (prepared === null || typeof prepared !== 'object' || typeof prepared.publish !== 'function' || typeof prepared.discard !== 'function') {
          throw new Error('完整恢复预备结果无效；未发布对象图');
        }
        if (prepared.publish() !== true) { throw new Error('完整恢复未成功发布新对象图'); }
        return Object.freeze({ kind: 'Restored', snapshot });
      } catch (error: unknown) {
        try { prepared?.discard(); } catch { /* Failed graph cleanup cannot turn a rejection into success. */ }
        return Object.freeze({ kind: 'Rejected', issues: Object.freeze([
          diagnostic('RuntimeBoundary', 'RestoreUnsupported', error instanceof Error ? error.message : '完整恢复失败；原有状态保持'),
        ]) });
      }
    }
    const issues = [...validateWorldStateHeader(raw, this.accountId, this.worldId),
      diagnostic('RuntimeBoundary', 'RestoreUnsupported', '完整世界恢复尚未实现；原有世界状态与存储保持原状。')];
    return Object.freeze({ kind: 'Rejected' as const, issues: Object.freeze(issues) });
  }
}

/** Header validation is not full state validation and never yields Complete. */
export function validateWorldStateHeader(
  raw: unknown, accountId: string, worldId: string,
): readonly WorldStateDiagnostic[] {
  if (raw === null || typeof raw !== 'object') {
    return Object.freeze([diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界状态必须是对象，不能是空值或数组。')]);
  }
  // Unknown in-process input can have accessors/proxies or inherited fields.
  // Inspect own data descriptors before reading any values, without invoking getters.
  let data: Record<string, unknown>;
  try {
    if (Array.isArray(raw)) {
      return Object.freeze([diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界状态必须是对象，不能是空值或数组。')]);
    }
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) {
      return Object.freeze([diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界状态头部必须是自有数据字段，不能继承其他对象。')]);
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const fields = ['schemaVersion', 'accountId', 'worldId', 'worldKind', 'shoreOrigin', 'revision', 'capturedAt'];
    data = Object.create(null) as Record<string, unknown>;
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        return Object.freeze([diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界状态头部缺少自有数据字段，或使用了访问器。')]);
      }
      data[field] = descriptor.value;
    }
  } catch (_error: unknown) {
    return Object.freeze([diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界状态头部无法安全读取。')]);
  }
  const issues: WorldStateDiagnostic[] = [];
  if (data.schemaVersion !== 1) {
    issues.push(diagnostic('RuntimeBoundary', 'SchemaUnsupported', '世界状态版本缺失或不受支持。'));
  }
  if (data.accountId !== accountId || data.worldId !== worldId) {
    issues.push(diagnostic('RuntimeBoundary', 'IdentityMismatch', '世界状态账号或世界身份不匹配。'));
  }
  if (data.worldKind !== 'Primary' && data.worldKind !== 'Shore') {
    issues.push(diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界种类必须为 Primary 或 Shore。'));
  } else if ((data.worldKind === 'Primary' && data.shoreOrigin !== null) ||
      (data.worldKind === 'Shore' && data.shoreOrigin !== 'BugShore' && data.shoreOrigin !== 'FinalShore')) {
    issues.push(diagnostic('RuntimeBoundary', 'ReferenceMismatch', '世界种类与彼岸来源不一致。'));
  }
  if (!isTime(data.revision) || !isTime(data.capturedAt)) {
    issues.push(diagnostic('RuntimeBoundary', 'InvalidSnapshot', '世界状态版本计数或捕获时间无效。'));
  }
  return Object.freeze(issues);
}

function diagnostic(
  section: WorldStateDiagnostic['section'], reason: WorldStateDiagnostic['reason'], detail: string,
): WorldStateDiagnostic { return Object.freeze({ section, reason, detail }); }

function validateIdentity(value: string, label: string, maxLength: number): void {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > maxLength) {
    throw new Error(label + '标识须为 1～' + maxLength + ' 个字符');
  }
  try { encodeURIComponent(value); }
  catch (_error: unknown) { throw new Error(label + '标识包含无效字符，无法用于隔离存储'); }
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
