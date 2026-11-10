import type { WorldInstance } from '@core/world/types';
import type { NeuModule, NeuModuleType } from '@core/editor/runtime/types';

export type { NeuModule, NeuModuleType } from '@core/editor/runtime/types';

export interface EditorEntry {
  readonly world: WorldInstance;
  readonly projectName: string;
}

export type EditorWorkspaceMode = 'ROU' | 'NEU';

export interface MediaLayers {
  readonly pairId: string;
  readonly background: string;
  readonly foreground: string;
  readonly audio: string;
  readonly leftRelPath: string;
  readonly rightRelPath: string;
  readonly audioRelPath: string;
}

export interface StageMediaOverlay {
  readonly overlayId: string;
  readonly moduleId: string;
  readonly assetId: string;
  readonly kind: 'video' | 'videoStatic' | 'image';
  readonly src: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly opacity: number;
}

export type AppNeuModule = NeuModule;
export type AppNeuModuleType = NeuModuleType;

export function neuModuleLabel(module: NeuModule): string {
  switch (module.type) {
    case 'Delay':
      return `延时 ${Number(module.params.delayMs ?? 0)}ms`;
    case 'Random':
      return `随机 ${Math.round(Number(module.params.probability ?? 0.5) * 100)}%`;
    case 'RhythmPoint':
      return `节奏点 / ${(Number(module.params.timeMs ?? 0) / 1000).toFixed(2)}s`;
    case 'Audio':
      return String(module.params.assetId ?? 'audio.wav');
    case 'Video':
    case 'VideoStatic':
    case 'Image':
      return String(module.params.assetId ?? module.type);
    case 'Subtitle':
      return String(module.params.text ?? '字幕');
    case 'Effect':
      return String(module.params.interfaceId ?? '动效接口');
    case 'Light':
      return String(module.params.mode ?? '光效');
    case 'EnterRhythmMode':
      return `进入节奏 / ${String(module.params.chartId ?? 'current')}`;
    case 'PlayCutscene':
      return `播放过场 / ${String(module.params.cutsceneId ?? '未配置')}`;
    case 'ExitToExplore':
      return '退出到探索';
    default:
      return module.type;
  }
}
