import type { AIKeyframeGeneration, ChartEditMode } from './types';
import type {
  EditorBinding,
  EditorEffectInterface,
  EditorEffectKind,
  NeuInput,
  NeuModule,
  NeuModuleParams,
  NeuModuleType,
  NeuOutput,
} from './runtime/types';
import type { ChartSourceData } from './ChartSourceData';
import { parseChartSourceData } from './ChartSourceData';
import { ChartKeyframe } from './keyframe';
import { ChartEditUndo } from './history';
import { EditorCanvas } from './timeline/EditorCanvas';
import { EditorInspector } from './timeline/EditorInspector';
import { EditorPlayhead } from './timeline/EditorPlayhead';
import { EditorSelection } from './timeline/EditorSelection';
import { EditorTimeline } from './timeline/EditorTimeline';
import { EditorTrack } from './timeline/EditorTrack';

type Provenance = 'Mock' | 'Midi';

interface PatchLocation {
  readonly trackId: string;
  readonly index: number;
  readonly keyframe: ChartKeyframe;
}

interface DragState {
  readonly keyframeId: string;
  readonly startX: number;
  readonly startY: number;
  readonly startPlayheadMs: number;
  readonly original: ChartKeyframe;
  phase: 'Pressed' | 'Dragging';
  preview: ChartKeyframe;
  changed: boolean;
}

interface GroupDragItem {
  readonly keyframeId: string;
  readonly trackId: string;
  readonly original: ChartKeyframe;
}

interface GroupDragState {
  readonly startX: number;
  readonly startY: number;
  readonly startPlayheadMs: number;
  readonly items: readonly GroupDragItem[];
  previews: ReadonlyMap<string, ChartKeyframe>;
  changed: boolean;
}

interface EditorAISettings {
  readonly mode: 'Local' | 'Cloud';
  readonly localEndpoint: string;
  readonly localModel: string;
  readonly cloudEndpoint: string;
  readonly cloudModel: string;
  readonly keyRef: string;
  readonly timeoutMs: number;
  readonly fallback: readonly ('Local' | 'Cloud')[];
}

const DEFAULT_AI_SETTINGS: EditorAISettings = {
  mode: 'Local',
  localEndpoint: 'http://127.0.0.1:11434',
  localModel: 'qwen2.5:7b',
  cloudEndpoint: 'https://api.openai.com/v1',
  cloudModel: 'gpt-4o-mini',
  keyRef: 'ai:cloud',
  timeoutMs: 30_000,
  fallback: ['Local'],
};

function aiSettings(raw: unknown): EditorAISettings {
  const value = record(raw, 'ai');
  exactKeys(value, [
    'mode',
    'localEndpoint',
    'localModel',
    'cloudEndpoint',
    'cloudModel',
    'keyRef',
    'timeoutMs',
    'fallback',
  ]);
  const mode = value.mode;
  if (mode !== 'Local' && mode !== 'Cloud') fail('ai.mode must be Local / Cloud');
  const localEndpoint = text(value.localEndpoint, 'ai.localEndpoint', 2048);
  const localModel = text(value.localModel, 'ai.localModel', 256);
  const cloudEndpoint = text(value.cloudEndpoint, 'ai.cloudEndpoint', 2048);
  const cloudModel = text(value.cloudModel, 'ai.cloudModel', 256);
  const keyRef = text(value.keyRef, 'ai.keyRef', 256);
  const timeoutMs = integer(value.timeoutMs, 100, 120_000, 'ai.timeoutMs');
  if (!Array.isArray(value.fallback)) fail('ai.fallback must be an array');
  const fallback = value.fallback.map((entry) => {
    if (entry !== 'Local' && entry !== 'Cloud') fail('ai.fallback must be Local / Cloud');
    return entry;
  });
  return {
    mode,
    localEndpoint,
    localModel,
    cloudEndpoint,
    cloudModel,
    keyRef,
    timeoutMs,
    fallback: [...new Set(fallback)],
  };
}

function aiSettingsJson(settings: EditorAISettings): Record<string, unknown> {
  return {
    mode: settings.mode,
    localEndpoint: settings.localEndpoint,
    localModel: settings.localModel,
    cloudEndpoint: settings.cloudEndpoint,
    cloudModel: settings.cloudModel,
    keyRef: settings.keyRef,
    timeoutMs: settings.timeoutMs,
    fallback: [...settings.fallback],
  };
}

type LayerAudioMap = Readonly<Record<string, string | null>>;

interface WorldCreateInput {
  readonly documentId: string;
  readonly chartId: string;
  readonly provenance?: Provenance;
  readonly tracks?: readonly EditorTrack[];
  readonly seed?: number;
  readonly stageWidth?: number;
  readonly stageHeight?: number;
  readonly durationMs?: number;
  readonly bindings?: readonly EditorBinding[];
  readonly neuModules?: readonly NeuModule[];
  readonly effects?: readonly EditorEffectInterface[];
  readonly ai?: EditorAISettings;
  readonly layerAudio?: LayerAudioMap;
}

function fail(message: string): never {
  throw new TypeError(`EditorWorldFile: ${message}`);
}

function parseLayerAudio(raw: unknown): Record<string, string | null> {
  if (raw === undefined) return {};
  const value = record(raw, 'layerAudio');
  const result: Record<string, string | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[1-9][0-9]*$/.test(key)) fail(`layerAudio.${key} must be a decimal layer index`);
    const layerIndex = Number(key);
    if (!Number.isSafeInteger(layerIndex) || layerIndex < 1 || layerIndex > 32) {
      fail(`layerAudio.${key} must be within 1..32`);
    }
    if (entry === null) {
      result[key] = null;
      continue;
    }
    const assetId = text(entry, `layerAudio.${key}`, 128);
    if (!assetId.startsWith('asset:audio:')) {
      fail(`layerAudio.${key} must reference an asset:audio:* asset`);
    }
    result[key] = assetId;
  }
  return result;
}

function layerAudioJson(layerAudio: LayerAudioMap): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const key of Object.keys(layerAudio).sort((left, right) => Number(left) - Number(right))) {
    result[key] = layerAudio[key] ?? null;
  }
  return result;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`unknown field ${key}`);
  }
  for (const key of required) {
    if (!(key in value)) fail(`missing field ${key}`);
  }
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

function text(value: unknown, label: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    fail(`${label} must be a non-empty string (max ${max})`);
  }
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) {
    fail(`${label} must not contain control characters`);
  }
  return value;
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return text(value, label);
}

function seedValue(value: unknown): number {
  return integer(value, 0, 0xffff_ffff, 'seed');
}

