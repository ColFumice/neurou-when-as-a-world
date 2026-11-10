import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ClockDriftMonitor, clockDriftHud } from '../../app/src/game/clockDrift';

describe('R4f-patch AC4-24 HUD drift integration', () => {
  test('drift=40ms：HUD warning class，不 reanchor', () => {
    const monitor = new ClockDriftMonitor();
    monitor.start(0, 0);
    const sample = monitor.sample(40, 0);
    assert.equal(sample.status, 'Warning');
    assert.equal(sample.reanchored, false);
    assert.equal(sample.inputPaused, false);
    const hud = clockDriftHud(sample);
    assert.deepEqual(hud, {
      className: 'is-warning',
      message: 'CLOCK DRIFT WARNING',
    });
  });

  test('drift=60ms：HUD error class，trigger reanchor，不改 playhead', () => {
    const monitor = new ClockDriftMonitor();
    monitor.start(1000, 0);
    const sample = monitor.sample(1060, 0);
    assert.equal(sample.status, 'Reanchor');
    assert.equal(sample.reanchored, true);
    assert.equal(sample.inputPaused, false);
    assert.equal(sample.driftMs, 60);
    const hud = clockDriftHud(sample);
    assert.deepEqual(hud, { className: 'is-error', message: 'CLOCK DRIFT' });

    // 重锚仅移动监视基准；下一次对齐采样回到 Stable。
    const next = monitor.sample(1060, 10);
    assert.equal(next.status, 'Stable');
    assert.equal(next.driftMs, -10);
  });

  test('drift=120ms：HUD AUDIO OFFLINE，输入暂停', () => {
    const monitor = new ClockDriftMonitor();
    monitor.start(0, 0);
    const sample = monitor.sample(120, 0);
    assert.equal(sample.status, 'Critical');
    assert.equal(sample.inputPaused, true);
    assert.equal(sample.action, 'Suspend');
    assert.deepEqual(clockDriftHud(sample), {
      className: 'is-critical',
      message: 'AUDIO OFFLINE',
    });
  });

  test('Stable 不显示 HUD；reset 清 inputPaused', () => {
    const monitor = new ClockDriftMonitor();
    monitor.start(0, 0);
    assert.equal(clockDriftHud(monitor.sample(10, 0)), null);
    monitor.sample(120, 0);
    assert.equal(monitor.inputPaused, true);
    monitor.reset();
    assert.equal(monitor.inputPaused, false);
  });
});
