'use strict';
// Evidence packaging only: production is read but never written.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const ts=require('../../node_modules/typescript');
const out=__dirname,root=path.resolve(out,'../..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,x)=>fs.writeFileSync(path.join(out,p),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline-files.json'),'utf8'));
const old=new Map(baseline.map(x=>[x.path,x]));
const modified=['assets/scripts/WorldFolderBuilder.ts','src/director/IntentPort.ts','src/presentation/FolderCatalog.ts','src/presentation/WorldFolderView.ts'];
const added=['assets/scripts/MinimalWorldBuilder.ts','assets/scripts/MinimalWorldBuilder.ts.meta','src/director/WorldFolderSession.ts','src/director/WorldFolderSession.ts.meta','src/presentation/WorldLocalStorage.ts','src/presentation/WorldLocalStorage.ts.meta'];
const files=modified.map(p=>({path:p,change:'modified',beforeSha256:old.get(p).sha256,afterSha256:sha(p),bytes:fs.statSync(path.join(root,p)).size,baselineFile:'baseline/'+p})).concat(added.map(p=>{
 const item={path:p,change:'added',beforeSha256:null,afterSha256:sha(p),bytes:fs.statSync(path.join(root,p)).size};
 if(p.endsWith('.meta')){const meta=JSON.parse(read(p));item.creatorImport={authoredImported:false,currentImported:meta.imported,uuid:meta.uuid,stableUuid:true,evidence:'Reviewer observed authored imported:false/this UUID before the real Creator import; current metadata reads imported:true with the same UUID. No library/temp/cache rewrite used.'};}
 return item;
}));
write('files.json',{generatedAt:new Date().toISOString(),baselineCapturedAt:'2026-10-10T08:13:32.703Z',productionFiles:files,counts:{modifiedTs:4,addedTs:3,addedMeta:3,total:10},sceneBuilderUnchanged:sha('assets/scripts/SceneBuilder.ts')===old.get('assets/scripts/SceneBuilder.ts').sha256,notes:['No Git repository is initialized; modified files use the captured byte baseline, additions use /dev/null.','The three .meta files were initially authored imported:false with stable UUIDs; Creator genuinely imported them and changed imported:true. Their current bytes are delivered.','docs/NAMEBOOK, specs, historical references, existing editors and gameplay domains are excluded from the production delta.']});
let diff='';
for(const p of [...modified,...added]){
 const before=modified.includes(p)?path.posix.join('quality-review/b2-local-worlds/baseline',p):'/dev/null';
 const result=cp.spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--no-ext-diff','--no-color','--',before,p],{cwd:root,encoding:'utf8'});
 if(result.status!==1||!result.stdout.startsWith('diff --git '))throw Error('Diff unavailable '+p+' '+result.stderr);
 let chunk=result.stdout;
 if(modified.includes(p))chunk=chunk.replaceAll('a/'+before,'a/'+p);
 diff+=chunk.endsWith('\n')?chunk:chunk+'\n';
}
write('production.diff',diff);
const namedKinds=new Set([ts.SyntaxKind.ClassDeclaration,ts.SyntaxKind.InterfaceDeclaration,ts.SyntaxKind.TypeAliasDeclaration,ts.SyntaxKind.FunctionDeclaration,ts.SyntaxKind.MethodDeclaration,ts.SyntaxKind.MethodSignature,ts.SyntaxKind.PropertyDeclaration,ts.SyntaxKind.PropertySignature,ts.SyntaxKind.GetAccessor,ts.SyntaxKind.SetAccessor,ts.SyntaxKind.VariableDeclaration,ts.SyntaxKind.Parameter,ts.SyntaxKind.TypeParameter,ts.SyntaxKind.EnumDeclaration,ts.SyntaxKind.EnumMember,ts.SyntaxKind.BindingElement]);
const canonical=s=>s.replace(/\s+/g,' ').trim();
function nameText(node,sf){return node.name?.getText(sf)??(ts.isConstructorDeclaration(node)?'constructor':null);}
function namedOwner(node,sf){let parts=[];for(let n=node.parent;n&&!ts.isSourceFile(n);n=n.parent){if(ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isMethodSignature(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)){const x=nameText(n,sf);if(x)parts.unshift(x);}}return parts.join('.');}
function signature(node,sf){
 const modifiers=(node.modifiers??[]).map(m=>m.getText(sf)).join(' '),type=node.type?.getText(sf)??null;
 if(ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node)||ts.isMethodSignature(node)||ts.isConstructorDeclaration(node)||ts.isGetAccessor(node)||ts.isSetAccessor(node))return canonical(modifiers+' '+(node.typeParameters?.map(p=>p.getText(sf)).join(',')??'')+' ('+node.parameters.map(p=>p.getText(sf)).join(', ')+') : '+(type??'inferred'));
 if(ts.isTypeAliasDeclaration(node))return canonical(node.type.getText(sf));
 if(ts.isClassDeclaration(node)||ts.isInterfaceDeclaration(node))return canonical(modifiers+' '+(node.typeParameters?.map(p=>p.getText(sf)).join(',')??'')+' '+(node.heritageClauses?.map(p=>p.getText(sf)).join(' ')??''));
 if(ts.isParameter(node))return canonical(modifiers+' '+(node.dotDotDotToken?'...':'')+(node.questionToken?'?':'')+' '+(type??'inferred')+(node.initializer?' = '+node.initializer.getText(sf):''));
 return canonical(modifiers+' '+(node.questionToken?'?':'')+' '+(type??'inferred'));
}
function extract(p,text){
 const sf=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),items=[];
 function visit(node){if(namedKinds.has(node.kind)||ts.isConstructorDeclaration(node)){
  const name=nameText(node,sf);
  if(name){const scope=namedOwner(node,sf),pos=sf.getLineAndCharacterOfPosition(node.getStart(sf));
   const category=ts.isParameter(node)?'parameter':ts.isVariableDeclaration(node)||ts.isBindingElement(node)?'local-or-top-level-binding':ts.isMethodDeclaration(node)||ts.isMethodSignature(node)||ts.isPropertyDeclaration(node)||ts.isPropertySignature(node)||ts.isGetAccessor(node)||ts.isSetAccessor(node)?'member':'declaration';
   items.push({name,scope,qualifiedName:scope?scope+'.'+name:name,astKind:ts.SyntaxKind[node.kind],category,line:pos.line+1,signature:signature(node,sf)});
  }
 }ts.forEachChild(node,visit);}
 visit(sf);return items;
}
const declarations=[];
for(const p of [...modified,...added.filter(x=>x.endsWith('.ts'))]){
 const previous=old.has(p)?extract(p,fs.readFileSync(path.join(out,'baseline',p),'utf8')):[];
 const before=new Map();
 for(const d of previous){const key=d.astKind+'|'+d.scope+'|'+d.name;const set=before.get(key)??new Set();set.add(d.signature);before.set(key,set);}
 for(const d of extract(p,read(p))){const key=d.astKind+'|'+d.scope+'|'+d.name,prior=before.get(key);if(prior?.has(d.signature))continue;
  declarations.push({file:p,...d,change:prior?'extended-existing-declaration':'new-in-this-file/scope',namingStatus:'candidate pending PROTOCOL',semanticStatus:'Implementation identifier; this manifest does not freeze a new world entity.',...(prior?{baselineSignatures:[...prior]}:{})});
 }
}
const semanticLiterals=[
 {name:'CreateWorld',location:'WorldFolderIntent.kind',status:'candidate pending PROTOCOL',meaning:'Create new independent metadata/minimal fresh sandbox; no copying.'},
 {name:'DeleteWorld',location:'WorldFolderIntent.kind',status:'candidate pending PROTOCOL',meaning:'Append directory tombstone only.'},
 {name:'WorldFork',location:'WorldFolderIntent.kind / existing frozen name',status:'existing frozen name reused; no new definition',meaning:'An unavailable intent that throws 分叉尚未开放. Complete frozen inheritance/permission semantics remain unchanged; B2.1 does not implement them.'},
 {name:'EmptyWorld',location:'WorldFolderRecord.template',status:'candidate pending PROTOCOL',meaning:'Directory template discriminant for MinimalWorldBuilder; not a WorldKind enum member, not WorldInstance or a gameplay snapshot.'},
 {name:'InitialWorld',location:'WorldFolderRecord.template/worldId',status:'existing frozen name reused; no new definition',meaning:'Existing actual gameplay factory, only initial directory metadata is seeded.'},
 {name:'neurou-world-folder-v1:',location:'WorldLocalStorage.key',status:'candidate pending PROTOCOL',meaning:'Account-encoded browser metadata storage namespace, separate from milestones/editor drafts.'}
];
const domIds=['create-world','world-create-form','world-title','world-description','confirm-create-world','cancel-create-world','world-delete-confirm','world-delete-title','world-delete-message','confirm-delete-world','cancel-delete-world','refresh-worlds','world-folder-status','minimal-world-info'].map(name=>({name,status:'candidate pending PROTOCOL',category:'DOM ID',meaning:'Presentation selector only.'}));
const datasetValues=['open-world','delete-world','fork-world'].map(name=>({name,status:'candidate pending PROTOCOL',category:'data-action value',meaning:'Presentation routing selector only.'}));
write('新增命名清单.json',{generatedAt:new Date().toISOString(),method:'TypeScript 5.5 AST compares current production against captured B2 byte baseline. Lists added declarations/private members/parameters/local bindings and changed type/member/function signatures; method-body changes alone do not rename existing declarations. New file symbols are scoped implementation candidates.',status:'candidate pending PROTOCOL; no NAMEBOOK edit',summary:{sourceFiles:7,declarations:declarations.length,newDeclarations:declarations.filter(d=>d.change==='new-in-this-file/scope').length,extendedExisting:declarations.filter(d=>d.change==='extended-existing-declaration').length,semanticLiterals:semanticLiterals.length,domIds:domIds.length,datasetValues:datasetValues.length},declarations,semanticLiterals,domIds,datasetValues,existingReuse:['WorldFolderReader','WorldFolderEntry','InitialWorld','WorldFolderView','WorldFolderBuilder','WorldFork','ChartResourcePath','WorldInstance','WorldKind','Bootstrap','FrameDriver','InputCollector','CameraRig','ProtagonistView'],typeOnlyForwarding:[{file:'src/director/IntentPort.ts',names:['WorldFolderRecord','WorldFolderSnapshot','WorldFolderIntent','WorldFolderPort'],meaning:'Erased type-only forwarding through existing presentation-to-director route.'}],notImplemented:['WorldRegistry','DuplicateWorld','CopyPermission','FirstWorldCleared','WorldClearRecord'],notes:['Repeated local names are qualified by their enclosing named declaration. Overloaded/anonymous callback occurrences may share the same name/scope, with source lines retained for review.','TypeScript constructors are included as extended signatures but constructor is language syntax, not a new gameplay name.','The presence of existing platform names or reused member spellings in a new scope does not change their frozen definitions.']});
console.log(JSON.stringify({files:files.length,diffBytes:Buffer.byteLength(diff),namingEntries:declarations.length,extended:declarations.filter(d=>d.change==='extended-existing-declaration').map(d=>({file:d.file,name:d.qualifiedName}))},null,2));
