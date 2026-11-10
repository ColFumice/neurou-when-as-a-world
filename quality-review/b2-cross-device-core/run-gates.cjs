'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const phase = process.argv[2] || 'baseline';
if (!['baseline', 'final'].includes(phase)) throw new Error('Phase must be baseline or final');
const out = path.join(__dirname, phase + '-gates');
fs.mkdirSync(out, {recursive: true});
async function run(script) {
  const startedAt = new Date().toISOString();
  const result = await new Promise(resolve => {
    const child = cp.spawn('cmd.exe', ['/d', '/s', '/c', 'npm run ' + script], {cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    const chunks = [];
    child.stdout.on('data', data => chunks.push(data));
    child.stderr.on('data', data => chunks.push(data));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => resolve({exitCode, bytes: Buffer.concat(chunks)}));
  });
  const log = script.replace('check:', 'check-') + '.log';
  fs.writeFileSync(path.join(out, log), result.bytes);
  const raw = result.bytes.toString('utf8');
  return {command: 'npm run ' + script, startedAt, finishedAt: new Date().toISOString(), exitCode: result.exitCode, pass: result.exitCode === 0, log: phase + '-gates/' + log, summary: raw.split(/\r?\n/).filter(line => /扫描:|汇总:|error TS/.test(line))};
}
Promise.all(['check:naming', 'typecheck', 'check:dependencies'].map(run)).then(runs => {
  const report = {schemaVersion: 1, phase: 'B2.4c ' + phase, generatedAt: new Date().toISOString(), pass: runs.every(run => run.pass), runs, validationLimit: 'Static gates only. ContractAdapter and Creator production acceptance require separate evidence.'};
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  if (phase === 'final') fs.writeFileSync(path.join(__dirname, 'gate-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
