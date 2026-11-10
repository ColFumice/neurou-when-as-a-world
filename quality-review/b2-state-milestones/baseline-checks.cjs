// Read-only baseline evidence for the B2.2 prerequisite stop.
// This runner creates evidence only under its own directory. It does not open UI,
// change product storage, launch Creator, or claim B2.2 implementation acceptance.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (name, content) => fs.writeFileSync(path.join(__dirname, name), content, { flag: 'wx' });
const json = (name, data) => write(name, JSON.stringify(data, null, 2) + '\n');
const excluded = new Set(['.git', 'library', 'node_modules', 'temp', 'tmp', 'build']);
const evidenceRelative = relative(__dirname);
function visit(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name) && relative(absolute) !== evidenceRelative) visit(absolute, found);
    } else if (entry.isFile()) found.add(absolute);
  }
}
function collect() {
  const found = new Set();
  visit(root, found);
  const prior = JSON.parse(fs.readFileSync(path.join(root, 'quality-review/b2-local-worlds/baseline-files.json'), 'utf8'));
  for (const entry of prior) {
    if (path.isAbsolute(entry.path) && !entry.path.toLowerCase().startsWith(root.toLowerCase())) found.add(entry.path);
  }
  return [...found].sort().map(absolute => ({
    path: absolute.toLowerCase().startsWith(root.toLowerCase()) ? relative(absolute) : absolute.replaceAll('\\', '/'),
    bytes: fs.statSync(absolute).size,
    sha256: digest(fs.readFileSync(absolute)),
    role: 'protected-baseline',
  }));
}
function gate(script, name) {
  return new Promise(resolve => {
    const startedAt = new Date().toISOString();
    const child = cp.spawn('cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    child.stdout.on('data', data => stdout.push(data));
    child.stderr.on('data', data => stderr.push(data));
    child.on('error', error => stderr.push(Buffer.from(String(error.stack))));
    child.on('close', (exitCode, signal) => {
      const stdoutFile = `baseline-gate-${name}.stdout.log`, stderrFile = `baseline-gate-${name}.stderr.log`;
      write(stdoutFile, Buffer.concat(stdout));
      write(stderrFile, Buffer.concat(stderr));
      resolve({ script, command: `npm run ${script}`, startedAt, finishedAt: new Date().toISOString(), exitCode, signal, passed: exitCode === 0, stdoutFile, stderrFile, scope: 'Existing project baseline only; not B2.2 implementation acceptance.' });
    });
  });
}
async function get(url) {
  const response = await fetch(url, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  return { status: response.status, ok: response.ok, bytes: Buffer.from(await response.arrayBuffer()), url: response.url };
}
async function preview() {
  const server = JSON.parse(fs.readFileSync(path.join(root, 'profiles/v2/packages/server.json'), 'utf8'));
  const baseUrl = `http://localhost:${server.server_port}/`;
  const result = { checkedAt: new Date().toISOString(), baseUrl, policy: 'HTTP GET and disk reads only. No browser UI, localStorage, application state, Creator launch, recompilation command, or screenshot manipulation.', b22Screenshots: { status: 'not-produced', reason: 'B2.2 production implementation is stopped for missing prerequisites; existing B2.1 preview cannot substantiate milestone or capture/restore behavior.' } };
  try {
    const index = await get(baseUrl);
    result.index = { url: index.url, status: index.status, bytes: index.bytes.length, sha256: digest(index.bytes) };
    const importMapUrl = baseUrl + 'scripting/x/import-map.json';
    const mapResponse = await get(importMapUrl);
    result.importMap = { url: importMapUrl, status: mapResponse.status, bytes: mapResponse.bytes.length, sha256: digest(mapResponse.bytes) };
    if (!index.ok || !mapResponse.ok) throw new Error('Preview or import-map GET did not return success.');
    const map = JSON.parse(mapResponse.bytes.toString('utf8'));
    const targets = ['assets/scripts/SceneBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts', 'assets/scripts/MinimalWorldBuilder.ts', 'assets/scripts/Bootstrap.ts', 'src/presentation/WorldFolderView.ts', 'src/presentation/FolderCatalog.ts', 'src/presentation/FolderStartupView.ts', 'src/director/AccountStartupSession.ts', 'src/presentation/FrameDriver.ts', 'src/presentation/InputCollector.ts', 'src/director/IntentPort.ts', 'src/director/WorldFolderSession.ts', 'src/presentation/WorldLocalStorage.ts', 'src/presentation/EditorFolderView.ts', 'src/presentation/CameraRig.ts', 'src/presentation/ProtagonistView.ts'];
    result.compilation = await Promise.all(targets.map(async file => {
      const suffix = file.startsWith('src/') ? 'assets/scripts/' + file : file;
      const importId = Object.keys(map.imports).find(key => key.endsWith('/' + suffix));
      if (!importId) return { file, available: false, reason: 'Not in current preview import map.' };
      const chunk = map.imports[importId];
      const chunkUrl = new URL(chunk, baseUrl + 'scripting/x/').href;
      const [compiled, sourceMap] = await Promise.all([get(chunkUrl), get(chunkUrl + '.map')]);
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      const mapData = JSON.parse(sourceMap.bytes.toString('utf8'));
      const compiledDisk = path.join(root, 'temp/programming/packer-driver/targets/preview', chunk);
      return { file, importId, chunkUrl, status: compiled.status, sourceMapStatus: sourceMap.status, sourceSha256: digest(Buffer.from(source)), compiledSha256: digest(compiled.bytes), available: compiled.ok && sourceMap.ok, sourceMapMatchesCurrentSource: mapData.sourcesContent?.includes(source) ?? false, servedEqualsCompilerOutput: fs.existsSync(compiledDisk) && digest(compiled.bytes) === digest(fs.readFileSync(compiledDisk)) };
    }));
    result.available = true;
    result.allSelectedCompilationFresh = result.compilation.every(row => row.available && row.sourceMapMatchesCurrentSource && row.servedEqualsCompilerOutput);
  } catch (error) {
    result.available = false;
    result.error = String(error.stack);
  }
  json('baseline-preview-readonly.json', result);
  return result;
}
(async () => {
  const capturedAt = new Date().toISOString();
  const before = collect();
  json('baseline-protected-files.json', before);
  json('baseline-protection-info.json', { capturedAt, algorithm: 'SHA-256 over binary file reads', protectedFileCount: before.length, exclusions: [...excluded, evidenceRelative], coverage: 'Project source, assets, constants, scripts, docs, design DOCX, historical JSONL, editor/reference files, configuration, and existing quality-review evidence. External references recovered from B2.1 protected inventory.', policy: 'No protected file mutations authorized; new evidence only in this directory.', baselineOnly: true });
  const gates = await Promise.all([gate('check:naming', 'naming'), gate('typecheck', 'typecheck'), gate('check:dependencies', 'dependencies')]);
  json('baseline-gate-results.json', { baselineOnly: true, b22Acceptance: false, note: 'The existing project passes or fails independently of the unimplemented B2.2 scope. These are not B2.2 delivery gates.', gates });
  const previewResult = await preview();
  const after = collect();
  const old = new Map(before.map(row => [row.path, row]));
  const current = new Map(after.map(row => [row.path, row]));
  const changed = after.filter(row => old.has(row.path) && old.get(row.path).sha256 !== row.sha256).map(row => row.path);
  const added = after.filter(row => !old.has(row.path)).map(row => row.path);
  const removed = before.filter(row => !current.has(row.path)).map(row => row.path);
  json('baseline-protection-verification.json', { verifiedAt: new Date().toISOString(), beforeCount: before.length, afterCount: after.length, changed, added, removed, unchanged: changed.length === 0 && added.length === 0 && removed.length === 0, evidenceDirectoryExcluded: evidenceRelative });
  console.log(JSON.stringify({ baselineOnly: true, protectedFiles: before.length, gates: gates.map(({ script, exitCode, passed }) => ({ script, exitCode, passed })), previewAvailable: previewResult.available, selectedCompilationFresh: previewResult.allSelectedCompilationFresh, changed, added, removed }, null, 2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
