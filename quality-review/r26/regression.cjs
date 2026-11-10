const fs = require('fs');
const ts = require('../../node_modules/typescript');
const assert = require('assert/strict');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText,f);
const {ChartPremiere,CHART_MEDIA_END_TIMEOUT_MS} = require('../../src/chart/ChartPremiere.ts');
const {createDefaultKeyboardPadLayout} = require('../../src/chart/KeyboardPadLayout.ts');
const data = JSON.parse(fs.readFileSync('assets/resources/chart/chart_placeholder.json','utf8').replace(/^\uFEFF/,''));
const checks=[];
function make(){ const p=new ChartPremiere(data,createDefaultKeyboardPadLayout()); p.begin(); return p; }
const p=make();
for(const n of data.notes) p.submitStrike({...n,videoTimeMs:n.timeMs});
assert.equal(p.getResolvedCount(),20); assert.equal(p.getState(),'Playing'); assert.equal(p.getResult(),null);
checks.push({name:'20 Notes hit at 10s, still Playing',pass:true});
p.advance(11999); p.advanceMediaStatus(false,false,1999); assert.equal(p.getState(),'Playing');
p.advance(12000); p.advanceMediaStatus(true,false,1); assert.equal(p.getResult().finishedAtMs,12000); assert.equal(p.getState(),'Completed');
checks.push({name:'actual end at 12s completes exactly at 12000ms',pass:true});
p.reopen(); assert.equal(p.getState(),'Ready');p.begin();p.advance(11000);p.advanceMediaStatus(false,false,1000);assert.equal(p.getState(),'Playing');
checks.push({name:'reopen clears mediaEnded',pass:true});
p.togglePause(11000);p.advanceMediaStatus(true,true,60000);assert.equal(p.getState(),'Paused');p.togglePause(11000);
p.advanceMediaStatus(false,true,CHART_MEDIA_END_TIMEOUT_MS-1);assert.equal(p.getState(),'Playing');p.advanceMediaStatus(false,true,1);assert.equal(p.getState(),'Completed');
checks.push({name:'30s independent timeout; paused time excluded',pass:true});
const early=make();early.advance(1200);early.advanceMediaStatus(true,false,16);assert.equal(early.getState(),'Playing');early.advance(11000);assert.equal(early.getState(),'Completed');
checks.push({name:'early media end still waits for all Notes',pass:true});
const empty=new ChartPremiere({...data,notes:[]},createDefaultKeyboardPadLayout());empty.begin();empty.advance(0);assert.equal(empty.getState(),'Playing');empty.advance(12000);empty.advanceMediaStatus(true,false,16);assert.equal(empty.getState(),'Completed');
checks.push({name:'empty chart waits for media end',pass:true});
fs.writeFileSync('quality-review/r26/regression-results.json',JSON.stringify(checks,null,2));console.log(checks);

