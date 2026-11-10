'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runName = process.argv[2] || 'final';
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runName)) throw new Error('Use a short immutable run name.');
const out = path.join(__dirname, 'history-c1', runName);
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Prior history evidence cannot be overwritten.');
const inputNames = ['tests/codec-tests.cjs', 'tests/replay-tests.cjs', 'evidence/validator-tests.cjs', 'evidence/fixtures.cjs', 'evidence/no-network.cjs'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const copies = inputNames.map(name => {
  const original = path.join(root, 'quality-review/b2-5c-1', name), destination = path.join(out, name), bytes = fs.readFileSync(original);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
  return { source: 'quality-review/b2-5c-1/' + name, copy: path.relative(root, destination).replaceAll('\\', '/'), sourceSha256: hash(bytes), copySha256: hash(fs.readFileSync(destination)), exactBytes: true };
});
const modules = ['SharedCommitContracts', 'SharedCanonicalBytes', 'SharedCommitCodec', 'SharedCommitValidator', 'SharedWorldReducer'];
const sourceBefore = modules.map(name => ({ path: 'src/director/' + name + '.ts', sha256: hash(fs.readFileSync(path.join(root, 'src/director/' + name + '.ts'))) }));
function run(name, args) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => { const bytes = Buffer.concat(chunks), raw = bytes.toString('utf8'); fs.writeFileSync(path.join(out, name + '.log'), bytes); resolve({ name, command: [process.execPath, ...args], startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0, log: path.relative(__dirname, path.join(out, name + '.log')).replaceAll('\\', '/'), sha256: hash(bytes), raw }); });
  });
}
(async () => {
  const build = await run('isolated-build', ['node_modules/typescript/bin/tsc', '-p', 'quality-review/b2-5c-1/evidence/tsconfig-isolated.json', '--outDir', path.join(out, 'evidence/build')]);
  const tests = [path.join(out, 'tests/codec-tests.cjs'), path.join(out, 'tests/replay-tests.cjs'), path.join(out, 'evidence/validator-tests.cjs')];
  const testRun = build.pass ? await run('regression', ['--require', path.join(out, 'evidence/no-network.cjs'), '--test', '--test-reporter=tap', '--test-reporter-destination=stdout', '--test-reporter=junit', '--test-reporter-destination=' + path.join(out, 'junit.xml'), ...tests]) : null;
  const count = name => Number(testRun?.raw.match(new RegExp('^# ' + name + '\\s+(\\d+)\\s*$', 'm'))?.[1] ?? -1);
  const sourceStability = sourceBefore.map(item => ({ ...item, finalSha256: hash(fs.readFileSync(path.join(root, item.path))) }));
  const inputStability = copies.map(item => ({ source: item.source, beforeSha256: item.sourceSha256, finalSha256: hash(fs.readFileSync(path.join(root, item.source))) }));
  const networkAttempts = [...(testRun?.raw.matchAll(/NO_NETWORK_TEST_ATTEMPTS:(\d+)/g) ?? [])].map(value => Number(value[1]));
  const compiledComparison = modules.map(name => ({ name, historicalSha256: hash(fs.readFileSync(path.join(root, 'quality-review/b2-5c-1/evidence/build/' + name + '.js'))), currentSha256: hash(fs.readFileSync(path.join(out, 'evidence/build/' + name + '.js'))) }));
  const report = { phase: 'B2.5c-2c isolated c-1 historical regression', runName, generatedUtc: new Date().toISOString(), nodeVersion: process.version, copies, sourceStability, inputStability, compiledComparison,
    build: { ...build, raw: undefined }, tests: testRun ? { ...testRun, raw: undefined } : null, counts: { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped') }, networkAttempts,
    pass: !!testRun?.pass && build.pass && count('tests') === 154 && count('pass') === 154 && sourceStability.every(item => item.sha256 === item.finalSha256) && inputStability.every(item => item.beforeSha256 === item.finalSha256) && networkAttempts.length > 0 && networkAttempts.every(value => value === 0) && compiledComparison.every(item => item.historicalSha256 === item.currentSha256),
    limits: 'Exact historical case/helper bytes against newly compiled unchanged c-1 five modules. All outputs redirected to c-2c; no historical evidence mutation. Native-memory crypto and network-denial instrumentation are contract checks, not real shared HTTP/production authority acceptance.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ pass: report.pass, counts: report.counts, networkAttempts, buildPass: build.pass, testPass: testRun?.pass }, null, 2)); process.exitCode = report.pass ? 0 : 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
