// B 步独立行为验收；不修改 A 步证据、源码、docs 或名库。
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ts = require('../../node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 },
}).outputText, filename);
const { ChartPremiere, CHART_MEDIA_END_TIMEOUT_MS } = require('../../src/chart/ChartPremiere.ts');
const { parseGuidanceChart, measurePathLength, positionAtPathDistance } = require('../../src/chart/GuidanceChart.ts');
const { GuidanceLineRuntime } = require('../../src/chart/GuidanceLineRuntime.ts');
const { resolveGridKeyAt, createDefaultKeyboardPadLayout } = require('../../src/chart/KeyboardPadLayout.ts');
const { HEAD_WINDOW_MS, GOOD_WINDOW_MS } = require('../../constants/index.ts');
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
function near(actual, expected, epsilon = 1e-9) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }
const layout = { layoutVersion: 'guidance-b-acceptance-1', slots: [
  { keyId: 'KeyA', padKind: 'Regular', u: 0, v: 0.4, width: 0.5, height: 0.4 },
  { keyId: 'KeyB', padKind: 'Regular', u: 0.5, v: 0.4, width: 0.5, height: 0.4 },
  { keyId: 'Space', padKind: 'Heavy', u: 0.25, v: 0.05, width: 0.5, height: 0.15 },
] };
const tap = (id = 'tap', distance = 0.375) => ({ id, kind: 'Tap', pathDistance: distance });
const drag = (id = 'drag', distance = 0.25, keyId = 'KeyA') => ({ id, kind: 'Drag', pathDistance: distance, keyId });
const hold = (id = 'hold', distance = 0.25, endPathDistance = 0.5, keyId = 'KeyA') => ({ id, kind: 'Hold', pathDistance: distance, endPathDistance, keyId });
function rawChart(nodes = [drag(), hold(), tap()]) { return {
  schemaVersion: 1, chartId: 'GUIDANCE_B_ACCEPTANCE', tier: 'Regular', layoutVersion: layout.layoutVersion, aspectRatio: 1,
  lines: [{ id: 'line-b', head: { id: 'head-b', spawnTimeMs: 1000 },
    path: { kind: 'Polyline', points: [{ u: 0.125, v: 0.5 }, { u: 0.875, v: 0.5 }] }, speed: 0.125, nodes }],
}; }
function make(nodesOrRaw = [drag(), hold(), tap()], usedLayout = layout) {
  const raw = Array.isArray(nodesOrRaw) ? rawChart(nodesOrRaw) : nodesOrRaw;
  const p = new ChartPremiere(parseGuidanceChart(raw, usedLayout), usedLayout); p.begin(); return p;
}
function snapshot(p) { const s = p.getGuidanceSnapshot(); assert.ok(s); return s; }
function node(p, id) { const item = snapshot(p).nodes.find(item => item.node.id === id); assert.ok(item, id); return item; }
function edge(p, keyId, timeMs, phase = 'Down') { p.submitStrike({ keyId, videoTimeMs: timeMs, phase }); }
function start(p, timeMs = 1000) { edge(p, 'Space', timeMs); assert.equal(snapshot(p).state, 'Running'); assert.equal(snapshot(p).startedAtMs, timeMs); }
function verdict(p, id, tier, resolvedAtMs) { const n = node(p, id); assert.equal(n.tier, tier, id); if (resolvedAtMs !== undefined) near(n.resolvedAtMs, resolvedAtMs); }
function totalCount(p) { return p.getPerfectCount() + p.getGoodCount() + p.getMissCount(); }

test('B parser accepts mixed nodes and Polyline; strict rejection of unsupported resource fields and types', () => {
  const parsed = parseGuidanceChart(rawChart(), layout); assert.equal(parsed.lines[0].nodes.length, 3);
  const cases = [
    ['schema', r => { r.schemaVersion = 4; }], ['layoutVersion', r => { r.layoutVersion = 'other'; }],
    ['multiple lines', r => { r.lines.push({ ...clone(r.lines[0]), id: 'second' }); }],
    ['Bezier', r => { r.lines[0].path.kind = 'Bezier'; }], ['unknown node kind', r => { r.lines[0].nodes[0].kind = 'Other'; }],
    ['unknown chart field', r => { r.defaultKey = 'KeyA'; }], ['unknown line field', r => { r.lines[0].fallbackKey = 'KeyA'; }],
    ['Tap keyId undefined', r => { r.lines[0].nodes[2].keyId = undefined; }], ['Tap default key', r => { r.lines[0].nodes[2].defaultKey = 'KeyB'; }],
    ['Drag Space', r => { r.lines[0].nodes[0].keyId = 'Space'; }], ['Hold Space', r => { r.lines[0].nodes[1].keyId = 'Space'; }],
    ['Drag missing key', r => { delete r.lines[0].nodes[0].keyId; }], ['Hold key absent in layout', r => { r.lines[0].nodes[1].keyId = 'KeyZ'; }],
    ['Drag unknown field', r => { r.lines[0].nodes[0].defaultKey = 'KeyA'; }], ['Hold tail equals start', r => { r.lines[0].nodes[1].endPathDistance = 0.25; }],
    ['Hold tail before start', r => { r.lines[0].nodes[1].endPathDistance = 0.1; }], ['Hold tail beyond path', r => { r.lines[0].nodes[1].endPathDistance = 0.751; }],
    ['Hold missing tail', r => { delete r.lines[0].nodes[1].endPathDistance; }], ['duplicate ID', r => { r.lines[0].nodes[0].id = 'head-b'; }],
    ['negative distance', r => { r.lines[0].nodes[0].pathDistance = -1; }], ['nonfinite speed', r => { r.lines[0].speed = NaN; }],
    ['nonpositive speed', r => { r.lines[0].speed = 0; }], ['outside path point', r => { r.lines[0].path.points[0].u = -0.01; }],
    ['coincident adjacent path points', r => { r.lines[0].path.points.splice(1, 0, clone(r.lines[0].path.points[0])); }],
  ];
  for (const [name, mutate] of cases) { const r = rawChart(); mutate(r); assert.throws(() => parseGuidanceChart(r, layout), undefined, name); assert.throws(() => new ChartPremiere(r, layout), undefined, name + ' constructor'); }
  return { accepted: ['Tap', 'Drag', 'Hold', 'Polyline'], rejected: cases.map(([name]) => name) };
});

