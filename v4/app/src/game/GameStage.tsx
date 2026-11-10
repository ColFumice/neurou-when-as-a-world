import { useEffect, useRef, useState } from 'react';
import type { GameMedia } from './chartLoader';

interface GameStageProps {
  readonly media: GameMedia | null;
  readonly playheadMs: number;
  readonly playing: boolean;
  /** R5b.2：无视频时的世界背景图；加载失败仍显示文字 fallback。 */
  readonly fallbackImageUrl?: string | null;
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
out vec4 outColor;

void main() {
  vec2 bgUv = clamp(vUv + vec2(uCamera * 0.035, 0.0), vec2(0.001), vec2(0.999));
  vec2 fgUv = clamp(vUv + vec2(uCamera * 0.120, 0.0), vec2(0.001), vec2(0.999));
  vec3 color = texture(uBackground, bgUv).rgb;
  vec4 foreground = texture(uForeground, fgUv);
  float mask = smoothstep(0.08, 0.32, max(foreground.r, max(foreground.g, foreground.b)));
  color = mix(color, foreground.rgb, mask);
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
    new Uint8Array([6, 12, 18, 255]),
  );
  return texture;
}

/** 双视频 GLSL 视差底图；视频 muted，只作纹理，母钟由 audioClock 提供。 */
export function GameStage({
  media,
  playheadMs,
  playing,
  fallbackImageUrl = null,
}: GameStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLVideoElement>(null);
  const foregroundRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef(0);
  const [shaderError, setShaderError] = useState<string | null>(null);
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false);

  useEffect(() => {
    setFallbackImageFailed(false);
  }, [fallbackImageUrl]);

  useEffect(() => {
    cameraRef.current = Math.sin((playheadMs / 1000) * 0.42) * 0.18;
  }, [playheadMs]);

  useEffect(() => {
    if (!media) return;
    const videos = [backgroundRef.current, foregroundRef.current];
    if (!playing) {
      for (const video of videos) video?.pause();
      return;
    }
    const seconds = playheadMs / 1000;
    for (const video of videos) {
      if (!video) continue;
      if (Math.abs(video.currentTime - seconds) > 0.04) {
        try {
          video.currentTime = seconds;
        } catch {
          // metadata not ready
        }
      }
      if (video.paused) void video.play().catch(() => undefined);
    }
  }, [media, playing, playheadMs]);

  useEffect(() => () => {
    backgroundRef.current?.pause();
    foregroundRef.current?.pause();
  }, []);

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
      program = createProgram(gl);
      backgroundTexture = createTexture(gl);
      foregroundTexture = createTexture(gl);
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
    const backgroundLocation = gl.getUniformLocation(program, 'uBackground');
    const foregroundLocation = gl.getUniformLocation(program, 'uForeground');
    const cameraLocation = gl.getUniformLocation(program, 'uCamera');
    if (position < 0 || !backgroundLocation || !foregroundLocation || !cameraLocation) {
      setShaderError('shader uniforms unavailable');
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(backgroundLocation, 0);
    gl.uniform1i(foregroundLocation, 1);
    gl.clearColor(0.02, 0.04, 0.06, 1);

    let frame = 0;
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

  return (
    <div className="game-stage" aria-hidden="true">
      <canvas ref={canvasRef} className="game-stage__canvas" />
      <div className="game-stage__fallback" data-visible={media ? 'false' : 'true'}>
        {fallbackImageUrl && !fallbackImageFailed ? (
          <img
            className="game-stage__fallback-image"
            src={fallbackImageUrl}
            alt=""
            draggable={false}
            data-fallback-image="true"
            onError={() => setFallbackImageFailed(true)}
          />
        ) : null}
        <span>WORLD / NO MEDIA</span>
        <strong>以无视频模式继续</strong>
      </div>
      {media ? (
        <>
          <video
            ref={backgroundRef}
            className="game-stage__video-source"
            src={media.background}
            muted
            playsInline
            preload="auto"
          />
          <video
            ref={foregroundRef}
            className="game-stage__video-source"
            src={media.foreground}
            muted
            playsInline
            preload="auto"
          />
        </>
      ) : null}
      <div className="game-stage__scan" />
      <div className="game-stage__vignette" />
      {shaderError ? <div className="game-stage__error">{shaderError}</div> : null}
    </div>
  );
}
