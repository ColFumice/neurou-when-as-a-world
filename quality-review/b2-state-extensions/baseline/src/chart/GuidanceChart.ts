// 独立引导线谱面数据；冻结名依据名库 v2.6 / v2.7。
// 纯数据与路径数学，零 cc。v1 单线/v2 多线固定速率；v3 多线绝对卡点。
import type { ChartTier } from '../../constants';
import { GOOD_WINDOW_MS, HEAD_WINDOW_MS } from '../../constants';
import type { ChartKeyId, KeyboardPadLayout } from './KeyboardPadLayout';
import { CHART_KEY_IDS, getSlot } from './KeyboardPadLayout';
import { getLineTimeAnchors } from './GuidanceTiming';

/** 仅覆盖路径计算的浮点误差，不改变节点时间或判定窗口。 */
const PATH_CALCULATION_EPSILON = Number.EPSILON * 32;

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

/** 冻结联合完整保留；B 步接收 Tap / Drag / Hold。 */
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

/** v3 时间表与既有节点数据分离；颜色始终不在玩法数据中。 */
export interface GuidanceNodeTiming {
  readonly nodeId: string;
  readonly targetTimeMs: number;
  readonly endTargetTimeMs?: number;
}

export interface TimedGuidanceLine {
  readonly id: string;
  readonly head: HeadNode & { readonly targetTimeMs: number };
  readonly path: NodePath;
  readonly nodes: readonly GuidanceNode[];
  readonly timing: readonly GuidanceNodeTiming[];
}

