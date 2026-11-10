import type { ChartPremiereReader } from '../chart/ChartPremiere';
import type { ChartSnapshotCollection } from '../director/IntentPort';
import type { PlayerIntent } from '../director/PlayerIntent';

/** Native media and read-only chart rendering for an already frozen performance. */
export class ChartReplayView {
  private root: HTMLElement | null = null;
  private media: HTMLMediaElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastActive = false;
  private lastState = 'Ready';
  private error = '';
  private generation = 0;
  constructor(private readonly record: ChartSnapshotCollection['records'][number],
    private readonly premiere: ChartPremiereReader, private readonly active: () => boolean,
    private readonly enqueue: (intent: PlayerIntent) => void, private readonly mediaUrl: string) {}

  mount(): void {
    const root = document.createElement('section'); root.id = 'chart-replay-view';
    root.style.cssText = 'position:fixed;inset:0;z-index:80;background:#132632;color:#e4f1f4;font:16px/1.6 system-ui;display:grid;grid-template-rows:auto 1fr auto;padding:22px;gap:15px';
    const header = document.createElement('header');
    const title = document.createElement('strong'); title.textContent = '回到这段旋律 · ' + this.premiere.getChartId();
    header.appendChild(title);
    const button = (text: string, id: string, click: () => void): void => {
      const node = document.createElement('button'); node.id = id; node.textContent = text;
      node.style.cssText = 'float:right;margin-left:14px;padding:8px 18px;background:#284958;color:#e4f1f4;border:1px solid #91aeb9;border-radius:5px;font:inherit';
      node.onclick = click; header.appendChild(node);
    };
    button('返回世界', 'exit-chart-replay', () => this.enqueue({ kind: 'ExitChart' }));
    button('暂停 / 继续', 'pause-chart-replay', () => this.enqueue({ kind: 'ToggleChartPause', videoTimeMs: Math.max(0, this.readTimeMs()) }));
    button('开启声音', 'unlock-chart-replay', () => this.play());
    const stage = document.createElement('div'); stage.style.cssText = 'position:relative;min-height:0';
    const media = document.createElement(this.record.media.kind === 'Video' ? 'video' : 'audio');
    media.preload = 'auto'; media.src = this.mediaUrl; media.dataset.role = 'chart-replay-media';
    if (media instanceof HTMLVideoElement) { media.style.cssText = 'position:absolute;width:100%;height:100%;object-fit:contain;opacity:.55'; }
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    stage.append(media, canvas);
    const footer = document.createElement('footer'); footer.id = 'chart-replay-status';
    root.append(header, stage, footer); document.body.appendChild(root);
    this.root = root; this.media = media; this.canvas = canvas;
    media.addEventListener('error', () => { this.error = '原媒体暂时不可用，请返回后重试。'; });
    this.refresh();
  }

  readTimeMs(): number {
    if (!this.media || this.media.readyState < 2 || this.media.seeking) { return -1; }
    if (this.premiere.getState() === 'Paused') { return this.premiere.getCurrentTimeMs(); }
    return !this.media.paused || this.media.ended ? this.media.currentTime * 1000 : -1;
  }
  getMediaStatus(): { ended: boolean; unavailable: boolean } {
    return { ended: this.media?.ended === true, unavailable: !this.media || this.media.error !== null || (this.media.paused && !this.media.ended) };
  }
  refresh(): void {
    if (!this.root || !this.media) { return; }
    const active = this.active(), state = this.premiere.getState(); this.root.hidden = !active;
    this.root.style.display = active ? 'grid' : 'none';
    if (active && !this.lastActive) { this.media.currentTime = 0; this.play(); }
    else if (!active && this.lastActive) { this.media.pause(); }
    else if (active && state !== this.lastState) {
      if (state === 'Paused') { this.media.pause(); this.media.currentTime = this.premiere.getCurrentTimeMs() / 1000; }
      else if (state === 'Playing') { this.play(); }
    }
    this.lastActive = active; this.lastState = state;
    Object.assign(this.root.dataset, { active: String(active), chartId: this.record.chart.chartId,
      chartState: state, snapshotId: this.record.contentDigest, mediaTimeMs: String(this.readTimeMs()), mediaEnded: String(this.media.ended) });
    this.root.querySelector('#chart-replay-status')!.textContent =
      '重演 · ' + state + ' · Perfect ' + this.premiere.getPerfectCount() + ' / Good ' + this.premiere.getGoodCount() +
      ' / Miss ' + this.premiere.getMissCount() + ' · 得分 ' + this.premiere.getTotalScore() + (this.error ? '\n' + this.error : '');
    if (active) { this.draw(); }
  }
  private play(): void {
    if (!this.media || !this.active()) { return; }
    const generation = this.generation;
    void this.media.play().then(() => { if (generation === this.generation) { this.error = ''; } }, () => {
      if (generation === this.generation) { this.error = '点击“开启声音”继续'; }
    });
  }
  private draw(): void {
    const canvas = this.canvas; if (!canvas) { return; }
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
      canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
    }
    const ctx = canvas.getContext('2d'); if (!ctx) { return; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const x = (u: number): number => u * rect.width, y = (v: number): number => (1 - v) * rect.height;
    for (const slot of this.record.layout.slots) {
      ctx.strokeStyle = '#91b3c355'; ctx.strokeRect(x(slot.u), y(slot.v + slot.height), slot.width * rect.width, slot.height * rect.height);
      ctx.fillStyle = '#d1e2e788'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(slot.keyId.replace(/^Key|^Digit/, ''), x(slot.u + slot.width / 2), y(slot.v + slot.height / 2));
    }
    const visuals = this.record.visual?.nodes ?? [];
    for (const line of this.premiere.getGuidanceSnapshots()) {
      ctx.strokeStyle = '#d6f3f8'; ctx.lineWidth = 3; ctx.beginPath();
      line.remainingPoints.forEach((point, index) => index ? ctx.lineTo(x(point.u), y(point.v)) : ctx.moveTo(x(point.u), y(point.v))); ctx.stroke();
      for (const node of line.nodes) {
        const color = visuals.find(value => value.nodeId === node.node.id)?.color;
        ctx.fillStyle = node.tier === 'Miss' ? '#986c69' : color ? `rgb(${color.r},${color.g},${color.b})` : '#bbdfe9';
        ctx.beginPath(); ctx.arc(x(node.position.u), y(node.position.v), 10, 0, Math.PI * 2); ctx.fill();
      }
      const head = line.judgmentPoint?.position ?? line.headPosition;
      ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x(head.u), y(head.v), 17, 0, Math.PI * 2); ctx.stroke();
    }
    if ('notes' in this.record.chart) {
      for (const note of this.record.chart.notes) {
        if (Math.abs(note.timeMs - this.premiere.getCurrentTimeMs()) > 500) { continue; }
        const slot = this.record.layout.slots.find(value => value.keyId === note.keyId); if (!slot) { continue; }
        ctx.fillStyle = '#c4eaf0'; ctx.beginPath(); ctx.arc(x(slot.u + slot.width / 2), y(slot.v + slot.height / 2), 16, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  destroy(): void { this.generation++; this.media?.pause(); this.root?.remove(); this.root = null; this.media = null; this.canvas = null; }
}
