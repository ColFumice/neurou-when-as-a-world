#!/usr/bin/env node
'use strict';

/**
 * check-naming-v4（P-R2-03 口径）
 *
 * 1. v4/core 每个 export 名必须在 NAMEBOOK A 类且模块一致，否则 ERROR。
 * 2. A 类有、v4/core 未实现的名字不报 ERROR，只统计“未实现 A 类名：N 项”。
 * 3. 禁名表（NAMEBOOK §6.2 / §6.1）出现 → ERROR。
 * 4. 同名跨模块 → ERROR。
 * 5. A 类计数必须为 TOTAL_A（当前 294），否则 ERROR。
 * 6. adapters / app 不做 A 归属校验，只做禁名检查；tests 不扫描。
 * 7. .tsx 参与扫描；TSX 用 ScriptKind.TSX 解析。
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { loadNamebook, TOTAL_A } = require('./lib/namebook-v4.cjs');
const { pathToModule } = require('./lib/module-map-v4.cjs');

const ROOT = process.cwd();
const CORE_DIR = path.join(ROOT, 'v4', 'core');
const ADAPTERS_DIR = path.join(ROOT, 'v4', 'adapters');
const APP_DIR = path.join(ROOT, 'v4', 'app');

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

function hasExport(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
}

function collectExports(source) {
  const out = [];
  for (const node of source.statements) {
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          out.push({ name: element.name.text, node: element });
        }
      } else if (ts.isNamespaceExport(node.exportClause)) {
        out.push({ name: node.exportClause.name.text, node: node.exportClause.name });
      }
      continue;
    }

    if (!hasExport(node)) continue;

    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)
      || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      || ts.isEnumDeclaration(node)) {
      if (node.name) out.push({ name: node.name.text, node: node.name });
      continue;
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          out.push({ name: declaration.name.text, node: declaration.name });
        }
      }
    }
  }
  return out;
}

const EXACT_FORBIDDEN = new Set([
  'Event', 'Developer', 'Rain', 'Window',
  'GridKeyId', 'GridPadKind', 'GridLayer', 'FrameSaturation',
  'WorldFileHighlight', 'WorldFolderHighlight',
  'HeadNode', 'TapNode', 'DragNode', 'HoldNode',
  'EmpathyScaling', 'DirectorSession', 'Chapter', 'ChapterTag', 'InputSource',
]);

const PREFIX_FORBIDDEN = [
  'Shore', 'FinalShore', 'SourceCube', 'Ending',
  'Account', 'WorldState', 'Shared', 'Real', 'Relay', 'Guidance',
  'ElementEntity', 'PuzzleChain',
];

function isRainEnumMember(node) {
  if (node.text !== 'Rain' || !node.parent) return false;
  if (ts.isEnumMember(node.parent)) {
    const declaration = node.parent.parent;
    return ts.isEnumDeclaration(declaration)
      && (declaration.name.text === 'PerceptionMode' || declaration.name.text === 'TraceTier');
  }
  if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
    const expression = node.parent.expression;
    return ts.isIdentifier(expression)
      && (expression.text === 'PerceptionMode' || expression.text === 'TraceTier');
  }
  return false;
}

function forbiddenReason(name, namebook) {
  if (namebook.byName.has(name)) return null;
  if (EXACT_FORBIDDEN.has(name)) return '禁名（exact）';
  for (const prefix of PREFIX_FORBIDDEN) {
    if (name.startsWith(prefix)) return '禁名（prefix:' + prefix + '）';
  }
  return null;
}

function scanForbidden(source, file, namebook) {
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'module'
      && node.name.text === 'exports') {
      errors.push(`${rel(file)}:${lineOf(source, node)} 禁名 module.exports（Node 全局）`);
    }

    if (ts.isIdentifier(node) && !isRainEnumMember(node)) {
      const reason = forbiddenReason(node.text, namebook);
      if (reason) {
        errors.push(`${rel(file)}:${lineOf(source, node)} 禁名 ${node.text}（${reason}）`);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
}

function runSelfTest() {
  const tsx = ts.createSourceFile(
    'fixture.tsx',
    'export function EventTreeView() { return <div />; }',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  assert.deepEqual(collectExports(tsx).map((item) => item.name), ['EventTreeView']);

  const fake = { byName: new Map([['RealityHint', {}]]) };
  assert.ok(forbiddenReason('Account', fake));
  assert.equal(forbiddenReason('RealityHint', fake), null);

  const rain = ts.createSourceFile(
    'rain.ts',
    'enum TraceTier { Rain }',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const enumDecl = rain.statements.find(ts.isEnumDeclaration);
  assert.ok(enumDecl);
  assert.equal(isRainEnumMember(enumDecl.members[0].name), true);
  console.log('selftest: check-naming ok');
}

function main() {
  const namebook = loadNamebook(ROOT);
  if (namebook.total !== TOTAL_A) {
    errors.push(`NAMEBOOK A 类计数异常：${namebook.total}（期望 ${TOTAL_A}）`);
  }
  for (const duplicate of namebook.duplicates) {
    errors.push(`NAMEBOOK 同名跨 section：${duplicate.name}`);
  }
  for (const mismatch of namebook.countMismatches) {
    errors.push(`NAMEBOOK section ${mismatch.section} 计数不符：${mismatch.actual}/${mismatch.expected}`);
  }
  for (const section of namebook.unmappedSections) {
    errors.push(`NAMEBOOK section ${section} 无模块映射`);
  }

  const implemented = new Set();
  const namesByModule = new Map();
  const coreFiles = walkTs(CORE_DIR);

  for (const file of coreFiles) {
    const module = pathToModule(rel(file));
    if (module === null) {
      errors.push(`${rel(file)} 无法映射到模块`);
      continue;
    }
    const source = parse(file);
    for (const exported of collectExports(source)) {
      const record = namebook.byName.get(exported.name);
      if (!record) {
        errors.push(`${rel(file)}:${lineOf(source, exported.node)} 导出 ${exported.name} 不在 A 类（模块 ${module}）`);
        continue;
      }
      if (record.module !== module) {
        errors.push(`${rel(file)}:${lineOf(source, exported.node)} 导出 ${exported.name} 模块不一致（代码 ${module} / A 类 ${record.module}）`);
        continue;
      }
      implemented.add(exported.name);
      if (!namesByModule.has(exported.name)) namesByModule.set(exported.name, new Set());
      namesByModule.get(exported.name).add(module);
    }
    scanForbidden(source, file, namebook);
  }

  for (const [name, modules] of namesByModule) {
    if (modules.size > 1) {
      errors.push(`同名跨模块：${name}（${[...modules].join(', ')}）`);
    }
  }

  const adapterFiles = walkTs(ADAPTERS_DIR);
  const appFiles = walkTs(APP_DIR);
  for (const file of [...adapterFiles, ...appFiles]) {
    scanForbidden(parse(file), file, namebook);
  }

  const unimplemented = namebook.names.filter((record) => !implemented.has(record.name)).length;
  const forbiddenHits = errors.filter((line) => line.includes('禁名')).length;
  const crossModuleHits = errors.filter(
    (line) => line.includes('同名跨模块') || line.includes('同名跨 section'),
  ).length;

  console.log('== check-naming-v4 ==');
  console.log(`A 类总数: ${namebook.total}`);
  console.log(`已实现 A 类: ${implemented.size}`);
  console.log(`未实现 A 类名：${unimplemented} 项（不报错）`);
  console.log(`禁名命中: ${forbiddenHits}`);
  console.log(`同名跨模块: ${crossModuleHits}`);
  console.log(`扫描文件: ${coreFiles.length} core + ${adapterFiles.length} adapters + ${appFiles.length} app`);

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
