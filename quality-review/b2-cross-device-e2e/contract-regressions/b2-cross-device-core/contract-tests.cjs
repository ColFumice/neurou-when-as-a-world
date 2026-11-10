'use strict';
// Actual production codecs/adapters and lease storage with explicit ContractAdapter fixtures.
// This suite is not Cocos production acceptance and never seeds the preview profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const workspaceRoot = "D:\\Project\\A_New_Begin\\Neurou_official";
const productionSources = ['src/director/CoreTransfer.ts', 'src/director/CoreTransferContent.ts', 'src/presentation/CrossDeviceContractAdapter.ts', 'src/presentation/CrossDeviceImportStorage.ts'];
const sourceHashes = () => productionSources.filter(file => fs.existsSync(path.join(workspaceRoot, file))).map(file => ({ file,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(workspaceRoot, file))).digest('hex') }));
const sourcesBefore = sourceHashes();
const h = require('./contract-test-helpers.cjs');
const { load, clone, accountId, sourceWorldId, targetWorldId, otherWorldId, transactionId, aContext, bContext,
  transferComplete: complete, homeCodec, homeAuthority, worldSource, folder, permission, normalizedSections, frozenTree, epochMs } = h;
const { CoreTransferCodec, CrossDeviceImportAdapter, copyTransferData } = load('src/director/CoreTransfer.ts');
const { CrossDeviceContractAdapter } = load('src/presentation/CrossDeviceContractAdapter.ts');
const { chartContentDigest } = load('src/director/ChartArchive.ts');
const { isValidatedWorldStateSnapshot } = load('src/director/WorldStateCodec.ts');
const { ForkWorldClearSession } = load('src/director/ForkWorldClearSession.ts');
const codec = new CoreTransferCodec(complete);
const request = () => ({ schemaVersion: 1, title: '另一台设备的雨', description: '受限 Core 原型' });
function payloadFor(state, changes = {}) {
  return { schemaVersion: 1, kind: 'RestrictedCoreTransfer', transferId: 'transfer-contract-1',
    sourceDeviceId: aContext.deviceId, sourceHomeRevision: 1, state: clone(state), ...changes };
}
function wrapper(home) {
  return new CrossDeviceContractAdapter(home, { parsePayload: raw => codec.parsePayload(raw),
    parseProof: (raw, payload) => codec.parseProof(raw, payload),
    parseRegistry: (raw, account) => homeCodec.parseSnapshot(raw, account), parseContext: raw => homeCodec.parseContext(raw),
    digestState: state => chartContentDigest(state) });
}
function importer(port, options = {}) {
  const counts = { world: 0, transaction: 0, registration: 0, time: 0 };
  const bindings = { authority: port, milestoneReader: options.reader || permission(options.permission !== false), validateComplete: complete,
    createWorldId: () => { counts.world++; return options.targetWorldId || targetWorldId; },
    createTransactionId: () => { counts.transaction++; return options.transactionId || transactionId; },
    createRegistrationId: () => { counts.registration++; return options.registrationId || 'import-registration-1'; },
    now: () => { counts.time++; return options.time ?? epochMs + 2000; } };
  return { adapter: new CrossDeviceImportAdapter(options.context || bContext, bindings), counts, bindings };
}
async function fixture(options = {}) {
  const { fixture: stateFixture, state: source } = worldSource(options);
  const home = homeAuthority(), authority = wrapper(home), a = authority.bindDevice(aContext), b = authority.bindDevice(bContext);
  await a.registerWorldHome({ schemaVersion: 1, worldId: source.worldId, registrationId: 'source-registration-1' });
  const payload = codec.parsePayload(payloadFor(source));
  const proof = await a.publishTransfer(payload);
  const imp = importer(b, options);
  return { source, stateFixture, payload, proof, home, authority, a, b, ...imp,
    prepare: (value = payload, input = request(), directory = folder()) => imp.adapter.prepareImport(value, input, directory) };
}
const noFactories = value => assert.deepEqual(value.counts, { world: 0, transaction: 0, registration: 0, time: 0 });
const cases = [];
async function test(name, body) {
  const started = performance.now();
  try { await body(); cases.push({ name, result: 'PASS', category: 'ContractAdapter', elapsedMs: Math.round((performance.now() - started) * 1000) / 1000 }); }
  catch (error) { cases.push({ name, result: 'FAIL', category: 'ContractAdapter', error: String(error), stack: error.stack }); }
}
async function domain() {
  await test('C01 seven-section JSON round-trip carries only data, receiver reacquires complete certification', async () => {
    const f = await fixture(), serialized = JSON.stringify(f.payload), raw = JSON.parse(serialized);
    assert.equal(isValidatedWorldStateSnapshot(raw.state), false);
    assert.deepEqual(Object.keys(raw.state.sections), ['Ledger', 'PuzzleProgress', 'FormatTime', 'RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']);
    const received = codec.parsePayload(raw);
    assert.equal(isValidatedWorldStateSnapshot(received.state), false, 'transport payload must remain unbranded');
    const certified = complete(received.state, accountId, sourceWorldId);
    assert.equal(isValidatedWorldStateSnapshot(certified), true); assert.deepEqual(clone(certified), clone(f.source));
    assert.equal(JSON.stringify(received), serialized); frozenTree(received);
  });
  await test('C02 receiver complete validator is mandatory; unchecked JSON callback cannot certify a transfer', () => {
    const raw = payloadFor(worldSource().state);
    assert.throws(() => new CoreTransferCodec(value => value).parsePayload(raw), /认证|身份/);
  });
  await test('C03 each missing/null gameplay section and partial extension group rejects without mutation', () => {
    const original = payloadFor(worldSource().state), before = JSON.stringify(original);
    for (const name of Object.keys(original.state.sections)) {
      const missing = clone(original); delete missing.state.sections[name]; assert.throws(() => codec.parsePayload(missing), name);
      const nulled = clone(original); nulled.state.sections[name] = null; assert.throws(() => codec.parsePayload(nulled), name);
    }
    assert.equal(JSON.stringify(original), before);
  });
  await test('C04 strict schema rejects FileCarry naming, unsupported versions, extra account facts and fake brand', () => {
    const raw = payloadFor(worldSource().state);
    for (const change of [{ kind: 'FileCarryPayload' }, { schemaVersion: 2 }, { sourceHomeRevision: 2 }, { CopyPermission: true }, { accountId }]) {
      assert.throws(() => codec.parsePayload({ ...raw, ...change }));
    }
    const forged = clone(raw); forged.state.sections.FirstWorldCleared = true; assert.throws(() => codec.parsePayload(forged));
    const branded = clone(raw); branded.state[Symbol('WorldStateSnapshot')] = true; assert.throws(() => codec.parsePayload(branded));
  });
  await test('C05 data-only boundary rejects getters without evaluating them, symbols, sparse arrays, prototype and cycles', () => {
    let calls = 0; const getter = { schemaVersion: 1 }; Object.defineProperty(getter, 'value', { enumerable: true, get() { calls++; return 1; } });
    const symbolic = { [Symbol('brand')]: true }, sparse = new Array(1), cycle = {}; cycle.self = cycle;
    const accessorArray = [1]; Object.defineProperty(accessorArray, '0', { enumerable: true, get() { calls++; return 1; } });
    for (const bad of [getter, symbolic, sparse, accessorArray, Object.create({ inherited: true }), cycle, undefined, () => 1, NaN, Infinity, BigInt(1)]) assert.throws(() => copyTransferData(bad));
    assert.equal(calls, 0);
  });
  await test('C06 published narrative vector and referenced ChartRef tampering fail receiver revalidation', () => {
    const raw = payloadFor(worldSource().state), vector = clone(raw), reference = clone(raw);
    vector.state.sections.Ledger.characters[0].events[0].vector[0] += 0.1;
    reference.state.sections.Ledger.characters[0].events[0].ChartRef.chartId = 'unknown-chart';
    assert.throws(() => codec.parsePayload(vector)); assert.throws(() => codec.parsePayload(reference));
  });
  await test('C07 internally recomputed media digest cannot substitute another published media reference', () => {
    const raw = payloadFor(worldSource().state), record = raw.state.sections.ChartSnapshot.records[0];
    record.media.sha256 = '0'.repeat(64);
    record.contentDigest = chartContentDigest({ chart: record.chart, layout: record.layout, visual: record.visual,
      media: record.media, guideTransparency: record.guideTransparency });
    raw.state.sections.ChartScore.records[0].snapshotDigest = record.contentDigest;
    // Existing Core codec accepts self-consistent frozen values; transfer adds the publication-index check.
    assert.equal(isValidatedWorldStateSnapshot(h.complete(raw.state, accountId, sourceWorldId)), true);
    assert.throws(() => codec.parsePayload(raw), /正式发布|正式.*媒体|冻结媒体/);
  });
  await test('C08 published chart/visual replacement remains rejected after recomputing the internal content digest', () => {
    for (const field of ['chart', 'visual']) {
      const raw = payloadFor(worldSource().state), record = raw.state.sections.ChartSnapshot.records[0];
      if (field === 'chart') record.chart.aspectRatio += 0.01; else record.visual.nodes[0].color.r += 1;
      record.contentDigest = chartContentDigest({ chart: record.chart, layout: record.layout, visual: record.visual,
        media: record.media, guideTransparency: record.guideTransparency });
      raw.state.sections.ChartScore.records[0].snapshotDigest = record.contentDigest;
      assert.throws(() => codec.parsePayload(raw));
    }
  });
  await test('C09 source HomeDevice alone may publish; receiver cannot impersonate sender', async () => {
    const f = await fixture(); await assert.rejects(f.b.publishTransfer(f.payload), /来源设备/);
    const spoof = clone(f.payload); spoof.sourceDeviceId = bContext.deviceId;
    await assert.rejects(f.b.publishTransfer(spoof), /归属/);
    assert.equal((await f.a.readRegistry()).records[0].homeDeviceId, aContext.deviceId);
  });
  await test('C10 unknown transfer and same-account self-asserted device header are not source authority', async () => {
    const f = await fixture(), unknown = clone(f.payload); unknown.transferId = 'never-published';
    assert.equal((await f.adapter.detectCrossDeviceDuplicate(unknown)).kind, 'AuthorityUnavailable');
    const spoof = clone(f.payload); spoof.sourceDeviceId = 'self-asserted-device';
    assert.equal((await f.adapter.detectCrossDeviceDuplicate(spoof)).kind, 'AuthorityUnavailable');
  });
  await test('C11 exact publication binds transfer identity; legal same-Core change cannot replace or verify old transfer', async () => {
    const f = await fixture(), changed = clone(f.payload); changed.state.revision++;
    await assert.rejects(f.a.publishTransfer(changed), /传输标识/);
    await assert.rejects(f.b.verifyTransfer(changed), /不匹配/);
    assert.deepEqual(await f.b.verifyTransfer(f.payload), f.proof);
  });
  await test('C12 source proof rejects every changed identity and changed full-state digest', async () => {
    const f = await fixture();
    for (const field of ['accountId', 'worldId', 'sourceDeviceId', 'transferId', 'sourceHomeRevision', 'sourceDigest', 'schemaVersion']) {
      const bad = clone(f.proof); bad[field] = typeof bad[field] === 'number' ? bad[field] + 1 : 'changed'; assert.throws(() => codec.parseProof(bad, f.payload));
    }
    frozenTree(codec.parseProof(f.proof, f.payload));
  });
  await test('C13 two devices share one authority: source Homed, receiver CrossDeviceDuplicate, account isolation', async () => {
    const f = await fixture(); assert.equal((await f.adapter.detectCrossDeviceDuplicate(f.payload)).kind, 'CrossDeviceDuplicate');
    const sourceImport = importer(f.a, { context: aContext }); assert.equal((await sourceImport.adapter.detectCrossDeviceDuplicate(f.payload)).kind, 'Homed');
    const wrong = importer(f.authority.bindDevice({ accountId: 'another-account', deviceId: bContext.deviceId }), { context: { accountId: 'another-account', deviceId: bContext.deviceId }, reader: permission(true, 'another-account') });
    assert.equal((await wrong.adapter.detectCrossDeviceDuplicate(f.payload)).kind, 'AuthorityUnavailable');
  });
  await test('C14 InitialWorld is excluded before authority queries and all ID factories', async () => {
    let calls = 0; const port = { mode: 'ContractAdapter', context: bContext, verifyTransfer: async () => { calls++; throw Error('must not call'); }, readRegistry: async () => { calls++; throw Error('must not call'); }, registerWorldHome: async () => { calls++; throw Error('must not call'); } };
    const imp = importer(port), raw = payloadFor(h.h.fixture({ accountId, worldId: 'InitialWorld' }).initial);
    assert.equal((await imp.adapter.detectCrossDeviceDuplicate(raw)).kind, 'UnsupportedBoundary');
    await assert.rejects(imp.adapter.prepareImport(raw, request(), folder())); assert.equal(calls, 0); noFactories(imp);
  });
  await test('C15 unavailable authority and wrongly bound account/device never become a duplicate', async () => {
    const f = await fixture(); f.home.setAvailable(false);
    assert.equal((await f.adapter.detectCrossDeviceDuplicate(f.payload)).kind, 'AuthorityUnavailable'); await assert.rejects(f.prepare()); noFactories(f);
    const absent = importer(null); assert.equal((await absent.adapter.detectCrossDeviceDuplicate(f.payload)).kind, 'AuthorityUnavailable');
    const boundWrong = importer(f.a); assert.equal((await boundWrong.adapter.detectCrossDeviceDuplicate(f.payload)).kind, 'AuthorityUnavailable');
  });
  await test('C16 released/future ownership dispatch rejects copy; c never invents Migrated evidence', async () => {
    const f = await fixture(), original = clone(await f.b.readRegistry());
    for (const kind of ['Released', 'Future']) {
      const next = clone(original); next.registryRevision = 2; next.records[0].homeRevision = 2;
      if (kind === 'Released') { next.records[0].homeState = 'Released'; next.records[0].homeDeviceId = null; }
      const port = { ...f.b, verifyTransfer: async () => f.proof, readRegistry: async () => next };
      const imp = importer(port), result = await imp.adapter.detectCrossDeviceDuplicate(f.payload);
      assert.equal(result.kind, kind === 'Released' ? 'Released' : 'UnsupportedBoundary');
      await assert.rejects(imp.adapter.prepareImport(f.payload, request(), folder())); noFactories(imp);
    }
  });
  await test('C17 no CopyPermission refuses as 档案损坏 before authority/UUID allocation and leaves input intact', async () => {
    const f = await fixture({ permission: false }), before = JSON.stringify(f.payload), beforeDirectory = JSON.stringify(folder());
    let calls = 0; f.bindings.authority = { ...f.b, verifyTransfer: async () => { calls++; throw Error('must not query'); } };
    await assert.rejects(f.prepare(), /档案损坏/); noFactories(f); assert.equal(calls, 0);
    assert.equal(JSON.stringify(f.payload), before); assert.equal(JSON.stringify(folder()), beforeDirectory);
  });
  await test('C18 permission account mismatch or inconsistent FirstWorldCleared/CopyPermission is rejected', async () => {
    for (const value of [{ accountId: 'another-account', FirstWorldCleared: true, CopyPermission: true },
      { accountId, FirstWorldCleared: false, CopyPermission: true }, { accountId, FirstWorldCleared: true, CopyPermission: 'true' }]) {
      const f = await fixture({ reader: { getMilestoneSnapshot: () => value } }); await assert.rejects(f.prepare(), /投影无效/); noFactories(f);
    }
  });
  await test('C19 independent remote adapter needs only receiver directory, never local source directory/lease/read', async () => {
    const f = await fixture(), directory = folder(); assert.equal(directory.records.some(r => r.worldId === sourceWorldId), false);
    const prepared = await f.prepare(f.payload, request(), directory);
    assert.equal(prepared.targetWorldId, targetWorldId); assert.deepEqual(f.counts, { world: 1, transaction: 1, registration: 1, time: 1 });
    assert.equal(isValidatedWorldStateSnapshot(prepared.targetState), true); frozenTree(prepared);
  });
  await test('C20 new UUID and seven carrier rekeys preserve exact nonidentity values and original FormatTime', async () => {
    const f = await fixture(), plan = await f.prepare(), target = plan.targetState;
    assert.match(target.worldId, /^world-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(target.worldId, sourceWorldId); assert.equal(target.revision, 0); assert.equal(target.capturedAt, epochMs + 2000);
    assert.deepEqual(normalizedSections(target), normalizedSections(f.source));
    assert.equal(target.sections.Ledger.control.entry.entryId, JSON.stringify([accountId, targetWorldId, h.content.protagonistCharacterId, 'SphereCrossing']));
    assert.deepEqual(target.sections.FormatTime, f.source.sections.FormatTime); assert.equal(plan.targetRecord.createdAt, epochMs + 2000);
    assert.equal(plan.targetRecord.title, request().title); assert.equal(plan.targetRecord.template, 'EmptyWorld');
  });
  await test('C21 source payload/sections are unchanged and account facts never become transfer or target fields', async () => {
    const f = await fixture(), before = JSON.stringify(f.source), payloadBytes = JSON.stringify(f.payload), plan = await f.prepare();
    assert.equal(JSON.stringify(f.source), before); assert.equal(JSON.stringify(f.payload), payloadBytes);
    for (const name of ['CopyPermission', 'FirstWorldCleared', 'WorldClearRecord', 'RouteSignature']) {
      assert.equal(Object.hasOwn(plan.targetState, name), false); assert.equal(Object.hasOwn(plan.targetState.sections, name), false); assert.equal(Object.hasOwn(plan.payload, name), false);
    }
  });
  await test('C22 actual inherited World session suppresses account clear writes and repeated premiere intents', async () => {
    const f = await fixture(), plan = await f.prepare(); let commits = 0, ledgerWrites = 0;
    const world = new ForkWorldClearSession({ accountId, worldId: targetWorldId, worldKind: 'Primary', protagonistCharacterId: h.content.protagonistCharacterId },
      h.content, { submitFrameIntents() {}, getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready', isWorldMotionGated: () => false },
      { now: () => epochMs + 3000, readRecords: () => [], commitRecord: async () => { commits++; }, persistLedger: () => { ledgerWrites++; } },
      plan.targetState.sections.Ledger, plan.targetState.forkOrigin);
    assert.equal(world.getWorldClearSnapshot().completionStatus, 'Inherited'); assert.equal(world.getWorldClearSnapshot().record, null);
    world.submitFrameIntents([{ kind: 'EnterWorldChart' }, { kind: 'RetryWorldClear' }], 1 / 60);
    assert.equal(commits, 0); assert.equal(ledgerWrites, 0);
  });
  await test('C23 unfinished Complete source imports without manufacturing a completed account/world fact', async () => {
    const f = await fixture({ completed: false }), plan = await f.prepare();
    assert.equal(plan.targetState.forkOrigin.inheritedCompletionEventId, null); assert.equal(plan.targetState.sections.ChartSnapshot.records.length, 0);
    assert.equal(plan.targetState.sections.ChartScore.records.length, 0); assert.equal(plan.targetState.sections.Ledger.control.completionEventId, null);
  });
  await test('C24 receiver target collision and tombstone reject before transaction/time factories', async () => {
    for (const deleted of [false, true]) {
      const f = await fixture(), directory = folder(['InitialWorld', targetWorldId]);
      if (deleted) directory.records[1].deletedAt = epochMs;
      await assert.rejects(f.prepare(f.payload, request(), directory), /已存在|墓碑/);
      assert.deepEqual(f.counts, { world: 1, transaction: 0, registration: 0, time: 0 });
    }
  });
  await test('C25 strict request, directory identity and malformed UUID/transaction/time refuse preparation', async () => {
    const f = await fixture(); for (const input of [{ ...request(), accountId }, { ...request(), title: ' bad ' }, { ...request(), schemaVersion: 2 }]) await assert.rejects(f.prepare(f.payload, input));
    await assert.rejects(f.prepare(f.payload, request(), folder(['InitialWorld'], 'wrong-account'))); noFactories(f);
    for (const options of [{ targetWorldId: 'world-not-a-uuid' }, { transactionId: 'fork-old-transaction' }, { time: epochMs - 1000 }]) {
      const bad = await fixture(options); await assert.rejects(bad.prepare());
    }
  });
  await test('C26 serialized plan is independently revalidated; changed score/FormatTime/provenance cannot enter journal', async () => {
    const f = await fixture(), plan = await f.prepare(); assert.deepEqual(clone(codec.parsePlan(clone(plan))), clone(plan));
    for (const mutate of [p => { p.targetState.sections.FormatTime.epochMs++; }, p => { p.targetState.sections.ChartScore.records[0].completedPlayCount++; },
      p => { p.targetState.forkOrigin.sourceRevision++; }, p => { p.targetRecord.createdAt++; }, p => { p.deviceId = aContext.deviceId; }]) {
      const bad = clone(plan); mutate(bad); assert.throws(() => codec.parsePlan(bad));
    }
  });
  await test('C27 journal exact phases enforce reply identity, one pending transaction and unique target/registration IDs', async () => {
    const f = await fixture(), plan = await f.prepare(), reply = await f.b.registerWorldHome({ schemaVersion: 1, worldId: targetWorldId, registrationId: plan.registrationId });
    const journal = { schemaVersion: 1, kind: 'CrossDeviceImportJournal', ...bContext, entries: [{ phase: 'Prepared', plan, homeReply: null }] };
    frozenTree(codec.parseJournal(journal));
    for (const phase of ['HomeRegistered', 'Published']) assert.equal(codec.parseJournal({ ...journal, entries: [{ phase, plan, homeReply: reply }] }).entries[0].phase, phase);
    const malformed = [ { ...journal, deviceId: aContext.deviceId }, { ...journal, entries: [{ phase: 'Prepared', plan, homeReply: reply }] },
      { ...journal, entries: [{ phase: 'Published', plan, homeReply: null }] }, { ...journal, entries: [{ phase: 'Deleted', plan, homeReply: null }] },
      { ...journal, entries: [{ phase: 'Prepared', plan, homeReply: null }, { phase: 'Prepared', plan, homeReply: null }] } ];
    malformed.forEach(value => assert.throws(() => codec.parseJournal(value)));
  });
  await test('C28 target registration is idempotent and homes B without mutating source home A', async () => {
    const f = await fixture(), plan = await f.prepare(), req = { schemaVersion: 1, worldId: targetWorldId, registrationId: plan.registrationId };
    const first = await f.b.registerWorldHome(req), replay = await f.b.registerWorldHome(req), snapshot = await f.b.readRegistry();
    assert.equal(first.kind, 'Registered'); assert.equal(replay.kind, 'Registered'); assert.deepEqual(first.record, replay.record);
    assert.equal(snapshot.registryRevision, 2); assert.equal(snapshot.records.find(r => r.worldId === sourceWorldId).homeDeviceId, aContext.deviceId);
    assert.equal(snapshot.records.find(r => r.worldId === targetWorldId).homeDeviceId, bContext.deviceId);
    assert.equal((await f.a.registerWorldHome({ ...req, registrationId: 'other-device-attempt' })).kind, 'HomeConflict');
  });
}
async function run() {
  await domain();
  if (fs.existsSync(path.join(h.h.root, 'src/presentation/CrossDeviceImportStorage.ts'))) {
    const storageTests = require('./storage-contract-tests.cjs'); await storageTests({ test, fixture, codec, request, importer, wrapper });
  } else {
    cases.push({ name: 'Storage production module prerequisite', result: 'FAIL', category: 'ContractAdapter', error: 'CrossDeviceImportStorage.ts has not been delivered' });
  }
  await test('E01 production source hashes remain identical across loaded-contract verification', () => assert.deepEqual(sourceHashes(), sourcesBefore));
  const report = { schemaVersion: 1, evidenceKind: 'ContractTest', adapterMode: 'ContractAdapter', capturedAt: new Date().toISOString(),
    policy: 'Controlled clocks, identity bindings, storage faults and locks. Real published content/ChartPremiere fixture, production codecs/ownership adapter/import transaction. Not Creator production acceptance, physical-device authentication, full FileCarry or real external services.',
    sources: sourcesBefore, sourcesUnchanged: JSON.stringify(sourceHashes()) === JSON.stringify(sourcesBefore),
    tests: cases, passed: cases.filter(c => c.result === 'PASS').length, failed: cases.filter(c => c.result === 'FAIL').length };
  report.pass = report.failed === 0; fs.writeFileSync(path.join(__dirname, 'contract-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, passed: report.passed, failed: report.failed }));
  cases.filter(c => c.result === 'FAIL').forEach(c => console.error(c.name + '\n' + (c.stack || c.error)));
  process.exitCode = report.pass ? 0 : 1;
}
module.exports = { test, fixture, codec, request, importer, wrapper };
if (require.main === module) run().catch(error => { console.error(error.stack); process.exitCode = 1; });
