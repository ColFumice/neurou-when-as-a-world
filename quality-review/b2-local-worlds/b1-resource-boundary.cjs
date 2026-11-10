'use strict';
// Execute the actual composition root and view class with an injected cc/resource boundary.
// Engine rendering is intentionally mocked; parser, Premiere and Bootstrap/director are real.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), Module = require('module');
const ts = require('../../node_modules/typescript');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText, filename);
const checks = [], root = path.resolve(__dirname, '../..'), clone = x => JSON.parse(JSON.stringify(x));
const chart = JSON.parse(fs.readFileSync(path.join(__dirname, 'b1-editor-v3-chart.json'), 'utf8'));
const visual = JSON.parse(fs.readFileSync(path.join(__dirname, 'b1-editor-v3-chart.visual.json'), 'utf8'));
let loads = [], replies = {}, immediate = false, logs = [], visualMetadataAvailable = true;
class Component { constructor() { this.enabled = true; this.__destroyed = false; } }
class UITransform extends Component { constructor() { super(); this.width = 1920; this.height = 1080; }
  setContentSize(width, height) { this.width = width; this.height = height; } }
class Node {
  constructor(name = '') { this.name = name; this.parent = null; this.children = []; this.layer = 1; this.active = true; this.components = new Map(); this.worldPosition = { x: 0, y: 0, z: 0 }; }
  addChild(node) { node.parent = this; this.children.push(node); }
  addComponent(Type) { const component = new Type(); component.node = this; this.components.set(Type, component); return component; }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  getComponentsInChildren(Type) { return [...(this.components.has(Type) ? [this.components.get(Type)] : []), ...this.children.flatMap(n => n.getComponentsInChildren(Type))]; }
  setPosition(x, y, z) { this.worldPosition = { x, y, z }; }
  setRotationFromEuler() {} destroy() { this.__destroyed = true; }
}
class Generic extends Component { constructor() { super(); return new Proxy(this, { get(target, key, receiver) { return key in target ? Reflect.get(target, key, receiver) : () => {}; } }); } }
class Camera extends Generic {}
Camera.ClearFlag = { SOLID_COLOR: 1, DEPTH_ONLY: 2 };
class Color { constructor(r, g, b, a = 255) { Object.assign(this, { r, g, b, a }); } }
class Vec3 { constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); } }
class LineEraseEffect extends Generic { bindNodeColors(items) { this.colors = items; } }
class WorldFolderBuilder extends Generic { bindWorldFactory(factory) { this.factory = factory; } }
const classStubs = new Map();
function stub(name) { if (!classStubs.has(name)) { const Type = class extends Generic {}; Object.defineProperty(Type, 'name', { value: name }); classStubs.set(name, Type); } return classStubs.get(name); }
const cc = { _decorator: { ccclass: () => Type => Type, property: () => () => {} }, Component, Node, UITransform, Camera, Color, Vec3,
  Canvas: stub('Canvas'), Label: stub('Label'), Graphics: stub('Graphics'), DirectionalLight: stub('DirectionalLight'), MeshRenderer: stub('MeshRenderer'),
  Mesh: stub('Mesh'), Material: stub('Material'), AudioSource: stub('AudioSource'), AudioClip: stub('AudioClip'), VideoPlayer: stub('VideoPlayer'),
  VideoClip: stub('VideoClip'), JsonAsset: stub('JsonAsset'), SpriteFrame: stub('SpriteFrame'), Overflow: { RESIZE_HEIGHT: 1 },
  utils: { MeshUtils: { createMesh: () => new (stub('Mesh'))() } }, primitives: { box: () => ({}) },
  input: { on() {}, off() {} }, Input: { EventType: { MOUSE_DOWN: 'mouse-down', KEY_DOWN: 'key-down' } }, screen: { windowSize: { width: 1920, height: 1080 } },
  isValid: value => value != null && value.__destroyed !== true,
  resources: { getInfoWithPath() { return visualMetadataAvailable ? { uuid: 'test-visual-uuid' } : null; },
    load(resource, Type, callback) { const load = { path: resource, Type: Type.name, callback }; loads.push(load);
    if (immediate && Object.hasOwn(replies, resource)) { const r = replies[resource]; callback(r.error, r.asset); } } } };
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'cc') return cc;
  if (request === './WorldFolderBuilder') return { WorldFolderBuilder };
  if (request === './LineEraseEffect') return { LineEraseEffect };
  if (request.includes('/presentation/') && !request.replace(/\.ts$/, '').endsWith('/ChartPadView')) { const name = request.split('/').at(-1).replace(/\.ts$/, ''); return { [name]: stub(name) }; }
  return originalLoad.call(this, request, parent, isMain);
};
const { SceneBuilder } = require('../../assets/scripts/SceneBuilder.ts');
const { ChartPadView } = require('../../src/presentation/ChartPadView.ts');
const { createDefaultKeyboardPadLayout } = require('../../src/chart/KeyboardPadLayout.ts');
const { ChartPremiere } = require('../../src/chart/ChartPremiere.ts');
function test(name, run) { try { checks.push({ name, pass: true, evidence: run() ?? null }); }
  catch (error) { checks.push({ name, pass: false, error: String(error.stack || error) }); } }
