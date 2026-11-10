'use strict';
// Executes the actual composition-root method bodies with domain/storage fixtures.
// This is an isolated wiring contract, not a Cocos screenshot or production acceptance.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = filename => require(path.join(root, filename)), json = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
const { createPrimaryWorldStateCodec } = load('src/director/PrimaryWorldState.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { WorldLinkSession } = load('src/director/WorldLinkSession.ts');
const { WorldStateSession } = load('src/director/WorldStateSession.ts');
const { ChartArchive } = load('src/director/ChartArchive.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
const { parseGuidanceChart } = load('src/chart/GuidanceChart.ts');
const { PuzzleChain } = load('src/trace/PuzzleChain.ts');
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const { validatePuzzleProgressSnapshot } = load('src/director/PuzzleHydration.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { WorldFolderSession } = load('src/director/WorldFolderSession.ts');
const { createWorldFolderReader } = load('src/presentation/FolderCatalog.ts');
const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const content = parseWorldNarrativeContent(json('assets/resources/world/primary-rain-dialogue.json'));
const regular = json('assets/resources/chart/guidance_c.json'), layout = createDefaultKeyboardPadLayout();
const chart = parseGuidanceChart(json('assets/resources/chart/primary-rain-world-1.json'), layout), visual = json('assets/resources/chart/primary-rain-world-1.visual.json');
const now = 1791600000000, clone = value => JSON.parse(JSON.stringify(value)), flush = () => new Promise(resolve => setImmediate(resolve));
const filename = path.join(root, 'assets/scripts/SceneBuilder.ts'), source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'SceneBuilder');
const methodNames = ['persistLedger', 'capturePuzzle', 'saveStableCore', 'persistCore', 'archive'];
const methods = methodNames.map(name => {
  const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
  assert(method, 'actual SceneBuilder method missing: ' + name); return method.getText(source);
});
const RuntimeProbe = new Function('ChartArchive', 'validatePuzzleProgressSnapshot', 'Date', ts.transpileModule('class RuntimeProbe {' + methods.join('\n') + '}\nreturn RuntimeProbe;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText)(ChartArchive, validatePuzzleProgressSnapshot, class extends Date { static now() { return now; } });
const folderFilename = path.join(root, 'assets/scripts/WorldFolderBuilder.ts');
const folderSource = ts.createSourceFile(folderFilename, fs.readFileSync(folderFilename, 'utf8'), ts.ScriptTarget.Latest, true);
const folderDeclaration = folderSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'WorldFolderBuilder');
const folderMethods = ['renderWorldFolder', 'cleanupDeletedCharts'].map(name => {
  const method = folderDeclaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(folderSource) === name);
  assert(method, 'actual WorldFolderBuilder method missing: ' + name); return method.getText(folderSource);
});
class FolderViewProbe {
  constructor(reader, _open, _editor, port) { this.reader = reader; this.port = port; this.statuses = []; }
  mount() { this.visibleWorlds = this.reader.getWorlds(); }
  showStatus(status) { this.statuses.push(status); }
}
const FolderProbe = new Function('WorldFolderView', 'createWorldFolderReader', 'createAccountMilestoneReader', 'isValid',
  ts.transpileModule('class FolderProbe {' + folderMethods.join('\n') + '}\nreturn FolderProbe;', {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
  }).outputText)(FolderViewProbe, createWorldFolderReader, createAccountMilestoneReader, () => true);
async function fixture(options = {}) {
  const context = { accountId: 'wiring-contract', worldId: 'wiring-primary', worldKind: 'Primary', shoreOrigin: null, protagonistCharacterId: content.protagonistCharacterId };
  const key = 'neurou-world-state-v1:' + encodeURIComponent(context.accountId) + ':' + encodeURIComponent(context.worldId);
  const memory = new Map(), writes = [], commits = [], order = []; let failing = false;
  const codec = createPrimaryWorldStateCodec(context.accountId, context.worldId, content, regular.chartId);
  const storage = new WorldCoreStateStorage({ getItem: key => memory.get(key) ?? null, setItem(key, value) {
    if (failing) throw new Error('quota controlled'); order.push('core-write'); writes.push({ key, value }); memory.set(key, value);
  } }, { request: (_name, operation) => operation() }, (raw, account, world) => codec.parse(raw, account, world), () => true);
  const lease = await storage.acquireWorldLease(context.accountId, context.worldId), runtime = new RuntimeProbe();
  const control = { currentPerceptionMode: 'Normal', beatClockOffsetMs: 0, endpointSettled: false,
    deepTraceTriggered: false, chartCompletionRecorded: false, revealPhase: 'Idle', chartEntryScheduled: false, worldMotionGated: false };
  const legacy = { submitFrameIntents() {}, getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready',
    isWorldMotionGated: () => false, getPuzzleControlState: () => clone(control) };
  const world = new WorldClearSession(context, content, legacy, { readRecords: () => [], now: () => now,
    persistLedger: ledger => runtime.persistLedger(ledger), async commitRecord(record) { order.push('account-commit'); commits.push(record); } });
  const premiere = new ChartPremiere(chart, layout), mediaClock = { time: 0, ended: false };
  world.bindWorldChart(premiere, () => mediaClock.time, () => ({ ended: mediaClock.ended, unavailable: false }));
  const archive = new ChartArchive(context), bytes = fs.readFileSync(path.join(root, 'assets/resources/audio/primary-rain-world-1.wav'));
  const media = { kind: 'Audio', contentId: 'primary-rain-world-1-audio', contentRevision: '1.0.0', resourcePath: content.worldBossChartSource.mediaResourcePath,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  Object.assign(runtime, { worldIdentity: { ...context, coreStorage: storage, lease }, preparedContent: content,
    worldClearSession: world, graph: { session: legacy }, chainId: 'T6_MAIN_CHAIN', deepTraceId: 'T6_MAIN_DEEP_TRACE', regularChartId: regular.chartId,
    puzzleChain: new PuzzleChain(new PuzzleProgress(), 1000), revealSequence: { getTerminalPhase: () => 'Idle' }, replaySession: { isActive: () => false },
    keyboardLayout: layout, worldPerformedChart: chart, worldPerformedVisual: visual, contentManifest: { media: [media] }, verifiedMedia: new Map([[media.resourcePath, media]]),
    worldLinkSession: new WorldLinkSession(context), chartSnapshots: archive.emptySnapshots(), chartScores: archive.emptyScores(), coreView: { refresh() {} } });
  runtime.recallSession = new RecallCountSession({ accountId: context.accountId, worldId: context.worldId,
    protagonistCharacterId: content.protagonistCharacterId, regularChartId: regular.chartId }, { readLedger: () => world.getLedgerSnapshot(), now: () => now,
    persistSnapshot: recalls => runtime.persistCore(world.getLedgerSnapshot(), runtime.coreSnapshot.sections.PuzzleProgress, { RecallCount: recalls }) });
  const ledger = world.getLedgerSnapshot();
  let core = { schemaVersion: 1, kind: 'Core', accountId: context.accountId, worldId: context.worldId, worldKind: 'Primary', shoreOrigin: null,
    revision: 0, capturedAt: now, sections: { Ledger: ledger, PuzzleProgress: [runtime.capturePuzzle(ledger)], FormatTime: { epochMs: now - 1000 },
      RecallCount: runtime.recallSession.getSnapshot(), WorldLink: runtime.worldLinkSession.getSnapshot(), ChartSnapshot: archive.emptySnapshots(), ChartScore: archive.emptyScores() } };
  if (options.legacy) { for (const name of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) delete core.sections[name]; }
  runtime.coreSnapshot = codec.parse(core); memory.set(key, JSON.stringify(runtime.coreSnapshot));
  return { context, key, runtime, world, premiere, mediaClock, memory, writes, commits, order, control, codec, lease,
    fail: value => { failing = value; }, choose() { world.submitFrameIntents([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }], 1 / 60); },
    enter() { world.submitFrameIntents([{ kind: 'EnterWorldChart' }], 1 / 60); },
    async complete() { mediaClock.time = 6000; mediaClock.ended = true; world.submitFrameIntents([], 1 / 60); await flush(); } };
}
const results = [];
async function test(name, operation) { await operation(); results.push({ name, category: 'ContractTest', result: 'PASS' }); }
(async () => {
  await test('actual Scene persistence commits nonzero maker choice and all four extension sections in one leased key', async () => {
    const f = await fixture(); try { f.choose(); const saved = JSON.parse(f.memory.get(f.key));
      assert.equal(f.writes.length, 1); assert.equal(f.writes[0].key, f.key); assert.equal(Object.keys(saved.sections).length, 7);
      assert(saved.sections.Ledger.characters[0].events[0].vector.some(value => value > 0));
      assert.equal(saved.sections.WorldLink.kind, 'NotApplicable'); assert.equal(saved.sections.Ledger.control.sphereCrossed, true);
    } finally { f.lease.release(); }
  });
  await test('actual World completion writes Ledger, actual played snapshot and result atomically before account commit', async () => {
    const f = await fixture(); try { f.choose(); f.enter(); await f.complete(); const saved = f.codec.parseComplete(JSON.parse(f.memory.get(f.key)));
      assert.equal(f.writes.length, 2); assert.equal(f.commits.length, 1); assert.deepEqual(f.order, ['core-write', 'core-write', 'account-commit']);
      assert(saved.sections.Ledger.control.completionEventId); assert.equal(saved.sections.ChartSnapshot.records.length, 1);
      assert.equal(saved.sections.ChartScore.records[0].best.totalScore, 0); assert.deepEqual(saved.sections.ChartSnapshot.records[0].chart, chart);
    } finally { f.lease.release(); }
  });
  await test('completion quota failure publishes neither complete Ledger nor artifacts nor account success', async () => {
    const f = await fixture(); try { f.choose(); f.enter(); const before = f.memory.get(f.key), liveBefore = f.world.getLedgerSnapshot(); f.fail(true);
      f.mediaClock.time = 6000; f.mediaClock.ended = true; assert.throws(() => f.world.submitFrameIntents([], 1 / 60), /quota/); await flush();
      assert.equal(f.memory.get(f.key), before); assert.deepEqual(f.world.getLedgerSnapshot(), liveBefore); assert.equal(f.commits.length, 0);
      assert.equal(f.runtime.chartSnapshots.records.length, 0); assert.equal(f.runtime.chartScores.records.length, 0);
      f.fail(false); await f.complete(); assert.equal(f.commits.length, 1);
    } finally { f.lease.release(); }
  });
  await test('unverified actual media prevents completion before durable write or account success', async () => {
    const f = await fixture(); try { f.choose(); f.enter(); f.runtime.verifiedMedia.clear(); const before = f.memory.get(f.key);
      f.mediaClock.time = 6000; f.mediaClock.ended = true; assert.throws(() => f.world.submitFrameIntents([], 1 / 60), /实际内容/);
      assert.equal(f.memory.get(f.key), before); assert.equal(f.commits.length, 0);
    } finally { f.lease.release(); }
  });
  await test('reading and stable no-op of legacy3 does not silently migrate four fields or write storage', async () => {
    const f = await fixture({ legacy: true }); try { const before = f.memory.get(f.key); f.runtime.saveStableCore();
      assert.equal(f.writes.length, 0); assert.equal(f.memory.get(f.key), before); assert.equal(Object.keys(f.runtime.coreSnapshot.sections).length, 3);
    } finally { f.lease.release(); }
  });
  await test('new gameplay append may explicitly establish extension mechanism on old three-section carrier', async () => {
    const f = await fixture({ legacy: true }); try { f.choose(); assert.equal(f.writes.length, 1);
      assert.equal(Object.keys(JSON.parse(f.memory.get(f.key)).sections).length, 7); assert.equal(f.runtime.coreSnapshot.sections.FormatTime.epochMs, now - 1000);
    } finally { f.lease.release(); }
  });
  await test('actual capturePuzzle blocks World play and replay despite valid stored stable checkpoint', async () => {
    const f = await fixture(); try {
      f.choose(); f.enter(); assert.throws(() => f.runtime.capturePuzzle(f.world.getLedgerSnapshot()), /UnsupportedBoundary: World/);
      f.world.submitFrameIntents([{ kind: 'ExitChart' }], 1 / 60); f.runtime.replaySession = { isActive: () => true };
      assert.throws(() => f.runtime.capturePuzzle(f.world.getLedgerSnapshot()), /UnsupportedBoundary: 重演/);
    } finally { f.lease.release(); }
  });
  await test('actual capturePuzzle blocks active reveal and entry gate without resetting them', async () => {
    const f = await fixture(); try { f.control.chartEntryScheduled = true; f.control.worldMotionGated = true; const before = clone(f.control);
      assert.throws(() => f.runtime.capturePuzzle(f.world.getLedgerSnapshot()), /UnsupportedBoundary/); assert.deepEqual(f.control, before);
    } finally { f.lease.release(); }
  });
  await test('current live boundary source prevents Complete from being reported from older durable state', async () => {
    const f = await fixture(); try { const session = new WorldStateSession(f.context.accountId, f.context.worldId, () => now);
      session.bindCompleteSource(() => {
        f.runtime.capturePuzzle(f.world.getLedgerSnapshot()); return f.runtime.coreSnapshot;
      }, raw => f.codec.parseComplete(raw));
      assert.equal(session.captureWorldState().kind, 'Complete'); f.choose(); f.enter(); const result = session.captureWorldState();
      assert.equal(result.kind, 'Incomplete'); assert(result.issues.some(issue => issue.reason === 'UnsupportedBoundary'));
    } finally { f.lease.release(); }
  });
  await test('actual directory renderer retains active worlds on tombstone GC quota failure and retries real leased cleanup', async () => {
    const h = require('./state-test-fixture.cjs'), f = h.fixture({ accountId: 'folder-wiring', worldId: 'world-deleted' });
    const folder = new WorldFolderSession(f.context.accountId, { schemaVersion: 1, accountId: f.context.accountId, records: [
      { worldId: 'InitialWorld', title: 'Active world', description: '', createdAt: now, deletedAt: null, template: 'InitialWorld' },
      { worldId: 'world-deleted', title: 'Deleted world', description: '', createdAt: now, deletedAt: now, template: 'EmptyWorld' },
    ] }, () => { throw new Error('read-only directory fixture'); }, () => { throw new Error('no creation'); }, () => now);
    const key = 'neurou-world-state-v1:' + encodeURIComponent(f.context.accountId) + ':' + encodeURIComponent(f.context.worldId);
    const memory = new Map([[key, JSON.stringify(f.initial)]]), prior = memory.get(key), folderRuntime = new FolderProbe();
    let quota = true, writes = 0;
    const storage = new WorldCoreStateStorage({ getItem: name => memory.get(name) ?? null, setItem(name, value) {
      if (quota) { throw new Error('controlled GC quota'); } writes++; memory.set(name, value);
    } }, { request: (_name, operation) => operation() }, (raw, account, world) => f.codec.parse(raw, account, world),
    (_account, world) => folder.getSnapshot().records.some(record => record.worldId === world && record.deletedAt === null));
    Object.assign(folderRuntime, { startup: { getStartupSnapshot: () => ({ accountId: f.context.accountId }) },
      initializeDirectory: async () => {}, prepareCoreValidator: async () => {}, loadFolderSession: () => folder,
      clearViews() {}, milestoneStorage: { readProjection: () => null }, stateSessions: new Map(), coreStorage: storage });
    await folderRuntime.renderWorldFolder();
    assert.equal(folderRuntime.folderSession, folder); assert.deepEqual(folderRuntime.folderView.visibleWorlds.map(value => value.worldId), ['InitialWorld']);
    assert.equal(folderRuntime.folderView.statuses.length, 1); assert.match(folderRuntime.folderView.statuses[0], /谱面清理待刷新重试.*controlled GC quota/);
    assert.doesNotMatch(folderRuntime.folderView.statuses[0], /世界目录未能加载/); assert.equal(memory.get(key), prior); assert.equal(writes, 0);
    quota = false; await folderRuntime.renderWorldFolder();
    const cleared = JSON.parse(memory.get(key)); assert.equal(writes, 1); assert.equal(cleared.sections.ChartSnapshot, null); assert.equal(cleared.sections.ChartScore, null);
    assert.deepEqual(cleared.sections.Ledger, f.initial.sections.Ledger); assert.equal(folderRuntime.folderView.statuses.length, 0);
    assert.deepEqual(folderRuntime.folderView.visibleWorlds.map(value => value.worldId), ['InitialWorld']);
    assert.equal(folder.getSnapshot().records[1].deletedAt, now);
  });
  await test('actual directory renderer still rejects genuine directory loading failure', async () => {
    const folderRuntime = new FolderProbe();
    Object.assign(folderRuntime, { startup: { getStartupSnapshot: () => ({ accountId: 'folder-wiring' }) },
      initializeDirectory: async () => { throw new Error('controlled folder corruption'); }, clearViews() {},
      milestoneStorage: { readProjection: () => null }, stateSessions: new Map() });
    await folderRuntime.renderWorldFolder(); assert.equal(folderRuntime.folderSession, null);
    assert.deepEqual(folderRuntime.folderView.visibleWorlds, []); assert.match(folderRuntime.folderView.statuses[0], /世界目录未能加载.*controlled folder corruption/);
  });
  fs.writeFileSync(path.join(__dirname, 'runtime-wiring.contract-results.json'), JSON.stringify({ category: 'ContractTest', note: 'Actual SceneBuilder and WorldFolderBuilder method bodies extracted from TypeScript AST; platform/cc lifecycle is not mocked as production acceptance.',
    passed: results.length, failed: 0, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'runtime-wiring.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 1, results, error: String(error.stack) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
