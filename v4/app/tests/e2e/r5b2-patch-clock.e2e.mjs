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

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5b2-patch', 'evidence');

async function openProject(cdp) {
  if (!await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000)) {
    throw new Error('project tree timeout');
  }
  for (const [x, y] of [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]]) {
    await cdp.evaluate(`(() => { const c=document.querySelector('.project-tree__canvas'); c?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'})); return !!c; })()`);
    await sleep(200);
    await cdp.mouseClick(x, y);
    await sleep(100);
    await cdp.mouseClick(x, y);
    if (await cdp.waitFor(`!!document.querySelector('.project-console')`, 2000)) return;
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

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const report = { startedAt: new Date().toISOString(), error: null };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    vite = startVite(DEMO_PROJECT);
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5b2-patch=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await sleep(700);
    await cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.game-overlay__button')].find(x=>x.textContent?.includes('START')); b?.click(); return !!b; })()`);
    await sleep(6500);
    report.result = await cdp.evaluate(`(() => {
      const api=window.__NEUROU_CLOCK_DEBUG__;
      if(!api || typeof api.get !== 'function') return { debug:false };
      const data=api.get();
      const last=data.samples?.[data.samples.length-1] ?? null;
      const hud=document.querySelector('.game-hud__clock');
      return {
        debug:true,
        capacity:data.capacity,
        count:data.count,
        lastDriftMs:last?.driftMs ?? null,
        lastStatus:last?.status ?? null,
        hudText:hud?.textContent ?? null,
        hudClass:hud?.className ?? null,
        hudVisible:!!hud,
        audioLabel:document.querySelector('.game-hud__audio')?.textContent ?? null,
      };
    })()`);
    await cdp.screenshot(path.join(EVIDENCE, 'r5b2-patch-clock-wired.png'));
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5b2-patch-clock-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
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
