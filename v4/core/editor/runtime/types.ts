/**
 * E · editor / runtime types
 * editor.json v2 的持久化契约；不依赖 React / Tauri / DOM。
 */

export type EditorEffectKind =
  | 'EaseIn'
  | 'EaseOut'
  | 'ScaleUp'
  | 'ScaleDown'
  | 'Glitch'
  | 'ScrollOpen'
  | 'ScrollClose'
  | 'Bounce'
  | 'Wander'
  | 'Shake';

export type EditorLightPreset =
  | 'Invert'
  | 'Noise'
  | 'Scroll'
  | 'Offset'
  | 'FlashWhite'
  | 'FlashBlack'
  | 'OverlayBlack'
  | 'OverlayWhite'
  | 'Desaturate'
  | 'Vivid'
  | 'Blur';

export interface EditorEffectParams {
  readonly durationMs?: number;
  readonly intensity?: number;
  readonly scale?: number;
  readonly direction?: number;
  readonly seed?: number;
  readonly bounceCount?: number;
  readonly initialHeight?: number;
  readonly glitchOffset?: number;
  readonly scrollAmount?: number;
  readonly shakeAmplitude?: number;
  readonly wanderRadius?: number;
  readonly opacity?: number;
}

export interface EditorEffectInterface {
  readonly interfaceId: string;
  readonly effectKind: EditorEffectKind;
  readonly params: EditorEffectParams;
}

export interface EditorBinding {
  readonly keyframeId: string;
  readonly assetId: string;
  readonly triggerAtMs: number;
}

export type NeuModuleType =
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'Delay'
  | 'Random'
  | 'RhythmPoint'
  | 'Video'
  | 'VideoStatic'
  | 'Image'
  | 'Audio'
  | 'Subtitle'
  | 'Effect'
  | 'Light'
  | 'Channel'
  | 'EnterRhythmMode'
  | 'PlayCutscene'
  | 'ExitToExplore';

export type NeuModuleParams = Record<string, string | number | boolean | string[] | null>;

export interface NeuPortTarget {
  readonly moduleId: string;
  readonly port: number;
}

export interface NeuInput {
  readonly port: number;
  readonly sourceModuleId: string;
  readonly sourcePort: number;
}

export interface NeuOutput {
  readonly port: number;
  readonly targets: readonly NeuPortTarget[];
}

export interface NeuModule {
  readonly moduleId: string;
  readonly type: NeuModuleType;
  readonly x: number;
  readonly y: number;
  readonly params: NeuModuleParams;
  readonly inputs: readonly NeuInput[];
  readonly outputs: readonly NeuOutput[];
}

export interface EditorRuntimeDocument {
  readonly bindings: readonly EditorBinding[];
  readonly neuModules: readonly NeuModule[];
  readonly effects: readonly EditorEffectInterface[];
}
