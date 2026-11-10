'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const before = new Set(baseline.files.map(file => file.path));
const supplemental = JSON.parse(fs.readFileSync(path.join(__dirname, 'planned-additions.json'), 'utf8'));
const buildPlan = JSON.parse(fs.readFileSync(path.join(__dirname, 'planned-build-additions.json'), 'utf8'));
const sourceNames = [...new Set([...baseline.policy.allowedNewPaths, ...supplemental.paths, ...buildPlan.paths])].filter(name => fs.existsSync(path.join(root, name)) && !before.has(name)).sort();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const exported = node => !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
function nameText(node) { if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text; if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text; return node.getText(); }
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
function parseTs(name, bytes) {
  const source = ts.createSourceFile(name, bytes.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), declarations = [], exportReferences = [];
  const record = (node, identifier, kind, topLevel = false, isExported = false) => { const position = source.getLineAndCharacterOfPosition(identifier.getStart(source)); declarations.push({ name: nameText(identifier), kind, line: position.line + 1, character: position.character + 1, scope: scopeName(node), topLevel, exported: isExported }); };
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return;
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const entry of node.exportClause.elements) exportReferences.push({ name: entry.name.text, sourceName: entry.propertyName?.text ?? entry.name.text, typeOnly: node.isTypeOnly || entry.isTypeOnly, module: node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null });
      return;
    }
    if (ts.isVariableDeclaration(node)) for (const identifier of boundNames(node.name)) record(node, identifier, 'VariableBinding', topLevelVariable(node), topLevelVariable(node) && exported(node.parent.parent));
    else if (ts.isParameter(node)) for (const identifier of boundNames(node.name)) record(node, identifier, 'ParameterBinding');
    else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) {
      if (node.name) record(node, node.name, ts.SyntaxKind[node.kind], ts.isSourceFile(node.parent), exported(node));
    } else if (ts.isFunctionExpression(node) && node.name) record(node, node.name, 'FunctionExpressionBinding');
    else if (ts.isTypeParameterDeclaration(node)) record(node, node.name, 'TypeParameterBinding');
    else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isEnumMember(node)) record(node, node.name, ts.SyntaxKind[node.kind]);
    else if (ts.isConstructorDeclaration(node)) {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source)); declarations.push({ name: 'constructor', kind: 'Constructor', line: position.line + 1, character: position.character + 1, scope: scopeName(node), topLevel: false, exported: false });
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      // VariableDeclaration visit below records the binding exactly once.
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { path: name, bytes: bytes.length, sha256: sha(bytes), language: 'TypeScript', declarationCount: declarations.length, uniqueDeclarationNames: [...new Set(declarations.map(item => item.name))].sort(), topLevelDeclarations: declarations.filter(item => item.topLevel), publicExports: declarations.filter(item => item.topLevel && item.exported).map(item => ({ name: item.name, kind: item.kind, line: item.line })), declarations, exportReferences, parseDiagnostics: source.parseDiagnostics.map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') })) };
}
const sources = sourceNames.filter(name => name.endsWith('.ts') && !name.startsWith('server/test/')).map(name => parseTs(name, fs.readFileSync(path.join(root, name))));
const excludedTestSources = sourceNames.filter(name => name.startsWith('server/test/')).map(name => { const bytes = fs.readFileSync(path.join(root, name)); return { path: name, bytes: bytes.length, sha256: sha(bytes), reason: 'Test declarations are not new implementation vocabulary.' }; });
const helperNames = [...sourceNames.filter(name => !name.endsWith('.ts')), 'server/sql/002_shared_authority.sql'].filter(name => fs.existsSync(path.join(root, name)) && !before.has(name));
const helpers = [...new Set(helperNames)].sort().map(name => {
  const bytes = fs.readFileSync(path.join(root, name));
  const result = { path: name, bytes: bytes.length, sha256: sha(bytes), language: name.endsWith('.mjs') ? 'JavaScript build helper' : name.endsWith('.sql') ? 'SQL migration' : 'Build configuration' };
  if (name.endsWith('.sql')) result.createdTables = [...bytes.toString('utf8').matchAll(/^CREATE TABLE\s+([a-z_][a-z0-9_]*)/gm)].map(value => value[1]);
  if (name.endsWith('.mjs')) { const parsed = parseTs(name, bytes); result.declarations = parsed.declarations; result.topLevelDeclarations = parsed.topLevelDeclarations; result.publicExports = parsed.publicExports; }
  return result;
});
const publicExports = sources.flatMap(source => source.publicExports.map(item => ({ path: source.path, ...item })));
const report = { phase: 'B2.5c-2b mechanical new declaration names', generatedUtc: new Date().toISOString(), typescriptVersion: ts.version,
  sourceFileCount: sources.length, declarationCount: sources.reduce((sum, source) => sum + source.declarationCount, 0), uniqueDeclarationNameCount: new Set(sources.flatMap(source => source.declarations.map(item => item.name))).size, topLevelDeclarationCount: sources.reduce((sum, source) => sum + source.topLevelDeclarations.length, 0), publicExportCount: publicExports.length, publicExports, sources, helpers, excludedTestSources,
  excluded: ['Import references', 'All pre-existing source declarations', 'Approved generated build caches', 'Test declarations including new server/test files and quality-review harnesses', 'IntentPort type-only export references to names declared in the new protocol source'],
  policy: 'Mechanically records declaration occurrences, not semantic uniqueness or namebook approval. Interface properties, class members, function/type parameters and local/destructuring/catch bindings are included. Reused historical vocabulary is present when redeclared locally. Top-level exports constitute the public additive names; v3.19/v3.20 classification remains the reviewed appendix.',
  pass: sources.every(source => source.parseDiagnostics.length === 0) };
const outputName = process.argv[2] || 'new-names.json'; if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use JSON basename.');
fs.writeFileSync(path.join(__dirname, outputName), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ pass: report.pass, sourceFileCount: report.sourceFileCount, declarationCount: report.declarationCount, uniqueDeclarationNameCount: report.uniqueDeclarationNameCount, topLevelDeclarationCount: report.topLevelDeclarationCount, publicExportCount: report.publicExportCount, publicExportList: outputName }, null, 2));
