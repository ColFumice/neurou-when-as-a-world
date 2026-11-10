import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { P256PublicJwk } from './contracts.js';
import { sha256 } from './crypto.js';

export class SharedServiceFailure extends Error {
 constructor(readonly detail:string,readonly status:number,readonly code:string,readonly layer='Authority',readonly retryAfterMs:number|null=null){super(detail);}
}
export interface SharedSession {
 readonly accountId:string;readonly deviceId:string;readonly deviceGeneration:number;readonly sessionId:string;
 readonly signingPublicKey:P256PublicJwk;readonly signingKeyFingerprint:string;
}
export class SharedSessionVerifier {
 async verify(request:FastifyRequest,client:PoolClient,wall:number,additionalTargets:readonly {accountId:string;deviceId:string}[]=[]):Promise<SharedSession>{
  const token=request.cookies.neurou_access;if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)||Buffer.from(token,'base64url').toString('base64url')!==token)throw new SharedServiceFailure('SessionMissing',401,'Unauthenticated','Session');
  const tokenHash=sha256(token);
  const ids=(await client.query<{account_id:string;device_id:string;session_id:string}>('SELECT f.account_id,f.device_id,f.session_id FROM auth_tokens t JOIN auth_families f USING(session_id) WHERE t.token_hash=$1 AND t.kind=\'Access\'',[tokenHash])).rows[0];
  if(!ids)throw new SharedServiceFailure('SessionMissing',401,'Unauthenticated','Session');
  const accounts=[...new Set([ids.account_id,...additionalTargets.map(target=>target.accountId)])].sort();const devices=[...new Set([ids.device_id,...additionalTargets.map(target=>target.deviceId)])].sort();
  for(const account of accounts)await client.query('SELECT account_id FROM accounts WHERE account_id=$1 FOR UPDATE',[account]);
  for(const device of devices)await client.query('SELECT device_id FROM devices WHERE device_id=$1 FOR UPDATE',[device]);
  await client.query('SELECT session_id FROM auth_families WHERE session_id=$1 FOR UPDATE',[ids.session_id]);
  const row=(await client.query<{revoked:boolean;disabled:boolean;status:string;generation:number;public_key_jwk:P256PublicJwk;key_fingerprint:string;expires_at:string;absolute_expires_at:string;used:boolean;csrf_hash:string}>(`SELECT f.revoked,f.absolute_expires_at,f.csrf_hash,a.disabled,d.status,d.generation,d.public_key_jwk,d.key_fingerprint,t.expires_at,t.used FROM auth_tokens t JOIN auth_families f USING(session_id) JOIN accounts a ON a.account_id=f.account_id JOIN devices d ON d.device_id=f.device_id WHERE t.token_hash=$1 AND t.kind='Access' FOR UPDATE OF t`,[tokenHash])).rows[0];
  if(!row||row.revoked||row.disabled||row.status!=='Active'||row.used)throw new SharedServiceFailure('SessionRevoked',401,'Unauthenticated','Session');
  if(Number(row.expires_at)<=wall||Number(row.absolute_expires_at)<=wall)throw new SharedServiceFailure('SessionExpired',401,'Unauthenticated','Session');
  const csrf=request.headers['x-csrf-token'];if(typeof csrf!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(csrf)||!timingSafeEqual(Buffer.from(sha256(csrf)),Buffer.from(row.csrf_hash)))throw new SharedServiceFailure('CsrfRejected',403,'Forbidden','Session');
  return {accountId:ids.account_id,deviceId:ids.device_id,deviceGeneration:row.generation,sessionId:ids.session_id,signingPublicKey:row.public_key_jwk,signingKeyFingerprint:row.key_fingerprint};
 }
}
