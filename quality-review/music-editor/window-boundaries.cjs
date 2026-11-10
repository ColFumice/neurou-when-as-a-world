// Public behavioral acceptance for the authorized 100/100/200 ms windows. No production mutation.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const ts = require('../../node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 },
}).outputText, filename);
const constants = require('../../constants/index.ts');
const { ChartPremiere } = require('../../src/chart/ChartPremiere.ts');
const { judgeTimeWindow } = require('../../src/chart/ChartScore.ts');
const { parseGuidanceChart } = require('../../src/chart/GuidanceChart.ts');
const { judgeRhythmStrike } = require('../../src/trace/RhythmStrike.ts');
const { PuzzleChain } = require('../../src/trace/PuzzleChain.ts');
const { PuzzleProgress } = require('../../src/trace/PuzzleProgress.ts');
const checks = [];
function test(name, run) {
  try { checks.push({ name, pass: true, evidence: run() ?? null }); }
  catch (error) { checks.push({ name, pass: false, error: error.stack ?? String(error) }); }
}
const layout = { layoutVersion: 'judgement-window-2026-10-10', slots: [
  { keyId: 'KeyA', padKind: 'Regular', u: 0, v: 0.4, width: 1, height: 0.4 },
] };
const tap = (id = 'tap', distance = .25) => ({ id, kind: 'Tap', pathDistance: distance });
const drag = (id = 'drag', distance = .25) => ({ id, kind: 'Drag', pathDistance: distance, keyId: 'KeyA' });
const hold = (id = 'hold', distance = .25, end = .5) => ({ id, kind: 'Hold', pathDistance: distance, endPathDistance: end, keyId: 'KeyA' });
const line = (id, nodes) => ({ id, head: { id: id + '-head', spawnTimeMs: 1000 },
  path: { kind: 'Polyline', points: [{ u: .1, v: .5 }, { u: .9, v: .5 }] }, speed: .125, nodes });
function make(lines = [line('one', [tap()])]) {
  return new ChartPremiere(parseGuidanceChart({ schemaVersion: lines.length > 1 ? 2 : 1,
    chartId: 'new-judgement-window', tier: 'Regular', layoutVersion: layout.layoutVersion,
    aspectRatio: 1, lines }, layout), layout);
}
function legacy(notes = [{ keyId: 'KeyA', timeMs: 3000 }]) {
  return new ChartPremiere({ chartId: 'new-window-legacy-t7', tier: 'Regular', layoutVersion: layout.layoutVersion, notes }, layout);
}
function edge(p, keyId, videoTimeMs, phase = 'Down') { p.submitStrike({ keyId, videoTimeMs, phase }); }
function begin(p) {
  p.begin();
  for (const item of p.getGuidanceSnapshots()) { edge(p, 'Space', 1000); edge(p, 'Space', 1000, 'Up'); }
  return p;
}
function node(p, id) {
  const found = p.getGuidanceSnapshots().flatMap(item => item.nodes).find(item => item.node.id === id);
  assert.ok(found, 'Missing node ' + id); return found;
}
function counts(p) { return { perfect: p.getPerfectCount(), good: p.getGoodCount(), miss: p.getMissCount(), resolved: p.getResolvedCount() }; }
const expectedCounts = tier => ({ perfect: +(tier === 'Perfect'), good: +(tier === 'Good'), miss: +(tier === 'Miss'), resolved: 1 });
const oldTierReference = delta => Math.abs(delta) <= 50 ? 'Perfect' : Math.abs(delta) <= 120 ? 'Good' : 'Miss';
const configuration = { rhythmStrikeWindowMs: constants.RHYTHM_STRIKE_WINDOW_MS,
  perfectWindowMs: constants.PERFECT_WINDOW_MS, goodWindowMs: constants.GOOD_WINDOW_MS,
  syncToleranceMs: constants.SYNC_TOLERANCE_MS, headWindowMs: constants.HEAD_WINDOW_MS };

