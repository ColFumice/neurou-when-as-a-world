import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { keyFingerprint, publicJwk } from './crypto.js';
import { SharedCanonicalBytes } from '../.shared-kernel/SharedCanonicalBytes.js';
import { SharedCommitCodec } from '../.shared-kernel/SharedCommitCodec.js';
export function sharedCanonical(value) { return SharedCanonicalBytes.text(SharedCanonicalBytes.encode(value)); }
export function sharedUnsigned(value, omitted) { const result = {}; for (const [key, item] of Object.entries(value))
    if (key !== omitted)
        result[key] = item; return result; }
export function verifySharedSignature(publicKey, domain, value, signature) {
    try {
        const bytes = Buffer.from(signature, 'base64url');
        if (bytes.length !== 64 || bytes.toString('base64url') !== signature)
            return false;
        return verify('sha256', Buffer.from(domain + sharedCanonical(value)), { key: createPublicKey({ key: publicKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, bytes);
    }
    catch {
        return false;
    }
}
export class SharedReceiptSigner {
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
    static async load(serviceInstanceId, path) { return new SharedReceiptSigner(serviceInstanceId, createPrivateKey(await readFile(path, 'utf8'))); }
    transport(purpose, requestNonce, payload) {
        const unsigned = { schemaVersion: 1, serviceInstanceId: this.serviceInstanceId, purpose, receiptId: randomUUID(), requestNonce, keyId: this.keyId, payload };
        return { ...unsigned, signatureBase64Url: this.signature('Neurou/shared-transport/v1\0', unsigned) };
    }
    authority(purpose, requestNonce, payload, time, generation) {
        const unsigned = { schemaVersion: 1, serviceInstanceId: this.serviceInstanceId, purpose, receiptId: randomUUID(), keyId: this.keyId, requestNonce, issuedAtServerEpochMs: time, clockGeneration: generation, clockStatus: 'Trusted', payload };
        const receipt = { ...unsigned, signatureBase64Url: this.signature('Neurou/shared-authority/v1\0', unsigned) };
        new SharedCommitCodec().validate('SharedAuthorityReceipt', receipt);
        return receipt;
    }
    signature(domain, value) { return sign('sha256', Buffer.from(domain + sharedCanonical(value)), { key: this.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url'); }
    verifyAuthority(input) {
        const receipt = new SharedCommitCodec().validate('SharedAuthorityReceipt', input);
        if (receipt.serviceInstanceId !== this.serviceInstanceId || receipt.keyId !== this.keyId || !verifySharedSignature(this.jwk, 'Neurou/shared-authority/v1\0', sharedUnsigned(receipt, 'signatureBase64Url'), receipt.signatureBase64Url))
            throw new Error('Authority receipt invalid');
        return receipt;
    }
}
