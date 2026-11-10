import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartScore } from '../../core/chart/types';

describe('R4a ChartScore 规范化', () => {
  test('基础分：Perfect 1000 / Good 500 / Miss 0', () => {
    assert.equal(ChartScore.Perfect, 1000);
    assert.equal(ChartScore.Good, 500);
    assert.equal(ChartScore.Miss, 0);
    assert.equal(ChartScore.scoreFor('Perfect', 1, 0), 1000);
    assert.equal(ChartScore.scoreFor('Good', 1, 0), 500);
    assert.equal(ChartScore.scoreFor('Miss', 1, 50), 0);
  });

  test('层数作为 multiplier', () => {
    assert.equal(ChartScore.scoreFor('Perfect', 1, 0), 1000);
    assert.equal(ChartScore.scoreFor('Perfect', 2, 0), 2000);
    assert.equal(ChartScore.scoreFor('Perfect', 3, 0), 3000);
    assert.equal(ChartScore.scoreFor('Good', 2, 0), 1000);
  });

  test('连击加成：每 combo +1%，封顶 2.0×', () => {
    assert.equal(ChartScore.comboMultiplier(0), 1);
    assert.equal(ChartScore.comboMultiplier(1), 1.01);
    assert.equal(ChartScore.comboMultiplier(10), 1.1);
    assert.equal(ChartScore.comboMultiplier(100), 2);
    assert.equal(ChartScore.comboMultiplier(150), 2);
    assert.equal(ChartScore.comboMultiplier(-5), 1);

    assert.equal(ChartScore.scoreFor('Perfect', 1, 1), 1010);
    assert.equal(ChartScore.scoreFor('Perfect', 1, 100), 2000);
    assert.equal(ChartScore.scoreFor('Good', 2, 1), 1010);
  });

  test('非法层数拒绝', () => {
    assert.throws(() => ChartScore.scoreFor('Perfect', 0, 0), RangeError);
    assert.throws(() => ChartScore.scoreFor('Perfect', 1.5, 0), RangeError);
  });

  test('ChartScore 结果对象保留 chartId / layerIndex / score', () => {
    const score = new ChartScore('chart-w1', 2, 2020);
    assert.equal(score.chartId, 'chart-w1');
    assert.equal(score.layerIndex, 2);
    assert.equal(score.score, 2020);
    assert.throws(() => new ChartScore('', 1, 0), RangeError);
    assert.throws(() => new ChartScore('chart', 0, 0), RangeError);
    assert.throws(() => new ChartScore('chart', 1, -1), RangeError);
  });
});
