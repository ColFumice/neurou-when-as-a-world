import fs from 'node:fs';
import path from 'node:path';
import {
  FIXTURE_PROJECT,
  ROOT,
  killTree,
  startApp,
  startVite,
  waitForHttp,
} from '../../../v4/app/tests/e2e/r4f-fixtures.mjs';
import { CdpClient, sleep } from '../../../v4/app/tests/e2e/r4f-cdp.mjs';

const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-5', 'r5c-b', 'evidence');
fs.mkdirSync(EVIDENCE, { recursive: true });
let vite;
let app;
let cdp;
try {
  vite = startVite(FIXTURE_PROJECT);
  if (!await waitForHttp('http://localhost:1420/', 30_000)) throw new Error('vite');
  app = startApp();
  cdp = await CdpClient.connect();
  await cdp.send('Runtime.enable');
  await cdp.navigate('http://localhost:1420/?mode=rhythm#game');
  await sleep(1500);
  if (!await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 15_000)) throw new Error('tree');
  for (const [x, y] of [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]]) {
    await cdp.evaluate(`(() => { const c=document.querySelector('.project-tree__canvas'); c?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'})); return !!c; })()`);
    await sleep(200);
    await cdp.mouseClick(x, y);
    await sleep(100);
    await cdp.mouseClick(x, y);
    if (await cdp.waitFor(`!!document.querySelector('.project-console')`, 2000)) break;
  }
  await cdp.evaluate(`(() => {
    const input=document.querySelector('.project-console input');
    if(!input) return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'cd w1');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
    return true;
  })()`);
  await sleep(6000);
  const info = await cdp.evaluate(`(() => ({
    href: location.href,
    body: document.body.innerText.slice(0, 3500),
    game: !!document.querySelector('.game-screen'),
    explore: !!document.querySelector('.game-explore'),
    overlay: document.querySelector('.game-overlay')?.innerText ?? null,
    buttons: [...document.querySelectorAll('.game-overlay__button')].map((b)=>b.textContent),
  }))()`);
  console.log(JSON.stringify(info, null, 2));
  const exceptions = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown');
  const logs = cdp.events.filter((event) => event.method === 'Runtime.consoleAPICalled');
  console.log('EXCEPTIONS', JSON.stringify(exceptions.slice(-8), null, 2));
  console.log('LOGS', JSON.stringify(logs.slice(-8), null, 2));
  await cdp.screenshot(path.join(EVIDENCE, 'debug-rhythm.png'));
} finally {
  if (cdp) cdp.close();
  if (app) killTree(app);
  if (vite) killTree(vite);
}
