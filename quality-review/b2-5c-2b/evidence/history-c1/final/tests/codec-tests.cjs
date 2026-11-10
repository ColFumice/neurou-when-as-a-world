'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SharedCanonicalBytes: canonical, SharedSchemaError } = require('../evidence/build/SharedCanonicalBytes.js');
const { SharedCommitCodec } = require('../evidence/build/SharedCommitCodec.js');
const { sampleSchemaValues, clone, createFixture, bytes, jcs } = require('../evidence/fixtures.cjs');
const codec = new SharedCommitCodec();

function rejects(action, code) {
  assert.throws(action, error => error instanceof SharedSchemaError && (!code || error.code === code));
}
function frozenTree(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    for (const name of Object.keys(value)) frozenTree(value[name]);
  }
}

test('canonical decode rejects duplicate and escaped duplicate JSON keys', () => {
  for (const raw of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"outer":{"a":1,"a":1}}']) {
    rejects(() => canonical.decode(bytes(raw)), 'CanonicalInvalid');
  }
});

test('canonical decode rejects alternate JSON spellings and trailing input', () => {
  for (const raw of [' {"a":1}', '{"a":1}\n', '{"b":1,"a":2}', '{"a":1.0}', '{"a":1e0}',
    '{"a":"\\u0061"}', '{"a":"\\/"}', '{}{}', '{"a":1,}', '[1,]', '01', '-0', '9007199254740993']) {
    rejects(() => canonical.decode(bytes(raw)), 'CanonicalInvalid');
  }
});

test('strict UTF8 rejects BOM, truncation, overlong, surrogate and out of range encodings', () => {
  for (const raw of [[0xef,0xbb,0xbf,0x7b,0x7d], [0xc0,0xaf], [0xc2], [0xe0,0x80,0x80],
    [0xed,0xa0,0x80], [0xf4,0x90,0x80,0x80], [0x80], [0xf5,0x80,0x80,0x80], [0xc2,0x41]]) {
    rejects(() => canonical.text(new Uint8Array(raw)), 'CanonicalInvalid');
  }
});

test('UTF8 agrees with independent Node encoding across scalar ranges', () => {
  for (const text of ['', '\u0000', '\u007f\u0080\u07ff\u0800', '\ud7ff\ue000\uffff', '中文雨若', '😀\u{10ffff}', 'x\ufeffy']) {
    const encoded = canonical.utf8(text);
    assert.deepEqual(Array.from(encoded), Array.from(Buffer.from(text, 'utf8')));
    assert.equal(canonical.text(encoded), text);
  }
});

test('object descriptor validation never invokes accessors', () => {
  let invoked = 0;
  const object = { get a() { invoked += 1; return 1; } };
  rejects(() => canonical.encode(object), 'CanonicalInvalid');
  assert.equal(invoked, 0);
  const list = [1];
  Object.defineProperty(list, '0', { enumerable: true, get() { invoked += 1; return 1; } });
  rejects(() => canonical.encode(list), 'CanonicalInvalid');
  assert.equal(invoked, 0);
});

test('canonical objects reject symbols, hidden properties and foreign prototypes', () => {
  const symbol = { a: 1, [Symbol('x')]: 2 };
  const hidden = { a: 1 }; Object.defineProperty(hidden, 'hidden', { value: 2 });
  const inherited = Object.assign(Object.create({ inherited: true }), { a: 1 });
  for (const object of [symbol, hidden, inherited, new Date(), new Map(), new Uint8Array([1])]) {
    rejects(() => canonical.encode(object), 'CanonicalInvalid');
  }
  assert.equal(canonical.text(canonical.encode(Object.assign(Object.create(null), { a: 1 }))), '{"a":1}');
});

test('canonical arrays reject holes, properties, symbols and custom prototypes', () => {
  const hole = new Array(2); hole[1] = 1;
  const extra = [1]; extra.x = 2;
  const hidden = [1]; Object.defineProperty(hidden, 'x', { value: 2 });
  const symbol = [1]; symbol[Symbol('x')] = 2;
  const inherited = [1]; Object.setPrototypeOf(inherited, Object.create(Array.prototype));
  for (const list of [hole, extra, hidden, symbol, inherited]) rejects(() => canonical.encode(list), 'CanonicalInvalid');
});

test('canonical data rejects cycles, invalid Unicode and unsupported number types', () => {
  const cycle = {}; cycle.self = cycle;
  for (const value of [cycle, '\ud800', '\udfff', { '\ud800': 1 }, -0, NaN, Infinity, 0.5,
    Number.MAX_SAFE_INTEGER + 1, undefined, () => 1, BigInt(1)]) rejects(() => canonical.encode(value), 'CanonicalInvalid');
  rejects(() => canonical.decode(bytes('"\\ud800"')), 'CanonicalInvalid');
});

