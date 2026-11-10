import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GameNeuRuntime } from '../../app/src/game/neuRuntime';
import type { GameSinkEvent, GameSignalSink } from '../../app/src/game/neuRuntime';
import {
  RandomPreviewMode,
  RandomSeed,
} from '../../core/eventgraph/RandomMode';
import { neu, rhythm } from './helpers';

function makeSink(): { sink: GameSignalSink; events: GameSinkEvent[] } {
  const events: GameSinkEvent[] = [];
  return {
    sink: { emit: (event) => events.push(event) },
    events,
  };
}

function makeGraph() {
  return [
    rhythm('r', 100, ['audioMain', 'audioOther', 'image', 'subtitle', 'effect', 'light']),
    neu('audioMain', 'Audio', [], ['r'], { assetId: 'asset:audio:main', volume: 0.5 }),
    neu('audioOther', 'Audio', [], ['r'], { assetId: 'asset:audio:other', volume: 0.5 }),
    neu('image', 'Image', [], ['r'], { assetId: 'asset:image:test' }),
    neu('subtitle', 'Subtitle', [], ['r'], { text: 'NEU SUBTITLE' }),
    neu('effect', 'Effect', [], ['r'], { interfaceId: 'fx-1' }),
    neu('light', 'Light', [], ['r'], {
      presets: ['Invert'], mode: 'FullScreen', durationMs: 600,
    }),
  ];
}

describe('R4b GameNeuRuntime 骨架 / sink', () => {
  test('Audio / Resource / Subtitle / Effect / Light 投递', () => {
    const { sink, events } = makeSink();
    const runtime = new GameNeuRuntime({
      modules: makeGraph(),
      effects: [{ interfaceId: 'fx-1', effectKind: 'EaseIn', params: { durationMs: 300 } }],
      bindings: [],
      seed: new RandomSeed(1),
      mode: RandomPreviewMode.Seeded,
      sink,
    });
    runtime.reset(0);
    runtime.advanceTo(100, true);
    const kinds = events.flatMap((event) => (
      'signal' in event ? [event.signal.kind] : ['Warning']
    ));
    assert.ok(kinds.includes('Audio'));
    assert.ok(kinds.includes('Resource'));
    assert.ok(kinds.includes('Subtitle'));
    assert.ok(kinds.includes('Effect'));
    assert.ok(kinds.includes('Light'));
    runtime.dispose();
  });

  test('binding 优先；同一 asset + 同 tick 的 NEU Audio 去重', () => {
    const { sink, events } = makeSink();
    const runtime = new GameNeuRuntime({
      modules: makeGraph(),
      effects: [],
      bindings: [{ keyframeId: 'kf-1', assetId: 'asset:audio:main', triggerAtMs: 100 }],
      seed: new RandomSeed(1),
      mode: RandomPreviewMode.Seeded,
      sink,
    });
    runtime.reset(0);
    runtime.advanceTo(100, true);
    const mainAudio = events.filter((event) => (
      'signal' in event
      && event.signal.kind === 'Audio'
      && event.signal.assetId === 'asset:audio:main'
    ));
    assert.equal(mainAudio.length, 1);
    assert.equal(mainAudio[0]?.origin, 'Binding');
    runtime.dispose();
  });

  test('暂停时不投递', () => {
    const { sink, events } = makeSink();
    const runtime = new GameNeuRuntime({
      modules: makeGraph(),
      effects: [],
      bindings: [],
      seed: new RandomSeed(1),
      mode: RandomPreviewMode.Seeded,
      sink,
    });
    runtime.reset(0);
    runtime.advanceTo(100, false);
    assert.equal(events.length, 0);
    runtime.dispose();
  });
});
