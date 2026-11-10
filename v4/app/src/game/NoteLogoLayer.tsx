import type { CSSProperties } from 'react';
import type { GridNote } from '@core/chart/note';
import type { DynamicGridScale } from '@core/chart/grid';
import type { GridCellId } from '@core/chart/types';
import { GRID_GOOD_WINDOW_MS } from '@core/constants';

interface NoteLogoLayerProps {
  readonly notes: readonly GridNote[];
  readonly grid: DynamicGridScale;
  readonly playheadMs: number;
  readonly blind: boolean;
  readonly logoUrl: string;
  /** R4e.2b 仅视觉：rain active 时由外部传入 NoteLogoGlow 的 drop-shadow。 */
  readonly rainGlow?: string | null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function layerTwoCenter(
  grid: DynamicGridScale,
  cell: GridCellId,
): { x: number; y: number } {
  const rect = grid.cellRect(cell);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function holdLength(durationMs: number): number {
  return Math.min(0.42, 0.18 + durationMs / 1500);
}

function holdDirection(center: { x: number; y: number }): 1 | -1 {
  return center.y >= 0.5 ? -1 : 1;
}

function holdProgress(note: GridNote, playheadMs: number): number {
  if (note.durationMs <= 0) return 0;
  const ratio = (playheadMs - note.timeMs) / note.durationMs;
  return Math.min(1, Math.max(0, ratio));
}

/** Layer 1/2 的 Logo 引导；Layer 3+ 不生成（note.logo 为 null）。 */
export function NoteLogoLayer({
  notes,
  grid,
  playheadMs,
  blind,
  logoUrl,
  rainGlow,
}: NoteLogoLayerProps) {
  if (blind) return null;

  return (
    <div
      className={`game-logos${rainGlow ? ' game-note-logo--rain' : ''}`}
      style={rainGlow ? ({ '--rain-logo-glow': rainGlow } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {notes.map((note) => {
        const logo = note.logo;
        if (!logo) return null;
        if (logo.state !== 'Visible' && logo.state !== 'Missed') return null;
        if (note.durationMs > 0
          && !note.pending
          && note.hold === null
          && note.judgement !== 'Miss') {
          return null;
        }

        // 节奏点只在判定窗内出现：tap ±200ms；hold 从 -200ms 到 hold 结束。
        const promptEnd = note.durationMs > 0
          ? note.timeMs + note.durationMs
          : note.timeMs + GRID_GOOD_WINDOW_MS;
        const inWindow = playheadMs >= note.timeMs - GRID_GOOD_WINDOW_MS
          && playheadMs <= promptEnd;
        const hitFeedback = logo.hitAtMs !== null
          && playheadMs >= logo.hitAtMs
          && playheadMs <= logo.hitAtMs + 180;
        const missFeedback = logo.state === 'Missed'
          && logo.missAtMs !== null
          && playheadMs <= logo.missAtMs + 300;
        if (!inWindow && !hitFeedback && !missFeedback) return null;

        const isLayerTwo = note.chartLayerIndex === 2 && note.gridCellId !== null;
        const baseCenter = isLayerTwo
          ? layerTwoCenter(grid, note.gridCellId as GridCellId)
          : layerTwoCenter(grid, 1);
        const progress = holdProgress(note, playheadMs);
        const direction = holdDirection(baseCenter);
        const center = {
          x: baseCenter.x,
          y: baseCenter.y + holdLength(note.durationMs) * progress * direction,
        };
        const size = isLayerTwo ? 0.15 : 0.2;
        const fadeIn = clamp01((playheadMs - logo.appearAtMs) / 160);
        const fadeOut = logo.state === 'Missed'
          ? 1
          : clamp01((logo.expireAtMs - playheadMs) / 220);
        const hit = logo.hitAtMs !== null
          && playheadMs >= logo.hitAtMs
          && playheadMs <= logo.hitAtMs + 180;
        const missed = logo.state === 'Missed';

        return (
          <div
            key={note.noteIndex}
            className={`game-logo${hit ? ' game-logo--hit' : ''}${missed ? ' game-logo--miss' : ''}`}
            data-note={note.noteIndex}
            data-layer={note.chartLayerIndex}
            style={{
              left: `${center.x * 100}%`,
              top: `${center.y * 100}%`,
              height: `${size * 100}%`,
              opacity: fadeIn * fadeOut,
            }}
          >
            <img src={logoUrl} alt="" draggable={false} />
            <span className="game-logo__tag">
              {note.chartLayerIndex === 1 ? 'L1' : 'L2'} / {note.gridCellId ?? 'CENTER'}
              {note.chartLayerIndex === 1 ? ' · SPACE/123QWE' : ''}
              {note.durationMs > 0 ? ' · HOLD' : ''}
            </span>
            {missed ? <span className="game-logo__miss">MISS</span> : null}
          </div>
        );
      })}
    </div>
  );
}
