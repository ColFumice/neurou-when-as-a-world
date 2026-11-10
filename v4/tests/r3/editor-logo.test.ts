import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LogoPositionPicker, LogoRandomPlacement } from '../../core/editor/logo';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';

describe('R3.5b Logo', () => {
  test('同 seed + keyframeId 两次结果一致，不同 seed/keyframe 不同', () => {
    const first = LogoRandomPlacement.place(42, 'doc-kf-1');
    const second = LogoRandomPlacement.place(42, 'doc-kf-1');
    assert.deepEqual(first, second);

    const otherSeed = LogoRandomPlacement.place(43, 'doc-kf-1');
    const otherKeyframe = LogoRandomPlacement.place(42, 'doc-kf-2');
    assert.notDeepEqual(first, otherSeed);
    assert.notDeepEqual(first, otherKeyframe);
  });

  test('随机位置在 bounds 内', () => {
    const point = LogoRandomPlacement.place(7, 'doc-kf-9', {
      minX: 0.2,
      maxX: 0.6,
      minY: 0.3,
      maxY: 0.8,
    });
    assert.ok(point.x >= 0.2 && point.x <= 0.6);
    assert.ok(point.y >= 0.3 && point.y <= 0.8);
    assert.throws(
      () => LogoRandomPlacement.place(1, 'kf', { minX: 0.8, maxX: 0.2 }),
      RangeError,
    );
  });

  test('选位状态机：未激活不提交，点击归一化，取消关闭', () => {
    const picker = new LogoPositionPicker();
    assert.equal(picker.active, false);
    assert.equal(picker.commit(10, 10, { x: 0, y: 0, width: 100, height: 100 }), null);

    picker.begin();
    assert.equal(picker.active, true);
    const position = picker.commit(250, 100, { x: 100, y: 0, width: 300, height: 200 });
    assert.deepEqual(position, { x: 0.5, y: 0.5 });
    assert.equal(picker.active, false);

    picker.begin();
    const clamped = picker.commit(-50, 999, { x: 0, y: 0, width: 100, height: 100 });
    assert.deepEqual(clamped, { x: 0, y: 1 });
    assert.equal(picker.active, false);

    picker.begin();
    picker.cancel();
    assert.equal(picker.active, false);
  });

  test('删除 keyframe 级联删除 logo，undo 恢复', () => {
    const file = EditorWorldFile.create({ documentId: 'doc', chartId: 'w1', durationMs: 10_000 });
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.setLogo(keyframe.keyframeId, {
      logoId: 'logo-1',
      assetId: 'builtin:head-logo',
      x: 0.4,
      y: 0.6,
      size: 0.2,
      stretch: 1,
      appearEffect: 'None',
      disappearEffect: 'None',
      easing: 'Linear',
    });
    assert.notEqual(file.getKeyframe(keyframe.keyframeId)?.keyframe.logo, null);

    assert.equal(file.deleteKeyframe(keyframe.keyframeId), true);
    assert.equal(file.getKeyframe(keyframe.keyframeId), null);
    assert.equal(file.undo(), true);
    assert.equal(file.getKeyframe(keyframe.keyframeId)?.keyframe.logo?.logoId, 'logo-1');
  });
});
