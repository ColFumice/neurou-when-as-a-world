import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import {
  RandomPreviewMode,
  RandomSeed,
} from '../../core/eventgraph/RandomMode';
import type { GameSinkEvent } from '../../app/src/game/neuRuntime';
import { GameNeuRuntime } from '../../app/src/game/neuRuntime';
import {
  GamePlaybackSink,
  GAME_AUDIO_DEDUPE_MS,
} from '../../app/src/game/gameSignalSink';
import { advanceGameFrame } from '../../app/src/game/gameFrame';
import {
  neuChartFromEditor,
  neuChartHudWarning,
  NO_NEU_GRAPH_WARNING,
} from '../../app/src/game/neuChart';
import { note, snapshot } from '../r4/helpers';
import { neu, rhythm } from './helpers';

function makeAudio(): {
  readonly plays: { assetId: string; volume: number }[];
  readonly port: { play(assetId: string, volume: number): boolean };
} {
  const plays: { assetId: string; volume: number }[] = [];
  return {
    plays,
    port: {
      play: (assetId, volume) => {
        plays.push({ assetId, volume });
        return true;
      },
    },
  };
}

function audioEvent(
  origin: 'Binding' | 'NEU',
  assetId: string,
  atMs: number,
): GameSinkEvent {
  return {
    origin,
    signal: {
      kind: 'Audio',
      moduleId: origin === 'Binding' ? 'binding:kf-1' : 'neu-audio',
      assetId,
      volume: 0.8,
      atMs,
    },
  };
}

