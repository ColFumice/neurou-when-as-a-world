import fs from 'node:fs';
import path from 'node:path';
import {
  APP_DIR,
  DEMO_PROJECT,
  FALLBACK_PROJECT,
  ROOT,
  killTree,
  startApp,
  startVite,
  waitForHttp,
} from './r4f-fixtures.mjs';
import { CdpClient, sleep } from './r4f-cdp.mjs';

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5b2', 'evidence');
const BACKUP = path.join(ROOT, 'quality-review', 'stage-5', 'r5b2', 'backup');
const DEMO_SIDECAR = path.join(DEMO_PROJECT, 'charts', 'chart-w1.beats.json');
const DEMO_LEDGER = path.join(DEMO_PROJECT, 'worlds', 'w1', 'ledger.ndjson');
const DEMO_HEAD = path.join(DEMO_PROJECT, 'worlds', 'w1', 'ledger.head.json');
const FALLBACK_MEDIA = path.join(FALLBACK_PROJECT, 'media', 'stereo', '58798dbd9bacfa2f');
const FALLBACK_FILES = ['left.mp4', 'right.mp4', 'audio.wav'];

function ensureDirs() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(BACKUP, { recursive: true });
}

function backupDemo() {
  ensureDirs();
  for (const [source, name] of [
    [DEMO_SIDECAR, 'chart-w1.beats.json'],
    [DEMO_LEDGER, 'ledger.ndjson'],
    [DEMO_HEAD, 'ledger.head.json'],
  ]) {
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(BACKUP, name));
  }
}

function restoreDemo() {
  for (const [target, name] of [
    [DEMO_SIDECAR, 'chart-w1.beats.json'],
    [DEMO_LEDGER, 'ledger.ndjson'],
    [DEMO_HEAD, 'ledger.head.json'],
  ]) {
    const source = path.join(BACKUP, name);
    if (fs.existsSync(source)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    } else {
      fs.rmSync(target, { force: true });
    }
  }
}

function renameFallbackMedia(prefix) {
  return FALLBACK_FILES.map((file) => {
    const source = path.join(FALLBACK_MEDIA, file);
    const target = path.join(FALLBACK_MEDIA, `${file}.${prefix}`);
    if (fs.existsSync(source)) fs.renameSync(source, target);
    return { source, target };
  });
}

function restoreFallbackMedia(items) {
  for (const item of items) {
    if (fs.existsSync(item.target)) fs.renameSync(item.target, item.source);
  }
}

async function openProject(cdp) {
  if (!await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000)) {
    throw new Error('project tree timeout');
  }
  for (const [x, y] of [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]]) {
    await cdp.evaluate(`(() => { const c=document.querySelector('.project-tree__canvas'); c?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'})); return !!c; })()`);
    await sleep(250);
    await cdp.mouseClick(x, y);
    await sleep(100);
    await cdp.mouseClick(x, y);
    if (await cdp.waitFor(`!!document.querySelector('.project-console')`, 2500)) return;
  }
  throw new Error('project console not open');
}

async function enterWorld(cdp) {
  await cdp.evaluate(`(() => {
    const input=document.querySelector('.project-console input');
    if(!input) return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'cd w1');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
    return true;
  })()`);
  if (!await cdp.waitFor(`!![...document.querySelectorAll('.game-overlay__button')].find(b=>b.textContent?.includes('START'))`, 40_000)) {
    throw new Error('game ready timeout');
  }
}

