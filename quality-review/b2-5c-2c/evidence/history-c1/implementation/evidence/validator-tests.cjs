'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SharedCommitValidator } = require('./build/SharedCommitValidator.js');
const { createFixture, sampleSchemaValues, cryptoPort, clone, jcs, bytes, b64, from64, hash, hkdf, keyPair, nonce } = require('./fixtures.cjs');
const make = (f, overrides = {}, port = cryptoPort) => new SharedCommitValidator(port, { ...f.context, ...overrides });
const verified = result => { assert.equal(result.kind, 'Verified', result.reason); return result.value; };
const gap = result => assert.equal(result.kind, 'Gap', result.reason);
const invalid = result => { const value = verified(result); assert.equal(value.invalid, true); assert.equal(value.commit, null); assert.equal(value.change, null); return value; };

test('native-HMAC RFC5869 vector and native AES-GCM backend are independent cryptographic evidence', async () => {
  const hex = value => new Uint8Array(Buffer.from(value, 'hex'));
  assert.equal(Buffer.from(hkdf(hex('0b'.repeat(22)), hex('000102030405060708090a0b0c'), hex('f0f1f2f3f4f5f6f7f8f9'), 42)).toString('hex'),
    '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  const f = createFixture(), result = verified(await make(f).validateCommit(f.makeAdmitted(f.reveal())));
  assert.equal(result.invalid, false); assert.equal(jcs(result.change), jcs(f.reveal()));
});

test('installed Genesis trust succeeds and serialized/runtime brands confer no trust', async () => {
  const f = createFixture(), validator = make(f), result = verified(await validator.validateGenesis(f.genesis));
  assert.equal(validator.ownsGenesis(result), true);
  assert.equal(validator.ownsGenesis(clone(result)), false);
  assert.equal(make(f).ownsGenesis(result), false);
  assert.equal(Object.isFrozen(result), true);
  const changed = clone(f.genesis); changed.initialState.entities[0].definition.position.depthMilli = 1;
  gap(await validator.validateGenesis(changed));
});

for (const actor of ['developer', 'coDeveloper', 'observer', 'observerDevice2']) {
  test('real registered author proof and epoch accept ' + actor, async () => {
    const f = createFixture(), validator = make(f), wire = f.makeAdmitted(f.touch(), { actor });
    const result = verified(await validator.validateCommit(wire));
    assert.equal(result.invalid, false); assert.equal(result.identity.authorAccountId, f.actors[actor].accountId);
    assert.equal(result.header.authorDeviceId, f.actors[actor].deviceId); assert.equal(validator.ownsCommit(result), true);
    assert.equal(validator.ownsCommit(clone(result)), false); assert.equal(make(f).ownsCommit(result), false);
  });
}

test('old admitted permit stays valid by signed acceptance time; no current wall clock exists in validator', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal(), { appendedAt: f.baseTime - 100, admittedAt: f.baseTime - 90 });
  const result = verified(await make(f, { clockGeneration: 2 }).validateCommit(wire));
  assert.equal(result.invalid, false); assert.equal(result.appendedAt.epochMs, f.baseTime - 100);
});

test('repeated historical receipt validates without reconstructing a physical identity', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal()), validator = make(f);
  const a = verified(await validator.validateCommit(wire)), b = verified(await validator.validateCommit(clone(wire)));
  assert.equal(a.envelopeSha256, b.envelopeSha256);
  assert.equal(wire.authorKeyBindingReceipt.payload.assurance, 'RegisteredCredential');
  const bad = clone(wire); bad.authorKeyBindingReceipt = f.reSignReceipt(bad.authorKeyBindingReceipt, { payload: { ...bad.authorKeyBindingReceipt.payload, assurance: 'PhysicalDevice' } });
  gap(await validator.validateCommit(bad));
});

test('wrong installed service public key never bootstraps from receipt', async () => {
  const f = createFixture(); gap(await make(f, { servicePublicKeyJwk: keyPair().jwk }).validateCommit(f.makeAdmitted(f.reveal())));
});

test('wrong installed developer pin fails before trusting membership publisher', async () => {
  const f = createFixture(), anchor = clone(f.anchor); anchor.developerPublicKey = keyPair().jwk;
  gap(await make(f, { developerTrustAnchor: anchor }).validateCommit(f.makeAdmitted(f.reveal())));
});

