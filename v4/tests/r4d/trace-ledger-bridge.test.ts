import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TraceOrigin, TraceTier } from '../../core/trace/types';
import { VisibilityTransitionReason } from '../../core/trace/visibility';
import { ChartPremiere } from '../../core/chart/ChartPremiere';
import { ChartPremiereDirector } from '../../core/director/ChartPremiereDirector';
import { TraceNarrativeCollector } from '../../app/src/game/narrative/TraceNarrativeCollector';
import type { TraceRuntimeEvent } from '../../app/src/game/traceRuntime';
import type { GameTracePlacement } from '../../app/src/game/stageData';

function placement(
  traceId: string,
  tier: TraceTier = TraceTier.Common,
  origin: TraceOrigin = TraceOrigin.Normal,
): GameTracePlacement {
  return {
    traceId,
    tier,
    origin,
    beatTimeMs: 1000,
    rect: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    layerIndex: 1,
    parallaxFactor: 1,
    label: traceId,
  };
}

function event(
  kind: 'Revealed' | 'Touched' | 'Concealed',
  traceId: string,
  reason: VisibilityTransitionReason = VisibilityTransitionReason.FrameAligned,
): TraceRuntimeEvent {
  return { kind, traceId, atMs: 1000, reason, touchCount: 1 };
}

describe('R4d.4 Trace → Narrative bridge', () => {
  test('TraceEventSink 聚合到 TraceNarrativeStats，不产生逐痕事件', () => {
    const diagnostics: string[] = [];
    const collector = new TraceNarrativeCollector([
      placement('common'),
      placement('deep', TraceTier.Deep),
      placement('anomalous', TraceTier.Common, TraceOrigin.Anomalous),
      placement('rain', TraceTier.Rain),
    ], (message) => diagnostics.push(message));

    collector.emit(event('Revealed', 'common'));
    collector.emit(event('Revealed', 'common'));
    collector.emit(event('Revealed', 'deep'));
    collector.emit(event('Revealed', 'anomalous'));
    collector.emit(event('Revealed', 'rain'));
    collector.emit(event('Touched', 'common'));
    collector.emit(event('Touched', 'deep'));
    collector.emit(event('Concealed', 'common', VisibilityTransitionReason.FrameLost));
    collector.emit(event('Concealed', 'deep', VisibilityTransitionReason.ExitPerception));

    assert.deepEqual(collector.snapshot(), {
      tracesTotal: 4,
      tracesRevealed: 4,
      tracesTouched: 2,
      deepRevealed: 1,
      anomalousRevealed: 1,
      rainRevealed: 1,
      frameLost: 1,
      exitPerception: 1,
    });
    assert.deepEqual(diagnostics, []);

    const premiere = new ChartPremiere({
      chartId: 'chart-w1',
      source: 'editor',
      completed: true,
      totalNotes: 10,
      perfect: 10,
      good: 0,
      miss: 0,
      maxCombo: 10,
      tracesTotal: 4,
      tracesRevealed: 4,
      tracesTouched: 2,
      deepRevealed: 1,
      anomalousRevealed: 1,
      rainRevealed: 1,
      frameLost: 1,
    });
    const vector = ChartPremiereDirector.deriveVector(premiere);
    assert.equal(vector.length, 20);
    assert.equal(vector[8], 76); // Trace
    assert.equal(vector[16], 44); // TruthLevel
  });

  test('采集异常被吞掉并转诊断，不打断后续事件', () => {
    const diagnostics: string[] = [];
    const collector = new TraceNarrativeCollector([placement('trace-1')], (message) => {
      diagnostics.push(message);
    });
    const bad = {
      get kind(): never {
        throw new Error('bad trace event');
      },
    } as unknown as TraceRuntimeEvent;

    assert.doesNotThrow(() => collector.emit(bad));
    assert.equal(diagnostics.length, 1);
    assert.match(collector.diagnostic ?? '', /Trace 采集异常/);

    collector.emit(event('Revealed', 'trace-1'));
    assert.equal(collector.snapshot().tracesRevealed, 1);
  });

  test('reset 清空统计但保留 placement 总数', () => {
    const collector = new TraceNarrativeCollector([
      placement('a'),
      placement('b', TraceTier.Deep),
    ]);
    collector.emit(event('Revealed', 'a'));
    collector.emit(event('Concealed', 'a', VisibilityTransitionReason.FrameLost));
    collector.reset();
    assert.deepEqual(collector.snapshot(), {
      tracesTotal: 2,
      tracesRevealed: 0,
      tracesTouched: 0,
      deepRevealed: 0,
      anomalousRevealed: 0,
      rainRevealed: 0,
      frameLost: 0,
      exitPerception: 0,
    });
  });
});
