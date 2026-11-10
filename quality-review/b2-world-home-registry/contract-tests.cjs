'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sources = ['src/director/WorldHomeRegistry.ts', 'src/presentation/WorldHomeContractAdapter.ts', 'src/director/WorldFolderSession.ts'];
function load(relative) {
  const file = path.join(root, relative), text = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
  const loaded = new Module(file, module); loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file)); loaded._compile(result.outputText, file);
  return loaded.exports;
}
const { WorldHomeRegistryCodec, WorldHomeRegistrySession } = load(sources[0]);
const { WorldHomeContractAdapter } = load(sources[1]);
const { WorldFolderSession } = load(sources[2]);
const codec = new WorldHomeRegistryCodec();
const clone = value => JSON.parse(JSON.stringify(value));
const context = (accountId = 'account-a', deviceId = 'device-a') => ({ accountId, deviceId });
const request = (worldId = 'world-one', registrationId = 'request-one') => ({ schemaVersion: 1, worldId, registrationId });
const record = (changes = {}) => ({ schemaVersion: 1, accountId: 'account-a', worldId: 'world-one', homeState: 'Homed', homeDeviceId: 'device-a', homeRevision: 1, updatedAtServerEpochMs: 100, ...changes });
const snapshot = (changes = {}) => ({ schemaVersion: 1, accountId: 'account-a', registryRevision: 1, observedAtServerEpochMs: 100, records: [record()], ...changes });
const reply = (changes = {}) => ({ schemaVersion: 1, accountId: 'account-a', deviceId: 'device-a', registrationId: 'request-one', kind: 'Registered', registryRevision: 1, observedAtServerEpochMs: 100, record: record(), ...changes });
function callbacks(now = () => 100) {
  return { now, validateContext: raw => codec.parseContext(raw), validateRequest: raw => codec.parseRegistrationRequest(raw),
    validateSnapshot: (raw, accountId) => codec.parseSnapshot(raw, accountId), validateReply: (raw, ctx, req) => codec.parseRegistrationReply(raw, ctx, req) };
}
function folder(accountId = 'account-a', ids = ['world-one']) {
  let index = 0, writes = 0;
  const value = new WorldFolderSession(accountId, null, () => { writes++; }, () => ids[index++], () => 10);
  for (const id of ids) value.submitWorldFolderIntent({ kind: 'CreateWorld', title: id, description: 'contract fixture' });
  return { value, writes: () => writes };
}
function session(port, directory, ctx = context(), factory = () => 'request-one') {
  return new WorldHomeRegistrySession(ctx, { authority: port, readFolder: () => directory.value.getSnapshot(), createRegistrationId: factory });
}
function diagnostic(value, code) { assert.equal(value.kind, 'Unavailable'); assert.equal(value.diagnostic.code, code); }
function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), 'output object must be frozen');
  for (const item of Object.values(value)) frozenTree(item);
}
const cases = [];
async function test(name, body) {
  const start = performance.now();
  try { await body(); cases.push({ name, result: 'PASS', elapsedMs: Math.round((performance.now() - start) * 1000) / 1000 }); }
  catch (error) { cases.push({ name, result: 'FAIL', elapsedMs: Math.round((performance.now() - start) * 1000) / 1000,
    error: String(error), stack: error?.stack }); }
}

