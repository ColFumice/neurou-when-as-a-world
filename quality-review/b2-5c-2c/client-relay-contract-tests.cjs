'use strict';
// Contract transport oracle and native cryptography / durable file capability evidence.
// This is not real HTTP / PostgreSQL or the c-2e two-client production replay.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const workspace = path.resolve(__dirname, '../..');
const compiled = path.join(__dirname, 'evidence', 'client-relay-compiled');
const runs = path.join(__dirname, 'evidence', 'client-relay-contract');
fs.mkdirSync(runs, { recursive: true });
for (const relative of ['src/director/SharedCanonicalBytes.ts', 'src/director/SharedCommitCodec.ts',
  'src/director/SharedCommitValidator.ts', 'src/director/SharedServiceProtocolCodec.ts',
  'src/presentation/RealCommitRelayAdapter.ts']) {
  const output = path.join(compiled, relative.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, ts.transpileModule(fs.readFileSync(path.join(workspace, relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
  }).outputText);
}
const { SharedServiceProtocolCodec: codec } = require(path.join(compiled, 'src/director/SharedServiceProtocolCodec.js'));
const { SharedCommitValidator } = require(path.join(compiled, 'src/director/SharedCommitValidator.js'));
const { RealCommitRelayAdapter } = require(path.join(compiled, 'src/presentation/RealCommitRelayAdapter.js'));
const { createFixture, cryptoPort, clone, jcs, bytes } = require('../b2-5c-1/evidence/fixtures.cjs');
const results = [];
const nonce = () => crypto.randomBytes(32).toString('base64url');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const sameIdentity = (a, b) => jcs(a) === jcs(b);
async function check(label, action) {
  try { await action(); results.push({ label, passed: true }); console.log('PASS ' + label); }
  catch (error) { results.push({ label, passed: false, error: String(error.stack || error) }); throw error; }
}
function setup(options = {}) {
  const f = createFixture();
  const wire = options.wire ? options.wire(f) : f.makeAdmitted(f.reveal());
  const actor = f.actors.developer;
  const context = { mode: 'ExternalService', accountId: actor.accountId, accountName: 'relay.contract',
    deviceId: actor.deviceId, deviceGeneration: 1, authenticationId: crypto.randomUUID(),
    expiresAtServerEpochMs: Date.now() + 60000, assurance: 'RegisteredCredential' };
  const calls = [], events = [], signed = [];
  const folder = path.join(runs, crypto.randomUUID()); fs.mkdirSync(folder);
  const cacheFile = path.join(folder, 'ciphertext.json');
  fs.writeFileSync(cacheFile, jcs(wire));
  let reads = 0;
  const cache = {
    async read(identity) {
      reads += 1; events.push('read-' + reads);
      if (options.missingSource || (options.missingReadBack && reads > 1)) { return null; }
      const value = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (!sameIdentity(identity, value.admissionClaim.claim.header.identity)) { return null; }
      if (options.changedReadBack && reads > 1) { value.admissionReceipt.receiptId = crypto.randomUUID(); }
      if (options.logoutAfterRead) { session.context = null; }
      return value;
    },
    async persistAndVerify(value) {
      events.push('persist');
      if (options.cacheThrows) { throw Error('durable host failed'); }
      const temporary = cacheFile + '.pending';
      const descriptor = fs.openSync(temporary, 'wx');
      try { fs.writeSync(descriptor, jcs(value)); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, cacheFile);
      const readBack = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      return { envelopeSha256: options.lieSha ? '0'.repeat(64)
        : digest(Buffer.from(readBack.envelopeBytesBase64Url, 'base64url')) };
    },
  };
  const validator = new SharedCommitValidator(options.cryptoPort || cryptoPort,
    { ...f.context, ...(options.noKey ? { lookupWorldRelayKey: async () => null } : {}) });
  const session = {
    context,
    currentContext() { return this.context; }, createRequestNonce: nonce,
    async request(operation, requestNonce, payload) {
      calls.push({ operation, requestNonce, payload: clone(payload) }); events.push('request');
      if (options.transportThrows) { throw Error('network down'); }
      if (options.sessionTransportFault) {
        return { kind: 'Rejected', fault: { code: 'AuthorityUnavailable', layer: 'Session', detail: 'ServiceUnavailable',
          requestId: nonce(), requestNonce, retryAfterMs: null } };
      }
      let purpose, value;
      if (operation === '/relay/submit') {
        purpose = 'RelaySubmit';
        value = { worldId: wire.admissionClaim.claim.header.worldId,
          identity: wire.admissionClaim.claim.header.identity,
          envelopeSha256: wire.admissionClaim.claim.envelopeSha256,
          cursor: { relayGeneration: 1, position: '1' },
          admittedAtServerEpochMs: wire.admissionReceipt.payload.admittedAtServerEpochMs,
          retainedUntilServerEpochMs: wire.admissionReceipt.payload.admittedAtServerEpochMs + 86400000 };
        if (options.wrongFact) { value.envelopeSha256 = '0'.repeat(64); }
      } else if (operation === '/relay/pull') {
        purpose = 'RelayPull';
        value = options.gap ? { kind: 'Gap', worldId: payload.worldId, after: payload.after,
          retentionFloor: { relayGeneration: 1, position: '0' }, reason: options.gap }
          : { kind: 'Batch', worldId: payload.worldId, after: payload.after,
            next: payload.after, commits: [], retentionFloor: { relayGeneration: 1, position: '0' } };
        if (options.wrongWorld) { value.worldId = crypto.randomUUID(); }
        if (options.emptyAdvance) { value.next = { relayGeneration: 1, position: '1' }; }
        if (options.nonemptyBatch) {
          value.commits = [wire];
          value.next = { relayGeneration: payload.after.relayGeneration,
            position: options.wrongBatchAdvance ? String(BigInt(payload.after.position) + 2n)
              : String(BigInt(payload.after.position) + 1n) };
        }
      } else if (operation === '/relay/ack') {
        purpose = 'RelayAck';
        value = { worldId: payload.worldId, relayGeneration: payload.relayGeneration,
          accountId: context.accountId, deviceId: context.deviceId, deviceGeneration: context.deviceGeneration,
          entriesSha256: digest(jcs(payload.entries)), acknowledgedCount: payload.entries.length };
        if (options.wrongFact) { value.acknowledgedCount = 0; }
      } else { throw Error(operation); }
      return { kind: 'Accepted', value: { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId,
        purpose, receiptId: crypto.randomUUID(), keyId: nonce(), requestNonce, payload: value,
        signatureBase64Url: crypto.randomBytes(64).toString('base64url') } };
    },
  };
  const signer = { async signRelayAck(requestNonce, ack) {
    events.push('sign'); signed.push({ requestNonce, ack: clone(ack) });
    if (options.signerThrows) { throw Error('registered credential unavailable'); }
    return crypto.randomBytes(64).toString('base64url');
  } };
  const capability = options.forgedCapability ? {
    validateCommit: async value => ({ kind: 'Verified', value: { wire: value,
      envelopeBytesBase64Url: value.envelopeBytesBase64Url, identity: value.admissionClaim.claim.header.identity,
      envelopeSha256: value.admissionClaim.claim.envelopeSha256 } }), ownsCommit: () => false,
  } : validator;
  const adapter = new RealCommitRelayAdapter(session, signer, codec, capability, cache);
  const ack = { worldId: wire.admissionClaim.claim.header.worldId, relayGeneration: 1,
    entries: [{ position: '1', identity: wire.admissionClaim.claim.header.identity,
      envelopeSha256: wire.admissionClaim.claim.envelopeSha256 }], authorDeviceId: context.deviceId,
    authorDeviceGeneration: context.deviceGeneration, deviceSignatureBase64Url: crypto.randomBytes(64).toString('base64url') };
  return { f, wire, validator, context, session, adapter, ack, calls, events, signed, cacheFile };
}
async function main() {
  await check('mode ExternalService and relay use exactly submit path', async () => {
    const s = setup(); assert.equal(s.adapter.mode, 'ExternalService');
    assert.equal((await s.adapter.submit(s.wire)).kind, 'Accepted');
    assert.equal((await s.adapter.relay(s.wire)).kind, 'Accepted');
    assert.deepEqual(s.calls.map(call => call.operation), ['/relay/submit', '/relay/submit']);
  });
  await check('submit binds server fact to original identity/digest/admission', async () => {
    const s = setup({ wrongFact: true }); assert.equal((await s.adapter.submit(s.wire)).fault.detail, 'SchemaInvalid');
  });
  await check('submit rejects additional fields before HTTP capability', async () => {
    const s = setup(); assert.equal((await s.adapter.submit({ ...s.wire, unexpected: true })).kind, 'Rejected');
    assert.equal(s.calls.length, 0);
  });
  await check('pull freezes defaults and preserves empty cursor without claiming completeness', async () => {
    const s = setup(); const reply = await s.adapter.pull(s.ack.worldId, { relayGeneration: 1, position: '0' });
    assert.equal(reply.kind, 'Accepted'); assert.equal(reply.value.payload.commits.length, 0);
    assert.equal(s.calls[0].payload.maximumCount, 128); assert.equal(s.calls[0].payload.maximumWaitMs, 25000);
  });
  for (const gap of ['RetentionExpired', 'RelayGenerationChanged', 'MissingAdmittedEnvelope']) {
    await check('pull retains signed Gap ' + gap + ' and original after', async () => {
      const s = setup({ gap }), after = { relayGeneration: 1, position: '0' };
      const reply = await s.adapter.pull(s.ack.worldId, after, 256, 0);
      assert.equal(reply.kind, 'Accepted'); assert.equal(reply.value.payload.reason, gap);
      assert.equal(jcs(reply.value.payload.after), jcs(after)); assert.equal(s.signed.length, 0);
    });
  }
  for (const options of [{ wrongWorld: true }, { emptyAdvance: true }]) {
    await check('pull rejects inconsistent signed batch ' + Object.keys(options)[0], async () => {
      const s = setup(options); assert.equal((await s.adapter.pull(s.ack.worldId, { relayGeneration: 1, position: '0' })).kind, 'Rejected');
    });
  }
  await check('nonempty signed batch next is exactly after+count without Number cursor truncation', async () => {
    const s = setup({ nonemptyBatch: true });
    const after = { relayGeneration: 1, position: '18446744073709551614' };
    const reply = await s.adapter.pull(s.ack.worldId, after);
    assert.equal(reply.kind, 'Accepted'); assert.equal(reply.value.payload.next.position, '18446744073709551615');
  });
  await check('nonempty signed batch cannot skip an unseen cursor position', async () => {
    const s = setup({ nonemptyBatch: true, wrongBatchAdvance: true });
    const reply = await s.adapter.pull(s.ack.worldId, { relayGeneration: 1, position: '9007199254740992' });
    assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.detail, 'SchemaInvalid');
  });
  for (const [count, wait] of [[0, 0], [257, 0], [128, -1], [128, 25001]]) {
    await check('pull limits reject ' + count + '/' + wait + ' before transport', async () => {
      const s = setup(); assert.equal((await s.adapter.pull(s.ack.worldId, { relayGeneration: 1, position: '0' }, count, wait)).kind, 'Rejected');
      assert.equal(s.calls.length, 0);
    });
  }
  await check('full c-1 native validator plus atomic fsync/rename exact readback precedes fresh-nonce ACK', async () => {
    const s = setup(); const reply = await s.adapter.acknowledge(s.ack);
    assert.equal(reply.kind, 'Accepted', JSON.stringify(reply));
    assert.deepEqual(s.events, ['read-1', 'persist', 'read-2', 'sign', 'request']);
    assert.equal(s.signed.length, 1); assert.equal(s.calls[0].requestNonce, s.signed[0].requestNonce);
    assert.notEqual(s.calls[0].payload.deviceSignatureBase64Url, s.ack.deviceSignatureBase64Url);
    assert.equal(jcs(JSON.parse(fs.readFileSync(s.cacheFile, 'utf8'))), jcs(s.wire));
  });
  await check('complete provenance technical InvalidChange bytes may be durably ACKed', async () => {
    const s = setup({ wire: f => f.makeAdmitted(f.reveal(), { envelopeBytes: bytes('{"header":null}') }) });
    const validated = await s.validator.validateCommit(s.wire);
    assert.equal(validated.kind, 'Verified'); assert.equal(validated.value.invalid, true);
    assert.equal((await s.adapter.acknowledge(s.ack)).kind, 'Accepted');
  });
  for (const [options, detail] of [
    [{ missingSource: true }, 'FactUnavailable'], [{ noKey: true }, 'FactUnavailable'],
    [{ cryptoPort: { ...cryptoPort, sha256: async () => { throw Error('crypto offline'); } } }, 'RelayUnavailable'],
    [{ forgedCapability: true }, 'SchemaInvalid'], [{ cacheThrows: true }, 'RelayUnavailable'],
    [{ lieSha: true }, 'SchemaInvalid'], [{ changedReadBack: true }, 'SchemaInvalid'],
    [{ missingReadBack: true }, 'SchemaInvalid'], [{ signerThrows: true }, 'RelayUnavailable'],
    [{ logoutAfterRead: true }, 'SessionMissing'],
  ]) {
    await check('unsafe ACK ' + Object.keys(options)[0] + ' stops before network', async () => {
      const s = setup(options), reply = await s.adapter.acknowledge(s.ack);
      assert.equal(reply.kind, 'Rejected'); assert.equal(reply.fault.detail, detail); assert.equal(s.calls.length, 0);
      if (!options.signerThrows) { assert.equal(s.signed.length, 0); }
    });
  }
  await check('missing source receipts are Gap and never become persisted/ACKed facts', async () => {
    const s = setup({ wire: f => { const wire = f.makeAdmitted(f.reveal()); wire.admissionReceipt.signatureBase64Url = crypto.randomBytes(64).toString('base64url'); return wire; } });
    const reply = await s.adapter.acknowledge(s.ack); assert.equal(reply.fault.detail, 'FactUnavailable');
    assert.deepEqual(s.events, ['read-1']); assert.equal(s.calls.length, 0);
  });
  await check('ACK device binding rejected before cache or signing', async () => {
    const s = setup(); const reply = await s.adapter.acknowledge({ ...s.ack, authorDeviceId: crypto.randomUUID() });
    assert.equal(reply.fault.detail, 'CredentialMismatch'); assert.equal(s.events.length, 0);
  });
  await check('ACK wrong receipt count rejected after transport without fake success', async () => {
    const s = setup({ wrongFact: true }); assert.equal((await s.adapter.acknowledge(s.ack)).fault.detail, 'SchemaInvalid');
  });
  await check('network failure stays a local Relay rejection and leaves auth context intact', async () => {
    const s = setup({ transportThrows: true }); const reply = await s.adapter.submit(s.wire);
    assert.equal(reply.fault.layer, 'Relay'); assert.equal(reply.fault.detail, 'RelayUnavailable');
    assert.equal(s.session.currentContext(), s.context);
  });
  await check('real owner local timeout fault is attributed to Relay and leaves auth context intact', async () => {
    const s = setup({ sessionTransportFault: true }); const reply = await s.adapter.submit(s.wire);
    assert.equal(reply.fault.layer, 'Relay'); assert.equal(reply.fault.detail, 'RelayUnavailable');
    assert.equal(s.session.currentContext(), s.context);
  });
}
main().then(() => {
  const evidence = { kind: 'ContractOracle', passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length, realHttp: false, realPostgreSQL: false,
    actualSharedCommitValidator: true, nativeCrypto: true, testOnlyAtomicCipherCache: true, results };
  fs.writeFileSync(path.join(runs, 'results.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, results: undefined }));
}).catch(error => { fs.writeFileSync(path.join(runs, 'results.json'), JSON.stringify({ results, error: String(error.stack || error) }, null, 2)); console.error(error); process.exitCode = 1; });
