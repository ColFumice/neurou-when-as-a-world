'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
cp.execFileSync(process.execPath, [path.join(__dirname, 'capture-baseline.cjs'), 'baseline-after.json'], { windowsHide: true });
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-before.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-after.json'), 'utf8'));
const previous = new Map(before.files.map(file => [file.path, file]));
const current = new Map(after.files.map(file => [file.path, file]));
const changed = [], removed = [], added = [];
for (const [file, record] of previous) {
  const next = current.get(file);
  if (!next) removed.push(file);
  else if (next.sha256 !== record.sha256 || next.bytes !== record.bytes) changed.push(file);
}
for (const file of current.keys()) if (!previous.has(file)) added.push(file);
const allowedChanged = ['src/director/IntentPort.ts', 'assets/scripts/src/director/IntentPort.ts'];
const newFiles = ['src/director/WorldHomeRegistry.ts', 'src/director/WorldHomeRegistry.ts.meta',
  'src/presentation/WorldHomeContractAdapter.ts', 'src/presentation/WorldHomeContractAdapter.ts.meta'];
const allowedAdded = [...newFiles, ...newFiles.map(file => 'assets/scripts/' + file)];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const intentRaw = fs.readFileSync(path.join(root, 'src/director/IntentPort.ts'));
const intent = intentRaw.toString('utf8');
const marker = '// B2.4b: lightweight ownership contracts only; no new player intent or write capability.';
const markerIndex = intent.indexOf(marker);
const prefix = markerIndex < 0 ? '' : intent.slice(0, markerIndex);
const suffix = markerIndex < 0 ? '' : intent.slice(markerIndex).replace(/\r\n/g, '\n');
const expectedSuffix = marker + '\n' +
  "export type { HomeState, WorldHomeContext, WorldHomeRecord, WorldHomeRegistrySnapshot,\n" +
  '  WorldHomeRegistrationRequest, WorldHomeRegistrationReply, WorldHomeRegistryDiagnostic,\n' +
  '  WorldHomeRegistryReadResult, WorldHomeRegistrationResult, WorldHomeAuthorityPort,\n' +
  "  WorldHomeRegistryBindings } from './WorldHomeRegistry';\n";
const oldIntentPrefixUnchanged = sha256(Buffer.from(prefix)) === previous.get('src/director/IntentPort.ts').sha256;
const onlyExpectedTypeExports = suffix === expectedSuffix;
const linksUnchanged = JSON.stringify(before.symbolicLinks) === JSON.stringify(after.symbolicLinks);
const unexpectedChanged = changed.filter(file => !allowedChanged.includes(file));
const unexpectedAdded = added.filter(file => !allowedAdded.includes(file));
const missingNewFiles = allowedAdded.filter(file => !added.includes(file));
const report = {
  schemaVersion: 1, phase: 'B2.4b', generatedAt: new Date().toISOString(), algorithm: 'sha256',
  baselinePathCount: before.files.length, finalPathCount: after.files.length,
  changed, added, removed, allowedChanged, allowedAdded, unexpectedChanged, unexpectedAdded, missingNewFiles,
  oldIntentPrefixUnchanged, onlyExpectedTypeExports, linksUnchanged,
  unreadableBefore: before.unreadable, unreadableAfter: after.unreadable, scope: before.scope,
  pass: unexpectedChanged.length === 0 && unexpectedAdded.length === 0 && missingNewFiles.length === 0 &&
    removed.length === 0 && oldIntentPrefixUnchanged && onlyExpectedTypeExports && linksUnchanged &&
    before.unreadable.length === 0 && after.unreadable.length === 0,
  limitation: 'Explicit protected scope, including archive references; evidence directory and generated dependencies excluded. No Git repository is present.',
};
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, changed, added, unexpectedChanged, unexpectedAdded,
  missingNewFiles, removed, oldIntentPrefixUnchanged, onlyExpectedTypeExports }));
process.exitCode = report.pass ? 0 : 1;
