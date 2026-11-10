import fs from 'node:fs';
import path from 'node:path';
import {
  APP_EXE,
  EVIDENCE,
  ROOT,
  addFirewallRule,
  cleanLedger,
  ensureDirs,
  fixtureHashes,
  hudCounts,
  hudTimeMs,
  keyForNote,
  killTree,
  ledgerInfo,
  readChart,
  removeFirewallRule,
  restoreFixture,
  snapshotFixture,
  startApp,
  startVite,
  typeConsoleCommand,
  waitForGameReady,
  waitForHttp,
} from './r4f-fixtures.mjs';
import { CdpClient, sleep } from './r4f-cdp.mjs';

const REPORT = path.join(ROOT, 'quality-review', 'stage-4', 'r4f', 'evidence', 'e2e-run.json');

function log(message) {
  console.log(`[r4f-e2e] ${message}`);
}

async function openProjectConsole(cdp) {
  await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000);
  // Pixi 节点会轻微漂移；以左侧 chromato 附近的候选点做有限探测，仍走真实 UI。
  const candidates = [
    [240, 370], [260, 400], [300, 420], [220, 350], [320, 450],
  ];
  for (const [x, y] of candidates) {
    await cdp.evaluate(`(() => {
      const canvas = document.querySelector('.project-tree__canvas');
      canvas?.dispatchEvent(new PointerEvent('pointermove', {
        clientX: ${x}, clientY: ${y}, bubbles: true, pointerId: 1, pointerType: 'mouse',
      }));
      return !!canvas;
    })()`);
    await sleep(350);
    await cdp.mouseClick(x, y);
    await sleep(120);
    await cdp.mouseClick(x, y);
    const opened = await cdp.waitFor(`!!document.querySelector('.project-console')`, 3000);
    if (opened) return;
  }
  throw new Error('project console did not open');
}

async function enterWorld(cdp) {
  const typed = await typeConsoleCommand(cdp, 'cd w1');
  if (!typed) throw new Error('console input missing');
  const ready = await waitForGameReady(cdp, 30_000);
  if (!ready) throw new Error('game did not reach ready');
}

async function closeWorldView(cdp) {
  const hasWorld = await cdp.evaluate(`!!document.querySelector('.project-console__world')`);
  if (!hasWorld) return true;
  await cdp.key('Slash', 'keyDown');
  await cdp.key('Slash', 'keyUp');
  const opened = await cdp.waitFor(`!!document.querySelector('.project-console__world-command input')`, 5000);
  if (!opened) return false;
  const result = await cdp.evaluate(`(() => {
    const input = document.querySelector('.project-console__world-command input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'exit');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', bubbles: true,
    }));
    return true;
  })()`);
  if (!result) return false;
  return cdp.waitFor(`!document.querySelector('.project-console__world')`, 10_000);
}

async function leaveToTree(cdp) {
  if (await cdp.evaluate(`!!document.querySelector('.project-tree__canvas')`)) return true;
  await closeWorldView(cdp);
  const typed = await typeConsoleCommand(cdp, 'exit');
  if (typed && await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 4000)) {
    return true;
  }
  // ProjectConsole 的 Escape 是 onExit；作为 UI 路径的回退。
  await cdp.key('Escape', 'keyDown');
  await cdp.key('Escape', 'keyUp');
  return cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 6000);
}

async function releaseKey(cdp, code, delayMs) {
  await sleep(delayMs);
  try {
    await cdp.key(code, 'keyUp');
  } catch {
    // page can unmount after completion
  }
}

async function playAttempt(cdp, chart) {
  const clicked = await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.game-overlay__button')]
      .find((candidate) => candidate.textContent?.includes('START'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error('START button missing');

  const fired = new Set();
  const started = Date.now();
  let nextNoteIndex = 0;
  while (Date.now() - started < 20_000 && fired.size < chart.notes.length) {
    const time = await hudTimeMs(cdp);
    if (time === null) {
      await sleep(20);
      continue;
    }
    // HUD 在 1.2s 预滚期间也显示 000.000；首 note 必须等时钟真正进入 >=0 后再打。
    if (time <= 0) {
      await sleep(8);
      continue;
    }
    while (nextNoteIndex < chart.notes.length) {
      const note = chart.notes[nextNoteIndex];
      if (time < note.timeMs - 20) break;
      if (time > note.timeMs + 150) {
        fired.add(nextNoteIndex);
        nextNoteIndex += 1;
        continue;
      }
      const key = keyForNote(note);
      if (key === null) {
        // Layer 3+：FullScreen pointer note；点击画面中心。
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: 640, y: 400,
        });
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mousePressed', x: 640, y: 400, button: 'left', clickCount: 1,
        });
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: 640, y: 400, button: 'left', clickCount: 1,
        });
      } else {
        await cdp.key(key, 'keyDown');
        const releaseDelay = note.durationMs > 0 ? note.durationMs + 100 : 30;
        void releaseKey(cdp, key, releaseDelay);
      }
      fired.add(nextNoteIndex);
      nextNoteIndex += 1;
    }
    await sleep(8);
  }

  const completed = await cdp.waitFor(
    `(document.querySelector('.game-overlay h1')?.textContent ?? '').includes('CHART COMPLETE')`,
    15_000,
  );
  const counts = await hudCounts(cdp);
  return { completed, counts, fired: fired.size };
}

