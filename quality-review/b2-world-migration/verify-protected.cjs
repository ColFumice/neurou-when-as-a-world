'use strict';
// Fixed allowlist review. This never discovers allowed source changes from the final checkout.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
cp.execFileSync(process.execPath, [path.join(__dirname, 'capture-baseline.cjs'), 'baseline-after.json'], { windowsHide: true });
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-before.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-after.json'), 'utf8'));
const originalIndex = JSON.parse(fs.readFileSync(path.join(__dirname, 'original-source-index.json'), 'utf8'));
const previous = new Map(before.files.map(file => [file.path, file])), current = new Map(after.files.map(file => [file.path, file]));
const changed = [], removed = [], added = [];
for (const [file, record] of previous) {
  const next = current.get(file);
  if (!next) removed.push(file);
  else if (next.sha256 !== record.sha256 || next.bytes !== record.bytes) changed.push(file);
}
for (const file of current.keys()) if (!previous.has(file)) added.push(file);
const allowedCanonicalChanged = [
  'src/director/IntentPort.ts',
  'assets/scripts/SceneBuilder.ts',
  'assets/scripts/WorldFolderBuilder.ts',
  'assets/scripts/CrossDevicePrototype.ts',
];
const allowedChanged = [...allowedCanonicalChanged, 'assets/scripts/src/director/IntentPort.ts'];
const allowedCanonicalAdded = [
  'src/director/WorldMigration.ts', 'src/director/RealityPauseBoundary.ts',
  'src/presentation/SafePointDrainStorage.ts', 'src/presentation/WorldMigrationContractAdapter.ts',
  'src/presentation/WorldMigrationStorage.ts', 'assets/scripts/WorldMigrationPrototype.ts',
].flatMap(file => [file, file + '.meta']);
const allowedAdded = [...allowedCanonicalAdded,
  ...allowedCanonicalAdded.filter(file => file.startsWith('src/')).map(file => 'assets/scripts/' + file)];
const unexpectedChanged = changed.filter(file => !allowedChanged.includes(file));
const unexpectedAdded = added.filter(file => !allowedAdded.includes(file));
const missingNewFiles = allowedAdded.filter(file => !added.includes(file));
const normalizeLines = text => text.replace(/\r\n/g, '\n');
const originalText = file => normalizeLines(fs.readFileSync(path.join(__dirname, 'original-source', file), 'utf8'));
const currentText = file => normalizeLines(fs.readFileSync(path.join(root, file), 'utf8'));
const originalIntent = originalText('src/director/IntentPort.ts'), currentIntent = currentText('src/director/IntentPort.ts');
const oldIntentLogicPrefixUnchanged = currentIntent.startsWith(originalIntent);
const expectedSuffix = '// B2.4d same-ID migration and account admission contracts, erased at runtime.\n' +
  'export type { SafePointDrainWorld, SafePointDrainConfirmation, SafePointDrainCapability,\n' +
  '  SafePointDrainAcceptance, SafePointDrainPort, MigrationReleaseRequest, MigrationClaimRequest,\n' +
  '  RealityPauseRecord, DeviceAccountBinding, RestrictedMigrationCorePayload, MigrationReceipt,\n' +
  '  MigrationAdmission, MigrationAuthorityPort, WorldMigrationPhase, WorldMigrationEntry,\n' +
  "  WorldMigrationJournal, WorldMigrationStorageReceipt, MigrationCompleteValidator } from './WorldMigration';\n";
