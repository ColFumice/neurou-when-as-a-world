import { FRAME_ALIGNED_WINDOW_MS } from '../../../core/constants';
import type { FrameAlignedStrike } from '../../../core/trace/strike';
import {
  VisibilityState,
  VisibilityTransitionReason,
} from '../../../core/trace/visibility';
import type { TraceTier, TraceOrigin } from '../../../core/trace/types';
import {
  FrameTracking,
  VisualFrame,
  VisualFrameTargetLock,
} from '../../../core/world/frame';
import type { FrameTarget, VisualFrameRect } from '../../../core/world/frame';
import type { GameTracePlacement } from './stageData';

export interface TraceRuntimeEvent {
  readonly kind: 'Revealed' | 'Concealed' | 'Touched';
  readonly traceId: string;
  readonly atMs: number;
  readonly reason: VisibilityTransitionReason;
  readonly touchCount: number;
}

export interface TraceEventSink {
  emit(event: TraceRuntimeEvent): void;
}

export interface TraceView {
  readonly traceId: string;
  readonly tier: TraceTier;
  readonly origin: TraceOrigin;
  readonly beatTimeMs: number;
  readonly rect: VisualFrameRect;
  readonly layerIndex: number;
  readonly parallaxFactor: number;
  readonly label: string;
  readonly visibility: VisibilityState;
  readonly lastReason: VisibilityTransitionReason | null;
  readonly tracking: FrameTracking;
  readonly lock: VisualFrameTargetLock;
  readonly touchCount: number;
  readonly lastTouchedAtMs: number | null;
}

export interface FrameAlignedResult {
  readonly traceId: string | null;
  readonly strike: FrameAlignedStrike;
  readonly offsetMs: number | null;
}

interface RuntimeTrace {
  readonly placement: GameTracePlacement;
  visibility: VisibilityState;
  lastReason: VisibilityTransitionReason | null;
  tracking: FrameTracking;
  lock: VisualFrameTargetLock;
  touchCount: number;
  lastTouchedAtMs: number | null;
}

const EMPTY_SINK: TraceEventSink = { emit: () => undefined };

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function frameRect(value: VisualFrameRect, label: string): VisualFrameRect {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)
    || !Number.isFinite(value.width) || !Number.isFinite(value.height)
    || value.width <= 0 || value.height <= 0) {
    throw new RangeError(`${label} must be a positive finite rect`);
  }
  return value;
}

function targetOf(placement: GameTracePlacement): FrameTarget {
  return {
    kind: 'Trace',
    targetId: placement.traceId,
    screenRect: placement.rect,
  };
}

