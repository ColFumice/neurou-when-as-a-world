// B2.2c: an independent World premiere orchestrator around the unchanged legacy session.
import { VectorSchemaVersion } from '../../constants';
import type { ChartEntry } from '../chart/ChartEntry';
import type { ChartPlaybackState } from '../chart/ChartPlaybackState';
import { CHART_MEDIA_END_TIMEOUT_MS } from '../chart/ChartPremiere';
import type { ChartPremiere, ChartPremiereReader } from '../chart/ChartPremiere';
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent, NarrativeVector } from '../ledger/NarrativeEvent';
import { deriveLedgerPosition } from '../ledger/deriveLedgerPosition';
import type { IntentPort } from './IntentPort';
import type { PerceptionMode, PlayerIntent } from './PlayerIntent';
import { hasChartPremiereCompleted } from './ChartReference';
import { deriveRouteSignature, validateWorldClearRecord } from './RouteSignature';
import type { WorldClearRecord } from './RouteSignature';
import { SphereCrossing } from './SphereCrossing';
import { parseWorldNarrativeContent } from './WorldNarrativeContent';
import type { WorldNarrativeContent } from './WorldNarrativeContent';
import { LedgerHydration, validateLedgerNarrativeEvent } from './LedgerHydration';
import type { LedgerSnapshot } from './LedgerHydration';

export interface WorldGameplayContext {
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary';
  readonly protagonistCharacterId: string;
}

export type WorldClearCompletionStatus = 'NotCleared' | 'Pending' | 'Failed' | 'Completed' | 'Inherited';

export interface WorldClearSnapshot {
  readonly context: WorldGameplayContext;
  readonly contentId: string;
  readonly contentRevision: string;
  readonly interaction: { readonly title: string; readonly prompt: string;
    readonly choices: readonly { readonly choiceId: string; readonly label: string; readonly meaning: string }[] };
  readonly selectedChoiceId: string | null;
  readonly ledgerPosition: NarrativeVector;
  readonly distance: number;
  readonly EventDistance: number;
  readonly sphereCrossed: boolean;
  readonly entry: ChartEntry | null;
  readonly mediaReady: boolean;
  readonly chartState: ChartPlaybackState;
  readonly chartActive: boolean;
  readonly completionStatus: WorldClearCompletionStatus;
  readonly completionError: string | null;
  readonly record: WorldClearRecord | null;
  readonly ledgerEventCount: number;
}

export interface WorldClearReader {
  getWorldClearSnapshot(): WorldClearSnapshot;
}

export interface WorldClearCallbacks {
  commitRecord(record: WorldClearRecord): Promise<void>;
  readRecords(): readonly WorldClearRecord[];
  now(): number;
  /** A successful return means the complete next Ledger section is durable. */
  persistLedger?(snapshot: LedgerSnapshot): void;
}

function validId(raw: unknown, label: string, maximum: number): asserts raw is string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(`${label}身份无效`);
  }
  try { encodeURIComponent(raw); } catch { throw new Error(`${label}身份编码无效`); }
}

export class WorldClearSession implements IntentPort, WorldClearReader {
  private readonly context: WorldGameplayContext;
  private readonly content: WorldNarrativeContent;
  private readonly crossing: SphereCrossing;
  private readonly ledgerHydration: LedgerHydration;
  private readonly ledgers = new Map<string, NarrativeEvent[]>();
  private selectedChoiceId: string | null = null;
  private entry: ChartEntry | null = null;
  private premiere: ChartPremiere | null = null;
  private clockProbe: (() => number) | null = null;
  private mediaProbe: (() => { ended: boolean; unavailable: boolean }) | null = null;
  private chartActive = false;
  private mediaUnavailableElapsedMs = 0;
  private fallbackTimeMs = -1;
  private completionStatus: WorldClearCompletionStatus = 'NotCleared';
  private completionError: string | null = null;
  private record: WorldClearRecord | null = null;
  private completionCandidate: WorldClearRecord | null = null;
  private completionEventId: string | null = null;
  private eventSequence = 0;

