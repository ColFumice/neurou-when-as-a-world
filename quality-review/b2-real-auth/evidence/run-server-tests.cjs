'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const serverRoot = path.resolve(__dirname, '../../../server');
const privateFile = path.join(__dirname, 'runtime/.local/connection.json');
const connection = JSON.parse(fs.readFileSync(privateFile, 'utf8').replace(/^\uFEFF/, ''));
const databaseUrl = connection.databaseUrl;
const parsed = new URL(databaseUrl);
if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55436' || parsed.pathname !== '/b25_auth') throw new Error('Only the isolated B2.5b loopback test database is permitted.');
const env = { ...process.env, B25B_DATABASE_URL: databaseUrl, DATABASE_URL: databaseUrl };
async function run(name, args) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const chunks = [];
    const child = cp.spawn(process.execPath, args, { cwd: serverRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', bytes => chunks.push(bytes));
    child.stderr.on('data', bytes => chunks.push(bytes));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const sanitized = raw.split(databaseUrl).join('[REDACTED_DATABASE_URL]').split(decodeURIComponent(parsed.password)).join('[REDACTED_DB_PASSWORD]')
        .replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
      const log = name + '.log';
      fs.writeFileSync(path.join(__dirname, log), sanitized);
      resolve({ name, command: [process.execPath, ...args], cwd: serverRoot, startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0,
        log, sha256: crypto.createHash('sha256').update(sanitized).digest('hex'), summary: sanitized.split(/\r?\n/).filter(line => /^(?:#|ℹ) (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)|error TS|^ok \d+/.test(line)) });
    });
  });
}
(async () => {
  const build = await run('server-build', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
  const runs = [build];
  if (build.pass) {
    const tests = fs.readdirSync(path.join(serverRoot, 'dist/test')).filter(name => name.endsWith('.test.js')).sort().map(name => 'dist/test/' + name);
    if (!tests.length) throw new Error('No server tests found.');
    runs.push(await run('server-contract-and-http', ['--test', ...tests]));
  }
  const result = { phase: 'B2.5b server independent package', generatedUtc: new Date().toISOString(), pass: runs.length === 2 && runs.every(run => run.pass), runs,
    packageScriptEquivalence: 'npm test = npm run build && node --test dist/test/*.test.js; executed directly with Node 24 to avoid host PATH ambiguity.',
    database: { implementation: 'Real PostgreSQL', majorVersion: 17, host: '127.0.0.1', port: 55436, name: 'b25_auth', credentialRecorded: false },
    transport: 'Real loopback HTTP via app.listen and HTTP fetch; never Fastify inject or in-memory substitute DB.',
    limits: 'Independent server contract and development HTTP acceptance only; external HTTPS deployment, physical device and OfflineGrant are not attested.' };
  fs.writeFileSync(path.join(__dirname, 'server-test-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
})().catch(error => { console.error(String(error).split(databaseUrl).join('[REDACTED_DATABASE_URL]')); process.exitCode = 1; });
