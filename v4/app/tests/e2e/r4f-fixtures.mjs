import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { sleep } from './r4f-cdp.mjs';

export const ROOT = process.cwd();
export const APP_DIR = path.join(ROOT, 'v4', 'app');
export const DEMO_PROJECT = path.join(ROOT, 'v4', '.stereo-demo', 'project');
export const FIXTURE_PROJECT = path.join(ROOT, 'v4', '.stereo-demo', 'fixtures', 'r4f-8s');
export const FALLBACK_PROJECT = path.join(ROOT, 'v4', '.stereo-demo', 'fixtures', 'fallback-pair');
// 旧 R4f/R5a e2e 默认跑 8s 合成 fixture；新 R5b.2 e2e 通过 env 指向 demo project。
export const PROJECT = process.env.NEUROU_E2E_PROJECT
  ? path.resolve(process.env.NEUROU_E2E_PROJECT)
  : FIXTURE_PROJECT;
const USING_FIXTURE = path.resolve(PROJECT) === path.resolve(FIXTURE_PROJECT);
export const BACKUP = process.env.NEUROU_E2E_BACKUP
  ? path.resolve(process.env.NEUROU_E2E_BACKUP)
  : path.join(ROOT, 'quality-review', 'stage-4', 'r4f', USING_FIXTURE ? 'backup-fixture' : 'backup');
export const APP_EXE = path.join(APP_DIR, 'src-tauri', 'target', 'debug', 'neurou-app.exe');
export const VITE_URL = 'http://localhost:1420/';
export const EVIDENCE = path.join(ROOT, 'quality-review', 'stage-4', 'r4f', 'evidence');

const FILES = [
  'charts/chart-w1.editor.json',
  'charts/chart-w1.editor.json.bak',
  'charts/chart-w1.holds.json',
  'worlds/w1/ledger.ndjson',
  'worlds/w1/ledger.head.json',
];

function backupName(rel) {
  return rel.replace(/[\\/]/g, '__');
}

export function ensureDirs() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(BACKUP, { recursive: true });
}

export function snapshotFixture() {
  ensureDirs();
  for (const rel of FILES) {
    const source = path.join(PROJECT, rel);
    const target = path.join(BACKUP, backupName(rel));
    // Phase 0 backup is immutable; repeated e2e runs must not overwrite it with
    // a ledger created by a previous run.
    if (fs.existsSync(target) || fs.existsSync(`${target}.absent`)) continue;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      fs.rmSync(`${target}.absent`, { force: true });
    } else {
      fs.writeFileSync(`${target}.absent`, 'absent at snapshot');
      fs.rmSync(target, { force: true });
    }
  }
}

export function cleanLedger() {
  for (const rel of ['worlds/w1/ledger.ndjson', 'worlds/w1/ledger.head.json']) {
    fs.rmSync(path.join(PROJECT, rel), { force: true });
  }
  fs.mkdirSync(path.join(PROJECT, 'worlds', 'w1'), { recursive: true });
}

export function restoreFixture() {
  for (const rel of FILES) {
    const source = path.join(PROJECT, rel);
    const target = path.join(BACKUP, backupName(rel));
    if (fs.existsSync(`${target}.absent`)) {
      fs.rmSync(source, { force: true });
    } else if (fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.copyFileSync(target, source);
    }
  }
}

export function fixtureHashes() {
  return Object.fromEntries(FILES.map((rel) => {
    const source = path.join(PROJECT, rel);
    return [rel, fs.existsSync(source)
      ? crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
      : null];
  }));
}

export function readChart() {
  const raw = JSON.parse(fs.readFileSync(
    path.join(PROJECT, 'charts', 'chart-w1.editor.json'),
    'utf8',
  ));
  const notes = raw.tracks.flatMap((track) => track.keyframes
    .filter((keyframe) => keyframe.durationMs !== undefined)
    .map((keyframe) => ({
      timeMs: keyframe.timeMs,
      durationMs: keyframe.durationMs,
      chartLayerIndex: keyframe.chartLayerIndex,
      gridCellId: keyframe.gridCellId,
    })))
    .sort((a, b) => a.timeMs - b.timeMs);
  return { chartId: raw.chartId, durationMs: raw.durationMs, notes };
}

