'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json')));
const gates = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-gates/results.json')));
const previous = JSON.parse(fs.readFileSync(path.join(root, 'quality-review/b2-5c-1/evidence/final-gates/results.json')));
const previousNaming = previous.runs.find(run => run.name === 'check-naming');
const naming = gates.runs.find(run => run.name === 'check-naming');
const documents = ['docs/NAMEBOOK.md', 'docs/spec/stage-1.md'].map(name => {
 const file = baseline.files.find(file => file.path === name);
 const text = fs.readFileSync(path.join(root, name), 'utf8');
 return {path:name,sha256:file.sha256,bytes:file.bytes,matches:text.split(/\r?\n/).flatMap((line,index) => /v3\.18|本文件最近更新/.test(line) ? [{line:index+1,text:line}] : [])};
});
const c1 = ['SharedCommitContracts.ts','SharedCanonicalBytes.ts','SharedCommitCodec.ts','SharedCommitValidator.ts','SharedWorldReducer.ts'].map(name => baseline.files.find(file => file.path === 'src/director/' + name));
const result = {phase:'B2.5c-2a initial state',generatedUtc:new Date().toISOString(),baselineCapturedUtc:baseline.capturedUtc,documents,c1,
 gateNamingWarningDelta:naming.reportedWarnings-previousNaming.reportedWarnings,
 newWarningLines:naming.warningLines.filter(line => !previousNaming.warningLines.includes(line)),
 removedWarningLines:previousNaming.warningLines.filter(line => !naming.warningLines.includes(line)),
 note:'Current docs already contain v3.18/c-1 synchronization in this immutable baseline. This records observed bytes and version headings, not source attribution for any later external modification. Historical P3/c-1 raw FAIL records are not overwritten.'};
fs.writeFileSync(path.join(__dirname,'initial-state.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({gateNamingWarningDelta:result.gateNamingWarningDelta,newWarningLines:result.newWarningLines.length,removedWarningLines:result.removedWarningLines.length,documentHashes:documents.map(({path,sha256})=>({path,sha256}))},null,2));