export interface GuidanceChart {
  readonly schemaVersion: 1 | 2 | 3;
  readonly chartId: string;
  readonly tier: ChartTier;
  readonly layoutVersion: string;
  readonly aspectRatio: number;
  readonly lines: readonly (GuidanceLine | TimedGuidanceLine)[];
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

/**
 * 按弧长截取完整折线区段；仅 chart 计算切点，表现层直接绘制。
 * 区段包含首尾切点及其间原始顶点；零长度区段返回空数组。
 */
export function slicePathByDistance(
  path: NodePath,
  aspectRatio: number,
  startDistance: number,
  endDistance: number = measurePathLength(path, aspectRatio),
): readonly GuidancePosition[] {
  const pathLength = measurePathLength(path, aspectRatio);
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0 ||
      !Number.isFinite(pathLength) || pathLength <= 0 ||
      !Number.isFinite(startDistance) || !Number.isFinite(endDistance) ||
      startDistance < 0 || endDistance < startDistance || endDistance > pathLength) {
    throw new Error('GuidanceChart: 路径截取距离非法');
  }
  if (startDistance === endDistance) {
    return Object.freeze([]);
  }
  const points: GuidancePosition[] = [Object.freeze({
    ...positionAtPathDistance(path, aspectRatio, startDistance),
  })];
  let cumulativeDistance = 0;
  for (let index = 1; index < path.points.length - 1; index += 1) {
    const previous = path.points[index - 1];
    const next = path.points[index];
    cumulativeDistance += Math.hypot((next.u - previous.u) * aspectRatio, next.v - previous.v);
    if (cumulativeDistance > startDistance && cumulativeDistance < endDistance) {
      points.push(Object.freeze({ ...next }));
    }
  }
  points.push(Object.freeze({ ...positionAtPathDistance(path, aspectRatio, endDistance) }));
  return Object.freeze(points);
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

function parseBoundKey(value: unknown, layout: KeyboardPadLayout): Exclude<ChartKeyId, 'Space'> {
  if (typeof value !== 'string' || !CHART_KEY_IDS.includes(value as ChartKeyId) || value === 'Space') {
    throw new Error('GuidanceChart: Drag / Hold 必须绑定非 Space 的规范键 ID');
  }
  const keyId = value as Exclude<ChartKeyId, 'Space'>;
  if (getSlot(layout, keyId) === undefined) {
    throw new Error(`GuidanceChart: 绑定键 ${keyId} 不存在于布局`);
  }
  return keyId;
}

function parseGuidanceNode(
  raw: unknown,
  layout: KeyboardPadLayout,
  pathLength: number,
  identities: Set<string>,
): GuidanceNode {
  const source = requireRecord(raw, '节点');
  const kind = source.kind;
  if (kind !== 'Tap' && kind !== 'Drag' && kind !== 'Hold') {
    throw new Error(`GuidanceChart: B 步拒绝节点类型 ${String(kind)}`);
  }
  if (kind === 'Tap' && 'keyId' in source) {
    throw new Error('GuidanceChart: Tap 禁止包含 keyId，不允许默认键或备用键');
  }
  requireFields(source, kind === 'Tap' ? ['id', 'kind', 'pathDistance']
    : kind === 'Drag' ? ['id', 'kind', 'pathDistance', 'keyId']
      : ['id', 'kind', 'pathDistance', 'endPathDistance', 'keyId'], kind);
  const id = requireId(source.id, `${kind}.id`, identities);
  const pathDistance = requireFinite(source.pathDistance, `${kind}.pathDistance`);
  if (pathDistance < 0 || pathDistance > pathLength) {
    throw new Error(`GuidanceChart: ${kind} 距离必须在路径范围内`);
  }
  if (kind === 'Tap') {
    return Object.freeze({ id, kind, pathDistance });
  }
  const keyId = parseBoundKey(source.keyId, layout);
  if (kind === 'Drag') {
    return Object.freeze({ id, kind, pathDistance, keyId });
  }
  const endPathDistance = requireFinite(source.endPathDistance, 'Hold.endPathDistance');
  if (endPathDistance <= pathDistance || endPathDistance > pathLength) {
    throw new Error('GuidanceChart: Hold 尾端必须大于起点且在路径范围内');
  }
  return Object.freeze({ id, kind, pathDistance, endPathDistance, keyId });
}

/** 正向共线点不构成转折；反向折返与非共线方向变化均须有合法起点节点。 */
function assertTurnsHaveNodes(path: NodePath, aspectRatio: number, nodes: readonly GuidanceNode[]): void {
  const pathLength = measurePathLength(path, aspectRatio);
  const distanceTolerance = pathLength * PATH_CALCULATION_EPSILON;
  let cumulativeDistance = 0;
  for (let index = 1; index < path.points.length - 1; index += 1) {
    const previous = path.points[index - 1];
    const corner = path.points[index];
    const next = path.points[index + 1];
    const incomingU = (corner.u - previous.u) * aspectRatio;
    const incomingV = corner.v - previous.v;
    const outgoingU = (next.u - corner.u) * aspectRatio;
    const outgoingV = next.v - corner.v;
    const incomingLength = Math.hypot(incomingU, incomingV);
    const outgoingLength = Math.hypot(outgoingU, outgoingV);
    cumulativeDistance += incomingLength;
    // 先归一化方向，避免长度较大时叉积/点积中间值溢出。
    const incomingDirectionU = incomingU / incomingLength;
    const incomingDirectionV = incomingV / incomingLength;
    const outgoingDirectionU = outgoingU / outgoingLength;
    const outgoingDirectionV = outgoingV / outgoingLength;
    const cross = incomingDirectionU * outgoingDirectionV - incomingDirectionV * outgoingDirectionU;
    const dot = incomingDirectionU * outgoingDirectionU + incomingDirectionV * outgoingDirectionV;
    const isTurn = Math.abs(cross) > PATH_CALCULATION_EPSILON || dot < 0;
    if (isTurn && !nodes.some(node => (node.kind === 'Tap' || node.kind === 'Hold') &&
        Math.abs(node.pathDistance - cumulativeDistance) <= distanceTolerance)) {
      throw new Error(`GuidanceChart: 内部转折 ${index} 必须对应 Tap 或 Hold 起点；Drag 不得单独构成转折`);
    }
  }
}

/**
 * 严格加载版本化多线 Polyline 与多个 Tap / Drag / Hold。
 * 复制、按弧长及 ID 确定性排序并深度冻结，不修改原始输入。
 */
export function parseGuidanceChart(raw: unknown, layout: KeyboardPadLayout): GuidanceChart {
  const source = requireRecord(raw, '谱面');
  requireFields(source, ['schemaVersion', 'chartId', 'tier', 'layoutVersion', 'aspectRatio', 'lines'], '谱面');
  if (source.schemaVersion !== 1 && source.schemaVersion !== 2 && source.schemaVersion !== 3) {
    throw new Error('GuidanceChart: 仅支持 schemaVersion=1、2 或 3');
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
  if (!Array.isArray(source.lines) || source.lines.length === 0 ||
      (source.schemaVersion === 1 && source.lines.length !== 1)) {
    throw new Error('GuidanceChart: v1 必须恰一条线，v2/v3 至少一条线');
  }
  const identities = new Set<string>();
  const lines = source.lines.map(rawLine => {
    const lineSource = requireRecord(rawLine, '引导线');
    const timed = source.schemaVersion === 3;
    requireFields(lineSource, timed ? ['id', 'head', 'path', 'timing', 'nodes']
      : ['id', 'head', 'path', 'speed', 'nodes'], '引导线');
    const id = requireId(lineSource.id, 'line.id', identities);
    const headSource = requireRecord(lineSource.head, 'Head');
    requireFields(headSource, timed ? ['id', 'spawnTimeMs', 'targetTimeMs'] : ['id', 'spawnTimeMs'], 'Head');
    const headId = requireId(headSource.id, 'head.id', identities);
    const spawnTimeMs = requireFinite(headSource.spawnTimeMs, 'spawnTimeMs');
    if (spawnTimeMs < 0) {
      throw new Error('GuidanceChart: spawnTimeMs 不得为负');
    }
    const pathSource = requireRecord(lineSource.path, 'path');
    requireFields(pathSource, ['kind', 'points'], 'path');
    if (pathSource.kind !== 'Polyline') {
      throw new Error('GuidanceChart: B 步仅支持 Polyline，拒绝曲线');
    }
    if (!Array.isArray(pathSource.points) || pathSource.points.length < 2) {
      throw new Error('GuidanceChart: Polyline 必须至少包含两个点');
    }
    const path: NodePath = Object.freeze({
      kind: 'Polyline',
      points: Object.freeze(pathSource.points.map(parsePosition)),
    });
    for (let index = 1; index < path.points.length; index += 1) {
      const previous = path.points[index - 1];
      const next = path.points[index];
      if (previous.u === next.u && previous.v === next.v) {
        throw new Error(`GuidanceChart: 相邻路径点 ${index - 1} / ${index} 不得重合`);
      }
      const segmentLength = Math.hypot((next.u - previous.u) * aspectRatio, next.v - previous.v);
      if (!Number.isFinite(segmentLength) || segmentLength <= 0) {
        throw new Error(`GuidanceChart: 路径段 ${index - 1} 长度必须有限且为正`);
      }
    }
    const length = measurePathLength(path, aspectRatio);
    if (!Number.isFinite(length) || length <= 0) {
      throw new Error('GuidanceChart: 路径必须包含两个不同点且弧长有限');
    }
    const speed = timed ? 1 : requireFinite(lineSource.speed, 'speed');
    if (speed <= 0) {
      throw new Error('GuidanceChart: speed 必须为正');
    }
    if (!Array.isArray(lineSource.nodes) || lineSource.nodes.length === 0) {
      throw new Error('GuidanceChart: nodes 必须包含至少一个 Tap / Drag / Hold');
    }
    const nodes = lineSource.nodes.map(node => parseGuidanceNode(node, layout, length, identities));
    nodes.sort((left, right) => left.pathDistance - right.pathDistance ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    assertTurnsHaveNodes(path, aspectRatio, nodes);
    if (timed) {
      const targetTimeMs = requireFinite(headSource.targetTimeMs, 'Head.targetTimeMs');
      if (targetTimeMs !== spawnTimeMs) { throw new Error('GuidanceChart: v3 Head 生成时间必须等于目标时间'); }
      if (!Array.isArray(lineSource.timing) || lineSource.timing.length !== nodes.length) {
        throw new Error('GuidanceChart: 每节点必须恰有一项 timing');
      }
      const seen = new Set<string>();
      const timing = lineSource.timing.map(rawTiming => {
        const item = requireRecord(rawTiming, 'timing');
        const node = nodes.find(n => n.id === item.nodeId);
        if (!node) { throw new Error('GuidanceChart: timing 引用未知节点'); }
        requireFields(item, node.kind === 'Hold' ? ['nodeId', 'targetTimeMs', 'endTargetTimeMs']
          : ['nodeId', 'targetTimeMs'], 'timing');
        const nodeId = requireId(item.nodeId, 'timing.nodeId', seen);
        const time = requireFinite(item.targetTimeMs, 'targetTimeMs');
        if (time <= targetTimeMs || !Number.isFinite(time + GOOD_WINDOW_MS)) {
          throw new Error('GuidanceChart: 节点目标必须晚于 Head 且判定窗口有限');
        }
        if (node.kind !== 'Hold') { return Object.freeze({ nodeId, targetTimeMs: time }); }
        const endTargetTimeMs = requireFinite(item.endTargetTimeMs, 'endTargetTimeMs');
        if (endTargetTimeMs <= time) { throw new Error('GuidanceChart: Hold 尾端时间必须晚于起点'); }
        return Object.freeze({ nodeId, targetTimeMs: time, endTargetTimeMs });
      });
      const line: TimedGuidanceLine = Object.freeze({ id,
        head: Object.freeze({ id: headId, spawnTimeMs, targetTimeMs }), path,
        nodes: Object.freeze(nodes), timing: Object.freeze(timing),
      });
      const anchors = getLineTimeAnchors(line);
      if (anchors[anchors.length - 1].pathDistance !== length) {
        throw new Error('GuidanceChart: v3 最后时间锚点必须覆盖完整路径');
      }
      return line;
    }
    if (!Number.isFinite((length / speed) * 1000) ||
        !Number.isFinite(spawnTimeMs + HEAD_WINDOW_MS + (length / speed) * 1000)) {
      throw new Error('GuidanceChart: 路径运行时间超出有限数值范围');
    }
    const head: HeadNode = Object.freeze({ id: headId, spawnTimeMs });
    const line: GuidanceLine = Object.freeze({
      id, head, path, speed, nodes: Object.freeze(nodes),
    });
    return line;
  });
  return Object.freeze({
    schemaVersion: source.schemaVersion,
    chartId,
    tier,
    layoutVersion: layout.layoutVersion,
    aspectRatio,
    lines: Object.freeze(lines),
  });
}
