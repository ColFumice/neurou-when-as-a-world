import { compileNeuGraph } from './NeuGraph';
import type { RandomPreviewMode, RandomSeed } from '../../eventgraph/RandomMode';
import type { CycleWarning } from '../../eventgraph/RandomMode';
import type { NeuModule, NeuModuleType } from './types';

export type NeuSignal =
  | {
    readonly kind: 'Audio';
    readonly moduleId: string;
    readonly assetId: string;
    readonly volume: number;
    readonly atMs: number;
  }
  | {
    readonly kind: 'Effect';
    readonly moduleId: string;
    readonly interfaceId: string;
    readonly atMs: number;
  }
  | {
    readonly kind: 'Light';
    readonly moduleId: string;
    readonly presets: readonly string[];
    readonly targetAssetId: string | null;
    readonly mode: 'FullScreen' | 'Local';
    readonly atMs: number;
    readonly durationMs: number;
  }
  | {
    readonly kind: 'Resource';
    readonly moduleId: string;
    readonly resourceType: NeuModuleType;
    readonly assetId: string | null;
    readonly atMs: number;
  }
  | {
    readonly kind: 'Subtitle';
    readonly moduleId: string;
    readonly text: string;
    readonly atMs: number;
  };

type NeuControlAction =
  | 'EnterRhythmMode'
  | 'PlayCutscene'
  | 'ExitToExplore';

/**
 * R5c-B · 控制信号与视觉/音频 NeuSignal 完全分离。
 * 只通过 onControl 投递，不进入 GamePlaybackSink。
 */
interface NeuControlSignal {
  readonly kind: 'Control';
  readonly moduleId: string;
  readonly action: NeuControlAction;
  readonly chartId: string | null;
  readonly cutsceneId: string | null;
  readonly atMs: number;
  readonly sourceId: string | null;
}

interface ScheduledPulse {
  readonly moduleId: string;
  readonly dueMs: number;
  readonly count: number;
}

interface RuntimeOptions {
  readonly mode?: RandomPreviewMode;
  readonly seed?: RandomSeed;
  readonly randomValue?: () => number;
  readonly onCycleWarning?: (warning: CycleWarning) => void;
  readonly onControl?: (signal: NeuControlSignal) => void;
  readonly activation?: 'Explore' | 'Rhythm';
}

const NEU_CONTROL_TYPES: readonly NeuModuleType[] = [
  'EnterRhythmMode',
  'PlayCutscene',
  'ExitToExplore',
];

const CYCLE_LIMIT = 100;
const MAX_COUNT = 100;

