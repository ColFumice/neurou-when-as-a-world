'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePath = path.join(__dirname, 'protected-retention-final-audit.json');
const sourceBytes = fs.readFileSync(sourcePath), source = JSON.parse(sourceBytes.toString('utf8'));
if (!source.pass) throw new Error('Passing retention-final scoped protection audit required.');
const canonicalPath = path.resolve(__dirname, '../protected-final-audit.json');
const backupPath = path.join(__dirname, 'canonical-audit-before-retention-fix.json');
if (fs.existsSync(backupPath)) throw new Error('Pre-retention canonical snapshot already exists; preserve it.');
const previousBytes = fs.readFileSync(canonicalPath), previous = JSON.parse(previousBytes.toString('utf8'));
if (!previous.pass || previous.baselineSha256 !== source.baselineSha256) throw new Error('Canonical and retention audit baseline mismatch.');
const { limits: inheritedLimitsRaw, stageComplete: sourceStageClaim, ...auditFacts } = source;
const report = {
  ...auditFacts,
  auditChecksOnly: true,
  stageAcceptance: 'See delivery-report.md; stage completion is not asserted by this mechanical audit.',
  inheritedLimitsRaw,
  limits: previous.limits,
  canonicalArtifact: 'B2.5c-2c protected-final-audit.json',
  lineage: {
    ...previous.lineage,
    previousCanonicalBeforeRetentionFix: { path: 'evidence/canonical-audit-before-retention-fix.json', sha256: sha(previousBytes), retainedExactBytes: true },
    retentionFinal: { path: 'evidence/protected-retention-final-audit.json', sha256: sha(sourceBytes), cloneOfScopedAuditFields: true, originalStageCompleteFieldRetainedInRaw: sourceStageClaim },
    immutableOriginalsPreserved: true
  },
  interpretation: 'This canonical artifact now clones the passing retention-final scoped audit. The prior canonical, raw implementation audits, source inventories, baselines and validation runs remain preserved. The Relay retention fix modifies only the new RelayStorage implementation and its new generated JS copy; exact c-2b P10 and IntentPort exceptions are checked independently. This audit proves protected byte scope, not runtime behavior or acceptance of excluded future phases.'
};
fs.writeFileSync(backupPath, previousBytes, { flag: 'wx' });
fs.writeFileSync(canonicalPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, output: 'quality-review/b2-5c-2c/protected-final-audit.json', sha256: sha(fs.readFileSync(canonicalPath)), previousCanonicalSnapshot: 'evidence/canonical-audit-before-retention-fix.json', previousCanonicalSha256: sha(previousBytes), retentionAuditSha256: sha(sourceBytes) }, null, 2));
