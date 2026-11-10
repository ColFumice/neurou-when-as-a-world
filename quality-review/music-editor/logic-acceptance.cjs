'use strict';
// 不写编译产物：用仓库 TypeScript 在内存中加载真实纯逻辑模块。
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ts = require('../../node_modules/typescript');
const projectRoot = path.resolve(__dirname,'../..');
require.extensions['.ts'] = (loaded, filename) => {
  const source = fs.readFileSync(filename,'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS, experimentalDecorators: true, isolatedModules: true } }).outputText;
  loaded._compile(compiled,filename);
};
const { createDefaultKeyboardPadLayout } = require('../../src/chart/KeyboardPadLayout.ts');
const { GuidanceEditorSession, parseChartSourceData } = require('../../src/editor/GuidanceEditorSession.ts');
const { createDefaultMusicProject, parseMusicProjectData } = require('../../src/musicEditor/MusicProjectData.ts');
const { MusicEditorSession, parseMusicEditorDocument } = require('../../src/musicEditor/MusicEditorSession.ts');
const { buildChartSource } = require('../../src/musicEditor/ChartSourceBuilder.ts');
const { tickToTimeMs, musicMeasureTicks, midiPitchToFrequency, timeMsToTick } = require('../../src/musicEditor/MusicTiming.ts');
const layout = createDefaultKeyboardPadLayout();
const base = createDefaultMusicProject(layout);
const clone = data => JSON.parse(JSON.stringify(data));
const results = [];
function check(name, verify) { try { verify(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error.stack || error) }); } }
function session(project = base) { const s = new MusicEditorSession(layout); s.submitMusicEditorIntent({kind:'LoadProject',project}); return s; }
function rejectsMutation(s, intent) { const before=s.getDocument(); assert.throws(()=>s.submitMusicEditorIntent(intent)); assert.strictEqual(s.getDocument(),before); }
function note(s, index = 0) { return s.getDocument().project.tracks[0].notes[index]; }
function edit(s, key, value) { const old=note(s); s.submitMusicEditorIntent({kind:'ChangeNote',trackId:'track-1',noteId:old.id,note:{...old,[key]:value}}); }

