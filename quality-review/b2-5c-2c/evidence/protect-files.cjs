'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = process.argv[2] || 'compare';
const outputName = process.argv[3] || 'protected-final-audit.json';
if (!['baseline', 'compare'].includes(phase)) throw new Error('Use baseline or compare.');
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use a JSON evidence basename.');
const baselinePath = path.join(__dirname, 'protected-baseline.json');
const excludedDirectoryNames = ['node_modules', 'library', 'temp', 'tmp', 'dist', '.git', '.local', '.secret', 'secrets'];
const excludedPrefixes = ['quality-review/b2-5c-2c', 'quality-review/b2-real-auth/evidence/runtime/pgsql'];
const excludedFilePatterns = ['.env', '.env.*', '*.(pem|key|p12|pfx)', '*.(zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)'];
const policy = { excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, allowedChangedPaths: [], allowedNewPaths: [], allowedNewPatterns: [], allowedRemovedPaths: [] };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const kernelPrefixes = ['server/.shared-kernel', 'server/shared-dist/.shared-kernel'];
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
      if (item.name === '.env' || item.name.startsWith('.env.') || /\.(?:pem|key|p12|pfx|zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)$/i.test(item.name)) continue;
      const bytes = fs.readFileSync(absolute);
      records.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
const files = walk(root);
const limits = 'Read-only c-2c prerequisite audit: every existing non-excluded file is protected; no source addition, edit, removal, or IntentPort suffix is allowed. Both pre-existing server/.shared-kernel and server/shared-dist/.shared-kernel trees are hashed and protected rather than allowlisted as new caches. Only the new c-2c delivery/evidence tree is excluded. The former c-2b delivery/evidence exclusion is removed; its non-private non-excluded files are now protected. Inherited dependency/editor/runtime/private exclusions are listed explicitly; binary distributions, private credentials, dependency directories, editor caches and junction targets are not traversed. This audit proves unchanged scoped bytes and is not a full-machine, secret, dependency, or database audit. No PG process or Relay test is started.';
if (phase === 'baseline') {
  if (fs.existsSync(baselinePath)) throw new Error('Baseline is immutable once captured.');
  const priorPolicyPath = path.join(root, 'quality-review/b2-5c-2b/evidence/protected-final-audit.json');
  const priorBytes = fs.readFileSync(priorPolicyPath);
  const prior = JSON.parse(priorBytes.toString('utf8'));
  const result = { phase: 'B2.5c-2c read-only prerequisite baseline; implementation not started', capturedUtc: new Date().toISOString(), root, algorithm: 'SHA-256', policy, fileCount: files.length, files,
    inheritedPolicyReference: { path: 'quality-review/b2-5c-2b/evidence/protected-final-audit.json', sha256: hash(priorBytes), priorExcludedPrefixes: prior.policy.excludedPrefixes, priorLimits: prior.limits },
    protectedKernelTrees: kernelPrefixes.map(prefix => ({ prefix, fileCount: files.filter(file => file.path.startsWith(prefix + '/')).length })), limits };
  fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ capturedUtc: result.capturedUtc, fileCount: files.length, baselineSha256: hash(fs.readFileSync(baselinePath)), protectedKernelTrees: result.protectedKernelTrees }, null, 2));
} else {
  const outputPath = path.join(__dirname, outputName);
  if (fs.existsSync(outputPath)) throw new Error('Audit records are immutable; choose a separately named recheck.');
  const baselineBytes = fs.readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  if (JSON.stringify(policy) !== JSON.stringify(baseline.policy)) throw new Error('Protection policy changed after baseline.');
  const before = new Map(baseline.files.map(file => [file.path, file]));
  const after = new Map(files.map(file => [file.path, file]));
  const changed = baseline.files.filter(file => after.has(file.path) && (after.get(file.path).sha256 !== file.sha256 || after.get(file.path).kind !== file.kind)).map(file => file.path);
  const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path);
  const added = files.filter(file => !before.has(file.path)).map(file => file.path);
  const result = { phase: 'B2.5c-2c read-only prerequisite protection audit; implementation not started', comparedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc, baselineSha256: hash(baselineBytes), beforeCount: baseline.fileCount, afterCount: files.length, changed, removed, added,
    unauthorizedChanged: changed, unauthorizedAdded: added, unauthorizedRemoved: removed, pass: changed.length === 0 && removed.length === 0 && added.length === 0,
    protectedKernelTrees: kernelPrefixes.map(prefix => ({ prefix, beforeCount: baseline.files.filter(file => file.path.startsWith(prefix + '/')).length, afterCount: files.filter(file => file.path.startsWith(prefix + '/')).length, changed: changed.filter(name => name.startsWith(prefix + '/')), removed: removed.filter(name => name.startsWith(prefix + '/')), added: added.filter(name => name.startsWith(prefix + '/')) })), policy, limits };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ pass: result.pass, beforeCount: result.beforeCount, afterCount: result.afterCount, changed, removed, added, protectedKernelTrees: result.protectedKernelTrees }, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}
