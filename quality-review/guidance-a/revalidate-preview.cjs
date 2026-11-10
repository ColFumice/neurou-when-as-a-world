// Re-check saved, unmodified real preview samples after correcting a strict floating
// timestamp assertion in the harness. This does not synthesize gameplay or screenshots.
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const file=path.join(__dirname,'creator-preview-results.json');
const r=JSON.parse(fs.readFileSync(file,'utf8'));
const checked=[];
for(const report of r.resolutions){
  const dimensions=report.resolution.split('x').map(Number);
  assert.deepEqual(report.dimensions.inner,dimensions);
  assert.deepEqual(report.dimensions.canvas,dimensions);
  for(const e of report.evidence){
    assert.equal(e.imageSize.width,dimensions[0]);assert.equal(e.imageSize.height,dimensions[1]);
    assert.ok(fs.existsSync(path.join(__dirname,e.file)));
  }
  const evidence=name=>report.evidence.find(e=>e.name===name).snapshot;
  const head=evidence('head-waiting');assert.equal(head.line.state,'Waiting');assert.equal(head.visuals.headVisible,true);
  const before=evidence('pause-before'),after=evidence('pause-after');
  assert.equal(before.timeMs,after.timeMs);assert.deepEqual(before.line,after.line);assert.deepEqual(before.visuals,after.visuals);
  assert.ok(report.motion.error<1e-9);
  assert.equal(evidence('tap-judged').perfect,1);
  assert.equal(evidence('exit-world').ledger,0);assert.equal(evidence('exit-world').world,true);
  const reentry=evidence('reentry-cleared');assert.equal(reentry.score,0);assert.equal(reentry.line.startedAtMs,null);assert.equal(reentry.line.judgmentPoint,null);
  for(const sample of [report.at10Seconds,report.beforeMediaEnd]){assert.equal(sample.state,'Playing');assert.equal(sample.ledger,0);assert.equal(sample.result,null);}
  assert.equal(report.completed.ledger,1);assert.equal(report.completed.world,true);
  assert.ok(Math.abs(report.completed.result.finishedAtMs-12000)<1e-6);
  const max=Math.max(...report.sync.map(s=>Math.abs(s.rawPresentedErrorMs)));
  assert.equal(max,report.syncSummary.maxRawPresentedErrorMs);assert.ok(max<=30);
  if(!report.checks.some(c=>c.name==='requestVideoFrameCallback mediaTime vs AudioOutputClock same event <=30ms')){
    report.checks.push({name:'requestVideoFrameCallback mediaTime vs AudioOutputClock same event <=30ms',pass:true,maxDeviationMs:max});
  }
  checked.push({resolution:report.resolution,pass:true,syncSamples:report.sync.length,maxRawPresentedErrorMs:max});
}
const e=r.endToEnd;
assert.equal(e.initial.endpointSettled,false);assert.equal(e.initial.ledger,0);
assert.equal(e.approach.stage,'AwaitingStrike');assert.equal(e.approach.ledger,0);
assert.ok(e.beats.length>=7);assert.ok(e.beats.every(b=>Math.abs(b.deviationMs)<=50));
assert.equal(e.chartEntry.ledger,1);assert.equal(e.tap.perfect,1);assert.equal(e.tap.ledger,1);
assert.ok(e.tap.line.startedAtMs>=2000&&e.tap.line.startedAtMs<=2100);
assert.equal(e.completed.world,true);assert.equal(e.completed.ledger,2);assert.equal(e.completed.perfect,1);
assert.equal(e.completed.result.completed,true);assert.ok(Math.abs(e.completed.result.finishedAtMs-12000)<1e-6);
if(!e.checks.some(c=>c.name==='normal Head + dynamic Tap + actual 12 seconds media end returns world with exactly two director ledger events')){
  e.checks.push({name:'normal Head + dynamic Tap + actual 12 seconds media end returns world with exactly two director ledger events',pass:true});
}
e.pass=true;
assert.deepEqual(r.rendererErrors,[]);
if(r.failure){
  assert.match(r.failure.message,/12000/);
  r.harnessCorrection={reason:'Initial harness compared media end timestamp with strict equality. Actual captured 12000.000000000004 differs by 4e-12ms. Corrected numeric assertion accepts absolute error <1e-6ms and this script re-validates saved samples; no gameplay samples or images changed.',originalFailureMessage:r.failure.message};
  delete r.failure;
}
r.pass=true;
r.savedEvidenceValidation={script:'revalidate-preview.cjs',checked,endToEnd:true,rendererErrors:0};
fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
console.log(JSON.stringify(r.savedEvidenceValidation,null,2));
