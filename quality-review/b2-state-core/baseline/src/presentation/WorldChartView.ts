// B2.2c World chart presentation. Native audio drives the read-only media probe.
import type { ChartPremiereReader } from '../chart/ChartPremiere';
import type { GuidanceChart } from '../chart/GuidanceChart';
import type { KeyboardPadLayout } from '../chart/KeyboardPadLayout';
import type { GuidanceVisualData } from '../editor/GuidanceEditorSession';
import type { PlayerIntent } from '../director/PlayerIntent';
import type { WorldClearReader, AccountMilestoneReader } from '../director/IntentPort';
import type { FrameRefreshable } from './FrameDriver';

export class WorldChartView implements FrameRefreshable {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private mediaUrl = '';
  private chart: GuidanceChart | null = null;
  private layout: KeyboardPadLayout | null = null;
  private visual: GuidanceVisualData['nodes'] = [];
  private lastState = 'Ready';
  private lastActive = false;
  private mediaPlaying = false;
  private playPending = false;
  private playError = '';
  private lastTimeMs = -1;
  private generation = 0;

  constructor(
    private readonly premiere: ChartPremiereReader,
    private readonly enqueue: (intent: PlayerIntent) => void,
    private readonly world?: WorldClearReader,
    private readonly milestones?: AccountMilestoneReader,
  ) {}

  bindChart(chart: GuidanceChart, layout: KeyboardPadLayout, visual?: GuidanceVisualData): void {
    this.chart = chart; this.layout = layout; this.visual = visual?.nodes ?? [];
  }

  /** URL comes from the Cocos-loaded AudioClip.nativeUrl, never an arbitrary runtime content URL. */
  bindMedia(url: string): void {
    this.mediaUrl = url;
    if (this.audio) { this.audio.src = url; this.audio.load(); }
  }

