import fs from 'node:fs';
import path from 'node:path';
import {
  FIXTURE_PROJECT,
  ROOT,
  cleanLedger,
  killTree,
  startApp,
  startVite,
  waitForHttp,
} from './r4f-fixtures.mjs';
import { CdpClient, sleep } from './r4f-cdp.mjs';
import {
  enterWorldExplore,
  ledgerInfo,
  openProjectConsole,
  restoreFixture,
  seedControlModule,
  snapshotFixture,
} from './r5c-b-helpers.mjs';

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5c-b', 'evidence');

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  snapshotFixture();
  cleanLedger();
  seedControlModule({ atMs: 800 });
  const report = { startedAt: new Date().toISOString(), error: null };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    vite = startVite(FIXTURE_PROJECT);
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5c-b=explore&mode=explore');
    await sleep(1500);
    await openProjectConsole(cdp);
    await enterWorldExplore(cdp);

    report.explore = await cdp.evaluate(`(() => ({
      href: location.href,
      hud: !!document.querySelector('.game-explore'),
      grid: !!document.querySelector('.game-grid'),
      start: [...document.querySelectorAll('.game-overlay__button')].some((b)=>b.textContent?.includes('START')),
      score: !!document.querySelector('.game-hud'),
      text: document.querySelector('.game-explore')?.innerText ?? '',
    }))()`);

    if (!await cdp.waitFor(`!!document.querySelector('.game-hud')`, 12_000)) {
      throw new Error('NEU EnterRhythm did not reach Rhythm');
    }
    report.rhythm = await cdp.evaluate(`(() => ({
      grid: !!document.querySelector('.game-grid'),
      hud: !!document.querySelector('.game-hud'),
      start: [...document.querySelectorAll('.game-overlay__button')].some((b)=>b.textContent?.includes('START')),
    }))()`);
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-b-explore-rhythm.png'));

    if (!await cdp.waitFor(`!![...document.querySelectorAll('.game-overlay__button')].find((b)=>b.textContent?.includes('RETURN TO EXPLORE'))`, 20_000)) {
      throw new Error('natural completion did not reach result');
    }
    report.result = await cdp.evaluate(`document.querySelector('.game-overlay')?.innerText ?? ''`);
    await cdp.evaluate(`(() => {
      const b=[...document.querySelectorAll('.game-overlay__button')].find((x)=>x.textContent?.includes('RETURN TO EXPLORE'));
      b?.click();
      return !!b;
    })()`);
    if (!await cdp.waitFor(`!!document.querySelector('.game-explore')`, 5000)) {
      throw new Error('did not return to Explore');
    }
    await sleep(300);
    report.returned = await cdp.evaluate(`(() => ({
      explore: !!document.querySelector('.game-explore'),
      grid: !!document.querySelector('.game-grid'),
      hud: !!document.querySelector('.game-hud'),
    }))()`);
    const ledger = ledgerInfo();
    report.ledger = { lines: ledger.lines.length, valid: ledger.valid };
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-b-explore-return.png'));
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    restoreFixture();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5c-b-explore-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
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
