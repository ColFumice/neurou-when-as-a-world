'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require(path.resolve(__dirname, '../../../server/node_modules/typescript'));
const root = path.resolve(__dirname, '../../..');
const out = path.join(__dirname, 'history-c2b-http');
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Historical HTTP regression is immutable.');
fs.mkdirSync(out, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const originalPaths = ['server/test/shared-clock-migration.test.ts', 'server/test/shared-http.test.ts', 'quality-review/b2-5c-2b/client-real-http.cjs'];
const before = originalPaths.map(name => ({ path: name, sha256: sha(fs.readFileSync(path.join(root, name))) }));
const sandbox = path.join(out, 'server'); fs.mkdirSync(path.join(sandbox, 'test'), { recursive: true });
fs.writeFileSync(path.join(sandbox, 'package.json'), '{"type":"module"}\n');
fs.symlinkSync(path.join(root, 'server/shared-dist/src'), path.join(sandbox, 'src'), 'junction');
fs.symlinkSync(path.join(root, 'server/shared-dist/.shared-kernel'), path.join(sandbox, '.shared-kernel'), 'junction');
fs.symlinkSync(path.join(root, 'server/node_modules'), path.join(sandbox, 'node_modules'), 'junction');
const copies = [];
for (const name of originalPaths.slice(0, 2)) {
  const original = fs.readFileSync(path.join(root, name), 'utf8');
  const oldConnection = '../quality-review/b2-5c-2b/evidence/runtime/.local/connection-final.json';
  if (original.split(oldConnection).length !== 2) throw new Error('Historical shared test connection anchor changed.');
  const derived = original.replace(oldConnection, '../quality-review/b2-5c-2c/evidence/runtime/.local/connection-authority-regression.json');
  const sourceCopy = path.join(out, path.basename(name)); fs.writeFileSync(sourceCopy, derived);
  const target = path.join(sandbox, 'test', path.basename(name).replace(/\.ts$/, '.js'));
  fs.writeFileSync(target, ts.transpileModule(derived, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText);
  copies.push({ source: name, sourceCopy: path.relative(__dirname, sourceCopy).replaceAll('\\', '/'), sourceCopySha256: sha(derived), rewrite: 'Only the private fresh-database connection path; case bodies, assertions and expected behavior unchanged.', transpiledCopy: path.relative(__dirname, target).replaceAll('\\', '/'), transpilerVersion: ts.version });
}
const clientOut = path.join(out, 'client'); fs.mkdirSync(clientOut, { recursive: true });
let client = fs.readFileSync(path.join(root, originalPaths[2]), 'utf8');
function replaceClient(oldText, newText) { if (client.split(oldText).length !== 2) throw new Error('Historical client anchor changed.'); client = client.replace(oldText, newText); }
replaceClient("const workspace = path.resolve(__dirname, '../..');", 'const workspace = ' + JSON.stringify(root) + ';');
replaceClient("path.join(__dirname, 'evidence/runtime/.local/connection-client.json')", 'path.join(' + JSON.stringify(path.join(__dirname, 'runtime/.local/connection-adapter-regression.json')) + ')');
replaceClient("database: 'c2b_client_authority'", "database: 'c2c_adapter_regression'");
const clientRunner = path.join(clientOut, 'client-real-http.cjs'); fs.writeFileSync(clientRunner, client);
copies.push({ source: originalPaths[2], sourceCopy: path.relative(__dirname, clientRunner).replaceAll('\\', '/'), sourceCopySha256: sha(client), rewrite: 'Only workspace anchor, fresh private DB connection path, and public report database label. Output is naturally redirected by __dirname; cases/assertions unchanged.' });
const connections = ['connection-authority-regression.json', 'connection-adapter-regression.json'].map(name => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'runtime/.local', name), 'utf8').replace(/^\uFEFF/, '')), url = new URL(data.databaseUrl);
  if (url.hostname !== '127.0.0.1' || url.port !== '55438' || !/^\/c2c_(?:authority|adapter)_regression$/.test(url.pathname)) throw new Error('Regression DB must be exact isolated c-2c loopback role/database.');
  return { name, data, url };
});
function sanitize(raw) { for (const item of connections) raw = raw.split(item.data.databaseUrl).join('[REDACTED_DATABASE_URL]').split(decodeURIComponent(item.url.password)).join('[REDACTED_DB_PASSWORD]'); return raw.replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'); }
function run(name, args, cwd) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes)); child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => { const raw = sanitize(Buffer.concat(chunks).toString('utf8')); fs.writeFileSync(path.join(out, name + '.log'), raw); resolve({ name, command: [process.execPath, ...args], cwd, startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0, log: path.relative(__dirname, path.join(out, name + '.log')).replaceAll('\\', '/'), sha256: sha(raw), raw }); });
  });
}
(async () => {
  const settled = await Promise.allSettled([run('shared-authority', ['--test', '--test-reporter=tap', path.join(sandbox, 'test/shared-clock-migration.test.js'), path.join(sandbox, 'test/shared-http.test.js')], path.join(root, 'server')), run('authority-adapter', [clientRunner], root)]);
  if (settled.some(item => item.status !== 'fulfilled')) throw new Error('Historical HTTP test orchestration failed.');
  const [server, adapter] = settled.map(item => item.value);
  const count = name => Number(server.raw.match(new RegExp('^# ' + name + '\\s+(\\d+)\\s*$', 'm'))?.[1] ?? -1);
  const adapterReport = adapter.pass ? JSON.parse(fs.readFileSync(path.join(clientOut, 'evidence/client-real-http-results.json'), 'utf8')) : null;
  const stability = before.map(item => ({ ...item, finalSha256: sha(fs.readFileSync(path.join(root, item.path))) }));
  const report = { phase: 'B2.5c-2c isolated real HTTP/PG historical c-2b regression', generatedUtc: new Date().toISOString(), nodeVersion: process.version, copies, sources: stability, runs: [server, adapter].map(item => ({ ...item, raw: undefined })), counts: { authorityServerTests: count('tests'), authorityServerPass: count('pass'), authorityServerFail: count('fail'), authorityAdapterChecks: adapterReport?.passed ?? -1, total: count('pass') + (adapterReport?.passed ?? 0) }, databases: connections.map(item => ({ host: item.url.hostname, port: Number(item.url.port), database: item.url.pathname.slice(1), privateCredentialsRecorded: false })),
    pass: server.pass && adapter.pass && count('tests') === 20 && count('pass') === 20 && adapterReport?.passed === 11 && stability.every(item => item.sha256 === item.finalSha256),
    scope: 'Accepted c-2b server 20 and production authority adapter 11 cases copied into new c-2c output, using separate fresh PG17 DBs and true loopback HTTP. c-2b case logic/assertions unchanged. Production-clock evidence and explicitly injected authority-clock cases retain their original categories; these regressions do not certify new Relay mechanisms or full two-client chain.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, counts: report.counts, sourcesStable: stability.every(item => item.sha256 === item.finalSha256) }, null, 2));
  process.exitCode = report.pass ? 0 : 1;
})().catch(error => { console.error(sanitize(error.message)); process.exitCode = 1; });
