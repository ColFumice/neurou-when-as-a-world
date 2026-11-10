'use strict';
// Pure domain contracts use real published content and real premiere snapshots.
// Controlled callback/codec substitutions below test rejection boundaries, not Cocos acceptance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('../b2-state-extensions/state-test-fixture.cjs');
const { load, clone, fixture, content, regular, epochMs, chartContentDigest } = h;
const { WorldForkSession, rebaseWorldState, validateWorldForkPlan } = load('src/director/WorldForkSession.ts');
const { validateWorldForkOrigin } = load('src/director/WorldForkOrigin.ts');
const { createPrimaryWorldStateCodec } = load('src/director/PrimaryWorldState.ts');
const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const { WorldStateCodec, isValidatedWorldStateSnapshot } = load('src/director/WorldStateCodec.ts');
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const targetId = 'world-10000000-0000-4000-8000-000000000001';
const transactionId = 'fork-10000000-0000-4000-8000-000000000002';
const secondId = 'world-10000000-0000-4000-8000-000000000003';
const validate = (raw, accountId, worldId) => createPrimaryWorldStateCodec(accountId, worldId, content, regular.chartId)
  .parseComplete(raw, accountId, worldId);
function context(options = {}) {
  const f = fixture({ completed: options.completed, accountId: options.accountId || 'fork-domain',
    worldId: options.sourceWorldId || 'InitialWorld' });
  const raw = clone(f.initial); raw.revision = 7; raw.capturedAt += 100;
  // A lawful foreign character and a real own-event Recall make inherited indexes nontrivial.
  if (options.completed !== false) {
    raw.sections.Ledger.characters.push({ characterId: 'known-companion', events: [{
      eventId: 'companion-memory', vector: content.interaction.choices[1].vector,
      VectorSchemaVersion: 1, AppendedAt: { epochMs: epochMs - 9000 }, InputSource: InputSource.Autopilot,
      ChapterTag: {}, ChartRef: { chartId: regular.chartId, state: 'Entry' },
    }] });
    const recall = new RecallCountSession({ accountId: f.context.accountId, worldId: f.context.worldId,
      protagonistCharacterId: content.protagonistCharacterId, regularChartId: regular.chartId }, {
      readLedger: () => raw.sections.Ledger, persistSnapshot() {}, now: () => { throw new Error('recall must not sample time'); },
    });
    const choiceId = f.events.find(event => event.eventId.startsWith('WORLD_NARRATIVE_CHOICE:')).eventId;
    recall.recall(choiceId); recall.recall(choiceId); raw.sections.RecallCount = recall.getSnapshot();
  }
  const source = validate(raw, f.context.accountId, f.context.worldId);
  const folder = { schemaVersion: 1, accountId: f.context.accountId, records: [{ worldId: f.context.worldId,
    title: options.title || '雨若的起点', description: '在同一份雨中选择与回忆', createdAt: epochMs - 20000,
    deletedAt: null, template: f.context.worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld' }] };
  const effects = { worldId: 0, transactionId: 0, now: 0 };
  const reader = options.reader || createAccountMilestoneReader(f.context.accountId, {
    schemaVersion: 1, accountId: f.context.accountId, FirstWorldCleared: options.permission !== false,
  });
  const bindings = { createWorldId: () => { effects.worldId++; return options.targetId || targetId; },
    createTransactionId: () => { effects.transactionId++; return options.transactionId || transactionId; },
    now: () => { effects.now++; return options.time === undefined ? epochMs + 500 : options.time; },
    validateComplete: options.validate || validate };
  const planner = new WorldForkSession(f.context.accountId, reader, bindings);
  return { ...f, source, folder, effects, reader, bindings, planner,
    prepare(nextFolder = folder, nextSource = source) { return planner.prepareWorldFork(f.context.worldId, nextFolder, nextSource); } };
}
const noFactories = f => assert.deepEqual(f.effects, { worldId: 0, transactionId: 0, now: 0 });
const normalizedSections = state => {
  const sections = clone(state.sections); sections.Ledger.worldId = '<world>';
  if (sections.Ledger.control.entry) {
    sections.Ledger.control.entry.worldId = '<world>'; sections.Ledger.control.entry.entryId = '<entry>';
  }
  sections.PuzzleProgress.forEach(item => { item.worldId = '<world>'; });
  for (const name of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) { sections[name].worldId = '<world>'; }
  return sections;
};
const results = [];
async function test(name, operation) {
  try { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
  catch (error) { results.push({ name, result: 'FAIL', category: 'ContractTest', error: error.stack }); }
}
(async () => {
  await test('same-account permitted Primary source yields runtime-certified revision-zero independent world', () => {
    const f = context(), plan = f.prepare();
    assert.equal(isValidatedWorldStateSnapshot(plan.targetState), true);
    assert.equal(plan.targetState.worldId, targetId); assert.equal(plan.targetState.accountId, f.context.accountId);
    assert.equal(plan.targetState.worldKind, 'Primary'); assert.equal(plan.targetState.shoreOrigin, null);
    assert.equal(plan.targetState.revision, 0); assert.equal(plan.sourceRevision, 7);
    assert.deepEqual(f.effects, { worldId: 1, transactionId: 1, now: 1 });
  });
  await test('all seven inherited payloads are exact except account/world composite keys', () => {
    const f = context(), plan = f.prepare();
    assert.deepEqual(normalizedSections(plan.targetState), normalizedSections(f.source));
    assert.deepEqual(Object.keys(plan.targetState.sections).sort(), ['Ledger', 'PuzzleProgress', 'FormatTime',
      'RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore'].sort());
  });
  await test('protagonist, foreign-character, event and ChartRef identities keep exact order and values', () => {
    const f = context(), plan = f.prepare();
    assert.deepEqual(plan.targetState.sections.Ledger.characters, f.source.sections.Ledger.characters);
    assert.equal(plan.targetState.sections.Ledger.characters.length, 2);
    assert.equal(plan.targetState.sections.Ledger.control.eventSequence, f.source.sections.Ledger.control.eventSequence);
    assert.equal(plan.targetState.sections.Ledger.control.completionEventId, f.completion.eventId);
  });
  await test('World entry composite uniqueness key is rebased and its local ChartRef identity retained', () => {
    const f = context(), plan = f.prepare(), entry = plan.targetState.sections.Ledger.control.entry;
    assert.equal(entry.entryId, JSON.stringify([f.context.accountId, targetId, content.protagonistCharacterId, 'SphereCrossing']));
    assert.equal(entry.worldId, targetId); assert.deepEqual(entry.ChartRef, f.source.sections.Ledger.control.entry.ChartRef);
    assert.equal(entry.source, 'SphereCrossing'); assert.equal(entry.tier, 'World');
  });
  await test('Puzzle private state, stable flags, chainId and deepTraceId stay exact', () => {
    const f = context(), plan = f.prepare(), source = f.source.sections.PuzzleProgress[0], target = plan.targetState.sections.PuzzleProgress[0];
    assert.deepEqual(target, { ...source, worldId: targetId }); assert.equal(target.chainId, 'T6_MAIN_CHAIN');
    assert.equal(target.deepTraceId, 'T6_MAIN_DEEP_TRACE');
  });
  await test('RecallCount actual count, character/event indexes and trace bindings are inherited', () => {
    const f = context(), plan = f.prepare(), recall = plan.targetState.sections.RecallCount;
    assert.equal(recall.records[0].count, 2); assert.deepEqual(recall.records, f.source.sections.RecallCount.records);
    assert.deepEqual(recall.traceBindings, f.source.sections.RecallCount.traceBindings);
    assert.equal(recall.worldId, targetId);
  });
  await test('FormatTime remains original while new directory creation and capture time use forkedAt', () => {
    const f = context(), plan = f.prepare();
    assert.deepEqual(plan.targetState.sections.FormatTime, f.source.sections.FormatTime);
    assert.equal(plan.targetState.sections.FormatTime.epochMs, epochMs - 5000);
    assert.equal(plan.targetRecord.createdAt, epochMs + 500); assert.equal(plan.targetState.capturedAt, epochMs + 500);
  });
  await test('Primary WorldLink explicit NotApplicable is inherited with own world key only', () => {
    const f = context(), plan = f.prepare();
    assert.deepEqual(plan.targetState.sections.WorldLink, { ...f.source.sections.WorldLink, worldId: targetId });
    assert.equal(plan.targetState.sections.WorldLink.kind, 'NotApplicable');
  });
  await test('real frozen World chart, visual, media, owner and contentDigest are retained without regeneration', () => {
    const f = context(), plan = f.prepare(), snapshots = plan.targetState.sections.ChartSnapshot;
    assert.equal(snapshots.records.length, 1); assert.deepEqual(snapshots.records, f.source.sections.ChartSnapshot.records);
    assert.equal(snapshots.records[0].chart.tier, 'World');
    assert.equal(snapshots.records[0].contentDigest, f.source.sections.ChartSnapshot.records[0].contentDigest);
  });
  await test('real scores, completed play identities, best/latest and snapshotDigest stay exact', () => {
    const f = context(), plan = f.prepare();
    assert.deepEqual(plan.targetState.sections.ChartScore.records, f.source.sections.ChartScore.records);
    assert.equal(plan.targetState.sections.ChartScore.records[0].completedPlayCount, 1);
  });
  await test('no account WorldClearRecord, RouteSignature or permission payload enters target seven sections', () => {
    const f = context(), plan = f.prepare();
    for (const excluded of ['WorldClearRecord', 'records', 'RouteSignature', 'CopyPermission', 'FirstWorldCleared']) {
      assert.equal(Object.hasOwn(plan.targetState, excluded), false);
      assert.equal(Object.hasOwn(plan.targetState.sections, excluded), false);
    }
    assert.deepEqual(Object.keys(plan.targetRecord).sort(), ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template'].sort());
  });
  await test('completed source publishes immutable inherited completion witness and canonical full-source digest', () => {
    const f = context(), plan = f.prepare(), origin = plan.targetState.forkOrigin;
    assert.equal(origin.inheritedCompletionEventId, f.source.sections.Ledger.control.completionEventId);
    assert.equal(origin.sourceWorldId, f.context.worldId); assert.equal(origin.sourceRevision, 7);
    assert.equal(origin.sourceCapturedAt, epochMs + 100); assert.equal(origin.transactionId, transactionId);
    assert.equal(plan.sourceDigest, chartContentDigest(f.source)); assert.equal(Object.isFrozen(origin), true);
  });
  await test('unfinished lawful Complete checkpoint inherits null completion and empty real archive collections', () => {
    const f = context({ completed: false }), plan = f.prepare();
    assert.equal(plan.targetState.forkOrigin.inheritedCompletionEventId, null);
    assert.equal(plan.targetState.sections.Ledger.control.completionEventId, null);
    assert.equal(plan.targetState.sections.Ledger.control.entry, null);
    assert.deepEqual(plan.targetState.sections.ChartSnapshot.records, []);
    assert.deepEqual(plan.targetState.sections.ChartScore.records, []);
  });
  await test('crossed but unfinished source preserves its real maker choice and available World entry with null witness', () => {
    const f = context({ completed: false });
    f.world.submitFrameIntents([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }], 1 / 60);
    const raw = clone(f.source); raw.sections.Ledger = f.world.getLedgerSnapshot();
    const source = validate(raw, f.context.accountId, f.context.worldId), plan = f.prepare(f.folder, source);
    assert.equal(plan.targetState.forkOrigin.inheritedCompletionEventId, null);
    assert.equal(plan.targetState.sections.Ledger.control.sphereCrossed, true);
    assert.equal(plan.targetState.sections.Ledger.control.selectedChoiceId, content.interaction.choices[0].choiceId);
    assert.equal(plan.targetState.sections.Ledger.control.entry.worldId, targetId);
    assert.equal(plan.targetState.sections.Ledger.characters[0].events.length, 1);
    assert.equal(plan.targetState.sections.ChartSnapshot.records.length, 0);
  });
  await test('source, directory and certified target stay deeply frozen and detached without input mutations', () => {
    const f = context(), sourceBytes = JSON.stringify(f.source), folderBytes = JSON.stringify(f.folder), plan = f.prepare();
    assert.equal(JSON.stringify(f.source), sourceBytes); assert.equal(JSON.stringify(f.folder), folderBytes);
    assert.notEqual(plan.targetState.sections.Ledger.characters, f.source.sections.Ledger.characters);
    assert.notEqual(plan.targetState.sections.FormatTime, f.source.sections.FormatTime);
    assert.equal(Object.isFrozen(plan), true); assert.equal(Object.isFrozen(plan.targetState.sections.Ledger.characters[0].events[0].vector), true);
    assert.throws(() => { plan.targetState.sections.Ledger.characters[0].events[0].vector[0] = 999; });
  });
  await test('new directory record retains description and uses safe copy title and EmptyWorld template', () => {
    const f = context(), plan = f.prepare();
    assert.equal(plan.targetRecord.title, f.folder.records[0].title + ' 的副本');
    assert.equal(plan.targetRecord.description, f.folder.records[0].description);
    assert.equal(plan.targetRecord.template, 'EmptyWorld'); assert.equal(plan.targetRecord.deletedAt, null);
  });
  await test('long title truncation never cuts a surrogate pair and remains within existing 80-unit contract', () => {
    const f = context({ title: '甲'.repeat(75) + '🌧' + '雨' }), plan = f.prepare();
    assert.ok(plan.targetRecord.title.length <= 80); assert.equal(plan.targetRecord.title, '甲'.repeat(75) + ' 的副本');
    assert.doesNotThrow(() => encodeURIComponent(plan.targetRecord.title));
  });
  await test('false CopyPermission rejects before any identity or time callback', () => {
    const f = context({ permission: false }); assert.throws(() => f.prepare(), /CopyPermissionDenied/); noFactories(f);
  });
  await test('foreign-account milestone reader cannot authorize a fork', () => {
    const f = context({ reader: { getMilestoneSnapshot: () => ({ accountId: 'other', FirstWorldCleared: true, CopyPermission: true }) } });
    assert.throws(() => f.prepare(), /同账号/); noFactories(f);
  });
  await test('contradictory mutable permission value is rejected rather than treated as authority', () => {
    const f = context({ reader: { getMilestoneSnapshot: () => ({ accountId: 'fork-domain', FirstWorldCleared: false, CopyPermission: true }) } });
    assert.throws(() => f.prepare()); noFactories(f);
  });
  await test('source JSON clone and a seven-section Core without runtime Complete brand are rejected', () => {
    const f = context(); assert.throws(() => f.prepare(f.folder, clone(f.source)), /CompleteSourceRequired/);
    assert.throws(() => f.prepare(f.folder, f.codec.parse(f.initial)), /CompleteSourceRequired/); noFactories(f);
  });
  await test('Incomplete source cannot be promoted by synthesizing missing empty sections', () => {
    const f = context(); const partial = clone(f.source); partial.sections.RecallCount = null;
    assert.throws(() => f.prepare(f.folder, partial), /CompleteSourceRequired/); noFactories(f);
  });
  await test('foreign-account and foreign-world runtime certified source identities are rejected', () => {
    const f = context(), otherAccount = context({ accountId: 'other-account' }), otherWorld = context({ sourceWorldId: 'world-other' });
    assert.throws(() => f.prepare(f.folder, otherAccount.source)); assert.throws(() => f.prepare(f.folder, otherWorld.source)); noFactories(f);
  });
  await test('source validation failure runs no identities or clocks', () => {
    const f = context({ validate: () => { throw new Error('controlled strict revalidation failure'); } });
    assert.throws(() => f.prepare(), /strict revalidation/); noFactories(f);
  });
  await test('source validator cannot replace the requested current checkpoint with a different certified revision', () => {
    const f = context({ validate: (raw, a, w) => { const next = clone(raw); next.revision++; return validate(next, a, w); } });
    assert.throws(() => f.prepare(), /改变了当前检查点/); noFactories(f);
  });
  for (const kind of ['missing', 'deleted', 'foreign-account', 'duplicate', 'extra-field']) {
    await test('directory ' + kind + ' source rejects before any identity or time callback', () => {
      const f = context(), folder = clone(f.folder);
      if (kind === 'missing') { folder.records = []; }
      if (kind === 'deleted') { folder.records[0].deletedAt = epochMs; }
      if (kind === 'foreign-account') { folder.accountId = 'other-account'; }
      if (kind === 'duplicate') { folder.records.push(clone(folder.records[0])); }
      if (kind === 'extra-field') { folder.records[0].CopyPermission = true; }
      assert.throws(() => f.prepare(folder)); noFactories(f);
    });
  }
  await test('folder and milestone accessors are rejected without invoking getters', () => {
    let reads = 0; const f = context(), folder = clone(f.folder);
    Object.defineProperty(folder.records[0], 'title', { enumerable: true, get: () => { reads++; return '伪造'; } });
    assert.throws(() => f.prepare(folder)); noFactories(f); assert.equal(reads, 0);
    const snapshot = { accountId: 'fork-domain', FirstWorldCleared: true };
    Object.defineProperty(snapshot, 'CopyPermission', { enumerable: true, get: () => { reads++; return true; } });
    const g = context({ reader: { getMilestoneSnapshot: () => snapshot } });
    assert.throws(() => g.prepare()); noFactories(g); assert.equal(reads, 0);
  });
  await test('uncertified source and rebase accessor objects fail before evaluating identity getters', () => {
    let reads = 0; const raw = { get accountId() { reads++; return 'fork-domain'; }, get worldId() { reads++; return 'InitialWorld'; } };
    const f = context(); assert.throws(() => f.prepare(f.folder, raw));
    assert.throws(() => rebaseWorldState(raw, targetId, {}, validate)); assert.equal(reads, 0); noFactories(f);
  });
  await test('target identity must use a UUID v4 and reject collisions including tombstones', () => {
    const invalid = context({ targetId: 'world-short-random' }); assert.throws(() => invalid.prepare(), /UUID/);
    assert.deepEqual(invalid.effects, { worldId: 1, transactionId: 0, now: 0 });
    for (const deletedAt of [null, epochMs]) {
      const f = context(), folder = clone(f.folder); folder.records.push({ ...folder.records[0], worldId: targetId,
        template: 'EmptyWorld', deletedAt }); assert.throws(() => f.prepare(folder), /墓碑/);
      assert.deepEqual(f.effects, { worldId: 1, transactionId: 0, now: 0 });
    }
  });
  await test('unsafe transaction id and invalid or backwards clock prevent plan publication', () => {
    const badId = context({ transactionId: '\ud800' }); assert.throws(() => badId.prepare(), /编码/);
    assert.equal(badId.effects.now, 0);
    for (const time of [NaN, Infinity, -1, 0.5, epochMs]) { const f = context({ time }); assert.throws(() => f.prepare()); }
  });
  await test('FinalShore hard ban and BugShore capability limit precede all factories', () => {
    for (const shoreOrigin of ['FinalShore', 'BugShore']) {
      const f = context(), raw = clone(f.source); raw.worldKind = 'Shore'; raw.shoreOrigin = shoreOrigin;
      raw.sections.WorldLink.worldKind = 'Shore'; raw.sections.WorldLink.shoreOrigin = shoreOrigin;
      const codec = new WorldStateCodec({ Ledger: x => x, PuzzleProgress: x => x, RecallCount: x => x,
        WorldLink: x => x, ChartSnapshot: x => x, ChartScore: x => x, Complete() {} });
      const boundarySource = codec.parseComplete(raw);
      assert.throws(() => f.prepare(f.folder, boundarySource), shoreOrigin === 'FinalShore' ? /FinalShoreForkForbidden/ : /UnsupportedSourceKind/);
      noFactories(f);
    }
  });
  await test('target validator must return certified target identity and exact inherited contents', () => {
    const f = context({ validate: (raw, a, w) => {
      if (w === 'InitialWorld') { return validate(raw, a, w); }
      const changed = clone(raw); changed.capturedAt++; return validate(changed, a, w);
    } }); assert.throws(() => f.prepare(), /改变了七项继承内容/);
    const g = context({ validate: (raw, a, w) => w === 'InitialWorld' ? validate(raw, a, w) : raw });
    assert.throws(() => g.prepare(), /CompleteSourceRequired/);
  });
  await test('descendant fork names its immediate source but preserves original completion and FormatTime', () => {
    const f = context(), first = f.prepare();
    const folder = clone(f.folder); folder.records.push(clone(first.targetRecord));
    const planner = new WorldForkSession(f.context.accountId, f.reader, { ...f.bindings,
      createWorldId: () => secondId, createTransactionId: () => 'fork-second', now: () => epochMs + 700 });
    const second = planner.prepareWorldFork(targetId, folder, first.targetState);
    assert.equal(second.targetState.forkOrigin.sourceWorldId, targetId);
    assert.equal(second.targetState.forkOrigin.inheritedCompletionEventId, f.completion.eventId);
    assert.deepEqual(second.targetState.sections.FormatTime, f.source.sections.FormatTime);
    assert.deepEqual(normalizedSections(second.targetState), normalizedSections(f.source));
  });
  await test('descendant fork cannot reuse the previous immutable transaction id', () => {
    const f = context(), first = f.prepare(), folder = clone(f.folder); folder.records.push(clone(first.targetRecord));
    const planner = new WorldForkSession(f.context.accountId, f.reader, { ...f.bindings, createWorldId: () => secondId });
    assert.throws(() => planner.prepareWorldFork(targetId, folder, first.targetState), /复用来源事务/);
  });
  await test('serialized journal plan validates losslessly to a new runtime-certified complete target', () => {
    const f = context(), plan = f.prepare(), restored = validateWorldForkPlan(clone(plan), validate);
    assert.equal(isValidatedWorldStateSnapshot(restored.targetState), true); assert.deepEqual(restored, plan);
    assert.notEqual(restored.targetState, plan.targetState); assert.equal(Object.isFrozen(restored), true);
  });
  for (const field of ['schemaVersion', 'accountId', 'transactionId', 'sourceWorldId', 'targetWorldId', 'sourceRevision', 'sourceDigest']) {
    await test('journal plan rejects tampered header field ' + field, () => {
      const plan = clone(context().prepare());
      const replacements = { schemaVersion: 2, accountId: 'other', transactionId: 'other', sourceWorldId: 'world-other',
        targetWorldId: secondId, sourceRevision: 8, sourceDigest: 'invalid digest' };
      plan[field] = replacements[field]; assert.throws(() => validateWorldForkPlan(plan, validate));
    });
  }
  await test('journal plan rejects extra fields, accessor/cyclic payloads and sparse folder arrays', () => {
    const plan = clone(context().prepare()); plan.permissions = { CopyPermission: true };
    assert.throws(() => validateWorldForkPlan(plan, validate)); delete plan.permissions;
    let reads = 0; Object.defineProperty(plan.targetState, 'capturedAt', { enumerable: true, get: () => { reads++; return epochMs; } });
    assert.throws(() => validateWorldForkPlan(plan, validate)); assert.equal(reads, 0);
    const cycle = clone(context().prepare()); cycle.targetState.sections.extra = cycle.targetState;
    assert.throws(() => validateWorldForkPlan(cycle, validate));
    const f = context(), folder = clone(f.folder); folder.records.length = 3;
    assert.throws(() => f.prepare(folder)); noFactories(f);
  });
  await test('journal target record must match target identity, creation time, active state and six-field schema', () => {
    for (const mutate of [x => x.worldId = secondId, x => x.createdAt++, x => x.deletedAt = x.createdAt,
      x => x.template = 'InitialWorld', x => x.title = '', x => x.extra = true]) {
      const plan = clone(context().prepare()); mutate(plan.targetRecord); assert.throws(() => validateWorldForkPlan(plan, validate));
    }
  });
  await test('journal target must be initial revision zero with origin capture time and inherited completion witness', () => {
    for (const mutate of [x => x.revision++, x => x.capturedAt++, x => x.forkOrigin.inheritedCompletionEventId = null,
      x => delete x.forkOrigin]) {
      const plan = clone(context().prepare()); mutate(plan.targetState); assert.throws(() => validateWorldForkPlan(plan, validate));
    }
  });
  await test('origin rejects extra, missing, prototype and symbol data fields without invoking accessors', () => {
    const plan = context().prepare(), origin = clone(plan.targetState.forkOrigin);
    for (const bad of [{ ...origin, extra: true }, { ...origin, schemaVersion: 2 }, Object.assign(Object.create({}), origin),
      { ...origin, [Symbol('extra')]: true }]) {
      assert.throws(() => validateWorldForkOrigin(bad, plan.accountId, targetId, plan.targetState.sections.Ledger));
    }
    const missing = { ...origin }; delete missing.sourceRevision; assert.throws(() => validateWorldForkOrigin(missing, plan.accountId, targetId, null));
    let reads = 0; const getter = { ...origin }; Object.defineProperty(getter, 'forkedAt', { enumerable: true, get: () => { reads++; return epochMs; } });
    assert.throws(() => validateWorldForkOrigin(getter, plan.accountId, targetId, null)); assert.equal(reads, 0);
  });
  await test('origin rejects self-fork, account/target/protagonist mismatch, unsafe values and invalid chronology', () => {
    const plan = context().prepare();
    for (const delta of [{ sourceWorldId: targetId }, { accountId: 'other' }, { targetWorldId: secondId },
      { protagonistCharacterId: 'other-protagonist' }, { sourceRevision: -1 }, { sourceCapturedAt: Infinity },
      { forkedAt: epochMs }, { transactionId: '\ud800' }, { inheritedCompletionEventId: '' }]) {
      assert.throws(() => validateWorldForkOrigin({ ...plan.targetState.forkOrigin, ...delta },
        plan.accountId, targetId, plan.targetState.sections.Ledger));
    }
  });
  await test('inherited completion must match one own World premiere event and lawful same-chart entry', () => {
    const plan = context().prepare();
    for (const mutate of [ledger => ledger.control.completionEventId = 'different', ledger => ledger.control.sphereCrossed = false,
      ledger => ledger.control.entry.tier = 'Regular', ledger => ledger.control.entry.ChartRef.chartId = 'other-chart',
      ledger => ledger.characters[0].events.find(event => event.eventId.startsWith('WORLD_PREMIERE_COMPLETED:')).ChartRef.state = 'Entry',
      ledger => ledger.characters[0].events.find(event => event.eventId.startsWith('WORLD_PREMIERE_COMPLETED:')).InputSource = InputSource.Autopilot]) {
      const ledger = clone(plan.targetState.sections.Ledger); mutate(ledger);
      assert.throws(() => validateWorldForkOrigin(plan.targetState.forkOrigin, plan.accountId, targetId, ledger));
    }
  });
  await test('initial null origin can coexist with later lawful own premiere without changing immutable provenance', () => {
    const plan = context().prepare(); const originalNull = { ...plan.targetState.forkOrigin, inheritedCompletionEventId: null };
    const parsed = validateWorldForkOrigin(originalNull, plan.accountId, targetId, plan.targetState.sections.Ledger);
    assert.equal(parsed.inheritedCompletionEventId, null); assert.equal(Object.isFrozen(parsed), true);
    // Initial transaction plans still reject this mismatch; later saved revisions are codec/storage concerns.
    const initial = clone(plan); initial.targetState.forkOrigin.inheritedCompletionEventId = null;
    assert.throws(() => validateWorldForkPlan(initial, validate));
  });
  await test('explicit rebase rejects origin source revision, capture time and completion tampering', () => {
    const f = context(), plan = f.prepare();
    for (const delta of [{ sourceWorldId: 'world-other' }, { sourceRevision: 9 }, { sourceCapturedAt: epochMs },
      { inheritedCompletionEventId: null }, { protagonistCharacterId: 'other' }]) {
      assert.throws(() => rebaseWorldState(f.source, targetId, { ...plan.targetState.forkOrigin, ...delta }, validate));
    }
  });
  const summary = { batch: 'B2.3-domain', category: 'ContractTest', total: results.length,
    passed: results.filter(result => result.result === 'PASS').length,
    failed: results.filter(result => result.result === 'FAIL').length, results };
  fs.writeFileSync(path.join(__dirname, 'domain-results.json'), JSON.stringify(summary, null, 2));
  process.stdout.write(JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed }) + '\n');
  for (const result of results.filter(result => result.result === 'FAIL')) { process.stderr.write(result.name + '\n' + result.error + '\n'); }
  if (summary.failed) { process.exitCode = 1; }
})().catch(error => { console.error(error); process.exitCode = 1; });
