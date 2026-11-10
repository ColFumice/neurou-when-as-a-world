// 2026-10-10 用户网格与一层邻键宽容规则的独立行为验收。
// 只写本目录；保留旧 A/B 验收作为历史证据。
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const ts = require('../../node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 },
}).outputText, filename);
const { ChartPremiere } = require('../../src/chart/ChartPremiere.ts');
const { parseGuidanceChart, positionAtPathDistance, measurePathLength } = require('../../src/chart/GuidanceChart.ts');
const { GuidanceLineRuntime } = require('../../src/chart/GuidanceLineRuntime.ts');
const { resolveGridKeyAt, createDefaultKeyboardPadLayout, getSlot, CHART_KEY_IDS, PAD_LAYOUT_VERSION, isMatchingGridKey } = require('../../src/chart/KeyboardPadLayout.ts');
const { HEAD_WINDOW_MS, PERFECT_WINDOW_MS, GOOD_WINDOW_MS } = require('../../constants/index.ts');
const { DirectorSession } = require('../../src/director/IntentPort.ts');
const { Protagonist } = require('../../src/character/Protagonist.ts');
const { DeepTrace } = require('../../src/trace/DeepTrace.ts');
const { PuzzleChain } = require('../../src/trace/PuzzleChain.ts');
const { PuzzleProgress } = require('../../src/trace/PuzzleProgress.ts');
const checks = [];
function test(name, run) {
  try { checks.push({ name, pass: true, evidence: run() ?? null }); }
  catch (error) { checks.push({ name, pass: false, error: error.stack ?? String(error) }); }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function near(actual, expected, epsilon = 1e-10) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }
const layout = { layoutVersion: 'pad-neighbor-acceptance-1', slots: Array.from({ length: 16 }, (_, index) => ({
  keyId: 'Key' + String.fromCharCode(65 + index), padKind: 'Regular',
  u: index % 4 / 4, v: Math.floor(index / 4) / 4, width: 0.25, height: 0.25,
})) };
const tap = (id = 'tap', distance = 0.25) => ({ id, kind: 'Tap', pathDistance: distance });
const drag = (id = 'drag', distance = 0.25, keyId = 'KeyF') => ({ id, kind: 'Drag', pathDistance: distance, keyId });
const hold = (id = 'hold', distance = 0.25, endPathDistance = 0.5, keyId = 'KeyF') => ({ id, kind: 'Hold', pathDistance: distance, endPathDistance, keyId });
function rawChart(nodes = [tap()], usedLayout = layout) { return {
  schemaVersion: 1, chartId: 'PAD_GRID_NEIGHBOR_ACCEPTANCE', tier: 'Regular', layoutVersion: usedLayout.layoutVersion, aspectRatio: 1,
  lines: [{ id: 'line', head: { id: 'head', spawnTimeMs: 1000 },
    path: { kind: 'Polyline', points: [{ u: 0.125, v: 0.375 }, { u: 0.875, v: 0.375 }] }, speed: 0.125, nodes }],
}; }
function make(nodesOrRaw = [tap()], usedLayout = layout) {
  const raw = Array.isArray(nodesOrRaw) ? rawChart(nodesOrRaw, usedLayout) : nodesOrRaw;
  const p = new ChartPremiere(parseGuidanceChart(raw, usedLayout), usedLayout); p.begin(); return p;
}
function snapshot(p) { const s = p.getGuidanceSnapshot(); assert.ok(s); return s; }
function node(p, id) { const item = snapshot(p).nodes.find(item => item.node.id === id); assert.ok(item, id); return item; }
function edge(p, keyId, timeMs, phase = 'Down') { p.submitStrike({ keyId, videoTimeMs: timeMs, phase }); }
function start(p, timeMs = 1000) { edge(p, 'Space', timeMs); assert.equal(snapshot(p).state, 'Running'); assert.equal(snapshot(p).startedAtMs, timeMs); }
function verdict(p, id, tier, resolvedAtMs) { const n = node(p, id); assert.equal(n.tier, tier, id); if (resolvedAtMs !== undefined) near(n.resolvedAtMs, resolvedAtMs); }
function totalCount(p) { return p.getPerfectCount() + p.getGoodCount() + p.getMissCount(); }
function directTouch(a, b) {
  const epsilon = 1e-12;
  const xOverlap = Math.min(a.u + a.width, b.u + b.width) - Math.max(a.u, b.u);
  const yOverlap = Math.min(a.v + a.height, b.v + b.height) - Math.max(a.v, b.v);
  return xOverlap >= -epsilon && yOverlap >= -epsilon && (Math.abs(xOverlap) <= epsilon || Math.abs(yOverlap) <= epsilon);
}

