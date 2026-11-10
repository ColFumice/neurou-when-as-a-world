'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phase = process.argv[2] || 'compare';
const outputName = process.argv[3] || 'protected-final-audit.json';
if (!['baseline', 'compare'].includes(phase)) throw new Error('Use baseline or compare.');
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use a JSON evidence basename.');
const baselinePath = path.join(__dirname, 'protected-baseline.json');
const excludedDirectoryNames = ['node_modules', 'library', 'temp', 'tmp', 'dist', '.git', '.local', '.secret', 'secrets'];
const excludedPrefixes = ['quality-review/b2-5c-2b', 'quality-review/b2-real-auth/evidence/runtime/pgsql'];
const excludedFilePatterns = ['.env', '.env.*', '*.(pem|key|p12|pfx)', '*.(zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)'];
const intentPortPath = 'src/director/IntentPort.ts';
const allowedNewPaths = [
  'src/director/SharedServiceProtocolContracts.ts',
  'src/director/SharedServiceProtocolCodec.ts',
  'src/presentation/RealSharedServiceSessionAdapter.ts',
  'src/presentation/RealWorldAuthorityAdapter.ts',
  'assets/scripts/SharedRelayPrototypeBuilder.ts',
  'server/src/SharedSessionVerifier.ts',
  'server/src/RealAuthorityClock.ts',
  'server/src/SharedMigrationRunner.ts',
  'server/src/WorldAuthorityService.ts',
  'server/src/WorldAuthorityStorage.ts',
  'server/src/AuthorityRoute.ts',
  'server/src/SharedServerConfig.ts',
  'server/src/buildSharedServer.ts',
  'server/src/shared-main.ts'
];
const allowedNewPatterns = ['^server/sql/002_[A-Za-z0-9_-]+\\.sql$'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function walk(directory, rel = '') {
  const records = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = rel ? rel + '/' + item.name : item.name;
    if (excludedPrefixes.some(prefix => name === prefix || name.startsWith(prefix + '/'))) continue;
    if (item.isDirectory() && excludedDirectoryNames.includes(item.name)) continue;
    const absolute = path.join(directory, item.name);
    if (item.isSymbolicLink()) {
      const target = fs.readlinkSync(absolute);
      const bytes = Buffer.from(target, 'utf8');
      records.push({ path: name, kind: 'symbolic-link-or-junction', target, bytes: bytes.length, sha256: hash(bytes) });
    } else if (item.isDirectory()) records.push(...walk(absolute, name));
    else if (item.isFile()) {
      if (item.name === '.env' || item.name.startsWith('.env.') || /\.(?:pem|key|p12|pfx|zip|exe|dll|pdb|lib|o|obj|tar|gz|bz2|7z)$/i.test(item.name)) continue;
      const bytes = fs.readFileSync(absolute);
      records.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
function checkIntentSuffix(original, current) {
  const prefixPreserved = current.length >= original.length && current.subarray(0, original.length).equals(original);
  const suffix = current.subarray(original.length).toString('utf8');
  let suffixTypeOnly = false;
  let exportCount = 0;
  try {
    const ts = require(path.join(root, 'node_modules/typescript'));
    const ast = ts.createSourceFile('IntentPort.suffix.ts', suffix, ts.ScriptTarget.Latest, true);
    suffixTypeOnly = ast.parseDiagnostics.length === 0 && ast.statements.every(statement => {
      const valid = ts.isExportDeclaration(statement) && statement.isTypeOnly === true && statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === './SharedServiceProtocolContracts';
      if (valid) exportCount++;
      return valid;
    });
  } catch (error) {
    return { prefixPreserved, suffixTypeOnly: false, error: String(error.message), suffixBytes: Buffer.byteLength(suffix) };
  }
  return { prefixPreserved, suffixTypeOnly, exportCount, suffixBytes: Buffer.byteLength(suffix) };
}
const policy = { excludedDirectoryNames, excludedPrefixes, excludedFilePatterns, allowedNewPaths, allowedNewPatterns, intentPortPath };
const files = walk(root);
if (phase === 'baseline') {
  if (fs.existsSync(baselinePath)) throw new Error('Baseline is immutable once captured.');
  const originalIntentPort = fs.readFileSync(path.join(root, intentPortPath));
  const result = { phase: 'B2.5c-2b implementation baseline', capturedUtc: new Date().toISOString(), root, algorithm: 'SHA-256', policy, fileCount: files.length, files, originalIntentPortBase64: originalIntentPort.toString('base64'),
    limits: 'All existing non-excluded files are protected. IntentPort alone permits an identical original byte prefix and an AST-verified type-only export suffix from SharedServiceProtocolContracts. Approved production additions are enumerated exact paths and the authorized 002 SQL filename pattern; no whole source/test/config directory is allowlisted. New c-2b evidence is excluded. Private files, dependency/cache directories, runtime binary distributions and junction targets are not traversed.' };
  fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ capturedUtc: result.capturedUtc, fileCount: files.length, baselineSha256: hash(fs.readFileSync(baselinePath)) }, null, 2));
} else {
  const outputPath = path.join(__dirname, outputName);
  if (fs.existsSync(outputPath)) throw new Error('Audit records are immutable; choose a separately named recheck.');
  const baselineBytes = fs.readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  if (JSON.stringify(policy) !== JSON.stringify(baseline.policy)) throw new Error('Protection policy changed after baseline.');
  const before = new Map(baseline.files.map(file => [file.path, file]));
  const after = new Map(files.map(file => [file.path, file]));
  const changed = baseline.files.filter(file => after.has(file.path) && (after.get(file.path).sha256 !== file.sha256 || after.get(file.path).kind !== file.kind)).map(file => file.path);
  const removed = baseline.files.filter(file => !after.has(file.path)).map(file => file.path);
  const added = files.filter(file => !before.has(file.path)).map(file => file.path);
  const intentPort = checkIntentSuffix(Buffer.from(baseline.originalIntentPortBase64, 'base64'), fs.readFileSync(path.join(root, intentPortPath)));
  const unauthorizedChanged = changed.filter(name => name !== intentPortPath || !intentPort.prefixPreserved || !intentPort.suffixTypeOnly);
  const plannedAdditionsPath = path.join(__dirname, 'planned-additions.json');
  const plannedAdditionsBytes = fs.readFileSync(plannedAdditionsPath);
  const plannedAdditions = JSON.parse(plannedAdditionsBytes.toString('utf8'));
  if (!Array.isArray(plannedAdditions.paths) || plannedAdditions.paths.some(name => typeof name !== 'string' || name.includes('*') || name.includes('..') || path.isAbsolute(name))) throw new Error('Supplemental additions must be exact relative paths.');
  const supplementalNewPaths = plannedAdditions.paths;
  const buildAdditionsBytes = fs.readFileSync(path.join(__dirname, 'planned-build-additions.json'));
  const buildAdditions = JSON.parse(buildAdditionsBytes.toString('utf8'));
  if (JSON.stringify(buildAdditions.paths) !== JSON.stringify(['server/SharedBuild.mjs']) || JSON.stringify(buildAdditions.newBuildPrefixes) !== JSON.stringify(['server/.shared-kernel', 'server/shared-dist'])) throw new Error('Unexpected build allowance.');
  const approvedNewBuildPrefixes = buildAdditions.newBuildPrefixes;
  if (baseline.files.some(file => approvedNewBuildPrefixes.some(prefix => file.path === prefix || file.path.startsWith(prefix + '/')))) throw new Error('A new-build allowance would hide pre-existing baseline files.');
  const isNewBuildArtifact = name => approvedNewBuildPrefixes.some(prefix => name === prefix || name.startsWith(prefix + '/'));
  const unauthorizedAdded = added.filter(name => !allowedNewPaths.includes(name) && !supplementalNewPaths.includes(name) && !buildAdditions.paths.includes(name) && !isNewBuildArtifact(name) && !allowedNewPatterns.some(pattern => new RegExp(pattern).test(name)));
  const result = { phase: 'B2.5c-2b protection audit', comparedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc, baselineSha256: hash(baselineBytes), beforeCount: baseline.fileCount, afterCount: files.length, changed, removed, added, intentPort, unauthorizedChanged, unauthorizedAdded,
    pass: unauthorizedChanged.length === 0 && removed.length === 0 && unauthorizedAdded.length === 0 && intentPort.prefixPreserved && intentPort.suffixTypeOnly, policy, supplementalNewPaths, plannedAdditionsSha256: hash(plannedAdditionsBytes), supplementalAuthorization: plannedAdditions.authorization,
    buildAdditionsSha256: hash(buildAdditionsBytes), buildAuthorization: buildAdditions.authorization, approvedNewBuildPrefixes, addedBuildArtifacts: added.filter(isNewBuildArtifact), addedProductionFiles: added.filter(name => !isNewBuildArtifact(name)), limits: baseline.limits };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}
