import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import { NeuRuntime } from '../../core/editor/runtime/NeuRuntime';
import { composeStageEffects, composeStageLights } from '../../core/editor/runtime/EffectCompositor';
import type { NeuModule, NeuModuleType } from '../../core/editor/runtime/types';

function createWorld(): EditorWorldFile {
  return EditorWorldFile.create({
    documentId: 'doc',
    chartId: 'w1',
    durationMs: 10_000,
    stageWidth: 1280,
    stageHeight: 720,
    seed: 42,
  });
}

function neu(
  moduleId: string,
  type: NeuModuleType,
  outputs: readonly { moduleId: string; port: number }[] = [],
  inputs: readonly { moduleId: string; port: number }[] = [],
  params: Record<string, string | number | boolean | string[] | null> = {},
): NeuModule {
  return {
    moduleId,
    type,
    x: 0.2,
    y: 0.2,
    params,
    inputs: inputs.map((input) => ({
      port: 1,
      sourceModuleId: input.moduleId,
      sourcePort: input.port,
    })),
    outputs: outputs.length === 0
      ? []
      : [{ port: 1, targets: outputs.map((target) => ({ moduleId: target.moduleId, port: target.port })) }],
  };
}

describe('R3.5d editor.json v2', () => {
  test('bindings / neuModules / effects round-trip', () => {
    const file = createWorld();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 }, { frameDurationMs: 500 });
    file.addBinding({
      keyframeId: keyframe.keyframeId,
      assetId: 'asset:audio:main',
      triggerAtMs: 1000,
    });
    file.setEffects([
      { interfaceId: 'fx-1', effectKind: 'EaseIn', params: { durationMs: 600, intensity: 1 } },
      { interfaceId: 'fx-2', effectKind: 'Shake', params: { durationMs: 300, intensity: 0.5 } },
    ]);
    file.setKeyframeEffects(keyframe.keyframeId, ['fx-1', 'fx-2']);
    file.setNeuModules([
      neu('a', 'RhythmPoint', [{ moduleId: 'b', port: 1 }], [], { timeMs: 1000 }),
      neu('b', 'AND', [{ moduleId: 'c', port: 1 }], [{ moduleId: 'a', port: 1 }]),
      neu('c', 'Audio', [], [{ moduleId: 'b', port: 1 }], {
        assetId: 'asset:audio:main', volume: 0.8,
      }),
    ]);

    const json = file.toJson() as unknown as {
      schemaVersion: number;
      bindings: unknown[];
      effects: unknown[];
      neuModules: unknown[];
      tracks: { keyframes: { keyframeId: string; effectInterfaceIds?: string[] }[] }[];
    };
    assert.equal(json.schemaVersion, 2);
    assert.equal(json.bindings.length, 1);
    assert.equal(json.effects.length, 2);
    assert.equal(json.neuModules.length, 3);
    assert.deepEqual(
      json.tracks.flatMap((track) => track.keyframes).find((item) => item.keyframeId === keyframe.keyframeId)
        ?.effectInterfaceIds,
      ['fx-1', 'fx-2'],
    );

    const loaded = EditorWorldFile.fromJson(json);
    assert.deepEqual(loaded.bindings, file.bindings);
    assert.deepEqual(loaded.effects, file.effects);
    assert.deepEqual(loaded.neuModules, file.neuModules);
    assert.deepEqual(
      loaded.getKeyframe(keyframe.keyframeId)?.keyframe.effectInterfaceIds,
      ['fx-1', 'fx-2'],
    );
  });

  test('schema v1 loads with empty runtime arrays', () => {
    const source = createWorld().toJson() as unknown as Record<string, unknown>;
    const v1 = {
      ...source,
      schemaVersion: 1,
      bindings: undefined,
      neuModules: undefined,
      effects: undefined,
    };
    const loaded = EditorWorldFile.fromJson(JSON.parse(JSON.stringify(v1)));
    assert.deepEqual(loaded.bindings, []);
    assert.deepEqual(loaded.neuModules, []);
    assert.deepEqual(loaded.effects, []);
  });

  test('rejects binding with unknown keyframe', () => {
    const file = createWorld();
    assert.throws(() => file.setBindings([{
      keyframeId: 'missing',
      assetId: 'asset:audio:main',
      triggerAtMs: 10,
    }]));
  });
});

