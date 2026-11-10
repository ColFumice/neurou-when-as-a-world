'use strict';

// Contract adapter tests only. The true fixtures below are NOT production world clears.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..', '..');

function load(relative) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const { AccountMilestoneStorage } = load('src/presentation/AccountMilestoneStorage.ts');
const prefix = 'neurou-account-first-world-cleared-v1:';
const key = accountId => prefix + encodeURIComponent(accountId);
const projection = (accountId, FirstWorldCleared) => ({ schemaVersion: 1, accountId, FirstWorldCleared });
const results = [];
function test(name, run) { run(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
function fixture() {
  const values = new Map();
  let failWrite = false;
  const io = {
    getItem: k => values.has(k) ? values.get(k) : null,
    setItem: (k, v) => { if (failWrite) { throw new Error('simulated quota failure'); } values.set(k, v); },
  };
  return { values, adapter: new AccountMilestoneStorage(io), fail: () => { failWrite = true; } };
}

test('missing projection is readonly false and does not write a default', () => {
  const f = fixture();
  const reader = createAccountMilestoneReader('account-a', f.adapter.readProjection('account-a'));
  assert.deepEqual(reader.getMilestoneSnapshot(), { accountId: 'account-a', FirstWorldCleared: false, CopyPermission: false });
  assert.equal(f.values.size, 0);
  assert(Object.isFrozen(reader)); assert(Object.isFrozen(reader.getMilestoneSnapshot()));
});

test('separate encoded key preserves startup and folder keys', () => {
  const f = fixture(); const id = '账号:a/b%';
  const startup = 'neurou-account-milestone-v1:' + encodeURIComponent(id);
  const folder = 'neurou-world-folder-v1:' + encodeURIComponent(id);
  f.values.set(startup, '{"PrologueCompleted":true}');
  f.values.set(folder, '{"directory":"untouched"}');
  f.adapter.saveProjection(projection(id, false), null);
  assert.equal(f.values.get(startup), '{"PrologueCompleted":true}');
  assert.equal(f.values.get(folder), '{"directory":"untouched"}');
  assert.deepEqual(JSON.parse(f.values.get(key(id))), projection(id, false));
});

test('CopyPermission true derives from a valid fixture with no stored derived field', () => {
  const f = fixture(); const p = projection('account-a', true);
  f.adapter.saveProjection(p, null);
  const reader = createAccountMilestoneReader('account-a', f.adapter.readProjection('account-a'));
  assert.equal(reader.getMilestoneSnapshot().CopyPermission, true);
  assert.deepEqual(Object.keys(JSON.parse(f.values.get(key('account-a')))).sort(), ['FirstWorldCleared', 'accountId', 'schemaVersion']);
});

test('account isolation keeps one account true and another missing false', () => {
  const f = fixture(); f.adapter.saveProjection(projection('account-a', true), null);
  assert.equal(createAccountMilestoneReader('account-a', f.adapter.readProjection('account-a')).getMilestoneSnapshot().CopyPermission, true);
  assert.equal(createAccountMilestoneReader('account-b', f.adapter.readProjection('account-b')).getMilestoneSnapshot().CopyPermission, false);
  assert.equal(f.values.size, 1);
});

test('false to true and true to true are valid adapter transitions', () => {
  const f = fixture(); const a = projection('account-a', false); const b = projection('account-a', true);
  f.adapter.saveProjection(a, null); f.adapter.saveProjection(b, a); f.adapter.saveProjection(b, b);
  assert.deepEqual(f.adapter.readProjection('account-a'), b);
});

test('true to false is rejected and retains persisted true', () => {
  const f = fixture(); const a = projection('account-a', false); const b = projection('account-a', true);
  f.adapter.saveProjection(b, null); const before = f.values.get(key('account-a'));
  assert.throws(() => f.adapter.saveProjection(a, b), /不可/);
  assert.equal(f.values.get(key('account-a')), before);
});

test('stale false expected cannot erase a persisted true', () => {
  const f = fixture(); const a = projection('account-a', false); const b = projection('account-a', true);
  f.adapter.saveProjection(b, null); const before = f.values.get(key('account-a'));
  assert.throws(() => f.adapter.saveProjection(a, a), /不可/);
  assert.throws(() => f.adapter.saveProjection(a, null), /不可/);
  assert.equal(f.values.get(key('account-a')), before);
});

test('a known prior true cannot be downgraded even if external storage was removed', () => {
  const f = fixture();
  assert.throws(() => f.adapter.saveProjection(projection('account-a', false), projection('account-a', true)), /不可/);
  assert.equal(f.values.size, 0);
});

test('stale expected is rejected without overwriting actual current', () => {
  const f = fixture(); const a = projection('account-a', false); const b = projection('account-a', true);
  f.adapter.saveProjection(a, null); const before = f.values.get(key('account-a'));
  assert.throws(() => f.adapter.saveProjection(b, null), /其他页面/);
  assert.equal(f.values.get(key('account-a')), before);
});

test('write failure keeps old storage and published readonly reader', () => {
  const f = fixture(); const a = projection('account-a', false); f.adapter.saveProjection(a, null);
  const reader = createAccountMilestoneReader('account-a', f.adapter.readProjection('account-a'));
  const before = f.values.get(key('account-a')); f.fail();
  assert.throws(() => f.adapter.saveProjection(projection('account-a', true), a), /quota/);
  assert.equal(f.values.get(key('account-a')), before);
  assert.equal(reader.getMilestoneSnapshot().CopyPermission, false);
});

const invalid = [
  ['JSON null', 'null'],
  ['malformed JSON', '{bad'],
  ['array', '[]'],
  ['primitive', 'true'],
  ['unknown schema', JSON.stringify({ ...projection('account-a', true), schemaVersion: 2 })],
  ['mismatched account', JSON.stringify(projection('account-b', true))],
  ['noncanonical account', JSON.stringify(projection(' account-a ', true))],
  ['boolean string', JSON.stringify({ ...projection('account-a', false), FirstWorldCleared: 'true' })],
  ['boolean numeric', JSON.stringify({ ...projection('account-a', false), FirstWorldCleared: 1 })],
  ['missing fact', JSON.stringify({ schemaVersion: 1, accountId: 'account-a' })],
  ['persisted derived value', JSON.stringify({ ...projection('account-a', true), CopyPermission: true })],
];
for (const [label, raw] of invalid) {
  test('reject ' + label + ' on read and preserve original bytes', () => {
    const f = fixture(); f.values.set(key('account-a'), raw);
    assert.throws(() => f.adapter.readProjection('account-a'));
    assert.throws(() => f.adapter.saveProjection(projection('account-a', true), null));
    assert.equal(f.values.get(key('account-a')), raw);
    // Reader's null means adapter-confirmed absence; persisted JSON null is rejected by adapter.
    if (label !== 'malformed JSON' && label !== 'JSON null') {
      assert.throws(() => createAccountMilestoneReader('account-a', JSON.parse(raw)));
    }
  });
}

test('invalid caller identity and non-data fields fail explicitly', () => {
  const f = fixture();
  for (const id of ['', ' account-a', 'account-a ', 'a'.repeat(65), '\ud800']) {
    assert.throws(() => f.adapter.readProjection(id));
    assert.throws(() => createAccountMilestoneReader(id, null));
  }
  const invalidData = projection('account-a', false);
  Object.defineProperty(invalidData, 'FirstWorldCleared', { get() { throw new Error('must not execute'); } });
  assert.throws(() => createAccountMilestoneReader('account-a', invalidData), /字段/);
  assert.throws(() => f.adapter.saveProjection(invalidData, null), /字段/);
  assert.equal(f.values.size, 0);
});

test('reader derives from a cloned immutable projection without caller alias', () => {
  const raw = projection('account-a', false);
  const reader = createAccountMilestoneReader('account-a', raw);
  raw.FirstWorldCleared = true;
  assert.equal(reader.getMilestoneSnapshot().FirstWorldCleared, false);
  assert.equal(reader.getMilestoneSnapshot().CopyPermission, false);
  assert.throws(() => { reader.getMilestoneSnapshot().CopyPermission = true; }, TypeError);
});

test('unknown Proxy inputs are read once through descriptors, without property get traps', () => {
  const f = fixture(); let gets = 0;
  const raw = new Proxy(projection('account-a', false), {
    get() { gets++; return 'unexpected getter result'; },
  });
  assert.equal(createAccountMilestoneReader('account-a', raw).getMilestoneSnapshot().CopyPermission, false);
  f.adapter.saveProjection(raw, null);
  assert.equal(f.adapter.readProjection('account-a').FirstWorldCleared, false);
  assert.equal(gets, 0);
});

test('revoked Proxy and inherited inputs fail explicitly without writes', () => {
  const f = fixture();
  const revoked = Proxy.revocable(projection('account-a', true), {}); revoked.revoke();
  assert.throws(() => createAccountMilestoneReader('account-a', revoked.proxy), /无法安全读取/);
  assert.throws(() => f.adapter.saveProjection(revoked.proxy, null), /无法安全读取/);
  const inherited = Object.assign(Object.create({ inherited: true }), projection('account-a', true));
  assert.throws(() => createAccountMilestoneReader('account-a', inherited), /字段/);
  assert.throws(() => f.adapter.saveProjection(inherited, null), /字段/);
  assert.equal(f.values.size, 0);
});

test('account accessor is rejected without invoking user code', () => {
  const f = fixture(); let calls = 0;
  const raw = { schemaVersion: 1, FirstWorldCleared: true };
  Object.defineProperty(raw, 'accountId', { enumerable: true, get() { calls++; return 'account-a'; } });
  assert.throws(() => createAccountMilestoneReader('account-a', raw), /字段/);
  assert.throws(() => f.adapter.saveProjection(raw, null), /字段/);
  assert.equal(calls, 0); assert.equal(f.values.size, 0);
});

const report = {
  category: 'ContractTest',
  note: 'Isolated in-memory adapter fixtures only; true values do not prove or trigger production world clears.',
  passed: results.length,
  failed: 0,
  results,
};
fs.writeFileSync(path.join(__dirname, 'account-milestone.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