function center(rect: VisualFrameRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function distanceToFrame(frameRectValue: VisualFrameRect, traceRect: VisualFrameRect): number {
  const frameCenter = center(frameRectValue);
  const traceCenter = center(traceRect);
  return Math.hypot(traceCenter.x - frameCenter.x, traceCenter.y - frameCenter.y);
}

/**
 * X · game / trace runtime。
 *
 * 纯 TS 状态机：不依赖 React / DOM / Tauri / 第二个时钟。
 * - strike：只在“框内 + beat 窗口内”时 Revealed；
 * - advanceTo：框丢失时 FrameLost → Concealed；
 * - 同拍多 trace 只选一个（偏移最小，其次中心最近）。
 */
export class TraceRuntime {
  private readonly states: RuntimeTrace[];
  private readonly sink: TraceEventSink;
  private primaryId: string | null = null;
  private perceptionActive = false;

  constructor(
    traces: readonly GameTracePlacement[],
    sink: TraceEventSink = EMPTY_SINK,
  ) {
    this.states = traces.map((placement) => ({
      placement,
      visibility: VisibilityState.Concealed,
      lastReason: null,
      tracking: FrameTracking.Idle,
      lock: VisualFrameTargetLock.Unlocked,
      touchCount: 0,
      lastTouchedAtMs: null,
    }));
    this.sink = sink;
  }

  get views(): readonly TraceView[] {
    return this.states.map((state) => ({
      traceId: state.placement.traceId,
      tier: state.placement.tier,
      origin: state.placement.origin,
      beatTimeMs: state.placement.beatTimeMs,
      rect: state.placement.rect,
      layerIndex: state.placement.layerIndex,
      parallaxFactor: state.placement.parallaxFactor,
      label: state.placement.label,
      visibility: state.visibility,
      lastReason: state.lastReason,
      tracking: state.tracking,
      lock: state.lock,
      touchCount: state.touchCount,
      lastTouchedAtMs: state.lastTouchedAtMs,
    }));
  }

  get primaryTracking(): FrameTracking {
    return this.primaryState()?.tracking ?? FrameTracking.Idle;
  }

  get primaryLock(): VisualFrameTargetLock {
    return this.primaryState()?.lock ?? VisualFrameTargetLock.Unlocked;
  }

  get activePerception(): boolean {
    return this.perceptionActive;
  }

  advanceTo(nowMs: number, frameRectValue: VisualFrameRect): void {
    finite(nowMs, 'TraceRuntime.advanceTo.nowMs');
    frameRect(frameRectValue, 'TraceRuntime.advanceTo.frameRect');

    let best: RuntimeTrace | null = null;
    let bestRevealed = false;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const state of this.states) {
      const target = targetOf(state.placement);
      const inside = VisualFrame.isTargetInsideFrame(frameRectValue, target);
      // 已 Concealed 的 trace 不再保留 Locked 跟踪；避免 ExitPerception 后
      // 下一帧把“框内”误算成 Locked。
      const previous = state.visibility === VisibilityState.Revealed
        ? state.tracking
        : state.tracking === FrameTracking.Locked
          ? FrameTracking.Tracking
          : state.tracking;
      state.tracking = VisualFrame.computeFrameTracking(frameRectValue, target, previous);

      if (!inside && state.visibility === VisibilityState.Revealed) {
        state.visibility = VisibilityState.Concealed;
        state.lastReason = VisibilityTransitionReason.FrameLost;
        state.lock = VisualFrameTargetLock.Unlocked;
        this.sink.emit({
          kind: 'Concealed',
          traceId: state.placement.traceId,
          atMs: nowMs,
          reason: VisibilityTransitionReason.FrameLost,
          touchCount: state.touchCount,
        });
      } else if (inside && state.visibility === VisibilityState.Revealed) {
        state.lock = VisualFrameTargetLock.Locked;
      } else if (!inside) {
        state.lock = VisualFrameTargetLock.Unlocked;
      }

      if (!inside) continue;
      const revealed = state.visibility === VisibilityState.Revealed;
      const distance = distanceToFrame(frameRectValue, state.placement.rect);
      if ((revealed && !bestRevealed)
        || (revealed === bestRevealed && distance < bestDistance)) {
        best = state;
        bestRevealed = revealed;
        bestDistance = distance;
      }
    }

    if (best) this.primaryId = best.placement.traceId;
  }

  /**
   * Shift+Enter 的落点。只返回判定结果与事件；不调用 ChartSnapshot。
   * aligned 为 true 当且仅当目标中心在框内且 beat 偏移 <= 100ms。
   */
  strike(nowMs: number, frameRectValue: VisualFrameRect): FrameAlignedResult {
    finite(nowMs, 'TraceRuntime.strike.nowMs');
    frameRect(frameRectValue, 'TraceRuntime.strike.frameRect');

    const candidates: {
      readonly state: RuntimeTrace;
      readonly offsetMs: number;
      readonly distance: number;
      readonly index: number;
    }[] = [];
    this.states.forEach((state, index) => {
      const offsetMs = nowMs - state.placement.beatTimeMs;
      const lock = VisualFrame.computeTargetLock(
        frameRectValue,
        targetOf(state.placement),
        FRAME_ALIGNED_WINDOW_MS,
        Math.abs(offsetMs),
      );
      if (lock !== VisualFrameTargetLock.Locked) return;
      candidates.push({
        state,
        offsetMs,
        distance: distanceToFrame(frameRectValue, state.placement.rect),
        index,
      });
    });

    if (candidates.length === 0) {
      return {
        traceId: null,
        strike: { timeMs: nowMs, aligned: false, windowMs: FRAME_ALIGNED_WINDOW_MS },
        offsetMs: null,
      };
    }

    candidates.sort((left, right) => (
      Math.abs(left.offsetMs) - Math.abs(right.offsetMs)
      || left.distance - right.distance
      || left.index - right.index
    ));
    const chosen = candidates[0];
    if (!chosen) {
      return {
        traceId: null,
        strike: { timeMs: nowMs, aligned: false, windowMs: FRAME_ALIGNED_WINDOW_MS },
        offsetMs: null,
      };
    }

    const state = chosen.state;
    const wasRevealed = state.visibility === VisibilityState.Revealed;
    state.visibility = VisibilityState.Revealed;
    state.lastReason = VisibilityTransitionReason.FrameAligned;
    state.tracking = FrameTracking.Locked;
    state.lock = VisualFrameTargetLock.Locked;
    state.touchCount += 1;
    state.lastTouchedAtMs = nowMs;
    this.primaryId = state.placement.traceId;
    this.sink.emit({
      kind: wasRevealed ? 'Touched' : 'Revealed',
      traceId: state.placement.traceId,
      atMs: nowMs,
      reason: VisibilityTransitionReason.FrameAligned,
      touchCount: state.touchCount,
    });

    return {
      traceId: state.placement.traceId,
      strike: { timeMs: nowMs, aligned: true, windowMs: FRAME_ALIGNED_WINDOW_MS },
      offsetMs: chosen.offsetMs,
    };
  }

  /**
   * EnterPerception 按裁定不直接 Reveal；ExitPerception 只负责把当前
   * Revealed 痕恢复为 Concealed。
   */
  setPerception(active: boolean, nowMs: number): void {
    finite(nowMs, 'TraceRuntime.setPerception.nowMs');
    if (active) {
      this.perceptionActive = true;
      return;
    }
    this.perceptionActive = false;
    for (const state of this.states) {
      if (state.visibility !== VisibilityState.Revealed) continue;
      state.visibility = VisibilityState.Concealed;
      state.lastReason = VisibilityTransitionReason.ExitPerception;
      state.lock = VisualFrameTargetLock.Unlocked;
      if (state.tracking === FrameTracking.Locked) {
        state.tracking = FrameTracking.Tracking;
      }
      this.sink.emit({
        kind: 'Concealed',
        traceId: state.placement.traceId,
        atMs: nowMs,
        reason: VisibilityTransitionReason.ExitPerception,
        touchCount: state.touchCount,
      });
    }
  }

  reset(): void {
    for (const state of this.states) {
      state.visibility = VisibilityState.Concealed;
      state.lastReason = null;
      state.tracking = FrameTracking.Idle;
      state.lock = VisualFrameTargetLock.Unlocked;
      state.touchCount = 0;
      state.lastTouchedAtMs = null;
    }
    this.primaryId = null;
    this.perceptionActive = false;
  }

  private primaryState(): RuntimeTrace | null {
    if (this.primaryId === null) return null;
    return this.states.find((state) => (
      state.placement.traceId === this.primaryId
    )) ?? null;
  }
}