describe('R3.5d NEU runtime', () => {
  test('AND single-input passthrough and Audio pulse', () => {
    const modules = [
      neu('rhythm', 'RhythmPoint', [{ moduleId: 'and', port: 1 }], [], { timeMs: 100 }),
      neu('and', 'AND', [{ moduleId: 'audio', port: 1 }], [{ moduleId: 'rhythm', port: 1 }]),
      neu('audio', 'Audio', [], [{ moduleId: 'and', port: 1 }], {
        assetId: 'asset:audio:main', volume: 0.8,
      }),
    ];
    const runtime = new NeuRuntime(modules);
    const signals: string[] = [];
    runtime.reset(0);
    runtime.advanceTo(50, true, (signal) => signals.push(signal.kind));
    assert.equal(signals.length, 0);
    runtime.advanceTo(150, true, (signal) => signals.push(signal.kind));
    assert.deepEqual(signals, ['Audio']);
  });

  test('Delay freezes with playhead and fires at due time', () => {
    const modules = [
      neu('rhythm', 'RhythmPoint', [{ moduleId: 'delay', port: 1 }], [], { timeMs: 100 }),
      neu('delay', 'Delay', [{ moduleId: 'audio', port: 1 }], [{ moduleId: 'rhythm', port: 1 }], {
        delayMs: 500,
      }),
      neu('audio', 'Audio', [], [{ moduleId: 'delay', port: 1 }], {
        assetId: 'asset:audio:main',
      }),
    ];
    const runtime = new NeuRuntime(modules);
    const times: number[] = [];
    runtime.reset(0);
    runtime.advanceTo(200, true, (signal) => times.push(signal.atMs));
    assert.equal(times.length, 0);
    runtime.advanceTo(400, true, (signal) => times.push(signal.atMs));
    assert.equal(times.length, 0);
    runtime.advanceTo(800, true, (signal) => times.push(signal.atMs));
    assert.deepEqual(times, [800]);
  });

  test('NOT blocks a true pulse and opens on a false input tick', () => {
    const modules = [
      neu('r1', 'RhythmPoint', [{ moduleId: 'not', port: 1 }], [], { timeMs: 100 }),
      neu('r2', 'RhythmPoint', [], [], { timeMs: 300 }),
      neu('not', 'NOT', [{ moduleId: 'audio', port: 1 }], [{ moduleId: 'r1', port: 1 }]),
      neu('audio', 'Audio', [], [{ moduleId: 'not', port: 1 }], {
        assetId: 'asset:audio:main',
      }),
    ];
    const runtime = new NeuRuntime(modules);
    const times: number[] = [];
    runtime.reset(0);
    runtime.advanceTo(150, true, (signal) => times.push(signal.atMs));
    assert.equal(times.length, 0);
    runtime.advanceTo(350, true, (signal) => times.push(signal.atMs));
    assert.deepEqual(times, [350]);
  });

  test('cycle compiles as native feedback', () => {
    const modules = [
      neu('a', 'AND', [{ moduleId: 'b', port: 1 }], [{ moduleId: 'b', port: 1 }]),
      neu('b', 'AND', [{ moduleId: 'a', port: 1 }], [{ moduleId: 'a', port: 1 }]),
    ];
    const runtime = new NeuRuntime(modules);
    assert.equal(runtime.compileError, null);
  });
});

describe('R3.5d effect compositor', () => {
  test('invert + flash white compose and strip after end', () => {
    const state = composeStageLights([
      { presets: ['Invert', 'FlashWhite'], localMs: 300, durationMs: 600, intensity: 1 },
    ]);
    assert.match(state.filter, /invert/);
    assert.equal(state.overlays.some((overlay) => overlay.kind === 'flashWhite'), true);
    const stripped = composeStageLights([]);
    assert.equal(stripped.filter, '');
    assert.deepEqual(stripped.overlays, []);
  });

  test('three simultaneous effects combine and empty list strips state', () => {
    const state = composeStageEffects([
      {
        interfaceId: 'fx-1',
        effectKind: 'ScaleUp',
        params: { durationMs: 600, scale: 1.8, intensity: 1 },
        localMs: 300,
      },
      {
        interfaceId: 'fx-2',
        effectKind: 'Shake',
        params: { durationMs: 600, intensity: 1 },
        localMs: 300,
      },
      {
        interfaceId: 'fx-3',
        effectKind: 'Wander',
        params: { durationMs: 600, intensity: 1 },
        localMs: 300,
      },
    ]);
    assert.match(state.transform, /scale/);
    assert.match(state.transform, /translate/);
    assert.notEqual(state.opacity, 0);
    assert.deepEqual(composeStageEffects([]), {
      transform: '',
      filter: '',
      opacity: 1,
      clipPath: '',
      overlays: [],
    });
  });
});
