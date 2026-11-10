#!/usr/bin/env node
'use strict';

/**
 * check-ledger-single-writer-v4
 *
 * 1. appendNarrativeEvent 的调用只允许在 v4/core/director/（R2 无 director，production 应为 0 调用）。
 * 2. LedgerStore.append 的调用只允许在 v4/core/ledger/。
 * 3. tests 不扫描；定义处不算调用；v4/app 参与扫描；.tsx 参与扫描。
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('node:assert/strict');

const ROOT = process.cwd();
const CORE_DIR = path.join(ROOT, 'v4', 'core');
const ADAPTERS_DIR = path.join(ROOT, 'v4', 'adapters');
const APP_DIR = path.join(ROOT, 'v4', 'app');
const DIRECTOR_DIR = path.join(CORE_DIR, 'director');
const LEDGER_DIR = path.join(CORE_DIR, 'ledger');

const errors = [];

function walkTs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.dist') continue;
      out.push(...walkTs(full));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function parse(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function isUnder(file, directory) {
  const relative = path.relative(directory, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function runSelfTest() {
  assert.equal(isUnder(path.join(CORE_DIR, 'director', 'x.ts'), DIRECTOR_DIR), true);
  assert.equal(isUnder(path.join(CORE_DIR, 'ledger', 'x.ts'), DIRECTOR_DIR), false);
  console.log('selftest: check-ledger-single-writer ok');
}

function main() {
  const files = [...walkTs(CORE_DIR), ...walkTs(ADAPTERS_DIR), ...walkTs(APP_DIR)];
  let callCount = 0;

  for (const file of files) {
    const source = parse(file);
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee) && callee.text === 'appendNarrativeEvent') {
          callCount += 1;
          if (!isUnder(file, DIRECTOR_DIR)) {
            errors.push(`${rel(file)}:${lineOf(source, node)} appendNarrativeEvent 调用不在 v4/core/director/`);
          }
        } else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'append') {
          callCount += 1;
          if (!isUnder(file, LEDGER_DIR)) {
            errors.push(`${rel(file)}:${lineOf(source, node)} LedgerStore.append 调用不在 v4/core/ledger/`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
  }

  console.log('== check-ledger-single-writer-v4 ==');
  console.log(`扫描文件: ${files.length}`);
  console.log(`调用点: ${callCount}`);
  if (errors.length > 0) {
    for (const error of errors) console.log('ERROR ' + error);
    console.log(`汇总: ${errors.length} ERROR`);
    process.exit(1);
  }
  console.log('汇总: 0 ERROR');
}

if (process.argv.includes('--selftest')) {
  runSelfTest();
  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error('ERROR ' + (error instanceof Error ? error.stack || error.message : String(error)));
  process.exit(1);
}
