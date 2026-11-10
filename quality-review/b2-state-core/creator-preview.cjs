// Actual Creator localhost preview. Product input and native media; observations never write gameplay or storage.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const crypto = require('crypto'), os = require('os');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '../..'), url = 'http://localhost:7456/';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const baseline = path.join(__dirname, 'baseline');
const runId = Date.now();
const requiredSources = [
  'assets/scripts/SceneBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts',
  'src/director/LedgerHydration.ts', 'src/director/PuzzleHydration.ts', 'src/director/WorldStateCodec.ts',
  'src/director/WorldClearSession.ts', 'src/director/IntentPort.ts', 'src/director/WorldStateSession.ts',
  'src/presentation/WorldCoreStateStorage.ts', 'src/presentation/FormatTimeStorage.ts',
  'src/presentation/WorldCoreStateView.ts', 'src/presentation/DeepTraceRevealSequence.ts',
  'src/trace/PuzzleChain.ts', 'src/trace/PuzzleProgress.ts', 'src/trace/DeepTrace.ts', 'src/world/WorldInstance.ts',
  'src/director/AccountMilestone.ts', 'src/director/ChartReference.ts', 'src/director/RouteSignature.ts',
  'src/presentation/WorldClearView.ts', 'src/presentation/WorldChartView.ts',
  'src/presentation/AudioOutputClock.ts', 'src/presentation/InputCollector.ts', 'src/presentation/FrameDriver.ts',
  'src/chart/ChartPremiere.ts', 'src/ledger/deriveLedgerPosition.ts',
];
function sourceTargets() {
  const found = new Set(requiredSources);
  function walk(relative) {
    for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative + '/' + item.name;
      if (item.isDirectory()) walk(file);
      else if (item.isFile() && file.endsWith('.ts')) {
        const before = path.join(baseline, file);
        if (!fs.existsSync(before) || !fs.readFileSync(before).equals(fs.readFileSync(path.join(root, file)))) found.add(file);
      }
    }
  }
  walk('src');
  for (const item of fs.readdirSync(path.join(root, 'assets/scripts'), { withFileTypes: true })) {
    if (item.isFile() && item.name.endsWith('.ts')) {
      const file = 'assets/scripts/' + item.name, before = path.join(baseline, file);
      if (!fs.existsSync(before) || !fs.readFileSync(before).equals(fs.readFileSync(path.join(root, file)))) found.add(file);
    }
  }
  return [...found].sort();
}
const report = {
  schemaVersion: 1, evidenceKind: 'ProductionAcceptance', capturedAt: new Date().toISOString(),
  scope: 'B2.2d-1 partial Ledger / stable PuzzleProgress / FormatTime', previewUrl: url,
  profile: path.join(os.tmpdir(), 'neurou-b22d1-evidence-' + runId), harnessSha256: sha(fs.readFileSync(__filename)),
  policy: 'Fresh isolated userData and persistent partition per resolution; same account and same profile survive fresh BrowserWindow. Only login/prologue/published-choice/World-entry/world-exit controls plus GameCanvas keyboard edges. Native audio ended completes World; original 60 BPM output clock and unchanged natural movement/strike/reveal/media complete T6/T7. No setItem, snapshot fixture, vector input, direct director mutator, clock override, gameplay flag mutation or state injection. Read-only component/DOM/storage observation. Direct unmodified CDP PNG. Three-section Core stays Incomplete; no active timer/reveal/chart hydration is claimed.',
  resolutions: [], rendererErrors: [], runtimeErrors: [], requests: [], actions: [],
};
app.setPath('userData', report.profile);
for (const [name, value] of [['force-device-scale-factor', '1'], ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'], ['disable-backgrounding-occluded-windows']]) app.commandLine.appendSwitch(name, value);
app.on('window-all-closed', () => {});
let win, current;
const ev = (fn, ...args) => win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')', true);
async function until(fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const result = await ev(fn); if (result) return result; await delay(25); }
  throw Error('Timeout: ' + fn.toString());
}
async function click(selector) {
  await ev(selector => { const control = document.querySelector(selector); if (!control || control.disabled) throw Error('Missing/disabled product control ' + selector); control.click(); }, selector);
  report.actions.push({ resolution: current.resolution, type: 'ProductControl', selector, at: Date.now() }); await delay(90);
}
async function set(selector, value) {
  await ev((selector, value) => { const control = document.querySelector(selector); if (!control) throw Error('Missing product input ' + selector); control.value = value; control.dispatchEvent(new Event('input', { bubbles: true })); control.dispatchEvent(new Event('change', { bubbles: true })); }, selector, value);
}
async function edge(code, down) {
  await ev((code, down) => document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, repeat: false, bubbles: true, cancelable: true })), code, down);
  report.actions.push({ resolution: current.resolution, type: 'GameCanvasKeyboard', code, down, at: Date.now() });
}
async function press(code) { await edge(code, true); await edge(code, false); }
async function compilation() {
  const response = await fetch(url + 'scripting/x/import-map.json', { cache: 'no-store' }); assert.equal(response.ok, true);
  const imports = (await response.json()).imports;
  return Promise.all(sourceTargets().map(async file => {
    const suffix = file.startsWith('src/') ? 'assets/scripts/' + file : file;
    const id = Object.keys(imports).find(key => key.endsWith('/' + suffix)); assert.ok(id, 'Creator module missing: ' + file);
    const chunk = imports[id], chunkUrl = new URL(chunk, url + 'scripting/x/').href;
    const bytes = Buffer.from(await (await fetch(chunkUrl, { cache: 'no-store' })).arrayBuffer());
    const map = await (await fetch(chunkUrl + '.map', { cache: 'no-store' })).json(), source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(map.sourcesContent.includes(source), 'Stale Creator source: ' + file);
    assert.equal(sha(bytes), sha(fs.readFileSync(path.join(root, 'temp/programming/packer-driver/targets/preview', chunk))));
    return { file, chunk, sourceSha256: sha(source), chunkSha256: sha(bytes), sourceMapMatches: true, servedEqualsCompilerOutput: true };
  }));
}
async function setup() {
  await until(() => typeof System !== 'undefined' && !!document.querySelector('#folder-login'));
  await ev(async () => {
    const cc = await System.import('cc'); cc.profiler.hideStats();
    const all = (node, name) => node ? [...node.getComponents(name), ...node.children.flatMap(child => all(child, name))] : [];
    window.__b22d = { cc, all, errors: [], nativeMediaEvents: [], beats: [] };
    window.addEventListener('error', event => window.__b22d.errors.push(String(event.error?.stack || event.message)));
    window.addEventListener('unhandledrejection', event => window.__b22d.errors.push(String(event.reason?.stack || event.reason)));
  });
}
async function read() {
  return ev(() => {
    const env = window.__b22d, scene = env.cc.director.getScene(), builder = env.all(scene, 'SceneBuilder').find(item => !!item.graph);
    const folder = env.all(scene, 'WorldFolderBuilder')[0], world = builder?.worldClearSession, chart = world?.getWorldChartReader(), canvas = document.getElementById('GameCanvas');
    const node = selector => { const item = document.querySelector(selector); if (!item) return null; const rect = item.getBoundingClientRect(); return { text: item.textContent.trim(), data: { ...item.dataset }, hidden: item.hidden, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } }; };
    const media = item => item ? { src: item.currentSrc, duration: item.duration, time: item.currentTime, paused: item.paused, ended: item.ended, readyState: item.readyState } : null;
    return {
      viewport: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height], canvasCss: [canvas.clientWidth, canvas.clientHeight], dpr: devicePixelRatio,
      folder: !!document.querySelector('#world-folder'), runtimeNode: folder?.runtimeNode?.name ?? null,
      frameDrivers: env.all(scene, 'FrameDriver').length, inputCollectors: env.all(scene, 'InputCollector').length,
      permission: node('#account-copy-permission'), fork: node('#world-fork-availability'), story: node('#world-clear-view'),
      worldChart: node('#world-chart-view'), coreView: node('#world-core-state'), coreError: node('#world-core-error'), coreSnapshot: builder?.coreSnapshot ?? null,
      restoredCore: builder?.restoredCore ?? null, coreBoundary: builder?.coreBoundary ?? null,
      world: world?.getWorldClearSnapshot() ?? null, ledger: world?.getLedgerEvents() ?? null,
      premiere: chart ? { chartId: chart.getChartId(), tier: chart.getTier(), state: chart.getState(), timeMs: chart.getCurrentTimeMs(), result: chart.getResult(), resolved: chart.getResolvedCount(), total: chart.getTotalNoteCount(), perfect: chart.getPerfectCount(), good: chart.getGoodCount(), miss: chart.getMissCount() } : null,
      audio: media(builder?.worldChartView?.audio),
      legacy: builder ? { state: builder.chartPremiere?.getState(), result: builder.chartPremiere?.getResult(), chartId: builder.chartPremiere?.getChartId(), puzzle: builder.puzzleProgress?.getStage(), sustainedMs: builder.puzzleChain?.getSustainedElapsedMs(), entered: builder.chartEntered, position: builder.graph.protagonist.getPosition(), ledger: builder.graph.session.getLedgerEvents(), endpointSettled: builder.graph.session.endpointSettled, chartCompletionRecorded: builder.graph.session.chartCompletionRecorded, chartEntryScheduled: builder.graph.session.chartEntryScheduled, worldMotionGated: builder.graph.session.worldMotionGated, revealPhase: builder.revealSequence?.phase, deepTraceTriggered: builder.deepTrace?.isTriggered(), bgmReady: builder.bgmReady, bgmTimeMs: builder.audioOutputClock.readBgmTimeMs(), frameDriverEnabled: builder.gameplayDriver?.enabled, inputEnabled: builder.gameplayInput?.enabled, media: media(builder.videoPlayer?.nativeVideo) } : null,
      storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
      nativeMediaEvents: env.nativeMediaEvents.slice(), beats: env.beats.slice(),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth, errors: env.errors.slice(),
    };
  });
}
async function capture(name, res) {
  await ev(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const state = await read();
  assert.deepEqual(state.viewport, [res.width, res.height]); assert.deepEqual(state.canvas, state.viewport); assert.deepEqual(state.canvasCss, state.viewport);
  assert.equal(state.dpr, 1); assert.equal(state.horizontalOverflow, false); assert.deepEqual(state.errors, []); assert.equal(state.coreError, null);
  const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const png = Buffer.from(shot.data, 'base64'); assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], state.viewport);
  const file = res.resolution + '-' + name + '.png'; fs.writeFileSync(path.join(__dirname, file), png);
  res.screenshots.push({ name, file, sha256: sha(png), state });
  console.log('B2.2d-1 ' + res.resolution + ' ' + name + ' ' + JSON.stringify({ ledger: state.ledger?.length, puzzle: state.legacy?.puzzle, restored: state.restoredCore, revision: state.coreSnapshot?.revision })); return state;
}
async function open(res) {
  current = res; res.windowOpens = (res.windowOpens ?? 0) + 1;
  win = new BrowserWindow({ width: res.width, height: res.height, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false, partition: res.partition } });
  win.webContents.debugger.attach('1.3');
  win.webContents.on('console-message', event => { if (event.level === 3 || event.level === 'error') report.rendererErrors.push({ resolution: res.resolution, message: event.message }); });
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => { report.requests.push({ resolution: res.resolution, url: details.url, method: details.method }); callback({}); });
  await win.loadURL(url); await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: res.width, height: res.height, deviceScaleFactor: 1, mobile: false }); await setup();
}
async function close() {
  if (!win) return; const state = await read(); report.runtimeErrors.push(...state.errors); win.webContents.session.flushStorageData();
  await new Promise(resolve => { win.once('closed', resolve); win.close(); }); win = null;
}
async function login(account, prologue) {
  await set('#folder-account', account); await click('#folder-login');
  await until(() => !!document.querySelector('#folder-complete-prologue') || !!document.querySelector('#world-folder'));
  if (await ev(() => !!document.querySelector('#folder-complete-prologue'))) { assert.ok(prologue); await click('#folder-complete-prologue'); }
  await until(() => !!document.querySelector('#world-folder'));
}
async function enter() {
  await click('#open-initial-world');
  await until(() => {
    if (document.querySelector('#world-core-error')) throw Error(document.querySelector('#world-core-error').textContent);
    const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph);
    return builder?.worldClearSession?.getWorldClearSnapshot().mediaReady && !!document.querySelector('#world-core-state') && builder.gameplayDriver?.enabled;
  });
  await ev(() => {
    const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph);
    builder.worldChartView.audio.addEventListener('ended', () => env.nativeMediaEvents.push({ type: 'WorldAudioEnded', src: builder.worldChartView.audio.currentSrc, time: builder.worldChartView.audio.currentTime, duration: builder.worldChartView.audio.duration, nativeEnded: builder.worldChartView.audio.ended }));
    const video = builder.videoPlayer?.nativeVideo;
    if (video) video.addEventListener('ended', () => env.nativeMediaEvents.push({ type: 'RegularVideoEnded', src: video.currentSrc, time: video.currentTime, duration: video.duration, nativeEnded: video.ended }));
  });
}
async function exitWorld() { await click('#folder-runtime-exit'); await until(() => !!document.querySelector('#world-folder')); }
function keys(account) {
  return { core: 'neurou-world-state-v1:' + encodeURIComponent(account) + ':InitialWorld',
    record: 'neurou-account-world-clears-v1:' + encodeURIComponent(account), projection: 'neurou-account-first-world-cleared-v1:' + encodeURIComponent(account) };
}
function saved(state, res) { const bytes = state.storage[keys(res.account).core]; assert.equal(typeof bytes, 'string'); return JSON.parse(bytes); }
function ledgerOf(core) { return core.sections.Ledger.characters.flatMap(character => character.events); }
function stableCore(state, res, count, stage, restored) {
  const core = saved(state, res); assert.equal(core.kind, 'Core'); assert.equal(core.schemaVersion, 1); assert.equal(core.worldKind, 'Primary');
  assert.equal(core.accountId, res.account); assert.equal(core.worldId, 'InitialWorld'); assert.deepEqual(Object.keys(core.sections), ['Ledger', 'PuzzleProgress', 'FormatTime']);
  assert.deepEqual(core, state.coreSnapshot); assert.deepEqual(ledgerOf(core), state.ledger); assert.equal(state.ledger.length, count);
  assert.equal(core.sections.PuzzleProgress.length, 1); const puzzle = core.sections.PuzzleProgress[0]; assert.equal(puzzle.chain.stage, stage);
  assert.equal(core.sections.FormatTime.epochMs, res.formatTime); assert.equal(JSON.stringify(core.sections.FormatTime), res.formatTimeBytes); assert.equal(state.coreView.data.formatTime, String(res.formatTime));
  assert.equal(state.coreView.data.ledgerCount, String(count)); assert.equal(state.coreView.data.puzzleStage, stage);
  assert.equal(state.coreView.data.capturedParts, '3'); assert.equal(state.coreView.data.captureKind, 'Incomplete');
  assert.equal(state.restoredCore, restored); assert.equal(state.coreView.data.restored, String(restored));
  assert.equal(state.frameDrivers, 1); assert.equal(state.inputCollectors, 1); assert.equal(state.legacy.frameDriverEnabled, true); assert.equal(state.legacy.inputEnabled, true);
  return core;
}
function unchangedCore(state, res, bytes) { assert.equal(state.storage[keys(res.account).core], bytes); assert.equal(state.storage[keys(res.account).record], res.recordBytes); assert.equal(state.storage[keys(res.account).projection], res.projectionBytes); }
async function worldClear(res) {
  await open(res); res.creationStart = Date.now(); await login(res.account, true);
  const folder = await capture('00-new-account-created-format-time', res), initial = saved(folder, res);
  assert.equal(initial.revision, 0); assert.equal(initial.sections.Ledger, null); assert.equal(initial.sections.PuzzleProgress, null);
  assert.ok(Number.isSafeInteger(initial.sections.FormatTime.epochMs)); assert.ok(initial.sections.FormatTime.epochMs >= res.creationStart && initial.sections.FormatTime.epochMs <= Date.now());
  res.formatTime = initial.sections.FormatTime.epochMs; res.formatTimeBytes = JSON.stringify(initial.sections.FormatTime);
  assert.equal(folder.permission.data.copyPermission, 'false'); assert.equal(folder.fork.data.availability, 'NotImplemented');
  await enter(); const primary = await capture('01-primary-empty-stable-core', res); stableCore(primary, res, 0, 'Step1', false);
  await click('[data-choice-id="share-shelter"]'); await until(() => document.querySelector('#world-clear-view')?.dataset.sphereCrossed === 'true');
  const choice = await capture('02-player-choice-durable-ledger-sphere-entry', res); stableCore(choice, res, 1, 'Step1', false);
  assert.equal(choice.ledger[0].InputSource, 0); assert.equal(choice.ledger[0].ChartRef.state, 'Entry'); assert.ok(choice.ledger[0].vector.some(value => value > 0));
  assert.equal(choice.world.entry.source, 'SphereCrossing'); assert.equal(choice.world.entry.tier, 'World'); assert.ok(choice.world.distance >= choice.world.EventDistance);
  await click('#enter-world-boss-chart'); await until(() => {
    const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph);
    return builder.worldClearSession.getWorldChartReader().getCurrentTimeMs() > 700;
  });
  const playing = await capture('03-world-chart-native-media', res); assert.equal(playing.premiere.state, 'Playing'); assert.equal(playing.audio.duration, 6); assert.equal(playing.audio.paused, false);
  await until(() => document.querySelector('#world-clear-view')?.dataset.completionStatus === 'Completed', 14000);
  await until(() => document.querySelector('#world-core-state')?.dataset.ledgerCount === '2');
  const cleared = await capture('04-world-completed-durable-ledger-account-record', res), core = stableCore(cleared, res, 2, 'Step1', false);
  assert.equal(cleared.ledger[1].ChartRef.state, 'PremiereCompleted'); assert.equal(cleared.premiere.result.completed, true); assert.equal(cleared.premiere.miss, cleared.premiere.total);
  assert.ok(cleared.nativeMediaEvents.some(event => event.type === 'WorldAudioEnded' && event.nativeEnded && event.time === 6));
  const accountKeys = keys(res.account); assert.equal(JSON.parse(cleared.storage[accountKeys.record]).records.length, 1); assert.equal(JSON.parse(cleared.storage[accountKeys.projection]).FirstWorldCleared, true);
  assert.equal(cleared.story.data.copyPermission, 'true'); res.recordBytes = cleared.storage[accountKeys.record]; res.projectionBytes = cleared.storage[accountKeys.projection];
  res.worldCoreBytes = cleared.storage[accountKeys.core]; res.worldCore = core; res.worldLedger = cleared.ledger; res.worldCompleted = cleared;
  await exitWorld(); const directory = await capture('05-directory-after-world-clear-durable-core', res); unchangedCore(directory, res, res.worldCoreBytes);
  assert.equal(directory.permission.data.copyPermission, 'true'); assert.equal(directory.frameDrivers, 0); assert.equal(directory.inputCollectors, 0);
  await enter(); const restored = await capture('06-world-ledger-seeded-reentry-byte-preserved', res); stableCore(restored, res, 2, 'Step1', true); unchangedCore(restored, res, res.worldCoreBytes);
  assert.deepEqual(restored.ledger, res.worldLedger); assert.equal(restored.world.sphereCrossed, true); assert.deepEqual(restored.world.entry, cleared.world.entry);
  assert.equal(restored.world.completionStatus, 'Completed'); assert.deepEqual(restored.world.record, cleared.world.record); assert.equal(restored.world.selectedChoiceId, 'share-shelter');
  assert.equal(await ev(() => document.querySelector('[data-choice-id="share-shelter"]').disabled), true);
  assert.equal(await ev(() => document.querySelector('#enter-world-boss-chart').hidden), true); res.worldRestored = restored;
}
async function naturalPuzzle(res) {
  // Only actual GameCanvas key edges, scheduled from the real read-only native output clock.
  await press('Tab'); await edge('KeyA', true);
  await until(() => { const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph); return builder.graph.protagonist.getPosition().lateral <= -5.9; }, 10000);
  await edge('KeyA', false);
  await until(() => { const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph); return builder.puzzleProgress.getStage() === 'AwaitingStrike'; });
  await ev(() => {
    const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph); let next = null;
    env.beatTimer = setInterval(() => {
      const time = builder.audioOutputClock.readBgmTimeMs();
      if (time < 0 || builder.chartEntered || builder.puzzleProgress.getStage() !== 'AwaitingStrike') return;
      if (next === null) next = Math.ceil(time / 1000) * 1000;
      if (time >= next + 20) {
        env.beats.push({ actualOutputTimeMs: time, targetBeatTimeMs: next });
        const canvas = document.getElementById('GameCanvas');
        for (const type of ['keydown', 'keyup']) canvas.dispatchEvent(new KeyboardEvent(type, { code: 'Digit1', repeat: false, bubbles: true, cancelable: true }));
        next += 1000;
      }
    }, 4);
  });
  await until(() => { const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph); return builder.chartEntered; }, 25000);
  await ev(() => clearInterval(window.__b22d.beatTimer));
  const entry = await capture('07-natural-t6-entry-cumulative-three-ledger-events', res);
  assert.equal(entry.legacy.puzzle, 'Completed'); assert.equal(entry.legacy.endpointSettled, true); assert.equal(entry.ledger.length, 3);
  assert.equal(entry.ledger[2].eventId, 'T6_ENDPOINT_PLACEHOLDER'); assert.equal(entry.ledger[2].ChartRef.state, 'Entry'); assert.ok(entry.ledger[2].vector.every(value => value === 0));
  assert.equal(entry.legacy.sustainedMs >= 7000, true); assert.ok(entry.beats.length >= 7); assert.equal(entry.story.hidden, true);
  for (const beat of entry.beats) assert.ok(Math.abs(beat.actualOutputTimeMs - beat.targetBeatTimeMs) <= 100, 'Natural beat missed its unchanged +/-100ms window');
  assert.equal(saved(entry, res).sections.FormatTime.epochMs, res.formatTime);
  await until(() => { const env = window.__b22d, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph); return builder.chartPremiere.getResult()?.completed && !builder.chartEntered; }, 22000);
  await until(() => document.querySelector('#world-core-state')?.dataset.puzzleStage === 'Completed' && document.querySelector('#world-core-state')?.dataset.ledgerCount === '4');
  const complete = await capture('08-natural-t7-completed-stable-puzzle-ledger-format-time', res), core = stableCore(complete, res, 4, 'Completed', true);
  assert.equal(complete.ledger[3].eventId, 'T7_COMPLETION_PLACEHOLDER'); assert.equal(complete.ledger[3].ChartRef.state, 'PremiereCompleted'); assert.ok(complete.ledger.slice(2).every(event => event.vector.every(value => value === 0)));
  assert.deepEqual(complete.ledger.slice(0, 2), res.worldLedger); assert.equal(complete.legacy.result.completed, true);
  const puzzle = core.sections.PuzzleProgress[0]; assert.equal(puzzle.control.endpointSettled, true); assert.equal(puzzle.control.deepTraceTriggered, true);
  assert.equal(puzzle.control.chartCompletionRecorded, true); assert.equal(puzzle.control.revealPhase, 'Finished'); assert.equal(puzzle.control.chartEntryScheduled, false); assert.equal(puzzle.control.worldMotionGated, false);
  assert.equal(complete.storage[keys(res.account).record], res.recordBytes); assert.equal(complete.storage[keys(res.account).projection], res.projectionBytes);
  res.completedCoreBytes = complete.storage[keys(res.account).core]; res.completedCore = core; res.completedLedger = complete.ledger; res.puzzleCompleted = complete;
  await exitWorld(); const directory = await capture('09-directory-completed-puzzle-persisted', res); unchangedCore(directory, res, res.completedCoreBytes);
  await enter(); const restored = await capture('10-puzzle-completed-seeded-reentry-format-time-preserved', res); assertPuzzleRestore(restored, res);
  await press('Enter'); await press('Digit1'); await delay(1100); const blocked = await read(); assertPuzzleRestore(blocked, res);
  res.replayBlocked = { pass: true, attemptedProductKeys: ['Enter', 'Digit1'], state: blocked };
  await exitWorld(); await close(); await open(res); await login(res.account, false);
  const directoryFresh = await capture('11-fresh-window-same-profile-directory-preserved', res); unchangedCore(directoryFresh, res, res.completedCoreBytes); assert.equal(directoryFresh.permission.data.copyPermission, 'true');
  await enter(); const fresh = await capture('12-fresh-window-puzzle-ledger-format-time-restored', res); assertPuzzleRestore(fresh, res);
  await delay(1500); const unchanged = await read(); assertPuzzleRestore(unchanged, res); assert.deepEqual(unchanged.nativeMediaEvents, []);
  res.freshWindowRestore = fresh; res.freshWindowNoReplay = { pass: true, state: unchanged }; await exitWorld(); await close();
}
function assertPuzzleRestore(state, res) {
  stableCore(state, res, 4, 'Completed', true); unchangedCore(state, res, res.completedCoreBytes); assert.deepEqual(state.ledger, res.completedLedger);
  assert.equal(state.legacy.puzzle, 'Completed'); assert.equal(state.legacy.endpointSettled, true); assert.equal(state.legacy.chartCompletionRecorded, true);
  assert.equal(state.legacy.deepTraceTriggered, true); assert.equal(state.legacy.revealPhase, 'Finished'); assert.equal(state.legacy.chartEntryScheduled, false); assert.equal(state.legacy.worldMotionGated, false);
  assert.equal(state.legacy.entered, false); assert.equal(state.legacy.state, 'Ready'); assert.equal(state.legacy.result, null);
  assert.equal(state.world.completionStatus, 'Completed'); assert.equal(state.world.chartActive, false); assert.equal(state.story.data.copyPermission, 'true');
}
async function resolution(width, height) {
  const res = { width, height, resolution: width + 'x' + height, account: 'b22d1-production-' + width + '-' + runId,
    partition: 'persist:b22d1-' + width + '-' + runId, screenshots: [] }; report.resolutions.push(res);
  await worldClear(res); await naturalPuzzle(res);
  res.checks = [
    'Explicit new-account directory creation initializes one authoritative FormatTime before world entry',
    'Published Player choice and native World audio complete unchanged World gameplay and persist two authoritative ledger events',
    'Account record/projection are separate keys; one record and unchanged bytes through all subsequent world restores',
    'World clear reentry seeds original ledger values, order, timestamps, append guards and sphere entry without replay or byte rewrite',
    'Natural KeyA movement and native 60 BPM output-clock Digit1 edges complete unchanged seven-second puzzle and reveal',
    'Natural T6/T7 keep original zero vectors; one Entry and one PremiereCompleted append to cumulative four-event same-account ledger',
    'Completed stable puzzle captures private timers, endpoint, T7 flag and terminal reveal without active chart/result state',
    'Completed puzzle reentry and product Enter/Digit1 cannot duplicate endpoint, replay reveal or replay already-completed T7',
    'Closing and creating a fresh BrowserWindow in the same profile/partition silently restores identical full core bytes',
    'FormatTime original epochMs survives revisions, runtime exit/reentry and fresh-window reopen unchanged',
    'Three-section payload and view remain Core / Incomplete; no seven-section Complete or active-media hydration is claimed',
    'One enabled FrameDriver/InputCollector after assembly; none after world destruction; no runtime/renderer errors',
    'All changed/new source maps match local source and served chunks; no source changes during evidence',
    'Native viewport, canvas and unmodified PNG match resolution; no horizontal overflow',
  ].map(name => ({ name, pass: true })); res.pass = true;
}
app.whenReady().then(async () => {
  try {
    report.compilation = await compilation();
    for (const [width, height] of [[1920, 1080], [2560, 1440]]) await resolution(width, height);
    assert.deepEqual(report.rendererErrors, []); assert.deepEqual(report.runtimeErrors, []);
    report.externalRequests = report.requests.filter(request => { try { const target = new URL(request.url); return ['http:', 'https:', 'ws:', 'wss:'].includes(target.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname); } catch { return false; } });
    assert.deepEqual(report.externalRequests, []); assert.deepEqual(await compilation(), report.compilation, 'Sources or served compilation changed during evidence');
    report.compilationUnchanged = true;
    const [a, b] = report.resolutions; assert.deepEqual(a.worldCompleted.world.record.routeSignature, b.worldCompleted.world.record.routeSignature);
    const puzzleShape = res => { const value = res.completedCore.sections.PuzzleProgress[0]; return { stage: value.chain.stage, requiredSustainedMs: value.chain.requiredSustainedMs, beatIntervalMs: value.chain.beatIntervalMs, endpointSettled: value.control.endpointSettled, chartCompletionRecorded: value.control.chartCompletionRecorded, revealPhase: value.control.revealPhase }; };
    assert.deepEqual(puzzleShape(a), puzzleShape(b));
    report.resolutionComparison = { sameRouteSignature: true, sameStablePuzzleFacts: true, cumulativeLedgerCountEach: 4,
      recordCountEach: 1, sameProfileFreshWindowRestoresEach: true, coreBytesPreservedEach: true, originalFormatTimePreservedEach: true,
      captureKindEach: 'Incomplete', actualDimensions: ['1920x1080', '2560x1440'] }; report.pass = true;
  } catch (error) {
    report.pass = false; report.error = error.stack;
    try {
      if (win) {
        report.failureSnapshot = await read();
        const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        const file = (current?.resolution ?? 'unknown') + '-diagnostic-failure.png';
        fs.writeFileSync(path.join(__dirname, file), Buffer.from(shot.data, 'base64')); report.failureScreenshot = file;
      }
    } catch {} console.error(error.stack);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'creator-preview-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, resolutions: report.resolutions.length, error: report.error }));
    if (win) win.destroy(); app.exit(report.pass ? 0 : 1);
  }
});
