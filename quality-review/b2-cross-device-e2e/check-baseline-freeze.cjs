'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baselineBytes = fs.readFileSync(path.join(__dirname, 'baseline-before.json'));
const indexBytes = fs.readFileSync(path.join(__dirname, 'original-source-index.json'));
const baseline = JSON.parse(baselineBytes.toString('utf8')), index = JSON.parse(indexBytes.toString('utf8'));
const snapshotFailures = index.files.filter(file => {
  const bytes = fs.readFileSync(path.join(__dirname, file.copy)); return bytes.length !== file.bytes || hash(bytes) !== file.sha256;
}).map(file => file.path);
const rootProductionFiles = ['assets/scripts/WorldFolderBuilder.ts', 'assets/scripts/SceneBuilder.ts',
  'assets/scripts/CrossDevicePrototype.ts', 'assets/scripts/WorldMigrationPrototype.ts',
  'src/director/CoreTransfer.ts', 'src/director/WorldMigration.ts', 'src/director/RealityPauseBoundary.ts',
  'src/presentation/SafePointDrainStorage.ts', 'src/presentation/CrossDeviceImportStorage.ts',
  'src/presentation/WorldMigrationStorage.ts', 'src/presentation/WorldMigrationContractAdapter.ts'];
const rootReadHashes = rootProductionFiles.map(file => {
  const original = baseline.files.find(value => value.path === file), bytes = fs.readFileSync(path.join(root, file));
  const readSha256 = hash(bytes); return { file, baselineSha256: original.sha256, readSha256,
    matchesFrozenBaseline: original.sha256 === readSha256, readAtUtc: new Date().toISOString() };
});
const evidenceScripts = ['creator-preview.cjs', 'prepare-preview-harness.cjs', 'run-preview.cjs', 'run-contract-regressions.cjs'];
const evidenceReadHashes = evidenceScripts.filter(file => fs.existsSync(path.join(__dirname, file))).map(file => {
  const bytes = fs.readFileSync(path.join(__dirname, file)); return { file: 'quality-review/b2-cross-device-e2e/' + file,
    readSha256: hash(bytes), bytes: bytes.length, readAtUtc: new Date().toISOString(),
    baselineScope: false, meaning: 'Read observation of root acceptance evidence script, not part of immutable protected production baseline.' };
});
const result = { schemaVersion: 1, phase: 'B2.4e baseline integrity', generatedAtUtc: new Date().toISOString(),
  frozenAtUtc: baseline.capturedAt, baselineManifestSha256: hash(baselineBytes), originalIndexSha256: hash(indexBytes),
  protectedPathCount: baseline.fileCount, canonicalSnapshotCount: index.fileCount, snapshotFailures,
  rootReadHashes, evidenceReadHashes,
  pass: snapshotFailures.length === 0 && rootReadHashes.every(value => value.matchesFrozenBaseline),
  limit: 'Checks the immutable original snapshots and read hashes. Evidence scripts may continue to be authored; final source and document drift require the separate end-of-batch audit.' };
fs.writeFileSync(path.join(__dirname, 'baseline-freeze-integrity.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: result.pass, protectedPathCount: result.protectedPathCount,
  canonicalSnapshotCount: result.canonicalSnapshotCount, snapshotFailures,
  rootReadMismatches: rootReadHashes.filter(value => !value.matchesFrozenBaseline), evidenceReadCount: evidenceReadHashes.length }));
