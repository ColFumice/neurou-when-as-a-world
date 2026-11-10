'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = path.resolve(__dirname, '..');
const directory = path.join(__dirname, 'after-retention-fix');
const output = path.join(directory, 'client-run-lineage.json');
const result = path.join(directory, 'client-real-http-results.json');
if (fs.existsSync(output) || fs.existsSync(result)) throw new Error('Preserve existing final records.');
const original = fs.readFileSync(path.join(phase, 'client-real-http.cjs'), 'utf8');
const driver = original.replaceAll('client-real-compiled', 'client-real-compiled-retention-final')
  .replaceAll('cipher-client.wal', 'cipher-client-retention-final.wal')
  .replaceAll('evidence/client-real-http-results.json', 'evidence/after-retention-fix/client-real-http-results.json');
const relative = 'quality-review/b2-5c-2c/client-real-http-retention-final.cjs';
const driverPath = path.join(root, relative);
if (fs.existsSync(driverPath)) throw new Error('Final driver already exists.');
fs.writeFileSync(driverPath, driver);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const record = filename => ({ path: path.relative(root, filename).replaceAll('\\', '/'), sha256: sha(fs.readFileSync(filename)) });
const sources = ['server/src/RelayStorage.ts', 'server/shared-dist/src/RelayStorage.js',
  'src/presentation/RealCommitRelayAdapter.ts', 'src/presentation/RealSharedServiceSessionAdapter.ts'];
const before = sources.map(value => record(path.join(root, value)));
const startedUtc = new Date().toISOString();
const command = [process.execPath, relative];
const child = cp.spawn(command[0], command.slice(1), { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', bytes => { chunks.push(bytes); process.stdout.write(bytes); });
child.stderr.on('data', bytes => { chunks.push(bytes); process.stderr.write(bytes); });
child.on('close', code => {
  const log = path.join(directory, 'client-real-http.log');
  fs.writeFileSync(log, Buffer.concat(chunks));
  const data = { command, cwd: root, actualExitCode: code, startedUtc, completedUtc: new Date().toISOString(),
    sourceBefore: before, sourceAfter: sources.map(value => record(path.join(root, value))),
    harness: record(driverPath), originalHarness: record(path.join(phase, 'client-real-http.cjs')),
    harnessDifference: 'Exactly three output/cache path substitutions; all case bodies and assertions unchanged.',
    log: record(log), result: fs.existsSync(result) ? record(result) : null,
    limits: 'Actual production adapters with real loopback HTTP/PG; test-only crypto/WAL cache capabilities. No production key delivery, full dual replay or LAN certification.' };
  fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  process.exitCode = code === 0 ? 0 : 1;
});
