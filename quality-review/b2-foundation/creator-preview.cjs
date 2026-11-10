// B2.2a+b foundation production preview evidence. No fixture injection.
// Run only after source compilation is ready; never reuses a user's browser/profile.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const os = require('os');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '../..');
const url = process.env.NEUROU_PREVIEW_URL || 'http://localhost:7456/';
const sha = input => crypto.createHash('sha256').update(input).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = path.join(os.tmpdir(), 'neurou-b22-foundation-evidence-' + Date.now());
const targets = [
  'assets/scripts/WorldFolderBuilder.ts',
  'src/presentation/WorldFolderView.ts',
  'src/director/AccountMilestone.ts',
  'src/presentation/AccountMilestoneStorage.ts',
  'src/director/WorldStateSession.ts',
  'src/presentation/WorldStateStorage.ts',
  'src/director/IntentPort.ts',
];
const report = {
  capturedAt: new Date().toISOString(), previewUrl: url, profile,
  classification: 'PRODUCTION UI ACCEPTANCE — no FirstWorldCleared injection or actual gameplay clear',
  policy: 'Fresh temporary Electron userData and persistent partition per resolution. Product login/prologue controls are the only writers; no user profile accessed. New FirstWorldCleared key must remain absent. UI capture, restore availability and refresh must preserve storage bytes. Read-only Cocos component/DOM/storage observation. PNGs are unmodified direct CDP output, not B2.1 screenshots. Only explicit restore refusal is demonstrated; no gameplay restore success is claimed.',
  harnessSha256: sha(fs.readFileSync(__filename)),
  resolutions: [], rendererErrors: [], runtimeErrors: [], requests: [],
};
app.setPath('userData', profile);
for (const [name, value] of [
  ['force-device-scale-factor', '1'], ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'], ['disable-backgrounding-occluded-windows'],
]) { app.commandLine.appendSwitch(name, value); }
app.on('window-all-closed', () => {});
let win;
const ev = (fn, ...args) => win.webContents.executeJavaScript(
  '(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')', true);
