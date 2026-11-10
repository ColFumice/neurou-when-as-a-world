'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phase = path.resolve(__dirname, '..');
const root = path.resolve(__dirname, '../../..');
const outputName = process.argv[2] || 'document-reference-audit.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use JSON basename.');
const deferredIndex = process.argv[3] === '--defer-delivery-index' ? 'evidence/artifact-inventory-delivery.json' : process.argv[3] === '--defer-final-index' ? 'evidence/artifact-inventory-final.json' : null;
if (process.argv[3] && !deferredIndex) throw new Error('Only the final delivery index can be deferred until its single creation.');
const output = path.join(__dirname, outputName);
const manifestName = process.argv[4] || 'changed-files.json';
const namesName = process.argv[5] || 'new-names.json';
for (const name of [manifestName, namesName]) if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(name)) throw new Error('Use JSON manifest basenames.');
if (fs.existsSync(output)) throw new Error('Document reference audit is immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const documents = ['delivery-report.md', 'implementation-plan.md', 'namebook-v3.21-appendix-proposal.md', 'verdicts-448-451.md', 'independent-final-review.md'];
const checks = documents.map(name => {
  const absolute = path.join(phase, name), bytes = fs.readFileSync(absolute), text = bytes.toString('utf8');
  const references = [];
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(?:https?:|app:|codex:)/i.test(target)) continue;
    const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(absolute), target);
    references.push({ reference: target, kind: 'MarkdownLocalLink', exists: fs.existsSync(resolved) });
  }
  for (const match of text.matchAll(/\bevidence\/[A-Za-z0-9._/-]+/g)) references.push({ reference: match[0], kind: 'EvidencePathMention', exists: fs.existsSync(path.resolve(phase, match[0])) });
  const unique = [...new Map(references.map(item => [item.kind + ':' + item.reference, item])).values()].map(item => ({ ...item, deferredUntilInventoryWrite: !item.exists && item.reference === deferredIndex }));
  return { path: name, bytes: bytes.length, sha256: sha(bytes), references: unique, missing: unique.filter(item => !item.exists && !item.deferredUntilInventoryWrite).map(item => item.reference), pass: unique.every(item => item.exists || item.deferredUntilInventoryWrite) };
});
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, manifestName), 'utf8'));
const sourceChecks = manifest.files.concat(manifest.generatedFiles).map(file => { const bytes = fs.readFileSync(path.join(root, file.path)); return { path: file.path, deliveredSha256: file.sha256, currentSha256: sha(bytes), unchanged: sha(bytes) === file.sha256 }; });
const names = JSON.parse(fs.readFileSync(path.join(__dirname, namesName), 'utf8'));
const report = { phase: 'B2.5c-2c final delivery document references and source stability', auditedUtc: new Date().toISOString(), sourceManifest: 'evidence/' + manifestName, namingManifest: 'evidence/' + namesName, checks, sourceChecks, counts: { documents: checks.length, verifiedLocalReferences: checks.reduce((sum, item) => sum + item.references.length, 0), implementationAndGeneratedFiles: sourceChecks.length, publicTopLevelIncrement: names.publicExportCount, publicTopLevelCumulative: names.cumulativeAdditiveCounts.publicTopLevelDeclarations, protocolPublicTypes: names.acceptedC2bCounts.sharedProtocolPublicTypes },
  deferredIndexReferences: checks.flatMap(item => item.references.filter(reference => reference.deferredUntilInventoryWrite).map(reference => ({ document: item.path, reference: reference.reference }))),
  pass: checks.every(item => item.pass) && sourceChecks.every(item => item.unchanged) && names.publicExportCount === 8 && names.cumulativeAdditiveCounts.publicTopLevelDeclarations === 72 && names.acceptedC2bCounts.sharedProtocolPublicTypes === 37, scope: 'Resolves explicit local Markdown links and evidence path mentions in final delivery documents, and rechecks hashes of the seven delivered implementation source files and four generated JS copies. If explicitly requested, the sole final inventory reference is deferred until its subsequent single creation; a read-only closure must verify this reference and the inventory hashes. Short prose references such as 同目录 or stage historical basenames are context, not blindly treated as absolute paths. Does not rewrite documents, tests, raw audits or implementation source.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ pass: report.pass, counts: report.counts, missing: checks.flatMap(item => item.missing.map(reference => ({ document: item.path, reference }))), sourceUnchanged: sourceChecks.every(item => item.unchanged) }, null, 2)); process.exitCode = report.pass ? 0 : 1;
