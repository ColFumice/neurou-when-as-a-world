import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudProvider, FallbackChain } from '../../core/ai/providers';
import type {
  AIHttpPort,
  AIKeyStorePort,
  AIProviderSettings,
  AITaskRequest,
} from '../../core/ai/types';
import { AIProviderMode } from '../../core/ai/types';

const KEY = 'sk-test-secret-key';
const PROMPT = 'TOP-SECRET-PROMPT';
const REQUEST: AITaskRequest = { task: 'RhythmGeneration', prompt: PROMPT };

const SETTINGS: AIProviderSettings = {
  mode: AIProviderMode.Cloud,
  endpoint: 'https://ai.example.test',
  model: 'test-model',
  keyRef: 'ai:cloud',
  timeoutMs: 50,
  fallback: [AIProviderMode.Local],
};

function keyStore(key: string | null): AIKeyStorePort {
  return { getKey: async () => key };
}

function assertNoSecrets(text: string): void {
  assert.equal(text.includes(KEY), false);
  assert.equal(text.includes('authorization'), false);
  assert.equal(text.includes(PROMPT), false);
  assert.equal(text.includes('messages'), false);
}

describe('R4e.1a AI 秘密隔离', () => {
  test('Cloud 直接错误不携带 Key / authorization / 请求体', async () => {
    let captured: {
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
    } | null = null;
    const port: AIHttpPort = {
      postJson: async (input) => {
        captured = input;
        throw new Error(`authorization: Bearer ${KEY}; body=${input.body}`);
      },
    };
    const cloud = new CloudProvider(SETTINGS, port, keyStore(KEY));
    await assert.rejects(
      () => cloud.generate(REQUEST),
      (error) => {
        assertNoSecrets(String(error));
        return true;
      },
    );
    assert.ok(captured);
    const sent = captured as unknown as {
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
    };
    assert.equal(sent.headers.authorization, `Bearer ${KEY}`);
  });

  test('FallbackChain 结果序列化不含 Key / authorization / 请求体', async () => {
    const port: AIHttpPort = {
      postJson: async (input) => {
        throw new Error(`Bearer ${KEY} ${input.body}`);
      },
    };
    const cloud = new CloudProvider(SETTINGS, port, keyStore(KEY));
    const result = await new FallbackChain([cloud]).generate(REQUEST);
    const serialized = JSON.stringify(result);
    assertNoSecrets(serialized);
    assert.equal(result.provider, 'Template');
  });

  test('钥匙串错误不泄露 Key；序列化设置不含 raw key', async () => {
    const failingStore: AIKeyStorePort = {
      getKey: async () => {
        throw new Error(`keychain failed for ${KEY}`);
      },
    };
    const cloud = new CloudProvider(
      SETTINGS,
      { postJson: async () => ({ status: 200, body: '{}' }) },
      failingStore,
    );
    await assert.rejects(
      () => cloud.generate(REQUEST),
      (error) => {
        assertNoSecrets(String(error));
        return true;
      },
    );

    const settingsJson = JSON.stringify(SETTINGS);
    assert.equal(settingsJson.includes(KEY), false);
    assert.equal(settingsJson.includes('keyRef'), true);
  });

  test('Template 结果不包含提示词正文', async () => {
    const result = await new FallbackChain([]).generate(REQUEST);
    const serialized = JSON.stringify(result);
    assertNoSecrets(serialized);
    assert.equal(JSON.parse(result.content).template, true);
  });
});
