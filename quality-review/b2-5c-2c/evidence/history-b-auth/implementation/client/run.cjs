'use strict';
// Independent contract adversarial checks, then optionally real loopback HTTP/PostgreSQL.
// Test transports never bypass the client's pin, nonce, schema or ES256 verification.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const project = "D:\\Project\\A_New_Begin\\Neurou_official";
const ts = require(path.join(project, 'node_modules/typescript'));
const compiled = ts.transpileModule(fs.readFileSync(path.join(project, 'src/presentation/RealAuthServiceAdapter.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText;
const privateDirectory = path.join(__dirname, '.local');
fs.mkdirSync(privateDirectory, { recursive: true });
const clientPath = path.join(privateDirectory, 'client.cjs');
fs.writeFileSync(clientPath, compiled);
const { RealAuthServiceAdapter } = require(clientPath);
const records = [];
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const token = () => nodeCrypto.randomBytes(32).toString('base64url');
const fingerprint = jwk => nodeCrypto.createHash('sha256').update(canonical({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url');
const accountName = 'client_contract';
const password = 'Contract-only-secret-42';
const loginRequest = { accountName, password, deviceLabel: 'Contract registered key' };

async function test(name, action) {
  try { await action(); records.push({ name, result: 'PASS' }); process.stdout.write('PASS ' + name + '\n'); }
  catch (failure) { records.push({ name, result: 'FAIL', reason: failure.message }); throw failure; }
}
function accepted(reply) { assert.equal(reply.kind, 'Accepted'); return reply.value; }
function rejected(reply, code) { assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.code, code); }

function fixture() {
  const pair = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const exported = pair.publicKey.export({ format: 'jwk' });
  const jwk = { kty: 'EC', crv: 'P-256', x: exported.x, y: exported.y };
  const env = { mode: 'ExternalService', serviceInstanceId: 'contract-tests-only', apiOrigin: 'http://127.0.0.1:43126',
    authorityTrustAnchor: { keyId: fingerprint(jwk), publicKeyJwk: jwk, jwkSha256: fingerprint(jwk) } };
  const account = { accountId: nodeCrypto.randomUUID(), accountName };
  let device;
  let challenge;
  let challengeKey;
  let sessionId;
  let csrfToken;
  let mutate = null;
  let responseMutation = null;
  let throwsNetwork = false;
  let delay = false;
  function signed(purpose, payload, issuedAtServerEpochMs = 100000) {
    const unsigned = { schemaVersion: 1, serviceInstanceId: env.serviceInstanceId, purpose,
      receiptId: nodeCrypto.randomUUID(), keyId: env.authorityTrustAnchor.keyId, issuedAtServerEpochMs, payload };
    if (mutate) { mutate(unsigned); }
    return { ...unsigned, signatureBase64Url: nodeCrypto.sign('sha256', Buffer.from('Neurou/service/v1\0' + canonical(unsigned)),
      { key: pair.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url') };
  }
  const transport = async (url, init) => {
    if (throwsNetwork) { throw new Error('Controlled network failure'); }
    if (delay) { await new Promise(resolve => setTimeout(resolve, 25)); }
    assert.equal(init.credentials, 'include'); assert.equal(init.mode, 'same-origin');
    assert.equal(init.redirect, 'error'); assert.equal(init.method, 'POST');
    assert.equal(new URL(url).origin, env.apiOrigin);
    const body = JSON.parse(init.body);
    const route = new URL(url).pathname;
    let receipt;
    if (route === '/api/v1/device/challenge') {
      challengeKey = body.publicKeyJwk;
      challenge = { schemaVersion: 1, purpose: 'LoginDevice', challengeId: nodeCrypto.randomUUID(), nonceBase64Url: token(),
        accountName: body.accountName, keyFingerprint: fingerprint(body.publicKeyJwk), deviceId: body.deviceId,
        deviceGeneration: body.deviceId === null ? null : 1, expiresAtServerEpochMs: 130000,
        serviceInstanceId: env.serviceInstanceId, requestNonce: body.requestNonce };
      receipt = signed('DeviceChallenge', challenge);
    } else if (route === '/api/v1/auth/login') {
      assert.equal(body.password, password); assert.equal(body.challengeId, challenge.challengeId);
      assert(nodeCrypto.verify('sha256', Buffer.from('Neurou/device/v1\0' + canonical(challenge)),
        { key: nodeCrypto.createPublicKey({ key: challengeKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
        Buffer.from(body.signatureBase64Url, 'base64url')));
      device = { deviceId: challenge.deviceId || nodeCrypto.randomUUID(), generation: 1,
        keyFingerprint: challenge.keyFingerprint, assurance: 'RegisteredCredential', label: body.deviceLabel, status: 'Active' };
      sessionId = nodeCrypto.randomUUID(); csrfToken = token();
      receipt = signed('Authentication', { requestNonce: body.requestNonce, sessionId, csrfToken, account, device, expiresAtServerEpochMs: 900000 });
    } else {
      assert.equal(init.headers['X-CSRF-Token'], csrfToken);
      if (route === '/api/v1/auth/verify' || route === '/api/v1/auth/refresh') {
        receipt = signed('Authentication', { requestNonce: body.requestNonce, sessionId, csrfToken, account, device, expiresAtServerEpochMs: 900000 });
      } else if (route === '/api/v1/time') {
        receipt = signed('ServerTime', { requestNonce: body.requestNonce, serverEpochMs: 100000, clockGeneration: 1, clockStatus: 'Trusted' });
      } else if (route === '/api/v1/account/facts') {
        receipt = signed('AccountFacts', { requestNonce: body.requestNonce, account, devices: [device], revision: 0 });
      } else if (route === '/api/v1/auth/logout') {
        receipt = signed('Logout', { requestNonce: body.requestNonce, sessionId, revoked: true });
      } else { throw Error('Unexpected endpoint'); }
    }
    let content = JSON.stringify(receipt);
    if (responseMutation) { content = responseMutation(content); }
    return new Response(content, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  };
  return { env, client: RealAuthServiceAdapter.forLoopbackHttpTest(env, transport),
    setMutation(value) { mutate = value; }, setResponseMutation(value) { responseMutation = value; },
    failNetwork() { throwsNetwork = true; }, delay() { delay = true; } };
}

async function contractChecks() {
  await test('contract: signed login, device proof, verify, refresh, time, facts, logout', async () => {
    const value = fixture(); const context = accepted(await value.client.login(loginRequest));
    assert.equal(context.deviceAssurance, 'RegisteredCredential'); assert.equal(context.offlineGrant, undefined);
    assert.equal(context.physicalDeviceId, undefined); assert(Object.isFrozen(context));
    assert.equal(accepted(await value.client.verify()).authenticationId, context.authenticationId);
    accepted(await value.client.refresh()); assert.equal(await value.client.fetchServerTime(), 100000);
    assert.equal(accepted(await value.client.readAccountFacts()).payload.devices.length, 1);
    assert.equal(accepted(await value.client.logout()).serverRevoked, true);
    rejected(await value.client.verify(), 'Unauthenticated');
    // The same in-memory credential remains usable; it is not claimed to survive reload.
    assert.equal(accepted(await value.client.login(loginRequest)).deviceId, context.deviceId);
  });
  const invalid = [
    ['unknown receipt fields', receipt => { receipt.extra = true; }, 'InvalidData'],
    ['wrong receipt purpose', receipt => { receipt.purpose = 'Authentication'; }, 'InvalidData'],
    ['wrong service instance', receipt => { receipt.serviceInstanceId = 'other-service'; }, 'InvalidData'],
    ['nonce replay', receipt => { receipt.payload.requestNonce = token(); }, 'InvalidData'],
    ['unknown schema version', receipt => { receipt.schemaVersion = 2; }, 'VersionUnsupported'],
    ['untrusted server time', receipt => { receipt.payload.clockStatus = 'Untrusted'; }, 'TimeUntrusted'],
    ['server time disagreement', receipt => { receipt.payload.serverEpochMs += 1; }, 'TimeUntrusted'],
    ['negative clock generation', receipt => { receipt.payload.clockGeneration = -1; }, 'InvalidData'],
    ['unsafe time integer', receipt => { receipt.payload.serverEpochMs = Number.MAX_SAFE_INTEGER + 1; }, 'InvalidData'],
  ];
  for (const [name, mutation, code] of invalid) {
    await test('contract rejects ' + name, async () => {
      const value = fixture(); accepted(await value.client.login(loginRequest)); value.setMutation(mutation);
      rejected(await value.client.readServerTime(), code);
    });
  }
  await test('contract rejects modified P1363 signature', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest));
    value.setResponseMutation(content => { const receipt = JSON.parse(content); const signature = Buffer.from(receipt.signatureBase64Url, 'base64url');
      signature[0] ^= 1; receipt.signatureBase64Url = signature.toString('base64url'); return JSON.stringify(receipt); });
    rejected(await value.client.readServerTime(), 'InvalidData');
  });
  await test('contract rejects duplicate JSON keys before parsing overwrite', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest));
    value.setResponseMutation(content => content.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'));
    rejected(await value.client.readServerTime(), 'InvalidData');
  });
  await test('contract rejects deadline crossed during genuine ES256 verification', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest));
    const verifyDescriptor = Object.getOwnPropertyDescriptor(crypto.subtle, 'verify');
    const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    const genuineVerify = crypto.subtle.verify.bind(crypto.subtle);
    const genuineNow = performance.now.bind(performance);
    let elapsedShift = 0; let verifiedCount = 0;
    try {
      Object.defineProperty(performance, 'now', { configurable: true, value: () => genuineNow() + elapsedShift });
      Object.defineProperty(crypto.subtle, 'verify', { configurable: true, value: async (...args) => {
        const valid = await genuineVerify(...args); assert.equal(valid, true); verifiedCount += 1;
        // Advance the test monotonic clock only after real WebCrypto ES256 has succeeded.
        elapsedShift = 12001; return valid;
      } });
      rejected(await value.client.readServerTime(), 'AuthorityUnavailable');
      assert.equal(verifiedCount, 1);
    } finally {
      if (verifyDescriptor) Object.defineProperty(crypto.subtle, 'verify', verifyDescriptor); else delete crypto.subtle.verify;
      if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor); else delete performance.now;
    }
  });
  for (const [name, mutate] of [
    ['physical-device assertion', receipt => { if (receipt.purpose === 'Authentication') receipt.payload.device.assurance = 'PhysicalDevice'; }],
    ['offline grant injection', receipt => { if (receipt.purpose === 'Authentication') receipt.payload.offlineGrant = { allowed: true }; }],
    ['zero device generation', receipt => { if (receipt.purpose === 'Authentication') receipt.payload.device.generation = 0; }],
  ]) {
    await test('contract rejects ' + name, async () => {
      const value = fixture(); value.setMutation(mutate);
      const reply = await value.client.login(loginRequest); assert.equal(reply.kind, 'Rejected');
      rejected(await value.client.verify(), 'Unauthenticated');
    });
  }
  await test('contract rejects world state through account facts', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest));
    value.setMutation(receipt => { receipt.payload.core = { sections: {} }; });
    rejected(await value.client.readAccountFacts(), 'InvalidData');
  });
  await test('contract rejects current device revoked in facts', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest));
    value.setMutation(receipt => { receipt.payload.devices[0].status = 'Revoked'; });
    rejected(await value.client.readAccountFacts(), 'DeviceUntrusted');
  });
  await test('network failure has no ContractAdapter fallback', async () => {
    const value = fixture(); value.failNetwork(); rejected(await value.client.login(loginRequest), 'AuthorityUnavailable');
    assert.equal(value.client.mode, 'ExternalService'); rejected(await value.client.verify(), 'Unauthenticated');
  });
  await test('failed logout closes local context', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest)); value.failNetwork();
    rejected(await value.client.logout(), 'AuthorityUnavailable'); rejected(await value.client.verify(), 'Unauthenticated');
  });
  await test('concurrent authentication is explicitly rejected', async () => {
    const value = fixture(); value.delay(); const first = value.client.login(loginRequest);
    rejected(await value.client.login(loginRequest), 'Conflict'); accepted(await first);
  });
  await test('trusted pin mismatch rejects login', async () => {
    const value = fixture(); const broken = { ...value.env, authorityTrustAnchor: { ...value.env.authorityTrustAnchor, jwkSha256: token() } };
    const client = RealAuthServiceAdapter.forLoopbackHttpTest(broken, async () => { throw Error('Must not reach transport'); });
    rejected(await client.login(loginRequest), 'InvalidData');
  });
  await test('plain HTTP nonloopback and ContractAdapter configuration rejected', async () => {
    const value = fixture(); assert.throws(() => new RealAuthServiceAdapter({ ...value.env, apiOrigin: 'http://example.com' }));
    assert.throws(() => new RealAuthServiceAdapter({ ...value.env, mode: 'ContractAdapter' }));
  });
  await test('fresh adapter cannot restore cookie session without memory CSRF or device key', async () => {
    const value = fixture(); accepted(await value.client.login(loginRequest)); const fresh = fixture();
    rejected(await fresh.client.verify(), 'Unauthenticated'); rejected(await fresh.client.refresh(), 'Unauthenticated');
  });
}