function parseLogo(raw: unknown): NonNullable<ChartKeyframe['logo']> | null {
  if (raw === undefined || raw === null) return null;
  const value = record(raw, 'logo');
  exactKeys(value, [
    'logoId',
    'assetId',
    'x',
    'y',
    'size',
    'stretch',
    'appearEffect',
    'disappearEffect',
    'easing',
  ]);
  return {
    logoId: text(value.logoId, 'logo.logoId'),
    assetId: text(value.assetId, 'logo.assetId'),
    x: Number(value.x),
    y: Number(value.y),
    size: Number(value.size),
    stretch: Number(value.stretch),
    appearEffect: value.appearEffect as NonNullable<ChartKeyframe['logo']>['appearEffect'],
    disappearEffect: value.disappearEffect as NonNullable<ChartKeyframe['logo']>['disappearEffect'],
    easing: value.easing as NonNullable<ChartKeyframe['logo']>['easing'],
  };
}

const EFFECT_KINDS: readonly EditorEffectKind[] = [
  'EaseIn',
  'EaseOut',
  'ScaleUp',
  'ScaleDown',
  'Glitch',
  'ScrollOpen',
  'ScrollClose',
  'Bounce',
  'Wander',
  'Shake',
];

const NEU_TYPES: readonly NeuModuleType[] = [
  'AND', 'OR', 'NOT', 'Delay', 'Random', 'RhythmPoint',
  'Video', 'VideoStatic', 'Image', 'Audio', 'Subtitle', 'Effect', 'Light', 'Channel',
  'EnterRhythmMode', 'PlayCutscene', 'ExitToExplore',
];

function parseEffectParams(raw: unknown, label: string): EditorEffectInterface['params'] {
  if (raw === undefined || raw === null) return {};
  const value = record(raw, label);
  const result: Record<string, number | undefined> = {};
  for (const key of [
    'durationMs', 'intensity', 'scale', 'direction', 'seed',
    'bounceCount', 'initialHeight', 'glitchOffset', 'scrollAmount',
    'shakeAmplitude', 'wanderRadius', 'opacity',
  ]) {
    if (value[key] === undefined) continue;
    const numberValue = Number(value[key]);
    if (!Number.isFinite(numberValue)) fail(`${label}.${key} must be finite`);
    result[key] = numberValue;
  }
  return result;
}

function parseEffects(raw: unknown): EditorEffectInterface[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail('effects must be an array');
  const seen = new Set<string>();
  return raw.map((item) => {
    const value = record(item, 'effect');
    exactKeys(value, ['interfaceId', 'effectKind', 'params']);
    const interfaceId = text(value.interfaceId, 'effect.interfaceId');
    if (seen.has(interfaceId)) fail('duplicate effect interfaceId');
    seen.add(interfaceId);
    const effectKind = value.effectKind as EditorEffectKind;
    if (!EFFECT_KINDS.includes(effectKind)) fail('invalid effectKind');
    return {
      interfaceId,
      effectKind,
      params: parseEffectParams(value.params, 'effect.params'),
    };
  });
}

function parseBindings(raw: unknown): EditorBinding[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail('bindings must be an array');
  return raw.map((item) => {
    const value = record(item, 'binding');
    exactKeys(value, ['keyframeId', 'assetId', 'triggerAtMs']);
    return {
      keyframeId: text(value.keyframeId, 'binding.keyframeId'),
      assetId: text(value.assetId, 'binding.assetId'),
      triggerAtMs: integer(value.triggerAtMs, 0, Number.MAX_SAFE_INTEGER, 'binding.triggerAtMs'),
    };
  });
}

function parseNeuModules(raw: unknown): NeuModule[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail('neuModules must be an array');
  const ids = new Set<string>();
  return raw.map((item) => {
    const value = record(item, 'neuModule');
    exactKeys(value, ['moduleId', 'type', 'x', 'y', 'params', 'inputs', 'outputs']);
    const moduleId = text(value.moduleId, 'module.moduleId');
    if (ids.has(moduleId)) fail('duplicate moduleId');
    ids.add(moduleId);
    const type = value.type as NeuModuleType;
    if (!NEU_TYPES.includes(type)) fail('invalid neu module type');
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || x < 0 || x > 1 || !Number.isFinite(y) || y < 0 || y > 1) {
      fail('module x/y must be within 0..1');
    }
    const paramsRaw = record(value.params, 'module.params');
    const params: NeuModuleParams = {};
    for (const [key, param] of Object.entries(paramsRaw)) {
      if (param === null || typeof param === 'string' || typeof param === 'number'
        || typeof param === 'boolean') {
        params[key] = param;
      } else if (Array.isArray(param) && param.every((entry) => typeof entry === 'string')) {
        params[key] = param as string[];
      } else {
        fail(`module.params.${key} is unsupported`);
      }
    }
    if (!Array.isArray(value.inputs) || !Array.isArray(value.outputs)) {
      fail('module inputs/outputs must be arrays');
    }
    const inputs: NeuInput[] = value.inputs.map((inputRaw) => {
      const input = record(inputRaw, 'module.input');
      exactKeys(input, ['port', 'sourceModuleId', 'sourcePort']);
      return {
        port: integer(input.port, 1, 6, 'input.port'),
        sourceModuleId: text(input.sourceModuleId, 'input.sourceModuleId'),
        sourcePort: integer(input.sourcePort, 1, 6, 'input.sourcePort'),
      };
    });
    const outputs: NeuOutput[] = value.outputs.map((outputRaw) => {
      const output = record(outputRaw, 'module.output');
      exactKeys(output, ['port', 'targets']);
      if (!Array.isArray(output.targets)) fail('output.targets must be an array');
      return {
        port: integer(output.port, 1, 6, 'output.port'),
        targets: output.targets.map((targetRaw) => {
          const target = record(targetRaw, 'output.target');
          exactKeys(target, ['moduleId', 'port']);
          return {
            moduleId: text(target.moduleId, 'target.moduleId'),
            port: integer(target.port, 1, 6, 'target.port'),
          };
        }),
      };
    });
    return { moduleId, type, x, y, params, inputs, outputs };
  });
}

