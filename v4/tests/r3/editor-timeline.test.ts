import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorPlayhead } from '../../core/editor/timeline/EditorPlayhead';
import { EditorTimeline } from '../../core/editor/timeline/EditorTimeline';

function timeline(): EditorTimeline {
  return new EditorTimeline({
    laneLeft: 100,
    laneWidth: 800,
    durationMs: 10_000,
    viewStartMs: 0,
    pxPerMs: 0.1,
    playheadMs: 0,
  });
}

describe('R3.5b EditorTimeline', () => {
  test('timeMs ↔ x 往返一致', () => {
    const value = timeline();
    assert.equal(value.timeAtX(100), 0);
    assert.equal(value.timeAtX(500), 4000);
    assert.equal(value.xAtTime(4000), 500);

    for (const x of [100, 180, 333.5, 500, 899]) {
      const time = value.timeAtX(x);
      assert.ok(Math.abs(value.xAtTime(time) - x) < 1e-9);
    }
    for (const time of [0, 10, 999, 4000, 9000]) {
      const x = value.xAtTime(time);
      assert.ok(Math.abs(value.timeAtX(x) - time) < 1e-9);
    }
  });

  test('pxPerMs 钳制在 [0.01, 10]', () => {
    const value = timeline();
    value.setViewport({ pxPerMs: 0 });
    assert.equal(value.pxPerMs, 0.01);
    value.setViewport({ pxPerMs: 100 });
    assert.equal(value.pxPerMs, 10);
    value.zoomAt(500, -1);
    assert.equal(value.pxPerMs, 0.01);
    value.zoomAt(500, 1000);
    assert.equal(value.pxPerMs, 10);
  });

  test('viewStart / viewEnd / 滚动钳制', () => {
    const value = timeline();
    assert.equal(value.viewStartMs, 0);
    assert.equal(value.viewEndMs, 8000);

    value.scrollTo(2000);
    assert.equal(value.viewStartMs, 2000);
    assert.equal(value.viewEndMs, 10_000);

    value.scrollTo(999_999);
    assert.equal(value.viewStartMs, 2000);
    value.scrollBy(-99_999);
    assert.equal(value.viewStartMs, 0);

    value.setViewport({ pxPerMs: 0.2 });
    value.scrollTo(999_999);
    assert.equal(value.viewStartMs, 6000);
    assert.equal(value.viewEndMs, 10_000);
  });

  test('拖动锁定期间 zoom/scroll 无效，playhead 仍可更新', () => {
    const value = timeline();
    const start = value.viewStartMs;
    const px = value.pxPerMs;
    value.lockViewport();
    assert.equal(value.viewportLocked, true);
    value.scrollBy(1000);
    value.zoomAt(500, 1);
    value.setViewport({ viewStartMs: 1500, pxPerMs: 1 });
    assert.equal(value.viewStartMs, start);
    assert.equal(value.pxPerMs, px);
    value.setPlayhead(2500);
    assert.equal(value.playheadMs, 2500);
    value.unlockViewport();
    value.scrollBy(1000);
    assert.equal(value.viewStartMs, 1000);
  });

  test('吸附优先级：Alt → 帧边界 → 10ms → clamp', () => {
    const value = timeline();
    assert.equal(value.snap(1234, { frameDurationMs: 40 }), 1240);
    assert.equal(value.snap(1234), 1230);
    assert.equal(value.snap(1234, { altKey: true }), 1234);
    assert.equal(value.snap(-5), 0);
    assert.equal(value.snap(99_999), 10_000);
    assert.equal(value.snap(1234, { frameDurationMs: 0 }), 1230);
    const fractionalFrame = value.snap(1234, { frameDurationMs: 1000 / 30 });
    assert.equal(Number.isInteger(fractionalFrame), true);
    assert.ok(Math.abs(fractionalFrame - 1233.3333333333333) < 1);
  });

  test('setDuration 重新钳制 viewStart 与 playhead', () => {
    const value = timeline();
    value.setViewport({ viewStartMs: 2000 });
    value.setPlayhead(9000);
    value.setDuration(3000);
    assert.equal(value.durationMs, 3000);
    assert.equal(value.viewStartMs, 0);
    assert.equal(value.playheadMs, 3000);
  });

  test('EditorPlayhead：play / pause / seek / advance', () => {
    const playhead = new EditorPlayhead(1000, 100);
    assert.equal(playhead.timeMs, 100);
    assert.equal(playhead.playing, false);
    playhead.advance(50);
    assert.equal(playhead.timeMs, 100);
    playhead.play();
    playhead.advance(200);
    assert.equal(playhead.timeMs, 300);
    playhead.pause();
    playhead.advance(200);
    assert.equal(playhead.timeMs, 300);
    playhead.seek(2000);
    assert.equal(playhead.timeMs, 1000);
    assert.equal(playhead.playing, false);
  });
});