test('Default 47-cell four-row grid fills the full normalized screen and omits Space', () => {
  const actual = createDefaultKeyboardPadLayout(); assert.equal(actual.layoutVersion, 'pad-layout-2'); assert.equal(PAD_LAYOUT_VERSION, 'pad-layout-2');
  assert.equal(actual.slots.length, 47); assert.equal(new Set(actual.slots.map(s => s.keyId)).size, 47);
  assert.equal(getSlot(actual, 'Space'), undefined); assert.ok(CHART_KEY_IDS.includes('Space'), 'Space 保留采集/Head身份');
  assert.deepEqual(new Set(actual.slots.map(s => s.keyId)), new Set(CHART_KEY_IDS.filter(key => key !== 'Space')));
  const rows = [...new Set(actual.slots.map(s => s.v))].sort((a, b) => b - a).map(v => actual.slots.filter(s => s.v === v).sort((a, b) => a.u - b.u));
  assert.deepEqual(rows.map(r => r.length), [13, 13, 11, 10]);
  rows.forEach((row, index) => { near(row[0].u, 0); near(row[0].v, 0.75 - index / 4);
    for (let n = 0; n < row.length; n += 1) { near(row[n].width, 1 / row.length); near(row[n].height, 0.25); if (n) near(row[n - 1].u + row[n - 1].width, row[n].u); }
    near(row.at(-1).u + row.at(-1).width, 1);
  });
  near(actual.slots.reduce((area, s) => area + s.width * s.height, 0), 1);
  assert.ok(rows[2][0].width > rows[0][0].width); assert.ok(rows[3][0].width > rows[2][0].width);
  return { cells: 47, rowCounts: rows.map(r => r.length), rowWidths: rows.map(r => r[0].width), area: 1, spaceRendered: false, spaceInputAccepted: true };
});

test('Default grid has no internal gaps; every cell origin and shared edge resolves deterministically', () => {
  const actual = createDefaultKeyboardPadLayout(); let tested = 0;
  for (const slot of actual.slots) {
    assert.equal(resolveGridKeyAt(actual, { u: slot.u, v: slot.v }), slot.keyId);
    assert.equal(resolveGridKeyAt(actual, { u: slot.u + slot.width / 2, v: slot.v + slot.height / 2 }), slot.keyId);
    if (slot.u + slot.width < 1) { const next = actual.slots.find(s => s.v === slot.v && Math.abs(s.u - slot.u - slot.width) < 1e-12); assert.ok(next); assert.equal(resolveGridKeyAt(actual, { u: next.u, v: slot.v + slot.height / 2 }), next.keyId); }
    tested += 1;
  }
  for (let r = 0; r < 100; r += 1) for (let c = 0; c < 100; c += 1) assert.ok(resolveGridKeyAt(actual, { u: (c + 0.5) / 100, v: (r + 0.5) / 100 }));
  for (const position of [{ u: 1, v: 0.5 }, { u: 0.5, v: 1 }, { u: -1e-8, v: 0 }, { u: 0, v: NaN }]) assert.equal(resolveGridKeyAt(actual, position), null);
  return { cellOriginsAndCenters: tested, interiorSamplesWithoutGap: 10000, rightAndTopHalfOpen: true };
});

test('Neighbor matcher includes direct sides/corners and self, with one layer only and no Space', () => {
  const accepted = ['KeyA', 'KeyB', 'KeyC', 'KeyE', 'KeyF', 'KeyG', 'KeyI', 'KeyJ', 'KeyK'];
  const rejected = ['KeyD', 'KeyH', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'Space', 'KeyZ'];
  for (const input of accepted) assert.equal(isMatchingGridKey(layout, 'KeyF', input), true, input);
  for (const input of rejected) assert.equal(isMatchingGridKey(layout, 'KeyF', input), false, input);
  assert.equal(isMatchingGridKey(layout, 'Space', 'KeyF'), false);
  assert.equal(isMatchingGridKey(layout, 'Space', 'Space'), false);
  const withSpace = { ...layout, slots: [...layout.slots, { keyId: 'Space', padKind: 'Heavy', u: 0.25, v: 0.25, width: 0.25, height: 0.25 }] };
  assert.equal(isMatchingGridKey(withSpace, 'KeyF', 'Space'), false);
  return { target: 'KeyF', accepted, rejected, diagonalIncluded: true, transitiveNeighborsRejected: true };
});

test('Geometry defines neighbors across unequal row widths; all 2209 default pairs agree with direct-contact oracle', () => {
  const actual = createDefaultKeyboardPadLayout(); let pairs = 0, contacts = 0;
  for (const a of actual.slots) for (const b of actual.slots) {
    const expected = a.keyId === b.keyId || directTouch(a, b);
    assert.equal(isMatchingGridKey(actual, a.keyId, b.keyId), expected, `${a.keyId}/${b.keyId}`);
    assert.equal(isMatchingGridKey(actual, b.keyId, a.keyId), expected, '对称'); pairs += 1; if (expected) contacts += 1;
  }
  const corner = { layoutVersion: 'corner', slots: [
    { keyId: 'KeyA', padKind: 'Regular', u: 0, v: 0, width: 0.25, height: 0.25 },
    { keyId: 'KeyB', padKind: 'Regular', u: 0.25, v: 0.25, width: 0.25, height: 0.25 },
    { keyId: 'KeyC', padKind: 'Regular', u: 0.50001, v: 0.25, width: 0.25, height: 0.25 },
  ] };
  assert.equal(isMatchingGridKey(corner, 'KeyA', 'KeyB'), true); assert.equal(isMatchingGridKey(corner, 'KeyB', 'KeyC'), false);
  return { pairs, acceptedPairs: contacts, cornerOnlyTouchAccepted: true, smallRealGapRejected: true };
});

