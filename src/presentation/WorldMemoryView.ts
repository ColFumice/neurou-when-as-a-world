import type { LedgerSnapshot, RecallCountSnapshot, ChartSnapshotCollection, ChartScoreSnapshot } from '../director/IntentPort';
import type { PlayerIntent } from '../director/PlayerIntent';

/** A player's own ledger memories and completed music vectors. Payloads remain read-only. */
export class WorldMemoryView {
  private root: HTMLElement | null = null;
  private lastData = '';
  constructor(private readonly read: () => { ledger: LedgerSnapshot; recalls: RecallCountSnapshot;
    snapshots: ChartSnapshotCollection; scores: ChartScoreSnapshot }, private readonly enqueue: (intent: PlayerIntent) => void) {}
  mount(): void {
    const root = document.createElement('aside'); root.id = 'world-memory-view';
    root.style.cssText = 'position:fixed;left:22px;top:90px;z-index:63;width:310px;max-height:45vh;overflow:auto;padding:14px 18px;background:#152b36ed;color:#dfedf1;border:1px solid #647d86;border-radius:7px;font:14px/1.5 system-ui';
    this.root = root; document.body.appendChild(root); this.refresh();
  }
  refresh(): void {
    if (!this.root) { return; }
    const state = this.read(), data = JSON.stringify(state);
    if (data === this.lastData) { return; } this.lastData = data;
    const root = this.root; root.replaceChildren();
    const title = document.createElement('strong'); title.textContent = '留在这里的记忆'; root.appendChild(title);
    const events = state.ledger.characters.find(character => character.characterId === state.ledger.protagonistCharacterId)?.events ?? [];
    if (!events.length) { const empty = document.createElement('p'); empty.textContent = '在站台做出选择，留下你的经历。'; root.appendChild(empty); }
    for (const event of events) {
      const row = document.createElement('div'); row.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid #67818d55';
      row.dataset.eventId = event.eventId;
      const label = event.eventId.startsWith('WORLD_NARRATIVE_CHOICE:') ? '雨中的选择' : event.eventId.startsWith('WORLD_PREMIERE_COMPLETED:')
        ? '雨后回响' : event.eventId === 'T6_ENDPOINT_PLACEHOLDER' ? '站台深痕' : event.eventId === 'T7_COMPLETION_PLACEHOLDER' ? '深痕旋律' : '一段经历';
      const count = state.recalls.records.find(value => value.characterId === state.ledger.protagonistCharacterId && value.eventId === event.eventId)?.count ?? 0;
      const text = document.createElement('p'); text.textContent = label + ' · 已回忆 ' + count + ' 次'; text.style.margin = '0 0 5px'; row.appendChild(text);
      const button = (caption: string, action: string, intent: PlayerIntent): void => {
        const control = document.createElement('button'); control.textContent = caption; control.dataset.action = action;
        control.dataset.eventId = event.eventId; control.style.cssText = 'margin:3px 8px 3px 0;padding:5px 10px;color:#ddecf1;background:#294a59;border:1px solid #6f919f;border-radius:4px;cursor:pointer';
        control.onclick = () => this.enqueue(intent); row.appendChild(control);
      };
      button('回忆', 'recall-event', { kind: 'RecallEvent', eventId: event.eventId });
      const trace = state.recalls.traceBindings.find(value => value.characterId === state.ledger.protagonistCharacterId && value.eventId === event.eventId);
      if (trace) { button('触碰这枚痕', 'replay-trace', { kind: 'ReplayTrace', traceId: trace.traceId }); }
      const snapshot = state.snapshots.records.find(value => value.completionEventId === event.eventId);
      if (snapshot) {
        button('选择这段旋律 · 重演', 'replay-chart', { kind: 'ReplayChart', completionEventId: event.eventId });
        const score = state.scores.records.find(value => value.chartId === snapshot.chartId);
        const caption = document.createElement('small'); caption.style.display = 'block';
        caption.textContent = score ? '最高 ' + score.best.totalScore + ' · 最近 ' + score.latest.totalScore + ' · 完整演奏 ' + score.completedPlayCount + ' 次' : '成绩不可用';
        row.appendChild(caption);
      }
      root.appendChild(row);
    }
    Object.assign(root.dataset, { recallTotal: String(state.recalls.records.reduce((sum, record) => sum + record.count, 0)),
      snapshotCount: String(state.snapshots.records.length), scoreCount: String(state.scores.records.length) });
  }
  setVisible(visible: boolean): void { if (this.root) { this.root.hidden = !visible; } }
  destroy(): void { this.root?.remove(); this.root = null; }
}
