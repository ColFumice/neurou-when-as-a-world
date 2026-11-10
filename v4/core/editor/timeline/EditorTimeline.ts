/**
 * E · editor / EditorTimeline
 * 时间轴视口与 timeMs ↔ x 映射。
 * 不 import React / Tauri / fs；不依赖 DOM。
 */

export class EditorTimeline {
  readonly laneLeft: number;
  readonly laneWidth: number;
  readonly minPxPerMs = 0.01;
  readonly maxPxPerMs = 10;

  private _durationMs: number;
  private _viewStartMs: number;
  private _pxPerMs: number;
  private _playheadMs: number;
  private _locked = false;

  constructor(options: {
    laneLeft: number;
    laneWidth: number;
    durationMs: number;
    viewStartMs?: number;
    pxPerMs?: number;
    playheadMs?: number;
  }) {
    if (!Number.isFinite(options.laneLeft)) throw new RangeError('laneLeft must be finite');
    if (!Number.isFinite(options.laneWidth) || options.laneWidth <= 0) {
      throw new RangeError('laneWidth must be a positive finite number');
    }
    if (!Number.isFinite(options.durationMs) || options.durationMs < 0) {
      throw new RangeError('durationMs must be a non-negative finite number');
    }
    this.laneLeft = options.laneLeft;
    this.laneWidth = options.laneWidth;
    this._durationMs = options.durationMs;
    this._pxPerMs = this.clampPx(options.pxPerMs ?? 0.1);
    this._viewStartMs = this.clampViewStart(options.viewStartMs ?? 0);
    this._playheadMs = this.clampTime(options.playheadMs ?? 0);
  }

  get viewStartMs(): number {
    return this._viewStartMs;
  }

  get viewEndMs(): number {
    return this._viewStartMs + this.laneWidth / this._pxPerMs;
  }

  /** 兼容短名；与 viewStartMs 同值。 */
  get viewStart(): number {
    return this._viewStartMs;
  }

  /** 兼容短名；与 viewEndMs 同值。 */
  get viewEnd(): number {
    return this._viewStartMs + this.laneWidth / this._pxPerMs;
  }

  get pxPerMs(): number {
    return this._pxPerMs;
  }

  get playheadMs(): number {
    return this._playheadMs;
  }

  get durationMs(): number {
    return this._durationMs;
  }

  get viewportLocked(): boolean {
    return this._locked;
  }

  /** timeMs = viewStart + (x - laneLeft) / pxPerMs。 */
  timeAtX(x: number): number {
    if (!Number.isFinite(x)) throw new RangeError('x must be finite');
    return this._viewStartMs + (x - this.laneLeft) / this._pxPerMs;
  }

  /** x = laneLeft + (timeMs - viewStart) * pxPerMs。 */
  xAtTime(timeMs: number): number {
    if (!Number.isFinite(timeMs)) throw new RangeError('timeMs must be finite');
    return this.laneLeft + (timeMs - this._viewStartMs) * this._pxPerMs;
  }

  setViewport(input: { viewStartMs?: number; pxPerMs?: number }): void {
    if (this._locked) return;
    if (input.pxPerMs !== undefined) {
      this._pxPerMs = this.clampPx(input.pxPerMs);
    }
    if (input.viewStartMs !== undefined) {
      this._viewStartMs = this.clampViewStart(input.viewStartMs);
    } else {
      this._viewStartMs = this.clampViewStart(this._viewStartMs);
    }
  }

  zoomAt(anchorX: number, nextPxPerMs: number): void {
    if (this._locked) return;
    if (!Number.isFinite(anchorX) || !Number.isFinite(nextPxPerMs)) {
      throw new RangeError('zoom inputs must be finite');
    }
    const anchorTime = this.timeAtX(anchorX);
    this._pxPerMs = this.clampPx(nextPxPerMs);
    this._viewStartMs = this.clampViewStart(
      anchorTime - (anchorX - this.laneLeft) / this._pxPerMs,
    );
  }

  scrollTo(viewStartMs: number): void {
    if (this._locked) return;
    if (!Number.isFinite(viewStartMs)) throw new RangeError('viewStartMs must be finite');
    this._viewStartMs = this.clampViewStart(viewStartMs);
  }

  scrollBy(deltaMs: number): void {
    if (this._locked) return;
    if (!Number.isFinite(deltaMs)) throw new RangeError('deltaMs must be finite');
    this._viewStartMs = this.clampViewStart(this._viewStartMs + deltaMs);
  }

  /** 拖拽边缘自动滚动：允许在 viewport 锁定时平移，不改拖拽目标。 */
  panForDrag(deltaMs: number): void {
    if (!Number.isFinite(deltaMs)) throw new RangeError('deltaMs must be finite');
    this._viewStartMs = this.clampViewStart(this._viewStartMs + deltaMs);
  }

  setPlayhead(timeMs: number): void {
    if (!Number.isFinite(timeMs)) throw new RangeError('playhead must be finite');
    this._playheadMs = this.clampTime(timeMs);
  }

  setDuration(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError('durationMs must be a non-negative finite number');
    }
    this._durationMs = durationMs;
    this._viewStartMs = this.clampViewStart(this._viewStartMs);
    this._playheadMs = this.clampTime(this._playheadMs);
  }

  /**
   * 吸附优先级：Alt 关闭 → 视频帧边界 → 10ms 网格 → clamp。
   * 原始 v2 timeMs 不应调用本方法。
   */
  snap(
    timeMs: number,
    options: { altKey?: boolean; frameDurationMs?: number | null } = {},
  ): number {
    if (!Number.isFinite(timeMs)) throw new RangeError('timeMs must be finite');
    if (options.altKey) return this.clampTime(timeMs);

    const frameDurationMs = options.frameDurationMs;
    if (frameDurationMs !== undefined && frameDurationMs !== null
      && Number.isFinite(frameDurationMs) && frameDurationMs > 0) {
      const frameIndex = Math.round(timeMs / frameDurationMs);
      return this.clampTime(Math.round(frameIndex * frameDurationMs));
    }
    return this.clampTime(Math.round(timeMs / 10) * 10);
  }

  lockViewport(): void {
    this._locked = true;
  }

  unlockViewport(): void {
    this._locked = false;
  }

  private clampPx(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError('pxPerMs must be finite');
    return Math.min(this.maxPxPerMs, Math.max(this.minPxPerMs, value));
  }

  private clampViewStart(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError('viewStartMs must be finite');
    const max = Math.max(0, this._durationMs - this.laneWidth / this._pxPerMs);
    return Math.min(max, Math.max(0, value));
  }

  private clampTime(value: number): number {
    return Math.min(this._durationMs, Math.max(0, value));
  }
}
