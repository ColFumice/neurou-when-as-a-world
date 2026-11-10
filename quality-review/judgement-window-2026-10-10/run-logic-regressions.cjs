// Reproduce from project root: node quality-review/judgement-window-2026-10-10/run-logic-regressions.cjs
// Only writes to this evidence directory. Production modules and prior evidence are read-only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const sourceDir = path.join(root, 'quality-review/world-folder');
const names = ['b-regression', 'c-regression', 'pad-regression', 'editor-regression'];
const summarizeOnly = process.argv.includes('--summarize');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const sourceManifest = [];
for (const name of names) {
  const source = path.join(sourceDir, name + '.cjs');
  const target = path.join(__dirname, name + '.cjs');
  const content = fs.readFileSync(source);
  if (!fs.existsSync(target)) { fs.writeFileSync(target, content); }
  sourceManifest.push({ name, source: path.relative(root, source).replace(/\\/g, '/'),
    sourceSha256: sha256(content), copiedHarnessSha256: sha256(fs.readFileSync(target)),
    adapted: !content.equals(fs.readFileSync(target)) });
}
fs.writeFileSync(path.join(__dirname, 'regression-source-manifest.json'), JSON.stringify(sourceManifest, null, 2) + '\n');
const runs = [];
for (const name of [...names, 'window-boundaries']) {
  const script = path.join(__dirname, name + '.cjs');
  if (!fs.existsSync(script)) { continue; }
  const result = summarizeOnly ? null : spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  if (result) { fs.writeFileSync(path.join(__dirname, name + '.log'), result.stdout + result.stderr); }
  let report = null;
  const reportName = name === 'pad-regression' ? 'pad-grid-regression-results.json' : name + '-results.json';
  try { report = JSON.parse(fs.readFileSync(path.join(__dirname, reportName), 'utf8')); } catch {}
  runs.push({ name, command: 'node ' + path.relative(root, script).replace(/\\/g, '/'),
    exitCode: result?.status ?? (report === null ? null : report.failed ? 1 : 0), passed: report?.passed ?? null, failed: report?.failed ?? null,
    failures: report?.checks?.filter(check => !check.pass).map(check => ({ name: check.name, error: check.error })) ?? [],
    scriptSha256: sha256(fs.readFileSync(script)) });
}
const report = { configuration: { rhythmStrikeWindowMs: 100, perfectWindowMs: 100, goodWindowMs: 200, syncToleranceMs: 30 },
  allPassed: runs.every(run => run.exitCode === 0), runs };
fs.writeFileSync(path.join(__dirname, 'logic-regression-summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.allPassed ? 0 : 1;
