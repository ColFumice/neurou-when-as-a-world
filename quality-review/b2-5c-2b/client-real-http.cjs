'use strict';
// Production independent Builder + real HTTP/Fastify/PG17. No relay, group-key package or UI.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const workspace = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'evidence', 'client-real-compiled');
for (const relative of ['src/director/SharedCanonicalBytes.ts', 'src/director/SharedCommitCodec.ts',
  'src/director/SharedServiceProtocolCodec.ts', 'src/presentation/RealSharedServiceSessionAdapter.ts',
  'src/presentation/RealWorldAuthorityAdapter.ts', 'assets/scripts/SharedRelayPrototypeBuilder.ts']) {
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
function accepted(result, label) {
  assert.equal(result.kind, 'Accepted', label + ': ' + (result.fault && result.fault.detail));
  return result.value;
}
const results = [];
async function check(label, action) { await action(); results.push({ label, pass: true }); console.log('PASS ' + label); }
async function main() {
  const [{ createPool, createAccount }, { ReceiptSigner }, { SharedReceiptSigner },
    { SharedMigrationRunner }, { buildSharedServer }] = await Promise.all([
    load('db'), load('crypto'), load('SharedReceiptSigner'), load('SharedMigrationRunner'), load('buildSharedServer'),
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
  function transport() {
    const cookies = new Map();
    const observed = [];
    const send = async (url, options) => {
      const response = await fetch(url, { ...options, headers: { ...options.headers, Origin: origin,
        Cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; ') } });
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(';')[0], split = pair.indexOf('='), name = pair.slice(0, split), value = pair.slice(split + 1);
        if (value) { cookies.set(name, value); } else { cookies.delete(name); }
      }
      const pathname = new URL(url).pathname;
      observed.push({ pathname, bodySha256: sha(options.body), status: response.status });
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
    app = await buildSharedServer(config, pool, new ReceiptSigner(instance, serviceKey), new SharedReceiptSigner(instance, serviceKey));
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
          worldRelayKeyId: crypto.randomUUID(), keyCommitmentSha256: sha(crypto.randomBytes(32).toString('base64url')) },
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
    let admitted;
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
      const requestNonce = root.session.createRequestNonce(), claim = { schemaVersion: 1, serviceInstanceId: instance, requestNonce,
        header, envelopeSha256: sha('public-digest-only-authority-client-admission') };
      const signedClaim = { claim, authorSignatureBase64Url: await root.signer.signAdmissionClaim(claim) };
      admitted = accepted(await root.authority.admitCommit({ admissionClaim: signedClaim,
        appendPermitReceipt: permit, sequenceSegmentReceipt: segment }), 'admit').payload.receipt;
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
    await check('logout rejects further production authority admission and registered signing', async () => {
      accepted(await root.auth.logout(), 'logout'); assert.equal(root.session.currentContext(), null);
      assert.equal((await root.authority.readServiceStatus()).kind, 'Rejected');
      await assert.rejects(root.signer.signSharedOperation('/sequence/allocate', root.session.createRequestNonce(), { worldId, membershipEpoch: 1 }));
      accepted(await observer.auth.logout(), 'observer logout');
    });
    const report = { kind: 'ProductionClientRealHttp', realHttp: true, realPostgreSQL: true, realClock: true,
      isolatedClock: false, database: 'c2b_client_authority', pgMajor: Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num) / 10000 | 0,
      passed: results.length, failed: 0, authorityMethods: [...successfulMethods].sort(), publicPin: pin,
      nodeVersion: process.version, noRelay: true, noProductChain: true, noKeyPackageDelivery: true,
      emptyProductionSealOnly: true, ordinaryObserverViaActualAccessCode: true, cases: results };
    fs.writeFileSync(path.join(__dirname, 'evidence/client-real-http-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: results.length, authorityMethods: successfulMethods.size, realHttp: true, realPostgreSQL: true, realClock: true }));
  } finally { if (app) { await app.close(); } await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
