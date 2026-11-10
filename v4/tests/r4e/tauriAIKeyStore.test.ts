import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TauriAIKeyStore } from '../../adapters/tauri/tauriAIKeyStore';
import type { TauriInvokeFn } from '../../adapters/tauri/tauriInvoke';

describe('R4e.1b TauriAIKeyStore', () => {
  test('get/set/delete use secret_* commands with fixed service', async () => {
    const calls: { command: string; args?: Record<string, unknown> }[] = [];
    const invoke: TauriInvokeFn = (async (command, args) => {
      calls.push({ command, args });
      if (command === 'secret_get') return { ok: true, value: 'stored-key' };
      return { ok: true, value: undefined };
    }) as TauriInvokeFn;
    const store = new TauriAIKeyStore(invoke);

    assert.equal(await store.getKey('ai:cloud'), 'stored-key');
    await store.setKey('ai:cloud', 'new-key');
    await store.deleteKey('ai:cloud');

    assert.deepEqual(calls.map((call) => call.command), [
      'secret_get',
      'secret_set',
      'secret_delete',
    ]);
    assert.equal(calls[0]?.args?.service, 'cn.neurou.app');
    assert.equal(calls[0]?.args?.account, 'ai:cloud');
    assert.equal(calls[1]?.args?.value, 'new-key');
  });

  test('unavailable key store maps to key-store without leaking value', async () => {
    const invoke: TauriInvokeFn = (async () => ({
      ok: false,
      code: 'KeyStoreUnavailable',
      message: 'vault closed for secret-value',
    })) as TauriInvokeFn;
    const store = new TauriAIKeyStore(invoke);
    await assert.rejects(
      () => store.getKey('ai:cloud'),
      (error) => {
        assert.equal(String(error).includes('secret-value'), false);
        assert.equal((error as { code?: string }).code, 'key-store');
        return true;
      },
    );
  });

  test('get returns null when no entry', async () => {
    const invoke: TauriInvokeFn = (async () => ({ ok: true, value: null })) as TauriInvokeFn;
    const store = new TauriAIKeyStore(invoke);
    assert.equal(await store.getKey('ai:cloud'), null);
  });
});
