'use strict';
// c-2c real HTTP/Fastify/PG17 + production Relay adapter; test-only native crypto and WAL host cache. No key-delivery/dual-replay/product UI.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const workspace = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'evidence', 'client-real-compiled-after-retention-fix');
for (const relative of ['src/director/SharedCanonicalBytes.ts', 'src/director/SharedCommitCodec.ts',
  'src/director/SharedServiceProtocolCodec.ts', 'src/presentation/RealSharedServiceSessionAdapter.ts',
  'src/presentation/RealWorldAuthorityAdapter.ts', 'src/presentation/RealCommitRelayAdapter.ts',
  'src/director/SharedCommitValidator.ts', 'assets/scripts/SharedRelayPrototypeBuilder.ts']) {
  let source = fs.readFileSync(path.join(workspace, relative), 'utf8');
  // Cocos virtual ./src paths resolve to repo src; this isolated Node build preserves that mapping.
  if (relative.startsWith('assets/')) { source = source.replaceAll("'./src/", "'../../src/"); }
  const target = path.join(output, relative.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS, strict: true } }).outputText);
}
const { buildSharedRelayPrototypeForLoopbackHttpTest: build } = require(path.join(output, 'assets/scripts/SharedRelayPrototypeBuilder.js'));
const load = filename => import(pathToFileURL(path.join(workspace, 'server/shared-dist/src', filename + '.js')).href);
function canonical(value) {
  if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
  if (Array.isArray(value)) { return '[' + value.map(canonical).join(',') + ']'; }
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const nonce = () => crypto.randomBytes(32).toString('base64url');
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const fingerprint = key => crypto.createHash('sha256').update(canonical(key)).digest('base64url');
function publicJwk(privateKey) {
  const key = crypto.createPublicKey(privateKey).export({ format: 'jwk' });
  return { kty: 'EC', crv: 'P-256', x: key.x, y: key.y };
}
function sign(key, domain, value) {
  return crypto.sign('sha256', Buffer.from(domain + canonical(value)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
// Inserted test-only host capabilities; no production crypto/key/cache implementation.
const digestBytes = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const { hkdf: oracleHkdf, cryptoPort: nativeCryptoPort } = require('../b2-5c-1/evidence/fixtures.cjs');
async function oracleEnvelope(header, body, groupKey, signer) {
  const dek = crypto.randomBytes(32), wrapNonce = crypto.randomBytes(12), bodyNonce = crypto.randomBytes(12);
  const wrap = oracleHkdf(groupKey, Buffer.from(sha(header.identity), 'hex'),
    Buffer.from('Neurou/relay-dek/v1\0' + canonical(header)), 32);
  function encrypt(key, iv, aad, plaintext) {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  }
  const wrappedCommitDataKey = { nonceBase64Url: wrapNonce.toString('base64url'),
    ciphertextAndTagBase64Url: encrypt(wrap, wrapNonce, 'Neurou/relay-wrap/v1\0' + canonical(header), dek).toString('base64url') };
  const unsigned = { header, wrappedCommitDataKey, nonceBase64Url: bodyNonce.toString('base64url'),
    ciphertextAndTagBase64Url: encrypt(dek, bodyNonce, 'Neurou/relay-body/v1\0' + canonical({ header, wrappedCommitDataKey }),
      Buffer.from(canonical(body))).toString('base64url') };
  const envelope = { ...unsigned, authorSignatureBase64Url: await signer.signEnvelope(unsigned) };
  dek.fill(0); wrap.fill(0);
  return Buffer.from(canonical(envelope));
}
/** Isolated test WAL: checksum + newline commits one complete record; fsync before success.
 * Windows power-loss durability is not certified here; platform backend remains c-2e.
 * Existing file is opened before cases; partial tail is ignored on restart, never ACKed.
 */
class IsolatedCipherWal {
  constructor(file) {
    this.file = file; this.candidates = new Map(); this.failPersist = false; this.failReadback = false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const fd = fs.openSync(file, 'a'); fs.fsyncSync(fd); fs.closeSync(fd);
    this.justPersisted = false;
  }
  key(identity) { return identity.authorAccountId + ':' + identity.authorSequence; }
  stage(wire) { this.candidates.set(this.key(wire.admissionReceipt.payload.identity), structuredClone(wire)); }
  durableRecords() {
    const result = new Map(), source = fs.readFileSync(this.file, 'utf8'), lines = source.split('\n');
    lines.pop();
    for (const line of lines) {
      const record = JSON.parse(line);
      assert.equal(sha(record.commit), record.commitSha256, 'durable WAL checksum');
      const key = this.key(record.commit.admissionReceipt.payload.identity);
      const prior = result.get(key);
      if (prior) assert.equal(canonical(prior), canonical(record.commit), 'same identity cannot overwrite other bytes');
      result.set(key, record.commit);
    }
    return result;
  }
  async read(identity) {
    if (this.justPersisted && this.failReadback) throw new Error('isolated-readback-failure');
    const value = this.durableRecords().get(this.key(identity)) || this.candidates.get(this.key(identity));
    return value ? structuredClone(value) : null;
  }
  async persistAndVerify(commit) {
    if (this.failPersist) throw new Error('isolated-fsync-failure');
    const line = Buffer.from(canonical({ commit, commitSha256: sha(commit) }) + '\n');
    const fd = fs.openSync(this.file, 'a');
    try { let offset = 0; while (offset < line.length) offset += fs.writeSync(fd, line, offset, line.length - offset); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    this.justPersisted = true;
    const saved = await this.read(commit.admissionReceipt.payload.identity);
    assert.equal(canonical(saved), canonical(commit));
    return { envelopeSha256: digestBytes(Buffer.from(saved.envelopeBytesBase64Url, 'base64url')) };
  }
}

function accepted(result, label) {
  assert.equal(result.kind, 'Accepted', label + ': ' + (result.fault && result.fault.detail));
  return result.value;
}
const results = [];
async function check(label, action) { await action(); results.push({ label, pass: true }); console.log('PASS ' + label); }
async function main() {
  const [{ createPool, createAccount }, { ReceiptSigner }, { SharedReceiptSigner },
    { SharedMigrationRunner }, { buildRelayServer }] = await Promise.all([
    load('db'), load('crypto'), load('SharedReceiptSigner'), load('SharedMigrationRunner'), load('buildRelayServer'),
  ]);
  const privateConnection = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence/runtime/.local/connection-client.json'), 'utf8').replace(/^\uFEFF/, ''));
  const pool = createPool(privateConnection.databaseUrl);
  let app;
  const instance = 'neurou-client-http-' + crypto.randomUUID();
  const worldId = crypto.randomUUID(), mapId = crypto.randomUUID();
  const serviceKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  const rootKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  let origin = '';
  const successfulMethods = new Set();
  const groupKey = crypto.randomBytes(32);
  const relayEvidence = [];
  function transport() {
    const cookies = new Map();
    const observed = [];
    const send = async (url, options) => {
      if (send.relayOffline && url.includes('/relay/')) throw new Error('isolated-network-down');
      const response = await fetch(url, { ...options, headers: { ...options.headers, Origin: origin,
        Cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; ') } });
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(';')[0], split = pair.indexOf('='), name = pair.slice(0, split), value = pair.slice(split + 1);
        if (value) { cookies.set(name, value); } else { cookies.delete(name); }
      }
      const pathname = new URL(url).pathname;
      observed.push({ pathname, bodySha256: sha(options.body), status: response.status });
      if (send.dropSubmitReplyOnce && url.endsWith('/relay/submit')) { send.dropSubmitReplyOnce = false; throw new Error('isolated-response-lost-after-commit'); }
      return response;
    };
    return { send, observed };
  }
  try {
    await new SharedMigrationRunner().migrate(pool, path.join(workspace, 'server'));
    const rootName = 'client.root.' + crypto.randomUUID().replaceAll('-', '');
    const observerName = 'client.observer.' + crypto.randomUUID().replaceAll('-', '');
    const rootPassword = nonce(), observerPassword = nonce();
    const rootAccount = await createAccount(pool, rootName, rootPassword);
    await createAccount(pool, observerName, observerPassword);
    const rootPublic = publicJwk(rootKey), rootFingerprint = fingerprint(rootPublic);
    const anchor = { schemaVersion: 1, worldId, worldDeveloperAccountId: rootAccount,
      developerSigningKeyId: rootFingerprint, developerPublicKey: rootPublic, developerPublicKeyFingerprint: rootFingerprint };
    // Explicit, new, operator-approved local-development world. These are public pin facts,
    // not a migrated production world or a trust anchor learned from incoming packages.
    const pin = { serviceInstanceId: instance, worldId, mapId, worldDeveloperAccountId: rootAccount,
      developerTrustAnchor: anchor, developerTrustAnchorSha256: sha(anchor),
      genesisSha256: sha('authorized-independent-c2b-client-genesis'),
      contentManifestSha256: sha('authorized-independent-c2b-client-manifest') };
    const config = { auth: { databaseUrl: privateConnection.databaseUrl, host: '127.0.0.1', port: 0,
      origin: 'http://127.0.0.1:0', serviceInstanceId: instance, signingKeyPath: 'unused-memory-signing-key',
      clockInitiallyTrusted: true, accessTtlMs: 900000, refreshTtlMs: 604800000, challengeTtlMs: 30000 },
      operatorWorldPins: [pin], accessCodePepper: crypto.randomBytes(32), operatorClockTrustRevision: 'client-http-operator-v1' };
    app = await buildRelayServer(config, pool, new ReceiptSigner(instance, serviceKey), new SharedReceiptSigner(instance, serviceKey));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address(); assert.ok(address && typeof address !== 'string');
    origin = config.auth.origin = 'http://127.0.0.1:' + address.port; config.auth.port = address.port;
    const servicePublic = publicJwk(serviceKey), serviceFingerprint = fingerprint(servicePublic);
    const environment = { mode: 'ExternalService', serviceInstanceId: instance, apiOrigin: origin,
      authorityTrustAnchor: { keyId: serviceFingerprint, publicKeyJwk: servicePublic, jwkSha256: serviceFingerprint } };
    const rootTransport = transport(), observerTransport = transport();
    const root = build(environment, rootTransport.send), observer = build(environment, observerTransport.send);
    await check('independent production Builder authenticates real registered devices through b routes', async () => {
      const rootContext = accepted(await root.auth.login({ accountName: rootName, password: rootPassword, deviceLabel: 'c2b root client' }), 'root login');
      const observerContext = accepted(await observer.auth.login({ accountName: observerName, password: observerPassword, deviceLabel: 'c2b observer client' }), 'observer login');
      assert.notEqual(rootContext.accountId, observerContext.accountId); assert.notEqual(rootContext.deviceId, observerContext.deviceId);
      assert.equal(rootContext.accountId, rootAccount);
      accepted(await root.auth.verify(), 'verify'); accepted(await root.auth.refresh(), 'refresh');
      accepted(await root.auth.readServerTime(), 'b time');
      accepted(await root.authority.readAccountFacts(), 'account facts'); successfulMethods.add('readAccountFacts');
    });
    await check('service status signature and real clock/policy trusted through production client', async () => {
      const status = accepted(await root.authority.readServiceStatus(), 'status');
      assert.equal(status.payload.clockStatus, 'Trusted'); assert.ok(status.payload.clockGeneration > 0);
      assert.equal(status.payload.policy.settleHorizonMs, 3960000); successfulMethods.add('readServiceStatus');
    });
    const proposal = { schemaVersion: 1, serviceInstanceId: instance, worldId, mapId,
      worldDeveloperAccountId: rootAccount, developerTrustAnchorSha256: pin.developerTrustAnchorSha256,
      genesisSha256: pin.genesisSha256, contentManifestSha256: pin.contentManifestSha256 };
    await check('world registration uses installed public tuple, in-memory root, and registered session signature', async () => {
      const request = { proposal, developerSignatureBase64Url: sign(rootKey, 'Neurou/world-registration/v1\0', proposal) };
      accepted(await root.authority.registerWorld(request), 'register world'); successfulMethods.add('registerWorld');
      const denied = await observer.authority.registerWorld(request); assert.equal(denied.kind, 'Rejected');
      assert.equal(denied.fault.detail, 'RootPinMismatch');
    });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeNonce = root.session.createRequestNonce();
    await check('six-digit code automatically admits real ordinary Observer; no fixture membership', async () => {
      const codeProposal = { schemaVersion: 1, serviceInstanceId: instance, worldId, requestNonce: codeNonce,
        expectedCodeRevision: null, accessCode: code };
      const setRequest = { proposal: codeProposal, developerSignatureBase64Url: sign(rootKey, 'Neurou/world-access-code-change/v1\0', codeProposal) };
      const first = accepted(await root.authority.setAccessCode(setRequest), 'set code');
      const duplicate = accepted(await root.authority.setAccessCode(setRequest), 'set code retry');
      assert.equal(canonical(first), canonical(duplicate)); successfulMethods.add('setAccessCode');
      const challenge = accepted(await observer.authority.requestObserverChallenge({ worldId,
        developerTrustAnchorSha256: pin.developerTrustAnchorSha256 }), 'observer challenge'); successfulMethods.add('requestObserverChallenge');
      const admission = accepted(await observer.authority.redeemObserverChallenge({ challengeReceipt: challenge, accessCode: code }), 'observer redeem');
      assert.equal(admission.payload.receipt.payload.observerAccountId, observer.session.currentContext().accountId);
      successfulMethods.add('redeemObserverChallenge');
    });
    async function agreement(principal) {
      const privateKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
      const key = publicJwk(privateKey);
      const receipt = accepted(await principal.authority.requestCredentialChallenge({ worldId, keyAgreementPublicKey: key,
        keyAgreementKeyFingerprint: fingerprint(key) }), 'credential challenge'); successfulMethods.add('requestCredentialChallenge');
      const challenge = receipt.payload;
      const z = crypto.diffieHellman({ privateKey, publicKey: crypto.createPublicKey({ key: challenge.ephemeralKeyAgreementPublicKey, format: 'jwk' }) });
      const wrap = Buffer.from(crypto.hkdfSync('sha256', z, Buffer.from(challenge.saltBase64Url, 'base64url'),
        Buffer.from('Neurou/world-member-credential-proof-key/v1\0' + canonical(challenge.context)), 32));
      const ciphertext = Buffer.from(challenge.ciphertextAndTagBase64Url, 'base64url');
      const decipher = crypto.createDecipheriv('aes-256-gcm', wrap, Buffer.from(challenge.nonceBase64Url, 'base64url'));
      decipher.setAuthTag(ciphertext.subarray(-16)); decipher.setAAD(Buffer.from('Neurou/world-member-credential-proof-aad/v1\0' +
        canonical({ context: challenge.context, ephemeralKeyAgreementPublicKey: challenge.ephemeralKeyAgreementPublicKey,
          saltBase64Url: challenge.saltBase64Url })));
      const secret = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]); assert.equal(secret.length, 32);
      const tag = crypto.createHmac('sha256', secret).update('Neurou/world-member-credential-possession/v1\0' + canonical(challenge)).digest('base64url');
      z.fill(0); wrap.fill(0); secret.fill(0);
      const requestNonce = principal.session.createRequestNonce();
      const unsigned = { schemaVersion: 1, serviceInstanceId: instance, worldId, challengeId: challenge.context.challengeId,
        requestNonce, challengeSha256: sha(challenge), recipient: challenge.context.recipient, proofTagBase64Url: tag };
      const proof = { ...unsigned, recipientSignatureBase64Url: await principal.signer.signCredentialProof(unsigned) };
      const fact = accepted(await principal.authority.registerAgreementCredential({ challengeReceipt: receipt, proof }), 'register ECDH').payload;
      successfulMethods.add('registerAgreementCredential');
      assert.equal(fact.credential.deviceId, principal.session.currentContext().deviceId);
      return fact;
    }
    let rootAgreement, observerAgreement;
    await check('actual ECDH/GCM/HMAC possession uses registered production author-signing capability', async () => {
      rootAgreement = await agreement(root); observerAgreement = await agreement(observer);
      assert.equal(rootAgreement.credential.observerAdmissionRevision, null);
      assert.ok(observerAgreement.credential.observerAdmissionRevision > 0);
      assert.notEqual(rootAgreement.credential.keyAgreementKeyFingerprint, rootAgreement.credential.registeredSigningKeyFingerprint);
    });
    let epoch;
    await check('real root membership CAS activates only previously proven Observer/device credentials', async () => {
      const credentials = [rootAgreement.credential, observerAgreement.credential].sort((a, b) =>
        a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : a.deviceId < b.deviceId ? -1 : 1);
      const nextUnsigned = { schemaVersion: 1, serviceInstanceId: instance, worldId, membershipEpoch: 1,
        previousMembershipEpoch: null, key: { schemaVersion: 1, worldId, membershipEpoch: 1, keyEpoch: 1,
          worldRelayKeyId: crypto.randomUUID(), keyCommitmentSha256: digestBytes(groupKey) },
        credentials, developerTrustAnchorSha256: pin.developerTrustAnchorSha256 };
      const next = { ...nextUnsigned, developerSignatureBase64Url: sign(rootKey, 'Neurou/world-membership/v1\0', nextUnsigned) };
      const change = { schemaVersion: 1, serviceInstanceId: instance, changeId: crypto.randomUUID(),
        requestNonce: root.session.createRequestNonce(), worldId, expectedMembershipEpoch: null, reason: 'Initial', next };
      epoch = accepted(await root.authority.publishMembershipEpoch({ change }), 'publish epoch').payload.receipt;
      successfulMethods.add('publishMembershipEpoch');
      const read = accepted(await observer.authority.readMembershipEpoch({ worldId, membershipEpoch: 1 }), 'membership read');
      assert.equal(canonical(read.payload.epochReceipt), canonical(epoch)); successfulMethods.add('readMembershipEpoch');
      const facts = accepted(await observer.authority.readWorldFacts({ worldId, observerAccountId: null }), 'world facts');
      assert.equal(canonical(facts.payload.currentMembership), canonical(epoch)); successfulMethods.add('readWorldFacts');
    });
    let segment, permit;
    await check('concurrent real PG author segments are disjoint; same nonce preserves original signed receipt', async () => {
      const requestNonce = root.session.createRequestNonce();
      const [first, second] = await Promise.all([root.authority.allocateSegment({ worldId, membershipEpoch: 1 }, requestNonce),
        root.authority.allocateSegment({ worldId, membershipEpoch: 1 })]);
      segment = accepted(first, 'segment 1').payload.receipt;
      const other = accepted(second, 'segment 2').payload.receipt;
      assert.equal(segment.payload.lastSequence - segment.payload.firstSequence, 1023);
      assert.ok(segment.payload.lastSequence < other.payload.firstSequence || other.payload.lastSequence < segment.payload.firstSequence);
      const original = accepted(await root.authority.allocateSegment({ worldId, membershipEpoch: 1 }, requestNonce), 'segment retry').payload.receipt;
      assert.equal(canonical(original), canonical(segment)); successfulMethods.add('allocateSegment');
    });
    let admitted, admittedWire;
    await check('permit-generated AppendedAt and registered claim produce real original admission facts', async () => {
      const identity = { authorAccountId: rootAccount, authorSequence: segment.payload.firstSequence };
      permit = accepted(await root.authority.issueAppendPermit({ worldId, identity, segmentId: segment.payload.segmentId,
        membershipEpoch: 1, keyEpoch: 1, changeClass: 'MonotonicReveal' }), 'permit').payload.receipt; successfulMethods.add('issueAppendPermit');
      const header = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', kind: 'RelayWorldCommit', serviceInstanceId: instance,
        worldId, identity, authorDeviceId: root.session.currentContext().deviceId, authorDeviceGeneration: 1,
        authorSigningKeyFingerprint: rootAgreement.credential.registeredSigningKeyFingerprint, segmentId: segment.payload.segmentId,
        permitId: permit.payload.permitId, membershipEpoch: 1, keyEpoch: 1, worldRelayKeyId: epoch.payload.key.worldRelayKeyId,
        appendedAt: permit.payload.appendedAt, changeClass: 'MonotonicReveal', commitClass: 'Monotonic', restrictedWrite: null,
        cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
      const envelopeBytes = await oracleEnvelope(header, {
        schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId, mapId,
        contentManifestSha256: pin.contentManifestSha256, identity, authorDeviceId: header.authorDeviceId,
        authorDeviceGeneration: header.authorDeviceGeneration, segmentId: header.segmentId, permitId: header.permitId,
        membershipEpoch: 1, keyEpoch: 1, appendedAt: header.appendedAt,
        change: { changeClass: 'MonotonicReveal', commitClass: 'Monotonic', entityId: crypto.randomUUID(), revealed: true },
      }, groupKey, root.signer);
      const requestNonce = root.session.createRequestNonce(), claim = { schemaVersion: 1, serviceInstanceId: instance, requestNonce,
        header, envelopeSha256: digestBytes(envelopeBytes) };
      const signedClaim = { claim, authorSignatureBase64Url: await root.signer.signAdmissionClaim(claim) };
      admitted = accepted(await root.authority.admitCommit({ admissionClaim: signedClaim,
        appendPermitReceipt: permit, sequenceSegmentReceipt: segment }), 'admit').payload.receipt;
      admittedWire = { envelopeBytesBase64Url: envelopeBytes.toString('base64url'), appendPermitReceipt: permit,
        sequenceSegmentReceipt: segment, admissionReceipt: admitted, admissionClaim: signedClaim,
        authorKeyBindingReceipt: rootAgreement.authorKeyBinding, membershipEpochReceipt: epoch,
        rosterObserverAdmissionReceipt: null };
      assert.equal(admitted.purpose, 'WorldCommitAdmission'); successfulMethods.add('admitCommit');
      const read = accepted(await observer.authority.readAdmission({ worldId, identity, envelopeSha256: claim.envelopeSha256 }), 'admission read');
      assert.equal(canonical(read.payload.receipt), canonical(admitted)); successfulMethods.add('readAdmission');
    });
    await check('production real-clock empty seal obeys S-H; prematurely including fresh admission rejected', async () => {
      const status = accepted(await root.authority.readServiceStatus(), 'seal time');
      const cutoff = status.payload.serverEpochMs - status.payload.policy.settleHorizonMs;
      const seal = accepted(await root.authority.sealPrefix({ worldId, sealedThroughEpochMs: cutoff, expectedPreviousSealSha256: null }), 'seal').payload.receipt;
      assert.equal(seal.payload.admittedCommitCount, 0); assert.equal(seal.payload.admittedPrefixSha256, sha([])); successfulMethods.add('sealPrefix');
      const premature = await root.authority.sealPrefix({ worldId, sealedThroughEpochMs: admitted.payload.appendedAt.epochMs,
        expectedPreviousSealSha256: sha(seal) });
      assert.equal(premature.kind, 'Rejected'); assert.equal(premature.fault.detail, 'SealBoundaryConflict');
    });
    await check('all 15 incremental authority methods plus unchanged account-facts port used real HTTP', async () => {
      assert.equal(successfulMethods.size, 16);
      assert.ok(rootTransport.observed.some(value => value.pathname === '/api/v1/shared/commit/admit'));
      assert.ok(observerTransport.observed.some(value => value.pathname === '/api/v1/shared/observer/redeem'));
    });
        const { RealCommitRelayAdapter } = require(path.join(output, 'src/presentation/RealCommitRelayAdapter.js'));
    const { SharedCommitValidator } = require(path.join(output, 'src/director/SharedCommitValidator.js'));
    const { SharedServiceProtocolCodec } = require(path.join(output, 'src/director/SharedServiceProtocolCodec.js'));
    const statusNow = accepted(await root.authority.readServiceStatus(), 'validator clock');
    const validationContext = { serviceInstanceId: instance, servicePublicKeyJwk: servicePublic,
      serviceKeyFingerprint: serviceFingerprint, clockGeneration: statusNow.payload.clockGeneration,
      developerTrustAnchor: anchor, genesisSha256: pin.genesisSha256, worldId, mapId,
      contentManifestSha256: pin.contentManifestSha256, isEntityDefinitionApproved: () => false,
      lookupWorldRelayKey: async descriptor => descriptor.worldRelayKeyId === epoch.payload.key.worldRelayKeyId
        && descriptor.keyCommitmentSha256 === digestBytes(groupKey) ? new Uint8Array(groupKey) : null };
    const validator = new SharedCommitValidator(nativeCryptoPort, validationContext);
    const cache = new IsolatedCipherWal(path.join(__dirname, 'evidence/runtime/.local/cipher-client-after-retention-fix.wal'));
    const relay = new RealCommitRelayAdapter(root.session, root.signer, SharedServiceProtocolCodec, validator, cache);
    const initialCursor = { relayGeneration: 1, position: '0' };
    let submitReceipt, batch;
    await check('real Relay reports admitted-not-enqueued as conservative MissingAdmittedEnvelope Gap', async () => {
      const result = accepted(await relay.pull(worldId, initialCursor, 128, 0), 'missing payload pull').payload;
      assert.equal(result.kind, 'Gap'); assert.equal(result.reason, 'MissingAdmittedEnvelope');
      relayEvidence.push({ case: 'MissingAdmittedEnvelope', worldId, identity: admittedWire.admissionReceipt.payload.identity });
    });
    await check('Relay transport outage rejects without fixture fallback and authority remains healthy', async () => {
      rootTransport.send.relayOffline = true;
      const result = await relay.submit(admittedWire); rootTransport.send.relayOffline = false;
      assert.equal(result.kind, 'Rejected'); assert.equal(result.fault.layer, 'Relay');
      accepted(await root.authority.readServiceStatus(), 'independent authority healthy');
    });
    await check('lost submit response retransmits exact nonce; real PG keeps one raw envelope and position', async () => {
      rootTransport.send.dropSubmitReplyOnce = true;
      submitReceipt = accepted(await relay.submit(admittedWire), 'submit with reply loss');
      assert.equal(submitReceipt.payload.cursor.position, '1');
      const rows = await pool.query('SELECT envelope_bytes,envelope_sha256,position::text,receipt FROM relay_commit_queue WHERE world_id=$1', [worldId]);
      assert.equal(rows.rowCount, 1); assert.equal(rows.rows[0].position, '1');
      assert.deepEqual(rows.rows[0].envelope_bytes, Buffer.from(admittedWire.envelopeBytesBase64Url, 'base64url'));
      assert.equal(rows.rows[0].envelope_sha256, admittedWire.admissionReceipt.payload.envelopeSha256);
      assert.equal(rows.rows[0].receipt.toString('utf8'), canonical(submitReceipt));
      relayEvidence.push({ case: 'ExactPGBytesAndOriginalPosition', envelopeSha256: rows.rows[0].envelope_sha256, position: '1' });
    });
    await check('submit and relay aliases concurrently return original receipt/position', async () => {
      const [a, b] = await Promise.all([relay.submit(admittedWire), relay.relay(admittedWire)]);
      assert.equal(canonical(accepted(a, 'duplicate submit').payload), canonical(submitReceipt.payload));
      assert.equal(canonical(accepted(b, 'duplicate relay').payload), canonical(submitReceipt.payload));
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM relay_commit_queue WHERE world_id=$1', [worldId])).rows[0].n, 1);
    });
    await check('signed real pull provides exact proof/bytes for full c-1 validator', async () => {
      batch = accepted(await relay.pull(worldId, initialCursor, 128, 0), 'pull').payload;
      assert.equal(batch.kind, 'Batch'); assert.equal(batch.commits.length, 1);
      assert.equal(canonical(batch.commits[0]), canonical(admittedWire));
      const verified = await validator.validateCommit(batch.commits[0]); assert.equal(verified.kind, 'Verified', verified.reason);
      assert.equal(validator.ownsCommit(verified.value), true); assert.equal(verified.value.invalid, false);
      cache.stage(batch.commits[0]);
    });
    const ack = { worldId, relayGeneration: submitReceipt.payload.cursor.relayGeneration,
      entries: [{ position: '1', identity: admittedWire.admissionReceipt.payload.identity,
        envelopeSha256: admittedWire.admissionReceipt.payload.envelopeSha256 }],
      authorDeviceId: root.session.currentContext().deviceId, authorDeviceGeneration: root.session.currentContext().deviceGeneration,
      deviceSignatureBase64Url: Buffer.alloc(64).toString('base64url') };
    await check('missing group key yields no ACK HTTP or PG row', async () => {
      const noKey = new SharedCommitValidator(nativeCryptoPort, { ...validationContext, lookupWorldRelayKey: async () => null });
      const adapter = new RealCommitRelayAdapter(root.session, root.signer, SharedServiceProtocolCodec, noKey, cache);
      const before = rootTransport.observed.filter(x => x.pathname.endsWith('/relay/ack')).length;
      assert.equal((await adapter.acknowledge(ack)).kind, 'Rejected');
      assert.equal(rootTransport.observed.filter(x => x.pathname.endsWith('/relay/ack')).length, before);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM relay_acknowledgements WHERE world_id=$1', [worldId])).rows[0].n, 0);
    });
    await check('Host persistence failure yields no signed ACK or PG row', async () => {
      cache.failPersist = true; assert.equal((await relay.acknowledge(ack)).kind, 'Rejected'); cache.failPersist = false;
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM relay_acknowledgements WHERE world_id=$1', [worldId])).rows[0].n, 0);
    });
    await check('full validator then fsynced WAL exact readback precedes real device-signed ACK transaction', async () => {
      const receipt = accepted(await relay.acknowledge(ack), 'durable ACK');
      assert.equal(receipt.payload.acknowledgedCount, 1);
      const rows = await pool.query('SELECT receipt,confirmation_sha256 FROM relay_acknowledgements WHERE world_id=$1', [worldId]);
      assert.equal(rows.rowCount, 1); assert.equal(rows.rows[0].receipt.toString('utf8'), canonical(receipt));
      const reopened = new IsolatedCipherWal(cache.file);
      assert.equal(canonical(await reopened.read(ack.entries[0].identity)), canonical(admittedWire));
      relayEvidence.push({ case: 'ACKAfterExactDurableReadback', confirmationSha256: rows.rows[0].confirmation_sha256,
        entriesSha256: receipt.payload.entriesSha256, acknowledgedCount: 1 });
    });
    await check('ACK does not delete live ciphertext before admittedAt+retention', async () => {
      const row = (await pool.query('SELECT envelope_bytes,tombstone,admitted_at,retained_until FROM relay_commit_queue WHERE world_id=$1', [worldId])).rows[0];
      assert.equal(row.tombstone, false); assert.ok(row.envelope_bytes);
      assert.equal(Number(row.retained_until) - Number(row.admitted_at), 86400000);
    });
    await check('legal 13-second real HTTP pull exceeds prior 12-second cap without timeout', async () => {
      const started = performance.now(), result = accepted(await relay.pull(worldId, batch.next, 128, 13000), 'long poll').payload;
      const elapsedMs = performance.now() - started;
      assert.equal(result.kind, 'Batch'); assert.equal(result.commits.length, 0); assert.ok(elapsedMs >= 12500, String(elapsedMs));
      relayEvidence.push({ case: 'P10RealLongPoll', maximumWaitMs: 13000, deadlineMs: 20000, elapsedMs });
    });
    await check('production server restart preserves generation, queue bytes and original receipt', async () => {
      const port = config.auth.port; await app.close();
      app = await buildRelayServer(config, pool, new ReceiptSigner(instance, serviceKey), new SharedReceiptSigner(instance, serviceKey));
      await app.listen({ host: '127.0.0.1', port });
      const result = accepted(await relay.relay(admittedWire), 'retry after restart');
      assert.equal(canonical(result.payload), canonical(submitReceipt.payload));
      const row = (await pool.query('SELECT generation::text,retention_floor::text FROM relay_streams WHERE world_id=$1', [worldId])).rows[0];
      assert.equal(row.generation, String(submitReceipt.payload.cursor.relayGeneration));
      relayEvidence.push({ case: 'RestartKeepsOriginalReceipt', generation: row.generation, position: '1' });
    });

    await check('logout rejects further production authority admission and registered signing', async () => {
      accepted(await root.auth.logout(), 'logout'); assert.equal(root.session.currentContext(), null);
      assert.equal((await root.authority.readServiceStatus()).kind, 'Rejected');
      await assert.rejects(root.signer.signSharedOperation('/sequence/allocate', root.session.createRequestNonce(), { worldId, membershipEpoch: 1 }));
      accepted(await observer.auth.logout(), 'observer logout');
    });
    const report = { kind: 'ProductionRelayClientRealHttpWithIsolatedCryptoCache', realHttp: true, realPostgreSQL: true, realClock: true,
      isolatedClock: false, database: 'c2c_client_relay', pgMajor: Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num) / 10000 | 0,
      passed: results.length, failed: 0, authorityMethods: [...successfulMethods].sort(), publicPin: pin,
      nodeVersion: process.version, noRelay: false, relayEvidence, isolatedNativeCryptoOracle: true, isolatedWalHostCache: true, noProductionKeyDelivery: true, noDualClientReplay: true, noProductChain: true, noKeyPackageDelivery: true,
      emptyProductionSealOnly: true, ordinaryObserverViaActualAccessCode: true, cases: results };
    fs.writeFileSync(path.join(__dirname, 'evidence/client-real-http-after-retention-fix-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: results.length, authorityMethods: successfulMethods.size, realHttp: true, realPostgreSQL: true, realClock: true }));
  } finally { if (app) { await app.close(); } await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
