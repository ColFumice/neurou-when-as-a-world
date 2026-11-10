/**
 * A · ai / types
 * AI 任务路由的 A 类类型；不 import ledger / director / chart / trace，
 * 不直接发网络请求，不直接访问钥匙串。
 */

/** 五类 AI 任务。 */
export type AITaskKind =
  | 'ParallaxExtraction'
  | 'NarrativeVector'
  | 'RhythmGeneration'
  | 'SceneVision'
  | 'SubtitleGeneration';

/** 统一任务请求；prompt 是唯一文本入口。 */
export interface AITaskRequest {
  readonly task: AITaskKind;
  readonly prompt: string;
  readonly context?: Readonly<Record<string, string | number | boolean>>;
}

/** 统一任务结果；content 由各 provider 返回，模板为 JSON 字符串。 */
export interface AITaskResult {
  readonly task: AITaskKind;
  readonly provider: string;
  readonly content: string;
  readonly fallbackUsed: boolean;
  readonly reason: string | null;
}

/** 用户可选的 AI 模式；Template 不是用户模式，只作为兜底 provider。 */
export enum AIProviderMode {
  Local = 'Local',
  Cloud = 'Cloud',
}

/** 可持久化设置；keyRef 只是钥匙串引用，绝不是 Key 本身。 */
export interface AIProviderSettings {
  readonly mode: AIProviderMode;
  readonly endpoint: string;
  readonly model: string;
  readonly keyRef: string;
  readonly timeoutMs: number;
  readonly fallback: readonly AIProviderMode[];
}

/** Provider 窄口；所有实现都不直接发网络。 */
export interface AIProvider {
  readonly providerId: string;
  generate(request: AITaskRequest): Promise<AITaskResult>;
}

/** 注入的 HTTP 端口；由 app/adapters 实现。 */
export interface AIHttpPort {
  postJson(input: {
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly timeoutMs: number;
  }): Promise<{ readonly status: number; readonly body: string }>;
}

/** 注入的钥匙串端口；由 app/adapters 实现。 */
export interface AIKeyStorePort {
  getKey(keyRef: string): Promise<string | null>;
  setKey?(keyRef: string, key: string): Promise<void>;
  deleteKey?(keyRef: string): Promise<void>;
}
