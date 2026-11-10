import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChartSnapshot } from '@core/chart/judge';
import { ChartPremiere } from '@core/chart/ChartPremiere';
import { DynamicGridScale, GridScaleRestoreCondition } from '@core/chart/grid';
import type { GridCellId } from '@core/chart/types';
import type { Strike } from '@core/director/types';
import type { RainModeState, WorldInstance } from '@core/world/types';
import { RandomPreviewMode, RandomSeed } from '@core/eventgraph/RandomMode';
import { TriggerInstance } from '@core/world/trigger';
import { FrameTracking, VisualFrameTargetLock } from '@core/world/frame';
import { GAME_LOGO_PATH } from '../editor/model';
import { AudioTriggerRuntime } from '../editor/AudioTriggerRuntime';
import { RainAudio } from './rain/RainAudio';
import { RainLayer } from './rain/RainLayer';
import { RainRuntime } from './rainRuntime';
import { ClockDriftMonitor } from './clockDrift';
import { LayerAudioGate } from './layerAudio';
import type { ClockDriftReading } from './clockDrift';
import { readBeatsSidecar } from '../audio/beatsSidecar';
import type { BeatsSidecar } from '../audio/beatsSidecar';
import { crossedDownbeats, downbeatDisplay } from './downbeatHud';
import type { DownbeatDisplay } from './downbeatHud';
import {
  handleRainOffline,
  notifyRainOnline,
  rainLogoGlow,
  rainStageClass,
  rainStageStyle,
  safeAdvanceRain,
  syncRainAudio,
  worldTintHex,
} from './rainIntegration';
import { GameNeuStage } from './GameNeuStage';
import { GridOverlay } from './GridOverlay';
import { NoteLogoLayer } from './NoteLogoLayer';
import { RhythmGuideLayer } from './RhythmGuideLayer';
import { FrameLayer } from './FrameLayer';
import { TraceLayer } from './TraceLayer';
import { R4cHud } from './R4cHud';
import { GameHud } from './GameHud';
import { isModifierCode, strikeFromKey } from './keymap';
import { PerformanceOutputClock, canReanchor, createGameClock } from './audioClock';
import type { GameClock } from './audioClock';
import { loadGameChart } from './chartLoader';
import type { LoadedGameChart } from './chartLoader';
import { advanceGameFrame } from './gameFrame';
import { formatCycleWarning, GamePlaybackSink } from './gameSignalSink';
import { GameNeuRuntime } from './neuRuntime';
import {
  EMPTY_FRAME_HELD,
  FrameController,
  frameDirectionForCode,
  routeFrameInput,
} from './frameController';
import type { FrameHeldKeys } from './frameController';
import { TraceRuntime } from './traceRuntime';
import type { TraceRuntimeEvent } from './traceRuntime';
import { TriggerRuntime } from './triggerRuntime';
import type { TriggerSink } from './triggerRuntime';
import { GameLedgerHost } from './gameLedgerHost';
import type { GameLedgerStatus } from './gameLedgerHost';
import {
  exploreReady,
  initialGameModeState,
  reduceGameMode,
} from './gameMode';
import type { GameModeAction, GameModeState } from './gameMode';
import type { NeuControlSignal } from './neuControl';
import { ExploreClock } from './exploreClock';
import { ExploreHud } from './ExploreHud';
import { CutsceneMode } from './CutsceneMode';
import { loadCutscene } from './cutsceneLoader';
import type { LoadedCutscene } from './cutsceneLoader';
import { TraceNarrativeCollector } from './narrative/TraceNarrativeCollector';
import { NeuNarrativeCollector } from './narrative/NeuNarrativeCollector';
import { TriggerNarrativeCollector } from './narrative/TriggerNarrativeCollector';
import './game.css';

type GamePhase = 'loading' | 'ready' | 'countdown' | 'playing' | 'paused' | 'completed' | 'error';

interface GameScreenProps {
  readonly world: WorldInstance;
  readonly projectName: string;
  readonly projectRoot: string;
  readonly onExit: () => void;
  readonly onEdit: () => void;
  readonly initialMode?: 'explore' | 'rhythm';
  readonly rainRuntime: RainRuntime;
  readonly rainState: RainModeState | null;
}

const ZERO_COUNTS = { perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 };
const PRE_ROLL_MS = 1200;
const GRID_SNAP_BACK_MS = 260;
const BGM_ASSET_ID = 'asset:audio:main';

/**
 * 在模块加载时捕获 query。进入 GameScreen 前，项目树/控制台可能清掉
 * location.search；若在组件内再读，?mode=rhythm 会被误判成 Explore。
 */
const INITIAL_GAME_MODE: 'explore' | 'rhythm' = (() => {
  if (typeof window === 'undefined') return 'explore';
  const mode = new URLSearchParams(window.location.search).get('mode');
  return mode === 'rhythm' ? 'rhythm' : 'explore';
})();

function initialGameMode(): 'explore' | 'rhythm' {
  return INITIAL_GAME_MODE;
}

function joinProjectPath(root: string, relPath: string): string {
  const base = root.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${relPath.replace(/\//g, separator)}`;
}

/** Live 模式专用随机源；editorSeed 不参与随机。 */
function cryptoRandomValue(): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    return Math.random();
  }
  const buffer = new Uint32Array(1);
  cryptoApi.getRandomValues(buffer);
  return (buffer[0] ?? 0) / 0x1_0000_0000;
}

function resolveGameAsset(
  loaded: LoadedGameChart,
  assetId: string,
  logoUrl: string,
): string | null {
  switch (assetId) {
    case BGM_ASSET_ID:
      return loaded.media?.audio ?? null;
    case 'asset:video:foreground':
    case 'asset:video:right':
      return loaded.media?.foreground ?? null;
    case 'asset:video:background':
    case 'asset:video:left':
      return loaded.media?.background ?? null;
    case 'asset:guidance:head-logo':
    case 'asset:image:head-logo':
    case 'builtin:head-logo':
      return logoUrl;
    default: {
      const manifestAudio = loaded.audioAssets.get(assetId);
      return manifestAudio ?? null;
    }
  }
}

function collectNeuAudioAssetIds(loaded: LoadedGameChart): string[] {
  const ids = new Set<string>();
  for (const binding of loaded.neuBindings) {
    // Binding 也引用视频/Logo 资产；只有 audio 命名空间进采样预加载。
    if (binding.assetId.startsWith('asset:audio:')) ids.add(binding.assetId);
  }
  for (const module of loaded.neuModules) {
    if (module.type !== 'Audio') continue;
    const assetId = module.params.assetId;
    if (typeof assetId === 'string' && assetId.startsWith('asset:audio:')) {
      ids.add(assetId);
    }
  }
  return [...ids];
}

/**
 * NEU 音频样本预加载。BGM 已由 R4a audioClock 持有，避免二次起播。
 * 失败只影响该样本，不阻塞进入世界。
 */
function preloadNeuAudio(
  runtime: AudioTriggerRuntime,
  loaded: LoadedGameChart,
  bgmOwned: boolean,
  logoUrl: string,
): void {
  for (const assetId of collectNeuAudioAssetIds(loaded)) {
    if (bgmOwned && assetId === BGM_ASSET_ID) continue;
    const url = resolveGameAsset(loaded, assetId, logoUrl);
    if (!url) continue;
    void runtime.load(assetId, url).catch(() => undefined);
  }
}

