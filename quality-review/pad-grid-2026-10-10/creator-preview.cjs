// Real Creator browser preview evidence. Fullscreen 47-slot and adjacent-key real Creator evidence. No source edits or artificial score/node state.
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
  {name:'SceneBuilder.ts',source:'assets/scripts/SceneBuilder.ts',markers:['guidance_b','未决对象沿独立时间']},
  {name:'GuidanceLineRuntime.ts',source:'src/chart/GuidanceLineRuntime.ts',markers:['hasHeldGridKey','isMatchingGridKey']},
  {name:'LineEraseEffect.ts',source:'src/presentation/LineEraseEffect.ts',markers:['drawHoldRange']},
  {name:'GuidanceChart.ts',source:'src/chart/GuidanceChart.ts',markers:['slicePathByDistance']},
  {name:'KeyboardPadLayout.ts',source:'src/chart/KeyboardPadLayout.ts',markers:['pad-layout-2','isMatchingGridKey']},
  {name:'ChartPadView.ts',source:'src/presentation/ChartPadView.ts',markers:['rebuildSlotLabels','resolveContentRect(width, height)']},
];
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
async function captureCompilation(){
  const mapResponse=await fetch('http://localhost:7456/scripting/x/import-map.json',{cache:'no-store'});
  assert.equal(mapResponse.ok,true);
  const map=await mapResponse.json();
  const entries=await Promise.all(compilationTargets.map(async target=>{
    const id=Object.keys(map.imports).find(key=>key.endsWith('/'+target.name));
    assert.ok(id,target.name+' missing from Creator import map');
    const chunk=map.imports[id];
    const url=new URL(chunk,'http://localhost:7456/scripting/x/').href;
    const response=await fetch(url,{cache:'no-store'});assert.equal(response.ok,true);
    const bytes=Buffer.from(await response.arrayBuffer());
    const disk=fs.readFileSync(path.join(project,'temp/programming/packer-driver/targets/preview',chunk));
    assert.equal(sha256(bytes),sha256(disk),target.name+' served chunk differs from Creator compiler output');
    const text=bytes.toString('utf8');
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
const results = { creator: '3.8.8', url: 'http://localhost:7456/',
  fixture: 'Only DirectorSession.endpointSettled=true to bypass the already-tested T6 entrance; cc.profiler.hideStats hides the debug overlay for unobstructed visual inspection. No score/node/media clock replacement. GameCanvas receives DOM KeyboardEvent edges through the Cocos web input source, InputCollector, FrameDriver and director.',
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
  const cc = await System.import('cc');
  function find(node, name = 'SceneBuilder') {
    if (!node) return null;
    const component = node.getComponent(name);
    if (component) return component;
    for (const child of node.children) { const result = find(child, name); if (result) return result; }
    return null;
  }
  const builder = find(cc.director.getScene());
  if (!builder?.chartPremiere || !builder.videoPlayer || !builder.chartPadView?.headLogo) {
    return { ready: false, builder: !!builder, chart: !!builder?.chartPremiere, logo: !!builder?.chartPadView?.headLogo };
  }
  const input = find(cc.director.getScene(), 'InputCollector');
  if (!input) throw new Error('InputCollector not found in live scene');
  cc.profiler.hideStats(); // After scene ready, hide debug-only overlay so all 47 labels can be inspected.
  const runtime = { cc, builder, input, get video(){return builder.videoPlayer.nativeVideo;}, frameHandle:null,
    inputEvents: [], neighborInputs: [], sync: [], autoHead: false, autoNodes: false, spaceSent: false, nodeInputs: new Set(), heldKeys: new Set() };
  window.__guidancePreview = runtime;
  runtime.press = keyId => {
    const symbols = {Tab:9,Enter:13,Escape:27,Backquote:192,Minus:189,Equal:187,BracketLeft:219,BracketRight:221,Backslash:220,Semicolon:186,Quote:222,Comma:188,Period:190,Slash:191};
    const code = keyId === 'Space' ? 32 : keyId.startsWith('Key') ? keyId.charCodeAt(3) : keyId.startsWith('Digit') ? keyId.charCodeAt(5) : symbols[keyId];
    const timeMs = builder.readVideoTimeMs();
    runtime.inputEvents.push({keyId,timeMs});
    const canvas=document.getElementById('GameCanvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown',{code:keyId,keyCode:code,repeat:false,bubbles:true,cancelable:true}));
    canvas.dispatchEvent(new KeyboardEvent('keyup',{code:keyId,keyCode:code,repeat:false,bubbles:true,cancelable:true}));
  };
  runtime.read = () => {
    const p = builder.chartPremiere, line = p.getGuidanceSnapshot();
    const effect = builder.chartPadView.lineEraseEffect;
    const canvas = document.getElementById('GameCanvas');
    return {wallMs:performance.now(),timeMs:p.getCurrentTimeMs(),mediaHeadMs:runtime.video ? runtime.video.currentTime*1000 : -1,
      state:p.getState(),entered:builder.chartEntered,world:builder.worldRootNode.active,
      ledger:builder.graph.session.getLedgerEvents().length,perfect:p.getPerfectCount(),good:p.getGoodCount(),miss:p.getMissCount(),
      score:p.getTotalScore(),result:p.getResult(),line,
      layout:{version:builder.chartPadView.layout.layoutVersion,slots:builder.chartPadView.layout.slots,
        logicMatchesView:JSON.stringify(builder.keyboardLayout.slots)===JSON.stringify(builder.chartPadView.layout.slots),
        labelNames:builder.chartPadView.slotLabelNodes.map(node=>node.name),labels:builder.chartPadView.slotLabels.map(label=>label.string),
        container:[builder.chartPadView.node.getComponent(cc.UITransform).width,builder.chartPadView.node.getComponent(cc.UITransform).height],
        labelPositions:builder.chartPadView.slotLabelNodes.map(node=>({name:node.name,x:node.position.x,y:node.position.y}))},
      visuals:{headVisible:effect?.headSprite?.node.active,headScale:effect?.headSprite?.node.scale.x,
        headAlpha:effect?.headSprite?.color.a,container:effect ? [effect.node.getComponent(cc.UITransform).width,effect.node.getComponent(cc.UITransform).height]:null},
      dimensions:{inner:[innerWidth,innerHeight],canvas:[canvas.width,canvas.height],canvasCss:[canvas.clientWidth,canvas.clientHeight],dpr:devicePixelRatio}};
  };
  runtime.edge=(keyId,down)=>{
    runtime.inputEvents.push({keyId,phase:down?'Down':'Up',timeMs:builder.readVideoTimeMs()});
    document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code:keyId,repeat:false,bubbles:true,cancelable:true}));
  };
  const chartModule=await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/GuidanceChart.ts');
  const layoutModule=await System.import('file:///D:/Project/A_New_Begin/Neurou_official/assets/scripts/src/chart/KeyboardPadLayout.ts');
  runtime.neighborFor=(keyId,kind)=>{
    const target=builder.keyboardLayout.slots.find(slot=>slot.keyId===keyId);
    if(!target)throw new Error('No target slot '+keyId);
    const epsilon=1e-9;
    const neighbors=builder.keyboardLayout.slots.filter(slot=>slot.keyId!==keyId&&slot.keyId!=='Space'&&(kind!=='Tap'||!runtime.heldKeys.has(slot.keyId))).map(slot=>{
      const overlapX=Math.min(target.u+target.width,slot.u+slot.width)-Math.max(target.u,slot.u);
      const overlapY=Math.min(target.v+target.height,slot.v+slot.height)-Math.max(target.v,slot.v);
      return {slot,overlapX,overlapY,relation:Math.abs(overlapX)<=epsilon&&Math.abs(overlapY)<=epsilon?'corner':slot.v===target.v?'horizontal':'vertical'};
    }).filter(item=>item.overlapX>=-epsilon&&item.overlapY>=-epsilon);
    const preferred=kind==='Tap'?'corner':kind==='Hold'?'vertical':'horizontal';
    const candidate=neighbors.find(item=>item.relation===preferred)||neighbors[0];
    if(!candidate)throw new Error('No touching neighbor for '+keyId);
    if(!layoutModule.isMatchingGridKey(builder.keyboardLayout,keyId,candidate.slot.keyId))throw new Error('Independent touching neighbor rejected');
    return {keyId:candidate.slot.keyId,relation:candidate.relation};
  };
  runtime.targetTime=node=>{const snapshot=builder.chartPremiere.getGuidanceSnapshot();return snapshot.startedAtMs+node.pathDistance/builder.chartData.lines[0].speed*1000;};
  runtime.timer=setInterval(()=>{
    if(runtime.video && runtime.frameHandle===null){runtime.frameHandle=runtime.video.requestVideoFrameCallback(frame);}
    const p=builder.chartPremiere,snapshot=p.getGuidanceSnapshot(),now=builder.readVideoTimeMs();
    if(p.getState()!=='Playing'||!snapshot||now<0)return;
    if(snapshot.state==='Waiting'&&runtime.autoHead&&!runtime.spaceSent){runtime.spaceSent=true;runtime.press('Space');}
    if(snapshot.startedAtMs===null||!runtime.autoNodes)return;
    const line=builder.chartData.lines[0];
    for(const item of snapshot.nodes){
      const node=item.node,target=runtime.targetTime(node);
      if(node.kind==='Tap'&&!runtime.nodeInputs.has(node.id)&&now>=target-8){
        const distance=line.speed*(now-snapshot.startedAtMs)/1000;
        const position=chartModule.positionAtPathDistance(line.path,builder.chartData.aspectRatio,distance);
        const key=layoutModule.resolveGridKeyAt(builder.keyboardLayout,position);
        if(key===null)throw new Error('Tap input position has no dynamic key: '+JSON.stringify(position));
        const neighbor=runtime.neighborFor(key,'Tap');
        runtime.neighborInputs.push({nodeId:node.id,kind:node.kind,targetKeyId:key,inputKeyId:neighbor.keyId,relation:neighbor.relation,timeMs:now});
        runtime.nodeInputs.add(node.id);runtime.press(neighbor.keyId);
      }else if(node.kind==='Drag'||node.kind==='Hold'){
        const neighbor=runtime.neighborFor(node.keyId,node.kind);
        if(!runtime.nodeInputs.has(node.id)&&now>=target-100){
          runtime.neighborInputs.push({nodeId:node.id,kind:node.kind,targetKeyId:node.keyId,inputKeyId:neighbor.keyId,relation:neighbor.relation,timeMs:now});
          runtime.nodeInputs.add(node.id);runtime.heldKeys.add(neighbor.keyId);runtime.edge(neighbor.keyId,true);
        }
        const releaseAt=node.kind==='Hold'?snapshot.startedAtMs+node.endPathDistance/line.speed*1000+70:target+100;
        if(runtime.heldKeys.has(neighbor.keyId)&&now>=releaseAt){runtime.heldKeys.delete(neighbor.keyId);runtime.edge(neighbor.keyId,false);}
      }
    }
  },5);
  function frame(now,metadata){
    const clockMs=builder.audioOutputClock.readChartTimeMs();
    if(builder.chartEntered && builder.chartPremiere.getState()==='Playing'&&clockMs>=0){
      runtime.sync.push({clockMs,mediaHeadMs:runtime.video.currentTime*1000,presentedMediaMs:metadata.mediaTime*1000,
        expectedDisplayMs:metadata.expectedDisplayTime,callbackNowMs:now,
        clockHeadErrorMs:clockMs-runtime.video.currentTime*1000,
        rawPresentedErrorMs:clockMs-metadata.mediaTime*1000,
        projectedPresentedErrorMs:clockMs-(metadata.mediaTime*1000+now-metadata.expectedDisplayTime)});
    }
    runtime.frameHandle=runtime.video.requestVideoFrameCallback(frame);
  }
  if(runtime.video){runtime.frameHandle=runtime.video.requestVideoFrameCallback(frame);}
  return {ready:true,chartId:builder.chartPremiere.getChartId(),logo:true};
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
async function nodeTime(kind,index=0,end=false){
  return evaluate((kind,index,end)=>{const r=window.__guidancePreview,s=r.builder.chartPremiere.getGuidanceSnapshot();const node=r.builder.chartData.lines[0].nodes.filter(n=>n.kind===kind)[index];return s.startedAtMs+(end?node.endPathDistance:node.pathDistance)/r.builder.chartData.lines[0].speed*1000;},kind,index,end);
}
async function atTime(timeMs){await until(()=>window.__guidancePreview.builder.chartPremiere.getCurrentTimeMs()>=window.__guidancePreview.captureTarget);}
async function waitTime(timeMs){await evaluate(timeMs=>{window.__guidancePreview.captureTarget=timeMs;},timeMs);await atTime(timeMs);}
async function resolution(width,height){
  const report={resolution:width+'x'+height,evidence:[],checks:[]};results.resolutions.push(report);
  console.log('PAD GRID HARNESS '+report.resolution);
  window=new BrowserWindow({width,height,show:false,frame:false,useContentSize:true,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  window.webContents.on('console-message',event=>{if(event.level===3)results.rendererErrors.push({resolution:report.resolution,message:event.message});});
  await window.loadURL('http://localhost:7456/');
  await until(()=>typeof System!=='undefined'&&!!document.getElementById('GameCanvas'));
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await wait(100);
  let ready;for(let i=0;i<100;i++){ready=await evaluate(setup);if(ready.ready)break;await wait(100);}
  assert.equal(ready.ready,true);assert.equal(ready.chartId,'guidance-b-1');
  const initial=await read();report.dimensions=initial.dimensions;
  assert.deepEqual(initial.dimensions.inner,[width,height]);assert.deepEqual(initial.dimensions.canvas,[width,height]);
  report.chart=await evaluate(()=>window.__guidancePreview.builder.chartData);
  await evaluate(()=>{const r=window.__guidancePreview;r.builder.graph.session.endpointSettled=true;r.autoHead=true;r.autoNodes=false;r.input.requestEnterChart();});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getGuidanceSnapshot().startedAtMs!==null);
  const firstTap=await nodeTime('Tap');
  const startedAtMs=await evaluate(()=>window.__guidancePreview.builder.chartPremiere.getGuidanceSnapshot().startedAtMs);
  await waitTime(startedAtMs+200);
  report.nodesBefore=await screenshot('fullscreen-grid',report);
  const layout=report.nodesBefore.layout;
  assert.equal(layout.version,'pad-layout-2');assert.equal(layout.slots.length,47);assert.equal(layout.logicMatchesView,true);
  assert.equal(layout.slots.some(slot=>slot.keyId==='Space'),false);assert.equal(layout.labelNames.length,47);
  assert.equal(layout.labelNames.some(name=>name.includes('Space')),false);assert.equal(layout.labels.includes('SPACE'),false);
  const rows=[...new Set(layout.slots.map(slot=>slot.v))].sort((a,b)=>b-a);
  assert.deepEqual(rows,[.75,.5,.25,0]);
  const rowReports=rows.map(v=>{
    const slots=layout.slots.filter(slot=>slot.v===v).sort((a,b)=>a.u-b.u);
    assert.equal(slots[0].u,0);assert.ok(Math.abs(slots.at(-1).u+slots.at(-1).width-1)<1e-9);
    slots.forEach((slot,index)=>{assert.equal(slot.height,.25);assert.ok(Math.abs(slot.width-1/slots.length)<1e-9);if(index)assert.ok(Math.abs(slots[index-1].u+slots[index-1].width-slot.u)<1e-9);});
    return {v,keyCount:slots.length,width:slots[0].width,height:slots[0].height,fullWidth:true};
  });
  assert.deepEqual(rowReports.map(row=>row.keyCount),[13,13,11,10]);
  assert.ok(rowReports[3].width>rowReports[2].width&&rowReports[2].width>rowReports[0].width);
  for(const slot of layout.slots){
    const position=layout.labelPositions.find(item=>item.name==='SlotLabel-'+slot.keyId);
    assert.ok(position);assert.ok(Math.abs(position.x-(slot.u+slot.width/2-.5)*layout.container[0])<1e-3);
    assert.ok(Math.abs(position.y-(slot.v+slot.height/2-.5)*layout.container[1])<1e-3);
  }
  report.grid={rows:rowReports,slotCount:47,labels:layout.labels,logicEqualsView:true,noSpaceLabel:true,allRowsTileFullContainer:true};
  report.checks.push({name:'47 visible non-Space slots form 13/13/11/10 full-width rows, 25% height; shorter rows have wider cells; live logic matches presentation',pass:true});
  await evaluate(()=>{window.__guidancePreview.autoNodes=true;});
  const drag=await nodeTime('Drag');
  await waitTime(drag+30);
  report.drag=await screenshot('drag-triggered',report);
  assert.equal(report.drag.line.nodes.find(i=>i.node.kind==='Drag').tier,'Perfect');
  report.checks.push({name:'Drag touching horizontal neighbor, different from bound target, held at crossing triggers Perfect once',pass:true});
  const holdStart=await nodeTime('Hold'),holdEnd=await nodeTime('Hold',0,true);
  await waitTime(holdStart+300);
  report.holdBefore=await screenshot('hold-active-before',report);
  const holdItem=report.holdBefore.line.nodes.find(i=>i.node.kind==='Hold');
  assert.equal(holdItem.holdActive,true);assert.ok(holdItem.holdRemainingPoints.length>=2);assert.equal(holdItem.tier,null);
  await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());
  await until(()=>window.__guidancePreview.builder.chartPremiere.getState()==='Paused');
  const pausedBefore=await screenshot('hold-pause-before',report);await wait(350);
  const pausedAfter=await screenshot('hold-pause-after',report);
  assert.equal(pausedBefore.timeMs,pausedAfter.timeMs);assert.deepEqual(pausedBefore.line,pausedAfter.line);assert.deepEqual(pausedBefore.visuals,pausedAfter.visuals);
  report.checks.push({name:'active Hold path, judgement and media time freeze on pause',pass:true});
  await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());
  await waitTime(firstTap+300);
  report.holdAfter=await screenshot('hold-after-tap-turn',report);
  assert.equal(report.holdAfter.line.nodes.find(i=>i.node.kind==='Hold').holdActive,true);
  await waitTime(holdEnd+30);
  report.holdTail=await screenshot('hold-tail-resolved',report);
  const tailItem=report.holdTail.line.nodes.find(i=>i.node.kind==='Hold');
  assert.equal(tailItem.tier,'Perfect');assert.equal(tailItem.holdActive,false);assert.ok(Math.abs(tailItem.disappearAtMs-holdEnd)<1e-6);
  await waitTime(holdEnd+350);
  report.holdDisappeared=await screenshot('hold-tail-disappeared',report);
  report.checks.push({name:'Hold touching vertical neighbor held across complete interval resolves Perfect once; disappearance begins at complete tail',pass:true});
  const lastTap=await nodeTime('Tap',1);
  await waitTime(lastTap+70);
  report.allResolved=await read();assert.equal(report.allResolved.perfect,4);assert.equal(report.allResolved.miss,0);assert.equal(report.allResolved.result,null);
  await evaluate(()=>window.__guidancePreview.input.requestExitChart());
  await until(()=>!window.__guidancePreview.builder.chartEntered);
  report.exit=await screenshot('exit-world',report);assert.equal(report.exit.ledger,0);assert.equal(report.exit.world,true);
  await evaluate(()=>{const r=window.__guidancePreview;r.spaceSent=false;r.nodeInputs.clear();r.heldKeys.clear();r.input.requestEnterChart();});
  await until(()=>window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getState()==='Playing');
  report.reentry=await screenshot('reentry-cleared',report);
  assert.equal(report.reentry.score,0);assert.ok(report.reentry.line.nodes.every(n=>n.tier===null&&n.disappearAtMs===null&&!n.holdActive));assert.equal(report.reentry.line.startedAtMs,null);
  report.checks.push({name:'midway exit does not append; reentry resets all Tap/Drag/Hold node state',pass:true});
  await waitTime(10000);
  report.at10Seconds=await read();assert.equal(report.at10Seconds.state,'Playing');assert.equal(report.at10Seconds.perfect,4);assert.equal(report.at10Seconds.ledger,0);assert.equal(report.at10Seconds.result,null);
  await until(()=>!window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getResult()?.completed,5000);
  report.completed=await screenshot('completion-world',report);assert.equal(report.completed.ledger,1);assert.equal(report.completed.result.perfectCount,4);assert.ok(Math.abs(report.completed.result.finishedAtMs-12000)<1e-6);
  await wait(100);assert.equal((await read()).ledger,1);
  report.checks.push({name:'all four nodes resolved waits through 10 seconds; actual 12 second media end appends once',pass:true});
  report.inputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);
  report.neighborInputs=await evaluate(()=>window.__guidancePreview.neighborInputs);
  assert.equal(report.neighborInputs.length,8);assert.ok(report.neighborInputs.every(event=>event.inputKeyId!==event.targetKeyId&&event.inputKeyId!=='Space'));
  assert.ok(report.neighborInputs.some(event=>event.kind==='Tap'&&event.relation==='corner'));
  assert.deepEqual(new Set(report.neighborInputs.map(event=>event.kind)),new Set(['Tap','Drag','Hold']));
  report.checks.push({name:'All 8 node inputs over two entries intentionally use a different touching neighbor; Tap uses true diagonal/corner contacts; P4/G0/M0',pass:true});
  report.sync=await evaluate(()=>window.__guidancePreview.sync);
  report.syncSummary={sampleCount:report.sync.length,maxRawPresentedErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.rawPresentedErrorMs))),maxProjectedPresentedErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.projectedPresentedErrorMs)))};
  assert.ok(report.sync.length>10);assert.ok(report.syncSummary.maxRawPresentedErrorMs<=30);
  report.checks.push({name:'requestVideoFrameCallback mediaTime vs AudioOutputClock same event <=30ms',pass:true});
  window.destroy();window=null;
}
app.whenReady().then(async()=>{
  try{
    results.compilation=await captureCompilation();
    await resolution(1920,1080);await resolution(2560,1440);assert.equal(results.rendererErrors.length,0);
    const after=await captureCompilation();
    assert.deepEqual(after.entries,results.compilation.entries,'Source or served compiler chunks changed during preview evidence capture');
    results.compilation.unchangedThroughEvidenceCapture=true;
    fs.writeFileSync(path.join(output,'creator-compilation.json'),JSON.stringify(results.compilation,null,2));
    results.pass=true;
  }
  catch(error){results.pass=false;results.failure={message:error.message,stack:error.stack};if(window){try{results.failure.snapshot=await read();results.failure.inputEvents=await evaluate(()=>window.__guidancePreview?.inputEvents);}catch{}}console.error(error);}
  finally{fs.writeFileSync(path.join(output,'creator-preview-results.json'),JSON.stringify(results,null,2));if(window)window.destroy();app.exit(results.pass?0:1);}
});