async function until(fn, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await ev(fn);
    if (result) { return result; }
    await delay(30);
  }
  throw new Error('Timeout: ' + fn.toString());
}
async function click(selector) {
  await ev(selector => {
    const element = document.querySelector(selector);
    if (!element || element.disabled) { throw new Error('Missing/disabled product control ' + selector); }
    element.click();
  }, selector);
  await delay(90);
}
async function set(selector, value) {
  await ev((selector, value) => {
    const element = document.querySelector(selector);
    if (!element) { throw new Error('Missing product input ' + selector); }
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}
async function reveal(selector) {
  await ev(selector => {
    const element = document.querySelector(selector);
    if (!element) { throw new Error('Missing element to scroll into view: ' + selector); }
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }, selector);
  await delay(80);
}
async function compilation() {
  const imports = (await (await fetch(url + 'scripting/x/import-map.json', { cache: 'no-store' })).json()).imports;
  return Promise.all(targets.map(async file => {
    const suffix = file.startsWith('src/') ? 'assets/scripts/' + file : file;
    const id = Object.keys(imports).find(key => key.endsWith('/' + suffix));
    assert.ok(id, 'Creator module missing: ' + file);
    const chunk = imports[id];
    const chunkUrl = new URL(chunk, url + 'scripting/x/').href;
    const bytes = Buffer.from(await (await fetch(chunkUrl, { cache: 'no-store' })).arrayBuffer());
    const sourceMap = await (await fetch(chunkUrl + '.map', { cache: 'no-store' })).json();
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(sourceMap.sourcesContent.includes(source), 'Stale compiled source: ' + file);
    const disk = fs.readFileSync(path.join(root, 'temp/programming/packer-driver/targets/preview', chunk));
    assert.equal(sha(bytes), sha(disk), 'Served/disk compiled bytes differ: ' + file);
    return { file, chunk, sourceSha256: sha(source), chunkSha256: sha(bytes), sourceMapMatches: true, servedEqualsCompilerOutput: true };
  }));
}
async function setup() {
  await until(() => typeof System !== 'undefined' && !!document.querySelector('#folder-login'));
  await ev(async () => {
    const cc = await System.import('cc');
    cc.profiler.hideStats();
    const all = (node, name) => node ? [...node.getComponents(name), ...node.children.flatMap(child => all(child, name))] : [];
    window.__b22Evidence = { cc, all, errors: [] };
    window.addEventListener('error', event => window.__b22Evidence.errors.push(String(event.error?.stack || event.message)));
    window.addEventListener('unhandledrejection', event => window.__b22Evidence.errors.push(String(event.reason?.stack || event.reason)));
  });
}
async function read() {
  return ev(() => {
    const evidence = window.__b22Evidence;
    const scene = evidence.cc.director.getScene();
    const shell = evidence.all(scene, 'WorldFolderBuilder')[0];
    const canvas = document.getElementById('GameCanvas');
    const readNode = selector => {
      const element = document.querySelector(selector);
      if (!element) { return null; }
      const rect = element.getBoundingClientRect();
      return { text: element.textContent.trim(), data: { ...element.dataset }, hidden: element.hidden,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right } };
    };
    return {
      viewport: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height],
      canvasCss: [canvas.clientWidth, canvas.clientHeight], devicePixelRatio,
      folder: !!document.querySelector('#world-folder'),
      runtimeNode: shell?.runtimeNode?.name ?? null,
      frameDrivers: evidence.all(scene, 'FrameDriver').length,
      inputCollectors: evidence.all(scene, 'InputCollector').length,
      milestoneSnapshot: shell?.milestoneReader?.getMilestoneSnapshot?.() ?? shell?.milestoneProjection?.getMilestoneSnapshot?.() ?? null,
      lastCaptures: shell?.stateSessions ? [...shell.stateSessions.entries()].map(([worldId, session]) => ({ worldId, result: session.getLastCaptureResult() })) : [],
      permission: readNode('#account-copy-permission'),
      forkAvailability: readNode('#world-fork-availability'),
      diagnostics: readNode('#world-state-diagnostics'),
      captureKind: readNode('#world-state-capture-kind'),
      diagnosticItems: [...document.querySelectorAll('#world-state-diagnostic-list li')].map(element => ({ text: element.textContent.trim(), data: { ...element.dataset } })),
      restoreStatus: readNode('#world-state-restore-status'),
      status: readNode('#world-folder-status'),
      rows: [...document.querySelectorAll('#folder-worlds .folder-world-card')].map(element => ({
        worldId: element.dataset.worldId, title: element.querySelector('.folder-title')?.textContent,
        actions: [...element.querySelectorAll('[data-action]')].map(button => ({ action: button.dataset.action, disabled: button.disabled })),
      })),
      buttons: [...document.querySelectorAll('#world-folder button')].map(button => ({ id: button.id, text: button.textContent.trim(), disabled: button.disabled, data: { ...button.dataset } })),
      storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      folderOverflow: (document.getElementById('world-folder')?.scrollWidth ?? 0) > innerWidth,
      errors: evidence.errors.slice(),
    };
  });
}
function noRuntime(state) {
  assert.equal(state.folder, true);
  assert.equal(state.runtimeNode, null);
  assert.equal(state.frameDrivers, 0);
  assert.equal(state.inputCollectors, 0);
  assert.deepEqual(state.errors, []);
}
function noClearWrite(state, account) {
  assert.ok(!Object.keys(state.storage).some(key => key.startsWith('neurou-account-first-world-cleared-v1:')), 'Production UI wrote a FirstWorldCleared projection');
  assert.ok(state.storage['neurou-account-milestone-v1:' + encodeURIComponent(account)], 'Existing prologue key missing');
  assert.ok(!Object.keys(state.storage).some(key => key.startsWith('neurou-world-state-v1:')), 'Incomplete capture persisted a purported full world snapshot');
}
async function capture(name, resolution) {
  await ev(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await read();
  noRuntime(state);
  noClearWrite(state, resolution.account);
  assert.equal(state.devicePixelRatio, 1);
  assert.deepEqual(state.viewport, [resolution.width, resolution.height]);
  assert.deepEqual(state.canvas, state.viewport);
  assert.deepEqual(state.canvasCss, state.viewport);
  assert.equal(state.horizontalOverflow, false);
  assert.equal(state.folderOverflow, false);
  const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
  });
  const bytes = Buffer.from(shot.data, 'base64');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], state.viewport);
  const file = resolution.resolution + '-' + name + '.png';
  fs.writeFileSync(path.join(__dirname, file), bytes);
  resolution.screenshots.push({ name, file, sha256: sha(bytes), classification: 'production UI acceptance; no clear injection', state });
  console.log('B2.2 ' + resolution.resolution + ' ' + name + ' ' + JSON.stringify({ permission: state.permission, captureKind: state.captureKind }));
  return state;
}
async function openWindow(resolution) {
  win = new BrowserWindow({
    width: resolution.width, height: resolution.height, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, partition: resolution.partition },
  });
  win.webContents.debugger.attach('1.3');
  win.webContents.on('console-message', event => {
    if (event.level === 3 || event.level === 'error') { report.rendererErrors.push({ resolution: resolution.resolution, message: event.message }); }
  });
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    report.requests.push({ resolution: resolution.resolution, url: details.url, method: details.method });
    callback({});
  });
  await win.loadURL(url);
  await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
    width: resolution.width, height: resolution.height, deviceScaleFactor: 1, mobile: false,
  });
  await setup();
}
async function closeWindow(resolution) {
  const state = await read();
  report.runtimeErrors.push(...state.errors.map(message => ({ resolution: resolution.resolution, message })));
  win.webContents.session.flushStorageData();
  await new Promise(resolve => { win.once('closed', resolve); win.close(); });
  win = null;
}
async function login(account, allowPrologue) {
  await set('#folder-account', account);
  await click('#folder-login');
  await until(() => !!document.querySelector('#folder-complete-prologue') || !!document.querySelector('#world-folder'));
  if (await ev(() => !!document.querySelector('#folder-complete-prologue'))) {
    assert.equal(allowPrologue, true, 'Existing prologue projection was not retained');
    await click('#folder-complete-prologue');
  }
  await until(() => !!document.querySelector('#world-folder'));
}
const action = (name, worldId) => '[data-action="' + name + '"][data-world-id="' + worldId + '"]';
async function runResolution(width, height) {
  const resolution = {
    resolution: width + 'x' + height, width, height,
    partition: 'persist:b22-foundation-' + width + '-' + Date.now(),
    account: 'b22-production-preview-' + width,
    screenshots: [], checks: [],
  };
  report.resolutions.push(resolution);
  await openWindow(resolution);
  await login(resolution.account, true);
  const initial = await capture('00-directory-permission-derived-false', resolution);
  assert.equal(initial.permission?.data.firstWorldCleared, 'false');
  assert.equal(initial.permission?.data.copyPermission, 'false');
  assert.match(initial.permission?.text, /权限[：:]?未取得/);
  assert.deepEqual(initial.milestoneSnapshot, { accountId: resolution.account, FirstWorldCleared: false, CopyPermission: false });
  assert.equal(initial.forkAvailability?.data.availability, 'NotImplemented');
  assert.match(initial.forkAvailability?.text, /分叉.*未实施/);
  assert.ok(initial.rows.some(row => row.worldId === 'InitialWorld'));
  await click(action('fork-world', 'InitialWorld'));
  const fork = await read();
  assert.deepEqual(fork.storage, initial.storage);
  assert.match(fork.status?.text, /权限[：:]?未取得|分叉.*未实施/);
  await click(action('inspect-world-state', 'InitialWorld'));
  await until(() => document.querySelector('#world-state-diagnostics')?.hidden === false);
  const incomplete = await capture('01-incomplete-diagnostics', resolution);
  assert.match(incomplete.captureKind?.text, /Incomplete/);
  assert.ok(incomplete.diagnosticItems.length >= 7, 'Each missing component must be diagnosed');
  for (const component of ['Ledger', 'PuzzleProgress', 'RecallCount', 'FormatTime', 'WorldLink', 'ChartSnapshot', 'ChartScore']) {
    assert.ok(incomplete.diagnosticItems.some(item => (item.text + JSON.stringify(item.data)).toLowerCase().includes(component.toLowerCase())), 'Missing component diagnostic ' + component);
  }
  assert.deepEqual(incomplete.storage, initial.storage, 'Diagnostic capture changed product storage');
  assert.equal(incomplete.captureKind?.data.kind, 'Incomplete');
  assert.equal(incomplete.lastCaptures.length, 1);
  assert.equal(incomplete.lastCaptures[0].worldId, 'InitialWorld');
  assert.equal(incomplete.lastCaptures[0].result.kind, 'Incomplete');
  assert.deepEqual(incomplete.lastCaptures[0].result.capturedParts, {});
  await reveal('#world-state-restore-reject');
  await click('#world-state-restore-reject');
  await until(() => document.querySelector('#world-state-restore-status')?.dataset.kind === 'Rejected');
  await reveal('#world-state-restore-status');
  const rejected = await capture('02-complete-restore-rejected', resolution);
  assert.match(rejected.restoreStatus?.text, /完整恢复请求已拒绝/);
  assert.equal(rejected.restoreStatus?.data.kind, 'Rejected');
  assert.ok(rejected.restoreStatus.rect.y >= 0 && rejected.restoreStatus.rect.bottom <= height,
    'Restore rejection must be visibly inside the screenshot');
  assert.deepEqual(rejected.storage, initial.storage, 'Rejected restore changed product storage');
  await click('#refresh-worlds');
  await until(() => !!document.querySelector('#account-copy-permission'));
  const derivedRead = await capture('03-copy-permission-derived-read', resolution);
  assert.equal(derivedRead.permission?.data.firstWorldCleared, 'false');
  assert.equal(derivedRead.permission?.data.copyPermission, 'false');
  assert.deepEqual(derivedRead.milestoneSnapshot, initial.milestoneSnapshot);
  assert.deepEqual(derivedRead.storage, initial.storage, 'Derived permission read changed product storage');
  await closeWindow(resolution);
  await openWindow(resolution);
  await login(resolution.account, false);
  const reopened = await read();
  noRuntime(reopened);
  noClearWrite(reopened, resolution.account);
  assert.deepEqual(reopened.storage, initial.storage);
  assert.equal(reopened.permission?.data.copyPermission, 'false');
  resolution.checks = [
    'Current Creator sources match served compiled chunks and source maps',
    'Directory displays derived CopyPermission false separately from WorldFork NotImplemented',
    'No FirstWorldCleared projection written by production UI',
    'InitialWorld capture explicitly reports Incomplete and every missing component',
    'Full restore availability check explicitly rejects the request and preserves storage',
    'Refreshing directory reads CopyPermission from AccountMilestoneReader without storage writes',
    'Existing prologue and directory keys preserved; no world-state key falsely persisted',
    'Fresh persistent partition retains production state across window reopen',
    'Raw PNG, viewport, canvas and CSS dimensions match; no horizontal overflow or runtime errors',
  ].map(name => ({ name, pass: true }));
  resolution.final = reopened;
  resolution.pass = true;
  await closeWindow(resolution);
}
app.whenReady().then(async () => {
  try {
    report.compilation = await compilation();
    for (const [width, height] of [[1920, 1080], [2560, 1440]]) { await runResolution(width, height); }
    assert.deepEqual(report.rendererErrors, []);
    assert.deepEqual(report.runtimeErrors, []);
    report.externalRequests = report.requests.filter(request => {
      try {
        const parsed = new URL(request.url);
        return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      } catch { return false; }
    });
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(await compilation(), report.compilation, 'Production source compilation changed during screenshots');
    report.compilationUnchanged = true;
    report.pass = true;
  } catch (error) {
    report.pass = false;
    report.error = error.stack;
    try { if (win) { report.failureSnapshot = await read(); } } catch {}
    console.error(error.stack);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'creator-preview-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, resolutions: report.resolutions.length, error: report.error }));
    if (win) { win.destroy(); }
    app.exit(report.pass ? 0 : 1);
  }
});
