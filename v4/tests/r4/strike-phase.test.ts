import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { down, note, snapshot, up } from './helpers';

describe('R4a Strike phase/source', () => {
  test('phase 缺省 Down：能命中并启动 Hold', () => {
    const target = note({ timeMs: 1000, durationMs: 1000, gridCellId: 1 });
    const session = snapshot([target]);

    session.submit({ timeMs: 1000, gridCellId: 1 });

    assert.equal(target.judgement, 'Perfect');
    assert.ok(target.hold);
    assert.equal(target.hold?.triggerGridCellId, 1);
    assert.equal(session.counts.perfect, 1);
  });

  test('phase Up 在 Hold 结束窗口内完成，不重复计分', () => {
    const target = note({ timeMs: 1000, durationMs: 1000, gridCellId: 1 });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.submit(up({ timeMs: 1900, gridCellId: 1 }));

    assert.equal(target.judgement, 'Perfect');
    assert.equal(target.hold, null);
    assert.equal(session.counts.perfect, 1);
    assert.equal(session.counts.miss, 0);
  });

  test('结束前 500ms 松手仍完成 Hold', () => {
    const target = note({ timeMs: 1000, durationMs: 1000, gridCellId: 1 });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.submit(up({ timeMs: 1500, gridCellId: 1 }));

    assert.equal(target.judgement, 'Perfect');
    assert.equal(target.hold, null);
    assert.equal(session.counts.perfect, 1);
    assert.equal(session.counts.miss, 0);
  });

  test('phase Up 提前松手 → Hold Miss', () => {
    const target = note({ timeMs: 1000, durationMs: 1000, gridCellId: 1 });
    const session = snapshot([target]);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.submit(up({ timeMs: 1400, gridCellId: 1 }));

    assert.equal(target.judgement, 'Miss');
    assert.equal(target.hold, null);
    assert.equal(session.counts.perfect, 0);
    assert.equal(session.counts.miss, 1);
  });

  test('source 缺省 Keyboard；Pointer 不命中第 1 层 Space', () => {
    const layerOne = note({ timeMs: 1000, chartLayerIndex: 1 });
    const session = snapshot([layerOne]);

    session.submit(down({ timeMs: 1000, source: 'Pointer' }));
    assert.equal(layerOne.judgement, 'Pending');

    session.submit(down({ timeMs: 1000, chartKeyId: 'Space' }));
    assert.equal(layerOne.judgement, 'Perfect');
  });
});
