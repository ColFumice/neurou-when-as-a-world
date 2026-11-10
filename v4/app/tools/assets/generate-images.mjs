#!/usr/bin/env node
/**
 * R5b.1 · 生成「雨若」示例图片。
 *
 * 场景底图由 scene.mjs 程序化渲染（与视频同一套色板 / 调色），
 * 文字与版式用手机写的 SVG/HTML，由本机 Edge headless 渲染成 PNG，
 * 再用 ffmpeg 转 WebP（质量 90，超过 500KB 自动降档）。
 *
 * 输出（v4/.stereo-demo/project/media/images/）：
 *   theme-rain-night.webp        1920x1080 主题图
 *   world-rain-night.webp        世界背景
 *   logo-horizontal.webp         引导 Logo 01
 *   logo-vertical.webp           引导 Logo 02
 *   logo-mark.webp               引导 Logo 03
 *   logo-title.webp              引导 Logo 04
 *   logo-variants.json           动效建议
 *   images-spec.json             规格 / 哈希 / 质量
 *   contact-sheet.webp           联系表
 *
 * 用法：
 *   node generate-images.mjs
 *   node generate-images.mjs --only theme,world
 *   node generate-images.mjs --width 1920 --height 1080 --quality 90
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  ensureDir,
  pngToWebp,
  probeMedia,
  renderHtmlToPng,
  rgbaToPng,
  run,
} from './lib/ffmpeg.mjs';
import { renderStill } from './lib/scene.mjs';
import { STYLE } from './lib/style.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project', 'media', 'images');

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
const WIDTH = Number(args.width ?? 1920);
const HEIGHT = Number(args.height ?? 1080);
const QUALITY = Number(args.quality ?? 90);
const OUT = args.out ? path.resolve(args.out) : DEFAULT_OUT;
const SOURCE_DIR = path.join(OUT, '.sources');
const HTML_DIR = path.join(OUT, '.html');
const SVG_DIR = path.join(OUT, 'svg');
const PROFILE = path.join(OUT, '.edge-profile');
const ONLY = typeof args.only === 'string' ? new Set(args.only.split(',').map((item) => item.trim())) : null;

ensureDir(OUT);
ensureDir(SOURCE_DIR);
ensureDir(HTML_DIR);
ensureDir(SVG_DIR);

const PALETTE = STYLE.palette;
const IMAGES = [];

function shouldRun(id) {
  return !ONLY || ONLY.has(id);
}

function htmlShell({ title, base, overlay, background = '#060a0f', baseFilter = 'none', baseOpacity = 1, extraCss = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: ${WIDTH}px ${HEIGHT}px; margin: 0; }
  * { box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; margin: 0; overflow: hidden; background: ${background}; }
  body {
    font-family: "Noto Serif SC", "Source Han Serif SC", "Microsoft YaHei", serif;
    color: #d8d2c4;
    -webkit-font-smoothing: antialiased;
  }
  .base {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; filter: ${baseFilter}; opacity: ${baseOpacity};
  }
  .grain {
    position: absolute; inset: 0; pointer-events: none;
    background-image: url('./noise.png'); background-repeat: repeat;
    opacity: .055; mix-blend-mode: overlay;
  }
  .vignette {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 48%, transparent 38%, rgba(0,0,0,.26) 72%, rgba(0,0,0,.62) 100%);
  }
  .safe { position: absolute; inset: 72px 96px; }
  .topline, .bottomline {
    position: absolute; left: 96px; right: 96px;
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 15px; letter-spacing: .22em; color: rgba(185, 219, 225, .58);
  }
  .topline { top: 64px; }
  .bottomline { bottom: 58px; color: rgba(185, 219, 225, .42); }
  .kicker {
    font-family: "Segoe UI", Arial, sans-serif; font-size: 14px; letter-spacing: .42em;
    color: rgba(120, 215, 230, .72); margin-bottom: 26px;
  }
  h1, h2, p { margin: 0; font-weight: 400; }
  .serif { font-family: "Noto Serif SC", "Source Han Serif SC", "SimSun", serif; }
  .latin { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
  ${extraCss}
</style>
</head>
<body>
  ${base ? `<img class="base" src="./${base}" alt="">` : ''}
  ${overlay}
  <div class="grain"></div>
  <div class="vignette"></div>
</body>
</html>`;
}

function baseOverlayTheme() {
  return `
  <div class="topline"><span>NEUROU / PROLOGUE 01</span><span>W1 · 雨夜</span></div>
  <div style="position:absolute; left:0; top:0; width:100%; height:62%;
       background:linear-gradient(180deg, rgba(6,10,15,.55) 0%, rgba(6,10,15,.18) 48%, transparent 100%);"></div>
  <div style="position:absolute; inset:0;
       background:radial-gradient(ellipse at 24% 26%, rgba(6,10,15,.8) 0%, rgba(6,10,15,.52) 34%, rgba(6,10,15,.12) 56%, transparent 70%);"></div>
  <div style="position:absolute; left:120px; top:168px; width:900px;">
    <div class="kicker">A RAIN STUDY</div>
    <h1 class="serif" style="font-size:228px; line-height:1.02; letter-spacing:.08em; color:#e4ded0;
         text-shadow:0 0 42px rgba(120,215,230,.16), 0 2px 0 rgba(0,0,0,.25);">雨若</h1>
    <div class="latin" style="margin-top:18px; font-size:22px; letter-spacing:.52em; color:rgba(120,215,230,.82);">
      RAIN, UNFINISHED
    </div>
    <div style="margin-top:30px; width:250px; height:1px; background:linear-gradient(90deg, rgba(120,215,230,.8), rgba(120,215,230,0));"></div>
    <p class="serif" style="margin-top:28px; font-size:25px; letter-spacing:.14em; line-height:1.9;
       color:rgba(216,210,196,.8);">雨落了很久，城市还没有醒。</p>
  </div>
  <div class="bottomline"><span>1920 × 1080 / PROCEDURAL PLATE</span><span>2026 · DSH</span></div>`;
}

function baseOverlayWorld() {
  return `
  <div style="position:absolute; left:0; bottom:0; width:100%; height:38%;
       background:linear-gradient(0deg, rgba(6,10,15,.75) 0%, rgba(6,10,15,.2) 55%, transparent 100%);"></div>
  <div style="position:absolute; left:96px; bottom:74px;">
    <div class="latin" style="font-size:13px; letter-spacing:.34em; color:rgba(185,219,225,.5);">WORLD W1 / RAIN NIGHT</div>
  </div>`;
}

const MARK_SVG = `
<svg viewBox="0 0 220 220" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="110" cy="110" r="99" stroke="rgba(120,215,230,.3)" stroke-width="1"/>
  <path d="M62 74 H158" stroke="#d8d2c4" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M110 74 V168" stroke="#d8d2c4" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M62 74 V112" stroke="rgba(120,215,230,.9)" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M158 74 V112" stroke="rgba(120,215,230,.9)" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="94" cy="128" r="4" fill="#d8d2c4"/>
  <circle cx="126" cy="128" r="4" fill="#d8d2c4"/>
  <circle cx="94" cy="148" r="4" fill="rgba(120,215,230,.9)"/>
  <circle cx="126" cy="148" r="4" fill="rgba(120,215,230,.9)"/>
</svg>`;

function overlayLogoHorizontal() {
  return `
  <div style="position:absolute; inset:0; background:linear-gradient(90deg, rgba(6,10,15,.88) 0%, rgba(6,10,15,.58) 55%, rgba(6,10,15,.25) 100%);"></div>
  <div class="topline"><span>GUIDANCE LOGO / 01</span><span>HORIZONTAL LOCKUP</span></div>
  <div style="position:absolute; left:150px; top:50%; transform:translateY(-54%); display:flex; align-items:center; gap:56px;">
    <div style="width:172px; height:172px; opacity:.92;">${MARK_SVG}</div>
    <div>
      <div class="kicker" style="margin-bottom:14px;">NEUROU · 雨若</div>
      <div class="serif" style="font-size:148px; line-height:1; letter-spacing:.12em; color:#e4ded0;">雨若</div>
      <div class="latin" style="margin-top:20px; font-size:18px; letter-spacing:.64em; color:rgba(120,215,230,.7);">RAIN, UNFINISHED</div>
    </div>
  </div>
  <div class="bottomline"><span>APPEAR · FADE DOWN / 900MS</span><span>1920 × 1080</span></div>`;
}

function overlayLogoVertical() {
  return `
  <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(6,10,15,.72) 0%, rgba(6,10,15,.86) 100%);"></div>
  <div class="topline"><span>GUIDANCE LOGO / 02</span><span>VERTICAL LOCKUP</span></div>
  <div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:flex; align-items:flex-start; gap:54px;">
    <div class="serif" style="writing-mode:vertical-rl; font-size:170px; line-height:1.18; letter-spacing:.12em; color:#e4ded0;">雨若</div>
    <div style="width:1px; height:520px; background:linear-gradient(180deg, rgba(120,215,230,.7), rgba(120,215,230,0));"></div>
    <div class="latin" style="writing-mode:vertical-rl; font-size:16px; letter-spacing:.62em; color:rgba(185,219,225,.62); padding-top:12px;">NEUROU · RAIN UNFINISHED</div>
  </div>
  <div class="bottomline"><span>APPEAR · TRUNCATE / 1100MS</span><span>1920 × 1080</span></div>`;
}

function overlayLogoMark() {
  return `
  <div style="position:absolute; inset:0; background:radial-gradient(circle at 50% 44%, rgba(26,35,50,.55) 0%, rgba(6,10,15,.9) 62%, rgba(6,10,15,.98) 100%);"></div>
  <div style="position:absolute; left:50%; top:47%; transform:translate(-50%,-50%); width:520px; height:520px; opacity:.95;">${MARK_SVG}</div>
  <div style="position:absolute; left:0; right:0; bottom:138px; text-align:center;">
    <div class="latin" style="font-size:17px; letter-spacing:.72em; color:rgba(216,210,196,.72);">NEUROU</div>
    <div class="serif" style="margin-top:14px; font-size:22px; letter-spacing:.28em; color:rgba(120,215,230,.66);">雨若</div>
  </div>
  <div class="bottomline"><span>APPEAR · SCALE UP + GLOW / 1200MS</span><span>1920 × 1080</span></div>`;
}

function overlayLogoTitle() {
  return `
  <div style="position:absolute; inset:0; background:radial-gradient(ellipse at 50% 48%, rgba(6,10,15,.15) 0%, rgba(6,10,15,.62) 58%, rgba(6,10,15,.92) 100%);"></div>
  <div style="position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); width:900px; height:500px; text-align:center;">
    <div style="position:absolute; left:50%; top:50%; width:660px; height:660px; transform:translate(-50%,-50%); border:1px solid rgba(120,215,230,.16); border-radius:50%;"></div>
    <div class="kicker" style="margin-bottom:26px;">NEUROU / TITLE CARD</div>
    <h1 class="serif" style="font-size:250px; line-height:1.05; letter-spacing:.22em; color:#e4ded0;
       text-shadow:0 0 64px rgba(120,215,230,.18);">雨若</h1>
    <div class="latin" style="margin-top:22px; font-size:18px; letter-spacing:.68em; color:rgba(120,215,230,.75);">RAIN, UNFINISHED</div>
    <div style="margin:28px auto 0; width:180px; height:1px; background:linear-gradient(90deg, transparent, rgba(216,210,196,.5), transparent);"></div>
  </div>
  <div class="bottomline"><span>APPEAR · FADE UP + TRACKING / 1400MS</span><span>1920 × 1080</span></div>`;
}

async function renderBase(name, { time, variant = 'default', seed = 20261025 }) {
  const file = path.join(SOURCE_DIR, `${name}.png`);
  if (fs.existsSync(file) && !args.force) return file;
  const still = renderStill({ width: WIDTH, height: HEIGHT, time, seed, variant });
  await rgbaToPng(still.rgba, WIDTH, HEIGHT, file);
  return file;
}

async function renderComposite(id, { title, base, overlay, baseFilter = 'none', baseOpacity = 1, extraCss = '' }) {
  const html = path.join(HTML_DIR, `${id}.html`);
  const baseRel = base ? path.relative(HTML_DIR, base).replace(/\\/g, '/') : null;
  fs.writeFileSync(html, htmlShell({ title, base: baseRel, overlay, baseFilter, baseOpacity, extraCss }));
  const png = path.join(SOURCE_DIR, `${id}.png`);
  await renderHtmlToPng({
    htmlFile: html,
    pngFile: png,
    width: WIDTH,
    height: HEIGHT,
    profileDir: PROFILE,
  });
  const webp = path.join(OUT, `${id}.webp`);
  const converted = await pngToWebp(png, webp, { quality: QUALITY, maxBytes: 500 * 1024 });
  const probe = await probeMedia(webp);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(webp)).digest('hex');
  IMAGES.push({
    id,
    title,
    file: path.basename(webp),
    width: probe.video?.width ?? WIDTH,
    height: probe.video?.height ?? HEIGHT,
    bytes: converted.bytes,
    quality: converted.quality,
    overBudget: converted.overBudget,
    sha256: hash,
  });
  console.log(`[images] ${path.basename(webp)} · ${producedSize(converted.bytes)} · q${converted.quality}`);
  return webp;
}

function producedSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function makeNoise() {
  const noise = path.join(HTML_DIR, 'noise.png');
  if (fs.existsSync(noise)) return;
  await run('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=gray:s=512x512',
    '-vf', 'noise=alls=42:allf=t+u',
    '-frames:v', '1', '-y', noise,
  ]);
}

async function main() {
  await makeNoise();
  // 三种不同的机位/时刻，避免所有图共用同一帧。
  const baseTheme = shouldRun('theme-rain-night') || shouldRun('logo-horizontal') || shouldRun('logo-mark') || shouldRun('logo-title')
    ? await renderBase('base-theme', { time: 2.6 })
    : null;
  const baseWorld = shouldRun('world-rain-night')
    ? await renderBase('base-world', { time: 12.6 })
    : null;
  const baseVertical = shouldRun('logo-vertical')
    ? await renderBase('base-vertical', { time: 20.2, variant: 'dark' })
    : null;

  if (shouldRun('theme-rain-night')) {
    await renderComposite('theme-rain-night', {
      title: '雨若 · 雨夜主题图',
      base: baseTheme,
      overlay: baseOverlayTheme(),
    });
  }
  if (shouldRun('world-rain-night')) {
    await renderComposite('world-rain-night', {
      title: '雨若 · 世界背景',
      base: baseWorld,
      overlay: baseOverlayWorld(),
    });
  }
  if (shouldRun('logo-horizontal')) {
    await renderComposite('logo-horizontal', {
      title: '雨若 · 横向 Logo',
      base: baseTheme,
      overlay: overlayLogoHorizontal(),
      baseFilter: 'blur(5px) brightness(.62) saturate(.9)',
      baseOpacity: 0.9,
    });
  }
  if (shouldRun('logo-vertical')) {
    await renderComposite('logo-vertical', {
      title: '雨若 · 纵向 Logo',
      base: baseVertical,
      overlay: overlayLogoVertical(),
      baseFilter: 'blur(7px) brightness(.6)',
      baseOpacity: 0.85,
    });
  }
  if (shouldRun('logo-mark')) {
    await renderComposite('logo-mark', {
      title: '雨若 · 标记 Logo',
      base: baseTheme,
      overlay: overlayLogoMark(),
      baseFilter: 'blur(10px) brightness(.46) saturate(.8)',
      baseOpacity: 0.8,
    });
  }
  if (shouldRun('logo-title')) {
    await renderComposite('logo-title', {
      title: '雨若 · 标题卡 Logo',
      base: baseTheme,
      overlay: overlayLogoTitle(),
      baseFilter: 'blur(2px) brightness(.72)',
      baseOpacity: 0.95,
    });
  }

  const variants = [
    {
      id: 'logo-horizontal',
      file: 'logo-horizontal.webp',
      label: '横向组合 / Horizontal lockup',
      usage: '编辑器资源栏、项目标题',
      motion: {
        appearEffect: 'FadeDown',
        disappearEffect: 'FadeUp',
        durationMs: 900,
        easing: 'EaseInOut',
        blurFromPx: 8,
        glow: 'none',
      },
    },
    {
      id: 'logo-vertical',
      file: 'logo-vertical.webp',
      label: '纵向组合 / Vertical lockup',
      usage: '世界序言、竖屏封面',
      motion: {
        appearEffect: 'Truncate',
        disappearEffect: 'Truncate',
        durationMs: 1100,
        easing: 'EaseOut',
        blurFromPx: 0,
        glow: 'cyan-edge',
      },
    },
    {
      id: 'logo-mark',
      file: 'logo-mark.webp',
      label: '标记 / Mark',
      usage: '加载、章节节点、HUD 水印',
      motion: {
        appearEffect: 'ScaleUp',
        disappearEffect: 'FadeUp',
        durationMs: 1200,
        easing: 'EaseInOut',
        blurFromPx: 0,
        glow: 'soft-cyan',
      },
    },
    {
      id: 'logo-title',
      file: 'logo-title.webp',
      label: '标题卡 / Title card',
      usage: '进入世界的过场',
      motion: {
        appearEffect: 'FadeUp',
        disappearEffect: 'FadeUp',
        durationMs: 1400,
        easing: 'EaseInOut',
        blurFromPx: 0,
        glow: 'rain-bloom',
      },
    },
  ];
  fs.writeFileSync(path.join(OUT, 'logo-variants.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedBy: 'v4/app/tools/assets/generate-images.mjs',
    variants,
  }, null, 2)}\n`);

  const contact = path.join(OUT, 'contact-sheet.webp');
  const files = ['theme-rain-night.webp', 'world-rain-night.webp', 'logo-horizontal.webp', 'logo-vertical.webp', 'logo-mark.webp', 'logo-title.webp']
    .filter((file) => fs.existsSync(path.join(OUT, file)));
  if (files.length === 6) {
    const inputs = files.flatMap((file) => ['-i', path.join(OUT, file)]);
    const filter = files.map((_, index) => `[${index}:v]scale=640:360[s${index}]`).join(';')
      + ';' + [0, 1, 2].map((index) => `[s${index}]`).join('') + 'hstack=inputs=3[top]'
      + ';' + [3, 4, 5].map((index) => `[s${index}]`).join('') + 'hstack=inputs=3[bottom]'
      + ';[top][bottom]vstack=inputs=2[out]';
    await run('ffmpeg', [
      '-nostdin', '-hide_banner', '-loglevel', 'error',
      ...inputs,
      '-filter_complex', filter,
      '-map', '[out]', '-frames:v', '1',
      '-c:v', 'libwebp', '-quality', '88', '-y', contact,
    ]);
  }

  const spec = {
    schemaVersion: 1,
    generatedBy: 'v4/app/tools/assets/generate-images.mjs',
    generatedAt: new Date().toISOString(),
    width: WIDTH,
    height: HEIGHT,
    format: 'WebP',
    requestedQuality: QUALITY,
    maxBytesPerFile: 500 * 1024,
    palette: PALETTE,
    grade: STYLE.grade,
    images: IMAGES,
    contactSheet: fs.existsSync(contact) ? 'contact-sheet.webp' : null,
    notes: [
      'Scene plates come from the same procedural renderer as the stereo video.',
      'Typography is handwritten SVG/CSS rendered by local Edge headless; no external art or fonts are bundled.',
      'WebP quality steps down automatically if a file exceeds 500KB.',
    ],
  };
  fs.writeFileSync(path.join(OUT, 'images-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`[images] ${path.join(OUT, 'images-spec.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
