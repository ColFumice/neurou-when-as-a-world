/**
 * C · chart / judge
 * ChartSnapshot：谱面运行时、分层判定、Hold 越界、Logo Miss 与 counts。
 *
 * 约束：
 * - 不 import trace / editor / director；GridStrike 由 app 层按本文件的 GridNote 状态映射。
 * - 不读 DOM / performance.now；时间由调用方传入。
 */

import { GRID_GOOD_WINDOW_MS } from '../constants';
import { BlindMode } from './blind';
import type { ChartLayer } from './layer';
import { NoteLogoMiss } from './logo';
import { GridKeyHold, GridNote, HoldGridLine } from './note';
import { ChartScore } from './types';
import type { GridCellId } from './types';

/** 普通 note 判定放宽到 1.5×；hold 越界窗口仍保持 200ms。 */
const GRID_JUDGE_WINDOW_MS = GRID_GOOD_WINDOW_MS * 1.5;
/** Hold 结束前 500ms 内松手直接完成，不判 Miss。 */
const HOLD_RELEASE_GRACE_MS = 500;

type OverflowResult = 'Pending' | 'Continued' | 'Missed';

interface OverflowInput {
  readonly noteIndex: number;
  readonly atMs: number;
  readonly requiredGridCellId?: GridCellId | null;
  readonly requiredChartKeyId?: string | null;
  readonly result?: OverflowResult;
}

function overflowCell(value: GridCellId | null | undefined): GridCellId | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 1 || value > 8) {
    throw new RangeError('overflow requiredGridCellId must be 1..8');
  }
  return value;
}

function overflowKey(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new RangeError('overflow requiredChartKeyId must be a non-empty string');
  }
  return value;
}

function overflowAt(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('overflow atMs must be a non-negative finite number');
  }
  return value;
}

function overflowResult(value: OverflowResult | undefined): OverflowResult {
  return value ?? 'Pending';
}

/** 第 2 层 Hold 越界事件。 */
export class HoldGridOverflow {
  readonly noteIndex: number;
  readonly atMs: number;
  readonly requiredGridCellId: GridCellId | null;
  readonly requiredChartKeyId: string | null;
  readonly result: OverflowResult;

  constructor(input: OverflowInput) {
    if (!Number.isSafeInteger(input.noteIndex) || input.noteIndex < 0) {
      throw new RangeError('HoldGridOverflow.noteIndex must be a non-negative safe integer');
    }
    this.noteIndex = input.noteIndex;
    this.atMs = overflowAt(input.atMs);
    this.requiredGridCellId = overflowCell(input.requiredGridCellId);
    this.requiredChartKeyId = overflowKey(input.requiredChartKeyId);
    this.result = overflowResult(input.result);
  }

  withResult(result: OverflowResult): HoldGridOverflow {
    return new HoldGridOverflow({
      noteIndex: this.noteIndex,
      atMs: this.atMs,
      requiredGridCellId: this.requiredGridCellId,
      requiredChartKeyId: this.requiredChartKeyId,
      result,
    });
  }
}

/** 第 1/3+ 层 Hold 越界事件。 */
export class SpaceHoldOverflow {
  readonly noteIndex: number;
  readonly atMs: number;
  readonly requiredGridCellId: GridCellId | null;
  readonly requiredChartKeyId: string | null;
  readonly result: OverflowResult;

  constructor(input: OverflowInput) {
    if (!Number.isSafeInteger(input.noteIndex) || input.noteIndex < 0) {
      throw new RangeError('SpaceHoldOverflow.noteIndex must be a non-negative safe integer');
    }
    this.noteIndex = input.noteIndex;
    this.atMs = overflowAt(input.atMs);
    this.requiredGridCellId = overflowCell(input.requiredGridCellId);
    this.requiredChartKeyId = overflowKey(input.requiredChartKeyId);
    this.result = overflowResult(input.result);
  }

  withResult(result: OverflowResult): SpaceHoldOverflow {
    return new SpaceHoldOverflow({
      noteIndex: this.noteIndex,
      atMs: this.atMs,
      requiredGridCellId: this.requiredGridCellId,
      requiredChartKeyId: this.requiredChartKeyId,
      result,
    });
  }
}

interface StrikeLike {
  readonly timeMs: number;
  readonly chartKeyId?: string;
  readonly gridCellId?: number;
  readonly phase?: 'Down' | 'Up';
  readonly source?: 'Keyboard' | 'Pointer';
}

interface Counts {
  readonly perfect: number;
  readonly good: number;
  readonly miss: number;
  readonly combo: number;
  readonly maxCombo: number;
}

