import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, randomUUID, sign, verify } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
export function canonical(value) {
    if (value === null || typeof value === 'boolean')
        return JSON.stringify(value);
    if (typeof value === 'string') {
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))
            throw new Error('Invalid Unicode');
        return JSON.stringify(value);
    }
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value))
            throw new Error('Unsafe numeric value');
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const object = value;
        return '{' + Object.keys(object).sort().map(key => canonical(key) + ':' + canonical(object[key])).join(',') + '}';
    }
    throw new Error('Invalid canonical data');
}
export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export function randomToken() { return randomBytes(32).toString('base64url'); }
export function publicJwk(key) {
    const jwk = createPublicKey(key).export({ format: 'jwk' });
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y)
        throw new Error('Not P-256');
    return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}
export function keyFingerprint(jwk) {
    return createHash('sha256').update(canonical({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url');
}
export function validatePublicKey(jwk) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(jwk.x) || !/^[A-Za-z0-9_-]{43}$/.test(jwk.y))
        throw new Error('Invalid coordinates');
    if (Buffer.from(jwk.x, 'base64url').toString('base64url') !== jwk.x || Buffer.from(jwk.y, 'base64url').toString('base64url') !== jwk.y)
        throw new Error('Noncanonical coordinates');
    createPublicKey({ key: { ...jwk }, format: 'jwk' });
}
export function deviceProofBytes(challenge) { return Buffer.from('Neurou/device/v1\0' + canonical(challenge)); }
export function verifyDeviceProof(challenge, jwk, signature) {
    if (!/^[A-Za-z0-9_-]{86}$/.test(signature))
        return false;
    const bytes = Buffer.from(signature, 'base64url');
    if (bytes.length !== 64 || bytes.toString('base64url') !== signature)
        return false;
    try {
        return verify('sha256', deviceProofBytes(challenge), { key: createPublicKey({ key: { ...jwk }, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, bytes);
    }
    catch {
        return false;
    }
}
export class ReceiptSigner {
    serviceInstanceId;
    privateKey;
    jwk;
    keyId;
    constructor(serviceInstanceId, privateKey) {
        this.serviceInstanceId = serviceInstanceId;
        this.privateKey = privateKey;
        this.jwk = publicJwk(privateKey);
        this.keyId = keyFingerprint(this.jwk);
    }
    issue(purpose, payload, now) {
        const unsigned = { schemaVersion: 1, serviceInstanceId: this.serviceInstanceId, purpose, receiptId: randomUUID(), keyId: this.keyId, issuedAtServerEpochMs: now, payload };
        const signatureBase64Url = sign('sha256', Buffer.from('Neurou/service/v1\0' + canonical(unsigned)), { key: this.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
        return { ...unsigned, signatureBase64Url };
    }
}
export async function loadSigner(serviceInstanceId, keyPath) {
    await mkdir(dirname(keyPath), { recursive: true });
    let pem;
    try {
        pem = await readFile(keyPath, 'utf8');
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
        const generated = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
        try {
            await writeFile(keyPath, generated, { flag: 'wx', mode: 0o600 });
            pem = generated;
        }
        catch (writeError) {
            if (writeError.code !== 'EEXIST')
                throw writeError;
            pem = await readFile(keyPath, 'utf8');
        }
    }
    return new ReceiptSigner(serviceInstanceId, createPrivateKey(pem));
}
