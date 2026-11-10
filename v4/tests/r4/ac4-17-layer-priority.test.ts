import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { down, note, snapshot } from './helpers';

describe('R4a AC4-17 分层判定优先级', () => {
  test('Space 优先第 1 层，不抢第 2/3 层', () => {
    const layerOne = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 1 });
    const layerTwo = note({ noteIndex: 1, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const layerThree = note({ noteIndex: 2, timeMs: 1000, chartLayerIndex: 3 });
    const session = snapshot([layerOne, layerTwo, layerThree]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Space' }));

    assert.equal(layerOne.judgement, 'Perfect');
    assert.equal(layerTwo.judgement, 'Pending');
    assert.equal(layerThree.judgement, 'Pending');
  });

  test('cell 1 键优先第 1 层，不抢第 2/3 层', () => {
    const layerOne = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 1 });
    const layerTwo = note({ noteIndex: 1, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const layerThree = note({ noteIndex: 2, timeMs: 1000, chartLayerIndex: 3 });
    const session = snapshot([layerOne, layerTwo, layerThree]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Grid1', gridCellId: 1 }));

    assert.equal(layerOne.judgement, 'Perfect');
    assert.equal(layerTwo.judgement, 'Pending');
    assert.equal(layerThree.judgement, 'Pending');
  });

  test('格位键优先第 2 层，不抢第 3 层', () => {
    const layerOne = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 1 });
    const layerTwo = note({ noteIndex: 1, timeMs: 1000, chartLayerIndex: 2, gridCellId: 2 });
    const layerThree = note({ noteIndex: 2, timeMs: 1000, chartLayerIndex: 3 });
    const session = snapshot([layerOne, layerTwo, layerThree]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Grid2', gridCellId: 2 }));

    assert.equal(layerOne.judgement, 'Pending');
    assert.equal(layerTwo.judgement, 'Perfect');
    assert.equal(layerThree.judgement, 'Pending');
  });

  test('无第 1/2 层候选时，任意键命中第 3 层', () => {
    const layerOne = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 1 });
    const layerTwo = note({ noteIndex: 1, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const layerThree = note({ noteIndex: 2, timeMs: 1000, chartLayerIndex: 3 });
    const session = snapshot([layerOne, layerTwo, layerThree]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'KeyX' }));

    assert.equal(layerOne.judgement, 'Pending');
    assert.equal(layerTwo.judgement, 'Pending');
    assert.equal(layerThree.judgement, 'Perfect');
  });

  test('Space 是第 1 层专用键，不命中第 3+ 层', () => {
    const layerThree = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 3 });
    const session = snapshot([layerThree]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Space' }));

    assert.equal(layerThree.judgement, 'Pending');
  });

  test('同刻多键：两个格位独立命中', () => {
    const first = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const second = note({ noteIndex: 1, timeMs: 1000, chartLayerIndex: 2, gridCellId: 2 });
    const session = snapshot([first, second]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Grid1', gridCellId: 1 }));
    session.submit(down({ timeMs: 1000, chartKeyId: 'Grid2', gridCellId: 2 }));

    assert.equal(first.judgement, 'Perfect');
    assert.equal(second.judgement, 'Perfect');
    assert.equal(session.counts.perfect, 2);
  });

  test('一次输入只计一个 note', () => {
    const first = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const second = note({ noteIndex: 1, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const session = snapshot([first, second]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Grid1', gridCellId: 1 }));

    assert.equal(session.counts.perfect, 1);
    assert.equal([first, second].filter((item) => item.judgement === 'Perfect').length, 1);
  });
});
