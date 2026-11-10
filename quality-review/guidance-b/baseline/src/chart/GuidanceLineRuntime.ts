// A 步单线状态与最终节点判定；逻辑层零 cc，表现只读取快照。
import { GOOD_WINDOW_MS, HEAD_WINDOW_MS } from '../../constants';
import type { ChartKeyId, KeyboardPadLayout } from './KeyboardPadLayout';
import { getSlot, resolveGridKeyAt } from './KeyboardPadLayout';
import type { Strike } from './Strike';
import type { ChartJudgeTier } from './ChartScore';
import { judgeTimeWindow } from './ChartScore';
import type {
  GuidanceChart, GuidanceLine, GuidancePosition, HeadNode, TapNode, JudgmentPoint,
} from './GuidanceChart';
import { measurePathLength, parseGuidanceChart, positionAtPathDistance } from './GuidanceChart';

export interface GuidanceJudgement {
  readonly nodeId: string;
  readonly videoTimeMs: number;
  readonly keyId: ChartKeyId | null;
  readonly tier: ChartJudgeTier;
  readonly consumed: true;
}

export type GuidanceLineState = 'Pending' | 'Waiting' | 'Running' | 'TimedOut' | 'Finished' | 'Exited';

export interface GuidanceNodeSnapshot {
  readonly node: TapNode;
  readonly position: GuidancePosition;
  readonly tier: ChartJudgeTier | null;
  readonly resolvedAtMs: number | null;
}

export interface GuidanceLineSnapshot {
  readonly id: string;
  readonly state: GuidanceLineState;
  readonly head: HeadNode;
  readonly startedAtMs: number | null;
  readonly judgmentPoint: JudgmentPoint | null;
  readonly remainingPoints: readonly GuidancePosition[];
  readonly nodes: readonly GuidanceNodeSnapshot[];
}

/** 一条直线、一 Head、一 Tap；生命周期与暂停闸门由 ChartPremiere 负责。 */
export class GuidanceLineRuntime {
  private readonly line: GuidanceLine;
  private readonly node: TapNode;
  private readonly aspectRatio: number;
  private readonly pathLength: number;
  private state: GuidanceLineState = 'Pending';
  private currentTimeMs = 0;
  private startedAtMs: number | null = null;
  private judgmentPoint: JudgmentPoint | null = null;
  private nodeTier: ChartJudgeTier | null = null;
  private nodeResolvedAtMs: number | null = null;
  private readonly keysDown = new Set<ChartKeyId>();

  constructor(data: GuidanceChart, private readonly layout: KeyboardPadLayout) {
    const chart = parseGuidanceChart(data, layout);
    this.line = chart.lines[0];
    const node = this.line.nodes[0];
    if (node.kind !== 'Tap') {
      throw new Error(`GuidanceLineRuntime: A 步拒绝 ${node.kind}，仅接收 Tap`);
    }
    this.node = node;
    this.aspectRatio = chart.aspectRatio;
    this.pathLength = measurePathLength(this.line.path, this.aspectRatio);
  }

  advance(timeMs: number): readonly GuidanceJudgement[] {
    if (!Number.isFinite(timeMs) || timeMs < this.currentTimeMs || this.state === 'Exited') {
      return [];
    }
    this.currentTimeMs = timeMs;
    if (this.state === 'Pending' && timeMs >= this.line.head.spawnTimeMs) {
      this.state = 'Waiting';
    }
    if (this.state === 'Waiting' && timeMs > this.line.head.spawnTimeMs + HEAD_WINDOW_MS) {
      this.state = 'TimedOut';
      return this.resolveNode('Miss', timeMs, null);
    }
    if (this.state !== 'Running' || this.startedAtMs === null) {
      return [];
    }
    this.updateJudgmentPoint(timeMs);
    const targetTimeMs = this.getTargetTimeMs();
    const judgements = this.nodeTier === null && timeMs > targetTimeMs + GOOD_WINDOW_MS
      ? this.resolveNode('Miss', timeMs, null) : [];
    this.finishIfReady();
    return judgements;
  }

