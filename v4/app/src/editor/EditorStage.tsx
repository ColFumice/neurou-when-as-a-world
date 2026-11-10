import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartKeyframeAnimation } from '@core/editor/keyframe';
import type { ChartKeyframe } from '@core/editor/keyframe';
import {
  composeStageEffects,
  composeStageLights,
} from '@core/editor/runtime/EffectCompositor';
import type {
  ActiveLight,
  ActiveStageEffect,
} from '@core/editor/runtime/EffectCompositor';
import type { StageMediaOverlay } from './types';
import type { MediaLayers } from './types';

interface EditorStageProps {
  readonly media: MediaLayers | null;
  readonly playheadMs: number;
  readonly durationMs: number;
  readonly playing: boolean;
  readonly keyframes: readonly ChartKeyframe[];
  readonly selectedKeyframe: ChartKeyframe | null;
  readonly manualCameraX: number;
  readonly manualCameraY: number;
  readonly logoUrl: string;
  readonly activeEffects: readonly ActiveStageEffect[];
  readonly activeLights: readonly ActiveLight[];
  readonly mediaOverlays: readonly StageMediaOverlay[];
  readonly signalText: string | null;
  readonly pickingLogo: boolean;
  readonly onPickLogo: (x: number, y: number) => void;
  readonly onClearSelection: () => void;
  readonly onSelectNearest: () => void;
  readonly onLogoMove: (keyframeId: string, x: number, y: number) => void;
  readonly onLogoSelect: (keyframeId: string) => void;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('cannot create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'shader compile failed';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function programFor(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBackground;
uniform sampler2D uForeground;
uniform float uCamera;
uniform float uCameraY;
out vec4 outColor;

void main() {
  vec2 bgUv = clamp(
    vUv + vec2(uCamera * 0.035, uCameraY * 0.020),
    vec2(0.001),
    vec2(0.999)
  );
  vec2 fgUv = clamp(
    vUv + vec2(uCamera * 0.120, uCameraY * 0.060),
    vec2(0.001),
    vec2(0.999)
  );
  vec3 color = texture(uBackground, bgUv).rgb;
  vec4 foreground = texture(uForeground, fgUv);
  float foregroundMask = smoothstep(
    0.08,
    0.32,
    max(foreground.r, max(foreground.g, foreground.b))
  );
  color = mix(color, foreground.rgb, foregroundMask);
  outColor = vec4(color, 1.0);
}
`);
  const program = gl.createProgram();
  if (!program) throw new Error('cannot create program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'program link failed';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function textureFor(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('cannot create texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );
  return texture;
}

/**
 * 编辑器 3D 预览：R3.5a 双视频 → GLSL 双层视差。
 * 相机位移由当前关键帧 parallaxFactor + playhead 派生；Logo 是 DOM 覆盖层。
 */
function StageMediaOverlayView({
  overlay,
  playheadMs,
  localLights,
  playing,
}: {
  readonly overlay: StageMediaOverlay;
  readonly playheadMs: number;
  readonly localLights: readonly ActiveLight[];
  readonly playing: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const elapsed = playheadMs - overlay.startMs;
  const fade = Math.min(1, Math.max(0, (overlay.durationMs + 260 - elapsed) / 260));
  const matchingLights = localLights.filter((light) => (
    light.targetAssetId === overlay.assetId
    && light.localMs >= 0
    && light.localMs <= light.durationMs
  ));
  const localState = composeStageLights(matchingLights);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || overlay.kind === 'image') return;
    if (overlay.kind === 'videoStatic' || !playing) {
      video.pause();
      if (overlay.kind === 'videoStatic') video.currentTime = 0;
      return;
    }
    void video.play().catch(() => undefined);
  }, [overlay.kind, overlay.src, playing]);

  if (elapsed < 0 || elapsed > overlay.durationMs + 260) return null;

  const style = {
    opacity: overlay.opacity * fade,
    filter: localState.filter || undefined,
    maskImage: matchingLights.length > 0
      ? 'radial-gradient(ellipse at center, #000 52%, transparent 78%)'
      : undefined,
    WebkitMaskImage: matchingLights.length > 0
      ? 'radial-gradient(ellipse at center, #000 52%, transparent 78%)'
      : undefined,
  };

  return (
    <div className={`editor-stage__media-overlay editor-stage__media-overlay--${overlay.kind}`} style={style} data-asset-id={overlay.assetId}>
      {overlay.kind === 'image' ? (
        <img src={overlay.src} alt="" />
      ) : (
        <video ref={videoRef} src={overlay.src} muted playsInline preload="auto" />
      )}
    </div>
  );
}

export function EditorStage({
  media,
  playheadMs,
  durationMs,
  playing,
  keyframes,
  selectedKeyframe,
  manualCameraX,
  manualCameraY,
  logoUrl,
  activeEffects,
  activeLights,
  mediaOverlays,
  signalText,
  pickingLogo,
  onPickLogo,
  onClearSelection,
  onSelectNearest,
  onLogoMove,
  onLogoSelect,
}: EditorStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLVideoElement>(null);
  const foregroundRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(0);
  const playheadRef = useRef(playheadMs);
  const [shaderError, setShaderError] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const factor = selectedKeyframe?.parallaxFactor ?? 1;
  // 保留一个非零基准位移：即使 playhead 停在 0，调 Inspector 也能立即看到视差变化。
  const camera = Math.max(
    -2,
    Math.min(2, factor * (0.1 + Math.sin((playheadMs / 1000) * 1.35) * 0.18) + manualCameraX),
  );
  const cameraY = Math.max(-1, Math.min(1, manualCameraY));
  const sample = useMemo(
    () => ChartKeyframeAnimation.sample(keyframes, playheadMs),
    [keyframes, playheadMs],
  );

  const activeLogo = !playing && selectedKeyframe
    ? selectedKeyframe.logo
    : sample;
  const activeKeyframeId = !playing && selectedKeyframe?.logo
    ? selectedKeyframe.keyframeId
    : null;

  const effectState = useMemo(() => composeStageEffects(activeEffects), [activeEffects]);
  const fullLights = useMemo(
    () => activeLights.filter((light) => light.mode !== 'Local'),
    [activeLights],
  );
  const localLights = useMemo(
    () => activeLights.filter((light) => light.mode === 'Local'),
    [activeLights],
  );
  const lightState = useMemo(() => composeStageLights(fullLights), [fullLights]);
  const combinedFilter = [effectState.filter, lightState.filter].filter(Boolean).join(' ');
  const logoStyle = activeLogo
    ? {
      left: `${(drag?.x ?? activeLogo.x) * 100}%`,
      top: `${(drag?.y ?? activeLogo.y) * 100}%`,
      height: `${activeLogo.size * 100}%`,
      transform: `translate(-50%, -50%) scaleX(${activeLogo.stretch}) ${effectState.transform}`,
      filter: combinedFilter || undefined,
      opacity: effectState.opacity,
    }
    : undefined;

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  const cameraYRef = useRef(0);
  useEffect(() => {
    cameraYRef.current = cameraY;
  }, [cameraY]);
  useEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);
  useEffect(() => {
    if (!media) return;
    const videos = [backgroundRef.current, foregroundRef.current];
    if (!playing) {
      for (const video of videos) video?.pause();
      return;
    }
    const seconds = playheadRef.current / 1000;
    for (const video of videos) {
      if (!video) continue;
      if (Math.abs(video.currentTime - seconds) > 0.35) video.currentTime = seconds;
      void video.play();
    }
    return () => {
      for (const video of videos) video?.pause();
    };
  }, [playing, media]);

  useEffect(() => {
    playheadRef.current = playheadMs;
    if (!media || playing) return;
    const seconds = playheadMs / 1000;
    for (const video of [backgroundRef.current, foregroundRef.current]) {
      if (video && Math.abs(video.currentTime - seconds) > 0.08) video.currentTime = seconds;
    }
  }, [playheadMs, media, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) {
      setShaderError('WebGL2 unavailable');
      return;
    }

    let program: WebGLProgram;
    let backgroundTexture: WebGLTexture;
    let foregroundTexture: WebGLTexture;
    let buffer: WebGLBuffer;
    try {
      program = programFor(gl);
      backgroundTexture = textureFor(gl);
      foregroundTexture = textureFor(gl);
      const created = gl.createBuffer();
      if (!created) throw new Error('cannot create buffer');
      buffer = created;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
    } catch (error) {
      setShaderError(error instanceof Error ? error.message : String(error));
      return;
    }

    const position = gl.getAttribLocation(program, 'aPosition');
    const bgLocation = gl.getUniformLocation(program, 'uBackground');
    const fgLocation = gl.getUniformLocation(program, 'uForeground');
    const cameraLocation = gl.getUniformLocation(program, 'uCamera');
    const cameraYLocation = gl.getUniformLocation(program, 'uCameraY');
    if (position < 0 || !bgLocation || !fgLocation || !cameraLocation || !cameraYLocation) {
      setShaderError('shader uniforms unavailable');
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(bgLocation, 0);
    gl.uniform1i(fgLocation, 1);
    gl.clearColor(0, 0, 0, 1);

    let raf = 0;
    let width = 0;
    let height = 0;
    const resize = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const nextWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const nextHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const upload = (texture: WebGLTexture, video: HTMLVideoElement | null): void => {
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    };

    const draw = (): void => {
      resize();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      upload(backgroundTexture, backgroundRef.current);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, foregroundTexture);
      upload(foregroundTexture, foregroundRef.current);
      gl.uniform1f(cameraLocation, cameraRef.current);
      gl.uniform1f(cameraYLocation, cameraYRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = window.requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.cancelAnimationFrame(raf);
      gl.deleteTexture(backgroundTexture);
      gl.deleteTexture(foregroundTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  const normalize = (event: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <section className="editor-stage" aria-label="3D preview stage">
      <div
        ref={stageRef}
        className={`editor-stage__surface${pickingLogo ? ' editor-stage__surface--picking' : ''}`}
        onClick={(event) => {
          if (pickingLogo) {
            const point = normalize(event);
            if (point) onPickLogo(point.x, point.y);
            return;
          }
          if (event.target === event.currentTarget || event.target instanceof HTMLCanvasElement) {
            onClearSelection();
          }
        }}
        onDoubleClick={() => onSelectNearest()}
      >
        <canvas
          ref={canvasRef}
          className="editor-stage__canvas"
          style={{
            transform: effectState.transform || undefined,
            filter: combinedFilter || undefined,
            opacity: effectState.opacity,
            clipPath: effectState.clipPath || undefined,
          }}
        />
        {!media ? (
          <div className="editor-stage__empty">
            <span>STAGE / NO MEDIA</span>
            <strong>打开 Media 导入双目视频</strong>
          </div>
        ) : null}
        {activeLogo && logoStyle ? (
          <div
            className={`editor-stage__logo editor-stage__logo--${String(activeLogo.appearEffect).toLowerCase()}`}
            style={logoStyle}
            role="presentation"
            onClick={(event) => {
              event.stopPropagation();
              if (!pickingLogo && activeKeyframeId) onLogoSelect(activeKeyframeId);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              if (pickingLogo) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrag({ x: activeLogo.x, y: activeLogo.y });
            }}
            onPointerMove={(event) => {
              if (!drag) return;
              const point = normalize(event);
              if (point) setDrag(point);
            }}
            onPointerUp={(event) => {
              if (!drag) return;
              event.stopPropagation();
              const point = normalize(event) ?? drag;
              setDrag(null);
              if (activeKeyframeId) onLogoMove(activeKeyframeId, point.x, point.y);
            }}
          >
            <img
              className="editor-stage__logo-image"
              src={logoUrl}
              alt=""
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
            />
            <span className="editor-stage__logo-caption">LOGO</span>
          </div>
        ) : null}
        {signalText ? <div className="editor-stage__signal">{signalText}</div> : null}
        <div className="editor-stage__fx-layer" aria-hidden="true">
          {lightState.overlays.map((overlay, index) => (
            <span
              key={`${overlay.id}-${index}`}
              className={`editor-stage__fx editor-stage__fx--${overlay.kind}`}
              style={{ opacity: overlay.opacity }}
            />
          ))}
        </div>
        <div className="editor-stage__topline">
          <span>STAGE / GLSL PARALLAX · WASD MOVE</span>
          <span>CAM {camera.toFixed(2)} / {cameraY.toFixed(2)} · FG ×0.120 · BG ×0.035</span>
        </div>
        {mediaOverlays.map((overlay) => (
          <StageMediaOverlayView
            key={overlay.overlayId}
            overlay={overlay}
            playheadMs={playheadMs}
            localLights={localLights}
            playing={playing}
          />
        ))}
        {pickingLogo ? (
          <div className="editor-stage__picking">LOGO PICK · 点击画面放置</div>
        ) : null}
        {shaderError ? <div className="editor-stage__error">{shaderError}</div> : null}
        {media ? (
          <>
            <video
              ref={backgroundRef}
              className="editor-stage__video"
              src={media.background}
              muted
              playsInline
              preload="auto"
            />
            <video
              ref={foregroundRef}
              className="editor-stage__video"
              src={media.foreground}
              muted
              playsInline
              preload="auto"
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
