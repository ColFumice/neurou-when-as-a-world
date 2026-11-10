'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const evidence = read('acceptance-summary.json'), protection = read('protected-final-audit.json');
assert.equal(evidence.pass, true); assert.equal(protection.pass, true);
function info(file, kind) { const bytes = fs.readFileSync(path.join(root, file)); return { path: file, kind, bytes: bytes.length, sha256: hash(bytes) }; }
const quality = [];
function walk(directory) {
  for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    if (item.isSymbolicLink() || item.name === 'baseline' || item.name === 'delivery-manifest.json') continue;
    const file = directory + '/' + item.name;
    if (item.isDirectory()) walk(file);
    else if (item.isFile()) quality.push(info(file, file.includes('/diagnostic-') ? 'ArchivedHarnessDiagnostic' : 'DeliveryArtifact'));
  }
}
walk('quality-review/b2-state-core');
const production = protection.productionChanges.map(file => {
  const current = info(file.path, file.kind); assert.equal(current.sha256, file.sha256); return current;
});
for (const source of read('creator-preview-results.json').compilation) {
  assert.equal(info(source.file, 'PreviewSource').sha256, source.sourceSha256);
}
const manifest = { generatedAt: new Date().toISOString(), pass: true, batch: 'B2.2d-1',
  verdicts: 'VERDICT-241 through VERDICT-255', completeWorldStateImplemented: false,
  coreImplemented: ['Ledger', 'PuzzleProgress', 'FormatTime'],
  remainingNotImplemented: ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore'],
  worldForkAvailability: 'NotImplemented', evidence, production, quality,
  productionFileCount: production.length, qualityFileCount: quality.length,
  baselinePolicy: '285 original files and all backup bytes were verified by verify-delivery.cjs. Baseline duplicates are excluded from this artifact list; their hashes remain in protected-baseline.json.',
  diagnosticPolicy: 'Archived first harness assertion failure is retained and labeled, excluded from passing acceptance. Current fresh profile run and raw images alone substantiate production PASS.' };
fs.writeFileSync(path.join(__dirname, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, productionFileCount: production.length, qualityFileCount: quality.length,
  contractTests: evidence.contractTests.total, screenshotCount: evidence.productionAcceptance.rawScreenshotCount }));
