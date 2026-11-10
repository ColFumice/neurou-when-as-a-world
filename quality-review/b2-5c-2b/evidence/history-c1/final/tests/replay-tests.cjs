'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SharedWorldReducer } = require('../evidence/build/SharedWorldReducer.js');
const { SharedCommitValidator } = require('../evidence/build/SharedCommitValidator.js');
const { createFixture, clone, hash, uid } = require('../evidence/fixtures.cjs');

function reducer(f, context = f.context, port = f.cryptoPort) {
  return new SharedWorldReducer(new SharedCommitValidator(port, context), port);
}
function request(f, commits, extra = {}) {
  return { genesis: f.genesis, parentCheckpoint: null, commits, settlementSeal: null,
    developerClosure: null, policy: f.policy, gaps: [], pendingCandidateCount: 0, ...extra };
}
async function settled(f, commits, extra = {}, kernel = reducer(f)) {
  return kernel.replay(request(f, commits, { settlementSeal: f.makeSeal(commits), ...extra }));
}
function definition(f, id, lateralMilli) {
  const def = clone(f.genesis.initialState.entities.find(record => record.definition.entityId === id).definition);
  def.position.lateralMilli = lateralMilli; return def;
}
function replace(f, id, position, options = {}) {
  return f.makeAdmitted(f.mapEdit({ operation: 'ReplaceEntity', target: { kind: 'Entity', entityId: id },
    definition: definition(f, id, position) }), options);
}
function remove(f, id, options = {}) {
  return f.makeAdmitted(f.mapEdit({ operation: 'DeleteEntity', target: { kind: 'Entity', entityId: id } }), options);
}
function resultFor(result, account, sequence) {
  return result.coverage.find(entry => entry.identity.authorAccountId === account && entry.identity.authorSequence === sequence);
}

test('R01 deterministic three-class replay, unique touch and canonical checkpoint hashes', async () => {
  const f = createFixture();
  const reveal = f.makeAdmitted(f.reveal(), { seq: 1, admissionRevision: 1 });
  const touch = f.makeAdmitted(f.touch(), { actor: 'observer', seq: 1, admissionRevision: 2 });
  const edit = replace(f, f.ids.entityA, 1200, { actor: 'coDeveloper', seq: 1, admissionRevision: 3 });
  const commits = [reveal, touch, edit], seal = f.makeSeal(commits);
  const kernel = reducer(f);
  const a = await settled(f, commits, { settlementSeal: seal }, kernel);
  const b = await settled(f, [edit, reveal, touch, clone(touch)], { settlementSeal: seal }, kernel);
  assert.equal(a.kind, 'Replayed'); assert.deepEqual(a, b);
  assert.deepEqual(a.state.revealedResidueEntityIds, [f.ids.residue]);
  assert.equal(a.state.traceTouches[0].totalTouchUnits, '1'); assert.equal(a.state.traceTouches[0].aggregateStrength, 1);
  assert.equal(a.state.entities.find(record => record.definition.entityId === f.ids.entityA).definition.position.lateralMilli, 1200);
  assert.equal(a.coverage.length, 3); assert.equal(a.provisionalCoverage.length, 0);
  assert.deepEqual(a.selfContribution, { kind: 'Unknown' });
  const check = clone(a.checkpoint), actual = check.checkpointSha256; delete check.checkpointSha256;
  assert.equal(actual, hash(check)); assert.equal(a.checkpoint.stateSha256, hash(a.checkpoint.state));
  assert.equal(a.checkpoint.coverageSha256, hash(a.checkpoint.coverage));
});

test('R02 same-millisecond order is account ASCII then sequence, independent of receipt order', async () => {
  const f = createFixture();
  const co = replace(f, f.ids.entityA, 200, { actor: 'coDeveloper', seq: 1, admissionRevision: 1 });
  const root = replace(f, f.ids.entityA, 100, { seq: 1, admissionRevision: 2 });
  const out = await settled(f, [co, root]); assert.equal(out.kind, 'Replayed');
  assert.equal(out.state.entities.find(record => record.definition.entityId === f.ids.entityA).definition.position.lateralMilli, 200);
  assert.equal(out.coverage[0].identity.authorAccountId, f.actors.developer.accountId);
  assert.equal(out.coverage[0].finalDiagnostic, 'MergeConflict');
});

