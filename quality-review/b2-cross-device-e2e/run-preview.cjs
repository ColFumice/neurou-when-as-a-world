const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const log = fs.createWriteStream(path.join(__dirname, 'creator-preview.log'));
const lifecycle = { launcherPID: process.pid, launchedAt: new Date().toISOString() };
const child = cp.spawn(require('electron'), [path.join(__dirname, 'creator-preview.cjs')], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
lifecycle.electronPID = child.pid;
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', bytes => { log.write(bytes); process.stdout.write(bytes); });
}
child.on('close', code => {
  lifecycle.exitCode = code; lifecycle.exitedAt = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'creator-preview-lifecycle.json'), JSON.stringify(lifecycle, null, 2));
  log.end(() => process.exit(code ?? 1));
});
