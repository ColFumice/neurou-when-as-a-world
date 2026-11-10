import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RainIntensity, RainModeState } from '../../core/world/types';

describe('R4e.2a rain intensity mapping', () => {
  test('晴天 → null', () => {
    assert.equal(RainModeState.mapRainIntensity(0, 0), null);
    assert.equal(RainModeState.mapRainIntensity(1, 0), null);
  });

  test('drizzle 0.5mm/h → Light', () => {
    assert.equal(RainModeState.mapRainIntensity(51, 0.5), RainIntensity.Light);
    assert.equal(RainModeState.mapRainIntensity(53, 0.5), RainIntensity.Light);
  });

  test('moderate 3mm/h → Moderate', () => {
    assert.equal(RainModeState.mapRainIntensity(61, 3), RainIntensity.Moderate);
    assert.equal(RainModeState.mapRainIntensity(80, 3), RainIntensity.Moderate);
  });

  test('heavy 10mm/h → Heavy', () => {
    assert.equal(RainModeState.mapRainIntensity(65, 10), RainIntensity.Heavy);
    assert.equal(RainModeState.mapRainIntensity(95, 10), RainIntensity.Heavy);
  });

  test('snow → null（不进入 Rain）', () => {
    assert.equal(RainModeState.mapRainIntensity(71, 2), null);
    assert.equal(RainModeState.mapRainIntensity(86, 10), null);
  });

  test('雨码但降水为 0 仍可映射 Light；负降水非法', () => {
    assert.equal(RainModeState.mapRainIntensity(61, 0), RainIntensity.Light);
    assert.equal(RainModeState.mapRainIntensity(61, -1), null);
    assert.equal(RainModeState.mapRainIntensity(null, 0), null);
  });
});
