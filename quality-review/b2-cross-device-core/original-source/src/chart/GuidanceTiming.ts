import type { GuidanceLine, GuidanceNode, TimedGuidanceLine } from './GuidanceChart';

export interface GuidanceTimeAnchor {
  readonly pathDistance: number;
  readonly targetTimeMs: number;
}

/** 时间升序、弧长非递减：支持原位重复音的停留段，不引入重合路径顶点。 */
export function getLineTimeAnchors(line: TimedGuidanceLine): readonly GuidanceTimeAnchor[] {
  const anchors: GuidanceTimeAnchor[] = [{ pathDistance: 0, targetTimeMs: line.head.targetTimeMs }];
  for (const item of line.timing) {
    const node = line.nodes.find(n => n.id === item.nodeId)!;
    anchors.push({ pathDistance: node.pathDistance, targetTimeMs: item.targetTimeMs });
    if (node.kind === 'Hold') {
      anchors.push({ pathDistance: node.endPathDistance, targetTimeMs: item.endTargetTimeMs! });
    }
  }
  anchors.sort((a, b) => a.targetTimeMs - b.targetTimeMs || a.pathDistance - b.pathDistance);
  for (let i = 1; i < anchors.length; i += 1) {
    if (anchors[i].pathDistance < anchors[i - 1].pathDistance ||
        (anchors[i].targetTimeMs === anchors[i - 1].targetTimeMs &&
          anchors[i].pathDistance !== anchors[i - 1].pathDistance)) {
      throw new Error('GuidanceChart: v3 时间锚点不能倒退，同刻只能对应同一距离');
    }
  }
  return Object.freeze(anchors.map(a => Object.freeze(a)));
}

export function guidanceDistanceAtTime(line: GuidanceLine | TimedGuidanceLine,
  startedAtMs: number, timeMs: number): number {
  if (!('timing' in line)) { return Math.max(0, line.speed * (timeMs - startedAtMs) / 1000); }
  const anchors = getLineTimeAnchors(line);
  if (timeMs <= anchors[0].targetTimeMs) { return 0; }
  for (let i = 1; i < anchors.length; i += 1) {
    const a = anchors[i - 1], b = anchors[i];
    if (timeMs <= b.targetTimeMs) {
      return b.targetTimeMs === a.targetTimeMs ? b.pathDistance : a.pathDistance +
        (b.pathDistance - a.pathDistance) * (timeMs - a.targetTimeMs) / (b.targetTimeMs - a.targetTimeMs);
    }
  }
  return anchors[anchors.length - 1].pathDistance;
}

export function guidanceNodeTime(line: GuidanceLine | TimedGuidanceLine,
  startedAtMs: number, node: GuidanceNode, tail = false): number {
  if ('timing' in line) {
    const item = line.timing.find(t => t.nodeId === node.id)!;
    return tail ? item.endTargetTimeMs! : item.targetTimeMs;
  }
  return startedAtMs + (tail && node.kind === 'Hold' ? node.endPathDistance : node.pathDistance) / line.speed * 1000;
}
