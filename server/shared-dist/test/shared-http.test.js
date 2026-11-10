import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createHmac, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomUUID, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { request as rawHttpRequest } from 'node:http';
import { createAccount, createPool } from '../src/db.js';
import { ReceiptSigner, publicJwk, keyFingerprint, randomToken, sha256, deviceProofBytes } from '../src/crypto.js';
import { SharedReceiptSigner, sharedCanonical, sharedUnsigned } from '../src/SharedReceiptSigner.js';
import { SharedMigrationRunner } from '../src/SharedMigrationRunner.js';
import { buildSharedServer, buildIsolatedSharedServer } from '../src/buildSharedServer.js';
import { RealAuthorityClock } from '../src/RealAuthorityClock.js';
import { validateSharedConfig } from '../src/SharedServerConfig.js';
import { SharedServiceProtocolCodec } from '../.shared-kernel/SharedServiceProtocolCodec.js';
const source = JSON.parse((await readFile('../quality-review/b2-5c-2b/evidence/runtime/.local/connection-final.json', 'utf8')).replace(/^\uFEFF/, ''));
const instance = 'neurou-shared-' + randomUUID(), worldId = randomUUID(), mapId = randomUUID();
const servicePrivate = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const developerPrivate = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const signer = new SharedReceiptSigner(instance, servicePrivate), authSigner = new ReceiptSigner(instance, servicePrivate);
let pool, app, config, origin, root, observer, second, registration, epoch, segment, permit, accepted, acceptedPayload;
let lastError = '';
let pendingOldEpoch, pendingCurrentEpoch;
let pendingCredential;
const readOnly = new Set(['/status', '/world/facts', '/credential/challenge', '/observer/challenge', '/membership/read', '/commit/admission']);
function signature(key, domain, value) { return sign('sha256', Buffer.from(domain + sharedCanonical(value)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url'); }
async function http(path, body, principal, extra = {}) {
    const response = await fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...principal.cookies].map(([k, v]) => k + '=' + v).join('; '), 'X-CSRF-Token': principal.csrf, ...extra }, body: typeof body === 'string' ? body : sharedCanonical(body) });
    for (const item of response.headers.getSetCookie()) {
        const pair = item.split(';')[0];
        const i = pair.indexOf('=');
        const name = pair.slice(0, i), value = pair.slice(i + 1);
        if (value)
            principal.cookies.set(name, value);
        else
            principal.cookies.delete(name);
    }
    const wire = await response.text();
    return { status: response.status, body: JSON.parse(wire), wire, headers: response.headers };
}
function signedRequest(operation, payload, p, nonce = randomToken()) {
    let authorization = null;
    if (!readOnly.has(operation)) {
        const unsigned = { schemaVersion: 1, serviceInstanceId: instance, operation, requestNonce: nonce, authorDeviceId: p.auth.device.deviceId, authorDeviceGeneration: p.auth.device.generation, payload };
        authorization = { authorDeviceId: p.auth.device.deviceId, authorDeviceGeneration: p.auth.device.generation, deviceSignatureBase64Url: signature(p.key, 'Neurou/shared-device-operation/v1\0', unsigned) };
    }
    return { schemaVersion: 1, requestNonce: nonce, payload, authorization };
}
async function shared(operation, payload, p = root, nonce = randomToken()) { return http('/api/v1/shared' + operation, signedRequest(operation, payload, p, nonce), p); }
function checked(response, operation, nonce) {
    assert.equal(response.status, 200, response.body.fault?.detail);
    assert.equal(response.body.kind, 'Accepted');
    const receipt = response.body.value;
    SharedServiceProtocolCodec.parseReply(operation, response.wire, nonce ?? receipt.requestNonce);
    assert.equal(receipt.serviceInstanceId, instance);
    assert.equal(receipt.keyId, signer.keyId);
    assert.ok(verify('sha256', Buffer.from('Neurou/shared-transport/v1\0' + sharedCanonical(sharedUnsigned(receipt, 'signatureBase64Url'))), { key: createPublicKey(servicePrivate), dsaEncoding: 'ieee-p1363' }, Buffer.from(receipt.signatureBase64Url, 'base64url')));
    const inner = receipt.payload.receipt ?? receipt.payload.epochReceipt ?? receipt.payload.authorKeyBinding;
    if (inner) {
        signer.verifyAuthority(inner);
    }
    return receipt;
}
async function principal(name, account = null, key = null) {
    const p = { name: name + '_' + randomUUID().replaceAll('-', ''), password: randomToken(), account: account ?? '', key: key ?? generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey, agreement: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey, cookies: new Map(), csrf: '', auth: {}, credential: null, agreementFact: null };
    if (account === null)
        p.account = await createAccount(pool, p.name, p.password);
    return p;
}
async function login(p) {
    const challenge = await http('/api/v1/device/challenge', { purpose: 'LoginDevice', accountName: p.name, publicKeyJwk: publicJwk(p.key), deviceId: null, requestNonce: randomToken() }, p);
    assert.equal(challenge.status, 200);
    const login = await http('/api/v1/auth/login', { accountName: p.name, password: p.password, challengeId: challenge.body.payload.challengeId, signatureBase64Url: sign('sha256', deviceProofBytes(challenge.body.payload), { key: p.key, dsaEncoding: 'ieee-p1363' }).toString('base64url'), deviceLabel: 'Independent shared authority test credential', requestNonce: randomToken() }, p);
    assert.equal(login.status, 200);
    p.auth = login.body.payload;
    p.csrf = p.auth.csrfToken;
}
async function proveAgreement(p, wrongTag = false) {
    const publicKey = publicJwk(p.agreement);
    const response = await shared('/credential/challenge', { worldId, keyAgreementPublicKey: publicKey, keyAgreementKeyFingerprint: keyFingerprint(publicKey) }, p);
    const receipt = checked(response, '/credential/challenge');
    const challenge = receipt.payload;
    const context = challenge.context;
    const z = diffieHellman({ privateKey: p.agreement, publicKey: createPublicKey({ key: challenge.ephemeralKeyAgreementPublicKey, format: 'jwk' }) });
    const wrap = Buffer.from(hkdfSync('sha256', z, Buffer.from(challenge.saltBase64Url, 'base64url'), Buffer.from('Neurou/world-member-credential-proof-key/v1\0' + sharedCanonical(context)), 32));
    const encrypted = Buffer.from(challenge.ciphertextAndTagBase64Url, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', wrap, Buffer.from(challenge.nonceBase64Url, 'base64url'));
    cipher.setAuthTag(encrypted.subarray(-16));
    cipher.setAAD(Buffer.from('Neurou/world-member-credential-proof-aad/v1\0' + sharedCanonical({ context, ephemeralKeyAgreementPublicKey: challenge.ephemeralKeyAgreementPublicKey, saltBase64Url: challenge.saltBase64Url })));
    const secret = Buffer.concat([cipher.update(encrypted.subarray(0, -16)), cipher.final()]);
    assert.equal(secret.length, 32);
    const tag = createHmac('sha256', secret).update('Neurou/world-member-credential-possession/v1\0' + sharedCanonical(challenge)).digest('base64url');
    secret.fill(0);
    z.fill(0);
    wrap.fill(0);
    const nonce = randomToken();
    const unsigned = { schemaVersion: 1, serviceInstanceId: instance, worldId, challengeId: context.challengeId, requestNonce: nonce, challengeSha256: sha256(sharedCanonical(challenge)), recipient: context.recipient, proofTagBase64Url: wrongTag ? randomToken() : tag };
    const proof = { ...unsigned, recipientSignatureBase64Url: signature(p.key, 'Neurou/world-member-credential-proof-signature/v1\0', unsigned) };
    const result = await shared('/credential/register', { challengeReceipt: receipt, proof }, p, nonce);
    if (!wrongTag) {
        const registered = checked(result, '/credential/register');
        p.credential = registered.payload.credential;
        p.agreementFact = registered.payload;
    }
    return { response: result, proof, challenge: receipt };
}
function epochRequest(credentials, number, reason, previous) {
    const proposal = { schemaVersion: 1, serviceInstanceId: instance, worldId, membershipEpoch: number, previousMembershipEpoch: previous, key: { schemaVersion: 1, worldId, membershipEpoch: number, keyEpoch: number, worldRelayKeyId: randomUUID(), keyCommitmentSha256: sha256(randomToken()) }, credentials: credentials.slice().sort((a, b) => a.accountId.localeCompare(b.accountId) || a.deviceId.localeCompare(b.deviceId)), developerTrustAnchorSha256: config.operatorWorldPins[0].developerTrustAnchorSha256 };
    const next = { ...proposal, developerSignatureBase64Url: signature(developerPrivate, 'Neurou/world-membership/v1\0', proposal) };
    return { schemaVersion: 1, serviceInstanceId: instance, changeId: randomUUID(), worldId, requestNonce: randomToken(), expectedMembershipEpoch: previous, reason, next };
}
async function pendingAdmission(which, sequenceOffset, epochReceipt) {
    const identity = { authorAccountId: root.account, authorSequence: which.payload.firstSequence + sequenceOffset };
    const permitReceipt = checked(await shared('/append/permit', { worldId, identity, segmentId: which.payload.segmentId, membershipEpoch: epochReceipt.payload.membershipEpoch, keyEpoch: epochReceipt.payload.key.keyEpoch, changeClass: 'TraceTouch' }), '/append/permit').payload.receipt;
    const header = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', kind: 'RelayWorldCommit', serviceInstanceId: instance, worldId, identity, authorDeviceId: root.auth.device.deviceId, authorDeviceGeneration: root.auth.device.generation, authorSigningKeyFingerprint: keyFingerprint(publicJwk(root.key)), segmentId: which.payload.segmentId, permitId: permitReceipt.payload.permitId, membershipEpoch: epochReceipt.payload.membershipEpoch, keyEpoch: epochReceipt.payload.key.keyEpoch, worldRelayKeyId: epochReceipt.payload.key.worldRelayKeyId, appendedAt: permitReceipt.payload.appendedAt, changeClass: 'TraceTouch', commitClass: 'AddOnly', restrictedWrite: null, cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
    const nonce = randomToken(), claim = { schemaVersion: 1, serviceInstanceId: instance, requestNonce: nonce, header, envelopeSha256: sha256(randomToken()) };
    return { admissionClaim: { claim, authorSignatureBase64Url: signature(root.key, 'Neurou/commit-admission-claim/v1\0', claim) }, appendPermitReceipt: permitReceipt, sequenceSegmentReceipt: which };
}
before(async () => {
    pool = createPool(source.databaseUrl);
    await new SharedMigrationRunner().migrate(pool);
    root = await principal('root');
    observer = await principal('observer');
    second = await principal('second', root.account);
    second.name = root.name;
    second.password = root.password;
    const developerPublicKey = publicJwk(developerPrivate), fingerprint = keyFingerprint(developerPublicKey);
    const anchor = { schemaVersion: 1, worldId, worldDeveloperAccountId: root.account, developerSigningKeyId: fingerprint, developerPublicKey, developerPublicKeyFingerprint: fingerprint };
    config = { auth: { databaseUrl: source.databaseUrl, host: '127.0.0.1', port: 0, origin: 'http://127.0.0.1:0', serviceInstanceId: instance, signingKeyPath: 'unused-memory-service-key', clockInitiallyTrusted: true, accessTtlMs: 900000, refreshTtlMs: 604800000, challengeTtlMs: 30000 }, operatorWorldPins: [{ serviceInstanceId: instance, worldId, mapId, worldDeveloperAccountId: root.account, developerTrustAnchor: anchor, developerTrustAnchorSha256: sha256(sharedCanonical(anchor)), genesisSha256: sha256('explicitly-approved-independent-genesis'), contentManifestSha256: sha256('explicitly-approved-independent-manifest') }], accessCodePepper: Buffer.from(randomToken(), 'base64url'), operatorClockTrustRevision: 'test-operator-approved-v1' };
    app = await buildSharedServer(config, pool, authSigner, signer);
    app.addHook('onError', async (_req, _rep, error) => { lastError = error.message; });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    assert.ok(address && typeof address !== 'string');
    origin = config.auth.origin = `http://127.0.0.1:${address.port}`;
    config.auth.port = address.port;
    await login(root);
    await login(observer);
    await login(second);
});
after(async () => { await app?.close(); await pool?.end(); });
test('real PG17 migrates exact 18 shared tables, separate authority no Relay routes', async () => {
    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'authority_%' OR tablename LIKE 'relay_%')")).rows;
    assert.equal(tables.length, 18);
    const version = await pool.query('SHOW server_version_num');
    assert.equal(Math.floor(Number(version.rows[0].server_version_num) / 10000), 17);
    const absent = await http('/api/v1/shared/relay/submit', {}, root);
    assert.equal(absent.status, 404);
});
test('status uses same real PG session and precise signature/policy/clock, bad CSRF/extra fields reject', async () => {
    const receipt = checked(await shared('/status', {}), '/status');
    assert.equal(receipt.payload.clockStatus, 'Trusted');
    assert.ok(receipt.payload.clockGeneration > 0);
    assert.equal(receipt.payload.policy.settleHorizonMs, 3960000);
    const bad = await http('/api/v1/shared/status', signedRequest('/status', {}, root), root, { 'X-CSRF-Token': randomToken() });
    assert.equal(bad.status, 403);
    assert.equal(bad.body.fault.detail, 'CsrfRejected');
    const extra = await shared('/status', { unapproved: true });
    assert.equal(extra.status, 400);
    assert.equal(extra.body.fault.detail, 'SchemaInvalid');
    const raw = sharedCanonical(signedRequest('/status', {}, root));
    const noncanonical = await http('/api/v1/shared/status', ' ' + raw, root);
    assert.equal(noncanonical.status, 400);
    assert.equal(noncanonical.body.fault.detail, 'CanonicalInvalid');
});
test('new shared envelope preserves old exact Host/Origin/content-type guard and rejects bare LAN builder', async () => {
    const input = signedRequest('/status', {}, root);
    for (const headers of [{ Origin: 'http://evil.invalid' }, { 'Content-Type': 'text/plain' }]) {
        const result = await http('/api/v1/shared/status', input, root, headers);
        assert.equal(result.status, headers['Content-Type'] ? 400 : 403);
        assert.equal(result.body.fault.detail, headers['Content-Type'] ? 'SchemaInvalid' : 'OriginRejected');
        assert.equal(result.body.kind, 'Rejected');
    }
    const badHost = await new Promise(resolve => { const request = rawHttpRequest(origin + '/api/v1/shared/status', { method: 'POST', headers: { Host: 'evil.invalid', Origin: origin, 'Content-Type': 'application/json' } }, response => { let wire = ''; response.on('data', chunk => wire += String(chunk)); response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(wire) })); }); request.end(sharedCanonical(input)); });
    assert.equal(badHost.status, 403);
    assert.equal(badHost.body.fault.detail, 'OriginRejected');
    assert.throws(() => validateSharedConfig({ ...config, auth: { ...config.auth, origin: 'http://192.168.0.9:' + config.auth.port } }));
    assert.throws(() => validateSharedConfig({ ...config, auth: { ...config.auth, origin: 'http://localhost:' + config.auth.port } }));
    assert.throws(() => validateSharedConfig({ ...config, auth: { ...config.auth, origin: 'https://127.0.0.1:' + config.auth.port } }));
});
test('outer unsupported safe integer version has exact VersionUnsupported wire without masking canonical failures', async () => {
    const request = signedRequest('/status', {}, root);
    const unsupported = await http('/api/v1/shared/status', { ...request, schemaVersion: 2 }, root);
    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.body.fault.code, 'VersionUnsupported');
    assert.equal(unsupported.body.fault.detail, 'VersionUnsupported');
    const malformed = await http('/api/v1/shared/status', { ...request, schemaVersion: '2' }, root);
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.fault.code, 'InvalidData');
    assert.equal(malformed.body.fault.detail, 'SchemaInvalid');
    const raw = sharedCanonical({ ...request, schemaVersion: 2 });
    const noncanonical = await http('/api/v1/shared/status', ' ' + raw, root);
    assert.equal(noncanonical.status, 400);
    assert.equal(noncanonical.body.fault.detail, 'CanonicalInvalid');
    const duplicate = await http('/api/v1/shared/status', raw.slice(0, -1) + ',"schemaVersion":2}', root);
    assert.equal(duplicate.status, 400);
    assert.equal(duplicate.body.fault.code, 'InvalidData');
    assert.equal(duplicate.body.fault.detail, 'CanonicalInvalid');
});
test('operator approved world exact tuple and dual root/registered signatures, missing pin/tamper reject', async () => {
    const pin = config.operatorWorldPins[0];
    registration = { schemaVersion: 1, serviceInstanceId: instance, worldId, mapId, worldDeveloperAccountId: root.account, developerTrustAnchorSha256: pin.developerTrustAnchorSha256, genesisSha256: pin.genesisSha256, contentManifestSha256: pin.contentManifestSha256 };
    const request = { proposal: registration, developerSignatureBase64Url: signature(developerPrivate, 'Neurou/world-registration/v1\0', registration) };
    const wrong = { ...registration, genesisSha256: sha256('wrong') };
    const rejected = await shared('/world/register', { proposal: wrong, developerSignatureBase64Url: signature(developerPrivate, 'Neurou/world-registration/v1\0', wrong) });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.fault.detail, 'RootPinMismatch');
    checked(await shared('/world/register', request), '/world/register');
    const facts = checked(await shared('/world/facts', { worldId, observerAccountId: null }), '/world/facts');
    assert.equal(facts.payload.currentMembership, null);
    assert.equal(facts.payload.developerClosure, null);
    const denied = await shared('/world/facts', { worldId, observerAccountId: null }, observer);
    assert.equal(denied.status, 403);
});
test('real six digit code CAS, wrong code terminal consumption, correct code automatic ordinary Observer', async () => {
    const nonce = randomToken();
    const proposal = { schemaVersion: 1, serviceInstanceId: instance, worldId, requestNonce: nonce, expectedCodeRevision: null, accessCode: '000123' };
    checked(await shared('/access-code/set', { proposal, developerSignatureBase64Url: signature(developerPrivate, 'Neurou/world-access-code-change/v1\0', proposal) }, root, nonce), '/access-code/set');
    const request = { worldId, developerTrustAnchorSha256: registration.developerTrustAnchorSha256 };
    let challenge = checked(await shared('/observer/challenge', request, observer), '/observer/challenge');
    const failed = await shared('/observer/redeem', { challengeReceipt: challenge, accessCode: '111111' }, observer);
    assert.equal(failed.status, 409, lastError);
    assert.equal(failed.body.fault.detail, 'MemberAdmissionRejected');
    const replay = await shared('/observer/redeem', { challengeReceipt: challenge, accessCode: '000123' }, observer);
    assert.equal(replay.status, 409);
    challenge = checked(await shared('/observer/challenge', request, observer), '/observer/challenge');
    const response = checked(await shared('/observer/redeem', { challengeReceipt: challenge, accessCode: '000123' }, observer), '/observer/redeem');
    assert.equal(response.payload.receipt.payload.observerAccountId, observer.account);
    assert.equal(response.payload.receipt.payload.accessCodeRevision, 1);
    const facts = checked(await shared('/world/facts', { worldId, observerAccountId: null }, observer), '/world/facts');
    assert.equal(facts.payload.requestedObserver.payload.observerAccountId, observer.account);
});
test('independent actual ECDH/HKDF/GCM decrypt+HMAC+registered ES256 proof, bad tag consumes challenge', async () => {
    for (const publicKey of [publicJwk(root.key), publicJwk(servicePrivate), publicJwk(developerPrivate)]) {
        const result = await shared('/credential/challenge', { worldId, keyAgreementPublicKey: publicKey, keyAgreementKeyFingerprint: keyFingerprint(publicKey) });
        assert.equal(result.status, 403);
        assert.equal(result.body.fault.detail, 'CredentialMismatch');
    }
    const bad = await proveAgreement(root, true);
    assert.equal(bad.response.status, 403);
    assert.equal(bad.response.body.fault.detail, 'CredentialMismatch');
    const replay = await shared('/credential/register', { challengeReceipt: bad.challenge, proof: bad.proof }, root, bad.proof.requestNonce);
    assert.equal(replay.status, 409);
    assert.equal(replay.body.fault.detail, 'IdempotencyConflict');
    await proveAgreement(root);
    await proveAgreement(observer);
    await proveAgreement(second);
    assert.equal(root.credential.observerAdmissionRevision, null);
    assert.equal(observer.credential.observerAdmissionRevision, 1);
    assert.equal(observer.agreementFact.observerAdmission.payload.observerAccountId, observer.account);
    const rows = await pool.query('SELECT expected_tag_sha256,public_challenge FROM authority_challenges WHERE world_id=$1 AND kind=\'Credential\'', [worldId]);
    assert.ok(rows.rows.every(row => /^[0-9a-f]{64}$/.test(row.expected_tag_sha256)));
    assert.ok(rows.rows.every(row => Object.keys(row.public_challenge).sort().join('|') === 'ciphertextAndTagBase64Url|context|ephemeralKeyAgreementPublicKey|nonceBase64Url|saltBase64Url'));
});
test('root-signed Initial epoch validates actual proved credentials; nonce canonical exact retry and conflict', async () => {
    const change = epochRequest([root.credential, second.credential, observer.credential], 1, 'Initial', null), nonce = change.requestNonce;
    const input = signedRequest('/membership/publish', { change }, root, nonce);
    const response = await http('/api/v1/shared/membership/publish', input, root);
    epoch = checked(response, '/membership/publish').payload.receipt;
    assert.equal(epoch.payload.membershipEpoch, 1);
    const retry = await http('/api/v1/shared/membership/publish', input, root);
    assert.equal(retry.wire, response.wire);
    const conflict = await shared('/world/facts', { worldId, observerAccountId: null }, root, nonce);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.fault.detail, 'IdempotencyConflict');
    const read = checked(await shared('/membership/read', { worldId, membershipEpoch: 1 }, observer), '/membership/read');
    assert.deepEqual(read.payload.epochReceipt, epoch);
});
test('membership target account locks observe concurrent disable before activation without reverse auth locks', async () => {
    const updater = await pool.connect();
    await updater.query('BEGIN');
    await updater.query('UPDATE accounts SET disabled=true WHERE account_id=$1', [observer.account]);
    const change = epochRequest([root.credential, second.credential, observer.credential], 2, 'KeyCompromise', 1);
    let complete = false;
    const request = shared('/membership/publish', { change }, root, change.requestNonce).then(result => { complete = true; return result; });
    try {
        await new Promise(resolve => setTimeout(resolve, 25));
        assert.equal(complete, false);
        await updater.query('COMMIT');
        const rejected = await request;
        assert.equal(rejected.status, 403);
        assert.equal(rejected.body.fault.detail, 'CredentialMismatch');
        assert.equal(Number((await pool.query('SELECT current_epoch FROM authority_worlds WHERE world_id=$1', [worldId])).rows[0].current_epoch), 1);
    }
    finally {
        await updater.query('ROLLBACK').catch(() => undefined);
        updater.release();
        await pool.query('UPDATE accounts SET disabled=false WHERE account_id=$1', [observer.account]);
    }
});
test('global author allocator reserves 1024 and concurrent independent original receipts, segments never overlap', async () => {
    const replies = await Promise.all([shared('/sequence/allocate', { worldId, membershipEpoch: 1 }), shared('/sequence/allocate', { worldId, membershipEpoch: 1 }, second)]);
    const a = checked(replies[0], '/sequence/allocate').payload.receipt, b = checked(replies[1], '/sequence/allocate').payload.receipt;
    assert.equal(a.payload.lastSequence - a.payload.firstSequence, 1023);
    assert.equal(b.payload.lastSequence - b.payload.firstSequence, 1023);
    assert.ok(a.payload.lastSequence < b.payload.firstSequence || b.payload.lastSequence < a.payload.firstSequence);
    assert.equal(a.payload.authorAccountId, b.payload.authorAccountId);
    assert.notEqual(a.payload.authorDeviceId, b.payload.authorDeviceId);
    segment = a;
});
test('30-second server permit and signed digest-only claim admission; original facts rewrapped across nonce', async () => {
    const identity = { authorAccountId: root.account, authorSequence: segment.payload.firstSequence };
    permit = checked(await shared('/append/permit', { worldId, identity, segmentId: segment.payload.segmentId, membershipEpoch: 1, keyEpoch: 1, changeClass: 'MonotonicReveal' }), '/append/permit').payload.receipt;
    assert.equal(permit.payload.expiresAtServerEpochMs - permit.payload.appendedAt.epochMs, 30000);
    const header = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', kind: 'RelayWorldCommit', serviceInstanceId: instance, worldId, identity, authorDeviceId: root.auth.device.deviceId, authorDeviceGeneration: root.auth.device.generation, authorSigningKeyFingerprint: keyFingerprint(publicJwk(root.key)), segmentId: segment.payload.segmentId, permitId: permit.payload.permitId, membershipEpoch: 1, keyEpoch: 1, worldRelayKeyId: epoch.payload.key.worldRelayKeyId, appendedAt: permit.payload.appendedAt, changeClass: 'MonotonicReveal', commitClass: 'Monotonic', restrictedWrite: null, cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
    const nonce = randomToken(), claim = { schemaVersion: 1, serviceInstanceId: instance, requestNonce: nonce, header, envelopeSha256: sha256('independent exact encrypted envelope digest placeholder; authority never receives bytes') };
    const admissionClaim = { claim, authorSignatureBase64Url: signature(root.key, 'Neurou/commit-admission-claim/v1\0', claim) };
    acceptedPayload = { admissionClaim, appendPermitReceipt: permit, sequenceSegmentReceipt: segment };
    const first = await shared('/commit/admit', acceptedPayload, root, nonce);
    accepted = checked(first, '/commit/admit').payload.receipt;
    assert.equal(accepted.purpose, 'WorldCommitAdmission');
    const fresh = randomToken();
    const newClaim = { ...claim, requestNonce: fresh };
    const readmitted = checked(await shared('/commit/admit', { ...acceptedPayload, admissionClaim: { claim: newClaim, authorSignatureBase64Url: signature(root.key, 'Neurou/commit-admission-claim/v1\0', newClaim) } }, root, fresh), '/commit/admit');
    assert.equal(readmitted.requestNonce, fresh);
    assert.deepEqual(readmitted.payload.receipt, accepted);
    assert.notEqual(readmitted.payload.receipt.requestNonce, fresh);
    const read = checked(await shared('/commit/admission', { worldId, identity, envelopeSha256: claim.envelopeSha256 }), '/commit/admission');
    assert.deepEqual(read.payload.receipt, accepted);
    const conflictNonce = randomToken(), different = { ...claim, requestNonce: conflictNonce, envelopeSha256: sha256('different') };
    const rejected = checked(await shared('/commit/admit', { ...acceptedPayload, admissionClaim: { claim: different, authorSignatureBase64Url: signature(root.key, 'Neurou/commit-admission-claim/v1\0', different) } }, root, conflictNonce), '/commit/admit').payload.receipt;
    assert.equal(rejected.purpose, 'WorldCommitRejection');
    assert.equal(rejected.payload.reason, 'IdentityConflict');
    assert.equal(rejected.payload.previouslyAdmitted, false);
});
test('empty real old-time seal derives prefix; too recent seal and old CAS reject', async () => {
    const cutoff = Date.now() - 3960000 - 10000;
    const receipt = checked(await shared('/settlement/seal', { worldId, sealedThroughEpochMs: cutoff, expectedPreviousSealSha256: null }), '/settlement/seal').payload.receipt;
    assert.equal(receipt.payload.admittedCommitCount, 0);
    assert.equal(receipt.payload.admittedPrefixSha256, sha256('[]'));
    const again = checked(await shared('/settlement/seal', { worldId, sealedThroughEpochMs: cutoff, expectedPreviousSealSha256: null }), '/settlement/seal');
    assert.deepEqual(again.payload.receipt, receipt);
    const bad = await shared('/settlement/seal', { worldId, sealedThroughEpochMs: Date.now(), expectedPreviousSealSha256: sha256(sharedCanonical(receipt)) });
    assert.equal(bad.status, 409);
    assert.equal(bad.body.fault.detail, 'SealBoundaryConflict');
});
test('membership rekey excludes revoked credential; old admitted survives and old epoch new permit rejects', async () => {
    pendingOldEpoch = await pendingAdmission(segment, 1, epoch);
    const change = epochRequest([root.credential, second.credential], 2, 'MemberRemoved', 1);
    checked(await shared('/membership/publish', { change }, root, change.requestNonce), '/membership/publish');
    const denied = await shared('/sequence/allocate', { worldId, membershipEpoch: 2 }, observer);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.fault.detail, 'MemberNotActive');
    const old = await shared('/sequence/allocate', { worldId, membershipEpoch: 1 });
    assert.equal(old.status, 409);
    assert.equal(old.body.fault.detail, 'EpochClosed');
    const historical = checked(await shared('/commit/admission', { worldId, identity: accepted.payload.identity, envelopeSha256: accepted.payload.envelopeSha256 }), '/commit/admission');
    assert.deepEqual(historical.payload.receipt, accepted);
    const oldEpoch = checked(await shared('/membership/read', { worldId, membershipEpoch: 1 }, observer), '/membership/read');
    assert.deepEqual(oldEpoch.payload.epochReceipt, epoch);
    const deniedEpoch = await shared('/membership/read', { worldId, membershipEpoch: 2 }, observer);
    assert.equal(deniedEpoch.status, 403);
});
test('server restart keeps PG sessions, shared clock generation/floor, author counters and original receipt bytes', async () => {
    const before = checked(await shared('/status', {}), '/status');
    await app.close();
    app = await buildSharedServer(config, pool, authSigner, signer);
    await app.listen({ host: '127.0.0.1', port: config.auth.port });
    const after = checked(await shared('/status', {}), '/status');
    assert.ok(after.payload.clockGeneration > before.payload.clockGeneration);
    assert.ok(after.payload.lastSignedEpochMs >= before.payload.lastSignedEpochMs);
    const historical = checked(await shared('/commit/admission', { worldId, identity: accepted.payload.identity, envelopeSha256: accepted.payload.envelopeSha256 }), '/commit/admission');
    assert.deepEqual(historical.payload.receipt, accepted);
    const next = checked(await shared('/sequence/allocate', { worldId, membershipEpoch: 2 }), '/sequence/allocate').payload.receipt;
    assert.ok(next.payload.firstSequence > segment.payload.lastSequence);
    const current = checked(await shared('/membership/read', { worldId, membershipEpoch: 2 }), '/membership/read').payload.epochReceipt;
    pendingCurrentEpoch = await pendingAdmission(next, 0, current);
    const agreementKey = publicJwk(root.agreement);
    pendingCredential = checked(await shared('/credential/challenge', { worldId, keyAgreementPublicKey: agreementKey, keyAgreementKeyFingerprint: keyFingerprint(agreementKey) }), '/credential/challenge');
});
test('lost/tombstoned nonce result cannot reexecute; runtime no bodies/state/keys/packages in authority', async () => {
    const nonce = randomToken(), input = signedRequest('/world/facts', { worldId, observerAccountId: null }, root, nonce);
    assert.equal((await http('/api/v1/shared/world/facts', input, root)).status, 200);
    await pool.query('UPDATE authority_requests SET result_wire=NULL WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, root.account, nonce]);
    const expired = await http('/api/v1/shared/world/facts', input, root);
    assert.equal(expired.status, 409);
    assert.equal(expired.body.fault.detail, 'IdempotencyExpired');
    const columns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'authority_%'")).rows.map(x => x.column_name);
    assert.ok(!columns.some(x => ['envelope_bytes', 'world_state', 'checkpoint', 'group_key', 'private_key', 'key_package', 'access_code'].includes(x)));
});
test('real code failures persist account/world and global source-IP budgets across service restart', async () => {
    const extraA = await principal('budgetA'), extraB = await principal('budgetB');
    await login(extraA);
    await login(extraB);
    const challengeInput = { worldId, developerTrustAnchorSha256: registration.developerTrustAnchorSha256 };
    const actors = [{ p: root, count: 5 }, { p: observer, count: 3 }, { p: extraA, count: 5 }, { p: extraB, count: 5 }];
    for (const actor of actors)
        for (let i = 0; i < actor.count; i++) {
            const challenge = checked(await shared('/observer/challenge', challengeInput, actor.p), '/observer/challenge');
            const rejection = await shared('/observer/redeem', { challengeReceipt: challenge, accessCode: '999999' }, actor.p);
            assert.equal(rejection.status, 409);
            assert.equal(rejection.body.fault.detail, 'MemberAdmissionRejected');
        }
    const accountRow = (await pool.query('SELECT failure_counters FROM authority_access_codes WHERE world_id=$1', [worldId])).rows[0];
    assert.equal(accountRow.failure_counters['account:' + root.account].count, 5);
    const globalBefore = (await pool.query('SELECT ip_failure_counters FROM authority_clock_state WHERE service_instance_id=$1', [instance])).rows[0];
    assert.equal(globalBefore.ip_failure_counters[sha256('127.0.0.1')].count, 20);
    const otherWorld = randomUUID(), otherMap = randomUUID();
    const otherAnchor = { ...config.operatorWorldPins[0].developerTrustAnchor, worldId: otherWorld };
    const otherPin = { ...config.operatorWorldPins[0], worldId: otherWorld, mapId: otherMap, developerTrustAnchor: otherAnchor, developerTrustAnchorSha256: sha256(sharedCanonical(otherAnchor)), genesisSha256: sha256('independent-second-approved-genesis') };
    config = { ...config, operatorWorldPins: [...config.operatorWorldPins, otherPin] };
    await app.close();
    app = await buildSharedServer(config, pool, authSigner, signer);
    await app.listen({ host: '127.0.0.1', port: config.auth.port });
    const proposal = { schemaVersion: 1, serviceInstanceId: instance, worldId: otherWorld, mapId: otherMap, worldDeveloperAccountId: root.account, developerTrustAnchorSha256: otherPin.developerTrustAnchorSha256, genesisSha256: otherPin.genesisSha256, contentManifestSha256: otherPin.contentManifestSha256 };
    checked(await shared('/world/register', { proposal, developerSignatureBase64Url: signature(developerPrivate, 'Neurou/world-registration/v1\0', proposal) }), '/world/register');
    const codeNonce = randomToken();
    const codeProposal = { schemaVersion: 1, serviceInstanceId: instance, worldId: otherWorld, requestNonce: codeNonce, expectedCodeRevision: null, accessCode: '001234' };
    checked(await shared('/access-code/set', { proposal: codeProposal, developerSignatureBase64Url: signature(developerPrivate, 'Neurou/world-access-code-change/v1\0', codeProposal) }, root, codeNonce), '/access-code/set');
    const challenge = checked(await shared('/observer/challenge', { worldId: otherWorld, developerTrustAnchorSha256: otherPin.developerTrustAnchorSha256 }, extraA), '/observer/challenge');
    const denied = await shared('/observer/redeem', { challengeReceipt: challenge, accessCode: '001234' }, extraA);
    assert.equal(denied.status, 409);
    assert.equal(denied.body.fault.detail, 'MemberAdmissionRejected');
    const otherFailures = (await pool.query('SELECT failure_counters FROM authority_access_codes WHERE world_id=$1', [otherWorld])).rows[0];
    assert.deepEqual(otherFailures.failure_counters, {});
    const globalAfter = (await pool.query('SELECT ip_failure_counters FROM authority_clock_state WHERE service_instance_id=$1', [instance])).rows[0];
    assert.deepEqual(globalAfter.ip_failure_counters, globalBefore.ip_failure_counters);
});
test('logout invalidates PG family for shared calls without revoking registered credential', async () => {
    const deviceId = observer.auth.device.deviceId;
    assert.equal((await http('/api/v1/auth/logout', { requestNonce: randomToken() }, observer)).status, 200);
    const denied = await shared('/status', {}, observer);
    assert.equal(denied.status, 401);
    const device = (await pool.query('SELECT status FROM devices WHERE device_id=$1', [deviceId])).rows[0];
    assert.equal(device.status, 'Active');
});
test('isolated clock rollback latches durably: signed status null time and new facts forbidden, historical readable', async () => {
    await app.close();
    let wall = Date.now() + 4060000, mono = 1000;
    const clock = RealAuthorityClock.isolatedTest(instance, 'isolated-explicit-new-trust', { wall: () => wall, monotonic: () => mono });
    app = await buildIsolatedSharedServer(config, pool, authSigner, signer, clock);
    await app.listen({ host: '127.0.0.1', port: config.auth.port });
    const first = checked(await shared('/status', {}), '/status');
    assert.equal(first.payload.clockStatus, 'Trusted');
    const prior = (await pool.query('SELECT receipt FROM authority_settlement_seals WHERE world_id=$1 ORDER BY seal_revision DESC LIMIT 1', [worldId])).rows[0];
    const nonempty = checked(await shared('/settlement/seal', { worldId, sealedThroughEpochMs: wall - 3960000, expectedPreviousSealSha256: sha256(prior.receipt) }), '/settlement/seal').payload.receipt;
    assert.equal(nonempty.payload.admittedCommitCount, 1);
    assert.equal(nonempty.payload.admittedPrefixSha256, sha256(sharedCanonical([{ identity: accepted.payload.identity, envelopeSha256: accepted.payload.envelopeSha256, appendedAt: accepted.payload.appendedAt }])));
    const oldEpochRejection = checked(await shared('/commit/admit', pendingOldEpoch, root, pendingOldEpoch.admissionClaim.claim.requestNonce), '/commit/admit').payload.receipt;
    assert.equal(oldEpochRejection.payload.reason, 'EpochClosed');
    const expiredSealedRejection = checked(await shared('/commit/admit', pendingCurrentEpoch, root, pendingCurrentEpoch.admissionClaim.claim.requestNonce), '/commit/admit').payload.receipt;
    assert.equal(expiredSealedRejection.payload.reason, 'PermitExpired');
    const expiredProofNonce = randomToken(), context = pendingCredential.payload.context;
    const challenge = pendingCredential.payload;
    const z = diffieHellman({ privateKey: root.agreement, publicKey: createPublicKey({ key: challenge.ephemeralKeyAgreementPublicKey, format: 'jwk' }) });
    const wrap = Buffer.from(hkdfSync('sha256', z, Buffer.from(challenge.saltBase64Url, 'base64url'), Buffer.from('Neurou/world-member-credential-proof-key/v1\0' + sharedCanonical(context)), 32));
    const ciphertext = Buffer.from(challenge.ciphertextAndTagBase64Url, 'base64url'), decipher = createDecipheriv('aes-256-gcm', wrap, Buffer.from(challenge.nonceBase64Url, 'base64url'));
    decipher.setAuthTag(ciphertext.subarray(-16));
    decipher.setAAD(Buffer.from('Neurou/world-member-credential-proof-aad/v1\0' + sharedCanonical({ context, ephemeralKeyAgreementPublicKey: challenge.ephemeralKeyAgreementPublicKey, saltBase64Url: challenge.saltBase64Url })));
    const secret = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
    const unsignedProof = { schemaVersion: 1, serviceInstanceId: instance, worldId, challengeId: context.challengeId, requestNonce: expiredProofNonce, challengeSha256: sha256(sharedCanonical(challenge)), recipient: context.recipient, proofTagBase64Url: createHmac('sha256', secret).update('Neurou/world-member-credential-possession/v1\0' + sharedCanonical(challenge)).digest('base64url') };
    secret.fill(0);
    wrap.fill(0);
    z.fill(0);
    const proof = { ...unsignedProof, recipientSignatureBase64Url: signature(root.key, 'Neurou/world-member-credential-proof-signature/v1\0', unsignedProof) };
    const expiredProof = await shared('/credential/register', { challengeReceipt: pendingCredential, proof }, root, expiredProofNonce);
    assert.equal(expiredProof.status, 403);
    assert.equal(expiredProof.body.fault.detail, 'CredentialMismatch');
    wall -= 1;
    mono += 1;
    const untrusted = checked(await shared('/status', {}), '/status');
    assert.equal(untrusted.payload.clockStatus, 'Untrusted');
    assert.equal(untrusted.payload.serverEpochMs, null);
    const denied = await shared('/sequence/allocate', { worldId, membershipEpoch: 2 });
    assert.equal(denied.status, 503);
    assert.equal(denied.body.fault.detail, 'ClockUntrusted');
    const read = checked(await shared('/commit/admission', { worldId, identity: accepted.payload.identity, envelopeSha256: accepted.payload.envelopeSha256 }), '/commit/admission');
    assert.deepEqual(read.payload.receipt, accepted);
    const state = (await pool.query('SELECT trusted FROM authority_clock_state WHERE service_instance_id=$1', [instance])).rows[0];
    assert.equal(state.trusted, false);
});