  mount(): void {
    if (typeof document === 'undefined' || this.root) { return; }
    const root = document.createElement('section'); root.id = 'world-chart-view';
    root.setAttribute('aria-label', '世界之曲 · 雨后回响');
    root.innerHTML = `
      <style>
      #world-chart-view{position:fixed;inset:0;z-index:75;color:#e7f0f5;font:15px/1.5 system-ui,sans-serif;background:radial-gradient(ellipse at 52% 42%,#284d5b,#142730 60%,#111c24);display:grid;grid-template-rows:auto 1fr auto}
      #world-chart-view *{box-sizing:border-box}#world-chart-view [hidden]{display:none!important}
      #world-chart-view header{display:flex;align-items:center;gap:20px;padding:22px 28px;border-bottom:1px solid #5c819055}#world-chart-view h1{font-size:23px;font-weight:500;margin:0}#world-chart-view .rain-title{margin-right:auto}#world-chart-view .rain-subtitle{font-size:12px;color:#a0bfcb;margin-top:5px}
      #world-chart-view button{cursor:pointer;font:inherit;color:#dfedf4;background:#28424f;border:1px solid #5b7c8b;border-radius:5px;padding:8px 14px}#world-chart-view button:hover{background:#3c606f}#world-chart-view button:focus-visible{outline:2px solid #ceeaf1;outline-offset:3px}
      #world-chart-view .rain-chart-stage{min-height:0;position:relative;padding:20px 28px}#world-chart-view canvas{display:block;width:100%;height:100%;border:1px solid #496b7c66;border-radius:7px;background:#10212a66}#world-chart-view .rain-playing-caption{position:absolute;left:42px;top:29px;font-size:13px;color:#bfd3dd}
      #world-chart-view footer{border-top:1px solid #5c819055;padding:17px 28px 22px;background:#152a3388}#world-chart-view .rain-progress-row{display:flex;gap:18px;align-items:center;flex-wrap:wrap}#world-chart-view progress{flex:1;min-width:100px;height:5px;accent-color:#addbe0}#world-chart-view #world-chart-result{margin-top:10px;color:#add6c8}
      #world-chart-view #world-chart-account{font-size:13px;color:#afc6d0;margin-top:5px}#world-chart-view .rain-score{font-size:12px;color:#a5c0ca}#world-chart-view #world-chart-media-error{color:#ffd0a0;font-size:13px}
      @media(max-width:800px){#world-chart-view{font-size:13px}#world-chart-view header{padding:16px;gap:10px}#world-chart-view h1{font-size:20px}#world-chart-view .rain-chart-stage{padding:12px 16px}#world-chart-view footer{padding:12px 16px}#world-chart-view .rain-playing-caption{left:29px;top:21px}}
      </style>
      <header><div class="rain-title"><h1>雨后回响</h1><div class="rain-subtitle">世界之曲 · 旧站台</div></div><button type="button" id="pause-world-chart">暂停</button><button type="button" id="exit-world-chart">返回世界</button></header>
      <main class="rain-chart-stage"><canvas id="world-chart-canvas" aria-label="谱面键盘与引导线"></canvas><div class="rain-playing-caption" id="world-chart-instructions">按空格启动回响，再按引导线所到的键</div></main>
      <footer><div class="rain-progress-row"><span id="world-chart-state">准备</span><progress id="world-chart-progress" max="1" value="0"></progress><span id="world-chart-time">0.0 / 6.0 秒</span><span class="rain-score" id="world-chart-score"></span></div><div id="world-chart-result" hidden></div><div id="world-chart-account"></div><span id="world-chart-media-error" role="status" hidden></span><button type="button" id="unlock-world-chart-audio" hidden>开启声音</button></footer>`;
    this.root = root; this.canvas = root.querySelector<HTMLCanvasElement>('#world-chart-canvas');
    const audio = document.createElement('audio'); audio.preload = 'auto'; audio.src = this.mediaUrl;
    audio.dataset.role = 'world-chart-media'; root.appendChild(audio); this.audio = audio;
    audio.addEventListener('playing', () => {
      const state = this.premiere.getState();
      const active = this.world ? this.world.getWorldClearSnapshot().chartActive : state !== 'Ready' && state !== 'Exited';
      if (!active || (state !== 'Ready' && state !== 'Playing')) { audio.pause(); return; }
      this.mediaPlaying = true; this.playError = '';
    });
    audio.addEventListener('pause', () => { this.mediaPlaying = false; });
    audio.addEventListener('waiting', () => { this.mediaPlaying = false; });
    audio.addEventListener('ended', () => {
      this.mediaPlaying = false;
      this.lastTimeMs = Math.max(this.lastTimeMs, audio.currentTime * 1000);
    });
    audio.addEventListener('error', () => { this.mediaPlaying = false; this.playError = '雨声暂时无法播放，请返回世界后重试。'; });
    root.querySelector<HTMLButtonElement>('#exit-world-chart')!.onclick = () => this.enqueue({ kind: 'ExitChart' });
    root.querySelector<HTMLButtonElement>('#pause-world-chart')!.onclick = () => this.enqueue({ kind: 'ToggleChartPause', videoTimeMs: Math.max(0, this.readTimeMs()) });
    root.querySelector<HTMLButtonElement>('#unlock-world-chart-audio')!.onclick = () => this.play();
    document.body.appendChild(root); this.onFrameRefresh();
  }

  /** Browser audio currentTime is the media sample clock; before actual playing it is unavailable. */
  readTimeMs(): number {
    if (!this.audio || this.audio.readyState < 2 || this.audio.seeking) { return -1; }
    if (this.audio.ended) { return Math.max(this.lastTimeMs, this.audio.currentTime * 1000); }
    if (this.premiere.getState() === 'Paused') { return this.premiere.getCurrentTimeMs(); }
    if (!this.mediaPlaying) { return -1; }
    this.lastTimeMs = Math.max(this.lastTimeMs, this.audio.currentTime * 1000);
    return this.lastTimeMs;
  }

  getMediaStatus(): { ended: boolean; unavailable: boolean } {
    return { ended: this.audio?.ended === true,
      unavailable: !this.audio || this.audio.error !== null || (!this.mediaPlaying && !this.audio.ended) };
  }

