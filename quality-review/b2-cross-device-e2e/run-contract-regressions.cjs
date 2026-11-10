'use strict';
// B2.4e reuses accepted contract suites in isolated copies. Production and old reports are read-only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

const workspace = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'contract-regressions');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(workspace, file).replaceAll('\\', '/');
const now = () => new Date().toISOString();
const suites = [
  { stage: 'b2-world-home-registry', script: 'contract-tests.cjs', report: 'contract-results.json', expected: 34 },
  { stage: 'b2-cross-device-core', script: 'contract-tests.cjs', report: 'contract-results.json', expected: 59 },
  { stage: 'b2-cross-device-core', script: 'prototype-contract-tests.cjs', report: 'prototype-contract-results.json', expected: 6 },
  { stage: 'b2-cross-device-core', script: 'adapter-content.contract.cjs', report: 'adapter-content.contract-results.json', expected: 22 },
  { stage: 'b2-world-migration', script: 'drain-contract-tests.cjs', report: 'drain-contract-results.json', expected: 20 },
  { stage: 'b2-world-migration', script: 'boundary-contract-tests.cjs', report: 'boundary-contract-results.json', expected: 8 },
  { stage: 'b2-world-migration', script: 'authority-contract-tests.cjs', report: 'authority-contract-results.json', expected: 32 },
  { stage: 'b2-world-migration', script: 'storage-contract-tests.cjs', report: 'storage-contract-results.json', expected: 34 },
  { stage: 'b2-world-migration', script: 'prototype-contract-tests.cjs', report: 'prototype-contract-results.json', expected: 12 },
];
const supporting = [
  'b2-cross-device-core/contract-test-helpers.cjs',
  'b2-cross-device-core/storage-contract-tests.cjs',
  'b2-state-extensions/state-test-fixture.cjs',
];
const originals = [...suites.map(value => value.stage + '/' + value.script), ...supporting];
const acceptedReports = suites.map(value => value.stage + '/' + value.report);

