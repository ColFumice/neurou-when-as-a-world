'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const mode = process.argv[2] || 'final';
if (!['final', 'paused', 'retention-final'].includes(mode)) throw new Error('Use final, paused or retention-final.');
const output = path.join(__dirname, mode === 'paused' ? 'wip-new-names.json' : mode === 'retention-final' ? 'new-names-final.json' : 'new-names.json');
if (fs.existsSync(output)) throw new Error('Naming records are immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceNames = ['server/src/RelayStorage.ts', 'server/src/RelayService.ts', 'server/src/RelayRoute.ts', 'server/src/buildRelayServer.ts', 'src/presentation/RealCommitRelayAdapter.ts'];
const exported = node => !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
function nameText(node) { return ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : node.getText(); }
function boundNames(name) { if (ts.isIdentifier(name)) return [name]; if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) return name.elements.filter(node => ts.isBindingElement(node)).flatMap(node => boundNames(node.name)); return []; }
function scopeName(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isSourceFile(parent)) return '<module>';
    if ((ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent) || ts.isEnumDeclaration(parent)) && parent.name) return nameText(parent.name);
    if (ts.isConstructorDeclaration(parent)) return 'constructor';
    if (ts.isArrowFunction(parent)) return '<arrow-function>';
  }
  return '<module>';
}
function topLevelVariable(node) { return ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) && ts.isSourceFile(node.parent.parent.parent); }
function parse(name, bytes) {
  const source = ts.createSourceFile(name, bytes.toString('utf8'), ts.ScriptTarget.Latest, true), declarations = [], exportReferences = [];
  const record = (node, identifier, kind, topLevel = false, isExported = false) => { const position = source.getLineAndCharacterOfPosition(identifier.getStart(source)); declarations.push({ name: nameText(identifier), kind, line: position.line + 1, character: position.character + 1, scope: scopeName(node), topLevel, exported: isExported }); };
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return;
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const item of node.exportClause.elements) exportReferences.push({ name: item.name.text, sourceName: item.propertyName?.text ?? item.name.text, typeOnly: node.isTypeOnly || item.isTypeOnly, module: node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null });
      return;
    }
    if (ts.isVariableDeclaration(node)) for (const identifier of boundNames(node.name)) record(node, identifier, 'VariableBinding', topLevelVariable(node), topLevelVariable(node) && exported(node.parent.parent));
    else if (ts.isParameter(node)) for (const identifier of boundNames(node.name)) record(node, identifier, 'ParameterBinding');
    else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) { if (node.name) record(node, node.name, ts.SyntaxKind[node.kind], ts.isSourceFile(node.parent), exported(node)); }
    else if (ts.isFunctionExpression(node) && node.name) record(node, node.name, 'FunctionExpressionBinding');
    else if (ts.isTypeParameterDeclaration(node)) record(node, node.name, 'TypeParameterBinding');
    else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isEnumMember(node)) record(node, node.name, ts.SyntaxKind[node.kind]);
    else if (ts.isConstructorDeclaration(node)) { const position = source.getLineAndCharacterOfPosition(node.getStart(source)); declarations.push({ name: 'constructor', kind: 'Constructor', line: position.line + 1, character: position.character + 1, scope: scopeName(node), topLevel: false, exported: false }); }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { path: name, bytes: bytes.length, sha256: sha(bytes), declarationCount: declarations.length, declarations, topLevelDeclarations: declarations.filter(item => item.topLevel), publicExports: declarations.filter(item => item.topLevel && item.exported).map(item => ({ name: item.name, kind: item.kind, line: item.line })), exportReferences, parseDiagnostics: source.parseDiagnostics.map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') })) };
}
const sources = sourceNames.map(name => parse(name, fs.readFileSync(path.join(root, name))));
const sessionPath = 'src/presentation/RealSharedServiceSessionAdapter.ts', sessionBefore = parse(sessionPath, fs.readFileSync(path.join(__dirname, 'session-before-p10.ts'))), sessionAfter = parse(sessionPath, fs.readFileSync(path.join(root, sessionPath)));
const declarationKey = item => JSON.stringify({ name: item.name, kind: item.kind, scope: item.scope, topLevel: item.topLevel, exported: item.exported });
const remaining = new Map(); for (const item of sessionBefore.declarations) remaining.set(declarationKey(item), (remaining.get(declarationKey(item)) || 0) + 1);
const addedSessionDeclarations = sessionAfter.declarations.filter(item => { const key = declarationKey(item), count = remaining.get(key) || 0; if (count) { remaining.set(key, count - 1); return false; } return true; });
const removedSessionDeclarations = [...remaining.entries()].filter(([, count]) => count > 0).map(([key, count]) => ({ ...JSON.parse(key), count }));
const publicExports = sources.flatMap(source => source.publicExports.map(item => ({ path: source.path, ...item })));
const priorPath = 'quality-review/b2-5c-2b/evidence/new-names.json', priorBytes = fs.readFileSync(path.join(root, priorPath)), prior = JSON.parse(priorBytes.toString('utf8'));
if (prior.publicExportCount !== 64 || prior.sourceFileCount !== 17 || prior.sources.find(source => source.path === 'src/director/SharedServiceProtocolContracts.ts').publicExports.length !== 37) throw new Error('Accepted c-2b count scope changed.');
const intentCurrent = fs.readFileSync(path.join(root, 'src/director/IntentPort.ts')), intentBefore = fs.readFileSync(path.join(__dirname, 'intent-before-c2c.ts'));
const intentSuffix = parse('IntentPort.c2c.suffix.ts', intentCurrent.subarray(intentBefore.length));
const report = { phase: mode === 'paused' ? 'B2.5c-2c paused P11 WIP mechanical declaration names; not frozen' : 'B2.5c-2c mechanical declaration names with unified public-count scope', status: mode === 'paused' ? 'PausedP11' : 'FinalInventory', stageComplete: false, generatedUtc: new Date().toISOString(), typescriptVersion: ts.version, sourceFileCount: sources.length, declarationCount: sources.reduce((sum, source) => sum + source.declarationCount, 0), uniqueDeclarationNameCount: new Set(sources.flatMap(source => source.declarations.map(item => item.name))).size, topLevelDeclarationCount: sources.reduce((sum, source) => sum + source.topLevelDeclarations.length, 0), publicExportCount: publicExports.length, publicExports, sources,
  approvedP10LocalDeclarationDelta: { path: sessionPath, added: addedSessionDeclarations, removed: removedSessionDeclarations, beforeSha256: sessionBefore.sha256, currentSha256: sessionAfter.sha256 }, intentTypeOnlyReferences: intentSuffix.exportReferences,
  acceptedC2bCounts: { reference: priorPath, referenceSha256: sha(priorBytes), newImplementationTsFiles: 17, publicTopLevelDeclarations: 64, sharedProtocolPublicTypes: 37 }, cumulativeAdditiveCounts: { newImplementationTsFiles: 17 + sources.length, publicTopLevelDeclarations: 64 + publicExports.length, sharedProtocolPublicTypes: 37 },
  excluded: ['Imports', 'Pre-existing source declarations except explicit P10 local delta', 'Generated copies', 'Test/harness declarations', 'IntentPort type-only re-export references'],
  policy: 'Public export count means top-level exported declaration occurrences in new implementation TS files only: class/interface/type/function/enum/variable declarations. It excludes methods, fields, parameters, locals, imports, re-exports, tests and generated copies. The accepted c-2b 64 count and 37 protocol types are distinct subscopes; c-2c uses the same top-level-declaration counting rule and reports incremental and cumulative values. Mechanical declaration inventory is not independent namebook approval.',
  pass: sources.every(source => source.parseDiagnostics.length === 0) && sessionAfter.parseDiagnostics.length === 0 && intentSuffix.parseDiagnostics.length === 0 && removedSessionDeclarations.length === 0 };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, sourceFileCount: report.sourceFileCount, declarationCount: report.declarationCount, uniqueDeclarationNameCount: report.uniqueDeclarationNameCount, publicExportCount: report.publicExportCount, cumulativeAdditiveCounts: report.cumulativeAdditiveCounts, approvedP10LocalDeclarationDelta: report.approvedP10LocalDeclarationDelta.added }, null, 2));