test('Invisible Space still exclusively starts Head within authorized 1000ms; repeated Space cannot restart', () => {
  assert.equal(HEAD_WINDOW_MS, 1000); const p = make(); edge(p, 'KeyA', 1000); assert.equal(snapshot(p).state, 'Waiting'); start(p);
  edge(p, 'Space', 1100); edge(p, 'Space', 1200, 'Up'); edge(p, 'Space', 1300); assert.equal(snapshot(p).startedAtMs, 1000);
  const end = make(); start(end, 2000); const late = make(); edge(late, 'Space', 2000.001); assert.equal(snapshot(late).state, 'TimedOut'); assert.equal(late.getMissCount(), 1);
  return { headWindowMs: HEAD_WINDOW_MS, invisibleSpaceStarts: true, endpointAcceptedMs: 2000, lateRejectedMs: 2000.001, startedAtMsStable: 1000 };
});

test('Tap accepts diagonal neighbor and rejects remote or Space keys', () => {
  const perfect = make(); start(perfect); edge(perfect, 'KeyA', 3000); verdict(perfect, 'tap', 'Perfect', 3000);
  assert.equal(perfect.getJudgeFeedbackSince(0).items[0].keyId, 'KeyF', '反馈高亮逻辑目标而非邻键');
  const remote = make(); start(remote); edge(remote, 'KeyP', 3000); verdict(remote, 'tap', null); remote.advance(3000 + GOOD_WINDOW_MS + 1); verdict(remote, 'tap', 'Miss', 3000 + GOOD_WINDOW_MS);
  const space = make(); start(space); edge(space, 'Space', 2900, 'Up'); edge(space, 'Space', 3000); verdict(space, 'tap', null); space.advance(3000 + GOOD_WINDOW_MS + 1); verdict(space, 'tap', 'Miss', 3000 + GOOD_WINDOW_MS);
  return { target: 'KeyF', diagonalKey: 'KeyA', diagonalTier: 'Perfect', feedbackKey: 'KeyF', remoteKey: 'KeyP', remoteTier: 'Miss', spaceTier: 'Miss' };
});

test('Tap resolves target at input timestamp across a grid boundary before applying neighbor tolerance', () => {
  const results = [];
  for (const [timeMs, input, required, tier] of [[3999, 'KeyE', 'KeyF', 'Perfect'], [4001, 'KeyH', 'KeyG', 'Perfect'], [3999, 'KeyH', 'KeyF', null], [4001, 'KeyE', 'KeyG', null]]) {
    const p = make([tap('boundary', 0.375)]); start(p); edge(p, input, timeMs);
    assert.equal(resolveGridKeyAt(layout, snapshot(p).judgmentPoint.position), required); verdict(p, 'boundary', tier);
    results.push({ inputTimeMs: timeMs, input, dynamicRequired: required, tier });
  }
  return { boundaryAtMs: 4000, noNominalKeyFallback: true, results };
});

test('Tap dynamic null in gaps/Space/overlap never gains a nearest-key fallback', () => {
  const gap = clone(layout); gap.layoutVersion = 'gap'; gap.slots.find(s => s.keyId === 'KeyF').width = 0.20;
  const inSpace = clone(layout); inSpace.layoutVersion = 'space-region'; inSpace.slots.find(s => s.keyId === 'KeyF').keyId = 'Space';
  const overlap = clone(layout); overlap.layoutVersion = 'overlap'; overlap.slots.push({ keyId: 'KeyZ', padKind: 'Regular', u: 0.25, v: 0.25, width: 0.25, height: 0.25 });
  const results = [];
  for (const [name, fixture, distance, timeMs] of [['gap', gap, 0.35, 3800], ['Space', inSpace, 0.25, 3000], ['overlap', overlap, 0.25, 3000]]) {
    const p = make([tap('null', distance)], fixture); start(p); edge(p, 'KeyE', timeMs);
    assert.equal(resolveGridKeyAt(fixture, snapshot(p).judgmentPoint.position), null); verdict(p, 'null', null);
    p.advance(timeMs + GOOD_WINDOW_MS + 1); verdict(p, 'null', 'Miss'); assert.equal(p.getJudgeFeedbackSince(0).items.length, 0, '不得伪造默认键反馈');
    results.push({ region: name, tier: 'Miss', fabricatedDefaultKey: false });
  }
  return results;
});

