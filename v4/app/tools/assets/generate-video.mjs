#!/usr/bin/env node
/**
 * R5b.1 · 生成「雨夜城市」双目视频。
 *
 * 默认输出（v4/.stereo-demo/project/media/theme/）：
 *   rain-night-left.mp4        24s / 1280x720 / 30fps / H.264 / 无音轨
 *   rain-night-right.mp4       同左，右眼机位 +8px
 *   rain-night-left-loop.mp4   72s 循环版（给 72s 音乐图表用）
 *   rain-night-right-loop.mp4
 *   posters/*.png              抽帧与联系表
 *   video-spec.json            规格 / 调色 / 参数
 *
 * 用法：
 *   node generate-video.mjs
 *   node generate-video.mjs --duration 24 --fps 30 --width 1280 --height 720
 *   node generate-video.mjs --still --time 3.2
 *   node generate-video.mjs --preset medium --crf 20
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import {
  ensureDir,
  fileSize,
  makeLoop,
  probeMedia,
  rgbaToPng,
  sha256File,
  startH264Encoder,
  run,
} from './lib/ffmpeg.mjs';
import { renderPlate, renderSceneFrame, finalizeFrame, renderStill } from './lib/scene.mjs';
import { Surface } from './lib/surface.mjs';
import { STYLE } from './lib/style.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project', 'media', 'theme');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function numberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaults(args) {
  return {
    out: args.out ? path.resolve(args.out) : DEFAULT_OUT,
    width: Math.round(numberArg(args.width, 1280)),
    height: Math.round(numberArg(args.height, 720)),
    fps: Math.round(numberArg(args.fps, 30)),
    duration: numberArg(args.duration, 24),
    loopSeconds: numberArg(args.loop, 72),
    seed: Math.round(numberArg(args.seed, 20261025)),
    crf: Math.round(numberArg(args.crf, 18)),
    preset: typeof args.preset === 'string' ? args.preset : 'slow',
    time: numberArg(args.time, 2.6),
    stillName: typeof args['still-name'] === 'string' ? args['still-name'] : 'rain-night-still.png',
    noLoop: args['no-loop'] === true,
  };
}

function log(message) {
  console.log(`[video] ${message}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = defaults(args);
  ensureDir(config.out);

  if (args.still) {
    const started = Date.now();
    log(`渲染静帧 ${config.width}x${config.height} @ ${config.time}s ...`);
    const still = renderStill({
      width: config.width,
      height: config.height,
      time: config.time,
      seed: config.seed,
      variant: typeof args.variant === 'string' ? args.variant : 'default',
    });
    const png = path.join(config.out, 'posters', config.stillName);
    await rgbaToPng(still.rgba, config.width, config.height, png);
    log(`完成 ${png}（${fileSize(png)} bytes, ${((Date.now() - started) / 1000).toFixed(1)}s）`);
    return;
  }

  log(`生成 ${config.width}x${config.height} / ${config.fps}fps / ${config.duration}s / seed ${config.seed}`);
  log(`输出 ${config.out}`);
  const started = Date.now();

  const jobs = ['Left', 'Right'].map((eye) => runEyeWorker({ ...config, eye }));
  const results = [];
  for (const job of jobs) {
    // 顺序 await 会串行打印；worker 本身并行运行。
    results.push(await job);
  }

  const leftOriginal = results.find((item) => item.eye === 'Left').file;
  const rightOriginal = results.find((item) => item.eye === 'Right').file;
  const leftProbe = await probeMedia(leftOriginal);
  const rightProbe = await probeMedia(rightOriginal);

  let leftLoop = null;
  let rightLoop = null;
  if (!config.noLoop) {
    leftLoop = path.join(config.out, 'rain-night-left-loop.mp4');
    rightLoop = path.join(config.out, 'rain-night-right-loop.mp4');
    log(`生成 ${config.loopSeconds}s 循环版 ...`);
    await Promise.all([
      makeLoop(leftOriginal, leftLoop, config.loopSeconds),
      makeLoop(rightOriginal, rightLoop, config.loopSeconds),
    ]);
  }

  const posterDir = path.join(config.out, 'posters');
  ensureDir(posterDir);
  const posterTimes = [2.2, 11.1, 20.4];
  const posters = [];
  for (let index = 0; index < posterTimes.length; index += 1) {
    const poster = path.join(posterDir, `still-${String(index + 1).padStart(2, '0')}.png`);
    await run('ffmpeg', [
      '-nostdin', '-hide_banner', '-loglevel', 'error',
      '-ss', String(posterTimes[index]), '-i', leftOriginal,
      '-frames:v', '1', '-y', poster,
    ]);
    posters.push(poster);
  }
  const contact = path.join(posterDir, 'contact-sheet.png');
  await run('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-i', posters[0], '-i', posters[1], '-i', posters[2],
    '-filter_complex', '[0:v][1:v][2:v]hstack=inputs=3[out]',
    '-map', '[out]', '-frames:v', '1', '-y', contact,
  ]);

  const loopProbe = leftLoop ? await probeMedia(leftLoop) : null;
  const spec = {
    schemaVersion: 1,
    generatedBy: 'v4/app/tools/assets/generate-video.mjs',
    generatedAt: new Date().toISOString(),
    seed: config.seed,
    source: 'procedural / pure JS renderer (no external footage)',
    resolution: `${config.width}x${config.height}`,
    fps: config.fps,
    codec: 'H.264 / yuv420p / no audio',
    durationSeconds: config.duration,
    loopSeconds: config.noLoop ? null : config.loopSeconds,
    eyes: {
      left: { file: path.basename(leftOriginal), ...leftProbe },
      right: { file: path.basename(rightOriginal), ...rightProbe },
      leftLoop: leftLoop ? { file: path.basename(leftLoop), ...loopProbe } : null,
    },
    stereo: {
      baselinePx: 8,
      method: '同一底板按机位水平偏移采样；右眼 +8px',
    },
    grade: STYLE.grade,
    palette: STYLE.palette,
    rain: STYLE.rain,
    posters: posters.map((file) => path.relative(config.out, file).replace(/\\/g, '/')),
    contactSheet: path.relative(config.out, contact).replace(/\\/g, '/'),
    hashes: {
      left: await sha256File(leftOriginal),
      right: await sha256File(rightOriginal),
      ...(leftLoop ? { leftLoop: await sha256File(leftLoop) } : {}),
    },
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  };
  fs.writeFileSync(path.join(config.out, 'video-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  log(`完成：${leftOriginal}（${fileSize(leftOriginal)} bytes）`);
  log(`完成：${rightOriginal}（${fileSize(rightOriginal)} bytes）`);
  if (leftLoop) log(`循环版：${leftLoop}（${fileSize(leftLoop)} bytes）`);
  log(`规格：${path.join(config.out, 'video-spec.json')}`);
}

function runEyeWorker(config) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: config,
    });
    worker.on('message', (message) => {
      if (message?.type === 'progress') {
        log(`${message.eye} ${message.frame}/${message.total} frames`);
      } else if (message?.type === 'done') {
        resolve(message.result);
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`worker ${config.eye} exited ${code}`));
    });
  });
}

async function workerMain() {
  const config = workerData;
  const started = Date.now();
  const plateScale = 1.25;
  const plateWidth = Math.round(config.width * plateScale);
  const plateHeight = Math.round(config.height * plateScale);
  const scene = renderPlate({
    width: plateWidth,
    height: plateHeight,
    seed: config.seed,
  });
  const output = path.join(config.out, `rain-night-${config.eye.toLowerCase()}.mp4`);
  const encoder = startH264Encoder({
    output,
    width: config.width,
    height: config.height,
    fps: config.fps,
    crf: config.crf,
    preset: config.preset,
  });
  const total = Math.round(config.duration * config.fps);
  // 复用同一块浮点帧缓冲，避免 720 次分配 11MB。
  const frameBuffer = new Surface(config.width, config.height);
  for (let frame = 0; frame < total; frame += 1) {
    const t = frame / config.fps;
    const rendered = renderSceneFrame(scene, t, config.eye, {
      width: config.width,
      height: config.height,
      frameIndex: frame,
      loopSeconds: config.duration,
      frame: frameBuffer,
    });
    const rgba = finalizeFrame(rendered.frame, config.width, config.height, frame, config.seed);
    await encoder.write(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength));
    if (frame % 30 === 0 || frame === total - 1) {
      parentPort.postMessage({ type: 'progress', eye: config.eye, frame: frame + 1, total });
    }
  }
  await encoder.close();
  const probe = await probeMedia(output);
  const result = {
    eye: config.eye,
    file: output,
    bytes: fileSize(output),
    duration: probe.duration,
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  };
  parentPort.postMessage({ type: 'done', result });
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  workerMain().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
