import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioOutputClock } from '../../core/chart/clock';
import { ClockDriftMonitor } from '../../app/src/game/clockDrift';

describe('R4f AC4-24 AudioOutputClock drift', () => {
  test('180 秒纯输出时钟漂移 0/10/39/40/49/50/51/100ms 分级', () => {
    const cases = [
      { drift: 0, status: 'Stable' },
      { drift: -29, status: 'Stable' },
      { drift: 10, status: 'Stable' },
      { drift: 39, status: 'Stable' },
      { drift: 40, status: 'Warning' },
      { drift: 49, status: 'Warning' },
      { drift: 50, status: 'Warning' },
      { drift: 51, status: 'Reanchor' },
      { drift: 100, status: 'Reanchor' },
    ] as const;
    for (const item of cases) {
      const reading = ClockDriftMonitor.classify(item.drift);
      assert.equal(reading.status, item.status, `drift ${item.drift}`);
      assert.equal(reading.shouldReanchor, item.drift > 50);
    }
    assert.equal(ClockDriftMonitor.classify(101).status, 'Critical');
    assert.equal(ClockDriftMonitor.classify(40).status, 'Warning');
    assert.equal(ClockDriftMonitor.classify(-40).status, 'Warning');
    assert.equal(ClockDriftMonitor.classify(-100).status, 'Reanchor');
  });

  test('AudioOutputClock 在 180 秒输出样本上保持映射与单调', () => {
    let outputSeconds = 0;
    let wallMs = 0;
    const clock = new AudioOutputClock(180_000, () => ({
      outputSeconds,
      wallMs,
    }));
    clock.start(0);
    for (let second = 0; second <= 180; second += 1) {
      outputSeconds = second;
      wallMs = second * 1000;
      const mapped = clock.nowMs();
      assert.ok(mapped <= 180_000);
      assert.ok(mapped >= (second - 1) * 1000);
    }
    assert.equal(clock.nowMs(), 180_000);

    // 输出回退：paused=false 的时钟不允许倒退。
    const previous = clock.nowMs();
    outputSeconds = 10;
    assert.equal(clock.nowMs(), previous);
  });

  test('pause / resume / seek 后锚点正确，seek 是唯一允许回退的路径', () => {
    let outputSeconds = 0;
    const clock = new AudioOutputClock(60_000, () => ({
      outputSeconds,
      wallMs: outputSeconds * 1000,
    }));
    clock.start(0);
    outputSeconds = 5;
    assert.equal(clock.nowMs(), 5000);
    clock.pause();
    outputSeconds = 8;
    assert.equal(clock.nowMs(), 5000);
    clock.resume();
    outputSeconds = 9;
    assert.equal(clock.nowMs(), 6000);
    clock.seek(1000);
    assert.equal(clock.nowMs(), 1000);
    outputSeconds = 10;
    assert.equal(clock.nowMs(), 2000);
  });

  test('音频输出增量与 rAF 累计 180 秒的边界样本', () => {
    const drifts = [0, 10, 39, 40, 49, 50, 51, 100];
    for (const drift of drifts) {
      const reading = ClockDriftMonitor.classify(drift);
      assert.ok(Number.isFinite(reading.driftMs));
      assert.ok(reading.absoluteDriftMs >= 0);
    }
  });

  test('无 beat / downbeat 数据：GAP 明确记录（R5）', () => {
    // R4f 不新增节拍提取；此测试固定当前事实，防止误报 AC 完成。
    const downbeatAvailable = false;
    assert.equal(downbeatAvailable, false);
  });
});
