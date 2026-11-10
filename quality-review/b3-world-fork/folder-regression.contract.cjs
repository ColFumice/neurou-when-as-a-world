'use strict';
// Actual WorldFolderBuilder plus its real director/storage graph. Only Cocos
// lifecycle, resource loading and visual nodes are controlled environment adapters.
// This is a contract suite, not evidence of Cocos rendering or production play.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), Module = require('node:module');
const h = require('../b2-state-extensions/state-test-fixture.cjs');
const { load, clone, fixture, content, regular, epochMs } = h;
const { WorldLocalStorage } = load('src/presentation/WorldLocalStorage.ts');
const { WorldFolderSession } = load('src/director/WorldFolderSession.ts');
const { AccountStartupStorage } = load('src/presentation/FolderStartupView.ts');
const callbacks = [], root = h.root, originalLoad = Module._load;
class Component { constructor() { this.enabled = true; this.__destroyed = false; } }
class Node {
  constructor(name = '') { Object.assign(this, { name, parent: null, children: [], layer: 1, active: true, components: new Map(), destroyCalls: 0 }); }
  addChild(node) { node.parent = this; this.children.push(node); }
  addComponent(Type) { const component = new Type(); component.node = this; this.components.set(Type, component); return component; }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  destroy() { this.destroyCalls++; this.__destroyed = true; for (const component of this.components.values()) { component.__destroyed = true; component.onDestroy?.(); } }
}
class UITransform extends Component { constructor() { super(); this.width = 1920; this.height = 1080; } setContentSize(width, height) { Object.assign(this, { width, height }); } }
class Canvas extends Component {} class Camera extends Component {} Camera.ClearFlag = { SOLID_COLOR: 1, DEPTH_ONLY: 2 };
class JsonAsset {}
class WorldFolderView {
  constructor(reader, open, editors, port, reload, milestoneReader, capture, restore, availability) {
    Object.assign(this, { reader, open, editors, port, reload, milestoneReader, capture, restore, availability, statuses: [], destroyed: false });
  }
  mount() { this.mounted = true; } destroy() { this.destroyed = true; } showStatus(status) { this.statuses.push(status); }
}
class EditorFolderView { constructor(catalog, open, back) { Object.assign(this, { catalog, open, back }); } mount() {} destroy() {} }
class FolderStartupView { showLogin(login) { this.login = login; } showPrologue(account, text, complete) { this.complete = complete; }
  showError(error) { this.error = error; } destroy() {} }
class MinimalWorldBuilder extends Component { bindEntry(entry) { this.entry = entry; } }
class GuidanceEditorBuilder extends Component {} class MusicEditorBuilder extends Component {}
const cc = { _decorator: { ccclass: () => Type => Type }, Component, Node, UITransform, Canvas, Camera, JsonAsset,
  isValid: value => value != null && value.__destroyed !== true, Director: { EVENT_AFTER_DRAW: 'after-draw' },
  director: { once(type, fn, target) { callbacks.push({ type, fn, target }); },
    off(type, fn, target) { const index = callbacks.findIndex(item => item.type === type && item.fn === fn && item.target === target);
      if (index >= 0) { callbacks.splice(index, 1); } } },
  resources: { load(resource, _Type, callback) { queueMicrotask(() => {
    try { callback(null, { json: JSON.parse(fs.readFileSync(path.join(root, 'assets/resources', resource + '.json'), 'utf8')) }); }
    catch (error) { callback(error, null); }
  }); } } };