test('R03 two devices share an account with nonoverlapping segments; holes stay absent from coverage', async () => {
  const f = createFixture();
  const a = f.makeAdmitted(f.touch(), { actor: 'observer', seq: 7, admissionRevision: 1 });
  const b = f.makeAdmitted(f.touch(), { actor: 'observerDevice2', seq: 1030, admissionRevision: 2 });
  const out = await settled(f, [b, a]); assert.equal(out.kind, 'Replayed');
  assert.equal(out.state.traceTouches[0].totalTouchUnits, '2');
  assert.deepEqual(out.coverage.map(entry => entry.identity.authorSequence), [7, 1030]);
});

test('R04 signed overlapping segments from different devices are refused', async () => {
  const f = createFixture();
  const a = f.makeAdmitted(f.touch(), { actor: 'observer', seq: 1, admissionRevision: 1 });
  const b = f.makeAdmitted(f.touch(), { actor: 'observerDevice2', seq: 2, admissionRevision: 2 });
  const out = await settled(f, [a, b]); assert.deepEqual(out, { kind: 'Gap', reason: 'SequenceSegmentOverlap' });
});

test('R05 same identity with two authored envelope digests is an IdentityConflict', async () => {
  const f = createFixture();
  const a = f.makeAdmitted(f.reveal(), { seq: 1, admissionRevision: 1 });
  const b = f.makeAdmitted(f.touch(), { seq: 1, admissionRevision: 2 });
  const out = await settled(f, [a, b]); assert.equal(out.kind, 'Gap'); assert.equal(out.reason, 'IdentityConflict');
});

test('R06 different objects remain independent when one target is deleted', async () => {
  const f = createFixture();
  const a = remove(f, f.ids.entityA, { seq: 1, appendedAt: f.baseTime, admissionRevision: 1 });
  const b = replace(f, f.ids.entityA, 9, { actor: 'coDeveloper', seq: 1, appendedAt: f.baseTime + 1, admissionRevision: 2 });
  const c = replace(f, f.ids.entityB, 12, { actor: 'coDeveloper', seq: 2, appendedAt: f.baseTime + 2, admissionRevision: 3 });
  const out = await settled(f, [c, b, a], { settlementSeal: f.makeSeal([a, b, c], { coveredThrough: f.baseTime + 2 }) });
  assert.equal(out.kind, 'Replayed');
  assert.notEqual(out.state.entities.find(record => record.definition.entityId === f.ids.entityA).deletedBy, null);
  assert.equal(out.state.entities.find(record => record.definition.entityId === f.ids.entityB).definition.position.lateralMilli, 12);
  assert.equal(resultFor(out, f.actors.coDeveloper.accountId, 1).finalDiagnostic, 'MergeConflict');
  assert.equal(resultFor(out, f.actors.coDeveloper.accountId, 2).applyResult, 'Applied');
});

test('R07 tombstones prevent Replace/Create resurrection, repeated Delete is NoEffect without new diagnostic', async () => {
  const f = createFixture();
  const original = definition(f, f.ids.entityA, 0);
  const commits = [remove(f, f.ids.entityA, { seq: 1, appendedAt: f.baseTime }),
    f.makeAdmitted(f.mapEdit({ operation: 'CreateEntity', target: { kind: 'Entity', entityId: f.ids.entityA }, definition: original }), { seq: 2, appendedAt: f.baseTime + 1 }),
    replace(f, f.ids.entityA, 300, { seq: 3, appendedAt: f.baseTime + 2 }),
    remove(f, f.ids.entityA, { seq: 4, appendedAt: f.baseTime + 3 })];
  const out = await settled(f, commits, { settlementSeal: f.makeSeal(commits, { coveredThrough: f.baseTime + 3 }) });
  assert.equal(out.kind, 'Replayed'); assert.equal(out.coverage[1].finalDiagnostic, 'MergeConflict');
  assert.equal(out.coverage[2].finalDiagnostic, 'MergeConflict'); assert.equal(out.coverage[3].applyResult, 'NoEffect');
  assert.equal(out.coverage[3].finalDiagnostic, null); assert.equal(out.state.entities[2].deletedBy.authorSequence, 1);
});

