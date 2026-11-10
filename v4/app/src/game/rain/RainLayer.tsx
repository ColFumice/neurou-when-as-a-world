import type { RainModeState } from '../../../../core/world/types';
import { rainLayerModel } from './rainLayerModel';
import './rain-layer.css';

interface RainLayerProps {
  readonly rainModeState: RainModeState | null;
  readonly worldTint?: string;
}

/**
 * 全屏 Rain 视觉层。
 * 纯 CSS transform + animation 驱动，不占游戏 rAF。
 */
export function RainLayer({ rainModeState, worldTint }: RainLayerProps) {
  const model = rainLayerModel(rainModeState, worldTint);
  if (!model) return null;

  return (
    <div
      className={`rain-layer rain-layer--${model.intensity.toLowerCase()}`}
      style={model.style}
      data-intensity={model.intensity}
      aria-hidden="true"
    >
      <div className="rain-layer__streak rain-layer__streak--1" />
      <div className="rain-layer__streak rain-layer__streak--2" />
      <div className="rain-layer__streak rain-layer__streak--3" />
      <div className="rain-layer__tint" />
      <div className="rain-layer__edge" />
    </div>
  );
}
