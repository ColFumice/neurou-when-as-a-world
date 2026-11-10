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
const CHART = path.join(DEMO_PROJECT, 'charts', 'chart-w1.editor.json');
const CHART_BAK = path.join(DEMO_PROJECT, 'charts', 'chart-w1.editor.json.bak');

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

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(BACKUP, { recursive: true });
  fs.copyFileSync(CHART, path.join(BACKUP, 'chart-w1.editor.json'));
  fs.copyFileSync(CHART_BAK, path.join(BACKUP, 'chart-w1.editor.json.bak'));
  const report = { startedAt: new Date().toISOString(), error: null };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    vite = startVite(DEMO_PROJECT);
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5c-a-editor=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await openEditor(cdp);
    await cdp.waitFor(`!!document.querySelector('.editor-timeline__beat-grid i')`, 15_000);
    await sleep(500);

    report.grid = await cdp.evaluate(`document.querySelectorAll('.editor-timeline__beat-grid i').length`);
    report.snapBefore = await cdp.evaluate(`document.querySelector('.editor-timeline__beat-snap')?.textContent ?? null`);
    await cdp.evaluate(`document.querySelector('.editor-timeline__beat-snap')?.click()`);
    await sleep(150);
    report.snapAfter = await cdp.evaluate(`document.querySelector('.editor-timeline__beat-snap')?.textContent ?? null`);

    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyA', key: 'a', modifiers: 2 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyA', key: 'a', modifiers: 2 });
    await sleep(200);
    report.selected = await cdp.evaluate(`document.querySelectorAll('.editor-keyframe.is-selected').length`);
    const before = JSON.parse(fs.readFileSync(CHART, 'utf8'));
    const beforeTimes = before.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.timeMs)).sort((a, b) => a - b);

    const point = await cdp.evaluate(`(() => {
      const item=document.querySelector('.editor-keyframe.is-selected');
      if(!item) return null;
      const r=item.getBoundingClientRect();
      return { x:r.left+r.width/2, y:r.top+r.height/2 };
    })()`);
    if (point) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      await sleep(100);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 50, y: point.y, button: 'left' });
      await sleep(100);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 50, y: point.y, button: 'left', clickCount: 1 });
      await sleep(250);
    }
    await cdp.evaluate(`(() => {
      const save=[...document.querySelectorAll('.editor-toolbar button')].find(b=>b.textContent?.includes('Save'));
      save?.click();
      return !!save;
    })()`);
    await sleep(1200);
    const after = JSON.parse(fs.readFileSync(CHART, 'utf8'));
    const afterTimes = after.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.timeMs)).sort((a, b) => a - b);
    report.drag = {
      before: beforeTimes,
      after: afterTimes,
      changed: JSON.stringify(beforeTimes) !== JSON.stringify(afterTimes),
      countBefore: beforeTimes.length,
      countAfter: afterTimes.length,
    };
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-a-editor-grid.png'));
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    fs.copyFileSync(path.join(BACKUP, 'chart-w1.editor.json'), CHART);
    fs.copyFileSync(path.join(BACKUP, 'chart-w1.editor.json.bak'), CHART_BAK);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5c-a-editor-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
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
