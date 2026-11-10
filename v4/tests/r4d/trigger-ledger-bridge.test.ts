import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ParallaxLayer } from '../../core/world/trigger';
import { ChartPremiere } from '../../core/chart/ChartPremiere';
import { ChartPremiereDirector } from '../../core/director/ChartPremiereDirector';
import { TriggerNarrativeCollector } from '../../app/src/game/narrative/TriggerNarrativeCollector';
import type { TriggerSink } from '../../app/src/game/triggerRuntime';

const BASE = {
  triggerId: 'trig-1',
  eventSignalId: 'sig-1',
  atMs: 1000,
  occupancy: 0.5,
};

describe('R4d.4 Trigger → Narrative bridge', () => {
  test('五类信号按种类去重，delegate 仍收到 HUD 信号', () => {
    const seen: string[] = [];
    const delegate: TriggerSink = {
      enter: (signal) => seen.push(signal.kind),
      exit: (signal) => seen.push(signal.kind),
      dwell: (signal) => seen.push(signal.kind),
      occupancy: (signal) => seen.push(signal.kind),
      parallax: (signal) => seen.push(signal.kind),
    };
    const collector = new TriggerNarrativeCollector(delegate);

    collector.enter({ ...BASE, kind: 'TriggerEnter' });
    collector.enter({ ...BASE, kind: 'TriggerEnter' });
    collector.exit({ ...BASE, kind: 'TriggerExit' });
    collector.dwell({ ...BASE, kind: 'TriggerDwell', dwellMs: 200 });
    collector.occupancy({ ...BASE, kind: 'TriggerOccupancy', threshold: 0.3 });
    collector.parallax({
      ...BASE,
      kind: 'TriggerParallax',
      layer: ParallaxLayer.Foreground,
      factor: 1,
      deltaX: 0.1,
      direction: 'Right',
    });

    assert.equal(seen.length, 6);
    assert.deepEqual(collector.snapshot(), {
      triggerEnter: 1,
      triggerExit: 1,
      triggerDwell: 1,
      triggerOccupancy: 1,
      triggerParallax: 1,
    });

    const premiere = new ChartPremiere({
      chartId: 'chart-w1',
      source: 'editor',
      completed: true,
      totalNotes: 10,
      perfect: 10,
      good: 0,
      miss: 0,
      maxCombo: 10,
      triggerEnter: 1,
      triggerExit: 1,
      triggerDwell: 1,
      triggerOccupancy: 1,
      triggerParallax: 1,
    });
    const vector = ChartPremiereDirector.deriveVector(premiere);
    assert.equal(vector[6], 50); // Initial
    assert.equal(vector[17], 80); // NarrativeTime
    assert.equal(vector[18], 40); // InfluenceRadius
  });

  test('delegate 异常被吞掉并转诊断', () => {
    const diagnostics: string[] = [];
    const delegate: TriggerSink = {
      enter: () => {
        throw new Error('hud sink boom');
      },
      exit: () => undefined,
      dwell: () => undefined,
      occupancy: () => undefined,
      parallax: () => undefined,
    };
    const collector = new TriggerNarrativeCollector(delegate, (message) => {
      diagnostics.push(message);
    });
    assert.doesNotThrow(() => collector.enter({ ...BASE, kind: 'TriggerEnter' }));
    assert.equal(diagnostics.length, 1);
    assert.match(collector.diagnostic ?? '', /Trigger 采集异常/);
  });

  test('reset 清空五类种类', () => {
    const delegate: TriggerSink = {
      enter: () => undefined,
      exit: () => undefined,
      dwell: () => undefined,
      occupancy: () => undefined,
      parallax: () => undefined,
    };
    const collector = new TriggerNarrativeCollector(delegate);
    collector.enter({ ...BASE, kind: 'TriggerEnter' });
    collector.reset();
    assert.deepEqual(collector.snapshot(), {
      triggerEnter: 0,
      triggerExit: 0,
      triggerDwell: 0,
      triggerOccupancy: 0,
      triggerParallax: 0,
    });
  });
});
