'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = function(module, file) {
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  }, fileName: file }).outputText, file);
};
const load = file => require(path.join(root, file));
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const { PuzzleChain, validatePuzzleChainPrivateState } = load('src/trace/PuzzleChain.ts');
const { DeepTrace } = load('src/trace/DeepTrace.ts');
const { validatePuzzleProgressSnapshot } = load('src/director/PuzzleHydration.ts');
const { DirectorSession } = load('src/director/IntentPort.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const layout = createDefaultKeyboardPadLayout();
const chart = JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/chart/guidance_c.json'), 'utf8'));
const accountId = 'puzzle-contract-account', worldId = 'puzzle-contract-world';
const chainId = 'initial-station-chain-1', deepTraceId = 'initial-station-deep-trace-1';
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
function test(name, run) {
  try { run(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); }
}
function event(eventId, state) {
  const reference = { chartId: chart.chartId };
  if (state !== undefined) { reference.state = state; }
  return { eventId, vector: Array(20).fill(0), VectorSchemaVersion: 1,
    AppendedAt: { epochMs: 10000 }, InputSource: InputSource.Player, ChapterTag: {}, ChartRef: reference };
}
function initial(stage = 'Step1') {
  return { schemaVersion: 1, accountId, worldId, chainId, deepTraceId, ruleVersion: 1, chartId: chart.chartId,
    chain: { stage, sustainedStartMs: -1, sustainedElapsedMs: 0, lastHitBeatTimeMs: -1,
      nextBeatTimeMs: -1, beatIntervalMs: 1000, requiredSustainedMs: 7000 },
    control: { currentPerceptionMode: 'Normal', beatClockOffsetMs: 0, endpointSettled: false,
      deepTraceTriggered: false, chartCompletionRecorded: false, revealPhase: 'Idle',
      chartEntryScheduled: false, worldMotionGated: false } };
}
function validate(raw, ledger = []) {
  return validatePuzzleProgressSnapshot(raw, accountId, worldId, chainId, deepTraceId, chart.chartId, ledger);
}
function naturalCompletion() {
  const progress = new PuzzleProgress(), chain = new PuzzleChain(progress, 1000);
  chain.evaluateStepCondition(0, { x: .5, y: .5 });
  for (let index = 0; index < 7; index++) {
    const time = 10000 + index * 1000;
    chain.attemptStrike({ strikeTimeMs: time, targetBeatTimeMs: time });
    chain.checkSustainedExpiry(time);
  }
  assert.equal(chain.checkSustainedExpiry(17000), true);
  return chain.capturePrivateState();
}
function completed(withT7 = false, legacy = false) {
  const snapshot = initial('Completed'); snapshot.chain = naturalCompletion();
  Object.assign(snapshot.control, { currentPerceptionMode: 'Triggered', beatClockOffsetMs: -18,
    endpointSettled: true, deepTraceTriggered: true, chartCompletionRecorded: withT7, revealPhase: 'Finished' });
  const ledger = [event('T6_ENDPOINT_PLACEHOLDER', legacy ? undefined : 'Entry')];
  if (withT7) { ledger.push(event('T7_COMPLETION_PLACEHOLDER', legacy ? undefined : 'PremiereCompleted')); }
  return { snapshot, ledger };
}
function assemble(snapshot, ledger) {
  const validated = validate(snapshot, ledger), session = new DirectorSession();
  const progress = new PuzzleProgress(validated.chain.stage), chain = new PuzzleChain(progress, 1000, validated.chain);
  const trace = new DeepTrace({ lateral: -6, depth: 0 }, validated.control.deepTraceTriggered);
  const writes = [];
  session.bindPuzzleChain(chain); session.bindDeepTrace(trace); session.bindChartPremiere(new ChartPremiere(chart, layout));
  session.bindLedgerSource({ append: value => { writes.push(value); ledger.push(value); },
    traverse: () => ledger.slice(), findById: id => ledger.find(value => value.eventId === id) ?? null });
  return { validated, session, chain, trace, writes };
}

test('P01 untouched constructor preserves original Step1 and reset timing', () => {
  assert.deepEqual(new PuzzleChain(new PuzzleProgress()).capturePrivateState(), initial().chain);
  assert.equal(new DeepTrace({ lateral: 0, depth: 0 }).isTriggered(), false);
});
test('P02 full stable Step1/Awaiting validation and immutable snapshots', () => {
  for (const stage of ['Step1', 'AwaitingStrike']) {
    const snapshot = validate(initial(stage));
    assert.equal(snapshot.chain.stage, stage); assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.chain)); assert.ok(Object.isFrozen(snapshot.control));
  }
});
test('P03 active seven-second capture rejects without clearing original progress', () => {
  const chain = new PuzzleChain(new PuzzleProgress());
  chain.evaluateStepCondition(0, { x: .5, y: .5 });
  chain.attemptStrike({ strikeTimeMs: 1000, targetBeatTimeMs: 1000 });
  chain.checkSustainedExpiry(1500);
  assert.throws(() => chain.capturePrivateState(), /UnsupportedBoundary/);
  assert.equal(chain.getSustainedElapsedMs(), 500);
  for (let index = 2; index < 8; index++) {
    chain.attemptStrike({ strikeTimeMs: index * 1000, targetBeatTimeMs: index * 1000 });
  }
  assert.equal(chain.checkSustainedExpiry(8000), true);
});
test('P04 natural seven-second Completed timers roundtrip as dormant immutable data', () => {
  const state = naturalCompletion(), progress = new PuzzleProgress(state.stage);
  assert.deepEqual(new PuzzleChain(progress, 1000, state).capturePrivateState(), state);
  const { snapshot, ledger } = completed(); assert.deepEqual(validate(snapshot, ledger).chain, state);
});
test('P05 completed requires unique matching T6 fact and triggered/reveal consistency', () => {
  const { snapshot, ledger } = completed();
  assert.throws(() => validate(snapshot, []), /账本不一致/);
  assert.throws(() => validate(snapshot, [...ledger, clone(ledger[0])]), /重复事件/);
  const mismatches = [
    value => { value.control.deepTraceTriggered = false; },
    value => { value.control.endpointSettled = false; },
    value => { value.control.revealPhase = 'Idle'; },
    value => { value.chain.stage = 'AwaitingStrike'; },
  ];
  for (const change of mismatches) { const value = clone(snapshot); change(value); assert.throws(() => validate(value, ledger)); }
});
test('P06 T7 completion flag requires exact legal explicit or strict legacy Regular completion', () => {
  for (const legacy of [false, true]) {
    const { snapshot, ledger } = completed(true, legacy);
    assert.equal(validate(snapshot, ledger).control.chartCompletionRecorded, true);
    assert.throws(() => validate(snapshot, ledger.slice(0, 1)), /账本不一致/);
    const wrong = clone(ledger); wrong[1].ChartRef.state = 'Entry';
    assert.throws(() => validate(snapshot, wrong), /首演完成引用/);
  }
});
test('P07 forged known endpoint vectors/source/chart references cannot authorize hydration', () => {
  const { snapshot, ledger } = completed();
  for (const change of [
    value => { value.vector.fill(1); },
    value => { value.InputSource = InputSource.Autopilot; },
    value => { value.ChartRef.chartId = 'wrong-chart'; },
    value => { value.ChartRef.state = 'PremiereCompleted'; },
  ]) { const wrong = clone(ledger); change(wrong[0]); assert.throws(() => validate(snapshot, wrong)); }
});
test('P08 unsupported activity and foreign identities/rules fail before state creation', () => {
  const changes = [
    value => { value.accountId = 'other'; }, value => { value.worldId = 'other'; },
    value => { value.chainId = 'other'; }, value => { value.deepTraceId = 'other'; },
    value => { value.chartId = 'other'; }, value => { value.ruleVersion = 2; },
    value => { value.chain.beatIntervalMs = 500; }, value => { value.chain.requiredSustainedMs = 1; },
    value => { value.control.worldMotionGated = true; }, value => { value.control.chartEntryScheduled = true; },
    value => { value.control.revealPhase = 'Playing'; }, value => { value.chain.sustainedStartMs = 1; },
  ];
  for (const change of changes) { const value = initial(); change(value); assert.throws(() => validate(value)); }
});
test('P09 strict shape rejects getters, extra keys, NaN, inconsistent completed timing', () => {
  let reads = 0; const getter = initial();
  Object.defineProperty(getter, 'chain', { enumerable: true, get() { reads++; return initial().chain; } });
  assert.throws(() => validate(getter)); assert.equal(reads, 0);
  const extra = initial(); extra.unknown = 1; assert.throws(() => validate(extra));
  const nan = initial(); nan.control.beatClockOffsetMs = NaN; assert.throws(() => validate(nan));
  const { snapshot, ledger } = completed(); const invalid = clone(snapshot);
  invalid.chain.nextBeatTimeMs += 1; assert.throws(() => validate(invalid, ledger));
  assert.throws(() => validatePuzzleChainPrivateState({ ...initial().chain, [Symbol('extra')]: true }));
});
test('P10 hydrated endpoint retains entry and never appends T6 again on normal frames', () => {
  const { snapshot, ledger } = completed(), runtime = assemble(snapshot, ledger);
  runtime.session.hydratePuzzleControlState(runtime.validated);
  assert.deepEqual(runtime.session.getPuzzleControlState('Finished'), snapshot.control);
  runtime.session.submitFrameIntents([], 1); runtime.session.submitFrameIntents([], 1);
  assert.equal(runtime.writes.length, 0); assert.equal(ledger.length, 1);
  runtime.session.submitFrameIntents([{ kind: 'EnterChart' }], 0);
  assert.equal(runtime.session.isChartEntryScheduled(), true);
  runtime.session.submitFrameIntents([{ kind: 'ExitChart' }], 0);
  assert.equal(runtime.session.isWorldMotionGated(), false); assert.equal(runtime.writes.length, 0);
});
test('P11 hydrated completed T7 blocks replay and preserves both ledger facts without score restore', () => {
  const { snapshot, ledger } = completed(true), runtime = assemble(snapshot, ledger);
  runtime.session.hydratePuzzleControlState(runtime.validated);
  runtime.session.submitFrameIntents([{ kind: 'EnterChart' }], 0);
  assert.equal(runtime.session.isChartEntryScheduled(), false);
  assert.equal(runtime.writes.length, 0); assert.equal(ledger.length, 2);
  assert.equal(runtime.session.getBeatClockOffsetMs(), -18);
  assert.equal(runtime.session.getCurrentPerceptionMode(), 'Triggered');
});
test('P12 hydration rejects already-running/second application and mismatched seeds without mutation', () => {
  const { snapshot, ledger } = completed();
  const active = assemble(snapshot, clone(ledger)); active.session.submitFrameIntents([], 0);
  assert.throws(() => active.session.hydratePuzzleControlState(active.validated), /尚未运行/);
  const twice = assemble(snapshot, clone(ledger)); twice.session.hydratePuzzleControlState(twice.validated);
  assert.throws(() => twice.session.hydratePuzzleControlState(twice.validated), /尚未运行/);
  const mismatch = assemble(snapshot, clone(ledger)); mismatch.session.bindPuzzleChain(new PuzzleChain(new PuzzleProgress()));
  assert.throws(() => mismatch.session.hydratePuzzleControlState(mismatch.validated), /种子/);
  assert.equal(mismatch.session.getBeatClockOffsetMs(), 0); assert.equal(mismatch.session.getCurrentPerceptionMode(), 'Normal');
});
test('P13 active chart capture cannot serialize a fake idle world boundary', () => {
  const { snapshot, ledger } = completed(), runtime = assemble(snapshot, ledger);
  runtime.session.hydratePuzzleControlState(runtime.validated);
  runtime.session.submitFrameIntents([{ kind: 'EnterChart' }], 0);
  assert.throws(() => runtime.session.getPuzzleControlState('Finished'), /UnsupportedBoundary/);
});
test('P14 terminal reveal hydration suppresses playback and never submits EnterChart', () => {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'cc') { return { _decorator: { ccclass: () => value => value }, Component: class {},
      input: { on() {}, off() {} }, Input: { EventType: { MOUSE_DOWN: 'mouse' } } }; }
    return originalLoad.call(this, request, parent, isMain);
  };
  let Reveal;
  try { Reveal = load('src/presentation/DeepTraceRevealSequence.ts').DeepTraceRevealSequence; }
  finally { Module._load = originalLoad; }
  let starts = 0, submissions = 0;
  const reveal = new Reveal();
  reveal.bindSource(new DeepTrace({ lateral: 0, depth: 0 }, true));
  reveal.bindIntentPort({ submitFrameIntents() { submissions++; } });
  reveal.bindInvertRipple({ begin() { starts++; return true; }, end() {}, updateProgress() {} });
  reveal.hydrateTerminalPhase('Finished'); reveal.update(100);
  assert.equal(reveal.getTerminalPhase(), 'Finished'); assert.equal(starts, 0); assert.equal(submissions, 0);
  assert.throws(() => reveal.hydrateTerminalPhase('Finished'));
  const triggered = new Reveal(); triggered.bindSource(new DeepTrace({ lateral: 0, depth: 0 }, true));
  assert.throws(() => triggered.getTerminalPhase(), /UnsupportedBoundary/);
  assert.throws(() => triggered.hydrateTerminalPhase('Idle'));
});
const report = { schemaVersion: 1, evidenceKind: 'ContractTests', scope: 'B2.2d-1 stable PuzzleProgress capture/hydration',
  notProductionPreview: true, pass: results.every(result => result.pass), total: results.length,
  passed: results.filter(result => result.pass).length, results };
fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(path.join(__dirname, 'puzzle.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.pass ? 0 : 1;