function parseKeyframe(raw: unknown): ChartKeyframe {
  const value = record(raw, 'keyframe');
  exactKeys(
    value,
    [
      'keyframeId',
      'timeMs',
      'durationMs',
      'chartLayerIndex',
      'chartPadKind',
      'gridCellId',
      'chartKeyId',
      'logo',
    ],
    ['parallaxFactor', 'effectInterfaceIds'],
  );
  return new ChartKeyframe({
    keyframeId: text(value.keyframeId, 'keyframeId'),
    timeMs: integer(value.timeMs, 0, Number.MAX_SAFE_INTEGER, 'timeMs'),
    durationMs: integer(value.durationMs, 0, Number.MAX_SAFE_INTEGER, 'durationMs'),
    chartLayerIndex: integer(value.chartLayerIndex, 1, 32, 'chartLayerIndex'),
    gridCellId: value.gridCellId === null ? null : integer(value.gridCellId, 1, 8, 'gridCellId'),
    chartKeyId: optionalText(value.chartKeyId, 'chartKeyId'),
    chartPadKind: value.chartPadKind as ChartKeyframe['chartPadKind'],
    parallaxFactor: value.parallaxFactor === undefined ? 1 : Number(value.parallaxFactor),
    effectInterfaceIds: value.effectInterfaceIds === undefined
      ? []
      : (() => {
        if (!Array.isArray(value.effectInterfaceIds)) fail('effectInterfaceIds must be an array');
        return value.effectInterfaceIds.map((entry) => text(entry, 'effectInterfaceId'));
      })(),
    logo: parseLogo(value.logo),
  });
}

function keyframeJson(keyframe: ChartKeyframe): Record<string, unknown> {
  return {
    keyframeId: keyframe.keyframeId,
    timeMs: keyframe.timeMs,
    durationMs: keyframe.durationMs,
    chartLayerIndex: keyframe.chartLayerIndex,
    gridCellId: keyframe.gridCellId,
    chartKeyId: keyframe.chartKeyId,
    chartPadKind: keyframe.chartPadKind,
    parallaxFactor: keyframe.parallaxFactor,
    effectInterfaceIds: keyframe.effectInterfaceIds,
    logo: keyframe.logo,
  };
}

function keyframeEquals(left: ChartKeyframe, right: ChartKeyframe): boolean {
  return left.timeMs === right.timeMs
    && left.durationMs === right.durationMs
    && left.chartLayerIndex === right.chartLayerIndex
    && left.gridCellId === right.gridCellId
    && left.chartKeyId === right.chartKeyId
    && left.chartPadKind === right.chartPadKind
    && left.parallaxFactor === right.parallaxFactor
    && left.effectInterfaceIds.join('|') === right.effectInterfaceIds.join('|')
    && left.logo === right.logo;
}

/**
 * E · editor / EditorWorldFile
 * 编辑文档根：tracks / canvas / timeline / playhead / selection / history / dirty。
 * 纯数据 + 纯方法；不依赖 React / Tauri / Pixi / fs。
 */
export class EditorWorldFile {
  readonly documentId: string;
  readonly chartId: string;
  readonly provenance: Provenance;
  readonly canvas: EditorCanvas;
  readonly timeline: EditorTimeline;
  readonly playhead: EditorPlayhead;
  readonly selection: EditorSelection;
  readonly history: ChartEditUndo;
  readonly aiGeneration: AIKeyframeGeneration = {
    status: 'Unavailable',
    reason: 'AIUnavailable',
  };

  private readonly _tracks: EditorTrack[] = [];
  private _bindings: readonly EditorBinding[] = [];
  private _neuModules: readonly NeuModule[] = [];
  private _effects: readonly EditorEffectInterface[] = [];
  private _ai: EditorAISettings = DEFAULT_AI_SETTINGS;
  private _layerAudio: Record<string, string | null> = {};
  private _seed: number;
  private _dirty = false;
  private _mode: ChartEditMode = 'Keyframes';
  private _counter = 0;
  private _drag: DragState | null = null;
  private _groupDrag: GroupDragState | null = null;

  private constructor(input: Required<WorldCreateInput>) {
    this.documentId = text(input.documentId, 'documentId');
    this.chartId = text(input.chartId, 'chartId');
    this.provenance = input.provenance;
    this._seed = seedValue(input.seed);
    this._bindings = input.bindings;
    this._neuModules = input.neuModules;
    this._effects = input.effects;
    this._ai = input.ai;
    this._layerAudio = { ...input.layerAudio };
    this.canvas = new EditorCanvas(input.stageWidth, input.stageHeight);

    for (const track of input.tracks) {
      if (this._tracks.some((current) => current.layerIndex === track.layerIndex)) {
        fail(`duplicate track layerIndex: ${track.layerIndex}`);
      }
      this._tracks.push(track);
    }
    this._tracks.sort((left, right) => left.layerIndex - right.layerIndex);
    this.ensureBaseTracks();

    const lastTime = this.allKeyframes().reduce(
      (max, keyframe) => Math.max(max, keyframe.timeMs + keyframe.durationMs),
      0,
    );
    const durationMs = input.durationMs > 0
      ? input.durationMs
      : Math.max(10_000, lastTime + 1_000);
    this.timeline = new EditorTimeline({
      laneLeft: 0,
      laneWidth: 1000,
      durationMs,
    });
    this.playhead = new EditorPlayhead(durationMs);
    this.selection = new EditorSelection();
    this.history = new ChartEditUndo(100);
    this._counter = this.scanCounter();
  }

  static create(input: WorldCreateInput): EditorWorldFile {
    const provenance: Provenance = input.provenance ?? 'Mock';
    if (provenance !== 'Mock' && provenance !== 'Midi') fail('provenance must be Mock / Midi');
    const tracks = input.tracks ?? [
      new EditorTrack('layer-1', 1),
      new EditorTrack('layer-2', 2),
    ];
    return new EditorWorldFile({
      documentId: input.documentId,
      chartId: input.chartId,
      provenance,
      tracks,
      seed: input.seed ?? 0,
      stageWidth: input.stageWidth ?? 1280,
      stageHeight: input.stageHeight ?? 720,
      durationMs: input.durationMs ?? 0,
      bindings: input.bindings ?? [],
      neuModules: input.neuModules ?? [],
      effects: input.effects ?? [],
      ai: input.ai ?? DEFAULT_AI_SETTINGS,
      layerAudio: input.layerAudio ?? {},
    });
  }

  /** 语义别名；等价于 fromJson。 */
  static load(raw: unknown): EditorWorldFile {
    return EditorWorldFile.fromJson(raw);
  }

