import type { IntentPort } from './IntentPort';
import type { PlayerIntent } from './PlayerIntent';
import type { RecallCountSession } from './RecallCountSession';
import { ChartPremiere, CHART_MEDIA_END_TIMEOUT_MS } from '../chart/ChartPremiere';
import type { ChartPremiereReader, ChartPlaybackResult } from '../chart/ChartPremiere';
import type { ChartSnapshotCollection } from './ChartArchive';
import type { LedgerSnapshot } from './LedgerHydration';
import type { ChartPlaybackState } from '../chart/ChartPlaybackState';

/** Replay consumes only an already completed ledger vector and its frozen content. */
export class ChartReplaySession implements IntentPort {
  private premiere: ChartPremiere | null = null;
  private active = false;
  private playId = '';
  private sequence = 0;
  private fallbackTimeMs = -1;
  private unavailableMs = 0;
  private clock: (() => number) | null = null;
  private media: (() => { ended: boolean; unavailable: boolean }) | null = null;

  constructor(private readonly legacy: IntentPort, private readonly recalls: RecallCountSession,
    private readonly callbacks: {
      readonly readLedger: () => LedgerSnapshot;
      readonly readSnapshots: () => ChartSnapshotCollection;
      readonly prepareMedia: (record: ChartSnapshotCollection['records'][number], premiere: ChartPremiereReader) => void;
      readonly saveResult: (chartId: string, playId: string, guideTransparency: number, result: ChartPlaybackResult) => void;
      readonly now: () => number;
    }) {}

  bindMedia(clock: () => number, media: () => { ended: boolean; unavailable: boolean }): void {
    this.clock = clock; this.media = media;
  }
  isActive(): boolean { return this.active; }
  getReader(): ChartPremiereReader | null { return this.premiere; }
  getCurrentPerceptionMode(): ReturnType<IntentPort['getCurrentPerceptionMode']> { return this.legacy.getCurrentPerceptionMode(); }
  getChartPlaybackState(): ChartPlaybackState { return this.active ? this.premiere!.getState() : this.legacy.getChartPlaybackState(); }
  isWorldMotionGated(): boolean { return this.active || this.legacy.isWorldMotionGated(); }

  submitFrameIntents(intents: readonly PlayerIntent[], dt: number): void {
    const beganActive = this.active;
    const replay = intents.find(intent => intent.kind === 'ReplayChart');
    if (replay?.kind === 'ReplayChart' && !this.active && !this.legacy.isWorldMotionGated()) { this.enter(replay.completionEventId); }
    const gated = beganActive || this.active;
    const remaining: PlayerIntent[] = [];
    for (const intent of intents) {
      if (intent.kind === 'ReplayChart') { continue; }
      if (gated) {
        if (!this.active) { continue; }
        if (intent.kind === 'Strike' && intent.keyId) { this.premiere!.submitStrike(intent); }
        else if (intent.kind === 'ToggleChartPause') { this.premiere!.togglePause(intent.videoTimeMs); }
        else if (intent.kind === 'ExitChart') { this.exit(); }
      } else if (intent.kind === 'RecallEvent') {
        if (!this.legacy.isWorldMotionGated()) { this.recalls.recall(intent.eventId); }
      } else if (intent.kind === 'ReplayTrace') {
        if (!this.legacy.isWorldMotionGated()) { this.recalls.replay(intent.traceId); }
      } else { remaining.push(intent); }
    }
    if (this.active) { this.drive(dt); }
    else if (!gated) { this.legacy.submitFrameIntents(remaining, dt); }
  }

  private enter(completionEventId: string): void {
    const ledger = this.callbacks.readLedger();
    const event = ledger.characters.find(character => character.characterId === ledger.protagonistCharacterId)?.events
      .find(value => value.eventId === completionEventId);
    if (!event) { throw new Error('VectorEntry 必须选择自己的合法首演完成账本向量'); }
    const record = this.callbacks.readSnapshots().records.find(value => value.completionEventId === completionEventId);
    if (!record) { throw new Error('历史首演实际内容缺失，不能用当前资源补造重演'); }
    if (event.ChartRef.chartId !== record.chartId || (event.ChartRef.state !== 'PremiereCompleted' &&
        !(event.ChartRef.state === undefined && event.eventId === 'T7_COMPLETION_PLACEHOLDER' && record.chart.tier === 'Regular'))) {
      throw new Error('VectorEntry 缺少合法首演完成引用');
    }
    const premiere = new ChartPremiere(record.chart, record.layout);
    premiere.setGuideTransparency(record.guideTransparency);
    const timestamp = this.callbacks.now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) { throw new Error('重演时钟无效'); }
    const sequence = this.sequence + 1;
    if (!Number.isSafeInteger(sequence)) { throw new Error('重演序号溢出'); }
    // Media preparation may reject. Do not gate the world until it succeeds.
    this.callbacks.prepareMedia(record, premiere);
    this.sequence = sequence;
    this.playId = 'CHART_REPLAY:' + timestamp + ':' + sequence;
    this.premiere = premiere; this.fallbackTimeMs = -1; this.unavailableMs = 0; this.active = true;
  }

  private drive(dt: number): void {
    if (!this.clock || !this.media || !this.premiere) { throw new Error('重演媒体读取口未装配'); }
    const media = this.media(), elapsed = Number.isFinite(dt) && dt >= 0 ? dt * 1000 : 0;
    if (this.premiere.getState() === 'Ready' || this.premiere.getState() === 'Playing') {
      this.unavailableMs = media.unavailable && !media.ended ? this.unavailableMs + elapsed : 0;
      if ((media.ended && this.premiere.getResolvedCount() < this.premiere.getTotalNoteCount()) ||
          this.unavailableMs >= CHART_MEDIA_END_TIMEOUT_MS) { this.fallbackTimeMs = this.premiere.getCurrentTimeMs() + elapsed; }
    }
    const native = this.clock(), time = Math.max(Number.isFinite(native) ? native : -1, this.fallbackTimeMs);
    if (this.premiere.getState() === 'Ready' && time >= 0) { this.premiere.begin(); }
    if (this.premiere.getState() === 'Playing' && time >= 0) { this.premiere.advance(time); }
    this.premiere.advanceMediaStatus(media.ended, media.unavailable, elapsed);
    if (this.premiere.getState() === 'Completed') { this.exit(); }
  }

  private exit(): void {
    if (!this.active || !this.premiere) { return; }
    const result = this.premiere.getResult();
    if (this.premiere.getState() === 'Completed' && result?.completed) {
      this.callbacks.saveResult(this.premiere.getChartId(), this.playId, this.premiere.getGuideTransparency(), result);
    }
    this.premiere.requestExit(Math.max(0, this.premiere.getCurrentTimeMs())); this.active = false;
  }
}
