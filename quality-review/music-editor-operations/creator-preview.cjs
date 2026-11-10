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
  return {document:b?.session?.getDocument(),source:v?.exportedSource??null, selection:v?[...v.selectedNoteIds].sort():[], gesture:v?.pointerGesture?{kind:v.pointerGesture.kind,deltaTick:v.pointerGesture.deltaTick,deltaPitch:v.pointerGesture.deltaPitch,invalid:v.pointerGesture.invalid}:null,
    audio:v?{state:v.audio.getState(),context:v.audio.getContextState(),timeMs:v.audio.readTimeMs(),frames:v.audio.getRenderedFrames()}:null,
    gameplayCount:e.all(e.cc.director.getScene(),'FrameDriver').length,
    musicDom:document.querySelectorAll('#music-editor').length,guidanceDom:document.querySelectorAll('#guidance-editor').length,
    errors:e.errors.slice(),viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,
    status:document.querySelector('#music-status')?.textContent??null};
});}
async function capture(name,res){await ev(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const png=Buffer.from(shot.data,'base64'),file=res+'-'+name+'.png';fs.writeFileSync(path.join(out,file),png);const state=await read();assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],state.viewport);return {file,sha256:sha(png),state};}
async function selectNote(noteId){const p=await ev(id=>{const v=window.__musicEvidence.view,r=v.noteRects.find(r=>r.noteId===id),b=v.canvas.getBoundingClientRect();return{x:b.left+r.x+r.width/2,y:b.top+r.y+r.height/2};},noteId);await nativeClick(p.x,p.y);}
async function importJson(button,filename,text){
  // A File object at the actual browser import boundary; input handler is unchanged.
  await click(button);await ev((filename,text)=>{const input=document.querySelector('#music-import-file');const dt=new DataTransfer();dt.items.add(new File([text],filename,{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},filename,text);await wait(180);
}
// Real mouse gestures and keyboard shortcuts. Reads observe UI/session; no direct writes.
async function key(keyCode,modifiers=[]){
  win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});
  win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await wait(110);
}
async function mouse(type,p,modifiers=[]){win.webContents.sendInputEvent({type,x:Math.round(p.x),y:Math.round(p.y),button:'left',clickCount:1,modifiers});await wait(45);}
async function pointClick(p,modifiers=[]){await mouse('mouseMove',p,modifiers);await mouse('mouseDown',p,modifiers);await mouse('mouseUp',p,modifiers);await wait(90);}
async function pointNote(id){return ev(id=>{const v=window.__musicEvidence.view,r=v.noteRects.find(n=>n.noteId===id),b=v.canvas.getBoundingClientRect();if(!r)throw Error('No note rect '+id);return{x:b.left+r.x+r.width/2,y:b.top+r.y+r.height/2};},id);}
async function noteClick(id,modifiers=[]){await pointClick(await pointNote(id),modifiers);}
async function state(){return ev(()=>{const e=window.__musicEvidence,v=e.view;return{document:e.builder.session.getDocument(),selected:[...v.selectedNoteIds].sort(),track:v.selectedTrackId,clipboard:v.clipboard,drag:v.pointerGesture?{kind:v.pointerGesture.kind,deltaTick:v.pointerGesture.deltaTick,deltaPitch:v.pointerGesture.deltaPitch,invalid:v.pointerGesture.invalid}:null,status:document.querySelector('#music-status').textContent,applyDisabled:document.querySelector('#music-note-apply').disabled,viewport:[innerWidth,innerHeight]};});}
function projectNotes(d){return d.project.tracks.flatMap(t=>t.notes.map(n=>({...n,trackId:t.id})));}
function sorted(xs){return [...xs].sort();}
function countHistory(d){return d.history.entries.length;}
async function dragStart(p,q){await mouse('mouseMove',p);await mouse('mouseDown',p);for(let i=1;i<=5;i++)await mouse('mouseMove',{x:p.x+(q.x-p.x)*i/5,y:p.y+(q.y-p.y)*i/5});}
async function dragEnd(q){await mouse('mouseUp',q);await wait(110);}
async function deltaTarget(p,tick,pitch,trackId){return ev((p,tick,pitch,trackId)=>{const v=window.__musicEvidence.view,r=v.trackRects.find(t=>t.trackId===trackId),d=v.reader.getDocument().project;return{x:p.x+tick/d.durationTicks*r.width,y:p.y-pitch*r.height/(r.maximumPitch-r.minimumPitch+1)};},p,tick,pitch,trackId);}
async function runResolution(width,height){
  const res=width+'x'+height,r={resolution:res,screenshots:[],checks:[]};
  const check=(name,evidence)=>r.checks.push({name,pass:true,evidence});
  win=new BrowserWindow({width,height,useContentSize:true,show:false,frame:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false,partition:'persist:music-operations-'+res+'-'+Date.now()}});
  win.webContents.debugger.attach('1.3');
  win.webContents.on('console-message',event=>{if(event.level===3||event.level==='error')report.rendererErrors.push({res,message:event.message});});
  win.webContents.session.on('will-download',(_e,item)=>{const target=path.join(out,res+'-'+item.getFilename());item.setSavePath(target);item.once('done',(_e,state)=>report.downloads.push({res,file:path.basename(target),state,sha256:state==='completed'?sha(fs.readFileSync(target)):null}));});
  await win.loadURL(url);await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await setup();await openMusic();
  const initial=(await state()).document;assert.deepEqual((await state()).viewport,[width,height]);
  await noteClick('music-note-2');let s=await state();assert.deepEqual(s.selected,['music-note-2']);assert.equal(s.applyDisabled,false);
  assert.equal(await ev(()=>document.querySelector('#music-note-pitch').value),'64');check('single-click-properties');
  await noteClick('music-note-1',['control']);assert.deepEqual((await state()).selected,['music-note-1','music-note-2']);assert.equal((await state()).applyDisabled,true);
  await noteClick('music-note-1',['control']);assert.deepEqual((await state()).selected,['music-note-2']);check('ctrl-click-add-remove');
  await noteClick('music-note-1');await noteClick('music-note-3',['shift']);assert.deepEqual((await state()).selected,['music-note-1','music-note-2','music-note-3']);check('shift-track-range');
  await noteClick('music-note-4',['control']);assert.equal((await state()).selected.length,4);check('ctrl-cross-track');
  await noteClick('music-note-4');await key('A',['control']);assert.deepEqual((await state()).selected,['music-note-4','music-note-5','music-note-6']);await key('Escape');assert.deepEqual((await state()).selected,[]);check('current-track-select-all-escape');
  await noteClick('music-note-4');await noteClick('music-note-1',['control']);await noteClick('music-note-3',['control','shift']);assert.deepEqual((await state()).selected,['music-note-1','music-note-2','music-note-3','music-note-4']);check('ctrl-shift-range-add');await key('Escape');
  const box=await ev(()=>{const v=window.__musicEvidence.view,b=v.canvas.getBoundingClientRect(),rs=v.noteRects;return{p:{x:b.left+Math.min(...rs.map(r=>r.x))-9,y:b.top+Math.min(...rs.map(r=>r.y))-9},q:{x:b.left+Math.max(...rs.map(r=>r.x+r.width))+9,y:b.top+Math.max(...rs.map(r=>r.y+r.height))+9}};});
  await dragStart(box.p,box.q);assert.deepEqual((await state()).document,initial);await dragEnd(box.q);assert.equal((await state()).selected.length,6);check('cross-track-marquee-no-history');
  r.screenshots.push(await capture('01-multiselect',res));
  const beforeCopy=(await state()).document;await key('C',['control']);assert.deepEqual((await state()).document,beforeCopy);check('clipboard-not-history');
  await set('#music-track','track-2');
  const anchor=await ev(()=>{const v=window.__musicEvidence.view,b=v.canvas.getBoundingClientRect(),t=v.trackRects.find(t=>t.trackId==='track-2'),p=v.reader.getDocument().project;return{x:b.left+t.x+6000/p.durationTicks*t.width,y:b.top+t.y+(t.maximumPitch-72+.5)*t.height/(t.maximumPitch-t.minimumPitch+1)};});
  await mouse('mouseMove',anchor);await key('V',['control']);s=await state();assert.equal(s.selected.length,6);assert.equal(s.document.project.tracks[1].notes.length,9);assert.equal(s.document.history.cursor,initial.history.cursor+1);assert.equal(countHistory(s.document),initial.history.cursor+1);assert.equal(s.document.revision,initial.revision+1);
  const pasted=projectNotes(s.document).filter(n=>s.selected.includes(n.id));const original=projectNotes(initial).sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id));
  assert.deepEqual(pasted.map(n=>[n.tick,n.pitch,n.durationTicks,n.velocity,n.position]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),original.map(n=>[n.tick-960+6000,n.pitch-60+72,n.durationTicks,n.velocity,n.position]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
  assert.ok(pasted.every(n=>n.trackId==='track-2'));check('pointer-paste-relative-cross-to-current',{notes:6,anchorTick:6000,anchorPitch:72});r.screenshots.push(await capture('02-copy-paste',res));
  const pastedDocument=s.document;await key('Z',['control']);assert.deepEqual((await state()).document.project,initial.project);await key('Z',['control','shift']);assert.deepEqual((await state()).document.project,pastedDocument.project);check('paste-one-undo-redo');
  await mouse('mouseMove',{x:20,y:30});await set('#music-seek',2500);const beforeFallback=(await state()).document;await key('V',['control']);s=await state();const fallback=projectNotes(s.document).filter(n=>s.selected.includes(n.id));assert.deepEqual(fallback.map(n=>[n.tick,n.pitch]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),original.map(n=>[n.tick-960+2400,n.pitch]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));await key('Z',['control']);assert.deepEqual((await state()).document.project,beforeFallback.project);check('playhead-paste-original-pitch');
  await noteClick('music-note-4');await key('A',['control']);const beforeDelete=(await state()).document;assert.equal((await state()).selected.length,9);await key('Backspace');s=await state();assert.equal(s.document.project.tracks[1].notes.length,0);assert.equal(s.document.history.cursor,beforeDelete.history.cursor+1);assert.equal(countHistory(s.document),beforeDelete.history.cursor+1);assert.equal(s.document.revision,beforeDelete.revision+1);assert.deepEqual(s.selected,[]);r.screenshots.push(await capture('03-batch-delete',res));
  await key('Z',['control']);assert.deepEqual((await state()).document.project,beforeDelete.project);await key('Z',['control','shift']);assert.equal((await state()).document.project.tracks[1].notes.length,0);await key('Z',['control']);check('batch-delete-backspace-one-undo-redo');
  await noteClick('music-note-1');const singleBefore=(await state()).document,p=await pointNote('music-note-1'),q=await deltaTarget(p,480,1,'track-1');await dragStart(p,q);assert.deepEqual((await state()).document,singleBefore);await dragEnd(q);s=await state();const single=projectNotes(s.document).find(n=>n.id==='music-note-1');assert.deepEqual([single.tick,single.pitch],[1440,61]);assert.equal(s.document.history.cursor,singleBefore.history.cursor+1);assert.equal(countHistory(s.document),singleBefore.history.cursor+1);assert.equal(s.document.revision,singleBefore.revision+1);await key('Z',['control']);check('single-drag-one-transaction');
  await noteClick('music-note-1');await noteClick('music-note-4',['control']);const beforeMove=(await state()).document,mp=await pointNote('music-note-1'),mq=await deltaTarget(mp,960,2,'track-1');await dragStart(mp,mq);assert.deepEqual((await state()).document,beforeMove);r.screenshots.push(await capture('04-drag-preview',res));await dragEnd(mq);s=await state();assert.equal(s.document.history.cursor,beforeMove.history.cursor+1);assert.equal(countHistory(s.document),beforeMove.history.cursor+1);assert.equal(s.document.revision,beforeMove.revision+1);
  const movedIds=['music-note-1','music-note-4'];for(const n of projectNotes(beforeMove)){const now=projectNotes(s.document).find(a=>a.id===n.id);assert.deepEqual(now,movedIds.includes(n.id)?{...n,tick:n.tick+960,pitch:n.pitch+2}:n);}check('cross-track-group-drag-relative-single-history');r.screenshots.push(await capture('05-drag-committed',res));
  const movedDoc=s.document;await key('Z',['control']);assert.deepEqual((await state()).document.project,beforeMove.project);await key('Z',['control','shift']);assert.deepEqual((await state()).document.project,movedDoc.project);check('group-move-one-undo-redo');
  await click('#music-save-draft');const saved=(await state()).document;await noteClick('music-note-1');await key('A',['control']);assert.equal((await state()).selected.length,3);await click('#music-restore-draft');s=await state();assert.deepEqual(s.document,saved);assert.deepEqual(s.selected,[]);check('restore-clears-selection-keeps-history');
  await noteClick('music-note-1');const rejectBefore=(await state()).document,rp=await pointNote('music-note-1'),rq=await deltaTarget(rp,-2400,0,'track-1');await dragStart(rp,rq);assert.deepEqual((await state()).document,rejectBefore);await dragEnd(rq);assert.deepEqual((await state()).document,rejectBefore);check('out-of-range-move-atomic-rejection');
  const cp=await pointNote('music-note-1'),cq=await deltaTarget(cp,480,1,'track-1');await dragStart(cp,cq);await key('Escape');await dragEnd(cq);assert.deepEqual((await state()).document,rejectBefore);assert.deepEqual((await state()).selected,[]);check('escape-cancels-drag');
  await noteClick('music-note-1');const beforeSingleDelete=(await state()).document;await key('Delete');assert.equal(projectNotes((await state()).document).length,projectNotes(beforeSingleDelete).length-1);await key('Z',['control']);assert.deepEqual((await state()).document.project,beforeSingleDelete.project);check('single-delete');
  await noteClick('music-note-1');await ev(()=>document.querySelector('#music-note-pitch').focus());const textBefore=await state();await key('A',['control']);assert.deepEqual((await state()).selected,textBefore.selected);assert.deepEqual((await state()).document,textBefore.document);check('text-input-shortcuts-isolated');
  await noteClick('music-note-1');const importDoc=(await state()).document;await importJson('#music-import-draft','batch-history.draft.json',JSON.stringify(importDoc));assert.deepEqual((await state()).document,importDoc);assert.deepEqual((await state()).selected,[]);check('file-draft-batch-history-restore');
  await click('#music-download-draft');await wait(180);r.finalDocument=(await state()).document;r.finalProjectNormalized=r.finalDocument.project.tracks.map(t=>({id:t.id,notes:t.notes.map(({id,...n})=>n)}));
  await click('#music-play');await until(()=>document.querySelector('#music-playback-state')?.dataset.state==='Playing');await ev(()=>{const e=window.__musicEvidence;e.retiredAudio=e.view.audio;e.retiredContext=e.view.audio.context;});
  await click('#folder-runtime-exit');await until(()=>!!document.querySelector('#world-folder'));await wait(100);r.teardown=await ev(()=>{const e=window.__musicEvidence;return{musicDom:document.querySelectorAll('#music-editor').length,views:e.all(e.cc.director.getScene(),'MusicEditorView').length,builders:e.all(e.cc.director.getScene(),'MusicEditorBuilder').length,context:e.retiredContext.state,source:e.retiredAudio.source,gameplay:e.all(e.cc.director.getScene(),'FrameDriver').length,errors:e.errors};});assert.deepEqual([r.teardown.musicDom,r.teardown.views,r.teardown.builders,r.teardown.gameplay],[0,0,0,0]);assert.equal(r.teardown.context,'closed');assert.equal(r.teardown.source,null);assert.deepEqual(r.teardown.errors,[]);check('teardown');
  win.destroy();win=null;return r;
}
app.whenReady().then(async()=>{try{
  report.compilation=await compilation();for(const [w,h]of [[1920,1080],[2560,1440]])report.resolutions.push(await runResolution(w,h));
  const [a,b]=report.resolutions;assert.deepEqual(a.finalProjectNormalized,b.finalProjectNormalized);assert.deepEqual(a.checks.map(c=>c.name),b.checks.map(c=>c.name));report.resolutionComparison={sameNormalizedProject:true,sameOperations:true};assert.deepEqual(report.rendererErrors,[]);for(const d of report.downloads)assert.equal(d.state,'completed');report.humanListening='User explicitly reported acceptance before this batch; not inferred from automated output.';report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;console.error(e.stack);}finally{fs.writeFileSync(path.join(out,'creator-preview-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,resolutions:report.resolutions.length,downloads:report.downloads.length,error:report.error}));if(win)win.destroy();app.exit(report.pass?0:1);}});
