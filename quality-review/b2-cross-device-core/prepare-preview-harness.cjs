'use strict';
const fs = require('node:fs'), path = require('node:path');
const original = fs.readFileSync(path.join(__dirname, '../b3-world-fork/creator-preview.cjs'), 'utf8');
let prefix = original.slice(0, original.indexOf('async function naturalPuzzle'));
prefix = prefix.replace("const baseline = path.join(__dirname, 'baseline');", "const baseline = path.join(__dirname, 'original-source');")
  .replaceAll('b23-', 'b24c-').replaceAll('B2.3 ', 'B2.4c ')
  .replace('B2.3 WorldFork complete state inheritance, persistent provenance, directory transaction and independent worlds', 'B2.4c restricted Core transfer, two logical devices in one realm sharing ContractAdapter; isolated B world storage and shared read-only same-account facts');
prefix = prefix.replace(/policy: '[^\n]+',/, "policy: 'Actual Creator preview, fresh isolated profile per resolution. Product login/prologue/choice/native World audio/local fork/export/import/open/recover controls only. Source A naturally creates a non-Initial UUID. Two logical devices share an in-memory ContractAdapter in one realm; B world storage is persistently namespaced, account facts are a shared trusted read port outside the payload. Read-only component/DOM/storage observations, original media/time and direct CDP PNG. No gameplay/storage injection, no physical-device authentication, no full FileCarry or external service claim.',");
const suffix = String.raw`
function bKey(key) { return 'neurou-contract-device-b:' + encodeURIComponent(key); }
async function transferResolution(width, height) {
  const res = {width,height,resolution:width+'x'+height,account:'b24c-production-'+width+'-'+runId,
    partition:'persist:b24c-'+width+'-'+runId,screenshots:[]}; report.resolutions.push(res);
  await worldClear(res); await exitWorld();
  await click('[data-action="fork-world"][data-world-id="InitialWorld"]');
  const sourceId = await until(()=> {
    const select=document.querySelector('#cross-device-source'); return select?.options.length ? select.value : false;
  });
  assert.match(sourceId,/^world-[0-9a-f-]{36}$/);
  const sourceKey='neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(sourceId);
  const before = await read(), sourceBytes=before.storage[sourceKey], source=JSON.parse(sourceBytes);
  const recordBytes=before.storage[keys(res.account).record], projectionBytes=before.storage[keys(res.account).projection];
  await click('#cross-device-export');
  await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('A 已发送'));
  await capture('07-device-a-published-restricted-core',res);
  await click('#cross-device-import');
  const target = await until(()=> {
    const panel=document.querySelector('#cross-device-prototype');
    if(panel?.dataset.error)throw Error(panel.dataset.error);
    return panel?.dataset.receipt==='Published' ? panel.dataset.targetWorldId : false;
  });
  assert.notEqual(target,sourceId);
  const listed=await capture('08-device-b-published-seven-section-copy',res);
  const targetKey=bKey('neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(target));
  const staged=JSON.parse(listed.storage[targetKey]);
  assert.equal(staged.worldId,target);assert.equal(staged.accountId,res.account);assert.equal(staged.revision,0);
  assert.equal(staged.forkOrigin.sourceWorldId,sourceId);assert.match(staged.forkOrigin.transactionId,/^import-/);
  assert.deepEqual(staged.sections.FormatTime,source.sections.FormatTime);
  assert.equal(listed.storage[sourceKey],sourceBytes);
  assert.equal(listed.storage[keys(res.account).record],recordBytes);assert.equal(listed.storage[keys(res.account).projection],projectionBytes);
  const names=['Ledger','PuzzleProgress','FormatTime','RecallCount','WorldLink','ChartSnapshot','ChartScore'];
  assert.deepEqual(Object.keys(staged.sections),names);
  for(const name of names){
    if(name==='FormatTime')continue;
    if(name==='PuzzleProgress'){assert.ok(staged.sections[name].every(p=>p.worldId===target&&p.accountId===res.account));continue;}
    assert.equal(staged.sections[name].worldId,target);assert.equal(staged.sections[name].accountId,res.account);
  }
  assert.equal(staged.sections.Ledger.control.entry.entryId,JSON.stringify([res.account,target,source.sections.Ledger.protagonistCharacterId,'SphereCrossing']));
  assert.deepEqual(ledgerOf(staged),ledgerOf(source));
  assert.deepEqual(staged.sections.ChartSnapshot.records,source.sections.ChartSnapshot.records);
  assert.deepEqual(staged.sections.ChartScore.records,source.sections.ChartScore.records);
  const journalKey=bKey('neurou-cross-device-import-v1:'+encodeURIComponent(res.account));
  const journal=JSON.parse(listed.storage[journalKey]);assert.equal(journal.entries[0].phase,'Published');
  assert.equal(journal.entries[0].homeReply.record.homeDeviceId,'logical-device-b');
  assert.equal(listed.storage[bKey(keys(res.account).record)],undefined);assert.equal(listed.storage[bKey(keys(res.account).projection)],undefined);
  await click('#cross-device-open');
  await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const opened=await capture('09-device-b-restored-inherited-formal-runtime',res);
  assert.equal(opened.runtimeNode,target);assert.equal(opened.restoreKind,'Restored');assert.equal(opened.capture.kind,'Complete');
  assert.equal(opened.world.completionStatus,'Inherited');assert.equal(opened.world.record,null);
  assert.equal(opened.coreView.data.capturedParts,'7');assert.equal(opened.coreView.data.formatTime,String(source.sections.FormatTime.epochMs));
  assert.equal(opened.storage[sourceKey],sourceBytes);assert.equal(opened.storage[targetKey],listed.storage[targetKey]);
  assert.equal(opened.frameDrivers,1);assert.equal(opened.inputCollectors,1);
  assert.equal(await ev(()=>document.querySelector('#enter-world-boss-chart').hidden),true);
  await exitWorld();
  await click('#cross-device-recover');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('B 对账结果：Published'));
  await click('#cross-device-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const reopened=await capture('10-device-b-reconciled-and-reopened',res);
  assert.equal(reopened.restoreKind,'Restored');assert.equal(reopened.storage[targetKey],listed.storage[targetKey]);
  assert.equal(reopened.storage[sourceKey],sourceBytes);assert.equal(reopened.storage[keys(res.account).record],recordBytes);
  assert.equal(reopened.storage[keys(res.account).projection],projectionBytes);
  await exitWorld(); const ended=await read();assert.equal(ended.frameDrivers,0);assert.equal(ended.inputCollectors,0);
  res.transferAcceptance={pass:true,mode:'ContractAdapter',prototype:'RestrictedCoreTransfer',sourceWorldId:sourceId,targetWorldId:target,
    newUuid:true,sections:names,formatTimePreserved:true,completionStatus:'Inherited',restoreKind:'Restored',captureKind:'Complete',
    sourceBytesUnchanged:true,accountFactsNotCopied:true,accountFactBytesUnchanged:true,receiptPhase:'Published',
    homeDevice:'logical-device-b',receiptReconciled:true,ownWorldStores:true,sharedAuthority:true,
    actualDimensions:[width,height],naturalSourceCreatedByLocalFork:true};res.pass=true;await close();
}
app.whenReady().then(async()=>{
  try {
    report.compilation=await compilation();
    for(const [width,height] of [[1920,1080],[2560,1440]])await transferResolution(width,height);
    assert.deepEqual(report.rendererErrors,[]);assert.deepEqual(report.runtimeErrors,[]);
    report.externalRequests=report.requests.filter(r=>{try{const u=new URL(r.url);return ['http:','https:','ws:','wss:'].includes(u.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)}catch{return false}});
    assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await compilation(),report.compilation);
    report.resolutionComparison={sameSevenSections:true,sameInherited:true,sameCompleteRestored:true,sameSourceAndAccountPreservation:true,
      actualDimensions:['1920x1080','2560x1440']};report.compilationUnchanged=true;report.pass=true;
  } catch(error) {
    report.pass=false;report.error=error.stack;console.error(error.stack);
    try{if(win){report.failureSnapshot=await read();const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
      const file=(current?.resolution??'unknown')+'-diagnostic-failure.png';fs.writeFileSync(path.join(__dirname,file),Buffer.from(shot.data,'base64'));report.failureScreenshot=file;}}catch{}
  } finally {
    fs.writeFileSync(path.join(__dirname,'creator-preview-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({pass:report.pass,resolutions:report.resolutions.length,error:report.error}));if(win)win.destroy();app.exit(report.pass?0:1);
  }
});
`;
fs.writeFileSync(path.join(__dirname, 'creator-preview.cjs'), prefix + suffix);
fs.copyFileSync(path.join(__dirname,'../b3-world-fork/run-preview.cjs'),path.join(__dirname,'run-preview.cjs'));
