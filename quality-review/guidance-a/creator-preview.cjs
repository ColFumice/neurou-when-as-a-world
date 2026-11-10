// Real Creator browser preview evidence. No source edits and no artificial score/node state.
// Fixture: grant the existing T6 endpoint permission once; all chart actions then pass
// through DOM keyboard events -> InputCollector -> FrameDriver -> DirectorSession.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const output = __dirname;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.setPath('userData', path.join(output, 'electron-profile'));
app.on('window-all-closed',()=>{});
console.log('HARNESS loaded');
const e2eOnly=process.argv.includes('--e2e-only');
const results = e2eOnly && fs.existsSync(path.join(output,'creator-preview-results.json'))
  ? JSON.parse(fs.readFileSync(path.join(output,'creator-preview-results.json'),'utf8'))
  : { creator: '3.8.8', url: 'http://localhost:7456/',
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
  const runtime = { cc, builder, input, get video(){return builder.videoPlayer.nativeVideo;}, frameHandle:null,
    inputEvents: [], sync: [], autoHead: false, autoTap: false, pauseHead: false,
    headPauseRequested: false, spaceSent: false, tapSent: false };
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
      visuals:{headVisible:effect?.headSprite?.node.active,headScale:effect?.headSprite?.node.scale.x,
        headAlpha:effect?.headSprite?.color.a,container:effect ? [effect.node.getComponent(cc.UITransform).width,effect.node.getComponent(cc.UITransform).height]:null},
      dimensions:{inner:[innerWidth,innerHeight],canvas:[canvas.width,canvas.height],canvasCss:[canvas.clientWidth,canvas.clientHeight],dpr:devicePixelRatio}};
  };
  runtime.edge=(keyId,down)=>document.getElementById('GameCanvas').dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code:keyId,repeat:false,bubbles:true,cancelable:true}));
  runtime.timer = setInterval(() => {
    if(runtime.video && runtime.frameHandle===null){runtime.frameHandle=runtime.video.requestVideoFrameCallback(frame);}
    const p=builder.chartPremiere, snapshot=p.getGuidanceSnapshot();
    if(p.getState()!=='Playing' || !snapshot)return;
    if(builder.readVideoTimeMs()<0)return;
    if(snapshot.state==='Waiting' && runtime.autoHead && !runtime.spaceSent){
      if(runtime.pauseHead && !runtime.headPauseRequested){runtime.headPauseRequested=true;input.requestToggleChartPause();return;}
      if(!runtime.pauseHead){runtime.spaceSent=true;runtime.press('Space');}
    }
    if(snapshot.startedAtMs!==null && runtime.autoTap && !runtime.tapSent){
      const line=builder.chartData.lines[0];
      const target=snapshot.startedAtMs+line.nodes[0].pathDistance/line.speed*1000;
      if(builder.readVideoTimeMs()>=target-8){
        const point=snapshot.judgmentPoint.position;
        // Read exact current input time position through chart's frozen pure function,
        // never through displayed pixels and never from a default/fallback key.
        const distance=line.speed*(builder.readVideoTimeMs()-snapshot.startedAtMs)/1000;
        const fraction=distance/(Math.hypot((line.path.points[1].u-line.path.points[0].u)*builder.chartData.aspectRatio,line.path.points[1].v-line.path.points[0].v));
        const pos={u:line.path.points[0].u+(line.path.points[1].u-line.path.points[0].u)*fraction,v:line.path.points[0].v+(line.path.points[1].v-line.path.points[0].v)*fraction};
        const keys=builder.keyboardLayout.slots.filter(s=>s.keyId!=='Space'&&pos.u>=s.u&&pos.u<s.u+s.width&&pos.v>=s.v&&pos.v<s.v+s.height);
        if(keys.length!==1)throw new Error('No unique dynamic key at input time: '+JSON.stringify({point,pos,keys}));
        runtime.tapSent=true;runtime.press(keys[0].keyId);
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
async function resolution(width,height){
  console.log('HARNESS resolution '+width+'x'+height);
  const report={resolution:width+'x'+height,evidence:[],checks:[]};results.resolutions.push(report);
  window=new BrowserWindow({width,height,show:false,frame:false,useContentSize:true,
    webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  window.webContents.on('console-message',(event,level,message)=>{if(level===3)results.rendererErrors.push({resolution:report.resolution,message});});
  window.webContents.on('render-process-gone',(event,details)=>results.rendererErrors.push({resolution:report.resolution,details}));
  await window.loadURL('http://localhost:7456/');
  await until(()=>typeof System!=='undefined'&&!!document.getElementById('GameCanvas'));
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await wait(100);
  let ready;
  for(let i=0;i<100;i++){ready=await evaluate(setup);if(ready.ready)break;await wait(100);}
  assert.equal(ready.ready,true,'ready/Head LOGO resource: '+JSON.stringify(ready));
  assert.equal(ready.chartId,'guidance-a-1');
  const initial=await read();
  assert.deepEqual(initial.dimensions.inner,[width,height]);
  assert.deepEqual(initial.dimensions.canvas,[width,height]);
  report.dimensions=initial.dimensions;
  await evaluate(()=>{const r=window.__guidancePreview;r.builder.graph.session.endpointSettled=true;r.autoHead=true;r.autoTap=true;r.pauseHead=true;r.input.requestEnterChart();});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getState()==='Paused');
  const head=await screenshot('head-waiting',report);assert.equal(head.line.state,'Waiting');assert.equal(head.visuals.headVisible,true);
  await evaluate(()=>{const r=window.__guidancePreview;r.pauseHead=false;r.input.requestToggleChartPause();});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getGuidanceSnapshot().startedAtMs!==null);
  await until(()=>{const p=window.__guidancePreview.builder.chartPremiere,s=p.getGuidanceSnapshot();return p.getCurrentTimeMs()>=s.startedAtMs+500;});
  const movementBefore=await screenshot('movement-before',report);
  await until(()=>{const p=window.__guidancePreview.builder.chartPremiere,s=p.getGuidanceSnapshot();return p.getCurrentTimeMs()>=s.startedAtMs+800;});
  await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());
  await until(()=>window.__guidancePreview.builder.chartPremiere.getState()==='Paused');
  const pausedBefore=await screenshot('pause-before',report);await wait(350);
  const pausedAfter=await screenshot('pause-after',report);
  assert.equal(pausedBefore.timeMs,pausedAfter.timeMs);assert.deepEqual(pausedBefore.line,pausedAfter.line);assert.deepEqual(pausedBefore.visuals,pausedAfter.visuals);
  report.checks.push({name:'pause freezes media/path/judgement/visual animation',pass:true});
  await evaluate(()=>window.__guidancePreview.input.requestToggleChartPause());
  await until(()=>{const p=window.__guidancePreview.builder.chartPremiere,s=p.getGuidanceSnapshot();return p.getCurrentTimeMs()>=s.startedAtMs+1300;});
  const movementAfter=await screenshot('movement-after',report);
  const speed=await evaluate(()=>window.__guidancePreview.builder.chartData.lines[0].speed);
  const deltaMs=movementAfter.timeMs-movementBefore.timeMs;
  const deltaDistance=movementAfter.line.judgmentPoint.pathDistance-movementBefore.line.judgmentPoint.pathDistance;
  report.motion={speed,deltaMs,deltaDistance,expectedDistance:speed*deltaMs/1000,error:Math.abs(deltaDistance-speed*deltaMs/1000)};
  assert.ok(report.motion.error<1e-9);report.checks.push({name:'equal elapsed media time advances equal arc length and remaining line erases',pass:true});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getResolvedCount()===1);
  const tap=await screenshot('tap-judged',report);assert.equal(tap.perfect,1);assert.equal(tap.result,null);
  await evaluate(()=>window.__guidancePreview.input.requestExitChart());
  await until(()=>!window.__guidancePreview.builder.chartEntered);
  const exit=await screenshot('exit-world',report);assert.equal(exit.world,true);assert.equal(exit.ledger,0);
  await evaluate(()=>{const r=window.__guidancePreview;r.spaceSent=false;r.tapSent=false;r.pauseHead=false;r.input.requestEnterChart();});
  await until(()=>window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getState()==='Playing');
  const reentry=await screenshot('reentry-cleared',report);assert.equal(reentry.score,0);assert.equal(reentry.perfect,0);assert.equal(reentry.line.startedAtMs,null);assert.equal(reentry.line.judgmentPoint,null);
  report.checks.push({name:'midway exit restores world without ledger; reentry clears all chart state',pass:true});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getCurrentTimeMs()>=10000,18000);
  report.at10Seconds=await read();assert.equal(report.at10Seconds.state,'Playing');assert.equal(report.at10Seconds.perfect,1);assert.equal(report.at10Seconds.result,null);assert.equal(report.at10Seconds.ledger,0);
  await until(()=>window.__guidancePreview.builder.chartPremiere.getCurrentTimeMs()>=11800);
  report.beforeMediaEnd=await read();assert.equal(report.beforeMediaEnd.state,'Playing');assert.equal(report.beforeMediaEnd.ledger,0);
  await until(()=>!window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getResult()?.completed,5000);
  report.completed=await screenshot('completion-world',report);assert.equal(report.completed.result.completed,true);assert.equal(report.completed.ledger,1);assert.ok(Math.abs(report.completed.result.finishedAtMs-12000)<1e-6);
  await wait(100);assert.equal((await read()).ledger,1);
  report.checks.push({name:'10 seconds all resolved remains Playing; actual 12 seconds media end appends once',pass:true});
  report.inputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);
  report.sync=await evaluate(()=>window.__guidancePreview.sync);
  report.syncSummary={sampleCount:report.sync.length,
    maxClockHeadErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.clockHeadErrorMs))),
    maxRawPresentedErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.rawPresentedErrorMs))),
    maxProjectedPresentedErrorMs:Math.max(...report.sync.map(s=>Math.abs(s.projectedPresentedErrorMs)))};
  assert.ok(report.sync.length>10);assert.ok(report.syncSummary.maxClockHeadErrorMs<=30);
  assert.ok(report.syncSummary.maxRawPresentedErrorMs<=30);
  report.checks.push({name:'same event audio output clock vs real media head <=30ms',pass:true});
  report.checks.push({name:'requestVideoFrameCallback mediaTime vs AudioOutputClock same event <=30ms',pass:true,maxDeviationMs:report.syncSummary.maxRawPresentedErrorMs});
  window.destroy();window=null;
}
async function endToEnd(){
  console.log('HARNESS real T6 -> Guidance A -> world');
  const report={resolution:'e2e-1920x1080',fixture:'None: fresh scene with endpointSettled initially false; DOM held KeyA, Tab, output-clock beat Digit1 edges, automatic reveal, Space and dynamically selected Tap key.',evidence:[],checks:[]};
  results.endToEnd=report;
  window=new BrowserWindow({width:1920,height:1080,show:false,frame:false,useContentSize:true,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  window.webContents.on('console-message',(event,level,message)=>{if(level===3)results.rendererErrors.push({resolution:report.resolution,message});});
  await window.loadURL('http://localhost:7456/');
  await until(()=>typeof System!=='undefined'&&!!document.getElementById('GameCanvas'));
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await wait(100);
  let ready;for(let i=0;i<100;i++){ready=await evaluate(setup);if(ready.ready)break;await wait(100);}
  assert.equal(ready.ready,true);
  report.initial=await evaluate(()=>{const r=window.__guidancePreview;return {endpointSettled:r.builder.graph.session.endpointSettled,ledger:r.builder.graph.session.getLedgerEvents().length,position:r.builder.graph.protagonist.getPosition()};});
  assert.equal(report.initial.endpointSettled,false);assert.equal(report.initial.ledger,0);
  await evaluate(()=>{const r=window.__guidancePreview;r.autoHead=true;r.autoTap=true;r.pauseHead=false;r.press('Tab');r.edge('KeyA',true);});
  await until(()=>window.__guidancePreview.builder.graph.protagonist.getPosition().lateral<=-5.9,10000);
  await evaluate(()=>window.__guidancePreview.edge('KeyA',false));
  await wait(50);
  report.approach=await evaluate(()=>{const r=window.__guidancePreview;return {position:r.builder.graph.protagonist.getPosition(),stage:r.builder.puzzleProgress.getStage(),screenProjection:r.builder.screenProjectionOf(),ledger:r.builder.graph.session.getLedgerEvents().length};});
  assert.equal(report.approach.stage,'AwaitingStrike');
  await screenshot('approach',report);
  await evaluate(()=>{
    const r=window.__guidancePreview;r.beats=[];r.puzzleSamples=[];let nextBeat=null,lastSample=-1;
    r.beatTimer=setInterval(()=>{
      const b=r.builder,time=b.audioOutputClock.readBgmTimeMs();
      if(time>=0 && !b.chartEntered){
        if(time-lastSample>200){lastSample=time;r.puzzleSamples.push({timeMs:time,stage:b.puzzleProgress.getStage(),sustainedMs:b.puzzleChain.getSustainedElapsedMs(),ledger:b.graph.session.getLedgerEvents().length,lastStrikeDeviationMs:b.lastStrikeDeviationMs});}
        if(b.puzzleProgress.getStage()==='AwaitingStrike'){
          if(nextBeat===null)nextBeat=Math.ceil(time/1000)*1000;
          if(time>=nextBeat-5){r.beats.push({targetBeatMs:nextBeat,outputClockMs:time,deviationMs:time-nextBeat});r.press('Digit1');nextBeat+=1000;}
        }
      }
    },4);
  });
  await until(()=>window.__guidancePreview.builder.chartEntered,18000);
  report.chartEntry=await screenshot('natural-chart-entry',report);assert.equal(report.chartEntry.ledger,1);
  report.beats=await evaluate(()=>window.__guidancePreview.beats);
  report.puzzleSamples=await evaluate(()=>window.__guidancePreview.puzzleSamples);
  assert.ok(report.beats.length>=7);assert.ok(report.beats.every(b=>Math.abs(b.deviationMs)<=50));
  report.checks.push({name:'real held keyboard movement + continuous seven-second output-clock beats naturally reveal and enter chart; one T6 ledger event',pass:true});
  await until(()=>window.__guidancePreview.builder.chartPremiere.getResolvedCount()===1,8000);
  report.tap=await screenshot('tap-perfect',report);assert.equal(report.tap.perfect,1);assert.equal(report.tap.ledger,1);
  await until(()=>!window.__guidancePreview.builder.chartEntered&&window.__guidancePreview.builder.chartPremiere.getResult()?.completed,15000);
  report.completed=await screenshot('complete-world-two-ledger',report);assert.equal(report.completed.ledger,2);assert.equal(report.completed.world,true);assert.ok(Math.abs(report.completed.result.finishedAtMs-12000)<1e-6);
  report.ledger=await evaluate(()=>window.__guidancePreview.builder.graph.session.getLedgerEvents());
  report.checks.push({name:'normal Head + dynamic Tap + actual 12 seconds media end returns world with exactly two director ledger events',pass:true});
  report.inputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);
  report.pass=true;window.destroy();window=null;
}
app.whenReady().then(async()=>{
  try{if(!e2eOnly){await resolution(1920,1080);await resolution(2560,1440);}await endToEnd();results.pass=true;delete results.failure;}
  catch(error){results.pass=false;results.failure={message:error.message,stack:error.stack};if(window){try{results.failure.snapshot=await read();results.failure.inputEvents=await evaluate(()=>window.__guidancePreview?.inputEvents);}catch{}}console.error(error);}
  finally{fs.writeFileSync(path.join(output,'creator-preview-results.json'),JSON.stringify(results,null,2));if(window)window.destroy();app.exit(results.pass?0:1);}
});
