'use strict';
// Isolated aggregation/codec/storage contracts; no fixture is Cocos acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = name => require(path.join(root, name));
const { WorldStateSession } = load('src/director/WorldStateSession.ts');
const { WorldStateCodec } = load('src/director/WorldStateCodec.ts');
const { LedgerHydration } = load('src/director/LedgerHydration.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { validatePuzzleProgressSnapshot } = load('src/director/PuzzleHydration.ts');
const { PuzzleChain } = load('src/trace/PuzzleChain.ts');
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const content = parseWorldNarrativeContent(JSON.parse(fs.readFileSync(path.join(root,
  'assets/resources/world/primary-rain-dialogue.json'), 'utf8')));
const regular = JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/chart/guidance_c.json'), 'utf8'));
const context = { accountId: 'aggregation-contract', worldId: 'aggregation-primary', worldKind: 'Primary',
  protagonistCharacterId: content.protagonistCharacterId };
const now = 1791600000000;
const clone = value => JSON.parse(JSON.stringify(value));
const legacy = { submitFrameIntents() {}, getCurrentPerceptionMode() { return 'Normal'; },
  getChartPlaybackState() { return 'Ready'; }, isWorldMotionGated() { return false; } };
const ledger = new WorldClearSession(context, content, legacy, { readRecords: () => [],
  commitRecord: async () => { throw new Error('contract must not commit'); }, now: () => now }).getLedgerSnapshot();
const puzzle = { schemaVersion: 1, accountId: context.accountId, worldId: context.worldId,
  chainId: 'T6_MAIN_CHAIN', deepTraceId: 'T6_MAIN_DEEP_TRACE', ruleVersion: 1, chartId: regular.chartId,
  chain: new PuzzleChain(new PuzzleProgress(), 1000).capturePrivateState(),
  control: { currentPerceptionMode: 'Normal', beatClockOffsetMs: 0, endpointSettled: false,
    deepTraceTriggered: false, chartCompletionRecorded: false, revealPhase: 'Idle',
    chartEntryScheduled: false, worldMotionGated: false } };
function core() { return { schemaVersion: 1, accountId: context.accountId, worldId: context.worldId,
  worldKind: 'Primary', shoreOrigin: null, revision: 0, capturedAt: now, kind: 'Core',
  sections: { Ledger: clone(ledger), PuzzleProgress: [clone(puzzle)], FormatTime: { epochMs: now - 1000 } } }; }
function validate(raw, accountId = context.accountId, worldId = context.worldId) {
  let events = [];
  const hydration = new LedgerHydration({ ...context, accountId, worldId }, content);
  return new WorldStateCodec({
    Ledger: value => { const snapshot = hydration.validate(value);
      events = snapshot.characters.find(value => value.characterId === context.protagonistCharacterId).events;
      return snapshot; },
    PuzzleProgress: value => validatePuzzleProgressSnapshot(value, accountId, worldId,
      puzzle.chainId, puzzle.deepTraceId, regular.chartId, events),
  }).parse(raw, accountId, worldId);
}
function issue(result, section, reason) { return result.issues.some(value => value.section === section && value.reason === reason); }
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }

(async () => {
  await test('ownership exposes exactly three implemented sections, four unfinished sections, and frozen no-fork contract', () => {
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    assert.equal(session.worldForkAvailability, 'NotImplemented');
    assert.deepEqual(Object.entries(session.ownership).filter(([, value]) => value.codec === 'Implemented').map(([name]) => name),
      ['Ledger', 'PuzzleProgress', 'FormatTime']);
    assert.deepEqual(Object.entries(session.ownership).filter(([, value]) => value.codec === 'NotImplemented').map(([name]) => name),
      ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']);
    assert(Object.isFrozen(session.ownership));
    assert(Object.isFrozen(session.ownership.Ledger.indexes));
  });
  await test('unbound source retains B2b unknown identity/revision, empty parts and ten diagnostics', () => {
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    assert.equal(session.getLastCaptureResult(), null);
    const result = session.captureWorldState();
    assert.equal(result.kind, 'Incomplete'); assert.deepEqual(result.capturedParts, {});
    assert.equal(result.candidate.worldKind, 'Unavailable'); assert.equal(result.candidate.revision, 'Unavailable');
    assert.equal(result.issues.length, 10); assert.equal(session.getLastCaptureResult(), result);
    assert(issue(result, 'PuzzleProgress', 'ProjectionUndefined'));
  });
  await test('strict bound three-part core aggregates real parts while remaining Incomplete with four explicit missing mechanisms', () => {
    let calls = 0;
    const snapshot = validate(core());
    const session = new WorldStateSession(context.accountId, context.worldId, () => now + 1);
    session.bindCoreSource(() => { calls++; return snapshot; });
    const result = session.captureWorldState();
    assert.equal(calls, 1); assert.equal(result.kind, 'Incomplete');
    assert.equal(result.candidate.worldKind, 'Primary'); assert.equal(result.candidate.shoreOrigin, null);
    assert.equal(result.candidate.revision, 0); assert.equal(result.candidate.capturedAt, now + 1);
    assert.deepEqual(Object.keys(result.capturedParts), ['Ledger', 'PuzzleProgress', 'FormatTime']);
    assert.deepEqual(result.capturedParts.Ledger, ledger);
    assert.deepEqual(result.issues.map(value => value.section), ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']);
    assert(Object.isFrozen(result)); assert(Object.isFrozen(result.capturedParts));
  });
  await test('bound codec clones and freezes nested input before aggregation; later raw mutation cannot edit capture', () => {
    const raw = core(); const parsed = validate(raw);
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => parsed); const result = session.captureWorldState();
    raw.sections.FormatTime.epochMs = 4; raw.sections.PuzzleProgress[0].control.beatClockOffsetMs = 99;
    raw.sections.Ledger.characters[0].events.push({});
    assert.equal(result.capturedParts.FormatTime.epochMs, now - 1000);
    assert.equal(result.capturedParts.PuzzleProgress[0].control.beatClockOffsetMs, 0);
    assert.equal(result.capturedParts.Ledger.characters[0].events.length, 0);
    assert(Object.isFrozen(result.capturedParts.Ledger.characters[0].events));
    assert(Object.isFrozen(result.capturedParts.PuzzleProgress[0].control));
  });
  await test('complete restore remains Rejected for a valid header and never reads core source or changes last capture', () => {
    let calls = 0; const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => { calls++; return validate(core()); });
    const before = session.captureWorldState(); const callCount = calls;
    const result = session.restoreWorldState(core());
    assert.equal(result.kind, 'Rejected'); assert.equal(result.issues.length, 1);
    assert(issue(result, 'RuntimeBoundary', 'RestoreUnsupported'));
    assert.equal(calls, callCount); assert.equal(session.getLastCaptureResult(), before);
  });
  await test('missing historical creation time stays absent with AuthorityUnavailable; capture never invents current time', () => {
    const raw = core(); raw.sections.FormatTime = null;
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => validate(raw)); const before = JSON.stringify(raw);
    const result = session.captureWorldState();
    assert.equal(Object.prototype.hasOwnProperty.call(result.capturedParts, 'FormatTime'), false);
    assert(issue(result, 'FormatTime', 'AuthorityUnavailable')); assert.equal(JSON.stringify(raw), before);
  });
  await test('intermediate durable Ledger plus null Puzzle is explicit UnsupportedBoundary and not default puzzle reconstruction', () => {
    const raw = core(); raw.sections.PuzzleProgress = null;
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => validate(raw)); const result = session.captureWorldState();
    assert(result.capturedParts.Ledger); assert(!result.capturedParts.PuzzleProgress);
    assert(issue(result, 'PuzzleProgress', 'UnsupportedBoundary')); assert.equal(result.kind, 'Incomplete');
  });
  await test('absent core source emits unavailable section/identity diagnostics without fabricating an empty payload', () => {
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => null); const result = session.captureWorldState();
    assert.deepEqual(result.capturedParts, {}); assert.equal(result.candidate.revision, 'Unavailable');
    assert(issue(result, 'Ledger', 'AuthorityUnavailable')); assert(issue(result, 'RuntimeBoundary', 'IdentityUnavailable'));
  });
  await test('corrupt bound source yields InvalidSnapshot and no parts while preserving raw stored data', () => {
    const raw = core(); raw.sections.Ledger.contentRevision = 'corrupt'; const before = JSON.stringify(raw);
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => validate(raw)); const result = session.captureWorldState();
    assert.equal(result.kind, 'Incomplete'); assert(issue(result, 'RuntimeBoundary', 'InvalidSnapshot'));
    assert.deepEqual(result.capturedParts, {}); assert.equal(JSON.stringify(raw), before);
  });
  await test('source identity mismatch does not aggregate foreign account/world parts', () => {
    const foreign = clone(validate(core())); foreign.worldId = 'foreign';
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => foreign); const result = session.captureWorldState();
    assert.deepEqual(result.capturedParts, {}); assert(issue(result, 'RuntimeBoundary', 'InvalidSnapshot'));
  });
  await test('failed capture clock leaves previous published capture untouched', () => {
    let time = now; const session = new WorldStateSession(context.accountId, context.worldId, () => time);
    session.bindCoreSource(() => validate(core())); const before = session.captureWorldState(); time = -1;
    assert.throws(() => session.captureWorldState(), /时间无效/); assert.equal(session.getLastCaptureResult(), before);
  });
  await test('strict storage reader and aggregation perform no writes; rejected save preserves previous persisted capture', async () => {
    const key = 'neurou-world-state-v1:' + encodeURIComponent(context.accountId) + ':' + encodeURIComponent(context.worldId);
    const memory = new Map([[key, JSON.stringify(validate(core()))]]); let writes = 0, fail = false;
    const adapter = new WorldCoreStateStorage({ getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => { if (fail) { throw new Error('controlled save failure'); } writes++; memory.set(key, value); } },
      { request: (_name, operation) => operation() }, validate);
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCoreSource(() => adapter.readValidatedCoreState(context.accountId, context.worldId));
    const before = session.captureWorldState(); const rawBefore = memory.get(key); assert.equal(writes, 0);
    const lease = await adapter.acquireWorldLease(context.accountId, context.worldId);
    const next = core(); next.revision = 1; next.capturedAt++; next.sections.PuzzleProgress[0].control.beatClockOffsetMs = 12;
    fail = true; assert.throws(() => adapter.saveCoreState(next, validate(core())), /controlled save failure/);
    assert.equal(memory.get(key), rawBefore); assert.equal(writes, 0);
    const after = session.captureWorldState(); assert.deepEqual(after, before); lease.release();
  });
  const report = { category: 'ContractTest', note: 'Real aggregation with strict content-bound codec and controlled storage/clock fixtures. Three-part hydration never produces a Complete WorldState or successful full restore.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'aggregation.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'aggregation.contract-results.json'), JSON.stringify({ category: 'ContractTest',
    passed: results.length, failed: 1, results, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
