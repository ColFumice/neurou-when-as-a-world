/**
 * C · chart / note
 * GridNote、GridKeyHold、HoldGridLine。
 * 只做纯逻辑；不 import T / E / R，不碰 DOM。
 */

import { GRID_GOOD_WINDOW_MS, GRID_PERFECT_WINDOW_MS } from '../constants';
import { NoteLogoGuide } from './logo';
import { ChartPadKind } from './types';
import type { GridCellId } from './types';

type GridJudgement = 'Pending' | 'Perfect' | 'Good' | 'Miss';

/** 判定放宽到 1.5×；提示窗口仍使用 GRID_GOOD_WINDOW_MS（200ms）。 */
const GRID_JUDGE_WINDOW_MS = GRID_GOOD_WINDOW_MS * 1.5;

/** 单次 Hold 越界：到 atMs 时必须重新按下要求的键/格。 */
export class HoldGridLine {
  readonly atMs: number;
  readonly requiredGridCellId: GridCellId | null;
  readonly requiredChartKeyId: string | null;

  constructor(input: {
    atMs: number;
    requiredGridCellId?: GridCellId | null;
    requiredChartKeyId?: string | null;
  }) {
    if (!Number.isFinite(input.atMs) || input.atMs < 0) {
      throw new RangeError('HoldGridLine.atMs must be a non-negative finite number');
    }
    if (input.requiredGridCellId !== undefined && input.requiredGridCellId !== null) {
      if (!Number.isSafeInteger(input.requiredGridCellId)
        || input.requiredGridCellId < 1
        || input.requiredGridCellId > 8) {
        throw new RangeError('HoldGridLine.requiredGridCellId must be 1..8');
      }
    }
    if (input.requiredChartKeyId !== undefined && input.requiredChartKeyId !== null) {
      if (typeof input.requiredChartKeyId !== 'string'
        || input.requiredChartKeyId.length === 0
        || input.requiredChartKeyId.length > 128) {
        throw new RangeError('HoldGridLine.requiredChartKeyId must be a non-empty string');
      }
    }

    this.atMs = input.atMs;
    this.requiredGridCellId = input.requiredGridCellId ?? null;
    this.requiredChartKeyId = input.requiredChartKeyId ?? null;
  }
}

/** Hold 运行态；一个 Hold 只属于一个 ChartLayerIndex。 */
export class GridKeyHold {
  readonly noteIndex: number;
  readonly layerIndex: number;
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly gridCellId: GridCellId | null;
  readonly chartKeyId: string | null;
  readonly triggerChartKeyId: string | null;
  readonly triggerGridCellId: GridCellId | null;
  readonly overflowIndex: number;

  constructor(input: {
    noteIndex: number;
    layerIndex: number;
    startedAtMs: number;
    endsAtMs: number;
    gridCellId?: GridCellId | null;
    chartKeyId?: string | null;
    triggerChartKeyId?: string | null;
    triggerGridCellId?: GridCellId | null;
    overflowIndex?: number;
  }) {
    if (!Number.isSafeInteger(input.noteIndex) || input.noteIndex < 0) {
      throw new RangeError('GridKeyHold.noteIndex must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(input.layerIndex) || input.layerIndex < 1) {
      throw new RangeError('GridKeyHold.layerIndex must be a positive safe integer');
    }
    if (!Number.isFinite(input.startedAtMs) || !Number.isFinite(input.endsAtMs)) {
      throw new RangeError('GridKeyHold times must be finite');
    }
    if (input.endsAtMs < input.startedAtMs) {
      throw new RangeError('GridKeyHold.endsAtMs must be >= startedAtMs');
    }
    if (input.overflowIndex !== undefined
      && (!Number.isSafeInteger(input.overflowIndex) || input.overflowIndex < 0)) {
      throw new RangeError('GridKeyHold.overflowIndex must be a non-negative safe integer');
    }

    this.noteIndex = input.noteIndex;
    this.layerIndex = input.layerIndex;
    this.startedAtMs = input.startedAtMs;
    this.endsAtMs = input.endsAtMs;
    this.gridCellId = input.gridCellId ?? null;
    this.chartKeyId = input.chartKeyId ?? null;
    this.triggerChartKeyId = input.triggerChartKeyId ?? null;
    this.triggerGridCellId = input.triggerGridCellId ?? null;
    this.overflowIndex = input.overflowIndex ?? 0;
  }

  withOverflowIndex(overflowIndex: number): GridKeyHold {
    return new GridKeyHold({
      noteIndex: this.noteIndex,
      layerIndex: this.layerIndex,
      startedAtMs: this.startedAtMs,
      endsAtMs: this.endsAtMs,
      gridCellId: this.gridCellId,
      chartKeyId: this.chartKeyId,
      triggerChartKeyId: this.triggerChartKeyId,
      triggerGridCellId: this.triggerGridCellId,
      overflowIndex,
    });
  }
}

interface GridNoteInput {
  readonly noteIndex: number;
  readonly timeMs: number;
  readonly durationMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId?: number | null;
  readonly chartKeyId?: string | null;
  readonly chartPadKind: ChartPadKind;
  readonly holdGridLines?: readonly HoldGridLine[];
}

function optionalKey(value: string | null | undefined, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new RangeError(`${label} must be a non-empty string (max 128)`);
  }
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) {
    throw new RangeError(`${label} must not contain control characters`);
  }
  return value;
}

