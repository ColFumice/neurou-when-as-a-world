import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { down, note, snapshot } from './helpers';

function judgeAt(offsetMs: number): string {
  const target = note({ timeMs: 1000, gridCellId: 1 });
  const session = snapshot([target]);
  session.submit(down({ timeMs: 1000 + offsetMs, gridCellId: 1 }));
  session.advance(1400);
  return target.judgement;
}

describe('R4a AC4-15 判定窗口', () => {
  test('Perfect 边界：-100 / 0 / 100', () => {
    assert.equal(judgeAt(-100), 'Perfect');
    assert.equal(judgeAt(0), 'Perfect');
    assert.equal(judgeAt(100), 'Perfect');
  });

  test('Good 边界：-300 / -101 / 101 / 300', () => {
    assert.equal(judgeAt(-300), 'Good');
    assert.equal(judgeAt(-101), 'Good');
    assert.equal(judgeAt(101), 'Good');
    assert.equal(judgeAt(300), 'Good');
  });

  test('窗口外：-301 / 301 → Miss', () => {
    assert.equal(judgeAt(-301), 'Miss');
    assert.equal(judgeAt(301), 'Miss');
  });

  test('同一个 note 只判定一次', () => {
    const target = note({ timeMs: 1000, gridCellId: 1 });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.submit(down({ timeMs: 1000, gridCellId: 1 }));

    assert.equal(target.judgement, 'Perfect');
    assert.equal(session.counts.perfect, 1);
    assert.equal(session.counts.miss, 0);
  });

  test('不调用 advance 时不会自行产生 Miss（暂停冻结）', () => {
    const target = note({ timeMs: 1000, gridCellId: 1 });
    snapshot([target]);
    assert.equal(target.judgement, 'Pending');
  });
});
