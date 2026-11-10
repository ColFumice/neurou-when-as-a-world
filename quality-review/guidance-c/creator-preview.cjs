// Real Creator browser preview evidence. No source edits and no artificial score/node state.
// Fixture: grant the existing T6 endpoint permission once; all chart actions then pass
// through DOM keyboard events -> InputCollector -> FrameDriver -> DirectorSession.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const output = __dirname;
const project = path.resolve(output,'../..');
const compilationTargets = [
  {name:'SceneBuilder.ts',source:'assets/scripts/SceneBuilder.ts',markers:['guidance_c','未决对象沿独立时间']},
  {name:'GuidanceLineRuntime.ts',source:'src/chart/GuidanceLineRuntime.ts',markers:['holdRemainingPoints','holdInterrupted = true',"(a.kind === 'Tail' ? 0 : 1) - (b.kind === 'Tail' ? 0 : 1)"]},
  {name:'LineEraseEffect.ts',source:'src/presentation/LineEraseEffect.ts',markers:['drawHoldRange']},
  {name:'GuidanceChart.ts',source:'src/chart/GuidanceChart.ts',markers:['slicePathByDistance']},
  {name:'GuidanceChartRuntime.ts',source:'src/chart/GuidanceChartRuntime.ts',markers:['getTapCandidate','getGuidanceSnapshots']},
  {name:'ChartPremiere.ts',source:'src/chart/ChartPremiere.ts',markers:['GuidanceChartRuntime','getGuidanceSnapshots']},
];
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
async function captureCompilation(){
  const mapResponse=await fetch('http://localhost:7457/scripting/x/import-map.json',{cache:'no-store'});
  assert.equal(mapResponse.ok,true);
  const map=await mapResponse.json();
  const entries=await Promise.all(compilationTargets.map(async target=>{
    const id=Object.keys(map.imports).find(key=>key.endsWith('/'+target.name));
    assert.ok(id,target.name+' missing from Creator import map');
    const chunk=map.imports[id];
    const url=new URL(chunk,'http://localhost:7457/scripting/x/').href;
    const response=await fetch(url,{cache:'no-store'});assert.equal(response.ok,true);
    const bytes=Buffer.from(await response.arrayBuffer());
    const disk=fs.readFileSync(path.join(project,'temp/programming/packer-driver/targets/preview',chunk));
    assert.equal(sha256(bytes),sha256(disk),target.name+' served chunk differs from Creator compiler output');
    const sourceMap=await (await fetch(url+'.map',{cache:'no-store'})).json();const sourceText=fs.readFileSync(path.join(project,target.source),'utf8');assert.ok(sourceMap.sourcesContent.includes(sourceText),target.name+' source map does not match final source');const text=bytes.toString('utf8');
    for(const marker of target.markers)assert.ok(text.includes(marker),target.name+' lacks final marker: '+marker);
    return {name:target.name,source:target.source,sourceSha256:sha256(fs.readFileSync(path.join(project,target.source))),
      chunk,url,sha256:sha256(bytes),markers:target.markers,servedEqualsCompilerOutput:true,pass:true};
  }));
  return {creator:'3.8.8',target:'preview',capturedAt:new Date().toISOString(),entries,pass:true};
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.setPath('userData', path.join(output, 'electron-profile'));
app.on('window-all-closed',()=>{});
console.log('HARNESS loaded');
const results = { creator: '3.8.8', url: 'http://localhost:7457/',
  fixture: 'Only DirectorSession.endpointSettled=true to bypass the already-tested T6 entrance. No score/node/media clock replacement. GameCanvas receives DOM KeyboardEvent edges through the Cocos web input source, InputCollector, FrameDriver and director.',
  resolutions: [], rendererErrors: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let window;
async function evaluate(fn, ...args) {
  return window.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(v => JSON.stringify(v)).join(',') + ')', true);
}
async function until(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await evaluate(fn);
    if (value) return value;
    await wait(10);
  }
  throw new Error('Timed out: ' + fn.toString());
}

