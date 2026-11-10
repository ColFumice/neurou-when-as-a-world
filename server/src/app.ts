import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import argon2 from 'argon2';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Pool, PoolClient } from 'pg';
import type { ServiceConfig } from './config.js';
import type { AuthenticationFact, DeviceChallenge, P256PublicJwk, RegisteredDeviceFact, ServiceFaultCode } from './contracts.js';
import { canonical, keyFingerprint, randomToken, ReceiptSigner, sha256, validatePublicKey, verifyDeviceProof } from './crypto.js';
import { passwordOptions, transaction } from './db.js';
import { parseStrictJson } from './strict-json.js';

const nonce = { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' };
const uuid = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' };
const accountName = { type: 'string', pattern: '^[A-Za-z0-9_.-]{3,64}$' };
const signature = { type: 'string', pattern: '^[A-Za-z0-9_-]{86}$' };
const label = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[^\\u0000-\\u001f\\u007f]+$' };
const jwk = { type: 'object', additionalProperties: false, required: ['kty','crv','x','y'], properties: { kty: { const: 'EC' }, crv: { const: 'P-256' }, x: nonce, y: nonce } };
const onlyNonce = { type: 'object', additionalProperties: false, required: ['requestNonce'], properties: { requestNonce: nonce } };
function bodySchema(properties: Record<string, unknown>): object { return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties }; }
interface DeviceRow { device_id: string; generation: number; key_fingerprint: string; label: string; status: 'Active' | 'Revoked'; public_key_jwk: P256PublicJwk; account_id: string }
interface FamilyRow { session_id: string; account_id: string; device_id: string; csrf_hash: string; absolute_expires_at: string; revoked: boolean; account_name: string; disabled: boolean; generation: number; key_fingerprint: string; label: string; status: 'Active' | 'Revoked' }
interface TokenRow extends FamilyRow { token_hash: string; expires_at: string; used: boolean }
interface ChallengeRow { challenge_id: string; purpose: 'LoginDevice' | 'RegisterDevice'; account_name: string; device_id: string | null; public_key_jwk: P256PublicJwk; key_fingerprint: string; challenge_data: DeviceChallenge; expires_at: string; consumed: boolean; owner_session_id: string | null }
class Fault extends Error { constructor(readonly code: ServiceFaultCode, readonly status = 400) { super(code); } }
function deviceFact(row: DeviceRow | FamilyRow): RegisteredDeviceFact { return { deviceId: row.device_id, generation: row.generation, keyFingerprint: row.key_fingerprint, assurance: 'RegisteredCredential', label: row.label, status: row.status }; }
function validNonce(value: string): boolean { return Buffer.from(value,'base64url').toString('base64url') === value; }
function csrfValid(request: FastifyRequest, family: FamilyRow): boolean {
 const header = request.headers['x-csrf-token']; if (typeof header !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(header)) return false;
 return timingSafeEqual(Buffer.from(sha256(header)), Buffer.from(family.csrf_hash));
}
const sessionSql = `SELECT t.token_hash,t.expires_at,t.used,f.*,a.account_name,a.disabled,d.generation,d.key_fingerprint,d.label,d.status FROM auth_tokens t JOIN auth_families f USING(session_id) JOIN accounts a ON a.account_id=f.account_id JOIN devices d ON d.device_id=f.device_id WHERE t.token_hash=$1 AND t.kind=$2`;

