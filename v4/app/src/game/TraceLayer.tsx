import { VisibilityState } from '@core/trace/visibility';
import type { TraceView } from './traceRuntime';

interface TraceLayerProps {
  readonly visible: boolean;
  readonly traces: readonly TraceView[];
  readonly playheadMs: number;
}

function isTouched(view: TraceView, playheadMs: number): boolean {
  if (view.lastTouchedAtMs === null) return false;
  const elapsed = playheadMs - view.lastTouchedAtMs;
  return elapsed >= 0 && elapsed <= 320;
}

/** R4c 痕覆盖层：Concealed 淡显，Revealed 高亮，Touched 短闪。 */
export function TraceLayer({ visible, traces, playheadMs }: TraceLayerProps) {
  if (!visible || traces.length === 0) return null;

  return (
    <div className="game-traces" aria-hidden="true">
      {traces.map((view) => {
        const revealed = view.visibility === VisibilityState.Revealed;
        const touched = isTouched(view, playheadMs);
        return (
          <div
            key={`${view.traceId}:${view.lastTouchedAtMs ?? 'idle'}`}
            className={[
              'game-trace',
              revealed ? 'game-trace--revealed' : 'game-trace--concealed',
              touched ? 'game-trace--touched' : '',
            ].filter(Boolean).join(' ')}
            data-trace-id={view.traceId}
            data-state={view.visibility}
            style={{
              left: `${view.rect.x * 100}%`,
              top: `${view.rect.y * 100}%`,
              width: `${view.rect.width * 100}%`,
              height: `${view.rect.height * 100}%`,
            }}
          >
            <span className="game-trace__label">
              {view.label || view.traceId}
            </span>
            <span className="game-trace__meta">
              {revealed ? 'REVEALED' : 'TRACE'} · L{view.layerIndex}
            </span>
          </div>
        );
      })}
    </div>
  );
}