test('R08 CoDeveloper permission is evaluated at total-order position, not receipt or pull order', async () => {
  const f = createFixture();
  const early = replace(f, f.ids.entityA, 100, { actor: 'coDeveloper', seq: 1, admissionRevision: 3, appendedAt: f.baseTime });
  const revoke = f.makeAdmitted(f.roster('RemoveCoDeveloper', f.actors.coDeveloper), { seq: 1, admissionRevision: 2, appendedAt: f.baseTime + 1 });
  const late = replace(f, f.ids.entityB, 200, { actor: 'coDeveloper', seq: 2, admissionRevision: 1, appendedAt: f.baseTime + 2 });
  const out = await settled(f, [late, revoke, early], { settlementSeal: f.makeSeal([early, revoke, late], { coveredThrough: f.baseTime + 2 }) });
  assert.equal(out.kind, 'Replayed'); assert.equal(resultFor(out, f.actors.coDeveloper.accountId, 1).applyResult, 'Applied');
  assert.equal(resultFor(out, f.actors.coDeveloper.accountId, 2).applyResult, 'RevertedEdit');
  assert.equal(out.state.entities.find(record => record.definition.entityId === f.ids.entityB).definition.position.lateralMilli, 0);
});

test('R09 observer cannot edit map, developer can grant observer then editing works', async () => {
  const f = createFixture();
  const before = replace(f, f.ids.entityA, 10, { actor: 'observer', seq: 1, admissionRevision: 1, appendedAt: f.baseTime });
  const grant = f.makeAdmitted(f.roster('AddCoDeveloper'), { seq: 1, admissionRevision: 2, appendedAt: f.baseTime + 1 });
  const after = replace(f, f.ids.entityB, 20, { actor: 'observer', seq: 2, admissionRevision: 3, appendedAt: f.baseTime + 2 });
  const out = await settled(f, [after, grant, before], { settlementSeal: f.makeSeal([before, grant, after], { coveredThrough: f.baseTime + 2 }) });
  assert.equal(out.kind, 'Replayed'); assert.equal(out.coverage[0].applyResult, 'RevertedEdit');
  assert.equal(out.coverage[2].applyResult, 'Applied'); assert(out.state.developerRoster.coDeveloperAccountIds.includes(f.actors.observer.accountId));
});

test('R10 unsealed tail emits provisional coverage only and reorders on earlier revocation', async () => {
  const f = createFixture(); const kernel = reducer(f);
  const late = replace(f, f.ids.entityA, 99, { actor: 'coDeveloper', seq: 1, admissionRevision: 1, appendedAt: f.baseTime + 2 });
  const first = await kernel.replay(request(f, [late])); assert.equal(first.kind, 'Replayed');
  assert.equal(first.checkpoint, null); assert.equal(first.coverage.length, 0); assert.equal(first.diagnostics.length, 0);
  assert.equal(first.provisionalCoverage[0].applyResult, 'Applied');
  const revoke = f.makeAdmitted(f.roster('RemoveCoDeveloper', f.actors.coDeveloper), { seq: 1, admissionRevision: 2, appendedAt: f.baseTime + 1 });
  const second = await kernel.replay(request(f, [late, revoke])); assert.equal(second.kind, 'Replayed');
  assert.equal(second.provisionalCoverage[1].applyResult, 'RevertedEdit'); assert.equal(second.provisionalCoverage[1].finalDiagnostic, null);
  assert.equal(second.state.entities.find(record => record.definition.entityId === f.ids.entityA).definition.position.lateralMilli, 0);
});

test('R11 seal includes only complete prefix, tail cannot add terminal coverage or diagnostics', async () => {
  const f = createFixture();
  const early = replace(f, f.ids.entityA, 10, { seq: 1, admissionRevision: 1, appendedAt: f.baseTime });
  const tail = replace(f, f.ids.entityA, 20, { actor: 'coDeveloper', seq: 1, admissionRevision: 2, appendedAt: f.baseTime + 1 });
  const out = await settled(f, [tail, early]); assert.equal(out.kind, 'Replayed');
  assert.equal(out.checkpoint.state.entities[2].definition.position.lateralMilli, 10);
  assert.equal(out.state.entities[2].definition.position.lateralMilli, 20);
  assert.equal(out.coverage.length, 1); assert.equal(out.coverage[0].finalDiagnostic, null); assert.equal(out.diagnostics.length, 0);
  assert.equal(out.provisionalCoverage.length, 1);
});

