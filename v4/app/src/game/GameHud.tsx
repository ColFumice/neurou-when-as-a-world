import type { ClockDriftReading } from './clockDrift';
import { clockDriftHud } from './clockDrift';

interface HudCounts {
  readonly perfect: number;
  readonly good: number;
  readonly miss: number;
  readonly combo: number;
  readonly maxCombo: number;
}

interface GameHudProps {
  readonly chartId: string;
  readonly worldId: string;
  readonly playheadMs: number;
  readonly durationMs: number;
  readonly counts: HudCounts;
  readonly score: number;
  readonly audio: boolean;
  readonly source: string;
  readonly warning: string | null;
  readonly clockDrift?: ClockDriftReading | null;
  readonly ledgerStatus?: 'Ready' | 'PremiereRecorded' | 'Corrupt' | 'Unavailable' | null;
  readonly beats?: { readonly bpm: number; readonly meter: 4 } | null;
  readonly downbeatPulse?: boolean;
}

function timeText(ms: number): string {
  const safe = Math.max(0, ms);
  const seconds = Math.floor(safe / 1000);
  const millis = Math.floor(safe % 1000);
  return `${String(seconds).padStart(3, '0')}.${String(millis).padStart(3, '0')}`;
}

export function GameHud({
  chartId,
  worldId,
  playheadMs,
  durationMs,
  counts,
  score,
  audio,
  source,
  warning,
  clockDrift = null,
  ledgerStatus = null,
  beats = null,
  downbeatPulse = false,
}: GameHudProps) {
  const progress = durationMs <= 0 ? 0 : Math.min(1, Math.max(0, playheadMs / durationMs));
  const driftHud = clockDriftHud(clockDrift);

  return (
    <div className="game-hud" aria-hidden="true">
      <div className="game-hud__top">
        <div className="game-hud__identity">
          <span className="game-hud__eyebrow">NEUROU / PLAY</span>
          <strong>{chartId}</strong>
          <span className="game-hud__sub">WORLD {worldId} · {source.toUpperCase()}</span>
        </div>
        <div className="game-hud__score">
          <span>SCORE</span>
          <strong>{String(score).padStart(6, '0')}</strong>
        </div>
        <div className="game-hud__counts">
          <span className="is-perfect">PERFECT <b>{counts.perfect}</b></span>
          <span className="is-good">GOOD <b>{counts.good}</b></span>
          <span className="is-miss">MISS <b>{counts.miss}</b></span>
        </div>
      </div>

      <div className="game-hud__combo">
        <span>COMBO</span>
        <strong>{counts.combo}</strong>
        <span>/ MAX {counts.maxCombo}</span>
      </div>

      <div className="game-hud__bottom">
        <span>{timeText(playheadMs)}</span>
        <div className="game-hud__bar">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <span>{timeText(durationMs)}</span>
        <span className={`game-hud__audio${audio ? '' : ' is-offline'}`}>
          {audio ? 'AUDIO / WEB' : 'AUDIO / OFFLINE'}
        </span>
      </div>

      {warning ? <div className="game-hud__warning">{warning}</div> : null}
      {driftHud ? (
        <div className={`game-hud__clock ${driftHud.className}`} role="alert">
          {driftHud.message}
        </div>
      ) : null}
      {ledgerStatus === 'Corrupt' ? (
        <div className="game-hud__ledger is-corrupt" role="status">
          LEDGER / CORRUPT · READ ONLY
        </div>
      ) : null}
      {beats ? (
        <div className="game-hud__beats" role="status">
          <span>BPM {beats.bpm.toFixed(2)}</span>
          <span>{beats.meter}/4</span>
          <i className={`game-hud__downbeat${downbeatPulse ? ' is-pulse' : ''}`} />
        </div>
      ) : null}
    </div>
  );
}
