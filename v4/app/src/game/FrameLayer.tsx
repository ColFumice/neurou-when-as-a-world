import { FrameTracking, VisualFrameTargetLock } from '@core/world/frame';
import type { VisualFrameRect } from '@core/world/frame';

interface FrameLayerProps {
  readonly visible: boolean;
  readonly rect: VisualFrameRect;
  readonly tracking: FrameTracking;
  readonly lock: VisualFrameTargetLock;
  readonly enabled: boolean;
}

/** R4c 动态视差框；坐标归一化，FrameController 驱动。 */
export function FrameLayer({
  visible,
  rect,
  tracking,
  lock,
  enabled,
}: FrameLayerProps) {
  if (!visible) return null;

  return (
    <div
      className={`game-frame${enabled ? ' game-frame--active' : ''}`}
      aria-hidden="true"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      }}
    >
      <span className="game-frame__corner game-frame__corner--tl" />
      <span className="game-frame__corner game-frame__corner--tr" />
      <span className="game-frame__corner game-frame__corner--bl" />
      <span className="game-frame__corner game-frame__corner--br" />
      <span className="game-frame__label">
        {enabled ? 'VISUAL FRAME / SHIFT+ARROWS' : 'VISUAL FRAME / STATIC'}
      </span>
      <span className="game-frame__meta">
        {tracking} · {lock}
      </span>
    </div>
  );
}
