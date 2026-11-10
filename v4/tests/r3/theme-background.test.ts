import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ThemeBackground } from '../../core/presentation/projecttree/ThemeBackground';

function mockContext(): {
  fillStyle: unknown;
  fillRect(x: number, y: number, width: number, height: number): void;
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { addColorStop(offset: number, color: string): void };
  ops: string[];
} {
  const ops: string[] = [];
  return {
    fillStyle: null,
    ops,
    fillRect(x, y, width, height) {
      ops.push(`rect:${x}:${y}:${width}:${height}`);
    },
    createLinearGradient() {
      return {
        addColorStop(offset, color) {
          ops.push(`stop:${offset}:${color}`);
        },
      };
    },
  };
}

describe('R3.6b ThemeBackground', () => {
  test('程序化占位图确定性', () => {
    const theme = { r: 110, g: 140, b: 100 };
    const first = mockContext();
    const second = mockContext();
    const background = new ThemeBackground();
    const spec = background.render(first, theme, 'chromato');
    background.render(second, theme, 'chromato');
    assert.deepEqual(first.ops, second.ops);
    assert.equal(spec.width, 1920);
    assert.equal(spec.height, 1080);
    assert.equal(spec.kenBurnsPeriodMs, 20_000);
    assert.ok(spec.gridSpacing >= 48);
    assert.ok(first.ops.some((op) => op.startsWith('stop:0:rgb(')));
  });

  test('素材替换接口', () => {
    const background = new ThemeBackground();
    assert.equal(background.hasCustomImage(), false);
    const image = { width: 1920, height: 1080 };
    background.setCustomImage(image);
    assert.equal(background.hasCustomImage(), true);
    assert.equal(background.getCustomImage(), image);
  });
});