  static fromJson(raw: unknown): EditorWorldFile {
    const value = record(raw, 'root');
    exactKeys(
      value,
      ['schemaVersion', 'documentId', 'chartId', 'provenance', 'seed', 'tracks', 'canvas'],
      ['durationMs', 'bindings', 'neuModules', 'effects', 'ai', 'layerAudio'],
    );
    if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
      fail('only editor schemaVersion 1/2 is supported');
    }
    const documentId = text(value.documentId, 'documentId');
    const chartId = text(value.chartId, 'chartId');
    const provenance = value.provenance;
    if (provenance !== 'Mock' && provenance !== 'Midi') fail('provenance must be Mock / Midi');
    const seed = seedValue(value.seed);
    const tracksRaw = value.tracks;
    if (!Array.isArray(tracksRaw)) fail('tracks must be an array');
    const tracks: EditorTrack[] = [];
    const keyframeIds = new Set<string>();
    const trackIds = new Set<string>();
    const layerIndices = new Set<number>();
    for (const rawTrack of tracksRaw) {
      const track = record(rawTrack, 'track');
      exactKeys(track, ['trackId', 'layerIndex', 'keyframes']);
      const trackId = text(track.trackId, 'trackId');
      const layerIndex = integer(track.layerIndex, 1, 32, 'layerIndex');
      if (trackIds.has(trackId)) fail('duplicate trackId');
      if (layerIndices.has(layerIndex)) fail('duplicate track layerIndex');
      trackIds.add(trackId);
      layerIndices.add(layerIndex);
      if (!Array.isArray(track.keyframes)) fail('track.keyframes must be an array');
      const keyframes = track.keyframes.map((rawKeyframe) => {
        const keyframe = parseKeyframe(rawKeyframe);
        if (keyframeIds.has(keyframe.keyframeId)) fail('duplicate keyframeId');
        keyframeIds.add(keyframe.keyframeId);
        if (keyframe.chartLayerIndex !== layerIndex) fail('keyframe layer does not match track');
        return keyframe;
      });
      tracks.push(new EditorTrack(trackId, layerIndex, keyframes));
    }

