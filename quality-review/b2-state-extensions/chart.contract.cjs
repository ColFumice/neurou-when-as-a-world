'use strict';
// Controlled media clocks and play inputs are ContractTest fixtures, never production acceptance.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = name => require(path.join(root, name));
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const { ChartArchive, chartContentDigest, parseChartContentManifest } = load('src/director/ChartArchive.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { VectorSchemaVersion, NarrativeDimension } = load('constants/index.ts');
const context = { accountId: 'chart-contract', worldId: 'chart-primary', protagonistCharacterId: 'rain-protagonist', worldKind: 'Primary', shoreOrigin: null };
const layout = createDefaultKeyboardPadLayout();
const worldChart = parseGuidanceChart(json('assets/resources/chart/primary-rain-world-1.json'), layout);
const worldVisual = json('assets/resources/chart/primary-rain-world-1.visual.json');
const manifest = parseChartContentManifest(json('assets/resources/chart/content-manifest.json'));
const media = manifest.media.find(item => item.kind === 'Audio');
const clone = value => JSON.parse(JSON.stringify(value));
const zero = Object.values(NarrativeDimension).filter(value => typeof value === 'number').map(() => 0);
const results = [];
function test(name, operation) { operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
function event(chart = worldChart, eventId = 'WORLD_COMPLETE:1', state = 'PremiereCompleted') {
  return { eventId, vector: zero.slice(), VectorSchemaVersion, AppendedAt: { epochMs: 1791600000000 },
    InputSource: InputSource.Player, ChapterTag: {}, ChartRef: state === undefined ? { chartId: chart.chartId } : { chartId: chart.chartId, state } };
}
function play(chart = worldChart, transparency = 0, hit = false, extraMiss = false) {
  const premiere = new ChartPremiere(chart, layout); premiere.setGuideTransparency(transparency); premiere.begin();
  if (hit && 'lines' in chart) {
    premiere.advance(750); premiere.submitStrike({ keyId: 'Space', phase: 'Down', videoTimeMs: 750 });
    ['KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'].forEach((keyId, index) => {
      const videoTimeMs = 1500 + index * 750; premiere.advance(videoTimeMs);
      premiere.submitStrike({ keyId, phase: 'Down', videoTimeMs });
    });
  } else if (hit) {
    chart.notes.forEach((note, index) => {
      premiere.advance(note.timeMs);
      if (extraMiss && index === 0) { premiere.submitStrike({ keyId: 'Slash', phase: 'Down', videoTimeMs: note.timeMs }); }
      premiere.submitStrike({ keyId: note.keyId, phase: 'Down', videoTimeMs: note.timeMs });
    });
  }
  premiere.advance(20000); premiere.advanceMediaStatus(true, false, 16);
  assert.equal(premiere.getState(), 'Completed'); assert.equal(premiere.getResult().completed, true);
  return premiere.getResult();
}
function fixture(options = {}) {
  const chart = options.chart || worldChart, completion = options.event || event(chart), visual = options.visual ||
    (chart.chartId === worldChart.chartId ? worldVisual : { schemaVersion: 1, chartId: chart.chartId, nodes: [] });
  const result = options.result || play(chart, options.transparency || 0, options.hit || false, options.extraMiss || false);
  const input = { completionEventId: completion.eventId, chart: clone(chart), layout: clone(layout), visual: clone(visual),
    media: clone(media), guideTransparency: options.transparency || 0, result: clone(result) };
  const archive = new ChartArchive(options.context || context);
  const ledger = [completion];
  const candidate = archive.preparePremiere(input, ledger);
  return { archive, input, ledger, candidate, chart, completion };
}
function digest(snapshot) { return chartContentDigest({ chart: snapshot.chart, layout: snapshot.layout, visual: snapshot.visual,
  media: snapshot.media, guideTransparency: snapshot.guideTransparency }); }
function rejectMutation(f, mutate, pattern) {
  const raw = clone(f.candidate.snapshots); mutate(raw.records[0], raw);
  assert.throws(() => f.archive.validateSnapshots(raw, f.ledger), pattern);
}
try {
  test('published World actual ChartPremiere completion freezes the exact content, full layout, RGB, media and transparency', () => {
    const f = fixture({ transparency: 35, hit: true }), record = f.candidate.snapshots.records[0];
    assert.equal(f.candidate.scores.records[0].latest.totalScore, 675); assert.equal(record.guideTransparency, 35);
    assert.equal(record.chart.tier, 'World'); assert.equal(record.layout.slots.length, 47);
    assert.deepEqual(record.chart, worldChart); assert.deepEqual(record.visual, worldVisual); assert.deepEqual(record.media, media);
    assert.equal(record.contentDigest, digest(record)); assert.equal(record.frozenAt, f.completion.AppendedAt.epochMs);
    assert.equal(record.owner, 'WorldObserver'); assert.equal(record.ChartRef.state, 'PremiereCompleted');
    assert.deepEqual(f.archive.validateSnapshots(f.candidate.snapshots, f.ledger, true), f.candidate.snapshots);
    assert.deepEqual(f.archive.validateScores(f.candidate.scores, f.candidate.snapshots, f.ledger, true), f.candidate.scores);
  });
  test('all miss is a legal completed play and zero score remains actual result rather than a hydration default', () => {
    const f = fixture(), score = f.candidate.scores.records[0];
    assert.equal(score.latest.totalScore, 0); assert.equal(score.latest.missCount, 5); assert.equal(score.completedPlayCount, 1);
  });
  test('archive candidates are deeply immutable independent clones and neither caller mutation nor replay changes original bytes', () => {
    const f = fixture(), before = JSON.stringify(f.candidate);
    f.input.chart.lines[0].path.points[0].u = .9; f.input.visual.nodes[0].color.r = 0; f.input.layout.slots[0].u = .2;
    assert.equal(JSON.stringify(f.candidate), before); assert(Object.isFrozen(f.candidate.snapshots.records[0].chart.lines[0].path.points));
    assert(Object.isFrozen(f.candidate.scores.records[0].latest));
  });
  test('canonical SHA256 matches independent Node SHA256 including Unicode, key sorting, long blocks and proto key data', () => {
    const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ?
      '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
    [null, {}, '雨若🌧️', { z: [1, -0, .23], a: '雨'.repeat(1500) }, JSON.parse('{"__proto__":{"x":1},"a":2}')].forEach(value =>
      assert.equal(chartContentDigest(value), crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex')));
  });
  test('Entry is never a premiere fact and cannot authorize content freeze', () => {
    const f = fixture(), entry = event(worldChart, f.completion.eventId, 'Entry');
    assert.throws(() => f.archive.preparePremiere(f.input, [entry]), /合法完成账本/);
    assert.deepEqual(f.archive.validateSnapshots(f.archive.emptySnapshots(), [entry], true).records, []);
  });
  test('missing historical played content or scores pass partial only and fail full coverage without fabricated defaults', () => {
    const f = fixture(); assert.equal(f.archive.validateSnapshots(f.archive.emptySnapshots(), f.ledger).records.length, 0);
    assert.throws(() => f.archive.validateSnapshots(f.archive.emptySnapshots(), f.ledger, true), /缺少实际播放内容/);
    assert.equal(f.archive.validateScores(f.archive.emptyScores(), f.candidate.snapshots, f.ledger).records.length, 0);
    assert.throws(() => f.archive.validateScores(f.archive.emptyScores(), f.candidate.snapshots, f.ledger, true), /缺少真实成绩/);
  });
  test('first snapshot cannot be overwritten by duplicate premiere even with identical data', () => {
    const f = fixture(); const next = new ChartArchive(context, f.candidate.snapshots, f.candidate.scores);
    assert.throws(() => next.preparePremiere(f.input, f.ledger), /不可覆盖/);
  });
  test('replay raises best, records latest/count, preserves premiere snapshot and adds no ledger event', () => {
    const f = fixture(), ledgerBefore = JSON.stringify(f.ledger), before = JSON.stringify(f.candidate.snapshots);
    let archive = new ChartArchive(context, f.candidate.snapshots, f.candidate.scores);
    const first = archive.prepareReplay({ chartId: worldChart.chartId, playId: 'replay-1', guideTransparency: 20, result: play(worldChart, 20, true) }, f.ledger);
    assert.equal(first.scores.records[0].best.totalScore, 600); assert.equal(first.scores.records[0].completedPlayCount, 2);
    archive = new ChartArchive(context, first.snapshots, first.scores);
    const second = archive.prepareReplay({ chartId: worldChart.chartId, playId: 'replay-2', guideTransparency: 0, result: play() }, f.ledger);
    assert.equal(second.scores.records[0].best.playId, 'replay-1'); assert.equal(second.scores.records[0].latest.playId, 'replay-2');
    assert.equal(second.scores.records[0].completedPlayCount, 3); assert.equal(JSON.stringify(second.snapshots), before);
    assert.equal(JSON.stringify(f.ledger), ledgerBefore);
    archive = new ChartArchive(context, second.snapshots, second.scores);
    assert.throws(() => archive.prepareReplay({ chartId: worldChart.chartId, playId: 'replay-1', guideTransparency: 0, result: play() }, f.ledger), /重复提交/);
  });
  test('equal replay score preserves earlier best and still advances latest and completion count', () => {
    const f = fixture({ hit: true }); const archive = new ChartArchive(context, f.candidate.snapshots, f.candidate.scores);
    const next = archive.prepareReplay({ chartId: worldChart.chartId, playId: 'tie-replay', guideTransparency: 0, result: play(worldChart, 0, true) }, f.ledger);
    assert.equal(next.scores.records[0].best.playId, f.completion.eventId); assert.equal(next.scores.records[0].latest.playId, 'tie-replay');
  });
  test('aborted replay is rejected with no candidate mutation, count or score publication', () => {
    const f = fixture(), before = JSON.stringify(f.candidate); const aborted = new ChartPremiere(worldChart, layout); aborted.begin();
    const result = aborted.requestExit(900), archive = new ChartArchive(context, f.candidate.snapshots, f.candidate.scores);
    assert.equal(result.completed, false);
    assert.throws(() => archive.prepareReplay({ chartId: worldChart.chartId, playId: 'aborted', guideTransparency: 0, result }, f.ledger), /完整演奏/);
    assert.equal(JSON.stringify(f.candidate), before);
  });
  test('Final tier is refused in Primary/BugShore and frozen in FinalShore personal ownership only', () => {
    const final = clone(worldChart); final.chartId = 'final-contract'; final.tier = 'Final';
    assert.throws(() => fixture({ chart: final }), /FinalShore/);
    assert.throws(() => fixture({ chart: final, context: { ...context, worldKind: 'Shore', shoreOrigin: 'BugShore' } }), /FinalShore/);
    const f = fixture({ chart: final, context: { ...context, worldKind: 'Shore', shoreOrigin: 'FinalShore' } });
    assert.equal(f.candidate.snapshots.records[0].owner, 'FinalShorePersonal');
  });
  test('actual old Note wrong-slot Miss count is retained without assuming hit+miss equals Note count', () => {
    const chart = json('assets/resources/chart/chart_placeholder.json'); const f = fixture({ chart, hit: true, extraMiss: true });
    const latest = f.candidate.scores.records[0].latest;
    assert.equal(latest.perfectCount, chart.notes.length); assert.equal(latest.missCount, 1); assert.equal(latest.totalScore, 2000);
  });
  test('exact legacy zero T7 requires actual frozen Regular chart; old zero T6 remains Entry', () => {
    const chart = json('assets/resources/chart/chart_placeholder.json'), completion = event(chart, 'T7_COMPLETION_PLACEHOLDER'); delete completion.ChartRef.state;
    const f = fixture({ chart, event: completion }); assert.equal(f.candidate.snapshots.records.length, 1);
    const worldLegacy = event(worldChart, 'T7_COMPLETION_PLACEHOLDER'); delete worldLegacy.ChartRef.state;
    assert.throws(() => fixture({ event: worldLegacy }), /实际冻结的 Regular/);
    const t6 = event(chart, 'T6_ENDPOINT_PLACEHOLDER'); delete t6.ChartRef.state;
    assert.equal(f.archive.validateSnapshots(f.archive.emptySnapshots(), [t6], true).records.length, 0);
  });
  test('archive refuses duplicate/foreign ledger completion IDs and duplicate chart completion references', () => {
    const f = fixture(); assert.throws(() => f.archive.validateSnapshots(f.candidate.snapshots, [f.completion, clone(f.completion)]), /账本事件重复/);
    assert.throws(() => f.archive.validateSnapshots(f.candidate.snapshots, [f.completion, event(worldChart, 'second')]), /重复首演/);
    assert.throws(() => f.archive.validateSnapshots(f.candidate.snapshots, [event(worldChart, 'foreign')]), /没有合法完成/);
  });
  test('archive envelope enforces exact account/world/protagonist and schema version', () => {
    const f = fixture(); ['accountId', 'worldId', 'protagonistCharacterId', 'schemaVersion'].forEach(field => {
      const raw = clone(f.candidate.snapshots); raw[field] = field === 'schemaVersion' ? 2 : 'foreign';
      assert.throws(() => f.archive.validateSnapshots(raw, f.ledger), /个人归属/);
    });
  });
  test('snapshot content or transparency tampering fails its content digest and metadata tampering fails ledger identity', () => {
    const f = fixture();
    rejectMutation(f, record => { record.chart.lines[0].timing[0].targetTimeMs += 1; }, /摘要/);
    rejectMutation(f, record => { record.guideTransparency = 30; }, /摘要/);
    rejectMutation(f, record => { record.frozenAt += 1; }, /归属或冻结/);
    rejectMutation(f, record => { record.owner = 'FinalShorePersonal'; }, /归属或冻结/);
    rejectMutation(f, record => { record.ChartRef.state = 'Entry'; }, /合法首演/);
  });
  test('incomplete layouts, repeated keys, bad slot kinds, out-of-bound geometry and mismatched versions are rejected', () => {
    const f = fixture();
    rejectMutation(f, record => { record.layout.slots.pop(); }, /完整逻辑布局/);
    rejectMutation(f, record => { record.layout.slots[1].keyId = record.layout.slots[0].keyId; }, /重复/);
    rejectMutation(f, record => { record.layout.slots[0].padKind = 'Drum'; }, /类别/);
    rejectMutation(f, record => { record.layout.slots[0].width = 2; });
    rejectMutation(f, record => { record.layout.layoutVersion = 'other'; });
  });
  test('visual associations require actual chart nodes, unique IDs and finite byte RGB', () => {
    const f = fixture();
    rejectMutation(f, record => { record.visual.nodes[0].nodeId = 'invented'; }, /节点不存在/);
    rejectMutation(f, record => { record.visual.nodes.push(clone(record.visual.nodes[0])); }, /重复/);
    rejectMutation(f, record => { record.visual.nodes[0].color.r = 256; });
    rejectMutation(f, record => { record.visual.nodes[0].color.g = NaN; });
  });
  test('media identity excludes ephemeral URLs, traversal, kind mismatch, malformed hash and empty bytes', () => {
    const f = fixture();
    ['blob:temporary', 'https://example.invalid/song', 'audio/../song'].forEach(path => rejectMutation(f, record => { record.media.resourcePath = path; }, /临时URL/));
    rejectMutation(f, record => { record.media.kind = 'Video'; }, /临时URL/);
    rejectMutation(f, record => { record.media.sha256 = 'A'.repeat(64); }, /临时URL/);
    rejectMutation(f, record => { record.media.byteLength = 0; });
  });
  test('strict persisted data rejects unknown fields, accessors without invocation, sparse arrays, foreign prototypes and cycles', () => {
    const f = fixture(); rejectMutation(f, record => { record.extra = true; }, /字段/);
    let calls = 0; const getter = clone(f.candidate.snapshots); Object.defineProperty(getter.records[0], 'chart', { enumerable: true, get() { calls++; return worldChart; } });
    assert.throws(() => f.archive.validateSnapshots(getter, f.ledger), /访问器/); assert.equal(calls, 0);
    rejectMutation(f, record => { delete record.chart.lines[0].nodes[0]; }, /稀疏|数组无效/);
    const raw = clone(f.candidate.snapshots); Object.setPrototypeOf(raw.records[0].media, new Date());
    assert.throws(() => f.archive.validateSnapshots(raw, f.ledger), /普通数据对象/);
    assert.throws(() => { const value = {}; value.self = value; chartContentDigest(value); }, /无环/);
  });
  test('score rejects dishonest totals, guidance counts, incomplete flags, transparency and mismatched snapshot association', () => {
    const f = fixture();
    for (const mutate of [record => { record.latest.totalScore = 100; }, record => { record.latest.missCount++; },
      record => { record.latest.completed = false; }, record => { record.latest.guideTransparency = 101; },
      record => { record.snapshotDigest = '0'.repeat(64); }, record => { record.scoringVersion = 2; }]) {
      const raw = clone(f.candidate.scores); mutate(raw.records[0]);
      assert.throws(() => f.archive.validateScores(raw, f.candidate.snapshots, f.ledger));
    }
  });
  test('score detects forged best/latest/completion ordering, missing prior play IDs and duplicated counts', () => {
    const f = fixture();
    for (const mutate of [record => { record.completedPlayCount = 2; }, record => { record.completedPlayIds[0] = 'not-premiere'; },
      record => { record.best.playId = 'invented'; }, record => { record.latest.playId = 'invented'; },
      record => { record.completedPlayIds.push(record.completedPlayIds[0]); record.completedPlayCount++; }]) {
      const raw = clone(f.candidate.scores); mutate(raw.records[0]); assert.throws(() => f.archive.validateScores(raw, f.candidate.snapshots, f.ledger));
    }
  });
  test('publication manifest maps every real principal media byte identity and records actual legacy fallback distinctly', () => {
    assert.equal(manifest.charts.length, 7); assert.equal(manifest.media.length, 2);
    manifest.media.forEach(item => {
      const extension = item.kind === 'Audio' ? '.wav' : '.mp4', bytes = fs.readFileSync(path.join(root, 'assets/resources/' + item.resourcePath + extension));
      assert.equal(item.byteLength, bytes.length); assert.equal(item.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    });
    const fallback = manifest.charts.find(item => item.sourceKind === 'LegacyFallback');
    assert.equal(fallback.chartId, 'chart-placeholder-fallback'); assert.equal(fallback.resourcePath, null);
    assert(fallback.sourcePath.endsWith('#createFallbackChartData'));
  });
  test('manifest refuses duplicate media/chart identities, unbound media, forged paths, accessors and non-versioned envelopes', () => {
    for (const mutate of [raw => { raw.media.push(clone(raw.media[0])); }, raw => { raw.charts.push(clone(raw.charts[0])); },
      raw => { raw.charts[0].mediaContentId = 'not-published'; }, raw => { raw.charts[0].sourcePath = 'assets/../secret'; },
      raw => { raw.charts[0].resourcePath = 'http://remote'; }, raw => { raw.schemaVersion = 2; }]) {
      const raw = clone(manifest); mutate(raw); assert.throws(() => parseChartContentManifest(raw));
    }
    let calls = 0; const raw = clone(manifest); Object.defineProperty(raw.source, 'author', { enumerable: true, get() { calls++; return 'maker'; } });
    assert.throws(() => parseChartContentManifest(raw)); assert.equal(calls, 0);
  });
  const report = { schemaVersion: 1, category: 'ContractTest', scope: 'B2.2d-2 ChartArchive',
    productionClaim: false, count: results.length, result: 'PASS', results };
  fs.writeFileSync(path.join(__dirname, 'chart-contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(__dirname, 'chart-contract-results.json'), JSON.stringify({ category: 'ContractTest', productionClaim: false,
    result: 'FAIL', passed: results.length, results, error: String(error.stack || error) }, null, 2) + '\n');
  throw error;
}
