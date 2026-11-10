import {
  TraceOrigin,
  TraceTier,
} from '../../../core/trace/types';
import type { VisualFrameRect } from '../../../core/world/frame';
import { ParallaxLayer } from '../../../core/world/trigger';
import type {
  EventSignalId,
  TriggerId,
  TriggerRegion,
} from '../../../core/world/trigger';

/** 游戏运行时的一条痕放置；sidecar 解析后的稳定形态。 */
export interface GameTracePlacement {
  readonly traceId: string;
  readonly tier: TraceTier;
  readonly origin: TraceOrigin;
  readonly beatTimeMs: number;
  readonly rect: VisualFrameRect;
  readonly layerIndex: number;
  readonly parallaxFactor: number;
  readonly label: string;
}

export interface GameTriggerDefinition {
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly region: TriggerRegion;
  readonly dwellMs: number;
  readonly occupancyThreshold: number | null;
  readonly occupancyIntervalMs: number;
  readonly parallaxLayer: ParallaxLayer | null;
  readonly parallaxFactor: number;
  readonly parallaxStep: number;
}

export interface StageSidecarResult<T> {
  readonly items: readonly T[];
  readonly warnings: readonly string[];
}

function fail(message: string): never {
  throw new TypeError(message);
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

function text(value: unknown, label: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    fail(`${label} must be a non-empty string (max ${max})`);
  }
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) {
    fail(`${label} must not contain control characters`);
  }
  return value;
}

function optionalLabel(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 128) {
    fail('label must be a string (max 128)');
  }
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) {
    fail('label must not contain control characters');
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be finite`);
  }
  return value;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

function normalizedRect(value: unknown, label: string): VisualFrameRect {
  const raw = record(value, label);
  exactKeys(raw, ['x', 'y', 'width', 'height']);
  const x = finite(raw.x, `${label}.x`);
  const y = finite(raw.y, `${label}.y`);
  const width = finite(raw.width, `${label}.width`);
  const height = finite(raw.height, `${label}.height`);
  if (width <= 0 || height <= 0) fail(`${label} width/height must be positive`);
  if (x < 0 || y < 0 || x > 1 || y > 1) fail(`${label} x/y must be within 0..1`);
  if (x + width > 1 || y + height > 1) fail(`${label} must stay within 0..1`);
  return { x, y, width, height };
}

function traceRoot(
  raw: unknown,
  expectedChartId?: string,
): { readonly chartId: string; readonly entries: unknown } {
  const root = record(raw, 'root');
  exactKeys(root, ['schemaVersion', 'chartId', 'traces']);
  if (root.schemaVersion !== 1) fail('schemaVersion must be 1');
  const chartId = text(root.chartId, 'chartId');
  if (expectedChartId !== undefined && chartId !== expectedChartId) {
    fail(`chartId ${chartId} does not match ${expectedChartId}`);
  }
  return { chartId, entries: root.traces };
}

function triggerRoot(
  raw: unknown,
  expectedChartId?: string,
): { readonly chartId: string; readonly entries: unknown } {
  const root = record(raw, 'root');
  exactKeys(root, ['schemaVersion', 'chartId', 'triggers']);
  if (root.schemaVersion !== 1) fail('schemaVersion must be 1');
  const chartId = text(root.chartId, 'chartId');
  if (expectedChartId !== undefined && chartId !== expectedChartId) {
    fail(`chartId ${chartId} does not match ${expectedChartId}`);
  }
  return { chartId, entries: root.triggers };
}

function warning(prefix: string, error: unknown): string {
  return `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
}

function parseTrace(item: unknown, index: number): GameTracePlacement {
  const value = record(item, `traces[${index}]`);
  exactKeys(
    value,
    ['traceId', 'tier', 'origin', 'beatTimeMs', 'rect'],
    ['layerIndex', 'parallaxFactor', 'label'],
  );
  const tier = value.tier;
  if (tier !== TraceTier.Common && tier !== TraceTier.Deep && tier !== TraceTier.Rain) {
    fail(`traces[${index}].tier must be Common / Deep / Rain`);
  }
  const origin = value.origin;
  if (origin !== TraceOrigin.Normal
    && origin !== TraceOrigin.Anomalous
    && origin !== TraceOrigin.Echo) {
    fail(`traces[${index}].origin must be Normal / Anomalous / Echo`);
  }
  const layerIndex = value.layerIndex === undefined
    ? 1
    : integer(value.layerIndex, 1, 32, `traces[${index}].layerIndex`);
  const parallaxFactor = value.parallaxFactor === undefined
    ? 1
    : finite(value.parallaxFactor, `traces[${index}].parallaxFactor`);
  if (parallaxFactor < -5 || parallaxFactor > 5) {
    fail(`traces[${index}].parallaxFactor must be within -5..5`);
  }
  return {
    traceId: text(value.traceId, `traces[${index}].traceId`),
    tier,
    origin,
    beatTimeMs: integer(value.beatTimeMs, 0, Number.MAX_SAFE_INTEGER, `traces[${index}].beatTimeMs`),
    rect: normalizedRect(value.rect, `traces[${index}].rect`),
    layerIndex,
    parallaxFactor,
    label: optionalLabel(value.label),
  };
}

