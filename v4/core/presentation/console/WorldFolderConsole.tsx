/**
 * P · console：WorldFolderConsole 与 ProjectConsole 共用内部 ConsoleSession。
 *
 * 注意：ConsoleSession / useConsoleSession 不导出。两个 A 组件同模块，
 * 以避免新增 A 名或 non-A export；ProjectConsole 的 import 路径因此仍是
 * console/WorldFolderConsole。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent, MouseEvent } from 'react';
import type { Project } from '../../studio/projectTree';
import type { RainModeState, WorldInstance } from '../../world/types';
import { ConsoleCommand } from './ConsoleCommand';
import { ConsoleCommandList } from './ConsoleCommandList';
import { ConsoleDirectory } from './ConsoleDirectory';
import { ConsoleDirectoryConstraint } from './ConsoleDirectoryConstraint';
import { ConsoleEffect } from './ConsoleEffect';
import { ConsoleEnvironmentText } from './ConsoleEnvironmentText';
import { ConsoleOutput } from './ConsoleOutput';
import { ConsolePrompt } from './ConsolePrompt';
import { ContextMenuAction } from './ContextMenuAction';
import { SettingsConsole } from './SettingsConsole';
import { WorldEntryHighlight } from './WorldEntryHighlight';
import type { WorldFileEntry } from './WorldFileEntry';
import { WorldFolderEntryKind } from './WorldFolderEntryKind';
import { WorldLoadingSequence } from './WorldLoadingSequence';
import { WorldSelectionMode } from './WorldSelectionMode';
import './console.css';

/** 世界加载序列：进度 3.6s → 黑屏字幕 9s（原 3s 的 3 倍）→ 闪光 2s。 */
const WORLD_BLACK_START_MS = 3600;
const WORLD_PROLOGUE_MS = 9000;
const WORLD_FLASH_AT_MS = WORLD_BLACK_START_MS + WORLD_PROLOGUE_MS;
const WORLD_IDLE_AT_MS = WORLD_FLASH_AT_MS + 2000;

interface WorldFolderConsoleProps {
  worldId: string;
  worldName: string;
  entries: readonly WorldFileEntry[];
  onBack: () => void;
  onExport?: (entry: WorldFileEntry) => void;
}

interface ProjectConsoleProps {
  project: Project;
  worlds: readonly WorldInstance[];
  onExit: () => void;
  onEnterWorld?: (world: WorldInstance) => void;
  onEditWorld?: (world: WorldInstance, projectName: string) => void;
  origin?: { readonly x: number; readonly y: number };
  rainEnabled?: boolean;
  rainState?: RainModeState | null;
  onRainEnabledChange?: (enabled: boolean) => void;
  onRainRefresh?: () => void;
}

interface ContextMenuState {
  readonly entryId: string;
  readonly x: number;
  readonly y: number;
}

interface ConsoleSessionOptions {
  readonly initialHistory: readonly string[];
  readonly entries: readonly WorldFileEntry[];
  readonly onOpenEntry?: (entry: WorldFileEntry) => void;
  readonly onCdEntry?: (entry: WorldFileEntry) => void;
  readonly onExit?: () => void;
  readonly onExport?: (entry: WorldFileEntry) => void;
  readonly rainEnabled?: boolean;
  readonly rainState?: RainModeState | null;
  readonly onRainEnabledChange?: (enabled: boolean) => void;
  readonly onRainRefresh?: () => void;
}

function pathFromDirectory(directory: ConsoleDirectory): readonly string[] {
  const path = directory.getPath();
  return path === '/' ? [] : path.split('/').filter(Boolean);
}

/**
 * 内部 session：WorldFolderConsole 与 ProjectConsole 共用。
 * 不导出；不进入 NAMEBOOK。
 */
