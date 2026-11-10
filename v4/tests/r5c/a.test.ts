import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import { LayerAudioGate, LAYER_AUDIO_WINDOW_MS } from '../../app/src/game/layerAudio';

function fixture(): EditorWorldFile {
  return EditorWorldFile.create({
    documentId: 'editor-r5c',
    chartId: 'chart-r5c',
    durationMs: 10_000,
    layerAudio: { 3: 'asset:audio:sfx-layer3' },
  });
}

describe('R5c-A layer audio / Layer 3+', () => {
  test('layerAudio round-trips and normalizes null', () => {
    const file = fixture();
    assert.equal(file.layerAudio['3'], 'asset:audio:sfx-layer3');
    file.setLayerAudio(2, 'asset:audio:sfx-layer2');
    file.setLayerAudio(3, null);
    const loaded = EditorWorldFile.fromJson(file.toJson());
    assert.equal(loaded.layerAudio['2'], 'asset:audio:sfx-layer2');
    assert.equal(loaded.layerAudio['3'], null);
    assert.equal(loaded.layerAudio['1'], undefined);
  });

  test('layerAudio rejects invalid layer/asset', () => {
    const file = fixture();
    assert.throws(() => file.setLayerAudio(0, 'asset:audio:sfx-layer1'));
    assert.throws(() => file.setLayerAudio(33, 'asset:audio:sfx-layer1'));
    assert.throws(() => file.setLayerAudio(1, 'asset:video:foreground'));
  });

  test('Layer 3+ keyframe exports as FullScreen', () => {
    const file = fixture();
    const keyframe = file.addKeyframe({ timeMs: 1_000, chartLayerIndex: 3 });
    assert.equal(keyframe.chartLayerIndex, 3);
    assert.equal(keyframe.gridCellId, null);
    const v2 = file.exportV2();
    assert.equal(v2.layers.find((layer) => layer.index === 3)?.kind, 'FullScreen');
    assert.equal(v2.notes[0]?.chartLayerIndex, 3);
  });

  test('group drag moves all selected keyframes as one history entry', () => {
    const file = fixture();
    const first = file.addKeyframe({ timeMs: 1_000, chartLayerIndex: 1 });
    const second = file.addKeyframe({ timeMs: 2_000, chartLayerIndex: 2 });
    file.beginKeyframeGroupDrag([first.keyframeId, second.keyframeId], { x: 0, y: 0 });
    const result = file.updateKeyframeGroupDrag({ x: 200, y: 0 });
    assert.ok(result);
    assert.equal(result?.changed, true);
    file.commitKeyframeGroupDrag();
    assert.equal(file.getKeyframe(first.keyframeId)?.keyframe.timeMs, 2_000);
    assert.equal(file.getKeyframe(second.keyframeId)?.keyframe.timeMs, 3_000);
    assert.equal(file.history.canUndo, true);
    assert.equal(file.undo(), true);
    assert.equal(file.getKeyframe(first.keyframeId)?.keyframe.timeMs, 1_000);
    assert.equal(file.getKeyframe(second.keyframeId)?.keyframe.timeMs, 2_000);
  });

  test('LayerAudioGate dedupes and suppresses within 16ms', () => {
    const gate = new LayerAudioGate();
    assert.equal(gate.shouldSuppress(0), false);
    gate.mark('asset:audio:sfx-layer1', 100);
    assert.equal(gate.shouldSuppress(100), true);
    assert.equal(gate.shouldSuppress(100 + LAYER_AUDIO_WINDOW_MS - 1), true);
    assert.equal(gate.shouldSuppress(100 + LAYER_AUDIO_WINDOW_MS), false);
    assert.equal(gate.isDuplicate('asset:audio:sfx-layer1', 101), true);
    assert.equal(gate.isDuplicate('asset:audio:sfx-layer2', 101), false);
    gate.reset();
    assert.equal(gate.shouldSuppress(101), false);
  });
});