check('M01 默认工程加载、两轨与真实 Midi source → Guidance schema3',()=>{
  const s=session(), source=s.exportSource(), g=new GuidanceEditorSession(layout);
  assert.equal(source.provenance,'Midi'); assert.equal(source.events.length,6); assert.equal(s.getDocument().revision,0);
  assert.deepEqual(parseChartSourceData(source,layout),source);
  g.submitEditorIntent({kind:'LoadSource',source}); const { chart, visual }=g.exportChart();
  assert.equal(chart.schemaVersion,3); assert.equal(chart.lines.length,2); assert.equal(visual.nodes.length,4);
  assert.deepEqual(chart.lines.map(l=>l.head.targetTimeMs),[1000,1250]);
  assert.equal(chart.lines.reduce((sum,l)=>sum+l.nodes.length,0),4);
  assert.equal(musicMeasureTicks(base),1920); assert.equal(s.getDurationMs(),16000);
});
check('M02 放置、修改、删除音符保存显式位置/音高/力度/时值',()=>{
  const s=session(), n={...note(s),id:'added-note',tick:3840,pitch:72,velocity:100,position:{u:.45,v:.625}};
  s.submitMusicEditorIntent({kind:'AddNote',trackId:'track-1',note:n});
  assert.equal(s.getPlaybackNotes().length,7); assert.equal(s.exportSource().events.find(e=>e.id===n.id).pitch,72);
  s.submitMusicEditorIntent({kind:'ChangeNote',trackId:'track-1',noteId:n.id,note:{...n,tick:4320,durationTicks:360,velocity:88}});
  const emitted=s.exportSource().events.find(e=>e.id===n.id); assert.equal(emitted.timeMs,4500); assert.equal(emitted.endTimeMs,4875);
  assert.equal(emitted.velocity,88); assert.deepEqual(emitted.position,n.position);
  s.submitMusicEditorIntent({kind:'DeleteNote',trackId:'track-1',noteId:n.id});
  assert.equal(s.getPlaybackNotes().length,6); assert.equal(s.getDocument().revision,3);
});
check('M03 undo/redo、redo分支截断、无动作不增 revision',()=>{
  const s=session(); edit(s,'pitch',61); edit(s,'velocity',94);
  s.submitMusicEditorIntent({kind:'Undo'}); assert.equal(note(s).velocity,90); assert.equal(s.getDocument().revision,3);
  s.submitMusicEditorIntent({kind:'Redo'}); assert.equal(note(s).velocity,94); assert.equal(s.getDocument().revision,4);
  s.submitMusicEditorIntent({kind:'Undo'}); edit(s,'pitch',65); assert.equal(s.getDocument().history.entries.length,2);
  const d=s.getDocument(); s.submitMusicEditorIntent({kind:'Redo'}); assert.strictEqual(d,s.getDocument());
  edit(s,'pitch',65); assert.strictEqual(d,s.getDocument()); assert.match(s.exportSource().sourceRevision,/^revision-6-[0-9a-f]{16}$/);
});
check('M04 100步上限、全部撤销重做、草稿 restore',()=>{
  const s=session(); for(let i=0;i<105;i++) edit(s,'pitch',i%2?62:61);
  assert.equal(s.getDocument().history.entries.length,100); assert.equal(s.getDocument().revision,105);
  for(let i=0;i<100;i++) s.submitMusicEditorIntent({kind:'Undo'});
  assert.equal(s.getDocument().history.cursor,0); assert.equal(note(s).pitch,61);
  const restored=session(); restored.submitMusicEditorIntent({kind:'LoadDraft',document:clone(s.getDocument())});
  for(let i=0;i<100;i++) restored.submitMusicEditorIntent({kind:'Redo'});
  assert.equal(restored.getDocument().revision,305); assert.equal(note(restored).pitch,61);
});
check('M05 项目、布局、输入、历史、source、试听数据无可变引用泄漏',()=>{
  const mutable=clone(base), l=clone(layout), s=new MusicEditorSession(l);
  s.submitMusicEditorIntent({kind:'LoadProject',project:mutable}); mutable.tracks[0].notes[0].pitch=0; l.slots[0].u=.99;
  assert.equal(note(s).pitch,60); assert.notEqual(s.getLayout().slots[0].u,.99); assert.equal(Object.isFrozen(mutable),false);
  const added={...note(s),id:'mutable-note',tick:3840,position:{u:.5,v:.5}};
  s.submitMusicEditorIntent({kind:'AddNote',trackId:'track-1',note:added}); added.position.u=.1;
  assert.equal(s.getDocument().project.tracks[0].notes.find(n=>n.id===added.id).position.u,.5);
  assert.throws(()=>{s.getDocument().project.tracks[0].notes[0].position.u=0;});
  assert.throws(()=>{s.getDocument().history.entries[0].before.tracks[0].color.r=0;});
  assert.throws(()=>{s.getPlaybackNotes()[0].pitch=0;}); assert.throws(()=>{s.exportSource().events[0].color.r=0;});
  assert.throws(()=>{s.getLayout().slots[0].u=0;});
});
check('M06 分段 tempo 积分、轨道偏移、含延迟尾端的媒体时长',()=>{
  const p=clone(base); p.tempoMap=[{tick:0,bpm:120},{tick:960,bpm:60}]; p.tracks[1].offsetMs=250;
  const s=session(p), source=s.exportSource();
  assert.equal(tickToTimeMs(s.getDocument().project,1440),2000);
  assert.equal(source.events.find(e=>e.id==='music-note-4').timeMs,1750);
  assert.equal(source.events.find(e=>e.id==='music-note-4').endTimeMs,2250);
  assert.equal(source.mediaDurationMs,31250); assert.equal(s.getDurationMs(),31250);
  const negative=clone(base); negative.tracks[0].offsetMs=-1000;
  assert.equal(buildChartSource(negative,0,layout).events.find(e=>e.id==='music-note-1').timeMs,0);
  negative.tracks[0].offsetMs=-1001; assert.throws(()=>parseMusicProjectData(negative,layout));
});
check('M07 SetTempo 是常数 BPM 事务，undo 恢复完整 tempoMap',()=>{
  const p=clone(base); p.tempoMap=[{tick:0,bpm:120},{tick:960,bpm:60}]; const s=session(p);
  s.submitMusicEditorIntent({kind:'SetTempo',bpm:240}); assert.equal(s.getDocument().project.tempoMap.length,1);
  assert.equal(s.exportSource().events[0].timeMs,500); s.submitMusicEditorIntent({kind:'Undo'});
  assert.deepEqual(s.getDocument().project.tempoMap,p.tempoMap);
});
check('M08 未知键/危险ID/重复ID/非整数/NaN/Infinity/越界/时间签名严格拒绝',()=>{
  const mutations=[
    p=>{p.unknown=1;},p=>{p.schemaVersion=2;},p=>{p.projectId='__proto__';},p=>{p.tracks[0].id='constructor';},
    p=>{p.ppq=0;},p=>{p.ppq=1.1;},p=>{p.tempoMap[0].bpm=Infinity;},p=>{p.tempoMap[0].bpm=0;},
    p=>{p.tempoMap=[{tick:1,bpm:120}];},p=>{p.tempoMap.push({tick:0,bpm:100});},p=>{p.timeSignature.denominator=3;},
    p=>{p.durationTicks=NaN;},p=>{p.tracks[0].offsetMs=Infinity;},p=>{p.tracks[0].notes[0].tick=-1;},
    p=>{p.tracks[0].notes[0].durationTicks=0;},p=>{p.tracks[0].notes[0].durationTicks=20000;},
    p=>{p.tracks[0].notes[0].pitch=128;},p=>{p.tracks[0].notes[0].velocity=1.2;},
    p=>{p.tracks[0].notes[0].position.u=2;},p=>{p.tracks[0].notes[0].position.color='red';},
    p=>{p.tracks[0].color.r=1.1;},p=>{p.layoutVersion='other-layout';},
    p=>{p.tracks[1].id=p.tracks[0].id;},p=>{p.tracks[1].notes[0].id=p.tracks[0].notes[0].id;},
    p=>{p[Symbol('extra')]=1;},p=>{p.tracks[0].notes[0].pitch=Number.MAX_SAFE_INTEGER+1;},
    p=>{p.mappingVersion='unknown-mapping';},p=>{p.durationTicks=p.ppq*4096+1;},
  ];
  mutations.forEach(change=>{const p=clone(base);change(p);assert.throws(()=>parseMusicProjectData(p,layout));});
  const inherited=Object.create(base);assert.throws(()=>parseMusicProjectData(inherited,layout));
});
check('M09 失败事务保留项目/历史/版本，LoadDraft和LoadProject失败也原子',()=>{
  const s=session(); edit(s,'pitch',61);
  rejectsMutation(s,{kind:'AddNote',trackId:'track-1',note:note(s)});
  rejectsMutation(s,{kind:'AddNote',trackId:'missing-track',note:{...note(s),id:'new-id'}});
  rejectsMutation(s,{kind:'ChangeNote',trackId:'track-1',noteId:note(s).id,note:{...note(s),pitch:128}});
  rejectsMutation(s,{kind:'ChangeNote',trackId:'track-1',noteId:note(s).id,note:{...note(s),id:'renamed'}});
  rejectsMutation(s,{kind:'DeleteNote',trackId:'track-1',noteId:'missing-note'});
  rejectsMutation(s,{kind:'SetTempo',bpm:NaN}); rejectsMutation(s,{kind:'LoadProject',project:{}});
  rejectsMutation(s,{kind:'LoadDraft',document:{}});
});
check('M10 restore 严格历史链/游标/标签事务/身份/revision/未知字段校验',()=>{
  const s=session();edit(s,'pitch',61);edit(s,'velocity',99);const good=clone(s.getDocument());
  assert.deepEqual(parseMusicEditorDocument(good,layout),s.getDocument());
  const mutations=[
    d=>{d.unknown=1;},d=>{d.history.cursor=3;},d=>{d.history.cursor=.5;},d=>{d.revision=0;},
    d=>{d.history.entries[1].before.tracks[0].notes[0].pitch=66;},d=>{d.project.tracks[0].notes[0].pitch=67;},
    d=>{d.history.entries[0].after.projectId='other';},d=>{d.history.entries[0].label='DeleteNote';},
    d=>{d.history.entries[0].label='LoadProject';},d=>{d.history.entries[0].after.title='forged title';},
    d=>{d.history.entries[0].before.tracks[0].lineId='forged-line';},
    d=>{d.history.entries[0].after=d.history.entries[0].before;},
  ];
  mutations.forEach(change=>{const d=clone(good);change(d);assert.throws(()=>parseMusicEditorDocument(d,layout));});
});
check('M11 编辑草稿容许未满足发布条件，试听独立，export 不补点、不丢音',()=>{
  const s=session();s.submitMusicEditorIntent({kind:'DeleteNote',trackId:'track-1',noteId:note(s,2).id});
  s.submitMusicEditorIntent({kind:'DeleteNote',trackId:'track-1',noteId:note(s,1).id});
  assert.equal(s.getPlaybackNotes().length,4);const d=s.getDocument();assert.throws(()=>s.exportSource());assert.strictEqual(d,s.getDocument());
  for (const mutate of [
    p=>{p.tracks[0].notes.forEach(n=>{n.position={u:.1,v:.375};});},
    p=>{p.tracks[0].notes[0].position.u=1;},
    p=>{p.tracks[0].notes[1].tick=p.tracks[0].notes[0].tick;},
    p=>{p.tracks[0].notes[2].tick=p.tracks[0].notes[1].tick;},
  ]) { const p=clone(base);mutate(p);const x=session(p);assert.equal(x.getPlaybackNotes().length,6);assert.throws(()=>x.exportSource()); }
});
check('M12 合法的非首同刻同位重复音完整保留并被 Guidance 消费',()=>{
  const p=clone(base), n=p.tracks[0].notes[1];p.tracks[0].notes.push({...clone(n),id:'chord-note',pitch:67});
  const s=session(p), source=s.exportSource(), g=new GuidanceEditorSession(layout);
  assert.equal(source.events.length,7);g.submitEditorIntent({kind:'LoadSource',source});
  assert.equal(g.exportChart().chart.lines.reduce((sum,l)=>sum+l.nodes.length,0),5);
});
check('M13 ColorMusic 纯音高数学 A4/C4、拍号分母语义',()=>{
  assert.equal(midiPitchToFrequency(69),440);assert(Math.abs(midiPitchToFrequency(60)-261.625565)<.00001);
  assert.throws(()=>midiPitchToFrequency(128));const p=clone(base);p.timeSignature={numerator:6,denominator:8};
  assert.equal(musicMeasureTicks(parseMusicProjectData(p,layout)),1440);
});
check('M14 musicEditor 不含 cc / presentation / director / ledger 运行时依赖',()=>{
  const files=fs.readdirSync(path.join(projectRoot,'src/musicEditor')).filter(f=>f.endsWith('.ts'));
  for (const filename of files) { const source=fs.readFileSync(path.join(projectRoot,'src/musicEditor',filename),'utf8');
    const parsed=ts.createSourceFile(filename,source,ts.ScriptTarget.ES2020,true);
    for (const statement of parsed.statements) { if (!ts.isImportDeclaration(statement)) continue;
      const target=statement.moduleSpecifier.text; assert(!/^(cc|cc\.env)$/.test(target));assert(!/(presentation|director|ledger)/.test(target));
      if (target.includes('/editor/')) assert(statement.importClause.isTypeOnly);
    }
  }
});
check('M15 稳定快照校验和区分同 revision 不同内容、undo保留版本身份',()=>{
  const a=session(), b=session(), first=a.exportSource().sourceRevision;
  assert.equal(first,b.exportSource().sourceRevision); const changed=clone(base); changed.tracks[0].notes[0].pitch=65;
  b.submitMusicEditorIntent({kind:'LoadProject',project:changed}); assert.notEqual(first,b.exportSource().sourceRevision);
  edit(a,'pitch',61);a.submitMusicEditorIntent({kind:'Undo'});const undone=a.exportSource().sourceRevision;
  assert.notEqual(first,undone);assert.equal(first.split('-').pop(),undone.split('-').pop());
});
check('M16 小节首拍强调保留拍位，不受轨道 offset 影响',()=>{
  const p=clone(base);p.tracks[0].offsetMs=250;const source=buildChartSource(p,0,layout);
  assert.equal(source.events.find(e=>e.id==='music-note-2').emphasis,true);
  assert.equal(source.events.find(e=>e.id==='music-note-1').emphasis,false);
  p.timeSignature={numerator:6,denominator:8};p.tracks[0].notes[1].tick=1440;
  assert.equal(buildChartSource(p,0,layout).events.find(e=>e.id==='music-note-2').emphasis,true);
});
check('M17 分段 BPM 时间轴逆换算和正偏移尾段钳制',()=>{
  const p=clone(base);p.tempoMap=[{tick:0,bpm:120},{tick:960,bpm:60}];p.tracks[1].offsetMs=250;
  const s=session(p);assert.equal(s.getTickAtTimeMs(0),0);assert.equal(s.getTickAtTimeMs(500),480);
  assert.equal(s.getTickAtTimeMs(1000),960);assert.equal(s.getTickAtTimeMs(1500),1200);
  assert.equal(s.getTickAtTimeMs(31250),15360);assert.equal(s.getTickAtTimeMs(999999),15360);
  for (const tick of [0,240,960,1440,15360]) assert(Math.abs(timeMsToTick(s.getDocument().project,tickToTimeMs(s.getDocument().project,tick))-tick)<1e-8);
  assert.throws(()=>s.getTickAtTimeMs(-1));assert.throws(()=>s.getTickAtTimeMs(NaN));
});
check('M18 导出拒绝 aspectRatio 路径长度下溢/无穷，保留草稿与试听',()=>{
  const small=clone(base);small.aspectRatio=Number.MIN_VALUE;const s=session(small);
  assert.equal(s.getPlaybackNotes().length,6);assert.throws(()=>s.exportSource());
  const huge=clone(base);huge.aspectRatio=Number.MAX_VALUE;assert.throws(()=>parseMusicProjectData(huge,layout));
  const invalid=clone(base);invalid.aspectRatio=Infinity;assert.throws(()=>parseMusicProjectData(invalid,layout));
});
const summary={ total:results.length, passed:results.filter(r=>r.passed).length, failed:results.filter(r=>!r.passed).length,
  evidence:'真实 TypeScript 模块 → MusicEditorSession → buildChartSource → GuidanceEditorSession → schemaVersion=3',results };
fs.writeFileSync(path.join(__dirname,'logic-results.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