test('01 exact authorized values, inclusive pure judge boundaries and sync relationship', () => {
  assert.deepEqual(configuration, { rhythmStrikeWindowMs: 100, perfectWindowMs: 100, goodWindowMs: 200, syncToleranceMs: 30, headWindowMs: 1000 });
  assert.ok(constants.SYNC_TOLERANCE_MS < constants.PERFECT_WINDOW_MS);
  assert.ok(constants.PERFECT_WINDOW_MS < constants.GOOD_WINDOW_MS);
  const samples = [];
  for (const [delta, expected] of [[-200.001, 'Miss'], [-200, 'Good'], [-100.001, 'Good'], [-100, 'Perfect'], [0, 'Perfect'], [100, 'Perfect'], [100.001, 'Good'], [200, 'Good'], [200.001, 'Miss']]) {
    assert.equal(judgeTimeWindow(3000 + delta, 3000), expected); samples.push({ deltaMs: delta, tier: expected });
  }
  return { configuration, syncMeasurementClaim: 'Only the unchanged 30 ms configuration and strict ordering are checked; this is not a new video synchronization measurement.', samples };
});

test('02 actual legacy T7 and guidance Tap accept both endpoints and miss immediately outside', () => {
  const samples = [];
  for (const flavor of ['LegacyT7', 'Guidance']) {
    for (const [delta, expected] of [[-200.001, 'Miss'], [-200, 'Good'], [-100.001, 'Good'], [-100, 'Perfect'], [100, 'Perfect'], [100.001, 'Good'], [200, 'Good'], [200.001, 'Miss']]) {
      const p = begin(flavor === 'LegacyT7' ? legacy() : make());
      edge(p, 'KeyA', 3000 + delta); p.advance(Math.max(3200.001, 3000 + delta));
      assert.deepEqual(counts(p), expectedCounts(expected));
      if (flavor === 'Guidance') { assert.equal(node(p, 'tap').tier, expected); }
      samples.push({ flavor, deltaMs: delta, counts: counts(p), score: p.getTotalScore() });
    }
  }
  return samples;
});

test('03 previously failed offsets become valid in real premieres; previous Good offsets become Perfect', () => {
  const samples = [];
  for (const flavor of ['LegacyT7', 'Guidance']) {
    for (const [delta, expected] of [[-200, 'Good'], [-150, 'Good'], [-120.001, 'Good'], [-100, 'Perfect'], [-75, 'Perfect'], [75, 'Perfect'], [100, 'Perfect'], [120.001, 'Good'], [150, 'Good'], [200, 'Good']]) {
      const p = begin(flavor === 'LegacyT7' ? legacy() : make()); edge(p, 'KeyA', 3000 + delta);
      assert.deepEqual(counts(p), expectedCounts(expected));
      assert.notEqual(oldTierReference(delta), expected);
      samples.push({ flavor, deltaMs: delta, oldTierReference: oldTierReference(delta), actualNewTier: expected, counts: counts(p) });
    }
  }
  return { priorReference: 'Explicit old numeric contract ±50 Perfect / ±120 Good; actual production executions use current new constants.', samples };
});

test('04 legacy/guidance wider Good keeps unresolved Tap open through +200 inclusive and expires once after', () => {
  const samples = [];
  for (const flavor of ['LegacyT7', 'Guidance']) {
    const factory = () => begin(flavor === 'LegacyT7' ? legacy() : make());
    const p = factory(); p.advance(3120.001); assert.equal(p.getResolvedCount(), 0);
    p.advance(3200); assert.equal(p.getResolvedCount(), 0); edge(p, 'KeyA', 3200);
    assert.deepEqual(counts(p), expectedCounts('Good'));
    const missing = factory(); missing.advance(3200); assert.equal(missing.getResolvedCount(), 0);
    missing.advance(3200.001); assert.deepEqual(counts(missing), expectedCounts('Miss'));
    missing.advance(9000); assert.deepEqual(counts(missing), expectedCounts('Miss'));
    if (flavor === 'Guidance') { assert.equal(node(missing, 'tap').resolvedAtMs, 3200); }
    const lateRecovered = factory(); lateRecovered.advance(3121); edge(lateRecovered, 'KeyA', 3150);
    assert.deepEqual(counts(lateRecovered), expectedCounts('Good'));
    samples.push({ flavor, oldDeadlineMs: 3120, newInclusiveDeadlineMs: 3200, expiryObservedAtMs: 3200.001,
      endpointAccepted: counts(p), expiredOnlyOnce: counts(missing), lateInputAt3150Ms: counts(lateRecovered) });
  }
  return samples;
});

