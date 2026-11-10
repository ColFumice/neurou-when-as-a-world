// A 步独立引导线谱面数据；冻结名依据名库 v2.6 / VERDICT-127~135。
// 纯数据与路径数学，零 cc。技术版本 schemaVersion = 1。
import type { ChartTier } from '../../constants';
import { HEAD_WINDOW_MS } from '../../constants';
import type { ChartKeyId, KeyboardPadLayout } from './KeyboardPadLayout';

export interface GuidancePosition {
  readonly u: number;
  readonly v: number;
}

export interface NodePath {
  readonly kind: 'Polyline';
  readonly points: readonly GuidancePosition[];
}

export interface HeadNode {
  readonly id: string;
  readonly spawnTimeMs: number;
}

export interface TapNode {
  readonly id: string;
  readonly kind: 'Tap';
  readonly pathDistance: number;
}

export interface DragNode {
  readonly id: string;
  readonly kind: 'Drag';
  readonly pathDistance: number;
  readonly keyId: Exclude<ChartKeyId, 'Space'>;
}

export interface HoldNode {
  readonly id: string;
  readonly kind: 'Hold';
  readonly pathDistance: number;
  readonly endPathDistance: number;
  readonly keyId: Exclude<ChartKeyId, 'Space'>;
}

/** 冻结联合完整保留；A 步解析器明确拒绝 Drag / Hold。 */
export type GuidanceNode = TapNode | DragNode | HoldNode;
export type ChartNodeKind = 'Tap' | 'Drag' | 'Hold';

export interface GuidanceLine {
  readonly id: string;
  readonly head: HeadNode;
  readonly path: NodePath;
  /** 每秒前进的路径弧长；横向距离已按 aspectRatio 加权。 */
  readonly speed: number;
  readonly nodes: readonly GuidanceNode[];
}

export interface GuidanceChart {
  readonly schemaVersion: 1;
  readonly chartId: string;
  readonly tier: ChartTier;
  readonly layoutVersion: string;
  readonly aspectRatio: number;
  readonly lines: readonly GuidanceLine[];
}

export interface JudgmentPoint {
  readonly position: GuidancePosition;
  readonly pathDistance: number;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`GuidanceChart: ${label} 必须为对象`);
  }
  return value as Record<string, unknown>;
}

function requireFields(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) {
      throw new Error(`GuidanceChart: ${label} 不支持字段 ${field}`);
    }
  }
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`GuidanceChart: ${label} 必须为有限数值`);
  }
  return value;
}

function requireId(value: unknown, label: string, identities: Set<string>): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`GuidanceChart: ${label} 必须为非空 ID`);
  }
  if (identities.has(value)) {
    throw new Error(`GuidanceChart: 重复 ID ${value}`);
  }
  identities.add(value);
  return value;
}

function parsePosition(value: unknown, index: number): GuidancePosition {
  const source = requireRecord(value, `points[${index}]`);
  requireFields(source, ['u', 'v'], `points[${index}]`);
  const u = requireFinite(source.u, `points[${index}].u`);
  const v = requireFinite(source.v, `points[${index}].v`);
  if (u < 0 || u > 1 || v < 0 || v > 1) {
    throw new Error(`GuidanceChart: points[${index}] 越出归一化区域 [0,1]`);
  }
  return Object.freeze({ u, v });
}

/** aspectRatio 修正后的弧长；与渲染分辨率无关。 */
export function measurePathLength(path: NodePath, aspectRatio: number): number {
  let length = 0;
  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1];
    const next = path.points[index];
    length += Math.hypot((next.u - previous.u) * aspectRatio, next.v - previous.v);
  }
  return length;
}

/** 沿弧长查询位置；到达末端后停留末端，保留末节点仍开放的判定窗口。 */
export function positionAtPathDistance(
  path: NodePath,
  aspectRatio: number,
  pathDistance: number,
): GuidancePosition {
  const distance = Math.max(0, Math.min(pathDistance, measurePathLength(path, aspectRatio)));
  let remaining = distance;
  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1];
    const next = path.points[index];
    const length = Math.hypot((next.u - previous.u) * aspectRatio, next.v - previous.v);
    if (length > 0 && remaining <= length) {
      const fraction = remaining / length;
      return Object.freeze({
        u: previous.u + (next.u - previous.u) * fraction,
        v: previous.v + (next.v - previous.v) * fraction,
      });
    }
    remaining -= length;
  }
  return path.points[path.points.length - 1];
}

/**
 * 严格加载 A 步谱面：一线、两路径点、一 Tap。
 * 复制并深度冻结，原始 JSON 后续修改不能改变运行中的谱面。
 */
