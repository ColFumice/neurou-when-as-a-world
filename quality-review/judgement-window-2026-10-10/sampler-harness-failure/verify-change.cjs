const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ts = require('../../node_modules/typescript');
const root = path.resolve(__dirname, '../..');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => fs.readFileSync(p, 'utf8');
const baseline = JSON.parse(read(path.join(__dirname, 'baseline-files.json')));
const protectedHashes = JSON.parse(read(path.join(__dirname, 'protected-hashes.json')));
const expected = ['constants/index.ts', 'src/trace/RhythmStrike.ts', 'src/trace/PuzzleChain.ts', 'src/chart/ChartScore.ts', 'assets/scripts/SceneBuilder.ts'];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const candidates = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'constants')), ...walk(path.join(root, 'scripts')),
  ...fs.readdirSync(path.join(root, 'assets/scripts')).filter(p => /\.ts(\.meta)?$/.test(p)).map(p => path.join(root, 'assets/scripts', p)),
  path.join(root, 'package.json'), path.join(root, 'tsconfig.json')];
const changed = candidates.map(p => ({ path: path.relative(root, p).replace(/\\/g, '/'), sha256: hash(p) })).filter(f => f.sha256 !== baseline[f.path]);
if (changed.length !== expected.length || changed.some(f => !expected.includes(f.path))) throw new Error('Unexpected production change');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, removeComments: true } }).outputText;
const transforms = [
  ['PERFECT_WINDOW_MS', 50, 100], ['GOOD_WINDOW_MS', 120, 200], ['RHYTHM_STRIKE_WINDOW_MS', 50, 100],
];
const semanticChecks = expected.map(file => {
  let before = read(path.join(__dirname, 'baseline', file));
  if (file === 'constants/index.ts') for (const [name, oldValue, newValue] of transforms) {
    const text = `export const ${name} = ${oldValue};`;
    if (!before.includes(text)) throw new Error('Missing original constant: ' + name);
    before = before.replace(text, `export const ${name} = ${newValue};`);
  }
  if (file === 'assets/scripts/SceneBuilder.ts') before = before.replace('第二步：跟拍按数字键（±50ms，连续 7 秒无漏拍通过）', '第二步：跟拍按数字键（±100ms，连续 7 秒无漏拍通过）');
  const pass = compile(before) === compile(read(path.join(root, file)));
  if (!pass) throw new Error('Non-constant runtime change: ' + file);
  return { file, pass, rule: file === 'constants/index.ts' ? 'Only three authorized numeric exports differ; comments ignored' : file === 'assets/scripts/SceneBuilder.ts' ? 'Only existing T6 window label updated from 50ms to 100ms; all runtime operations identical' : 'Only comments differ; emitted JavaScript identical' };
});
const changedProtected = Object.entries(protectedHashes).filter(([p, h]) => hash(path.join(root, p)) !== h).map(([p]) => p);
if (changedProtected.length) throw new Error('Protected files changed: ' + changedProtected.join(', '));
let diff = '';
for (const file of expected) {
  const result = cp.spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--', path.join(__dirname, 'baseline', file), path.join(root, file)], { encoding: 'utf8' });
  if (![0, 1].includes(result.status)) throw new Error(result.stderr);
  diff += result.stdout.replace(/^diff --git .*$/m, 'diff --git a/' + file + ' b/' + file).replace(/^--- .*$/m, '--- a/' + file).replace(/^\+\+\+ .*$/m, '+++ b/' + file);
}
fs.writeFileSync(path.join(__dirname, 'implementation.diff'), diff);
fs.writeFileSync(path.join(__dirname, 'changed-files.json'), JSON.stringify(changed, null, 2) + '\n');
const result = { pass: true, checkedAt: new Date().toISOString(), productionFiles: changed.length, authorizedConstantChanges: transforms.map(([name, before, after]) => ({ name, before, after })),
  semanticChecks, judgementLogicUnchanged: true, noNewNamesOrModules: true, gateScriptsUnchanged: true,
  protectedFiles: Object.keys(protectedHashes).length, changedProtected };
fs.writeFileSync(path.join(__dirname, 'change-audit.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
