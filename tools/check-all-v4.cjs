#!/usr/bin/env node
'use strict';

/**
 * check-all-v4
 * 顺序执行四个门禁，写 gates/<name>.log 与 gates-results.json。
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const TOOLS_DIR = __dirname;
const GATES_DIR = path.join(ROOT, 'quality-review', 'stage-4', 'r3', 'gates');

const GATES = [
  { name: 'check-naming', script: 'check-naming-v4.cjs' },
  { name: 'check-dependencies', script: 'check-dependencies-v4.cjs' },
  { name: 'check-zero-engine', script: 'check-zero-engine-v4.cjs' },
  { name: 'check-ledger-single-writer', script: 'check-ledger-single-writer-v4.cjs' },
];

fs.mkdirSync(GATES_DIR, { recursive: true });

const results = [];

for (const gate of GATES) {
  const scriptPath = path.join(TOOLS_DIR, gate.script);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  let output = (result.stdout || '') + (result.stderr || '');
  if (result.error) {
    output += `\nERROR spawn failed: ${result.error.message}\n`;
  }

  const lines = output.split(/\r?\n/);
  const printedErrors = lines.filter((line) => /^ERROR\b/.test(line)).length;
  const exitCode = result.status === null ? 1 : result.status;
  const errorCount = printedErrors > 0 ? printedErrors : (exitCode === 0 ? 0 : 1);
  const warnCount = lines.filter((line) => /^WARN\b/.test(line)).length;

  fs.writeFileSync(path.join(GATES_DIR, gate.name + '.log'), output, 'utf8');
  results.push({
    name: gate.name,
    exitCode,
    errorCount,
    warnCount,
    output,
  });
}

const totalErrors = results.reduce((sum, result) => sum + result.errorCount, 0);
const allPassed = results.every((result) => result.exitCode === 0 && result.errorCount === 0);
const payload = {
  timestamp: new Date().toISOString(),
  results,
  totalErrors,
  allPassed,
};

fs.writeFileSync(
  path.join(GATES_DIR, 'gates-results.json'),
  JSON.stringify(payload, null, 2) + '\n',
  'utf8',
);

console.log('== check-all-v4 ==');
for (const result of results) {
  console.log(`${result.name}: exit=${result.exitCode} ERROR=${result.errorCount} WARN=${result.warnCount}`);
}
console.log(`totalErrors=${totalErrors} allPassed=${allPassed}`);
console.log(`evidence=${path.relative(ROOT, GATES_DIR).replace(/\\/g, '/')}`);

process.exit(allPassed ? 0 : 1);
