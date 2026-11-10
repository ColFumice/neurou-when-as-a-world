#!/usr/bin/env node
/**
 * R5b.1 · 把生成好的资产接入 demo project。
 *
 * 做四件事：
 *   1. 在 media/manifest.json 末尾追加一对新的 72s 双目素材 + 音乐；
 *   2. 重写 charts/chart-w1.editor.json 的时长 / 关键帧 / 绑定 / NEU 模块；
 *   3. 写入 charts/chart-w1.beats.json（Manual 90 BPM 网格）；
 *   4. 写入 worlds/w1/world.json 与 media/theme/theme.json，供 R5b.2 使用。
 *
 * 不改任何游戏逻辑；只改 demo 项目数据。
 *
 * 用法：
 *   node apply-demo.mjs
 *   node apply-demo.mjs --dry-run
 *   node apply-demo.mjs --project <path to project>
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { probeMedia } from './lib/ffmpeg.mjs';
import { STYLE } from './lib/style.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_PROJECT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project');
const QUALITY_DIR = path.join(REPO_ROOT, 'quality-review', 'stage-5', 'r5b');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const PROJECT = args.project ? path.resolve(args.project) : DEFAULT_PROJECT;
const DRY = args['dry-run'] === true;
const THEME_DIR = path.join(PROJECT, 'media', 'theme');
const IMAGE_DIR = path.join(PROJECT, 'media', 'images');
const AUDIO_DIR = path.join(PROJECT, 'media', 'audio');
const SUBTITLE_DIR = path.join(PROJECT, 'media', 'subtitles');
const CHART_DIR = path.join(PROJECT, 'charts');
const WORLD_DIR = path.join(PROJECT, 'worlds', 'w1');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!DRY) fs.writeFileSync(file, text);
  return text;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function stableId(label) {
  return crypto.createHash('sha256').update(`neurou:r5b1:${label}`).digest('hex').slice(0, 16);
}

function fileSize(file) {
  return fs.statSync(file).size;
}

function assertFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`缺少${label}: ${file}`);
}

function round(value) {
  return Math.round(value);
}

const BPM = 90;
const BEAT_MS = 60_000 / BPM;
const BAR_MS = BEAT_MS * 4;
const DURATION_MS = 72_000;
const DURATION_S = DURATION_MS / 1000;

function beatTime(beat) {
  return round(beat * BEAT_MS);
}

// ---------------------------------------------------------------------------
// 1. 读取生成结果
// ---------------------------------------------------------------------------

assertFile(path.join(THEME_DIR, 'video-spec.json'), '视频规格');
assertFile(path.join(THEME_DIR, 'rain-night-left-loop.mp4'), '左眼循环视频');
assertFile(path.join(THEME_DIR, 'rain-night-right-loop.mp4'), '右眼循环视频');
assertFile(path.join(AUDIO_DIR, 'theme.wav'), '主题音乐');
assertFile(path.join(IMAGE_DIR, 'theme-rain-night.webp'), '主题图片');
assertFile(path.join(SUBTITLE_DIR, 'prologue.json'), '字幕');

const videoSpec = readJson(path.join(THEME_DIR, 'video-spec.json'));
const imageSpec = readJson(path.join(IMAGE_DIR, 'images-spec.json'));
const musicSpec = readJson(path.join(AUDIO_DIR, 'music-spec.json'));
const subtitleSpec = readJson(path.join(SUBTITLE_DIR, 'prologue.json'));

const leftRel = 'media/theme/rain-night-left-loop.mp4';
const rightRel = 'media/theme/rain-night-right-loop.mp4';
const audioRel = 'media/audio/theme.wav';
const leftFile = path.join(PROJECT, leftRel);
const rightFile = path.join(PROJECT, rightRel);
const audioFile = path.join(PROJECT, audioRel);

const [leftProbe, rightProbe, audioProbe] = await Promise.all([
  probeMedia(leftFile),
  probeMedia(rightFile),
  probeMedia(audioFile),
]);

if (!leftProbe.video || leftProbe.video.width !== 1280 || leftProbe.video.height !== 720) {
  throw new Error(`左眼视频规格不符: ${JSON.stringify(leftProbe.video)}`);
}
if (Math.abs(leftProbe.duration - DURATION_S) > 0.05) {
  throw new Error(`左眼视频时长不符: ${leftProbe.duration}`);
}
if (!audioProbe.audio || audioProbe.audio.channels !== 2 || audioProbe.audio.sampleRate !== 48_000) {
  throw new Error(`音频规格不符: ${JSON.stringify(audioProbe.audio)}`);
}
if (Math.abs(audioProbe.duration - DURATION_S) > 0.02) {
  throw new Error(`音频时长不符: ${audioProbe.duration}`);
}

const audioSha = sha256File(audioFile);
if (musicSpec.sha256 !== audioSha) {
  throw new Error('music-spec.json 的 sha256 与 theme.wav 不一致；请重新生成');
}

const pairId = stableId('pair:rain-night');
const leftAssetId = stableId(leftRel);
const rightAssetId = stableId(rightRel);
const audioAssetId = stableId(audioRel);
const now = Date.now();

function videoAsset(assetId, rel, probe, eye, displayName) {
  return {
    assetId,
    kind: 'Video',
    displayName,
    relPath: rel,
    bytes: fileSize(path.join(PROJECT, rel)),
    sha256: sha256File(path.join(PROJECT, rel)),
    sourceSha256: null,
    durationMs: round(probe.duration * 1000),
    width: probe.video.width,
    height: probe.video.height,
    fps: probe.video.fps,
    videoCodec: probe.video.codec,
    audioCodec: null,
    audioChannels: 0,
    audioChannel: null,
    sampleRate: 0,
    eye,
    stereoPairId: pairId,
    derivedFrom: null,
    trim: null,
    createdAt: now,
  };
}

const newAssets = [
  videoAsset(leftAssetId, leftRel, leftProbe, 'Left', 'rain-night-left-loop.mp4'),
  videoAsset(rightAssetId, rightRel, rightProbe, 'Right', 'rain-night-right-loop.mp4'),
  {
    assetId: audioAssetId,
    kind: 'Audio',
    displayName: 'theme.wav',
    relPath: audioRel,
    bytes: fileSize(audioFile),
    sha256: audioSha,
    sourceSha256: null,
    durationMs: round(audioProbe.duration * 1000),
    width: 0,
    height: 0,
    fps: 0,
    videoCodec: null,
    audioCodec: audioProbe.audio.codec,
    audioChannels: audioProbe.audio.channels,
    audioChannel: 'Stereo',
    sampleRate: audioProbe.audio.sampleRate,
    eye: null,
    stereoPairId: pairId,
    derivedFrom: null,
    trim: null,
    createdAt: now,
  },
];

// ---------------------------------------------------------------------------
// 2. manifest
// ---------------------------------------------------------------------------

const manifestPath = path.join(PROJECT, 'media', 'manifest.json');
const manifest = readJson(manifestPath);
const removeIds = new Set(newAssets.map((asset) => asset.assetId));
manifest.assets = (manifest.assets ?? []).filter((asset) => !removeIds.has(asset.assetId));
manifest.stereoPairs = (manifest.stereoPairs ?? []).filter((pair) => pair.stereoPairId !== pairId);
manifest.assets.push(...newAssets);
manifest.stereoPairs.push({
  stereoPairId: pairId,
  leftAssetId,
  rightAssetId,
  audioAssetId,
  createdAt: now,
});
manifest.activePairId = pairId;
manifest.updatedAt = now;
manifest.schemaVersion = manifest.schemaVersion ?? 1;
writeJson(manifestPath, manifest);

// ---------------------------------------------------------------------------
// 3. chart-w1.editor.json
// ---------------------------------------------------------------------------

const keyframes = [];
let keyframeCounter = 0;
function nextKeyframeId() {
  keyframeCounter += 1;
  return `editor-w1-kf-${keyframeCounter}`;
}

function makeLogo(keyframeId, x, y, size, appearEffect = 'FadeDown', disappearEffect = 'FadeUp') {
  return {
    logoId: `${keyframeId}-logo`,
    assetId: 'builtin:head-logo',
    x,
    y,
    size,
    stretch: 1,
    appearEffect,
    disappearEffect,
    easing: 'EaseInOut',
  };
}

function addNote({
  timeMs,
  durationMs = 0,
  layer,
  gridCellId = null,
  padKind,
  parallaxFactor = 1,
  effectIds = [],
  logo = null,
}) {
  const keyframeId = nextKeyframeId();
  keyframes.push({
    chartKeyId: null,
    chartLayerIndex: layer,
    chartPadKind: padKind,
    durationMs,
    effectInterfaceIds: effectIds,
    gridCellId,
    keyframeId,
    logo,
    parallaxFactor,
    timeMs,
  });
  return keyframeId;
}

const ids = new Map();
function add(key, options) {
  const keyframeId = addNote(options);
  ids.set(key, keyframeId);
  return keyframeId;
}

// 12 个关键帧足够演示 72s 的四段结构，也不会让 NoteLogoLayer 同时堆出多枚 Logo。
// Layer 1 · TopMost：段落落点与长音。
add('open', {
  timeMs: 0,
  durationMs: 1600,
  layer: 1,
  padKind: 'TopMost',
  parallaxFactor: 0.4,
  logo: makeLogo('open', 0.28, 0.56, 0.12),
});
add('verse', {
  timeMs: beatTime(32),
  durationMs: 1000,
  layer: 1,
  padKind: 'TopMost',
  parallaxFactor: 1.1,
  logo: makeLogo('verse', 0.7, 0.42, 0.11, 'Truncate', 'FadeUp'),
});
add('lift', {
  timeMs: beatTime(64),
  durationMs: 1200,
  layer: 1,
  padKind: 'TopMost',
  parallaxFactor: 1.6,
  effectIds: ['fx-1', 'fx-2', 'fx-3', 'fx-4', 'fx-5'],
  logo: makeLogo('lift', 0.5, 0.5, 0.14, 'FlashWhite', 'FadeUp'),
});
add('close', {
  timeMs: beatTime(96),
  durationMs: 1600,
  layer: 1,
  padKind: 'TopMost',
  parallaxFactor: 0.7,
  logo: makeLogo('close', 0.72, 0.56, 0.11, 'Glitch', 'FadeUp'),
});

// Layer 2 · Grid：主歌与副歌的点击，留出呼吸。
add('grid-a', { timeMs: beatTime(12), durationMs: 0, layer: 2, gridCellId: 2, padKind: 'Light', parallaxFactor: 0.5 });
add('grid-b', { timeMs: beatTime(24), durationMs: 700, layer: 2, gridCellId: 5, padKind: 'Heavy', parallaxFactor: -0.8 });
add('grid-c', { timeMs: beatTime(48), durationMs: 0, layer: 2, gridCellId: 3, padKind: 'Light', parallaxFactor: 1.0 });
add('grid-d', { timeMs: beatTime(72), durationMs: 0, layer: 2, gridCellId: 6, padKind: 'Light', parallaxFactor: -1.2 });
add('grid-e', { timeMs: beatTime(88), durationMs: 600, layer: 2, gridCellId: 8, padKind: 'Heavy', parallaxFactor: 0.9 });

// Layer 3 · FullScreen：只负责段落转场，不参与 Logo 堆叠。
add('turn-a', { timeMs: beatTime(16), durationMs: 0, layer: 3, padKind: 'Light', parallaxFactor: -1.4 });
add('turn-b', { timeMs: beatTime(56), durationMs: 0, layer: 3, padKind: 'Light', parallaxFactor: 1.3 });
add('turn-c', { timeMs: beatTime(92), durationMs: 0, layer: 3, padKind: 'Light', parallaxFactor: -0.8 });

const tracks = [1, 2, 3].map((layer) => ({
  trackId: `layer-${layer}`,
  layerIndex: layer,
  keyframes: keyframes.filter((keyframe) => keyframe.chartLayerIndex === layer),
}));

const effects = [
  { effectKind: 'EaseIn', interfaceId: 'fx-1', params: { durationMs: 600, intensity: 1 } },
  { effectKind: 'EaseOut', interfaceId: 'fx-2', params: { durationMs: 600, intensity: 1 } },
  { effectKind: 'EaseIn', interfaceId: 'fx-3', params: { durationMs: 600, intensity: 1 } },
  { effectKind: 'EaseIn', interfaceId: 'fx-4', params: { durationMs: 600, intensity: 1 } },
  { effectKind: 'Glitch', interfaceId: 'fx-5', params: { durationMs: 420, glitchOffset: 4, intensity: 0.6 } },
];

const bindings = [
  { assetId: 'asset:audio:main', keyframeId: ids.get('open'), triggerAtMs: 0 },
  { assetId: 'asset:video:foreground', keyframeId: ids.get('open'), triggerAtMs: 0 },
  { assetId: 'asset:video:foreground', keyframeId: ids.get('turn-a'), triggerAtMs: 10667 },
  { assetId: 'asset:video:foreground', keyframeId: ids.get('lift'), triggerAtMs: 42667 },
  { assetId: 'asset:video:foreground', keyframeId: ids.get('turn-c'), triggerAtMs: 61333 },
];

const neuModules = [
  {
    inputs: [],
    moduleId: 'neu-4',
    outputs: [{ port: 1, targets: [{ moduleId: 'neu-5', port: 1 }] }],
    params: { keyframeId: ids.get('open'), timeMs: 0 },
    type: 'RhythmPoint',
    x: 0.2,
    y: 0.24,
  },
  {
    inputs: [
      { port: 1, sourceModuleId: 'neu-4', sourcePort: 1 },
      { port: 1, sourceModuleId: 'channel-left-4', sourcePort: 1 },
    ],
    moduleId: 'neu-5',
    outputs: [{ port: 1, targets: [{ moduleId: 'neu-6', port: 1 }] }],
    params: { assetId: 'asset:audio:main', durationMs: DURATION_MS, volume: 0.8 },
    type: 'Audio',
    x: 0.3947471033868093,
    y: 0.3412802419354839,
  },
  {
    inputs: [{ port: 1, sourceModuleId: 'neu-5', sourcePort: 1 }],
    moduleId: 'neu-6',
    outputs: [{ port: 1, targets: [{ moduleId: 'channel-right-4', port: 1 }] }],
    params: { delayMs: 1000, extendPrevious: false },
    type: 'Delay',
    x: 0.6346228832442068,
    y: 0.47258064516129034,
  },
  {
    inputs: [{ port: 1, sourceModuleId: 'neu-6', sourcePort: 1 }],
    moduleId: 'channel-right-4',
    outputs: [],
    params: { port: 4, side: 'right' },
    type: 'Channel',
    x: 0.99,
    y: 0.54,
  },
  {
    inputs: [],
    moduleId: 'channel-left-4',
    outputs: [{ port: 1, targets: [{ moduleId: 'neu-5', port: 1 }] }],
    params: { port: 4, side: 'left' },
    type: 'Channel',
    x: 0.01,
    y: 0.54,
  },
];

const chart = {
  bindings,
  canvas: { stageHeight: 720, stageWidth: 1280 },
  chartId: 'chart-w1',
  documentId: 'editor-w1',
  durationMs: DURATION_MS,
  effects,
  layerAudio: {
    1: 'asset:audio:sfx-layer1',
    2: 'asset:audio:sfx-layer2',
    3: 'asset:audio:sfx-layer3',
  },
  neuModules,
  provenance: 'Mock',
  schemaVersion: 2,
  seed: 20261025,
  tracks,
};

const chartPath = path.join(CHART_DIR, 'chart-w1.editor.json');
const chartText = writeJson(chartPath, chart);
writeJson(path.join(CHART_DIR, 'chart-w1.editor.json.bak'), chart);
writeJson(path.join(CHART_DIR, 'chart-w1.holds.json'), {
  schemaVersion: 1,
  chartId: 'chart-w1',
  crossings: [],
});

// ---------------------------------------------------------------------------
// 4. beats sidecar（Manual，90 BPM）
// ---------------------------------------------------------------------------

const beatsMs = [];
for (let beat = 0; beat * BEAT_MS < DURATION_MS; beat += 1) {
  beatsMs.push(Math.round(beat * BEAT_MS));
}
const downbeatsMs = beatsMs.filter((_, index) => index % 4 === 0);

const beatsPath = path.join(CHART_DIR, 'chart-w1.beats.json');
writeJson(beatsPath, {
  schemaVersion: 1,
  chartId: 'chart-w1',
  audioAssetId,
  audioSha256: audioSha,
  analyzer: 'offline-onset-autocorrelation-v1',
  bpm: BPM,
  meter: 4,
  offsetMs: 0,
  beatsMs,
  downbeatsMs,
  confidence: 1,
  source: 'Manual',
  generatedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// 5. world / theme catalog
// ---------------------------------------------------------------------------

const world = {
  schemaVersion: 1,
  worldId: 'w1',
  kind: 'Primary',
  title: '雨若 · 雨夜',
  themeColor: { r: 96, g: 118, b: 132 },
  prologue: {
    title: '雨若',
    lines: subtitleSpec.lines.map((line) => line.text),
    assetId: 'subtitles:prologue',
    relPath: 'media/subtitles/prologue.json',
    startMs: 0,
    endMs: DURATION_MS,
  },
  media: {
    stereoPairId: pairId,
    activePairId: pairId,
    chartId: 'chart-w1',
    themeDir: 'media/theme',
    imageDir: 'media/images',
    audioRelPath: audioRel,
  },
  updatedAt: new Date().toISOString(),
};
writeJson(path.join(WORLD_DIR, 'world.json'), world);

const themeCatalog = {
  schemaVersion: 1,
  themeId: 'theme:rain-night',
  title: '雨若 / 雨夜',
  worldId: 'w1',
  chartId: 'chart-w1',
  activePairId: pairId,
  video: {
    left: leftRel,
    right: rightRel,
    leftSource: 'media/theme/rain-night-left.mp4',
    rightSource: 'media/theme/rain-night-right.mp4',
    durationMs: DURATION_MS,
    resolution: '1280x720',
    fps: 30,
    stereoBaselinePx: 8,
    spec: 'media/theme/video-spec.json',
    posters: videoSpec.posters,
  },
  images: {
    theme: 'media/images/theme-rain-night.webp',
    world: 'media/images/world-rain-night.webp',
    logoVariants: 'media/images/logo-variants.json',
    contactSheet: 'media/images/contact-sheet.webp',
    spec: 'media/images/images-spec.json',
  },
  audio: {
    file: audioRel,
    bpm: BPM,
    meter: 4,
    durationMs: DURATION_MS,
    sampleRate: 48_000,
    channels: 2,
    bitDepth: 16,
    spec: 'media/audio/music-spec.json',
    beatsGrid: 'media/audio/beats-grid.json',
  },
  subtitles: {
    file: 'media/subtitles/prologue.json',
    srt: 'media/subtitles/prologue.srt',
    lines: subtitleSpec.lines.length,
  },
  style: STYLE,
  styleFile: 'media/theme/style.json',
  updatedAt: new Date().toISOString(),
};
writeJson(path.join(THEME_DIR, 'theme.json'), themeCatalog);
writeJson(path.join(THEME_DIR, 'style.json'), {
  schemaVersion: 1,
  generatedBy: 'v4/app/tools/assets/lib/style.mjs',
  name: STYLE.name,
  palette: STYLE.palette,
  grade: STYLE.grade,
  vignette: STYLE.vignette,
  grain: STYLE.grain,
  rain: STYLE.rain,
  bloom: STYLE.bloom,
});

// ---------------------------------------------------------------------------
// 6. 规格报告
// ---------------------------------------------------------------------------

const imageRows = imageSpec.images.map((image) => (
  `| ${image.id} | ${image.width}×${image.height} | ${(image.bytes / 1024).toFixed(1)} KB | q${image.quality} | \`${image.sha256.slice(0, 16)}…\` |`
)).join('\n');

const videoRow = (eye, rel, probe, assetId) => (
  `| ${eye} | \`${rel}\` | ${probe.video.width}×${probe.video.height} | ${probe.duration.toFixed(2)}s | ${probe.video.fps} fps | ${(probe.bytes / 1024 / 1024).toFixed(2)} MB | \`${assetId}\` |`
);

const report = `# R5b.1 · 示例资产规格报告

生成时间：${new Date().toISOString()}
生成器：\`v4/app/tools/assets/\`（全部由 DSH 从零生成，无外部素材）

## 1. 视频

| 眼睛 | 路径 | 分辨率 | 时长 | 帧率 | 体积 | assetId |
|---|---|---|---|---|---|---|
${videoRow('Left', leftRel, leftProbe, leftAssetId)}
${videoRow('Right', rightRel, rightProbe, rightAssetId)}

- 编码：H.264 / yuv420p / 无音轨 / faststart
- 双目基线：8px（同一程序化底板按机位偏移采样）
- 24s 原始版：\`media/theme/rain-night-left.mp4\` / \`rain-night-right.mp4\`
- 72s 循环版：\`${leftRel}\` / \`${rightRel}\`
- 抽帧与联系表：\`media/theme/posters/\`
- 规格文件：\`media/theme/video-spec.json\`

## 2. 图片

| 名称 | 尺寸 | 体积 | 质量 | sha256 |
|---|---|---|---|---|
${imageRows}

- 全部为 1920×1080 WebP，q90，单图 ≤ 500KB（实际均 < 150KB）
- 场景底图与视频共用同一套程序化渲染器和调色
- Logo 版式与动效建议：\`media/images/logo-variants.json\`
- 规格文件：\`media/images/images-spec.json\`

## 3. 音乐

| 项 | 值 |
|---|---|
| 路径 | \`${audioRel}\` |
| 时长 | ${musicSpec.durationSeconds}s |
| BPM | ${musicSpec.bpm}（4/4） |
| 采样率 / 位深 / 声道 | ${musicSpec.sampleRate} Hz / ${musicSpec.bitDepth}-bit / ${musicSpec.channels} |
| 编码 | PCM s16le |
| 体积 | ${(musicSpec.bytes / 1024 / 1024).toFixed(2)} MB |
| 峰值 | ${musicSpec.peakDbfs} dBFS |
| 段落 RMS | intro ${musicSpec.rmsDb.intro} / verse ${musicSpec.rmsDb.verse} / chorus ${musicSpec.rmsDb.chorus} / outro ${musicSpec.rmsDb.outro} dB |
| sha256 | \`${musicSpec.sha256}\` |

结构：4 小节前奏（0–10.667s）→ 12 小节主歌（10.667–42.667s）→ 7 小节副歌（42.667–61.333s）→ 4 小节尾奏（61.333–72s）。  
所有音色由振荡器、噪声、滤波器与包络合成；混响为立体声 Schroeder 网络，延迟为附点八分乒乓。

- 规格文件：\`media/audio/music-spec.json\`
- 节拍网格：\`media/audio/beats-grid.json\`
- 图表节拍 sidecar：\`charts/chart-w1.beats.json\`（Manual 90 BPM，offset 0）

## 4. 字幕

- 路径：\`media/subtitles/prologue.json\` / \`prologue.srt\`
- 5 句，5–15 字，时间轴与音乐段落对齐
- 样式：Noto Serif SC / 42px / 字距 0.08em / 左下 / 600ms 淡入、800ms 淡出

## 5. 统一调色

- 主色：\`${STYLE.palette.ink}\` / \`${STYLE.palette.abyss}\` / \`${STYLE.palette.deep}\`
- 点缀：\`${STYLE.palette.teal}\` / \`${STYLE.palette.cyan}\` / \`${STYLE.palette.amber}\`
- 曝光 ${STYLE.grade.exposure} / 对比 ${STYLE.grade.contrast} / 饱和 ${STYLE.grade.saturation} / gamma ${STYLE.grade.gamma}
- 暗角 ${STYLE.vignette.strength} / 颗粒 ${STYLE.grain.strength}
- 调色参数由 \`lib/style.mjs\` 统一导出，视频、图片、字幕预览共用

## 6. 复现命令

\`\`\`powershell
cd v4/app
node tools/assets/generate-video.mjs --preset medium --crf 19
node tools/assets/generate-images.mjs
node tools/assets/generate-music.mjs
node tools/assets/generate-subtitles.mjs
node tools/assets/apply-demo.mjs
\`\`\`

或一键（不含 E2E）：\`node tools/assets/generate-all.mjs\`

## 7. 备注

- 所有资产写入 \`.gitignore\`，不进仓库。
- 24s 视频与 72s 音乐均为程序化生成；没有使用任何采样库、外部图片或字体文件。
- \`Analyze Beats\` 是 R5a 冻结的离线分析器，对持续 pad/低音会产生帧 RMS 混叠；本次 demo 的节拍 sidecar 采用 Manual 90 BPM 网格，HUD 与谱面以该网格为准（详见 \`R5b.1-changes.md\`）。
`;

if (!DRY) {
  fs.mkdirSync(QUALITY_DIR, { recursive: true });
  fs.writeFileSync(path.join(QUALITY_DIR, 'asset-spec.md'), report, 'utf8');
  fs.writeFileSync(path.join(QUALITY_DIR, 'asset-spec.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    video: {
      left: { relPath: leftRel, assetId: leftAssetId, ...leftProbe },
      right: { relPath: rightRel, assetId: rightAssetId, ...rightProbe },
      posters: videoSpec.posters,
      stereoBaselinePx: 8,
    },
    images: imageSpec.images,
    audio: musicSpec,
    subtitles: subtitleSpec,
    style: STYLE,
    chart: {
      chartId: chart.chartId,
      durationMs: chart.durationMs,
      keyframes: keyframes.length,
      bindings: bindings.length,
      bpm: BPM,
      beats: beatsMs.length,
      downbeats: downbeatsMs.length,
    },
  }, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// 7. 摘要
// ---------------------------------------------------------------------------

console.log(`[apply] project ${PROJECT}`);
console.log(`[apply] manifest ${newAssets.length} assets / pair ${pairId}`);
console.log(`[apply] chart ${keyframes.length} keyframes / ${bindings.length} bindings / ${DURATION_MS}ms`);
console.log(`[apply] beats ${beatsMs.length} @ ${BPM} BPM / ${downbeatsMs.length} downbeats`);
console.log(`[apply] world ${path.join(WORLD_DIR, 'world.json')}`);
console.log(`[apply] report ${path.join(QUALITY_DIR, 'asset-spec.md')}`);
if (DRY) console.log('[apply] dry-run: no files written');