async function openEditor(cdp) {
  await cdp.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'/',code:'Slash',bubbles:true}))`);
  await cdp.waitFor(`!!document.querySelector('.game-command input')`, 3000);
  await cdp.evaluate(`(() => {
    const input=document.querySelector('.game-command input');
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'/edit');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.form?.requestSubmit();
    return true;
  })()`);
  if (!await cdp.waitFor(`!!document.querySelector('.editor-screen')`, 30_000)) {
    throw new Error('editor timeout');
  }
}

async function openBeats(cdp) {
  await sleep(1400);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rect = await cdp.evaluate(`(() => {
      const button=document.querySelector('.editor-beats-trigger');
      if(!button) return null;
      const r=button.getBoundingClientRect();
      return { x:r.x+r.width/2, y:r.y+r.height/2 };
    })()`);
    if (rect) await cdp.mouseClick(rect.x, rect.y);
    else await cdp.evaluate(`document.querySelector('.editor-beats-trigger')?.click()`);
    if (await cdp.waitFor(`!!document.querySelector('.editor-beats-panel')`, 2000)) return;
    await sleep(300);
  }
  throw new Error('beats panel not open');
}

async function setInput(cdp, selector, value) {
  return cdp.evaluate(`(() => {
    const input=document.querySelector(${JSON.stringify(selector)});
    if(!input) return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  })()`);
}

async function clickButtonByText(cdp, text, scope = 'document') {
  return cdp.evaluate(`(() => {
    const root=${scope};
    const buttons=[...root.querySelectorAll('button')];
    const button=buttons.find((item)=>item.textContent?.includes(${JSON.stringify(text)}));
    if(!button) return false;
    button.click();
    return true;
  })()`);
}

async function startAppPhase(projectRoot) {
  const vite = startVite(projectRoot);
  if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
  const app = startApp();
  const cdp = await CdpClient.connect();
  await cdp.navigate('http://localhost:1420/?r5b2=1&mode=rhythm');
  await sleep(1200);
  return { vite, app, cdp };
}

function stopPhase(phase) {
  if (phase.vite) killTree(phase.vite);
  if (phase.app) killTree(phase.app);
  if (phase.cdp) phase.cdp.close();
}

async function demoPhase(report) {
  const phase = await startAppPhase(DEMO_PROJECT);
  try {
    await openProject(phase.cdp);
    await enterWorld(phase.cdp);
    await sleep(700);
    report.start = await phase.cdp.evaluate(`(() => ({
      themeBg: document.querySelector('[data-theme-image="true"]') !== null,
      mediaVideo: (() => {
        const video=document.querySelector('.game-stage__video-source');
        return video ? { duration: video.duration, readyState: video.readyState } : null;
      })(),
      warning: document.querySelector('.game-overlay__warning')?.textContent ?? null,
    }))()`);
    await phase.cdp.screenshot(path.join(EVIDENCE, 'r5b2-game-active-start.png'));

    await openEditor(phase.cdp);
    await phase.cdp.waitFor(`!!document.querySelector('[data-asset-id="asset:guidance:head-logo"] img')`, 10_000);
    await sleep(600);
    report.logo = await phase.cdp.evaluate(`(() => {
      const image=document.querySelector('[data-asset-id="asset:guidance:head-logo"] img');
      return image ? { src: image.getAttribute('src'), complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null;
    })()`);
    report.labels = await phase.cdp.evaluate(`(() => document.querySelector('.editor-assets')?.innerText ?? '')()`);
    await phase.cdp.evaluate(`document.querySelector('.editor-media-trigger')?.click()`);
    await phase.cdp.waitFor(`!!document.querySelector('.editor-media')`, 3000);
    report.loadTheme = await phase.cdp.evaluate(`(() => ({ hasButton: [...document.querySelectorAll('.editor-media button')].some((b)=>b.textContent?.includes('Load theme')) }))()`);
    await clickButtonByText(phase.cdp, 'Load theme', 'document.querySelector(".editor-media")');
    await sleep(250);
    report.loadTheme.error = await phase.cdp.evaluate(`document.querySelector('.editor-media__error')?.textContent ?? null`);
    await sleep(500);

    await openBeats(phase.cdp);
    report.manualBefore = await phase.cdp.evaluate(`(() => ({
      status: document.querySelector('.editor-beats-panel__status')?.innerText ?? '',
      bpm: document.querySelector('.editor-beats-panel__field input[aria-label="Manual BPM"]')?.value ?? null,
      offset: document.querySelector('.editor-beats-panel__field input[aria-label="Manual offset ms"]')?.value ?? null,
      bars: document.querySelectorAll('.editor-beats-panel__bars i').length,
      downbeats: document.querySelectorAll('.editor-beats-panel__bars i.is-downbeat').length,
    }))()`);

    await clickButtonByText(phase.cdp, 'Export JSON', 'document.querySelector(".editor-beats-panel")');
    await phase.cdp.waitFor(`!!document.querySelector('.editor-beats-panel__export')`, 3000);
    report.export = await phase.cdp.evaluate(`(() => {
      const text=document.querySelector('.editor-beats-panel__export')?.value ?? '';
      return { length: text.length, sourceManual: text.includes('"source": "Manual"'), hasBeats: text.includes('"beatsMs"') };
    })()`);
    await phase.cdp.screenshot(path.join(EVIDENCE, 'r5b2-editor-beats-manual.png'));

    await clickButtonByText(phase.cdp, 'Manual Tap', 'document.querySelector(".editor-beats-panel")');
    await sleep(200);
    for (let tap = 0; tap < 4; tap += 1) {
      await clickButtonByText(phase.cdp, 'TAP', 'document.querySelector(".editor-beats-panel")');
      await sleep(500);
    }
    report.tapBpm = await phase.cdp.evaluate(`document.querySelector('.editor-beats-panel__field input[aria-label="Manual BPM"]')?.value ?? null`);
    await setInput(phase.cdp, '.editor-beats-panel__field input[aria-label="Manual BPM"]', '90');
    await setInput(phase.cdp, '.editor-beats-panel__field input[aria-label="Manual offset ms"]', '0');
    await clickButtonByText(phase.cdp, 'Save Manual', 'document.querySelector(".editor-beats-panel")');
    await phase.cdp.waitFor(`!!document.querySelector('.editor-beats-panel__confirm')`, 3000);
    await clickButtonByText(phase.cdp, 'Overwrite', 'document.querySelector(".editor-beats-panel")');
    await phase.cdp.waitFor(`document.querySelector('.editor-beats-panel__status')?.innerText.includes('READY')`, 5000);
    report.manualAfter = await phase.cdp.evaluate(`(() => ({
      status: document.querySelector('.editor-beats-panel__status')?.innerText ?? '',
      bpm: document.querySelector('.editor-beats-panel__field input[aria-label="Manual BPM"]')?.value ?? null,
      offset: document.querySelector('.editor-beats-panel__field input[aria-label="Manual offset ms"]')?.value ?? null,
    }))()`);
    await phase.cdp.screenshot(path.join(EVIDENCE, 'r5b2-editor-beats-manual-ready.png'));

    await phase.cdp.navigate('http://localhost:1420/?r5b2=1&mode=rhythm');
    await sleep(1200);
    await openProject(phase.cdp);
    await enterWorld(phase.cdp);
    await phase.cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.game-overlay__button')].find(x=>x.textContent?.includes('START')); b?.click(); return !!b; })()`);
    await sleep(7500);
    report.clock = await phase.cdp.evaluate(`(() => {
      const api=window.__NEUROU_CLOCK_DEBUG__;
      if(!api || typeof api.export !== 'function') return { available:false };
      const text=api.export();
      const parsed=JSON.parse(text);
      return {
        available:true,
        textLength:text.length,
        capacity:parsed.capacity,
        count:parsed.count,
        samples:parsed.samples?.length ?? 0,
        first:parsed.samples?.[0] ?? null,
        last:parsed.samples?.[parsed.samples.length-1] ?? null,
      };
    })()`);
    if (report.clock.available) {
      const clockText = await phase.cdp.evaluate(`window.__NEUROU_CLOCK_DEBUG__.export()`);
      fs.writeFileSync(path.join(EVIDENCE, 'r5b2-clock-debug-demo.json'), clockText);
    }
    await phase.cdp.screenshot(path.join(EVIDENCE, 'r5b2-game-active-playing.png'));
  } finally {
    stopPhase(phase);
  }
}

