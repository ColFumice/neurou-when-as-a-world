import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartKeyframe } from '../../core/editor/keyframe';
import { ChartEditUndo } from '../../core/editor/history';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';

function keyframe(id: string, timeMs = 1000): ChartKeyframe {
  return new ChartKeyframe({
    keyframeId: id,
    timeMs,
    durationMs: 0,
    chartLayerIndex: 1,
    gridCellId: null,
    chartKeyId: null,
    chartPadKind: 'TopMost',
    logo: null,
  });
}

function world(): EditorWorldFile {
  return EditorWorldFile.create({
    documentId: 'doc',
    chartId: 'w1',
    durationMs: 10_000,
  });
}

function logo(): NonNullable<ChartKeyframe['logo']> {
  return {
    logoId: 'logo-1',
    assetId: 'builtin:head-logo',
    x: 0.5,
    y: 0.5,
    size: 0.2,
    stretch: 1,
    appearEffect: 'None',
    disappearEffect: 'None',
    easing: 'Linear',
  };
}

describe('R3.5b ChartEditUndo', () => {
  test('默认上限 100：101 条只保留最近 100 条', () => {
    const history = new ChartEditUndo();
    for (let index = 0; index < 101; index += 1) {
      history.push({
        label: `p${index}`,
        before: null,
        after: { trackId: 't1', index, keyframe: keyframe(`k${index}`) },
      });
    }
    assert.equal(history.size, 100);
    for (let index = 0; index < 100; index += 1) {
      assert.notEqual(history.undo(), null);
    }
    assert.equal(history.undo(), null);
    assert.equal(history.canRedo, true);
  });

  test('自定义上限 3：commit / undo / redo', () => {
    const history = new ChartEditUndo(3);
    for (let index = 0; index < 4; index += 1) {
      history.push({
        label: `p${index}`,
        before: null,
        after: { trackId: 't1', index, keyframe: keyframe(`k${index}`) },
      });
    }
    assert.equal(history.size, 3);
    assert.equal(history.canUndo, true);
    assert.equal(history.canRedo, false);

    const undone = history.undo();
    assert.equal(undone?.label, 'p3');
    assert.equal(history.canRedo, true);
    assert.equal(history.undo()?.label, 'p2');
    assert.equal(history.undo()?.label, 'p1');
    assert.equal(history.undo(), null);
    assert.equal(history.canRedo, true);

    assert.equal(history.redo()?.label, 'p1');
    assert.equal(history.redo()?.label, 'p2');
    assert.equal(history.redo()?.label, 'p3');
    assert.equal(history.redo(), null);
  });

  test('新编辑截断 redo；空 patch 不记录', () => {
    const history = new ChartEditUndo(100);
    history.push({
      label: 'a',
      before: null,
      after: { trackId: 't1', index: 0, keyframe: keyframe('a') },
    });
    history.push({
      label: 'b',
      before: null,
      after: { trackId: 't1', index: 1, keyframe: keyframe('b') },
    });
    history.undo();
    assert.equal(history.canRedo, true);
    history.push({
      label: 'c',
      before: null,
      after: { trackId: 't1', index: 1, keyframe: keyframe('c') },
    });
    assert.equal(history.canRedo, false);
    assert.equal(history.size, 2);

    const size = history.size;
    history.push({ label: 'noop', before: null, after: null });
    assert.equal(history.size, size);
  });

  test('删除 keyframe 的 undo 恢复 keyframe 及 logo', () => {
    const file = world();
    const added = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.setLogo(added.keyframeId, logo());
    assert.notEqual(file.getKeyframe(added.keyframeId)?.keyframe.logo, null);

    assert.equal(file.deleteKeyframe(added.keyframeId), true);
    assert.equal(file.getKeyframe(added.keyframeId), null);
    assert.equal(file.undo(), true);
    const restored = file.getKeyframe(added.keyframeId);
    assert.ok(restored);
    assert.equal(restored.keyframe.logo?.logoId, 'logo-1');

    assert.equal(file.redo(), true);
    assert.equal(file.getKeyframe(added.keyframeId), null);
  });

  test('WorldFile commit / undo / redo 保持 dirty 与选择状态', () => {
    const file = world();
    assert.equal(file.dirty, false);
    const added = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    assert.equal(file.dirty, true);
    file.markSaved();
    assert.equal(file.dirty, false);
    file.select(added.keyframeId);
    assert.equal(file.selection.selectedKeyframeId, added.keyframeId);

    assert.equal(file.undo(), true);
    assert.equal(file.getKeyframe(added.keyframeId), null);
    assert.equal(file.selection.selectedKeyframeId, null);
    assert.equal(file.dirty, true);

    assert.equal(file.redo(), true);
    assert.equal(file.getKeyframe(added.keyframeId)?.keyframe.keyframeId, added.keyframeId);
  });
});
