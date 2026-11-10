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
  seedCutscene,
  snapshotFixture,
} from './r5c-b-helpers.mjs';

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5c-b', 'evidence');
const CUTSCENE_PATH = path.join(FIXTURE_PROJECT, 'cutscenes', 'cs-intro.json');

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  snapshotFixture();
  cleanLedger();
  seedCutscene('cs-intro', { durationMs: 3000, skipAfterMs: 100 });
  seedControlModule({ action: 'PlayCutscene', cutsceneId: 'cs-intro', atMs: 800 });
  const report = { startedAt: new Date().toISOString(), error: null };
  let vite = null;
  let app = null;
  let cdp = null;
  try {
    vite = startVite(FIXTURE_PROJECT);
    if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite timeout');
    app = startApp();
    cdp = await CdpClient.connect();
    await cdp.navigate('http://localhost:1420/?r5c-b=cutscene&mode=explore');
    await sleep(1500);
    await openProjectConsole(cdp);
    await enterWorldExplore(cdp);
    if (!await cdp.waitFor(`!!document.querySelector('.game-cutscene')`, 10_000)) {
      throw new Error('cutscene overlay did not open');
    }
    report.playing = await cdp.evaluate(`(() => ({
      id: document.querySelector('.game-cutscene')?.getAttribute('data-cutscene-id') ?? null,
      text: document.querySelector('.game-cutscene')?.innerText ?? '',
      explore: !!document.querySelector('.game-explore'),
      grid: !!document.querySelector('.game-grid'),
    }))()`);
    await sleep(350);
    report.skip = await cdp.evaluate(`(() => {
      const b=document.querySelector('.game-cutscene__skip');
      return { exists: !!b, disabled: b?.disabled ?? null, text: b?.textContent ?? null };
    })()`);
    await cdp.evaluate(`document.querySelector('.game-cutscene__skip')?.click()`);
    if (!await cdp.waitFor(`!!document.querySelector('.game-explore')`, 5000)) {
      throw new Error('did not return to Explore after cutscene skip');
    }
    await sleep(300);
    const ledger = ledgerInfo();
    report.returned = await cdp.evaluate(`(() => ({
      explore: !!document.querySelector('.game-explore'),
      cutscene: !!document.querySelector('.game-cutscene'),
      grid: !!document.querySelector('.game-grid'),
    }))()`);
    report.ledger = { lines: ledger.lines.length, valid: ledger.valid };
    await cdp.screenshot(path.join(EVIDENCE, 'r5c-b-cutscene-return.png'));

    // 未定义 cutscene：只告警，不崩溃、不写账本。
    seedControlModule({ action: 'PlayCutscene', cutsceneId: 'missing-cutscene', atMs: 800 });
    await cdp.navigate('http://localhost:1420/?r5c-b=cutscene-missing&mode=explore');
    await sleep(900);
    await openProjectConsole(cdp);
    await enterWorldExplore(cdp);
    await sleep(1800);
    report.unknown = await cdp.evaluate(`(() => ({
      explore: !!document.querySelector('.game-explore'),
      cutscene: !!document.querySelector('.game-cutscene'),
      text: document.querySelector('.game-explore__notice')?.textContent ?? '',
    }))()`);
    const ledgerAfterUnknown = ledgerInfo();
    report.ledgerAfterUnknown = {
      lines: ledgerAfterUnknown.lines.length,
      valid: ledgerAfterUnknown.valid,
    };
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    restoreFixture();
    fs.rmSync(CUTSCENE_PATH, { force: true });
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, 'r5c-b-cutscene-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
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
