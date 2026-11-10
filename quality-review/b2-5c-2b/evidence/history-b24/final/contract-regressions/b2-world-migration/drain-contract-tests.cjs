'use strict';
// ContractAdapter fixtures use real production Core codecs, lease storage and drain issuer.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const h = require('../b2-cross-device-core/contract-test-helpers.cjs');
const { load, clone, accountId, sourceWorldId, aContext, bContext, epochMs, worldSource, folder, validateFolder,
  transferComplete: complete, ExclusiveLock } = h;
const { WorldMigrationCodec } = load('src/director/WorldMigration.ts');
const { SafePointDrainStorage, isLiveSafePointDrainCapability } = load('src/presentation/SafePointDrainStorage.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { WorldStateCodec, isValidatedWorldStateSnapshot } = load('src/director/WorldStateCodec.ts');
const { WorldClearStorage } = load('src/presentation/WorldClearStorage.ts');
const { AccountMilestoneStorage } = load('src/presentation/AccountMilestoneStorage.ts');
const { chartContentDigest } = load('src/director/ChartArchive.ts');
const { deriveRouteSignature, validateWorldClearRecord } = load('src/director/RouteSignature.ts');
const { deriveLedgerPosition } = load('src/ledger/deriveLedgerPosition.ts');
const codec = new WorldMigrationCodec(complete);
function clearRecord(state) {
  const ledger = state.sections.Ledger, completion = ledger.control.completionEventId;
  if (!completion || state.forkOrigin?.inheritedCompletionEventId === completion) return null;
  const events = ledger.characters.find(character => character.characterId === ledger.protagonistCharacterId).events;
  const index = events.findIndex(event => event.eventId === completion), event = events[index];
  return validateWorldClearRecord({ schemaVersion: 1, accountId: state.accountId, worldId: state.worldId, worldKind: 'Primary',
    protagonistCharacterId: ledger.protagonistCharacterId, ChartRef: event.ChartRef, contentRevision: ledger.contentRevision,
    completionEventId: completion, clearedAt: event.AppendedAt, routeSignature: deriveRouteSignature(deriveLedgerPosition(events.slice(0, index + 1))) }, state.accountId);
}
function createDrainFixture(options = {}) {
  const source = options.source || worldSource({ completed: options.completed, worldId: options.worldId, accountId: options.accountId }).state;
  const context = options.context || { accountId: source.accountId, deviceId: 'device-A' };
  const locks = options.locks || new ExclusiveLock(), values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const stateKey = world => 'neurou-world-state-v1:' + encodeURIComponent(context.accountId) + ':' + encodeURIComponent(world);
  const folderKey = 'neurou-world-folder-v1:' + encodeURIComponent(context.accountId);
  const recordKey = 'neurou-account-world-clears-v1:' + encodeURIComponent(context.accountId);
  const milestoneKey = 'neurou-account-first-world-cleared-v1:' + encodeURIComponent(context.accountId);
  const empty = { schemaVersion: 1, accountId: context.accountId, worldId: 'InitialWorld', worldKind: 'Unavailable', shoreOrigin: 'Unavailable',
    revision: 0, capturedAt: epochMs, kind: 'Core', sections: { Ledger: null, PuzzleProgress: null, FormatTime: { epochMs } } };
  storage.setItem(stateKey('InitialWorld'), JSON.stringify(empty)); storage.setItem(stateKey(source.worldId), JSON.stringify(source));
  storage.setItem(folderKey, JSON.stringify(options.folder || folder(['InitialWorld', source.worldId], context.accountId)));
  const record = clearRecord(source), records = options.records || (record ? [record] : []);
  storage.setItem(recordKey, JSON.stringify({ schemaVersion: 1, accountId: context.accountId, records }));
  storage.setItem(milestoneKey, JSON.stringify({ schemaVersion: 1, accountId: context.accountId, FirstWorldCleared: options.FirstWorldCleared ?? records.length > 0 }));
  const validateCore = (raw, account, world) => raw?.worldKind === 'Unavailable' ? new WorldStateCodec().parse(raw, account, world) : complete(raw, account, world);
  const core = new WorldCoreStateStorage(storage, locks, validateCore, (account, world) => account === context.accountId &&
    validateFolder(JSON.parse(storage.getItem(folderKey)), context.accountId).records.some(item => item.worldId === world && item.deletedAt === null));
  const clears = new WorldClearStorage(storage, locks), milestones = new AccountMilestoneStorage(storage);
  const flags = { admissionClosed: false, active: false, pending: false, holdCount: 0, releaseCount: 0, id: 0 };
  const bindings = { context,
    holdAdmission: () => { if (flags.admissionClosed) throw Error('already held'); flags.admissionClosed = true; flags.holdCount++;
      return { assertClosed: () => { if (!flags.admissionClosed) throw Error('source admission reopened'); },
        release: () => { flags.admissionClosed = false; flags.releaseCount++; } }; },
    assertRuntimeSafe: () => { if (flags.active) throw Error('UnsupportedBoundary: active chart/reveal/runtime'); },
    assertNoPendingTransactions: () => { if (flags.pending) throw Error('pending import/fork/account intent'); },
    readFolder: () => JSON.parse(storage.getItem(folderKey)), validateFolder,
    readCore: world => core.readCoreState(context.accountId, world), validateCore,
    readAccountFacts: () => ({ records: clears.readWorldClearRecords(context.accountId),
      FirstWorldCleared: milestones.readProjection(context.accountId)?.FirstWorldCleared ?? false }),
    acquireWorldLease: world => core.acquireWorldLease(context.accountId, world, true),
    hasWorldLease: world => core.hasWorldLease(context.accountId, world), digest: chartContentDigest,
    validateConfirmation: raw => codec.parseConfirmation(raw, context), createDrainId: () => 'drain-contract-' + ++flags.id,
  };
  const drain = new SafePointDrainStorage(bindings, options.noLocks ? null : locks);
  const payload = codec.parsePayload({ schemaVersion: 1, kind: 'RestrictedMigrationCore', migrationId: options.migrationId || 'migration-contract-1',
    sourceDeviceId: context.deviceId, expectedHomeRevision: options.expectedHomeRevision || 1,
    record: bindings.readFolder().records.find(item => item.worldId === source.worldId), state: clone(source) });
  return { source, context, locks, values, storage, stateKey, folderKey, recordKey, milestoneKey, flags, core, clears, milestones,
    bindings, drain, payload, codec, mutateCore: world => { const raw = core.readCoreState(context.accountId, world); raw.revision++;
      storage.setItem(stateKey(world), JSON.stringify(raw)); } };
}
const cases = [];
async function test(name, body) {
  const started = performance.now();
  try { await body(); cases.push({ name, category: 'ContractAdapter', result: 'PASS', elapsedMs: Math.round((performance.now() - started) * 1000) / 1000 }); }
  catch (error) { cases.push({ name, category: 'ContractAdapter', result: 'FAIL', error: String(error), stack: error.stack }); }
}
async function run() {
  await test('D01 drain includes actual leased InitialWorld and source; JSON round-trip reacquires strict confirmation', async () => {
    const f = createDrainFixture(), before = [...f.values]; let issued;
    await f.drain.withDrain(async capability => {
      issued = capability; assert(isLiveSafePointDrainCapability(capability)); capability.assertCurrent();
      assert.deepEqual(clone(codec.parseConfirmation(JSON.parse(JSON.stringify(capability.confirmation)), f.context)), clone(capability.confirmation));
      assert.deepEqual(capability.confirmation.worlds.map(world => world.worldId), ['InitialWorld', f.source.worldId]);
      assert(f.core.hasWorldLease(f.context.accountId, 'InitialWorld')); assert(f.core.hasWorldLease(f.context.accountId, f.source.worldId));
      assert(!f.locks.active.has('neurou-world-folder:' + encodeURIComponent(f.context.accountId)), 'service await cannot hold directory lock');
      assert(f.locks.active.has('neurou-world-clear:' + encodeURIComponent(f.context.accountId))); assert(f.flags.admissionClosed);
    });
    assert(!isLiveSafePointDrainCapability(issued)); assert.throws(() => issued.assertCurrent(), /撤销|消费/);
    assert.equal(f.flags.releaseCount, 1); assert.deepEqual([...f.values], before);
  });
  await test('D02 arbitrary serialized/assertCurrent object cannot become production drain capability', () => {
    assert(!isLiveSafePointDrainCapability({ confirmation: {}, assertCurrent() {}, revoke() {} })); assert(!isLiveSafePointDrainCapability(null));
  });
  await test('D03 unsafe active runtime refuses without stopping media, acquiring leases or changing files', async () => {
    const f = createDrainFixture(); f.flags.active = true; const before = [...f.values]; let called = false;
    await assert.rejects(f.drain.withDrain(async () => { called = true; }), /UnsupportedBoundary/);
    assert(!called); assert(f.flags.active); assert.equal(f.flags.releaseCount, 1); assert.deepEqual([...f.values], before);
  });
  await test('D04 pending transactions reject confirmation and leave persistent bytes unchanged', async () => {
    const f = createDrainFixture(); f.flags.pending = true; const before = [...f.values];
    await assert.rejects(f.drain.withDrain(async () => {}), /pending/); assert.deepEqual([...f.values], before);
  });
  await test('D05 actual retained account commit makes source lease unavailable until promise settles', async () => {
    const f = createDrainFixture(); const lease = await f.core.acquireWorldLease(f.context.accountId, f.source.worldId, true);
    let settle; const pending = new Promise(resolve => { settle = resolve; }); lease.retainUntil(pending); lease.release();
    assert(f.core.hasWorldLease(f.context.accountId, f.source.worldId));
    await assert.rejects(f.drain.withDrain(async () => {}), /持有|取得/); settle(); await pending; await Promise.resolve();
    await f.drain.withDrain(async capability => capability.assertCurrent());
  });
  await test('D06 missing real lease fails despite a readable Complete Core', async () => {
    const f = createDrainFixture(), drain = new SafePointDrainStorage({ ...f.bindings, hasWorldLease: () => false }, f.locks);
    await assert.rejects(drain.withDrain(async () => {}), /真实独占/);
  });
  await test('D07 empty newly created world participates in full account drain', async () => {
    const f = createDrainFixture(), emptyId = 'world-20000000-0000-4000-8000-000000000008', empty = clone(f.core.readCoreState(f.context.accountId, 'InitialWorld'));
    empty.worldId = emptyId; f.storage.setItem(f.stateKey(emptyId), JSON.stringify(empty));
    const next = f.bindings.readFolder(); next.records.push({ worldId: emptyId, title: '未进入世界', description: '', createdAt: epochMs, deletedAt: null, template: 'EmptyWorld' });
    f.storage.setItem(f.folderKey, JSON.stringify(next)); await f.drain.withDrain(async capability => assert.equal(capability.confirmation.worlds.length, 3));
  });
  await test('D08 noninherited completed Ledger without account record rejects as unsettled', async () => {
    const f = createDrainFixture({ records: [], FirstWorldCleared: false });
    await assert.rejects(f.drain.withDrain(async () => {}), /未提交的账号/);
  });
  await test('D09 durable clear record without settled FirstWorldCleared projection rejects', async () => {
    const f = createDrainFixture({ FirstWorldCleared: false }); await assert.rejects(f.drain.withDrain(async () => {}), /投影尚未结算/);
  });
  await test('D10 a real inherited fork completion needs no duplicate account fact', async () => {
    const f = createDrainFixture(), { rebaseWorldState } = load('src/director/WorldForkSession.ts');
    const target = 'world-20000000-0000-4000-8000-000000000099';
    const origin = { schemaVersion: 1, accountId, targetWorldId: target, sourceWorldId: f.source.worldId, sourceRevision: f.source.revision,
      sourceCapturedAt: f.source.capturedAt, protagonistCharacterId: f.source.sections.Ledger.protagonistCharacterId,
      transactionId: 'import-20000000-0000-4000-8000-000000000088', forkedAt: epochMs + 999,
      inheritedCompletionEventId: f.source.sections.Ledger.control.completionEventId };
    const source = rebaseWorldState(f.source, target, origin, complete), inherited = createDrainFixture({ source, records: [], FirstWorldCleared: false });
    await inherited.drain.withDrain(async capability => capability.assertCurrent());
  });
  await test('D11 content change, directory change and reopened source admission each revoke current proof', async () => {
    for (const mutate of [f => f.mutateCore(f.source.worldId), f => { const next = f.bindings.readFolder(); next.records[1].title += ' changed'; f.storage.setItem(f.folderKey, JSON.stringify(next)); },
      f => { f.flags.admissionClosed = false; }, f => { f.flags.pending = true; }, f => { f.flags.active = true; }]) {
      const f = createDrainFixture(); await f.drain.withDrain(async capability => { mutate(f); assert.throws(() => capability.assertCurrent()); });
    }
  });
  await test('D12 callback rejection revokes capability and releases every lease and admission gate', async () => {
    const f = createDrainFixture(); let cap; await assert.rejects(f.drain.withDrain(async capability => { cap = capability; throw Error('release response lost'); }), /response lost/);
    assert(!isLiveSafePointDrainCapability(cap)); assert(!f.flags.admissionClosed);
    assert(!f.core.hasWorldLease(f.context.accountId, f.source.worldId)); assert(!f.core.hasWorldLease(f.context.accountId, 'InitialWorld'));
  });
  await test('D13 no Web Locks and drain reentrancy are explicit failures', async () => {
    const no = createDrainFixture({ noLocks: true }); await assert.rejects(no.drain.withDrain(async () => {}), /Web Locks/);
    const f = createDrainFixture(); await f.drain.withDrain(async () => assert.rejects(f.drain.withDrain(async () => {}), /重入/));
  });
  await test('D14 account facts mutation after confirmation invalidates capability', async () => {
    const f = createDrainFixture(); await f.drain.withDrain(async cap => {
      f.storage.setItem(f.recordKey, JSON.stringify({ schemaVersion: 1, accountId: f.context.accountId, records: [] })); assert.throws(() => cap.assertCurrent(), /未提交|变化/);
    });
  });
  await test('D15 Core transport stays unbranded, byte-equivalent and preserves revision/FormatTime/forkOrigin', () => {
    const f = createDrainFixture(), payload = codec.parsePayload(JSON.parse(JSON.stringify(f.payload)));
    assert(!isValidatedWorldStateSnapshot(payload.state)); assert(isValidatedWorldStateSnapshot(complete(payload.state, f.context.accountId, f.source.worldId)));
    assert.equal(chartContentDigest(payload.state), chartContentDigest(f.source)); assert.equal(payload.state.revision, f.source.revision);
    assert.deepEqual(clone(payload.state.sections.FormatTime), clone(f.source.sections.FormatTime));
    assert.equal(payload.state.forkOrigin, f.source.forkOrigin);
  });
  await test('D16 payload rejects InitialWorld, permission/account facts, wrong versions, getters and noncertifying validators', () => {
    const f = createDrainFixture(); for (const change of [{ schemaVersion: 2 }, { kind: 'FileCarryPayload' }, { CopyPermission: true }, { FirstWorldCleared: true }]) assert.throws(() => codec.parsePayload({ ...f.payload, ...change }));
    const initial = clone(f.payload); initial.state.worldId = 'InitialWorld'; assert.throws(() => codec.parsePayload(initial), /InitialWorld/);
    let read = 0; const bad = { ...f.payload }; Object.defineProperty(bad, 'state', { enumerable: true, get() { read++; return f.source; } });
    assert.throws(() => codec.parsePayload(bad)); assert.equal(read, 0);
    assert.throws(() => new WorldMigrationCodec(raw => raw).parsePayload(f.payload), /认证/);
  });
  await test('D17 confirmation strict schema rejects missing worlds, unsorted duplicates, forged digest and foreign account', async () => {
    const f = createDrainFixture(); await f.drain.withDrain(async cap => {
      const conf = clone(cap.confirmation);
      for (const change of [{ worlds: [] }, { worlds: [...conf.worlds].reverse() }, { worlds: [...conf.worlds, conf.worlds[1]] },
        { directoryDigest: 'fake' }, { accountId: 'other-account' }, { schemaVersion: 2 }, { bootId: 'invented' }]) assert.throws(() => codec.parseConfirmation({ ...conf, ...change }, f.context));
      const acceptance = { schemaVersion: 1, confirmation: conf, acceptedAtServerEpochMs: epochMs, expiresAtServerEpochMs: epochMs + 30000 };
      assert.equal(codec.parseDrainAcceptance(acceptance, conf).expiresAtServerEpochMs, epochMs + 30000);
      assert.throws(() => codec.parseDrainAcceptance({ ...acceptance, expiresAtServerEpochMs: epochMs + 30001 }));
    });
  });
  await test('D18 service pause schema requires at least OfflineGrace and no local time fields', () => {
    const pause = { schemaVersion: 1, accountId, migrationId: 'migration-contract-1', initiatingDeviceId: aContext.deviceId,
      startedAtServerEpochMs: epochMs, resumeNotBeforeServerEpochMs: epochMs + 3600000, endedAtServerEpochMs: null };
    assert.deepEqual(clone(codec.parsePause(pause, accountId)), pause);
    assert.throws(() => codec.parsePause({ ...pause, resumeNotBeforeServerEpochMs: epochMs + 3599999 }));
    assert.throws(() => codec.parsePause({ ...pause, endedAtServerEpochMs: epochMs + 3599999 }));
    assert.throws(() => codec.parsePause({ ...pause, clientEpochMs: epochMs }));
    assert.throws(() => codec.parseDeviceBinding({ schemaVersion: 1, deviceId: aContext.deviceId, boundAccountId: accountId,
      migrationId: 'different', pause }));
  });
  await test('D19 receipt phases enforce same identity and exact homeRevision transitions', () => {
    const f = createDrainFixture(), pause = { schemaVersion: 1, accountId, migrationId: f.payload.migrationId, initiatingDeviceId: f.context.deviceId,
      startedAtServerEpochMs: epochMs, resumeNotBeforeServerEpochMs: epochMs + 3600000, endedAtServerEpochMs: null };
    const receipt = { schemaVersion: 1, accountId, migrationId: f.payload.migrationId, worldId: f.source.worldId, sourceDeviceId: f.context.deviceId,
      claimDeviceId: null, expectedHomeRevision: 1, kind: 'PauseActive', record: { schemaVersion: 1, accountId, worldId: f.source.worldId,
        homeState: 'Homed', homeDeviceId: f.context.deviceId, homeRevision: 1, updatedAtServerEpochMs: epochMs }, pause, observedAtServerEpochMs: epochMs };
    codec.parseReceipt(receipt, f.payload); assert.throws(() => codec.parseReceipt({ ...receipt, observedAtServerEpochMs: pause.resumeNotBeforeServerEpochMs }));
    const released = { ...receipt, kind: 'Released', record: { ...receipt.record, homeState: 'Released', homeDeviceId: null, homeRevision: 2,
      updatedAtServerEpochMs: pause.resumeNotBeforeServerEpochMs }, pause: { ...pause, endedAtServerEpochMs: pause.resumeNotBeforeServerEpochMs }, observedAtServerEpochMs: pause.resumeNotBeforeServerEpochMs };
    codec.parseReceipt(released, f.payload);
    const claimed = { ...released, kind: 'Claimed', claimDeviceId: bContext.deviceId, record: { ...released.record, homeState: 'Homed', homeDeviceId: bContext.deviceId, homeRevision: 3 } };
    codec.parseReceipt(claimed, f.payload); assert.throws(() => codec.parseReceipt({ ...claimed, record: { ...claimed.record, homeRevision: 4 } }));
    const journal = { schemaVersion: 1, kind: 'WorldMigrationJournal', ...f.context, entries: [{ role: 'Source', phase: 'Claimed', payload: f.payload, receipt: claimed }] };
    codec.parseJournal(journal); assert.throws(() => codec.parseJournal({ ...journal, entries: [{ ...journal.entries[0], phase: 'LocalPublished' }] }));
    assert.throws(() => codec.parseJournal({ ...journal, entries: [journal.entries[0], journal.entries[0]] }));
  });
  await test('D20 a failed live check consumes confirmation even if changed bytes are restored', async () => {
    const f = createDrainFixture(); await f.drain.withDrain(async cap => {
      const old = f.storage.getItem(f.stateKey(f.source.worldId)); f.mutateCore(f.source.worldId);
      assert.throws(() => cap.assertCurrent(), /变化/); assert(!isLiveSafePointDrainCapability(cap));
      f.storage.setItem(f.stateKey(f.source.worldId), old); assert.throws(() => cap.assertCurrent(), /撤销|消费/);
    });
  });
  const report = { mode: 'ContractAdapter', passed: cases.filter(value => value.result === 'PASS').length, failed: cases.filter(value => value.result === 'FAIL').length, cases };
  fs.writeFileSync(path.join(__dirname, 'drain-contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2)); if (report.failed) process.exitCode = 1; return report;
}
module.exports = { createDrainFixture, clearRecord, codec, run };
if (require.main === module) void run().catch(error => { console.error(error); process.exitCode = 1; });
