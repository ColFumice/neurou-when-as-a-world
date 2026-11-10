import type { CSSProperties } from 'react';
import type { RainModeState } from '../../../../core/world/types';
import { RainVisualConfig } from '../../../../core/presentation/rain/RainVisualConfig';
import { RainTintSource } from '../../../../core/presentation/rain/RainTintSource';

export interface RainLayerStyle extends CSSProperties {
  readonly [key: `--rain-${string}`]: string | number;
}

export interface RainLayerModel {
  readonly intensity: string;
  readonly layers: 3;
  readonly style: RainLayerStyle;
}

/**
 * X · RainLayer 的纯模型；测试不需要 DOM。
 * null / active=false 返回 null，组件据此不渲染。
 */
export function rainLayerModel(
  rainModeState: RainModeState | null,
  worldTint = '#607684',
): RainLayerModel | null {
  if (!rainModeState || !rainModeState.active) return null;
  const config = RainVisualConfig.forIntensity(rainModeState.intensity);
  const density = Math.max(config.density, 0.1);
  const speed = Math.max(config.streakSpeed, 0.1);
  return {
    intensity: config.intensity,
    layers: 3,
    style: {
      ...config.cssVariables as RainLayerStyle,
      '--rain-tint-source': RainTintSource.forThemeColor(worldTint),
      '--rain-tint-mode': RainTintSource.mixBlendMode,
      '--rain-size-1': `${Math.round(180 / density)}px`,
      '--rain-size-2': `${Math.round(120 / density)}px`,
      '--rain-size-3': `${Math.round(76 / density)}px`,
      '--rain-duration-1': `${(2.8 / speed).toFixed(2)}s`,
      '--rain-duration-2': `${(1.9 / speed).toFixed(2)}s`,
      '--rain-duration-3': `${(1.2 / speed).toFixed(2)}s`,
      '--rain-opacity-2': String(config.opacity * 0.78),
      '--rain-opacity-3': String(config.opacity * 0.58),
    },
  };
}
