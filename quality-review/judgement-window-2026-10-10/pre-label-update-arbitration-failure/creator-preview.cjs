// User-approved judgement window follow-up: real Creator preview, natural T6/T7, actual DOM input.
// Reads product state for assertions; no fabricated screenshots, scores or media clocks.
// No endpoint, judgement, ledger, or clock state is written; exact boundaries are covered by the separate pure-logic suite.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const output = __dirname;
const project = path.resolve(output, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

  const { app, BrowserWindow } = require('electron');
  const os = require('os');
  const url = process.env.NEUROU_PREVIEW_URL || 'http://localhost:7457/';
  const targets = [
    ['constants/index.ts', 'constants/index.ts'],
    ['ChartScore.ts', 'src/chart/ChartScore.ts'],
    ['RhythmStrike.ts', 'src/trace/RhythmStrike.ts'],
    ['PuzzleChain.ts', 'src/trace/PuzzleChain.ts'],
    ['SceneBuilder.ts', 'assets/scripts/SceneBuilder.ts'],
    ['WorldFolderBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts'],
    ['GuidanceEditorBuilder.ts', 'assets/scripts/GuidanceEditorBuilder.ts'],
    ['AccountStartupSession.ts', 'src/director/AccountStartupSession.ts'],
    ['IntentPort.ts', 'src/director/IntentPort.ts'],
    ['FolderStartupView.ts', 'src/presentation/FolderStartupView.ts'],
    ['FolderCatalog.ts', 'src/presentation/FolderCatalog.ts'],
    ['FolderTheme.ts', 'src/presentation/FolderTheme.ts'],
    ['WorldFolderView.ts', 'src/presentation/WorldFolderView.ts'],
    ['EditorFolderView.ts', 'src/presentation/EditorFolderView.ts'],
    ['GuidanceEditorView.ts', 'src/presentation/GuidanceEditorView.ts'],
    ['GuidanceEditorSession.ts', 'src/editor/GuidanceEditorSession.ts'],
    ['GuidanceChart.ts', 'src/chart/GuidanceChart.ts'],
    ['GuidanceLineRuntime.ts', 'src/chart/GuidanceLineRuntime.ts'],
    ['GuidanceChartRuntime.ts', 'src/chart/GuidanceChartRuntime.ts'],
    ['ChartPremiere.ts', 'src/chart/ChartPremiere.ts'],
    ['InputCollector.ts', 'src/presentation/InputCollector.ts'],
    ['FrameDriver.ts', 'src/presentation/FrameDriver.ts'],
    ['AudioOutputClock.ts', 'src/presentation/AudioOutputClock.ts'],
  ];
  for (const [key, value] of [
    ['autoplay-policy', 'no-user-gesture-required'], ['force-device-scale-factor', '1'],
    ['disable-background-timer-throttling'], ['disable-renderer-backgrounding'], ['disable-backgrounding-occluded-windows'],
  ]) app.commandLine.appendSwitch(key, value);
  app.setPath('userData', path.join(os.tmpdir(), 'neurou-judgement-window-evidence-' + Date.now()));
  app.on('window-all-closed', () => {});
  const report = { creator: '3.8.8', url, fixturePolicy: 'Fresh world with natural T6, DOM movement, real output-clock +75ms rhythm beats, real C multi-line player inputs, actual media completion. Forwarding method wrappers count calls without changing arguments/results. No endpoint/judgement/ledger/clock fixture.', resolutions: [], rendererErrors: [], runtimeErrors: [] };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let win;
  async function evaluate(fn, ...args) {
    return win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(a => JSON.stringify(a)).join(',') + ')', true);
  }
  async function until(fn, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await evaluate(fn);
      if (result) return result;
      await wait(25);
    }
    throw new Error('Timeout: ' + fn.toString());
  }
  async function compilation() {
    const response = await fetch(new URL('scripting/x/import-map.json', url), { cache: 'no-store' });
    assert.ok(response.ok, 'Creator import map unavailable');
    const map = await response.json();
    const entries = await Promise.all(targets.map(async ([name, source]) => {
      const id = Object.keys(map.imports).find(k => k.endsWith('/' + name));
      assert.ok(id, 'Creator missing final module ' + name);
      const chunk = map.imports[id];
      const chunkUrl = new URL(chunk, new URL('scripting/x/', url)).href;
      const response = await fetch(chunkUrl, { cache: 'no-store' });
      assert.ok(response.ok, 'Creator chunk unavailable ' + name);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(sha(bytes), sha(fs.readFileSync(path.join(project, 'temp/programming/packer-driver/targets/preview', chunk))), 'served/disk mismatch ' + name);
      const sourceMap = await (await fetch(chunkUrl + '.map', { cache: 'no-store' })).json();
      const sourceText = fs.readFileSync(path.join(project, source), 'utf8');
      assert.ok(sourceMap.sourcesContent.includes(sourceText), 'Creator source map is stale: ' + name);
      return { name, source, chunk, sourceSha256: sha(sourceText), chunkSha256: sha(bytes), servedEqualsCompilerOutput: true, sourceMapMatchesFinalSource: true };
    }));
    const expected = JSON.parse(fs.readFileSync(path.join(project, 'assets/resources/chart/guidance_c.json'), 'utf8'));
    return { creator: '3.8.8', entries, expectedInitialChart: expected };
  }
  async function setup() {
    const cc = await System.import('cc');
    function all(node, name) { if (!node) return []; return [...node.getComponents(name), ...node.children.flatMap(child => all(child, name))]; }
    const shell = all(cc.director.getScene(), 'WorldFolderBuilder')[0];
    if (!shell?.startup) return false;
    cc.profiler.hideStats();
    window.__folderEvidence = { cc, shell, all, errors: [], world: null, editor: null };
    window.addEventListener('error', e => window.__folderEvidence.errors.push(String(e.error?.stack || e.message)));
    window.addEventListener('unhandledrejection', e => window.__folderEvidence.errors.push(String(e.reason?.stack || e.reason)));
    return true;
  }
  async function ready() {
    await until(() => typeof System !== 'undefined' && !!document.getElementById('GameCanvas'));
    await until(setup);
    await until(() => !!document.getElementById('folder-login-form'));
  }
  async function click(selector) {
    await evaluate(selector => { const target = document.querySelector(selector); if (!target) throw new Error('Missing DOM control: ' + selector); target.click(); }, selector);
    await wait(60);
  }
  async function login(accountId) {
    await evaluate(accountId => {
      const input = document.getElementById('folder-account');
      input.value = accountId; input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('folder-login').click();
    }, accountId);
    await wait(80);
  }
  async function reload() {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', resolve);
      win.webContents.once('did-fail-load', (event, code, message) => reject(new Error('Reload failed: ' + message)));
      win.reload();
    });
    await ready();
  }
  async function read() {
    return evaluate(() => {
      const e = window.__folderEvidence, cc = e.cc, scene = cc.director.getScene();
      const worlds = e.all(scene, 'SceneBuilder').filter(b => !!b.graph);
      const canvas = document.getElementById('GameCanvas');
      const controls = [...document.querySelectorAll('#editor-directory [data-entry-id]')].map(el => ({ id: el.dataset.entryId, title: el.tagName === 'SUMMARY' ? el.childNodes[0]?.textContent : el.querySelector('span')?.textContent || el.textContent, tag: el.tagName }));
      const media = [...document.querySelectorAll('video')].map(v => ({ id: v.id, paused: v.paused, ended: v.ended, timeMs: v.currentTime * 1000, src: v.currentSrc, connected: v.isConnected }));
      const world = worlds[0];
      const view = e.all(scene, 'GuidanceEditorView')[0];
      const editor = e.all(scene, 'GuidanceEditorBuilder')[0];
      const p = world?.chartPremiere;
      return {
        startup: e.shell.startup.getStartupSnapshot(),
        mode: document.getElementById('world-folder') ? 'WorldFolder' : document.getElementById('editor-folder') ? 'EditorFolder' : document.getElementById('guidance-editor') ? 'GuidanceEditor' : worlds.length ? 'InitialWorld' : document.getElementById('folder-complete-prologue') ? 'Prologue' : 'Login',
        worldCount: worlds.length, frameDrivers: e.all(scene, 'FrameDriver').length, inputCollectors: e.all(scene, 'InputCollector').length,
        editorBuilders: e.all(scene, 'GuidanceEditorBuilder').length,
        cameras: e.all(scene, 'Camera').map(c => ({ node: c.node.name, active: c.node.activeInHierarchy, enabled: c.enabled, clearFlags: c.clearFlags })),
        world: world ? { position: world.graph.protagonist.getPosition(), ledger: world.graph.session.getLedgerEvents(), puzzle: world.puzzleProgress?.getStage(), entered: world.chartEntered, active: world.worldRootNode?.active, chartId: p?.getChartId(), chartState: p?.getState(), timeMs: p?.getCurrentTimeMs(), result: p?.getResult(), lines: p?.getGuidanceSnapshots(), counts: p ? { perfect: p.getPerfectCount(), good: p.getGoodCount(), miss: p.getMissCount() } : null } : null,
        editor: editor ? { document: editor.session?.getDocument(), state: editor.session?.getPreview()?.getState(), timeMs: editor.session?.getPreview()?.getCurrentTimeMs(), result: editor.session?.getPreview()?.getResult(), colorCount: view?.effect?.nodeColors?.size || 0 } : null,
        entries: controls, details: [...document.querySelectorAll('#editor-directory details')].map(d => ({ label: d.querySelector('summary')?.textContent, open: d.open })),
        status: document.querySelector('#folder-status')?.textContent || document.querySelector('#folder-startup [role=status]')?.textContent || '',
        worldLabels: [...document.querySelectorAll('#folder-worlds [data-world-id]')].map(b => ({ id: b.dataset.worldId, title: b.querySelector('.folder-title')?.textContent })),
        runtimeNode: e.shell.runtimeNode?.name || null, media,
        dimensions: { inner: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height], css: [canvas.clientWidth, canvas.clientHeight], dpr: devicePixelRatio },
        horizontalOverflow: [...document.querySelectorAll('#folder-startup, #world-folder, #editor-folder')].some(el => el.scrollWidth > el.clientWidth + 1),
        errors: [...e.errors],
      };
    });
  }
  async function capture(name, res) {
    const snapshot = await read();
    const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const png = Buffer.from(shot.data, 'base64'), file = res.resolution + '-' + name + '.png';
    fs.writeFileSync(path.join(output, file), png);
    const imageSize = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    assert.deepEqual([imageSize.width, imageSize.height], snapshot.dimensions.inner);
    assert.equal(snapshot.horizontalOverflow, false);
    res.evidence.push({ name, file, imageSize, snapshot });
    console.log(res.resolution + ' ' + name + ' ' + JSON.stringify({ mode: snapshot.mode, phase: snapshot.startup.phase, ledger: snapshot.world?.ledger.length, chartState: snapshot.world?.chartState }));
    return snapshot;
  }
  async function fingerprint(selector) {
    return evaluate(selector => {
      const root = document.querySelector(selector), props = ['fontFamily', 'fontSize', 'lineHeight', 'color', 'backgroundColor', 'borderTopColor', 'paddingTop', 'paddingLeft'];
      return [...root.querySelectorAll('h1, h2, button, [data-entry-id]')].map(el => ({ text: el.textContent.trim(), tag: el.tagName, style: Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])) }));
    }, selector);
  }
  async function noRuntime() {
    const snapshot = await read();
    assert.equal(snapshot.worldCount, 0); assert.equal(snapshot.frameDrivers, 0); assert.equal(snapshot.inputCollectors, 0); assert.equal(snapshot.editorBuilders, 0); assert.equal(snapshot.runtimeNode, null);
    assert.ok(snapshot.media.every(v => v.paused), 'retired media is playing');
    assert.ok(!snapshot.cameras.some(c => /CameraRig|Camera3D|DeepTraceInvert/.test(c.node)), 'retired camera remains');
    return snapshot;
  }
  async function installWorld(tapPlan) {
    return evaluate(async tapPlan => {
      const e = window.__folderEvidence;
      const builder = e.all(e.cc.director.getScene(), 'SceneBuilder').find(b => !!b.graph);
      const input = e.all(e.cc.director.getScene(), 'InputCollector')[0];
      if (!builder?.chartPremiere || !builder.videoPlayer || !builder.chartPadView?.headLogo || !input || !builder.bgmClipLoaded) return false;
      const chartModule = await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/GuidanceChart.ts');
      const layoutModule = await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/KeyboardPadLayout.ts');
      const r = { builder, input, tapPlan, taps: [], autoHead: false, autoNodes: false, headIds: new Set(), nodeIds: new Set(), heldKeys: new Set(), inputEvents: [], sync: [], frameCalls: 0, timers: [], video: null };
      e.world = r;
      const session = builder.graph.session, originalSubmit = session.submitFrameIntents.bind(session);
      session.submitFrameIntents = (...args) => { r.frameCalls++; return originalSubmit(...args); };
      r.edge = (code, down) => {
        const edge = { code, phase: down ? 'Down' : 'Up', mediaTimeMs: builder.readVideoTimeMs(), bgmTimeMs: builder.audioOutputClock.readBgmTimeMs() }; r.inputEvents.push(edge);
        document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, repeat: false, bubbles: true, cancelable: true })); return edge;
      };
      r.press = code => { const edge = r.edge(code, true); r.edge(code, false); return edge; };
      r.target = (i, n) => builder.chartPremiere.getGuidanceSnapshots()[i].startedAtMs + n.pathDistance / builder.chartData.lines[i].speed * 1000;
      function videoFrame(now, metadata) {
        const clockMs = builder.audioOutputClock.readChartTimeMs();
        if (builder.chartEntered && builder.chartPremiere.getState() === 'Playing' && clockMs >= 0) r.sync.push({ clockMs, presentedMediaMs: metadata.mediaTime * 1000, rawPresentedErrorMs: clockMs - metadata.mediaTime * 1000 });
        if (e.cc.isValid(builder, true) && r.video) r.frameHandle = r.video.requestVideoFrameCallback(videoFrame);
      }
      r.timer = setInterval(() => {
        if (!e.cc.isValid(builder, true)) return;
        const video = builder.videoPlayer.nativeVideo;
        if (video && !r.video) { r.video = video; r.frameHandle = video.requestVideoFrameCallback(videoFrame); }
        const p = builder.chartPremiere, now = builder.readVideoTimeMs();
        if (p.getState() !== 'Playing' || now < 0) return;
        const snapshots = p.getGuidanceSnapshots();
        if (r.autoHead) { const line = snapshots.find(l => l.state === 'Waiting' && !r.headIds.has(l.id)); if (line) { r.headIds.add(line.id); r.press('Space'); } }
        if (!r.autoNodes) return;
        const desired = new Set();
        snapshots.forEach((line, i) => {
          if (line.startedAtMs === null) return;
          for (const item of line.nodes) {
            const n = item.node, target = r.target(i, n);
            if (n.kind === 'Drag' || n.kind === 'Hold') {
              const end = n.kind === 'Hold' ? line.startedAtMs + n.endPathDistance / builder.chartData.lines[i].speed * 1000 + 70 : target + 100;
              if (now >= target - 100 && now < end) desired.add(n.keyId);
            }
          }
        });
        for (const key of desired) if (!r.heldKeys.has(key)) { r.heldKeys.add(key); r.edge(key, true); }
        for (const key of [...r.heldKeys]) if (!desired.has(key)) { r.heldKeys.delete(key); r.edge(key, false); }
        snapshots.forEach((line, i) => {
          if (line.startedAtMs === null) return;
          for (const item of line.nodes) {
            const n = item.node; if (n.kind !== 'Tap' || r.nodeIds.has(n.id)) continue;
            const delay = r.tapPlan[n.id] ?? (n.id.endsWith('-conflict') && i === 1 ? 75 : -8);
            if (item.tier !== null && delay <= 200) continue;
            if (now >= r.target(i, n) + delay) {
              const position = chartModule.positionAtPathDistance(builder.chartData.lines[i].path, builder.chartData.aspectRatio, builder.chartData.lines[i].speed * (now - line.startedAtMs) / 1000);
              const key = layoutModule.resolveGridKeyAt(builder.keyboardLayout, position);
              if (key === null) throw new Error('No grid key for Tap ' + n.id);
              r.nodeIds.add(n.id); const edge = r.press(key); r.taps.push({ nodeId: n.id, lineId: line.id, key, intendedDeltaMs: delay, targetTimeMs: r.target(i, n), actualInputTimeMs: edge.mediaTimeMs, actualDeltaMs: edge.mediaTimeMs - r.target(i, n), tierBeforeInput: item.tier });
            }
          }
        });
      }, 5);
      r.timers.push(r.timer);
      const constants = await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/constants/index.ts');
      return { chartId: builder.chartPremiere.getChartId(), chart: builder.chartData, initialEndpoint: builder.graph.session.endpointSettled, initialLedger: builder.graph.session.getLedgerEvents().length, constants: Object.fromEntries(['RHYTHM_STRIKE_WINDOW_MS','PERFECT_WINDOW_MS','GOOD_WINDOW_MS','SYNC_TOLERANCE_MS','HEAD_WINDOW_MS'].map(k => [k,constants[k]])) };
    }, tapPlan);
  }
  async function worldReady(tapPlan) {
    const start = Date.now();
    while (Date.now() - start < 20000) {
      const result = await installWorld(tapPlan);
      if (result) return result;
      await wait(50);
    }
    throw new Error('World resources/components did not become ready');
  }
  async function stopWorldAutomation() {
    await evaluate(() => { const r = window.__folderEvidence.world; if (!r) return; r.timers.forEach(clearInterval); if (r.video && r.frameHandle) r.video.cancelVideoFrameCallback(r.frameHandle); });
  }
  async function retireWorld(res, name) {
    await stopWorldAutomation();
    await evaluate(() => { const e = window.__folderEvidence, r = e.world; e.retiredWorld = { r, session: r.builder.graph.session, protagonist: r.builder.graph.protagonist, video: r.video }; });
    await click('#folder-runtime-exit');
    await until(() => !!document.getElementById('world-folder'));
    const first = await evaluate(() => { const e = window.__folderEvidence, old = e.retiredWorld; return { frameCalls: old.r.frameCalls, position: old.protagonist.getPosition(), ledger: old.session.getLedgerEvents(), builderValid: e.cc.isValid(old.r.builder, true), videoPaused: old.video?.paused ?? true, videoConnected: old.video?.isConnected ?? false }; });
    await evaluate(() => { const target = document.getElementById('GameCanvas'); target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true })); });
    await wait(200);
    await evaluate(() => document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true })));
    const after = await evaluate(() => { const e = window.__folderEvidence, old = e.retiredWorld; return { frameCalls: old.r.frameCalls, position: old.protagonist.getPosition(), ledger: old.session.getLedgerEvents(), builderValid: e.cc.isValid(old.r.builder, true), videoPaused: old.video?.paused ?? true, videoConnected: old.video?.isConnected ?? false }; });
    assert.deepEqual(after, first); assert.equal(after.builderValid, false); assert.equal(after.videoPaused, true); assert.equal(after.videoConnected, false);
    await noRuntime();
    res.lifecycleWorld = [...(res.lifecycleWorld || []), { name, pass: true, retired: after }];
    await capture(name, res);
  }
  async function fullWorldChain(res, label, tapPlan, intentionalMiss = false) {
    await click('#open-initial-world');
    const ready = await worldReady(tapPlan); assert.equal(ready.chartId, 'guidance-c-1'); assert.equal(ready.initialEndpoint, false); assert.equal(ready.initialLedger, 0);
    assert.deepEqual(ready.constants, { RHYTHM_STRIKE_WINDOW_MS:100, PERFECT_WINDOW_MS:100, GOOD_WINDOW_MS:200, SYNC_TOLERANCE_MS:30, HEAD_WINDOW_MS:1000 });
    assert.deepEqual(ready.chart, report.compilation.expectedInitialChart, 'InitialWorld did not load the final C resource');
    res.loadedChart = ready.chart; res.runtimeConstants = ready.constants;
    const initial = await capture(label + '-01-initial-world', res); assert.equal(initial.frameDrivers, 1); assert.equal(initial.inputCollectors, 1); assert.equal(initial.world.puzzle, 'Step1');
    await evaluate(() => { const r = window.__folderEvidence.world; r.autoHead = true; r.autoNodes = true; r.press('Tab'); r.edge('KeyA', true); });
    await until(() => window.__folderEvidence.world.builder.graph.protagonist.getPosition().lateral <= -5.9, 10000);
    await evaluate(() => window.__folderEvidence.world.edge('KeyA', false));
    await until(() => window.__folderEvidence.world.builder.puzzleProgress.getStage() === 'AwaitingStrike');
    await capture(label + '-02-deep-trace-approach', res);
    await evaluate(() => {
      const r = window.__folderEvidence.world; r.beats = []; r.puzzleSamples = []; let nextBeat = null, lastSample = -1;
      const timer = setInterval(() => {
        const b = r.builder, time = b.audioOutputClock.readBgmTimeMs();
        if (time < 0 || b.chartEntered || b.puzzleProgress.getStage() === 'Completed') return;
        if (time - lastSample > 150) { lastSample = time; r.puzzleSamples.push({ timeMs: time, stage: b.puzzleProgress.getStage(), sustainedMs: b.puzzleChain.getSustainedElapsedMs(), ledger: b.graph.session.getLedgerEvents().length }); }
        if (b.puzzleProgress.getStage() === 'AwaitingStrike') {
          if (nextBeat === null) nextBeat = Math.ceil(time / 1000) * 1000;
          if (time >= nextBeat + 75) { const edge = r.press('Digit1'); r.beats.push({ targetBeatMs: nextBeat, outputClockMs: edge.bgmTimeMs, deviationMs: edge.bgmTimeMs - nextBeat, intendedDeltaMs: 75 }); nextBeat += 1000; }
        }
      }, 4); r.timers.push(timer);
    });
    await until(() => window.__folderEvidence.world.builder.chartEntered, 25000);
    const entry = await capture(label + '-03-natural-T6-T7-entry', res); assert.equal(entry.world.ledger.length, 1);
    const puzzleCompletion = await evaluate(() => { const b = window.__folderEvidence.world.builder; return { stage:b.puzzleProgress.getStage(), sustainedMs:b.puzzleChain.getSustainedElapsedMs(), endpoint:b.graph.session.endpointSettled, ledger:b.graph.session.getLedgerEvents() }; });
    assert.equal(puzzleCompletion.stage, 'Completed'); assert.ok(puzzleCompletion.sustainedMs >= 7000); assert.equal(puzzleCompletion.endpoint, true);
    await until(() => window.__folderEvidence.world.builder.chartPremiere.getGuidanceSnapshots().every(l => l.startedAtMs !== null), 8000);
    await until(() => window.__folderEvidence.world.builder.chartPremiere.getCurrentTimeMs() > 4200, 8000);
    await capture(label + '-04-C-multiline-performance', res);
    await until(() => !window.__folderEvidence.world.builder.chartEntered && window.__folderEvidence.world.builder.chartPremiere.getResult()?.completed, 20000);
    const complete = await capture(label + '-05-T7-completed-world', res);
    assert.equal(complete.world.ledger.length, 2); assert.equal(complete.world.active, true); assert.equal(complete.world.counts.miss, intentionalMiss ? 1 : 0); assert.equal(complete.world.result.completed, true);
    const inputs = await evaluate(() => { const r = window.__folderEvidence.world, p = r.builder.chartPremiere; return { beats:r.beats, puzzleSamples:r.puzzleSamples, inputs:r.inputEvents, sync:r.sync, taps:r.taps.map(t => { const line = p.getGuidanceSnapshots().find(l => l.id === t.lineId), node = line.nodes.find(n => n.node.id === t.nodeId); return { ...t, tier:node.tier, resolvedAtMs:node.resolvedAtMs, resolvedDeltaMs:node.resolvedAtMs - t.targetTimeMs }; }) }; });
    res.attemptMeasurements = { label, puzzleCompletion, ...inputs };
    assert.ok(inputs.beats.length >= 7); assert.ok(inputs.beats.every(b => b.deviationMs > 50 && b.deviationMs <= 100), 'T6 real beat must be outside former 50ms but within new 100ms');
    assert.ok(inputs.puzzleSamples.every(p => p.ledger === 0), 'T6 may not write a ledger before completion');
    assert.equal(inputs.taps.length, 6);
    for (const tap of inputs.taps) {
      assert.ok(Math.abs(tap.actualDeltaMs - tap.intendedDeltaMs) <= 20, 'Tap scheduling drift: ' + tap.nodeId);
      const expected = Math.abs(tap.actualDeltaMs) <= 100 ? 'Perfect' : Math.abs(tap.actualDeltaMs) <= 200 ? 'Good' : 'Miss';
      assert.equal(tap.tier, expected, 'Actual real Tap offset tier: ' + tap.nodeId);
      if (expected === 'Miss') { assert.equal(tap.tierBeforeInput, 'Miss'); assert.ok(tap.actualDeltaMs > 200); }
    }
    assert.ok(inputs.sync.length > 20);
    const maxRawPresentedErrorMs = Math.max(...inputs.sync.map(s => Math.abs(s.rawPresentedErrorMs))); assert.ok(maxRawPresentedErrorMs <= 30, 'real native video sync exceeded 30ms');
    const chain = { pass:true, fixture:'None: fresh world; natural T6 +75ms output-clock beats; actual C player inputs and native media completion.', tapPlan, puzzleCompletion, ...inputs, syncSummary:{sampleCount:inputs.sync.length,maxRawPresentedErrorMs}, completed:complete.world.result, counts:complete.world.counts, ledger:complete.world.ledger };
    if (intentionalMiss) res.intentionalMissTrial = chain; else res.fullChain = chain;
    await retireWorld(res, label + '-06-return-world-folder');
  }
  async function startup(res) {
    await login('window-evidence-' + res.resolution); await until(() => !!document.getElementById('folder-complete-prologue'));
    await click('#folder-complete-prologue'); await until(() => !!document.getElementById('world-folder'));
    const folder = await capture('00-world-folder', res); assert.deepEqual(folder.worldLabels, [{ id:'InitialWorld',title:'初始世界' }]); await noRuntime();
    res.worldFolderFingerprint = await fingerprint('#world-folder');
  }
  async function resolution(width, height) {
    const res = { resolution: width + 'x' + height, evidence: [], checks: [] }; report.resolutions.push(res);
    win = new BrowserWindow({ width, height, show: false, frame: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, partition: 'persist:judgement-window-' + width + '-' + Date.now() } });
    win.webContents.on('console-message', event => { if (event.level === 3 || event.level === 'error') report.rendererErrors.push({ resolution: res.resolution, message: event.message }); });
    await win.loadURL(url); win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await ready();
    const dimensions = (await read()).dimensions; assert.deepEqual(dimensions.inner, [width, height]); assert.deepEqual(dimensions.canvas, [width, height]); assert.deepEqual(dimensions.css, [width, height]); assert.equal(dimensions.dpr, 1);
    await startup(res);
    await fullWorldChain(res, 'normal', { 'tap-c-a-corner':-175, 'tap-c-b-corner':85, 'tap-c-a-end':-85, 'tap-c-b-end':175 });
    await fullWorldChain(res, 'miss', { 'tap-c-a-corner':-175, 'tap-c-b-corner':85, 'tap-c-a-end':-85, 'tap-c-b-end':215 }, true);
    report.runtimeErrors.push(...(await read()).errors.map(message => ({ resolution: res.resolution, message })));
    res.checks = ['final Creator compilation/source maps and runtime constants 100/100/200/30/1000', 'natural T6 seven-second sustain with actual +75ms beats beyond former 50ms', 'C two-line real Tap early/late Perfect and Good beyond former windows', 'actual native media completion writes exactly two ledger records', 'independent +215ms intentional Miss cannot be repaired by late input', 'world exit removes frame/input/media and returns folder', 'AC-19 raw output-clock versus native presented video frame sync <=30ms'].map(name=>({name,pass:true}));
    res.pass = true; win.destroy(); win = null;
  }
  app.whenReady().then(async () => {
    try {
      report.compilation = await compilation();
      await resolution(1920, 1080); await resolution(2560, 1440);
      assert.deepEqual(report.resolutions[0].worldFolderFingerprint, report.resolutions[1].worldFolderFingerprint);
      assert.deepEqual(report.rendererErrors, []); assert.deepEqual(report.runtimeErrors, []);
      assert.deepEqual((await compilation()).entries, report.compilation.entries, 'source or served compilation changed during evidence');
      report.compilation.unchangedThroughEvidenceCapture = true;
      report.resolutionComparison = { pass: true, identicalWorldFolderContentAndStyles: true, actualViewportCanvasAndPngDimensions: report.resolutions.map(r => r.resolution), normalGameplayBothMissZero: true, intentionalTrialBothExactlyOneMiss: true };
      report.pass = true;
    } catch (error) {
      report.pass = false; report.failure = { message: error.message, stack: error.stack };
      try { if (win) report.failure.snapshot = await read(); } catch (captureError) { report.failure.snapshotError = String(captureError); }
      console.error(error);
    } finally {
      fs.writeFileSync(path.join(output, 'creator-preview-results.json'), JSON.stringify(report, null, 2));
      if (report.compilation) fs.writeFileSync(path.join(output, 'creator-compilation.json'), JSON.stringify(report.compilation, null, 2));
      if (win) win.destroy(); app.exit(report.pass ? 0 : 1);
    }
  });
