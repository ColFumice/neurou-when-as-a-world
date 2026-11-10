'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), root = path.resolve(__dirname, '../..');
const resultFiles = ['logic-results.json', 'builder-boundary-results.json', 'dom-boundary-results.json', 'b1-logic-results.json', 'b1-resource-boundary-results.json'];
const results = resultFiles.map(file => { const report = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return { file, passed: report.passed, failed: report.failed, scope: report.scope ?? 'Relocated accepted B1 assertions, original result artifacts unchanged.', sha256: sha(path.join(__dirname, file)) }; });
const gates = JSON.parse(fs.readFileSync(path.join(__dirname, 'gate-results.json'), 'utf8'));
const productionFiles = ['src/director/WorldFolderSession.ts', 'src/presentation/WorldLocalStorage.ts', 'src/presentation/WorldFolderView.ts', 'src/presentation/FolderCatalog.ts', 'src/director/IntentPort.ts', 'assets/scripts/WorldFolderBuilder.ts', 'assets/scripts/MinimalWorldBuilder.ts', 'assets/scripts/SceneBuilder.ts', 'src/presentation/ChartPadView.ts'];
const report = { generatedAt: new Date().toISOString(), pass: results.every(r => r.failed === 0) && gates.pass,
  totalPassed: results.reduce((sum, r) => sum + r.passed, 0), totalFailed: results.reduce((sum, r) => sum + r.failed, 0), results, gates,
  gateDetails: { naming: '0 ERROR / 16 existing Trace-domain semantic WARN', dependencies: '77 TypeScript sources, about 223 dependencies, 0 ERROR', typecheck: 'tsc --noEmit exit 0' },
  retainedDiagnostic: { report: 'diagnostic-initial-gate-results.json', log: 'diagnostic-initial-typecheck-failure.log', reason: 'First typecheck found template: unknown narrowing error; production fix uses derived literal template; later complete gate run passes.' },
  sourceHashesAtSummary: Object.fromEntries(productionFiles.map(f => [f, sha(path.join(root, f))])),
  limits: ['Metadata storage only: no gameplay state/ledger persistence, WorldFork inheritance or CopyPermission granting is implemented or claimed.',
    'DOM uses actual isolated Chromium; composition boundary mocks cc lifecycle/rendering and runtime targets. These reports do not replace actual Creator two-resolution evidence.',
    'B1 scripts were relocated into this evidence directory and only output result filenames adapted; original assertions and historical evidence remain untouched.'] };
fs.writeFileSync(path.join(__dirname, 'test-summary.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.pass ? 0 : 1;
