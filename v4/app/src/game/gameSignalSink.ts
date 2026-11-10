import type {
  ActiveLight,
  ActiveStageEffect,
} from '../../../core/editor/runtime/EffectCompositor';
import type {
  EditorEffectInterface,
  EditorEffectKind,
  EditorEffectParams,
  NeuModule,
} from '../../../core/editor/runtime/types';
import type { CycleWarning } from '../../../core/eventgraph/RandomMode';
import type { NeuSignal } from '../../../core/editor/runtime/NeuRuntime';
import type {
  GameSinkEvent,
  GameSignalSink as GameSignalSinkPort,
} from './neuRuntime';

/** Binding / NEU 双轨音频的“同 tick”窗口。 */
export const GAME_AUDIO_DEDUPE_MS = 16;

export interface GameAudioPort {
  play(assetId: string, volume: number): boolean;
  stopAll?(): void;
}

export interface GameAudioTrace {
  readonly assetId: string;
  readonly atMs: number;
  readonly origin: 'Binding' | 'NEU';
  readonly played: boolean;
}

export interface GameResourceOverlay {
  readonly overlayId: string;
  readonly moduleId: string;
  readonly assetId: string | null;
  readonly kind: 'image' | 'video' | 'videoStatic';
  readonly src: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly opacity: number;
}

export interface GameSubtitleOverlay {
  readonly overlayId: string;
  readonly moduleId: string;
  readonly text: string;
  readonly startMs: number;
  readonly durationMs: number;
}

export interface GamePlaybackSinkOptions {
  readonly audio: GameAudioPort;
  readonly modules?: readonly NeuModule[];
  readonly effects?: readonly EditorEffectInterface[];
  readonly resolveAsset?: (assetId: string) => string | null;
  readonly onCycleWarning?: (warning: CycleWarning) => void;
  readonly onAudioPlayback?: (trace: GameAudioTrace) => void;
  readonly audioDedupeMs?: number;
}

interface EffectEntry {
  readonly interfaceId: string;
  readonly moduleId: string;
  readonly effectKind: EditorEffectKind;
  readonly params: EditorEffectParams;
  readonly startMs: number;
}

interface LightEntry {
  readonly moduleId: string;
  readonly presets: ActiveLight['presets'];
  readonly startMs: number;
  readonly durationMs: number;
  readonly intensity: number;
  readonly mode: 'FullScreen' | 'Local';
  readonly targetAssetId: string | null;
}

