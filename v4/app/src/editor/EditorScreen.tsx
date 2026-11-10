import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { EditorWorldFile } from '@core/editor/EditorWorldFile';
import { LogoPositionPicker, LogoRandomPlacement } from '@core/editor/logo';
import { NeuRuntime } from '@core/editor/runtime/NeuRuntime';
import type { NeuSignal } from '@core/editor/runtime/NeuRuntime';
import { RandomPreviewMode, RandomSeed } from '@core/eventgraph/RandomMode';
import type { CycleWarning } from '@core/eventgraph/RandomMode';
import type {
  ActiveStageEffect,
  ActiveLight,
} from '@core/editor/runtime/EffectCompositor';
import type { AIKeyframeGeneration } from '@core/editor/types';
import type { EditorEffectKind } from '@core/editor/runtime/types';
import { AudioTriggerRuntime } from './AudioTriggerRuntime';
import { TauriAIHttp } from '../../../adapters/tauri/tauriAIHttp';
import { TauriAIKeyStore } from '../../../adapters/tauri/tauriAIKeyStore';
import { TauriMediaImporter } from '../../../adapters/tauri/TauriMediaImporter';
import { TauriProjectIo } from '../../../adapters/tauri/TauriProjectIo';
import { EditorAIPanel } from './EditorAIPanel';
import type { AIKeyState } from './EditorAIPanel';
import {
  DEFAULT_AI_SETTINGS,
  buildRhythmRoute,
} from './aiSettings';
import type { AISettings } from './aiSettings';
import {
  applyAIKeyframeProposals,
  generationStatus,
  parseAIKeyframeProposals,
  templateKeyframeProposals,
} from './aiKeyframeGeneration';
import { EditorAssetShelf } from './EditorAssetShelf';
import { EditorInspectorPanel } from './EditorInspectorPanel';
import { EditorNeuPanel } from './EditorNeuPanel';
import { EditorStage } from './EditorStage';
import { EditorTimelineView } from './EditorTimelineView';
import { EditorToolbar } from './EditorToolbar';
import { EventBlueprint } from './EventBlueprint';
import { MediaPanel } from './MediaPanel';
import { EditorBeatsPanel } from './EditorBeatsPanel';
import { readBeatsSidecar } from '../audio/beatsSidecar';
import type { BeatsSidecar } from '../audio/beatsSidecar';
import {
  DEFAULT_EDITOR_PROJECT_ROOT,
  FRAME_DURATION_MS,
  GAME_LOGO_PATH,
  allKeyframes,
  createEditorFixture,
  editorRelPath,
  ensureLogo,
  nearestKeyframe,
  selectedKeyframe,
} from './model';
import type {
  EditorEntry,
  EditorWorkspaceMode,
  MediaLayers,
  StageMediaOverlay,
  NeuModule,
  NeuModuleType,
} from './types';
import './editor.css';

