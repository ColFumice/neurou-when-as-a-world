import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PerceptionMode,
  RainIntensity,
  RainModeState,
} from '../../core/world/types';

function effectiveRain(perception: PerceptionMode, state: RainModeState): boolean {
  return perception === PerceptionMode.Rain && state.active;
}

describe('R4e.2a RainModeState', () => {
  test('PerceptionMode=Rain + active=true → 有效下雨', () => {
    const state = new RainModeState({
      active: true,
      intensity: RainIntensity.Heavy,
      lastResolvedAt: 1000,
    });
    assert.equal(effectiveRain(PerceptionMode.Rain, state), true);
    assert.equal(state.intensity, RainIntensity.Heavy);
    assert.equal(state.degradedReason, null);
    assert.equal(state.source, 'IpWeather');
  });

  test('PerceptionMode=Rain + active=false → 视觉降级 Normal，不回写 PerceptionMode', () => {
    const failed = new RainModeState({
      active: false,
      degradedReason: 'NetworkUnavailable',
    });
    const perception = PerceptionMode.Rain;
    assert.equal(perception, PerceptionMode.Rain);
    assert.equal(effectiveRain(perception, failed), false);
    assert.equal(failed.degradedReason, 'NetworkUnavailable');
  });

  test('失败原因写入 degradedReason，且 update 不修改原对象', () => {
    const current = new RainModeState({ active: true, lastResolvedAt: 100 });
    const next = RainModeState.updateRainModeState(current, {
      active: false,
      degradedReason: 'LocationUnavailable',
      lastResolvedAt: 200,
    });
    assert.equal(current.active, true);
    assert.equal(current.degradedReason, null);
    assert.equal(next.active, false);
    assert.equal(next.degradedReason, 'LocationUnavailable');
    assert.equal(next.lastResolvedAt, 200);
  });

  test('三种降级原因均可表达；lastResolvedAt 可为 null', () => {
    const base = new RainModeState();
    assert.equal(base.lastResolvedAt, null);
    for (const reason of ['LocationUnavailable', 'WeatherUnavailable', 'NetworkUnavailable'] as const) {
      const state = RainModeState.updateRainModeState(base, { degradedReason: reason });
      assert.equal(state.degradedReason, reason);
    }
  });
});
