// B 步混合单线状态与最终节点判定；逻辑层零 cc，表现只读取快照。
import { GOOD_WINDOW_MS, HEAD_WINDOW_MS } from '../../constants';
import type { ChartKeyId, KeyboardPadLayout } from './KeyboardPadLayout';
import { getSlot, resolveGridKeyAt } from './KeyboardPadLayout';
import type { Strike } from './Strike';
import type { ChartJudgeTier } from './ChartScore';
import { judgeTimeWindow } from './ChartScore';
import type {
  GuidanceChart, GuidanceLine, GuidanceNode, GuidancePosition, HeadNode, JudgmentPoint,
} from './GuidanceChart';
import {
  measurePathLength, parseGuidanceChart, positionAtPathDistance, slicePathByDistance,
} from './GuidanceChart';

export interface GuidanceJudgement {
  readonly nodeId: string;
  readonly videoTimeMs: number;
  readonly keyId: ChartKeyId | null;
  readonly tier: ChartJudgeTier;
  readonly consumed: true;
}

export type GuidanceLineState = 'Pending' | 'Waiting' | 'Running' | 'TimedOut' | 'Finished' | 'Exited';

export interface GuidanceNodeSnapshot {
  readonly node: GuidanceNode;
  readonly position: GuidancePosition;
  readonly tier: ChartJudgeTier | null;
  readonly resolvedAtMs: number | null;
  /** Hold 即使提前失败，也只能在完整区间尾端开始消失。 */
  readonly disappearAtMs: number | null;
  readonly holdActive: boolean;
  readonly holdRemainingPoints: readonly GuidancePosition[];
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

interface GuidanceNodeStatus {
  readonly node: GuidanceNode;
  tier: ChartJudgeTier | null;
  resolvedAtMs: number | null;
  holdStarted: boolean;
  holdInterrupted: boolean;
}

interface GuidanceArrival {
  readonly status: GuidanceNodeStatus;
  readonly timeMs: number;
  readonly distance: number;
  readonly kind: 'Arrival' | 'Tail' | 'TapTimeout';
}

function compareIdentity(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 单线 Polyline；公共生命周期及暂停闸门仍归 ChartPremiere。 */
export class GuidanceLineRuntime {
  private readonly line: GuidanceLine;
  private readonly statuses: GuidanceNodeStatus[];
  private readonly aspectRatio: number;
  private readonly pathLength: number;
  private state: GuidanceLineState = 'Pending';
  private currentTimeMs = 0;
  private startedAtMs: number | null = null;
  private judgmentPoint: JudgmentPoint | null = null;
  private readonly keysDown = new Set<ChartKeyId>();

  constructor(data: GuidanceChart, private readonly layout: KeyboardPadLayout) {
    const chart = parseGuidanceChart(data, layout);
    this.line = chart.lines[0];
    this.statuses = this.line.nodes.map(node => ({
      node, tier: null, resolvedAtMs: null, holdStarted: false, holdInterrupted: false,
    }));
    this.aspectRatio = chart.aspectRatio;
    this.pathLength = measurePathLength(this.line.path, this.aspectRatio);
  }

  advance(timeMs: number): readonly GuidanceJudgement[] {
    return this.advanceTimeline(timeMs, true);
  }

  submitStrike(strike: Strike): readonly GuidanceJudgement[] {
    const timeMs = strike.videoTimeMs;
    const keyId = strike.keyId;
    if (!Number.isFinite(timeMs) || timeMs < 0 || keyId === undefined ||
        getSlot(this.layout, keyId) === undefined || this.state === 'Exited') {
      return [];
    }
    // 先处理严格早于边沿的到达事件，再应用边沿，最后处理同一时间的事件。
    // Down 恰在起点有效；Drag 的 Up 恰在到达时无按住状态。
    const judgements = [...this.advanceTimeline(timeMs, false)];
    if (strike.phase === 'Up') {
      // Hold 恰在尾端松开有效：尾端结算先于同时间 Up。
      for (const status of this.statuses) {
        if (status.node.kind === 'Hold' && status.holdStarted && status.tier === null &&
            this.getTimeAtDistance(status.node.endPathDistance) === timeMs) {
          judgements.push(...this.resolveNode(status,
            !status.holdInterrupted && this.keysDown.has(status.node.keyId) ? 'Perfect' : 'Miss',
            timeMs, status.node.keyId));
        }
      }
      this.keysDown.delete(keyId);
      for (const status of this.statuses) {
        if (status.node.kind === 'Hold' && status.holdStarted && status.tier === null &&
            status.node.keyId === keyId && timeMs < this.getTimeAtDistance(status.node.endPathDistance)) {
          // 失败不可补救；Hold 判定对象仍持续至尾端，避免早媒体结束时提前回收起点。
          status.holdInterrupted = true;
        }
      }
      judgements.push(...this.advanceTimeline(timeMs, true));
      this.finishIfReady();
      return Object.freeze(judgements);
    }
    const repeated = this.keysDown.has(keyId);
    this.keysDown.add(keyId);
    if (keyId === 'Space') {
      if (!repeated && (this.state === 'Pending' || this.state === 'Waiting') &&
          timeMs >= this.line.head.spawnTimeMs && timeMs <= this.line.head.spawnTimeMs + HEAD_WINDOW_MS) {
        this.startedAtMs = timeMs;
        this.state = 'Running';
      }
      judgements.push(...this.advanceTimeline(timeMs, true));
      return Object.freeze(judgements);
    }
    judgements.push(...this.advanceTimeline(timeMs, true));
    if (repeated || this.state !== 'Running' || this.startedAtMs === null || timeMs < this.startedAtMs) {
      return Object.freeze(judgements);
    }
    const position = positionAtPathDistance(this.line.path, this.aspectRatio,
      this.line.speed * (timeMs - this.startedAtMs) / 1000);
    const requiredKeyId = resolveGridKeyAt(this.layout, position);
    if (requiredKeyId === null || keyId !== requiredKeyId) { return Object.freeze(judgements); }
    // 一次新的 Down 只消费一个 Tap；Drag/Hold 按到达时间自主检查按住状态。
    const candidates = this.statuses.filter(status => status.node.kind === 'Tap' && status.tier === null)
      .map(status => ({ status, targetTimeMs: this.getTimeAtDistance(status.node.pathDistance),
        lineId: this.line.id, nodeId: status.node.id }))
      .filter(item => Math.abs(timeMs - item.targetTimeMs) <= GOOD_WINDOW_MS)
      .sort((a, b) => Math.abs(timeMs - a.targetTimeMs) - Math.abs(timeMs - b.targetTimeMs) ||
        a.targetTimeMs - b.targetTimeMs || compareIdentity(a.lineId, b.lineId) ||
        compareIdentity(a.nodeId, b.nodeId));
    if (candidates.length > 0) {
      const candidate = candidates[0];
      judgements.push(...this.resolveNode(candidate.status,
        judgeTimeWindow(timeMs, candidate.targetTimeMs), timeMs, requiredKeyId));
    }
    this.finishIfReady();
    return Object.freeze(judgements);
  }

  /** 暂停期间只记录释放；判定和计时冻结，中断后的 Hold 仍在尾端一次性记 Miss。 */
  releaseWhilePaused(strike: Strike): void {
    if (strike.phase !== 'Up' || strike.keyId === undefined || this.state === 'Exited') { return; }
    const keyId = strike.keyId;
    this.keysDown.delete(keyId);
    for (const status of this.statuses) {
      if (status.node.kind === 'Hold' && status.holdStarted && status.tier === null &&
          status.node.keyId === keyId) { status.holdInterrupted = true; }
    }
  }

  reset(): void {
    this.state = 'Pending';
    this.currentTimeMs = 0;
    this.startedAtMs = null;
    this.judgmentPoint = null;
    this.keysDown.clear();
    for (const status of this.statuses) {
      status.tier = null;
      status.resolvedAtMs = null;
      status.holdStarted = false;
      status.holdInterrupted = false;
    }
  }

  exit(): void {
    this.state = 'Exited';
    this.keysDown.clear();
    this.judgmentPoint = null;
  }

  getTotalNodeCount(): number { return this.statuses.length; }

  getResolvedCount(): number {
    return this.statuses.filter(status => status.tier !== null).length;
  }

  isSettled(): boolean { return this.statuses.every(status => status.tier !== null); }

  getSnapshot(): GuidanceLineSnapshot {
    const nodes: readonly GuidanceNodeSnapshot[] = Object.freeze(this.statuses.map(status => {
      const node = status.node;
      const holdActive = node.kind === 'Hold' && this.startedAtMs !== null &&
        this.currentTimeMs >= this.getTimeAtDistance(node.pathDistance) &&
        this.currentTimeMs < this.getTimeAtDistance(node.endPathDistance) && this.state === 'Running';
      const disappearAtMs = status.tier === null ? null : node.kind === 'Hold' && this.startedAtMs !== null
        ? this.getTimeAtDistance(node.endPathDistance) : status.resolvedAtMs;
      const holdRemainingPoints = holdActive && node.kind === 'Hold' && this.judgmentPoint !== null
        ? slicePathByDistance(this.line.path, this.aspectRatio,
          Math.max(node.pathDistance, this.judgmentPoint.pathDistance), node.endPathDistance)
        : Object.freeze([]);
      return Object.freeze({ node,
        position: positionAtPathDistance(this.line.path, this.aspectRatio, node.pathDistance),
        tier: status.tier, resolvedAtMs: status.resolvedAtMs,
        disappearAtMs, holdActive, holdRemainingPoints,
      });
    }));
    let remainingPoints: readonly GuidancePosition[] = this.line.path.points;
    if (this.state === 'Exited' || this.state === 'TimedOut' || this.state === 'Finished') {
      remainingPoints = Object.freeze([]);
    } else if (this.judgmentPoint !== null) {
      remainingPoints = this.judgmentPoint.pathDistance >= this.pathLength ? Object.freeze([])
        : slicePathByDistance(this.line.path, this.aspectRatio, this.judgmentPoint.pathDistance);
    }
    return Object.freeze({ id: this.line.id, state: this.state, head: this.line.head,
      startedAtMs: this.startedAtMs, judgmentPoint: this.judgmentPoint, remainingPoints, nodes });
  }

  private advanceTimeline(timeMs: number, includeEqual: boolean): readonly GuidanceJudgement[] {
    if (!Number.isFinite(timeMs) || timeMs < this.currentTimeMs || this.state === 'Exited') { return []; }
    this.currentTimeMs = timeMs;
    if (this.state === 'Pending' && timeMs >= this.line.head.spawnTimeMs) { this.state = 'Waiting'; }
    if (this.state === 'Waiting' && timeMs > this.line.head.spawnTimeMs + HEAD_WINDOW_MS) {
      this.state = 'TimedOut';
      return Object.freeze(this.statuses.flatMap(status => this.resolveNode(status, 'Miss', timeMs, null)));
    }
    if (this.state !== 'Running' || this.startedAtMs === null) { return []; }
    const judgements: GuidanceJudgement[] = [];
    const events: GuidanceArrival[] = [];
    for (const status of this.statuses) {
      const node = status.node;
      if (status.tier !== null) { continue; }
      if (node.kind === 'Tap') {
        events.push({ status, timeMs: this.getTimeAtDistance(node.pathDistance) + GOOD_WINDOW_MS,
          distance: node.pathDistance, kind: 'TapTimeout' });
      } else if (node.kind === 'Drag' || !status.holdStarted) {
        events.push({ status, timeMs: this.getTimeAtDistance(node.pathDistance),
          distance: node.pathDistance, kind: 'Arrival' });
      }
      if (node.kind === 'Hold') {
        events.push({ status, timeMs: this.getTimeAtDistance(node.endPathDistance),
          distance: node.endPathDistance, kind: 'Tail' });
      }
    }
    events.sort((a, b) => a.timeMs - b.timeMs || a.distance - b.distance ||
      (a.kind === 'Tail' ? 0 : 1) - (b.kind === 'Tail' ? 0 : 1) ||
      compareIdentity(a.status.node.id, b.status.node.id));
    for (const event of events) {
      const { status } = event;
      const node = status.node;
      if (status.tier !== null || (event.kind === 'TapTimeout' ? event.timeMs >= timeMs :
        event.timeMs > timeMs || (!includeEqual && event.timeMs === timeMs))) { continue; }
      if (event.kind === 'TapTimeout') {
        judgements.push(...this.resolveNode(status, 'Miss', event.timeMs, null));
      } else if (event.kind === 'Tail' && node.kind === 'Hold') {
        judgements.push(...this.resolveNode(status,
          status.holdStarted && !status.holdInterrupted && this.keysDown.has(node.keyId) ? 'Perfect' : 'Miss',
          event.timeMs, node.keyId));
      } else if (node.kind === 'Drag') {
        judgements.push(...this.resolveNode(status,
          this.keysDown.has(node.keyId) ? 'Perfect' : 'Miss', event.timeMs, node.keyId));
      } else if (node.kind === 'Hold') {
        status.holdStarted = true;
        if (!this.keysDown.has(node.keyId)) {
          status.holdInterrupted = true;
        }
      }
    }
    this.updateJudgmentPoint(timeMs);
    this.finishIfReady();
    return Object.freeze(judgements);
  }

  private getTimeAtDistance(distance: number): number {
    return this.startedAtMs! + distance / this.line.speed * 1000;
  }

  private updateJudgmentPoint(timeMs: number): void {
    const pathDistance = Math.max(0, Math.min(this.pathLength,
      this.line.speed * (timeMs - this.startedAtMs!) / 1000));
    this.judgmentPoint = Object.freeze({
      position: positionAtPathDistance(this.line.path, this.aspectRatio, pathDistance), pathDistance,
    });
  }

  private finishIfReady(): void {
    if (this.state === 'Running' && this.isSettled() && this.judgmentPoint !== null &&
        this.judgmentPoint.pathDistance >= this.pathLength) { this.state = 'Finished'; }
  }

  private resolveNode(status: GuidanceNodeStatus, tier: ChartJudgeTier,
    videoTimeMs: number, keyId: ChartKeyId | null): readonly GuidanceJudgement[] {
    if (status.tier !== null) { return []; }
    status.tier = tier;
    status.resolvedAtMs = videoTimeMs;
    return Object.freeze([Object.freeze({ nodeId: status.node.id, videoTimeMs, keyId, tier, consumed: true })]);
  }
}
