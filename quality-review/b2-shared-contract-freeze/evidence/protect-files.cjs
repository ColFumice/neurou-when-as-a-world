'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = process.argv[2] || 'compare';
if (!['baseline', 'compare'].includes(phase)) throw new Error('Use baseline or compare.');
const baselinePath = path.join(__dirname, 'protected-baseline.json');
const excludedDirectoryNames = ['node_modules', 'library', 'temp', 'tmp', 'dist', '.git', '.local', '.secret', 'secrets'];
const excludedPrefixes = ['quality-review/b2-shared-contract-freeze', 'quality-review/b2-real-auth/evidence/runtime/pgsql'];
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
    }
    else if (item.isDirectory()) records.push(...walk(absolute, name));
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
  const result = { phase: 'B2.5c P3 documentation-only baseline', capturedUtc: new Date().toISOString(), root, algorithm: 'SHA-256', excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, fileCount: files.length, files,
    limits: 'Byte-stability scope is all pre-existing non-excluded files, including docs, namebook/reference materials, archive, source, server package source, settings and historical quality evidence. Symlink/junction targets are hashed as link text without traversal; their in-workspace canonical source directories are independently covered. Dependencies, generated caches/compiled outputs, PostgreSQL executable payload, private local data/key files and this new delivery directory are excluded; secret files are never read.' };
  fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ capturedUtc: result.capturedUtc, fileCount: files.length, baselineSha256: hash(fs.readFileSync(baselinePath)), excludedDirectoryNames, excludedPrefixes, excludedFilePatterns }, null, 2));
} else {
  const baselineBytes = fs.readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  for (const [name, actual] of Object.entries({ excludedDirectoryNames, excludedPrefixes, excludedFilePatterns })) {
    if (JSON.stringify(actual) !== JSON.stringify(baseline[name])) throw new Error('Exclusion rules changed since baseline: ' + name);
  }
  const before = new Map(baseline.files.map(file => [file.path, file]));
  const after = new Map(files.map(file => [file.path, file]));
  const changed = baseline.files.filter(file => after.has(file.path) && (after.get(file.path).sha256 !== file.sha256 || after.get(file.path).kind !== file.kind)).map(file => file.path);
  const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path);
  const added = files.filter(file => !before.has(file.path)).map(file => file.path);
  const result = { phase: 'B2.5c P3 documentation-only protection', comparedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc, baselineSha256: hash(baselineBytes), beforeCount: baseline.fileCount, afterCount: files.length, changed, removed, added, pass: changed.length === 0 && removed.length === 0 && added.length === 0,
    excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, limits: baseline.limits };
  fs.writeFileSync(path.join(__dirname, 'protected-comparison.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}
