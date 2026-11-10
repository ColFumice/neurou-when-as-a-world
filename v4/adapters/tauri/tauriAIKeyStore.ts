import {
  invoke as defaultInvoke,
  type TauriInvokeFn,
} from './tauriInvoke';
import type { AIKeyStorePort } from '../../core/ai/types';

const SERVICE = 'cn.neurou.app';

/** X · Tauri OS keychain adapter；只在 Rust 侧接触凭据。 */
export class TauriAIKeyStore implements AIKeyStorePort {
  constructor(private readonly invokeFn: TauriInvokeFn = defaultInvoke) {}

  async getKey(keyRef: string): Promise<string | null> {
    const result = await this.invokeFn<string | null>('secret_get', {
      service: SERVICE,
      account: keyRef,
    });
    if (!result.ok) throw keyStoreError();
    return result.value;
  }

  async setKey(keyRef: string, key: string): Promise<void> {
    const result = await this.invokeFn<void>('secret_set', {
      service: SERVICE,
      account: keyRef,
      value: key,
    });
    if (!result.ok) throw keyStoreError();
  }

  async deleteKey(keyRef: string): Promise<void> {
    const result = await this.invokeFn<void>('secret_delete', {
      service: SERVICE,
      account: keyRef,
    });
    if (!result.ok) throw keyStoreError();
  }
}

function keyStoreError(): Error {
  const error = new Error('key-store');
  error.name = 'TauriAIKeyStoreError';
  return Object.assign(error, { code: 'key-store' });
}
