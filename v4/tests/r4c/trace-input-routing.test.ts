import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TraceOrigin, TraceTier } from '../../core/trace/types';
import { VisibilityState } from '../../core/trace/visibility';
import {
  EMPTY_FRAME_HELD,
  FrameController,
  routeFrameInput,
} from '../../app/src/game/frameController';
import type { FrameInputContext } from '../../app/src/game/frameController';
import { TraceRuntime } from '../../app/src/game/traceRuntime';
import type { GameTracePlacement } from '../../app/src/game/stageData';

function context(overrides: Partial<FrameInputContext> = {}): FrameInputContext {
  return {
    code: 'KeyX',
    shiftKey: false,
    phase: 'playing',
    commandOpen: false,
    hasTraces: true,
    ...overrides,
  };
}

function placement(): GameTracePlacement {
  return {
    traceId: 'trace-1',
    tier: TraceTier.Common,
    origin: TraceOrigin.Normal,
    beatTimeMs: 1000,
    rect: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    layerIndex: 1,
    parallaxFactor: 1,
    label: 'trace',
  };
}

describe('R4c Frame input routing', () => {
  test('Shift + 四个方向键 → frame-move', () => {
    const cases = [
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
    ] as const;
    for (const [code, direction] of cases) {
      const route = routeFrameInput(context({ code, shiftKey: true }));
      assert.deepEqual(route, { kind: 'frame-move', direction });
    }
  });

  test('Shift + Enter → frame-strike', () => {
    const route = routeFrameInput(context({ code: 'Enter', shiftKey: true }));
    assert.deepEqual(route, { kind: 'frame-strike' });
  });

  test('其他键 → r4a', () => {
    assert.deepEqual(
      routeFrameInput(context({ code: 'KeyX', shiftKey: true })),
      { kind: 'r4a' },
    );
    assert.deepEqual(
      routeFrameInput(context({ code: 'ArrowLeft', shiftKey: false })),
      { kind: 'r4a' },
    );
    assert.deepEqual(
      routeFrameInput(context({ code: 'Enter', shiftKey: false })),
      { kind: 'r4a' },
    );
    assert.deepEqual(
      routeFrameInput(context({ code: 'KeyQ', shiftKey: false })),
      { kind: 'r4a' },
    );
  });

  test('无 trace 时所有键走原路径', () => {
    for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'KeyX']) {
      assert.deepEqual(
        routeFrameInput(context({ code, shiftKey: true, hasTraces: false })),
        { kind: 'r4a' },
        code,
      );
    }
  });

  test('非 playing / commandOpen 时回到 r4a', () => {
    assert.deepEqual(
      routeFrameInput(context({ code: 'ArrowLeft', shiftKey: true, phase: 'paused' })),
      { kind: 'r4a' },
    );
    assert.deepEqual(
      routeFrameInput(context({ code: 'Enter', shiftKey: true, commandOpen: true })),
      { kind: 'r4a' },
    );
  });

  test('Shift 本身忽略', () => {
    for (const code of ['ShiftLeft', 'ShiftRight']) {
      assert.deepEqual(
        routeFrameInput(context({ code, shiftKey: true })),
        { kind: 'ignore' },
      );
    }
  });

  test('routing 结果可驱动 FrameController 与 TraceRuntime.strike', () => {
    const controller = new FrameController();
    const move = routeFrameInput(context({ code: 'ArrowRight', shiftKey: true }));
    assert.equal(move.kind, 'frame-move');
    if (move.kind === 'frame-move') {
      controller.update(50, { ...EMPTY_FRAME_HELD, [move.direction]: true });
    }
    assert.ok(controller.rect.x > 0.16);

    const strike = routeFrameInput(context({ code: 'Enter', shiftKey: true }));
    assert.equal(strike.kind, 'frame-strike');
    const runtime = new TraceRuntime([placement()]);
    const result = runtime.strike(1000, controller.rect);
    assert.equal(result.strike.aligned, true);
    assert.equal(runtime.views[0]?.visibility, VisibilityState.Revealed);
  });
});
