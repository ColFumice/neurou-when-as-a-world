import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import { parseChartSourceData } from '../../core/editor/ChartSourceData';

function createWorld(): EditorWorldFile {
  return EditorWorldFile.create({
    documentId: 'doc',
    chartId: 'w1',
    durationMs: 10_000,
    stageWidth: 1280,
    stageHeight: 720,
    seed: 42,
  });
}

function logo() {
  return {
    logoId: 'logo-1',
    assetId: 'builtin:head-logo',
    x: 0.25,
    y: 0.75,
    size: 0.2,
    stretch: 1.2,
    appearEffect: 'None' as const,
    disappearEffect: 'None' as const,
    easing: 'EaseInOut' as const,
  };
}

describe('R3.5b EditorWorldFile', () => {
  test('editor.json round-trip：tracks / canvas / keyframe / logo', () => {
    const file = createWorld();
    const first = file.addKeyframe({
      timeMs: 1000,
      chartLayerIndex: 1,
      parallaxFactor: 1.75,
    });
    file.setLogo(first.keyframeId, logo());
    file.addKeyframe({ timeMs: 2000, chartLayerIndex: 2, gridCellId: 3 });
    file.addKeyframe({ timeMs: 3000, chartLayerIndex: 3 });
    file.select(first.keyframeId);
    file.timeline.scrollTo(500);
    file.timeline.setPlayhead(1500);

    const json = file.toJson();
    const text = JSON.stringify(json);
    assert.equal(text.includes('history'), false);
    assert.equal(text.includes('dirty'), false);
    assert.equal(text.includes('selection'), false);
    assert.equal(text.includes('viewStartMs'), false);

    const loaded = EditorWorldFile.fromJson(json);
    assert.equal(loaded.dirty, false);
    assert.equal(loaded.history.size, 0);
    assert.equal(loaded.tracks.length, 3);
    assert.equal(loaded.canvas.stageWidth, 1280);
    assert.equal(loaded.canvas.stageHeight, 720);
    assert.equal(loaded.seed, 42);
    assert.equal(loaded.durationMs, 10_000);

    const loadedFirst = loaded.getKeyframe(first.keyframeId);
    assert.ok(loadedFirst);
    assert.equal(loadedFirst.keyframe.timeMs, 1000);
    assert.equal(loadedFirst.keyframe.logo?.logoId, 'logo-1');
    assert.equal(loadedFirst.keyframe.logo?.x, 0.25);
    assert.equal(loadedFirst.keyframe.logo?.easing, 'EaseInOut');
    assert.equal(loadedFirst.keyframe.parallaxFactor, 1.75);

    const loadedSecond = loaded.trackForLayer(2)?.keyframes[0];
    assert.ok(loadedSecond);
    assert.equal(loadedSecond.gridCellId, 3);
  });

  test('parallaxFactor 默认 1 且限制 -5..5', () => {
    const file = createWorld();
    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    assert.equal(keyframe.parallaxFactor, 1);
    assert.throws(
      () => file.addKeyframe({ timeMs: 2000, chartLayerIndex: 1, parallaxFactor: 5.1 }),
      /parallaxFactor/,
    );
    const updated = file.updateKeyframe(keyframe.keyframeId, { parallaxFactor: -4.5 });
    assert.equal(updated.parallaxFactor, -4.5);
  });

  test('fromJson 保留 v2 原始 1234ms，不强制吸附', () => {
    const source = createWorld();
    const raw = source.addKeyframe(
      { timeMs: 1234, chartLayerIndex: 1 },
      { snap: false },
    );
    assert.equal(raw.timeMs, 1234);
    const loaded = EditorWorldFile.fromJson(source.toJson());
    assert.equal(loaded.getKeyframe(raw.keyframeId)?.keyframe.timeMs, 1234);
    const v2 = loaded.exportV2();
    assert.equal(v2.notes[0].timeMs, 1234);
  });

  test('dirty：编辑置 true，markSaved 清 false，load 后 false', () => {
    const file = createWorld();
    assert.equal(file.dirty, false);
    file.addKeyframe({ timeMs: 100, chartLayerIndex: 1 });
    assert.equal(file.dirty, true);
    file.markSaved();
    assert.equal(file.dirty, false);
    file.setSeed(7);
    assert.equal(file.dirty, true);
    file.markSaved();
    assert.equal(file.dirty, false);

    const loaded = EditorWorldFile.fromJson(file.toJson());
    assert.equal(loaded.dirty, false);
  });

  test('v2 导出只含 layers/notes，不含 UI/logo/keyframeId', () => {
    const file = createWorld();
    const first = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.setLogo(first.keyframeId, logo());
    file.addKeyframe({ timeMs: 2000, chartLayerIndex: 2, gridCellId: 3 });
    file.addKeyframe({ timeMs: 3000, chartLayerIndex: 3 });

    const v2 = file.exportV2();
    const parsed = parseChartSourceData(v2);
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.layers.length, 3);
    assert.equal(parsed.notes.length, 3);
    assert.deepEqual(parsed.layers.map((layer) => layer.kind), [
      'TopMost',
      'Grid',
      'FullScreen',
    ]);
    assert.equal(parsed.notes[0].timeMs, 1000);
    assert.equal(parsed.notes[1].gridCellId, 3);

    const text = JSON.stringify(v2);
    for (const forbidden of ['logo', 'keyframeId', 'trackId', 'documentId', 'selection']) {
      assert.equal(text.includes(forbidden), false, `v2 must not contain ${forbidden}`);
    }
  });

  test('ChartEditMode / AI 占位 / Inspector 可见性', () => {
    const file = createWorld();
    assert.equal(file.mode, 'Keyframes');
    assert.equal(file.aiGeneration.status, 'Unavailable');
    assert.equal(file.inspector().visible, false);

    const keyframe = file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    file.select(keyframe.keyframeId);
    const inspector = file.inspector();
    assert.equal(inspector.visible, true);
    assert.equal(inspector.keyframeId, keyframe.keyframeId);
    assert.equal(inspector.chartLayerIndex, 1);
    assert.equal(inspector.chartPadKind, 'TopMost');
    assert.equal(inspector.position, null);

    file.setMode('Logo');
    assert.equal(file.mode, 'Logo');
    file.clearSelection();
    assert.equal(file.inspector().visible, false);

    const withLogo = file.addKeyframe({ timeMs: 2000, chartLayerIndex: 1 });
    file.setLogo(withLogo.keyframeId, logo());
    file.select(withLogo.keyframeId);
    assert.deepEqual(file.canvas.logoPosition, { x: 0.25, y: 0.75 });
    const withoutLogo = file.addKeyframe({ timeMs: 3000, chartLayerIndex: 1 });
    file.select(withoutLogo.keyframeId);
    assert.equal(file.canvas.logoPosition, null);
    assert.equal(file.inspector().position, null);
  });

  test('v1 / 非法 v2 被拒绝', () => {
    const file = createWorld();
    file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1 });
    const v2 = file.exportV2();
    assert.throws(
      () => parseChartSourceData({ ...v2, schemaVersion: 1 }),
      /UnsupportedSchemaVersion/,
    );
    assert.throws(
      () => parseChartSourceData({ ...v2, notes: [{ ...v2.notes[0], chartLayerIndex: 2 }] }),
      /gridCellId|layer 2/,
    );
  });
});
