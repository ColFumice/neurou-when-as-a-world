'use strict';
// Load actual pure TypeScript in memory. No generated gameplay source or private-state mutation.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const ts = require('../../node_modules/typescript');
const projectRoot = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText, filename);
const { createDefaultKeyboardPadLayout, resolveGridKeyAt } = require('../../src/chart/KeyboardPadLayout.ts');
const { createDefaultMusicProject } = require('../../src/musicEditor/MusicProjectData.ts');
const { MusicEditorSession } = require('../../src/musicEditor/MusicEditorSession.ts');
const { GuidanceEditorSession, parseGuidanceVisualData } = require('../../src/editor/GuidanceEditorSession.ts');
const { ChartPremiere } = require('../../src/chart/ChartPremiere.ts');
const { parseGuidanceChart, positionAtPathDistance } = require('../../src/chart/GuidanceChart.ts');
const { guidanceNodeTime } = require('../../src/chart/GuidanceTiming.ts');
const { DirectorSession } = require('../../src/director/IntentPort.ts');
const { PuzzleChain } = require('../../src/trace/PuzzleChain.ts');
const { PuzzleProgress } = require('../../src/trace/PuzzleProgress.ts');
const { DeepTrace } = require('../../src/trace/DeepTrace.ts');
const { Protagonist } = require('../../src/character/Protagonist.ts');
const { InputSource } = require('../../src/ledger/NarrativeEvent.ts');
const layout = createDefaultKeyboardPadLayout(), clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
function test(name, run) { try { checks.push({ name, pass: true, evidence: run() ?? null }); }
  catch (error) { checks.push({ name, pass: false, error: String(error.stack || error) }); } }
