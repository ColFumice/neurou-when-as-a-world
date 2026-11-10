'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = process.argv[2] || 'compare';
if (!['baseline', 'compare'].includes(phase)) throw new Error('Use baseline or compare.');
const compareOutputName = process.argv[3] || 'protected-comparison.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(compareOutputName)) throw new Error('Use an evidence JSON basename.');
const baselinePath = path.join(__dirname, 'protected-baseline.json');
const intentBeforePath = path.join(__dirname, 'IntentPort.before.ts');
const intentPath = 'src/director/IntentPort.ts';
const allowedProduction = [
  'src/director/SharedCommitContracts.ts',
  'src/director/SharedCanonicalBytes.ts',
  'src/director/SharedCommitCodec.ts',
  'src/director/SharedCommitValidator.ts',
  'src/director/SharedWorldReducer.ts',
];
const excludedDirectoryNames = ['node_modules', 'library', 'temp', 'tmp', 'dist', '.git', '.local', '.secret', 'secrets'];
const excludedPrefixes = ['quality-review/b2-5c-1', 'quality-review/b2-real-auth/evidence/runtime/pgsql'];
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
  if (fs.existsSync(baselinePath) || fs.existsSync(intentBeforePath)) throw new Error('Baseline is immutable once captured.');
  if (allowedProduction.some(name => fs.existsSync(path.join(root, name)))) throw new Error('Capture baseline before any new production file is written.');
  const intentBefore = fs.readFileSync(path.join(root, intentPath));
  fs.writeFileSync(intentBeforePath, intentBefore);
  const result = { phase: 'B2.5c-1 implementation baseline', capturedUtc: new Date().toISOString(), root, algorithm: 'SHA-256', excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, allowedProduction, allowedModified: intentPath, intentBeforeSha256: hash(intentBefore), fileCount: files.length, files,
    limits: 'All pre-existing non-excluded files are protected, including prior P3 and B2.5b evidence, docs/namebook/reference, archive/core/source, server source/package. IntentPort permits only original byte-prefix-preserved type-only export append. Exactly five new director files are allowed. Junction targets are hashed without traversal. Dependencies/caches/compiled outputs/private local data/keys/runtime binaries and this new delivery directory are excluded; private files are never read.' };
  fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ capturedUtc: result.capturedUtc, fileCount: files.length, baselineSha256: hash(fs.readFileSync(baselinePath)), intentBeforeSha256: result.intentBeforeSha256, intentBeforeBytes: intentBefore.length, allowedProduction }, null, 2));
} else {
  if (fs.existsSync(path.join(__dirname, compareOutputName))) throw new Error('Comparison records are immutable; choose a separately named recheck.');
  const baselineBytes = fs.readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  for (const [name, actual] of Object.entries({ excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, allowedProduction })) {
    if (JSON.stringify(actual) !== JSON.stringify(baseline[name])) throw new Error('Protection rules changed since baseline: ' + name);
  }
  const before = new Map(baseline.files.map(file => [file.path, file]));
  const after = new Map(files.map(file => [file.path, file]));
  const changed = baseline.files.filter(file => after.has(file.path) && (after.get(file.path).sha256 !== file.sha256 || after.get(file.path).kind !== file.kind)).map(file => file.path);
  const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path);
  const added = files.filter(file => !before.has(file.path)).map(file => file.path);
  const oldIntent = fs.readFileSync(intentBeforePath);
  if (hash(oldIntent) !== baseline.intentBeforeSha256) throw new Error('IntentPort before evidence changed.');
  const newIntent = fs.readFileSync(path.join(root, intentPath));
  const originalPrefixPreserved = newIntent.length >= oldIntent.length && newIntent.subarray(0, oldIntent.length).equals(oldIntent);
  const tail = originalPrefixPreserved ? newIntent.subarray(oldIntent.length).toString('utf8') : '';
  const strippedTail = tail.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '').replace(/export\s+type\s*\{[^}]*\}\s*from\s*['"]\.\/SharedCommitContracts['"]\s*;/g, '').trim();
  const typeOnlyAppend = originalPrefixPreserved && strippedTail === '' && (tail.trim() === '' || /export\s+type\s*\{[^}]*\}\s*from\s*['"]\.\/SharedCommitContracts['"]\s*;/.test(tail));
  const unauthorizedChanged = changed.filter(name => name !== intentPath || !typeOnlyAppend);
  const authorizedAdded = added.filter(name => allowedProduction.includes(name));
  const unauthorizedAdded = added.filter(name => !allowedProduction.includes(name));
  const result = { phase: 'B2.5c-1 implementation protection', comparedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc, baselineSha256: hash(baselineBytes), beforeCount: baseline.fileCount, afterCount: files.length, changed, removed, added,
    intentOriginalPrefixPreserved: originalPrefixPreserved, intentTypeOnlyAppend: typeOnlyAppend, intentTailBytes: newIntent.length - oldIntent.length, allowedProduction, authorizedAdded, unauthorizedChanged, unauthorizedAdded,
    pass: unauthorizedChanged.length === 0 && removed.length === 0 && unauthorizedAdded.length === 0,
    excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, limits: baseline.limits };
  fs.writeFileSync(path.join(__dirname, compareOutputName), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}
