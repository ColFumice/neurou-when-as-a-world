'use strict';
// Read-only consistency checks of delivered evidence against final source and PNG bytes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const suites = [
  ['drain-contract-results.json', 20], ['boundary-contract-results.json', 8],
  ['authority-contract-results.json', 32], ['storage-contract-results.json', 34],
  ['prototype-contract-results.json', 12],
].map(([file, expected]) => {
  const value = read(file); assert.equal(value.mode, 'ContractAdapter'); assert.equal(value.passed, expected);
  assert.equal(value.failed ?? 0, 0); if ('pass' in value) assert.equal(value.pass, true);
  for (const source of value.sourceFiles ?? []) assert.equal(sha(fs.readFileSync(path.join(root, source.file))), source.sha256);
  return {file, mode: value.mode, passed: expected, sha256: sha(fs.readFileSync(path.join(__dirname, file)))};
});
const regressions = [
  ['../b2-cross-device-core/contract-results.json', 59], ['../b2-cross-device-core/prototype-contract-results.json', 6],
].map(([file, expected]) => {
  const value = read(file); assert.equal(value.pass, true); assert.equal(value.passed, expected);
  return {file, passed: expected, sha256: sha(fs.readFileSync(path.join(__dirname, file)))};
});
const gates = read('gate-results.json'); assert.equal(gates.pass, true); assert.equal(gates.runs.length, 3);
const preview = read('creator-preview-results.json'); assert.equal(preview.pass, true);
assert.deepEqual(preview.rendererErrors, []); assert.deepEqual(preview.runtimeErrors, []); assert.deepEqual(preview.externalRequests, []);
assert.deepEqual(preview.resolutions.map(value => [value.width, value.height]), [[1920,1080],[2560,1440]]);
assert.equal(sha(fs.readFileSync(path.join(__dirname, 'creator-preview.cjs'))), preview.harnessSha256);
for (const source of preview.compilation) {
  assert.equal(source.sourceMapMatches, true); assert.equal(source.servedEqualsCompilerOutput, true);
  assert.equal(sha(fs.readFileSync(path.join(root, source.file))), source.sourceSha256);
  assert.equal(sha(fs.readFileSync(path.join(root, 'temp/programming/packer-driver/targets/preview', source.chunk))), source.chunkSha256);
}
for (const value of preview.resolutions) {
  assert.equal(value.pass, true); assert.equal(value.migrationAcceptance.pass, true); assert.equal(value.activeReplayPauseAcceptance.pass, true);
  assert.equal(value.migrationAcceptance.realElapsedHour, false); assert.equal(value.migrationAcceptance.serviceClockAdvancedMs, 3600000);
  assert.equal(value.activeReplayPauseAcceptance.serviceClockAdvancedMs, 0); assert.equal(value.screenshots.length, 17);
  for (const shot of value.screenshots) {
    const bytes = fs.readFileSync(path.join(__dirname, shot.file)); assert.equal(sha(bytes), shot.sha256);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)], [value.width,value.height]);
  }
}
const changes = read('change-files.json');
for (const file of changes.files) assert.equal(sha(fs.readFileSync(path.join(root,file.path))),file.finalSha256);
const protection = read('protected-final-audit.json'), drift = read('observed-doc-drift.json');
assert.equal(protection.pass, false); assert.deepEqual(protection.unexpectedChanged.sort(), ['docs/NAMEBOOK.md','docs/spec/stage-1.md']);
assert.deepEqual(protection.originalCopyFailures, []); assert.deepEqual(protection.unexpectedAdded, []);
assert.deepEqual(protection.removed, []); assert.equal(drift.authoredSourceScopePass, true);
for (const file of drift.observations) assert.equal(sha(fs.readFileSync(path.join(root,file.path))),file.currentSha256);
const summary = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), phase: 'B2.4d final evidence consistency',
  implementationValidationPass: true, evidenceIntegrityPass: true, completeProtectedAuditPass: false,
  protectionException: 'Two official documents drifted after baseline; provenance remains unverified. No allowlist or original baseline changes.',
  suites, contractAdapterPassed: suites.reduce((sum,value)=>sum+value.passed,0),
  regressions, crossDeviceCRegressionPassed: regressions.reduce((sum,value)=>sum+value.passed,0),
  gates: gates.runs.map(({command,pass,summary})=>({command,pass,summary})),
  creatorPreview: {pass:true, sourceModules:preview.compilation.length, screenshots:34,
    finishedAt:preview.finishedAt, resolutions:preview.resolutions.map(value=>({resolution:value.resolution,
      migrationPass:value.migrationAcceptance.pass, activeReplayPausePass:value.activeReplayPauseAcceptance.pass})),
    realElapsedHour:false, authorityMode:'ContractAdapter', rendererErrors:0,runtimeErrors:0,externalRequests:0},
  canonicalChangedFiles:changes.files.filter(value=>value.kind==='changed').length,
  canonicalAddedFiles:changes.files.filter(value=>value.kind==='added').length,
  limitations:['Restricted Core prototype','Two fixed logical device identities','Explicit independent service fixture clock advancement',
    'No real external services, full FileCarry, platform uptime OfflineGrace, or non-Primary production migration',
    'Documentation drift prevents a whole-workspace protection PASS'],
};
fs.writeFileSync(path.join(__dirname,'validation-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
