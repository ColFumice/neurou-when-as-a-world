import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RainIntensity, RainModeState } from '../../core/world/types';
import { rainLayerModel } from '../../app/src/game/rain/rainLayerModel';

describe('R4e.2b RainLayer model', () => {
  test('null / active=false 不渲染', () => {
    assert.equal(rainLayerModel(null), null);
    assert.equal(rainLayerModel(new RainModeState({ active: false })), null);
  });

  test('active=true + Light → 3 层与正确 CSS variables', () => {
    const model = rainLayerModel(new RainModeState({
      active: true,
      intensity: RainIntensity.Light,
    }), '#607684');
    assert.ok(model);
    assert.equal(model.layers, 3);
    assert.equal(model.intensity, 'Light');
    assert.equal(model.style['--rain-density'], '0.32');
    assert.equal(model.style['--rain-streak-speed'], '0.42');
    assert.equal(model.style['--rain-opacity'], '0.3');
    assert.equal(model.style['--rain-tint-source'], 'color-mix(in srgb, #607684 38%, transparent)');
    assert.equal(model.style['--rain-tint-mode'], 'soft-light');
  });

  test('Heavy 的密度变量大于 Light', () => {
    const light = rainLayerModel(new RainModeState({ active: true, intensity: RainIntensity.Light }));
    const heavy = rainLayerModel(new RainModeState({ active: true, intensity: RainIntensity.Heavy }));
    assert.ok(light && heavy);
    assert.ok(Number(heavy.style['--rain-density']) > Number(light.style['--rain-density']));
  });

  test('prefers-reduced-motion → animation: none', () => {
    const css = readFileSync(
      resolve(__dirname, '../../../app/src/game/rain/rain-layer.css'),
      'utf8',
    );
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    assert.match(css, /animation:\s*none/);
  });
});
