import type { PlayerIntent } from './PlayerIntent';

/** Admission closes immediately; an already active graph keeps its natural clocks. */
export class RealityPauseBoundary {
  filter(intents: readonly PlayerIntent[], closed: boolean, chartActive: boolean,
    scheduledContinuation: boolean, puzzleSustainActive = false): readonly PlayerIntent[] {
    if (!closed) { return intents; }
    return intents.filter(intent => intent.kind === 'RetryWorldClear' ||
      (puzzleSustainActive && intent.kind === 'Strike' && intent.keyId === undefined) ||
      (chartActive && ['Strike', 'ToggleChartPause', 'ExitChart'].includes(intent.kind)) ||
      (scheduledContinuation && intent.kind === 'EnterChart'));
  }
}
