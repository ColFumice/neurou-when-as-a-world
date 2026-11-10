'use strict';
const fs = require('node:fs'), path = require('node:path');
const original = fs.readFileSync(path.join(__dirname, '../b2-cross-device-core/creator-preview.cjs'), 'utf8');
let prefix = original.slice(0, original.indexOf('function bKey'))
  .replaceAll('b24c', 'b24d').replaceAll('B2.4c', 'B2.4d');
prefix = prefix.replace(/scope: '[^\n]+', previewUrl/, "scope: 'B2.4d same-ID WorldMigration and account-wide RealityPause, persistent shared ContractAdapter and source SafePoint drain', previewUrl");
prefix = prefix.replace(/policy: '[^\n]+',/, "policy: 'Actual Creator preview; fresh isolated profile per resolution; product login/prologue/native World audio/local Fork/Release/Claim/open controls. Two logical devices share a persistent ContractAdapter service fixture. The harness explicitly advances its independent service clock, never client time or gameplay state: this does not prove an actual elapsed hour or an external service. Read-only game/storage observations, direct CDP PNG; no game/file seeding, full FileCarry or physical-device authentication claim.',");
const suffix = String.raw`
function bKey(key) { return 'neurou-contract-device-b:' + encodeURIComponent(key); }
async function expectRefused(selector, runtime = null) {
  await click(selector); await delay(200);
  assert.equal((await read()).runtimeNode,runtime);
}
async function replayObservation() {
  return ev(() => {
    const env=window.__b23, scene=env.cc.director.getScene();
    const builder=env.all(scene,'SceneBuilder').find(x=>!!x.graph);
    const folder=env.all(scene,'WorldFolderBuilder')[0];
    const media=document.querySelector('#chart-replay-view [data-role="chart-replay-media"]');
    const reader=builder?.replaySession?.getReader();
    return {runtime:folder?.runtimeNode?.name??null,closed:folder?.migrationPrototype?.isRuntimeClosed(),
      active:builder?.replaySession?.isActive()??false,state:reader?.getState(),timeMs:reader?.getCurrentTimeMs(),
      result:reader?.getResult(),events:[...(env.replayPauseEvidence??[])],
      media:media?{time:media.currentTime,duration:media.duration,paused:media.paused,ended:media.ended,seeking:media.seeking}:null};
  });
}
async function activeReplayPause(res, sourceId, sourceKey) {
  const before=await read();
  await click('[data-action="fork-world"][data-world-id="InitialWorld"]');
  await until(()=>document.querySelector('#world-migration-source')?.options.length===2);
  const secondId=await ev(id=>Array.from(document.querySelector('#world-migration-source').options)
    .map(x=>x.value).find(x=>x!==id),sourceId);
  assert.notEqual(secondId,sourceId);
  const secondKey='neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(secondId);
  const original=await read(), secondBytes=original.storage[secondKey]; assert.equal(typeof secondBytes,'string');
  const folderKey='neurou-world-folder-v1:'+encodeURIComponent(res.account), directoryBytes=original.storage[folderKey];
  const replayWin=win; let authorityWin=null;
  try {
    await open(res); authorityWin=win; await login(res.account,false);
    await until(()=>{
      const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0];
      return document.querySelector('#world-migration-source')&&f.migrationPrototype&&!f.migrationPrototype.busy&&
        f.migrationPrototype.bindings.isIdle();
    });
    await set('#world-migration-source',secondId);
    win=replayWin; await click('#world-migration-open');
    await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
    const targetBefore=JSON.parse((await read()).storage[bKey(sourceKey)]);
    await click('[data-action="replay-chart"]');
    await until(()=>{
      const media=document.querySelector('#chart-replay-view [data-role="chart-replay-media"]');
      return media&&!media.paused&&media.currentTime>.4;
    });
    await ev(()=>{
      const media=document.querySelector('#chart-replay-view [data-role="chart-replay-media"]');
      window.__b23.replayPauseEvidence=[];
      for(const type of ['playing','pause','seeking','ended']) media.addEventListener(type,()=>
        window.__b23.replayPauseEvidence.push({type,time:media.currentTime,ended:media.ended,duration:media.duration}));
    });
    const playing=await replayObservation();assert.equal(playing.active,true);assert.equal(playing.closed,false);
    win=authorityWin;
    res.activeReplayPauseReleasePreflight=await ev(()=>{
      const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0],p=f.migrationPrototype;
      return {selected:document.querySelector('#world-migration-source')?.value,busy:p.busy,idle:p.bindings.isIdle(),
        runtime:f.runtimeNode?.name??null,opening:f.opening,directoryBusy:f.directoryBusy,retiring:f.retiring,
        phase:document.querySelector('#world-migration-prototype')?.dataset.phase};
    });
    assert.equal(res.activeReplayPauseReleasePreflight.selected,secondId);
    assert.equal(res.activeReplayPauseReleasePreflight.busy,false);assert.equal(res.activeReplayPauseReleasePreflight.idle,true);
    await click('#world-migration-release');
    const secondMigration=await until(()=>{
      const p=document.querySelector('#world-migration-prototype');if(p?.dataset.error)throw Error(p.dataset.error);
      return p?.dataset.phase==='PauseActive'?p.dataset.migrationId:false;
    });
    await capture('14-other-window-source-drain-and-account-pause',res);
    win=replayWin;const first=await replayObservation();
    assert.equal(first.closed,true);assert.equal(first.active,true);assert.equal(first.runtime,sourceId);
    assert.equal(first.media.paused,false);assert.equal(first.media.seeking,false);assert.ok(first.media.time>playing.media.time);
    await click('#folder-runtime-exit'); await delay(250);
    const continuing=await replayObservation();assert.equal(continuing.active,true);assert.equal(continuing.runtime,sourceId);
    assert.equal(continuing.media.paused,false);assert.ok(continuing.media.time>first.media.time);
    assert.deepEqual(continuing.events.filter(e=>['pause','seeking'].includes(e.type)),[]);
    await capture('15-active-b-replay-preserves-native-timeline',res);
    await until(()=>!!document.querySelector('#world-folder'),15000);
    const retired=await capture('16-native-ended-then-safe-retirement',res),ended=await replayObservation();
    assert.equal(retired.runtimeNode,null);assert.equal(retired.frameDrivers,0);assert.equal(retired.inputCollectors,0);
    assert.ok(ended.events.some(e=>e.type==='ended'&&e.ended&&e.time===e.duration&&e.duration===6));
    assert.deepEqual(ended.events.filter(e=>e.type==='seeking'),[]);
    const targetAfter=JSON.parse(retired.storage[bKey(sourceKey)]);
    assert.deepEqual(targetAfter.sections.Ledger,targetBefore.sections.Ledger);
    assert.deepEqual(targetAfter.sections.FormatTime,targetBefore.sections.FormatTime);
    assert.deepEqual(targetAfter.forkOrigin,targetBefore.forkOrigin);
    assert.equal(targetAfter.sections.ChartScore.records[0].completedPlayCount,targetBefore.sections.ChartScore.records[0].completedPlayCount+1);
    assert.equal(retired.storage[secondKey],secondBytes);assert.equal(retired.storage[folderKey],directoryBytes);
    assert.equal(retired.storage[keys(res.account).record],before.storage[keys(res.account).record]);
    assert.equal(retired.storage[keys(res.account).projection],before.storage[keys(res.account).projection]);
    res.activeReplayPauseAcceptance={pass:true,mode:'ContractAdapter',twoClientWindows:true,sourceWorldId:secondId,
      replayWorldId:sourceId,migrationId:secondMigration,nativeDurationSeconds:6,observations:[playing,first,continuing,ended],
      noForcedMediaEnd:true,noSeekOrTimelineReset:true,naturalSafePointRetirement:true,completedPlayCountIncrement:1,
      explicitFolderExitWaitedForSafePoint:true,accountFactsPreserved:true,serviceClockAdvancedMs:0};
  } catch(error) {
    if(authorityWin&&!authorityWin.isDestroyed()){win=authorityWin;res.activeReplayPauseAuthorityFailure=await read();
      res.activeReplayPauseAuthorityStatus=await ev(()=>document.querySelector('#world-migration-prototype')?.outerHTML);}
    throw error;
  } finally {
    if(authorityWin&&!authorityWin.isDestroyed()){win=authorityWin;await close();}win=replayWin;
  }
}
async function migrationResolution(width,height) {
  const res={width,height,resolution:width+'x'+height,account:'b24d-production-'+width+'-'+runId,
    partition:'persist:b24d-'+width+'-'+runId,screenshots:[]}; report.resolutions.push(res);
  await worldClear(res); await exitWorld();
  await click('[data-action="fork-world"][data-world-id="InitialWorld"]');
  const sourceId=await until(()=>document.querySelector('#world-migration-source')?.value||false);
  assert.match(sourceId,/^world-[0-9a-f-]{36}$/);
  const sourceKey='neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(sourceId);
  const folderKey='neurou-world-folder-v1:'+encodeURIComponent(res.account);
  const before=await read(), sourceBytes=before.storage[sourceKey],source=JSON.parse(sourceBytes);
  const folderBytes=before.storage[folderKey],recordBytes=before.storage[keys(res.account).record],projectionBytes=before.storage[keys(res.account).projection];
  await click('#cross-device-export');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('A 已发送'));
  await click('#world-migration-release');
  const migration=await until(()=>{
    const p=document.querySelector('#world-migration-prototype');if(p?.dataset.error)throw Error(p.dataset.error);
    return p?.dataset.phase==='PauseActive'?p.dataset.migrationId:false;
  });
  const paused=await capture('07-active-reality-pause-source-drained',res);
  const authority=JSON.parse(paused.storage['neurou-migration-contract-authority-v1']);
  const m=authority.migrations.find(x=>x.payload.migrationId===migration);
  assert.equal(m.receipt.pause.resumeNotBeforeServerEpochMs-m.receipt.pause.startedAtServerEpochMs,3600000);
  assert.equal(m.receipt.pause.endedAtServerEpochMs,null);assert.equal(m.receipt.record.homeDeviceId,'logical-device-a');
  assert.equal(paused.storage[sourceKey],sourceBytes);assert.equal(paused.storage[folderKey],folderBytes);
  const sourceJournal=JSON.parse(paused.storage['neurou-migration-v1:'+encodeURIComponent(res.account)]);
  assert.equal(sourceJournal.entries[0].phase,'PauseActive');
  await expectRefused('#open-initial-world');
  await expectRefused('[data-action="open-world"][data-world-id="'+sourceId+'"]');
  await click('#cross-device-import');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('PauseActive'));
  await click('#world-migration-claim');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.error?.includes('PauseActive'));
  await capture('08-account-pause-a-and-b-entry-rejected',res);
  await close(); await open(res);
  await set('#folder-account',res.account+'-other');await click('#folder-login');
  await until(()=>document.querySelector('#folder-startup [role=status]')?.textContent.includes('DeviceAccountBinding'));
  assert.equal((await read()).folder,false);await capture('09-restart-device-account-binding',res);
  await login(res.account,false);
  assert.equal(await ev(()=>document.querySelector('#world-migration-prototype').dataset.phase),'PauseActive');
  await ev(()=>{
    const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0];
    f.migrationPrototype.serviceClockFixture.advanceServiceFixtureBy(3599999);
  });
  report.actions.push({resolution:res.resolution,type:'ContractAdapterServiceFixtureClock',advanceMs:3599999,realElapsedHour:false});
  await click('#world-migration-refresh');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.phase==='PauseActive');
  await expectRefused('#open-initial-world');
  await ev(()=>{
    const e=window.__b23,f=e.all(e.cc.director.getScene(),'WorldFolderBuilder')[0];
    f.migrationPrototype.serviceClockFixture.advanceServiceFixtureBy(1);
  });
  report.actions.push({resolution:res.resolution,type:'ContractAdapterServiceFixtureClock',advanceMs:1,realElapsedHour:false});
  await click('#world-migration-refresh');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.phase==='Released');
  await capture('10-service-time-released',res);
  await click('#world-migration-claim');await until(()=>{
    const p=document.querySelector('#world-migration-prototype');if(p?.dataset.error)throw Error(p.dataset.error);return p?.dataset.phase==='Claimed';
  });
  const claimed=await capture('11-device-b-same-id-local-published',res);
  const targetKey=bKey(sourceKey), journalKey=bKey('neurou-migration-v1:'+encodeURIComponent(res.account));
  assert.equal(claimed.storage[targetKey],sourceBytes);assert.equal(claimed.storage[sourceKey],sourceBytes);
  assert.equal(claimed.storage[folderKey],folderBytes);assert.equal(claimed.storage[keys(res.account).record],recordBytes);
  assert.equal(claimed.storage[keys(res.account).projection],projectionBytes);
  const journal=JSON.parse(claimed.storage[journalKey]);assert.equal(journal.entries[0].phase,'LocalPublished');
  const r=journal.entries[0].receipt;assert.equal(r.record.homeDeviceId,'logical-device-b');assert.equal(r.record.homeRevision,3);
  assert.deepEqual(JSON.parse(claimed.storage[bKey(folderKey)]).records.find(x=>x.worldId===sourceId),m.payload.record);
  assert.equal(claimed.storage[bKey(keys(res.account).record)],undefined);assert.equal(claimed.storage[bKey(keys(res.account).projection)],undefined);
  await expectRefused('[data-action="open-world"][data-world-id="'+sourceId+'"]');
  await click('#world-migration-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const opened=await capture('12-device-b-same-id-formal-restored-runtime',res);
  assert.equal(opened.runtimeNode,sourceId);assert.equal(opened.restoreKind,'Restored');assert.equal(opened.capture.kind,'Complete');
  assert.equal(opened.frameDrivers,1);assert.equal(opened.inputCollectors,1);assert.equal(opened.coreView.data.capturedParts,'7');
  assert.equal(opened.coreView.data.formatTime,String(source.sections.FormatTime.epochMs));
  assert.equal(opened.storage[targetKey],sourceBytes);assert.equal(opened.storage[sourceKey],sourceBytes);
  await exitWorld();await click('#world-migration-recover');await delay(350);
  const reconciled=await read();assert.equal(JSON.parse(reconciled.storage['neurou-migration-v1:'+encodeURIComponent(res.account)]).entries[0].phase,'Claimed');
  await close();await open(res);await login(res.account,false);
  await click('#world-migration-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const reopened=await capture('13-client-rebuild-same-id-reopened',res);
  assert.equal(reopened.restoreKind,'Restored');assert.equal(reopened.storage[targetKey],sourceBytes);assert.equal(reopened.storage[sourceKey],sourceBytes);
  assert.equal(reopened.storage[keys(res.account).record],recordBytes);assert.equal(reopened.storage[keys(res.account).projection],projectionBytes);
  await exitWorld();
  await activeReplayPause(res,sourceId,sourceKey);
  res.migrationAcceptance={pass:true,mode:'ContractAdapter',prototype:'RestrictedMigrationCore',worldId:sourceId,migrationId:migration,
    sameWorldId:true,sevenSectionsExact:true,sourceCoreDirectoryUnchanged:true,accountFactsNotCopied:true,homeRevision:3,
    formatTimeRevisionForkOriginPreserved:true,allAccountNewAdmissionRejected:true,initiatingDeviceBindingSurvivesRebuild:true,
    serviceClockAdvancedMs:3600000,realElapsedHour:false,claimPhase:'LocalPublished',restoreKind:'Restored',captureKind:'Complete',
    actualDimensions:[width,height]};res.pass=true;await close();
}
app.whenReady().then(async()=>{
  try {
    report.compilation=await compilation();
    for(const [width,height] of [[1920,1080],[2560,1440]])await migrationResolution(width,height);
    assert.deepEqual(report.rendererErrors,[]);assert.deepEqual(report.runtimeErrors,[]);
    report.externalRequests=report.requests.filter(r=>{try{const u=new URL(r.url);return ['http:','https:','ws:','wss:'].includes(u.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)}catch{return false}});
    assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await compilation(),report.compilation);
    report.pass=true;
  } catch(error) {report.pass=false;report.failure={message:String(error),stack:error.stack};try{report.lastState=await read()}catch{} console.error(error.stack||error);}
  finally {
    try{await close()}catch{}
    report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'creator-preview-results.json'),JSON.stringify(report,null,2));
    app.exit(report.pass?0:1);
  }
});
`;
fs.writeFileSync(path.join(__dirname, 'creator-preview.cjs'), prefix + suffix);
fs.copyFileSync(path.join(__dirname, '../b2-cross-device-core/run-preview.cjs'), path.join(__dirname, 'run-preview.cjs'));
