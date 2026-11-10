import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioOutputClock } from '../../core/chart/clock';
import { canReanchor } from '../../app/src/game/audioClock';
import { ClockDriftMonitor } from '../../app/src/game/clockDrift';
import { note, snapshot } from '../r4/helpers';

function clockAt(seconds: number): {
  readonly clock: AudioOutputClock;
  setOutput: (next: number) => void;
} {
  let output = seconds;
  const clock = new AudioOutputClock(10_000, () => ({
    outputSeconds: output,
    wallMs: output * 1000,
  }));
  return {
    clock,
    setOutput: (next: number) => {
      output = next;
    },
  };
}

describe('R5a.2 AudioOutputClock re-anchor', () => {
  test('fake 0/40/60/120ms drift classification', () => {
    for (const [drift, expected] of [
      [0, 'Stable'],
      [40, 'Warning'],
      [60, 'Reanchor'],
      [120, 'Critical'],
    ] as const) {
      const { clock, setOutput } = clockAt(0);
      clock.start(0);
      const monitor = new ClockDriftMonitor();
      monitor.start(0, 0);
      setOutput(drift / 1000);
      const reading = monitor.sample(clock.nowMs(), 0);
      assert.equal(reading.status, expected, `${drift}ms`);
    }
  });

  test('reanchor keeps playhead continuous, no jump', () => {
    const { clock, setOutput } = clockAt(0);
    clock.start(0);
    setOutput(0.06);
    const before = clock.nowMs();
    const returned = clock.reanchor();
    const after = clock.nowMs();
    assert.equal(returned, before);
    assert.equal(after, before);
    setOutput(0.07);
    assert.ok(Math.abs(clock.nowMs() - (before + 10)) < 1e-9);
  });

  test('reanchor does not touch ChartSnapshot counts/pending', () => {
    const chartNote = note({ timeMs: 1000, gridCellId: 1 });
    const chart = snapshot([chartNote], { durationMs: 5000 });
    const countsBefore = chart.counts;
    const revisionBefore = chart.revision;
    const { clock, setOutput } = clockAt(0);
    clock.start(0);
    setOutput(0.06);
    clock.nowMs();
    clock.reanchor();
    assert.deepEqual(chart.counts, countsBefore);
    assert.equal(chartNote.pending, true);
    assert.equal(chart.revision, revisionBefore);
  });

  test('pause/resume/seek do not regress after reanchor', () => {
    const { clock, setOutput } = clockAt(0);
    clock.start(0);
    setOutput(0.5);
    assert.equal(clock.nowMs(), 500);
    clock.pause();
    assert.equal(clock.reanchor(), 500);
    setOutput(0.8);
    assert.equal(clock.nowMs(), 500);
    clock.resume();
    setOutput(0.9);
    assert.equal(clock.nowMs(), 600);
    clock.seek(1000);
    setOutput(1.0);
    assert.equal(clock.nowMs(), 1100);
  });

  test('2s cooldown allows one reanchor per window', () => {
    let last = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (const wall of [0, 1000, 1999, 2000]) {
      if (canReanchor(wall, last)) {
        count += 1;
        last = wall;
      }
    }
    assert.equal(count, 2); // wall 0 and wall 2000
  });
});