  constructor(context: WorldGameplayContext, content: WorldNarrativeContent, private readonly legacy: IntentPort,
    private readonly callbacks: WorldClearCallbacks, hydrated?: LedgerSnapshot) {
    validId(context.accountId, '账号', 64); validId(context.worldId, '世界', 128);
    validId(context.protagonistCharacterId, '主角', 128);
    if (context.worldKind !== 'Primary') { throw new Error('本批真实世界通关只接受 Primary 世界'); }
    this.content = parseWorldNarrativeContent(content);
    if (this.content.protagonistCharacterId !== context.protagonistCharacterId) { throw new Error('世界内容主角身份不匹配'); }
    this.context = Object.freeze({ accountId: context.accountId, worldId: context.worldId,
      worldKind: 'Primary', protagonistCharacterId: context.protagonistCharacterId });
    this.ledgerHydration = new LedgerHydration(this.context, this.content);
    const seed = hydrated === undefined ? null : this.ledgerHydration.validate(hydrated);
    this.crossing = new SphereCrossing(this.content.EventSpaceCenter, this.content.EventDistance,
      seed?.control.sphereCrossed ?? false);
    if (seed === null) { this.ledgers.set(context.protagonistCharacterId, []); }
    else {
      for (const character of seed.characters) { this.ledgers.set(character.characterId, character.events.slice()); }
      this.selectedChoiceId = seed.control.selectedChoiceId;
      this.entry = seed.control.entry;
      this.eventSequence = seed.control.eventSequence;
      this.completionEventId = seed.control.completionEventId;
      if (this.completionEventId !== null) {
        this.completionCandidate = this.deriveCompletionCandidate(this.completionEventId);
        this.completionStatus = 'Failed';
        this.completionError = '已恢复合法完成账本；账号保存待显式重试。';
      }
    }
    const existing = callbacks.readRecords().map(value => validateWorldClearRecord(value, context.accountId))
      .filter(value => value.worldId === context.worldId);
    if (existing.length > 1) { throw new Error('同一账号世界存在重复通关记录'); }
    if (existing.length === 1) {
      if (existing[0].protagonistCharacterId !== context.protagonistCharacterId) { throw new Error('已通关世界主角身份冲突'); }
      if (this.completionCandidate !== null && JSON.stringify(existing[0]) !== JSON.stringify(this.completionCandidate)) {
        throw new Error('账号通关记录与已恢复 Ledger 完成事实冲突');
      }
      this.record = existing[0]; this.completionStatus = 'Completed';
      this.completionError = null;
      this.completionCandidate = null;
    }
  }

  bindWorldChart(premiere: ChartPremiere, clockProbe: () => number,
    mediaProbe: () => { ended: boolean; unavailable: boolean }): void {
    if (this.chartActive || this.premiere !== null) { throw new Error('World 首演装配不可重复绑定'); }
    if (premiere.getTier() !== 'World' || premiere.getChartId() !== this.content.worldBossChartSource.chartId) {
      throw new Error('World 首演必须匹配正式内容指定的 World 谱面');
    }
    this.premiere = premiere; this.clockProbe = clockProbe; this.mediaProbe = mediaProbe;
  }

  /** The legacy T6/T7 append sink is explicitly bound here, pairing all reads and writes. */
  appendLegacyEvent(narrativeEvent: NarrativeEvent, targetCharacterId = this.context.protagonistCharacterId): void {
    this.appendEvent(narrativeEvent, targetCharacterId);
  }

  getLedgerEvents(): readonly NarrativeEvent[] {
    return Object.freeze((this.ledgers.get(this.context.protagonistCharacterId) ?? []).slice());
  }

  getLedgerSnapshot(): LedgerSnapshot {
    return this.ledgerHydration.validate(this.buildLedgerSnapshot(this.ledgers, {
      selectedChoiceId: this.selectedChoiceId, sphereCrossed: this.crossing.hasCrossed(), entry: this.entry,
      eventSequence: this.eventSequence, completionEventId: this.completionEventId,
    }));
  }

  getWorldClearSnapshot(): WorldClearSnapshot {
    const ledgerPosition = deriveLedgerPosition(this.getLedgerEvents());
    return Object.freeze({ context: this.context, contentId: this.content.contentId,
      contentRevision: this.content.contentRevision,
      interaction: Object.freeze({ title: this.content.interaction.title, prompt: this.content.interaction.prompt,
        choices: Object.freeze(this.content.interaction.choices.map(choice => Object.freeze({
          choiceId: choice.choiceId, label: choice.label, meaning: choice.meaning }))) }),
      selectedChoiceId: this.selectedChoiceId, ledgerPosition, distance: this.crossing.getDistance(ledgerPosition),
      EventDistance: this.content.EventDistance, sphereCrossed: this.crossing.hasCrossed(), entry: this.entry,
      mediaReady: this.premiere !== null, chartState: this.getWorldChartPlaybackState(), chartActive: this.chartActive,
      completionStatus: this.completionStatus, completionError: this.completionError, record: this.record,
      ledgerEventCount: this.getLedgerEvents().length });
  }

