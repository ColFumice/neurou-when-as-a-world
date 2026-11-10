#!/usr/bin/env node
'use strict';

/**
 * check-zero-engine-v4
 *
 * 扫描 v4/core（K~R，排除 v4/core/presentation）：
 * - 禁止 React / PixiJS / Web Audio / Tauri / Node fs / path / crypto / cc 的 import；
 * - 禁止浏览器 / Node 全局标识符；
 * - presentation（P）允许 React/Pixi/WebAudio；adapters（X）与 tests 不在扫描范围。
 * - .tsx 参与 walk；P 目录整体排除。
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('node:assert/strict');

const ROOT = process.cwd();
const CORE_DIR = path.join(ROOT, 'v4', 'core');
const PRESENTATION_DIR = path.join(CORE_DIR, 'presentation');
const errors = [];

const EXACT_FORBIDDEN_IMPORTS = new Set([
  'react', 'react-dom', 'react-dom/client', 'pixi.js', 'cc', 'cocos',
  'fs', 'fs/promises', 'path', 'crypto',
]);

const PREFIX_FORBIDDEN_IMPORTS = [
  'react/', 'react-dom/', '@pixi/', '@tauri-apps/', 'cc/', 'path/', 'crypto/',
];

const FORBIDDEN_GLOBALS = new Set([
  'fetch', 'window', 'document', 'AudioContext', 'WebSocket', 'XMLHttpRequest',
  'process', 'require', '__dirname', '__filename',
  'localStorage', 'sessionStorage', 'navigator',
]);

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

function forbiddenImport(specifier) {
  if (specifier.startsWith('node:')) return true;
  if (EXACT_FORBIDDEN_IMPORTS.has(specifier)) return true;
  return PREFIX_FORBIDDEN_IMPORTS.some((prefix) => specifier.startsWith(prefix));
}

function isUnder(file, directory) {
  const relative = path.relative(directory, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function runSelfTest() {
  assert.equal(forbiddenImport('react'), true);
  assert.equal(forbiddenImport('node:fs'), true);
  assert.equal(forbiddenImport('./local'), false);
  assert.equal(isUnder(path.join(PRESENTATION_DIR, 'x.tsx'), PRESENTATION_DIR), true);
  console.log('selftest: check-zero-engine ok');
}

function main() {
  const files = walkTs(CORE_DIR).filter((file) => !isUnder(file, PRESENTATION_DIR));

  for (const file of files) {
    const source = parse(file);
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        if (forbiddenImport(node.moduleSpecifier.text)) {
          errors.push(`${rel(file)}:${lineOf(source, node)} 禁止 import ${node.moduleSpecifier.text}（逻辑层零引擎）`);
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (forbiddenImport(node.moduleSpecifier.text)) {
          errors.push(`${rel(file)}:${lineOf(source, node)} 禁止 export-from ${node.moduleSpecifier.text}（逻辑层零引擎）`);
        }
      } else if (ts.isCallExpression(node)
        && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length > 0
        && ts.isStringLiteral(node.arguments[0])
        && forbiddenImport(node.arguments[0].text)) {
        errors.push(`${rel(file)}:${lineOf(source, node)} 禁止动态 import ${node.arguments[0].text}（逻辑层零引擎）`);
      } else if (ts.isPropertyAccessExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'module'
        && node.name.text === 'exports') {
        errors.push(`${rel(file)}:${lineOf(source, node)} 禁止 module.exports（Node 全局）`);
      } else if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
        errors.push(`${rel(file)}:${lineOf(source, node)} 禁止全局 ${node.text}（逻辑层零引擎）`);
      }

      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
  }

  console.log('== check-zero-engine-v4 ==');
  console.log(`扫描文件: ${files.length}`);
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
