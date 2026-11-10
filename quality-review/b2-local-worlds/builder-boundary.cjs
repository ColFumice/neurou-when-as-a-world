'use strict';
// Actual folder composition root, sessions and storage. Only cc lifecycle, views
// and target runtime component construction are injected environmental boundaries.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), Module = require('module'), ts = require('../../node_modules/typescript');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText, filename);
const { AccountStartupStorage } = require('../../src/presentation/FolderStartupView.ts');
const { WorldFolderSession } = require('../../src/director/WorldFolderSession.ts');
const { WorldLocalStorage } = require('../../src/presentation/WorldLocalStorage.ts');
const checks = [], callbacks = [], originalLoad = Module._load;
class Component { constructor() { this.enabled = true; this.__destroyed = false; } }
class Node { constructor(name = '') { this.name = name; this.parent = null; this.children = []; this.layer = 1; this.active = true; this.components = new Map(); this.destroyCalls = 0; }
  addChild(node) { node.parent = this; this.children.push(node); } addComponent(Type) { const component = new Type(); component.node = this; this.components.set(Type, component); return component; }
  getComponent(Type) { return this.components.get(Type) ?? null; } destroy() { this.destroyCalls++; this.__destroyed = true; } }
class UITransform extends Component { constructor() { super(); this.width = 1920; this.height = 1080; } setContentSize(width, height) { Object.assign(this, { width, height }); } }
class Camera extends Component {} Camera.ClearFlag = { SOLID_COLOR: 1, DEPTH_ONLY: 2 };
class Canvas extends Component {}
class WorldFolderView { constructor(reader, open, editors, port, reload) { Object.assign(this, { reader, open, editors, port, reload, statuses: [], mounted: false, destroyed: false }); }
  mount() { this.mounted = true; } destroy() { this.destroyed = true; } showStatus(status) { this.statuses.push(status); } }
class EditorFolderView { constructor(catalog, open, back) { Object.assign(this, { catalog, open, back }); } mount() {} destroy() {} }
class FolderStartupView { showLogin(login) { this.login = login; } showPrologue(account, text, complete) { this.complete = complete; } showError(error) { this.error = error; } destroy() {} }
class MinimalWorldBuilder extends Component { bindEntry(entry) { this.entry = entry; } }
class GuidanceEditorBuilder extends Component {} class MusicEditorBuilder extends Component {}
const cc = { _decorator: { ccclass: () => Type => Type }, Component, Node, UITransform, Camera, Canvas,
  Director: { EVENT_AFTER_DRAW: 'after-draw' }, director: { once(type, fn, target) { callbacks.push({ type, fn, target }); }, off(type, fn, target) { const index = callbacks.findIndex(c => c.type === type && c.fn === fn && c.target === target); if (index >= 0) callbacks.splice(index, 1); } }, isValid: value => value != null && value.__destroyed !== true };
const dom = [];
global.document = { createElement() { const node = { style: { setProperty() {} }, removed: false, remove() { this.removed = true; } }; return node; }, body: { appendChild(node) { dom.push(node); } } };
Module._load = function(request, parent, isMain) {
  if (request === 'cc') return cc;
  if (request.endsWith('/WorldFolderView')) return { WorldFolderView }; if (request.endsWith('/EditorFolderView')) return { EditorFolderView };
  if (request.endsWith('/FolderStartupView')) return { AccountStartupStorage, FolderStartupView };
  if (request === './MinimalWorldBuilder') return { MinimalWorldBuilder }; if (request === './GuidanceEditorBuilder') return { GuidanceEditorBuilder }; if (request === './MusicEditorBuilder') return { MusicEditorBuilder };
  return originalLoad.call(this, request, parent, isMain);
};
const { WorldFolderBuilder } = require('../../assets/scripts/WorldFolderBuilder.ts');
function test(name, run) { try { checks.push({ name, pass: true, evidence: run() ?? null }); } catch (error) { checks.push({ name, pass: false, error: String(error.stack || error) }); } }
function environment() { callbacks.length = 0; const values = new Map(), controls = { failRead: false, failWrite: false };
  global.localStorage = { getItem(key) { if (controls.failRead) throw Error('read blocked'); return values.get(key) ?? null; }, setItem(key, value) { if (controls.failWrite) throw Error('write blocked'); values.set(key, String(value)); } };
  return { values, controls }; }
