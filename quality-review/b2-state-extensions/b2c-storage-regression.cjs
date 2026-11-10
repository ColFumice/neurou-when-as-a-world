'use strict';

// Isolated adapter fixtures. This file never grants a production world-clear fact.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..', '..');
require.extensions['.ts'] = (loaded, filename) => {
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
  }).outputText, filename);
};
const { NarrativeDimension: Dimension } = require(path.join(root, 'constants/index.ts'));
const { WorldClearStorage } = require(path.join(root, 'src/presentation/WorldClearStorage.ts'));
const { AccountMilestoneStorage } = require(path.join(root, 'src/presentation/AccountMilestoneStorage.ts'));
const { createAccountMilestoneReader } = require(path.join(root, 'src/director/AccountMilestone.ts'));
const { validateWorldClearRecord, validateWorldClearProjection } = require(path.join(root, 'src/director/RouteSignature.ts'));
const { WorldFolderSession } = require(path.join(root, 'src/director/WorldFolderSession.ts'));
const { WorldLocalStorage } = require(path.join(root, 'src/presentation/WorldLocalStorage.ts'));
const recordKey = id => 'neurou-account-world-clears-v1:' + encodeURIComponent(id);
const milestoneKey = id => 'neurou-account-first-world-cleared-v1:' + encodeURIComponent(id);
const results = [];

