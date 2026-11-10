/** B2.5c-1 isolated deterministic replay. No storage, player events, clocks or transport. */
import type {
  CheckpointCoverageEntry, DeveloperRosterChange, MapEditOperation, SharedEntityRecord,
  SharedMapEntityDefinition, SharedSettlementPolicy, SharedTriggerDefinition, SharedTriggerRecord,
  SharedWorldState, TraceTouchAggregate, WorldCheckpointWire, WorldCommitIdentity,
} from './SharedCommitContracts';
import type {
  SharedCryptoPort, ValidatedSharedClosure, ValidatedSharedCommit, ValidatedSharedSeal,
} from './SharedCommitValidator';
import { SharedCommitValidator } from './SharedCommitValidator';
import { SharedCanonicalBytes, SharedSchemaError } from './SharedCanonicalBytes';
import { SharedCommitCodec } from './SharedCommitCodec';

export interface SharedReplayRequest {
  readonly genesis: unknown;
  readonly parentCheckpoint: unknown | null;
  readonly commits: readonly unknown[];
  readonly settlementSeal: unknown | null;
  readonly developerClosure: unknown | null;
  readonly policy: SharedSettlementPolicy;
  readonly gaps: readonly string[];
  readonly pendingCandidateCount: number;
}
export interface SharedReplayDiagnostic {
  readonly identity: WorldCommitIdentity;
  readonly cause: 'MergeConflict' | 'RevertedEdit' | 'InvalidChange';
  /** A deterministic proposal only; this kernel never appends a personal NarrativeEvent. */
  readonly scope: 'PersonalDiagnosticBoundary';
}
/** Local provisional projection, intentionally not a serializable checkpoint coverage entry. */
export type SharedProvisionalCoverageEntry = Omit<CheckpointCoverageEntry, 'finalDiagnostic'> & { readonly finalDiagnostic: null };
export type SharedReplayResult = {
  readonly kind: 'Replayed';
  /** Includes the provisional tail; only checkpoint.state is a settled prefix. */
  readonly state: SharedWorldState;
  readonly coverage: readonly CheckpointCoverageEntry[];
  readonly provisionalCoverage: readonly SharedProvisionalCoverageEntry[];
  readonly checkpoint: WorldCheckpointWire | null;
  readonly diagnostics: readonly SharedReplayDiagnostic[];
  readonly selfContribution: { readonly kind: 'Unknown' };
} | { readonly kind: 'Gap' | 'HostFailure'; readonly reason: string };

type MutableEntityRecord = { -readonly [K in keyof SharedEntityRecord]: SharedEntityRecord[K] };
type MutableTriggerRecord = { -readonly [K in keyof SharedTriggerRecord]: SharedTriggerRecord[K] };
type MutableCoverage = { -readonly [K in keyof CheckpointCoverageEntry]: CheckpointCoverageEntry[K] };
interface ReplayState {
  readonly base: SharedWorldState;
  readonly entities: Map<string, MutableEntityRecord>;
  readonly triggers: Map<string, MutableTriggerRecord>;
  readonly revealed: Set<string>;
  readonly touches: Map<string, TraceTouchAggregate>;
  readonly coDevelopers: Set<string>;
  frozen: boolean;
}
interface AppliedChange {
  readonly result: CheckpointCoverageEntry['applyResult'];
  readonly diagnostic: CheckpointCoverageEntry['finalDiagnostic'];
  readonly superseded: WorldCommitIdentity | null;
}
interface TrustedCheckpoint {
  readonly checkpoint: WorldCheckpointWire;
  readonly seal: ValidatedSharedSeal;
  readonly closure: ValidatedSharedClosure | null;
  /** Digests of complete source containers already verified by this instance, never file-supplied. */
  readonly admittedWireSha256: ReadonlyMap<string, string>;
  readonly observedAllocations: ObservedAllocations;
}
interface ObservedAllocations {
  readonly segments: ReadonlyMap<string, ValidatedSharedCommit['sequenceSegment']>;
  readonly permits: ReadonlyMap<string, string>;
}
class SharedReplayGap extends Error {}
const UINT128_MAX = '340282366920938463463374607431768211455';
const sharedCodec = new SharedCommitCodec();

