#!/usr/bin/env node
/**
 * R5b.1 · 生成《雨若》序言字幕。
 *
 * 输出：
 *   v4/.stereo-demo/project/media/subtitles/prologue.json
 *   v4/.stereo-demo/project/media/subtitles/prologue.srt
 *
 * 时间轴与 90 BPM / 72s 的主题音乐段落对齐：
 *   intro 0–10.667s / verse 10.667–42.667s / chorus 42.667–61.333s / outro 61.333–72s
 *
 * 用法：
 *   node generate-subtitles.mjs
 *   node generate-subtitles.mjs --out <dir>
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project', 'media', 'subtitles');

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
const OUT = args.out ? path.resolve(args.out) : DEFAULT_OUT;
fs.mkdirSync(OUT, { recursive: true });

const DURATION_MS = 72_000;
const STYLE = {
  fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Microsoft YaHei", serif',
  fontSizePx: 42,
  fontWeight: 400,
  letterSpacing: '0.08em',
  lineHeight: 1.8,
  color: '#d8d2c4',
  opacity: 0.9,
  shadow: '0 2px 18px rgba(0,0,0,0.65)',
  align: 'left',
  anchor: 'bottom-left',
  marginPx: 96,
  fadeInMs: 600,
  fadeOutMs: 800,
};

const LINES = [
  {
    id: 'sub-01',
    startMs: 1_000,
    endMs: 8_000,
    section: 'intro',
    text: '雨落了很久。',
    note: '开场，只留雨声与一个短句。',
  },
  {
    id: 'sub-02',
    startMs: 11_000,
    endMs: 19_000,
    section: 'verse',
    text: '霓虹在水里，比在墙上更亮。',
    note: '主歌进入，镜头掠过湿地反光。',
  },
  {
    id: 'sub-03',
    startMs: 27_000,
    endMs: 35_000,
    section: 'verse',
    text: '有些名字，只在关机前出现。',
    note: '第一次情绪下沉，留白拉长。',
  },
  {
    id: 'sub-04',
    startMs: 43_000,
    endMs: 51_000,
    section: 'chorus',
    text: '光开始有了重量。',
    note: '副歌抬升，字幕更短、更亮。',
  },
  {
    id: 'sub-05',
    startMs: 61_500,
    endMs: 69_500,
    section: 'outro',
    text: '这里曾经有过名字。',
    note: '尾奏，最后一个短句，之后只剩雨声。',
  },
];

for (const line of LINES) {
  if (line.startMs < 0 || line.endMs > DURATION_MS || line.endMs <= line.startMs) {
    throw new Error(`invalid cue ${line.id}`);
  }
  if ([...line.text].length < 5 || [...line.text].length > 15) {
    throw new Error(`cue ${line.id} must be 5..15 characters`);
  }
}

function srtTime(ms) {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

const payload = {
  schemaVersion: 1,
  generatedBy: 'v4/app/tools/assets/generate-subtitles.mjs',
  generatedAt: new Date().toISOString(),
  assetId: 'subtitles:prologue',
  worldId: 'w1',
  chartId: 'chart-w1',
  locale: 'zh-CN',
  title: '雨若 · 序言',
  durationMs: DURATION_MS,
  style: STYLE,
  sections: [
    { name: 'intro', startMs: 0, endMs: 10_667 },
    { name: 'verse', startMs: 10_667, endMs: 42_667 },
    { name: 'chorus', startMs: 42_667, endMs: 61_333 },
    { name: 'outro', startMs: 61_333, endMs: 72_000 },
  ],
  lines: LINES.map((line, index) => ({
    id: line.id,
    index,
    startMs: line.startMs,
    endMs: line.endMs,
    section: line.section,
    text: line.text,
    note: line.note,
    appearEffect: 'FadeIn',
    disappearEffect: 'FadeOut',
    easing: 'EaseInOut',
  })),
};

const jsonPath = path.join(OUT, 'prologue.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

const srt = LINES.map((line, index) => {
  return `${index + 1}\n${srtTime(line.startMs)} --> ${srtTime(line.endMs)}\n${line.text}\n`;
}).join('\n');
const srtPath = path.join(OUT, 'prologue.srt');
fs.writeFileSync(srtPath, srt, 'utf8');

const jsonBytes = fs.readFileSync(jsonPath);
const hash = crypto.createHash('sha256').update(jsonBytes).digest('hex');
console.log(`[subtitles] ${jsonPath}`);
console.log(`[subtitles] ${srtPath}`);
console.log(`[subtitles] ${LINES.length} cues / ${DURATION_MS}ms / sha256 ${hash.slice(0, 16)}…`);
