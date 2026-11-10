import type { EditorEffectKind, EditorEffectParams, EditorLightPreset } from './types';

export interface ActiveStageEffect {
  readonly interfaceId: string;
  readonly effectKind: EditorEffectKind;
  readonly params: EditorEffectParams;
  readonly localMs: number;
}

export interface StageOverlay {
  readonly id: string;
  readonly kind: 'noise' | 'flashWhite' | 'flashBlack' | 'black' | 'white' | 'scan';
  readonly opacity: number;
  readonly color?: string;
}

export interface StageEffectState {
  readonly transform: string;
  readonly filter: string;
  readonly opacity: number;
  readonly clipPath: string;
  readonly overlays: readonly StageOverlay[];
}

export const EMPTY_EFFECT_STATE: StageEffectState = {
  transform: '',
  filter: '',
  opacity: 1,
  clipPath: '',
  overlays: [],
};

function progress(localMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, localMs / durationMs));
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * 纯函数动效合成：把同一时刻的多个 effect 合成一个 CSS transform/filter。
 * 未激活 effect 不应传入；结束时调用方传空数组即可完全剥离。
 */
export function composeStageEffects(effects: readonly ActiveStageEffect[]): StageEffectState {
  const transforms: string[] = [];
  const filters: string[] = [];
  const overlays: StageOverlay[] = [];
  let opacity = 1;
  let clipPath = '';

  for (const effect of effects) {
    const durationMs = effect.params.durationMs ?? 600;
    const intensity = effect.params.intensity ?? 1;
    const t = progress(effect.localMs, durationMs);
    const pulse = Math.sin(t * Math.PI);
    const decay = (1 - t) * intensity;

    switch (effect.effectKind) {
      case 'EaseIn':
        transforms.push(`scale(${0.92 + 0.08 * easeIn(t)}) translateY(${((1 - easeIn(t)) * 8).toFixed(2)}px)`);
        break;
      case 'EaseOut':
        transforms.push(`scale(${1 + 0.06 * pulse * intensity})`);
        filters.push(`brightness(${(1 + 0.12 * pulse * intensity).toFixed(3)})`);
        break;
      case 'ScaleUp':
        transforms.push(`scale(${1 + ((effect.params.scale ?? 1.8) - 1) * pulse * intensity})`);
        break;
      case 'ScaleDown':
        transforms.push(`scale(${1 - (1 - (effect.params.scale ?? 0.6)) * pulse * intensity})`);
        break;
      case 'Glitch': {
        const offset = effect.params.glitchOffset ?? 9;
        const jitter = Math.sin(effect.localMs * 0.11) * offset * intensity;
        transforms.push(`translateX(${jitter.toFixed(2)}px) skewX(${(jitter * 0.3).toFixed(2)}deg)`);
        filters.push(`hue-rotate(${(jitter * 2).toFixed(1)}deg)`);
        break;
      }
      case 'ScrollOpen': {
        const amount = effect.params.scrollAmount ?? 48;
        clipPath = `inset(0 ${((1 - easeOut(t)) * amount).toFixed(2)}% 0 ${((1 - easeOut(t)) * amount).toFixed(2)}%)`;
        transforms.push(`scaleX(${0.6 + 0.4 * easeOut(t)})`);
        break;
      }
      case 'ScrollClose': {
        const amount = effect.params.scrollAmount ?? 48;
        clipPath = `inset(0 ${(easeIn(t) * amount).toFixed(2)}% 0 ${(easeIn(t) * amount).toFixed(2)}%)`;
        break;
      }
      case 'Bounce': {
        const count = Math.max(1, effect.params.bounceCount ?? 3);
        const height = effect.params.initialHeight ?? 24;
        transforms.push(`translateY(${(-Math.abs(Math.sin(t * Math.PI * count)) * height * decay).toFixed(2)}px)`);
        break;
      }
      case 'Wander': {
        const radius = effect.params.wanderRadius ?? 14;
        transforms.push(`translate(${(Math.sin(t * Math.PI * 2) * radius * intensity).toFixed(2)}px, ${(Math.cos(t * Math.PI * 2) * radius * 0.7 * intensity).toFixed(2)}px)`);
        break;
      }
      case 'Shake': {
        const amplitude = effect.params.shakeAmplitude ?? 8;
        transforms.push(`translate(${(Math.sin(effect.localMs * 0.16) * amplitude * intensity).toFixed(2)}px, ${(Math.cos(effect.localMs * 0.19) * amplitude * 0.62 * intensity).toFixed(2)}px)`);
        break;
      }
      default:
        break;
    }
  }

  return {
    transform: transforms.join(' '),
    filter: filters.join(' '),
    opacity: Math.max(0, Math.min(1, opacity)),
    clipPath,
    overlays,
  };
}

export interface ActiveLight {
  readonly presets: readonly EditorLightPreset[];
  readonly localMs: number;
  readonly durationMs: number;
  readonly intensity: number;
  readonly mode?: 'FullScreen' | 'Local';
  readonly targetAssetId?: string | null;
}

export function composeStageLights(lights: readonly ActiveLight[]): StageEffectState {
  const filters: string[] = [];
  const overlays: StageOverlay[] = [];

  for (const light of lights) {
    const t = progress(light.localMs, light.durationMs);
    const pulse = Math.sin(t * Math.PI);
    const strength = Math.max(0, light.intensity);
    for (const preset of light.presets) {
      switch (preset) {
        case 'Invert':
          filters.push(`invert(${Math.min(1, strength)})`);
          break;
        case 'Noise':
          overlays.push({ id: 'noise', kind: 'noise', opacity: pulse * 0.32 * strength });
          break;
        case 'Scroll':
          overlays.push({ id: 'scan', kind: 'scan', opacity: 0.18 * strength });
          break;
        case 'Offset':
          filters.push(`hue-rotate(${(pulse * 8).toFixed(1)}deg)`);
          break;
        case 'FlashWhite':
          overlays.push({ id: 'flashWhite', kind: 'flashWhite', opacity: pulse * 0.55 * strength });
          break;
        case 'FlashBlack':
          overlays.push({ id: 'flashBlack', kind: 'flashBlack', opacity: pulse * 0.55 * strength });
          break;
        case 'OverlayBlack':
          overlays.push({ id: 'black', kind: 'black', opacity: 0.32 * strength });
          break;
        case 'OverlayWhite':
          overlays.push({ id: 'white', kind: 'white', opacity: 0.32 * strength });
          break;
        case 'Desaturate':
          filters.push(`saturate(${1 - Math.min(1, strength) * pulse})`);
          break;
        case 'Vivid':
          filters.push(`saturate(${1 + 0.8 * strength * pulse})`);
          break;
        case 'Blur':
          filters.push(`blur(${(4 * strength * pulse).toFixed(2)}px)`);
          break;
        default:
          break;
      }
    }
  }

  return {
    transform: '',
    filter: filters.join(' '),
    opacity: 1,
    clipPath: '',
    overlays,
  };
}