test('tampered authenticated service receipt is Gap, never a technical-invalid body capability', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal()); wire.admissionReceipt.signatureBase64Url = b64(new Uint8Array(64));
  gap(await make(f).validateCommit(wire));
});

test('wrong receipt purpose cannot reuse a service signature from another protocol purpose', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal());
  wire.admissionReceipt = f.reSignReceipt(wire.admissionReceipt, { purpose: 'SequenceSegment' });
  gap(await make(f).validateCommit(wire));
});

test('signed admission request nonce must match author-signed admission claim nonce', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal());
  wire.admissionReceipt = f.reSignReceipt(wire.admissionReceipt, { requestNonce: nonce() }); gap(await make(f).validateCommit(wire));
});

test('author claim signature cannot be replaced by service assertion', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal()); wire.admissionClaim.authorSignatureBase64Url = b64(new Uint8Array(64));
  gap(await make(f).validateCommit(wire));
});

test('claim/admission final digest disagreement is missing provenance', async () => {
  const f = createFixture(); gap(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { claimOverrides: { envelopeSha256: '0'.repeat(64) } })));
});

test('tampered exact envelope bytes do not turn into trustworthy InvalidChange', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal()), raw = from64(wire.envelopeBytesBase64Url); raw[raw.length - 2] ^= 1;
  wire.envelopeBytesBase64Url = b64(raw); gap(await make(f).validateCommit(wire));
});

test('valid signed claim + admission binds exact malformed envelope bytes as technical InvalidChange', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal(), { envelopeBytes: bytes('{"header":null}') });
  assert.equal(invalid(await make(f).validateCommit(wire)).invalidReason, 'EnvelopeSchemaInvalid');
});

test('duplicate JSON keys in exact admitted envelope are technical-invalid rather than silently parsed', async () => {
  const f = createFixture(); invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { envelopeBytes: bytes('{"header":1,"header":2}') })));
});

test('bad envelope ES256 signature with valid independent claim is technical-invalid', async () => {
  const f = createFixture(); assert.equal(invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { badEnvelopeSignature: true }))).invalidReason, 'EnvelopeSignatureInvalid');
});

test('wrong wrapping AAD cannot yield a body or shared change', async () => {
  const f = createFixture(); assert.equal(invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { wrapAad: bytes('wrong epoch AAD') }))).invalidReason, 'WrappedDataKeyAuthenticationInvalid');
});

test('wrong body AAD cannot yield a body or shared change', async () => {
  const f = createFixture(); assert.equal(invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { bodyAad: bytes('wrong body AAD') }))).invalidReason, 'BodyAuthenticationInvalid');
});

test('authenticated body duplicate keys fail strict decoding', async () => {
  const f = createFixture(); invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { bodyBytes: bytes('{"schemaVersion":1,"schemaVersion":1}') })));
});

test('authenticated inner appended time must equal signed public header', async () => {
  const f = createFixture(); assert.equal(invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { bodyOverrides: { appendedAt: { epochMs: f.baseTime + 1 } } }))).invalidReason, 'BodyHeaderMismatch');
});

test('authenticated body cannot change content manifest context', async () => {
  const f = createFixture(); assert.equal(invalid(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { bodyOverrides: { contentManifestSha256: '0'.repeat(64) } }))).invalidReason, 'BodyContentContextMismatch');
});

test('map entity content approval is required even for an authenticated developer body', async () => {
  const f = createFixture(), def = clone(f.approvedNewDefinition); def.content.contentSha256 = '0'.repeat(64);
  const change = f.mapEdit({ operation: 'CreateEntity', target: { kind: 'Entity', entityId: def.entityId }, definition: def });
  assert.equal(invalid(await make(f).validateCommit(f.makeAdmitted(change))).invalidReason, 'EntityContentUnapproved');
});

test('missing epoch key stays Gap even if exact bytes are admitted', async () => {
  const f = createFixture(); gap(await make(f, { lookupWorldRelayKey: async () => null }).validateCommit(f.makeAdmitted(f.reveal())));
});

