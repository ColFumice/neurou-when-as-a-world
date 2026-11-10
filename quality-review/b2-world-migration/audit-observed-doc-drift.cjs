'use strict';
// Read-only workspace observations. No baseline mutation, allowlist relaxation, or attribution inference.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-before.json'), 'utf8'));
const finalAudit = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-final-audit.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-after.json'), 'utf8'));
const finalFiles = new Map(after.files.map(file => [file.path, file]));
const paths = ['docs/NAMEBOOK.md', 'docs/spec/stage-1.md'];
const observations = paths.map(relative => {
  const absolute = path.join(root, relative), bytes = fs.readFileSync(absolute), stat = fs.statSync(absolute);
  const baseline = before.files.find(file => file.path === relative), final = finalFiles.get(relative);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex'), lines = bytes.toString('utf8').split(/\r?\n/);
  const matches = lines.map((text, index) => ({ line: index + 1, text })).filter(value =>
    /v3\.13|VERDICT-311\s*[~～]\s*325|最近更新：B2\.4c|B2\.4c-\d+/.test(value.text));
  const restrictions = lines.map((text, index) => ({ line: index + 1, text })).filter(value =>
    /d（WorldMigration \+ RealityPause）|d 数据结构|B2\.4d：SafePoint/.test(value.text));
  return { path: relative, observedAtUtc: new Date().toISOString(), baselineCapturedAtUtc: before.capturedAt,
    baselineBytes: baseline.bytes, baselineSha256: baseline.sha256,
    currentBytes: bytes.length, currentSha256: hash, finalManifestSha256: final?.sha256 ?? null,
    matchesFinalManifest: final?.sha256 === hash, differsFromBaseline: baseline.sha256 !== hash,
    lastWriteTimeUtc: stat.mtime.toISOString(), creationTimeUtc: stat.birthtime.toISOString(),
    versionAndStageEvidence: matches, restrictedScopeEvidence: restrictions,
    originalTextSnapshotAvailable: fs.existsSync(path.join(__dirname, 'original-source', relative)),
  };
});
const unexpectedNonDocumentChanges = finalAudit.unexpectedChanged.filter(file => !paths.includes(file));
const authoredSourceScopePass = unexpectedNonDocumentChanges.length === 0 && finalAudit.unexpectedAdded.length === 0 &&
  finalAudit.missingNewFiles.length === 0 && finalAudit.removed.length === 0 && finalAudit.oldIntentLogicPrefixUnchanged &&
  finalAudit.onlyExpectedTypeExports && finalAudit.linksUnchanged && finalAudit.originalCopyFailures.length === 0 &&
  finalAudit.protectedGroups.frozenCore.pass && finalAudit.protectedGroups.legacyCrossDeviceCore.pass && finalAudit.protectedGroups.settingsScenes.pass;
const report = { schemaVersion: 1, phase: 'B2.4d observed documentation drift', generatedAt: new Date().toISOString(),
  fullProtectedAuditPass: finalAudit.pass, fullProtectedAudit: 'protected-final-audit.json',
  authoredSourceScopePass, authoredSourceScopeMeaning: 'The fixed authorized source/composition changes and new-module allowlist pass, and all other code/settings/scenes retain baseline bytes. This scope result does not attribute any documentation change or turn the full audit into PASS.',
  unexpectedNonDocumentChanges, observations,
  verified: ['Both document hashes differ from the immutable baseline.',
    'Filesystem timestamps place their current writes after the baseline capture; timestamps do not identify the writer.',
    'The current NAMEBOOK has a v3.13 / VERDICT-311~325 B2.4c appendix, and stage-1 lists restricted c acceptance.',
    'The current documents describe d as excluded or awaiting its own freezing; the observed content is consistent with c synchronization.'],
  unverified: ['Writer/process identity and whether Trae performed these writes.', 'Whether every textual change was only the c landing, because .md original bytes were not captured.',
    'Filesystem timestamps as tamper-resistant provenance.'],
  disposition: 'Retain full protected FAIL and fixed allowlist. Preserve current documentation; do not revert third-party edits. Treat source scope PASS separately, with provenance unresolved.' };
fs.writeFileSync(path.join(__dirname, 'observed-doc-drift.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ fullProtectedAuditPass: report.fullProtectedAuditPass, authoredSourceScopePass,
  files: observations.map(value => ({ path: value.path, baselineSha256: value.baselineSha256,
    currentSha256: value.currentSha256, lastWriteTimeUtc: value.lastWriteTimeUtc, matchesFinalManifest: value.matchesFinalManifest })) }));