async function httpChecks() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('HTTP evidence requires Node.js 24 LTS');
  const server = file => import(pathToFileURL(path.join("D:\\Project\\A_New_Begin\\Neurou_official\\quality-review\\b2-5c-2c\\evidence\\history-b-auth\\implementation\\server\\dist\\src", file)).href);
  const [{ buildApp }, { ReceiptSigner }, db] = await Promise.all([server('app.js'), server('crypto.js'), server('db.js')]);
  const connectionPath = process.env.B25_CONNECTION_FILE || path.join(project, 'quality-review/b2-real-auth/evidence/runtime/.local/connection.json');
  const databaseUrl = JSON.parse(fs.readFileSync(connectionPath, 'utf8').replace(/^\uFEFF/, '')).databaseUrl;
  const pool = db.createPool(databaseUrl);
  const pair = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const serviceInstanceId = 'client-http-' + nodeCrypto.randomUUID();
  const signer = new ReceiptSigner(serviceInstanceId, pair.privateKey);
  const origin = 'http://127.0.0.1:43126';
  const config = { databaseUrl, host: '127.0.0.1', port: 43126, origin, serviceInstanceId,
    signingKeyPath: '', clockInitiallyTrusted: true, accessTtlMs: 1500, refreshTtlMs: 604800000, challengeTtlMs: 30000 };
  const app = await buildApp(config, pool, signer);
  try {
    await app.listen({ host: config.host, port: config.port });
    const accountName = 'client_http_' + nodeCrypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const password = token();
    await db.createAccount(pool, accountName, password);
    const jar = new Map(); const requests = [];
    const transport = async (url, init) => {
      const headers = new Headers(init.headers); headers.set('Origin', origin);
      if (jar.size) headers.set('Cookie', [...jar].map(([key, value]) => key + '=' + value).join('; '));
      const response = await fetch(url, { ...init, headers });
      for (const text of response.headers.getSetCookie()) {
        const [name, ...parts] = text.split(';')[0].split('='); const value = parts.join('=');
        if (value) jar.set(name, value); else jar.delete(name);
        assert(/HttpOnly/i.test(text)); assert(/SameSite=Strict/i.test(text));
      }
      requests.push({ method: init.method, path: new URL(url).pathname, status: response.status });
      return response;
    };
    const env = { mode: 'ExternalService', apiOrigin: origin, serviceInstanceId,
      authorityTrustAnchor: { keyId: signer.keyId, publicKeyJwk: signer.jwk, jwkSha256: signer.keyId } };
    const client = RealAuthServiceAdapter.forLoopbackHttpTest(env, transport);
    let context;
    await test('HTTP/PostgreSQL: actual login+device signature and HttpOnly cookies', async () => {
      context = accepted(await client.login({ accountName, password, deviceLabel: 'HTTP registered key' }));
      assert.equal(context.deviceAssurance, 'RegisteredCredential'); assert.equal(jar.size, 2);
    });
    await test('HTTP/PostgreSQL: verify and rotating refresh', async () => {
      accepted(await client.verify()); const oldRefresh = jar.get('neurou_refresh'); accepted(await client.refresh());
      assert.notEqual(jar.get('neurou_refresh'), oldRefresh); accepted(await client.verify());
    });
    await test('HTTP/PostgreSQL: pinned signed server time and account/device facts', async () => {
      const sample = accepted(await client.readServerTime()); assert.equal(sample.payload.clockStatus, 'Trusted');
      assert(sample.payload.serverEpochMs > 0); const facts = accepted(await client.readAccountFacts());
      assert.equal(facts.payload.account.accountId, context.accountId);
      assert(facts.payload.devices.some(device => device.deviceId === context.deviceId));
      assert.equal(facts.payload.revision, 0);
    });
    await test('HTTP/PostgreSQL: expired access denied, live family refresh restores verified session', async () => {
      await new Promise(resolve => setTimeout(resolve, 1600));
      rejected(await client.verify(), 'Unauthenticated'); accepted(await client.refresh()); accepted(await client.verify());
    });
    await test('HTTP/PostgreSQL: logout revokes server family and local context', async () => {
      accepted(await client.logout()); assert.equal(jar.size, 0); rejected(await client.verify(), 'Unauthenticated');
      const rows = await pool.query('SELECT revoked FROM auth_families WHERE session_id=$1', [context.authenticationId]);
      assert.equal(rows.rows[0].revoked, true);
    });
    await test('HTTP/PostgreSQL: closed real HTTP service rejects with no fixture switch', async () => {
      await app.close(); rejected(await client.login({ accountName, password, deviceLabel: 'HTTP registered key' }), 'AuthorityUnavailable');
      assert.equal(client.mode, 'ExternalService');
    });
    fs.writeFileSync(path.join(__dirname, 'http-requests.json'), JSON.stringify({ node: process.version,
      loopbackOrigin: origin, database: 'PostgreSQL 17 (real)', transport: 'actual TCP HTTP with test-only cookie jar', requests }, null, 2) + '\n');
  } finally { await app.close(); await pool.end(); }
}

(async () => {
  await contractChecks();
  if (process.argv.includes('--http')) await httpChecks();
  const output = process.argv.includes('--http') ? 'results-contract-and-http.json' : 'results-contract.json';
  fs.writeFileSync(path.join(__dirname, output), JSON.stringify({ node: process.version, sourceTarget: 'ES2015',
    status: 'PASS', count: records.length, records }, null, 2) + '\n');
  process.stdout.write('PASS ' + records.length + ' client checks\n');
})().catch(failure => { process.stderr.write('FAIL ' + failure.message + '\n'); process.exitCode = 1; });
