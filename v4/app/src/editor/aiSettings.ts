import {
  AIProviderMode,
} from '../../../core/ai/types';
import type { AIProviderSettings } from '../../../core/ai/types';
import { CloudProvider, LocalProvider, FallbackChain, AITaskRoute } from '../../../core/ai/providers';
import type { AIHttpPort, AIKeyStorePort } from '../../../core/ai/types';

export interface AISettings {
  readonly mode: 'Local' | 'Cloud';
  readonly localEndpoint: string;
  readonly localModel: string;
  readonly cloudEndpoint: string;
  readonly cloudModel: string;
  readonly keyRef: string;
  readonly timeoutMs: number;
  readonly fallback: readonly ('Local' | 'Cloud')[];
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  mode: 'Local',
  localEndpoint: 'http://127.0.0.1:11434',
  localModel: 'qwen2.5:7b',
  cloudEndpoint: 'https://api.openai.com/v1',
  cloudModel: 'gpt-4o-mini',
  keyRef: 'ai:cloud',
  timeoutMs: 30_000,
  fallback: ['Local'],
};

export function providerSettings(
  settings: AISettings,
  mode: AIProviderMode,
): AIProviderSettings {
  return {
    mode,
    endpoint: mode === AIProviderMode.Local ? settings.localEndpoint : settings.cloudEndpoint,
    model: mode === AIProviderMode.Local ? settings.localModel : settings.cloudModel,
    keyRef: mode === AIProviderMode.Local ? '' : settings.keyRef,
    timeoutMs: settings.timeoutMs,
    fallback: settings.fallback.map((entry) => (
      entry === 'Local' ? AIProviderMode.Local : AIProviderMode.Cloud
    )),
  };
}

/** 构建当前模式的 provider 链；Template 由 FallbackChain 隐式兜底。 */
export function buildAIChain(
  settings: AISettings,
  http: AIHttpPort,
  keyStore: AIKeyStorePort,
): FallbackChain {
  const local = new LocalProvider(providerSettings(settings, AIProviderMode.Local), http);
  const cloud = new CloudProvider(providerSettings(settings, AIProviderMode.Cloud), http, keyStore);
  return new FallbackChain(
    settings.mode === 'Cloud' ? [cloud, local] : [local],
  );
}

export function buildRhythmRoute(
  settings: AISettings,
  http: AIHttpPort,
  keyStore: AIKeyStorePort,
): AITaskRoute {
  return new AITaskRoute({
    RhythmGeneration: buildAIChain(settings, http, keyStore),
  });
}
