'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const original = path.resolve(__dirname, '../protected-final-audit.json');
const backup = path.join(__dirname, 'canonical-audit-before-context-fix.json');
if (fs.existsSync(backup)) throw new Error('Canonical preliminary backup is immutable.');
const bytes = fs.readFileSync(original);
fs.writeFileSync(backup, bytes);
fs.unlinkSync(original);
const child = cp.spawnSync(process.execPath, [path.join(__dirname, 'assemble-final-audit.cjs')], { cwd: path.resolve(__dirname, '../../..'), windowsHide: true, encoding: 'utf8' });
if (child.status !== 0) { fs.writeFileSync(original, bytes); throw new Error('Context repair failed; original canonical bytes restored.'); }
process.stdout.write(child.stdout);
console.log(JSON.stringify({ preliminaryCanonicalPreserved: 'evidence/canonical-audit-before-context-fix.json', preliminarySha256: crypto.createHash('sha256').update(bytes).digest('hex'), scope: 'Only canonical artifact context was corrected before delivery; original baseline, raw implementation audit and prerequisite/paused records stay unchanged.' }, null, 2));
