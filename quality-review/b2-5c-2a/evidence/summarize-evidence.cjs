'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const gates = read('baseline-gates/results.json');
const protect = read('protected-comparison.json');
const state = read('initial-state.json');
const recorded = ['protected-baseline.json','protected-comparison.json','baseline-gates/results.json','baseline-gates/check-naming.log','baseline-gates/check-dependencies.log','baseline-gates/typecheck.log','initial-state.json'].map(name => {
 const bytes = fs.readFileSync(path.join(__dirname,name));
 return {path:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const result = {phase:'B2.5c-2a freeze evidence summary',generatedUtc:new Date().toISOString(),pass:gates.pass && protect.pass,
 gates:gates.runs.map(({name,command,exitCode,pass,reportedErrors,reportedWarnings,log})=>({name,command,exitCode,pass,reportedErrors,reportedWarnings,log})),
 namingWarningDeltaFromC1:state.gateNamingWarningDelta,newWarningLines:state.newWarningLines,removedWarningLines:state.removedWarningLines,
 protection:{baselineCapturedUtc:protect.baselineCapturedUtc,comparedUtc:protect.comparedUtc,baselineSha256:protect.baselineSha256,beforeCount:protect.beforeCount,afterCount:protect.afterCount,changed:protect.changed,removed:protect.removed,added:protect.added,pass:protect.pass},
 recorded,scope:'Freeze round: zero production code changes, no implementation tests, no server or HTTP execution, no main-chain wiring. Exactly three existing gates executed once. Immutable baseline and raw comparison preserved; prior raw FAIL records remain unchanged.'};
const out = path.join(__dirname,'evidence-summary.json');
if(fs.existsSync(out)) throw new Error('Evidence summary is immutable.');
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,gateCount:result.gates.length,protectedCount:protect.afterCount,namingWarningDelta:result.namingWarningDeltaFromC1},null,2));
