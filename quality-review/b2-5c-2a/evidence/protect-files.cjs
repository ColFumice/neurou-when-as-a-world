'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = process.argv[2] || 'compare';
if (!['baseline', 'compare'].includes(phase)) throw new Error('Use baseline or compare.');
const outputName = process.argv[3] || 'protected-comparison.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use an evidence JSON basename.');
const baselinePath = path.join(__dirname, 'protected-baseline.json');
const excludedDirectoryNames = ['node_modules', 'library', 'temp', 'tmp', 'dist', '.git', '.local', '.secret', 'secrets'];
const excludedPrefixes = ['quality-review/b2-5c-2a', 'quality-review/b2-real-auth/evidence/runtime/pgsql'];
const excludedFilePatterns = ['.env', '*.(pem|key|p12|pfx)', '*.(zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function walk(directory, rel = '') {
  const records = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = rel ? rel + '/' + item.name : item.name;
    if (excludedPrefixes.some(prefix => name === prefix || name.startsWith(prefix + '/'))) continue;
    if (item.isDirectory() && excludedDirectoryNames.includes(item.name)) continue;
    const absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) {
      const target = fs.readlinkSync(absolute);
      const bytes = Buffer.from(target, 'utf8');
      records.push({ path: name, kind: 'symbolic-link-or-junction', target, bytes: bytes.length, sha256: hash(bytes) });
    } else if (item.isDirectory()) records.push(...walk(absolute, name));
    else if (item.isFile()) {
      if (item.name === '.env' || /\.(?:pem|key|p12|pfx|zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)$/i.test(item.name)) continue;
      const bytes = fs.readFileSync(absolute);
      records.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
fs.mkdirSync(__dirname, { recursive: true });
const files = walk(root);
if (phase === 'baseline') {
  if (fs.existsSync(baselinePath)) throw new Error('Baseline is immutable once captured.');
  const result = { phase: 'B2.5c-2a freeze baseline', capturedUtc: new Date().toISOString(), root, algorithm: 'SHA-256', excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, allowedProduction: [], allowedModified: [], fileCount: files.length, files,
    limits: 'All pre-existing non-excluded files are protected: c-1 five pure modules, IntentPort, prior c-1/P3/B2.5b delivery/evidence, docs/namebook/reference, archive/core, server source/package, existing gate scripts. No production source changes or additions are authorized in this freeze round. Junction targets are hashed without traversal. Dependencies/caches/compiled output directories/private local data/keys/runtime binaries and the new c-2a delivery directory are excluded; private files are never read.' };
  fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ capturedUtc: result.capturedUtc, fileCount: files.length, baselineSha256: hash(fs.readFileSync(baselinePath)) }, null, 2));
} else {
  if (fs.existsSync(path.join(__dirname, outputName))) throw new Error('Comparison records are immutable; choose a separately named recheck.');
  const baselineBytes = fs.readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  for (const [name, actual] of Object.entries({ excludedDirectoryNames, excludedPrefixes, excludedFilePatterns })) {
    if (JSON.stringify(actual) !== JSON.stringify(baseline[name])) throw new Error('Protection rules changed since baseline: ' + name);
  }
  const before = new Map(baseline.files.map(file => [file.path, file]));
  const after = new Map(files.map(file => [file.path, file]));
  const changed = baseline.files.filter(file => after.has(file.path) && (after.get(file.path).sha256 !== file.sha256 || after.get(file.path).kind !== file.kind)).map(file => file.path);
  const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path);
  const added = files.filter(file => !before.has(file.path)).map(file => file.path);
  const result = { phase: 'B2.5c-2a freeze protection', comparedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc, baselineSha256: hash(baselineBytes), beforeCount: baseline.fileCount, afterCount: files.length, changed, removed, added,
    unauthorizedChanged: changed, unauthorizedAdded: added, pass: changed.length === 0 && removed.length === 0 && added.length === 0,
    excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, limits: baseline.limits };
  fs.writeFileSync(path.join(__dirname, outputName), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}
