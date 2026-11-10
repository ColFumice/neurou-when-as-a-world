/**
 * R5a.3 · Editor Beats panel 的纯状态/数据模型（无 React / DOM）。
 * UI 只负责按钮、解码和 Tauri 调用；这里负责可测试的判定与 sidecar 生成。
 */
import type { BeatAnalysisResult } from '../audio/beatAnalyzer';
import type {
  BeatsSidecar,
  BeatsSidecarSource,
} from '../audio/beatsSidecar';

export type BeatsPanelStatus =
  | 'Idle'
  | 'Analyzing'
  | 'Ready'
  | 'LowConfidence'
  | 'Failed';

export interface BeatAudioAsset {
  readonly assetId: string;
  readonly relPath: string;
  readonly sha256: string;
  readonly durationMs: number;
}

export interface BeatsPanelView {
  readonly status: BeatsPanelStatus;
  readonly bpm: number | null;
  readonly meter: 4 | null;
  readonly confidence: number | null;
  readonly source: BeatsSidecarSource | null;
  readonly reason: string | null;
  readonly taps: number;
}

const EMPTY_VIEW: BeatsPanelView = {
  status: 'Idle',
  bpm: null,
  meter: null,
  confidence: null,
  source: null,
  reason: null,
  taps: 0,
};

export function idleView(): BeatsPanelView {
  return { ...EMPTY_VIEW };
}

export function viewFromSidecar(sidecar: BeatsSidecar | null): BeatsPanelView {
  if (!sidecar) return idleView();
  return {
    status: 'Ready',
    bpm: sidecar.bpm,
    meter: sidecar.meter,
    confidence: sidecar.confidence,
    source: sidecar.source,
    reason: null,
    taps: 0,
  };
}

export function failedView(reason: string, taps = 0): BeatsPanelView {
  return {
    ...EMPTY_VIEW,
    status: 'Failed',
    reason,
    taps,
  };
}

export function analyzingView(taps = 0): BeatsPanelView {
  return { ...EMPTY_VIEW, status: 'Analyzing', taps };
}

export function lowConfidenceView(
  reason: string,
  confidence: number | null = null,
): BeatsPanelView {
  return {
    ...EMPTY_VIEW,
    status: 'LowConfidence',
    reason,
    confidence,
  };
}

export function generatedAt(now: Date): string {
  return now.toISOString();
}

export function detectedSidecar(
  chartId: string,
  asset: BeatAudioAsset,
  result: BeatAnalysisResult,
  timestamp: string,
): BeatsSidecar | null {
  if (!result.ok || result.bpm === undefined || result.offsetMs === undefined
    || result.beatsMs === undefined || result.downbeatsMs === undefined
    || result.confidence === undefined) {
    return null;
  }
  return {
    schemaVersion: 1,
    chartId,
    audioAssetId: asset.assetId,
    audioSha256: asset.sha256,
    analyzer: 'offline-onset-autocorrelation-v1',
    bpm: result.bpm,
    meter: 4,
    offsetMs: result.offsetMs,
    beatsMs: [...result.beatsMs],
    downbeatsMs: [...result.downbeatsMs],
    confidence: result.confidence,
    source: 'Detected',
    generatedAt: timestamp,
  };
}

export function manualBpm(tapsMs: readonly number[]): number | null {
  if (tapsMs.length < 3) return null;
  const intervals: number[] = [];
  for (let index = 1; index < tapsMs.length; index += 1) {
    const interval = tapsMs[index] - tapsMs[index - 1];
    if (Number.isFinite(interval) && interval > 200 && interval < 1500) {
      intervals.push(interval);
    }
  }
  if (intervals.length < 2) return null;
  const total = intervals.reduce((sum, interval) => sum + interval, 0);
  const bpm = 60000 / (total / intervals.length);
  if (!Number.isFinite(bpm) || bpm < 60 || bpm > 200) return null;
  return Math.round(bpm * 100) / 100;
}

export interface BeatGrid {
  readonly bpm: number;
  readonly offsetMs: number;
  readonly beatsMs: readonly number[];
  readonly downbeatsMs: readonly number[];
}

export interface ManualSidecarOptions {
  readonly bpm?: number | null;
  readonly offsetMs?: number;
}

/** 以 BPM/offset/duration 生成节拍网格；offset 归一化到 [0, period)。 */
export function beatGrid(
  bpm: number,
  offsetMs: number,
  durationMs: number,
): BeatGrid | null {
  if (!Number.isFinite(bpm) || bpm < 60 || bpm > 200) return null;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  const period = 60000 / bpm;
  const rawOffset = Number.isFinite(offsetMs) ? offsetMs : 0;
  const normalized = ((rawOffset % period) + period) % period;
  const beatsMs: number[] = [];
  for (let time = normalized; time <= durationMs + 0.001; time += period) {
    beatsMs.push(Math.round(time * 1000) / 1000);
  }
  if (beatsMs.length < 2) return null;
  return {
    bpm,
    offsetMs: Math.round(normalized * 1000) / 1000,
    beatsMs,
    downbeatsMs: beatsMs.filter((_, index) => index % 4 === 0),
  };
}

export function manualSidecar(
  chartId: string,
  asset: BeatAudioAsset,
  tapsMs: readonly number[],
  timestamp: string,
  options: ManualSidecarOptions = {},
): BeatsSidecar | null {
  const bpm = options.bpm ?? manualBpm(tapsMs);
  if (bpm === null || !Number.isFinite(bpm) || bpm < 60 || bpm > 200) return null;
  const grid = beatGrid(bpm, options.offsetMs ?? 0, asset.durationMs);
  if (!grid) return null;
  return {
    schemaVersion: 1,
    chartId,
    audioAssetId: asset.assetId,
    audioSha256: asset.sha256,
    analyzer: 'offline-onset-autocorrelation-v1',
    bpm: Math.round(bpm * 100) / 100,
    meter: 4,
    offsetMs: grid.offsetMs,
    beatsMs: [...grid.beatsMs],
    downbeatsMs: [...grid.downbeatsMs],
    confidence: 1,
    source: 'Manual',
    generatedAt: timestamp,
  };
}
