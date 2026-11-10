#!/usr/bin/env node
/**
 * R5b.1 · 资产规格检查。
 *
 * 检查视频尺寸/帧率/时长、图片尺寸/体积、音频采样率/声道/时长、
 * 字幕句数与字数、beats sidecar、chart、manifest 引用。
 *
 * 用法：
 *   node verify-assets.mjs
 * 输出：
 *   quality-review/stage-5/r5b/asset-verify.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { probeMedia } from './lib/ffmpeg.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const PROJECT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project');
const OUT = path.join(REPO_ROOT, 'quality-review', 'stage-5', 'r5b', 'asset-verify.json');

const errors = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) errors.push(`${name}: ${detail}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function near(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

const videoSpec = readJson(path.join(PROJECT, 'media', 'theme', 'video-spec.json'));
const imageSpec = readJson(path.join(PROJECT, 'media', 'images', 'images-spec.json'));
const musicSpec = readJson(path.join(PROJECT, 'media', 'audio', 'music-spec.json'));
const subtitleSpec = readJson(path.join(PROJECT, 'media', 'subtitles', 'prologue.json'));
const sfxSpec = readJson(path.join(PROJECT, 'media', 'audio', 'sfx-spec.json'));
const beats = readJson(path.join(PROJECT, 'charts', 'chart-w1.beats.json'));
const chart = readJson(path.join(PROJECT, 'charts', 'chart-w1.editor.json'));
const manifest = readJson(path.join(PROJECT, 'media', 'manifest.json'));

const originalLeft = await probeMedia(path.join(PROJECT, 'media', 'theme', 'rain-night-left.mp4'));
const originalRight = await probeMedia(path.join(PROJECT, 'media', 'theme', 'rain-night-right.mp4'));
const loopLeft = await probeMedia(path.join(PROJECT, 'media', 'theme', 'rain-night-left-loop.mp4'));
const loopRight = await probeMedia(path.join(PROJECT, 'media', 'theme', 'rain-night-right-loop.mp4'));
const audio = await probeMedia(path.join(PROJECT, 'media', 'audio', 'theme.wav'));

for (const [eye, probe] of [['left', originalLeft], ['right', originalRight]]) {
  check(`video.${eye}.size`, probe.video?.width === 1280 && probe.video?.height === 720, `${probe.video?.width}x${probe.video?.height}`);
  check(`video.${eye}.fps`, near(probe.video?.fps ?? 0, 30, 0.01), String(probe.video?.fps));
  check(`video.${eye}.duration`, near(probe.duration, 24, 0.05), String(probe.duration));
  check(`video.${eye}.audio`, probe.audio === null, 'expected no audio track');
  check(`video.${eye}.codec`, probe.video?.codec === 'h264', String(probe.video?.codec));
}
for (const [eye, probe] of [['leftLoop', loopLeft], ['rightLoop', loopRight]]) {
  check(`video.${eye}.duration`, near(probe.duration, 72, 0.05), String(probe.duration));
}

for (const image of imageSpec.images) {
  const file = path.join(PROJECT, 'media', 'images', image.file);
  const probe = await probeMedia(file);
  check(`image.${image.id}.size`, probe.video?.width === 1920 && probe.video?.height === 1080, `${probe.video?.width}x${probe.video?.height}`);
  check(`image.${image.id}.bytes`, fs.statSync(file).size <= 500 * 1024, String(fs.statSync(file).size));
  check(`image.${image.id}.quality`, image.quality === 90, String(image.quality));
  check(`image.${image.id}.hash`, sha256File(file) === image.sha256, 'sha256 mismatch');
}

check('audio.duration', near(audio.duration, 72, 0.02), String(audio.duration));
check('audio.sampleRate', audio.audio?.sampleRate === 48_000, String(audio.audio?.sampleRate));
check('audio.channels', audio.audio?.channels === 2, String(audio.audio?.channels));
check('audio.codec', audio.audio?.codec === 'pcm_s16le', String(audio.audio?.codec));
check('audio.hash', sha256File(path.join(PROJECT, 'media', 'audio', 'theme.wav')) === musicSpec.sha256, 'sha256 mismatch');

check('subtitles.count', subtitleSpec.lines.length >= 3, String(subtitleSpec.lines.length));
for (const line of subtitleSpec.lines) {
  const length = [...line.text].length;
  check(`subtitle.${line.id}.chars`, length >= 5 && length <= 15, String(length));
  check(`subtitle.${line.id}.time`, line.startMs >= 0 && line.endMs <= 72_000 && line.endMs > line.startMs, `${line.startMs}-${line.endMs}`);
}

check('beats.count', beats.beatsMs.length === 108, String(beats.beatsMs.length));
check('beats.downbeats', beats.downbeatsMs.length === 27, String(beats.downbeatsMs.length));
check('beats.bpm', beats.bpm === 90, String(beats.bpm));
check('beats.offset', beats.offsetMs === 0, String(beats.offsetMs));
check('beats.source', beats.source === 'Manual', String(beats.source));
check('beats.hash', beats.audioSha256 === musicSpec.sha256, 'audioSha256 mismatch');

check('chart.duration', chart.durationMs === 72_000, String(chart.durationMs));
check('chart.keyframes', chart.tracks.reduce((sum, track) => sum + track.keyframes.length, 0) === 12, 'expected 12');
for (const [layer, assetId] of Object.entries(chart.layerAudio ?? {})) {
  check(
    `chart.layerAudio.${layer}`,
    assetId === `asset:audio:sfx-layer${layer}`,
    String(assetId),
  );
}
check('chart.bindings', chart.bindings.length === 5, String(chart.bindings.length));

const pair = [...manifest.stereoPairs].reverse()[0];
check('manifest.pair', pair?.stereoPairId === 'eb5ad96b7054921c', String(pair?.stereoPairId));
check(
  'manifest.activePairId',
  manifest.activePairId === pair?.stereoPairId,
  String(manifest.activePairId),
);

const logoMark = path.join(REPO_ROOT, 'assets', 'resources', 'guidance', 'rain-night-mark.png');
const logoProbe = await probeMedia(logoMark);
check('logoMark.exists', fs.existsSync(logoMark), 'missing');
check(
  'logoMark.size',
  logoProbe.video?.width === 512 && logoProbe.video?.height === 512,
  `${logoProbe.video?.width}x${logoProbe.video?.height}`,
);
check('logoMark.bytes', fs.statSync(logoMark).size <= 200 * 1024, String(fs.statSync(logoMark).size));
const audioAsset = manifest.assets.find((asset) => asset.assetId === pair?.audioAssetId);
const leftAsset = manifest.assets.find((asset) => asset.assetId === pair?.leftAssetId);
const rightAsset = manifest.assets.find((asset) => asset.assetId === pair?.rightAssetId);
check('manifest.audioAsset', Boolean(audioAsset), 'missing audio asset');
for (const sfx of sfxSpec.assets) {
  const file = path.join(PROJECT, 'media', 'audio', sfx.file);
  const probe = await probeMedia(file);
  check(`sfx.${sfx.assetId}.file`, fs.existsSync(file), 'missing');
  check(`sfx.${sfx.assetId}.duration`, probe.durationMs === 150, String(probe.durationMs));
  check(
    `sfx.${sfx.assetId}.manifest`,
    manifest.assets.some((asset) => asset.assetId === sfx.assetId),
    'missing manifest asset',
  );
}
check('manifest.audioHash', audioAsset?.sha256 === musicSpec.sha256, 'manifest audio sha256 mismatch');
check('manifest.leftFile', Boolean(leftAsset) && fs.existsSync(path.join(PROJECT, leftAsset.relPath)), 'left file missing');
check('manifest.rightFile', Boolean(rightAsset) && fs.existsSync(path.join(PROJECT, rightAsset.relPath)), 'right file missing');
check('manifest.leftSha', Boolean(leftAsset) && leftAsset.sha256 === sha256File(path.join(PROJECT, leftAsset.relPath)), 'left sha mismatch');
check('manifest.rightSha', Boolean(rightAsset) && rightAsset.sha256 === sha256File(path.join(PROJECT, rightAsset.relPath)), 'right sha mismatch');

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  ok: errors.length === 0,
  errors,
  checks,
  summary: {
    video: { original: '1280x720 / 30fps / 24s', loop: '1280x720 / 30fps / 72s', stereoBaselinePx: 8 },
    images: { count: imageSpec.images.length, size: '1920x1080', quality: 90, maxBytes: 500 * 1024 },
    logoMark: { size: '512x512', alpha: true, maxBytes: 200 * 1024 },
    audio: { durationSeconds: 72, bpm: 90, sampleRate: 48_000, channels: 2, codec: 'pcm_s16le' },
    subtitles: { count: subtitleSpec.lines.length, minChars: 5, maxChars: 15 },
    chart: { keyframes: 12, bindings: 5, durationMs: 72_000, beats: 108, downbeats: 27 },
  },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

console.log(`[verify] ${errors.length === 0 ? 'PASS' : 'FAIL'} · ${checks.length} checks · ${OUT}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`[verify] ${error}`);
  process.exitCode = 1;
}
