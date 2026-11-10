export type ClockDriftStatus = 'Stable' | 'Warning' | 'Reanchor' | 'Critical';

export interface ClockDriftReading {
  readonly driftMs: number;
  readonly absoluteDriftMs: number;
  readonly status: ClockDriftStatus;
  readonly shouldReanchor: boolean;
}

export interface ClockDriftHud {
  readonly className: 'is-warning' | 'is-error' | 'is-critical';
  readonly message: 'CLOCK DRIFT WARNING' | 'CLOCK DRIFT' | 'AUDIO OFFLINE';
}

export interface ClockDriftSample extends ClockDriftReading {
  readonly action: 'None' | 'Warn' | 'Reanchor' | 'Suspend';
  readonly reanchored: boolean;
  readonly inputPaused: boolean;
}

export interface ClockDebugTelemetry {
  readonly contextTime: number | null;
  readonly timestampPerformanceTime: number | null;
  readonly timestampContextTime: number | null;
  readonly baseLatency: number | null;
  readonly outputLatency: number | null;
  readonly contextState: string;
  readonly audioReadyState: number;
  readonly visibilityState: string;
  readonly reanchorCount: number;
  readonly source: 'timestamp' | 'fallback';
}

export interface ClockDebugSample extends ClockDriftSample {
  readonly seq: number;
  readonly wallMs: number;
  readonly playheadMs: number;
  readonly telemetry: ClockDebugTelemetry;
}

export interface ClockDebugExport {
  readonly schemaVersion: 1;
  readonly capacity: number;
  readonly count: number;
  readonly exportedAt: string;
  readonly samples: readonly ClockDebugSample[];
}

const DEBUG_CAPACITY = 600;

/**
 * R4f · AC4-24 漂移监视器。
 * 40ms 预警 / 50ms 重新锚定 / 100ms 暂停判定输入。
 *
 * 说明：R4a 的 AudioOutputClock 是音频母钟且已冻结；本类的 re-anchor
 * 只重置“监视器基准”，不改 ChartSnapshot playhead / 判定 / 音频时钟。
 */
export class ClockDriftMonitor {
  private originPlayheadMs = 0;
  private originWallMs = 0;
  private running = false;
  private _inputPaused = false;
  private readonly debugRing: Array<ClockDebugSample | null> = new Array(DEBUG_CAPACITY).fill(null);
  private debugWriteIndex = 0;
  private debugCount = 0;
  private debugSeq = 0;

  get inputPaused(): boolean {
    return this._inputPaused;
  }

  static classify(driftMs: number): ClockDriftReading {
    if (!Number.isFinite(driftMs)) {
      return {
        driftMs,
        absoluteDriftMs: Number.POSITIVE_INFINITY,
        status: 'Critical',
        shouldReanchor: true,
      };
    }
    const absolute = Math.abs(driftMs);
    if (absolute > 100) {
      return { driftMs, absoluteDriftMs: absolute, status: 'Critical', shouldReanchor: true };
    }
    if (absolute > 50) {
      return { driftMs, absoluteDriftMs: absolute, status: 'Reanchor', shouldReanchor: true };
    }
    if (absolute >= 40) {
      return { driftMs, absoluteDriftMs: absolute, status: 'Warning', shouldReanchor: false };
    }
    return { driftMs, absoluteDriftMs: absolute, status: 'Stable', shouldReanchor: false };
  }

  /** 以当前 playhead/wall 建立监视基准；不触碰音频/谱面时钟。 */
  start(playheadMs: number, wallMs: number): void {
    if (!Number.isFinite(playheadMs) || !Number.isFinite(wallMs)) return;
    this.originPlayheadMs = playheadMs;
    this.originWallMs = wallMs;
    this.running = true;
    this._inputPaused = false;
  }

  reset(): void {
    this.running = false;
    this._inputPaused = false;
  }