    const canvasRaw = record(value.canvas, 'canvas');
    exactKeys(canvasRaw, ['stageWidth', 'stageHeight']);
    const stageWidth = Number(canvasRaw.stageWidth);
    const stageHeight = Number(canvasRaw.stageHeight);
    const durationMs = value.durationMs === undefined
      ? 0
      : integer(value.durationMs, 0, Number.MAX_SAFE_INTEGER, 'durationMs');
    const lastKeyframeEnd = tracks
      .flatMap((track) => track.keyframes)
      .reduce((max, keyframe) => Math.max(max, keyframe.timeMs + keyframe.durationMs), 0);
    if (durationMs > 0 && lastKeyframeEnd > durationMs) {
      fail('keyframe exceeds durationMs');
    }
    const effects = parseEffects(value.effects);
    const bindings = parseBindings(value.bindings);
    const neuModules = parseNeuModules(value.neuModules);
    const ai = value.ai === undefined ? DEFAULT_AI_SETTINGS : aiSettings(value.ai);
    const layerAudio = parseLayerAudio(value.layerAudio);
    const effectIds = new Set(effects.map((effect) => effect.interfaceId));
    for (const keyframe of tracks.flatMap((track) => track.keyframes)) {
      for (const effectId of keyframe.effectInterfaceIds) {
        if (!effectIds.has(effectId)) fail(`unknown effectInterfaceId: ${effectId}`);
      }
    }
    for (const binding of bindings) {
      if (!keyframeIds.has(binding.keyframeId)) fail('binding references unknown keyframe');
      if (durationMs > 0 && binding.triggerAtMs > durationMs) fail('binding triggerAtMs exceeds duration');
    }
    const moduleIds = new Set(neuModules.map((module) => module.moduleId));
    for (const module of neuModules) {
      for (const input of module.inputs) {
        if (!moduleIds.has(input.sourceModuleId)) fail('module input references unknown module');
      }
      for (const output of module.outputs) {
        for (const target of output.targets) {
          if (!moduleIds.has(target.moduleId)) fail('module output references unknown module');
        }
      }
    }
    const file = EditorWorldFile.create({
      documentId,
      chartId,
      provenance,
      tracks,
      seed,
      stageWidth,
      stageHeight,
      durationMs,
      bindings,
      neuModules,
      effects,
      ai,
      layerAudio,
    });
    file._dirty = false;
    return file;
  }

  get tracks(): readonly EditorTrack[] {
    return this._tracks;
  }

  get seed(): number {
    return this._seed;
  }

  get bindings(): readonly EditorBinding[] {
    return this._bindings;
  }

  get neuModules(): readonly NeuModule[] {
    return this._neuModules;
  }

  get layerAudio(): LayerAudioMap {
    return { ...this._layerAudio };
  }

  /** 每层最多一个音频；null 表示显式未绑定。BGM 由运行时拒绝。 */
  setLayerAudio(layerIndex: number, assetId: string | null): void {
    const layer = integer(layerIndex, 1, 32, 'layerAudio layerIndex');
    let next: string | null = null;
    if (assetId !== null) {
      next = text(assetId, 'layerAudio assetId', 128);
      if (!next.startsWith('asset:audio:')) {
        fail('layerAudio assetId must reference an asset:audio:* asset');
      }
    }
    const key = String(layer);
    if ((this._layerAudio[key] ?? null) === next) return;
    this._layerAudio = { ...this._layerAudio, [key]: next };
    this._dirty = true;
  }

  get effects(): readonly EditorEffectInterface[] {
    return this._effects;
  }

  get ai(): EditorAISettings {
    return this._ai;
  }

  setAISettings(input: unknown): void {
    const next = aiSettings(input);
    this._ai = next;
    this._dirty = true;
  }

  setBindings(bindings: readonly EditorBinding[]): void {
    const keyframeIds = new Set(this.allKeyframes().map((keyframe) => keyframe.keyframeId));
    for (const binding of bindings) {
      if (!keyframeIds.has(binding.keyframeId)) fail('binding references unknown keyframe');
      if (!Number.isSafeInteger(binding.triggerAtMs)
        || binding.triggerAtMs < 0
        || binding.triggerAtMs > this.durationMs) {
        fail('binding triggerAtMs is invalid');
      }
    }
    this._bindings = Object.freeze(bindings.map((binding) => Object.freeze({ ...binding })));
    this._dirty = true;
  }

  addBinding(binding: EditorBinding): void {
    const exists = this._bindings.some((current) => (
      current.keyframeId === binding.keyframeId
      && current.assetId === binding.assetId
      && current.triggerAtMs === binding.triggerAtMs
    ));
    if (exists) return;
    this.setBindings([...this._bindings, binding]);
  }

  removeBinding(binding: EditorBinding): void {
    this.setBindings(this._bindings.filter((current) => (
      current.keyframeId !== binding.keyframeId
      || current.assetId !== binding.assetId
      || current.triggerAtMs !== binding.triggerAtMs
    )));
  }

  setNeuModules(modules: readonly NeuModule[]): void {
    this._neuModules = Object.freeze(modules.map((module) => Object.freeze({
      ...module,
      params: Object.freeze({ ...module.params }),
      inputs: Object.freeze([...module.inputs]),
      outputs: Object.freeze([...module.outputs]),
    })));
    this._dirty = true;
  }

  setEffects(effects: readonly EditorEffectInterface[]): void {
    this._effects = Object.freeze(effects.map((effect) => Object.freeze({
      ...effect,
      params: Object.freeze({ ...effect.params }),
    })));
    this._dirty = true;
  }

  setKeyframeEffects(keyframeId: string, effectInterfaceIds: readonly string[]): ChartKeyframe {
    return this.updateKeyframe(keyframeId, { effectInterfaceIds: [...new Set(effectInterfaceIds)] });
  }

  get dirty(): boolean {
    return this._dirty;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get pressed(): boolean {
    return this._drag?.phase === 'Pressed';
  }

  get dragging(): boolean {
    return this._drag?.phase === 'Dragging';
  }

  get mode(): ChartEditMode {
    return this._mode;
  }

  setMode(mode: ChartEditMode): void {
    this._mode = mode;
  }

  get durationMs(): number {
    return this.timeline.durationMs;
  }

  trackForLayer(layerIndex: number): EditorTrack | null {
    return this._tracks.find((track) => track.layerIndex === layerIndex) ?? null;
  }

  getKeyframe(keyframeId: string): {
    track: EditorTrack;
    keyframe: ChartKeyframe;
    index: number;
  } | null {
    for (const track of this._tracks) {
      const index = track.keyframes.findIndex((keyframe) => keyframe.keyframeId === keyframeId);
      if (index >= 0) {
        return { track, keyframe: track.keyframes[index], index };
      }
    }
    return null;
  }

  addKeyframe(
    input: {
      timeMs: number;
      durationMs?: number;
      chartLayerIndex: number;
      gridCellId?: number | null;
      chartKeyId?: string | null;
      chartPadKind?: ChartKeyframe['chartPadKind'];
      parallaxFactor?: number;
    },
    options: { snap?: boolean; altKey?: boolean; frameDurationMs?: number | null } = {},
  ): ChartKeyframe {
    const layerIndex = integer(input.chartLayerIndex, 1, 32, 'chartLayerIndex');
    const defaults = layerDefaults(layerIndex);
    const durationMs = input.durationMs ?? 0;
    const rawTime = integer(input.timeMs, 0, Number.MAX_SAFE_INTEGER, 'timeMs');
    const timeMs = options.snap === false
      ? rawTime
      : this.timeline.snap(rawTime, {
        altKey: options.altKey,
        frameDurationMs: options.frameDurationMs,
      });
    this.assertTime(timeMs, durationMs);
    const track = this.ensureTrack(layerIndex);
    this._counter += 1;
    const keyframe = new ChartKeyframe({
      keyframeId: `${this.documentId}-kf-${this._counter}`,
      timeMs,
      durationMs,
      chartLayerIndex: layerIndex,
      gridCellId: input.gridCellId === undefined ? defaults.gridCellId : input.gridCellId,
      chartKeyId: input.chartKeyId ?? null,
      chartPadKind: input.chartPadKind ?? defaults.padKind,
      parallaxFactor: input.parallaxFactor ?? 1,
      logo: null,
    });
    track.add(keyframe);
    const after = this.locationOf(track, keyframe);
    this.history.push({ label: 'Add keyframe', before: null, after });
    this._dirty = true;
    return keyframe;
  }

  /**
   * 批量添加关键帧；整批作为一条 Undo 记录。
   * 供 AI 预览确认使用；不做自动提交。
   */
  addKeyframes(
    inputs: readonly {
      readonly timeMs: number;
      readonly durationMs?: number;
      readonly chartLayerIndex: number;
      readonly gridCellId?: number | null;
      readonly chartKeyId?: string | null;
      readonly chartPadKind?: ChartKeyframe['chartPadKind'];
      readonly parallaxFactor?: number;
    }[],
  ): readonly ChartKeyframe[] {
    const created: ChartKeyframe[] = [];
    const after: PatchLocation[] = [];
    for (const input of inputs) {
      const layerIndex = integer(input.chartLayerIndex, 1, 32, 'chartLayerIndex');
      const defaults = layerDefaults(layerIndex);
      const durationMs = input.durationMs ?? 0;
      const rawTime = integer(input.timeMs, 0, Number.MAX_SAFE_INTEGER, 'timeMs');
      const timeMs = this.timeline.snap(rawTime, {});
      this.assertTime(timeMs, durationMs);
      const track = this.ensureTrack(layerIndex);
      this._counter += 1;
      const keyframe = new ChartKeyframe({
        keyframeId: `${this.documentId}-kf-${this._counter}`,
        timeMs,
        durationMs,
        chartLayerIndex: layerIndex,
        gridCellId: input.gridCellId === undefined ? defaults.gridCellId : input.gridCellId,
        chartKeyId: input.chartKeyId ?? null,
        chartPadKind: input.chartPadKind ?? defaults.padKind,
        parallaxFactor: input.parallaxFactor ?? 1,
        logo: null,
      });
      track.add(keyframe);
      created.push(keyframe);
      after.push(this.locationOf(track, keyframe));
    }
    if (created.length > 0) {
      this.history.pushBatch({
        kind: 'batch',
        label: 'AI keyframes',
        before: [],
        after,
      });
      this._dirty = true;
    }
    return created;
  }

  moveKeyframe(keyframeId: string, timeMs: number, layerIndex: number): ChartKeyframe {
    const found = this.getKeyframe(keyframeId);
    if (!found) throw new Error(`keyframe not found: ${keyframeId}`);
    const targetLayer = integer(layerIndex, 1, 32, 'chartLayerIndex');
    this.assertTime(timeMs, found.keyframe.durationMs);
    if (found.keyframe.timeMs === timeMs && found.keyframe.chartLayerIndex === targetLayer) {
      return found.keyframe;
    }
    let next = found.keyframe.withTime(timeMs);
    if (targetLayer !== found.keyframe.chartLayerIndex) {
      next = next.withLayer(targetLayer);
    }
    this.relocate(found.track, found.keyframe, next);
    this._dirty = true;
    return next;
  }

  updateKeyframe(
    keyframeId: string,
    patch: Partial<{
      timeMs: number;
      durationMs: number;
      chartLayerIndex: number;
      gridCellId: number | null;
      chartKeyId: string | null;
      chartPadKind: ChartKeyframe['chartPadKind'];
      parallaxFactor: number;
      effectInterfaceIds: readonly string[];
      logo: NonNullable<ChartKeyframe['logo']> | null;
    }>,
    options: { snap?: boolean; altKey?: boolean; frameDurationMs?: number | null } = {},
  ): ChartKeyframe {
    const found = this.getKeyframe(keyframeId);
    if (!found) throw new Error(`keyframe not found: ${keyframeId}`);
    const current = found.keyframe;
    const layerIndex = patch.chartLayerIndex ?? current.chartLayerIndex;
    const layerChanged = layerIndex !== current.chartLayerIndex;
    const defaults = layerDefaults(layerIndex);
    const rawTime = patch.timeMs === undefined
      ? current.timeMs
      : integer(patch.timeMs, 0, Number.MAX_SAFE_INTEGER, 'timeMs');
    const timeMs = patch.timeMs === undefined
      ? current.timeMs
      : (options.snap === false
        ? rawTime
        : this.timeline.snap(rawTime, {
          altKey: options.altKey,
          frameDurationMs: options.frameDurationMs,
        }));
    const durationMs = patch.durationMs ?? current.durationMs;
    this.assertTime(timeMs, durationMs);
    const next = new ChartKeyframe({
      keyframeId: current.keyframeId,
      timeMs,
      durationMs,
      chartLayerIndex: layerIndex,
      gridCellId: patch.gridCellId !== undefined
        ? patch.gridCellId
        : (layerChanged ? defaults.gridCellId : current.gridCellId),
      chartKeyId: patch.chartKeyId !== undefined ? patch.chartKeyId : current.chartKeyId,
      chartPadKind: patch.chartPadKind
        ?? (layerChanged ? defaults.padKind : current.chartPadKind),
      parallaxFactor: patch.parallaxFactor ?? current.parallaxFactor,
      effectInterfaceIds: patch.effectInterfaceIds ?? current.effectInterfaceIds,
      logo: patch.logo !== undefined ? patch.logo : current.logo,
    });
    if (keyframeEquals(current, next)) return current;

    if (layerChanged) {
      this.relocate(found.track, current, next);
    } else {
      found.track.replace(next);
      const before = { trackId: found.track.trackId, index: found.index, keyframe: current };
      const after = this.locationOf(found.track, next);
      this.history.push({ label: 'Update keyframe', before, after });
    }
    this._dirty = true;
    return next;
  }

  deleteKeyframe(keyframeId: string): boolean {
    const found = this.getKeyframe(keyframeId);
    if (!found) return false;
    const before = { trackId: found.track.trackId, index: found.index, keyframe: found.keyframe };
    found.track.remove(keyframeId);
    this.history.push({ label: 'Delete keyframe', before, after: null });
    if (this.selection.selectedKeyframeId === keyframeId) {
      this.selection.clear();
      this.canvas.select(null);
    }
    this._dirty = true;
    return true;
  }

  setLogo(keyframeId: string, logo: NonNullable<ChartKeyframe['logo']>): ChartKeyframe {
    return this.updateKeyframe(keyframeId, { logo });
  }

  removeLogo(keyframeId: string): ChartKeyframe {
    const found = this.getKeyframe(keyframeId);
    if (!found) throw new Error(`keyframe not found: ${keyframeId}`);
    if (found.keyframe.logo === null) return found.keyframe;
    return this.updateKeyframe(keyframeId, { logo: null });
  }

  setSeed(seed: number): void {
    const next = seedValue(seed);
    if (next === this._seed) return;
    this._seed = next;
    this._dirty = true;
  }

  select(keyframeId: string): void {
    const found = this.getKeyframe(keyframeId);
    if (!found) throw new Error(`keyframe not found: ${keyframeId}`);
    this.selection.select(keyframeId, found.track.trackId);
    this.canvas.select(keyframeId);
    if (found.keyframe.logo) {
      this.canvas.setLogoPosition(found.keyframe.logo.x, found.keyframe.logo.y);
    }
  }

  clearSelection(): void {
    this.selection.clear();
    this.canvas.select(null);
  }

  inspector(): EditorInspector {
    const selected = this.selection.selectedKeyframeId;
    return EditorInspector.fromKeyframe(selected ? this.getKeyframe(selected)?.keyframe ?? null : null);
  }

  beginKeyframeDrag(keyframeId: string, pointer: { x: number; y: number }): void {
    if (this._drag) this.cancelKeyframeDrag();
    const found = this.getKeyframe(keyframeId);
    if (!found) throw new Error(`keyframe not found: ${keyframeId}`);
    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
      throw new RangeError('pointer must be finite');
    }
    this._drag = {
      keyframeId,
      startX: pointer.x,
      startY: pointer.y,
      startPlayheadMs: this.timeline.playheadMs,
      original: found.keyframe,
      phase: 'Pressed',
      preview: found.keyframe,
      changed: false,
    };
    this.timeline.lockViewport();
  }

  updateKeyframeDrag(
    pointer: { x: number; y: number },
    options: {
      altKey?: boolean;
      shiftKey?: boolean;
      targetLayerIndex?: number | null;
      frameDurationMs?: number | null;
      snapTargetMs?: number;
    } = {},
  ): { timeMs: number; layerIndex: number; changed: boolean } | null {
    if (!this._drag) return null;
    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
      throw new RangeError('pointer must be finite');
    }
    const dx = pointer.x - this._drag.startX;
    const dy = pointer.y - this._drag.startY;
    if (Math.hypot(dx, dy) <= 3) {
      this._drag.phase = 'Pressed';
      this._drag.preview = this._drag.original;
      this._drag.changed = false;
      this.timeline.setPlayhead(this._drag.original.timeMs);
      return {
        timeMs: this._drag.original.timeMs,
        layerIndex: this._drag.original.chartLayerIndex,
        changed: false,
      };
    }

    const maxTime = Math.max(0, this.timeline.durationMs - this._drag.original.durationMs);
    const rawTime = options.shiftKey
      ? this._drag.original.timeMs
      : (options.snapTargetMs ?? this.timeline.timeAtX(pointer.x));
    const timeMs = Math.min(
      maxTime,
      Math.max(0, this.timeline.snap(rawTime, {
        altKey: options.altKey,
        frameDurationMs: options.frameDurationMs,
      })),
    );
    let layerIndex = this._drag.original.chartLayerIndex;
    if (options.targetLayerIndex !== undefined && options.targetLayerIndex !== null
      && Math.abs(dy) > 24 && options.targetLayerIndex >= 1 && options.targetLayerIndex <= 32) {
      layerIndex = options.targetLayerIndex;
    }
    let preview = this._drag.original.withTime(timeMs);
    if (layerIndex !== this._drag.original.chartLayerIndex) {
      preview = preview.withLayer(layerIndex);
    }
    const changed = timeMs !== this._drag.original.timeMs
      || layerIndex !== this._drag.original.chartLayerIndex;
    this._drag.phase = 'Dragging';
    this._drag.preview = preview;
    this._drag.changed = changed;
    this.timeline.setPlayhead(timeMs);
    return { timeMs, layerIndex, changed };
  }

  commitKeyframeDrag(): ChartKeyframe | null {
    if (!this._drag) return null;
    const drag = this._drag;
    this._drag = null;
    this.timeline.unlockViewport();
    if (!drag.changed) return drag.original;
    return this.moveKeyframe(
      drag.keyframeId,
      drag.preview.timeMs,
      drag.preview.chartLayerIndex,
    );
  }

  cancelKeyframeDrag(): void {
    if (this._drag) {
      this.timeline.setPlayhead(this._drag.startPlayheadMs);
    }
    this._drag = null;
    this.timeline.unlockViewport();
  }

  /** R5c-A.4：多选组拖拽；只改时间，不改层。 */
  beginKeyframeGroupDrag(keyframeIds: readonly string[], pointer: { x: number; y: number }): void {
    if (this._drag) this.cancelKeyframeDrag();
    if (this._groupDrag) this.cancelKeyframeGroupDrag();
    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
      throw new RangeError('pointer must be finite');
    }
    const ids = [...new Set(keyframeIds)];
    if (ids.length === 0) throw new RangeError('group drag requires at least one keyframe');
    const items: GroupDragItem[] = [];
    for (const keyframeId of ids) {
      const found = this.getKeyframe(keyframeId);
      if (!found) throw new Error(`keyframe not found: ${keyframeId}`);
      items.push({
        keyframeId,
        trackId: found.track.trackId,
        original: found.keyframe,
      });
    }
    this._groupDrag = {
      startX: pointer.x,
      startY: pointer.y,
      startPlayheadMs: this.timeline.playheadMs,
      items,
      previews: new Map(items.map((item) => [item.keyframeId, item.original])),
      changed: false,
    };
    this.timeline.lockViewport();
  }

  updateKeyframeGroupDrag(
    pointer: { x: number; y: number },
    options: { altKey?: boolean; frameDurationMs?: number | null; snapTargetMs?: number } = {},
  ): {
    changed: boolean;
    primaryTimeMs: number;
    previews: ReadonlyMap<string, ChartKeyframe>;
  } | null {
    const drag = this._groupDrag;
    if (!drag) return null;
    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
      throw new RangeError('pointer must be finite');
    }
    if (Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) <= 3) {
      drag.previews = new Map(drag.items.map((item) => [item.keyframeId, item.original]));
      drag.changed = false;
      return {
        changed: false,
        primaryTimeMs: drag.items[0]?.original.timeMs ?? 0,
        previews: drag.previews,
      };
    }
    const primary = drag.items[0];
    if (!primary) return null;
    const target = this.timeline.snap(
      options.snapTargetMs ?? this.timeline.timeAtX(pointer.x),
      {
        altKey: options.altKey,
        frameDurationMs: options.frameDurationMs,
      },
    );
    const delta = target - primary.original.timeMs;
    const previews = new Map<string, ChartKeyframe>();
    let changed = false;
    for (const item of drag.items) {
      const maxTime = Math.max(0, this.timeline.durationMs - item.original.durationMs);
      const raw = Math.min(maxTime, Math.max(0, item.original.timeMs + delta));
      const timeMs = this.timeline.snap(raw, {
        altKey: options.altKey,
        frameDurationMs: options.frameDurationMs,
      });
      const preview = item.original.withTime(timeMs);
      previews.set(item.keyframeId, preview);
      if (timeMs !== item.original.timeMs) changed = true;
    }
    drag.previews = previews;
    drag.changed = changed;
    const primaryPreview = previews.get(primary.keyframeId) ?? primary.original;
    this.timeline.setPlayhead(primaryPreview.timeMs);
    return { changed, primaryTimeMs: primaryPreview.timeMs, previews };
  }

  commitKeyframeGroupDrag(): readonly ChartKeyframe[] {
    const drag = this._groupDrag;
    if (!drag) return [];
    this._groupDrag = null;
    this.timeline.unlockViewport();
    if (!drag.changed) return drag.items.map((item) => item.original);
    const before: PatchLocation[] = [];
    const nextFrames: ChartKeyframe[] = [];
    for (const item of drag.items) {
      const found = this.getKeyframe(item.keyframeId);
      if (!found) continue;
      const preview = drag.previews.get(item.keyframeId);
      if (!preview) continue;
      before.push(this.locationOf(found.track, found.keyframe));
      nextFrames.push(preview);
    }
    for (const item of drag.items) {
      const found = this.getKeyframe(item.keyframeId);
      if (found) found.track.remove(item.keyframeId);
    }
    const after: PatchLocation[] = [];
    for (const preview of nextFrames) {
      const track = this.ensureTrack(preview.chartLayerIndex);
      track.add(preview);
      after.push(this.locationOf(track, preview));
    }
    if (before.length > 0) {
      this.history.pushBatch({
        kind: 'batch',
        label: 'Move keyframes',
        before,
        after,
      });
      this._dirty = true;
    }
    return nextFrames;
  }

  cancelKeyframeGroupDrag(): void {
    if (this._groupDrag) {
      this.timeline.setPlayhead(this._groupDrag.startPlayheadMs);
    }
    this._groupDrag = null;
    this.timeline.unlockViewport();
  }

  undo(): boolean {
    const patch = this.history.undo();
    if (!patch) return false;
    this.applyPatch(patch, 'undo');
    this._dirty = true;
    return true;
  }

  redo(): boolean {
    const patch = this.history.redo();
    if (!patch) return false;
    this.applyPatch(patch, 'redo');
    this._dirty = true;
    return true;
  }

  markSaved(): void {
    this._dirty = false;
  }

  /** 语义别名；返回 editor.json 纯对象，不落盘。 */
  save(): unknown {
    return this.toJson();
  }

  toJson(): unknown {
    return {
      schemaVersion: 2,
      documentId: this.documentId,
      chartId: this.chartId,
      provenance: this.provenance,
      seed: this._seed,
      durationMs: this.timeline.durationMs,
      tracks: this._tracks.map((track) => ({
        trackId: track.trackId,
        layerIndex: track.layerIndex,
        keyframes: track.keyframes.map(keyframeJson),
      })),
      canvas: {
        stageWidth: this.canvas.stageWidth,
        stageHeight: this.canvas.stageHeight,
      },
      bindings: this._bindings,
      neuModules: this._neuModules,
      effects: this._effects,
      ai: aiSettingsJson(this._ai),
      ...(Object.keys(this._layerAudio).length === 0
        ? {}
        : { layerAudio: layerAudioJson(this._layerAudio) }),
    };
  }

  /** 语义别名；与 exportV2 同值。 */
  exportChartSource(): ChartSourceData {
    return this.exportV2();
  }

  exportV2(): ChartSourceData {
    const layers = this._tracks.map((track) => {
      if (track.layerIndex === 1) return { index: 1, kind: 'TopMost' as const };
      if (track.layerIndex === 2) return { index: 2, kind: 'Grid' as const };
      return {
        index: track.layerIndex,
        kind: 'FullScreen' as const,
        fullScreenInput: 'Pointer' as const,
      };
    });
    const notes = this.allKeyframes().map((keyframe) => ({
      timeMs: keyframe.timeMs,
      durationMs: keyframe.durationMs,
      chartLayerIndex: keyframe.chartLayerIndex,
      ...(keyframe.gridCellId === null ? {} : { gridCellId: keyframe.gridCellId }),
      ...(keyframe.chartKeyId === null ? {} : { chartKeyId: keyframe.chartKeyId }),
      chartPadKind: keyframe.chartPadKind,
    }));
    return parseChartSourceData({
      schemaVersion: 2,
      chartId: this.chartId,
      provenance: this.provenance,
      layers,
      notes,
    });
  }

  private ensureBaseTracks(): void {
    if (this._tracks.length === 0) {
      this._tracks.push(new EditorTrack('layer-1', 1));
      this._tracks.push(new EditorTrack('layer-2', 2));
      return;
    }
    this.ensureTrack(1);
    for (const track of this._tracks) {
      this.ensureTrack(track.layerIndex);
    }
  }

  private ensureTrack(layerIndex: number): EditorTrack {
    for (let index = 1; index <= layerIndex; index += 1) {
      if (!this._tracks.some((track) => track.layerIndex === index)) {
        this._tracks.push(new EditorTrack(`layer-${index}`, index));
      }
    }
    this._tracks.sort((left, right) => left.layerIndex - right.layerIndex);
    return this._tracks.find((track) => track.layerIndex === layerIndex) as EditorTrack;
  }

  private allKeyframes(): ChartKeyframe[] {
    return this._tracks
      .flatMap((track) => track.keyframes)
      .sort(ChartKeyframe.compare);
  }

  private scanCounter(): number {
    const prefix = `${this.documentId}-kf-`;
    let max = 0;
    for (const keyframe of this.allKeyframes()) {
      if (!keyframe.keyframeId.startsWith(prefix)) continue;
      const suffix = keyframe.keyframeId.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      max = Math.max(max, Number(suffix));
    }
    return max;
  }

  private assertTime(timeMs: number, durationMs: number): void {
    if (!Number.isSafeInteger(timeMs) || timeMs < 0) {
      throw new RangeError('keyframe timeMs must be a non-negative integer');
    }
    if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
      throw new RangeError('keyframe durationMs must be a non-negative integer');
    }
    if (timeMs + durationMs > this.timeline.durationMs) {
      throw new RangeError('keyframe exceeds the editor duration');
    }
  }

  private locationOf(track: EditorTrack, keyframe: ChartKeyframe): PatchLocation {
    const index = track.keyframes.findIndex(
      (current) => current.keyframeId === keyframe.keyframeId,
    );
    if (index < 0) throw new Error('keyframe is not on the track');
    return { trackId: track.trackId, index, keyframe };
  }

  private relocate(
    sourceTrack: EditorTrack,
    before: ChartKeyframe,
    after: ChartKeyframe,
  ): void {
    const beforeLocation = this.locationOf(sourceTrack, before);
    sourceTrack.remove(before.keyframeId);
    const targetTrack = this.ensureTrack(after.chartLayerIndex);
    targetTrack.add(after);
    const afterLocation = this.locationOf(targetTrack, after);
    this.history.push({
      label: 'Move keyframe',
      before: beforeLocation,
      after: afterLocation,
    });
  }

  private applyPatch(
    patch: NonNullable<ReturnType<ChartEditUndo['undo']>>,
    direction: 'undo' | 'redo',
  ): void {
    if ('kind' in patch && patch.kind === 'batch') {
      const remove = direction === 'undo' ? patch.after : patch.before;
      const insert = direction === 'undo' ? patch.before : patch.after;
      for (const location of remove) this.removeLocation(location);
      for (const location of insert) this.insertLocation(location);
    } else {
      const single = patch as {
        readonly before: PatchLocation | null;
        readonly after: PatchLocation | null;
      };
      const remove = direction === 'undo' ? single.after : single.before;
      const insert = direction === 'undo' ? single.before : single.after;
      if (remove) this.removeLocation(remove);
      if (insert) this.insertLocation(insert);
    }
    const selected = this.selection.selectedKeyframeId;
    if (selected && !this.getKeyframe(selected)) this.clearSelection();
    else if (selected) this.select(selected);
  }

  private removeLocation(location: PatchLocation): void {
    const track = this._tracks.find((candidate) => candidate.trackId === location.trackId)
      ?? this._tracks.find((candidate) => candidate.find(location.keyframe.keyframeId));
    if (!track) return;
    track.remove(location.keyframe.keyframeId);
  }

  private insertLocation(location: PatchLocation): void {
    const track = this._tracks.find((candidate) => candidate.trackId === location.trackId)
      ?? this.ensureTrack(location.keyframe.chartLayerIndex);
    if (track.find(location.keyframe.keyframeId)) return;
    const index = Math.min(location.index, track.keyframes.length);
    track.insert(index, location.keyframe);
  }
}

function layerDefaults(layerIndex: number): {
  gridCellId: number | null;
  padKind: ChartKeyframe['chartPadKind'];
} {
  if (layerIndex === 1) return { gridCellId: null, padKind: 'TopMost' };
  if (layerIndex === 2) return { gridCellId: 1, padKind: 'Light' };
  return { gridCellId: null, padKind: 'Light' };
}