function useConsoleSession({
  initialHistory,
  entries,
  onOpenEntry,
  onCdEntry,
  onExit,
  onExport,
  rainEnabled,
  rainState,
  onRainEnabledChange,
  onRainRefresh,
}: ConsoleSessionOptions) {
  const [localEntries, setLocalEntries] = useState<readonly WorldFileEntry[]>(entries);
  const [currentPath, setCurrentPath] = useState<readonly string[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<WorldSelectionMode>(WorldSelectionMode.Keyboard);
  const [history, setHistory] = useState<readonly string[]>(initialHistory);
  const [input, setInput] = useState('');
  const [effect, setEffect] = useState<ConsoleEffect>(ConsoleEffect.None);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalEntries(entries);
    setCurrentPath([]);
    setSelectedEntryId(null);
  }, [entries]);

  const root = useMemo(() => {
    const directory = new ConsoleDirectory();
    for (const entry of localEntries) {
      try {
        directory.addChild(entry.displayName);
      } catch {
        // 非法显示名由 ConsoleDirectory 拒绝；console 继续运行。
      }
    }
    return directory;
  }, [localEntries]);

  const entryByName = useMemo(
    () => new Map(localEntries.map((entry) => [entry.displayName, entry])),
    [localEntries],
  );

  const currentDirectory = useMemo(() => {
    let directory = root;
    for (const name of currentPath) {
      const next = directory.enter(name);
      if (!next) return root;
      directory = next;
    }
    return directory;
  }, [root, currentPath]);

  const visibleEntries = useMemo(
    () => currentDirectory
      .listEntries()
      .map((name) => entryByName.get(name))
      .filter((entry): entry is WorldFileEntry => entry !== undefined),
    [currentDirectory, entryByName],
  );

  const selectedEntry = localEntries.find((entry) => entry.entryId === selectedEntryId) ?? null;
  const contextEntry = contextMenu
    ? localEntries.find((entry) => entry.entryId === contextMenu.entryId) ?? null
    : null;
  const currentPathLabel = currentDirectory.getPath();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const append = (line: string) => {
    setHistory((previous) => [...previous.slice(-220), line]);
  };

  const openEntry = (entry: WorldFileEntry) => {
    if (entry.kind === WorldFolderEntryKind.WorldExe || entry.kind === WorldFolderEntryKind.Folder) {
      onOpenEntry?.(entry);
      append(`enter ${entry.displayName} ...`);
      return;
    }
    append(`cannot open ${entry.displayName} (${entry.kind})`);
  };

  const handleCommand = (raw: string) => {
    const parsed = ConsoleCommand.parseCommand(raw);
    if (!parsed.ok || !parsed.command) {
      append(`error: ${parsed.reason ?? 'invalid command'}`);
      return;
    }

    const command = parsed.command;
    switch (command.kind) {
      case 'ls': {
        const names = currentDirectory.listEntries();
        if (names.length === 0) {
          append('(empty)');
          break;
        }
        for (const name of names) {
          const entry = entryByName.get(name);
          append(`${entry?.kind ?? WorldFolderEntryKind.Other}  ${name}`);
        }
        break;
      }
      case 'cd': {
        const result = new ConsoleDirectoryConstraint().validate(command, currentDirectory);
        if (!result.ok) {
          append(`error: ${result.reason ?? 'directory rejected'}`);
          break;
        }
        setCurrentPath(pathFromDirectory(result.nextDirectory));
        setSelectedEntryId(null);
        append(result.nextDirectory.getPath());
        const nextName = pathFromDirectory(result.nextDirectory).at(-1);
        const nextEntry = nextName ? entryByName.get(nextName) : undefined;
        if (nextEntry) onCdEntry?.(nextEntry);
        break;
      }
      case 'pwd':
        append(currentPathLabel);
        break;
      case 'open': {
        const requested = command.args[0];
        const target = requested
          ? localEntries.find((entry) => entry.displayName === requested) ?? null
          : selectedEntry;
        if (target) openEntry(target);
        else append(requested ? `error: entry not found: ${requested}` : 'error: no entry selected');
        break;
      }
      case 'export':
        if (selectedEntry) {
          onExport?.(selectedEntry);
          append(`export intent: ${selectedEntry.displayName}`);
        } else {
          append('error: no entry selected');
        }
        break;
      case 'import':
        append('import: 自动导入在 R3.5 接入；当前不执行文件操作。');
        break;
      case 'settings':
        setSettingsOpen(true);
        break;
      case 'help':
        for (const item of ConsoleCommandList) append(`${item.name.padEnd(8)} ${item.summary}`);
        break;
      case 'clear':
        setHistory([]);
        break;
      case 'exit':
        if (onExit) onExit();
        else append('exit: 当前没有上级界面');
        break;
      default:
        break;
    }
  };

  const submitInput = () => {
    const raw = input.trim();
    if (raw.length === 0) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    append(`> ${raw}`);
    handleCommand(raw);
    setInput('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitInput();
  };

  const handleRootKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    ) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (visibleEntries.length === 0) return;
      event.preventDefault();
      const currentIndex = selectedEntryId === null
        ? -1
        : visibleEntries.findIndex((entry) => entry.entryId === selectedEntryId);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? (delta > 0 ? 0 : visibleEntries.length - 1)
        : (currentIndex + delta + visibleEntries.length) % visibleEntries.length;
      setSelectedEntryId(visibleEntries[nextIndex].entryId);
      setSelectionMode(WorldSelectionMode.Keyboard);
      return;
    }

    if (event.key === 'Enter' && selectedEntry) {
      event.preventDefault();
      openEntry(selectedEntry);
      return;
    }

    if (event.key === 'Escape') {
      setSettingsOpen(false);
      setContextMenu(null);
    }
  };

  const selectEntry = (entry: WorldFileEntry, mode: WorldSelectionMode) => {
    setSelectedEntryId(entry.entryId);
    setSelectionMode(mode);
  };

  const openContextMenu = (event: MouseEvent<HTMLButtonElement>, entry: WorldFileEntry) => {
    event.preventDefault();
    event.stopPropagation();
    selectEntry(entry, WorldSelectionMode.Pointer);
    setContextMenu({ entryId: entry.entryId, x: event.clientX, y: event.clientY });
  };

  const addEntry = () => {
    let index = 1;
    while (localEntries.some((entry) => entry.displayName === `new-world-${index}`)) index += 1;
    const entry: WorldFileEntry = {
      entryId: `new-${Date.now()}-${index}`,
      displayName: `new-world-${index}`,
      kind: WorldFolderEntryKind.WorldExe,
    };
    setLocalEntries((previous) => [...previous, entry]);
    setSelectedEntryId(entry.entryId);
    append(`created ${entry.displayName}`);
  };

  const removeEntry = (entry: WorldFileEntry) => {
    setLocalEntries((previous) => previous.filter((item) => item.entryId !== entry.entryId));
    if (selectedEntryId === entry.entryId) setSelectedEntryId(null);
    if (currentPath.includes(entry.displayName)) setCurrentPath([]);
    append(`deleted ${entry.displayName}`);
  };

  const exportEntry = (entry: WorldFileEntry) => {
    onExport?.(entry);
    append(`export intent: ${entry.displayName}`);
  };

  return {
    currentPathLabel,
    selectedEntryId,
    hoveredEntryId,
    setHoveredEntryId,
    selectionMode,
    history,
    input,
    setInput,
    effect,
    setEffect,
    settingsOpen,
    setSettingsOpen,
    contextMenu,
    setContextMenu,
    contextEntry,
    visibleEntries,
    selectedEntry,
    inputRef,
    append,
    openEntry,
    submit,
    submitInput,
    handleRootKeyDown,
    selectEntry,
    openContextMenu,
    addEntry,
    removeEntry,
    exportEntry,
  };
}

