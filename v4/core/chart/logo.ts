/**
 * C · chart / logo
 * NoteLogoGuide / NoteLogoMiss 与三个时长常量。
 * 只做纯状态；位置/动效由 P 层决定，不 import React / Pixi / DOM。
 */

/** Logo 提前量（ms）。 */
export const NoteLogoLeadTimeMs = 1500;

/** Tap 判定后的存活时长（ms）。 */
export const NoteLogoLifetimeMs = 400;

/** Hold 结束后额外延长（ms）。 */
export const NoteLogoHoldExtensionMs = 300;

/** Miss 红闪保留时长（ms）；不导出 A 名。 */
const NOTE_LOGO_MISS_EFFECT_MS = 300;

type NoteLogoState = 'Pending' | 'Visible' | 'Missed' | 'Done';

/** 单 note 的 Logo 引导状态。只由 ChartSnapshot 创建与推进。 */
export class NoteLogoGuide {
  readonly noteIndex: number;
  readonly layerIndex: number;
  readonly appearAtMs: number;
  readonly expireAtMs: number;

  private _state: NoteLogoState = 'Pending';
  private _missAtMs: number | null = null;
  private _hitAtMs: number | null = null;

  constructor(
    noteIndex: number,
    layerIndex: number,
    timeMs: number,
    durationMs: number,
  ) {
    if (!Number.isSafeInteger(noteIndex) || noteIndex < 0) {
      throw new RangeError('logo noteIndex must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(layerIndex) || layerIndex < 1 || layerIndex > 2) {
      throw new RangeError('NoteLogoGuide is only for chartLayerIndex 1 or 2');
    }
    if (!Number.isSafeInteger(timeMs) || timeMs < 0) {
      throw new RangeError('logo timeMs must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
      throw new RangeError('logo durationMs must be a non-negative safe integer');
    }

    this.noteIndex = noteIndex;
    this.layerIndex = layerIndex;
    this.appearAtMs = timeMs - NoteLogoLeadTimeMs;
    this.expireAtMs = durationMs > 0
      ? timeMs + durationMs + NoteLogoHoldExtensionMs
      : timeMs + NoteLogoLifetimeMs;
  }

  get state(): NoteLogoState {
    return this._state;
  }

  get missAtMs(): number | null {
    return this._missAtMs;
  }

  get hitAtMs(): number | null {
    return this._hitAtMs;
  }

  /** 每帧推进可见性；Miss 红闪结束后转入 Done。 */
  advance(nowMs: number): void {
    if (!Number.isFinite(nowMs)) throw new RangeError('logo nowMs must be finite');
    if (this._state === 'Done') return;

    if (this._state === 'Missed') {
      if (this._missAtMs !== null && nowMs >= this._missAtMs + NOTE_LOGO_MISS_EFFECT_MS) {
        this._state = 'Done';
      }
      return;
    }

    if (this._state === 'Pending' && nowMs >= this.appearAtMs) {
      this._state = 'Visible';
    }
    if (this._state === 'Visible' && nowMs >= this.expireAtMs) {
      this._state = 'Done';
    }
  }

  /** 命中只记录反馈时间，不提前销毁；Hold 也沿用同一套出现/存活。 */
  hit(atMs: number): void {
    if (!Number.isFinite(atMs)) throw new RangeError('logo hitAtMs must be finite');
    if (this._state === 'Missed' || this._state === 'Done') return;
    this._hitAtMs = atMs;
    if (atMs >= this.appearAtMs) this._state = 'Visible';
  }

  /** Miss 触发 NoteLogoMiss；保留红闪到 Miss 后 300ms。 */
  miss(atMs: number): void {
    if (!Number.isFinite(atMs)) throw new RangeError('logo missAtMs must be finite');
    if (this._state === 'Done') return;
    this._state = 'Missed';
    this._missAtMs = atMs;
  }

  reset(): void {
    this._state = 'Pending';
    this._missAtMs = null;
    this._hitAtMs = null;
  }
}

/** Logo Miss 事件；app 用来播放红闪/抖动。 */
export class NoteLogoMiss {
  readonly noteIndex: number;
  readonly layerIndex: number;
  readonly atMs: number;

  constructor(noteIndex: number, layerIndex: number, atMs: number) {
    if (!Number.isSafeInteger(noteIndex) || noteIndex < 0) {
      throw new RangeError('logo miss noteIndex must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(layerIndex) || layerIndex < 1) {
      throw new RangeError('logo miss layerIndex must be a positive safe integer');
    }
    if (!Number.isFinite(atMs) || atMs < 0) {
      throw new RangeError('logo miss atMs must be a non-negative finite number');
    }
    this.noteIndex = noteIndex;
    this.layerIndex = layerIndex;
    this.atMs = atMs;
  }
}
