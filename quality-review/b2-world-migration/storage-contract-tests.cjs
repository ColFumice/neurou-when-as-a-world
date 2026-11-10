'use strict';
// Controlled ContractAdapter transaction faults; never injected into Creator acceptance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('../b2-cross-device-core/contract-test-helpers.cjs');
const { load, clone, accountId, sourceWorldId: worldId, otherWorldId, aContext, bContext,
  epochMs, folder, validateFolder, transferComplete: complete, ExclusiveLock } = h;
const { WorldMigrationCodec } = load('src/director/WorldMigration.ts');
const { WorldMigrationStorage } = load('src/presentation/WorldMigrationStorage.ts');
const { WorldMigrationContractAdapter } = load('src/presentation/WorldMigrationContractAdapter.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { chartContentDigest } = load('src/director/ChartArchive.ts');
const codec = new WorldMigrationCodec(complete), home = codec.home;
const migrationId = 'migration-storage-contract-1';
const folderKey = 'neurou-world-folder-v1:' + encodeURIComponent(accountId);
const journalKey = 'neurou-migration-v1:' + encodeURIComponent(accountId);
const coreKey = id => 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(id);
const accountKeys = ['neurou-account-world-clears-v1:', 'neurou-account-first-world-cleared-v1:'].map(prefix => prefix + encodeURIComponent(accountId));
const results = [];
async function test(name, run) {
  try { await run(); results.push({ name, pass: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, pass: false, error: error.stack || String(error) }); console.error('FAIL ' + name + '\n' + (error.stack || error)); }
}
function adapterMap(memory, fault = () => ({}), operations = [], prefixes = []) {
  return { getItem: key => memory.get(key) ?? null, setItem(key, text) {
    fault().beforeSet?.(key, text); memory.set(key, text); operations.push({ key, text });
    prefixes.push(new Map(memory)); fault().afterSet?.(key, text);
  } };
}
async function fixture(options = {}) {
  const source = options.source || h.worldSource().state;
  const sourceFolder = folder(['InitialWorld', worldId]);
  const sourceBytes = JSON.stringify(source), sourceDirectoryBytes = JSON.stringify(sourceFolder);
  const payload = codec.parsePayload({ schemaVersion: 1, kind: 'RestrictedMigrationCore', migrationId,
    sourceDeviceId: aContext.deviceId, expectedHomeRevision: 1,
    record: sourceFolder.records.find(record => record.worldId === worldId), state: source });
  let serverNow = epochMs + 1000;
  const serviceMemory = new Map(), serviceLocks = new ExclusiveLock(), accepted = new Set();
  const serviceStorage = adapterMap(serviceMemory);
  const serviceBindings = {
    storage: serviceStorage, locks: serviceLocks, serviceNow: () => serverNow, offlineGraceMs: 3600000,
    parseContext: raw => home.parseContext(raw), parseRegistrationRequest: raw => home.parseRegistrationRequest(raw),
    parseRegistry: (raw, account) => home.parseSnapshot(raw, account),
    parseRegistrationReply: (raw, context, request) => home.parseRegistrationReply(raw, context, request),
    parseConfirmation: (raw, context) => codec.parseConfirmation(raw, context),
    parseDrainAcceptance: (raw, confirmation) => codec.parseDrainAcceptance(raw, confirmation),
    parseReleaseRequest: raw => codec.parseReleaseRequest(raw), parseClaimRequest: raw => codec.parseClaimRequest(raw),
    parsePause: (raw, account) => codec.parsePause(raw, account), parseDeviceBinding: (raw, device) => codec.parseDeviceBinding(raw, device),
    parsePayload: raw => codec.parsePayload(raw), parseReceipt: (raw, value) => codec.parseReceipt(raw, value),
    parseAdmission: (raw, context, id) => codec.parseAdmission(raw, context, id),
    verifyDrainCapability: value => accepted.has(value), digestState: chartContentDigest,
  };
  const service = new WorldMigrationContractAdapter(serviceBindings), a = service.bindDevice(aContext), b = service.bindDevice(bContext);
  await a.registerWorldHome({ schemaVersion: 1, worldId, registrationId: 'storage-home-A' });
  let capId = 0;
  function capability(context = aContext, value = payload) {
    let active = true;
    const cap = { confirmation: codec.parseConfirmation({ schemaVersion: 1, accountId,
      sourceDeviceId: context.deviceId, drainId: 'drain-storage-' + ++capId,
      directoryDigest: chartContentDigest(sourceFolder), worlds: [
        { worldId: 'InitialWorld', revision: 0, coreDigest: chartContentDigest({ fixture: 'InitialWorld' }) },
        { worldId, revision: value.state.revision, coreDigest: chartContentDigest(value.state) },
      ] }, context), assertCurrent() { if (!active) throw Error('fixture drain revoked'); },
      revoke() { active = false; accepted.delete(cap); } };
    accepted.add(cap); return cap;
  }
  const localLocks = new ExclusiveLock(), sourceMemory = new Map([[folderKey, sourceDirectoryBytes], [coreKey(worldId), sourceBytes],
    ...accountKeys.map((key, i) => [key, JSON.stringify({ fixtureAccountFact: i, accountId })])]);
  const targetMemory = options.targetMemory || new Map([[folderKey, JSON.stringify(folder())],
    ...accountKeys.map((key, i) => [key, JSON.stringify({ fixtureAccountFact: i, accountId })])]);
  let sourceFault = {}, targetFault = {}, authorityFault = {};
  const sourceOperations = [], targetOperations = [], targetPrefixes = [], claims = [], releases = [];
  const sourceAdapter = adapterMap(sourceMemory, () => sourceFault, sourceOperations), targetAdapter = adapterMap(targetMemory, () => targetFault, targetOperations, targetPrefixes);
  const targetCore = new WorldCoreStateStorage(targetAdapter, localLocks, complete);
  const aPort = { ...a, releaseMigration: async (request, value) => {
    releases.push(clone(request)); authorityFault.beforeRelease?.(request, value);
    const reply = await a.releaseMigration(request, value); authorityFault.afterRelease?.(reply); return reply;
  } };
  const bPort = { ...b, claimMigration: async request => {
    claims.push(clone(request)); authorityFault.beforeClaim?.(request);
    const reply = await b.claimMigration(request); authorityFault.afterClaim?.(reply); return reply;
  }, readAdmission: async id => { const value = await b.readAdmission(id); return authorityFault.admission ? authorityFault.admission(clone(value)) : value; },
    readMigrationPayload: async id => { const value = await b.readMigrationPayload(id); return authorityFault.payload ? authorityFault.payload(clone(value)) : value; } };
  function binding(context, port, map, core, operations) {
    return { context, authority: port, validatePayload: raw => codec.parsePayload(raw), validateJournal: raw => codec.parseJournal(raw), validateFolder,
      parseReceipt: (raw, value) => codec.parseReceipt(raw, value), parseAdmission: (raw, identity, id) => codec.parseAdmission(raw, identity, id),
      parseDrainAcceptance: (raw, confirmation) => codec.parseDrainAcceptance(raw, confirmation),
      assertTargetLease(value) { if (!core?.hasWorldLease(accountId, value.state.worldId)) throw Error('real target lease missing'); },
      writeTarget(state, expected) {
        assert.equal(expected, null); if (!core.hasWorldLease(accountId, state.worldId)) throw Error('real target lease missing at CAS write');
        const key = coreKey(state.worldId); if (map.has(key)) throw Error('Core CAS expected absent');
        const parsed = complete(state, accountId, state.worldId); operations.writeCount = (operations.writeCount || 0) + 1;
        targetAdapter.setItem(key, JSON.stringify(parsed));
      },
      readTarget: (account, id) => map.has(coreKey(id)) ? JSON.parse(map.get(coreKey(id))) : null, validateCurrentTarget: complete,
      assertAdmissionNow: id => { authorityFault.beforeAdmissionNow?.(id); service.assertAdmissionNow(context, id); },
    };
  }
  const sourceBindings = binding(aContext, aPort, sourceMemory, null, sourceOperations), targetBindings = binding(bContext, bPort, targetMemory, targetCore, targetOperations);
  const sourceStore = new WorldMigrationStorage(sourceAdapter, options.locks === undefined ? localLocks : options.locks, sourceBindings);
  const targetStore = new WorldMigrationStorage(targetAdapter, options.locks === undefined ? localLocks : options.locks, targetBindings);
  const preservedSource = new Map(sourceMemory), preservedTargetFacts = new Map(accountKeys.map(key => [key, targetMemory.get(key)]));
  const f = { source, payload, service, a, b, aPort, bPort, serverNow: () => serverNow,
    advanceServiceBy(delta) { assert(Number.isSafeInteger(delta) && delta >= 0); serverNow += delta; },
    serviceMemory, serviceBindings, sourceMemory, targetMemory, sourceOperations, targetOperations, targetPrefixes, releases, claims,
    sourceStore, targetStore, sourceBindings, targetBindings, targetCore, localLocks, capability,
    sourceFaults(value = {}) { sourceFault = value; }, targetFaults(value = {}) { targetFault = value; }, authorityFaults(value = {}) { authorityFault = value; },
    async sourceLocked(fn) { return sourceStore.withMigrationLock(accountId, fn); },
    async targetLocked(fn, lease = true) {
      return targetStore.withMigrationLock(accountId, async () => { let acquired = null;
        try { if (lease) acquired = await targetCore.acquireWorldLease(accountId, worldId); return await fn(); }
        finally { acquired?.release(); }
      });
    },
    release: cap => f.sourceLocked(async () => { sourceStore.prepareSource(payload); return sourceStore.releaseSource(migrationId, cap || capability()); }),
    sourceRecover: cap => f.sourceLocked(() => sourceStore.recover(accountId, migrationId, cap)),
    targetPrepare: () => f.targetLocked(() => targetStore.prepareTarget(payload)),
    claim: () => f.targetLocked(async () => { targetStore.prepareTarget(payload); return targetStore.claimAndPublish(migrationId); }),
    recover: () => f.targetLocked(() => targetStore.recover(accountId, migrationId)),
    async open() { const lease = await targetCore.acquireWorldLease(accountId, worldId);
      try { return await targetStore.assertCanOpen(accountId, worldId); } finally { lease.release(); } },
    async expire() { const receipt = codec.parseReceipt(await a.readMigration(migrationId), payload);
      serverNow = receipt.pause.resumeNotBeforeServerEpochMs; return codec.parseReceipt(await a.readMigration(migrationId), payload); },
    protect() {
      for (const [key, value] of preservedSource) assert.equal(sourceMemory.get(key), value, 'source bytes unchanged: ' + key);
      for (const [key, value] of preservedTargetFacts) assert.equal(targetMemory.get(key), value, 'target account facts unchanged: ' + key);
      assert.equal(JSON.stringify(source), sourceBytes); assert.equal(payload.state.worldId, worldId);
    },
  };
  return f;
}
async function finished(f) {
  assert.equal(f.targetStore.readJournal(accountId).entries.at(-1).phase, 'LocalPublished');
  assert.deepEqual(JSON.parse(f.targetMemory.get(coreKey(worldId))), clone(f.payload.state));
  assert.deepEqual(JSON.parse(f.targetMemory.get(folderKey)).records.find(record => record.worldId === worldId), clone(f.payload.record));
  assert.equal((await f.b.readRegistry()).records.find(record => record.worldId === worldId).homeDeviceId, bContext.deviceId);
  await f.open(); f.protect();
}
async function released(options) { const f = await fixture(options); assert.equal((await f.release()).kind, 'PauseActive'); assert.equal((await f.expire()).kind, 'Released'); return f; }

(async () => {
  await test('MS01 same-ID source drain→Release→hour pause→Claim→directory publication preserves arbitrary revision and all seven', async () => {
    const f = await fixture(); assert.equal((await f.release()).kind, 'PauseActive');
    assert.equal(f.sourceStore.readJournal(accountId).entries[0].phase, 'PauseActive');
    assert.equal((await f.b.readAdmission('InitialWorld')).kind, 'PauseActive');
    assert.equal((await f.claim()).kind, 'PauseActive'); assert.equal(f.claims.length, 0); assert.equal(f.targetMemory.has(coreKey(worldId)), false);
    assert.equal((await f.expire()).kind, 'Released'); assert.equal((await f.recover()).kind, 'LocalPublished'); await finished(f);
    assert.equal(f.payload.state.revision, 7); assert.deepEqual(f.claims[0], { schemaVersion: 1, migrationId, worldId, expectedHomeRevision: 2 });
    assert.equal(f.targetOperations.writeCount, 1);
    assert.deepEqual(f.targetOperations.map(value => value.key), [journalKey, journalKey, journalKey, journalKey, coreKey(worldId), folderKey, journalKey]);
    assert.equal(f.targetMemory.has('neurou-cross-device-import-v1:' + encodeURIComponent(accountId)), false);
    assert.equal(f.targetMemory.has('neurou-world-fork-journal-v1:' + encodeURIComponent(accountId)), false);
  });
  await test('MS02 coordination→target lease→directory ordering uses no remote source lease', async () => {
    const f = await released(); f.localLocks.calls.length = 0; await f.claim();
    assert.deepEqual(f.localLocks.calls.slice(0, 3), ['neurou-cross-device:' + encodeURIComponent(accountId),
      'neurou-world-state:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(worldId), 'neurou-world-folder:' + encodeURIComponent(accountId)]);
    await finished(f);
  });
  await test('MS03 missing coordinator, missing real target lease or unprepared journal makes no Claim', async () => {
    const f = await released(); assert.throws(() => f.targetStore.prepareTarget(f.payload), /协调锁/);
    await assert.rejects(f.targetLocked(() => f.targetStore.prepareTarget(f.payload), false), /real target lease/);
    await assert.rejects(f.targetLocked(() => f.targetStore.claimAndPublish(migrationId)), /持久准备/);
    assert.equal(f.claims.length, 0); assert.equal(f.targetOperations.length, 0); f.protect();
  });
  await test('MS04 unavailable Web Locks explicitly refuses both source and target with zero writes', async () => {
    const f = await fixture({ locks: null }); await assert.rejects(f.release(), /Web Locks/); await assert.rejects(f.claim(), /Web Locks/);
    assert.equal(f.sourceOperations.length, 0); assert.equal(f.targetOperations.length, 0); assert.equal(f.releases.length, 0); f.protect();
  });
  await test('MS05 source Prepared journal failure does not Release and preserves original Core/directory', async () => {
    const f = await fixture(); f.sourceFaults({ beforeSet(key) { if (key === journalKey) throw Error('source prepared quota'); } });
    await assert.rejects(f.release(), /source prepared quota/); assert.equal(f.releases.length, 0); assert.equal(f.sourceMemory.has(journalKey), false); f.protect();
    f.sourceFaults(); assert.equal((await f.release()).kind, 'PauseActive'); f.protect();
  });
  await test('MS06 Prepared source restart cannot substitute serialized confirmation for a fresh live drain', async () => {
    const f = await fixture(); await f.sourceLocked(() => f.sourceStore.prepareSource(f.payload));
    const result = await f.sourceRecover(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /重新主动排空/);
    assert.equal(f.releases.length, 0); assert.equal(await f.a.readMigration(migrationId), null);
    assert.equal((await f.sourceRecover(f.capability())).kind, 'PauseActive'); f.protect();
  });
  await test('MS07 source service unavailable keeps Prepared; revoked drain refuses; fresh capability recovers', async () => {
    const f = await fixture(), cap = f.capability(); f.service.setAvailable(false);
    assert.equal((await f.release(cap)).kind, 'Pending'); assert.equal(f.sourceStore.readPending(accountId).phase, 'Prepared');
    f.service.setAvailable(true); cap.revoke(); assert.equal((await f.sourceRecover(cap)).kind, 'Pending');
    assert.equal(await f.a.readMigration(migrationId), null); assert.equal((await f.sourceRecover(f.capability())).kind, 'PauseActive'); f.protect();
  });
  await test('MS08 Release accepted response lost retains Prepared; readMigration recovery does not require a dead drain', async () => {
    const f = await fixture(), cap = f.capability(); f.authorityFaults({ afterRelease() { throw Error('release response lost'); } });
    assert.equal((await f.release(cap)).kind, 'Pending'); cap.revoke();
    assert.equal(f.sourceStore.readPending(accountId).phase, 'Prepared'); assert.equal((await f.a.readMigration(migrationId)).kind, 'PauseActive');
    f.authorityFaults(); assert.equal((await f.sourceRecover()).kind, 'PauseActive'); assert.equal(f.releases.length, 1); f.protect();
  });
  await test('MS09 PauseActive journal quota retains Prepared; Released and Claimed source observations never touch source files', async () => {
    const f = await fixture(); f.sourceFaults({ beforeSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'PauseActive') throw Error('pause journal quota'); } });
    assert.equal((await f.release()).kind, 'Pending'); assert.equal(f.sourceStore.readPending(accountId).phase, 'Prepared');
    f.sourceFaults(); assert.equal((await f.sourceRecover()).kind, 'PauseActive'); await f.expire();
    assert.equal((await f.sourceRecover()).kind, 'Released'); await f.claim();
    assert.equal((await f.sourceRecover()).phase, 'Claimed'); assert.equal(f.sourceStore.readPending(accountId), null); f.protect();
  });
  await test('MS10 atomic Prepared write throwing afterward is recognized as durable before Release', async () => {
    const f = await fixture(); f.sourceFaults({ afterSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'Prepared') throw Error('post prepared'); } });
    assert.equal((await f.release()).kind, 'PauseActive'); assert.equal(f.releases.length, 1); f.protect();
  });
  await test('MS11 target missing authoritative transfer or tampered service payload never Claim', async () => {
    const f = await released(); await assert.rejects(f.targetStore.readAuthoritativePayload('missing migration'), /尚不存在/);
    f.authorityFaults({ payload(value) { value.state.capturedAt++; return value; } });
    const result = await f.claim(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /载荷被改变/);
    assert.equal(f.claims.length, 0); assert.equal(f.targetMemory.has(coreKey(worldId)), false); f.protect();
  });
  await test('MS12 target Prepared journal failure leaves global Released and zero Claim/Core writes', async () => {
    const f = await released(); f.targetFaults({ beforeSet(key) { if (key === journalKey) throw Error('target prepared quota'); } });
    await assert.rejects(f.claim(), /target prepared quota/); assert.equal(f.claims.length, 0); assert.equal((await f.b.readMigration(migrationId)).kind, 'Released');
    assert.equal(f.targetMemory.has(coreKey(worldId)), false); f.protect();
  });
  await test('MS13 Claim accepted response lost persists Released and retries without changing claimant or revision', async () => {
    const f = await released(); f.authorityFaults({ afterClaim() { throw Error('claim response lost'); } });
    const result = await f.claim(); assert.equal(result.kind, 'Pending'); assert.equal(f.targetStore.readPending(accountId).phase, 'Released');
    assert.equal((await f.b.readMigration(migrationId)).record.homeRevision, 3); assert.equal(f.targetMemory.has(coreKey(worldId)), false);
    f.authorityFaults(); assert.equal((await f.recover()).kind, 'LocalPublished'); assert.equal(f.claims.length, 1); await finished(f);
  });
  await test('MS14 global Claim success then Claimed journal quota retains Released and recovers service-first', async () => {
    const f = await released(); f.targetFaults({ beforeSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'Claimed') throw Error('claimed journal quota'); } });
    assert.equal((await f.claim()).kind, 'Pending'); assert.equal(f.targetStore.readPending(accountId).phase, 'Released');
    assert.equal((await f.b.readMigration(migrationId)).kind, 'Claimed'); assert.equal(f.targetMemory.has(coreKey(worldId)), false);
    f.targetFaults(); assert.equal((await f.recover()).kind, 'LocalPublished'); await finished(f);
  });
  await test('MS15 target original-revision Core write quota keeps Claimed; retry writes the same value once', async () => {
    const f = await released(); f.targetFaults({ beforeSet(key) { if (key === coreKey(worldId)) throw Error('core quota'); } });
    assert.equal((await f.claim()).kind, 'Pending'); assert.equal(f.targetStore.readPending(accountId).phase, 'Claimed');
    assert.equal(f.targetMemory.has(coreKey(worldId)), false); f.targetFaults(); assert.equal((await f.recover()).kind, 'LocalPublished'); await finished(f);
  });
  await test('MS16 atomic Core write throwing afterward is read back exactly and safely publishes', async () => {
    const f = await released(); f.targetFaults({ afterSet(key) { if (key === coreKey(worldId)) throw Error('post core'); } });
    assert.equal((await f.claim()).kind, 'LocalPublished'); assert.equal(f.targetOperations.writeCount, 1); await finished(f);
  });
  await test('MS17 service Claim succeeds/local directory fails: retain staged Core and Claimed journal, never delete', async () => {
    const f = await released(), directory = f.targetMemory.get(folderKey); f.targetFaults({ beforeSet(key) { if (key === folderKey) throw Error('directory quota'); } });
    assert.equal((await f.claim()).kind, 'Pending'); assert.equal(f.targetStore.readPending(accountId).phase, 'Claimed');
    const bytes = f.targetMemory.get(coreKey(worldId)); assert.equal(typeof bytes, 'string'); assert.equal(f.targetMemory.get(folderKey), directory);
    await assert.rejects(f.open(), /拒绝打开/); f.targetFaults(); assert.equal((await f.recover()).kind, 'LocalPublished');
    assert.equal(f.targetMemory.get(coreKey(worldId)), bytes); assert.equal(f.targetOperations.writeCount, 1); await finished(f);
  });
  await test('MS18 atomic directory append throwing afterward recognizes the sole local publication point', async () => {
    const f = await released(); f.targetFaults({ afterSet(key) { if (key === folderKey) throw Error('post directory'); } });
    assert.equal((await f.claim()).kind, 'LocalPublished'); assert.equal(JSON.parse(f.targetMemory.get(folderKey)).records.length, 2); await finished(f);
  });
  await test('MS19 directory published/LocalPublished journal quota refuses opening until reconciliation; source and target kept', async () => {
    const f = await released(); f.targetFaults({ beforeSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'LocalPublished') throw Error('published journal quota'); } });
    assert.equal((await f.claim()).kind, 'Pending'); const core = f.targetMemory.get(coreKey(worldId)), directory = f.targetMemory.get(folderKey);
    assert.equal(f.targetStore.readPending(accountId).phase, 'Claimed'); await assert.rejects(f.open(), /拒绝打开/);
    f.targetFaults(); assert.equal((await f.recover()).kind, 'LocalPublished'); assert.equal(f.targetMemory.get(coreKey(worldId)), core);
    assert.equal(f.targetMemory.get(folderKey), directory); await finished(f);
  });
  await test('MS20 atomic LocalPublished journal write throwing afterward returns committed result', async () => {
    const f = await released(); f.targetFaults({ afterSet(key, text) { if (key === journalKey && JSON.parse(text).entries[0].phase === 'LocalPublished') throw Error('post published'); } });
    assert.equal((await f.claim()).kind, 'LocalPublished'); await finished(f);
  });
  await test('MS21 every durable target write prefix recovers with a fresh storage object and same service Claim', async () => {
    const f = await released(); await f.claim(); const prefixes = f.targetPrefixes.map(memory => new Map(memory)); assert.equal(prefixes.length, 6);
    for (const memory of prefixes) {
      const adapter = adapterMap(memory), core = new WorldCoreStateStorage(adapter, f.localLocks, complete);
      const bindings = { ...f.targetBindings, assertTargetLease(value) { if (!core.hasWorldLease(accountId, value.state.worldId)) throw Error('real target lease missing'); },
        readTarget: (_account, id) => memory.has(coreKey(id)) ? JSON.parse(memory.get(coreKey(id))) : null,
        writeTarget(state, expected) { assert.equal(expected, null); assert(core.hasWorldLease(accountId, worldId)); assert(!memory.has(coreKey(worldId))); adapter.setItem(coreKey(worldId), JSON.stringify(complete(state, accountId, worldId))); } };
      const restarted = new WorldMigrationStorage(adapter, f.localLocks, bindings);
      const value = await restarted.withMigrationLock(accountId, async () => { const lease = await core.acquireWorldLease(accountId, worldId);
        try { return await restarted.recover(accountId, migrationId); } finally { lease.release(); } });
      assert.equal(value.kind, 'LocalPublished'); assert.equal(JSON.parse(memory.get(folderKey)).records.filter(record => record.worldId === worldId).length, 1);
      assert.deepEqual(JSON.parse(memory.get(coreKey(worldId))), clone(f.payload.state));
    } f.protect();
  });
  await test('MS22 fully identical existing directory/Core admits exact return without any local Core or directory rewrite', async () => {
    const f = await released(); f.targetMemory.set(folderKey, JSON.stringify(folder(['InitialWorld', worldId]))); f.targetMemory.set(coreKey(worldId), JSON.stringify(f.payload.state));
    const directory = f.targetMemory.get(folderKey), core = f.targetMemory.get(coreKey(worldId)); assert.equal((await f.claim()).kind, 'LocalPublished');
    assert.equal(f.targetMemory.get(folderKey), directory); assert.equal(f.targetMemory.get(coreKey(worldId)), core); assert.equal(f.targetOperations.writeCount || 0, 0); await finished(f);
  });
  await test('MS23 divergent Core, divergent directory or tombstone conflicts before Claim and preserves all local bytes', async () => {
    for (const collision of ['Core', 'directory', 'tombstone', 'missing Core']) {
      const f = await released(); const targetFolder = folder(['InitialWorld', worldId]); const raw = clone(f.payload.state);
      if (collision === 'Core') raw.revision++;
      if (collision === 'directory') targetFolder.records[1].title += ' changed';
      if (collision === 'tombstone') targetFolder.records[1].deletedAt = epochMs;
      f.targetMemory.set(folderKey, JSON.stringify(targetFolder)); if (collision !== 'missing Core') f.targetMemory.set(coreKey(worldId), JSON.stringify(raw));
      const before = new Map(f.targetMemory); await assert.rejects(f.claim(), /不同|墓碑|缺失 Core/);
      assert.equal(f.claims.length, 0); assert.deepEqual([...f.targetMemory], [...before]); assert.equal((await f.b.readMigration(migrationId)).kind, 'Released'); f.protect();
    }
  });
  await test('MS24 staged orphan Core exact value resumes while a different orphan never gets overwritten', async () => {
    const f = await released(); f.targetMemory.set(coreKey(worldId), JSON.stringify(f.payload.state)); assert.equal((await f.claim()).kind, 'LocalPublished');
    assert.equal(f.targetOperations.writeCount || 0, 0); await finished(f);
    const g = await released(); const raw = clone(g.payload.state); raw.capturedAt++; g.targetMemory.set(coreKey(worldId), JSON.stringify(raw));
    await assert.rejects(g.claim(), /不同/); assert.equal(g.claims.length, 0); g.protect();
  });
  await test('MS25 another claimant wins: no target publication, unchanged Core/files and retained target journal', async () => {
    const f = await released(); const c = f.service.bindDevice({ accountId, deviceId: 'device-C' });
    await c.claimMigration({ schemaVersion: 1, migrationId, worldId, expectedHomeRevision: 2 });
    const result = await f.claim(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /其他设备/);
    assert.equal(f.targetMemory.has(coreKey(worldId)), false); assert.equal(JSON.parse(f.targetMemory.get(folderKey)).records.length, 1); f.protect();
  });
  await test('MS26 local already published/service unavailable denies opening and recovery, no rollback deletion', async () => {
    const f = await released(); await f.claim(); const before = new Map(f.targetMemory); f.service.setAvailable(false);
    await assert.rejects(f.open()); assert.equal((await f.recover()).kind, 'Pending'); assert.deepEqual([...f.targetMemory], [...before]);
    f.service.setAvailable(true); assert.equal((await f.recover()).kind, 'LocalPublished'); await finished(f);
  });
  await test('MS27 historical Claim receipt cannot reopen or republish after migration back to A', async () => {
    const f = await released(); await f.claim(); await f.sourceRecover();
    const next = codec.parsePayload({ ...f.payload, migrationId: 'migration-storage-return', sourceDeviceId: bContext.deviceId, expectedHomeRevision: 3 });
    const cap = f.capability(bContext, next); await f.b.acceptDrain(cap);
    await f.b.releaseMigration({ schemaVersion: 1, migrationId: next.migrationId, worldId, expectedHomeRevision: 3, drainId: cap.confirmation.drainId }, next);
    f.advanceServiceBy(3600000);
    await f.a.readMigration(next.migrationId); await f.a.claimMigration({ schemaVersion: 1, migrationId: next.migrationId, worldId, expectedHomeRevision: 4 });
    const before = new Map(f.targetMemory); await assert.rejects(f.open(), /迁往别处|归属/); assert.equal((await f.recover()).kind, 'Pending');
    assert.deepEqual([...f.targetMemory], [...before]); assert.equal((await f.b.readRegistry()).records.find(record => record.worldId === worldId).homeRevision, 5); f.protect();
  });
  await test('MS28 malformed journal, cross-account/device, duplicate migration or changed payload never overwrite original logs', async () => {
    const f = await released(); await f.targetPrepare(); const original = f.targetMemory.get(journalKey);
    const changed = clone(f.payload); changed.record.title += ' changed'; await assert.rejects(f.targetLocked(() => f.targetStore.prepareTarget(changed)), /载荷被改变/);
    assert.equal(f.targetMemory.get(journalKey), original);
    for (const fault of ['JSON', 'account', 'device', 'duplicate']) {
      const raw = JSON.parse(original); if (fault === 'account') raw.accountId = 'other account'; if (fault === 'device') raw.deviceId = 'other device';
      if (fault === 'duplicate') raw.entries.push(clone(raw.entries[0])); const text = fault === 'JSON' ? '{broken' : JSON.stringify(raw);
      f.targetMemory.set(journalKey, text); assert.throws(() => f.targetStore.readJournal(accountId)); assert.equal(f.targetMemory.get(journalKey), text);
    }
    f.targetMemory.set(journalKey, original); assert.equal((await f.recover()).kind, 'LocalPublished'); await finished(f);
  });
  await test('MS29 final synchronous authority guard closes async-observation→Core-write service unavailability gap', async () => {
    const f = await released(); f.authorityFaults({ beforeAdmissionNow() { f.service.setAvailable(false); } });
    assert.equal((await f.claim()).kind, 'Pending'); assert.equal(f.targetStore.readPending(accountId).phase, 'Claimed');
    assert.equal(f.targetMemory.has(coreKey(worldId)), false); f.authorityFaults(); f.service.setAvailable(true);
    assert.equal((await f.recover()).kind, 'LocalPublished'); await finished(f);
  });
  await test('MS30 published progression may open, while immutable FormatTime/forkOrigin mutation remains rejected', async () => {
    const f = await released(); await f.claim(); const value = clone(f.payload.state); value.revision++; value.capturedAt++;
    f.targetMemory.set(coreKey(worldId), JSON.stringify(value)); await f.open();
    value.sections.FormatTime.epochMs++; f.targetMemory.set(coreKey(worldId), JSON.stringify(value)); await assert.rejects(f.open()); f.protect();
  });
  await test('MS31 no pending recovery is diagnostic only; account isolation and reentrant coordinator refuse', async () => {
    const f = await fixture(); assert.deepEqual(await f.sourceLocked(() => f.sourceStore.recover(accountId)), { kind: 'NoPending', mode: 'ContractAdapter' });
    assert.throws(() => f.sourceStore.readJournal('other account'), /绑定账号/);
    await assert.rejects(f.sourceLocked(() => f.sourceStore.withMigrationLock(accountId, () => null)), /不可重入/); f.protect();
  });
  await test('MS32 inherited fork origin survives unchanged through same-ID migration and no account facts are transferred', async () => {
    const base = h.worldSource({ worldId: otherWorldId }).state;
    const { rebaseWorldState } = load('src/director/WorldForkSession.ts');
    const origin = { schemaVersion: 1, accountId, sourceWorldId: otherWorldId, sourceRevision: base.revision, sourceCapturedAt: base.capturedAt,
      targetWorldId: worldId, protagonistCharacterId: base.sections.Ledger.protagonistCharacterId,
      transactionId: 'fork-20000000-0000-4000-8000-000000000006', forkedAt: epochMs + 800,
      inheritedCompletionEventId: base.sections.Ledger.control.completionEventId };
    const fork = rebaseWorldState(base, worldId, origin, complete), raw = clone(fork); raw.revision = 11; raw.capturedAt++;
    const f = await released({ source: complete(raw, accountId, worldId) }); await f.claim(); await finished(f);
    assert.deepEqual(JSON.parse(f.targetMemory.get(coreKey(worldId))).forkOrigin, clone(origin));
    assert.equal(JSON.parse(f.targetMemory.get(coreKey(worldId))).revision, 11); assert.deepEqual(clone(f.payload.state.sections.FormatTime), clone(base.sections.FormatTime)); f.protect();
  });
  await test('MS33 local publication survives a missing service domain; never invent registration or delete the target', async () => {
    const f = await released(); await f.claim(); const before = new Map(f.targetMemory); f.serviceMemory.clear();
    await assert.rejects(f.open(), /尚不存在|缺失/); assert.equal((await f.recover()).kind, 'Pending');
    assert.deepEqual([...f.targetMemory], [...before]); assert.equal(f.claims.length, 1); f.protect();
  });
  await test('MS34 source Prepared/PauseActive/Released/Claimed durable phases survive new storage instances without source mutation', async () => {
    const f = await fixture(), snapshots = [];
    await f.sourceLocked(() => f.sourceStore.prepareSource(f.payload)); snapshots.push(new Map(f.sourceMemory));
    await f.sourceRecover(f.capability()); snapshots.push(new Map(f.sourceMemory));
    await f.expire(); await f.sourceRecover(); snapshots.push(new Map(f.sourceMemory));
    await f.claim(); await f.sourceRecover(); snapshots.push(new Map(f.sourceMemory));
    for (const memory of snapshots) {
      const adapter = adapterMap(memory), bindings = { ...f.sourceBindings,
        readTarget: (_account, id) => memory.has(coreKey(id)) ? JSON.parse(memory.get(coreKey(id))) : null };
      const restarted = new WorldMigrationStorage(adapter, f.localLocks, bindings);
      const result = await restarted.withMigrationLock(accountId, () => restarted.recover(accountId, migrationId));
      assert.equal(result.phase, 'Claimed'); assert.equal(result.error, null); assert.equal(restarted.readPending(accountId), null);
      assert.equal(memory.get(coreKey(worldId)), f.sourceMemory.get(coreKey(worldId))); assert.equal(memory.get(folderKey), f.sourceMemory.get(folderKey));
    } assert.equal(f.releases.length, 1); f.protect();
  });
  const report = { schemaVersion: 1, phase: 'B2.4d storage', mode: 'ContractAdapter', generatedAt: new Date().toISOString(),
    passed: results.filter(value => value.pass).length, total: results.length, pass: results.every(value => value.pass), results,
    limitation: 'Controlled service fixture advances serviceNow; not a real one-hour wait, external service, FileCarry, or Creator production injection.' };
  fs.writeFileSync(path.join(__dirname, 'storage-contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, passed: report.passed, total: report.total })); process.exitCode = report.pass ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
