'use strict';
// B2.4e acceptance expects zero production/source mutations. Only explicit official-document synchronization is authorized.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
cp.execFileSync(process.execPath, [path.join(__dirname, 'capture-baseline.cjs'), 'baseline-after.json'], { windowsHide: true });
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-before.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-after.json'), 'utf8'));
const originalIndex = JSON.parse(fs.readFileSync(path.join(__dirname, 'original-source-index.json'), 'utf8'));
const previous = new Map(before.files.map(file => [file.path, file])), current = new Map(after.files.map(file => [file.path, file]));
const changed = [], added = [], removed = [];
for (const [file, record] of previous) {
  const next = current.get(file);
  if (!next) removed.push(file);
  else if (next.sha256 !== record.sha256 || next.bytes !== record.bytes) changed.push(file);
}
for (const file of current.keys()) if (!previous.has(file)) added.push(file);
// Existing official .md paths are enumerated, never inferred from final changes or applied to references.
const authorizedOfficialDocumentPaths = ['docs/NAMEBOOK.md', 'docs/spec/stage-1.md', 'docs/spec/stage-1-acceptance.md'];
const authorizedDocumentChanges = changed.filter(file => authorizedOfficialDocumentPaths.includes(file)).map(file => {
  const original = previous.get(file), next = current.get(file), stat = fs.statSync(path.join(root, file));
  return { path: file, kind: 'Changed', attribution: 'TraeAuthorized', protocolAttributionAccepted: true,
    baselineSha256: original.sha256, baselineBytes: original.bytes, finalSha256: next.sha256,
    finalBytes: next.bytes, lastWriteTimeUtc: stat.mtime.toISOString(), rawHashEquality: false,
    authorization: 'User explicitly authorized attribution of subsequent concurrent official-documents synchronization to Trae. The implementer did not write these official files.' };
});
const unexpectedChanged = changed.filter(file => !authorizedOfficialDocumentPaths.includes(file));
const unexpectedAdded = [...added], unexpectedRemoved = [...removed];
const productionFiles = [...new Set([...changed, ...added, ...removed].map(file =>
  (current.get(file) ?? previous.get(file)).canonicalPath))].filter(file => !authorizedOfficialDocumentPaths.includes(file));
const originalCopyFailures = originalIndex.files.filter(file => {
  const bytes = fs.readFileSync(path.join(__dirname, file.copy));
  return bytes.length !== file.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256;
}).map(file => file.path);
const linksUnchanged = JSON.stringify(before.symbolicLinks) === JSON.stringify(after.symbolicLinks);
const rawHashEquality = changed.length === 0 && added.length === 0 && removed.length === 0;
const sourceProtectionPass = unexpectedChanged.length === 0 && unexpectedAdded.length === 0 && unexpectedRemoved.length === 0;
const groups = {};
for (const [name, predicate] of [
  ['coreAndComposition', file => /^(src|assets\/scripts|constants)\//.test(file)],
  ['settingsAndScenes', file => /^(settings|profiles|\.creator)\//.test(file) || /\.(scene|prefab)$/.test(file)],
  ['otherReferences', file => !authorizedOfficialDocumentPaths.includes(file) &&
    (/^(docs|archive|\.trae|编辑器)\//.test(file) || /\.docx$/.test(file))],
]) {
  const members = before.files.filter(file => predicate(file.path));
  const failures = members.filter(file => !current.has(file.path) || current.get(file.path).sha256 !== file.sha256).map(file => file.path);
  groups[name] = { pathCount: members.length, failures, pass: failures.length === 0 };
}
const report = { schemaVersion: 1, phase: 'B2.4e', generatedAtUtc: new Date().toISOString(), algorithm: 'sha256',
  pass: sourceProtectionPass && originalCopyFailures.length === 0 && linksUnchanged && before.unreadable.length === 0 && after.unreadable.length === 0,
  rawHashEquality, sourceProtectionPass, productionFileCount: productionFiles.length, productionFiles,
  baselinePathCount: before.fileCount, finalPathCount: after.fileCount, originalSourceCopyCount: originalIndex.fileCount,
  expectedProductionMutationCount: 0, authorizedOfficialDocumentPaths, authorizedDocumentChanges,
  changed, added, removed, unexpectedChanged, unexpectedAdded, unexpectedRemoved,
  linksUnchanged, originalCopyFailures, protectedGroups: groups, unreadableBefore: before.unreadable, unreadableAfter: after.unreadable,
  scope: before.scope,
  policy: 'No production/source/config/reference changes are allowed in this acceptance batch. Explicitly enumerated official .md document synchronization is separately attributed as TraeAuthorized under the latest user PROTOCOL. Byte drift remains visible; other references, removals and additions are never generally exempted.' };
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n');
cp.execFileSync('python', [path.join(__dirname, 'generate-diff.py')], { cwd: root, windowsHide: true });
console.log(JSON.stringify({ pass: report.pass, rawHashEquality, sourceProtectionPass, productionFiles,
  baselinePathCount: report.baselinePathCount, finalPathCount: report.finalPathCount,
  authorizedDocumentChanges, unexpectedChanged, unexpectedAdded, unexpectedRemoved, originalCopyFailures }));
process.exitCode = report.pass ? 0 : 1;
