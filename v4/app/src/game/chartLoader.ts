import { convertFileSrc } from '@tauri-apps/api/core';
import { TauriMediaImporter } from '@adapters/tauri/TauriMediaImporter';
import { TauriProjectIo } from '@adapters/tauri/TauriProjectIo';
import { parseChartSourceData } from '@core/editor/ChartSourceData';
import type { ChartSourceData } from '@core/editor/ChartSourceData';
import { EditorWorldFile } from '@core/editor/EditorWorldFile';
import { FullScreenJudgementLayer } from '@core/chart/layer';
import type { ChartLayer } from '@core/chart/layer';
import { GridNote, HoldGridLine } from '@core/chart/note';
import { ChartPadKind } from '@core/chart/types';
import type { GridCellId } from '@core/chart/types';
import type {
  EditorBinding,
  EditorEffectInterface,
  NeuModule,
} from '@core/editor/runtime/types';
import {
  EMPTY_GAME_NEU_CHART,
  neuChartFromEditor,
  neuChartHudWarning,
} from './neuChart';
import {
  parseTracesSidecar,
  parseTriggersSidecar,
} from './stageData';
import type {
  GameTracePlacement,
  GameTriggerDefinition,
} from './stageData';

export interface GameMedia {
  readonly pairId: string;
  readonly background: string;
  readonly foreground: string;
  readonly audio: string;
  readonly leftRelPath: string;
  readonly rightRelPath: string;
  /** manifest 的 activePairId；null 表示旧 manifest 按“最后一个 pair”兼容。 */
  readonly requestedPairId: string | null;
  /** active pair 不可用时使用了回退 pair；HUD 会显示 MEDIA FALLBACK。 */
  readonly fallback: boolean;
  /** manifest 内所有 Audio asset；Layer Audio / NEU 音效共用。 */
  readonly audioAssets: ReadonlyMap<string, string>;
}

export interface LoadedGameChart {
  readonly chartId: string;
  readonly durationMs: number;
  readonly layers: readonly ChartLayer[];
  readonly notes: readonly GridNote[];
  readonly media: GameMedia | null;
  /** editor.json 的 NEU 蓝图；缺失/解析失败时为空数组。 */
  readonly neuModules: readonly NeuModule[];
  readonly neuEffects: readonly EditorEffectInterface[];
  readonly neuBindings: readonly EditorBinding[];
  /** 仅作遥测；Live 模式的随机源不读取它。 */
  readonly editorSeed: number;
  /** R4c 可选 sidecar；缺失/解析失败时为空数组。 */
  readonly traces: readonly GameTracePlacement[];
  readonly triggers: readonly GameTriggerDefinition[];
  readonly r4cWarnings: readonly string[];
  readonly source: 'editor' | 'v2' | 'fallback';
  /** editor.json 的每层音频绑定；null 不进入 map。 */
  readonly layerAudio: ReadonlyMap<number, string>;
  /** manifest Audio assets（assetId → URL），供 Layer Audio 播放。 */
  readonly audioAssets: ReadonlyMap<string, string>;
  readonly warnings: readonly string[];
  dispose(): void;
}

interface ManifestAsset {
  readonly assetId?: unknown;
  readonly relPath?: unknown;
  readonly kind?: unknown;
  readonly durationMs?: unknown;
}

interface ManifestPair {
  readonly stereoPairId?: unknown;
  readonly leftAssetId?: unknown;
  readonly rightAssetId?: unknown;
  readonly audioAssetId?: unknown;
}

interface HoldCrossing {
  readonly noteTimeMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId: number | null;
  readonly atMs: number;
  readonly requiredGridCellId: number | null;
  readonly requiredChartKeyId: string | null;
}