test('R12 missing admitted prefix is Gap even with valid seal signature', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal()), b = f.makeAdmitted(f.touch());
  const out = await settled(f, [a], { settlementSeal: f.makeSeal([a, b]) });
  assert.deepEqual(out, { kind: 'Gap', reason: 'MissingAdmittedPrefix' });
});

test('R13 seal beyond S-H is rejected; H and retention inequalities are enforced', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal());
  const bad = f.makeSeal([a], { issuedAt: f.baseTime + f.policy.settleHorizonMs - 1 });
  const out = await settled(f, [a], { settlementSeal: bad }); assert.equal(out.kind, 'Gap');
  const policy = { ...f.policy, retentionMs: f.policy.settleHorizonMs - 1 };
  const invalid = await reducer(f).replay(request(f, [a], { policy })); assert.equal(invalid.kind, 'Gap');
});

test('R14 exact admitted bad body is covered as technical InvalidChange without state side effects', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal(), { bodyBytes: Buffer.from('{"revealed":true,"revealed":false}') });
  const out = await settled(f, [a]); assert.equal(out.kind, 'Replayed');
  assert.deepEqual(clone(out.state), f.genesis.initialState); assert.equal(out.coverage[0].applyResult, 'InvalidChange');
  assert.equal(out.coverage[0].finalDiagnostic, 'InvalidChange'); assert.equal(out.diagnostics[0].scope, 'PersonalDiagnosticBoundary');
});

test('R15 missing key and missing exact byte source prevent advancement, not InvalidChange', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal());
  const keyless = reducer(f, { ...f.context, lookupWorldRelayKey: async () => null });
  assert.equal((await settled(f, [a], {}, keyless)).kind, 'Gap');
  const truncated = clone(a); truncated.envelopeBytesBase64Url = 'AA';
  const out = await settled(f, [truncated]); assert.equal(out.kind, 'Gap'); assert.notEqual(out.reason, 'InvalidChange');
});

test('R16 host failure never becomes InvalidChange or stores a trusted checkpoint', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal());
  const port = { ...f.cryptoPort, async decryptAes256Gcm() { throw new Error('host offline'); } };
  const out = await settled(f, [a], {}, reducer(f, f.context, port)); assert.equal(out.kind, 'HostFailure');
  assert.equal(Object.hasOwn(out, 'checkpoint'), false);
});

test('R17 checkpoint parent is runtime trusted, not serialized brand or self-consistent hashes', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal()), kernel = reducer(f);
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  const other = reducer(f);
  const foreign = await other.replay(request(f, [], { parentCheckpoint: clone(first.checkpoint) }));
  assert.deepEqual(foreign, { kind: 'Gap', reason: 'CheckpointUnverifiable' });
  const mutated = clone(first.checkpoint); mutated.state.revealedResidueEntityIds = [];
  const invalid = await kernel.replay(request(f, [], { parentCheckpoint: mutated })); assert.equal(invalid.kind, 'Gap');
});

test('R18 trusted parent can advance without old log; null diagnostic becomes sealed MergeConflict', async () => {
  const f = createFixture(); const kernel = reducer(f);
  const a = replace(f, f.ids.entityA, 10, { seq: 1, admissionRevision: 1 });
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  const before = JSON.stringify(first.checkpoint);
  const b = replace(f, f.ids.entityA, 20, { actor: 'coDeveloper', seq: 1, admissionRevision: 2, appendedAt: f.baseTime + 1 });
  const seal = f.makeSeal([a, b], { coveredThrough: f.baseTime + 1, sealRevision: 2, previousSealSha256: hash(first.checkpoint.settlementSeal) });
  const next = await kernel.replay(request(f, [b], { parentCheckpoint: clone(first.checkpoint), settlementSeal: seal }));
  assert.equal(next.kind, 'Replayed'); assert.equal(next.coverage[0].finalDiagnostic, 'MergeConflict');
  assert.equal(next.coverage[0].applyResult, 'Applied'); assert.equal(next.diagnostics.length, 1);
  assert.equal(JSON.stringify(first.checkpoint), before); assert.equal(next.checkpoint.parentCheckpointSha256, first.checkpoint.checkpointSha256);
});