/** 谱面音符 + 判定状态。ChartSnapshot 是唯一推进它的地方。 */
export class GridNote {
  readonly noteIndex: number;
  readonly timeMs: number;
  readonly durationMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId: GridCellId | null;
  readonly chartKeyId: string | null;
  readonly chartPadKind: ChartPadKind;
  readonly holdGridLines: readonly HoldGridLine[];
  readonly logo: NoteLogoGuide | null;

  private _judgement: GridJudgement = 'Pending';
  private _offsetMs: number | null = null;
  private _resolvedAtMs: number | null = null;
  private _hold: GridKeyHold | null = null;
  private _overflowIndex = 0;
  private _scoreValue = 0;

  constructor(input: GridNoteInput) {
    if (!Number.isSafeInteger(input.noteIndex) || input.noteIndex < 0) {
      throw new RangeError('GridNote.noteIndex must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(input.timeMs) || input.timeMs < 0) {
      throw new RangeError('GridNote.timeMs must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(input.durationMs) || input.durationMs < 0) {
      throw new RangeError('GridNote.durationMs must be a non-negative safe integer');
    }
    if (input.timeMs + input.durationMs > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('GridNote time range is too large');
    }
    if (!Number.isSafeInteger(input.chartLayerIndex)
      || input.chartLayerIndex < 1
      || input.chartLayerIndex > 32) {
      throw new RangeError('GridNote.chartLayerIndex must be 1..32');
    }

    const gridCellId = input.gridCellId === null || input.gridCellId === undefined
      ? null
      : input.gridCellId;
    if (gridCellId !== null
      && (!Number.isSafeInteger(gridCellId) || gridCellId < 1 || gridCellId > 8)) {
      throw new RangeError('GridNote.gridCellId must be 1..8');
    }
    const chartKeyId = optionalKey(input.chartKeyId, 'GridNote.chartKeyId');
    const padKind = input.chartPadKind;

    if (input.chartLayerIndex === 1) {
      if (padKind !== ChartPadKind.TopMost) {
        throw new RangeError('layer 1 chartPadKind must be TopMost');
      }
      if (gridCellId !== null) throw new RangeError('layer 1 must not have gridCellId');
    } else if (input.chartLayerIndex === 2) {
      if (padKind !== ChartPadKind.Light && padKind !== ChartPadKind.Heavy) {
        throw new RangeError('layer 2 chartPadKind must be Light or Heavy');
      }
      if (gridCellId === null) throw new RangeError('layer 2 requires gridCellId');
    } else {
      if (padKind !== ChartPadKind.Light) {
        throw new RangeError('layer 3+ chartPadKind must be Light');
      }
      if (gridCellId !== null) throw new RangeError('layer 3+ must not have gridCellId');
    }

    const holdLines = input.holdGridLines ?? [];
    if (!Array.isArray(holdLines)) throw new RangeError('holdGridLines must be an array');
    if (holdLines.length > 0 && input.durationMs <= 0) {
      throw new RangeError('holdGridLines require a positive durationMs');
    }
    const sortedLines = [...holdLines].sort((left, right) => left.atMs - right.atMs);
    let previous = input.timeMs;
    for (const line of sortedLines) {
      if (!(line instanceof HoldGridLine)) {
        throw new RangeError('holdGridLines must contain HoldGridLine');
      }
      if (line.atMs <= previous) {
        throw new RangeError('holdGridLines must be strictly increasing and after timeMs');
      }
      if (line.atMs >= input.timeMs + input.durationMs) {
        throw new RangeError('holdGridLines must be strictly before the hold end');
      }
      previous = line.atMs;
    }

    this.noteIndex = input.noteIndex;
    this.timeMs = input.timeMs;
    this.durationMs = input.durationMs;
    this.chartLayerIndex = input.chartLayerIndex;
    this.gridCellId = gridCellId as GridCellId | null;
    this.chartKeyId = chartKeyId;
    this.chartPadKind = padKind;
    this.holdGridLines = Object.freeze(sortedLines);
    this.logo = input.chartLayerIndex <= 2
      ? new NoteLogoGuide(input.noteIndex, input.chartLayerIndex, input.timeMs, input.durationMs)
      : null;
  }

  get judgement(): GridJudgement {
    return this._judgement;
  }

  get offsetMs(): number | null {
    return this._offsetMs;
  }

  get resolvedAtMs(): number | null {
    return this._resolvedAtMs;
  }

  get hold(): GridKeyHold | null {
    return this._hold;
  }

  get overflowIndex(): number {
    return this._overflowIndex;
  }

  get scoreValue(): number {
    return this._scoreValue;
  }

  setScore(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('GridNote.scoreValue must be a non-negative finite number');
    }
    this._scoreValue = value;
  }

  get isHold(): boolean {
    return this.durationMs > 0;
  }

  get pending(): boolean {
    return this._judgement === 'Pending';
  }

  /** 绝对偏差 → Perfect / Good / Miss；Perfect 100，Good 300，其余 Miss。 */
  judgeOffset(offsetMs: number): 'Perfect' | 'Good' | 'Miss' {
    if (!Number.isFinite(offsetMs)) throw new RangeError('offsetMs must be finite');
    const distance = Math.abs(offsetMs);
    if (distance <= GRID_PERFECT_WINDOW_MS) return 'Perfect';
    if (distance <= GRID_JUDGE_WINDOW_MS) return 'Good';
    return 'Miss';
  }

  markHit(
    judgement: 'Perfect' | 'Good',
    offsetMs: number,
    atMs: number,
    hold: GridKeyHold | null,
  ): void {
    if (this._judgement !== 'Pending') return;
    if (!Number.isFinite(offsetMs) || !Number.isFinite(atMs)) {
      throw new RangeError('GridNote hit times must be finite');
    }
    this._judgement = judgement;
    this._offsetMs = offsetMs;
    this._resolvedAtMs = atMs;
    this._hold = hold;
  }

  markMiss(atMs: number): void {
    if (this._judgement !== 'Pending') return;
    if (!Number.isFinite(atMs)) throw new RangeError('GridNote miss time must be finite');
    this._judgement = 'Miss';
    this._offsetMs = null;
    this._resolvedAtMs = atMs;
    this._hold = null;
  }

  failHold(atMs: number): void {
    if (this._judgement !== 'Perfect' && this._judgement !== 'Good') return;
    if (!Number.isFinite(atMs)) throw new RangeError('GridNote hold fail time must be finite');
    this._judgement = 'Miss';
    this._resolvedAtMs = atMs;
    this._hold = null;
  }

  completeHold(atMs: number): void {
    if (!Number.isFinite(atMs)) throw new RangeError('GridNote hold complete time must be finite');
    this._hold = null;
    if (this._resolvedAtMs === null) this._resolvedAtMs = atMs;
  }

  /** 越界续接后替换运行态（overflowIndex 已前进）。 */
  setHold(hold: GridKeyHold | null): void {
    this._hold = hold;
  }

  nextHoldLine(): HoldGridLine | null {
    return this.holdGridLines[this._overflowIndex] ?? null;
  }

  advanceOverflow(): void {
    if (this._overflowIndex < this.holdGridLines.length) this._overflowIndex += 1;
  }

  tickLogo(nowMs: number): void {
    this.logo?.advance(nowMs);
  }

  hitLogo(atMs: number): void {
    this.logo?.hit(atMs);
  }

  missLogo(atMs: number): void {
    this.logo?.miss(atMs);
  }

  reset(): void {
    this._judgement = 'Pending';
    this._offsetMs = null;
    this._resolvedAtMs = null;
    this._hold = null;
    this._overflowIndex = 0;
    this._scoreValue = 0;
    this.logo?.reset();
  }
}
