// Verify that this task did not alter the four source harnesses in the preceding evidence directory.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'unadapted-source-manifest.json'), 'utf8'));
const files = baseline.map(item => {
  const currentSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, item.source))).digest('hex');
  return { path: item.source, originalSha256: item.sourceSha256, currentSha256, preserved: currentSha256 === item.sourceSha256 };
});
const report = { allPreserved: files.every(file => file.preserved), files };
fs.writeFileSync(path.join(__dirname, 'prior-evidence-integrity.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); process.exitCode = report.allPreserved ? 0 : 1;
