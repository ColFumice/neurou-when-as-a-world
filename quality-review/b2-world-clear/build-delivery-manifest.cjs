'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function info(full, file) {
  const bytes = fs.readFileSync(full);
  return { file, bytes: bytes.length, sha256: hash(bytes) };
}
function walk(full, prefix, files) {
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) { continue; }
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (!prefix && (entry.name === 'baseline' || entry.name === 'delivery-manifest.json')) { continue; }
    if (entry.isDirectory()) { walk(path.join(full, entry.name), relative, files); }
    else if (entry.isFile()) { files.push(info(path.join(full, entry.name), relative)); }
  }
}
function result(name) {
  try { return { file: name, value: JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')), error: null }; }
  catch (error) { return { file: name, value: null, error: String(error) }; }
}
const evidence = {
  gates: result('gate-results.json'), domain: result('domain.contract-results.json'),
  storage: result('storage.contract-results.json'), production: result('creator-preview-results.json'),
  protection: result('protected-final-audit.json'),
};
const files = []; walk(__dirname, '', files); files.sort((a, b) => a.file.localeCompare(b.file));
const productionFiles = [];
for (const base of ['src', 'constants', 'assets/scripts', 'assets/resources']) {
  walk(path.join(root, base), base, productionFiles);
}
productionFiles.sort((a, b) => a.file.localeCompare(b.file));
const domain = evidence.domain.value, storage = evidence.storage.value;
function contractPassed(value) {
  return value !== null && value.category === 'ContractTest' && value.passed > 0 && value.failed === 0 &&
    Array.isArray(value.results) && value.results.length === value.passed && value.results.every(item => item.result === 'PASS');
}
const preview = evidence.production.value;
const resolutionResults = preview && Array.isArray(preview.resolutions) ? preview.resolutions : [];
const screenshotChecks = resolutionResults.flatMap(resolution =>
  (Array.isArray(resolution.screenshots) ? resolution.screenshots : []).map(screenshot => {
    const target = path.join(__dirname, screenshot.file);
    const exists = fs.existsSync(target) && fs.statSync(target).isFile();
    const actualSha256 = exists ? hash(fs.readFileSync(target)) : null;
    return { file: screenshot.file, resolution: resolution.resolution, exists,
      expectedSha256: screenshot.sha256, actualSha256, pass: exists && actualSha256 === screenshot.sha256 };
  }));
const gatesPass = evidence.gates.value?.pass === true;
const contractsPass = contractPassed(domain) && contractPassed(storage);
const requiredResolutions = ['1920x1080', '2560x1440'];
const productionPass = preview?.pass === true && requiredResolutions.every(resolution =>
  resolutionResults.some(value => value.resolution === resolution && value.pass === true)) &&
  screenshotChecks.length > 0 && screenshotChecks.every(value => value.pass);
const protection = evidence.protection.value;
const implementationScopePass = protection?.implementationScopePass === true;
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'B2.2c full implementation plus authorized minimal maker-published Primary narrative producer',
  files, productionFiles, excludedSelf: 'delivery-manifest.json',
  excludedBaseline: 'baseline/ original byte copies; integrity verified independently against protected-baseline.json',
  productionImplementationComplete: gatesPass && contractsPass && productionPass && implementationScopePass,
  businessContractTestsExecuted: !!domain && !!storage && domain.passed + domain.failed > 0 && storage.passed + storage.failed > 0,
  businessContractTestsPassed: contractsPass,
  contractCounts: { domain: domain ? { passed: domain.passed, failed: domain.failed } : null,
    storage: storage ? { passed: storage.passed, failed: storage.failed } : null },
  gatesPassed: gatesPass,
  productionAcceptanceExecuted: resolutionResults.length > 0,
  productionAcceptancePassed: productionPass,
  productionScreenshots: screenshotChecks.filter(value => value.pass).length,
  screenshots: screenshotChecks,
  implementationScopePass,
  protectedBaselineUnchanged: protection?.protectedBaselineUnchanged === true,
  auditRequiresAttribution: protection?.auditRequiresAttribution === true,
  observedExternalDocumentChanges: protection?.observedExternalDocumentChanges ?? [],
  limitation: protection?.auditRequiresAttribution ?
    'Two protected documents changed through an externally observed parallel write; attribution unconfirmed. Excluded from authorized production changes and recorded in external-documents.diff.' : null,
  results: Object.fromEntries(Object.entries(evidence).map(([name, value]) => [name, {
    file: value.file, readable: value.value !== null, error: value.error,
  }])),
};
fs.writeFileSync(path.join(__dirname, 'delivery-manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ qualityFiles: files.length, productionFiles: productionFiles.length,
  gatesPass, contractsPass, productionPass, implementationScopePass,
  productionScreenshots: report.productionScreenshots,
  productionImplementationComplete: report.productionImplementationComplete,
  auditRequiresAttribution: report.auditRequiresAttribution }, null, 2));
