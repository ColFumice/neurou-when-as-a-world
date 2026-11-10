import type { DynamicGridScale } from '@core/chart/grid';
import { GridLineVisibility } from '@core/chart/grid';
import { zoneLabel } from './keymap';

interface GridOverlayProps {
  readonly grid: DynamicGridScale;
  readonly blind: boolean;
  readonly flashCells: ReadonlySet<number>;
}

/** 8 格视觉层：2×4 全屏、纯白方框；命中短暂 1.5× 后缩回。 */
export function GridOverlay({ grid, blind, flashCells }: GridOverlayProps) {
  if (blind) return null;

  return (
    <div className="game-grid" aria-hidden="true">
      {grid.layout.cells.map((cell) => {
        const rect = grid.cellRect(cell.gridCellId);
        const scale = grid.scaleOf(cell.gridCellId);
        const revealed = grid.visibilityOf(cell.gridCellId) === GridLineVisibility.Revealed;
        const flashing = flashCells.has(cell.gridCellId);
        return (
          <div
            key={cell.gridCellId}
            className={`game-grid__cell${revealed ? ' game-grid__cell--revealed' : ''}${scale > 1 || flashing ? ' game-grid__cell--enlarged' : ''}`}
            data-cell={cell.gridCellId}
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              transform: `scale(${scale})`,
            }}
          >
            <span className="game-grid__zone">{zoneLabel(cell.gridCellId)}</span>
          </div>
        );
      })}
      <div className="game-grid__hint">
        2×4 KEY ZONES · 123QWE / 456RTY / 789UIO / 0-=P[] · ASDZXC / FGHVB / JKLNM&lt; / ："|&gt;?
      </div>
    </div>
  );
}