test('canonical nesting safety rejects unbounded hostile data', () => {
  let value = null; for (let index = 0; index < 130; index += 1) value = [value];
  rejects(() => canonical.encode(value), 'LimitExceeded');
  rejects(() => canonical.decode(bytes('['.repeat(130) + 'null' + ']'.repeat(130))), 'LimitExceeded');
});

test('JCS UTF16 key order and integer subset known vector', () => {
  const value = { '\u20ac': 'Euro Sign', '\r': 'Carriage Return', '\ufb33': 'Hebrew Letter Dalet With Dagesh',
    '1': 'One', '\ud83d\ude00': 'Emoji: Grinning Face', '\u0080': 'Control', '\u00f6': 'Latin Small Letter O With Diaeresis' };
  const text = canonical.text(canonical.encode(value));
  const keys = Object.keys(JSON.parse(text));
  // Integer-like keys enumerate specially after parsing; inspect serialized order independently.
  const orderedKeys = [...text.matchAll(/"((?:[^"\\]|\\.)*)":/g)].map(match => JSON.parse('"' + match[1] + '"'));
  assert.deepEqual(orderedKeys, ['\r', '1', '\u0080', '\u00f6', '\u20ac', '😀', '\ufb33']);
  assert.equal(keys.length, 7);
  assert.equal(canonical.text(canonical.encode({ z: 9007199254740991, a: [-9007199254740991, 0, true, null] })),
    '{"a":[-9007199254740991,0,true,null],"z":9007199254740991}');
});

test('canonical base64url matches independent byte oracle and rejects alternate tails', () => {
  for (let length = 0; length <= 130; length += 1) {
    const buffer = Uint8Array.from({ length }, (_, index) => (index * 37 + length) & 255);
    const encoded = Buffer.from(buffer).toString('base64url');
    assert.equal(canonical.base64UrlEncode(buffer), encoded);
    assert.deepEqual(Array.from(canonical.base64UrlDecode(encoded, length)), Array.from(buffer));
  }
  for (const [raw, expected] of [['', ''], ['f', 'Zg'], ['fo', 'Zm8'], ['foo', 'Zm9v'], ['foobar', 'Zm9vYmFy']]) {
    assert.equal(canonical.base64UrlEncode(bytes(raw)), expected);
  }
  for (const malformed of ['A', 'AA=', 'AA==', '+w', '/w', 'AB', '__', ' A', 'AA\n']) {
    rejects(() => canonical.base64UrlDecode(malformed), 'CanonicalInvalid');
  }
  rejects(() => canonical.base64UrlDecode('AA', 2), 'CanonicalInvalid');
});

test('domain bytes retain NUL separator and byte comparison is exact', () => {
  const domain = canonical.domain('Neurou/test/v1\0', { z: 1, a: 2 });
  assert.deepEqual(Array.from(domain), Array.from(Buffer.from('Neurou/test/v1\0{"a":2,"z":1}', 'utf8')));
  assert.equal(canonical.equalBytes(domain, Uint8Array.from(domain)), true);
  assert.equal(canonical.equalBytes(domain, domain.slice(1)), false);
  const changed = Uint8Array.from(domain); changed[0] ^= 1;
  assert.equal(canonical.equalBytes(domain, changed), false);
});

const samples = sampleSchemaValues();
for (const [kind, sample] of Object.entries(samples)) {
  test('schema roundtrip and immutable copy: ' + kind, () => {
    const normalized = codec.validate(kind, sample);
    frozenTree(normalized);
    assert.deepEqual(JSON.parse(JSON.stringify(normalized)), sample);
    const encoded = codec.encode(kind, sample);
    assert.deepEqual(Array.from(encoded), Array.from(bytes(jcs(sample))));
    const decoded = codec.decode(kind, encoded);
    frozenTree(decoded);
    assert.deepEqual(JSON.parse(JSON.stringify(decoded)), sample);
    if (sample && typeof sample === 'object') assert.notEqual(normalized, sample);
  });
}

test('exact schema rejects extra and missing fields without broad compatibility', () => {
  const extra = { ...samples.WorldCommitIdentity, authorDeviceId: samples.WorldAppendPermit.authorDeviceId };
  rejects(() => codec.validate('WorldCommitIdentity', extra), 'SchemaInvalid');
  rejects(() => codec.validate('WorldCommitIdentity', { authorAccountId: extra.authorAccountId }), 'SchemaInvalid');
  rejects(() => codec.validate('UnknownSchema', {}), 'SchemaInvalid');
  rejects(() => codec.validate('WorldCommitIdentity', { ...samples.WorldCommitIdentity, authorSequence: 0 }), 'ValueInvalid');
  rejects(() => codec.validate('WorldCommitIdentity', { ...samples.WorldCommitIdentity, authorAccountId: extra.authorAccountId.toUpperCase().replace('4000', 'ABCD') }), 'ValueInvalid');
});

