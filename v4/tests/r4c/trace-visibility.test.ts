import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VisibilityState,
  VisibilityTransitionReason,
} from '../../core/trace/visibility';
import { TraceOrigin, TraceTier } from '../../core/trace/types';
import {
  FrameTracking,
  VisualFrameTargetLock,
} from '../../core/world/frame';
import type { VisualFrameRect } from '../../core/world/frame';
import { TraceRuntime } from '../../app/src/game/traceRuntime';
import type {
  TraceRuntimeEvent,
  TraceEventSink,
} from '../../app/src/game/traceRuntime';
import type { GameTracePlacement } from '../../app/src/game/stageData';

const FULL: VisualFrameRect = { x: 0, y: 0, width: 1, height: 1 };
const OUTSIDE: VisualFrameRect = { x: 0, y: 0, width: 0.1, height: 0.1 };

function placement(overrides: Partial<GameTracePlacement> = {}): GameTracePlacement {
  return {
    traceId: 'trace-1',
    tier: TraceTier.Common,
    origin: TraceOrigin.Normal,
    beatTimeMs: 1000,
    rect: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    layerIndex: 1,
    parallaxFactor: 1,
    label: 'trace',
    ...overrides,
  };
}

function sink(): { readonly sink: TraceEventSink; readonly events: TraceRuntimeEvent[] } {
  const events: TraceRuntimeEvent[] = [];
  return { sink: { emit: (event) => events.push(event) }, events };
}

describe('R4c TraceRuntime 可见性状态机', () => {
  test('100ms 边界：±100 命中，±101 不命中', () => {
    for (const at of [900, 1100]) {
      const runtime = new TraceRuntime([placement()]);
      const result = runtime.strike(at, FULL);
      assert.equal(result.strike.aligned, true, `at=${at}`);
      assert.equal(result.strike.windowMs, 100);
      assert.equal(runtime.views[0]?.visibility, VisibilityState.Revealed);
      assert.equal(runtime.views[0]?.lastReason, VisibilityTransitionReason.FrameAligned);
    }
    for (const at of [899, 1101]) {
      const runtime = new TraceRuntime([placement()]);
      const result = runtime.strike(at, FULL);
      assert.equal(result.strike.aligned, false, `at=${at}`);
      assert.equal(result.traceId, null);
      assert.equal(runtime.views[0]?.visibility, VisibilityState.Concealed);
    }
  });

  test('框外击打不 Reveal，框内未到节拍也不 Reveal', () => {
    const outside = new TraceRuntime([placement()]);
    assert.equal(outside.strike(1000, OUTSIDE).strike.aligned, false);
    assert.equal(outside.views[0]?.visibility, VisibilityState.Concealed);

    const offBeat = new TraceRuntime([placement()]);
    assert.equal(offBeat.strike(1200, FULL).strike.aligned, false);
    assert.equal(offBeat.views[0]?.visibility, VisibilityState.Concealed);
  });

  test('FrameLost：目标出框后 Revealed → Concealed', () => {
    const capture = sink();
    const runtime = new TraceRuntime([placement()], capture.sink);
    assert.equal(runtime.strike(1000, FULL).strike.aligned, true);
    assert.equal(runtime.views[0]?.lock, VisualFrameTargetLock.Locked);
    assert.equal(runtime.primaryTracking, FrameTracking.Locked);

    runtime.advanceTo(1100, OUTSIDE);
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Concealed);
    assert.equal(runtime.views[0]?.lastReason, VisibilityTransitionReason.FrameLost);
    assert.equal(runtime.views[0]?.lock, VisualFrameTargetLock.Unlocked);
    assert.equal(runtime.primaryTracking, FrameTracking.Lost);
    assert.equal(capture.events.at(-1)?.kind, 'Concealed');
    assert.equal(capture.events.at(-1)?.reason, VisibilityTransitionReason.FrameLost);
  });

  test('多目标同框：同拍只 Reveal 一个，选 beat 偏移最小', () => {
    const runtime = new TraceRuntime([
      placement({ traceId: 'near', beatTimeMs: 1000 }),
      placement({
        traceId: 'other',
        beatTimeMs: 1005,
        rect: { x: 0.45, y: 0.45, width: 0.2, height: 0.2 },
      }),
    ]);
    const result = runtime.strike(1003, FULL);
    assert.equal(result.strike.aligned, true);
    assert.equal(result.traceId, 'other');
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Concealed);
    assert.equal(runtime.views[1]?.visibility, VisibilityState.Revealed);
    assert.equal(runtime.views.filter((view) => view.visibility === VisibilityState.Revealed).length, 1);
  });

  test('同 beat 多目标：选中心更近的一个', () => {
    const runtime = new TraceRuntime([
      placement({ traceId: 'far', rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      placement({ traceId: 'close', rect: { x: 0.49, y: 0.49, width: 0.02, height: 0.02 } }),
    ]);
    const result = runtime.strike(1000, FULL);
    assert.equal(result.traceId, 'close');
    assert.equal(runtime.views[1]?.visibility, VisibilityState.Revealed);
  });

  test('重复命中只增 touch，不重复 Reveal 事件', () => {
    const capture = sink();
    const runtime = new TraceRuntime([placement()], capture.sink);
    runtime.strike(1000, FULL);
    runtime.strike(1000, FULL);
    assert.equal(runtime.views[0]?.touchCount, 2);
    assert.deepEqual(capture.events.map((event) => event.kind), ['Revealed', 'Touched']);
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Revealed);
  });

  test('advanceTo 只做 tracking/lock；框内未击打不 Reveal', () => {
    const runtime = new TraceRuntime([placement()]);
    runtime.advanceTo(500, FULL);
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Concealed);
    assert.equal(runtime.views[0]?.tracking, FrameTracking.Tracking);
    assert.equal(runtime.views[0]?.lock, VisualFrameTargetLock.Unlocked);
    assert.equal(runtime.primaryTracking, FrameTracking.Tracking);
  });

  test('reset：清空可见性、lock、touch 与 primary', () => {
    const runtime = new TraceRuntime([placement()]);
    runtime.strike(1000, FULL);
    runtime.reset();
    const view = runtime.views[0];
    assert.equal(view?.visibility, VisibilityState.Concealed);
    assert.equal(view?.lastReason, null);
    assert.equal(view?.tracking, FrameTracking.Idle);
    assert.equal(view?.lock, VisualFrameTargetLock.Unlocked);
    assert.equal(view?.touchCount, 0);
    assert.equal(view?.lastTouchedAtMs, null);
    assert.equal(runtime.primaryTracking, FrameTracking.Idle);
    assert.equal(runtime.primaryLock, VisualFrameTargetLock.Unlocked);
  });

  test('EnterPerception 不直接 Reveal；ExitPerception 恢复 Concealed', () => {
    const runtime = new TraceRuntime([placement()]);
    runtime.strike(1000, FULL);
    runtime.setPerception(true, 1100);
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Revealed);
    assert.equal(runtime.activePerception, true);
    runtime.setPerception(false, 1200);
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Concealed);
    assert.equal(runtime.views[0]?.lastReason, VisibilityTransitionReason.ExitPerception);
    assert.equal(runtime.activePerception, false);

    const concealed = new TraceRuntime([placement()]);
    concealed.setPerception(true, 1100);
    assert.equal(concealed.views[0]?.visibility, VisibilityState.Concealed);
  });
});