test('Internal turns require Tap or Hold start; Drag alone and Hold tail alone are rejected', () => {
  const makeTurn = nodes => { const r = rawChart(nodes); r.aspectRatio = 2; r.lines[0].path.points = [{ u: 0.125, v: 0.5 }, { u: 0.375, v: 0.5 }, { u: 0.375, v: 0.75 }]; return r; };
  assert.doesNotThrow(() => parseGuidanceChart(makeTurn([tap('turn-tap', 0.5)]), layout));
  assert.doesNotThrow(() => parseGuidanceChart(makeTurn([hold('turn-hold', 0.5, 0.7)]), layout));
  assert.throws(() => parseGuidanceChart(makeTurn([drag('turn-drag', 0.5)]), layout));
  assert.throws(() => parseGuidanceChart(makeTurn([hold('tail-only', 0.25, 0.5)]), layout));
  return { turnDistance: 0.5, accepted: ['Tap', 'Hold start'], rejected: ['Drag alone', 'Hold tail alone'] };
});

test('Node order is normalized deterministically and resource / snapshots remain immutable copies', () => {
  const r = rawChart([tap('z', 0.5), tap('b', 0.25), tap('a', 0.25)]);
  const chart = parseGuidanceChart(r, layout); assert.deepEqual(chart.lines[0].nodes.map(n => n.id), ['a', 'b', 'z']);
  assert.deepEqual(r.lines[0].nodes.map(n => n.id), ['z', 'b', 'a']); r.lines[0].nodes[0].pathDistance = 0;
  assert.equal(chart.lines[0].nodes[2].pathDistance, 0.5);
  for (const value of [chart, chart.lines, chart.lines[0], chart.lines[0].nodes, ...chart.lines[0].nodes]) assert.ok(Object.isFrozen(value));
  const p = make(chart); start(p); p.advance(2000); const s = snapshot(p);
  for (const value of [s, s.nodes, ...s.nodes, s.judgmentPoint, s.judgmentPoint.position]) assert.ok(Object.isFrozen(value));
  return { orderedIDs: chart.lines[0].nodes.map(n => n.id), originalIDs: ['z', 'b', 'a'], deepFrozen: true };
});

test('Polyline uses weighted arc length; equal durations cross unequal-length segments at uniform speed', () => {
  const r = rawChart([tap('turn', 0.5)]); r.aspectRatio = 2;
  r.lines[0].path.points = [{ u: 0.125, v: 0.5 }, { u: 0.375, v: 0.5 }, { u: 0.375, v: 0.75 }];
  const p = make(r); start(p); const samples = [];
  for (const timeMs of [4000, 5000, 6000]) { p.advance(timeMs); const s = snapshot(p); near(s.judgmentPoint.pathDistance, (timeMs - 1000) * 0.125 / 1000); assert.deepEqual(s.remainingPoints[0], s.judgmentPoint.position); samples.push({ timeMs, distance: s.judgmentPoint.pathDistance, position: s.judgmentPoint.position, remainingPoints: s.remainingPoints }); }
  near(samples[1].distance - samples[0].distance, 0.125); near(samples[2].distance - samples[1].distance, 0.125);
  near(measurePathLength(r.lines[0].path, 2), 0.75); assert.equal(samples[2].remainingPoints.length, 2);
  return { speed: 0.125, aspectRatio: 2, samples };
});

test('Head keeps authorized 1000ms window; timeout finalizes all Tap / Drag / Hold exactly once', () => {
  assert.equal(HEAD_WINDOW_MS, 1000); const accepted = [];
  for (const offset of [0, 100, 999, 1000]) { const p = make(); start(p, 1000 + offset); assert.equal(totalCount(p), 0); accepted.push(snapshot(p).startedAtMs); }
  const p = make(); p.advance(2000); assert.equal(snapshot(p).state, 'Waiting'); p.advance(2000.001);
  assert.equal(snapshot(p).state, 'TimedOut'); assert.equal(p.getTotalNoteCount(), 3); assert.equal(p.getResolvedCount(), 3); assert.equal(p.getMissCount(), 3);
  edge(p, 'Space', 2001); p.advance(9000); assert.equal(p.getMissCount(), 3); assert.equal(p.getState(), 'Playing');
  p.advanceMediaStatus(true, false, 1); assert.equal(p.getState(), 'Completed'); return { acceptedStartMs: accepted, timeoutAtMs: 2000.001, missedDescendants: 3 };
});

