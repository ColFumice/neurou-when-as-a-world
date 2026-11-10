import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { down, note, snapshot } from './helpers';

describe('R4a AC4-14 第 2 层才使用 8 格', () => {
  test('第 1 层可用 Space 或 cell 1 键，其他格不命中', () => {
    const first = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 1 });
    const second = note({ noteIndex: 1, timeMs: 2000, chartLayerIndex: 1 });
    const session = snapshot([first, second]);

    session.submit(down({ timeMs: 1000, gridCellId: 2 }));
    assert.equal(first.judgement, 'Pending');

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    assert.equal(first.judgement, 'Perfect');

    session.submit(down({ timeMs: 2000, chartKeyId: 'Space' }));
    assert.equal(second.judgement, 'Perfect');
  });

  test('第 2 层按格位命中，错格不命中', () => {
    const target = note({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 3 });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 4 }));
    assert.equal(target.judgement, 'Pending');

    session.submit(down({ timeMs: 1000, gridCellId: 3 }));
    assert.equal(target.judgement, 'Perfect');
  });

  test('第 2 层 chartKeyId 优先于格位', () => {
    const target = note({
      timeMs: 1000,
      chartLayerIndex: 2,
      gridCellId: 3,
      chartKeyId: 'Kick',
    });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 3 }));
    assert.equal(target.judgement, 'Pending');

    session.submit(down({ timeMs: 1000, chartKeyId: 'Kick', gridCellId: 3 }));
    assert.equal(target.judgement, 'Perfect');
  });

  test('第 2 层自定义 chartKeyId 仍可用指针按格命中', () => {
    const target = note({
      timeMs: 1000,
      chartLayerIndex: 2,
      gridCellId: 3,
      chartKeyId: 'Kick',
    });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 3, source: 'Pointer' }));
    assert.equal(target.judgement, 'Perfect');
  });

  test('第 3+ 层接受任意键与指针', () => {
    const keyboardTarget = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 3 });
    const pointerTarget = note({ noteIndex: 1, timeMs: 2000, chartLayerIndex: 3 });
    const session = snapshot([keyboardTarget, pointerTarget]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'KeyX' }));
    assert.equal(keyboardTarget.judgement, 'Perfect');

    session.submit(down({ timeMs: 2000, source: 'Pointer' }));
    assert.equal(pointerTarget.judgement, 'Perfect');
  });
});
