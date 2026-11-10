import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AITaskRoute, FallbackChain } from '../../core/ai/providers';
import type {
  AIProvider,
  AITaskKind,
  AITaskRequest,
  AITaskResult,
} from '../../core/ai/types';

function provider(providerId: string): AIProvider {
  return {
    providerId,
    generate: async (request: AITaskRequest): Promise<AITaskResult> => ({
      task: request.task,
      provider: providerId,
      content: `${providerId}:${request.task}`,
      fallbackUsed: false,
      reason: null,
    }),
  };
}

const TASKS: readonly AITaskKind[] = [
  'ParallaxExtraction',
  'NarrativeVector',
  'RhythmGeneration',
  'SceneVision',
  'SubtitleGeneration',
];

describe('R4e.1a AITaskRoute 五类任务路由', () => {
  test('五类任务分别路由到对应 chain', async () => {
    const routes: Partial<Record<AITaskKind, FallbackChain>> = {};
    for (const task of TASKS) {
      routes[task] = new FallbackChain([provider(`provider:${task}`)]);
    }
    const route = new AITaskRoute(routes);
    for (const task of TASKS) {
      const result = await route.generate({ task, prompt: task });
      assert.equal(result.task, task);
      assert.equal(result.provider, `provider:${task}`);
      assert.equal(result.fallbackUsed, false);
    }
  });

  test('未知任务类型 → Template 兜底', async () => {
    const routes: Partial<Record<AITaskKind, FallbackChain>> = {
      RhythmGeneration: new FallbackChain([provider('rhythm')]),
    };
    const route = new AITaskRoute(routes);
    const unknown = 'UnknownTask' as AITaskKind;
    const result = await route.generate({ task: unknown, prompt: 'unknown' });
    assert.equal(result.provider, 'Template');
    assert.equal(result.fallbackUsed, true);
    assert.equal(JSON.parse(result.content).task, 'UnknownTask');
  });

  test('已知任务 chain 全部失败 → Template 兜底', async () => {
    const failing: AIProvider = {
      providerId: 'failing',
      generate: async () => {
        throw Object.assign(new Error('down'), { code: 'timeout' });
      },
    };
    const route = new AITaskRoute({
      SceneVision: new FallbackChain([failing]),
    });
    const result = await route.generate({
      task: 'SceneVision',
      prompt: 'vision',
    });
    assert.equal(result.provider, 'Template');
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.reason, 'timeout');
  });
});
