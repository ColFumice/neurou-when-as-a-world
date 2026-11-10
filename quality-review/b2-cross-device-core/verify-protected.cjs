'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
cp.execFileSync(process.execPath, [path.join(__dirname, 'capture-baseline.cjs'), 'baseline-after.json'], {windowsHide: true});
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
const allowedChanged = ['src/director/IntentPort.ts', 'assets/scripts/src/director/IntentPort.ts', 'assets/scripts/WorldFolderBuilder.ts'];
const newFiles = ['src/director/CoreTransfer.ts', 'src/director/CoreTransfer.ts.meta',
  'src/director/CoreTransferContent.ts', 'src/director/CoreTransferContent.ts.meta',
  'src/presentation/CrossDeviceContractAdapter.ts', 'src/presentation/CrossDeviceContractAdapter.ts.meta',
  'src/presentation/CrossDeviceImportStorage.ts', 'src/presentation/CrossDeviceImportStorage.ts.meta'];
const allowedAdded = [...newFiles, ...newFiles.map(file => 'assets/scripts/' + file),
  'assets/scripts/CrossDevicePrototype.ts', 'assets/scripts/CrossDevicePrototype.ts.meta'];
const bytes = relative => fs.readFileSync(path.join(root, relative));
const original = relative => fs.readFileSync(path.join(__dirname, 'original-source', relative));
const oldIntent = original('src/director/IntentPort.ts');
const intent = bytes('src/director/IntentPort.ts');
const oldIntentPrefixUnchanged = intent.subarray(0, oldIntent.length).equals(oldIntent);
const intentSuffix = intent.subarray(oldIntent.length).toString('utf8').replace(/\r\n/g, '\n');
const expectedSuffix = '// B2.4c restricted Core transport; types only, no remote source write capability.\n' +
  'export type { CoreTransferPayload, CoreTransferProof, CrossDeviceAuthorityPort,\n' +
  '  CrossDeviceImportRequest, CrossDeviceDuplicateResult, CrossDeviceImportPlan,\n' +
  '  CrossDeviceImportPhase, CrossDeviceImportEntry, CrossDeviceImportJournal,\n' +
  "  CrossDeviceImportReceipt, CoreTransferCompleteValidator } from './CoreTransfer';\n";
const onlyExpectedTypeExports = intentSuffix === expectedSuffix;
function preservesOriginalLines(oldBytes, newBytes) {
  const beforeLines = oldBytes.toString('utf8').split(/\r?\n/);
  const afterLines = newBytes.toString('utf8').split(/\r?\n/);
  let cursor = 0;
  for (const line of afterLines) if (cursor < beforeLines.length && line === beforeLines[cursor]) cursor++;
  return cursor === beforeLines.length;
}
const oldFolderBuilderLinesPreserved = preservesOriginalLines(original('assets/scripts/WorldFolderBuilder.ts'), bytes('assets/scripts/WorldFolderBuilder.ts'));
const linksUnchanged = JSON.stringify(before.symbolicLinks) === JSON.stringify(after.symbolicLinks);
const unexpectedChanged = changed.filter(file => !allowedChanged.includes(file));
const unexpectedAdded = added.filter(file => !allowedAdded.includes(file));
const missingNewFiles = allowedAdded.filter(file => !added.includes(file));
const originalIndex = JSON.parse(fs.readFileSync(path.join(__dirname, 'original-source-index.json'), 'utf8'));
const originalCopyFailures = originalIndex.files.filter(file => {
  const saved = fs.readFileSync(path.join(__dirname, file.copy));
  return saved.length !== file.bytes || crypto.createHash('sha256').update(saved).digest('hex') !== file.sha256;
}).map(file => file.path);
const report = {schemaVersion: 1, phase: 'B2.4c', generatedAt: new Date().toISOString(), algorithm: 'sha256',
  baselinePathCount: before.files.length, finalPathCount: after.files.length, originalSourceCopyCount: originalIndex.fileCount,
  changed, added, removed, allowedChanged, allowedAdded, unexpectedChanged, unexpectedAdded, missingNewFiles,
  oldIntentPrefixUnchanged, onlyExpectedTypeExports, oldFolderBuilderLinesPreserved, linksUnchanged,
  originalCopyFailures, unreadableBefore: before.unreadable, unreadableAfter: after.unreadable, scope: before.scope,
  pass: unexpectedChanged.length === 0 && unexpectedAdded.length === 0 && missingNewFiles.length === 0 && removed.length === 0 &&
    oldIntentPrefixUnchanged && onlyExpectedTypeExports && oldFolderBuilderLinesPreserved && linksUnchanged &&
    originalCopyFailures.length === 0 && before.unreadable.length === 0 && after.unreadable.length === 0,
  limitation: 'Explicit protected SHA scope. IntentPort appends only frozen types; WorldFolderBuilder preserves every old line with additive composition. Diff uses captured original bytes, without a Git repository.'};
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n');
cp.execFileSync('python', [path.join(__dirname, 'generate-diff.py')], {cwd: root, windowsHide: true});
console.log(JSON.stringify({pass: report.pass, baselinePathCount: report.baselinePathCount, finalPathCount: report.finalPathCount,
  changed, added, removed, unexpectedChanged, unexpectedAdded, missingNewFiles, oldIntentPrefixUnchanged,
  onlyExpectedTypeExports, oldFolderBuilderLinesPreserved, originalCopyFailures}));
process.exitCode = report.pass ? 0 : 1;
