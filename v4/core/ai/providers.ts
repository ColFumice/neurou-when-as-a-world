import type {
  AIHttpPort,
  AIKeyStorePort,
  AIProvider,
  AIProviderSettings,
  AITaskRequest,
  AITaskResult,
} from './types';
import { AIProviderMode } from './types';

type ProviderErrorCode =
  | 'timeout'
  | 'http'
  | 'invalid-json'
  | 'invalid-response'
  | 'invalid-request'
  | 'network'
  | 'key-missing'
  | 'key-store'
  | 'provider';

const SAFE_REASONS = new Set<ProviderErrorCode>([
  'timeout',
  'http',
  'invalid-json',
  'invalid-response',
  'invalid-request',
  'network',
  'key-missing',
  'key-store',
  'provider',
]);

interface CodedError extends Error {
  code: ProviderErrorCode;
}

function fail(code: ProviderErrorCode): never {
  const error = new Error(code) as CodedError;
  error.code = code;
  throw error;
}

function codeOf(error: unknown): ProviderErrorCode | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' && SAFE_REASONS.has(code as ProviderErrorCode)
    ? code as ProviderErrorCode
    : null;
}

function normalizeError(error: unknown): CodedError {
  const code = codeOf(error) ?? 'provider';
  const normalized = new Error(code) as CodedError;
  normalized.code = code;
  return normalized;
}

function safeFailureReason(error: unknown): ProviderErrorCode {
  return codeOf(error) ?? 'provider';
}

function validateSettings(settings: AIProviderSettings, requireKeyRef: boolean): void {
  if (settings.mode !== AIProviderMode.Local && settings.mode !== AIProviderMode.Cloud) {
    fail('invalid-request');
  }
  if (typeof settings.endpoint !== 'string' || settings.endpoint.trim().length === 0) {
    fail('invalid-request');
  }
  if (typeof settings.model !== 'string' || settings.model.trim().length === 0) {
    fail('invalid-request');
  }
  if (requireKeyRef && (typeof settings.keyRef !== 'string' || settings.keyRef.length === 0)) {
    fail('key-missing');
  }
  if (!Number.isFinite(settings.timeoutMs) || settings.timeoutMs <= 0) {
    fail('invalid-request');
  }
  if (!Array.isArray(settings.fallback)
    || settings.fallback.some((mode) => (
      mode !== AIProviderMode.Local && mode !== AIProviderMode.Cloud
    ))) {
    fail('invalid-request');
  }
}

function localUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  return base.endsWith('/api/generate') ? base : `${base}/api/generate`;
}

function cloudUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return fail('invalid-json');
  }
}

function nonEmptyText(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail('invalid-response');
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function localContent(body: string): string {
  const data = record(parseJson(body));
  return nonEmptyText(data?.response);
}

function cloudContent(body: string): string {
  const data = record(parseJson(body));
  const choices = data?.choices;
  if (!Array.isArray(choices) || choices.length === 0) fail('invalid-response');
  const first = record(choices[0]);
  const message = record(first?.message);
  return nonEmptyText(message?.content);
}

function validateRequest(request: AITaskRequest): void {
  if (typeof request.prompt !== 'string' || request.prompt.trim().length === 0) {
    fail('invalid-request');
  }
}

/** Ollama 兼容本地端点；不访问钥匙串。 */
export class LocalProvider implements AIProvider {
  readonly providerId = 'Local';
  private readonly settings: AIProviderSettings;
  private readonly http: AIHttpPort;

  constructor(settings: AIProviderSettings, http: AIHttpPort) {
    validateSettings(settings, false);
    this.settings = settings;
    this.http = http;
  }

  async generate(request: AITaskRequest): Promise<AITaskResult> {
    validateRequest(request);
    try {
      const response = await this.http.postJson({
        url: localUrl(this.settings.endpoint),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.settings.model,
          prompt: request.prompt,
          stream: false,
        }),
        timeoutMs: this.settings.timeoutMs,
      });
      if (response.status < 200 || response.status >= 300) fail('http');
      return {
        task: request.task,
        provider: this.providerId,
        content: localContent(response.body),
        fallbackUsed: false,
        reason: null,
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

/** OpenAI 兼容云端端点；Key 只从注入的钥匙串端口读取。 */
export class CloudProvider implements AIProvider {
  readonly providerId = 'Cloud';
  private readonly settings: AIProviderSettings;
  private readonly http: AIHttpPort;
  private readonly keyStore: AIKeyStorePort;

  constructor(
    settings: AIProviderSettings,
    http: AIHttpPort,
    keyStore: AIKeyStorePort,
  ) {
    validateSettings(settings, true);
    this.settings = settings;
    this.http = http;
    this.keyStore = keyStore;
  }

  async generate(request: AITaskRequest): Promise<AITaskResult> {
    validateRequest(request);
    let key: string | null = null;
    try {
      key = await this.keyStore.getKey(this.settings.keyRef);
    } catch {
      fail('key-store');
    }
    if (!key) fail('key-missing');

    try {
      const response = await this.http.postJson({
        url: cloudUrl(this.settings.endpoint),
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.settings.model,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: 0,
        }),
        timeoutMs: this.settings.timeoutMs,
      });
      if (response.status < 200 || response.status >= 300) fail('http');
      return {
        task: request.task,
        provider: this.providerId,
        content: cloudContent(response.body),
        fallbackUsed: false,
        reason: null,
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

/** 确定性模板兜底；始终返回可解析的 JSON 文本。 */
export class TemplateProvider implements AIProvider {
  readonly providerId = 'Template';

  async generate(request: AITaskRequest): Promise<AITaskResult> {
    return {
      task: request.task,
      provider: this.providerId,
      content: JSON.stringify({
        template: true,
        task: request.task,
        text: 'Template fallback',
      }),
      fallbackUsed: false,
      reason: null,
    };
  }
}

/**
 * 顺序降级链。
 * 每个 provider 都尝试一次；全部失败后调用 Template fallback。
 * reason 只暴露白名单错误码，绝不携带 Key / authorization / 请求体。
 */
export class FallbackChain {
  private readonly providers: readonly AIProvider[];
  private readonly fallback: AIProvider;

  constructor(
    providers: readonly AIProvider[],
    fallback: AIProvider = new TemplateProvider(),
  ) {
    this.providers = [...providers];
    this.fallback = fallback;
  }

  async generate(request: AITaskRequest): Promise<AITaskResult> {
    let lastReason: ProviderErrorCode | null = null;
    for (const provider of this.providers) {
      try {
        const result = await provider.generate(request);
        return {
          ...result,
          fallbackUsed: lastReason !== null,
          reason: lastReason,
        };
      } catch (error) {
        lastReason = safeFailureReason(error);
      }
    }
    try {
      const result = await this.fallback.generate(request);
      return {
        ...result,
        fallbackUsed: true,
        reason: lastReason ?? 'provider',
      };
    } catch (error) {
      fail(safeFailureReason(error));
    }
  }
}

/** 任务 → 降级链；未知任务一律走 Template 链。 */
export class AITaskRoute {
  private readonly routes: Readonly<Partial<Record<AITaskRequest['task'], FallbackChain>>>;
  private readonly fallback: FallbackChain;

  constructor(
    routes: Readonly<Partial<Record<AITaskRequest['task'], FallbackChain>>>,
    fallback: FallbackChain = new FallbackChain([], new TemplateProvider()),
  ) {
    this.routes = routes;
    this.fallback = fallback;
  }

  generate(request: AITaskRequest): Promise<AITaskResult> {
    const chain = this.routes[request.task];
    return (chain ?? this.fallback).generate(request);
  }
}
