'use strict';
// 独立审查：加载真实 TS。cc/DOM/Canvas 仅提供状态机宿主，不冒充 Creator 截图或听觉验收。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const Module = require('module');
const ts = require('../../node_modules/typescript');
const projectRoot = path.resolve(__dirname, '../..');
const results = [];
function check(name, verify) {
  try { verify(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error.stack || error) }); }
}
require.extensions['.ts'] = (loaded, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true, isolatedModules: true }
  }).outputText;
  loaded._compile(compiled, filename);
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  return request === 'cc' ? { _decorator: { ccclass: () => target => target }, Component: class {} }
    : originalLoad.call(this, request, parent, isMain);
};
const { MusicEditorView } = require('../../src/presentation/MusicEditorView.ts');
Module._load = originalLoad;
const { MusicEditorSession, parseMusicEditorDocument } = require('../../src/musicEditor/MusicEditorSession.ts');
const { createDefaultMusicProject } = require('../../src/musicEditor/MusicProjectData.ts');
const { createDefaultKeyboardPadLayout } = require('../../src/chart/KeyboardPadLayout.ts');
const layout = createDefaultKeyboardPadLayout(), base = createDefaultMusicProject(layout);
const clone = data => JSON.parse(JSON.stringify(data));
class FakeElement {
  constructor(tag = 'div', editable = false) { this.tagName = tag.toUpperCase(); this.editable = editable;
    this.value = ''; this.textContent = ''; this.dataset = {}; this.style = {}; this.disabled = false; this.children = []; }
  closest() { return this.editable ? this : null; }
  appendChild(child) { this.children.push(child); }
  remove() { this.removed = true; }
}
global.Element = FakeElement;
global.document = { createElement: tag => new FakeElement(tag) };
const removedListeners = [];
global.window = { devicePixelRatio: 1, removeEventListener: (...args) => removedListeners.push(args), addEventListener() {} };
const savedStorage = new Map();
global.localStorage = { setItem: (key, text) => savedStorage.set(key, text), getItem: key => savedStorage.get(key) ?? null };
function session(project = base) { const s = new MusicEditorSession(layout);
  s.submitMusicEditorIntent({ kind: 'LoadProject', project }); return s; }
function harness(project = base) {
  const s = session(project), view = new MusicEditorView(), elements = new Map(), operations = [], submitted = [];
  const fields = ['tick', 'duration', 'pitch', 'velocity', 'u', 'v'].map(name => {
    const input = new FakeElement('input', true); input.value = name === 'u' || name === 'v' ? '0.5' : '60';
    elements.set('music-note-' + name, input); return input;
  });
  const root = new FakeElement();
  root.querySelector = selector => { const id = selector.replace(/^#/, ''); if (!elements.has(id)) { elements.set(id, new FakeElement()); } return elements.get(id); };
  root.querySelectorAll = () => fields;
  const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] : (...args) => operations.push({ kind: key, args,
    alpha: target.globalAlpha, strokeStyle: target.strokeStyle, fillStyle: target.fillStyle }),
    set: (target, key, value) => { target[key] = value; return true; } });
  const captures = new Set();
  const canvas = new FakeElement('canvas'); canvas.width = 1000; canvas.height = 600;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
  canvas.getContext = () => ctx; canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id); canvas.releasePointerCapture = id => captures.delete(id);
  view.reader = s; view.port = { submitMusicEditorIntent(intent) { submitted.push(intent); s.submitMusicEditorIntent(intent); } };
  view.root = root; view.canvas = canvas; view.selectedTrackId = project.tracks[0].id;
  view.refreshDocument();
  return { view, s, elements, operations, submitted, captures, fields, root, canvas };
}
function event(x, y, modifiers = {}) { return { clientX: x, clientY: y, button: 0, isPrimary: true,
  pointerId: 9, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true; }, ...modifiers }; }