Module._load = function(request, parent, isMain) {
  if (request === 'cc') { return cc; }
  if (request.endsWith('/WorldFolderView')) { return { WorldFolderView }; }
  if (request.endsWith('/EditorFolderView')) { return { EditorFolderView }; }
  if (request.endsWith('/FolderStartupView')) { return { AccountStartupStorage, FolderStartupView }; }
  if (request === './MinimalWorldBuilder') { return { MinimalWorldBuilder }; }
  if (request === './GuidanceEditorBuilder') { return { GuidanceEditorBuilder }; }
  if (request === './MusicEditorBuilder') { return { MusicEditorBuilder }; }
  return originalLoad.call(this, request, parent, isMain);
};
const { WorldFolderBuilder } = load('assets/scripts/WorldFolderBuilder.ts');
Module._load = originalLoad;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate, label) {
  for (let index = 0; index < 100; index++) { if (predicate()) { return; } await tick(); }
  throw new Error('Async fixture did not settle: ' + label);
}
function environment() {
  callbacks.length = 0; const values = new Map(), writes = [], controls = { failRead: false, failWrite: false, failKey: null };
  const storage = { getItem(key) { if (controls.failRead) { throw new Error('controlled read failure'); } return values.get(key) ?? null; },
    setItem(key, bytes) { if (controls.failWrite || controls.failKey === key) { throw new Error('controlled atomic quota failure'); }
      values.set(key, bytes); writes.push({ key, bytes }); }, removeItem(key) { values.delete(key); },
    get length() { return values.size; }, key(index) { return [...values.keys()][index] ?? null; } };
  const held = new Set(), tails = new Map();
  const locks = { request(name, options, operation) {
    if (options.ifAvailable && held.has(name)) { return Promise.resolve().then(() => operation(null)); }
    const preceding = tails.get(name) || Promise.resolve();
    const run = preceding.catch(() => {}).then(async () => { held.add(name); try { return await operation({ name }); } finally { held.delete(name); } });
    tails.set(name, run); return run;
  } };
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  if (!globalThis.crypto?.randomUUID) { Object.defineProperty(globalThis, 'crypto', { value: require('node:crypto').webcrypto, configurable: true }); }
  const dom = [];
  global.document = { createElement() { return { style: { setProperty() {} }, remove() { this.removed = true; } }; },
    body: { appendChild(value) { dom.push(value); } } };
  return { values, writes, controls, held, storage, dom };
}
async function boot(env, accountId = 'folder-regression', factory = () => {}) {
  const node = new Node('Folder'), builder = node.addComponent(WorldFolderBuilder); node.addComponent(UITransform);
  builder.bindWorldFactory(factory); builder.start(); builder.startupView.login(accountId);
  if (builder.startupView.complete) { builder.startupView.complete(); }
  await until(() => builder.folderView !== null, 'folder startup');
  assert.equal(builder.startup.getStartupSnapshot().phase, 'WorldFolder');
  return builder;
}
function close(builder) { builder.__destroyed = true; builder.onDestroy(); }
function external(accountId, operation) {
  const storage = new WorldLocalStorage(); let expected = storage.readSnapshot(accountId);
  const session = new WorldFolderSession(accountId, expected, snapshot => { storage.saveSnapshot(snapshot, expected); expected = snapshot; },
    () => 'world-' + crypto.randomUUID(), () => epochMs); operation(session); return session;
}
function drain() { for (const item of callbacks.splice(0)) { item.fn.call(item.target); } }
const folderKey = accountId => 'neurou-world-folder-v1:' + encodeURIComponent(accountId);
const coreKey = (accountId, worldId) => 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(worldId);
const results = [];
async function test(name, operation) {
  try { await operation(); results.push({ name, result: 'PASS', category: 'ContractTest' }); }
  catch (error) { results.push({ name, result: 'FAIL', category: 'ContractTest', error: String(error.stack) }); }
}
(async () => {
  await test('actual asynchronous startup publishes only initial metadata/FormatTime and no gameplay before selection', async () => {
    const env = environment(); let factoryCalls = 0; const b = await boot(env, 'startup-contract', () => factoryCalls++);
    try {
      assert.equal(factoryCalls, 0); assert.equal(b.runtimeNode, null); assert.equal(b.folderView.reader.getWorlds().length, 1);
      const core = JSON.parse(env.values.get(coreKey('startup-contract', 'InitialWorld')));
      assert.equal(core.sections.Ledger, null); assert.equal(core.sections.PuzzleProgress, null); assert.ok(core.sections.FormatTime.epochMs > 0);
      assert.equal(b.folderView.availability(), 'Implemented'); assert.equal(b.folderView.milestoneReader.getMilestoneSnapshot().CopyPermission, false);
    } finally { close(b); }
  });
  await test('actual create writes new leased FormatTime before directory and preserves EmptyWorld minimal factory', async () => {
    const env = environment(); let primaryCalls = 0; const b = await boot(env, 'create-contract', () => primaryCalls++);
    try {
      b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: '空白世界', description: '本地独立元数据' });
      await until(() => !b.directoryBusy && b.folderSession.getWorlds().length === 2, 'create');
      const record = b.folderSession.getWorlds()[1], coreIndex = env.writes.findIndex(item => item.key === coreKey('create-contract', record.worldId));
      const folderIndex = env.writes.findIndex((item, index) => index > coreIndex && item.key === folderKey('create-contract'));
      assert.ok(coreIndex >= 0 && folderIndex > coreIndex); assert.equal(record.template, 'EmptyWorld');
      await b.openWorld(record); assert.equal(primaryCalls, 0); assert.equal(b.runtimeNode.getComponent(MinimalWorldBuilder).entry.worldId, record.worldId);
      assert.equal(b.folderView, null);
    } finally { close(b); }
  });
  await test('actual initial selection and rapid duplicate opens invoke configured factory once', async () => {
    const env = environment(); let calls = 0; const b = await boot(env, 'initial-contract', () => calls++);
    try { const record = b.folderView.reader.getWorlds()[0]; await Promise.all([b.openWorld(record), b.openWorld(record)]);
      assert.equal(calls, 1); assert.equal(b.runtimeNode.name, 'InitialWorld'); assert.equal(b.runtimeNode.getComponent(MinimalWorldBuilder), null);
    } finally { close(b); }
  });
  await test('actual open rechecks stale tombstone/foreign card and preserves stored bytes without runtime creation', async () => {
    const env = environment(), b = await boot(env, 'stale-contract');
    try {
      await b.createWorld('stale-contract', '将被删除', ''); await until(() => b.folderView !== null, 'created view');
      const stale = b.folderSession.getWorlds()[1]; external('stale-contract', session => session.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: stale.worldId }));
      const before = env.values.get(folderKey('stale-contract')); await b.openWorld(stale); assert.equal(b.runtimeNode, null);
      assert.match(b.folderView.statuses.at(-1), /世界未能打开/); await b.openWorld({ worldId: 'world-other-account', title: '外来卡片', description: '' });
      assert.equal(b.runtimeNode, null); assert.equal(env.values.get(folderKey('stale-contract')), before);
    } finally { close(b); }
  });
  await test('actual queued create re-reads latest directory under lock and retains another tab record', async () => {
    const env = environment(), b = await boot(env, 'merge-contract');
    try {
      const other = external('merge-contract', session => session.submitWorldFolderIntent({ kind: 'CreateWorld', title: '另一页', description: '' }));
      const otherId = other.getWorlds()[1].worldId;
      await b.createWorld('merge-contract', '本页创建', ''); await until(() => b.folderSession?.getWorlds().length === 3, 'merged create');
      assert.ok(b.folderSession.getWorlds().some(item => item.worldId === otherId));
      assert.ok(b.folderSession.getWorlds().some(item => item.title === '本页创建'));
    } finally { close(b); }
  });
  await test('actual create directory quota failure publishes no ghost and a later fresh create succeeds', async () => {
    const env = environment(), b = await boot(env, 'quota-create-contract');
    try {
      const before = env.values.get(folderKey('quota-create-contract')); env.controls.failKey = folderKey('quota-create-contract');
      await b.createWorld('quota-create-contract', '不可见', ''); assert.equal(env.values.get(folderKey('quota-create-contract')), before);
      assert.equal(b.folderSession.getWorlds().length, 1); assert.match(b.folderView.statuses.at(-1), /世界未能创建/);
      env.controls.failKey = null; await b.createWorld('quota-create-contract', '可见', '');
      await until(() => b.folderSession?.getWorlds().length === 2, 'create retry'); assert.equal(b.folderSession.getWorlds()[1].title, '可见');
    } finally { close(b); }
  });
  await test('actual delete publishes tombstone first and leased GC removes only chart collections', async () => {
    const env = environment(), b = await boot(env, 'delete-contract');
    try {
      const f = fixture({ accountId: 'delete-contract', worldId: 'InitialWorld' }); env.values.set(coreKey('delete-contract', 'InitialWorld'), JSON.stringify(f.initial));
      const ledger = clone(f.initial.sections.Ledger); await b.deleteWorld('delete-contract', 'InitialWorld');
      const directory = JSON.parse(env.values.get(folderKey('delete-contract'))), core = JSON.parse(env.values.get(coreKey('delete-contract', 'InitialWorld')));
      assert.notEqual(directory.records[0].deletedAt, null); assert.deepEqual(core.sections.Ledger, ledger);
      assert.equal(core.sections.ChartSnapshot, null); assert.equal(core.sections.ChartScore, null); assert.equal(b.folderView.reader.getWorlds().length, 0);
      const tombstoneWrite = env.writes.findIndex(item => item.key === folderKey('delete-contract') && JSON.parse(item.bytes).records[0].deletedAt !== null);
      const gcWrite = env.writes.findIndex((item, index) => index > tombstoneWrite && item.key === coreKey('delete-contract', 'InitialWorld'));
      assert.ok(gcWrite > tombstoneWrite);
    } finally { close(b); }
  });
  await test('actual GC quota failure keeps durable tombstone and current active list then refresh retries cleanup', async () => {
    const env = environment(), b = await boot(env, 'gc-retry-contract');
    try {
      await b.createWorld('gc-retry-contract', '保留活跃', ''); await until(() => b.folderSession?.getWorlds().length === 2, 'create before GC');
      const f = fixture({ accountId: 'gc-retry-contract', worldId: 'InitialWorld' }); env.values.set(coreKey('gc-retry-contract', 'InitialWorld'), JSON.stringify(f.initial));
      const before = env.values.get(coreKey('gc-retry-contract', 'InitialWorld')); env.controls.failKey = coreKey('gc-retry-contract', 'InitialWorld');
      await assert.rejects(() => b.deleteWorld('gc-retry-contract', 'InitialWorld'), /quota/);
      assert.notEqual(JSON.parse(env.values.get(folderKey('gc-retry-contract'))).records[0].deletedAt, null);
      assert.equal(env.values.get(coreKey('gc-retry-contract', 'InitialWorld')), before); assert.equal(b.folderView.reader.getWorlds().length, 1);
      assert.match(b.folderView.statuses.at(-1), /墓碑保留/); env.controls.failKey = null; await b.renderWorldFolder();
      assert.equal(JSON.parse(env.values.get(coreKey('gc-retry-contract', 'InitialWorld'))).sections.ChartSnapshot, null);
      assert.equal(b.folderView.reader.getWorlds()[0].title, '保留活跃');
    } finally { close(b); }
  });
  await test('actual corrupt directory remains unavailable, untouched and editors accessible', async () => {
    const env = environment(), b = await boot(env, 'corrupt-contract');
    try {
      env.values.set(folderKey('corrupt-contract'), '{broken json'); await b.renderWorldFolder();
      assert.equal(b.folderSession, null); assert.equal(b.folderView.reader.getWorlds().length, 0);
      assert.match(b.folderView.statuses.at(-1), /世界目录未能加载/); assert.equal(env.values.get(folderKey('corrupt-contract')), '{broken json');
      assert.throws(() => b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: 'ghost', description: '' }));
      b.folderView.editors(); assert.ok(b.catalogView); assert.equal(b.runtimeNode, null);
    } finally { close(b); }
  });
  await test('actual exit deactivates/destroys once, keeps lease through draw, then refreshes latest external directory', async () => {
    const env = environment(), b = await boot(env, 'exit-contract');
    try {
      const record = b.folderSession.getWorlds()[0]; await b.openWorld(record); const runtime = b.runtimeNode;
      external('exit-contract', session => session.submitWorldFolderIntent({ kind: 'CreateWorld', title: '外页新增', description: '' }));
      b.exitRuntime(); b.exitRuntime(); assert.equal(runtime.active, false); assert.equal(runtime.destroyCalls, 1);
      assert.equal(b.retiring, true); assert.equal(callbacks.length, 1); assert.ok(b.coreStorage.hasWorldLease('exit-contract', 'InitialWorld'));
      await b.openWorld(record); assert.equal(b.runtimeNode, null); drain();
      await until(() => b.folderView !== null && b.folderSession.getWorlds().length === 2, 'retirement render');
      assert.equal(b.retiring, false); assert.equal(b.coreStorage.hasWorldLease('exit-contract', 'InitialWorld'), false);
    } finally { close(b); }
  });
  await test('actual composition failure rolls back runtime and lease with visible error then permits retry', async () => {
    const env = environment(); let partial = null;
    const b = await boot(env, 'composition-contract', runtime => { partial = runtime; throw new Error('controlled composition failure'); });
    try {
      const view = b.folderView, record = b.folderSession.getWorlds()[0]; await b.openWorld(record);
      assert.ok(partial); assert.equal(partial.active, false); assert.equal(partial.destroyCalls, 1); assert.equal(b.runtimeNode, null);
      assert.equal(b.folderView, view); assert.match(view.statuses.at(-1), /controlled composition failure/); drain();
      assert.equal(b.retiring, false); assert.equal(b.folderView, view); b.bindWorldFactory(() => {});
      await b.openWorld(record); assert.ok(b.runtimeNode);
    } finally { close(b); }
  });
  await test('actual destruction cancels pending draw callback and prevents asynchronous view reconstruction', async () => {
    const env = environment(), b = await boot(env, 'destroy-contract');
    await b.openWorld(b.folderSession.getWorlds()[0]); b.exitRuntime(); assert.equal(callbacks.length, 1);
    close(b); assert.equal(callbacks.length, 0); drain(); await tick(); assert.equal(b.folderView, null);
  });
  const report = { batch: 'B2.3-existing-folder-regression', category: 'ContractTest', productionClaim: false,
    note: 'Actual startup/create/delete/GC/exit root and real persistence with async resource/lock/lifecycle adapters; no game runtime is mocked as production acceptance.',
    passed: results.filter(item => item.result === 'PASS').length, failed: results.filter(item => item.result === 'FAIL').length, results };
  fs.writeFileSync(path.join(__dirname, 'folder-regression-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  for (const item of results.filter(item => item.result === 'FAIL')) { console.error(item.name + '\n' + item.error); }
  if (report.failed) { process.exitCode = 1; }
})().catch(error => { console.error(error); process.exitCode = 1; });