interface EditorScreenProps {
  readonly entry: EditorEntry;
  readonly onBack: () => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function approach(current: number, target: number, delta: number): number {
  if (current < target) return Math.min(current + delta, target);
  return Math.max(current - delta, target);
}

function pathJoin(root: string, relPath: string): string {
  const base = root.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${relPath.replace(/\//g, separator)}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

interface ManifestAsset {
  readonly assetId?: unknown;
  readonly relPath?: unknown;
  readonly kind?: unknown;
  readonly displayName?: unknown;
}

interface ManifestPair {
  readonly stereoPairId?: unknown;
  readonly leftAssetId?: unknown;
  readonly rightAssetId?: unknown;
  readonly audioAssetId?: unknown;
}

/** 编辑器重进时恢复 manifest 的 activePair；缺失时回退到上一对可用素材。 */
async function loadLatestMedia(
  io: TauriProjectIo,
  importer: TauriMediaImporter,
  projectRoot = DEFAULT_EDITOR_PROJECT_ROOT,
): Promise<MediaLayers | null> {
  const raw = await io.readProjectFile('media/manifest.json');
  if (!raw || typeof raw !== 'object') return null;
  const manifest = raw as { stereoPairs?: unknown; assets?: unknown; activePairId?: unknown };
  if (!Array.isArray(manifest.stereoPairs) || !Array.isArray(manifest.assets)) return null;
  const pairs = manifest.stereoPairs.filter(
    (item): item is ManifestPair => typeof item === 'object' && item !== null,
  );
  if (pairs.length === 0) return null;
  const requestedPairId = typeof manifest.activePairId === 'string' ? manifest.activePairId : null;
  const requestedPair = requestedPairId
    ? pairs.find((item) => item.stereoPairId === requestedPairId)
    : null;
  const candidates = requestedPair
    ? [requestedPair, ...[...pairs].reverse().filter((item) => item !== requestedPair)]
    : [...pairs].reverse();
  const assets = manifest.assets.filter(
    (item): item is ManifestAsset => typeof item === 'object' && item !== null,
  );
  const relPathOf = (assetId: unknown): string | null => {
    const asset = assets.find((item) => item.assetId === assetId);
    return typeof asset?.relPath === 'string' ? asset.relPath : null;
  };
  for (const pair of candidates) {
    const leftRelPath = relPathOf(pair.leftAssetId);
    const rightRelPath = relPathOf(pair.rightAssetId);
    const audioRelPath = relPathOf(pair.audioAssetId);
    if (!leftRelPath || !rightRelPath || !audioRelPath) continue;
    try {
      const [leftBytes, rightBytes] = await Promise.all([
        importer.readMediaFile(leftRelPath),
        importer.readMediaFile(rightRelPath),
      ]);
      return {
        pairId: typeof pair.stereoPairId === 'string' ? pair.stereoPairId : 'manifest-pair',
        background: URL.createObjectURL(new Blob([toArrayBuffer(leftBytes)], { type: 'video/mp4' })),
        foreground: URL.createObjectURL(new Blob([toArrayBuffer(rightBytes)], { type: 'video/mp4' })),
        audio: convertFileSrc(pathJoin(projectRoot, audioRelPath)),
        leftRelPath,
        rightRelPath,
        audioRelPath,
      };
    } catch {
      // 当前 pair 文件缺失；继续回退。
    }
  }
  return null;
}

export interface EditorAudioAsset {
  readonly id: string;
  readonly label: string;
}

/** R5c-A.2：从 manifest 读取可绑定到层的音频资产。 */
async function loadEditorAudioAssets(io: TauriProjectIo): Promise<readonly EditorAudioAsset[]> {
  const raw = await io.readProjectFile('media/manifest.json');
  if (!raw || typeof raw !== 'object') return [];
  const assets = (raw as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return [];
  return assets
    .filter((item): item is ManifestAsset => typeof item === 'object' && item !== null)
    .filter((item) => (
      item.kind === 'Audio'
      && typeof item.assetId === 'string'
      && item.assetId.startsWith('asset:audio:')
    ))
    .map((item) => ({
      id: item.assetId as string,
      label: typeof item.displayName === 'string' ? item.displayName : item.assetId as string,
    }));
}

/**
 * R3.5c 编辑器编排层：只驱动 E 层 EditorWorldFile 与 Tauri X 适配器。
 * UI 状态（播放、选位、抽屉）不写入 editor.json。
 */
export function EditorScreen({ entry, onBack }: EditorScreenProps) {
  const { world, projectName } = entry;
  const io = useMemo(() => new TauriProjectIo(), []);
  const mediaImporter = useMemo(() => new TauriMediaImporter(), []);
  const aiHttp = useMemo(() => new TauriAIHttp(), []);
  const aiKeyStore = useMemo(() => new TauriAIKeyStore(), []);
  const picker = useMemo(() => new LogoPositionPicker(), []);
  const logoUrl = useMemo(() => convertFileSrc(GAME_LOGO_PATH), []);
  const [file, setFile] = useState<EditorWorldFile | null>(null);
  const [tick, setTick] = useState(0);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [media, setMedia] = useState<MediaLayers | null>(null);
  const [beats, setBeats] = useState<BeatsSidecar | null>(null);
  const [beatSnap, setBeatSnap] = useState(false);
  const [audioAssets, setAudioAssets] = useState<readonly EditorAudioAsset[]>([]);
  const loadThemeMedia = useCallback(async (projectRoot: string): Promise<void> => {
    await io.openProjectRoot(projectRoot);
    const next = await loadLatestMedia(io, mediaImporter, projectRoot);
    if (!next) throw new Error('activePair 没有可用的主题媒体');
    setMedia((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.background);
        URL.revokeObjectURL(previous.foreground);
      }
      return next;
    });
  }, [io, mediaImporter]);

  const refreshBeats = useCallback(async (): Promise<void> => {
    if (!file) return;
    try {
      const result = await readBeatsSidecar(DEFAULT_EDITOR_PROJECT_ROOT, file.chartId);
      setBeats(result.sidecar);
    } catch {
      setBeats(null);
    }
  }, [file]);

  useEffect(() => {
    let alive = true;
    void io.openProjectRoot(DEFAULT_EDITOR_PROJECT_ROOT)
      .then(() => loadEditorAudioAssets(io))
      .then((assets) => {
        if (alive) setAudioAssets(assets);
      })
      .catch(() => {
        if (alive) setAudioAssets([]);
      });
    return () => {
      alive = false;
    };
  }, [io]);

  useEffect(() => {
    void refreshBeats();
  }, [refreshBeats]);
  const [mediaOverlays, setMediaOverlays] = useState<readonly StageMediaOverlay[]>([]);
  const overlayCounterRef = useRef(0);
  const [pickingLogo, setPickingLogo] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('LOADING');
  const [error, setError] = useState<string | null>(null);
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [aiKeyState, setAIKeyState] = useState<AIKeyState>('NOT SET');
  const [aiBusy, setAIBusy] = useState(false);
  const [aiGeneration, setAIGeneration] = useState<AIKeyframeGeneration>({
    status: 'Unavailable',
    reason: 'AIUnavailable',
  });
  const [cameraPan, setCameraPan] = useState({ x: 0, y: 0 });
  const [workspaceMode, setWorkspaceMode] = useState<EditorWorkspaceMode>('ROU');
  const [modeTransition, setModeTransition] = useState<{
    phase: 'out' | 'in';
    direction: 'left' | 'right';
  } | null>(null);
  const modeTimersRef = useRef<number[]>([]);
  const [neuModules, setNeuModules] = useState<readonly NeuModule[]>([]);
  const [selectedNeuModuleId, setSelectedNeuModuleId] = useState<string | null>(null);
  const [randomPreviewMode, setRandomPreviewMode] = useState<RandomPreviewMode>(RandomPreviewMode.Seeded);
  const [neuCycleWarnings, setNeuCycleWarnings] = useState<readonly CycleWarning[]>([]);
  const neuModulesRef = useRef<readonly NeuModule[]>([]);
  const neuHistoryRef = useRef<{
    past: readonly { modules: readonly NeuModule[]; seed: number }[];
    future: readonly { modules: readonly NeuModule[]; seed: number }[];
  }>({ past: [], future: [] });
  const lastEditKindRef = useRef<'none' | 'neu' | 'keyframe'>('none');
  const fileHistorySizeRef = useRef(0);
  const neuCounterRef = useRef(0);
  const effectCounterRef = useRef(0);
  const fileRef = useRef<EditorWorldFile | null>(null);
  const audioRuntimeRef = useRef<AudioTriggerRuntime | null>(null);
  const neuRuntimeRef = useRef<NeuRuntime | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [activeNeuModuleIds, setActiveNeuModuleIds] = useState<readonly string[]>([]);
  const activeNeuTimerRef = useRef<number | null>(null);
  const audioTickRef = useRef<{ atMs: number; keys: Set<string> }>({
    atMs: -1,
    keys: new Set(),
  });
  const flashActiveModules = (moduleIds: readonly string[]): void => {
    if (moduleIds.length === 0) return;
    setActiveNeuModuleIds((previous) => {
      const next = new Set(previous);
      for (const moduleId of moduleIds) next.add(moduleId);
      return [...next];
    });
    if (activeNeuTimerRef.current !== null) {
      window.clearTimeout(activeNeuTimerRef.current);
    }
    activeNeuTimerRef.current = window.setTimeout(() => {
      setActiveNeuModuleIds([]);
      activeNeuTimerRef.current = null;
    }, 900);
  };
  const [stageSignal, setStageSignal] = useState<string | null>(null);
  const [neuEffects, setNeuEffects] = useState<readonly {
    effectKind: ActiveStageEffect['effectKind'];
    params: ActiveStageEffect['params'];
    startMs: number;
  }[]>([]);
  const [neuLights, setNeuLights] = useState<readonly {
    presets: ActiveLight['presets'];
    startMs: number;
    durationMs: number;
    intensity: number;
    mode: 'FullScreen' | 'Local';
    targetAssetId: string | null;
  }[]>([]);
  const neuStartedRef = useRef(false);
  const dragSessionRef = useRef<{
    payload: { kind: 'asset'; assetId: string; label: string }
      | { kind: 'module'; moduleType: NeuModuleType; label: string };
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [pointerDrag, setPointerDrag] = useState<{
    label: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const dropPointerRef = useRef<(x: number, y: number) => void>(() => undefined);
  const lastPointerDropRef = useRef(0);
  const playheadRef = useRef(0);
  const selectedIdsRef = useRef<readonly string[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const cameraPanRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  });
  const timelineVelocityRef = useRef(0);
  const hudRef = useRef({ x: 0, y: 0, time: -1 });
  const [blueprintPan, setBlueprintPan] = useState(0);
  const blueprintVelocityRef = useRef(0);
  const timelineViewAnimRef = useRef<{
    from: number;
    to: number;
    startedAt: number;
    durationMs: number;
  } | null>(null);
  const [, setTimelineRevision] = useState(0);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  useEffect(() => {
    fileRef.current = file;
    if (file) setAISettings(file.ai);
  }, [file]);

  useEffect(() => {
    let alive = true;
    void aiKeyStore.getKey(aiSettings.keyRef).then((key) => {
      if (alive) setAIKeyState(key ? 'KEY STORED' : 'NOT SET');
    }).catch(() => {
      if (alive) setAIKeyState('KEYSTORE UNAVAILABLE');
    });
    return () => {
      alive = false;
    };
  }, [aiKeyStore, aiSettings.keyRef]);

  useEffect(() => {
    neuModulesRef.current = neuModules;
  }, [neuModules]);

  useEffect(() => {
    neuHistoryRef.current = { past: [], future: [] };
    lastEditKindRef.current = 'none';
    fileHistorySizeRef.current = file?.history.size ?? 0;
  }, [file]);

  useEffect(() => {
    const size = file?.history.size ?? 0;
    if (size === fileHistorySizeRef.current) return;
    fileHistorySizeRef.current = size;
    lastEditKindRef.current = 'keyframe';
  }, [file, tick]);

  useEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    if (!rightPanelOpen) setBlueprintPan(0);
  }, [rightPanelOpen]);

  useEffect(() => {
    if (!file) return;
    if (JSON.stringify(file.neuModules) === JSON.stringify(neuModules)) return;
    file.setNeuModules(neuModules);
    setSaveState('UNSAVED');
  }, [file, neuModules]);

  useEffect(() => () => {
    for (const timer of modeTimersRef.current) window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!media) return;
    return () => {
      URL.revokeObjectURL(media.background);
      URL.revokeObjectURL(media.foreground);
    };
  }, [media]);

  useEffect(() => {
    const runtime = new AudioTriggerRuntime();
    audioRuntimeRef.current = runtime;
    return () => {
      runtime.dispose();
      audioRuntimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!media) return;
    void audioRuntimeRef.current?.load('asset:audio:main', media.audio)
      .catch((caught) => setAudioNotice(`音频加载失败：${errorText(caught)}`));
  }, [media]);

  useEffect(() => {
    neuRuntimeRef.current = new NeuRuntime(neuModules, {
      mode: randomPreviewMode,
      seed: new RandomSeed(file?.seed ?? 0),
      onCycleWarning: (warning) => {
        setNeuCycleWarnings((previous) => (
          previous.some((item) => item.moduleId === warning.moduleId)
            ? previous
            : [...previous, warning]
        ));
      },
    });
    neuStartedRef.current = false;
    setNeuCycleWarnings([]);
    setNeuEffects([]);
    setNeuLights([]);
  }, [file?.seed, neuModules, randomPreviewMode]);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await io.openProjectRoot(DEFAULT_EDITOR_PROJECT_ROOT);
        const raw = await io.readProjectFile(editorRelPath(world.worldId));
        if (!alive) return;
        if (raw) {
          const loaded = EditorWorldFile.fromJson(raw);
          loaded.timeline.setViewport({ pxPerMs: 1000 / Math.max(1, loaded.durationMs) });
          setFile(loaded);
          setNeuModules(loaded.neuModules);
          neuCounterRef.current = loaded.neuModules.reduce((max, module) => {
            const match = /^neu-(\d+)$/.exec(module.moduleId);
            return match ? Math.max(max, Number(match[1])) : max;
          }, 3);
          setSelectedNeuModuleId(loaded.neuModules[0]?.moduleId ?? null);
          setSaveState('LOADED');
          setPlayheadMs(loaded.timeline.playheadMs);
          selectedIdsRef.current = [];
          setSelectedIds([]);
        } else {
          const fixture = createEditorFixture(world.worldId);
          fixture.timeline.setViewport({ pxPerMs: 1000 / Math.max(1, fixture.durationMs) });
          setFile(fixture);
          setSaveState('NEW');
          setPlayheadMs(0);
          selectedIdsRef.current = [];
          setSelectedIds([]);
          setSelectedNeuModuleId(null);
        }
        try {
          const existingMedia = await loadLatestMedia(io, mediaImporter);
          if (alive && existingMedia) setMedia(existingMedia);
        } catch (caught) {
          setError(`自动恢复媒体失败：${errorText(caught)}`);
        }
      } catch (caught) {
        if (!alive) return;
        const fixture = createEditorFixture(world.worldId);
        fixture.timeline.setViewport({ pxPerMs: 1000 / Math.max(1, fixture.durationMs) });
        setFile(fixture);
        setSaveState('LOCAL');
        setPlayheadMs(0);
        selectedIdsRef.current = [];
        setSelectedIds([]);
        setError(`打开项目失败，使用本地 fixture：${errorText(caught)}`);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [io, world.worldId]);

  const refresh = useCallback((): void => {
    setTick((value) => value + 1);
    if (fileRef.current?.dirty) setSaveState('UNSAVED');
  }, []);

  const pushNeuSnapshot = useCallback((): void => {
    const history = neuHistoryRef.current;
    const snapshot = {
      modules: neuModulesRef.current,
      seed: file?.seed ?? 0,
    };
    const past = [...history.past, snapshot].slice(-100);
    neuHistoryRef.current = { past, future: [] };
  }, [file]);

  const commitNeuModules = useCallback((next: readonly NeuModule[]): void => {
    if (JSON.stringify(neuModulesRef.current) === JSON.stringify(next)) return;
    pushNeuSnapshot();
    neuModulesRef.current = next;
    setNeuModules(next);
    lastEditKindRef.current = 'neu';
    fileHistorySizeRef.current = file?.history.size ?? 0;
  }, [file, pushNeuSnapshot]);

  const updateNeuModules = useCallback((
    updater: (previous: readonly NeuModule[]) => readonly NeuModule[],
  ): void => {
    commitNeuModules(updater(neuModulesRef.current));
  }, [commitNeuModules]);

  const updateRandomSeed = (seed: number): void => {
    if (!file) return;
    const value = Math.max(0, Math.min(0xffff_ffff, Math.floor(seed)));
    if (value === file.seed) return;
    pushNeuSnapshot();
    file.setSeed(value);
    lastEditKindRef.current = 'neu';
    fileHistorySizeRef.current = file.history.size;
    refresh();
  };