  /**
   * 采样一次；>50ms 时返回 Reanchor 并重置本监视器基准。
   * 这是“观测层重锚”，不修改 R4a AudioOutputClock 内部。
   */
  sample(
    playheadMs: number,
    wallMs: number,
    telemetry?: Partial<ClockDebugTelemetry>,
  ): ClockDriftSample {
    if (!this.running) this.start(playheadMs, wallMs);
    const expected = this.originPlayheadMs + (wallMs - this.originWallMs);
    const injected = (globalThis as unknown as { __R4F_DRIFT_OVERRIDE__?: unknown }).__R4F_DRIFT_OVERRIDE__;
    const extra = typeof injected === 'number' && Number.isFinite(injected) ? injected : 0;
    const driftMs = playheadMs - expected + extra;
    const reading = ClockDriftMonitor.classify(driftMs);
    let reanchored = false;
    if (reading.shouldReanchor) {
      this.start(playheadMs, wallMs);
      reanchored = true;
    }
    if (reading.status === 'Critical') this._inputPaused = true;
    const sample: ClockDriftSample = {
      ...reading,
      action: reading.status === 'Critical'
        ? 'Suspend'
        : reading.status === 'Reanchor'
          ? 'Reanchor'
          : reading.status === 'Warning'
            ? 'Warn'
            : 'None',
      reanchored,
      inputPaused: this._inputPaused,
    };
    this.recordDebug(sample, playheadMs, wallMs, telemetry);
    return sample;
  }

  /** R5b.2 · 只读导出；不改变任何判定/时钟状态。 */
  exportDebug(): ClockDebugExport {
    const samples: ClockDebugSample[] = [];
    for (let offset = 0; offset < this.debugCount; offset += 1) {
      const index = (this.debugWriteIndex - this.debugCount + offset + DEBUG_CAPACITY)
        % DEBUG_CAPACITY;
      const sample = this.debugRing[index];
      if (sample) samples.push(sample);
    }
    return {
      schemaVersion: 1,
      capacity: DEBUG_CAPACITY,
      count: this.debugCount,
      exportedAt: new Date().toISOString(),
      samples,
    };
  }

  clearDebug(): void {
    this.debugRing.fill(null);
    this.debugWriteIndex = 0;
    this.debugCount = 0;
    this.debugSeq = 0;
  }

  private recordDebug(
    sample: ClockDriftSample,
    playheadMs: number,
    wallMs: number,
    telemetry?: Partial<ClockDebugTelemetry>,
  ): void {
    const visibilityState = typeof document !== 'undefined'
      ? document.visibilityState
      : 'unknown';
    const entry: ClockDebugSample = {
      ...sample,
      seq: this.debugSeq,
      wallMs,
      playheadMs,
      telemetry: {
        contextTime: telemetry?.contextTime ?? null,
        timestampPerformanceTime: telemetry?.timestampPerformanceTime ?? null,
        timestampContextTime: telemetry?.timestampContextTime ?? null,
        baseLatency: telemetry?.baseLatency ?? null,
        outputLatency: telemetry?.outputLatency ?? null,
        contextState: telemetry?.contextState ?? 'unknown',
        audioReadyState: telemetry?.audioReadyState ?? 0,
        visibilityState: telemetry?.visibilityState ?? visibilityState,
        reanchorCount: telemetry?.reanchorCount ?? 0,
        source: telemetry?.source ?? 'fallback',
      },
    };
    this.debugSeq += 1;
    this.debugRing[this.debugWriteIndex] = entry;
    this.debugWriteIndex = (this.debugWriteIndex + 1) % DEBUG_CAPACITY;
    this.debugCount = Math.min(DEBUG_CAPACITY, this.debugCount + 1);
  }
}

export function clockDriftHud(reading: ClockDriftReading | null): ClockDriftHud | null {
  if (!reading || reading.status === 'Stable') return null;
  if (reading.status === 'Critical') {
    return { className: 'is-critical', message: 'AUDIO OFFLINE' };
  }
  if (reading.status === 'Reanchor') {
    return { className: 'is-error', message: 'CLOCK DRIFT' };
  }
  return { className: 'is-warning', message: 'CLOCK DRIFT WARNING' };
}
