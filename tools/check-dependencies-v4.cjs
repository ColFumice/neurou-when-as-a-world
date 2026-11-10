#!/usr/bin/env node
'use strict';

/**
 * check-dependencies-v4
 *
 * 扫描 v4/core + v4/adapters + v4/app 的 import / export-from：
 * - 解析 type-only 与值导入；
 * - 对照 stage-4 §5 矩阵（module-map-v4.cjs allowedEdge）；
 * - adapters / app 按 X 行处理；tests 豁免；.tsx 参与扫描；
 * - 单独检查 stage-4 §5.3 禁止边。
 *
 * 注：module-map.allowedEdge 的 type-only 分支只查 typeOnly 列；
 * stage-4 的 ✓ 值边对 type-only 同样成立，因此这里用 value 回退补偿。
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { loadDependencyMatrix, pathToModule, allowedEdge } = require('./lib/module-map-v4.cjs');

const ROOT = process.cwd();
const CORE_DIR = path.join(ROOT, 'v4', 'core');
const ADAPTERS_DIR = path.join(ROOT, 'v4', 'adapters');
const APP_DIR = path.join(ROOT, 'v4', 'app');

const FORBIDDEN_EDGES = new Map([
  ['C>T', 'chart → trace'],
  ['T>C', 'trace → chart'],
  ['T>G', 'trace → eventgraph'],
  ['T>R', 'trace → director'],
  ['G>R', 'eventgraph → director'],
  ['E>R', 'editor → director'],
  ['E>L', 'editor → ledger'],
  ['U>R', 'musicEditor → director'],
  ['U>L', 'musicEditor → ledger'],
]);

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

function importIsTypeOnly(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    const elements = clause.namedBindings.elements;
    return elements.length > 0 && elements.every((element) => element.isTypeOnly);
  }
  return false;
}

function exportIsTypeOnly(node) {
  if (node.isTypeOnly) return true;
  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    const elements = node.exportClause.elements;
    return elements.length > 0 && elements.every((element) => element.isTypeOnly);
  }
  return false;
}

function isAssetSpecifier(specifier) {
  return /\.(css|scss|sass|less|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|json)$/i.test(specifier);
}

function resolveSpecifier(fromFile, specifier) {
  let base = null;
  if (specifier.startsWith('@core/')) base = path.join(ROOT, 'v4', 'core', specifier.slice(6));
  else if (specifier.startsWith('@adapters/')) base = path.join(ROOT, 'v4', 'adapters', specifier.slice(10));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier);
  if (base === null) return null;
  const candidates = [
    base + '.ts',
    base + '.tsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function runSelfTest() {
  const source = ts.createSourceFile(
    'fixture.ts',
    "import type { X } from './x';",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.equal(importIsTypeOnly(source.statements[0]), true);
  const mixed = ts.createSourceFile(
    'fixture.ts',
    "import { type X, Y } from './x';",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.equal(importIsTypeOnly(mixed.statements[0]), false);
  assert.equal(isAssetSpecifier('./app.css'), true);
  assert.equal(isAssetSpecifier('./App'), false);
  console.log('selftest: check-dependencies ok');
}

function main() {
  const { matrix } = loadDependencyMatrix(ROOT);
  const files = [...walkTs(CORE_DIR), ...walkTs(ADAPTERS_DIR), ...walkTs(APP_DIR)];
  let edgeCount = 0;

  for (const file of files) {
    const fromModule = pathToModule(rel(file));
    if (fromModule === null) {
      errors.push(`${rel(file)} 无法映射到模块`);
      continue;
    }
    const source = parse(file);

    const handle = (moduleSpecifier, typeOnly, node) => {
      if (!moduleSpecifier || isAssetSpecifier(moduleSpecifier)) return;
      const target = resolveSpecifier(file, moduleSpecifier);
      if (target === null) {
        if (moduleSpecifier.startsWith('.')
          || moduleSpecifier.startsWith('@core/')
          || moduleSpecifier.startsWith('@adapters/')) {
          errors.push(`${rel(file)}:${lineOf(source, node)} 无法解析依赖 ${moduleSpecifier}`);
        }
        return;
      }
      const toModule = pathToModule(rel(target));
      if (toModule === null) {
        errors.push(`${rel(file)}:${lineOf(source, node)} 目标 ${rel(target)} 无法映射到模块`);
        return;
      }
      edgeCount += 1;
      if (fromModule === toModule) return;

      const edge = fromModule + '>' + toModule;
      const forbidden = FORBIDDEN_EDGES.get(edge);
      if (forbidden) {
        errors.push(`${rel(file)}:${lineOf(source, node)} ${fromModule} → ${toModule}（${typeOnly ? '类型' : '值'}）禁止边：${forbidden}`);
        return;
      }
      const allowed = allowedEdge(matrix, fromModule, toModule, typeOnly)
        || (typeOnly && allowedEdge(matrix, fromModule, toModule, false));
      if (!allowed) {
        errors.push(`${rel(file)}:${lineOf(source, node)} ${fromModule} → ${toModule}（${typeOnly ? '类型' : '值'}）违反 stage-4 §5 矩阵`);
      }
    };

    for (const node of source.statements) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        handle(node.moduleSpecifier.text, importIsTypeOnly(node), node);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        handle(node.moduleSpecifier.text, exportIsTypeOnly(node), node);
      }
    }
  }

  console.log('== check-dependencies-v4 ==');
  console.log(`扫描文件: ${files.length}`);
  console.log(`依赖边: ${edgeCount}`);
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
