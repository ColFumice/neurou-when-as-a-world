'use strict';
// This isolated test backend uses real Node cryptography; private material never leaves memory.
const crypto = require('node:crypto');
const clone = value => JSON.parse(JSON.stringify(value));
const jcs = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(jcs).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + jcs(value[key])).join(',') + '}';
const bytes = value => new Uint8Array(Buffer.from(typeof value === 'string' ? value : jcs(value), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value instanceof Uint8Array ? value : bytes(value)).digest('hex');
const b64 = value => Buffer.from(value).toString('base64url');
const from64 = value => new Uint8Array(Buffer.from(value, 'base64url'));
const concat = (...items) => new Uint8Array(Buffer.concat(items.map(item => Buffer.from(item))));
const domain = (name, value) => concat(bytes(name), bytes(value));
const randomBytes = length => new Uint8Array(crypto.randomBytes(length));
const nonce = () => b64(randomBytes(32));
const uid = n => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');
function keyPair() {
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const exported = pair.publicKey.export({ format: 'jwk' });
  const jwk = { kty: 'EC', crv: 'P-256', x: exported.x, y: exported.y };
  return { privateKey: pair.privateKey, jwk, fingerprint: b64(crypto.createHash('sha256').update(jcs(jwk)).digest()) };
}
const sign = (key, message) => b64(crypto.sign('sha256', message, { key: key.privateKey || key, dsaEncoding: 'ieee-p1363' }));
// RFC5869 extract/expand with Node native HMAC: Node hkdfSync caps info at 1024 bytes,
// while the frozen key-package context can exceed that implementation-specific cap.
function hkdf(ikm, salt, info, length = 32) {
  if (!Number.isSafeInteger(length) || length < 0 || length > 255 * 32) throw new Error('HKDF length');
  const prk = crypto.createHmac('sha256', salt.length ? salt : Buffer.alloc(32)).update(ikm).digest();
  const chunks = []; let previous = Buffer.alloc(0);
  for (let index = 1; chunks.length * 32 < length; index += 1) {
    previous = crypto.createHmac('sha256', prk).update(previous).update(info).update(Buffer.from([index])).digest();
    chunks.push(previous);
  }
  return new Uint8Array(Buffer.concat(chunks).subarray(0, length));
}
function encrypt(key, iv, aad, plaintext) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad));
  return concat(cipher.update(plaintext), cipher.final(), cipher.getAuthTag());
}
const cryptoPort = {
  async sha256(input) { return hash(input); },
  async verifyEs256(jwk, signature, message) {
    try { return crypto.verify('sha256', message, { key: crypto.createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, signature); }
    catch { return false; }
  },
  async hkdfSha256(ikm, salt, info, length) { return hkdf(ikm, salt, info, length); },
  async decryptAes256Gcm(key, iv, ciphertextAndTag, aad) {
    try {
      if (ciphertextAndTag.length < 16) return null;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(Buffer.from(ciphertextAndTag.subarray(ciphertextAndTag.length - 16)));
      return concat(decipher.update(ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16)), decipher.final());
    } catch { return null; }
  },
};
function createFixture() {
  const ids = { world: uid(1), map: uid(2), residue: uid(100), trace: uid(110), traceTouch: uid(111), entityA: uid(120), entityB: uid(130), trigger: uid(140), newEntity: uid(150) };
  const serviceInstanceId = uid(3), serviceKey = keyPair(), developerKey = keyPair();
  const baseTime = 10_000_000, keyId = serviceKey.fingerprint, groupKeys = new Map();
  const actors = {};
  for (const [name, accountNo, deviceNo, admission] of [['developer', 10, 11, null], ['coDeveloper', 20, 21, 1], ['observer', 30, 31, 2], ['observerDevice2', 30, 32, 2]]) {
    const signing = keyPair(), agreement = keyPair();
    actors[name] = { name, accountId: uid(accountNo), deviceId: uid(deviceNo), deviceGeneration: 1, signing, agreement, observerAdmissionRevision: admission };
  }
  const anchor = { schemaVersion: 1, worldId: ids.world, worldDeveloperAccountId: actors.developer.accountId, developerSigningKeyId: developerKey.fingerprint, developerPublicKey: developerKey.jwk, developerPublicKeyFingerprint: developerKey.fingerprint };
  function entity(entityId, elementType, contentId, normalTrace = null) {
    return { entityId, elementType, position: { lateralMilli: 0, depthMilli: 0 }, content: { contentId, contentSha256: hash(bytes(contentId)) }, normalTrace };
  }
  const definitions = [entity(ids.residue, 'Residue', 'fixture/residue'), entity(ids.trace, 'Trace', 'fixture/normal', { traceTouchId: ids.traceTouch, tier: 'Common' }), entity(ids.entityA, 'Initial', 'fixture/entity-a'), entity(ids.entityB, 'Process', 'fixture/entity-b')];
  const approvedNewDefinition = entity(ids.newEntity, 'Initial', 'fixture/entity-new');
  const definitionsById = new Map([...definitions, approvedNewDefinition].map(def => [def.entityId, def]));
  const trigger = { triggerId: ids.trigger, anchorEntityId: ids.entityA, activation: { kind: 'Proximity', radiusMilli: 1000 }, action: { kind: 'RevealResidue', targetEntityId: ids.residue } };
  const manifestSha = hash(bytes('reviewed fixture manifest'));
  const state = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId: ids.world, mapId: ids.map, contentManifestSha256: manifestSha,
    entities: definitions.map(definition => ({ definition: clone(definition), createdBy: null, lastEditedBy: null, deletedBy: null })),
    triggers: [{ definition: clone(trigger), createdBy: null, lastEditedBy: null, deletedBy: null }], revealedResidueEntityIds: [], traceTouches: [],
    developerRoster: { worldDeveloperAccountId: actors.developer.accountId, coDeveloperAccountIds: [actors.coDeveloper.accountId], frozen: false } };
  const genesis = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId: ids.world, mapId: ids.map, contentRevision: 1, contentManifestSha256: manifestSha, worldDeveloperAccountId: actors.developer.accountId, developerTrustAnchor: anchor, initialState: state };
  let admissionCounter = 0;
  const authorSequences = new Map(), segments = new Map(), segmentReceipts = new Map();
  function signReceipt(purpose, payload, options = {}) {
    const receipt = { schemaVersion: 1, serviceInstanceId, purpose, receiptId: crypto.randomUUID(), keyId, requestNonce: options.requestNonce || payload.requestNonce || nonce(),
      issuedAtServerEpochMs: options.issuedAt ?? payload.issuedAtServerEpochMs ?? payload.admittedAtServerEpochMs ?? payload.rejectedAtServerEpochMs
        ?? payload.effectiveAtServerEpochMs ?? payload.activatedAtServerEpochMs ?? payload.registeredAtServerEpochMs ?? payload.appendedAt?.epochMs ?? baseTime - 1000,
      clockGeneration: options.clockGeneration ?? 1, clockStatus: options.clockStatus ?? 'Trusted', payload: clone(payload) };
    Object.assign(receipt, options.overrides || {});
    return { ...receipt, signatureBase64Url: sign(options.signingKey || serviceKey, domain('Neurou/shared-authority/v1\0', receipt)) };
  }
  function reSignReceipt(receipt, overrides = {}) {
    const copy = clone(receipt); delete copy.signatureBase64Url;
    Object.assign(copy, overrides);
    return { ...copy, signatureBase64Url: sign(serviceKey, domain('Neurou/shared-authority/v1\0', copy)) };
  }
  const credentials = Object.values(actors).map(actor => ({ accountId: actor.accountId, observerAdmissionRevision: actor.observerAdmissionRevision, deviceId: actor.deviceId, deviceGeneration: actor.deviceGeneration,
    registeredSigningKeyFingerprint: actor.signing.fingerprint, keyAgreementPublicKey: actor.agreement.jwk, keyAgreementKeyFingerprint: actor.agreement.fingerprint }))
    .sort((a, b) => a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : a.deviceGeneration - b.deviceGeneration);
  function makeMembership(epoch = 1, options = {}) {
    const groupKey = options.groupKey || randomBytes(32);
    const descriptor = { schemaVersion: 1, worldId: ids.world, membershipEpoch: epoch, keyEpoch: epoch, worldRelayKeyId: options.keyId || crypto.randomUUID(), keyCommitmentSha256: hash(groupKey) };
    groupKeys.set(descriptor.worldRelayKeyId, groupKey);
    const proposal = { schemaVersion: 1, serviceInstanceId, worldId: ids.world, membershipEpoch: epoch, previousMembershipEpoch: epoch === 1 ? null : epoch - 1,
      key: descriptor, credentials: clone(options.credentials || credentials), developerTrustAnchorSha256: hash(anchor) };
    const membership = { ...proposal, activatedAtServerEpochMs: options.activatedAt ?? baseTime - 1000, developerSignatureBase64Url: sign(developerKey, domain('Neurou/world-membership/v1\0', proposal)) };
    return { descriptor, groupKey, membershipReceipt: signReceipt('WorldMembership', membership, { issuedAt: membership.activatedAtServerEpochMs }) };
  }
  const firstMembership = makeMembership();
  const descriptor = firstMembership.descriptor, membershipReceipt = firstMembership.membershipReceipt;
  const context = { serviceInstanceId, servicePublicKeyJwk: serviceKey.jwk, serviceKeyFingerprint: serviceKey.fingerprint, clockGeneration: 1, developerTrustAnchor: anchor,
    genesisSha256: hash(genesis), worldId: ids.world, mapId: ids.map, contentManifestSha256: manifestSha,
    isEntityDefinitionApproved(def) { const approved = definitionsById.get(def.entityId); return !!approved && approved.elementType === def.elementType && jcs(approved.content) === jcs(def.content) && jcs(approved.normalTrace) === jcs(def.normalTrace); },
    lookupWorldRelayKey(keyDescriptor) { const key = groupKeys.get(keyDescriptor.worldRelayKeyId); return key && hash(key) === keyDescriptor.keyCommitmentSha256 ? new Uint8Array(key) : null; } };
  const admittedMetadata = new WeakMap();
  function makeObserverReceipt(actor = actors.observer, options = {}) {
    if (typeof actor === 'string') actor = actors[actor];
    const fact = { schemaVersion: 1, serviceInstanceId, worldId: ids.world, observerAccountId: actor.accountId, observerAdmissionRevision: actor.observerAdmissionRevision || 1,
      accessCodeRevision: 1, admittedAtServerEpochMs: options.admittedAt ?? baseTime - 2000, developerTrustAnchorSha256: hash(anchor) };
    return signReceipt('WorldMembership', fact, { issuedAt: fact.admittedAtServerEpochMs });
  }
  function makeAdmitted(change, options = {}) {
    const actor = typeof options.actor === 'object' ? options.actor : actors[options.actor || 'developer'];
    const sequenceKey = actor.accountId + '|' + actor.deviceId;
    const seq = options.seq ?? (authorSequences.get(sequenceKey) ?? (actor.name === 'observerDevice2' ? 1024 : 0)) + 1;
    authorSequences.set(sequenceKey, Math.max(authorSequences.get(sequenceKey) || 0, seq));
    const appendedAt = options.appendedAt ?? baseTime, admittedAt = options.admittedAt ?? appendedAt + 1;
    const epochReceipt = options.membershipReceipt || membershipReceipt, selectedDescriptor = epochReceipt.payload.key;
    const groupKey = options.groupKey || groupKeys.get(selectedDescriptor.worldRelayKeyId), permitId = crypto.randomUUID();
    const identity = { authorAccountId: actor.accountId, authorSequence: seq }, firstSequence = Math.floor((seq - 1) / 1024) * 1024 + 1;
    const segmentCacheKey = [actor.accountId, actor.deviceId, actor.deviceGeneration, ids.world, selectedDescriptor.membershipEpoch, firstSequence].join('|');
    let segment = segments.get(segmentCacheKey);
    if (!segment || options.forceNewSegment || options.segmentIssuedAt !== undefined || options.segmentExpiresAt !== undefined) {
      segment = { schemaVersion: 1, serviceInstanceId, segmentId: crypto.randomUUID(), authorAccountId: actor.accountId, authorDeviceId: actor.deviceId, authorDeviceGeneration: actor.deviceGeneration,
        worldId: ids.world, membershipEpoch: selectedDescriptor.membershipEpoch, firstSequence, lastSequence: firstSequence + 1023, issuedAtServerEpochMs: options.segmentIssuedAt ?? appendedAt - 500,
        expiresAtServerEpochMs: options.segmentExpiresAt ?? appendedAt - 500 + 3600000 };
      if (!options.forceNewSegment && options.segmentIssuedAt === undefined && options.segmentExpiresAt === undefined) segments.set(segmentCacheKey, segment);
    }
    const segmentId = segment.segmentId;
    if (!segmentReceipts.has(segmentId)) segmentReceipts.set(segmentId, signReceipt('SequenceSegment', segment, { issuedAt: segment.issuedAtServerEpochMs }));
    const restrictedWrite = change.changeClass !== 'DeveloperMapChange' ? null : change.subtype === 'MapEditCommit' ? { subtype: change.subtype }
      : { subtype: change.subtype, operation: change.operation, accountId: change.accountId, observerAdmissionRevision: change.observerAdmissionRevision };
    const header = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', kind: 'RelayWorldCommit', serviceInstanceId, worldId: ids.world, identity,
      authorDeviceId: actor.deviceId, authorDeviceGeneration: actor.deviceGeneration, authorSigningKeyFingerprint: actor.signing.fingerprint, segmentId, permitId,
      membershipEpoch: selectedDescriptor.membershipEpoch, keyEpoch: selectedDescriptor.keyEpoch, worldRelayKeyId: selectedDescriptor.worldRelayKeyId, appendedAt: { epochMs: appendedAt },
      changeClass: change.changeClass, commitClass: change.commitClass, restrictedWrite, cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
    Object.assign(header, options.headerOverrides || {});
    const body = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId: ids.world, mapId: ids.map, contentManifestSha256: manifestSha, identity: clone(identity),
      authorDeviceId: actor.deviceId, authorDeviceGeneration: actor.deviceGeneration, segmentId, permitId, membershipEpoch: header.membershipEpoch, keyEpoch: header.keyEpoch,
      appendedAt: clone(header.appendedAt), change: clone(change) };
    Object.assign(body, options.bodyOverrides || {});
    const dek = randomBytes(32), wrapNonce = randomBytes(12), bodyNonce = randomBytes(12);
    const wrapKey = hkdf(groupKey, from64(b64(Buffer.from(hash(identity), 'hex'))), domain('Neurou/relay-dek/v1\0', header));
    const wrappedCommitDataKey = { nonceBase64Url: b64(wrapNonce), ciphertextAndTagBase64Url: b64(encrypt(wrapKey, wrapNonce, options.wrapAad || domain('Neurou/relay-wrap/v1\0', header), dek)) };
    const unsignedEnvelope = { header, wrappedCommitDataKey, nonceBase64Url: b64(bodyNonce), ciphertextAndTagBase64Url: b64(encrypt(dek, bodyNonce,
      options.bodyAad || domain('Neurou/relay-body/v1\0', { header, wrappedCommitDataKey }), options.bodyBytes || bytes(body))) };
    const envelope = { ...unsignedEnvelope, authorSignatureBase64Url: options.badEnvelopeSignature ? b64(new Uint8Array(64)) : sign(actor.signing, domain('Neurou/world-commit/v1\0', unsignedEnvelope)) };
    const envelopeBytes = options.envelopeBytes || bytes(envelope), envelopeSha256 = hash(envelopeBytes);
    const claim = { schemaVersion: 1, serviceInstanceId, requestNonce: nonce(), header: clone(header), envelopeSha256 };
    Object.assign(claim, options.claimOverrides || {});
    const admissionClaim = { claim, authorSignatureBase64Url: sign(actor.signing, domain('Neurou/commit-admission-claim/v1\0', claim)) };
    const permit = { schemaVersion: 1, serviceInstanceId, permitId, requestNonce: nonce(), worldId: ids.world, identity: clone(identity), authorDeviceId: actor.deviceId,
      authorDeviceGeneration: actor.deviceGeneration, segmentId, membershipEpoch: header.membershipEpoch, keyEpoch: header.keyEpoch, changeClass: header.changeClass,
      appendedAt: clone(header.appendedAt), expiresAtServerEpochMs: options.permitExpiresAt ?? appendedAt + 30000, clockGeneration: 1, clockStatus: 'Trusted' };
    const admission = { schemaVersion: 1, serviceInstanceId, worldId: ids.world, identity: clone(identity), envelopeSha256, appendedAt: clone(header.appendedAt), admittedAtServerEpochMs: admittedAt,
      admissionRevision: options.admissionRevision ?? ++admissionCounter, membershipEpoch: header.membershipEpoch,
      rosterTargetObserverActiveAtAppendedAt: change.subtype === 'DeveloperRosterChange' && change.operation === 'AddCoDeveloper' ? (options.targetObserverActive ?? true) : null };
    Object.assign(admission, options.admissionOverrides || {});
    const binding = { schemaVersion: 1, serviceInstanceId, authorAccountId: actor.accountId, authorDeviceId: actor.deviceId, authorDeviceGeneration: actor.deviceGeneration,
      authorSigningPublicJwk: actor.signing.jwk, authorSigningKeyFingerprint: actor.signing.fingerprint, registeredAtServerEpochMs: appendedAt - 2000, assurance: 'RegisteredCredential' };
    const rosterActor = Object.values(actors).find(candidate => candidate.accountId === change.accountId);
    const admitted = { envelopeBytesBase64Url: b64(envelopeBytes), appendPermitReceipt: signReceipt('WorldAppendPermit', permit, { issuedAt: appendedAt }),
      sequenceSegmentReceipt: clone(segmentReceipts.get(segmentId)), admissionReceipt: signReceipt('WorldCommitAdmission', admission, { issuedAt: admittedAt, requestNonce: claim.requestNonce }),
      admissionClaim, authorKeyBindingReceipt: signReceipt('AuthorKeyBinding', binding, { issuedAt: binding.registeredAtServerEpochMs }), membershipEpochReceipt: clone(epochReceipt),
      rosterObserverAdmissionReceipt: change.subtype === 'DeveloperRosterChange' ? makeObserverReceipt(rosterActor || actors.observer) : null };
    Object.assign(admitted, options.wireOverrides || {});
    admittedMetadata.set(admitted, { body, envelope, envelopeBytes, header, identity, admittedAt });
    return admitted;
  }
  const policy = { schemaVersion: 1, offlineGraceMs: 3600000, boundedRelayDelayMs: 300000, timeUncertaintyAllowanceMs: 60000, settleHorizonMs: 3960000, retentionMs: 86400000 };
  function makeSeal(commits, options = {}) {
    const coveredThrough = options.coveredThrough ?? baseTime, issuedAt = options.issuedAt ?? coveredThrough + policy.settleHorizonMs;
    const seen = new Set();
    const entries = commits.map(commit => ({ identity: clone(commit.admissionReceipt.payload.identity), envelopeSha256: commit.admissionReceipt.payload.envelopeSha256,
      appendedAt: clone(commit.admissionReceipt.payload.appendedAt) })).filter(entry => {
        const key = jcs(entry); if (entry.appendedAt.epochMs > coveredThrough || seen.has(key)) return false;
        seen.add(key); return true;
      })
      .sort((a, b) => a.appendedAt.epochMs - b.appendedAt.epochMs || (a.identity.authorAccountId < b.identity.authorAccountId ? -1 : a.identity.authorAccountId > b.identity.authorAccountId ? 1 : a.identity.authorSequence - b.identity.authorSequence));
    const seal = { schemaVersion: 1, serviceInstanceId, worldId: ids.world, sealRevision: options.sealRevision ?? 1, policySha256: hash(options.policy || policy), issuedAtServerEpochMs: issuedAt,
      sealedThroughEpochMs: coveredThrough, admittedCommitCount: entries.length, admittedPrefixSha256: hash(entries), developerClosureSha256: options.developerClosure ? hash(options.developerClosure) : null,
      previousSealSha256: options.previousSealSha256 ?? null };
    Object.assign(seal, options.overrides || {});
    return signReceipt('RelaySettlementSeal', seal, { issuedAt });
  }
  function buildKeyPackage(recipient = credentials[2], options = {}) {
    const ephemeral = keyPair(), salt = randomBytes(32), iv = randomBytes(12);
    const context = { schemaVersion: 1, serviceInstanceId, worldId: ids.world, packageId: crypto.randomUUID(), descriptor: clone(options.descriptor || descriptor), recipient: clone(recipient),
      developerTrustAnchorSha256: hash(anchor), developerSigningKeyId: anchor.developerSigningKeyId, cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1' };
    const shared = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: crypto.createPublicKey({ key: recipient.keyAgreementPublicKey, format: 'jwk' }) });
    const wrapping = hkdf(shared, salt, domain('Neurou/world-relay-key/v1\0', context));
    const unsigned = { context, ephemeralKeyAgreementPublicKey: ephemeral.jwk, saltBase64Url: b64(salt), nonceBase64Url: b64(iv), ciphertextAndTagBase64Url: b64(encrypt(wrapping, iv,
      domain('Neurou/world-relay-key-aad/v1\0', { context, ephemeralKeyAgreementPublicKey: ephemeral.jwk, saltBase64Url: b64(salt) }), groupKeys.get(context.descriptor.worldRelayKeyId))) };
    return { ...unsigned, developerSignatureBase64Url: sign(developerKey, domain('Neurou/world-relay-key-package/v1\0', unsigned)) };
  }
  return { ids, actors, genesis, context, cryptoPort, descriptor, membershipReceipt, credentials, policy, baseTime, anchor, approvedNewDefinition, trigger,
    makeAdmitted, makeSeal, signReceipt, reSignReceipt, buildKeyPackage, makeMembership, makeObserverReceipt, metadata: admittedMetadata,
    reveal(entityId = ids.residue) { return { changeClass: 'MonotonicReveal', commitClass: 'Monotonic', entityId, revealed: true }; },
    touch() { return { changeClass: 'TraceTouch', commitClass: 'AddOnly', traceTouchId: ids.traceTouch, normalTraceEntityId: ids.trace, touchUnits: 1 }; },
    mapEdit(edit) { return { changeClass: 'DeveloperMapChange', commitClass: 'RestrictedWrite', subtype: 'MapEditCommit', edit }; },
    roster(operation, actor = actors.observer) { return { changeClass: 'DeveloperMapChange', commitClass: 'RestrictedWrite', subtype: 'DeveloperRosterChange', operation, accountId: actor.accountId, observerAdmissionRevision: actor.observerAdmissionRevision }; },
  };
}
function sampleSchemaValues(f = createFixture()) {
  const admitted = f.makeAdmitted(f.reveal()), meta = f.metadata.get(admitted), identity = meta.identity;
  const member = f.membershipReceipt.payload, proposal = clone(member); delete proposal.activatedAtServerEpochMs;
  const observer = f.makeObserverReceipt(), keyPackage = f.buildKeyPackage();
  const acceptanceUnsigned = { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId, worldId: f.ids.world, packageId: keyPackage.context.packageId,
    packageSha256: hash(keyPackage), descriptor: clone(f.descriptor), recipient: clone(keyPackage.context.recipient), acceptanceNonce: nonce() };
  const groupKey = f.context.lookupWorldRelayKey(f.descriptor);
  const acceptanceWithTag = { ...acceptanceUnsigned, keyPossessionTagBase64Url: b64(crypto.createHmac('sha256', groupKey).update(domain('Neurou/world-relay-key-acceptance/v1\0', acceptanceUnsigned)).digest()) };
  const recipientActor = Object.values(f.actors).find(actor => actor.deviceId === keyPackage.context.recipient.deviceId);
  const acceptance = { ...acceptanceWithTag, recipientSignatureBase64Url: sign(recipientActor.signing, domain('Neurou/world-relay-key-acceptance-signature/v1\0', acceptanceWithTag)) };
  const closure = { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId, worldId: f.ids.world, worldDeveloperAccountId: f.actors.developer.accountId,
    effectiveAtServerEpochMs: f.baseTime + 100, accountFactRevision: 1 };
  const coverageEntry = { identity: clone(identity), envelopeSha256: admitted.admissionReceipt.payload.envelopeSha256, appendedAt: clone(meta.header.appendedAt),
    admissionRevision: admitted.admissionReceipt.payload.admissionRevision, applyResult: 'Applied', finalDiagnostic: null };
  const checkpointState = clone(f.genesis.initialState); checkpointState.revealedResidueEntityIds = [f.ids.residue];
  const seal = f.makeSeal([admitted]);
  const checkpointUnsigned = { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId: f.ids.world, genesisSha256: f.context.genesisSha256, parentCheckpointSha256: null,
    coveredThroughEpochMs: f.baseTime, settlementSeal: seal, developerClosure: null, coverage: [coverageEntry], coverageSha256: hash([coverageEntry]),
    state: checkpointState, stateSha256: hash(checkpointState) };
  const checkpoint = { ...checkpointUnsigned, checkpointSha256: hash(checkpointUnsigned) };
  const cursor = { relayGeneration: 1, position: '0' };
  const mapEdit = f.mapEdit({ operation: 'ReplaceEntity', target: { kind: 'Entity', entityId: f.ids.entityA }, definition: clone(f.genesis.initialState.entities[2].definition) });
  return {
    WorldCommitIdentity: identity, SharedPosition: { lateralMilli: 0, depthMilli: 0 }, SharedContentReference: f.genesis.initialState.entities[0].definition.content,
    WorldSharedGenesis: f.genesis, AuthorSequenceSegment: admitted.sequenceSegmentReceipt.payload, SharedAppendedAt: meta.header.appendedAt,
    WorldAppendPermit: admitted.appendPermitReceipt.payload, WorldCommitAdmission: admitted.admissionReceipt.payload,
    WorldCommitAdmissionClaim: admitted.admissionClaim.claim, SignedWorldCommitAdmissionClaim: admitted.admissionClaim,
    WorldDeveloperClosureFact: closure, WorldCommitRejection: { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId, worldId: f.ids.world, identity: clone(identity),
      envelopeSha256: admitted.admissionReceipt.payload.envelopeSha256, appendedAt: clone(meta.header.appendedAt), rejectedAtServerEpochMs: f.baseTime + 4_000_000, reason: 'TimeTooLate', previouslyAdmitted: false },
    WorldAuthorKeyBinding: admitted.authorKeyBindingReceipt.payload, WorldChangeClass: 'MonotonicReveal', SharedCommitClass: 'Monotonic',
    MonotonicRevealChange: f.reveal(), TraceTouchChange: f.touch(), EditTarget: { kind: 'Entity', entityId: f.ids.entityA },
    SharedMapEntityDefinition: f.genesis.initialState.entities[0].definition, SharedTriggerDefinition: f.trigger, MapEditOperation: mapEdit.edit,
    MapEditCommitChange: mapEdit, DeveloperRosterChange: f.roster('AddCoDeveloper'), WorldChange: f.reveal(), WorldCommit: meta.body,
    RestrictedWriteHeader: null, RelayCommitHeader: meta.header, WrappedRelayDataKey: meta.envelope.wrappedCommitDataKey,
    RelayCommitEnvelope: meta.envelope, AdmittedWorldCommit: admitted, SharedEntityRecord: f.genesis.initialState.entities[0],
    SharedTriggerRecord: f.genesis.initialState.triggers[0], TraceTouchAggregate: { traceTouchId: f.ids.traceTouch, normalTraceEntityId: f.ids.trace, totalTouchUnits: '1', aggregateStrength: 1 },
    DeveloperRosterState: f.genesis.initialState.developerRoster, SharedWorldState: f.genesis.initialState,
    WorldChangeLogWire: { schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId: f.ids.world, genesisSha256: f.context.genesisSha256, baseCheckpointSha256: null, developerClosure: null, commits: [admitted] },
    RelaySettlementSeal: seal.payload, CheckpointCoverageEntry: coverageEntry, WorldCheckpointWire: checkpoint, SharedSettlementPolicy: f.policy, RelayCursor: cursor,
    RelayPullReply: { kind: 'Batch', worldId: f.ids.world, after: cursor, next: { relayGeneration: 1, position: '1' }, commits: [admitted], retentionFloor: cursor },
    SharedAuthorityReceipt: admitted.admissionReceipt, WorldKeyAgreementPublicKey: f.credentials[0].keyAgreementPublicKey,
    WorldDeveloperTrustAnchor: f.anchor, WorldObserverAdmissionFact: observer.payload, WorldMemberCredential: f.credentials[1], WorldRelayKeyDescriptor: f.descriptor,
    WorldMembershipEpoch: member, WorldMembershipEpochProposal: proposal,
    WorldMembershipChange: { schemaVersion: 1, serviceInstanceId: f.context.serviceInstanceId, changeId: crypto.randomUUID(), requestNonce: nonce(), worldId: f.ids.world,
      expectedMembershipEpoch: null, reason: 'Initial', next: proposal },
    WorldRelayKeyPackageContext: keyPackage.context, WorldRelayKeyPackage: keyPackage, WorldRelayKeyAcceptance: acceptance,
  };
}
module.exports = { createFixture, sampleSchemaValues, cryptoPort, clone, jcs, bytes, hash, b64, from64, concat, domain, sign, nonce, uid, keyPair, hkdf, encrypt };
