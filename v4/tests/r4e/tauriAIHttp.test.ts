import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TauriAIHttp } from '../../adapters/tauri/tauriAIHttp';
import type { TauriInvokeFn } from '../../adapters/tauri/tauriInvoke';

describe('R4e.1b TauriAIHttp', () => {
  test('maps AIHttpPort to ai_http_request and returns body/status', async () => {
    const calls: { command: string; args?: Record<string, unknown> }[] = [];
    const invoke: TauriInvokeFn = (async (command, args) => {
      calls.push({ command, args });
      return {
        ok: true,
        value: { status: 200, body: '{"text":"ok"}', headers: { 'x-test': '1' } },
      };
    }) as TauriInvokeFn;
    const port = new TauriAIHttp(invoke);
    const result = await port.postJson({
      url: 'https://ai.example.test/v1/chat/completions',
      headers: { authorization: 'Bearer test' },
      body: '{"model":"m"}',
      timeoutMs: 2000,
    });
    assert.deepEqual(result, { status: 200, body: '{"text":"ok"}' });
    assert.equal(calls[0]?.command, 'ai_http_request');
    assert.equal(calls[0]?.args?.endpoint, 'https://ai.example.test/v1/chat/completions');
    assert.equal(calls[0]?.args?.method, 'POST');
    assert.equal(calls[0]?.args?.timeoutMs, 2000);
    assert.deepEqual(calls[0]?.args?.headers, { authorization: 'Bearer test' });
  });

  test('Rust failure maps to a safe error without raw message', async () => {
    const invoke: TauriInvokeFn = (async () => ({
      ok: false,
      code: 'NetworkError',
      message: 'Authorization: Bearer secret body={"x":1}',
    })) as TauriInvokeFn;
    const port = new TauriAIHttp(invoke);
    await assert.rejects(
      () => port.postJson({
        url: 'https://ai.example.test',
        headers: {},
        body: 'secret-body',
        timeoutMs: 10,
      }),
      (error) => {
        const text = String(error);
        assert.equal(text.includes('secret'), false);
        assert.equal(text.includes('Bearer'), false);
        assert.equal((error as { code?: string }).code, 'network');
        return true;
      },
    );
  });
});
