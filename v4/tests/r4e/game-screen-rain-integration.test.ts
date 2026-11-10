import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RainIntensity, RainModeState } from '../../core/world/types';
import { rainLayerModel } from '../../app/src/game/rain/rainLayerModel';
import {
  handleRainOffline,
  notifyRainOnline,
  rainLogoGlow,
  rainStageClass,
  rainStageStyle,
  safeAdvanceRain,
  syncRainAudio,
  worldTintHex,
} from '../../app/src/game/rainIntegration';

describe('R4e.3 GameScreen rain integration', () => {
  test('safeAdvanceRain 调用 advanceTo，且同步/异步异常不外泄', async () => {
    let calls = 0;
    safeAdvanceRain({
      advanceTo: async () => { calls += 1; },
    }, 1000);
    await Promise.resolve();
    assert.equal(calls, 1);

    assert.doesNotThrow(() => safeAdvanceRain({
      advanceTo: () => { throw new Error('sync'); },
    } as never, 1000));
    assert.doesNotThrow(() => safeAdvanceRain({
      advanceTo: async () => { throw new Error('async'); },
    } as never, 1000));
    await Promise.resolve();
  });

  test('RainLayer active=false 不渲染；active=true + intensity 渲染', () => {
    assert.equal(rainLayerModel(new RainModeState({ active: false })), null);
    const model = rainLayerModel(new RainModeState({
      active: true,
      intensity: RainIntensity.Heavy,
    }), '#607684');
    assert.ok(model);
    assert.equal(model.layers, 3);
    assert.equal(model.intensity, 'Heavy');
  });

  test('RainAudio 音量随 intensity 变化；active=false 立即静音', () => {
    const intensities: string[] = [];
    const enabledStates: boolean[] = [];
    const audio = {
      setEnabled(enabled: boolean): void { enabledStates.push(enabled); },
      setIntensity(intensity: RainIntensity): void {
        intensities.push(intensity);
      },
    };
    syncRainAudio(audio, new RainModeState({ active: true, intensity: RainIntensity.Light }));
    syncRainAudio(audio, new RainModeState({ active: true, intensity: RainIntensity.Heavy }));
    syncRainAudio(audio, new RainModeState({ active: false }));
    assert.deepEqual(intensities, ['Light', 'Heavy']);
    assert.deepEqual(enabledStates, [true, true, false]);
  });

  test('NoteLogoGlow / stage wrapper 只在 active=true 时生效', () => {
    const active = new RainModeState({ active: true, intensity: RainIntensity.Moderate });
    const inactive = new RainModeState({ active: false });
    assert.ok(rainLogoGlow(active));
    assert.equal(rainLogoGlow(inactive), null);
    assert.equal(rainStageClass(active), 'game-content--rain');
    assert.equal(rainStageClass(inactive), '');
    const style = rainStageStyle(active, '#607684') as Record<string, string>;
    assert.equal(style['--rain-tint-source'], 'color-mix(in srgb, #607684 38%, transparent)');
    assert.equal(rainStageStyle(inactive, '#607684'), undefined);
  });

  test('online 触发 notifyOnline；offline 在 Runtime 无 handleOffline 时忽略', async () => {
    let online = 0;
    notifyRainOnline({ notifyOnline: async () => { online += 1; } } as never);
    await Promise.resolve();
    assert.equal(online, 1);

    assert.doesNotThrow(() => handleRainOffline({}));
    let offline = 0;
    assert.doesNotThrow(() => handleRainOffline({
      handleOffline: () => { offline += 1; },
    }));
    assert.equal(offline, 1);
  });

  test('world themeColor → hex', () => {
    assert.equal(worldTintHex({ r: 96, g: 118, b: 132 }), '#607684');
    assert.equal(worldTintHex({ r: 300, g: -4, b: 16 }), '#ff0010');
  });
});
