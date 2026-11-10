'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePath = path.join(__dirname, 'protected-implementation-final-audit.json');
const sourceBytes = fs.readFileSync(sourcePath), source = JSON.parse(sourceBytes.toString('utf8'));
if (!source.pass) throw new Error('Passing implementation audit is required.');
const output = path.resolve(__dirname, '../protected-final-audit.json');
if (fs.existsSync(output)) throw new Error('Canonical final audit is immutable.');
const record = name => ({ path: 'evidence/' + name, sha256: sha(fs.readFileSync(path.join(__dirname, name))) });
const { limits: inheritedLimitsRaw, stageComplete: sourceStageClaim, ...auditFacts } = source;
const report = { ...auditFacts, auditChecksOnly: true, stageAcceptance: 'See delivery-report.md; stage completion is not asserted by this mechanical audit.', inheritedLimitsRaw, limits: 'Every existing non-excluded baseline file is compared by SHA-256. The only authorized existing-source changes are exact P10 request-local deadline bytes and one original-prefix-preserving IntentPort type-only suffix. Exactly five new implementation TS paths and four new generated JS paths are allowed; no directory-wide allowance exists. Both prior kernel trees and other prior generated outputs are protected. New c-2c reports/evidence, dependency/editor/runtime caches, private files and binary distributions have explicit exclusions. Symlink targets, secrets, databases and machine state are outside this byte audit. The parent started a new PostgreSQL17 cluster and ran categorized real HTTP/PG tests after baseline capture; those facts and acceptance limits are established separately by validation evidence, not by the inherited read-only prerequisite wording.', canonicalArtifact: 'B2.5c-2c protected-final-audit.json', lineage: { implementationFinal: { path: 'evidence/protected-implementation-final-audit.json', sha256: sha(sourceBytes), cloneOfScopedAuditFields: true, originalStageCompleteFieldRetainedInRaw: sourceStageClaim }, originalBaseline: record('protected-baseline.json'), originalReadOnlyPrerequisiteFinal: record('protected-final-audit.json'), pausedImplementationSnapshot: record('protected-implementation-paused-audit.json'), intentRuntimeProof: record('intent-type-erasure-final.json'), immutableOriginalsPreserved: true },
  interpretation: 'This canonical root artifact clones the passing implementation-final scoped audit and adds explicit lineage. The earlier evidence/protected-final-audit.json remains the original read-only prerequisite snapshot, never overwritten. An audit pass establishes authorized byte scope; acceptance of HTTP/PG behavior is established by separate test evidence and the delivery report.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, output: 'quality-review/b2-5c-2c/protected-final-audit.json', sha256: sha(fs.readFileSync(output)), sourceAuditSha256: sha(sourceBytes) }, null, 2));
