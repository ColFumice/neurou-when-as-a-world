#!/usr/bin/env node
/**
 * R5b.1 · 一键生成并接入整套示例资产。
 *
 * 顺序：视频 → 图片 → 音乐 → 字幕 → 写入 demo project。
 * 每一步都可以单独跳过；所有子脚本仍然是独立可运行的。
 *
 * 用法：
 *   node generate-all.mjs
 *   node generate-all.mjs --skip-video
 *   node generate-all.mjs --skip-video,images --no-apply
 *   node generate-all.mjs --force
 */

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

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
const skipped = new Set(
  String(args.skip ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

function run(script, scriptArgs = []) {
  const file = path.join(HERE, script);
  console.log(`\n=== ${script} ${scriptArgs.join(' ')} ===`);
  const result = spawnSync(process.execPath, [file, ...scriptArgs], {
    cwd: HERE,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${script} exited ${result.status}`);
  }
}

try {
  if (!skipped.has('video')) {
    run('generate-video.mjs', ['--preset', 'medium', '--crf', '19']);
  } else {
    console.log('[all] skip video');
  }
  if (!skipped.has('images')) {
    run('generate-images.mjs', ['--force']);
  } else {
    console.log('[all] skip images');
  }
  if (!skipped.has('logo')) {
    run('generate-logo-mark.mjs');
  } else {
    console.log('[all] skip logo');
  }
  if (!skipped.has('sfx')) {
    run('generate-sfx.mjs');
  } else {
    console.log('[all] skip sfx');
  }
  if (!skipped.has('music')) {
    run('generate-music.mjs');
  } else {
    console.log('[all] skip music');
  }
  if (!skipped.has('subtitles')) {
    run('generate-subtitles.mjs');
  } else {
    console.log('[all] skip subtitles');
  }
  if (!skipped.has('style')) {
    run('generate-style.mjs');
  } else {
    console.log('[all] skip style');
  }
  if (args['no-apply'] !== true) {
    run('apply-demo.mjs');
    run('verify-assets.mjs');
  } else {
    console.log('[all] skip apply-demo');
  }
  console.log('\n[all] done');
} catch (error) {
  console.error(`[all] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
