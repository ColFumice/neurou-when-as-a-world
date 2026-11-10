'use strict';
const assert = require('node:assert/strict');
const h = require('./contract-test-helpers.cjs');
const { load, clone, accountId, sourceWorldId, targetWorldId, otherWorldId, transactionId, aContext, bContext,
  transferComplete: complete, folder, validateFolder, stateKey, folderKey, journalKey, accountKeys, ExclusiveLock } = h;
const { CrossDeviceImportStorage } = load('src/presentation/CrossDeviceImportStorage.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');

module.exports = async ({ test, fixture, codec, request, importer, wrapper }) => {
  async function storageFixture(options = {}) {
    const remote = options.remote || await fixture(), plan = options.plan || await remote.prepare();
    const memory = options.memory || new Map([[folderKey, JSON.stringify(folder())], ...accountKeys.map((key, i) => [key, JSON.stringify({ fixtureAccountFact: i, accountId })])]);
    const preserved = new Map(accountKeys.map(key => [key, memory.get(key)]));
    const sourceBytes = JSON.stringify(remote.source), payloadBytes = JSON.stringify(remote.payload);
    const operations = [], prefixes = [], registrationIds = [], checks = { targetWrites: 0, targetChecks: 0, sourceChecks: 0 };
    const locks = options.locks === undefined ? new ExclusiveLock() : options.locks;
    const coreLocks = locks || new ExclusiveLock(), reservations = new Set(); let fault = {};
    const adapter = { getItem: key => memory.get(key) ?? null, setItem(key, value) {
      fault.beforeSet?.(key, value); memory.set(key, value); operations.push({ kind: 'set', key });
      prefixes.push({ key, memory: new Map(memory) }); fault.afterSet?.(key, value);
    } };
    const core = new WorldCoreStateStorage(adapter, coreLocks, (raw, account, world) => complete(raw, account, world),
      (account, world) => reservations.has(world) || validateFolder(JSON.parse(memory.get(folderKey)), account).records.some(r => r.worldId === world && r.deletedAt === null));
    const port = { ...remote.b, registerWorldHome: async req => {
      registrationIds.push(req.registrationId); fault.beforeRegister?.(req);
      const response = await remote.b.registerWorldHome(req); await fault.afterRegister?.(response); return response;
    }, readRegistry: async () => { const value = await remote.b.readRegistry(); return fault.registry ? fault.registry(clone(value)) : value; } };
    const bindings = { context: bContext, authority: port, validatePlan: raw => codec.parsePlan(raw), validateJournal: raw => codec.parseJournal(raw), validateFolder,
      parseRegistrationReply: (raw, context, req) => codec.home.parseRegistrationReply(raw, context, req),
      parseRegistry: (raw, account) => codec.home.parseSnapshot(raw, account),
      assertTargetLease(value) { checks.targetChecks++; if (!core.hasWorldLease(accountId, value.targetWorldId)) throw Error('real target lease missing'); },
      writeTarget(state) { checks.targetWrites++; reservations.add(state.worldId); try { core.saveCoreState(state, null); } finally { reservations.delete(state.worldId); } },
      readTarget: (account, world) => core.readCoreState(account, world), validateCurrentTarget: complete,
      verifyAuthoritySource: async value => { checks.sourceChecks++; await remote.adapter.verifyAuthoritySource(value.payload); } };
    const storage = new CrossDeviceImportStorage(adapter, locks, bindings);
    const f = { remote, plan, memory, preserved, sourceBytes, payloadBytes, operations, prefixes, registrationIds, checks, locks, core, adapter, bindings, storage,
      faults(value = {}) { fault = value; },
      protect() { for (const [key, value] of preserved) assert.equal(memory.get(key), value, 'account fact bytes unchanged: ' + key);
        assert.equal(JSON.stringify(remote.source), sourceBytes); assert.equal(JSON.stringify(remote.payload), payloadBytes); },
      async locked(fn, lease = true) {
        return storage.withImportLock(accountId, async () => {
          let acquired = null; try { if (lease) acquired = await core.acquireWorldLease(accountId, plan.targetWorldId); return await fn(); }
          finally { acquired?.release(); }
        });
      },
      commit: () => f.locked(async () => { storage.prepare(plan); return storage.registerAndPublish(plan); }),
      recover: (target = plan.targetWorldId) => f.locked(() => storage.recover(accountId, target)),
      async open(world = targetWorldId) {
        const lease = await core.acquireWorldLease(accountId, world);
        try { return await storage.assertCanOpen(accountId, world); } finally { lease.release(); }
      },
    };
    return f;
  }
  async function published(f) {
    assert.equal(f.storage.readJournal(accountId).entries[0].phase, 'Published');
    const index = validateFolder(JSON.parse(f.memory.get(folderKey)), accountId);
    assert.equal(index.records.filter(r => r.worldId === targetWorldId).length, 1);
    assert.deepEqual(clone(complete(JSON.parse(f.memory.get(stateKey(targetWorldId))), accountId, targetWorldId)), clone(f.plan.targetState));
    const snapshot = await f.remote.b.readRegistry();
    assert.equal(snapshot.records.find(r => r.worldId === targetWorldId).homeDeviceId, bContext.deviceId);
    assert.equal(snapshot.records.find(r => r.worldId === sourceWorldId).homeDeviceId, aContext.deviceId);
    await f.open(); f.protect();
  }
  await test('S01 target lease plus import→target→directory lock publishes service-first, retains Published receipt and all seven Core', async () => {
    const f = await storageFixture(), result = await f.commit(); assert.equal(result.kind, 'Published');
    assert.equal(result.mode, 'ContractAdapter'); assert.equal(result.targetWorldId, targetWorldId); await published(f);
    const names = f.locks.calls; assert.deepEqual(names.slice(0, 3), [
      'neurou-cross-device-import:' + encodeURIComponent(accountId),
      'neurou-world-state:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(targetWorldId),
      'neurou-world-folder:' + encodeURIComponent(accountId)]);
    assert.equal(names.some(name => name.endsWith(':' + encodeURIComponent(sourceWorldId))), false);
    assert.deepEqual(f.operations.map(o => o.key), [journalKey, journalKey, stateKey(targetWorldId), folderKey, journalKey]);
    assert.equal(f.memory.has('neurou-world-fork-journal-v1:' + encodeURIComponent(accountId)), false);
  });
  await test('S02 unprepared plan, missing import lock and missing true target lease never register or write', async () => {
    const f = await storageFixture(); assert.throws(() => f.storage.prepare(f.plan), /导入.*锁/);
    await assert.rejects(f.storage.registerAndPublish(f.plan), /导入.*锁/);
    await assert.rejects(f.locked(() => f.storage.prepare(f.plan), false), /real target lease/);
    await assert.rejects(f.locked(() => f.storage.registerAndPublish(f.plan)), /持久准备/);
    assert.equal(f.operations.length, 0); assert.equal(f.registrationIds.length, 0); f.protect();
  });
  await test('S03 absent Web Locks explicitly refuses without journal, authority registration or publication', async () => {
    const f = await storageFixture({ locks: null }); await assert.rejects(f.commit(), /没有导入独占锁/);
    assert.equal(f.operations.length, 0); assert.equal(f.registrationIds.length, 0); f.protect();
  });
  await test('S04 Prepared journal write failure has no service/target/directory side effect and retries same plan', async () => {
    const f = await storageFixture(), before = f.memory.get(folderKey); f.faults({ beforeSet(key) { if (key === journalKey) throw Error('prepared quota'); } });
    await assert.rejects(f.commit(), /prepared quota/); assert.equal(f.memory.has(journalKey), false); assert.equal(f.registrationIds.length, 0);
    assert.equal(f.memory.has(stateKey(targetWorldId)), false); assert.equal(f.memory.get(folderKey), before);
    f.faults(); assert.equal((await f.commit()).kind, 'Published'); await published(f);
  });
  await test('S05 service unavailable after durable Prepared keeps journal, does not append directory, recovery reuses IDs', async () => {
    const f = await storageFixture(); f.remote.home.setAvailable(false); const result = await f.commit();
    assert.equal(result.kind, 'Pending'); assert.equal(f.storage.readPending(accountId).phase, 'Prepared');
    assert.equal(f.memory.has(stateKey(targetWorldId)), false); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 1);
    f.remote.home.setAvailable(true); assert.equal((await f.recover()).kind, 'Published'); await published(f);
    assert.deepEqual(new Set(f.registrationIds), new Set([f.plan.registrationId]));
  });
  await test('S06 service accepted but response lost: Prepared replay makes one target home and publishes once', async () => {
    const f = await storageFixture(); f.faults({ afterRegister() { throw Error('response lost'); } });
    assert.equal((await f.commit()).kind, 'Pending'); assert.equal(f.storage.readPending(accountId).phase, 'Prepared');
    assert.equal((await f.remote.b.readRegistry()).registryRevision, 2); assert.equal(f.memory.has(stateKey(targetWorldId)), false);
    f.faults(); assert.equal((await f.recover()).kind, 'Published'); assert.equal((await f.remote.b.readRegistry()).registryRevision, 2); await published(f);
    assert.deepEqual(f.registrationIds, [f.plan.registrationId, f.plan.registrationId]);
  });
  await test('S07 service success then HomeRegistered journal failure preserves Prepared for idempotent retry', async () => {
    const f = await storageFixture(); f.faults({ beforeSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'HomeRegistered') throw Error('home journal quota'); } });
    const result = await f.commit(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /home journal quota/);
    assert.equal(f.storage.readPending(accountId).phase, 'Prepared'); assert.equal((await f.remote.b.readRegistry()).registryRevision, 2);
    assert.equal(f.memory.has(stateKey(targetWorldId)), false); f.faults(); assert.equal((await f.recover()).kind, 'Published'); await published(f);
  });
  await test('S08 service target HomeConflict never overwrites winner or locally publishes, journal remains diagnostic', async () => {
    const f = await storageFixture(); await f.remote.a.registerWorldHome({ schemaVersion: 1, worldId: targetWorldId, registrationId: 'target-winner-A' });
    const result = await f.commit(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /归属冲突/);
    assert.equal(f.storage.readPending(accountId).phase, 'Prepared'); assert.equal(f.memory.has(stateKey(targetWorldId)), false);
    assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 1);
    assert.equal((await f.remote.b.readRegistry()).records.find(r => r.worldId === targetWorldId).homeDeviceId, aContext.deviceId); f.protect();
  });
  await test('S09 Core write failure after service success retains HomeRegistered; retry writes target once successfully', async () => {
    const f = await storageFixture(); f.faults({ beforeSet(key) { if (key === stateKey(targetWorldId)) throw Error('core quota'); } });
    assert.equal((await f.commit()).kind, 'Pending'); assert.equal(f.storage.readPending(accountId).phase, 'HomeRegistered');
    assert.equal(f.memory.has(stateKey(targetWorldId)), false); f.faults(); assert.equal((await f.recover()).kind, 'Published'); await published(f);
  });
  await test('S10 service success/local directory failure retains exact staged Core, never deletes it, recovery appends once', async () => {
    const f = await storageFixture(), oldFolder = f.memory.get(folderKey); f.faults({ beforeSet(key) { if (key === folderKey) throw Error('directory quota'); } });
    assert.equal((await f.commit()).kind, 'Pending'); assert.equal(f.storage.readPending(accountId).phase, 'HomeRegistered');
    assert.equal(f.memory.get(folderKey), oldFolder); const staged = f.memory.get(stateKey(targetWorldId)); assert.equal(typeof staged, 'string');
    await assert.rejects(f.open(), /拒绝打开/);
    f.faults(); assert.equal((await f.recover()).kind, 'Published'); assert.equal(f.memory.get(stateKey(targetWorldId)), staged); await published(f);
    assert.equal(f.checks.targetWrites, 1);
  });
  await test('S11 adapter throws after atomic Core write: durable exact target remains recoverable', async () => {
    const f = await storageFixture(); f.faults({ afterSet(key) { if (key === stateKey(targetWorldId)) throw Error('post-core interruption'); } });
    assert.equal((await f.commit()).kind, 'Pending'); assert(f.memory.has(stateKey(targetWorldId)));
    f.faults(); assert.equal((await f.recover()).kind, 'Published'); assert.equal(f.checks.targetWrites, 1); await published(f);
  });
  await test('S12 adapter throws after atomic directory append: readback recognizes sole local publication point', async () => {
    const f = await storageFixture(); f.faults({ afterSet(key) { if (key === folderKey) throw Error('post-directory interruption'); } });
    const result = await f.commit(); assert.equal(result.kind, 'Published'); await published(f);
    assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 2);
  });
  await test('S13 directory published but Published receipt write fails: deny open until reconciliation, never remove world', async () => {
    const f = await storageFixture(); f.faults({ beforeSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'Published') throw Error('receipt quota'); } });
    assert.equal((await f.commit()).kind, 'Pending'); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 2);
    const bytes = f.memory.get(stateKey(targetWorldId)), directory = f.memory.get(folderKey);
    await assert.rejects(f.open(), /拒绝打开/);
    f.faults(); assert.equal((await f.recover()).kind, 'Published'); assert.equal(f.memory.get(stateKey(targetWorldId)), bytes); assert.equal(f.memory.get(folderKey), directory); await published(f);
  });
  await test('S14 adapter throws after atomic Published receipt: committed result remains Published', async () => {
    const f = await storageFixture(); f.faults({ afterSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'Published') throw Error('post-receipt interruption'); } });
    assert.equal((await f.commit()).kind, 'Published'); await published(f);
  });
  await test('S15 all five durable write prefixes survive fresh storage process recovery with same target, registration and content', async () => {
    const f = await storageFixture(); assert.equal((await f.commit()).kind, 'Published');
    assert.equal(f.prefixes.length, 5);
    for (const prefix of f.prefixes) {
      const restarted = await storageFixture({ remote: f.remote, plan: f.plan, memory: new Map(prefix.memory) });
      assert.equal((await restarted.recover()).kind, 'Published'); await published(restarted);
      assert.deepEqual(restarted.registrationIds, [f.plan.registrationId]);
      assert.equal(JSON.parse(restarted.memory.get(folderKey)).records.length, 2);
    }
  });
  await test('S16 Published world with currently unavailable authority cannot open; data remains for online retry', async () => {
    const f = await storageFixture(); await f.commit(); const before = new Map(f.memory); f.remote.home.setAvailable(false);
    await assert.rejects(f.open()); const result = await f.recover(); assert.equal(result.kind, 'Pending');
    assert.deepEqual([...f.memory], [...before]); f.remote.home.setAvailable(true); assert.equal((await f.recover()).kind, 'Published'); await published(f);
  });
  await test('S17 local published/service missing denies opening; re-register same ID reconciles without deleting or republishing Core', async () => {
    const f = await storageFixture(); await f.commit(); const bytes = f.memory.get(stateKey(targetWorldId)), directory = f.memory.get(folderKey);
    const resetHome = h.homeAuthority(), resetAuthority = wrapper(resetHome), resetA = resetAuthority.bindDevice(aContext), resetB = resetAuthority.bindDevice(bContext);
    await resetA.registerWorldHome({ schemaVersion: 1, worldId: sourceWorldId, registrationId: 'source-registration-1' }); await resetA.publishTransfer(f.remote.payload);
    f.remote.b = resetB; f.remote.bindings.authority = resetB; f.bindings.authority = resetB;
    await assert.rejects(f.open(), /缺失|回退|冲突/);
    assert.equal(f.memory.get(stateKey(targetWorldId)), bytes); assert.equal(f.memory.get(folderKey), directory);
    assert.equal((await f.recover()).kind, 'Published'); assert.equal(f.memory.get(stateKey(targetWorldId)), bytes); assert.equal(f.memory.get(folderKey), directory);
    await f.open(); f.protect();
  });
  await test('S18 local published/service conflict never opens and reconciliation preserves published world', async () => {
    const f = await storageFixture(); await f.commit(); const before = new Map(f.memory);
    f.faults({ registry(value) { const target = value.records.find(r => r.worldId === targetWorldId); target.homeDeviceId = aContext.deviceId; return value; } });
    await assert.rejects(f.open(), /冲突|对账/);
    assert.equal((await f.recover()).kind, 'Pending'); assert.deepEqual([...f.memory], [...before]); f.protect();
  });
  await test('S19 corrupted/mismatched-device journals retain raw bytes and block reads/preparation/recovery', async () => {
    const f = await storageFixture(); await f.locked(() => f.storage.prepare(f.plan)); const valid = f.memory.get(journalKey);
    for (const bad of ['{not-json', JSON.stringify({ ...JSON.parse(valid), deviceId: aContext.deviceId }), JSON.stringify({ ...JSON.parse(valid), accountId: 'another-account' })]) {
      f.memory.set(journalKey, bad); assert.throws(() => f.storage.readJournal(accountId)); await assert.rejects(f.recover()); assert.equal(f.memory.get(journalKey), bad);
    }
    f.memory.set(journalKey, valid); assert.equal((await f.recover()).kind, 'Published'); await published(f);
  });
  await test('S20 unexpected staged Core mutation blocks retry without overwrite; source/account data remains', async () => {
    const f = await storageFixture(); f.faults({ beforeSet(key) { if (key === folderKey) throw Error('directory blocked'); } }); await f.commit(); f.faults();
    const changed = JSON.parse(f.memory.get(stateKey(targetWorldId))); changed.revision++; changed.capturedAt++; f.memory.set(stateKey(targetWorldId), JSON.stringify(changed));
    const bytes = f.memory.get(stateKey(targetWorldId)); assert.equal((await f.recover()).kind, 'Pending'); assert.equal(f.memory.get(stateKey(targetWorldId)), bytes);
    assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 1); f.protect();
  });
  await test('S21 published receipt allows legitimate later target revision, while immutable provenance and FormatTime guard opening', async () => {
    const f = await storageFixture(); await f.commit(); const changed = JSON.parse(f.memory.get(stateKey(targetWorldId))); changed.revision++; changed.capturedAt++;
    f.memory.set(stateKey(targetWorldId), JSON.stringify(changed)); await f.open();
    for (const mutate of [state => { state.sections.FormatTime.epochMs++; }, state => { state.forkOrigin.sourceRevision++; }]) {
      const bad = clone(changed); mutate(bad); f.memory.set(stateKey(targetWorldId), JSON.stringify(bad)); await assert.rejects(f.open());
      assert.equal(f.memory.get(stateKey(targetWorldId)), JSON.stringify(bad));
    }
  });
  await test('S22 tombstoned published target stays deleted; recovery cannot recreate it or erase retained Core', async () => {
    const f = await storageFixture(); await f.commit(); const directory = JSON.parse(f.memory.get(folderKey)); directory.records[1].deletedAt = h.epochMs + 4000;
    f.memory.set(folderKey, JSON.stringify(directory)); const bytes = f.memory.get(stateKey(targetWorldId));
    await assert.rejects(f.open(), /冲突|删除/); assert.equal((await f.recover()).kind, 'Pending');
    assert.equal(f.memory.get(folderKey), JSON.stringify(directory)); assert.equal(f.memory.get(stateKey(targetWorldId)), bytes); f.protect();
  });
  await test('S23 pending/Published replay does not duplicate targets and conflicting transaction plans are rejected', async () => {
    const f = await storageFixture(); await f.locked(() => { f.storage.prepare(f.plan); f.storage.prepare(f.plan); });
    assert.equal(f.storage.readJournal(accountId).entries.length, 1);
    const changed = clone(f.plan); changed.targetRecord.title = 'changed metadata';
    await assert.rejects(f.locked(() => f.storage.prepare(changed)), /不同计划/);
    await f.recover(); assert.equal((await f.commit()).kind, 'Published'); assert.equal(f.storage.readJournal(accountId).entries.length, 1); await published(f);
  });
  await test('S24 only one pending import per bound account; a different UUID/registration cannot bypass the journal', async () => {
    const f = await storageFixture(); await f.locked(() => f.storage.prepare(f.plan));
    const second = importer(f.remote.b, { targetWorldId: otherWorldId, transactionId: 'import-20000000-0000-4000-8000-000000000099', registrationId: 'registration-second' });
    const plan = await second.adapter.prepareImport(f.remote.payload, request(), folder());
    await assert.rejects(f.storage.withImportLock(accountId, async () => {
      const lease = await f.core.acquireWorldLease(accountId, otherWorldId); try { f.storage.prepare(plan); } finally { lease.release(); }
    }), /待恢复/);
    assert.equal(f.storage.readJournal(accountId).entries.length, 1); f.protect();
  });
  await test('S25 account isolation refuses cross-account key reads or locks before touching any data', async () => {
    const f = await storageFixture(), before = new Map(f.memory);
    assert.throws(() => f.storage.readJournal('other-account'), /绑定账号/); await assert.rejects(f.storage.withImportLock('other-account', () => undefined), /绑定账号/);
    await assert.rejects(f.storage.assertCanOpen('other-account', targetWorldId), /绑定账号/); assert.deepEqual([...f.memory], [...before]);
  });
  await test('S26 import lock is nonreentrant and held across service; directory lock is acquired only after service resolves', async () => {
    const f = await storageFixture(); let release, reached;
    const waiting = new Promise(resolve => { reached = resolve; }), barrier = new Promise(resolve => { release = resolve; });
    f.faults({ async afterRegister() { assert(f.locks.active.has('neurou-cross-device-import:' + encodeURIComponent(accountId)));
      assert(f.locks.active.has('neurou-world-state:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(targetWorldId)));
      assert.equal(f.locks.active.has('neurou-world-folder:' + encodeURIComponent(accountId)), false); reached(); await barrier; } });
    const result = f.commit(); await waiting;
    await assert.rejects(f.storage.withImportLock(accountId, () => undefined), /不可重入/); release(); assert.equal((await result).kind, 'Published'); await published(f);
  });
  await test('S27 Promise target-write callback cannot masquerade as durable synchronous publication', async () => {
    const f = await storageFixture(); f.bindings.writeTarget = async () => undefined;
    const result = await f.commit(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /必须同步/);
    assert.equal(f.memory.has(stateKey(targetWorldId)), false); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 1); f.protect();
  });
  await test('S28 missing or mismatched Published receipt never authorizes another local world', async () => {
    const f = await storageFixture(); await assert.rejects(f.open(), /拒绝打开/);
    await f.commit(); await assert.rejects(f.open(otherWorldId), /拒绝打开/);
    const before = f.memory.get(journalKey); const changed = JSON.parse(before); changed.entries[0].homeReply.deviceId = aContext.deviceId;
    f.memory.set(journalKey, JSON.stringify(changed)); await assert.rejects(f.open()); assert.equal(f.memory.get(journalKey), JSON.stringify(changed));
  });
  await test('S29 another valid revision-zero Core cannot replace Published plan; genuine revision-one recalled state may progress', async () => {
    const f = await storageFixture(); await f.commit();
    const { RecallCountSession } = load('src/director/RecallCountSession.ts');
    const target = clone(f.plan.targetState), recalls = new RecallCountSession({ accountId, worldId: targetWorldId,
      protagonistCharacterId: h.content.protagonistCharacterId, regularChartId: h.regular.chartId },
      { readLedger: () => target.sections.Ledger, persistSnapshot() {}, now: () => h.epochMs + 3000 }, target.sections.RecallCount);
    const eventId = target.sections.Ledger.characters[0].events.find(event => event.eventId.startsWith('WORLD_NARRATIVE_CHOICE:')).eventId;
    recalls.recall(eventId); target.sections.RecallCount = clone(recalls.getSnapshot());
    assert.equal(complete(target, accountId, targetWorldId).revision, 0, 'replacement is independently valid Complete');
    f.memory.set(stateKey(targetWorldId), JSON.stringify(target));
    await assert.rejects(f.open(), /初始|计划|不一致|版本零/); assert.equal(f.memory.get(stateKey(targetWorldId)), JSON.stringify(target));
    target.revision = 1; target.capturedAt++;
    f.memory.set(stateKey(targetWorldId), JSON.stringify(target)); await f.open();
    assert.equal(complete(JSON.parse(f.memory.get(stateKey(targetWorldId))), accountId, targetWorldId).sections.RecallCount.records[0].count, 1);
    f.protect();
  });
  await test('S30 Prepared source becoming Released or future ownership refuses target registration, despite historical transfer proof', async () => {
    for (const kind of ['Released', 'Future']) {
      const f = await storageFixture(); await f.locked(() => f.storage.prepare(f.plan));
      const original = clone(await f.remote.b.readRegistry()), next = clone(original); next.registryRevision = 2; next.records[0].homeRevision = 2;
      if (kind === 'Released') { next.records[0].homeState = 'Released'; next.records[0].homeDeviceId = null; }
      f.remote.bindings.authority = { ...f.remote.b, readRegistry: async () => next };
      assert.deepEqual(await f.remote.b.verifyTransfer(f.remote.payload), f.remote.proof, 'historical proof remains valid');
      const result = await f.recover(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /Released|UnsupportedBoundary|跨设备复制/);
      assert.equal(f.registrationIds.length, 0); assert.equal(f.memory.has(stateKey(targetWorldId)), false);
      assert.equal(f.storage.readPending(accountId).phase, 'Prepared'); assert.equal(f.memory.get(folderKey), JSON.stringify(folder())); f.protect();
    }
  });
};
