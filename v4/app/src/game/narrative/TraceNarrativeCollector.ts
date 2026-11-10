import { TraceOrigin, TraceTier } from '../../../../core/trace/types';
import { VisibilityTransitionReason } from '../../../../core/trace/visibility';
import type { TraceEventSink, TraceRuntimeEvent } from '../traceRuntime';
import type { GameTracePlacement } from '../stageData';

export interface TraceNarrativeStats {
  readonly tracesTotal: number;
  readonly tracesRevealed: number;
  readonly tracesTouched: number;
  readonly deepRevealed: number;
  readonly anomalousRevealed: number;
  readonly rainRevealed: number;
  readonly frameLost: number;
  readonly exitPerception: number;
}

/**
 * X · game / narrative。
 * 把 TraceRuntime 的逐痕事件聚合成一次首演的统计；不写账本。
 */
export class TraceNarrativeCollector implements TraceEventSink {
  private readonly placements = new Map<string, GameTracePlacement>();
  private readonly revealed = new Set<string>();
  private readonly touched = new Set<string>();
  private readonly frameLost = new Set<string>();
  private readonly deep = new Set<string>();
  private readonly anomalous = new Set<string>();
  private readonly rain = new Set<string>();
  private exitPerceptionCount = 0;
  private diagnosticValue: string | null = null;
  private readonly onDiagnostic: ((message: string) => void) | null;

  constructor(
    placements: readonly GameTracePlacement[],
    onDiagnostic?: (message: string) => void,
  ) {
    for (const placement of placements) {
      this.placements.set(placement.traceId, placement);
    }
    this.onDiagnostic = onDiagnostic ?? null;
  }

  get diagnostic(): string | null {
    return this.diagnosticValue;
  }

  emit(event: TraceRuntimeEvent): void {
    try {
      if (event.kind === 'Revealed') {
        if (this.revealed.has(event.traceId)) return;
        this.revealed.add(event.traceId);
        const placement = this.placements.get(event.traceId);
        if (placement?.tier === TraceTier.Deep) this.deep.add(event.traceId);
        if (placement?.tier === TraceTier.Rain) this.rain.add(event.traceId);
        if (placement?.origin === TraceOrigin.Anomalous) this.anomalous.add(event.traceId);
        return;
      }
      if (event.kind === 'Touched') {
        this.touched.add(event.traceId);
        return;
      }
      if (event.kind === 'Concealed' && event.reason === VisibilityTransitionReason.FrameLost) {
        this.frameLost.add(event.traceId);
        return;
      }
      if (event.kind === 'Concealed'
        && event.reason === VisibilityTransitionReason.ExitPerception) {
        this.exitPerceptionCount += 1;
      }
    } catch (error) {
      this.report(error);
    }
  }

  snapshot(): TraceNarrativeStats {
    return {
      tracesTotal: this.placements.size,
      tracesRevealed: this.revealed.size,
      tracesTouched: this.touched.size,
      deepRevealed: this.deep.size,
      anomalousRevealed: this.anomalous.size,
      rainRevealed: this.rain.size,
      frameLost: this.frameLost.size,
      exitPerception: this.exitPerceptionCount,
    };
  }

  reset(): void {
    this.revealed.clear();
    this.touched.clear();
    this.frameLost.clear();
    this.deep.clear();
    this.anomalous.clear();
    this.rain.clear();
    this.exitPerceptionCount = 0;
    this.diagnosticValue = null;
  }

  private report(error: unknown): void {
    const message = `Trace 采集异常（已隔离）：${error instanceof Error ? error.message : String(error)}`;
    this.diagnosticValue = message;
    if (!this.onDiagnostic) return;
    try {
      this.onDiagnostic(message);
    } catch {
      // HUD callback must not break trace runtime.
    }
  }
}
