const fs = require('fs'), path = require('path'), cp = require('child_process'), assert = require('assert/strict');
const query = "$items = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and ($_.CommandLine -match 'b2-local-worlds[\\\\/]creator-preview\\.cjs' -or $_.CommandLine -match 'b2-local-worlds[\\\\/]process-restart\\.cjs') } | Select-Object ProcessId, CommandLine); ConvertTo-Json -InputObject $items -Compress";
const priorHarnessProcesses = JSON.parse(cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', query], { windowsHide: true, encoding: 'utf8' }).trim() || '[]');
assert.equal(priorHarnessProcesses.length, 0, 'Previous B2 Electron harness still alive');
const launch = { launcherPID: process.pid, launchedAt: new Date().toISOString(), priorHarnessProcesses, priorHarnessProcessCheck: 'Read-only Win32_Process check before independent Electron spawn', script: path.join(__dirname, 'process-restart.cjs') };
const output = fs.createWriteStream(path.join(__dirname, 'process-restart.log'));
const child = cp.spawn(require('electron'), [launch.script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEUROU_B2_RESTART_LAUNCH: JSON.stringify(launch) } });
launch.electronPID = child.pid;
for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output.write(bytes); process.stdout.write(bytes); });
child.on('close', code => {
  launch.exitedAt = new Date().toISOString(); launch.exitCode = code;
  fs.writeFileSync(path.join(__dirname, 'process-restart-lifecycle.json'), JSON.stringify(launch, null, 2));
  output.end(() => process.exit(code ?? 1));
});
