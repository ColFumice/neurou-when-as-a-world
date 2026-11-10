import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Crosshair } from './components/Crosshair';
import { ProjectTreeDemoScreen, PROJECT_WORLDS } from './screens/ProjectTreeDemoScreen';
import { Stereo3DDemoScreen } from './screens/Stereo3DDemoScreen';
import { RainDemoScreen } from './screens/RainDemoScreen';
import { EditorScreen } from './editor/EditorScreen';
import { GameScreen } from './game/GameScreen';
import { RainRuntime } from './game/rainRuntime';
import { TauriLocationResolver, TauriWeatherResolver } from './adapters/rainAdapters';
import { DEMO_PROJECT_ROOT } from './game/projectRoot';
import {
  consumeInitialGameMode,
  resetGameModeEntry,
} from './game/gameModeEntry';
import type { EditorEntry } from './editor/types';
import type { RainModeState, WorldInstance } from '@core/world/types';

type AppScreen = 'project' | 'stereo3d' | 'rain' | 'editor';

function initialScreen(): AppScreen {
  if (window.location.hash === '#stereo3d') return 'stereo3d';
  if (window.location.hash === '#rain') return 'rain';
  return 'project';
}

/**
 * R5c-B-patch：一次性 debug 入口。
 * index.html 在 Tauri 丢 query 前写入 sessionStorage；这里消费并立即清除。
 * closeGame / openEditor 会把 App 的 initialGameMode 重置回 Explore。
 */
const INITIAL_GAME_MODE: 'explore' | 'rhythm' = (() => {
  if (typeof window === 'undefined') return 'explore';
  return consumeInitialGameMode(window.location.search, window.sessionStorage);
})();
interface GlitchRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly shift: number;
  readonly opacity: number;
  readonly white: boolean;
}

