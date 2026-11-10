'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'server-paused-noemit-results.json');
if (fs.existsSync(output)) throw new Error('Paused server check is immutable.');
const startedUtc = new Date().toISOString();
const command = [process.execPath, 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.shared.json', '--noEmit'];
const child = cp.spawn(command[0], command.slice(1), { cwd: path.join(root, 'server'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const chunks = []; child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes)); child.on('error', error => chunks.push(Buffer.from(String(error))));
child.on('close', exitCode => {
  const bytes = Buffer.concat(chunks); fs.writeFileSync(path.join(__dirname, 'server-paused-noemit.log'), bytes);
  const result = { phase: 'B2.5c-2c paused P11 current server source health check', status: 'PausedP11', stageComplete: false, startedUtc, completedUtc: new Date().toISOString(), command, cwd: path.join(root, 'server'), exitCode, pass: exitCode === 0, log: 'server-paused-noemit.log', logSha256: crypto.createHash('sha256').update(bytes).digest('hex'), scope: 'Independent server shared tsconfig noEmit compilation only. No SharedBuild output write, no Relay test, no server runtime startup, no final acceptance or completed-stage claim.' };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ pass: result.pass, exitCode, status: result.status }, null, 2)); process.exitCode = result.pass ? 0 : 1;
});