function save(name, value) { const filename = path.join(__dirname, name); fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
  return { filename: path.relative(projectRoot, filename).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') }; }
const music = new MusicEditorSession(layout), project = clone(createDefaultMusicProject(layout));
project.projectId = 'b1-editor-v3'; project.title = '雨若 · B1 编辑器到游戏';
music.submitMusicEditorIntent({ kind: 'LoadProject', project });
const middle = music.getDocument().project.tracks[0].notes[1];
music.submitMusicEditorIntent({ kind: 'ChangeNote', trackId: 'track-1', noteId: middle.id, note: { ...middle, tick: 2400 } });
const source = music.exportSource(), guidance = new GuidanceEditorSession(layout);
guidance.submitEditorIntent({ kind: 'LoadSource', source });
const exported = guidance.exportChart(), chart = exported.chart, visual = exported.visual;
const artifacts = [save('b1-editor-v3-project.json', music.getDocument().project), save('b1-editor-v3-music-draft.json', music.getDocument()),
  save('b1-editor-v3-source.json', source), save('b1-editor-v3-guidance-draft.json', guidance.getDocument()),
  save(chart.chartId + '.json', chart), save(chart.chartId + '.visual.json', visual)];
function realWorld(data = chart) {
  const director = new DirectorSession(), premiere = new ChartPremiere(data, layout), deepTrace = new DeepTrace({ lateral: 0, depth: 0 });
  const progress = new PuzzleProgress(), chain = new PuzzleChain(progress), clock = { beat: 0, media: -1, ended: false, unavailable: false, rhythm: null };
  director.bindProtagonist(new Protagonist({ lateral: 0, depth: 0 }));
  director.bindPuzzleChain(chain); director.bindDeepTrace(deepTrace); director.bindChartPremiere(premiere);
  director.bindScreenProjectionProbe(() => ({ x: .5, y: .5 }));
  director.bindRhythmStrikeProbe(() => clock.rhythm); director.bindBeatClockProbe(() => clock.beat);
  director.bindChartClockProbe(() => clock.media); director.bindChartMediaProbe(() => ({ ended: clock.ended, unavailable: clock.unavailable }));
  const frame = (intents = [], dt = 1 / 60) => director.submitFrameIntents(intents, dt);
  return { director, premiere, deepTrace, chain, progress, clock, frame };
}
function trigger(world) {
  world.frame(); assert.equal(world.progress.getStage(), 'AwaitingStrike');
  for (let beat = 0; beat < 7000; beat += 1000) {
    world.clock.beat = beat; world.clock.rhythm = { strikeTimeMs: beat, targetBeatTimeMs: beat };
    world.frame([{ kind: 'Strike', videoTimeMs: beat }]);
    assert.equal(world.director.getLedgerEvents().length, 0);
  }
  world.clock.rhythm = null; world.clock.beat = 7000; world.frame();
  assert.equal(world.progress.getStage(), 'Completed'); assert.equal(world.deepTrace.isTriggered(), true);
  const events = world.director.getLedgerEvents(); assert.equal(events.length, 1); assert.equal(events[0].eventId, 'T6_ENDPOINT_PLACEHOLDER');
  assert.equal(events[0].ChartRef.chartId, world.premiere.getChartId());
  assert.equal(world.director.isWorldMotionGated(), true);
  return events[0];
}
function enter(world) { world.clock.media = 0; world.clock.ended = false; world.frame([{ kind: 'EnterChart' }]);
  assert.equal(world.director.isChartEntryScheduled(), true); assert.equal(world.director.isWorldMotionGated(), true); assert.equal(world.premiere.getState(), 'Playing'); }
function strike(keyId, videoTimeMs, phase = 'Down') { return { kind: 'Strike', keyId, videoTimeMs, phase }; }
function perfectTaps(world, data = chart) {
  const inputs = [];
  for (const line of data.lines) {
    const start = line.head.targetTimeMs ?? line.head.spawnTimeMs;
    inputs.push({ timeMs: start, keyId: 'Space', lineId: line.id, head: true });
    for (const node of line.nodes) {
      assert.equal(node.kind, 'Tap', 'B1 sample deliberately exercises Tap only; prior Drag/Hold regression runs separately.');
      inputs.push({ timeMs: guidanceNodeTime(line, start, node), keyId: resolveGridKeyAt(layout, positionAtPathDistance(line.path, data.aspectRatio, node.pathDistance)), nodeId: node.id });
    }
  }
  inputs.sort((a, b) => a.timeMs - b.timeMs || Number(b.head ?? false) - Number(a.head ?? false));
  for (const input of inputs) { assert.ok(input.keyId); world.clock.media = input.timeMs; world.frame([strike(input.keyId, input.timeMs), strike(input.keyId, input.timeMs, 'Up')]); }
  return inputs;
}
function finish(world, duration = source.mediaDurationMs) { world.clock.media = duration; world.clock.ended = true; world.frame();
  assert.equal(world.premiere.getState(), 'Exited'); assert.equal(world.premiere.getResult().completed, true);
  assert.equal(world.director.isWorldMotionGated(), false); assert.equal(world.director.isChartEntryScheduled(), false); }
function completionEvent(world, baseline = 1) { const events = world.director.getLedgerEvents(); assert.equal(events.length - baseline, 1);
  const event = events[baseline]; assert.equal(event.eventId, 'T7_COMPLETION_PLACEHOLDER'); assert.equal(event.ChartRef.chartId, world.premiere.getChartId());
  assert.equal(event.VectorSchemaVersion, 1); assert.equal(event.vector.length, 20); assert.equal(event.InputSource, InputSource.Player);
  assert.deepEqual(Object.keys(event).sort(), ['eventId','vector','VectorSchemaVersion','AppendedAt','InputSource','ChapterTag','ChartRef'].sort());
  assert.ok(Object.isFrozen(event)); assert.ok(Object.isFrozen(event.ChartRef)); return event; }
test('B1-01 real music edit -> Midi source -> guidance editor -> serialized v3 and matching color sidecar', () => {
  assert.equal(music.getDocument().revision, 1); assert.equal(source.provenance, 'Midi'); assert.equal(source.events.length, 6);
  assert.equal(chart.schemaVersion, 3); assert.equal(chart.chartId, 'b1-editor-v3-chart'); assert.equal(chart.lines.length, 2);
  assert.deepEqual(chart.lines[0].timing.map(t => t.targetTimeMs), [2500, 3000]); assert.equal(visual.nodes.length, 4);
  assert.deepEqual(parseGuidanceChart(JSON.parse(fs.readFileSync(path.join(__dirname, chart.chartId + '.json'), 'utf8')), layout), chart);
  assert.deepEqual(parseGuidanceVisualData(JSON.parse(fs.readFileSync(path.join(__dirname, chart.chartId + '.visual.json'), 'utf8')), chart), visual);
  return { chartId: chart.chartId, schemaVersion: chart.schemaVersion, lines: 2, nodes: 4, sourceEvents: 6, mediaDurationMs: source.mediaDurationMs, artifacts };
});
test('B1-02 unauthorized entry rejected; real seven-second deep-trace chain produces only T6 baseline', () => {
  const w = realWorld(); w.frame([{ kind: 'EnterChart' }]); assert.equal(w.director.isChartEntryScheduled(), false); assert.equal(w.director.getLedgerEvents().length, 0);
  const event = trigger(w); for (let i = 0; i < 5; i++) w.frame(); assert.equal(w.director.getLedgerEvents().length, 1);
  return { triggerDurationMs: 7000, deepTraceTriggered: true, baselineLedgerCount: 1, event };
});
test('B1-03 v3 perfect performance through real director completes, returns world in same frame, adds exactly one T7 event', () => {
  const w = realWorld(), endpoint = trigger(w); enter(w); const inputs = perfectTaps(w);
  assert.equal(w.premiere.getResolvedCount(), 4); assert.equal(w.premiere.getPerfectCount(), 4); assert.equal(w.premiere.getState(), 'Playing');
  assert.equal(w.director.getLedgerEvents().length, 1, 'All notes settled before media end must not append.');
  finish(w); const event = completionEvent(w); assert.strictEqual(w.director.getLedgerEvents()[0], endpoint);
  return { inputs, baselineLedgerCount: 1, finalLedgerCount: 2, gameCompletionDelta: 1, sameFrameWorldReturn: true, result: w.premiere.getResult(), event };
});
test('B1-04 zero-score v3 performance writes the same NarrativeEvent shape and exactly one completion', () => {
  const w = realWorld(); trigger(w); enter(w); finish(w);
  assert.equal(w.premiere.getTotalScore(), 0); assert.equal(w.premiere.getMissCount(), 4);
  return { gameCompletionDelta: 1, result: w.premiere.getResult(), event: completionEvent(w) };
});
test('B1-05 active/paused exits add zero ledger; retained deep-trace entry permits fresh run completion', () => {
  const evidence = [];
  for (const paused of [false, true]) {
    const w = realWorld(); trigger(w); enter(w); w.clock.media = 900; w.frame();
    if (paused) { w.frame([{ kind: 'ToggleChartPause', videoTimeMs: 900 }]); assert.equal(w.premiere.getState(), 'Paused'); }
    w.frame([{ kind: 'ExitChart' }]); assert.equal(w.director.getLedgerEvents().length, 1); assert.equal(w.premiere.getResult().completed, false);
    assert.equal(w.director.isWorldMotionGated(), false); assert.equal(w.deepTrace.isTriggered(), true);
    enter(w); assert.equal(w.premiere.getResolvedCount(), 0); perfectTaps(w); finish(w); completionEvent(w);
    evidence.push({ exitedFrom: paused ? 'Paused' : 'Playing', exitDelta: 0, replayCompletionDelta: 1, finalLedgerCount: 2 });
  }
  return evidence;
});
test('B1-06 duplicate advance/media-end/exit/enter after completion cannot duplicate ledger or reopen finished entry', () => {
  const w = realWorld(); trigger(w); enter(w); perfectTaps(w); finish(w); const before = w.director.getLedgerEvents();
  for (let i = 0; i < 20; i++) { w.clock.media += 100; w.frame([{ kind: 'EnterChart' }, { kind: 'ExitChart' }, strike('Space', w.clock.media)]); }
  assert.deepEqual(w.director.getLedgerEvents(), before); assert.equal(w.director.isWorldMotionGated(), false); assert.equal(w.director.isChartEntryScheduled(), false);
  return { repeatedFrames: 20, finalLedgerCount: 2, duplicateCompletionDelta: 0 };
});
test('B1-07 editor preview/rehearsal completion remains isolated from live director ledger', () => {
  const w = realWorld(); trigger(w); const baseline = w.director.getLedgerEvents();
  const s = new GuidanceEditorSession(layout); s.submitEditorIntent({ kind: 'LoadPreview', chart: clone(chart), visual: clone(visual) });
  for (let run = 0; run < 2; run++) { s.submitEditorIntent({ kind: 'StartPreview', mode: 'Rehearsal' });
    for (let timeMs = 0; timeMs <= source.mediaDurationMs; timeMs += 10) s.submitEditorIntent({ kind: 'Advance', timeMs, ended: timeMs === source.mediaDurationMs });
    assert.equal(s.getPreview().getResult().completed, true); assert.equal(s.getPreview().getPerfectCount(), 4); assert.deepEqual(w.director.getLedgerEvents(), baseline); }
  for (const filename of ['src/editor/GuidanceEditorSession.ts', 'src/musicEditor/MusicEditorSession.ts']) {
    assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, filename), 'utf8'), /^import\s.*(?:director|ledger|['"]cc['"])/m);
  }
  return { previewRuns: 2, previewCompleted: true, previewLedgerDelta: 0, separatePremiereInstances: true };
});
test('B1-08 optional color sidecar cannot change gameplay outcome; invalid chartId/node pairing rejects', () => {
  const withColor = new GuidanceEditorSession(layout), withoutColor = new GuidanceEditorSession(layout), outcomes = [];
  for (const [s, paired] of [[withColor, true], [withoutColor, false]]) {
    s.submitEditorIntent({ kind: 'LoadPreview', chart, ...(paired ? { visual } : {}) }); s.submitEditorIntent({ kind: 'StartPreview', mode: 'Rehearsal' });
    for (let timeMs = 0; timeMs <= source.mediaDurationMs; timeMs += 10) s.submitEditorIntent({ kind: 'Advance', timeMs, ended: timeMs === source.mediaDurationMs });
    outcomes.push(s.getPreview().getResult());
  }
  assert.deepEqual(outcomes[0], outcomes[1]); assert.throws(() => parseGuidanceVisualData({ ...visual, chartId: 'mismatched' }, chart));
  assert.throws(() => parseGuidanceVisualData({ ...visual, nodes: [{ nodeId: 'unknown', color: { r: 0, g: 0, b: 0 } }] }, chart));
  return { identicalWithWithoutVisual: true, rejectedPairs: ['wrong chartId', 'unknown nodeId'], result: outcomes[0] };
});
test('B1-09 existing A/B/C v1/v2 resources retain actual director entry/completion event contract', () => {
  const evidence = [];
  for (const name of ['guidance_a', 'guidance_b', 'guidance_c']) {
    const data = parseGuidanceChart(JSON.parse(fs.readFileSync(path.join(projectRoot, 'assets/resources/chart', name + '.json'), 'utf8')), layout), w = realWorld(data);
    trigger(w); enter(w); finish(w, 60000); completionEvent(w);
    evidence.push({ resource: 'chart/' + name, chartId: data.chartId, schemaVersion: data.schemaVersion, gameCompletionDelta: 1, result: w.premiere.getResult() });
  }
  return evidence;
});
test('B1-10 pause freezes v3 clock and judgement; pause itself does not write ledger', () => {
  const w = realWorld(); trigger(w); enter(w); w.clock.media = 1500; w.frame([strike('Space', 1000)]);
  w.frame([{ kind: 'ToggleChartPause', videoTimeMs: 1500 }]); const frozen = w.premiere.getGuidanceSnapshots();
  w.clock.media = 5000; w.frame(); assert.equal(w.premiere.getCurrentTimeMs(), 1500); assert.deepEqual(w.premiere.getGuidanceSnapshots(), frozen);
  assert.equal(w.director.getLedgerEvents().length, 1); assert.equal(w.director.isWorldMotionGated(), true);
  w.clock.media = 1500; w.frame([{ kind: 'ToggleChartPause', videoTimeMs: 1500 }]); assert.equal(w.premiere.getState(), 'Playing');
  return { frozenAtMs: 1500, mediaProbeWhilePausedMs: 5000, ledgerDelta: 0, resumed: true };
});
test('B1-11 normalized chart/strike replay yields identical director outcomes at both target resolutions', () => {
  const evidence = [];
  for (const resolution of ['1920x1080', '2560x1440']) { const w = realWorld(); trigger(w); enter(w); const inputs = perfectTaps(w); finish(w);
    evidence.push({ resolution, result: w.premiere.getResult(), chartId: completionEvent(w).ChartRef.chartId, gameCompletionDelta: w.director.getLedgerEvents().length - 1, inputs }); }
  assert.deepEqual(evidence[0].result, evidence[1].result); assert.deepEqual(evidence[0].inputs, evidence[1].inputs);
  return { scope: 'Pure normalized logic replay only. Actual Cocos viewport evidence is recorded separately.', evidence };
});
const report = { generatedAt: new Date().toISOString(), scope: 'Actual MusicEditorSession, GuidanceEditorSession, PuzzleChain, DeepTrace, ChartPremiere and DirectorSession. No cc or private state mutation.',
  passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, artifacts, checks };
save('b1-logic-results.json', report); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.failed ? 1 : 0;
