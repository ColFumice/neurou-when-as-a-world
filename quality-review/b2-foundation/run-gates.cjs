'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../..');
async function gate(script) {
  const result = await new Promise(resolve => {
    const child = cp.spawn('cmd.exe',['/d','/s','/c','npm run '+script],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const stdout=[],stderr=[];
    child.stdout.on('data',bytes=>stdout.push(bytes));child.stderr.on('data',bytes=>stderr.push(bytes));
    child.on('error',error=>stderr.push(Buffer.from(String(error.stack))));
    child.on('close',exitCode=>resolve({exitCode,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)}));
  });
  const name=script.replace('check:',''),log='gate-'+name+'.log';
  fs.writeFileSync(path.join(__dirname,log),Buffer.concat([result.stdout,result.stderr]));
  return {command:'npm run '+script,exitCode:result.exitCode,pass:result.exitCode===0,log};
}
Promise.all(['check:naming','typecheck','check:dependencies'].map(gate)).then(runs=>{
  const report={generatedAt:new Date().toISOString(),scope:'Authorized B2.2a+b foundation implementation',pass:runs.every(r=>r.pass),runs};
  fs.writeFileSync(path.join(__dirname,'gate-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));process.exitCode=report.pass?0:1;
});