test('05 widened overlapping windows still select nearest candidate and consume only one', () => {
  const samples = [];
  for (const flavor of ['LegacyT7', 'Guidance']) {
    const p = begin(flavor === 'LegacyT7' ? legacy([{ keyId: 'KeyA', timeMs: 3000 }, { keyId: 'KeyA', timeMs: 3300 }])
      : make([line('early', [tap('early-tap', .25)]), line('near', [tap('near-tap', .2875)])]));
    edge(p, 'KeyA', 3160); assert.equal(p.getResolvedCount(), 1); assert.equal(p.getGoodCount(), 1);
    if (flavor === 'Guidance') { assert.equal(node(p, 'near-tap').tier, 'Good'); assert.equal(node(p, 'early-tap').tier, null); }
    edge(p, 'KeyA', 3161, 'Up'); edge(p, 'KeyA', 3200);
    assert.deepEqual(counts(p), { perfect: 0, good: 2, miss: 0, resolved: 2 });
    samples.push({ flavor, inputMs: [3160, 3200], targetMs: [3000, 3300], firstSelected: 3300,
      firstDeltaMs: -140, secondDeltaMs: 200, finalCounts: counts(p) });
  }
  return samples;
});

test('06 overlap equal-distance ties retain target time then line/node identity ordering', () => {
  const samples = [];
  for (const flavor of ['LegacyT7', 'Guidance']) {
    const p = begin(flavor === 'LegacyT7' ? legacy([{ keyId: 'KeyA', timeMs: 3300 }, { keyId: 'KeyA', timeMs: 3000 }])
      : make([line('z-earlier', [tap('earlier-tap', .25)]), line('a-later', [tap('later-tap', .2875)])]));
    edge(p, 'KeyA', 3150); assert.equal(p.getResolvedCount(), 1); assert.equal(p.getGoodCount(), 1);
    if (flavor === 'Guidance') { assert.equal(node(p, 'earlier-tap').tier, 'Good'); assert.equal(node(p, 'later-tap').tier, null); }
    edge(p, 'KeyA', 3151, 'Up'); edge(p, 'KeyA', 3300);
    assert.deepEqual(counts(p), { perfect: 1, good: 1, miss: 0, resolved: 2 });
    samples.push({ flavor, equidistantInputMs: 3150, selectedEarlierTargetMs: 3000, counts: counts(p) });
  }
  const identity = begin(make([line('z-line', [tap('z-node')]), line('a-line', [tap('z-node-a'), tap('a-node')])]));
  edge(identity, 'KeyA', 3150);
  assert.equal(node(identity, 'a-node').tier, 'Good'); assert.equal(node(identity, 'z-node').tier, null);
  assert.equal(node(identity, 'z-node-a').tier, null); assert.equal(identity.getResolvedCount(), 1);
  return { targetTies: samples, sameTimeWinner: { lineId: 'a-line', nodeId: 'a-node' }, oneConsumption: true };
});

test('07 widening Tap windows preserves Drag held-at-arrival and Hold uninterrupted-span semantics', () => {
  const observations = [];
  for (const [downMs, upMs, expected] of [[2800, 3001, 'Perfect'], [3000, null, 'Perfect'], [3001, null, 'Miss'], [3150, null, 'Miss'], [2900, 3000, 'Miss']]) {
    const p = begin(make([line('drag-line', [drag()])])); edge(p, 'KeyA', downMs);
    if (upMs !== null) { edge(p, 'KeyA', upMs, 'Up'); } p.advance(4000);
    assert.equal(node(p, 'drag').tier, expected); assert.equal(node(p, 'drag').resolvedAtMs, 3000);
    observations.push({ kind: 'Drag', downMs, upMs, expected });
  }
  for (const [downMs, upMs, expected] of [[2800, 5000, 'Perfect'], [3000, 5000, 'Perfect'], [3001, 5000, 'Miss'], [3150, 5000, 'Miss'], [2900, 4999.999, 'Miss'], [2900, 5000.001, 'Perfect']]) {
    const p = begin(make([line('hold-line', [hold()])])); edge(p, 'KeyA', downMs);
    p.advance(4500); assert.equal(node(p, 'hold').tier, null); assert.equal(p.getTotalScore(), 0);
    edge(p, 'KeyA', upMs, 'Up'); p.advance(6000);
    assert.equal(node(p, 'hold').tier, expected); assert.equal(node(p, 'hold').resolvedAtMs, 5000);
    assert.equal(node(p, 'hold').disappearAtMs, 5000); assert.equal(p.getResolvedCount(), 1);
    observations.push({ kind: 'Hold', downMs, upMs, expected, finalTimeMs: 5000 });
  }
  return { noLateDownGraceAddedToDragOrHold: true, observations };
});