async function setup() {
  const cc=await System.import('cc');
  function find(node,name='SceneBuilder'){if(!node)return null;const c=node.getComponent(name);if(c)return c;for(const child of node.children){const r=find(child,name);if(r)return r;}return null;}
  const builder=find(cc.director.getScene()),input=find(cc.director.getScene(),'InputCollector');
  if(!builder?.chartPremiere||!builder.videoPlayer||!builder.chartPadView?.headLogo||!input)return {ready:false,builder:!!builder,chart:!!builder?.chartPremiere,video:!!builder?.videoPlayer,logo:!!builder?.chartPadView?.headLogo,input:!!input,scene:cc.director.getScene()?.name};
  cc.profiler.hideStats();
  const chartModule=await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/GuidanceChart.ts');
  const layoutModule=await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/KeyboardPadLayout.ts');
  const r={cc,builder,input,get video(){return builder.videoPlayer.nativeVideo;},autoHead:false,autoNodes:false,headIds:new Set(),nodeIds:new Set(),heldKeys:new Set(),inputEvents:[],sync:[],frameHandle:null};window.__guidancePreview=r;
  r.edge=(keyId,down)=>{r.inputEvents.push({keyId,phase:down?'Down':'Up',timeMs:builder.readVideoTimeMs()});document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code:keyId,repeat:false,bubbles:true,cancelable:true}));};
  r.press=keyId=>{r.edge(keyId,true);r.edge(keyId,false);};
  r.read=()=>{const p=builder.chartPremiere,effect=builder.chartPadView.lineEraseEffect,canvas=document.getElementById('GameCanvas');return {timeMs:p.getCurrentTimeMs(),mediaHeadMs:r.video?r.video.currentTime*1000:-1,state:p.getState(),entered:builder.chartEntered,world:builder.worldRootNode.active,ledger:builder.graph.session.getLedgerEvents().length,perfect:p.getPerfectCount(),good:p.getGoodCount(),miss:p.getMissCount(),score:p.getTotalScore(),result:p.getResult(),lines:p.getGuidanceSnapshots(),line:p.getGuidanceSnapshot(),visuals:{heads:[...effect.headSprites.entries()].map(([id,s])=>({id,active:s.node.active,position:[s.node.position.x,s.node.position.y],scale:s.node.scale.x,alpha:s.color.a})),container:[effect.node.getComponent(cc.UITransform).width,effect.node.getComponent(cc.UITransform).height]},dimensions:{inner:[innerWidth,innerHeight],canvas:[canvas.width,canvas.height],canvasCss:[canvas.clientWidth,canvas.clientHeight],dpr:devicePixelRatio}};};
  r.targetTime=(lineIndex,node)=>{const s=builder.chartPremiere.getGuidanceSnapshots()[lineIndex];return s.startedAtMs+node.pathDistance/builder.chartData.lines[lineIndex].speed*1000;};
  r.reset=()=>{r.headIds.clear();r.nodeIds.clear();r.heldKeys.clear();};
  r.timer=setInterval(()=>{
    if(r.video&&r.frameHandle===null)r.frameHandle=r.video.requestVideoFrameCallback(frame);
    const p=builder.chartPremiere,now=builder.readVideoTimeMs();if(p.getState()!=='Playing'||now<0)return;
    const snapshots=p.getGuidanceSnapshots();
    if(r.autoHead){const s=snapshots.find(s=>s.state==='Waiting'&&!r.headIds.has(s.id));if(s){r.headIds.add(s.id);r.press('Space');}}
    if(!r.autoNodes)return;
    // Build one desired held-key set across all lines so one line never releases another's Hold.
    const desired=new Set();
    snapshots.forEach((s,i)=>{if(s.startedAtMs===null)return;const l=builder.chartData.lines[i];
      for(const item of s.nodes){const n=item.node,target=r.targetTime(i,n);if(n.kind==='Drag'||n.kind==='Hold'){
        const end=n.kind==='Hold'?s.startedAtMs+n.endPathDistance/l.speed*1000+70:target+100;
        if(now>=target-100&&now<end)desired.add(n.keyId);
      }}
    });
    for(const key of desired)if(!r.heldKeys.has(key)){r.heldKeys.add(key);r.edge(key,true);}
    for(const key of [...r.heldKeys])if(!desired.has(key)){r.heldKeys.delete(key);r.edge(key,false);}
    snapshots.forEach((s,i)=>{if(s.startedAtMs===null)return;const l=builder.chartData.lines[i];for(const item of s.nodes){const n=item.node;if(n.kind!=='Tap'||r.nodeIds.has(n.id)||item.tier!==null)continue;
      const target=r.targetTime(i,n),delay=n.id.endsWith('-conflict')&&i===1?75:-8;
      if(now>=target+delay){const position=chartModule.positionAtPathDistance(l.path,builder.chartData.aspectRatio,l.speed*(now-s.startedAtMs)/1000);const key=layoutModule.resolveGridKeyAt(builder.keyboardLayout,position);if(key===null)throw new Error('Tap has no grid key '+n.id);r.nodeIds.add(n.id);r.press(key);}
    }});
  },5);
  function frame(now,metadata){const clockMs=builder.audioOutputClock.readChartTimeMs();if(builder.chartEntered&&builder.chartPremiere.getState()==='Playing'&&clockMs>=0)r.sync.push({clockMs,presentedMediaMs:metadata.mediaTime*1000,rawPresentedErrorMs:clockMs-metadata.mediaTime*1000,projectedPresentedErrorMs:clockMs-(metadata.mediaTime*1000+now-metadata.expectedDisplayTime)});r.frameHandle=r.video.requestVideoFrameCallback(frame);}
  return {ready:true,chartId:builder.chartPremiere.getChartId()};
}
async function read() { return evaluate(() => window.__guidancePreview.read()); }
async function screenshot(name, report) {
  const file=path.join(output,report.resolution+'-'+name+'.png');
  const capture=await window.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true});
  const png=Buffer.from(capture.data,'base64');
  fs.writeFileSync(file,png);
  const snapshot=await read();
  report.evidence.push({name,file:path.basename(file),imageSize:{width:png.readUInt32BE(16),height:png.readUInt32BE(20)},snapshot});
  console.log(report.resolution+' '+name+' '+JSON.stringify({timeMs:snapshot.timeMs,state:snapshot.state,line:snapshot.line.state,ledger:snapshot.ledger,head:snapshot.visuals.headVisible}));
  return snapshot;
}

