import { existsSync } from 'node:fs';
import { environmentConfig } from './config.js';
import { loadSigner } from './crypto.js';
import { createAccount, createPool, migrate } from './db.js';
if(existsSync('.env'))process.loadEnvFile('.env');
const config=environmentConfig();const pool=createPool(config.databaseUrl);
try {
 switch(process.argv[2]){
  case 'migrate':await migrate(pool);process.stdout.write('Schema 1 ready (PostgreSQL 17).\n');break;
  case 'account-create':{const accountName=process.argv[3];const password=process.env.ACCOUNT_PASSWORD;if(!accountName||!password)throw new Error('Use account-create -- <accountName> and ACCOUNT_PASSWORD environment; do not pass password as command argument');const accountId=await createAccount(pool,accountName,password);delete process.env.ACCOUNT_PASSWORD;process.stdout.write(JSON.stringify({accountId,accountName})+'\n');break;}
  case 'trust-anchor':{const signer=await loadSigner(config.serviceInstanceId,config.signingKeyPath);process.stdout.write(JSON.stringify({serviceInstanceId:config.serviceInstanceId,keyId:signer.keyId,publicKeyJwk:signer.jwk,jwkSha256:signer.keyId})+'\n');break;}
  default:throw new Error('Expected migrate | account-create | trust-anchor');
 }
}catch{process.stderr.write('Command failed; verify local configuration, schema and credential policy. No secrets were printed.\n');process.exitCode=1;}finally{await pool.end();}
