import { resolve } from 'node:path';
export function environmentConfig() {
    const port = Number(process.env.PORT ?? 43125);
    const origin = process.env.SERVICE_ORIGIN ?? `http://127.0.0.1:${port}`;
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
        throw new Error('PORT invalid');
    const url = new URL(origin);
    if (url.origin !== origin || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== String(port))
        throw new Error('This development server requires exact HTTP loopback origin');
    if (!process.env.DATABASE_URL)
        throw new Error('DATABASE_URL required');
    const serviceInstanceId = process.env.SERVICE_INSTANCE_ID ?? 'neurou-local-development';
    if (!/^[A-Za-z0-9_.-]{3,128}$/.test(serviceInstanceId))
        throw new Error('SERVICE_INSTANCE_ID invalid');
    return { databaseUrl: process.env.DATABASE_URL, host: '127.0.0.1', port, origin, serviceInstanceId, signingKeyPath: resolve(process.env.SIGNING_KEY_PATH ?? '.local/service-signing-key.pem'), clockInitiallyTrusted: process.env.CLOCK_TRUSTED === 'true', accessTtlMs: 900_000, refreshTtlMs: 604_800_000, challengeTtlMs: 30_000 };
}
