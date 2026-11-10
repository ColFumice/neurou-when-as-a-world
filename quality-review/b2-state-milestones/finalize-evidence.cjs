// Evidence only: compare protected baseline, then create an explicit empty
// production diff and a separate patch for the review proposals.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (name, bytes) => fs.writeFileSync(path.join(__dirname, name), bytes, { flag: 'wx' });
const json = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n');
const excluded = new Set(['.git', 'library', 'node_modules', 'temp', 'tmp', 'build']);
function visit(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name) && absolute !== __dirname) visit(absolute, found);
    } else if (entry.isFile()) found.add(absolute);
  }
}
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-protected-files.json'), 'utf8'));
const found = new Set();
visit(root, found);
for (const entry of before) if (path.isAbsolute(entry.path)) found.add(entry.path);
const after = [...found].sort().map(absolute => ({
  path: absolute.toLowerCase().startsWith(root.toLowerCase()) ? relative(absolute) : absolute.replaceAll('\\', '/'),
  sha256: digest(fs.readFileSync(absolute)),
}));
const beforeByPath = new Map(before.map(row => [row.path, row.sha256]));
const afterByPath = new Map(after.map(row => [row.path, row.sha256]));
const changed = after.filter(row => beforeByPath.has(row.path) && beforeByPath.get(row.path) !== row.sha256).map(row => row.path);
const added = after.filter(row => !beforeByPath.has(row.path)).map(row => row.path);
const removed = before.filter(row => !afterByPath.has(row.path)).map(row => row.path);
const unchanged = !changed.length && !added.length && !removed.length;
json('final-protection-verification.json', {
  verifiedAt: new Date().toISOString(), beforeCount: before.length, afterCount: after.length,
  changed, added, removed, unchanged, evidenceDirectoryExcluded: relative(__dirname),
  b22Implemented: false, b22Acceptance: false,
});
if (!unchanged) throw new Error('Protected files changed; inspect final-protection-verification.json');
write('production-code.diff', '');
const proposals = fs.readdirSync(__dirname).filter(name => /\.(md|cjs)$/.test(name)).sort();
const patch = proposals.map(name => {
  const file = relative(path.join(__dirname, name));
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8').replaceAll('\r\n', '\n');
  const lines = source.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` +
    lines.map(line => '+' + line + '\n').join('');
}).join('');
write('proposal-evidence.diff', patch);
const files = fs.readdirSync(__dirname).filter(name => name !== 'delivery-manifest.json').sort().map(name => {
  const bytes = fs.readFileSync(path.join(__dirname, name));
  return { path: relative(path.join(__dirname, name)), bytes: bytes.length, sha256: digest(bytes) };
});
json('delivery-manifest.json', {
  generatedAt: new Date().toISOString(), status: 'protocol-required',
  productionCodeChanged: false, b22Implemented: false, b22Acceptance: false,
  protectedFileCount: before.length, files,
  note: 'Manifest excludes itself. proposal-evidence.diff contains review artifacts only; production-code.diff is intentionally empty.',
});
console.log(JSON.stringify({ protectedFileCount: before.length, unchanged, artifactCount: files.length + 1, productionCodeChanged: false, b22Acceptance: false }, null, 2));
