'use strict';
// Derived B2.2d-2 wiring suite. Explicit fixture extensions supply the new
// no-pending recovery and preloading capabilities. Every old assertion stays unchanged.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const source = path.resolve(__dirname, '../b2-state-extensions/runtime-wiring.contract.cjs');
const original = fs.readFileSync(source, 'utf8');
const before = 'initializeDirectory: async () => {}, prepareCoreValidator: async () => {}, loadFolderSession: () => folder,';
if (original.split(before).length !== 2) { throw new Error('Historical fixture shape changed; review required'); }
const failureBefore = "initializeDirectory: async () => { throw new Error('controlled folder corruption'); }, clearViews() {},";
if (original.split(failureBefore).length !== 2) { throw new Error('Historical failure fixture shape changed; review required'); }
const derived = original.replace(before,
  'recoverPendingFork: async () => {}, initializeDirectory: async () => {}, prepareCoreValidator: async () => {}, loadFolderSession: () => folder,')
  .replace(failureBefore, "recoverPendingFork: async () => {}, prepareCoreValidator: async () => {}, initializeDirectory: async () => { throw new Error('controlled folder corruption'); }, clearViews() {},");
const write = fs.writeFileSync.bind(fs);
fs.writeFileSync = (filename, data, ...args) => {
  if (path.resolve(filename) !== path.join(path.dirname(source), 'runtime-wiring.contract-results.json')) {
    throw new Error('Unexpected derived-suite write');
  }
  return write(path.join(__dirname, 'legacy-wiring-results.json'), data, ...args);
};
const loaded = new Module(source, module); loaded.filename = source;
loaded.paths = Module._nodeModulePaths(path.dirname(source)); loaded._compile(derived, source);
