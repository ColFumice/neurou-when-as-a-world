'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const out = path.join(__dirname, 'history-c2b-http');
const output = path.join(out, 'verified-results.json');
if (fs.existsSync(output)) throw new Error('Verification result is immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rawBytes = fs.readFileSync(path.join(out, 'results.json')), raw = JSON.parse(rawBytes.toString('utf8'));
const serverLogBytes = fs.readFileSync(path.join(out, 'shared-authority.log')), serverText = serverLogBytes.toString('utf8');
const adapterBytes = fs.readFileSync(path.join(out, 'client/evidence/client-real-http-results.json')), adapter = JSON.parse(adapterBytes.toString('utf8'));
const count = name => Number(serverText.match(new RegExp('^(?:#|ℹ) ' + name + '\\s+(\\d+)\\s*$', 'm'))?.[1] ?? -1);
const runsPassed = raw.runs.every(item => item.exitCode === 0 && item.pass);
const report = { phase: 'B2.5c-2c paused WIP historical c-2b HTTP/PG regression verification', verifiedUtc: new Date().toISOString(), rawRecord: { path: 'results.json', sha256: sha(rawBytes), pass: raw.pass, preservedUnchanged: true }, sourceLog: { path: 'shared-authority.log', sha256: sha(serverLogBytes) }, adapterReport: { path: 'client/evidence/client-real-http-results.json', sha256: sha(adapterBytes) },
  correction: 'The wrapper summary initially parsed only TAP # count lines. Node24 default specs reported ℹ tests/pass/fail; the actual 20 server cases and 11 production adapter cases exited 0. This independent verification parses either documented reporter count prefix and preserves original false/-1 raw summary without rewriting it.',
  counts: { authorityServerTests: count('tests'), authorityServerPass: count('pass'), authorityServerFail: count('fail'), authorityAdapterChecks: adapter.passed, total: count('pass') + adapter.passed }, sources: raw.sources, runs: raw.runs,
  pass: runsPassed && count('tests') === 20 && count('pass') === 20 && count('fail') === 0 && adapter.passed === 11 && raw.sources.every(item => item.sha256 === item.finalSha256), scope: raw.scope + ' This verifies historical cases only. Current c-2c mechanisms are paused at new P11; no Relay completion or final acceptance is claimed.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, counts: report.counts, originalRawPreserved: true, correction: 'Summary reporter-prefix parser only; all actual test subprocesses exited 0.' }, null, 2));
