const fs=require('fs'),assert=require('assert/strict'),ts=require('../../node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText,f);
const {AccountStartupSession}=require('../../src/director/AccountStartupSession.ts');
const {AccountStartupStorage}=require('../../src/presentation/FolderStartupView.ts');
const checks=[];
function check(name,run){try{const evidence=run();checks.push({name,pass:true,evidence});}catch(error){checks.push({name,pass:false,error:error.stack});}}
check('first account completes once; restart skips prologue; second account is independent',()=>{
 const data=new Map();global.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const store=new AccountStartupStorage();const open=id=>{const s=new AccountStartupSession(snap=>store.saveCompletion(snap));s.submitStartupIntent({kind:'Login',accountId:id,PrologueCompleted:store.readCompletion(id)});return s;};
 const a=open('account-A');assert.equal(a.getStartupSnapshot().phase,'Prologue');assert.equal(data.size,0);
 a.submitStartupIntent({kind:'CompletePrologue'});const completed=a.getStartupSnapshot();assert.equal(completed.phase,'WorldFolder');assert.equal(data.size,1);
 a.submitStartupIntent({kind:'CompletePrologue'});assert.equal(a.getStartupSnapshot(),completed);assert.equal(data.size,1);
 const restart=open('account-A');assert.equal(restart.getStartupSnapshot().phase,'WorldFolder');
 const b=open('account-B');assert.equal(b.getStartupSnapshot().phase,'Prologue');assert.equal(b.getStartupSnapshot().PrologueCompleted,false);
 assert.ok(Object.isFrozen(completed));assert.throws(()=>a.submitStartupIntent({kind:'Login',accountId:'B',PrologueCompleted:false}));return{accountCount:2,storedMilestones:data.size,restartPhase:restart.getStartupSnapshot().phase};
});
check('failed milestone persistence does not commit completion; retry commits exactly once',()=>{
 let fail=true,saves=0;const s=new AccountStartupSession(()=>{if(fail)throw new Error('disk-full');saves++;});
 s.submitStartupIntent({kind:'Login',accountId:'failure-case',PrologueCompleted:false});const before=s.getStartupSnapshot();
 assert.throws(()=>s.submitStartupIntent({kind:'CompletePrologue'}),/disk-full/);assert.equal(s.getStartupSnapshot(),before);assert.equal(s.getStartupSnapshot().PrologueCompleted,false);
 fail=false;s.submitStartupIntent({kind:'CompletePrologue'});s.submitStartupIntent({kind:'CompletePrologue'});assert.equal(saves,1);assert.equal(s.getStartupSnapshot().phase,'WorldFolder');return{saves,failedAttemptPreservesSnapshot:true};
});
check('login validation and storage failures never masquerade as a completed account',()=>{
 const s=new AccountStartupSession(()=>{});assert.throws(()=>s.submitStartupIntent({kind:'CompletePrologue'}));
 for(const id of ['', '  ', 'x'.repeat(65)])assert.throws(()=>s.submitStartupIntent({kind:'Login',accountId:id,PrologueCompleted:false}));
 const store=new AccountStartupStorage();for(const data of ['invalid','null','{}','{"PrologueCompleted":false}']){global.localStorage={getItem:()=>data};assert.throws(()=>store.readCompletion('A'));}
 global.localStorage={getItem:()=>{throw new Error('storage-unavailable');}};assert.throws(()=>store.readCompletion('A'));assert.equal(s.getStartupSnapshot().phase,'Login');return{invalidAccountCases:3,invalidStoredCases:4};
});
check('new account orchestration carries no world, ledger, chart, editor or engine imports',()=>{
 const source=fs.readFileSync('src/director/AccountStartupSession.ts','utf8');assert.ok(!/^import\s/m.test(source));
 const body=source.replace(/\/\/[^\n]*/g,'');assert.ok(!/LedgerAppend|NarrativeEvent|from ['"]cc/.test(body));return{logicZeroEngine:true,noGameplaySession:true,noWorldLedger:true};
});
const report={passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks};fs.writeFileSync(__dirname+'/acceptance-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
