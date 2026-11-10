import { performance } from 'node:perf_hooks';
import type { Pool,PoolClient } from 'pg';
import type { SharedServerConfig } from './SharedServerConfig.js';

export interface AuthorityClockSample {readonly trusted:boolean;readonly epochMs:number|null;readonly lastSignedEpochMs:number|null;readonly generation:number;}
export interface IsolatedClockSource {wall():number;monotonic():number;}
export class RealAuthorityClock {
 private previousWall:number;private previousMono:number;private trusted:boolean;private floor:number|null=null;private generation=0;
 private constructor(private readonly instance:string,initialTrusted:boolean,private readonly revision:string,private readonly source:IsolatedClockSource){this.previousWall=source.wall();this.previousMono=source.monotonic();this.trusted=initialTrusted;}
 static production(config:SharedServerConfig):RealAuthorityClock{return new RealAuthorityClock(config.auth.serviceInstanceId,config.auth.clockInitiallyTrusted,config.operatorClockTrustRevision,{wall:()=>Date.now(),monotonic:()=>performance.now()});}
 /** Explicit isolated-test capability; the production entry never accepts a source/environment clock. */
 static isolatedTest(instance:string,revision:string,source:IsolatedClockSource):RealAuthorityClock{return new RealAuthorityClock(instance,true,revision,source);}
 async initialize(pool:Pool):Promise<void>{
  const client=await pool.connect();try{await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(253602)');const generation=Number((await client.query<{generation:string}>("SELECT nextval('service_clock_generation') AS generation")).rows[0]!.generation);
   if(!Number.isSafeInteger(generation)||generation<1)throw new Error('Clock generation exhausted');this.generation=generation;
   const row=(await client.query<{last_signed_epoch_ms:string|null;trusted:boolean;operator_trust_revision:string}>('SELECT * FROM authority_clock_state WHERE service_instance_id=$1 FOR UPDATE',[this.instance])).rows[0];
   if(row){this.floor=row.last_signed_epoch_ms===null?null:Number(row.last_signed_epoch_ms);this.trusted=this.trusted&&(row.trusted||row.operator_trust_revision!==this.revision);}
   if(this.floor!==null&&this.previousWall<this.floor)this.trusted=false;
   await client.query(`INSERT INTO authority_clock_state(service_instance_id,generation,last_signed_epoch_ms,trusted,operator_trust_revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT(service_instance_id) DO UPDATE SET generation=EXCLUDED.generation,trusted=EXCLUDED.trusted,operator_trust_revision=EXCLUDED.operator_trust_revision`,[this.instance,generation,this.floor,this.trusted,this.revision]);await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async sample(client:PoolClient):Promise<AuthorityClockSample>{
  const row=(await client.query<{generation:string;trusted:boolean;last_signed_epoch_ms:string|null}>('SELECT generation,trusted,last_signed_epoch_ms FROM authority_clock_state WHERE service_instance_id=$1 FOR UPDATE',[this.instance])).rows[0];
  if(!row)throw new Error('Clock uninitialized');const wall=this.source.wall(),mono=this.source.monotonic();const floor=row.last_signed_epoch_ms===null?null:Number(row.last_signed_epoch_ms);
  if(Number(row.generation)!==this.generation||!row.trusted||!Number.isSafeInteger(wall)||wall<0||wall<this.previousWall||(floor!==null&&wall<floor)||Math.abs((wall-this.previousWall)-(mono-this.previousMono))>2000)this.trusted=false;
  this.previousWall=wall;this.previousMono=mono;
  if(this.trusted)this.floor=wall;else this.floor=floor;
  await client.query('UPDATE authority_clock_state SET trusted=$2,last_signed_epoch_ms=$3 WHERE service_instance_id=$1 AND generation=$4',[this.instance,this.trusted,this.floor,this.generation]);
  return {trusted:this.trusted,epochMs:this.trusted?wall:null,lastSignedEpochMs:this.floor,generation:this.generation};
 }
 async persistLatch(pool:Pool):Promise<void>{if(!this.trusted)await pool.query('UPDATE authority_clock_state SET trusted=false WHERE service_instance_id=$1 AND generation=$2',[this.instance,this.generation]);}
}