function originalHashes() {
  return [...new Set([...originals, ...acceptedReports])].sort().map(name => {
    const file = path.join(workspace, 'quality-review', name);
    return { file: relative(file), sha256: sha(fs.readFileSync(file)) };
  });
}
function productionHashes() {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.ts')) files.push(file);
    }
  }
  walk(path.join(workspace, 'src')); walk(path.join(workspace, 'assets/scripts'));
  return files.sort().map(file => ({ file: relative(file), sha256: sha(fs.readFileSync(file)) }));
}
function prepareCopies() {
  return originals.map(name => {
    const file = path.join(workspace, 'quality-review', name), bytes = fs.readFileSync(file), source = bytes.toString('utf8');
    const rootAnchor = /path\.resolve\(__dirname, ['"]\.\.\/\.\.['"]\)/g;
    let rewrites = 0;
    const copy = source.replace(rootAnchor, () => { rewrites++; return JSON.stringify(workspace); });
    const destination = path.join(output, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, copy, 'utf8');
    return { source: relative(file), sourceSha256: sha(bytes), copy: relative(destination), copySha256: sha(Buffer.from(copy)),
      rewrite: rewrites ? 'Workspace root anchor only; test cases, fixtures, relative requires and report writes remain identical' : 'Exact source copy',
      workspaceRootAnchorRewrites: rewrites };
  });
}
function runSuite(suite) {
  const script = path.join(output, suite.stage, suite.script), report = path.join(output, suite.stage, suite.report);
  const log = path.join(output, suite.stage, suite.script.replace('.cjs', '.log'));
  if (fs.existsSync(report)) fs.unlinkSync(report);
  const startedAt = now();
  return new Promise(resolve => {
    const sink = fs.createWriteStream(log);
    const child = spawn(process.execPath, [script], { cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', value => sink.write(value)); child.stderr.on('data', value => sink.write(value));
    let launchError = null;
    child.on('error', error => { launchError = String(error); });
    child.on('close', exitCode => {
      sink.end();
      let value = null, validationError = null;
      try {
        value = JSON.parse(fs.readFileSync(report, 'utf8'));
        const passed = value.summary?.passed ?? value.passed;
        const cases = value.cases ?? value.tests ?? value.results;
        const total = value.summary?.total ?? value.total ?? cases.length;
        const failed = value.summary?.failed ?? value.failed ?? cases.filter(test => test.result === 'FAIL' || test.pass === false).length;
        assert.equal(passed, suite.expected); assert.equal(total, suite.expected); assert.equal(failed, 0);
        assert(cases.every(test => test.result === 'PASS' || test.pass === true));
        if ('pass' in value) assert.equal(value.pass, true);
        assert.equal(exitCode, 0); assert.equal(launchError, null);
      } catch (error) { validationError = String(error); }
      resolve({ stage: suite.stage, mode: 'ContractAdapter', sourceScript: 'quality-review/' + suite.stage + '/' + suite.script,
        isolatedScript: relative(script), isolatedReport: relative(report), log: relative(log),
        startedAt, finishedAt: now(), exitCode, passed: value?.summary?.passed ?? value?.passed ?? 0,
        expected: suite.expected, pass: validationError === null, launchError, validationError,
        reportSha256: fs.existsSync(report) ? sha(fs.readFileSync(report)) : null });
    });
  });
}

async function main() {
  const startedAt = now(), oldBefore = originalHashes(), sourceBefore = productionHashes();
  const copies = prepareCopies();
  const settled = await Promise.allSettled(suites.map(runSuite));
  const runs = settled.map((result, index) => result.status === 'fulfilled' ? result.value :
    { stage: suites[index].stage, sourceScript: suites[index].script, pass: false, validationError: String(result.reason) });
  const oldAfter = originalHashes(), sourceAfter = productionHashes();
  const originalsUnchanged = JSON.stringify(oldBefore) === JSON.stringify(oldAfter);
  const productionUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  const storageReportFile = path.join(output, 'b2-world-migration/storage-contract-results.json');
  const storageCases = fs.existsSync(storageReportFile) ? JSON.parse(fs.readFileSync(storageReportFile, 'utf8')).results : [];
  const ms27 = storageCases.find(value => value.name.startsWith('MS27 '));
  const copiedStorage = fs.readFileSync(path.join(output, 'b2-world-migration/storage-contract-tests.cjs'), 'utf8');
  const ms27Body = copiedStorage.slice(copiedStorage.indexOf("await test('MS27 "), copiedStorage.indexOf("await test('MS28 "));
  const serverTimeSeamVerified = ms27?.pass === true && ms27Body.includes('f.advanceServiceBy(3600000);') &&
    copiedStorage.includes('serviceNow: () => serverNow');
  const report = { schemaVersion: 1, phase: 'B2.4e isolated b/c/d contract regressions', mode: 'ContractAdapter', startedAt, finishedAt: now(),
    pass: runs.every(value => value.pass) && originalsUnchanged && productionUnchanged && serverTimeSeamVerified,
    expected: suites.reduce((sum, value) => sum + value.expected, 0), passed: runs.reduce((sum, value) => sum + (value.passed ?? 0), 0),
    policy: 'Accepted suites run as isolated e copies against current production modules. Only copied workspace-root anchors change. Original scripts, accepted reports and production source are hash-checked and never written. Controlled contract fixtures do not seed Creator.',
    groups: { bRegistry: 34, cCoreAndComposition: 65, cContentValidation: 22, dFiveSuites: 106 }, runs, copies,
    originalScriptsAndAcceptedReports: { unchanged: originalsUnchanged, before: oldBefore, after: oldAfter },
    productionSources: { unchanged: productionUnchanged, count: sourceBefore.length, before: sourceBefore, after: sourceAfter },
    MS27: { pass: serverTimeSeamVerified, name: ms27?.name ?? null,
      explanation: 'Historical Claim after migration back uses explicit fixture advanceServiceBy(3600000), consumed by serviceNow closure; no production authority mutation or client wall-clock shortcut.' },
    limitations: ['ContractAdapter fixtures and logical devices only', 'Current-source regression, separate from Creator production acceptance',
      'No new protocol names, real external services, complete FileCarry or actual elapsed-hour claim'] };
  fs.writeFileSync(path.join(__dirname, 'contract-regression-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, passed: report.passed, expected: report.expected, groups: report.groups,
    originalsUnchanged, productionUnchanged, MS27: serverTimeSeamVerified, runs: runs.map(value => ({ stage: value.stage,
      script: value.sourceScript, passed: value.passed, expected: value.expected, pass: value.pass, error: value.validationError })) }, null, 2));
  process.exitCode = report.pass ? 0 : 1;
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
