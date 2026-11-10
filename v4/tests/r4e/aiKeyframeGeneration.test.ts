import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorWorldFile } from '../../core/editor/EditorWorldFile';
import {
  applyAIKeyframeProposals,
  generationStatus,
  parseAIKeyframeProposals,
  templateKeyframeProposals,
} from '../../app/src/editor/aiKeyframeGeneration';
import type { AITaskResult } from '../../core/ai/types';

function file(): EditorWorldFile {
  return EditorWorldFile.create({
    documentId: 'doc',
    chartId: 'chart-w1',
  });
}

const PROPOSALS = [
  {
    timeMs: 1000,
    durationMs: 0,
    chartLayerIndex: 1,
    gridCellId: null,
    chartPadKind: 'TopMost' as const,
    chartKeyId: null,
  },
  {
    timeMs: 1600,
    durationMs: 0,
    chartLayerIndex: 2,
    gridCellId: 2,
    chartPadKind: 'Light' as const,
    chartKeyId: null,
  },
];

describe('R4e.1b AI keyframe generation', () => {
  test('parse 合法 keyframes；非法字段被忽略', () => {
    const parsed = parseAIKeyframeProposals(JSON.stringify({
      keyframes: [
        ...PROPOSALS,
        { timeMs: 2000, chartLayerIndex: 2, gridCellId: null, chartPadKind: 'Light' },
      ],
    }));
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed[0], PROPOSALS[0]);
  });

  test('template proposals 从 v2 notes 生成候选', () => {
    const proposals = templateKeyframeProposals([
      { timeMs: 1000, chartLayerIndex: 1 },
      { timeMs: 1600, chartLayerIndex: 2, gridCellId: 3 },
    ]);
    assert.equal(proposals.length, 2);
    assert.equal(proposals[0]?.chartPadKind, 'TopMost');
    assert.equal(proposals[1]?.gridCellId, 3);
  });

  test('确认是一次 batch 提交；Undo 移除全部，Redo 恢复全部', () => {
    const target = file();
    const created = applyAIKeyframeProposals(target, PROPOSALS);
    assert.equal(created.length, 2);
    assert.equal(target.history.size, 1);
    assert.equal(target.tracks.flatMap((track) => track.keyframes).length, 2);

    assert.equal(target.undo(), true);
    assert.equal(target.tracks.flatMap((track) => track.keyframes).length, 0);
    assert.equal(target.history.canUndo, false);

    assert.equal(target.redo(), true);
    assert.equal(target.tracks.flatMap((track) => track.keyframes).length, 2);
  });

  test('取消预览不触碰轨道与历史', () => {
    const target = file();
    const before = target.history.size;
    const proposals = parseAIKeyframeProposals(JSON.stringify({ keyframes: PROPOSALS }));
    assert.equal(proposals.length, 2);
    assert.equal(target.tracks.flatMap((track) => track.keyframes).length, 0);
    assert.equal(target.history.size, before);
  });

  test('generationStatus 标记 provider / fallback', () => {
    const result: AITaskResult = {
      task: 'RhythmGeneration',
      provider: 'Template',
      content: '{}',
      fallbackUsed: true,
      reason: 'timeout',
    };
    const status = generationStatus(result, PROPOSALS);
    assert.equal(status.status, 'Fallback');
    assert.equal(status.provider, 'Template');
    assert.equal(status.fallbackUsed, true);
    assert.equal(status.proposals?.length, 2);
  });

  test('AI settings 写入 editor.json 的 ai，raw key 字段被拒绝', () => {
    const target = file();
    target.setAISettings({
      ...target.ai,
      mode: 'Cloud',
      keyRef: 'ai:cloud',
    });
    const json = target.toJson() as { ai: Record<string, unknown> };
    assert.equal(json.ai.mode, 'Cloud');
    assert.equal(json.ai.keyRef, 'ai:cloud');
    assert.equal('apiKey' in json.ai, false);
    assert.equal(JSON.stringify(json).includes('secret-key'), false);

    const loaded = EditorWorldFile.fromJson(json);
    assert.equal(loaded.ai.mode, 'Cloud');
    assert.equal(loaded.ai.keyRef, 'ai:cloud');

    assert.throws(() => target.setAISettings({
      ...target.ai,
      apiKey: 'secret-key',
    }));
  });
});