export function parseTracesSidecar(
  raw: unknown,
  expectedChartId?: string,
): StageSidecarResult<GameTracePlacement> {
  try {
    const root = traceRoot(raw, expectedChartId);
    if (!Array.isArray(root.entries)) fail('traces must be an array');
    const seen = new Set<string>();
    const items = root.entries.map((item, index) => {
      const trace = parseTrace(item, index);
      if (seen.has(trace.traceId)) fail(`duplicate traceId ${trace.traceId}`);
      seen.add(trace.traceId);
      return trace;
    });
    return { items, warnings: [] };
  } catch (error) {
    return { items: [], warnings: [warning('traces.json', error)] };
  }
}

function parseTrigger(item: unknown, index: number): GameTriggerDefinition {
  const value = record(item, `triggers[${index}]`);
  exactKeys(
    value,
    ['triggerId', 'eventSignalId', 'region'],
    [
      'dwellMs', 'occupancyThreshold', 'occupancyIntervalMs',
      'parallaxLayer', 'parallaxFactor', 'parallaxStep',
    ],
  );
  const dwellMs = value.dwellMs === undefined
    ? 0
    : finite(value.dwellMs, `triggers[${index}].dwellMs`);
  if (dwellMs < 0) fail(`triggers[${index}].dwellMs must be >= 0`);

  let occupancyThreshold: number | null = null;
  if (value.occupancyThreshold !== undefined) {
    occupancyThreshold = finite(
      value.occupancyThreshold,
      `triggers[${index}].occupancyThreshold`,
    );
    if (occupancyThreshold < 0 || occupancyThreshold > 1) {
      fail(`triggers[${index}].occupancyThreshold must be within 0..1`);
    }
  }

  const occupancyIntervalMs = value.occupancyIntervalMs === undefined
    ? 250
    : finite(value.occupancyIntervalMs, `triggers[${index}].occupancyIntervalMs`);
  if (occupancyIntervalMs < 0) {
    fail(`triggers[${index}].occupancyIntervalMs must be >= 0`);
  }

  let parallaxLayer: ParallaxLayer | null = null;
  if (value.parallaxLayer !== undefined) {
    const layer = value.parallaxLayer;
    if (layer !== ParallaxLayer.Foreground
      && layer !== ParallaxLayer.Midground
      && layer !== ParallaxLayer.Background) {
      fail(`triggers[${index}].parallaxLayer must be Foreground / Midground / Background`);
    }
    parallaxLayer = layer;
  }

  const parallaxFactor = value.parallaxFactor === undefined
    ? 1
    : finite(value.parallaxFactor, `triggers[${index}].parallaxFactor`);
  if (parallaxFactor < -5 || parallaxFactor > 5) {
    fail(`triggers[${index}].parallaxFactor must be within -5..5`);
  }

  const parallaxStep = value.parallaxStep === undefined
    ? 0.01
    : finite(value.parallaxStep, `triggers[${index}].parallaxStep`);
  if (parallaxStep <= 0) {
    fail(`triggers[${index}].parallaxStep must be > 0`);
  }

  return {
    triggerId: text(value.triggerId, `triggers[${index}].triggerId`),
    eventSignalId: text(value.eventSignalId, `triggers[${index}].eventSignalId`),
    region: normalizedRect(value.region, `triggers[${index}].region`),
    dwellMs,
    occupancyThreshold,
    occupancyIntervalMs,
    parallaxLayer,
    parallaxFactor,
    parallaxStep,
  };
}

export function parseTriggersSidecar(
  raw: unknown,
  expectedChartId?: string,
): StageSidecarResult<GameTriggerDefinition> {
  try {
    const root = triggerRoot(raw, expectedChartId);
    if (!Array.isArray(root.entries)) fail('triggers must be an array');
    const seen = new Set<string>();
    const items = root.entries.map((item, index) => {
      const trigger = parseTrigger(item, index);
      if (seen.has(trigger.triggerId)) fail(`duplicate triggerId ${trigger.triggerId}`);
      seen.add(trigger.triggerId);
      return trigger;
    });
    return { items, warnings: [] };
  } catch (error) {
    return { items: [], warnings: [warning('triggers.json', error)] };
  }
}
