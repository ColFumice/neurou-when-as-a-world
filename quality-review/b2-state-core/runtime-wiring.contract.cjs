'use strict';
// Actual composition-root persistence methods with an inert Creator module seam.
// This checks transactional wiring, never engine rendering or Cocos acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true,
    experimentalDecorators: true },
}).outputText, filename);
const load = name => require(path.join(root, name));
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { DirectorSession } = load('src/director/IntentPort.ts');
const { LedgerHydration } = load('src/director/LedgerHydration.ts');
const { WorldStateCodec } = load('src/director/WorldStateCodec.ts');
const { validatePuzzleProgressSnapshot } = load('src/director/PuzzleHydration.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const { PuzzleChain } = load('src/trace/PuzzleChain.ts');
const { DeepTrace } = load('src/trace/DeepTrace.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
function loadRoot() {
  const filename = path.join(root, 'assets/scripts/SceneBuilder.ts');
  const loaded = new Module(filename, module); loaded.filename = filename;
  const inert = new Proxy({}, { get: () => class {} });
  loaded.require = request => {
    if (request === 'cc') { return { Component: class {}, Camera: { ClearFlag: { SOLID_COLOR: 1, DEPTH_ONLY: 2 } },
      _decorator: { ccclass: () => value => value, property: () => () => {} } }; }
    if (request.includes('/presentation/') || ['Bootstrap', 'WorldFolderBuilder'].some(value => request.endsWith('/' + value))) {
      return inert;
    }
    return require(path.resolve(path.dirname(filename), request));
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  } }).outputText, filename);
  return loaded.exports.SceneBuilder;
}
const SceneBuilder = loadRoot();
const content = parseWorldNarrativeContent(JSON.parse(fs.readFileSync(path.join(root,
  'assets/resources/world/primary-rain-dialogue.json'), 'utf8')));
const layout = createDefaultKeyboardPadLayout();
const regular = parseGuidanceChart(JSON.parse(fs.readFileSync(path.join(root,
  'assets/resources/chart/guidance_c.json'), 'utf8')), layout);
const context = { accountId: 'wiring-contract', worldId: 'wiring-primary', worldKind: 'Primary',
  protagonistCharacterId: content.protagonistCharacterId };
