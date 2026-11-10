#!/usr/bin/env node
/**
 * R5b.2 · 生成透明底 Logo mark。
 *
 * 输出：
 *   assets/resources/guidance/rain-night-mark.png   512×512，透明底
 *   media/images/logo-mark-transparent.png          副本，供主题目录引用
 *
 * 只画线/圆/点，不需要 Canvas、字体或外部素材。
 * 不修改 head-logo.png、不修改任何 Cocos .meta。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rgbaToPng, ensureDir, fileSize } from './lib/ffmpeg.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const SIZE = 512;
const SCALE = SIZE / 220;
const BONE = [216, 210, 196];
const CYAN = [120, 215, 230];

const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);

function blend(x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || alpha <= 0) return;
  const index = (y * SIZE + x) * 4;
  const a = Math.min(1, alpha);
  const dstA = rgba[index + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  for (let channel = 0; channel < 3; channel += 1) {
    const dst = rgba[index + channel];
    rgba[index + channel] = Math.round((color[channel] * a + dst * dstA * (1 - a)) / outA);
  }
  rgba[index + 3] = Math.round(outA * 255);
}

function segmentDistance(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lengthSquared));
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}

function stroke(x0, y0, x1, y1, width, color) {
  const half = width / 2;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 2));
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(x0, x1) + half + 2));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 2));
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(y0, y1) + half + 2));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = segmentDistance(x + 0.5, y + 0.5, x0, y0, x1, y1);
      const coverage = Math.max(0, Math.min(1, half + 0.75 - distance));
      blend(x, y, color, coverage);
    }
  }
}

function ring(cx, cy, radius, width, color, opacity = 1) {
  const outer = radius + width / 2 + 2;
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y += 1) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const coverage = Math.max(0, Math.min(1, width / 2 + 0.75 - Math.abs(distance - radius)));
      blend(x, y, color, coverage * opacity);
    }
  }
}

function dot(cx, cy, radius, color) {
  const outer = radius + 2;
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y += 1) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const coverage = Math.max(0, Math.min(1, radius + 0.75 - distance));
      blend(x, y, color, coverage);
    }
  }
}

const s = (value) => value * SCALE;
const strokeWidth = 3.4 * SCALE;

// 与 generate-images.mjs 的 MARK_SVG 同一几何：圆框 + 「雨」的横/竖/两竖/四点。
ring(s(110), s(110), s(99), 2.2 * SCALE, CYAN, 0.5);
stroke(s(62), s(74), s(158), s(74), strokeWidth, BONE);
stroke(s(110), s(74), s(110), s(168), strokeWidth, BONE);
stroke(s(62), s(74), s(62), s(112), strokeWidth, CYAN);
stroke(s(158), s(74), s(158), s(112), strokeWidth, CYAN);
dot(s(94), s(128), 5.5 * SCALE, BONE);
dot(s(126), s(128), 5.5 * SCALE, BONE);
dot(s(94), s(148), 5.5 * SCALE, CYAN);
dot(s(126), s(148), 5.5 * SCALE, CYAN);

const guidance = path.join(REPO_ROOT, 'assets', 'resources', 'guidance', 'rain-night-mark.png');
const mirror = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project', 'media', 'images', 'logo-mark-transparent.png');
ensureDir(path.dirname(guidance));
ensureDir(path.dirname(mirror));
await rgbaToPng(rgba, SIZE, SIZE, guidance);
fs.copyFileSync(guidance, mirror);
console.log(`[logo-mark] ${guidance} (${fileSize(guidance)} bytes)`);
console.log(`[logo-mark] ${mirror}`);