interface LastEvent {
  readonly noteIndex: number;
  readonly layerIndex: number;
  readonly gridCellId: number | null;
  readonly judgement: 'Perfect' | 'Good' | 'Miss';
  readonly offsetMs: number;
  readonly atMs: number;
}

interface ChartSnapshotInput {
  readonly durationMs: number;
  readonly layers: readonly ChartLayer[];
  readonly notes: readonly GridNote[];
  readonly blindMode?: BlindMode;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function phaseOf(intent: StrikeLike): 'Down' | 'Up' {
  const phase = intent.phase ?? 'Down';
  if (phase !== 'Down' && phase !== 'Up') {
    throw new RangeError('Strike.phase must be Down or Up');
  }
  return phase;
}

function sourceOf(intent: StrikeLike): 'Keyboard' | 'Pointer' {
  const source = intent.source ?? 'Keyboard';
  if (source !== 'Keyboard' && source !== 'Pointer') {
    throw new RangeError('Strike.source must be Keyboard or Pointer');
  }
  return source;
}

function compareCandidate(
  left: { readonly note: GridNote; readonly offsetMs: number },
  right: { readonly note: GridNote; readonly offsetMs: number },
): number {
  return left.note.chartLayerIndex - right.note.chartLayerIndex
    || Math.abs(left.offsetMs) - Math.abs(right.offsetMs)
    || left.note.timeMs - right.note.timeMs
    || (left.note.gridCellId ?? 0) - (right.note.gridCellId ?? 0)
    || left.note.noteIndex - right.note.noteIndex;
}

/**
 * 谱面运行时快照。`advance` / `submit` 原地推进并返回自身；
 * app 通过 `revision` 触发重渲染。
 */
export class ChartSnapshot {
  private readonly _durationMs: number;
  private readonly _layers: readonly ChartLayer[];
  private readonly _notes: readonly GridNote[];
  private readonly _blindMode: BlindMode;
  private _counts = { perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 };
  private readonly _overflows: (HoldGridOverflow | SpaceHoldOverflow)[] = [];
  private readonly _logoMisses: NoteLogoMiss[] = [];
  private _lastEvent: LastEvent | null = null;
  private _revision = 0;

  constructor(input: ChartSnapshotInput) {
    if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
      throw new RangeError('ChartSnapshot.durationMs must be a non-negative finite number');
    }
    if (!Array.isArray(input.layers) || input.layers.length === 0) {
      throw new RangeError('ChartSnapshot.layers must be a non-empty array');
    }
    if (!Array.isArray(input.notes)) {
      throw new RangeError('ChartSnapshot.notes must be an array');
    }
    const layerIndexes = new Set(input.layers.map((layer) => layer.index));
    for (const note of input.notes) {
      if (!(note instanceof GridNote)) {
        throw new RangeError('ChartSnapshot.notes must contain GridNote');
      }
      if (!layerIndexes.has(note.chartLayerIndex)) {
        throw new RangeError(`note layer ${note.chartLayerIndex} is not in layers`);
      }
      if (note.timeMs + note.durationMs > input.durationMs) {
        throw new RangeError('note exceeds ChartSnapshot.durationMs');
      }
    }

    this._durationMs = input.durationMs;
    this._layers = [...input.layers];
    this._notes = [...input.notes];
    this._blindMode = input.blindMode ?? BlindMode.Off;
  }

  get durationMs(): number {
    return this._durationMs;
  }

  get layers(): readonly ChartLayer[] {
    return this._layers;
  }

  get notes(): readonly GridNote[] {
    return this._notes;
  }

  get blindMode(): BlindMode {
    return this._blindMode;
  }

  get counts(): Counts {
    return { ...this._counts };
  }

  get score(): number {
    let total = 0;
    for (const note of this._notes) total += note.scoreValue;
    return total;
  }

  get overflows(): readonly (HoldGridOverflow | SpaceHoldOverflow)[] {
    return this._overflows;
  }

  get logoMisses(): readonly NoteLogoMiss[] {
    return this._logoMisses;
  }

  get lastEvent(): LastEvent | null {
    return this._lastEvent;
  }

  get revision(): number {
    return this._revision;
  }

  /**
   * 推进到 nowMs：普通 note 超时 Miss；Hold 越界超时 Miss；
   * Hold 到达 endsAtMs 完成。暂停时不要调用。
   */
  advance(nowMs: number): ChartSnapshot {
    finite(nowMs, 'ChartSnapshot.advance nowMs');
    this._revision += 1;

    for (const note of this._notes) {
      note.tickLogo(nowMs);
      const hold = note.hold;
      if (hold) {
        const next = note.nextHoldLine();
        if (next && nowMs > next.atMs + GRID_GOOD_WINDOW_MS) {
          this.failHold(note, nowMs, next);
        } else if (!next && nowMs >= hold.endsAtMs) {
          note.completeHold(nowMs);
        }
        continue;
      }
      if (note.pending && nowMs > note.timeMs + GRID_JUDGE_WINDOW_MS) {
        this.missNote(note, nowMs);
      }
    }
    return this;
  }