const onlyExpectedTypeExports = oldIntentLogicPrefixUnchanged && currentIntent.slice(originalIntent.length) === expectedSuffix;
const linksUnchanged = JSON.stringify(before.symbolicLinks) === JSON.stringify(after.symbolicLinks);
const originalCopyFailures = originalIndex.files.filter(file => {
  const bytes = fs.readFileSync(path.join(__dirname, file.copy));
  return bytes.length !== file.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256;
}).map(file => file.path);
const immutableOriginals = before.files.filter(file => !allowedChanged.includes(file.path));
const immutableFailures = immutableOriginals.filter(file => {
  const next = current.get(file.path); return !next || next.sha256 !== file.sha256 || next.bytes !== file.bytes;
}).map(file => file.path);
const exactGroup = predicate => {
  const members = before.files.filter(predicate);
  const failures = members.filter(file => immutableFailures.includes(file.path)).map(file => file.path);
  return { pathCount: members.length, failures, pass: failures.length === 0 };
};
const frozenCore = exactGroup(file => /^(src|assets\/scripts\/src)\//.test(file.path) && !allowedChanged.includes(file.path));
const docsNamesReferences = exactGroup(file => /^docs\//.test(file.path) || /^(雨若_|archive\/|\.trae\/|编辑器\/)/.test(file.path));
const settingsScenes = exactGroup(file => /^(settings|profiles|\.creator)\//.test(file.path) || /\.(scene|prefab)$/.test(file.path));
const legacyCrossDeviceCore = exactGroup(file => /\/(CoreTransfer|CoreTransferContent|CrossDeviceContractAdapter|CrossDeviceImportStorage)\.ts(?:\.meta)?$/.test(file.path));
const compositionChanges = allowedCanonicalChanged.filter(file => file !== 'src/director/IntentPort.ts').map(file => ({
  file, changed: changed.includes(file), originalSha256: previous.get(file)?.sha256,
  finalSha256: current.get(file)?.sha256,
  review: 'Authorized composition hooks and routing only; exact modifications are disclosed in code.diff. This audit does not claim every original line is preserved.',
}));
const pass = unexpectedChanged.length === 0 && unexpectedAdded.length === 0 && missingNewFiles.length === 0 &&
  removed.length === 0 && oldIntentLogicPrefixUnchanged && onlyExpectedTypeExports && linksUnchanged &&
  originalCopyFailures.length === 0 && immutableFailures.length === 0 && before.unreadable.length === 0 && after.unreadable.length === 0;
const report = { schemaVersion: 1, phase: 'B2.4d', generatedAt: new Date().toISOString(), algorithm: 'sha256', pass,
  baselinePathCount: before.fileCount, finalPathCount: after.fileCount, originalSourceCopyCount: originalIndex.fileCount,
  changed, added, removed, allowedCanonicalChanged, allowedChanged, allowedCanonicalAdded, allowedAdded,
  unexpectedChanged, unexpectedAdded, missingNewFiles, oldIntentLogicPrefixUnchanged, onlyExpectedTypeExports,
  linksUnchanged, originalCopyFailures, immutableOriginalPathCount: immutableOriginals.length, immutableFailures,
  protectedGroups: { frozenCore, docsNamesReferences, settingsScenes, legacyCrossDeviceCore }, compositionChanges,
  unreadableBefore: before.unreadable, unreadableAfter: after.unreadable, scope: before.scope,
  limitation: 'Fixed protected SHA scope and fixed six new module allowlist. Three composition roots have authorized admission/routing changes, fully shown in the original-source diff; IntentPort retains the complete normalized old prefix and appends only exact erased type exports. Every other old path must retain exact bytes. This is not a semantic proof of composition code.' };
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n');
cp.execFileSync('python', [path.join(__dirname, 'generate-diff.py')], { cwd: root, windowsHide: true });
console.log(JSON.stringify({ pass, baselinePathCount: report.baselinePathCount, finalPathCount: report.finalPathCount,
  originalSourceCopyCount: report.originalSourceCopyCount, changed, added, removed,
  unexpectedChanged, unexpectedAdded, missingNewFiles, oldIntentLogicPrefixUnchanged, onlyExpectedTypeExports,
  originalCopyFailures, immutableFailures, protectedGroups: report.protectedGroups }));
process.exitCode = pass ? 0 : 1;
