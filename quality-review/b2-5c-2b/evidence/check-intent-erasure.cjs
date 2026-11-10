'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const before = Buffer.from(baseline.originalIntentPortBase64, 'base64'), after = fs.readFileSync(path.join(root, 'src/director/IntentPort.ts'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const prefixPreserved = after.subarray(0, before.length).equals(before);
const suffix = prefixPreserved ? after.subarray(before.length).toString('utf8') : '';
const ast = ts.createSourceFile('IntentPort.suffix.ts', suffix, ts.ScriptTarget.ES2015, true);
const typeOnly = ast.parseDiagnostics.length === 0 && ast.statements.length > 0 && ast.statements.every(statement => ts.isExportDeclaration(statement) && statement.isTypeOnly && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === './SharedServiceProtocolContracts');
const compilerOptions = { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.ES2015, isolatedModules: true, experimentalDecorators: true, removeComments: true };
const a = ts.transpileModule(before.toString('utf8'), { compilerOptions, fileName: 'IntentPort.ts', reportDiagnostics: true });
const b = ts.transpileModule(after.toString('utf8'), { compilerOptions, fileName: 'IntentPort.ts', reportDiagnostics: true });
const diagnostics = [...(a.diagnostics ?? []), ...(b.diagnostics ?? [])].map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') }));
fs.writeFileSync(path.join(__dirname, 'IntentPort.before.emitted.js'), a.outputText); fs.writeFileSync(path.join(__dirname, 'IntentPort.after.emitted.js'), b.outputText);
const report = { generatedUtc: new Date().toISOString(), typescriptVersion: ts.version, beforeSourceBytes: before.length, afterSourceBytes: after.length, suffixBytes: after.length - before.length, prefixPreserved, suffixTypeOnly: typeOnly, exportCount: ast.statements.length,
  beforeEmittedSha256: hash(a.outputText), afterEmittedSha256: hash(b.outputText), runtimeBytesEqual: a.outputText === b.outputText, noNewRuntimeDependency: !b.outputText.includes('SharedServiceProtocolContracts'), diagnostics,
  pass: prefixPreserved && typeOnly && a.outputText === b.outputText && !b.outputText.includes('SharedServiceProtocolContracts') && diagnostics.length === 0,
  scope: 'Comment-free ES2015 transpilation before/after proves erased type-only suffix and identical emitted runtime. This is separate from full repository typecheck.' };
fs.writeFileSync(path.join(__dirname, 'intent-type-erasure.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.pass ? 0 : 1;
