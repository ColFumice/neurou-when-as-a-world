'use strict';
// Publication tooling only. Hash actual checked-in bytes and the actual legacy fallback function.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const { chartContentDigest, parseChartContentManifest } = require(path.join(root, 'src/director/ChartArchive.ts'));
const { parseGuidanceChart } = require(path.join(root, 'src/chart/GuidanceChart.ts'));
const { createDefaultKeyboardPadLayout } = require(path.join(root, 'src/chart/KeyboardPadLayout.ts'));
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const layout = createDefaultKeyboardPadLayout();
function media(kind, contentId, contentRevision, resourcePath, file) {
  const bytes = fs.readFileSync(path.join(root, file));
  return { kind, contentId, contentRevision, resourcePath,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
}
const mediaRecords = [
  media('Audio', 'primary-rain-world-1-audio', '1.0.0', 'audio/primary-rain-world-1', 'assets/resources/audio/primary-rain-world-1.wav'),
  media('Video', 'chart-video-placeholder', 'legacy-published-1', 'video/chart_video_placeholder', 'assets/resources/video/chart_video_placeholder.mp4'),
];
const names = ['primary-rain-world-1', 'guidance_a', 'guidance_b', 'guidance_c', 'music-project-1-chart', 'chart_placeholder'];
const charts = names.map(name => {
  const sourcePath = 'assets/resources/chart/' + name + '.json', raw = json(sourcePath);
  const chart = 'lines' in raw ? parseGuidanceChart(raw, layout) : raw;
  const visualPath = path.join(root, 'assets/resources/chart/' + name + '.visual.json');
  const visual = fs.existsSync(visualPath) ? JSON.parse(fs.readFileSync(visualPath, 'utf8').replace(/^\uFEFF/, '')) : { schemaVersion: 1, chartId: chart.chartId, nodes: [] };
  const world = name === 'primary-rain-world-1';
  return { chartId: chart.chartId, sourceKind: 'Published', resourcePath: 'chart/' + name, sourcePath,
    contentRevision: world ? '1.0.0' : 'legacy-published-1', chartDigest: chartContentDigest(chart), visualDigest: chartContentDigest(visual),
    mediaContentId: world ? mediaRecords[0].contentId : mediaRecords[1].contentId };
});
const scenePath = 'assets/scripts/SceneBuilder.ts', source = fs.readFileSync(path.join(root, scenePath), 'utf8');
const ast = ts.createSourceFile(scenePath, source, ts.ScriptTarget.Latest, true);
const fallback = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createFallbackChartData');
if (!fallback) { throw new Error('Actual legacy fallback producer is missing'); }
const sandbox = { module: { exports: null } };
vm.runInNewContext(ts.transpileModule(fallback.getText(ast) + '\nmodule.exports = createFallbackChartData;', {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const fallbackChart = JSON.parse(JSON.stringify(sandbox.module.exports(layout.layoutVersion)));
charts.push({ chartId: fallbackChart.chartId, sourceKind: 'LegacyFallback', resourcePath: null,
  sourcePath: scenePath + '#createFallbackChartData', contentRevision: 'legacy-fallback-1', chartDigest: chartContentDigest(fallbackChart),
  visualDigest: chartContentDigest({ schemaVersion: 1, chartId: fallbackChart.chartId, nodes: [] }), mediaContentId: mediaRecords[1].contentId });
const manifest = parseChartContentManifest({ schemaVersion: 1, source: {
  author: '雨若制作方 / 既有内容与 B2.2c 正式世界内容', version: 'chart-content-manifest-1',
  description: '由实际发布文件与既有回退函数生成身份索引；World 的编辑器制作链见 b2-world-clear/content-export-manifest.json。空视觉节点表示实际默认呈现规则，禁止据此补造历史首演。',
}, media: mediaRecords, charts });
const target = path.join(root, 'assets/resources/chart/content-manifest.json');
const output = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) { throw new Error('Published chart content manifest differs from actual resources'); }
  console.log('PASS chart publication manifest: 7 actual chart identities, 2 actual principal media byte identities');
} else {
  fs.writeFileSync(target, output);
  console.log('Published ' + path.relative(root, target));
}