test('Drag uses an early Down / later Up spanning target even when no render frame hits arrival', () => {
  const p = make([drag()]); start(p); p.advance(2800); edge(p, 'KeyA', 2999); edge(p, 'KeyA', 3001, 'Up'); p.advance(3300);
  verdict(p, 'drag', 'Perfect', 3000); assert.equal(p.getPerfectCount(), 1); assert.equal(p.getTotalScore(), 100);
  const frameRates = [];
  for (const [mode, downAtMs, upAtMs, expectedTier] of [
    ['Down before arrival', 2999, 3001, 'Perfect'], ['Down after arrival', 3001, 3002, 'Miss'],
  ]) {
    for (const [fps, framePeriodMs] of [[30, 1000 / 30], [60, 1000 / 60], [144, 1000 / 144], [2, 500]]) {
      const q = make([drag()]); start(q);
      const stream = [{ timeMs: downAtMs, phase: 'Down' }, { timeMs: upAtMs, phase: 'Up' }];
      const submittedEdges = []; let cursor = 0, frameCount = 0;
      for (let index = 1; ; index += 1) {
        const frameTimeMs = Math.min(3300, 1000 + index * framePeriodMs);
        while (cursor < stream.length && stream[cursor].timeMs <= frameTimeMs) {
          const event = stream[cursor++]; edge(q, 'KeyA', event.timeMs, event.phase);
          submittedEdges.push({ inputTimeMs: event.timeMs, phase: event.phase, collectedBeforeFrameMs: frameTimeMs });
        }
        q.advance(frameTimeMs); frameCount += 1;
        if (frameTimeMs === 3300) break;
      }
      assert.equal(cursor, 2); verdict(q, 'drag', expectedTier, 3000); assert.equal(totalCount(q), 1);
      frameRates.push({ mode, fps, framePeriodMs, frameCount, tier: node(q, 'drag').tier,
        resolvedAtMs: node(q, 'drag').resolvedAtMs, submittedEdges });
    }
  }
  return { downAtMs: 2999, targetAtMs: 3000, upAtMs: 3001, renderFrames: [2800, 3300], tier: 'Perfect', frameRates };
});

test('Drag late Down or absent input misses once and cannot be repaired', () => {
  const results = [];
  for (const mode of ['late Down', 'no input']) { const p = make([drag()]); start(p); if (mode === 'late Down') edge(p, 'KeyA', 3001); else p.advance(3001); verdict(p, 'drag', 'Miss', 3000); edge(p, 'KeyA', 3002, 'Up'); edge(p, 'KeyA', 3003); p.advance(8000); assert.equal(p.getMissCount(), 1); assert.equal(p.getTotalScore(), 0); results.push({ mode, tier: node(p, 'drag').tier }); }
  return results;
});

test('Drag equal-time boundary: Down at arrival valid; Up at arrival means no key held', () => {
  const down = make([drag()]); start(down); edge(down, 'KeyA', 3000); verdict(down, 'drag', 'Perfect', 3000);
  const up = make([drag()]); start(up); edge(up, 'KeyA', 2900); edge(up, 'KeyA', 3000, 'Up'); verdict(up, 'drag', 'Miss', 3000);
  return { targetAtMs: 3000, equalDown: 'Perfect', equalUp: 'Miss' };
});

test('Drag binding is independent of current path grid and never substitutes another held key', () => {
  const good = make([drag('bound', 0.5, 'KeyA')]); start(good); edge(good, 'KeyA', 2000); good.advance(5000);
  assert.equal(resolveGridKeyAt(layout, snapshot(good).judgmentPoint.position), 'KeyB'); verdict(good, 'bound', 'Perfect', 5000);
  const remoteLayout = {...layout, slots:[...layout.slots,{keyId:'KeyC',padKind:'Regular',u:.1,v:.05,width:.1,height:.1}]}; const wrong = make([drag('bound', 0.5, 'KeyA')], remoteLayout); start(wrong); edge(wrong, 'KeyC', 2000); wrong.advance(5000); verdict(wrong, 'bound', 'Miss', 5000);
  return { pathGridAtArrival: 'KeyB', binding: 'KeyA', boundHeld: 'Perfect', remoteNonNeighborHeld: 'Miss' };
});

test('Hold pre-held start follows fixed key through another grid; resolves and fades only at tail', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2000); p.advance(3000);
  verdict(p, 'hold', null); assert.equal(node(p, 'hold').holdActive, true); assert.equal(node(p, 'hold').disappearAtMs, null, '未结算 Hold 不启动淡出');
  assert.deepEqual(node(p, 'hold').holdRemainingPoints, [{ u: 0.375, v: 0.5 }, { u: 0.625, v: 0.5 }]);
  p.advance(4000); assert.equal(resolveGridKeyAt(layout, snapshot(p).judgmentPoint.position), 'KeyB'); verdict(p, 'hold', null); assert.equal(p.getTotalScore(), 0);
  p.advance(5000); verdict(p, 'hold', 'Perfect', 5000); assert.equal(node(p, 'hold').holdActive, false);
  assert.deepEqual(node(p, 'hold').holdRemainingPoints, []); near(node(p, 'hold').disappearAtMs, 5000); assert.equal(p.getTotalScore(), 100);
  return { boundKey: 'KeyA', crossedGrid: 'KeyB', startAtMs: 3000, resolvedAtMs: 5000, disappearAtMs: 5000, score: 100 };
});

test('Hold Down exactly at start qualifies, and start missing becomes unrecoverable Miss', () => {
  const exact = make([hold()]); start(exact); edge(exact, 'KeyA', 3000); exact.advance(5000); verdict(exact, 'hold', 'Perfect', 5000);
  const missing = make([hold()]); start(missing); missing.advance(3000); verdict(missing, 'hold', null); assert.equal(missing.getMissCount(), 0);
  edge(missing, 'KeyA', 3001); missing.advance(4999); verdict(missing, 'hold', null);
  missing.advance(5000); verdict(missing, 'hold', 'Miss', 5000); assert.equal(missing.getMissCount(), 1);
  return { exactStart: 'Perfect', missingStartFailureLockedAtMs: 3000, finalMissAtMs: 5000, lateStartDidNotRepair: true };
});

