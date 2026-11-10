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
  scope: 'B2.4c WorldFork complete state inheritance, persistent provenance, directory transaction and independent worlds', previewUrl: url,
  profile: path.join(os.tmpdir(), 'neurou-b24c-evidence-' + runId), harnessSha256: sha(fs.readFileSync(__filename)),
  policy: 'Actual Creator preview, fresh isolated profile per resolution. Product login/prologue/choice/native World audio/local fork/export/import/open/recover controls only. Source A naturally creates a non-Initial UUID. Two logical devices share an in-memory ContractAdapter in one realm; B world storage is persistently namespaced, account facts are a shared trusted read port outside the payload. Read-only component/DOM/storage observations, original media/time and direct CDP PNG. No gameplay/storage injection, no physical-device authentication, no full FileCarry or external service claim.',
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
  console.log('B2.4c ' + res.resolution + ' ' + name + ' ' + JSON.stringify({ ledger: state.ledger?.length, puzzle: state.legacy?.puzzle, restored: state.restoredCore, revision: state.coreSnapshot?.revision })); return state;
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
async function transferResolution(width, height) {
  const res = {width,height,resolution:width+'x'+height,account:'b24c-production-'+width+'-'+runId,
    partition:'persist:b24c-'+width+'-'+runId,screenshots:[]}; report.resolutions.push(res);
  await worldClear(res); await exitWorld();
  await click('[data-action="fork-world"][data-world-id="InitialWorld"]');
  const sourceId = await until(()=> {
    const select=document.querySelector('#cross-device-source'); return select?.options.length ? select.value : false;
  });
  assert.match(sourceId,/^world-[0-9a-f-]{36}$/);
  const sourceKey='neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(sourceId);
  const before = await read(), sourceBytes=before.storage[sourceKey], source=JSON.parse(sourceBytes);
  const recordBytes=before.storage[keys(res.account).record], projectionBytes=before.storage[keys(res.account).projection];
  await click('#cross-device-export');
  await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('A 已发送'));
  await capture('07-device-a-published-restricted-core',res);
  await click('#cross-device-import');
  const target = await until(()=> {
    const panel=document.querySelector('#cross-device-prototype');
    if(panel?.dataset.error)throw Error(panel.dataset.error);
    return panel?.dataset.receipt==='Published' ? panel.dataset.targetWorldId : false;
  });
  assert.notEqual(target,sourceId);
  const listed=await capture('08-device-b-published-seven-section-copy',res);
  const targetKey=bKey('neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(target));
  const staged=JSON.parse(listed.storage[targetKey]);
  assert.equal(staged.worldId,target);assert.equal(staged.accountId,res.account);assert.equal(staged.revision,0);
  assert.equal(staged.forkOrigin.sourceWorldId,sourceId);assert.match(staged.forkOrigin.transactionId,/^import-/);
  assert.deepEqual(staged.sections.FormatTime,source.sections.FormatTime);
  assert.equal(listed.storage[sourceKey],sourceBytes);
  assert.equal(listed.storage[keys(res.account).record],recordBytes);assert.equal(listed.storage[keys(res.account).projection],projectionBytes);
  const names=['Ledger','PuzzleProgress','FormatTime','RecallCount','WorldLink','ChartSnapshot','ChartScore'];
  assert.deepEqual(Object.keys(staged.sections),names);
  for(const name of names){
    if(name==='FormatTime')continue;
    if(name==='PuzzleProgress'){assert.ok(staged.sections[name].every(p=>p.worldId===target&&p.accountId===res.account));continue;}
    assert.equal(staged.sections[name].worldId,target);assert.equal(staged.sections[name].accountId,res.account);
  }
  assert.equal(staged.sections.Ledger.control.entry.entryId,JSON.stringify([res.account,target,source.sections.Ledger.protagonistCharacterId,'SphereCrossing']));
  assert.deepEqual(ledgerOf(staged),ledgerOf(source));
  assert.deepEqual(staged.sections.ChartSnapshot.records,source.sections.ChartSnapshot.records);
  assert.deepEqual(staged.sections.ChartScore.records,source.sections.ChartScore.records);
  const journalKey=bKey('neurou-cross-device-import-v1:'+encodeURIComponent(res.account));
  const journal=JSON.parse(listed.storage[journalKey]);assert.equal(journal.entries[0].phase,'Published');
  assert.equal(journal.entries[0].homeReply.record.homeDeviceId,'logical-device-b');
  assert.equal(listed.storage[bKey(keys(res.account).record)],undefined);assert.equal(listed.storage[bKey(keys(res.account).projection)],undefined);
  await click('#cross-device-open');
  await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const opened=await capture('09-device-b-restored-inherited-formal-runtime',res);
  assert.equal(opened.runtimeNode,target);assert.equal(opened.restoreKind,'Restored');assert.equal(opened.capture.kind,'Complete');
  assert.equal(opened.world.completionStatus,'Inherited');assert.equal(opened.world.record,null);
  assert.equal(opened.coreView.data.capturedParts,'7');assert.equal(opened.coreView.data.formatTime,String(source.sections.FormatTime.epochMs));
  assert.equal(opened.storage[sourceKey],sourceBytes);assert.equal(opened.storage[targetKey],listed.storage[targetKey]);
  assert.equal(opened.frameDrivers,1);assert.equal(opened.inputCollectors,1);
  assert.equal(await ev(()=>document.querySelector('#enter-world-boss-chart').hidden),true);
  await exitWorld();
  await click('#cross-device-recover');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('B 对账结果：Published'));
  await click('#cross-device-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const reopened=await capture('10-device-b-reconciled-and-reopened',res);
  assert.equal(reopened.restoreKind,'Restored');assert.equal(reopened.storage[targetKey],listed.storage[targetKey]);
  assert.equal(reopened.storage[sourceKey],sourceBytes);assert.equal(reopened.storage[keys(res.account).record],recordBytes);
  assert.equal(reopened.storage[keys(res.account).projection],projectionBytes);
  await exitWorld(); const ended=await read();assert.equal(ended.frameDrivers,0);assert.equal(ended.inputCollectors,0);
  res.transferAcceptance={pass:true,mode:'ContractAdapter',prototype:'RestrictedCoreTransfer',sourceWorldId:sourceId,targetWorldId:target,
    newUuid:true,sections:names,formatTimePreserved:true,completionStatus:'Inherited',restoreKind:'Restored',captureKind:'Complete',
    sourceBytesUnchanged:true,accountFactsNotCopied:true,accountFactBytesUnchanged:true,receiptPhase:'Published',
    homeDevice:'logical-device-b',receiptReconciled:true,ownWorldStores:true,sharedAuthority:true,
    actualDimensions:[width,height],naturalSourceCreatedByLocalFork:true};res.pass=true;await close();
}
app.whenReady().then(async()=>{
  try {
    report.compilation=await compilation();
    for(const [width,height] of [[1920,1080],[2560,1440]])await transferResolution(width,height);
    assert.deepEqual(report.rendererErrors,[]);assert.deepEqual(report.runtimeErrors,[]);
    report.externalRequests=report.requests.filter(r=>{try{const u=new URL(r.url);return ['http:','https:','ws:','wss:'].includes(u.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)}catch{return false}});
    assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await compilation(),report.compilation);
    report.resolutionComparison={sameSevenSections:true,sameInherited:true,sameCompleteRestored:true,sameSourceAndAccountPreservation:true,
      actualDimensions:['1920x1080','2560x1440']};report.compilationUnchanged=true;report.pass=true;
  } catch(error) {
    report.pass=false;report.error=error.stack;console.error(error.stack);
    try{if(win){report.failureSnapshot=await read();const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
      const file=(current?.resolution??'unknown')+'-diagnostic-failure.png';fs.writeFileSync(path.join(__dirname,file),Buffer.from(shot.data,'base64'));report.failureScreenshot=file;}}catch{}
  } finally {
    fs.writeFileSync(path.join(__dirname,'creator-preview-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({pass:report.pass,resolutions:report.resolutions.length,error:report.error}));if(win)win.destroy();app.exit(report.pass?0:1);
  }
});
