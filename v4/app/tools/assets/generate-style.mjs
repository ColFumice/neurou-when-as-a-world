#!/usr/bin/env node
/**
 * R5b.1 · 导出统一调色 / 风格参数。
 *
 * 视频与图片生成器都从 lib/style.mjs 读取同一份 STYLE；
 * 本脚本把这份参数落成 media/theme/style.json，供 R5b.2 / 外部工具复用。
 *
 * 用法：
 *   node generate-style.mjs
 *   node generate-style.mjs --out <dir>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    if (next === undefined || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const out = args.out ? path.resolve(args.out) : DEFAULT_OUT;
fs.mkdirSync(out, { recursive: true });

const payload = {
  schemaVersion: 1,
  generatedBy: 'v4/app/tools/assets/generate-style.mjs',
  generatedAt: new Date().toISOString(),
  name: STYLE.name,
  palette: STYLE.palette,
  grade: STYLE.grade,
  vignette: STYLE.vignette,
  grain: STYLE.grain,
  rain: STYLE.rain,
  bloom: STYLE.bloom,
  notes: [
    '视频与图片共用同一份 LUT、暗角与颗粒参数。',
    '中强度对比 + 深阴影 + 冷暗部 / 暖高光；避免霓虹过曝。',
    '雨丝颜色与三层深度也在这里定义，改完重跑 generate-video / generate-images。',
  ],
};

const file = path.join(out, 'style.json');
fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[style] ${file}`);
console.log(`[style] ${STYLE.name}`);