test('R19 same seal retry returns original checkpoint rather than inventing a new parent chain', async () => {
  const f = createFixture(); const kernel = reducer(f), a = f.makeAdmitted(f.reveal());
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  const again = await kernel.replay(request(f, [], { parentCheckpoint: clone(first.checkpoint), settlementSeal: clone(first.checkpoint.settlementSeal) }));
  assert.equal(again.kind, 'Replayed'); assert.deepEqual(again.checkpoint, first.checkpoint); assert.equal(again.diagnostics.length, 0);
});

test('R20 signed new identity below a sealed boundary is Gap, while exact covered duplicate adds nothing', async () => {
  const f = createFixture(); const kernel = reducer(f), a = f.makeAdmitted(f.reveal());
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  const dup = await kernel.replay(request(f, [clone(a)], { parentCheckpoint: first.checkpoint }));
  assert.equal(dup.kind, 'Replayed'); assert.equal(dup.coverage.length, 1); assert.equal(dup.provisionalCoverage.length, 0);
  const old = f.makeAdmitted(f.touch(), { seq: 2, admissionRevision: 2, appendedAt: f.baseTime - 1 });
  const out = await kernel.replay(request(f, [old], { parentCheckpoint: first.checkpoint }));
  assert.deepEqual(out, { kind: 'Gap', reason: 'SealedPrefixInsertion' });
});

test('R21 account closure at the same timestamp freezes root roster but preserves existing CoDeveloper edits', async () => {
  const f = createFixture();
  const closure = f.signReceipt('WorldDeveloperClosure', { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId,
    worldId: f.ids.world, worldDeveloperAccountId: f.actors.developer.accountId, effectiveAtServerEpochMs: f.baseTime, accountFactRevision: 1 });
  const root = replace(f, f.ids.entityA, 10, { seq: 1, admissionRevision: 1 });
  const co = replace(f, f.ids.entityB, 20, { actor: 'coDeveloper', seq: 1, admissionRevision: 2 });
  const out = await settled(f, [root, co], { developerClosure: closure, settlementSeal: f.makeSeal([root, co], { developerClosure: closure }) });
  assert.equal(out.kind, 'Replayed'); assert.equal(out.state.developerRoster.frozen, true);
  assert.equal(out.coverage[0].applyResult, 'RevertedEdit'); assert.equal(out.coverage[1].applyResult, 'Applied');
  assert.equal(out.checkpoint.developerClosure.signatureBase64Url, closure.signatureBase64Url);
});

test('R22 closure not bound by seal and newly backdated closure cannot change trusted parent', async () => {
  const f = createFixture(); const kernel = reducer(f), a = f.makeAdmitted(f.reveal());
  const closure = f.signReceipt('WorldDeveloperClosure', { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId,
    worldId: f.ids.world, worldDeveloperAccountId: f.actors.developer.accountId, effectiveAtServerEpochMs: f.baseTime, accountFactRevision: 1 });
  const mismatched = await settled(f, [a], { developerClosure: closure }); assert.equal(mismatched.kind, 'Gap');
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  const late = await kernel.replay(request(f, [], { parentCheckpoint: first.checkpoint, developerClosure: closure }));
  assert.deepEqual(late, { kind: 'Gap', reason: 'ClosureBackdated' });
});

test('R23 trigger dangling creation is invalid; deleting anchor preserves existing trigger definition', async () => {
  const f = createFixture(); const created = clone(f.trigger); created.triggerId = uid(900); created.anchorEntityId = uid(901);
  const a = f.makeAdmitted(f.mapEdit({ operation: 'CreateTrigger', target: { kind: 'Trigger', triggerId: created.triggerId }, definition: created }), { seq: 1 });
  const b = remove(f, f.ids.entityA, { seq: 2 });
  const out = await settled(f, [a, b]); assert.equal(out.kind, 'Replayed');
  assert.equal(out.coverage[0].applyResult, 'InvalidChange'); assert.equal(out.state.triggers.length, 1);
  assert.deepEqual(clone(out.state.triggers[0]), f.genesis.initialState.triggers[0]);
});