(async () => {
  await test('two-device shared authority: simultaneous first registration has one winner and preserves winner record', async () => {
    let time = 100; const adapter = new WorldHomeContractAdapter(callbacks(() => time));
    const a = folder(), b = folder(), beforeA = a.value.getSnapshot(), beforeB = b.value.getSnapshot();
    const sa = session(adapter.bindDevice(context()), a), sb = session(adapter.bindDevice(context('account-a', 'device-b')), b, context('account-a', 'device-b'));
    const results = await Promise.all([sa.registerWorldHome('world-one'), sb.registerWorldHome('world-one')]);
    assert.deepEqual(results.map(result => result.kind).sort(), ['HomeConflict', 'Registered']);
    const winner = results.find(result => result.kind === 'Registered').reply.record;
    const loser = results.find(result => result.kind === 'HomeConflict').reply.record;
    assert.deepEqual(loser, winner); time = 101;
    const read = await sb.readRegistry(); assert.equal(read.kind, 'Available'); assert.equal(read.snapshot.registryRevision, 1);
    assert.deepEqual(read.snapshot.records, [winner]); assert.equal(read.snapshot.observedAtServerEpochMs, 101);
    assert.equal(a.value.getSnapshot(), beforeA); assert.equal(b.value.getSnapshot(), beforeB);
    assert.equal(a.writes(), 2); assert.equal(b.writes(), 2);
  });
  await test('same device new request AlreadyHomed; original request preserves Registered replay and revision', async () => {
    let time = 100; const adapter = new WorldHomeContractAdapter(callbacks(() => time)), port = adapter.bindDevice(context());
    const first = await port.registerWorldHome(request()); time = 101;
    const newRequest = await port.registerWorldHome(request('world-one', 'request-two')); time = 102;
    const replay = await port.registerWorldHome(request());
    assert.equal(first.kind, 'Registered'); assert.equal(newRequest.kind, 'AlreadyHomed'); assert.equal(replay.kind, 'Registered');
    assert.deepEqual(first.record, newRequest.record); assert.deepEqual(first.record, replay.record);
    assert.equal(replay.registryRevision, 1); assert.equal(replay.observedAtServerEpochMs, 102);
  });
  await test('registration ID replay scoped to account and device; conflicting reuse never creates another world', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context());
    await port.registerWorldHome(request());
    await assert.rejects(port.registerWorldHome(request('world-two', 'request-one')));
    const other = adapter.bindDevice(context('account-a', 'device-b'));
    assert.equal((await other.registerWorldHome(request())).kind, 'HomeConflict');
    const read = await port.readRegistry(); assert.equal(read.registryRevision, 1); assert.deepEqual(read.records.map(x => x.worldId), ['world-one']);
  });
  await test('same world ID in different accounts has independent ownership and revision', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), a = adapter.bindDevice(context()), b = adapter.bindDevice(context('account-b', 'device-b'));
    assert.equal((await a.registerWorldHome(request())).kind, 'Registered'); assert.equal((await b.registerWorldHome(request())).kind, 'Registered');
    const ra = await a.readRegistry(), rb = await b.readRegistry();
    assert.equal(ra.records[0].homeDeviceId, 'device-a'); assert.equal(rb.records[0].homeDeviceId, 'device-b');
    assert.equal(ra.accountId, 'account-a'); assert.equal(rb.accountId, 'account-b');
    assert.equal(ra.registryRevision, 1); assert.equal(rb.registryRevision, 1);
  });
  await test('bound identity is copied/frozen; request cannot override account or device', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), input = context(), port = adapter.bindDevice(input);
    input.accountId = 'account-b'; input.deviceId = 'device-b';
    assert.throws(() => { port.context.accountId = 'account-b'; }); assert.throws(() => { port.context = context('account-b'); });
    await assert.rejects(port.registerWorldHome({ ...request(), accountId: 'account-b', deviceId: 'device-b' }));
    assert.equal((await port.readRegistry()).registryRevision, 0);
    const first = await port.registerWorldHome(request()); assert.equal(first.accountId, 'account-a'); assert.equal(first.record.homeDeviceId, 'device-a');
  });
  await test('session identity remains original after constructor context input is mutated', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), input = context(), dir = folder();
    const value = session(adapter.bindDevice(context()), dir, input); input.accountId = 'account-b'; input.deviceId = 'device-b';
    const result = await value.registerWorldHome('world-one'); assert.equal(result.kind, 'Registered'); assert.equal(result.reply.accountId, 'account-a');
  });
  await test('InitialWorld returns ExcludedWorld before folder, authority and registration ID factory', async () => {
    let folderCalls = 0, portCalls = 0, factoryCalls = 0;
    const port = { mode: 'ContractAdapter', context: context(), readRegistry: async () => { portCalls++; }, registerWorldHome: async () => { portCalls++; } };
    const value = new WorldHomeRegistrySession(context(), { authority: port, readFolder: () => { folderCalls++; throw Error('should not read'); }, createRegistrationId: () => { factoryCalls++; throw Error('should not allocate'); } });
    diagnostic(await value.registerWorldHome('InitialWorld'), 'ExcludedWorld'); assert.deepEqual([folderCalls, portCalls, factoryCalls], [0, 0, 0]);
  });
  await test('unknown and tombstoned local worlds are rejected without authority or ID allocation', async () => {
    let calls = 0, ids = 0; const dir = folder(); dir.value.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: 'world-one' });
    const port = { mode: 'ContractAdapter', context: context(), readRegistry: async () => { calls++; }, registerWorldHome: async () => { calls++; } };
    const value = session(port, dir, context(), () => { ids++; return 'request-one'; });
    diagnostic(await value.registerWorldHome('world-unknown'), 'WorldUnavailable'); diagnostic(await value.registerWorldHome('world-one'), 'WorldUnavailable');
    assert.equal(calls, 0); assert.equal(ids, 0);
  });
  await test('wrong-account directory returns InvalidLocalDirectory before authority or ID allocation', async () => {
    let calls = 0, ids = 0; const dir = folder('account-b');
    const port = { mode: 'ContractAdapter', context: context(), readRegistry: async () => { calls++; }, registerWorldHome: async () => { calls++; } };
    const value = session(port, dir, context(), () => { ids++; return 'request-one'; });
    diagnostic(await value.registerWorldHome('world-one'), 'InvalidLocalDirectory'); assert.equal(calls, 0); assert.equal(ids, 0);
  });
  await test('malformed local metadata never reaches authority and never mutates directory', async () => {
    const dir = folder(), original = dir.value.getSnapshot(); let calls = 0;
    const port = { mode: 'ContractAdapter', context: context(), readRegistry: async () => {}, registerWorldHome: async () => { calls++; } };
    const bad = clone(original); bad.records[1].template = 'InitialWorld';
    const value = new WorldHomeRegistrySession(context(), { authority: port, readFolder: () => bad, createRegistrationId: () => 'request-one' });
    diagnostic(await value.registerWorldHome('world-one'), 'InvalidLocalDirectory'); assert.equal(calls, 0); assert.equal(dir.value.getSnapshot(), original);
  });
  await test('directory metadata title/description whitespace is rejected consistently with WorldFolderSession', async () => {
    const dir = folder(), adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context());
    for (const field of ['title', 'description']) {
      const malformed = clone(dir.value.getSnapshot()); malformed.records[1][field] = ' trailing ';
      const value = new WorldHomeRegistrySession(context(), { authority: port, readFolder: () => malformed, createRegistrationId: () => 'request-one' });
      diagnostic(await value.registerWorldHome('world-one'), 'InvalidLocalDirectory');
      assert.equal((await port.readRegistry()).registryRevision, 0);
    }
  });
  await test('absent service is explicit, never allocates an ID or reports cached local success', async () => {
    let ids = 0; const value = session(null, folder(), context(), () => { ids++; return 'request-one'; });
    diagnostic(await value.readRegistry(), 'ServiceUnavailable'); const result = await value.registerWorldHome('world-one');
    diagnostic(result, 'ServiceUnavailable'); assert.equal(result.registrationId, null); assert.equal(ids, 0); frozenTree(result);
  });
  await test('offline failure retains request ID; online retry uses same ID and success is never cached', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context()); let ids = 0, requests = [];
    const wrapper = { ...port, registerWorldHome: async req => { requests.push(req.registrationId); return port.registerWorldHome(req); } };
    const value = session(wrapper, folder(), context(), () => { ids++; return 'request-stable'; });
    adapter.setAvailable(false); const offline = await value.registerWorldHome('world-one'); diagnostic(offline, 'ServiceUnavailable'); assert.equal(offline.registrationId, 'request-stable');
    adapter.setAvailable(true); assert.equal((await value.registerWorldHome('world-one')).kind, 'Registered');
    adapter.setAvailable(false); diagnostic(await value.registerWorldHome('world-one'), 'ServiceUnavailable'); diagnostic(await value.readRegistry(), 'ServiceUnavailable');
    adapter.setAvailable(true); assert.equal((await value.registerWorldHome('world-one')).kind, 'Registered');
    assert.equal(ids, 1); assert.deepEqual(requests, ['request-stable', 'request-stable', 'request-stable', 'request-stable']);
  });
  await test('wrong identity or mode in authority binding returns InvalidAuthorityResponse', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()); let ids = 0;
    const port = adapter.bindDevice(context('account-a', 'device-b'));
    const value = session(port, folder(), context(), () => { ids++; return 'request-one'; });
    diagnostic(await value.readRegistry(), 'InvalidAuthorityResponse'); diagnostic(await value.registerWorldHome('world-one'), 'InvalidAuthorityResponse'); assert.equal(ids, 0);
    const wrongMode = { ...adapter.bindDevice(context()), mode: 'ExternalService' };
    diagnostic(await session(wrongMode, folder()).readRegistry(), 'InvalidAuthorityResponse');
  });
  await test('invalid or reused registration ID factory fails before second authority write', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context()), dir = folder('account-a', ['world-one', 'world-two']);
    const bad = session(port, dir, context(), () => ' '); diagnostic(await bad.registerWorldHome('world-one'), 'InvalidRequest');
    const reused = session(port, dir, context(), () => 'request-shared'); assert.equal((await reused.registerWorldHome('world-one')).kind, 'Registered');
    diagnostic(await reused.registerWorldHome('world-two'), 'InvalidRequest'); assert.equal((await port.readRegistry()).registryRevision, 1);
  });
  await test('all codec structures reject unknown own fields and own symbols', () => {
    const inputs = [ [context(), x => codec.parseContext(x)], [request(), x => codec.parseRegistrationRequest(x)],
      [record(), x => codec.parseRecord(x, 'account-a')], [snapshot(), x => codec.parseSnapshot(x, 'account-a')],
      [reply(), x => codec.parseRegistrationReply(x, context(), request())] ];
    for (const [raw, parse] of inputs) { assert.throws(() => parse({ ...raw, extra: true })); const symbolic = { ...raw }; symbolic[Symbol('extra')] = true; assert.throws(() => parse(symbolic)); }
  });
  await test('codec rejects object and array accessors without invoking getters', () => {
    let invoked = 0; const raw = context(); Object.defineProperty(raw, 'accountId', { enumerable: true, get() { invoked++; return 'account-a'; } });
    assert.throws(() => codec.parseContext(raw));
    const rows = [record()]; Object.defineProperty(rows, '0', { enumerable: true, get() { invoked++; return record(); } });
    assert.throws(() => codec.parseSnapshot(snapshot({ records: rows }), 'account-a'));
    assert.equal(invoked, 0);
  });
  await test('codec rejects non-data prototype, sparse/nonplain arrays and array extras', () => {
    const proto = Object.assign(Object.create({ inherited: true }), context()); assert.throws(() => codec.parseContext(proto));
    const sparse = []; sparse.length = 1; assert.throws(() => codec.parseSnapshot(snapshot({ records: sparse }), 'account-a'));
    const rows = [record()]; rows.extra = 1; assert.throws(() => codec.parseSnapshot(snapshot({ records: rows }), 'account-a'));
    const symbolic = [record()]; symbolic[Symbol('extra')] = 1; assert.throws(() => codec.parseSnapshot(snapshot({ records: symbolic }), 'account-a'));
    class CustomArray extends Array {} assert.throws(() => codec.parseSnapshot(snapshot({ records: new CustomArray(record()) }), 'account-a'));
  });
  await test('codec accepts null-prototype data and detaches/freeze-copies nested raw data', () => {
    const raw = Object.assign(Object.create(null), context()); frozenTree(codec.parseContext(raw));
    const source = snapshot(); const parsed = codec.parseSnapshot(source, 'account-a'); frozenTree(parsed);
    source.records[0].homeDeviceId = 'device-mutation'; source.records.push(record({ worldId: 'world-two' }));
    assert.equal(parsed.records[0].homeDeviceId, 'device-a'); assert.equal(parsed.records.length, 1);
  });
  await test('codec rejects duplicate or InitialWorld IDs and mismatched account/record identities', () => {
    assert.throws(() => codec.parseSnapshot(snapshot({ registryRevision: 2, records: [record(), record()] }), 'account-a'));
    assert.throws(() => codec.parseRecord(record({ worldId: 'InitialWorld' }), 'account-a'));
    assert.throws(() => codec.parseRecord(record({ accountId: 'account-b' }), 'account-a'));
    assert.throws(() => codec.parseSnapshot(snapshot({ accountId: 'account-b' }), 'account-a'));
    assert.throws(() => codec.parseRegistrationRequest(request('InitialWorld')));
  });
  await test('codec enforces Homed/Released device-state relation; rejects unknown state', () => {
    for (const change of [{ homeState: 'Unknown' }, { homeDeviceId: null }, { homeState: 'Released' }, { homeState: 'Released', homeDeviceId: 'device-a' }]) {
      assert.throws(() => codec.parseRecord(record(change), 'account-a'));
    }
    const released = codec.parseRecord(record({ homeState: 'Released', homeDeviceId: null }), 'account-a'); assert.equal(released.homeState, 'Released'); frozenTree(released);
  });
  await test('codec rejects unsafe/fractional/negative versions and times, record beyond observed boundary', () => {
    for (const number of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => codec.parseSnapshot(snapshot({ registryRevision: number }), 'account-a'));
      assert.throws(() => codec.parseSnapshot(snapshot({ observedAtServerEpochMs: number }), 'account-a'));
      assert.throws(() => codec.parseRecord(record({ updatedAtServerEpochMs: number }), 'account-a'));
    }
    assert.throws(() => codec.parseRecord(record({ homeRevision: 0 }), 'account-a'));
    assert.throws(() => codec.parseSnapshot(snapshot({ records: [record({ homeRevision: 2 })] }), 'account-a'));
    assert.throws(() => codec.parseSnapshot(snapshot({ records: [record({ updatedAtServerEpochMs: 101 })] }), 'account-a'));
    assert.throws(() => codec.parseSnapshot(snapshot({ registryRevision: 0 }), 'account-a'));
    assert.throws(() => codec.parseSnapshot(snapshot({ records: [] }), 'account-a'));
  });
  await test('codec checks reply account/device/request/world identity and result-owner consistency', () => {
    for (const change of [{ accountId: 'account-b' }, { deviceId: 'device-b' }, { registrationId: 'other-request' },
      { record: record({ worldId: 'world-two' }) }, { kind: 'HomeConflict' }, { kind: 'Unexpected' },
      { record: record({ homeDeviceId: 'device-b' }) }, { record: record({ homeRevision: 2 }), registryRevision: 2 }]) {
      assert.throws(() => codec.parseRegistrationReply(reply(change), context(), request()));
    }
    assert.equal(codec.parseRegistrationReply(reply({ kind: 'HomeConflict', record: record({ homeDeviceId: 'device-b' }) }), context(), request()).kind, 'HomeConflict');
  });
  await test('malicious reply cannot poison observations or request identity; a valid retry recovers', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context()); let attack = 'identity', ids = 0;
    const wrapper = { ...port, registerWorldHome: async req => {
      const raw = clone(await port.registerWorldHome(req));
      if (attack === 'identity') { raw.deviceId = 'device-b'; raw.registryRevision = 99; }
      else if (attack === 'known-change') { raw.record.homeDeviceId = 'device-b'; raw.kind = 'HomeConflict'; raw.registryRevision = 99; }
      return raw;
    } };
    const value = session(wrapper, folder(), context(), () => { ids++; return 'request-one'; });
    diagnostic(await value.registerWorldHome('world-one'), 'InvalidAuthorityResponse');
    attack = null; assert.equal((await value.registerWorldHome('world-one')).kind, 'Registered');
    attack = 'known-change'; diagnostic(await value.registerWorldHome('world-one'), 'InvalidAuthorityResponse');
    attack = null; assert.equal((await value.registerWorldHome('world-one')).kind, 'Registered'); assert.equal(ids, 1);
  });
  await test('malicious registry identity/revision rollback/known-record mutation and disappearance do not poison observations', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context());
    await port.registerWorldHome(request()); await port.registerWorldHome(request('world-two', 'request-two'));
    let attack = null; const wrapper = { ...port, readRegistry: async () => {
      const raw = clone(await port.readRegistry());
      if (attack === 'identity') raw.accountId = 'account-b';
      if (attack === 'rollback') { raw.registryRevision = 1; raw.records = [raw.records[0]]; }
      if (attack === 'mutation') raw.records[0].homeDeviceId = 'device-malicious';
      if (attack === 'disappearance') { raw.records = [raw.records[0], record({ worldId: 'world-three' })]; }
      return raw;
    } };
    const value = session(wrapper, folder()); assert.equal((await value.readRegistry()).kind, 'Available');
    for (const mode of ['identity', 'rollback', 'mutation', 'disappearance']) {
      attack = mode; diagnostic(await value.readRegistry(), 'InvalidAuthorityResponse');
      attack = null; assert.equal((await value.readRegistry()).kind, 'Available', mode + ' must not poison session');
    }
  });
  await test('session rejects Released/home-revision mutation/inflated revision from authority and subsequently recovers', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context()); await port.registerWorldHome(request());
    let attack = 'Released'; const wrapper = { ...port, readRegistry: async () => {
      const raw = clone(await port.readRegistry());
      if (attack === 'Released') { raw.records[0].homeState = 'Released'; raw.records[0].homeDeviceId = null; }
      if (attack === 'revision') { raw.records[0].homeRevision = 2; raw.registryRevision = 2; raw.records.push(record({ worldId: 'world-two' })); }
      if (attack === 'inflation') raw.registryRevision = 100;
      return raw;
    } };
    const value = session(wrapper, folder());
    for (const mode of ['Released', 'revision', 'inflation']) {
      attack = mode; diagnostic(await value.readRegistry(), 'InvalidAuthorityResponse');
      attack = null; assert.equal((await value.readRegistry()).kind, 'Available');
    }
  });
  await test('partial reply adding a world without advancing registry revision is rejected and retry recovers', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context()), dir = folder('account-a', ['world-one', 'world-two']);
    let attack = false, allocated = 0; const wrapper = { ...port, registerWorldHome: async req => {
      const raw = clone(await port.registerWorldHome(req));
      if (attack) raw.registryRevision = 1;
      return raw;
    } };
    const value = session(wrapper, dir, context(), () => 'request-' + (++allocated));
    assert.equal((await value.registerWorldHome('world-one')).kind, 'Registered');
    attack = true; diagnostic(await value.registerWorldHome('world-two'), 'InvalidAuthorityResponse');
    attack = false; const recovered = await value.registerWorldHome('world-two'); assert.equal(recovered.kind, 'Registered'); assert.equal(recovered.reply.registryRevision, 2);
    assert.equal((await value.readRegistry()).snapshot.records.length, 2); assert.equal(allocated, 2);
  });
  await test('adapter and session outputs are deeply frozen and each response is a detached copy', async () => {
    const adapter = new WorldHomeContractAdapter(callbacks()), port = adapter.bindDevice(context()), value = session(port, folder());
    const registered = await value.registerWorldHome('world-one'); frozenTree(registered);
    assert.throws(() => { registered.reply.record.homeDeviceId = 'device-corrupted'; });
    const first = await value.readRegistry(), second = await value.readRegistry(); frozenTree(first); frozenTree(second);
    assert.notEqual(first.snapshot, second.snapshot); assert.notEqual(first.snapshot.records, second.snapshot.records);
    assert.notEqual(first.snapshot.records[0], second.snapshot.records[0]); assert.equal(second.snapshot.records[0].homeDeviceId, 'device-a');
    const rawOne = await port.readRegistry(), rawTwo = await port.readRegistry(); assert.notEqual(rawOne, rawTwo); frozenTree(rawOne);
  });
  await test('invalid clock first-registration failures publish neither registry record nor replay', async () => {
    for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100']) {
      let time = invalid; const adapter = new WorldHomeContractAdapter(callbacks(() => time)), port = adapter.bindDevice(context());
      await assert.rejects(port.registerWorldHome(request())); time = 100;
      assert.equal((await port.readRegistry()).registryRevision, 0);
      const valid = await port.registerWorldHome(request()); assert.equal(valid.kind, 'Registered'); assert.equal(valid.registryRevision, 1);
    }
  });
  await test('backward server time leaves established ownership and failed new-world registration unpublished', async () => {
    let time = 100; const adapter = new WorldHomeContractAdapter(callbacks(() => time)), port = adapter.bindDevice(context());
    const first = await port.registerWorldHome(request()); time = 99;
    await assert.rejects(port.readRegistry()); await assert.rejects(port.registerWorldHome(request('world-two', 'request-two')));
    time = 101; const read = await port.readRegistry(); assert.equal(read.registryRevision, 1); assert.deepEqual(read.records, [first.record]);
    const retry = await port.registerWorldHome(request('world-two', 'request-two')); assert.equal(retry.kind, 'Registered'); assert.equal(retry.registryRevision, 2);
  });
  await test('schema validator failure after candidate creation publishes neither authority map nor replay', async () => {
    let reject = true; const bindings = callbacks(); bindings.validateReply = (raw, ctx, req) => { if (reject) throw Error('validator fault'); return codec.parseRegistrationReply(raw, ctx, req); };
    const adapter = new WorldHomeContractAdapter(bindings), port = adapter.bindDevice(context());
    await assert.rejects(port.registerWorldHome(request())); reject = false; assert.equal((await port.readRegistry()).registryRevision, 0);
    assert.equal((await port.registerWorldHome(request())).kind, 'Registered');
  });
  await test('callback configuration reentrancy fails before authority publication and preserves availability', async () => {
    let adapter, invoke = false; const bindings = callbacks(); bindings.validateSnapshot = (raw, accountId) => {
      if (invoke) adapter.setAvailable(false); return codec.parseSnapshot(raw, accountId);
    };
    adapter = new WorldHomeContractAdapter(bindings); const port = adapter.bindDevice(context()); invoke = true;
    await assert.rejects(port.registerWorldHome(request())); invoke = false;
    assert.equal((await port.readRegistry()).registryRevision, 0); assert.equal((await port.registerWorldHome(request())).kind, 'Registered');
  });
  await test('nested authority operation is rejected; rejected nested request has no world or replay side effect', async () => {
    let port, nested, enter = true; const bindings = callbacks(() => {
      if (enter) { enter = false; nested = port.registerWorldHome(request('world-two', 'request-two')); nested.catch(() => {}); }
      return 100;
    });
    const adapter = new WorldHomeContractAdapter(bindings); port = adapter.bindDevice(context());
    const first = await port.registerWorldHome(request()); assert.equal(first.kind, 'Registered'); await assert.rejects(nested, /不可重入/);
    assert.deepEqual((await port.readRegistry()).records.map(row => row.worldId), ['world-one']);
    assert.equal((await port.registerWorldHome(request('world-two', 'request-two'))).kind, 'Registered');
  });
  await test('adapter constructor captures callbacks; later binding-object mutation cannot change its clock or identity parser', async () => {
    const bindings = callbacks(), adapter = new WorldHomeContractAdapter(bindings);
    bindings.now = () => -1; bindings.validateContext = () => context('account-b', 'device-b');
    const port = adapter.bindDevice(context()); const result = await port.registerWorldHome(request());
    assert.equal(result.accountId, 'account-a'); assert.equal(result.observedAtServerEpochMs, 100);
  });
  const failed = cases.filter(item => item.result === 'FAIL');
  const output = { schemaVersion: 1, phase: 'B2.4b WorldHomeRegistry minimum closure', capturedAt: new Date().toISOString(),
    runtime: process.version, loading: 'TypeScript transpileModule in memory; no emit and no production edits',
    sources: sources.map(relative => ({ path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex') })),
    fixture: 'Real WorldFolderSession metadata; shared WorldHomeContractAdapter authority with two logical devices and controlled server-time callback',
    summary: { total: cases.length, passed: cases.length - failed.length, failed: failed.length }, cases };
  fs.writeFileSync(path.join(__dirname, 'contract-results.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(output.summary)); for (const failure of failed) console.error(failure.name + '\n' + failure.stack);
  process.exitCode = failed.length ? 1 : 0;
})();
