'use strict';
const fs = require('fs'), cp = require('child_process'), path = require('path');
const projectRoot = path.resolve(__dirname, '../..'), runs = [];
for (const command of ['check:naming', 'typecheck', 'check:dependencies']) {
  const result = cp.spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run ' + command], { cwd: projectRoot, encoding: 'utf8', windowsHide: true });
  const log = 'gate-' + command.replace('check:', '') + '.log'; fs.writeFileSync(path.join(__dirname, log), (result.stdout || '') + (result.stderr || ''));
  runs.push({ command: 'npm run ' + command, exitCode: result.status, pass: result.status === 0, log });
}
const report = { generatedAt: new Date().toISOString(), pass: runs.every(r => r.pass), runs };
fs.writeFileSync(path.join(__dirname, 'gate-results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.pass ? 0 : 1;
