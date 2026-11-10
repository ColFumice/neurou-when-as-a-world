import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CloudProvider,
  FallbackChain,
  LocalProvider,
  TemplateProvider,
} from '../../core/ai/providers';
import {
  AIProviderMode,
} from '../../core/ai/types';
import type {
  AIHttpPort,
  AIKeyStorePort,
  AIProviderSettings,
  AITaskRequest,
} from '../../core/ai/types';

const REQUEST: AITaskRequest = {
  task: 'RhythmGeneration',
  prompt: 'generate four keyframes',
};

function settings(
  mode: AIProviderMode,
  endpoint: string,
  keyRef = '',
): AIProviderSettings {
  return {
    mode,
    endpoint,
    model: 'test-model',
    keyRef,
    timeoutMs: 50,
    fallback: mode === AIProviderMode.Cloud ? [AIProviderMode.Local] : [],
  };
}

function http(handler: AIHttpPort['postJson']): AIHttpPort {
  return { postJson: handler };
}

function keys(key: string | null): AIKeyStorePort {
  return { getKey: async () => key };
}

function localOk(): AIHttpPort {
  return http(async () => ({ status: 200, body: JSON.stringify({ response: 'local-ok' }) }));
}

function cloudOk(): AIHttpPort {
  return http(async () => ({
    status: 200,
    body: JSON.stringify({ choices: [{ message: { content: 'cloud-ok' } }] }),
  }));
}

function localProvider(port: AIHttpPort = localOk()): LocalProvider {
  return new LocalProvider(settings(AIProviderMode.Local, 'http://127.0.0.1:11434'), port);
}

function cloudProvider(
  port: AIHttpPort,
  key: string | null = 'secret-key',
): CloudProvider {
  return new CloudProvider(
    settings(AIProviderMode.Cloud, 'https://ai.example.test', 'ai:cloud'),
    port,
    keys(key),
  );
}

describe('R4e.1a AI Provider / FallbackChain', () => {
  test('Local 成功 → 使用 Local 返回', async () => {
    const result = await new FallbackChain([localProvider()]).generate(REQUEST);
    assert.equal(result.provider, 'Local');
    assert.equal(result.content, 'local-ok');
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.reason, null);
  });

  test('Local 失败 → Template 兜底', async () => {
    const failing = http(async () => {
      throw new Error('local down');
    });
    const result = await new FallbackChain([localProvider(failing)]).generate(REQUEST);
    assert.equal(result.provider, 'Template');
    assert.equal(result.fallbackUsed, true);
    assert.equal(JSON.parse(result.content).template, true);
  });

  test('Cloud Key 缺失 → 不请求 HTTP，直接降级 Template', async () => {
    let calls = 0;
    const port = http(async () => {
      calls += 1;
      return { status: 200, body: '{}' };
    });
    const result = await new FallbackChain([
      cloudProvider(port, null),
    ]).generate(REQUEST);
    assert.equal(calls, 0);
    assert.equal(result.provider, 'Template');
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.reason, 'key-missing');
  });

  test('Cloud 超时 → Local → Template', async () => {
    const calls: string[] = [];
    const cloudPort = http(async () => {
      calls.push('cloud');
      throw Object.assign(new Error('timeout'), { code: 'timeout' });
    });
    const localPort = http(async () => {
      calls.push('local');
      return { status: 500, body: 'nope' };
    });
    const result = await new FallbackChain([
      cloudProvider(cloudPort),
      localProvider(localPort),
    ]).generate(REQUEST);
    assert.deepEqual(calls, ['cloud', 'local']);
    assert.equal(result.provider, 'Template');
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.reason, 'http');
  });

  test('Cloud 非 2xx → 降级 Template', async () => {
    const port = http(async () => ({ status: 503, body: 'unavailable' }));
    const result = await new FallbackChain([cloudProvider(port)]).generate(REQUEST);
    assert.equal(result.provider, 'Template');
    assert.equal(result.reason, 'http');
  });

  test('Cloud 坏 JSON → 降级 Template', async () => {
    const port = http(async () => ({ status: 200, body: '{not-json' }));
    const result = await new FallbackChain([cloudProvider(port)]).generate(REQUEST);
    assert.equal(result.provider, 'Template');
    assert.equal(result.reason, 'invalid-json');
  });

  test('Cloud 成功 → 使用 Cloud 返回', async () => {
    const result = await new FallbackChain([
      cloudProvider(cloudOk()),
    ]).generate(REQUEST);
    assert.equal(result.provider, 'Cloud');
    assert.equal(result.content, 'cloud-ok');
    assert.equal(result.fallbackUsed, false);
  });

  test('Template 永远返回结构化 JSON', async () => {
    const result = await new TemplateProvider().generate(REQUEST);
    assert.equal(result.provider, 'Template');
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    assert.equal(parsed.template, true);
    assert.equal(parsed.task, 'RhythmGeneration');
  });
});
