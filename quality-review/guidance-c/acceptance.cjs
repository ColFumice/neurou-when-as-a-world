const fs=require('fs'),assert=require('assert/strict'),ts=require('../../node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText,f);
const {ChartPremiere,CHART_MEDIA_END_TIMEOUT_MS}=require('../../src/chart/ChartPremiere.ts');
const {parseGuidanceChart}=require('../../src/chart/GuidanceChart.ts');
const {GuidanceChartRuntime}=require('../../src/chart/GuidanceChartRuntime.ts');
const {createDefaultKeyboardPadLayout}=require('../../src/chart/KeyboardPadLayout.ts');
const checks=[];function test(name,run){try{checks.push({name,pass:true,evidence:run()??null});}catch(e){checks.push({name,pass:false,error:e.stack});}}
const layout={layoutVersion:'c-test',slots:[{keyId:'KeyA',padKind:'Regular',u:0,v:0.4,width:1,height:0.4}]};
const tap=(id,d=.375)=>({id,kind:'Tap',pathDistance:d});
const drag=(id,d=.375)=>({id,kind:'Drag',pathDistance:d,keyId:'KeyA'});
const hold=(id,d=.375,end=.75)=>({id,kind:'Hold',pathDistance:d,endPathDistance:end,keyId:'KeyA'});
const line=(id,nodes=[tap(id+'-tap')],spawn=1000)=>({id,head:{id:id+'-head',spawnTimeMs:spawn},path:{kind:'Polyline',points:[{u:.1,v:.5},{u:.9,v:.5}]},speed:.125,nodes});
const raw=(lines=[line('a'),line('b')])=>({schemaVersion:2,chartId:'c-test',tier:'Regular',layoutVersion:layout.layoutVersion,aspectRatio:1,lines});
function make(lines){const p=new ChartPremiere(parseGuidanceChart(raw(lines),layout),layout);p.begin();return p;}
function edge(p,k,t,phase='Down'){p.submitStrike({keyId:k,videoTimeMs:t,phase});}
function start(p,t=1000){edge(p,'Space',t);edge(p,'Space',t,'Up');edge(p,'Space',t);edge(p,'Space',t,'Up');}
const ss=p=>p.getGuidanceSnapshots();const tiers=p=>ss(p).map(l=>l.nodes.map(n=>n.tier));

test('01 v1/v2 parser, no hard upper limit, global IDs, deep freeze and strict fields',()=>{
  const one=raw([line('a')]);one.schemaVersion=1;assert.equal(parseGuidanceChart(one,layout).lines.length,1);
  assert.throws(()=>parseGuidanceChart({...raw(),schemaVersion:1},layout));
  for(const schemaVersion of [1,2,3])assert.throws(()=>parseGuidanceChart({...raw([]),schemaVersion},layout));
  const source=raw([line('a'),line('b'),line('c')]);const parsed=parseGuidanceChart(source,layout);assert.equal(parsed.lines.length,3);
  const freeze=v=>{if(v&&typeof v==='object'){assert.ok(Object.isFrozen(v));Object.values(v).forEach(freeze);}};freeze(parsed);
  source.lines[0].speed=100;assert.equal(parsed.lines[0].speed,.125);
  const bad=raw();bad.lines[1].nodes[0].id='a-head';assert.throws(()=>parseGuidanceChart(bad,layout));
  const unknown=raw();unknown.lines[1].clock={};assert.throws(()=>parseGuidanceChart(unknown,layout));
  return {v1:1,v2:3,deepFrozen:true,globalUniqueIds:true};
});
test('02 overlapping heads: spawn then line ID; fresh Space starts exactly one; early/repeated input rejected',()=>{
  const p=make([line('z',undefined,1000),line('a',undefined,1000)]);edge(p,'Space',900);edge(p,'Space',1000);assert.ok(ss(p).every(s=>s.startedAtMs===null));
  edge(p,'Space',1000,'Up');edge(p,'Space',1000);assert.deepEqual(ss(p).map(s=>s.startedAtMs),[null,1000]);
  edge(p,'Space',1001);assert.deepEqual(ss(p).map(s=>s.startedAtMs),[null,1000]);
  edge(p,'Space',1020,'Up');edge(p,'Space',1020);assert.deepEqual(ss(p).map(s=>s.startedAtMs),[1020,1000]);
  const q=make([line('a',undefined,1100),line('z',undefined,1000)]);start(q,1100);assert.deepEqual(ss(q).map(s=>s.startedAtMs),[1100,1100]);
  return ss(p).map(s=>({id:s.id,startedAtMs:s.startedAtMs}));
});
test('03 simultaneous Tap collision consumes one; array order irrelevant; repeat and wrong key cannot consume',()=>{
  const p=make([line('z'),line('a')]);start(p);edge(p,'KeyA',4000);assert.deepEqual(tiers(p),[[null],['Perfect']]);
  edge(p,'KeyA',4000);assert.equal(p.getResolvedCount(),1);edge(p,'KeyA',4001,'Up');edge(p,'KeyA',4002);assert.deepEqual(tiers(p),[['Perfect'],['Perfect']]);
  return {firstWinner:'a',resolvedAfterRepeat:1,totalResolved:p.getResolvedCount()};
});
test('04 Tap ordering: absolute delta -> target time -> line ID -> node ID',()=>{
  const q=make([line('a',[tap('a-tap',.3828125)]),line('z',[tap('z-tap',.3671875)])]);start(q);edge(q,'KeyA',4000);assert.deepEqual(tiers(q),[[null],['Good']]);
  const p=make([line('a',[tap('z-node'),tap('a-node')]),line('b',[tap('b-node',.380859375)])]);start(p);edge(p,'KeyA',4049);assert.deepEqual(tiers(p),[[null,null],['Perfect']]);
  edge(p,'KeyA',4050,'Up');edge(p,'KeyA',4051);assert.equal(ss(p)[0].nodes.find(n=>n.node.id==='a-node').tier,'Good');
  return {earlierTarget:'z',nearestTarget:'b',sameLineTie:'a-node'};
});
test('05 shared held key: two Drag plus two Hold independently succeed, while Tap consumes once',()=>{
  const p=make([line('a',[drag('ad'),hold('ah'),tap('at')]),line('b',[drag('bd'),hold('bh'),tap('bt')])]);start(p);edge(p,'KeyA',4000);
  assert.equal(p.getPerfectCount(),3);assert.equal(p.getResolvedCount(),3);assert.ok(ss(p).every(s=>s.nodes.find(n=>n.node.kind==='Hold').holdActive));
  edge(p,'KeyA',7000,'Up');assert.equal(p.getPerfectCount(),5);assert.equal(p.getMissCount(),1);
  return {atDown:{dragPerfect:2,tapPerfect:1},atTail:{holdPerfect:2,unconsumedTapMiss:1}};
});
test('06 exact boundaries: Up at Drag arrival fails, Up at Hold tail succeeds; both lines and frame jumps',()=>{
  const p=make([line('a',[drag('ad'),hold('ah',.125,.375)]),line('b',[drag('bd'),hold('bh',.125,.375)])]);start(p);edge(p,'KeyA',2000);edge(p,'KeyA',4000,'Up');
  for(const s of ss(p)){assert.equal(s.nodes.find(n=>n.node.kind==='Drag').tier,'Miss');assert.equal(s.nodes.find(n=>n.node.kind==='Hold').tier,'Perfect');}
  const q=make([line('a',[hold('ah')]),line('b',[hold('bh')])]);start(q);edge(q,'KeyA',3900);q.advance(8000);assert.equal(q.getPerfectCount(),2);
  return {dragAtUp:'Miss',holdAtTailUp:'Perfect',frameJumpHoldCount:2};
});
test('07 independent Head timeout settles only its nodes; remaining line completes; media gates completion',()=>{
  const p=make([line('a',[tap('at',.125)],0),line('b',[tap('bt',.125)],1000)]);edge(p,'Space',1000);p.advance(1001);
  assert.equal(ss(p)[1].state,'Waiting');edge(p,'Space',1001,'Up');edge(p,'KeyA',2000);p.advance(9000);
  assert.equal(p.getPerfectCount(),1);assert.equal(p.getMissCount(),1);assert.equal(ss(p)[1].state,'TimedOut');assert.equal(p.getState(),'Playing');
  p.advanceMediaStatus(true,false,0);assert.equal(p.getState(),'Completed');assert.equal(p.getResult().completed,true);
  const q=make([line('a',[tap('at',.125)],0),line('b',[tap('bt',.125)],5000)]);q.advance(1001);q.advanceMediaStatus(true,false,0);assert.equal(q.getState(),'Playing');q.advance(6001);assert.equal(q.getState(),'Completed');
  return {normalAndTimeout:tiers(p),earlyMediaWaitsForFutureHead:true};
});
test('08 two-line pause freezes all snapshots; paused Up locks both Holds; exit/reopen resets everything',()=>{
  const p=make([line('a',[hold('ah')]),line('b',[hold('bh')])]);start(p);edge(p,'KeyA',3900);p.advance(4100);p.togglePause(4100);
  const before=ss(p);p.advance(9000);edge(p,'KeyA',9000);assert.deepEqual(ss(p),before);p.advanceMediaStatus(true,true,90000);assert.equal(p.getState(),'Paused');
  edge(p,'KeyA',4100,'Up');assert.deepEqual(ss(p),before);p.togglePause(4100);edge(p,'KeyA',4200);p.advance(7000);assert.equal(p.getMissCount(),2);
  p.requestExit(7000);assert.ok(ss(p).every(s=>s.state==='Exited'));p.reopen();assert.equal(p.getState(),'Ready');assert.equal(p.getTotalScore(),0);assert.ok(ss(p).every(s=>s.startedAtMs===null&&s.judgmentPoint===null&&s.nodes.every(n=>n.tier===null)));
  p.begin();start(p);edge(p,'KeyA',3900);p.advance(7000);assert.equal(p.getPerfectCount(),2);assert.equal(p.getState(),'Playing');
  return {frozenLines:2,interruptedHolds:2,reentryPerfect:2,mediaFlagCleared:true};
});
test('09 cross/overlap erasure and independent path progress do not affect input mapping at two resolutions',()=>{
  const a=line('a',[tap('at',.25)]),b=line('b',[tap('bt',.25)]);a.path.points=[{u:.1,v:.4},{u:.9,v:.8}];b.path.points=[{u:.1,v:.8},{u:.9,v:.4}];
  const samples=[];for(const [width,height] of [[1920,1080],[2560,1440]]){const p=make([a,b]);edge(p,'Space',1000);edge(p,'Space',1100,'Up');edge(p,'Space',1100);p.advance(2000);const s=ss(p);
    assert.equal(s[0].judgmentPoint.pathDistance,.125);assert.equal(s[1].judgmentPoint.pathDistance,.1125);assert.notDeepEqual(s[0].remainingPoints,s[1].remainingPoints);
    for(const l of s)assert.deepEqual(l.remainingPoints[0],l.judgmentPoint.position);edge(p,'KeyA',3000);edge(p,'KeyA',3001,'Up');edge(p,'KeyA',3100);p.advance(11000);
    samples.push({resolution:[width,height],tiers:tiers(p),score:p.getTotalScore(),progress:s.map(l=>l.judgmentPoint.pathDistance),snapshots:ss(p)});
  }assert.deepEqual({...samples[0],resolution:null},{...samples[1],resolution:null});return samples.map(({snapshots,...s})=>s);
});
test('10 wrong key, stale and nonfinite input ignored globally; immutable snapshot arrays',()=>{
  const p=make();start(p);edge(p,'KeyA',3900,'Up');const before=ss(p);edge(p,'KeyA',3800);edge(p,'KeyA',NaN);edge(p,'KeyZ',4000);assert.deepEqual(ss(p),before);
  assert.ok(Object.isFrozen(ss(p)));assert.ok(ss(p).every(Object.isFrozen));return {staleIgnored:true,unknownKeyIgnored:true};
});
test('11 existing media-unavailable fallback remains gated by all lines settled',()=>{
  const p=make();p.advance(2001);assert.equal(p.getMissCount(),2);p.advanceMediaStatus(false,true,CHART_MEDIA_END_TIMEOUT_MS-1);assert.equal(p.getState(),'Playing');p.advanceMediaStatus(false,true,1);assert.equal(p.getState(),'Completed');return {fallbackMs:CHART_MEDIA_END_TIMEOUT_MS};
});
test('12 C resource has two independent paths and mixed node kinds; third line runtime supported',()=>{
  const resource=JSON.parse(fs.readFileSync('assets/resources/chart/guidance_c.json','utf8'));const chart=parseGuidanceChart(resource,createDefaultKeyboardPadLayout());assert.equal(chart.lines.length,2);assert.notDeepEqual(chart.lines[0].path,chart.lines[1].path);
  const r=new GuidanceChartRuntime(parseGuidanceChart(raw([line('a'),line('b'),line('c')]),layout),layout);for(let i=0;i<3;i++){r.submitStrike({keyId:'Space',videoTimeMs:1000});r.submitStrike({keyId:'Space',videoTimeMs:1000,phase:'Up'});}assert.ok(r.getGuidanceSnapshots().every(s=>s.state==='Running'));return {chartId:chart.chartId,lines:chart.lines.length,thirdLineSupported:true};
});

const {DirectorSession}=require('../../src/director/IntentPort.ts');
const {Protagonist}=require('../../src/character/Protagonist.ts');
const {DeepTrace}=require('../../src/trace/DeepTrace.ts');
const {PuzzleChain}=require('../../src/trace/PuzzleChain.ts');
const {PuzzleProgress}=require('../../src/trace/PuzzleProgress.ts');
function directorFixture() {
  const p = make(); p.requestExit(0); p.reopen(); const director = new DirectorSession();
  const chain = new PuzzleChain(new PuzzleProgress()); let beat = 0, rhythm = null, mediaTime = -1, ended = false;
  director.bindProtagonist(new Protagonist({ lateral: 0, depth: 0 })); director.bindMapCenter({ lateral: 0, depth: 0 }); director.bindPuzzleChain(chain); director.bindDeepTrace(new DeepTrace({ lateral: 0, depth: 0 }));
  director.bindScreenProjectionProbe(() => ({ x: 0.5, y: 0.5 })); director.bindBeatClockProbe(() => beat); director.bindRhythmStrikeProbe(() => rhythm);
  director.bindChartPremiere(p); director.bindChartClockProbe(() => mediaTime); director.bindChartMediaProbe(() => ({ ended, unavailable: false })); director.submitFrameIntents([], 0.016);
  for (beat = 0; beat < 7000; beat += 1000) { rhythm = { strikeTimeMs: beat, targetBeatTimeMs: beat }; director.submitFrameIntents([{ kind: 'Strike', videoTimeMs: beat }], 0.016); }
  director.submitFrameIntents([], 0.016); assert.equal(director.getLedgerEvents().length, 1);
  const frame = (time, intents = []) => { mediaTime = time; director.submitFrameIntents(intents, 0.016); };
  return { p, director, frame, setMediaTime: time => { mediaTime = time; }, setEnded: value => { ended = value; } };
}

function withCocosEventStub(run) {
  const Module = require('module'), originalLoad = Module._load, originalWindow = global.window, handlers = new Map();
  const input = { on(e, callback, context) { const a = handlers.get(e) ?? []; a.push({ callback, context }); handlers.set(e, a); }, off(e, cb, context) { handlers.set(e, (handlers.get(e) ?? []).filter(i => i.callback !== cb || i.context !== context)); }, emit(e, keyCode) { for (const i of handlers.get(e) ?? []) i.callback.call(i.context, { keyCode }); } };
  const cc = { _decorator: { ccclass: () => target => target }, Component: class {}, input, Input: { EventType: { KEY_DOWN: 'down', KEY_UP: 'up', MOUSE_WHEEL: 'wheel' } } };
  global.window = { addEventListener() {}, removeEventListener() {} }; Module._load = function (r, parent, main) { return r === 'cc' ? cc : originalLoad.call(this, r, parent, main); };
  const filenames = [require.resolve('../../src/presentation/InputCollector.ts'), require.resolve('../../src/presentation/FrameDriver.ts')]; filenames.forEach(f => { delete require.cache[f]; });
  try { const { InputCollector } = require('../../src/presentation/InputCollector.ts'); const { FrameDriver } = require('../../src/presentation/FrameDriver.ts'); return run({ InputCollector, FrameDriver, input }); }
  finally { Module._load = originalLoad; filenames.forEach(f => { delete require.cache[f]; }); if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
}


test('13 full T6 endpoint -> two-line chart -> early exit/reentry -> media completion: director appends exactly once',()=>{
  const {p,director,frame,setEnded}=directorFixture();
  frame(0,[{kind:'EnterChart'}]);frame(1000,[{kind:'Strike',keyId:'Space',videoTimeMs:1000},{kind:'Strike',keyId:'Space',videoTimeMs:1000,phase:'Up'},{kind:'Strike',keyId:'Space',videoTimeMs:1000}]);
  assert.ok(ss(p).every(s=>s.startedAtMs===1000));frame(2000,[{kind:'ExitChart'}]);assert.equal(director.getLedgerEvents().length,1);
  frame(-1,[{kind:'EnterChart'}]);frame(0);frame(1000,[{kind:'Strike',keyId:'Space',videoTimeMs:1000},{kind:'Strike',keyId:'Space',videoTimeMs:1000,phase:'Up'},{kind:'Strike',keyId:'Space',videoTimeMs:1000}]);
  frame(4000,[{kind:'Strike',keyId:'KeyA',videoTimeMs:4000}]);assert.equal(p.getResolvedCount(),1);
  frame(4002,[{kind:'Strike',keyId:'KeyA',videoTimeMs:4001,phase:'Up'},{kind:'Strike',keyId:'KeyA',videoTimeMs:4002}]);assert.equal(p.getPerfectCount(),2);
  frame(10000);assert.equal(p.getState(),'Playing');assert.equal(director.getLedgerEvents().length,1);
  setEnded(true);frame(12000);assert.equal(p.getState(),'Exited');assert.equal(p.getResult().completed,true);assert.equal(director.getLedgerEvents().length,2);frame(12000);assert.equal(director.getLedgerEvents().length,2);
  return {endpointRecords:1,earlyExitRecords:0,completedRecords:1,multiLinePerfect:2};
});
test('14 live collector/frame-driver classes preserve cross-line arbitration and timestamped edges',()=>withCocosEventStub(({InputCollector,FrameDriver,input})=>{
  const {p,director,frame,setMediaTime}=directorFixture();frame(0,[{kind:'EnterChart'}]);
  let time=1000;const collector=new InputCollector();collector.bindChartStateProvider(()=>director.getChartPlaybackState());collector.bindChartTimeProbe(()=>time);collector.onEnable();
  const driver=new FrameDriver();driver.onLoad();driver.bindWiring(collector,director);
  try {input.emit('down',32);input.emit('up',32);time=1020;input.emit('down',32);input.emit('up',32);setMediaTime(1100);driver.update(.016);assert.deepEqual(ss(p).map(s=>s.startedAtMs),[1000,1020]);
    time=4000;input.emit('down',65);setMediaTime(4005);driver.update(.016);assert.equal(p.getResolvedCount(),1);assert.deepEqual(tiers(p),[['Perfect'],[null]]);
    time=4020;input.emit('up',65);time=4021;input.emit('down',65);setMediaTime(4100);driver.update(.016);assert.equal(p.getPerfectCount(),2);
    return {headStartTimes:[1000,1020],oneTapPerDown:true,secondDownResolvedOtherLine:true,cc:'event-bus stub only'};
  } finally {collector.onDisable();driver.onDestroy();}
}));

const report={passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks};fs.writeFileSync(__dirname+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
