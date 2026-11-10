'use strict';
// Executes existing suites unchanged while redirecting their JSON evidence into B2.3.
// Original suite filename/require context stays intact; historical evidence is never overwritten.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../..'), input = process.argv[2];
const suites = new Set([
  ...['aggregation', 'chart', 'recall', 'replay', 'storage', 'world-link', 'runtime-wiring'].map(name =>
    'quality-review/b2-state-extensions/' + name + '.contract.cjs'),
  ...['aggregation', 'ledger', 'puzzle', 'storage', 'runtime-wiring'].map(name =>
    'quality-review/b2-state-core/' + name + '.contract.cjs'),
  'quality-review/b2-local-worlds/logic-acceptance.cjs',
  'quality-review/b2-local-worlds/builder-boundary.cjs',
  'quality-review/world-folder/acceptance.cjs',
  'quality-review/b2-foundation/account-milestone.contract.cjs',
  'quality-review/b2-world-clear/domain.contract.cjs',
  'quality-review/b2-world-clear/storage.contract.cjs',
]);
if (!suites.has(input)) { throw new Error('Unknown historical regression suite'); }
const output = path.join(__dirname, 'regression-results'); fs.mkdirSync(output, { recursive: true });
const source = path.join(root, input), suiteDirectory = path.dirname(source), suiteGroup = path.basename(suiteDirectory);
const write = fs.writeFileSync.bind(fs);
fs.writeFileSync = (filename, data, ...args) => {
  const resolved = path.resolve(String(filename));
  if (path.dirname(resolved) !== suiteDirectory || path.extname(resolved) !== '.json') {
    throw new Error('Historical suite attempted a write outside its evidence directory: ' + resolved);
  }
  return write(path.join(output, suiteGroup + '-' + path.basename(resolved)), data, ...args);
};
const loaded = new Module(source, module); loaded.filename = source;
loaded.paths = Module._nodeModulePaths(suiteDirectory); loaded._compile(fs.readFileSync(source, 'utf8'), source);
