'use strict';
// Controlled clocks/storage are isolated contract fixtures, never Cocos acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = name => require(path.join(root, name));
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const { NarrativeDimension, VectorSchemaVersion } = load('constants/index.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { LedgerHydration } = load('src/director/LedgerHydration.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { validateWorldClearRecord } = load('src/director/RouteSignature.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const content = parseWorldNarrativeContent(readJson('assets/resources/world/primary-rain-dialogue.json'));
const context = Object.freeze({ accountId: 'ledger-contract', worldId: 'ledger-primary', worldKind: 'Primary',
  protagonistCharacterId: content.protagonistCharacterId });
const hydration = new LedgerHydration(context, content);
const dimensions = Object.values(NarrativeDimension).filter(value => typeof value === 'number');
const layout = createDefaultKeyboardPadLayout();
const chart = parseGuidanceChart(readJson('assets/resources/chart/primary-rain-world-1.json'), layout);
const clone = raw => JSON.parse(JSON.stringify(raw));
const flush = () => new Promise(resolve => setImmediate(resolve));
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
function fixture(options = {}) {
  const media = { time: -1, ended: false, unavailable: false };
  const writes = [], records = options.records || [], accountCalls = [], order = [];
  let now = options.now || 1791600000000;
  let failure = null;
  const session = new WorldClearSession(context, content, {
    submitFrameIntents() {}, getCurrentPerceptionMode() { return 'Normal'; }, getChartPlaybackState() { return 'Ready'; },
    isWorldMotionGated() { return false; },
  }, {
    now() { return ++now; }, readRecords() { return records; },
    persistLedger(snapshot) {
      if (failure) { const current = failure; failure = null; throw current; }
      if (options.beforePersist) { options.beforePersist(snapshot, session); }
      writes.push(hydration.validate(snapshot)); order.push('Ledger');
    },
    async commitRecord(record) {
      order.push('Account'); accountCalls.push(validateWorldClearRecord(record));
      if (options.accountFailure) { throw new Error('controlled account failure'); }
      if (!records.some(value => value.worldId === record.worldId)) { records.push(validateWorldClearRecord(record)); }
    },
  }, options.seed);
  const premiere = new ChartPremiere(chart, layout);
  if (options.bind !== false) {
    session.bindWorldChart(premiere, () => media.time, () => ({ ended: media.ended, unavailable: media.unavailable }));
  }
  return { session, premiere, media, writes, records, accountCalls, order,
    failOnce(error = new Error('controlled Ledger write failure')) { failure = error; },
    tick(intents = []) { session.submitFrameIntents(intents, 1 / 60); },
    choose() { this.tick([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }]); },
    enter() { media.time = 0; this.tick([{ kind: 'EnterWorldChart' }]); },
    async complete() { media.time = 6000; media.ended = true; this.tick(); await flush(); },
  };
}
function genericEvent(eventId, vector = dimensions.map(() => 0), source = InputSource.Player) {
  return { eventId, vector, VectorSchemaVersion, AppendedAt: { epochMs: 1791600000000 }, InputSource: source,
    ChapterTag: {}, ChartRef: { chartId: 'regular-contract', state: 'Entry' } };
}

(async () => {
  await test('empty authoritative Ledger snapshot has explicit account/world/protagonist/content and no fabricated event', () => {
    const f = fixture(); const snapshot = f.session.getLedgerSnapshot();
    assert.equal(snapshot.characters.length, 1); assert.deepEqual(snapshot.characters[0].events, []);
    assert.deepEqual(snapshot.control, { selectedChoiceId: null, sphereCrossed: false, entry: null, eventSequence: 0, completionEventId: null });
    assert.equal(snapshot.accountId, context.accountId); assert.equal(snapshot.contentRevision, content.contentRevision);
    assert.equal(f.writes.length, 0); assert.equal(f.accountCalls.length, 0);
  });
  await test('successful choice persists complete event, selected choice, crossing, entry and sequence before publishing memory', () => {
    const f = fixture({ beforePersist(next, session) {
      assert.equal(session.getLedgerEvents().length, 0); assert.equal(session.getWorldClearSnapshot().sphereCrossed, false);
      assert.equal(next.characters[0].events.length, 1); assert.equal(next.control.selectedChoiceId, content.interaction.choices[0].choiceId);
      assert.equal(next.control.sphereCrossed, true); assert.equal(next.control.entry.source, 'SphereCrossing');
    } });
    f.choose(); assert.equal(f.writes.length, 1); assert.deepEqual(f.writes[0], f.session.getLedgerSnapshot());
    assert.equal(f.session.getLedgerSnapshot().control.eventSequence, 1);
  });
  await test('failed choice persistence retains every prior Ledger and crossing/choice/entry guard; retry consumes sequence once', () => {
    const f = fixture(); const before = JSON.stringify(f.session.getLedgerSnapshot()); f.failOnce();
    assert.throws(() => f.choose(), /Ledger write failure/);
    assert.equal(JSON.stringify(f.session.getLedgerSnapshot()), before); assert.equal(f.writes.length, 0);
    assert.equal(f.accountCalls.length, 0); f.choose(); assert.equal(f.session.getLedgerSnapshot().control.eventSequence, 1);
  });
  await test('hydration clone freezes full nested data and rejects in-process getters without invoking them', () => {
    const f = fixture(); f.choose(); const raw = clone(f.session.getLedgerSnapshot());
    const value = hydration.validate(raw); raw.characters[0].events[0].vector[NarrativeDimension.Green] = 900;
    assert.equal(value.characters[0].events[0].vector[NarrativeDimension.Green], content.interaction.choices[0].vector[NarrativeDimension.Green]);
    assert(Object.isFrozen(value)); assert(Object.isFrozen(value.characters)); assert(Object.isFrozen(value.characters[0].events));
    assert(Object.isFrozen(value.characters[0].events[0].vector)); assert(Object.isFrozen(value.control.entry.ChartRef));
    let getterCalls = 0; const poison = clone(value);
    Object.defineProperty(poison, 'characters', { enumerable: true, get() { getterCalls++; return []; } });
    assert.equal(hydration.hydrate(poison).kind, 'Rejected'); assert.equal(getterCalls, 0);
  });
  await test('silent seed restores Ledger and guards without append, persistence, sphere callbacks or account commit', async () => {
    const original = fixture(); original.choose(); const seed = clone(original.session.getLedgerSnapshot());
    const restored = fixture({ seed }); await flush();
    assert.equal(restored.writes.length, 0); assert.equal(restored.accountCalls.length, 0);
    assert.deepEqual(restored.session.getLedgerSnapshot(), original.session.getLedgerSnapshot());
    restored.choose(); assert.equal(restored.session.getLedgerEvents().length, 1); assert.equal(restored.writes.length, 0);
    assert.equal(restored.session.getWorldClearSnapshot().sphereCrossed, true);
    assert.equal(restored.session.getWorldClearSnapshot().entry.entryId, seed.control.entry.entryId);
  });
  await test('silent seed permits retained entry to start a fresh complete premiere and keeps stable event sequence across clock rollback', async () => {
    const original = fixture(); original.choose();
    const restored = fixture({ seed: original.session.getLedgerSnapshot(), now: 1 }); restored.enter(); await restored.complete();
    assert.equal(restored.accountCalls.length, 1); assert.equal(restored.session.getLedgerSnapshot().control.eventSequence, 2);
    assert(restored.session.getLedgerSnapshot().control.completionEventId.endsWith(':2'));
    assert.equal(new Set(restored.session.getLedgerEvents().map(value => value.eventId)).size, 2);
  });
  await test('completed Ledger event/control are durable before account save and repeated Completed never appends again', async () => {
    const f = fixture(); f.choose(); f.enter(); await f.complete();
    assert.deepEqual(f.order, ['Ledger', 'Ledger', 'Account']); const snapshot = f.session.getLedgerSnapshot();
    assert.equal(snapshot.control.completionEventId, snapshot.characters[0].events[1].eventId);
    assert.equal(snapshot.characters[0].events[1].ChartRef.state, 'PremiereCompleted');
    f.tick([{ kind: 'EnterWorldChart' }, { kind: 'RetryWorldClear' }]); await flush();
    assert.equal(f.writes.length, 2); assert.equal(f.accountCalls.length, 1); assert.equal(f.session.getLedgerEvents().length, 2);
  });
  await test('failed completion Ledger persistence never commits account or consumes completion ID/sequence', async () => {
    const f = fixture(); f.choose(); f.enter(); const before = clone(f.session.getLedgerSnapshot());
    f.failOnce(); f.media.time = 6000; f.media.ended = true;
    assert.throws(() => f.tick(), /Ledger write failure/); await flush();
    assert.deepEqual(f.session.getLedgerSnapshot(), before); assert.equal(f.accountCalls.length, 0);
    f.tick(); await flush(); assert.equal(f.session.getLedgerEvents().length, 2); assert.equal(f.accountCalls.length, 1);
  });
  await test('durable completion without account record hydrates pending retry solely from original prefix fact, never auto-commits', async () => {
    const original = fixture({ accountFailure: true }); original.choose(); original.enter(); await original.complete();
    const originalRecord = original.accountCalls[0];
    const later = dimensions.map(() => 0); later[NarrativeDimension.Red] = 9;
    original.session.appendLegacyEvent(genericEvent('later-after-completed', later, InputSource.Autopilot));
    const restored = fixture({ seed: original.session.getLedgerSnapshot() }); await flush();
    assert.equal(restored.accountCalls.length, 0); assert.equal(restored.writes.length, 0);
    assert.equal(restored.session.getWorldClearSnapshot().completionStatus, 'Failed');
    restored.enter(); assert.equal(restored.session.isWorldChartActive(), false);
    restored.tick([{ kind: 'RetryWorldClear' }]); await flush();
    assert.deepEqual(restored.accountCalls, [originalRecord]); assert.equal(restored.session.getLedgerEvents().length, 3);
    assert.equal(restored.writes.length, 0); assert.equal(restored.session.getWorldClearSnapshot().completionStatus, 'Completed');
  });
  await test('durable account record plus restored completion accepts reader assembly but cannot reopen or append a second premiere', async () => {
    const original = fixture(); original.choose(); original.enter(); await original.complete();
    const restored = fixture({ seed: original.session.getLedgerSnapshot(), records: original.records });
    assert.equal(restored.session.getWorldClearSnapshot().completionStatus, 'Completed');
    restored.enter(); restored.choose(); restored.tick([{ kind: 'RetryWorldClear' }]); await flush();
    assert.equal(restored.session.isWorldChartActive(), false); assert.equal(restored.session.getLedgerEvents().length, 2);
    assert.equal(restored.writes.length, 0); assert.equal(restored.accountCalls.length, 0);
    assert(restored.session.getWorldChartReader());
  });
  await test('conflicting durable account completion cannot be accepted against restored authoritative Ledger fact', async () => {
    const original = fixture(); original.choose(); original.enter(); await original.complete();
    const record = clone(original.records[0]); record.clearedAt.epochMs++;
    assert.throws(() => fixture({ seed: original.session.getLedgerSnapshot(), records: [record] }), /冲突/);
  });
  await test('other character events are indexed and hydrated independently without adding to protagonist coordinate/crossing', () => {
    const f = fixture(); const vector = dimensions.map(() => 0); vector[NarrativeDimension.Red] = 10;
    f.session.appendLegacyEvent(genericEvent('other-role-fact', vector), 'companion-1');
    const snapshot = f.session.getLedgerSnapshot(); assert.equal(snapshot.characters.length, 2);
    assert.equal(snapshot.control.sphereCrossed, false); assert.equal(f.session.getLedgerEvents().length, 0);
    const restored = fixture({ seed: snapshot }); assert.deepEqual(restored.session.getLedgerSnapshot(), snapshot);
    assert.equal(restored.session.getWorldClearSnapshot().distance, 0);
  });
  await test('Autopilot outside does not create a crossing guard; only later real Player append does', () => {
    const f = fixture(); const vector = dimensions.map(() => 0); vector[NarrativeDimension.Blue] = 4;
    f.session.appendLegacyEvent(genericEvent('auto-outside', vector, InputSource.Autopilot));
    assert.equal(f.session.getLedgerSnapshot().control.sphereCrossed, false);
    const restored = fixture({ seed: f.session.getLedgerSnapshot() });
    restored.session.appendLegacyEvent(genericEvent('next-player'));
    assert.equal(restored.session.getLedgerSnapshot().control.sphereCrossed, true);
  });
  const base = fixture(); base.choose(); const chosen = clone(base.session.getLedgerSnapshot());
  const mutations = [
    ['wrong account', value => { value.accountId = 'other-account'; }],
    ['wrong world', value => { value.worldId = 'other-world'; }],
    ['wrong protagonist', value => { value.protagonistCharacterId = 'companion-1'; }],
    ['wrong content identity', value => { value.contentId += '-wrong'; }],
    ['wrong content revision', value => { value.contentRevision = '99.0.0'; }],
    ['unknown schema', value => { value.schemaVersion = 2; }],
    ['missing protagonist carrier', value => { value.characters = []; }],
    ['duplicate role', value => { value.characters.push(clone(value.characters[0])); }],
    ['duplicate event', value => { value.characters[0].events.push(clone(value.characters[0].events[0])); }],
    ['missing dimension', value => { value.characters[0].events[0].vector.pop(); }],
    ['negative dimension', value => { value.characters[0].events[0].vector[NarrativeDimension.Green] = -1; }],
    ['wrong vector version', value => { value.characters[0].events[0].VectorSchemaVersion = 2; }],
    ['choice altered vector', value => { value.characters[0].events[0].vector[NarrativeDimension.Green]++; }],
    ['choice wrong ID', value => { value.control.selectedChoiceId = content.interaction.choices[1].choiceId; }],
    ['choice missing guard', value => { value.control.selectedChoiceId = null; }],
    ['missing crossing guard', value => { value.control.sphereCrossed = false; }],
    ['missing entry', value => { value.control.entry = null; }],
    ['wrong entry unique key', value => { value.control.entry.entryId += ':other'; }],
    ['wrong entry world', value => { value.control.entry.worldId = 'other-world'; }],
    ['wrong entry source', value => { value.control.entry.source = 'DeepTrace'; }],
    ['wrong entry tier', value => { value.control.entry.tier = 'Regular'; }],
    ['wrong entry reference', value => { value.control.entry.ChartRef.state = 'PremiereCompleted'; }],
    ['wrong sequence', value => { value.control.eventSequence++; }],
    ['forged completion guard', value => { value.control.completionEventId = 'forged'; }],
    ['wrong event timestamp provenance', value => { value.characters[0].events[0].AppendedAt.epochMs++; }],
    ['Autopilot choice source', value => { value.characters[0].events[0].InputSource = InputSource.Autopilot; }],
    ['choice cross-role', value => { value.characters.push({ characterId: 'companion-1', events: value.characters[0].events }); value.characters[0].events = []; }],
    ['extra top-level field', value => { value.unfrozen = true; }],
    ['extra control field', value => { value.control.debug = true; }],
    ['sparse event array', value => { delete value.characters[0].events[0]; }],
  ];
  for (const [name, mutate] of mutations) {
    await test('strict hydration rejects ' + name + ' without mutating live state', () => {
      const value = clone(chosen); mutate(value); const before = JSON.stringify(base.session.getLedgerSnapshot());
      assert.equal(hydration.hydrate(value).kind, 'Rejected'); assert.throws(() => hydration.validate(value));
      assert.equal(JSON.stringify(base.session.getLedgerSnapshot()), before);
    });
  }
  await test('published choices with indistinguishable vectors reject hydration instead of guessing a provenance', () => {
    const ambiguous = clone(content); ambiguous.interaction.choices[1].vector = clone(ambiguous.interaction.choices[0].vector);
    const reader = new LedgerHydration(context, parseWorldNarrativeContent(ambiguous));
    assert.equal(reader.hydrate(chosen).kind, 'Rejected');
  });
  const report = { category: 'ContractTest', note: 'Strict Ledger snapshots and real WorldClearSession/ChartPremiere with controlled storage/media fixtures. No hydration fixture constitutes Cocos preview or complete WorldState restore.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'ledger.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'ledger.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length,
    failed: 1, results, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
