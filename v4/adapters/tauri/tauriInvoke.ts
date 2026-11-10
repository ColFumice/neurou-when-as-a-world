/// <reference path="./tauri-core.d.ts" />

export interface TauriFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type TauriResult<T> =
  | { readonly ok: true; readonly value: T }
  | TauriFailure;

export type TauriInvokeFn = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<TauriResult<T>>;

export class TauriInvokeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TauriInvokeError';
    this.code = code;
  }
}

export function normalizeTauriError(error: unknown): TauriFailure {
  if (typeof error === 'object' && error !== null) {
    const record = error as { readonly code?: unknown; readonly message?: unknown };
    const code = typeof record.code === 'string' ? record.code : 'IoError';
    const message = typeof record.message === 'string'
      ? record.message
      : String(error);
    return { ok: false, code, message };
  }
  return { ok: false, code: 'IoError', message: String(error) };
}

async function rawInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(command, args ?? {});
}

/** R4f fault e2e only: page preload may set this global to simulate backend loss. */
function e2eFailure<T>(command: string): TauriResult<T> | null {
  const flag = (globalThis as unknown as {
    readonly __R4F_FAIL_INVOKE__?: boolean | readonly string[];
  }).__R4F_FAIL_INVOKE__;
  if (flag !== true && !(Array.isArray(flag) && flag.includes(command))) return null;
  return {
    ok: false,
    code: 'E2EBackendUnavailable',
    message: 'simulated Tauri command failure',
  };
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<TauriResult<T>> {
  const simulated = e2eFailure<T>(command);
  if (simulated) return simulated;
  try {
    return { ok: true, value: await rawInvoke<T>(command, args) };
  } catch (error) {
    return normalizeTauriError(error);
  }
}
