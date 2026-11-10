'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'c2b-source-stability.json');
if (fs.existsSync(output)) throw new Error('Stability record is immutable.');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const referencePath = 'quality-review/b2-5c-2b/evidence/changed-files.json';
const referenceBytes = fs.readFileSync(path.join(root, referencePath));
const reference = JSON.parse(referenceBytes.toString('utf8'));
const files = reference.files.map(file => {
  const absolute = path.join(root, file.path);
  if (!fs.existsSync(absolute)) return { path: file.path, expectedBytes: file.bytes, expectedSha256: file.sha256, missing: true, pass: false };
  const bytes = fs.readFileSync(absolute), sha256 = hash(bytes);
  return { path: file.path, expectedBytes: file.bytes, expectedSha256: file.sha256, currentBytes: bytes.length, currentSha256: sha256, pass: bytes.length === file.bytes && sha256 === file.sha256 };
});
const result = { phase: 'B2.5c-2c read-only prerequisite c-2b source stability', generatedUtc: new Date().toISOString(), referencePath, referenceSha256: hash(referenceBytes), fileCount: files.length, files, changedFiles: files.filter(file => !file.pass).map(file => file.path), pass: files.every(file => file.pass),
  scope: 'All 23 c-2b implementation source/config/migration/test files and modified IntentPort compared to accepted c-2b final byte hashes. No implementation edits are authorized in this prerequisite audit. The separate protection audit also hashes all pre-existing non-excluded generated kernel/runtime files.' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: result.pass, fileCount: result.fileCount, changedFiles: result.changedFiles }, null, 2));
process.exitCode = result.pass ? 0 : 1;
