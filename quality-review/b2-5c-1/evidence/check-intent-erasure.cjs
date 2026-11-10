'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('../../../node_modules/typescript');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const before = fs.readFileSync(path.join(__dirname, 'IntentPort.before.ts'));
const after = fs.readFileSync(path.join(root, 'src/director/IntentPort.ts'));
const prefixPreserved = hash(before) === baseline.intentBeforeSha256 && after.subarray(0, before.length).equals(before);
const tail = prefixPreserved ? after.subarray(before.length).toString('utf8') : '';
const tailAST = ts.createSourceFile('IntentPort.append.ts', tail, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
const typeOnlyAppend = prefixPreserved && tailAST.statements.length > 0 && tailAST.statements.every(statement =>
  ts.isExportDeclaration(statement) && statement.isTypeOnly && statement.moduleSpecifier
  && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === './SharedCommitContracts');
const compilerOptions = { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.ES2015, isolatedModules: true,
  experimentalDecorators: true, removeComments: true };
const emit = source => ts.transpileModule(source, { fileName: 'IntentPort.ts', compilerOptions, reportDiagnostics: true });
const a = emit(before.toString('utf8')), b = emit(after.toString('utf8'));
const diagnostics = [...(a.diagnostics || []), ...(b.diagnostics || [])].map(item => ({ code: item.code,
  category: ts.DiagnosticCategory[item.category], message: ts.flattenDiagnosticMessageText(item.messageText, '\n') }));
const runtimeBytesEqual = Buffer.from(a.outputText).equals(Buffer.from(b.outputText));
const noSharedRuntimeDependency = !b.outputText.includes('SharedCommitContracts');
fs.writeFileSync(path.join(__dirname, 'IntentPort.before.emitted.js'), a.outputText);
fs.writeFileSync(path.join(__dirname, 'IntentPort.after.emitted.js'), b.outputText);
const report = { generatedUtc: new Date().toISOString(), typescriptVersion: ts.version, baselineCapturedUtc: baseline.capturedUtc,
  beforeSourceBytes: before.length, beforeSourceSha256: hash(before), afterSourceBytes: after.length, afterSourceSha256: hash(after),
  tailBytes: after.length - before.length, prefixPreserved, typeOnlyAppend, typeOnlyExportCount: tailAST.statements.length,
  compilerOptions: { target: 'ES2015', module: 'ES2015', isolatedModules: true, experimentalDecorators: true, removeComments: true },
  beforeEmittedSha256: hash(Buffer.from(a.outputText)), afterEmittedSha256: hash(Buffer.from(b.outputText)),
  emittedBytes: Buffer.byteLength(b.outputText), runtimeBytesEqual, noSharedRuntimeDependency, diagnostics,
  pass: prefixPreserved && typeOnlyAppend && runtimeBytesEqual && noSharedRuntimeDependency && diagnostics.length === 0,
  scope: 'Original source byte prefix plus AST-only type export append; comment-free TypeScript ES2015 emission is byte identical before/after. This transpile comparison proves runtime erasure, not full type checking; the original repository tsc gate separately passed.' };
fs.writeFileSync(path.join(__dirname, 'intent-type-erasure.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.pass ? 0 : 1;
