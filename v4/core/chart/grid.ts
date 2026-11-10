/**
 * C · chart / grid
 * 2×4 网格几何、per-cell 动态放大与网格线可见性。
 * 不 import React / Pixi / DOM。
 */

import { GridRow } from './types';
import type { GridCell, GridCellId, GridLayout } from './types';

/** 网格线可见性；默认 Concealed。 */
export enum GridLineVisibility {
  Concealed = 'Concealed',
  Revealed = 'Revealed',
}

/** 放大恢复条件。 */
export enum GridScaleRestoreCondition {
  ClickOutsideEnlargedRect = 'ClickOutsideEnlargedRect',
  SessionReset = 'SessionReset',
}

const GRID_PADDING_X = 0;
const GRID_PADDING_Y = 0;

function defaultLayout(): GridLayout {
  const cells: GridCell[] = [];
  for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
    const row = rowIndex === 0 ? GridRow.Top : GridRow.Bottom;
    for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
      const gridCellId = (rowIndex * 4 + columnIndex + 1) as GridCellId;
      cells.push({
        gridCellId,
        row,
        columnIndex: columnIndex as 0 | 1 | 2 | 3,
      });
    }
  }
  return {
    rows: [GridRow.Top, GridRow.Bottom],
    columnsPerRow: 4,
    cells,
  };
}

interface NormalizedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface GridPoint {
  readonly x: number;
  readonly y: number;
}

function contains(rect: NormalizedRect, point: GridPoint): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function centerOf(rect: NormalizedRect): GridPoint {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** 每格独立的 1.0 / 1.5 放大状态与 Revealed / Concealed。 */
export class DynamicGridScale {
  readonly layout: GridLayout;
  private readonly enlargedScale: number;
  private readonly scales = new Map<number, number>();
  private readonly visibilities = new Map<number, GridLineVisibility>();

  constructor(layout?: GridLayout, enlargedScale = 1.5) {
    if (!Number.isFinite(enlargedScale) || enlargedScale <= 1 || enlargedScale > 3) {
      throw new RangeError('DynamicGridScale enlargedScale must be in (1, 3]');
    }
    this.layout = layout ?? defaultLayout();
    if (this.layout.cells.length !== 8) {
      throw new RangeError('DynamicGridScale requires a 2x4 layout with 8 cells');
    }
    this.enlargedScale = enlargedScale;
    this.reset();
  }

  /** 基础（1.0）归一化矩形；不含格间距以外的屏幕换算。 */
  cellRect(cell: GridCellId): NormalizedRect {
    const entry = this.layout.cells.find((candidate) => candidate.gridCellId === cell);
    if (!entry) throw new RangeError(`unknown grid cell ${cell}`);
    const cellWidth = (1 - GRID_PADDING_X * 3) / 4;
    const cellHeight = (1 - GRID_PADDING_Y) / 2;
    const rowIndex = entry.row === GridRow.Top ? 0 : 1;
    return {
      x: GRID_PADDING_X + entry.columnIndex * (cellWidth + GRID_PADDING_X),
      y: GRID_PADDING_Y + rowIndex * (cellHeight + GRID_PADDING_Y),
      width: cellWidth,
      height: cellHeight,
    };
  }

  /** 当前 scale 后的矩形；以格心为原点放大。 */
  scaledRect(cell: GridCellId): NormalizedRect {
    const base = this.cellRect(cell);
    const scale = this.scaleOf(cell);
    const center = centerOf(base);
    const width = base.width * scale;
    const height = base.height * scale;
    return {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    };
  }

  scaleOf(cell: GridCellId): number {
    return this.scales.get(cell) ?? 1;
  }

  visibilityOf(cell: GridCellId): GridLineVisibility {
    return this.visibilities.get(cell) ?? GridLineVisibility.Concealed;
  }

  /** 成功命中：该格 1.5 + Revealed；其他格不变。 */
  hit(cell: GridCellId): void {
    this.scales.set(cell, this.enlargedScale);
    this.visibilities.set(cell, GridLineVisibility.Revealed);
  }

  /** 该格立即回到 1.0 + Concealed；app 用于命中后瞬时缩回。 */
  restore(cell: GridCellId): void {
    if (!this.layout.cells.some((entry) => entry.gridCellId === cell)) {
      throw new RangeError(`unknown grid cell ${cell}`);
    }
    this.scales.set(cell, 1);
    this.visibilities.set(cell, GridLineVisibility.Concealed);
  }

  /** 指针位置命中哪个格；重叠时优先更大的 scale，再取更近的格心。 */
  hitTest(point: GridPoint): GridCellId | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError('hitTest point must be finite');
    }
    let best: GridCellId | null = null;
    let bestScale = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const entry of this.layout.cells) {
      const rect = this.scaledRect(entry.gridCellId);
      if (!contains(rect, point)) continue;
      const center = centerOf(rect);
      const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      const scale = this.scaleOf(entry.gridCellId);
      if (scale > bestScale || (scale === bestScale && distance < bestDistance)) {
        best = entry.gridCellId;
        bestScale = scale;
        bestDistance = distance;
      }
    }
    return best;
  }

  /**
   * 点击到某个已放大格的新矩形之外 → 该格恢复 1.0 + Concealed。
   * SessionReset 直接清空全部。
   */
  restoreIfOutside(
    point: GridPoint,
    condition: GridScaleRestoreCondition,
  ): readonly GridCellId[] {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError('restore point must be finite');
    }
    if (condition === GridScaleRestoreCondition.SessionReset) {
      const restored = this.enlargedCells();
      this.reset();
      return restored;
    }

    const restored: GridCellId[] = [];
    for (const entry of this.layout.cells) {
      const cell = entry.gridCellId;
      if (this.scaleOf(cell) <= 1) continue;
      if (contains(this.scaledRect(cell), point)) continue;
      this.scales.set(cell, 1);
      this.visibilities.set(cell, GridLineVisibility.Concealed);
      restored.push(cell);
    }
    return restored;
  }

  reset(): void {
    this.scales.clear();
    this.visibilities.clear();
  }

  private enlargedCells(): GridCellId[] {
    const result: GridCellId[] = [];
    for (const entry of this.layout.cells) {
      if (this.scaleOf(entry.gridCellId) > 1) result.push(entry.gridCellId);
    }
    return result;
  }
}
