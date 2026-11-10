'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runName = process.argv[2] || 'final';
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runName)) throw new Error('Use an immutable short run name.');
const out = path.join(__dirname, 'gate-runs', runName);
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Gate records are immutable.');
fs.mkdirSync(out, { recursive: true });
function run(name, args) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', bytes => chunks.push(bytes));
    child.stderr.on('data', bytes => chunks.push(bytes));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => {
      const bytes = Buffer.concat(chunks), raw = bytes.toString('utf8');
      fs.writeFileSync(path.join(out, name + '.log'), bytes);
      const summary = raw.match(/汇总:\s*(\d+)\s+ERROR(?:\s*\/\s*(\d+)\s+WARN)?/);
      resolve({ name, command: [process.execPath, ...args], cwd: root, startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0,
        reportedErrors: summary ? Number(summary[1]) : null, reportedWarnings: summary && summary[2] ? Number(summary[2]) : null,
        warningLines: raw.split(/\r?\n/).filter(line => /^\s*(?:npm\s+)?WARN(?:ING)?\b/i.test(line)), log: path.relative(__dirname, path.join(out, name + '.log')).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), summary: raw.split(/\r?\n/).filter(line => /扫描:|汇总:|error TS/.test(line)) });
    });
  });
}
Promise.allSettled([run('check-naming', ['scripts/check-naming.js']), run('check-dependencies', ['scripts/check-dependencies.js']), run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit'])]).then(settled => {
  const runs = settled.map((value, index) => value.status === 'fulfilled' ? value.value : { name: ['check-naming', 'check-dependencies', 'typecheck'][index], pass: false, error: String(value.reason) });
  const priorPath = path.join(__dirname, 'gate-runs/baseline/results.json'), priorBytes = fs.readFileSync(priorPath), prior = JSON.parse(priorBytes.toString('utf8'));
  const baselineWarnings = prior.runs.find(run => run.name === 'check-naming').warningLines;
  const currentWarnings = runs.find(run => run.name === 'check-naming').warningLines;
  const report = { phase: 'B2.5c-2c implementation ' + runName, status: runName.includes('paused') ? 'PausedP11' : 'ScopedChecks', stageComplete: false, generatedUtc: new Date().toISOString(), nodeVersion: process.version, pass: runs.every(run => run.pass), runs,
    warningComparison: { reference: 'evidence/gate-runs/baseline/results.json', referenceSha256: crypto.createHash('sha256').update(priorBytes).digest('hex'), baselineWarnings: baselineWarnings.length, currentWarnings: currentWarnings.length, exactLinesEqual: JSON.stringify(baselineWarnings) === JSON.stringify(currentWarnings), added: currentWarnings.filter(line => !baselineWarnings.includes(line)), removed: baselineWarnings.filter(line => !currentWarnings.includes(line)) },
    scope: 'Three unchanged repository gates. Independent server checks, historical regression and true HTTP/PG Relay acceptance are separately reported.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, runs: runs.map(run => ({ name: run.name, exitCode: run.exitCode, reportedErrors: run.reportedErrors, reportedWarnings: run.reportedWarnings, summary: run.summary })), warningComparison: report.warningComparison }, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
