import { createCipheriv, createHmac, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes } from 'node:crypto';
import { publicJwk, sha256 } from './crypto.js';
import { sharedCanonical } from './SharedReceiptSigner.js';
export function makeCredentialChallenge(context) {
    const ephemeral = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const ephemeralKeyAgreementPublicKey = publicJwk(ephemeral.privateKey);
    const z = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: createPublicKey({ key: { ...context.recipient.keyAgreementPublicKey }, format: 'jwk' }) });
    const salt = randomBytes(32), nonce = randomBytes(12), secret = randomBytes(32);
    const key = Buffer.from(hkdfSync('sha256', z, salt, Buffer.from('Neurou/world-member-credential-proof-key/v1\0' + sharedCanonical(context)), 32));
    const aad = Buffer.from('Neurou/world-member-credential-proof-aad/v1\0' + sharedCanonical({ context, ephemeralKeyAgreementPublicKey, saltBase64Url: salt.toString('base64url') }));
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(secret), cipher.final(), cipher.getAuthTag()]);
    const challenge = { context, ephemeralKeyAgreementPublicKey, saltBase64Url: salt.toString('base64url'), nonceBase64Url: nonce.toString('base64url'), ciphertextAndTagBase64Url: encrypted.toString('base64url') };
    const tag = createHmac('sha256', secret).update('Neurou/world-member-credential-possession/v1\0' + sharedCanonical(challenge)).digest();
    const expectedTagSha256 = sha256(tag);
    z.fill(0);
    key.fill(0);
    secret.fill(0);
    tag.fill(0);
    return { challenge, expectedTagSha256 };
}