test('missing key plus exact bad bytes cannot advance settlement as InvalidChange', async () => {
  const f = createFixture(); gap(await make(f, { lookupWorldRelayKey: async () => null }).validateCommit(f.makeAdmitted(f.reveal(), { envelopeBytes: bytes('{"x":1}') })));
});

test('key capability returning wrong committed group key is Gap', async () => {
  const f = createFixture(); gap(await make(f, { lookupWorldRelayKey: async () => new Uint8Array(32) }).validateCommit(f.makeAdmitted(f.reveal())));
});

test('membership activated after logical append cannot authorize it', async () => {
  const f = createFixture(), next = f.makeMembership(2, { activatedAt: f.baseTime + 10 });
  gap(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { membershipReceipt: next.membershipReceipt })));
});

test('forged author credential absent from signed epoch is Gap', async () => {
  const f = createFixture(), stranger = { ...f.actors.observer, deviceId: '00000000-0000-4000-8000-000000000099', signing: keyPair() };
  gap(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { actor: stranger })));
});

test('every signed epoch member agreement fingerprint binds its actual ECDH key', async () => {
  const f = createFixture(), credentials = clone(f.credentials);
  const member = credentials.find(value => value.deviceId === f.actors.observer.deviceId);
  member.keyAgreementKeyFingerprint = keyPair().fingerprint;
  const membership = f.makeMembership(1, { credentials });
  const result = await make(f).validateCommit(f.makeAdmitted(f.reveal(), { membershipReceipt: membership.membershipReceipt }));
  gap(result); assert.equal(result.reason, 'MemberAgreementFingerprintMismatch');
});

for (const purpose of ['registered signing', 'developer root', 'service root']) {
  test('signed epoch rejects ECDH reuse of ' + purpose + ' key even for a non-author member', async () => {
    const f = createFixture(), credentials = clone(f.credentials);
    const member = credentials.find(value => value.deviceId === f.actors.observer.deviceId);
    const key = purpose === 'registered signing' ? f.actors.observer.signing
      : purpose === 'developer root' ? { jwk: f.anchor.developerPublicKey, fingerprint: f.anchor.developerPublicKeyFingerprint }
        : { jwk: f.context.servicePublicKeyJwk, fingerprint: f.context.serviceKeyFingerprint };
    member.keyAgreementPublicKey = clone(key.jwk); member.keyAgreementKeyFingerprint = key.fingerprint;
    const membership = f.makeMembership(1, { credentials });
    const result = await make(f).validateCommit(f.makeAdmitted(f.reveal(), { membershipReceipt: membership.membershipReceipt }));
    gap(result);
    // Own signing-key reuse is already rejected by the exact schema; trusted root
    // reuse reaches the cryptographic purpose guard. Both are provenance gaps.
    if (purpose !== 'registered signing') assert.equal(result.reason, 'MemberKeyPurposeConflict');
  });
}

test('non-root signed epoch member must retain Observer admission provenance', async () => {
  const f = createFixture(), credentials = clone(f.credentials);
  credentials.find(value => value.deviceId === f.actors.observer.deviceId).observerAdmissionRevision = null;
  const membership = f.makeMembership(1, { credentials });
  const result = await make(f).validateCommit(f.makeAdmitted(f.reveal(), { membershipReceipt: membership.membershipReceipt }));
  gap(result); assert.equal(result.reason, 'MemberAdmissionMissing');
});

test('permit acceptance at exact expiry endpoint is rejected', async () => {
  const f = createFixture(); gap(await make(f).validateCommit(f.makeAdmitted(f.reveal(), { admittedAt: f.baseTime + 30000 })));
});

test('unknown future clock generation is Gap; signed historical generation remains accepted', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal()); wire.admissionReceipt = f.reSignReceipt(wire.admissionReceipt, { clockGeneration: 2 });
  gap(await make(f).validateCommit(wire));
});

test('untrusted signed clock status does not become trusted because signature verifies', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal()); wire.admissionReceipt = f.reSignReceipt(wire.admissionReceipt, { clockStatus: 'Untrusted' });
  gap(await make(f).validateCommit(wire));
});

