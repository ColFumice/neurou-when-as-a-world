/**
 * R5a.1 · beats sidecar（X 层，非 A 类）。
 *
 * 文件：charts/<chartId>.beats.json
 * 只读运行时；坏数据/未知字段/越界一律降级为 null + warnings。
 */
import { TauriProjectIo } from '../../../adapters/tauri/TauriProjectIo';

export type BeatsSidecarSource = 'Detected' | 'Manual';

export interface BeatsSidecar {
  readonly schemaVersion: 1;
  readonly chartId: string;
  readonly audioAssetId: string;
  readonly audioSha256: string;
  readonly analyzer: 'offline-onset-autocorrelation-v1';
  readonly bpm: number;
  readonly meter: 4;
  readonly offsetMs: number;
  readonly beatsMs: readonly number[];
  readonly downbeatsMs: readonly number[];
  readonly confidence: number;
  readonly source: BeatsSidecarSource;
  readonly generatedAt: string;
}

export interface BeatsSidecarIo {
  openProjectRoot(path: string): Promise<void>;
  readProjectFile(relPath: string): Promise<unknown | null>;
  writeProjectFile(relPath: string, data: unknown): Promise<void>;
}

export interface BeatsSidecarReadOptions {
  readonly io?: BeatsSidecarIo;
  readonly currentAudioSha256?: string;
  readonly durationMs?: number;
}

export interface BeatsSidecarReadResult {
  readonly sidecar: BeatsSidecar | null;
  readonly warnings: readonly string[];
}