export async function buildApp(config: ServiceConfig, pool: Pool, signer: ReceiptSigner): Promise<FastifyInstance> {
 if (signer.serviceInstanceId !== config.serviceInstanceId) throw new Error('Signing service mismatch');
 const app = Fastify({ logger: false, bodyLimit: 16384, trustProxy: false, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } } });
 await app.register(cookie);
 app.removeContentTypeParser('application/json');
 app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, text, done) => { try { done(null, parseStrictJson(text as string)); } catch { done(new Fault('InvalidData'), undefined); } });
 const dummyHash = await argon2.hash(randomToken(), passwordOptions);
 const clockRow = await pool.query<{ generation: string }>("SELECT nextval('service_clock_generation') AS generation");
 const clockGeneration = Number(clockRow.rows[0]?.generation); if (!Number.isSafeInteger(clockGeneration) || clockGeneration < 1) throw new Error('Clock generation invalid');
 let clockTrusted = config.clockInitiallyTrusted; let priorWall = Date.now(); let priorMono = performance.now();
 function now(): number {
  const wall = Date.now(); const mono = performance.now(); if (wall < priorWall || Math.abs((wall - priorWall) - (mono - priorMono)) > 2000) clockTrusted = false;
  priorWall = wall; priorMono = mono; return wall;
 }
 const rateBuckets = new Map<string,{count:number;expires:number}>();
 app.addHook('onRequest', async (request, reply) => {
  if (request.headers.host !== new URL(config.origin).host) throw new Fault('Forbidden', 403);
  if (request.url === '/health/ready') return;
  if (request.headers.origin !== config.origin) throw new Fault('Forbidden', 403);
  if (request.method !== 'GET' && request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new Fault('InvalidData', 415);
  const time = now(); const sensitive = /\/auth\/login|\/device\/challenge/.test(request.url); const key = request.ip + (sensitive ? ':sensitive' : ':general');
  if (rateBuckets.size > 4096) for (const [key,value] of rateBuckets) if (value.expires < time) rateBuckets.delete(key);
  const bucket = rateBuckets.get(key); if (!bucket || bucket.expires <= time) rateBuckets.set(key,{count:1,expires:time+60_000});
  else { bucket.count++; if (bucket.count > (sensitive ? 30 : 240)) { reply.header('Retry-After','60'); throw new Fault('RateLimited',429); } }
 });
 app.setErrorHandler((error, request, reply) => {
  const details = error as {validation?:unknown;statusCode?:number};
  const fault = error instanceof Fault ? error : new Fault(details.validation || details.statusCode === 400 || details.statusCode === 413 ? 'InvalidData' : 'AuthorityUnavailable', details.validation ? 400 : (details.statusCode === 413 ? 413 : details.statusCode === 400 ? 400 : 503));
  reply.code(fault.status).send({ kind: 'Rejected', fault: { code: fault.code, requestId: request.id, retryAfterMs: fault.code === 'RateLimited' ? 60_000 : null } });
 });
 app.addHook('onSend', async (_request, reply, payload) => { reply.header('Cache-Control','no-store'); reply.header('X-Content-Type-Options','nosniff'); reply.header('Referrer-Policy','no-referrer'); return payload; });
 async function family(request: FastifyRequest, client: Pool | PoolClient = pool, kind = 'Access', locked = false): Promise<TokenRow> {
  const raw = request.cookies[kind === 'Access' ? 'neurou_access' : 'neurou_refresh'];
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw) || !validNonce(raw)) throw new Fault('Unauthenticated',401);
  const hash = sha256(raw);
  if (locked) {
   const identity = await client.query<{account_id:string;device_id:string;session_id:string}>("SELECT f.account_id,f.device_id,f.session_id FROM auth_tokens t JOIN auth_families f USING(session_id) WHERE t.token_hash=$1 AND t.kind=$2",[hash,kind]);
   const ids=identity.rows[0];if(!ids)throw new Fault('Unauthenticated',401);
   // All mutating auth transactions lock account -> device -> family -> token.
   // Locking the family first through arbitrary token rows can deadlock rotation/reuse.
   await client.query('SELECT account_id FROM accounts WHERE account_id=$1 FOR UPDATE',[ids.account_id]);
   await client.query('SELECT device_id FROM devices WHERE device_id=$1 FOR UPDATE',[ids.device_id]);
   await client.query('SELECT session_id FROM auth_families WHERE session_id=$1 FOR UPDATE',[ids.session_id]);
  }
  const rows = await client.query<TokenRow>(sessionSql + (locked ? ' FOR UPDATE OF t' : ''), [hash,kind]); const row = rows.rows[0];
  if (!row || row.revoked || row.disabled || row.status !== 'Active' || Number(row.absolute_expires_at) <= now() || Number(row.expires_at) <= now()) throw new Fault('Unauthenticated',401);
  if (kind === 'Access' && row.used) throw new Fault('Unauthenticated',401);
  if (!csrfValid(request,row)) throw new Fault('Forbidden',403); return row;
 }
 function cookies(reply: FastifyReply, access: string, refresh: string, absoluteExpiry: number): void {
  const base = { httpOnly: true, sameSite: 'strict' as const, secure: false, path: '/' };
  reply.setCookie('neurou_access',access,{...base,maxAge:Math.floor(config.accessTtlMs/1000)});
  reply.setCookie('neurou_refresh',refresh,{...base,maxAge:Math.max(0,Math.floor((absoluteExpiry-now())/1000))});
 }
 function clearCookies(reply: FastifyReply): void { const base = { path:'/',httpOnly:true,sameSite:'strict' as const,secure:false }; reply.clearCookie('neurou_access',base); reply.clearCookie('neurou_refresh',base); }
 function authFact(row: FamilyRow, csrfToken: string, requestNonce: string, expiresAt: number): AuthenticationFact { return { requestNonce, sessionId: row.session_id, csrfToken, account: { accountId:row.account_id,accountName:row.account_name }, device: deviceFact(row), expiresAtServerEpochMs:expiresAt }; }
 async function makeTokens(client: PoolClient, sessionId: string, absoluteExpiry: number): Promise<{access:string;refresh:string;expiresAt:number}> {
  const access = randomToken(); const refresh = randomToken(); const expiresAt = Math.min(now()+config.accessTtlMs,absoluteExpiry);
  await client.query('INSERT INTO auth_tokens(token_hash,session_id,kind,expires_at) VALUES($1,$2,$3,$4),($5,$2,$6,$7)',[sha256(access),sessionId,'Access',expiresAt,sha256(refresh),'Refresh',absoluteExpiry]);
  return {access,refresh,expiresAt};
 }
 app.get('/health/ready', async (_request,reply) => { await pool.query('SELECT 1'); now(); if(!clockTrusted)reply.code(503); return { ready:clockTrusted, serviceMode:'ExternalService', schemaVersion:1, clockStatus:clockTrusted?'Trusted':'Untrusted', serviceInstanceId:config.serviceInstanceId, keyId:signer.keyId }; });
 app.get('/api/v1/service/keys', async () => ({serviceInstanceId:config.serviceInstanceId,keyId:signer.keyId,publicKeyJwk:signer.jwk,keyFingerprint:signer.keyId,trustSource:'OutOfBandConfigurationRequired'}));

 app.post<{Body:{purpose:'LoginDevice'|'RegisterDevice';accountName:string;publicKeyJwk:P256PublicJwk;deviceId:string|null;requestNonce:string}}>('/api/v1/device/challenge',{schema:{body:bodySchema({purpose:{enum:['LoginDevice','RegisterDevice']},accountName,publicKeyJwk:jwk,deviceId:{anyOf:[uuid,{type:'null'}]},requestNonce:nonce})}},async request => {
  const input=request.body; if(!validNonce(input.requestNonce)) throw new Fault('InvalidData'); try {validatePublicKey(input.publicKeyJwk);} catch{throw new Fault('InvalidData');}
  const fingerprint=keyFingerprint(input.publicKeyJwk); let generation:number|null=null; let ownerSessionId:string|null=null;
  if(input.purpose==='RegisterDevice') {const session=await family(request); if(session.account_name!==input.accountName||input.deviceId!==null) throw new Fault('Forbidden',403); ownerSessionId=session.session_id;}
  else if(input.deviceId!==null) {const rows=await pool.query<DeviceRow & {account_name:string}>('SELECT d.*,a.account_name FROM devices d JOIN accounts a USING(account_id) WHERE device_id=$1',[input.deviceId]);const device=rows.rows[0];if(!device||device.account_name!==input.accountName||device.key_fingerprint!==fingerprint||device.status!=='Active') throw new Fault('Unauthenticated',401);generation=device.generation;}
  const time=now();const challenge:DeviceChallenge={schemaVersion:1,purpose:input.purpose,challengeId:randomUUID(),nonceBase64Url:randomToken(),accountName:input.accountName,keyFingerprint:fingerprint,deviceId:input.deviceId,deviceGeneration:generation,expiresAtServerEpochMs:time+config.challengeTtlMs,serviceInstanceId:config.serviceInstanceId,requestNonce:input.requestNonce};
  await pool.query('INSERT INTO device_challenges(challenge_id,purpose,account_name,device_id,public_key_jwk,key_fingerprint,challenge_data,expires_at,owner_session_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[challenge.challengeId,input.purpose,input.accountName,input.deviceId,input.publicKeyJwk,fingerprint,challenge,challenge.expiresAtServerEpochMs,ownerSessionId]);
  return signer.issue('DeviceChallenge',challenge,time);
 });
 app.post<{Body:{accountName:string;password:string;challengeId:string;signatureBase64Url:string;deviceLabel:string;requestNonce:string}}>('/api/v1/auth/login',{schema:{body:bodySchema({accountName,password:{type:'string',minLength:12,maxLength:1024,pattern:'^[^\\u0000-\\u001f\\u007f]+$'},challengeId:uuid,signatureBase64Url:signature,deviceLabel:label,requestNonce:nonce})}},async(request,reply)=>{
  const input=request.body;if(!validNonce(input.requestNonce))throw new Fault('InvalidData');
  const accounts=await pool.query<{account_id:string;account_name:string;password_hash:string;disabled:boolean}>('SELECT * FROM accounts WHERE account_name=$1',[input.accountName]); const account=accounts.rows[0];
  const passwordOk=await argon2.verify(account?.password_hash??dummyHash,input.password);if(!account||!passwordOk||account.disabled)throw new Fault('Unauthenticated',401);
  const result=await transaction(pool,async client=>{
   const current=await client.query<{disabled:boolean;password_hash:string}>('SELECT disabled,password_hash FROM accounts WHERE account_id=$1 FOR UPDATE',[account.account_id]);
   if(!current.rows[0]||current.rows[0].disabled||current.rows[0].password_hash!==account.password_hash)throw new Fault('Unauthenticated',401);
   const rows=await client.query<ChallengeRow>('SELECT * FROM device_challenges WHERE challenge_id=$1 FOR UPDATE',[input.challengeId]);const challenge=rows.rows[0];
   if(!challenge||challenge.consumed||challenge.purpose!=='LoginDevice'||challenge.account_name!==input.accountName||Number(challenge.expires_at)<=now()||!verifyDeviceProof(challenge.challenge_data,challenge.public_key_jwk,input.signatureBase64Url))throw new Fault('Unauthenticated',401);
   let device:DeviceRow;
   if(challenge.device_id===null){
    const same=await client.query<DeviceRow>('SELECT * FROM devices WHERE account_id=$1 AND key_fingerprint=$2',[account.account_id,challenge.key_fingerprint]);
    if(same.rows[0]){if(same.rows[0].status!=='Active')throw new Fault('DeviceUntrusted',403);device=same.rows[0];}
    else{const count=await client.query<{count:string}>('SELECT count(*) FROM devices WHERE account_id=$1',[account.account_id]);if(Number(count.rows[0]?.count)>=256)throw new Fault('Conflict',409);const inserted=await client.query<DeviceRow>("INSERT INTO devices(device_id,account_id,generation,key_fingerprint,public_key_jwk,label,assurance,status,created_at) VALUES($1,$2,1,$3,$4,$5,'RegisteredCredential','Active',$6) RETURNING *",[randomUUID(),account.account_id,challenge.key_fingerprint,challenge.public_key_jwk,input.deviceLabel,now()]);device=inserted.rows[0]!;}
   }else{const rows=await client.query<DeviceRow>('SELECT * FROM devices WHERE device_id=$1 FOR UPDATE',[challenge.device_id]);const existing=rows.rows[0];if(!existing||existing.account_id!==account.account_id||existing.status!=='Active'||existing.generation!==challenge.challenge_data.deviceGeneration||existing.key_fingerprint!==challenge.key_fingerprint)throw new Fault('DeviceUntrusted',403);device=existing;}
   await client.query('UPDATE device_challenges SET consumed=true WHERE challenge_id=$1',[challenge.challenge_id]);
   const sessionId=randomUUID();const csrfToken=randomToken();const absoluteExpiry=now()+config.refreshTtlMs;
   await client.query('INSERT INTO auth_families(session_id,account_id,device_id,csrf_hash,absolute_expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6)',[sessionId,account.account_id,device.device_id,sha256(csrfToken),absoluteExpiry,now()]);
   const tokens=await makeTokens(client,sessionId,absoluteExpiry);const fact:AuthenticationFact={requestNonce:input.requestNonce,sessionId,csrfToken,account:{accountId:account.account_id,accountName:account.account_name},device:deviceFact(device),expiresAtServerEpochMs:tokens.expiresAt};return{tokens,absoluteExpiry,fact};
  });cookies(reply,result.tokens.access,result.tokens.refresh,result.absoluteExpiry);return signer.issue('Authentication',result.fact,now());
 });
 app.post<{Body:{requestNonce:string}}>('/api/v1/auth/verify',{schema:{body:onlyNonce}},async request=>{if(!validNonce(request.body.requestNonce))throw new Fault('InvalidData');const row=await family(request);if(row.used)throw new Fault('Unauthenticated',401);return signer.issue('Authentication',authFact(row,request.headers['x-csrf-token'] as string,request.body.requestNonce,Number(row.expires_at)),now());});
 app.post<{Body:{requestNonce:string}}>('/api/v1/auth/refresh',{schema:{body:onlyNonce}},async(request,reply)=>{
  if(!validNonce(request.body.requestNonce))throw new Fault('InvalidData');
  const result=await transaction(pool,async client=>{const row=await family(request,client,'Refresh',true);if(row.used){await client.query('UPDATE auth_families SET revoked=true WHERE session_id=$1',[row.session_id]);return null;}
   await client.query('UPDATE auth_tokens SET used=true WHERE session_id=$1',[row.session_id]);const tokens=await makeTokens(client,row.session_id,Number(row.absolute_expires_at));return{row,tokens};});
  if(!result){clearCookies(reply);throw new Fault('Unauthenticated',401);}cookies(reply,result.tokens.access,result.tokens.refresh,Number(result.row.absolute_expires_at));return signer.issue('Authentication',authFact(result.row,request.headers['x-csrf-token'] as string,request.body.requestNonce,result.tokens.expiresAt),now());
 });
 app.post<{Body:{requestNonce:string}}>('/api/v1/auth/logout',{schema:{body:onlyNonce}},async(request,reply)=>{if(!validNonce(request.body.requestNonce))throw new Fault('InvalidData');const session=await family(request,pool,'Refresh');await pool.query('UPDATE auth_families SET revoked=true WHERE session_id=$1',[session.session_id]);clearCookies(reply);return signer.issue('Logout',{requestNonce:request.body.requestNonce,sessionId:session.session_id,revoked:true},now());});
 app.post<{Body:{requestNonce:string}}>('/api/v1/time',{schema:{body:onlyNonce}},async request=>{if(!validNonce(request.body.requestNonce))throw new Fault('InvalidData');const session=await family(request);if(session.used)throw new Fault('Unauthenticated',401);const time=now();return signer.issue('ServerTime',{requestNonce:request.body.requestNonce,serverEpochMs:time,clockGeneration,clockStatus:clockTrusted?'Trusted':'Untrusted'},time);});
 app.post<{Body:{requestNonce:string}}>('/api/v1/account/facts',{schema:{body:onlyNonce}},async request=>{if(!validNonce(request.body.requestNonce))throw new Fault('InvalidData');const session=await family(request);const rows=await pool.query<DeviceRow>('SELECT * FROM devices WHERE account_id=$1 ORDER BY device_id',[session.account_id]);return signer.issue('AccountFacts',{requestNonce:request.body.requestNonce,account:{accountId:session.account_id,accountName:session.account_name},devices:rows.rows.map(deviceFact),revision:0},now());});
 app.post<{Body:{challengeId:string;signatureBase64Url:string;deviceLabel:string;requestId:string;requestNonce:string}}>('/api/v1/device/register',{schema:{body:bodySchema({challengeId:uuid,signatureBase64Url:signature,deviceLabel:label,requestId:uuid,requestNonce:nonce})}},async request=>{
  const input=request.body;if(!validNonce(input.requestNonce))throw new Fault('InvalidData');const digest=sha256(canonical(input));
  const device=await transaction(pool,async client=>{const session=await family(request,client,'Access',true);if(session.used)throw new Fault('Unauthenticated',401);
   await client.query('SELECT account_id FROM accounts WHERE account_id=$1 FOR UPDATE',[session.account_id]);
   const previous=await client.query<{request_digest:string;result:RegisteredDeviceFact}>('SELECT * FROM lightweight_requests WHERE account_id=$1 AND request_id=$2',[session.account_id,input.requestId]);if(previous.rows[0]){if(previous.rows[0].request_digest!==digest)throw new Fault('Conflict',409);return previous.rows[0].result;}
   const rows=await client.query<ChallengeRow>('SELECT * FROM device_challenges WHERE challenge_id=$1 FOR UPDATE',[input.challengeId]);const challenge=rows.rows[0];if(!challenge||challenge.consumed||challenge.purpose!=='RegisterDevice'||challenge.owner_session_id!==session.session_id||challenge.account_name!==session.account_name||Number(challenge.expires_at)<=now()||!verifyDeviceProof(challenge.challenge_data,challenge.public_key_jwk,input.signatureBase64Url))throw new Fault('DeviceUntrusted',403);
   const count=await client.query<{count:string}>('SELECT count(*) FROM devices WHERE account_id=$1',[session.account_id]);if(Number(count.rows[0]?.count)>=256)throw new Fault('Conflict',409);
   const same=await client.query('SELECT 1 FROM devices WHERE account_id=$1 AND key_fingerprint=$2',[session.account_id,challenge.key_fingerprint]);if(same.rowCount)throw new Fault('Conflict',409);
   const inserted=await client.query<DeviceRow>("INSERT INTO devices(device_id,account_id,generation,key_fingerprint,public_key_jwk,label,assurance,status,created_at) VALUES($1,$2,1,$3,$4,$5,'RegisteredCredential','Active',$6) RETURNING *",[randomUUID(),session.account_id,challenge.key_fingerprint,challenge.public_key_jwk,input.deviceLabel,now()]);const fact=deviceFact(inserted.rows[0]!);
   await client.query('UPDATE device_challenges SET consumed=true WHERE challenge_id=$1',[challenge.challenge_id]);await client.query('INSERT INTO lightweight_requests(account_id,request_id,operation,request_digest,result) VALUES($1,$2,$3,$4,$5)',[session.account_id,input.requestId,'RegisterDevice',digest,fact]);return fact;});return signer.issue('DeviceFacts',{requestNonce:input.requestNonce,device},now());
 });
 return app;
}
