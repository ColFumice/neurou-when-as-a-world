import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ParallaxLayer,
  TriggerInstance,
} from '../../core/world/trigger';
import { TriggerRuntime } from '../../app/src/game/triggerRuntime';
import type { TriggerSink } from '../../app/src/game/triggerRuntime';

const REGION = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
const HALF = { x: 0.2, y: 0.2, width: 0.2, height: 0.4 };
const OUTSIDE = { x: 0, y: 0, width: 0.1, height: 0.1 };

function makeSink(): {
  readonly sink: TriggerSink;
  readonly events: { kind: string; triggerId: string; atMs: number }[];
} {
  const events: { kind: string; triggerId: string; atMs: number }[] = [];
  return {
    events,
    sink: {
      enter: (signal) => events.push({ kind: signal.kind, triggerId: signal.triggerId, atMs: signal.atMs }),
      exit: (signal) => events.push({ kind: signal.kind, triggerId: signal.triggerId, atMs: signal.atMs }),
      dwell: (signal) => events.push({ kind: signal.kind, triggerId: signal.triggerId, atMs: signal.atMs }),
      occupancy: (signal) => events.push({ kind: signal.kind, triggerId: signal.triggerId, atMs: signal.atMs }),
      parallax: (signal) => events.push({ kind: signal.kind, triggerId: signal.triggerId, atMs: signal.atMs }),
    },
  };
}

function instance(): TriggerInstance {
  return new TriggerInstance({
    triggerId: 'trig-1',
    eventSignalId: 'sig-1',
    region: REGION,
    dwellMs: 100,
    occupancyThreshold: 0.5,
    occupancyIntervalMs: 250,
    parallaxLayer: ParallaxLayer.Foreground,
    parallaxFactor: 2,
    parallaxStep: 0.01,
  });
}

describe('R4c TriggerRuntime', () => {
  test('五类信号转发', () => {
    const { sink, events } = makeSink();
    const runtime = new TriggerRuntime([instance()], sink);

    runtime.advanceTo(0, HALF, 0);
    assert.deepEqual(events.map((event) => event.kind), ['TriggerEnter', 'TriggerOccupancy']);

    runtime.advanceTo(100, HALF, 0.01);
    assert.deepEqual(events.map((event) => event.kind), [
      'TriggerEnter', 'TriggerOccupancy', 'TriggerDwell', 'TriggerParallax',
    ]);

    runtime.advanceTo(200, OUTSIDE, 0);
    assert.equal(events.at(-1)?.kind, 'TriggerExit');
    assert.equal(runtime.instanceCount, 1);
  });

  test('reset 重新触发 Enter', () => {
    const { sink, events } = makeSink();
    const runtime = new TriggerRuntime([instance()], sink);
    runtime.advanceTo(0, HALF, 0);
    runtime.reset();
    runtime.advanceTo(1000, HALF, 0);
    assert.equal(events.filter((event) => event.kind === 'TriggerEnter').length, 2);
  });

  test('异常隔离：单个实例抛错不影响同帧其他实例', () => {
    const { sink, events } = makeSink();
    const errors: unknown[] = [];
    const bad = {
      update: () => {
        throw new Error('trigger boom');
      },
      reset: () => undefined,
    } as unknown as TriggerInstance;
    const runtime = new TriggerRuntime([bad, instance()], sink, (error) => {
      errors.push(error);
    });

    assert.doesNotThrow(() => runtime.advanceTo(0, HALF, 0));
    assert.equal(errors.length, 1);
    assert.equal(events[0]?.kind, 'TriggerEnter');
    assert.equal(events[1]?.kind, 'TriggerOccupancy');
  });

  test('onError 自身抛错也不外溢', () => {
    const { sink } = makeSink();
    const bad = {
      update: () => {
        throw new Error('trigger boom');
      },
      reset: () => undefined,
    } as unknown as TriggerInstance;
    const runtime = new TriggerRuntime([bad], sink, () => {
      throw new Error('sink boom');
    });
    assert.doesNotThrow(() => runtime.advanceTo(0, HALF, 0));
  });

  test('dispose 后不再转发', () => {
    const { sink, events } = makeSink();
    const runtime = new TriggerRuntime([instance()], sink);
    runtime.dispose();
    runtime.advanceTo(0, HALF, 0);
    assert.equal(events.length, 0);
  });
});
