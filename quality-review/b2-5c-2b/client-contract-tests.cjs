'use strict';
// Contract transport oracle, not real HTTP / PostgreSQL acceptance evidence.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const workspace = path.resolve(__dirname, '../..');
const compiled = path.join(__dirname, 'evidence', 'client-compiled');
function compile(relative) {
  const source = fs.readFileSync(path.join(workspace, relative), 'utf8');
  const output = path.join(compiled, relative.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS, strict: true } }).outputText);
}
for (const relative of ['src/director/SharedCanonicalBytes.ts', 'src/director/SharedCommitCodec.ts',
  'src/director/SharedServiceProtocolCodec.ts', 'src/presentation/RealSharedServiceSessionAdapter.ts',
  'src/presentation/RealWorldAuthorityAdapter.ts']) { compile(relative); }
const { SharedServiceProtocolCodec } = require(path.join(compiled, 'src/director/SharedServiceProtocolCodec.js'));
const { RealSharedServiceSessionAdapter } = require(path.join(compiled, 'src/presentation/RealSharedServiceSessionAdapter.js'));
const { RealWorldAuthorityAdapter } = require(path.join(compiled, 'src/presentation/RealWorldAuthorityAdapter.js'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const exported = publicKey.export({ format: 'jwk' });
const jwk = { kty: 'EC', crv: 'P-256', x: exported.x, y: exported.y };
// Independent oracle: no production canonical/signature helper is used here.
function canonical(value) {
  if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
  if (Array.isArray(value)) { return '[' + value.map(canonical).join(',') + ']'; }
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('base64url');
const nonce = () => crypto.randomBytes(32).toString('base64url');
const uuid = () => crypto.randomUUID();
const environment = { mode: 'ExternalService', serviceInstanceId: 'contract-only-client-oracle',
  apiOrigin: 'http://127.0.0.1:43125', authorityTrustAnchor: { keyId: hash(jwk), publicKeyJwk: jwk, jwkSha256: hash(jwk) } };
const policy = { schemaVersion: 1, offlineGraceMs: 3600000, boundedRelayDelayMs: 300000,
  timeUncertaintyAllowanceMs: 60000, settleHorizonMs: 3960000, retentionMs: 86400000 };
const policySha256 = crypto.createHash('sha256').update(canonical(policy)).digest('hex');
const accountId = uuid(), deviceId = uuid(), sessionId = uuid();
let authorKey, authorFingerprint, tamper = null, revoked = false, holdVerify = null;
const observed = [];
function signed(purpose, payload, requestNonce, shared) {
  const value = shared ? { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId,
    purpose, receiptId: uuid(), requestNonce, keyId: environment.authorityTrustAnchor.keyId, payload }
    : { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, purpose, receiptId: uuid(),
      keyId: environment.authorityTrustAnchor.keyId, issuedAtServerEpochMs: Date.now(), payload };
  const domain = shared ? 'Neurou/shared-transport/v1\0' : 'Neurou/service/v1\0';
  value.signatureBase64Url = crypto.sign('sha256', Buffer.from(domain + canonical(value)),
    { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return value;
}
async function transport(url, options) {
  const operation = new URL(url).pathname;
  const input = JSON.parse(options.body);
  observed.push({ operation, options: { ...options, body: undefined }, input, canonicalBody: options.body });
  assert.equal(options.credentials, 'include'); assert.equal(options.redirect, 'error');
  assert.equal(options.mode, 'same-origin');
  let value;
  if (operation === '/api/v1/device/challenge') {
    authorKey = input.publicKeyJwk; authorFingerprint = hash(authorKey);
    value = signed('DeviceChallenge', { schemaVersion: 1, purpose: 'LoginDevice', challengeId: uuid(),
      nonceBase64Url: nonce(), accountName: input.accountName, keyFingerprint: authorFingerprint,
      deviceId: input.deviceId, deviceGeneration: input.deviceId ? 1 : null,
      expiresAtServerEpochMs: Date.now() + 30000, serviceInstanceId: environment.serviceInstanceId,
      requestNonce: input.requestNonce }, input.requestNonce, false);
    transport.challenge = value.payload;
  } else if (operation === '/api/v1/auth/login' || operation === '/api/v1/auth/verify' || operation === '/api/v1/auth/refresh') {
    if (operation.endsWith('/login')) {
      assert.equal(crypto.verify('sha256', Buffer.from('Neurou/device/v1\0' + canonical(transport.challenge)),
        { key: crypto.createPublicKey({ key: authorKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
        Buffer.from(input.signatureBase64Url, 'base64url')), true);
      revoked = false;
    }
    if (operation.endsWith('/verify') && holdVerify) { await holdVerify; }
    value = signed('Authentication', { requestNonce: input.requestNonce, sessionId,
      csrfToken: nonce(), account: { accountId, accountName: 'contract.client' },
      device: { deviceId, generation: 1, keyFingerprint: authorFingerprint, assurance: 'RegisteredCredential',
        label: 'contract', status: 'Active' }, expiresAtServerEpochMs: Date.now() + 900000 }, input.requestNonce, false);
  } else if (operation === '/api/v1/auth/logout') {
    revoked = true;
    value = signed('Logout', { requestNonce: input.requestNonce, sessionId, revoked: true }, input.requestNonce, false);
  } else if (operation === '/api/v1/shared/sequence/allocate') {
    const unsigned = { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId,
      operation: '/sequence/allocate', requestNonce: input.requestNonce,
      authorDeviceId: input.authorization.authorDeviceId, authorDeviceGeneration: input.authorization.authorDeviceGeneration,
      payload: input.payload };
    assert.equal(crypto.verify('sha256', Buffer.from('Neurou/shared-device-operation/v1\0' + canonical(unsigned)),
      { key: crypto.createPublicKey({ key: authorKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
      Buffer.from(input.authorization.deviceSignatureBase64Url, 'base64url')), true);
    return new Response(canonical({ kind: 'Rejected', fault: { code: 'Conflict', layer: 'Authority', detail: 'EpochClosed',
      requestId: uuid(), requestNonce: input.requestNonce, retryAfterMs: null } }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  } else if (operation === '/api/v1/shared/status') {
    assert.ok(options.headers['X-CSRF-Token']); assert.equal(input.authorization, null);
    if (tamper === 'ExpiredSession') {
      return new Response(canonical({ kind: 'Rejected', fault: { code: 'Unauthenticated', detail: 'SessionExpired', layer: 'Session',
        requestId: uuid(), requestNonce: input.requestNonce, retryAfterMs: null } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    if (tamper === 'OversizedResponse') {
      return new Response(' '.repeat(1048577), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (tamper === 'RetryNetworkOnce') { tamper = null; throw Error('Contract transport interruption'); }
    value = signed('SharedServiceStatus', { clockGeneration: 1, clockStatus: 'Trusted',
      serverEpochMs: Date.now(), lastSignedEpochMs: null, policy, policySha256 }, input.requestNonce, true);
    if (tamper === 'WrongNonce') { value = signed(value.purpose, value.payload, nonce(), true); }
    if (tamper === 'ExtraField') { value.payload.unapproved = true; }
    if (tamper === 'SignedPayloadChanged') { value.payload.clockGeneration = 2; }
    let reply = canonical({ kind: 'Accepted', value });
    if (tamper === 'DuplicateKey') { reply = reply.replace('"kind":"Accepted"', '"kind":"Accepted","kind":"Accepted"'); }
    if (tamper === 'NonCanonical') { reply = ' ' + reply; }
    return new Response(reply, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else { throw Error('Oracle does not implement ' + operation); }
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
let total = 0;
async function check(label, action) { await action(); total += 1; console.log('PASS ' + label); }
async function main() {
  const codec = SharedServiceProtocolCodec;
  await check('HTTPS test transport cannot weaken loopback boundary', () => {
    assert.throws(() => RealSharedServiceSessionAdapter.forLoopbackHttpTest({ ...environment,
      apiOrigin: 'https://example.invalid' }, transport, codec));
  });
  await check('bare LAN HTTP environment rejected', () => {
    assert.throws(() => new RealSharedServiceSessionAdapter({ ...environment, apiOrigin: 'http://192.168.1.2:43125' }, codec));
  });
  const owner = RealSharedServiceSessionAdapter.forLoopbackHttpTest(environment, transport, codec);
  const authority = new RealWorldAuthorityAdapter(owner, owner, codec);
  await check('real ES256 registration challenge independently verified by oracle', async () => {
    assert.equal((await owner.login({ accountName: 'contract.client', password: crypto.randomBytes(24).toString('base64url'), deviceLabel: 'contract' })).kind, 'Accepted');
    assert.equal(owner.currentContext().deviceId, deviceId);
  });
  await check('signed status accepted with CSRF even though read-only', async () => {
    const result=await authority.readServiceStatus(); if(result.kind==='Rejected'){console.log(result.fault);} assert.equal(result.kind, 'Accepted');
  });
  await check('fixed shared-operation signature independently verified with registered key', async () => {
    const requestNonce = nonce();
    const payload = { worldId: uuid(), membershipEpoch: 1 };
    const sig = await owner.signSharedOperation('/sequence/allocate', requestNonce, payload);
    const value = { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, operation: '/sequence/allocate',
      requestNonce, authorDeviceId: deviceId, authorDeviceGeneration: 1, payload };
    assert.equal(crypto.verify('sha256', Buffer.from('Neurou/shared-device-operation/v1\0' + canonical(value)),
      { key: crypto.createPublicKey({ key: authorKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), true);
  });
  await check('all remaining fixed author purposes independently verify; another identity refuses signing', async () => {
    const otherKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' });
    const agreementKey = { kty: 'EC', crv: 'P-256', x: otherKey.x, y: otherKey.y };
    const recipient = { accountId, observerAdmissionRevision: null, deviceId, deviceGeneration: 1,
      registeredSigningKeyFingerprint: authorFingerprint, keyAgreementPublicKey: agreementKey,
      keyAgreementKeyFingerprint: hash(agreementKey) };
    const worldId = uuid();
    const descriptor = { schemaVersion: 1, worldId, membershipEpoch: 1, keyEpoch: 1, worldRelayKeyId: uuid(),
      keyCommitmentSha256: crypto.randomBytes(32).toString('hex') };
    const header = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', kind: 'RelayWorldCommit',
      serviceInstanceId: environment.serviceInstanceId, worldId, identity: { authorAccountId: accountId, authorSequence: 1 },
      authorDeviceId: deviceId, authorDeviceGeneration: 1, authorSigningKeyFingerprint: authorFingerprint,
      segmentId: uuid(), permitId: uuid(), membershipEpoch: 1, keyEpoch: 1, worldRelayKeyId: descriptor.worldRelayKeyId,
      appendedAt: { epochMs: Date.now() }, changeClass: 'MonotonicReveal', commitClass: 'Monotonic',
      restrictedWrite: null, cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
    const claim = { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, requestNonce: nonce(), header,
      envelopeSha256: crypto.randomBytes(32).toString('hex') };
    const envelope = { header, wrappedCommitDataKey: { nonceBase64Url: crypto.randomBytes(12).toString('base64url'),
      ciphertextAndTagBase64Url: crypto.randomBytes(48).toString('base64url') },
      nonceBase64Url: crypto.randomBytes(12).toString('base64url'), ciphertextAndTagBase64Url: crypto.randomBytes(48).toString('base64url') };
    const proof = { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, worldId,
      challengeId: uuid(), requestNonce: nonce(), challengeSha256: crypto.randomBytes(32).toString('hex'), recipient,
      proofTagBase64Url: nonce() };
    const acceptance = { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, worldId,
      packageId: uuid(), packageSha256: crypto.randomBytes(32).toString('hex'), descriptor, recipient,
      acceptanceNonce: nonce(), keyPossessionTagBase64Url: nonce() };
    const ack = { worldId, relayGeneration: 1, entries: [{ position: '1', identity: header.identity,
      envelopeSha256: claim.envelopeSha256 }], authorDeviceId: deviceId, authorDeviceGeneration: 1 };
    const ackNonce = nonce();
    const cases = [
      ['Neurou/commit-admission-claim/v1\0', claim, await owner.signAdmissionClaim(claim)],
      ['Neurou/world-commit/v1\0', envelope, await owner.signEnvelope(envelope)],
      ['Neurou/world-member-credential-proof-signature/v1\0', proof, await owner.signCredentialProof(proof)],
      ['Neurou/world-relay-key-acceptance-signature/v1\0', acceptance, await owner.signKeyAcceptance(acceptance)],
      ['Neurou/relay-ack/v1\0', { serviceInstanceId: environment.serviceInstanceId, requestNonce: ackNonce, payload: ack }, await owner.signRelayAck(ackNonce, ack)],
    ];
    for (const [domain, input, signature] of cases) {
      assert.equal(crypto.verify('sha256', Buffer.from(domain + canonical(input)),
        { key: crypto.createPublicKey({ key: authorKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url')), true);
    }
    await assert.rejects(owner.signCredentialProof({ ...proof, recipient: { ...recipient, accountId: uuid() } }));
    await assert.rejects(owner.signAdmissionClaim({ ...claim, serviceInstanceId: 'unapproved-service' }));
  });
  await check('unknown operation and unapproved payload refuse signing', async () => {
    await assert.rejects(owner.signSharedOperation('/unapproved', nonce(), {}));
    await assert.rejects(owner.signSharedOperation('/sequence/allocate', nonce(), { worldId: uuid(), membershipEpoch: 1, extra: 1 }));
  });
  await check('repeat mutation nonce reuses exact authorization bytes; changed payload conflicts', async () => {
    const requestNonce = nonce(), payload = { worldId: uuid(), membershipEpoch: 1 };
    assert.equal((await authority.allocateSegment(payload, requestNonce)).kind, 'Rejected');
    assert.equal((await authority.allocateSegment(payload, requestNonce)).kind, 'Rejected');
    const calls = observed.filter(item => item.operation.endsWith('/sequence/allocate'));
    assert.equal(calls.length, 2); assert.equal(calls[0].canonicalBody, calls[1].canonicalBody);
    const result = await authority.allocateSegment({ ...payload, membershipEpoch: 2 }, requestNonce);
    assert.equal(result.kind, 'Rejected'); assert.equal(result.fault.detail, 'IdempotencyConflict');
    assert.equal(observed.filter(item => item.operation.endsWith('/sequence/allocate')).length, 2);
  });
  await check('bounded network retry preserves bytes and request nonce', async () => {
    tamper = 'RetryNetworkOnce';
    assert.equal((await authority.readServiceStatus()).kind, 'Accepted');
    const calls = observed.filter(item => item.operation.endsWith('/shared/status')).slice(-2);
    assert.equal(calls[0].canonicalBody, calls[1].canonicalBody);
  });
  await check('401 removes signing admission; refresh uses server-validated private binding', async () => {
    tamper = 'ExpiredSession';
    assert.equal((await authority.readServiceStatus()).kind, 'Rejected'); assert.equal(owner.currentContext(), null);
    await assert.rejects(owner.signSharedOperation('/sequence/allocate', nonce(), { worldId: uuid(), membershipEpoch: 1 }));
    tamper = null;
    assert.equal((await owner.refresh()).kind, 'Accepted'); assert.equal(owner.currentContext().deviceId, deviceId);
  });
  for (const attack of ['WrongNonce', 'ExtraField', 'SignedPayloadChanged', 'DuplicateKey', 'NonCanonical', 'OversizedResponse']) {
    await check('response attack ' + attack + ' rejected', async () => {
      if (!owner.currentContext()) {
        assert.equal((await owner.login({ accountName: 'contract.client', password: crypto.randomBytes(24).toString('base64url'), deviceLabel: 'contract' })).kind, 'Accepted');
      }
      tamper = attack;
      assert.equal((await authority.readServiceStatus()).kind, 'Rejected');
      tamper = null;
    });
  }
  if (!owner.currentContext()) {
    assert.equal((await owner.login({ accountName: 'contract.client', password: crypto.randomBytes(24).toString('base64url'), deviceLabel: 'contract' })).kind, 'Accepted');
  }
  await check('logout clears local session and registered signing scope', async () => {
    assert.equal((await owner.logout()).kind, 'Accepted'); assert.equal(revoked, true);
    assert.equal(owner.currentContext(), null);
    await assert.rejects(owner.signSharedOperation('/sequence/allocate', nonce(), { worldId: uuid(), membershipEpoch: 1 }));
    assert.equal((await authority.readServiceStatus()).kind, 'Rejected');
  });
  await check('logout during pending verify cannot restore local admission', async () => {
    assert.equal((await owner.login({ accountName: 'contract.client', password: crypto.randomBytes(24).toString('base64url'), deviceLabel: 'contract' })).kind, 'Accepted');
    let resume;
    holdVerify = new Promise(resolve => { resume = resolve; });
    const pending = owner.verify();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await owner.logout()).kind, 'Accepted');
    assert.equal(owner.currentContext(), null);
    resume(); holdVerify = null;
    assert.equal((await pending).kind, 'Rejected'); assert.equal(owner.currentContext(), null);
  });
  console.log(JSON.stringify({ kind: 'ContractOracle', passed: total, realHttp: false, realPostgreSQL: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
