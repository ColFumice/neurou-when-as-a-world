'use strict';
// Actual pure TypeScript state and browser storage adapter; injected environment only.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), ts = require('../../node_modules/typescript');
const output = __dirname, root = path.resolve(output, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText, filename);
const { WorldFolderSession } = require('../../src/director/WorldFolderSession.ts');
const { WorldLocalStorage } = require('../../src/presentation/WorldLocalStorage.ts');
const { createWorldFolderReader } = require('../../src/presentation/FolderCatalog.ts');
const { AccountStartupSession } = require('../../src/director/AccountStartupSession.ts');
const { AccountStartupStorage } = require('../../src/presentation/FolderStartupView.ts');
const clone = x => JSON.parse(JSON.stringify(x)), checks = [];
function test(name, run) { try { checks.push({ name, pass: true, evidence: run() ?? null }); }
  catch (error) { checks.push({ name, pass: false, error: String(error.stack || error) }); } }
function memory() {
  const values = new Map(), calls = [], controls = { readError: null, writeError: null };
  const storage = { get length() { return values.size; }, getItem(key) { calls.push({ operation: 'getItem', key }); if (controls.readError) throw controls.readError; return values.get(key) ?? null; },
    setItem(key, value) { calls.push({ operation: 'setItem', key, value }); if (controls.writeError) throw controls.writeError; values.set(key, String(value)); },
    removeItem(key) { calls.push({ operation: 'removeItem', key }); values.delete(key); }, clear() { calls.push({ operation: 'clear' }); values.clear(); }, key(index) { return [...values.keys()][index] ?? null; } };
  global.localStorage = storage; return { values, calls, controls, storage };
}
function session(accountId = 'account-A', snapshot = null, options = {}) {
  const writes = [], env = { fail: false, tick: 1000, serial: 0 };
  const s = new WorldFolderSession(accountId, snapshot, candidate => { if (env.fail) throw new Error('persist rejected'); writes.push(clone(candidate)); options.persist?.(candidate); },
    options.createId ?? (() => 'world-local-test-' + (++env.serial)), options.now ?? (() => env.tick++));
  return { s, env, writes };
}
function create(s, title = '新世界', description = '本地空白世界') { s.submitWorldFolderIntent({ kind: 'CreateWorld', title, description }); return s.getWorlds().at(-1); }
function unchanged(s, action) { const snapshot = s.getSnapshot(), serialized = JSON.stringify(snapshot); assert.throws(action); assert.strictEqual(s.getSnapshot(), snapshot); assert.equal(JSON.stringify(snapshot), serialized); }
test('W01 null registry seeds one InitialWorld and persists immutable account snapshot', () => {
  const { s, writes } = session(); assert.equal(writes.length, 1); assert.equal(s.getSnapshot().schemaVersion, 1); assert.equal(s.getSnapshot().accountId, 'account-A');
  const list = s.getWorlds(); assert.equal(list.length, 1); assert.equal(list[0].worldId, 'InitialWorld'); assert.equal(list[0].template, 'InitialWorld'); assert.equal(list[0].deletedAt, null);
  assert.equal(list[0].createdAt, 1000); assert.strictEqual(s.getWorldRecord('InitialWorld'), list[0]);
  for (const value of [s.getSnapshot(), s.getSnapshot().records, list[0], list]) assert.ok(Object.isFrozen(value));
  return { initialWorlds: 1, persistCalls: 1, accountId: s.getSnapshot().accountId, record: list[0] };
});
test('W02 two real create intents populate dynamic list and strict serialized reload preserves stable IDs', () => {
  const { s, writes } = session(); const a = create(s, '甲世界'), b = create(s, '乙世界'); assert.notEqual(a.worldId, b.worldId); assert.equal(s.getWorlds().length, 3);
  for (const item of [a, b]) { assert.equal(item.template, 'EmptyWorld'); assert.equal(item.deletedAt, null); assert.ok(item.worldId); }
  const saved = clone(s.getSnapshot()), reloaded = session('account-A', saved); assert.deepEqual(reloaded.s.getSnapshot(), s.getSnapshot()); assert.equal(reloaded.writes.length, 0);
  saved.records[1].title = 'mutation'; assert.equal(reloaded.s.getWorldRecord(a.worldId).title, '甲世界');
  return { created: [a, b], activeCount: 3, persistCalls: writes.length, reloadPersistCalls: reloaded.writes.length };
});
test('W03 persist failure on seed/create/delete never exposes a successful registry state', () => {
  assert.throws(() => new WorldFolderSession('a', null, () => { throw new Error('seed unavailable'); }, () => 'safe-id', () => 1000));
  const { s, env } = session(); env.fail = true; unchanged(s, () => create(s)); env.fail = false; const world = create(s); env.fail = true;
  unchanged(s, () => s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: world.worldId })); assert.equal(s.getWorldRecord(world.worldId).deletedAt, null);
  return { seedRejected: true, failedCreatePreservesState: true, failedDeleteWorldStillActive: true };
});
test('W04 tombstone hides world, retains exact metadata and all earlier snapshot records across reload', () => {
  const { s } = session(); const a = create(s, '有记录的世界'), b = create(s, '保留的世界'), before = clone(s.getSnapshot());
  s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: a.worldId }); const after = s.getSnapshot(), tombstone = after.records.find(r => r.worldId === a.worldId);
  assert.ok(Number.isFinite(tombstone.deletedAt)); assert.deepEqual({ ...tombstone, deletedAt: null }, before.records.find(r => r.worldId === a.worldId));
  assert.equal(after.records.length, before.records.length); assert.deepEqual(after.records.filter(r => r.worldId !== a.worldId), before.records.filter(r => r.worldId !== a.worldId));
  assert.deepEqual(s.getWorlds().map(r => r.worldId), ['InitialWorld', b.worldId]); assert.throws(() => s.getWorldRecord(a.worldId));
  const reload = session('account-A', clone(after)).s; assert.deepEqual(reload.getSnapshot(), after); assert.throws(() => reload.getWorldRecord(a.worldId));
  return { physicalRecordCount: after.records.length, activeCount: s.getWorlds().length, tombstone, unaffectedRecord: b.worldId,
    preservationScope: 'Registry record metadata only; no unavailable gameplay persistence is claimed.' };
});
test('W05 unknown ID/stale deleted entry/fork route reject without mutation; deleted InitialWorld never reseeds on reload', () => {
  const { s } = session(); const a = create(s); s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: a.worldId });
  unchanged(s, () => s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: 'unknown' }));
  assert.throws(() => s.getWorldRecord(a.worldId)); assert.throws(() => s.getWorldRecord('unknown'));
  unchanged(s, () => s.submitWorldFolderIntent({ kind: 'WorldFork', worldId: 'InitialWorld' }));
  assert.throws(() => s.submitWorldFolderIntent({ kind: 'WorldFork', worldId: 'InitialWorld' }), /分叉尚未开放/);
  s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: 'InitialWorld' }); assert.equal(s.getWorlds().length, 0);
  const reloaded = session('account-A', clone(s.getSnapshot())).s; assert.equal(reloaded.getWorlds().length, 0);
  assert.equal(reloaded.getSnapshot().records.find(r => r.worldId === 'InitialWorld').template, 'InitialWorld');
  return { deletedInitialWorldRemainsTombstone: true, emptyListDoesNotReseed: true, unknownRejected: true, tombstonedEntryRejected: true, forkUnavailable: true };
});
test('W06 ID collisions and tombstone reuse cannot replace existing metadata or create duplicate identity', () => {
  const { s } = session('account-A', null, { createId: () => 'world-same-local-id' }); const a = create(s); const before = clone(s.getSnapshot());
  unchanged(s, () => create(s)); assert.deepEqual(s.getSnapshot(), before); s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: a.worldId });
  unchanged(s, () => create(s)); assert.equal(s.getSnapshot().records.filter(r => r.worldId === a.worldId).length, 1);
  return { collisionRejected: true, tombstoneIdNotReused: true };
});
test('W07 invalid ID/clock/title input rejects atomically and snapshots never freeze caller input', () => {
  const invalidIds = ['', 'InitialWorld', '__proto__', 'constructor', 'a/b', '../world', 'a.json'];
  for (const value of invalidIds) { const { s } = session('account-A', null, { createId: () => value }); unchanged(s, () => create(s)); }
  const { s } = session(); for (const title of ['', '   ', 'x'.repeat(81)]) unchanged(s, () => create(s, title));
  for (const now of [NaN, Infinity, -1]) assert.throws(() => session('account-A', null, { now: () => now }));
  const input = clone(s.getSnapshot()); const reload = session('account-A', input).s; assert.equal(Object.isFrozen(input), false); input.records[0].title = 'changed'; assert.notEqual(reload.getWorlds()[0].title, 'changed');
  return { invalidIds, invalidClockValues: 3, callerInputDetached: true };
});
test('W08 strict snapshot validation refuses corruption, foreign account, duplicate IDs and invalid tombstones', () => {
  const { s } = session(); create(s); const base = clone(s.getSnapshot()), cases = [
    ['schema', r => { r.schemaVersion = 2; }], ['foreign account', r => { r.accountId = 'account-B'; }], ['unknown root field', r => { r.WorldFork = true; }],
    ['missing records', r => { delete r.records; }], ['duplicate id', r => { r.records[1].worldId = 'InitialWorld'; }],
    ['extra record field', r => { r.records[1].ledger = []; }], ['unknown template', r => { r.records[1].template = 'WorldFork'; }],
    ['initial template changed', r => { r.records[0].template = 'EmptyWorld'; }],
    ['invalid timestamp', r => { r.records[1].createdAt = -1; }], ['delete before creation', r => { r.records[1].deletedAt = r.records[1].createdAt - 1; }],
    ['empty title', r => { r.records[1].title = ''; }], ['unsafe ID', r => { r.records[1].worldId = '__proto__'; }] ];
  for (const [name, mutate] of cases) { const raw = clone(base); mutate(raw); assert.throws(() => session('account-A', raw), name); }
  return { rejected: cases.map(([name]) => name), noMigrationOrEmptyFallback: true };
});
test('W09 real storage adapter isolates account keys and persists tombstones without touching milestone/editor data', () => {
  const env = memory(), adapter = new WorldLocalStorage(); const keep = { 'neurou-account-milestone-v1:account-A': '{"PrologueCompleted":true}', 'neurou-guidance-draft-v1': '{"existing":"guidance"}', 'neurou-music-draft-v1': '{"existing":"music"}' };
  for (const [key, value] of Object.entries(keep)) env.values.set(key, value);
  let expectedA = null, expectedB = null;
  const a = session('账号:/ A', null, { persist: snapshot => { adapter.saveSnapshot(snapshot, expectedA); expectedA = snapshot; } }); create(a.s, 'A本地世界');
  const b = session('账号:/ B', null, { persist: snapshot => { adapter.saveSnapshot(snapshot, expectedB); expectedB = snapshot; } }); create(b.s, 'B本地世界');
  assert.deepEqual(adapter.readSnapshot('账号:/ A'), a.s.getSnapshot()); assert.deepEqual(adapter.readSnapshot('账号:/ B'), b.s.getSnapshot()); assert.equal(adapter.readSnapshot('unknown'), null);
  assert.throws(() => session('账号:/ B', adapter.readSnapshot('账号:/ A'))); for (const [key, value] of Object.entries(keep)) assert.equal(env.values.get(key), value);
  const worldKeys = [...env.values.keys()].filter(k => k.startsWith('neurou-world-folder-v1:')); assert.equal(worldKeys.length, 2);
  assert.ok(worldKeys.includes('neurou-world-folder-v1:' + encodeURIComponent('账号:/ A'))); assert.ok(worldKeys.includes('neurou-world-folder-v1:' + encodeURIComponent('账号:/ B')));
  assert.equal(env.calls.some(c => ['removeItem', 'clear'].includes(c.operation)), false);
  return { accountKeys: worldKeys, unrelatedKeysRetained: Object.keys(keep), physicallyDeletedKeys: 0 };
});
test('W10 actual storage read/JSON/write exceptions propagate and successful state follows the durable boundary', () => {
  const env = memory(), adapter = new WorldLocalStorage(); env.controls.readError = new Error('storage blocked'); assert.throws(() => adapter.readSnapshot('a')); env.controls.readError = null;
  env.values.set('neurou-world-folder-v1:' + encodeURIComponent('a'), '{bad json'); assert.throws(() => adapter.readSnapshot('a')); env.values.clear();
  let expected = null; const { s } = session('a', null, { persist: snapshot => { adapter.saveSnapshot(snapshot, expected); expected = snapshot; } }); env.controls.writeError = new Error('quota exceeded'); unchanged(s, () => create(s));
  env.controls.writeError = null; const a = create(s); assert.equal(adapter.readSnapshot('a').records.find(r => r.worldId === a.worldId).title, a.title);
  env.controls.writeError = new Error('quota exceeded'); unchanged(s, () => s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: a.worldId })); assert.equal(adapter.readSnapshot('a').records.find(r => r.worldId === a.worldId).deletedAt, null);
  return { readFailurePropagated: true, corruptJsonRejected: true, failedCreateNoGhost: true, failedDeleteRetainsDurableWorld: true };
});
test('W11 registry operations do not expose ledger, permission, copy or gameplay persistence capabilities', () => {
  const { s } = session(); const fields = Object.keys(s.getSnapshot().records[0]).sort();
  assert.deepEqual(fields, ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template'].sort());
  const source = fs.readFileSync(path.join(root, 'src/director/WorldFolderSession.ts'), 'utf8');
  assert.doesNotMatch(source, /^import\s.*(?:ledger|ChartPremiere|PuzzleChain|['"]cc['"])/m);
  assert.equal('CopyPermission' in s.getSnapshot(), false); assert.equal('WorldClearRecord' in s.getSnapshot(), false);
  return { exactMetadataFields: fields, newLedgerWrites: 0, noCopyPermissionGrant: true, actualWorldForkUnavailable: true };
});
test('W12 stale session compare-and-set rejects create/delete rather than losing or reviving another tab record', () => {
  const env = memory(), adapter = new WorldLocalStorage();
  function durable(accountId, idPrefix) { const stored = adapter.readSnapshot(accountId); let expected = stored, serial = 0;
    return new WorldFolderSession(accountId, stored, candidate => { adapter.saveSnapshot(candidate, expected); expected = candidate; }, () => 'world-' + idPrefix + '-' + (++serial), () => 3000); }
  const a = durable('shared-account', 'A'), b = durable('shared-account', 'B'); const created = create(a, '只在A创建');
  unchanged(b, () => create(b, 'B过期创建')); assert.equal(adapter.readSnapshot('shared-account').records.find(r => r.worldId === created.worldId).title, '只在A创建');
  const c = durable('shared-account', 'C'); a.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: created.worldId });
  unchanged(c, () => c.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: 'InitialWorld' }));
  assert.notEqual(adapter.readSnapshot('shared-account').records.find(r => r.worldId === created.worldId).deletedAt, null);
  assert.equal(adapter.readSnapshot('shared-account').records.find(r => r.worldId === 'InitialWorld').deletedAt, null);
  return { rejectedStaleCreate: true, rejectedStaleDelete: true, otherTabCreationRetained: true, tombstoneNotRevived: true, storageWrites: env.calls.filter(c => c.operation === 'setItem').length };
});
test('W13 repeated delete remains idempotent without storage/time rewrite and loaded empty snapshot remains empty', () => {
  const { s, writes } = session(); const world = create(s); s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: world.worldId });
  const before = s.getSnapshot(), count = writes.length; s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: world.worldId }); assert.strictEqual(s.getSnapshot(), before); assert.equal(writes.length, count);
  const empty = session('empty-account', { schemaVersion: 1, accountId: 'empty-account', records: [] }); assert.equal(empty.s.getWorlds().length, 0); assert.equal(empty.writes.length, 0);
  return { repeatedDeleteWrites: 0, originalTombstoneRetained: true, loadedEmptyActiveCount: 0, loadedEmptySeedWrites: 0 };
});
test('W14 dynamic presentation reader reflects latest active session and deep-detaches callers with exact entry fields', () => {
  const { s } = session(); const reader = createWorldFolderReader('account-A', () => s.getWorlds()); assert.equal(reader.getWorlds().length, 1);
  const a = create(s), first = reader.getWorlds(); assert.equal(first.length, 2); assert.deepEqual(Object.keys(first[1]).sort(), ['worldId', 'title', 'description'].sort());
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first[1])); s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: a.worldId });
  assert.equal(reader.getWorlds().length, 1); assert.equal(first.length, 2, 'Prior reader snapshot must not mutate after deletion.');
  const mutable = [{ worldId: 'world-external', title: 'external', description: 'mutable fixture' }], external = createWorldFolderReader('account-B', () => mutable), detached = external.getWorlds();
  mutable[0].title = 'changed'; assert.equal(detached[0].title, 'external'); assert.equal(Object.isFrozen(mutable[0]), false);
  return { afterCreate: first.length, afterDelete: reader.getWorlds().length, oldSnapshotRetained: true, metadataFieldsOnly: true, mutableBoundaryDetached: true };
});
test('W15 account startup remains Login -> Prologue -> WorldFolder with persistence failure transaction and separate milestone keys', () => {
  const env = memory(), storage = new AccountStartupStorage(), startup = new AccountStartupSession(snapshot => storage.saveCompletion(snapshot));
  assert.equal(storage.readCompletion('new-account'), false); startup.submitStartupIntent({ kind: 'Login', accountId: 'new-account', PrologueCompleted: false });
  assert.equal(startup.getStartupSnapshot().phase, 'Prologue'); const before = startup.getStartupSnapshot(); env.controls.writeError = new Error('milestone quota exceeded');
  assert.throws(() => startup.submitStartupIntent({ kind: 'CompletePrologue' })); assert.strictEqual(startup.getStartupSnapshot(), before);
  env.controls.writeError = null; startup.submitStartupIntent({ kind: 'CompletePrologue' }); assert.equal(startup.getStartupSnapshot().phase, 'WorldFolder');
  assert.equal(storage.readCompletion('new-account'), true); assert.equal(storage.readCompletion('other-account'), false);
  assert.deepEqual([...env.values.keys()], ['neurou-account-milestone-v1:new-account']);
  return { firstAccountCompleted: true, secondAccountNeedsPrologue: true, failedMilestoneLeavesPrologue: true, worldRegistryKeysWrittenByStartup: 0 };
});
const report = { generatedAt: new Date().toISOString(), scope: 'Actual WorldFolderSession and WorldLocalStorage, with deterministic ID/time/persist/storage boundaries. Metadata only; no claim of gameplay/WorldFork persistence.',
  passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks };
fs.writeFileSync(path.join(output, 'logic-results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.failed ? 1 : 0;