interface GlitchLadder {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

interface GlitchPatch {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

interface GlitchInversion {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface GlitchSlice {
  readonly top: number;
  readonly height: number;
  readonly shift: number;
  readonly shiftY: number;
  readonly opacity: number;
}

interface GlitchStrip {
  readonly top: number;
  readonly height: number;
  readonly shift: number;
  readonly shiftY: number;
  readonly opacity: number;
  readonly white: boolean;
}

interface ResidueBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}
interface WhiteBlock {
  readonly id: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly shift: number;
  readonly expiresAt: number;
}
interface GlitchBurst {
  readonly id: number;
  readonly tone: string;
  readonly tone2: string;
  readonly strength: number;
  readonly rects: readonly GlitchRect[];
  readonly ladders: readonly GlitchLadder[];
  readonly snow: readonly GlitchPatch[];
  readonly inversions: readonly GlitchInversion[];
  readonly slices: readonly GlitchSlice[];
  readonly strips: readonly GlitchStrip[];
  readonly residues: readonly ResidueBox[];
}

type GlitchTone = 'cool' | 'warm' | 'neutral';

const GLITCH_PALETTES: Readonly<Record<GlitchTone, readonly string[]>> = {
  cool: ['#5f8fad', '#6f7fb0', '#5fa99b', '#7a8fbf', '#88a6b8', '#9aa8b8'],
  warm: ['#b06a5f', '#b38a55', '#a35f78', '#b07f5f', '#b99a72', '#b8a8a0'],
  neutral: ['#8f9498', '#96918d', '#858c94', '#9b9b9b', '#8f8b92'],
};

function createTearMap(): string {
  const size = 256;
  const bands = 22;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(size, size);
  const offsets = Array.from({ length: bands }, () => (Math.random() * 2 - 1) * 0.95);
  for (let y = 0; y < size; y += 1) {
    const band = Math.min(bands - 1, Math.floor((y / size) * bands));
    const red = Math.round(128 + offsets[band] * 127);
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      image.data[index] = red;
      image.data[index + 1] = 128;
      image.data[index + 2] = 128;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function TearFilter({ map, scale }: { readonly map: string; readonly scale: number }) {
  if (!map) return null;
  return (
    <svg className="global-tear-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <filter id="global-tear" x="-25%" y="-25%" width="150%" height="150%">
          <feImage href={map} result="tear-map" preserveAspectRatio="none" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="tear-map"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
/**
 * 全局故障层：任何界面的 pointerdown / keydown / wheel 都会触发。
 * 每次 burst 同时生成矩形群、横向栅格、雪花、局部反色、错位切片。
 */
function GlobalGlitch() {
  const [burst, setBurst] = useState<GlitchBurst | null>(null);
  const [whiteBlocks, setWhiteBlocks] = useState<readonly WhiteBlock[]>([]);
  const [tearMap, setTearMap] = useState('');
  const [tearScale, setTearScale] = useState(190);
  const [tearing, setTearing] = useState(false);
  const idRef = useRef(0);
  const whiteIdRef = useRef(0);
  const toneRef = useRef<GlitchTone>('neutral');

  useEffect(() => {
    document.body.classList.toggle('glitch-tearing', tearing);
    return () => document.body.classList.remove('glitch-tearing');
  }, [tearing]);

  useEffect(() => {
    let lastFired = 0;
    let lastWheel = 0;
    let clearTimer = 0;
    let tearTimer = 0;

    const fire = (forcedIntensity?: number) => {
      const now = performance.now();
      if (now - lastFired < 58) return;
      lastFired = now;
      idRef.current += 1;
      const palette = GLITCH_PALETTES[toneRef.current];
      const tone = palette[Math.floor(Math.random() * palette.length)];
      const tone2 = palette[Math.floor(Math.random() * palette.length)];
      const intensity = forcedIntensity === undefined
        ? 0.04 + Math.pow(Math.random(), 2.4) * 0.64
        : Math.min(1, Math.max(0.05, forcedIntensity));
      const strength = intensity;
      const rand = () => Math.random();
      const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

      setTearMap(createTearMap());
      setTearScale(35 + intensity * 155);
      setTearing(true);
      window.clearTimeout(tearTimer);
      tearTimer = window.setTimeout(() => {
        setTearing(false);
        setTearMap('');
      }, 100 + intensity * 180 + rand() * 40);

      const rects: GlitchRect[] = [];
      let whiteCount = 0;
      const whiteQuota = intensity > 0.7 ? 5 : intensity > 0.4 ? 2 : 0;
      const clusterCount = 1 + Math.floor(rand() * (1 + intensity * 1.4));
      for (let cluster = 0; cluster < clusterCount; cluster += 1) {
        const baseX = 3 + rand() * 74;
        let top = 3 + rand() * 68;
        const count = 1 + Math.floor(rand() * (2 + intensity * 3));
        for (let index = 0; index < count; index += 1) {
          const height = 2 + rand() * 9;
          const width = 8 + rand() * 38;
          const white = whiteCount < whiteQuota && (whiteCount === 0 || rand() < 0.2 + intensity * 0.45);
          if (white) whiteCount += 1;
          rects.push({
            left: clamp(baseX + (rand() * 8 - 3), 0, 92),
            top: clamp(top, 0, 94),
            width,
            height,
            shift: (rand() - 0.5) * 34,
            opacity: (0.10 + rand() * 0.22) * (0.45 + intensity * 0.55),
            white,
          });
          top += height + rand() * 4;
        }
      }

      const ladders: GlitchLadder[] = [];
      const ladderCount = 2 + Math.floor(rand() * (2 + intensity * 6));
      for (let index = 0; index < ladderCount; index += 1) {
        ladders.push({
          left: rand() * 98,
          top: rand() * 55,
          width: 1 + rand() * 4,
          height: 22 + rand() * 72,
          opacity: (0.12 + rand() * 0.2) * (0.4 + intensity * 0.8),
        });
      }

      const snow: GlitchPatch[] = [];
      const snowCount = 2 + Math.floor(rand() * (2 + intensity * 3));
      for (let index = 0; index < snowCount; index += 1) {
        snow.push({
          left: rand() * 85,
          top: rand() * 80,
          width: 10 + rand() * 26,
          height: 5 + rand() * 18,
          opacity: (0.24 + rand() * 0.24) * (0.45 + intensity * 0.8),
        });
      }

      const inversions: GlitchInversion[] = [];
      const inversionCount = intensity > 0.18 ? 2 + Math.floor(rand() * (2 + intensity * 6)) : 0;
      for (let index = 0; index < inversionCount; index += 1) {
        inversions.push({
          left: rand() * 78,
          top: rand() * 76,
          width: 6 + rand() * 26,
          height: 3 + rand() * 11,
        });
      }

      const slices: GlitchSlice[] = [];
      const sliceCount = 1 + Math.floor(rand() * (2 + intensity * 5));
      for (let index = 0; index < sliceCount; index += 1) {
        slices.push({
          top: rand() * 94,
          height: 2 + rand() * 9,
          shift: (rand() - 0.5) * 360,
          shiftY: (rand() - 0.5) * 90,
          opacity: (0.14 + rand() * 0.28) * (0.4 + intensity * 0.8),
        });
      }

      const strips: GlitchStrip[] = [];
      const stripCount = 1 + Math.floor(rand() * (2 + intensity * 6));
      const stripWhiteQuota = intensity > 0.7 ? 4 : intensity > 0.4 ? 1 : 0;
      let stripWhiteCount = 0;
      for (let index = 0; index < stripCount; index += 1) {
        const white = stripWhiteCount < stripWhiteQuota
          && (stripWhiteCount === 0 || rand() < 0.25 + intensity * 0.4);
        if (white) stripWhiteCount += 1;
        strips.push({
          top: rand() * 96,
          height: 0.7 + rand() * 2.6,
          shift: (rand() - 0.5) * 180,
          shiftY: (rand() - 0.5) * 50,
          opacity: (0.16 + rand() * 0.26) * (0.4 + intensity * 0.8),
          white,
        });
      }

      const residues: ResidueBox[] = [];
      const residueCount = 2 + Math.floor(rand() * (2 + intensity * 3));
      for (let index = 0; index < residueCount; index += 1) {
        residues.push({
          left: rand() * 86,
          top: rand() * 84,
          width: 4 + rand() * 30,
          height: 2 + rand() * 12,
          opacity: (0.18 + rand() * 0.32) * (0.5 + intensity * 0.5),
        });
      }

      if (intensity > 0.5) {
        const now = performance.now();
        const count = intensity > 0.82
          ? 18 + Math.floor(rand() * 18)
          : intensity > 0.65
            ? 8 + Math.floor(rand() * 10)
            : 3 + Math.floor(rand() * 5);
        const blocks: WhiteBlock[] = [];
        for (let index = 0; index < count; index += 1) {
          whiteIdRef.current += 1;
          const wide = rand() > 0.72;
          blocks.push({
            id: whiteIdRef.current,
            left: -8 + rand() * 96,
            top: rand() * 99,
            width: wide ? 55 + rand() * 50 : 12 + rand() * 54,
            height: wide ? 5 + rand() * 12 : 1.4 + rand() * 6,
            color: ['#ff3b3b', '#3bff6d', '#3b73ff', '#ffffff'][Math.floor(rand() * 4)],
            shift: (rand() - 0.5) * 84,
            expiresAt: now + 300,
          });
        }
        setWhiteBlocks((previous) => [
          ...previous.filter((block) => block.expiresAt > now),
          ...blocks,
        ].slice(-300));
      }

      setBurst({
        id: idRef.current,
        tone,
        tone2,
        strength,
        rects,
        ladders,
        snow,
        inversions,
        slices,
        strips,
        residues,
      });
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setBurst(null), 920 + Math.random() * 260);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"], canvas, svg')) {
        return;
      }
      fire();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
      const active = document.activeElement;
      const typing = active instanceof HTMLElement
        && (active.tagName === 'INPUT'
          || active.tagName === 'TEXTAREA'
          || active.isContentEditable);
      if (typing && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return;
      }
      fire();
    };

    const onWheel = () => {
      const now = performance.now();
      if (now - lastWheel < 160) return;
      lastWheel = now;
      fire();
    };

    const onTone = (event: unknown) => {
      const tone = (event as CustomEvent<GlitchTone>).detail;
      if (tone === 'cool' || tone === 'warm' || tone === 'neutral') {
        toneRef.current = tone;
      }
    };

    const onSurge = (event: unknown) => {
      const value = (event as CustomEvent<number>).detail;
      if (typeof value === 'number') fire(value);
    };

    const onClear = () => {
      setWhiteBlocks([]);
    };

    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    window.addEventListener('neurou:glitch-tone', onTone);
    window.addEventListener('neurou:glitch-surge', onSurge);
    window.addEventListener('neurou:glitch-clear', onClear);

    const ambient = window.setInterval(() => {
      if (Math.random() < 0.45) fire();
    }, 12_000);

    const whiteCleanup = window.setInterval(() => {
      const now = performance.now();
      setWhiteBlocks((previous) => previous.filter((block) => block.expiresAt > now));
    }, 110);

    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('neurou:glitch-tone', onTone);
      window.removeEventListener('neurou:glitch-surge', onSurge);
      window.removeEventListener('neurou:glitch-clear', onClear);
      window.clearInterval(ambient);
      window.clearInterval(whiteCleanup);
      window.clearTimeout(clearTimer);
      window.clearTimeout(tearTimer);
    };
  }, []);

  if (!burst && whiteBlocks.length === 0 && !tearMap) return null;

  const style = burst
    ? {
      '--glitch-tone': burst.tone,
      '--glitch-tone-2': burst.tone2,
      '--glitch-strength': `${burst.strength}`,
    } as CSSProperties
    : undefined;

  return (
    <>
      <TearFilter map={tearMap} scale={tearScale} />
      {burst ? (
        <div
          className={`global-glitch${burst.strength > 0.78 ? ' global-glitch--max' : ''}`}
          style={style}
          aria-hidden="true"
          key={burst.id}
        >
      <span className="global-glitch__flash" />
      {burst.rects.map((rect, index) => (
        <span
          className={`global-glitch__rect${rect.white ? ' global-glitch__rect--white' : ''}`}
          key={`rect-${index}`}
          style={{
            left: `${rect.left}%`,
            top: `${rect.top}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
            transform: `translateX(${rect.shift}px)`,
            '--glitch-opacity': `${rect.opacity}`,
          } as CSSProperties}
        />
      ))}
      {burst.ladders.map((ladder, index) => (
        <span
          className="global-glitch__ladder"
          key={`ladder-${index}`}
          style={{
            left: `${ladder.left}%`,
            top: `${ladder.top}%`,
            width: `${ladder.width}px`,
            height: `${ladder.height}%`,
            '--glitch-opacity': `${ladder.opacity}`,
          } as CSSProperties}
        />
      ))}
      {burst.snow.map((patch, index) => (
        <span
          className="global-glitch__snow"
          key={`snow-${index}`}
          style={{
            left: `${patch.left}%`,
            top: `${patch.top}%`,
            width: `${patch.width}%`,
            height: `${patch.height}%`,
            '--glitch-opacity': `${patch.opacity}`,
          } as CSSProperties}
        />
      ))}
      {burst.inversions.map((patch, index) => (
        <span
          className="global-glitch__invert"
          key={`invert-${index}`}
          style={{
            left: `${patch.left}%`,
            top: `${patch.top}%`,
            width: `${patch.width}%`,
            height: `${patch.height}%`,
          }}
        />
      ))}
      {burst.slices.map((slice, index) => (
        <span
          className="global-glitch__slice"
          key={`slice-${index}`}
          style={{
            top: `${slice.top}%`,
            height: `${slice.height}%`,
            '--glitch-shift': `${slice.shift}px`,
            '--glitch-shift-y': `${slice.shiftY}px`,
            '--glitch-opacity': `${slice.opacity}`,
          } as CSSProperties}
        />
      ))}
      {burst.strips.map((strip, index) => (
        <span
          className={`global-glitch__long-strip${strip.white ? ' global-glitch__long-strip--white' : ''}`}
          key={`strip-${index}`}
          style={{
            top: `${strip.top}%`,
            height: `${strip.height}%`,
            '--glitch-shift': `${strip.shift}px`,
            '--glitch-shift-y': `${strip.shiftY}px`,
            '--glitch-opacity': `${strip.opacity}`,
          } as CSSProperties}
        />
      ))}
      {burst.residues.map((box, index) => (
        <span
          className="global-glitch__residue"
          key={`residue-${index}`}
          style={{
            left: `${box.left}%`,
            top: `${box.top}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
            '--glitch-opacity': `${box.opacity}`,
          } as CSSProperties}
        />
      ))}
      <span className="global-glitch__scan" />
        </div>
      ) : null}

      {whiteBlocks.length > 0 ? (
        <div className="global-glitch__whiteout" aria-hidden="true">
          {whiteBlocks.map((block) => (
            <span
              className="global-glitch__white-block"
              key={`white-${block.id}`}
              style={{
                left: `${block.left}%`,
                top: `${block.top}%`,
                width: `${block.width}%`,
                height: `${block.height}%`,
                background: block.color,
                transform: `translateX(${block.shift}px)`,
              }}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
function initialGameEntry(): {
  world: WorldInstance;
  projectName: string;
  projectRoot: string;
} | null {
  if (window.location.hash !== '#game') return null;
  return {
    world: PROJECT_WORLDS[0],
    projectName: 'chromato',
    projectRoot: DEMO_PROJECT_ROOT,
  };
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(initialScreen);
  const [editorEntry, setEditorEntry] = useState<EditorEntry | null>(null);
  const [gameEntry, setGameEntry] = useState<{
    world: WorldInstance;
    projectName: string;
    projectRoot: string;
  } | null>(initialGameEntry);
  const [initialGameMode, setInitialGameMode] = useState<'explore' | 'rhythm'>(INITIAL_GAME_MODE);
  const [rainEnabled, setRainEnabled] = useState(false);
  const [rainState, setRainState] = useState<RainModeState | null>(null);
  const rainRuntime = useMemo(() => new RainRuntime({
    locationResolver: new TauriLocationResolver(),
    weatherResolver: new TauriWeatherResolver(),
    now: () => Date.now(),
    onStateChange: (state) => setRainState(state),
  }), []);

  const toggleRain = (enabled: boolean): void => {
    setRainEnabled(enabled);
    void rainRuntime.setEnabled(enabled);
  };

  const refreshRain = (): void => {
    void rainRuntime.refresh();
  };

  const openStereoDemo = (): void => {
    window.location.hash = 'stereo3d';
    setScreen('stereo3d');
  };

  const closeStereoDemo = (): void => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setScreen('project');
  };

  const openRainDemo = (): void => {
    window.location.hash = 'rain';
    setScreen('rain');
  };

  const closeRainDemo = (): void => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setScreen('project');
  };

  const openEditor = (world: WorldInstance, projectName: string): void => {
    setEditorEntry({ world, projectName });
    setGameEntry(null);
    setInitialGameMode(resetGameModeEntry(window.sessionStorage));
    window.location.hash = 'editor';
    setScreen('editor');
  };

  const openGame = (
    world: WorldInstance,
    projectName: string,
    projectRoot: string = DEMO_PROJECT_ROOT,
  ): void => {
    setGameEntry({ world, projectName, projectRoot });
  };

  const closeGame = (): void => {
    setGameEntry(null);
    setInitialGameMode(resetGameModeEntry(window.sessionStorage));
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  const closeEditor = (): void => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setEditorEntry(null);
    setScreen('project');
  };

  if (screen === 'editor' && editorEntry) {
    return (
      <main className="shell app-shell app-shell--immersive">
        <EditorScreen entry={editorEntry} onBack={closeEditor} />
        <Crosshair />
      </main>
    );
  }

  if (screen === 'stereo3d') {
    return (
      <main className="shell app-shell app-shell--immersive">
        <Stereo3DDemoScreen onBack={closeStereoDemo} />
      </main>
    );
  }

  if (screen === 'rain') {
    return (
      <main className="shell app-shell app-shell--immersive">
        <RainDemoScreen onBack={closeRainDemo} />
      </main>
    );
  }

  return (
    <main className="shell app-shell app-shell--immersive">
      {gameEntry ? null : (
        <>
          <div
            data-tauri-drag-region
            className="app-drag-region"
            aria-hidden="true"
          />
          <button className="app-stereo-demo-entry" type="button" onClick={openStereoDemo}>
            Stereo3D Demo
          </button>
          <button className="app-stereo-demo-entry app-rain-demo-entry" type="button" onClick={openRainDemo}>
            Rain Demo
          </button>
        </>
      )}
      <div
        className={`app-tear-surface${gameEntry ? ' app-tear-surface--hidden' : ''}`}
        aria-hidden={gameEntry ? true : undefined}
      >
        <ProjectTreeDemoScreen
          onExit={() => undefined}
          onEditWorld={openEditor}
          onEnterWorld={openGame}
          projectRoot={DEMO_PROJECT_ROOT}
          rainEnabled={rainEnabled}
          rainState={rainState}
          onRainEnabledChange={toggleRain}
          onRainRefresh={refreshRain}
        />
      </div>
      {gameEntry ? (
        <GameScreen
          world={gameEntry.world}
          projectName={gameEntry.projectName}
          projectRoot={gameEntry.projectRoot}
          initialMode={initialGameMode}
          onExit={closeGame}
          onEdit={() => openEditor(gameEntry.world, gameEntry.projectName)}
          rainRuntime={rainRuntime}
          rainState={rainState}
        />
      ) : null}
      {gameEntry ? null : <GlobalGlitch />}
      {gameEntry ? null : <Crosshair />}
    </main>
  );
}