async function waitTime(target){await evaluate(t=>window.__guidancePreview.captureTarget=t,target);await until(()=>window.__guidancePreview.builder.chartPremiere.getCurrentTimeMs()>=window.__guidancePreview.captureTarget);}
async function resolution(width,height){
  const report={resolution:width+'x'+height,evidence:[],checks:[]};results.resolutions.push(report);console.log('C HARNESS '+report.resolution);
  window=new BrowserWindow({width,height,show:false,frame:false,useContentSize:true,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  window.webContents.on('console-message',event=>{console.log('RENDERER '+event.level+' '+event.message);if(event.level===3||event.level==='error')results.rendererErrors.push({resolution:report.resolution,message:event.message});});
  await window.loadURL('http://localhost:7457/');await until(()=>typeof System!=='undefined'&&!!document.getElementById('GameCanvas'));window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  let ready;for(let i=0;i<100;i++){ready=await evaluate(setup);if(ready.ready)break;await wait(100);}console.log('READY '+JSON.stringify(ready));assert.equal(ready.ready,true);assert.equal(ready.chartId,'guidance-c-1');
  report.chart=await evaluate(()=>window.__guidancePreview.builder.chartData);report.dimensions=(await read()).dimensions;assert.deepEqual(report.dimensions.canvas,[width,height]);
  await evaluate(()=>{const r=window.__guidancePreview;r.builder.graph.session.endpointSettled=true;r.autoHead=true;r.autoNodes=true;r.input.requestEnterChart();});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getGuidanceSnapshots().every(s=>s.startedAtMs!==null));
  report.starts=await evaluate(()=>window.__guidancePreview.builder.chartPremiere.getGuidanceSnapshots().map(s=>s.startedAtMs));assert.ok(report.starts[1]>report.starts[0]);
  await waitTime(report.starts[1]+150);await screenshot('parallel',report);
  const target=report.starts[0]+report.chart.lines[0].nodes[0].pathDistance/report.chart.lines[0].speed*1000;
  // Capture deterministically within the conflict window by pausing through the actual InputCollector.
  await evaluate(()=>{const r=window.__guidancePreview;r.conflictWatch=setInterval(()=>{const s=r.builder.chartPremiere.getGuidanceSnapshots();if(s[0].nodes[0].tier!==null&&s[1].nodes[0].tier===null){clearInterval(r.conflictWatch);r.input.requestToggleChartPause();}},2);});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getState()==='Paused');
  report.conflict=await screenshot('input-conflict',report);assert.equal(report.conflict.lines[0].nodes[0].tier,'Perfect');assert.equal(report.conflict.lines[1].nodes[0].tier,null);assert.equal(report.conflict.perfect,1);
  await wait(150);assert.deepEqual((await read()).lines,report.conflict.lines);await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());
  await waitTime(report.starts[1]+1200);report.overlap=await screenshot('overlap-interweave',report);assert.ok(report.overlap.lines.every(s=>s.state==='Running'));assert.notDeepEqual(report.overlap.lines[0].remainingPoints,report.overlap.lines[1].remainingPoints);
  const holdTime=Math.max(...report.starts.map((t,i)=>t+report.chart.lines[i].nodes.find(n=>n.kind==='Hold').pathDistance/report.chart.lines[i].speed*1000));
  await waitTime(holdTime+200);await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());await until(()=>window.__guidancePreview.builder.chartPremiere.getState()==='Paused');const paused=await screenshot('two-holds-paused',report);await wait(350);assert.deepEqual((await read()).lines,paused.lines);assert.equal((await read()).timeMs,paused.timeMs);await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());
  await waitTime(10000);report.beforeEnd=await read();assert.equal(report.beforeEnd.state,'Playing');assert.equal(report.beforeEnd.ledger,0);assert.equal(report.beforeEnd.perfect+report.beforeEnd.good+report.beforeEnd.miss,10);assert.equal(report.beforeEnd.miss,0);
  await evaluate(()=>window.__guidancePreview.input.requestExitChart());await until(()=>!window.__guidancePreview.builder.chartEntered);report.earlyExit=await screenshot('early-exit',report);assert.equal(report.earlyExit.ledger,0);
  await evaluate(()=>{const r=window.__guidancePreview;r.reset();r.autoHead=true;r.autoNodes=true;r.input.requestEnterChart();});await until(()=>window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getState()==='Playing');
  report.reentry=await screenshot('reentry-reset',report);assert.equal(report.reentry.score,0);assert.ok(report.reentry.lines.every(s=>s.startedAtMs===null&&s.nodes.every(n=>n.tier===null)));
  await waitTime(10000);assert.equal((await read()).ledger,0);
  await until(()=>!window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getResult()?.completed,5000);report.completed=await screenshot('completion',report);assert.equal(report.completed.ledger,1);await wait(100);assert.equal((await read()).ledger,1);
  report.inputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);report.sync=await evaluate(()=>window.__guidancePreview.sync);
  // A fresh preview session exercises independent timeout; director intentionally disallows replay after recording completion.
  await window.loadURL('http://localhost:7457/');await until(()=>typeof System!=='undefined'&&!!document.getElementById('GameCanvas'));
  for(let i=0;i<100;i++){ready=await evaluate(setup);if(ready.ready)break;await wait(100);}assert.equal(ready.ready,true);
  await evaluate(()=>{const r=window.__guidancePreview;r.reset();r.builder.graph.session.endpointSettled=true;r.autoHead=false;r.autoNodes=false;r.input.requestEnterChart();});await until(()=>window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getState()==='Playing');
  await until(()=>window.__guidancePreview.builder.chartPremiere.getGuidanceSnapshots()[0].state==='Waiting');await evaluate(()=>{const r=window.__guidancePreview;r.press('Space');r.autoNodes=true;});
  await waitTime(3150);report.timeout=await screenshot('independent-timeout',report);assert.equal(report.timeout.lines[0].state,'Running');assert.equal(report.timeout.lines[1].state,'TimedOut');assert.ok(report.timeout.lines[1].nodes.every(n=>n.tier==='Miss'));
  await evaluate(()=>window.__guidancePreview.input.requestExitChart());await until(()=>!window.__guidancePreview.builder.chartEntered);report.timeoutExit=await read();assert.equal(report.timeoutExit.ledger,0);
  report.checks=[{name:'independent starts and two running lines',pass:true},{name:'one Down consumes one overlapping Tap and pauses both paths',pass:true},{name:'overlapping paths have independent erase progress',pass:true},{name:'two active Holds pause/resume together',pass:true},{name:'all ten nodes settled waits until real media end; director appends once',pass:true},{name:'reentry resets both; only second Head times out; early exit adds no record',pass:true}];
  report.timeoutInputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);report.syncSummary={sampleCount:report.sync.length,maxRawPresentedErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.rawPresentedErrorMs))),maxProjectedPresentedErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.projectedPresentedErrorMs)))};assert.ok(report.sync.length>10);assert.ok(report.syncSummary.maxRawPresentedErrorMs<=30);
  window.destroy();window=null;
}
app.whenReady().then(async()=>{
  try{
    results.compilation=await captureCompilation();
    await resolution(1920,1080);await resolution(2560,1440);assert.equal(results.rendererErrors.length,0); assert.deepEqual(results.resolutions[0].completed.result,results.resolutions[1].completed.result);
    const after=await captureCompilation();
    assert.deepEqual(after.entries,results.compilation.entries,'Source or served compiler chunks changed during preview evidence capture');
    results.compilation.unchangedThroughEvidenceCapture=true;
    fs.writeFileSync(path.join(output,'creator-compilation.json'),JSON.stringify(results.compilation,null,2));
    results.pass=true;
  }
  catch(error){results.pass=false;results.failure={message:error.message,stack:error.stack};if(window){try{results.failure.snapshot=await read();results.failure.inputEvents=await evaluate(()=>window.__guidancePreview?.inputEvents);}catch{}}console.error(error);}
  finally{fs.writeFileSync(path.join(output,'creator-preview-results.json'),JSON.stringify(results,null,2));if(window)window.destroy();app.exit(results.pass?0:1);}
});
