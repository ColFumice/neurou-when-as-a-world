import { createPrivateKey, createPublicKey, randomUUID, sign, verify, type KeyObject, type JsonWebKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { keyFingerprint, publicJwk } from './crypto.js';
import { SharedCanonicalBytes } from '../.shared-kernel/SharedCanonicalBytes.js';
import { SharedCommitCodec } from '../.shared-kernel/SharedCommitCodec.js';
import type { SharedAuthorityReceipt } from '../.shared-kernel/SharedCommitContracts.js';

export function sharedCanonical(value:unknown):string { return SharedCanonicalBytes.text(SharedCanonicalBytes.encode(value)); }
export function sharedUnsigned(value:Record<string,unknown>,omitted:string):Record<string,unknown>{const result:Record<string,unknown>={};for(const [key,item] of Object.entries(value))if(key!==omitted)result[key]=item;return result;}
export function verifySharedSignature(publicKey:object,domain:string,value:unknown,signature:string):boolean {
 try {const bytes=Buffer.from(signature,'base64url');if(bytes.length!==64||bytes.toString('base64url')!==signature)return false;return verify('sha256',Buffer.from(domain+sharedCanonical(value)),{key:createPublicKey({key:publicKey as JsonWebKey,format:'jwk'}),dsaEncoding:'ieee-p1363'},bytes);}catch{return false;}
}
export class SharedReceiptSigner {
 readonly jwk;readonly keyId:string;
 constructor(readonly serviceInstanceId:string,private readonly privateKey:KeyObject){this.jwk=publicJwk(privateKey);this.keyId=keyFingerprint(this.jwk);}
 static async load(serviceInstanceId:string,path:string):Promise<SharedReceiptSigner>{return new SharedReceiptSigner(serviceInstanceId,createPrivateKey(await readFile(path,'utf8')));}
 transport(purpose:string,requestNonce:string,payload:unknown):Record<string,unknown>{
  const unsigned={schemaVersion:1,serviceInstanceId:this.serviceInstanceId,purpose,receiptId:randomUUID(),requestNonce,keyId:this.keyId,payload};
  return {...unsigned,signatureBase64Url:this.signature('Neurou/shared-transport/v1\0',unsigned)};
 }
 authority<T>(purpose:SharedAuthorityReceipt<T>['purpose'],requestNonce:string,payload:T,time:number,generation:number):SharedAuthorityReceipt<T>{
  const unsigned={schemaVersion:1 as const,serviceInstanceId:this.serviceInstanceId,purpose,receiptId:randomUUID(),keyId:this.keyId,requestNonce,issuedAtServerEpochMs:time,clockGeneration:generation,clockStatus:'Trusted' as const,payload};
  const receipt={...unsigned,signatureBase64Url:this.signature('Neurou/shared-authority/v1\0',unsigned)};
  new SharedCommitCodec().validate('SharedAuthorityReceipt',receipt);return receipt;
 }
 private signature(domain:string,value:unknown):string{return sign('sha256',Buffer.from(domain+sharedCanonical(value)),{key:this.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}
 verifyAuthority(input:unknown):SharedAuthorityReceipt<unknown>{
  const receipt=new SharedCommitCodec().validate('SharedAuthorityReceipt',input);
  if(receipt.serviceInstanceId!==this.serviceInstanceId||receipt.keyId!==this.keyId||!verifySharedSignature(this.jwk,'Neurou/shared-authority/v1\0',sharedUnsigned(receipt as unknown as Record<string,unknown>,'signatureBase64Url'),receipt.signatureBase64Url))throw new Error('Authority receipt invalid');return receipt;
 }
}