function boot(account = 'builder-account', factory = () => {}) { const node = new Node('Folder'), b = node.addComponent(WorldFolderBuilder); node.addComponent(UITransform); b.bindWorldFactory(factory); b.start(); b.startupView.login(account);
  if (b.startupView.complete) b.startupView.complete(); assert.equal(b.startup.getStartupSnapshot().phase, 'WorldFolder'); return b; }
function external(account, operation) { const storage = new WorldLocalStorage(); let expected = storage.readSnapshot(account), serial = 0;
  const s = new WorldFolderSession(account, expected, snapshot => { storage.saveSnapshot(snapshot, expected); expected = snapshot; }, () => 'world-external-' + (++serial), () => 2000); operation(s); return s; }
function drain() { const list = callbacks.splice(0); for (const callback of list) callback.fn.call(callback.target); }
try {
test('C01 real startup shell seeds metadata after prologue and creates no gameplay objects before explicit selection', () => {
  environment(); let factoryCalls = 0; const b = boot('builder-account', () => factoryCalls++);
  assert.equal(factoryCalls, 0); assert.equal(b.runtimeNode, null); assert.equal(b.folderView.reader.getWorlds().length, 1); assert.equal(b.folderView.reader.getAccountId(), 'builder-account');
  return { factoryCallsBeforeSelection: 0, activeMetadataCount: 1, phase: b.startup.getStartupSnapshot().phase };
});
test('C02 empty-world entry uses minimal factory with current stored record and never invokes InitialWorld gameplay factory', () => {
  environment(); let initialCalls = 0; const b = boot('builder-account', () => initialCalls++); b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: '空白A', description: '独立空箱庭' });
  const entry = b.folderSession.getWorlds()[1]; b.folderView.open(entry); const runtime = b.runtimeNode, minimal = runtime.getComponent(MinimalWorldBuilder);
  assert.ok(minimal); assert.equal(minimal.entry.worldId, entry.worldId); assert.equal(runtime.name, entry.worldId); assert.equal(initialCalls, 0); assert.equal(b.folderView, null);
  return { runtimeName: runtime.name, minimalEntry: minimal.entry, InitialWorldFactoryCalls: 0 };
});
test('C03 built-in selection preserves configured InitialWorld factory and rapid duplicate opens create one runtime', () => {
  environment(); const calls = []; const b = boot('builder-account', node => calls.push(node)); const view = b.folderView; view.open(view.reader.getWorlds()[0]); view.open({ worldId: 'InitialWorld', title: 'stale', description: '' });
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'InitialWorld'); assert.equal(calls[0].getComponent(MinimalWorldBuilder), null);
  return { InitialWorldFactoryCalls: 1, duplicateRuntimeCount: 0, previousFactoryPreserved: true };
});
test('C04 opening stale/unknown/foreign-account entry rechecks storage and refuses runtime creation', () => {
  const env = environment(); const b = boot(); b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: '随后外页删除', description: '' }); const stale = b.folderSession.getWorlds()[1];
  external('builder-account', s => s.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: stale.worldId })); b.folderView.open(stale); assert.equal(b.runtimeNode, null); assert.ok(b.folderView.statuses.at(-1).includes('世界未能打开'));
  b.folderView.open({ worldId: 'world-other-account-only', title: '伪造跨账号卡片', description: '' }); assert.equal(b.runtimeNode, null);
  env.controls.failRead = true; b.folderView.open({ worldId: 'InitialWorld', title: 'initial', description: '' }); assert.equal(b.runtimeNode, null);
  return { staleDeletedRefused: true, unknownForeignRefused: true, readFailureRefused: true, runtimeCreations: 0 };
});
test('C05 exit disables and destroys runtime once, gates new open until after-draw, then reloads latest external directory', () => {
  environment(); const b = boot(); b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: '运行世界', description: '' }); const record = b.folderSession.getWorlds()[1]; b.folderView.open(record);
  const runtime = b.runtimeNode; external('builder-account', s => s.submitWorldFolderIntent({ kind: 'CreateWorld', title: '另页新增', description: '' }));
  b.exitRuntime(); b.exitRuntime(); assert.equal(runtime.active, false); assert.equal(runtime.destroyCalls, 1); assert.equal(b.runtimeNode, null); assert.equal(b.retiring, true); assert.equal(callbacks.length, 1);
  b.openWorld(record); assert.equal(b.runtimeNode, null); drain(); assert.equal(b.retiring, false); assert.equal(b.folderView.reader.getWorlds().length, 3);
  assert.ok(b.folderView.reader.getWorlds().some(r => r.title === '另页新增'));
  return { immediateDeactivation: true, destroyCalls: 1, afterDrawCallbacks: 1, latestListCount: 3, latestExternalCreateVisible: true };
});
test('C06 refresh sees external metadata, stale port CAS cannot overwrite it, and later valid create succeeds', () => {
  environment(); const b = boot(), staleView = b.folderView; external('builder-account', s => s.submitWorldFolderIntent({ kind: 'CreateWorld', title: '另一页', description: '' }));
  assert.throws(() => staleView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: '过期创建', description: '' }), /其他页面更新/);
  staleView.reload(); assert.equal(b.folderView.reader.getWorlds().length, 2); b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: '刷新后创建', description: '' }); assert.equal(b.folderView.reader.getWorlds().length, 3);
  return { staleWriteRejected: true, refreshCount: 2, postRefreshCreateCount: 3 };
});
test('C07 failed metadata load displays empty unavailable list without reseed/overwrite and keeps editors accessible', () => {
  const env = environment(); const b = boot(); const key = 'neurou-world-folder-v1:builder-account'; env.values.set(key, '{broken json'); b.folderView.reload();
  assert.equal(b.folderSession, null); assert.equal(b.folderView.reader.getWorlds().length, 0); assert.ok(b.folderView.statuses.at(-1).includes('世界目录未能加载'));
  assert.equal(env.values.get(key), '{broken json'); assert.throws(() => b.folderView.port.submitWorldFolderIntent({ kind: 'CreateWorld', title: 'ghost', description: '' }));
  b.folderView.editors(); assert.ok(b.catalogView); assert.equal(b.runtimeNode, null);
  return { unavailableListCount: 0, corruptStorageUntouched: true, ghostCreateRefused: true, editorDirectoryAccessible: true };
});
test('C08 destroy removes pending after-draw callback, retires active runtime and prevents view reconstruction', () => {
  environment(); const b = boot(); b.folderView.open(b.folderView.reader.getWorlds()[0]); const runtime = b.runtimeNode; b.onDestroy();
  assert.equal(runtime.active, false); assert.equal(runtime.destroyCalls, 1); assert.equal(b.runtimeNode, null); assert.equal(b.folderView, null);
  const other = boot('other-account'); other.folderView.open(other.folderView.reader.getWorlds()[0]); other.exitRuntime(); assert.equal(callbacks.length, 1); other.onDestroy(); assert.equal(callbacks.length, 0); drain(); assert.equal(other.folderView, null);
  return { activeRuntimeRetired: true, pendingCallbacksRemoved: true, viewRecreated: false };
});
test('C09 composition failure rolls back partial runtime, retains visible error, and permits retry after deferred destruction', () => {
  environment(); let partial = null; const b = boot('builder-account', runtime => { partial = runtime; throw Error('Gameplay factory failed'); });
  const folder = b.folderView; folder.open(folder.reader.getWorlds()[0]); assert.ok(partial); assert.equal(partial.active, false); assert.equal(partial.destroyCalls, 1);
  assert.equal(b.runtimeNode, null); assert.equal(b.retiring, true); assert.equal(b.folderPending, false); assert.strictEqual(b.folderView, folder); assert.equal(folder.destroyed, false);
  assert.ok(folder.statuses.at(-1).includes('Gameplay factory failed')); assert.equal(callbacks.length, 1); drain();
  assert.equal(b.retiring, false); assert.strictEqual(b.folderView, folder); assert.ok(folder.statuses.at(-1).includes('Gameplay factory failed'));
  b.bindWorldFactory(() => {}); folder.open(folder.reader.getWorlds()[0]); assert.ok(b.runtimeNode); assert.equal(b.runtimeNode.name, 'InitialWorld');
  return { partialRuntimeDestroyed: true, visibleFolderRetained: true, errorRetainedAfterDraw: true, retrySucceeds: true };
});
} finally { Module._load = originalLoad; }
const report = { generatedAt: new Date().toISOString(), scope: 'Actual WorldFolderBuilder, WorldFolderSession, AccountStartupSession, WorldLocalStorage and AccountStartupStorage; mocked cc lifecycle/views/runtime constructor boundaries. No actual rendering claim.',
  passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks };
fs.writeFileSync(path.join(__dirname, 'builder-boundary-results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.failed ? 1 : 0;
