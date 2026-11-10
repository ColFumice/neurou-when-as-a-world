import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartPremiere } from '../../core/chart/ChartPremiere';
import { ChartPremiereDirector } from '../../core/director/ChartPremiereDirector';
import { NeuNarrativeCollector } from '../../app/src/game/narrative/NeuNarrativeCollector';
import type { GameSinkEvent, GameSignalSink } from '../../app/src/game/neuRuntime';

function sink(): {
  readonly delegate: GameSignalSink;
  readonly received: GameSinkEvent[];
} {
  const received: GameSinkEvent[] = [];
  return {
    received,
    delegate: {
      emit: (event) => {
        received.push(event);
      },
    },
  };
}

function neuSignal(
  kind: 'Audio' | 'Effect' | 'Light' | 'Resource' | 'Subtitle',
  moduleId: string,
): GameSinkEvent {
  if (kind === 'Audio') {
    return {
      origin: 'NEU',
      signal: { kind, moduleId, assetId: 'asset:audio:1', volume: 1, atMs: 10 },
    };
  }
  if (kind === 'Effect') {
    return {
      origin: 'NEU',
      signal: { kind, moduleId, interfaceId: 'effect-1', atMs: 10 },
    };
  }
  if (kind === 'Light') {
    return {
      origin: 'NEU',
      signal: {
        kind,
        moduleId,
        presets: ['Warm'],
        targetAssetId: null,
        mode: 'FullScreen',
        atMs: 10,
        durationMs: 600,
      },
    };
  }
  if (kind === 'Resource') {
    return {
      origin: 'NEU',
      signal: {
        kind,
        moduleId,
        resourceType: 'Image',
        assetId: null,
        atMs: 10,
      },
    };
  }
  return {
    origin: 'NEU',
    signal: { kind, moduleId, text: 'secret subtitle text', atMs: 10 },
  };
}

describe('R4d.4 NEU → Narrative bridge', () => {
  test('先转发 delegate，再按 kind + moduleId 去重采集', () => {
    const target = sink();
    const diagnostics: string[] = [];
    const collector = new NeuNarrativeCollector(target.delegate, (message) => {
      diagnostics.push(message);
    });

    collector.emit(neuSignal('Audio', 'audio-1'));
    collector.emit(neuSignal('Audio', 'audio-1'));
    collector.emit(neuSignal('Effect', 'effect-1'));
    collector.emit(neuSignal('Light', 'light-1'));
    collector.emit(neuSignal('Resource', 'resource-1'));
    collector.emit(neuSignal('Subtitle', 'subtitle-1'));
    collector.emit({
      origin: 'Binding',
      signal: { kind: 'Audio', moduleId: 'binding:keyframe-1', assetId: 'a', volume: 1, atMs: 10 },
    });
    collector.emit({
      origin: 'NEU',
      warning: { moduleId: 'loop-1', atMs: 10, limit: 100, reason: 'LoopLimit' },
    });

    assert.equal(target.received.length, 8);
    assert.deepEqual(collector.snapshot(), {
      neuAudioModules: 1,
      neuEffectModules: 1,
      neuLightModules: 1,
      neuResourceModules: 1,
      neuSubtitleModules: 1,
      bindingAudioCount: 1,
    });
    assert.deepEqual(diagnostics, []);
  });

  test('NEU 统计进入 20 维；Subtitle 文本不进入统计', () => {
    const target = sink();
    const collector = new NeuNarrativeCollector(target.delegate);
    collector.emit(neuSignal('Audio', 'audio-1'));
    collector.emit(neuSignal('Effect', 'effect-1'));
    collector.emit(neuSignal('Light', 'light-1'));
    collector.emit(neuSignal('Resource', 'resource-1'));
    collector.emit(neuSignal('Subtitle', 'subtitle-1'));

    const stats = collector.snapshot();
    assert.equal('text' in stats, false);
    const premiere = new ChartPremiere({
      chartId: 'chart-w1',
      source: 'editor',
      completed: true,
      totalNotes: 10,
      perfect: 10,
      good: 0,
      miss: 0,
      maxCombo: 10,
      neuAudioModules: stats.neuAudioModules,
      neuEffectModules: stats.neuEffectModules,
      neuLightModules: stats.neuLightModules,
      neuResourceModules: stats.neuResourceModules,
      neuSubtitleModules: stats.neuSubtitleModules,
    });
    const vector = ChartPremiereDirector.deriveVector(premiere);
    assert.equal(vector[6], 30); // Initial
    assert.equal(vector[9], 68); // Highlight
    assert.equal(vector[17], 64); // NarrativeTime
  });

  test('采集异常被吞掉并转诊断，delegate 仍先收到事件', () => {
    const target = sink();
    const diagnostics: string[] = [];
    const collector = new NeuNarrativeCollector(target.delegate, (message) => {
      diagnostics.push(message);
    });
    const bad = {
      origin: 'NEU',
      get signal(): never {
        throw new Error('bad NEU event');
      },
    } as unknown as GameSinkEvent;

    assert.doesNotThrow(() => collector.emit(bad));
    assert.equal(target.received.length, 1);
    assert.equal(diagnostics.length, 1);
    assert.match(collector.diagnostic ?? '', /NEU 采集异常/);
  });

  test('reset 清空 NEU 与 Binding 计数', () => {
    const target = sink();
    const collector = new NeuNarrativeCollector(target.delegate);
    collector.emit(neuSignal('Audio', 'audio-1'));
    collector.emit({
      origin: 'Binding',
      signal: { kind: 'Audio', moduleId: 'binding:1', assetId: 'a', volume: 1, atMs: 10 },
    });
    collector.reset();
    assert.deepEqual(collector.snapshot(), {
      neuAudioModules: 0,
      neuEffectModules: 0,
      neuLightModules: 0,
      neuResourceModules: 0,
      neuSubtitleModules: 0,
      bindingAudioCount: 0,
    });
  });
});
