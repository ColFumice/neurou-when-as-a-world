'use strict';
// Shared persistent ContractAdapter authority and real SafePointDrainStorage issuer.
// These fixtures never seed the Creator preview profile or emulate external authentication.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const h = require('../b2-cross-device-core/contract-test-helpers.cjs');
const { load, clone, accountId, sourceWorldId, otherWorldId, aContext, bContext, worldSource, folder, validateFolder,
  homeCodec, transferComplete: complete, ExclusiveLock, epochMs } = h;
const { WorldMigrationCodec } = load('src/director/WorldMigration.ts');
const { WorldMigrationContractAdapter } = load('src/presentation/WorldMigrationContractAdapter.ts');
const { SafePointDrainStorage, isLiveSafePointDrainCapability } = load('src/presentation/SafePointDrainStorage.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { WorldStateCodec } = load('src/director/WorldStateCodec.ts');
const { chartContentDigest } = load('src/director/ChartArchive.ts');
const codec = new WorldMigrationCodec(complete), serviceKey = 'neurou-migration-contract-authority-v1';
class MemoryStorage {
  constructor() { this.values = new Map(); this.writes = 0; this.failBefore = false; this.failAfter = false; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.failBefore) { this.failBefore = false; throw Error('injected service commit failure'); }
    this.values.set(key, value); this.writes++;
    if (this.failAfter) { this.failAfter = false; throw Error('injected response loss after durable service commit'); }
  }
}
function fixture(options = {}) {
  let serviceEpochMs = epochMs, drainCounter = 0;
  const storage = options.storage || new MemoryStorage(), locks = options.locks || new ExclusiveLock();
  const source = worldSource({ completed: false }).state;
  const bindings = { storage, locks: options.noLocks ? null : locks, serviceNow: () => serviceEpochMs,
    offlineGraceMs: options.offlineGraceMs ?? 3600000,
    parseContext: raw => homeCodec.parseContext(raw), parseRegistrationRequest: raw => homeCodec.parseRegistrationRequest(raw),
    parseRegistry: (raw, account) => homeCodec.parseSnapshot(raw, account),
    parseRegistrationReply: (raw, context, request) => homeCodec.parseRegistrationReply(raw, context, request),
    parseConfirmation: (raw, context) => codec.parseConfirmation(raw, context),
    parseDrainAcceptance: (raw, confirmation) => codec.parseDrainAcceptance(raw, confirmation),
    parseReleaseRequest: raw => codec.parseReleaseRequest(raw), parseClaimRequest: raw => codec.parseClaimRequest(raw),
    parsePause: (raw, account) => codec.parsePause(raw, account), parseDeviceBinding: (raw, device) => codec.parseDeviceBinding(raw, device),
    parsePayload: raw => codec.parsePayload(raw), parseReceipt: (raw, payload) => codec.parseReceipt(raw, payload),
    parseAdmission: (raw, context, world) => codec.parseAdmission(raw, context, world),
    verifyDrainCapability: isLiveSafePointDrainCapability, digestState: chartContentDigest };
  const authority = new WorldMigrationContractAdapter(bindings), a = authority.bindDevice(aContext), b = authority.bindDevice(bContext);
  function payload(context = aContext, revision = 1, migrationId = 'migration-authority-1') {
    return codec.parsePayload({ schemaVersion: 1, kind: 'RestrictedMigrationCore', migrationId,
      sourceDeviceId: context.deviceId, expectedHomeRevision: revision,
      record: folder([sourceWorldId]).records[0], state: clone(source) });
  }
  async function drain(context, operation, sourceOverride = source) {
    const coreStorageValues = new MemoryStorage(), leaseStorage = new WorldCoreStateStorage(coreStorageValues, locks,
      (raw, account, world) => raw.worldKind === 'Unavailable' ? new WorldStateCodec().parse(raw, account, world) : complete(raw, account, world),
      () => true);
    const empty = world => ({ schemaVersion: 1, kind: 'Core', accountId: context.accountId, worldId: world,
      worldKind: 'Unavailable', shoreOrigin: 'Unavailable', revision: 0, capturedAt: epochMs,
      sections: { Ledger: null, PuzzleProgress: null, FormatTime: { epochMs } } });
    for (const state of [empty('InitialWorld'), sourceOverride, empty(otherWorldId)]) {
      // Controlled past durable state, not a production write/import. The drain
      // itself acquires genuine storage leases and validates every value again.
      coreStorageValues.setItem('neurou-world-state-v1:' + encodeURIComponent(context.accountId) + ':' +
        encodeURIComponent(state.worldId), JSON.stringify(state));
    }
    let closed = false;
    const drainer = new SafePointDrainStorage({ context,
      holdAdmission: () => { closed = true; return { assertClosed: () => assert(closed), release: () => { closed = false; } }; },
      assertRuntimeSafe: () => {}, assertNoPendingTransactions: () => {},
      readFolder: () => folder(['InitialWorld', sourceWorldId, otherWorldId], context.accountId), validateFolder,
      readCore: world => leaseStorage.readCoreState(context.accountId, world),
      validateCore: (raw, account, world) => raw.worldKind === 'Unavailable' ? new WorldStateCodec().parse(raw, account, world) : complete(raw, account, world),
      readAccountFacts: () => ({ records: [], FirstWorldCleared: false }),
      acquireWorldLease: world => leaseStorage.acquireWorldLease(context.accountId, world, true),
      hasWorldLease: world => leaseStorage.hasWorldLease(context.accountId, world), digest: chartContentDigest,
      validateConfirmation: raw => codec.parseConfirmation(raw, context), createDrainId: () => 'drain-authority-' + ++drainCounter }, locks);
    return drainer.withDrain(capability => operation(capability, coreStorageValues));
  }
  async function register() {
    await a.registerWorldHome({ schemaVersion: 1, worldId: sourceWorldId, registrationId: 'register-source' });
    await a.registerWorldHome({ schemaVersion: 1, worldId: otherWorldId, registrationId: 'register-other' });
  }
  async function release(context = aContext, revision = 1, migrationId = 'migration-authority-1') {
    const port = authority.bindDevice(context), value = payload(context, revision, migrationId);
    return drain(context, async capability => {
      await port.acceptDrain(capability);
      const request = codec.parseReleaseRequest({ schemaVersion: 1, migrationId, worldId: sourceWorldId,
        expectedHomeRevision: revision, drainId: capability.confirmation.drainId });
      return { receipt: await port.releaseMigration(request, value), request, payload: value };
    });
  }
  const claim = (migrationId = 'migration-authority-1', revision = 2) => ({ schemaVersion: 1, migrationId,
    worldId: sourceWorldId, expectedHomeRevision: revision });
  return { authority, bindings, storage, locks, source, a, b, register, payload, drain, release, claim,
    setServerTime: value => { serviceEpochMs = value; }, advance: value => { serviceEpochMs += value; }, now: () => serviceEpochMs };
}
const results = [];
async function test(name, operation) {
  try { await operation(); results.push({ name, category: 'ContractAdapter', result: 'PASS' }); }
  catch (error) { results.push({ name, category: 'ContractAdapter', result: 'FAIL', error: String(error), stack: error.stack }); }
}
async function main() {
  await test('A01 source release → 1h RealityPause → service Released → same-ID target Claim', async () => {
    const f = fixture(); await f.register(); const before = JSON.stringify(f.source), r = await f.release();
    assert.equal(r.receipt.kind, 'PauseActive'); assert.equal(r.receipt.record.homeRevision, 1);
    assert.equal(r.receipt.pause.resumeNotBeforeServerEpochMs - r.receipt.pause.startedAtServerEpochMs, 3600000);
    await assert.rejects(f.b.claimMigration(f.claim()), /RealityPause/);
    f.advance(3600000); const released = await f.b.readMigration(r.payload.migrationId);
    assert.equal(released.kind, 'Released'); assert.equal(released.record.homeRevision, 2);
    const claimed = await f.b.claimMigration(f.claim()); assert.equal(claimed.kind, 'Claimed');
    assert.equal(claimed.record.homeRevision, 3); assert.equal(claimed.record.homeDeviceId, bContext.deviceId);
    assert.equal(claimed.worldId, sourceWorldId); assert.equal(JSON.stringify(f.source), before);
    assert.deepEqual(await f.b.readMigrationPayload(r.payload.migrationId), r.payload);
  });
  await test('A02 every device and world including InitialWorld and unknown world rejects while account paused', async () => {
    const f = fixture(); await f.register(); await f.release();
    const devices = [f.a, f.b, f.authority.bindDevice({ accountId, deviceId: 'device-C' })];
    for (const port of devices) for (const world of [undefined, 'InitialWorld', sourceWorldId, otherWorldId, 'world-unknown']) {
      assert.equal((await port.readAdmission(world)).kind, 'PauseActive');
      assert.throws(() => f.authority.assertAdmissionNow(port.context, world), /PauseActive/);
    }
    await assert.rejects(f.b.registerWorldHome({ schemaVersion: 1, worldId: 'world-new', registrationId: 'new' }), /PauseActive/);
  });
  await test('A03 client Date.now rollback or advance cannot end service pause', async () => {
    const f = fixture(); await f.register(); await f.release(); const old = Date.now;
    try { Date.now = () => Number.MAX_SAFE_INTEGER; assert.equal((await f.b.readAdmission('InitialWorld')).kind, 'PauseActive');
      Date.now = () => 0; await assert.rejects(f.b.claimMigration(f.claim()), /RealityPause/); }
    finally { Date.now = old; }
    assert.equal((await f.a.readMigration('migration-authority-1')).kind, 'PauseActive');
  });
  await test('A04 exact cutoff is server-owned; sync final-write guard never computes local expiry', async () => {
    const f = fixture(); await f.register(); await f.release(); f.advance(3599999);
    assert.equal((await f.b.readAdmission()).kind, 'PauseActive'); f.advance(1);
    assert.throws(() => f.authority.assertAdmissionNow(bContext), /PauseActive/);
    assert.equal((await f.b.readAdmission()).kind, 'Allowed'); f.authority.assertAdmissionNow(bContext);
    assert.equal((await f.a.readMigration('migration-authority-1')).kind, 'Released');
  });
  await test('A05 RealityPause never shorter than injected OfflineGrace', async () => {
    const f = fixture({ offlineGraceMs: 7200000 }); await f.register(); const r = await f.release();
    assert.equal(r.receipt.pause.resumeNotBeforeServerEpochMs - r.receipt.pause.startedAtServerEpochMs, 7200000);
    f.advance(3600000); assert.equal((await f.b.readAdmission()).kind, 'PauseActive');
    f.advance(3600000); assert.equal((await f.b.readMigration(r.payload.migrationId)).kind, 'Released');
  });
  await test('A06 device account binding covers another window, reconstructed adapter and alternate login account', async () => {
    const f = fixture(); await f.register(); await f.release(); const rebuilt = new WorldMigrationContractAdapter(f.bindings);
    const foreign = { accountId: 'alternate-account', deviceId: aContext.deviceId };
    await assert.rejects(rebuilt.checkDeviceAccount(foreign), /DeviceAccountBinding/);
    await assert.rejects(rebuilt.bindDevice(foreign).readRegistry(), /DeviceAccountBinding/);
    assert.throws(() => rebuilt.assertAdmissionNow(foreign), /DeviceAccountBinding/);
    const binding = await rebuilt.checkDeviceAccount(aContext); assert.equal(binding.boundAccountId, accountId);
    assert.equal(binding.pause.endedAtServerEpochMs, null);
    assert.equal((await rebuilt.bindDevice(bContext).readAdmission('InitialWorld')).kind, 'PauseActive');
    f.advance(3600000); assert.equal((await rebuilt.checkDeviceAccount(foreign)).boundAccountId, null);
  });
  await test('A07 unrelated account on another device remains available', async () => {
    const f = fixture(); await f.register(); await f.release();
    const other = f.authority.bindDevice({ accountId: 'another-account', deviceId: 'device-C' });
    assert.equal((await other.readAdmission('InitialWorld')).kind, 'Allowed');
    assert.equal((await other.registerWorldHome({ schemaVersion: 1, worldId: 'world-other-account', registrationId: 'other' })).kind, 'Registered');
  });
  await test('A08 serialized or self-issued SafePoint capability is rejected', async () => {
    const f = fixture(); await f.register();
    await assert.rejects(f.a.acceptDrain({ confirmation: {}, assertCurrent() {}, revoke() {} }), /真实持锁/);
    await f.drain(aContext, async cap => {
      await assert.rejects(f.a.acceptDrain(clone(cap.confirmation)), /真实持锁/);
      assert(isLiveSafePointDrainCapability(cap)); const response = await f.a.acceptDrain(cap);
      assert.deepEqual(response.confirmation, cap.confirmation); assert.equal(response.expiresAtServerEpochMs - response.acceptedAtServerEpochMs, 30000);
    });
  });
  await test('A09 revoked capability cannot Release; source must actively drain again', async () => {
    const f = fixture(); await f.register(); let request;
    await f.drain(aContext, async cap => { await f.a.acceptDrain(cap); request = { schemaVersion: 1, migrationId: 'migration-authority-1',
      worldId: sourceWorldId, expectedHomeRevision: 1, drainId: cap.confirmation.drainId }; });
    await assert.rejects(f.a.releaseMigration(request, f.payload()), /排空确认/);
    assert.equal(await f.b.readMigration('migration-authority-1'), null);
  });
  await test('A10 30-second service TTL expires exactly at cutoff', async () => {
    const f = fixture(); await f.register();
    await f.drain(aContext, async cap => { await f.a.acceptDrain(cap); f.advance(30000);
      await assert.rejects(f.a.releaseMigration({ schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId }, f.payload()), /过期/); });
    assert.equal(await f.a.readMigration('migration-authority-1'), null);
  });
  await test('A11 reconstructed service cannot revive an unconsumed live drain acceptance', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async cap => {
      await f.a.acceptDrain(cap); const rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(aContext);
      await assert.rejects(rebuilt.releaseMigration({ schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId }, f.payload()), /排空确认/);
    });
  });
  await test('A12 Release checks current source Core again and never accepts a stale confirmation', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async (cap, sourceStorage) => {
      await f.a.acceptDrain(cap); const key = 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(sourceWorldId);
      const changed = JSON.parse(sourceStorage.getItem(key)); changed.revision++; sourceStorage.setItem(key, JSON.stringify(changed));
      await assert.rejects(f.a.releaseMigration({ schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId }, f.payload()), /排空后/);
    });
    assert.equal(await f.a.readMigration('migration-authority-1'), null);
  });
  await test('A13 migration payload must match the drain-confirmed revision and full digest', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async cap => {
      await f.a.acceptDrain(cap); const payload = clone(f.payload()); payload.state.revision++;
      await assert.rejects(f.a.releaseMigration({ schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId }, payload), /精确世界状态/);
    });
  });
  await test('A14 exact Release replay does not restart pause and survives service reconstruction', async () => {
    const f = fixture(); await f.register(); const r = await f.release(); f.advance(100);
    const rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(aContext), retry = await rebuilt.releaseMigration(r.request, r.payload);
    assert.equal(retry.pause.startedAtServerEpochMs, r.receipt.pause.startedAtServerEpochMs);
    assert.equal(retry.pause.resumeNotBeforeServerEpochMs, r.receipt.pause.resumeNotBeforeServerEpochMs);
    const changed = clone(r.payload); changed.state.revision++; await assert.rejects(rebuilt.releaseMigration(r.request, changed), /已绑定/);
  });
  await test('A15 failed durable Release leaves home, pause and binding unchanged and acceptance unconsumed', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async cap => {
      await f.a.acceptDrain(cap); const before = f.storage.getItem(serviceKey), request = { schemaVersion: 1, migrationId: 'migration-authority-1',
        worldId: sourceWorldId, expectedHomeRevision: 1, drainId: cap.confirmation.drainId };
      f.storage.failBefore = true; await assert.rejects(f.a.releaseMigration(request, f.payload()), /commit failure/);
      assert.equal(f.storage.getItem(serviceKey), before); assert.equal((await f.a.releaseMigration(request, f.payload())).kind, 'PauseActive');
    });
  });
  await test('A16 response lost after durable Release recovers by exact replay without live capability', async () => {
    const f = fixture(); await f.register(); let request;
    await f.drain(aContext, async cap => { await f.a.acceptDrain(cap); request = { schemaVersion: 1, migrationId: 'migration-authority-1',
      worldId: sourceWorldId, expectedHomeRevision: 1, drainId: cap.confirmation.drainId };
      f.storage.failAfter = true; await assert.rejects(f.a.releaseMigration(request, f.payload()), /response loss/); });
    const rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(aContext);
    assert.equal((await rebuilt.releaseMigration(request, f.payload())).kind, 'PauseActive');
    assert.equal((await rebuilt.readDeviceBinding()).boundAccountId, accountId);
  });
  await test('A17 wrong source, cross-account payload, wrong home revision and InitialWorld fail before pause', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async cap => {
      await f.a.acceptDrain(cap); const request = { schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId };
      await assert.rejects(f.b.releaseMigration(request, f.payload()), /绑定身份/);
      await assert.rejects(f.a.releaseMigration({ ...request, expectedHomeRevision: 2 }, f.payload(aContext, 2)), /HomeDevice|Revision/);
      await assert.rejects(f.a.releaseMigration({ ...request, worldId: 'InitialWorld' }, f.payload()), /InitialWorld/);
      const wrongAccount = clone(f.payload()); wrongAccount.state.accountId = 'wrong-account'; await assert.rejects(f.a.releaseMigration(request, wrongAccount));
    }); assert.equal(await f.a.readMigration('migration-authority-1'), null);
  });
  await test('A18 missing migration is null; unavailable, missing Web Locks and corrupt schema are explicit refusal', async () => {
    const f = fixture(); assert.equal(await f.b.readMigration('missing'), null); assert.equal(await f.b.readMigrationPayload('missing'), null);
    f.authority.setAvailable(false); await assert.rejects(f.b.readAdmission(), /不可用/); assert.throws(() => f.authority.assertAdmissionNow(bContext), /不可用/);
    const noLocks = fixture({ noLocks: true }); await assert.rejects(noLocks.a.readRegistry(), /Web Locks/);
    f.authority.setAvailable(true); f.storage.setItem(serviceKey, '{broken'); await assert.rejects(f.b.readAdmission(), /JSON/);
    f.storage.setItem(serviceKey, JSON.stringify({ schemaVersion: 2 })); await assert.rejects(f.b.readAdmission(), /字段|schema/);
  });
  await test('A19 service clock rollback rejects without advancing or changing any durable authority', async () => {
    const f = fixture(); await f.register(); await f.release(); const before = f.storage.getItem(serviceKey);
    f.setServerTime(epochMs - 1); await assert.rejects(f.b.readMigration('migration-authority-1'), /服务时间/); assert.equal(f.storage.getItem(serviceKey), before);
    f.setServerTime(NaN); await assert.rejects(f.b.readAdmission(), /服务时间/);
  });
  await test('A20 Released ownership cannot be stolen by ordinary register or incorrect Claim revision', async () => {
    const f = fixture(); await f.register(); await f.release(); f.advance(3600000); await f.b.readMigration('migration-authority-1');
    await assert.rejects(f.b.registerWorldHome({ schemaVersion: 1, worldId: sourceWorldId, registrationId: 'steal' }), /MigrationClaim/);
    await assert.rejects(f.b.claimMigration(f.claim('migration-authority-1', 3)), /Revision/);
    assert.equal((await f.b.readAdmission(sourceWorldId)).kind, 'Released');
  });
  await test('A21 concurrent Claim has one winner; exact winner retries are idempotent', async () => {
    const f = fixture(); await f.register(); await f.release(); f.advance(3600000);
    const c = f.authority.bindDevice({ accountId, deviceId: 'device-C' });
    const outcomes = await Promise.allSettled([f.b.claimMigration(f.claim()), c.claimMigration(f.claim())]);
    assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
    const winner = outcomes[0].status === 'fulfilled' ? f.b : c, loser = winner === f.b ? c : f.b;
    const retry = await winner.claimMigration(f.claim()); assert.equal(retry.record.homeRevision, 3);
    await assert.rejects(loser.claimMigration(f.claim()), /其他 Claim/);
    assert.equal((await f.a.readAdmission(sourceWorldId)).kind, 'Migrated');
    assert.throws(() => f.authority.assertAdmissionNow(aContext, sourceWorldId), /Migrated/);
  });
  await test('A22 response lost after durable Claim retains target ownership and allows exact retry', async () => {
    const f = fixture(); await f.register(); await f.release(); f.advance(3600000); await f.b.readMigration('migration-authority-1');
    f.storage.failAfter = true; await assert.rejects(f.b.claimMigration(f.claim()), /response loss/);
    const rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(bContext), retry = await rebuilt.claimMigration(f.claim());
    assert.equal(retry.record.homeDeviceId, bContext.deviceId); assert.equal(retry.record.homeRevision, 3);
  });
  await test('A23 migration back uses a fresh drain/migration and increments same-world ownership to revision 5', async () => {
    const f = fixture(); await f.register(); const first = await f.release(); f.advance(3600000); await f.b.claimMigration(f.claim());
    const second = await f.release(bContext, 3, 'migration-return'); assert.equal(second.receipt.kind, 'PauseActive');
    assert.equal(second.receipt.record.homeRevision, 3); f.advance(3600000);
    const returned = await f.a.claimMigration(f.claim('migration-return', 4)); assert.equal(returned.record.homeRevision, 5);
    assert.equal(returned.record.homeDeviceId, aContext.deviceId);
    assert.equal((await f.a.readAdmission(sourceWorldId)).kind, 'Allowed'); assert.equal((await f.b.readAdmission(sourceWorldId)).kind, 'Migrated');
    const historic = await f.b.claimMigration(f.claim()); assert.equal(historic.record.homeRevision, 3);
    assert.equal((await f.b.readRegistry()).records.find(value => value.worldId === sourceWorldId).homeRevision, 5);
    const replay = await f.a.releaseMigration(first.request, first.payload); assert.equal(replay.kind, 'Claimed'); assert.equal(replay.record.homeRevision, 3);
    assert.equal((await f.a.readRegistry()).records.find(value => value.worldId === sourceWorldId).homeRevision, 5);
  });
  await test('A24 fresh source files, revision, FormatTime and seven-section data are preserved without copy permission', async () => {
    const f = fixture(); await f.register(); const before = JSON.stringify(f.source), payload = f.payload();
    const r = await f.release(); f.advance(3600000); await f.b.claimMigration(f.claim());
    const transferred = await f.b.readMigrationPayload(r.payload.migrationId);
    assert.equal(JSON.stringify(f.source), before); assert.deepEqual(transferred.state, payload.state);
    assert.equal(transferred.state.revision, 7); assert.deepEqual(clone(transferred.state.sections.FormatTime), clone(f.source.sections.FormatTime));
    assert(!Object.hasOwn(transferred, 'CopyPermission')); assert(!Object.hasOwn(transferred.state.sections, 'FirstWorldCleared'));
  });
  await test('A25 ordinary home registration shares the durable index and exact request identity across instances', async () => {
    const f = fixture(); const request = { schemaVersion: 1, worldId: sourceWorldId, registrationId: 'same-registration' };
    const first = await f.a.registerWorldHome(request), rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(aContext);
    assert.equal(first.kind, 'Registered'); assert.deepEqual(await rebuilt.registerWorldHome(request), first);
    assert.equal((await f.b.registerWorldHome({ ...request, registrationId: 'other-registration' })).kind, 'HomeConflict');
    await assert.rejects(rebuilt.registerWorldHome({ ...request, worldId: otherWorldId }), /登记标识/);
    await assert.rejects(rebuilt.registerWorldHome({ ...request, worldId: 'InitialWorld', registrationId: 'initial' }), /InitialWorld/);
  });
  await test('A26 shortened pause or omitted device binding is corrupt service state and cannot open', async () => {
    const f = fixture({ offlineGraceMs: 7200000 }); await f.register(); await f.release(); const original = f.storage.getItem(serviceKey), shortened = JSON.parse(original);
    shortened.migrations[0].receipt.pause.resumeNotBeforeServerEpochMs = epochMs + 3600000;
    shortened.bindings[0].pause.resumeNotBeforeServerEpochMs = epochMs + 3600000;
    f.storage.setItem(serviceKey, JSON.stringify(shortened)); await assert.rejects(f.b.readAdmission(), /不一致/);
    const missing = JSON.parse(original); missing.bindings = []; f.storage.setItem(serviceKey, JSON.stringify(missing));
    assert.throws(() => f.authority.assertAdmissionNow(bContext), /设备绑定/);
  });
  await test('A27 failed service expiry commit cannot locally unlock a pause', async () => {
    const f = fixture(); await f.register(); await f.release(); f.advance(3600000); const before = f.storage.getItem(serviceKey);
    f.storage.failBefore = true; await assert.rejects(f.b.readAdmission(), /commit failure/); assert.equal(f.storage.getItem(serviceKey), before);
    assert.throws(() => f.authority.assertAdmissionNow(bContext), /PauseActive/);
    assert.equal((await f.b.readAdmission()).kind, 'Allowed');
  });
  await test('A28 every authoritative mutation is serialized under one shared service lock', async () => {
    const f = fixture(); const rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(bContext);
    const outcomes = await Promise.all([f.a.registerWorldHome({ schemaVersion: 1, worldId: sourceWorldId, registrationId: 'a' }),
      rebuilt.registerWorldHome({ schemaVersion: 1, worldId: sourceWorldId, registrationId: 'b' })]);
    assert.equal(outcomes.filter(value => value.kind === 'Registered').length, 1);
    assert.equal(outcomes.filter(value => value.kind === 'HomeConflict').length, 1);
    assert(f.locks.calls.length >= 2); assert(f.locks.calls.every(name => name === 'neurou-migration-authority'));
  });
  await test('A29 repeated drain acceptance is idempotent and cannot renew its original 30-second TTL', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async cap => {
      const first = await f.a.acceptDrain(cap); f.advance(15000);
      const repeated = await f.a.acceptDrain(cap); assert.deepEqual(repeated, first);
      f.advance(15000); await assert.rejects(f.a.acceptDrain(cap), /过期/);
      await assert.rejects(f.a.releaseMigration({ schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId }, f.payload()), /过期/);
    });
  });
  await test('A30 source cannot Claim its own migration; return requires a new migration from the new HomeDevice', async () => {
    const f = fixture(); await f.register(); await f.release(); f.advance(3600000);
    await assert.rejects(f.a.claimMigration(f.claim()), /源设备不能 Claim/);
    assert.equal((await f.b.claimMigration(f.claim())).kind, 'Claimed');
  });
  await test('A31 consumed drain identity cannot be reaccepted after pause, Claim or authority reconstruction', async () => {
    const f = fixture(); await f.register(); await f.drain(aContext, async cap => {
      await f.a.acceptDrain(cap);
      await f.a.releaseMigration({ schemaVersion: 1, migrationId: 'migration-authority-1', worldId: sourceWorldId,
        expectedHomeRevision: 1, drainId: cap.confirmation.drainId }, f.payload());
      f.advance(3600000); await f.b.claimMigration(f.claim());
      await assert.rejects(f.a.acceptDrain(cap), /已消费/);
      const rebuilt = new WorldMigrationContractAdapter(f.bindings).bindDevice(aContext);
      await assert.rejects(rebuilt.acceptDrain(cap), /已消费/);
    });
  });
  await test('A32 an accidentally asynchronous capability verifier cannot certify a serialized assertion', async () => {
    const f = fixture(); await f.register(); let currentChecks = 0;
    const miswired = new WorldMigrationContractAdapter({ ...f.bindings, verifyDrainCapability: async () => true }).bindDevice(aContext);
    await assert.rejects(miswired.acceptDrain({ confirmation: {}, assertCurrent() { currentChecks++; }, revoke() {} }), /真实持锁/);
    assert.equal(currentChecks, 0);
  });
  const files = ['src/presentation/WorldMigrationContractAdapter.ts', 'src/director/WorldMigration.ts', 'src/presentation/SafePointDrainStorage.ts'];
  const report = { mode: 'ContractAdapter', passed: results.filter(value => value.result === 'PASS').length,
    failed: results.filter(value => value.result === 'FAIL').length, total: results.length, results,
    sources: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(h.h.root, file))).digest('hex') })) };
  fs.writeFileSync(path.join(__dirname, 'authority-contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ mode: report.mode, passed: report.passed, failed: report.failed, total: report.total }));
  for (const failure of results.filter(value => value.result === 'FAIL')) console.error(failure.name + ': ' + failure.error);
  if (report.failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