export function WorldFolderConsole({
  worldId,
  worldName,
  entries,
  onBack,
  onExport,
}: WorldFolderConsoleProps) {
  const [loadingEntry, setLoadingEntry] = useState<WorldFileEntry | null>(null);
  const [activeWorld, setActiveWorld] = useState<WorldFileEntry | null>(null);

  const {
    currentPathLabel,
    selectedEntryId,
    hoveredEntryId,
    setHoveredEntryId,
    selectionMode,
    history,
    input,
    setInput,
    effect,
    setEffect,
    settingsOpen,
    setSettingsOpen,
    contextMenu,
    setContextMenu,
    contextEntry,
    visibleEntries,
    inputRef,
    append,
    openEntry,
    submit,
    submitInput,
    handleRootKeyDown,
    selectEntry,
    openContextMenu,
    addEntry,
    removeEntry,
    exportEntry,
  } = useConsoleSession({
    initialHistory: [
      `雨若 console · ${worldName}`,
      '输入 help 查看命令；双击事件树节点进入 console。',
    ],
    entries,
    onOpenEntry: (entry) => setLoadingEntry(entry),
    onExport,
  });

  return (
    <article
      className={[
        'world-console',
        `console-effect-${effect.toLowerCase()}`,
      ].join(' ')}
      aria-label={`${worldName} console`}
      tabIndex={0}
      onKeyDown={handleRootKeyDown}
      onClick={() => setContextMenu(null)}
    >
      <header className="world-console__topbar">
        <button type="button" role="button" onClick={onBack}>← 返回事件树</button>
        <span className="world-console__eyebrow">WORLD CONSOLE</span>
        <strong>{worldName}</strong>
        <span className="world-console__mode">{selectionMode}</span>
        <button type="button" role="button" onClick={() => setSettingsOpen(true)}>settings</button>
      </header>

      {activeWorld ? (
        <section className="console-world-view" aria-label="世界视图">
          <p className="world-console__eyebrow">WORLD VIEW / {worldId}</p>
          <h2>{activeWorld.displayName}</h2>
          <p>世界已进入。R3.4 接入 Pixi 视差；R3.5 接入媒体与编辑器。</p>
          <button type="button" role="button" onClick={() => setActiveWorld(null)}>
            返回 console
          </button>
        </section>
      ) : (
        <>
          <ConsoleEnvironmentText
            text={`NEUROU COMMAND CONSOLE / ${worldName} / ${currentPathLabel} / READY`}
          />

          <div className="world-console__layout">
            <aside className="world-console__directory" aria-label="世界文件目录">
              <p className="world-console__section-label">DIRECTORY</p>
              <p className="world-console__path">{currentPathLabel}</p>
              <ul role="listbox" aria-label="世界文件条目">
                {visibleEntries.map((entry) => (
                  <li key={entry.entryId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedEntryId === entry.entryId}
                      className={[
                        'console-entry',
                        selectedEntryId === entry.entryId ? 'is-selected' : '',
                        entry.orphan ? 'is-orphan' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectEntry(entry, WorldSelectionMode.Pointer);
                      }}
                      onMouseEnter={() => {
                        setHoveredEntryId(entry.entryId);
                        selectEntry(entry, WorldSelectionMode.Hover);
                      }}
                      onMouseLeave={() => setHoveredEntryId(null)}
                      onContextMenu={(event) => openContextMenu(event, entry)}
                      onDoubleClick={() => openEntry(entry)}
                    >
                      <WorldEntryHighlight
                        active={selectedEntryId === entry.entryId}
                        hovered={hoveredEntryId === entry.entryId}
                      >
                        {entry.displayName}
                      </WorldEntryHighlight>
                      <span className="console-entry__kind">{entry.kind}</span>
                      {entry.orphan ? <span className="console-entry__warning">⚠</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
              {visibleEntries.length === 0 ? <p className="world-console__empty">(empty)</p> : null}
            </aside>

            <main className="world-console__main">
              <ConsoleOutput lines={history} />
            </main>
          </div>

          <form className="world-console__input" onSubmit={submit}>
            <ConsolePrompt />
            <span className="world-console__input-path">{currentPathLabel}</span>
            <input
              ref={(element) => {
                inputRef.current = element;
              }}
              aria-label="console command"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitInput();
                }
              }}
            />
          </form>
        </>
      )}

      {settingsOpen ? (
        <SettingsConsole
          effect={effect}
          onChange={setEffect}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {contextMenu && contextEntry ? (
        <ContextMenuAction
          x={contextMenu.x}
          y={contextMenu.y}
          onNew={addEntry}
          onDelete={() => removeEntry(contextEntry)}
          onExport={() => exportEntry(contextEntry)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      {loadingEntry ? (
        <WorldLoadingSequence
          worldName={loadingEntry.displayName}
          prologue=""
          onComplete={() => {
            setActiveWorld(loadingEntry);
            setLoadingEntry(null);
            append(`entered ${loadingEntry.displayName}`);
          }}
        />
      ) : null}
    </article>
  );
}

/**
 * 内部 SVG 鱼眼位移滤镜：中心膨胀，边缘压缩。
 * 位移图在 256×256 canvas 中生成，不进入公开导出。
 */
function ConsoleFisheyeDefs() {
  const map = useMemo(() => {
    if (typeof document === 'undefined') return '';
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return '';
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x / (size - 1)) * 2 - 1;
        const ny = (y / (size - 1)) * 2 - 1;
        const radius = Math.min(1, Math.hypot(nx, ny));
        const pull = radius * 0.62;
        const index = (y * size + x) * 4;
        image.data[index] = Math.round(128 - nx * pull * 127);
        image.data[index + 1] = Math.round(128 - ny * pull * 127);
        image.data[index + 2] = 128;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }, []);

  if (!map) return null;

  return (
    <svg className="project-console__fisheye-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <filter id="project-console-fisheye" x="-18%" y="-18%" width="136%" height="136%">
          <feImage href={map} result="fisheye-map" preserveAspectRatio="none" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fisheye-map"
            scale="34"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
type GlitchTone = 'cool' | 'warm' | 'neutral';

function toneForTheme(theme: { readonly r: number; readonly g: number; readonly b: number }): GlitchTone {
  const warmth = theme.r - theme.b;
  if (warmth > 14) return 'warm';
  if (warmth < -14) return 'cool';
  return 'neutral';
}

function emitGlitchTone(tone: GlitchTone): void {
  window.dispatchEvent(new CustomEvent('neurou:glitch-tone', { detail: tone }));
}
function emitGlitchClear(): void {
  window.dispatchEvent(new CustomEvent('neurou:glitch-clear'));
}
function emitGlitchSurge(intensity: number): void {
  window.dispatchEvent(new CustomEvent('neurou:glitch-surge', { detail: intensity }));
}
function formatProjectId(projectId: string): string {
  return /^\d{8}$/.test(projectId)
    ? `${projectId.slice(0, 4)} ${projectId.slice(4)}`
    : projectId;
}

function formatDate(value: number | null): string {
  if (value === null) return '—';
  return new Date(value).toISOString().slice(0, 10);
}

function themeHex(theme: { r: number; g: number; b: number }): string {
  return `#${[theme.r, theme.g, theme.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}


export function ProjectConsole({
  project,
  worlds,
  onExit,
  onEnterWorld,
  onEditWorld,
  origin,
  rainEnabled,
  rainState,
  onRainEnabledChange,
  onRainRefresh,
}: ProjectConsoleProps) {
  const [loadingWorld, setLoadingWorld] = useState<WorldInstance | null>(null);
  const [activeWorld, setActiveWorld] = useState<WorldInstance | null>(null);
  const [enterPhase, setEnterPhase] = useState<'idle' | 'zoom' | 'black' | 'reveal'>('idle');
  const [enterLogs, setEnterLogs] = useState<readonly string[]>([]);
  const [flash, setFlash] = useState(false);
  const [worldCommandOpen, setWorldCommandOpen] = useState(false);
  const [worldCommand, setWorldCommand] = useState('');
  const enterTokenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const worldInputRef = useRef<HTMLInputElement>(null);

  // 居中字幕期间同时隐藏系统光标（已全局 none）与自绘准星。
  useLayoutEffect(() => {
    if (enterPhase !== 'black') return;
    document.body.setAttribute('data-crosshair-hidden', 'true');
    return () => {
      document.body.removeAttribute('data-crosshair-hidden');
    };
  }, [enterPhase]);

  useEffect(() => {
    emitGlitchTone(toneForTheme(project.meta.theme));
    return () => emitGlitchTone('neutral');
  }, [project.meta.theme]);

  const projectWorlds = useMemo(() => {
    const byId = new Map(worlds.map((world) => [world.worldId, world]));
    const ordered = project.meta.worldIds
      .map((worldId) => byId.get(worldId))
      .filter((world): world is WorldInstance => world !== undefined);
    return ordered.length > 0 ? ordered : [...worlds];
  }, [project.meta.worldIds, worlds]);

  const entries = useMemo<readonly WorldFileEntry[]>(
    () => projectWorlds.map((world) => ({
      entryId: world.worldId,
      displayName: world.worldId,
      kind: WorldFolderEntryKind.WorldExe,
    })),
    [projectWorlds],
  );

  const introText = useMemo(() => {
    const meta = project.meta;
    const prologue = meta.prologue;
    return [
      'loading project package...',
      'reading project.json...',
      'mounting worlds...',
      'ready.',
      `NEUROU PROJECT CONSOLE / ${meta.projectName}`,
      `Author: ${meta.author || '—'}`,
      `Created: ${formatDate(meta.createdAt)}`,
      `Completed: ${formatDate(meta.completedAt)}`,
      `Worlds: ${projectWorlds.length}`,
      `Theme: ${themeHex(meta.theme)}`,
      `Prologue: ${prologue.title || '—'}`,
      ...prologue.lines.map((line) => `  ${line}`),
      `Project ID: ${formatProjectId(meta.projectId)}`,
      "Type 'help' to get command list",
      '',
    ].join('\n');
  }, [project.meta, projectWorlds.length]);

  const [typedIntro, setTypedIntro] = useState('');

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(introText.length, index + 2);
      setTypedIntro(introText.slice(0, index));
      if (index >= introText.length) window.clearInterval(timer);
    }, 9);
    return () => window.clearInterval(timer);
  }, [introText]);

  const appendEnterLog = (line: string) => {
    setEnterLogs((previous) => [...previous.slice(-160), line]);
  };

  const beginEnter = (world: WorldInstance) => {
    enterTokenRef.current += 1;
    setLoadingWorld(world);
    setActiveWorld(null);
    setEnterLogs([
      `[ OK ] world.${world.worldId} / package.world / size=48.2MB / sha256=9f2c...a1`,
      `       mount point: worlds/${world.worldId} | renderer=parallax-2.5d | worker=main`,
      `[ 00% ] allocating texture cache / shader bank / timeline buffers...`,
    ]);
    setEnterPhase('zoom');
    setFlash(false);
    setWorldCommandOpen(false);
  };

  const {
    currentPathLabel,
    history,
    input,
    setInput,
    effect,
    setEffect,
    settingsOpen,
    setSettingsOpen,
    inputRef,
    submit,
    submitInput,
    handleRootKeyDown,
    append,
  } = useConsoleSession({
    initialHistory: [],
    entries,
    onOpenEntry: (entry) => {
      const world = projectWorlds.find((item) => item.worldId === entry.entryId);
      if (world) beginEnter(world);
    },
    onCdEntry: (entry) => {
      const world = projectWorlds.find((item) => item.worldId === entry.entryId);
      if (world) beginEnter(world);
    },
    onExit,
    rainEnabled,
    rainState,
    onRainEnabledChange,
    onRainRefresh,
  });

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (!activeWorld) {
        if (event.key === 'Escape') onExit();
        if (event.key === 'Enter' && document.activeElement === inputRef.current) {
          event.preventDefault();
          submitInput();
        }
        return;
      }
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable === true;
      if (event.key === 'Escape') {
        if (worldCommandOpen) {
          event.preventDefault();
          setWorldCommandOpen(false);
          return;
        }
        onExit();
        return;
      }
      if (event.key === '/') {
        if (worldCommandOpen) {
          event.preventDefault();
          setWorldCommandOpen(false);
          return;
        }
        if (!editable) {
          event.preventDefault();
          setWorldCommandOpen(true);
          window.requestAnimationFrame(() => worldInputRef.current?.focus());
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeWorld, inputRef, onExit, submitInput, worldCommandOpen]);

  useEffect(() => {
    if (!loadingWorld) return;
    const startedAt = performance.now();
    const token = enterTokenRef.current;
    let lastLogAt = -1;
    let flashTimer = 0;
    let surgeTimer = 0;
    const surge = () => {
      if (token !== enterTokenRef.current) return;
      const elapsed = performance.now() - startedAt;
      if (elapsed >= 3400) return;
      const ramp = Math.min(1, elapsed / 3400);
      emitGlitchSurge(0.18 + ramp * 0.82);
      surgeTimer = window.setTimeout(surge, 250);
    };
    surgeTimer = window.setTimeout(surge, 350);
    const flashAt = window.setTimeout(() => {
      if (token !== enterTokenRef.current) return;
      setActiveWorld(loadingWorld);
      setEnterPhase('reveal');
      onEnterWorld?.(loadingWorld);
      setFlash(true);
      flashTimer = window.setTimeout(() => setFlash(false), 200);
    }, WORLD_FLASH_AT_MS);
    const timer = window.setInterval(() => {
      if (token !== enterTokenRef.current) return;
      const elapsed = performance.now() - startedAt;
      if (elapsed < WORLD_BLACK_START_MS) {
        const progress = Math.min(1, elapsed / WORLD_BLACK_START_MS);
        if (elapsed - lastLogAt > 70) {
          lastLogAt = elapsed;
          const percent = Math.min(99, Math.round(progress * 99));
          const slots = 28;
          const filled = Math.max(0, Math.min(slots, Math.floor((percent / 100) * slots)));
          const bar = `${'='.repeat(filled)}>${' '.repeat(Math.max(0, slots - filled - 1))}`;
          const chunk = Math.min(64, Math.max(1, Math.floor(progress * 64)));
          const packageMb = (28.4 + progress * 41.2).toFixed(1);
          const shaderPass = 128 + Math.floor(progress * 1920);
          const textures = 24 + Math.floor(progress * 216);
          const buffers = 8 + Math.floor(progress * 72);
          const vram = (96 + progress * 512).toFixed(0);
          const crc = (0x9f2c00 + chunk * 0x1a7).toString(16).padStart(8, '0');
          appendEnterLog(
            `[ OK ] world.${loadingWorld.worldId}/layer.${String(chunk).padStart(2, '0')}  pkg=${packageMb}MB  chunk=${String(chunk).padStart(2, '0')}/64  crc=0x${crc}  stream=parallax`,
          );
          appendEnterLog(
            `[${String(percent).padStart(2, '0')}%] shader.pass=${shaderPass}/2048  textures=${textures}  buffers=${buffers}  vram=${vram}MB  [${bar}]`,
          );
          appendEnterLog(
            `       asset=world.${loadingWorld.worldId}.atlas  worker=render.main  node=${String.fromCharCode(97 + (chunk % 6))}.${chunk % 8}  elapsed=${Math.round(elapsed)}ms  state=mounting`,
          );
        }
      } else if (elapsed < WORLD_FLASH_AT_MS) {
        emitGlitchClear();
        setEnterPhase('black');
      } else if (elapsed >= WORLD_IDLE_AT_MS) {
        setActiveWorld(loadingWorld);
        setLoadingWorld(null);
        setEnterPhase('idle');
        setFlash(false);
      }
    }, 70);
    return () => {
      emitGlitchClear();
      window.clearInterval(timer);
      window.clearTimeout(surgeTimer);
      window.clearTimeout(flashTimer);
      window.clearTimeout(flashAt);
    };
  }, [loadingWorld, onEnterWorld]);

  // 输入行跟随文本末尾；history/enterLogs 变化时滚到底部。
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [typedIntro, history, enterLogs, enterPhase, input]);

  useEffect(() => {
    if (enterPhase === 'idle' || enterPhase === 'zoom') {
      inputRef.current?.focus();
    }
  }, [history, enterLogs, enterPhase, inputRef]);

  useEffect(() => {
    if (activeWorld || enterPhase !== 'idle') return;
    const focus = () => inputRef.current?.focus({ preventScroll: true });
    focus();
    const raf = window.requestAnimationFrame(focus);
    const first = window.setTimeout(focus, 90);
    const second = window.setTimeout(focus, 240);
    const onKeyDown = () => {
      if (settingsOpen) return;
      if (document.activeElement !== inputRef.current) focus();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [activeWorld, enterPhase, settingsOpen, inputRef]);

  const introLines = useMemo(() => typedIntro.split('\n'), [typedIntro]);
  const displayLines = useMemo(
    () => [...introLines, ...history, ...enterLogs],
    [introLines, history, enterLogs],
  );
  const worldVisible = activeWorld !== null && (enterPhase === 'reveal' || enterPhase === 'idle');

  const imprintText = displayLines.slice(-16).join('\n');
  const consoleStyle = {
    '--console-accent': `rgb(${project.meta.theme.r}, ${project.meta.theme.g}, ${project.meta.theme.b})`,
    ...(enterPhase === 'zoom'
      ? {
        '--console-origin-x': `${origin?.x ?? 640}px`,
        '--console-origin-y': `${origin?.y ?? 400}px`,
      }
      : {}),
  } as CSSProperties;

  return (
    <>
      <article
        className={[
          'project-console',
          `console-effect-${effect.toLowerCase()}`,
          enterPhase === 'black' ? 'is-blackout' : '',
          enterPhase === 'zoom' ? 'is-zooming' : '',
        ].join(' ')}
        aria-label={`${project.meta.projectName} project console`}
        tabIndex={0}
        onKeyDown={handleRootKeyDown}
        style={consoleStyle}
      >
        <ConsoleFisheyeDefs />
        <div className="project-console__fx" aria-hidden="true">
          <span className="project-console__fx-scan" />
          <span className="project-console__fx-pixel" />
          <span className="project-console__fx-vignette" />
        </div>

        {enterPhase === 'zoom' ? (
          <div className="project-console__echo-layer" aria-hidden="true">
            <pre className="project-console__echo project-console__echo--one">{imprintText}</pre>
            <pre className="project-console__echo project-console__echo--two">{imprintText}</pre>
            <pre className="project-console__echo project-console__echo--three">{imprintText}</pre>
          </div>
        ) : null}

        {enterPhase === 'zoom' ? (
          <div className="project-console__stream" aria-hidden="true">
            <div className="project-console__stream-track">
              {Array.from({ length: 18 }, (_, index) => (
                <pre className="project-console__stream-copy" key={index}>{imprintText}</pre>
              ))}
            </div>
            <div className="project-console__stream-tear" />
          </div>
        ) : null}

      {worldVisible && activeWorld ? (
        <>
          <section className="project-console__world" aria-label="世界视图">
            <div
              className="project-console__world-scene"
              style={{
                backgroundImage: `radial-gradient(ellipse at 34% 64%, rgba(${activeWorld.themeColor.r}, ${activeWorld.themeColor.g}, ${activeWorld.themeColor.b}, 0.34), transparent 58%), linear-gradient(135deg, rgba(10, 18, 28, 0.95), #000 72%)`,
              }}
            >
              <span className="project-console__world-layer project-console__world-layer--one" />
              <span className="project-console__world-layer project-console__world-layer--two" />
              <span className="project-console__world-grid" />
            </div>
            <div className="project-console__world-copy">
              <p className="project-console__world-eyebrow">WORLD / {activeWorld.worldId}</p>
              <h2>{activeWorld.worldId}</h2>
              <p className="project-console__prologue">{activeWorld.prologue}</p>
            </div>
          </section>

          {worldCommandOpen ? (
            <form
              className="project-console__world-command"
              onSubmit={(event) => {
                event.preventDefault();
                const rawCommand = worldCommand.trim().toLowerCase();
                const command = rawCommand.startsWith('/')
                  ? rawCommand.slice(1).trim()
                  : rawCommand;
                if (command === 'edit') {
                  if (!onEditWorld) {
                    append('editor unavailable.');
                    return;
                  }
                  append(`edit ${activeWorld.worldId} ...`);
                  setWorldCommandOpen(false);
                  setWorldCommand('');
                  onEditWorld(activeWorld, project.meta.projectName);
                  return;
                }
                if (command === 'exit' || command === 'quit') {
                  enterTokenRef.current += 1;
                  for (const line of enterLogs) append(line);
                  append('world session closed.');
                  setActiveWorld(null);
                  setLoadingWorld(null);
                  setEnterPhase('idle');
                  setEnterLogs([]);
                  setWorldCommandOpen(false);
                  setWorldCommand('');
                  setFlash(false);
                  window.requestAnimationFrame(() => inputRef.current?.focus());
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                  return;
                }
                setWorldCommand('');
                window.requestAnimationFrame(() => worldInputRef.current?.focus());
              }}
            >
              <span>&gt;</span>
              <input
                ref={worldInputRef}
                aria-label="world command"
                autoComplete="off"
                spellCheck={false}
                value={worldCommand}
                onChange={(event) => setWorldCommand(event.target.value)}
              />
            </form>
          ) : null}
        </>
      ) : enterPhase === 'black' ? (
        <div className="project-console__black">
          <span className="project-console__shutdown-line" aria-hidden="true" />
          {loadingWorld ? (
            <p className="project-console__black-prologue">{loadingWorld.prologue}</p>
          ) : null}
        </div>
      ) : (
        <div className="project-console__scroll" ref={scrollRef}>
          <div
            className="project-console__fisheye"
            onMouseDown={() => window.getSelection()?.removeAllRanges()}
            onDragStart={(event) => event.preventDefault()}
          >
            <ConsoleOutput lines={displayLines} />
          </div>
          <form className="project-console__input" onSubmit={submit}>
            <span className="project-console__virtual-path">
              {`NeurOS  C:\\A_Try\\${project.meta.projectName}`}
            </span>
            <ConsolePrompt />
            <input
              ref={(element) => {
                inputRef.current = element;
              }}
              aria-label="project console command"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitInput();
                }
              }}
            />
          </form>
          <div className="project-console__tail-lines" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <div className="project-console__tail-line" key={index} />
            ))}
          </div>
        </div>
      )}

      <div className="project-console__frame" aria-hidden="true" />
      {flash ? <div className="project-console__flash" aria-hidden="true" /> : null}

      {settingsOpen ? (
        <SettingsConsole
          effect={effect}
          onChange={setEffect}
          onClose={() => setSettingsOpen(false)}
          rainEnabled={rainEnabled}
          rainState={rainState}
          onRainEnabledChange={onRainEnabledChange}
          onRainRefresh={onRainRefresh}
        />
      ) : null}
    </article>
    </>
  );
}
