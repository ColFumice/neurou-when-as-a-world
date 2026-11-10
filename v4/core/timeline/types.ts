/**
 * M · timeline
 * 时间轴状态机与播放状态；不 import world。
 *
 * R3.4：TimelineStateMachine 从 R2 的 interface 升级为 class（同名 A 类）；
 * 原有 playbackState / progress / boundary 字段保留为 getter，语义兼容。
 */

/** 时间轴方向。字符串枚举：Forward / Backward。 */
export enum TimelineDirection {
  Forward = 'Forward',
  Backward = 'Backward',
}

/** 播放状态。字符串枚举：Ready / Playing / Paused / Completed / Exited。 */
export enum PlaybackState {
  Ready = 'Ready',
  Playing = 'Playing',
  Paused = 'Paused',
  Completed = 'Completed',
  Exited = 'Exited',
}

/** 时间轴进度（只读，ms）。 */
export interface TimelineProgress {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly direction: TimelineDirection;
}

/** 时间轴边界（只读，ms）。 */
export interface TimelineBoundary {
  readonly minMs: number;
  readonly maxMs: number;
}

/** 移动 → 时间映射（只读）。 */
export interface TimelineMovementMapping {
  readonly lateralDelta: number;
  readonly timelineDeltaMs: number;
  readonly direction: TimelineDirection;
}

/** 时间轴状态机（R3.4 同名 class 升级）。 */
export class TimelineStateMachine {
  private _playbackState: PlaybackState;
  private _positionMs: number;
  private _direction: TimelineDirection;
  private _frozen: boolean;

  constructor(
    private readonly _boundary: TimelineBoundary,
    options: { initialMs?: number } = {},
  ) {
    if (!Number.isFinite(_boundary.minMs) || !Number.isFinite(_boundary.maxMs)) {
      throw new RangeError('timeline boundary must be finite');
    }
    if (_boundary.minMs > _boundary.maxMs) {
      throw new RangeError('timeline boundary minMs must be <= maxMs');
    }

    const initialMs = options.initialMs ?? _boundary.minMs;
    if (!Number.isFinite(initialMs)) {
      throw new RangeError('timeline initialMs must be finite');
    }

    this._playbackState = PlaybackState.Ready;
    this._positionMs = this.clamp(initialMs);
    this._direction = TimelineDirection.Forward;
    this._frozen = false;
  }

  get playbackState(): PlaybackState {
    return this._playbackState;
  }

  get progress(): TimelineProgress {
    return {
      positionMs: this._positionMs,
      durationMs: this._boundary.maxMs - this._boundary.minMs,
      direction: this._direction,
    };
  }

  get boundary(): TimelineBoundary {
    return this._boundary;
  }

  play(): void {
    if (this._frozen || this._playbackState === PlaybackState.Exited) return;
    if (this._positionMs >= this._boundary.maxMs) {
      this._playbackState = PlaybackState.Completed;
      return;
    }
    this._playbackState = PlaybackState.Playing;
  }

  pause(): void {
    if (this._playbackState === PlaybackState.Playing) {
      this._playbackState = PlaybackState.Paused;
    }
  }

  seek(positionMs: number): void {
    if (!Number.isFinite(positionMs)) {
      throw new RangeError('timeline seek position must be finite');
    }
    const previous = this._positionMs;
    this._positionMs = this.clamp(positionMs);
    if (this._positionMs > previous) {
      this._direction = TimelineDirection.Forward;
    } else if (this._positionMs < previous) {
      this._direction = TimelineDirection.Backward;
    }

    if (this._positionMs >= this._boundary.maxMs) {
      this._playbackState = PlaybackState.Completed;
    } else if (this._playbackState === PlaybackState.Completed) {
      this._playbackState = PlaybackState.Paused;
    }
  }

  advance(deltaMs: number): void {
    if (!Number.isFinite(deltaMs)) {
      throw new RangeError('timeline advance delta must be finite');
    }
    if (this._frozen || this._playbackState === PlaybackState.Paused) return;
    if (this._playbackState === PlaybackState.Exited) return;
    if (deltaMs === 0) return;

    this._direction = deltaMs > 0
      ? TimelineDirection.Forward
      : TimelineDirection.Backward;

    if (
      this._playbackState === PlaybackState.Ready
      || this._playbackState === PlaybackState.Completed
    ) {
      this._playbackState = PlaybackState.Playing;
    }

    this._positionMs = this.clamp(this._positionMs + deltaMs);
    if (this._positionMs >= this._boundary.maxMs) {
      this._playbackState = PlaybackState.Completed;
    }
  }

  freeze(): void {
    this._frozen = true;
    this._playbackState = PlaybackState.Paused;
  }

  unfreeze(): void {
    this._frozen = false;
  }

  private clamp(positionMs: number): number {
    return Math.min(
      this._boundary.maxMs,
      Math.max(this._boundary.minMs, positionMs),
    );
  }
}
