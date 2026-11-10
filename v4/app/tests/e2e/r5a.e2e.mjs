import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

const BACKUP = process.env.NEUROU_R5A_BACKUP
  ? path.resolve(process.env.NEUROU_R5A_BACKUP)
  : path.join(ROOT, 'quality-review', 'stage-5', 'r5a', path.basename(PROJECT) === 'r4f-8s' ? 'backup-fixture' : 'backup');
const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5a');
const AUDIO = path.join(PROJECT, 'media', 'stereo', '58798dbd9bacfa2f', 'audio.wav');
const MANIFEST = path.join(PROJECT, 'media', 'manifest.json');
const SIDECAR = path.join(PROJECT, 'charts', 'chart-w1.beats.json');

function backup() {
  fs.mkdirSync(BACKUP, { recursive: true });
  if (!fs.existsSync(path.join(BACKUP, 'audio.wav'))) fs.copyFileSync(AUDIO, path.join(BACKUP, 'audio.wav'));
  if (!fs.existsSync(path.join(BACKUP, 'manifest.json'))) fs.copyFileSync(MANIFEST, path.join(BACKUP, 'manifest.json'));
}

function restore() {
  fs.copyFileSync(path.join(BACKUP, 'audio.wav'), AUDIO);
  fs.copyFileSync(path.join(BACKUP, 'manifest.json'), MANIFEST);
  fs.rmSync(SIDECAR, { force: true });
}

function synthAudio() {
  const sampleRate = 48000;
  const seconds = 8;
  const frames = sampleRate * seconds;
  const data = Buffer.alloc(frames * 2);
  for (let beat = 0; beat < 16; beat += 1) {
    const start = Math.round(beat * 0.5 * sampleRate);
    const down = beat % 4 === 0;
    const frequency = down ? 80 : 1100;
    const amplitude = down ? 0.9 : 0.5;
    for (let offset = 0; offset < 0.035 * sampleRate; offset += 1) {
      const index = start + offset;
      if (index >= frames) break;
      const envelope = Math.exp(-offset / (0.009 * sampleRate));
      const value = amplitude * envelope * Math.sin((2 * Math.PI * frequency * offset) / sampleRate);
      data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value * 32767))), index * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  const wav = Buffer.concat([header, data]);
  fs.writeFileSync(AUDIO, wav);
  const sha = crypto.createHash('sha256').update(wav).digest('hex');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const asset of manifest.assets) {
    if (asset.kind === 'Audio') {
      asset.sha256 = sha;
      asset.bytes = wav.length;
      asset.durationMs = 8000;
      asset.audioChannels = 1;
      asset.sampleRate = sampleRate;
    }
  }
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function openProject(cdp) {
  await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000);
  for (const [x, y] of [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]]) {
    await cdp.evaluate(`(() => { const c=document.querySelector('.project-tree__canvas'); c?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'})); return !!c; })()`);
    await sleep(300);
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
  if (!await cdp.waitFor(`!![...document.querySelectorAll('.game-overlay__button')].find(b=>b.textContent?.includes('START'))`, 30_000)) {
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
  backup();
  synthAudio();
  fs.rmSync(SIDECAR, { force: true });
  const report = { analyze: null, hud: null, error: null, restored: false };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    vite = startVite();
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5a3=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await openEditor(cdp);
    await sleep(1000);
    await cdp.evaluate(`document.querySelector('.editor-beats-trigger')?.click()`);
    await cdp.waitFor(`!!document.querySelector('.editor-beats-panel')`, 3000);
    await cdp.evaluate(`(() => { const b=[...document.querySelectorAll('.editor-beats-panel button')].find(x=>x.textContent?.includes('Analyze Beats')); b?.click(); return !!b; })()`);
    await sleep(5000);
    report.analyze = await cdp.evaluate(`(() => ({
      text: document.querySelector('.editor-beats-panel')?.innerText ?? '',
      ready: (document.querySelector('.editor-beats-panel')?.innerText ?? '').includes('STATUS / READY'),
      sidecar: true,
    }))()`);
    report.analyze.sidecarExists = fs.existsSync(SIDECAR);
    await cdp.screenshot(path.join(EVIDENCE, 'editor-beats-ready.png'));

    await cdp.navigate('http://localhost:1420/?r5a3=1&mode=rhythm');
    await sleep(1200);
    await openProject(cdp);
    await enterWorld(cdp);
    await cdp.evaluate(`(() => {
      window.__R5A3_PULSE_LOG__=[];
      let last=false;
      const read=()=>{const el=document.querySelector('.game-hud__downbeat'); const on=!!el?.classList.contains('is-pulse'); if(on&&!last) window.__R5A3_PULSE_LOG__.push(Math.round(performance.now())); last=on;};
      new MutationObserver(read).observe(document.body,{subtree:true,attributes:true,childList:true});
      const b=[...document.querySelectorAll('.game-overlay__button')].find(x=>x.textContent?.includes('START'));
      b?.click(); return !!b;
    })()`);
    await sleep(3500);
    report.hud = await cdp.evaluate(`({
      beats: document.querySelector('.game-hud__beats')?.innerText ?? null,
      pulses: window.__R5A3_PULSE_LOG__ ?? [],
    })`);
    await cdp.screenshot(path.join(EVIDENCE, 'hud-downbeat.png'));
    if (!report.analyze.ready || !report.analyze.sidecarExists) throw new Error('analyze failed');
    if (!report.hud.beats || report.hud.pulses.length === 0) throw new Error('hud downbeat failed');
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    if (vite) killTree(vite);
    if (app) killTree(app);
    if (cdp) cdp.close();
    restore();
    report.restored = true;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5a-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
