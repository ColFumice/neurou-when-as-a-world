'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const out = path.join(__dirname, 'history-c2b-pure');
if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Regression evidence is immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(path.join(out, 'evidence/protocol'), { recursive: true });
const sources = ['quality-review/b2-5c-2b/client-contract-tests.cjs', 'quality-review/b2-5c-2b/protocol-contract-tests.cjs', 'quality-review/b2-5c-2b/evidence/protocol/tsconfig.json'];
const originalHashes = sources.map(name => ({ path: name, sha256: sha(fs.readFileSync(path.join(root, name))) }));
const clientOriginal = fs.readFileSync(path.join(root, sources[0]), 'utf8');
const rootAnchor = "const workspace = path.resolve(__dirname, '../..');";
if (clientOriginal.split(rootAnchor).length !== 2) throw new Error('Historical client root anchor changed.');
const clientCopy = clientOriginal.replace(rootAnchor, 'const workspace = ' + JSON.stringify(root) + ';');
fs.writeFileSync(path.join(out, 'client-contract-tests.cjs'), clientCopy);
fs.copyFileSync(path.join(root, sources[1]), path.join(out, 'protocol-contract-tests.cjs'));
const config = JSON.parse(fs.readFileSync(path.join(root, sources[2]), 'utf8'));
config.compilerOptions.outDir = path.join(out, 'evidence/protocol/build');
const configPath = path.join(out, 'tsconfig-protocol.json'); fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
function run(name, args) {
  const startedUtc = new Date().toISOString();
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes));
    child.on('error', error => chunks.push(Buffer.from(String(error))));
    child.on('close', exitCode => { const bytes = Buffer.concat(chunks); fs.writeFileSync(path.join(out, name + '.log'), bytes); resolve({ name, command: [process.execPath, ...args], startedUtc, completedUtc: new Date().toISOString(), exitCode, pass: exitCode === 0, log: path.relative(__dirname, path.join(out, name + '.log')).replaceAll('\\', '/'), sha256: sha(bytes), raw: bytes.toString('utf8') }); });
  });
}
(async () => {
  const settled = await Promise.allSettled([run('protocol-build', ['node_modules/typescript/bin/tsc', '-p', configPath]), run('client-contract', [path.join(out, 'client-contract-tests.cjs')])]);
  if (settled.some(item => item.status !== 'fulfilled')) throw new Error('Historical subprocess orchestration failed.');
  const [build, client] = settled.map(item => item.value);
  const protocol = build.pass ? await run('protocol-contract', [path.join(out, 'protocol-contract-tests.cjs')]) : null;
  const clientCount = Number(client.raw.match(/"passed":(\d+)/)?.[1] ?? -1), protocolCount = Number(protocol?.raw.match(/"passed":(\d+)/)?.[1] ?? -1);
  const stability = originalHashes.map(item => ({ ...item, finalSha256: sha(fs.readFileSync(path.join(root, item.path))) }));
  const report = { phase: 'B2.5c-2c copied historical c-2b pure contracts', generatedUtc: new Date().toISOString(), nodeVersion: process.version, runs: [build, client, protocol].filter(Boolean).map(item => ({ ...item, raw: undefined })), counts: { protocolChecks: protocolCount, clientContractChecks: clientCount, total: protocolCount + clientCount }, sources: stability,
    copies: [{ source: sources[0], copySha256: sha(clientCopy), rewrite: 'Only exact workspace-root anchor; cases, assertions and isolated output behavior unchanged.' }, { source: sources[1], copySha256: sha(fs.readFileSync(path.join(out, 'protocol-contract-tests.cjs'))), exactBytes: true }, { source: sources[2], rewrite: 'Only compiler output directory into this new round; source file list/options unchanged.' }],
    pass: build.pass && client.pass && !!protocol?.pass && clientCount === 18 && protocolCount === 32 && stability.every(item => item.sha256 === item.finalSha256), scope: '32 pure canonical/schema cases plus 18 transport contract oracle cases against current implementation. These are not actual HTTP/PG or Relay acceptance. Historical scripts and output directories remain read-only; all compilation/output is in the new c-2c evidence tree.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, counts: report.counts, originalSourcesUnchanged: stability.every(item => item.sha256 === item.finalSha256) }, null, 2));
  process.exitCode = report.pass ? 0 : 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
