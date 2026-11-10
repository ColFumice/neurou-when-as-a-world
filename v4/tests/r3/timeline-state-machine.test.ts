import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PlaybackState,
  TimelineDirection,
  TimelineStateMachine,
} from '../../core/timeline/types';

describe('R3.4 TimelineStateMachine', () => {
  test('构造：boundary / initialMs / Ready', () => {
    const timeline = new TimelineStateMachine(
      { minMs: 0, maxMs: 1000 },
      { initialMs: 200 },
    );
    assert.equal(timeline.playbackState, PlaybackState.Ready);
    assert.deepEqual(timeline.boundary, { minMs: 0, maxMs: 1000 });
    assert.deepEqual(timeline.progress, {
      positionMs: 200,
      durationMs: 1000,
      direction: TimelineDirection.Forward,
    });
  });

  test('play / pause 状态转换', () => {
    const timeline = new TimelineStateMachine({ minMs: 0, maxMs: 1000 });
    timeline.play();
    assert.equal(timeline.playbackState, PlaybackState.Playing);
    timeline.pause();
    assert.equal(timeline.playbackState, PlaybackState.Paused);
  });

  test('seek 合法位置 / 边界 clamp / 暂停时可 seek', () => {
    const timeline = new TimelineStateMachine({ minMs: 100, maxMs: 900 });
    timeline.seek(500);
    assert.equal(timeline.progress.positionMs, 500);
    assert.equal(timeline.progress.direction, TimelineDirection.Forward);

    timeline.seek(-100);
    assert.equal(timeline.progress.positionMs, 100);
    assert.equal(timeline.progress.direction, TimelineDirection.Backward);

    timeline.seek(2000);
    assert.equal(timeline.progress.positionMs, 900);
    assert.equal(timeline.playbackState, PlaybackState.Completed);

    timeline.pause();
    timeline.seek(300);
    assert.equal(timeline.progress.positionMs, 300);
    assert.equal(timeline.playbackState, PlaybackState.Paused);
  });

  test('advance 正向 / 反向 / 边界 clamp / 暂停冻结', () => {
    const timeline = new TimelineStateMachine({ minMs: 0, maxMs: 1000 });
    timeline.advance(250);
    assert.equal(timeline.progress.positionMs, 250);
    assert.equal(timeline.progress.direction, TimelineDirection.Forward);
    assert.equal(timeline.playbackState, PlaybackState.Playing);

    timeline.advance(-100);
    assert.equal(timeline.progress.positionMs, 150);
    assert.equal(timeline.progress.direction, TimelineDirection.Backward);

    timeline.advance(5000);
    assert.equal(timeline.progress.positionMs, 1000);
    assert.equal(timeline.playbackState, PlaybackState.Completed);

    timeline.seek(500);
    const before = timeline.progress.positionMs;
    timeline.advance(-100);
    assert.equal(timeline.progress.positionMs, before);
    assert.equal(timeline.playbackState, PlaybackState.Paused);
  });

  test('freeze / unfreeze：冻结期间 advance 无效、seek 允许', () => {
    const timeline = new TimelineStateMachine({ minMs: 0, maxMs: 1000 });
    timeline.play();
    timeline.freeze();
    assert.equal(timeline.playbackState, PlaybackState.Paused);

    timeline.advance(100);
    assert.equal(timeline.progress.positionMs, 0);

    timeline.seek(400);
    assert.equal(timeline.progress.positionMs, 400);

    timeline.unfreeze();
    timeline.play();
    timeline.advance(100);
    assert.equal(timeline.progress.positionMs, 500);
  });
});