function requireReplay(condition: boolean, reason: string): asserts condition {
  if (!condition) { throw new SharedReplayGap(reason); }
}
function compareText(first: string, second: string): number { return first < second ? -1 : first > second ? 1 : 0; }
function identityKey(identity: WorldCommitIdentity): string { return identity.authorAccountId + ':' + identity.authorSequence; }
function sameData(first: unknown, second: unknown): boolean {
  return SharedCanonicalBytes.equalBytes(SharedCanonicalBytes.encode(first), SharedCanonicalBytes.encode(second));
}
function compareEntry(first: { appendedAt: { epochMs: number }; identity: WorldCommitIdentity },
  second: { appendedAt: { epochMs: number }; identity: WorldCommitIdentity }): number {
  if (first.appendedAt.epochMs !== second.appendedAt.epochMs) { return first.appendedAt.epochMs < second.appendedAt.epochMs ? -1 : 1; }
  const accountOrder = compareText(first.identity.authorAccountId, second.identity.authorAccountId);
  if (accountOrder !== 0) { return accountOrder; }
  return first.identity.authorSequence < second.identity.authorSequence ? -1 : first.identity.authorSequence > second.identity.authorSequence ? 1 : 0;
}
function stateFrom(base: SharedWorldState): ReplayState {
  return { base, entities: new Map(base.entities.map(record => [record.definition.entityId, { ...record }])),
    triggers: new Map(base.triggers.map(record => [record.definition.triggerId, { ...record }])),
    revealed: new Set(base.revealedResidueEntityIds),
    touches: new Map(base.traceTouches.map(record => [record.traceTouchId, record])),
    coDevelopers: new Set(base.developerRoster.coDeveloperAccountIds), frozen: base.developerRoster.frozen };
}
function stateSnapshot(state: ReplayState): SharedWorldState {
  return sharedCodec.validate('SharedWorldState', {
    schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId: state.base.worldId,
    mapId: state.base.mapId, contentManifestSha256: state.base.contentManifestSha256,
    entities: Array.from(state.entities.values()).sort((a, b) => compareText(a.definition.entityId, b.definition.entityId)),
    triggers: Array.from(state.triggers.values()).sort((a, b) => compareText(a.definition.triggerId, b.definition.triggerId)),
    revealedResidueEntityIds: Array.from(state.revealed).sort(compareText),
    traceTouches: Array.from(state.touches.values()).sort((a, b) => compareText(a.traceTouchId, b.traceTouchId)),
    developerRoster: { worldDeveloperAccountId: state.base.developerRoster.worldDeveloperAccountId,
      coDeveloperAccountIds: Array.from(state.coDevelopers).sort(compareText), frozen: state.frozen },
  });
}
function activeEntity(state: ReplayState, id: string): MutableEntityRecord | null {
  const record = state.entities.get(id);
  return record !== undefined && record.deletedBy === null ? record : null;
}
function validTrigger(state: ReplayState, definition: SharedTriggerDefinition): boolean {
  const anchor = activeEntity(state, definition.anchorEntityId);
  const target = activeEntity(state, definition.action.targetEntityId);
  return anchor !== null && target !== null && target.definition.elementType === 'Residue';
}
function nextTouchCount(count: string): string | null {
  if (count === UINT128_MAX) { return null; }
  const digits = count.split('');
  let carry = 1;
  for (let index = digits.length - 1; index >= 0 && carry !== 0; index -= 1) {
    const next = Number(digits[index]) + carry;
    digits[index] = String(next % 10); carry = next >= 10 ? 1 : 0;
  }
  if (carry !== 0) { digits.unshift('1'); }
  const result = digits.join('');
  if (result.length > UINT128_MAX.length || (result.length === UINT128_MAX.length && result > UINT128_MAX)) { return null; }
  return result;
}
function touchStrength(count: string): number { return count.length > 5 || (count.length === 5 && count >= '65535') ? 65535 : Number(count); }
function applied(result: AppliedChange['result'], diagnostic: AppliedChange['diagnostic'] = null,
  superseded: WorldCommitIdentity | null = null): AppliedChange { return { result, diagnostic, superseded }; }
