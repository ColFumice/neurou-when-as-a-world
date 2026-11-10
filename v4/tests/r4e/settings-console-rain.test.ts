import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RainIntensity, RainModeState } from '../../core/world/types';
import rainSettingsView from '../../core/presentation/console/rainSettingsModel';

describe('R4e.2b SettingsConsole rain view', () => {
  test('默认关闭 → NORMAL，无 reason', () => {
    const view = rainSettingsView(false, null);
    assert.equal(view.status, 'NORMAL');
    assert.equal(view.reason, null);
  });

  test('启用且天气成功 → RAIN LIGHT / MODERATE / HEAVY', () => {
    for (const intensity of [RainIntensity.Light, RainIntensity.Moderate, RainIntensity.Heavy]) {
      const view = rainSettingsView(true, new RainModeState({
        active: true,
        intensity,
      }));
      assert.equal(view.status, `RAIN ${intensity.toUpperCase()}`);
      assert.equal(view.reason, null);
    }
  });

  test('天气失败 → DEGRADED + 原因', () => {
    const view = rainSettingsView(true, new RainModeState({
      active: false,
      degradedReason: 'WeatherUnavailable',
    }));
    assert.equal(view.status, 'DEGRADED');
    assert.equal(view.reason, 'WeatherUnavailable');
  });

  test('已启用但无雨 → NORMAL', () => {
    const view = rainSettingsView(true, new RainModeState({ active: false }));
    assert.equal(view.status, 'NORMAL');
  });
});