test('Hold middle release locks failure; final Miss and fade wait for tail, and re-press cannot repair', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); p.advance(3000); edge(p, 'KeyA', 3500, 'Up');
  verdict(p, 'hold', null); assert.equal(p.getMissCount(), 0); assert.equal(node(p, 'hold').holdActive, true); assert.equal(node(p, 'hold').disappearAtMs, null);
  assert.ok(node(p, 'hold').holdRemainingPoints.length >= 2); edge(p, 'KeyA', 3501); p.advance(4999);
  verdict(p, 'hold', null); assert.equal(node(p, 'hold').holdActive, true); p.advance(5000);
  verdict(p, 'hold', 'Miss', 5000); near(node(p, 'hold').disappearAtMs, 5000);
  assert.equal(node(p, 'hold').holdActive, false); assert.deepEqual(node(p, 'hold').holdRemainingPoints, []);
  assert.equal(p.getMissCount(), 1); assert.equal(p.getPerfectCount(), 0); assert.equal(p.getTotalScore(), 0);
  return { failureLockedAtMs: 3500, repressedAtMs: 3501, resolvedAtMs: 5000, disappearAtMs: 5000, finalTier: 'Miss', oneMiss: true };
});

test('Hold release strictly before tail fails; release exactly at tail succeeds; late release cannot rescore', () => {
  const outcomes = [];
  for (const [releaseMs, tier, resolvedMs] of [[4999.999, 'Miss', 5000], [5000, 'Perfect', 5000], [5000.001, 'Perfect', 5000]]) {
    const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); edge(p, 'KeyA', releaseMs, 'Up'); p.advance(6000);
    verdict(p, 'hold', tier, resolvedMs); assert.equal(totalCount(p), 1); near(node(p, 'hold').disappearAtMs, 5000);
    outcomes.push({ releaseMs, tier, resolvedAtMs: node(p, 'hold').resolvedAtMs });
  }
  return outcomes;
});

test('Hold is one node and one score after many frames / repeat Downs; transparency changes points only', () => {
  const observations = [];
  for (const transparency of [0, 100]) { const p = make([hold()]); p.setGuideTransparency(transparency); start(p); edge(p, 'KeyA', 2000);
    for (let time = 2500; time <= 6000; time += 25) { edge(p, 'KeyA', time); p.advance(time); }
    assert.equal(p.getTotalNoteCount(), 1); assert.equal(p.getResolvedCount(), 1); assert.equal(p.getPerfectCount(), 1); assert.equal(p.getMissCount(), 0);
    assert.equal(p.getTotalScore(), transparency === 0 ? 100 : 200); observations.push({ transparency, frames: 141, perfectCount: 1, score: p.getTotalScore() }); }
  return observations;
});

test('A Hold tail may span a Polyline turn with Tap at turn; remaining held segment follows logical path', () => {
  const r = rawChart([hold('hold', 0.125, 0.625), tap('corner', 0.5)]); r.aspectRatio = 2;
  r.lines[0].path.points = [{ u: 0.125, v: 0.5 }, { u: 0.375, v: 0.5 }, { u: 0.375, v: 0.75 }];
  const p = make(r); start(p); edge(p, 'KeyA', 1900); p.advance(4000);
  assert.deepEqual(node(p, 'hold').holdRemainingPoints, [{ u: 0.3125, v: 0.5 }, { u: 0.375, v: 0.5 }, { u: 0.375, v: 0.625 }]);
  edge(p, 'KeyA', 4999, 'Up'); edge(p, 'KeyA', 5000); // release makes Hold Miss; new Down judges the corner Tap.
  verdict(p, 'corner', 'Perfect', 5000); verdict(p, 'hold', null); p.advance(6000); verdict(p, 'hold', 'Miss', 6000);
  near(node(p, 'hold').disappearAtMs, 6000); return { clippedHoldPointsAtMs4000: 3, cornerTier: 'Perfect', holdTier: 'Miss', fadeAtMs: 6000 };
});

test('Mixed Tap / Drag / Hold finalizes by node rules and counts only nodes, with no media-end shortcut', () => {
  const p = make(); start(p); edge(p, 'KeyA', 2999); p.advance(3000); verdict(p, 'drag', 'Perfect', 3000); verdict(p, 'hold', null);
  edge(p, 'KeyB', 4000); verdict(p, 'tap', 'Perfect', 4000); p.advance(5000); verdict(p, 'hold', 'Perfect', 5000);
  assert.equal(p.getTotalNoteCount(), 3); assert.equal(p.getResolvedCount(), 3); assert.equal(p.getProgress(), 1); assert.equal(p.getPerfectCount(), 3); assert.equal(p.getTotalScore(), 300);
  p.advance(10000); assert.equal(p.getState(), 'Playing'); assert.equal(p.getResult(), null); p.advance(12000); p.advanceMediaStatus(true, false, 1); assert.equal(p.getState(), 'Completed');
  return { nodes: 3, perfect: 3, score: 300, allResolvedAtMs: 5000, mediaCompletedAtMs: 12000 };
});

test('Tap candidate ranking chooses absolute time difference before target time', () => {
  const p = make([tap('early', 0.25), tap('near', 0.26)]); start(p); edge(p, 'KeyA', 3070);
  verdict(p, 'near', 'Perfect', 3070); verdict(p, 'early', null); assert.equal(p.getResolvedCount(), 1);
  return { inputAtMs: 3070, targets: [3000, 3080], selected: 'near', secondary: 'early' };
});

test('Tap candidate equal-difference tie chooses earlier target time', () => {
  const p = make([tap('later-a', 0.26), tap('earlier-z', 0.25)]); start(p); edge(p, 'KeyA', 3040);
  verdict(p, 'earlier-z', 'Perfect', 3040); verdict(p, 'later-a', null); return { inputAtMs: 3040, targets: [3000, 3080], selected: 'earlier-z' };
});

