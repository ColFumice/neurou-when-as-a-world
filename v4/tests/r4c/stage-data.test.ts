import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTracesSidecar,
  parseTriggersSidecar,
} from '../../app/src/game/stageData';
import { ParallaxLayer } from '../../core/world/trigger';
import { TraceOrigin, TraceTier } from '../../core/trace/types';

const RECT = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 };

function traceDoc(traces: readonly unknown[]): unknown {
  return { schemaVersion: 1, chartId: 'chart-w1', traces };
}

function triggerDoc(triggers: readonly unknown[]): unknown {
  return { schemaVersion: 1, chartId: 'chart-w1', triggers };
}

function validTrace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    traceId: 'trace-1',
    tier: 'Common',
    origin: 'Normal',
    beatTimeMs: 1000,
    rect: RECT,
    ...overrides,
  };
}

function validTrigger(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    triggerId: 'trig-1',
    eventSignalId: 'sig-1',
    region: RECT,
    ...overrides,
  };
}

describe('R4c sidecar parser', () => {
  test('traces：合法文档 + 默认值', () => {
    const result = parseTracesSidecar(traceDoc([
      validTrace(),
      validTrace({ traceId: 'trace-2', tier: 'Deep', origin: 'Echo', label: 'second' }),
    ]), 'chart-w1');
    assert.equal(result.warnings.length, 0);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.traceId, 'trace-1');
    assert.equal(result.items[0]?.tier, TraceTier.Common);
    assert.equal(result.items[0]?.origin, TraceOrigin.Normal);
    assert.equal(result.items[0]?.layerIndex, 1);
    assert.equal(result.items[0]?.parallaxFactor, 1);
    assert.equal(result.items[0]?.label, '');
    assert.equal(result.items[1]?.tier, TraceTier.Deep);
    assert.equal(result.items[1]?.origin, TraceOrigin.Echo);
    assert.equal(result.items[1]?.label, 'second');
  });

  test('traces：重复 ID / 非法枚举 / 越界坐标 / chartId 不匹配', () => {
    const duplicate = parseTracesSidecar(traceDoc([
      validTrace(),
      validTrace(),
    ]), 'chart-w1');
    assert.equal(duplicate.items.length, 0);
    assert.match(duplicate.warnings[0] ?? '', /duplicate traceId/);

    const tier = parseTracesSidecar(traceDoc([
      validTrace({ tier: 'Unknown' }),
    ]), 'chart-w1');
    assert.equal(tier.items.length, 0);
    assert.match(tier.warnings[0] ?? '', /tier/);

    const origin = parseTracesSidecar(traceDoc([
      validTrace({ origin: 'Side' }),
    ]), 'chart-w1');
    assert.equal(origin.items.length, 0);
    assert.match(origin.warnings[0] ?? '', /origin/);

    const rect = parseTracesSidecar(traceDoc([
      validTrace({ rect: { x: 0.9, y: 0.4, width: 0.2, height: 0.2 } }),
    ]), 'chart-w1');
    assert.equal(rect.items.length, 0);
    assert.match(rect.warnings[0] ?? '', /within 0\.\.1/);

    const chart = parseTracesSidecar(traceDoc([validTrace()]), 'chart-other');
    assert.equal(chart.items.length, 0);
    assert.match(chart.warnings[0] ?? '', /does not match/);
  });

  test('traces：未知字段 / 缺字段 / 非对象都安全降级', () => {
    const extra = parseTracesSidecar(traceDoc([
      validTrace({ extra: true }),
    ]), 'chart-w1');
    assert.equal(extra.items.length, 0);
    assert.match(extra.warnings[0] ?? '', /unknown field/);

    const missing = parseTracesSidecar(traceDoc([
      { ...validTrace(), beatTimeMs: undefined },
    ]), 'chart-w1');
    assert.equal(missing.items.length, 0);
    assert.match(missing.warnings[0] ?? '', /beatTimeMs/);

    const broken = parseTracesSidecar(null, 'chart-w1');
    assert.deepEqual(broken.items, []);
    assert.equal(broken.warnings.length, 1);
  });

  test('triggers：合法文档与默认值', () => {
    const result = parseTriggersSidecar(triggerDoc([
      validTrigger(),
      validTrigger({
        triggerId: 'trig-2',
        eventSignalId: 'sig-2',
        dwellMs: 500,
        occupancyThreshold: 0.5,
        occupancyIntervalMs: 100,
        parallaxLayer: 'Foreground',
        parallaxFactor: 1.6,
        parallaxStep: 0.02,
      }),
    ]), 'chart-w1');
    assert.equal(result.warnings.length, 0);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.dwellMs, 0);
    assert.equal(result.items[0]?.occupancyThreshold, null);
    assert.equal(result.items[0]?.occupancyIntervalMs, 250);
    assert.equal(result.items[0]?.parallaxLayer, null);
    assert.equal(result.items[0]?.parallaxFactor, 1);
    assert.equal(result.items[0]?.parallaxStep, 0.01);
    assert.equal(result.items[1]?.dwellMs, 500);
    assert.equal(result.items[1]?.occupancyThreshold, 0.5);
    assert.equal(result.items[1]?.parallaxLayer, ParallaxLayer.Foreground);
    assert.equal(result.items[1]?.parallaxFactor, 1.6);
  });

  test('triggers：重复 ID / 非法阈值 / 非法 layer / 未知字段', () => {
    const duplicate = parseTriggersSidecar(triggerDoc([
      validTrigger(),
      validTrigger(),
    ]), 'chart-w1');
    assert.equal(duplicate.items.length, 0);
    assert.match(duplicate.warnings[0] ?? '', /duplicate triggerId/);

    const threshold = parseTriggersSidecar(triggerDoc([
      validTrigger({ occupancyThreshold: 1.5 }),
    ]), 'chart-w1');
    assert.equal(threshold.items.length, 0);
    assert.match(threshold.warnings[0] ?? '', /0\.\.1/);

    const layer = parseTriggersSidecar(triggerDoc([
      validTrigger({ parallaxLayer: 'Side' }),
    ]), 'chart-w1');
    assert.equal(layer.items.length, 0);
    assert.match(layer.warnings[0] ?? '', /Foreground/);

    const extra = parseTriggersSidecar(triggerDoc([
      validTrigger({ extra: 1 }),
    ]), 'chart-w1');
    assert.equal(extra.items.length, 0);
    assert.match(extra.warnings[0] ?? '', /unknown field/);
  });

  test('triggers：缺失 / 非对象 / chartId 不匹配', () => {
    const missing = parseTriggersSidecar({ schemaVersion: 1, chartId: 'chart-w1' }, 'chart-w1');
    assert.equal(missing.items.length, 0);
    assert.match(missing.warnings[0] ?? '', /missing field triggers/);

    const broken = parseTriggersSidecar(undefined, 'chart-w1');
    assert.equal(broken.items.length, 0);
    assert.equal(broken.warnings.length, 1);

    const chart = parseTriggersSidecar(triggerDoc([validTrigger()]), 'chart-other');
    assert.equal(chart.items.length, 0);
    assert.match(chart.warnings[0] ?? '', /does not match/);
  });
});
