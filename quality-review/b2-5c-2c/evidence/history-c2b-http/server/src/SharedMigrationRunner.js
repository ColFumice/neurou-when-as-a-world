import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from './crypto.js';
const ORIGINAL_001_SHA256 = '5468eb425557c8ca1be6c5fb969dbd5bb038e7715b10e9f4842ea15859a30d13';
const BASE_COLUMNS = {
    accounts: ['account_id', 'account_name', 'password_hash', 'created_at', 'disabled'],
    devices: ['device_id', 'account_id', 'generation', 'key_fingerprint', 'public_key_jwk', 'label', 'assurance', 'status', 'created_at'],
    auth_families: ['session_id', 'account_id', 'device_id', 'csrf_hash', 'absolute_expires_at', 'revoked', 'created_at'],
    auth_tokens: ['token_hash', 'session_id', 'kind', 'expires_at', 'used'],
    device_challenges: ['challenge_id', 'purpose', 'account_name', 'device_id', 'public_key_jwk', 'key_fingerprint', 'challenge_data', 'expires_at', 'consumed', 'owner_session_id'],
    lightweight_requests: ['account_id', 'request_id', 'operation', 'request_digest', 'result'],
};
export class SharedMigrationRunner {
    async migrate(pool, serverDirectory = process.cwd()) {
        const first = await readFile(resolve(serverDirectory, 'migrations/001.sql'), 'utf8');
        const second = await readFile(resolve(serverDirectory, 'sql/002_shared_authority.sql'), 'utf8');
        if (sha256(first) !== ORIGINAL_001_SHA256)
            throw new Error('Protected 001 checksum mismatch');
        const client = await pool.connect();
        try {
            if (Math.floor(Number((await client.query('SHOW server_version_num')).rows[0].server_version_num) / 10000) !== 17)
                throw new Error('PostgreSQL 17 required');
            await client.query('SELECT pg_advisory_lock(253601)');
            const exists = (await client.query("SELECT to_regclass('public.service_schema_versions') IS NOT NULL AS exists")).rows[0].exists;
            if (!exists) {
                const partial = (await client.query("SELECT to_regclass('public.accounts') IS NOT NULL AS exists")).rows[0].exists;
                if (partial)
                    throw new Error('Partial legacy schema rejected');
                await client.query(first);
            }
            const versions = (await client.query('SELECT version FROM service_schema_versions ORDER BY version')).rows.map(row => row.version);
            if (versions.join(',') !== '1' && versions.join(',') !== '1,2')
                throw new Error('Unsupported legacy schema version');
            for (const [table, expected] of Object.entries(BASE_COLUMNS)) {
                const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table])).rows.map(row => row.column_name);
                if (columns.join('|') !== expected.join('|'))
                    throw new Error('Legacy schema drift rejected');
            }
            await client.query('BEGIN');
            const checksumColumn = (await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_schema_versions' AND column_name='source_sha256'")).rowCount;
            if (!checksumColumn)
                await client.query('ALTER TABLE service_schema_versions ADD COLUMN source_sha256 text');
            const one = (await client.query('SELECT source_sha256 FROM service_schema_versions WHERE version=1 FOR UPDATE')).rows[0];
            if (one.source_sha256 !== null && one.source_sha256 !== ORIGINAL_001_SHA256)
                throw new Error('Recorded 001 checksum mismatch');
            await client.query('UPDATE service_schema_versions SET source_sha256=$1 WHERE version=1', [ORIGINAL_001_SHA256]);
            if (versions.includes(2)) {
                if ((await client.query('SELECT source_sha256 FROM service_schema_versions WHERE version=2')).rows[0].source_sha256 !== sha256(second))
                    throw new Error('002 checksum mismatch');
            }
            else {
                await client.query(second);
                await client.query('INSERT INTO service_schema_versions(version,source_sha256) VALUES(2,$1)', [sha256(second)]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw error;
        }
        finally {
            await client.query('SELECT pg_advisory_unlock(253601)').catch(() => undefined);
            client.release();
        }
    }
}
