/**
 * E · editor / EditorPlayhead
 * 播放头状态；不依赖 M 的 TimelineStateMachine（E 只值依赖 K）。
 */

export class EditorPlayhead {
  private _timeMs: number;
  private _durationMs: number;
  private _playing = false;

  constructor(durationMs: number, initialMs = 0) {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError('durationMs must be a non-negative finite number');
    }
    if (!Number.isFinite(initialMs)) throw new RangeError('initialMs must be finite');
    this._durationMs = durationMs;
    this._timeMs = this.clamp(initialMs);
  }

  get timeMs(): number {
    return this._timeMs;
  }

  get durationMs(): number {
    return this._durationMs;
  }

  get playing(): boolean {
    return this._playing;
  }

  play(): void {
    if (this._timeMs >= this._durationMs) {
      this._playing = false;
      return;
    }
    this._playing = true;
  }

  pause(): void {
    this._playing = false;
  }

  seek(timeMs: number): void {
    if (!Number.isFinite(timeMs)) throw new RangeError('seek time must be finite');
    this._timeMs = this.clamp(timeMs);
    if (this._timeMs >= this._durationMs) this._playing = false;
  }

  advance(deltaMs: number): void {
    if (!Number.isFinite(deltaMs)) throw new RangeError('advance delta must be finite');
    if (!this._playing) return;
    this._timeMs = this.clamp(this._timeMs + deltaMs);
    if (this._timeMs >= this._durationMs) this._playing = false;
  }

  setDuration(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError('durationMs must be a non-negative finite number');
    }
    this._durationMs = durationMs;
    this._timeMs = this.clamp(this._timeMs);
    if (this._timeMs >= this._durationMs) this._playing = false;
  }

  private clamp(value: number): number {
    return Math.min(this._durationMs, Math.max(0, value));
  }
}
