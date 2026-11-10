import { VisibilityState } from '@core/trace/visibility';
import { FrameTracking, VisualFrameTargetLock } from '@core/world/frame';
import type { TraceView } from './traceRuntime';

interface R4cHudProps {
  readonly visible: boolean;
  readonly frameTracking: FrameTracking;
  readonly frameLock: VisualFrameTargetLock;
  readonly traces: readonly TraceView[];
  readonly lastTrigger: string | null;
  readonly hintVisible: boolean;
}

/** R4c 调试 HUD；液态玻璃小面板，不参与判定。 */
export function R4cHud({
  visible,
  frameTracking,
  frameLock,
  traces,
  lastTrigger,
  hintVisible,
}: R4cHudProps) {
  if (!visible) return null;
  const revealed = traces.filter((view) => view.visibility === VisibilityState.Revealed).length;

  return (
    <div className="game-r4c-hud" aria-hidden="true">
      <div className="game-r4c-panel">
        <span className="game-r4c-panel__eyebrow">R4C / FRAME</span>
        <div className="game-r4c-panel__row">
          <span>FRAME</span>
          <b>{frameTracking}</b>
        </div>
        <div className="game-r4c-panel__row">
          <span>LOCK</span>
          <b>{frameLock}</b>
        </div>
        <div className="game-r4c-panel__row">
          <span>TRACE</span>
          <b>{revealed} / {traces.length}</b>
        </div>
        <div className="game-r4c-panel__row game-r4c-panel__row--wide">
          <span>TRIGGER</span>
          <b>{lastTrigger ?? '—'}</b>
        </div>
      </div>
      {hintVisible ? (
        <div className="game-r4c-hint">
          Shift + 方向键移动框 · Shift + Enter 对准
        </div>
      ) : null}
    </div>
  );
}
