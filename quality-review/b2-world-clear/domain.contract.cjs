'use strict';

// Contract fixtures use a controlled media probe, not a Cocos production preview.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..', '..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = relative => require(path.join(root, relative));
const json = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const { NarrativeDimension: Dimension, VectorSchemaVersion } = load('constants/index.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { deriveLedgerPosition, validateNarrativeVector } = load('src/ledger/deriveLedgerPosition.ts');
const { SphereCrossing } = load('src/director/SphereCrossing.ts');
const { classifyDivergenceAxis, deriveRouteSignature, validateWorldClearRecord } = load('src/director/RouteSignature.ts');
const { classifyChartReference, hasChartPremiereCompleted } = load('src/director/ChartReference.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { GuidanceEditorSession } = load('src/editor/GuidanceEditorSession.ts');
const dimensions = Object.values(Dimension).filter(value => typeof value === 'number');
const emotionAxes = [Dimension.Red, Dimension.Green, Dimension.Blue, Dimension.Black, Dimension.White, Dimension.Grey];
const contentRaw = json('assets/resources/world/primary-rain-dialogue.json');
const content = parseWorldNarrativeContent(contentRaw);
const publishedChart = json('assets/resources/chart/primary-rain-world-1.json');
const layout = createDefaultKeyboardPadLayout();
const chart = parseGuidanceChart(publishedChart, layout);
const results = [];
const vector = () => dimensions.map(() => 0);
const clone = raw => JSON.parse(JSON.stringify(raw));
function event(id, position = vector(), source = InputSource.Player, reference = { chartId: 'regular-fixture', state: 'Entry' }) {
  return { eventId: id, vector: position, VectorSchemaVersion, AppendedAt: { epochMs: 1791580800000 },
    InputSource: source, ChapterTag: {}, ChartRef: reference };
}
async function test(name, run) { await run(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
const flush = () => new Promise(resolve => setImmediate(resolve));

function sessionFixture(options = {}) {
  const legacyFrames = [];
  const media = { time: 0, ended: false, unavailable: false };
  const calls = [];
  const stored = options.records || [];
  let failures = options.failures || 0;
  let timestamp = 1791580800000;
  const legacy = {
    submitFrameIntents(intents, delta) { legacyFrames.push({ intents: [...intents], delta }); },
    getCurrentPerceptionMode() { return 'Normal'; }, getChartPlaybackState() { return 'Ready'; },
    isWorldMotionGated() { return options.legacyGated === true; },
  };
  const session = new WorldClearSession({ accountId: 'contract-account', worldId: 'contract-world', worldKind: 'Primary',
    protagonistCharacterId: content.protagonistCharacterId }, content, legacy, {
    now() { timestamp++; return timestamp; }, readRecords() { return stored; },
    async commitRecord(raw) {
      const record = validateWorldClearRecord(raw, 'contract-account'); calls.push(record);
      if (failures > 0) { failures--; throw new Error('fixture persistence failed'); }
      if (!stored.some(item => item.worldId === record.worldId)) { stored.push(record); }
    },
  });
  const premiere = new ChartPremiere(chart, layout);
  if (options.bind !== false) {
    session.bindWorldChart(premiere, () => media.time, () => ({ ended: media.ended, unavailable: media.unavailable }));
  }
  return { session, premiere, media, calls, stored, legacyFrames,
    tick(intents = [], delta = 1 / 60) { session.submitFrameIntents(intents, delta); },
    choose(choiceId = content.interaction.choices[0].choiceId) { this.tick([{ kind: 'ChooseWorldNarrative', choiceId }]); },
    enter() { this.tick([{ kind: 'EnterWorldChart' }]); },
    async completeAllMiss() {
      this.media.time = 6000; this.media.ended = true; this.tick(); await flush();
    },
  };
}

(async () => {
  await test('deriveLedgerPosition sums all 20 dimensions in authoritative append order including Player and Autopilot', () => {
    const first = dimensions.map(dimension => dimension + 1);
    const second = dimensions.map(dimension => dimension / 2);
    const position = deriveLedgerPosition([event('first', first), event('second', second, InputSource.Autopilot), event('grey-box')]);
    for (const dimension of dimensions) { assert.equal(position[dimension], first[dimension] + second[dimension]); }
    assert(Object.isFrozen(position)); assert.deepEqual(deriveLedgerPosition([]), vector());
  });

  await test('coordinate accumulation preserves actual append order without sorting or window truncation', () => {
    const large = vector(); large[Dimension.Red] = 1e16;
    const small = vector(); small[Dimension.Red] = 1;
    const largeFirst = deriveLedgerPosition([event('large', large), event('small-one', small), event('small-two', small)]);
    const smallFirst = deriveLedgerPosition([event('small-one', small), event('small-two', small), event('large', large)]);
    assert.equal(largeFirst[Dimension.Red], 1e16);
    assert.equal(smallFirst[Dimension.Red], 1e16 + 2);
  });

  await test('invalid vector/version and cumulative overflow fail instead of clipping, padding or publishing coordinates', () => {
    const huge = vector(); huge[Dimension.Red] = 1e308;
    assert.throws(() => deriveLedgerPosition([event('huge-one', huge), event('huge-two', huge)]), /溢出/);
    assert.throws(() => deriveLedgerPosition([{ ...event('wrong-version'), VectorSchemaVersion: 2 }]), /版本/);
    for (const raw of [vector().slice(1), [...vector(), 0], [1], null]) { assert.throws(() => validateNarrativeVector(raw)); }
    for (const invalid of [-1, Infinity, NaN]) {
      const raw = vector(); raw[Dimension.Understanding] = invalid; assert.throws(() => validateNarrativeVector(raw));
    }
  });

  await test('sphere equality is crossing after Player append; reads and below-surface Player do not trigger', () => {
    const crossing = new SphereCrossing(vector(), 5); const below = vector(); below[Dimension.Red] = 4.999;
    assert.equal(crossing.getDistance(below), 4.999); assert.equal(crossing.hasCrossed(), false);
    assert.equal(crossing.onLedgerAppended(event('below', below), 'hero', 'hero', below), false);
    const on = vector(); on[Dimension.Red] = 5;
    assert.equal(crossing.onLedgerAppended(event('on', on), 'hero', 'hero', on), true);
    assert.equal(crossing.hasCrossed(), true);
  });

  await test('Autopilot outside never grants entry; next successful Player append can trigger even with a zero vector', () => {
    const crossing = new SphereCrossing(vector(), 5); const outside = vector(); outside[Dimension.Green] = 6;
    assert.equal(crossing.onLedgerAppended(event('auto', outside, InputSource.Autopilot), 'hero', 'hero', outside), false);
    assert.equal(crossing.hasCrossed(), false);
    assert.equal(crossing.onLedgerAppended(event('player-zero'), 'hero', 'hero', outside), true);
  });

  await test('cross-character append cannot cross for protagonist and crossing remains one-way once granted', () => {
    const crossing = new SphereCrossing(vector(), 5); const outside = vector(); outside[Dimension.Blue] = 6;
    assert.equal(crossing.onLedgerAppended(event('other', outside), 'other', 'hero', outside), false);
    assert.equal(crossing.onLedgerAppended(event('hero', outside), 'hero', 'hero', outside), true);
    assert.equal(crossing.onLedgerAppended(event('later', outside), 'hero', 'hero', outside), false);
    assert.equal(crossing.onLedgerAppended(event('inside'), 'hero', 'hero', vector()), false);
    assert.equal(crossing.hasCrossed(), true);
  });

  await test('sphere validates fixed finite positive geometry and uses the complete 20-dimensional norm', () => {
    for (const radius of [0, -1, Infinity, NaN]) { assert.throws(() => new SphereCrossing(vector(), radius)); }
    const position = vector(); position[Dimension.PlayerEmpathy] = 3; position[Dimension.TruthLevel] = 4;
    const crossing = new SphereCrossing(vector(), 5); assert.equal(crossing.getDistance(position), 5);
    assert.equal(crossing.onLedgerAppended(event('full-space', position), 'hero', 'hero', position), true);
    const stable = vector(); stable[Dimension.Red] = 1e200;
    assert.equal(new SphereCrossing(vector(), 1e201).getDistance(stable), 1e200);
  });

  for (const axis of emotionAxes) {
    await test('route classifies unique positive ' + Dimension[axis] + ' maximum using its frozen dimension', () => {
      const position = vector(); position[axis] = 3; position[Dimension.NarrativeTime] = 2;
      const route = deriveRouteSignature(position);
      assert.equal(classifyDivergenceAxis(position), axis); assert.equal(route.divergenceAxis, axis);
      assert.equal(route.VectorSchemaVersion, 1); assert.equal(route.classificationVersion, 1); assert.equal(route.narrativeTime, 2);
    });
  }

  await test('positive emotion ties use Red to Grey order and all-six-zero nonzero route keeps null', () => {
    const all = vector(); for (const axis of emotionAxes) { all[axis] = 7; }
    assert.equal(classifyDivergenceAxis(all), Dimension.Red);
    const later = vector(); later[Dimension.Blue] = 5; later[Dimension.Green] = 5;
    assert.equal(classifyDivergenceAxis(later), Dimension.Green);
    const unemotional = vector(); unemotional[Dimension.TruthLevel] = 1;
    assert.equal(deriveRouteSignature(unemotional).divergenceAxis, null);
    assert.throws(() => deriveRouteSignature(vector()), /全零/);
  });

  await test('route is a cloned immutable completion-time snapshot with no caller alias', () => {
    const raw = vector(); raw[Dimension.White] = 4; raw[Dimension.NarrativeTime] = 3;
    const route = deriveRouteSignature(raw); raw[Dimension.White] = 500;
    assert.equal(route.ledgerPosition[Dimension.White], 4);
    assert(Object.isFrozen(route)); assert(Object.isFrozen(route.ledgerPosition));
    assert.throws(() => { route.ledgerPosition[Dimension.White] = 8; }, TypeError);
  });

  await test('maker-published content and formal World chart equal a fresh existing editor export', () => {
    assert.equal(content.worldKind, 'Primary'); assert(content.EventSpaceCenter.every(value => value === 0));
    assert(content.EventDistance > 0); assert(content.interaction.choices.every(choice => choice.vector.length === dimensions.length));
    assert(content.interaction.choices.every(choice => choice.meaning.length > 0 && Math.hypot(...choice.vector) >= content.EventDistance));
    const editor = new GuidanceEditorSession(layout);
    editor.submitEditorIntent({ kind: 'LoadDraft', document: json('quality-review/b2-world-clear/content-world-draft.json') });
    const exported = editor.exportChart();
    assert.deepEqual(exported.chart, publishedChart); assert.equal(chart.schemaVersion, 3); assert.equal(chart.tier, 'World');
    assert.equal(content.worldBossChartSource.chartId, chart.chartId);
    assert.equal(content.source.version, content.contentRevision);
    assert(Object.isFrozen(content)); assert(Object.isFrozen(content.interaction.choices[0].vector));
  });

  for (const [label, mutate] of [
    ['unknown schema', raw => { raw.schemaVersion = 2; }],
    ['wrong kind', raw => { raw.worldKind = 'Copy'; }],
    ['nonzero center', raw => { raw.EventSpaceCenter[Dimension.Red] = 1; }],
    ['zero radius', raw => { raw.EventDistance = 0; }],
    ['nonfinite radius', raw => { raw.EventDistance = Infinity; }],
    ['source version mismatch', raw => { raw.source.version = 'other'; }],
    ['chart version mismatch', raw => { raw.worldBossChartSource.contentRevision = 'other'; }],
    ['duplicate choice', raw => { raw.interaction.choices.push(clone(raw.interaction.choices[0])); }],
    ['short choice vector', raw => { raw.interaction.choices[0].vector.pop(); }],
    ['missing meaning', raw => { delete raw.interaction.choices[0].meaning; }],
    ['resource traversal', raw => { raw.worldBossChartSource.chartResourcePath = '../chart/boss'; }],
    ['extra permission field', raw => { raw.CopyPermission = true; }],
  ]) {
    await test('content publication rejects ' + label + ' before player choice parsing', () => {
      const raw = clone(contentRaw); mutate(raw); assert.throws(() => parseWorldNarrativeContent(raw));
    });
  }

  await test('new Entry reference is not a premiere fact; only explicit completed target reference is', () => {
    const entry = event('entry');
    const completed = event('completed', vector(), InputSource.Player, { chartId: 'regular-fixture', state: 'PremiereCompleted' });
    assert.equal(classifyChartReference(entry), 'Entry'); assert.equal(classifyChartReference(completed), 'PremiereCompleted');
    assert.equal(hasChartPremiereCompleted([entry], 'regular-fixture'), false);
    assert.equal(hasChartPremiereCompleted([entry, completed], 'regular-fixture'), true);
    assert.equal(hasChartPremiereCompleted([completed], 'other-chart'), false);
  });

  await test('known legacy grey-box T6/T7 are read-only classified without rewriting old fields', () => {
    const t6 = event('T6_ENDPOINT_PLACEHOLDER', vector(), InputSource.Player, { chartId: 'regular-fixture' });
    const t7 = event('T7_COMPLETION_PLACEHOLDER', vector(), InputSource.Player, { chartId: 'regular-fixture' });
    const before = JSON.stringify([t6, t7]);
    assert.equal(classifyChartReference(t6), 'Entry'); assert.equal(classifyChartReference(t7), 'Unclassified');
    assert.equal(classifyChartReference(t7, 'regular-fixture'), 'PremiereCompleted');
    assert.equal(classifyChartReference(t7, 'different-regular'), 'Unclassified');
    assert.equal(hasChartPremiereCompleted([t7], 'regular-fixture'), false);
    assert.equal(hasChartPremiereCompleted([t7], 'regular-fixture', 'regular-fixture'), true);
    assert.equal(hasChartPremiereCompleted([t7], 'regular-fixture', 'different-regular'), false);
    assert.equal(classifyChartReference(event('T6_ENDPOINT_PLACEHOLDER', vector(), InputSource.Player,
      { chartId: 'CHART_NOT_BOUND' })), 'Entry');
    assert.equal(classifyChartReference(event('T7_COMPLETION_PLACEHOLDER', vector(), InputSource.Player,
      { chartId: 'CHART_NOT_BOUND' })), 'Unclassified');
    assert.equal(JSON.stringify([t6, t7]), before); assert.equal('state' in t6.ChartRef, false);
  });

  await test('unknown old producer and legacy impostors remain unclassified; invalid explicit state cannot downgrade', () => {
    assert.equal(classifyChartReference(event('unknown-old', vector(), InputSource.Player, { chartId: 'regular-fixture' })), 'Unclassified');
    const nonzero = vector(); nonzero[Dimension.Red] = 1;
    assert.equal(classifyChartReference(event('T7_COMPLETION_PLACEHOLDER', nonzero, InputSource.Player,
      { chartId: 'regular-fixture' }), 'regular-fixture'), 'Unclassified');
    assert.equal(classifyChartReference(event('T7_COMPLETION_PLACEHOLDER', vector(), InputSource.Autopilot,
      { chartId: 'regular-fixture' }), 'regular-fixture'), 'Unclassified');
    assert.throws(() => classifyChartReference(event('T7_COMPLETION_PLACEHOLDER', vector(), InputSource.Player,
      { chartId: 'regular-fixture', state: 'Bogus' })));
    assert.throws(() => classifyChartReference(event('invalid-completed', vector(), InputSource.Player,
      { chartId: 'CHART_NOT_BOUND', state: 'PremiereCompleted' })));
  });

  await test('chart reference rejects structural/accessor/prototype/state corruption without executing getters', () => {
    let getters = 0;
    const top = event('top-accessor');
    Object.defineProperty(top, 'ChartRef', { enumerable: true, get() { getters++; return { chartId: 'regular-fixture', state: 'PremiereCompleted' }; } });
    assert.throws(() => classifyChartReference(top));
    assert.throws(() => hasChartPremiereCompleted([top], 'regular-fixture'));
    const nested = event('nested-accessor');
    Object.defineProperty(nested.ChartRef, 'chartId', { enumerable: true, get() { getters++; return 'regular-fixture'; } });
    assert.throws(() => classifyChartReference(nested));
    const accessorVector = event('vector-accessor');
    Object.defineProperty(accessorVector.vector, String(Dimension.Red), { get() { getters++; return 0; } });
    assert.throws(() => classifyChartReference(accessorVector));
    const inherited = Object.assign(Object.create({ inherited: true }), event('inherited'));
    assert.throws(() => classifyChartReference(inherited));
    const source = event('unknown-source'); source.InputSource = 999;
    assert.throws(() => classifyChartReference(source));
    const extra = event('extra-field'); extra.Permission = true;
    assert.throws(() => classifyChartReference(extra));
    const reference = event('extra-reference'); reference.ChartRef.Permission = true;
    assert.throws(() => classifyChartReference(reference));
    assert.equal(getters, 0);
  });

  await test('unknown choice ID writes nothing; valid choice resolves published vector once and grants unique SphereCrossing entry', () => {
    const f = sessionFixture(); f.choose('not-published');
    assert.equal(f.session.getLedgerEvents().length, 0); assert.equal(f.session.getWorldClearSnapshot().entry, null);
    f.choose(); const first = f.session.getWorldClearSnapshot();
    assert.equal(first.context.worldKind, 'Primary'); assert.equal(first.ledgerEventCount, 1); assert.equal(first.sphereCrossed, true);
    assert.deepEqual(first.ledgerPosition, content.interaction.choices[0].vector);
    assert.equal(first.entry.source, 'SphereCrossing'); assert.equal(first.entry.tier, 'World'); assert.equal(first.entry.ChartRef.state, 'Entry');
    f.choose(content.interaction.choices[1].choiceId);
    assert.equal(f.session.getLedgerEvents().length, 1); assert.equal(f.session.getWorldClearSnapshot().entry, first.entry);
    assert.equal(f.calls.length, 0);
  });

  await test('session refuses World entry before crossing or before formally bound World media/chart', () => {
    const f = sessionFixture(); f.enter(); assert.equal(f.session.isWorldChartActive(), false);
    const unbound = sessionFixture({ bind: false }); unbound.choose(); unbound.enter();
    assert.equal(unbound.session.isWorldChartActive(), false); assert.equal(unbound.session.getWorldClearSnapshot().mediaReady, false);
    const wrong = new ChartPremiere({ chartId: 'wrong-regular', tier: 'Regular', layoutVersion: layout.layoutVersion, notes: [] }, layout);
    assert.throws(() => unbound.session.bindWorldChart(wrong, () => 0, () => ({ ended: false, unavailable: false })), /World/);
  });

  await test('all-Miss complete actual ChartPremiere emits unique completed event and valid WorldClearRecord with no score gate', async () => {
    const f = sessionFixture(); f.choose(); f.enter();
    assert.equal(f.session.isWorldChartActive(), true); assert.equal(f.premiere.getState(), 'Playing');
    await f.completeAllMiss();
    assert.equal(f.premiere.getResult().completed, true); assert.equal(f.premiere.getTotalScore(), 0);
    assert(f.premiere.getMissCount() > 0); assert.equal(f.calls.length, 1);
    const snapshot = f.session.getWorldClearSnapshot();
    assert.equal(snapshot.completionStatus, 'Completed'); assert.equal(snapshot.ledgerEventCount, 2);
    assert.equal(snapshot.record.worldKind, 'Primary'); assert.equal(snapshot.record.ChartRef.state, 'PremiereCompleted');
    assert.deepEqual(snapshot.record.routeSignature.ledgerPosition, snapshot.ledgerPosition);
    const completion = f.session.getLedgerEvents()[1];
    assert.equal(completion.eventId, snapshot.record.completionEventId);
    assert.equal(completion.ChartRef.state, 'PremiereCompleted'); assert.deepEqual(completion.vector, vector());
    assert.equal(snapshot.record.routeSignature.divergenceAxis, Dimension.Green);
    assert.equal(f.session.isWorldChartActive(), false);
  });

  await test('all nodes resolved without media ending remains Playing and writes no completion fact', async () => {
    const f = sessionFixture(); f.choose(); f.enter(); f.media.time = 6000; f.tick(); await flush();
    assert.equal(f.premiere.getState(), 'Playing'); assert.equal(f.calls.length, 0);
    assert.equal(f.session.getLedgerEvents().length, 1);
    f.media.ended = true; f.tick(); await flush(); assert.equal(f.calls.length, 1);
  });

  await test('early truncated media end advances exceptional timeline through real ChartPremiere judgements before completing', async () => {
    const f = sessionFixture(); f.choose(); f.enter();
    f.media.time = 1000; f.tick();
    assert.equal(f.calls.length, 0); assert(f.premiere.getResolvedCount() < f.premiere.getTotalNoteCount());
    f.media.ended = true;
    for (let frame = 0; frame < 80 && f.session.isWorldChartActive(); frame++) { f.tick([], 0.1); }
    await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.premiere.getResult().completed, true);
    assert.equal(f.premiere.getResolvedCount(), f.premiere.getTotalNoteCount());
    assert(f.premiere.getCurrentTimeMs() > 1000);
    assert.equal(f.session.getLedgerEvents().length, 2);
  });

  await test('unavailable stopped media waits the frozen timeout then uses real judgement/timeout path to complete', async () => {
    const f = sessionFixture(); f.choose(); f.enter(); f.media.time = -1; f.media.unavailable = true;
    for (let frame = 0; frame < 29; frame++) { f.tick([], 1); }
    assert.equal(f.premiere.getCurrentTimeMs(), 0); assert.equal(f.calls.length, 0);
    f.tick([], 1);
    assert(f.premiere.getCurrentTimeMs() > 0); assert.equal(f.calls.length, 0);
    for (let frame = 0; frame < 80 && f.session.isWorldChartActive(); frame++) { f.tick([], 1); }
    await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.premiere.getResult().completed, true);
    assert.equal(f.premiere.getResolvedCount(), f.premiere.getTotalNoteCount());
    assert.equal(f.premiere.getTotalScore(), 0); assert.equal(f.session.getLedgerEvents().length, 2);
  });

  await test('pause freezes exceptional-media timeout accumulation and logical timeline', () => {
    const f = sessionFixture(); f.choose(); f.enter(); f.media.time = -1; f.media.unavailable = true;
    for (let frame = 0; frame < 20; frame++) { f.tick([], 1); }
    f.tick([{ kind: 'ToggleChartPause', videoTimeMs: 0 }], 1);
    for (let frame = 0; frame < 35; frame++) { f.tick([], 1); }
    assert.equal(f.premiere.getState(), 'Paused'); assert.equal(f.premiere.getCurrentTimeMs(), 0); assert.equal(f.calls.length, 0);
    f.tick([{ kind: 'ToggleChartPause', videoTimeMs: 0 }], 1);
    for (let frame = 0; frame < 8; frame++) { f.tick([], 1); }
    assert.equal(f.premiere.getCurrentTimeMs(), 0);
    f.tick([], 1); assert(f.premiere.getCurrentTimeMs() > 0); assert.equal(f.calls.length, 0);
  });

  await test('early exit/reentry clears prior exceptional timeout and never carries elapsed outage into new premiere', () => {
    const f = sessionFixture(); f.choose(); f.enter(); const entry = f.session.getWorldClearSnapshot().entry;
    f.media.time = -1; f.media.unavailable = true;
    for (let frame = 0; frame < 29; frame++) { f.tick([], 1); }
    f.tick([{ kind: 'ExitChart' }], 1); assert.equal(f.calls.length, 0);
    f.enter();
    assert.equal(f.premiere.getState(), 'Ready'); assert.equal(f.premiere.getCurrentTimeMs(), 0);
    f.tick([], 1); assert.equal(f.premiere.getState(), 'Ready');
    assert.equal(f.session.getWorldClearSnapshot().entry, entry);
    assert.equal(f.session.getLedgerEvents().length, 1); assert.equal(f.calls.length, 0);
  });

  await test('early exit retains same entry; reenter resets actual premiere and later completes once', async () => {
    const f = sessionFixture(); f.choose(); const entry = f.session.getWorldClearSnapshot().entry; f.enter();
    f.media.time = 250; f.tick([{ kind: 'ExitChart' }]); await flush();
    assert.equal(f.premiere.getResult().completed, false); assert.equal(f.calls.length, 0);
    assert.equal(f.session.getLedgerEvents().length, 1); assert.equal(f.session.getWorldClearSnapshot().entry, entry);
    f.media.time = 0; f.enter(); assert.equal(f.premiere.getState(), 'Playing');
    await f.completeAllMiss(); assert.equal(f.calls.length, 1); assert.equal(f.session.getLedgerEvents().length, 2);
  });

  await test('pause never advances completion; resumed normal media end resolves the same World premiere', async () => {
    const f = sessionFixture(); f.choose(); f.enter();
    f.tick([{ kind: 'ToggleChartPause', videoTimeMs: 200 }]); assert.equal(f.premiere.getState(), 'Paused');
    f.media.time = 6000; f.media.ended = true; f.tick(); await flush();
    assert.equal(f.premiere.getState(), 'Paused'); assert.equal(f.calls.length, 0);
    f.tick([{ kind: 'ToggleChartPause', videoTimeMs: 200 }]); await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.session.getLedgerEvents().length, 2);
  });

  await test('completion-time route incorporates later authoritative protagonist events and excludes other characters', async () => {
    const f = sessionFixture(); f.choose(); const crossingPosition = f.session.getWorldClearSnapshot().ledgerPosition;
    const later = vector(); later[Dimension.Red] = 8; later[Dimension.NarrativeTime] = 4;
    f.session.appendLegacyEvent(event('legitimate-later', later, InputSource.Autopilot));
    const other = vector(); other[Dimension.Blue] = 100;
    f.session.appendLegacyEvent(event('other-character', other), 'other-character');
    f.enter(); await f.completeAllMiss(); const signature = f.calls[0].routeSignature;
    assert.equal(signature.divergenceAxis, Dimension.Red);
    assert.equal(signature.ledgerPosition[Dimension.Red], crossingPosition[Dimension.Red] + 8);
    assert.equal(signature.ledgerPosition[Dimension.Blue], crossingPosition[Dimension.Blue]);
    assert.equal(signature.narrativeTime, crossingPosition[Dimension.NarrativeTime] + 4);
    assert.equal(f.session.getLedgerEvents().length, 3);
  });

  await test('failed append cannot publish crossing or extra records; successful autopilot then Player sequence crosses legally', () => {
    const f = sessionFixture(); const huge = vector(); huge[Dimension.Red] = 1e308;
    f.session.appendLegacyEvent(event('huge-one', huge, InputSource.Autopilot));
    assert.equal(f.session.getWorldClearSnapshot().sphereCrossed, false);
    assert.throws(() => f.session.appendLegacyEvent(event('huge-two', huge, InputSource.Autopilot)), /溢出/);
    assert.equal(f.session.getLedgerEvents().length, 1); assert.equal(f.session.getWorldClearSnapshot().entry, null);
    f.session.appendLegacyEvent(event('next-player'));
    assert.equal(f.session.getWorldClearSnapshot().sphereCrossed, true); assert.equal(f.session.getLedgerEvents().length, 2);
  });

  await test('World gate freezes entire entry/exit batch and legacy movement; subsequent world frame resumes old intent route', () => {
    const f = sessionFixture(); f.choose(); const before = f.legacyFrames.length;
    const move = { kind: 'Move', lateral: 1, depth: 0 };
    f.tick([move, { kind: 'EnterWorldChart' }]); assert.equal(f.legacyFrames.length, before);
    f.tick([move, { kind: 'ExitChart' }, move]); assert.equal(f.legacyFrames.length, before);
    f.tick([move]); assert.equal(f.legacyFrames.length, before + 1); assert.deepEqual(f.legacyFrames.at(-1).intents, [move]);
  });

  await test('repeated Completed frames/reentry/retry cannot create a second completion or callback after successful commit', async () => {
    const f = sessionFixture(); f.choose(); f.enter(); await f.completeAllMiss();
    const before = JSON.stringify(f.session.getLedgerEvents());
    f.tick(); f.tick([{ kind: 'EnterWorldChart' }, { kind: 'RetryWorldClear' }]); await flush();
    assert.equal(f.session.isWorldChartActive(), false); assert.equal(f.calls.length, 1);
    assert.equal(JSON.stringify(f.session.getLedgerEvents()), before);
  });

  await test('persistence failure publishes Failed without success; retry preserves single completed event and frozen route', async () => {
    const f = sessionFixture({ failures: 1 }); f.choose(); f.enter(); await f.completeAllMiss();
    assert.equal(f.session.getWorldClearSnapshot().completionStatus, 'Failed');
    assert.equal(f.session.getWorldClearSnapshot().record, null); assert.equal(f.session.getLedgerEvents().length, 2);
    const firstCandidate = f.calls[0]; const before = JSON.stringify(f.session.getLedgerEvents());
    f.tick([{ kind: 'RetryWorldClear' }, { kind: 'RetryWorldClear' }]); await flush();
    assert.equal(f.calls.length, 2); assert.deepEqual(f.calls[1], firstCandidate);
    assert.equal(f.session.getWorldClearSnapshot().completionStatus, 'Completed');
    assert.equal(JSON.stringify(f.session.getLedgerEvents()), before); assert.equal(f.stored.length, 1);
  });

  await test('already persisted world record closes future narrative/entry/completion path without hydrating world state', async () => {
    const original = sessionFixture(); original.choose(); original.enter(); await original.completeAllMiss();
    const f = sessionFixture({ records: original.stored.slice() });
    assert.equal(f.session.getWorldClearSnapshot().completionStatus, 'Completed');
    f.choose(); f.enter(); f.tick([{ kind: 'RetryWorldClear' }]); await flush();
    assert.equal(f.session.getLedgerEvents().length, 0); assert.equal(f.session.getWorldClearSnapshot().entry, null);
    assert.equal(f.calls.length, 0); assert.equal(f.session.isWorldChartActive(), false);
  });

  await test('read-only World snapshot exposes choice IDs and meaning without vector write payload or account permission values', () => {
    const f = sessionFixture(); const snapshot = f.session.getWorldClearSnapshot();
    assert(snapshot.interaction.choices.every(choice => !('vector' in choice)));
    assert.equal('CopyPermission' in snapshot, false); assert.equal('FirstWorldCleared' in snapshot, false);
    assert(Object.isFrozen(snapshot)); assert(Object.isFrozen(snapshot.interaction.choices));
    assert.equal(snapshot.record, null);
  });

  const report = { category: 'ContractTest',
    note: 'Isolated logic tests with actual shipped ChartPremiere and maker-published editor export; media clocks/ended are explicit controlled fixtures. No test is production/Cocos preview acceptance.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'domain.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: report.failed }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'domain.contract-results.json'), JSON.stringify({
    category: 'ContractTest', passed: results.length, failed: 1, results,
    error: error instanceof Error ? error.stack : String(error),
  }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