function pathJoin(root: string, relPath: string): string {
  const base = root.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${relPath.replace(/\//g, separator)}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function padKindOf(value: string): ChartPadKind {
  if (value === 'TopMost') return ChartPadKind.TopMost;
  if (value === 'Heavy') return ChartPadKind.Heavy;
  return ChartPadKind.Light;
}

function fullScreenOf(value: string | undefined): FullScreenJudgementLayer | undefined {
  if (value === 'Space') return FullScreenJudgementLayer.Space;
  if (value === 'Pointer') return FullScreenJudgementLayer.Pointer;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCrossings(raw: unknown): HoldCrossing[] {
  if (!isRecord(raw) || !Array.isArray(raw.crossings)) return [];
  const result: HoldCrossing[] = [];
  for (const item of raw.crossings) {
    if (!isRecord(item)) continue;
    const noteTimeMs = Number(item.noteTimeMs);
    const chartLayerIndex = Number(item.chartLayerIndex);
    const atMs = Number(item.atMs);
    if (!Number.isFinite(noteTimeMs) || !Number.isSafeInteger(chartLayerIndex) || !Number.isFinite(atMs)) {
      continue;
    }
    const gridCellId = item.gridCellId === undefined || item.gridCellId === null
      ? null
      : Number(item.gridCellId);
    const requiredGridCellId = item.requiredGridCellId === undefined || item.requiredGridCellId === null
      ? null
      : Number(item.requiredGridCellId);
    const requiredChartKeyId = typeof item.requiredChartKeyId === 'string'
      && item.requiredChartKeyId.length > 0
      ? item.requiredChartKeyId
      : null;
    if (gridCellId !== null && (!Number.isSafeInteger(gridCellId) || gridCellId < 1 || gridCellId > 8)) {
      continue;
    }
    if (requiredGridCellId !== null
      && (!Number.isSafeInteger(requiredGridCellId) || requiredGridCellId < 1 || requiredGridCellId > 8)) {
      continue;
    }
    result.push({
      noteTimeMs,
      chartLayerIndex,
      gridCellId,
      atMs,
      requiredGridCellId,
      requiredChartKeyId,
    });
  }
  return result;
}

function holdLinesFor(
  note: {
    readonly timeMs: number;
    readonly durationMs: number;
    readonly chartLayerIndex: number;
    readonly gridCellId: number | null;
  },
  crossings: readonly HoldCrossing[],
): readonly HoldGridLine[] {
  if (note.durationMs <= 0) return [];
  const lines: HoldGridLine[] = [];
  for (const crossing of crossings) {
    if (crossing.chartLayerIndex !== note.chartLayerIndex) continue;
    if (crossing.noteTimeMs !== note.timeMs) continue;
    if (crossing.gridCellId !== null && crossing.gridCellId !== note.gridCellId) continue;
    if (crossing.atMs <= note.timeMs || crossing.atMs >= note.timeMs + note.durationMs) continue;
    try {
      lines.push(new HoldGridLine({
        atMs: crossing.atMs,
        requiredGridCellId: (crossing.requiredGridCellId
          ?? (note.chartLayerIndex === 2 ? note.gridCellId : null)) as GridCellId | null,
        requiredChartKeyId: crossing.requiredChartKeyId
          ?? (note.chartLayerIndex === 1 ? 'Space' : null),
      }));
    } catch {
      // 单条非法越界不拖垮整张谱面；最终由 R4a-changes 记录诊断。
    }
  }
  return lines;
}

function buildNotes(
  chart: ChartSourceData,
  crossings: readonly HoldCrossing[],
): GridNote[] {
  return chart.notes.map((source, index) => {
    const gridCellId = source.gridCellId === undefined ? null : source.gridCellId;
    const chartKeyId = source.chartKeyId === undefined ? null : source.chartKeyId;
    return new GridNote({
      noteIndex: index,
      timeMs: source.timeMs,
      durationMs: source.durationMs,
      chartLayerIndex: source.chartLayerIndex,
      gridCellId,
      chartKeyId,
      chartPadKind: padKindOf(source.chartPadKind),
      holdGridLines: holdLinesFor({
        timeMs: source.timeMs,
        durationMs: source.durationMs,
        chartLayerIndex: source.chartLayerIndex,
        gridCellId,
      }, crossings),
    });
  });
}

function layersOf(chart: ChartSourceData): ChartLayer[] {
  return chart.layers.map((layer) => {
    if (layer.kind === 'TopMost') return { index: layer.index, kind: 'TopMost' };
    if (layer.kind === 'Grid') return { index: layer.index, kind: 'Grid' };
    const fullScreenInput = fullScreenOf(layer.fullScreenInput);
    return {
      index: layer.index,
      kind: 'FullScreen',
      ...(fullScreenInput === undefined ? {} : { fullScreenInput }),
    };
  });
}

function fallbackChart(worldId: string, warning: string): LoadedGameChart {
  const notes = [
    new GridNote({ noteIndex: 0, timeMs: 0, durationMs: 240, chartLayerIndex: 1, chartPadKind: ChartPadKind.TopMost }),
    new GridNote({ noteIndex: 1, timeMs: 1600, durationMs: 0, chartLayerIndex: 2, gridCellId: 2, chartPadKind: ChartPadKind.Light }),
    new GridNote({ noteIndex: 2, timeMs: 4167, durationMs: 360, chartLayerIndex: 1, chartPadKind: ChartPadKind.TopMost }),
    new GridNote({ noteIndex: 3, timeMs: 4400, durationMs: 0, chartLayerIndex: 3, chartPadKind: ChartPadKind.Light }),
    new GridNote({
      noteIndex: 4,
      timeMs: 5800,
      durationMs: 300,
      chartLayerIndex: 2,
      gridCellId: 5,
      chartPadKind: ChartPadKind.Light,
      holdGridLines: [],
    }),
    new GridNote({ noteIndex: 5, timeMs: 7200, durationMs: 0, chartLayerIndex: 1, chartPadKind: ChartPadKind.TopMost }),
  ];
  return {
    chartId: `fallback-${worldId}`,
    durationMs: 8000,
    layers: [
      { index: 1, kind: 'TopMost' },
      { index: 2, kind: 'Grid' },
      { index: 3, kind: 'FullScreen', fullScreenInput: FullScreenJudgementLayer.Pointer },
    ],
    notes,
    media: null,
    ...EMPTY_GAME_NEU_CHART,
    traces: [],
    triggers: [],
    r4cWarnings: [],
    source: 'fallback',
    layerAudio: new Map<number, string>(),
    audioAssets: new Map<string, string>(),
    warnings: [warning, '无 NEU 图'],
    dispose() {
      // no object URLs in fallback
    },
  };
}

async function loadMedia(
  io: TauriProjectIo,
  importer: TauriMediaImporter,
  warnings: string[],
  projectRoot: string,
): Promise<GameMedia | null> {
  try {
    const raw = await io.readProjectFile('media/manifest.json');
    if (!isRecord(raw) || !Array.isArray(raw.stereoPairs) || !Array.isArray(raw.assets)) {
      warnings.push('media/manifest.json 缺少 stereoPairs/assets');
      return null;
    }
    const pairs = raw.stereoPairs.filter(
      (item): item is ManifestPair => isRecord(item),
    );
    if (pairs.length === 0) {
      warnings.push('media/manifest.json 没有 stereoPair');
      return null;
    }
    const requestedPairId = typeof raw.activePairId === 'string' && raw.activePairId.length > 0
      ? raw.activePairId
      : null;
    const requestedPair = requestedPairId
      ? pairs.find((item) => item.stereoPairId === requestedPairId)
      : null;
    if (requestedPairId && !requestedPair) {
      warnings.push(`MEDIA FALLBACK / activePairId ${requestedPairId} 不存在`);
    }
    // active pair 优先；其余按 manifest 倒序（最新优先）回退。
    const fallbackPairs = [...pairs].reverse().filter((item) => item !== requestedPair);
    const candidates = requestedPair ? [requestedPair, ...fallbackPairs] : fallbackPairs;
    const assets = raw.assets.filter((item): item is ManifestAsset => isRecord(item));
    const audioAssets = new Map<string, string>();
    for (const asset of assets) {
      if (asset.kind !== 'Audio') continue;
      if (typeof asset.assetId !== 'string' || typeof asset.relPath !== 'string') continue;
      audioAssets.set(asset.assetId, convertFileSrc(pathJoin(projectRoot, asset.relPath)));
    }
    const assetOf = (assetId: unknown): ManifestAsset | undefined => (
      assets.find((asset) => asset.assetId === assetId)
    );

    for (const pair of candidates) {
      const left = assetOf(pair.leftAssetId);
      const right = assetOf(pair.rightAssetId);
      const audio = assetOf(pair.audioAssetId);
      if (!left || !right || !audio
        || typeof left.relPath !== 'string'
        || typeof right.relPath !== 'string'
        || typeof audio.relPath !== 'string') {
        warnings.push('stereoPair 引用的资源不完整');
        continue;
      }
      try {
        const [leftBytes, rightBytes] = await Promise.all([
          importer.readMediaFile(left.relPath),
          importer.readMediaFile(right.relPath),
        ]);
        const background = URL.createObjectURL(
          new Blob([toArrayBuffer(leftBytes)], { type: 'video/mp4' }),
        );
        const foreground = URL.createObjectURL(
          new Blob([toArrayBuffer(rightBytes)], { type: 'video/mp4' }),
        );
        const pairId = typeof pair.stereoPairId === 'string' ? pair.stereoPairId : 'manifest-pair';
        const fallback = requestedPairId !== null && pairId !== requestedPairId;
        if (fallback) {
          warnings.push(`MEDIA FALLBACK / ${requestedPairId} → ${pairId}`);
        }
        return {
          pairId,
          background,
          foreground,
          audio: convertFileSrc(pathJoin(projectRoot, audio.relPath)),
          leftRelPath: left.relPath,
          rightRelPath: right.relPath,
          requestedPairId,
          fallback,
          audioAssets,
        };
      } catch {
        warnings.push(`media pair ${String(pair.stereoPairId)} 文件不可读，尝试回退`);
      }
    }
    warnings.push('media/stereoPair 无可用资源');
    return null;
  } catch (error) {
    warnings.push(`媒体加载失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 读取当前 demo 项目的谱面/媒体。
 * 优先 editor.json（拿 logo 与 v2），纯 v2 文件存在时以 v2 为判定权威。
 * 任何失败都回退到内置 chart-w1 fixture，保证视觉层可独立验收。
 */
export async function loadGameChart(
  worldId: string,
  projectRoot: string,
): Promise<LoadedGameChart> {
  const warnings: string[] = [];
  const io = new TauriProjectIo();
  const importer = new TauriMediaImporter();
  try {
    await io.openProjectRoot(projectRoot);
    const editorPath = `charts/chart-${worldId}.editor.json`;
    const v2Path = `charts/chart-${worldId}.json`;
    const holdsPath = `charts/chart-${worldId}.holds.json`;
    const tracesPath = `charts/chart-${worldId}.traces.json`;
    const triggersPath = `charts/chart-${worldId}.triggers.json`;
    const sidecarReadWarnings: string[] = [];

    const [editorRaw, v2Raw, holdsRaw, tracesRaw, triggersRaw] = await Promise.all([
      io.readProjectFile(editorPath),
      io.readProjectFile(v2Path),
      io.readProjectFile(holdsPath),
      io.readProjectFile(tracesPath).catch((error) => {
        sidecarReadWarnings.push(
          `traces.json 读取失败：${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }),
      io.readProjectFile(triggersPath).catch((error) => {
        sidecarReadWarnings.push(
          `triggers.json 读取失败：${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }),
    ]);

    let editor: EditorWorldFile | null = null;
    if (editorRaw) {
      try {
        editor = EditorWorldFile.fromJson(editorRaw);
      } catch (error) {
        warnings.push(`editor.json 解析失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // NEU 扩展点与 R4a 的 notes/media 解析相互独立；失败只降级为空图。
    const neu = neuChartFromEditor(editor);
    const neuWarning = neuChartHudWarning(neu);
    if (neuWarning) warnings.push(neuWarning);

    let chart: ChartSourceData;
    let source: 'editor' | 'v2' = 'editor';
    if (v2Raw) {
      chart = parseChartSourceData(v2Raw);
      source = 'v2';
    } else if (editor) {
      chart = editor.exportV2();
    } else {
      return fallbackChart(worldId, '未找到 editor.json 或 v2 谱面，使用内置 fixture');
    }

    // R4c sidecar 与 R4a 判定权威解耦：解析失败只空数组 + warning。
    const r4cWarnings: string[] = [...sidecarReadWarnings];
    let traces: readonly GameTracePlacement[] = [];
    let triggers: readonly GameTriggerDefinition[] = [];
    if (tracesRaw) {
      const parsed = parseTracesSidecar(tracesRaw, chart.chartId);
      traces = parsed.items;
      r4cWarnings.push(...parsed.warnings);
    }
    if (triggersRaw) {
      const parsed = parseTriggersSidecar(triggersRaw, chart.chartId);
      triggers = parsed.items;
      r4cWarnings.push(...parsed.warnings);
    }

    const crossings = readCrossings(holdsRaw);
    const notes = buildNotes(chart, crossings);
    const layers = layersOf(chart);
    const maxNoteEnd = notes.reduce(
      (max, note) => Math.max(max, note.timeMs + note.durationMs),
      0,
    );
    const durationMs = Math.max(
      1,
      editor?.durationMs ?? 0,
      maxNoteEnd,
    );
    const media = await loadMedia(io, importer, warnings, projectRoot);
    const layerAudio = new Map<number, string>();
    if (editor) {
      for (const [key, value] of Object.entries(editor.layerAudio)) {
        if (typeof value !== 'string') continue;
        const layerIndex = Number(key);
        if (!Number.isSafeInteger(layerIndex) || layerIndex < 1 || layerIndex > 32) continue;
        if (value === 'asset:audio:main') {
          warnings.push(`layerAudio L${layerIndex} 不能绑定 BGM，已忽略`);
          continue;
        }
        if (media && !media.audioAssets.has(value)) {
          warnings.push(`layerAudio L${layerIndex} 找不到音频 ${value}，已忽略`);
          continue;
        }
        layerAudio.set(layerIndex, value);
      }
    }

    if (editor && source === 'v2') {
      try {
        if (editor.exportV2().notes.length !== chart.notes.length) {
          warnings.push('editor.json 与 v2 note 数不一致；判定以 v2 为准');
        }
      } catch (error) {
        warnings.push(`editor.json 无法导出 v2：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      chartId: chart.chartId,
      durationMs,
      layers,
      notes,
      media,
      ...neu,
      traces,
      triggers,
      r4cWarnings,
      source,
      layerAudio,
      audioAssets: media?.audioAssets ?? new Map<string, string>(),
      warnings,
      dispose() {
        if (!media) return;
        URL.revokeObjectURL(media.background);
        URL.revokeObjectURL(media.foreground);
      },
    };
  } catch (error) {
    return fallbackChart(
      worldId,
      `谱面/项目加载失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** 测试/离线预览用：直接拿内置 fixture。 */
export function loadFallbackChart(worldId: string): LoadedGameChart {
  return fallbackChart(worldId, '离线 fixture');
}
