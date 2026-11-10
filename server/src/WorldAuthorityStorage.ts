import type { Pool,PoolClient } from 'pg';
import { sharedCanonical } from './SharedReceiptSigner.js';

export interface StoredWorld {world_id:string;registration:Record<string,unknown>;root_anchor:Record<string,unknown>;current_epoch:string|null;admission_revision:string;observer_revision:string;seal_revision:string;sealed_through:string|null;registration_receipt:Buffer;}
export class WorldAuthorityStorage {
 constructor(readonly pool:Pool){}
 async transaction<T>(action:(client:PoolClient)=>Promise<T>):Promise<T>{const client=await this.pool.connect();try{await client.query('BEGIN');const result=await action(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async lockWorld(client:PoolClient,id:string):Promise<StoredWorld|null>{return (await client.query<StoredWorld>('SELECT * FROM authority_worlds WHERE world_id=$1 FOR UPDATE',[id])).rows[0]??null;}
 static bytes(value:unknown):Buffer{return Buffer.from(sharedCanonical(value));}
 static value(bytes:Buffer):Record<string,unknown>{return JSON.parse(bytes.toString('utf8')) as Record<string,unknown>;}
}
