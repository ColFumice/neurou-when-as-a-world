'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = process.argv[2] || 'final';
if (!['baseline', 'final'].includes(phase)) throw new Error('Phase must be baseline or final.');
const out = path.join(__dirname, phase + '-gates');
fs.mkdirSync(out, { recursive: true });
function run(name, args, cwd = root) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', data => chunks.push(data));
    child.stderr.on('data', data => chunks.push(data));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => {
      const bytes = Buffer.concat(chunks);
      const log = name + '.log';
      fs.writeFileSync(path.join(out, log), bytes);
      const raw = bytes.toString('utf8');
      const summary = raw.match(/汇总:\s*(\d+)\s+ERROR(?:\s*\/\s*(\d+)\s+WARN)?/);
      resolve({ name, command: [process.execPath, ...args], cwd, startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0,
        reportedErrors: summary ? Number(summary[1]) : null, reportedWarnings: summary && summary[2] ? Number(summary[2]) : null,
        warningLines: raw.split(/\r?\n/).filter(line => /^\s*(?:npm\s+)?WARN(?:ING)?\b/i.test(line)),
        log: path.relative(__dirname, path.join(out, log)).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        summary: raw.split(/\r?\n/).filter(line => /扫描:|汇总:|error TS/.test(line)) });
    });
  });
}
Promise.all([
  run('check-naming', ['scripts/check-naming.js']),
  run('check-dependencies', ['scripts/check-dependencies.js']),
  run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']),
]).then(runs => {
  const report = { phase: 'B2.5b ' + phase, generatedUtc: new Date().toISOString(), pass: runs.every(run => run.pass), runs,
    scope: 'Repository three existing gates; independent server typecheck, contract tests and actual PostgreSQL / loopback HTTP evidence are recorded separately.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