  play(): void {
    const audio = this.audio;
    const state = this.premiere.getState();
    const readyEntry = state === 'Ready' && this.world?.getWorldClearSnapshot().chartActive === true;
    if (!audio || (state !== 'Playing' && !readyEntry) || this.playPending || this.mediaPlaying) { return; }
    const currentGeneration = this.generation;
    this.playPending = true;
    void audio.play().then(() => {
      if (this.generation === currentGeneration) { this.playPending = false; }
    }, error => {
      if (this.generation === currentGeneration) {
        this.playPending = false;
        this.playError = '点击“开启声音”继续聆听。' + (error instanceof Error ? '' : String(error));
      }
    });
  }
  pause(): void {
    this.generation++; this.playPending = false; this.audio?.pause(); this.mediaPlaying = false;
    // The input timestamp is the director's pause boundary, even if the DOM pause lands a frame later.
    this.lastTimeMs = Math.max(0, this.premiere.getCurrentTimeMs());
    if (this.audio && this.audio.currentTime !== this.lastTimeMs / 1000) {
      this.audio.currentTime = this.lastTimeMs / 1000;
    }
  }
  stop(): void {
    this.generation++; this.playPending = false; this.audio?.pause();
    if (this.audio) { this.audio.currentTime = 0; }
    this.mediaPlaying = false; this.lastTimeMs = -1; this.playError = '';
  }

  onFrameRefresh(): void {
    const root = this.root;
    if (!root) { return; }
    const state = this.premiere.getState();
    const active = this.world ? this.world.getWorldClearSnapshot().chartActive : state !== 'Ready' && state !== 'Exited';
    root.hidden = !active; root.style.display = active ? 'grid' : 'none';
    if (!active) {
      if (this.lastActive) { this.stop(); }
    } else if (!this.lastActive) {
      // Start the real media while the director is Ready. Its first sample enables begin().
      this.stop(); this.play();
    } else if (state !== this.lastState) {
      if (state === 'Playing') {
        this.play();
      } else if (state === 'Paused') { this.pause(); }
      else if (state === 'Exited') { this.stop(); }
      else if (state === 'Ready') { this.stop(); this.play(); }
      else if (state === 'Completed') { this.pause(); }
    }
    this.lastState = state; this.lastActive = active;
    // Ready has no logical pause state. A pending start interrupted before playing must remain retryable.
    if (active && state === 'Ready' && !this.mediaPlaying && !this.playPending && !this.playError) { this.play(); }
    root.dataset.chartId = this.premiere.getChartId(); root.dataset.tier = this.premiere.getTier();
    root.dataset.chartState = state; root.dataset.mediaEnded = String(this.audio?.ended === true);
    root.dataset.mediaTimeMs = String(this.readTimeMs()); root.dataset.completed = String(this.premiere.getResult()?.completed === true);
    const names: Record<string, string> = { Ready: '准备', Playing: '演奏中', Paused: '已暂停', Completed: '演奏完成', Exited: '已返回' };
    root.querySelector('#world-chart-state')!.textContent = names[state];
    root.querySelector<HTMLProgressElement>('#world-chart-progress')!.value = this.premiere.getProgress();
    const duration = Number.isFinite(this.audio?.duration) ? this.audio!.duration : 6;
    root.querySelector('#world-chart-time')!.textContent = (this.premiere.getCurrentTimeMs() / 1000).toFixed(1) + ' / ' + duration.toFixed(1) + ' 秒';
    root.querySelector('#world-chart-score')!.textContent = 'Perfect ' + this.premiere.getPerfectCount() + ' · Good ' + this.premiere.getGoodCount() + ' · Miss ' + this.premiere.getMissCount();
    const pause = root.querySelector<HTMLButtonElement>('#pause-world-chart')!;
    pause.hidden = state === 'Completed'; pause.textContent = state === 'Paused' ? '继续' : '暂停';
    const result = root.querySelector<HTMLElement>('#world-chart-result')!;
    result.hidden = state !== 'Completed'; result.textContent = state === 'Completed' ? '雨停了。世界之曲已经完整奏响。' : '';
    if (this.world) {
      const snapshot = this.world.getWorldClearSnapshot();
      root.dataset.completionStatus = snapshot.completionStatus;
      root.dataset.recordCount = snapshot.record ? '1' : '0';
      root.dataset.routeSignature = snapshot.record ? JSON.stringify(snapshot.record.routeSignature) : '';
      if (state === 'Completed') {
        result.textContent += snapshot.completionStatus === 'Completed' ? ' 世界通关已保存。'
          : snapshot.completionStatus === 'Failed' ? ' 保存未完成，请返回世界后重试。' : ' 正在保存同行的记忆。';
      }
    }
    if (this.milestones) {
      const milestone = this.milestones.getMilestoneSnapshot();
      root.dataset.firstWorldCleared = String(milestone.FirstWorldCleared); root.dataset.copyPermission = String(milestone.CopyPermission);
      root.querySelector('#world-chart-account')!.textContent = '首次世界通关：' + (milestone.FirstWorldCleared ? '已完成' : '未完成') + ' · 复制权限：' + (milestone.CopyPermission ? '已取得' : '未取得');
    }
    const error = root.querySelector<HTMLElement>('#world-chart-media-error')!;
    error.hidden = !this.playError; error.textContent = this.playError;
    root.querySelector<HTMLElement>('#unlock-world-chart-audio')!.hidden = !this.playError || (state !== 'Playing' && state !== 'Ready');
    if (active) { this.draw(); }
  }

