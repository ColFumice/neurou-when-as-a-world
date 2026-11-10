'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
async function gate(script) {
  const result = await new Promise(resolve => {
    const child = cp.spawn('cmd.exe', ['/d', '/s', '/c', 'npm run ' + script], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [], stderr = [];
    child.stdout.on('data', bytes => stdout.push(bytes));
    child.stderr.on('data', bytes => stderr.push(bytes));
    child.on('error', error => stderr.push(Buffer.from(String(error.stack))));
    child.on('close', exitCode => resolve({ exitCode, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
  });
  const log = 'gate-' + script.replace('check:', '') + '.log';
  fs.writeFileSync(path.join(__dirname, log), Buffer.concat([result.stdout, result.stderr]));
  return { command: 'npm run ' + script, exitCode: result.exitCode, pass: result.exitCode === 0, log };
}
Promise.all(['check:naming', 'typecheck', 'check:dependencies'].map(gate)).then(runs => {
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'B2.2d-2 final seven-section state implementation',
    productionImplementation: true,
    pass: runs.every(run => run.pass), runs,
  };
  fs.writeFileSync(path.join(__dirname, 'gate-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
