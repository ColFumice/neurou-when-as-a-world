import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { generateKeyPairSync, randomUUID, sign, createPublicKey, verify } from 'node:crypto';
import { canonical, deviceProofBytes, publicJwk, randomToken } from '../src/crypto.js';
import { createPool, migrate } from '../src/db.js';
test('independent main process: private stable signing key, CLI provisioning, HTTP authentication and persisted session after restart', async () => {
    const databaseUrl = process.env.B25B_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl)
        throw new Error('B25B_DATABASE_URL required; no fake process smoke');
    const pool = createPool(databaseUrl);
    await migrate(pool);
    await pool.end();
    // Parent .local is operator-protected before execution (Windows ACL or Unix 0700).
    const directory = await mkdtemp(resolve('.local/process-smoke-'));
    if (process.platform !== 'win32')
        assert.equal((await stat(resolve('.local'))).mode & 0o077, 0);
    const probe = createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    assert.ok(address && typeof address !== 'string');
    const port = address.port;
    await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    const origin = `http://127.0.0.1:${port}`;
    const serviceInstanceId = 'neurou-process-smoke-' + randomUUID();
    const environment = { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port), SERVICE_ORIGIN: origin, SERVICE_INSTANCE_ID: serviceInstanceId, SIGNING_KEY_PATH: join(directory, 'signing-key.pem'), CLOCK_TRUSTED: 'true' };
    async function cli(command, args = [], extra = {}) {
        return await new Promise((resolve, reject) => { const child = spawn(process.execPath, ['dist/src/cli.js', command, ...args], { cwd: process.cwd(), env: { ...environment, ...extra }, windowsHide: true }); let text = ''; child.stdout.on('data', chunk => text += String(chunk)); child.stderr.on('data', () => undefined); child.once('error', () => reject(new Error('CLI process failed'))); child.once('exit', code => code === 0 ? resolve(JSON.parse(text)) : reject(new Error('CLI process failed'))); });
    }
    const anchor = await cli('trust-anchor');
    assert.equal(anchor.serviceInstanceId, serviceInstanceId);
    const accountName = 'process_' + randomUUID().replaceAll('-', '');
    const password = randomToken();
    const created = await cli('account-create', [accountName], { ACCOUNT_PASSWORD: password });
    assert.equal(created.accountName, accountName);
    let child;
    async function start() {
        child = spawn(process.execPath, ['dist/src/main.js'], { cwd: process.cwd(), env: environment, windowsHide: true });
        await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('main process startup timeout')), 10000); child.once('error', () => { clearTimeout(timer); reject(new Error('main process startup failed')); }); child.once('exit', () => { clearTimeout(timer); reject(new Error('main process exited before listening')); }); child.stdout.on('data', chunk => { if (String(chunk).includes('ExternalService listening')) {
            clearTimeout(timer);
            resolve();
        } }); child.stderr.on('data', () => undefined); });
    }
    async function stop() { if (!child || child.exitCode !== null)
        return; await new Promise(resolve => { child.once('exit', () => resolve()); child.kill('SIGTERM'); }); child = undefined; }
    let cookieHeader = '';
    let csrf = '';
    async function post(path, body) {
        const response = await fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: JSON.stringify(body) });
        assert.equal(response.status, 200);
        const cookies = response.headers.getSetCookie();
        if (cookies.length)
            cookieHeader = cookies.map(value => value.split(';')[0]).join('; ');
        return await response.json();
    }
    function validate(receipt) { assert.equal(receipt.keyId, anchor.keyId); assert.equal(receipt.serviceInstanceId, anchor.serviceInstanceId); const { signatureBase64Url, ...unsigned } = receipt; assert.ok(verify('sha256', Buffer.from('Neurou/service/v1\0' + canonical(unsigned)), { key: createPublicKey({ key: anchor.publicKeyJwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(signatureBase64Url, 'base64url'))); }
    try {
        await start();
        const readiness = await fetch(origin + '/health/ready');
        assert.equal(readiness.status, 200);
        assert.equal((await readiness.json()).keyId, anchor.keyId);
        const privateKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
        const challenge = await post('/api/v1/device/challenge', { purpose: 'LoginDevice', accountName, publicKeyJwk: publicJwk(privateKey), deviceId: null, requestNonce: randomToken() });
        validate(challenge);
        const challengePayload = challenge.payload;
        const signatureBase64Url = sign('sha256', deviceProofBytes(challengePayload), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
        const login = await post('/api/v1/auth/login', { accountName, password, challengeId: challengePayload.challengeId, signatureBase64Url, deviceLabel: 'Independent main process credential', requestNonce: randomToken() });
        validate(login);
        csrf = login.payload.csrfToken;
        const sessionId = login.payload.sessionId;
        const firstTime = await post('/api/v1/time', { requestNonce: randomToken() });
        validate(firstTime);
        await stop();
        await start();
        const restored = await post('/api/v1/auth/verify', { requestNonce: randomToken() });
        validate(restored);
        assert.equal(restored.payload.sessionId, sessionId);
        const secondTime = await post('/api/v1/time', { requestNonce: randomToken() });
        validate(secondTime);
        assert.ok(secondTime.payload.clockGeneration > firstTime.payload.clockGeneration);
        assert.equal((await cli('trust-anchor')).keyId, anchor.keyId);
    }
    finally {
        await stop();
    }
});
