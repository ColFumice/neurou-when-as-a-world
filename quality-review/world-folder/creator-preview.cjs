// Batch 30: real Cocos Creator 3.8.8 browser preview, DOM navigation and keyboard input.
// Reads product state for assertions; no fabricated screenshots, scores or media clocks.
// Optional boundary fixtures are explicitly identified in the generated report.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const output = __dirname;
const project = path.resolve(output, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Reuse the accepted current A/B/C/editor tests in memory. Their virtual filename
// keeps relative root imports correct while every new result stays in this batch.
const coreSources = {
  b: 'quality-review/guidance-editor/b-regression.cjs',
  c: 'quality-review/guidance-editor/c-regression.cjs',
  pad: 'quality-review/guidance-editor/pad-regression.cjs',
  editor: 'quality-review/guidance-editor/acceptance.cjs',
};
if (process.argv.includes('--core-one')) {
  const name = process.argv[process.argv.indexOf('--core-one') + 1];
  assert.ok(coreSources[name], 'unknown core regression');
  let source = fs.readFileSync(path.join(project, coreSources[name]), 'utf8');
  if (name === 'editor') source = source.replace("__dirname+'/results.json'", "__dirname+'/editor-regression-results.json'");
  const Module = require('module');
  const virtual = path.join(output, 'core-' + name + '.cjs');
  const compiled = new Module(virtual, module);
  compiled.filename = virtual;
  compiled.paths = Module._nodeModulePaths(output);
  compiled._compile(source, virtual);
} else if (process.argv.includes('--core-regressions')) {
  const { spawnSync } = require('child_process');
  const preserved = Object.fromEntries(Object.values(coreSources).map(file => [file, sha(fs.readFileSync(path.join(project, file)))]));
  const runs = [];
  for (const name of Object.keys(coreSources)) {
    const result = spawnSync(process.execPath, [__filename, '--core-one', name], { cwd: project, encoding: 'utf8', windowsHide: true });
    fs.writeFileSync(path.join(output, 'core-' + name + '.log'), (result.stdout || '') + (result.stderr || ''));
    runs.push({ name, source: coreSources[name], sourceSha256: preserved[coreSources[name]], exitCode: result.status, error: result.error?.message || null });
  }
  for (const [file, expected] of Object.entries(preserved)) assert.equal(sha(fs.readFileSync(path.join(project, file))), expected);
  const report = { pass: runs.every(r => r.exitCode === 0), originalHarnessSourcesUnchanged: true, coverage: 'Accepted current B/C/pad/editor pure logic and collector/frame-driver integration; editor check 16 replays the preserved A/B/C resources. cc stubs in those tests are not Creator screenshot evidence.', runs };
  fs.writeFileSync(path.join(output, 'core-regressions.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
} else {
  const { app, BrowserWindow } = require('electron');
  const os = require('os');
  const url = process.env.NEUROU_PREVIEW_URL || 'http://localhost:7457/';
  const targets = [
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
  const catalogEntries = [
    ['EditorRoot', '编辑器', 'Folder'], ['MusicEditor', '音乐编辑器', 'Placeholder'],
    ['RgbWavetableEditor', 'RGB波表编辑器', 'Placeholder'], ['GridEditor', '网格编辑器', 'Placeholder'],
    ['MidiTrackEditor', 'MIDI以及音轨编辑器', 'Placeholder'], ['MapEditor', '地图编辑器', 'Placeholder'],
    ['NarrativeEventEditor', '事件编辑器', 'Placeholder'], ['StoryEditor', '剧情编辑器', 'Placeholder'],
    ['PasserbyEditor', '路人编辑器', 'Placeholder'], ['SubtitleEditor', '字幕编辑器', 'Placeholder'],
    ['ChartEditor', '谱面编辑器', 'Folder'], ['GuidanceEditor', '引导线编辑器', 'Implemented'],
    ['VideoTimingEditor', '视频卡点器', 'Placeholder'], ['PositionEditor', '位置编辑器', 'Placeholder'],
    ['SpecialNarrativeEventEditor', '特殊事件编辑器', 'Placeholder'],
  ];
  for (const [key, value] of [
    ['autoplay-policy', 'no-user-gesture-required'], ['force-device-scale-factor', '1'],
    ['disable-background-timer-throttling'], ['disable-renderer-backgrounding'], ['disable-backgrounding-occluded-windows'],
  ]) app.commandLine.appendSwitch(key, value);
  app.setPath('userData', path.join(os.tmpdir(), 'neurou-world-folder-evidence-' + Date.now()));
  app.on('window-all-closed', () => {});
  const report = { creator: '3.8.8', url, fixturePolicy: 'Startup/navigation use real DOM controls. The full T6 chain has no endpoint fixture. A separately labelled lifecycle check grants the already verified endpoint. Storage rejection and delayed genuine resource callbacks only inject failures at external boundaries. Forwarding method wrappers count calls without changing arguments or results.', resolutions: [], rendererErrors: [], runtimeErrors: [] };
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
  async function installWorld() {
    return evaluate(async () => {
      const e = window.__folderEvidence;
      const builder = e.all(e.cc.director.getScene(), 'SceneBuilder').find(b => !!b.graph);
      const input = e.all(e.cc.director.getScene(), 'InputCollector')[0];
      if (!builder?.chartPremiere || !builder.videoPlayer || !builder.chartPadView?.headLogo || !input || !builder.bgmClipLoaded) return false;
      const chartModule = await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/GuidanceChart.ts');
      const layoutModule = await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/KeyboardPadLayout.ts');
      const r = { builder, input, autoHead: false, autoNodes: false, headIds: new Set(), nodeIds: new Set(), heldKeys: new Set(), inputEvents: [], sync: [], frameCalls: 0, timers: [], video: null };
      e.world = r;
      const session = builder.graph.session, originalSubmit = session.submitFrameIntents.bind(session);
      session.submitFrameIntents = (...args) => { r.frameCalls++; return originalSubmit(...args); };
      r.edge = (code, down) => {
        r.inputEvents.push({ code, phase: down ? 'Down' : 'Up', mediaTimeMs: builder.readVideoTimeMs() });
        document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, repeat: false, bubbles: true, cancelable: true }));
      };
      r.press = code => { r.edge(code, true); r.edge(code, false); };
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
            const n = item.node; if (n.kind !== 'Tap' || r.nodeIds.has(n.id) || item.tier !== null) continue;
            const delay = n.id.endsWith('-conflict') && i === 1 ? 75 : -8;
            if (now >= r.target(i, n) + delay) {
              const position = chartModule.positionAtPathDistance(builder.chartData.lines[i].path, builder.chartData.aspectRatio, builder.chartData.lines[i].speed * (now - line.startedAtMs) / 1000);
              const key = layoutModule.resolveGridKeyAt(builder.keyboardLayout, position);
              if (key === null) throw new Error('No grid key for Tap ' + n.id);
              r.nodeIds.add(n.id); r.press(key);
            }
          }
        });
      }, 5);
      r.timers.push(r.timer);
      return { chartId: builder.chartPremiere.getChartId(), chart: builder.chartData, initialEndpoint: builder.graph.session.endpointSettled, initialLedger: builder.graph.session.getLedgerEvents().length };
    });
  }
  async function worldReady() {
    const start = Date.now();
    while (Date.now() - start < 20000) {
      const result = await installWorld();
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
  async function fullWorldChain(res) {
    await click('#open-initial-world');
    const ready = await worldReady(); assert.equal(ready.chartId, 'guidance-c-1'); assert.equal(ready.initialEndpoint, false); assert.equal(ready.initialLedger, 0);
    assert.deepEqual(ready.chart, report.compilation.expectedInitialChart, 'InitialWorld did not load the final C resource');
    res.loadedChart = ready.chart;
    const initial = await capture('04-initial-world', res); assert.equal(initial.frameDrivers, 1); assert.equal(initial.inputCollectors, 1); assert.equal(initial.world.puzzle, 'Step1');
    await evaluate(() => { const r = window.__folderEvidence.world; r.autoHead = true; r.autoNodes = true; r.press('Tab'); r.edge('KeyA', true); });
    await until(() => window.__folderEvidence.world.builder.graph.protagonist.getPosition().lateral <= -5.9, 10000);
    await evaluate(() => window.__folderEvidence.world.edge('KeyA', false));
    await until(() => window.__folderEvidence.world.builder.puzzleProgress.getStage() === 'AwaitingStrike');
    await capture('05-deep-trace-approach', res);
    await evaluate(() => {
      const r = window.__folderEvidence.world; r.beats = []; r.puzzleSamples = []; let nextBeat = null, lastSample = -1;
      const timer = setInterval(() => {
        const b = r.builder, time = b.audioOutputClock.readBgmTimeMs();
        if (time < 0 || b.chartEntered) return;
        if (time - lastSample > 200) { lastSample = time; r.puzzleSamples.push({ timeMs: time, stage: b.puzzleProgress.getStage(), sustainedMs: b.puzzleChain.getSustainedElapsedMs(), ledger: b.graph.session.getLedgerEvents().length }); }
        if (b.puzzleProgress.getStage() === 'AwaitingStrike') {
          if (nextBeat === null) nextBeat = Math.ceil(time / 1000) * 1000;
          if (time >= nextBeat - 5) { r.beats.push({ targetBeatMs: nextBeat, outputClockMs: time, deviationMs: time - nextBeat }); r.press('Digit1'); nextBeat += 1000; }
        }
      }, 4); r.timers.push(timer);
    });
    await until(() => window.__folderEvidence.world.builder.chartEntered, 25000);
    const entry = await capture('06-natural-T6-T7-entry', res); assert.equal(entry.world.ledger.length, 1);
    await until(() => window.__folderEvidence.world.builder.chartPremiere.getGuidanceSnapshots().every(l => l.startedAtMs !== null), 8000);
    await until(() => window.__folderEvidence.world.builder.chartPremiere.getCurrentTimeMs() > 4200, 8000);
    await capture('07-C-multiline-performance', res);
    await until(() => !window.__folderEvidence.world.builder.chartEntered && window.__folderEvidence.world.builder.chartPremiere.getResult()?.completed, 20000);
    const complete = await capture('08-T7-completed-world', res);
    assert.equal(complete.world.ledger.length, 2); assert.equal(complete.world.active, true); assert.equal(complete.world.counts.miss, 0); assert.equal(complete.world.result.completed, true);
    const inputs = await evaluate(() => { const r = window.__folderEvidence.world; return { beats: r.beats, puzzleSamples: r.puzzleSamples, inputs: r.inputEvents, sync: r.sync }; });
    assert.ok(inputs.beats.length >= 7); assert.ok(inputs.beats.every(b => Math.abs(b.deviationMs) <= 50));
    assert.ok(inputs.sync.length > 20);
    const maxRawPresentedErrorMs = Math.max(...inputs.sync.map(s => Math.abs(s.rawPresentedErrorMs))); assert.ok(maxRawPresentedErrorMs <= 30, 'real native video sync exceeded 30ms');
    res.fullChain = { pass: true, fixture: 'None: fresh selected InitialWorld; DOM movement and real output-clock rhythm beats; normal C multi-line player input; actual media completion.', ...inputs, syncSummary: { sampleCount: inputs.sync.length, maxRawPresentedErrorMs }, completed: complete.world.result, ledger: complete.world.ledger };
    await retireWorld(res, '09-return-world');
    await click('#open-initial-world');
    const reopened = await worldReady(); assert.equal(reopened.initialEndpoint, false); assert.equal(reopened.initialLedger, 0);
    const fresh = await read(); assert.equal(fresh.world.position.lateral, 0); assert.equal(fresh.world.position.depth, 0);
    res.freshReentry = { pass: true, snapshot: fresh.world };
    // This separately labelled fixture exercises T7 pause -> whole-world retirement.
    await evaluate(() => { const r = window.__folderEvidence.world; r.builder.graph.session.endpointSettled = true; r.autoHead = true; r.autoNodes = true; r.press('Enter'); });
    await until(() => window.__folderEvidence.world.builder.chartEntered && window.__folderEvidence.world.builder.chartPremiere.getCurrentTimeMs() > 3200, 10000);
    await evaluate(() => window.__folderEvidence.world.press('Escape'));
    await until(() => window.__folderEvidence.world.builder.chartPremiere.getState() === 'Paused');
    const paused = await capture('10-T7-paused-before-world-exit', res);
    await wait(200); const frozen = await read(); assert.equal(frozen.world.timeMs, paused.world.timeMs); assert.deepEqual(frozen.world.lines, paused.world.lines);
    res.pausedWholeWorldExit = { fixture: 'Existing endpointSettled=true grants entry only; normal DOM Enter and Escape; no ledger/score/media-clock replacement.', pass: true, paused: paused.world };
    await retireWorld(res, '11-return-paused-world');
  }
  async function startupChecks(res) {
    const initial = await capture('01-login', res); assert.equal(initial.mode, 'Login'); assert.equal(initial.startup.phase, 'Login'); await noRuntime();
    assert.equal(await evaluate(() => document.getElementById('folder-account').value), 'dev-local');
    await login('dev-local'); await until(() => !!document.getElementById('folder-complete-prologue'));
    const prologue = await capture('02-first-prologue', res); assert.equal(prologue.startup.PrologueCompleted, false); await noRuntime();
    await click('#folder-complete-prologue'); await until(() => !!document.getElementById('world-folder'));
    const folder = await capture('03-world-folder', res); assert.deepEqual(folder.worldLabels, [{ id: 'InitialWorld', title: '初始世界' }]); assert.equal(folder.startup.PrologueCompleted, true); await noRuntime();
    res.worldFolderFingerprint = await fingerprint('#world-folder');
    await reload(); await login('dev-local'); await until(() => !!document.getElementById('world-folder'));
    assert.equal(await evaluate(() => !!document.getElementById('folder-complete-prologue')), false);
    res.sameAccountOnce = { pass: true, startup: (await read()).startup };
    await reload(); await login('another-account'); await until(() => !!document.getElementById('folder-complete-prologue'));
    assert.equal((await read()).startup.PrologueCompleted, false); await noRuntime();
    await capture('03b-other-account-prologue', res);
    await click('#folder-complete-prologue'); await until(() => !!document.getElementById('world-folder'));
    await reload(); await login('another-account'); await until(() => !!document.getElementById('world-folder'));
    res.accountIsolation = { pass: true, startup: (await read()).startup };
    await reload();
    await evaluate(() => { const e = window.__folderEvidence; e.storageGet = Storage.prototype.getItem; Storage.prototype.getItem = function(key) { if (key.startsWith('neurou-account-milestone-v1:')) throw new Error('EVIDENCE: storage read denied'); return e.storageGet.call(this, key); }; });
    await login('storage-failure');
    const readFailure = await read(); assert.equal(readFailure.mode, 'Login'); assert.equal(readFailure.startup.phase, 'Login'); assert.ok(readFailure.status.includes('storage read denied')); await noRuntime();
    await evaluate(() => { const e = window.__folderEvidence; Storage.prototype.getItem = e.storageGet; });
    await login('storage-failure'); await until(() => !!document.getElementById('folder-complete-prologue'));
    await evaluate(() => { const e = window.__folderEvidence; e.storageSet = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('neurou-account-milestone-v1:')) throw new Error('EVIDENCE: storage write denied'); return e.storageSet.call(this, key, value); }; });
    await click('#folder-complete-prologue');
    const writeFailure = await read(); assert.equal(writeFailure.mode, 'Prologue'); assert.equal(writeFailure.startup.phase, 'Prologue'); assert.equal(writeFailure.startup.PrologueCompleted, false); assert.ok(writeFailure.status.includes('storage write denied')); await noRuntime();
    await capture('03c-storage-failure-remains-prologue', res);
    await evaluate(() => { const e = window.__folderEvidence; Storage.prototype.setItem = e.storageSet; });
    await click('#folder-complete-prologue'); await until(() => !!document.getElementById('world-folder'));
    res.storageFailures = { pass: true, fixture: 'Forwarded Storage methods reject only account milestone reads/writes.', readFailure, writeFailure, successfulRetry: (await read()).startup };
    await reload(); await login('dev-local'); await until(() => !!document.getElementById('world-folder'));
  }
  async function editorChecks(res) {
    await click('#open-editor-folder'); await until(() => !!document.getElementById('editor-folder'));
    const tree = await capture('12-editor-tree', res);
    assert.deepEqual(tree.entries.map(e => e.id), catalogEntries.map(e => e[0]));
    for (let i = 0; i < catalogEntries.length; i++) assert.equal(tree.entries[i].title.trim(), catalogEntries[i][1]);
    res.editorFolderFingerprint = await fingerprint('#editor-folder'); await noRuntime();
    const before = await evaluate(() => document.querySelector('[data-entry-id="EditorRoot"]').parentElement.open);
    await click('[data-entry-id="EditorRoot"]');
    const closed = await evaluate(() => document.querySelector('[data-entry-id="EditorRoot"]').parentElement.open); assert.equal(closed, false); assert.equal(before, true);
    await click('[data-entry-id="EditorRoot"]'); assert.equal(await evaluate(() => document.querySelector('[data-entry-id="EditorRoot"]').parentElement.open), true);
    res.treeCollapse = { pass: true, before, closed, reopened: true };
    res.placeholders = [];
    for (const [id, title, availability] of catalogEntries) {
      if (availability !== 'Placeholder') continue;
      await evaluate(id => { const el = document.querySelector('[data-entry-id="' + id + '"]'); for (let parent = el.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; el.scrollIntoView({ block: 'nearest' }); }, id);
      await click('[data-entry-id="' + id + '"]');
      const snapshot = await read(); assert.equal(snapshot.status, title + '：暂未实现'); assert.equal(snapshot.mode, 'EditorFolder'); assert.equal(snapshot.editorBuilders, 0);
      res.placeholders.push({ id, title, pass: true, status: snapshot.status });
    }
    await capture('13-placeholder-feedback', res);
    await evaluate(() => { document.querySelectorAll('#editor-directory details').forEach(d => d.open = true); document.getElementById('editor-directory').scrollTop = 0; });
    await click('#folder-back'); await until(() => !!document.getElementById('world-folder'));
    await capture('14-directory-back-world-folder', res);
    await click('#open-editor-folder'); await click('[data-entry-id="GuidanceEditor"]');
    await until(() => !!document.getElementById('guidance-editor') && !!window.__folderEvidence.all(window.__folderEvidence.cc.director.getScene(), 'GuidanceEditorView')[0]?.effect?.headLogo);
    await click('#load-mock');
    const opened = await capture('15-guidance-editor-open', res); assert.equal(opened.worldCount, 0); assert.equal(opened.frameDrivers, 0); assert.equal(opened.inputCollectors, 0); assert.equal(opened.editor.document.source.events.length, 10);
    await evaluate(() => {
      const e = window.__folderEvidence, builder = e.all(e.cc.director.getScene(), 'GuidanceEditorBuilder')[0], view = e.all(e.cc.director.getScene(), 'GuidanceEditorView')[0];
      const probe = { builder, view, session: builder.session, video: document.getElementById('editor-video'), intentCalls: 0, strikeCalls: 0 };
      const original = builder.session.submitEditorIntent.bind(builder.session);
      builder.session.submitEditorIntent = (...args) => { probe.intentCalls++; if (args[0].kind === 'Strike') probe.strikeCalls++; return original(...args); }; e.editor = probe;
    });
    await click('#play-auto'); await until(() => window.__folderEvidence.editor.builder.session.getPreview()?.getCurrentTimeMs() > 1700, 8000);
    await capture('16-editor-independent-rehearsal', res);
    await click('#folder-runtime-exit'); await until(() => !!document.getElementById('world-folder'));
    const first = await evaluate(() => { const e = window.__folderEvidence, old = e.editor; return { timeMs: old.session.getPreview()?.getCurrentTimeMs(), intentCalls: old.intentCalls, strikeCalls: old.strikeCalls, videoPaused: old.video.paused, videoConnected: old.video.isConnected, builderValid: e.cc.isValid(old.builder, true), viewValid: e.cc.isValid(old.view, true), editorDom: !!document.getElementById('guidance-editor') }; });
    await evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true })); });
    await wait(200);
    const after = await evaluate(() => { const e = window.__folderEvidence, old = e.editor; return { timeMs: old.session.getPreview()?.getCurrentTimeMs(), intentCalls: old.intentCalls, strikeCalls: old.strikeCalls, videoPaused: old.video.paused, videoConnected: old.video.isConnected, builderValid: e.cc.isValid(old.builder, true), viewValid: e.cc.isValid(old.view, true), editorDom: !!document.getElementById('guidance-editor') }; });
    assert.deepEqual(after, first); assert.equal(after.videoPaused, true); assert.equal(after.videoConnected, false); assert.equal(after.builderValid, false); assert.equal(after.viewValid, false); assert.equal(after.editorDom, false);
    await noRuntime(); res.lifecycleEditor = { pass: true, retired: after };
    await capture('17-return-editor', res);
    // Flush a genuine callback in the exact pending-destruction window, before
    // another engine frame can run. A never-loaded view must not create orphan DOM.
    await click('#open-editor-folder');
    await evaluate(() => {
      const e = window.__folderEvidence; e.originalPendingLoad = e.cc.resources.load; e.pendingResourceCallbacks = []; e.flushedResourceCallbacks = 0;
      e.cc.resources.load = function(...args) {
        const index = args.length - 1, callback = args[index];
        if (args[0] === 'editor/mock_midi' && typeof callback === 'function') args[index] = (...results) => e.pendingResourceCallbacks.push(() => { e.flushedResourceCallbacks++; callback(...results); });
        return e.originalPendingLoad.apply(this, args);
      };
    });
    await click('[data-entry-id="GuidanceEditor"]');
    await until(() => window.__folderEvidence.pendingResourceCallbacks.length > 0);
    const pendingExit = await evaluate(() => {
      const e = window.__folderEvidence;
      document.getElementById('folder-runtime-exit').click();
      e.pendingResourceCallbacks.forEach(callback => callback());
      e.cc.resources.load = e.originalPendingLoad;
      return { deliveredInPendingDestructionFrame: e.flushedResourceCallbacks, editorDomImmediately: !!document.getElementById('guidance-editor') };
    });
    assert.equal(pendingExit.deliveredInPendingDestructionFrame, 1); assert.equal(pendingExit.editorDomImmediately, false);
    await until(() => !!document.getElementById('world-folder')); await noRuntime();
    assert.equal(await evaluate(() => !!document.getElementById('guidance-editor')), false);
    res.pendingDestructionEditorExit = { pass: true, fixture: 'Genuine loader callback flushed synchronously after DOM exit click, before deferred destruction.', ...pendingExit };
    // Delay delivery of the actual cached resource at the loader boundary, ensuring
    // that the editor has started before it is retired and its callback runs afterward.
    await click('#open-editor-folder');
    await evaluate(() => {
      const e = window.__folderEvidence; e.originalLoad = e.cc.resources.load; e.delayedResourceCallbacks = 0;
      e.cc.resources.load = function(...args) {
        const index = args.length - 1, callback = args[index];
        if ((args[0] === 'editor/mock_midi' || args[0] === 'guidance/head-logo/spriteFrame') && typeof callback === 'function') args[index] = (...results) => setTimeout(() => { e.delayedResourceCallbacks++; callback(...results); }, 200);
        return e.originalLoad.apply(this, args);
      };
    });
    await click('[data-entry-id="GuidanceEditor"]');
    await until(() => !!window.__folderEvidence.all(window.__folderEvidence.cc.director.getScene(), 'GuidanceEditorBuilder')[0]?.session);
    await click('#folder-runtime-exit'); await until(() => !!document.getElementById('world-folder'));
    await wait(350);
    const rapid = await evaluate(() => { const e = window.__folderEvidence; e.cc.resources.load = e.originalLoad; return { deliveredAfterRetirement: e.delayedResourceCallbacks, editorDom: !!document.getElementById('guidance-editor'), errors: e.errors }; });
    assert.ok(rapid.deliveredAfterRetirement >= 1); assert.equal(rapid.editorDom, false); assert.deepEqual(rapid.errors, []); await noRuntime();
    res.rapidEditorExit = { pass: true, fixture: '200ms delayed delivery of real loader callback; no asset or editor-state substitution.', ...rapid };
    await capture('18-rapid-editor-return', res);
  }
  async function resolution(width, height) {
    const res = { resolution: width + 'x' + height, evidence: [], checks: [] }; report.resolutions.push(res);
    win = new BrowserWindow({ width, height, show: false, frame: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, partition: 'persist:batch30-' + width + '-' + Date.now() } });
    win.webContents.on('console-message', event => { if (event.level === 3 || event.level === 'error') report.rendererErrors.push({ resolution: res.resolution, message: event.message }); });
    await win.loadURL(url); win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await ready();
    const dimensions = (await read()).dimensions; assert.deepEqual(dimensions.inner, [width, height]); assert.deepEqual(dimensions.canvas, [width, height]); assert.deepEqual(dimensions.css, [width, height]); assert.equal(dimensions.dpr, 1);
    await startupChecks(res); await fullWorldChain(res); await editorChecks(res);
    report.runtimeErrors.push(...(await read()).errors.map(message => ({ resolution: res.resolution, message })));
    res.checks = ['local login -> first-only account prologue -> folder', 'same account skips once / other account has independent first prologue', 'storage read/write failure cannot commit fake completion', 'single InitialWorld / editor folder', 'real T6 seven-second beat chain -> default C multi-line T7 -> actual media completion with two ledger entries', 'whole-world exit and fresh runtime reentry', 'T7 paused whole-world exit cleans input/frame/media/cameras', 'complete editor directory / every placeholder / collapsible tree', 'GuidanceEditor opens isolated real existing UI', 'editor playback exit removes DOM/media/keyboard/frame updates', 'resource callbacks after rapid exit cannot resurrect editor'].map(name => ({ name, pass: true }));
    res.pass = true; win.destroy(); win = null;
  }
  app.whenReady().then(async () => {
    try {
      report.compilation = await compilation();
      await resolution(1920, 1080); await resolution(2560, 1440);
      assert.deepEqual(report.resolutions[0].worldFolderFingerprint, report.resolutions[1].worldFolderFingerprint);
      assert.deepEqual(report.resolutions[0].editorFolderFingerprint, report.resolutions[1].editorFolderFingerprint);
      assert.deepEqual(report.rendererErrors, []); assert.deepEqual(report.runtimeErrors, []);
      assert.deepEqual((await compilation()).entries, report.compilation.entries, 'source or served compilation changed during evidence');
      report.compilation.unchangedThroughEvidenceCapture = true;
      report.resolutionComparison = { pass: true, identicalWorldFolderContentAndStyles: true, identicalEditorCatalogContentAndStyles: true, actualViewportCanvasAndPngDimensions: report.resolutions.map(r => r.resolution), gameplayBothMissZero: true };
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
}
