'use strict';
// Actual domain planning, seven-section codecs and world-lease storage. All clocks/adapters are isolated contract fixtures.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('../b2-state-extensions/state-test-fixture.cjs');
const { load, clone, content, regular, epochMs } = h;
const { WorldForkStorage } = load('src/presentation/WorldForkStorage.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { WorldForkSession, validateWorldForkPlan } = load('src/director/WorldForkSession.ts');
const { WorldFolderSession } = load('src/director/WorldFolderSession.ts');
const { createPrimaryWorldStateCodec } = load('src/director/PrimaryWorldState.ts');
const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const { chartContentDigest } = load('src/director/ChartArchive.ts');
const targetId = 'world-4a62ebd4-79b8-4b5c-a989-e681880ee6ad';
const otherId = 'world-95c7332a-44f1-451e-9307-09c689f57051';
const accountId = 'fork storage/contract';
const stateKey = world => 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(world);
const folderKey = 'neurou-world-folder-v1:' + encodeURIComponent(accountId);
const journalKey = 'neurou-world-fork-journal-v1:' + encodeURIComponent(accountId);
const accountKeys = ['neurou-account-first-world-cleared-v1:', 'neurou-account-world-clears-v1:'].map(prefix => prefix + encodeURIComponent(accountId));
const tick = () => new Promise(resolve => setImmediate(resolve));
class ExclusiveLock {
  constructor() { this.tails = new Map(); this.active = new Set(); this.calls = []; }
  request(name, operation) {
    this.calls.push(name);
    const prior = this.tails.get(name) || Promise.resolve();
    const result = prior.catch(() => {}).then(async () => {
      assert(!this.active.has(name)); this.active.add(name);
      try { return await operation(); } finally { this.active.delete(name); }
    });
    this.tails.set(name, result); return result;
  }
  requestIfAvailable(name, operation) {
    if (this.active.has(name)) { return Promise.reject(new Error('source world is busy')); }
    return this.request(name, operation);
  }
}
function validateFolder(raw, account) {
  return new WorldFolderSession(account, raw, () => { throw new Error('validation cannot write'); },
    () => { throw new Error('validation cannot create'); }, () => { throw new Error('validation cannot clock'); }).getSnapshot();
}
const complete = (raw, account, world) => createPrimaryWorldStateCodec(account, world, content, regular.chartId).parseComplete(raw, account, world);
async function fixture(options = {}) {
  const initialFixture = h.fixture({ accountId, worldId: 'InitialWorld' });
  const source = complete(initialFixture.initial, accountId, 'InitialWorld');
  const folder = validateFolder({ schemaVersion: 1, accountId, records: [
    { worldId: 'InitialWorld', title: 'Contract Primary', description: 'Published world', createdAt: epochMs, deletedAt: null, template: 'InitialWorld' },
  ] }, accountId);
  const milestone = { schemaVersion: 1, accountId, FirstWorldCleared: true };
  const session = new WorldForkSession(accountId, createAccountMilestoneReader(accountId, milestone), {
    createWorldId: () => options.targetId || targetId, createTransactionId: () => 'fork-storage-transaction-1',
    now: () => epochMs + 1000, validateComplete: complete,
  });
  const plan = session.prepareWorldFork('InitialWorld', folder, source);
  const memory = options.memory || new Map([[stateKey('InitialWorld'), JSON.stringify(source)], [folderKey, JSON.stringify(folder)],
    [accountKeys[0], JSON.stringify(milestone)], [accountKeys[1], JSON.stringify({ schemaVersion: 1, accountId, records: [] })]]);
  const protectedBytes = new Map([stateKey('InitialWorld'), ...accountKeys].map(key => [key, memory.get(key)]));
  const operations = [], prefixes = []; const lock = options.lock === undefined ? new ExclusiveLock() : options.lock;
  const reservation = new Set(); let fault = {}, sourceReads = 0, targetWrites = 0, targetDeletes = 0;
  const adapter = { getItem: key => memory.get(key) ?? null, setItem(key, value) {
    if (fault.beforeSet) fault.beforeSet(key, value);
    memory.set(key, value); operations.push({ operation: 'set', key }); prefixes.push({ operation: 'set', key, memory: new Map(memory) });
    if (fault.afterSet) fault.afterSet(key, value);
  }, removeItem(key) {
    if (fault.beforeRemove) fault.beforeRemove(key);
    memory.delete(key); operations.push({ operation: 'remove', key }); prefixes.push({ operation: 'remove', key, memory: new Map(memory) });
    if (fault.afterRemove) fault.afterRemove(key);
  } };
  const core = new WorldCoreStateStorage(adapter, lock, (raw, account, world) =>
    createPrimaryWorldStateCodec(account, world, content, regular.chartId).parse(raw, account, world), (account, world) => {
      assert.equal(account, accountId);
      if (reservation.has(world)) return true;
      const directory = validateFolder(JSON.parse(memory.get(folderKey)), accountId);
      return directory.records.some(record => record.worldId === world && record.deletedAt === null);
    });
  const bindings = {
    validatePlan: raw => validateWorldForkPlan(raw, complete), validateFolder,
    validateSource(value) {
      sourceReads++;
      if (!core.hasWorldLease(accountId, value.sourceWorldId)) throw new Error('source lease missing');
      const currentFolder = validateFolder(JSON.parse(memory.get(folderKey)), accountId);
      assert(currentFolder.records.some(record => record.worldId === value.sourceWorldId && record.deletedAt === null), 'source must remain active');
      const actual = complete(core.readCoreState(accountId, value.sourceWorldId), accountId, value.sourceWorldId);
      if (actual.revision !== value.sourceRevision || chartContentDigest(actual) !== value.sourceDigest) throw new Error('source authority changed');
    },
    assertTargetLease(value) { if (!core.hasWorldLease(accountId, value.targetWorldId)) throw new Error('target lease missing'); },
    writeTarget(value) {
      targetWrites++; reservation.add(value.worldId);
      try { core.saveCoreState(value, null); } finally { reservation.delete(value.worldId); }
      if (fault.afterTargetWrite) fault.afterTargetWrite();
    },
    deleteTargetExpected(value, bytes) { targetDeletes++; reservation.delete(value.worldId); core.removeUnpublishedCoreState(value, bytes); },
  };
  const storage = new WorldForkStorage(adapter, lock, bindings);
  let sourceLease = null, targetLease = null;
  if (options.sourceLease !== false) { sourceLease = await core.acquireWorldLease(accountId, 'InitialWorld'); }
  if (options.targetLease !== false) { targetLease = await core.acquireWorldLease(accountId, options.targetId || targetId); }
  return { source, folder, plan, session, memory, operations, prefixes, lock, adapter, core, bindings, storage, protectedBytes,
    faults(value = {}) { fault = value; }, counts: () => ({ sourceReads, targetWrites, targetDeletes }),
    commit: value => storage.withDirectoryLock(accountId, () => storage.commitWorldFork(value || plan, folder)),
    recover: () => storage.withDirectoryLock(accountId, () => storage.recoverWorldFork(accountId)),
    protect() { for (const [key, bytes] of protectedBytes) assert.equal(memory.get(key), bytes, 'source/account bytes must remain: ' + key); },
    dispose() { sourceLease?.release(); targetLease?.release(); },
  };
}
const results = [];
async function test(name, operation) { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
async function withFixture(operation, options) { const f = await fixture(options); try { await operation(f); } finally { f.dispose(); } }
module.exports = { fixture, complete, validateFolder, accountId, targetId, otherId, stateKey, folderKey, journalKey, accountKeys, h };
if (require.main === module) (async () => {
  await test('real seven-section plan writes journal then target then directory then journal cleanup; source/account bytes unchanged', () => withFixture(async f => {
    const result = await f.commit(); assert.equal(result.kind, 'Committed'); assert.equal(result.cleanupPending, false);
    assert.deepEqual(f.operations, [{ operation: 'set', key: journalKey }, { operation: 'set', key: stateKey(targetId) },
      { operation: 'set', key: folderKey }, { operation: 'remove', key: journalKey }]);
    assert.equal(f.storage.readPending(accountId), null); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 2);
    const target = complete(JSON.parse(f.memory.get(stateKey(targetId))), accountId, targetId);
    assert.equal(Object.keys(target.sections).length, 7); assert.equal(target.forkOrigin.transactionId, f.plan.transactionId);
    assert.deepEqual(target.sections.FormatTime, f.source.sections.FormatTime); f.protect();
  }));
  await test('directory lock has exact encoded account key and every primitive write occurs under it', () => withFixture(async f => {
    f.faults({ beforeSet() { assert(f.lock.active.has('neurou-world-folder:' + encodeURIComponent(accountId))); },
      beforeRemove() { assert(f.lock.active.has('neurou-world-folder:' + encodeURIComponent(accountId))); } });
    await f.commit(); assert(f.lock.calls.includes('neurou-world-folder:' + encodeURIComponent(accountId)));
    assert(f.lock.calls.every(name => !name.startsWith('neurou-world-clear:'))); f.protect();
  }));
  await test('unlocked commit, recovery and ordinary directory guard reject without writes', () => withFixture(async f => {
    assert.throws(() => f.storage.commitWorldFork(f.plan, f.folder), /目录独占锁/);
    assert.throws(() => f.storage.recoverWorldFork(accountId), /目录独占锁/);
    assert.throws(() => f.storage.assertNoPending(accountId), /目录独占锁/); assert.equal(f.operations.length, 0);
  }));
  await test('missing directory lock capability rejects and never calls operation', () => withFixture(async f => {
    const storage = new WorldForkStorage(f.adapter, null, f.bindings); let reached = false;
    await assert.rejects(storage.withDirectoryLock(accountId, () => { reached = true; }), /没有目录独占锁/);
    assert.equal(reached, false); assert.equal(f.operations.length, 0);
  }));
  await test('target lease is mandatory before even journal write', () => withFixture(async f => {
    await assert.rejects(f.commit(), /target lease missing/); assert.equal(f.operations.length, 0); assert.equal(f.counts().sourceReads, 0);
  }, { targetLease: false }));
  await test('source lease is mandatory before even journal write', () => withFixture(async f => {
    await assert.rejects(f.commit(), /source lease missing/); assert.equal(f.operations.length, 0);
  }, { sourceLease: false }));
  await test('source changed since planned Complete is rejected with no side effects', () => withFixture(async f => {
    const changed = clone(f.source); changed.revision++; changed.capturedAt++; f.memory.set(stateKey('InitialWorld'), JSON.stringify(changed));
    await assert.rejects(f.commit(), /source authority changed/); assert.equal(f.operations.length, 0);
  }));
  await test('an unresolved async source authority callback is rejected before journal write', () => withFixture(async f => {
    const bindings = { ...f.bindings, validateSource: () => Promise.resolve() };
    const storage = new WorldForkStorage(f.adapter, f.lock, bindings);
    await assert.rejects(storage.withDirectoryLock(accountId, () => storage.commitWorldFork(f.plan, f.folder)), /必须同步完成/);
    assert.equal(f.operations.length, 0);
  }));
  await test('an unresolved async target lease check is rejected before source check or journal write', () => withFixture(async f => {
    const bindings = { ...f.bindings, assertTargetLease: () => Promise.reject(new Error('async lease failure')) };
    const storage = new WorldForkStorage(f.adapter, f.lock, bindings);
    await assert.rejects(storage.withDirectoryLock(accountId, () => storage.commitWorldFork(f.plan, f.folder)), /必须同步完成/);
    await tick(); assert.equal(f.operations.length, 0); assert.equal(f.counts().sourceReads, 0);
  }));
  await test('directory expected CAS mismatch preserves concurrent new record and performs no writes', () => withFixture(async f => {
    const newer = clone(f.folder); newer.records.push({ worldId: otherId, title: 'Concurrent', description: '', createdAt: epochMs,
      deletedAt: null, template: 'EmptyWorld' }); f.memory.set(folderKey, JSON.stringify(newer));
    await assert.rejects(f.commit(), /陈旧分叉计划/); assert.equal(f.operations.length, 0); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 2);
  }));
  await test('existing unrelated target state is never overwritten', () => withFixture(async f => {
    f.memory.set(stateKey(targetId), 'unrelated original bytes'); await assert.rejects(f.commit(), /目标标识已存在/);
    assert.equal(f.memory.get(stateKey(targetId)), 'unrelated original bytes'); assert.equal(f.operations.length, 0);
  }));
  await test('journal quota failure leaves directory, target, source and account unchanged', () => withFixture(async f => {
    const before = new Map(f.memory); f.faults({ beforeSet(key) { if (key === journalKey) throw new Error('journal quota'); } });
    await assert.rejects(f.commit(), /journal quota/); assert.deepEqual(f.memory, before); assert.equal(f.counts().targetWrites, 0); f.protect();
  }));
  await test('target quota failure rolls journal back without publishing directory', () => withFixture(async f => {
    const before = new Map(f.memory); f.faults({ beforeSet(key) { if (key === stateKey(targetId)) throw new Error('target quota'); } });
    await assert.rejects(f.commit(), /target quota/); assert.deepEqual(f.memory, before); assert.equal(f.counts().targetDeletes, 0); f.protect();
  }));
  await test('directory quota failure deletes only exact staged target and journal', () => withFixture(async f => {
    const before = new Map(f.memory); f.faults({ beforeSet(key) { if (key === folderKey) throw new Error('directory quota'); } });
    await assert.rejects(f.commit(), /directory quota/); assert.deepEqual(f.memory, before); assert.equal(f.counts().targetDeletes, 1); f.protect();
  }));
  await test('callback changes directory before commit point: CAS refuses and rollback preserves that newer folder', () => withFixture(async f => {
    let newer;
    f.faults({ afterTargetWrite() { newer = clone(f.folder); newer.records.push({ worldId: otherId, title: 'Concurrent', description: '',
      createdAt: epochMs, deletedAt: null, template: 'EmptyWorld' }); f.memory.set(folderKey, JSON.stringify(newer)); } });
    await assert.rejects(f.commit(), /暂存期间变化/); assert.deepEqual(JSON.parse(f.memory.get(folderKey)), newer);
    assert.equal(f.memory.has(stateKey(targetId)), false); assert.equal(f.memory.has(journalKey), false); f.protect();
  }));
  await test('rollback removal failure retains journal and unpublished exact target for idempotent retry', () => withFixture(async f => {
    f.faults({ beforeSet(key) { if (key === folderKey) throw new Error('directory quota'); },
      beforeRemove(key) { if (key === stateKey(targetId)) throw new Error('rollback remove denied'); } });
    const result = await f.commit(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /rollback remove denied/);
    assert(f.memory.has(stateKey(targetId))); assert(f.storage.readPending(accountId)); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 1);
    f.faults(); const restored = await f.recover(); assert.equal(restored.kind, 'RolledBack'); assert.equal((await f.recover()).kind, 'NoPending');
    assert.equal(f.memory.has(stateKey(targetId)), false); f.protect();
  }));
  await test('rollback journal removal failure keeps a recoverable journal after target removal', () => withFixture(async f => {
    f.faults({ beforeSet(key) { if (key === folderKey) throw new Error('directory quota'); },
      beforeRemove(key) { if (key === journalKey) throw new Error('journal remove denied'); } });
    const result = await f.commit(); assert.equal(result.kind, 'Pending'); assert.equal(f.memory.has(stateKey(targetId)), false);
    assert(f.storage.readPending(accountId)); f.faults(); assert.equal((await f.recover()).kind, 'RolledBack'); f.protect();
  }));
  await test('committed journal cleanup failure remains Committed and never rolls target or directory back', () => withFixture(async f => {
    f.faults({ beforeRemove(key) { if (key === journalKey) throw new Error('cleanup denied'); } });
    const result = await f.commit(); assert.equal(result.kind, 'Committed'); assert.equal(result.cleanupPending, true);
    assert.equal(f.counts().targetDeletes, 0); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 2); assert(f.storage.readPending(accountId));
    f.faults(); assert.equal((await f.recover()).kind, 'Committed'); assert.equal((await f.recover()).kind, 'NoPending'); f.protect();
  }));
  await test('an adapter throwing after durable directory append is recognized as committed', () => withFixture(async f => {
    f.faults({ afterSet(key) { if (key === folderKey) throw new Error('after-write interruption'); } });
    const result = await f.commit(); assert.equal(result.kind, 'Committed'); assert.equal(result.cleanupPending, false);
    assert.equal(f.counts().targetDeletes, 0); assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, 2); f.protect();
  }));
  await test('exact committed plan retry is no-write even if source later changes', () => withFixture(async f => {
    await f.commit(); const before = f.operations.length, reads = f.counts().sourceReads;
    const changed = clone(f.source); changed.revision++; f.memory.set(stateKey('InitialWorld'), JSON.stringify(changed));
    const result = await f.commit(); assert.equal(result.kind, 'Committed'); assert.equal(f.operations.length, before); assert.equal(f.counts().sourceReads, reads);
  }));
  await test('pending journal blocks new fork and ordinary directory mutations', () => withFixture(async f => {
    f.faults({ beforeRemove(key) { if (key === journalKey) throw new Error('cleanup denied'); } }); await f.commit();
    const count = f.operations.length;
    await assert.rejects(f.commit(), /事务尚未恢复/);
    await assert.rejects(f.storage.withDirectoryLock(accountId, () => f.storage.assertNoPending(accountId)), /事务尚未恢复/);
    assert.equal(f.operations.length, count);
  }));
  let crashPrefixes;
  await test('capture actual primitive durable prefixes for restart fault cases', () => withFixture(async f => {
    const before = new Map(f.memory); await f.commit(); crashPrefixes = [before, ...f.prefixes.map(prefix => prefix.memory)];
    assert.equal(crashPrefixes.length, 5);
  }));
  for (let stage = 0; stage < 5; stage++) {
    await test('fresh adapter restart after actual durable primitive stage ' + stage + ' resolves deterministically and idempotently', () => withFixture(async f => {
      const result = await f.recover(); const expected = stage === 0 || stage === 4 ? 'NoPending' : stage < 3 ? 'RolledBack' : 'Committed';
      assert.equal(result.kind, expected); assert.equal((await f.recover()).kind, 'NoPending');
      assert.equal(f.memory.has(journalKey), false); assert.equal(f.memory.has(stateKey(targetId)), stage >= 3);
      assert.equal(JSON.parse(f.memory.get(folderKey)).records.length, stage >= 3 ? 2 : 1); assert.equal(f.counts().sourceReads, 0); f.protect();
    }, { memory: new Map(crashPrefixes[stage]), sourceLease: false }));
  }
  await test('committed recovery succeeds without source lease or current source directory membership', () => withFixture(async f => {
    const modified = JSON.parse(f.memory.get(folderKey)); modified.records[0].deletedAt = epochMs + 2000; f.memory.set(folderKey, JSON.stringify(modified));
    const result = await f.recover(); assert.equal(result.kind, 'Committed'); assert.equal(f.counts().sourceReads, 0);
    assert.equal(f.memory.has(journalKey), false); assert.equal(JSON.parse(f.memory.get(folderKey)).records[0].deletedAt, epochMs + 2000); f.protect();
  }, { memory: new Map(crashPrefixes[3]), sourceLease: false }));
  await test('committed missing target is repaired only from validated journal by leased writer', () => withFixture(async f => {
    f.memory.delete(stateKey(targetId)); const result = await f.recover(); assert.equal(result.kind, 'Committed');
    assert.equal(f.counts().targetWrites, 1); assert.deepEqual(JSON.parse(f.memory.get(stateKey(targetId))), f.plan.targetState); f.protect();
  }, { memory: new Map(crashPrefixes[3]), sourceLease: false }));
  await test('recovery target lease absence rejects without journal or directory changes', () => withFixture(async f => {
    const before = new Map(f.memory); await assert.rejects(f.recover(), /target lease missing/); assert.deepEqual(f.memory, before);
  }, { memory: new Map(crashPrefixes[2]), sourceLease: false, targetLease: false }));
  await test('unpublished conflicting target bytes are retained and reported Pending; no foreign removal', () => withFixture(async f => {
    f.memory.set(stateKey(targetId), 'different original target'); const before = new Map(f.memory);
    const result = await f.recover(); assert.equal(result.kind, 'Pending'); assert.match(result.error, /JSON 损坏|不一致/);
    assert.deepEqual(f.memory, before); assert.equal(f.counts().targetDeletes, 0);
  }, { memory: new Map(crashPrefixes[2]), sourceLease: false }));
  await test('committed target modified after journal is a conflict, never silently repaired or erased', () => withFixture(async f => {
    const changed = JSON.parse(f.memory.get(stateKey(targetId))); changed.revision++; f.memory.set(stateKey(targetId), JSON.stringify(changed));
    const before = new Map(f.memory); await assert.rejects(f.recover(), /不一致/); assert.deepEqual(f.memory, before);
    assert.equal(f.counts().targetWrites, 0); assert.equal(f.counts().targetDeletes, 0);
  }, { memory: new Map(crashPrefixes[3]), sourceLease: false }));
  await test('conflicting or tombstoned target directory record preserves journal and all bytes', () => withFixture(async f => {
    const changed = JSON.parse(f.memory.get(folderKey)); changed.records[1].deletedAt = epochMs + 2000; f.memory.set(folderKey, JSON.stringify(changed));
    const before = new Map(f.memory); await assert.rejects(f.recover(), /目录记录与日志冲突/); assert.deepEqual(f.memory, before);
  }, { memory: new Map(crashPrefixes[3]), sourceLease: false }));
  for (const [name, bytes] of [['malformed JSON', '{'], ['JSON null', 'null'], ['wrong account', JSON.stringify({ schemaVersion: 1, kind: 'PendingWorldFork', accountId: 'another', plan: {} })],
    ['extra journal field', JSON.stringify({ schemaVersion: 1, kind: 'PendingWorldFork', accountId, plan: {}, extra: true })]]) {
    await test('strict pending reader preserves ' + name + ' without cleanup writes', () => withFixture(async f => {
      f.memory.set(journalKey, bytes); assert.throws(() => f.storage.readPending(accountId)); assert.equal(f.memory.get(journalKey), bytes);
      assert.equal(f.operations.length, 0);
    }));
  }
  await test('journal plan tampering of account or incomplete section rejects before mutations', () => withFixture(async f => {
    for (const mutate of [plan => { plan.accountId = 'another'; }, plan => { plan.targetState.sections.ChartScore = null; }]) {
      const bad = clone(f.plan); mutate(bad); await assert.rejects(f.commit(bad)); assert.equal(f.operations.length, 0);
    }
  }));
  await test('directory lock wrapper awaits operation completion, releases after rejection and prevents nested deadlock', () => withFixture(async f => {
    let release; const gate = new Promise(resolve => { release = resolve; }); let started;
    const begun = new Promise(resolve => { started = resolve; });
    const operation = f.storage.withDirectoryLock(accountId, async () => { started(); await gate;
      await assert.rejects(f.storage.withDirectoryLock(accountId, () => {}), /不可重入/); throw new Error('controlled operation rejection'); });
    await begun; assert(f.lock.active.has('neurou-world-folder:' + encodeURIComponent(accountId))); release();
    await assert.rejects(operation, /controlled operation rejection/);
    await f.storage.withDirectoryLock(accountId, () => f.storage.assertNoPending(accountId)); assert.equal(f.operations.length, 0);
  }));
  await test('reentrant target write callback cannot start another commit or replace journal', () => withFixture(async f => {
    f.faults({ afterTargetWrite() { assert.throws(() => f.storage.commitWorldFork(f.plan, f.folder), /不可重入/); } });
    await f.commit(); assert.equal(f.operations.filter(item => item.key === journalKey && item.operation === 'set').length, 1); f.protect();
  }));
  await test('shared directory lock serializes separate adapters and stale second writer cannot erase first fork', () => withFixture(async f => {
    const second = new WorldForkStorage(f.adapter, f.lock, f.bindings); let release; let entered;
    const gate = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { entered = resolve; });
    const first = f.storage.withDirectoryLock(accountId, async () => { entered(); await gate; return f.storage.commitWorldFork(f.plan, f.folder); });
    await began; let secondEntered = false;
    const later = second.withDirectoryLock(accountId, () => { secondEntered = true; return second.commitWorldFork(f.plan, f.folder); });
    await tick(); assert.equal(secondEntered, false); release(); assert.equal((await first).kind, 'Committed'); assert.equal((await later).kind, 'Committed');
    assert.equal(f.operations.filter(item => item.key === folderKey).length, 1); f.protect();
  }));
  fs.writeFileSync(path.join(__dirname, 'storage.contract-results.json'), JSON.stringify({ category: 'ContractTest',
    note: 'Actual WorldForkSession, full Primary codecs, WorldForkStorage and WorldCoreStateStorage; injected localStorage/Web Locks/clock fixtures, not production acceptance.',
    passed: results.length, failed: 0, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, failed: 0 }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'storage.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length,
    failed: 1, results, error: String(error.stack) }, null, 2) + '\n'); console.error(error); process.exitCode = 1;
});