test('R24 explicit Create records attribution, equal Replace is NoEffect and deletion is permanent', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.mapEdit({ operation: 'CreateEntity', target: { kind: 'Entity', entityId: f.ids.newEntity }, definition: f.approvedNewDefinition }), { seq: 1 });
  const b = f.makeAdmitted(f.mapEdit({ operation: 'ReplaceEntity', target: { kind: 'Entity', entityId: f.ids.newEntity }, definition: clone(f.approvedNewDefinition) }), { seq: 2 });
  const c = remove(f, f.ids.newEntity, { seq: 3 });
  const out = await settled(f, [a, b, c]); assert.equal(out.kind, 'Replayed');
  const record = out.state.entities.find(item => item.definition.entityId === f.ids.newEntity);
  assert.equal(record.createdBy.authorSequence, 1); assert.equal(record.lastEditedBy.authorSequence, 3); assert.equal(record.deletedBy.authorSequence, 3);
  assert.equal(out.coverage[1].applyResult, 'NoEffect'); assert.equal(out.coverage[0].finalDiagnostic, 'MergeConflict');
});

test('R25 bound failure or pending candidates prevents a checkpoint; input is immutable across awaits', async () => {
  const f = createFixture(); const a = f.makeAdmitted(f.reveal());
  assert.deepEqual(await settled(f, [a], { gaps: ['RetentionExpired'] }), { kind: 'Gap', reason: 'BoundViolated' });
  assert.deepEqual(await settled(f, [a], { pendingCandidateCount: 1 }), { kind: 'Gap', reason: 'PendingCandidates' });
  const value = request(f, [a]); const kernel = reducer(f); const promise = kernel.replay(value);
  value.commits[0].admissionReceipt.payload.envelopeSha256 = '0'.repeat(64); value.gaps.push('race');
  const out = await promise; assert.equal(out.kind, 'Replayed'); assert.deepEqual(out.state.revealedResidueEntityIds, [f.ids.residue]);
});

test('R26 same-account device conflicts have no exemption and exact aggregate survives display saturation', async () => {
  const f = createFixture();
  f.genesis.initialState.traceTouches = [{ traceTouchId: f.ids.traceTouch, normalTraceEntityId: f.ids.trace, totalTouchUnits: '65535', aggregateStrength: 65535 }];
  f.context.genesisSha256 = hash(f.genesis);
  const a = f.makeAdmitted(f.touch(), { actor: 'observer', seq: 1, admissionRevision: 1 });
  const out = await settled(f, [a]); assert.equal(out.kind, 'Replayed');
  assert.equal(out.state.traceTouches[0].totalTouchUnits, '65536'); assert.equal(out.state.traceTouches[0].aggregateStrength, 65535);
  assert.equal(out.selfContribution.kind, 'Unknown');
  const g = createFixture();
  const first = replace(g, g.ids.entityA, 1, { actor: 'observer', seq: 1, admissionRevision: 1 });
  const second = replace(g, g.ids.entityA, 2, { actor: 'observerDevice2', seq: 1025, admissionRevision: 2 });
  g.genesis.initialState.developerRoster.coDeveloperAccountIds.push(g.actors.observer.accountId);
  g.context.genesisSha256 = hash(g.genesis);
  const sameAccount = await settled(g, [first, second]); assert.equal(sameAccount.kind, 'Replayed');
  assert.equal(sameAccount.coverage[0].finalDiagnostic, 'MergeConflict');
});

test('R27 uint128 overflow and deleted trace target do not add touch or narrative facts', async () => {
  const f = createFixture();
  f.genesis.initialState.traceTouches = [{ traceTouchId: f.ids.traceTouch, normalTraceEntityId: f.ids.trace,
    totalTouchUnits: '340282366920938463463374607431768211455', aggregateStrength: 65535 }];
  f.context.genesisSha256 = hash(f.genesis);
  const a = f.makeAdmitted(f.touch()); const out = await settled(f, [a]); assert.equal(out.kind, 'Replayed');
  assert.equal(out.coverage[0].applyResult, 'InvalidChange'); assert.equal(out.state.traceTouches[0].totalTouchUnits, '340282366920938463463374607431768211455');
  const g = createFixture(); const drop = remove(g, g.ids.trace, { seq: 1, admissionRevision: 1 });
  const touch = g.makeAdmitted(g.touch(), { actor: 'observer', seq: 1, admissionRevision: 2 });
  const dead = await settled(g, [drop, touch]); assert.equal(dead.kind, 'Replayed');
  assert.equal(dead.coverage[1].applyResult, 'NoEffect'); assert.equal(dead.state.traceTouches.length, 0);
});