test('Tap temporal windows are unchanged by neighbor tolerance, including endpoints and timeout', () => {
  const results = [];
  for (const [offset, expected] of [[-200, 'Good'], [-100, 'Perfect'], [0, 'Perfect'], [100, 'Perfect'], [200, 'Good'], [200.001, 'Miss']]) {
    const p = make(); start(p); edge(p, 'KeyA', 3000 + offset); if (offset > GOOD_WINDOW_MS) p.advance(3300);
    verdict(p, 'tap', expected); results.push({ offsetMs: offset, expected });
  }
  return { perfectWindowMs: PERFECT_WINDOW_MS, goodWindowMs: GOOD_WINDOW_MS, results };
});

test('Tap neighbor candidates retain nearest-time/target-time/ID ordering and consume at most one per new Down', () => {
  const p = make([tap('z', 0.25), tap('a', 0.25)]); start(p); edge(p, 'KeyA', 3000); verdict(p, 'a', 'Perfect'); verdict(p, 'z', null); assert.equal(p.getResolvedCount(), 1);
  edge(p, 'KeyA', 3001); verdict(p, 'z', null); edge(p, 'KeyA', 3002, 'Up'); edge(p, 'KeyA', 3003); verdict(p, 'z', 'Perfect');
  const nearest = make([tap('early', 0.25), tap('near', 0.26)]); start(nearest); edge(nearest, 'KeyA', 3070); verdict(nearest, 'near', 'Perfect'); verdict(nearest, 'early', null);
  const tie = make([tap('later-a', 0.26), tap('earlier-z', 0.25)]); start(tie); edge(tie, 'KeyA', 3040); verdict(tie, 'earlier-z', 'Perfect'); verdict(tie, 'later-a', null);
  return { oneDownFirst: 'a', repeatedDownConsumed: false, freshDownNext: 'z', nearestTime: 'near', equalDifferenceEarlierTarget: 'earlier-z' };
});

test('Drag uses held diagonal neighbor at exact arrival, rejecting remote/late/released-before/Space inputs', () => {
  const results = [];
  for (const [input, downMs, upMs, expected] of [['KeyA', 2999, 3001, 'Perfect'], ['KeyA', 3000, null, 'Perfect'], ['KeyA', 3001, null, 'Miss'], ['KeyA', 2900, 3000, 'Miss'], ['KeyP', 2999, null, 'Miss'], ['Space', 2999, null, 'Miss']]) {
    const p = make([drag()]); start(p); edge(p, input, downMs); if (upMs !== null) edge(p, input, upMs, 'Up'); p.advance(3300); verdict(p, 'drag', expected, 3000); assert.equal(totalCount(p), 1);
    results.push({ input, downAtMs: downMs, upAtMs: upMs, tier: expected });
  }
  return results;
});

test('Timestamped Drag neighbor Down/Up edges produce identical verdicts at 2/30/60/144 FPS', () => {
  const results = [];
  for (const [downAtMs, upAtMs, expected] of [[2999, 3001, 'Perfect'], [3001, 3002, 'Miss']]) for (const fps of [2, 30, 60, 144]) {
    const p = make([drag()]); start(p); const edges = [{ timeMs: downAtMs, phase: 'Down' }, { timeMs: upAtMs, phase: 'Up' }]; let cursor = 0;
    for (let frame = 1; ; frame += 1) { const frameTime = Math.min(3300, 1000 + frame * 1000 / fps);
      while (cursor < edges.length && edges[cursor].timeMs <= frameTime) { const event = edges[cursor++]; edge(p, 'KeyA', event.timeMs, event.phase); }
      p.advance(frameTime); if (frameTime === 3300) break;
    }
    verdict(p, 'drag', expected, 3000); assert.equal(totalCount(p), 1); results.push({ fps, downAtMs, upAtMs, tier: node(p, 'drag').tier, resolvedAtMs: node(p, 'drag').resolvedAtMs });
  }
  return results;
});

test('Drag binding remains its fixed target neighborhood even after path crosses another grid', () => {
  const p = make([drag('bound', 0.625, 'KeyF')]); start(p); edge(p, 'KeyA', 2000); p.advance(6000);
  assert.equal(resolveGridKeyAt(layout, snapshot(p).judgmentPoint.position), 'KeyH'); verdict(p, 'bound', 'Perfect', 6000);
  const remote = make([drag('bound', 0.625, 'KeyF')]); start(remote); edge(remote, 'KeyH', 2000); remote.advance(6000); verdict(remote, 'bound', 'Miss', 6000);
  return { fixedTarget: 'KeyF', pathGridAtArrival: 'KeyH', fixedDiagonalHeld: 'Perfect', onlyPathGridHeld: 'Miss' };
});