function point(view, id) { const r = view.noteRects.find(rect => rect.noteId === id); assert(r, id);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
function click(view, id, modifiers = {}) { const p = point(view, id); view.pointerDown(event(p.x, p.y, modifiers)); view.pointerUp(event(p.x, p.y, modifiers)); }
function keys(view, code, modifiers = {}) { const e = { code, ctrlKey: false, metaKey: false, shiftKey: false,
  repeat: false, target: null, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...modifiers };
  view.keyDown(e); return e; }
function selected(view) { return [...view.selectedNoteIds].sort(); }
function allNotes(s) { return s.getDocument().project.tracks.flatMap(track => track.notes); }
function assertNoDocumentChange(h, before) { assert.strictEqual(h.s.getDocument(), before); }

check('R01 Ctrl toggle跨轨、同轨Shift/无同轨anchor、Ctrl+Shift追加', () => {
  const h = harness(), v = h.view;
  click(v, 'music-note-1'); click(v, 'music-note-4', { ctrlKey: true });
  assert.deepEqual(selected(v), ['music-note-1', 'music-note-4']);
  click(v, 'music-note-4', { ctrlKey: true }); assert.deepEqual(selected(v), ['music-note-1']);
  click(v, 'music-note-3', { shiftKey: true }); assert.deepEqual(selected(v), ['music-note-3']);
  assert.equal(v.anchorNoteId, 'music-note-3');
  click(v, 'music-note-1', { shiftKey: true }); assert.deepEqual(selected(v), ['music-note-1', 'music-note-2', 'music-note-3']);
  click(v, 'music-note-4', { ctrlKey: true }); click(v, 'music-note-6', { ctrlKey: true, shiftKey: true });
  assert.equal(v.selectedNoteIds.size, 6); assert.equal(h.s.getDocument().revision, 0);
});
check('R02 已选普通点击down保留组用于拖动，短up单选且无历史', () => {
  const h = harness(), v = h.view; v.selectedNoteIds = new Set(['music-note-1', 'music-note-4']);
  const p = point(v, 'music-note-1'), before = h.s.getDocument();
  v.pointerDown(event(p.x, p.y)); assert.equal(v.selectedNoteIds.size, 2);
  v.pointerUp(event(p.x, p.y)); assert.deepEqual(selected(v), ['music-note-1']); assertNoDocumentChange(h, before);
});
check('R03 跨轨ghost只画预览、mouseUp一次共同位移、字段不变', () => {
  const h = harness(), v = h.view; v.selectedNoteIds = new Set(['music-note-1', 'music-note-4']);
  const p = point(v, 'music-note-1'), before = h.s.getDocument(), old = allNotes(h.s).map(clone);
  v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x + 45, p.y - 10));
  assert.equal(v.pointerGesture.kind, 'Move'); assert.equal(v.pointerGesture.invalid, false);
  assertNoDocumentChange(h, before); assert.equal(h.submitted.length, 0);
  assert(h.operations.some(op => op.kind === 'setLineDash' && op.args[0].join() === '4,2'));
  assert(h.operations.filter(op => op.kind === 'clip').length >= 2);
  const delta = { tick: v.pointerGesture.deltaTick, pitch: v.pointerGesture.deltaPitch };
  v.pointerUp(event(p.x + 45, p.y - 10)); assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].kind, 'MoveNotes'); assert.equal(h.s.getDocument().revision, 1);
  assert.equal(h.s.getDocument().history.entries.length, 1);
  for (const n of old) { assert.deepEqual(allNotes(h.s).find(next => next.id === n.id),
    ['music-note-1', 'music-note-4'].includes(n.id) ? { ...n, tick: n.tick + delta.tick, pitch: n.pitch + delta.pitch } : n); }
  assert.equal(h.captures.size, 0); assert.equal(v.pointerGesture, null);
});
check('R04 负音轨offset移动整组拒绝，ghost标红且不提交', () => {
  const project = clone(base); project.tracks[0].offsetMs = -900;
  const h = harness(project), v = h.view, before = h.s.getDocument();
  v.selectedNoteIds = new Set(['music-note-1', 'music-note-4']); const p = point(v, 'music-note-1');
  v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x - 8, p.y));
  assert.equal(v.pointerGesture.deltaTick, -120); assert.equal(v.pointerGesture.invalid, true);
  assert(h.operations.some(op => op.kind === 'fillRect' && op.fillStyle === '#d55c55'));
  v.pointerUp(event(p.x - 8, p.y)); assert.equal(h.submitted.length, 0); assertNoDocumentChange(h, before);
  assert.equal(v.selectedNoteIds.size, 2); assert.equal(v.pointerGesture, null);
});
check('R05 任一pitch/时间尾端越界不夹取、不部分提交或扩时长', () => {
  for (const move of [{ x: 10000, y: 0 }, { x: 0, y: -1500 }, { x: -10000, y: 0 }]) {
    const h = harness(), v = h.view, before = h.s.getDocument();
    v.selectedNoteIds = new Set(['music-note-1', 'music-note-4']); const p = point(v, 'music-note-1');
    v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x + move.x, p.y + move.y));
    assert.equal(v.pointerGesture.invalid, true); v.pointerUp(event(p.x + move.x, p.y + move.y));
    assert.equal(h.submitted.length, 0); assertNoDocumentChange(h, before);
  }
});
check('R06 框选与真实min5px noteRect交集，跨轨且不写history', () => {
  const project = clone(base); project.tracks[0].notes[0].durationTicks = 1;
  const h = harness(project), v = h.view, before = h.s.getDocument();
  const first = v.noteRects.find(r => r.noteId === 'music-note-1');
  const second = v.noteRects.find(r => r.noteId === 'music-note-4');
  assert.equal(first.width, 5);
  const x = first.x + 4.5, y = first.y - 2, right = second.x + second.width + 1, bottom = second.y + second.height + 1;
  assert(!v.noteRects.some(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height));
  const expected = v.noteRects.filter(r => r.x <= right && r.x + r.width >= x && r.y <= bottom && r.y + r.height >= y).map(r => r.noteId).sort();
  v.pointerDown(event(x, y)); v.pointerMove(event(right, bottom)); assert.equal(v.pointerGesture.kind, 'Marquee');
  v.pointerUp(event(right, bottom)); assert.deepEqual(selected(v), expected);
  assert(v.selectedNoteIds.has('music-note-1')); assert(v.selectedNoteIds.has('music-note-4')); assertNoDocumentChange(h, before);
});
check('R07 空白≤4px短点击添加，>4px框选不添加', () => {
  const h = harness(), v = h.view, plot = v.trackRects[0], x = plot.x + plot.width * 0.8, y = plot.y + 1;
  v.pointerDown(event(x, y)); v.pointerUp(event(x + 4, y)); assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].kind, 'AddNote'); assert.equal(v.selectedNoteIds.size, 1);
  const before = h.s.getDocument(); v.pointerDown(event(x + 70, y)); v.pointerUp(event(x + 75, y));
  assert.equal(h.submitted.length, 1); assertNoDocumentChange(h, before);
});
check('R08 Esc在ghost过程中取消并清空选择、anchor、capture且无事务', () => {
  const h = harness(), v = h.view; click(v, 'music-note-1'); const before = h.s.getDocument(), p = point(v, 'music-note-1');
  v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x + 30, p.y)); assert.equal(v.pointerGesture.kind, 'Move');
  assert(keys(v, 'Escape').defaultPrevented); assert.equal(v.pointerGesture, null);
  assert.equal(v.selectedNoteIds.size, 0); assert.equal(v.anchorNoteId, ''); assert.equal(h.captures.size, 0); assertNoDocumentChange(h, before);
  v.pointerUp(event(p.x + 30, p.y)); assertNoDocumentChange(h, before);
});
check('R09 blur/Pointer取消恢复原selection与anchor，清pointer目标且无提交', () => {
  const h = harness(), v = h.view; click(v, 'music-note-1'); const before = h.s.getDocument(), p = point(v, 'music-note-4');
  v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x + 30, p.y)); assert.deepEqual(selected(v), ['music-note-4']);
  v.blur(); assert.deepEqual(selected(v), ['music-note-1']); assert.equal(v.anchorNoteId, 'music-note-1');
  assert.equal(v.pointerPosition, null); assert.equal(v.pointerGesture, null); assertNoDocumentChange(h, before);
});
check('R10 Ctrl+A取消pending拖动并仅全选当前轨，不写history', () => {
  const h = harness(), v = h.view; click(v, 'music-note-4'); const p = point(v, 'music-note-4'), before = h.s.getDocument();
  v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x + 30, p.y)); keys(v, 'KeyA', { ctrlKey: true });
  assert.equal(v.pointerGesture, null); assert.deepEqual(selected(v), ['music-note-4', 'music-note-5', 'music-note-6']);
  assertNoDocumentChange(h, before); assert.equal(h.captures.size, 0);
});
check('R11 复制tick/ID稳定锚点、跨轨flatten目标轨、pointer统一位移与新ID选择', () => {
  const project = clone(base); project.tracks[0].notes[0].id = 'b-copy'; project.tracks[0].notes[0].pitch = 65;
  project.tracks[1].notes[0].id = 'a-copy'; project.tracks[1].notes[0].tick = 960; project.tracks[1].notes[0].pitch = 72;
  const h = harness(project), v = h.view; v.selectedNoteIds = new Set(['b-copy', 'a-copy']);
  v.copySelection(); assert.deepEqual(v.clipboard.map(n => n.id), ['a-copy', 'b-copy']);
  v.selectedTrackId = 'track-2'; const plot = v.trackRects[0], row = plot.height / (plot.maximumPitch - plot.minimumPitch + 1);
  v.pointerPosition = { x: plot.x + 3600 / project.durationTicks * plot.width, y: plot.y + (plot.maximumPitch - 70 + 0.5) * row };
  const metadata = clone(h.s.getDocument().project.tracks[1]); v.pasteSelection();
  assert.equal(h.submitted.length, 1); assert.equal(h.submitted[0].kind, 'PasteNotes'); assert.equal(h.submitted[0].trackId, 'track-2');
  assert.equal(h.s.getDocument().project.tracks[0].notes.length, 3);
  const pasted = h.s.getDocument().project.tracks[1].notes.filter(n => v.selectedNoteIds.has(n.id));
  assert.equal(pasted.length, 2); assert.deepEqual(pasted.map(n => n.tick), [3600, 3600]);
  assert.deepEqual(pasted.map(n => n.pitch), [70, 63]); assert(!pasted.some(n => ['a-copy', 'b-copy'].includes(n.id)));
  for (const [i, n] of pasted.entries()) { assert.deepEqual(n.position, v.clipboard[i].position); assert.equal(n.durationTicks, v.clipboard[i].durationTicks); assert.equal(n.velocity, v.clipboard[i].velocity); }
  const target = h.s.getDocument().project.tracks[1]; assert.deepEqual({ ...target, notes: [] }, { ...metadata, notes: [] });
  assert.equal(v.anchorNoteId, h.submitted[0].notes[0].id); assert.equal(h.s.getDocument().revision, 1);
});
check('R12 粘贴播放头fallback减目标轨offset并按分段tempo逆算/PPQ4吸附', () => {
  const project = clone(base); project.tempoMap = [{ tick: 0, bpm: 120 }, { tick: 960, bpm: 60 }]; project.tracks[1].offsetMs = 250;
  const h = harness(project), v = h.view; v.selectedNoteIds = new Set(['music-note-1', 'music-note-4']); v.copySelection();
  v.selectedTrackId = 'track-2'; v.pointerPosition = { x: 12, y: 12 }; v.audio.readTimeMs = () => 1500;
  v.pasteSelection(); const intent = h.submitted[0]; assert.equal(intent.kind, 'PasteNotes');
  assert.equal(intent.notes[0].tick, 1080); assert.equal(intent.notes[1].tick, 1320);
  assert.equal(intent.notes[0].pitch, 60); assert.equal(intent.notes[1].pitch, 72);
  assert.equal(h.s.getDocument().history.entries[0].label, 'PasteNotes');
});
check('R13 任一粘贴成员越界整体失败，selection/clipboard/历史保持', () => {
  const h = harness(), v = h.view; v.selectedNoteIds = new Set(['music-note-1', 'music-note-3']); v.copySelection();
  const before = h.s.getDocument(), ids = selected(v), clip = clone(v.clipboard), plot = v.trackRects[0];
  v.pointerPosition = { x: plot.x + plot.width, y: plot.y + plot.height / 2 }; v.pasteSelection();
  assertNoDocumentChange(h, before); assert.deepEqual(selected(v), ids); assert.deepEqual(v.clipboard, clip);
  assert.equal(h.elements.get('music-status').dataset.error, 'true');
});
check('R14 复制快照隔离、UI selection/anchor/clipboard/ghost零序列化', () => {
  const h = harness(), v = h.view; click(v, 'music-note-1'); const before = h.s.getDocument(); v.copySelection();
  assertNoDocumentChange(h, before); assert.notStrictEqual(v.clipboard[0].position, before.project.tracks[0].notes[0].position);
  const oldPitch = v.clipboard[0].pitch, oldPosition = clone(v.clipboard[0].position);
  const n = before.project.tracks[0].notes[0]; h.s.submitMusicEditorIntent({ kind: 'ChangeNote', trackId: 'track-1', noteId: n.id,
    note: { ...n, pitch: n.pitch + 1, position: { u: 0.5, v: 0.5 } } });
  assert.equal(v.clipboard[0].pitch, oldPitch); assert.deepEqual(v.clipboard[0].position, oldPosition);
  assert.deepEqual(Object.keys(h.s.getDocument()).sort(), ['documentId', 'history', 'project', 'revision', 'schemaVersion']);
  assert(!/selectedNoteIds|anchorNoteId|clipboard|pointerGesture|pointerPosition/.test(JSON.stringify(h.s.getDocument())));
});
check('R15 LoadDraft清selection/anchor/pointer/gesture，保留逻辑完整history', () => {
  const h = harness(), v = h.view; click(v, 'music-note-1'); const p = point(v, 'music-note-1');
  const n = allNotes(h.s)[0]; h.s.submitMusicEditorIntent({ kind: 'MoveNotes', noteIds: [n.id], deltaTick: 120, deltaPitch: 1 });
  v.refreshDocument(); const draft = clone(h.s.getDocument());
  v.pointerDown(event(p.x, p.y)); assert(v.pointerGesture); v.send({ kind: 'LoadDraft', document: draft });
  assert.equal(v.selectedNoteIds.size, 0); assert.equal(v.anchorNoteId, ''); assert.equal(v.pointerPosition, null);
  assert.equal(v.pointerGesture, null); assert.equal(h.captures.size, 0); assert.deepEqual(h.s.getDocument(), draft);
});
check('R16 Undo/Redo修剪新ID且不从历史重建selection，批量Delete一步恢复', () => {
  const h = harness(), v = h.view; v.selectedNoteIds = new Set(['music-note-1', 'music-note-4']); v.copySelection();
  v.audio.readTimeMs = () => 4000; v.pasteSelection(); const newIds = selected(v); assert.equal(newIds.length, 2);
  v.send({ kind: 'Undo' }); assert.equal(v.selectedNoteIds.size, 0); v.send({ kind: 'Redo' }); assert.equal(v.selectedNoteIds.size, 0);
  assert(newIds.every(id => allNotes(h.s).some(n => n.id === id)));
  v.selectedNoteIds = new Set(newIds); const before = h.s.getDocument().project; v.deleteSelected();
  assert.equal(h.s.getDocument().history.entries.at(-1).label, 'DeleteNotes'); assert.equal(v.selectedNoteIds.size, 0);
  v.send({ kind: 'Undo' }); assert.deepEqual(h.s.getDocument().project, before);
});
check('R17 input/textarea/select/contenteditable快捷键不抢，重复paste/delete隔离', () => {
  const h = harness(), v = h.view; click(v, 'music-note-1'); v.copySelection();
  for (const tag of ['input', 'textarea', 'select', 'div']) { for (const code of ['KeyA', 'KeyC', 'KeyV', 'KeyZ', 'Delete', 'Space', 'Escape']) {
    const before = h.s.getDocument(), ids = selected(v); const e = keys(v, code, { ctrlKey: true, target: new FakeElement(tag, true) });
    assert.equal(e.defaultPrevented, false); assertNoDocumentChange(h, before); assert.deepEqual(selected(v), ids);
  } }
  assert.equal(h.submitted.length, 0); keys(v, 'KeyV', { ctrlKey: true, repeat: true }); keys(v, 'Delete', { repeat: true });
  assert.equal(h.submitted.length, 0);
});
check('R18 teardown释放gesture/capture与监听，UI状态不可复活', () => {
  const h = harness(), v = h.view; click(v, 'music-note-1'); const p = point(v, 'music-note-1'), before = h.s.getDocument();
  v.pointerDown(event(p.x, p.y)); v.pointerMove(event(p.x + 30, p.y)); v.onDisable();
  assert.equal(v.pointerGesture, null); assert.equal(h.captures.size, 0); assert.equal(v.selectedNoteIds.size, 0);
  assert.equal(v.root, null); assert.equal(v.canvas, null); assert.equal(h.root.removed, true); assertNoDocumentChange(h, before);
  assert(removedListeners.some(args => args[0] === 'keydown' && args[1] === v.keyDown)); assert(removedListeners.some(args => args[0] === 'blur' && args[1] === v.blur));
});
check('R19 新batch历史同tick排序反转roundtrip，不依赖源数组顺序', () => {
  const project = clone(base); project.tracks[0].notes[1].tick = 1000;
  const s = session(project); s.submitMusicEditorIntent({ kind: 'MoveNotes', noteIds: ['music-note-2'], deltaTick: -160, deltaPitch: 2 });
  assert.equal(s.getDocument().project.tracks[0].notes[0].id, 'music-note-2');
  assert.deepEqual(parseMusicEditorDocument(clone(s.getDocument()), layout), s.getDocument());
  s.submitMusicEditorIntent({ kind: 'Undo' }); assert.equal(s.getDocument().project.tracks[0].notes[0].id, 'music-note-1');
});

