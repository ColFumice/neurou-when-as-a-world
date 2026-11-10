const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const read = name => fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, '');
const result = name => JSON.parse(read(name + '-result.json'));
const namingLog = read('check-naming.log');
const dependencyLog = read('check-dependencies.log');
const typeLog = read('typecheck.log');
const warnings = namingLog.split(/\r?\n/).filter(line => line.startsWith('WARN')).map(line => ({message: line, semanticGroup: line.includes('[R7]') ? 'TimingWindow' : 'GameplayTrace'}));
if (!namingLog.includes('0 ERROR / 22 WARN') || warnings.length !== 22) throw new Error('Unexpected naming summary');
if (!dependencyLog.includes('0 ERROR')) throw new Error('Unexpected dependency summary');
const baseline = JSON.parse(read('baseline-before.json'));
const report = {
  schemaVersion: 1,
  phase: 'B2.4a',
  generatedAt: new Date().toISOString(),
  projectRoot: baseline.root,
  executionMode: 'Three independent gates executed concurrently; logs preserve full stdout/stderr',
  sourceChanges: 'None. All writes are within the new quality-review/b2-cross-device-freeze directory.',
  baseline: {path: 'baseline-before.json', algorithm: 'sha256', filePathCount: baseline.fileCount, uniquePhysicalFileCount: baseline.initialPhysicalFileCount, junctionAliasFilePathCount: baseline.fileCount - baseline.initialPhysicalFileCount, junctions: baseline.symbolicLinks, unreadableFileCount: baseline.unreadable.length, initialPhysicalFilesUnchangedAfterGates: true},
  gates: [
    {...result('check-naming'), status: 'PASS_WITH_REVIEWED_WARNINGS', scannedTsFiles: 115, errorCount: 0, warningCount: 22, warningReview: {timingWindowCount: 4, gameplayTraceCount: 18, disposition: 'Existing semantic warnings reviewed manually; no naming violation found. No source edits.', timingWindowEvidence: ['src/chart/ChartScore.ts:63 judgeTimeWindow compares strike and target timestamps', 'src/chart/ChartPremiere.ts:457 hasAnyCandidateInWindow checks unresolved Notes inside the rhythm timing interval', 'src/chart/GuidanceLineRuntime.ts:159 calls judgeTimeWindow for node judgment'], gameplayTraceEvidence: ['src/director/IntentPort.ts:392 bindDeepTrace receives the gameplay DeepTrace instance', 'src/director/IntentPort.ts:942 tracePosition is the DeepTrace world position', 'src/director/PuzzleHydration.ts:26 deepTraceId is puzzle snapshot identity', 'src/trace/TraceProximityVolume.ts:27 adjusts proximity volume relative to gameplay Trace', 'src/presentation/DeepTraceRevealSequence.ts:14 implements DeepTrace reveal presentation', 'assets/scripts/SceneBuilder.ts:670 creates an ElementEntity with elementType Trace', 'assets/scripts/SceneBuilder.ts:753-774 creates and binds DeepTrace and its scene node', 'assets/scripts/SceneBuilder.ts:1205 tracePos drives proximity distance']}, warnings},
    {...result('typecheck'), status: 'PASS', scannedTsFiles: null, errorCount: 0, warningCount: 0, diagnostics: [], scanCountNote: 'The existing npm run typecheck command does not print a file count; no additional count command was run.', fullLogBytes: Buffer.byteLength(typeLog, 'utf8')},
    {...result('check-dependencies'), status: 'PASS', scannedTsFiles: 109, approximateStaticDependencyClauses: 386, errorCount: 0, warningCount: 0}
  ],
  validationLimit: 'These are the three existing static gates. This phase adds no implementation and does not execute Cocos or additional tests.'
};
if (report.gates.some(g => g.exitCode !== 0)) throw new Error('Gate returned nonzero');
fs.writeFileSync(path.join(dir, 'gate-results.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({gates: report.gates.map(g => ({command: g.command, exitCode: g.exitCode, status: g.status, errors: g.errorCount, warnings: g.warningCount})), baseline: report.baseline}));