function moduleNumber(
  module: NeuModule | undefined,
  key: string,
  fallback: number,
): number {
  const value = module?.params[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatCycleWarning(warning: CycleWarning): string {
  return `NEU 循环告警：${warning.moduleId} @ ${Math.round(warning.atMs)}ms（${warning.reason}）`;
}

/**
 * X · game signal sink。
 * 把 GameNeuRuntime 的纯信号落成音频 / 动效 / 光效 / 资源覆盖层 / HUD 警告。
 * 不依赖 React / DOM；音频宿主由 GameScreen 注入。
 */
export class GamePlaybackSink implements GameSignalSinkPort {
  private readonly audio: GameAudioPort;
  private readonly modules: readonly NeuModule[];
  private readonly effectDefinitions: readonly EditorEffectInterface[];
  private readonly resolveAsset: (assetId: string) => string | null;
  private readonly onCycleWarning: ((warning: CycleWarning) => void) | null;
  private readonly onAudioPlayback: ((trace: GameAudioTrace) => void) | null;
  private readonly audioDedupeMs: number;

  private readonly warnings = new Map<string, CycleWarning>();
  private effects: EffectEntry[] = [];
  private lights: LightEntry[] = [];
  private resources: GameResourceOverlay[] = [];
  private subtitles: GameSubtitleOverlay[] = [];
  private recentAudio: GameAudioTrace[] = [];
  private overlayCounter = 0;
  private disposed = false;
  private droppedAudio = 0;
  private lastAudioOrigin: 'Binding' | 'NEU' | null = null;

  constructor(options: GamePlaybackSinkOptions) {
    this.audio = options.audio;
    this.modules = options.modules ?? [];
    this.effectDefinitions = options.effects ?? [];
    this.resolveAsset = options.resolveAsset ?? (() => null);
    this.onCycleWarning = options.onCycleWarning ?? null;
    this.onAudioPlayback = options.onAudioPlayback ?? null;
    const dedupe = options.audioDedupeMs ?? GAME_AUDIO_DEDUPE_MS;
    this.audioDedupeMs = Number.isFinite(dedupe) && dedupe >= 0
      ? dedupe
      : GAME_AUDIO_DEDUPE_MS;
  }

  get audioTraces(): readonly GameAudioTrace[] {
    return this.recentAudio;
  }

  get droppedAudioCount(): number {
    return this.droppedAudio;
  }

  get lastTriggerOrigin(): 'Binding' | 'NEU' | null {
    return this.lastAudioOrigin;
  }

  get cycleWarnings(): readonly CycleWarning[] {
    return [...this.warnings.values()];
  }

  emit(event: GameSinkEvent): void {
    if (this.disposed) return;
    if ('warning' in event) {
      this.pushCycleWarning(event.warning);
      return;
    }
    switch (event.signal.kind) {
      case 'Audio':
        this.playAudio(event.origin, event.signal);
        break;
      case 'Effect':
        this.pushEffect(event.signal);
        break;
      case 'Light':
        this.pushLight(event.signal);
        break;
      case 'Resource':
        this.pushResource(event.signal);
        break;
      case 'Subtitle':
        this.pushSubtitle(event.signal);
        break;
      default:
        break;
    }
  }

  activeEffectsAt(playheadMs: number): readonly ActiveStageEffect[] {
    const active: ActiveStageEffect[] = [];
    for (const effect of this.effects) {
      const durationMs = effect.params.durationMs ?? 600;
      const localMs = playheadMs - effect.startMs;
      if (localMs < 0 || localMs > durationMs) continue;
      active.push({
        interfaceId: effect.interfaceId,
        effectKind: effect.effectKind,
        params: effect.params,
        localMs,
      });
    }
    return active;
  }

  activeLightsAt(playheadMs: number): readonly ActiveLight[] {
    const active: ActiveLight[] = [];
    for (const light of this.lights) {
      const localMs = playheadMs - light.startMs;
      if (localMs < 0 || localMs > light.durationMs) continue;
      active.push({
        presets: light.presets,
        localMs,
        durationMs: light.durationMs,
        intensity: light.intensity,
        mode: light.mode,
        targetAssetId: light.targetAssetId,
      });
    }
    return active;
  }

  activeResourcesAt(playheadMs: number): readonly GameResourceOverlay[] {
    return this.resources.filter((resource) => {
      const localMs = playheadMs - resource.startMs;
      return localMs >= 0 && localMs <= resource.durationMs;
    });
  }

  currentSubtitle(playheadMs: number): GameSubtitleOverlay | null {
    let current: GameSubtitleOverlay | null = null;
    for (const subtitle of this.subtitles) {
      const localMs = playheadMs - subtitle.startMs;
      if (localMs < 0 || localMs > subtitle.durationMs) continue;
      if (!current || subtitle.startMs >= current.startMs) current = subtitle;
    }
    return current;
  }

  /** 删除早已结束的事件，避免长时间游玩累积。 */
  prune(playheadMs: number): void {
    this.effects = this.effects.filter((effect) => (
      playheadMs <= effect.startMs + (effect.params.durationMs ?? 600) + 1000
    ));
    this.lights = this.lights.filter((light) => (
      playheadMs <= light.startMs + light.durationMs + 1000
    ));
    this.resources = this.resources.filter((resource) => (
      playheadMs <= resource.startMs + resource.durationMs + 1000
    ));
    this.subtitles = this.subtitles.filter((subtitle) => (
      playheadMs <= subtitle.startMs + subtitle.durationMs + 1000
    ));
    this.recentAudio = this.recentAudio.filter((trace) => trace.atMs >= playheadMs - 4000);
  }

  reset(): void {
    this.warnings.clear();
    this.effects = [];
    this.lights = [];
    this.resources = [];
    this.subtitles = [];
    this.recentAudio = [];
    this.droppedAudio = 0;
    this.lastAudioOrigin = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    try {
      this.audio.stopAll?.();
    } catch {
      // 音频宿主已关闭时不再抛给游戏循环。
    }
  }

  private playAudio(origin: 'Binding' | 'NEU', signal: NeuSignal & { kind: 'Audio' }): void {
    const last = this.recentAudio[this.recentAudio.length - 1];
    if (last && signal.atMs + this.audioDedupeMs < last.atMs) {
      this.recentAudio = [];
    }
    const duplicate = this.recentAudio.find((trace) => (
      trace.assetId === signal.assetId
      && Math.abs(trace.atMs - signal.atMs) <= this.audioDedupeMs
    ));
    if (duplicate) {
      this.droppedAudio += 1;
      return;
    }

    let played = false;
    try {
      played = this.audio.play(signal.assetId, signal.volume);
    } catch {
      played = false;
    }
    const trace: GameAudioTrace = {
      assetId: signal.assetId,
      atMs: signal.atMs,
      origin,
      played,
    };
    this.recentAudio = this.recentAudio.filter((item) => (
      signal.atMs - item.atMs <= 4000
    ));
    this.recentAudio.push(trace);
    this.lastAudioOrigin = origin;
    this.onAudioPlayback?.(trace);
  }

  private pushEffect(signal: NeuSignal & { kind: 'Effect' }): void {
    if (this.effects.some((effect) => (
      effect.moduleId === signal.moduleId && effect.startMs === signal.atMs
    ))) {
      return;
    }
    const definition = this.effectDefinitions.find((effect) => (
      effect.interfaceId === signal.interfaceId
    ));
    if (!definition) return;
    this.effects.push({
      interfaceId: definition.interfaceId,
      moduleId: signal.moduleId,
      effectKind: definition.effectKind,
      params: definition.params,
      startMs: signal.atMs,
    });
  }

  private pushLight(signal: NeuSignal & { kind: 'Light' }): void {
    if (this.lights.some((light) => (
      light.moduleId === signal.moduleId && light.startMs === signal.atMs
    ))) {
      return;
    }
    this.lights.push({
      moduleId: signal.moduleId,
      presets: [...signal.presets] as ActiveLight['presets'],
      startMs: signal.atMs,
      durationMs: Math.max(0, signal.durationMs),
      intensity: 1,
      mode: signal.mode,
      targetAssetId: signal.targetAssetId,
    });
  }

  private pushResource(signal: NeuSignal & { kind: 'Resource' }): void {
    if (signal.resourceType !== 'Image'
      && signal.resourceType !== 'Video'
      && signal.resourceType !== 'VideoStatic') {
      return;
    }
    if (this.resources.some((resource) => (
      resource.moduleId === signal.moduleId && resource.startMs === signal.atMs
    ))) {
      return;
    }
    const src = signal.assetId ? this.resolveAsset(signal.assetId) : null;
    if (!src) return;
    const module = this.modules.find((item) => item.moduleId === signal.moduleId);
    const durationMs = Math.max(0, moduleNumber(module, 'durationMs', 2000));
    const opacity = clamp(moduleNumber(module, 'opacity', 1), 0, 1);
    const kind = signal.resourceType === 'Image'
      ? 'image'
      : signal.resourceType === 'VideoStatic' ? 'videoStatic' : 'video';
    this.overlayCounter += 1;
    this.resources.push({
      overlayId: `neurou-resource-${this.overlayCounter}`,
      moduleId: signal.moduleId,
      assetId: signal.assetId,
      kind,
      src,
      startMs: signal.atMs,
      durationMs,
      opacity,
    });
  }

  private pushSubtitle(signal: NeuSignal & { kind: 'Subtitle' }): void {
    if (this.subtitles.some((subtitle) => (
      subtitle.moduleId === signal.moduleId && subtitle.startMs === signal.atMs
    ))) {
      return;
    }
    const module = this.modules.find((item) => item.moduleId === signal.moduleId);
    const durationMs = Math.max(0, moduleNumber(module, 'durationMs', 2000));
    this.overlayCounter += 1;
    this.subtitles.push({
      overlayId: `neurou-subtitle-${this.overlayCounter}`,
      moduleId: signal.moduleId,
      text: signal.text,
      startMs: signal.atMs,
      durationMs,
    });
  }

  private pushCycleWarning(warning: CycleWarning): void {
    if (this.warnings.has(warning.moduleId)) return;
    this.warnings.set(warning.moduleId, warning);
    this.onCycleWarning?.(warning);
  }
}