function record(accountId = 'account-a', worldId = 'world-a') {
  const position = Array.from({ length: Object.values(Dimension).filter(value => typeof value === 'number').length }, () => 0);
  position[Dimension.Green] = 5;
  position[Dimension.NarrativeTime] = 2;
  return {
    schemaVersion: 1, accountId, worldId, worldKind: 'Primary', protagonistCharacterId: 'protagonist-a',
    ChartRef: { chartId: 'world-boss-a', state: 'PremiereCompleted' }, contentRevision: 'content-v1',
    completionEventId: 'world-completion-a', clearedAt: { epochMs: 1791580800000 },
    routeSignature: { VectorSchemaVersion: 1, ledgerPosition: position, classificationVersion: 1,
      divergenceAxis: Dimension.Green, narrativeTime: 2 },
  };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function queueLock() {
  const pending = new Map();
  const names = [];
  return {
    names,
    request(name, operation) {
      names.push(name);
      const turn = (pending.get(name) || Promise.resolve()).catch(() => undefined).then(operation);
      pending.set(name, turn);
      return turn;
    },
  };
}
function fixture(lock = queueLock()) {
  const values = new Map();
  const writes = [];
  let failKey = null;
  const io = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) {
      if (key === failKey) { throw new Error('simulated quota failure'); }
      writes.push({ key, value }); values.set(key, value);
    },
  };
  return { values, writes, io, lock, adapter: new WorldClearStorage(io, lock),
    milestone: new AccountMilestoneStorage(io), fail(key) { failKey = key; } };
}
async function test(name, run) { await run(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }

(async () => {
  await test('missing collection stays empty without writing default or projection', async () => {
    const f = fixture();
    assert.deepEqual(f.adapter.readWorldClearRecords('account-a'), []);
    assert(Object.isFrozen(f.adapter.readWorldClearRecords('account-a')));
    assert.equal(await f.adapter.reconcileAccount('account-a', f.milestone), false);
    assert.equal(f.values.size, 0);
  });

  await test('record persists before milestone; existing B2.2a reader derives CopyPermission', async () => {
    const f = fixture();
    const r = record();
    const records = await f.adapter.commitRecord(r, f.milestone);
    assert.deepEqual(records, [r]);
    assert.deepEqual(f.writes.map(item => item.key), [recordKey(r.accountId), milestoneKey(r.accountId)]);
    const snapshot = createAccountMilestoneReader(r.accountId, f.milestone.readProjection(r.accountId)).getMilestoneSnapshot();
    assert.equal(snapshot.FirstWorldCleared, true); assert.equal(snapshot.CopyPermission, true);
    assert.equal('CopyPermission' in JSON.parse(f.values.get(milestoneKey(r.accountId))), false);
    assert.deepEqual(validateWorldClearProjection(JSON.parse(f.values.get(recordKey(r.accountId))), r.accountId).records, records);
    assert(Object.isFrozen(records)); assert(Object.isFrozen(records[0]));
    assert(Object.isFrozen(records[0].routeSignature.ledgerPosition));
  });

  await test('encoded account key isolates records from other accounts and world-state/folder keys', async () => {
    const f = fixture(); const id = '账号:a/b%';
    const otherKey = 'neurou-world-state-v1:' + encodeURIComponent(id) + ':world-a';
    f.values.set(otherKey, 'existing-state');
    await f.adapter.commitRecord(record(id), f.milestone);
    assert.equal(f.values.get(otherKey), 'existing-state');
    assert.equal(f.adapter.readWorldClearRecords('account-a').length, 0);
    assert.equal(f.adapter.readWorldClearRecords(id)[0].accountId, id);
    assert.equal(f.lock.names[0], 'neurou-world-clear:' + encodeURIComponent(id));
  });

  await test('actual directory DeleteWorld persists tombstone while account clear record and milestone bytes survive', async () => {
    const f = fixture(); const accountId = 'account-a';
    const folderStorage = new WorldLocalStorage(f.io);
    let expected = folderStorage.readSnapshot(accountId);
    let timestamp = 1791580800000;
    const folder = new WorldFolderSession(accountId, expected, snapshot => {
      folderStorage.saveSnapshot(snapshot, expected); expected = snapshot;
    }, () => 'world-contract-created', () => ++timestamp);
    assert.equal(folder.getWorldRecord('InitialWorld').deletedAt, null);
    await f.adapter.commitRecord(record(accountId, 'InitialWorld'), f.milestone);
    const recordBytes = f.values.get(recordKey(accountId));
    const milestoneBytes = f.values.get(milestoneKey(accountId));
    folder.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: 'InitialWorld' });
    const persistedDirectory = folderStorage.readSnapshot(accountId);
    assert.equal(folder.getWorlds().length, 0);
    assert.throws(() => folder.getWorldRecord('InitialWorld'), /已删除/);
    assert.equal(persistedDirectory.records[0].worldId, 'InitialWorld');
    assert(Number.isSafeInteger(persistedDirectory.records[0].deletedAt));
    assert(persistedDirectory.records[0].deletedAt >= persistedDirectory.records[0].createdAt);
    assert.equal(f.values.get(recordKey(accountId)), recordBytes);
    assert.equal(f.values.get(milestoneKey(accountId)), milestoneBytes);
    assert.equal(f.adapter.readWorldClearRecords(accountId).length, 1);
    assert.equal(f.adapter.readWorldClearRecords(accountId)[0].worldId, 'InitialWorld');
    assert.equal(createAccountMilestoneReader(accountId, f.milestone.readProjection(accountId))
      .getMilestoneSnapshot().CopyPermission, true);
  });

  await test('record write failure never reads or saves the milestone and retains prior bytes', async () => {
    const f = fixture(); f.fail(recordKey('account-a'));
    let reads = 0; let writes = 0;
    await assert.rejects(f.adapter.commitRecord(record(), {
      readProjection() { reads++; return null; }, saveProjection() { writes++; },
    }), /quota/);
    assert.equal(reads, 0); assert.equal(writes, 0); assert.equal(f.values.size, 0);
  });

  await test('projection failure preserves record and next locked reconciliation retries false to true', async () => {
    const f = fixture(); f.fail(milestoneKey('account-a'));
    await assert.rejects(f.adapter.commitRecord(record(), f.milestone), /quota/);
    const before = f.values.get(recordKey('account-a'));
    assert.equal(f.adapter.readWorldClearRecords('account-a').length, 1);
    assert.equal(f.milestone.readProjection('account-a'), null);
    f.fail(null);
    assert.equal(await f.adapter.reconcileAccount('account-a', f.milestone), true);
    assert.equal(f.values.get(recordKey('account-a')), before);
    assert.equal(f.milestone.readProjection('account-a').FirstWorldCleared, true);
    assert.equal(f.writes.filter(item => item.key === recordKey('account-a')).length, 1);
  });

  await test('same record retry preserves exact record bytes and skips repeated true projection writes', async () => {
    const f = fixture(); const r = record();
    await f.adapter.commitRecord(r, f.milestone);
    const prettified = JSON.stringify(JSON.parse(f.values.get(recordKey(r.accountId))), null, 3);
    f.values.set(recordKey(r.accountId), prettified);
    const beforeWrites = f.writes.length;
    await f.adapter.commitRecord(clone(r), f.milestone);
    assert.equal(f.values.get(recordKey(r.accountId)), prettified);
    assert.equal(f.writes.length, beforeWrites);
  });

  await test('same account/world conflict rejects with original route and milestone bytes untouched', async () => {
    const f = fixture(); await f.adapter.commitRecord(record(), f.milestone);
    const before = new Map(f.values); const changed = record();
    changed.routeSignature.ledgerPosition[Dimension.Green] = 8;
    await assert.rejects(f.adapter.commitRecord(changed, f.milestone), /已有不同/);
    assert.deepEqual(f.values, before);
  });

  await test('two adapters sharing account lock retain both worlds without lost-update record overwrite', async () => {
    const f = fixture(); const second = new WorldClearStorage(f.io, f.lock);
    await Promise.all([
      f.adapter.commitRecord(record('account-a', 'world-a'), f.milestone),
      second.commitRecord(record('account-a', 'world-b'), f.milestone),
    ]);
    assert.deepEqual(f.adapter.readWorldClearRecords('account-a').map(r => r.worldId), ['world-a', 'world-b']);
    assert.equal(f.writes.filter(item => item.key === milestoneKey('account-a')).length, 1);
  });

  await test('concurrent identical completion inserts once; concurrent conflict cannot overwrite winner', async () => {
    const f = fixture(); const second = new WorldClearStorage(f.io, f.lock);
    await Promise.all([f.adapter.commitRecord(record(), f.milestone), second.commitRecord(record(), f.milestone)]);
    assert.equal(f.writes.filter(item => item.key === recordKey('account-a')).length, 1);
    const changed = record(); changed.contentRevision = 'different';
    await assert.rejects(second.commitRecord(changed, f.milestone), /已有不同/);
    assert.equal(f.adapter.readWorldClearRecords('account-a')[0].contentRevision, 'content-v1');
  });

  await test('no lock support and public synchronous insertion reject before either key is written', async () => {
    const f = fixture(null);
    await assert.rejects(f.adapter.commitRecord(record(), f.milestone), /没有账号独占锁/);
    await assert.rejects(f.adapter.reconcileAccount('account-a', f.milestone), /没有账号独占锁/);
    assert.throws(() => f.adapter.saveWorldClearRecord(record()), /独占锁/);
    assert.equal(f.values.size, 0);
  });

  await test('existing true projection is retained even without records and is never saved again', async () => {
    const f = fixture(); const p = { schemaVersion: 1, accountId: 'account-a', FirstWorldCleared: true };
    f.values.set(milestoneKey('account-a'), JSON.stringify(p));
    assert.equal(await f.adapter.reconcileAccount('account-a', f.milestone), true);
    await f.adapter.commitRecord(record(), f.milestone);
    assert.equal(f.writes.filter(item => item.key === milestoneKey('account-a')).length, 0);
  });

  await test('existing false projection updates only after actual locked record persistence', async () => {
    const f = fixture(); const p = { schemaVersion: 1, accountId: 'account-a', FirstWorldCleared: false };
    f.values.set(milestoneKey('account-a'), JSON.stringify(p));
    assert.equal(await f.adapter.reconcileAccount('account-a', f.milestone), false);
    assert.equal(f.writes.length, 0);
    await f.adapter.commitRecord(record(), f.milestone);
    assert.equal(f.milestone.readProjection('account-a').FirstWorldCleared, true);
  });

  await test('corrupt milestone fails without overwriting it; durable record remains for repair/retry', async () => {
    const f = fixture(); const bad = '{corrupt'; f.values.set(milestoneKey('account-a'), bad);
    await assert.rejects(f.adapter.commitRecord(record(), f.milestone), /损坏/);
    assert.equal(f.values.get(milestoneKey('account-a')), bad);
    assert.equal(f.adapter.readWorldClearRecords('account-a').length, 1);
    await assert.rejects(f.adapter.reconcileAccount('account-a', f.milestone), /损坏/);
  });

  await test('stale projection expected fails without overwriting newer current and can reconcile afterwards', async () => {
    const f = fixture(); let changed = false;
    const racingMilestone = {
      readProjection: id => f.milestone.readProjection(id),
      saveProjection(p, expected) {
        if (!changed) { changed = true; f.milestone.saveProjection({ ...p, FirstWorldCleared: false }, null); }
        f.milestone.saveProjection(p, expected);
      },
    };
    await assert.rejects(f.adapter.commitRecord(record(), racingMilestone), /其他页面/);
    assert.equal(f.milestone.readProjection('account-a').FirstWorldCleared, false);
    assert.equal(f.adapter.readWorldClearRecords('account-a').length, 1);
    assert.equal(await f.adapter.reconcileAccount('account-a', f.milestone), true);
  });

  const invalidMutations = [
    ['schema', r => { r.schemaVersion = 2; }],
    ['world kind', r => { r.worldKind = 'Copy'; }],
    ['Entry reference', r => { r.ChartRef.state = 'Entry'; }],
    ['missing state', r => { delete r.ChartRef.state; }],
    ['unknown state', r => { r.ChartRef.state = 'Completed'; }],
    ['extra chart field', r => { r.ChartRef.tier = 'World'; }],
    ['vector version', r => { r.routeSignature.VectorSchemaVersion = 2; }],
    ['classification version', r => { r.routeSignature.classificationVersion = 2; }],
    ['wrong axis', r => { r.routeSignature.divergenceAxis = Dimension.Red; }],
    ['wrong narrative time', r => { r.routeSignature.narrativeTime = 9; }],
    ['short vector', r => { r.routeSignature.ledgerPosition.pop(); }],
    ['negative vector', r => { r.routeSignature.ledgerPosition[Dimension.Green] = -1; }],
    ['nonfinite vector', r => { r.routeSignature.ledgerPosition[Dimension.Green] = Infinity; }],
    ['NaN vector', r => { r.routeSignature.ledgerPosition[Dimension.Green] = NaN; }],
    ['all zero vector', r => { r.routeSignature.ledgerPosition.fill(0); r.routeSignature.narrativeTime = 0; r.routeSignature.divergenceAxis = null; }],
    ['negative timestamp', r => { r.clearedAt.epochMs = -1; }],
    ['fractional timestamp', r => { r.clearedAt.epochMs = 0.5; }],
    ['extra record field', r => { r.CopyPermission = true; }],
    ['missing record field', r => { delete r.contentRevision; }],
    ['unencodable account', r => { r.accountId = '\ud800'; }],
    ['oversized account', r => { r.accountId = 'a'.repeat(65); }],
    ['oversized world', r => { r.worldId = 'a'.repeat(129); }],
    ['whitespace identity', r => { r.protagonistCharacterId = ' protagonist-a'; }],
    ['empty chart identity', r => { r.ChartRef.chartId = ''; }],
    ['unbound chart identity', r => { r.ChartRef.chartId = 'CHART_NOT_BOUND'; }],
    ['symbol property', r => { r[Symbol('unexpected')] = 1; }],
    ['vector extra property', r => { r.routeSignature.ledgerPosition.extra = 1; }],
    ['sparse vector', r => { delete r.routeSignature.ledgerPosition[Dimension.White]; }],
    ['record prototype', r => { Object.setPrototypeOf(r, { inherited: true }); }],
    ['vector prototype', r => { Object.setPrototypeOf(r.routeSignature.ledgerPosition, { inherited: true }); }],
  ];
  for (const [label, mutate] of invalidMutations) {
    await test('reject invalid ' + label + ' in both domain and storage before writes', async () => {
      const f = fixture(); const r = record(); mutate(r);
      assert.throws(() => validateWorldClearRecord(r));
      await assert.rejects(f.adapter.commitRecord(r, f.milestone));
      assert.equal(f.values.size, 0);
    });
  }

  await test('positive exact tie selects first emotion and no emotion preserves null without default', async () => {
    const f = fixture(); const tied = record();
    tied.routeSignature.ledgerPosition[Dimension.Red] = 5;
    tied.routeSignature.divergenceAxis = Dimension.Red;
    assert.deepEqual(validateWorldClearRecord(tied), tied);
    await f.adapter.commitRecord(tied, f.milestone);
    const unemotional = record('account-b');
    unemotional.routeSignature.ledgerPosition[Dimension.Green] = 0;
    unemotional.routeSignature.divergenceAxis = null;
    assert.deepEqual(validateWorldClearRecord(unemotional), unemotional);
    await f.adapter.commitRecord(unemotional, f.milestone);
    assert.equal(f.adapter.readWorldClearRecords('account-b')[0].routeSignature.divergenceAxis, null);
  });

  for (const [label, raw] of [
    ['malformed JSON', '{bad'], ['JSON null', 'null'], ['array', '[]'],
    ['unknown version', JSON.stringify({ schemaVersion: 2, accountId: 'account-a', records: [] })],
    ['mismatched account', JSON.stringify({ schemaVersion: 1, accountId: 'account-b', records: [] })],
    ['duplicate worlds', JSON.stringify({ schemaVersion: 1, accountId: 'account-a', records: [record(), record()] })],
    ['foreign record', JSON.stringify({ schemaVersion: 1, accountId: 'account-a', records: [record('account-b')] })],
    ['extra projection field', JSON.stringify({ schemaVersion: 1, accountId: 'account-a', records: [], CopyPermission: true })],
  ]) {
    await test('damaged persisted ' + label + ' is quarantined and exact bytes retained', async () => {
      const f = fixture(); f.values.set(recordKey('account-a'), raw);
      assert.throws(() => f.adapter.readWorldClearRecords('account-a'));
      await assert.rejects(f.adapter.commitRecord(record(), f.milestone));
      await assert.rejects(f.adapter.reconcileAccount('account-a', f.milestone));
      assert.equal(f.values.get(recordKey('account-a')), raw);
      assert.equal(f.milestone.readProjection('account-a'), null); assert.equal(f.writes.length, 0);
    });
  }

  await test('nested field and vector accessors never execute; revoked Proxy fails safely', async () => {
    const f = fixture(); let calls = 0;
    const nested = record();
    Object.defineProperty(nested.ChartRef, 'chartId', { get() { calls++; return 'world-boss-a'; } });
    await assert.rejects(f.adapter.commitRecord(nested, f.milestone));
    const vector = record();
    Object.defineProperty(vector.routeSignature.ledgerPosition, String(Dimension.Green), { get() { calls++; return 5; } });
    await assert.rejects(f.adapter.commitRecord(vector, f.milestone));
    const revoked = Proxy.revocable(record(), {}); revoked.revoke();
    await assert.rejects(f.adapter.commitRecord(revoked.proxy, f.milestone), /无法安全读取/);
    assert.equal(calls, 0); assert.equal(f.values.size, 0);
  });

  await test('proxy get traps and caller mutation cannot alter validated immutable stored record', async () => {
    const f = fixture(); let gets = 0; const raw = record();
    const proxied = new Proxy(raw, { get() { gets++; throw new Error('must not get'); } });
    const pending = f.adapter.commitRecord(proxied, f.milestone);
    raw.routeSignature.ledgerPosition[Dimension.Green] = 500;
    raw.ChartRef.chartId = 'mutated';
    const stored = await pending;
    assert.equal(stored[0].routeSignature.ledgerPosition[Dimension.Green], 5);
    assert.equal(stored[0].ChartRef.chartId, 'world-boss-a'); assert.equal(gets, 0);
  });

  const report = { category: 'ContractTest',
    note: 'In-memory strict adapter/lock fixtures only; no fixture constitutes a production world clear or preview acceptance.',
    passed: results.length, failed: 0, results };
  fs.writeFileSync(path.join(__dirname, 'b2c-storage-regression-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ category: report.category, passed: report.passed, failed: report.failed }));
})().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'b2c-storage-regression-results.json'), JSON.stringify({
    category: 'ContractTest', passed: results.length, failed: 1, results,
    error: error instanceof Error ? error.stack : String(error),
  }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