function parameterNumber(
  module: NeuModule,
  key: string,
  fallback: number,
): number {
  const value = module.params[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parameterString(
  module: NeuModule,
  key: string,
  fallback = '',
): string {
  const value = module.params[key];
  return typeof value === 'string' ? value : fallback;
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clampCount(value: number): number {
  return Math.min(MAX_COUNT, Math.max(0, Math.floor(value)));
}

function addCount(counts: Map<string, number>, moduleId: string, count: number): void {
  if (count <= 0) return;
  counts.set(moduleId, clampCount((counts.get(moduleId) ?? 0) + count));
}

/**
 * E · NEU runtime：纯 playhead 时钟执行器。
 * 不依赖 setTimeout / Date / DOM；暂停即冻结。
 *
 * 信号以 pulse count 传播：
 * - 普通节点 count=1；
 * - feedback ring 每轮继续传播，最多 100 轮，超限产生 CycleWarning；
 * - Random 按 count 次抽样；
 * - 下游资源/动效/音频按 count 次发射。
 */
export class NeuRuntime {
  private readonly modules: readonly NeuModule[];
  private readonly order: readonly NeuModule[];
  private readonly error: string | null;
  private readonly mode: RandomPreviewMode;
  private readonly seedValue: number;
  private readonly randomValue: () => number;
  private readonly onCycleWarning: ((warning: CycleWarning) => void) | null;
  private readonly onControl: ((signal: NeuControlSignal) => void) | null;
  private readonly activation: 'Explore' | 'Rhythm';
  private lastMs = 0;
  private scheduled: ScheduledPulse[] = [];
  private pendingExternal = new Map<string, number>();
  private triggerSeq = new Map<string, number>();
  private warned = new Set<string>();

  constructor(modules: readonly NeuModule[], options: RuntimeOptions = {}) {
    const compiled = compileNeuGraph(modules);
    this.modules = modules;
    this.order = compiled.order;
    this.error = compiled.error;
    this.mode = options.mode ?? ('Seeded' as RandomPreviewMode);
    this.seedValue = options.seed?.value ?? 0;
    this.randomValue = options.randomValue ?? (() => Math.random());
    this.onCycleWarning = options.onCycleWarning ?? null;
    this.onControl = options.onControl ?? null;
    this.activation = options.activation ?? 'Rhythm';
    this.lastMs = 0;
  }

  get compileError(): string | null {
    return this.error;
  }

  reset(timeMs: number): void {
    this.lastMs = timeMs - 1;
    this.scheduled = [];
    this.pendingExternal.clear();
    this.triggerSeq.clear();
    this.warned.clear();
  }

  /** R5c-B：Trace/Trigger 等外部源注入图根脉冲；下一帧消费。 */
  pulse(sourceId: string, count = 1): void {
    if (sourceId.trim() === '' || count <= 0) return;
    addCount(this.pendingExternal, sourceId, count);
  }

  private warn(module: NeuModule, atMs: number, reason: CycleWarning['reason']): void {
    if (this.warned.has(module.moduleId)) return;
    this.warned.add(module.moduleId);
    this.onCycleWarning?.({
      moduleId: module.moduleId,
      atMs,
      limit: CYCLE_LIMIT,
      reason,
    });
  }

  private drawRandom(module: NeuModule, probability: number): boolean {
    const chance = Math.min(1, Math.max(0, probability));
    if (this.mode === 'Live') {
      const value = this.randomValue();
      return Math.min(0.999999999, Math.max(0, value)) < chance;
    }
    const sequence = (this.triggerSeq.get(module.moduleId) ?? 0) + 1;
    this.triggerSeq.set(module.moduleId, sequence);
    const hash = fnv1a(`${this.seedValue}|${module.moduleId}|${sequence}`);
    return mulberry32(hash)() < chance;
  }

  private emitSignal(
    module: NeuModule,
    count: number,
    currentMs: number,
    emit: (signal: NeuSignal) => void,
  ): void {
    for (let index = 0; index < count; index += 1) {
      switch (module.type) {
        case 'Audio':
          emit({
            kind: 'Audio',
            moduleId: module.moduleId,
            assetId: parameterString(module, 'assetId', 'asset:audio:main'),
            volume: Math.min(1, Math.max(0, parameterNumber(module, 'volume', 0.8))),
            atMs: currentMs,
          });
          break;
        case 'Effect':
          emit({
            kind: 'Effect',
            moduleId: module.moduleId,
            interfaceId: parameterString(module, 'interfaceId'),
            atMs: currentMs,
          });
          break;
        case 'Light': {
          const presets = module.params.presets;
          emit({
            kind: 'Light',
            moduleId: module.moduleId,
            presets: Array.isArray(presets) ? presets : [],
            targetAssetId: parameterString(module, 'targetAssetId') || null,
            mode: parameterString(module, 'mode', 'FullScreen') === 'Local' ? 'Local' : 'FullScreen',
            atMs: currentMs,
            durationMs: parameterNumber(module, 'durationMs', 600),
          });
          break;
        }
        case 'Video':
        case 'VideoStatic':
        case 'Image':
          emit({
            kind: 'Resource',
            moduleId: module.moduleId,
            resourceType: module.type,
            assetId: parameterString(module, 'assetId') || null,
            atMs: currentMs,
          });
          break;
        case 'Subtitle':
          emit({
            kind: 'Subtitle',
            moduleId: module.moduleId,
            text: parameterString(module, 'text', '字幕'),
            atMs: currentMs,
          });
          break;
        default:
          break;
      }
    }
  }

  private emitControl(module: NeuModule, atMs: number): void {
    if (!this.onControl || this.activation !== 'Explore') return;
    const action = module.type === 'EnterRhythmMode'
      ? 'EnterRhythmMode'
      : module.type === 'PlayCutscene'
        ? 'PlayCutscene'
        : module.type === 'ExitToExplore'
          ? 'ExitToExplore'
          : null;
    if (action === null) return;
    this.onControl({
      kind: 'Control',
      moduleId: module.moduleId,
      action,
      chartId: action === 'EnterRhythmMode'
        ? (parameterString(module, 'chartId') || null)
        : null,
      cutsceneId: action === 'PlayCutscene'
        ? (parameterString(module, 'cutsceneId') || null)
        : null,
      atMs,
      sourceId: parameterString(module, 'sourceId') || null,
    });
  }

  advanceTo(
    currentMs: number,
    playing: boolean,
    emit: (signal: NeuSignal) => void,
    trace?: (moduleId: string) => void,
  ): void {
    if (!playing || this.error) {
      this.lastMs = currentMs;
      return;
    }
    if (currentMs < this.lastMs) {
      this.reset(currentMs);
    }

    const initial = new Map<string, number>();
    const traced = new Set<string>();
    const traceOnce = (moduleId: string): void => {
      if (traced.has(moduleId)) return;
      traced.add(moduleId);
      trace?.(moduleId);
    };

    if (this.activation === 'Rhythm') {
      for (const module of this.modules) {
        if (module.type !== 'RhythmPoint') continue;
        const at = parameterNumber(module, 'timeMs', -1);
        if (at >= 0 && at > this.lastMs && at <= currentMs) {
          addCount(initial, module.moduleId, 1);
          traceOnce(module.moduleId);
        }
      }
    } else {
      // Explore：只 seed 无输入的时间根控制节点；RhythmPoint 不参与。
      for (const module of this.modules) {
        if (!NEU_CONTROL_TYPES.includes(module.type) || module.inputs.length > 0) continue;
        const at = parameterNumber(module, 'atMs', -1);
        if (at >= 0 && at > this.lastMs && at <= currentMs) {
          addCount(initial, module.moduleId, 1);
          traceOnce(module.moduleId);
        }
      }
    }

    for (const [sourceId, count] of this.pendingExternal) {
      addCount(initial, sourceId, count);
      traceOnce(sourceId);
    }
    this.pendingExternal.clear();

    const due = this.scheduled.filter((pulse) => pulse.dueMs <= currentMs);
    this.scheduled = this.scheduled.filter((pulse) => pulse.dueMs > currentMs);
    for (const pulse of due) {
      addCount(initial, pulse.moduleId, pulse.count);
      traceOnce(pulse.moduleId);
    }

    let pending = initial;
    if (pending.size === 0) {
      this.lastMs = currentMs;
      return;
    }

    const byId = new Map(this.modules.map((module) => [module.moduleId, module]));
    const evaluatedNot = new Set<string>();
    let rounds = 0;
    while (pending.size > 0 && rounds < CYCLE_LIMIT) {
      rounds += 1;
      const next = new Map<string, number>();

      for (const module of this.order) {
        if (module.type === 'RhythmPoint') continue;
        const inputCounts = module.inputs.map((input) => pending.get(input.sourceModuleId) ?? 0);
        const incoming = inputCounts.reduce((sum, value) => sum + value, 0);
        const anyInput = inputCounts.some((value) => value > 0);
        const notTick = module.type === 'NOT'
          && inputCounts.length > 0
          && !evaluatedNot.has(module.moduleId);
        if (NEU_CONTROL_TYPES.includes(module.type)) {
          if (this.activation !== 'Explore') continue;
          const seeded = initial.get(module.moduleId) ?? 0;
          const count = module.inputs.length === 0 ? seeded : incoming;
          if (count > 0) {
            traceOnce(module.moduleId);
            this.emitControl(module, currentMs);
          }
          continue;
        }
        if (incoming <= 0 && !notTick) continue;
        if (module.type === 'NOT') evaluatedNot.add(module.moduleId);

        let outputCount = 0;
        switch (module.type) {
          case 'AND':
            outputCount = inputCounts.length > 0 && inputCounts.every((value) => value > 0)
              ? Math.min(...inputCounts)
              : 0;
            break;
          case 'OR':
            outputCount = inputCounts.length > 0 ? Math.max(...inputCounts) : 0;
            break;
          case 'NOT':
            // 本 tick 无输入时触发下游；有输入则阻断。
            outputCount = anyInput ? 0 : 1;
            break;
          case 'Channel':
            outputCount = incoming;
            {
              const idMatch = /^channel-right-(\d+)$/.exec(module.moduleId);
              const isRight = parameterString(module, 'side') === 'right' || idMatch !== null;
              if (outputCount > 0 && isRight) {
                const port = idMatch
                  ? Number(idMatch[1])
                  : Math.max(1, Math.floor(parameterNumber(module, 'port', 0)));
                const leftId = `channel-left-${port}`;
                if (byId.has(leftId)) {
                  next.set(leftId, clampCount((next.get(leftId) ?? 0) + outputCount));
                  traceOnce(leftId);
                }
              }
            }
            break;
          case 'Random': {
            const probability = parameterNumber(module, 'probability', 0.5);
            const drawCount = clampCount(incoming);
            let hits = 0;
            for (let index = 0; index < drawCount; index += 1) {
              if (this.drawRandom(module, probability)) hits += 1;
            }
            outputCount = hits;
            break;
          }
          case 'Delay': {
            const delayMs = Math.max(0, parameterNumber(module, 'delayMs', 0));
            const delayCount = clampCount(incoming);
            if (delayCount > 0) {
              this.scheduled.push({
                moduleId: module.moduleId,
                dueMs: currentMs + delayMs,
                count: delayCount,
              });
            }
            continue;
          }
          default:
            outputCount = incoming;
            break;
        }

        if (outputCount <= 0) continue;
        next.set(module.moduleId, clampCount((next.get(module.moduleId) ?? 0) + outputCount));
        traceOnce(module.moduleId);
        this.emitSignal(module, outputCount, currentMs, emit);
      }

      if (next.size === 0) break;
      if (rounds >= CYCLE_LIMIT) {
        for (const moduleId of next.keys()) {
          const module = byId.get(moduleId);
          if (module) this.warn(module, currentMs, 'GraphCycle');
        }
        this.lastMs = currentMs;
        return;
      }
      pending = next;
    }

    this.lastMs = currentMs;
  }
}
