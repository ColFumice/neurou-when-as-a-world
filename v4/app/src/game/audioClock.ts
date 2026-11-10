import { AudioOutputClock } from '../../../core/chart/clock';

/**
 * GameScreen 使用的时钟窄口；WebAudio 宿主与无音频 fallback 同形。
 * 只做时间，不依赖 React / Pixi。
 */
export interface ClockDebugSnapshot {
  readonly source: 'timestamp' | 'fallback';
  readonly contextTime: number | null;
  readonly timestampPerformanceTime: number | null;
  readonly timestampContextTime: number | null;
  readonly baseLatency: number | null;
  readonly outputLatency: number | null;
  readonly contextState: string;
  /** WebAudio 没有 HTMLAudioElement；buffer 就绪映射为 4。 */
  readonly audioReadyState: number;
}

export interface GameClock {
  readonly durationMs: number;
  readonly running: boolean;
  unlock(): Promise<void>;
  nowMs(): number;
  start(offsetMs?: number): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  seek(ms: number): void;
  /** R5a.2：仅重设时钟映射基准；不 seek、不改谱面。 */
  reanchor?(): void;
  /** R5b.2 · 只读调试快照；不影响时钟映射。 */
  debugSnapshot?(): ClockDebugSnapshot;
  dispose(): void;
}

export const REANCHOR_COOLDOWN_MS = 2000;

/** 2s 限频；last=-Infinity 时第一帧允许。 */
export function canReanchor(
  nowWallMs: number,
  lastReanchorWallMs: number,
  cooldownMs = REANCHOR_COOLDOWN_MS,
): boolean {
  return Number.isFinite(nowWallMs)
    && nowWallMs - lastReanchorWallMs >= cooldownMs;
}

/**
 * Web Audio 宿主：AudioContext + BGM source + 纯 AudioOutputClock 映射。
 * getOutputTimestamp 优先；回退 baseLatency / outputLatency；不再二次扣延迟。
 */
export class WebAudioOutputClock implements GameClock {
  private readonly context: AudioContext;
  private readonly clock: AudioOutputClock;
  private readonly gain: GainNode;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private disposed = false;
  private started = false;
  private lastOutputSource: 'timestamp' | 'fallback' = 'fallback';

  constructor(durationMs: number) {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.9;
    this.gain.connect(this.context.destination);
    this.clock = new AudioOutputClock(Math.max(0, durationMs), () => ({
      outputSeconds: this.readOutputSeconds(),
      wallMs: performance.now(),
    }));
  }

  get durationMs(): number {
    return this.clock.durationMs;
  }

  get running(): boolean {
    return this.started && this.clock.running;
  }

  get state(): AudioContextState {
    return this.context.state;
  }

  get ready(): boolean {
    return this.buffer !== null;
  }

