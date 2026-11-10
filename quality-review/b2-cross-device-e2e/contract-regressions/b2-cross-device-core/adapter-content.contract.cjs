'use strict';
// ContractAdapter fixtures; actual domain codecs and publication index, not Creator acceptance.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('../b2-state-extensions/state-test-fixture.cjs');
const { CoreTransferCodec, CrossDeviceImportAdapter } = h.load('src/director/CoreTransfer.ts');
const { WorldHomeRegistryCodec } = h.load('src/director/WorldHomeRegistry.ts');
const { createPrimaryWorldStateCodec } = h.load('src/director/PrimaryWorldState.ts');
const { validateCoreTransferContent } = h.load('src/director/CoreTransferContent.ts');
const { WorldHomeContractAdapter } = h.load('src/presentation/WorldHomeContractAdapter.ts');
const { CrossDeviceContractAdapter } = h.load('src/presentation/CrossDeviceContractAdapter.ts');
const manifest = JSON.parse(fs.readFileSync(path.join(h.root, 'assets/resources/chart/content-manifest.json'), 'utf8'));
const worldId = 'world-00000000-0000-4000-8000-000000000010';
const otherId = 'world-00000000-0000-4000-8000-000000000011';
const accountId = 'cross-device-adapter-contract';
const validate = (raw, account, world) => createPrimaryWorldStateCodec(account, world, h.content, h.regular.chartId)
  .parseComplete(raw, account, world);