test('Hold accepts pre-held diagonal neighbor, scores once and keeps origin until full tail', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); p.advance(3000); verdict(p, 'hold', null); assert.equal(node(p, 'hold').holdActive, true); assert.equal(node(p, 'hold').disappearAtMs, null);
  for (let timeMs = 3025; timeMs < 5000; timeMs += 25) p.advance(timeMs);
  assert.equal(totalCount(p), 0); assert.equal(node(p, 'hold').disappearAtMs, null); p.advance(5000); verdict(p, 'hold', 'Perfect', 5000);
  assert.equal(node(p, 'hold').disappearAtMs, 5000); assert.equal(node(p, 'hold').holdActive, false); assert.equal(totalCount(p), 1); assert.equal(p.getTotalScore(), 100);
  assert.equal(p.getJudgeFeedbackSince(0).items[0].keyId, 'KeyF');
  return { target: 'KeyF', preHeldNeighbor: 'KeyA', startAtMs: 3000, tailAtMs: 5000, fullRangeOriginRetained: true, scoreEvents: 1 };
});

test('Hold overlapping neighbor handoff remains continuous; releasing a non-last accepted key does not fail', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); edge(p, 'KeyC', 3500); edge(p, 'KeyA', 3501, 'Up'); p.advance(4000); verdict(p, 'hold', null);
  edge(p, 'KeyC', 5000, 'Up'); verdict(p, 'hold', 'Perfect', 5000);
  return { acceptedNeighbors: ['KeyA', 'KeyC'], overlapMs: 1, firstReleaseAtMs: 3501, finalReleaseAtMs: 5000, tier: 'Perfect' };
});

test('Hold equal-time handoff respects edge order: Down then Up continuous; Up then Down cannot repair', () => {
  const results = [];
  for (const [order, expected] of [['Down then Up', 'Perfect'], ['Up then Down', 'Miss']]) {
    const p = make([hold()]); start(p); edge(p, 'KeyA', 2999);
    if (order === 'Down then Up') { edge(p, 'KeyC', 3500); edge(p, 'KeyA', 3500, 'Up'); }
    else { edge(p, 'KeyA', 3500, 'Up'); edge(p, 'KeyC', 3500); }
    p.advance(5000); verdict(p, 'hold', expected, 5000); results.push({ order, handoffTimeMs: 3500, tier: expected });
  }
  return results;
});

test('Hold last-neighbor release or missing start permanently fails; remote/Space held keys cannot bridge gaps', () => {
  const results = [];
  for (const mode of ['missing start', 'neighbor gap', 'remote bridge', 'Space bridge']) {
    const p = make([hold()]); start(p);
    if (mode === 'missing start') { p.advance(3000); edge(p, 'KeyA', 3001); }
    else { edge(p, 'KeyA', 2999); if (mode === 'remote bridge') edge(p, 'KeyP', 3400); if (mode === 'Space bridge') edge(p, 'Space', 3400);
      edge(p, 'KeyA', 3500, 'Up'); edge(p, 'KeyC', 3500.001); }
    p.advance(4999); verdict(p, 'hold', null); assert.equal(node(p, 'hold').disappearAtMs, null); p.advance(5000); verdict(p, 'hold', 'Miss', 5000); assert.equal(totalCount(p), 1);
    results.push({ mode, tier: 'Miss', resolvedAtMs: 5000, repaintCannotRepair: true });
  }
  return results;
});

test('Hold tail endpoint accepts final neighbor Up; just-before-tail fails and just-after cannot rescore', () => {
  const results = [];
  for (const [releaseAtMs, expected] of [[4999.999, 'Miss'], [5000, 'Perfect'], [5000.001, 'Perfect']]) {
    const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); edge(p, 'KeyA', releaseAtMs, 'Up'); p.advance(6000); verdict(p, 'hold', expected, 5000); assert.equal(totalCount(p), 1);
    results.push({ releaseAtMs, tier: expected, disappearAtMs: node(p, 'hold').disappearAtMs });
  }
  return results;
});

test('Hold pause freezes interval/clock; paused release of non-last neighbor preserves continuity', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); edge(p, 'KeyC', 3400); p.togglePause(3500); const frozen = clone(snapshot(p));
  p.advance(12000); edge(p, 'KeyA', 3500, 'Up'); edge(p, 'KeyP', 9000); p.advanceMediaStatus(true, true, 90000);
  assert.deepEqual(snapshot(p), frozen); assert.equal(p.getCurrentTimeMs(), 3500); assert.equal(totalCount(p), 0); p.togglePause(3500); p.advance(5000); verdict(p, 'hold', 'Perfect', 5000); assert.equal(p.getState(), 'Playing');
  return { pauseAtMs: 3500, holdAndClockFrozen: true, pausedNonLastReleasePreserved: true, pausedWallTimeExcludedMs: 90000, tier: 'Perfect' };
});

test('Hold pause releasing last accepted neighbor locks failure while verdict/visual stay frozen to tail', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); p.togglePause(3500); const frozen = clone(snapshot(p));
  edge(p, 'KeyA', 3500, 'Up'); edge(p, 'KeyC', 3500); assert.deepEqual(snapshot(p), frozen); assert.equal(totalCount(p), 0);
  p.togglePause(3500); edge(p, 'KeyC', 3501); p.advance(4999); verdict(p, 'hold', null); p.advance(5000); verdict(p, 'hold', 'Miss', 5000);
  return { lastNeighborReleasedDuringPause: true, noJudgmentDuringPause: true, resumedRepressCannotRepair: true, tailVerdict: 'Miss' };
});

