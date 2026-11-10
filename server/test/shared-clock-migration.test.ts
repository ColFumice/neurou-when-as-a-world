import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,mkdir,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createPool } from '../src/db.js';
import { SharedMigrationRunner } from '../src/SharedMigrationRunner.js';
import { RealAuthorityClock } from '../src/RealAuthorityClock.js';

const connection=JSON.parse((await readFile('../quality-review/b2-5c-2b/evidence/runtime/.local/connection-final.json','utf8')).replace(/^\uFEFF/,'')) as {databaseUrl:string};
test('002 checksum runner serializes concurrent migration and rejects changed source instead of permissive IF NOT EXISTS',async()=>{
 const pool=createPool(connection.databaseUrl);try{
  const runner=new SharedMigrationRunner();await Promise.all([runner.migrate(pool),runner.migrate(pool)]);
  const versions=(await pool.query('SELECT version,source_sha256 FROM service_schema_versions ORDER BY version')).rows;assert.deepEqual(versions.map(row=>row.version),[1,2]);assert.ok(versions.every(row=>/^[0-9a-f]{64}$/.test(row.source_sha256)));
  const directory=await mkdtemp(join(tmpdir(),'neurou-shared-public-schema-'));await mkdir(join(directory,'migrations'));await mkdir(join(directory,'sql'));await writeFile(join(directory,'migrations/001.sql'),await readFile(resolve('migrations/001.sql')));await writeFile(join(directory,'sql/002_shared_authority.sql'),(await readFile(resolve('sql/002_shared_authority.sql'),'utf8'))+'\n-- explicit checksum tamper\n');
  await assert.rejects(()=>runner.migrate(pool,directory),/002 checksum mismatch/);
 }finally{await pool.end();}
});
test('isolated clock durable floor, equal milliseconds, rollback/drift latch and explicit new trust generation',async()=>{
 const pool=createPool(connection.databaseUrl);const instance='neurou-clock-isolated-'+randomUUID();let wall=10000000,mono=100;
 try{await new SharedMigrationRunner().migrate(pool);const clock=RealAuthorityClock.isolatedTest(instance,'operator-revision-one',{wall:()=>wall,monotonic:()=>mono});await clock.initialize(pool);
  async function sample(target=clock){const client=await pool.connect();try{await client.query('BEGIN');const result=await target.sample(client);await client.query('COMMIT');return result;}finally{client.release();}}
  const first=await sample();assert.equal(first.epochMs,wall);const equal=await sample();assert.equal(equal.epochMs,wall);assert.equal(equal.generation,first.generation);
  wall+=3001;mono+=1;const drift=await sample();assert.equal(drift.trusted,false);assert.equal(drift.epochMs,null);assert.equal(drift.lastSignedEpochMs,first.epochMs);
  const sameRevision=RealAuthorityClock.isolatedTest(instance,'operator-revision-one',{wall:()=>wall,monotonic:()=>mono});await sameRevision.initialize(pool);assert.equal((await sample(sameRevision)).trusted,false);
  const renewed=RealAuthorityClock.isolatedTest(instance,'operator-revision-two',{wall:()=>wall,monotonic:()=>mono});await renewed.initialize(pool);const newSample=await sample(renewed);assert.equal(newSample.trusted,true);assert.ok(newSample.generation>first.generation);
  wall-=1;mono+=1;assert.equal((await sample(renewed)).trusted,false);
  const belowFloor=RealAuthorityClock.isolatedTest(instance,'operator-revision-three',{wall:()=>1,monotonic:()=>mono});await belowFloor.initialize(pool);assert.equal((await sample(belowFloor)).trusted,false);
 }finally{await pool.end();}
});
