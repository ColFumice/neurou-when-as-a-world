const fs = require('fs'), path = require('path'), cp = require('child_process');
const output = fs.createWriteStream(path.join(__dirname,'folder-foundation.contract.log'));
const child = cp.spawn(require('electron'),[path.join(__dirname,'folder-foundation.contract.cjs')],{
  windowsHide:true,stdio:['ignore','pipe','pipe'],
});
for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{output.write(bytes);process.stdout.write(bytes);});
child.on('close',code=>output.end(()=>process.exit(code ?? 1)));
