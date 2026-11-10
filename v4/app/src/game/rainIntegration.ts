import type { CSSProperties } from 'react';
import type { RainModeState } from '../../../core/world/types';
import { NoteLogoGlow } from '../../../core/presentation/rain/NoteLogoGlow';
import { RainTintSource } from '../../../core/presentation/rain/RainTintSource';
import { RainVisualConfig } from '../../../core/presentation/rain/RainVisualConfig';
import type { RainAudio } from './rain/RainAudio';
import type { RainRuntime } from './rainRuntime';

/** R4e.3 · GameScreen 与冻结 Rain 组件的薄绑定；不修改 RainRuntime / RainLayer / RainAudio。 */
export function safeAdvanceRain(
  runtime: Pick<RainRuntime, 'advanceTo'>,
  nowMs: number,
): void {
  try {
    void runtime.advanceTo(nowMs).catch(() => undefined);
  } catch {
    // rAF 绝不被 Rain 异常打断。
  }
}

export function rainLogoGlow(state: RainModeState | null): string | null {
  if (!state?.active) return null;
  return NoteLogoGlow.forIntensity(state.intensity);
}

export function rainStageClass(state: RainModeState | null): string {
  return state?.active ? 'game-content--rain' : '';
}

export function rainStageStyle(
  state: RainModeState | null,
  worldTint: string,
): CSSProperties | undefined {
  if (!state?.active) return undefined;
  const config = RainVisualConfig.forIntensity(state.intensity);
  return {
    '--rain-tint-source': RainTintSource.forThemeColor(worldTint),
    '--rain-tint-mode': RainTintSource.mixBlendMode,
    '--rain-tint-opacity': String(config.opacity * 0.62),
  } as CSSProperties;
}

export function syncRainAudio(
  audio: Pick<RainAudio, 'setEnabled' | 'setIntensity'>,
  state: RainModeState | null,
): void {
  if (!state?.active) {
    audio.setEnabled(false);
    return;
  }
  audio.setIntensity(state.intensity);
  audio.setEnabled(true);
}

export function notifyRainOnline(runtime: Pick<RainRuntime, 'notifyOnline'>): void {
  try {
    void runtime.notifyOnline().catch(() => undefined);
  } catch {
    // 网络事件回调异常不向外抛。
  }
}

export function handleRainOffline(runtime: object): void {
  // R4e.2a 的冻结 Runtime 没有 handleOffline；存在时调用，不存在时忽略。
  const candidate = runtime as { handleOffline?: () => void };
  try {
    candidate.handleOffline?.();
  } catch {
    // ignore
  }
}

export function worldTintHex(theme: { readonly r: number; readonly g: number; readonly b: number }): string {
  const component = (value: number): string => (
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  );
  return `#${component(theme.r)}${component(theme.g)}${component(theme.b)}`;
}
