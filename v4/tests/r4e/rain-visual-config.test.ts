import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RainVisualConfig } from '../../core/presentation/rain/RainVisualConfig';
import { NoteLogoGlow } from '../../core/presentation/rain/NoteLogoGlow';
import { RainTintSource } from '../../core/presentation/rain/RainTintSource';

describe('R4e.2a rain visual config', () => {
  test('三种 intensity 的 density / opacity / glowStrength 有差异', () => {
    const light = RainVisualConfig.forIntensity('Light');
    const moderate = RainVisualConfig.forIntensity('Moderate');
    const heavy = RainVisualConfig.forIntensity('Heavy');
    assert.ok(light.density < moderate.density);
    assert.ok(moderate.density < heavy.density);
    assert.ok(light.opacity < moderate.opacity);
    assert.ok(moderate.opacity < heavy.opacity);
    assert.ok(light.glowStrength < moderate.glowStrength);
    assert.ok(moderate.glowStrength < heavy.glowStrength);
  });

  test('输出稳定 CSS variables', () => {
    const variables = RainVisualConfig.forIntensity('Moderate').cssVariables;
    assert.equal(variables['--rain-density'], '0.62');
    assert.equal(variables['--rain-streak-speed'], '0.7');
    assert.equal(variables['--rain-blur'], '2.4px');
    assert.equal(variables['--rain-tint'], 'rgba(180, 222, 238, 0.25)');
    assert.equal(variables['--rain-glow-strength'], '0.46');
  });

  test('NoteLogoGlow 只输出纯 drop-shadow 字符串', () => {
    assert.match(NoteLogoGlow.forIntensity('Light'), /^drop-shadow\(/);
    assert.notEqual(
      NoteLogoGlow.forIntensity('Light'),
      NoteLogoGlow.forIntensity('Heavy'),
    );
  });

  test('RainTintSource 输出 blend mode 与 theme tint', () => {
    assert.equal(RainTintSource.mixBlendMode, 'soft-light');
    assert.equal(
      RainTintSource.forThemeColor('#607684'),
      'color-mix(in srgb, #607684 38%, transparent)',
    );
  });
});
