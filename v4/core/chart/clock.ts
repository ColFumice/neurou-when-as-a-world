/**
 * C · chart / clock
 * AudioOutputClock：输出时钟 → playheadMs 的纯映射。
 * 不依赖 DOM / WebAudio / Pixi；WebAudio 宿主在 app 层。
 */

interface OutputSample {
  readonly outputSeconds: number;
  readonly wallMs: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

/**
 * 以“实际音频输出时间”为母钟的谱面时钟。
 *
 * - `start(offset, atOutputSeconds?)` 建立锚点；`atOutputSeconds` 可指向未来，
 *   在到达之前 `nowMs()` 保持 offset。
 * - `pause()` 冻结最后一次采样；`resume()` 重新锚定。
 * - `seek()` 立即改 playhead；运行中会重建锚点。
 * - 同一次运行内不倒退；seek 除外。
 */
export class AudioOutputClock {
  private readonly _durationMs: number;
  private readonly _readOutput: () => OutputSample;
  private _anchorOutputSeconds = 0;
  private _anchorChartMs = 0;
  private _lastMs = 0;
  private _running = false;
  private _waitingForAnchor = false;

  constructor(
    durationMs: number,
    readOutput: () => OutputSample,
  ) {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError('AudioOutputClock.durationMs must be a non-negative finite number');
    }
    if (typeof readOutput !== 'function') {
      throw new TypeError('AudioOutputClock.readOutput must be a function');
    }
    this._durationMs = durationMs;
    this._readOutput = readOutput;
  }

  get durationMs(): number {
    return this._durationMs;
  }

  get running(): boolean {
    return this._running;
  }

  get playheadMs(): number {
    return this.nowMs();
  }

  start(offsetMs = 0, atOutputSeconds?: number): void {
    finite(offsetMs, 'AudioOutputClock.start offsetMs');
    const offset = this.clamp(offsetMs);
    this._lastMs = offset;
    this._anchorChartMs = offset;

    if (atOutputSeconds !== undefined) {
      finite(atOutputSeconds, 'AudioOutputClock.start atOutputSeconds');
      this._anchorOutputSeconds = atOutputSeconds;
      this._waitingForAnchor = true;
    } else {
      this._anchorOutputSeconds = this.sampleOutputSeconds();
      this._waitingForAnchor = false;
    }
    this._running = true;
  }

  pause(): void {
    if (!this._running) return;
    this._lastMs = this.nowMs();
    this._running = false;
    this._waitingForAnchor = false;
  }

  resume(): void {
    if (this._running) return;
    this._anchorOutputSeconds = this.sampleOutputSeconds();
    this._anchorChartMs = this._lastMs;
    this._waitingForAnchor = false;
    this._running = true;
  }

  seek(ms: number): void {
    finite(ms, 'AudioOutputClock.seek ms');
    const next = this.clamp(ms);
    this._lastMs = next;
    if (this._running) {
      this._anchorOutputSeconds = this.sampleOutputSeconds();
      this._anchorChartMs = next;
      this._waitingForAnchor = false;
    }
  }

  /**
   * R5a.2：以当前输出时间重设映射基准。
   *
   * 只改变 anchor；不 seek、不改 duration、不改 ChartSnapshot。
   * 返回重锚瞬间的 playhead，保证调用方看到的 playhead 连续。
   * 未运行时保持 last 值，不抛错。
   */
  reanchor(): number {
    if (!this._running) return this._lastMs;
    const current = this.nowMs();
    const outputSeconds = this.sampleOutputSeconds();
    this._anchorChartMs = current;
    this._anchorOutputSeconds = outputSeconds;
    this._lastMs = current;
    this._waitingForAnchor = false;
    return current;
  }

  nowMs(): number {
    if (!this._running) return this._lastMs;

    const outputSeconds = this.sampleOutputSeconds();
    if (this._waitingForAnchor) {
      if (outputSeconds < this._anchorOutputSeconds) return this._lastMs;
      this._waitingForAnchor = false;
    }

    const mapped = this._anchorChartMs
      + (outputSeconds - this._anchorOutputSeconds) * 1000;
    const clamped = this.clamp(mapped);
    const monotonic = Math.max(this._lastMs, clamped);
    this._lastMs = monotonic;
    return monotonic;
  }

  private sampleOutputSeconds(): number {
    const sample = this._readOutput();
    if (!sample || typeof sample.outputSeconds !== 'number'
      || !Number.isFinite(sample.outputSeconds)) {
      throw new RangeError('AudioOutputClock.readOutput must return a finite outputSeconds');
    }
    return sample.outputSeconds;
  }

  private clamp(value: number): number {
    return Math.min(this._durationMs, Math.max(0, value));
  }
}
