/**
 * R5a.3 · HUD Downbeat 纯辅助。
 * 只决定显示信息与越过点，不参与判定。
 */
import type { BeatsSidecar } from '../audio/beatsSidecar';

export interface DownbeatDisplay {
  readonly bpm: number;
  readonly meter: 4;
}

export function downbeatDisplay(sidecar: BeatsSidecar | null): DownbeatDisplay | null {
  if (!sidecar || sidecar.bpm < 60 || sidecar.bpm > 200 || sidecar.meter !== 4) {
    return null;
  }
  return { bpm: sidecar.bpm, meter: 4 };
}

/** 返回 (lastPlayheadMs, nowMs] 内经过的 downbeat。 */
export function crossedDownbeats(
  downbeatsMs: readonly number[],
  lastPlayheadMs: number,
  nowMs: number,
): number[] {
  if (!Number.isFinite(nowMs) || nowMs < lastPlayheadMs) return [];
  return downbeatsMs.filter((time) => time > lastPlayheadMs && time <= nowMs);
}
