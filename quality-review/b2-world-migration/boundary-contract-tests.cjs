'use strict';
// ContractAdapter boundary verification exercises real Director/ChartPremiere/clear settlement.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('../b2-cross-device-core/contract-test-helpers.cjs');
const { load, clone, content, regular, worldSource, epochMs } = h;
const { RealityPauseBoundary } = load('src/director/RealityPauseBoundary.ts');
const { DirectorSession } = load('src/director/IntentPort.ts');
const { PuzzleChain } = load('src/trace/PuzzleChain.ts');
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const { DeepTrace } = load('src/trace/DeepTrace.ts');
const { Protagonist } = load('src/character/Protagonist.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const boundary = new RealityPauseBoundary();
function regularWorld() {
  const layout = createDefaultKeyboardPadLayout(), chart = parseGuidanceChart(regular, layout);
  const director = new DirectorSession(), premiere = new ChartPremiere(chart, layout), trace = new DeepTrace({ lateral: 0, depth: 0 });
  const progress = new PuzzleProgress(), chain = new PuzzleChain(progress), clock = { beat: 0, media: -1, ended: false, rhythm: null };
  director.bindProtagonist(new Protagonist({ lateral: 0, depth: 0 })); director.bindMapCenter({ lateral: 0, depth: 0 });
  director.bindPuzzleChain(chain); director.bindDeepTrace(trace); director.bindChartPremiere(premiere);
  director.bindScreenProjectionProbe(() => ({ x: .5, y: .5 })); director.bindRhythmStrikeProbe(() => clock.rhythm);
  director.bindBeatClockProbe(() => clock.beat); director.bindChartClockProbe(() => clock.media);
  director.bindChartMediaProbe(() => ({ ended: clock.ended, unavailable: false }));
  const frame = (intents = []) => director.submitFrameIntents(intents, 1 / 60);
  const trigger = () => { frame(); for (let beat = 0; beat < 7000; beat += 1000) {
    clock.beat = beat; clock.rhythm = { strikeTimeMs: beat, targetBeatTimeMs: beat }; frame([{ kind: 'Strike', videoTimeMs: beat }]);
  } clock.rhythm = null; clock.beat = 7000; frame(); assert(trace.isTriggered()); assert(director.isWorldMotionGated()); };
  return { director, premiere, trace, progress, chain, clock, frame, trigger };
}
const cases = [];
async function test(name, body) {
  try { await body(); cases.push({ name, category: 'ContractAdapter', result: 'PASS' }); }
  catch (error) { cases.push({ name, category: 'ContractAdapter', result: 'FAIL', error: String(error), stack: error.stack }); }
}
async function run() {
  await test('B01 healthy admission returns original intent batch and preserves source data', () => {
    const intents = Object.freeze([{ kind: 'Move', lateral: 1, depth: 0 }, { kind: 'Jump' }, { kind: 'EnterWorldChart' }]);
    assert.equal(boundary.filter(intents, false, false, false), intents);
    assert.deepEqual(intents, [{ kind: 'Move', lateral: 1, depth: 0 }, { kind: 'Jump' }, { kind: 'EnterWorldChart' }]);
  });
  await test('B02 idle paused account admits settlement retry and rejects new narrative/chart/world activities', () => {
    const intents = [{ kind: 'ChooseWorldNarrative', choiceId: 'rain-choice' }, { kind: 'EnterWorldChart' }, { kind: 'EnterChart' },
      { kind: 'Move', lateral: 1, depth: 0 }, { kind: 'Jump' }, { kind: 'SwitchPerceptionMode', mode: 'Triggered' },
      { kind: 'Strike', videoTimeMs: 0 }, { kind: 'ToggleChartPause', videoTimeMs: 0 }, { kind: 'ExitChart' },
      { kind: 'RecallEvent', eventId: 'x' }, { kind: 'ReplayTrace', traceId: 'x' }, { kind: 'ReplayChart', completionEventId: 'x' }, { kind: 'RetryWorldClear' }];
    const before = clone(intents), accepted = boundary.filter(intents, true, false, false);
    assert.deepEqual(accepted, [{ kind: 'RetryWorldClear' }]); assert.deepEqual(intents, before);
  });
  await test('B03 active chart retains ordered strike/pause/exit inputs, preserves payload and rejects new entries', () => {
    const strike = { kind: 'Strike', keyId: 'Space', videoTimeMs: 1300, phase: 'Up' }, toggle = { kind: 'ToggleChartPause', videoTimeMs: 1300 };
    const inputs = [{ kind: 'EnterWorldChart' }, strike, toggle, { kind: 'Jump' }, { kind: 'ExitChart' }, { kind: 'RetryWorldClear' }];
    const accepted = boundary.filter(inputs, true, true, false);
    assert.deepEqual(accepted, [strike, toggle, { kind: 'ExitChart' }, { kind: 'RetryWorldClear' }]); assert.equal(accepted[0], strike); assert.equal(accepted[1], toggle);
  });
  await test('B04 granted reveal continuation can enter existing T7 and naturally finish without forced timer/media mutation', () => {
    const w = regularWorld(); w.trigger(); assert.equal(w.director.isChartEntryScheduled(), false);
    const input = [{ kind: 'EnterChart' }]; assert.equal(boundary.filter(input, true, false, false).length, 0);
    // This true comes only from the composition's already triggered, finished reveal system port.
    w.clock.media = 0; w.frame(boundary.filter(input, true, false, true)); assert.equal(w.premiere.getState(), 'Playing');
    const eventBefore = w.director.getLedgerEvents()[0];
    w.clock.media = 1000; w.frame(boundary.filter([{ kind: 'ToggleChartPause', videoTimeMs: 1000 }], true, true, false));
    assert.equal(w.premiere.getState(), 'Paused');
    w.frame(boundary.filter([{ kind: 'ToggleChartPause', videoTimeMs: 1000 }], true, true, false)); assert.equal(w.premiere.getState(), 'Playing');
    w.clock.media = 120000; w.clock.ended = true; w.frame(boundary.filter([], true, true, false));
    assert.equal(w.premiere.getState(), 'Exited'); assert.equal(w.director.isWorldMotionGated(), false);
    assert.equal(w.director.getLedgerEvents().length, 2); assert.equal(w.director.getLedgerEvents()[0], eventBefore);
    assert.equal(w.premiere.getResult().completed, true);
  });
  await test('B05 active performer explicitly exits using existing chart lifecycle without fabricated completion', () => {
    const w = regularWorld(); w.trigger(); w.clock.media = 0; w.frame([{ kind: 'EnterChart' }]);
    w.frame(boundary.filter([{ kind: 'ExitChart' }, { kind: 'EnterChart' }], true, true, false));
    assert.equal(w.premiere.getState(), 'Exited'); assert.equal(w.director.getLedgerEvents().length, 1); assert(!w.director.isWorldMotionGated());
    assert.equal(w.premiere.getResult().completed, false);
  });
  await test('B06 RetryWorldClear under closed admission settles a restored real account fact without new premiere', async () => {
    const source = worldSource().state, commits = [];
    const legacy = { submitFrameIntents() {}, getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready', isWorldMotionGated: () => false };
    const world = new WorldClearSession({ accountId: source.accountId, worldId: source.worldId, worldKind: 'Primary',
      protagonistCharacterId: source.sections.Ledger.protagonistCharacterId }, content, legacy,
    { now: () => epochMs, readRecords: () => [], commitRecord: async record => { commits.push(record); } }, source.sections.Ledger);
    assert.equal(world.getWorldClearSnapshot().completionStatus, 'Failed');
    const ledgerBefore = JSON.stringify(world.getLedgerSnapshot());
    world.submitFrameIntents(boundary.filter([{ kind: 'EnterWorldChart' }, { kind: 'RetryWorldClear' }], true, false, false), 1 / 60);
    assert.equal(world.getWorldClearSnapshot().completionStatus, 'Pending');
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
    assert.equal(world.getWorldClearSnapshot().completionStatus, 'Completed'); assert.equal(commits.length, 1);
    assert.equal(JSON.stringify(world.getLedgerSnapshot()), ledgerBefore); assert.equal(commits[0].worldId, source.worldId);
  });
  await test('B07 continuation permission permits only old EnterChart, never new World chart or replay', () => {
    assert.deepEqual(boundary.filter([{ kind: 'EnterChart' }, { kind: 'EnterWorldChart' }, { kind: 'ReplayChart', completionEventId: 'x' }], true, false, true), [{ kind: 'EnterChart' }]);
  });
  await test('B08 existing seven-second sustain can finish under pause while fresh world strikes remain denied', () => {
    const w = regularWorld(); w.frame(); w.clock.rhythm = { strikeTimeMs: 0, targetBeatTimeMs: 0 };
    w.frame([{ kind: 'Strike', videoTimeMs: 0 }]); assert.throws(() => w.chain.capturePrivateState(), /活动七秒/);
    assert.deepEqual(boundary.filter([{ kind: 'Strike', videoTimeMs: 1000 }], true, false, false, false), []);
    for (let beat = 1000; beat < 7000; beat += 1000) {
      w.clock.beat = beat; w.clock.rhythm = { strikeTimeMs: beat, targetBeatTimeMs: beat };
      w.frame(boundary.filter([{ kind: 'Strike', videoTimeMs: beat }, { kind: 'Move', lateral: 1, depth: 0 }], true, false, false, true));
    }
    w.clock.rhythm = null; w.clock.beat = 7000; w.frame(); assert.equal(w.progress.getStage(), 'Completed'); assert(w.trace.isTriggered());
    assert.equal(w.director.getLedgerEvents().length, 1);
    assert.deepEqual(boundary.filter([{ kind: 'Strike', keyId: 'Space', videoTimeMs: 7000 }], true, false, false, true), [], 'a sustain continuation cannot become chart input');
  });
  const report = { mode: 'ContractAdapter', passed: cases.filter(item => item.result === 'PASS').length, failed: cases.filter(item => item.result === 'FAIL').length, cases };
  fs.writeFileSync(path.join(__dirname, 'boundary-contract-results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1; return report;
}
module.exports = { regularWorld, run };
if (require.main === module) void run().catch(error => { console.error(error); process.exitCode = 1; });