test('Tap candidates share one B line ID; equal time tie chooses node ID and one Down consumes at most one Tap', () => {
  const p = make([tap('z-node', 0.25), tap('a-node', 0.25)]); start(p); edge(p, 'KeyA', 3000);
  verdict(p, 'a-node', 'Perfect', 3000); verdict(p, 'z-node', null); edge(p, 'KeyA', 3001); verdict(p, 'z-node', null);
  edge(p, 'KeyA', 3002, 'Up'); edge(p, 'KeyA', 3003); verdict(p, 'z-node', 'Perfect', 3003); assert.equal(p.getPerfectCount(), 2);
  return { lineID: snapshot(p).id, sameTargetMs: 3000, selectedFirst: 'a-node', repeatDownConsumed: false, freshDownSelected: 'z-node', multiLine: 'explicitly rejected by parser' };
});

test('Drag / Hold arrival checks are autonomous and do not consume the one Tap allowed for a Down', () => {
  const p = make([tap('tap-a', 0.25), tap('tap-b', 0.25), drag(), hold()]); start(p); edge(p, 'KeyA', 3000);
  verdict(p, 'drag', 'Perfect', 3000); verdict(p, 'tap-a', 'Perfect', 3000); verdict(p, 'tap-b', null); verdict(p, 'hold', null);
  assert.equal(node(p, 'hold').holdActive, true); assert.equal(p.getResolvedCount(), 2); p.advance(5000);
  verdict(p, 'hold', 'Perfect', 5000); verdict(p, 'tap-b', 'Miss', 3120); assert.equal(p.getPerfectCount(), 3); assert.equal(p.getMissCount(), 1);
  return { atSingleDownMs: 3000, autonomousDrag: 'Perfect', autonomousHold: 'active', oneTapConsumed: 'tap-a', otherTap: 'Miss', finalPerfect: 3, finalMiss: 1 };
});

test('Multiple autonomous arrivals crossed in one coarse frame resolve independently in event time order', () => {
  const p = make([drag('drag-1', 0.25), hold('hold-1', 0.25, 0.5), drag('drag-2', 0.375), hold('hold-2', 0.375, 0.625)]);
  start(p); edge(p, 'KeyA', 2999); p.advance(6500);
  verdict(p, 'drag-1', 'Perfect', 3000); verdict(p, 'drag-2', 'Perfect', 4000); verdict(p, 'hold-1', 'Perfect', 5000); verdict(p, 'hold-2', 'Perfect', 6000);
  assert.equal(p.getPerfectCount(), 4); assert.equal(p.getTotalScore(), 400); return { coarseFrameAtMs: 6500, resolvedTimesMs: [3000, 4000, 5000, 6000], perfect: 4 };
});

test('Pause with a held key freezes active Hold, progress, judgments and fade clock; resume can complete tail', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); p.togglePause(3500);
  const frozen = clone(snapshot(p)); p.advance(12000); edge(p, 'KeyB', 5000); p.advanceMediaStatus(true, true, 90000);
  assert.deepEqual(snapshot(p), frozen); assert.equal(p.getCurrentTimeMs(), 3500); verdict(p, 'hold', null);
  p.togglePause(3500); p.advance(5000); verdict(p, 'hold', 'Perfect', 5000); assert.equal(p.getState(), 'Playing');
  return { pausedAtMs: 3500, frozenHoldActive: true, wallTimeIgnoredMs: 90000, resumedTier: 'Perfect', tailAtMs: 5000 };
});

test('Paused Up only releases guard; resumed Hold remains pending to tail and re-press cannot repair interruption', () => {
  const p = make([hold()]); start(p); edge(p, 'KeyA', 2999); p.togglePause(3500); const frozen = clone(snapshot(p));
  edge(p, 'KeyA', 3500, 'Up'); assert.deepEqual(snapshot(p), frozen); assert.equal(p.getMissCount(), 0);
  edge(p, 'KeyA', 3500); assert.deepEqual(snapshot(p), frozen); p.togglePause(3500); p.advance(3500);
  verdict(p, 'hold', null); assert.equal(p.getMissCount(), 0); edge(p, 'KeyA', 3501); p.advance(4999); verdict(p, 'hold', null);
  p.advance(5000); verdict(p, 'hold', 'Miss', 5000); assert.equal(p.getMissCount(), 1); assert.equal(p.getPerfectCount(), 0);
  near(node(p, 'hold').disappearAtMs, 5000); return { pausedReleaseDidNotJudge: true, pendingOnResumeAtMs: 3500, finalMissAtMs: 5000, repressedDidNotRepair: true, fadeAtMs: 5000 };
});

test('Early media end plus failed Hold keeps full interval alive; Completed only at tail with one Miss', () => {
  const results = [];
  for (const mode of ['missing start', 'middle release']) {
    const p = make([hold()]); start(p); p.advanceMediaStatus(true, false, 1);
    if (mode === 'middle release') { edge(p, 'KeyA', 2999); p.advance(3000); edge(p, 'KeyA', 3500, 'Up'); }
    else p.advance(3500);
    p.advance(4999); verdict(p, 'hold', null); assert.equal(p.getMissCount(), 0); assert.equal(p.getResolvedCount(), 0);
    assert.equal(p.getState(), 'Playing'); assert.equal(p.getResult(), null); assert.equal(node(p, 'hold').holdActive, true);
    assert.ok(node(p, 'hold').holdRemainingPoints.length >= 2);
    p.advance(5000); verdict(p, 'hold', 'Miss', 5000); assert.equal(p.getState(), 'Completed'); assert.equal(p.getResult().finishedAtMs, 5000);
    assert.equal(p.getMissCount(), 1); assert.equal(p.getResolvedCount(), 1);
    results.push({ mode, mediaEndedBeforeStart: true, stillPlayingAtMs: 4999, resolvedAtMs: 5000, completedAtMs: 5000, missCount: 1 });
  }
  return results;
});

