'use strict';
// Leased single-document persistence contracts. Controlled adapters are never Cocos acceptance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('./state-test-fixture.cjs');
const { load, clone, fixture, actualResult, epochMs, ChartArchive, chartContentDigest } = h;
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { WorldStateStorage } = load('src/presentation/WorldStateStorage.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { VectorSchemaVersion, NarrativeDimension } = load('constants/index.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const key = (a, w) => 'neurou-world-state-v1:' + encodeURIComponent(a) + ':' + encodeURIComponent(w);
class ExclusiveLock {
  constructor() { this.tails = new Map(); this.calls = []; }
  request(name, operation) {
    this.calls.push(name); const preceding = this.tails.get(name) || Promise.resolve();
    const current = preceding.catch(() => {}).then(operation); this.tails.set(name, current); return current;
  }
}
function storageFixture(options = {}) {
  const f = fixture(options); const memory = options.memory || new Map(), writes = [];
  const lock = options.lock === undefined ? new ExclusiveLock() : options.lock;
  let active = true, fail = false;
  const adapter = { getItem: name => memory.get(name) ?? null, setItem: (name, value) => {
    if (fail) { throw new Error('controlled atomic storage failure'); } writes.push({ key: name, value }); memory.set(name, value);
  } };
  const validate = (raw, accountId, worldId) => f.codec.parse(raw, accountId, worldId);
  const storage = new WorldCoreStateStorage(adapter, lock, validate, (accountId, worldId) =>
    active && accountId === f.context.accountId && worldId === f.context.worldId);
  if (options.preload !== false) { memory.set(key(f.context.accountId, f.context.worldId), JSON.stringify(f.initial)); }
  return { ...f, memory, writes, lock, adapter, storage, validate,
    fail(value = true) { fail = value; }, deleteWorld() { active = false; },
    next(mutate = () => {}) { const raw = clone(storage.readValidatedCoreState(f.context.accountId, f.context.worldId) || f.initial);
      raw.revision++; raw.capturedAt++; mutate(raw); return raw; },
    raw() { return memory.get(key(f.context.accountId, f.context.worldId)); },
    lease() { return storage.acquireWorldLease(f.context.accountId, f.context.worldId); } };
}
function replayCandidate(f, prior, playId, perfect = false) {
  const archive = new ChartArchive(f.archiveContext, prior.sections.ChartSnapshot, prior.sections.ChartScore);
  return archive.prepareReplay({ chartId: h.chart.chartId, playId, guideTransparency: 0,
    result: actualResult(h.chart, h.layout, { perfect }) }, f.events);
}
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
(async () => {
  await test('seven sections share exact same account/world key and one locked write; complete round trip preserves real archive', async () => {
    const f = storageFixture({ preload: false }); const lease = await f.lease();
    const saved = f.storage.saveCoreState(f.initial, null); assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].key, key(f.context.accountId, f.context.worldId)); assert.equal(f.memory.size, 1);
    assert.deepEqual(Object.keys(saved.sections), ['Ledger', 'PuzzleProgress', 'FormatTime', 'RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']);
    const complete = f.codec.parseComplete(f.storage.readCoreState(f.context.accountId, f.context.worldId));
    assert.equal(complete.sections.ChartSnapshot.records[0].completionEventId, f.completion.eventId);
    assert.equal(complete.sections.ChartScore.records[0].best.completed, true);
    assert.equal(f.lock.calls[0], 'neurou-world-state:' + encodeURIComponent(f.context.accountId) + ':' + encodeURIComponent(f.context.worldId));
    lease.release();
  });
  await test('save without exact world lease rejects before storage write and missing lock rejects graph activation', async () => {
    const f = storageFixture(); const before = f.raw(); assert.throws(() => f.storage.saveCoreState(f.next(), f.initial), /租约/);
    const missing = storageFixture({ lock: null }); await assert.rejects(missing.lease(), /独占锁/);
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 0); assert.equal(missing.writes.length, 0);
  });
  await test('counter and real replay score update together in a single durable seven-section document', async () => {
    const f = storageFixture(); const lease = await f.lease(); const prior = f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId);
    const replay = replayCandidate(f, prior, 'replay-shared-document', true);
    const next = f.next(raw => {
      raw.sections.RecallCount.records.push({ characterId: f.context.protagonistCharacterId, eventId: f.completion.eventId, count: 1 });
      raw.sections.ChartSnapshot = replay.snapshots; raw.sections.ChartScore = replay.scores;
    }); const saved = f.storage.saveCoreState(next, prior);
    assert.equal(f.writes.length, 1); assert.equal(saved.sections.RecallCount.records[0].count, 1);
    assert.equal(saved.sections.ChartScore.records[0].completedPlayCount, 2);
    assert(saved.sections.ChartScore.records[0].best.totalScore > prior.sections.ChartScore.records[0].best.totalScore);
    assert.deepEqual(saved.sections.Ledger, prior.sections.Ledger); assert.deepEqual(saved.sections.FormatTime, prior.sections.FormatTime);
    lease.release();
  });
  await test('atomic storage failure preserves original exact bytes and all seven validated prior values; retry increments once', async () => {
    const f = storageFixture(); const lease = await f.lease(); const prior = f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId);
    const next = f.next(raw => raw.sections.RecallCount.records.push({ characterId: f.context.protagonistCharacterId, eventId: f.completion.eventId, count: 1 }));
    const before = f.raw(); f.fail(); assert.throws(() => f.storage.saveCoreState(next, prior), /atomic storage failure/);
    assert.equal(f.raw(), before); assert.deepEqual(f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId), prior);
    assert.equal(f.writes.length, 0); f.fail(false); assert.equal(f.storage.saveCoreState(next, prior).revision, 1); assert.equal(f.writes.length, 1);
    lease.release();
  });
  await test('idempotent identical document performs no write while stale expected and revision jumps reject', async () => {
    const f = storageFixture(); const lease = await f.lease(); assert.deepEqual(f.storage.saveCoreState(f.initial, f.initial), f.initial);
    assert.equal(f.writes.length, 0); const next = f.next(); f.storage.saveCoreState(next, f.initial); const before = f.raw();
    assert.throws(() => f.storage.saveCoreState({ ...next, revision: 2 }, f.initial), /陈旧写入/);
    for (const revision of [0, 1, 3]) { assert.throws(() => f.storage.saveCoreState({ ...next, revision, capturedAt: epochMs + 9 }, next)); }
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 1); lease.release();
  });
  await test('legacy three-section documents stay readable but cannot drop four established carriers on write', async () => {
    const f = storageFixture(); const lease = await f.lease(); const legacy = clone(f.initial);
    for (const name of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) { delete legacy.sections[name]; }
    assert.equal(f.codec.parse(legacy).sections.RecallCount, undefined); assert.throws(() => f.codec.parseComplete(legacy));
    legacy.revision = 1; assert.throws(() => f.storage.saveCoreState(legacy, f.initial)); assert.equal(f.writes.length, 0);
    lease.release();
  });
  await test('partial extension migration rejects and reads never mutate legacy bytes', () => {
    const f = storageFixture(); const legacy = clone(f.initial);
    for (const name of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) { delete legacy.sections[name]; }
    const stored = JSON.stringify(legacy); f.memory.set(key(f.context.accountId, f.context.worldId), stored);
    assert.equal(f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId).sections.ChartScore, undefined);
    assert.equal(f.raw(), stored); assert.equal(f.writes.length, 0);
    legacy.sections.RecallCount = f.initial.sections.RecallCount; assert.throws(() => f.storage.validateCoreState(legacy), /同组/);
  });
  await test('authoritative creation time and ledger append-only facts cannot change during extended updates', async () => {
    const f = storageFixture(); const lease = await f.lease(); const before = f.raw();
    for (const mutate of [r => r.sections.FormatTime.epochMs++, r => r.sections.Ledger.characters[0].events.pop(),
      r => r.sections.Ledger.control.sphereCrossed = false, r => r.sections.Ledger.contentRevision = 'other']) {
      assert.throws(() => f.storage.saveCoreState(f.next(mutate), f.initial));
    }
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 0); lease.release();
  });
  await test('established RecallCount records cannot be removed lowered or replaced by null', async () => {
    const f = storageFixture(); const lease = await f.lease(); const added = f.next(raw => raw.sections.RecallCount.records.push({
      characterId: f.context.protagonistCharacterId, eventId: f.completion.eventId, count: 3 }));
    const prior = f.storage.saveCoreState(added, f.initial); const before = f.raw();
    for (const mutate of [r => r.sections.RecallCount.records = [], r => r.sections.RecallCount.records[0].count = 2,
      r => r.sections.RecallCount = null]) { assert.throws(() => f.storage.saveCoreState(f.next(mutate), prior), /回忆/); }
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 1); lease.release();
  });
  await test('T6 established canonical binding cannot be removed while its authoritative terminal event remains', async () => {
    const f = storageFixture(); const lease = await f.lease(); const next = f.next(raw => {
      raw.sections.Ledger.characters[0].events.push({ eventId: 'T6_ENDPOINT_PLACEHOLDER', vector: Object.values(NarrativeDimension).filter(v => typeof v === 'number').map(() => 0),
        VectorSchemaVersion, AppendedAt: { epochMs }, InputSource: InputSource.Player, ChapterTag: {}, ChartRef: { chartId: h.regular.chartId, state: 'Entry' } });
      raw.sections.RecallCount = f.recall.getSnapshot(raw.sections.Ledger);
      const { PuzzleChain } = load('src/trace/PuzzleChain.ts'); const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
      const chain = new PuzzleChain(new PuzzleProgress(), 1000); chain.evaluateStepCondition(0, { x: 0.5, y: 0.5 });
      for (let beat = 0; beat < 7; beat++) { const time = 10000 + beat * 1000;
        chain.attemptStrike({ strikeTimeMs: time, targetBeatTimeMs: time }); chain.checkSustainedExpiry(time); }
      assert.equal(chain.checkSustainedExpiry(17000), true); raw.sections.PuzzleProgress[0].chain = chain.capturePrivateState();
      Object.assign(raw.sections.PuzzleProgress[0].control, { endpointSettled: true, deepTraceTriggered: true, revealPhase: 'Finished' });
    }); const prior = f.storage.saveCoreState(next, f.initial); const before = f.raw();
    assert.throws(() => f.storage.saveCoreState(f.next(raw => raw.sections.RecallCount.traceBindings = []), prior), /绑定/);
    assert.equal(f.raw(), before); lease.release();
  });
  await test('frozen chart/layout/visual/media/transparency snapshot cannot be replaced by a newly valid digest', async () => {
    const f = storageFixture(); const lease = await f.lease(); const before = f.raw();
    const next = f.next(raw => {
      const snapshot = raw.sections.ChartSnapshot.records[0]; snapshot.guideTransparency = 25;
      snapshot.contentDigest = chartContentDigest({ chart: snapshot.chart, layout: snapshot.layout, visual: snapshot.visual,
        media: snapshot.media, guideTransparency: snapshot.guideTransparency });
      const score = raw.sections.ChartScore.records[0]; score.snapshotDigest = snapshot.contentDigest;
      score.best.guideTransparency = 25; score.latest.guideTransparency = 25;
    }); assert.doesNotThrow(() => f.codec.parse(next));
    assert.throws(() => f.storage.saveCoreState(next, f.initial), /冻结/); assert.equal(f.raw(), before); assert.equal(f.writes.length, 0);
    lease.release();
  });
  await test('established chart/score collections cannot be erased through normal live-world save', async () => {
    const f = storageFixture(); const lease = await f.lease(); const before = f.raw();
    for (const name of ['ChartSnapshot', 'ChartScore']) {
      assert.throws(() => f.storage.saveCoreState(f.next(raw => raw.sections[name] = null), f.initial));
    }
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 0); lease.release();
  });
  await test('completed score count and prior best cannot regress after a real higher-score replay', async () => {
    const f = storageFixture(); const lease = await f.lease(); const replay = replayCandidate(f, f.initial, 'score-improved', true);
    const prior = f.storage.saveCoreState(f.next(raw => raw.sections.ChartScore = replay.scores), f.initial); const before = f.raw();
    assert.throws(() => f.storage.saveCoreState(f.next(raw => raw.sections.ChartScore = f.initial.sections.ChartScore), prior));
    const regression = f.next(raw => { const score = raw.sections.ChartScore.records[0]; score.best = clone(f.initial.sections.ChartScore.records[0].best);
      score.latest = clone(f.initial.sections.ChartScore.records[0].latest); score.latest.playId = 'lower-play';
      score.completedPlayIds.push('lower-play'); score.completedPlayCount++; });
    assert.doesNotThrow(() => f.codec.parse(regression)); assert.throws(() => f.storage.saveCoreState(regression, prior), /回退|最高/);
    assert.equal(f.raw(), before); lease.release();
  });
  await test('same-count score rewrite and historical completed play-ID replacement reject with bytes preserved', async () => {
    const f = storageFixture(); const lease = await f.lease(); const replay = replayCandidate(f, f.initial, 'frozen-history');
    const prior = f.storage.saveCoreState(f.next(raw => raw.sections.ChartScore = replay.scores), f.initial); const before = f.raw();
    const changed = f.next(raw => { const score = raw.sections.ChartScore.records[0]; score.latest.playId = 'replaced-history'; score.completedPlayIds[1] = 'replaced-history'; });
    assert.doesNotThrow(() => f.codec.parse(changed)); assert.throws(() => f.storage.saveCoreState(changed, prior));
    assert.equal(f.raw(), before); lease.release();
  });
  await test('new replay cannot rewrite historical best or replace its winner on an equal-score tie', async () => {
    const f = storageFixture(); const lease = await f.lease(); const before = f.raw();
    const replay = replayCandidate(f, f.initial, 'new-low-score');
    const forged = f.next(raw => { raw.sections.ChartScore = clone(replay.scores);
      const best = raw.sections.ChartScore.records[0].best; best.perfectCount = 5; best.missCount = 0; best.totalScore = 500; });
    assert.doesNotThrow(() => f.codec.parse(forged)); assert.throws(() => f.storage.saveCoreState(forged, f.initial));
    const tie = f.next(raw => { raw.sections.ChartScore = clone(replay.scores);
      raw.sections.ChartScore.records[0].best = clone(raw.sections.ChartScore.records[0].latest); });
    assert.doesNotThrow(() => f.codec.parse(tie)); assert.throws(() => f.storage.saveCoreState(tie, f.initial));
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 0); lease.release();
  });
  await test('single durable replay transaction cannot skip completed-play counters even with valid full history', async () => {
    const f = storageFixture(); const lease = await f.lease(); const before = f.raw();
    const first = replayCandidate(f, f.initial, 'jump-first');
    const intermediate = { ...f.initial, sections: { ...f.initial.sections, ChartScore: first.scores } };
    const second = replayCandidate(f, intermediate, 'jump-second');
    const jump = f.next(raw => raw.sections.ChartScore = second.scores);
    assert.doesNotThrow(() => f.codec.parse(jump)); assert.equal(jump.sections.ChartScore.records[0].completedPlayCount, 3);
    assert.throws(() => f.storage.saveCoreState(jump, f.initial)); assert.equal(f.raw(), before); assert.equal(f.writes.length, 0);
    lease.release();
  });
  await test('tombstone-only chart GC requires exact world lease and rejects an active world', async () => {
    const f = storageFixture(); const before = f.raw(); assert.throws(() => f.storage.clearDeletedChartState(f.context.accountId, f.context.worldId), /删除世界/);
    const lease = await f.lease(); assert.throws(() => f.storage.clearDeletedChartState(f.context.accountId, f.context.worldId), /删除世界/);
    lease.release(); await tick(); f.deleteWorld(); assert.throws(() => f.storage.clearDeletedChartState(f.context.accountId, f.context.worldId));
    assert.equal(f.raw(), before); assert.equal(f.writes.length, 0);
  });
  await test('GC failure keeps tombstone and exact frozen bytes; successful retry clears only chart state once', async () => {
    const f = storageFixture(); const lease = await f.lease(); f.deleteWorld(); const before = f.raw(); f.fail();
    assert.throws(() => f.storage.clearDeletedChartState(f.context.accountId, f.context.worldId), /atomic storage failure/); assert.equal(f.raw(), before);
    assert.throws(() => f.storage.saveCoreState(f.next(), f.initial), /已删除/); f.fail(false);
    f.storage.clearDeletedChartState(f.context.accountId, f.context.worldId);
    const cleaned = f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId);
    assert.equal(cleaned.sections.ChartSnapshot, null); assert.equal(cleaned.sections.ChartScore, null); assert.equal(cleaned.revision, 1);
    for (const name of ['Ledger', 'PuzzleProgress', 'FormatTime', 'RecallCount', 'WorldLink']) { assert.deepEqual(cleaned.sections[name], f.initial.sections[name]); }
    f.storage.clearDeletedChartState(f.context.accountId, f.context.worldId); assert.equal(f.writes.length, 1); lease.release();
  });
  await test('different worlds/accounts isolate keys and exact leases; one world lease cannot authorize another', async () => {
    const memory = new Map(), lock = new ExclusiveLock(); const a = storageFixture({ accountId: 'a/one', worldId: 'w:one', memory, lock });
    const b = storageFixture({ accountId: 'a/two', worldId: 'w:one', memory, lock }); const c = storageFixture({ accountId: 'a/one', worldId: 'w:two', memory, lock });
    const lease = await a.lease(); const beforeB = b.raw(), beforeC = c.raw(); assert.throws(() => a.storage.saveCoreState(b.next(), b.initial), /租约/);
    a.storage.saveCoreState(a.next(), a.initial); assert.equal(b.raw(), beforeB); assert.equal(c.raw(), beforeC);
    assert.equal(memory.size, 3); assert.notEqual(key(a.context.accountId, a.context.worldId), key(b.context.accountId, b.context.worldId));
    lease.release();
  });
  await test('real exclusive lock serializes two storage instances sharing same identity until release', async () => {
    const memory = new Map(), lock = new ExclusiveLock(); const a = storageFixture({ memory, lock }); const b = storageFixture({ memory, lock });
    const first = await a.lease(); let acquired = false; const pending = b.lease().then(lease => { acquired = true; return lease; });
    await tick(); assert.equal(acquired, false); a.storage.saveCoreState(a.next(), a.initial); first.release();
    const second = await pending; assert.equal(acquired, true); assert.equal(b.storage.readValidatedCoreState(b.context.accountId, b.context.worldId).revision, 1);
    second.release();
  });
  await test('world lease retainUntil holds through queued account commit and only releases after settlement', async () => {
    const f = storageFixture(); const lease = await f.lease(); let finish; const commit = new Promise(resolve => finish = resolve);
    lease.retainUntil(commit); lease.release(); assert.throws(() => lease.retainUntil(Promise.resolve()), /已请求释放/);
    assert.doesNotThrow(() => f.storage.saveCoreState(f.next(), f.initial)); finish(); await tick();
    assert.throws(() => f.storage.saveCoreState(f.next(), f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId)), /租约/);
  });
  await test('WorldStateStorage unbound rejects any save; bound writer validates then delegates to same leased key', async () => {
    const f = storageFixture(); const storage = new WorldStateStorage(f.adapter); const before = f.raw();
    assert.throws(() => storage.saveSnapshot(f.initial), /未装配/); assert.equal(f.raw(), before);
    let validations = 0, delegations = 0;
    storage.bindCompleteWriter({ validate(raw) { validations++; return f.codec.parseComplete(raw); },
      save(snapshot, expected) { delegations++; return f.storage.saveCoreState(snapshot, expected); } });
    assert.throws(() => storage.saveSnapshot(f.next(), f.initial), /租约/); assert.equal(f.writes.length, 0);
    const lease = await f.lease(); const saved = storage.saveSnapshot(f.next(), f.initial); assert.equal(saved.revision, 1);
    assert.equal(validations, 2); assert.equal(delegations, 2); assert.equal(f.writes.length, 1);
    assert.deepEqual(storage.readSnapshot(f.context.accountId, f.context.worldId), clone(saved)); lease.release();
  });
  await test('corrupt stored JSON and unsafe snapshot identity reject without rewriting or invoking getters', async () => {
    const f = storageFixture(); const lease = await f.lease(); let calls = 0; const raw = clone(f.initial);
    Object.defineProperty(raw, 'accountId', { get() { calls++; return f.context.accountId; } });
    assert.throws(() => f.storage.saveCoreState(raw, f.initial)); assert.equal(calls, 0); assert.equal(f.writes.length, 0);
    f.memory.set(key(f.context.accountId, f.context.worldId), '{broken'); assert.throws(() => f.storage.readValidatedCoreState(f.context.accountId, f.context.worldId), /JSON/);
    assert.equal(f.raw(), '{broken'); assert.equal(f.writes.length, 0); lease.release();
  });
  const report = { category: 'ContractTest', note: 'Formal World premiere result and strict seven-section codec with controlled atomic storage and exclusive lock. Covers one-key transactions, monotonic history, GC and bound complete writer; no production-browser claim.', passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'storage.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'storage.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 1, results, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
