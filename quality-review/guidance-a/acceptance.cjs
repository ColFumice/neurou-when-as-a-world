// A 步行为验收。仅消费公开 chart/director API；不依赖 Cocos 或渲染帧。
// 运行：node quality-review/guidance-a/acceptance.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ts = require('../../node_modules/typescript');

// 与既有 quality-review/r26/regression.cjs 相同的 TS require hook。
require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 },
  }).outputText,
  filename,
);

const { ChartPremiere, CHART_MEDIA_END_TIMEOUT_MS } = require('../../src/chart/ChartPremiere.ts');
const { parseGuidanceChart } = require('../../src/chart/GuidanceChart.ts');
const { createDefaultKeyboardPadLayout, resolveGridKeyAt } = require('../../src/chart/KeyboardPadLayout.ts');
const { HEAD_WINDOW_MS, PERFECT_WINDOW_MS, GOOD_WINDOW_MS } = require('../../constants/index.ts');
const { DirectorSession } = require('../../src/director/IntentPort.ts');
const { Protagonist } = require('../../src/character/Protagonist.ts');
const { DeepTrace } = require('../../src/trace/DeepTrace.ts');
const { PuzzleChain } = require('../../src/trace/PuzzleChain.ts');
const { PuzzleProgress } = require('../../src/trace/PuzzleProgress.ts');