test('Autonomous simultaneous Hold tails sort feedback by node ID after time / distance / event rank', () => {
  const r = rawChart([hold('z-hold', 0.25, 0.5, 'KeyA'), hold('a-hold', 0.25, 0.5, 'KeyB')]);
  const runtime = new GuidanceLineRuntime(parseGuidanceChart(r, layout), layout);
  runtime.submitStrike({ keyId: 'Space', videoTimeMs: 1000 });
  runtime.submitStrike({ keyId: 'KeyA', videoTimeMs: 2999 }); runtime.submitStrike({ keyId: 'KeyB', videoTimeMs: 2999 });
  const judgements = runtime.advance(5000);
  assert.deepEqual(judgements.map(j => j.nodeId), ['a-hold', 'z-hold']);
  assert.ok(judgements.every(j => j.tier === 'Perfect' && j.videoTimeMs === 5000));
  assert.deepEqual(runtime.advance(5001), []);
  return { sharedTailAtMs: 5000, sharedDistance: 0.5, eventKind: 'Tail', feedbackOrder: judgements.map(j => j.nodeId), allPerfect: true };
});

test('Exit / reopen resets mixed node tiers, Hold active range, key guards, score, feedback and media end', () => {
  const p = make(); start(p); edge(p, 'KeyA', 2999); p.advance(3500); p.requestExit(3500);
  assert.equal(p.getResult().completed, false); assert.equal(snapshot(p).state, 'Exited'); p.reopen(); assert.equal(p.getState(), 'Ready');
  assert.equal(snapshot(p).startedAtMs, null); assert.equal(snapshot(p).judgmentPoint, null); assert.equal(p.getResolvedCount(), 0); assert.equal(p.getTotalScore(), 0); assert.equal(p.getResult(), null);
  assert.ok(snapshot(p).nodes.every(n => n.tier === null && n.resolvedAtMs === null && n.holdActive === false));
  assert.deepEqual(p.getJudgeFeedbackSince(0), { nextSeq: 0, items: [] }); p.begin(); start(p); edge(p, 'KeyA', 2999); edge(p, 'KeyB', 4000); p.advance(5000);
  assert.equal(p.getPerfectCount(), 3); assert.equal(p.getState(), 'Playing'); p.advanceMediaStatus(true, false, 1); assert.equal(p.getState(), 'Completed');
  p.reopen(); p.begin(); start(p); p.advance(10000); assert.equal(p.getState(), 'Playing'); return { resetNodeCount: 3, freshStartAndKeyEdges: true, staleMediaEndCleared: true };
});

test('All settled + media end and independent unavailable timeout preserve R26 B for mixed nodes', () => {
  const earlyEnd = make(); earlyEnd.advanceMediaStatus(true, false, 1); start(earlyEnd); edge(earlyEnd, 'KeyA', 2999); edge(earlyEnd, 'KeyB', 4000);
  assert.equal(earlyEnd.getState(), 'Playing'); earlyEnd.advance(5000); assert.equal(earlyEnd.getState(), 'Completed');
  const timeout = make(); start(timeout); timeout.advance(7000); assert.equal(timeout.getResolvedCount(), 3); assert.equal(timeout.getState(), 'Playing');
  timeout.advanceMediaStatus(false, true, CHART_MEDIA_END_TIMEOUT_MS - 1); assert.equal(timeout.getState(), 'Playing'); timeout.togglePause(7000); timeout.advanceMediaStatus(false, true, 60000); timeout.togglePause(7000);
  timeout.advanceMediaStatus(false, true, 1); assert.equal(timeout.getState(), 'Completed'); return { earlyEndWaitedUntilHoldTailMs: 5000, independentTimeoutMs: CHART_MEDIA_END_TIMEOUT_MS, pausedTimeoutExcludedMs: 60000 };
});

function directorFixture() {
  const p = make(); p.requestExit(0); p.reopen(); const director = new DirectorSession();
  const chain = new PuzzleChain(new PuzzleProgress()); let beat = 0, rhythm = null, mediaTime = -1, ended = false;
  director.bindProtagonist(new Protagonist({ lateral: 0, depth: 0 })); director.bindMapCenter({ lateral: 0, depth: 0 }); director.bindPuzzleChain(chain); director.bindDeepTrace(new DeepTrace({ lateral: 0, depth: 0 }));
  director.bindScreenProjectionProbe(() => ({ x: 0.5, y: 0.5 })); director.bindBeatClockProbe(() => beat); director.bindRhythmStrikeProbe(() => rhythm);
  director.bindChartPremiere(p); director.bindChartClockProbe(() => mediaTime); director.bindChartMediaProbe(() => ({ ended, unavailable: false })); director.submitFrameIntents([], 0.016);
  for (beat = 0; beat < 7000; beat += 1000) { rhythm = { strikeTimeMs: beat, targetBeatTimeMs: beat }; director.submitFrameIntents([{ kind: 'Strike', videoTimeMs: beat }], 0.016); }
  director.submitFrameIntents([], 0.016); assert.equal(director.getLedgerEvents().length, 1);
  const frame = (time, intents = []) => { mediaTime = time; director.submitFrameIntents(intents, 0.016); };
  return { p, director, frame, setMediaTime: time => { mediaTime = time; }, setEnded: value => { ended = value; } };
}

