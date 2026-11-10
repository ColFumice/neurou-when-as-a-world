import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign, verify, createPublicKey } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import type { ServiceConfig } from '../src/config.js';
import type { AuthenticationFact, DeviceChallenge, SignedServiceReceipt, P256PublicJwk } from '../src/contracts.js';
import { canonical, deviceProofBytes, publicJwk, randomToken, ReceiptSigner, sha256 } from '../src/crypto.js';
import { createAccount, createPool, migrate } from '../src/db.js';
import { parseStrictJson } from '../src/strict-json.js';

const databaseUrl = process.env.B25B_DATABASE_URL ?? process.env.DATABASE_URL;
const integration = test;
let pool:Pool; let app:FastifyInstance; let origin:string; let config:ServiceConfig;
const privateKey = generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;
const signer = new ReceiptSigner('neurou-http-test',privateKey);
const credential = generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;
const accountName='http_'+randomUUID().replaceAll('-','');const password=randomToken();let accountId:string;
interface Jar {cookies:Map<string,string>;csrf:string}
const jar:Jar={cookies:new Map(),csrf:''};let auth:AuthenticationFact;
function copyJar(source:Jar):Jar{return{cookies:new Map(source.cookies),csrf:source.csrf};}
async function request(path:string,body:unknown,session:Jar=jar,extra:Record<string,string>={}):Promise<{response:Response;value:any}> {
 const headers:Record<string,string>={'Content-Type':'application/json',Origin:origin,...extra};if(session.cookies.size)headers.Cookie=[...session.cookies].map(([k,v])=>k+'='+v).join('; ');if(session.csrf)headers['X-CSRF-Token']=session.csrf;
 const response=await fetch(origin+path,{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)});
 for(const entry of response.headers.getSetCookie()){const pair=entry.split(';')[0]!;const index=pair.indexOf('=');const name=pair.slice(0,index);const value=pair.slice(index+1);if(value)session.cookies.set(name,value);else session.cookies.delete(name);}
 return{response,value:await response.json()};
}
function checkedReceipt<T>(value:SignedServiceReceipt<T>,purpose:string,requestNonce:string):T{
 assert.equal(value.schemaVersion,1);assert.equal(value.serviceInstanceId,signer.serviceInstanceId);assert.equal(value.keyId,signer.keyId);assert.equal(value.purpose,purpose);assert.equal((value.payload as {requestNonce:string}).requestNonce,requestNonce);
 const {signatureBase64Url,...unsigned}=value;assert.equal(Buffer.from(signatureBase64Url,'base64url').length,64);assert.ok(verify('sha256',Buffer.from('Neurou/service/v1\0'+canonical(unsigned)),{key:createPublicKey(privateKey),dsaEncoding:'ieee-p1363'},Buffer.from(signatureBase64Url,'base64url')));return value.payload;
}
async function challenge(key=credential,deviceId:string|null=null,purpose:'LoginDevice'|'RegisterDevice'='LoginDevice'):Promise<DeviceChallenge>{
 const requestNonce=randomToken();const result=await request('/api/v1/device/challenge',{purpose,accountName,publicKeyJwk:publicJwk(key),deviceId,requestNonce});assert.equal(result.response.status,200);return checkedReceipt<DeviceChallenge>(result.value,'DeviceChallenge',requestNonce);
}
function proof(value:DeviceChallenge,key=credential):string{return sign('sha256',deviceProofBytes(value),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');}
async function login(target:Jar=jar):Promise<AuthenticationFact>{const value=await challenge();const requestNonce=randomToken();const result=await request('/api/v1/auth/login',{accountName,password,challengeId:value.challengeId,signatureBase64Url:proof(value),deviceLabel:'HTTP integration credential',requestNonce},target);assert.equal(result.response.status,200);const fact=checkedReceipt<AuthenticationFact>(result.value,'Authentication',requestNonce);target.csrf=fact.csrfToken;return fact;}
before(async()=>{
 if(!databaseUrl)throw new Error('B25B_DATABASE_URL is required: these tests never substitute an in-memory database');
 pool=createPool(databaseUrl);await migrate(pool);accountId=await createAccount(pool,accountName,password);
 config={databaseUrl,host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',serviceInstanceId:signer.serviceInstanceId,signingKeyPath:'unused-in-memory-test-key',clockInitiallyTrusted:true,accessTtlMs:900000,refreshTtlMs:604800000,challengeTtlMs:30000};
 app=await buildApp(config,pool,signer);await app.listen({host:config.host,port:0});const address=app.server.address();assert.ok(address&&typeof address!=='string');config.port=address.port;origin=config.origin=`http://127.0.0.1:${address.port}`;
});
after(async()=>{await app?.close();await pool?.end();});
integration('strict JSON + canonical crypto reject duplicate keys, malformed Unicode and unsafe numbers',()=>{
 for(const raw of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"n":9007199254740992}','{"x":"\\ud800"}','{"x":1} trailing','{"x":[1,]}'])assert.throws(()=>parseStrictJson(raw));
 assert.equal(canonical(parseStrictJson('{"b":2,"a":1}')),'{"a":1,"b":2}');
});
integration('real PostgreSQL17 schema + HTTP readiness, exact Host/Origin, no CORS, no world payload route',async()=>{
 const version=await pool.query('SHOW server_version_num');assert.equal(Math.floor(Number(version.rows[0].server_version_num)/10000),17);
 const ready=await fetch(origin+'/health/ready');assert.equal(ready.status,200);assert.equal((await ready.json() as {serviceMode:string}).serviceMode,'ExternalService');
 const badOrigin=await request('/api/v1/time',{requestNonce:randomToken()},jar,{Origin:'http://evil.test'});assert.equal(badOrigin.response.status,403);assert.equal(badOrigin.value.fault.code,'Forbidden');
 const badHostStatus=await new Promise<number>(resolve=>{const raw=httpRequest(origin+'/api/v1/time',{method:'POST',headers:{Host:'evil.test',Origin:origin,'Content-Type':'application/json'}},response=>{response.resume();resolve(response.statusCode!);});raw.end(JSON.stringify({requestNonce:randomToken()}));});assert.equal(badHostStatus,403);
 const noOrigin=await fetch(origin+'/api/v1/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestNonce:randomToken()})});assert.equal(noOrigin.status,403);assert.equal(noOrigin.headers.get('access-control-allow-origin'),null);
 const missing=await request('/api/v1/world/readMigrationPayload',{requestNonce:randomToken()});assert.equal(missing.response.status,404);
});
integration('password + one-time registered P256 challenge authenticate, forged proof and wrong password fail',async()=>{
 const challengeValue=await challenge();const base={accountName,password,challengeId:challengeValue.challengeId,signatureBase64Url:proof(challengeValue),deviceLabel:'HTTP integration credential',requestNonce:randomToken()};
 const forged=await request('/api/v1/auth/login',{...base,signatureBase64Url:proof(challengeValue,generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey)});assert.equal(forged.response.status,401);
 const wrong=await request('/api/v1/auth/login',{...base,password:randomToken()});assert.equal(wrong.response.status,401);
 const success=await request('/api/v1/auth/login',base);assert.equal(success.response.status,200);auth=checkedReceipt<AuthenticationFact>(success.value,'Authentication',base.requestNonce);jar.csrf=auth.csrfToken;assert.equal(auth.account.accountId,accountId);assert.equal(auth.device.assurance,'RegisteredCredential');
 assert.ok(success.response.headers.getSetCookie().every(cookie=>/HttpOnly/.test(cookie)&&/SameSite=Strict/i.test(cookie)));assert.ok(success.response.headers.getSetCookie().every(cookie=>!/Secure/.test(cookie)));
 const replay=await request('/api/v1/auth/login',base);assert.equal(replay.response.status,401);
 const stored=await pool.query('SELECT token_hash FROM auth_tokens WHERE session_id=$1',[auth.sessionId]);for(const token of stored.rows){assert.match(token.token_hash,/^[0-9a-f]{64}$/);assert.ok(![...jar.cookies.values()].includes(token.token_hash));}
 const credentials=await pool.query('SELECT password_hash FROM accounts WHERE account_id=$1',[accountId]);assert.match(credentials.rows[0].password_hash,/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
});
integration('strict body schema, JSON duplicates, CSRF and nonce reject before trusted result',async()=>{
 const unknown=await request('/api/v1/auth/verify',{requestNonce:randomToken(),isAdmin:true});assert.equal(unknown.response.status,400);assert.equal(unknown.value.fault.code,'InvalidData');
 const duplicate=await request('/api/v1/auth/verify','{"requestNonce":"'+randomToken()+'","requestNonce":"'+randomToken()+'"}');assert.equal(duplicate.response.status,400);
 const noCsrf=copyJar(jar);noCsrf.csrf='';const denied=await request('/api/v1/auth/verify',{requestNonce:randomToken()},noCsrf);assert.equal(denied.response.status,403);
 const invalidNonce=await request('/api/v1/auth/verify',{requestNonce:'A'.repeat(42)+'B'});assert.equal(invalidNonce.response.status,400);
});
integration('verify, signed nonce-bound server time and lightweight account/device facts have no grants or gameplay data',async()=>{
 const requestNonce=randomToken();const verified=await request('/api/v1/auth/verify',{requestNonce});const fact=checkedReceipt<AuthenticationFact>(verified.value,'Authentication',requestNonce);assert.equal(fact.sessionId,auth.sessionId);
 const timeNonce=randomToken();const time=await request('/api/v1/time',{requestNonce:timeNonce});assert.equal(time.response.status,200);const sample=checkedReceipt<any>(time.value,'ServerTime',timeNonce);assert.equal(sample.clockStatus,'Trusted');assert.ok(sample.clockGeneration>=1);assert.equal(sample.serverEpochMs,time.value.issuedAtServerEpochMs);
 const tampered=structuredClone(time.value);tampered.payload.serverEpochMs++;const{signatureBase64Url,...unsigned}=tampered;assert.equal(verify('sha256',Buffer.from('Neurou/service/v1\0'+canonical(unsigned)),{key:createPublicKey(privateKey),dsaEncoding:'ieee-p1363'},Buffer.from(signatureBase64Url,'base64url')),false);
 const factsNonce=randomToken();const facts=await request('/api/v1/account/facts',{requestNonce:factsNonce});const account=checkedReceipt<any>(facts.value,'AccountFacts',factsNonce);assert.deepEqual(Object.keys(account).sort(),['account','devices','requestNonce','revision']);assert.equal(account.devices.length,1);assert.equal(account.revision,0);
});
integration('authenticated extra registered device uses separate proof, idempotency and exact request digest',async()=>{
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;const value=await challenge(key,null,'RegisterDevice');const input={challengeId:value.challengeId,signatureBase64Url:proof(value,key),deviceLabel:'Second RegisteredCredential',requestId:randomUUID(),requestNonce:randomToken()};
 const response=await request('/api/v1/device/register',input);assert.equal(response.response.status,200);const fact=checkedReceipt<any>(response.value,'DeviceFacts',input.requestNonce);assert.equal(fact.device.assurance,'RegisteredCredential');
 const same=await request('/api/v1/device/register',input);assert.equal(same.response.status,200);assert.deepEqual(same.value.payload,fact);
 const conflict=await request('/api/v1/device/register',{...input,deviceLabel:'changed'});assert.equal(conflict.response.status,409);
});
integration('PostgreSQL session survives service restart and clock generation advances',async()=>{
 const sample=await request('/api/v1/time',{requestNonce:randomToken()});const priorGeneration=sample.value.payload.clockGeneration;await app.close();app=await buildApp(config,pool,signer);await app.listen({host:config.host,port:config.port});
 const result=await request('/api/v1/auth/verify',{requestNonce:randomToken()});assert.equal(result.response.status,200);assert.equal(result.value.payload.sessionId,auth.sessionId);const time=await request('/api/v1/time',{requestNonce:randomToken()});assert.ok(time.value.payload.clockGeneration>priorGeneration);
});
integration('refresh rotates cookies; replay commits family revocation and invalidates newly rotated access',async()=>{
 const old=copyJar(jar);const rotated=await request('/api/v1/auth/refresh',{requestNonce:randomToken()});assert.equal(rotated.response.status,200);assert.notEqual(jar.cookies.get('neurou_refresh'),old.cookies.get('neurou_refresh'));
 const replay=await request('/api/v1/auth/refresh',{requestNonce:randomToken()},old);assert.equal(replay.response.status,401);const active=await request('/api/v1/auth/verify',{requestNonce:randomToken()});assert.equal(active.response.status,401);
 const row=await pool.query('SELECT revoked FROM auth_families WHERE session_id=$1',[auth.sessionId]);assert.equal(row.rows[0].revoked,true);
});
integration('concurrent refresh of one token has one success, one rejection and durable revocation without deadlock',async()=>{
 auth=await login();const a=copyJar(jar);const b=copyJar(jar);const results=await Promise.all([request('/api/v1/auth/refresh',{requestNonce:randomToken()},a),request('/api/v1/auth/refresh',{requestNonce:randomToken()},b)]);assert.deepEqual(results.map(value=>value.response.status).sort(),[200,401]);const row=await pool.query('SELECT revoked FROM auth_families WHERE session_id=$1',[auth.sessionId]);assert.equal(row.rows[0].revoked,true);
});
integration('refresh works after access expiry, absolute refresh expiry is fixed; logout revokes service state',async()=>{
 auth=await login();await pool.query("UPDATE auth_tokens SET expires_at=$1 WHERE session_id=$2 AND kind='Access'",[Date.now()-1,auth.sessionId]);
 const denied=await request('/api/v1/auth/verify',{requestNonce:randomToken()});assert.equal(denied.response.status,401);const old=await pool.query('SELECT absolute_expires_at FROM auth_families WHERE session_id=$1',[auth.sessionId]);
 const refreshed=await request('/api/v1/auth/refresh',{requestNonce:randomToken()});assert.equal(refreshed.response.status,200);const current=await pool.query('SELECT absolute_expires_at FROM auth_families WHERE session_id=$1',[auth.sessionId]);assert.equal(current.rows[0].absolute_expires_at,old.rows[0].absolute_expires_at);
 const requestNonce=randomToken();const revoked=await request('/api/v1/auth/logout',{requestNonce});assert.equal(revoked.response.status,200);const fact=checkedReceipt<any>(revoked.value,'Logout',requestNonce);assert.equal(fact.revoked,true);assert.equal(jar.cookies.size,0);
});
integration('untrusted clock signs explicit Untrusted sample and readiness refuses healthy claim',async()=>{
 auth=await login();await app.close();app=await buildApp({...config,clockInitiallyTrusted:false},pool,signer);await app.listen({host:config.host,port:config.port});const readiness=await fetch(origin+'/health/ready');assert.equal(readiness.status,503);assert.equal((await readiness.json() as {ready:boolean}).ready,false);
 const requestNonce=randomToken();const time=await request('/api/v1/time',{requestNonce});assert.equal(time.response.status,200);const sample=checkedReceipt<any>(time.value,'ServerTime',requestNonce);assert.equal(sample.clockStatus,'Untrusted');
});
integration('expired challenge, injected assurance/private key fields and foreign account proof are rejected',async()=>{
 const value=await challenge();await pool.query('UPDATE device_challenges SET expires_at=$1 WHERE challenge_id=$2',[Date.now()-1,value.challengeId]);
 const expired=await request('/api/v1/auth/login',{accountName,password,challengeId:value.challengeId,signatureBase64Url:proof(value),deviceLabel:'Expired',requestNonce:randomToken()});assert.equal(expired.response.status,401);
 const injected=await request('/api/v1/device/challenge',{purpose:'LoginDevice',accountName,publicKeyJwk:{...publicJwk(credential),d:randomToken()},deviceId:null,requestNonce:randomToken()});assert.equal(injected.response.status,400);
 const assurance=await request('/api/v1/auth/verify',{requestNonce:randomToken(),assurance:'PhysicalDevice'});assert.equal(assurance.response.status,400);
 const foreign=await request('/api/v1/device/challenge',{purpose:'LoginDevice',accountName:'unknown_account',publicKeyJwk:publicJwk(credential),deviceId:auth.device.deviceId,requestNonce:randomToken()});assert.equal(foreign.response.status,401);
});
integration('refresh and register transactions share lock order, yielding authorized result or expired access without deadlock',async()=>{
 auth=await login();const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;const value=await challenge(key,null,'RegisterDevice');const registerJar=copyJar(jar);const refreshJar=copyJar(jar);
 const results=await Promise.all([request('/api/v1/device/register',{challengeId:value.challengeId,signatureBase64Url:proof(value,key),deviceLabel:'Concurrent registration',requestId:randomUUID(),requestNonce:randomToken()},registerJar),request('/api/v1/auth/refresh',{requestNonce:randomToken()},refreshJar)]);
 assert.ok([200,401].includes(results[0]!.response.status));assert.equal(results[1]!.response.status,200);jar.cookies=refreshJar.cookies;jar.csrf=refreshJar.csrf;
});
integration('absolute refresh expiration never renews itself and revoked device cannot authenticate or verify',async()=>{
 const old=copyJar(jar);await pool.query('UPDATE auth_families SET absolute_expires_at=$1 WHERE session_id=$2',[Date.now()-1,auth.sessionId]);const expired=await request('/api/v1/auth/refresh',{requestNonce:randomToken()},old);assert.equal(expired.response.status,401);
 auth=await login();await pool.query("UPDATE devices SET status='Revoked' WHERE device_id=$1",[auth.device.deviceId]);const revoked=await request('/api/v1/auth/verify',{requestNonce:randomToken()});assert.equal(revoked.response.status,401);
 const value=await challenge();const denied=await request('/api/v1/auth/login',{accountName,password,challengeId:value.challengeId,signatureBase64Url:proof(value),deviceLabel:'Cannot resurrect revoked credential',requestNonce:randomToken()});assert.equal(denied.response.status,403);assert.equal(denied.value.fault.code,'DeviceUntrusted');
});
integration('challenge/login rate boundary rejects excess attempts without creating facts',async()=>{
 await app.close();app=await buildApp(config,pool,signer);await app.listen({host:config.host,port:config.port});
 for(let index=0;index<30;index++){const result=await request('/api/v1/device/challenge',{invalid:true});assert.equal(result.response.status,400);}
 const limited=await request('/api/v1/device/challenge',{invalid:true});assert.equal(limited.response.status,429);assert.equal(limited.value.fault.code,'RateLimited');assert.equal(limited.value.fault.retryAfterMs,60000);
});
