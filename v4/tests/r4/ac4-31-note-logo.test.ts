import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BlindMode } from '../../core/chart/blind';
import { down, note, snapshot } from './helpers';

describe('R4a AC4-31 Logo 引导', () => {
  test('提前量出现，Tap 到判定后存活窗口结束消失', () => {
    const target = note({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const session = snapshot([target]);
    assert.ok(target.logo);
    assert.equal(target.logo?.appearAtMs, -500);
    assert.equal(target.logo?.expireAtMs, 1400);
    assert.equal(target.logo?.state, 'Pending');

    session.advance(500);
    assert.equal(target.logo?.state, 'Visible');

    session.advance(1400);
    assert.equal(target.logo?.state, 'Done');
  });

  test('Hold 延长到 duration + NoteLogoHoldExtensionMs', () => {
    const target = note({ timeMs: 1000, durationMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const session = snapshot([target]);
    assert.equal(target.logo?.expireAtMs, 2300);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    session.advance(2000);
    assert.equal(target.logo?.state, 'Visible');

    session.advance(2300);
    assert.equal(target.logo?.state, 'Done');
  });

  test('Miss 触发 NoteLogoMiss，红闪 300ms 后 Done', () => {
    const target = note({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const session = snapshot([target]);

    session.advance(1301);
    assert.equal(target.judgement, 'Miss');
    assert.equal(target.logo?.state, 'Missed');
    assert.equal(session.logoMisses.length, 1);
    assert.equal(session.logoMisses[0]?.noteIndex, target.noteIndex);
    assert.equal(session.logoMisses[0]?.atMs, 1301);

    session.advance(1600);
    assert.equal(target.logo?.state, 'Missed');

    session.advance(1601);
    assert.equal(target.logo?.state, 'Done');
  });

  test('第 3+ 层不生成 Logo', () => {
    const target = note({ timeMs: 1000, chartLayerIndex: 3 });
    assert.equal(target.logo, null);
  });

  test('BlindMode 不影响判定，只由 P 层决定是否渲染', () => {
    const target = note({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 1 });
    const session = snapshot([target], { blindMode: BlindMode.On });

    assert.equal(session.blindMode, BlindMode.On);
    assert.ok(target.logo);

    session.submit(down({ timeMs: 1000, gridCellId: 1 }));
    assert.equal(target.judgement, 'Perfect');
    assert.equal(session.counts.perfect, 1);
  });
});
