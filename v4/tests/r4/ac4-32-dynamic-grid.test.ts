import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DynamicGridScale,
  GridLineVisibility,
  GridScaleRestoreCondition,
} from '../../core/chart/grid';
import type { GridCellId } from '../../core/chart/types';

function centerOf(grid: DynamicGridScale, cell: GridCellId): { x: number; y: number } {
  const rect = grid.cellRect(cell);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

describe('R4a AC4-32 动态网格', () => {
  test('默认 8 格、全部 1.0 / Concealed', () => {
    const grid = new DynamicGridScale();
    assert.equal(grid.layout.cells.length, 8);
    for (const cell of grid.layout.cells) {
      assert.equal(grid.scaleOf(cell.gridCellId), 1);
      assert.equal(grid.visibilityOf(cell.gridCellId), GridLineVisibility.Concealed);
    }
  });

  test('命中某格 → 1.5 / Revealed；其他格不变', () => {
    const grid = new DynamicGridScale();
    grid.hit(3);

    assert.equal(grid.scaleOf(3), 1.5);
    assert.equal(grid.visibilityOf(3), GridLineVisibility.Revealed);
    assert.equal(grid.scaleOf(4), 1);
    assert.equal(grid.visibilityOf(4), GridLineVisibility.Concealed);
  });

  test('restore 单格 → 1.0 / Concealed；其他格不变', () => {
    const grid = new DynamicGridScale();
    grid.hit(3);
    grid.hit(4);
    grid.restore(3);

    assert.equal(grid.scaleOf(3), 1);
    assert.equal(grid.visibilityOf(3), GridLineVisibility.Concealed);
    assert.equal(grid.scaleOf(4), 1.5);
    assert.equal(grid.visibilityOf(4), GridLineVisibility.Revealed);
    assert.throws(() => grid.restore(0 as GridCellId), RangeError);
  });

  test('点击放大后矩形之外 → 恢复 1.0 / Concealed', () => {
    const grid = new DynamicGridScale();
    grid.hit(3);

    const restored = grid.restoreIfOutside(
      { x: 0.001, y: 0.001 },
      GridScaleRestoreCondition.ClickOutsideEnlargedRect,
    );

    assert.deepEqual(restored, [3]);
    assert.equal(grid.scaleOf(3), 1);
    assert.equal(grid.visibilityOf(3), GridLineVisibility.Concealed);
  });

  test('点击另一格不会恢复未越界的放大格', () => {
    const grid = new DynamicGridScale();
    grid.hit(3);
    const point = centerOf(grid, 4);

    const restored = grid.restoreIfOutside(
      point,
      GridScaleRestoreCondition.ClickOutsideEnlargedRect,
    );

    assert.deepEqual(restored, [3]);
    assert.equal(grid.scaleOf(3), 1);
    assert.equal(grid.hitTest(point), 4);
  });

  test('hitTest 按当前 scale 命中格', () => {
    const grid = new DynamicGridScale();
    assert.equal(grid.hitTest(centerOf(grid, 1)), 1);
    assert.equal(grid.hitTest(centerOf(grid, 8)), 8);

    grid.hit(6);
    assert.equal(grid.hitTest(centerOf(grid, 6)), 6);
  });

  test('每格独立维护放大状态', () => {
    const grid = new DynamicGridScale();
    grid.hit(1);
    grid.hit(2);

    assert.equal(grid.scaleOf(1), 1.5);
    assert.equal(grid.scaleOf(2), 1.5);

    grid.restoreIfOutside(
      { x: 0.5, y: 0.99 },
      GridScaleRestoreCondition.ClickOutsideEnlargedRect,
    );

    assert.equal(grid.scaleOf(1), 1);
    assert.equal(grid.scaleOf(2), 1);
  });

  test('SessionReset 清空全部', () => {
    const grid = new DynamicGridScale();
    grid.hit(1);
    grid.hit(8);

    const restored = grid.restoreIfOutside(
      { x: 0.5, y: 0.5 },
      GridScaleRestoreCondition.SessionReset,
    );

    assert.deepEqual([...restored].sort(), [1, 8]);
    assert.equal(grid.scaleOf(1), 1);
    assert.equal(grid.scaleOf(8), 1);
  });
});
