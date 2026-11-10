import type { RainModeState } from '../../world/types';

interface RainSettingsView {
  readonly status: 'NORMAL' | 'RAIN LIGHT' | 'RAIN MODERATE' | 'RAIN HEAVY' | 'DEGRADED';
  readonly reason: RainModeState['degradedReason'];
}

/**
 * SettingsConsole 的纯展示模型；不依赖 React / DOM。
 * 默认关闭 → NORMAL；启用成功 → RAIN XXX；失败 → DEGRADED + reason。
 */
export default function (
  enabled: boolean,
  state: RainModeState | null,
): RainSettingsView {
  if (!enabled || !state) {
    return { status: 'NORMAL', reason: null };
  }
  if (state.degradedReason !== null) {
    return { status: 'DEGRADED', reason: state.degradedReason };
  }
  if (!state.active) {
    return { status: 'NORMAL', reason: null };
  }
  const status = state.intensity === 'Heavy'
    ? 'RAIN HEAVY'
    : state.intensity === 'Moderate'
      ? 'RAIN MODERATE'
      : 'RAIN LIGHT';
  return { status, reason: null };
}
