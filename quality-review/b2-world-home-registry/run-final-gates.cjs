'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const out = path.join(__dirname, 'final-gates');
fs.mkdirSync(out, { recursive: true });
async function run(script) {
  const startedAt = new Date().toISOString();
  const result = await new Promise(resolve => {
    const process = cp.spawn('cmd.exe', ['/d', '/s', '/c', 'npm run ' + script],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    process.stdout.on('data', data => stdout.push(data));
    process.stderr.on('data', data => stderr.push(data));
    process.on('error', error => stderr.push(Buffer.from(String(error))));
    process.on('close', exitCode => resolve({ exitCode, bytes: Buffer.concat([...stdout, ...stderr]) }));
  });
  const log = script.replace('check:', 'check-') + '.log';
  fs.writeFileSync(path.join(out, log), result.bytes);
  const raw = result.bytes.toString('utf8');
  return { command: 'npm run ' + script, startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.exitCode, pass: result.exitCode === 0, log: 'final-gates/' + log,
    summary: raw.split(/\r?\n/).filter(line => /扫描:|汇总:|error TS/.test(line)) };
}
Promise.all(['check:naming', 'typecheck', 'check:dependencies'].map(run)).then(runs => {
  const report = { schemaVersion: 1, phase: 'B2.4b final implementation', generatedAt: new Date().toISOString(),
    pass: runs.every(run => run.pass), runs,
    validationLimit: 'Static gates. Two logical-device contracts are separate; no external service or Cocos acceptance is claimed.' };
  fs.writeFileSync(path.join(__dirname, 'gate-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
