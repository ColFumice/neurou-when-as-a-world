'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runName = process.argv[2] || 'final';
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runName)) throw new Error('Use a short run name.');
const reportDir = path.join(__dirname, 'test-runs', runName);
if (fs.existsSync(path.join(reportDir, 'results.json'))) throw new Error('Preserve prior raw test result; choose a new run name.');
fs.mkdirSync(reportDir, { recursive: true });
const testDirectory = path.join(__dirname, '../tests');
const tests = [
  ...fs.readdirSync(__dirname).filter(name => name !== 'run-tests.cjs' && name.endsWith('-tests.cjs')).map(name => path.join(__dirname, name)),
  ...(fs.existsSync(testDirectory) ? fs.readdirSync(testDirectory).filter(name => name.endsWith('-tests.cjs')).map(name => path.join(testDirectory, name)) : []),
].sort();
if (!tests.length) throw new Error('No explicitly named *-tests.cjs entries.');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function run(name, args) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', chunk => chunks.push(chunk)); child.stderr.on('data', chunk => chunks.push(chunk));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => {
      const bytes = Buffer.concat(chunks), output = bytes.toString('utf8');
      fs.writeFileSync(path.join(reportDir, name + '.log'), bytes);
      resolve({ name, startedUtc, completedUtc: new Date().toISOString(), command: [process.execPath, ...args], exitCode, pass: exitCode === 0, rawSha256: hash(bytes), output });
    });
  });
}
(async () => {
  const sourceNames = ['SharedCommitContracts.ts', 'SharedCanonicalBytes.ts', 'SharedCommitCodec.ts', 'SharedCommitValidator.ts', 'SharedWorldReducer.ts'];
  const sources = sourceNames.map(name => { const absolute = path.join(root, 'src/director', name), bytes = fs.readFileSync(absolute); return { path: 'src/director/' + name, bytes: bytes.length, sha256: hash(bytes) }; });
  const inputFiles = [...tests, ...['fixtures.cjs', 'no-network.cjs', 'run-tests.cjs', 'tsconfig-isolated.json'].map(name => path.join(__dirname, name))];
  const inputBefore = inputFiles.map(file => ({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file)) }));
  const compile = await run('isolated-typecheck-build', ['node_modules/typescript/bin/tsc', '--project', path.join(__dirname, 'tsconfig-isolated.json')]);
  const testRun = compile.pass ? await run('contract-tests', ['--require', path.join(__dirname, 'no-network.cjs'), '--test', '--test-reporter=tap', '--test-reporter-destination=stdout',
    '--test-reporter=junit', '--test-reporter-destination=' + path.join(reportDir, 'junit.xml'), ...tests]) : null;
  const sourceStability = sources.map(source => ({ path: source.path, beforeSha256: source.sha256, afterSha256: hash(fs.readFileSync(path.join(root, source.path))) }));
  const sourceStable = sourceStability.every(source => source.beforeSha256 === source.afterSha256);
  const testInputStability = inputBefore.map(input => ({ path: input.path, beforeSha256: input.sha256, afterSha256: hash(fs.readFileSync(path.join(root, input.path))) }));
  const testInputsStable = testInputStability.every(input => input.beforeSha256 === input.afterSha256);
  const networkAttempts = [...(testRun?.output.matchAll(/NO_NETWORK_TEST_ATTEMPTS:(\d+)/g) || [])].map(match => Number(match[1]));
  const noNetwork = networkAttempts.length > 0 && networkAttempts.every(count => count === 0);
  const count = field => { const match = testRun?.output.match(new RegExp('^# ' + field + '\\s+(\\d+)\\s*$', 'm')); return match ? Number(match[1]) : null; };
  const result = { runName, generatedUtc: new Date().toISOString(), nodeVersion: process.version, isolatedCompiler: { lib: ['ES2020'], types: [], noDOM: true, noEngineDeclarations: true },
    sources, sourceStability, sourceStable, testInputStability, testInputsStable, tests: tests.map(file => ({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file)) })),
    helperFiles: ['fixtures.cjs', 'no-network.cjs', 'run-tests.cjs', 'tsconfig-isolated.json'].map(name => ({ path: name, sha256: hash(fs.readFileSync(path.join(__dirname, name))) })),
    compile: { ...compile, output: undefined }, testRun: testRun ? { ...testRun, output: undefined } : null,
    counts: { tests: count('tests'), suites: count('suites'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skipped: count('skipped'), todo: count('todo') },
    networkAttempts, noNetwork, networkInstrumentation: 'deny HTTP/HTTPS/HTTP2/net/tls/dns/dgram/undici imports, getBuiltinModule, global fetch/WebSocket; per-process blocked-attempt counters emitted to raw log. Only exercised code evidence; not an OS sandbox.',
    cryptographicBackend: 'Native in-memory Node EC ES256/P1363, AES-256-GCM, HMAC-SHA256 RFC5869 HKDF (verified standard vector), SHA256; no persisted secret/private key/cookie/database.',
    pass: compile.pass && !!testRun?.pass && sourceStable && testInputsStable && noNetwork };
  fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
