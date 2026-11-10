'use strict';
// Additive closure only. Historical d baselines and raw FAIL reports are never rewritten.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const d = path.resolve(__dirname, '../b2-world-migration');
const read = file => JSON.parse(fs.readFileSync(path.join(d, file), 'utf8'));
const before = read('baseline-before.json'), after = read('baseline-after.json'), audit = read('protected-final-audit.json');
const records = ['docs/NAMEBOOK.md', 'docs/spec/stage-1.md'].map(file => {
  const original = before.files.find(value => value.path === file), final = after.files.find(value => value.path === file);
  return { path: file, baselineSha256: original.sha256, baselineBytes: original.bytes,
    finalSha256: final.sha256, finalBytes: final.bytes, rawHashEquality: original.sha256 === final.sha256,
    attribution: 'TraeAuthorized', protocolAttributionAccepted: true };
});
const sourceHashes = ['baseline-before.json', 'baseline-after.json', 'protected-final-audit.json'].map(file => ({
  path: '../b2-world-migration/' + file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(d, file))).digest('hex'),
}));
const result = { schemaVersion: 1, phase: 'B2.4e protocol closure for historical B2.4d audit',
  generatedAtUtc: new Date().toISOString(), rawHashEquality: false, protocolAttributionAccepted: true,
  violationResolved: true, attribution: 'TraeAuthorized',
  authorization: { source: 'User PROTOCOL confirmation and subsequent concurrent-documents attribution authorization, relayed by the root implementer in this team task.',
    confirmation: '用户确认 d 两份 docs 变化来自 Trae PROTOCOL授权，并声明后续并发docs均可按Trae授权同步归因。',
    acceptedMeaning: 'User confirmation resolves attribution and the alleged unauthorized-documents violation. It does not restore byte equality or alter the historical raw hash result.' },
  historicalRawAuditPass: audit.pass, baselineCapturedAtUtc: before.capturedAt, historicalFinalCapturedAtUtc: after.capturedAt,
  paths: records, immutableHistoricalArtifacts: sourceHashes, historicalArtifactsRewritten: false,
  limits: 'This closure records explicit user authorization, not filesystem/process forensics. Historical protected-final-audit.json remains FAIL and original SHA manifests remain unchanged.' };
fs.writeFileSync(path.join(__dirname, 'd-audit-protocol-closure.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ rawHashEquality: result.rawHashEquality, protocolAttributionAccepted: result.protocolAttributionAccepted,
  violationResolved: result.violationResolved, historicalRawAuditPass: result.historicalRawAuditPass, paths: records }));