const astFiles = fs.readdirSync(path.join(projectRoot, 'src/musicEditor')).filter(file => file.endsWith('.ts')).map(file => 'src/musicEditor/' + file)
  .concat(['src/presentation/MusicEditorView.ts']);
const astRecords = [];
check('R20 AST实际变更依赖图：逻辑零cc、无require/动态/副作用导入、presentation逻辑type-only', () => {
  for (const relative of astFiles) {
    const parsed = ts.createSourceFile(relative, fs.readFileSync(path.join(projectRoot, relative), 'utf8'), ts.ScriptTarget.Latest, true);
    const imports = [];
    function visit(node) {
      if (ts.isImportDeclaration(node)) {
        const target = node.moduleSpecifier.text, typeOnly = !!node.importClause?.isTypeOnly;
        imports.push({ target, typeOnly }); assert(node.importClause, relative + ': side-effect import');
        if (relative.startsWith('src/musicEditor/')) { assert(!/^(cc|cc\.env)$/.test(target), relative + ': engine import');
          assert(!/presentation|director|ledger/.test(target), relative + ': forbidden module'); if (target.includes('/editor/')) assert(typeOnly); }
        if (relative.startsWith('src/presentation/') && /\/musicEditor\/|\/editor\//.test(target)) assert(typeOnly, relative + ': value logic import');
      }
      if (ts.isImportEqualsDeclaration(node)) assert.fail(relative + ': import equals');
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) assert.fail(relative + ': re-export dependency requires explicit review');
      if (ts.isCallExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === 'require') || node.expression.kind === ts.SyntaxKind.ImportKeyword)) assert.fail(relative + ': require/dynamic import');
      ts.forEachChild(node, visit);
    }
    visit(parsed); astRecords.push({ file: relative, imports });
  }
});
check('R21 受保护契约/Builder/docs的基线SHA不变', () => {
  for (const entry of JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-hashes.json'), 'utf8'))) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(projectRoot, entry.path))).digest('hex');
    assert.equal(actual, entry.sha256, entry.path);
  }
});
const sourceHashes = Object.fromEntries(['src/musicEditor/MusicEditorSession.ts', 'src/presentation/MusicEditorView.ts'].map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(projectRoot, file))).digest('hex')]));
const summary = { reviewedAt: new Date().toISOString(), total: results.length, passed: results.filter(r => r.passed).length,
  failed: results.filter(r => !r.passed).length, sourceHashes,
  evidence: '真实TS View/Session + 最小cc/DOM/Canvas宿主的独立状态机测试；Creator交互截图及人工听感另列，非此测试证明范围',
  astRecords, results };
fs.writeFileSync(path.join(__dirname, 'independent-review-results.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2)); if (summary.failed) process.exitCode = 1;
