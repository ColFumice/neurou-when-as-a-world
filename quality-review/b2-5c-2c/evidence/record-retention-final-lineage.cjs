'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'validation-retention-final-lineage.json');
if (fs.existsSync(output)) throw new Error('Retention final lineage is immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const artifact = name => { const bytes = fs.readFileSync(path.join(phase, name)); return { path: name, bytes: bytes.length, sha256: sha(bytes) }; };
const json = name => { const item = artifact('evidence/' + name); return { ...item, data: JSON.parse(fs.readFileSync(path.join(phase, item.path), 'utf8')) }; };
const current = name => sha(fs.readFileSync(path.join(root, name)));
const manifest = json('changed-files-final.json'), oldManifest = json('changed-files.json'), audit = json('protected-retention-final-audit.json');
const gate = json('gate-runs/retention-final/results.json'), build = json('server-build-checks/retention-final/results.json');
const finalServerHashes = json('after-retention-fix/server-source-generated-sha256.json');
const oldValidation = json('validation-final-lineage.json'), history = json('paused-evidence-summary.json');
const oracle = json('client-relay-contract/results.json'), deadlines = json('p10-deadline-results.json');
const serverHarness = artifact('server-relay-tests.mjs');
const serverRuns = [
  { name: 'FullServerRelay', result: 'server-relay-results.json', log: 'server-relay.log', expectedCount: 20, suffix: [], observedExecSession: 8621 },
  { name: 'FirstEnqueueConcurrency', result: 'server-relay-concurrency-results.json', log: 'server-relay-concurrency.log', expectedCount: 2, suffix: ['--concurrency-only'] },
  { name: 'OldGenerationRetention', result: 'server-old-generation-retention-results.json', log: 'server-old-generation-retention.log', expectedCount: 2, suffix: ['--old-generation-retention-only'] }
].map(item => {
  const result = json('after-retention-fix/' + item.result);
  return { name: item.name, actualExitCode: 0, executionEvidenceSource: 'Server agent supplied completed actual command/exit0; preserved raw results/log and source snapshot independently linked here.', observedExecSession: item.observedExecSession ?? null,
    command: ['node', 'quality-review/b2-5c-2c/server-relay-tests.mjs', 'quality-review/b2-5c-2c/evidence/runtime/.local/connection.json', 'quality-review/b2-5c-2c/evidence/after-retention-fix/' + item.result, ...item.suffix], cwd: root,
    shellRedirection: '> quality-review/b2-5c-2c/evidence/after-retention-fix/' + item.log + ' 2>&1',
    result: { path: result.path, sha256: result.sha256 }, log: artifact('evidence/after-retention-fix/' + item.log), harness: serverHarness,
    counts: { passed: result.data.passed, failed: result.data.failed, total: result.data.total },
    clockCategories: { productionRealWall: result.data.results.filter(value => value.clock === 'production-real-wall').length, explicitlyIsolatedClock: result.data.results.filter(value => value.clock !== 'production-real-wall').length },
    expectedCount: item.expectedCount, pass: result.data.passed === item.expectedCount && result.data.failed === 0 && result.data.total === item.expectedCount };
});
const clientMetadata = json('after-retention-fix/client-run-lineage.json');
const clientResult = json('after-retention-fix/client-real-http-results.json');
const client = { name: 'ProductionRelayAdapterRealLoopbackHttpPgWithIsolatedCryptoAndHostCache', execution: clientMetadata, result: { path: clientResult.path, sha256: clientResult.sha256 }, counts: { passed: clientResult.data.passed, failed: clientResult.data.failed },
  pass: clientMetadata.data.actualExitCode === 0 && clientResult.data.passed === 22 && clientResult.data.failed === 0,
  limits: 'Final source real HTTP/PG run with production adapters and c-1 validator; native crypto oracle and isolated WAL cache injected. No full key-delivery, dual-client product replay, platform durability or LAN TLS certification.' };
const sourceLineage = manifest.data.files.concat(manifest.data.generatedFiles).map(file => ({ path: file.path, deliveredSha256: file.sha256, currentSha256: current(file.path), exactFinalBytes: current(file.path) === file.sha256 }));
const serverFinalVersionChecks = finalServerHashes.data.map(item => ({ ...item, currentSha256: current(item.path), equalsFinalTestSnapshot: current(item.path) === item.sha256 }));
const oldVersionChanges = oldManifest.data.files.concat(oldManifest.data.generatedFiles).map(file => ({ path: file.path, beforeRetentionFixSha256: file.sha256, finalSha256: current(file.path) })).filter(file => file.beforeRetentionFixSha256 !== file.finalSha256);
const expectedRetentionChanges = ['server/src/RelayStorage.ts', 'server/shared-dist/src/RelayStorage.js'];
const report = {
  phase: 'B2.5c-2c final validation after Relay old-generation retention fix', generatedUtc: new Date().toISOString(), nodeVersion: process.version,
  finalRealHttpPgRuns: [...serverRuns, client], finalTestedServerSource: { path: finalServerHashes.path, sha256: finalServerHashes.sha256 },
  finalThreeGates: { path: gate.path, sha256: gate.sha256, pass: gate.data.pass }, finalIndependentBuildNoEmit: { path: build.path, sha256: build.sha256, pass: build.data.pass, runs: build.data.runs },
  sourceLineage, serverFinalVersionChecks, retentionFixVersionChanges: oldVersionChanges,
  unchangedContractOracles: { client: { path: oracle.path, sha256: oracle.sha256, passed: oracle.data.passed, realHttp: false }, deadline: { path: deadlines.path, sha256: deadlines.sha256, passed: deadlines.data.passed, simulatedElapsedClock: true }, rerunAfterFix: false, justification: 'RelayStorage-only correction leaves adapter, session, request-deadline logic and pure codec/validator unchanged; targeted server and client real-network suites were rerun against final generated Storage.' },
  historicalRegression: { path: history.path, sha256: history.sha256, passedTotal: history.data.historicalPassTotal, rerunAfterFix: false, justification: 'No prior core source or test logic changed. Historical regressions remain immutable before-retention-fix evidence, separately identified from final Relay runs.' },
  beforeRetentionFixValidationSnapshot: { path: oldValidation.path, sha256: oldValidation.sha256, finalAtOriginalRecording: true, currentFinalVersionClaim: false, note: 'Original server20/first-enqueue2/client22 used the prior RelayStorage version. New after-retention-fix suites establish final Storage behavior; original records remain unchanged.' },
  protection: { path: audit.path, sha256: audit.sha256, pass: audit.data.pass, intentPrefixPreserved: audit.data.intent.prefixPreserved, exactP10Bytes: audit.data.session.exactApprovedP10Bytes, protectedKernelChanges: audit.data.protectedKernelTrees.reduce((sum, item) => sum + item.changed.length + item.added.length + item.removed.length, 0) },
  runtimeStop: artifact('evidence/after-retention-fix/runtime-stop.log'),
  pass: serverRuns.every(item => item.pass) && client.pass && gate.data.pass && build.data.pass && audit.data.pass && sourceLineage.every(item => item.exactFinalBytes) && serverFinalVersionChecks.every(item => item.equalsFinalTestSnapshot) && oldVersionChanges.length === 2 && oldVersionChanges.every(item => expectedRetentionChanges.includes(item.path)) && oracle.data.passed === 32 && deadlines.data.passed === 13 && history.data.historicalPassTotal === 508,
  limits: 'Actual final server and client executions are linked to immutable raw logs/results and delivered source hashes; review statements are evidence attribution rather than reconstructed terminal execution. Expiry advances use explicitly isolated clocks, not a claim of waiting 24 hours. The retention cleanup is lazy request-triggered cleanup, not a background wall-clock erasure guarantee. This record does not certify excluded c-2d/c-2e/c-2f or product stages.'
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, finalRealServerHttpPg: serverRuns.reduce((sum, item) => sum + item.counts.passed, 0), finalRealClientHttpPg: client.counts.passed, contractOraclesPreserved: 45, historyPreserved: history.data.historicalPassTotal, retentionFixVersionChanges: oldVersionChanges }, null, 2));
process.exitCode = report.pass ? 0 : 1;
