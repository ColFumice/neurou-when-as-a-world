'use strict';
// Actual domain validators with isolated data/media clocks; no Cocos acceptance is claimed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = filename => require(path.join(root, filename)), json = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
const { WorldStateCodec, isValidatedWorldStateSnapshot } = load('src/director/WorldStateCodec.ts');
const { WorldStateSession } = load('src/director/WorldStateSession.ts');
const { createPrimaryWorldStateCodec } = load('src/director/PrimaryWorldState.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { WorldLinkSession } = load('src/director/WorldLinkSession.ts');
const { ChartArchive } = load('src/director/ChartArchive.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { PuzzleChain } = load('src/trace/PuzzleChain.ts');
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const content = parseWorldNarrativeContent(json('assets/resources/world/primary-rain-dialogue.json'));
const regular = json('assets/resources/chart/guidance_c.json'), layout = createDefaultKeyboardPadLayout();
const chart = parseGuidanceChart(json('assets/resources/chart/primary-rain-world-1.json'), layout);
const visual = json('assets/resources/chart/primary-rain-world-1.visual.json');
const context = { accountId: 'complete-contract', worldId: 'complete-primary', worldKind: 'Primary', shoreOrigin: null, protagonistCharacterId: content.protagonistCharacterId };
const now = 1791600000000, clone = value => JSON.parse(JSON.stringify(value)), flush = () => new Promise(resolve => setImmediate(resolve));
const legacy = { submitFrameIntents() {}, getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready', isWorldMotionGated: () => false };
function worldFixture() {
  const session = new WorldClearSession(context, content, legacy, { readRecords: () => [], now: () => now, async commitRecord() {} });
  const media = { time: 0, ended: false }; const premiere = new ChartPremiere(chart, layout);
  session.bindWorldChart(premiere, () => media.time, () => ({ ended: media.ended, unavailable: false }));
  return { session, premiere, media };
}
function core(ledger = worldFixture().session.getLedgerSnapshot()) {
  const archive = new ChartArchive(context);
  const recall = new RecallCountSession({ accountId: context.accountId, worldId: context.worldId,
    protagonistCharacterId: context.protagonistCharacterId, regularChartId: regular.chartId }, { readLedger: () => ledger,
    persistSnapshot() { throw new Error('fixture capture must not persist'); }, now() { throw new Error('fixture capture must not clock'); } });
  const puzzle = { schemaVersion: 1, accountId: context.accountId, worldId: context.worldId, chainId: 'T6_MAIN_CHAIN', deepTraceId: 'T6_MAIN_DEEP_TRACE',
    ruleVersion: 1, chartId: regular.chartId, chain: new PuzzleChain(new PuzzleProgress(), 1000).capturePrivateState(),
    control: { currentPerceptionMode: 'Normal', beatClockOffsetMs: 0, endpointSettled: false, deepTraceTriggered: false,
      chartCompletionRecorded: false, revealPhase: 'Idle', chartEntryScheduled: false, worldMotionGated: false } };
  return clone({ schemaVersion: 1, accountId: context.accountId, worldId: context.worldId, worldKind: 'Primary', shoreOrigin: null,
    revision: 0, capturedAt: now, kind: 'Core', sections: { Ledger: ledger, PuzzleProgress: [puzzle], FormatTime: { epochMs: now - 1000 },
      RecallCount: recall.getSnapshot(), WorldLink: new WorldLinkSession(context).getSnapshot(),
      ChartSnapshot: archive.emptySnapshots(), ChartScore: archive.emptyScores() } });
}
const codec = () => createPrimaryWorldStateCodec(context.accountId, context.worldId, content, regular.chartId);
const full = raw => codec().parseComplete(raw, context.accountId, context.worldId);
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
(async () => {
  await test('all seven codecs expose Implemented while WorldFork remains fixed NotImplemented', () => {
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    assert.equal(Object.keys(session.ownership).length, 7); assert(Object.values(session.ownership).every(section => section.codec === 'Implemented'));
    assert.equal(session.worldForkAvailability, 'NotImplemented');
  });
  await test('new real Primary carrier with zero legal records has seven nonnull sections and certified Complete', () => {
    const parsed = full(core()); assert.equal(parsed.kind, 'Core'); assert.equal(parsed.sections.WorldLink.kind, 'NotApplicable');
    assert.equal(Object.keys(parsed.sections).length, 7); assert(isValidatedWorldStateSnapshot(parsed));
    assert.equal(parsed.sections.RecallCount.records.length, 0); assert.equal(parsed.sections.ChartSnapshot.records.length, 0);
    assert(Object.isFrozen(parsed.sections));
  });
  await test('legacy three fields stay three fields, read only compatible but never Complete', () => {
    const raw = core(); for (const key of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) delete raw.sections[key];
    const before = JSON.stringify(raw), parsed = codec().parse(raw);
    assert.deepEqual(Object.keys(parsed.sections), ['Ledger', 'PuzzleProgress', 'FormatTime']); assert.equal(JSON.stringify(raw), before);
    assert.throws(() => full(raw), /七项/); assert(!isValidatedWorldStateSnapshot(parsed));
  });
  await test('new four extension fields must be present together even when explicitly null', () => {
    for (const missing of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) {
      const raw = core(); delete raw.sections[missing]; assert.throws(() => codec().parse(raw), /同组/);
    }
    const raw = core(); for (const key of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) raw.sections[key] = null;
    assert.equal(Object.keys(codec().parse(raw).sections).length, 7); assert.throws(() => full(raw), /七项/);
  });
  await test('each missing section rejects Complete without inserting default values', () => {
    for (const key of Object.keys(core().sections)) {
      const raw = core(); raw.sections[key] = null; const before = JSON.stringify(raw);
      assert.throws(() => full(raw)); assert.equal(JSON.stringify(raw), before);
    }
  });
  await test('seven JSON-shaped sections do not bypass bound validators or complete-reference validator', () => {
    const raw = core(); assert.throws(() => new WorldStateCodec().parse(raw), /验证器/);
    const unboundComplete = new WorldStateCodec({ Ledger: value => value, PuzzleProgress: value => value,
      RecallCount: value => value, WorldLink: value => value, ChartSnapshot: value => value, ChartScore: value => value });
    assert.throws(() => unboundComplete.parseComplete(raw), /完整引用验证器/);
  });
  await test('certification is local runtime identity; JSON clone or parse-only cannot forge it', () => {
    const parsed = full(core()); assert(!isValidatedWorldStateSnapshot(clone(parsed))); assert(!isValidatedWorldStateSnapshot(codec().parse(parsed)));
    assert(!Object.keys(parsed).some(name => /brand|complete|validated/i.test(name))); assert.equal(Object.getOwnPropertySymbols(parsed).length, 0);
  });
  await test('extension envelope account/world and WorldLink world/role identity cannot cross boundaries', () => {
    for (const section of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) {
      for (const patch of [{ accountId: 'other-account' }, { worldId: 'other-world' }]) {
        const raw = core(); Object.assign(raw.sections[section], patch); assert.throws(() => full(raw));
      }
    }
    const raw = core(); raw.sections.WorldLink.protagonistCharacterId = 'other-role'; assert.throws(() => full(raw));
  });
  await test('nested arrays and unfamiliar section fields cannot bypass strict extension validators', () => {
    const malformed = [];
    let raw = core(); raw.sections.RecallCount.records.extra = true; malformed.push(raw);
    raw = core(); raw.sections.ChartSnapshot.records = Array(1); malformed.push(raw);
    raw = core(); raw.sections.WorldLink.sourceWorldId = 'invented'; malformed.push(raw);
    raw = core(); raw.sections.extra = {}; malformed.push(raw);
    for (const candidate of malformed) assert.throws(() => codec().parse(candidate));
  });
  await test('capture reads source once, returns certified Complete and publishes only the result', () => {
    let calls = 0; const raw = core(), before = JSON.stringify(raw), session = new WorldStateSession(context.accountId, context.worldId, () => now + 10);
    session.bindCompleteSource(() => { calls++; return raw; }, full);
    const result = session.captureWorldState(); assert.equal(calls, 1); assert.equal(result.kind, 'Complete');
    assert(isValidatedWorldStateSnapshot(result.snapshot)); assert.equal(session.getLastCaptureResult(), result); assert.equal(JSON.stringify(raw), before);
  });
  await test('binding only old Core reader remains explicitly Incomplete even with seven present sections', () => {
    const session = new WorldStateSession(context.accountId, context.worldId, () => now); session.bindCoreSource(() => codec().parse(core()));
    const result = session.captureWorldState(); assert.equal(result.kind, 'Incomplete'); assert.equal(Object.keys(result.capturedParts).length, 3);
    assert.equal(result.issues.filter(issue => issue.reason === 'MechanismMissing').length, 3);
  });
  await test('partial full-source capture returns actual known parts and diagnostics, never promotion', () => {
    const raw = core(); raw.sections.FormatTime = null; let calls = 0;
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => { calls++; return codec().parse(raw); }, full);
    const result = session.captureWorldState(); assert.equal(result.kind, 'Incomplete'); assert.equal(calls, 1);
    assert(result.capturedParts.WorldLink); assert(!result.capturedParts.FormatTime); assert(result.issues.some(issue => issue.section === 'FormatTime'));
  });
  await test('absent source and corrupt source remain Incomplete without empty-data migration', () => {
    for (const source of [() => null, () => { throw new Error('damaged bytes'); }]) {
      const session = new WorldStateSession(context.accountId, context.worldId, () => now); session.bindCompleteSource(source, full);
      const result = session.captureWorldState(); assert.equal(result.kind, 'Incomplete'); assert.deepEqual(result.capturedParts, {});
    }
  });
  await test('live activity rejects capture as UnsupportedBoundary instead of certifying the old stored checkpoint', () => {
    const stable = full(core()); let active = true, reads = 0;
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => { reads++; if (active) throw new Error('UnsupportedBoundary: World 演奏中'); return stable; }, full);
    const rejected = session.captureWorldState(); assert.equal(reads, 1); assert.equal(rejected.kind, 'Incomplete');
    assert(rejected.issues.some(issue => issue.section === 'RuntimeBoundary' && issue.reason === 'UnsupportedBoundary'));
    assert.deepEqual(rejected.capturedParts, {}); active = false;
    assert.equal(session.captureWorldState().kind, 'Complete'); assert.equal(reads, 2);
  });
  await test('validate-only binding cannot claim Restored', () => {
    const session = new WorldStateSession(context.accountId, context.worldId, () => now); session.bindCompleteSource(() => core(), full);
    const result = session.restoreWorldState(core()); assert.equal(result.kind, 'Rejected'); assert.match(result.issues[0].detail, /对象图/);
  });
  await test('forged validation result rejects before graph preparation', () => {
    let prepare = 0; const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => core(), value => clone(value), () => { prepare++; throw new Error(); });
    assert.equal(session.restoreWorldState(core()).kind, 'Rejected'); assert.equal(prepare, 0);
    assert.equal(session.captureWorldState().kind, 'Incomplete');
  });
  await test('foreign certified identity cannot restore into current world', () => {
    const other = clone(core()); other.accountId = 'foreign';
    const valid = full(core()), session = new WorldStateSession('other-account', context.worldId, () => now); let prepare = 0;
    session.bindCompleteSource(() => null, () => valid, () => { prepare++; return { publish: () => true, discard() {} }; });
    assert.equal(session.restoreWorldState(other).kind, 'Rejected'); assert.equal(prepare, 0);
  });
  await test('failed strict validation leaves prior graph/storage and last capture untouched', () => {
    let active = { original: true }, writes = 0, prepare = 0; const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => core(), full, () => { prepare++; return { publish() { writes++; active = {}; return true; }, discard() {} }; });
    const priorResult = session.captureWorldState(), priorGraph = active, raw = core(); raw.sections.WorldLink.accountId = 'foreign';
    assert.equal(session.restoreWorldState(raw).kind, 'Rejected'); assert.equal(active, priorGraph); assert.equal(writes, 0); assert.equal(prepare, 0);
    assert.equal(session.getLastCaptureResult(), priorResult);
  });
  await test('prepare failure never publishes or reports restoration', () => {
    let active = 'old'; const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => core(), full, () => { throw new Error('inactive construction failed'); });
    assert.equal(session.restoreWorldState(core()).kind, 'Rejected'); assert.equal(active, 'old');
  });
  await test('publish false or throw discards prepared graph exactly once and preserves prior graph', () => {
    for (const outcome of ['false', 'throw']) {
      let active = 'old', discarded = 0, publications = 0; const session = new WorldStateSession(context.accountId, context.worldId, () => now);
      session.bindCompleteSource(() => core(), full, () => ({ publish() { publications++; if (outcome === 'throw') throw new Error('quota'); return false; }, discard() { discarded++; } }));
      assert.equal(session.restoreWorldState(core()).kind, 'Rejected'); assert.equal(discarded, 1); assert.equal(publications, 1); assert.equal(active, 'old');
    }
  });
  await test('restore requires synchronous successful publication, promises cannot fake success', () => {
    let discarded = 0; const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => core(), full, () => ({ publish: () => Promise.resolve(true), discard: () => { discarded++; } }));
    assert.equal(session.restoreWorldState(core()).kind, 'Rejected'); assert.equal(discarded, 1);
  });
  await test('successful restore validates then prepares inactive then publishes once; no append/account callbacks', () => {
    let active = { old: true }, discarded = 0; const order = [], raw = core(), before = JSON.stringify(raw);
    const session = new WorldStateSession(context.accountId, context.worldId, () => now);
    session.bindCompleteSource(() => core(), value => { order.push('validate'); return full(value); }, snapshot => {
      order.push('prepare'); const next = { snapshot, active: false }; assert.equal(active.old, true);
      return { publish() { order.push('publish'); next.active = true; active = next; return true; }, discard() { discarded++; } };
    });
    const result = session.restoreWorldState(raw); assert.equal(result.kind, 'Restored'); assert.deepEqual(order, ['validate', 'prepare', 'publish']);
    assert.equal(active.active, true); assert.equal(discarded, 0); assert(isValidatedWorldStateSnapshot(result.snapshot)); assert.equal(JSON.stringify(raw), before);
  });
  await test('real completed World premiere requires actual played snapshot and result; legacy missing artifacts stays partial', async () => {
    const f = worldFixture(); f.session.submitFrameIntents([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }], 1 / 60);
    f.session.submitFrameIntents([{ kind: 'EnterWorldChart' }], 1 / 60); f.media.time = 6000; f.media.ended = true;
    f.session.submitFrameIntents([], 1 / 60); await flush();
    const ledger = f.session.getLedgerSnapshot(), raw = core(ledger), events = ledger.characters.find(character => character.characterId === context.protagonistCharacterId).events;
    assert(ledger.control.completionEventId); assert.equal(f.premiere.getResult().completed, true);
    assert.doesNotThrow(() => codec().parse(raw)); assert.throws(() => full(raw), /历史首演/);
    const bytes = fs.readFileSync(path.join(root, 'assets/resources/audio/primary-rain-world-1.wav'));
    const archive = new ChartArchive(context), candidate = archive.preparePremiere({ completionEventId: ledger.control.completionEventId, chart, layout, visual,
      media: { kind: 'Audio', contentId: 'primary-rain-world-1-audio', contentRevision: '1.0.0', resourcePath: 'audio/primary-rain-world-1',
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length }, guideTransparency: f.premiere.getGuideTransparency(), result: f.premiere.getResult() }, events);
    raw.sections.ChartSnapshot = candidate.snapshots; raw.sections.ChartScore = candidate.scores;
    const parsed = full(raw); assert.equal(parsed.sections.ChartSnapshot.records.length, 1); assert.equal(parsed.sections.ChartScore.records[0].best.totalScore, 0);
    const missingScore = clone(raw); missingScore.sections.ChartScore.records = []; assert.doesNotThrow(() => codec().parse(missingScore)); assert.throws(() => full(missingScore), /历史首演/);
    const capture = new WorldStateSession(context.accountId, context.worldId, () => now); capture.bindCompleteSource(() => codec().parse(missingScore), full);
    assert.equal(capture.captureWorldState().kind, 'Incomplete');
  });
  fs.writeFileSync(path.join(__dirname, 'aggregation.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 0, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'aggregation.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 1, results, error: String(error.stack) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
