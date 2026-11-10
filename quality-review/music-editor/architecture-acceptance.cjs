const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),fixtureRoot=path.join(__dirname,'gate-fixtures');
const checks=[];
function test(name,run){try{checks.push({name,pass:true,evidence:run()});}catch(e){checks.push({name,pass:false,error:e.stack});}}
test('ME-10 dependency gate rejects forbidden new-domain edges and admits type-only intent boundary',()=>{
  fs.mkdirSync(path.join(fixtureRoot,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(fixtureRoot,'constants'),{recursive:true});
  fs.copyFileSync(path.join(root,'scripts/check-dependencies.js'),path.join(fixtureRoot,'scripts/check-dependencies.js'));
  const base={
    'src/editor/Read.ts':'export interface Source { readonly id: string }; export const parse = () => 1;',
    'src/presentation/View.ts':'export class View {}',
    'src/musicEditor/Read.ts':'export interface MusicEditorReader { getDocument(): unknown }; export interface MusicEditorPort { submitMusicEditorIntent(intent: unknown): void }; export class MusicEditorSession {}',
  };
  for(const [f,text] of Object.entries(base)){const p=path.join(fixtureRoot,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}
  const cases=[
    ['src/musicEditor/Probe.ts',"import { Component } from 'cc';",'E8'],
    ['src/musicEditor/Probe.ts',"import { View } from '../presentation/View';",'E1'],
    ['src/musicEditor/Probe.ts',"import { parse } from '../editor/Read';",'E2'],
    ['src/director/Probe.ts',"import type { MusicEditorReader } from '../musicEditor/Read';",'E1'],
    ['src/chart/Probe.ts',"import type { MusicEditorReader } from '../musicEditor/Read';",'E1'],
    ['src/presentation/Probe.ts',"import { MusicEditorSession } from '../musicEditor/Read';",'E3'],
    ['src/presentation/Probe.ts',"import type { MusicEditorReader, MusicEditorPort } from '../musicEditor/Read';",null],
    ['src/musicEditor/Probe.ts',"import type { Source } from '../editor/Read';",null],
  ];
  const results=[];
  for(const [file,source,code] of cases){
    const p=path.join(fixtureRoot,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,source);
    const r=cp.spawnSync(process.execPath,[path.join(fixtureRoot,'scripts/check-dependencies.js')],{encoding:'utf8',windowsHide:true});
    if(code){assert.notEqual(r.status,0);assert.ok(r.stdout.includes(code),r.stdout);}else assert.equal(r.status,0,r.stdout);
    results.push({file,source,expected:code??'PASS',exit:r.status});fs.unlinkSync(p);
  }
  return results;
});
test('ME-10 all protected gameplay/editor/world/startup cores and references unchanged',()=>{
  const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline-files.json'),'utf8'));
  const immutable=Object.keys(baseline).filter(p=>p.startsWith('src/')&&!p.startsWith('src/presentation/FolderCatalog.')||p.startsWith('constants/')||['assets/scripts/SceneBuilder.ts','assets/scripts/Bootstrap.ts','assets/scripts/GuidanceEditorBuilder.ts'].includes(p));
  const changed=immutable.filter(p=>sha(path.join(root,p))!==baseline[p]);assert.deepEqual(changed,[]);
  const protectedHashes=JSON.parse(fs.readFileSync(path.join(__dirname,'protected-hashes.json'),'utf8'));
  const changedProtected=Object.keys(protectedHashes).filter(p=>sha(path.join(root,p))!==protectedHashes[p]);assert.deepEqual(changedProtected,[]);
  const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'reference-hashes.json'),'utf8'));
  for(const [p,h] of Object.entries(reference))assert.equal(sha(p),h,p);
  return {unchangedExistingCoreFiles:immutable.length,unchangedDocsArchiveReferences:Object.keys(protectedHashes).length,unchangedExternalColorMusicReferences:Object.keys(reference).length};
});
const report={pass:checks.every(x=>x.pass),checks};fs.writeFileSync(path.join(__dirname,'architecture-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.pass?0:1;
