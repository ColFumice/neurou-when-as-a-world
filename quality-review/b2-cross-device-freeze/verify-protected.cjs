'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
cp.execFileSync(process.execPath, [path.join(__dirname, 'capture-baseline.cjs'), 'baseline-after.json'], { windowsHide: true });
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-before.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-after.json'), 'utf8'));
const previous = new Map(before.files.map(file => [file.path, file]));
const current = new Map(after.files.map(file => [file.path, file]));
const changed = [];
const removed = [];
const added = [];
for (const [file, record] of previous) {
  const candidate = current.get(file);
  if (!candidate) removed.push(file);
  else if (candidate.sha256 !== record.sha256 || candidate.bytes !== record.bytes) changed.push(file);
}
for (const file of current.keys()) if (!previous.has(file)) added.push(file);
const linksUnchanged = JSON.stringify(before.symbolicLinks) === JSON.stringify(after.symbolicLinks);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  phase: 'B2.4a',
  algorithm: 'sha256',
  before: 'baseline-before.json',
  after: 'baseline-after.json',
  scopedFilePathCount: before.files.length,
  uniquePhysicalFileCount: 337,
  scope: before.scope,
  changed, removed, added,
  linksUnchanged,
  unreadableBefore: before.unreadable,
  unreadableAfter: after.unreadable,
  pass: changed.length === 0 && removed.length === 0 && added.length === 0 && linksUnchanged && before.unreadable.length === 0 && after.unreadable.length === 0,
  limitation: 'Protected scope listed explicitly. Evidence directory is intentionally excluded. This workspace has no Git repository; no Git diff claim is made.',
};
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ pass: report.pass, scopedFilePathCount: report.scopedFilePathCount, changed, removed, added, linksUnchanged }));
process.exitCode = report.pass ? 0 : 1;
