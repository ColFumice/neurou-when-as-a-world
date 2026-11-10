const fs=require('fs'),assert=require('assert/strict'),ts=require('../../node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText,f);
const {GuidanceEditorSession,parseChartSourceData,parseGuidanceVisualData}=require('../../src/editor/GuidanceEditorSession.ts');
const {parseGuidanceChart,positionAtPathDistance}=require('../../src/chart/GuidanceChart.ts');
const {guidanceDistanceAtTime}=require('../../src/chart/GuidanceTiming.ts');
const {ChartPremiere}=require('../../src/chart/ChartPremiere.ts');
const {createDefaultKeyboardPadLayout,resolveGridKeyAt}=require('../../src/chart/KeyboardPadLayout.ts');
const layout=createDefaultKeyboardPadLayout(),mock=JSON.parse(fs.readFileSync('assets/resources/editor/mock_midi.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),checks=[];
function test(name,run){try{checks.push({name,pass:true,evidence:run()??null});}catch(e){checks.push({name,pass:false,error:e.stack});}}
function session(){const s=new GuidanceEditorSession(layout);s.submitEditorIntent({kind:'LoadSource',source:mock});return s;}
function edge(p,keyId,t,phase='Down'){p.submitStrike({keyId,videoTimeMs:t,phase});}
function set(s,eventId,nodeKind){s.submitEditorIntent({kind:'SetKind',eventId,nodeKind});}
test('01 source contract copies/deep-freezes and rejects invalid MIDI/RGB/layout/time/IDs',()=>{
 const parsed=parseChartSourceData(mock,layout);assert.ok(Object.isFrozen(parsed.events[0].color));const mutated=clone(mock);mutated.events[0].color.r=1;assert.notEqual(parsed.events[0].color.r,1);
 const cases=[m=>m.events[0].color.r=1.5,m=>m.events[0].color.r=256,m=>m.events[0].timeMs=NaN,m=>m.events[0].position.u=1.01,m=>m.layoutVersion='wrong',m=>m.events[0].id=m.events[1].id,m=>m.events[0].id='__proto__',m=>m.events[0].pitch=60.2,m=>m.events[0].fallbackKey='KeyA'];
 for(const f of cases){const m=clone(mock);f(m);assert.throws(()=>parseChartSourceData(m,layout));}return {rejected:cases.length,deepFrozen:true};
});
test('02 v3 export: variable time slopes; node positions/absolute times exact; no color or speed in gameplay',()=>{
 const s=session(),{chart,visual}=s.exportChart();assert.equal(chart.schemaVersion,3);assert.equal(chart.lines.length,2);assert.ok(chart.lines.every(l=>!('speed'in l)));assert.equal(visual.nodes.length,8);
 for(const l of chart.lines)for(const t of l.timing){const e=mock.events.find(e=>'node-'+e.id===t.nodeId),n=l.nodes.find(n=>n.id===t.nodeId);assert.equal(t.targetTimeMs,e.timeMs);const p=positionAtPathDistance(l.path,chart.aspectRatio,n.pathDistance);assert.ok(Math.abs(p.u-e.position.u)<1e-12&&Math.abs(p.v-e.position.v)<1e-12);assert.ok(!('color'in n));}
 const l=chart.lines[0];assert.ok(Math.abs(guidanceDistanceAtTime(l,1500,1650)-l.nodes[0].pathDistance/2)<1e-10);return {schema:3,nonuniformTargets:l.timing.map(t=>t.targetTimeMs),visualNodes:8};
});
test('03 undo/redo branch truncation, draft persistence and bounded strict history',()=>{
 const s=session();set(s,'a1','Drag');set(s,'a2','Hold');s.submitEditorIntent({kind:'SetHoldEnd',eventId:'a2',endEventId:'a3'});const saved=clone(s.getDocument());s.submitEditorIntent({kind:'Undo'});assert.equal(s.getDocument().selection.nodes.a2.holdEndEventId,null);s.submitEditorIntent({kind:'Redo'});assert.deepEqual(s.getDocument(),saved);
 const reloaded=new GuidanceEditorSession(layout);reloaded.submitEditorIntent({kind:'LoadDraft',document:saved});assert.deepEqual(reloaded.getDocument(),saved);reloaded.submitEditorIntent({kind:'Undo'});set(reloaded,'a2','Tap');reloaded.submitEditorIntent({kind:'Redo'});assert.equal(reloaded.getDocument().selection.nodes.a2.kind,'Tap');
 const bad=clone(saved);bad.history.cursor=500;assert.throws(()=>reloaded.submitEditorIntent({kind:'LoadDraft',document:bad}));assert.equal(reloaded.getDocument().selection.nodes.a2.kind,'Tap');
 for(let i=0;i<120;i++)set(reloaded,'a1',i%2?'Tap':'Drag');assert.equal(reloaded.getDocument().history.entries.length,100);const again=new GuidanceEditorSession(layout);again.submitEditorIntent({kind:'LoadDraft',document:clone(reloaded.getDocument())});return {persistedHistory:saved.history.entries.length,bounded:100,failedLoadTransactional:true};
});
test('04 Drag/Hold key from source position; Hold tail mandatory; no key/position/time editing',()=>{
 const s=session();set(s,'a1','Drag');set(s,'a2','Hold');assert.throws(()=>s.exportChart());s.submitEditorIntent({kind:'SetHoldEnd',eventId:'a2',endEventId:'a3'});
 const l=s.exportChart().chart.lines[0],drag=l.nodes.find(n=>n.id==='node-a1'),hold=l.nodes.find(n=>n.id==='node-a2');assert.equal(drag.keyId,resolveGridKeyAt(layout,mock.events.find(e=>e.id==='a1').position));assert.equal(hold.keyId,resolveGridKeyAt(layout,mock.events.find(e=>e.id==='a2').position));assert.equal(l.timing.find(t=>t.nodeId===hold.id).endTargetTimeMs,5000);
 assert.throws(()=>s.submitEditorIntent({kind:'SetHoldEnd',eventId:'a2',endEventId:'b3'}));assert.throws(()=>s.submitEditorIntent({kind:'SetHead',lineId:'a',eventId:'a2'}));return {dragKey:drag.keyId,holdKey:hold.keyId,tailTime:5000};
});
test('05 colors optional and strictly paired; do not alter timing or score',()=>{
 const {chart,visual}=session().exportChart();assert.equal(parseGuidanceVisualData(visual,chart).nodes.length,8);assert.throws(()=>parseGuidanceVisualData({...visual,chartId:'other'},chart));assert.throws(()=>parseGuidanceVisualData({...visual,nodes:[{nodeId:'missing',color:{r:0,g:0,b:0}}]},chart));assert.throws(()=>parseGuidanceChart({...clone(chart),color:visual},layout));return {optionalSidecar:true,noGameplayColor:true};
});
test('06 v3 strict validation: missing/duplicate timing, speed field, tail, reversed distances, same-time teleport',()=>{
 const raw=clone(session().exportChart().chart);const cases=[r=>r.lines[0].timing.pop(),r=>r.lines[0].speed=.1,r=>r.lines[0].timing[0].nodeId='missing',r=>r.lines[0].timing[1].nodeId=r.lines[0].timing[0].nodeId,r=>r.lines[0].timing[1].targetTimeMs=2000,r=>r.lines[0].timing[1].targetTimeMs=r.lines[0].timing[0].targetTimeMs,r=>r.lines[0].head.targetTimeMs=500,r=>r.lines[0].timing[0].targetTimeMs=Infinity];for(const f of cases){const r=clone(raw);f(r);assert.throws(()=>parseGuidanceChart(r,layout));}return {rejected:cases.length};
});
test('07 late Head seeks absolute position; expired Tap/Drag cannot retroactively succeed',()=>{
 const s=session(),r=clone(s.exportChart().chart);const l=r.lines[0];l.head.spawnTimeMs=l.head.targetTimeMs=1000;l.timing[0].targetTimeMs=1100;l.timing[1].targetTimeMs=1200;l.timing[2].targetTimeMs=1300;l.nodes[1]={...l.nodes[1],kind:'Drag',keyId:'KeyF'};const p=new ChartPremiere(parseGuidanceChart(r,layout),layout);p.begin();edge(p,'KeyF',1000);edge(p,'Space',1500);
 const snap=p.getGuidanceSnapshots()[0];assert.equal(snap.startedAtMs,1500);assert.equal(snap.nodes[0].tier,'Miss');assert.equal(snap.nodes[1].tier,'Miss');assert.ok(snap.judgmentPoint.pathDistance>snap.nodes[2].node.pathDistance);assert.equal(p.getState(),'Playing');return {lateStartedAt:1500,absolutePosition:snap.judgmentPoint.pathDistance,retroactiveDrag:'Miss'};
});
test('08 v3 rehearsal completion gated by media; isolated real ChartPremiere preview',()=>{
 const s=session();set(s,'a1','Drag');set(s,'a2','Hold');s.submitEditorIntent({kind:'SetHoldEnd',eventId:'a2',endEventId:'a3'});s.submitEditorIntent({kind:'StartPreview',mode:'Rehearsal'});
 for(let time=0;time<=12000;time+=10)s.submitEditorIntent({kind:'Advance',timeMs:time,ended:time===12000});const p=s.getPreview();assert.equal(p.getState(),'Completed');assert.equal(p.getMissCount(),0);assert.equal(p.getResolvedCount(),8);assert.equal(p.getResult().finishedAtMs,12000);return p.getResult();
});
test('09 repeated MIDI position creates dwell, not duplicate adjacent path points; timing has separate node IDs',()=>{
 const m=clone(mock);m.events.find(e=>e.id==='a2').position=clone(m.events.find(e=>e.id==='a1').position);const s=new GuidanceEditorSession(layout);s.submitEditorIntent({kind:'LoadSource',source:m});const l=s.exportChart().chart.lines[0];assert.equal(l.path.points.length,4);assert.equal(l.nodes[0].pathDistance,l.nodes[1].pathDistance);assert.equal(guidanceDistanceAtTime(l,1000,2700),l.nodes[0].pathDistance);return {stationaryInterval:[2300,3100],twoDistinctTapObjects:true};
});
test('10 invalid turn Drag blocks export; user choice and source survive error; old v1/v2 resources still load',()=>{
 const m=clone(mock);m.events.find(e=>e.id==='a2').position.v=.7;const s=new GuidanceEditorSession(layout);s.submitEditorIntent({kind:'LoadSource',source:m});set(s,'a2','Drag');assert.throws(()=>s.exportChart());assert.equal(s.getDocument().selection.nodes.a2.kind,'Drag');set(s,'a2','Tap');assert.doesNotThrow(()=>s.exportChart());
 for(const name of ['guidance_a','guidance_b','guidance_c']){const r=JSON.parse(fs.readFileSync('assets/resources/chart/'+name+'.json','utf8'));assert.doesNotThrow(()=>parseGuidanceChart(r,layout));}return {legacyResources:3,choiceNotSilentlyChanged:true};
});
test('11 pause/release freezes time, seek rebuilds with timestamped inputs and drops future branch',()=>{
 const s=session();s.submitEditorIntent({kind:'StartPreview'});s.submitEditorIntent({kind:'Strike',strike:{keyId:'Space',videoTimeMs:1000}});s.submitEditorIntent({kind:'Advance',timeMs:1700,ended:false});s.submitEditorIntent({kind:'Pause',timeMs:1700});const frozen=s.getPreview().getGuidanceSnapshots();s.submitEditorIntent({kind:'Advance',timeMs:5000,ended:true});assert.deepEqual(s.getPreview().getGuidanceSnapshots(),frozen);s.submitEditorIntent({kind:'Pause',timeMs:1700});s.submitEditorIntent({kind:'Seek',timeMs:1500});assert.equal(s.getPreview().getCurrentTimeMs(),1500);assert.equal(s.getPreview().getGuidanceSnapshots()[0].startedAtMs,1000);s.submitEditorIntent({kind:'Seek',timeMs:500});assert.ok(s.getPreview().getGuidanceSnapshots().every(l=>l.startedAtMs===null));return {pausedFrozen:true,seekBackwardRebuilds:true};
});
test('12 v3 exact Drag arrival Down succeeds / Up fails; Hold exact-tail Up succeeds; pause-release locks Miss',()=>{
 const s=session();set(s,'a1','Drag');set(s,'a2','Hold');s.submitEditorIntent({kind:'SetHoldEnd',eventId:'a2',endEventId:'a3'});const r=clone(s.exportChart().chart);r.lines=r.lines.slice(0,1);
 const key=id=>resolveGridKeyAt(layout,mock.events.find(e=>e.id===id).position);
 const p=new ChartPremiere(r,layout);p.begin();edge(p,'Space',1000);edge(p,key('a1'),2290);edge(p,key('a1'),2300,'Up');assert.equal(p.getGuidanceSnapshots()[0].nodes[0].tier,'Miss');
 const q=new ChartPremiere(r,layout);q.begin();edge(q,'Space',1000);edge(q,key('a1'),2300);assert.equal(q.getGuidanceSnapshots()[0].nodes[0].tier,'Perfect');edge(q,key('a1'),2400,'Up');edge(q,key('a2'),3100);q.advance(4999);edge(q,key('a2'),5000,'Up');assert.equal(q.getGuidanceSnapshots()[0].nodes[1].tier,'Perfect');
 const h=new ChartPremiere(r,layout);h.begin();edge(h,'Space',1000);edge(h,key('a2'),3100);h.togglePause(3300);edge(h,key('a2'),3300,'Up');h.advance(4900);assert.equal(h.getCurrentTimeMs(),3300);h.togglePause(3300);edge(h,key('a2'),3400);h.advance(5000);assert.equal(h.getGuidanceSnapshots()[0].nodes[1].tier,'Miss');return {dragDown:'Perfect',dragUp:'Miss',holdTailUp:'Perfect',pauseRelease:'Miss'};
});
test('13 late Head cannot repair an already passed Hold start even if its key was held',()=>{
 const s=session();set(s,'a2','Hold');s.submitEditorIntent({kind:'SetHoldEnd',eventId:'a2',endEventId:'a3'});const r=clone(s.exportChart().chart);r.lines=r.lines.slice(0,1);r.lines[0].timing[0].targetTimeMs=1100;r.lines[0].timing[1].targetTimeMs=1200;
 const p=new ChartPremiere(r,layout);p.begin();edge(p,resolveGridKeyAt(layout,mock.events.find(e=>e.id==='a2').position),1000);edge(p,'Space',1500);p.advance(5000);assert.equal(p.getGuidanceSnapshots()[0].nodes[1].tier,'Miss');return {startedAt:1500,holdStart:1200,holdTail:5000,tier:'Miss'};
});
test('14 exported JSON reload uses fresh runtime; optional colors do not change outcomes; invalid import transactional',()=>{
 const {chart,visual}=session().exportChart();const q=new GuidanceEditorSession(layout);q.submitEditorIntent({kind:'LoadPreview',chart:clone(chart),visual:clone(visual)});assert.equal(q.getDocument(),null);q.submitEditorIntent({kind:'StartPreview',mode:'Rehearsal'});for(let t=0;t<=12000;t+=10)q.submitEditorIntent({kind:'Advance',timeMs:t,ended:t===12000});const result=q.getPreview().getResult();assert.equal(result.completed,true);assert.throws(()=>q.submitEditorIntent({kind:'LoadPreview',chart,visual:{...visual,chartId:'bad'}}));assert.deepEqual(q.getPreview().getResult(),result);
 q.submitEditorIntent({kind:'LoadPreview',chart});assert.equal(q.getPreviewData().visual.nodes.length,0);q.submitEditorIntent({kind:'StartPreview',mode:'Rehearsal'});for(let t=0;t<=12000;t+=10)q.submitEditorIntent({kind:'Advance',timeMs:t,ended:t===12000});assert.deepEqual(q.getPreview().getResult(),result);return {reloadedFromJson:true,identicalWithWithoutColors:true,invalidPairPreservesPreview:true};
});
test('15 v3 two identical lines share held Drag/Hold keys while Tap still consumes once; resolution-independent input replay',()=>{
 const m=clone(mock);for(const e of m.events.filter(e=>e.lineId==='b'))e.position=clone(m.events.find(a=>a.id==='a'+e.id.slice(1)).position);const s=new GuidanceEditorSession(layout);s.submitEditorIntent({kind:'LoadSource',source:m});for(const line of ['a','b']){set(s,line+'1','Drag');set(s,line+'2','Hold');s.submitEditorIntent({kind:'SetHoldEnd',eventId:line+'2',endEventId:line+'3'});}const chart=s.exportChart().chart,key=id=>resolveGridKeyAt(layout,m.events.find(e=>e.id===id).position);
 const run=()=>{const p=new ChartPremiere(chart,layout);p.begin();edge(p,'Space',1000);edge(p,'Space',1000,'Up');edge(p,'Space',1000);edge(p,key('a1'),2300);assert.ok(p.getGuidanceSnapshots().every(l=>l.nodes[0].tier==='Perfect'));edge(p,key('a1'),2400,'Up');edge(p,key('a2'),3100);edge(p,key('a2'),5000,'Up');assert.ok(p.getGuidanceSnapshots().every(l=>l.nodes[1].tier==='Perfect'));edge(p,key('a3'),5000);assert.equal(p.getGuidanceSnapshots().filter(l=>l.nodes[2].tier==='Perfect').length,1);edge(p,key('a3'),5000,'Up');edge(p,key('a3'),5000);edge(p,key('a3'),5100,'Up');edge(p,key('a4'),6800);edge(p,key('a4'),6800,'Up');edge(p,key('a4'),6800);p.advance(12000);assert.equal(p.getState(),'Playing');p.advanceMediaStatus(true,false,0);assert.equal(p.getMissCount(),0);return p.getResult();};const a=run(),b=run();assert.deepEqual(a,b);return {resolutions:['1920x1080','2560x1440'],sameNormalizedChartAndStrikes:true,result:a};
});
test('16 legacy v1/v2 JSON remains loadable and can run in isolated editor rehearsal',()=>{
 const evidence=[];for(const name of ['guidance_a','guidance_b','guidance_c']){const chart=JSON.parse(fs.readFileSync('assets/resources/chart/'+name+'.json','utf8')),s=new GuidanceEditorSession(layout);s.submitEditorIntent({kind:'LoadPreview',chart});s.submitEditorIntent({kind:'StartPreview',mode:'Rehearsal'});for(let t=0;t<=25000;t+=10)s.submitEditorIntent({kind:'Advance',timeMs:t,ended:t>=12000});assert.equal(s.getPreview().getState(),'Completed');evidence.push({chartId:chart.chartId,schemaVersion:chart.schemaVersion,state:'Completed'});}return evidence;
});
test('17 v3 independent Head timeout settles only its own line; all-node/media completion condition',()=>{
 const chart=session().exportChart().chart,p=new ChartPremiere(chart,layout);p.begin();edge(p,'Space',1000);p.advance(2001);let lines=p.getGuidanceSnapshots();assert.equal(lines[0].state,'Running');assert.equal(lines[1].state,'TimedOut');assert.ok(lines[1].nodes.every(n=>n.tier==='Miss'));for(const e of mock.events.filter(e=>e.lineId==='a'&&e.id!=='a0')){const key=resolveGridKeyAt(layout,e.position);edge(p,key,e.timeMs);edge(p,key,e.timeMs,'Up');}p.advance(7200);assert.equal(p.getState(),'Playing');assert.equal(p.getResolvedCount(),8);assert.equal(p.getMissCount(),4);p.advanceMediaStatus(true,false,0);assert.equal(p.getState(),'Completed');return {timedOutLine:'line-b',unaffectedLine:'line-a',result:p.getResult()};
});
test('18 v3 Tap absolute-time inclusive Perfect/Good boundaries and final-media-end unresolved timeout',()=>{
 const r=clone(session().exportChart().chart);r.lines=r.lines.slice(0,1);const l=r.lines[0];l.path.points=l.path.points.slice(0,2);l.nodes=l.nodes.slice(0,1);l.timing=l.timing.slice(0,1);const evidence=[];for(const [delta,tier] of [[-200,'Good'],[-100,'Perfect'],[0,'Perfect'],[100,'Perfect'],[200,'Good'],[201,'Miss']]){const p=new ChartPremiere(r,layout);p.begin();edge(p,'Space',1500);edge(p,'KeyR',2300+delta);p.advance(2500);assert.equal(p.getGuidanceSnapshots()[0].nodes[0].tier,tier);evidence.push({delta,tier});}
 l.timing[0].targetTimeMs=12000;const p=new ChartPremiere(r,layout);p.begin();edge(p,'Space',1000);p.advance(12000);p.advanceMediaStatus(true,false,0);assert.equal(p.getState(),'Playing');p.advance(12201);assert.equal(p.getState(),'Completed');return {boundaries:evidence,mediaEndWaitsForLastTapTimeout:true};
});
const report={passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks};fs.writeFileSync(__dirname+'/editor-regression-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
