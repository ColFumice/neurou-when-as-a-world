import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { down, note, snapshot } from './helpers';

describe('R4a chart-w1 fixture 闭环', () => {
  test('6 note 完整输入 → 6 Perfect，score 10260', () => {
    const layerOneHold = note({
      noteIndex: 0,
      timeMs: 0,
      durationMs: 240,
      chartLayerIndex: 1,
    });
    const layerTwoTap = note({
      noteIndex: 1,
      timeMs: 1600,
      chartLayerIndex: 2,
      gridCellId: 2,
    });
    const layerOneHoldTwo = note({
      noteIndex: 2,
      timeMs: 4167,
      durationMs: 360,
      chartLayerIndex: 1,
    });
    const layerThreeTap = note({
      noteIndex: 3,
      timeMs: 4400,
      chartLayerIndex: 3,
    });
    const layerTwoHold = note({
      noteIndex: 4,
      timeMs: 5800,
      durationMs: 300,
      chartLayerIndex: 2,
      gridCellId: 5,
    });
    const layerOneTap = note({
      noteIndex: 5,
      timeMs: 7200,
      chartLayerIndex: 1,
    });
    const session = snapshot([
      layerOneHold,
      layerTwoTap,
      layerOneHoldTwo,
      layerThreeTap,
      layerTwoHold,
      layerOneTap,
    ], { durationMs: 8000 });

    session.submit(down({ timeMs: 0, chartKeyId: 'Space' }));
    session.advance(300);

    session.submit(down({ timeMs: 1600, chartKeyId: 'Grid2', gridCellId: 2 }));

    session.submit(down({ timeMs: 4167, chartKeyId: 'Space' }));
    session.advance(4600);

    session.submit(down({ timeMs: 4400, chartKeyId: 'KeyX' }));

    session.submit(down({ timeMs: 5800, chartKeyId: 'Grid5', gridCellId: 5 }));
    session.advance(6100);

    session.submit(down({ timeMs: 7200, chartKeyId: 'Space' }));
    session.advance(8000);

    assert.deepEqual(session.counts, {
      perfect: 6,
      good: 0,
      miss: 0,
      combo: 6,
      maxCombo: 6,
    });
    assert.equal(session.score, 10260);
    for (const item of session.notes) {
      assert.equal(item.judgement, 'Perfect');
    }
  });

  test('漏掉第 2 个 note → 1 Miss，combo 归零', () => {
    const first = note({ noteIndex: 0, timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const second = note({ noteIndex: 1, timeMs: 2000, chartLayerIndex: 2, gridCellId: 2 });
    const session = snapshot([first, second]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.advance(2301);

    assert.equal(first.judgement, 'Perfect');
    assert.equal(second.judgement, 'Miss');
    assert.equal(session.counts.perfect, 1);
    assert.equal(session.counts.miss, 1);
    assert.equal(session.counts.combo, 0);
  });
});
