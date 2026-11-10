/** B2.2b foundation: diagnostics and opaque contracts, without gameplay hydration. */

/** No full codec exists in B2.2b. Only a later validated codec may create this brand. */
declare const validatedWorldState: unique symbol;

/**
 * Opaque complete state. The public surface describes its candidate header only;
 * the brand represents the seven validated payloads and their control state.
 * There is intentionally no producer, JSON cast, or complete codec in this batch.
 */
export interface WorldStateSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary' | 'Shore';
  readonly shoreOrigin: 'BugShore' | 'FinalShore' | null;
  readonly revision: number;
  readonly capturedAt: number;
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

export type WorldForkAvailability = 'NotImplemented';

/**
 * Ownership contracts are metadata, never captured gameplay data. Inner indexes
 * supplement the account/world isolation boundary. None belongs to AccountProfile.
 * FormatTime's proposed value shape is { epochMs: number }; it remains unfrozen.
 */
const stateOwnership = Object.freeze({
  Ledger: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'characterId'] as const),
    codec: 'NotImplemented' as const,
    requires: Object.freeze(['AuthoritativeReadWriteSource', 'RoleIdentity', 'OrderedEvents', 'SideEffectFreeHydration'] as const),
  }),
  PuzzleProgress: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'chainId'] as const),
    codec: 'NotImplemented' as const,
    requires: Object.freeze(['PrivateChainTiming', 'EndpointDeduplication', 'DeepTraceState', 'EntryLifecycle'] as const),
  }),
  RecallCount: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'characterId', 'NarrativeEventId'] as const),
    codec: 'NotImplemented' as const,
    requires: Object.freeze(['AuthoritativeCounter', 'LegalRecallBehavior', 'LedgerReferenceValidation'] as const),
  }),
  FormatTime: Object.freeze({
    owner: 'WorldInstance' as const,
    indexes: Object.freeze(['accountId', 'worldId'] as const),
    codec: 'NotImplemented' as const,
    proposal: Object.freeze({ epochMs: 'NonNegativeSafeInteger' as const }),
    requires: Object.freeze(['AuthoritativeCreationTime', 'ImmutableValue', 'ProposalFreeze'] as const),
  }),
  WorldLink: Object.freeze({
    owner: 'WorldInstance' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'sourceWorldId'] as const),
    codec: 'NotImplemented' as const,
    appliesTo: 'BugShore' as const,
    requires: Object.freeze(['WorldKindAndShoreOrigin', 'SingleWeakSource', 'OrphanedSemantics', 'AIProfileSnapshot'] as const),
  }),
  ChartSnapshot: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'ChartRef'] as const),
    codec: 'NotImplemented' as const,
    requires: Object.freeze(['PremiereFreeze', 'StableContentReference', 'LedgerAssociation'] as const),
  }),
  ChartScore: Object.freeze({
    owner: 'WorldObserver' as const,
    indexes: Object.freeze(['accountId', 'worldId', 'ChartRef'] as const),
    codec: 'NotImplemented' as const,
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
        readonly worldKind: 'Unavailable';
        readonly shoreOrigin: 'Unavailable';
        readonly revision: 'Unavailable';
        readonly capturedAt: number;
      };
      /** No authoritative payload is captured at the directory boundary. */
      readonly capturedParts: Readonly<Record<string, never>>;
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

/** Aggregation boundary in the existing director module; no browser or cc access. */
export class WorldStateSession implements WorldStateReader {
  readonly ownership = stateOwnership;
  readonly worldForkAvailability: WorldForkAvailability = 'NotImplemented';
  private lastCaptureResult: WorldStateCaptureResult | null = null;

  constructor(
    private readonly accountId: string,
    private readonly worldId: string,
    private readonly now: () => number = Date.now,
  ) {
    validateIdentity(accountId, '账号', 64);
    validateIdentity(worldId, '世界', 128);
  }

  /** Read-only diagnostic capture; only the last result reference is published. */
  captureWorldState(): WorldStateCaptureResult {
    const capturedAt = this.now();
    if (!isTime(capturedAt)) { throw new Error('状态捕获时间无效'); }
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

  /** No complete restoration can succeed until B2.2d supplies all codecs/hydration. */
  restoreWorldState(raw: unknown): WorldStateRestoreResult {
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