export function parseGuidanceChart(raw: unknown, layout: KeyboardPadLayout): GuidanceChart {
  const source = requireRecord(raw, '谱面');
  requireFields(source, ['schemaVersion', 'chartId', 'tier', 'layoutVersion', 'aspectRatio', 'lines'], '谱面');
  if (source.schemaVersion !== 1) {
    throw new Error('GuidanceChart: A 步仅支持 schemaVersion=1');
  }
  if (source.layoutVersion !== layout.layoutVersion) {
    throw new Error(`GuidanceChart: 布局版本不匹配，拒绝加载 (${String(source.layoutVersion)} / ${layout.layoutVersion})`);
  }
  const chartId = requireId(source.chartId, 'chartId', new Set<string>());
  const tier = source.tier;
  if (tier !== 'Regular' && tier !== 'Character' && tier !== 'World' && tier !== 'Final') {
    throw new Error('GuidanceChart: tier 非法');
  }
  const aspectRatio = requireFinite(source.aspectRatio, 'aspectRatio');
  if (aspectRatio <= 0) {
    throw new Error('GuidanceChart: aspectRatio 必须为正');
  }
  if (!Array.isArray(source.lines) || source.lines.length !== 1) {
    throw new Error('GuidanceChart: A 步仅接收一条引导线，拒绝多线或空谱面');
  }
  const identities = new Set<string>();
  const lineSource = requireRecord(source.lines[0], '引导线');
  requireFields(lineSource, ['id', 'head', 'path', 'speed', 'nodes'], '引导线');
  const id = requireId(lineSource.id, 'line.id', identities);
  const headSource = requireRecord(lineSource.head, 'Head');
  requireFields(headSource, ['id', 'spawnTimeMs'], 'Head');
  const headId = requireId(headSource.id, 'head.id', identities);
  const spawnTimeMs = requireFinite(headSource.spawnTimeMs, 'spawnTimeMs');
  if (spawnTimeMs < 0) {
    throw new Error('GuidanceChart: spawnTimeMs 不得为负');
  }
  const pathSource = requireRecord(lineSource.path, 'path');
  requireFields(pathSource, ['kind', 'points'], 'path');
  if (pathSource.kind !== 'Polyline') {
    throw new Error('GuidanceChart: A 步仅支持 Polyline');
  }
  if (!Array.isArray(pathSource.points) || pathSource.points.length !== 2) {
    throw new Error('GuidanceChart: A 步仅接收两点直线');
  }
  const path: NodePath = Object.freeze({
    kind: 'Polyline',
    points: Object.freeze(pathSource.points.map(parsePosition)),
  });
  const length = measurePathLength(path, aspectRatio);
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('GuidanceChart: 路径必须包含两个不同点且弧长有限');
  }
  const speed = requireFinite(lineSource.speed, 'speed');
  if (speed <= 0) {
    throw new Error('GuidanceChart: speed 必须为正');
  }
  if (!Array.isArray(lineSource.nodes) || lineSource.nodes.length !== 1) {
    throw new Error('GuidanceChart: A 步仅接收一个 Tap');
  }
  const nodeSource = requireRecord(lineSource.nodes[0], '节点');
  if (nodeSource.kind !== 'Tap') {
    throw new Error(`GuidanceChart: A 步拒绝 ${String(nodeSource.kind)}，仅接收 Head + Tap`);
  }
  if ('keyId' in nodeSource) {
    throw new Error('GuidanceChart: Tap 禁止包含 keyId，不允许默认键或备用键');
  }
  requireFields(nodeSource, ['id', 'kind', 'pathDistance'], 'Tap');
  const nodeId = requireId(nodeSource.id, 'Tap.id', identities);
  const pathDistance = requireFinite(nodeSource.pathDistance, 'pathDistance');
  if (pathDistance < 0 || pathDistance > length) {
    throw new Error('GuidanceChart: Tap 距离必须在路径范围内');
  }
  if (!Number.isFinite((length / speed) * 1000) ||
      !Number.isFinite(spawnTimeMs + HEAD_WINDOW_MS + (length / speed) * 1000)) {
    throw new Error('GuidanceChart: 路径运行时间超出有限数值范围');
  }
  const head: HeadNode = Object.freeze({ id: headId, spawnTimeMs });
  const node: TapNode = Object.freeze({ id: nodeId, kind: 'Tap', pathDistance });
  const line: GuidanceLine = Object.freeze({
    id, head, path, speed, nodes: Object.freeze([node]),
  });
  return Object.freeze({
    schemaVersion: 1,
    chartId,
    tier,
    layoutVersion: layout.layoutVersion,
    aspectRatio,
    lines: Object.freeze([line]),
  });
}