test('AddCoDeveloper requires signed active Observer fact at AppendedAt', async () => {
  const f = createFixture(), validator = make(f);
  assert.equal(verified(await validator.validateCommit(f.makeAdmitted(f.roster('AddCoDeveloper')))).invalid, false);
  assert.equal(invalid(await validator.validateCommit(f.makeAdmitted(f.roster('AddCoDeveloper'), { targetObserverActive: false }))).invalidReason, 'RosterObserverInactive');
});

test('RemoveCoDeveloper accepts old valid admission source without requiring target still active', async () => {
  const f = createFixture(); assert.equal(verified(await make(f).validateCommit(f.makeAdmitted(f.roster('RemoveCoDeveloper')))).invalid, false);
});

test('roster cannot use another observer admission fact as target provenance', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.roster('AddCoDeveloper')); wire.rosterObserverAdmissionReceipt = f.makeObserverReceipt('coDeveloper');
  gap(await make(f).validateCommit(wire));
});

test('missing observer fact is Gap, not author narrative evidence', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.roster('AddCoDeveloper')); wire.rosterObserverAdmissionReceipt = null;
  gap(await make(f).validateCommit(wire));
});

test('injected crypto outage and producer outage are HostFailure, never technical InvalidChange', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal());
  for (const overrides of [{ sha256: async () => { throw new Error('offline test backend'); } }, { verifyEs256: async () => { throw new Error('provider unavailable'); } }]) {
    assert.equal((await make(f, {}, { ...cryptoPort, ...overrides }).validateCommit(wire)).kind, 'HostFailure');
  }
  assert.equal((await make(f, { lookupWorldRelayKey: async () => { throw new Error('key capability unavailable'); } }).validateCommit(wire)).kind, 'HostFailure');
});

test('bad cryptography return shape cannot be mistaken for trustworthy digest or key', async () => {
  const f = createFixture(), wire = f.makeAdmitted(f.reveal());
  assert.equal((await make(f, {}, { ...cryptoPort, sha256: async () => 'bad digest' }).validateCommit(wire)).kind, 'HostFailure');
  assert.equal((await make(f, {}, { ...cryptoPort, hkdfSha256: async () => new Uint8Array(2) }).validateCommit(wire)).kind, 'HostFailure');
});

test('signed seal must satisfy S-H and policy fingerprint', async () => {
  const f = createFixture(), validator = make(f), commits = [f.makeAdmitted(f.reveal())];
  const good = verified(await validator.validateSeal(f.makeSeal(commits), f.policy)); assert.equal(validator.ownsSeal(good), true);
  gap(await validator.validateSeal(f.makeSeal(commits, { issuedAt: f.baseTime + f.policy.settleHorizonMs - 1 }), f.policy));
  gap(await validator.validateSeal(f.makeSeal(commits, { overrides: { policySha256: '0'.repeat(64) } }), f.policy));
});

test('seal chain needs runtime-trusted prior receipt and increasing boundary', async () => {
  const f = createFixture(), validator = make(f), commits = [f.makeAdmitted(f.reveal())];
  const old = verified(await validator.validateSeal(f.makeSeal(commits), f.policy));
  const next = f.makeSeal(commits, { coveredThrough: f.baseTime + 1, sealRevision: 2, previousSealSha256: old.receiptSha256 });
  verified(await validator.validateSeal(next, f.policy, old)); gap(await validator.validateSeal(next, f.policy, clone(old)));
  gap(await validator.validateSeal(f.makeSeal(commits, { coveredThrough: f.baseTime + 1, sealRevision: 2 }), f.policy, old));
});

test('developer closure and rejection proofs stay separate from shared change/body', async () => {
  const f = createFixture(), samples = sampleSchemaValues(f), validator = make(f);
  const closure = f.signReceipt('WorldDeveloperClosure', samples.WorldDeveloperClosureFact), rejection = f.signReceipt('WorldCommitRejection', samples.WorldCommitRejection);
  const c = verified(await validator.validateClosure(closure)), r = verified(await validator.validateRejection(rejection));
  assert.equal(validator.ownsClosure(c), true); assert.equal(validator.ownsRejection(r), true); assert.equal(validator.ownsRejection(clone(r)), false);
  gap(await validator.validateClosure(rejection)); gap(await validator.validateRejection(closure));
});
