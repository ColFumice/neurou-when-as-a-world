'use strict';
// Execute the actual composition-root forkStorage initializer, not a copy of its validation rules.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), ts = require('typescript');
const s = require('./storage.contract.cjs');
const { fixture, accountId, targetId, complete, stateKey, h } = s;
const { load, clone, epochMs } = h;
const { WorldForkStorage } = load('src/presentation/WorldForkStorage.ts');
const { validateWorldForkPlan, rebaseWorldState } = load('src/director/WorldForkSession.ts');
const { WorldFolderSession } = load('src/director/WorldFolderSession.ts');
const { chartContentDigest, ChartArchive } = load('src/director/ChartArchive.ts');
const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const { WorldStateSession } = load('src/director/WorldStateSession.ts');
const { WorldStateCodec } = load('src/director/WorldStateCodec.ts');
const { InputSource } = load('src/ledger/NarrativeEvent.ts');
const { NarrativeDimension, VectorSchemaVersion } = load('constants/index.ts');
const filename = path.join(h.root, 'assets/scripts/WorldFolderBuilder.ts');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'WorldFolderBuilder');
const property = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === 'forkStorage');
assert(property?.initializer, 'actual production forkStorage initializer missing');
class CaptureBindings { constructor(_platform, _locks, bindings) { this.bindings = bindings; } }
function productionBindings(runtime) {
  // Bind this explicitly: captured arrows must close over the same composition root fixture.
  const create = new Function('WorldForkStorage', 'validateWorldForkPlan', 'WorldFolderSession', 'chartContentDigest',
    'rebaseWorldState', 'createAccountMilestoneReader', ts.transpileModule('return ' + property.initializer.getText(source) + ';', {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
    }).outputText);
  return create.call(runtime, CaptureBindings, validateWorldForkPlan, WorldFolderSession, chartContentDigest,
    rebaseWorldState, createAccountMilestoneReader).bindings;
}
async function wiring(operation, options) {
  const f = await fixture(options);
  try {
    let projection = { schemaVersion: 1, accountId, FirstWorldCleared: true }, permissionReads = 0;
    const runtime = { coreStorage: f.core, directoryCompleteValidator: complete, creationIds: new Set(),
      loadFolderSession: () => new WorldFolderSession(accountId, JSON.parse(f.memory.get(s.folderKey)),
        () => { throw new Error('read cannot persist directory'); }, () => { throw new Error('read cannot create'); }, () => epochMs),
      milestoneStorage: { readProjection: account => { assert.equal(account, accountId); permissionReads++; return projection; } } };
    const bindings = productionBindings(runtime);
    await operation({ ...f, runtime, bindings, permissionReads: () => permissionReads,
      setProjection: value => { projection = value; } });
  } finally { f.dispose(); }
}
function validateModified(f, mutate) {
  const raw = clone(f.plan); mutate(raw); const plan = validateWorldForkPlan(raw, complete);
  assert.equal(plan.targetState.worldId, targetId); return plan;
}
const results = [];
async function test(name, operation) { await operation(); results.push({ name, category: 'ContractTest', result: 'PASS' }); }
(async () => {
  await test('actual root validateSource accepts current exact seven-item inheritance and rereads permission', () => wiring(async f => {
    f.bindings.validateSource(f.plan); assert.equal(f.permissionReads(), 1); assert.equal(f.operations.length, 0); f.protect();
  }));
  await test('legal target with invented RecallCount is rejected by actual root exact-inheritance boundary', () => wiring(async f => {
    const plan = validateModified(f, raw => raw.targetState.sections.RecallCount.records.push({
      characterId: raw.targetState.sections.Ledger.protagonistCharacterId,
      eventId: raw.targetState.sections.Ledger.characters[0].events[0].eventId, count: 9,
    }));
    assert.throws(() => f.bindings.validateSource(plan), /精确继承/); assert.equal(f.permissionReads(), 0); f.protect();
  }));
  await test('legal target with a real additional replay score is rejected by actual root inheritance boundary', () => wiring(async f => {
    const raw = clone(f.plan), ledgerEvents = raw.targetState.sections.Ledger.characters[0].events;
    const archive = new ChartArchive({ accountId, worldId: targetId, worldKind: 'Primary', shoreOrigin: null,
      protagonistCharacterId: raw.targetState.sections.Ledger.protagonistCharacterId }, raw.targetState.sections.ChartSnapshot, raw.targetState.sections.ChartScore);
    raw.targetState.sections.ChartScore = archive.prepareReplay({ chartId: h.chart.chartId, playId: 'invented-but-valid-replay',
      guideTransparency: 0, result: h.actualResult(h.chart, h.layout, { perfect: true }) }, ledgerEvents).scores;
    const plan = validateWorldForkPlan(raw, complete); assert.equal(plan.targetState.sections.ChartScore.records[0].completedPlayCount, 2);
    assert.throws(() => f.bindings.validateSource(plan), /精确继承/); assert.equal(f.operations.length, 0);
  }));
  await test('legal target with added ordinary ledger event is rejected by actual root inheritance boundary', () => wiring(async f => {
    const plan = validateModified(f, raw => {
      const vector = Array(20).fill(0); vector[NarrativeDimension.Red] = 0.2;
      raw.targetState.sections.Ledger.characters[0].events.push({ eventId: 'contract-future-ordinary-event', vector,
        VectorSchemaVersion, AppendedAt: { epochMs: epochMs + 1000 }, InputSource: InputSource.Player,
        ChapterTag: {}, ChartRef: { chartId: 'CHART_NOT_BOUND' } });
    });
    assert.throws(() => f.bindings.validateSource(plan), /精确继承/); assert.equal(f.operations.length, 0); f.protect();
  }));
  await test('legally shaped target title tampering rejects at actual root current-source metadata check', () => wiring(async f => {
    const plan = validateModified(f, raw => { raw.targetRecord.title = 'Another legal title'; });
    assert.throws(() => f.bindings.validateSource(plan), /目录文字/); assert.equal(f.operations.length, 0);
  }));
  await test('legally shaped target description tampering rejects at actual root current-source metadata check', () => wiring(async f => {
    const plan = validateModified(f, raw => { raw.targetRecord.description = 'Another legal description'; });
    assert.throws(() => f.bindings.validateSource(plan), /目录文字/); assert.equal(f.operations.length, 0);
  }));
  await test('actual root source validator rejects changed persisted revision even with valid source content', () => wiring(async f => {
    const raw = clone(f.source); raw.revision++; f.memory.set(stateKey('InitialWorld'), JSON.stringify(raw));
    assert.throws(() => f.bindings.validateSource(f.plan), /源世界完整状态已变化/); assert.equal(f.permissionReads(), 0);
  }));
  await test('actual root source validator rejects changed persisted complete content digest at same revision', () => wiring(async f => {
    const raw = clone(f.source); raw.sections.RecallCount.records.push({ characterId: raw.sections.Ledger.protagonistCharacterId,
      eventId: raw.sections.Ledger.characters[0].events[0].eventId, count: 1 });
    complete(raw, accountId, 'InitialWorld'); f.memory.set(stateKey('InitialWorld'), JSON.stringify(raw));
    assert.throws(() => f.bindings.validateSource(f.plan), /源世界完整状态已变化/); assert.equal(f.operations.length, 0);
  }));
  await test('actual root rereads denied CopyPermission rather than trusting plan-time reader', () => wiring(async f => {
    f.setProjection({ schemaVersion: 1, accountId, FirstWorldCleared: false });
    assert.throws(() => f.bindings.validateSource(f.plan), /尚未取得复制权限/); assert.equal(f.permissionReads(), 1); assert.equal(f.operations.length, 0);
  }));
  await test('actual root rejects corrupted account projection and source lease absence', () => wiring(async f => {
    f.setProjection({ schemaVersion: 1, accountId, FirstWorldCleared: 'true' }); assert.throws(() => f.bindings.validateSource(f.plan));
    const noLease = { ...f.runtime, coreStorage: { ...f.core, hasWorldLease: () => false } };
    assert.throws(() => productionBindings(noLease).validateSource(f.plan), /源世界租约/); assert.equal(f.operations.length, 0);
  }));
  await test('actual root target reservation exists only during durable writer and is removed on failure', () => wiring(async f => {
    const observed = [], runtime = { ...f.runtime, coreStorage: { hasWorldLease: () => true,
      saveCoreState(state, expected) { observed.push({ reservation: f.runtime.creationIds.has(JSON.stringify([state.accountId, state.worldId])), expected }); throw new Error('controlled writer failure'); } } };
    const bindings = productionBindings(runtime); assert.throws(() => bindings.writeTarget(f.plan.targetState), /controlled writer failure/);
    assert.deepEqual(observed, [{ reservation: true, expected: null }]); assert.equal(runtime.creationIds.size, 0);
  }));
  await test('actual root callbacks combined with actual fork storage reject legal counter fabrication before any journal write', () => wiring(async f => {
    const plan = validateModified(f, raw => raw.targetState.sections.RecallCount.records.push({
      characterId: raw.targetState.sections.Ledger.protagonistCharacterId,
      eventId: raw.targetState.sections.Ledger.characters[0].events[0].eventId, count: 3,
    }));
    const storage = new WorldForkStorage(f.adapter, f.lock, f.bindings);
    await assert.rejects(storage.withDirectoryLock(accountId, () => storage.commitWorldFork(plan, f.folder)), /精确继承/);
    assert.equal(f.operations.length, 0); f.protect();
  }));
  await test('Core with fork origin and absent Ledger rejects even when every other section is null', () => wiring(async f => {
    const raw = clone(f.plan.targetState); for (const key of Object.keys(raw.sections)) raw.sections[key] = null;
    assert.throws(() => new WorldStateCodec().parse(raw, accountId, targetId), /必须关联已校验的权威账本/);
    assert.equal(f.operations.length, 0);
  }));
  await test('WorldStateSession default availability remains NotImplemented and explicit composition availability is Implemented', () => {
    const prior = new WorldStateSession(accountId, 'InitialWorld', () => epochMs);
    const assembled = new WorldStateSession(accountId, 'InitialWorld', () => epochMs, 'Implemented');
    assert.equal(prior.worldForkAvailability, 'NotImplemented'); assert.equal(assembled.worldForkAvailability, 'Implemented');
    assert.equal(prior.captureWorldState().kind, 'Incomplete'); assert.equal(assembled.captureWorldState().kind, 'Incomplete');
  });
  fs.writeFileSync(path.join(__dirname, 'runtime-wiring.contract-results.json'), JSON.stringify({ category: 'ContractTest',
    note: 'Actual WorldFolderBuilder forkStorage property initializer extracted from current TypeScript AST; full domain and storage fixtures. No Cocos production claim.',
    passed: results.length, failed: 0, results }, null, 2) + '\n'); console.log(JSON.stringify({ passed: results.length, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'runtime-wiring.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length,
    failed: 1, results, error: String(error.stack) }, null, 2) + '\n'); console.error(error); process.exitCode = 1;
});