  private draw(): void {
    const canvas = this.canvas, layout = this.layout, chart = this.chart;
    if (!canvas || !layout || !chart) { return; }
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d'); if (!ctx) { return; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    const mx = (u: number): number => u * width;
    const my = (v: number): number => (1 - v) * height;
    for (const slot of layout.slots) {
      ctx.fillStyle = '#577e8d15'; ctx.strokeStyle = '#7294a23d'; ctx.lineWidth = 1;
      ctx.fillRect(mx(slot.u), my(slot.v + slot.height), slot.width * width, slot.height * height);
      ctx.strokeRect(mx(slot.u), my(slot.v + slot.height), slot.width * width, slot.height * height);
      ctx.fillStyle = '#bfd4dd88'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = Math.max(11, Math.min(20, slot.width * width * 0.25)) + 'px system-ui';
      const label = slot.keyId.replace(/^Key|^Digit/, '');
      ctx.fillText(label, mx(slot.u + slot.width / 2), my(slot.v + slot.height / 2));
    }
    for (const snapshot of this.premiere.getGuidanceSnapshots()) {
      const data = chart.lines.find(line => line.id === snapshot.id); if (!data) { continue; }
      const points = snapshot.state === 'Running' ? snapshot.remainingPoints : data.path.points;
      if (snapshot.state !== 'Finished' && snapshot.state !== 'TimedOut' && points.length) {
        ctx.beginPath(); points.forEach((p, i) => { if (i) { ctx.lineTo(mx(p.u), my(p.v)); } else { ctx.moveTo(mx(p.u), my(p.v)); } });
        ctx.strokeStyle = '#b2e0eaaa'; ctx.lineWidth = 3; ctx.stroke();
      }
      for (const item of snapshot.nodes) {
        const color = this.visual.find(node => node.nodeId === item.node.id)?.color;
        const resolved = item.tier !== null;
        ctx.fillStyle = resolved ? item.tier === 'Miss' ? '#ac828188' : '#badcccaa'
          : color ? `rgb(${color.r},${color.g},${color.b})` : '#b4dbe5';
        ctx.beginPath(); ctx.arc(mx(item.position.u), my(item.position.v), resolved ? 8 : 11, 0, Math.PI * 2); ctx.fill();
      }
      if (snapshot.state === 'Waiting' || snapshot.state === 'Pending') {
        ctx.beginPath(); ctx.arc(mx(snapshot.headPosition.u), my(snapshot.headPosition.v), 17, 0, Math.PI * 2);
        ctx.strokeStyle = snapshot.state === 'Waiting' ? '#effbff' : '#99b8c388'; ctx.lineWidth = 3; ctx.stroke();
        ctx.font = '12px system-ui'; ctx.fillStyle = '#e3f4fa'; ctx.fillText('空格', mx(snapshot.headPosition.u), my(snapshot.headPosition.v) - 28);
      }
      if (snapshot.judgmentPoint) {
        const point = snapshot.judgmentPoint.position;
        ctx.beginPath(); ctx.arc(mx(point.u), my(point.v), 17, 0, Math.PI * 2);
        ctx.fillStyle = '#edfaff'; ctx.shadowColor = '#addfe9'; ctx.shadowBlur = 15; ctx.fill(); ctx.shadowBlur = 0;
      }
    }
  }

  destroy(): void { this.stop(); this.root?.remove(); this.root = null; this.canvas = null; this.audio = null; }
}
