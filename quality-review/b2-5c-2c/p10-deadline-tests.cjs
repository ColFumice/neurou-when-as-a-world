'use strict';
// Real owner code / native ES256, simulated elapsed clock and observed timer contract oracle.
// No actual network; live >12s loopback HTTP is separate acceptance evidence.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const workspace = path.resolve(__dirname, '../..');
const compiled = path.join(__dirname, 'evidence', 'p10-compiled');
for (const relative of ['src/director/SharedCanonicalBytes.ts', 'src/director/SharedCommitCodec.ts',
  'src/director/SharedServiceProtocolCodec.ts', 'src/presentation/RealSharedServiceSessionAdapter.ts']) {
  const output = path.join(compiled, relative.replace(/\.ts$/, '.js')); fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, ts.transpileModule(fs.readFileSync(path.join(workspace, relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
  }).outputText);
}
const { SharedServiceProtocolCodec: codec } = require(path.join(compiled, 'src/director/SharedServiceProtocolCodec.js'));
const { RealSharedServiceSessionAdapter } = require(path.join(compiled, 'src/presentation/RealSharedServiceSessionAdapter.js'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' }), jwk = { kty: 'EC', crv: 'P-256', x: publicJwk.x, y: publicJwk.y };
function canonical(value) {
  if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
  if (Array.isArray(value)) { return '[' + value.map(canonical).join(',') + ']'; }
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('base64url');
const nonce = () => crypto.randomBytes(32).toString('base64url');
const uuid = () => crypto.randomUUID();
const environment = { mode: 'ExternalService', serviceInstanceId: 'p10-deadline-contract-oracle', apiOrigin: 'http://127.0.0.1:43125',
  authorityTrustAnchor: { keyId: hash(jwk), publicKeyJwk: jwk, jwkSha256: hash(jwk) } };
const policy = { schemaVersion: 1, offlineGraceMs: 3600000, boundedRelayDelayMs: 300000,
  timeUncertaintyAllowanceMs: 60000, settleHorizonMs: 3960000, retentionMs: 86400000 };
const accountId = uuid(), deviceId = uuid(), sessionId = uuid(), worldId = uuid();
let authorKey, authorFingerprint, elapsed = 0, fakeNow = 100, networkFailures = 0, abortOnTransport = false;
const calls = [], timers = [], results = [];
const nativeTimer = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
const nativePerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');
globalThis.setTimeout = (callback, delay, ...args) => {
  const record = { callback, delay, token: nativeTimer(callback, delay, ...args) }; timers.push(record); return record.token;
};
globalThis.clearTimeout = token => nativeClear(token);
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => fakeNow } });
function signed(purpose, payload, requestNonce, shared) {
  const value = shared ? { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, purpose,
    receiptId: uuid(), requestNonce, keyId: hash(jwk), payload }
    : { schemaVersion: 1, serviceInstanceId: environment.serviceInstanceId, purpose,
      receiptId: uuid(), keyId: hash(jwk), issuedAtServerEpochMs: Date.now(), payload };
  value.signatureBase64Url = crypto.sign('sha256', Buffer.from((shared ? 'Neurou/shared-transport/v1\0' : 'Neurou/service/v1\0')
    + canonical(value)), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return value;
}
async function transport(url, options) {
  const route = new URL(url).pathname, input = JSON.parse(options.body);
  calls.push({ route, body: options.body, requestNonce: input.requestNonce, deadlineMs: timers.at(-1).delay });
  if (route.startsWith('/api/v1/shared/')) {
    fakeNow += elapsed;
    if (abortOnTransport) { timers.at(-1).callback(); throw Error('abort'); }
    if (networkFailures > 0) { networkFailures -= 1; throw Error('simulated disconnect'); }
  }
  let value, shared = false;
  if (route === '/api/v1/device/challenge') {
    authorKey = input.publicKeyJwk; authorFingerprint = hash(authorKey);
    value = signed('DeviceChallenge', { schemaVersion: 1, purpose: 'LoginDevice', challengeId: uuid(), nonceBase64Url: nonce(),
      accountName: input.accountName, keyFingerprint: authorFingerprint, deviceId: input.deviceId,
      deviceGeneration: input.deviceId ? 1 : null, expiresAtServerEpochMs: Date.now() + 30000,
      serviceInstanceId: environment.serviceInstanceId, requestNonce: input.requestNonce }, input.requestNonce, false);
  } else if (route === '/api/v1/auth/login' || route === '/api/v1/auth/verify') {
    value = signed('Authentication', { requestNonce: input.requestNonce, sessionId, csrfToken: nonce(),
      account: { accountId, accountName: 'deadline.client' },
      device: { deviceId, generation: 1, keyFingerprint: authorFingerprint, assurance: 'RegisteredCredential',
        label: 'deadline', status: 'Active' }, expiresAtServerEpochMs: Date.now() + 900000 }, input.requestNonce, false);
  } else if (route === '/api/v1/time') {
    const now = Date.now(); value = signed('ServerTime', { requestNonce: input.requestNonce,
      serverEpochMs: now, clockGeneration: 1, clockStatus: 'Trusted' }, input.requestNonce, false);
    value.issuedAtServerEpochMs = now;
    const unsigned = { ...value }; delete unsigned.signatureBase64Url;
    value.signatureBase64Url = crypto.sign('sha256', Buffer.from('Neurou/service/v1\0' + canonical(unsigned)),
      { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  } else if (route === '/api/v1/shared/relay/pull') {
    shared = true; value = signed('RelayPull', { kind: 'Batch', worldId: input.payload.worldId, after: input.payload.after,
      next: input.payload.after, commits: [], retentionFloor: { relayGeneration: 1, position: '0' } }, input.requestNonce, true);
  } else if (route === '/api/v1/shared/status') {
    shared = true; value = signed('SharedServiceStatus', { clockGeneration: 1, clockStatus: 'Trusted', serverEpochMs: Date.now(),
      lastSignedEpochMs: null, policy, policySha256: crypto.createHash('sha256').update(canonical(policy)).digest('hex') }, input.requestNonce, true);
  } else { throw Error(route); }
  return new Response(shared ? canonical({ kind: 'Accepted', value }) : JSON.stringify(value),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
}
async function check(label, action) {
  try { elapsed = 0; networkFailures = 0; abortOnTransport = false; await action(); results.push({ label, passed: true }); console.log('PASS ' + label); }
  catch (error) { results.push({ label, passed: false, error: String(error.stack || error) }); throw error; }
}
async function main() {
  const owner = RealSharedServiceSessionAdapter.forLoopbackHttpTest(environment, transport, codec);
  const login = async () => assert.equal((await owner.login({ accountName: 'deadline.client', password: 'random-password-' + nonce(), deviceLabel: 'deadline' })).kind, 'Accepted');
  const pull = wait => owner.request('/relay/pull', nonce(), { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: wait });
  await check('unchanged auth login challenge and login timers are 12000ms', async () => {
    await login(); assert.deepEqual(calls.slice(-2).map(call => call.deadlineMs), [12000, 12000]);
  });
  await check('validated pull wait=0 uses actual timer 7000ms', async () => {
    assert.equal((await pull(0)).kind, 'Accepted'); assert.equal(calls.at(-1).deadlineMs, 7000);
  });
  await check('validated pull wait=25000 uses actual timer 32000ms', async () => {
    assert.equal((await pull(25000)).kind, 'Accepted'); assert.equal(calls.at(-1).deadlineMs, 32000);
  });
  await check('ordinary shared request actual timer remains 12000ms', async () => {
    assert.equal((await owner.request('/status', nonce(), {})).kind, 'Accepted'); assert.equal(calls.at(-1).deadlineMs, 12000);
  });
  await check('ordinary auth time request actual timer remains 12000ms', async () => {
    assert.equal((await owner.readServerTime()).kind, 'Accepted'); assert.equal(calls.at(-1).deadlineMs, 12000);
  });
  await check('legal pull simulated elapsed 25001ms survives previous 12000ms cutoff', async () => {
    elapsed = 25001; assert.equal((await pull(25000)).kind, 'Accepted');
  });
  await check('ordinary shared elapsed >12000ms remains unavailable', async () => {
    elapsed = 12001; const reply = await owner.request('/status', nonce(), {});
    assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.code, 'AuthorityUnavailable');
  });
  await check('pull elapsed >32000ms returns unavailable without changing request nonce', async () => {
    elapsed = 32001; const requestNonce = nonce();
    const reply = await owner.request('/relay/pull', requestNonce, { worldId, after: { relayGeneration: 1, position: '0' }, maximumCount: 128, maximumWaitMs: 25000 });
    assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.requestNonce, requestNonce);
  });
  await check('wait zero elapsed >7000ms returns unavailable', async () => {
    elapsed = 7001; assert.equal((await pull(0)).kind, 'Rejected');
  });
  await check('network retry retains exact signed body/nonce within same deadline', async () => {
    networkFailures = 1; assert.equal((await pull(25000)).kind, 'Accepted');
    const retry = calls.slice(-2); assert.equal(retry[0].body, retry[1].body); assert.equal(retry[0].requestNonce, retry[1].requestNonce);
  });
  await check('deadline abort stops retry and returns unavailable', async () => {
    abortOnTransport = true; const before = calls.length; const reply = await pull(25000);
    assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.code, 'AuthorityUnavailable'); assert.equal(calls.length, before + 1);
  });
  for (const wait of [-1, 25001]) {
    await check('invalid wait=' + wait + ' rejected by existing codec before timer/transport', async () => {
      if (!owner.currentContext()) { await login(); }
      const before = calls.length, timerCount = timers.length; const reply = await pull(wait);
      assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.code, 'InvalidData');
      assert.equal(calls.length, before); assert.equal(timers.length, timerCount);
    });
  }
}
main().then(() => {
  const evidence = { kind: 'ContractOracle', passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length, realHttp: false, realPostgreSQL: false,
    actualSessionOwner: true, simulatedElapsedClock: true, observedNativeTimers: true, results };
  fs.writeFileSync(path.join(__dirname, 'evidence', 'p10-deadline-results.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, results: undefined }));
}).catch(error => { fs.writeFileSync(path.join(__dirname, 'evidence', 'p10-deadline-results.json'), JSON.stringify({ results, error: String(error.stack || error) }, null, 2)); console.error(error); process.exitCode = 1; })
.finally(() => {
  globalThis.setTimeout = nativeTimer; globalThis.clearTimeout = nativeClear;
  for (const timer of timers) { nativeClear(timer.token); }
  Object.defineProperty(globalThis, 'performance', nativePerformance);
});
