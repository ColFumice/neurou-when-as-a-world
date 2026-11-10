'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('../../../node_modules/typescript');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const final = JSON.parse(read('test-runs/final-verified/results.json'));
const logBytes = fs.readFileSync(path.join(__dirname, 'test-runs/final-verified/contract-tests.log'));
if (!final.pass || hash(logBytes) !== final.testRun.rawSha256) throw new Error('Require intact passing final test evidence.');
const names = [...logBytes.toString('utf8').matchAll(/^ok (\d+) - (.+)$/gm)].map(match => ({ tapNumber: Number(match[1]), name: match[2] }));
if (names.length !== 154 || !names.every((item, i) => item.tapNumber === i + 1)) throw new Error('Unexpected final TAP index.');
const cases = names.map((item, i) => ({ ...item, id: i < 47 ? 'V' + String(i + 1).padStart(2, '0')
  : i < 123 ? 'C' + String(i - 46).padStart(2, '0') : item.name.slice(0, 3),
  suite: i < 47 ? 'validator' : i < 123 ? 'codec' : 'replay', pass: true }));
const forbidden = new Set(['Date', 'performance', 'window', 'document', 'navigator', 'fetch', 'WebSocket',
  'XMLHttpRequest', 'Buffer', 'TextEncoder', 'TextDecoder', 'require', 'eval', 'Function', 'globalThis', 'process']);
const pureProfiles = final.sources.map(source => {
  const bytes = fs.readFileSync(path.join(root, source.path));
  if (hash(bytes) !== source.sha256) throw new Error('Source changed after final tests: ' + source.path);
  const ast = ts.createSourceFile(source.path, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  const imports = []; const prohibitedIdentifiers = [];
  function visit(node) {
    if (ts.isImportDeclaration(node)) imports.push(node.moduleSpecifier.text);
    if (ts.isIdentifier(node) && forbidden.has(node.text)) prohibitedIdentifiers.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { ...source, imports, importsOnlyWithinIsolatedKernel: imports.every(value => /^\.\/Shared(?:CommitContracts|CanonicalBytes|CommitCodec|CommitValidator)$/.test(value)),
    prohibitedIdentifiers: [...new Set(prohibitedIdentifiers)] };
});
const result = { generatedUtc: new Date().toISOString(), finalRawSha256: hash(logBytes), finalTestCounts: final.counts,
  cases, pureProfiles, sourceProfilePass: pureProfiles.every(profile => profile.importsOnlyWithinIsolatedKernel && profile.prohibitedIdentifiers.length === 0),
  limitations: 'AST import/name audit plus lib=ES2020/types=[] compilation covers these five modules. Trusted injected capabilities may call platform APIs in a future caller; no claim about unseen adapters.' };
fs.writeFileSync(path.join(__dirname, 'acceptance-index.json'), JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'acceptance-index.md'), '# 最终154项验收索引\n\n实际名称由最终 TAP 自动提取。V01–V47/ C01–C76 是本索引编号，R01–R31 是测试原有编号；不改测试名称或原始输出。\n\n'
  + '| 编号 | 套件 | 实际测试名称 | 结果 |\n|---|---|---|---|\n'
  + cases.map(item => '| ' + item.id + ' | ' + item.suite + ' | ' + item.name.replaceAll('|', '\\|') + ' | PASS |').join('\n')
  + '\n\n独立五源码 AST 导入均限于共享内核，无禁止的平台/DOM/网络/时钟标识。源SHA与final-verified相同；完整机械结果与限度见 acceptance-index.json。\n');
console.log(JSON.stringify({ caseCount: cases.length, sourceProfilePass: result.sourceProfilePass, sources: pureProfiles.length }));
if (!result.sourceProfilePass) process.exitCode = 1;
