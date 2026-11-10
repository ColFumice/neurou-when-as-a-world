'use strict';
// Real additive composition with mocked Cocos resource delivery and browser capabilities.
// These are ContractAdapter lifecycle/storage tests; no preview profile is seeded.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const h = require('./contract-test-helpers.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(h.h.root, 'assets/resources/chart/content-manifest.json'), 'utf8'));
let resourceDelivery = null;
const cc = { JsonAsset: class JsonAsset {}, resources: { load(resourcePath, kind, callback) {
  assert.equal(resourcePath, 'chart/content-manifest'); resourceDelivery(callback);
} } };
const originalLoad = Module._load;
Module._load = function (request, parent, main) { return request === 'cc' ? cc : originalLoad.call(this, request, parent, main); };
const { CrossDevicePrototype } = h.load('assets/scripts/CrossDevicePrototype.ts');
const { WorldCoreStateStorage } = h.load('src/presentation/WorldCoreStateStorage.ts');
Module._load = originalLoad;
const prefix = 'neurou-contract-device-b:';
const bKey = key => prefix + encodeURIComponent(key);
const initialKey = h.stateKey('InitialWorld'), cases = [];
async function settle() { for (let n = 0; n < 8; n++) { await Promise.resolve(); } }
async function until(condition) {
  for (let n = 0; n < 250; n++) { if (condition()) { return; } await Promise.resolve(); }
  throw Error('controlled asynchronous boundary was not reached');
}
async function test(name, operation) {
  try { await operation(); cases.push({ name, result: 'PASS', mode: 'ContractAdapter' }); }
  catch (error) { cases.push({ name, result: 'FAIL', mode: 'ContractAdapter', error: String(error), stack: error.stack }); }
}
function environment(options = {}) {
  const descriptors = new Map(['localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const memory = options.memory || new Map(), writes = [], browserLock = new h.ExclusiveLock();
  let fault = null, resourceCallback = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => memory.get(key) ?? null,
    setItem(key, value) { if (fault) { fault(key, value); } memory.set(key, value); writes.push({ key, value }); },
    removeItem(key) { memory.delete(key); },
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: options.noLocks ? {} : { locks: {
    request(name, lockOptions, callback) {
      if (lockOptions.ifAvailable && browserLock.active.has(name)) { return Promise.resolve().then(() => callback(null)); }
      return browserLock.request(name, () => callback({ name, mode: 'exclusive' }));
    },
  } } });
  resourceDelivery = callback => { resourceCallback = callback; if (!options.pendingResource) { callback(null, { json: manifest }); } };
  const source = h.worldSource().state, sourceMemory = new Map([[h.stateKey(h.sourceWorldId), JSON.stringify(source)]]);
  const sourceLock = new h.ExclusiveLock(), sourceCore = new WorldCoreStateStorage({
    getItem: key => sourceMemory.get(key) ?? null, setItem: (key, value) => sourceMemory.set(key, value),
  }, sourceLock, h.complete, () => true);
  let opens = 0;
  const create = () => new CrossDevicePrototype({ accountId: h.accountId,
    readSourceFolder: () => h.folder(['InitialWorld', h.sourceWorldId]),
    readSource: world => h.complete(sourceCore.readCoreState(h.accountId, world), h.accountId, world),
    acquireSourceLease: world => sourceCore.acquireWorldLease(h.accountId, world, true),
    milestoneReader: h.permission(), validateComplete: h.complete, isIdle: () => true,
    openTarget() { opens++; },
  });
  const prototype = create();
  return { prototype, create, memory, writes, browserLock, sourceLock, sourceMemory, source,
    get opens() { return opens; }, fault(callback = null) { fault = callback; },
    deliverResource() { assert(resourceCallback); resourceCallback(null, { json: manifest }); },
    restore() {
      prototype.dispose(); resourceDelivery = null;
      for (const [key, descriptor] of descriptors) { if (descriptor) { Object.defineProperty(globalThis, key, descriptor); } else { delete globalThis[key]; } }
    },
  };
}
async function withEnvironment(operation, options) {
  const env = environment(options); try { await operation(env); } finally { await settle(); env.restore(); }
}
(async () => {
  await test('P01 B initialization acquires import→InitialWorld lease→directory and writes only the B namespace', () => withEnvironment(async e => {
    await e.prototype.initialize(); await settle();
    const account = encodeURIComponent(h.accountId);
    assert.deepEqual(e.browserLock.calls, [prefix + 'neurou-cross-device-import:' + account,
      prefix + 'neurou-world-state:' + account + ':InitialWorld', prefix + 'neurou-world-folder:' + account]);
    assert.deepEqual(e.writes.map(value => value.key), [bKey(initialKey), bKey(h.folderKey)]);
    const core = JSON.parse(e.memory.get(bKey(initialKey))), folder = JSON.parse(e.memory.get(bKey(h.folderKey)));
    assert.equal(core.sections.FormatTime.epochMs, folder.records[0].createdAt);
    assert.equal(e.memory.has(h.folderKey), false); assert.equal(e.memory.has(initialKey), false);
    assert.equal(e.sourceLock.calls.length, 0); assert.equal(e.opens, 0); assert.equal(e.browserLock.active.size, 0);
  }));
  await test('P02 Core success then initial directory failure recovers in a fresh composition without changing FormatTime or bytes', () => withEnvironment(async e => {
    e.fault(key => { if (key === bKey(h.folderKey)) { throw Error('initial directory quota'); } });
    await assert.rejects(e.prototype.initialize(), /initial directory quota/); await settle();
    const originalCore = e.memory.get(bKey(initialKey)); assert.equal(typeof originalCore, 'string');
    assert.equal(e.memory.has(bKey(h.folderKey)), false); e.prototype.dispose(); e.fault();
    const fresh = e.create(); try { await fresh.initialize(); await settle(); }
    finally { fresh.dispose(); }
    assert.equal(e.memory.get(bKey(initialKey)), originalCore);
    assert.equal(e.writes.filter(value => value.key === bKey(initialKey)).length, 1);
    assert.equal(JSON.parse(e.memory.get(bKey(h.folderKey))).records[0].createdAt,
      JSON.parse(originalCore).sections.FormatTime.epochMs);
    assert.equal(e.browserLock.active.size, 0);
  }));
  await test('P03 disposing while the Cocos manifest resource is pending prevents every storage, lock and runtime side effect', () => withEnvironment(async e => {
    const pending = e.prototype.initialize(); e.prototype.dispose(); e.deliverResource();
    await assert.rejects(pending, /宿主已销毁/);
    assert.equal(e.memory.size, 0); assert.equal(e.writes.length, 0); assert.equal(e.browserLock.calls.length, 0);
    assert.equal(e.sourceLock.calls.length, 0); assert.equal(e.opens, 0);
  }, { pendingResource: true }));
  await test('P04 absent Web Locks explicitly rejects B initialization without writing keys or opening a world', () => withEnvironment(async e => {
    await assert.rejects(e.prototype.initialize(), /没有导入独占锁/);
    assert.equal(e.memory.size, 0); assert.equal(e.writes.length, 0); assert.equal(e.sourceLock.calls.length, 0); assert.equal(e.opens, 0);
  }, { noLocks: true }));
  await test('P05 disposal during service replay with an existing staged Core preserves the journal/Core and prevents local publication', () => withEnvironment(async e => {
    await e.prototype.initialize(); await e.prototype.exportSource(h.sourceWorldId);
    e.fault(key => { if (key === bKey(h.folderKey)) { throw Error('target directory quota'); } });
    await e.prototype.importTarget(); await settle(); e.fault();
    const target = e.prototype.lastTarget, coreBytes = e.memory.get(bKey(h.stateKey(target))), folderBytes = e.memory.get(bKey(h.folderKey));
    const journalBefore = JSON.parse(e.memory.get(bKey(h.journalKey))); assert.equal(journalBefore.entries[0].phase, 'HomeRegistered');
    const bound = e.prototype.b; let entered = false, releaseService;
    const gate = new Promise(resolve => { releaseService = resolve; });
    e.prototype.importStorage.bindings.authority = { ...bound, registerWorldHome: async request => {
      const result = await bound.registerWorldHome(request); entered = true; await gate; return result;
    } };
    const pending = e.prototype.recover(); await until(() => entered); e.prototype.dispose(); releaseService(); await pending; await settle();
    assert.equal(e.memory.get(bKey(h.stateKey(target))), coreBytes); assert.equal(e.memory.get(bKey(h.folderKey)), folderBytes);
    assert.equal(JSON.parse(e.memory.get(bKey(h.journalKey))).entries[0].phase, 'HomeRegistered');
    assert.equal(e.prototype.bCore.hasWorldLease(h.accountId, target), false); assert.equal(e.opens, 0);
    assert.equal(e.sourceMemory.get(h.stateKey(h.sourceWorldId)), JSON.stringify(e.source));
  }));
  await test('P06 disposal during current-home open verification releases the genuine target lease and never calls the runtime factory', () => withEnvironment(async e => {
    await e.prototype.initialize(); await e.prototype.exportSource(h.sourceWorldId); await e.prototype.importTarget(); await settle();
    const target = e.prototype.lastTarget, bound = e.prototype.b; let entered = false, releaseService;
    const gate = new Promise(resolve => { releaseService = resolve; });
    e.prototype.importStorage.bindings.authority = { ...bound, readRegistry: async () => {
      const result = await bound.readRegistry(); entered = true; await gate; return result;
    } };
    const pending = e.prototype.openTarget(); await until(() => entered);
    assert.equal(e.prototype.bCore.hasWorldLease(h.accountId, target), true); e.prototype.dispose(); releaseService();
    await assert.rejects(pending, /宿主已销毁/); await settle();
    assert.equal(e.prototype.bCore.hasWorldLease(h.accountId, target), false); assert.equal(e.opens, 0);
    assert.equal(JSON.parse(e.memory.get(bKey(h.journalKey))).entries[0].phase, 'Published');
  }));
  const failed = cases.filter(value => value.result !== 'PASS');
  const sourceFiles = ['assets/scripts/CrossDevicePrototype.ts', 'assets/scripts/WorldFolderBuilder.ts',
    'src/director/CoreTransfer.ts', 'src/presentation/CrossDeviceImportStorage.ts'];
  const result = { evidenceKind: 'ContractTest', adapterMode: 'ContractAdapter', pass: failed.length === 0, total: cases.length,
    passed: cases.length - failed.length, cases, capturedAt: new Date().toISOString(),
    sources: sourceFiles.map(file => ({ file, sha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(h.h.root, file))).digest('hex') })),
    policy: 'Actual additive composition, production codecs and world leases; Cocos resource callback, browser locks/storage and source fixture are controlled test seams. No production preview data or actual Cocos acceptance.' };
  fs.writeFileSync(path.join(__dirname, 'prototype-contract-results.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ pass: result.pass, total: result.total, passed: result.passed, failures: failed.map(value => value.name) }) + '\n');
  if (!result.pass) { process.exitCode = 1; }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
