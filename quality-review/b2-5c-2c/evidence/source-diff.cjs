'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mode = process.argv[2] || 'final';
if (!['final', 'paused', 'retention-final'].includes(mode)) throw new Error('Use final, paused or retention-final.');
const auditName = mode === 'paused' ? 'protected-implementation-paused-audit.json' : mode === 'retention-final' ? 'protected-retention-final-audit.json' : 'protected-implementation-final-audit.json';
const diffName = mode === 'paused' ? 'wip-code.diff' : mode === 'retention-final' ? 'source-final.diff' : 'code.diff';
const manifestName = mode === 'paused' ? 'wip-changed-files.json' : mode === 'retention-final' ? 'changed-files-final.json' : 'changed-files.json';
const baselineBytes = fs.readFileSync(path.join(__dirname, 'protected-baseline.json')), baseline = JSON.parse(baselineBytes.toString('utf8'));
const auditBytes = fs.readFileSync(path.join(__dirname, auditName)), audit = JSON.parse(auditBytes.toString('utf8'));
if (!audit.pass || audit.baselineSha256 !== sha(baselineBytes)) throw new Error('A passing scoped implementation protection audit is required.');
for (const name of [diffName, manifestName]) if (fs.existsSync(path.join(__dirname, name))) throw new Error('Diff artifacts are immutable.');
const before = new Map(baseline.files.map(file => [file.path, file]));
const originals = { 'src/director/IntentPort.ts': 'intent-before-c2c.ts', 'src/presentation/RealSharedServiceSessionAdapter.ts': 'session-before-p10.ts' };
const names = [...audit.changed, ...audit.addedProductionFiles].sort();
const normalize = source => { const value = source.replace(/\r\n/g, '\n').split('\n'); if (value.at(-1) === '') value.pop(); return value; };
function source(name) {
  const bytes = fs.readFileSync(path.join(root, name));
  if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/.test(bytes.toString('utf8'))) throw new Error('Private PEM cannot enter a source diff.');
  return bytes;
}
const diffs = [], files = names.map(name => { const bytes = source(name); return { path: name, change: before.has(name) ? 'modified' : 'added', bytes: bytes.length, sha256: sha(bytes), beforeBytes: before.get(name)?.bytes ?? null, beforeSha256: before.get(name)?.sha256 ?? null }; });
for (const name of names) {
  const bytes = source(name), lines = normalize(bytes.toString('utf8'));
  if (!before.has(name)) diffs.push('diff --git a/' + name + ' b/' + name + '\nnew file mode 100644\n--- /dev/null\n+++ b/' + name + '\n@@ -0,0 +1,' + lines.length + ' @@\n' + lines.map(line => '+' + line).join('\n') + '\n');
  else {
    if (!originals[name]) throw new Error('Unexpected modified source.');
    const original = fs.readFileSync(path.join(__dirname, originals[name]));
    if (sha(original) !== before.get(name).sha256) throw new Error('Original snapshot differs from baseline.');
    const oldLines = normalize(original.toString('utf8'));
    let prefix = 0; while (prefix < oldLines.length && prefix < lines.length && oldLines[prefix] === lines[prefix]) prefix++;
    let suffix = 0; while (suffix < oldLines.length - prefix && suffix < lines.length - prefix && oldLines.at(-1 - suffix) === lines.at(-1 - suffix)) suffix++;
    const start = Math.max(0, prefix - 3), oldEnd = Math.min(oldLines.length, oldLines.length - suffix + 3), newEnd = Math.min(lines.length, lines.length - suffix + 3);
    const contextBefore = oldLines.slice(start, prefix).map(line => ' ' + line), removed = oldLines.slice(prefix, oldLines.length - suffix).map(line => '-' + line), added = lines.slice(prefix, lines.length - suffix).map(line => '+' + line), contextAfter = oldLines.slice(oldLines.length - suffix, oldEnd).map(line => ' ' + line);
    diffs.push('diff --git a/' + name + ' b/' + name + '\n--- a/' + name + '\n+++ b/' + name + '\n@@ -' + (start + 1) + ',' + (oldEnd - start) + ' +' + (start + 1) + ',' + (newEnd - start) + ' @@\n' + [...contextBefore, ...removed, ...added, ...contextAfter].join('\n') + '\n');
  }
}
const diff = diffs.join('\n'); fs.writeFileSync(path.join(__dirname, diffName), diff);
const generatedFiles = audit.addedBuildArtifacts.map(name => { const bytes = source(name); return { path: name, change: 'added-generated-copy', bytes: bytes.length, sha256: sha(bytes) }; });
const manifest = { phase: mode === 'paused' ? 'B2.5c-2c paused P11 work-in-progress implementation source diff; not complete' : 'B2.5c-2c complete implementation source diff', generatedUtc: new Date().toISOString(), status: mode === 'paused' ? 'PausedP11' : 'FinalScopedDiff', stageComplete: false, files, sourceFileCount: files.length, addedFiles: files.filter(file => file.change === 'added').length, modifiedFiles: files.filter(file => file.change === 'modified').length, generatedFiles,
  sourceDiffPath: 'evidence/' + diffName, retentionFixIncluded: mode === 'retention-final',
  codeDiffBytes: Buffer.byteLength(diff), codeDiffSha256: sha(diff), finalProtectionAuditSha256: sha(auditBytes), pass: true,
  scope: 'All production implementation changes: five exact added TS source files plus IntentPort type-only suffix and approved P10 session local deadline rewrite. Four generated JS copies are hashed separately; all pre-existing generated files stay protected. New quality-review harness/evidence/delivery files are indexed separately, not counted as production source. No secrets or runtime DB values are exported.' };
fs.writeFileSync(path.join(__dirname, manifestName), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceFileCount: files.length, addedFiles: manifest.addedFiles, modifiedFiles: manifest.modifiedFiles, generatedCopies: generatedFiles.length, codeDiffBytes: manifest.codeDiffBytes, codeDiffSha256: manifest.codeDiffSha256 }, null, 2));
