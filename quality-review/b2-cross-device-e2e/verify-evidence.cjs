'use strict';
// Read-only checks of the actual e run, current production, and delivered test evidence.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const bytes = file => fs.readFileSync(path.resolve(__dirname, file));
const read = file => JSON.parse(bytes(file));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const checkFile = (file, expected) => assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, file);
const sections = ['Ledger', 'PuzzleProgress', 'FormatTime', 'RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore'];

async function main() {
  const contracts = read('contract-regression-results.json');
  assert.equal(contracts.mode, 'ContractAdapter'); assert.equal(contracts.pass, true);
  assert.equal(contracts.passed, 227); assert.equal(contracts.expected, 227);
  assert.equal(contracts.runs.length, 9);
  assert.equal(contracts.originalScriptsAndAcceptedReports.unchanged, true);
  assert.equal(contracts.productionSources.unchanged, true);
  for (const group of [contracts.originalScriptsAndAcceptedReports, contracts.productionSources]) {
    assert.deepEqual(group.before, group.after);
    for (const file of group.after) checkFile(file.file, file.sha256);
  }
  for (const copy of contracts.copies) {
    checkFile(copy.source, copy.sourceSha256); checkFile(copy.copy, copy.copySha256);
  }
  const suites = contracts.runs.map(run => {
    assert.equal(run.pass, true); assert.equal(run.exitCode, 0);
    assert.equal(run.passed, run.expected);
    checkFile(run.isolatedReport, run.reportSha256);
    const report = JSON.parse(fs.readFileSync(path.join(root, run.isolatedReport), 'utf8'));
    const cases = report.cases ?? report.tests ?? report.results;
    assert.equal(report.summary?.passed ?? report.passed, run.passed);
    assert.equal(cases.length, run.expected);
    assert(cases.every(test => test.result === 'PASS' || test.pass === true));
    assert.equal(report.summary?.failed ?? report.failed ?? 0, 0);
    return {file: run.isolatedReport, passed: run.passed, sha256: run.reportSha256};
  });

  const gates = read('gate-results.json'); assert.equal(gates.pass, true);
  assert.deepEqual(gates.runs.map(run => run.command), ['npm run check:naming', 'npm run typecheck', 'npm run check:dependencies']);
  for (const gate of gates.runs) { assert.equal(gate.pass, true); assert.equal(gate.exitCode, 0); bytes(gate.log); }
  const preview = read('creator-preview-results.json'); assert.equal(preview.pass, true);
  assert.deepEqual(preview.rendererErrors, []); assert.deepEqual(preview.runtimeErrors, []); assert.deepEqual(preview.externalRequests, []);
  assert.equal(preview.resolutionComparison.pass, true); assert.equal(preview.compilationUnchanged, true);
  assert.equal(read('creator-preview-lifecycle.json').exitCode, 0);
  assert.equal(sha(bytes('creator-preview.cjs')), preview.harnessSha256);
  assert.deepEqual(preview.resolutions.map(r => [r.width, r.height]), [[1920, 1080], [2560, 1440]]);
  assert.equal(preview.compilation.length, 39);
  for (const source of preview.compilation) {
    assert.equal(source.sourceMapMatches, true); assert.equal(source.servedEqualsCompilerOutput, true);
    checkFile(source.file, source.sourceSha256);
    const compilerFile = path.join(root, 'temp/programming/packer-driver/targets/preview', source.chunk);
    assert.equal(sha(fs.readFileSync(compilerFile)), source.chunkSha256);
    const url = new URL('scripting/x/' + source.chunk, preview.previewUrl);
    const served = await fetch(url, {cache: 'no-store'}); assert.equal(served.ok, true);
    assert.equal(sha(Buffer.from(await served.arrayBuffer())), source.chunkSha256);
    const sourceMapResponse = await fetch(url + '.map', {cache: 'no-store'}); assert.equal(sourceMapResponse.ok, true);
    const map = await sourceMapResponse.json();
    assert(map.sourcesContent.includes(fs.readFileSync(path.join(root, source.file), 'utf8')), source.file);
  }

  const pngs = [], observations = [];
  for (const r of preview.resolutions) {
    for (const key of ['pass']) assert.equal(r[key], true);
    for (const key of ['transferAcceptance', 'migrationAcceptance', 'activeReplayPauseAcceptance', 'integratedAcceptance']) assert.equal(r[key].pass, true);
    assert.equal(r.migrationAcceptance.mode, 'ContractAdapter');
    assert.equal(r.migrationAcceptance.serviceClockAdvancedMs, 3600000); assert.equal(r.migrationAcceptance.realElapsedHour, false);
    assert.equal(r.activeReplayPauseAcceptance.serviceClockAdvancedMs, 0);
    assert.equal(r.screenshots.length, 20);
    for (const shot of r.screenshots) {
      const image = bytes(shot.file); assert.equal(sha(image), shot.sha256);
      assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [r.width, r.height]);
      assert.deepEqual(shot.state.viewport, [r.width, r.height]);
      assert.deepEqual(shot.state.canvas, [r.width, r.height]);
      assert.equal(shot.state.horizontalOverflow, false); assert.deepEqual(shot.state.errors, []);
      pngs.push({file: shot.file, sha256: shot.sha256, width: r.width, height: r.height});
    }
    const state = i => r.screenshots[i].state;
    const storage = i => state(i).storage;
    const account = encodeURIComponent(r.account), id = r.transferAcceptance.sourceWorldId, copy = r.transferAcceptance.targetWorldId;
    assert.notEqual(id, copy); assert.notEqual(id, 'InitialWorld'); assert.equal(id, r.migrationAcceptance.worldId);
    const sourceKey = 'neurou-world-state-v1:' + account + ':' + encodeURIComponent(id);
    const folderKey = 'neurou-world-folder-v1:' + account;
    const bKey = key => 'neurou-contract-device-b:' + encodeURIComponent(key);
    const copyKey = bKey('neurou-world-state-v1:' + account + ':' + encodeURIComponent(copy));
    const importKey = bKey('neurou-cross-device-import-v1:' + account);
    const bMigrationKey = bKey('neurou-migration-v1:' + account);
    const sourceCore = JSON.parse(storage(7)[sourceKey]), targetCore = JSON.parse(storage(14)[bKey(sourceKey)]);
    assert.deepEqual(targetCore, sourceCore); assert.deepEqual(Object.keys(sourceCore.sections), sections);
    const copyCore = JSON.parse(storage(8)[copyKey]);
    assert.equal(copyCore.worldId, copy); assert.equal(copyCore.accountId, r.account);
    assert.deepEqual(Object.keys(copyCore.sections), sections);
    assert.deepEqual(copyCore.sections.FormatTime, sourceCore.sections.FormatTime);
    for (let i = 8; i < 20; i++) {
      assert.equal(storage(i)[sourceKey], storage(7)[sourceKey]);
      assert.equal(storage(i)[copyKey], storage(8)[copyKey]);
      assert.equal(storage(i)[importKey], storage(8)[importKey]);
      for (const factKey of Object.keys(storage(7)).filter(k => k.startsWith('neurou-account-'))) assert.equal(storage(i)[factKey], storage(7)[factKey]);
    }
    for (let i = 8; i <= 16; i++) assert.equal(storage(i)[folderKey], storage(7)[folderKey]);
    assert(storage(14)[bMigrationKey]); assert.notEqual(importKey, bMigrationKey);
    const published = JSON.parse(storage(14)[bKey(folderKey)]).records;
    assert(published.some(record => record.worldId === copy && record.deletedAt === null));
    assert(published.some(record => record.worldId === id && record.deletedAt === null));
    const homes = i => JSON.parse(storage(i)['neurou-migration-contract-authority-v1']).registries.find(v => v.accountId === r.account).records;
    for (const i of [7, 8, 10, 13, 14, 19]) assert(!homes(i).some(v => v.worldId === 'InitialWorld'));
    assert.equal(homes(8).find(v => v.worldId === id).homeDeviceId, 'logical-device-a');
    assert.equal(homes(13).find(v => v.worldId === id).homeState, 'Released');
    const migratedHome = homes(14).find(v => v.worldId === id), copiedHome = homes(14).find(v => v.worldId === copy);
    assert.equal(migratedHome.homeDeviceId, 'logical-device-b'); assert.equal(migratedHome.homeRevision, 3);
    assert.equal(copiedHome.homeDeviceId, 'logical-device-b'); assert.equal(copiedHome.homeRevision, 1);
    assert.equal(JSON.parse(storage(10)['neurou-contract-service-clock-v1']), 0);
    assert.equal(JSON.parse(storage(13)['neurou-contract-service-clock-v1']), 3600000);
    assert.equal(storage(19)['neurou-contract-service-clock-v1'], storage(16)['neurou-contract-service-clock-v1']);
    for (const i of [9, 15, 16]) {
      assert.equal(state(i).restoreKind, 'Restored'); assert.equal(state(i).capture.kind, 'Complete');
      assert.equal(state(i).coreSnapshot.kind, 'Core');
      assert.equal(state(i).runtimeNode, i === 9 ? copy : id);
      assert.equal(state(i).capture.snapshot.worldId, i === 9 ? copy : id);
    }
    const media = r.activeReplayPauseAcceptance.observations;
    assert(media[1].media.time > media[0].media.time); assert(media[2].media.time > media[1].media.time);
    for (const item of media.slice(0, 3)) { assert.equal(item.active, true); assert.equal(item.media.ended, false); assert.equal(item.media.seeking, false); }
    assert.equal(media.at(-1).runtime, null); assert.equal(media.at(-1).active, false);
    assert(media.at(-1).events.some(event => event.type === 'ended' && event.ended && event.time === 6));
    assert.equal(state(19).frameDrivers, 0); assert.equal(state(19).inputCollectors, 0);
    assert.equal(r.activeReplayPauseAcceptance.completedPlayCountIncrement, 1);
    observations.push({resolution: r.resolution, copyWorldId: copy, migratedWorldId: id,
      copyHomeRevision: 1, migratedHomeRevision: 3, sevenSectionsExact: true,
      sourceAndAccountBytesPreserved: true, copyAndImportJournalBytesPreserved: true, naturalNativeEndSeconds: 6});
  }
  assert.equal(new Set(pngs.map(p => p.file)).size, 40);
  const pngGroups = new Map();
  for (const shot of pngs) pngGroups.set(shot.sha256, [...(pngGroups.get(shot.sha256) ?? []), shot.file]);
  const identicalScreenshotBytes = [...pngGroups.values()].filter(files => files.length > 1);
  const protection = read('protected-final-audit.json'), frozen = read('baseline-freeze-integrity.json');
  assert.equal(protection.pass, true); assert.equal(protection.sourceProtectionPass, true);
  assert.equal(protection.productionFileCount, 0); assert.deepEqual(protection.productionFiles, []);
  for (const key of ['unexpectedChanged', 'unexpectedAdded', 'unexpectedRemoved', 'originalCopyFailures']) assert.deepEqual(protection[key], []);
  assert.equal(frozen.pass, true); assert.equal(sha(bytes('baseline-before.json')), frozen.baselineManifestSha256);
  assert.equal(sha(bytes('original-source-index.json')), frozen.originalIndexSha256);
  for (const change of protection.authorizedDocumentChanges) { assert.equal(change.attribution, 'TraeAuthorized'); checkFile(change.path, change.finalSha256); }
  assert.equal(bytes('production-code.diff').length, 0);
  const closure = read('d-audit-protocol-closure.json');
  assert.equal(closure.protocolAttributionAccepted, true); assert.equal(closure.violationResolved, true);
  assert.equal(closure.historicalArtifactsRewritten, false);
  for (const artifact of closure.immutableHistoricalArtifacts) assert.equal(sha(bytes(artifact.path)), artifact.sha256);
  const changes = read('change-files.json'); assert.equal(changes.productionFileCount, 0);
  for (const file of changes.testFiles) checkFile(file.path, file.finalSha256);
  const peer = read('peer-evidence-integrity-results.json'); assert.equal(peer.pass, true);
  assert.equal(peer.compiledModulesVerified, 39); assert.equal(peer.pngVerified, 40);
  assert.equal(peer.harnessMatches, true);
  const summary = {schemaVersion: 1, generatedAt: new Date().toISOString(), phase: 'B2.4e final evidence consistency',
    pass: true, evidenceIntegrityPass: true, sourceProtectionPass: true, authorizedProtectionPolicyPass: true,
    rawProtectedHashEquality: protection.rawHashEquality, productionSourceChanges: 0, newRuntimeNames: 0,
    contractAdapterPassed: 227, suites, gates: gates.runs.map(({command, pass, summary}) => ({command, pass, summary})),
    creatorPreview: {pass: true, sourceModules: 39, screenshots: 40, finishedAt: preview.finishedAt,
      authorityMode: 'ContractAdapter', realElapsedHour: false, serviceClockAdvancedMs: 3600000,
      activeReplayServiceClockAdvancedMs: 0, rendererErrors: 0, runtimeErrors: 0, externalRequests: 0,
      resolutionComparison: preview.resolutionComparison, observations,
      uniquePngByteHashes: pngGroups.size, identicalScreenshotBytes,
      identityEvidence: 'Equal inherited Core content can render identical images. World identity is verified from contemporaneous runtime, Core, directory, Home and journal observations.'}, pngs,
    historicalDocAttributionClosed: true, historicalRawAuditRewritten: false,
    authorizedConcurrentDocs: protection.authorizedDocumentChanges.map(v => ({path: v.path, attribution: v.attribution, sha256: v.finalSha256})),
    evidenceSha256: Object.fromEntries(['creator-preview.cjs', 'creator-preview-results.json', 'contract-regression-results.json',
      'gate-results.json', 'protected-final-audit.json', 'baseline-before.json', 'original-source-index.json', 'baseline-freeze-integrity.json',
      'peer-evidence-integrity-results.json', 'd-audit-protocol-closure.json',
      'code.diff', 'acceptance-harness.diff', 'change-files.json'].map(file => [file, sha(bytes(file))])),
    limitations: ['Restricted Core prototype; two fixed logical devices', 'Explicit service fixture clock advance; no actual elapsed hour',
      'No real external services, full FileCarry, platform uptime OfflineGrace, or non-Primary production migration']};
  fs.writeFileSync(path.join(__dirname, 'validation-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({pass: true, contracts: 227, screenshots: 40, sourceModules: 39, productionSourceChanges: 0,
    rawProtectedHashEquality: protection.rawHashEquality, authorizedConcurrentDocs: protection.authorizedDocumentChanges.length}));
}
main().catch(error => {console.error(error); process.exitCode = 1;});
