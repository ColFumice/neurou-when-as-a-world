const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.cwd(),out=path.join(root,'quality-review/music-editor');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=[...walk(path.join(root,'src')),...walk(path.join(root,'constants')),...walk(path.join(root,'scripts')),...fs.readdirSync(path.join(root,'assets/scripts')).filter(x=>/\.ts(\.meta)?$/.test(x)).map(x=>path.join(root,'assets/scripts',x)),path.join(root,'package.json'),path.join(root,'tsconfig.json')];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest={};for(const p of files){const rel=path.relative(root,p).replace(/\\/g,'/');manifest[rel]=sha(p);const b=path.join(out,'baseline',rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(p,b);}
fs.writeFileSync(path.join(out,'baseline-files.json'),JSON.stringify(manifest,null,2));
const protectedFiles=[...walk(path.join(root,'docs')),...walk(path.join(root,'archive')),...fs.readdirSync(root).filter(x=>/\.(docx|png|jsonl)$/.test(x)).map(x=>path.join(root,x))];
const protectedHashes={};for(const p of protectedFiles)protectedHashes[path.relative(root,p).replace(/\\/g,'/')]=sha(p);
fs.writeFileSync(path.join(out,'protected-hashes.json'),JSON.stringify(protectedHashes,null,2));
console.log(JSON.stringify({baseline:files.length,protected:protectedFiles.length}));