describe('R4b.2 game NEU integration', () => {
  test('Binding + NEU 同 tick（±16ms）只播一次，Binding 优先', () => {
    const audio = makeAudio();
    const sink = new GamePlaybackSink({ audio: audio.port });
    const runtime = new GameNeuRuntime({
      modules: [
        rhythm('r', 100, ['audio']),
        neu('audio', 'Audio', [], ['r'], { assetId: 'asset:audio:main' }),
      ],
      effects: [],
      bindings: [
        { keyframeId: 'kf-1', assetId: 'asset:audio:main', triggerAtMs: 100 },
      ],
      seed: new RandomSeed(7),
      mode: RandomPreviewMode.Live,
      randomValue: () => 0.5,
      sink,
    });

    runtime.reset(0);
    // NEU 的 Audio 在 108ms 发射，与 100ms 的 binding 处于同一 ±16ms tick。
    runtime.advanceTo(100 + GAME_AUDIO_DEDUPE_MS - 8, true);

    assert.equal(audio.plays.length, 1);
    assert.equal(audio.plays[0]?.assetId, 'asset:audio:main');
    assert.equal(sink.lastTriggerOrigin, 'Binding');
    assert.equal(sink.audioTraces[0]?.origin, 'Binding');
    runtime.dispose();
    sink.dispose();
  });

  test('Sink 自身按 ±16ms 兜底去重，窗口外恢复播放', () => {
    const audio = makeAudio();
    const sink = new GamePlaybackSink({ audio: audio.port });

    sink.emit(audioEvent('Binding', 'asset:audio:main', 100));
    sink.emit(audioEvent('NEU', 'asset:audio:main', 108));
    assert.equal(audio.plays.length, 1);
    assert.equal(sink.droppedAudioCount, 1);
    assert.equal(sink.lastTriggerOrigin, 'Binding');

    sink.emit(audioEvent('NEU', 'asset:audio:main', 100 + GAME_AUDIO_DEDUPE_MS + 1));
    assert.equal(audio.plays.length, 2);
    assert.equal(sink.lastTriggerOrigin, 'NEU');
    sink.dispose();
  });

  test('NeuRuntime 抛错不阻断 snapshot.advance，也不影响 R4a 判定', () => {
    const session = snapshot([
      note({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 }),
    ]);
    let calls = 0;
    const throwing = {
      advanceTo: (): void => {
        calls += 1;
        throw new Error('NEU boom');
      },
    };

    const frame = advanceGameFrame(
      { snapshot: session, neuRuntime: throwing },
      2301,
      true,
    );

    assert.equal(calls, 1);
    assert.ok(frame.neuError instanceof Error);
    assert.equal(frame.neuError.message, 'NEU boom');
    assert.equal(session.counts.miss, 1);
    assert.equal(session.notes[0]?.judgement, 'Miss');
    assert.equal(session.revision > 0, true);
  });

  test('空 NEU 图：返回空数组、HUD 提示无 NEU 图、游戏帧照常推进', () => {
    const empty = neuChartFromEditor(null);
    assert.equal(empty.neuModules.length, 0);
    assert.equal(empty.neuEffects.length, 0);
    assert.equal(empty.neuBindings.length, 0);
    assert.equal(empty.editorSeed, 0);
    assert.equal(neuChartHudWarning(empty), NO_NEU_GRAPH_WARNING);

    const file = EditorWorldFile.create({
      documentId: 'r4b2-empty',
      chartId: 'chart-r4b2',
      seed: 42,
      durationMs: 8000,
    });
    const fromEditor = neuChartFromEditor(file);
    assert.deepEqual(fromEditor.neuModules, []);
    assert.equal(fromEditor.editorSeed, 42);
    assert.equal(neuChartHudWarning(fromEditor), NO_NEU_GRAPH_WARNING);

    const audio = makeAudio();
    const sink = new GamePlaybackSink({ audio: audio.port });
    const runtime = new GameNeuRuntime({
      modules: fromEditor.neuModules,
      effects: fromEditor.neuEffects,
      bindings: fromEditor.neuBindings,
      seed: new RandomSeed(fromEditor.editorSeed),
      mode: RandomPreviewMode.Live,
      randomValue: () => 0.5,
      sink,
    });
    const session = snapshot([
      note({ timeMs: 0, chartLayerIndex: 2, gridCellId: 1 }),
    ]);
    runtime.reset(0);
    const frame = advanceGameFrame(
      { snapshot: session, neuRuntime: runtime },
      1000,
      true,
    );

    assert.equal(frame.neuError, null);
    assert.equal(audio.plays.length, 0);
    assert.equal(session.counts.miss, 1);
    runtime.dispose();
    sink.dispose();
  });

  test('视觉 sink：Effect / Light / Resource / Subtitle / CycleWarning 落位', () => {
    const audio = makeAudio();
    const warned: string[] = [];
    const sink = new GamePlaybackSink({
      audio: audio.port,
      modules: [
        neu('fx', 'Effect'),
        neu('light', 'Light'),
        neu('image', 'Image'),
        neu('subtitle', 'Subtitle'),
      ],
      effects: [
        { interfaceId: 'fx-1', effectKind: 'EaseIn', params: { durationMs: 600 } },
      ],
      resolveAsset: (assetId) => (
        assetId === 'asset:image:test' ? 'blob:neurou-test' : null
      ),
      onCycleWarning: (warning) => warned.push(warning.moduleId),
    });

    sink.emit({
      origin: 'NEU',
      signal: { kind: 'Effect', moduleId: 'fx', interfaceId: 'fx-1', atMs: 100 },
    });
    sink.emit({
      origin: 'NEU',
      signal: {
        kind: 'Light',
        moduleId: 'light',
        presets: ['FlashWhite'],
        targetAssetId: null,
        mode: 'FullScreen',
        atMs: 100,
        durationMs: 600,
      },
    });
    sink.emit({
      origin: 'NEU',
      signal: {
        kind: 'Resource',
        moduleId: 'image',
        resourceType: 'Image',
        assetId: 'asset:image:test',
        atMs: 100,
      },
    });
    sink.emit({
      origin: 'NEU',
      signal: { kind: 'Subtitle', moduleId: 'subtitle', text: 'NEU SUB', atMs: 100 },
    });
    sink.emit({
      origin: 'NEU',
      warning: { moduleId: 'loop', atMs: 100, limit: 100, reason: 'GraphCycle' },
    });

    assert.equal(sink.activeEffectsAt(150).length, 1);
    assert.equal(sink.activeEffectsAt(800).length, 0);
    assert.equal(sink.activeLightsAt(150)[0]?.presets[0], 'FlashWhite');
    assert.equal(sink.activeResourcesAt(150)[0]?.src, 'blob:neurou-test');
    assert.equal(sink.currentSubtitle(150)?.text, 'NEU SUB');
    assert.deepEqual(warned, ['loop']);
    assert.equal(sink.cycleWarnings.length, 1);
    sink.dispose();
  });
});
