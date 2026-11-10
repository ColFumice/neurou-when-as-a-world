'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runName = process.argv[2] || 'final';
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runName)) throw new Error('Use a short immutable run name.');
const out = path.join(__dirname, 'history-b-auth', runName);
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Prior regression records cannot be overwritten.');
fs.mkdirSync(out, { recursive: true });
const sandbox = path.join(out, 'server');
fs.mkdirSync(sandbox, { recursive: true });
fs.copyFileSync(path.join(root, 'server/package.json'), path.join(sandbox, 'package.json'));
fs.symlinkSync(path.join(root, 'server/node_modules'), path.join(sandbox, 'node_modules'), 'junction');
fs.mkdirSync(path.join(sandbox, 'migrations'), { recursive: true });
fs.copyFileSync(path.join(root, 'server/migrations/001.sql'), path.join(sandbox, 'migrations/001.sql'));
const privateDirectory = path.join(sandbox, '.local');
fs.mkdirSync(privateDirectory, { recursive: true });
if (process.platform === 'win32') {
  const acl = cp.spawnSync('icacls.exe', [privateDirectory, '/inheritance:r', '/grant:r', process.env.USERNAME + ':(OI)(CI)F'], { windowsHide: true, stdio: 'ignore' });
  if (acl.status !== 0) throw new Error('Unable to protect historical independent process credentials.');
} else fs.chmodSync(privateDirectory, 0o700);
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const sourcePaths = baseline.files.filter(item => /^server\/(?:src|test)\/.+\.ts$/.test(item.path)).map(item => item.path);
const config = JSON.parse(fs.readFileSync(path.join(root, 'server/tsconfig.json'), 'utf8'));
const isolatedConfig = { compilerOptions: { ...config.compilerOptions, rootDir: path.join(root, 'server'), outDir: path.join(sandbox, 'dist'), typeRoots: [path.join(root, 'server/node_modules/@types')] }, files: sourcePaths.map(name => path.join(root, name)) };
const configPath = path.join(out, 'tsconfig-history.json'); fs.writeFileSync(configPath, JSON.stringify(isolatedConfig, null, 2) + '\n');
const connection = JSON.parse(fs.readFileSync(path.join(__dirname, 'runtime/.local/connection.json'), 'utf8').replace(/^\uFEFF/, ''));
const databaseUrl = connection.historyDatabaseUrl;
const parsedUrl = new URL(databaseUrl);
if (parsedUrl.hostname !== '127.0.0.1' || parsedUrl.port !== '55437' || parsedUrl.pathname !== '/c2b_history_auth') throw new Error('Historical regression database must be the new isolated c-2b history DB.');
const env = { ...process.env, DATABASE_URL: databaseUrl, B25B_DATABASE_URL: databaseUrl };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function sanitize(raw) { return raw.split(databaseUrl).join('[REDACTED_DATABASE_URL]').split(decodeURIComponent(parsedUrl.password)).join('[REDACTED_DB_PASSWORD]').replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'); }
function run(name, args, cwd, overrides = {}) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd, env: { ...env, ...overrides }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => { const raw = sanitize(Buffer.concat(chunks).toString('utf8')); fs.writeFileSync(path.join(out, name + '.log'), raw); resolve({ name, command: [process.execPath, ...args], cwd, startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0, log: path.relative(__dirname, path.join(out, name + '.log')).replaceAll('\\', '/'), sha256: hash(raw), raw }); });
  });
}
(async () => {
  const originalHashes = [...sourcePaths, 'server/migrations/001.sql', 'server/package.json', 'server/tsconfig.json', 'quality-review/b2-real-auth/client-tests/run.cjs', 'src/presentation/RealAuthServiceAdapter.ts'].map(name => ({ path: name, sha256: hash(fs.readFileSync(path.join(root, name))) }));
  const build = await run('server-isolated-build', [path.join(root, 'server/node_modules/typescript/bin/tsc'), '-p', configPath], root);
  const serverTests = build.pass ? await run('old-server-http', ['--test', '--test-reporter=tap', path.join(sandbox, 'dist/test/http.test.js'), path.join(sandbox, 'dist/test/main-process.test.js')], sandbox) : null;
  const clientDirectory = path.join(out, 'client'); fs.mkdirSync(path.join(clientDirectory, '.local'), { recursive: true });
  if (process.platform === 'win32') {
    const acl = cp.spawnSync('icacls.exe', [path.join(clientDirectory, '.local'), '/inheritance:r', '/grant:r', process.env.USERNAME + ':(OI)(CI)F'], { windowsHide: true, stdio: 'ignore' });
    if (acl.status !== 0) throw new Error('Unable to protect historical client runtime credentials.');
  } else fs.chmodSync(path.join(clientDirectory, '.local'), 0o700);
  const clientConnectionPath = path.join(clientDirectory, '.local/connection.json'); fs.writeFileSync(clientConnectionPath, JSON.stringify({ databaseUrl }));
  const originalRunner = fs.readFileSync(path.join(root, 'quality-review/b2-real-auth/client-tests/run.cjs'), 'utf8');
  const rootAnchor = "const project = path.resolve(__dirname, '../../..');";
  const serverAnchor = "path.join(project, 'server/dist/src', file)";
  if (!originalRunner.includes(rootAnchor) || !originalRunner.includes(serverAnchor)) throw new Error('Historical client copy anchors changed.');
  const copiedRunner = originalRunner.replace(rootAnchor, 'const project = ' + JSON.stringify(root) + ';').replace(serverAnchor, 'path.join(' + JSON.stringify(path.join(sandbox, 'dist/src')) + ', file)');
  const clientScript = path.join(clientDirectory, 'run.cjs'); fs.writeFileSync(clientScript, copiedRunner);
  const clientTests = build.pass ? await run('old-client-contract-and-http', [clientScript, '--http'], root, { B25_CONNECTION_FILE: clientConnectionPath }) : null;
  const clientReport = clientTests?.pass ? JSON.parse(fs.readFileSync(path.join(clientDirectory, 'results-contract-and-http.json'), 'utf8')) : null;
  const sourceStability = originalHashes.map(item => ({ ...item, finalSha256: hash(fs.readFileSync(path.join(root, item.path))) }));
  const count = name => Number(serverTests?.raw.match(new RegExp('^# ' + name + '\\s+(\\d+)\\s*$', 'm'))?.[1] ?? -1);
  const result = { phase: 'B2.5c-2b real historical B2.5b auth regression', runName, generatedUtc: new Date().toISOString(), nodeVersion: process.version,
    database: { host: parsedUrl.hostname, port: Number(parsedUrl.port), name: parsedUrl.pathname.slice(1), majorVersion: 17, credentialRecorded: false },
    build: { ...build, raw: undefined }, serverTests: serverTests ? { ...serverTests, raw: undefined } : null, clientTests: clientTests ? { ...clientTests, raw: undefined } : null,
    counts: { serverTests: count('tests'), serverPass: count('pass'), serverFail: count('fail'), clientChecks: clientReport?.count ?? -1, clientContractChecks: clientReport?.records.filter(item => !item.name.startsWith('HTTP/PostgreSQL:')).length ?? -1, clientRealHttpChecks: clientReport?.records.filter(item => item.name.startsWith('HTTP/PostgreSQL:')).length ?? -1 },
    sourceStability, clientRunnerCopy: { sourceSha256: hash(originalRunner), copySha256: hash(copiedRunner), rewrites: ['Exact workspace root anchor', 'Exact independently built server module path'], casesAndAssertionsUnchanged: true },
    pass: build.pass && !!serverTests?.pass && !!clientTests?.pass && count('tests') === 16 && count('pass') === 16 && clientReport?.count === 30 && sourceStability.every(item => item.sha256 === item.finalSha256),
    limits: 'Real TCP loopback HTTP and PostgreSQL17 using unchanged old b modules, routes, guards and case assertions. Separate isolated old-b compilation does not certify new shared authority. All generated key/CSRF/password/session/DB values are confined to memory/private local directories, never report output. No old evidence mutation.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ pass: result.pass, counts: result.counts, sourceStable: sourceStability.every(item => item.sha256 === item.finalSha256), buildPass: build.pass }, null, 2)); process.exitCode = result.pass ? 0 : 1;
})().catch(error => { console.error(sanitize(error.message)); process.exitCode = 1; });
