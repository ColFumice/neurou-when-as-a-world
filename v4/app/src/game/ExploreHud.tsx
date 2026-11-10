import type { GameLedgerStatus } from './gameLedgerHost';

interface ExploreHudProps {
  readonly worldId: string;
  readonly chartId: string;
  readonly playheadMs: number;
  readonly traceCount: number;
  readonly frameActive: boolean;
  readonly frameLabel: string;
  readonly notice: string | null;
  readonly warning: string | null;
  readonly ledgerStatus: GameLedgerStatus;
}

function timeText(ms: number): string {
  const value = Math.max(0, ms);
  const seconds = Math.floor(value / 1000);
  const millis = Math.floor(value % 1000);
  return `${String(seconds).padStart(3, '0')}.${String(millis).padStart(3, '0')}`;
}

/** R5c-B · Explore 的液态玻璃 HUD；不显示 8 格/判定/Score。 */
export function ExploreHud({
  worldId,
  chartId,
  playheadMs,
  traceCount,
  frameActive,
  frameLabel,
  notice,
  warning,
  ledgerStatus,
}: ExploreHudProps) {
  return (
    <div className="game-explore" data-mode="explore">
      <section className="game-explore__card">
        <p className="game-explore__eyebrow">NEUROU / EXPLORE</p>
        <h1>{worldId}</h1>
        <p className="game-explore__sub">{chartId} · 视差探索</p>
        <div className="game-explore__stats">
          <span>
            <b>{timeText(playheadMs)}</b>
            <small>TIME</small>
          </span>
          <span>
            <b>{traceCount}</b>
            <small>TRACE</small>
          </span>
          <span>
            <b>{frameActive ? 'ON' : 'IDLE'}</b>
            <small>FRAME</small>
          </span>
          <span>
            <b>{ledgerStatus}</b>
            <small>LEDGER</small>
          </span>
        </div>
        <p className="game-explore__hint">
          {frameLabel} · SHIFT + 方向键移动框 · SHIFT + ENTER 痕对齐
        </p>
        {notice ? <p className="game-explore__notice">{notice}</p> : null}
        {warning ? <p className="game-explore__warning">{warning}</p> : null}
      </section>
    </div>
  );
}
