const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const candidates = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'constants')), ...walk(path.join(root, 'scripts')),
  ...fs.readdirSync(path.join(root, 'assets/scripts')).filter(p => /\.ts(\.meta)?$/.test(p)).map(p => path.join(root, 'assets/scripts', p)),
  path.join(root, 'package.json'), path.join(root, 'tsconfig.json')];
const baseline = Object.fromEntries(candidates.map(p => [path.relative(root, p).replace(/\\/g, '/'), hash(p)]));
for (const p of ['constants/index.ts', 'src/trace/RhythmStrike.ts', 'src/trace/PuzzleChain.ts', 'src/chart/ChartScore.ts']) {
  const destination = path.join(__dirname, 'baseline', p);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(root, p), destination);
  baseline[p] = hash(destination);
}
const oldProtected = JSON.parse(fs.readFileSync(path.join(root, 'quality-review/world-folder/protected-hashes.json'), 'utf8'));
const priorUpdates = Object.entries(oldProtected).filter(([p, h]) => hash(path.join(root, p)) !== h).map(([p]) => p);
const currentProtected = Object.fromEntries(Object.keys(oldProtected).map(p => [p, hash(path.join(root, p))]));
fs.writeFileSync(path.join(__dirname, 'baseline-files.json'), JSON.stringify(baseline, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'protected-hashes.json'), JSON.stringify(currentProtected, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'prior-protected-updates.json'), JSON.stringify({ comparison: 'Prior batch protected hashes versus current task starting references; these changes are not part of this task.', priorUpdates }, null, 2) + '\n');
console.log(JSON.stringify({ productionBaselineFiles: candidates.length, protectedFiles: Object.keys(oldProtected).length, copiedSources: 4 }));
