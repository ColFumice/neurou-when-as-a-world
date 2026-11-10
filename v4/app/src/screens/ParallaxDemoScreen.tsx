import { useEffect, useMemo, useRef, useState } from 'react';
import { ParallaxRenderer } from '@core/presentation/parallax/ParallaxRenderer';
import {
  FrameTracking,
  VisualFrame,
  VisualFrameTargetLock,
} from '@core/world/frame';
import type { FrameTarget, VisualFrameRect } from '@core/world/frame';
import {
  PlaybackState,
  TimelineStateMachine,
} from '@core/timeline/types';
import { WorldKind } from '@core/world/types';
import type { WorldInstance } from '@core/world/types';
import './parallax-demo.css';

const FRAME_RECT: VisualFrameRect = { x: 100, y: 120, width: 520, height: 260 };
const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 540;

/**
 * 左右键推进参数：
 * - 短按一次性推进 50ms，避免“按了没反应”；
 * - 按住后 180ms 内缓入到 8ms/帧（约 480ms/秒）；
 * - Shift 目标速度 ×3，以 80ms 短 ramp 过渡；
 * - 松开后 250ms 缓出到 0。
 */
const INITIAL_STEP_MS = 50;
const BASE_PER_FRAME_MS = 8;
const RAMP_IN_MS = 180;
const RAMP_OUT_MS = 250;
const RAMP_SHIFT_MS = 80;
const SHIFT_MULTIPLIER = 3;
const FRAME_MS = 1000 / 60;

type SpeedState = 'Idle' | 'RampingIn' | 'Steady' | 'RampingOut';
type ArrowKey = 'ArrowLeft' | 'ArrowRight';
type ShiftKey = 'ShiftLeft' | 'ShiftRight';

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

interface ParallaxDemoScreenProps {
  onBack: () => void;
}

