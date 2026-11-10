const fs=require('fs'),path=require('path'),cp=require('child_process');
const output=fs.createWriteStream(path.join(__dirname,'creator-preview.log'));
const child=cp.spawn(require('electron'),[path.join(__dirname,'creator-preview.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output.write(b);process.stdout.write(b);});
child.on('close',code=>output.end(()=>process.exit(code??1)));