function invalidChange(): AppliedChange { return applied('InvalidChange', 'InvalidChange'); }

function mapEdit(state: ReplayState, edit: MapEditOperation, identity: WorldCommitIdentity): AppliedChange {
  if (edit.target.kind === 'Entity') {
    const id = edit.target.entityId;
    const record = state.entities.get(id);
    if (edit.operation === 'CreateEntity') {
      if (usedStableId(state, id)) { return applied('NoEffect', 'MergeConflict'); }
      if (!unusedTouchId(state, edit.definition)) { return invalidChange(); }
      state.entities.set(id, { definition: edit.definition, createdBy: identity, lastEditedBy: identity, deletedBy: null });
      return applied('Applied');
    }
    if (edit.operation === 'ReplaceEntity') {
      if (record === undefined) { return invalidChange(); }
      if (record.deletedBy !== null) { return applied('NoEffect', 'MergeConflict'); }
      if (record.definition.elementType !== edit.definition.elementType || !sameData(record.definition.normalTrace, edit.definition.normalTrace)) { return invalidChange(); }
      if (sameData(record.definition, edit.definition)) { return applied('NoEffect'); }
      const superseded = record.lastEditedBy;
      record.definition = edit.definition; record.lastEditedBy = identity;
      return applied('Applied', null, superseded);
    }
    if (edit.operation === 'DeleteEntity') {
      if (record === undefined) { return invalidChange(); }
      if (record.deletedBy !== null) { return applied('NoEffect'); }
      const superseded = record.lastEditedBy;
      record.lastEditedBy = identity; record.deletedBy = identity;
      return applied('Applied', null, superseded);
    }
    return invalidChange();
  }
  const id = edit.target.triggerId;
  const record = state.triggers.get(id);
  if (edit.operation === 'CreateTrigger') {
    if (usedStableId(state, id)) { return applied('NoEffect', 'MergeConflict'); }
    if (!validTrigger(state, edit.definition)) { return invalidChange(); }
    state.triggers.set(id, { definition: edit.definition, createdBy: identity, lastEditedBy: identity, deletedBy: null });
    return applied('Applied');
  }
  if (edit.operation === 'ReplaceTrigger') {
    if (record === undefined) { return invalidChange(); }
    if (record.deletedBy !== null) { return applied('NoEffect', 'MergeConflict'); }
    if (!validTrigger(state, edit.definition)) { return invalidChange(); }
    if (sameData(record.definition, edit.definition)) { return applied('NoEffect'); }
    const superseded = record.lastEditedBy;
    record.definition = edit.definition; record.lastEditedBy = identity;
    return applied('Applied', null, superseded);
  }
  if (edit.operation === 'DeleteTrigger') {
    if (record === undefined) { return invalidChange(); }
    if (record.deletedBy !== null) { return applied('NoEffect'); }
    const superseded = record.lastEditedBy;
    record.lastEditedBy = identity; record.deletedBy = identity;
    return applied('Applied', null, superseded);
  }
  return invalidChange();
}
function usedStableId(state: ReplayState, id: string): boolean {
  if (id === state.base.mapId || state.entities.has(id) || state.triggers.has(id)) { return true; }
  for (const record of state.entities.values()) {
    if (record.definition.normalTrace !== null && record.definition.normalTrace.traceTouchId === id) { return true; }
  }
  return false;
}
function unusedTouchId(state: ReplayState, definition: SharedMapEntityDefinition): boolean {
  return definition.normalTrace === null || (definition.normalTrace.traceTouchId !== definition.entityId
    && !usedStableId(state, definition.normalTrace.traceTouchId));
}
function rosterEdit(state: ReplayState, change: DeveloperRosterChange, author: string,
  targetActive: boolean | null): AppliedChange {
  if (author !== state.base.developerRoster.worldDeveloperAccountId || state.frozen) { return applied('RevertedEdit', 'RevertedEdit'); }
  if (change.accountId === state.base.developerRoster.worldDeveloperAccountId) { return invalidChange(); }
  if (change.operation === 'AddCoDeveloper') {
    if (targetActive !== true) { return invalidChange(); }
    if (state.coDevelopers.has(change.accountId)) { return applied('NoEffect'); }
    state.coDevelopers.add(change.accountId);
  } else {
    if (!state.coDevelopers.has(change.accountId)) { return applied('NoEffect'); }
    state.coDevelopers.delete(change.accountId);
  }
  return applied('Applied');
}
function applyCommit(state: ReplayState, entry: ValidatedSharedCommit): AppliedChange {
  if (entry.invalid || entry.change === null) { return invalidChange(); }
  const change = entry.change;
  if (change.changeClass === 'MonotonicReveal') {
    const record = state.entities.get(change.entityId);
    if (record === undefined || record.definition.elementType !== 'Residue') { return invalidChange(); }
    if (record.deletedBy !== null || state.revealed.has(change.entityId)) { return applied('NoEffect'); }
    state.revealed.add(change.entityId); return applied('Applied');
  }
  if (change.changeClass === 'TraceTouch') {
    const record = state.entities.get(change.normalTraceEntityId);
    if (record === undefined || record.definition.elementType !== 'Trace' || record.definition.normalTrace === null
      || record.definition.normalTrace.traceTouchId !== change.traceTouchId) { return invalidChange(); }
    if (record.deletedBy !== null) { return applied('NoEffect'); }
    const previous = state.touches.get(change.traceTouchId);
    if (previous !== undefined && previous.normalTraceEntityId !== change.normalTraceEntityId) { return invalidChange(); }
    const count = nextTouchCount(previous === undefined ? '0' : previous.totalTouchUnits);
    if (count === null) { return invalidChange(); }
    state.touches.set(change.traceTouchId, { traceTouchId: change.traceTouchId,
      normalTraceEntityId: change.normalTraceEntityId, totalTouchUnits: count, aggregateStrength: touchStrength(count) });
    return applied('Applied');
  }
  const author = entry.identity.authorAccountId;
  if (change.subtype === 'DeveloperRosterChange') { return rosterEdit(state, change, author, entry.rosterTargetObserverActiveAtAppendedAt); }
  const root = state.base.developerRoster.worldDeveloperAccountId;
  if ((author === root && state.frozen) || (author !== root && !state.coDevelopers.has(author))) { return applied('RevertedEdit', 'RevertedEdit'); }
  return mapEdit(state, change.edit, entry.identity);
}

