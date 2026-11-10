import { performance } from 'node:perf_hooks';
export class RealAuthorityClock {
    instance;
    revision;
    source;
    previousWall;
    previousMono;
    trusted;
    floor = null;
    generation = 0;
    constructor(instance, initialTrusted, revision, source) {
        this.instance = instance;
        this.revision = revision;
        this.source = source;
        this.previousWall = source.wall();
        this.previousMono = source.monotonic();
        this.trusted = initialTrusted;
    }
    static production(config) { return new RealAuthorityClock(config.auth.serviceInstanceId, config.auth.clockInitiallyTrusted, config.operatorClockTrustRevision, { wall: () => Date.now(), monotonic: () => performance.now() }); }
    /** Explicit isolated-test capability; the production entry never accepts a source/environment clock. */
    static isolatedTest(instance, revision, source) { return new RealAuthorityClock(instance, true, revision, source); }
    async initialize(pool) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(253602)');
            const generation = Number((await client.query("SELECT nextval('service_clock_generation') AS generation")).rows[0].generation);
            if (!Number.isSafeInteger(generation) || generation < 1)
                throw new Error('Clock generation exhausted');
            this.generation = generation;
            const row = (await client.query('SELECT * FROM authority_clock_state WHERE service_instance_id=$1 FOR UPDATE', [this.instance])).rows[0];
            if (row) {
                this.floor = row.last_signed_epoch_ms === null ? null : Number(row.last_signed_epoch_ms);
                this.trusted = this.trusted && (row.trusted || row.operator_trust_revision !== this.revision);
            }
            if (this.floor !== null && this.previousWall < this.floor)
                this.trusted = false;
            await client.query(`INSERT INTO authority_clock_state(service_instance_id,generation,last_signed_epoch_ms,trusted,operator_trust_revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT(service_instance_id) DO UPDATE SET generation=EXCLUDED.generation,trusted=EXCLUDED.trusted,operator_trust_revision=EXCLUDED.operator_trust_revision`, [this.instance, generation, this.floor, this.trusted, this.revision]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async sample(client) {
        const row = (await client.query('SELECT generation,trusted,last_signed_epoch_ms FROM authority_clock_state WHERE service_instance_id=$1 FOR UPDATE', [this.instance])).rows[0];
        if (!row)
            throw new Error('Clock uninitialized');
        const wall = this.source.wall(), mono = this.source.monotonic();
        const floor = row.last_signed_epoch_ms === null ? null : Number(row.last_signed_epoch_ms);
        if (Number(row.generation) !== this.generation || !row.trusted || !Number.isSafeInteger(wall) || wall < 0 || wall < this.previousWall || (floor !== null && wall < floor) || Math.abs((wall - this.previousWall) - (mono - this.previousMono)) > 2000)
            this.trusted = false;
        this.previousWall = wall;
        this.previousMono = mono;
        if (this.trusted)
            this.floor = wall;
        else
            this.floor = floor;
        await client.query('UPDATE authority_clock_state SET trusted=$2,last_signed_epoch_ms=$3 WHERE service_instance_id=$1 AND generation=$4', [this.instance, this.trusted, this.floor, this.generation]);
        return { trusted: this.trusted, epochMs: this.trusted ? wall : null, lastSignedEpochMs: this.floor, generation: this.generation };
    }
    async persistLatch(pool) { if (!this.trusted)
        await pool.query('UPDATE authority_clock_state SET trusted=false WHERE service_instance_id=$1 AND generation=$2', [this.instance, this.generation]); }
}
