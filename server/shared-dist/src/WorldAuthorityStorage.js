import { sharedCanonical } from './SharedReceiptSigner.js';
export class WorldAuthorityStorage {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async transaction(action) { const client = await this.pool.connect(); try {
        await client.query('BEGIN');
        const result = await action(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    } }
    async lockWorld(client, id) { return (await client.query('SELECT * FROM authority_worlds WHERE world_id=$1 FOR UPDATE', [id])).rows[0] ?? null; }
    static bytes(value) { return Buffer.from(sharedCanonical(value)); }
    static value(bytes) { return JSON.parse(bytes.toString('utf8')); }
}
