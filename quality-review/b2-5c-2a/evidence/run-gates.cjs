'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const out = path.join(__dirname, 'baseline-gates');
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Recorded gates are immutable.');
fs.mkdirSync(out, { recursive: true });
function run(name, args) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', data => chunks.push(data));
    child.stderr.on('data', data => chunks.push(data));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => {
      const bytes = Buffer.concat(chunks);
      fs.writeFileSync(path.join(out, name + '.log'), bytes);
      const raw = bytes.toString('utf8');
      const summary = raw.match(/汇总:\s*(\d+)\s+ERROR(?:\s*\/\s*(\d+)\s+WARN)?/);
      resolve({ name, command: [process.execPath, ...args], cwd: root, startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0,
        reportedErrors: summary ? Number(summary[1]) : null, reportedWarnings: summary && summary[2] ? Number(summary[2]) : null,
        warningLines: raw.split(/\r?\n/).filter(line => /^\s*(?:npm\s+)?WARN(?:ING)?\b/i.test(line)),
        log: path.relative(__dirname, path.join(out, name + '.log')).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        summary: raw.split(/\r?\n/).filter(line => /扫描:|汇总:|error TS/.test(line)) });
    });
  });
}
Promise.allSettled([
  run('check-naming', ['scripts/check-naming.js']),
  run('check-dependencies', ['scripts/check-dependencies.js']),
  run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']),
]).then(settled => {
  const runs = settled.map((result, index) => result.status === 'fulfilled' ? result.value : { name: ['check-naming', 'check-dependencies', 'typecheck'][index], pass: false, error: String(result.reason) });
  const report = { phase: 'B2.5c-2a freeze baseline', generatedUtc: new Date().toISOString(), pass: runs.every(run => run.pass), runs,
    scope: 'Exactly the three existing repository gates; scripts and allowlists are unchanged. This is a freeze round: no isolated-contract rerun or server HTTP claim is made.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