export function ParallaxDemoScreen({ onBack }: ParallaxDemoScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeline] = useState(
    () => new TimelineStateMachine({ minMs: 0, maxMs: 12000 }, { initialMs: 0 }),
  );
  const [targetInside, setTargetInside] = useState(true);
  const [frameSaturation, setFrameSaturation] = useState(0.75);
  const [globalSaturation, setGlobalSaturation] = useState(1);
  const [tracking, setTracking] = useState<FrameTracking>(FrameTracking.Tracking);
  const [lock, setLock] = useState<VisualFrameTargetLock>(VisualFrameTargetLock.Locked);
  const [, refresh] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const target = useMemo<FrameTarget>(() => ({
    kind: 'Anchor',
    targetId: 'demo-anchor',
    screenRect: targetInside
      ? { x: 300, y: 220, width: 80, height: 48 }
      : { x: 820, y: 400, width: 80, height: 48 },
  }), [targetInside]);

  useEffect(() => {
    setTracking((previous) => VisualFrame.computeFrameTracking(FRAME_RECT, target, previous));
    setLock(VisualFrame.computeTargetLock(FRAME_RECT, target, 120, 60));
  }, [target]);

  const world = useMemo<WorldInstance>(() => ({
    worldId: 'demo-world',
    kind: WorldKind.Primary,
    map: {},
    layers: [
      { index: 0, parallaxFactor: 0.1 },
      { index: 1, parallaxFactor: 0.5 },
      { index: 2, parallaxFactor: 1.5 },
    ],
    timeline,
    themeColor: { r: 48, g: 96, b: 140 },
    scale: {
      scaleRef: { pixelsPerWorldMeter: 32 },
      calibrationFactor: 1,
    },
    spawnPoints: [],
    spawnZones: [],
    folder: { folderId: 'demo-folder' },
    prologue: '雨落在未完成的世界上。\n这是视差演示的数据层序言。',
  }), [timeline]);

  const visualFrame: VisualFrame = {
    rect: FRAME_RECT,
    parallaxFactors: [
      { layerIndex: 0, factor: 0.1 },
      { layerIndex: 1, factor: 0.5 },
      { layerIndex: 2, factor: 1.5 },
    ],
    target,
    tracking,
    lock,
    frameSaturation,
    globalSaturation,
  };

  const frameRef = useRef(visualFrame);
  frameRef.current = visualFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ParallaxRenderer();
    let animationFrame = 0;
    let disposed = false;

    const loop = () => {
      if (disposed) return;
      renderer.render({ world, visualFrame: frameRef.current, timeline });
      animationFrame = window.requestAnimationFrame(loop);
    };

    void renderer.mount(canvas).then(() => {
      if (disposed) {
        renderer.destroy();
        return;
      }
      loop();
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      renderer.destroy();
    };
  }, [timeline, world]);

  useEffect(() => {
    const pressed = new Set<ArrowKey>();
    const shiftKeys = new Set<ShiftKey>();
    let raf: number | null = null;
    let lastTime: number | null = null;
    let speedState: SpeedState = 'Idle';
    let currentSpeed = 0;
    let lastDirection: -1 | 1 = 1;
    let rampFrom = 0;
    let rampTo = 0;
    let rampStartedAt = 0;
    let rampDuration = RAMP_IN_MS;

    const targetSpeed = () => (
      BASE_PER_FRAME_MS * (shiftKeys.size > 0 ? SHIFT_MULTIPLIER : 1)
    );

    const stopLoop = () => {
      if (raf !== null) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
      lastTime = null;
    };

    const beginRamp = (
      to: number,
      duration: number,
      now: number,
      state: 'RampingIn' | 'RampingOut',
    ) => {
      rampFrom = currentSpeed;
      rampTo = to;
      rampStartedAt = now;
      rampDuration = Math.max(1, duration);
      speedState = state;
    };

    const updateSpeed = (now: number) => {
      if (speedState !== 'RampingIn' && speedState !== 'RampingOut') return;
      const t = Math.min(1, (now - rampStartedAt) / rampDuration);
      currentSpeed = rampFrom + (rampTo - rampFrom) * easeInOutQuad(t);
      if (t >= 1) {
        currentSpeed = rampTo;
        speedState = rampTo > 0 ? 'Steady' : 'Idle';
      }
    };

    const tick = (now: number) => {
      if (lastTime === null) lastTime = now;
      const deltaMs = Math.min(now - lastTime, 50);
      lastTime = now;

      updateSpeed(now);

      const left = pressed.has('ArrowLeft');
      const right = pressed.has('ArrowRight');
      if (left !== right) {
        const direction = left ? -1 : 1;
        lastDirection = direction;
        if (currentSpeed > 0) {
          timeline.advance(direction * currentSpeed * (deltaMs / FRAME_MS));
          refresh((value) => value + 1);
        }
      } else if (pressed.size === 0 && speedState === 'RampingOut' && currentSpeed > 0) {
        timeline.advance(lastDirection * currentSpeed * (deltaMs / FRAME_MS));
        refresh((value) => value + 1);
      }

      if (speedState === 'Idle' && currentSpeed === 0) {
        stopLoop();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (raf === null) {
        lastTime = null;
        raf = window.requestAnimationFrame(tick);
      }
    };

    const clearKeys = () => {
      pressed.clear();
      shiftKeys.clear();
      currentSpeed = 0;
      speedState = 'Idle';
      stopLoop();
    };

    const shiftCodeOf = (event: KeyboardEvent): ShiftKey | null => (
      event.code === 'ShiftLeft' || event.code === 'ShiftRight'
        ? event.code
        : null
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.repeat) return;

        const key = event.key;
        const wasEmpty = pressed.size === 0;
        pressed.add(key);

        if (pressed.size === 2) {
          // 两个方向同时按住：互相抵消，速度立即归零，不走缓出。
          currentSpeed = 0;
          speedState = 'Idle';
          stopLoop();
          return;
        }

        const now = performance.now();
        lastDirection = key === 'ArrowLeft' ? -1 : 1;

        if (wasEmpty) {
          timeline.advance(lastDirection * INITIAL_STEP_MS);
          refresh((value) => value + 1);
        }

        // 若从缓出中重新按下，从当前速度继续缓入（选项 A）。
        beginRamp(targetSpeed(), RAMP_IN_MS, now, 'RampingIn');
        startLoop();
        return;
      }

      const shiftCode = shiftCodeOf(event);
      if (shiftCode !== null) {
        if (event.repeat) return;
        shiftKeys.add(shiftCode);
        if (pressed.size === 1) {
          const now = performance.now();
          const next = targetSpeed();
          beginRamp(
            next,
            RAMP_SHIFT_MS,
            now,
            next >= currentSpeed ? 'RampingIn' : 'RampingOut',
          );
          startLoop();
        }
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        if (event.repeat) return;
        if (timeline.playbackState === PlaybackState.Playing) {
          timeline.pause();
        } else {
          timeline.play();
        }
        refresh((value) => value + 1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const delta = event.key === 'ArrowUp' ? 0.05 : -0.05;
        if (event.shiftKey) {
          setGlobalSaturation((value) => Math.min(1, Math.max(0, value + delta)));
        } else {
          setFrameSaturation((value) => Math.min(1, Math.max(0, value + delta)));
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const shiftCode = shiftCodeOf(event);
      if (shiftCode !== null) {
        shiftKeys.delete(shiftCode);
        if (pressed.size === 1) {
          const now = performance.now();
          const next = targetSpeed();
          beginRamp(
            next,
            RAMP_SHIFT_MS,
            now,
            next >= currentSpeed ? 'RampingIn' : 'RampingOut',
          );
          startLoop();
        }
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();

      pressed.delete(event.key);
      const now = performance.now();

      if (pressed.size === 0) {
        if (currentSpeed > 0) {
          // startSpeed 取松开瞬间的当前速度，避免“突然加速一下再减速”。
          beginRamp(0, RAMP_OUT_MS, now, 'RampingOut');
          startLoop();
        } else {
          speedState = 'Idle';
          stopLoop();
        }
        return;
      }

      // 从双键抵消中松开一键：从 0 重新缓入。
      const remaining = pressed.has('ArrowLeft') ? 'ArrowLeft' : 'ArrowRight';
      lastDirection = remaining === 'ArrowLeft' ? -1 : 1;
      beginRamp(targetSpeed(), RAMP_IN_MS, now, 'RampingIn');
      startLoop();
    };

    const onBlur = () => clearKeys();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      clearKeys();
    };
  }, [timeline]);

  const progress = timeline.progress;
  const stageStyle = {
    width: '100%',
    maxWidth: `${STAGE_WIDTH}px`,
    aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}`,
  };
  const frameStyle = {
    left: `${(FRAME_RECT.x / STAGE_WIDTH) * 100}%`,
    top: `${(FRAME_RECT.y / STAGE_HEIGHT) * 100}%`,
    width: `${(FRAME_RECT.width / STAGE_WIDTH) * 100}%`,
    height: `${(FRAME_RECT.height / STAGE_HEIGHT) * 100}%`,
  };
  const targetStyle = {
    left: `${(target.screenRect.x / STAGE_WIDTH) * 100}%`,
    top: `${(target.screenRect.y / STAGE_HEIGHT) * 100}%`,
    width: `${(target.screenRect.width / STAGE_WIDTH) * 100}%`,
    height: `${(target.screenRect.height / STAGE_HEIGHT) * 100}%`,
  };

  return (
    <section className="parallax-demo">
      <section className="parallax-demo__stage" style={stageStyle}>
        <canvas
          ref={canvasRef}
          className="parallax-demo__canvas"
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          aria-label="三层视差画布"
        />
        <div className="parallax-demo__frame" style={frameStyle} aria-hidden="true" />
        <div className="parallax-demo__target" style={targetStyle} aria-hidden="true" />
        <div className="parallax-demo__frame-label">VisualFrame</div>
        <div className="parallax-demo__target-label">target</div>
      </section>

      <section className="parallax-demo__hud" aria-live="polite">
        <div><span>position</span><b>{progress.positionMs.toFixed(0)} ms</b></div>
        <div><span>direction</span><b>{progress.direction}</b></div>
        <div><span>playback</span><b>{timeline.playbackState}</b></div>
        <div><span>tracking</span><b>{tracking}</b></div>
        <div><span>lock</span><b>{lock}</b></div>
        <div><span>frameSat</span><b>{frameSaturation.toFixed(2)}</b></div>
        <div><span>globalSat</span><b>{globalSaturation.toFixed(2)}</b></div>
        <div><span>layers</span><b>L1 0.1 · L2 0.5 · L3 1.5</b></div>
      </section>

      <p
        className="parallax-demo__offsets"
        style={{ margin: '0.55rem 0 0', color: '#7f9bb8', font: '400 0.7rem/1.4 "Cascadia Code", "Consolas", monospace' }}
      >
        offsets: L1 {(progress.positionMs * 0.08 * 0.1).toFixed(1)}px ·
        L2 {(progress.positionMs * 0.08 * 0.5).toFixed(1)}px ·
        L3 {(progress.positionMs * 0.08 * 1.5).toFixed(1)}px
      </p>

      <div className="parallax-demo__controls">
        <button
          type="button"
          onClick={() => {
            if (timeline.playbackState === PlaybackState.Playing) timeline.pause();
            else timeline.play();
            refresh((value) => value + 1);
          }}
        >
          {timeline.playbackState === PlaybackState.Playing ? 'pause' : 'play'}
        </button>
        <button type="button" onClick={() => setTargetInside((value) => !value)}>
          target: {targetInside ? 'inside' : 'outside'}
        </button>
        <button type="button" onClick={() => setFrameSaturation((value) => Math.min(1, value + 0.05))}>
          frameSat +
        </button>
        <button type="button" onClick={() => setFrameSaturation((value) => Math.max(0, value - 0.05))}>
          frameSat −
        </button>
      </div>
    </section>
  );
}
