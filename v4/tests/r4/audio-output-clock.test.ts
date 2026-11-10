import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioOutputClock } from '../../core/chart/clock';

function fakeClock(durationMs = 4000): {
  readonly clock: AudioOutputClock;
  setOutput(seconds: number): void;
} {
  let outputSeconds = 10;
  const clock = new AudioOutputClock(durationMs, () => ({
    outputSeconds,
    wallMs: outputSeconds * 1000,
  }));
  return {
    clock,
    setOutput(seconds: number) {
      outputSeconds = seconds;
    },
  };
}

describe('R4a AudioOutputClock 纯映射', () => {
  test('start 建立锚点，输出推进映射到 playhead', () => {
    const { clock, setOutput } = fakeClock();
    clock.start(0);
    assert.equal(clock.nowMs(), 0);

    setOutput(10.5);
    assert.equal(clock.nowMs(), 500);
    assert.equal(clock.playheadMs, 500);

    setOutput(12);
    assert.equal(clock.nowMs(), 2000);
  });

  test('pause 冻结，resume 重新锚定', () => {
    const { clock, setOutput } = fakeClock();
    clock.start(0);
    setOutput(10.5);
    assert.equal(clock.nowMs(), 500);

    clock.pause();
    setOutput(20);
    assert.equal(clock.nowMs(), 500);
    assert.equal(clock.running, false);

    clock.resume();
    assert.equal(clock.nowMs(), 500);
    setOutput(20.5);
    assert.equal(clock.nowMs(), 1000);
  });

  test('seek 运行中重建锚点', () => {
    const { clock, setOutput } = fakeClock();
    clock.start(0);
    setOutput(10.5);
    assert.equal(clock.nowMs(), 500);

    clock.seek(3000);
    assert.equal(clock.nowMs(), 3000);
    setOutput(10.6);
    assert.equal(Math.round(clock.nowMs()), 3100);
  });

  test('clamp 到 duration，且同一次运行内不倒退', () => {
    const { clock, setOutput } = fakeClock(2000);
    clock.start(0);
    setOutput(12);
    assert.equal(clock.nowMs(), 2000);

    setOutput(10.1);
    assert.equal(clock.nowMs(), 2000);
  });

  test('未来锚点：到点前保持 offset', () => {
    const { clock, setOutput } = fakeClock();
    clock.start(0, 11);

    setOutput(10.5);
    assert.equal(clock.nowMs(), 0);

    setOutput(11);
    assert.equal(clock.nowMs(), 0);

    setOutput(11.5);
    assert.equal(clock.nowMs(), 500);
  });

  test('seek 在暂停时只改目标值', () => {
    const { clock } = fakeClock();
    clock.seek(1200);
    assert.equal(clock.nowMs(), 1200);
    assert.equal(clock.running, false);
  });
});
