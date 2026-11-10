'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runName = process.argv[2] || 'final';
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runName)) throw new Error('Use a short immutable run name.');
const out = path.join(__dirname, 'history-b24', runName);
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Prior regression cannot be overwritten.');
fs.mkdirSync(out, { recursive: true });
const sourcePath = 'quality-review/b2-cross-device-e2e/run-contract-regressions.cjs';
const original = fs.readFileSync(path.join(root, sourcePath), 'utf8');
const anchor = "const workspace = path.resolve(__dirname, '../..');";
if (!original.includes(anchor)) throw new Error('Historical suite root anchor changed.');
const copy = original.replace(anchor, 'const workspace = ' + JSON.stringify(root) + ';');
const runner = path.join(out, 'run-contract-regressions.cjs'); fs.writeFileSync(runner, copy);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const startedUtc = new Date().toISOString();
const child = cp.spawn(process.execPath, [runner], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const chunks = []; child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes));
child.on('error', error => chunks.push(Buffer.from(String(error))));
child.on('close', exitCode => {
  const logBytes = Buffer.concat(chunks); fs.writeFileSync(path.join(out, 'regression.log'), logBytes);
  const reportPath = path.join(out, 'contract-regression-results.json');
  const oldReport = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
  const result = { phase: 'B2.5c-2b B2.4e historical regression', runName, startedUtc, completedUtc: new Date().toISOString(), nodeVersion: process.version, command: [process.execPath, runner], exitCode,
    sourceCopy: { sourcePath, sourceSha256: hash(original), currentSourceSha256: hash(fs.readFileSync(path.join(root, sourcePath))), copySha256: hash(copy), rewrite: 'Only workspace root anchor; suite/assertions/report handling unchanged, all output in this new c-2b directory.' },
    log: path.relative(__dirname, path.join(out, 'regression.log')).replaceAll('\\', '/'), logSha256: hash(logBytes),
    report: path.relative(__dirname, reportPath).replaceAll('\\', '/'), counts: { expected: oldReport?.expected ?? -1, passed: oldReport?.passed ?? -1 },
    originalScriptsAndReportsUnchanged: oldReport?.originalScriptsAndAcceptedReports.unchanged ?? false, productionSourcesStableDuringRun: oldReport?.productionSources.unchanged ?? false,
    pass: exitCode === 0 && !!oldReport?.pass && oldReport.passed === 227 && oldReport.expected === 227 && hash(original) === hash(fs.readFileSync(path.join(root, sourcePath))),
    limits: 'ContractAdapter logical-device fixture regression, not real HTTP shared authority/network/client/physical-device acceptance. Existing source suites, assertions and accepted reports remain read-only.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ pass: result.pass, counts: result.counts, originalScriptsAndReportsUnchanged: result.originalScriptsAndReportsUnchanged, productionSourcesStableDuringRun: result.productionSourcesStableDuringRun }, null, 2)); process.exitCode = result.pass ? 0 : 1;
});