/** Instance-local trusted checkpoint registry. Serialization alone never creates a trusted parent. */
export class SharedWorldReducer {
  private readonly checkpoints = new Map<string, TrustedCheckpoint>();
  constructor(private readonly validator: SharedCommitValidator, private readonly crypto: SharedCryptoPort) {}

  async replay(input: SharedReplayRequest): Promise<SharedReplayResult> {
    try {
      // Clone before the first await: callers cannot alter any pending input or descriptors.
      const request = SharedCanonicalBytes.decode(SharedCanonicalBytes.encode(input)) as SharedReplayRequest;
      requireReplay(request !== null && typeof request === 'object' && Object.keys(request).sort().join(',')
        === 'commits,developerClosure,gaps,genesis,parentCheckpoint,pendingCandidateCount,policy,settlementSeal', 'InvalidReplayRequest');
      requireReplay(Array.isArray(request.commits) && Array.isArray(request.gaps) && request.gaps.every(gap => typeof gap === 'string')
        && Number.isSafeInteger(request.pendingCandidateCount) && request.pendingCandidateCount >= 0, 'InvalidReplayRequest');
      requireReplay(request.gaps.length === 0, 'BoundViolated');
      requireReplay(request.pendingCandidateCount === 0, 'PendingCandidates');
      const policy = sharedCodec.validate('SharedSettlementPolicy', request.policy);
      const genesisResult = await this.validator.validateGenesis(request.genesis);
      if (genesisResult.kind !== 'Verified') { return genesisResult; }
      requireReplay(this.validator.ownsGenesis(genesisResult.value), 'GenesisCapabilityUntrusted');
      const genesis = genesisResult.value.genesis;
      const genesisHash = genesisResult.value.genesisSha256;
      const parent = await this.readParent(request.parentCheckpoint, genesisHash, policy);
      let closure: ValidatedSharedClosure | null = parent === null ? null : parent.closure;
      if (request.developerClosure !== null) {
        const result = await this.validator.validateClosure(request.developerClosure);
        if (result.kind !== 'Verified') { return result; }
        requireReplay(this.validator.ownsClosure(result.value), 'ClosureCapabilityUntrusted');
        if (closure !== null) { requireReplay(closure.receiptSha256 === result.value.receiptSha256, 'ClosureConflict'); }
        else if (parent !== null) { requireReplay(result.value.closure.effectiveAtServerEpochMs > parent.checkpoint.coveredThroughEpochMs, 'ClosureBackdated'); }
        closure = result.value;
      }
      let seal: ValidatedSharedSeal | null = null;
      if (request.settlementSeal !== null) {
        const result = await this.validator.validateSeal(request.settlementSeal, policy, parent === null ? null : parent.seal);
        if (result.kind !== 'Verified') { return result; }
        requireReplay(this.validator.ownsSeal(result.value), 'SealCapabilityUntrusted'); seal = result.value;
      }
      const parentCoverage = parent === null ? [] : parent.checkpoint.coverage;
      const coverage = new Map<string, MutableCoverage>(parentCoverage.map(entry => [identityKey(entry.identity), { ...entry }]));
      const revisions = new Map<number, string>(parentCoverage.map(entry => [entry.admissionRevision, identityKey(entry.identity)]));
      const entries = new Map<string, ValidatedSharedCommit>();
      for (const raw of request.commits) {
        // An exact, previously verified re-delivery inherits local parent trust without old epoch keys.
        // Changed receipts/proofs still follow the complete validation path; a claimed digest is insufficient.
        if (parent !== null) {
          const candidate = sharedCodec.validate('AdmittedWorldCommit', raw);
          const candidateKey = identityKey(candidate.admissionReceipt.payload.identity);
          const knownWire = parent.admittedWireSha256.get(candidateKey);
          if (knownWire !== undefined && knownWire === await this.hash(candidate)) { continue; }
        }
        const result = await this.validator.validateCommit(raw);
        if (result.kind !== 'Verified') { return result; }
        const entry = result.value;
        requireReplay(this.validator.ownsCommit(entry), 'CommitCapabilityUntrusted');
        const key = identityKey(entry.identity);
        const covered = coverage.get(key);
        if (covered !== undefined) {
          requireReplay(covered.envelopeSha256 === entry.envelopeSha256 && covered.admissionRevision === entry.admissionRevision
            && covered.appendedAt.epochMs === entry.appendedAt.epochMs, 'IdentityConflict');
          continue;
        }
        requireReplay(parent === null || entry.appendedAt.epochMs > parent.checkpoint.coveredThroughEpochMs, 'SealedPrefixInsertion');
        const existing = entries.get(key);
        if (existing !== undefined) {
          requireReplay(existing.envelopeSha256 === entry.envelopeSha256 && existing.admissionRevision === entry.admissionRevision
            && existing.appendedAt.epochMs === entry.appendedAt.epochMs, 'IdentityConflict');
          continue;
        }
        requireReplay(!revisions.has(entry.admissionRevision) || revisions.get(entry.admissionRevision) === key, 'AdmissionRevisionConflict');
        revisions.set(entry.admissionRevision, key); entries.set(key, entry);
      }
      const ordered = Array.from(entries.values()).sort(compareEntry);
      this.verifyObservedAllocations(ordered, parent === null ? null : parent.observedAllocations);
      const working = stateFrom(parent === null ? genesis.initialState : parent.checkpoint.state);
      let checkpoint: WorldCheckpointWire | null = null;
      let nextTrusted: TrustedCheckpoint | null = null;
      let tail = ordered;
      if (seal !== null) {
        const cutoff = seal.seal.sealedThroughEpochMs;
        const prefix = ordered.filter(entry => entry.appendedAt.epochMs <= cutoff);
        tail = ordered.filter(entry => entry.appendedAt.epochMs > cutoff);
        for (const entry of prefix) { this.apply(working, coverage, entry, closure, true); }
        const covered = Array.from(coverage.values()).sort(compareEntry);
        requireReplay(covered.every(entry => entry.appendedAt.epochMs <= cutoff), 'CoverageBeyondSeal');
        const prefixDigest = await this.hash(covered.map(entry => ({ identity: entry.identity,
          envelopeSha256: entry.envelopeSha256, appendedAt: entry.appendedAt })));
        requireReplay(covered.length === seal.seal.admittedCommitCount && prefixDigest === seal.seal.admittedPrefixSha256, 'MissingAdmittedPrefix');
        const coveredClosure = closure !== null && closure.closure.effectiveAtServerEpochMs <= cutoff ? closure : null;
        requireReplay(seal.seal.developerClosureSha256 === (coveredClosure === null ? null : coveredClosure.receiptSha256), 'ClosureSealMismatch');
        if (coveredClosure !== null) { working.frozen = true; }
        const state = stateSnapshot(working);
        const unsignedCheckpoint = { schemaVersion: 1 as const, profile: 'ExternalSharedOnlineV1' as const,
          worldId: genesis.worldId, genesisSha256: genesisHash,
          parentCheckpointSha256: parent === null ? null : parent.checkpoint.checkpointSha256,
          coveredThroughEpochMs: cutoff, settlementSeal: seal.wire,
          developerClosure: coveredClosure === null ? null : coveredClosure.wire,
          coverage: covered, coverageSha256: await this.hash(covered), state, stateSha256: await this.hash(state) };
        checkpoint = sharedCodec.validate('WorldCheckpointWire', { ...unsignedCheckpoint,
          checkpointSha256: await this.hash(unsignedCheckpoint) });
        // Same seal re-delivery is a duplicate, not a new checkpoint with a different parent.
        if (parent !== null && cutoff === parent.checkpoint.coveredThroughEpochMs) {
          requireReplay(sameData(state, parent.checkpoint.state) && sameData(covered, parent.checkpoint.coverage), 'SealPrefixConflict');
          checkpoint = parent.checkpoint;
        }
        const admittedWireSha256 = new Map(parent === null ? [] : parent.admittedWireSha256);
        for (const entry of prefix) { admittedWireSha256.set(identityKey(entry.identity), await this.hash(entry.wire)); }
        nextTrusted = { checkpoint, seal, closure: coveredClosure, admittedWireSha256,
          observedAllocations: this.verifyObservedAllocations(prefix, parent === null ? null : parent.observedAllocations) };
      }
      const provisional = new Map<string, MutableCoverage>();
      for (const entry of tail) { this.apply(working, provisional, entry, closure, false); }
      // Closure is an independent fact; even an empty tail must project its effect outside an earlier seal.
      if (closure !== null) { working.frozen = true; }
      const snapshot = stateSnapshot(working);
      const settled = Array.from(coverage.values()).sort(compareEntry);
      const diagnostics: SharedReplayDiagnostic[] = settled.filter(entry => entry.finalDiagnostic !== null
        && !parentCoverage.some(old => identityKey(old.identity) === identityKey(entry.identity) && old.finalDiagnostic === entry.finalDiagnostic))
        .map(entry => ({ identity: entry.identity, cause: entry.finalDiagnostic as SharedReplayDiagnostic['cause'], scope: 'PersonalDiagnosticBoundary' }));
      if (nextTrusted !== null) { this.checkpoints.set(nextTrusted.checkpoint.checkpointSha256, nextTrusted); }
      return Object.freeze({ kind: 'Replayed', state: snapshot,
        coverage: Object.freeze(settled.map(entry => Object.freeze({ ...entry }))),
        provisionalCoverage: Object.freeze(Array.from(provisional.values()).sort(compareEntry).map(entry => Object.freeze({ ...entry, finalDiagnostic: null }))),
        checkpoint, diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic))), selfContribution: Object.freeze({ kind: 'Unknown' }) });
    } catch (error: unknown) {
      if (error instanceof SharedReplayGap) { return { kind: 'Gap', reason: error.message }; }
      if (error instanceof SharedSchemaError) { return { kind: 'Gap', reason: error.code }; }
      return { kind: 'HostFailure', reason: 'ReplayHostFailure' };
    }
  }

  private async hash(value: unknown): Promise<string> {
    const digest = await this.crypto.sha256(SharedCanonicalBytes.encode(value));
    if (!/^[0-9a-f]{64}$/.test(digest)) { throw new Error('InvalidCryptoDigest'); }
    return digest;
  }
  private async readParent(input: unknown | null, genesisHash: string, policy: SharedSettlementPolicy): Promise<TrustedCheckpoint | null> {
    if (input === null) { return null; }
    const value = sharedCodec.validate('WorldCheckpointWire', input);
    const existing = this.checkpoints.get(value.checkpointSha256);
    requireReplay(existing !== undefined && sameData(existing.checkpoint, value), 'CheckpointUnverifiable');
    const parent = existing as TrustedCheckpoint;
    requireReplay(parent.checkpoint.genesisSha256 === genesisHash && parent.seal.seal.policySha256 === await this.hash(policy), 'CheckpointContextMismatch');
    requireReplay(this.validator.ownsSeal(parent.seal) && (parent.closure === null || this.validator.ownsClosure(parent.closure)), 'CheckpointCapabilityUntrusted');
    return parent;
  }
  private apply(state: ReplayState, coverage: Map<string, MutableCoverage>, entry: ValidatedSharedCommit,
    closure: ValidatedSharedClosure | null, settled: boolean): void {
    if (closure !== null && entry.appendedAt.epochMs >= closure.closure.effectiveAtServerEpochMs) { state.frozen = true; }
    const change = applyCommit(state, entry);
    if (settled && change.superseded !== null) {
      const previous = coverage.get(identityKey(change.superseded));
      requireReplay(previous !== undefined && previous.applyResult === 'Applied', 'MissingEditCoverage');
      if (previous.finalDiagnostic === null) { previous.finalDiagnostic = 'MergeConflict'; }
    }
    coverage.set(identityKey(entry.identity), { identity: entry.identity, envelopeSha256: entry.envelopeSha256,
      appendedAt: entry.appendedAt, admissionRevision: entry.admissionRevision,
      applyResult: change.result, finalDiagnostic: settled ? change.diagnostic : null });
  }
  private verifyObservedAllocations(entries: readonly ValidatedSharedCommit[], parent: ObservedAllocations | null): ObservedAllocations {
    const segments = new Map(parent === null ? [] : parent.segments);
    const permits = new Map(parent === null ? [] : parent.permits);
    for (const entry of entries) {
      const segment = entry.sequenceSegment;
      const previous = segments.get(segment.segmentId);
      if (previous !== undefined) { requireReplay(sameData(previous, segment), 'SequenceSegmentConflict'); }
      else {
        for (const known of segments.values()) {
          requireReplay(known.authorAccountId !== segment.authorAccountId || known.lastSequence < segment.firstSequence
            || segment.lastSequence < known.firstSequence, 'SequenceSegmentOverlap');
        }
        segments.set(segment.segmentId, segment);
      }
      const owner = permits.get(entry.header.permitId);
      requireReplay(owner === undefined || owner === identityKey(entry.identity), 'PermitIdentityConflict');
      permits.set(entry.header.permitId, identityKey(entry.identity));
    }
    return { segments, permits };
  }
}
