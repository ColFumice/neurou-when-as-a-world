// 多线协调器：统一媒体时间，Head/Tap 仲裁，按住边沿与生命周期广播。
import { HEAD_WINDOW_MS } from '../../constants';
import type { GuidanceChart } from './GuidanceChart';
import { parseGuidanceChart } from './GuidanceChart';
import type { KeyboardPadLayout } from './KeyboardPadLayout';
import { getSlot } from './KeyboardPadLayout';
import type { Strike } from './Strike';
import { GuidanceLineRuntime } from './GuidanceLineRuntime';
import type { GuidanceJudgement, GuidanceLineSnapshot } from './GuidanceLineRuntime';

const compareIdentity = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export class GuidanceChartRuntime {
  private readonly lines: readonly GuidanceLineRuntime[];
  private currentTimeMs = 0;

  constructor(data: GuidanceChart, private readonly layout: KeyboardPadLayout) {
    const chart = parseGuidanceChart(data, layout);
    this.lines = chart.lines.map(line => new GuidanceLineRuntime(chart, layout, line.id));
  }

  advance(timeMs: number): readonly GuidanceJudgement[] {
    if (!Number.isFinite(timeMs) || timeMs < this.currentTimeMs) { return []; }
    this.currentTimeMs = timeMs;
    return Object.freeze(this.lines.flatMap(line => line.advance(timeMs)));
  }

  submitStrike(strike: Strike): readonly GuidanceJudgement[] {
    const timeMs = strike.videoTimeMs;
    if (!Number.isFinite(timeMs) || timeMs < this.currentTimeMs || strike.keyId === undefined ||
        (strike.keyId !== 'Space' && getSlot(this.layout, strike.keyId) === undefined)) { return []; }
    this.currentTimeMs = timeMs;
    const heads = this.lines.map(line => ({ line, snapshot: line.getSnapshot() }))
      .filter(item => (item.snapshot.state === 'Pending' || item.snapshot.state === 'Waiting') &&
        timeMs >= item.snapshot.head.spawnTimeMs && timeMs <= item.snapshot.head.spawnTimeMs + HEAD_WINDOW_MS)
      .sort((a, b) => a.snapshot.head.spawnTimeMs - b.snapshot.head.spawnTimeMs ||
        compareIdentity(a.snapshot.id, b.snapshot.id) || compareIdentity(a.snapshot.head.id, b.snapshot.head.id));
    const taps = this.lines.map(line => ({ line, candidate: line.getTapCandidate(strike), id: line.getSnapshot().id }))
      .filter((item): item is typeof item & { candidate: NonNullable<typeof item.candidate> } => item.candidate !== null)
      .sort((a, b) => Math.abs(timeMs - a.candidate.targetTimeMs) - Math.abs(timeMs - b.candidate.targetTimeMs) ||
        a.candidate.targetTimeMs - b.candidate.targetTimeMs || compareIdentity(a.id, b.id) ||
        compareIdentity(a.candidate.nodeId, b.candidate.nodeId));
    return Object.freeze(this.lines.flatMap(line => line.submitStrike(strike,
      line === taps[0]?.line, line === heads[0]?.line)));
  }

  releaseWhilePaused(strike: Strike): void { this.lines.forEach(line => line.releaseWhilePaused(strike)); }
  reset(): void { this.currentTimeMs = 0; this.lines.forEach(line => line.reset()); }
  exit(): void { this.lines.forEach(line => line.exit()); }
  getTotalNodeCount(): number { return this.lines.reduce((count, line) => count + line.getTotalNodeCount(), 0); }
  getResolvedCount(): number { return this.lines.reduce((count, line) => count + line.getResolvedCount(), 0); }
  isSettled(): boolean { return this.lines.every(line => line.isSettled()); }
  getGuidanceSnapshots(): readonly GuidanceLineSnapshot[] {
    return Object.freeze(this.lines.map(line => line.getSnapshot()));
  }
}