export const KEY_BY_CELL = {
  1: 'Digit1', 2: 'Digit4', 3: 'Digit7', 4: 'Digit0',
  5: 'KeyA', 6: 'KeyF', 7: 'KeyJ', 8: 'Semicolon',
};

export function keyForNote(note) {
  if (note.chartLayerIndex === 1) return 'Space';
  if (note.chartLayerIndex === 2 && note.gridCellId !== null) {
    return KEY_BY_CELL[note.gridCellId];
  }
  return null;
}

export function ledgerInfo() {
  const ledger = path.join(PROJECT, 'worlds', 'w1', 'ledger.ndjson');
  const headPath = path.join(PROJECT, 'worlds', 'w1', 'ledger.head.json');
  const lines = fs.existsSync(ledger)
    ? fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter(Boolean)
    : [];
  const head = fs.existsSync(headPath)
    ? JSON.parse(fs.readFileSync(headPath, 'utf8'))
    : null;
  const expectedHash = lines.length === 0
    ? crypto.createHash('sha256').update('').digest('hex')
    : crypto.createHash('sha256').update(`${lines.join('\n')}\n`).digest('hex');
  return {
    lines,
    head,
    valid: head !== null
      && head.eventCount === lines.length
      && head.checksum === expectedHash,
  };
}

export async function waitForHttp(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // retry
    }
    await sleep(250);
  }
  return false;
}

export function startVite(projectRoot = PROJECT) {
  const env = {
    ...process.env,
    VITE_NEUROU_PROJECT_ROOT: projectRoot,
  };
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'npm run dev'], {
      cwd: APP_DIR,
      env,
      stdio: 'ignore',
      windowsHide: true,
    });
    return child;
  }
  return spawn('npm', ['run', 'dev'], {
    cwd: APP_DIR,
    env,
    stdio: 'ignore',
  });
}

export function startApp() {
  const env = {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
  };
  return spawn(APP_EXE, [], {
    cwd: path.join(APP_DIR, 'src-tauri'),
    env,
    stdio: 'ignore',
    windowsHide: false,
  });
}

export function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill();
}

export function addFirewallRule() {
  const result = spawnSync('netsh', [
    'advfirewall', 'firewall', 'add', 'rule',
    'name=NeurouR4fE2EBlock',
    'dir=out',
    'action=block',
    `program=${APP_EXE}`,
    'enable=yes',
    'profile=any',
    'remoteip=1.0.0.0-126.255.255.255,128.0.0.0-255.255.255.255',
  ], { stdio: 'ignore' });
  return result.status === 0;
}

export function removeFirewallRule() {
  spawnSync('netsh', [
    'advfirewall', 'firewall', 'delete', 'rule',
    'name=NeurouR4fE2EBlock',
  ], { stdio: 'ignore' });
}

export async function typeConsoleCommand(cdp, command) {
  const expression = `(() => {
    const input = document.querySelector('.project-console input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(command)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', bubbles: true,
    }));
    return true;
  })()`;
  return cdp.evaluate(expression);
}

export async function hudCounts(cdp) {
  return cdp.evaluate(`(() => {
    const count = (selector) => Number(document.querySelector(selector)?.textContent ?? '-1');
    return {
      perfect: count('.game-hud .is-perfect b'),
      good: count('.game-hud .is-good b'),
      miss: count('.game-hud .is-miss b'),
      combo: count('.game-hud .game-hud__combo strong'),
      time: document.querySelector('.game-hud__bottom > span')?.textContent ?? '',
      complete: (document.querySelector('.game-overlay h1')?.textContent ?? '').includes('CHART COMPLETE'),
    };
  })()`);
}

export async function hudTimeMs(cdp) {
  const text = await cdp.evaluate(
    `document.querySelector('.game-hud__bottom > span')?.textContent ?? ''`,
  );
  const match = /^(\d+)\.(\d{3})$/.exec(String(text).trim());
  return match ? Number(match[1]) * 1000 + Number(match[2]) : null;
}

export async function waitForGameReady(cdp, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await cdp.evaluate(`(() => {
      const button = [...document.querySelectorAll('.game-overlay__button')]
        .find((candidate) => candidate.textContent?.includes('START'));
      return !!button;
    })()`);
    if (ready) return true;
    await sleep(250);
  }
  return false;
}
