import { NeuRuntime } from '../../../core/editor/runtime/NeuRuntime';
import type { NeuSignal } from '../../../core/editor/runtime/NeuRuntime';
import type { NeuControlSignal } from './neuControl';
import type {
  CycleWarning,
  RandomPreviewMode,
  RandomSeed,
} from '../../../core/eventgraph/RandomMode';
import type {
  EditorBinding,
  EditorEffectInterface,
  NeuModule,
} from '../../../core/editor/runtime/types';

/** 资源解析窄口；R4b.2 的游戏 sink 使用。 */
export interface GameAssetResolver {
  resolve(assetId: string): string | null;
}

export interface GameSignalEvent {
  readonly origin: 'NEU' | 'Binding';
  readonly signal: NeuSignal;
}

export interface GameCycleEvent {
  readonly origin: 'NEU';
  readonly warning: CycleWarning;
}

export type GameSinkEvent = GameSignalEvent | GameCycleEvent;

export interface GameSignalSink {
  emit(event: GameSinkEvent): void;
}

export interface GameNeuRuntimeInput {
  readonly modules: readonly NeuModule[];
  readonly effects: readonly EditorEffectInterface[];
  readonly bindings: readonly EditorBinding[];
  readonly seed: RandomSeed;
  readonly mode: RandomPreviewMode;
  readonly randomValue?: () => number;
  readonly sink: GameSignalSink;
  readonly assetResolver?: GameAssetResolver;
  readonly activation?: 'Explore' | 'Rhythm';
  readonly onControl?: (signal: NeuControlSignal) => void;
}

/** Binding 与 NEU Audio 的“同 tick”去重窗口；Binding 先投递并优先保留。 */
const AUDIO_DEDUPE_WINDOW_MS = 16;

interface AudioTriggerKey {
  readonly assetId: string;
  readonly atMs: number;
}

function withinSameAudioTick(
  trigger: AudioTriggerKey,
  assetId: string,
  atMs: number,
): boolean {
  return trigger.assetId === assetId
    && Math.abs(trigger.atMs - atMs) <= AUDIO_DEDUPE_WINDOW_MS;
}

/**
 * X · game NEU 宿主骨架。
 * 只负责 playhead、binding 区间、随机源与 sink 投递；不依赖 React / DOM。
 */
export class GameNeuRuntime {
  private readonly runtime: NeuRuntime;
  private readonly bindings: readonly EditorBinding[];
  private readonly effects: readonly EditorEffectInterface[];
  private readonly sink: GameSignalSink;
  private readonly assetResolver: GameAssetResolver | null;
  private readonly activation: 'Explore' | 'Rhythm';
  private bindingLastMs = -1;
  private bindingAudio: readonly AudioTriggerKey[] = [];
  private disposed = false;

  constructor(input: GameNeuRuntimeInput) {
    this.bindings = [...input.bindings];
    this.effects = [...input.effects];
    this.sink = input.sink;
    this.assetResolver = input.assetResolver ?? null;
    this.activation = input.activation ?? 'Rhythm';
    this.runtime = new NeuRuntime(input.modules, {
      mode: input.mode,
      seed: input.seed,
      ...(input.randomValue === undefined ? {} : { randomValue: input.randomValue }),
      activation: this.activation,
      ...(input.onControl === undefined ? {} : { onControl: input.onControl }),
      onCycleWarning: (warning) => {
        this.sink.emit({ origin: 'NEU', warning });
      },
    });
  }

  get effectInterfaces(): readonly EditorEffectInterface[] {
    return this.effects;
  }

  get resolver(): GameAssetResolver | null {
    return this.assetResolver;
  }

  reset(playheadMs = 0): void {
    if (this.disposed) return;
    this.runtime.reset(playheadMs);
    this.bindingLastMs = playheadMs - 1;
    this.bindingAudio = [];
  }

  /** R5c-B：Explore 的 Trace/Trigger 向 NEU 控制图注入脉冲。 */
  pulse(sourceId: string, count = 1): void {
    if (this.disposed) return;
    this.runtime.pulse(sourceId, count);
  }

  advanceTo(playheadMs: number, playing: boolean): void {
    if (this.disposed || !playing) return;
    if (playheadMs < this.bindingLastMs) this.reset(playheadMs);

    const bindingAudio: AudioTriggerKey[] = [];
    if (this.activation === 'Rhythm') {
      for (const binding of this.bindings) {
        if (binding.triggerAtMs > this.bindingLastMs && binding.triggerAtMs <= playheadMs) {
          // 同一帧内多个 binding 也按 ±16ms 合并，避免叠播同一资产。
          if (bindingAudio.some((trigger) => (
            withinSameAudioTick(trigger, binding.assetId, binding.triggerAtMs)
          ))) {
            continue;
          }
          bindingAudio.push({ assetId: binding.assetId, atMs: binding.triggerAtMs });
          this.sink.emit({
            origin: 'Binding',
            signal: {
              kind: 'Audio',
              moduleId: `binding:${binding.keyframeId}`,
              assetId: binding.assetId,
              volume: 0.8,
              atMs: binding.triggerAtMs,
            },
          });
        }
      }
    }
    this.bindingAudio = bindingAudio;

    this.runtime.advanceTo(playheadMs, true, (signal) => {
      // 同一帧内只要 binding 已触发过该资产，NEU 同资产音频一律让位。
      // 60Hz 下 playhead 可能一帧跨 16.7ms，不能只靠 atMs 差值判断同 tick。
      if (signal.kind === 'Audio' && this.bindingAudio.some((trigger) => (
        trigger.assetId === signal.assetId
      ))) {
        return;
      }
      this.sink.emit({ origin: 'NEU', signal });
    });
    this.bindingLastMs = playheadMs;
  }

  dispose(): void {
    this.disposed = true;
  }
}
