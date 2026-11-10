import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { environmentConfig } from './config.js';
import { keyFingerprint, validatePublicKey } from './crypto.js';
import { sharedCanonical } from './SharedReceiptSigner.js';
import { SharedCommitCodec } from '../.shared-kernel/SharedCommitCodec.js';
export async function sharedEnvironmentConfig() {
    const auth = environmentConfig();
    if (!process.env.SHARED_OPERATOR_PINS_PATH || !process.env.SHARED_ACCESS_CODE_PEPPER || !process.env.SHARED_CLOCK_TRUST_REVISION)
        throw new Error('Shared operator pins, code pepper and clock trust revision required');
    const pepper = Buffer.from(process.env.SHARED_ACCESS_CODE_PEPPER, 'base64url');
    if (pepper.length !== 32 || pepper.toString('base64url') !== process.env.SHARED_ACCESS_CODE_PEPPER)
        throw new Error('Shared code pepper must be 32 canonical random bytes');
    const input = JSON.parse(await readFile(process.env.SHARED_OPERATOR_PINS_PATH, 'utf8'));
    if (!Array.isArray(input))
        throw new Error('Shared operator pins must be an explicit array');
    const config = { auth, operatorWorldPins: input, accessCodePepper: pepper, operatorClockTrustRevision: process.env.SHARED_CLOCK_TRUST_REVISION };
    validateSharedConfig(config);
    return config;
}
export function validateSharedConfig(config) {
    const origin = new URL(config.auth.origin);
    if (config.auth.host !== '127.0.0.1' || origin.origin !== config.auth.origin || origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.port !== String(config.auth.port) || !Number.isInteger(config.auth.port) || config.auth.port < 0 || config.auth.port > 65535)
        throw new Error('Shared backend requires exact HTTP IPv4 loopback');
    if (config.accessCodePepper.length !== 32 || !/^[A-Za-z0-9_.:-]{1,128}$/.test(config.operatorClockTrustRevision))
        throw new Error('Invalid shared operator configuration');
    const seen = new Set();
    const codec = new SharedCommitCodec();
    for (const pin of config.operatorWorldPins) {
        const expected = ['serviceInstanceId', 'worldId', 'mapId', 'worldDeveloperAccountId', 'developerTrustAnchor', 'developerTrustAnchorSha256', 'genesisSha256', 'contentManifestSha256'].sort();
        if (Object.keys(pin).sort().join('|') !== expected.join('|'))
            throw new Error('Operator pin fields invalid');
        const anchor = codec.validate('WorldDeveloperTrustAnchor', pin.developerTrustAnchor);
        validatePublicKey(anchor.developerPublicKey);
        if (pin.serviceInstanceId !== config.auth.serviceInstanceId || pin.worldId !== anchor.worldId || pin.worldDeveloperAccountId !== anchor.worldDeveloperAccountId || seen.has(pin.worldId))
            throw new Error('Operator pin context invalid');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(pin.mapId) || ![pin.developerTrustAnchorSha256, pin.genesisSha256, pin.contentManifestSha256].every(x => /^[0-9a-f]{64}$/.test(x)))
            throw new Error('Operator pin digest invalid');
        if (keyFingerprint(anchor.developerPublicKey) !== anchor.developerPublicKeyFingerprint || createHash('sha256').update(sharedCanonical(anchor)).digest('hex') !== pin.developerTrustAnchorSha256)
            throw new Error('Operator pin fingerprint invalid');
        seen.add(pin.worldId);
    }
}