test('sequence, permit and settlement exact boundaries reject incoherent facts', () => {
  const segment = clone(samples.AuthorSequenceSegment); segment.lastSequence -= 1;
  rejects(() => codec.validate('AuthorSequenceSegment', segment), 'InvariantInvalid');
  const permit = clone(samples.WorldAppendPermit); permit.expiresAtServerEpochMs += 1;
  rejects(() => codec.validate('WorldAppendPermit', permit), 'InvariantInvalid');
  const policy = clone(samples.SharedSettlementPolicy); policy.retentionMs = policy.settleHorizonMs - 1;
  rejects(() => codec.validate('SharedSettlementPolicy', policy), 'InvariantInvalid');
  const header = clone(samples.RelayCommitHeader); header.commitClass = 'RestrictedWrite';
  rejects(() => codec.validate('RelayCommitHeader', header), 'InvariantInvalid');
});

test('touch count uses exact uint128 and independently saturates rendering', () => {
  const base = clone(samples.TraceTouchAggregate);
  assert.equal(codec.validate('TraceTouchAggregate', { ...base, totalTouchUnits: '340282366920938463463374607431768211455', aggregateStrength: 65535 }).aggregateStrength, 65535);
  rejects(() => codec.validate('TraceTouchAggregate', { ...base, totalTouchUnits: '340282366920938463463374607431768211456', aggregateStrength: 65535 }), 'ValueInvalid');
  rejects(() => codec.validate('TraceTouchAggregate', { ...base, totalTouchUnits: '01' }), 'ValueInvalid');
  rejects(() => codec.validate('TraceTouchAggregate', { ...base, totalTouchUnits: '65536', aggregateStrength: 1 }), 'InvariantInvalid');
});

test('sorted state and coverage preserve exact identities rather than max sequence', () => {
  const state = clone(samples.SharedWorldState); state.entities.reverse();
  rejects(() => codec.validate('SharedWorldState', state), 'InvariantInvalid');
  const checkpoint = clone(samples.WorldCheckpointWire); checkpoint.coverage.push(clone(checkpoint.coverage[0]));
  checkpoint.settlementSeal.payload.admittedCommitCount += 1;
  rejects(() => codec.validate('WorldCheckpointWire', checkpoint), 'InvariantInvalid');
  const mismatch = clone(samples.WorldCheckpointWire); mismatch.coveredThroughEpochMs += 1;
  rejects(() => codec.validate('WorldCheckpointWire', mismatch), 'InvariantInvalid');
});

test('single-object map operations reject old atomic edit arrays and target mismatch', () => {
  const f = createFixture();
  const change = f.mapEdit({ operation: 'ReplaceEntity', target: { kind: 'Entity', entityId: f.ids.entityA }, definition: clone(f.genesis.initialState.entities[2].definition) });
  const old = clone(change); old.edits = [old.edit]; delete old.edit;
  rejects(() => codec.validate('MapEditCommitChange', old), 'SchemaInvalid');
  const operation = clone(change.edit); operation.definition.entityId = f.ids.entityB;
  rejects(() => codec.validate('MapEditOperation', operation), 'InvariantInvalid');
});

test('receipt purpose, identity, accepted-time and key bindings remain distinct', () => {
  const receipt = clone(samples.SharedAuthorityReceipt); receipt.purpose = 'Authentication';
  rejects(() => codec.validate('SharedAuthorityReceipt', receipt), 'ValueInvalid');
  const wrongKey = clone(samples.WorldDeveloperTrustAnchor); wrongKey.developerSigningKeyId = canonical.base64UrlEncode(new Uint8Array(32));
  if (wrongKey.developerSigningKeyId !== wrongKey.developerPublicKeyFingerprint) rejects(() => codec.validate('WorldDeveloperTrustAnchor', wrongKey), 'InvariantInvalid');
  const wire = clone(samples.AdmittedWorldCommit); wire.admissionReceipt.payload.admittedAtServerEpochMs = wire.appendPermitReceipt.payload.expiresAtServerEpochMs;
  wire.admissionReceipt.issuedAtServerEpochMs = wire.admissionReceipt.payload.admittedAtServerEpochMs;
  rejects(() => codec.validate('AdmittedWorldCommit', wire), 'InvariantInvalid');
  const modified = clone(samples.AdmittedWorldCommit); modified.admissionClaim.claim.header.identity.authorSequence += 1;
  rejects(() => codec.validate('AdmittedWorldCommit', modified), 'InvariantInvalid');
});

