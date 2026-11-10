'use strict';
// Extend the accepted d acceptance harness only; no production module is edited.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const accepted = fs.readFileSync(path.join(__dirname, '../b2-world-migration/creator-preview.cjs'), 'utf8');
let source = accepted.replaceAll('B2.4d','B2.4e').replaceAll('b24d','b24e');
source = source.replace("scope: 'B2.4e same-ID WorldMigration and account-wide RealityPause, persistent shared ContractAdapter and source SafePoint drain'",
  "scope: 'B2.4e integrated WorldHomeRegistry, restricted Core copy and same-ID migration, account-wide pause and natural peer activity retirement'");
const extraModules = ['assets/scripts/CrossDevicePrototype.ts', 'assets/scripts/WorldMigrationPrototype.ts',
  'src/director/WorldHomeRegistry.ts', 'src/director/CoreTransfer.ts', 'src/director/CoreTransferContent.ts',
  'src/director/WorldMigration.ts', 'src/director/RealityPauseBoundary.ts',
  'src/presentation/WorldHomeContractAdapter.ts', 'src/presentation/CrossDeviceContractAdapter.ts',
  'src/presentation/CrossDeviceImportStorage.ts', 'src/presentation/SafePointDrainStorage.ts',
  'src/presentation/WorldMigrationContractAdapter.ts', 'src/presentation/WorldMigrationStorage.ts'];
source = source.replace('const requiredSources = [', 'const requiredSources = [\n' + extraModules.map(file=>'  '+JSON.stringify(file)+',').join('\n'));
const labels = {
  '07-active-reality-pause-source-drained':'10-reality-pause-after-all-source-worlds-drained',
  '08-account-pause-a-and-b-entry-rejected':'11-pause-rejects-a-b-and-existing-copy',
  '09-restart-device-account-binding':'12-rebuilt-client-preserves-device-binding',
  '10-service-time-released':'13-service-fixture-cutoff-released',
  '11-device-b-same-id-local-published':'14-b-same-id-published-alongside-copy',
  '12-device-b-same-id-formal-restored-runtime':'15-b-same-id-formal-complete-restored',
  '13-client-rebuild-same-id-reopened':'16-rebuilt-client-same-id-reopened',
  '14-other-window-source-drain-and-account-pause':'17-other-window-release-closes-account',
  '15-active-b-replay-preserves-native-timeline':'18-b-active-replay-keeps-native-timeline',
  '16-native-ended-then-safe-retirement':'19-native-ended-and-core-settled-before-retirement',
};
for(const [before,after] of Object.entries(labels)) source=source.replaceAll(before,after);
function replaceOnce(before, after) {
  assert.equal(source.split(before).length,2,'Expected one accepted harness seam: '+before);
  source=source.replace(before,after);
}
const copyFlow = String.raw`
  await capture('07-a-home-registered-restricted-core-export',res);
  await click('#cross-device-import');
  const copyId=await until(()=>{
    const panel=document.querySelector('#cross-device-prototype');if(panel?.dataset.error)throw Error(panel.dataset.error);
    return panel?.dataset.receipt==='Published'?panel.dataset.targetWorldId:false;
  });
  assert.match(copyId,/^world-[0-9a-f-]{36}$/);assert.notEqual(copyId,sourceId);
  const copyKey=bKey('neurou-world-state-v1:'+encodeURIComponent(res.account)+':'+encodeURIComponent(copyId));
  const copyJournalKey=bKey('neurou-cross-device-import-v1:'+encodeURIComponent(res.account));
  const copied=await capture('08-b-copy-new-uuid-seven-parts-published',res);
  const copyBytes=copied.storage[copyKey],copyJournalBytes=copied.storage[copyJournalKey],copy=JSON.parse(copyBytes);
  const parts=['Ledger','PuzzleProgress','FormatTime','RecallCount','WorldLink','ChartSnapshot','ChartScore'];
  assert.deepEqual(Object.keys(copy.sections),parts);assert.equal(copy.revision,0);
  assert.equal(copy.forkOrigin.sourceWorldId,sourceId);assert.match(copy.forkOrigin.transactionId,/^import-/);
  assert.deepEqual(copy.sections.FormatTime,source.sections.FormatTime);assert.deepEqual(ledgerOf(copy),ledgerOf(source));
  for(const name of parts){
    if(name==='FormatTime')continue;
    if(name==='PuzzleProgress'){assert.ok(copy.sections[name].every(x=>x.worldId===copyId&&x.accountId===res.account));continue;}
    assert.equal(copy.sections[name].worldId,copyId);assert.equal(copy.sections[name].accountId,res.account);
  }
  assert.deepEqual(copy.sections.ChartSnapshot.records,source.sections.ChartSnapshot.records);
  assert.deepEqual(copy.sections.ChartScore.records,source.sections.ChartScore.records);
  const copyJournal=JSON.parse(copyJournalBytes);assert.equal(copyJournal.entries[0].phase,'Published');
  assert.equal(copyJournal.entries[0].homeReply.record.homeDeviceId,'logical-device-b');
  const homes=JSON.parse(copied.storage['neurou-migration-contract-authority-v1']).registries.find(x=>x.accountId===res.account);
  assert.equal(homes.records.length,2);assert.ok(!homes.records.some(x=>x.worldId==='InitialWorld'));
  assert.equal(homes.records.find(x=>x.worldId===sourceId).homeDeviceId,'logical-device-a');
  assert.equal(homes.records.find(x=>x.worldId===copyId).homeDeviceId,'logical-device-b');
  assert.equal(copied.storage[sourceKey],sourceBytes);assert.equal(copied.storage[folderKey],folderBytes);
  assert.equal(copied.storage[keys(res.account).record],recordBytes);assert.equal(copied.storage[keys(res.account).projection],projectionBytes);
  await click('#cross-device-open');await until(()=>document.querySelector('#world-clear-view')?.dataset.completionStatus==='Inherited');
  const copyOpened=await capture('09-b-copy-formal-complete-restored',res);
  assert.equal(copyOpened.runtimeNode,copyId);assert.equal(copyOpened.restoreKind,'Restored');assert.equal(copyOpened.capture.kind,'Complete');
  assert.equal(copyOpened.coreView.data.capturedParts,'7');assert.equal(copyOpened.storage[copyKey],copyBytes);
  await exitWorld();
  res.transferAcceptance={pass:true,mode:'ContractAdapter',sourceWorldId:sourceId,targetWorldId:copyId,newUuid:true,
    parts,sourceBytesUnchanged:true,accountFactsNotCopied:true,receiptPhase:'Published',restoreKind:'Restored',captureKind:'Complete',
    sharedMigrationAuthority:true,initialWorldNotRegistered:true};
`;
replaceOnce("  await click('#cross-device-export');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('A 已发送'));",
  "  await click('#cross-device-export');await until(()=>document.querySelector('#cross-device-status')?.textContent.includes('A 已发送'));"+copyFlow);
