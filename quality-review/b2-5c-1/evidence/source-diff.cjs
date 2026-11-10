'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = readJson('protected-baseline.json');
const comparison = readJson('protected-comparison.json');
if (comparison.baselineSha256 !== hash(fs.readFileSync(path.join(__dirname, 'protected-baseline.json')))) throw new Error('Comparison does not match baseline.');
const closure = fs.existsSync(path.join(__dirname, 'source-attribution-closure.json')) ? readJson('source-attribution-closure.json') : null;
if (!comparison.intentOriginalPrefixPreserved || !comparison.intentTypeOnlyAppend) throw new Error('IntentPort append is not authorized.');
if (!comparison.pass && (!closure?.reviewedClosurePass || closure.baselineSha256 !== comparison.baselineSha256
  || closure.rawComparisonSha256 !== hash(fs.readFileSync(path.join(__dirname, 'protected-comparison.json'))))) throw new Error('A reviewed separate closure is required; raw FAIL stays unchanged.');
const before = new Map(baseline.files.map(file => [file.path, file]));
const added = comparison.authorizedAdded;
const intentPath = 'src/director/IntentPort.ts';
const modified = comparison.changed.filter(name => name === intentPath);
const manifest = [...modified, ...added].sort().map(name => {
  const bytes = fs.readFileSync(path.join(root, name));
  return { path: name, change: before.has(name) ? 'modified' : 'added', bytes: bytes.length, sha256: hash(bytes), beforeBytes: before.get(name)?.bytes ?? null, beforeSha256: before.get(name)?.sha256 ?? null };
});
function lines(source) {
  const result = source.replace(/\r\n/g, '\n').split('\n');
  if (result.at(-1) === '') result.pop();
  return result;
}
function addedDiff(name) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----\r?\n[\s\S]+?-----END (?:EC |RSA )?PRIVATE KEY-----/.test(source)) throw new Error('Private key material forbidden in source diff: ' + name);
  const sourceLines = lines(source);
  return 'diff --git a/' + name + ' b/' + name + '\nnew file mode 100644\n--- /dev/null\n+++ b/' + name + '\n@@ -0,0 +1,' + sourceLines.length + ' @@\n' + sourceLines.map(line => '+' + line).join('\n') + '\n';
}
const diffs = [];
if (modified.length) {
  const oldBytes = fs.readFileSync(path.join(__dirname, 'IntentPort.before.ts'));
  const newBytes = fs.readFileSync(path.join(root, intentPath));
  if (hash(oldBytes) !== baseline.intentBeforeSha256 || !newBytes.subarray(0, oldBytes.length).equals(oldBytes)) throw new Error('Original IntentPort byte prefix was not preserved.');
  const oldLines = lines(oldBytes.toString('utf8'));
  const newLines = lines(newBytes.toString('utf8'));
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  const start = Math.max(0, prefix - 3);
  diffs.push('diff --git a/' + intentPath + ' b/' + intentPath + '\n--- a/' + intentPath + '\n+++ b/' + intentPath + '\n@@ -' + (start + 1) + ',' + (oldLines.length - start) + ' +' + (start + 1) + ',' + (newLines.length - start) + ' @@\n' + oldLines.slice(start, prefix).map(line => ' ' + line).concat(oldLines.slice(prefix).map(line => '-' + line), newLines.slice(prefix).map(line => '+' + line)).join('\n') + '\n');
}
diffs.push(...added.map(addedDiff));
const diff = diffs.join('\n');
fs.writeFileSync(path.join(__dirname, 'code.diff'), diff);
fs.writeFileSync(path.join(__dirname, 'changed-files.json'), JSON.stringify({ generatedUtc: new Date().toISOString(), files: manifest, protectedComparisonUtc: comparison.comparedUtc, codeDiffSha256: hash(Buffer.from(diff)), originalIntentPrefixPreserved: comparison.intentOriginalPrefixPreserved, intentTypeOnlyAppend: comparison.intentTypeOnlyAppend,
  rawProtectionPass: comparison.pass, reviewedClosurePass: closure?.reviewedClosurePass ?? null, attributionPending: !comparison.pass && !closure?.reviewedClosurePass,
  scope: 'Only the authorized six source changes are exported. Externally attributed docs changes are omitted from this source diff; raw SHA protection failure remains preserved and distinct from reviewed attribution closure.' }, null, 2) + '\n');
console.log(JSON.stringify({ generatedUtc: new Date().toISOString(), sourceFileCount: manifest.length, files: manifest.map(file => file.path), codeDiffBytes: Buffer.byteLength(diff), codeDiffSha256: hash(Buffer.from(diff)), rawProtectionPass: comparison.pass, reviewedClosurePass: closure?.reviewedClosurePass ?? null }, null, 2));