test('08 AC18 same real mixed-node performance at normalized transparency 0..1 keeps tiers and raises score monotonically', () => {
  const rawLines = [line('mixed', [tap('perfect-tap', .125), drag(), hold('hold', .375, .5), tap('good-tap', .625), tap('miss-tap', .7)])];
  const inputs = [
    { keyId: 'KeyA', videoTimeMs: 2075, phase: 'Down' }, { keyId: 'KeyA', videoTimeMs: 2076, phase: 'Up' },
    { keyId: 'KeyA', videoTimeMs: 2999, phase: 'Down' }, { keyId: 'KeyA', videoTimeMs: 3001, phase: 'Up' },
    { keyId: 'KeyA', videoTimeMs: 4000, phase: 'Down' }, { keyId: 'KeyA', videoTimeMs: 5000, phase: 'Up' },
    { keyId: 'KeyA', videoTimeMs: 6150, phase: 'Down' }, { keyId: 'KeyA', videoTimeMs: 6151, phase: 'Up' },
  ];
  const inputSha256 = crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const observations = []; let previousScore = -1, baselineFeedback = null;
  for (const normalized of [0, .1, .25, .5, .75, 1]) {
    const p = make(rawLines); p.setGuideTransparency(normalized * 100); begin(p);
    for (const input of inputs) { p.submitStrike(input); }
    p.advance(7000); p.advanceMediaStatus(true, false, 0);
    assert.equal(p.getState(), 'Completed'); assert.deepEqual(counts(p), { perfect: 3, good: 1, miss: 1, resolved: 5 });
    assert.equal(node(p, 'perfect-tap').tier, 'Perfect'); assert.equal(node(p, 'good-tap').tier, 'Good');
    assert.equal(node(p, 'drag').tier, 'Perfect'); assert.equal(node(p, 'hold').tier, 'Perfect'); assert.equal(node(p, 'miss-tap').tier, 'Miss');
    assert.ok(Math.abs(p.getTotalScore() - 400 * (1 + normalized)) < 1e-9, 'Only tolerate IEEE-754 rounding in the independent expected-score expression');
    assert.ok(p.getTotalScore() >= previousScore);
    const feedback = p.getJudgeFeedbackSince(0); if (baselineFeedback !== null) { assert.deepEqual(feedback, baselineFeedback); } else { baselineFeedback = feedback; }
    previousScore = p.getTotalScore(); observations.push({ normalizedTransparency: normalized,
      actualGuideTransparencyPercent: p.getGuideTransparency(), inputSha256, counts: counts(p), result: p.getResult() });
  }
  return { conversion: 'GuideTransparency API remains percent 0..100; normalized user range 0..1 maps to percent by ×100.',
    identicalInputAndFeedback: true, inputs, inputSha256, observations };
});

test('09 T6 pure inclusive ±100 endpoints, immediate outside rejection and newly admitted ±75 region', () => {
  const samples = [];
  for (const [delta, expected] of [[-100.001, false], [-100, true], [-75, true], [0, true], [75, true], [100, true], [100.001, false]]) {
    assert.equal(judgeRhythmStrike(1000 + delta, 1000), expected);
    samples.push({ deltaMs: delta, newHit: expected, oldReferenceHit: Math.abs(delta) <= 50 });
  }
  return samples;
});