replaceOnce("  await click('#world-migration-claim');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.error?.includes('PauseActive'));",
  "  await click('#world-migration-claim');await until(()=>document.querySelector('#world-migration-prototype')?.dataset.error?.includes('PauseActive'));\n"+
  "  await click('#cross-device-open');await until(()=>document.querySelector('#cross-device-prototype')?.dataset.error?.includes('PauseActive'));\n"+
  "  assert.equal((await read()).runtimeNode,null);assert.equal((await read()).storage[copyKey],copyBytes);");
replaceOnce("  const journal=JSON.parse(claimed.storage[journalKey]);assert.equal(journal.entries[0].phase,'LocalPublished');",
  String.raw`  const journal=JSON.parse(claimed.storage[journalKey]);assert.equal(journal.entries[0].phase,'LocalPublished');
  assert.notEqual(journalKey,copyJournalKey);assert.equal(claimed.storage[copyKey],copyBytes);
  assert.equal(claimed.storage[copyJournalKey],copyJournalBytes);
  const targetDirectory=JSON.parse(claimed.storage[bKey(folderKey)]);
  assert.deepEqual(new Set(targetDirectory.records.map(x=>x.worldId)),new Set(['InitialWorld',copyId,sourceId]));
  const currentHomes=JSON.parse(claimed.storage['neurou-migration-contract-authority-v1']).registries.find(x=>x.accountId===res.account);
  assert.equal(currentHomes.records.find(x=>x.worldId===copyId).homeRevision,1);
  assert.ok(currentHomes.records.every(x=>x.homeDeviceId==='logical-device-b'));`);
replaceOnce('  await activeReplayPause(res,sourceId,sourceKey);', String.raw`  await activeReplayPause(res,sourceId,sourceKey);
  const end=await read();assert.equal(end.storage[copyKey],copyBytes);assert.equal(end.storage[copyJournalKey],copyJournalBytes);
  res.integratedAcceptance={pass:true,sharedAuthority:true,copyTargetWorldId:copyId,migratedWorldId:sourceId,
    idsDistinct:true,copySurvivesMigrationAndPause:true,journalsIndependent:true,sourceCoreAndDirectoryPreserved:true,
    fixtureTimeOnly:true,realElapsedHour:false,productionSourceChanges:0};`);
replaceOnce('    assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await compilation(),report.compilation);',
  String.raw`    assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await compilation(),report.compilation);
    report.resolutionComparison={pass:true,dimensions:['1920x1080','2560x1440'],
      equivalentCopyAndSameIdMigration:true,equivalentPauseBindingAndSafeRetirement:true,
      completeRestoredSevenParts:true,sourceAndAccountBytesPreserved:true};
    report.compilationUnchanged=true;`);
fs.writeFileSync(path.join(__dirname,'creator-preview.cjs'),source);
fs.copyFileSync(path.join(__dirname,'../b2-world-migration/run-preview.cjs'),path.join(__dirname,'run-preview.cjs'));
fs.writeFileSync(path.join(__dirname,'harness-lineage.json'),JSON.stringify({schemaVersion:1,phase:'B2.4e',
  parent:'../b2-world-migration/creator-preview.cjs',parentAcceptedStage:'B2.4d',productionSourceChanges:0,
  extensions:['c successful restricted Core copy before same-ID migration','shared authority and independent import/migration journals',
    'existing B copy also refused during account pause','copy preserved through migration, client rebuild and natural peer retirement'],
  generatedAt:new Date().toISOString()},null,2)+'\n');
