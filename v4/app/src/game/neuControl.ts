/**
 * R5c-B · 控制信号。
 *
 * 与视觉/音频 NeuSignal 分离；只在 Explore 由 GameScreen 路由，
 * 不进入 GamePlaybackSink。
 */

export type NeuControlAction =
  | 'EnterRhythmMode'
  | 'PlayCutscene'
  | 'ExitToExplore';

export interface NeuControlSignal {
  readonly kind: 'Control';
  readonly moduleId: string;
  readonly action: NeuControlAction;
  readonly chartId: string | null;
  readonly cutsceneId: string | null;
  readonly atMs: number;
  readonly sourceId: string | null;
}