test('Director T6 entrance + mixed premiere: early exit writes none, reentry retains endpoint, media completion appends once', () => {
  const { p, director, frame, setEnded } = directorFixture(); frame(0, [{ kind: 'EnterChart' }]); frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  frame(2999, [{ kind: 'Strike', keyId: 'KeyA', videoTimeMs: 2999 }]); frame(3500, [{ kind: 'ExitChart' }]);
  assert.equal(director.getLedgerEvents().length, 1); assert.equal(p.getResult().completed, false); assert.equal(director.isWorldMotionGated(), false);
  frame(-1, [{ kind: 'EnterChart' }]); assert.equal(p.getResolvedCount(), 0); assert.equal(director.getLedgerEvents().length, 1);
  frame(0); frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]); frame(2999, [{ kind: 'Strike', keyId: 'KeyA', videoTimeMs: 2999 }]); frame(4000, [{ kind: 'Strike', keyId: 'KeyB', videoTimeMs: 4000 }]); frame(5000);
  assert.equal(p.getPerfectCount(), 3); assert.equal(director.getLedgerEvents().length, 1); frame(10000); assert.equal(p.getState(), 'Playing');
  setEnded(true); frame(12000); assert.equal(p.getState(), 'Exited'); assert.equal(p.getResult().completed, true); assert.equal(director.getLedgerEvents().length, 2); assert.equal(director.isWorldMotionGated(), false);
  frame(12000); frame(0, [{ kind: 'EnterChart' }]); assert.equal(director.getLedgerEvents().length, 2);
  return { endpointRecords: 1, middleExitCompletionRecords: 0, completionRecords: 1, totalLedger: 2, mixedPerfectCount: 3 };
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

test('Real InputCollector / FrameDriver delivers cross-frame Down / Up timestamps before later Drag / Hold logic advance', () => withCocosEventStub(({ InputCollector, FrameDriver, input }) => {
  const { p, director, frame, setMediaTime } = directorFixture(); frame(0, [{ kind: 'EnterChart' }]); frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  let eventTime = 2999; const collector = new InputCollector(); collector.bindChartStateProvider(() => director.getChartPlaybackState()); collector.bindChartTimeProbe(() => eventTime); collector.onEnable();
  const driver = new FrameDriver(); driver.onLoad(); driver.bindWiring(collector, director); const reads = []; driver.addRefreshable({ onFrameRefresh: () => reads.push({ timeMs: p.getCurrentTimeMs(), dragTier: node(p, 'drag').tier, holdTier: node(p, 'hold').tier }) });
  try { input.emit('down', 65); eventTime = 3001; input.emit('up', 65); setMediaTime(3500); driver.update(0.016);
    verdict(p, 'drag', 'Perfect', 3000); verdict(p, 'hold', null); assert.equal(reads[0].dragTier, 'Perfect'); assert.equal(reads[0].holdTier, null);
    setMediaTime(5000); driver.update(0.016); verdict(p, 'hold', 'Miss', 5000); assert.equal(reads[1].holdTier, 'Miss');
    return { inputDownAtMs: 2999, inputUpAtMs: 3001, rendererAtMs: 3500, dragTier: 'Perfect', holdInterruptedAtMs: 3001, holdResolvedAtMs: 5000, firstRefresh: reads[0], tailRefresh: reads[1] };
  } finally { collector.onDisable(); driver.onDestroy(); }
}));

function sceneBuilderProbe() {
  const filename = path.join(__dirname, '../../assets/scripts/SceneBuilder.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sceneClass = ast.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === 'SceneBuilder');
  assert.ok(sceneClass, '真实 SceneBuilder class');
  const names = ['update', 'readVideoTimeMs', 'onFrameRefresh', 'teardownChart'];
  const methods = names.map(name => {
    const method = sceneClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(ast) === name);
    assert.ok(method?.body, `完整真实 ${name} method`);
    return method.getText(ast);
  });
  const constantNames = ['FOV_PER_VIEW_DISTANCE', 'ROUTE_BAND_START', 'ROUTE_BAND_END', 'ROUTE_MAX_ANGLE', 'CLEAR_FLAGS_DEPTH_ONLY'];
  const declarations = ast.statements.filter(statement => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(declaration => constantNames.includes(declaration.name.getText(ast))));
  assert.equal(declarations.length, constantNames.length);
  const program = declarations.map(statement => statement.getText(ast)).join('\n') +
    '\nclass Probe { ensureChartPremiere() {} startChartVideo() {}\n' + methods.join('\n') + '\n}\nglobalThis.Probe = Probe;';
  const sandbox = { UITransform: class {}, Camera: { ClearFlag: { DEPTH_ONLY: 1 } }, CHART_MEDIA_END_TIMEOUT_MS };
  require('vm').runInNewContext(ts.transpileModule(program, { compilerOptions: { target: ts.ScriptTarget.ES2015 } }).outputText, sandbox, { filename: 'SceneBuilder.real-methods.probe.js' });
  return { probe: new sandbox.Probe(), extractedMethods: names };
}

