/**
 * ffmpeg / ffprobe / Edge headless 的小封装。
 * 只使用机器上已有的可执行文件，不引入 npm 依赖。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';

export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? (options.input !== undefined
        ? ['pipe', 'pipe', 'pipe']
        : ['ignore', 'pipe', 'pipe']),
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    if (child.stdout) child.stdout.on('data', (chunk) => { stdout += chunk; });
    if (child.stderr) child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr.slice(-4000)}`));
    });
    if (options.input !== undefined && child.stdin) {
      child.stdin.end(options.input);
    }
  });
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function fileSize(file) {
  return fs.statSync(file).size;
}

export function sha256File(file) {
  // 避免把 crypto 依赖扩散到样式层，仅在需要的脚本里直接 import。
  return fs.promises.readFile(file).then(async (buffer) => {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(buffer).digest('hex');
  });
}

/** ffprobe 结构化信息；失败时抛出，调用方决定是否降级。 */
export async function probeMedia(file) {
  const result = await run(FFPROBE, [
    '-v', 'error',
    '-show_entries',
    'format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels,channel_layout,duration',
    '-of', 'json',
    file,
  ]);
  const parsed = JSON.parse(result.stdout || '{}');
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video') ?? null;
  const audio = streams.find((stream) => stream.codec_type === 'audio') ?? null;
  const duration = Number(parsed.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
  return {
    file,
    bytes: Number(parsed.format?.size ?? fileSize(file)),
    duration,
    durationMs: Math.round(duration * 1000),
    bitRate: Number(parsed.format?.bit_rate ?? 0),
    video: video ? {
      codec: video.codec_name,
      width: Number(video.width),
      height: Number(video.height),
      fps: parseRate(video.avg_frame_rate || video.r_frame_rate),
      duration,
    } : null,
    audio: audio ? {
      codec: audio.codec_name,
      sampleRate: Number(audio.sample_rate),
      channels: Number(audio.channels),
      channelLayout: audio.channel_layout ?? '',
      duration,
    } : null,
  };
}

function parseRate(value) {
  if (typeof value !== 'string') return 0;
  const [numerator, denominator] = value.split('/').map(Number);
  if (!denominator) return Number(value) || 0;
  return numerator / denominator;
}

/** 把 RGBA 原始帧编码为单张 PNG。 */
export async function rgbaToPng(rgba, width, height, outFile) {
  ensureDir(path.dirname(outFile));
  await run(FFMPEG, [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', '1', '-i', '-',
    '-frames:v', '1', '-y', outFile,
  ], { input: Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength) });
  return outFile;
}

/** 启动一个 rawvideo 编码进程；调用方按帧写 stdin。 */
export function startH264Encoder({
  output,
  width,
  height,
  fps,
  crf = 18,
  preset = 'slow',
  tune = 'film',
}) {
  ensureDir(path.dirname(output));
  const args = [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', '-',
    '-an',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-tune', tune,
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0',
    '-g', String(Math.round(fps * 2)), '-keyint_min', String(Math.round(fps)),
    '-sc_threshold', '0', '-movflags', '+faststart',
    '-y', output,
  ];
  const child = spawn(FFMPEG, args, {
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`ffmpeg encode exited ${code}\n${stderr.slice(-4000)}`));
    });
  });
  return {
    child,
    done,
    async write(buffer) {
      if (!child.stdin.write(buffer)) await once(child.stdin, 'drain');
    },
    async close() {
      child.stdin.end();
      return done;
    },
  };
}

/** PNG -> WebP，质量从 quality 开始，超过 maxBytes 时逐级下降。 */
export async function pngToWebp(pngFile, webpFile, { quality = 90, maxBytes = 500 * 1024 } = {}) {
  ensureDir(path.dirname(webpFile));
  let current = quality;
  let size = Infinity;
  while (current >= 62) {
    await run(FFMPEG, [
      '-nostdin', '-hide_banner', '-loglevel', 'error',
      '-i', pngFile,
      '-c:v', 'libwebp', '-quality', String(current), '-compression_level', '6',
      '-y', webpFile,
    ]);
    size = fileSize(webpFile);
    if (size <= maxBytes) break;
    current -= 4;
  }
  return { file: webpFile, quality: current, bytes: size, overBudget: size > maxBytes };
}

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

export function findBrowser() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) {
    return process.env.BROWSER_PATH;
  }
  return EDGE_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/**
 * 用 Edge/Chrome headless 把本地 HTML 渲染成 PNG。
 * 这是「手写 SVG -> WebP」链路里唯一需要的外部能力；不新增依赖。
 */
export async function renderHtmlToPng({ htmlFile, pngFile, width, height, profileDir }) {
  const browser = findBrowser();
  if (!browser) throw new Error('未找到 Edge/Chrome，可设置 BROWSER_PATH');
  ensureDir(path.dirname(pngFile));
  ensureDir(profileDir);
  const url = `file:///${path.resolve(htmlFile).replace(/\\/g, '/')}`;
  // 旧版 headless 对 --window-size 更稳定；Edge 109+ 两者都支持。
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--user-data-dir=${path.resolve(profileDir)}`,
    '--virtual-time-budget=3500',
    `--screenshot=${path.resolve(pngFile)}`,
    url,
  ];
  const result = spawnSync(browser, args, {
    windowsHide: true,
    timeout: 90_000,
    encoding: 'utf8',
  });
  if (result.status !== 0 && !fs.existsSync(pngFile)) {
    throw new Error(`headless 渲染失败 (${result.status})\n${result.stderr ?? ''}`);
  }
  if (!fs.existsSync(pngFile)) throw new Error('headless 未生成截图');
  return pngFile;
}

/** 抽帧：从视频中取一张 PNG。 */
export async function extractFrame(videoFile, pngFile, atSeconds) {
  ensureDir(path.dirname(pngFile));
  await run(FFMPEG, [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-ss', String(atSeconds), '-i', videoFile,
    '-frames:v', '1', '-y', pngFile,
  ]);
  return pngFile;
}

/** 生成循环版本：把短视频按 -stream_loop 拼到目标时长。 */
export async function makeLoop(input, output, seconds) {
  ensureDir(path.dirname(output));
  await run(FFMPEG, [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-stream_loop', '-1', '-i', input,
    '-t', String(seconds),
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-g', '60', '-keyint_min', '30', '-sc_threshold', '0',
    '-movflags', '+faststart', '-y', output,
  ]);
  return output;
}

export async function measureLoudness(file) {
  const result = await run(FFMPEG, [
    '-nostdin', '-hide_banner', '-i', file,
    '-af', 'ebur128=peak=true', '-f', 'null', '-',
  ]).catch((error) => ({ stderr: error.message }));
  const text = result.stderr ?? '';
  const integrated = /Integrated loudness:\s*\n\s*I:\s*([-\d.]+)\s*LUFS/.exec(text);
  const range = /Loudness range:\s*\n\s*LRA:\s*([-\d.]+)\s*LU/.exec(text);
  const peak = /True peak:\s*\n\s*Peak:\s*([-\d.]+)\s*dBFS/.exec(text);
  return {
    integratedLufs: integrated ? Number(integrated[1]) : null,
    loudnessRange: range ? Number(range[1]) : null,
    truePeakDbfs: peak ? Number(peak[1]) : null,
  };
}
