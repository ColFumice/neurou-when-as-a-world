const fs=require('fs'),path=require('path'),cp=require('child_process');
const output=fs.createWriteStream(path.join(__dirname,'creator-preview.log'));
const lifecycle={launcherPID:process.pid,script:path.join(__dirname,'creator-preview.cjs'),launchedAt:new Date().toISOString()};
const child=cp.spawn(require('electron'),[path.join(__dirname,'creator-preview.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
lifecycle.electronPID=child.pid;
for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output.write(b);process.stdout.write(b);});
child.on('close',code=>{lifecycle.exitCode=code;lifecycle.exitedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'creator-preview-lifecycle.json'),JSON.stringify(lifecycle,null,2));output.end(()=>process.exit(code??1));});