  /**
   * 提交一次敲击。`nowMs` 是音频时钟采样值；判定偏移仍按 `intent.timeMs`。
   */
  submit(intent: StrikeLike, nowMs: number = intent.timeMs): ChartSnapshot {
    finite(intent.timeMs, 'Strike.timeMs');
    finite(nowMs, 'ChartSnapshot.submit nowMs');
    this._revision += 1;
    this._lastEvent = null;

    const phase = phaseOf(intent);
    if (phase === 'Up') {
      this.releaseHold(intent);
      return this;
    }

    const source = sourceOf(intent);
    this.lastIntentKey = intent.chartKeyId ?? null;
    this.lastIntentCell = (intent.gridCellId ?? null) as GridCellId | null;
    if (this.continueHold(intent, source, nowMs)) return this;

    const candidate = this.pickCandidate(intent, source);
    if (!candidate) return this;

    this.applyHit(candidate.note, candidate.offsetMs, Math.max(nowMs, intent.timeMs));
    return this;
  }

  /** 清空所有判定状态，保留谱面。 */
  reset(): ChartSnapshot {
    for (const note of this._notes) note.reset();
    this._counts = { perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 };
    this._overflows.length = 0;
    this._logoMisses.length = 0;
    this._lastEvent = null;
    this._revision += 1;
    return this;
  }

  private pickCandidate(
    intent: StrikeLike,
    source: 'Keyboard' | 'Pointer',
  ): { note: GridNote; offsetMs: number } | null {
    const candidates: { note: GridNote; offsetMs: number }[] = [];
    for (const note of this._notes) {
      if (!note.pending) continue;
      const offsetMs = intent.timeMs - note.timeMs;
      if (Math.abs(offsetMs) > GRID_JUDGE_WINDOW_MS) continue;
      if (note.chartLayerIndex === 1) {
        if (source !== 'Keyboard') continue;
        // L1 可用 Space，也可用 cell 1 区域的键盘键（1/2/3/Q/W/E）。
        if (intent.chartKeyId !== 'Space' && intent.gridCellId !== 1) continue;
      } else if (note.chartLayerIndex === 2) {
        if (note.chartKeyId !== null) {
          if (intent.chartKeyId !== note.chartKeyId
            && !(source === 'Pointer'
              && note.gridCellId !== null
              && intent.gridCellId === note.gridCellId)) {
            continue;
          }
        } else if (note.gridCellId === null || intent.gridCellId !== note.gridCellId) {
          continue;
        }
      } else if (source === 'Keyboard' && intent.chartKeyId === 'Space') {
        // Space 是第 1 层专用键；不把 Space 当作第 3+ 层的“任意键”。
        continue;
      }
      candidates.push({ note, offsetMs });
    }
    candidates.sort(compareCandidate);
    return candidates[0] ?? null;
  }

  private applyHit(note: GridNote, offsetMs: number, atMs: number): void {
    const judgement = note.judgeOffset(offsetMs);
    if (judgement === 'Miss') return;

    const hold = note.isHold
      ? new GridKeyHold({
        noteIndex: note.noteIndex,
        layerIndex: note.chartLayerIndex,
        startedAtMs: atMs,
        endsAtMs: note.timeMs + note.durationMs,
        gridCellId: note.gridCellId,
        chartKeyId: note.chartKeyId,
        triggerChartKeyId: this.lastIntentKey,
        triggerGridCellId: this.lastIntentCell,
        overflowIndex: 0,
      })
      : null;
    note.markHit(judgement, offsetMs, atMs, hold);
    note.hitLogo(atMs);
    note.setScore(ChartScore.scoreFor(judgement, note.chartLayerIndex, this._counts.combo));

    if (judgement === 'Perfect') this._counts.perfect += 1;
    else this._counts.good += 1;
    this._counts.combo += 1;
    this._counts.maxCombo = Math.max(this._counts.maxCombo, this._counts.combo);

    this._lastEvent = {
      noteIndex: note.noteIndex,
      layerIndex: note.chartLayerIndex,
      gridCellId: note.gridCellId,
      judgement,
      offsetMs,
      atMs,
    };
  }

  private lastIntentKey: string | null = null;
  private lastIntentCell: GridCellId | null = null;

