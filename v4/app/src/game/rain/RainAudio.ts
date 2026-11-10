import { RainIntensity } from '../../../../core/world/types';

interface RainAudioParam {
  value: number;
  setTargetAtTime(value: number, startTime: number, timeConstant: number): unknown;
}

interface RainAudioBuffer {
  getChannelData(channel: number): Float32Array;
}

interface RainAudioSource {
  buffer: RainAudioBuffer | null;
  loop: boolean;
  connect(node: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
  disconnect(): void;
}

interface RainAudioFilter {
  type: string;
  frequency: RainAudioParam;
  Q: RainAudioParam;
  connect(node: unknown): unknown;
  disconnect(): void;
}

interface RainAudioGain {
  gain: RainAudioParam;
  connect(node: unknown): unknown;
  disconnect(): void;
}

interface RainAudioContext {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createBuffer(channels: number, length: number, sampleRate: number): RainAudioBuffer;
  createBufferSource(): RainAudioSource;
  createBiquadFilter(): RainAudioFilter;
  createGain(): RainAudioGain;
  resume(): Promise<void>;
  close(): Promise<void>;
}

type RainAudioContextConstructor = new () => RainAudioContext;

export interface RainAudioOptions {
  readonly contextFactory?: () => RainAudioContext | null;
}

function defaultContextFactory(): RainAudioContext | null {
  const candidate = globalThis as unknown as {
    readonly AudioContext?: RainAudioContextConstructor;
    readonly webkitAudioContext?: RainAudioContextConstructor;
  };
  const Constructor = candidate.AudioContext ?? candidate.webkitAudioContext;
  if (!Constructor) return null;
  try {
    return new Constructor();
  } catch {
    return null;
  }
}

const VOLUMES: Readonly<Record<string, number>> = {
  Light: 0.15,
  Moderate: 0.3,
  Heavy: 0.5,
};

/**
 * X · RainAudio
 * 白噪声 → bandpass → gain。无外部音频；不依赖 React/DOM。
 * resume() 由 app/demo 在首次 pointerdown/keydown 时调用。
 */
export class RainAudio {
  private readonly contextFactory: () => RainAudioContext | null;
  private context: RainAudioContext | null = null;
  private source: RainAudioSource | null = null;
  private filter: RainAudioFilter | null = null;
  private gain: RainAudioGain | null = null;
  private _enabled = false;
  private _intensity: RainIntensity = RainIntensity.Light;
  private disposed = false;

  constructor(options: RainAudioOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get intensity(): RainIntensity {
    return this._intensity;
  }

  /** 映射测试与 UI 共用。 */
  static volumeFor(intensity: RainIntensity): number {
    return VOLUMES[intensity] ?? VOLUMES.Light;
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this._enabled = enabled;
    if (!enabled) {
      this.applyGain(0);
      return;
    }
    this.ensureGraph();
    this.applyGain(RainAudio.volumeFor(this._intensity));
  }

  setIntensity(intensity: RainIntensity): void {
    this._intensity = intensity;
    if (this._enabled) this.applyGain(RainAudio.volumeFor(intensity));
  }

  /** 需在用户手势中调用；失败静音。 */
  async resume(): Promise<void> {
    if (this.disposed) return;
    this.ensureGraph();
    const context = this.context;
    if (!context || context.state === 'running') return;
    try {
      await context.resume();
    } catch {
      // 静音是合法降级；不向游戏抛错。
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this._enabled = false;
    try {
      this.source?.stop();
    } catch {
      // 某些实现尚未 start 时 stop 会抛；忽略。
    }
    this.source?.disconnect();
    this.filter?.disconnect();
    this.gain?.disconnect();
    const context = this.context;
    this.source = null;
    this.filter = null;
    this.gain = null;
    this.context = null;
    if (context) void context.close().catch(() => undefined);
  }

  private ensureGraph(): void {
    if (this.disposed || this.context !== null) return;
    const context = this.contextFactory();
    if (!context) return;
    try {
      const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 2)), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 950;
      filter.Q.value = 0.65;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
      this.context = context;
      this.source = source;
      this.filter = filter;
      this.gain = gain;
    } catch {
      // AudioContext 失败时保持静音。
      try {
        void context.close().catch(() => undefined);
      } catch {
        // ignore
      }
      this.context = null;
      this.source = null;
      this.filter = null;
      this.gain = null;
    }
  }

  private applyGain(value: number): void {
    if (!this.context || !this.gain) return;
    try {
      this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.08);
    } catch {
      try {
        this.gain.gain.value = value;
      } catch {
        // 静音降级。
      }
    }
  }
}