test('R28 exact covered re-delivery inherits local trust after old epoch key removal; new input remains Gap', async () => {
  const f = createFixture(); let available = true;
  const originalLookup = f.context.lookupWorldRelayKey;
  const kernel = reducer(f, { ...f.context, lookupWorldRelayKey: async descriptor => available ? originalLookup(descriptor) : null });
  const a = f.makeAdmitted(f.reveal());
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  available = false;
  const retry = await kernel.replay(request(f, [clone(a)], { parentCheckpoint: first.checkpoint }));
  assert.equal(retry.kind, 'Replayed'); assert.equal(retry.coverage.length, 1); assert.equal(retry.provisionalCoverage.length, 0);
  const b = f.makeAdmitted(f.touch(), { seq: 2, appendedAt: f.baseTime + 1 });
  assert.equal((await kernel.replay(request(f, [b], { parentCheckpoint: first.checkpoint }))).kind, 'Gap');
  const tampered = clone(a); tampered.admissionReceipt.signatureBase64Url = 'AA'.repeat(43).slice(0, 86);
  assert.equal((await kernel.replay(request(f, [tampered], { parentCheckpoint: first.checkpoint }))).kind, 'Gap');
});

test('R29 stable IDs remain globally reserved across entity, trigger, trace touch and map, including tombstones', async () => {
  const f = createFixture();
  const commits = [f.ids.entityB, f.ids.traceTouch, f.ids.map].map((id, index) => {
    const trigger = clone(f.trigger); trigger.triggerId = id;
    return f.makeAdmitted(f.mapEdit({ operation: 'CreateTrigger', target: { kind: 'Trigger', triggerId: id }, definition: trigger }), { seq: index + 1 });
  });
  const def = clone(f.approvedNewDefinition); def.entityId = f.ids.trigger;
  const approve = f.context.isEntityDefinitionApproved;
  const context = { ...f.context, isEntityDefinitionApproved: value => value.entityId === f.ids.trigger || approve(value) };
  commits.push(f.makeAdmitted(f.mapEdit({ operation: 'CreateEntity', target: { kind: 'Entity', entityId: f.ids.trigger }, definition: def }), { seq: 4 }));
  const out = await settled(f, commits, {}, reducer(f, context)); assert.equal(out.kind, 'Replayed');
  assert(out.coverage.every(entry => entry.applyResult === 'NoEffect' && entry.finalDiagnostic === 'MergeConflict'));
  assert.deepEqual(clone(out.state), f.genesis.initialState);
});

test('R30 independent closure projects in an empty tail without backdating an earlier checkpoint', async () => {
  const f = createFixture();
  const closure = f.signReceipt('WorldDeveloperClosure', { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId,
    worldId: f.ids.world, worldDeveloperAccountId: f.actors.developer.accountId,
    effectiveAtServerEpochMs: f.baseTime + 1, accountFactRevision: 1 });
  const a = f.makeAdmitted(f.reveal());
  const out = await settled(f, [a], { developerClosure: closure }); assert.equal(out.kind, 'Replayed');
  assert.equal(out.checkpoint.state.developerRoster.frozen, false); assert.equal(out.checkpoint.developerClosure, null);
  assert.equal(out.state.developerRoster.frozen, true);
  const bare = await reducer(f).replay(request(f, [], { developerClosure: closure })); assert.equal(bare.kind, 'Replayed');
  assert.equal(bare.checkpoint, null); assert.equal(bare.state.developerRoster.frozen, true);
});

test('R31 locally observed signed allocation conflicts remain detectable across trusted checkpoint advances', async () => {
  const f = createFixture(); const kernel = reducer(f);
  const a = f.makeAdmitted(f.touch(), { actor: 'observer', seq: 1 });
  const first = await settled(f, [a], {}, kernel); assert.equal(first.kind, 'Replayed');
  const b = f.makeAdmitted(f.touch(), { actor: 'observerDevice2', seq: 2, appendedAt: f.baseTime + 1 });
  const out = await kernel.replay(request(f, [b], { parentCheckpoint: first.checkpoint }));
  assert.deepEqual(out, { kind: 'Gap', reason: 'SequenceSegmentOverlap' });
  const c = f.makeAdmitted(f.touch(), { actor: 'observer', seq: 3, appendedAt: f.baseTime + 1 });
  const valid = await kernel.replay(request(f, [c], { parentCheckpoint: first.checkpoint }));
  assert.equal(valid.kind, 'Replayed'); assert.equal(valid.provisionalCoverage[0].applyResult, 'Applied');
});