export function GameScreen({
  world,
  projectName,
  projectRoot,
  onExit,
  onEdit,
  initialMode,
  rainRuntime,
  rainState,
}: GameScreenProps) {
  const [rainSuspended, setRainSuspended] = useState(false);
  const [clockDrift, setClockDrift] = useState<ClockDriftReading | null>(null);
  const [beats, setBeats] = useState<DownbeatDisplay | null>(null);
  const [downbeatPulse, setDownbeatPulse] = useState(false);
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [chart, setChart] = useState<LoadedGameChart | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [goFlash, setGoFlash] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandValue, setCommandValue] = useState('');
  const [commandNotice, setCommandNotice] = useState<string | null>(null);
  const [bootFlash, setBootFlash] = useState(true);
  const [, setTick] = useState(0);
  const [flashCells, setFlashCells] = useState<ReadonlySet<GridCellId>>(new Set());
  const [audio, setAudio] = useState(false);
  const [clockReady, setClockReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [neuWarnings, setNeuWarnings] = useState<readonly string[]>([]);
  const [r4cWarnings, setR4cWarnings] = useState<readonly string[]>([]);
  const [narrativeWarnings, setNarrativeWarnings] = useState<readonly string[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<GameLedgerStatus>('Unavailable');
  const [ledgerMessage, setLedgerMessage] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<string | null>(null);
  const [frameHintVisible, setFrameHintVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modeState, setModeState] = useState<GameModeState>(() => (
    initialGameModeState(initialMode ?? initialGameMode())
  ));
  const [exploreNotice, setExploreNotice] = useState<string | null>(null);
  const [cutsceneData, setCutsceneData] = useState<LoadedCutscene | null>(null);
  const exploreStatus = modeState.mode === 'Explore' ? modeState.status : null;

  const modeStateRef = useRef(modeState);
  const modeRef = useRef(modeState.mode);
  const exploreClockRef = useRef(new ExploreClock());
  const exploreRafRef = useRef(0);
  const exploreNeuRuntimeRef = useRef<GameNeuRuntime | null>(null);
  const exploreActiveRef = useRef(false);
  const lastExploreNowRef = useRef<number | null>(null);
  const controlHandlerRef = useRef<(signal: NeuControlSignal) => void>(() => undefined);
  const beginCountdownRef = useRef<() => void>(() => undefined);
  const returnToExploreRef = useRef<() => void>(() => undefined);
  const cutsceneRequestRef = useRef(0);

  const phaseRef = useRef<GamePhase>('loading');
  const chartRef = useRef<LoadedGameChart | null>(null);
  const snapshotRef = useRef<ChartSnapshot | null>(null);
  const clockRef = useRef<GameClock | null>(null);
  const neuRuntimeRef = useRef<GameNeuRuntime | null>(null);
  const signalSinkRef = useRef<GamePlaybackSink | null>(null);
  const audioTriggerRef = useRef<AudioTriggerRuntime | null>(null);
  const layerAudioGateRef = useRef(new LayerAudioGate());
  const layerAudioDebugRef = useRef<{ count: number; last: { layerIndex: number; assetId: string; atMs: number } | null }>({
    count: 0,
    last: null,
  });
  const traceRuntimeRef = useRef<TraceRuntime | null>(null);
  const triggerRuntimeRef = useRef<TriggerRuntime | null>(null);
  const ledgerHostRef = useRef<GameLedgerHost | null>(null);
  const traceCollectorRef = useRef<TraceNarrativeCollector | null>(null);
  const neuCollectorRef = useRef<NeuNarrativeCollector | null>(null);
  const triggerCollectorRef = useRef<TriggerNarrativeCollector | null>(null);
  const finishingRef = useRef(false);
  const ledgerNoticeTimerRef = useRef(0);
  const frameHeldRef = useRef<FrameHeldKeys>({ ...EMPTY_FRAME_HELD });
  const consumedFrameCodesRef = useRef<Set<string>>(new Set());
  const lastFrameNowRef = useRef<number | null>(null);
  const frameHintTimerRef = useRef(0);
  const r4cFailureReportedRef = useRef(false);
  const bgmOwnedRef = useRef(false);
  const neuFailureReportedRef = useRef(false);
  const rafRef = useRef(0);
  const driftMonitor = useMemo(() => new ClockDriftMonitor(), []);
  const driftFrameRef = useRef(0);
  const inputPausedRef = useRef(false);
  const lastReanchorWallRef = useRef(Number.NEGATIVE_INFINITY);
  const reanchorCountRef = useRef(0);
  const hudClearRafRef = useRef(0);
  const criticalDriftRef = useRef<ClockDriftReading | null>(null);
  const beatsRef = useRef<BeatsSidecar | null>(null);
  const lastDownbeatPlayheadRef = useRef(-1);
  const downbeatTimerRef = useRef(0);
  const countdownRef = useRef(0);
  const preRollActiveRef = useRef(false);
  const preRollStartRef = useRef(0);
  const startingRef = useRef(false);
  const restoreTimersRef = useRef(new Map<GridCellId, number[]>());
  const holdLocksRef = useRef<Set<GridCellId>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const clearDriftHud = useCallback(() => {
    cancelAnimationFrame(hudClearRafRef.current);
    hudClearRafRef.current = 0;
    criticalDriftRef.current = null;
    setClockDrift(null);
  }, []);
  const grid = useMemo(() => new DynamicGridScale(), []);
  const frameController = useMemo(() => new FrameController(), []);
  const logoUrl = useMemo(() => {
    try {
      return convertFileSrc(GAME_LOGO_PATH);
    } catch {
      return GAME_LOGO_PATH;
    }
  }, []);
  const themeImageUrl = useMemo(() => {
    try {
      return convertFileSrc(joinProjectPath(projectRoot, 'media/images/theme-rain-night.webp'));
    } catch {
      return null;
    }
  }, [projectRoot]);
  const worldImageUrl = useMemo(() => {
    try {
      return convertFileSrc(joinProjectPath(projectRoot, 'media/images/world-rain-night.webp'));
    } catch {
      return null;
    }
  }, [projectRoot]);
  const rainAudio = useMemo(() => new RainAudio(), []);
  const worldTint = useMemo(() => worldTintHex(world.themeColor), [world.themeColor]);
  const rainActive = rainState?.active === true && !rainSuspended;
  const rainGlow = rainActive ? rainLogoGlow(rainState) : null;
  const hasTraces = (chart?.traces.length ?? 0) > 0 && traceRuntimeRef.current !== null;

  useEffect(() => {
    syncRainAudio(rainAudio, rainSuspended ? null : rainState);
  }, [rainAudio, rainState, rainSuspended]);

  useEffect(() => () => {
    rainAudio.dispose();
  }, [rainAudio]);

  useEffect(() => {
    const api = {
      export: (): string => JSON.stringify(driftMonitor.exportDebug(), null, 2),
      get: () => driftMonitor.exportDebug(),
      clear: (): void => driftMonitor.clearDebug(),
    };
    (window as unknown as { __NEUROU_CLOCK_DEBUG__?: typeof api }).__NEUROU_CLOCK_DEBUG__ = api;
    return () => {
      const current = window as unknown as { __NEUROU_CLOCK_DEBUG__?: typeof api };
      if (current.__NEUROU_CLOCK_DEBUG__ === api) delete current.__NEUROU_CLOCK_DEBUG__;
    };
  }, [driftMonitor]);

  useEffect(() => {
    const api = {
      get: () => ({ ...layerAudioDebugRef.current }),
      reset: (): void => {
        layerAudioDebugRef.current = { count: 0, last: null };
        layerAudioGateRef.current.reset();
      },
    };
    (window as unknown as { __NEUROU_LAYER_AUDIO__?: typeof api }).__NEUROU_LAYER_AUDIO__ = api;
    return () => {
      const current = window as unknown as { __NEUROU_LAYER_AUDIO__?: typeof api };
      if (current.__NEUROU_LAYER_AUDIO__ === api) delete current.__NEUROU_LAYER_AUDIO__;
    };
  }, []);

  useEffect(() => {
    const unlock = (): void => {
      if (rainActive) void rainAudio.resume();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [rainActive, rainAudio]);

  useEffect(() => {
    const onOnline = (): void => notifyRainOnline(rainRuntime);
    const onOffline = (): void => handleRainOffline(rainRuntime);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [rainRuntime]);

  const setPhaseSafe = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const applyMode = useCallback((action: GameModeAction): GameModeState => {
    const next = reduceGameMode(modeStateRef.current, action);
    modeStateRef.current = next;
    modeRef.current = next.mode;
    setModeState(next);
    return next;
  }, []);

  /** NEU 异常只写 HUD warning，且同一局只报一次，避免每帧刷屏。 */
  const reportNeuError = useCallback((caught: unknown) => {
    if (neuFailureReportedRef.current) return;
    neuFailureReportedRef.current = true;
    const message = `NEU 执行异常（已隔离）：${caught instanceof Error ? caught.message : String(caught)}`;
    setNeuWarnings((previous) => (
      previous.includes(message) ? previous : [...previous, message]
    ));
  }, []);

  const reportR4cError = useCallback((caught: unknown) => {
    if (r4cFailureReportedRef.current) return;
    r4cFailureReportedRef.current = true;
    const message = `R4C 执行异常（已隔离）：${caught instanceof Error ? caught.message : String(caught)}`;
    setR4cWarnings((previous) => (
      previous.includes(message) ? previous : [...previous, message]
    ));
  }, []);

  const reportNarrativeWarning = useCallback((message: string) => {
    setNarrativeWarnings((previous) => (
      previous.includes(message) ? previous : [...previous, message]
    ));
  }, []);

  const showLedgerMessage = useCallback((message: string | null, transient = false) => {
    window.clearTimeout(ledgerNoticeTimerRef.current);
    setLedgerMessage(message);
    if (message && transient) {
      ledgerNoticeTimerRef.current = window.setTimeout(() => {
        setLedgerMessage(null);
      }, 4000);
    }
  }, []);

  useEffect(() => () => {
    window.clearTimeout(ledgerNoticeTimerRef.current);
  }, []);

  const clearFrameHeld = useCallback(() => {
    frameHeldRef.current = { ...EMPTY_FRAME_HELD };
  }, []);

  const stopExploreLoop = useCallback(() => {
    exploreActiveRef.current = false;
    cancelAnimationFrame(exploreRafRef.current);
    exploreRafRef.current = 0;
    exploreClockRef.current.pause();
    lastExploreNowRef.current = null;
  }, []);

  const startExploreLoop = useCallback(() => {
    if (modeRef.current !== 'Explore' || !chartRef.current) return;
    if (!exploreClockRef.current.isRunning) {
      const offset = exploreClockRef.current.nowMs();
      exploreClockRef.current.start(offset);
    }
    exploreActiveRef.current = true;
    cancelAnimationFrame(exploreRafRef.current);
    lastExploreNowRef.current = null;
    const step = (): void => {
      if (!exploreActiveRef.current || modeRef.current !== 'Explore') return;
      const now = exploreClockRef.current.nowMs();
      const previous = lastExploreNowRef.current;
      lastExploreNowRef.current = now;
      const dt = previous === null ? 0 : Math.max(0, now - previous);
      try {
        frameController.update(dt, frameHeldRef.current);
      } catch (caught) {
        reportR4cError(caught);
      }
      try {
        traceRuntimeRef.current?.advanceTo(now, frameController.rect);
      } catch (caught) {
        reportR4cError(caught);
      }
      try {
        triggerRuntimeRef.current?.advanceTo(
          now,
          frameController.rect,
          frameController.deltaX,
        );
      } catch (caught) {
        reportR4cError(caught);
      }
      try {
        exploreNeuRuntimeRef.current?.advanceTo(now, true);
      } catch (caught) {
        reportNeuError(caught);
      }
      signalSinkRef.current?.prune(now);
      setPlayheadMs(now);
      setTick((value) => value + 1);
      exploreRafRef.current = requestAnimationFrame(step);
    };
    exploreRafRef.current = requestAnimationFrame(step);
  }, [frameController, reportNeuError, reportR4cError]);

  /** Rhythm 懒会话：进入时才建 snapshot / BGM clock / 完整 NEU。 */
  const buildRhythmSession = useCallback(async (loaded: LoadedGameChart): Promise<void> => {
    if (snapshotRef.current && clockRef.current && neuRuntimeRef.current) return;
    const snapshot = new ChartSnapshot({
      durationMs: loaded.durationMs,
      layers: loaded.layers,
      notes: loaded.notes,
    });
    snapshotRef.current = snapshot;
    const created = await createGameClock(
      loaded.media?.audio ?? null,
      loaded.durationMs,
    );
    clockRef.current = created.clock;
    bgmOwnedRef.current = created.audio;
    setAudio(created.audio);
    setClockReady(true);
    const sink = signalSinkRef.current;
    const collector = neuCollectorRef.current;
    if (!sink || !collector) {
      throw new Error('NEU sink unavailable; rhythm session cannot start');
    }
    neuRuntimeRef.current = new GameNeuRuntime({
      modules: loaded.neuModules,
      effects: loaded.neuEffects,
      bindings: loaded.neuBindings,
      seed: new RandomSeed(loaded.editorSeed),
      mode: RandomPreviewMode.Live,
      randomValue: cryptoRandomValue,
      sink: collector,
      activation: 'Rhythm',
      assetResolver: {
        resolve: (assetId) => resolveGameAsset(loaded, assetId, logoUrl),
      },
    });
    const audioRuntime = audioTriggerRef.current;
    if (audioRuntime) {
      preloadNeuAudio(audioRuntime, loaded, created.audio, logoUrl);
    }
  }, [logoUrl]);

  const disposeRhythmSession = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clockRef.current?.dispose();
    clockRef.current = null;
    snapshotRef.current = null;
    neuRuntimeRef.current?.dispose();
    neuRuntimeRef.current = null;
    audioTriggerRef.current?.stopAll();
    bgmOwnedRef.current = false;
    setAudio(false);
    setClockReady(false);
  }, []);

  /** B2 调试入口：Explore 内 /rhythm；旧 ?mode=rhythm 仍在初始状态直达。 */
  const enterRhythmDebug = useCallback(() => {
    if (modeRef.current !== 'Explore') return;
    const loaded = chartRef.current;
    if (!loaded) return;
    stopExploreLoop();
    const next = applyMode({ type: 'enter-rhythm', chartId: loaded.chartId });
    if (next.mode !== 'Rhythm') return;
    setPhaseSafe('loading');
    void buildRhythmSession(loaded).then(() => {
      applyMode({
        type: 'rhythm-loaded',
        autoCountdown: false,
        chartId: loaded.chartId,
      });
      setPhaseSafe('ready');
    }).catch((error) => {
      applyMode({ type: 'rhythm-error', message: error instanceof Error ? error.message : String(error) });
      setPhaseSafe('error');
    });
  }, [applyMode, buildRhythmSession, setPhaseSafe, stopExploreLoop]);

  const finishCutscene = useCallback((skipped: boolean) => {
    cutsceneRequestRef.current += 1;
    setCutsceneData(null);
    applyMode({ type: 'cutscene-completed', skipped });
    setPhaseSafe('ready');
    startExploreLoop();
  }, [applyMode, setPhaseSafe, startExploreLoop]);

  const handleExploreControl = useCallback((signal: NeuControlSignal) => {
    const loaded = chartRef.current;
    if (!loaded) return;
    if (signal.action === 'PlayCutscene') {
      const cutsceneId = signal.cutsceneId;
      if (cutsceneId === null || cutsceneId.trim() === '') {
        setExploreNotice('NEU PlayCutscene 忽略：cutsceneId 为空');
        return;
      }
      if (modeRef.current !== 'Explore') return;
      stopExploreLoop();
      const next = applyMode({ type: 'play-cutscene', cutsceneId });
      if (next.mode !== 'Cutscene') return;
      const token = cutsceneRequestRef.current + 1;
      cutsceneRequestRef.current = token;
      setCutsceneData(null);
      void loadCutscene(projectRoot, cutsceneId, loaded).then((data) => {
        if (cutsceneRequestRef.current !== token || modeRef.current !== 'Cutscene') return;
        setCutsceneData(data);
        applyMode({ type: 'cutscene-started' });
        for (const warning of data.warnings) setExploreNotice(warning);
      }).catch((error) => {
        if (cutsceneRequestRef.current !== token) return;
        const message = error instanceof Error ? error.message : String(error);
        setExploreNotice(`Cutscene 未播放：${message}`);
        applyMode({ type: 'cutscene-error', message });
        setPhaseSafe('ready');
        startExploreLoop();
      });
      return;
    }
    if (signal.action === 'EnterRhythmMode') {
      if (signal.chartId !== null && signal.chartId !== loaded.chartId) {
        setExploreNotice(`NEU EnterRhythm 忽略：chartId ${signal.chartId} 不是当前 ${loaded.chartId}`);
        return;
      }
      if (modeRef.current !== 'Explore') return;
      stopExploreLoop();
      const next = applyMode({ type: 'enter-rhythm', chartId: loaded.chartId });
      if (next.mode !== 'Rhythm') return;
      setPhaseSafe('loading');
      void buildRhythmSession(loaded).then(() => {
        if (modeRef.current !== 'Rhythm') return;
        applyMode({
          type: 'rhythm-loaded',
          autoCountdown: true,
          chartId: loaded.chartId,
        });
        setPhaseSafe('ready');
        beginCountdownRef.current();
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setExploreNotice(`Rhythm 启动失败：${message}`);
        applyMode({ type: 'rhythm-error', message });
        returnToExploreRef.current();
      });
      return;
    }
    if (signal.action === 'ExitToExplore') {
      if (modeRef.current === 'Rhythm') returnToExploreRef.current();
      return;
    }
    const target = signal.cutsceneId ?? '';
    setExploreNotice(`NEU ${signal.action}${target ? ` · ${target}` : ''}`);
  }, [applyMode, buildRhythmSession, projectRoot, setPhaseSafe, startExploreLoop, stopExploreLoop]);
  controlHandlerRef.current = handleExploreControl;

  const clearFrameInput = useCallback(() => {
    clearFrameHeld();
    consumedFrameCodesRef.current.clear();
  }, [clearFrameHeld]);

  const showFrameHint = useCallback(() => {
    const loaded = chartRef.current;
    if (!loaded || loaded.traces.length === 0 || traceRuntimeRef.current === null) return;
    setFrameHintVisible(true);
    window.clearTimeout(frameHintTimerRef.current);
    frameHintTimerRef.current = window.setTimeout(() => {
      setFrameHintVisible(false);
    }, 7000);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(frameHintTimerRef.current);
  }, []);

  const clearRestoreTimers = useCallback(() => {
    for (const timers of restoreTimersRef.current.values()) {
      for (const timer of timers) window.clearTimeout(timer);
    }
    restoreTimersRef.current.clear();
  }, []);

  const flashCell = useCallback((cell: GridCellId) => {
    grid.hit(cell);
    const existing = restoreTimersRef.current.get(cell);
    if (existing) {
      for (const timer of existing) window.clearTimeout(timer);
    }
    setFlashCells((current) => {
      const next = new Set(current);
      next.add(cell);
      return next;
    });
    const restoreTimer = window.setTimeout(() => {
      // Hold 仍按住时，格子必须保持 1.5×，不能被 tap 的自动缩回覆盖。
      if (!holdLocksRef.current.has(cell)) grid.restore(cell);
      setTick((value) => value + 1);
    }, GRID_SNAP_BACK_MS);
    const clearTimer = window.setTimeout(() => {
      setFlashCells((current) => {
        const next = new Set(current);
        next.delete(cell);
        return next;
      });
      restoreTimersRef.current.delete(cell);
    }, GRID_SNAP_BACK_MS + 220);
    restoreTimersRef.current.set(cell, [restoreTimer, clearTimer]);
  }, [grid]);

  const syncHoldLocks = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    const next = new Set<GridCellId>();
    for (const note of snapshot.notes) {
      if (note.hold === null) continue;
      if (note.chartLayerIndex === 2 && note.gridCellId !== null) {
        next.add(note.gridCellId);
      } else {
        next.add(1);
      }
    }
    for (const cell of holdLocksRef.current) {
      if (!next.has(cell)) grid.restore(cell);
    }
    holdLocksRef.current = next;
    for (const cell of next) grid.hit(cell);
  }, [grid]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    // 从 ProjectConsole 进入时可能残留文本选择；游戏内清掉，避免选区高亮盖在 HUD 上。
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootFlash(false), 320);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const active = !commandOpen && (
      (phase === 'playing' && modeState.mode === 'Rhythm')
      || (modeState.mode === 'Explore' && modeState.status === 'ready')
    );
    frameController.setActive(active);
    if (!active) clearFrameInput();
  }, [clearFrameInput, commandOpen, exploreStatus, frameController, modeState.mode, phase]);

  useEffect(() => {
    const onBlur = (): void => {
      clearFrameInput();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [clearFrameInput]);

  useEffect(() => {
    let alive = true;
    chartRef.current = null;
    snapshotRef.current = null;
    clockRef.current?.dispose();
    clockRef.current = null;
    neuRuntimeRef.current?.dispose();
    neuRuntimeRef.current = null;
    exploreNeuRuntimeRef.current?.dispose();
    exploreNeuRuntimeRef.current = null;
    signalSinkRef.current?.dispose();
    signalSinkRef.current = null;
    audioTriggerRef.current?.dispose();
    audioTriggerRef.current = null;
    traceRuntimeRef.current?.reset();
    traceRuntimeRef.current = null;
    triggerRuntimeRef.current?.dispose();
    triggerRuntimeRef.current = null;
    ledgerHostRef.current?.dispose();
    ledgerHostRef.current = null;
    traceCollectorRef.current = null;
    neuCollectorRef.current = null;
    triggerCollectorRef.current = null;
    finishingRef.current = false;
    window.clearTimeout(ledgerNoticeTimerRef.current);
    setLedgerStatus('Unavailable');
    setLedgerMessage(null);
    frameController.reset();
    clearFrameInput();
    lastFrameNowRef.current = null;
    r4cFailureReportedRef.current = false;
    setR4cWarnings([]);
    setLastTrigger(null);
    setFrameHintVisible(false);
    window.clearTimeout(frameHintTimerRef.current);
    setNarrativeWarnings([]);
    bgmOwnedRef.current = false;
    neuFailureReportedRef.current = false;
    setChart(null);
    setClockReady(false);
    setAudio(false);
    setWarning(null);
    setNeuWarnings([]);
    setError(null);
    setPhaseSafe('loading');

    const load = async (): Promise<void> => {
      try {
        const loaded = await loadGameChart(world.worldId, projectRoot);
        if (!alive) {
          loaded.dispose();
          return;
        }
        chartRef.current = loaded;
        setChart(loaded);

        try {
          const host = new GameLedgerHost(projectRoot, world.worldId, loaded.chartId);
          ledgerHostRef.current = host;
          const status = await host.load();
          if (!alive) {
            host.dispose();
            return;
          }
          setLedgerStatus(status);
          if (status === 'PremiereRecorded') {
            showLedgerMessage('首演已记录');
          } else if (status === 'Corrupt') {
            showLedgerMessage(`账本只读：${host.getDiagnostic() ?? 'ledger is corrupt'}`);
          } else if (status === 'Unavailable') {
            showLedgerMessage(`账本不可用：${host.getDiagnostic() ?? 'ledger is unavailable'}`);
          } else {
            showLedgerMessage(null);
          }
        } catch (caught) {
          setLedgerStatus('Unavailable');
          showLedgerMessage(`账本初始化失败：${caught instanceof Error ? caught.message : String(caught)}`);
        }

        // NEU sink 在 Explore 就需要（探索资源/控制流）；BGM clock 延迟到 Rhythm。
        // NEU 初始化失败只降级，不阻断 R4a 谱面进入 ready。
        try {
          const audioRuntime = new AudioTriggerRuntime();
          audioTriggerRef.current = audioRuntime;
          const sink = new GamePlaybackSink({
            audio: {
              play: (assetId, volume) => {
                // BGM 由 R4a audioClock 持有，NEU/Binding 不再二次起播。
                if (bgmOwnedRef.current && assetId === BGM_ASSET_ID) return false;
                // R5c-A.2：Layer Audio 命中后的同 tick 窗口优先。
                if (layerAudioGateRef.current.shouldSuppress(performance.now())) return false;
                return audioRuntime.play(assetId, volume);
              },
              stopAll: () => audioRuntime.stopAll(),
            },
            modules: loaded.neuModules,
            effects: loaded.neuEffects,
            resolveAsset: (assetId) => resolveGameAsset(loaded, assetId, logoUrl),
            onCycleWarning: (cycleWarning) => {
              if (!alive) return;
              const message = formatCycleWarning(cycleWarning);
              setNeuWarnings((previous) => (
                previous.includes(message) ? previous : [...previous, message]
              ));
            },
          });
          signalSinkRef.current = sink;
          const neuCollector = new NeuNarrativeCollector(sink, reportNarrativeWarning);
          neuCollectorRef.current = neuCollector;
          exploreNeuRuntimeRef.current = new GameNeuRuntime({
            modules: loaded.neuModules,
            effects: loaded.neuEffects,
            bindings: loaded.neuBindings,
            seed: new RandomSeed(loaded.editorSeed),
            mode: RandomPreviewMode.Live,
            randomValue: cryptoRandomValue,
            sink: neuCollector,
            activation: 'Explore',
            onControl: (signal) => controlHandlerRef.current(signal),
            assetResolver: {
              resolve: (assetId) => resolveGameAsset(loaded, assetId, logoUrl),
            },
          });
          preloadNeuAudio(audioRuntime, loaded, false, logoUrl);
          for (const assetId of loaded.layerAudio.values()) {
            const url = resolveGameAsset(loaded, assetId, logoUrl);
            if (url) void audioRuntime.load(assetId, url).catch(() => undefined);
          }
        } catch (caught) {
          const message = `NEU 初始化失败（已降级）：${caught instanceof Error ? caught.message : String(caught)}`;
          setNeuWarnings((previous) => [...previous, message]);
        }

        setR4cWarnings(loaded.r4cWarnings);
        try {
          const pulseExplore = (sourceId: string): void => {
            exploreNeuRuntimeRef.current?.pulse(sourceId);
          };
          const traceCollector = new TraceNarrativeCollector(
            loaded.traces,
            reportNarrativeWarning,
          );
          traceCollectorRef.current = traceCollector;
          const traceSink = {
            emit: (event: TraceRuntimeEvent): void => {
              traceCollector.emit(event);
              if (event.kind === 'Touched' || event.kind === 'Revealed') {
                pulseExplore(`trace:${event.traceId}`);
              }
            },
          };
          traceRuntimeRef.current = new TraceRuntime(loaded.traces, traceSink);
          const triggerSink: TriggerSink = {
            enter: (signal) => {
              if (alive) setLastTrigger(`TriggerEnter · ${signal.triggerId}`);
              pulseExplore(`trigger:${signal.triggerId}`);
            },
            exit: (signal) => {
              if (alive) setLastTrigger(`TriggerExit · ${signal.triggerId}`);
              pulseExplore(`trigger:${signal.triggerId}`);
            },
            dwell: (signal) => {
              if (alive) setLastTrigger(`TriggerDwell · ${signal.triggerId}`);
              pulseExplore(`trigger:${signal.triggerId}`);
            },
            occupancy: (signal) => {
              if (alive) setLastTrigger(`TriggerOccupancy · ${signal.triggerId}`);
              pulseExplore(`trigger:${signal.triggerId}`);
            },
            parallax: (signal) => {
              if (alive) setLastTrigger(`TriggerParallax · ${signal.triggerId}`);
              pulseExplore(`trigger:${signal.triggerId}`);
            },
          };
          const triggerInstances = loaded.triggers.map((definition) => new TriggerInstance({
            triggerId: definition.triggerId,
            eventSignalId: definition.eventSignalId,
            region: definition.region,
            dwellMs: definition.dwellMs,
            ...(definition.occupancyThreshold === null
              ? {}
              : { occupancyThreshold: definition.occupancyThreshold }),
            occupancyIntervalMs: definition.occupancyIntervalMs,
            ...(definition.parallaxLayer === null
              ? {}
              : { parallaxLayer: definition.parallaxLayer }),
            parallaxFactor: definition.parallaxFactor,
            parallaxStep: definition.parallaxStep,
          }));
          const triggerCollector = new TriggerNarrativeCollector(
            triggerSink,
            reportNarrativeWarning,
          );
          triggerCollectorRef.current = triggerCollector;
          triggerRuntimeRef.current = new TriggerRuntime(
            triggerInstances,
            triggerCollector,
            reportR4cError,
          );
        } catch (caught) {
          reportR4cError(caught);
        }

        const messages = [...loaded.warnings];
        setWarning(messages.length > 0 ? messages.join(' · ') : null);
        if (modeRef.current === 'Rhythm') {
          await buildRhythmSession(loaded);
          if (!alive) return;
          setPhaseSafe('ready');
          applyMode({
            type: 'rhythm-loaded',
            autoCountdown: false,
            chartId: loaded.chartId,
          });
        } else {
          setPhaseSafe('ready');
          applyMode({ type: 'explore-ready' });
          window.requestAnimationFrame(() => {
            if (alive) startExploreLoop();
          });
        }
      } catch (caught) {
        if (!alive) return;
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setPhaseSafe('error');
        if (modeRef.current === 'Rhythm') {
          applyMode({ type: 'rhythm-error', message });
        } else {
          applyMode({ type: 'explore-error', message });
        }
      }
    };
    void load();

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(exploreRafRef.current);
      exploreActiveRef.current = false;
      exploreClockRef.current.reset();
      window.clearInterval(countdownRef.current);
      preRollActiveRef.current = false;
      clearRestoreTimers();
      holdLocksRef.current.clear();
      clockRef.current?.dispose();
      chartRef.current?.dispose();
      neuRuntimeRef.current?.dispose();
      exploreNeuRuntimeRef.current?.dispose();
      signalSinkRef.current?.dispose();
      audioTriggerRef.current?.dispose();
      traceRuntimeRef.current?.reset();
      triggerRuntimeRef.current?.dispose();
      ledgerHostRef.current?.dispose();
      clockRef.current = null;
      chartRef.current = null;
      neuRuntimeRef.current = null;
      exploreNeuRuntimeRef.current = null;
      signalSinkRef.current = null;
      audioTriggerRef.current = null;
      traceRuntimeRef.current = null;
      triggerRuntimeRef.current = null;
      ledgerHostRef.current = null;
      traceCollectorRef.current = null;
      neuCollectorRef.current = null;
      triggerCollectorRef.current = null;
      finishingRef.current = false;
      frameController.reset();
      clearFrameInput();
      lastFrameNowRef.current = null;
      window.clearTimeout(frameHintTimerRef.current);
      window.clearTimeout(ledgerNoticeTimerRef.current);
      bgmOwnedRef.current = false;
    };
  }, [
    applyMode,
    buildRhythmSession,
    clearFrameInput,
    clearRestoreTimers,
    frameController,
    logoUrl,
    projectRoot,
    reportNarrativeWarning,
    reportR4cError,
    setPhaseSafe,
    showLedgerMessage,
    startExploreLoop,
    world.worldId,
  ]);

  useEffect(() => {
    let alive = true;
    setBeats(null);
    setDownbeatPulse(false);
    beatsRef.current = null;
    lastDownbeatPlayheadRef.current = -1;
    window.clearTimeout(downbeatTimerRef.current);
    if (!chart) return () => { alive = false; };
    void readBeatsSidecar(projectRoot, chart.chartId).then((result) => {
      if (!alive) return;
      setBeats(downbeatDisplay(result.sidecar));
      beatsRef.current = result.sidecar;
      lastDownbeatPlayheadRef.current = -1;
    }).catch(() => {
      if (!alive) return;
      setBeats(null);
      beatsRef.current = null;
    });
    return () => {
      alive = false;
    };
  }, [chart?.chartId, projectRoot]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    cancelAnimationFrame(rafRef.current);
    preRollActiveRef.current = false;
    clearRestoreTimers();
    setFlashCells(new Set());
    holdLocksRef.current.clear();
    setGoFlash(false);
    grid.reset();
    const snapshot = snapshotRef.current;
    const loaded = chartRef.current;
    if (!snapshot || !loaded) {
      finishingRef.current = false;
      return;
    }
    const naturalFinish = phaseRef.current === 'playing';
    const normalReturnToExplore = modeRef.current === 'Rhythm'
      && modeStateRef.current.mode === 'Rhythm'
      && modeStateRef.current.entrySource !== 'debug';
    clockRef.current?.pause();
    snapshot.advance(loaded.durationMs);
    // R4a 结算完成后再收尾 NEU；异常仍只进 HUD，不改变判定结果。
    const neuRuntime = neuRuntimeRef.current;
    if (neuRuntime) {
      try {
        neuRuntime.advanceTo(loaded.durationMs, true);
      } catch (caught) {
        reportNeuError(caught);
      }
      if (!normalReturnToExplore) {
        neuRuntime.dispose();
        neuRuntimeRef.current = null;
      }
    }

    const traceStats = traceCollectorRef.current?.snapshot() ?? {
      tracesTotal: 0,
      tracesRevealed: 0,
      tracesTouched: 0,
      deepRevealed: 0,
      anomalousRevealed: 0,
      rainRevealed: 0,
      frameLost: 0,
      exitPerception: 0,
    };
    const neuStats = neuCollectorRef.current?.snapshot() ?? {
      neuAudioModules: 0,
      neuEffectModules: 0,
      neuLightModules: 0,
      neuResourceModules: 0,
      neuSubtitleModules: 0,
      bindingAudioCount: 0,
    };
    const triggerStats = triggerCollectorRef.current?.snapshot() ?? {
      triggerEnter: 0,
      triggerExit: 0,
      triggerDwell: 0,
      triggerOccupancy: 0,
      triggerParallax: 0,
    };

    if (!normalReturnToExplore) {
      signalSinkRef.current?.dispose();
      signalSinkRef.current = null;
      audioTriggerRef.current?.dispose();
      audioTriggerRef.current = null;
      traceRuntimeRef.current?.reset();
      traceRuntimeRef.current = null;
      triggerRuntimeRef.current?.dispose();
      triggerRuntimeRef.current = null;
    }
    frameController.setActive(false);
    clearFrameInput();
    lastFrameNowRef.current = null;
    setFrameHintVisible(false);
    window.clearTimeout(frameHintTimerRef.current);

    const counts = snapshot.counts;
    const decided = counts.perfect + counts.good + counts.miss;
    const complete = naturalFinish
      && loaded.notes.length > 0
      && decided === loaded.notes.length;
    const host = ledgerHostRef.current;
    let nextMessage: string | null = null;
    let wrote = false;

    if (!naturalFinish) {
      nextMessage = '未自然完成，未写首演';
    } else if (loaded.source === 'fallback') {
      nextMessage = 'fallback 谱面不写首演';
    } else if (loaded.notes.length === 0 || decided !== loaded.notes.length) {
      nextMessage = '判定未收束，未写首演';
    } else if (!host) {
      nextMessage = '账本不可用，未写首演';
    } else if (complete) {
      try {
        const premiere = new ChartPremiere({
          chartId: loaded.chartId,
          source: loaded.source,
          completed: true,
          totalNotes: loaded.notes.length,
          perfect: counts.perfect,
          good: counts.good,
          miss: counts.miss,
          maxCombo: counts.maxCombo,
          tracesTotal: traceStats.tracesTotal,
          tracesRevealed: traceStats.tracesRevealed,
          tracesTouched: traceStats.tracesTouched,
          deepRevealed: traceStats.deepRevealed,
          anomalousRevealed: traceStats.anomalousRevealed,
          rainRevealed: traceStats.rainRevealed,
          frameLost: traceStats.frameLost,
          neuAudioModules: neuStats.neuAudioModules,
          neuEffectModules: neuStats.neuEffectModules,
          neuLightModules: neuStats.neuLightModules,
          neuResourceModules: neuStats.neuResourceModules,
          neuSubtitleModules: neuStats.neuSubtitleModules,
          triggerEnter: triggerStats.triggerEnter,
          triggerExit: triggerStats.triggerExit,
          triggerDwell: triggerStats.triggerDwell,
          triggerOccupancy: triggerStats.triggerOccupancy,
          triggerParallax: triggerStats.triggerParallax,
        });
        const checkpoint = await host.recordPremiere(premiere, Date.now());
        setLedgerStatus(host.getStatus());
        if (checkpoint) {
          wrote = true;
          nextMessage = '首演已写入账本';
        } else if (host.getStatus() === 'PremiereRecorded') {
          nextMessage = '首演已记录';
        } else {
          nextMessage = host.getDiagnostic() ?? '首演未写入账本';
        }
      } catch (caught) {
        setLedgerStatus(host.getStatus());
        nextMessage = `首演写入失败：${caught instanceof Error ? caught.message : String(caught)}`;
      }
    }

    if (!naturalFinish || !complete) {
      setLedgerStatus(host?.getStatus() ?? 'Unavailable');
    }
    showLedgerMessage(nextMessage, wrote);
    setPlayheadMs(loaded.durationMs);
    setTick((value) => value + 1);
    setPhaseSafe('completed');
    setRainSuspended(true);
    rainAudio.setEnabled(false);
    driftMonitor.reset();
    inputPausedRef.current = false;
    clearDriftHud();
    lastReanchorWallRef.current = Number.NEGATIVE_INFINITY;
    window.clearTimeout(downbeatTimerRef.current);
    setDownbeatPulse(false);
    finishingRef.current = false;
  }, [
    clearDriftHud,
    clearFrameInput,
    clearRestoreTimers,
    driftMonitor,
    frameController,
    grid,
    rainAudio,
    reportNeuError,
    setPhaseSafe,
    showLedgerMessage,
  ]);

  const returnToExplore = useCallback(() => {
    if (modeRef.current !== 'Rhythm') return;
    cancelAnimationFrame(rafRef.current);
    window.clearInterval(countdownRef.current);
    countdownRef.current = 0;
    preRollActiveRef.current = false;
    clockRef.current?.pause();
    audioTriggerRef.current?.stopAll();
    disposeRhythmSession();
    finishingRef.current = false;
    grid.reset();
    setGoFlash(false);
    setFlashCells(new Set());
    holdLocksRef.current.clear();
    setRainSuspended(false);
    setPhaseSafe('ready');
    applyMode({ type: 'exit-to-explore' });
    clearFrameInput();
    frameController.setActive(true);
    clearDriftHud();
    setDownbeatPulse(false);
    lastFrameNowRef.current = null;
    lastExploreNowRef.current = null;
    setPlayheadMs(exploreClockRef.current.nowMs());
    startExploreLoop();
  }, [
    applyMode,
    clearDriftHud,
    clearFrameInput,
    disposeRhythmSession,
    frameController,
    grid,
    setPhaseSafe,
    startExploreLoop,
  ]);
  returnToExploreRef.current = returnToExplore;

  const loop = useCallback(() => {
    const clock = clockRef.current;
    const snapshot = snapshotRef.current;
    const loaded = chartRef.current;
    if (!clock || !snapshot || !loaded) return;
    if (phaseRef.current !== 'playing') return;

    const now = clock.nowMs();
    // R5a.3：Downbeat 只做 HUD 闪烁，不参与判定/NEU。
    const beatSidecar = beatsRef.current;
    if (beatSidecar) {
      const crossed = crossedDownbeats(
        beatSidecar.downbeatsMs,
        lastDownbeatPlayheadRef.current,
        now,
      );
      lastDownbeatPlayheadRef.current = now;
      if (crossed.length > 0) {
        setDownbeatPulse(true);
        window.clearTimeout(downbeatTimerRef.current);
        downbeatTimerRef.current = window.setTimeout(() => {
          setDownbeatPulse(false);
        }, 120);
      }
    }
    // Rain 是旁路：异常或异步失败绝不打断 R4a 帧循环。
    safeAdvanceRain(rainRuntime, now);
    // AC4-24：每 30 帧采样一次，只观测/显示，不改 playhead 或 audioClock。
    driftFrameRef.current += 1;
    if (driftFrameRef.current % 30 === 0) {
      const sampleWall = performance.now();
      const clockDebug = clock.debugSnapshot?.();
      const reading = driftMonitor.sample(now, sampleWall, {
        ...clockDebug,
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
        reanchorCount: reanchorCountRef.current,
        source: clockDebug?.source ?? 'fallback',
      });
      let reanchored = false;
      if (reading.shouldReanchor && canReanchor(sampleWall, lastReanchorWallRef.current)) {
        try {
          clock.reanchor?.();
        } catch {
          // reanchor 失败静默；帧循环继续。
        }
        lastReanchorWallRef.current = sampleWall;
        reanchorCountRef.current += 1;
        const debug = globalThis as unknown as { __R4F_REANCHOR_COUNT__?: number };
        debug.__R4F_REANCHOR_COUNT__ = (debug.__R4F_REANCHOR_COUNT__ ?? 0) + 1;
        reanchored = true;
      }
      if (reading.status === 'Critical') {
        criticalDriftRef.current = reading;
        setClockDrift(reading);
      } else if (criticalDriftRef.current) {
        setClockDrift(criticalDriftRef.current);
      } else if (reanchored) {
        setClockDrift(reading);
        // 不等到下一次 30 帧采样：下一帧立即清 HUD，保留一帧可见状态。
        cancelAnimationFrame(hudClearRafRef.current);
        hudClearRafRef.current = window.requestAnimationFrame(() => {
          hudClearRafRef.current = 0;
          setClockDrift(null);
        });
      } else {
        setClockDrift(reading);
      }
      if (reading.inputPaused) inputPausedRef.current = true;
    }
    // 固定顺序：先 R4a snapshot.advance，再 NEU；NEU 异常被 advanceGameFrame 隔离。
    const frame = advanceGameFrame(
      { snapshot, neuRuntime: neuRuntimeRef.current },
      now,
      true,
    );
    if (frame.neuError !== null) reportNeuError(frame.neuError);

    const previousNow = lastFrameNowRef.current;
    lastFrameNowRef.current = now;
    const dtMs = previousNow === null ? 0 : now - previousNow;
    try {
      frameController.update(dtMs, frameHeldRef.current);
    } catch (caught) {
      reportR4cError(caught);
    }
    try {
      traceRuntimeRef.current?.advanceTo(now, frameController.rect);
    } catch (caught) {
      reportR4cError(caught);
    }
    try {
      triggerRuntimeRef.current?.advanceTo(
        now,
        frameController.rect,
        frameController.deltaX,
      );
    } catch (caught) {
      reportR4cError(caught);
    }

    signalSinkRef.current?.prune(now);
    syncHoldLocks();
    setPlayheadMs(now);
    setTick((value) => value + 1);

    if (now >= loaded.durationMs) {
      void finish();
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [driftMonitor, finish, frameController, rainRuntime, reportNeuError, reportR4cError, syncHoldLocks]);

  const chartNow = useCallback((): number => {
    if (preRollActiveRef.current) {
      const elapsed = performance.now() - preRollStartRef.current;
      return Math.min(0, elapsed - PRE_ROLL_MS);
    }
    return clockRef.current?.nowMs() ?? 0;
  }, []);

  const strikeTrace = useCallback(() => {
    const exploring = modeRef.current === 'Explore';
    if (exploring) {
      if (!exploreActiveRef.current) return;
    } else if (phaseRef.current !== 'playing') {
      return;
    }
    const runtime = traceRuntimeRef.current;
    if (!runtime) return;
    const atMs = exploring ? exploreClockRef.current.nowMs() : chartNow();
    try {
      runtime.strike(atMs, frameController.rect);
    } catch (caught) {
      reportR4cError(caught);
    }
    setPlayheadMs(atMs);
    setTick((value) => value + 1);
  }, [chartNow, frameController, reportR4cError]);

  const startAudioAndLoop = useCallback(async () => {
    const loaded = chartRef.current;
    const clock = clockRef.current;
    if (!loaded || !clock || phaseRef.current !== 'playing') return;
    try {
      await clock.start(0);
    } catch (caught) {
      clock.dispose();
      const fallback = new PerformanceOutputClock(loaded.durationMs);
      await fallback.start(0);
      clockRef.current = fallback;
      bgmOwnedRef.current = false;
      setAudio(false);
      const trigger = audioTriggerRef.current;
      if (trigger) preloadNeuAudio(trigger, loaded, false, logoUrl);
      setWarning((previous) => [
        previous,
        `WebAudio 启动失败，使用无音频时钟：${caught instanceof Error ? caught.message : String(caught)}`,
      ].filter((item): item is string => Boolean(item)).join(' · '));
    }
    if (phaseRef.current !== 'playing') return;
    setPlayheadMs(0);
    setGoFlash(true);
    driftFrameRef.current = 0;
    inputPausedRef.current = false;
    clearDriftHud();
    lastReanchorWallRef.current = Number.NEGATIVE_INFINITY;
    driftMonitor.start(0, performance.now());
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [clearDriftHud, driftMonitor, logoUrl, loop]);

  const loopPreRoll = useCallback(() => {
    if (phaseRef.current !== 'playing' || !preRollActiveRef.current) return;
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    const now = chartNow();
    safeAdvanceRain(rainRuntime, now);
    snapshot.advance(now);
    setPlayheadMs(now);
    setTick((value) => value + 1);
    if (now >= 0) {
      preRollActiveRef.current = false;
      void startAudioAndLoop();
      return;
    }
    rafRef.current = requestAnimationFrame(loopPreRoll);
  }, [chartNow, rainRuntime, startAudioAndLoop]);

  const startPlay = useCallback(() => {
    if (startingRef.current) return;
    startingRef.current = true;
    const loaded = chartRef.current;
    const snapshot = snapshotRef.current;
    const clock = clockRef.current;
    if (!loaded || !snapshot || !clock) {
      startingRef.current = false;
      return;
    }

    window.clearInterval(countdownRef.current);
    clearRestoreTimers();
    setFlashCells(new Set());
    holdLocksRef.current.clear();
    snapshot.reset();
    // NEU 生命周期与谱面同步重置；0ms 的 binding/NEU 由首个正式 rAF 帧触发。
    neuRuntimeRef.current?.reset(0);
    signalSinkRef.current?.reset();
    neuFailureReportedRef.current = false;
    setNeuWarnings([]);
    traceRuntimeRef.current?.reset();
    triggerRuntimeRef.current?.reset();
    traceCollectorRef.current?.reset();
    neuCollectorRef.current?.reset();
    triggerCollectorRef.current?.reset();
    finishingRef.current = false;
    frameController.reset();
    frameController.setActive(true);
    clearFrameInput();
    lastFrameNowRef.current = null;
    r4cFailureReportedRef.current = false;
    setLastTrigger(null);
    showFrameHint();
    // 预滚：从 -1200ms 推进到 0，让 0ms 的首 note 有 1.2s 可见/可击窗口。
    snapshot.advance(-PRE_ROLL_MS);
    grid.reset();
    setPlayheadMs(-PRE_ROLL_MS);
    setCountdown(0);
    setGoFlash(false);
    setTick((value) => value + 1);
    setPhaseSafe('playing');
    setRainSuspended(false);
    startingRef.current = false;
    preRollActiveRef.current = true;
    preRollStartRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loopPreRoll);
  }, [
    clearFrameInput,
    clearRestoreTimers,
    frameController,
    grid,
    loopPreRoll,
    setPhaseSafe,
    showFrameHint,
  ]);

  const beginCountdown = useCallback(() => {
    if (modeRef.current !== 'Rhythm' || phaseRef.current !== 'ready') return;
    void clockRef.current?.unlock().catch(() => undefined);
    // 用户手势内解锁 NEU 采样上下文；失败只影响音效，不阻塞倒计时。
    void audioTriggerRef.current?.resume().catch(() => false);
    setPhaseSafe('countdown');
    setCountdown(3);
    window.clearInterval(countdownRef.current);
    let remaining = 3;
    countdownRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      window.clearInterval(countdownRef.current);
      countdownRef.current = 0;
      setCountdown(0);
      void startPlay();
    }, 700);
  }, [setPhaseSafe, startPlay]);
  beginCountdownRef.current = beginCountdown;

  const pause = useCallback(() => {
    if (finishingRef.current) return;
    if (phaseRef.current !== 'playing') return;
    if (preRollActiveRef.current) return;
    cancelAnimationFrame(rafRef.current);
    clockRef.current?.pause();
    audioTriggerRef.current?.stopAll();
    rainAudio.setEnabled(false);
    setRainSuspended(true);
    driftMonitor.reset();
    clearDriftHud();
    lastReanchorWallRef.current = Number.NEGATIVE_INFINITY;
    frameController.setActive(false);
    clearFrameInput();
    setPhaseSafe('paused');
  }, [clearDriftHud, clearFrameInput, driftMonitor, frameController, rainAudio, setPhaseSafe]);

  const resume = useCallback(async () => {
    if (phaseRef.current !== 'paused') return;
    const clock = clockRef.current;
    if (!clock) return;
    try {
      await clock.resume();
    } catch (caught) {
      setWarning((previous) => [
        previous,
        `恢复失败：${caught instanceof Error ? caught.message : String(caught)}`,
      ].filter((item): item is string => Boolean(item)).join(' · '));
      return;
    }
    frameController.setActive(true);
    lastFrameNowRef.current = null;
    clearFrameInput();
    setRainSuspended(false);
    syncRainAudio(rainAudio, rainState);
    driftFrameRef.current = 0;
    inputPausedRef.current = false;
    clearDriftHud();
    lastReanchorWallRef.current = Number.NEGATIVE_INFINITY;
    driftMonitor.start(clock.nowMs(), performance.now());
    setPhaseSafe('playing');
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [clearDriftHud, clearFrameInput, driftMonitor, frameController, loop, rainAudio, rainState, setPhaseSafe]);

  const exit = useCallback(() => {
    if (finishingRef.current) return;
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(exploreRafRef.current);
    exploreActiveRef.current = false;
    exploreClockRef.current.reset();
    cutsceneRequestRef.current += 1;
    setCutsceneData(null);
    window.clearInterval(countdownRef.current);
    preRollActiveRef.current = false;
    clearRestoreTimers();
    setFlashCells(new Set());
    holdLocksRef.current.clear();
    clockRef.current?.dispose();
    chartRef.current?.dispose();
    neuRuntimeRef.current?.dispose();
    exploreNeuRuntimeRef.current?.dispose();
    signalSinkRef.current?.dispose();
    audioTriggerRef.current?.dispose();
    traceRuntimeRef.current?.reset();
    triggerRuntimeRef.current?.dispose();
    ledgerHostRef.current?.dispose();
    clockRef.current = null;
    chartRef.current = null;
    neuRuntimeRef.current = null;
    exploreNeuRuntimeRef.current = null;
    signalSinkRef.current = null;
    audioTriggerRef.current = null;
    traceRuntimeRef.current = null;
    triggerRuntimeRef.current = null;
    ledgerHostRef.current = null;
    traceCollectorRef.current = null;
    neuCollectorRef.current = null;
    triggerCollectorRef.current = null;
    finishingRef.current = false;
    frameController.setActive(false);
    clearFrameInput();
    lastFrameNowRef.current = null;
    window.clearTimeout(frameHintTimerRef.current);
    window.clearTimeout(ledgerNoticeTimerRef.current);
    setFrameHintVisible(false);
    setLedgerMessage(null);
    bgmOwnedRef.current = false;
    setRainSuspended(true);
    rainAudio.dispose();
    driftMonitor.reset();
    inputPausedRef.current = false;
    clearDriftHud();
    lastReanchorWallRef.current = Number.NEGATIVE_INFINITY;
    window.clearTimeout(downbeatTimerRef.current);
    setDownbeatPulse(false);
    onExit();
  }, [clearDriftHud, clearFrameInput, clearRestoreTimers, driftMonitor, frameController, onExit, rainAudio]);

  const submitCommand = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const raw = commandValue.trim().toLowerCase();
    const command = raw.startsWith('/') ? raw.slice(1).trim() : raw;
    if (command === 'edit') {
      setCommandOpen(false);
      setCommandValue('');
      setCommandNotice(null);
      onEdit();
      return;
    }
    if (command === 'exit' || command === 'quit') {
      setCommandOpen(false);
      setCommandValue('');
      setCommandNotice(null);
      exit();
      return;
    }
    if (command === 'rhythm') {
      setCommandOpen(false);
      setCommandValue('');
      enterRhythmDebug();
      return;
    }
    if (command === 'explore') {
      setCommandOpen(false);
      setCommandValue('');
      returnToExplore();
      return;
    }
    if (command === 'help' || command === '') {
      setCommandNotice('edit → 编辑器 · rhythm → 调试 Rhythm · exit → 退出 · Esc 关闭');
      return;
    }
    setCommandNotice(`unknown command: ${command}`);
  };

  const emitLayerAudio = useCallback((layerIndex: number, atMs: number) => {
    const loaded = chartRef.current;
    const audio = audioTriggerRef.current;
    if (!loaded || !audio) return;
    const assetId = loaded.layerAudio.get(layerIndex);
    if (!assetId || assetId === BGM_ASSET_ID) return;
    const now = performance.now();
    if (layerAudioGateRef.current.isDuplicate(assetId, now)) return;
    const played = audio.play(assetId, 0.9);
    if (!played) return;
    layerAudioGateRef.current.mark(assetId, now);
    layerAudioDebugRef.current = {
      count: layerAudioDebugRef.current.count + 1,
      last: { layerIndex, assetId, atMs },
    };
  }, []);

  const submitStrike = useCallback((strike: Strike) => {
    if (inputPausedRef.current) return;
    const snapshot = snapshotRef.current;
    const clock = clockRef.current;
    if (!snapshot || !clock || phaseRef.current !== 'playing') return;
    const atMs = chartNow();
    snapshot.submit({ ...strike, timeMs: atMs }, atMs);
    const event = snapshot.lastEvent;
    if (event && event.judgement !== 'Miss') {
      emitLayerAudio(event.layerIndex, atMs);
    }
    if (event
      && event.judgement !== 'Miss'
      && event.layerIndex === 2
      && event.gridCellId !== null) {
      flashCell(event.gridCellId as GridCellId);
    }
    syncHoldLocks();
    setPlayheadMs(atMs);
    setTick((value) => value + 1);
  }, [chartNow, emitLayerAudio, flashCell, syncHoldLocks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (finishingRef.current) return;
      if (event.repeat) return;
      if ((event.target as HTMLElement | null)?.closest('.game-command')) return;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        return;
      }
      const current = phaseRef.current;

      if (commandOpen) {
        if (event.code === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setCommandOpen(false);
          setCommandValue('');
          setCommandNotice(null);
        }
        return;
      }

      if (event.code === 'Slash' && current !== 'countdown') {
        event.preventDefault();
        event.stopPropagation();
        if (current === 'playing') pause();
        setCommandValue('');
        setCommandNotice(null);
        setCommandOpen(true);
        window.requestAnimationFrame(() => commandInputRef.current?.focus());
        return;
      }

      if (modeRef.current === 'Explore') {
        if (event.code === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          exit();
          return;
        }
        if (event.shiftKey) {
          const direction = frameDirectionForCode(event.code);
          if (direction !== null) {
            event.preventDefault();
            event.stopPropagation();
            frameHeldRef.current = {
              ...frameHeldRef.current,
              [direction]: true,
            };
            consumedFrameCodesRef.current.add(event.code);
            frameController.setActive(true);
            return;
          }
          if (event.code === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            consumedFrameCodesRef.current.add('Enter');
            strikeTrace();
          }
        }
        return;
      }

      if (current === 'ready') {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          beginCountdown();
        }
        return;
      }
      if (current === 'countdown') return;
      if (current === 'paused') {
        if (event.code === 'Space' || event.code === 'Enter' || event.code === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          void resume();
        }
        return;
      }
      if (current === 'completed' || current === 'error') {
        if (event.code === 'Enter' || event.code === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (modeStateRef.current.mode === 'Rhythm'
            && modeStateRef.current.entrySource !== 'debug') {
            returnToExplore();
          } else {
            exit();
          }
        }
        return;
      }
      if (current !== 'playing') return;

      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        pause();
        return;
      }
      if (isModifierCode(event.code)) return;

      const route = routeFrameInput({
        code: event.code,
        shiftKey: event.shiftKey,
        phase: current,
        commandOpen,
        hasTraces,
      });
      if (route.kind === 'frame-move') {
        event.preventDefault();
        event.stopPropagation();
        frameHeldRef.current = {
          ...frameHeldRef.current,
          [route.direction]: true,
        };
        consumedFrameCodesRef.current.add(event.code);
        frameController.setActive(true);
        return;
      }
      if (route.kind === 'frame-strike') {
        event.preventDefault();
        event.stopPropagation();
        consumedFrameCodesRef.current.add('Enter');
        strikeTrace();
        return;
      }
      if (route.kind === 'ignore') return;

      const strike = strikeFromKey(event.code, 'Down', chartNow());
      if (!strike) return;
      event.preventDefault();
      event.stopPropagation();
      submitStrike(strike);
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (finishingRef.current) return;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        clearFrameHeld();
        return;
      }
      if (consumedFrameCodesRef.current.has(event.code)) {
        consumedFrameCodesRef.current.delete(event.code);
        const direction = frameDirectionForCode(event.code);
        if (direction !== null) {
          frameHeldRef.current = {
            ...frameHeldRef.current,
            [direction]: false,
          };
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (modeRef.current === 'Explore') return;
      if (phaseRef.current !== 'playing') return;
      if (isModifierCode(event.code)) return;
      const strike = strikeFromKey(event.code, 'Up', chartNow());
      if (!strike) return;
      event.preventDefault();
      event.stopPropagation();
      submitStrike(strike);
    };

    const onVisibility = (): void => {
      if (document.hidden) pause();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    beginCountdown,
    chartNow,
    clearFrameHeld,
    commandOpen,
    exit,
    frameController,
    hasTraces,
    pause,
    resume,
    returnToExplore,
    strikeTrace,
    submitStrike,
  ]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (modeRef.current !== 'Rhythm') return;
    if (finishingRef.current) return;
    if (inputPausedRef.current) return;
    if (phaseRef.current !== 'playing' || event.button !== 0) return;
    const element = contentRef.current;
    const snapshot = snapshotRef.current;
    const clock = clockRef.current;
    if (!element || !snapshot || !clock) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };

    grid.restoreIfOutside(
      point,
      GridScaleRestoreCondition.ClickOutsideEnlargedRect,
    );
    const cell = grid.hitTest(point);
    const atMs = chartNow();
    const strike: Strike = {
      timeMs: atMs,
      phase: 'Down',
      source: 'Pointer',
      ...(cell === null
        ? {}
        : { chartKeyId: `Grid${cell}`, gridCellId: cell }),
    };
    snapshot.submit(strike, atMs);
    const judged = snapshot.lastEvent;
    if (judged && judged.judgement !== 'Miss') {
      emitLayerAudio(judged.layerIndex, atMs);
    }
    if (judged
      && judged.judgement !== 'Miss'
      && judged.layerIndex === 2
      && judged.gridCellId !== null) {
      flashCell(judged.gridCellId as GridCellId);
    }
    syncHoldLocks();
    setPlayheadMs(atMs);
    setTick((value) => value + 1);
    event.preventDefault();
  };

  const snapshot = snapshotRef.current;
  const counts = snapshot?.counts ?? ZERO_COUNTS;
  const score = snapshot?.score ?? 0;
  const notes = snapshot?.notes ?? [];
  const mode = modeState.mode;
  const exploring = mode === 'Explore';
  const isDebugRhythm = modeState.mode === 'Rhythm' && modeState.entrySource === 'debug';
  const exploreActive = exploring && modeState.status === 'ready';
  const showField = mode === 'Rhythm' && phase !== 'loading' && phase !== 'error';
  const showStart = mode === 'Rhythm' && phase === 'ready' && clockReady && chart !== null;
  const traceRuntime = traceRuntimeRef.current;
  const traceViews = traceRuntime?.views ?? [];
  const frameTracking = traceRuntime?.primaryTracking ?? FrameTracking.Idle;
  const frameLock = traceRuntime?.primaryLock ?? VisualFrameTargetLock.Unlocked;
  const frameLabel = `FRAME ${frameTracking} / ${frameLock}`;
  const hudWarning = [warning, ...neuWarnings, ...r4cWarnings, ...narrativeWarnings]
    .filter((item): item is string => Boolean(item))
    .join(' · ') || null;

  return (
    <div className="game-screen">
      <div className="game-screen__backdrop" aria-hidden="true" />
      {bootFlash ? <div className="game-boot-flash" aria-hidden="true" /> : null}
      <GameNeuStage
        sink={signalSinkRef.current}
        media={chart?.media ?? null}
        playheadMs={playheadMs}
        playing={mode === 'Explore' ? exploreActive : phase === 'playing'}
        fallbackImageUrl={worldImageUrl}
      />

      <div
        className={`game-content${rainActive ? ` ${rainStageClass(rainState)}` : ''}`}
        style={rainActive ? rainStageStyle(rainState, worldTint) : undefined}
        ref={contentRef}
        onPointerDown={onPointerDown}
      >
        {showField ? (
          <>
            <GridOverlay
              grid={grid}
              blind={false}
              flashCells={flashCells}
            />
            {phase === 'playing' || phase === 'paused' ? (
              <RhythmGuideLayer
                notes={notes}
                grid={grid}
                playheadMs={playheadMs}
                blind={false}
              />
            ) : null}
            <NoteLogoLayer
              notes={notes}
              grid={grid}
              playheadMs={playheadMs}
              blind={false}
              logoUrl={logoUrl}
              rainGlow={rainGlow}
            />
          </>
        ) : null}
        {hasTraces ? (
          <>
            <FrameLayer
              visible={exploreActive || (showField && (phase === 'playing' || phase === 'paused'))}
              rect={frameController.rect}
              tracking={frameTracking}
              lock={frameLock}
              enabled={hasTraces}
            />
            <TraceLayer
              visible={hasTraces && (exploreActive || (showField && (phase === 'playing' || phase === 'paused')))}
              traces={traceViews}
              playheadMs={playheadMs}
            />
          </>
        ) : null}
        <RainLayer
          rainModeState={rainActive ? rainState : null}
          worldTint={worldTint}
        />
      </div>

      {chart && mode === 'Rhythm' ? (
        <GameHud
          chartId={chart.chartId}
          worldId={world.worldId}
          playheadMs={playheadMs}
          durationMs={chart.durationMs}
          counts={counts}
          score={score}
          audio={audio}
          source={chart.source}
          warning={hudWarning}
          clockDrift={clockDrift}
          ledgerStatus={ledgerStatus}
          beats={beats}
          downbeatPulse={downbeatPulse}
        />
      ) : null}

      {chart && exploring ? (
        <ExploreHud
          worldId={world.worldId}
          chartId={chart.chartId}
          playheadMs={playheadMs}
          traceCount={traceViews.length}
          frameActive={frameTracking !== FrameTracking.Idle}
          frameLabel={frameLabel}
          notice={exploreNotice}
          warning={hudWarning}
          ledgerStatus={ledgerStatus}
        />
      ) : null}

      {chart && hasTraces ? (
        <R4cHud
          visible={exploreActive || (mode === 'Rhythm' && (phase === 'ready' || phase === 'playing' || phase === 'paused'))}
          frameTracking={frameTracking}
          frameLock={frameLock}
          traces={traceViews}
          lastTrigger={lastTrigger}
          hintVisible={frameHintVisible}
        />
      ) : null}

      {mode === 'Cutscene' && cutsceneData ? (
        <CutsceneMode data={cutsceneData} onDone={finishCutscene} />
      ) : null}

      {mode === 'Cutscene' && !cutsceneData ? (
        <div className="game-overlay">
          <p className="game-overlay__eyebrow">NEUROU / CUTSCENE</p>
          <h1>LOADING CUTSCENE</h1>
          <p className="game-overlay__hint">正在读取 cutscenes/*.json</p>
        </div>
      ) : null}

      {ledgerMessage ? (
        <div
          className={`game-ledger-status game-ledger-status--${ledgerStatus.toLowerCase()}`}
          aria-live="polite"
        >
          {ledgerMessage}
        </div>
      ) : null}

      <div className="game-command">
        <span className="game-command__path">{`NeurOS  C:\\A_Try\\${projectName}`}</span>
        <span className="game-command__prompt">&gt;</span>
        <form className="game-command__form" onSubmit={submitCommand}>
          <input
            ref={commandInputRef}
            value={commandValue}
            onFocus={() => setCommandOpen(true)}
            onBlur={() => setCommandOpen(false)}
            onChange={(event) => setCommandValue(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                setCommandOpen(false);
                setCommandValue('');
                setCommandNotice(null);
                commandInputRef.current?.blur();
              }
            }}
            placeholder="/edit"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
        <span className="game-command__hint">/edit · /rhythm · /exit</span>
        {commandNotice ? <p className="game-command__notice">{commandNotice}</p> : null}
      </div>

      {mode === 'Explore' && modeState.status === 'loading' ? (
        <div className="game-overlay">
          <p className="game-overlay__eyebrow">NEUROU / EXPLORE</p>
          <h1>LOADING WORLD</h1>
          <p className="game-overlay__hint">{projectName} / {world.worldId}</p>
        </div>
      ) : null}

      {mode === 'Rhythm' && phase === 'loading' ? (
        <div className="game-overlay">
          <p className="game-overlay__eyebrow">NEUROU / LOAD</p>
          <h1>LOADING CHART</h1>
          <p className="game-overlay__hint">{projectName} / {world.worldId}</p>
        </div>
      ) : null}

      {showStart ? (
        <div className="game-overlay">
          <div
            className="game-overlay__theme-bg"
            data-theme-image={themeImageUrl ? 'true' : 'false'}
            style={themeImageUrl ? { backgroundImage: `url("${themeImageUrl}")` } : undefined}
          />
          <p className="game-overlay__eyebrow">NEUROU / PLAY</p>
          <h1>{chart.chartId}</h1>
          <p className="game-overlay__hint">
            {world.worldId} · {chart.source.toUpperCase()} · {chart.notes.length} NOTES
          </p>
          <button className="game-overlay__button" type="button" onClick={beginCountdown}>
            START / SPACE
          </button>
          <p className="game-overlay__hint">
            2×4 KEY ZONES · 123QWE / 456RTY / 789UIO / 0-=P[] · ASDZXC / FGHVB / JKLNM&lt; / ："|&gt;? · SPACE / 123QWE = L1
          </p>
          <p className="game-overlay__hint">WORLD COMMAND · 按 / 输入 /edit</p>
          {hasTraces ? (
            <p className="game-overlay__hint game-overlay__hint--r4c">
              SHIFT + 方向键移动框 · SHIFT + ENTER 对准
            </p>
          ) : null}
          {ledgerMessage ? (
            <p className="game-overlay__hint game-overlay__hint--ledger">{ledgerMessage}</p>
          ) : null}
          {hudWarning ? <p className="game-overlay__warning">{hudWarning}</p> : null}
        </div>
      ) : null}

      {phase === 'countdown' ? (
        <div className="game-countdown">
          <p>GET READY</p>
          <strong>{countdown > 0 ? countdown : 'GO'}</strong>
        </div>
      ) : null}

      {goFlash ? <div className="game-go">GO</div> : null}

      {phase === 'paused' ? (
        <div className="game-overlay">
          <p className="game-overlay__eyebrow">NEUROU / PAUSE</p>
          <h1>PAUSED</h1>
          <button className="game-overlay__button" type="button" onClick={() => void resume()}>
            RESUME / SPACE
          </button>
          <button
            className="game-overlay__button game-overlay__button--ghost"
            type="button"
            onClick={isDebugRhythm ? exit : returnToExplore}
          >
            {isDebugRhythm ? 'EXIT' : 'EXIT TO EXPLORE'}
          </button>
        </div>
      ) : null}

      {phase === 'completed' ? (
        <div className="game-overlay">
          <p className="game-overlay__eyebrow">NEUROU / RESULT</p>
          <h1>CHART COMPLETE</h1>
          <p className="game-overlay__score">{String(score).padStart(6, '0')}</p>
          <p className="game-overlay__hint">
            PERFECT {counts.perfect} · GOOD {counts.good} · MISS {counts.miss} · MAX {counts.maxCombo}
          </p>
          {ledgerMessage ? (
            <p className="game-overlay__hint game-overlay__hint--ledger">{ledgerMessage}</p>
          ) : null}
          <button
            className="game-overlay__button"
            type="button"
            onClick={isDebugRhythm ? exit : returnToExplore}
          >
            {isDebugRhythm ? 'BACK / ENTER' : 'RETURN TO EXPLORE'}
          </button>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="game-overlay">
          <p className="game-overlay__eyebrow">NEUROU / ERROR</p>
          <h1>PLAYBACK FAILED</h1>
          <p className="game-overlay__warning">{error}</p>
          <button className="game-overlay__button" type="button" onClick={exit}>
            BACK
          </button>
        </div>
      ) : null}

      <button
        className="game-exit"
        type="button"
        onClick={mode === 'Rhythm' && !isDebugRhythm ? returnToExplore : exit}
      >
        {mode === 'Rhythm' && !isDebugRhythm ? 'ESC / EXPLORE' : 'ESC / EXIT'}
      </button>
    </div>
  );
}
