import { spawnSync } from 'node:child_process';
import { mkdir,writeFile,cp,readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const server=dirname(fileURLToPath(import.meta.url));
const root=resolve(server,'..');
const files=['SharedCommitContracts.ts','SharedCanonicalBytes.ts','SharedCommitCodec.ts','SharedServiceProtocolContracts.ts','SharedServiceProtocolCodec.ts'];
const kernel=resolve(server,'.shared-kernel');await mkdir(kernel,{recursive:true});
const inputHashes={};for(const file of files)inputHashes[file]=createHash('sha256').update(await readFile(resolve(root,'src/director',file))).digest('hex');
const compiler=resolve(server,'node_modules/typescript/bin/tsc');
const kernelResult=spawnSync(process.execPath,[compiler,'--target','ES2023','--module','CommonJS','--moduleResolution','Node','--strict','--declaration','--skipLibCheck','--rootDir',resolve(root,'src/director'),'--outDir',kernel,...files.map(file=>resolve(root,'src/director',file))],{cwd:server,stdio:'inherit',windowsHide:true});
if(kernelResult.status!==0)process.exit(kernelResult.status??1);
await writeFile(resolve(kernel,'package.json'),'{"type":"commonjs"}\n');
await writeFile(resolve(kernel,'input-hashes.json'),JSON.stringify(inputHashes,null,2)+'\n');
const build=spawnSync(process.execPath,[compiler,'-p','tsconfig.shared.json'],{cwd:server,stdio:'inherit',windowsHide:true});
if(build.status!==0)process.exit(build.status??1);
await cp(kernel,resolve(server,'shared-dist/.shared-kernel'),{recursive:true});
