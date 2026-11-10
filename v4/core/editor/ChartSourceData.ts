/**
 * E · editor / ChartSourceData
 * ChartSourceData v2 的唯一 E 层实现。
 *
 * 说明：R2 的 v2 在当前工作区未发现同名实现（v4/core 无 ChartSourceData）；
 * 本文件先落唯一实现。若后续 R2 分支另有 v2 文件，应改为从这里 re-export，
 * 不保留两份 parser。
 */

type Provenance = 'Mock' | 'Midi';
type SourcePadKind = 'Light' | 'Heavy' | 'TopMost';
type SourceLayerKind = 'TopMost' | 'Grid' | 'FullScreen';
type FullScreenInput = 'Space' | 'Pointer';

interface ChartSourceLayer {
  readonly index: number;
  readonly kind: SourceLayerKind;
  readonly fullScreenInput?: FullScreenInput;
}

interface ChartSourceNote {
  readonly timeMs: number;
  readonly durationMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId?: number;
  readonly chartKeyId?: string;
  readonly chartPadKind: SourcePadKind;
}

/** ChartSourceData v2：谱面演出格式；不含 logo/UI/稳定 keyframe ID。 */
export interface ChartSourceData {
  readonly schemaVersion: 2;
  readonly chartId: string;
  readonly provenance: Provenance;
  readonly layers: readonly ChartSourceLayer[];
  readonly notes: readonly ChartSourceNote[];
}

function fail(message: string): never {
  throw new TypeError(`ChartSourceData: ${message}`);
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

function int(value: unknown, min: number, max: number, label: string): number {
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

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, label);
}

function optionalIndex(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return int(value, 1, 8, label);
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function parseLayer(raw: unknown, expectedIndex: number): ChartSourceLayer {
  const value = record(raw, `layers[${expectedIndex - 1}]`);
  exactKeys(value, ['index', 'kind'], ['fullScreenInput']);
  const index = int(value.index, 1, 32, 'layer.index');
  if (index !== expectedIndex) fail('layers must be contiguous and 1-based');
  const kind = value.kind;
  if (kind !== 'TopMost' && kind !== 'Grid' && kind !== 'FullScreen') {
    fail('layer.kind must be TopMost / Grid / FullScreen');
  }
  const expectedKind: SourceLayerKind = index === 1 ? 'TopMost' : index === 2 ? 'Grid' : 'FullScreen';
  if (kind !== expectedKind) fail(`layer ${index} must be ${expectedKind}`);

  if (kind === 'FullScreen') {
    const fullScreenInput = value.fullScreenInput;
    if (fullScreenInput !== undefined && fullScreenInput !== null
      && fullScreenInput !== 'Space' && fullScreenInput !== 'Pointer') {
      fail('fullScreenInput must be Space / Pointer');
    }
    return freeze({
      index,
      kind,
      ...(fullScreenInput === undefined || fullScreenInput === null
        ? {}
        : { fullScreenInput }),
    });
  }
  if (value.fullScreenInput !== undefined && value.fullScreenInput !== null) {
    fail('fullScreenInput is only allowed for FullScreen layers');
  }
  return freeze({ index, kind });
}

function parseNote(raw: unknown, layers: readonly ChartSourceLayer[]): ChartSourceNote {
  const value = record(raw, 'notes[]');
  exactKeys(
    value,
    ['timeMs', 'durationMs', 'chartLayerIndex', 'chartPadKind'],
    ['gridCellId', 'chartKeyId'],
  );
  const timeMs = int(value.timeMs, 0, Number.MAX_SAFE_INTEGER, 'note.timeMs');
  const durationMs = int(value.durationMs, 0, Number.MAX_SAFE_INTEGER, 'note.durationMs');
  if (timeMs + durationMs > Number.MAX_SAFE_INTEGER) fail('note time range is too large');
  const chartLayerIndex = int(value.chartLayerIndex, 1, 32, 'note.chartLayerIndex');
  if (!layers.some((layer) => layer.index === chartLayerIndex)) {
    fail('note.chartLayerIndex must reference a layer');
  }
  const padKind = value.chartPadKind;
  if (padKind !== 'Light' && padKind !== 'Heavy' && padKind !== 'TopMost') {
    fail('note.chartPadKind must be Light / Heavy / TopMost');
  }
  const gridCellId = optionalIndex(value.gridCellId, 'note.gridCellId');
  const chartKeyId = optionalText(value.chartKeyId, 'note.chartKeyId');

  if (chartLayerIndex === 1 && (padKind !== 'TopMost' || gridCellId !== undefined)) {
    fail('layer 1 must be TopMost without gridCellId');
  }
  if (chartLayerIndex === 2) {
    if (padKind !== 'Light' && padKind !== 'Heavy') fail('layer 2 pad must be Light/Heavy');
    if (gridCellId === undefined) fail('layer 2 requires gridCellId');
  }
  if (chartLayerIndex >= 3 && (padKind !== 'Light' || gridCellId !== undefined)) {
    fail('layer 3+ must be Light without gridCellId');
  }

  return freeze({
    timeMs,
    durationMs,
    chartLayerIndex,
    chartPadKind: padKind,
    ...(gridCellId === undefined ? {} : { gridCellId }),
    ...(chartKeyId === undefined ? {} : { chartKeyId }),
  });
}

/** 严格解析 ChartSourceData v2；拒绝 v1、未知字段和非法层/格/Pad 组合。 */
export function parseChartSourceData(raw: unknown): ChartSourceData {
  const value = record(raw, 'root');
  exactKeys(value, ['schemaVersion', 'chartId', 'provenance', 'layers', 'notes']);
  if (value.schemaVersion !== 2) {
    fail('UnsupportedSchemaVersion: only schemaVersion 2 is supported');
  }

  const layersRaw = value.layers;
  if (!Array.isArray(layersRaw) || layersRaw.length === 0 || layersRaw.length > 32) {
    fail('layers must be a non-empty array (max 32)');
  }
  const layers = layersRaw.map((layer, index) => parseLayer(layer, index + 1));

  const notesRaw = value.notes;
  if (!Array.isArray(notesRaw)) fail('notes must be an array');
  const notes = notesRaw.map((note) => parseNote(note, layers));
  notes.sort((left, right) => (
    left.timeMs - right.timeMs
    || left.chartLayerIndex - right.chartLayerIndex
    || (left.gridCellId ?? 0) - (right.gridCellId ?? 0)
    || left.chartPadKind.localeCompare(right.chartPadKind)
  ));

  return freeze({
    schemaVersion: 2,
    chartId: text(value.chartId, 'chartId'),
    provenance: value.provenance === 'Mock' || value.provenance === 'Midi'
      ? value.provenance
      : fail('provenance must be Mock / Midi'),
    layers,
    notes,
  });
}
