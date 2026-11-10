import { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { TauriMediaImporter } from '../../../adapters/tauri/TauriMediaImporter';
import type { MediaStereoImport } from '../../../adapters/tauri/TauriMediaImporter';
import { TauriProjectIo } from '../../../adapters/tauri/TauriProjectIo';
import './stereo3d-demo.css';

const DEFAULT_PROJECT_ROOT =
  'D:\\Project\\A_New_Begin\\Neurou_official\\v4\\.stereo-demo\\project';
const DEFAULT_LEFT =
  'D:\\Project\\A_New_Begin\\Neurou_official\\v4\\.stereo-demo\\source\\left.mp4';
const DEFAULT_RIGHT =
  'D:\\Project\\A_New_Begin\\Neurou_official\\v4\\.stereo-demo\\source\\right.mp4';

const MAX_CAMERA = 1;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.2;

// 线性加速度/减速度（单位/秒²）；Shift 提高目标速度与加速度。
const CAMERA_SPEED = 0.75;
const CAMERA_BOOST = 1.5;
const CAMERA_ACCEL = 2.8;
const CAMERA_BOOST_ACCEL = 5.0;
const SCALE_SPEED = 0.55;
const SCALE_BOOST = 1.1;
const SCALE_ACCEL = 2.2;
const SCALE_BOOST_ACCEL = 4.0;

interface Stereo3DDemoScreenProps {
  readonly onBack: () => void;
}

interface MotionState {
  camera: number;
  cameraVelocity: number;
  scale: number;
  scaleVelocity: number;
}

interface VideoUrls {
  readonly background: string;
  readonly foreground: string;
  readonly audio: string;
}

function joinProjectPath(root: string, relPath: string): string {
  const base = root.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${relPath.replace(/\//g, separator)}`;
}

/** 以固定斜率逼近目标：速度的加减是线性的，不是瞬间跳变。 */
function approach(current: number, target: number, deltaPerSecond: number): number {
  if (current < target) return Math.min(current + deltaPerSecond, target);
  return Math.max(current - deltaPerSecond, target);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('cannot create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBackground;
uniform sampler2D uForeground;
uniform float uCamera;
uniform float uCharacterScale;
out vec4 outColor;

void main() {
  // 背景慢、前景快：同一相机位移下，前景 UV 走得更远。
  vec2 bgUv = clamp(vUv + vec2(uCamera * 0.035, 0.0), vec2(0.001), vec2(0.999));
  vec2 fgUv = clamp(vUv + vec2(uCamera * 0.120, 0.0), vec2(0.001), vec2(0.999));

  vec3 color = texture(uBackground, bgUv).rgb;

  // Live2D / Spine 角色占位：屏幕中心绿色矩形，位于背景和前景之间。
  vec2 centered = abs(vUv - vec2(0.5));
  float outer = step(centered.x, 0.105 * uCharacterScale)
    * step(centered.y, 0.245 * uCharacterScale);
  float inner = step(centered.x, 0.095 * uCharacterScale)
    * step(centered.y, 0.235 * uCharacterScale);
  color = mix(color, vec3(0.025, 0.22, 0.10), outer);
  color = mix(color, vec3(0.10, 0.78, 0.34), inner);

  // 前景视频是黑底白方块：黑底作为透明，白方块产生物理遮挡。
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
  if (!program) throw new Error('cannot create WebGL program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown program link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('cannot create WebGL texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );
  return texture;
}

/**
 * 伪 3D 视觉验证：
 * - 背景/前景两个视频层，由 GLSL 按相机位移偏移 UV；
 * - 前景 UV 速度约为背景的 3.4 倍，形成视差与遮挡；
 * - 绿色矩形是 Live2D/Spine 角色占位，固定屏幕中心，夹在两层之间。
 */
export function Stereo3DDemoScreen({ onBack }: Stereo3DDemoScreenProps) {
  const [projectRoot, setProjectRoot] = useState(DEFAULT_PROJECT_ROOT);
  const [leftPath, setLeftPath] = useState(DEFAULT_LEFT);
  const [rightPath, setRightPath] = useState(DEFAULT_RIGHT);
  const [imported, setImported] = useState<MediaStereoImport | null>(null);
  const [videoUrls, setVideoUrls] = useState<VideoUrls | null>(null);
  const [motion, setMotion] = useState({ camera: 0, scale: 1 });
  const [status, setStatus] = useState('准备导入背景/前景视频');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const foregroundVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const motionRef = useRef<MotionState>({
    camera: 0,
    cameraVelocity: 0,
    scale: 1,
    scaleVelocity: 0,
  });
  const keysRef = useRef<Set<string>>(new Set());
  const urlsRef = useRef<VideoUrls | null>(null);
  const projectIo = useMemo(() => new TauriProjectIo(), []);
  const importer = useMemo(() => new TauriMediaImporter(), []);

  useEffect(() => {
    urlsRef.current = videoUrls;
  }, [videoUrls]);

  useEffect(() => () => {
    const urls = urlsRef.current;
    if (!urls) return;
    URL.revokeObjectURL(urls.background);
    URL.revokeObjectURL(urls.foreground);
  }, []);

  const loadStereo = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setStatus('打开 project root…');
    try {
      const root = projectRoot.trim();
      await projectIo.openProjectRoot(root);
      setStatus('调用 media_import_stereo…');
      const result = await importer.importStereo(leftPath.trim(), rightPath.trim());
      setStatus('读取视频字节…');
      const [backgroundBytes, foregroundBytes] = await Promise.all([
        importer.readMediaFile(result.left.relPath),
        importer.readMediaFile(result.right.relPath),
      ]);
      const background = URL.createObjectURL(
        new Blob([toArrayBuffer(backgroundBytes)], { type: 'video/mp4' }),
      );
      const foreground = URL.createObjectURL(
        new Blob([toArrayBuffer(foregroundBytes)], { type: 'video/mp4' }),
      );
      const nextUrls: VideoUrls = {
        background,
        foreground,
        audio: convertFileSrc(joinProjectPath(root, result.audio.relPath)),
      };
      setVideoUrls((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.background);
          URL.revokeObjectURL(previous.foreground);
        }
        return nextUrls;
      });
      setImported(result);
      motionRef.current = {
        camera: 0,
        cameraVelocity: 0,
        scale: 1,
        scaleVelocity: 0,
      };
      setMotion({ camera: 0, scale: 1 });
      setPlaying(false);
      setStatus(
        result.deduped
          ? `复用 pair ${result.pair.stereoPairId} · 背景/前景已加载`
          : `导入完成 ${result.pair.stereoPairId} · 背景/前景已加载`,
      );
    } catch (caught) {
      setImported(null);
      setVideoUrls((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.background);
          URL.revokeObjectURL(previous.foreground);
        }
        return null;
      });
      setError(errorText(caught));
      setStatus('导入失败');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!videoUrls) return;
    const background = backgroundVideoRef.current;
    const foreground = foregroundVideoRef.current;
    if (background) background.load();
    if (foreground) foreground.load();
  }, [videoUrls]);

  const playAll = async (): Promise<void> => {
    if (!videoUrls) return;
    setError(null);
    try {
      const background = backgroundVideoRef.current;
      const foreground = foregroundVideoRef.current;
      for (const video of [background, foreground]) {
        if (!video) continue;
        video.muted = true;
        video.currentTime = 0;
      }
      if (audioRef.current) audioRef.current.currentTime = 0;
      await Promise.all([
        ...(background ? [background.play()] : []),
        ...(foreground ? [foreground.play()] : []),
        ...(audioRef.current ? [audioRef.current.play()] : []),
      ]);
      setPlaying(true);
      setPanelHidden(true);
    } catch (caught) {
      setError(`播放失败：${errorText(caught)}`);
      setPlaying(false);
    }
  };

  const pauseAll = (): void => {
    backgroundVideoRef.current?.pause();
    foregroundVideoRef.current?.pause();
    audioRef.current?.pause();
    setPlaying(false);
  };

  const togglePlayback = (): void => {
    if (playing) pauseAll();
    else void playAll();
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
          || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        event.preventDefault();
        onBack();
        return;
      }
      if (event.code === 'Space') {
        if (target instanceof HTMLElement && target.tagName === 'BUTTON') return;
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (movementKeys.has(key)) {
        if (key.startsWith('arrow')) event.preventDefault();
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

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;

    const step = (now: number): void => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const keys = keysRef.current;
      const boost = keys.has('shift');

      // A/D + ←/→：相机线性加速，松开后线性减速。
      const cameraDirection =
        (keys.has('a') || keys.has('arrowleft') ? -1 : 0)
        + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
      const cameraTarget = cameraDirection * (boost ? CAMERA_BOOST : CAMERA_SPEED);
      let cameraVelocity = approach(
        motionRef.current.cameraVelocity,
        cameraTarget,
        (boost ? CAMERA_BOOST_ACCEL : CAMERA_ACCEL) * dt,
      );
      let camera = motionRef.current.camera + cameraVelocity * dt;
      if (camera <= -MAX_CAMERA) {
        camera = -MAX_CAMERA;
        cameraVelocity = 0;
      } else if (camera >= MAX_CAMERA) {
        camera = MAX_CAMERA;
        cameraVelocity = 0;
      }

      // S/↓ 放大角色；W/↑ 缩小角色；速度同样线性加减。
      const scaleDirection =
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
        + (keys.has('w') || keys.has('arrowup') ? -1 : 0);
      const scaleTarget = scaleDirection * (boost ? SCALE_BOOST : SCALE_SPEED);
      let scaleVelocity = approach(
        motionRef.current.scaleVelocity,
        scaleTarget,
        (boost ? SCALE_BOOST_ACCEL : SCALE_ACCEL) * dt,
      );
      let scale = motionRef.current.scale + scaleVelocity * dt;
      if (scale <= MIN_SCALE) {
        scale = MIN_SCALE;
        scaleVelocity = 0;
      } else if (scale >= MAX_SCALE) {
        scale = MAX_SCALE;
        scaleVelocity = 0;
      }

      motionRef.current = {
        camera,
        cameraVelocity,
        scale,
        scaleVelocity,
      };

      if (now - lastHud > 80) {
        lastHud = now;
        setMotion({ camera, scale });
      }
      frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) {
      setError('WebGL2 不可用，无法运行 GLSL 视差');
      return;
    }

    let program: WebGLProgram;
    let backgroundTexture: WebGLTexture;
    let foregroundTexture: WebGLTexture;
    let buffer: WebGLBuffer;
    try {
      program = createProgram(gl);
      backgroundTexture = createTexture(gl);
      foregroundTexture = createTexture(gl);
      const createdBuffer = gl.createBuffer();
      if (!createdBuffer) throw new Error('cannot create WebGL buffer');
      buffer = createdBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
          1, -1,
          -1, 1,
          1, 1,
        ]),
        gl.STATIC_DRAW,
      );
    } catch (caught) {
      setError(`GLSL 初始化失败：${errorText(caught)}`);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const backgroundLocation = gl.getUniformLocation(program, 'uBackground');
    const foregroundLocation = gl.getUniformLocation(program, 'uForeground');
    const cameraLocation = gl.getUniformLocation(program, 'uCamera');
    const characterScaleLocation = gl.getUniformLocation(program, 'uCharacterScale');
    if (positionLocation < 0
      || !backgroundLocation
      || !foregroundLocation
      || !cameraLocation
      || !characterScaleLocation) {
      setError('GLSL uniform 初始化失败');
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(backgroundLocation, 0);
    gl.uniform1i(foregroundLocation, 1);
    gl.clearColor(0.027, 0.075, 0.11, 1);

    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const nextWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const nextHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const uploadVideo = (
      texture: WebGLTexture,
      video: HTMLVideoElement | null,
    ): void => {
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        video,
      );
    };

    const draw = (): void => {
      resize();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      uploadVideo(backgroundTexture, backgroundVideoRef.current);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, foregroundTexture);
      uploadVideo(foregroundTexture, foregroundVideoRef.current);
      gl.uniform1f(cameraLocation, motionRef.current.camera);
      gl.uniform1f(characterScaleLocation, motionRef.current.scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frame = window.requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      gl.deleteTexture(backgroundTexture);
      gl.deleteTexture(foregroundTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  const resetCamera = (): void => {
    motionRef.current = {
      camera: 0,
      cameraVelocity: 0,
      scale: 1,
      scaleVelocity: 0,
    };
    setMotion({ camera: 0, scale: 1 });
  };

  return (
    <section className="stereo3d-demo">
      <div className="stereo3d-demo__stage">
        <canvas ref={canvasRef} className="stereo3d-demo__canvas" />
        {!videoUrls ? (
          <div className="stereo3d-demo__placeholder">
            <span>GLSL PARALLAX</span>
            <strong>导入背景 / 前景两层视频开始</strong>
          </div>
        ) : null}
        <div className="stereo3d-demo__character-hint">
          绿色矩形 = Live2D / Spine 占位 · W/S 缩放
        </div>
        <div className="stereo3d-demo__shader-hint">
          GLSL · BG ×0.035 · FG ×0.120 · 角色居中
        </div>
        {videoUrls ? (
          <>
            <video
              ref={backgroundVideoRef}
              className="stereo3d-demo__video-source"
              src={videoUrls.background}
              loop
              muted
              playsInline
              preload="auto"
              onError={() => setError('背景视频加载失败')}
            />
            <video
              ref={foregroundVideoRef}
              className="stereo3d-demo__video-source"
              src={videoUrls.foreground}
              loop
              muted
              playsInline
              preload="auto"
              onError={() => setError('前景视频加载失败')}
            />
            <audio
              ref={audioRef}
              src={videoUrls.audio}
              loop
              preload="auto"
              onError={() => setError('双声道 WAV 加载失败')}
            />
          </>
        ) : null}
        <div className="stereo3d-demo__vignette" aria-hidden="true" />
      </div>

      <button className="stereo3d-demo__back" type="button" onClick={onBack}>
        ← 返回
      </button>

      {panelHidden ? (
        <button
          className="stereo3d-demo__panel-toggle"
          type="button"
          onClick={() => setPanelHidden(false)}
        >
          Show panel
        </button>
      ) : (
        <section className="stereo3d-demo__panel">
          <div className="stereo3d-demo__eyebrow">shader / layered video</div>
          <h1>GLSL 伪 3D 视差验证</h1>
          <button
            className="stereo3d-demo__panel-hide"
            type="button"
            onClick={() => setPanelHidden(true)}
          >
            Hide panel
          </button>

          {!imported ? (
            <>
              <label>
                project root
                <input value={projectRoot} onChange={(event) => setProjectRoot(event.target.value)} />
              </label>
              <label>
                background (left.mp4)
                <input value={leftPath} onChange={(event) => setLeftPath(event.target.value)} />
              </label>
              <label>
                foreground (right.mp4)
                <input value={rightPath} onChange={(event) => setRightPath(event.target.value)} />
              </label>
              <button type="button" disabled={busy} onClick={() => void loadStereo()}>
                {busy ? '准备中…' : 'Import layers'}
              </button>
              <small>先跑 prepare-stereo-demo.ps1；再点击 Import layers。</small>
            </>
          ) : (
            <>
              <div className="stereo3d-demo__pair">
                <span>pair</span>
                <b>{imported.pair.stereoPairId}</b>
              </div>
              <div className="stereo3d-demo__pair">
                <span>layers</span>
                <b>background · foreground · audio.wav</b>
              </div>
              <div className="stereo3d-demo__pair">
                <span>cameraX</span>
                <b>{motion.camera.toFixed(2)}</b>
              </div>
              <div className="stereo3d-demo__pair">
                <span>zoom</span>
                <b>{motion.scale.toFixed(2)}</b>
              </div>
              <div className="stereo3d-demo__pair">
                <span>depth</span>
                <b>BG ×0.035 · FG ×0.120 · green center</b>
              </div>
              <div className="stereo3d-demo__actions">
                <button type="button" onClick={togglePlayback}>
                  {playing ? 'Pause' : 'Play (Space)'}
                </button>
                <button type="button" onClick={resetCamera}>Reset motion</button>
              </div>
              <small>
                A/D 或 ←/→ 平移相机；S/↓ 放大角色，W/↑ 缩小角色；Shift 加速。
                速度线性加减，松开后惯性衰减。耳机：左 440Hz，右 660Hz。
              </small>
            </>
          )}
          <div className="stereo3d-demo__status">{status}</div>
          {error ? <div className="stereo3d-demo__error">{error}</div> : null}
        </section>
      )}

      <div className="stereo3d-demo__offset" aria-live="polite">
        <span>CAM</span>
        <b>{motion.camera.toFixed(2)}</b>
        <span>ZOOM</span>
        <b>{motion.scale.toFixed(2)}</b>
      </div>
    </section>
  );
}
