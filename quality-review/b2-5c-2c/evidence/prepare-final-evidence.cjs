'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const intent = 'src/director/IntentPort.ts';
const output = path.join(__dirname, 'intent-before-c2c.ts');
if (!fs.existsSync(output)) {
  const original = baseline.files.find(file => file.path === intent);
  const bytes = fs.readFileSync(path.join(root, intent)).subarray(0, original.bytes);
  if (sha(bytes) !== original.sha256) throw new Error('IntentPort original byte prefix differs from the baseline.');
  fs.writeFileSync(output, bytes);
}
if (sha(fs.readFileSync(output)) !== baseline.files.find(file => file.path === intent).sha256) throw new Error('IntentPort before snapshot is inconsistent.');
for (const name of ['run-b24-regression.cjs', 'run-c1-regression.cjs']) {
  const destination = path.join(__dirname, name);
  if (fs.existsSync(destination)) throw new Error('Derived regression wrapper already exists.');
  const original = fs.readFileSync(path.join(root, 'quality-review/b2-5c-2b/evidence', name), 'utf8');
  const derived = original.replaceAll('B2.5c-2b', 'B2.5c-2c').replaceAll('new c-2b directory', 'new c-2c directory').replaceAll('redirected to c-2b', 'redirected to c-2c');
  fs.writeFileSync(destination, derived);
}
console.log(JSON.stringify({ intentSnapshot: 'intent-before-c2c.ts', originalBytes: fs.statSync(output).size, originalSha256: sha(fs.readFileSync(output)), regressionWrappers: ['run-b24-regression.cjs', 'run-c1-regression.cjs'], scope: 'New evidence only; historical suites remain read-only.' }, null, 2));
