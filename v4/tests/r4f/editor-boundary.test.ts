import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import { parseChartSourceData } from '../../core/editor/ChartSourceData';
import type { NeuModule, NeuModuleType } from '../../core/editor/runtime/types';

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

function keyframeCount(file: EditorWorldFile): number {
  return file.tracks.flatMap((track) => track.keyframes).length;
}

function logo(): NonNullable<ReturnType<EditorWorldFile['addKeyframe']>['logo']> {
  return {
    logoId: 'logo-1',
    assetId: 'builtin:head-logo',
    x: 0.25,
    y: 0.75,
    size: 0.2,
    stretch: 1.2,
    appearEffect: 'None',
    disappearEffect: 'None',
    easing: 'EaseInOut',
  };
}

function neu(
  moduleId: string,
  type: NeuModuleType,
  outputs: readonly { moduleId: string; port: number }[] = [],
  inputs: readonly { moduleId: string; port: number }[] = [],
  params: Record<string, string | number | boolean | string[] | null> = {},
): NeuModule {
  return {
    moduleId,
    type,
    x: 0.2,
    y: 0.2,
    params,
    inputs: inputs.map((input) => ({
      port: 1,
      sourceModuleId: input.moduleId,
      sourcePort: input.port,
    })),
    outputs: outputs.length === 0
      ? []
      : [{ port: 1, targets: outputs.map((target) => ({ moduleId: target.moduleId, port: target.port })) }],
  };
}

