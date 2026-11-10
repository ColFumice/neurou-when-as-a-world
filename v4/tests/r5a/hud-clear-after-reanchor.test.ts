import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { canReanchor } from '../../app/src/game/audioClock';
import { ClockDriftMonitor, clockDriftHud } from '../../app/src/game/clockDrift';
import type { ClockDriftReading } from '../../app/src/game/clockDrift';

class FakeClock {
  count = 0;

  reanchor(): void {
    this.count += 1;
  }
}

interface HudState {
  hud: ClockDriftReading | null;
  lastReanchorWallMs: number;
}

/** 与 GameScreen 的触发顺序一致：detect → clock.reanchor → clear HUD。 */
function applyDrift(
  monitor: ClockDriftMonitor,
  clock: FakeClock,
  state: HudState,
  playheadMs: number,
  wallMs: number,
): void {
  const reading = monitor.sample(playheadMs, wallMs);
  if (reading.shouldReanchor && canReanchor(wallMs, state.lastReanchorWallMs)) {
    clock.reanchor();
    state.lastReanchorWallMs = wallMs;
    state.hud = reading.status === 'Critical' ? reading : null;
    return;
  }
  state.hud = reading;
}

describe('R5a.2 HUD clear after re-anchor', () => {
  test('warning class appears, re-anchor clears it immediately', () => {
    const monitor = new ClockDriftMonitor();
    const clock = new FakeClock();
    const state: HudState = { hud: null, lastReanchorWallMs: Number.NEGATIVE_INFINITY };
    monitor.start(0, 0);

    applyDrift(monitor, clock, state, 40, 0);
    assert.equal(clockDriftHud(state.hud)?.className, 'is-warning');

    applyDrift(monitor, clock, state, 70, 10);
    assert.equal(clock.count, 1);
    assert.equal(state.hud, null);
    assert.equal(clockDriftHud(state.hud), null);
  });

  test('critical drift keeps AUDIO OFFLINE HUD and pauses input', () => {
    const monitor = new ClockDriftMonitor();
    const clock = new FakeClock();
    const state: HudState = { hud: null, lastReanchorWallMs: Number.NEGATIVE_INFINITY };
    monitor.start(0, 0);

    applyDrift(monitor, clock, state, 120, 0);
    assert.equal(clock.count, 1);
    assert.equal(clockDriftHud(state.hud)?.message, 'AUDIO OFFLINE');
    assert.equal(monitor.inputPaused, true);
  });

  test('second re-anchor inside 2s is suppressed', () => {
    const monitor = new ClockDriftMonitor();
    const clock = new FakeClock();
    const state: HudState = { hud: null, lastReanchorWallMs: Number.NEGATIVE_INFINITY };
    monitor.start(0, 0);

    applyDrift(monitor, clock, state, 60, 0);
    applyDrift(monitor, clock, state, 1120, 1000);
    assert.equal(clock.count, 1);
    applyDrift(monitor, clock, state, 2180, 2000);
    assert.equal(clock.count, 2);
  });
});