test('codec preserves admitted raw bytes for cryptographic invalid-body classification', () => {
  const wire = clone(samples.AdmittedWorldCommit);
  wire.envelopeBytesBase64Url = canonical.base64UrlEncode(bytes('{"duplicate":1,"duplicate":2}'));
  const normalized = codec.validate('AdmittedWorldCommit', wire);
  assert.equal(normalized.envelopeBytesBase64Url, wire.envelopeBytesBase64Url);
  // Shape validation is deliberately not admission digest/signature verification.
});

test('stable definition IDs share one domain while references may recur', () => {
  const f = createFixture();
  const trace = clone(f.genesis.initialState.entities.find(record => record.definition.elementType === 'Trace').definition);
  trace.normalTrace.traceTouchId = trace.entityId;
  rejects(() => codec.validate('SharedMapEntityDefinition', trace), 'InvariantInvalid');
  for (const referenceName of ['anchorEntityId', 'targetEntityId']) {
    const trigger = clone(f.trigger);
    if (referenceName === 'anchorEntityId') trigger.anchorEntityId = trigger.triggerId;
    else trigger.action.targetEntityId = trigger.triggerId;
    rejects(() => codec.validate('SharedTriggerDefinition', trigger), 'InvariantInvalid');
  }
  const trigger = clone(f.trigger); trigger.anchorEntityId = trigger.action.targetEntityId;
  assert.equal(codec.validate('SharedTriggerDefinition', trigger).anchorEntityId, trigger.action.targetEntityId);
  const touch = clone(samples.TraceTouchChange); touch.traceTouchId = touch.normalTraceEntityId;
  rejects(() => codec.validate('TraceTouchChange', touch), 'InvariantInvalid');
  const aggregate = clone(samples.TraceTouchAggregate); aggregate.traceTouchId = aggregate.normalTraceEntityId;
  rejects(() => codec.validate('TraceTouchAggregate', aggregate), 'InvariantInvalid');
});

test('Genesis and state reject every cross-kind stable ID collision including tombstones', () => {
  const f = createFixture();
  const collisionCases = [
    state => { state.mapId = f.ids.entityA; },
    state => { state.mapId = f.ids.trigger; },
    state => { state.mapId = f.ids.traceTouch; },
    state => { state.triggers[0].definition.triggerId = f.ids.entityB; },
    state => { state.entities.find(record => record.definition.elementType === 'Trace').definition.normalTrace.traceTouchId = f.ids.entityB; },
    state => { state.entities.find(record => record.definition.elementType === 'Trace').definition.normalTrace.traceTouchId = f.ids.trigger; },
  ];
  for (const collide of collisionCases) {
    const state = clone(f.genesis.initialState); collide(state);
    rejects(() => codec.validate('SharedWorldState', state), 'InvariantInvalid');
    const genesis = clone(f.genesis); genesis.initialState = state; genesis.mapId = state.mapId;
    rejects(() => codec.validate('WorldSharedGenesis', genesis), 'InvariantInvalid');
  }
  const tombstone = clone(f.genesis.initialState);
  const removed = tombstone.entities.find(record => record.definition.entityId === f.ids.entityA);
  removed.lastEditedBy = clone(samples.WorldCommitIdentity); removed.deletedBy = clone(samples.WorldCommitIdentity);
  tombstone.mapId = removed.definition.entityId;
  rejects(() => codec.validate('SharedWorldState', tombstone), 'InvariantInvalid');
  const references = clone(f.genesis.initialState);
  references.traceTouches = [{ traceTouchId: f.ids.traceTouch, normalTraceEntityId: f.ids.trace, totalTouchUnits: '1', aggregateStrength: 1 }];
  references.triggers[0].definition.anchorEntityId = f.ids.residue;
  assert.equal(codec.validate('SharedWorldState', references).traceTouches[0].normalTraceEntityId, f.ids.trace);
});

test('created records require edit attribution without excluding edited Genesis records', () => {
  for (const kind of ['SharedEntityRecord', 'SharedTriggerRecord']) {
    const record = clone(samples[kind]); record.createdBy = clone(samples.WorldCommitIdentity); record.lastEditedBy = null;
    rejects(() => codec.validate(kind, record), 'InvariantInvalid');
    record.lastEditedBy = { ...samples.WorldCommitIdentity, authorSequence: samples.WorldCommitIdentity.authorSequence + 1 };
    assert.equal(codec.validate(kind, record).createdBy.authorSequence, samples.WorldCommitIdentity.authorSequence);
    record.createdBy = null;
    assert.equal(codec.validate(kind, record).lastEditedBy.authorSequence, samples.WorldCommitIdentity.authorSequence + 1);
  }
});
