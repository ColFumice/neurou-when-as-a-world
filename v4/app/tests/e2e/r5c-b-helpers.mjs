import fs from 'node:fs';
import path from 'node:path';
import {
  FIXTURE_PROJECT,
  PROJECT,
  ledgerInfo,
  restoreFixture,
  snapshotFixture,
  typeConsoleCommand,
} from './r4f-fixtures.mjs';
import { sleep } from './r4f-cdp.mjs';

export { FIXTURE_PROJECT, PROJECT, ledgerInfo, restoreFixture, snapshotFixture };

export async function openProjectConsole(cdp) {
  if (!await cdp.waitFor(`!!document.querySelector('.project-tree__canvas')`, 20_000)) {
    throw new Error('project tree timeout');
  }
  const candidates = [[240, 370], [260, 400], [300, 420], [220, 350], [320, 450]];
  for (const [x, y] of candidates) {
    await cdp.evaluate(`(() => {
      const canvas=document.querySelector('.project-tree__canvas');
      canvas?.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'mouse'}));
      return !!canvas;
    })()`);
    await sleep(300);
    await cdp.mouseClick(x, y);
    await sleep(120);
    await cdp.mouseClick(x, y);
    if (await cdp.waitFor(`!!document.querySelector('.project-console')`, 2500)) return;
  }
  throw new Error('project console did not open');
}

export async function enterWorldExplore(cdp) {
  const typed = await typeConsoleCommand(cdp, 'cd w1');
  if (!typed) throw new Error('console input missing');
  if (!await cdp.waitFor(`!!document.querySelector('.game-screen')`, 30_000)) {
    throw new Error('game screen timeout');
  }
  if (!await cdp.waitFor(`!!document.querySelector('.game-explore')`, 15_000)) {
    throw new Error('explore HUD timeout');
  }
}

/** 给 8s fixture 的 NEU 图加一个 Explore 时间根控制节点。 */
export function seedControlModule(options = {}) {
  const atMs = options.atMs ?? 800;
  const moduleId = options.moduleId ?? 'r5c-b-enter';
  const action = options.action ?? 'EnterRhythmMode';
  const chartPath = path.join(PROJECT, 'charts', 'chart-w1.editor.json');
  const chart = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
  chart.neuModules = (chart.neuModules ?? []).filter((module) => module.moduleId !== moduleId);
  chart.neuModules.push({
    moduleId,
    type: action,
    x: 0.5,
    y: 0.5,
    params: action === 'PlayCutscene'
      ? { cutsceneId: options.cutsceneId ?? 'cs-intro', atMs, sourceId: 'e2e' }
      : { chartId: chart.chartId, atMs, sourceId: 'e2e' },
    inputs: [],
    outputs: [],
  });
  fs.writeFileSync(chartPath, `${JSON.stringify(chart, null, 2)}\n`);
}

export function seedCutscene(cutsceneId = 'cs-intro', options = {}) {
  const dir = path.join(PROJECT, 'cutscenes');
  fs.mkdirSync(dir, { recursive: true });
  const definition = {
    schemaVersion: 1,
    cutsceneId,
    durationMs: options.durationMs ?? 1800,
    video: null,
    audio: null,
    subtitles: [
      { startMs: 0, endMs: 900, text: '雨夜，先停一下。' },
      { startMs: 900, endMs: 1800, text: '然后继续探索。' },
    ],
    skippable: true,
    skipAfterMs: options.skipAfterMs ?? 100,
    endAction: 'ReturnToExplore',
  };
  fs.writeFileSync(path.join(dir, `${cutsceneId}.json`), `${JSON.stringify(definition, null, 2)}\n`);
}

export async function waitForText(cdp, selector, text, timeoutMs) {
  return cdp.waitFor(`(() => {
    const element=document.querySelector(${JSON.stringify(selector)});
    return (element?.innerText ?? '').includes(${JSON.stringify(text)});
  })()`, timeoutMs);
}
