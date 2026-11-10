import type { WorldCoreStateSnapshot } from '../director/IntentPort';

/** Read-only persistence status. No event, vector or permission inputs. */
export class WorldCoreStateView {
  private root: HTMLElement | null = null;
  constructor(private readonly read: () => {
    readonly snapshot: WorldCoreStateSnapshot | null;
    readonly restored: boolean;
    readonly boundary: string;
    readonly captureKind?: 'Complete' | 'Incomplete';
    readonly restoreKind?: 'Restored' | 'Rejected' | 'NotRequested';
  }) {}

  mount(): void {
    if (this.root || typeof document === 'undefined') { return; }
    const root = document.createElement('aside'); root.id = 'world-core-state';
    root.setAttribute('aria-label', '世界记忆');
    root.style.cssText = 'position:fixed;left:22px;bottom:24px;z-index:64;pointer-events:none;max-width:420px;padding:14px 18px;border:1px solid #647d86;border-radius:7px;background:#132734e8;color:#e0edf2;font:14px/1.6 system-ui,sans-serif;white-space:pre-line';
    this.root = root; document.body.appendChild(root); this.refresh();
  }

  refresh(): void {
    if (!this.root) { return; }
    const state = this.read(), snapshot = state.snapshot;
    const puzzle = snapshot?.sections.PuzzleProgress?.[0];
    const count = snapshot?.sections.Ledger?.characters.reduce((sum, character) => sum + character.events.length, 0) ?? 0;
    const time = snapshot?.sections.FormatTime;
    const parts = Number(!!snapshot?.sections.Ledger) + Number(!!puzzle) + Number(!!time) +
      Number(!!snapshot?.sections.RecallCount) + Number(!!snapshot?.sections.WorldLink) +
      Number(!!snapshot?.sections.ChartSnapshot) + Number(!!snapshot?.sections.ChartScore);
    const captureKind = state.captureKind ?? 'Incomplete';
    Object.assign(this.root.dataset, { restored: String(state.restored), ledgerCount: String(count),
      revision: String(snapshot?.revision ?? 'Unavailable'), puzzleStage: puzzle?.chain.stage ?? 'Unavailable',
      endpointSettled: String(puzzle?.control.endpointSettled ?? false), formatTime: String(time?.epochMs ?? 'Unavailable'),
      capturedParts: String(parts), captureKind, restoreKind: state.restoreKind ?? 'NotRequested', boundary: state.boundary,
      recallTotal: String(snapshot?.sections.RecallCount?.records.reduce((sum, value) => sum + value.count, 0) ?? 0),
      worldLink: snapshot?.sections.WorldLink?.kind ?? 'Unavailable',
      chartSnapshots: String(snapshot?.sections.ChartSnapshot?.records.length ?? 0),
      chartScores: String(snapshot?.sections.ChartScore?.records.length ?? 0) });
    this.root.textContent = '世界记忆 · ' + (state.restored ? '已恢复' : '已保存') +
      '\n账本：' + count + ' 条 · 版本 ' + (snapshot?.revision ?? 'Unavailable') +
      '\n解谜：' + (puzzle?.chain.stage ?? '无稳定检查点') + (puzzle?.control.endpointSettled ? ' · 终点已结算' : '') +
      '\nFormatTime：' + (time ? new Date(time.epochMs).toISOString() : 'Unavailable') +
      '\n回忆 ' + (snapshot?.sections.RecallCount?.records.reduce((sum, value) => sum + value.count, 0) ?? 0) +
      ' 次 · 谱面快照 ' + (snapshot?.sections.ChartSnapshot?.records.length ?? 0) + ' · 成绩 ' + (snapshot?.sections.ChartScore?.records.length ?? 0) +
      '\nWorldLink：' + (snapshot?.sections.WorldLink?.kind ?? 'Unavailable') +
      '\n完整载荷 ' + parts + '/7 · ' + captureKind + ' · ' + (state.restoreKind ?? 'NotRequested') + '\n' + state.boundary;
  }

  setVisible(visible: boolean): void { if (this.root) { this.root.hidden = !visible; } }
  destroy(): void { this.root?.remove(); this.root = null; }
}
