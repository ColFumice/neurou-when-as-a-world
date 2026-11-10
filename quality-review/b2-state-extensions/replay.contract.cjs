'use strict';
// Real ChartPremiere and formal frozen World content; controlled media clocks are contract fixtures only.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('./state-test-fixture.cjs');
const { load, clone, fixture, actualResult, ChartArchive, epochMs } = h;
const { ChartReplaySession } = load('src/director/ChartReplaySession.ts');
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { VectorSchemaVersion, NarrativeDimension } = load('constants/index.ts');
const { positionAtPathDistance, parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { resolveGridKeyAt } = load('src/chart/KeyboardPadLayout.ts');
const zero = () => Object.values(NarrativeDimension).filter(value => typeof value === 'number').map(() => 0);
function grayEvent(eventId, state, chartId = h.regular.chartId) {
  return { eventId, vector: zero(), VectorSchemaVersion, AppendedAt: { epochMs }, InputSource: InputSource.Player,
    ChapterTag: {}, ChartRef: state === undefined ? { chartId } : { chartId, state } };
}
function replayFixture(options = {}) {
  const base = options.base || fixture(); let snapshots = options.snapshots || base.archived.snapshots;
  let scores = options.scores || base.archived.scores;
  const media = { time: 0, ended: false, unavailable: false };
  const effects = { now: 0, prepares: [], saves: [], scoreWrites: 0, recallWrites: [], forwarded: [] };
  let saveFailure = false, prepareFailure = false, clock = epochMs, gated = false;
  const recalls = new RecallCountSession({ accountId: base.context.accountId, worldId: base.context.worldId,
    protagonistCharacterId: base.context.protagonistCharacterId, regularChartId: h.regular.chartId }, {
    readLedger: () => base.world.getLedgerSnapshot(), persistSnapshot: value => effects.recallWrites.push(clone(value)),
    now() { throw new Error('ChartReplay cannot request Recall append clock'); },
  });
  const legacy = { getCurrentPerceptionMode: () => base.world.getCurrentPerceptionMode(),
    getChartPlaybackState: () => base.world.getChartPlaybackState(),
    isWorldMotionGated: () => gated || base.world.isWorldMotionGated(),
    submitFrameIntents(intents, dt) { effects.forwarded.push(clone(intents)); base.world.submitFrameIntents(intents, dt); } };
  const replay = new ChartReplaySession(legacy, recalls, {
    readLedger: () => base.world.getLedgerSnapshot(), readSnapshots: () => snapshots,
    prepareMedia(record, premiere) { if (prepareFailure) { throw new Error('controlled media preparation failure'); }
      effects.prepares.push({ record, premiere }); replay.bindMedia(() => media.time,
        () => ({ ended: media.ended, unavailable: media.unavailable })); },
    saveResult(chartId, playId, transparency, result) {
      effects.saves.push({ chartId, playId, transparency, result: clone(result) });
      if (saveFailure) { throw new Error('controlled replay durable failure'); }
      const events = base.world.getLedgerSnapshot().characters.find(value => value.characterId === base.context.protagonistCharacterId).events;
      const candidate = new ChartArchive(base.archiveContext, snapshots, scores).prepareReplay({ chartId, playId,
        guideTransparency: transparency, result }, events);
      if (options.beforeSave) { options.beforeSave(candidate, replay); }
      snapshots = candidate.snapshots; scores = candidate.scores; effects.scoreWrites++;
    }, now() { effects.now++; return clock; },
  });
  return { base, replay, recalls, effects, media,
    snapshots: () => snapshots, scores: () => scores, setSnapshots(value) { snapshots = value; },
    failSave(value = true) { saveFailure = value; }, failPrepare(value = true) { prepareFailure = value; },
    setClock(value) { clock = value; }, gate(value = true) { gated = value; },
    tick(intents = [], dt = 1 / 60) { replay.submitFrameIntents(intents, dt); },
    enter(eventId = base.completion.eventId) { this.tick([{ kind: 'ReplayChart', completionEventId: eventId }]); },
    complete() { media.time = 6000; media.ended = true; this.tick(); },
  };
}
function unchanged(f, before) {
  assert.equal(JSON.stringify(f.base.world.getLedgerSnapshot()), before.ledger);
  assert.equal(JSON.stringify(f.recalls.getSnapshot()), before.recall);
  assert.equal(f.base.accountCalls(), before.account);
}
function before(f) { return { ledger: JSON.stringify(f.base.world.getLedgerSnapshot()), recall: JSON.stringify(f.recalls.getSnapshot()),
  account: f.base.accountCalls() }; }
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
(async () => {
  await test('idle wrapper delegates existing intents and reader state without any chart or Recall write', () => {
    const f = replayFixture(); const intents = [{ kind: 'MoveAxis', lateral: 1, depth: 0 }]; f.tick(intents);
    assert.deepEqual(f.effects.forwarded[0], intents); assert.equal(f.replay.isActive(), false);
    assert.equal(f.replay.getReader(), null); assert.equal(f.replay.getCurrentPerceptionMode(), f.base.world.getCurrentPerceptionMode());
    assert.equal(f.effects.saves.length, 0); assert.equal(f.effects.recallWrites.length, 0);
  });
  await test('own completion VectorEntry prepares the exact frozen chart layout visual media and actual transparency', () => {
    const f = replayFixture(); const prior = before(f); const record = f.snapshots().records[0]; f.enter();
    assert.equal(f.replay.isActive(), true); assert.equal(f.replay.isWorldMotionGated(), true);
    assert.equal(f.effects.prepares[0].record, record); assert.equal(f.replay.getReader().getChartId(), record.chartId);
    assert.equal(f.replay.getReader().getTier(), 'World'); assert.equal(f.replay.getReader().getGuideTransparency(), record.guideTransparency);
    assert.equal(f.replay.getReader().getTotalNoteCount(), record.chart.lines.reduce((sum, line) => sum + line.nodes.length, 0));
    assert(Object.isFrozen(record.chart)); assert(Object.isFrozen(record.layout.slots)); assert(Object.isFrozen(record.visual));
    assert.equal(f.effects.now, 1); assert.equal(f.effects.saves.length, 0); unchanged(f, prior);
  });
  await test('unknown event and Entry narrative choice cannot be treated as legal premiere completion', () => {
    const f = replayFixture(); const prior = before(f);
    const choice = f.base.world.getLedgerEvents().find(value => value.ChartRef.state === 'Entry');
    for (const eventId of ['absent', choice.eventId]) { assert.throws(() => f.enter(eventId)); }
    assert.equal(f.replay.isActive(), false); assert.equal(f.effects.prepares.length, 0); assert.equal(f.effects.now, 0); unchanged(f, prior);
  });
  await test('other character-only completion cannot be selected through current protagonist VectorEntry', () => {
    const f = replayFixture(); f.base.world.appendLegacyEvent(grayEvent('other-ordinary-completion', 'PremiereCompleted'), 'known-other');
    const prior = before(f); assert.throws(() => f.enter('other-ordinary-completion'), /自己的/);
    assert.equal(f.effects.prepares.length, 0); assert.equal(f.replay.isActive(), false); unchanged(f, prior);
  });
  await test('legal completion without actual historical snapshot rejects without reading current resources', () => {
    const f = replayFixture(); const prior = before(f); f.setSnapshots({ ...f.snapshots(), records: [] });
    assert.throws(() => f.enter(), /实际内容缺失/); assert.equal(f.effects.now, 0); assert.equal(f.effects.prepares.length, 0);
    assert.equal(f.effects.scoreWrites, 0); assert.equal(f.replay.getReader(), null); unchanged(f, prior);
  });
  await test('completion chart identity must match frozen snapshot before media preparation', () => {
    const f = replayFixture(); const raw = clone(f.snapshots()); raw.records[0].chartId = 'different-chart'; f.setSnapshots(raw);
    assert.throws(() => f.enter(), /合法首演完成引用/); assert.equal(f.effects.prepares.length, 0); assert.equal(f.effects.now, 0);
    assert.equal(f.replay.isActive(), false);
  });
  await test('media preparation failure never gates world publishes reader or consumes replay sequence', () => {
    const f = replayFixture(); const prior = before(f); f.failPrepare(); assert.throws(() => f.enter(), /media preparation failure/);
    assert.equal(f.replay.isActive(), false); assert.equal(f.replay.getReader(), null); unchanged(f, prior);
    f.failPrepare(false); f.enter(); f.complete(); assert.equal(f.effects.saves[0].playId, 'CHART_REPLAY:' + epochMs + ':1');
    assert.equal(f.effects.scoreWrites, 1);
  });
  await test('early chart exit preserves entry archive score ledger account and RecallCount', () => {
    const f = replayFixture(); const prior = before(f); const score = f.scores(); const snapshots = f.snapshots(); f.enter();
    f.media.time = 2000; f.tick([{ kind: 'ExitChart', videoTimeMs: 2000 }]);
    assert.equal(f.replay.isActive(), false); assert.equal(f.replay.getReader().getState(), 'Exited');
    assert.equal(f.replay.getReader().getResult().completed, false); assert.equal(f.effects.scoreWrites, 0);
    assert.equal(f.scores(), score); assert.equal(f.snapshots(), snapshots); unchanged(f, prior);
  });
  await test('fully settled notes alone wait for actual media completion and publish no score', () => {
    const f = replayFixture(); f.enter(); f.media.time = 6000; f.tick();
    assert.equal(f.replay.getReader().getResolvedCount(), f.replay.getReader().getTotalNoteCount());
    assert.equal(f.replay.isActive(), true); assert.equal(f.replay.getReader().getState(), 'Playing'); assert.equal(f.effects.scoreWrites, 0);
    f.media.ended = true; f.tick(); assert.equal(f.effects.scoreWrites, 1); assert.equal(f.replay.isActive(), false);
  });
  await test('real full replay stores completed zero-score result exactly once without Ledger Recall or account fact', () => {
    const f = replayFixture({ beforeSave(candidate, replay) { assert.equal(replay.isActive(), true);
      assert.equal(replay.getReader().getState(), 'Completed'); assert.equal(candidate.scores.records[0].completedPlayCount, 2); } });
    const prior = before(f); const snapshots = JSON.stringify(f.snapshots()); f.enter(); f.complete();
    assert.equal(f.effects.scoreWrites, 1); assert.equal(f.effects.saves[0].result.completed, true);
    assert.equal(f.effects.saves[0].result.totalScore, 0); assert.deepEqual(f.effects.saves[0].result, actualResult());
    assert.equal(f.scores().records[0].completedPlayCount, 2); assert.equal(JSON.stringify(f.snapshots()), snapshots);
    assert.equal(f.effects.recallWrites.length, 0); unchanged(f, prior); f.tick(); assert.equal(f.effects.scoreWrites, 1);
  });
  await test('actual timed player strikes improve score while frozen premiere content remains immutable', () => {
    const f = replayFixture(); const prior = before(f); const snapshots = JSON.stringify(f.snapshots()); f.enter();
    const chart = f.snapshots().records[0].chart;
    const strikes = [];
    for (const line of chart.lines) {
      strikes.push({ kind: 'Strike', keyId: 'Space', videoTimeMs: line.head.spawnTimeMs, phase: 'Down' });
      strikes.push({ kind: 'Strike', keyId: 'Space', videoTimeMs: line.head.spawnTimeMs + 1, phase: 'Up' });
      for (const node of line.nodes) {
        const time = line.timing.find(value => value.nodeId === node.id).targetTimeMs;
        const keyId = resolveGridKeyAt(h.layout, positionAtPathDistance(line.path, chart.aspectRatio, node.pathDistance));
        strikes.push({ kind: 'Strike', keyId, videoTimeMs: time, phase: 'Down' });
        strikes.push({ kind: 'Strike', keyId, videoTimeMs: time + 1, phase: 'Up' });
      }
    }
    for (const strike of strikes.sort((a, b) => a.videoTimeMs - b.videoTimeMs)) { f.media.time = strike.videoTimeMs; f.tick([strike]); }
    f.complete(); assert.equal(f.effects.scoreWrites, 1); assert(f.scores().records[0].best.totalScore > 0);
    assert.deepEqual(f.effects.saves[0].result, actualResult(chart, h.layout, { perfect: true }));
    assert.equal(JSON.stringify(f.snapshots()), snapshots); unchanged(f, prior);
  });
  await test('repeated full replay uses unique play IDs at same clock and never creates another premiere reference', () => {
    const f = replayFixture(); const prior = before(f); f.enter(); f.complete(); f.media.time = 0; f.media.ended = false; f.enter(); f.complete();
    assert.equal(f.scores().records[0].completedPlayCount, 3); assert.equal(f.effects.scoreWrites, 2);
    assert.equal(f.effects.saves[0].playId, 'CHART_REPLAY:' + epochMs + ':1');
    assert.equal(f.effects.saves[1].playId, 'CHART_REPLAY:' + epochMs + ':2');
    assert.equal(f.snapshots().records.length, 1); unchanged(f, prior);
  });
  await test('score durable failure keeps archive and Completed replay active; retry reuses identical playId exactly once', () => {
    const f = replayFixture(); const prior = before(f); const scores = JSON.stringify(f.scores()); f.enter(); f.failSave();
    assert.throws(() => f.complete(), /replay durable failure/); assert.equal(f.replay.isActive(), true);
    assert.equal(f.replay.getReader().getState(), 'Completed'); assert.equal(JSON.stringify(f.scores()), scores);
    assert.equal(f.effects.scoreWrites, 0); f.failSave(false); f.tick(); assert.equal(f.replay.isActive(), false);
    assert.equal(f.effects.saves.length, 2); assert.equal(f.effects.saves[0].playId, f.effects.saves[1].playId);
    assert.equal(f.effects.scoreWrites, 1); assert.equal(f.scores().records[0].completedPlayCount, 2); unchanged(f, prior);
  });
  await test('entry gates entire input batch including prior movement RecallEvent and ReplayTrace', () => {
    const f = replayFixture(); const prior = before(f); f.tick([{ kind: 'MoveAxis', lateral: 1, depth: 0 },
      { kind: 'RecallEvent', eventId: f.base.completion.eventId }, { kind: 'ReplayTrace', traceId: 'absent' },
      { kind: 'ReplayChart', completionEventId: f.base.completion.eventId }]);
    assert.equal(f.effects.forwarded.length, 0); assert.equal(f.effects.recallWrites.length, 0);
    assert.equal(f.replay.isActive(), true); unchanged(f, prior);
  });
  await test('exit batch remains gated for later movement and Recall inputs after replay becomes inactive', () => {
    const f = replayFixture(); const prior = before(f); f.enter(); f.tick([{ kind: 'ExitChart', videoTimeMs: 0 },
      { kind: 'MoveAxis', lateral: 1, depth: 0 }, { kind: 'RecallEvent', eventId: f.base.completion.eventId }]);
    assert.equal(f.replay.isActive(), false); assert.equal(f.effects.forwarded.length, 0);
    assert.equal(f.effects.recallWrites.length, 0); assert.equal(f.effects.scoreWrites, 0); unchanged(f, prior);
  });
  await test('idle own Recall and trace Replay share count while ChartReplay keeps that count unchanged', () => {
    const base = fixture(); base.world.appendLegacyEvent(grayEvent('T6_ENDPOINT_PLACEHOLDER', 'Entry'));
    const f = replayFixture({ base }); const ledger = JSON.stringify(base.world.getLedgerSnapshot());
    f.tick([{ kind: 'RecallEvent', eventId: 'T6_ENDPOINT_PLACEHOLDER' }]);
    f.tick([{ kind: 'ReplayTrace', traceId: 'T6_MAIN_DEEP_TRACE' }]);
    assert.equal(f.recalls.getCount('T6_ENDPOINT_PLACEHOLDER'), 2); assert.equal(f.effects.recallWrites.length, 2);
    f.enter(); f.complete(); assert.equal(f.recalls.getCount('T6_ENDPOINT_PLACEHOLDER'), 2);
    assert.equal(f.effects.recallWrites.length, 2); assert.equal(JSON.stringify(base.world.getLedgerSnapshot()), ledger);
  });
  await test('existing world motion gate blocks ReplayChart RecallEvent and ReplayTrace without changing state', () => {
    const f = replayFixture(); const prior = before(f); f.gate();
    f.tick([{ kind: 'ReplayChart', completionEventId: f.base.completion.eventId },
      { kind: 'RecallEvent', eventId: f.base.completion.eventId }, { kind: 'ReplayTrace', traceId: 'absent' }]);
    assert.equal(f.replay.isActive(), false); assert.equal(f.effects.now, 0); assert.equal(f.effects.recallWrites.length, 0); unchanged(f, prior);
  });
  await test('pause freezes media timeout and score until resumed and actual end is observed', () => {
    const f = replayFixture(); f.enter(); f.media.time = 100; f.tick([{ kind: 'ToggleChartPause', videoTimeMs: 100 }]);
    assert.equal(f.replay.getReader().getState(), 'Paused'); f.media.unavailable = true; f.tick([], 60);
    assert.equal(f.replay.getReader().getState(), 'Paused'); assert.equal(f.effects.scoreWrites, 0);
    assert.equal(f.replay.getReader().getCurrentTimeMs(), 100);
    f.media.unavailable = false; f.tick([{ kind: 'ToggleChartPause', videoTimeMs: 100 }]); f.complete(); assert.equal(f.effects.scoreWrites, 1);
  });
  await test('early media end advances remaining judgments via independent frame clock before complete score', () => {
    const f = replayFixture(); f.enter(); f.media.time = 0; f.media.ended = true;
    f.tick([], 0.1); assert.equal(f.effects.scoreWrites, 0);
    for (let frame = 0; frame < 80 && f.replay.isActive(); frame++) { f.tick([], 0.1); }
    assert.equal(f.replay.isActive(), false); assert.equal(f.effects.scoreWrites, 1);
    assert.equal(f.effects.saves[0].result.completed, true); assert.equal(f.effects.saves[0].result.missCount, 5);
  });
  await test('unavailable media with stalled native clock completes only after explicit timeout fallback', () => {
    const f = replayFixture(); f.enter(); f.media.time = 0; f.media.unavailable = true;
    f.tick([], 29); assert.equal(f.effects.scoreWrites, 0); assert.equal(f.replay.isActive(), true);
    f.tick([], 1); assert(f.replay.getReader().getCurrentTimeMs() > 0); assert.equal(f.effects.scoreWrites, 0);
    // ChartPremiere also requires its own unavailable interval after all judgments settle.
    for (let second = 0; second < 100 && f.replay.isActive(); second++) { f.tick([], 1); }
    assert.equal(f.effects.scoreWrites, 1); assert.equal(f.replay.isActive(), false);
    assert.equal(f.effects.saves[0].result.completed, true);
  });
  await test('invalid replay timestamp rejects before media setup gate and score write', () => {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const f = replayFixture(); const prior = before(f); f.setClock(value); assert.throws(() => f.enter(), /时钟无效/);
      assert.equal(f.replay.isActive(), false); assert.equal(f.effects.prepares.length, 0); assert.equal(f.effects.scoreWrites, 0); unchanged(f, prior);
    }
  });
  await test('legacy T7 no-state completion replays only its actual frozen Regular snapshot without changing old record', () => {
    const base = fixture({ completed: false }); const old = grayEvent('T7_COMPLETION_PLACEHOLDER', undefined);
    base.world.appendLegacyEvent(old); const chart = parseGuidanceChart(h.regular, h.layout);
    const visual = { schemaVersion: 1, chartId: chart.chartId, nodes: chart.lines.flatMap(line => line.nodes.map(node =>
      ({ nodeId: node.id, color: { r: 255, g: 255, b: 255 } }))) };
    const archive = new ChartArchive(base.archiveContext); const events = base.world.getLedgerEvents();
    const archived = archive.preparePremiere({ completionEventId: old.eventId, chart, layout: h.layout, visual,
      media: h.mediaIdentity, guideTransparency: 0, result: actualResult(chart) }, events);
    const f = replayFixture({ base, snapshots: archived.snapshots, scores: archived.scores }); const prior = before(f);
    f.enter(old.eventId); f.complete(); assert.equal(f.effects.scoreWrites, 1); assert.equal(f.scores().records[0].completedPlayCount, 2);
    assert.equal(f.replay.getReader().getTier(), 'Regular'); unchanged(f, prior);
    assert.equal(Object.hasOwn(base.world.getLedgerEvents()[0].ChartRef, 'state'), false);
  });
  await test('legacy Entry T6 cannot masquerade as a completed VectorEntry even with a matching offered record ID', () => {
    const f = replayFixture(); f.base.world.appendLegacyEvent(grayEvent('T6_ENDPOINT_PLACEHOLDER', undefined));
    const raw = clone(f.snapshots()); raw.records[0].completionEventId = 'T6_ENDPOINT_PLACEHOLDER'; raw.records[0].chartId = h.regular.chartId;
    f.setSnapshots(raw); const prior = before(f); assert.throws(() => f.enter('T6_ENDPOINT_PLACEHOLDER'), /合法首演完成引用/);
    assert.equal(f.effects.prepares.length, 0); assert.equal(f.effects.scoreWrites, 0); unchanged(f, prior);
  });
  const report = { category: 'ContractTest', note: 'Real ChartReplaySession around WorldClearSession, real formal World ChartPremiere results and controlled media probes. Frozen content, score-only writes, legacy T7 compatibility, exit/pause/failure semantics. No Cocos acceptance claim.', passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'replay.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'replay.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 1, results, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