function boot(resource = undefined, { sync = false, responses = {}, visualMetadata = true } = {}) {
  loads = []; logs = []; replies = responses; immediate = sync; visualMetadataAvailable = visualMetadata;
  const node = new Node('WorldRuntime'), builder = node.addComponent(SceneBuilder); builder.folderWorld = true;
  if (resource !== undefined) builder.ChartResourcePath = resource; builder.start(); return builder;
}
function reply(resource, raw, error = undefined) { const load = loads.find(l => l.path === resource); assert.ok(load, 'Expected resource request ' + resource); load.callback(error, raw == null ? null : { json: raw }); }
function errorLabels(builder) { const descend = node => [node, ...node.children.flatMap(descend)]; return descend(builder.node).filter(n => n.name === 'GuidanceLoadError'); }
const oldWarn = console.warn, oldError = console.error;
console.warn = (...items) => logs.push({ level: 'warn', message: items.map(String).join(' ') });
console.error = (...items) => logs.push({ level: 'error', message: items.map(String).join(' ') });
try {
test('R01 Inspector default loads exactly existing guidance_c; v1/v2 parser and actual Premiere preserved', () => {
  const b = boot(); assert.equal(b.ChartResourcePath, 'chart/guidance_c');
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/chart/guidance_c.json'), 'utf8'));
  reply('chart/guidance_c', legacy); assert.equal(b.chartData.schemaVersion, 2); assert.equal(b.chartPremiere.getChartId(), legacy.chartId);
  assert.equal(b.chartDataResolved, true); assert.ok(loads.some(l => l.path === 'chart/guidance_c.visual'));
  return { default: b.ChartResourcePath, chartId: b.chartPremiere.getChartId(), schemaVersion: b.chartData.schemaVersion, resources: loads.map(l => l.path) };
});
test('R02 world folder factory copies Inspector selection and guidance transparency into each new runtime', () => {
  const source = new Node('Canvas').addComponent(SceneBuilder); source.ChartResourcePath = 'chart/b1-editor-v3-chart'; source.GuideTransparency = 64; source.UseGuidanceChart = true;
  source.start(); const folder = source.node.getComponent(WorldFolderBuilder), first = new Node('First'), second = new Node('Second'); folder.factory(first); folder.factory(second);
  for (const n of [first, second]) { const b = n.getComponent(SceneBuilder); assert.equal(b.ChartResourcePath, source.ChartResourcePath); assert.equal(b.GuideTransparency, 64); assert.equal(b.folderWorld, true); }
  return { runtimes: 2, configuredPath: source.ChartResourcePath, copiedByActualFactory: true };
});
test('R03 selected exported v3 parses before premiere and optional colors reach real view before first draw', () => {
  const resource = 'chart/b1-editor-v3-chart', b = boot(resource);
  reply(resource, chart); assert.equal(b.chartData.schemaVersion, 3); assert.equal(b.chartPremiere.getChartId(), chart.chartId);
  reply(resource + '.visual', visual); assert.deepEqual(b.chartPadView.nodeColors, visual.nodes);
  b.chartPadView.onFrameRefresh(); assert.deepEqual(b.chartPadView.lineEraseEffect.colors, visual.nodes);
  assert.equal(b.graph.session.getLedgerEvents().length, 0); assert.equal(errorLabels(b).length, 0);
  return { resource, schemaVersion: 3, sidecar: resource + '.visual', cachedColors: 4, forwardedColors: 4, loadLedgerDelta: 0 };
});
test('R04 immediate chart and immediate visual callbacks preserve colors through first chart binding and lazy view build', () => {
  const resource = 'chart/b1-editor-v3-chart', b = boot(resource, { sync: true, responses: {
    [resource]: { asset: { json: chart } }, [resource + '.visual']: { asset: { json: visual } } } });
  assert.equal(b.chartData.schemaVersion, 3); assert.deepEqual(b.chartPadView.nodeColors, visual.nodes);
  b.chartPadView.onFrameRefresh(); assert.deepEqual(b.chartPadView.lineEraseEffect.colors, visual.nodes);
  return { callbackOrder: 'chart then sidecar in same stack', retainedColors: 4, lazyViewRetainsColors: true };
});
test('R05 optional missing/null visual keeps chart usable and default colors', () => {
  const evidence = [];
  for (const error of [new Error('Missing optional sidecar'), undefined]) { const b = boot('chart/b1-editor-v3-chart'); reply(b.ChartResourcePath, chart); reply(b.ChartResourcePath + '.visual', null, error);
    assert.equal(b.chartDataResolved, true); assert.equal(b.chartPremiere.getChartId(), chart.chartId); assert.deepEqual(b.chartPadView.nodeColors, []); assert.equal(errorLabels(b).length, 0);
    evidence.push({ reason: error ? 'load error' : 'null asset', gameplayUsable: true, visualCount: 0 }); }
  const withoutMetadata = boot('chart/b1-editor-v3-chart', { visualMetadata: false }); reply(withoutMetadata.ChartResourcePath, chart);
  assert.equal(loads.filter(l => l.Type === 'JsonAsset').length, 1); assert.deepEqual(withoutMetadata.chartPadView.nodeColors, []);
  assert.equal(withoutMetadata.chartPremiere.getChartId(), chart.chartId); assert.equal(errorLabels(withoutMetadata).length, 0);
  evidence.push({ reason: 'resource metadata missing', gameplayUsable: true, visualLoadSkipped: true }); return evidence;
});
test('R06 wrong chartId/unknown node/duplicate node/bad RGB sidecars warn and fall back only visual', () => {
  const cases = [ ['wrong chartId', v => { v.chartId = 'wrong'; }], ['unknown nodeId', v => { v.nodes[0].nodeId = 'unknown'; }],
    ['duplicate nodeId', v => { v.nodes[1].nodeId = v.nodes[0].nodeId; }], ['RGB out of range', v => { v.nodes[0].color.r = 256; }],
    ['RGB fraction', v => { v.nodes[0].color.b = .5; }], ['unknown RGB field', v => { v.nodes[0].color.a = 255; }] ], evidence = [];
  for (const [name, mutate] of cases) { const b = boot('chart/b1-editor-v3-chart'), raw = clone(visual); mutate(raw); reply(b.ChartResourcePath, chart); reply(b.ChartResourcePath + '.visual', raw);
    assert.equal(b.chartDataResolved, true); assert.equal(b.chartPremiere.getChartId(), chart.chartId); assert.deepEqual(b.chartPadView.nodeColors, []);
    assert.equal(errorLabels(b).length, 0); assert.ok(logs.some(l => l.level === 'warn' && l.message.includes('颜色伴随文件无效')));
    evidence.push({ rejected: name, chartRetained: true, defaultColors: true }); }
  return evidence;
});
test('R07 missing selected chart rejects loading without guidance_c or placeholder fallback', () => {
  const resource = 'chart/absent', b = boot(resource); reply(resource, null, new Error('Missing selected chart'));
  assert.equal(b.chartData, null); assert.equal(b.chartDataResolved, false); assert.equal(b.chartPremiere, null); assert.equal(errorLabels(b).length, 1);
  assert.equal(loads.filter(l => l.Type === 'JsonAsset').length, 1); assert.equal(b.graph.session.getLedgerEvents().length, 0);
  return { selectedPath: resource, rejected: true, fallbackRequests: 0, loadLedgerDelta: 0 };
});
test('R08 malformed chart/timing/layout rejects without loading any other chart or optional visual', () => {
  const cases = [ ['invalid schema', r => { r.schemaVersion = 4; }], ['missing v3 timing', r => { delete r.lines[0].timing; }],
    ['v3 speed forbidden', r => { r.lines[0].speed = .1; }], ['wrong layout', r => { r.layoutVersion = 'wrong'; }] ], evidence = [];
  for (const [name, mutate] of cases) { const resource = 'chart/bad-v3', b = boot(resource), raw = clone(chart); mutate(raw); reply(resource, raw);
    assert.equal(b.chartData, null); assert.equal(b.chartDataResolved, false); assert.equal(b.chartPremiere, null); assert.equal(errorLabels(b).length, 1);
    assert.equal(loads.filter(l => l.Type === 'JsonAsset').length, 1); evidence.push({ rejected: name, fallbackRequests: 0 }); }
  return evidence;
});
test('R09 resources path contract rejects absolute/file/traversal/extension/empty inputs before JSON I/O, accepts nested safe Unicode path', () => {
  const invalid = ['', 'guidance_c', '../chart/a', 'chart/../a', '/chart/a', 'assets/resources/chart/a', 'chart/a.json', 'chart/a.visual', 'chart/a//b', 'chart/a\\b', 'chart/a?x=1'], evidence = [];
  for (const resource of invalid) { const b = boot(resource); assert.equal(loads.filter(l => l.Type === 'JsonAsset').length, 0); assert.equal(b.chartDataResolved, false); assert.equal(errorLabels(b).length, 1); evidence.push(resource); }
  const b = boot('  chart/雨若_谱面/测试-1  '); reply('chart/雨若_谱面/测试-1', chart); assert.equal(b.chartPremiere.getChartId(), chart.chartId);
  return { rejectedPaths: evidence, acceptedTrimmedPath: 'chart/雨若_谱面/测试-1' };
});
test('R10 callback after destroyed composition root does not bind chart/visual, create premiere or append ledger', () => {
  const resource = 'chart/b1-editor-v3-chart', destroyedBeforeChart = boot(resource); destroyedBeforeChart.__destroyed = true;
  reply(resource, chart); assert.equal(destroyedBeforeChart.chartData, null); assert.equal(destroyedBeforeChart.chartPremiere, null);
  const destroyedBeforeVisual = boot(resource); reply(resource, chart); destroyedBeforeVisual.__destroyed = true;
  reply(resource + '.visual', visual); assert.deepEqual(destroyedBeforeVisual.chartPadView.nodeColors, []);
  assert.equal(destroyedBeforeVisual.graph.session.getLedgerEvents().length, 0);
  return { lateChartCallbackIgnored: true, lateVisualCallbackIgnored: true, loadLedgerDelta: 0 };
});
test('R11 view handles late colors after first build and clears previous colors when binding another chart', () => {
  const node = new Node('Pad'), view = node.addComponent(ChartPadView), layout = createDefaultKeyboardPadLayout(); node.addComponent(UITransform);
  view.bindPremiere(new ChartPremiere(chart, layout)); view.bindChart(chart, layout); view.onFrameRefresh(); assert.deepEqual(view.lineEraseEffect.colors, []);
  view.bindNodeColors(visual.nodes); assert.deepEqual(view.lineEraseEffect.colors, visual.nodes);
  view.bindChart({ ...chart, chartId: 'other' }, layout); assert.deepEqual(view.nodeColors, []); assert.deepEqual(view.lineEraseEffect.colors, []);
  return { lateColorsForwarded: 4, nextChartClearsColors: true };
});
test('R12 UseGuidanceChart=false retains existing old T7 placeholder and fallback behavior', () => {
  loads = []; replies = {}; immediate = false; const b = new Node('OldT7').addComponent(SceneBuilder); b.folderWorld = true; b.UseGuidanceChart = false;
  b.ChartResourcePath = 'chart/ignored'; b.start(); reply('chart/chart_placeholder', null, new Error('Missing old placeholder'));
  assert.equal(b.chartDataResolved, true); assert.ok(b.chartData.notes.length); assert.equal(loads.some(l => l.path === 'chart/ignored'), false);
  return { request: 'chart/chart_placeholder', priorFallbackPreserved: true };
});
} finally { console.warn = oldWarn; console.error = oldError; Module._load = originalLoad; }
const report = { generatedAt: new Date().toISOString(), scope: 'Actual SceneBuilder.start()/factory/callbacks and ChartPadView with injected cc resources/rendering boundary; real Bootstrap, v1/v2/v3 parsers, ChartPremiere, DirectorSession. Does not claim actual engine rendering.',
  passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks };
fs.writeFileSync(path.join(__dirname, 'b1-resource-boundary-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); process.exitCode = report.failed ? 1 : 0;
