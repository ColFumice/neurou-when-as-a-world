'use strict';
// Keep accepted B1 sources/results untouched. Relocate the harness and rename its
// result only so all current-run artifacts remain in the B2 evidence directory.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const runs = [], sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
for (const [name, changeFrom, changeTo] of [
  ['logic-acceptance', "save('logic-results.json', report)", "save('b1-logic-results.json', report)"],
  ['resource-boundary', "'resource-boundary-results.json'", "'b1-resource-boundary-results.json'"]
]) {
  const original = path.join(__dirname, '../b1-editor-game', name + '.cjs'), source = fs.readFileSync(original, 'utf8');
  if (source.split(changeFrom).length !== 2) throw Error('Ambiguous B1 relocation edit: ' + name);
  const relocated = path.join(__dirname, 'b1-' + name + '.cjs'); fs.writeFileSync(relocated, source.replace(changeFrom, changeTo));
  const result = cp.spawnSync(process.execPath, [relocated], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8', windowsHide: true });
  fs.writeFileSync(path.join(__dirname, 'b1-' + name + '.log'), (result.stdout || '') + (result.stderr || ''));
  runs.push({ name, original: path.relative(path.resolve(__dirname, '../..'), original), originalSha256: sha(fs.readFileSync(original)),
    adaptation: 'Only renamed output result filename; all executable assertions unchanged.', exitCode: result.status, pass: result.status === 0 });
}
const report = { generatedAt: new Date().toISOString(), pass: runs.every(r => r.pass), runs };
fs.writeFileSync(path.join(__dirname, 'b1-regression-results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.pass ? 0 : 1;
