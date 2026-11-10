'use strict';
// Execute the exact pre-edit checker against current production sources.
// Its virtual filename preserves the original repository scan root; no checker is edited.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'scripts/check-naming.js');
const baseline = path.join(__dirname, 'baseline/scripts/check-naming.js');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(fs.readFileSync(baseline, 'utf8'), filename);
