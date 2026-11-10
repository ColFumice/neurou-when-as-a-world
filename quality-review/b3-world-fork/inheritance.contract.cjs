'use strict';
// Actual fork/clear/replay domains and Chromium views. Clocks, account lock and
// adapter storage are declared contract fixtures; this is not Creator evidence.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), os = require('node:os'), child = require('node:child_process');
const h = require('../b2-state-extensions/state-test-fixture.cjs');
const { root, load, clone, fixture, content, regular, chart, layout, epochMs, ChartArchive } = h;
const { WorldForkSession } = load('src/director/WorldForkSession.ts');
const { ForkWorldClearSession } = load('src/director/ForkWorldClearSession.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { ChartReplaySession } = load('src/director/ChartReplaySession.ts');
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { createPrimaryWorldStateCodec } = load('src/director/PrimaryWorldState.ts');
const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const { WorldClearStorage } = load('src/presentation/WorldClearStorage.ts');
const { AccountMilestoneStorage } = load('src/presentation/AccountMilestoneStorage.ts');
const checks = [], flush = () => new Promise(resolve => setImmediate(resolve));
const validate = (raw, accountId, worldId) => createPrimaryWorldStateCodec(accountId, worldId, content, regular.chartId).parseComplete(raw, accountId, worldId);
async function test(name, fn) { await fn(); checks.push({ name, result: 'PASS', category: 'ContractTest' }); }
function directory(core) {
  return { schemaVersion: 1, accountId: core.accountId, records: [{ worldId: core.worldId, title: '雨中的世界',
    description: '正式叙事内容的契约载体', createdAt: epochMs - 10000, deletedAt: null,
    template: core.worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld' }] };
}
function plan(source, reader, time = epochMs + 1000) {
  return new WorldForkSession(source.accountId, reader, { createWorldId: () => 'world-' + crypto.randomUUID(),
    createTransactionId: () => 'fork-' + crypto.randomUUID(), now: () => time, validateComplete: validate })
    .prepareWorldFork(source.worldId, directory(source), source);
}
async function forkFixture(completed = true) {
  const source = fixture({ worldId: 'InitialWorld', completed }); await flush();
  const values = new Map(), writes = [], effects = { commits: 0, now: 0, ledger: [], forwarded: [] };
  const adapter = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push({ key, value }); values.set(key, value); } };
  const storage = new WorldClearStorage(adapter, { request: (_name, operation) => operation() });
  const milestones = new AccountMilestoneStorage(adapter);
  let permissionSource = source;
  if (!completed) { permissionSource = fixture({ accountId: source.context.accountId,
    worldId: 'world-' + crypto.randomUUID() }); await flush(); }
  await storage.commitRecord(permissionSource.world.getWorldClearSnapshot().record, milestones);
  const reader = { getMilestoneSnapshot: () => createAccountMilestoneReader(source.context.accountId,
    milestones.readProjection(source.context.accountId)).getMilestoneSnapshot() };
  const original = validate(source.initial, source.context.accountId, source.context.worldId);
  const planned = plan(original, reader), target = planned.targetState;
  const context = { accountId: target.accountId, worldId: target.worldId, worldKind: 'Primary',
    protagonistCharacterId: content.protagonistCharacterId };
  const legacy = { getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready',
    isWorldMotionGated: () => false, submitFrameIntents: (intents, dt) => effects.forwarded.push({ intents: clone(intents), dt }) };
  let failCommit = false, clock = epochMs + 2000;
  const callbacks = { readRecords: () => storage.readWorldClearRecords(context.accountId),
    commitRecord: record => { effects.commits++; if (failCommit) { return Promise.reject(Error('declared account write failure')); }
      return storage.commitRecord(record, milestones).then(() => undefined); },
    now: () => { effects.now++; return clock; }, persistLedger: value => effects.ledger.push(value) };
  const world = new ForkWorldClearSession(context, content, legacy, callbacks, target.sections.Ledger, target.forkOrigin);
  const media = { time: 0, ended: false, unavailable: false };
  const premiere = new ChartPremiere(chart, layout);
  world.bindWorldChart(premiere, () => media.time, () => ({ ended: media.ended, unavailable: media.unavailable }));
  const writeStart = writes.length;
  return { source, original, target, context, legacy, callbacks, world, media, premiere, effects, storage, milestones, reader,
    writes, writeStart, records: () => storage.readWorldClearRecords(context.accountId), setClock: time => { clock = time; },
    failCommit: flag => { failCommit = flag; }, tick: (intents = []) => world.submitFrameIntents(intents, 1 / 60),
    complete: () => { media.time = 6000; media.ended = true; world.submitFrameIntents([], 1 / 60); } };
}
function unchanged(f, before) {
  assert.equal(JSON.stringify(f.world.getLedgerSnapshot()), before.ledger);
  assert.equal(JSON.stringify(f.records()), before.records); assert.equal(f.writes.length, before.writes);
  assert.equal(f.effects.commits, before.commits); assert.equal(f.effects.ledger.length, before.ledgerWrites);
}
function before(f) { return { ledger: JSON.stringify(f.world.getLedgerSnapshot()), records: JSON.stringify(f.records()),
  writes: f.writes.length, commits: f.effects.commits, ledgerWrites: f.effects.ledger.length }; }
function replayFixture(f) {
  let snapshots = f.target.sections.ChartSnapshot, scores = f.target.sections.ChartScore;
  const media = { time: 0, ended: false }, effects = { saves: 0, recallWrites: 0, prepares: [] };
  const recalls = new RecallCountSession({ accountId: f.context.accountId, worldId: f.context.worldId,
    protagonistCharacterId: f.context.protagonistCharacterId, regularChartId: regular.chartId }, {
    readLedger: () => f.world.getLedgerSnapshot(), persistSnapshot: () => { effects.recallWrites++; },
    now: () => { throw Error('replay must not append Recall'); },
  }, f.target.sections.RecallCount);
  const replay = new ChartReplaySession(f.world, recalls, { readLedger: () => f.world.getLedgerSnapshot(),
    readSnapshots: () => snapshots,
    prepareMedia: (record, premiere) => { effects.prepares.push({ record, premiere }); },
    saveResult: (chartId, playId, guideTransparency, result) => {
      const archive = new ChartArchive({ ...f.context, shoreOrigin: null }, snapshots, scores);
      const candidate = archive.prepareReplay({ chartId, playId, guideTransparency, result }, f.world.getLedgerEvents());
      snapshots = candidate.snapshots; scores = candidate.scores; effects.saves++;
    }, now: () => epochMs + 5000 });
  replay.bindMedia(() => media.time, () => ({ ended: media.ended, unavailable: false }));
  return { replay, recalls, media, effects, snapshots: () => snapshots, scores: () => scores,
    tick: (intents = []) => replay.submitFrameIntents(intents, 1 / 60) };
}
async function domain() {
  await test('I01 actual fork plan rekeys every world carrier while preserving events, chart content and premiere status', async () => {
    const f = await forkFixture();
    assert.equal(f.target.forkOrigin.inheritedCompletionEventId, f.source.completion.eventId);
    assert.deepEqual(f.target.sections.Ledger.characters, f.original.sections.Ledger.characters);
    assert.deepEqual(f.target.sections.ChartSnapshot.records, f.original.sections.ChartSnapshot.records);
    assert.deepEqual(f.target.sections.ChartScore.records, f.original.sections.ChartScore.records);
    assert.notEqual(f.target.sections.Ledger.control.entry.entryId, f.original.sections.Ledger.control.entry.entryId);
    assert.equal(f.target.sections.Ledger.control.entry.entryId, JSON.stringify([f.context.accountId, f.context.worldId,
      f.context.protagonistCharacterId, 'SphereCrossing']));
    assert.equal(f.target.sections.FormatTime.epochMs, f.original.sections.FormatTime.epochMs);
    assert(Object.isFrozen(f.target.sections.ChartSnapshot.records[0].chart));
  });
  await test('I02 inherited completion hydration is readonly and exposes Inherited without an account clear record or error', async () => {
    const f = await forkFixture(), snapshot = f.world.getWorldClearSnapshot();
    assert.equal(snapshot.completionStatus, 'Inherited'); assert.equal(snapshot.record, null); assert.equal(snapshot.completionError, null);
    assert.equal(snapshot.ledgerEventCount, f.source.events.length); assert.equal(f.effects.now, 0);
    assert.equal(f.effects.commits, 0); assert.equal(f.effects.ledger.length, 0); assert.equal(f.writes.length, f.writeStart);
    assert.equal(f.records().length, 1); assert.equal(f.records()[0].worldId, 'InitialWorld');
  });
  await test('I03 inherited EnterWorldChart and RetryWorldClear are ignored while unrelated legacy intents retain their batch', async () => {
    const f = await forkFixture(), prior = before(f), move = { kind: 'MoveAxis', lateral: 1, depth: 0 };
    f.tick([{ kind: 'EnterWorldChart' }, move, { kind: 'RetryWorldClear' }]); await flush();
    assert.equal(f.world.isWorldChartActive(), false); assert.equal(f.premiere.getState(), 'Ready');
    assert.deepEqual(f.effects.forwarded.at(-1).intents, [move]); unchanged(f, prior);
  });
  await test('I04 commit adapter remains guarded even if base public retry is invoked directly', async () => {
    const f = await forkFixture(), prior = before(f);
    WorldClearSession.prototype.submitFrameIntents.call(f.world, [{ kind: 'RetryWorldClear' }], 1 / 60); await flush();
    assert.equal(f.world.getWorldClearSnapshot().completionStatus, 'Inherited');
    assert.equal(f.world.getWorldClearSnapshot().completionError, null); unchanged(f, prior);
  });
  await test('I05 inherited snapshot survives JSON reload with the same completion witness and no writes', async () => {
    const f = await forkFixture(), prior = before(f);
    const restored = validate(clone(f.target), f.context.accountId, f.context.worldId);
    const reloaded = new ForkWorldClearSession(f.context, content, f.legacy, f.callbacks, restored.sections.Ledger, restored.forkOrigin);
    reloaded.submitFrameIntents([{ kind: 'RetryWorldClear' }, { kind: 'EnterWorldChart' }], 1 / 60); await flush();
    assert.equal(reloaded.getWorldClearSnapshot().completionStatus, 'Inherited');
    assert.equal(reloaded.getWorldClearSnapshot().record, null); unchanged(f, prior);
  });
  await test('I06 a fork of a completed fork inherits its legal completion again without importing account records', async () => {
    const f = await forkFixture(), prior = before(f), second = plan(f.target, f.reader, epochMs + 3000).targetState;
    const context = { ...f.context, worldId: second.worldId };
    const world = new ForkWorldClearSession(context, content, f.legacy, f.callbacks, second.sections.Ledger, second.forkOrigin);
    assert.equal(second.forkOrigin.sourceWorldId, f.target.worldId);
    assert.equal(second.forkOrigin.inheritedCompletionEventId, f.source.completion.eventId);
    assert.equal(world.getWorldClearSnapshot().completionStatus, 'Inherited'); assert.equal(world.getWorldClearSnapshot().record, null);
    assert(!JSON.stringify(second).includes('FirstWorldCleared')); unchanged(f, prior);
  });
  await test('I07 wrong account, target, protagonist or completion origin rejects before account, ledger or clock effects', async () => {
    const f = await forkFixture(), prior = before(f);
    for (const [field, value] of [['accountId', 'other-account'], ['targetWorldId', 'other-world'],
      ['protagonistCharacterId', 'other-character'], ['inheritedCompletionEventId', 'WORLD_PREMIERE_COMPLETED:absent']]) {
      const origin = clone(f.target.forkOrigin); origin[field] = value;
      assert.throws(() => new ForkWorldClearSession(f.context, content, f.legacy, f.callbacks, f.target.sections.Ledger, origin));
    }
    assert.throws(() => new ForkWorldClearSession(f.context, content, f.legacy, f.callbacks, undefined, f.target.forkOrigin), /继承账本/);
    assert.equal(f.effects.now, 0); unchanged(f, prior);
  });
  await test('I08 unfinished copy inherits no premiere witness and permits authored choice and actual first premiere', async () => {
    const f = await forkFixture(false), count = f.records().length;
    assert.equal(f.target.forkOrigin.inheritedCompletionEventId, null);
    assert.equal(f.world.getWorldClearSnapshot().completionStatus, 'NotCleared');
    f.tick([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }]);
    assert.equal(f.world.getWorldClearSnapshot().sphereCrossed, true); f.tick([{ kind: 'EnterWorldChart' }]);
    assert.equal(f.world.isWorldChartActive(), true); f.complete(); await flush();
    assert.equal(f.world.getWorldClearSnapshot().completionStatus, 'Completed'); assert.equal(f.effects.commits, 1);
    assert.equal(f.records().length, count + 1); assert.equal(f.records().at(-1).worldId, f.context.worldId);
    assert.equal(f.target.forkOrigin.inheritedCompletionEventId, null);
    assert.equal(f.reader.getMilestoneSnapshot().CopyPermission, true);
    assert.equal(f.writes.slice(f.writeStart).filter(value => value.key.startsWith('neurou-account-first-world-cleared-v1:')).length, 0);
  });
  await test('I09 unfinished copy exiting mid-premiere preserves entry and writes no new account clear', async () => {
    const f = await forkFixture(false);
    f.tick([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[1].choiceId }]); const prior = before(f);
    f.tick([{ kind: 'EnterWorldChart' }]); f.media.time = 500; f.tick([{ kind: 'ExitChart' }]); await flush();
    assert.equal(f.world.getWorldClearSnapshot().completionStatus, 'NotCleared'); assert(f.world.getWorldClearSnapshot().entry);
    assert.equal(f.world.isWorldChartActive(), false); unchanged(f, prior);
  });
  await test('I10 genuine completion retry remains idempotent and never changes inherited witness from null', async () => {
    const f = await forkFixture(false); f.tick([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }]);
    f.tick([{ kind: 'EnterWorldChart' }]); f.complete(); await flush(); const prior = before(f);
    for (let i = 0; i < 3; i++) { f.tick([{ kind: 'EnterWorldChart' }, { kind: 'RetryWorldClear' }]); } await flush();
    assert.equal(f.effects.commits, 1); unchanged(f, prior);
    const reloaded = new ForkWorldClearSession(f.context, content, f.legacy, f.callbacks,
      clone(f.world.getLedgerSnapshot()), f.target.forkOrigin);
    assert.equal(reloaded.getWorldClearSnapshot().completionStatus, 'Completed');
    assert.equal(reloaded.getWorldClearSnapshot().record.worldId, f.context.worldId); unchanged(f, prior);
  });
  await test('I11 failed own completion can explicitly retry after hydration; it is not mistaken for inherited completion', async () => {
    const f = await forkFixture(false); f.failCommit(true);
    f.tick([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }]); f.tick([{ kind: 'EnterWorldChart' }]);
    f.complete(); await flush(); assert.equal(f.world.getWorldClearSnapshot().completionStatus, 'Failed');
    const count = f.records().length, restored = new ForkWorldClearSession(f.context, content, f.legacy, f.callbacks,
      clone(f.world.getLedgerSnapshot()), f.target.forkOrigin);
    assert.equal(restored.getWorldClearSnapshot().completionStatus, 'Failed'); f.failCommit(false);
    restored.submitFrameIntents([{ kind: 'RetryWorldClear' }], 1 / 60); await flush();
    assert.equal(restored.getWorldClearSnapshot().completionStatus, 'Completed'); assert.equal(f.records().length, count + 1);
  });
  await test('I12 inherited completed World chart replays exact archived content and updates only target score', async () => {
    const f = await forkFixture(), prior = before(f), r = replayFixture(f);
    const frozen = JSON.stringify(r.snapshots()), recall = JSON.stringify(r.recalls.getSnapshot()), source = JSON.stringify(f.original);
    const playCount = r.scores().records[0].completedPlayCount;
    r.tick([{ kind: 'ReplayChart', completionEventId: f.target.forkOrigin.inheritedCompletionEventId }]);
    assert.equal(r.replay.isActive(), true); assert.equal(r.effects.prepares[0].record, f.target.sections.ChartSnapshot.records[0]);
    assert.equal(r.replay.getReader().getTier(), 'World'); r.media.time = 6000; r.media.ended = true; r.tick(); await flush();
    assert.equal(r.effects.saves, 1); assert.equal(r.scores().records[0].completedPlayCount, playCount + 1);
    assert.equal(r.scores().worldId, f.context.worldId); assert.equal(JSON.stringify(r.snapshots()), frozen);
    assert.equal(JSON.stringify(r.recalls.getSnapshot()), recall); assert.equal(r.effects.recallWrites, 0);
    assert.equal(JSON.stringify(f.original), source); assert.equal(f.world.getWorldClearSnapshot().completionStatus, 'Inherited'); unchanged(f, prior);
  });
  await test('I13 inherited replay exit before media completion changes neither score, Recall nor account records', async () => {
    const f = await forkFixture(), prior = before(f), r = replayFixture(f), score = JSON.stringify(r.scores());
    r.tick([{ kind: 'ReplayChart', completionEventId: f.target.forkOrigin.inheritedCompletionEventId }]);
    r.media.time = 500; r.tick([{ kind: 'ExitChart' }]); await flush(); assert.equal(r.replay.isActive(), false);
    assert.equal(r.effects.saves, 0); assert.equal(r.effects.recallWrites, 0); assert.equal(JSON.stringify(r.scores()), score); unchanged(f, prior);
  });
  await test('I14 source and target are independent deeply immutable graphs with identical logical event values', async () => {
    const f = await forkFixture(), sourceText = JSON.stringify(f.original);
    assert.notEqual(f.original.sections.Ledger, f.target.sections.Ledger);
    assert.notEqual(f.original.sections.ChartSnapshot.records[0], f.target.sections.ChartSnapshot.records[0]);
    assert.throws(() => { f.target.sections.Ledger.characters[0].events[0].vector[0] = 99; }, TypeError);
    assert.equal(JSON.stringify(f.original), sourceText);
  });
  const completed = await forkFixture(), unfinished = await forkFixture(false);
  return { inherited: clone(completed.world.getWorldClearSnapshot()), unfinished: clone(unfinished.world.getWorldClearSnapshot()),
    complete: clone(completed.target), account: completed.context.accountId,
    milestone: clone(completed.reader.getMilestoneSnapshot()) };
}
async function dom() {
  const { app, BrowserWindow } = require('electron'), ts = require('typescript');
  const input = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--input') + 1], 'utf8'));
  const output = process.argv[process.argv.indexOf('--output') + 1];
  const checks = [];
  app.setPath('userData', path.join(os.tmpdir(), 'neurou-b3-inheritance-dom-' + crypto.randomUUID()));
  app.commandLine.appendSwitch('disable-gpu'); await app.whenReady();
  const win = new BrowserWindow({ width: 1200, height: 1000, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  const ev = (fn, ...args) => win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')', true);
  const test = async (name, fn) => { const evidence = await ev(fn); checks.push({ name, result: 'PASS', category: 'ContractTest', evidence }); };
  try {
    await win.loadURL('about:blank');
    const modules = Object.fromEntries(['WorldFolderView', 'WorldClearView', 'FolderTheme'].map(name => [name,
      ts.transpileModule(fs.readFileSync(path.join(root, 'src/presentation/' + name + '.ts'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText]));
    modules.constants = ts.transpileModule(fs.readFileSync(path.join(root, 'constants/index.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    await ev((modules, input) => {
      const loaded = {}, load = name => { if (loaded[name]) return loaded[name].exports;
        const m = loaded[name] = { exports: {} }; new Function('module', 'exports', 'require', modules[name])
          (m, m.exports, request => load(request.split('/').at(-1))); return m.exports; };
      const t = window.__inheritanceContract = { input, logs: [], pending: null, clear: null, folder: null,
        milestone: input.milestone, snapshot: input.inherited, availability: 'Implemented', capture: { kind: 'Complete', snapshot: input.complete } };
      t.clear = new (load('WorldClearView').WorldClearView)({ getWorldClearSnapshot: () => t.snapshot },
        { getMilestoneSnapshot: () => t.milestone }, intent => t.logs.push(intent)); t.clear.mount();
      t.mountFolder = legacy => {
        t.folder?.destroy(); t.logs = [];
        t.folder = new (load('WorldFolderView').WorldFolderView)(
          { getAccountId: () => input.account, getWorlds: () => [{ worldId: input.complete.worldId, title: '雨中的世界', description: '契约载体' }] },
          entry => t.logs.push({ kind: 'open', worldId: entry.worldId }), () => {},
          { submitWorldFolderIntent: intent => { t.logs.push(intent);
            if (legacy) { throw Error('分叉尚未开放'); }
            return new Promise((resolve, reject) => { t.pending = { resolve, reject }; }); } },
          () => { t.logs.push({ kind: 'reload' }); t.folder.refresh(); },
          { getMilestoneSnapshot: () => { if (t.milestone instanceof Error) { throw t.milestone; } return t.milestone; } },
          () => { if (t.capture instanceof Error) { throw t.capture; } return t.capture; }, undefined,
          legacy ? undefined : () => { if (t.availability instanceof Error) { throw t.availability; } return t.availability; });
        t.folder.mount();
      };
    }, modules, input);
    await test('D01 actual inherited view hides premiere/retry and exposes inherited fact separately from account permission', () => {
      const t = window.__inheritanceContract, root = document.querySelector('#world-clear-view');
      if (!document.querySelector('#enter-world-boss-chart').hidden || !document.querySelector('#retry-world-clear').hidden) { throw Error('Inherited entry/retry visible'); }
      if (root.dataset.completionStatus !== 'Inherited' || root.dataset.copyPermission !== 'true') { throw Error('Inherited/account display conflated'); }
      if (!document.querySelector('#rain-world-entry-status').textContent.includes('随记忆继承')) { throw Error('No inherited explanation'); }
      if (document.querySelector('#rain-world-clear-record').dataset.recordCount !== '0') { throw Error('Fabricated clear record'); }
      if (![...document.querySelectorAll('#rain-story-choices button')].every(button => button.disabled)) { throw Error('Inherited choices enabled'); }
      return { status: root.dataset.completionStatus, recordCount: 0, CopyPermission: true, queuedIntents: t.logs.length };
    });
    await test('D02 unfinished view still submits only authored choice IDs and retains normal first-premiere display', () => {
      const t = window.__inheritanceContract; t.snapshot = t.input.unfinished; t.clear.onFrameRefresh();
      const button = document.querySelector('#rain-story-choices button'); if (button.disabled) { throw Error('Unfinished choice blocked'); }
      button.click(); const intent = t.logs.at(-1);
      if (Object.keys(intent).sort().join(',') !== 'choiceId,kind' || intent.kind !== 'ChooseWorldNarrative') { throw Error('Choice payload expanded'); }
      return intent;
    });
    await test('D03 configured folder enables only permission plus Complete Primary and submits frozen WorldFork intent', async () => {
      const t = window.__inheritanceContract; t.mountFolder(false);
      const button = document.querySelector('[data-action="fork-world"]'); if (button.disabled) { throw Error('Valid fork disabled'); }
      button.click(); if (!document.querySelector('[data-action="fork-world"]').disabled) { throw Error('Pending fork remains enabled'); }
      if (document.querySelector('#world-folder').dataset.pending !== 'true') { throw Error('Pending marker absent'); }
      if (!document.querySelector('#world-folder-status').textContent.includes('正在分叉')) { throw Error('No pending status'); }
      const intent = t.logs.find(value => value.kind === 'WorldFork');
      if (Object.keys(intent).sort().join(',') !== 'kind,worldId') { throw Error('Frozen fork intent expanded'); }
      document.querySelector('[data-action="fork-world"]').click(); if (t.logs.filter(value => value.kind === 'WorldFork').length !== 1) { throw Error('Pending duplicate submitted'); }
      t.pending.resolve(); await new Promise(resolve => setTimeout(resolve, 0));
      if (!t.logs.some(value => value.kind === 'reload') || document.querySelector('[data-action="fork-world"]').disabled) { throw Error('Successful fork not refreshed'); }
      if (document.querySelector('#world-folder').dataset.pending !== undefined) { throw Error('Settled pending marker retained'); }
      return { submitted: intent, duplicateSuppressed: true, refreshed: true };
    });
    await test('D04 configured folder rejects permission absence, Incomplete, Shore, wrong identity and reader errors in UI', () => {
      const t = window.__inheritanceContract, good = t.input;
      const cases = [
        { milestone: { ...good.milestone, FirstWorldCleared: false, CopyPermission: false } },
        { capture: { kind: 'Incomplete', issues: [] } },
        { capture: { kind: 'Complete', snapshot: { ...good.complete, worldKind: 'Shore', shoreOrigin: 'FinalShore' } } },
        { capture: { kind: 'Complete', snapshot: { ...good.complete, accountId: 'other-account' } } },
        { milestone: Error('contract read error') }, { capture: Error('contract inspect error') },
        { availability: 'NotImplemented' }, { availability: Error('contract availability error') },
      ];
      for (const changes of cases) {
        t.milestone = good.milestone; t.capture = { kind: 'Complete', snapshot: good.complete }; t.availability = 'Implemented';
        Object.assign(t, changes); t.folder.refresh(); if (!document.querySelector('[data-action="fork-world"]').disabled) { throw Error('Invalid condition enabled fork'); }
      }
      t.milestone = good.milestone; t.capture = { kind: 'Complete', snapshot: good.complete }; t.availability = 'Implemented'; t.folder.refresh();
      return { blockedCases: cases.length, authoritativeDirectorStillRequired: true };
    });
    await test('D05 async fork failure is visible, leaves list intact and re-enables retry', async () => {
      const t = window.__inheritanceContract; document.querySelector('[data-action="fork-world"]').click();
      t.pending.reject(Error('contract fork transaction failed')); await new Promise(resolve => setTimeout(resolve, 0));
      if (!document.querySelector('#world-folder-status').textContent.includes('transaction failed')) { throw Error('Rejected promise concealed'); }
      if (document.querySelector('[data-action="fork-world"]').disabled || document.querySelectorAll('.folder-world-card').length !== 1) { throw Error('Failure changed source list or disabled retry'); }
      return { visibleError: true, sourceCards: 1, retryEnabled: true };
    });
    await test('D06 legacy folder without availability retains NotImplemented enabled click and diagnostic rejection', async () => {
      const t = window.__inheritanceContract; t.mountFolder(true);
      const button = document.querySelector('[data-action="fork-world"]'); if (button.disabled) { throw Error('Legacy click changed'); }
      button.click(); await new Promise(resolve => setTimeout(resolve, 0));
      if (document.querySelector('#world-fork-availability').dataset.availability !== 'NotImplemented') { throw Error('Legacy readiness changed'); }
      if (!document.querySelector('#world-folder-status').textContent.includes('分叉功能尚未实施')) { throw Error('Legacy rejection changed'); }
      if (t.logs.filter(value => value.kind === 'WorldFork').length !== 1) { throw Error('Legacy intent absent'); }
      return { availability: 'NotImplemented', previousClickBehaviorRetained: true };
    });
    for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
      win.setContentSize(width, height);
      await test('D07-' + width + ' actual Chromium inherited panel and fork card fit their viewport', async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const t = window.__inheritanceContract; t.snapshot = t.input.inherited; t.clear.onFrameRefresh(); t.mountFolder(false);
        const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
        if (new Set(ids).size !== ids.length) { throw Error('Duplicate DOM IDs'); }
        const story = document.querySelector('.rain-story').getBoundingClientRect();
        const fork = document.querySelector('[data-action="fork-world"]').getBoundingClientRect();
        for (const rect of [story, fork]) {
          if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight || rect.width <= 0 || rect.height <= 0) { throw Error('Control outside viewport'); }
        }
        if (document.documentElement.scrollWidth > innerWidth) { throw Error('Horizontal overflow'); }
        return { viewport: [innerWidth, innerHeight], inheritedRecord: document.querySelector('#rain-world-clear-record').textContent,
          forkHint: document.querySelector('.fork-hint').textContent, noDuplicateIds: true, controlsWithinViewport: true };
      });
    }
    await test('D08 a root-replaced folder view does not start a second reload when its fork promise settles', async () => {
      const t = window.__inheritanceContract; t.mountFolder(false);
      document.querySelector('[data-action="fork-world"]').click();
      const finish = t.pending.resolve; t.folder.destroy(); finish();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (t.logs.some(value => value.kind === 'reload')) { throw Error('Destroyed view reloaded folder again'); }
      if (document.querySelector('#world-folder')) { throw Error('Destroyed view remounted itself'); }
      return { extraReloads: 0, destroyedViewStayedUnmounted: true };
    });
    fs.writeFileSync(output, JSON.stringify({ checks }, null, 2)); win.destroy(); app.exit(0);
  } catch (error) { fs.writeFileSync(output, JSON.stringify({ checks, error: String(error.stack || error) }, null, 2)); win.destroy(); app.exit(1); }
}
if (process.argv.includes('--dom')) { void dom(); }
else {
  (async () => {
    const payload = await domain(), token = crypto.randomUUID();
    const input = path.join(os.tmpdir(), 'neurou-b3-inheritance-input-' + token + '.json');
    const output = path.join(os.tmpdir(), 'neurou-b3-inheritance-output-' + token + '.json');
    fs.writeFileSync(input, JSON.stringify(payload));
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const run = child.spawnSync(require('electron'), [__filename, '--dom', '--input', input, '--output', output],
      { cwd: root, windowsHide: true, env, encoding: 'utf8', timeout: 45000 });
    const domResult = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {};
    checks.push(...(domResult.checks || []));
    if (run.status !== 0 || domResult.error) { throw Error(domResult.error || run.stderr || String(run.error || 'Chromium child failed')); }
    fs.unlinkSync(input); fs.unlinkSync(output);
    const result = { generatedAt: new Date().toISOString(), category: 'ContractTest', scope: 'B2.3 inherited premiere / genuine copy completion / replay / actual Chromium views',
      statement: 'All clocks, account lock and storage are explicit contract adapters; no Creator production acceptance is claimed.',
      status: 'PASS', total: checks.length, passed: checks.length, failed: 0, checks };
    fs.writeFileSync(path.join(__dirname, 'inheritance.contract-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, total: result.total, passed: result.passed, failed: result.failed }));
  })().catch(error => {
    fs.writeFileSync(path.join(__dirname, 'inheritance.contract-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(),
      status: 'FAIL', checks, error: String(error.stack || error) }, null, 2));
    console.error(error.stack || error); process.exitCode = 1;
  });
}