describe('R4f AC4-25 Editor boundaries', () => {
  test('100 步操作全部可 Undo 并回到初始状态', () => {
    const file = createWorld();
    for (let index = 0; index < 100; index += 1) {
      file.addKeyframe({ timeMs: index * 50, chartLayerIndex: 1 });
    }
    assert.equal(file.history.size, 100);
    assert.equal(keyframeCount(file), 100);
    for (let index = 0; index < 100; index += 1) {
      assert.equal(file.undo(), true);
    }
    assert.equal(keyframeCount(file), 0);
    assert.equal(file.history.canUndo, false);
    assert.equal(file.undo(), false);
  });

  test('101 步最旧被丢弃；Undo 100 次后首步仍保留', () => {
    const file = createWorld();
    const first = file.addKeyframe({ timeMs: 0, chartLayerIndex: 1 });
    for (let index = 1; index < 101; index += 1) {
      file.addKeyframe({ timeMs: index * 50, chartLayerIndex: 1 });
    }
    assert.equal(file.history.size, 100);
    for (let index = 0; index < 100; index += 1) {
      assert.equal(file.undo(), true);
    }
    assert.equal(keyframeCount(file), 1);
    assert.ok(file.getKeyframe(first.keyframeId));
    assert.equal(file.history.canUndo, false);
  });

  test('1000 步受容量 100 限制', () => {
    const file = createWorld();
    for (let index = 0; index < 1000; index += 1) {
      file.addKeyframe({ timeMs: (index % 190) * 50, chartLayerIndex: 1 });
    }
    assert.equal(file.history.size, 100);
    for (let index = 0; index < 100; index += 1) file.undo();
    assert.equal(file.history.canUndo, false);
    assert.equal(keyframeCount(file), 900);
  });

  test('空 Undo/Redo、no-op、新编辑截断 redo', () => {
    const file = createWorld();
    assert.equal(file.undo(), false);
    assert.equal(file.redo(), false);
    const size = file.history.size;
    file.history.push({ label: 'noop', before: null, after: null });
    assert.equal(file.history.size, size);

    file.addKeyframe({ timeMs: 100, chartLayerIndex: 1 });
    file.addKeyframe({ timeMs: 200, chartLayerIndex: 1 });
    assert.equal(file.undo(), true);
    assert.equal(file.history.canRedo, true);
    file.addKeyframe({ timeMs: 300, chartLayerIndex: 1 });
    assert.equal(file.history.canRedo, false);
    assert.equal(keyframeCount(file), 2);
  });

  test('keyframe 边界：0 / 1 / 1000 个', () => {
    const empty = createWorld();
    assert.equal(keyframeCount(empty), 0);
    const one = createWorld();
    one.addKeyframe({ timeMs: 0, chartLayerIndex: 1 });
    assert.equal(keyframeCount(one), 1);
    const many = createWorld();
    for (let index = 0; index < 1000; index += 1) {
      many.addKeyframe({ timeMs: index * 8, chartLayerIndex: 1 }, { snap: false });
    }
    assert.equal(keyframeCount(many), 1000);
  });

  test('非法 time / layer / grid / duration / seed / missing keyframe', () => {
    const file = createWorld();
    for (const timeMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => file.addKeyframe({ timeMs, chartLayerIndex: 1 }));
    }
    assert.throws(
      () => file.addKeyframe({ timeMs: 10_001, chartLayerIndex: 1 }, { snap: false }),
    );
    assert.throws(() => file.addKeyframe({ timeMs: 1000, chartLayerIndex: 1, durationMs: -1 }));
    assert.throws(() => file.addKeyframe({ timeMs: 1000, chartLayerIndex: 0 }));
    assert.throws(() => file.addKeyframe({ timeMs: 1000, chartLayerIndex: 33 }));
    assert.throws(() => file.addKeyframe({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 0 }));
    assert.throws(() => file.addKeyframe({ timeMs: 1000, chartLayerIndex: 2, gridCellId: 9 }));
    assert.throws(() => file.setSeed(-1));
    assert.throws(() => file.setSeed(1.5));
    assert.equal(file.deleteKeyframe('missing'), false);
  });

  test('toJson → fromJson 保留 keyframes / bindings / neu / effects / seed / ai', () => {
    const file = createWorld();
    const first = file.addKeyframe({ timeMs: 0, chartLayerIndex: 1, parallaxFactor: 0.4 });
    file.setLogo(first.keyframeId, logo());
    const second = file.addKeyframe({ timeMs: 1600, chartLayerIndex: 2, gridCellId: 2 });
    file.addBinding({
      keyframeId: first.keyframeId,
      assetId: 'asset:audio:main',
      triggerAtMs: 0,
    });
    file.setEffects([
      { interfaceId: 'fx-1', effectKind: 'EaseIn', params: { durationMs: 600, intensity: 1 } },
    ]);
    file.setKeyframeEffects(first.keyframeId, ['fx-1']);
    file.setNeuModules([
      neu('a', 'RhythmPoint', [{ moduleId: 'b', port: 1 }], [], { timeMs: 0 }),
      neu('b', 'Audio', [], [{ moduleId: 'a', port: 1 }], {
        assetId: 'asset:audio:main',
        volume: 0.8,
      }),
    ]);
    file.setSeed(20261025);
    file.setAISettings({
      ...file.ai,
      mode: 'Cloud',
      keyRef: 'ai:cloud',
    });

    const json = file.toJson();
    const serialized = JSON.stringify(json);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(serialized.includes('secret'), false);
    assert.equal(serialized.includes('history'), false);

    const loaded = EditorWorldFile.fromJson(json);
    assert.equal(loaded.seed, 20261025);
    assert.equal(loaded.durationMs, 10_000);
    assert.equal(loaded.ai.mode, 'Cloud');
    assert.equal(loaded.ai.keyRef, 'ai:cloud');
    assert.deepEqual(loaded.bindings, file.bindings);
    assert.deepEqual(loaded.effects, file.effects);
    assert.deepEqual(loaded.neuModules, file.neuModules);
    assert.equal(
      loaded.getKeyframe(first.keyframeId)?.keyframe.logo?.logoId,
      'logo-1',
    );
    assert.equal(loaded.getKeyframe(second.keyframeId)?.keyframe.gridCellId, 2);
    assert.deepEqual(
      loaded.getKeyframe(first.keyframeId)?.keyframe.effectInterfaceIds,
      ['fx-1'],
    );
  });

  test('editor.json.ai 只有 keyRef，未知/raw key 字段被拒绝', () => {
    const file = createWorld();
    assert.throws(() => file.setAISettings({
      ...file.ai,
      apiKey: 'secret',
    }));
    assert.throws(() => EditorWorldFile.fromJson({
      ...file.toJson() as Record<string, unknown>,
      ai: { ...file.ai, apiKey: 'secret' },
    }));
  });

  test('export v2：0 / 1 / 多 notes 均可回读', () => {
    const empty = createWorld();
    const emptyV2 = empty.exportV2();
    const emptyParsed = parseChartSourceData(emptyV2);
    assert.equal(emptyParsed.notes.length, 0);

    const one = createWorld();
    one.addKeyframe({ timeMs: 0, chartLayerIndex: 1 });
    const oneParsed = parseChartSourceData(one.exportV2());
    assert.equal(oneParsed.notes.length, 1);

    const many = createWorld();
    many.addKeyframe({ timeMs: 0, chartLayerIndex: 1 });
    many.addKeyframe({ timeMs: 1600, chartLayerIndex: 2, gridCellId: 2 });
    many.addKeyframe({ timeMs: 4400, chartLayerIndex: 3 });
    const v2 = many.exportV2();
    const parsed = parseChartSourceData(v2);
    assert.equal(parsed.notes.length, 3);
    assert.equal(parsed.layers.length, 3);
    assert.equal(parsed.notes[1]?.gridCellId, 2);
  });

  test('非法 schema / 未知字段 / 时间倒序/重复 JSON 输入被拒绝或稳定处理', () => {
    const file = createWorld();
    assert.throws(() => EditorWorldFile.fromJson({
      ...file.toJson() as Record<string, unknown>,
      schemaVersion: 99,
    }));
    assert.throws(() => EditorWorldFile.fromJson({
      ...file.toJson() as Record<string, unknown>,
      unknownField: true,
    }));
    const parsed = parseChartSourceData(file.exportV2());
    assert.ok(Array.isArray(parsed.notes));
  });
});