  getWorldChartReader(): ChartPremiereReader | null { return this.premiere; }
  isWorldChartActive(): boolean { return this.chartActive; }
  getWorldChartPlaybackState(): ChartPlaybackState { return this.premiere?.getState() ?? 'Ready'; }
  getCurrentPerceptionMode(): PerceptionMode { return this.legacy.getCurrentPerceptionMode(); }
  getChartPlaybackState(): ChartPlaybackState {
    return this.chartActive ? this.getWorldChartPlaybackState() : this.legacy.getChartPlaybackState();
  }
  isWorldMotionGated(): boolean { return this.chartActive || this.legacy.isWorldMotionGated(); }

  submitFrameIntents(intents: readonly PlayerIntent[], frameDurationSeconds: number): void {
    const beganWorldActive = this.chartActive;
    const legacyIntents: PlayerIntent[] = [];
    // A valid World entry freezes the entire batch, including preceding movement.
    if (intents.some(intent => intent.kind === 'EnterWorldChart')) { this.enterWorldChart(); }
    const worldBatchGated = beganWorldActive || this.chartActive;
    for (const intent of intents) {
      if (intent.kind === 'ChooseWorldNarrative') { this.chooseNarrative(intent.choiceId); continue; }
      if (intent.kind === 'EnterWorldChart') { continue; }
      if (intent.kind === 'RetryWorldClear') { this.retryCommit(); continue; }
      if (this.chartActive) {
        if (intent.kind === 'Strike' && intent.keyId !== undefined) { this.premiere?.submitStrike(intent); }
        else if (intent.kind === 'ToggleChartPause') { this.premiere?.togglePause(intent.videoTimeMs); }
        else if (intent.kind === 'ExitChart') { this.exitWorldChart(); }
      } else if (!worldBatchGated) { legacyIntents.push(intent); }
    }
    if (this.chartActive) { this.driveWorldChart(frameDurationSeconds); }
    else if (!worldBatchGated) { this.legacy.submitFrameIntents(legacyIntents, frameDurationSeconds); }
  }

  private now(): number {
    const value = this.callbacks.now();
    if (!Number.isSafeInteger(value) || value < 0) { throw new Error('通关时钟须为非负安全整数毫秒'); }
    return value;
  }

  private buildLedgerSnapshot(ledgers: ReadonlyMap<string, readonly NarrativeEvent[]>, control: LedgerSnapshot['control']): LedgerSnapshot {
    return { schemaVersion: 1, accountId: this.context.accountId, worldId: this.context.worldId,
      protagonistCharacterId: this.context.protagonistCharacterId, contentId: this.content.contentId,
      contentRevision: this.content.contentRevision,
      characters: [...ledgers].map(([characterId, events]) => ({ characterId, events })), control };
  }

