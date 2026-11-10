import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import { ChartKeyframe, ChartKeyframeAnimation, ChartKeyframeProperty } from '../../core/editor/keyframe';

function world(): EditorWorldFile {
  return EditorWorldFile.create({
    documentId: 'doc',
    chartId: 'w1',
    durationMs: 10_000,
    stageWidth: 1280,
    stageHeight: 720,
  });
}

function logo(x = 0.2, y = 0.2): NonNullable<ChartKeyframe['logo']> {
  return {
    logoId: 'logo-1',
    assetId: 'builtin:head-logo',
    x,
    y,
    size: 0.2,
    stretch: 1,
    appearEffect: 'None',
    disappearEffect: 'None',
    easing: 'Linear',
  };
}

describe('R3.5b ChartKeyframe / drag', () => {
  test('3px 阈值：低于阈值不变化，超过才进入 Dragging', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    assert.equal(file.history.size, 1);
    file.beginKeyframeDrag(keyframe.keyframeId, { x: 100, y: 100 });
    assert.equal(file.timeline.viewportLocked, true);
    assert.equal(file.pressed, true);
    assert.equal(file.dragging, false);

    const small = file.updateKeyframeDrag({ x: 102, y: 100 });
    assert.deepEqual(small, { timeMs: 1000, layerIndex: 1, changed: false });
    assert.equal(file.pressed, true);
    assert.equal(file.dragging, false);
    assert.equal(file.timeline.playheadMs, 1000);

    const large = file.updateKeyframeDrag({ x: 104, y: 100 });
    assert.equal(large?.changed, true);
    assert.equal(file.dragging, true);
    assert.equal(large?.timeMs, 1040);
    const committed = file.commitKeyframeDrag();
    assert.equal(committed?.timeMs, 1040);
    assert.equal(file.history.size, 2);
    assert.equal(file.timeline.viewportLocked, false);
  });

  test('先拖远再回到 3px 内，commit 不提交旧 preview', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.beginKeyframeDrag(keyframe.keyframeId, { x: 100, y: 100 });
    assert.equal(file.updateKeyframeDrag({ x: 220, y: 100 })?.changed, true);
    assert.equal(file.dragging, true);
    assert.equal(file.updateKeyframeDrag({ x: 101, y: 100 })?.changed, false);
    assert.equal(file.dragging, false);
    assert.equal(file.pressed, true);
    const size = file.history.size;
    const committed = file.commitKeyframeDrag();
    assert.equal(committed?.timeMs, 1000);
    assert.equal(file.history.size, size);
  });

  test('取消拖拽不写历史、不移动 keyframe', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.timeline.setPlayhead(500);
    file.beginKeyframeDrag(keyframe.keyframeId, { x: 100, y: 100 });
    file.updateKeyframeDrag({ x: 260, y: 100 });
    const size = file.history.size;
    file.cancelKeyframeDrag();
    assert.equal(file.getKeyframe(keyframe.keyframeId)?.keyframe.timeMs, 1000);
    assert.equal(file.history.size, size);
    assert.equal(file.timeline.playheadMs, 500);
    assert.equal(file.timeline.viewportLocked, false);
  });

  test('吸附：帧边界优先，其次 10ms，Alt 关闭', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });

    file.beginKeyframeDrag(keyframe.keyframeId, { x: 100, y: 100 });
    const frame = file.updateKeyframeDrag({ x: 123.4, y: 100 }, { frameDurationMs: 40 });
    assert.equal(frame?.timeMs, 1240);

    const grid = file.updateKeyframeDrag({ x: 123.4, y: 100 });
    assert.equal(grid?.timeMs, 1230);

    const free = file.updateKeyframeDrag({ x: 123.4, y: 100 }, { altKey: true });
    assert.equal(free?.timeMs, 1234);
    file.cancelKeyframeDrag();

    assert.equal(file.timeline.snap(1234, { frameDurationMs: 40 }), 1240);
    assert.equal(file.timeline.snap(1234), 1230);
    assert.equal(file.timeline.snap(1234, { altKey: true }), 1234);
  });

  test('24px 换轨阈值 + 3 层 pad/grid 语义', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.beginKeyframeDrag(keyframe.keyframeId, { x: 100, y: 100 });

    const near = file.updateKeyframeDrag({ x: 100, y: 110 }, { targetLayerIndex: 2 });
    assert.equal(near?.layerIndex, 1);
    const far = file.updateKeyframeDrag({ x: 100, y: 130 }, { targetLayerIndex: 2 });
    assert.equal(far?.layerIndex, 2);
    const moved = file.commitKeyframeDrag();
    assert.equal(moved?.chartLayerIndex, 2);
    assert.equal(moved?.chartPadKind, 'Light');
    assert.equal(moved?.gridCellId, 1);

    const layer1 = file.addKeyframe({ timeMs: 100, chartLayerIndex: 1 });
    const layer2 = file.addKeyframe({ timeMs: 100, chartLayerIndex: 2 });
    const layer3 = file.addKeyframe({ timeMs: 100, chartLayerIndex: 3 });
    assert.equal(layer1.chartPadKind, 'TopMost');
    assert.equal(layer1.gridCellId, null);
    assert.equal(layer2.chartPadKind, 'Light');
    assert.equal(layer2.gridCellId, 1);
    assert.equal(layer3.chartPadKind, 'Light');
    assert.equal(layer3.gridCellId, null);
  });

  test('Shift 锁时间，只允许纵向换轨', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.beginKeyframeDrag(keyframe.keyframeId, { x: 100, y: 100 });
    const preview = file.updateKeyframeDrag(
      { x: 260, y: 130 },
      { shiftKey: true, targetLayerIndex: 2 },
    );
    assert.equal(preview?.timeMs, 1000);
    assert.equal(preview?.layerIndex, 2);
    const moved = file.commitKeyframeDrag();
    assert.equal(moved?.timeMs, 1000);
    assert.equal(moved?.chartLayerIndex, 2);
  });

  test('同层同时间允许多个 keyframe，不合并、按 id 稳定排序', () => {
    const file = world();
    const first = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    const second = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    const track = file.trackForLayer(1);
    assert.ok(track);
    assert.equal(track.keyframes.length, 2);
    assert.deepEqual(
      track.keyframes.map((keyframe) => keyframe.keyframeId),
      [first.keyframeId, second.keyframeId],
    );
  });

  test('新增/Inspector 默认吸附；v2 原始 timeMs 用 snap:false 保留', () => {
    const file = world();
    const snapped = file.addKeyframe({ timeMs: 1234, chartLayerIndex: 1 });
    assert.equal(snapped.timeMs, 1230);

    const preserved = file.addKeyframe(
      { timeMs: 1234, chartLayerIndex: 1 },
      { snap: false },
    );
    assert.equal(preserved.timeMs, 1234);

    const before = file.history.size;
    const inspector = file.updateKeyframe(snapped.keyframeId, { timeMs: 1244 });
    assert.equal(inspector.timeMs, 1240);
    const raw = file.updateKeyframe(
      snapped.keyframeId,
      { timeMs: 1244 },
      { snap: false },
    );
    assert.equal(raw.timeMs, 1244);
    assert.equal(file.history.size, before + 2);
  });

  test('空操作不记录历史', () => {
    const file = world();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    const size = file.history.size;
    file.moveKeyframe(keyframe.keyframeId, 1000, 1);
    file.updateKeyframe(keyframe.keyframeId, { timeMs: 1000 });
    assert.equal(file.history.size, size);
  });

  test('ChartKeyframeProperty 值域与插值', () => {
    assert.equal(ChartKeyframeProperty.Time, 'Time');
    assert.equal(ChartKeyframeProperty.Position, 'Position');
    assert.equal(ChartKeyframeProperty.DisappearEffect, 'DisappearEffect');

    const file = world();
    const start = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    const middle = file.addKeyframe({ timeMs: 2000, chartLayerIndex: 1 });
    const end = file.addKeyframe({ timeMs: 3000, chartLayerIndex: 1 });
    file.setLogo(start.keyframeId, logo(0.1, 0.1));
    file.setLogo(middle.keyframeId, logo(0.5, 0.5));
    file.setLogo(end.keyframeId, logo(0.9, 0.9));
    const track = file.trackForLayer(1);
    assert.ok(track);
    const sample = ChartKeyframeAnimation.sample(track.keyframes, 1500);
    assert.ok(sample);
    assert.ok(sample.x > 0.1 && sample.x < 0.5);
    assert.equal(ChartKeyframe.roleOf(track.keyframes, middle.keyframeId), 'Middle');
    assert.deepEqual(ChartKeyframe.rolesOf([start], start.keyframeId), ['Start', 'End']);
    assert.deepEqual(ChartKeyframe.rolesOf([start, middle], start.keyframeId), ['Start']);
  });
});
