'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const outputName = process.argv[2] || 'protected-implementation-final-audit.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use JSON evidence basename.');
const output = path.join(__dirname, outputName);
if (fs.existsSync(output)) throw new Error('Audit records are immutable; choose a new filename.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baselineBytes = fs.readFileSync(path.join(__dirname, 'protected-baseline.json'));
const baseline = JSON.parse(baselineBytes.toString('utf8'));
const authorizationBytes = fs.readFileSync(path.join(__dirname, 'p10-authorization.json'));
const authorization = JSON.parse(authorizationBytes.toString('utf8'));
const newSourcePaths = ['server/src/RelayStorage.ts', 'server/src/RelayService.ts', 'server/src/RelayRoute.ts', 'server/src/buildRelayServer.ts', 'src/presentation/RealCommitRelayAdapter.ts'];
const generatedNewPaths = ['server/shared-dist/src/RelayStorage.js', 'server/shared-dist/src/RelayService.js', 'server/shared-dist/src/RelayRoute.js', 'server/shared-dist/src/buildRelayServer.js'];
const intentPath = 'src/director/IntentPort.ts';
const sessionPath = 'src/presentation/RealSharedServiceSessionAdapter.ts';
const policy = { baselinePolicy: baseline.policy, newSourcePaths, generatedNewPaths, localSessionException: { path: sessionPath, authorizationSha256: sha(authorizationBytes), expectedP10Change: 'Exact approved request-local deadline insertion and three replacements; all remaining bytes identical.' }, intentException: { path: intentPath, originalBytePrefixPreserved: true, suffix: "export type { SharedCommitValidator, ValidatedSharedCommit, SharedValidationResult } from './SharedCommitValidator';", declarationNames: ['SharedCommitValidator', 'ValidatedSharedCommit', 'SharedValidationResult'] } };
function walk(directory, rel = '') {
  const records = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = rel ? rel + '/' + item.name : item.name;
    if (baseline.policy.excludedPrefixes.some(prefix => name === prefix || name.startsWith(prefix + '/'))) continue;
    if (item.isDirectory() && baseline.policy.excludedDirectoryNames.includes(item.name)) continue;
    const absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) {
      const target = fs.readlinkSync(absolute), bytes = Buffer.from(target, 'utf8');
      records.push({ path: name, kind: 'symbolic-link-or-junction', target, bytes: bytes.length, sha256: sha(bytes) });
    } else if (item.isDirectory()) records.push(...walk(absolute, name));
    else if (item.isFile()) {
      if (item.name === '.env' || item.name.startsWith('.env.') || /\.(?:pem|key|p12|pfx|zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)$/i.test(item.name)) continue;
      const bytes = fs.readFileSync(absolute); records.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
const files = walk(root), before = new Map(baseline.files.map(file => [file.path, file])), after = new Map(files.map(file => [file.path, file]));
if ([...newSourcePaths, ...generatedNewPaths].some(name => before.has(name))) throw new Error('New-path allowance would hide an existing baseline file.');
const changed = baseline.files.filter(file => after.has(file.path) && (after.get(file.path).sha256 !== file.sha256 || after.get(file.path).kind !== file.kind)).map(file => file.path);
const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path);
const added = files.filter(file => !before.has(file.path)).map(file => file.path);
function checkIntent() {
  const original = fs.readFileSync(path.join(__dirname, 'intent-before-c2c.ts')), current = fs.readFileSync(path.join(root, intentPath));
  if (sha(original) !== before.get(intentPath).sha256) throw new Error('Intent snapshot does not match immutable baseline.');
  const prefixPreserved = current.length >= original.length && current.subarray(0, original.length).equals(original);
  const suffix = current.subarray(original.length).toString('utf8');
  const ts = require(path.join(root, 'node_modules/typescript'));
  const ast = ts.createSourceFile('IntentPort.c2c.suffix.ts', suffix, ts.ScriptTarget.Latest, true);
  const exports = ast.statements.filter(node => ts.isExportDeclaration(node));
  const typeOnly = ast.parseDiagnostics.length === 0 && ast.statements.length === 1 && exports.every(node => node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === './SharedCommitValidator');
  const names = exports.flatMap(node => node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements.map(item => ({ name: item.name.text, original: item.propertyName?.text ?? item.name.text })) : []);
  const exactNames = names.length === 3 && names.every((item, index) => item.name === policy.intentException.declarationNames[index] && item.original === item.name);
  return { prefixPreserved, typeOnly, exportStatementCount: exports.length, exportedTypeReferenceCount: names.length, exportedTypeReferences: names, exactNames, suffixBytes: current.length - original.length, pass: prefixPreserved && typeOnly && exactNames };
}
function replaceOne(source, oldText, newText) {
  if (source.split(oldText).length !== 2) throw new Error('P10 original approved anchor is not unique.');
  return source.replace(oldText, newText);
}
function checkSession() {
  const original = fs.readFileSync(path.join(__dirname, 'session-before-p10.ts')), current = fs.readFileSync(path.join(root, sessionPath));
  if (sha(original) !== before.get(sessionPath).sha256 || sha(original) !== authorization.beforeSha256 || original.length !== authorization.beforeBytes) throw new Error('P10 before snapshot does not match baseline or user-approved record.');
  const originalText = original.toString('utf8');
  const requestStart = originalText.indexOf('  async request(operation: SharedProtocolOperation,');
  const requestEnd = originalText.indexOf('  private async prepareRequest(operation: SharedProtocolOperation,');
  if (requestStart < 0 || requestEnd <= requestStart) throw new Error('P10 original request method boundary changed.');
  let expected = originalText.slice(requestStart, requestEnd);
  expected = replaceOne(expected, '      this.codec.validatePayload(operation, payload);\n', "      this.codec.validatePayload(operation, payload);\n      const requestLimitMs = operation === '/relay/pull'\n        ? (payload as { readonly maximumWaitMs: number }).maximumWaitMs + 7000\n        : REQUEST_LIMIT_MS;\n");
  expected = replaceOne(expected, '      timer = setTimeout(() => { if (controller) { controller.abort(); } }, REQUEST_LIMIT_MS);', '      timer = setTimeout(() => { if (controller) { controller.abort(); } }, requestLimitMs);');
  expected = replaceOne(expected, '      if (!response || performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {', '      if (!response || performance.now() - started > requestLimitMs || controller.signal.aborted) {');
  expected = replaceOne(expected, '      if (performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {', '      if (performance.now() - started > requestLimitMs || controller.signal.aborted) {');
  const bytes = Buffer.from(originalText.slice(0, requestStart) + expected + originalText.slice(requestEnd), 'utf8');
  return { beforeBytes: original.length, beforeSha256: sha(original), expectedBytes: bytes.length, expectedSha256: sha(bytes), actualBytes: current.length, actualSha256: sha(current), exactApprovedP10Bytes: current.equals(bytes), pass: current.equals(bytes) };
}
const intent = checkIntent(), session = checkSession();
const unauthorizedChanged = changed.filter(name => name !== intentPath && name !== sessionPath || name === intentPath && !intent.pass || name === sessionPath && !session.pass);
const unauthorizedAdded = added.filter(name => !newSourcePaths.includes(name) && !generatedNewPaths.includes(name));
const protectedKernelTrees = ['server/.shared-kernel', 'server/shared-dist/.shared-kernel'].map(prefix => ({ prefix, beforeCount: baseline.files.filter(file => file.path.startsWith(prefix + '/')).length, afterCount: files.filter(file => file.path.startsWith(prefix + '/')).length, changed: changed.filter(name => name.startsWith(prefix + '/')), removed: removed.filter(name => name.startsWith(prefix + '/')), added: added.filter(name => name.startsWith(prefix + '/')) }));
const report = { phase: outputName.includes('paused') ? 'B2.5c-2c paused P11 WIP implementation protection audit; not completion' : 'B2.5c-2c implementation protection audit', status: outputName.includes('paused') ? 'PausedP11' : 'ScopedAudit', stageComplete: false, comparedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc, baselineSha256: sha(baselineBytes), prerequisiteRawAudit: { path: 'evidence/protected-final-audit.json', sha256: sha(fs.readFileSync(path.join(__dirname, 'protected-final-audit.json'))), retainedUnchanged: true }, beforeCount: baseline.fileCount, afterCount: files.length, changed, removed, added, unauthorizedChanged, unauthorizedAdded, unauthorizedRemoved: removed, intent, session, protectedKernelTrees, policy, addedProductionFiles: added.filter(name => newSourcePaths.includes(name)), addedBuildArtifacts: added.filter(name => generatedNewPaths.includes(name)), allCurrentFiles: files,
  pass: unauthorizedChanged.length === 0 && unauthorizedAdded.length === 0 && removed.length === 0 && intent.pass && session.pass && newSourcePaths.every(name => after.has(name)), limits: baseline.limits + ' Implementation comparison adds only five exact new source paths, four exact new generated JS copies, the exact approved P10 local byte rewrite, and one IntentPort type-only suffix of three approved historical validator type references. No directory-wide build or source exception exists.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, beforeCount: report.beforeCount, afterCount: report.afterCount, changed, added, removed, unauthorizedChanged, unauthorizedAdded, intent, session, protectedKernelTrees }, null, 2));
process.exitCode = report.pass ? 0 : 1;
