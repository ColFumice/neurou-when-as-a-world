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
    await cdp.navigate('http://localhost:1420/?r5c-a-layer=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await openEditor(cdp);
    await cdp.waitFor(`!!document.querySelector('[data-asset-id="asset:guidance:head-logo"] img')`, 12_000);
    await sleep(1200);

    report.logo = await cdp.evaluate(`(() => {
      const image=document.querySelector('[data-asset-id="asset:guidance:head-logo"] img');
      return image ? { src:image.getAttribute('src'), naturalWidth:image.naturalWidth, naturalHeight:image.naturalHeight } : null;
    })()`);
    report.labels = await cdp.evaluate(`document.querySelector('.editor-assets')?.innerText ?? ''`);
    report.layerAudio = await cdp.evaluate(`(() => [...document.querySelectorAll('[data-layer-audio-drop]')].map((el) => ({ layer:el.getAttribute('data-layer-audio-drop'), text:el.innerText })))()`);
    report.beatGrid = await cdp.evaluate(`document.querySelectorAll('.editor-timeline__beat-grid i').length`);
    report.beatSnapBefore = await cdp.evaluate(`document.querySelector('.editor-timeline__beat-snap')?.textContent ?? null`);

    await cdp.evaluate(`document.querySelector('.editor-timeline__beat-snap')?.click()`);
    await sleep(200);
    report.beatSnapAfter = await cdp.evaluate(`document.querySelector('.editor-timeline__beat-snap')?.textContent ?? null`);

    // Ctrl+A 全选 12 个关键帧。
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', code: 'KeyA', key: 'a', modifiers: 2,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', code: 'KeyA', key: 'a', modifiers: 2,
    });
    await sleep(250);
    report.selected = await cdp.evaluate(`document.querySelectorAll('.editor-keyframe.is-selected').length`);

    // A.1：在 Layer 3+ 轨双击创建；只验证 UI/保存，不触碰判定数学。
    await cdp.evaluate(`(() => {
      const track=document.querySelector('[data-track-layer="3"]');
      if(!track) return false;
      const rect=track.getBoundingClientRect();
      track.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:rect.left+rect.width*0.8,clientY:rect.top+rect.height/2}));
      return true;
    })()`);
    await sleep(500);
    report.layer3 = await cdp.evaluate(`(() => ({
      inspector: !!document.querySelector('.editor-inspector'),
      layerSelect: document.querySelector('.editor-inspector select')?.value ?? null,
      selectedCount: document.querySelectorAll('.editor-keyframe.is-selected').length,
    }))()`);

    // 清除 Layer 1 音频，再拖回 SFX，验证 UI 绑定往返。
    await cdp.evaluate(`(() => {
      const button=document.querySelector('[data-layer-audio-drop="1"] button');
      button?.click();
      return !!button;
    })()`);
    await sleep(200);
    report.cleared = await cdp.evaluate(`document.querySelector('[data-layer-audio-drop="1"]')?.innerText ?? null`);

    const drag = await cdp.evaluate(`(() => {
      const asset=document.querySelector('[data-asset-id="asset:audio:sfx-layer1"]');
      const target=document.querySelector('[data-layer-audio-drop="1"]');
      if(!asset || !target) return null;
      const a=asset.getBoundingClientRect(); const t=target.getBoundingClientRect();
      return { ax:a.left+a.width/2, ay:a.top+a.height/2, tx:t.left+t.width/2, ty:t.top+t.height/2 };
    })()`);
    if (drag) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: drag.ax, y: drag.ay });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: drag.ax, y: drag.ay, button: 'left', clickCount: 1 });
      await sleep(120);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: drag.tx, y: drag.ty, button: 'left' });
      await sleep(120);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: drag.tx, y: drag.ty, button: 'left', clickCount: 1 });
      await sleep(350);
    }
    report.rebound = await cdp.evaluate(`document.querySelector('[data-layer-audio-drop="1"]')?.innerText ?? null`);

    await cdp.evaluate(`(() => {
      const save=[...document.querySelectorAll('.editor-toolbar button')].find(b=>b.textContent?.includes('Save'));
      save?.click();
      return !!save;
    })()`);
    await sleep(1200);
    const saved = JSON.parse(fs.readFileSync(CHART, 'utf8'));
    report.saved = {
      layerAudio: saved.layerAudio ?? null,
      layer3: (saved.tracks ?? []).some((track) => track.layerIndex === 3 && track.keyframes?.length >= 1),
      keyframes: (saved.tracks ?? []).reduce((sum, track) => sum + (track.keyframes?.length ?? 0), 0),
    };
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-a-layer-editor.png'));

    // L3 全屏判定 + Layer Audio 运行时。
    await cdp.navigate('http://localhost:1420/?r5c-a-layer=game&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await cdp.evaluate(`(() => {
      const b=[...document.querySelectorAll('.game-overlay__button')].find(x=>x.textContent?.includes('START'));
      b?.click();
      return !!b;
    })()`);
    let hitTime = null;
    for (let attempt = 0; attempt < 260; attempt += 1) {
      const text = await cdp.evaluate(`document.querySelector('.game-hud__bottom > span')?.textContent ?? ''`);
      const value = Number(text);
      if (Number.isFinite(value) && value >= 10.55) {
        hitTime = text;
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyX', key: 'x' });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyX', key: 'x' });
        break;
      }
      await sleep(50);
    }
    await sleep(500);
    report.game = await cdp.evaluate(`(() => ({
      hitTime: ${JSON.stringify(hitTime)},
      score: document.querySelector('.game-hud__score strong')?.textContent ?? null,
      perfect: document.querySelector('.game-hud__counts .is-perfect b')?.textContent ?? null,
      layerAudio: window.__NEUROU_LAYER_AUDIO__?.get() ?? null,
    }))()`);
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-a-layer-game.png'));
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    restore();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5c-a-layer-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (cdp) cdp.close();
    if (app) killTree(app);
    if (vite) killTree(vite);
    console.log(JSON.stringify(report, null, 2));
  }
}

function restore() {
  fs.copyFileSync(path.join(BACKUP, 'chart-w1.editor.json'), CHART);
  fs.copyFileSync(path.join(BACKUP, 'chart-w1.editor.json.bak'), CHART_BAK);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