async function fallbackPhase(report) {
  const phase = await startAppPhase(FALLBACK_PROJECT);
  let renamed = [];
  try {
    await openProject(phase.cdp);
    await enterWorld(phase.cdp);
    await sleep(700);
    report.fallbackPair = await phase.cdp.evaluate(`(() => ({
      warning: document.querySelector('.game-overlay__warning')?.textContent ?? null,
      media: (() => {
        const video=document.querySelector('.game-stage__video-source');
        return video ? { duration: video.duration, readyState: video.readyState } : null;
      })(),
    }))()`);
    await phase.cdp.screenshot(path.join(EVIDENCE, 'r5b2-fallback-pair.png'));

    renamed = renameFallbackMedia('r5b2bak');
    await phase.cdp.navigate('http://localhost:1420/?r5b2=1&mode=rhythm');
    await sleep(1200);
    await openProject(phase.cdp);
    await enterWorld(phase.cdp);
    await sleep(700);
    report.fallbackImage = await phase.cdp.evaluate(`(() => {
      const fallback=document.querySelector('.game-stage__fallback');
      const image=document.querySelector('.game-stage__fallback-image');
      return {
        visible: fallback?.getAttribute('data-visible') ?? null,
        image: image ? { complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null,
        warning: document.querySelector('.game-overlay__warning')?.textContent ?? null,
      };
    })()`);
    await phase.cdp.screenshot(path.join(EVIDENCE, 'r5b2-fallback-image.png'));
  } finally {
    restoreFallbackMedia(renamed);
    stopPhase(phase);
  }
}

async function main() {
  backupDemo();
  const report = { startedAt: new Date().toISOString(), error: null, demo: {}, fallback: {} };
  try {
    await demoPhase(report);
    await fallbackPhase(report);
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    restoreDemo();
    report.restored = true;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5b2-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
