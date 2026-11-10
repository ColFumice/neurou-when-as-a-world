'use strict';
// Isolated contract tests only. No browser, Creator, production storage or gameplay.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const crypto = require('crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const sources = ['src/director/WorldStateSession.ts', 'src/presentation/WorldStateStorage.ts'];
const checks = [];
function test(id, run) {
  try { run(); checks.push({ id, passed: true }); }
  catch (error) { checks.push({ id, passed: false, error: String(error.stack) }); }
}
function load(relative) {
  const filename = path.join(root, relative);
  const text = fs.readFileSync(filename, 'utf8');
  const code = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(code, filename);
  return loaded.exports;
}
function medium() {
  const values = new Map();
  const reads = [];
  const writes = [];
  return { values, reads, writes,
    getItem(key) { reads.push(key); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes.push({ key, value }); values.set(key, value); },
  };
}
function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) frozenTree(child);
}
const director = load(sources[0]);
const { WorldStateSession, validateWorldStateHeader } = director;
const { WorldStateStorage } = load(sources[1]);
let time = 1000;
const session = new WorldStateSession('account-one', 'world-one', () => time);
const completeHeader = {
  schemaVersion: 1, accountId: 'account-one', worldId: 'world-one',
  worldKind: 'Primary', shoreOrigin: null, revision: 3, capturedAt: 1000,
};

test('initial-reader-has-no-capture-and-fork-is-not-implemented', () => {
  assert.equal(session.getLastCaptureResult(), null);
  assert.equal(session.worldForkAvailability, 'NotImplemented');
});
const expectedOwnership = {
  Ledger: ['WorldObserver', ['accountId', 'worldId', 'characterId']],
  PuzzleProgress: ['WorldObserver', ['accountId', 'worldId', 'chainId']],
  RecallCount: ['WorldObserver', ['accountId', 'worldId', 'characterId', 'NarrativeEventId']],
  FormatTime: ['WorldInstance', ['accountId', 'worldId']],
  WorldLink: ['WorldInstance', ['accountId', 'worldId', 'sourceWorldId']],
  ChartSnapshot: ['WorldObserver', ['accountId', 'worldId', 'ChartRef']],
  ChartScore: ['WorldObserver', ['accountId', 'worldId', 'ChartRef']],
};
for (const [section, [owner, indexes]] of Object.entries(expectedOwnership)) {
  test('ownership-contract-' + section, () => {
    assert.equal(session.ownership[section].owner, owner);
    assert.deepEqual(session.ownership[section].indexes, indexes);
    assert.equal(session.ownership[section].codec, 'NotImplemented');
    assert.ok(session.ownership[section].requires.length > 0);
    frozenTree(session.ownership[section]);
  });
}
test('format-time-proposal-and-world-link-applicability-are-metadata', () => {
  assert.deepEqual(session.ownership.FormatTime.proposal, { epochMs: 'NonNegativeSafeInteger' });
  assert.equal(session.ownership.WorldLink.appliesTo, 'BugShore');
  assert.equal('value' in session.ownership.FormatTime, false);
});
const capture = session.captureWorldState();
test('capture-is-incomplete-with-seven-missing-sections-and-control-diagnostics', () => {
  assert.equal(capture.kind, 'Incomplete');
  assert.equal('snapshot' in capture, false);
  assert.deepEqual(capture.capturedParts, {});
  for (const section of Object.keys(expectedOwnership)) {
    assert.ok(capture.issues.some(issue => issue.section === section));
  }
  assert.ok(capture.issues.some(issue => issue.section === 'RuntimeBoundary' && issue.reason === 'IdentityUnavailable'));
  assert.ok(capture.issues.some(issue => issue.reason === 'UnsupportedBoundary'));
});
test('candidate-header-has-all-fields-with-explicit-unavailable-values', () => {
  assert.deepEqual(Object.keys(capture.candidate).sort(),
    ['schemaVersion', 'accountId', 'worldId', 'worldKind', 'shoreOrigin', 'revision', 'capturedAt'].sort());
  assert.equal(capture.candidate.schemaVersion, 1);
  assert.equal(capture.candidate.accountId, 'account-one');
  assert.equal(capture.candidate.worldId, 'world-one');
  assert.equal(capture.candidate.worldKind, 'Unavailable');
  assert.equal(capture.candidate.shoreOrigin, 'Unavailable');
  assert.equal(capture.candidate.revision, 'Unavailable');
  assert.equal(capture.candidate.capturedAt, 1000);
});
test('capture-and-ownership-are-recursively-frozen', () => {
  frozenTree(capture);
  frozenTree(session.ownership);
  assert.throws(() => { capture.candidate.worldKind = 'Primary'; }, TypeError);
  assert.throws(() => { capture.issues.push({}); }, TypeError);
  assert.throws(() => { session.ownership.Ledger.indexes.push('forged'); }, TypeError);
  assert.strictEqual(session.getLastCaptureResult(), capture);
});
test('capture-publishes-a-new-diagnostic-result-only', () => {
  time = 2000;
  const second = session.captureWorldState();
  assert.notStrictEqual(second, capture);
  assert.strictEqual(session.getLastCaptureResult(), second);
  assert.equal(second.candidate.capturedAt, 2000);
  assert.equal(capture.candidate.capturedAt, 1000);
});
test('invalid-clock-retains-last-capture', () => {
  const previous = session.getLastCaptureResult();
  for (const invalid of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    time = invalid;
    assert.throws(() => session.captureWorldState(), /捕获时间无效/);
    assert.strictEqual(session.getLastCaptureResult(), previous);
  }
  time = 2000;
});

