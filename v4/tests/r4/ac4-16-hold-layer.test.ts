import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HoldGridOverflow, SpaceHoldOverflow } from '../../core/chart/judge';
import { HoldGridLine } from '../../core/chart/note';
import { down, note, snapshot } from './helpers';

describe('R4a AC4-16 Hold 归属单一 ChartLayerIndex', () => {
  test('第 2 层 Hold 使用 HoldGridOverflow，续接后完成', () => {
    const target = note({
      timeMs: 1000,
      durationMs: 1000,
      chartLayerIndex: 2,
      gridCellId: 1,
      holdGridLines: [new HoldGridLine({ atMs: 1500, requiredGridCellId: 2 })],
    });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    assert.equal(target.hold?.layerIndex, 2);

    session.advance(1400);
    session.submit(down({ timeMs: 1500, gridCellId: 2 }));
    assert.ok(session.overflows[0] instanceof HoldGridOverflow);
    assert.equal(session.overflows[0]?.result, 'Continued');

    session.advance(2000);
    assert.equal(target.hold, null);
    assert.equal(session.counts.perfect, 1);
  });

  test('第 1 层 Hold 使用 SpaceHoldOverflow，必须重按 Space', () => {
    const target = note({
      timeMs: 1000,
      durationMs: 1000,
      chartLayerIndex: 1,
      holdGridLines: [new HoldGridLine({ atMs: 1500, requiredChartKeyId: 'Space' })],
    });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, chartKeyId: 'Space' }));
    session.advance(1400);
    session.submit(down({ timeMs: 1500, chartKeyId: 'Space' }));

    assert.ok(session.overflows[0] instanceof SpaceHoldOverflow);
    assert.equal(session.overflows[0]?.result, 'Continued');
    assert.equal(target.hold?.layerIndex, 1);
  });

  test('跨层按键不能续接第 2 层 Hold', () => {
    const target = note({
      timeMs: 1000,
      durationMs: 1000,
      chartLayerIndex: 2,
      gridCellId: 1,
      holdGridLines: [new HoldGridLine({ atMs: 1500, requiredGridCellId: 2 })],
    });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.submit(down({ timeMs: 1500, chartKeyId: 'Space' }));

    assert.equal(target.judgement, 'Miss');
    assert.equal(target.hold, null);
    assert.equal(session.overflows[0]?.result, 'Missed');
  });
});
