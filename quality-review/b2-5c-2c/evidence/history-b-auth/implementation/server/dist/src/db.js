import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
export const passwordOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 };
export function createPool(connectionString) { const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 5000 }); pool.on('error', () => undefined); return pool; }
export async function migrate(pool, migrationDirectory = resolve(process.cwd(), 'migrations')) {
    const client = await pool.connect();
    try {
        const version = await client.query('SHOW server_version_num');
        if (Math.floor(Number(version.rows[0]?.server_version_num) / 10000) !== 17)
            throw new Error('PostgreSQL 17 required');
        await client.query('SELECT pg_advisory_lock(253601)');
        await client.query(await readFile(resolve(migrationDirectory, '001.sql'), 'utf8'));
    }
    finally {
        await client.query('SELECT pg_advisory_unlock(253601)').catch(() => undefined);
        client.release();
    }
}
export async function transaction(pool, action) {
    const client = await pool.connect();
    try {
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
    }
}
export async function createAccount(pool, accountName, password) {
    if (!/^[A-Za-z0-9_.-]{3,64}$/.test(accountName) || password.length < 12 || password.length > 1024 || /[\u0000-\u001f\u007f]/.test(password))
        throw new Error('Account name or password does not meet policy');
    const accountId = randomUUID();
    const passwordHash = await argon2.hash(password, passwordOptions);
    await pool.query('INSERT INTO accounts(account_id,account_name,password_hash,created_at) VALUES($1,$2,$3,$4)', [accountId, accountName, passwordHash, Date.now()]);
    return accountId;
}