  const updateRandomMode = (mode: RandomPreviewMode): void => {
    setRandomPreviewMode(mode);
  };

  const applyNeuSnapshot = (snapshot: {
    modules: readonly NeuModule[];
    seed: number;
  }): void => {
    neuModulesRef.current = snapshot.modules;
    setNeuModules(snapshot.modules);
    if (file) file.setSeed(snapshot.seed);
    setSelectedNeuModuleId((current) => (
      current && snapshot.modules.some((module) => module.moduleId === current)
        ? current
        : null
    ));
    setNeuCycleWarnings([]);
    fileHistorySizeRef.current = file?.history.size ?? 0;
    refresh();
  };

  const undoNeuEdit = (): boolean => {
    const history = neuHistoryRef.current;
    const snapshot = history.past[history.past.length - 1];
    if (!snapshot) return false;
    const current = {
      modules: neuModulesRef.current,
      seed: file?.seed ?? 0,
    };
    neuHistoryRef.current = {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, 100),
    };
    applyNeuSnapshot(snapshot);
    return true;
  };

  const redoNeuEdit = (): boolean => {
    const history = neuHistoryRef.current;
    const snapshot = history.future[0];
    if (!snapshot) return false;
    const current = {
      modules: neuModulesRef.current,
      seed: file?.seed ?? 0,
    };
    neuHistoryRef.current = {
      past: [...history.past, current].slice(-100),
      future: history.future.slice(1),
    };
    applyNeuSnapshot(snapshot);
    return true;
  };

  const save = async (): Promise<void> => {
    if (!file) return;
    setSaveState('SAVING');
    setError(null);
    try {
      if (JSON.stringify(file.neuModules) !== JSON.stringify(neuModules)) {
        file.setNeuModules(neuModules);
      }
      await io.openProjectRoot(DEFAULT_EDITOR_PROJECT_ROOT);
      await io.writeProjectFile(editorRelPath(world.worldId), file.toJson());
      file.markSaved();
      setSaveState('SAVED');
      refresh();
    } catch (caught) {
      setSaveState('ERROR');
      setError(`保存失败：${errorText(caught)}`);
    }
  };

  const saveAISettings = async (): Promise<void> => {
    if (!file) return;
    try {
      file.setAISettings(aiSettings);
      setAISettings(file.ai);
      refresh();
      await save();
    } catch (caught) {
      setError(`AI 设置保存失败：${errorText(caught)}`);
    }
  };

  const saveAIKey = async (key: string): Promise<void> => {
    try {
      await aiKeyStore.setKey(aiSettings.keyRef, key);
      setAIKeyState('KEY STORED');
    } catch {
      setAIKeyState('KEYSTORE UNAVAILABLE');
    }
  };

  const clearAIKey = async (): Promise<void> => {
    try {
      await aiKeyStore.deleteKey(aiSettings.keyRef);
      setAIKeyState('NOT SET');
    } catch {
      setAIKeyState('KEYSTORE UNAVAILABLE');
    }
  };

  const runAI = async (prompt: string, generate: boolean): Promise<void> => {
    if (!file || aiBusy) return;
    setAIBusy(true);
    setAIGeneration({ status: 'Running', reason: 'AI request running' });
    try {
      const route = buildRhythmRoute(aiSettings, aiHttp, aiKeyStore);
      const result = await route.generate({
        task: 'RhythmGeneration',
        prompt,
      });
      const parsed = parseAIKeyframeProposals(result.content);
      const proposals = parsed.length > 0 || !generate
        ? parsed
        : templateKeyframeProposals(file.exportV2().notes);
      setAIGeneration(generationStatus(result, proposals));
    } catch {
      setAIGeneration({
        status: 'Unavailable',
        reason: 'AI request failed',
      });
    } finally {
      setAIBusy(false);
    }
  };

  const generateKeyframes = (): void => {
    if (!file) return;
    const notes = file.exportV2().notes;
    void runAI(JSON.stringify({
      task: 'RhythmGeneration',
      instruction: 'Return JSON {"keyframes":[{timeMs,durationMs,chartLayerIndex,gridCellId,chartPadKind,chartKeyId}]}',
      notes,
    }), true);
  };

  const testAIConnection = (): void => {
    void runAI('Return JSON {"keyframes":[]} as a connection test.', false);
  };

  const confirmAIProposals = (): void => {
    if (!file || !aiGeneration.proposals?.length) return;
    applyAIKeyframeProposals(file, aiGeneration.proposals);
    setAIGeneration({
      ...aiGeneration,
      status: 'Ready',
      reason: 'Applied',
      proposals: [],
    });
    refresh();
  };

  const cancelAIProposals = (): void => {
    setAIGeneration({
      ...aiGeneration,
      status: 'Unavailable',
      reason: 'Cancelled',
      proposals: [],
    });
  };

  const seek = (timeMs: number): void => {
    if (!file) return;
    const next = Math.min(file.durationMs, Math.max(0, Math.round(timeMs)));
    audioRuntimeRef.current?.stopAll();
    neuRuntimeRef.current?.reset(next);
    neuStartedRef.current = false;
    setNeuEffects([]);
    setNeuLights([]);
    setStageSignal(null);
    setMediaOverlays([]);
    setActiveNeuModuleIds([]);
    if (activeNeuTimerRef.current !== null) {
      window.clearTimeout(activeNeuTimerRef.current);
      activeNeuTimerRef.current = null;
    }
    file.playhead.seek(next);
    file.timeline.setPlayhead(next);
    playheadRef.current = next;
    setPlayheadMs(next);
    if (playing) setPlaying(false);
  };

  const togglePlay = async (): Promise<void> => {
    if (!file) return;
    if (playing) {
      setPlaying(false);
      file.playhead.pause();
      audioRuntimeRef.current?.stopAll();
      return;
    }
    const start = playheadRef.current >= file.durationMs ? 0 : playheadRef.current;
    if (start !== playheadRef.current) {
      file.playhead.seek(start);
      file.timeline.setPlayhead(start);
      setPlayheadMs(start);
    }
    const audio = audioRuntimeRef.current;
    if (audio) {
      const enabled = await audio.resume().catch(() => false);
      if (!enabled) {
        setAudioNotice('声音未启用：请点击 Play 或画面后再次播放');
      } else {
        setAudioNotice(null);
      }
      audio.stopAll();
      if (media) {
        void audio.load('asset:audio:main', media.audio).catch(() => undefined);
      }
      for (const binding of file.bindings) {
        if (binding.triggerAtMs === start) {
          audio.play(binding.assetId, 0.8);
        }
      }
    }
    if (!neuStartedRef.current) {
      neuRuntimeRef.current?.reset(start - 1);
      audioTickRef.current = { atMs: -1, keys: new Set() };
      setNeuCycleWarnings([]);
      neuStartedRef.current = true;
    }
    setMediaOverlays([]);
    file.playhead.play();
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing || !file) return;
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;

    const handler = (signal: NeuSignal): void => {
      if (signal.kind === 'Audio') {
        if (audioTickRef.current.atMs !== signal.atMs) {
          audioTickRef.current = { atMs: signal.atMs, keys: new Set() };
        }
        const key = `${signal.assetId}|${signal.volume}`;
        if (audioTickRef.current.keys.has(key)) return;
        audioTickRef.current.keys.add(key);
        audioRuntimeRef.current?.play(signal.assetId, signal.volume);
        return;
      }
      if (signal.kind === 'Effect') {
        const definition = file.effects.find((effect) => effect.interfaceId === signal.interfaceId);
        if (!definition) return;
        setNeuEffects((previous) => [...previous, {
          effectKind: definition.effectKind,
          params: definition.params,
          startMs: signal.atMs,
        }]);
        return;
      }
      if (signal.kind === 'Light') {
        setNeuLights((previous) => [...previous, {
          presets: signal.presets as ActiveLight['presets'],
          startMs: signal.atMs,
          durationMs: signal.durationMs,
          intensity: 1,
          mode: signal.mode,
          targetAssetId: signal.targetAssetId,
        }]);
        return;
      }
      if (signal.kind === 'Resource') {
        const module = file.neuModules.find((item) => item.moduleId === signal.moduleId);
        const assetId = signal.assetId
          ?? (typeof module?.params.assetId === 'string' ? module.params.assetId : null);
        const kind = signal.resourceType === 'VideoStatic'
          ? 'videoStatic'
          : signal.resourceType === 'Video' ? 'video' : 'image';
        const src = assetId === 'asset:guidance:head-logo' ? logoUrl : media?.foreground;
        if (src) {
          overlayCounterRef.current += 1;
          const durationMs = Number(module?.params.durationMs ?? 2000);
          const opacity = Number(module?.params.opacity ?? 1);
          setMediaOverlays((previous) => [
            ...previous.filter((overlay) => !(
              overlay.moduleId === signal.moduleId && overlay.startMs === signal.atMs
            )),
            {
              overlayId: `overlay-${overlayCounterRef.current}`,
              moduleId: signal.moduleId,
              assetId: assetId ?? 'unknown',
              kind,
              src,
              startMs: signal.atMs,
              durationMs: Number.isFinite(durationMs) ? Math.max(80, durationMs) : 2000,
              opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
            },
          ]);
        }
        setStageSignal(`${signal.resourceType} · ${assetId ?? 'placeholder'}`);
        return;
      }
      if (signal.kind === 'Subtitle') {
        setStageSignal(signal.text);
      }
    };

    const step = (now: number): void => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const previous = playheadRef.current;
      const next = Math.min(file.durationMs, previous + dt * 1000);
      const audio = audioRuntimeRef.current;
      if (audio) {
        for (const binding of file.bindings) {
          if (binding.triggerAtMs > previous && binding.triggerAtMs <= next) {
            audio.play(binding.assetId, 0.8);
            const relatedIds = new Set<string>();
            for (const module of file.neuModules) {
              if (module.type !== 'RhythmPoint' || module.params.timeMs !== binding.triggerAtMs) {
                continue;
              }
              relatedIds.add(module.moduleId);
              for (const output of module.outputs) {
                for (const target of output.targets) relatedIds.add(target.moduleId);
              }
            }
            flashActiveModules([...relatedIds]);
          }
        }
      }
      try {
        neuRuntimeRef.current?.advanceTo(next, true, handler, (moduleId) => {
          flashActiveModules([moduleId]);
        });
      } catch (caught) {
        setError(`NEU 执行失败：${errorText(caught)}`);
        setPlaying(false);
        file.playhead.pause();
        audio?.stopAll();
        return;
      }
      file.playhead.seek(next);
      file.timeline.setPlayhead(next);
      playheadRef.current = next;
      if (now - lastHud > 33) {
        lastHud = now;
        setPlayheadMs(next);
      }
      if (next >= file.durationMs) {
        setPlaying(false);
        file.playhead.pause();
        audio?.stopAll();
        neuStartedRef.current = false;
        return;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, file]);

  // WASD 舞台相机：线性加减速，Shift 加速；W/S 垂直，A/D 水平。
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;
    const step = (now: number): void => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const keys = keysRef.current;
      const boost = keys.has('shift');
      const dirX =
        ((keys.has('d') || keys.has('arrowright')) ? 1 : 0)
        - ((keys.has('a') || keys.has('arrowleft')) ? 1 : 0);
      const dirY =
        ((keys.has('s') || keys.has('arrowdown')) ? 1 : 0)
        - ((keys.has('w') || keys.has('arrowup')) ? 1 : 0);
      const targetVx = dirX * (boost ? 1.6 : 0.8);
      const targetVy = dirY * (boost ? 1.6 : 0.8);
      let vx = approach(cameraPanRef.current.vx, targetVx, (boost ? 5.4 : 2.8) * dt);
      let vy = approach(cameraPanRef.current.vy, targetVy, (boost ? 5.4 : 2.8) * dt);

      // A/D 与 ←/→：移动 playhead / 时间；但绝不自动平移视口。
      const timelineTarget = dirX * (boost ? 2800 : 1200);
      const timelineVelocity = approach(
        timelineVelocityRef.current,
        timelineTarget,
        (boost ? 7000 : 3200) * dt,
      );
      const activeFile = fileRef.current;
      if (activeFile && (timelineVelocity !== 0 || dirX !== 0)) {
        const nextTime = Math.min(
          activeFile.durationMs,
          Math.max(0, playheadRef.current + timelineVelocity * dt),
        );
        activeFile.playhead.seek(nextTime);
        activeFile.timeline.setPlayhead(nextTime);
        playheadRef.current = nextTime;
        if (now - lastHud > 33) {
          lastHud = now;
          setPlayheadMs(nextTime);
        }
      }
      timelineVelocityRef.current = timelineVelocity;

      let x = cameraPanRef.current.x + vx * dt;
      let y = cameraPanRef.current.y + vy * dt;
      if (x <= -1) {
        x = -1;
        vx = 0;
      } else if (x >= 1) {
        x = 1;
        vx = 0;
      }
      if (y <= -1) {
        y = -1;
        vy = 0;
      } else if (y >= 1) {
        y = 1;
        vy = 0;
      }
      cameraPanRef.current = { x, y, vx, vy };
      if (now - lastHud > 33) {
        lastHud = now;
        const hud = hudRef.current;
        if (Math.abs(hud.x - x) > 0.0005 || Math.abs(hud.y - y) > 0.0005) {
          hud.x = x;
          hud.y = y;
          setCameraPan({ x, y });
        }
        if (Math.abs(hud.time - playheadRef.current) > 0.4) {
          hud.time = playheadRef.current;
          setPlayheadMs(playheadRef.current);
        }
      }
      const timelineAnim = timelineViewAnimRef.current;
      const timelineFile = fileRef.current;
      if (timelineAnim && timelineFile) {
        const progress = Math.min(1, (now - timelineAnim.startedAt) / timelineAnim.durationMs);
        const eased = 1 - (1 - progress) ** 3;
        const nextView = timelineAnim.from + (timelineAnim.to - timelineAnim.from) * eased;
        timelineFile.timeline.scrollTo(nextView);
        setTimelineRevision((value) => value + 1);
        if (progress >= 1) timelineViewAnimRef.current = null;
      }
      const blueprintVelocity = blueprintVelocityRef.current;
      if (Math.abs(blueprintVelocity) > 0.02) {
        setBlueprintPan((value) => Math.min(
          360,
          Math.max(-360, value + blueprintVelocity * dt * 150),
        ));
        blueprintVelocityRef.current = blueprintVelocity * Math.pow(0.92, dt * 60);
      } else {
        blueprintVelocityRef.current = 0;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const select = (
    keyframeId: string,
    mode: 'replace' | 'add' | 'range' = 'replace',
  ): void => {
    if (!file) return;
    const current = selectedIdsRef.current;
    let next: readonly string[];
    if (mode === 'range') {
      const all = allKeyframes(file).map((keyframe) => keyframe.keyframeId);
      const anchor = current[0] ?? keyframeId;
      const start = all.indexOf(anchor);
      const end = all.indexOf(keyframeId);
      next = start >= 0 && end >= 0
        ? all.slice(Math.min(start, end), Math.max(start, end) + 1)
        : [keyframeId];
    } else if (mode === 'add') {
      next = current.includes(keyframeId)
        ? current.filter((id) => id !== keyframeId)
        : [...current, keyframeId];
    } else {
      next = [keyframeId];
    }
    selectedIdsRef.current = next;
    setSelectedIds(next);
    if (next.length > 0) {
      setRightPanelOpen(true);
      file.select(next[next.length - 1]);
    } else {
      file.clearSelection();
    }
    picker.cancel();
    setPickingLogo(false);
    refresh();
  };

  const selectMany = (keyframeIds: readonly string[], additive = false): void => {
    if (!file) return;
    const unique = [...new Set([
      ...(additive ? selectedIdsRef.current : []),
      ...keyframeIds,
    ])];
    selectedIdsRef.current = unique;
    setSelectedIds(unique);
    if (unique.length > 0) {
      file.select(unique[unique.length - 1]);
      setRightPanelOpen(true);
    } else {
      file.clearSelection();
      setRightPanelOpen(false);
    }
    picker.cancel();
    setPickingLogo(false);
    refresh();
  };

  const clearSelection = (): void => {
    if (!file) return;
    file.clearSelection();
    selectedIdsRef.current = [];
    setSelectedIds([]);
    picker.cancel();
    setPickingLogo(false);
    setRightPanelOpen(false);
    refresh();
  };

  const deleteSelected = (): void => {
    if (!file) return;
    const ids = selectedIdsRef.current.length > 0
      ? selectedIdsRef.current
      : (file.selection.selectedKeyframeId ? [file.selection.selectedKeyframeId] : []);
    if (ids.length === 0) return;
    for (const id of ids) file.deleteKeyframe(id);
    selectedIdsRef.current = [];
    setSelectedIds([]);
    setPickingLogo(false);
    refresh();
  };

  const moveSelected = (deltaMs: number, layerDelta: number): void => {
    if (!file) return;
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    let changed = false;
    for (const id of ids) {
      const found = file.getKeyframe(id);
      if (!found) continue;
      const keyframe = found.keyframe;
      const nextTime = Math.max(
        0,
        Math.min(
          file.durationMs - keyframe.durationMs,
          keyframe.timeMs + deltaMs,
        ),
      );
      const nextLayer = Math.max(
        1,
        Math.min(3, keyframe.chartLayerIndex + layerDelta),
      );
      if (nextTime !== keyframe.timeMs || nextLayer !== keyframe.chartLayerIndex) {
        file.updateKeyframe(id, {
          timeMs: nextTime,
          chartLayerIndex: nextLayer,
        }, { snap: false });
        changed = true;
      }
    }
    if (changed) refresh();
  };

  const createAssetFlow = (keyframeId: string, assetId: string): void => {
    if (!file) return;
    const keyframe = allKeyframes(file).find((item) => item.keyframeId === keyframeId);
    if (!keyframe) return;
    const mapping: Record<string, { type: NeuModuleType; params: Record<string, string | number | boolean | string[] | null> }> = {
      'asset:audio:main': { type: 'Audio', params: { assetId, volume: 0.8, durationMs: 8000 } },
      'asset:video:foreground': { type: 'Video', params: { assetId, playback: 'timeline' } },
      'asset:guidance:head-logo': { type: 'Image', params: { assetId } },
      'asset:event:interface': { type: 'AND', params: {} },
      'asset:mark:trace': { type: 'AND', params: {} },
      'asset:subtitle:default': { type: 'Subtitle', params: { text: '字幕' } },
    };
    const mapped = mapping[assetId];
    if (!mapped) return;
    const existingRhythm = neuModules.find((module) => (
      module.type === 'RhythmPoint'
      && (module.params.keyframeId === keyframeId || module.params.timeMs === keyframe.timeMs)
    ));
    const alreadyConnected = existingRhythm?.outputs.some((output) => output.targets.some((target) => {
      const targetModule = neuModules.find((module) => module.moduleId === target.moduleId);
      return targetModule?.type === mapped.type
        && targetModule.params.assetId === mapped.params.assetId;
    }));
    if (alreadyConnected) return;

    const sourceId = existingRhythm?.moduleId ?? (() => {
      neuCounterRef.current += 1;
      return `neu-${neuCounterRef.current}`;
    })();
    neuCounterRef.current += 1;
    const resourceId = `neu-${neuCounterRef.current}`;
    const baseY = 0.24 + (neuModules.length % 4) * 0.09;
    const source: NeuModule = existingRhythm ?? {
      moduleId: sourceId,
      type: 'RhythmPoint',
      x: 0.2,
      y: baseY,
      params: { keyframeId, timeMs: keyframe.timeMs },
      inputs: [],
      outputs: [],
    };
    const resource: NeuModule = {
      moduleId: resourceId,
      type: mapped.type,
      x: 0.56,
      y: baseY + 0.04,
      params: mapped.params,
      inputs: [{ port: 1, sourceModuleId: sourceId, sourcePort: 1 }],
      outputs: [],
    };
    const nextSource: NeuModule = {
      ...source,
      outputs: [...source.outputs, { port: 1, targets: [{ moduleId: resourceId, port: 1 }] }],
    };
    updateNeuModules((previous) => [
      ...previous.filter((module) => module.moduleId !== sourceId),
      nextSource,
      resource,
    ]);
    setSelectedNeuModuleId(resourceId);
    setRightPanelOpen(true);
    setSelectedAssetId(null);
    refresh();
  };

  const dropAssetOnTimeline = (layerIndex: number, timeMs: number, assetId: string): void => {
    if (!file) return;
    const track = file.trackForLayer(layerIndex);
    const nearest = track?.keyframes.reduce<{ id: string; distance: number } | null>(
      (best, keyframe) => {
        const distance = Math.abs(keyframe.timeMs - timeMs);
        return !best || distance < best.distance
          ? { id: keyframe.keyframeId, distance }
          : best;
      },
      null,
    );
    try {
      const targetId = nearest && nearest.distance <= 800
        ? nearest.id
        : file.addKeyframe(
          {
            timeMs,
            chartLayerIndex: layerIndex,
            durationMs: Math.min(1000, Math.max(0, file.durationMs - timeMs)),
          },
          { frameDurationMs: FRAME_DURATION_MS },
        ).keyframeId;
      bindAsset(targetId, assetId);
      selectedIdsRef.current = [targetId];
      setSelectedIds([targetId]);
      file.select(targetId);
      setRightPanelOpen(true);
      refresh();
    } catch (caught) {
      setError(`绑定资源失败：${errorText(caught)}`);
    }
  };

  const bindAsset = (keyframeId: string, assetId: string): void => {
    if (!file) return;
    const found = file.getKeyframe(keyframeId);
    if (!found) return;
    file.addBinding({
      keyframeId,
      assetId,
      triggerAtMs: found.keyframe.timeMs,
    });
    refresh();
  };

  const bindingsFor = (keyframeId: string): readonly string[] => (
    file?.bindings
      .filter((binding) => binding.keyframeId === keyframeId)
      .map((binding) => binding.assetId) ?? []
  );

  const addEffect = (effectKind: EditorEffectKind): void => {
    if (!file) return;
    const selected = file.selection.selectedKeyframeId;
    if (!selected) return;
    let nextId = `fx-${effectCounterRef.current + 1}`;
    while (file.effects.some((effect) => effect.interfaceId === nextId)) {
      effectCounterRef.current += 1;
      nextId = `fx-${effectCounterRef.current + 1}`;
    }
    effectCounterRef.current += 1;
    const params: Record<string, number> = { durationMs: 600, intensity: 1 };
    if (effectKind === 'Bounce') {
      params.bounceCount = 3;
      params.initialHeight = 24;
    } else if (effectKind === 'Glitch') {
      params.glitchOffset = 9;
    } else if (effectKind === 'ScaleUp' || effectKind === 'ScaleDown') {
      params.scale = effectKind === 'ScaleUp' ? 1.8 : 0.6;
    } else if (effectKind === 'Shake') {
      params.shakeAmplitude = 8;
    } else if (effectKind === 'Wander') {
      params.wanderRadius = 14;
    } else if (effectKind === 'ScrollOpen' || effectKind === 'ScrollClose') {
      params.scrollAmount = 48;
    }
    file.setEffects([...file.effects, {
      interfaceId: nextId,
      effectKind,
      params,
    }]);
    const current = file.getKeyframe(selected);
    if (current) {
      file.setKeyframeEffects(selected, [...current.keyframe.effectInterfaceIds, nextId]);
    }
    refresh();
  };

  const updateEffect = (
    interfaceId: string,
    params: Record<string, number>,
  ): void => {
    if (!file) return;
    file.setEffects(file.effects.map((effect) => (
      effect.interfaceId === interfaceId
        ? { ...effect, params: { ...effect.params, ...params } }
        : effect
    )));
    refresh();
  };

  const removeEffect = (interfaceId: string): void => {
    if (!file) return;
    file.setEffects(file.effects.filter((effect) => effect.interfaceId !== interfaceId));
    for (const keyframe of allKeyframes(file)) {
      if (keyframe.effectInterfaceIds.includes(interfaceId)) {
        file.setKeyframeEffects(
          keyframe.keyframeId,
          keyframe.effectInterfaceIds.filter((id) => id !== interfaceId),
        );
      }
    }
    refresh();
  };

  const createFrameAnimation = (): void => {
    if (!file) return;
    const selected = file.selection.selectedKeyframeId;
    if (!selected) return;
    const found = file.getKeyframe(selected);
    if (!found) return;
    const next = found.track.keyframes
      .filter((keyframe) => keyframe.timeMs > found.keyframe.timeMs)
      .sort((left, right) => left.timeMs - right.timeMs)[0];
    const durationMs = next
      ? Math.max(0, next.timeMs - found.keyframe.timeMs)
      : Math.min(1000, Math.max(0, file.durationMs - found.keyframe.timeMs));
    try {
      file.updateKeyframe(selected, { durationMs });
      refresh();
    } catch (caught) {
      setError(`创建帧动画失败：${errorText(caught)}`);
    }
  };

  const addKeyframe = (layerIndex: number, timeMs: number): void => {
    if (!file) return;
    try {
      const keyframe = file.addKeyframe(
        {
          timeMs,
          chartLayerIndex: layerIndex,
          parallaxFactor: 1,
          durationMs: Math.min(1000, Math.max(0, file.durationMs - timeMs)),
        },
        { frameDurationMs: FRAME_DURATION_MS },
      );
      selectedIdsRef.current = [keyframe.keyframeId];
      setSelectedIds([keyframe.keyframeId]);
      file.select(keyframe.keyframeId);
      setPlayheadMs(keyframe.timeMs);
      file.timeline.setPlayhead(keyframe.timeMs);
      refresh();
    } catch (caught) {
      setError(`新增关键帧失败：${errorText(caught)}`);
    }
  };

  const updateSelected = (patch: Parameters<EditorWorldFile['updateKeyframe']>[1]): void => {
    if (!file) return;
    const selected = file.selection.selectedKeyframeId;
    if (!selected) return;
    try {
      const next = file.updateKeyframe(selected, patch, {
        frameDurationMs: FRAME_DURATION_MS,
      });
      if (patch.timeMs !== undefined) {
        file.timeline.setPlayhead(next.timeMs);
        setPlayheadMs(next.timeMs);
      }
      refresh();
    } catch (caught) {
      setError(`更新失败：${errorText(caught)}`);
    }
  };

  const beginPicking = (): void => {
    if (!file) return;
    const selected = file.selection.selectedKeyframeId;
    if (!selected) {
      setError('请先选中一个关键帧');
      return;
    }
    const found = file.getKeyframe(selected);
    if (!found) return;
    if (!found.keyframe.logo) {
      file.setLogo(selected, ensureLogo(found.keyframe));
    }
    picker.begin();
    setPickingLogo(true);
    file.setMode('Logo');
    refresh();
  };

  const pickLogo = (x: number, y: number): void => {
    if (!file) return;
    const selected = file.selection.selectedKeyframeId;
    if (!selected) return;
    const found = file.getKeyframe(selected);
    if (!found) return;
    const logo = ensureLogo(found.keyframe);
    file.updateKeyframe(selected, { logo: { ...logo, x, y } });
    picker.cancel();
    setPickingLogo(false);
    refresh();
  };

  const randomLogo = (): void => {
    if (!file) return;
    const selected = file.selection.selectedKeyframeId;
    if (!selected) return;
    const found = file.getKeyframe(selected);
    if (!found) return;
    const point = LogoRandomPlacement.place(file.seed, selected);
    const logo = ensureLogo(found.keyframe);
    file.updateKeyframe(selected, { logo: { ...logo, ...point } });
    refresh();
  };

  useEffect(() => {
    const movementKeys = new Set([
      'a', 'd', 'w', 's',
      'arrowleft', 'arrowright', 'arrowup', 'arrowdown',
      'shift',
    ]);
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement
        && (target.tagName === 'INPUT'
          || target.tagName === 'TEXTAREA'
          || target.tagName === 'SELECT'
          || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'tab' && event.shiftKey) {
        event.preventDefault();
        return;
      }
      if (['1', '2', '3', '4'].includes(key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        const modes = ['Notes', 'Keyframes', 'Logo', 'Layers'] as const;
        file?.setMode(modes[Number(key) - 1]);
        refresh();
        return;
      }
      if (key === 'tab') {
        event.preventDefault();
        switchWorkspaceMode(workspaceMode === 'ROU' ? 'NEU' : 'ROU');
        return;
      }
      if (key === 'escape') {
        event.preventDefault();
        if (pickingLogo) {
          picker.cancel();
          setPickingLogo(false);
          return;
        }
        if (file?.selection.hasSelection) {
          clearSelection();
          return;
        }
        onBack();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'a') {
        event.preventDefault();
        if (!file) return;
        selectMany(allKeyframes(file).map((keyframe) => keyframe.keyframeId));
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (!file) return;
        if (lastEditKindRef.current === 'neu') {
          const changed = event.shiftKey ? redoNeuEdit() : undoNeuEdit();
          if (changed) {
            const selectedNow = file.selection.selectedKeyframeId;
            selectedIdsRef.current = selectedNow ? [selectedNow] : [];
            setSelectedIds(selectedNow ? [selectedNow] : []);
            setRightPanelOpen(Boolean(selectedNow));
            setPlayheadMs(file.timeline.playheadMs);
            lastEditKindRef.current = neuHistoryRef.current.past.length > 0
              || neuHistoryRef.current.future.length > 0
              ? 'neu'
              : (file.canUndo ? 'keyframe' : 'none');
            return;
          }
        }
        const changed = event.shiftKey ? file.redo() : file.undo();
        if (!changed) return;
        lastEditKindRef.current = 'keyframe';
        fileHistorySizeRef.current = file.history.size;
        const validKeyframes = new Set(allKeyframes(file).map((keyframe) => keyframe.keyframeId));
        if (file.bindings.some((binding) => !validKeyframes.has(binding.keyframeId))) {
          file.setBindings(file.bindings.filter((binding) => validKeyframes.has(binding.keyframeId)));
        }
        const selectedNow = file.selection.selectedKeyframeId;
        selectedIdsRef.current = selectedNow ? [selectedNow] : [];
        setSelectedIds(selectedNow ? [selectedNow] : []);
        setRightPanelOpen(Boolean(selectedNow));
        setPlayheadMs(file.timeline.playheadMs);
        refresh();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        if (!file) return;
        if (lastEditKindRef.current === 'neu' && redoNeuEdit()) {
          lastEditKindRef.current = 'neu';
          return;
        }
        if (!file.redo()) return;
        lastEditKindRef.current = 'keyframe';
        fileHistorySizeRef.current = file.history.size;
        const selectedNow = file.selection.selectedKeyframeId;
        selectedIdsRef.current = selectedNow ? [selectedNow] : [];
        setSelectedIds(selectedNow ? [selectedNow] : []);
        setRightPanelOpen(Boolean(selectedNow));
        setPlayheadMs(file.timeline.playheadMs);
        refresh();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        void save();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (file?.selection.hasSelection) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey)
        && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        event.preventDefault();
        if (!file) return;
        let span = Math.max(1, file.timeline.viewEnd - file.timeline.viewStart);
        if (span >= file.durationMs - 2) {
          file.timeline.setViewport({
            pxPerMs: Math.min(2, file.timeline.pxPerMs * 2),
            viewStartMs: file.timeline.viewStart,
          });
          span = Math.max(1, file.timeline.viewEnd - file.timeline.viewStart);
          file.timeline.scrollTo(file.timeline.playheadMs - span / 2);
        }
        const delta = key === 'arrowleft'
          ? -span * 0.18
          : key === 'arrowright'
            ? span * 0.18
            : key === 'arrowup'
              ? -span
              : span;
        timelineViewAnimRef.current = {
          from: file.timeline.viewStart,
          to: file.timeline.viewStart + delta,
          startedAt: performance.now(),
          durationMs: key === 'arrowup' || key === 'arrowdown' ? 460 : 300,
        };
        return;
      }
      if (event.shiftKey
        && workspaceMode === 'NEU'
        && rightPanelOpen
        && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        blueprintVelocityRef.current = Math.min(
          7,
          Math.max(-7, blueprintVelocityRef.current + (event.key === 'ArrowLeft' ? 1.1 : -1.1)),
        );
        return;
      }
      if (movementKeys.has(key)) {
        if (key.startsWith('arrow')) event.preventDefault();
        if (playing
          && (key === 'a' || key === 'd' || key.startsWith('arrowleft') || key.startsWith('arrowright'))) {
          setPlaying(false);
          file?.playhead.pause();
        }
        keysRef.current.add(key);
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      keysRef.current.delete(event.key.toLowerCase());
    };
    const onBlur = (): void => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  });

  const switchWorkspaceMode = (next: EditorWorkspaceMode): void => {
    if (next === workspaceMode || modeTransition) return;
    // 实测方向与初期约定相反：ROU→NEU 向左，NEU→ROU 向右。
    const direction = next === 'NEU' ? 'left' : 'right';
    setModeTransition({ phase: 'out', direction });
    const swap = window.setTimeout(() => {
      setWorkspaceMode(next);
      setRightPanelOpen(true);
      setBlueprintPan(0);
      setModeTransition({ phase: 'in', direction });
      const finish = window.setTimeout(() => {
        setModeTransition(null);
        modeTimersRef.current = [];
      }, 540);
      modeTimersRef.current.push(finish);
    }, 460);
    modeTimersRef.current.push(swap);
  };

  const addNeuModule = (
    type: NeuModuleType,
    label: string,
    x = 0.5,
    y = 0.5,
    fromDrop = false,
  ): void => {
    if (!fromDrop && performance.now() - lastPointerDropRef.current < 260) return;
    neuCounterRef.current += 1;
    const params: Record<string, string | number | boolean | string[] | null> = {};
    if (type === 'Delay') {
      params.delayMs = 1000;
      params.extendPrevious = false;
    } else if (type === 'Random') {
      params.probability = 0.5;
    } else if (type === 'RhythmPoint') {
      params.timeMs = playheadRef.current;
    } else if (type === 'Audio') {
      params.assetId = 'asset:audio:main';
      params.volume = 0.8;
      params.durationMs = 8000;
    } else if (type === 'Video') {
      params.assetId = 'asset:video:foreground';
      params.playback = 'timeline';
    } else if (type === 'VideoStatic') {
      params.assetId = 'asset:video:foreground';
      params.playback = 'frozen';
      params.gridCells = 8;
    } else if (type === 'Image') {
      params.assetId = 'asset:guidance:head-logo';
    } else if (type === 'Subtitle') {
      params.text = '字幕';
    } else if (type === 'Effect') {
      params.interfaceId = '';
    } else if (type === 'Light') {
      params.mode = label.includes('局部') ? 'Local' : 'FullScreen';
      if (params.mode === 'Local') params.targetAssetId = 'asset:guidance:head-logo';
      params.presets = ['Invert'];
      params.intensity = 1;
      params.durationMs = 600;
    }
    const placedX = x === 0.5 && y === 0.5
      ? 0.2 + ((neuCounterRef.current - 1) % 3) * 0.25
      : x;
    const placedY = x === 0.5 && y === 0.5
      ? 0.28 + (Math.floor((neuCounterRef.current - 1) / 3) % 2) * 0.3
      : y;
    const module: NeuModule = {
      moduleId: `neu-${neuCounterRef.current}`,
      type,
      x: placedX,
      y: placedY,
      params,
      inputs: [],
      outputs: [],
    };
    updateNeuModules((previous) => [...previous, module]);
    setSelectedNeuModuleId(module.moduleId);
    setSelectedAssetId(null);
  };

  const connectNeuModules = (sourceModuleId: string, targetModuleId: string): void => {
    if (sourceModuleId === targetModuleId) return;
    updateNeuModules((previous) => previous.map((module) => {
      if (module.moduleId === sourceModuleId) {
        const output = module.outputs.find((item) => item.port === 1);
        const targets = output?.targets ?? [];
        if (targets.some((target) => target.moduleId === targetModuleId)) return module;
        const nextOutputs = output
          ? module.outputs.map((item) => (item.port === 1
            ? { ...item, targets: [...targets, { moduleId: targetModuleId, port: 1 }] }
            : item))
          : [...module.outputs, { port: 1, targets: [{ moduleId: targetModuleId, port: 1 }] }];
        return { ...module, outputs: nextOutputs };
      }
      if (module.moduleId === targetModuleId) {
        if (module.inputs.some((input) => input.sourceModuleId === sourceModuleId)) return module;
        return {
          ...module,
          inputs: [...module.inputs, { port: 1, sourceModuleId, sourcePort: 1 }],
        };
      }
      return module;
    }));
  };

  const connectChannel = (side: 'left' | 'right', port: number, moduleId: string): void => {
    const channelId = `channel-${side}-${port}`;
    updateNeuModules((previous) => {
      const hasChannel = previous.some((module) => module.moduleId === channelId);
      const base = hasChannel ? previous : [...previous, {
        moduleId: channelId,
        type: 'Channel' as const,
        x: side === 'left' ? 0.01 : 0.99,
        y: 0.12 + (port - 1) * 0.14,
        params: { side, port },
        inputs: [],
        outputs: [],
      }];
      return base.map((module) => {
        if (module.moduleId === channelId) {
          if (side === 'left') {
            const output = module.outputs.find((item) => item.port === 1);
            const targets = output?.targets ?? [];
            if (targets.some((target) => target.moduleId === moduleId)) return module;
            const nextOutputs = output
              ? module.outputs.map((item) => (item.port === 1
                ? { ...item, targets: [...targets, { moduleId, port: 1 }] }
                : item))
              : [...module.outputs, { port: 1, targets: [{ moduleId, port: 1 }] }];
            return { ...module, outputs: nextOutputs };
          }
          if (module.inputs.some((input) => input.sourceModuleId === moduleId)) return module;
          return {
            ...module,
            inputs: [...module.inputs, {
              port: 1,
              sourceModuleId: moduleId,
              sourcePort: 1,
            }],
          };
        }
        if (module.moduleId === moduleId) {
          if (side === 'left') {
            if (module.inputs.some((input) => input.sourceModuleId === channelId)) return module;
            return {
              ...module,
              inputs: [...module.inputs, {
                port: 1,
                sourceModuleId: channelId,
                sourcePort: 1,
              }],
            };
          }
          const output = module.outputs.find((item) => item.port === 1);
          const targets = output?.targets ?? [];
          if (targets.some((target) => target.moduleId === channelId)) return module;
          const nextOutputs = output
            ? module.outputs.map((item) => (item.port === 1
              ? { ...item, targets: [...targets, { moduleId: channelId, port: 1 }] }
              : item))
            : [...module.outputs, { port: 1, targets: [{ moduleId: channelId, port: 1 }] }];
          return { ...module, outputs: nextOutputs };
        }
        return module;
      });
    });
  };

  const removeNeuConnection = (sourceModuleId: string, targetModuleId: string): void => {
    updateNeuModules((previous) => previous.map((module) => {
      if (module.moduleId === sourceModuleId) {
        return {
          ...module,
          outputs: module.outputs.map((output) => ({
            ...output,
            targets: output.targets.filter((target) => target.moduleId !== targetModuleId),
          })),
        };
      }
      if (module.moduleId === targetModuleId) {
        return {
          ...module,
          inputs: module.inputs.filter((input) => input.sourceModuleId !== sourceModuleId),
        };
      }
      return module;
    }));
  };

  const deleteNeuModule = (moduleId: string): void => {
    updateNeuModules((previous) => previous
      .filter((module) => module.moduleId !== moduleId)
      .map((module) => ({
        ...module,
        inputs: module.inputs.filter((input) => input.sourceModuleId !== moduleId),
        outputs: module.outputs.map((output) => ({
          ...output,
          targets: output.targets.filter((target) => target.moduleId !== moduleId),
        })),
      })));
    if (selectedNeuModuleId === moduleId) setSelectedNeuModuleId(null);
  };

  const moveNeuModule = (moduleId: string, x: number, y: number): void => {
    updateNeuModules((previous) => previous.map((module) => (
      module.moduleId === moduleId ? { ...module, x, y } : module
    )));
  };

  const finishNeuModuleDrag = (moduleId: string): void => {
    const moving = neuModules.find((module) => module.moduleId === moduleId);
    if (!moving) return;
    const overlapping = neuModules.find((module) => (
      module.moduleId !== moduleId
      && Math.abs(module.x - moving.x) < 0.15
      && Math.abs(module.y - moving.y) < 0.14
    ));
    if (!overlapping) return;
    const alreadyConnected = moving.outputs.some((output) => (
      output.targets.some((target) => target.moduleId === overlapping.moduleId)
    )) || overlapping.outputs.some((output) => (
      output.targets.some((target) => target.moduleId === moduleId)
    ));
    if (!alreadyConnected) connectNeuModules(moduleId, overlapping.moduleId);
    let nextX = moving.x;
    let nextY = moving.y;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const collision = neuModules.find((module) => (
        module.moduleId !== moduleId
        && Math.abs(module.x - nextX) < 0.15
        && Math.abs(module.y - nextY) < 0.14
      ));
      if (!collision) break;
      const dx = nextX - collision.x;
      const dy = nextY - collision.y;
      nextX = Math.min(0.92, Math.max(0.08, nextX + (dx >= 0 ? 0.035 : -0.035)));
      nextY = Math.min(0.9, Math.max(0.1, nextY + (dy >= 0 ? 0.032 : -0.032)));
    }
    updateNeuModules((previous) => previous.map((module) => (
      module.moduleId === moduleId ? { ...module, x: nextX, y: nextY } : module
    )));
  };

  const beginPointerDrag = (
    payload: { kind: 'asset'; assetId: string; label: string }
      | { kind: 'module'; moduleType: NeuModuleType; label: string },
    event: ReactPointerEvent,
  ): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const session = {
      payload,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
    };
    dragSessionRef.current = session;
    setPointerDrag({ label: payload.label, x: event.clientX, y: event.clientY, active: false });
  };

  const dropPointer = (x: number, y: number): void => {
    if (!file) return;
    const elements = document.elementsFromPoint(x, y) as HTMLElement[];
    const pointElement = document.elementFromPoint(x, y) as HTMLElement | null;
    const keyframeElement = pointElement?.closest<HTMLElement>('[data-keyframe-id]')
      ?? elements
        .map((element) => element.closest<HTMLElement>('[data-keyframe-id]'))
        .find(Boolean)
      ?? Array.from(document.querySelectorAll<HTMLElement>('[data-keyframe-id]'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            element,
            distance: Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y),
          };
        })
        .sort((left, right) => left.distance - right.distance)
        .find((candidate) => candidate.distance < 70)?.element;
    let blueprintElement = elements
      .map((element) => element.closest<HTMLElement>('[data-drop-blueprint]'))
      .find(Boolean);
    if (!blueprintElement) {
      const candidate = document.querySelector<HTMLElement>('[data-drop-blueprint]');
      if (candidate) {
        const rect = candidate.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          blueprintElement = candidate;
        }
      }
    }
    const trackElement = elements
      .map((element) => element.closest<HTMLElement>('[data-track-layer]'))
      .find(Boolean);
    const payload = dragSessionRef.current?.payload;
    if (!payload) return;

    const layerAudioElement = elements
      .map((element) => element.closest<HTMLElement>('[data-layer-audio-drop]'))
      .find(Boolean);
    if (layerAudioElement && payload.kind === 'asset') {
      const layerIndex = Number(layerAudioElement.dataset.layerAudioDrop);
      if (!Number.isSafeInteger(layerIndex) || layerIndex < 1 || layerIndex > 32) return;
      if (!payload.assetId.startsWith('asset:audio:') || payload.assetId === 'asset:audio:main') {
        setError('Layer Audio 只能绑定非 BGM 的 audio 资产');
        return;
      }
      file.setLayerAudio(layerIndex, payload.assetId);
      setError(null);
      refresh();
      return;
    }

    if (keyframeElement && payload.kind === 'asset') {
      const keyframeId = keyframeElement.dataset.keyframeId;
      if (keyframeId) {
        bindAsset(keyframeId, payload.assetId);
        createAssetFlow(keyframeId, payload.assetId);
        selectedIdsRef.current = [keyframeId];
        setSelectedIds([keyframeId]);
        file.select(keyframeId);
        setRightPanelOpen(true);
        refresh();
      }
      return;
    }

    if (blueprintElement) {
      const rect = blueprintElement.getBoundingClientRect();
      const normalizedX = Math.min(0.92, Math.max(0.08, (x - rect.left) / rect.width));
      const normalizedY = Math.min(0.9, Math.max(0.1, (y - rect.top) / rect.height));
      if (payload.kind === 'module') {
        addNeuModule(payload.moduleType, payload.label, normalizedX, normalizedY, true);
        lastPointerDropRef.current = performance.now();
      } else {
        const mapping: Record<string, { type: NeuModuleType; label: string }> = {
          'asset:audio:main': { type: 'Audio', label: 'theme.wav' },
          'asset:video:foreground': { type: 'Video', label: 'rain-night-right-loop.mp4' },
          'asset:guidance:head-logo': { type: 'Image', label: 'head-logo' },
          'asset:event:interface': { type: 'AND', label: '事件接口' },
          'asset:mark:trace': { type: 'AND', label: '痕 / Trace' },
          'asset:subtitle:default': { type: 'Subtitle', label: '字幕' },
        };
        const mapped = mapping[payload.assetId];
        if (mapped) {
          addNeuModule(mapped.type, mapped.label, normalizedX, normalizedY, true);
          lastPointerDropRef.current = performance.now();
        }
      }
      return;
    }

    if (trackElement && payload.kind === 'asset') {
      const layer = Number(trackElement.dataset.trackLayer);
      const rect = trackElement.getBoundingClientRect();
      const timeMs = Math.min(
        file.durationMs,
        Math.max(0, ((x - rect.left) / Math.max(1, rect.width)) * file.durationMs),
      );
      if (Number.isFinite(layer)) dropAssetOnTimeline(layer, timeMs, payload.assetId);
    }
  };
  dropPointerRef.current = dropPointer;

  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const session = dragSessionRef.current;
      if (!session) return;
      session.x = event.clientX;
      session.y = event.clientY;
      if (!session.active
        && Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 4) {
        session.active = true;
      }
      setPointerDrag({
        label: session.payload.label,
        x: event.clientX,
        y: event.clientY,
        active: session.active,
      });
    };
    const up = (event?: MouseEvent | PointerEvent): void => {
      const session = dragSessionRef.current;
      if (!session) return;
      if (event) {
        session.x = event.clientX;
        session.y = event.clientY;
      }
      const moved = Math.hypot(session.x - session.startX, session.y - session.startY) > 4;
      if (session.active || moved) dropPointerRef.current(session.x, session.y);
      dragSessionRef.current = null;
      setPointerDrag(null);
    };
    const moveMouse = (event: MouseEvent): void => move(event as unknown as PointerEvent);
    window.addEventListener('mousemove', moveMouse, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('mousemove', moveMouse, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, []);

  useEffect(() => {
    const blockShiftTab = (event: KeyboardEvent): void => {
      if (event.shiftKey && event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockShiftTab, true);
    return () => window.removeEventListener('keydown', blockShiftTab, true);
  }, []);

  useEffect(() => {
    const prevent = (event: MouseEvent): void => event.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  const updateNeuModuleParams = (
    moduleId: string,
    params: Record<string, string | number | boolean | string[] | null>,
  ): void => {
    updateNeuModules((previous) => previous.map((module) => (
      module.moduleId === moduleId ? { ...module, params } : module
    )));
  };

  if (loading || !file) {
    return (
      <main className="editor-screen editor-screen--loading">
        <div className="editor-loading">
          <span className="editor-eyebrow">R3.5c / EDITOR</span>
          <strong>LOADING WORLD</strong>
          <i />
        </div>
      </main>
    );
  }

  const selected = selectedKeyframe(file);
  const keyframes = allKeyframes(file);
  const mode = file.mode;
  const activeEffects: ActiveStageEffect[] = [];
  for (const keyframe of keyframes) {
    for (const effectId of keyframe.effectInterfaceIds) {
      const definition = file.effects.find((effect) => effect.interfaceId === effectId);
      if (!definition) continue;
      const localMs = playheadMs - keyframe.timeMs;
      const durationMs = definition.params.durationMs ?? 600;
      if (localMs >= 0 && localMs <= durationMs) {
        activeEffects.push({
          interfaceId: definition.interfaceId,
          effectKind: definition.effectKind,
          params: definition.params,
          localMs,
        });
      }
    }
  }
  for (const signal of neuEffects) {
    const durationMs = signal.params.durationMs ?? 600;
    const localMs = playheadMs - signal.startMs;
    if (localMs >= 0 && localMs <= durationMs) {
      activeEffects.push({
        interfaceId: `neu-${signal.startMs}`,
        effectKind: signal.effectKind,
        params: signal.params,
        localMs,
      });
    }
  }
  const activeLights: ActiveLight[] = neuLights
    .map((signal) => ({
      presets: signal.presets,
      localMs: playheadMs - signal.startMs,
      durationMs: signal.durationMs,
      intensity: signal.intensity,
      mode: signal.mode,
      targetAssetId: signal.targetAssetId,
    }))
    .filter((light) => light.localMs >= 0 && light.localMs <= light.durationMs);

  return (
    <main className="editor-screen">
      <EditorToolbar
        projectName={projectName}
        worldId={world.worldId}
        chartId={file.chartId}
        editorMode={workspaceMode}
        mode={mode}
        playing={playing}
        dirty={file.dirty}
        saveState={saveState}
        onBack={onBack}
        onEditorMode={switchWorkspaceMode}
        onMode={(next) => {
          file.setMode(next);
          refresh();
        }}
        onSave={() => void save()}
        onPlay={togglePlay}
        onAI={() => setAIPanelOpen((value) => !value)}
        aiStatus={aiGeneration.status}
      />

      {pointerDrag?.active ? (
        <div
          className="editor-drag-ghost"
          style={{ left: pointerDrag.x + 12, top: pointerDrag.y + 12 }}
        >
          {pointerDrag.label}
        </div>
      ) : null}

      {audioNotice ? (
        <button
          type="button"
          className="editor-audio-notice"
          onClick={() => {
            void audioRuntimeRef.current?.resume().then((enabled) => {
              if (enabled) setAudioNotice(null);
            });
          }}
        >
          {audioNotice} · 点击此处启用
        </button>
      ) : null}

      <div className="editor-workspace">
        <div className="editor-main">
          <div className="editor-preview-row">
            <EditorAssetShelf
              logoUrl={logoUrl}
              audioName={media ? (media.audioRelPath.split(/[\\/]/).pop() ?? 'theme.wav') : null}
              videoName={media ? (media.rightRelPath.split(/[\\/]/).pop() ?? 'rain-night-right-loop.mp4') : null}
              audioAssets={audioAssets}
              mode={workspaceMode}
              selectedAssetId={selectedAssetId}
              onSelectAsset={setSelectedAssetId}
              onAssetPointerDown={(assetId, label, event) => beginPointerDrag(
                { kind: 'asset', assetId, label },
                event,
              )}
            />
            <div className={`editor-preview${modeTransition ? ` is-mode-${modeTransition.phase}-${modeTransition.direction}` : ''}`}>
              {workspaceMode === 'ROU' ? (
                <EditorStage
                  media={media}
                  playheadMs={playheadMs}
                  durationMs={file.durationMs}
                  playing={playing}
                  keyframes={keyframes}
                  selectedKeyframe={selected}
                  manualCameraX={cameraPan.x}
                  manualCameraY={cameraPan.y}
                  logoUrl={logoUrl}
                  activeEffects={activeEffects}
                  activeLights={activeLights}
                  mediaOverlays={mediaOverlays}
                  signalText={stageSignal}
                  pickingLogo={pickingLogo}
                  onPickLogo={pickLogo}
                  onClearSelection={clearSelection}
                  onSelectNearest={() => {
                    const near = nearestKeyframe(keyframes, playheadMs);
                    if (near) select(near.keyframeId);
                  }}
                  onLogoMove={(keyframeId, x, y) => {
                    const found = file.getKeyframe(keyframeId);
                    if (!found) return;
                    const logo = ensureLogo(found.keyframe);
                    file.updateKeyframe(keyframeId, { logo: { ...logo, x, y } });
                    refresh();
                  }}
                  onLogoSelect={select}
                />
              ) : (
                <EventBlueprint
                  modules={neuModules}
                  selectedModuleId={selectedNeuModuleId}
                  onMoveModule={moveNeuModule}
                  onSelectModule={(moduleId) => {
                    setSelectedNeuModuleId(moduleId);
                  }}
                  onOpenInspector={(moduleId) => {
                    setSelectedNeuModuleId(moduleId);
                    setRightPanelOpen(true);
                  }}
                  onDropModule={addNeuModule}
                  onBlankClick={() => {
                    setSelectedNeuModuleId(null);
                    setRightPanelOpen(false);
                  }}
                  panX={blueprintPan}
                  selectedAssetId={selectedAssetId}
                  activeModuleIds={activeNeuModuleIds}
                  onConnect={connectNeuModules}
                  onConnectChannel={connectChannel}
                  cycleWarnings={neuCycleWarnings}
                  onDragEnd={finishNeuModuleDrag}
                  onDeleteModule={deleteNeuModule}
                  onRemoveConnection={removeNeuConnection}
                />
              )}
              {aiGeneration.proposals?.length ? (
                <div className="editor-ai-proposals" role="status">
                  <header>
                    <span>AI PROPOSED</span>
                    <small>{aiGeneration.provider ?? 'Template'} · {aiGeneration.proposals.length} KEYFRAMES</small>
                  </header>
                  <div className="editor-ai-proposals__list">
                    {aiGeneration.proposals.slice(0, 8).map((proposal, index) => (
                      <span
                        key={`${proposal.timeMs}-${proposal.chartLayerIndex}-${index}`}
                        className="editor-ai-proposals__item"
                      >
                        {proposal.timeMs}ms · L{proposal.chartLayerIndex}
                        {proposal.gridCellId === null ? '' : ` · G${proposal.gridCellId}`}
                      </span>
                    ))}
                  </div>
                  <div className="editor-ai-proposals__actions">
                    <button type="button" onClick={confirmAIProposals}>Confirm</button>
                    <button type="button" onClick={cancelAIProposals}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <EditorTimelineView
            file={file}
            tick={tick}
            playheadMs={playheadMs}
            selectedIds={selectedIds}
            beats={beats}
            beatSnap={beatSnap}
            onBeatSnapChange={setBeatSnap}
            audioAssets={audioAssets}
            layerAudio={file.layerAudio}
            onLayerAudioClear={(layerIndex) => {
              file.setLayerAudio(layerIndex, null);
              refresh();
            }}
            onSelect={select}
            onSelectMany={selectMany}
            onBindAsset={bindAsset}
            onDropAsset={dropAssetOnTimeline}
            selectedAssetId={selectedAssetId}
            onSeek={seek}
            onAdd={addKeyframe}
            onChange={refresh}
          />
        </div>

        {workspaceMode === 'NEU' ? (
          <EditorNeuPanel
            modules={neuModules}
            selectedModuleId={selectedNeuModuleId}
            onAddModule={(kind, label) => addNeuModule(kind, label)}
            onModulePointerDown={(type, label, event) => beginPointerDrag(
              { kind: 'module', moduleType: type, label },
              event,
            )}
            onSelectModule={(moduleId) => {
              setSelectedNeuModuleId(moduleId);
              setRightPanelOpen(true);
            }}
            onMoveModule={moveNeuModule}
            onConnect={connectNeuModules}
            effectInterfaces={file.effects}
            onUpdateParams={updateNeuModuleParams}
            randomSeed={file.seed}
            randomMode={randomPreviewMode}
            onRandomSeedChange={updateRandomSeed}
            onRandomModeChange={updateRandomMode}
            collapsed={!rightPanelOpen}
          />
        ) : selected ? (
          <EditorInspectorPanel
            key={selected.keyframeId}
            keyframe={selected}
            onChange={updateSelected}
            onClose={clearSelection}
            onDelete={deleteSelected}
            onPickLogo={beginPicking}
            onRandomLogo={randomLogo}
            onRemoveLogo={() => updateSelected({ logo: null })}
            onFrameAnimation={createFrameAnimation}
            bindings={bindingsFor(selected.keyframeId)}
            assetOptions={[
              ...(media ? [
                { id: 'asset:audio:main', label: 'theme.wav / 音频' },
                { id: 'asset:video:foreground', label: 'rain-night-right-loop.mp4 / 视频' },
              ] : []),
              { id: 'asset:guidance:head-logo', label: 'head-logo / 图片' },
            ]}
            onBindAsset={(assetId) => bindAsset(selected.keyframeId, assetId)}
            effects={file.effects.filter((effect) => (
              selected.effectInterfaceIds.includes(effect.interfaceId)
            ))}
            onAddEffect={addEffect}
            onUpdateEffect={updateEffect}
            onRemoveEffect={removeEffect}
            collapsed={!rightPanelOpen}
          />
        ) : null}
      </div>

      {selected || workspaceMode === 'NEU' ? (
        <button
          type="button"
          className="editor-panel-toggle"
          onClick={() => setRightPanelOpen((value) => !value)}
          title={rightPanelOpen ? '收起右栏' : '展开右栏'}
        >
          {rightPanelOpen ? '›' : '‹'}
        </button>
      ) : null}

      <EditorBeatsPanel
        projectRoot={DEFAULT_EDITOR_PROJECT_ROOT}
        chartId={file.chartId}
        onChanged={() => void refreshBeats()}
      />

      <MediaPanel
        onLoadTheme={loadThemeMedia}
        onImported={(next) => {
        setMedia((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous.background);
            URL.revokeObjectURL(previous.foreground);
          }
          return next;
        });
      }} />

      {aiPanelOpen ? (
        <EditorAIPanel
          settings={aiSettings}
          keyState={aiKeyState}
          generation={aiGeneration}
          busy={aiBusy}
          onChange={setAISettings}
          onSaveSettings={() => void saveAISettings()}
          onSaveKey={saveAIKey}
          onClearKey={clearAIKey}
          onTest={testAIConnection}
          onGenerate={generateKeyframes}
          onConfirm={confirmAIProposals}
          onCancel={cancelAIProposals}
          onClose={() => setAIPanelOpen(false)}
        />
      ) : null}

      {error ? (
        <div className="editor-toast" role="status">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>×</button>
        </div>
      ) : null}
    </main>
  );
}

