const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const dirs = ['src', 'constants', 'assets', 'scripts', 'types', 'docs', 'settings', 'profiles', '.trae', '.creator'];
const rootFiles = ['package.json', 'package-lock.json', 'tsconfig.json', '雨若_Neurou_main_describe.docx', '雨若_Neurou_core_gameplay.docx', 'big logo.png', 'small logo.png', '641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl'];
const excluded = new Set(['node_modules', '.git', 'library', 'temp', 'tmp']);
const files = [];
const unreadable = [];
const symbolicLinks = [];

function capture(file) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  try {
    const bytes = fs.readFileSync(file);
    files.push({path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
  } catch (error) {
    unreadable.push({path: relative, reason: String(error)});
  }
}
function walk(dir, ancestors = new Set()) {
  const canonical = fs.realpathSync(dir);
  if (ancestors.has(canonical)) {
    unreadable.push({path: path.relative(root, dir).split(path.sep).join('/'), reason: 'Recursive directory link cycle'});
    return;
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(canonical);
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (excluded.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, nextAncestors);
    else if (entry.isFile()) capture(full);
    else if (entry.isSymbolicLink()) {
      const target = fs.realpathSync(full);
      symbolicLinks.push({path: path.relative(root, full).split(path.sep).join('/'), target: path.relative(root, target).split(path.sep).join('/')});
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full, nextAncestors);
      else if (stat.isFile()) capture(full);
      else unreadable.push({path: path.relative(root, full).split(path.sep).join('/'), reason: 'Non-regular link target'});
    }
    else unreadable.push({path: path.relative(root, full).split(path.sep).join('/'), reason: 'Non-regular directory entry'});
  }
}
for (const dir of dirs) {
  const full = path.join(root, dir);
  if (fs.existsSync(full)) walk(full);
  else unreadable.push({path: dir, reason: 'Requested directory missing'});
}
for (const file of rootFiles) capture(path.join(root, file));
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const result = {schemaVersion: 1, capturedAt: new Date().toISOString(), root, algorithm: 'sha256', scope: {directories: dirs, rootFiles, excludedDirectoryNames: [...excluded]}, fileCount: files.length, symbolicLinks, unreadable, files};
const target = process.argv[2] || 'baseline-before.json';
if (path.basename(target) !== target) throw new Error('Output must be a basename in this evidence directory');
fs.writeFileSync(path.join(__dirname, target), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({target, fileCount: files.length, unreadable}));