  private appendEvent(raw: NarrativeEvent, targetCharacterId: string,
    staged?: { readonly selectedChoiceId?: string; readonly eventSequence?: number; readonly completionEventId?: string }): void {
    validId(targetCharacterId, '账本目标角色', 128);
    const narrativeEvent = validateLedgerNarrativeEvent(raw);
    const events = this.ledgers.get(targetCharacterId) ?? [];
    if (events.some(value => value.eventId === narrativeEvent.eventId)) { throw new Error('同一角色账本事件标识重复'); }
    // Reject overflow before append; no partial append may be reported as successful.
    const position = deriveLedgerPosition([...events, narrativeEvent]);
    const crosses = this.record === null && !this.crossing.hasCrossed() && narrativeEvent.InputSource === InputSource.Player &&
      targetCharacterId === this.context.protagonistCharacterId && this.crossing.getDistance(position) >= this.content.EventDistance;
    const nextEntry: ChartEntry | null = crosses ? Object.freeze({ entryId: JSON.stringify([this.context.accountId, this.context.worldId,
        this.context.protagonistCharacterId, 'SphereCrossing']), worldId: this.context.worldId,
        characterId: this.context.protagonistCharacterId, ChartRef: Object.freeze({
          chartId: this.content.worldBossChartSource.chartId, state: 'Entry' }), tier: 'World', source: 'SphereCrossing' }) : this.entry;
    const nextLedgers = new Map<string, readonly NarrativeEvent[]>(this.ledgers);
    nextLedgers.set(targetCharacterId, [...events, narrativeEvent]);
    const snapshot = this.ledgerHydration.validate(this.buildLedgerSnapshot(nextLedgers, {
      selectedChoiceId: staged?.selectedChoiceId ?? this.selectedChoiceId,
      sphereCrossed: this.crossing.hasCrossed() || crosses, entry: nextEntry,
      eventSequence: staged?.eventSequence ?? this.eventSequence,
      completionEventId: staged?.completionEventId ?? this.completionEventId,
    }));
    // Durability happens before any in-memory append, trigger, or entry publication.
    this.callbacks.persistLedger?.(snapshot);
    for (const character of snapshot.characters) { this.ledgers.set(character.characterId, character.events.slice()); }
    this.selectedChoiceId = snapshot.control.selectedChoiceId;
    this.eventSequence = snapshot.control.eventSequence;
    this.completionEventId = snapshot.control.completionEventId;
    if (crosses) { this.crossing.onLedgerAppended(narrativeEvent, targetCharacterId,
      this.context.protagonistCharacterId, deriveLedgerPosition(this.getLedgerEvents())); }
    this.entry = snapshot.control.entry;
  }

  private chooseNarrative(choiceId: string): void {
    if (this.selectedChoiceId !== null || this.record !== null || this.chartActive || this.legacy.isWorldMotionGated()) { return; }
    const choice = this.content.interaction.choices.find(value => value.choiceId === choiceId);
    if (choice === undefined) { return; }
    const timestamp = this.now(); const sequence = this.eventSequence + 1;
    if (!Number.isSafeInteger(sequence)) { throw new Error('制作事件序号溢出'); }
    this.appendEvent({ eventId: `WORLD_NARRATIVE_CHOICE:${timestamp}:${sequence}`, vector: choice.vector,
      VectorSchemaVersion, AppendedAt: { epochMs: timestamp }, InputSource: InputSource.Player, ChapterTag: {},
      ChartRef: { chartId: this.content.worldBossChartSource.chartId, state: 'Entry' } }, this.context.protagonistCharacterId,
    { selectedChoiceId: choice.choiceId, eventSequence: sequence });
  }

  private enterWorldChart(): void {
    if (this.entry === null || this.record !== null || this.completionCandidate !== null || this.chartActive ||
        this.legacy.isWorldMotionGated() || this.premiere === null || this.clockProbe === null || this.mediaProbe === null) { return; }
    this.premiere.reopen();
    this.mediaUnavailableElapsedMs = 0; this.fallbackTimeMs = -1;
    this.chartActive = true;
  }

  private exitWorldChart(): void {
    if (!this.chartActive || this.premiere === null) { return; }
    if (this.premiere.getState() === 'Completed') { this.prepareCompletion(); }
    this.premiere.requestExit(Math.max(0, this.premiere.getCurrentTimeMs())); this.chartActive = false;
  }

  private driveWorldChart(frameDurationSeconds: number): void {
    if (this.premiere === null || this.clockProbe === null || this.mediaProbe === null) { return; }
    const media = this.mediaProbe();
    const elapsedMs = Number.isFinite(frameDurationSeconds) && frameDurationSeconds >= 0
      ? frameDurationSeconds * 1000 : 0;
    const state = this.premiere.getState();
    if (state === 'Ready' || state === 'Playing') {
      this.mediaUnavailableElapsedMs = media.unavailable && !media.ended
        ? this.mediaUnavailableElapsedMs + elapsedMs : 0;
      // Same exceptional-media boundary as the legacy composition root: timing
      // advances independently, while ChartPremiere still owns every judgement.
      if ((media.ended && this.premiere.getResolvedCount() < this.premiere.getTotalNoteCount()) ||
          (media.unavailable && !media.ended && this.mediaUnavailableElapsedMs >= CHART_MEDIA_END_TIMEOUT_MS)) {
        this.fallbackTimeMs = this.premiere.getCurrentTimeMs() + elapsedMs;
      }
    }
    const nativeTime = this.clockProbe();
    const mediaTime = Math.max(Number.isFinite(nativeTime) ? nativeTime : -1, this.fallbackTimeMs);
    if (this.premiere.getState() === 'Ready' && Number.isFinite(mediaTime) && mediaTime >= 0) { this.premiere.begin(); }
    if (this.premiere.getState() === 'Playing' && Number.isFinite(mediaTime) && mediaTime >= 0) { this.premiere.advance(mediaTime); }
    this.premiere.advanceMediaStatus(media.ended, media.unavailable, elapsedMs);
    if (this.premiere.getState() === 'Completed') { this.exitWorldChart(); }
  }

