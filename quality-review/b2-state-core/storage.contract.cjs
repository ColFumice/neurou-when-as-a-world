'use strict';

// Isolated storage/codec contracts; no fixture is a production clear or restore.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, file);
const load = file => require(path.join(root, file));
const { WorldStateCodec } = load('src/director/WorldStateCodec.ts');
const { LedgerHydration } = load('src/director/LedgerHydration.ts');
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { validatePuzzleProgressSnapshot } = load('src/director/PuzzleHydration.ts');
const { WorldCoreStateStorage } = load('src/presentation/WorldCoreStateStorage.ts');
const { FormatTimeStorage } = load('src/presentation/FormatTimeStorage.ts');
const content = parseWorldNarrativeContent(JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/world/primary-rain-dialogue.json'), 'utf8')));
const accountId = 'core-contract-account', worldId = 'InitialWorld';
const context = { accountId, worldId, worldKind: 'Primary', protagonistCharacterId: content.protagonistCharacterId };
const ledgerHydration = new LedgerHydration(context, content);
const coreKey = (account, world) => 'neurou-world-state-v1:' + encodeURIComponent(account) + ':' + encodeURIComponent(world);
const clone = raw => JSON.parse(JSON.stringify(raw));
const results = [];
const tick = () => new Promise(resolve => setImmediate(resolve));
function keyLock() {
  const pending = new Map(); const names = [];
  return { names, request(name, operation) {
    names.push(name); const turn = (pending.get(name) || Promise.resolve()).catch(() => undefined).then(operation);
    pending.set(name, turn); return turn;
  } };
}
function base(overrides = {}) {
  return { schemaVersion: 1, accountId, worldId, worldKind: 'Unavailable', shoreOrigin: 'Unavailable',
    revision: 0, capturedAt: 1791580800000, kind: 'Core',
    sections: { Ledger: null, PuzzleProgress: null, FormatTime: { epochMs: 1791580700000 } }, ...overrides };
}
function puzzle() {
  return { schemaVersion: 1, accountId, worldId, chainId: 'T6_MAIN_CHAIN', deepTraceId: 'T6_MAIN_DEEP_TRACE',
    ruleVersion: 1, chartId: 'guidance-c-1', chain: { stage: 'Step1', sustainedStartMs: -1, sustainedElapsedMs: 0,
      lastHitBeatTimeMs: -1, nextBeatTimeMs: -1, beatIntervalMs: 1000, requiredSustainedMs: 7000 },
    control: { currentPerceptionMode: 'Normal', beatClockOffsetMs: 0, endpointSettled: false,
      deepTraceTriggered: false, chartCompletionRecorded: false, revealPhase: 'Idle', chartEntryScheduled: false, worldMotionGated: false } };
}
function session() {
  const legacy = { submitFrameIntents() {}, getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready', isWorldMotionGated: () => false };
  return new WorldClearSession(context, content, legacy, { readRecords: () => [], now: () => 1791580800000, async commitRecord() {} });
}
function validate(raw, account = accountId, world = worldId) {
  let ledger = null;
  return new WorldStateCodec({
    Ledger(value) { ledger = ledgerHydration.validate(value); return ledger; },
    PuzzleProgress(value) { return validatePuzzleProgressSnapshot(value, account, world, 'T6_MAIN_CHAIN',
      'T6_MAIN_DEEP_TRACE', 'guidance-c-1', ledger?.characters.find(character => character.characterId === content.protagonistCharacterId)?.events ?? []); },
  }).parse(raw, account, world);
}
function fixture(options = {}) {
  const values = new Map(); const writes = [];
  let writeFails = false; let active = true;
  const io = { getItem: key => values.has(key) ? values.get(key) : null, setItem(key, value) {
    if (writeFails) { throw new Error('fixture quota failure'); }
    writes.push({ key, value }); values.set(key, value);
  } };
  const lock = options.lock === undefined ? keyLock() : options.lock;
  const adapter = new WorldCoreStateStorage(io, lock, validate, () => active);
  return { values, writes, io, lock, adapter, format: new FormatTimeStorage(adapter),
    failWrite: value => { writeFails = value; }, tombstone: () => { active = false; } };
}
async function test(name, run) { await run(); results.push({ name, category: 'ContractTest', result: 'PASS' }); }

(async () => {
  await test('read absence preserves historical missing FormatTime and writes nothing', () => {
    const f = fixture(); assert.equal(f.adapter.readCoreState(accountId, worldId), null);
    assert.equal(f.format.readFormatTime(accountId, worldId), null); assert.equal(f.values.size, 0);
  });
  await test('explicit new-world initialization requires lease and proof, then writes authority once', async () => {
    const f = fixture(); assert.throws(() => f.format.initializeFormatTime(base(), true), /租约/);
    const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    assert.throws(() => f.format.initializeFormatTime(base(), false), /新世界创建/);
    f.format.initializeFormatTime(base(), true);
    assert.equal(f.format.readFormatTime(accountId, worldId).epochMs, 1791580700000);
    assert.throws(() => f.format.initializeFormatTime(base(), true), /陈旧/);
    assert.equal(f.writes.length, 1); lease.release();
  });
  await test('world lease uses encoded identity and rejects writes after release', async () => {
    const f = fixture(); const account = '账号:a/b%'; const world = '世界:1/2';
    const lease = await f.adapter.acquireWorldLease(account, world);
    assert.equal(f.lock.names[0], 'neurou-world-state:' + encodeURIComponent(account) + ':' + encodeURIComponent(world));
    f.adapter.saveCoreState(base({ accountId: account, worldId: world }), null);
    lease.release(); lease.release();
    assert.throws(() => f.adapter.saveCoreState(base({ accountId: account, worldId: world }), null), /租约/);
  });
  await test('same instance rejects duplicate pending/held lease; separate adapters serialize the same world', async () => {
    const f = fixture(); const first = await f.adapter.acquireWorldLease(accountId, worldId);
    await assert.rejects(f.adapter.acquireWorldLease(accountId, worldId), /已持有/);
    const secondAdapter = new WorldCoreStateStorage(f.io, f.lock, validate, () => true);
    let acquired = false;
    const queued = secondAdapter.acquireWorldLease(accountId, worldId).then(value => { acquired = true; return value; });
    await tick(); assert.equal(acquired, false);
    first.release(); const second = await queued; assert.equal(acquired, true); second.release();
  });
  await test('different worlds have independent leases with account/world isolation', async () => {
    const f = fixture(); const one = await f.adapter.acquireWorldLease(accountId, worldId);
    const two = await f.adapter.acquireWorldLease(accountId, 'world-other');
    f.adapter.saveCoreState(base(), null); f.adapter.saveCoreState(base({ worldId: 'world-other' }), null);
    assert.equal(f.values.size, 2); one.release(); two.release();
  });
  await test('release waits for retained pending account commits before another runtime obtains the world lease', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    let finishOne; let finishTwo;
    const firstCommit = new Promise(resolve => { finishOne = resolve; });
    const secondCommit = new Promise((resolve, reject) => { finishTwo = reject; });
    lease.retainUntil(firstCommit); lease.retainUntil(secondCommit); lease.release();
    assert.throws(() => lease.retainUntil(Promise.resolve()), /请求释放/);
    const secondAdapter = new WorldCoreStateStorage(f.io, f.lock, validate, () => true);
    let acquired = false;
    const queued = secondAdapter.acquireWorldLease(accountId, worldId).then(value => { acquired = true; return value; });
    await tick(); assert.equal(acquired, false);
    finishOne(); await tick(); assert.equal(acquired, false);
    finishTwo(new Error('fixture account projection failure'));
    const next = await queued; assert.equal(acquired, true); next.release();
    assert.throws(() => f.adapter.saveCoreState(base(), null), /租约/);
  });
  await test('missing lock and failing provider reject without holding phantom leases or writing data', async () => {
    const unsupported = fixture({ lock: null });
    await assert.rejects(unsupported.adapter.acquireWorldLease(accountId, worldId), /独占锁/);
    assert.equal(unsupported.values.size, 0);
    let fail = true;
    const provider = { request(name, operation) { if (fail) { throw new Error('lock provider failed'); } return operation(); } };
    const f = fixture({ lock: provider });
    await assert.rejects(f.adapter.acquireWorldLease(accountId, worldId), /provider failed/);
    fail = false; const lease = await f.adapter.acquireWorldLease(accountId, worldId); lease.release();
  });
  await test('locked save requires expected current state and monotonic revision; identical retry does not rewrite bytes', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    const first = f.adapter.saveCoreState(base(), null);
    const pretty = JSON.stringify(first, null, 3); f.values.set(coreKey(accountId, worldId), pretty);
    f.adapter.saveCoreState(first, first); assert.equal(f.values.get(coreKey(accountId, worldId)), pretty);
    assert.equal(f.writes.length, 1);
    const next = { ...first, revision: 1, capturedAt: first.capturedAt + 1 };
    assert.throws(() => f.adapter.saveCoreState(next, null), /陈旧/);
    assert.throws(() => f.adapter.saveCoreState({ ...next, revision: 3 }, first), /递增/);
    f.adapter.saveCoreState(next, first); assert.equal(f.adapter.readValidatedCoreState(accountId, worldId).revision, 1);
    assert.throws(() => f.adapter.saveCoreState({ ...next, revision: 2 }, first), /陈旧/); lease.release();
  });
  await test('quota failure preserves prior bytes and does not publish a durable next revision', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    const first = f.adapter.saveCoreState(base(), null); const before = f.values.get(coreKey(accountId, worldId));
    f.failWrite(true);
    assert.throws(() => f.adapter.saveCoreState({ ...first, revision: 1 }, first), /quota/);
    assert.equal(f.values.get(coreKey(accountId, worldId)), before); lease.release();
  });
  await test('known immutable FormatTime cannot be changed or removed; old null cannot be filled later', async () => {
    for (const initialTime of [{ epochMs: 10 }, null]) {
      const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
      const initial = base(); initial.sections.FormatTime = initialTime;
      const first = f.adapter.saveCoreState(initial, null); const before = f.values.get(coreKey(accountId, worldId));
      const altered = clone(first); altered.revision++;
      altered.sections.FormatTime = initialTime === null ? { epochMs: 20 } : null;
      assert.throws(() => f.adapter.saveCoreState(altered, first), /创建时刻/);
      assert.equal(f.values.get(coreKey(accountId, worldId)), before); lease.release();
    }
  });
  await test('tombstone blocks further world writes while bytes and independent account clear keys remain intact', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    const first = f.adapter.saveCoreState(base(), null); const before = f.values.get(coreKey(accountId, worldId));
    const accountKey = 'neurou-account-world-clears-v1:' + encodeURIComponent(accountId);
    f.values.set(accountKey, 'separate-account-record'); f.tombstone();
    assert.throws(() => f.adapter.saveCoreState({ ...first, revision: 1 }, first), /已删除/);
    assert.equal(f.values.get(coreKey(accountId, worldId)), before);
    assert.equal(f.values.get(accountKey), 'separate-account-record'); lease.release();
  });
  await test('published content validates combined Ledger/Puzzle/Format sections and produces cloned frozen data', () => {
    const world = session(); const raw = base({ worldKind: 'Primary', shoreOrigin: null });
    raw.sections.Ledger = world.getLedgerSnapshot(); raw.sections.PuzzleProgress = [puzzle()];
    const parsed = validate(raw); assert(Object.isFrozen(parsed)); assert(Object.isFrozen(parsed.sections));
    assert(Object.isFrozen(parsed.sections.Ledger.characters)); assert(Object.isFrozen(parsed.sections.PuzzleProgress[0].chain));
    raw.sections.FormatTime.epochMs = 12; assert.equal(parsed.sections.FormatTime.epochMs, 1791580700000);
    assert.equal(parsed.kind, 'Core'); assert.equal('Complete' in parsed, false);
  });
  await test('atomic combined checkpoint enforces durable Ledger prefix even when bypassing section facade', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    const world = session(); const raw = base({ worldKind: 'Primary', shoreOrigin: null });
    raw.sections.Ledger = world.getLedgerSnapshot(); raw.sections.PuzzleProgress = [puzzle()];
    const empty = f.adapter.saveCoreState(raw, null);
    world.submitFrameIntents([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }], 1 / 60);
    const chosen = f.adapter.saveCoreState({ ...empty, revision: 1, sections: { ...empty.sections, Ledger: world.getLedgerSnapshot() } }, empty);
    assert.equal(chosen.sections.Ledger.characters[0].events.length, 1);
    const before = f.values.get(coreKey(accountId, worldId));
    const rollback = { ...empty, revision: 2 };
    assert.throws(() => f.adapter.saveCoreState(rollback, chosen), /事件|回退/);
    const removed = { ...chosen, revision: 2, sections: { ...chosen.sections, Ledger: null } };
    assert.throws(() => f.adapter.saveCoreState(removed, chosen), /账本身份/);
    assert.equal(f.values.get(coreKey(accountId, worldId)), before); lease.release();
  });
  await test('known world kind cannot be changed, but unavailable identity can be enriched by formal content', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
    const unknown = f.adapter.saveCoreState(base(), null);
    const known = f.adapter.saveCoreState({ ...unknown, revision: 1, worldKind: 'Primary', shoreOrigin: null }, unknown);
    assert.throws(() => f.adapter.saveCoreState({ ...known, revision: 2, worldKind: 'Shore', shoreOrigin: 'BugShore' }, known), /不可改写/);
    lease.release();
  });
  await test('nullable sections never bypass missing bound domain validators', () => {
    const codec = new WorldStateCodec(); assert.equal(codec.parse(base()).sections.Ledger, null);
    const ledger = base(); ledger.sections.Ledger = session().getLedgerSnapshot(); assert.throws(() => codec.parse(ledger), /账本状态验证器/);
    const puzzles = base(); puzzles.sections.PuzzleProgress = []; assert.throws(() => codec.parse(puzzles), /解谜状态验证器/);
  });
  for (const [label, mutate] of [
    ['wrong schema', raw => { raw.schemaVersion = 2; }], ['wrong kind', raw => { raw.kind = 'Complete'; }],
    ['missing field', raw => { delete raw.capturedAt; }], ['extra field', raw => { raw.complete = true; }],
    ['bad identity', raw => { raw.accountId = ' account'; }], ['unencodable identity', raw => { raw.worldId = '\ud800'; }],
    ['negative revision', raw => { raw.revision = -1; }], ['fractional revision', raw => { raw.revision = 0.5; }],
    ['bad captured time', raw => { raw.capturedAt = Infinity; }], ['Primary origin', raw => { raw.worldKind = 'Primary'; }],
    ['Shore origin', raw => { raw.worldKind = 'Shore'; raw.shoreOrigin = null; }],
    ['unknown world kind', raw => { raw.worldKind = 'Copy'; }],
    ['extra section', raw => { raw.sections.ChartScore = {}; }], ['missing section', raw => { delete raw.sections.Ledger; }],
    ['negative FormatTime', raw => { raw.sections.FormatTime.epochMs = -1; }],
    ['extra FormatTime', raw => { raw.sections.FormatTime.createdAt = 10; }],
    ['non-plain prototype', raw => { Object.setPrototypeOf(raw, { inherited: true }); }],
    ['symbol field', raw => { raw[Symbol('hidden')] = 1; }],
  ]) {
    await test('strict core codec rejects ' + label + ' without writes', async () => {
      const raw = base(); mutate(raw); assert.throws(() => validate(raw));
      const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId);
      assert.throws(() => f.adapter.saveCoreState(raw, null)); assert.equal(f.values.size, 0); lease.release();
    });
  }
  await test('codec rejects duplicate/sparse puzzle list and cross-world section identities', () => {
    const raw = base(); raw.sections.PuzzleProgress = [puzzle(), puzzle()]; assert.throws(() => validate(raw), /重复/);
    const sparse = base(); sparse.sections.PuzzleProgress = [puzzle()]; delete sparse.sections.PuzzleProgress[0]; assert.throws(() => validate(sparse));
    const cross = base(); cross.sections.PuzzleProgress = [puzzle()]; cross.sections.PuzzleProgress[0].accountId = 'other'; assert.throws(() => validate(cross));
  });
  await test('accessors and revoked proxies fail safely; getter code never runs at codec or platform boundary', async () => {
    const f = fixture(); const lease = await f.adapter.acquireWorldLease(accountId, worldId); let gets = 0;
    const raw = base(); Object.defineProperty(raw, 'accountId', { get() { gets++; return accountId; } });
    assert.throws(() => validate(raw)); assert.throws(() => f.adapter.saveCoreState(raw, null));
    const nested = base(); Object.defineProperty(nested.sections.FormatTime, 'epochMs', { get() { gets++; return 5; } });
    assert.throws(() => validate(nested)); assert.throws(() => f.format.initializeFormatTime(nested, true));
    const proxy = Proxy.revocable(base(), {}); proxy.revoke(); assert.throws(() => validate(proxy.proxy));
    assert.throws(() => f.adapter.saveCoreState(proxy.proxy, null)); assert.equal(gets, 0); assert.equal(f.values.size, 0); lease.release();
  });
  for (const [label, raw] of [['malformed', '{bad'], ['null', 'null'], ['array', '[]'],
    ['old header-only', JSON.stringify({ schemaVersion: 1, accountId, worldId, worldKind: 'Primary', shoreOrigin: null, revision: 0, capturedAt: 1 })],
    ['future schema', JSON.stringify({ ...base(), schemaVersion: 2 })]]) {
    await test('existing ' + label + ' bytes are retained when reading or saving rejects', async () => {
      const f = fixture(); const key = coreKey(accountId, worldId); f.values.set(key, raw);
      assert.throws(() => f.adapter.readValidatedCoreState(accountId, worldId));
      const lease = await f.adapter.acquireWorldLease(accountId, worldId);
      assert.throws(() => f.adapter.saveCoreState(base(), null)); assert.equal(f.values.get(key), raw);
      assert.equal(f.writes.length, 0); lease.release();
    });
  }
  const report = { category: 'ContractTest', note: 'Isolated in-memory locks and storage plus actual domain validators; no production world clear or Cocos restore is claimed.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'storage.contract-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'storage.contract-results.json'), JSON.stringify({ category: 'ContractTest',
    passed: results.length, failed: 1, results, error: error.stack || String(error) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
