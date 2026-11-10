import type { GridNote } from '@core/chart/note';
import type { DynamicGridScale } from '@core/chart/grid';
import type { GridCellId } from '@core/chart/types';
import { GRID_GOOD_WINDOW_MS } from '@core/constants';

interface RhythmGuideLayerProps {
  readonly notes: readonly GridNote[];
  readonly grid: DynamicGridScale;
  readonly playheadMs: number;
  readonly blind: boolean;
}

interface GuidePoint {
  readonly x: number;
  readonly y: number;
}

const WINDOW_MS = GRID_GOOD_WINDOW_MS;

function centerOfCell(grid: DynamicGridScale, cell: GridCellId): GuidePoint {
  const rect = grid.cellRect(cell);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function anchorOf(note: GridNote, grid: DynamicGridScale): GuidePoint {
  if (note.chartLayerIndex === 2 && note.gridCellId !== null) {
    return centerOfCell(grid, note.gridCellId as GridCellId);
  }
  // L1 没有格位；固定放在 cell 1 内部，避免落在网格交叉线上。
  return centerOfCell(grid, 1);
}

function isInPromptWindow(note: GridNote, playheadMs: number): boolean {
  const end = note.timeMs + note.durationMs;
  return playheadMs >= note.timeMs - WINDOW_MS && playheadMs <= end;
}

function holdLength(durationMs: number): number {
  return Math.min(0.42, 0.18 + durationMs / 1500);
}

function holdDirection(anchor: GuidePoint): 1 | -1 {
  return anchor.y >= 0.5 ? -1 : 1;
}

function holdProgress(note: GridNote, playheadMs: number): number {
  if (note.durationMs <= 0) return 0;
  const ratio = (playheadMs - note.timeMs) / note.durationMs;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * 节奏点引导：
 * - 提示只在判定窗内出现（tap ±200ms；hold 从 -200ms 到 hold 结束）。
 * - Hold 引导线是静止的，结尾一个小白色正方形。
 * - 只有节奏点提示（L1 十字 / L2 Logo）沿引导线移动。
 * - 不画额外判定线；不使用圆形 fallback。
 */
export function RhythmGuideLayer({
  notes,
  grid,
  playheadMs,
  blind,
}: RhythmGuideLayerProps) {
  if (blind) return null;

  const activeLayerOne = notes.find((note) => note.chartLayerIndex === 1
    && note.judgement !== 'Miss'
    && !(note.durationMs > 0 && !note.pending && note.hold === null)
    && isInPromptWindow(note, playheadMs));
  const layerOne = centerOfCell(grid, 1);
  const layerOneProgress = activeLayerOne
    ? holdProgress(activeLayerOne, playheadMs)
    : 0;
  const layerOneMove = activeLayerOne
    ? holdLength(activeLayerOne.durationMs) * layerOneProgress
    : 0;
  const layerOneDirection = holdDirection(layerOne);
  const layerOnePoint = {
    x: layerOne.x,
    y: layerOne.y + layerOneMove * layerOneDirection,
  };

  const holds = notes.filter((note) => {
    if (note.durationMs <= 0) return false;
    if (note.judgement === 'Miss') return false;
    if (!note.pending && note.hold === null) return false;
    return isInPromptWindow(note, playheadMs);
  });

  return (
    <div className="game-guides" aria-hidden="true">
      {activeLayerOne ? (
        <div className="game-guide-cross">
          <span className="game-guide-cross__v game-guide-cross__v--left" style={{ left: `${layerOnePoint.x * 100}%` }} />
          <span className="game-guide-cross__v" style={{ left: `${layerOnePoint.x * 100}%` }} />
          <span className="game-guide-cross__v game-guide-cross__v--right" style={{ left: `${layerOnePoint.x * 100}%` }} />
          <span className="game-guide-cross__h game-guide-cross__h--up" style={{ top: `${layerOnePoint.y * 100}%` }} />
          <span className="game-guide-cross__h" style={{ top: `${layerOnePoint.y * 100}%` }} />
          <span className="game-guide-cross__h game-guide-cross__h--down" style={{ top: `${layerOnePoint.y * 100}%` }} />
          <span
            className="game-guide-cross__tag"
            style={{ left: `${layerOnePoint.x * 100}%`, top: `${layerOnePoint.y * 100}%` }}
          >
            L1 / SPACE · 123QWE
          </span>
        </div>
      ) : null}

      {holds.map((note) => {
        const anchor = anchorOf(note, grid);
        const length = holdLength(note.durationMs);
        const direction = holdDirection(anchor);
        return (
          <div
            key={note.noteIndex}
            className={`game-guide-hold${direction < 0 ? ' game-guide-hold--up' : ''}`}
            style={{
              left: `${anchor.x * 100}%`,
              top: `${(direction > 0 ? anchor.y : anchor.y - length) * 100}%`,
              height: `${length * 100}%`,
            }}
          >
            <span className="game-guide-hold__line" />
            <span className="game-guide-hold__cap" />
          </div>
        );
      })}
    </div>
  );
}
