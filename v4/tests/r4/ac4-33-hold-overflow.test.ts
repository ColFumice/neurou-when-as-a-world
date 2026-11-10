import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HoldGridLine } from '../../core/chart/note';
import { down, note, snapshot, up } from './helpers';

function holdWithLine(): {
  readonly target: ReturnType<typeof note>;
  readonly session: ReturnType<typeof snapshot>;
} {
  const target = note({
    timeMs: 1000,
    durationMs: 1000,
    chartLayerIndex: 2,
    gridCellId: 1,
    holdGridLines: [new HoldGridLine({ atMs: 1500, requiredGridCellId: 2 })],
  });
  const session = snapshot([target]);
  session.submit(down({ timeMs: 1000, gridCellId: 1 }));
  return { target, session };
}

describe('R4a AC4-33 长按越界重按', () => {
  test('越界重按成功 → 续接并完成，只计一次分', () => {
    const { target, session } = holdWithLine();

    session.advance(1400);
    session.submit(down({ timeMs: 1500, gridCellId: 2 }));
    session.advance(2000);
    session.advance(2400);

    assert.equal(target.judgement, 'Perfect');
    assert.equal(target.hold, null);
    assert.equal(session.counts.perfect, 1);
    assert.equal(session.counts.miss, 0);
  });

  test('越界后不按 → Miss', () => {
    const { target, session } = holdWithLine();

    session.advance(1701);

    assert.equal(target.judgement, 'Miss');
    assert.equal(target.hold, null);
    assert.equal(session.counts.miss, 1);
    assert.equal(session.overflows[0]?.result, 'Missed');
  });

  test('按住不放不算重按 → Miss', () => {
    const { target, session } = holdWithLine();

    session.advance(1701);

    assert.equal(target.judgement, 'Miss');
    assert.equal(session.counts.perfect, 0);
  });

  test('越界按错键 → Miss 并终止当前段', () => {
    const { target, session } = holdWithLine();

    session.submit(down({ timeMs: 1500, gridCellId: 3 }));

    assert.equal(target.judgement, 'Miss');
    assert.equal(target.hold, null);
    assert.equal(session.overflows[0]?.result, 'Missed');
  });

  test('越界前提前松手 → Miss', () => {
    const { target, session } = holdWithLine();

    session.submit(up({ timeMs: 1200, gridCellId: 1 }));

    assert.equal(target.judgement, 'Miss');
    assert.equal(target.hold, null);
    assert.equal(session.counts.miss, 1);
  });

  test('越界窗口内松手但未重按 → 窗口后 Miss', () => {
    const { target, session } = holdWithLine();

    session.submit(up({ timeMs: 1400, gridCellId: 1 }));
    assert.equal(target.judgement, 'Perfect');

    session.advance(1701);
    assert.equal(target.judgement, 'Miss');
  });
});
