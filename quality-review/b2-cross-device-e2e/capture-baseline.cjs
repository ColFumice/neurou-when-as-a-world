'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const directories = ['src', 'constants', 'assets', 'scripts', 'types', 'docs', 'settings', 'profiles', '.trae', '.creator', 'archive', '编辑器'];
const rootFiles = ['package.json', 'package-lock.json', 'tsconfig.json', '雨若_Neurou_main_describe.docx', '雨若_Neurou_core_gameplay.docx', 'big logo.png', 'small logo.png', '641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl'];
const excluded = new Set(['node_modules', '.git', 'library', 'temp', 'tmp']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.meta']);
const target = process.argv[2] || 'baseline-before.json';
if (path.basename(target) !== target) throw new Error('Output must be a basename in this evidence directory');
const captureOriginals = target === 'baseline-before.json';
if (captureOriginals && fs.existsSync(path.join(__dirname, target))) throw new Error('Immutable baseline already exists');
const files = [], symbolicLinks = [], unreadable = [], originals = [];
const seenOriginalPaths = new Set();
const normalize = value => value.split(path.sep).join('/');

function capture(file) {
  const relative = normalize(path.relative(root, file));
  try {
    const bytes = fs.readFileSync(file);
    const realPath = fs.realpathSync(file);
    const canonical = normalize(path.relative(root, realPath));
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    files.push({path: relative, canonicalPath: canonical, bytes: bytes.length, sha256});
    if (captureOriginals && (sourceExtensions.has(path.extname(file).toLowerCase()) || (relative.startsWith('docs/') && path.extname(file).toLowerCase() === '.md')) && !seenOriginalPaths.has(canonical)) {
      if (canonical.startsWith('../') || path.isAbsolute(canonical)) throw new Error('Original source resolved outside workspace');
      seenOriginalPaths.add(canonical);
      const copy = path.join(__dirname, 'original-source', canonical);
      fs.mkdirSync(path.dirname(copy), {recursive: true});
      fs.writeFileSync(copy, bytes);
      originals.push({path: canonical, bytes: bytes.length, sha256, copy: 'original-source/' + canonical});
    }
  } catch (error) { unreadable.push({path: relative, reason: String(error)}); }
}
function walk(dir, ancestors = new Set()) {
  const canonical = fs.realpathSync(dir);
  if (ancestors.has(canonical)) {
    unreadable.push({path: normalize(path.relative(root, dir)), reason: 'Recursive directory link cycle'});
    return;
  }
  const next = new Set(ancestors);
  next.add(canonical);
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (excluded.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, next);
    else if (entry.isFile()) capture(full);
    else if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(full);
      symbolicLinks.push({path: normalize(path.relative(root, full)), target: normalize(path.relative(root, real))});
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full, next);
      else if (stat.isFile()) capture(full);
      else unreadable.push({path: normalize(path.relative(root, full)), reason: 'Non-regular link target'});
    } else unreadable.push({path: normalize(path.relative(root, full)), reason: 'Non-regular directory entry'});
  }
}
for (const directory of directories) {
  const full = path.join(root, directory);
  if (fs.existsSync(full)) walk(full);
  else unreadable.push({path: directory, reason: 'Requested directory missing'});
}
for (const file of rootFiles) capture(path.join(root, file));
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
originals.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const report = {schemaVersion: 1, phase: 'B2.4e', capturedAt: new Date().toISOString(), root, algorithm: 'sha256', scope: {directories, rootFiles, excludedDirectoryNames: [...excluded]}, fileCount: files.length, symbolicLinks, unreadable, files};
fs.writeFileSync(path.join(__dirname, target), JSON.stringify(report, null, 2) + '\n', 'utf8');
if (captureOriginals) fs.writeFileSync(path.join(__dirname, 'original-source-index.json'), JSON.stringify({schemaVersion: 1, phase: 'B2.4e', copiedAt: report.capturedAt, sourceExtensions: [...sourceExtensions], officialDocumentSnapshotPolicy: 'Additionally capture original bytes for .md files within docs/. All snapshots remain immutable.', fileCount: originals.length, files: originals}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({target, fileCount: files.length, originalSourceCount: originals.length, symbolicLinks, unreadable}));
process.exitCode = unreadable.length === 0 ? 0 : 1;
