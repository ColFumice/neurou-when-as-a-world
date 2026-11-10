// Real Creator 3.8.8 preview. DOM/native browser input only mutates the product;
// component/session reads assert behavior. No forged images, source, clocks or results.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {app,BrowserWindow}=require('electron');
const out=__dirname,root=path.resolve(out,'../..'),url='http://localhost:7457/';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const targets=['assets/scripts/MusicEditorBuilder.ts','assets/scripts/WorldFolderBuilder.ts','src/presentation/FolderCatalog.ts','src/presentation/MusicEditorView.ts','src/presentation/MusicPreviewAudio.ts','src/musicEditor/MusicProjectData.ts','src/musicEditor/MusicTiming.ts','src/musicEditor/MusicEditorSession.ts','src/musicEditor/ChartSourceBuilder.ts','src/editor/GuidanceEditorSession.ts','src/presentation/GuidanceEditorView.ts'];
app.setPath('userData',path.join(require('os').tmpdir(),'neurou-music-evidence-'+Date.now()));
for(const [key,value]of [['force-device-scale-factor','1'],['disable-background-timer-throttling'],['disable-renderer-backgrounding'],['disable-backgrounding-occluded-windows']])app.commandLine.appendSwitch(key,value);
app.on('window-all-closed',()=>{});
const report={creator:'3.8.8',url,inputPolicy:'DOM click/change + BrowserWindow native mouse. No session write helpers, fabricated sources, playback clocks, scores or renderer images. File API fixtures are valid JSON input at browser import boundary, clearly labelled.',resolutions:[],rendererErrors:[],downloads:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let win;
const ev=(fn,...args)=>win.webContents.executeJavaScript('('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')',true);
async function until(fn,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){const r=await ev(fn);if(r)return r;await wait(60);}throw Error('Timeout '+fn.toString());}
async function click(id){await ev(id=>{const e=document.querySelector(id);if(!e)throw Error('Missing '+id);if(e.disabled)throw Error('Disabled '+id);e.click();},id);await wait(100);}
async function set(id,value){await ev((id,value)=>{const e=document.querySelector(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},id,value);}
async function nativeClick(x,y){for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,x:Math.round(x),y:Math.round(y),button:'left',clickCount:1});await wait(130);}
async function compilation(){
  const map=await(await fetch(url+'scripting/x/import-map.json',{cache:'no-store'})).json(),entries=[];
  for(const file of targets){
    const suffix=file.startsWith('src/')?'assets/scripts/'+file:file;
    const id=Object.keys(map.imports).find(k=>k.endsWith('/'+suffix));assert.ok(id,'Creator missing '+file);
    const chunk=map.imports[id],chunkUrl=new URL(chunk,url+'scripting/x/').href;
    const bytes=Buffer.from(await(await fetch(chunkUrl,{cache:'no-store'})).arrayBuffer());
    assert.equal(sha(bytes),sha(fs.readFileSync(path.join(root,'temp/programming/packer-driver/targets/preview',chunk))));
    const sourceMap=await(await fetch(chunkUrl+'.map',{cache:'no-store'})).json(),source=fs.readFileSync(path.join(root,file),'utf8');
    assert.ok(sourceMap.sourcesContent.includes(source),'Stale Creator compilation '+file);
    entries.push({file,chunk,sourceSha256:sha(source),chunkSha256:sha(bytes),sourceMapMatches:true,servedEqualsCompilerOutput:true});
  }
  return {pass:true,entries};
}
async function setup(){
  await until(()=>typeof System!=='undefined'&&!!document.querySelector('#folder-login-form'));
  await ev(async()=>{
    const cc=await System.import('cc');cc.profiler.hideStats();
    const all=(n,name)=>n?[...n.getComponents(name),...n.children.flatMap(c=>all(c,name))]:[];
    window.__musicEvidence={cc,all,errors:[]};
    window.addEventListener('error',e=>window.__musicEvidence.errors.push(String(e.error?.stack||e.message)));
    window.addEventListener('unhandledrejection',e=>window.__musicEvidence.errors.push(String(e.reason?.stack||e.reason)));
  });
  await set('#folder-account','music-batch31-test');await click('#folder-login');
  if(await ev(()=>!!document.querySelector('#folder-complete-prologue')))await click('#folder-complete-prologue');
  await until(()=>!!document.querySelector('#world-folder'));
}
async function openMusic(){await click('#open-editor-folder');await click('[data-entry-id="MidiTrackEditor"]');await until(()=>!!document.querySelector('#music-editor'));
  await ev(()=>{const e=window.__musicEvidence;e.builder=e.all(e.cc.director.getScene(),'MusicEditorBuilder')[0];e.view=e.all(e.cc.director.getScene(),'MusicEditorView')[0];});
}
async function read(){return ev(()=>{
  const e=window.__musicEvidence,b=e.builder,v=e.all(e.cc.director.getScene(),'MusicEditorView')[0];
  return {document:b?.session?.getDocument(),source:v?.exportedSource??null,
    audio:v?{state:v.audio.getState(),context:v.audio.getContextState(),timeMs:v.audio.readTimeMs(),frames:v.audio.getRenderedFrames()}:null,
    gameplayCount:e.all(e.cc.director.getScene(),'FrameDriver').length,
    musicDom:document.querySelectorAll('#music-editor').length,guidanceDom:document.querySelectorAll('#guidance-editor').length,
    errors:e.errors.slice(),viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,
    status:document.querySelector('#music-status')?.textContent??null};
});}
async function capture(name,res){await ev(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const png=Buffer.from(shot.data,'base64'),file='legacy-'+res+'-'+name+'.png';fs.writeFileSync(path.join(out,file),png);const state=await read();assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],state.viewport);return {file,sha256:sha(png),state};}
async function selectNote(noteId){const p=await ev(id=>{const v=window.__musicEvidence.view,r=v.noteRects.find(r=>r.noteId===id),b=v.canvas.getBoundingClientRect();return{x:b.left+r.x+r.width/2,y:b.top+r.y+r.height/2};},noteId);await nativeClick(p.x,p.y);}
async function importJson(button,filename,text){
  // A File object at the actual browser import boundary; input handler is unchanged.
  await click(button);await ev((filename,text)=>{const input=document.querySelector('#music-import-file');const dt=new DataTransfer();dt.items.add(new File([text],filename,{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},filename,text);await wait(180);
}
async function runResolution(width,height){
  const res=width+'x'+height,r={resolution:res,screenshots:[]};
  win=new BrowserWindow({width,height,useContentSize:true,show:false,frame:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false,partition:'persist:music-'+'legacy-'+res+'-'+Date.now()}});
  win.webContents.debugger.attach('1.3');
  win.webContents.on('console-message',event=>{if(event.level===3||event.level==='error')report.rendererErrors.push({res,message:event.message});});
  win.webContents.session.on('will-download',(_e,item)=>{const target=path.join(out,'legacy-'+res+'-'+item.getFilename());item.setSavePath(target);item.once('done',(_e,state)=>report.downloads.push({res,file:path.basename(target),state,sha256:state==='completed'?sha(fs.readFileSync(target)):null}));});
  await win.loadURL(url);await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await setup();await openMusic();
  const initial=await read();assert.deepEqual(initial.viewport,[width,height]);assert.equal(initial.document.project.tracks.length,2);assert.equal(initial.gameplayCount,0);assert.equal(initial.overflow,false);
  r.screenshots.push(await capture('01-editor',res));
  const noteId=initial.document.project.tracks[0].notes[1].id;
  await selectNote(noteId);await set('#music-note-tick',2160);await set('#music-note-duration',360);await set('#music-note-pitch',65);await set('#music-note-velocity',104);await click('#music-note-apply');
  const changed=await read(),note=changed.document.project.tracks[0].notes.find(n=>n.id===noteId);
  assert.deepEqual([note.tick,note.durationTicks,note.pitch,note.velocity],[2160,360,65,104]);
  r.screenshots.push(await capture('02-edit',res));
  const blank=await ev(()=>{const v=window.__musicEvidence.view,r=v.trackRects[0],b=v.canvas.getBoundingClientRect();return{x:b.left+r.x+r.width*.48,y:b.top+r.y+r.height*.60};});
  await nativeClick(blank.x,blank.y);let s=await read();assert.equal(s.document.project.tracks[0].notes.length,4);const added=s.document.project.tracks[0].notes.find(n=>!initial.document.project.tracks[0].notes.some(a=>a.id===n.id));assert.ok(added);
  await click('#music-delete-note');assert.equal((await read()).document.project.tracks[0].notes.length,3);
  await click('#music-undo');assert.equal((await read()).document.project.tracks[0].notes.length,4);
  await click('#music-redo');assert.equal((await read()).document.project.tracks[0].notes.length,3);
  r.editing={modified:note,added,addDeleteUndoRedo:true};
  await selectNote(noteId);const beforeInvalid=(await read()).document;await set('#music-note-pitch',128);await click('#music-note-apply');const invalid=await read();assert.deepEqual(invalid.document,beforeInvalid);assert.ok(invalid.status);
  await selectNote(noteId);
  await set('#music-bpm',100);await click('#music-set-bpm');assert.equal((await read()).document.project.tempoMap[0].bpm,100);
  await click('#music-save-draft');const saved=await read();r.savedDocument=saved.document;
  await click('#music-play');await until(()=>document.querySelector('#music-playback-state')?.dataset.state==='Playing');
  await wait(1700);const playing=await read();assert.equal(playing.audio.context,'running');assert.ok(playing.audio.frames>0);assert.ok(playing.audio.timeMs>1400);r.screenshots.push(await capture('03-playback',res));
  const pcm=await ev(()=>{const a=window.__musicEvidence.view.audio,buf=a.source.buffer,p=buf.getChannelData(0);let peak=0,square=0,nonzero=0;for(const n of p){peak=Math.max(peak,Math.abs(n));square+=n*n;if(n!==0)nonzero++;}return{sampleRate:buf.sampleRate,length:buf.length,peak,rms:Math.sqrt(square/p.length),nonzero,context:a.context.state,sourceConnected:!!a.source};});assert.ok(pcm.peak>0&&pcm.peak<=.851);assert.ok(pcm.nonzero>100);r.playback={playing:playing.audio,pcm};
  await click('#music-pause');const paused=await read();await wait(250);const pausedLater=await read();assert.equal(paused.audio.state,'Paused');assert.equal(paused.audio.timeMs,pausedLater.audio.timeMs);r.playback.paused=paused.audio;
  await set('#music-seek',2500);await click('#music-play');await until(()=>document.querySelector('#music-playback-state')?.dataset.state==='Playing');await wait(180);assert.ok((await read()).audio.timeMs>=2500);await click('#music-stop');assert.equal((await read()).audio.timeMs,0);r.playback.pauseSeekResumeStop=true;
  await click('#music-export');await until(()=>!document.querySelector('#music-open-guidance').disabled);const exported=await read();assert.equal(exported.source.provenance,'Midi');assert.equal(exported.source.events.length,6);assert.equal(exported.source.schemaVersion,1);
  const e=exported.source.events.find(e=>e.id===noteId);assert.equal(e.timeMs,2700);assert.equal(e.endTimeMs,3150);
  r.source=exported.source;await ev(()=>document.querySelector('#music-export-details').scrollIntoView({block:'end'}));r.screenshots.push(await capture('04-export',res));
  await click('#music-open-guidance');await until(()=>!!document.querySelector('#guidance-editor'));
  const consumed=await ev(()=>{const b=window.__musicEvidence.builder;return {document:b.guidanceSession.getDocument(),output:b.guidanceSession.exportChart(),sourceBadge:document.querySelector('#editor-source').textContent,musicDom:document.querySelectorAll('#music-editor').length};});
  assert.deepEqual(consumed.document.source,exported.source);assert.equal(consumed.output.chart.schemaVersion,3);assert.ok(consumed.sourceBadge.includes('MIDI'));assert.equal(consumed.musicDom,0);r.consumed=consumed;
  r.screenshots.push(await capture('05-guidance-consumes',res));await click('#export-chart');await wait(300);
  await click('#music-return');await until(()=>!!document.querySelector('#music-editor'));await ev(()=>{const e=window.__musicEvidence;e.view=e.all(e.cc.director.getScene(),'MusicEditorView')[0];});assert.deepEqual((await read()).document,saved.document);
  // Re-entry must not overwrite the old browser draft with the default project's revision 0.
  await click('#folder-runtime-exit');await until(()=>!!document.querySelector('#world-folder'));await openMusic();const oldStored=await ev(()=>JSON.parse(localStorage.getItem('neurou-music-draft-v1')));assert.deepEqual(oldStored,saved.document);await click('#music-restore-draft');assert.deepEqual((await read()).document,saved.document);r.draftReentry={pass:true,revision:saved.document.revision,history:saved.document.history.entries.length};
  const badProject=JSON.parse(JSON.stringify(saved.document.project));badProject.unknownField=true;
  await importJson('#music-import-project','invalid.music.json',JSON.stringify(badProject));assert.deepEqual((await read()).document,saved.document);r.invalidImportTransactional=true;
  await click('#music-download-draft');await wait(120);
  // Valid project JSON boundary tests tempo map, 6/8, positive track offset without touching logic state.
  const project=JSON.parse(JSON.stringify(saved.document.project));project.timeSignature={numerator:6,denominator:8};project.tempoMap=[{tick:0,bpm:120},{tick:1920,bpm:60}];project.tracks[1].offsetMs=250;
  await importJson('#music-import-project','tempo-offset.music.json',JSON.stringify(project));assert.deepEqual((await read()).document.project,project);r.tempoOffsetImport={pass:true,timeSignature:project.timeSignature,tempoMap:project.tempoMap,offsetMs:250};
  await set('#music-seek',3000);const mapping=await ev(()=>{const v=window.__musicEvidence.view;return {globalTick:v.reader.getTickAtTimeMs(v.audio.readTimeMs()),trackTicks:v.reader.getDocument().project.tracks.map(t=>v.reader.getTickAtTimeMs(Math.max(0,v.audio.readTimeMs()-t.offsetMs))),noteTimes:v.reader.getPlaybackNotes()};});assert.equal(mapping.globalTick,2400);assert.equal(mapping.trackTicks[1],2280);r.tempoOffsetImport.mapping=mapping;
  // Draft restore through the actual File input restores full history to the original saved snapshot.
  await importJson('#music-import-draft','restored.draft.json',JSON.stringify(saved.document));assert.deepEqual((await read()).document,saved.document);r.draftFileRestore=true;
  await click('#music-play');await until(()=>document.querySelector('#music-playback-state')?.dataset.state==='Playing');
  await ev(()=>{window.__musicEvidence.retiredAudio=window.__musicEvidence.view.audio;window.__musicEvidence.retiredContext=window.__musicEvidence.view.audio.context;});
  await click('#folder-runtime-exit');await until(()=>!!document.querySelector('#world-folder'));await wait(200);
  const teardown=await ev(()=>{const e=window.__musicEvidence;return{musicDom:document.querySelectorAll('#music-editor').length,guidanceDom:document.querySelectorAll('#guidance-editor').length,builders:e.all(e.cc.director.getScene(),'MusicEditorBuilder').length,viewCount:e.all(e.cc.director.getScene(),'MusicEditorView').length,state:e.retiredAudio.getState(),contextState:e.retiredContext.state,source:e.retiredAudio.source,gameplayCount:e.all(e.cc.director.getScene(),'FrameDriver').length,errors:e.errors.slice()};});assert.deepEqual([teardown.musicDom,teardown.guidanceDom,teardown.builders,teardown.viewCount,teardown.gameplayCount],[0,0,0,0,0]);assert.equal(teardown.state,'Stopped');assert.equal(teardown.contextState,'closed');assert.equal(teardown.source,null);assert.deepEqual(teardown.errors,[]);r.teardown=teardown;
  win.destroy();win=null;return r;
}
app.whenReady().then(async()=>{try{
  report.compilation=await compilation();
  for(const [w,h]of [[1920,1080],[2560,1440]])report.resolutions.push(await runResolution(w,h));
  const [a,b]=report.resolutions;assert.deepEqual(a.source,b.source);assert.deepEqual(a.consumed.output,b.consumed.output);report.resolutionComparison={sameSource:true,sameGuidanceOutput:true,sameEditedNote:true};
  for(const download of report.downloads){assert.equal(download.state,'completed');if(download.file.endsWith('.chart-source.json')){const data=JSON.parse(fs.readFileSync(path.join(out,download.file),'utf8'));assert.deepEqual(data,report.resolutions.find(r=>r.resolution===download.res).source);}}
  assert.ok(report.downloads.filter(d=>d.file.endsWith('.chart-source.json')).length===2);
  assert.deepEqual(report.rendererErrors,[]);report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;console.error(e.stack);}finally{fs.writeFileSync(path.join(out,'legacy-creator-preview-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,resolutions:report.resolutions.length,downloads:report.downloads.length,error:report.error}));if(win)win.destroy();app.exit(report.pass?0:1);}});
