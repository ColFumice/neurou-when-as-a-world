'use strict';
// Strict RecallCount contracts against the real Ledger carrier. This is not production Cocos evidence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = name => require(path.join(root, name));
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { LedgerHydration } = load('src/director/LedgerHydration.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { NarrativeDimension, VectorSchemaVersion } = load('constants/index.ts');
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const content = parseWorldNarrativeContent(readJson('assets/resources/world/primary-rain-dialogue.json'));
const regular = readJson('assets/resources/chart/guidance_c.json');
const context = Object.freeze({ accountId: 'recall-contract', worldId: 'recall-primary',
  protagonistCharacterId: content.protagonistCharacterId, regularChartId: regular.chartId });
const worldContext = { ...context, worldKind: 'Primary' }; delete worldContext.regularChartId;
const hydration = new LedgerHydration(worldContext, content);
const clone = value => JSON.parse(JSON.stringify(value));
const dimensions = Object.values(NarrativeDimension).filter(value => typeof value === 'number');
const vector = (axis = NarrativeDimension.Blue, amount = 0.25) => dimensions.map(value => value === axis ? amount : 0);
const epochMs = 1791600000000;
const zero = () => dimensions.map(() => 0);
function event(eventId, options = {}) {
  return { eventId, vector: options.vector || vector(), VectorSchemaVersion,
    AppendedAt: { epochMs: options.time === undefined ? epochMs - 1000 : options.time },
    InputSource: options.source === undefined ? InputSource.Autopilot : options.source, ChapterTag: {},
    ChartRef: options.ref || { chartId: regular.chartId, state: 'Entry' } };
}
function endpoint(ref = { chartId: regular.chartId, state: 'Entry' }) {
  return event('T6_ENDPOINT_PLACEHOLDER', { source: InputSource.Player, vector: zero(), ref });
}
function fixture(options = {}) {
  const writes = [], ledgerWrites = [], effects = { now: 0, account: 0, append: 0 };
  let failure = false, ledgerFailure = false, carrierOverride;
  const world = new WorldClearSession(worldContext, content, {
    submitFrameIntents() {}, getCurrentPerceptionMode() { return 'Normal'; }, getChartPlaybackState() { return 'Ready'; },
    isWorldMotionGated() { return false; },
  }, { now: () => { throw new Error('Recall must not request World clock'); }, readRecords: () => [],
    commitRecord: async () => { effects.account++; throw new Error('Recall must not commit account'); },
    persistLedger(next) { if (ledgerFailure) { throw new Error('controlled ledger write failure'); }
      ledgerWrites.push(hydration.validate(next)); },
  });
  for (const [characterId, entry] of options.events || []) { world.appendLegacyEvent(entry, characterId); }
  let recall;
  const callbacks = {
    readLedger: () => carrierOverride === undefined ? world.getLedgerSnapshot() : carrierOverride,
    persistSnapshot(next) {
      if (failure) { throw new Error('controlled count write failure'); }
      if (options.beforePersist) { options.beforePersist(next, recall); }
      writes.push(clone(next));
    },
    appendForeignEvent: options.noAppend ? undefined : candidate => {
      effects.append++; world.appendLegacyEvent(candidate);
    },
    now: () => { effects.now++; return options.time === undefined ? epochMs : options.time; },
  };
  recall = new RecallCountSession(context, callbacks, options.seed);
  return { world, recall, callbacks, writes, ledgerWrites, effects,
    failCount(value = true) { failure = value; }, failLedger(value = true) { ledgerFailure = value; },
    overrideCarrier(value) { carrierOverride = value; },
    seed(snapshot) { return new RecallCountSession(context, callbacks, snapshot); },
  };
}
const own = context.protagonistCharacterId;
const other = 'known-companion';
const ownEvent = () => [own, event('own-memory')];
const foreignEvent = () => [other, event('shared-memory')];
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
const rejected = (f, value, ledger) => assert.equal(f.recall.hydrate(value, ledger).kind, 'Rejected');

(async () => {
  await test('real empty initialization produces explicit identity and no write/clock/append/account side effect', () => {
    const f = fixture(); assert.deepEqual(f.recall.getSnapshot(), { schemaVersion: 1, accountId: context.accountId,
      worldId: context.worldId, records: [], traceBindings: [] });
    assert.deepEqual(f.effects, { now: 0, account: 0, append: 0 }); assert.equal(f.writes.length, 0);
    assert.equal(f.ledgerWrites.length, 0);
  });
  await test('own Recall persists next count before publishing and never appends or crosses', () => {
    const f = fixture({ events: [ownEvent()], beforePersist(next, active) {
      assert.equal(active.getCount('own-memory'), 0); assert.equal(next.records[0].count, 1);
    } }); const before = f.world.getLedgerSnapshot();
    assert.deepEqual(f.recall.recall('own-memory'), { kind: 'Recalled', characterId: own, eventId: 'own-memory', count: 1 });
    assert.equal(f.recall.getCount('own-memory'), 1); assert.equal(f.writes.length, 1);
    assert.deepEqual(f.world.getLedgerSnapshot(), before); assert.equal(f.effects.now, 0); assert.equal(f.effects.append, 0);
  });
  await test('failed durable count write preserves bytes and count; retry publishes exactly one increment', () => {
    const f = fixture({ events: [ownEvent()] }); f.recall.recall('own-memory');
    const before = JSON.stringify(f.recall.getSnapshot()); const bytes = JSON.stringify(f.writes);
    f.failCount(); assert.throws(() => f.recall.recall('own-memory'), /count write failure/);
    assert.equal(JSON.stringify(f.recall.getSnapshot()), before); assert.equal(JSON.stringify(f.writes), bytes);
    f.failCount(false); assert.equal(f.recall.recall('own-memory').count, 2); assert.equal(f.writes.length, 2);
  });
  await test('T6 trace Replay and own Recall share one exact protagonist/event counter', () => {
    const f = fixture({ events: [[own, endpoint()]] });
    assert.deepEqual(f.recall.bindT6Trace(), { traceId: 'T6_MAIN_DEEP_TRACE', characterId: own, eventId: 'T6_ENDPOINT_PLACEHOLDER' });
    assert.equal(f.recall.recall('T6_ENDPOINT_PLACEHOLDER').count, 1);
    assert.deepEqual(f.recall.replay('T6_MAIN_DEEP_TRACE'), { kind: 'Replayed', characterId: own,
      eventId: 'T6_ENDPOINT_PLACEHOLDER', count: 2 }); assert.equal(f.recall.getSnapshot().records.length, 1);
    assert.equal(f.world.getLedgerEvents().length, 1); assert.equal(f.writes.length, 2);
  });
  await test('legacy T6 no-state Entry keeps original zero vector and supports exact trace binding', () => {
    const f = fixture({ events: [[own, endpoint({ chartId: regular.chartId })]] });
    assert.equal(f.recall.bindT6Trace().eventId, 'T6_ENDPOINT_PLACEHOLDER');
    assert.equal(f.recall.replay('T6_MAIN_DEEP_TRACE').count, 1);
    assert.equal(Object.hasOwn(f.world.getLedgerEvents()[0].ChartRef, 'state'), false);
  });
  await test('staged next Ledger derives T6 binding purely for the same durable document', () => {
    const f = fixture(); const next = clone(f.world.getLedgerSnapshot()); next.characters[0].events.push(endpoint());
    const snapshot = f.recall.getSnapshot(hydration.validate(next)); assert.equal(snapshot.traceBindings.length, 1);
    assert.equal(f.recall.getSnapshot().traceBindings.length, 0); assert.equal(f.world.getLedgerEvents().length, 0);
    assert.equal(f.writes.length, 0); assert.equal(f.ledgerWrites.length, 0); assert.equal(f.effects.now, 0);
  });
  await test('absent or wrong trace source never invents binding or mutates records', () => {
    const f = fixture({ events: [ownEvent()] }); const before = f.recall.getSnapshot();
    assert.throws(() => f.recall.bindT6Trace()); assert.throws(() => f.recall.replay('T6_MAIN_DEEP_TRACE'));
    assert.throws(() => f.recall.replay('unknown-trace')); assert.deepEqual(f.recall.getSnapshot(), before); assert.equal(f.writes.length, 0);
  });
  await test('T6 binding rejects wrong actor-only event, nonzero/source/chart/completed facts', () => {
    const f = fixture({ events: [[other, endpoint()]] }); assert.equal(f.recall.getSnapshot().traceBindings.length, 0);
    for (const change of [e => e.vector = vector(), e => e.InputSource = InputSource.Autopilot,
      e => e.ChartRef.chartId = 'other-chart', e => e.ChartRef.state = 'PremiereCompleted']) {
      const raw = clone(f.world.getLedgerSnapshot()); const entry = endpoint(); change(entry);
      raw.characters.find(c => c.characterId === own).events.push(entry); assert.throws(() => f.recall.getSnapshot(raw));
    }
  });
  await test('pure hydration validates clones/freezes and never replays or changes the active count', () => {
    const f = fixture({ events: [ownEvent(), [own, endpoint()]] }); const raw = clone(f.recall.getSnapshot());
    raw.records.push({ characterId: own, eventId: 'own-memory', count: 7 });
    const before = JSON.stringify(f.world.getLedgerSnapshot()); const result = f.recall.hydrate(raw);
    assert.equal(result.kind, 'Hydrated'); assert.equal(f.recall.getCount('own-memory'), 0);
    raw.records[0].count = 99; raw.traceBindings[0].eventId = 'corrupt';
    assert.equal(result.snapshot.records[0].count, 7); assert.equal(result.snapshot.traceBindings[0].eventId, 'T6_ENDPOINT_PLACEHOLDER');
    assert(Object.isFrozen(result.snapshot)); assert(Object.isFrozen(result.snapshot.records));
    assert(Object.isFrozen(result.snapshot.records[0])); assert(Object.isFrozen(result.snapshot.traceBindings[0]));
    assert.equal(JSON.stringify(f.world.getLedgerSnapshot()), before); assert.equal(f.writes.length, 0);
    assert.deepEqual(f.effects, { now: 0, account: 0, append: 0 });
  });
  await test('hydrated constructor installs exact persisted count silently and independently', () => {
    const f = fixture({ events: [ownEvent()] }); const raw = clone(f.recall.getSnapshot());
    raw.records.push({ characterId: own, eventId: 'own-memory', count: 4 }); const active = f.seed(raw);
    raw.records[0].count = 300; assert.equal(active.getCount('own-memory'), 4);
    assert.equal(f.recall.getCount('own-memory'), 0); assert.equal(f.writes.length, 0);
    assert.deepEqual(f.effects, { now: 0, account: 0, append: 0 });
  });
  await test('foreign first experience appends only ordinary source into current protagonist with fresh Player/time metadata', () => {
    const f = fixture({ events: [foreignEvent()] }); const source = clone(f.world.getLedgerSnapshot().characters.find(c => c.characterId === other).events[0]);
    const initialWrites = f.ledgerWrites.length;
    assert.deepEqual(f.recall.experienceForeignEvent(other, 'shared-memory'), { kind: 'Experienced', characterId: own, eventId: 'shared-memory', count: 0 });
    const written = f.world.getLedgerEvents()[0]; assert.equal(written.InputSource, InputSource.Player);
    assert.equal(written.AppendedAt.epochMs, epochMs); assert.deepEqual(written.vector, source.vector);
    assert.deepEqual(written.ChartRef, source.ChartRef); assert.deepEqual(written.ChapterTag, {});
    assert.deepEqual(f.world.getLedgerSnapshot().characters.find(c => c.characterId === other).events[0], source);
    assert.equal(f.ledgerWrites.length, initialWrites + 1); assert.equal(f.writes.length, 0); assert.equal(f.effects.now, 1);
    assert.equal(f.recall.getCount('shared-memory'), 0); assert.equal(f.world.getWorldClearSnapshot().sphereCrossed, false);
  });
  await test('foreign subsequent experience and own Recall use same one record without another Ledger append', () => {
    const f = fixture({ events: [foreignEvent()] }); f.recall.experienceForeignEvent(other, 'shared-memory');
    assert.equal(f.recall.recall('shared-memory').count, 1);
    assert.deepEqual(f.recall.experienceForeignEvent(other, 'shared-memory'), { kind: 'Recalled', characterId: own, eventId: 'shared-memory', count: 2 });
    assert.equal(f.recall.getSnapshot().records.length, 1); assert.equal(f.world.getLedgerEvents().length, 1); assert.equal(f.effects.now, 1);
  });
  await test('foreign first durable append failure leaves carrier and counts unchanged', () => {
    const f = fixture({ events: [foreignEvent()] }); const before = JSON.stringify(f.world.getLedgerSnapshot());
    f.failLedger(); assert.throws(() => f.recall.experienceForeignEvent(other, 'shared-memory'), /ledger write failure/);
    assert.equal(JSON.stringify(f.world.getLedgerSnapshot()), before); assert.deepEqual(f.recall.getSnapshot().records, []);
    f.failLedger(false); assert.equal(f.recall.experienceForeignEvent(other, 'shared-memory').kind, 'Experienced');
    assert.equal(f.world.getLedgerEvents().length, 1); assert.equal(f.writes.length, 0);
  });
  await test('missing foreign append capability rejects before clock and carrier mutation', () => {
    const f = fixture({ events: [foreignEvent()], noAppend: true }); const before = f.world.getLedgerSnapshot();
    assert.throws(() => f.recall.experienceForeignEvent(other, 'shared-memory')); assert.deepEqual(f.world.getLedgerSnapshot(), before);
    assert.equal(f.effects.now, 0); assert.equal(f.writes.length, 0);
  });
  await test('foreign actor/event authority rejects same actor unknown actor unknown event and cross-world carrier', () => {
    const f = fixture({ events: [foreignEvent()] });
    for (const args of [[own, 'shared-memory'], ['unknown-actor', 'shared-memory'], [other, 'absent']]) {
      assert.throws(() => f.recall.experienceForeignEvent(...args));
    }
    const raw = clone(f.world.getLedgerSnapshot()); raw.worldId = 'foreign-world'; f.overrideCarrier(raw);
    assert.throws(() => f.recall.experienceForeignEvent(other, 'shared-memory')); assert.equal(f.effects.now, 0); assert.equal(f.effects.append, 0);
  });
  await test('foreign source cannot carry World choices/completions T6 T7 or premiere completion into own Ledger', () => {
    for (const bad of [event('WORLD_UNTRUSTED'), endpoint(), event('T7_COMPLETION_PLACEHOLDER', { vector: zero(), source: InputSource.Player,
      ref: { chartId: regular.chartId, state: 'PremiereCompleted' } }), event('ordinary-completed', { ref: { chartId: regular.chartId, state: 'PremiereCompleted' } }),
      event('unknown-chart', { ref: { chartId: 'other-chart', state: 'Entry' } }), event('legacy-ordinary', { ref: { chartId: regular.chartId } })]) {
      const f = fixture({ events: [[other, bad]] }); const before = f.world.getLedgerSnapshot();
      assert.throws(() => f.recall.experienceForeignEvent(other, bad.eventId)); assert.deepEqual(f.world.getLedgerSnapshot(), before);
      assert.equal(f.effects.now, 0); assert.equal(f.effects.append, 0); assert.equal(f.writes.length, 0);
    }
  });
  await test('same event ID with differing source vector or reference rejects and never silently merges', () => {
    for (const entry of [event('shared-memory', { vector: vector(NarrativeDimension.Green) }),
      event('shared-memory', { ref: { chartId: 'other-chart', state: 'Entry' } })]) {
      const f = fixture({ events: [foreignEvent(), [own, entry]] });
      assert.throws(() => f.recall.experienceForeignEvent(other, 'shared-memory')); assert.equal(f.writes.length, 0);
      assert.equal(f.effects.now, 0); assert.equal(f.effects.append, 0);
    }
  });
  await test('ChartReplay never increments RecallCount persists or appends even for known chart', () => {
    const f = fixture({ events: [ownEvent(), [own, endpoint()]] }); f.recall.recall('own-memory');
    const before = f.recall.getSnapshot(); const ledger = f.world.getLedgerSnapshot(); const writes = f.writes.length;
    assert.deepEqual(f.recall.chartReplay(regular.chartId), { kind: 'ChartReplayIgnored', chartId: regular.chartId });
    assert.deepEqual(f.recall.getSnapshot(), before); assert.deepEqual(f.world.getLedgerSnapshot(), ledger); assert.equal(f.writes.length, writes);
    assert.equal(f.effects.now, 0); assert.equal(f.effects.append, 0);
  });
  await test('own Recall rejects absent and other-character-only events without fabricated zero records', () => {
    const f = fixture({ events: [foreignEvent()] });
    for (const eventId of ['absent', 'shared-memory']) { assert.throws(() => f.recall.recall(eventId)); assert.throws(() => f.recall.getCount(eventId)); }
    assert.deepEqual(f.recall.getSnapshot().records, []); assert.equal(f.writes.length, 0);
  });
  await test('strict snapshot rejects wrong version identity extras missing sections and malformed arrays', () => {
    const f = fixture({ events: [ownEvent()] }); const valid = clone(f.recall.getSnapshot());
    for (const mutate of [r => r.schemaVersion = 2, r => r.accountId = 'foreign', r => r.worldId = 'foreign',
      r => r.extra = true, r => delete r.traceBindings, r => r.records = {}, r => r.traceBindings = null,
      r => r.records = new Array(1), r => r.records.extra = true, r => r.records = Object.setPrototypeOf([], null)]) {
      const raw = clone(valid); mutate(raw); rejected(f, raw);
    }
  });
  await test('strict count records reject invalid count unknown cross-character reference duplicates and extra properties', () => {
    const f = fixture({ events: [ownEvent(), foreignEvent()] }); const valid = clone(f.recall.getSnapshot());
    for (const badCount of [-1, 0.25, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '1', null]) {
      rejected(f, { ...valid, records: [{ characterId: own, eventId: 'own-memory', count: badCount }] });
    }
    for (const record of [{ characterId: 'unknown', eventId: 'own-memory', count: 1 },
      { characterId: own, eventId: 'shared-memory', count: 1 }, { characterId: own, eventId: 'absent', count: 0 },
      { characterId: own, eventId: 'own-memory', count: 1, extra: true }]) { rejected(f, { ...valid, records: [record] }); }
    const row = { characterId: own, eventId: 'own-memory', count: 1 }; rejected(f, { ...valid, records: [row, row] });
    assert.equal(f.recall.hydrate({ ...valid, records: [{ ...row, count: 0 }] }).kind, 'Hydrated');
  });
  await test('strict trace references reject absent extra duplicated wrong actor event and unknown trace bindings', () => {
    const f = fixture({ events: [[own, endpoint()], [other, event('other-memory')]] }); const valid = clone(f.recall.getSnapshot());
    for (const mutate of [r => r.traceBindings = [], r => r.traceBindings.push(clone(r.traceBindings[0])),
      r => r.traceBindings[0].traceId = 'unknown', r => r.traceBindings[0].eventId = 'other-memory',
      r => r.traceBindings[0].characterId = other, r => r.traceBindings[0].extra = 1]) {
      const raw = clone(valid); mutate(raw); rejected(f, raw);
    }
  });
  await test('all snapshot getters symbols prototypes and sparse elements reject without executing getters', () => {
    const f = fixture({ events: [ownEvent()] }); let calls = 0; const valid = clone(f.recall.getSnapshot());
    for (const poison of [r => Object.defineProperty(r, 'records', { get() { calls++; return []; } }),
      r => r[Symbol('extra')] = true, r => Object.setPrototypeOf(r, { inherited: true }),
      r => { r.records = [{ characterId: own, eventId: 'own-memory', count: 1 }]; Object.defineProperty(r.records[0], 'count', { get() { calls++; return 1; } }); },
      r => { r.records = [null]; Object.defineProperty(r.records, '0', { get() { calls++; return {}; } }); }]) {
      const raw = clone(valid); poison(raw); rejected(f, raw);
    }
    const revocable = Proxy.revocable(clone(valid), {}); revocable.revoke(); rejected(f, revocable.proxy);
    assert.equal(calls, 0); assert.equal(f.writes.length, 0);
  });
  await test('authority Ledger rejects wrong identity missing protagonist duplicate roles/events and unsafe event data', () => {
    const f = fixture({ events: [ownEvent()] }); const valid = clone(f.world.getLedgerSnapshot()); let calls = 0;
    for (const mutate of [r => r.accountId = 'foreign', r => r.worldId = 'foreign', r => r.protagonistCharacterId = 'foreign',
      r => r.characters = [], r => r.characters.push(clone(r.characters[0])), r => r.characters[0].events.push(clone(r.characters[0].events[0])),
      r => Object.defineProperty(r.characters[0].events[0], 'vector', { get() { calls++; return zero(); } })]) {
      const raw = clone(valid); mutate(raw); assert.throws(() => f.recall.getSnapshot(raw));
    }
    assert.equal(calls, 0); assert.equal(f.writes.length, 0);
  });
  await test('safe integer overflow rejects increment before persistence and preserves exact hydrated count', () => {
    const f = fixture({ events: [ownEvent()] }); const raw = clone(f.recall.getSnapshot());
    raw.records.push({ characterId: own, eventId: 'own-memory', count: Number.MAX_SAFE_INTEGER }); const active = f.seed(raw);
    assert.throws(() => active.recall('own-memory')); assert.equal(active.getCount('own-memory'), Number.MAX_SAFE_INTEGER);
    assert.equal(f.writes.length, 0);
  });
  await test('reentrant mutation from persistence is blocked while read sees old published count', () => {
    let rejection;
    const f = fixture({ events: [ownEvent()], beforePersist(_next, active) {
      assert.equal(active.getCount('own-memory'), 0);
      try { active.recall('own-memory'); } catch (error) { rejection = error; }
    } }); assert.equal(f.recall.recall('own-memory').count, 1); assert.match(rejection.message, /不可重入/);
    assert.equal(f.writes.length, 1); assert.equal(f.recall.getCount('own-memory'), 1);
  });
  await test('context IDs and formal regular binding reject malformed or unbound context before side effects', () => {
    const f = fixture(); for (const mutate of [r => r.accountId = '', r => r.worldId = ' bad ',
      r => r.protagonistCharacterId = '\ud800', r => r.regularChartId = 'CHART_NOT_BOUND', r => r.extra = true]) {
      const value = clone(context); mutate(value); assert.throws(() => new RecallCountSession(value, f.callbacks));
    }
    assert.deepEqual(f.effects, { now: 0, account: 0, append: 0 }); assert.equal(f.writes.length, 0);
  });
  await test('unavailable authoritative carrier is rejected instead of fabricated empty initialized state', () => {
    const f = fixture(); f.overrideCarrier(null); assert.throws(() => new RecallCountSession(context, f.callbacks));
    assert.throws(() => f.recall.getSnapshot()); assert.equal(f.writes.length, 0);
    assert.deepEqual(f.effects, { now: 0, account: 0, append: 0 });
  });
  await test('foreign fresh timestamp must be a nonnegative safe integer and rejects before append', () => {
    for (const time of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const f = fixture({ events: [foreignEvent()], time }); const before = f.world.getLedgerSnapshot();
      assert.throws(() => f.recall.experienceForeignEvent(other, 'shared-memory')); assert.deepEqual(f.world.getLedgerSnapshot(), before);
      assert.equal(f.effects.append, 0); assert.equal(f.writes.length, 0);
    }
  });
  await test('foreign append callback cannot reenter Recall counter mutation', () => {
    const f = fixture({ events: [ownEvent(), foreignEvent()] }); let rejection;
    f.callbacks.appendForeignEvent = candidate => {
      try { f.recall.recall('own-memory'); } catch (error) { rejection = error; }
      f.world.appendLegacyEvent(candidate);
    };
    assert.equal(f.recall.experienceForeignEvent(other, 'shared-memory').kind, 'Experienced');
    assert.match(rejection.message, /不可重入/); assert.equal(f.recall.getCount('own-memory'), 0); assert.equal(f.writes.length, 0);
  });
  await test('foreign callback must publish exact source candidate in the same authoritative carrier', () => {
    const f = fixture({ events: [foreignEvent()] }); const before = f.world.getLedgerSnapshot();
    f.callbacks.appendForeignEvent = () => {};
    assert.throws(() => f.recall.experienceForeignEvent(other, 'shared-memory'), /权威载体/);
    assert.deepEqual(f.world.getLedgerSnapshot(), before); assert.equal(f.writes.length, 0);
  });
  const report = { category: 'ContractTest', note: 'RecallCount strict validation, pure hydration, durable shared own Recall/T6 Replay, director-only foreign first experience and ChartReplay exclusion. Controlled storage/clock and real WorldClearSession Ledger; no Cocos production claim.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'recall.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'recall.contract-results.json'), JSON.stringify({ category: 'ContractTest',
    passed: results.length, failed: 1, results, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