test('Mixed neighbor Tap / Drag / Hold remain independent and path arrivals retain distance ordering', () => {
  const p = make([drag('drag', 0.25), hold('hold', 0.25, 0.5), tap('tap', 0.375)]); start(p); edge(p, 'KeyA', 2999); p.advance(3000);
  verdict(p, 'drag', 'Perfect', 3000); verdict(p, 'hold', null); edge(p, 'KeyD', 4000); verdict(p, 'tap', 'Perfect', 4000); p.advance(5000); verdict(p, 'hold', 'Perfect', 5000);
  assert.equal(p.getPerfectCount(), 3); assert.equal(p.getTotalScore(), 300); assert.equal(p.getTotalNoteCount(), 3);
  const feedback = p.getJudgeFeedbackSince(0).items; assert.deepEqual(feedback.map(item => item.videoTimeMs), [3000, 4000, 5000]);
  return { tapNeighbor: 'KeyD', fixedTargetNeighbor: 'KeyA', arrivalTimesMs: feedback.map(item => item.videoTimeMs), perfect: 3, score: 300 };
});

test('Exit/reentry resets accepted-neighbor guards, Hold failures, node tiers and stale media end', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); p.advance(3500); p.requestExit(3500); assert.equal(p.getResult().completed, false); p.reopen();
  assert.equal(p.getState(), 'Ready'); assert.equal(snapshot(p).startedAtMs, null); assert.equal(snapshot(p).judgmentPoint, null); assert.equal(node(p, 'hold').tier, null); assert.equal(node(p, 'hold').holdActive, false); assert.equal(p.getTotalScore(), 0);
  assert.deepEqual(p.getJudgeFeedbackSince(0), { nextSeq: 0, items: [] }); p.begin(); start(p); p.advance(5000); verdict(p, 'hold', 'Miss', 5000); assert.equal(p.getState(), 'Playing');
  p.requestExit(5000); p.reopen(); p.begin(); start(p); edge(p, 'KeyC', 2999); p.advance(5000); verdict(p, 'hold', 'Perfect', 5000);
  return { staleHeldNeighborCleared: true, firstReentryWithoutInput: 'Miss', secondReentryFreshNeighbor: 'Perfect', scoreAndFeedbackCleared: true };
});

test('47-key legacy ChartData accepts adjacent targets but rejects remote/Space; one strike consumes one Note', () => {
  const actual = createDefaultKeyboardPadLayout(); const target = getSlot(actual, 'KeyF');
  const neighbor = actual.slots.find(s => s.keyId !== 'KeyF' && directTouch(target, s)); const far = actual.slots.find(s => s.keyId !== 'KeyF' && !directTouch(target, s)); assert.ok(neighbor); assert.ok(far);
  function legacy(notes = [{ keyId: 'KeyF', timeMs: 3000 }]) { const p = new ChartPremiere({ chartId: 'LEGACY_NEIGHBOR', tier: 'Regular', layoutVersion: actual.layoutVersion, notes }, actual); p.begin(); return p; }
  const good = legacy(); edge(good, neighbor.keyId, 3000); assert.equal(good.getPerfectCount(), 1); assert.equal(good.getResolvedCount(), 1);
  assert.equal(good.getJudgeFeedbackSince(0).items[0].keyId, 'KeyF', '旧Note邻键判定也反馈目标键');
  const wrong = legacy(); edge(wrong, far.keyId, 3000); assert.equal(wrong.getPerfectCount(), 0); assert.equal(wrong.getResolvedCount(), 0);
  const space = legacy(); edge(space, 'Space', 3000); assert.equal(space.getResolvedCount(), 0); assert.equal(space.getPerfectCount(), 0);
  const one = legacy([{ keyId: 'KeyF', timeMs: 3000 }, { keyId: 'KeyF', timeMs: 3000 }]); edge(one, neighbor.keyId, 3000); assert.equal(one.getResolvedCount(), 1);
  return { gridCells: 47, target: 'KeyF', acceptedNeighbor: neighbor.keyId, rejectedRemote: far.keyId, spaceDoesNotConsume: true, oneStrikeOneNote: true };
});

test('Legacy adjacent candidate ranking retains time ordering when one key matches multiple Note targets', () => {
  const p = new ChartPremiere({ chartId: 'LEGACY_SORT', tier: 'Regular', layoutVersion: layout.layoutVersion, notes: [{ keyId: 'KeyE', timeMs: 3000 }, { keyId: 'KeyG', timeMs: 3080 }] }, layout); p.begin(); edge(p, 'KeyF', 3070);
  assert.equal(p.getResolvedCount(), 1); assert.equal(p.getPerfectCount(), 1); p.advance(3000 + GOOD_WINDOW_MS + 1); assert.equal(p.getMissCount(), 1);
  return { sharedNeighbor: 'KeyF', targetTimesMs: [3000, 3080], selectedTargetTimeMs: 3080, consumed: 1 };
});