function sustainedChain() {
  const chain = new PuzzleChain(new PuzzleProgress()); assert.equal(chain.getRequiredSustainedMs(), 7000);
  assert.equal(chain.evaluateStepCondition(0, { x: .5, y: .5 }), true);
  for (let beat = 0; beat <= 6000; beat += 1000) {
    chain.attemptStrike({ strikeTimeMs: beat + 75, targetBeatTimeMs: beat });
    assert.equal(chain.checkSustainedExpiry(beat + 75), false);
    assert.equal(chain.getProgress().getStage(), 'AwaitingStrike');
  }
  return chain;
}

test('10 T6 final target before seven-second end remains mandatory; +100 endpoint may complete after end', () => {
  const chain = sustainedChain(); assert.equal(chain.checkSustainedExpiry(7075), false);
  assert.equal(chain.getProgress().getStage(), 'AwaitingStrike'); assert.equal(chain.checkSustainedExpiry(7100), false);
  chain.attemptStrike({ strikeTimeMs: 7100, targetBeatTimeMs: 7000 });
  assert.equal(chain.checkSustainedExpiry(7100), true); assert.equal(chain.getProgress().getStage(), 'Completed');
  return { firstHitMs: 75, sevenSecondEndMs: 7075, mandatoryLastTargetMs: 7000,
    finalInclusiveHitMs: 7100, completedAtMs: 7100, noPrematureCompletionAtMs: [7075, 7100] };
});

test('11 T6 missed last beat resets only strictly after +100; late input cannot salvage it and a fresh run starts', () => {
  const chain = sustainedChain(); assert.equal(chain.checkSustainedExpiry(7100), false);
  assert.ok(chain.getSustainedElapsedMs() > 7000);
  assert.equal(chain.checkSustainedExpiry(7100.001), false); assert.equal(chain.getSustainedElapsedMs(), 0);
  chain.attemptStrike({ strikeTimeMs: 7100.001, targetBeatTimeMs: 7000 });
  assert.equal(chain.getSustainedElapsedMs(), 0); assert.equal(chain.getProgress().getStage(), 'AwaitingStrike');
  chain.attemptStrike({ strikeTimeMs: 8000, targetBeatTimeMs: 8000 });
  assert.equal(chain.getSustainedElapsedMs(), 0); assert.equal(chain.checkSustainedExpiry(8500), false); assert.equal(chain.getSustainedElapsedMs(), 500);
  return { inclusiveWindowEndMs: 7100, missedBeatResetAtMs: 7100.001, lateInputRepairs: false, freshRunStartMs: 8000 };
});

test('12 T6 earlier missed beats and leaving the valid region still reset; duplicate targets cannot extend the run', () => {
  const chain = new PuzzleChain(new PuzzleProgress()); chain.evaluateStepCondition(0, { x: .5, y: .5 });
  chain.attemptStrike({ strikeTimeMs: 75, targetBeatTimeMs: 0 });
  chain.checkSustainedExpiry(1100); assert.equal(chain.getSustainedElapsedMs(), 1025);
  chain.checkSustainedExpiry(1100.001); assert.equal(chain.getSustainedElapsedMs(), 0);
  chain.attemptStrike({ strikeTimeMs: 2000, targetBeatTimeMs: 2000 });
  chain.attemptStrike({ strikeTimeMs: 2075, targetBeatTimeMs: 2000 }); assert.equal(chain.getSustainedElapsedMs(), 0);
  assert.equal(chain.checkSustainedExpiry(2100), false); assert.equal(chain.getSustainedElapsedMs(), 100);
  assert.equal(chain.evaluateStepCondition(3, { x: .5, y: .5 }), false); assert.equal(chain.getProgress().getStage(), 'Step1');
  assert.equal(chain.getSustainedElapsedMs(), 0);
  return { missedNextTargetMs: 1000, resetStrictlyAfterMs: 1100, duplicateTargetIgnored: true, leavingRegionResets: true };
});

const report = { task: 'Authorized numerical-window widening', command: 'node quality-review/judgement-window-2026-10-10/window-boundaries.cjs',
  configuration, scope: 'Real public pure-logic ChartPremiere/PuzzleChain execution; no cc mocks here, no media-rendering or new video-sync measurements claimed.',
  passed: checks.filter(check => check.pass).length, failed: checks.filter(check => !check.pass).length, checks };
fs.writeFileSync(path.join(__dirname, 'window-boundaries-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); process.exitCode = report.failed ? 1 : 0;