const codec = new CoreTransferCodec(validate), homeCodec = new WorldHomeRegistryCodec();
const cases = [], failures = [];
async function test(name, callback) {
  try { await callback(); cases.push({ name, pass: true }); }
  catch (error) { cases.push({ name, pass: false, error: String(error), stack: error.stack }); failures.push(name); }
}
function environment(overrides = {}) {
  const home = new WorldHomeContractAdapter({ now: () => h.epochMs,
    validateContext: raw => homeCodec.parseContext(raw), validateRequest: raw => homeCodec.parseRegistrationRequest(raw),
    validateSnapshot: (raw, account) => homeCodec.parseSnapshot(raw, account),
    validateReply: (raw, context, request) => homeCodec.parseRegistrationReply(raw, context, request) });
  const adapter = new CrossDeviceContractAdapter(home, {
    parsePayload: raw => codec.parsePayload(raw), parseProof: (raw, payload) => codec.parseProof(raw, payload),
    parseRegistry: (raw, account) => homeCodec.parseSnapshot(raw, account), parseContext: raw => homeCodec.parseContext(raw),
    digestState: raw => h.chartContentDigest(raw), ...overrides });
  const a = adapter.bindDevice({ accountId, deviceId: 'device-A' }), b = adapter.bindDevice({ accountId, deviceId: 'device-B' });
  const raw = h.fixture({ accountId, worldId }).initial;
  const payload = codec.parsePayload({ schemaVersion: 1, kind: 'RestrictedCoreTransfer', transferId: 'transfer-a',
    sourceDeviceId: 'device-A', sourceHomeRevision: 1, state: raw });
  return { home, adapter, a, b, payload, register: () => a.registerWorldHome({ schemaVersion: 1, worldId, registrationId: 'source-registration' }) };
}
function changePayload(payload) {
  const raw = h.clone(payload); raw.state.capturedAt++; raw.state.revision++;
  return codec.parsePayload(raw);
}
function recertifyChangedRecord(change) {
  const raw = h.clone(h.fixture({ accountId, worldId }).initial), record = raw.sections.ChartSnapshot.records[0];
  change(record);
  record.contentDigest = h.chartContentDigest({ chart: record.chart, layout: record.layout, visual: record.visual,
    media: record.media, guideTransparency: record.guideTransparency });
  raw.sections.ChartScore.records[0].snapshotDigest = record.contentDigest;
  return validate(raw, accountId, worldId);
}
function detector(authority) {
  return new CrossDeviceImportAdapter(authority.context, { authority, validateComplete: validate,
    milestoneReader: { getMilestoneSnapshot: () => ({ accountId, FirstWorldCleared: false, CopyPermission: false }) },
    createWorldId() { throw new Error('detection cannot allocate identity'); },
    createTransactionId() { throw new Error('detection cannot allocate transaction'); },
    createRegistrationId() { throw new Error('detection cannot allocate registration'); },
    now() { throw new Error('detection cannot sample local time'); } });
}
(async () => {
  await test('A export is verified by B through the same ContractAdapter and does not transfer a runtime brand', async () => {
    const f = environment(); await f.register();
    const proof = await f.a.publishTransfer(f.payload), decoded = codec.parseProof(proof, f.payload);
    assert.equal(decoded.sourceDeviceId, 'device-A'); assert.equal(decoded.sourceDigest, h.chartContentDigest(f.payload.state));
    assert.deepEqual(await f.b.verifyTransfer(h.clone(f.payload)), decoded);
    assert.equal(h.load('src/director/WorldStateCodec.ts').isValidatedWorldStateSnapshot(f.payload.state), false);
    assert.equal((await f.b.readRegistry()).records[0].homeDeviceId, 'device-A');
  });
  await test('unpublished payload is rejected even when the source already owns its world', async () => {
    const f = environment(); await f.register(); await assert.rejects(() => f.b.verifyTransfer(f.payload), /发布证明/);
  });
  await test('same transfer identity replays the exact proof and changes no home registry revision', async () => {
    const f = environment(); await f.register(); const before = await f.a.readRegistry();
    const proof = await f.a.publishTransfer(f.payload); assert.deepEqual(await f.a.publishTransfer(h.clone(f.payload)), proof);
    assert.equal((await f.a.readRegistry()).registryRevision, before.registryRevision);
  });
  await test('different data under a published transfer identity is refused and the original remains verifiable', async () => {
    const f = environment(); await f.register(); await f.a.publishTransfer(f.payload);
    await assert.rejects(() => f.a.publishTransfer(changePayload(f.payload)), /标识已经绑定/);
    await assert.rejects(() => f.b.verifyTransfer(changePayload(f.payload)), /不匹配/);
    await f.b.verifyTransfer(f.payload);
  });
  await test('concurrent conflicting publications retain exactly one payload', async () => {
    const f = environment(); await f.register(); const changed = changePayload(f.payload);
    const results = await Promise.allSettled([f.a.publishTransfer(f.payload), f.a.publishTransfer(changed)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const verifies = await Promise.allSettled([f.b.verifyTransfer(f.payload), f.b.verifyTransfer(changed)]);
    assert.equal(verifies.filter(result => result.status === 'fulfilled').length, 1);
  });
  await test('B cannot publish a payload claiming A as its source', async () => {
    const f = environment(); await f.register(); await assert.rejects(() => f.b.publishTransfer(f.payload), /绑定的来源设备/);
    await assert.rejects(() => f.b.verifyTransfer(f.payload), /发布证明/);
  });
  await test('a device cannot self-identify as the source unless it is the current HomeDevice', async () => {
    const f = environment(); await f.register(); const spoof = h.clone(f.payload); spoof.sourceDeviceId = 'device-B';
    await assert.rejects(() => f.b.publishTransfer(spoof), /权威归属/);
  });
  await test('other accounts cannot publish or verify an account export', async () => {
    const f = environment(); await f.register(); await f.a.publishTransfer(f.payload);
    const other = f.adapter.bindDevice({ accountId: 'other-account', deviceId: 'device-A' });
    await assert.rejects(() => other.publishTransfer(f.payload), /账号与绑定会话/);
    await assert.rejects(() => other.verifyTransfer(f.payload), /账号与绑定会话/);
  });
  await test('unknown source ownership refuses export and never creates its home record', async () => {
    const f = environment(); await assert.rejects(() => f.a.publishTransfer(f.payload), /权威归属/);
    assert.deepEqual((await f.a.readRegistry()).records, []);
  });
  await test('unavailable home service refuses export and current-home detection; historic proof alone cannot authorize import', async () => {
    const f = environment(); await f.register(); await f.a.publishTransfer(f.payload); f.home.setAvailable(false);
    await assert.rejects(() => f.a.publishTransfer(f.payload), /不可用/);
    await f.b.verifyTransfer(f.payload);
    assert.equal((await detector(f.b).detectCrossDeviceDuplicate(f.payload)).kind, 'AuthorityUnavailable');
    f.home.setAvailable(true); await f.b.verifyTransfer(f.payload);
  });
  await test('historic export proof survives Released and the director returns Released without claiming or copying', async () => {
    const f = environment(); await f.register(); await f.a.publishTransfer(f.payload);
    const snapshot = h.clone(await f.b.readRegistry()); snapshot.registryRevision = 2;
    snapshot.records[0].homeState = 'Released'; snapshot.records[0].homeDeviceId = null; snapshot.records[0].homeRevision = 2;
    const port = { ...f.b, readRegistry: async () => snapshot };
    await port.verifyTransfer(f.payload);
    assert.equal((await detector(port).detectCrossDeviceDuplicate(f.payload)).kind, 'Released');
  });
  await test('historic export proof survives revision-two ownership and c refuses to guess Migrated', async () => {
    const f = environment(); await f.register(); await f.a.publishTransfer(f.payload);
    const snapshot = h.clone(await f.b.readRegistry()); snapshot.registryRevision = 2;
    snapshot.records[0].homeRevision = 2; snapshot.records[0].homeDeviceId = 'device-B';
    const port = { ...f.b, readRegistry: async () => snapshot };
    await port.verifyTransfer(f.payload);
    assert.equal((await detector(port).detectCrossDeviceDuplicate(f.payload)).kind, 'UnsupportedBoundary');
  });
  await test('InitialWorld is refused before authority reads', async () => {
    let reads = 0; const f = environment({ parsePayload: raw => raw });
    const adapter = new CrossDeviceContractAdapter({ bindDevice: context => ({ mode: 'ContractAdapter', context,
      readRegistry: async () => { reads++; return {}; }, registerWorldHome: async () => {} }) }, {
      parsePayload: raw => raw, parseProof: (raw, payload) => codec.parseProof(raw, payload),
      parseRegistry: (raw, account) => homeCodec.parseSnapshot(raw, account), parseContext: raw => homeCodec.parseContext(raw),
      digestState: h.chartContentDigest });
    const port = adapter.bindDevice({ accountId, deviceId: 'device-A' }), initial = h.clone(f.payload); initial.state.worldId = 'InitialWorld';
    await assert.rejects(() => port.publishTransfer(initial), /InitialWorld/); assert.equal(reads, 0);
  });
  await test('invalid digest or output proof failure publishes no transfer entry', async () => {
    let digestValid = false; const f = environment({ digestState: raw => digestValid ? h.chartContentDigest(raw) : 'invalid' });
    await f.register(); await assert.rejects(() => f.a.publishTransfer(f.payload), /SHA256/);
    await assert.rejects(() => f.b.verifyTransfer(f.payload), /发布证明/); digestValid = true; await f.a.publishTransfer(f.payload);
    let parses = 0; const g = environment({ parseProof: (raw, payload) => {
      parses++; if (parses === 2) { throw new Error('injected response failure'); } return codec.parseProof(raw, payload);
    } });
    await g.register(); await assert.rejects(() => g.a.publishTransfer(g.payload), /response failure/);
    await assert.rejects(() => g.b.verifyTransfer(g.payload), /发布证明/); await g.a.publishTransfer(g.payload); await g.b.verifyTransfer(g.payload);
  });
  await test('source world identity cannot be substituted under an existing transfer proof', async () => {
    const f = environment(); await f.register(); await f.a.publishTransfer(f.payload);
    const other = codec.parsePayload({ ...f.payload, state: h.fixture({ accountId, worldId: otherId }).initial });
    await assert.rejects(() => f.b.verifyTransfer(other), /不匹配/);
  });
  await test('actual published seven-section Complete content passes the additional manifest boundary', () => {
    const state = validate(h.fixture({ accountId, worldId }).initial, accountId, worldId);
    validateCoreTransferContent(state, manifest);
  });
  await test('plain JSON clone does not pass the receiving-process Complete requirement', () => {
    const state = validate(h.fixture({ accountId, worldId }).initial, accountId, worldId);
    assert.throws(() => validateCoreTransferContent(h.clone(state), manifest), /parseComplete/);
  });
  await test('self-consistent modified chart content passes graph decoding but fails published identity', () => {
    const state = recertifyChangedRecord(record => { record.chart.lines[0].timing[record.chart.lines[0].timing.length - 1].targetTimeMs++; });
    assert.throws(() => validateCoreTransferContent(state, manifest), /谱面或视觉/);
  });
  await test('self-consistent modified visual content fails the official visual digest', () => {
    const state = recertifyChangedRecord(record => { record.visual.nodes[0].color.r = (record.visual.nodes[0].color.r + 1) % 256; });
    assert.throws(() => validateCoreTransferContent(state, manifest), /谱面或视觉/);
  });
  await test('self-consistent modified media descriptor fails the official media identity', () => {
    const state = recertifyChangedRecord(record => { record.media.contentRevision = 'unpublished-revision'; });
    assert.throws(() => validateCoreTransferContent(state, manifest), /媒体引用/);
  });
  await test('missing or malformed publication index is refused rather than reconstructing historic content', () => {
    const state = validate(h.fixture({ accountId, worldId }).initial, accountId, worldId), missing = h.clone(manifest);
    missing.charts = missing.charts.filter(value => value.chartId !== state.sections.ChartSnapshot.records[0].chartId);
    assert.throws(() => validateCoreTransferContent(state, missing), /正式发布内容/);
    assert.throws(() => validateCoreTransferContent(state, { ...manifest, extra: true }), /字段/);
  });
  await test('unfinished lawful Complete with empty premiere archives preserves its empty history', () => {
    const state = validate(h.fixture({ accountId, worldId, completed: false }).initial, accountId, worldId);
    assert.equal(state.sections.ChartSnapshot.records.length, 0); validateCoreTransferContent(state, manifest);
  });
  const result = { mode: 'ContractAdapter', pass: failures.length === 0, total: cases.length,
    passed: cases.length - failures.length, failures, cases, generatedAt: new Date().toISOString(),
    note: 'Actual CoreTransfer/Primary/home codecs and publication index with shared in-memory ContractAdapter; fixtures are not Creator or physical-device evidence.' };
  fs.writeFileSync(path.join(__dirname, 'adapter-content.contract-results.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ pass: result.pass, total: result.total, passed: result.passed, failures }) + '\n');
  if (!result.pass) { process.exitCode = 1; }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
