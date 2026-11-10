'use strict';

// Repro: node quality-review/music-editor/independent-review.cjs
// Read-only implementation checks. Writes only its review result JSON.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const results = [];
const copy = value => JSON.parse(JSON.stringify(value));
const check = (name, action) => { action(); results.push({ name, passed: true }); };
const digest = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, filename);
const load = relative => require(path.join(root, relative));

async function main() {
  const { createDefaultKeyboardPadLayout } = load('src/chart/KeyboardPadLayout.ts');
  const { createDefaultMusicProject, parseMusicProjectData } = load('src/musicEditor/MusicProjectData.ts');
  const { MusicEditorSession, parseMusicEditorDocument } = load('src/musicEditor/MusicEditorSession.ts');
  const { buildChartSource } = load('src/musicEditor/ChartSourceBuilder.ts');
  const { tickToTimeMs, timeMsToTick } = load('src/musicEditor/MusicTiming.ts');
  const { parseChartSourceData, GuidanceEditorSession } = load('src/editor/GuidanceEditorSession.ts');
  const layout = createDefaultKeyboardPadLayout();
  const original = createDefaultMusicProject(layout);
  const session = new MusicEditorSession(layout);
  const caller = copy(original);
  session.submitMusicEditorIntent({ kind: 'LoadProject', project: caller });
  check('caller-isolation-deep-freeze', () => {
    assert(!Object.isFrozen(caller));
    caller.tracks[0].notes[0].pitch = 1;
    assert.equal(session.getDocument().project.tracks[0].notes[0].pitch, 60);
    assert(Object.isFrozen(session.getDocument().project.tracks[0].notes[0].position));
  });
  const before = session.getDocument();
  const note = copy(before.project.tracks[0].notes[0]);
  note.pitch = 72;
  check('invalid-edit-atomic', () => {
    assert.throws(() => session.submitMusicEditorIntent({ kind: 'AddNote', trackId: 'track-1', note: { ...note, id: 'bad', pitch: NaN } }));
    assert.strictEqual(session.getDocument(), before);
  });
  check('edit-undo-redo', () => {
    session.submitMusicEditorIntent({ kind: 'ChangeNote', trackId: 'track-1', noteId: note.id, note });
    session.submitMusicEditorIntent({ kind: 'Undo' });
    assert.equal(session.getDocument().project.tracks[0].notes[0].pitch, 60);
    session.submitMusicEditorIntent({ kind: 'Redo' });
    assert.equal(session.getDocument().project.tracks[0].notes[0].pitch, 72);
  });
  check('undo-branch-truncates-redo', () => {
    session.submitMusicEditorIntent({ kind: 'Undo' });
    session.submitMusicEditorIntent({ kind: 'SetTempo', bpm: 100 });
    assert.equal(session.getDocument().history.cursor, 1);
    assert.equal(session.getDocument().history.entries.length, 1);
  });
  check('draft-history-roundtrip', () => assert.deepEqual(parseMusicEditorDocument(copy(session.getDocument()), layout), session.getDocument()));
  check('tempo-inverse', () => {
    const project = copy(original);
    project.tempoMap = [{ tick: 0, bpm: 120 }, { tick: 960, bpm: 60 }];
    const parsed = parseMusicProjectData(project, layout);
    assert.equal(tickToTimeMs(parsed, 1440), 2000);
    assert.equal(timeMsToTick(parsed, 2000), 1440);
  });
  check('real-consumer-schema3', () => {
    const source = buildChartSource(original, 0, layout);
    const guidance = new GuidanceEditorSession(layout);
    guidance.submitEditorIntent({ kind: 'LoadSource', source: parseChartSourceData(source, layout) });
    assert.equal(guidance.exportChart().chart.schemaVersion, 3);
  });
  check('tiny-aspect-path-rejected', () => {
    const project = copy(original);
    project.aspectRatio = Number.MIN_VALUE;
    assert.throws(() => buildChartSource(project, 0, layout), /路径/);
  });
  check('source-fingerprint-different-import-same-id', () => {
    const project = copy(original);
    project.tracks[0].notes[0].pitch++;
    assert.notEqual(buildChartSource(original, 0, layout).sourceRevision, buildChartSource(project, 0, layout).sourceRevision);
  });
  check('bar-emphasis', () => {
    const project = copy(original);
    project.tracks[0].notes[0].tick = 0;
    assert(buildChartSource(project, 0, layout).events.find(event => event.id === project.tracks[0].notes[0].id).emphasis);
  });
  check('oversize-duration-rejected', () => {
    const project = copy(original);
    project.durationTicks = project.ppq * 4096 + 1;
    assert.throws(() => parseMusicProjectData(project, layout));
  });

  const files = [
    'src/musicEditor/MusicProjectData.ts', 'src/musicEditor/MusicTiming.ts',
    'src/musicEditor/MusicEditorSession.ts', 'src/musicEditor/ChartSourceBuilder.ts',
    'src/presentation/MusicEditorView.ts', 'src/presentation/MusicPreviewAudio.ts',
    'assets/scripts/MusicEditorBuilder.ts',
  ];
  const astFiles = [];
  check('ast-new-code-no-require-or-side-effect-import', () => {
    for (const relative of files) {
      const filename = path.join(root, relative);
      const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
      const imports = [];
      const visit = node => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
          assert.fail(relative + ': CommonJS require is outside reviewed import forms');
        }
        if (ts.isImportDeclaration(node)) {
          assert(node.importClause, relative + ': side-effect import is outside reviewed import forms');
          const specifier = node.moduleSpecifier.text;
          const typeOnly = node.importClause.isTypeOnly;
          imports.push({ specifier, typeOnly });
          if (relative.startsWith('src/musicEditor/')) {
            assert(!/^cc(?:\/|$)/.test(specifier), relative + ': logic engine import');
            assert(!/\.\.(?:\/|\\)(?:director|ledger|world|trace|character|presentation)(?:\/|\\)/.test(specifier), relative + ': forbidden logic domain');
            if (specifier.includes('../editor/')) { assert(typeOnly, relative + ': editor contract runtime dependency'); }
          }
          if (relative.startsWith('src/presentation/') && /\.\.\/(?:musicEditor|editor)\//.test(specifier)) {
            assert(typeOnly, relative + ': presentation logic value dependency');
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      astFiles.push({ file: relative, sha256: digest(filename), imports });
    }
  });

  check('creator-junction-same-source', () => {
    assert.equal(fs.realpathSync(path.join(root, 'assets/scripts/src')), fs.realpathSync(path.join(root, 'src')));
    for (const relative of files.filter(file => file.startsWith('src/'))) {
      assert.equal(digest(path.join(root, relative)), digest(path.join(root, 'assets/scripts', relative)));
    }
  });

  let resolveResume;
  const previousContext = global.AudioContext;
  class AudioContextStub {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { return new Promise(resolve => { resolveResume = () => { this.state = 'running'; resolve(); }; }); }
    createBuffer(channels, frames) { return { getChannelData: () => new Float32Array(frames) }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() {}, buffer: null, onended: null }; }
  }
  global.AudioContext = AudioContextStub;
  try {
    const { MusicPreviewAudio } = load('src/presentation/MusicPreviewAudio.ts');
    const audio = new MusicPreviewAudio();
    const pending = audio.play([], 1000);
    audio.pause();
    resolveResume();
    await pending;
    check('pause-during-pending-resume', () => assert.equal(audio.getState(), 'Paused'));
  } finally { global.AudioContext = previousContext; }

  const result = { passed: results.length, failed: 0, results, astFiles,
    note: 'Logic/AST/lifecycle checks only; Creator UI and audible output evidence are recorded separately.' };
  fs.writeFileSync(path.join(__dirname, 'independent-review-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, failed: result.failed, astFiles: astFiles.length }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
