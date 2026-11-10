'use strict';
// Real d composition and drain issuer, mocked resource delivery/browser capabilities only.
// Controlled ContractAdapter fixtures are never placed into a Creator preview profile.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const h = require('../b2-cross-device-core/contract-test-helpers.cjs');
const { clearRecord } = require('./drain-contract-tests.cjs');
const { rebaseWorldState } = h.load('src/director/WorldForkSession.ts');
const { WorldCoreStateStorage } = h.load('src/presentation/WorldCoreStateStorage.ts');
const { WorldStateCodec } = h.load('src/director/WorldStateCodec.ts');
const { WorldClearStorage } = h.load('src/presentation/WorldClearStorage.ts');
const manifest = JSON.parse(fs.readFileSync(path.join(h.h.root, 'assets/resources/chart/content-manifest.json'), 'utf8'));
let resourceDelivery = null;
const cc = { JsonAsset: class JsonAsset {}, resources: { load(resource, kind, callback) {
  assert.equal(resource, 'chart/content-manifest'); resourceDelivery(callback);
} } };
const originalLoad = Module._load;
Module._load = function (request, parent, main) { return request === 'cc' ? cc : originalLoad.call(this, request, parent, main); };
const { WorldMigrationPrototype } = h.load('assets/scripts/WorldMigrationPrototype.ts');
Module._load = originalLoad;
const bKey = key => 'neurou-contract-device-b:' + encodeURIComponent(key);
const account = h.accountId, worldId = h.sourceWorldId;
const coreKey = world => 'neurou-world-state-v1:' + encodeURIComponent(account) + ':' + encodeURIComponent(world);
const folderKey = 'neurou-world-folder-v1:' + encodeURIComponent(account);
const journalKey = 'neurou-migration-v1:' + encodeURIComponent(account);
const clearKey = 'neurou-account-world-clears-v1:' + encodeURIComponent(account);
const milestoneKey = 'neurou-account-first-world-cleared-v1:' + encodeURIComponent(account);
const pauseKey = 'neurou-reality-pause-v1:' + encodeURIComponent(account);
const cases = [];
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
async function until(condition) { for (let i = 0; i < 500; i++) { if (condition()) return; await Promise.resolve(); } throw Error('controlled async boundary not reached'); }
async function test(name, run) { try { await run(); cases.push({ name, mode: 'ContractAdapter', result: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { cases.push({ name, mode: 'ContractAdapter', result: 'FAIL', error: String(error), stack: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); } }
function environment(options = {}) {
  const saved = new Map(['localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const memory = new Map(), writes = [], browserLocks = new h.ExclusiveLock(); let fault = null, active = false, pending = false, callback = null, opens = 0;
  const initial = h.worldSource({ worldId: 'InitialWorld', completed: options.completed }).state;
  const origin = { schemaVersion: 1, accountId: account, sourceWorldId: 'InitialWorld', sourceRevision: initial.revision,
    sourceCapturedAt: initial.capturedAt, targetWorldId: worldId, protagonistCharacterId: initial.sections.Ledger.protagonistCharacterId,
    transactionId: 'fork-20000000-0000-4000-8000-000000000008', forkedAt: h.epochMs + 800,
    inheritedCompletionEventId: initial.sections.Ledger.control.completionEventId };
  const source = h.clone(rebaseWorldState(initial, worldId, origin, h.transferComplete)); source.revision = 11; source.capturedAt++;
  const validatedSource = h.transferComplete(source, account, worldId);
  const sourceFolder = h.folder(['InitialWorld', worldId, h.otherWorldId]);
  sourceFolder.records.find(record => record.worldId === worldId).createdAt = origin.forkedAt;
  const empty = { schemaVersion: 1, accountId: account, worldId: h.otherWorldId, worldKind: 'Unavailable', shoreOrigin: 'Unavailable',
    revision: 0, capturedAt: h.epochMs, kind: 'Core', sections: { Ledger: null, PuzzleProgress: null, FormatTime: { epochMs: h.epochMs } } };
  memory.set(coreKey('InitialWorld'), JSON.stringify(initial)); memory.set(coreKey(worldId), JSON.stringify(validatedSource));
  memory.set(coreKey(h.otherWorldId), JSON.stringify(empty)); memory.set(folderKey, JSON.stringify(sourceFolder));
  const fact = clearRecord(initial);
  memory.set(clearKey, JSON.stringify({ schemaVersion: 1, accountId: account, records: fact ? [fact] : [] }));
  memory.set(milestoneKey, JSON.stringify({ schemaVersion: 1, accountId: account, FirstWorldCleared: !!fact }));
  const sourceBefore = new Map(memory), storage = { getItem: key => memory.get(key) ?? null, setItem(key, value) {
    fault?.(key, value); memory.set(key, value); writes.push({ key, value }); }, removeItem: key => memory.delete(key) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: options.noLocks ? {} : { locks: {
    request(name, config, body) {
      if (typeof config === 'function') { body = config; config = {}; }
      if (config.ifAvailable && browserLocks.active.has(name)) return Promise.resolve().then(() => body(null));
      return browserLocks.request(name, () => body({ name, mode: 'exclusive' }));
    },
  } } });
  const locks = { request: (name, operation) => browserLocks.request(name, operation),
    requestIfAvailable: (name, operation) => browserLocks.requestIfAvailable(name, operation) };
  const validateCore = (raw, a, w) => raw?.worldKind === 'Unavailable' ? new WorldStateCodec().parse(raw, a, w) : h.transferComplete(raw, a, w);
  const core = new WorldCoreStateStorage(storage, options.noLocks ? null : locks, validateCore, (a, w) =>
    a === account && h.validateFolder(JSON.parse(memory.get(folderKey)), account).records.some(record => record.worldId === w && record.deletedAt === null));
  const clears = new WorldClearStorage(storage, locks), instances = [];
  resourceDelivery = delivery => { callback = delivery; if (!options.pendingResource) delivery(null, { json: manifest }); };
  const bindings = { prepare: async () => undefined, core, validateComplete: h.transferComplete,
    readFolder: a => h.validateFolder(JSON.parse(memory.get(folderKey)), a), readClearRecords: a => clears.readWorldClearRecords(a),
    isIdle: () => !active, assertPending() { if (pending) throw Error('pending account/core/fork transaction'); },
    openTarget(identity) { assert.equal(identity.worldId, worldId); assert(identity.coreStorage.hasWorldLease(account, worldId));
      opens++; identity.lease.release(); }, refresh() {} };
  const create = () => { const value = new WorldMigrationPrototype(bindings); instances.push(value); return value; };
  const prototype = create();
  return { prototype, create, memory, writes, browserLocks, source: validatedSource, initial, origin, core, sourceBefore, bindings,
    active(value) { active = value; }, pending(value) { pending = value; }, fault(value = null) { fault = value; },
    get opens() { return opens; }, deliverResource() { assert(callback); callback(null, { json: manifest }); },
    preserve() { for (const [key, value] of sourceBefore) assert.equal(memory.get(key), value, 'protected source/core/account fact bytes: ' + key);
      assert.equal(memory.has(bKey(clearKey)), false); assert.equal(memory.has(bKey(milestoneKey)), false); },
    async ready(value = prototype) { await value.checkLogin(account); await value.bindAccount(account); },
    async release(value = prototype) { await value.release(worldId); return value.codec.parseReceipt(await value.a.readMigration(value.migrationId)); },
    async expire(value = prototype) { const receipt = value.codec.parseReceipt(await value.a.readMigration(value.migrationId));
      value.serviceClockFixture.advanceServiceFixtureBy(receipt.pause.resumeNotBeforeServerEpochMs - value.serviceClockFixture.now());
      await value.poll(); return value.codec.parseReceipt(await value.a.readMigration(value.migrationId)); },
    restore() { for (const value of instances) value.dispose(); resourceDelivery = null;
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}
async function withEnvironment(run, options) { const e = environment(options); try { await run(e); } finally { await settle(); e.restore(); } }

(async () => {
  await test('MP01 real composition drains all three A worlds, starts account pause, service expires, B publishes and opens same ID', () => withEnvironment(async e => {
    await e.ready(); const receipt = await e.release(); assert.equal(receipt.kind, 'PauseActive');
    const id = e.prototype.migrationId, journal = JSON.parse(e.memory.get(journalKey)); assert.equal(journal.entries[0].phase, 'PauseActive');
    assert.equal(journal.entries[0].payload.state.worldId, worldId); assert.equal(journal.entries[0].payload.state.revision, 11);
    assert(e.browserLocks.calls.includes('neurou-world-state:' + encodeURIComponent(account) + ':InitialWorld'));
    assert(e.browserLocks.calls.includes('neurou-world-state:' + encodeURIComponent(account) + ':' + encodeURIComponent(h.otherWorldId)));
    assert.equal(e.prototype.isRuntimeClosed(), true); await assert.rejects(e.prototype.claim(), /PauseActive/);
    assert.equal((await e.expire()).kind, 'Released'); await e.prototype.claim();
    const target = JSON.parse(e.memory.get(bKey(coreKey(worldId)))); assert.deepEqual(target, h.clone(e.source));
    const targetJournal = JSON.parse(e.memory.get(bKey(journalKey))); assert.equal(targetJournal.entries[0].phase, 'LocalPublished');
    assert.equal(targetJournal.entries[0].payload.migrationId, id); assert.equal(targetJournal.entries[0].payload.state.worldId, worldId);
    await e.prototype.open(); await settle(); assert.equal(e.opens, 1); assert.equal(e.prototype.bCore.hasWorldLease(account, worldId), false);
    assert.equal((await e.prototype.a.readAdmission(worldId)).kind, 'Migrated'); e.preserve();
  }));
  await test('MP02 RealityPause rejects both devices and every InitialWorld/source/empty-world/new activity admission', () => withEnvironment(async e => {
    await e.ready(); await e.release(); let operated = false;
    for (const device of ['logical-device-a', 'logical-device-b']) for (const world of [undefined, 'InitialWorld', worldId, h.otherWorldId]) {
      await assert.rejects(e.prototype.requireAdmission(device, world), /PauseActive/);
      assert.throws(() => e.prototype.assertAdmissionNow(device, world), /暂停|拒绝|PauseActive/);
      await assert.rejects(e.prototype.withAdmission(device, world, async () => { operated = true; }), /PauseActive/);
    }
    assert.equal(operated, false); assert.equal(e.memory.has(bKey(coreKey(worldId))), false); e.preserve();
  }));
  await test('MP03 persistent initiating device binding survives client reconstruction, rejects other account, ignores deleted local pause cache', () => withEnvironment(async e => {
    await e.ready(); await e.release(); const id = e.prototype.migrationId; e.prototype.dispose(); e.memory.delete(pauseKey);
    const fresh = e.create(); await assert.rejects(fresh.checkLogin('different account'), /绑定|切换/); await e.ready(fresh);
    assert.equal(fresh.migrationId, id); assert.equal(fresh.isRuntimeClosed(), true);
    assert.equal((await fresh.a.readDeviceBinding()).boundAccountId, account); await assert.rejects(fresh.claim(), /PauseActive/);
    await e.expire(fresh); await fresh.checkLogin('different account'); assert.equal((await fresh.a.readDeviceBinding()).boundAccountId, null); e.preserve();
  }));
  await test('MP04 reconstructed target requires persistent LocalPublished plus current service ownership before open', () => withEnvironment(async e => {
    await e.ready(); await e.release(); await e.expire(); await e.prototype.claim(); e.prototype.dispose();
    const fresh = e.create(); await e.ready(fresh); await fresh.open(); await settle(); assert.equal(e.opens, 1);
    fresh.authority.setAvailable(false); await assert.rejects(fresh.open(), /服务|不可用/); assert.equal(e.opens, 1);
    fresh.authority.setAvailable(true); await fresh.open(); await settle(); assert.equal(e.opens, 2); e.preserve();
  }));
  await test('MP05 source active graph or uncommitted account transaction refuses drain without forcibly ending activity', () => withEnvironment(async e => {
    await e.ready(); e.active(true); await assert.rejects(e.prototype.release(worldId), /自然到达安全点/);
    assert.equal(e.memory.has(journalKey), false); assert.equal(e.prototype.draining, false); e.active(false); e.pending(true);
    await assert.rejects(e.prototype.release(worldId), /pending account/); assert.equal(e.memory.has(journalKey), false);
    assert.equal(e.prototype.draining, false); assert.equal(e.core.hasWorldLease(account, 'InitialWorld'), false);
    assert.equal(e.core.hasWorldLease(account, worldId), false); e.pending(false); assert.equal((await e.release()).kind, 'PauseActive'); e.preserve();
  }));
  await test('MP06 migration does not require CopyPermission or manufacture account facts', () => withEnvironment(async e => {
    await e.ready(); assert.equal(JSON.parse(e.memory.get(milestoneKey)).FirstWorldCleared, false); await e.release(); await e.expire();
    await e.prototype.claim(); await e.prototype.open(); await settle(); assert.equal(e.opens, 1);
    assert.equal(e.memory.has(bKey(milestoneKey)), false); assert.equal(JSON.parse(e.memory.get(clearKey)).records.length, 0); e.preserve();
  }, { completed: false }));
  await test('MP07 client wall-clock changes cannot expire RealityPause; only independent service fixture advances', () => withEnvironment(async e => {
    await e.ready(); const receipt = await e.release(), now = Date.now;
    try { Date.now = () => Number.MAX_SAFE_INTEGER; await e.prototype.poll(); await assert.rejects(e.prototype.claim(), /PauseActive/);
      assert.equal((await e.prototype.a.readMigration(e.prototype.migrationId)).pause.resumeNotBeforeServerEpochMs, receipt.pause.resumeNotBeforeServerEpochMs);
      Date.now = () => 0; assert.equal((await e.expire()).kind, 'Released'); await e.prototype.claim(); } finally { Date.now = now; } e.preserve();
  }));
  await test('MP08 service Claim/local directory quota remains Claimed; new composition reconciles without target Core rewrite', () => withEnvironment(async e => {
    await e.ready(); await e.release(); await e.expire(); e.fault((key, value) => {
      if (key === bKey(folderKey) && JSON.parse(value).records.length > 1) throw Error('target directory quota');
    }); await assert.rejects(e.prototype.claim(), /target directory quota/);
    const core = e.memory.get(bKey(coreKey(worldId))); assert.equal(typeof core, 'string');
    assert.equal(JSON.parse(e.memory.get(bKey(journalKey))).entries[0].phase, 'Claimed'); await assert.rejects(e.prototype.open(), /拒绝打开/);
    e.prototype.dispose(); e.fault(); const fresh = e.create(); await e.ready(fresh); await fresh.reconcile();
    assert.equal(e.memory.get(bKey(coreKey(worldId))), core); await fresh.open(); await settle(); assert.equal(e.opens, 1); e.preserve();
  }));
  await test('MP09 no Web Locks cannot authenticate fixture or Release, no source/journal/Core writes', () => withEnvironment(async e => {
    await assert.rejects(e.prototype.checkLogin(account), /Web Locks/); assert.equal(e.memory.has(journalKey), false);
    assert.equal(e.memory.has('neurou-migration-contract-authority-v1'), false); assert.equal(e.writes.length, 0); e.preserve();
  }, { noLocks: true }));
  await test('MP10 disposal during pending formal manifest blocks login and every authority/world side effect', () => withEnvironment(async e => {
    const check = e.prototype.checkLogin(account); e.prototype.dispose(); e.deliverResource(); await assert.rejects(check, /宿主已销毁/);
    assert.equal(e.writes.length, 0); assert.equal(e.browserLocks.calls.length, 0); e.preserve();
  }, { pendingResource: true }));
  await test('MP11 disposal during async open service validation releases target lease and never calls runtime factory', () => withEnvironment(async e => {
    await e.ready(); await e.release(); await e.expire(); await e.prototype.claim();
    const bound = e.prototype.targetJournal.bindings.authority; let entered = false, resolve;
    const gate = new Promise(ready => { resolve = ready; }); e.prototype.targetJournal.bindings.authority = { ...bound,
      readAdmission: async id => { const result = await bound.readAdmission(id); entered = true; await gate; return result; } };
    const pendingOpen = e.prototype.open(); await until(() => entered); assert.equal(e.prototype.bCore.hasWorldLease(account, worldId), true);
    e.prototype.dispose(); resolve(); await assert.rejects(pendingOpen, /准入已关闭/); await settle();
    assert.equal(e.prototype.bCore.hasWorldLease(account, worldId), false); assert.equal(e.opens, 0); e.preserve();
  }));
  await test('MP12 accepted Release with source journal quota stays Prepared and missing service domain cannot reopen its source', () => withEnvironment(async e => {
    await e.ready();
    e.fault((key, value) => {
      if (key === journalKey && JSON.parse(value).entries.some(entry => entry.phase === 'PauseActive')) {
        throw Error('source journal receipt quota');
      }
    });
    await assert.rejects(e.prototype.release(worldId), /source journal receipt quota/);
    assert.equal(JSON.parse(e.memory.get(journalKey)).entries[0].phase, 'Prepared');
    const authorityKey = 'neurou-migration-contract-authority-v1';
    assert.equal(JSON.parse(e.memory.get(authorityKey)).migrations[0].receipt.kind, 'PauseActive');
    e.fault(); e.memory.delete(authorityKey);
    assert.throws(() => e.prototype.assertAdmissionNow('logical-device-a', worldId), /去往别处|归属缺失|对账/);
    await assert.rejects(e.prototype.requireAdmission('logical-device-a', worldId), /去往别处|归属缺失|对账/);
    assert.equal(e.opens, 0); e.preserve();
  }));
  const failed = cases.filter(value => value.result !== 'PASS');
  const report = { schemaVersion: 1, phase: 'B2.4d composition', mode: 'ContractAdapter', total: cases.length,
    passed: cases.length - failed.length, pass: failed.length === 0, cases, generatedAt: new Date().toISOString(),
    sourceFiles: ['assets/scripts/WorldMigrationPrototype.ts', 'src/director/WorldMigration.ts',
      'src/presentation/WorldMigrationContractAdapter.ts', 'src/presentation/SafePointDrainStorage.ts', 'src/presentation/WorldMigrationStorage.ts']
      .map(file => ({ file, sha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(h.h.root, file))).digest('hex') })),
    limitation: 'Actual additive composition with production codecs, live drain issuer and world leases. Resource callback, Web Locks, storage and gameplay input fixtures controlled; service clock advanced explicitly. This is not Creator production acceptance or an external service.' };
  fs.writeFileSync(path.join(__dirname, 'prototype-contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, total: report.total, passed: report.passed, failures: failed.map(value => value.name) }));
  process.exitCode = report.pass ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
