'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phase = path.resolve(__dirname, '..');
const outputName = process.argv[2] || 'delivery-artifacts.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use JSON evidence basename.');
const outputPath = path.join(__dirname, outputName);
if (fs.existsSync(outputPath)) throw new Error('Artifact snapshots are immutable; use a separately named snapshot.');
const excludedDirectoryNames = ['.local', 'node_modules'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function walk(directory) {
  const files = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) { if (!excludedDirectoryNames.includes(item.name)) files.push(...walk(absolute)); }
    else if (item.isFile()) { const bytes = fs.readFileSync(absolute); files.push({ path: path.relative(phase, absolute).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) }); }
  }
  return files;
}
const files = walk(phase).sort((a, b) => a.path.localeCompare(b.path, 'en'));
const report = { phase: 'B2.5c-2b full public delivery artifact snapshot', generatedUtc: new Date().toISOString(), fileCount: files.length, files, excludedDirectoryNames, junctionTargetsTraversed: false, selfExcluded: true,
  limits: 'All actual non-private c-2b delivery/test/evidence/generated files at this snapshot. Implementation source changes are separately recorded in changed-files.json/code.diff; protected-final-audit deliberately excludes this new phase directory. Private credentials, test key files and DB data live under .local and are not read or recorded. Future-stage file plans are not treated as actual artifacts.' };
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ fileCount: files.length, snapshot: outputName }, null, 2));
