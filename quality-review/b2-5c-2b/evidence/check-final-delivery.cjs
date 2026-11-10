'use strict';
// Read-only consistency check of completed public artifacts; no service or secret reads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const workspace = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = [];
const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
const audit = read('protected-final-audit.json');
const changes = read('changed-files.json');
check('final protection and original IntentPort byte/type-only prefix', audit.pass && audit.beforeCount === 7179
  && audit.changed.join('|') === 'src/director/IntentPort.ts' && audit.removed.length === 0
  && audit.unauthorizedChanged.length === 0 && audit.unauthorizedAdded.length === 0
  && audit.intentPort.prefixPreserved && audit.intentPort.suffixTypeOnly && audit.intentPort.suffixBytes === 1133);
check('23 implementation files and complete diff exact bytes/hash', changes.pass && changes.sourceFileCount === 23
  && changes.addedFiles === 22 && changes.modifiedFiles === 1
  && sha(fs.readFileSync(path.join(__dirname, 'code.diff'))) === changes.codeDiffSha256
  && sha(fs.readFileSync(path.join(__dirname, 'protected-final-audit.json'))) === changes.finalProtectionAuditSha256);
for (const file of changes.files) {
  check('final source unchanged: ' + file.path, sha(fs.readFileSync(path.join(workspace, file.path))) === file.sha256);
}
const gates = read('gate-runs/version-final/results.json');
check('three original gates pass; 45 warning lines unchanged', gates.pass && gates.runs.length === 3
  && gates.runs.every(run => run.exitCode === 0) && gates.warningComparison.exactLinesEqual
  && gates.warningComparison.currentWarnings === 45 && gates.warningComparison.added.length === 0);
const erasure = read('intent-type-erasure.json');
check('IntentPort emitted runtime identical', erasure.pass && erasure.runtimeBytesEqual && erasure.noNewRuntimeDependency);
check('pure ES2020 no-platform compile', read('logic-isolated-final/results.json').pass);
check('protocol compiled source output still matches', read('protocol-final-build-consistency.json').pass);
const protocol = read('protocol/results.json');
check('32 pure contract checks', protocol.passed === 32 && protocol.failed === 0);
const client = read('client-contract-run/signing-coverage/results.json');
check('18 client oracle checks', client.pass && client.summary.passed === 18
  && client.summary.kind === 'ContractOracle' && !client.summary.realHttp && !client.summary.realPostgreSQL);
const realClient = read('client-real-http-run/verified/results.json');
check('11 real production client checks; 16 port methods', realClient.passed === 11 && realClient.failed === 0
  && realClient.realHttp && realClient.realPostgreSQL && realClient.realClock && !realClient.isolatedClock
  && realClient.authorityMethods.length === 16 && realClient.emptyProductionSealOnly);
check('earlier positive client evidence accurately scoped', read('compatibility-source-change-note.json').pass);
check('20 server checks and clock classifications recorded', read('server-validation-results.json').pass);
check('historical B2.4 pass', read('history-b24/final/results.json').pass);
check('historical c-1 pass', read('history-c1/final/results.json').pass);
check('historical b auth pass', read('history-b-auth/final/results.json').pass);
check('temporary PG listener cleanly stopped; data retained', read('runtime-lifecycle.json').pass);
check('final public scoped credential scan', read('shareable-final-document-audit.json').pass);
check('document evidence references exist', read('inline-evidence-path-audit.json').pass);
for (const file of ['delivery-report.md', 'verdicts-441-447.md', 'namebook-v3.20-appendix-proposal.md',
  'implementation-plan.md', 'client-and-server-independent-review.md']) {
  check('delivered document: ' + file, fs.existsSync(path.resolve(__dirname, '..', file)));
}
const pass = checks.every(item => item.pass);
const result = { phase: 'B2.5c-2b final delivery artifact consistency', checkedUtc: new Date().toISOString(), pass, checks,
  sourceFileCount: changes.sourceFileCount, codeDiffSha256: changes.codeDiffSha256,
  scope: 'Public completed source/evidence/document consistency only; does not add mechanism tests or certify Relay, key packages, dual-client replay, LAN TLS or elapsed production H. Public inventory is a timestamped snapshot that predates this final QA artifact; no private runtime paths were read.' };
const outputName = process.argv[2] || 'final-delivery-validation.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use an evidence JSON basename.');
const output = path.join(__dirname, outputName);
if (fs.existsSync(output)) throw new Error('Final QA record is immutable.');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass, checked: checks.length, failures: checks.filter(item => !item.pass).map(item => item.name) }));
process.exitCode = pass ? 0 : 1;
