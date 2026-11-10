'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phaseDirectory = path.resolve(__dirname, '..');
const outputName = process.argv[2] || 'delivery-artifacts-final.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use JSON basename.');
const output = path.join(__dirname, outputName);
if (fs.existsSync(output)) throw new Error('Artifact manifests are immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exclusions = { directoryNames: ['.local', '.secret', 'secrets', 'node_modules'], fileNamePatterns: ['.env', '.env.*', '*.(pem|key|p12|pfx)'], thisManifest: 'evidence/' + outputName, symlinkTargetsNotTraversed: true };
function walk(directory, prefix = '') {
  const files = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + item.name : item.name;
    if (name === exclusions.thisManifest || exclusions.directoryNames.includes(item.name)) continue;
    const absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) { const target = fs.readlinkSync(absolute); files.push({ path: name, kind: 'symbolic-link-or-junction', target, sha256: sha(Buffer.from(target, 'utf8')), targetNotTraversed: true }); }
    else if (item.isDirectory()) files.push(...walk(absolute, name));
    else if (item.isFile()) {
      if (item.name === '.env' || item.name.startsWith('.env.') || /\.(?:pem|key|p12|pfx)$/i.test(item.name)) continue;
      const bytes = fs.readFileSync(absolute); files.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
const files = walk(phaseDirectory);
const report = { phase: 'B2.5c-2c delivery/evidence artifact inventory', generatedUtc: new Date().toISOString(), phaseDirectory, exclusions, fileCount: files.length, files, scope: 'New c-2c reports, test harnesses, logs, result manifests and isolated generated evidence. Production implementation files and four generated runtime additions are separately listed by evidence/changed-files.json and code.diff. Private runtime databases, connection credentials/keys and symlink targets are excluded explicitly. This manifest excludes itself to avoid a recursive hash claim.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ fileCount: files.length, outputName, manifestSha256: sha(fs.readFileSync(output)) }, null, 2));