async function retryFromCompleted(cdp) {
  const clicked = await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.game-overlay__button, .game-exit')]
      .find((candidate) => candidate.textContent?.includes('BACK') || candidate.className === 'game-exit');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) return false;
  await sleep(1000);
  return closeWorldView(cdp);
}

async function reopenRhythm(cdp) {
  await cdp.navigate('http://localhost:1420/?r4f=1&mode=rhythm');
  await sleep(1000);
  await openProjectConsole(cdp);
  await enterWorld(cdp);
}

async function main() {
  ensureDirs();
  const beforeHashes = fixtureHashes();
  snapshotFixture();
  cleanLedger();
  const firewall = addFirewallRule();
  const report = {
    startedAt: new Date().toISOString(),
    firewall,
    attempts: [],
    externalRequests: [],
    ledger: null,
    restored: false,
    error: null,
  };

  let vite = null;
  let app = null;
  let cdp = null;
  try {
    log('starting Vite and Tauri');
    vite = startVite();
    if (!(await waitForHttp('http://localhost:1420/', 30_000))) {
      throw new Error('Vite did not start');
    }
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r4f=1&mode=rhythm');
    await sleep(1500);

    await openProjectConsole(cdp);
    await enterWorld(cdp);
    const chart = readChart();
    log(`chart ${chart.chartId}, ${chart.notes.length} notes`);

    let success = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await playAttempt(cdp, chart);
      report.attempts.push({ attempt, ...result });
      log(`attempt ${attempt}: perfect=${result.counts.perfect} good=${result.counts.good} miss=${result.counts.miss} complete=${result.completed}`);
      if (result.counts.perfect === chart.notes.length
        && result.counts.good === 0
        && result.counts.miss === 0
        && result.completed) {
        success = result;
        break;
      }
      if (attempt < 3 && result.completed) {
        const returned = await retryFromCompleted(cdp);
        if (!returned) break;
        // R5c-B-patch: closeGame 已重置 Explore；二次进入必须显式带 query。
        await reopenRhythm(cdp);
      }
    }

    report.externalRequests = cdp.externalRequests();
    if (!success) {
      await cdp.screenshot(path.join(EVIDENCE, 'e2e-failed.png'));
      throw new Error(`perfect run failed after ${report.attempts.length} attempt(s)`);
    }

    const ledger = ledgerInfo();
    report.ledger = {
      lines: ledger.lines.length,
      valid: ledger.valid,
      head: ledger.head,
    };
    if (ledger.lines.length !== 1 || !ledger.valid) {
      await cdp.screenshot(path.join(EVIDENCE, 'e2e-ledger-invalid.png'));
      throw new Error(`ledger invalid: ${JSON.stringify(report.ledger)}`);
    }

    // 重开第二轮：只验证 PremiereRecorded 不重复写；不把第二次结果当作首次成功。
    await retryFromCompleted(cdp);
    await cdp.navigate('http://localhost:1420/?r4f=1&mode=rhythm');
    await sleep(1000);
    await openProjectConsole(cdp);
    await enterWorld(cdp);
    const second = await playAttempt(cdp, chart);
    report.attempts.push({ attempt: 'reopen', ...second });
    const ledgerAfter = ledgerInfo();
    report.ledgerAfterReopen = {
      lines: ledgerAfter.lines.length,
      valid: ledgerAfter.valid,
    };
    if (ledgerAfter.lines.length !== 1 || !ledgerAfter.valid) {
      throw new Error(`ledger changed on reopen: ${ledgerAfter.lines.length}`);
    }

    await cdp.screenshot(path.join(EVIDENCE, 'e2e-completed.png'));
    await retryFromCompleted(cdp);
    report.treeVisible = await leaveToTree(cdp);
    log(`ledger lines=${ledgerAfter.lines.length}, valid=${ledgerAfter.valid}, treeVisible=${report.treeVisible}`);
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    try {
      if (cdp) {
        report.externalRequests = cdp.externalRequests();
        await cdp.screenshot(path.join(EVIDENCE, 'e2e-error.png'));
      }
    } catch {
      // best effort
    }
    throw error;
  } finally {
    if (vite) killTree(vite);
    if (app) killTree(app);
    if (cdp) cdp.close();
    removeFirewallRule();
    restoreFixture();
    report.restored = JSON.stringify(beforeHashes) === JSON.stringify(fixtureHashes());
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    log(`report ${REPORT} restored=${report.restored}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