const malformed = [
  ['null', null, 'InvalidSnapshot'],
  ['array', [], 'InvalidSnapshot'],
  ['primitive', 'snapshot', 'InvalidSnapshot'],
  ['missing-fields', {}, 'InvalidSnapshot'],
  ['unknown-version', { ...completeHeader, schemaVersion: 999 }, 'SchemaUnsupported'],
  ['other-account', { ...completeHeader, accountId: 'account-two' }, 'IdentityMismatch'],
  ['other-world', { ...completeHeader, worldId: 'world-two' }, 'IdentityMismatch'],
  ['unknown-world-kind', { ...completeHeader, worldKind: 'InitialWorld' }, 'InvalidSnapshot'],
  ['primary-with-shore-origin', { ...completeHeader, shoreOrigin: 'BugShore' }, 'ReferenceMismatch'],
  ['shore-with-no-origin', { ...completeHeader, worldKind: 'Shore' }, 'ReferenceMismatch'],
  ['shore-with-unknown-origin', { ...completeHeader, worldKind: 'Shore', shoreOrigin: 'Other' }, 'ReferenceMismatch'],
  ['negative-revision', { ...completeHeader, revision: -1 }, 'InvalidSnapshot'],
  ['fractional-revision', { ...completeHeader, revision: 0.5 }, 'InvalidSnapshot'],
  ['invalid-time', { ...completeHeader, capturedAt: NaN }, 'InvalidSnapshot'],
];
for (const [name, raw, reason] of malformed) {
  test('restore-rejects-' + name + '-with-diagnostic', () => {
    const previous = session.getLastCaptureResult();
    const result = session.restoreWorldState(raw);
    assert.equal(result.kind, 'Rejected');
    assert.ok(result.issues.some(issue => issue.reason === reason));
    assert.ok(result.issues.some(issue => issue.reason === 'RestoreUnsupported'));
    assert.equal('snapshot' in result, false);
    assert.strictEqual(session.getLastCaptureResult(), previous);
    frozenTree(result);
  });
}
test('valid-header-is-only-header-valid-never-complete', () => {
  assert.deepEqual(validateWorldStateHeader(completeHeader, 'account-one', 'world-one'), []);
  for (const shoreOrigin of ['BugShore', 'FinalShore']) {
    assert.deepEqual(validateWorldStateHeader({ ...completeHeader, worldKind: 'Shore', shoreOrigin }, 'account-one', 'world-one'), []);
  }
  const result = session.restoreWorldState(completeHeader);
  assert.equal(result.kind, 'Rejected');
  assert.deepEqual(result.issues.map(issue => issue.reason), ['RestoreUnsupported']);
});
test('incomplete-and-forged-complete-restore-cannot-succeed', () => {
  for (const raw of [capture, { kind: 'Complete', snapshot: completeHeader }, { ...completeHeader, kind: 'Complete' }]) {
    const result = session.restoreWorldState(raw);
    assert.equal(result.kind, 'Rejected');
    assert.ok(result.issues.some(issue => issue.reason === 'RestoreUnsupported'));
  }
});
test('header-rejects-inherited-missing-and-accessor-fields-without-getter-invocation', () => {
  let getterCalls = 0;
  const accessor = { ...completeHeader };
  Object.defineProperty(accessor, 'accountId', { enumerable: true, get() { getterCalls++; throw new Error('must not invoke getter'); } });
  const missing = { ...completeHeader };
  delete missing.shoreOrigin;
  const throwingProxy = new Proxy({}, { getPrototypeOf() { throw new Error('unsafe input'); } });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const raw of [Object.create(completeHeader), accessor, missing, throwingProxy, revoked.proxy]) {
    const result = session.restoreWorldState(raw);
    assert.equal(result.kind, 'Rejected');
    assert.ok(result.issues.some(issue => issue.reason === 'InvalidSnapshot'));
    assert.ok(result.issues.some(issue => issue.reason === 'RestoreUnsupported'));
  }
  assert.equal(getterCalls, 0);
});
test('complete-snapshot-brand-prevents-structural-header-construction', () => {
  const virtual = path.join(__dirname, 'brand-proof.virtual.ts');
  const content = `import type { WorldStateSnapshot } from '../../src/director/WorldStateSession';
const candidate: WorldStateSnapshot = { schemaVersion: 1, accountId: 'a', worldId: 'w', worldKind: 'Primary', shoreOrigin: null, revision: 0, capturedAt: 0 };
export { candidate };`;
  const options = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true, lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'], types: [] };
  const host = ts.createCompilerHost(options);
  const oldGet = host.getSourceFile.bind(host);
  const oldExists = host.fileExists.bind(host);
  const oldRead = host.readFile.bind(host);
  host.getSourceFile = (file, language, ...rest) => path.resolve(file) === virtual
    ? ts.createSourceFile(file, content, language, true) : oldGet(file, language, ...rest);
  host.fileExists = file => path.resolve(file) === virtual || oldExists(file);
  host.readFile = file => path.resolve(file) === virtual ? content : oldRead(file);
  const program = ts.createProgram([virtual], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, 2741);
  assert.match(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'), /validatedWorldState/);
  assert.deepEqual(Object.keys(director).sort(), ['WorldStateSession', 'validateWorldStateHeader'].sort());
});

const store = medium();
const storage = new WorldStateStorage(store);
const key = (account, world) => 'neurou-world-state-v1:' + encodeURIComponent(account) + ':' + encodeURIComponent(world);
test('storage-missing-is-distinct-from-null-and-isolated-by-both-identities', () => {
  assert.equal(storage.readSnapshot('甲:乙/01', 'world:A/B?'), null);
  assert.equal(store.reads.at(-1), key('甲:乙/01', 'world:A/B?'));
  store.values.set(key('account-one', 'world-one'), JSON.stringify(completeHeader));
  assert.deepEqual(storage.readSnapshot('account-one', 'world-one'), completeHeader);
  assert.equal(storage.readSnapshot('account-two', 'world-one'), null);
  assert.equal(storage.readSnapshot('account-one', 'world-two'), null);
});
for (const [name, text] of [['bad-json', '{'], ['stored-null', 'null'], ['array', '[]'], ['primitive', '42']]) {
  test('storage-rejects-' + name + '-and-preserves-raw-value', () => {
    const target = key('broken-account', 'world-one');
    store.values.set(target, text);
    assert.throws(() => storage.readSnapshot('broken-account', 'world-one'));
    assert.equal(store.values.get(target), text);
    assert.equal(store.writes.length, 0);
  });
}
test('unknown-version-and-mismatched-storage-candidates-rejected-by-director', () => {
  for (const raw of [{ ...completeHeader, schemaVersion: 99 }, { ...completeHeader, accountId: 'other' }, { ...completeHeader, worldId: 'other' }]) {
    store.values.set(key('account-one', 'world-one'), JSON.stringify(raw));
    const candidate = storage.readSnapshot('account-one', 'world-one');
    assert.equal(session.restoreWorldState(candidate).kind, 'Rejected');
    assert.equal(store.values.get(key('account-one', 'world-one')), JSON.stringify(raw));
  }
});
test('all-save-inputs-rejected-with-zero-writes-and-unchanged-storage', () => {
  const before = [...store.values.entries()];
  for (const raw of [completeHeader, capture, { kind: 'Complete', snapshot: completeHeader }, {}, null]) {
    assert.throws(() => storage.saveSnapshot(raw), /保存尚未实现/);
  }
  assert.equal(store.writes.length, 0);
  assert.deepEqual([...store.values.entries()], before);
});
test('read-medium-failure-is-explicit-and-save-never-touches-medium', () => {
  let mediumCalls = 0;
  const unavailable = new WorldStateStorage({
    getItem() { mediumCalls++; throw new Error('medium unavailable'); },
    setItem() { mediumCalls++; throw new Error('must never write'); },
  });
  assert.throws(() => unavailable.readSnapshot('a', 'w'), /medium unavailable/);
  assert.equal(mediumCalls, 1);
  assert.throws(() => unavailable.saveSnapshot(completeHeader), /保存尚未实现/);
  assert.equal(mediumCalls, 1);
});
test('invalid-boundary-identities-rejected-before-storage-access', () => {
  const before = store.reads.length;
  for (const bad of ['', ' spaced ', 'x'.repeat(129), null]) {
    assert.throws(() => new WorldStateSession(bad, 'world-one'));
    assert.throws(() => new WorldStateSession('account-one', bad));
    assert.throws(() => storage.readSnapshot(bad, 'world-one'));
    assert.throws(() => storage.readSnapshot('account-one', bad));
  }
  assert.equal(store.reads.length, before);
});
test('account-max64-world-max128-and-invalid-unicode-rejected-explicitly', () => {
  assert.doesNotThrow(() => new WorldStateSession('a'.repeat(64), 'w'.repeat(128)));
  assert.throws(() => new WorldStateSession('a'.repeat(65), 'w'), /1～64/);
  assert.throws(() => storage.readSnapshot('a'.repeat(65), 'w'), /1～64/);
  const loneSurrogate = String.fromCharCode(0xD800);
  assert.throws(() => new WorldStateSession(loneSurrogate, 'w'), /无效字符/);
  assert.throws(() => new WorldStateSession('a', loneSurrogate), /无效字符/);
  assert.throws(() => storage.readSnapshot(loneSurrogate, 'w'), /无效字符/);
  assert.throws(() => storage.readSnapshot('a', loneSurrogate), /无效字符/);
});
const result = {
  suite: 'B2.2b world-state foundation contracts', evidenceClass: 'CONTRACT_TEST',
  scope: 'Injected in-memory medium and direct isolated API calls; no real gameplay restore, milestone completion, Cocos flow, or browser writes claimed.',
  runAt: new Date().toISOString(),
  sourceHashes: sources.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })),
  passed: checks.every(check => check.passed), count: checks.length,
  passedCount: checks.filter(check => check.passed).length, checks,
};
fs.writeFileSync(path.join(__dirname, 'world-state.contract-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, passedCount: result.passedCount, count: result.count }));
for (const check of checks.filter(check => !check.passed)) console.error(check.id, check.error);
if (!result.passed) process.exitCode = 1;