test('Real SceneBuilder methods continue failed Hold after native ended clock stops; pause excludes wall time and exit / reentry reset fallback', () => {
  const { director } = directorFixture();
  const p = make([hold()]); p.requestExit(0); p.reopen(); director.bindChartPremiere(p);
  const { probe, extractedMethods } = sceneBuilderProbe();
  let nativeTimeMs = 0, ended = false, resets = 0;
  const transform = { width: 1920, height: 1080, setContentSize() {} };
  const player = { node: { getComponent: () => transform }, enabled: true, isPlaying: true, currentTime: 0,
    pause() { this.isPlaying = false; }, resume() { this.isPlaying = true; }, stop() { this.isPlaying = false; } };
  Object.assign(probe, {
    graph: { session: director, protagonist: { getPosition: () => ({ lateral: 0, depth: 0 }) } },
    cameraRig: { getViewDistance: () => 10, rotateAlongRoute() {} }, camera3D: null,
    node: { getComponent: () => transform, parent: null }, chartPremiere: p,
    chartEntered: true, chartFallbackTimeMs: -1, chartMediaUnavailableElapsedMs: 0, lastChartState: 'Playing',
    chartLayerNode: null, chartPadView: null, pausePanel: null, videoPlayer: player, debugLabelNode: null,
    puzzleLabel: null, puzzleProgress: null, bgmReady: false, proximityVolume: null, deepTrace: null,
    worldRootNode: null, uiCamera: null,
    audioOutputClock: { hasChartMediaEnded: () => ended, isChartMediaUnavailable: () => false,
      readChartTimeMs: () => nativeTimeMs, resetChart: () => { resets += 1; } },
  });
  director.bindChartClockProbe(() => probe.readVideoTimeMs());
  director.bindChartMediaProbe(() => ({ ended, unavailable: false }));
  const loop = (dt, intents = []) => { probe.update(dt); director.submitFrameIntents(intents, dt); probe.onFrameRefresh(); };
  loop(0, [{ kind: 'EnterChart' }]); nativeTimeMs = 1000;
  loop(0, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  nativeTimeMs = 4000; ended = true; loop(0);
  verdict(p, 'hold', null); assert.equal(p.getState(), 'Playing');
  loop(0.1); loop(0.1); loop(0.1); loop(0.1); loop(0.1);
  near(p.getCurrentTimeMs(), 4500); near(probe.chartFallbackTimeMs, 4500);
  loop(0, [{ kind: 'ExitChart' }]); assert.equal(probe.chartEntered, false); assert.equal(probe.chartFallbackTimeMs, -1); assert.equal(probe.readVideoTimeMs(), -1);
  assert.equal(director.getLedgerEvents().length, 1);
  nativeTimeMs = 0; ended = false; loop(0, [{ kind: 'EnterChart' }]);
  assert.equal(probe.chartEntered, true); assert.equal(probe.chartFallbackTimeMs, -1); assert.equal(probe.readVideoTimeMs(), 0);
  assert.equal(snapshot(p).startedAtMs, null); assert.equal(p.getResolvedCount(), 0);
  loop(0); assert.equal(p.getState(), 'Playing'); // 实际媒体起播后的下一 director 帧执行 Ready -> Playing。
  nativeTimeMs = 1000; loop(0, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  nativeTimeMs = 4000; ended = true; loop(0);
  loop(0, [{ kind: 'ToggleChartPause', videoTimeMs: 4000 }]); assert.equal(p.getState(), 'Paused');
  const frozen = clone(snapshot(p)); const fallbackBeforePause = probe.chartFallbackTimeMs;
  loop(1); assert.deepEqual(snapshot(p), frozen); assert.equal(probe.chartFallbackTimeMs, fallbackBeforePause);
  assert.equal(probe.readVideoTimeMs(), 4000); assert.equal(director.getLedgerEvents().length, 1);
  loop(0, [{ kind: 'ToggleChartPause', videoTimeMs: 4000 }]);
  const samples = [];
  for (let frame = 1; frame <= 10; frame += 1) {
    loop(0.1); samples.push({ frame, nativeTimeMs, logicalTimeMs: p.getCurrentTimeMs(), state: p.getState(), holdTier: node(p, 'hold').tier });
    if (frame < 10) { assert.equal(p.getState(), 'Playing'); verdict(p, 'hold', null); }
  }
  verdict(p, 'hold', 'Miss', 5000); assert.equal(p.getState(), 'Exited'); assert.equal(p.getResult().completed, true); assert.equal(p.getResult().finishedAtMs, 5000);
  assert.equal(director.getLedgerEvents().filter(event => event.eventId === 'T7_COMPLETION_PLACEHOLDER').length, 1);
  assert.equal(probe.chartFallbackTimeMs, -1); assert.equal(probe.chartEntered, false);
  loop(0.1); assert.equal(director.getLedgerEvents().length, 2);
  return { extractedMethods, completeMethodsExecuted: true, mediaControls: 'stub native player and graphical nodes; no chart logic replacement',
    frozenNativeClockMs: 4000, pausedWallDurationMs: 1000, partialExitFallbackCleared: true, reentryStartedFromMs: 0,
    samples, holdFinalizedAtMs: 5000, completionRecords: 1, realTeardownResetCalls: resets };
});

test('Actual B resource loads independently and preserves default 47-key half-open grid resolution', () => {
  const resource = path.join(__dirname, '../../assets/resources/chart/guidance_b.json'); assert.ok(fs.existsSync(resource), '独立 B 谱面资源');
  const usedLayout = createDefaultKeyboardPadLayout(), r = JSON.parse(fs.readFileSync(resource, 'utf8').replace(/^\uFEFF/, ''));
  const parsed = parseGuidanceChart(r, usedLayout); const kinds = new Set(parsed.lines[0].nodes.map(n => n.kind)); assert.ok(kinds.has('Tap') && kinds.has('Drag') && kinds.has('Hold'));
  assert.equal(usedLayout.slots.length, 47); for (const slot of usedLayout.slots) assert.equal(resolveGridKeyAt(usedLayout, { u: slot.u, v: slot.v }), slot.keyId === 'Space' ? null : slot.keyId);
  return { chartId: parsed.chartId, nodeCount: parsed.lines[0].nodes.length, kinds: [...kinds], layoutSlots: 47 };
});

const report = { task: 'Guidance B: single Polyline, mixed Tap / Drag / Hold', headWindowMs: HEAD_WINDOW_MS, generatedAt: new Date().toISOString(), command: 'node quality-review/guidance-editor/b-regression.cjs',
  coverage: '公开 chart/director API；真实采集器/帧驱动使用仅事件总线 cc stub，Creator 视觉验收另行提供。旧 B 单线回归，lineID 排序层在本范围恒等。',
  passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks };
fs.mkdirSync(__dirname, { recursive: true }); fs.writeFileSync(path.join(__dirname, 'b-regression-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (report.failed > 0) process.exitCode = 1;
