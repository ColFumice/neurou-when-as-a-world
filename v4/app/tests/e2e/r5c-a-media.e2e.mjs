import fs from 'node:fs';
import path from 'node:path';
import {
  DEMO_PROJECT,
  ROOT,
  killTree,
  startApp,
  startVite,
  waitForHttp,
} from './r4f-fixtures.mjs';
import { CdpClient, sleep } from './r4f-cdp.mjs';

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5c-a', 'evidence');
const BACKUP = path.join(ROOT, 'quality-review', 'stage-5', 'r5c-a', 'backup');
const MANIFEST = path.join(DEMO_PROJECT, 'media', 'manifest.json');
const SOURCE = path.join(DEMO_PROJECT, 'media', 'theme', 'rain-night-left-loop.mp4');

async function openProject(cdp) {
  if (!await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000)) throw new Error('tree timeout');
  for (const [x, y] of [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]]) {
    await cdp.evaluate(`(() => { const c=document.querySelector('.project-tree__canvas'); c?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'})); return !!c; })()`);
    await sleep(200);
    await cdp.mouseClick(x, y);
    await sleep(100);
    await cdp.mouseClick(x, y);
    if (await cdp.waitFor(`!!document.querySelector('.project-console')`, 2000)) return;
  }
  throw new Error('console not open');
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
    throw new Error('game timeout');
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
  if (!await cdp.waitFor(`!!document.querySelector('.editor-screen')`, 30_000)) throw new Error('editor timeout');
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

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(BACKUP, { recursive: true });
  const originalManifest = fs.readFileSync(MANIFEST, 'utf8');
  fs.writeFileSync(path.join(BACKUP, 'manifest-r5c-a-media.json'), originalManifest);
  const report = { startedAt: new Date().toISOString(), error: null };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    vite = startVite(DEMO_PROJECT);
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5c-a-media=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await openEditor(cdp);
    await cdp.waitFor(`!!document.querySelector('[data-asset-id="asset:guidance:head-logo"] img')`, 12_000);
    await cdp.waitFor(`!!document.querySelector('.editor-media-trigger')`, 5000);
    await sleep(400);
    await cdp.evaluate(`document.querySelector('.editor-media-trigger')?.click()`);
    await cdp.waitFor(`!!document.querySelector('.editor-media')`, 3000);
    report.modes = await cdp.evaluate(`[...document.querySelectorAll('.editor-media__modes button')].map((b)=>b.textContent)`);
    await cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.editor-media__modes button')].find(x=>x.textContent?.includes('单目')); b?.click(); return !!b; })()`);
    await sleep(200);
    report.hint = await cdp.evaluate(`document.querySelector('.editor-media')?.innerText.includes('静态场景') ?? false`);
    await setInput(cdp, '.editor-media input[placeholder="选择源视频"]', SOURCE);
    await setInput(cdp, '.editor-media input[type="range"]', '33');
    await cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.editor-media button')].find(x=>x.textContent?.includes('Import mono')); b?.click(); return !!b; })()`);
    await sleep(1000);
    report.early = await cdp.evaluate(`(() => ({
      meta: document.querySelector('.editor-media__meta')?.innerText ?? '',
      error: document.querySelector('.editor-media__error')?.innerText ?? null,
    }))()`);
    if (!await cdp.waitFor(`(() => { const text=document.querySelector('.editor-media__meta')?.innerText ?? ''; return /PAIR [0-9a-f]{16}/.test(text); })()`, 120_000)) {
      throw new Error(`mono import timeout: ${JSON.stringify(report.early)}`);
    }
    report.panel = await cdp.evaluate(`document.querySelector('.editor-media')?.innerText ?? ''`);
    await sleep(800);
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const pair = [...(manifest.stereoPairs ?? [])].reverse().find((item) => item.pseudoStereo);
    report.pair = pair ?? null;
    if (pair) {
      const dir = path.join(DEMO_PROJECT, 'media', 'stereo', pair.stereoPairId);
      report.files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      const left = manifest.assets.find((asset) => asset.assetId === pair.leftAssetId);
      const right = manifest.assets.find((asset) => asset.assetId === pair.rightAssetId);
      report.durations = { left: left?.durationMs ?? null, right: right?.durationMs ?? null };
    }
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-a-media-mono.png'));
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    fs.writeFileSync(MANIFEST, originalManifest);
    if (report.pair?.stereoPairId && !originalManifest.includes(report.pair.stereoPairId)) {
      fs.rmSync(
        path.join(DEMO_PROJECT, 'media', 'stereo', report.pair.stereoPairId),
        { recursive: true, force: true },
      );
    }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5c-a-media-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (cdp) cdp.close();
    if (app) killTree(app);
    if (vite) killTree(vite);
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
