import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ParallaxLayer,
  TriggerInstance,
} from '../../core/world/trigger';

const REGION = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
const INSIDE = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
const HALF = { x: 0.2, y: 0.2, width: 0.2, height: 0.4 };
const OUTSIDE = { x: 0, y: 0, width: 0.1, height: 0.1 };

function instance(overrides: Partial<{
  dwellMs: number;
  occupancyThreshold: number;
  occupancyIntervalMs: number;
  parallaxLayer: ParallaxLayer;
  parallaxFactor: number;
  parallaxStep: number;
}> = {}): TriggerInstance {
  return new TriggerInstance({
    triggerId: 'trig-1',
    eventSignalId: 'sig-1',
    region: REGION,
    ...overrides,
  });
}

describe('R4c TriggerInstance 五类信号', () => {
  test('Enter / Exit：只在重叠边界变化时发一次', () => {
    const trigger = instance();
    const outside = trigger.update({ nowMs: 0, frameRect: OUTSIDE });
    assert.equal(outside.enter, null);
    assert.equal(outside.exit, null);

    const enter = trigger.update({ nowMs: 10, frameRect: INSIDE });
    assert.equal(enter.enter?.kind, 'TriggerEnter');
    assert.equal(enter.enter?.triggerId, 'trig-1');
    assert.equal(enter.enter?.eventSignalId, 'sig-1');
    assert.equal(enter.enter?.occupancy, 1);

    const stillInside = trigger.update({ nowMs: 20, frameRect: HALF });
    assert.equal(stillInside.enter, null);
    assert.equal(stillInside.exit, null);

    const exit = trigger.update({ nowMs: 30, frameRect: OUTSIDE });
    assert.equal(exit.exit?.kind, 'TriggerExit');
    assert.equal(exit.exit?.occupancy, 0);
    assert.equal(exit.enter, null);
  });

  test('Dwell：连续停留达到 dwellMs 后只发一次', () => {
    const trigger = instance({ dwellMs: 500 });
    trigger.update({ nowMs: 100, frameRect: INSIDE });
    assert.equal(trigger.update({ nowMs: 599, frameRect: INSIDE }).dwell, null);
    const dwell = trigger.update({ nowMs: 600, frameRect: INSIDE });
    assert.equal(dwell.dwell?.kind, 'TriggerDwell');
    assert.equal(dwell.dwell?.dwellMs, 500);
    assert.equal(trigger.update({ nowMs: 700, frameRect: INSIDE }).dwell, null);
  });

  test('Dwell：退出后重新进入重新计时', () => {
    const trigger = instance({ dwellMs: 500 });
    trigger.update({ nowMs: 0, frameRect: INSIDE });
    trigger.update({ nowMs: 500, frameRect: INSIDE });
    trigger.update({ nowMs: 600, frameRect: OUTSIDE });
    trigger.update({ nowMs: 700, frameRect: INSIDE });
    assert.equal(trigger.update({ nowMs: 1100, frameRect: INSIDE }).dwell, null);
    assert.equal(trigger.update({ nowMs: 1200, frameRect: INSIDE }).dwell?.kind, 'TriggerDwell');
  });

  test('Occupancy：阈值、节流与退出重置', () => {
    const trigger = instance({ occupancyThreshold: 0.5, occupancyIntervalMs: 250 });
    const enter = trigger.update({ nowMs: 0, frameRect: HALF });
    assert.equal(enter.occupancy?.kind, 'TriggerOccupancy');
    assert.equal(enter.occupancy?.occupancy, 0.5);
    assert.equal(trigger.update({ nowMs: 100, frameRect: HALF }).occupancy, null);
    assert.equal(trigger.update({ nowMs: 250, frameRect: HALF }).occupancy?.occupancy, 0.5);
    assert.equal(trigger.update({ nowMs: 500, frameRect: HALF }).occupancy?.occupancy, 0.5);
    trigger.update({ nowMs: 600, frameRect: OUTSIDE });
    const again = trigger.update({ nowMs: 700, frameRect: HALF });
    assert.equal(again.enter?.kind, 'TriggerEnter');
    assert.equal(again.occupancy?.kind, 'TriggerOccupancy');
  });

  test('Occupancy：低于阈值不发', () => {
    const trigger = instance({ occupancyThreshold: 0.5, occupancyIntervalMs: 0 });
    const low = trigger.update({
      nowMs: 0,
      frameRect: { x: 0.2, y: 0.2, width: 0.1, height: 0.4 },
    });
    assert.equal(low.occupancy, null);
  });

  test('Parallax：按 layer/factor 累计位移，方向正确', () => {
    const trigger = instance({
      parallaxLayer: ParallaxLayer.Foreground,
      parallaxFactor: 2,
      parallaxStep: 0.01,
    });
    trigger.update({ nowMs: 0, frameRect: INSIDE, frameDeltaX: 0.004 });
    const right = trigger.update({ nowMs: 10, frameRect: INSIDE, frameDeltaX: 0.004 });
    assert.equal(right.parallax?.kind, 'TriggerParallax');
    assert.equal(right.parallax?.layer, ParallaxLayer.Foreground);
    assert.equal(right.parallax?.factor, 2);
    assert.equal(right.parallax?.direction, 'Right');

    const left = trigger.update({ nowMs: 20, frameRect: INSIDE, frameDeltaX: -0.01 });
    assert.equal(left.parallax?.direction, 'Left');
  });

  test('Parallax：离开后清空累计，不跨出框累积', () => {
    const trigger = instance({
      parallaxLayer: ParallaxLayer.Background,
      parallaxFactor: 1,
      parallaxStep: 0.01,
    });
    trigger.update({ nowMs: 0, frameRect: INSIDE, frameDeltaX: 0.009 });
    trigger.update({ nowMs: 10, frameRect: OUTSIDE, frameDeltaX: 0.009 });
    assert.equal(
      trigger.update({ nowMs: 20, frameRect: INSIDE, frameDeltaX: 0.009 }).parallax,
      null,
    );
  });

  test('reset：清空进入/停留/占用状态', () => {
    const trigger = instance({ dwellMs: 100, occupancyThreshold: 0.5 });
    trigger.update({ nowMs: 0, frameRect: INSIDE });
    trigger.update({ nowMs: 100, frameRect: INSIDE });
    trigger.reset();
    assert.equal(trigger.inside, false);
    const enter = trigger.update({ nowMs: 200, frameRect: INSIDE });
    assert.equal(enter.enter?.kind, 'TriggerEnter');
    assert.equal(enter.occupancy?.kind, 'TriggerOccupancy');
  });

  test('构造校验：非法区域 / 阈值 / layer', () => {
    assert.throws(() => new TriggerInstance({
      triggerId: 't', eventSignalId: 's',
      region: { x: 0, y: 0, width: 0, height: 1 },
    }), /width\/height/);
    assert.throws(() => new TriggerInstance({
      triggerId: 't', eventSignalId: 's', region: REGION,
      occupancyThreshold: 1.2,
    }), /0\.\.1/);
    assert.throws(() => new TriggerInstance({
      triggerId: 't', eventSignalId: 's', region: REGION,
      parallaxLayer: 'Side' as ParallaxLayer,
    }), /Foreground/);
  });
});