  private prepareCompletion(): void {
    if (this.completionCandidate !== null || this.record !== null || this.premiere?.getState() !== 'Completed' ||
        this.premiere.getResult()?.completed !== true || this.entry === null) { return; }
    const timestamp = this.now(); const sequence = this.eventSequence + 1;
    if (!Number.isSafeInteger(sequence)) { throw new Error('制作事件序号溢出'); }
    const completionEventId = `WORLD_PREMIERE_COMPLETED:${timestamp}:${sequence}`;
    const events = this.getLedgerEvents();
    const zeroVector = Object.freeze(this.content.EventSpaceCenter.map(() => 0)) as unknown as NarrativeVector;
    const event: NarrativeEvent = { eventId: completionEventId, vector: zeroVector, VectorSchemaVersion,
      AppendedAt: { epochMs: timestamp }, InputSource: InputSource.Player, ChapterTag: {},
      ChartRef: { chartId: this.content.worldBossChartSource.chartId, state: 'PremiereCompleted' } };
    // Validate the candidate before the append; the snapshot is frozen from that same resulting read view.
    deriveRouteSignature(deriveLedgerPosition([...events, event]));
    this.appendEvent(event, this.context.protagonistCharacterId, { eventSequence: sequence, completionEventId });
    const completedLedger = this.getLedgerEvents();
    if (!hasChartPremiereCompleted(completedLedger, this.content.worldBossChartSource.chartId)) {
      throw new Error('权威账本缺少合法 World 首演完成引用');
    }
    const routeSignature = deriveRouteSignature(deriveLedgerPosition(completedLedger));
    const candidate = validateWorldClearRecord({ schemaVersion: 1, accountId: this.context.accountId,
      worldId: this.context.worldId, worldKind: 'Primary', protagonistCharacterId: this.context.protagonistCharacterId,
      ChartRef: event.ChartRef, contentRevision: this.content.contentRevision, completionEventId,
      clearedAt: event.AppendedAt, routeSignature }, this.context.accountId);
    this.completionCandidate = candidate;
    this.retryCommit();
  }

  private deriveCompletionCandidate(completionEventId: string): WorldClearRecord {
    const events = this.getLedgerEvents();
    const index = events.findIndex(value => value.eventId === completionEventId);
    if (index < 0) { throw new Error('Ledger 完成事实缺失'); }
    const event = events[index];
    return validateWorldClearRecord({ schemaVersion: 1, accountId: this.context.accountId,
      worldId: this.context.worldId, worldKind: 'Primary', protagonistCharacterId: this.context.protagonistCharacterId,
      ChartRef: event.ChartRef, contentRevision: this.content.contentRevision, completionEventId,
      clearedAt: event.AppendedAt, routeSignature: deriveRouteSignature(deriveLedgerPosition(events.slice(0, index + 1))) },
    this.context.accountId);
  }

  private retryCommit(): void {
    if (this.completionCandidate === null || this.completionStatus === 'Pending' || this.completionStatus === 'Completed') { return; }
    this.completionStatus = 'Pending'; this.completionError = null;
    const candidate = this.completionCandidate;
    // Convert synchronous adapter failures to a rejected promise as well.
    void Promise.resolve().then(() => this.callbacks.commitRecord(candidate)).then(() => {
      this.record = candidate; this.completionStatus = 'Completed'; this.completionError = null;
    }, (error: unknown) => {
      this.completionStatus = 'Failed';
      this.completionError = error instanceof Error ? error.message : '账号通关提交失败';
    });
  }
}
