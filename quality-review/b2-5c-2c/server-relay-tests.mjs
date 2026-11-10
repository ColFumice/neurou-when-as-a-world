import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDecipheriv, createPublicKey, createHmac, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, randomUUID, sign, verify } from 'node:crypto';
import { request as rawHttpRequest } from 'node:http';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const serverDirectory = resolve(rootDirectory, 'server');
const require = createRequire(resolve(serverDirectory, 'package.json'));
const { Pool } = require('pg');
const moduleAt = async name => import(pathToFileURL(resolve(serverDirectory, 'shared-dist/src', name + '.js')).href);
const { createAccount } = await moduleAt('db');
const { ReceiptSigner, publicJwk, keyFingerprint, randomToken, sha256, deviceProofBytes } = await moduleAt('crypto');
const { SharedReceiptSigner, sharedCanonical, sharedUnsigned } = await moduleAt('SharedReceiptSigner');
const { SharedMigrationRunner } = await moduleAt('SharedMigrationRunner');
const { buildRelayServer, buildIsolatedRelayServer } = await moduleAt('buildRelayServer');
const { RealAuthorityClock } = await moduleAt('RealAuthorityClock');
const { SharedServiceProtocolCodec } = require(resolve(serverDirectory, 'shared-dist/.shared-kernel/SharedServiceProtocolCodec.js'));
const source = JSON.parse((await readFile(process.argv[2], 'utf8')).replace(/^\uFEFF/, ''));
const resultsPath = resolve(process.argv[3] || 'server-relay-results.json');
const pool = new Pool({ connectionString: source.databaseUrl, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
pool.on('error', () => undefined);
const instance = 'neurou-relay-' + randomUUID();
const worldId = randomUUID(), mapId = randomUUID();
const serviceKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const developerKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const signer = new SharedReceiptSigner(instance, serviceKey), authSigner = new ReceiptSigner(instance, serviceKey);
const principal = { name: 'relay_' + randomUUID().replaceAll('-', ''), password: randomToken(), key: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey, agreement: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey, cookies: new Map(), csrf: '', auth: null, credential: null, binding: null };
let app, config, origin, epochReceipt, segmentReceipt;
let sequenceOffset = 0;
let mainCommit, mainSubmitRequest, mainSubmitResponse;
let originalPullRequest, originalPullResponse;
let allCommits = [];
const results = [];
const readOnly = new Set(['/status', '/world/facts', '/credential/challenge', '/observer/challenge', '/membership/read', '/commit/admission', '/relay/pull']);
const signature = (key, domain, value) => sign('sha256', Buffer.from(domain + sharedCanonical(value)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');

async function http(path, body, headers = {}) {
  const response = await fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...principal.cookies].map(([key, value]) => key + '=' + value).join('; '), 'X-CSRF-Token': principal.csrf, ...headers }, body: typeof body === 'string' ? body : sharedCanonical(body) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0], i = pair.indexOf('='), name = pair.slice(0, i), value = pair.slice(i + 1);
    if (value) { principal.cookies.set(name, value); } else { principal.cookies.delete(name); }
  }
  const wire = await response.text();
  return { status: response.status, body: JSON.parse(wire), wire };
}
function request(operation, payload, nonce = randomToken()) {
  const authorization = readOnly.has(operation) ? null : { authorDeviceId: principal.auth.device.deviceId, authorDeviceGeneration: principal.auth.device.generation, deviceSignatureBase64Url: signature(principal.key, 'Neurou/shared-device-operation/v1\0', { schemaVersion: 1, serviceInstanceId: instance, operation, requestNonce: nonce, authorDeviceId: principal.auth.device.deviceId, authorDeviceGeneration: principal.auth.device.generation, payload }) };
  return { schemaVersion: 1, requestNonce: nonce, payload, authorization };
}
async function shared(operation, payload, nonce = randomToken()) { return http('/api/v1/shared' + operation, request(operation, payload, nonce)); }
function checked(response, operation, nonce) {
  assert.equal(response.status, 200, response.body.fault?.detail);
  assert.equal(response.body.kind, 'Accepted');
  const receipt = response.body.value;
  SharedServiceProtocolCodec.parseReply(operation, response.wire, nonce || receipt.requestNonce);
  assert.equal(receipt.serviceInstanceId, instance);
  assert.ok(verify('sha256', Buffer.from('Neurou/shared-transport/v1\0' + sharedCanonical(sharedUnsigned(receipt, 'signatureBase64Url'))), { key: createPublicKey(serviceKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(receipt.signatureBase64Url, 'base64url')));
  return receipt;
}
async function setup() {
  await new SharedMigrationRunner().migrate(pool, serverDirectory);
  principal.account = await createAccount(pool, principal.name, principal.password);
  const rootPublic = publicJwk(developerKey), fingerprint = keyFingerprint(rootPublic);
  const anchor = { schemaVersion: 1, worldId, worldDeveloperAccountId: principal.account, developerSigningKeyId: fingerprint, developerPublicKeyFingerprint: fingerprint, developerPublicKey: rootPublic };
  const pin = { serviceInstanceId: instance, worldId, mapId, worldDeveloperAccountId: principal.account, developerTrustAnchor: anchor, developerTrustAnchorSha256: sha256(sharedCanonical(anchor)), genesisSha256: sha256('isolated-approved-relay-genesis'), contentManifestSha256: sha256('isolated-approved-relay-manifest') };
  const temporary = await import('node:net');
  const listener = temporary.createServer();
  await new Promise(resolveListening => listener.listen(0, '127.0.0.1', resolveListening));
  const port = listener.address().port;
  await new Promise(resolveClosed => listener.close(resolveClosed));
  origin = 'http://127.0.0.1:' + port;
  config = { auth: { databaseUrl: source.databaseUrl, host: '127.0.0.1', port, origin, serviceInstanceId: instance, signingKeyPath: '', clockInitiallyTrusted: true, accessTtlMs: 900000, refreshTtlMs: 604800000, challengeTtlMs: 30000 }, operatorWorldPins: [pin], accessCodePepper: randomBytes(32), operatorClockTrustRevision: 'relay-isolated-operator-approval' };
  app = await buildRelayServer(config, pool, authSigner, signer);
  await app.listen({ host: '127.0.0.1', port });
  const challenge = await http('/api/v1/device/challenge', { purpose: 'LoginDevice', accountName: principal.name, publicKeyJwk: publicJwk(principal.key), deviceId: null, requestNonce: randomToken() });
  assert.equal(challenge.status, 200);
  const login = await http('/api/v1/auth/login', { accountName: principal.name, password: principal.password, challengeId: challenge.body.payload.challengeId, signatureBase64Url: sign('sha256', deviceProofBytes(challenge.body.payload), { key: principal.key, dsaEncoding: 'ieee-p1363' }).toString('base64url'), deviceLabel: 'isolated registered relay credential', requestNonce: randomToken() });
  assert.equal(login.status, 200);
  principal.auth = login.body.payload;
  principal.csrf = principal.auth.csrfToken;
  const proposal = { schemaVersion: 1, serviceInstanceId: instance, worldId, mapId, worldDeveloperAccountId: principal.account, developerTrustAnchorSha256: pin.developerTrustAnchorSha256, genesisSha256: pin.genesisSha256, contentManifestSha256: pin.contentManifestSha256 };
  checked(await shared('/world/register', { proposal, developerSignatureBase64Url: signature(developerKey, 'Neurou/world-registration/v1\0', proposal) }), '/world/register');
  const agreementPublic = publicJwk(principal.agreement);
  const credentialChallenge = checked(await shared('/credential/challenge', { worldId, keyAgreementPublicKey: agreementPublic, keyAgreementKeyFingerprint: keyFingerprint(agreementPublic) }), '/credential/challenge');
  const context = credentialChallenge.payload.context, c = credentialChallenge.payload;
  const z = diffieHellman({ privateKey: principal.agreement, publicKey: createPublicKey({ key: c.ephemeralKeyAgreementPublicKey, format: 'jwk' }) });
  const wrap = Buffer.from(hkdfSync('sha256', z, Buffer.from(c.saltBase64Url, 'base64url'), Buffer.from('Neurou/world-member-credential-proof-key/v1\0' + sharedCanonical(context)), 32));
  const ciphertext = Buffer.from(c.ciphertextAndTagBase64Url, 'base64url'), decipher = createDecipheriv('aes-256-gcm', wrap, Buffer.from(c.nonceBase64Url, 'base64url'));
  decipher.setAuthTag(ciphertext.subarray(-16));
  decipher.setAAD(Buffer.from('Neurou/world-member-credential-proof-aad/v1\0' + sharedCanonical({ context, ephemeralKeyAgreementPublicKey: c.ephemeralKeyAgreementPublicKey, saltBase64Url: c.saltBase64Url })));
  const secret = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
  const proofNonce = randomToken(), proofUnsigned = { schemaVersion: 1, serviceInstanceId: instance, worldId, challengeId: context.challengeId, requestNonce: proofNonce, challengeSha256: sha256(sharedCanonical(c)), recipient: context.recipient, proofTagBase64Url: createHmac('sha256', secret).update('Neurou/world-member-credential-possession/v1\0' + sharedCanonical(c)).digest('base64url') };
  const credentialFact = checked(await shared('/credential/register', { challengeReceipt: credentialChallenge, proof: { ...proofUnsigned, recipientSignatureBase64Url: signature(principal.key, 'Neurou/world-member-credential-proof-signature/v1\0', proofUnsigned) } }, proofNonce), '/credential/register').payload;
  z.fill(0); wrap.fill(0); secret.fill(0);
  principal.credential = credentialFact.credential;
  principal.binding = credentialFact.authorKeyBinding;
  const next = { schemaVersion: 1, serviceInstanceId: instance, worldId, membershipEpoch: 1, previousMembershipEpoch: null, key: { schemaVersion: 1, worldId, membershipEpoch: 1, keyEpoch: 1, worldRelayKeyId: randomUUID(), keyCommitmentSha256: sha256(randomBytes(32)) }, credentials: [principal.credential], developerTrustAnchorSha256: pin.developerTrustAnchorSha256 };
  next.developerSignatureBase64Url = signature(developerKey, 'Neurou/world-membership/v1\0', next);
  const epochNonce = randomToken();
  const change = { schemaVersion: 1, serviceInstanceId: instance, changeId: randomUUID(), requestNonce: epochNonce, worldId, expectedMembershipEpoch: null, reason: 'Initial', next };
  epochReceipt = checked(await shared('/membership/publish', { change }, epochNonce), '/membership/publish').payload.receipt;
  segmentReceipt = checked(await shared('/sequence/allocate', { worldId, membershipEpoch: 1 }), '/sequence/allocate').payload.receipt;
}
async function admittedCommit(cipherLength = 64) {
  const identity = { authorAccountId: principal.account, authorSequence: segmentReceipt.payload.firstSequence + sequenceOffset++ };
  const permit = checked(await shared('/append/permit', { worldId, identity, segmentId: segmentReceipt.payload.segmentId, membershipEpoch: 1, keyEpoch: 1, changeClass: 'MonotonicReveal' }), '/append/permit').payload.receipt;
  const header = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', kind: 'RelayWorldCommit', serviceInstanceId: instance, worldId, identity, authorDeviceId: principal.auth.device.deviceId, authorDeviceGeneration: principal.auth.device.generation, authorSigningKeyFingerprint: keyFingerprint(publicJwk(principal.key)), segmentId: segmentReceipt.payload.segmentId, permitId: permit.payload.permitId, membershipEpoch: 1, keyEpoch: 1, worldRelayKeyId: epochReceipt.payload.key.worldRelayKeyId, appendedAt: permit.payload.appendedAt, changeClass: 'MonotonicReveal', commitClass: 'Monotonic', restrictedWrite: null, cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
  const unsignedEnvelope = { header, wrappedCommitDataKey: { nonceBase64Url: randomBytes(12).toString('base64url'), ciphertextAndTagBase64Url: randomBytes(48).toString('base64url') }, nonceBase64Url: randomBytes(12).toString('base64url'), ciphertextAndTagBase64Url: randomBytes(cipherLength).toString('base64url') };
  const envelope = { ...unsignedEnvelope, authorSignatureBase64Url: signature(principal.key, 'Neurou/world-commit/v1\0', unsignedEnvelope) };
  const bytes = Buffer.from(sharedCanonical(envelope));
  const nonce = randomToken();
  const claim = { schemaVersion: 1, serviceInstanceId: instance, requestNonce: nonce, header, envelopeSha256: sha256(bytes) };
  const admissionClaim = { claim, authorSignatureBase64Url: signature(principal.key, 'Neurou/commit-admission-claim/v1\0', claim) };
  const admission = checked(await shared('/commit/admit', { admissionClaim, appendPermitReceipt: permit, sequenceSegmentReceipt: segmentReceipt }, nonce), '/commit/admit').payload.receipt;
  return { envelopeBytesBase64Url: bytes.toString('base64url'), appendPermitReceipt: permit, sequenceSegmentReceipt: segmentReceipt, admissionReceipt: admission, admissionClaim, authorKeyBindingReceipt: principal.binding, membershipEpochReceipt: epochReceipt, rosterObserverAdmissionReceipt: null };
}
function ackPayload(entries, nonce) {
  const unsigned = { worldId, relayGeneration: 1, entries, authorDeviceId: principal.auth.device.deviceId, authorDeviceGeneration: principal.auth.device.generation };
  return { ...unsigned, deviceSignatureBase64Url: signature(principal.key, 'Neurou/relay-ack/v1\0', { serviceInstanceId: instance, requestNonce: nonce, payload: unsigned }) };
}
async function run(name, action, clock = 'production-real-wall') {
  const start = Date.now();
  try { await action(); results.push({ name, pass: true, clock, elapsedMs: Date.now() - start }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, pass: false, clock, error: String(error.stack || error) }); console.log('FAIL ' + name + ': ' + String(error.message)); throw error; }
}

try {
  await setup();
  if (process.argv[4] === '--concurrency-only') {
    await run('first enqueue concurrent distinct nonces reserves one durable position and immutable receipt', async () => {
      const commit = await admittedCommit(), first = request('/relay/submit', { commit }), second = request('/relay/submit', { commit });
      const responses = await Promise.all([http('/api/v1/shared/relay/submit', first), http('/api/v1/shared/relay/submit', second)]);
      const a = checked(responses[0], '/relay/submit'), b = checked(responses[1], '/relay/submit');
      assert.deepEqual(a.payload, b.payload); assert.equal(a.payload.cursor.position, '1');
      const rows = (await pool.query('SELECT * FROM relay_commit_queue WHERE world_id=$1', [worldId])).rows; assert.equal(rows.length, 1); assert.equal(rows[0].envelope_bytes.toString('base64url'), commit.envelopeBytesBase64Url);
      assert.ok([sharedCanonical(a), sharedCanonical(b)].includes(rows[0].receipt.toString('utf8')));
      assert.equal((await pool.query('SELECT next_position::text AS position FROM relay_streams WHERE world_id=$1', [worldId])).rows[0].position, '2');
      assert.equal((await pool.query('SELECT count(*)::text AS n FROM authority_requests WHERE service_instance_id=$1 AND operation=$2', [instance, '/relay/submit'])).rows[0].n, '2');
    });
    await run('first enqueue concurrent identical nonce commits once and both recover the same original wire', async () => {
      const commit = await admittedCommit(), input = request('/relay/submit', { commit });
      const [first, second] = await Promise.all([http('/api/v1/shared/relay/submit', input), http('/api/v1/shared/relay/submit', input)]);
      checked(first, '/relay/submit'); checked(second, '/relay/submit'); assert.equal(first.wire, second.wire); assert.equal(first.body.value.payload.cursor.position, '2');
      assert.equal((await pool.query('SELECT count(*)::text AS n FROM relay_commit_queue WHERE world_id=$1', [worldId])).rows[0].n, '2');
      assert.equal((await pool.query('SELECT next_position::text AS position FROM relay_streams WHERE world_id=$1', [worldId])).rows[0].position, '3');
      const nonceRow = (await pool.query('SELECT result_wire FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, input.requestNonce])).rows; assert.equal(nonceRow.length, 1); assert.equal(nonceRow[0].result_wire.toString('utf8'), first.wire);
    });
  } else if (process.argv[4] === '--old-generation-retention-only') {
    let oldRow;
    await run('old generation surviving ciphertext stays intact before its admitted retention boundary', async () => {
      const first = await admittedCommit(), survivor = await admittedCommit();
      checked(await shared('/relay/submit', { commit: first }), '/relay/submit'); checked(await shared('/relay/submit', { commit: survivor }), '/relay/submit');
      originalPullRequest = request('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 0 });
      originalPullResponse = await http('/api/v1/shared/relay/pull', originalPullRequest); checked(originalPullResponse, '/relay/pull');
      oldRow = (await pool.query('SELECT * FROM relay_commit_queue WHERE world_id=$1 AND generation=1 AND position=2', [worldId])).rows[0];
      await pool.query('DELETE FROM relay_delivery_recipients WHERE world_id=$1 AND generation=1 AND position=1', [worldId]);
      await pool.query('DELETE FROM relay_commit_queue WHERE world_id=$1 AND generation=1 AND position=1', [worldId]);
      const changed = checked(await http('/api/v1/shared/relay/pull', originalPullRequest), '/relay/pull').payload; assert.equal(changed.reason, 'RelayGenerationChanged'); assert.equal(changed.retentionFloor.relayGeneration, 2);
      const present = (await pool.query('SELECT * FROM relay_commit_queue WHERE world_id=$1 AND generation=1 AND position=2', [worldId])).rows[0]; assert.equal(present.tombstone, false); assert.equal(present.envelope_bytes.toString('base64url'), survivor.envelopeBytesBase64Url); assert.equal(sharedCanonical(present.public_proof), sharedCanonical(oldRow.public_proof)); assert.equal(present.receipt.toString('hex'), oldRow.receipt.toString('hex'));
      const stream = (await pool.query('SELECT generation::text,retention_floor::text FROM relay_streams WHERE world_id=$1', [worldId])).rows[0]; assert.equal(stream.generation, '2'); assert.equal(stream.retention_floor, '0');
    });
    await run('new generation request lazily clears all expired old generation payloads without corrupting current floor or facts', async () => {
      await app.close(); const wall = Number(oldRow.retained_until) + 1, clock = RealAuthorityClock.isolatedTest(instance, 'isolated-old-generation-retention', { wall: () => wall, monotonic: () => 1 });
      app = await buildIsolatedRelayServer(config, pool, authSigner, signer, clock); await app.listen({ host: '127.0.0.1', port: config.auth.port });
      const current = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 2, position: '0' }, maximumCount: 128, maximumWaitMs: 0 }), '/relay/pull').payload; assert.equal(current.reason, 'MissingAdmittedEnvelope'); assert.equal(current.retentionFloor.relayGeneration, 2); assert.equal(current.retentionFloor.position, '0');
      const expired = (await pool.query('SELECT * FROM relay_commit_queue WHERE world_id=$1 AND generation=1 AND position=2', [worldId])).rows[0]; assert.equal(expired.tombstone, true); assert.equal(expired.envelope_bytes, null); assert.equal(expired.public_proof, null);
      for (const field of ['account_id', 'author_sequence', 'envelope_sha256', 'admitted_at', 'retained_until', 'generation', 'position']) { assert.equal(String(expired[field]), String(oldRow[field]), field); }
      assert.equal(expired.receipt.toString('hex'), oldRow.receipt.toString('hex'));
      const stream = (await pool.query('SELECT generation::text,retention_floor::text,next_position::text FROM relay_streams WHERE world_id=$1', [worldId])).rows[0]; assert.deepEqual(stream, { generation: '2', retention_floor: '0', next_position: '1' });
      const original = checked(await http('/api/v1/shared/relay/pull', originalPullRequest), '/relay/pull').payload; assert.equal(original.reason, 'RelayGenerationChanged'); assert.ok(!sharedCanonical(original).includes('envelopeBytesBase64Url'));
    }, 'isolated-injected-clock-and-explicit-test-storage-loss');
  } else {
  await run('actual loopback registered session, shared authority and relay strict Host/Origin/CSRF', async () => {
    const payload = { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 0 };
    assert.equal((await http('/api/v1/shared/relay/pull', request('/relay/pull', payload), { Origin: 'http://unapproved.invalid' })).status, 403);
    const csrf = await http('/api/v1/shared/relay/pull', request('/relay/pull', payload), { 'X-CSRF-Token': randomToken() });
    assert.equal(csrf.status, 403); assert.equal(csrf.body.fault.detail, 'CsrfRejected');
    const empty = checked(await shared('/relay/pull', payload), '/relay/pull').payload;
    assert.equal(empty.kind, 'Batch'); assert.equal(empty.commits.length, 0); assert.equal(empty.next.position, '0');
    checked(await shared('/status', {}), '/status');
  });
  await run('admitted without enqueue is signed conservative MissingAdmittedEnvelope Gap', async () => {
    mainCommit = await admittedCommit(18000);
    const gap = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 0 }), '/relay/pull').payload;
    assert.equal(gap.kind, 'Gap'); assert.equal(gap.reason, 'MissingAdmittedEnvelope');
  });
  await run('submit above old auth 16KiB stores exact envelope/proof/position/original receipt atomically', async () => {
    mainSubmitRequest = request('/relay/submit', { commit: mainCommit });
    assert.ok(Buffer.byteLength(sharedCanonical(mainSubmitRequest)) > 16384);
    mainSubmitResponse = await http('/api/v1/shared/relay/submit', mainSubmitRequest);
    const receipt = checked(mainSubmitResponse, '/relay/submit', mainSubmitRequest.requestNonce);
    assert.equal(receipt.payload.cursor.position, '1');
    const row = (await pool.query('SELECT * FROM relay_commit_queue WHERE world_id=$1', [worldId])).rows[0];
    assert.equal(row.envelope_bytes.toString('base64url'), mainCommit.envelopeBytesBase64Url);
    assert.equal(row.envelope_sha256, sha256(row.envelope_bytes));
    assert.equal(row.receipt.toString('utf8'), sharedCanonical(receipt));
    const { envelopeBytesBase64Url, ...proof } = mainCommit; assert.equal(sharedCanonical(row.public_proof), sharedCanonical(proof));
    assert.equal(String(row.retained_until - row.admitted_at), '86400000');
    allCommits.push(mainCommit);
  });
  await run('concurrent same nonce returns original HTTP bytes; fresh nonce same digest retains position', async () => {
    const pair = await Promise.all([http('/api/v1/shared/relay/submit', mainSubmitRequest), http('/api/v1/shared/relay/submit', mainSubmitRequest)]);
    assert.equal(pair[0].wire, mainSubmitResponse.wire); assert.equal(pair[1].wire, mainSubmitResponse.wire);
    const fresh = checked(await shared('/relay/submit', { commit: mainCommit }), '/relay/submit');
    assert.deepEqual(fresh.payload, mainSubmitResponse.body.value.payload);
    assert.equal((await pool.query('SELECT count(*)::text AS n FROM relay_commit_queue WHERE world_id=$1', [worldId])).rows[0].n, '1');
  });
  await run('same identity different envelope digest rejects; bad author signature never queues', async () => {
    const bytes = Buffer.from(mainCommit.envelopeBytesBase64Url, 'base64url');
    const envelope = JSON.parse(bytes.toString('utf8'));
    envelope.nonceBase64Url = randomBytes(12).toString('base64url');
    envelope.authorSignatureBase64Url = signature(principal.key, 'Neurou/world-commit/v1\0', sharedUnsigned(envelope, 'authorSignatureBase64Url'));
    const changedBytes = Buffer.from(sharedCanonical(envelope));
    const claim = { ...mainCommit.admissionClaim.claim, envelopeSha256: sha256(changedBytes) };
    const conflict = { ...mainCommit, envelopeBytesBase64Url: changedBytes.toString('base64url'), admissionClaim: { claim, authorSignatureBase64Url: signature(principal.key, 'Neurou/commit-admission-claim/v1\0', claim) } };
    // Altered digest cannot reuse its immutable admission proof; the strict codec rejects first.
    const denied = await shared('/relay/submit', { commit: conflict }); assert.equal(denied.status, 400); assert.equal(denied.body.fault.detail, 'SchemaInvalid');
    const bad = structuredClone(mainCommit); bad.admissionClaim.authorSignatureBase64Url = randomBytes(64).toString('base64url');
    assert.equal((await shared('/relay/submit', { commit: bad })).status, 403);
  });
  await run('signed pull reconstructs original exact ciphertext and complete public proof', async () => {
    originalPullRequest = request('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 0 });
    originalPullResponse = await http('/api/v1/shared/relay/pull', originalPullRequest);
    const batch = checked(originalPullResponse, '/relay/pull').payload;
    assert.equal(batch.kind, 'Batch'); assert.equal(batch.next.position, '1'); assert.equal(batch.retentionFloor.position, '0');
    assert.equal(sharedCanonical(batch.commits[0]), sharedCanonical(mainCommit));
  });
  await run('P11 request memory contains references/skeleton/hash only; live same nonce reconstructs exact wire', async () => {
    const row = (await pool.query('SELECT result_wire FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, originalPullRequest.requestNonce])).rows[0];
    const encoded = row.result_wire.toString('utf8'), memory = JSON.parse(encoded);
    assert.equal(memory.kind, 'RelayPullReferences'); assert.equal(memory.schemaVersion, 1); assert.equal(memory.wireSha256, sha256(originalPullResponse.wire)); assert.equal(memory.entries[0].position, '1'); assert.deepEqual(memory.receipt.payload.commits, []);
    for (const forbidden of ['envelopeBytesBase64Url', 'appendPermitReceipt', 'sequenceSegmentReceipt', 'admissionReceipt', 'membershipEpochReceipt', 'ciphertextAndTagBase64Url']) { assert.ok(!encoded.includes(forbidden), forbidden); }
    assert.ok(!encoded.includes(mainCommit.envelopeBytesBase64Url));
    assert.equal((await http('/api/v1/shared/relay/pull', originalPullRequest)).wire, originalPullResponse.wire);
    const changed = { ...originalPullRequest, payload: { ...originalPullRequest.payload, maximumCount: 1 } }; const conflict = await http('/api/v1/shared/relay/pull', changed); assert.equal(conflict.status, 409); assert.equal(conflict.body.fault.detail, 'IdempotencyConflict');
  });
  await run('P11 corrupt memory shape/hash/signature rejects without body or new nonce consumption', async () => {
    const row = (await pool.query('SELECT result_wire FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, originalPullRequest.requestNonce])).rows[0];
    for (const alter of [memory => { memory.wireSha256 = '0'.repeat(64); }, memory => { memory.receipt.signatureBase64Url = randomBytes(64).toString('base64url'); }, memory => { memory.entries[0].extra = true; }]) {
      const memory = JSON.parse(row.result_wire.toString('utf8')); alter(memory);
      await pool.query('UPDATE authority_requests SET result_wire=$4 WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, originalPullRequest.requestNonce, Buffer.from(sharedCanonical(memory))]);
      const rejected = await http('/api/v1/shared/relay/pull', originalPullRequest); assert.equal(rejected.status, 503); assert.equal(rejected.body.fault.detail, 'RelayUnavailable'); assert.ok(!rejected.wire.includes('envelopeBytesBase64Url'));
    }
    await pool.query('UPDATE authority_requests SET result_wire=$4 WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, originalPullRequest.requestNonce, row.result_wire]);
    assert.equal((await http('/api/v1/shared/relay/pull', originalPullRequest)).wire, originalPullResponse.wire);
  });
  await run('ACK registered signature and exact recipient/position/digest; invalid batch rolls back atomically', async () => {
    const entry = { position: '1', identity: mainCommit.admissionClaim.claim.header.identity, envelopeSha256: mainCommit.admissionClaim.claim.envelopeSha256 };
    const nonce = randomToken(), badEntries = [entry, { ...entry, position: '2' }];
    const denied = await shared('/relay/ack', ackPayload(badEntries, nonce), nonce); assert.equal(denied.status, 403);
    assert.equal((await pool.query('SELECT count(*)::text AS n FROM relay_acknowledgements WHERE world_id=$1', [worldId])).rows[0].n, '0');
    const wrongNonce = randomToken(), badSignature = ackPayload([entry], wrongNonce); badSignature.deviceSignatureBase64Url = randomBytes(64).toString('base64url');
    assert.equal((await shared('/relay/ack', badSignature, wrongNonce)).status, 403);
    const goodNonce = randomToken(), input = request('/relay/ack', ackPayload([entry], goodNonce), goodNonce);
    const good = await http('/api/v1/shared/relay/ack', input); checked(good, '/relay/ack', goodNonce);
    assert.equal((await http('/api/v1/shared/relay/ack', input)).wire, good.wire);
    assert.equal((await pool.query('SELECT count(*)::text AS n FROM relay_acknowledgements WHERE world_id=$1', [worldId])).rows[0].n, '1');
  });
  await run('all recipients ACK cannot delete any bytes before admittedAt plus retention', async () => {
    const row = (await pool.query('SELECT envelope_bytes,tombstone FROM relay_commit_queue WHERE world_id=$1 AND position=1', [worldId])).rows[0];
    assert.equal(row.tombstone, false); assert.equal(row.envelope_bytes.toString('base64url'), mainCommit.envelopeBytesBase64Url);
    const batch = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 1, maximumWaitMs: 0 }), '/relay/pull').payload;
    assert.equal(batch.commits.length, 1);
  });
  await run('relay insertion failure rolls position and nonce back while auth/authority remain usable', async () => {
    const commit = await admittedCommit();
    await pool.query("CREATE FUNCTION isolated_relay_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated relay backend unavailable'; END $$");
    await pool.query('CREATE TRIGGER isolated_relay_insert_failure BEFORE INSERT ON relay_commit_queue FOR EACH ROW EXECUTE FUNCTION isolated_relay_insert_failure()');
    const input = request('/relay/submit', { commit });
    try {
      const response = await http('/api/v1/shared/relay/submit', input); assert.equal(response.status, 503); assert.equal(response.body.fault.detail, 'RelayUnavailable');
      assert.equal((await pool.query('SELECT next_position::text AS p FROM relay_streams WHERE world_id=$1', [worldId])).rows[0].p, '2');
      assert.equal((await pool.query('SELECT 1 FROM authority_requests WHERE service_instance_id=$1 AND request_nonce=$2', [instance, input.requestNonce])).rowCount, 0);
      assert.equal((await http('/api/v1/auth/verify', { requestNonce: randomToken() })).status, 200); checked(await shared('/status', {}), '/status');
    } finally { await pool.query('DROP TRIGGER isolated_relay_insert_failure ON relay_commit_queue'); await pool.query('DROP FUNCTION isolated_relay_insert_failure()'); }
    checked(await http('/api/v1/shared/relay/submit', input), '/relay/submit'); allCommits.push(commit);
  });
  await run('lost mutation response and disconnect retry recover original committed HTTP bytes', async () => {
    const commit = await admittedCommit(), input = request('/relay/submit', { commit });
    await new Promise((resolveLost, rejectLost) => {
      const outgoing = rawHttpRequest(origin + '/api/v1/shared/relay/submit', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...principal.cookies].map(([k, v]) => k + '=' + v).join('; '), 'X-CSRF-Token': principal.csrf } }, incoming => { incoming.destroy(); outgoing.destroy(); resolveLost(); });
      outgoing.on('error', error => { if (error.code !== 'ECONNRESET') { rejectLost(error); } }); outgoing.end(sharedCanonical(input));
    });
    const stored = (await pool.query('SELECT result_wire FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, input.requestNonce])).rows[0];
    assert.ok(stored); const retried = await http('/api/v1/shared/relay/submit', input); assert.equal(retried.wire, stored.result_wire.toString('utf8')); checked(retried, '/relay/submit'); allCommits.push(commit);
  });
  await run('one pending pull per device; long wait holds no PG business lock; cancellation clears pending', async () => {
    const after = { relayGeneration: 1, position: String(allCommits.length) }, payload = { worldId, after, maximumCount: 128, maximumWaitMs: 25000 };
    const controller = new AbortController(), started = Date.now();
    const pending = fetch(origin + '/api/v1/shared/relay/pull', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...principal.cookies].map(([k, v]) => k + '=' + v).join('; '), 'X-CSRF-Token': principal.csrf }, body: sharedCanonical(request('/relay/pull', payload)), signal: controller.signal }).catch(error => error);
    await new Promise(resolveDelay => setTimeout(resolveDelay, 200));
    const authorityStart = Date.now(); checked(await shared('/status', {}), '/status'); assert.ok(Date.now() - authorityStart < 3000);
    const second = await shared('/relay/pull', payload); assert.equal(second.status, 429);
    controller.abort(); await pending; await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
    const followup = checked(await shared('/relay/pull', { ...payload, maximumWaitMs: 0 }), '/relay/pull'); assert.equal(followup.payload.kind, 'Batch'); assert.ok(Date.now() - started < 5000);
  });
  await run('default 25000ms actual server wait completes past 12000ms without occupied business locks', async () => {
    const start = Date.now(); const batch = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: String(allCommits.length) }, maximumCount: 128, maximumWaitMs: 25000 }), '/relay/pull').payload;
    assert.equal(batch.kind, 'Batch'); assert.equal(batch.commits.length, 0); assert.ok(Date.now() - start >= 24500); assert.ok(Date.now() - start < 32000);
  });
  await run('restart preserves relay generation/positions/raw queue/ACK and original nonce response', async () => {
    const before = (await pool.query('SELECT * FROM relay_streams WHERE world_id=$1', [worldId])).rows[0];
    await app.close(); app = await buildRelayServer(config, pool, authSigner, signer); await app.listen({ host: '127.0.0.1', port: config.auth.port });
    const after = (await pool.query('SELECT * FROM relay_streams WHERE world_id=$1', [worldId])).rows[0]; assert.deepEqual(after, before);
    assert.equal((await http('/api/v1/shared/relay/submit', mainSubmitRequest)).wire, mainSubmitResponse.wire);
    assert.equal((await http('/api/v1/shared/relay/pull', originalPullRequest)).wire, originalPullResponse.wire);
    const batch = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 256, maximumWaitMs: 0 }), '/relay/pull').payload;
    assert.equal(batch.commits.length, allCommits.length); assert.equal(sharedCanonical(batch.commits[0]), sharedCanonical(mainCommit));
    assert.equal((await pool.query('SELECT count(*)::text AS n FROM relay_acknowledgements WHERE world_id=$1', [worldId])).rows[0].n, '1');
  });
  await run('pull caps count and full signed response bytes without partial commits or cursor skipping', async () => {
    for (let i = 0; i < 13; i++) { const commit = await admittedCommit(42000); checked(await shared('/relay/submit', { commit }), '/relay/submit'); allCommits.push(commit); }
    const response = await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 256, maximumWaitMs: 0 });
    const batch = checked(response, '/relay/pull').payload; assert.ok(Buffer.byteLength(response.wire) <= 1048576); assert.ok(batch.commits.length > 1); assert.ok(batch.commits.length < allCommits.length); assert.equal(BigInt(batch.next.position), BigInt(batch.after.position) + BigInt(batch.commits.length));
    const next = checked(await shared('/relay/pull', { worldId, after: batch.next, maximumCount: 256, maximumWaitMs: 0 }), '/relay/pull').payload; assert.equal(batch.commits.length + next.commits.length, allCommits.length);
    const one = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 1, maximumWaitMs: 0 }), '/relay/pull').payload; assert.equal(one.commits.length, 1);
  });
  await run('strict route wire/independent body limits and uint64 reject without relaxing old auth', async () => {
    const payload = { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 257, maximumWaitMs: 0 }; assert.equal((await shared('/relay/pull', payload)).status, 400);
    assert.equal((await shared('/relay/pull', { ...payload, maximumCount: 128, maximumWaitMs: 25001 })).status, 400);
    assert.equal((await shared('/relay/pull', { ...payload, maximumCount: 128, after: { relayGeneration: 1, position: '18446744073709551616' } })).status, 400);
    const duplicate = '{"authorization":null,"payload":{},"requestNonce":"' + randomToken() + '","schemaVersion":1,"schemaVersion":1}'; assert.equal((await http('/api/v1/shared/relay/pull', duplicate)).status, 400);
    assert.equal((await http('/api/v1/shared/relay/pull', ' '.repeat(16385))).status, 413);
    assert.equal((await http('/api/v1/shared/relay/ack', ' '.repeat(65537))).status, 413);
    assert.equal((await http('/api/v1/shared/relay/submit', ' '.repeat(524289))).status, 413);
    assert.equal((await http('/api/v1/auth/verify', ' '.repeat(16385))).status, 413);
    const badCursorRequest = request('/relay/pull', { worldId, after: { relayGeneration: 1, position: String(allCommits.length + 1) }, maximumCount: 1, maximumWaitMs: 0 });
    assert.equal((await http('/api/v1/shared/relay/pull', badCursorRequest)).status, 400);
    assert.equal((await pool.query('SELECT 1 FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [instance, principal.account, badCursorRequest.requestNonce])).rowCount, 0);
  });
  await run('retention expiration persists tombstones/floor/original receipt; expired resubmit does not restore bytes', async () => {
    const lateCommit = await admittedCommit();
    await app.close(); const wall = Date.now() + 86400100; const clock = RealAuthorityClock.isolatedTest(instance, 'isolated-retention-clock', { wall: () => wall, monotonic: () => 1 });
    app = await buildIsolatedRelayServer(config, pool, authSigner, signer, clock); await app.listen({ host: '127.0.0.1', port: config.auth.port });
    const gap = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 0 }), '/relay/pull').payload; assert.equal(gap.kind, 'Gap'); assert.equal(gap.reason, 'RetentionExpired'); assert.equal(gap.retentionFloor.position, String(allCommits.length));
    const oldNonceGap = checked(await http('/api/v1/shared/relay/pull', originalPullRequest), '/relay/pull').payload; assert.equal(oldNonceGap.reason, 'RetentionExpired'); assert.ok(!sharedCanonical(oldNonceGap).includes('envelopeBytesBase64Url'));
    const row = (await pool.query('SELECT * FROM relay_commit_queue WHERE world_id=$1 AND position=1', [worldId])).rows[0]; assert.equal(row.tombstone, true); assert.equal(row.envelope_bytes, null); assert.equal(row.public_proof, null); assert.equal(row.receipt.toString('utf8'), sharedCanonical(mainSubmitResponse.body.value));
    checked(await shared('/relay/submit', { commit: mainCommit }), '/relay/submit'); assert.equal((await pool.query('SELECT envelope_bytes FROM relay_commit_queue WHERE world_id=$1 AND position=1', [worldId])).rows[0].envelope_bytes, null);
    const late = checked(await shared('/relay/submit', { commit: lateCommit }), '/relay/submit').payload;
    const lateRow = (await pool.query('SELECT envelope_bytes,public_proof,tombstone FROM relay_commit_queue WHERE world_id=$1 AND position=$2', [worldId, late.cursor.position])).rows[0]; assert.equal(lateRow.tombstone, true); assert.equal(lateRow.envelope_bytes, null); assert.equal(lateRow.public_proof, null); allCommits.push(lateCommit);
  }, 'isolated-injected-clock-no-production-wall-duration-claim');
  await run('certified missing PG row advances durable generation once, then missing-authority-envelope Gap', async () => {
    await pool.query('DELETE FROM relay_acknowledgements WHERE world_id=$1 AND position=1', [worldId]); await pool.query('DELETE FROM relay_delivery_recipients WHERE world_id=$1 AND position=1', [worldId]); await pool.query('DELETE FROM relay_commit_queue WHERE world_id=$1 AND position=1', [worldId]);
    const gap = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 0 }), '/relay/pull').payload; assert.equal(gap.reason, 'RelayGenerationChanged'); assert.equal(gap.retentionFloor.relayGeneration, 2);
    const oldNonceGap = checked(await http('/api/v1/shared/relay/pull', originalPullRequest), '/relay/pull').payload; assert.equal(oldNonceGap.reason, 'RelayGenerationChanged');
    const fresh = checked(await shared('/relay/pull', { worldId, after: { relayGeneration: 2, position: '0' }, maximumCount: 128, maximumWaitMs: 0 }), '/relay/pull').payload; assert.equal(fresh.reason, 'MissingAdmittedEnvelope');
    assert.equal(Number((await pool.query('SELECT generation FROM relay_streams WHERE world_id=$1', [worldId])).rows[0].generation), 2);
  }, 'isolated-injected-clock-and-explicit-test-storage-loss');
  await run('P11 real root epoch credential revocation prevents old nonce body replay', async () => {
    const current = epochReceipt.payload;
    const next = { schemaVersion: 1, serviceInstanceId: instance, worldId, membershipEpoch: 2, previousMembershipEpoch: 1, key: { schemaVersion: 1, worldId, membershipEpoch: 2, keyEpoch: 2, worldRelayKeyId: randomUUID(), keyCommitmentSha256: sha256(randomBytes(32)) }, credentials: [], developerTrustAnchorSha256: current.developerTrustAnchorSha256 };
    next.developerSignatureBase64Url = signature(developerKey, 'Neurou/world-membership/v1\0', next);
    // Removing an account's last credential is MemberRemoved under the frozen authority delta rules.
    const nonce = randomToken(), change = { schemaVersion: 1, serviceInstanceId: instance, changeId: randomUUID(), requestNonce: nonce, worldId, expectedMembershipEpoch: 1, reason: 'MemberRemoved', next };
    checked(await shared('/membership/publish', { change }, nonce), '/membership/publish');
    const revoked = await http('/api/v1/shared/relay/pull', originalPullRequest); assert.equal(revoked.status, 403); assert.equal(revoked.body.fault.detail, 'MemberNotActive'); assert.ok(!revoked.wire.includes('envelopeBytesBase64Url'));
    assert.equal((await http('/api/v1/auth/verify', { requestNonce: randomToken() })).status, 200);
  }, 'isolated-injected-clock-real-authority-epoch-route');
  }
} catch (error) {
  process.exitCode = 1;
  if (!results.some(item => !item.pass)) { results.push({ name: 'setup-or-finalization', pass: false, error: String(error.stack || error) }); }
} finally {
  if (app) { await app.close().catch(() => undefined); }
  await pool.end();
  await mkdir(dirname(resultsPath), { recursive: true });
  await writeFile(resultsPath, JSON.stringify({ schemaVersion: 1, suite: 'c-2c-real-loopback-pg-server', serviceMode: 'ExternalService', databaseVersion: 'PostgreSQL17', isolatedPublicWorldPins: true, noProductionKeyDeliveryOrReplayClaim: true, total: results.length, passed: results.filter(item => item.pass).length, failed: results.filter(item => !item.pass).length, results }, null, 2) + '\n');
}