const clone = raw => JSON.parse(JSON.stringify(raw));
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
async function fixture() {
  const memory = new Map(), writes = []; let failure = false;
  const hydration = new LedgerHydration(context, content);
  const validator = (raw, accountId, worldId) => {
    let events = [];
    return new WorldStateCodec({ Ledger: raw => {
      const ledger = hydration.validate(raw); events = ledger.characters[0].events; return ledger;
    }, PuzzleProgress: value => validatePuzzleProgressSnapshot(value, accountId, worldId,
      'T6_MAIN_CHAIN', 'T6_MAIN_DEEP_TRACE', regular.chartId, events) }).parse(raw, accountId, worldId);
  };
  const storage = new WorldCoreStateStorage({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => {
    if (failure) { failure = false; throw new Error('controlled wiring save failure'); }
    memory.set(key, value); writes.push(JSON.parse(value));
  } }, { request: (_name, operation) => operation() }, validator);
  const lease = await storage.acquireWorldLease(context.accountId, context.worldId);
  const scene = Object.create(SceneBuilder.prototype);
  scene.worldIdentity = { ...context, coreStorage: storage, lease }; scene.coreSnapshot = null;
  scene.regularChartId = regular.chartId; scene.chainId = 'T6_MAIN_CHAIN'; scene.deepTraceId = 'T6_MAIN_DEEP_TRACE';
  scene.coreView = null; scene.revealSequence = { getTerminalPhase: () => scene.phase }; scene.phase = 'Idle';
  const session = DirectorSession.createWithProtagonist({ lateral: 0, depth: 0 }, { lateral: 0, depth: 0 });
  const progress = new PuzzleProgress(); const chain = new PuzzleChain(progress, 1000);
  const deep = new DeepTrace({ lateral: 0, depth: 0 }); const premiere = new ChartPremiere(regular, layout);
  session.bindPuzzleChain(chain); session.bindDeepTrace(deep); session.bindChartPremiere(premiere);
  let projection = null, strike = null, beat = -1, mediaTime = -1, ended = false;
  session.bindScreenProjectionProbe(() => projection);
  session.bindRhythmStrikeProbe(() => { const value = strike; strike = null; return value; });
  session.bindBeatClockProbe(() => beat); session.bindChartClockProbe(() => mediaTime);
  session.bindChartMediaProbe(() => ({ ended, unavailable: false }));
  scene.graph = { session }; scene.puzzleChain = chain;
  const world = new WorldClearSession(context, content, session, { now: () => 1791600000000,
    readRecords: () => [], commitRecord: async () => { throw new Error('must not commit'); },
    persistLedger: ledger => scene.persistLedger(ledger) });
  scene.worldClearSession = world;
  session.bindLedgerSource({ append: value => world.appendLegacyEvent(value), traverse: () => world.getLedgerEvents(),
    findById: id => world.getLedgerEvents().find(value => value.eventId === id) ?? null });
  return { scene, session, world, chain, deep, premiere, storage, lease, memory, writes,
    failOnce() { failure = true; },
    approach() { projection = { x: 0.5, y: 0.5 }; session.submitFrameIntents([], 0); },
    hit(time) { beat = time; strike = { strikeTimeMs: time, targetBeatTimeMs: time };
      session.submitFrameIntents([{ kind: 'Strike' }], 0); },
    expire(time) { beat = time; session.submitFrameIntents([], 0); },
    playRegular(time, mediaEnded) { mediaTime = time; ended = mediaEnded; session.submitFrameIntents([], 0); },
  };
}
(async () => {
  await test('genuine first activation publishes one durable empty Ledger and stable Puzzle baseline before gameplay', async () => {
    const f = await fixture(); f.scene.saveStableCore();
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].revision, 0);
    assert.equal(f.writes[0].sections.Ledger.characters[0].events.length, 0);
    assert.equal(f.writes[0].sections.PuzzleProgress[0].chain.stage, 'Step1');
    assert.equal(f.writes[0].sections.FormatTime, null); f.lease.release();
  });
  await test('unchanged stable frames do not repeatedly save or revise the checkpoint', async () => {
    const f = await fixture(); f.scene.saveStableCore(); const before = f.scene.coreSnapshot;
    f.scene.saveStableCore(); f.scene.saveStableCore();
    assert.equal(f.writes.length, 1); assert.equal(f.scene.coreSnapshot, before); f.lease.release();
  });
  await test('narrative choice root wiring persists same authoritative Ledger before publishing crossing and retains stable Puzzle', async () => {
    const f = await fixture(); f.scene.saveStableCore();
    f.world.submitFrameIntents([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }], 0);
    assert.equal(f.writes.length, 2); assert.equal(f.writes[1].revision, 1);
    assert.equal(f.writes[1].sections.Ledger.control.sphereCrossed, true);
    assert.deepEqual(f.writes[1].sections.PuzzleProgress, f.writes[0].sections.PuzzleProgress);
    assert.deepEqual(f.scene.coreSnapshot.sections.Ledger, f.world.getLedgerSnapshot()); f.lease.release();
  });
  await test('root append write failure retains persistent document, in-memory core and domain Ledger before retry', async () => {
    const f = await fixture(); f.scene.saveStableCore(); const before = clone(f.scene.coreSnapshot);
    const rawBefore = [...f.memory.values()][0]; f.failOnce();
    assert.throws(() => f.world.submitFrameIntents([{ kind: 'ChooseWorldNarrative',
      choiceId: content.interaction.choices[0].choiceId }], 0), /controlled wiring save failure/);
    assert.deepEqual(f.scene.coreSnapshot, before); assert.equal([...f.memory.values()][0], rawBefore);
    assert.equal(f.world.getLedgerEvents().length, 0); assert.equal(f.writes.length, 1); f.lease.release();
  });
  await test('active seven-second timing remains UnsupportedBoundary without resetting timer or saving a fabricated stable phase', async () => {
    const f = await fixture(); f.scene.saveStableCore(); f.approach(); f.hit(1000);
    const elapsed = f.chain.getSustainedElapsedMs(); f.scene.saveStableCore();
    assert.equal(f.writes.length, 1); assert.match(f.scene.coreBoundary, /UnsupportedBoundary/);
    assert.equal(f.chain.getSustainedElapsedMs(), elapsed); f.lease.release();
  });
  await test('real T6 endpoint append durably records Ledger with Puzzle=null before endpoint/deep/reveal publication', async () => {
    const f = await fixture(); f.scene.saveStableCore(); f.approach();
    for (let time = 1000; time <= 7000; time += 1000) { f.hit(time); }
    f.expire(8000);
    assert.equal(f.writes.length, 2); assert.equal(f.writes[1].sections.PuzzleProgress, null);
    assert.equal(f.writes[1].sections.Ledger.characters[0].events[0].eventId, 'T6_ENDPOINT_PLACEHOLDER');
    assert.equal(f.deep.isTriggered(), true); f.scene.saveStableCore();
    assert.equal(f.writes.length, 2); assert.match(f.scene.coreBoundary, /UnsupportedBoundary/); f.lease.release();
  });
  await test('failed real T6 endpoint save keeps prior checkpoint, untriggered deep trace and no event; later retry writes original ID once', async () => {
    const f = await fixture(); f.scene.saveStableCore(); f.approach();
    for (let time = 1000; time <= 7000; time += 1000) { f.hit(time); }
    const prior = clone(f.scene.coreSnapshot), rawPrior = [...f.memory.values()][0]; f.failOnce();
    assert.throws(() => f.expire(8000), /controlled wiring save failure/);
    assert.equal(f.chain.getProgress().getStage(), 'Completed'); assert.equal(f.deep.isTriggered(), false);
    assert.equal(f.world.getLedgerEvents().length, 0); assert.deepEqual(f.scene.coreSnapshot, prior);
    assert.equal([...f.memory.values()][0], rawPrior);
    f.session.submitFrameIntents([], 0);
    assert.equal(f.world.getLedgerEvents().length, 1); assert.equal(f.deep.isTriggered(), true);
    assert.equal(f.world.getLedgerEvents()[0].eventId, 'T6_ENDPOINT_PLACEHOLDER');
    assert.equal(f.writes.length, 2); f.lease.release();
  });
  await test('real T7 completion is durably null-Puzzle intermediate then one stable completed checkpoint with both original IDs', async () => {
    const f = await fixture(); f.scene.saveStableCore(); f.approach();
    for (let time = 1000; time <= 7000; time += 1000) { f.hit(time); }
    f.expire(8000); f.scene.phase = 'Finished';
    f.session.submitFrameIntents([{ kind: 'EnterChart' }], 0);
    f.playRegular(0, false); f.playRegular(100000, true);
    assert.equal(f.writes.length, 3); assert.equal(f.writes[2].sections.PuzzleProgress, null);
    assert.deepEqual(f.writes[2].sections.Ledger.characters[0].events.map(value => value.eventId),
      ['T6_ENDPOINT_PLACEHOLDER', 'T7_COMPLETION_PLACEHOLDER']);
    assert.equal(f.session.isWorldMotionGated(), false);
    f.scene.saveStableCore(); assert.equal(f.writes.length, 4);
    assert.equal(f.writes[3].sections.PuzzleProgress[0].control.chartCompletionRecorded, true);
    assert.equal(f.writes[3].sections.PuzzleProgress[0].chain.stage, 'Completed');
    f.scene.saveStableCore(); assert.equal(f.writes.length, 4); f.lease.release();
  });
  await test('failed stable checkpoint after durable T7 completion retains null boundary and retries without re-appending T6/T7', async () => {
    const f = await fixture(); f.scene.saveStableCore(); f.approach();
    for (let time = 1000; time <= 7000; time += 1000) { f.hit(time); }
    f.expire(8000); f.scene.phase = 'Finished';
    f.session.submitFrameIntents([{ kind: 'EnterChart' }], 0);
    f.playRegular(0, false); f.playRegular(100000, true);
    const prior = clone(f.scene.coreSnapshot), rawPrior = [...f.memory.values()][0]; f.failOnce();
    assert.throws(() => f.scene.saveStableCore(), /controlled wiring save failure/);
    assert.deepEqual(f.scene.coreSnapshot, prior); assert.equal([...f.memory.values()][0], rawPrior);
    assert.equal(f.scene.coreSnapshot.sections.PuzzleProgress, null);
    f.scene.saveStableCore();
    assert.equal(f.writes.length, 4); assert.equal(f.scene.coreSnapshot.sections.PuzzleProgress[0].chain.stage, 'Completed');
    assert.equal(f.world.getLedgerEvents().length, 2); f.lease.release();
  });
  const report = { category: 'ContractTest', note: 'Actual SceneBuilder persistence methods with inert Creator imports, real domain/codec/storage and controlled media. Does not establish Cocos rendering or production acceptance.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'runtime-wiring.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'runtime-wiring.contract-results.json'), JSON.stringify({ category: 'ContractTest',
    passed: results.length, failed: 1, results, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
