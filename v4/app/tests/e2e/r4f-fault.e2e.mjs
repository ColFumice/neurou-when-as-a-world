import fs from 'node:fs';
import path from 'node:path';
import {
  APP_EXE,
  EVIDENCE,
  PROJECT,
  ROOT,
  cleanLedger,
  ensureDirs,
  fixtureHashes,
  hudCounts,
  killTree,
  ledgerInfo,
  restoreFixture,
  snapshotFixture,
  startApp,
  startVite,
  waitForGameReady,
  waitForHttp,
} from './r4f-fixtures.mjs';
import { CdpClient, sleep } from './r4f-cdp.mjs';

const REPORT = path.join(ROOT, 'quality-review', 'stage-4', 'r4f', 'evidence', 'fault-e2e.json');

function writeCorruptLedger() {
  fs.mkdirSync(path.join(PROJECT, 'worlds', 'w1'), { recursive: true });
  fs.writeFileSync(path.join(PROJECT, 'worlds', 'w1', 'ledger.ndjson'), '');
  fs.writeFileSync(path.join(PROJECT, 'worlds', 'w1', 'ledger.head.json'), JSON.stringify({
    schemaVersion: 1,
    eventCount: 1,
    lastEventId: 'fake',
    positionSum: new Array(20).fill(0),
    checksum: 'deliberately-wrong',
  }, null, 2));
}

function writeBadSidecars() {
  fs.writeFileSync(path.join(PROJECT, 'charts', 'chart-w1.traces.json'), '{ bad json');
  fs.writeFileSync(path.join(PROJECT, 'charts', 'chart-w1.triggers.json'), JSON.stringify({
    schemaVersion: 2,
    chartId: 'wrong-chart',
    entries: [],
  }));
}

async function openProject(cdp) {
  await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000);
  for (const [x, y] of [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]]) {
    await cdp.evaluate(`(() => { const c=document.querySelector('.project-tree__canvas'); c?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'})); return !!c; })()`);
    await sleep(300);
    await cdp.mouseClick(x, y);
    await sleep(100);
    await cdp.mouseClick(x, y);
    if (await cdp.waitFor(`!!document.querySelector('.project-console')`, 2500)) return true;
  }
  return false;
}

async function main() {
  ensureDirs();
  snapshotFixture();
  const beforeHashes = fixtureHashes();
  cleanLedger();
  writeCorruptLedger();
  writeBadSidecars();
  const ledgerBytesBefore = fs.readFileSync(path.join(PROJECT, 'worlds', 'w1', 'ledger.ndjson'));
  const report = { firewall: false, game: false, ledgerHud: false, sidecarWarning: false, processKill: false, error: null };
  let vite = null;
  let app = null;
  let cdp = null;
  let appPid = null;
  try {
    vite = startVite();
    if (!(await waitForHttp('http://localhost:1420/', 30_000))) throw new Error('vite failed');
    app = startApp();
    appPid = app.pid;
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r4f=fault&mode=rhythm');
    await sleep(1200);
    if (!(await openProject(cdp))) throw new Error('project console failed');
    const typed = await cdp.evaluate(`(() => {
      const input=document.querySelector('.project-console input');
      if(!input) return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(input,'cd w1');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
      return true;
    })()`);
    if (!typed) throw new Error('console missing');
    report.game = await waitForGameReady(cdp, 30_000);
    if (!report.game) throw new Error('game not ready');
    const hud = await cdp.evaluate(`({
      ledger: document.querySelector('.game-hud__ledger')?.textContent ?? '',
      warning: document.querySelector('.game-hud__warning')?.textContent ?? '',
      screen: !!document.querySelector('.game-screen'),
    })`);
    report.ledgerHud = hud.ledger.includes('LEDGER / CORRUPT');
    report.sidecarWarning = hud.warning.length > 0 || !(await cdp.evaluate(`!document.querySelector('.game-screen')`));
    report.counts = await hudCounts(cdp);
    await cdp.screenshot(path.join(EVIDENCE, 'fault-ledger-corrupt.png'));
    const ledgerBytesAfter = fs.readFileSync(path.join(PROJECT, 'worlds', 'w1', 'ledger.ndjson'));
    report.ledgerUnchanged = ledgerBytesBefore.equals(ledgerBytesAfter);

    // 快速 /edit：用真实键盘事件打开 game command，再提交一次 /edit。
    await cdp.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', {
      key: '/', code: 'Slash', bubbles: true,
    }))`);
    const commandOpen = await cdp.waitFor(`!!document.querySelector('.game-command input')`, 3000);
    if (commandOpen) {
      await cdp.evaluate(`(() => {
        const input=document.querySelector('.game-command input');
        if(!input) return false;
        const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        setter.call(input,'/edit');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        for (let index = 0; index < 20; index += 1) {
          input.dispatchEvent(new KeyboardEvent('keydown',{
            key:'Enter', code:'Enter', bubbles:true,
          }));
        }
        input.form?.requestSubmit();
        return true;
      })()`);
      await sleep(1600);
    }
    report.rapidEdit = await cdp.evaluate(`({
      commandOpen: ${commandOpen ? 'true' : 'false'},
      editors: document.querySelectorAll('.editor-screen').length,
      games: document.querySelectorAll('.game-screen').length,
    })`);

    // 模拟 Tauri 后端不可用：只影响页面内 invoke，窗口/前端应显示错误/fallback。
    await cdp.addInitScript('window.__R4F_FAIL_INVOKE__ = true;');
    await cdp.navigate('http://localhost:1420/?r4f=fault&mode=rhythm');
    await sleep(1200);
    const failureProjectOpen = await openProject(cdp);
    if (failureProjectOpen) {
      await cdp.evaluate(`(() => {
        const input=document.querySelector('.project-console input');
        if(!input) return false;
        const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        setter.call(input,'cd w1');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
        return true;
      })()`);
      await sleep(15_000);
    }
    report.tauriFailure = await cdp.evaluate(`(() => ({
      body: document.body.innerText.slice(0, 800),
      screen: !!document.querySelector('.game-screen') || !!document.querySelector('.game-overlay'),
      errorText: document.querySelector('.game-overlay__warning')?.textContent ?? '',
      blank: document.body.innerText.trim().length === 0,
    }))()`);
    report.tauriFailure.projectOpen = failureProjectOpen;
    await cdp.screenshot(path.join(EVIDENCE, 'fault-tauri-unavailable.png'));

    // Rust 进程死亡：只验证进程被清理，不承诺窗口/前端存活。
    killTree(app);
    app = null;
    await sleep(2000);
    try {
      if (appPid === null) throw new Error('no pid');
      process.kill(appPid, 0);
      report.processKill = false;
    } catch {
      report.processKill = true;
    }
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    try { if (cdp) await cdp.screenshot(path.join(EVIDENCE, 'fault-error.png')); } catch { /* ignore */ }
    throw error;
  } finally {
    if (vite) killTree(vite);
    if (app) killTree(app);
    if (cdp) cdp.close();
    restoreFixture();
    fs.rmSync(path.join(PROJECT, 'charts', 'chart-w1.traces.json'), { force: true });
    fs.rmSync(path.join(PROJECT, 'charts', 'chart-w1.triggers.json'), { force: true });
    report.restored = JSON.stringify(beforeHashes) === JSON.stringify(fixtureHashes());
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
