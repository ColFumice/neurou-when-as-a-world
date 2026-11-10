'use strict';
// Independent evidence integrity audit. Reads production; writes only this report and a temporary diff replay.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),os=require('os');
const out=__dirname,root=path.resolve(out,'../..');
const hashBuffer=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileHash=p=>hashBuffer(fs.readFileSync(p));
const readJson=name=>JSON.parse(fs.readFileSync(path.join(out,name),'utf8'));
const generatedAt=new Date().toISOString();
const protectedHashes=readJson('protected-hashes.json');
const protectedChecks=Object.entries(protectedHashes).map(([p,expected])=>{const full=path.isAbsolute(p)?p:path.join(root,p),actual=fs.existsSync(full)?fileHash(full):null;return{file:p,expected,actual,pass:expected===actual};});
const manifest=readJson('files.json');
const manifestChecks=manifest.productionFiles.map(f=>({file:f.path,expected:f.afterSha256,actual:fileHash(path.join(root,f.path)),pass:f.afterSha256===fileHash(path.join(root,f.path))}));
const preview=readJson('creator-preview-results.json'),restart=readJson('process-restart-results.json');
const compiledChecks=preview.compilation.map(c=>{
 const source=fs.readFileSync(path.join(root,c.file),'utf8'),sourceSha256=hashBuffer(Buffer.from(source)),chunk=path.resolve(root,'temp/programming/packer-driver/targets/preview',c.chunk),compiledSha256=fs.existsSync(chunk)?fileHash(chunk):null,mapFile=chunk+'.map';
 const map=fs.existsSync(mapFile)?JSON.parse(fs.readFileSync(mapFile,'utf8')):null;
 const currentSourceMapMatches=!!map?.sourcesContent?.includes(source);
 return{file:c.file,expectedSourceSha256:c.sourceSha256,currentSourceSha256:sourceSha256,chunk:c.chunk,expectedChunkSha256:c.chunkSha256,currentChunkSha256:compiledSha256,currentSourceMapMatches,previewServedEqualsCompilerOutput:c.servedEqualsCompilerOutput,pass:sourceSha256===c.sourceSha256&&compiledSha256===c.chunkSha256&&currentSourceMapMatches&&c.sourceMapMatches===true&&c.servedEqualsCompilerOutput===true};
});
const expectedShots=[];
for(const r of preview.resolutions)for(const s of r.screenshots)expectedShots.push({...s,expectedDimensions:[r.width,r.height],origin:'creator-preview-results.json'});
for(const r of restart.resolutions)expectedShots.push({...r.screenshot,expectedDimensions:[r.width,r.height],origin:'process-restart-results.json'});
const screenshotChecks=expectedShots.map(s=>{const p=path.join(out,s.file),bytes=fs.readFileSync(p),actual=fileHash(p),signature=bytes.subarray(0,8).toString('hex'),dimensions=[bytes.readUInt32BE(16),bytes.readUInt32BE(20)],match=JSON.stringify(dimensions)===JSON.stringify(s.expectedDimensions);return{file:s.file,origin:s.origin,expectedSha256:s.sha256,currentSha256:actual,expectedDimensions:s.expectedDimensions,currentDimensions:dimensions,bytes:bytes.length,pass:actual===s.sha256&&signature==='89504e470d0a1a0a'&&match};});
const actualPngs=fs.readdirSync(out).filter(p=>p.endsWith('.png')).sort(),listedPngs=expectedShots.map(s=>s.file).sort();
const pngInventoryMatches=JSON.stringify(actualPngs)===JSON.stringify(listedPngs);
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'neurou-b2-diff-integrity-'));
for(const f of manifest.productionFiles.filter(f=>f.change==='modified')){const dest=path.join(scratch,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(out,f.baselineFile),dest);}
const replay=cp.spawnSync('git',['-c','core.autocrlf=false','apply','--whitespace=nowarn','--unsafe-paths','--directory='+scratch,path.join(out,'production.diff')],{cwd:root,encoding:'utf8'});
const replayChecks=manifest.productionFiles.map(f=>{const p=path.join(scratch,f.path),actual=fs.existsSync(p)?fileHash(p):null;return{file:f.path,expected:f.afterSha256,actual,pass:actual===f.afterSha256};});
const gates=readJson('gate-results.json');
const reports=['files.json','production.diff','新增命名清单.json','protection-results.json','review-results.json','gate-results.json','logic-results.json','builder-boundary-results.json','dom-boundary-results.json','b1-regression-results.json','creator-preview-results.json','process-restart-results.json','process-restart-lifecycle.json','creator-preview-lifecycle.json','visual-qa-results.json','test-summary.json','VERDICT-201-210.md','名库v3.6附录提案.md','依赖矩阵与阶段范围提案.md','交付报告.md','截图索引.md'];
const artifactChecks=reports.map(file=>({file,sha256:fileHash(path.join(out,file)),bytes:fs.statSync(path.join(out,file)).size}));
const restartMatchesPreview=restart.baselineReportSha256===fileHash(path.join(out,'creator-preview-results.json'))&&restart.originalReportPreserved===true;
const compilationSameAfterProcessRestart=JSON.stringify(restart.compilation)===JSON.stringify(preview.compilation);
const checks={protectedBaseline:protectedChecks.length===211&&protectedChecks.every(c=>c.pass),productionManifest:manifestChecks.length===10&&manifestChecks.every(c=>c.pass),compiledCurrentSources:compiledChecks.length===16&&compiledChecks.every(c=>c.pass),screenshotHashesAndDimensions:screenshotChecks.length===30&&screenshotChecks.every(c=>c.pass)&&pngInventoryMatches,diffReplaysExactBytes:replay.status===0&&replayChecks.every(c=>c.pass),actualPreviewPassed:preview.pass===true&&preview.compilationUnchanged===true,actualIndependentProcessRestartPassed:restart.pass===true&&restartMatchesPreview&&compilationSameAfterProcessRestart&&restart.launchEvidence?.priorHarnessProcesses?.length===0,threeGates:gates.pass===true&&gates.runs.length===3&&gates.runs.every(g=>g.pass&&g.exitCode===0)};
const report={generatedAt,reviewer:'architecture_audit independent subagent',pass:Object.values(checks).every(Boolean),checks,counts:{protectedFiles:protectedChecks.length,productionFiles:manifestChecks.length,compiledSources:compiledChecks.length,pngs:screenshotChecks.length},protectedChecks,manifestChecks,compiledChecks,screenshotChecks,pngInventoryMatches,diffReplay:{exitCode:replay.status,stderr:replay.stderr,tempDirectory:scratch,checks:replayChecks},restartEvidence:{processPID:restart.processPID,launchEvidence:restart.launchEvidence,baselineReportSha256:restart.baselineReportSha256,currentPreviewReportSha256:fileHash(path.join(out,'creator-preview-results.json')),restartMatchesPreview,compilationSameAfterProcessRestart},artifactChecks,notes:['Production files were only read. The complete delivered patch was replayed against baseline copies in a new temporary directory; all ten reconstructed files must match current delivered bytes.','Source maps and local compiler chunks were rechecked against final current source hashes, in addition to the preview report recorded served/disk equality.','PNG checks verify original byte hash and native IHDR width/height against separate actual Creator preview and independent Electron process restart reports.']};
fs.writeFileSync(path.join(out,'final-artifact-integrity.json'),JSON.stringify(report,null,2)+'\n');
const documentLinkChecks=[];
for(const document of ['交付报告.md','截图索引.md']){
 const content=fs.readFileSync(path.join(out,document),'utf8');
 for(const match of content.matchAll(/\]\((<[^>]+>|[^)]+)\)/g)){
  const target=match[1].replace(/^<|>$/g,'').trim();
  if(/^(https?:|codex:|#)/i.test(target))continue;
  const fileTarget=decodeURIComponent(target).replace(/:\d+$/,'').split('#')[0];
  const absolute=path.isAbsolute(fileTarget),exists=fs.existsSync(fileTarget);
  documentLinkChecks.push({document,target,fileTarget,absolute,exists,pass:absolute&&exists});
 }
}
report.documentLinkChecks=documentLinkChecks;
report.checks.deliveryDocumentLinks=documentLinkChecks.length>0&&documentLinkChecks.every(c=>c.pass);
report.pass=Object.values(report.checks).every(Boolean);
fs.writeFileSync(path.join(out,'final-artifact-integrity.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks,counts:report.counts,diffReplayStderr:replay.stderr},null,2));
process.exitCode=report.pass?0:1;
