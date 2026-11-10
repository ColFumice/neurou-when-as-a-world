import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import {
  APP_DIR,
  PROJECT,
  ROOT,
  killTree,
  startApp,
  startVite,
  waitForHttp,
} from './r4f-fixtures.mjs';
import { CdpClient, sleep } from './r4f-cdp.mjs';

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5b', 'evidence');
const BACKUP = path.join(ROOT, 'quality-review', 'stage-5', 'r5b', 'backup');
const SIDECAR = path.join(PROJECT, 'charts', 'chart-w1.beats.json');
const LEDGER = path.join(PROJECT, 'worlds', 'w1', 'ledger.ndjson');
const HEAD = path.join(PROJECT, 'worlds', 'w1', 'ledger.head.json');

function ensureDirs() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(BACKUP, { recursive: true });
}

function backup() {
  ensureDirs();
  if (fs.existsSync(SIDECAR)) fs.copyFileSync(SIDECAR, path.join(BACKUP, 'chart-w1.beats.json'));
  if (fs.existsSync(LEDGER)) fs.copyFileSync(LEDGER, path.join(BACKUP, 'ledger.ndjson'));
  if (fs.existsSync(HEAD)) fs.copyFileSync(HEAD, path.join(BACKUP, 'ledger.head.json'));
}

function cleanLedger() {
  fs.rmSync(LEDGER, { force: true });
  fs.rmSync(HEAD, { force: true });
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
}

function restoreSidecar() {
  const source = path.join(BACKUP, 'chart-w1.beats.json');
  if (fs.existsSync(source)) fs.copyFileSync(source, SIDECAR);
}

function restoreLedger() {
  for (const [name, target] of [['ledger.ndjson', LEDGER], ['ledger.head.json', HEAD]]) {
    const source = path.join(BACKUP, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, target);
    else fs.rmSync(target, { force: true });
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

async function readBeatsPanel(cdp) {
  return cdp.evaluate(`(() => {
    const panel=document.querySelector('.editor-beats-panel');
    return {
      text: panel?.innerText ?? '',
      status: [...(panel?.querySelectorAll('*') ?? [])].map((el)=>el.textContent).filter(Boolean).join(' ').slice(0, 1200),
    };
  })()`);
}

async function startRecording(file, seconds) {
  const child = spawn('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-f', 'gdigrab', '-framerate', '12', '-i', 'desktop',
    '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', file,
  ], { stdio: 'ignore', windowsHide: true });
  const done = new Promise((resolve) => child.on('close', resolve));
  return { child, done };
}

async function main() {
  backup();
  cleanLedger();
  const report = {
    startedAt: new Date().toISOString(),
    sidecarBefore: null,
    analyze: null,
    game: null,
    recording: null,
    error: null,
    restored: false,
  };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    if (fs.existsSync(SIDECAR)) {
      report.sidecarBefore = JSON.parse(fs.readFileSync(SIDECAR, 'utf8'));
    }
    vite = startVite();
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5b1=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await openEditor(cdp);
    await sleep(1500);
    // 编辑器挂载后面板按钮可能被 React 替换一次；点按中心，最多重试 5 次。
    let beatsOpen = false;
    for (let attempt = 0; attempt < 5 && !beatsOpen; attempt += 1) {
      const rect = await cdp.evaluate(`(() => {
        const button=document.querySelector('.editor-beats-trigger');
        if(!button) return null;
        const r=button.getBoundingClientRect();
        return { x:r.x+r.width/2, y:r.y+r.height/2 };
      })()`);
      if (rect) await cdp.mouseClick(rect.x, rect.y);
      else await cdp.evaluate(`document.querySelector('.editor-beats-trigger')?.click()`);
      beatsOpen = await cdp.waitFor(`!!document.querySelector('.editor-beats-panel')`, 2000);
      if (!beatsOpen) await sleep(350);
    }
    if (!beatsOpen) throw new Error('beats panel did not open');
    await sleep(800);
    report.sidecarBeforeUi = await readBeatsPanel(cdp);
    await cdp.screenshot(path.join(EVIDENCE, 'editor-beats-manual.png'));

    // 用新音乐跑一次 R5a 的 Analyze Beats，记录它在这类持续氛围素材上的真实表现。
    await cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.editor-beats-panel button')].find(x=>x.textContent?.includes('Analyze Beats')); b?.click(); return !!b; })()`);
    await sleep(12_000);
    report.analyze = await readBeatsPanel(cdp);
    report.analyze.sidecarAfter = fs.existsSync(SIDECAR)
      ? JSON.parse(fs.readFileSync(SIDECAR, 'utf8'))
      : null;
    await cdp.screenshot(path.join(EVIDENCE, 'editor-beats-analyze.png'));

    // 还原手工 90 BPM 网格，让游戏 HUD 与谱面按创作时的心跳走。
    restoreSidecar();
    await cdp.navigate('http://localhost:1420/?r5b1=1&mode=rhythm');
    await sleep(1500);
    await openProject(cdp);
    await enterWorld(cdp);
    await cdp.screenshot(path.join(EVIDENCE, 'game-ready.png'));

    const recordingFile = path.join(EVIDENCE, 'r5b1-game.mp4');
    const noRecord = process.env.NO_RECORD === '1';
    const recording = noRecord ? null : await startRecording(recordingFile, 18);
    await sleep(800);
    await cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.game-overlay__button')].find(x=>x.textContent?.includes('START')); b?.click(); return !!b; })()`);
    await sleep(6500);
    report.game = await cdp.evaluate(`(() => ({
      hud: document.querySelector('.game-hud')?.innerText ?? '',
      beats: document.querySelector('.game-hud__beats')?.innerText ?? null,
      downbeat: document.querySelector('.game-hud__downbeat')?.innerText ?? null,
      noteCount: (document.querySelector('.game-hud')?.innerText ?? '').match(/(\\d+) NOTES/)?.[1] ?? null,
      video: (() => {
        const video=document.querySelector('.game-stage video');
        return video ? { readyState: video.readyState, duration: video.duration, currentTime: video.currentTime } : null;
      })(),
      canvases: [...document.querySelectorAll('canvas')].map((c)=>({w:c.width,h:c.height})),
    }))()`);
    await cdp.screenshot(path.join(EVIDENCE, 'game-playing-06s.png'));
    await sleep(7000);
    report.gameLate = await cdp.evaluate(`(() => ({
      hud: document.querySelector('.game-hud')?.innerText ?? '',
      video: (() => {
        const video=document.querySelector('.game-stage video');
        return video ? { readyState: video.readyState, duration: video.duration, currentTime: video.currentTime } : null;
      })(),
    }))()`);
    await cdp.screenshot(path.join(EVIDENCE, 'game-playing-13s.png'));
    if (recording) await recording.done;
    else await sleep(1800);
    report.recording = {
      file: recordingFile,
      bytes: fs.existsSync(recordingFile) ? fs.statSync(recordingFile).size : 0,
      skipped: noRecord,
    };

    if (!report.game?.beats || !report.game.beats.includes('90')) {
      throw new Error(`HUD beats did not show 90: ${JSON.stringify(report.game?.beats)}`);
    }
    if (!report.game?.video || report.game.video.readyState < 2) {
      throw new Error('game video not ready');
    }
    if (!report.game?.hud?.includes('chart-w1') || !report.game.hud.includes('072.000')) {
      throw new Error(`chart duration/world not visible in HUD: ${JSON.stringify(report.game?.hud)}`);
    }
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    if (vite) killTree(vite);
    if (app) killTree(app);
    if (cdp) cdp.close();
    restoreSidecar();
    restoreLedger();
    report.restored = true;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5b1-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
