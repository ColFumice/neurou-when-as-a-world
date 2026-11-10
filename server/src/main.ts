import { existsSync } from 'node:fs';
import { buildApp } from './app.js';
import { environmentConfig } from './config.js';
import { loadSigner } from './crypto.js';
import { createPool } from './db.js';
let shutdown:(()=>Promise<void>)|undefined;
try {
 if (existsSync('.env')) process.loadEnvFile('.env');
 const config = environmentConfig(); const pool = createPool(config.databaseUrl);
 shutdown=()=>pool.end();
 const signer = await loadSigner(config.serviceInstanceId,config.signingKeyPath);
 const app = await buildApp(config,pool,signer);
 shutdown=async()=>{await app.close();await pool.end();};
 await app.listen({host:config.host,port:config.port});
 process.stdout.write(`Neurou ExternalService listening at ${config.origin}; clock=${config.clockInitiallyTrusted?'operator-trusted':'untrusted'}\n`);
 for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{void shutdown?.().then(()=>process.exit(0));});
} catch {
 process.stderr.write('ExternalService startup failed; verify private configuration, database schema, signing key and loopback port.\n');
 await shutdown?.().catch(()=>undefined);process.exitCode=1;
}