test('Actual independent A/B resources declare new grid version and retain strict version rejection', () => {
  const actual = createDefaultKeyboardPadLayout(); const resources = [];
  for (const name of ['guidance_a.json', 'guidance_b.json']) { const file = path.join(__dirname, '../../assets/resources/chart/' + name); const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); const parsed = parseGuidanceChart(raw, actual);
    assert.equal(raw.layoutVersion, 'pad-layout-2'); const stale = clone(raw); stale.layoutVersion = 'pad-layout-1'; assert.throws(() => parseGuidanceChart(stale, actual)); resources.push({ name, chartId: parsed.chartId, nodeCount: parsed.lines[0].nodes.length, layoutVersion: parsed.layoutVersion }); }
  return resources;
});

test('Normalized grid/neighbors/arc length and temporal verdicts are identical at 1920x1080 and 2560x1440', () => {
  const actual = createDefaultKeyboardPadLayout(); const samples = [];
  for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
    const p = make([tap('tap', 0.375), drag('drag'), hold('hold')]); start(p); edge(p, 'KeyA', 2999); edge(p, 'KeyD', 4000); p.advance(5000);
    assert.equal(p.getPerfectCount(), 3); const logical = snapshot(p).judgmentPoint; near(logical.pathDistance, 0.5);
    const projected = actual.slots.map(slot => ({ keyId: slot.keyId, x: slot.u * width, y: slot.v * height, width: slot.width * width, height: slot.height * height }));
    projected.forEach((slot, index) => { near(slot.x / width, actual.slots[index].u); near(slot.y / height, actual.slots[index].v); near(slot.width / width, actual.slots[index].width); near(slot.height / height, actual.slots[index].height); });
    samples.push({ resolution: `${width}x${height}`, logicalDistance: logical.pathDistance, tierCounts: { perfect: p.getPerfectCount(), good: p.getGoodCount(), miss: p.getMissCount() }, pathLength: measurePathLength(rawChart().lines[0].path, 1), widthsNormalized: projected.slice(0, 1).map(s => s.width / width) });
  }
  assert.deepEqual(samples[0].tierCounts, samples[1].tierCounts); return { scope: '纯逻辑归一化/投影一致性；实际 Creator 视觉由另份预览证据覆盖', samples };
});

function directorFixture() {
  const p = make([drag('drag', 0.25), hold('hold', 0.25, 0.5), tap('tap', 0.375)]); p.requestExit(0); p.reopen(); const director = new DirectorSession();
  const chain = new PuzzleChain(new PuzzleProgress()); let beat = 0, rhythm = null, mediaTime = -1, ended = false;
  director.bindProtagonist(new Protagonist({ lateral: 0, depth: 0 })); director.bindMapCenter({ lateral: 0, depth: 0 }); director.bindPuzzleChain(chain); director.bindDeepTrace(new DeepTrace({ lateral: 0, depth: 0 }));
  director.bindScreenProjectionProbe(() => ({ x: 0.5, y: 0.5 })); director.bindBeatClockProbe(() => beat); director.bindRhythmStrikeProbe(() => rhythm);
  director.bindChartPremiere(p); director.bindChartClockProbe(() => mediaTime); director.bindChartMediaProbe(() => ({ ended, unavailable: false })); director.submitFrameIntents([], 0.016);
  for (beat = 0; beat < 7000; beat += 1000) { rhythm = { strikeTimeMs: beat, targetBeatTimeMs: beat }; director.submitFrameIntents([{ kind: 'Strike', videoTimeMs: beat }], 0.016); }
  director.submitFrameIntents([], 0.016); assert.equal(director.getLedgerEvents().length, 1);
  const frame = (time, intents = []) => { mediaTime = time; director.submitFrameIntents(intents, 0.016); };
  return { p, director, frame, setMediaTime: time => { mediaTime = time; }, setEnded: value => { ended = value; } };
}

test('Director retains R26 all-settled + media-end, no mid-exit ledger and only one completion record after reentry', () => {
  const { p, director, frame, setEnded } = directorFixture(); frame(0, [{ kind: 'EnterChart' }]); frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  frame(2999, [{ kind: 'Strike', keyId: 'KeyA', videoTimeMs: 2999 }]); frame(3500, [{ kind: 'ExitChart' }]); assert.equal(director.getLedgerEvents().length, 1); assert.equal(p.getResult().completed, false);
  frame(-1, [{ kind: 'EnterChart' }]); frame(0); assert.equal(p.getResolvedCount(), 0); frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  frame(2999, [{ kind: 'Strike', keyId: 'KeyA', videoTimeMs: 2999 }]); frame(4000, [{ kind: 'Strike', keyId: 'KeyD', videoTimeMs: 4000 }]); frame(5000); assert.equal(p.getPerfectCount(), 3);
  frame(10000); assert.equal(p.getState(), 'Playing'); assert.equal(director.getLedgerEvents().length, 1); setEnded(true); frame(12000); assert.equal(p.getState(), 'Exited'); assert.equal(p.getResult().completed, true); assert.equal(director.getLedgerEvents().length, 2);
  frame(12000); frame(0, [{ kind: 'EnterChart' }]); assert.equal(director.getLedgerEvents().length, 2);
  return { allResolvedAtMs: 5000, stillPlayingAtMs: 10000, mediaEndedAtMs: 12000, endpointRecords: 1, middleExitRecords: 0, completionRecords: 1 };
});

