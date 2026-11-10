'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const output = path.join(__dirname, 'paused-evidence-summary.json');
if (fs.existsSync(output)) throw new Error('Paused summary is immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function evidence(name) { const bytes = fs.readFileSync(path.join(__dirname, name)), data = JSON.parse(bytes.toString('utf8')); return { path: 'evidence/' + name, sha256: sha(bytes), data }; }
const b24 = evidence('history-b24/implementation/results.json'), c1 = evidence('history-c1/implementation/results.json'), oldAuth = evidence('history-b-auth/implementation/results.json'), sharedPure = evidence('history-c2b-pure/results.json'), sharedHttp = evidence('history-c2b-http/verified-results.json');
const gate = evidence('gate-runs/current-paused-source-state/results.json'), server = evidence('server-paused-noemit-results.json'), audit = evidence('protected-implementation-paused-audit.json'), diff = evidence('wip-changed-files.json'), names = evidence('wip-new-names.json');
const history = [
  { ...b24, data: undefined, category: 'ContractAdapterLogicalFixture', passed: b24.data.counts.passed, pass: b24.data.pass },
  { ...c1, data: undefined, category: 'PureCanonicalValidatorReplay', passed: c1.data.counts.pass, pass: c1.data.pass },
  { ...oldAuth, data: undefined, category: 'OldAuth16ServerHttpPGPlus24ClientOraclePlus6ClientHttpPG', passed: oldAuth.data.counts.serverPass + oldAuth.data.counts.clientChecks, pass: oldAuth.data.pass },
  { ...sharedPure, data: undefined, category: 'Authority32ProtocolPlus18ClientTransportOracle', passed: sharedPure.data.counts.total, pass: sharedPure.data.pass },
  { ...sharedHttp, data: undefined, category: 'Authority20ServerAnd11ProductionAdapterRealHttpPG', passed: sharedHttp.data.counts.total, pass: sharedHttp.data.pass }
];
const report = { phase: 'B2.5c-2c paused P11 evidence index and interpretation', generatedUtc: new Date().toISOString(), status: 'PausedP11', stageComplete: false, history, historicalPassTotal: history.reduce((sum, item) => sum + item.passed, 0), pass: history.every(item => item.pass) && gate.data.pass && server.data.pass && audit.data.pass,
  currentSourceHealth: { gates: { path: gate.path, sha256: gate.sha256, pass: gate.data.pass, warningCount: 45 }, serverNoEmit: { path: server.path, sha256: server.sha256, pass: server.data.pass } },
  workInProgress: { audit: { path: audit.path, sha256: audit.sha256, pass: audit.data.pass, changed: audit.data.changed, added: audit.data.added }, diff: { path: 'evidence/wip-code.diff', sha256: diff.data.codeDiffSha256, sourceManifest: diff.path, sourceManifestSha256: diff.sha256 }, names: { path: names.path, sha256: names.sha256, publicTopLevelDeclarations: names.data.publicExportCount, cumulativePublicTopLevelDeclarations: names.data.cumulativeAdditiveCounts.publicTopLevelDeclarations, approvedVocabulary: false } },
  interpretation: [
    'All original baseline/protected-final-audit prerequisite files remain immutable. Paused implementation audit is separate; it proves current allowed bytes, not stage completion.',
    'The inherited baseline limits sentence No PG process or Relay test is started refers only to the original prerequisite capture stage. Afterwards the parent launched a new c-2c PostgreSQL17 cluster at 127.0.0.1:55438; current historical HTTP evidence uses separate new databases. No final Relay acceptance was run by this evidence task.',
    'c-2b HTTP raw summary false/-1 is preserved. Actual subprocesses and all cases passed; verified-results.json separately corrects a Node default spec reporter count-prefix parser, without changing raw logs or test assertions.',
    'Client agent disclosed one transient rewrite of accepted c-2b client-compiled session JS while directly rerunning the old oracle, then exact restoration from saved original source. Current protection audit hashes old evidence and proves final byte identity; it does not claim old generated evidence was never written during the session.',
    'All 508 passing checks are historical regression categories. They do not establish new Relay HTTP/PG acceptance, c-2d key delivery, c-2e full dual-client chain, LAN TLS, or product integration.',
    'Both pre-existing .shared-kernel trees have 14 hashed files each and no current changes. They remain the intermediate compile tree and intentional shared-dist runtime layout copy, not separate implementations or extra test cases.'
  ] };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ pass: report.pass, historicalPassTotal: report.historicalPassTotal, status: report.status, stageComplete: false }, null, 2));