  submitStrike(strike: Strike): readonly GuidanceJudgement[] {
    const timeMs = strike.videoTimeMs;
    const keyId = strike.keyId;
    if (!Number.isFinite(timeMs) || timeMs < 0 || keyId === undefined ||
        getSlot(this.layout, keyId) === undefined || this.state === 'Exited') {
      return [];
    }
    if (strike.phase === 'Up') {
      this.keysDown.delete(keyId);
      return [];
    }
    // 输入先按自己的媒体时间处理；不会用下一渲染帧的位置替代输入位置。
    const judgements = this.advance(timeMs);
    if (this.keysDown.has(keyId)) {
      return judgements;
    }
    this.keysDown.add(keyId);
    if (keyId === 'Space') {
      if ((this.state === 'Pending' || this.state === 'Waiting') &&
          timeMs >= this.line.head.spawnTimeMs &&
          timeMs <= this.line.head.spawnTimeMs + HEAD_WINDOW_MS) {
        this.startedAtMs = timeMs;
        this.state = 'Running';
        this.updateJudgmentPoint(this.currentTimeMs);
      }
      return judgements;
    }
    if (this.state !== 'Running' || this.startedAtMs === null || this.nodeTier !== null) {
      return judgements;
    }
    const targetTimeMs = this.getTargetTimeMs();
    if (timeMs < this.startedAtMs || Math.abs(timeMs - targetTimeMs) > GOOD_WINDOW_MS) {
      return judgements;
    }
    const inputDistance = this.line.speed * (timeMs - this.startedAtMs) / 1000;
    const position = positionAtPathDistance(this.line.path, this.aspectRatio, inputDistance);
    const requiredKeyId = resolveGridKeyAt(this.layout, position);
    if (requiredKeyId === null || keyId !== requiredKeyId) {
      return judgements;
    }
    const finalJudgements = this.resolveNode(judgeTimeWindow(timeMs, targetTimeMs), timeMs, requiredKeyId);
    this.finishIfReady();
    return [...judgements, ...finalJudgements];
  }

  reset(): void {
    this.state = 'Pending';
    this.currentTimeMs = 0;
    this.startedAtMs = null;
    this.judgmentPoint = null;
    this.nodeTier = null;
    this.nodeResolvedAtMs = null;
    this.keysDown.clear();
  }

  exit(): void {
    this.state = 'Exited';
    this.keysDown.clear();
    this.judgmentPoint = null;
  }

  getResolvedCount(): number {
    return this.nodeTier === null ? 0 : 1;
  }

  isSettled(): boolean {
    return this.nodeTier !== null;
  }

  getSnapshot(): GuidanceLineSnapshot {
    const node = this.node;
    const nodes: readonly GuidanceNodeSnapshot[] = Object.freeze([Object.freeze({
      node,
      position: positionAtPathDistance(this.line.path, this.aspectRatio, node.pathDistance),
      tier: this.nodeTier,
      resolvedAtMs: this.nodeResolvedAtMs,
    })]);
    let remainingPoints: readonly GuidancePosition[] = this.line.path.points;
    if (this.state === 'Exited' || this.state === 'TimedOut' || this.state === 'Finished') {
      remainingPoints = Object.freeze([]);
    } else if (this.judgmentPoint !== null) {
      remainingPoints = this.judgmentPoint.pathDistance >= this.pathLength
        ? Object.freeze([])
        : Object.freeze([this.judgmentPoint.position, this.line.path.points[1]]);
    }
    return Object.freeze({
      id: this.line.id,
      state: this.state,
      head: this.line.head,
      startedAtMs: this.startedAtMs,
      judgmentPoint: this.judgmentPoint,
      remainingPoints,
      nodes,
    });
  }

  private getTargetTimeMs(): number {
    return this.startedAtMs! + this.node.pathDistance / this.line.speed * 1000;
  }

  private updateJudgmentPoint(timeMs: number): void {
    const pathDistance = Math.max(0, Math.min(this.pathLength,
      this.line.speed * (timeMs - this.startedAtMs!) / 1000));
    this.judgmentPoint = Object.freeze({
      position: positionAtPathDistance(this.line.path, this.aspectRatio, pathDistance),
      pathDistance,
    });
  }

  private finishIfReady(): void {
    if (this.state === 'Running' && this.nodeTier !== null &&
        this.judgmentPoint !== null && this.judgmentPoint.pathDistance >= this.pathLength) {
      this.state = 'Finished';
    }
  }

  private resolveNode(
    tier: ChartJudgeTier,
    videoTimeMs: number,
    keyId: ChartKeyId | null,
  ): readonly GuidanceJudgement[] {
    if (this.nodeTier !== null) {
      return [];
    }
    this.nodeTier = tier;
    this.nodeResolvedAtMs = videoTimeMs;
    return Object.freeze([Object.freeze({
      nodeId: this.node.id,
      videoTimeMs,
      keyId,
      tier,
      consumed: true,
    })]);
  }
}