function withCocosEventStub(run) {
  const Module = require('module'), originalLoad = Module._load, originalWindow = global.window, handlers = new Map();
  const input = { on(e, callback, context) { const a = handlers.get(e) ?? []; a.push({ callback, context }); handlers.set(e, a); }, off(e, cb, context) { handlers.set(e, (handlers.get(e) ?? []).filter(i => i.callback !== cb || i.context !== context)); }, emit(e, keyCode) { for (const i of handlers.get(e) ?? []) i.callback.call(i.context, { keyCode }); } };
  const cc = { _decorator: { ccclass: () => target => target }, Component: class {}, input, Input: { EventType: { KEY_DOWN: 'down', KEY_UP: 'up', MOUSE_WHEEL: 'wheel' } } };
  global.window = { addEventListener() {}, removeEventListener() {} }; Module._load = function (r, parent, main) { return r === 'cc' ? cc : originalLoad.call(this, r, parent, main); };
  const filenames = [require.resolve('../../src/presentation/InputCollector.ts'), require.resolve('../../src/presentation/FrameDriver.ts')]; filenames.forEach(f => { delete require.cache[f]; });
  try { const { InputCollector } = require('../../src/presentation/InputCollector.ts'); const { FrameDriver } = require('../../src/presentation/FrameDriver.ts'); return run({ InputCollector, FrameDriver, input }); }
  finally { Module._load = originalLoad; filenames.forEach(f => { delete require.cache[f]; }); if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
}

test('Real InputCollector/FrameDriver sends invisible Head Space and cross-frame neighbor edges through director', () => withCocosEventStub(({ InputCollector, FrameDriver, input }) => {
  const { p, director, frame, setMediaTime } = directorFixture(); frame(0, [{ kind: 'EnterChart' }]);
  let eventTime = 1000; const collector = new InputCollector(); collector.bindChartStateProvider(() => director.getChartPlaybackState()); collector.bindChartTimeProbe(() => eventTime); collector.onEnable();
  const driver = new FrameDriver(); driver.onLoad(); driver.bindWiring(collector, director); const reads = []; driver.addRefreshable({ onFrameRefresh: () => reads.push({ timeMs: p.getCurrentTimeMs(), lineState: snapshot(p).state, dragTier: node(p, 'drag').tier, holdTier: node(p, 'hold').tier }) });
  try { input.emit('down', 32); setMediaTime(1000); driver.update(0.016); assert.equal(snapshot(p).state, 'Running');
    eventTime = 2999; input.emit('down', 65); eventTime = 3001; input.emit('up', 65); setMediaTime(3500); driver.update(0.016); verdict(p, 'drag', 'Perfect', 3000); verdict(p, 'hold', null);
    setMediaTime(5000); driver.update(0.016); verdict(p, 'hold', 'Miss', 5000);
    return { invisibleSpaceCode: 32, startAtMs: 1000, diagonalNeighborCode: 65, downAtMs: 2999, upAtMs: 3001, firstRenderAtMs: 3500, dragTier: 'Perfect', holdTier: 'Miss', reads };
  } finally { collector.onDisable(); driver.onDestroy(); }
}));

const sourceFiles = ['src/chart/KeyboardPadLayout.ts', 'src/chart/GuidanceLineRuntime.ts', 'src/chart/ChartPremiere.ts', 'src/presentation/ChartPadView.ts'];
const sourceHashes = Object.fromEntries(sourceFiles.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../..', name))).digest('hex')]));
const report = { task: 'Full-screen 47-key grid and direct side/corner neighbor judgments', generatedAt: new Date().toISOString(), command: 'node quality-review/guidance-editor/pad-regression.cjs',
  semantics: '四行铺满；同排少键更宽；Space只启动Head。邻键取屏幕矩形边/角直接接触，只一层。Hold可接受集合持续非空，Down/Up同时间保留边沿顺序。',
  coverage: '公开 chart/director API；真实 InputCollector/FrameDriver 仅 cc 事件总线 stub；实际 Creator 视觉独立采集。旧A/B严格键反例因用户规则变更不再适用，旧证据未修改。',
  sourceHashes, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks };
fs.writeFileSync(path.join(__dirname, 'pad-grid-regression-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (report.failed > 0) process.exitCode = 1;
