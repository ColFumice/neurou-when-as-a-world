/**
 * R5c-B · GameMode 与 RhythmPhase 正交状态机。
 *
 * 纯 TS，不依赖 React / DOM / 时钟。GameScreen 只做宿主；
 * Explore / Rhythm / Cutscene 的相位互斥，避免 7×3 状态矩阵。
 */

export type GameMode = 'Explore' | 'Rhythm' | 'Cutscene';

export type RhythmPhase =
  | 'loading'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

export type RhythmEntrySource = 'control' | 'debug';

export type TransitionLock =
  | 'enter-rhythm'
  | 'play-cutscene'
  | null;

export interface ExploreModeState {
  readonly mode: 'Explore';
  readonly status: 'loading' | 'ready' | 'error';
  readonly message: string | null;
  readonly transitionLock: TransitionLock;
}

export interface RhythmModeState {
  readonly mode: 'Rhythm';
  readonly phase: RhythmPhase;
  readonly chartId: string;
  readonly entrySource: RhythmEntrySource;
  readonly message: string | null;
  readonly transitionLock: TransitionLock;
}

export interface CutsceneModeState {
  readonly mode: 'Cutscene';
  readonly phase: 'loading' | 'playing' | 'error';
  readonly cutsceneId: string;
  readonly skipped: boolean;
  readonly message: string | null;
  readonly transitionLock: TransitionLock;
}

export type GameModeState =
  | ExploreModeState
  | RhythmModeState
  | CutsceneModeState;

export type GameModeAction =
  | { readonly type: 'explore-ready' }
  | { readonly type: 'explore-error'; readonly message: string }
  | { readonly type: 'enter-rhythm'; readonly chartId: string }
  | {
    readonly type: 'rhythm-loaded';
    readonly autoCountdown: boolean;
    readonly chartId?: string;
  }
  | { readonly type: 'rhythm-begin-countdown' }
  | { readonly type: 'rhythm-playing' }
  | { readonly type: 'rhythm-pause' }
  | { readonly type: 'rhythm-resume' }
  | { readonly type: 'rhythm-complete' }
  | { readonly type: 'rhythm-error'; readonly message: string }
  | { readonly type: 'exit-to-explore' }
  | { readonly type: 'play-cutscene'; readonly cutsceneId: string }
  | { readonly type: 'cutscene-started' }
  | { readonly type: 'cutscene-completed'; readonly skipped: boolean }
  | { readonly type: 'cutscene-error'; readonly message: string };

export function initialGameModeState(entry: 'explore' | 'rhythm' = 'explore'): GameModeState {
  if (entry === 'rhythm') {
    return {
      mode: 'Rhythm',
      phase: 'loading',
      chartId: '',
      entrySource: 'debug',
      message: null,
      transitionLock: 'enter-rhythm',
    };
  }
  return {
    mode: 'Explore',
    status: 'loading',
    message: null,
    transitionLock: null,
  };
}

export function exploreReady(
  message: string | null = null,
): ExploreModeState {
  return {
    mode: 'Explore',
    status: 'ready',
    message,
    transitionLock: null,
  };
}

export function reduceGameMode(
  state: GameModeState,
  action: GameModeAction,
): GameModeState {
  switch (action.type) {
    case 'explore-ready':
      if (state.mode !== 'Explore') return state;
      return { ...state, status: 'ready', message: null, transitionLock: null };

    case 'explore-error':
      if (state.mode !== 'Explore') return state;
      return {
        ...state,
        status: 'error',
        message: action.message,
        transitionLock: null,
      };

    case 'enter-rhythm':
      if (state.mode !== 'Explore' || state.status !== 'ready') return state;
      if (state.transitionLock !== null) return state;
      return {
        mode: 'Rhythm',
        phase: 'loading',
        chartId: action.chartId,
        entrySource: 'control',
        message: null,
        transitionLock: 'enter-rhythm',
      };

    case 'rhythm-loaded':
      if (state.mode !== 'Rhythm' || state.phase !== 'loading') return state;
      if (state.transitionLock !== null && state.transitionLock !== 'enter-rhythm') {
        return state;
      }
      return {
        ...state,
        phase: action.autoCountdown ? 'countdown' : 'ready',
        chartId: action.chartId ?? state.chartId,
        transitionLock: null,
      };

    case 'rhythm-begin-countdown':
      if (state.mode !== 'Rhythm' || state.phase !== 'ready') return state;
      return { ...state, phase: 'countdown', transitionLock: null };

    case 'rhythm-playing':
      if (state.mode !== 'Rhythm' || state.phase !== 'countdown') return state;
      return { ...state, phase: 'playing' };

    case 'rhythm-pause':
      if (state.mode !== 'Rhythm' || state.phase !== 'playing') return state;
      return { ...state, phase: 'paused' };

    case 'rhythm-resume':
      if (state.mode !== 'Rhythm' || state.phase !== 'paused') return state;
      return { ...state, phase: 'playing' };

    case 'rhythm-complete':
      if (state.mode !== 'Rhythm' || state.phase !== 'playing') return state;
      return { ...state, phase: 'completed', transitionLock: null };

    case 'rhythm-error':
      if (state.mode !== 'Rhythm') return state;
      return {
        ...state,
        phase: 'error',
        message: action.message,
        transitionLock: null,
      };

    case 'exit-to-explore':
      // 幂等：Explore 内再次 exit 不改任何状态。
      if (state.mode === 'Explore') return state;
      return exploreReady(null);

    case 'play-cutscene':
      if (state.mode !== 'Explore' || state.status !== 'ready') return state;
      if (state.transitionLock !== null) return state;
      return {
        mode: 'Cutscene',
        phase: 'loading',
        cutsceneId: action.cutsceneId,
        skipped: false,
        message: null,
        transitionLock: 'play-cutscene',
      };

    case 'cutscene-started':
      if (state.mode !== 'Cutscene' || state.phase !== 'loading') return state;
      return { ...state, phase: 'playing', transitionLock: null };

    case 'cutscene-completed':
      if (state.mode !== 'Cutscene') return state;
      if (state.phase !== 'loading' && state.phase !== 'playing') return state;
      return exploreReady(null);

    case 'cutscene-error':
      if (state.mode !== 'Cutscene') return state;
      return exploreReady(action.message);

    default:
      return state;
  }
}

export function modeTransitionLocked(state: GameModeState): boolean {
  return state.transitionLock !== null;
}

export function rhythmPhaseOf(state: GameModeState): RhythmPhase | null {
  return state.mode === 'Rhythm' ? state.phase : null;
}
