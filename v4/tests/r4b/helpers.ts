import type { NeuModule, NeuModuleType } from '../../core/editor/runtime/types';

export function neu(
  moduleId: string,
  type: NeuModuleType,
  targets: readonly string[] = [],
  inputs: readonly string[] = [],
  params: Record<string, string | number | boolean | string[] | null> = {},
): NeuModule {
  return {
    moduleId,
    type,
    x: 0.2,
    y: 0.2,
    params,
    inputs: inputs.map((sourceModuleId) => ({
      port: 1,
      sourceModuleId,
      sourcePort: 1,
    })),
    outputs: targets.length > 0
      ? [{ port: 1, targets: targets.map((moduleId) => ({ moduleId, port: 1 })) }]
      : [],
  };
}

export function rhythm(
  moduleId: string,
  timeMs: number,
  targets: readonly string[],
): NeuModule {
  return neu(moduleId, 'RhythmPoint', targets, [], { timeMs });
}

export function audio(moduleId: string, inputs: readonly string[]): NeuModule {
  return neu(moduleId, 'Audio', [], inputs, { assetId: 'asset:audio:main', volume: 0.5 });
}

export function collectKinds(signals: readonly { readonly kind: string }[]): string[] {
  return signals.map((signal) => signal.kind);
}