const SCHEMA_KEYS = new Set([
  'schemaVersion',
  'chartId',
  'audioAssetId',
  'audioSha256',
  'analyzer',
  'bpm',
  'meter',
  'offsetMs',
  'beatsMs',
  'downbeatsMs',
  'confidence',
  'source',
  'generatedAt',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function exactKeys(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (!SCHEMA_KEYS.has(key)) fail(`unknown field ${key}`);
  }
  for (const key of SCHEMA_KEYS) {
    if (!(key in value)) fail(`missing field ${key}`);
  }
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function times(value: unknown, label: string, durationMs?: number): number[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a non-empty array`);
  const result: number[] = [];
  let previous = -Infinity;
  for (const item of value) {
    const time = finiteNumber(item, `${label}[]`);
    if (time < 0) fail(`${label} must be >= 0`);
    if (durationMs !== undefined && time > durationMs + 0.001) {
      fail(`${label} exceeds duration`);
    }
    if (time <= previous) fail(`${label} must be strictly ascending`);
    previous = time;
    result.push(time);
  }
  return result;
}

function chartIdOk(chartId: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(chartId);
}

export function beatsSidecarRelPath(chartId: string): string {
  if (!chartIdOk(chartId)) fail(`invalid chartId ${chartId}`);
  return `charts/${chartId}.beats.json`;
}

export function parseBeatsSidecar(
  raw: unknown,
  chartId: string,
  options: { readonly durationMs?: number; readonly currentAudioSha256?: string } = {},
): BeatsSidecarReadResult {
  try {
    if (!isRecord(raw)) fail('sidecar root must be an object');
    exactKeys(raw);
    if (raw.schemaVersion !== 1) fail('schemaVersion must be 1');
    const parsedChartId = text(raw.chartId, 'chartId');
    if (parsedChartId !== chartId) fail(`chartId ${parsedChartId} does not match ${chartId}`);
    const audioAssetId = text(raw.audioAssetId, 'audioAssetId');
    const audioSha256 = text(raw.audioSha256, 'audioSha256', 64);
    if (!/^[a-f0-9]{64}$/.test(audioSha256)) fail('audioSha256 must be 64 lowercase hex');
    if (options.currentAudioSha256 !== undefined
      && options.currentAudioSha256 !== audioSha256) {
      fail('stale audioSha256');
    }
    if (raw.analyzer !== 'offline-onset-autocorrelation-v1') fail('unknown analyzer');
    const bpm = finiteNumber(raw.bpm, 'bpm');
    if (bpm < 60 || bpm > 200) fail('bpm out of range');
    if (raw.meter !== 4) fail('meter must be 4');
    const offsetMs = finiteNumber(raw.offsetMs, 'offsetMs');
    if (offsetMs < 0) fail('offsetMs must be >= 0');
    const beatsMs = times(raw.beatsMs, 'beatsMs', options.durationMs);
    const downbeatsMs = times(raw.downbeatsMs, 'downbeatsMs', options.durationMs);
    const beatSet = new Set(beatsMs.map((time) => time.toFixed(3)));
    for (const time of downbeatsMs) {
      if (!beatSet.has(time.toFixed(3))) fail('downbeat is not one of beatsMs');
    }
    const confidence = finiteNumber(raw.confidence, 'confidence');
    if (confidence < 0 || confidence > 1) fail('confidence out of range');
    if (raw.source !== 'Detected' && raw.source !== 'Manual') fail('invalid source');
    const generatedAt = text(raw.generatedAt, 'generatedAt');
    return {
      sidecar: {
        schemaVersion: 1,
        chartId: parsedChartId,
        audioAssetId,
        audioSha256,
        analyzer: 'offline-onset-autocorrelation-v1',
        bpm,
        meter: 4,
        offsetMs,
        beatsMs,
        downbeatsMs,
        confidence,
        source: raw.source,
        generatedAt,
      },
      warnings: [],
    };
  } catch (error) {
    return {
      sidecar: null,
      warnings: [`beats sidecar: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export async function readBeatsSidecar(
  projectRoot: string,
  chartId: string,
  options: BeatsSidecarReadOptions = {},
): Promise<BeatsSidecarReadResult> {
  try {
    const io = options.io ?? new TauriProjectIo();
    await io.openProjectRoot(projectRoot);
    const raw = await io.readProjectFile(beatsSidecarRelPath(chartId));
    if (raw === null) return { sidecar: null, warnings: ['beats sidecar missing'] };
    const first = parseBeatsSidecar(raw, chartId, { durationMs: options.durationMs });
    if (!first.sidecar) return first;
    let currentHash = options.currentAudioSha256;
    let durationMs = options.durationMs;
    if (currentHash === undefined || durationMs === undefined) {
      // 优先复用 Rust media manifest 已计算的 sha256 / duration，避免重复读大文件。
      const manifest = await io.readProjectFile('media/manifest.json');
      const assets = isRecord(manifest) && Array.isArray(manifest.assets)
        ? manifest.assets
        : [];
      const asset = assets.find((item) => isRecord(item)
        && item.assetId === first.sidecar?.audioAssetId);
      if (durationMs === undefined && isRecord(asset)
        && typeof asset.durationMs === 'number' && Number.isFinite(asset.durationMs)) {
        durationMs = asset.durationMs;
      }
      if (currentHash === undefined) {
        const manifestHash = isRecord(asset) ? asset.sha256 : undefined;
        if (typeof manifestHash !== 'string' || !/^[a-f0-9]{64}$/.test(manifestHash)) {
          return {
            sidecar: null,
            warnings: ['beats sidecar: current audio sha256 unavailable'],
          };
        }
        currentHash = manifestHash;
      }
    }
    return parseBeatsSidecar(raw, chartId, {
      durationMs,
      currentAudioSha256: currentHash,
    });
  } catch (error) {
    return {
      sidecar: null,
      warnings: [`beats sidecar read: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export async function writeBeatsSidecar(
  projectRoot: string,
  chartId: string,
  data: BeatsSidecar,
  io?: BeatsSidecarIo,
): Promise<void> {
  if (data.chartId !== chartId) throw new Error('beats sidecar chartId mismatch');
  const parsed = parseBeatsSidecar(data, chartId);
  if (!parsed.sidecar) throw new Error(parsed.warnings.join('; '));
  const target = io ?? new TauriProjectIo();
  await target.openProjectRoot(projectRoot);
  await target.writeProjectFile(beatsSidecarRelPath(chartId), parsed.sidecar);
}
