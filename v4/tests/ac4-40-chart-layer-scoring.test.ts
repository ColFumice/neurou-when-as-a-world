import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartLayerScoring } from '../core/chart/layer';

describe('AC4-40 层分值', () => {
  test('默认 base=800 的等比递减与最低保护', () => {
    const expected = [800, 400, 200, 100, 50, 25, 12, 6, 3, 1, 1];
    for (let index = 1; index <= expected.length; index += 1) {
      assert.equal(ChartLayerScoring.scoreFor(index), expected[index - 1]);
    }
  });

  test('自定义 base 与异常参数', () => {
    assert.equal(ChartLayerScoring.scoreFor(1, 1000), 1000);
    assert.equal(ChartLayerScoring.scoreFor(2, 1000), 500);
    assert.equal(ChartLayerScoring.scoreFor(3, 1000), 250);
    assert.throws(() => ChartLayerScoring.scoreFor(0), RangeError);
    assert.throws(() => ChartLayerScoring.scoreFor(-1), RangeError);
    assert.throws(() => ChartLayerScoring.scoreFor(1.5), RangeError);
    assert.throws(() => ChartLayerScoring.scoreFor(1, 0), RangeError);
  });
});
