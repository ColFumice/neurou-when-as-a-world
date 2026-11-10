'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phase = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'independent-delivery-document-review.json');
if (fs.existsSync(output)) throw new Error('Delivery review records are immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const documents = ['delivery-report.md', 'implementation-plan.md', 'namebook-v3.21-appendix-proposal.md', 'verdicts-448-451.md', 'independent-final-review.md'];
const report = {
  phase: 'B2.5c-2c delivered document cross-review after final prose corrections',
  recordedUtc: new Date().toISOString(),
  reviewer: '/root/c2c_client',
  resultSource: 'Completed collaboration document cross-review reported to the root agent; correction completion reported by the root agent.',
  documentSnapshot: documents.map(name => { const bytes = fs.readFileSync(path.join(phase, name)); return { path: name, bytes: bytes.length, sha256: sha(bytes) }; }),
  reviewedCounts: { clientContract: 32, requestDeadlineOracle: 13, serverRealHttpPg: 20, serverFirstEnqueueConcurrency: 2, productionClientRealHttpPg: 22, historicalRegression: 508, addedImplementationTypescript: 5, modifiedImplementationTypescript: 2, addedGeneratedJavascript: 4, incrementalPublicTopLevelDeclarations: 8, cumulativePublicTopLevelDeclarations: 72, unchangedC2bProtocolTypes: 37 },
  corrections: [
    { item: 'Submit retry wording', applied: true, finalMeaning: 'Same nonce returns the original wire; a fresh nonce with the same digest keeps the original queue position and facts and receives a newly signed wrapper for the current nonce.' },
    { item: 'Storage loss wording', applied: true, before: '认证丢段', after: '确证丢段' }
  ],
  scopeAssessment: 'P10/P11 boundaries, type-only exports, lazy retention enforcement, injected crypto/WAL-cache limits, and c-2d/c-2e/c-2f deferrals are accurately distinguished from production acceptance.',
  blockingFindings: [],
  pass: true,
  limits: 'This is a record of completed read-only document review and applied prose corrections. No implementation source changed, no runtime tests or gates were rerun, and no stage acceptance is asserted by this document review.'
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, documents: report.documentSnapshot.length, corrections: report.corrections.length, implementationSourceChanged: false, runtimeRerun: false }, null, 2));
