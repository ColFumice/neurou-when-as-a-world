'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const baselineFile = path.join(__dirname, 'protected-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8').replace(/^\uFEFF/, ''));
const excluded = baseline.excluded;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function walk(directory, rel = '') {
  const records = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = rel ? rel + '/' + item.name : item.name;
    if (excluded.some(prefix => name === prefix || name.startsWith(prefix + '/'))) continue;
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) records.push(...walk(absolute, name));
    else if (item.isFile()) { const bytes = fs.readFileSync(absolute); records.push({ path: name, bytes: bytes.length, sha256: hash(bytes) }); }
  }
  return records;
}
const before = new Map(baseline.files.map(file => [file.path, file]));
const current = walk(root);
const after = new Map(current.map(file => [file.path, file]));
const changed = baseline.files.filter(file => after.has(file.path) && after.get(file.path).sha256 !== file.sha256).map(file => file.path).sort();
const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path).sort();
const added = current.filter(file => !before.has(file.path)).map(file => file.path).sort();
const intentPath = 'src/director/IntentPort.ts';
const oldIntent = fs.readFileSync(path.join(__dirname, 'IntentPort.before.ts'));
const newIntent = fs.readFileSync(path.join(root, intentPath));
const tail = newIntent.subarray(oldIntent.length).toString('utf8');
const authorizedIntent = newIntent.subarray(0, oldIntent.length).equals(oldIntent) && /\S/.test(tail) &&
  tail.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '').replace(/export\s+type\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;/g, '').trim() === '';
const unauthorizedChanges = changed.filter(name => name !== intentPath || !authorizedIntent);
const allowedNewProductionFiles = [
  'src/director/RealServiceContracts.ts',
  'src/presentation/RealAuthServiceAdapter.ts',
  'assets/scripts/RealServiceBuilder.ts',
];
const authorizedAdded = added.filter(name => allowedNewProductionFiles.includes(name));
const unauthorizedAdded = added.filter(name => !authorizedAdded.includes(name));
const serverFiles = [];
function walkServer(directory, rel = 'server') {
  if (!fs.existsSync(directory)) return;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.local', 'runtime', 'secrets', '.secret'].includes(item.name) || item.name === '.env' || /\.(?:pem|key|p12|pfx)$/i.test(item.name)) continue;
    const name = rel + '/' + item.name;
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) walkServer(absolute, name);
    else if (item.isFile()) serverFiles.push(name);
  }
}
walkServer(path.join(root, 'server'));
const codeFiles = [...authorizedAdded, ...serverFiles].sort();
const changedManifest = [...changed, ...added, ...serverFiles].sort().map(name => {
  const bytes = fs.readFileSync(path.join(root, name)); return { path: name, change: before.has(name) ? 'modified' : 'added', bytes: bytes.length, sha256: hash(bytes) };
});
const diffs = [];
function addedDiff(name) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----\r?\n[\s\S]+?-----END (?:EC |RSA )?PRIVATE KEY-----/.test(source)) throw new Error('Private key material forbidden in source evidence: ' + name);
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return 'diff --git a/' + name + ' b/' + name + '\nnew file mode 100644\n--- /dev/null\n+++ b/' + name + '\n@@ -0,0 +1,' + lines.length + ' @@\n' + lines.map(line => '+' + line).join('\n') + '\n';
}
if (changed.includes(intentPath)) {
  const oldLines = oldIntent.toString('utf8').replace(/\r\n/g, '\n').split('\n');
  const newLines = newIntent.toString('utf8').replace(/\r\n/g, '\n').split('\n');
  if (oldLines.at(-1) === '') oldLines.pop();
  if (newLines.at(-1) === '') newLines.pop();
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  const start = Math.max(0, prefix - 3);
  diffs.push('diff --git a/' + intentPath + ' b/' + intentPath + '\n--- a/' + intentPath + '\n+++ b/' + intentPath + '\n@@ -' + (start + 1) + ',' + (oldLines.length - start) + ' +' + (start + 1) + ',' + (newLines.length - start) + ' @@\n' + oldLines.slice(start, prefix).map(line => ' ' + line).concat(oldLines.slice(prefix).map(line => '-' + line), newLines.slice(prefix).map(line => '+' + line)).join('\n') + '\n');
}
diffs.push(...codeFiles.map(addedDiff));
fs.writeFileSync(path.join(__dirname, 'code.diff'), diffs.join('\n'));
fs.writeFileSync(path.join(__dirname, 'changed-files.json'), JSON.stringify(changedManifest, null, 2) + '\n');
const result = { comparedUtc: new Date().toISOString(), baselineFile, baselineSha256: hash(fs.readFileSync(baselineFile)), beforeCount: baseline.files.length, afterCount: current.length,
  changed, removed, added, authorizedIntentTypeOnlyAppend: authorizedIntent, allowedNewProductionFiles, authorizedAdded, serverFiles, unauthorizedChanges, unauthorizedAdded,
  protectedPass: unauthorizedChanges.length === 0 && removed.length === 0 && unauthorizedAdded.length === 0,
  authorization: 'User explicitly permits additive new contracts, type-only exports, composition-root wiring and mode routing. Existing files except type-only IntentPort append remain protected. New server package is separately inventoried.',
  limits: 'Hashes establish byte stability since this B2.5b snapshot; excluded caches/dependencies/runtime and delivery files are not source-reviewed. The earlier B2.5a raw FAIL is retained unchanged.' };
fs.writeFileSync(path.join(__dirname, 'protected-comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.protectedPass ? 0 : 1;
