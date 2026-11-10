import type { Pool, PoolClient } from 'pg';
import type { AdmittedWorldCommit } from '../.shared-kernel/SharedCommitContracts.js';
import { sharedCanonical } from './SharedReceiptSigner.js';

export interface RelayStoredStream {
  readonly world_id: string;
  generation: string;
  next_position: string;
  retention_floor: string;
}

export interface RelayStoredCommit {
  readonly world_id: string;
  readonly generation: string;
  readonly position: string;
  readonly account_id: string;
  readonly author_sequence: string;
  readonly envelope_bytes: Buffer | null;
  readonly public_proof: Omit<AdmittedWorldCommit, 'envelopeBytesBase64Url'> | null;
  readonly envelope_sha256: string;
  readonly admitted_at: string;
  readonly retained_until: string;
  readonly tombstone: boolean;
  readonly receipt: Buffer;
}

/** Only finite shared ciphertext, public proof, cursors and ACK declarations live here. */
export class RelayStorage {
  constructor(readonly pool: Pool) {}

  async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await action(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async lockStream(client: PoolClient, worldId: string): Promise<RelayStoredStream> {
    await client.query('INSERT INTO relay_streams(world_id,generation,next_position,retention_floor) VALUES($1,1,1,0) ON CONFLICT(world_id) DO NOTHING', [worldId]);
    return (await client.query<RelayStoredStream>('SELECT * FROM relay_streams WHERE world_id=$1 FOR UPDATE', [worldId])).rows[0]!;
  }

  /** Expiry never uses ACK counts. Earlier unexpired rows retain their bytes even behind the floor. */
  async expire(client: PoolClient, stream: RelayStoredStream, trustedTime: number | null): Promise<void> {
    if (trustedTime === null) { return; }
    const expired = (await client.query<{ floor: string | null }>('SELECT max(position)::text AS floor FROM relay_commit_queue WHERE world_id=$1 AND generation=$2 AND retained_until<=$3', [stream.world_id, stream.generation, trustedTime])).rows[0]!.floor;
    // Lost-range generation changes must not strand old finite payloads forever. The floor
    // above remains specific to the active stream; cleanup covers every generation of this world.
    await client.query('UPDATE relay_commit_queue SET envelope_bytes=NULL,public_proof=NULL,tombstone=true WHERE world_id=$1 AND retained_until<=$2 AND NOT tombstone', [stream.world_id, trustedTime]);
    if (expired !== null && BigInt(expired) > BigInt(stream.retention_floor)) {
      stream.retention_floor = expired;
      await client.query('UPDATE relay_streams SET retention_floor=$2 WHERE world_id=$1', [stream.world_id, expired]);
    }
  }

  /** A certified missing position changes generation once; no successful empty rebuild is invented. */
  async detectLostRange(client: PoolClient, stream: RelayStoredStream): Promise<boolean> {
    const row = (await client.query<{ count: string; damaged: boolean }>('SELECT count(*)::text AS count,coalesce(bool_or(((envelope_bytes IS NULL OR public_proof IS NULL) AND NOT tombstone) OR (tombstone AND position>$3)),false) AS damaged FROM relay_commit_queue WHERE world_id=$1 AND generation=$2', [stream.world_id, stream.generation, stream.retention_floor])).rows[0]!;
    if (BigInt(row.count) === BigInt(stream.next_position) - 1n && !row.damaged) { return false; }
    const generation = Number(stream.generation) + 1;
    if (!Number.isSafeInteger(generation)) { throw new Error('Relay generation exhausted'); }
    stream.generation = String(generation);
    stream.next_position = '1';
    stream.retention_floor = '0';
    await client.query('UPDATE relay_streams SET generation=$2,next_position=1,retention_floor=0 WHERE world_id=$1', [stream.world_id, generation]);
    return true;
  }

  async missingAdmission(client: PoolClient, stream: RelayStoredStream): Promise<boolean> {
    return (await client.query('SELECT 1 FROM authority_commit_admissions a LEFT JOIN relay_commit_queue q ON q.account_id=a.account_id AND q.author_sequence=a.author_sequence AND q.world_id=a.world_id AND q.generation=$2 WHERE a.world_id=$1 AND q.account_id IS NULL LIMIT 1', [stream.world_id, stream.generation])).rowCount !== 0;
  }

  static bytes(value: unknown): Buffer { return Buffer.from(sharedCanonical(value)); }

  static commit(row: RelayStoredCommit): AdmittedWorldCommit {
    if (row.tombstone || row.envelope_bytes === null || row.public_proof === null) { throw new Error('Relay ciphertext unavailable'); }
    return { ...row.public_proof, envelopeBytesBase64Url: row.envelope_bytes.toString('base64url') };
  }
}
