import {
  invoke as defaultInvoke,
  type TauriInvokeFn,
} from './tauriInvoke';
import type { AIHttpPort } from '../../core/ai/types';

interface AiHttpResponse {
  readonly status: number;
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

/** X · Tauri AI HTTP adapter；Key 由调用方放在 headers 中，本类不记录。 */
export class TauriAIHttp implements AIHttpPort {
  constructor(private readonly invokeFn: TauriInvokeFn = defaultInvoke) {}

  async postJson(input: {
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly timeoutMs: number;
  }): Promise<{ readonly status: number; readonly body: string }> {
    const result = await this.invokeFn<AiHttpResponse>('ai_http_request', {
      endpoint: input.url,
      method: 'POST',
      body: input.body,
      timeoutMs: input.timeoutMs,
      headers: input.headers,
    });
    if (!result.ok) {
      throw aiError(result.code, result.message);
    }
    return {
      status: result.value.status,
      body: result.value.body,
    };
  }
}

function aiError(code: string, message: string): Error {
  const safeCode = code === 'InvalidRequest' ? 'invalid-request' : 'network';
  const error = new Error(safeCode);
  error.name = 'TauriAIHttpError';
  // Do not include the original message: provider error text must not carry headers/body.
  void message;
  return Object.assign(error, { code: safeCode });
}
