import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FrameTracking,
  VisualFrame,
  VisualFrameTargetLock,
} from '../../core/world/frame';
import type { FrameTarget, VisualFrameRect } from '../../core/world/frame';

const frame: VisualFrameRect = { x: 100, y: 100, width: 200, height: 100 };

function target(x: number, y: number, kind: FrameTarget['kind'] = 'Anchor'): FrameTarget {
  return {
    kind,
    targetId: kind === 'None' ? undefined : 'target-1',
    screenRect: { x, y, width: 40, height: 20 },
  };
}

describe('R3.4 VisualFrame', () => {
  test('isTargetInsideFrame：内 / 边界 / 外 / None', () => {
    assert.equal(VisualFrame.isTargetInsideFrame(frame, target(150, 130)), true);
    assert.equal(VisualFrame.isTargetInsideFrame(frame, target(80, 130)), true);
    assert.equal(VisualFrame.isTargetInsideFrame(frame, target(60, 130)), false);
    assert.equal(VisualFrame.isTargetInsideFrame(frame, target(300, 130)), false);
    assert.equal(VisualFrame.isTargetInsideFrame(frame, target(150, 130, 'None')), false);
  });

  test('computeFrameTracking 状态转换', () => {
    assert.equal(
      VisualFrame.computeFrameTracking(frame, target(150, 130), FrameTracking.Idle),
      FrameTracking.Tracking,
    );
    assert.equal(
      VisualFrame.computeFrameTracking(frame, target(500, 130), FrameTracking.Tracking),
      FrameTracking.Lost,
    );
    assert.equal(
      VisualFrame.computeFrameTracking(frame, target(150, 130), FrameTracking.Lost),
      FrameTracking.Tracking,
    );
    assert.equal(
      VisualFrame.computeFrameTracking(frame, target(150, 130), FrameTracking.Locked),
      FrameTracking.Locked,
    );
    assert.equal(
      VisualFrame.computeFrameTracking(frame, target(500, 130), FrameTracking.Locked),
      FrameTracking.Lost,
    );
    assert.equal(
      VisualFrame.computeFrameTracking(frame, target(150, 130, 'None'), FrameTracking.Tracking),
      FrameTracking.Idle,
    );
  });

  test('computeTargetLock：窗口内 / 窗口外 / 框外 / None', () => {
    assert.equal(
      VisualFrame.computeTargetLock(frame, target(150, 130), 100, 0),
      VisualFrameTargetLock.Locked,
    );
    assert.equal(
      VisualFrame.computeTargetLock(frame, target(150, 130), 100, 100),
      VisualFrameTargetLock.Locked,
    );
    assert.equal(
      VisualFrame.computeTargetLock(frame, target(150, 130), 100, 101),
      VisualFrameTargetLock.Unlocked,
    );
    assert.equal(
      VisualFrame.computeTargetLock(frame, target(500, 130), 100, 50),
      VisualFrameTargetLock.Unlocked,
    );
    assert.equal(
      VisualFrame.computeTargetLock(frame, target(150, 130, 'None'), 100, 50),
      VisualFrameTargetLock.Unlocked,
    );
  });
});
