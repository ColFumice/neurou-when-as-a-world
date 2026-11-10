'use strict';
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sourceFile = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
const file = 'src/director/IntentPort.ts';
const source = sourceFile(file);
const producers = [];
function walk(node) {
  if (ts.isMethodDeclaration(node) && ['buildEndpointNarrativeEvent', 'buildCompletionNarrativeEvent'].includes(node.name.getText(source))) {
    let vector = null, eventId = null;
    function inspect(n) {
      if (ts.isVariableDeclaration(n) && n.name.getText(source) === 'zeroVector' && ts.isArrayLiteralExpression(n.initializer)) {
        vector = n.initializer.elements.map(element => Number(element.getText(source)));
      }
      if (ts.isVariableDeclaration(n) && n.name.getText(source) === 'eventId' && ts.isStringLiteral(n.initializer)) {
        eventId = n.initializer.text;
      }
      ts.forEachChild(n, inspect);
    }
    inspect(node);
    producers.push({ file, method: node.name.getText(source), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      eventId, dimensions: vector?.length, allZero: vector?.every(value => value === 0) === true,
      containsChartRef: node.getText(source).includes('ChartRef:'), explicitChartRefState: /state\s*:/.test(node.getText(source)) });
  }
  ts.forEachChild(node, walk);
}
walk(source);
const appendCalls = [];
function scan(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = dir + '/' + entry.name;
    if (entry.isDirectory()) { scan(relative); continue; }
    if (!entry.name.endsWith('.ts')) { continue; }
    const parsed = sourceFile(relative);
    function inspect(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'append' && node.expression.expression.getText(parsed) === 'this.ledgerAppend') {
        appendCalls.push({ file: relative, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1,
          expression: node.expression.getText(parsed) });
      }
      ts.forEachChild(node, inspect);
    }
    inspect(parsed);
  }
}
scan('src');
scan('assets/scripts');
const charts = fs.readdirSync(path.join(root, 'assets/resources/chart')).filter(name => name.endsWith('.json') && !name.endsWith('.visual.json')).map(name => {
  const relative = 'assets/resources/chart/' + name;
  const chart = JSON.parse(read(relative).replace(/^\uFEFF/, ''));
  return { file: relative, chartId: chart.chartId, schemaVersion: chart.schemaVersion ?? null, tier: chart.tier };
});
const dimensionEnum = sourceFile('constants/index.ts').statements.find(node => ts.isEnumDeclaration(node) && node.name.text === 'NarrativeDimension');
const dimensionCount = dimensionEnum.members.length;
const samplePositiveRadius = 1;
const coordinate = Array(dimensionCount).fill(0);
const distance = Math.hypot(...coordinate);
const report = {
  generatedAt: new Date().toISOString(), scope: 'Static source preflight and arithmetic witness; not B2.2c contract or production acceptance',
  producers, appendCalls, charts,
  arithmeticWitness: {
    fixtureOnly: true, center: 'zero coordinate', samplePositiveRadius,
    radiusIsNotProductionConfiguration: true, coordinateDimensionCount: dimensionCount,
    distanceAfterAnyNumberOfExistingZeroEvents: distance, reachesSphere: distance >= samplePositiveRadius,
    rationale: 'Summing zero vectors leaves the coordinate at zero for every finite sequence. For every positive radius and zero center it remains strictly inside.',
  },
  assertions: {
    bothExistingProducersAreZero: producers.length === 2 && producers.every(item => item.allZero && item.dimensions === dimensionCount),
    onlyTwoExistingAppendCalls: appendCalls.length === 2 && appendCalls.every(item => item.expression === 'this.ledgerAppend.append'),
    noBundledWorldTierChart: charts.every(chart => chart.tier !== 'World'),
    legacyChartRefIsUnclassified: producers.every(item => !item.explicitChartRefState),
  },
};
report.pass = Object.values(report.assertions).every(Boolean);
fs.writeFileSync(path.join(__dirname, 'preflight-source-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.pass ? 0 : 1;