  private continueHold(
    intent: StrikeLike,
    source: 'Keyboard' | 'Pointer',
    nowMs: number,
  ): boolean {
    for (const note of this._notes) {
      const hold = note.hold;
      if (!hold) continue;
      const next = note.nextHoldLine();
      if (!next) continue;
      if (Math.abs(intent.timeMs - next.atMs) > GRID_GOOD_WINDOW_MS) continue;

      if (this.matchesOverflow(note, next, intent, source)) {
        note.advanceOverflow();
        note.setHold(hold.withOverflowIndex(note.overflowIndex));
        this.pushOverflow(note, next, 'Continued');
        return true;
      }

      this.failHold(note, Math.max(nowMs, intent.timeMs), next, 'Missed');
      return true;
    }
    return false;
  }

  private matchesOverflow(
    note: GridNote,
    line: HoldGridLine,
    intent: StrikeLike,
    source: 'Keyboard' | 'Pointer',
  ): boolean {
    if (note.chartLayerIndex === 1) {
      if (source !== 'Keyboard') return false;
      const required = line.requiredChartKeyId ?? 'Space';
      return intent.chartKeyId === required;
    }
    if (note.chartLayerIndex === 2) {
      if (line.requiredChartKeyId !== null) return intent.chartKeyId === line.requiredChartKeyId;
      if (line.requiredGridCellId !== null) return intent.gridCellId === line.requiredGridCellId;
      return note.gridCellId !== null && intent.gridCellId === note.gridCellId;
    }
    if (source === 'Keyboard' && intent.chartKeyId === 'Space') return false;
    return true;
  }

  private releaseHold(intent: StrikeLike): void {
    for (const note of this._notes) {
      const hold = note.hold;
      if (!hold) continue;
      if (!this.matchesRelease(hold, intent)) continue;

      // 结束前 500ms 内松手：直接完成，不再要求越界重按。
      if (intent.timeMs >= hold.endsAtMs - HOLD_RELEASE_GRACE_MS) {
        note.completeHold(intent.timeMs);
        return;
      }

      const next = note.nextHoldLine();
      if (next) {
        if (Math.abs(intent.timeMs - next.atMs) <= GRID_GOOD_WINDOW_MS) {
          // 在越界窗口内松手：允许玩家重新按下续接；若一直不按，advance 会在窗口后判 Miss。
          return;
        }
        if (intent.timeMs > next.atMs + GRID_GOOD_WINDOW_MS) {
          this.failHold(note, intent.timeMs, next);
          return;
        }
      }
      this.failHold(note, intent.timeMs, null);
      return;
    }
  }

  private matchesRelease(hold: GridKeyHold, intent: StrikeLike): boolean {
    if (hold.triggerChartKeyId !== null) return intent.chartKeyId === hold.triggerChartKeyId;
    if (hold.triggerGridCellId !== null) return intent.gridCellId === hold.triggerGridCellId;
    return true;
  }

  private missNote(note: GridNote, atMs: number): void {
    if (!note.pending) return;
    note.markMiss(atMs);
    note.setScore(0);
    this._counts.miss += 1;
    this._counts.combo = 0;
    note.missLogo(atMs);
    if (note.logo) {
      this._logoMisses.push(new NoteLogoMiss(note.noteIndex, note.chartLayerIndex, atMs));
    }
  }

  private failHold(
    note: GridNote,
    atMs: number,
    line: HoldGridLine | null,
    result: OverflowResult = 'Missed',
  ): void {
    if (note.judgement !== 'Perfect' && note.judgement !== 'Good') return;
    if (note.judgement === 'Perfect') this._counts.perfect = Math.max(0, this._counts.perfect - 1);
    else this._counts.good = Math.max(0, this._counts.good - 1);
    this._counts.miss += 1;
    this._counts.combo = 0;
    note.failHold(atMs);
    note.setScore(0);
    note.missLogo(atMs);
    if (note.logo) {
      this._logoMisses.push(new NoteLogoMiss(note.noteIndex, note.chartLayerIndex, atMs));
    }
    if (line) this.pushOverflow(note, line, result);
  }

  private pushOverflow(
    note: GridNote,
    line: HoldGridLine,
    result: OverflowResult,
  ): void {
    const input: OverflowInput = {
      noteIndex: note.noteIndex,
      atMs: line.atMs,
      requiredGridCellId: line.requiredGridCellId,
      requiredChartKeyId: line.requiredChartKeyId,
      result,
    };
    this._overflows.push(note.chartLayerIndex === 2
      ? new HoldGridOverflow(input)
      : new SpaceHoldOverflow(input));
  }
}
