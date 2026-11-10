// Independent Electron lifetime: resume only the UI-created B2 evidence profiles.
// No storage/catalog/state fixtures, gameplay, permission or clock writes.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const { app, BrowserWindow } = require('electron');
const out = __dirname, root = path.resolve(out, '../..');
const baselineBytes = fs.readFileSync(path.join(out, 'creator-preview-results.json'));
const baseline = JSON.parse(baselineBytes), url = baseline.url;
const baselineLifecycleBytes = fs.readFileSync(path.join(out, 'creator-preview-lifecycle.json'));
const baselineLifecycle = JSON.parse(baselineLifecycleBytes);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {
  kind: 'Independent Electron process restart after creator-preview.cjs app.exit',
  electronVersion: process.versions.electron, processPID: process.pid,
  processStartedAt: new Date().toISOString(), profile: baseline.profile, url,
  baselineReportSha256: sha(baselineBytes), harnessSha256: sha(fs.readFileSync(__filename)),
  baselineLifecycle, baselineLifecycleSha256: sha(baselineLifecycleBytes),
  launchEvidence: JSON.parse(process.env.NEUROU_B2_RESTART_LAUNCH),
  policy: 'The previous full harness process exited. A new Electron process reuses the original userData and each persistent partition. Product UI login only; localStorage/catalog/scene observations are read-only. No storage or state fixture writes, no world creation/deletion/gameplay in this follow-up. Raw CDP PNG, no image edits. Original full preview report is preserved.',
  resolutions: [], rendererErrors: [], runtimeErrors: [], requests: [],
};
assert.equal(baseline.pass, true);
assert.equal(baselineLifecycle.exitCode, 0, 'Original complete preview process did not successfully exit');
assert.notEqual(baselineLifecycle.electronPID, process.pid, 'Independent Electron process must have a new PID');
assert.ok(new Date(baselineLifecycle.exitedAt).getTime() <= new Date(report.processStartedAt).getTime());
assert.equal(report.launchEvidence.priorHarnessProcesses.length, 0);
assert.ok(fs.existsSync(baseline.profile));
app.setPath('userData', baseline.profile);
for (const [key, value] of [['force-device-scale-factor', '1'], ['disable-background-timer-throttling'], ['disable-renderer-backgrounding'], ['disable-backgrounding-occluded-windows']]) app.commandLine.appendSwitch(key, value);
app.on('window-all-closed', () => {});
let win;
const ev = (fn, ...args) => win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(x => JSON.stringify(x)).join(',') + ')', true);
async function until(fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const result = await ev(fn); if (result) return result; await wait(30); }
  throw new Error('Timeout ' + fn.toString());
}
async function compilation() {
  const map = await (await fetch(url + 'scripting/x/import-map.json', { cache: 'no-store' })).json();
  return Promise.all(baseline.compilation.map(async expected => {
    const file = expected.file, suffix = file.startsWith('src/') ? 'assets/scripts/' + file : file;
    const id = Object.keys(map.imports).find(key => key.endsWith('/' + suffix));
    assert.ok(id, 'Creator missing ' + file);
    const chunk = map.imports[id], chunkUrl = new URL(chunk, url + 'scripting/x/').href;
    const bytes = Buffer.from(await (await fetch(chunkUrl, { cache: 'no-store' })).arrayBuffer());
    const sm = await (await fetch(chunkUrl + '.map', { cache: 'no-store' })).json();
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(sha(bytes), sha(fs.readFileSync(path.join(root, 'temp/programming/packer-driver/targets/preview', chunk))), 'Served/compiler mismatch ' + file);
    assert.ok(sm.sourcesContent.includes(source), 'Stale Creator ' + file);
    return { file, chunk, sourceSha256: sha(source), chunkSha256: sha(bytes), sourceMapMatches: true, servedEqualsCompilerOutput: true };
  }));
}
async function read() {
  return ev(() => {
    const e = window.__b2Restart, scene = e.cc.director.getScene(), canvas = document.getElementById('GameCanvas');
    const shell = e.all(scene, 'WorldFolderBuilder')[0];
    return {
      viewport: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height], canvasCss: [canvas.clientWidth, canvas.clientHeight], dpr: devicePixelRatio,
      folder: !!document.querySelector('#world-folder'), startup: shell?.startup?.getStartupSnapshot(), runtimeNode: shell?.runtimeNode?.name ?? null,
      frameDrivers: e.all(scene, 'FrameDriver').length, inputCollectors: e.all(scene, 'InputCollector').length,
      sceneWorlds: e.all(scene, 'SceneBuilder').filter(b => !!b.graph).length, minimalWorlds: e.all(scene, 'MinimalWorldBuilder').length,
      minimalInfo: !!document.querySelector('#minimal-world-info'), editorFolder: !!document.querySelector('#editor-folder'),
      rows: [...document.querySelectorAll('#folder-worlds .folder-world-card[data-world-id]')].map(el => ({
        worldId: el.dataset.worldId, title: el.querySelector('.folder-title')?.textContent ?? el.textContent, description: el.querySelector('.folder-description')?.textContent ?? '',
        actions: [...el.querySelectorAll('[data-action]')].map(b => ({ action: b.dataset.action, worldId: b.dataset.worldId, disabled: b.disabled })),
      })),
      storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
      status: document.querySelector('#world-folder-status')?.textContent ?? null,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      errors: e.errors.slice(), media: [...document.querySelectorAll('video,audio')].map(v => ({ tag: v.tagName, paused: v.paused })),
    };
  });
}
function metadata(state, account) {
  const catalog = JSON.parse(state.storage['neurou-world-folder-v1:' + encodeURIComponent(account)]);
  assert.deepEqual(Object.keys(catalog).sort(), ['accountId', 'records', 'schemaVersion']);
  assert.equal(catalog.accountId, account); assert.equal(catalog.schemaVersion, 1);
  for (const record of catalog.records) {
    assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'deletedAt', 'description', 'template', 'title', 'worldId']);
    assert.ok(Number.isSafeInteger(record.createdAt) && record.createdAt >= 0);
    assert.ok(record.deletedAt === null || Number.isSafeInteger(record.deletedAt) && record.deletedAt >= record.createdAt);
    assert.equal(record.template, record.worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld');
  }
  assert.ok(Object.keys(state.storage).every(key => key.startsWith('neurou-world-folder-v1:') || key.startsWith('neurou-account-milestone-v1:')));
  return catalog;
}
async function resolution(expected) {
  const { width, height, partition, accounts } = expected;
  const res = { resolution: expected.resolution, width, height, partition, account: accounts.main };
  report.resolutions.push(res);
  win = new BrowserWindow({ width, height, useContentSize: true, show: false, frame: false, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, partition } });
  res.rendererPID = win.webContents.getOSProcessId();
  win.webContents.debugger.attach('1.3');
  win.webContents.on('console-message', e => { if (e.level === 3 || e.level === 'error') report.rendererErrors.push({ resolution: res.resolution, message: e.message }); });
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => { report.requests.push({ resolution: res.resolution, url: details.url, method: details.method }); callback({}); });
  await win.loadURL(url);
  await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await until(() => typeof System !== 'undefined' && !!document.querySelector('#folder-login'));
  await ev(async () => {
    const cc = await System.import('cc'); cc.profiler.hideStats();
    const all = (node, name) => node ? [...node.getComponents(name), ...node.children.flatMap(child => all(child, name))] : [];
    window.__b2Restart = { cc, all, errors: [] };
    window.addEventListener('error', e => window.__b2Restart.errors.push(String(e.error?.stack || e.message)));
    window.addEventListener('unhandledrejection', e => window.__b2Restart.errors.push(String(e.reason?.stack || e.reason)));
  });
  res.storageBeforeLogin = (await read()).storage;
  assert.deepEqual(res.storageBeforeLogin, expected.final.storage, 'Disk persisted storage differs before UI login');
  await ev(account => {
    const input = document.querySelector('#folder-account'); input.value = account;
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#folder-login').click();
  }, accounts.main);
  await until(() => !!document.querySelector('#world-folder') || !!document.querySelector('#folder-complete-prologue'));
  assert.equal(await ev(() => !!document.querySelector('#folder-complete-prologue')), false, 'Prologue completion missing after process restart');
  await until(() => !!document.querySelector('#world-folder'));
  await ev(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await read(); res.state = state;
  assert.deepEqual(state.rows, expected.final.rows);
  assert.deepEqual(state.storage, expected.final.storage, 'UI login rewrote persisted metadata');
  assert.equal(state.startup.accountId, accounts.main); assert.equal(state.startup.PrologueCompleted, true); assert.equal(state.startup.phase, 'WorldFolder');
  assert.equal(state.runtimeNode, null); assert.equal(state.frameDrivers, 0); assert.equal(state.inputCollectors, 0);
  assert.equal(state.sceneWorlds, 0); assert.equal(state.minimalWorlds, 0); assert.equal(state.minimalInfo, false); assert.equal(state.editorFolder, false); assert.deepEqual(state.media, []);
  const catalog = metadata(state, accounts.main); assert.deepEqual(catalog, expected.deletedCatalog);
  assert.equal(catalog.records.length, 3); assert.equal(catalog.records.find(r => r.worldId === expected.worldA).deletedAt, null);
  assert.ok(catalog.records.find(r => r.worldId === expected.worldB).deletedAt !== null);
  const other = metadata(state, accounts.other); assert.equal(other.records.length, 2);
  assert.ok(other.records.some(r => r.worldId === expected.worldC && r.deletedAt === null));
  assert.deepEqual(state.rows.map(r => r.worldId), ['InitialWorld', expected.worldA]);
  assert.ok(!state.rows.some(r => r.worldId === expected.worldB || r.worldId === expected.worldC));
  assert.deepEqual(state.viewport, [width, height]); assert.deepEqual(state.canvas, [width, height]); assert.deepEqual(state.canvasCss, [width, height]);
  assert.equal(state.dpr, 1); assert.equal(state.horizontalOverflow, false); assert.deepEqual(state.errors, []);
  const screenshot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const png = Buffer.from(screenshot.data, 'base64'), file = res.resolution + '-12-persisted-after-process-restart.png';
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
  fs.writeFileSync(path.join(out, file), png); res.screenshot = { file, sha256: sha(png), dimensions: [width, height] };
  res.checks = ['Same original profile and persistent partition after prior harness process exit', 'Raw storage identical on disk before login and after product UI login', 'Main account retains InitialWorld and active world A', 'World B tombstone retained and hidden; second account world C remains isolated', 'Schema and metadata-only field whitelist unchanged', 'Prologue milestone persists and no runtime/ledger/media is instantiated', 'Original raw viewport/canvas/PNG resolution and no horizontal overflow'].map(name => ({ name, pass: true }));
  report.runtimeErrors.push(...state.errors); res.pass = true;
  console.log('B2 process restart ' + res.resolution + ' PASS PID ' + process.pid + ' ' + file);
  await new Promise(resolve => { win.once('closed', resolve); win.close(); }); win = null;
}
app.whenReady().then(async () => {
  try {
    report.compilation = await compilation(); assert.deepEqual(report.compilation, baseline.compilation, 'Production changed since complete preview');
    for (const expected of baseline.resolutions) await resolution(expected);
    assert.deepEqual(report.rendererErrors, []); assert.deepEqual(report.runtimeErrors, []);
    report.externalRequests = report.requests.filter(r => { try { const u = new URL(r.url); return ['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname); } catch { return false; } });
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(await compilation(), report.compilation); report.compilationUnchanged = true;
    assert.equal(sha(fs.readFileSync(path.join(out, 'creator-preview-results.json'))), report.baselineReportSha256, 'Original full preview report changed');
    report.originalReportPreserved = true; report.pass = true;
  } catch (error) { report.pass = false; report.error = error.stack; console.error(error.stack); }
  finally {
    report.processFinishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'process-restart-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, processPID: process.pid, error: report.error }));
    if (win) win.destroy(); app.exit(report.pass ? 0 : 1);
  }
});