const checks = [];
function test(name, run) {
  try {
    const evidence = run();
    checks.push({ name, pass: true, evidence: evidence ?? null });
  } catch (error) {
    checks.push({ name, pass: false, error: error.stack ?? String(error) });
  }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected} ± ${epsilon}`);
}

// 合法的相邻半开网格：共享边界 u=.5 唯一归 KeyB。
// 同一 Tap 的窗口 [4880,5120] 会穿过 KeyA → KeyB，静态节点键无法通过。
const layout = {
  layoutVersion: 'guidance-acceptance-1',
  slots: [
    { keyId: 'KeyA', padKind: 'Regular', u: 0, v: 0.4, width: 0.5, height: 0.2 },
    { keyId: 'KeyB', padKind: 'Regular', u: 0.5, v: 0.4, width: 0.5, height: 0.2 },
    { keyId: 'Space', padKind: 'Heavy', u: 0.25, v: 0.05, width: 0.5, height: 0.15 },
  ],
};
function rawChart(overrides = {}) {
  return {
    schemaVersion: 1,
    chartId: 'GUIDANCE_A_ACCEPTANCE',
    tier: 'Regular',
    layoutVersion: layout.layoutVersion,
    aspectRatio: 1,
    lines: [{
      id: 'line-a', head: { id: 'head-a', spawnTimeMs: 1000 },
      path: { kind: 'Polyline', points: [{ u: 0.1, v: 0.5 }, { u: 0.9, v: 0.5 }] },
      speed: 0.1,
      nodes: [{ id: 'tap-a', kind: 'Tap', pathDistance: 0.4 }],
    }],
    ...overrides,
  };
}
function make(raw = rawChart(), usedLayout = layout) {
  const chart = parseGuidanceChart(raw, usedLayout);
  const premiere = new ChartPremiere(chart, usedLayout);
  premiere.begin();
  return premiere;
}
function strike(premiere, keyId, videoTimeMs, phase = 'Down') {
  premiere.submitStrike({ keyId, videoTimeMs, phase });
}
function start(premiere, timeMs = 1000) {
  strike(premiere, 'Space', timeMs);
  assert.equal(snapshot(premiere).state, 'Running');
  assert.equal(snapshot(premiere).startedAtMs, timeMs);
}
function snapshot(premiere) {
  const value = premiere.getGuidanceSnapshot();
  assert.ok(value, 'GuidanceChart must expose a guidance snapshot');
  return value;
}
function nodeSnapshot(premiere) { return snapshot(premiere).nodes[0]; }
function assertUnresolved(premiere) {
  assert.equal(premiere.getResolvedCount(), 0);
  assert.equal(nodeSnapshot(premiere).tier, null);
}

test('A scope: schema, exactly one line / one Tap / one straight segment', () => {
  const parsed = parseGuidanceChart(rawChart(), layout);
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.lines[0].nodes.length, 1);
  const cases = [
    ['unsupported schema', chart => { chart.schemaVersion = 2; }],
    ['missing schema', chart => { delete chart.schemaVersion; }],
    ['no line', chart => { chart.lines = []; }],
    ['multiple lines', chart => { chart.lines.push({ ...clone(chart.lines[0]), id: 'line-b' }); }],
    ['Drag', chart => { chart.lines[0].nodes[0].kind = 'Drag'; chart.lines[0].nodes[0].keyId = 'KeyA'; }],
    ['Hold', chart => { chart.lines[0].nodes[0].kind = 'Hold'; chart.lines[0].nodes[0].keyId = 'KeyA'; chart.lines[0].nodes[0].endPathDistance = 0.6; }],
    ['Tap keyId', chart => { chart.lines[0].nodes[0].keyId = 'KeyA'; }],
    ['defaultKey', chart => { chart.lines[0].nodes[0].defaultKey = 'KeyA'; }],
    ['fallbackKey', chart => { chart.lines[0].nodes[0].fallbackKey = 'KeyA'; }],
    ['no Tap', chart => { chart.lines[0].nodes = []; }],
    ['two Taps', chart => { chart.lines[0].nodes.push({ id: 'tap-b', kind: 'Tap', pathDistance: 0.6 }); }],
    ['three path points', chart => { chart.lines[0].path.points.splice(1, 0, { u: 0.5, v: 0.5 }); }],
    ['unsupported path kind', chart => { chart.lines[0].path.kind = 'Bezier'; }],
  ];
  for (const [name, mutate] of cases) {
    const raw = rawChart(); mutate(raw);
    assert.throws(() => parseGuidanceChart(raw, layout), undefined, name);
    // 直接构造也不可绕过资源加载校验。
    assert.throws(() => new ChartPremiere(raw, layout), undefined, `constructor: ${name}`);
  }
  return { rejected: cases.map(([name]) => name) };
});

test('Validation: layoutVersion, finite positive aspect/speed, normalized path, node distance and IDs', () => {
  const cases = [
    ['layout mismatch', chart => { chart.layoutVersion = 'other'; }],
    ['empty chartId', chart => { chart.chartId = ''; }],
    ['invalid tier', chart => { chart.tier = 'Unknown'; }],
    ['zero aspectRatio', chart => { chart.aspectRatio = 0; }],
    ['nonfinite aspectRatio', chart => { chart.aspectRatio = Infinity; }],
    ['negative speed', chart => { chart.lines[0].speed = -1; }],
    ['zero speed', chart => { chart.lines[0].speed = 0; }],
    ['nonfinite speed', chart => { chart.lines[0].speed = NaN; }],
    ['negative spawn', chart => { chart.lines[0].head.spawnTimeMs = -1; }],
    ['nonfinite spawn', chart => { chart.lines[0].head.spawnTimeMs = Infinity; }],
    ['empty line ID', chart => { chart.lines[0].id = ''; }],
    ['empty head ID', chart => { chart.lines[0].head.id = ''; }],
    ['empty node ID', chart => { chart.lines[0].nodes[0].id = ''; }],
    ['duplicate node ID', chart => { chart.lines[0].nodes[0].id = chart.lines[0].head.id; }],
    ['negative node distance', chart => { chart.lines[0].nodes[0].pathDistance = -0.01; }],
    ['node beyond path', chart => { chart.lines[0].nodes[0].pathDistance = 0.81; }],
    ['nonfinite node distance', chart => { chart.lines[0].nodes[0].pathDistance = NaN; }],
    ['coincident path points', chart => { chart.lines[0].path.points[1] = clone(chart.lines[0].path.points[0]); }],
    ['path outside [0,1]', chart => { chart.lines[0].path.points[1].u = 1.01; }],
    ['nonfinite path coordinate', chart => { chart.lines[0].path.points[0].v = NaN; }],
  ];
  for (const [name, mutate] of cases) {
    const raw = rawChart(); mutate(raw);
    assert.throws(() => parseGuidanceChart(raw, layout), undefined, name);
  }
  return { rejected: cases.map(([name]) => name) };
});

test('Grid resolver: deterministic half-open ownership, gaps / outside / Space return null', () => {
  assert.equal(resolveGridKeyAt(layout, { u: 0, v: 0.4 }), 'KeyA');
  assert.equal(resolveGridKeyAt(layout, { u: 0.5 - 1e-10, v: 0.5 }), 'KeyA');
  assert.equal(resolveGridKeyAt(layout, { u: 0.5, v: 0.5 }), 'KeyB');
  assert.equal(resolveGridKeyAt(layout, { u: 1, v: 0.5 }), null);
  assert.equal(resolveGridKeyAt(layout, { u: 0.25, v: 0.4 + 0.2 }), null);
  for (const position of [
    { u: 0.5, v: 0.3 }, { u: 0.5, v: 0.1 }, { u: -0.001, v: 0.5 },
    { u: 1.001, v: 0.5 }, { u: 0.5, v: -0.001 }, { u: 0.5, v: 1.001 },
    { u: NaN, v: 0.5 }, { u: 0.5, v: Infinity },
  ]) assert.equal(resolveGridKeyAt(layout, position), null, JSON.stringify(position));
  const defaultLayout = createDefaultKeyboardPadLayout();
  assert.equal(defaultLayout.slots.length, 48, '完整 48 键打击垫保留');
  for (const slot of defaultLayout.slots) {
    const center = { u: slot.u + slot.width / 2, v: slot.v + slot.height / 2 };
    assert.equal(resolveGridKeyAt(defaultLayout, center), slot.keyId === 'Space' ? null : slot.keyId);
    assert.equal(resolveGridKeyAt(defaultLayout, { u: slot.u, v: slot.v }),
      slot.keyId === 'Space' ? null : slot.keyId, `default layout left-bottom edge: ${slot.keyId}`);
    assert.equal(resolveGridKeyAt(defaultLayout, { u: slot.u, v: center.v }),
      slot.keyId === 'Space' ? null : slot.keyId, `default layout shared horizontal edge: ${slot.keyId}`);
  }
  return { beforeBoundary: 'KeyA', atBoundary: 'KeyB', retainedPadSlots: 48 };
});

test('Head spawn at media timestamp; inclusive 1000ms window; Head never scores', () => {
  assert.equal(HEAD_WINDOW_MS, 1000);
  const spawnTimeMs = rawChart().lines[0].head.spawnTimeMs;
  const traces = [];
  for (const offset of [0, 100, 999, HEAD_WINDOW_MS]) {
    const p = make();
    assert.equal(snapshot(p).state, 'Pending');
    p.advance(spawnTimeMs - 1); assert.equal(snapshot(p).state, 'Pending');
    p.advance(spawnTimeMs); assert.equal(snapshot(p).state, 'Waiting');
    start(p, spawnTimeMs + offset);
    assert.equal(p.getTotalNoteCount(), 1);
    assert.equal(p.getResolvedCount(), 0);
    assert.equal(p.getTotalScore(), 0);
    assert.equal(p.getPerfectCount() + p.getGoodCount() + p.getMissCount(), 0);
    traces.push({ spawnTimeMs, offsetMs: offset, inputTimeMs: spawnTimeMs + offset, startedAtMs: snapshot(p).startedAtMs });
  }
  return traces;
});

test('Head timeout strictly after endpoint terminates Tap once; late Space cannot revive', () => {
  const p = make();
  const spawnTimeMs = snapshot(p).head.spawnTimeMs;
  const endpointMs = spawnTimeMs + HEAD_WINDOW_MS;
  p.advance(endpointMs); assert.equal(snapshot(p).state, 'Waiting'); assertUnresolved(p);
  p.advance(endpointMs + 0.001); assert.equal(snapshot(p).state, 'TimedOut');
  assert.equal(p.getResolvedCount(), 1); assert.equal(p.getMissCount(), 1);
  assert.equal(nodeSnapshot(p).tier, 'Miss');
  strike(p, 'Space', endpointMs + 1); strike(p, 'Space', endpointMs + 100, 'Up'); strike(p, 'Space', endpointMs + 101);
  p.advance(12000); assert.equal(snapshot(p).state, 'TimedOut');
  assert.equal(snapshot(p).startedAtMs, null); assert.equal(p.getMissCount(), 1);
  assert.equal(p.getState(), 'Playing');
  p.advanceMediaStatus(true, false, 1); assert.equal(p.getState(), 'Completed');
  return { spawnTimeMs, windowMs: HEAD_WINDOW_MS, endpointMs, closedAtMs: endpointMs + 0.001, descendantMisses: 1, completesOnlyAfterMediaEnd: true };
});

test('Pre-held Space, duplicate Down, wrong Head key and new edge after release', () => {
  const p = make();
  strike(p, 'Space', 999); p.advance(1000);
  strike(p, 'Space', 1000); assert.equal(snapshot(p).state, 'Waiting');
  strike(p, 'KeyA', 1010); assert.equal(snapshot(p).state, 'Waiting');
  strike(p, 'Space', 1020, 'Up'); start(p, 1021);
  strike(p, 'Space', 1050); strike(p, 'Space', 1060, 'Up'); strike(p, 'Space', 1061);
  assert.equal(snapshot(p).startedAtMs, 1021);
  assert.equal(p.getTotalScore(), 0); assert.equal(p.getResolvedCount(), 0);
  const missing = make(); strike(missing, 'KeyA', 1000); missing.advance(snapshot(missing).head.spawnTimeMs + HEAD_WINDOW_MS + 1);
  assert.equal(snapshot(missing).state, 'TimedOut'); assert.equal(missing.getMissCount(), 1);
  return { preHeldIgnored: true, newEdgeAtMs: 1021, repeatedSpaceDidNotRestart: true, wrongOrMissingSpace: 'TimedOut' };
});

test('Arc length is uniform in media time, aspectRatio participates, erase begins at logical point', () => {
  const raw = rawChart(); raw.aspectRatio = 16 / 9;
  const line = raw.lines[0];
  line.path.points = [{ u: 0.1, v: 0.45 }, { u: 0.8, v: 0.55 }];
  const pathLength = Math.hypot(0.7 * raw.aspectRatio, 0.1);
  line.speed = pathLength / 10; line.nodes[0].pathDistance = pathLength * 0.8;
  const p = make(raw); start(p);
  const samples = [1000, 2000, 3000, 4000].map(timeMs => {
    p.advance(timeMs); const s = snapshot(p);
    near(s.judgmentPoint.pathDistance, line.speed * (timeMs - 1000) / 1000);
    assert.deepEqual(s.remainingPoints[0], s.judgmentPoint.position);
    assert.deepEqual(s.remainingPoints[s.remainingPoints.length - 1], line.path.points[1]);
    return { timeMs, pathDistance: s.judgmentPoint.pathDistance, position: clone(s.judgmentPoint.position) };
  });
  for (let i = 1; i < samples.length; i++) {
    near(samples[i].pathDistance - samples[i - 1].pathDistance, line.speed);
    const a = samples[i - 1].position, b = samples[i].position;
    near(Math.hypot((b.u - a.u) * raw.aspectRatio, b.v - a.v), line.speed);
  }
  p.advance(11000); near(snapshot(p).judgmentPoint.pathDistance, pathLength);
  return { aspectRatio: raw.aspectRatio, speed: line.speed, pathLength, samples };
});

test('Tap resolves input-timestamp position before / exactly at / after a shared non-Space boundary', () => {
  const cases = [[4999, 'KeyA'], [5000, 'KeyB'], [5001, 'KeyB']];
  const evidence = [];
  for (const [inputTimeMs, keyId] of cases) {
    const p = make(); start(p);
    // 先推进至更晚渲染时刻，防止实现误用 currentTime 而非输入时间戳。
    p.advance(5010);
    strike(p, keyId, inputTimeMs);
    assert.equal(p.getResolvedCount(), 1); assert.equal(p.getPerfectCount(), 1);
    assert.equal(nodeSnapshot(p).resolvedAtMs, inputTimeMs);
    evidence.push({ inputTimeMs, expectedKey: keyId, tier: nodeSnapshot(p).tier });
  }
  for (const [inputTimeMs, wrongKey] of [[4999, 'KeyB'], [5001, 'KeyA']]) {
    const p = make(); start(p); strike(p, wrongKey, inputTimeMs); assertUnresolved(p);
    p.advance(5121); assert.equal(p.getMissCount(), 1); assert.equal(p.getResolvedCount(), 1);
  }
  // 实际 A 步资源也在同一 Tap 窗口内跨过默认打击垫 KeyG / KeyH 边界。
  const resourcePath = 'assets/resources/chart/guidance_a.json';
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../', resourcePath), 'utf8').replace(/^\uFEFF/, ''));
  const usedLayout = createDefaultKeyboardPadLayout();
  const line = raw.lines[0];
  const startedAtMs = line.head.spawnTimeMs;
  const targetTimeMs = startedAtMs + line.nodes[0].pathDistance / line.speed * 1000;
  const boundaryU = usedLayout.slots.find(slot => slot.keyId === 'KeyH').u;
  const v = line.path.points[0].v;
  assert.equal(line.path.points[1].v, v, '实际 A 步资源为水平直线');
  const boundaryDistance = (boundaryU - line.path.points[0].u) * raw.aspectRatio;
  const boundaryTimeMs = startedAtMs + boundaryDistance / line.speed * 1000;
  assert.equal(resolveGridKeyAt(usedLayout, { u: boundaryU, v }), 'KeyH');
  assert.equal(resolveGridKeyAt(usedLayout, { u: boundaryU - 1e-9, v }), 'KeyG');
  const resourceCases = [];
  for (const [offsetMs, expectedKey, wrongKey] of [[-1, 'KeyG', 'KeyH'], [1, 'KeyH', 'KeyG']]) {
    const inputTimeMs = boundaryTimeMs + offsetMs;
    const targetDeltaMs = inputTimeMs - targetTimeMs;
    assert.ok(Math.abs(targetDeltaMs) <= GOOD_WINDOW_MS && Math.abs(targetDeltaMs) > PERFECT_WINDOW_MS);
    const p = make(raw, usedLayout); start(p, startedAtMs);
    strike(p, wrongKey, inputTimeMs); assertUnresolved(p);
    assert.equal(p.getTotalScore(), 0); assert.equal(p.getMissCount(), 0);
    assert.equal(resolveGridKeyAt(usedLayout, snapshot(p).judgmentPoint.position), expectedKey);
    strike(p, wrongKey, inputTimeMs, 'Up'); strike(p, expectedKey, inputTimeMs);
    assert.equal(nodeSnapshot(p).tier, 'Good'); assert.equal(nodeSnapshot(p).resolvedAtMs, inputTimeMs);
    assert.equal(p.getGoodCount(), 1); assert.equal(p.getResolvedCount(), 1); assert.equal(p.getMissCount(), 0);
    resourceCases.push({
      inputTimeMs, targetDeltaMs, boundaryOffsetMs: offsetMs, expectedKey, wrongKey,
      wrongKeyConsumed: false, releaseThenCorrectKey: true, tier: nodeSnapshot(p).tier,
      inputPosition: clone(snapshot(p).judgmentPoint.position),
    });
  }
  return {
    syntheticLayout: evidence,
    actualResource: {
      source: resourcePath, chartId: raw.chartId, layoutVersion: usedLayout.layoutVersion,
      startedAtMs, targetTimeMs, tapPosition: { u: 0.5, v },
      boundaryU, boundaryTimeMs, atBoundaryKey: 'KeyH', cases: resourceCases,
    },
  };
});

test('Tap in gap / Space has no default or nearest-key fallback', () => {
  const gapLayout = clone(layout);
  gapLayout.slots[0].width = 0.49; gapLayout.slots[1].u = 0.51; gapLayout.slots[1].width = 0.49;
  const gap = make(rawChart(), gapLayout); start(gap);
  strike(gap, 'KeyA', 5000); strike(gap, 'KeyB', 5000); assertUnresolved(gap);
  gap.advance(5121); assert.equal(gap.getMissCount(), 1);
  const raw = rawChart(); raw.lines[0].path.points.forEach(point => { point.v = 0.1; });
  const space = make(raw); start(space); strike(space, 'Space', 1100, 'Up');
  strike(space, 'Space', 5000); strike(space, 'KeyA', 5000); assertUnresolved(space);
  space.advance(5121); assert.equal(space.getMissCount(), 1);
  return { gapTap: 'Miss', spaceTap: 'Miss', fallback: null };
});

test('Erased endpoint Tap remains judgeable until its inclusive Good deadline', () => {
  const raw = rawChart(); raw.lines[0].nodes[0].pathDistance = 0.8;
  const p = make(raw); start(p); p.advance(9001);
  assert.deepEqual(snapshot(p).remainingPoints, []); assertUnresolved(p);
  near(snapshot(p).judgmentPoint.pathDistance, 0.8);
  strike(p, 'KeyB', 9120);
  assert.equal(nodeSnapshot(p).tier, 'Good'); assert.equal(p.getGoodCount(), 1);
  assert.equal(snapshot(p).state, 'Finished'); assert.equal(p.getState(), 'Playing');
  return { lineErasedAtMs: 9001, judgmentAcceptedAtMs: 9120, tier: 'Good', noEarlyMediaCompletion: true };
});

test('Perfect / Good inclusive boundaries and late Miss; each Tap scores once', () => {
  const cases = [
    [-GOOD_WINDOW_MS, 'KeyA', 'Good'], [-PERFECT_WINDOW_MS - 1, 'KeyA', 'Good'],
    [-PERFECT_WINDOW_MS, 'KeyA', 'Perfect'], [0, 'KeyB', 'Perfect'],
    [PERFECT_WINDOW_MS, 'KeyB', 'Perfect'], [PERFECT_WINDOW_MS + 1, 'KeyB', 'Good'],
    [GOOD_WINDOW_MS, 'KeyB', 'Good'],
  ];
  for (const [offset, keyId, tier] of cases) {
    const p = make(); start(p); strike(p, keyId, 5000 + offset);
    assert.equal(nodeSnapshot(p).tier, tier, `offset=${offset}`); assert.equal(p.getResolvedCount(), 1);
    const score = p.getTotalScore(); strike(p, keyId, 5000 + offset + 0.1);
    strike(p, keyId, 5000 + offset + 0.2, 'Up'); strike(p, keyId, 5000 + offset + 0.3);
    p.advance(12000);
    assert.equal(p.getTotalScore(), score); assert.equal(p.getMissCount(), 0);
    assert.equal(p.getPerfectCount() + p.getGoodCount(), 1);
  }
  const early = make(); start(early); strike(early, 'KeyA', 4879); assertUnresolved(early);
  const late = make(); start(late); late.advance(5120); assertUnresolved(late);
  strike(late, 'KeyB', 5121); late.advance(5122);
  assert.equal(late.getMissCount(), 1); assert.equal(late.getResolvedCount(), 1);
  return { cases: cases.map(([offsetMs, keyId, tier]) => ({ offsetMs, keyId, tier })), missedAtMs: 5121 };
});

test('10000ms Tap already judged still Playing until actual media end at 12000ms (R26 B)', () => {
  const raw = rawChart(); const line = raw.lines[0];
  line.speed = 0.08; line.nodes[0].pathDistance = 0.72;
  const p = make(raw); start(p); strike(p, 'KeyB', 10000);
  assert.equal(p.getResolvedCount(), 1); assert.equal(p.getState(), 'Playing'); assert.equal(p.getResult(), null);
  p.advance(11999); p.advanceMediaStatus(false, false, 1999); assert.equal(p.getState(), 'Playing');
  p.advance(12000); p.advanceMediaStatus(true, false, 1);
  assert.equal(p.getState(), 'Completed'); assert.equal(p.getResult().finishedAtMs, 12000);
  assert.equal(p.getResult().completed, true);
  return { resolvedAtMs: 10000, stillPlayingAtMs: 11999, finishedAtMs: p.getResult().finishedAtMs };
});

test('Media ending before Head / Tap resolution waits for final judgment', () => {
  const p = make(); p.advance(900); p.advanceMediaStatus(true, false, 1);
  assert.equal(p.getState(), 'Playing'); start(p); strike(p, 'KeyB', 5000);
  assert.equal(p.getState(), 'Completed'); assert.equal(p.getResult().finishedAtMs, 5000);
  return { earlyMediaEndAtMs: 900, completeAfterTapAtMs: 5000 };
});

test('Pause freezes path, judgment, media end and independent timeout; resume uses media time', () => {
  const p = make(); start(p); p.togglePause(2000);
  const frozen = clone(snapshot(p)); const time = p.getCurrentTimeMs();
  assert.equal(p.getState(), 'Paused');
  p.advance(20000); strike(p, 'KeyB', 5000); strike(p, 'KeyB', 5001, 'Up');
  p.advanceMediaStatus(true, true, 90000);
  assert.deepEqual(snapshot(p), frozen); assert.equal(p.getCurrentTimeMs(), time); assertUnresolved(p);
  p.togglePause(2000); assert.equal(p.getState(), 'Playing'); p.advance(2500);
  near(snapshot(p).judgmentPoint.pathDistance, 0.15);
  strike(p, 'KeyB', 5000); assert.equal(p.getPerfectCount(), 1); assert.equal(p.getState(), 'Playing');
  p.advanceMediaStatus(true, false, 1); assert.equal(p.getState(), 'Completed');
  return { frozenAtMs: time, resumedAtMs: 2500, resumedDistance: 0.15, pauseWallTimeDidNotAffectJudgment: true };
});

test('Pausing during waiting Head preserves 1000ms window; Up cannot advance a paused line', () => {
  const p = make();
  const endpointMs = snapshot(p).head.spawnTimeMs + HEAD_WINDOW_MS;
  const pausedAtMs = endpointMs - 50;
  p.advance(snapshot(p).head.spawnTimeMs); p.togglePause(pausedAtMs);
  const frozen = clone(snapshot(p));
  strike(p, 'Space', 9000); strike(p, 'Space', 9001, 'Up'); p.advance(9002);
  assert.deepEqual(snapshot(p), frozen); assert.equal(p.getCurrentTimeMs(), pausedAtMs);
  p.togglePause(pausedAtMs); start(p, endpointMs);
  return { windowMs: HEAD_WINDOW_MS, pausedAtMs, discardedWallTimeInputMs: 9000, resumedHeadAcceptedAtMs: endpointMs };
});

test('Parsed resource and reader snapshots are immutable copies of gameplay data', () => {
  const raw = rawChart(); const chart = parseGuidanceChart(raw, layout);
  const originalPath = clone(chart.lines[0].path.points);
  raw.lines[0].path.points[0].u = 0.8; raw.lines[0].head.spawnTimeMs = 60000;
  raw.lines[0].nodes[0].pathDistance = 0;
  assert.deepEqual(chart.lines[0].path.points, originalPath); assert.equal(chart.lines[0].head.spawnTimeMs, 1000);
  for (const object of [chart, chart.lines, chart.lines[0], chart.lines[0].head,
    chart.lines[0].path, chart.lines[0].path.points, chart.lines[0].path.points[0],
    chart.lines[0].nodes, chart.lines[0].nodes[0]]) assert.ok(Object.isFrozen(object));
  const p = new ChartPremiere(chart, layout); p.begin(); start(p); p.advance(2000);
  const s = snapshot(p);
  for (const object of [s, s.head, s.judgmentPoint, s.judgmentPoint.position, s.remainingPoints,
    s.nodes, s.nodes[0], s.nodes[0].node, s.nodes[0].position]) assert.ok(Object.isFrozen(object));
  return { sourceMutationCannotChangeChart: true, deepFrozenResourceAndReader: true };
});

test('Exit / reopen clears node, path, start, held keys, score, media status and feedback', () => {
  const p = make(); start(p); p.advance(3000); strike(p, 'KeyA', 3000);
  const result = p.requestExit(3000);
  assert.equal(result.completed, false); assert.equal(p.getState(), 'Exited'); assert.equal(snapshot(p).state, 'Exited');
  p.advance(12000); strike(p, 'KeyB', 5000); assert.equal(p.getResolvedCount(), 0);
  p.reopen(); assert.equal(p.getState(), 'Ready'); assert.equal(p.getCurrentTimeMs(), 0);
  assert.equal(snapshot(p).state, 'Pending'); assert.equal(snapshot(p).startedAtMs, null);
  assert.equal(snapshot(p).judgmentPoint, null); assertUnresolved(p);
  assert.equal(p.getTotalScore(), 0); assert.equal(p.getResult(), null);
  assert.deepEqual(p.getJudgeFeedbackSince(0), { nextSeq: 0, items: [] });
  p.begin(); start(p); strike(p, 'KeyB', 5000); assert.equal(p.getPerfectCount(), 1);
  p.advanceMediaStatus(true, false, 1); assert.equal(p.getState(), 'Completed');
  p.reopen(); p.begin(); p.advance(900);
  p.advanceMediaStatus(false, true, CHART_MEDIA_END_TIMEOUT_MS); assert.equal(p.getState(), 'Playing');
  start(p); strike(p, 'KeyB', 5000); assert.equal(p.getState(), 'Playing');
  return { exitsWithoutCompletion: true, freshSpaceAfterReopen: true, staleMediaEndAndTimeoutCleared: true };
});

test('Independent 30000ms unavailable-media timeout counts only after all objects settle and excludes pause', () => {
  const p = make(); p.advanceMediaStatus(false, true, CHART_MEDIA_END_TIMEOUT_MS);
  assert.equal(p.getState(), 'Playing'); start(p); p.advance(5121);
  assert.equal(p.getMissCount(), 1); p.advanceMediaStatus(false, true, CHART_MEDIA_END_TIMEOUT_MS - 1);
  assert.equal(p.getState(), 'Playing'); p.togglePause(5121);
  p.advanceMediaStatus(false, true, 60000); assert.equal(p.getState(), 'Paused'); p.togglePause(5121);
  p.advanceMediaStatus(false, true, 1); assert.equal(p.getState(), 'Completed');
  assert.equal(p.getResult().finishedAtMs, 5121);
  return { timeoutMs: CHART_MEDIA_END_TIMEOUT_MS, staleMediaTimeAtCompletion: 5121, pausedElapsedExcluded: 60000 };
});

test('Transparency changes score only; Tap key, path and timing remain identical', () => {
  const observations = [];
  for (const transparency of [0, 50, 100]) {
    const p = make(); p.setGuideTransparency(transparency); start(p); p.advance(4999);
    const position = clone(snapshot(p).judgmentPoint.position); strike(p, 'KeyA', 4999);
    assert.equal(p.getPerfectCount(), 1); observations.push({ transparency, position, score: p.getTotalScore() });
  }
  assert.deepEqual(observations[0].position, observations[1].position);
  assert.deepEqual(observations[1].position, observations[2].position);
  assert.ok(observations[0].score < observations[1].score && observations[1].score < observations[2].score);
  return observations;
});

test('Legacy ChartData / Note keeps its existing keyboard pad lifecycle and result behavior', () => {
  const usedLayout = createDefaultKeyboardPadLayout();
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/resources/chart/chart_placeholder.json'), 'utf8').replace(/^\uFEFF/, ''));
  const p = new ChartPremiere(legacy, usedLayout); p.begin();
  assert.equal(p.getGuidanceSnapshot(), null);
  for (const note of legacy.notes) p.submitStrike({ ...note, videoTimeMs: note.timeMs });
  assert.equal(p.getResolvedCount(), 20); assert.equal(p.getState(), 'Playing');
  p.advance(12000); p.advanceMediaStatus(true, false, 1);
  assert.equal(p.getState(), 'Completed'); assert.equal(p.getResult().perfectCount, 20);
  return { legacyNotes: 20, completedAtMs: 12000 };
});

function directorFixture() {
  const p = make(); p.requestExit(0); p.reopen();
  const director = new DirectorSession();
  const protagonist = new Protagonist({ lateral: 0, depth: 0 });
  const chain = new PuzzleChain(new PuzzleProgress());
  const deepTrace = new DeepTrace({ lateral: 0, depth: 0 });
  let beatTimeMs = 0, rhythmStrike = null, mediaTimeMs = -1;
  let mediaEnded = false, mediaUnavailable = false;
  director.bindProtagonist(protagonist); director.bindMapCenter({ lateral: 0, depth: 0 });
  director.bindPuzzleChain(chain); director.bindDeepTrace(deepTrace);
  director.bindScreenProjectionProbe(() => ({ x: 0.5, y: 0.5 }));
  director.bindBeatClockProbe(() => beatTimeMs); director.bindRhythmStrikeProbe(() => rhythmStrike);
  director.bindChartPremiere(p); director.bindChartClockProbe(() => mediaTimeMs);
  director.bindChartMediaProbe(() => ({ ended: mediaEnded, unavailable: mediaUnavailable }));
  director.submitFrameIntents([], 0.016);
  assert.equal(chain.getProgress().getStage(), 'AwaitingStrike');
  for (let timeMs = 0; timeMs < 7000; timeMs += 1000) {
    beatTimeMs = timeMs; rhythmStrike = { strikeTimeMs: timeMs, targetBeatTimeMs: timeMs };
    director.submitFrameIntents([{ kind: 'Strike', videoTimeMs: timeMs }], 0.016);
  }
  beatTimeMs = 7000; director.submitFrameIntents([], 0.016);
  assert.equal(chain.getProgress().getStage(), 'Completed'); assert.equal(deepTrace.isTriggered(), true);
  assert.equal(director.getLedgerEvents().length, 1);
  assert.equal(director.getLedgerEvents()[0].eventId, 'T6_ENDPOINT_PLACEHOLDER');
  const frame = (timeMs, intents = [], frameDurationSeconds = 0.016) => {
    mediaTimeMs = timeMs; director.submitFrameIntents(intents, frameDurationSeconds);
  };
  const setMediaTime = timeMs => { mediaTimeMs = timeMs; };
  const setMediaStatus = (ended, unavailable) => { mediaEnded = ended; mediaUnavailable = unavailable; };
  return { p, director, protagonist, frame, setMediaTime, setMediaStatus };
}

test('Director full chain: middle exit writes no completion; reentry clears state; final completion writes exactly once', () => {
  const { p, director, protagonist, frame, setMediaStatus } = directorFixture();
  frame(0, [{ kind: 'EnterChart' }]); assert.equal(director.getChartPlaybackState(), 'Playing');
  assert.equal(director.isWorldMotionGated(), true);
  const worldBefore = clone(protagonist.getPosition());
  frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000, phase: 'Down' }]);
  frame(3000, [{ kind: 'Move', lateral: 1, depth: 1 }]);
  assert.deepEqual(protagonist.getPosition(), worldBefore);
  frame(3000, [{ kind: 'ExitChart' }]);
  assert.equal(p.getState(), 'Exited'); assert.equal(p.getResult().completed, false);
  assert.equal(director.isWorldMotionGated(), false); assert.equal(director.getLedgerEvents().length, 1);
  frame(-1, [{ kind: 'EnterChart' }]);
  assert.equal(p.getState(), 'Ready'); assert.equal(snapshot(p).startedAtMs, null); assertUnresolved(p);
  assert.equal(director.getLedgerEvents().length, 1, '既有 T6 终点不重复记账');
  frame(0); frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000, phase: 'Down' }]);
  frame(5000, [{ kind: 'Strike', keyId: 'KeyB', videoTimeMs: 5000, phase: 'Down' }]);
  assert.equal(p.getPerfectCount(), 1); assert.equal(director.getLedgerEvents().length, 1);
  setMediaStatus(true, false); frame(12000);
  assert.equal(p.getState(), 'Exited'); assert.equal(p.getResult().completed, true);
  assert.equal(director.isWorldMotionGated(), false); assert.equal(director.getLedgerEvents().length, 2);
  const completion = director.getLedgerEvents().filter(event => event.eventId === 'T7_COMPLETION_PLACEHOLDER');
  assert.equal(completion.length, 1); assert.equal(completion[0].ChartRef.chartId, p.getChartId());
  assert.equal(completion[0].vector.length, 20);
  frame(12000); frame(12000, [{ kind: 'ExitChart' }]); frame(0, [{ kind: 'EnterChart' }]);
  assert.equal(director.getLedgerEvents().length, 2); assert.equal(p.getState(), 'Exited');
  return { endpointRecords: 1, middleExitCompletionRecords: 0, completionRecords: 1, chartId: completion[0].ChartRef.chartId, worldGateReleased: true };
});

test('Director forwards Up edges: pre-held Space cannot start until release and fresh Down', () => {
  const { p, frame } = directorFixture();
  frame(0, [{ kind: 'EnterChart' }]);
  frame(999, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 999, phase: 'Down' }]);
  frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000, phase: 'Down' }]);
  assert.equal(snapshot(p).state, 'Waiting');
  frame(1050, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1050, phase: 'Up' }]);
  frame(1051, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1051, phase: 'Down' }]);
  assert.equal(snapshot(p).state, 'Running'); assert.equal(snapshot(p).startedAtMs, 1051);
  return { ignoredHeldAtMs: 1000, acceptedFreshDownAtMs: 1051 };
});

test('Director media probe: independent timeout completes and records once even when clock is stationary', () => {
  const { p, director, frame, setMediaStatus } = directorFixture();
  frame(0, [{ kind: 'EnterChart' }]);
  frame(1000, [{ kind: 'Strike', keyId: 'Space', videoTimeMs: 1000 }]);
  setMediaStatus(false, true);
  frame(5121, [], (CHART_MEDIA_END_TIMEOUT_MS - 1) / 1000);
  assert.equal(p.getState(), 'Playing'); assert.equal(p.getMissCount(), 1);
  assert.equal(director.getLedgerEvents().length, 1);
  frame(5121, [{ kind: 'ToggleChartPause', videoTimeMs: 5121 }], 0);
  frame(5121, [], 60); assert.equal(p.getState(), 'Paused');
  frame(5121, [{ kind: 'ToggleChartPause', videoTimeMs: 5121 }], 0);
  frame(5121, [], 0.001);
  assert.equal(p.getState(), 'Exited'); assert.equal(p.getResult().completed, true);
  assert.equal(p.getResult().finishedAtMs, 5121); assert.equal(director.getLedgerEvents().length, 2);
  frame(5121); assert.equal(director.getLedgerEvents().length, 2);
  return { stationaryMediaTimeMs: 5121, independentTimeoutMs: CHART_MEDIA_END_TIMEOUT_MS, completionRecords: 1 };
});

// Stub 仅替代 cc 的 Component / 原生事件总线；运行真实采集器与帧驱动源码。
// 不声称是 Creator 引擎或视觉验收，避免把纯逻辑测试冒充 Cocos 预览证据。
function withCocosEventStub(run) {
  const Module = require('module');
  const originalLoad = Module._load;
  const originalWindow = global.window;
  const handlers = new Map(), windowHandlers = new Map();
  const input = {
    on(event, callback, context) {
      const list = handlers.get(event) ?? []; list.push({ callback, context }); handlers.set(event, list);
    },
    off(event, callback, context) {
      handlers.set(event, (handlers.get(event) ?? []).filter(item => item.callback !== callback || item.context !== context));
    },
    emit(event, keyCode) {
      for (const item of handlers.get(event) ?? []) item.callback.call(item.context, { keyCode });
    },
  };
  const cc = {
    _decorator: { ccclass: () => target => target }, Component: class {}, input,
    Input: { EventType: { KEY_DOWN: 'down', KEY_UP: 'up', MOUSE_WHEEL: 'wheel' } },
  };
  global.window = {
    addEventListener(event, callback) { windowHandlers.set(event, callback); },
    removeEventListener(event, callback) { if (windowHandlers.get(event) === callback) windowHandlers.delete(event); },
  };
  Module._load = function (request, parent, isMain) {
    return request === 'cc' ? cc : originalLoad.call(this, request, parent, isMain);
  };
  const componentPaths = [
    require.resolve('../../src/presentation/InputCollector.ts'),
    require.resolve('../../src/presentation/FrameDriver.ts'),
  ];
  for (const filename of componentPaths) delete require.cache[filename];
  try {
    const { InputCollector } = require('../../src/presentation/InputCollector.ts');
    const { FrameDriver } = require('../../src/presentation/FrameDriver.ts');
    return run({ InputCollector, FrameDriver, input, blur: () => windowHandlers.get('blur')?.() });
  } finally {
    Module._load = originalLoad;
    for (const filename of componentPaths) delete require.cache[filename];
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
}

test('InputCollector real event routing preserves Down / Up timestamps and order, suppresses repeat, releases on blur', () => withCocosEventStub(({ InputCollector, input, blur }) => {
  let state = 'Playing', timeMs = 999;
  const collector = new InputCollector();
  collector.bindChartStateProvider(() => state); collector.bindChartTimeProbe(() => timeMs); collector.onEnable();
  const emit = (event, keyCode, atMs) => { timeMs = atMs; input.emit(event, keyCode); };
  try {
    emit('down', 32, 999); emit('down', 32, 1000); emit('up', 32, 1001); emit('down', 32, 1002);
    emit('down', 65, 1003); emit('down', 66, 1004);
    const ordered = collector.collectFrameIntents();
    assert.deepEqual(ordered.map(({ videoTimeMs, keyId, phase }) => ({ videoTimeMs, keyId, phase })), [
      { videoTimeMs: 999, keyId: 'Space', phase: 'Down' }, { videoTimeMs: 1001, keyId: 'Space', phase: 'Up' },
      { videoTimeMs: 1002, keyId: 'Space', phase: 'Down' }, { videoTimeMs: 1003, keyId: 'KeyA', phase: 'Down' },
      { videoTimeMs: 1004, keyId: 'KeyB', phase: 'Down' },
    ]);
    state = 'Paused'; emit('down', 67, 1005); emit('up', 65, 1006); emit('down', 67, 1007);
    const paused = collector.collectFrameIntents(); assert.equal(paused.length, 1); assert.equal(paused[0].phase, 'Up');
    state = 'Playing'; emit('down', 67, 1008); assert.deepEqual(collector.collectFrameIntents(), []);
    emit('up', 67, 1009); emit('down', 67, 1010);
    assert.deepEqual(collector.collectFrameIntents().map(item => item.phase), ['Up', 'Down']);
    timeMs = 1011; blur();
    const released = collector.collectFrameIntents();
    assert.deepEqual(released.map(item => item.keyId).sort(), ['KeyB', 'KeyC', 'Space']);
    assert.ok(released.every(item => item.phase === 'Up' && item.videoTimeMs === 1011));
    emit('down', 32, 1012); assert.equal(collector.collectFrameIntents()[0].phase, 'Down');
    collector.onDisable(); const disabled = collector.collectFrameIntents();
    assert.equal(disabled.length, 1); assert.equal(disabled[0].keyId, 'Space'); assert.equal(disabled[0].phase, 'Up');
    return { orderedEdges: ordered, pausedNewDownIgnored: true, blurReleasedKeys: released.map(item => item.keyId), onDisableRelease: true };
  } finally { collector.onDisable(); }
}));

test('Real InputCollector + FrameDriver + Director process endpoint inputs before a later render-frame timeout', () => withCocosEventStub(({ InputCollector, FrameDriver, input }) => {
  const { p, director, frame, setMediaTime, setMediaStatus } = directorFixture();
  frame(0, [{ kind: 'EnterChart' }]);
  const headInputAtMs = snapshot(p).head.spawnTimeMs + HEAD_WINDOW_MS;
  const headFrameAtMs = headInputAtMs + 1;
  const line = rawChart().lines[0];
  const tapTargetAtMs = headInputAtMs + line.nodes[0].pathDistance / line.speed * 1000;
  const tapInputAtMs = tapTargetAtMs + GOOD_WINDOW_MS;
  const tapFrameAtMs = tapInputAtMs + 1;
  let inputTimeMs = headInputAtMs;
  const collector = new InputCollector();
  collector.bindChartStateProvider(() => director.getChartPlaybackState()); collector.bindChartTimeProbe(() => inputTimeMs);
  collector.onEnable();
  const driver = new FrameDriver(); driver.onLoad(); driver.bindWiring(collector, director);
  const refreshed = [];
  driver.addRefreshable({ onFrameRefresh: () => refreshed.push({ state: p.getState(), line: snapshot(p).state, tier: nodeSnapshot(p).tier }) });
  try {
    input.emit('down', 32); setMediaTime(headFrameAtMs); driver.update(0.016);
    assert.equal(snapshot(p).startedAtMs, headInputAtMs, '含端点 Head 输入须先于下一渲染帧的超时处理');
    assert.equal(refreshed[0].line, 'Running');
    inputTimeMs = tapInputAtMs; input.emit('down', 66); setMediaTime(tapFrameAtMs); driver.update(0.016);
    assert.equal(nodeSnapshot(p).tier, 'Good'); assert.equal(nodeSnapshot(p).resolvedAtMs, tapInputAtMs);
    assert.equal(p.getMissCount(), 0, '含端点 Good 输入须先于下一渲染帧的漏判处理');
    setMediaStatus(true, false); setMediaTime(12000); driver.update(0.016);
    assert.equal(p.getState(), 'Exited'); assert.equal(director.getLedgerEvents().length, 2);
    assert.equal(refreshed[refreshed.length - 1].state, 'Exited', '表现刷新读取已完成账本与退出后的同帧状态');
    return { headWindowMs: HEAD_WINDOW_MS, headInputAtMs, headFrameAtMs, tapTargetAtMs, tapInputAtMs, tapFrameAtMs, tapTier: 'Good', latestRefresh: refreshed[refreshed.length - 1] };
  } finally { collector.onDisable(); driver.onDestroy(); }
}));

const report = {
  task: 'Guidance A: one line / Head + Tap',
  headWindowMs: HEAD_WINDOW_MS,
  generatedAt: new Date().toISOString(),
  command: 'node quality-review/guidance-a/acceptance.cjs',
  coverage: 'pure logic / public ChartPremiere and DirectorSession APIs; Creator visual evidence is separate',
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
};
fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
