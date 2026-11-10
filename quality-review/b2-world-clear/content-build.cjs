/* B2.2c original content publication. Uses the shipped editor's production APIs. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = function(module, file) {
  const source = fs.readFileSync(file, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
  }, fileName: file }).outputText, file);
};
const { createDefaultKeyboardPadLayout } = require(path.join(root, 'src/chart/KeyboardPadLayout.ts'));
const { MusicEditorSession } = require(path.join(root, 'src/musicEditor/MusicEditorSession.ts'));
const { GuidanceEditorSession } = require(path.join(root, 'src/editor/GuidanceEditorSession.ts'));
const layout = createDefaultKeyboardPadLayout();
const position = key => {
  const slot = layout.slots.find(s => s.keyId === key);
  if (!slot) { throw new Error('Unknown authored position: ' + key); }
  return { u: slot.u + slot.width / 2, v: slot.v + slot.height / 2 };
};
const project = {
  schemaVersion: 1, projectId: 'primary-rain-world-music-1', title: '雨后回响', ppq: 480,
  tempoMap: [{ tick: 0, bpm: 100 }], timeSignature: { numerator: 4, denominator: 4 },
  durationTicks: 4800, layoutVersion: layout.layoutVersion, aspectRatio: 16 / 9,
  mappingVersion: 'music-mapping-1', tracks: [{
    id: 'rain-memory-piano', title: '记忆的六个音', lineId: 'rain-memory-line', offsetMs: 0,
    color: { r: 146, g: 202, b: 219 },
    notes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'].map((key, i) => ({
      id: 'rain-note-' + (i + 1), tick: 600 * (i + 1), durationTicks: 300,
      pitch: [60, 64, 67, 69, 67, 72][i], velocity: [68, 72, 76, 74, 70, 64][i],
      position: position(key),
    })),
  }],
};
const music = new MusicEditorSession(layout);
music.submitMusicEditorIntent({ kind: 'LoadProject', project });
const source = music.exportSource();
const heads = {}, nodes = {};
for (const event of source.events) {
  if (!heads[event.lineId]) { heads[event.lineId] = event.id; }
  nodes[event.id] = { kind: 'Tap', holdEndEventId: null };
}
const draft = {
  schemaVersion: 1, documentId: 'primary-rain-world-draft-1', chartId: 'primary-rain-world-1',
  tier: 'World', source, selection: { heads, nodes }, history: { entries: [], cursor: 0 },
  media: { videoPath: null, audioPath: 'audio/primary-rain-world-1' },
};
const editor = new GuidanceEditorSession(layout);
editor.submitEditorIntent({ kind: 'LoadDraft', document: draft });
const exported = editor.exportChart();
if (exported.chart.schemaVersion !== 3 || exported.chart.tier !== 'World') {
  throw new Error('The editor did not export a schemaVersion=3 World chart');
}
const narrative = {
  schemaVersion: 1, contentId: 'primary-rain-memory', contentRevision: '1.0.0',
  worldKind: 'Primary', protagonistCharacterId: 'protagonist-1',
  EventSpaceCenter: Array(20).fill(0), EventDistance: 3,
  source: {
    author: '雨若制作方 / B2.2c 原创内容', version: '1.0.0',
    description: '2026-10-10 原创《雨中遗失的名字》；每个分支来自主角在真实世界内的一次玩家回应。向量是该已发布片段的制作方手工叙事标注，不是运行时自动感绪计算。',
  },
  interaction: {
    title: '雨中遗失的名字',
    prompt: '雨停前，你在旧站台遇见一位同伴。她攥着一张被雨浸湿的车票：“我记得要等一个人，却忘了他的名字。你愿意陪我想一想吗？”',
    choices: [
      {
        choiceId: 'share-shelter', label: '把伞移向她，陪她听一会儿雨',
        meaning: '用陪伴回应恐惧：以绿维的关怀为主要叙事标注，蓝维保留安静悲伤；信任、亲近和玩家共情来自共同避雨。',
        vector: [0.4, 3.2, 0.8, 0, 0.4, 0.2, 0.2, 0.5, 0.3, 0.2, 0, 0.4, 1, 1, 0.5, 0, 0.2, 1, 0.2, 1],
      },
      {
        choiceId: 'read-ticket', label: '和她读车票背面的字，找回约定',
        meaning: '共同回望丢失的记忆：以蓝维的追忆为主要叙事标注；痕、理解和真实性来自读出车票上的约定，绿维是耐心帮助。',
        vector: [0.3, 0.6, 3.2, 0, 0.4, 0.4, 0.2, 0.5, 1, 0.4, 0.2, 0.3, 0.7, 0.5, 1.2, 0, 0.8, 1, 0.2, 0.7],
      },
      {
        choiceId: 'keep-promise', label: '答应陪她等到雨停，再一起出发',
        meaning: '以新的约定接住尚未找回的名字：白维标注克制而明亮的希望，红维标注主动承诺；信任与亲近来自一起等候。',
        vector: [0.8, 0.8, 0.4, 0, 3.2, 0.2, 0.3, 0.5, 0.3, 0.5, 0.1, 0.3, 1, 1, 0.6, 0, 0.4, 1, 0.3, 0.8],
      },
    ],
  },
  worldBossChartSource: {
    chartId: 'primary-rain-world-1', contentRevision: '1.0.0',
    chartResourcePath: 'chart/primary-rain-world-1',
    visualResourcePath: 'chart/primary-rain-world-1.visual',
    mediaResourcePath: 'audio/primary-rain-world-1',
  },
};
function writeJson(relative, value) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
writeJson('quality-review/b2-world-clear/content-music-project.json', project);
writeJson('quality-review/b2-world-clear/content-chart-source.json', source);
writeJson('quality-review/b2-world-clear/content-world-draft.json', draft);
writeJson('assets/resources/chart/primary-rain-world-1.json', exported.chart);
writeJson('assets/resources/chart/primary-rain-world-1.visual.json', exported.visual);
writeJson('assets/resources/world/primary-rain-dialogue.json', narrative);

// Original 6-second PCM composition, rendered from this project's exported note times.
// Soft bell partials + deterministic rain texture; no borrowed sample/media asset.
const sampleRate = 22050, durationMs = source.mediaDurationMs, length = Math.round(sampleRate * durationMs / 1000);
const pcm = Buffer.alloc(length * 2);
let random = 226240, rain = 0;
for (let i = 0; i < length; i++) {
  const seconds = i / sampleRate;
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
  rain = rain * 0.78 + (random / 4294967296 - 0.5) * 0.22;
  let value = rain * 0.025;
  for (const event of source.events) {
    const age = seconds - event.timeMs / 1000;
    if (age < 0 || age > 1.4) { continue; }
    const frequency = 440 * Math.pow(2, (event.pitch - 69) / 12);
    const envelope = (1 - Math.exp(-age * 100)) * Math.exp(-age * 3.8) * event.velocity / 127;
    value += envelope * (Math.sin(2 * Math.PI * frequency * age) * 0.34 +
      Math.sin(2 * Math.PI * frequency * 2.002 * age) * 0.10 +
      Math.sin(2 * Math.PI * frequency * 3.003 * age) * 0.035);
  }
  const edge = Math.min(1, seconds / 0.15, (durationMs / 1000 - seconds) / 0.3);
  pcm.writeInt16LE(Math.round(Math.max(-0.95, Math.min(0.95, value * edge)) * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(path.join(root, 'assets/resources/audio/primary-rain-world-1.wav'), Buffer.concat([header, pcm]));
const outputs = [
  'quality-review/b2-world-clear/content-music-project.json',
  'quality-review/b2-world-clear/content-chart-source.json',
  'quality-review/b2-world-clear/content-world-draft.json',
  'assets/resources/world/primary-rain-dialogue.json',
  'assets/resources/chart/primary-rain-world-1.json',
  'assets/resources/chart/primary-rain-world-1.visual.json',
  'assets/resources/audio/primary-rain-world-1.wav',
];
const manifest = {
  schemaVersion: 1, contentRevision: '1.0.0', authoredAt: '2026-10-10',
  author: '雨若制作方 / B2.2c 原创内容', originalNarrative: true, originalMusicAndMedia: true,
  publicationChain: ['MusicEditorSession.LoadProject', 'MusicEditorSession.exportSource',
    'GuidanceEditorSession.LoadDraft(tier=World)', 'GuidanceEditorSession.exportChart'],
  editorSourceFiles: ['src/musicEditor/MusicEditorSession.ts', 'src/editor/GuidanceEditorSession.ts'],
  chart: { chartId: exported.chart.chartId, schemaVersion: exported.chart.schemaVersion, tier: exported.chart.tier,
    lineCount: exported.chart.lines.length, nodeCount: exported.chart.lines.reduce((n, l) => n + l.nodes.length, 0) },
  media: { format: 'PCM WAV', sampleRate, channels: 1, bitsPerSample: 16, durationMs,
    construction: '原创音乐工程的音高/力度/绝对时间驱动钟音合成，加确定性低电平雨声；正常媒体 ended，非挂钟模拟。' },
  narrative: { contentId: narrative.contentId, EventDistance: narrative.EventDistance,
    choiceDistances: narrative.interaction.choices.map(c => ({ choiceId: c.choiceId, distance: Math.hypot(...c.vector) })) },
  hashes: Object.fromEntries(outputs.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])),
};
writeJson('quality-review/b2-world-clear/content-export-manifest.json', manifest);
console.log(JSON.stringify({ publicationChain: manifest.publicationChain, chart: manifest.chart, media: manifest.media,
  narrative: manifest.narrative }, null, 2));
