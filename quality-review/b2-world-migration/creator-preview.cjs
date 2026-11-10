// Actual Creator localhost preview. Product input and native media; observations never write gameplay or storage.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const crypto = require('crypto'), os = require('os');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '../..'), url = 'http://localhost:7456/';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const baseline = path.join(__dirname, 'original-source');
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
  scope: 'B2.4d same-ID WorldMigration and account-wide RealityPause, persistent shared ContractAdapter and source SafePoint drain', previewUrl: url,
  profile: path.join(os.tmpdir(), 'neurou-b24d-evidence-' + runId), harnessSha256: sha(fs.readFileSync(__filename)),
  policy: 'Actual Creator preview; fresh isolated profile per resolution; product login/prologue/native World audio/local Fork/Release/Claim/open controls. Two logical devices share a persistent ContractAdapter service fixture. The harness explicitly advances its independent service clock, never client time or gameplay state: this does not prove an actual elapsed hour or an external service. Read-only game/storage observations, direct CDP PNG; no game/file seeding, full FileCarry or physical-device authentication claim.',
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
    window.__b23 = { cc, all, errors: [], nativeMediaEvents: [], beats: [] };
    window.addEventListener('error', event => window.__b23.errors.push(String(event.error?.stack || event.message)));
    window.addEventListener('unhandledrejection', event => window.__b23.errors.push(String(event.reason?.stack || event.reason)));
  });
}
async function read() {
  return ev(() => {
    const env = window.__b23, scene = env.cc.director.getScene(), builder = env.all(scene, 'SceneBuilder').find(item => !!item.graph);
    const folder = env.all(scene, 'WorldFolderBuilder')[0], world = builder?.worldClearSession, chart = world?.getWorldChartReader(), canvas = document.getElementById('GameCanvas');
    const node = selector => { const item = document.querySelector(selector); if (!item) return null; const rect = item.getBoundingClientRect(); return { text: item.textContent.trim(), data: { ...item.dataset }, hidden: item.hidden, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } }; };
    const media = item => item ? { src: item.currentSrc, duration: item.duration, time: item.currentTime, paused: item.paused, ended: item.ended, readyState: item.readyState } : null;
    return {
      viewport: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height], canvasCss: [canvas.clientWidth, canvas.clientHeight], dpr: devicePixelRatio,
      folder: !!document.querySelector('#world-folder'), runtimeNode: folder?.runtimeNode?.name ?? null,
      frameDrivers: env.all(scene, 'FrameDriver').length, inputCollectors: env.all(scene, 'InputCollector').length,
      permission: node('#account-copy-permission'), fork: node('#world-fork-availability'), story: node('#world-clear-view'),
      memoryView: node('#world-memory-view'), replayView: node('#chart-replay-view'), capture: builder?.stateSession?.captureWorldState() ?? null, restoreKind: builder?.restoreKind ?? null, worldChart: node('#world-chart-view'), coreView: node('#world-core-state'), coreError: node('#world-core-error'), coreSnapshot: builder?.coreSnapshot ?? null,
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
  console.log('B2.4d ' + res.resolution + ' ' + name + ' ' + JSON.stringify({ ledger: state.ledger?.length, puzzle: state.legacy?.puzzle, restored: state.restoredCore, revision: state.coreSnapshot?.revision })); return state;
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
    const env = window.__b23, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph);
    return builder?.worldClearSession?.getWorldClearSnapshot().mediaReady && !!document.querySelector('#world-core-state') && builder.gameplayDriver?.enabled;
  });
  await ev(() => {
    const env = window.__b23, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph);
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
  assert.equal(core.accountId, res.account); assert.equal(core.worldId, 'InitialWorld'); assert.deepEqual(Object.keys(core.sections), ['Ledger', 'PuzzleProgress', 'FormatTime', 'RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']);
  assert.deepEqual(core, state.coreSnapshot); assert.deepEqual(ledgerOf(core), state.ledger); assert.equal(state.ledger.length, count);
  assert.equal(core.sections.PuzzleProgress.length, 1); const puzzle = core.sections.PuzzleProgress[0]; assert.equal(puzzle.chain.stage, stage);
  assert.equal(core.sections.FormatTime.epochMs, res.formatTime); assert.equal(JSON.stringify(core.sections.FormatTime), res.formatTimeBytes); assert.equal(state.coreView.data.formatTime, String(res.formatTime));
  assert.equal(state.coreView.data.ledgerCount, String(count)); assert.equal(state.coreView.data.puzzleStage, stage);
  assert.equal(state.coreView.data.capturedParts, '7'); assert.equal(state.coreView.data.captureKind, 'Complete');
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
  assert.equal(folder.permission.data.copyPermission, 'false'); assert.equal(folder.fork.data.availability, 'Implemented');
  await enter(); const primary = await capture('01-primary-empty-stable-core', res); stableCore(primary, res, 0, 'Step1', false);
  await click('[data-choice-id="share-shelter"]'); await until(() => document.querySelector('#world-clear-view')?.dataset.sphereCrossed === 'true');
  const choice = await capture('02-player-choice-durable-ledger-sphere-entry', res); stableCore(choice, res, 1, 'Step1', false);
  assert.equal(choice.ledger[0].InputSource, 0); assert.equal(choice.ledger[0].ChartRef.state, 'Entry'); assert.ok(choice.ledger[0].vector.some(value => value > 0));
  assert.equal(choice.world.entry.source, 'SphereCrossing'); assert.equal(choice.world.entry.tier, 'World'); assert.ok(choice.world.distance >= choice.world.EventDistance);
  await click('#enter-world-boss-chart'); await until(() => {
    const env = window.__b23, builder = env.all(env.cc.director.getScene(), 'SceneBuilder').find(item => !!item.graph);
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


function bKey(key) { return 'neurou-contract-device-b:' + encodeURIComponent(key); }
async function expectRefused(selector, runtime = null) {
  await click(selector); await delay(200);
  assert.equal((await read()).runtimeNode,runtime);
}
async function replayObservation() {
  return ev(() => {
    const env=window.__b23, scene=env.cc.director.getScene();
    const builder=env.all(scene,'SceneBuilder').find(x=>!!x.graph);
    const folder=env.all(scene,'WorldFolderBuilder')[0];
    const media=document.querySelector('#chart-replay-view [data-role="chart-replay-media"]');
    const reader=builder?.replaySession?.getReader();
    return {runtime:folder?.runtimeNode?.name??null,closed:folder?.migrationPrototype?.isRuntimeClosed(),
      active:builder?.replaySession?.isActive()??false,state:reader?.getState(),timeMs:reader?.getCurrentTimeMs(),
      result:reader?.getResult(),events:[...(env.replayPauseEvidence??[])],
      media:media?{time:media.currentTime,duration:media.duration,paused:media.paused,ended:media.ended,seeking:media.seeking}:null};
  });
}
async function activeReplayPause(res, sourceId, sourceKey) {
  const before=await read();
  await click('[data-action="fork-world"][data-world-id="InitialWorld"]');
  await until(()=>document.querySelector('#world-migration-source')?.options.length===2);
  const secondId=await ev(id=>Array.from(document.querySelector('#world-migration-source').options)
    .map(x=>x.value).find(x=>x!==id),sourceId);
  assert.notEqual(secondId,sourceId);
  const secondKey='neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(secondId);
  const original=await read(), secondBytes=original.storage[secondKey]; assert.equal(typeof secondBytes,'string');
  const folderKey='neurou-world-folder-v1:'+encodeURIComponent(res.account), directoryBytes=original.storage[folderKey];
  const replayWin=win; let authorityWin=null;
  try {
    await open(res); authorityWin=win; await login(res.account,false);
    await until(()=>{
      const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0];
      return document.querySelector('#world-migration-source')&&f.migrationPrototype&&!f.migrationPrototype.busy&&
        f.migrationPrototype.bindings.isIdle();
    });
    await set('#world-migration-source',secondId);
    win=replayWin; await click('#world-migration-open');
    await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
    const targetBefore=JSON.parse((await read()).storage[bKey(sourceKey)]);
    await click('[data-action="replay-chart"]');
    await until(()=>{
      const media=document.querySelector('#chart-replay-view [data-role="chart-replay-media"]');
      return media&&!media.paused&&media.currentTime>.4;
    });
    await ev(()=>{
      const media=document.querySelector('#chart-replay-view [data-role="chart-replay-media"]');
      window.__b23.replayPauseEvidence=[];
      for(const type of ['playing','pause','seeking','ended']) media.addEventListener(type,()=>
        window.__b23.replayPauseEvidence.push({type,time:media.currentTime,ended:media.ended,duration:media.duration}));
    });
    const playing=await replayObservation();assert.equal(playing.active,true);assert.equal(playing.closed,false);
    win=authorityWin;
    res.activeReplayPauseReleasePreflight=await ev(()=>{
      const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0],p=f.migrationPrototype;
      return {selected:document.querySelector('#world-migration-source')?.value,busy:p.busy,idle:p.bindings.isIdle(),
        runtime:f.runtimeNode?.name??null,opening:f.opening,directoryBusy:f.directoryBusy,retiring:f.retiring,
        phase:document.querySelector('#world-migration-prototype')?.dataset.phase};
    });
    assert.equal(res.activeReplayPauseReleasePreflight.selected,secondId);
    assert.equal(res.activeReplayPauseReleasePreflight.busy,false);assert.equal(res.activeReplayPauseReleasePreflight.idle,true);
    await click('#world-migration-release');
    const secondMigration=await until(()=>{
      const p=document.querySelector('#world-migration-prototype');if(p?.dataset.error)throw Error(p.dataset.error);
      return p?.dataset.phase==='PauseActive'?p.dataset.migrationId:false;
    });
    await capture('14-other-window-source-drain-and-account-pause',res);
    win=replayWin;const first=await replayObservation();
    assert.equal(first.closed,true);assert.equal(first.active,true);assert.equal(first.runtime,sourceId);
    assert.equal(first.media.paused,false);assert.equal(first.media.seeking,false);assert.ok(first.media.time>playing.media.time);
    await click('#folder-runtime-exit'); await delay(250);
    const continuing=await replayObservation();assert.equal(continuing.active,true);assert.equal(continuing.runtime,sourceId);
    assert.equal(continuing.media.paused,false);assert.ok(continuing.media.time>first.media.time);
    assert.deepEqual(continuing.events.filter(e=>['pause','seeking'].includes(e.type)),[]);
    await capture('15-active-b-replay-preserves-native-timeline',res);
    await until(()=>!!document.querySelector('#world-folder'),15000);
    const retired=await capture('16-native-ended-then-safe-retirement',res),ended=await replayObservation();
    assert.equal(retired.runtimeNode,null);assert.equal(retired.frameDrivers,0);assert.equal(retired.inputCollectors,0);
    assert.ok(ended.events.some(e=>e.type==='ended'&&e.ended&&e.time===e.duration&&e.duration===6));
    assert.deepEqual(ended.events.filter(e=>e.type==='seeking'),[]);
    const targetAfter=JSON.parse(retired.storage[bKey(sourceKey)]);
    assert.deepEqual(targetAfter.sections.Ledger,targetBefore.sections.Ledger);
    assert.deepEqual(targetAfter.sections.FormatTime,targetBefore.sections.FormatTime);
    assert.deepEqual(targetAfter.forkOrigin,targetBefore.forkOrigin);
    assert.equal(targetAfter.sections.ChartScore.records[0].completedPlayCount,targetBefore.sections.ChartScore.records[0].completedPlayCount+1);
    assert.equal(retired.storage[secondKey],secondBytes);assert.equal(retired.storage[folderKey],directoryBytes);
    assert.equal(retired.storage[keys(res.account).record],before.storage[keys(res.account).record]);
    assert.equal(retired.storage[keys(res.account).projection],before.storage[keys(res.account).projection]);
    res.activeReplayPauseAcceptance={pass:true,mode:'ContractAdapter',twoClientWindows:true,sourceWorldId:secondId,
      replayWorldId:sourceId,migrationId:secondMigration,nativeDurationSeconds:6,observations:[playing,first,continuing,ended],
      noForcedMediaEnd:true,noSeekOrTimelineReset:true,naturalSafePointRetirement:true,completedPlayCountIncrement:1,
      explicitFolderExitWaitedForSafePoint:true,accountFactsPreserved:true,serviceClockAdvancedMs:0};
  } catch(error) {
    if(authorityWin&&!authorityWin.isDestroyed()){win=authorityWin;res.activeReplayPauseAuthorityFailure=await read();
      res.activeReplayPauseAuthorityStatus=await ev(()=>document.querySelector('#world-migration-prototype')?.outerHTML);}
    throw error;
  } finally {
    if(authorityWin&&!authorityWin.isDestroyed()){win=authorityWin;await close();}win=replayWin;
  }
}
async function migrationResolution(width,height) {
  const res={width,height,resolution:width+'x'+height,account:'b24d-production-'+width+'-'+runId,
    partition:'persist:b24d-'+width+'-'+runId,screenshots:[]}; report.resolutions.push(res);
  await worldClear(res); await exitWorld();
  await click('[data-action="fork-world"][data-world-id="InitialWorld"]');
  const sourceId=await until(()=>document.querySelector('#world-migration-source')?.value||false);
  assert.match(sourceId,/^world-[0-9a-f-]{36}$/);
  const sourceKey='neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(sourceId);
  const folderKey='neurou-world-folder-v1:'+encodeURIComponent(res.account);
  const before=await read(), sourceBytes=before.storage[sourceKey],source=JSON.parse(sourceBytes);
  const folderBytes=before.storage[folderKey],recordBytes=before.storage[keys(res.account).record],projectionBytes=before.storage[keys(res.account).projection];
  await click('#cross-device-export');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('A 已发送'));
  await click('#world-migration-release');
  const migration=await until(()=>{
    const p=document.querySelector('#world-migration-prototype');if(p?.dataset.error)throw Error(p.dataset.error);
    return p?.dataset.phase==='PauseActive'?p.dataset.migrationId:false;
  });
  const paused=await capture('07-active-reality-pause-source-drained',res);
  const authority=JSON.parse(paused.storage['neurou-migration-contract-authority-v1']);
  const m=authority.migrations.find(x=>x.payload.migrationId===migration);
  assert.equal(m.receipt.pause.resumeNotBeforeServerEpochMs-m.receipt.pause.startedAtServerEpochMs,3600000);
  assert.equal(m.receipt.pause.endedAtServerEpochMs,null);assert.equal(m.receipt.record.homeDeviceId,'logical-device-a');
  assert.equal(paused.storage[sourceKey],sourceBytes);assert.equal(paused.storage[folderKey],folderBytes);
  const sourceJournal=JSON.parse(paused.storage['neurou-migration-v1:'+encodeURIComponent(res.account)]);
  assert.equal(sourceJournal.entries[0].phase,'PauseActive');
  await expectRefused('#open-initial-world');
  await expectRefused('[data-action="open-world"][data-world-id="'+sourceId+'"]');
  await click('#cross-device-import');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('PauseActive'));
  await click('#world-migration-claim');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.error?.includes('PauseActive'));
  await capture('08-account-pause-a-and-b-entry-rejected',res);
  await close(); await open(res);
  await set('#folder-account',res.account+'-other');await click('#folder-login');
  await until(()=>document.querySelector('#folder-startup [role=status]')?.textContent.includes('DeviceAccountBinding'));
  assert.equal((await read()).folder,false);await capture('09-restart-device-account-binding',res);
  await login(res.account,false);
  assert.equal(await ev(()=>document.querySelector('#world-migration-prototype').dataset.phase),'PauseActive');
  await ev(()=>{
    const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0];
    f.migrationPrototype.serviceClockFixture.advanceServiceFixtureBy(3599999);
  });
  report.actions.push({resolution:res.resolution,type:'ContractAdapterServiceFixtureClock',advanceMs:3599999,realElapsedHour:false});
  await click('#world-migration-refresh');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.phase==='PauseActive');
  await expectRefused('#open-initial-world');
  await ev(()=>{
    const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0];
    f.migrationPrototype.serviceClockFixture.advanceServiceFixtureBy(1);
  });
  report.actions.push({resolution:res.resolution,type:'ContractAdapterServiceFixtureClock',advanceMs:1,realElapsedHour:false});
  await click('#world-migration-refresh');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.phase==='Released');
  await capture('10-service-time-released',res);
  await click('#world-migration-claim');await until(()=>{
    const p=document.querySelector('#world-migration-prototype');if(p?.dataset.error)throw Error(p.dataset.error);return p?.dataset.phase==='Claimed';
  });
  const claimed=await capture('11-device-b-same-id-local-published',res);
  const targetKey=bKey(sourceKey), journalKey=bKey('neurou-migration-v1:'+encodeURIComponent(res.account));
  assert.equal(claimed.storage[targetKey],sourceBytes);assert.equal(claimed.storage[sourceKey],sourceBytes);
  assert.equal(claimed.storage[folderKey],folderBytes);assert.equal(claimed.storage[keys(res.account).record],recordBytes);
  assert.equal(claimed.storage[keys(res.account).projection],projectionBytes);
  const journal=JSON.parse(claimed.storage[journalKey]);assert.equal(journal.entries[0].phase,'LocalPublished');
  const r=journal.entries[0].receipt;assert.equal(r.record.homeDeviceId,'logical-device-b');assert.equal(r.record.homeRevision,3);
  assert.deepEqual(JSON.parse(claimed.storage[bKey(folderKey)]).records.find(x=>x.worldId===sourceId),m.payload.record);
  assert.equal(claimed.storage[bKey(keys(res.account).record)],undefined);assert.equal(claimed.storage[bKey(keys(res.account).projection)],undefined);
  await expectRefused('[data-action="open-world"][data-world-id="'+sourceId+'"]');
  await click('#world-migration-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const opened=await capture('12-device-b-same-id-formal-restored-runtime',res);
  assert.equal(opened.runtimeNode,sourceId);assert.equal(opened.restoreKind,'Restored');assert.equal(opened.capture.kind,'Complete');
  assert.equal(opened.frameDrivers,1);assert.equal(opened.inputCollectors,1);assert.equal(opened.coreView.data.capturedParts,'7');
  assert.equal(opened.coreView.data.formatTime,String(source.sections.FormatTime.epochMs));
  assert.equal(opened.storage[targetKey],sourceBytes);assert.equal(opened.storage[sourceKey],sourceBytes);
  await exitWorld();await click('#world-migration-recover');await delay(350);
  const reconciled=await read();assert.equal(JSON.parse(reconciled.storage['neurou-migration-v1:'+encodeURIComponent(res.account)]).entries[0].phase,'Claimed');
  await close();await open(res);await login(res.account,false);
  await click('#world-migration-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const reopened=await capture('13-client-rebuild-same-id-reopened',res);
  assert.equal(reopened.restoreKind,'Restored');assert.equal(reopened.storage[targetKey],sourceBytes);assert.equal(reopened.storage[sourceKey],sourceBytes);
  assert.equal(reopened.storage[keys(res.account).record],recordBytes);assert.equal(reopened.storage[keys(res.account).projection],projectionBytes);
  await exitWorld();
  await activeReplayPause(res,sourceId,sourceKey);
  res.migrationAcceptance={pass:true,mode:'ContractAdapter',prototype:'RestrictedMigrationCore',worldId:sourceId,migrationId:migration,
    sameWorldId:true,sevenSectionsExact:true,sourceCoreDirectoryUnchanged:true,accountFactsNotCopied:true,homeRevision:3,
    formatTimeRevisionForkOriginPreserved:true,allAccountNewAdmissionRejected:true,initiatingDeviceBindingSurvivesRebuild:true,
    serviceClockAdvancedMs:3600000,realElapsedHour:false,claimPhase:'LocalPublished',restoreKind:'Restored',captureKind:'Complete',
    actualDimensions:[width,height]};res.pass=true;await close();
}
app.whenReady().then(async()=>{
  try {
    report.compilation=await compilation();
    for(const [width,height] of [[1920,1080],[2560,1440]])await migrationResolution(width,height);
    assert.deepEqual(report.rendererErrors,[]);assert.deepEqual(report.runtimeErrors,[]);
    report.externalRequests=report.requests.filter(r=>{try{const u=new URL(r.url);return ['http:','https:','ws:','wss:'].includes(u.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)}catch{return false}});
    assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await compilation(),report.compilation);
    report.pass=true;
  } catch(error) {report.pass=false;report.failure={message:String(error),stack:error.stack};try{report.lastState=await read()}catch{} console.error(error.stack||error);}
  finally {
    try{await close()}catch{}
    report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'creator-preview-results.json'),JSON.stringify(report,null,2));
    app.exit(report.pass?0:1);
  }
});