  async unlock(): Promise<void> {
    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  async load(url: string): Promise<void> {
    if (this.disposed) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`audio HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const decoded = await this.context.decodeAudioData(data.slice(0));
      if (this.disposed) return;
      this.buffer = decoded;
    } catch {
      this.buffer = null;
    }
  }

  async start(offsetMs = 0): Promise<void> {
    if (this.disposed) throw new Error('audio clock disposed');
    if (!this.buffer) throw new Error('audio buffer not ready');
    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state !== 'running') throw new Error('audio context is not running');

    this.stopSource();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);

    const when = this.context.currentTime + 0.03;
    const offsetSeconds = Math.min(
      Math.max(0, offsetMs / 1000),
      Math.max(0, this.buffer.duration - 0.001),
    );
    source.start(when, offsetSeconds);
    this.source = source;
    this.started = true;

    // 把未来的 context 时刻映射到输出时间线；clock 在到达前保持 offset。
    const anchorOutputSeconds = this.readOutputSeconds()
      + (when - this.context.currentTime);
    this.clock.start(offsetMs, anchorOutputSeconds);
  }

  pause(): void {
    this.clock.pause();
    this.started = false;
    this.stopSource();
  }

  async resume(): Promise<void> {
    if (!this.buffer) throw new Error('audio buffer not ready');
    await this.start(this.clock.nowMs());
  }

  seek(ms: number): void {
    const wasRunning = this.started;
    this.clock.seek(ms);
    this.stopSource();
    if (wasRunning) {
      void this.start(ms);
    }
  }

  reanchor(): void {
    if (this.disposed || !this.started || !this.clock.running) return;
    try {
      this.clock.reanchor();
    } catch {
      // reanchor 失败静默；不阻塞帧循环。
    }
  }

  nowMs(): number {
    return this.clock.nowMs();
  }

  debugSnapshot(): ClockDebugSnapshot {
    const context = this.context;
    const timestamp = context.getOutputTimestamp?.();
    return {
      source: this.lastOutputSource,
      contextTime: Number.isFinite(context.currentTime) ? context.currentTime : null,
      timestampPerformanceTime: timestamp
        && typeof timestamp.performanceTime === 'number'
        && Number.isFinite(timestamp.performanceTime)
        ? timestamp.performanceTime
        : null,
      timestampContextTime: timestamp
        && typeof timestamp.contextTime === 'number'
        && Number.isFinite(timestamp.contextTime)
        ? timestamp.contextTime
        : null,
      baseLatency: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
      outputLatency: typeof context.outputLatency === 'number'
        && Number.isFinite(context.outputLatency)
        ? context.outputLatency
        : null,
      contextState: context.state,
      audioReadyState: this.buffer ? 4 : 0,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clock.pause();
    this.stopSource();
    this.gain.disconnect();
    void this.context.close();
  }

  private readOutputSeconds(): number {
    const context = this.context;
    const timestamp = context.getOutputTimestamp?.();
    let seconds: number;
    if (context.state === 'running'
      && timestamp
      && typeof timestamp.performanceTime === 'number'
      && typeof timestamp.contextTime === 'number'
      && timestamp.performanceTime > 0
      && timestamp.contextTime > 0
      && performance.now() - timestamp.performanceTime < 1000) {
      this.lastOutputSource = 'timestamp';
      seconds = Math.min(
        context.currentTime,
        timestamp.contextTime + (performance.now() - timestamp.performanceTime) / 1000,
      );
    } else {
      this.lastOutputSource = 'fallback';
      const measuredLatency = context.baseLatency + (context.outputLatency || 0);
      seconds = Math.max(0, context.currentTime - measuredLatency);
    }
    // R5a.2 live seam：one-shot 注入输出漂移；默认不存在，不影响生产。
    const seam = (globalThis as unknown as {
      __R4F_CLOCK_DRIFT_ONCE_MS__?: unknown;
    }).__R4F_CLOCK_DRIFT_ONCE_MS__;
    if (typeof seam === 'number' && Number.isFinite(seam)) {
      delete (globalThis as unknown as { __R4F_CLOCK_DRIFT_ONCE_MS__?: unknown })
        .__R4F_CLOCK_DRIFT_ONCE_MS__;
      seconds += seam / 1000;
    }
    return seconds;
  }

  private stopSource(): void {
    if (!this.source) return;
    try {
      this.source.stop(0);
    } catch {
      // already stopped
    }
    this.source.disconnect();
    this.source = null;
  }
}

/**
 * 无音频 / 解码失败时的 fallback：仍用同一 AudioOutputClock 纯映射，
 * 只把输出源换成 performance.now。HUD 会标记 OFFLINE AUDIO。
 */
export class PerformanceOutputClock implements GameClock {
  private readonly clock: AudioOutputClock;
  private readonly origin: number;

  constructor(durationMs: number) {
    this.origin = performance.now();
    this.clock = new AudioOutputClock(Math.max(0, durationMs), () => ({
      outputSeconds: (performance.now() - this.origin) / 1000,
      wallMs: performance.now(),
    }));
  }

  get durationMs(): number {
    return this.clock.durationMs;
  }

  get running(): boolean {
    return this.clock.running;
  }

  async unlock(): Promise<void> {
    // 无音频时钟没有需要解锁的上下文。
  }

  async start(offsetMs = 0): Promise<void> {
    this.clock.start(offsetMs);
  }

  pause(): void {
    this.clock.pause();
  }

  async resume(): Promise<void> {
    this.clock.resume();
  }

  seek(ms: number): void {
    this.clock.seek(ms);
  }

  reanchor(): void {
    if (!this.clock.running) return;
    try {
      this.clock.reanchor();
    } catch {
      // 无音频 fallback 也静默。
    }
  }

  nowMs(): number {
    return this.clock.nowMs();
  }

  debugSnapshot(): ClockDebugSnapshot {
    return {
      source: 'fallback',
      contextTime: null,
      timestampPerformanceTime: null,
      timestampContextTime: null,
      baseLatency: null,
      outputLatency: null,
      contextState: 'performance',
      audioReadyState: 4,
    };
  }

  dispose(): void {
    this.clock.pause();
  }
}

/** 优先真实 BGM；失败时降级到无音频时钟。 */
export async function createGameClock(
  audioUrl: string | null,
  durationMs: number,
): Promise<{ readonly clock: GameClock; readonly audio: boolean; readonly warning: string | null }> {
  if (audioUrl) {
    try {
      const clock = new WebAudioOutputClock(durationMs);
      await Promise.race([
        clock.load(audioUrl),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 4000);
        }),
      ]);
      if (clock.ready) return { clock, audio: true, warning: null };
      clock.dispose();
      return {
        clock: new PerformanceOutputClock(durationMs),
        audio: false,
        warning: 'BGM 解码超时或失败，使用无音频时钟',
      };
    } catch (error) {
      return {
        clock: new PerformanceOutputClock(durationMs),
        audio: false,
        warning: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    clock: new PerformanceOutputClock(durationMs),
    audio: false,
    warning: '未找到音频，使用无音频时钟',
  };
}
