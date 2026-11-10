'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = read('protected-baseline.json'), audit = read('protected-final-audit.json');
if (!audit.pass || audit.baselineSha256 !== hash(fs.readFileSync(path.join(__dirname, 'protected-baseline.json')))) throw new Error('Final passing protection audit is required.');
const intentPath = 'src/director/IntentPort.ts';
const names = [...audit.changed, ...audit.addedProductionFiles].sort();
const before = new Map(baseline.files.map(file => [file.path, file]));
const normalize = source => { const value = source.replace(/\r\n/g, '\n').split('\n'); if (value.at(-1) === '') value.pop(); return value; };
function source(name) {
  const bytes = fs.readFileSync(path.join(root, name));
  if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/.test(bytes.toString('utf8'))) throw new Error('Private PEM cannot enter exported source diff.');
  return bytes;
}
const diffs = [], files = names.map(name => { const bytes = source(name); return { path: name, change: before.has(name) ? 'modified' : 'added', bytes: bytes.length, sha256: hash(bytes), beforeBytes: before.get(name)?.bytes ?? null, beforeSha256: before.get(name)?.sha256 ?? null }; });
for (const name of names) {
  const bytes = source(name), lines = normalize(bytes.toString('utf8'));
  if (!before.has(name)) diffs.push('diff --git a/' + name + ' b/' + name + '\nnew file mode 100644\n--- /dev/null\n+++ b/' + name + '\n@@ -0,0 +1,' + lines.length + ' @@\n' + lines.map(line => '+' + line).join('\n') + '\n');
  else {
    if (name !== intentPath) throw new Error('Only IntentPort can be modified.');
    const original = Buffer.from(baseline.originalIntentPortBase64, 'base64');
    if (!bytes.subarray(0, original.length).equals(original)) throw new Error('IntentPort original byte prefix changed.');
    const oldLines = normalize(original.toString('utf8')); let prefix = 0;
    while (prefix < oldLines.length && prefix < lines.length && oldLines[prefix] === lines[prefix]) prefix++;
    const start = Math.max(0, prefix - 3);
    diffs.push('diff --git a/' + name + ' b/' + name + '\n--- a/' + name + '\n+++ b/' + name + '\n@@ -' + (start + 1) + ',' + (oldLines.length - start) + ' +' + (start + 1) + ',' + (lines.length - start) + ' @@\n' + oldLines.slice(start, prefix).map(line => ' ' + line).concat(oldLines.slice(prefix).map(line => '-' + line), lines.slice(prefix).map(line => '+' + line)).join('\n') + '\n');
  }
}
const diff = diffs.join('\n'); fs.writeFileSync(path.join(__dirname, 'code.diff'), diff);
const manifest = { generatedUtc: new Date().toISOString(), files, sourceFileCount: files.length, addedFiles: files.filter(file => file.change === 'added').length, modifiedFiles: files.filter(file => file.change === 'modified').length,
  codeDiffBytes: Buffer.byteLength(diff), codeDiffSha256: hash(diff), finalProtectionAuditSha256: hash(fs.readFileSync(path.join(__dirname, 'protected-final-audit.json'))), pass: true,
  scope: 'Full implementation source/config/migration/test diff. Approved generated build caches are reported by protection audit but omitted from source diff; private runtime data/secrets and c-2b delivery evidence are not implementation source.' };
fs.writeFileSync(path.join(__dirname, 'changed-files.json'), JSON.stringify(manifest, null, 2) + '\n'); console.log(JSON.stringify({ sourceFileCount: files.length, addedFiles: manifest.addedFiles, modifiedFiles: manifest.modifiedFiles, codeDiffBytes: manifest.codeDiffBytes, codeDiffSha256: manifest.codeDiffSha256 }, null, 2));
