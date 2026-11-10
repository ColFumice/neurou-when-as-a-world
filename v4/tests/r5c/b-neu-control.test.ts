import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuRuntime } from '../../core/editor/runtime/NeuRuntime';
import type { NeuSignal } from '../../core/editor/runtime/NeuRuntime';
import type { NeuControlSignal } from '../../app/src/game/neuControl';
import { RandomPreviewMode, RandomSeed } from '../../core/eventgraph/RandomMode';
import { GameNeuRuntime } from '../../app/src/game/neuRuntime';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import type { GameSinkEvent } from '../../app/src/game/neuRuntime';
import { audio, neu, rhythm } from '../r4b/helpers';

function collectSignals(runtime: NeuRuntime, times: readonly number[]): NeuSignal[] {
  const signals: NeuSignal[] = [];
  runtime.reset(0);
  for (const time of times) {
    runtime.advanceTo(time, true, (signal) => signals.push(signal));
  }
  return signals;
}

function controlSignals(runtime: NeuRuntime, times: readonly number[]): NeuControlSignal[] {
  const controls: NeuControlSignal[] = [];
  runtime.reset(0);
  for (const time of times) {
    runtime.advanceTo(time, true, () => undefined);
  }
  return controls;
}

describe('R5c-B NEU control routing', () => {
  test('control node types round-trip through editor.json', () => {
    const file = EditorWorldFile.create({ documentId: 'r5c-b', chartId: 'chart-w1', durationMs: 8000 });
    file.setNeuModules([
      neu('enter', 'EnterRhythmMode', [], [], { chartId: 'chart-w1', atMs: 800 }),
      neu('cut', 'PlayCutscene', [], [], { cutsceneId: 'cs-intro' }),
      neu('exit', 'ExitToExplore', [], [], {}),
    ]);
    const loaded = EditorWorldFile.fromJson(file.toJson());
    assert.deepEqual(loaded.neuModules.map((module) => module.type), [
      'EnterRhythmMode', 'PlayCutscene', 'ExitToExplore',
    ]);
  });

  test('Explore time-root EnterRhythmMode emits onControl, not NeuSignal', () => {
    const controls: NeuControlSignal[] = [];
    const signals: NeuSignal[] = [];
    const runtime = new NeuRuntime([
      neu('enter', 'EnterRhythmMode', [], [], { chartId: 'chart-w1', atMs: 1000 }),
    ], {
      activation: 'Explore',
      onControl: (signal) => controls.push(signal),
    });
    runtime.reset(0);
    runtime.advanceTo(500, true, (signal) => signals.push(signal));
    assert.equal(controls.length, 0);
    runtime.advanceTo(1000, true, (signal) => signals.push(signal));
    assert.equal(controls.length, 1);
    assert.equal(controls[0].action, 'EnterRhythmMode');
    assert.equal(controls[0].chartId, 'chart-w1');
    assert.equal(controls[0].atMs, 1000);
    assert.equal(signals.length, 0);
    runtime.advanceTo(1500, true, (signal) => signals.push(signal));
    assert.equal(controls.length, 1);
  });

  test('external trace/trigger pulse reaches a virtual-source control input', () => {
    const controls: NeuControlSignal[] = [];
    const runtime = new NeuRuntime([
      neu(
        'cut',
        'PlayCutscene',
        [],
        ['trace:rain-window'],
        { cutsceneId: 'cs-intro' },
      ),
    ], {
      activation: 'Explore',
      onControl: (signal) => controls.push(signal),
    });
    runtime.reset(0);
    runtime.pulse('trace:rain-window');
    runtime.advanceTo(100, true, () => undefined);
    assert.equal(controls.length, 1);
    assert.equal(controls[0].action, 'PlayCutscene');
    assert.equal(controls[0].cutsceneId, 'cs-intro');
  });

  test('Rhythm activation ignores control nodes and still runs RhythmPoint graph', () => {
    const controls: NeuControlSignal[] = [];
    const signals: NeuSignal[] = [];
    const runtime = new NeuRuntime([
      neu('enter', 'EnterRhythmMode', [], [], { chartId: 'chart-w1', atMs: 100 }),
      rhythm('r', 100, ['a']),
      audio('a', ['r']),
    ], {
      activation: 'Rhythm',
      onControl: (signal) => controls.push(signal),
    });
    runtime.reset(0);
    runtime.advanceTo(100, true, (signal) => signals.push(signal));
    assert.equal(controls.length, 0);
    assert.equal(signals.filter((signal) => signal.kind === 'Audio').length, 1);
  });

  test('Explore suppresses RhythmPoint and Binding signals', () => {
    const controls: NeuControlSignal[] = [];
    const events: GameSinkEvent[] = [];
    const runtime = new GameNeuRuntime({
      modules: [
        rhythm('r', 100, ['a']),
        audio('a', ['r']),
        neu('enter', 'EnterRhythmMode', [], [], { chartId: 'chart-w1', atMs: 100 }),
      ],
      effects: [],
      bindings: [{
        keyframeId: 'kf-1',
        assetId: 'asset:audio:main',
        triggerAtMs: 100,
      }],
      seed: new RandomSeed(1),
      mode: RandomPreviewMode.Seeded,
      activation: 'Explore',
      sink: { emit: (event) => events.push(event) },
      onControl: (signal) => controls.push(signal),
    });
    runtime.reset(0);
    runtime.advanceTo(100, true);
    assert.equal(controls.length, 1);
    assert.equal(events.length, 0);
  });

  test('Rhythm activation still emits Binding and NEU audio', () => {
    const events: GameSinkEvent[] = [];
    const runtime = new GameNeuRuntime({
      modules: [
        rhythm('r', 100, ['a']),
        neu('a', 'Audio', [], ['r'], { assetId: 'asset:audio:sfx-layer1' }),
      ],
      effects: [],
      bindings: [{ keyframeId: 'kf-1', assetId: 'asset:audio:main', triggerAtMs: 100 }],
      seed: new RandomSeed(1),
      mode: RandomPreviewMode.Seeded,
      activation: 'Rhythm',
      sink: { emit: (event) => events.push(event) },
    });
    runtime.reset(0);
    runtime.advanceTo(100, true);
    assert.ok(events.some((event) => event.origin === 'Binding'));
    assert.ok(events.some((event) => event.origin === 'NEU'));
  });

  test('control signal preserves unknown chart/cutscene ids for host warning', () => {
    const controls: NeuControlSignal[] = [];
    const runtime = new NeuRuntime([
      neu('bad', 'PlayCutscene', [], [], { cutsceneId: 'missing-cutscene', atMs: 50 }),
    ], {
      activation: 'Explore',
      onControl: (signal) => controls.push(signal),
    });
    runtime.reset(0);
    runtime.advanceTo(50, true, () => undefined);
    assert.equal(controls[0].cutsceneId, 'missing-cutscene');
  });

  test('control pulse count does not leak into visual signal count', () => {
    const controls: NeuControlSignal[] = [];
    const runtime = new NeuRuntime([
      neu('exit', 'ExitToExplore', [], [], { atMs: 30 }),
    ], {
      activation: 'Explore',
      onControl: (signal) => controls.push(signal),
    });
    runtime.reset(0);
    runtime.advanceTo(30, true, () => undefined);
    assert.equal(controls.length, 1);
    assert.equal(controlSignals(runtime, [30]).length, 0);
  });
});
