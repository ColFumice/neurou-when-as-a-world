import type { SharedSchemaKind, SharedSchemaMap } from './SharedCommitContracts';
import { SharedCanonicalBytes, SharedSchemaError } from './SharedCanonicalBytes';

type SharedData = { [key: string]: unknown };
type SharedRule = (value: unknown) => void;
type SharedFields = { [key: string]: SharedRule };

function fail(code: 'SchemaInvalid' | 'ValueInvalid' | 'InvariantInvalid' | 'LimitExceeded', message: string): never {
  throw new SharedSchemaError(code, message);
}
function data(value: unknown): SharedData {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) { fail('SchemaInvalid', 'Expected object'); }
  return value as SharedData;
}
function fields(required: SharedFields): SharedRule {
  return (value: unknown): void => {
    const object = data(value);
    const names = Object.keys(object);
    const wanted = Object.keys(required);
    if (names.length !== wanted.length || names.some((name) => !Object.prototype.hasOwnProperty.call(required, name))) {
      fail('SchemaInvalid', 'Unexpected or missing field');
    }
    for (const name of wanted) { required[name](object[name]); }
  };
}
function literal(expected: unknown): SharedRule {
  return (value: unknown): void => { if (value !== expected) { fail('ValueInvalid', 'Unexpected literal'); } };
}
function oneOf(values: readonly unknown[]): SharedRule {
  return (value: unknown): void => { if (values.indexOf(value) < 0) { fail('ValueInvalid', 'Unexpected enum value'); } };
}
function stringPattern(pattern: RegExp): SharedRule {
  return (value: unknown): void => { if (typeof value !== 'string' || !pattern.test(value)) { fail('ValueInvalid', 'Invalid string value'); } };
}
function integer(minimum: number, maximum: number = Number.MAX_SAFE_INTEGER): SharedRule {
  return (value: unknown): void => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) {
      fail('ValueInvalid', 'Integer outside allowed range');
    }
  };
}
function nullable(rule: SharedRule): SharedRule {
  return (value: unknown): void => { if (value !== null) { rule(value); } };
}
function array(rule: SharedRule): SharedRule {
  return (value: unknown): void => {
    if (!Array.isArray(value)) { fail('SchemaInvalid', 'Expected array'); }
    for (const item of value) { rule(item); }
  };
}
function alternative(rules: readonly SharedRule[]): SharedRule {
  return (value: unknown): void => {
    for (const rule of rules) {
      try { rule(value); return; } catch (error) { if (!(error instanceof SharedSchemaError)) { throw error; } }
    }
    fail('SchemaInvalid', 'No exact union alternative');
  };
}
function reference(kind: SharedSchemaKind): SharedRule {
  return (value: unknown): void => { inspect(kind, value); };
}
function binary(length?: number, minimum: number = 0, maximum: number = Number.MAX_SAFE_INTEGER): SharedRule {
  return (value: unknown): void => {
    if (typeof value !== 'string') { fail('ValueInvalid', 'Expected base64url string'); }
    if (value.length > Math.ceil(maximum * 4 / 3)) { fail('LimitExceeded', 'Encoded byte length outside limit'); }
    const bytes = SharedCanonicalBytes.base64UrlDecode(value, length);
    if (bytes.length < minimum || bytes.length > maximum) { fail('LimitExceeded', 'Decoded byte length outside limit'); }
  };
}
function decimal(maximum: string): SharedRule {
  return (value: unknown): void => {
    if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > maximum.length
      || (value.length === maximum.length && value > maximum)) { fail('ValueInvalid', 'Invalid unsigned decimal'); }
  };
}
function requireInvariant(condition: boolean, message: string): void {
  if (!condition) { fail('InvariantInvalid', message); }
}
function same(first: unknown, second: unknown): boolean {
  return SharedCanonicalBytes.equalBytes(SharedCanonicalBytes.encode(first), SharedCanonicalBytes.encode(second));
}
function sorted(values: readonly unknown[], key: (value: unknown) => string): void {
  let previous: string | null = null;
  for (const value of values) {
    const next = key(value);
    requireInvariant(previous === null || previous < next, 'Unsorted or duplicate identity');
    previous = next;
  }
}
function identityKey(value: unknown): string {
  const identity = data(value);
  return String(identity.authorAccountId) + ':' + String(identity.authorSequence);
}
function order(first: SharedData, second: SharedData): number {
  const time = (data(first.appendedAt).epochMs as number) - (data(second.appendedAt).epochMs as number);
  if (time !== 0) { return time; }
  const a = data(first.identity); const b = data(second.identity);
  if (a.authorAccountId !== b.authorAccountId) { return (a.authorAccountId as string) < (b.authorAccountId as string) ? -1 : 1; }
  return (a.authorSequence as number) - (b.authorSequence as number);
}

const version = literal(1);
const profile = literal('ExternalSharedOnlineV1');
const uuid = stringPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const instance = stringPattern(/^[A-Za-z0-9_.-]{3,128}$/);
const digest = stringPattern(/^[0-9a-f]{64}$/);
const fingerprint = binary(32);
const nonnegative = integer(0);
const positive = integer(1);
const bool = oneOf([true, false]);
const signature = binary(64);
const nonce = binary(32);
const uint128 = decimal('340282366920938463463374607431768211455');
const uint64 = decimal('18446744073709551615');
const key = fields({ kty: literal('EC'), crv: literal('P-256'), x: binary(32), y: binary(32) });
const recordFields: SharedFields = {
  definition: reference('SharedMapEntityDefinition'), createdBy: nullable(reference('WorldCommitIdentity')),
  lastEditedBy: nullable(reference('WorldCommitIdentity')), deletedBy: nullable(reference('WorldCommitIdentity')),
};
const triggerRecordFields: SharedFields = { ...recordFields, definition: reference('SharedTriggerDefinition') };
const membershipFields: SharedFields = {
  schemaVersion: version, serviceInstanceId: instance, worldId: uuid, membershipEpoch: positive,
  previousMembershipEpoch: nullable(positive), key: reference('WorldRelayKeyDescriptor'),
  credentials: array(reference('WorldMemberCredential')), developerTrustAnchorSha256: digest,
  developerSignatureBase64Url: signature,
};

const schemaRules: { [kind: string]: SharedRule } = {
  WorldCommitIdentity: fields({ authorAccountId: uuid, authorSequence: positive }),
  SharedPosition: fields({ lateralMilli: integer(-1000000000, 1000000000), depthMilli: integer(-1000000000, 1000000000) }),
  SharedContentReference: fields({ contentId: stringPattern(/^[A-Za-z0-9_.:/-]{1,128}$/), contentSha256: digest }),
  SharedAppendedAt: fields({ epochMs: nonnegative }),
  WorldSharedGenesis: fields({
    schemaVersion: version, profile, worldId: uuid, mapId: uuid, contentRevision: positive,
    contentManifestSha256: digest, worldDeveloperAccountId: uuid,
    developerTrustAnchor: reference('WorldDeveloperTrustAnchor'), initialState: reference('SharedWorldState'),
  }),
  AuthorSequenceSegment: fields({
    schemaVersion: version, serviceInstanceId: instance, segmentId: uuid, authorAccountId: uuid,
    authorDeviceId: uuid, authorDeviceGeneration: positive, worldId: uuid, membershipEpoch: positive,
    firstSequence: positive, lastSequence: positive, issuedAtServerEpochMs: nonnegative, expiresAtServerEpochMs: nonnegative,
  }),
  WorldAppendPermit: fields({
    schemaVersion: version, serviceInstanceId: instance, permitId: uuid, requestNonce: nonce, worldId: uuid,
    identity: reference('WorldCommitIdentity'), authorDeviceId: uuid, authorDeviceGeneration: positive,
    segmentId: uuid, membershipEpoch: positive, keyEpoch: positive, changeClass: reference('WorldChangeClass'),
    appendedAt: reference('SharedAppendedAt'), expiresAtServerEpochMs: nonnegative, clockGeneration: positive,
    clockStatus: literal('Trusted'),
  }),
  WorldCommitAdmission: fields({
    schemaVersion: version, serviceInstanceId: instance, worldId: uuid, identity: reference('WorldCommitIdentity'),
    envelopeSha256: digest, appendedAt: reference('SharedAppendedAt'), admittedAtServerEpochMs: nonnegative,
    admissionRevision: positive, membershipEpoch: positive, rosterTargetObserverActiveAtAppendedAt: nullable(bool),
  }),
  WorldCommitAdmissionClaim: fields({ schemaVersion: version, serviceInstanceId: instance, requestNonce: nonce,
    header: reference('RelayCommitHeader'), envelopeSha256: digest }),
  SignedWorldCommitAdmissionClaim: fields({ claim: reference('WorldCommitAdmissionClaim'), authorSignatureBase64Url: signature }),
  WorldDeveloperClosureFact: fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid,
    worldDeveloperAccountId: uuid, effectiveAtServerEpochMs: nonnegative, accountFactRevision: positive }),
  WorldCommitRejection: fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid,
    identity: reference('WorldCommitIdentity'), envelopeSha256: digest, appendedAt: reference('SharedAppendedAt'),
    rejectedAtServerEpochMs: nonnegative, reason: oneOf(['TimeTooLate', 'PermitExpired', 'EpochClosed', 'IdentityConflict']),
    previouslyAdmitted: literal(false) }),
  WorldAuthorKeyBinding: fields({ schemaVersion: version, serviceInstanceId: instance, authorAccountId: uuid,
    authorDeviceId: uuid, authorDeviceGeneration: positive, authorSigningPublicJwk: key,
    authorSigningKeyFingerprint: fingerprint, registeredAtServerEpochMs: nonnegative, assurance: literal('RegisteredCredential') }),
  WorldChangeClass: oneOf(['MonotonicReveal', 'TraceTouch', 'DeveloperMapChange']),
  SharedCommitClass: oneOf(['Monotonic', 'AddOnly', 'RestrictedWrite']),
  MonotonicRevealChange: fields({ changeClass: literal('MonotonicReveal'), commitClass: literal('Monotonic'), entityId: uuid, revealed: literal(true) }),
  TraceTouchChange: fields({ changeClass: literal('TraceTouch'), commitClass: literal('AddOnly'), traceTouchId: uuid,
    normalTraceEntityId: uuid, touchUnits: literal(1) }),
  EditTarget: alternative([fields({ kind: literal('Entity'), entityId: uuid }), fields({ kind: literal('Trigger'), triggerId: uuid })]),
  SharedMapEntityDefinition: fields({ entityId: uuid, elementType: oneOf(['Initial', 'Process', 'Trace', 'Residue']),
    position: reference('SharedPosition'), content: reference('SharedContentReference'),
    normalTrace: nullable(fields({ traceTouchId: uuid, tier: oneOf(['Common', 'Deep', 'Rain']) })) }),
  SharedTriggerDefinition: fields({ triggerId: uuid, anchorEntityId: uuid,
    activation: alternative([fields({ kind: literal('Proximity'), radiusMilli: integer(1, 1000000) }), fields({ kind: literal('Interaction') })]),
    action: fields({ kind: literal('RevealResidue'), targetEntityId: uuid }) }),
  MapEditOperation: alternative([
    fields({ operation: oneOf(['CreateEntity', 'ReplaceEntity']), target: fields({ kind: literal('Entity'), entityId: uuid }), definition: reference('SharedMapEntityDefinition') }),
    fields({ operation: literal('DeleteEntity'), target: fields({ kind: literal('Entity'), entityId: uuid }) }),
    fields({ operation: oneOf(['CreateTrigger', 'ReplaceTrigger']), target: fields({ kind: literal('Trigger'), triggerId: uuid }), definition: reference('SharedTriggerDefinition') }),
    fields({ operation: literal('DeleteTrigger'), target: fields({ kind: literal('Trigger'), triggerId: uuid }) }),
  ]),
  MapEditCommitChange: fields({ changeClass: literal('DeveloperMapChange'), commitClass: literal('RestrictedWrite'),
    subtype: literal('MapEditCommit'), edit: reference('MapEditOperation') }),
  DeveloperRosterChange: fields({ changeClass: literal('DeveloperMapChange'), commitClass: literal('RestrictedWrite'),
    subtype: literal('DeveloperRosterChange'), operation: oneOf(['AddCoDeveloper', 'RemoveCoDeveloper']), accountId: uuid,
    observerAdmissionRevision: positive }),
  WorldChange: alternative([reference('MonotonicRevealChange'), reference('TraceTouchChange'), reference('MapEditCommitChange'), reference('DeveloperRosterChange')]),
  WorldCommit: fields({ schemaVersion: version, profile, worldId: uuid, mapId: uuid, contentManifestSha256: digest,
    identity: reference('WorldCommitIdentity'), authorDeviceId: uuid, authorDeviceGeneration: positive, segmentId: uuid,
    permitId: uuid, membershipEpoch: positive, keyEpoch: positive, appendedAt: reference('SharedAppendedAt'), change: reference('WorldChange') }),
  RestrictedWriteHeader: nullable(alternative([
    fields({ subtype: literal('MapEditCommit') }),
    fields({ subtype: literal('DeveloperRosterChange'), operation: oneOf(['AddCoDeveloper', 'RemoveCoDeveloper']), accountId: uuid, observerAdmissionRevision: positive }),
  ])),
  RelayCommitHeader: fields({ schemaVersion: version, profile, kind: literal('RelayWorldCommit'), serviceInstanceId: instance,
    worldId: uuid, identity: reference('WorldCommitIdentity'), authorDeviceId: uuid, authorDeviceGeneration: positive,
    authorSigningKeyFingerprint: fingerprint, segmentId: uuid, permitId: uuid, membershipEpoch: positive, keyEpoch: positive,
    worldRelayKeyId: uuid, appendedAt: reference('SharedAppendedAt'), changeClass: reference('WorldChangeClass'),
    commitClass: reference('SharedCommitClass'), restrictedWrite: reference('RestrictedWriteHeader'), cipherSuite: literal('AES-256-GCM-HKDF-SHA256-v1') }),
  WrappedRelayDataKey: fields({ nonceBase64Url: binary(12), ciphertextAndTagBase64Url: binary(48) }),
  RelayCommitEnvelope: fields({ header: reference('RelayCommitHeader'), wrappedCommitDataKey: reference('WrappedRelayDataKey'),
    nonceBase64Url: binary(12), ciphertextAndTagBase64Url: binary(undefined, 16, 65536), authorSignatureBase64Url: signature }),
  AdmittedWorldCommit: fields({ envelopeBytesBase64Url: binary(undefined, 0, 65536),
    appendPermitReceipt: reference('SharedAuthorityReceipt'), sequenceSegmentReceipt: reference('SharedAuthorityReceipt'),
    admissionReceipt: reference('SharedAuthorityReceipt'), admissionClaim: reference('SignedWorldCommitAdmissionClaim'),
    authorKeyBindingReceipt: reference('SharedAuthorityReceipt'), membershipEpochReceipt: reference('SharedAuthorityReceipt'),
    rosterObserverAdmissionReceipt: nullable(reference('SharedAuthorityReceipt')) }),
  SharedEntityRecord: fields(recordFields),
  SharedTriggerRecord: fields(triggerRecordFields),
  TraceTouchAggregate: fields({ traceTouchId: uuid, normalTraceEntityId: uuid, totalTouchUnits: uint128, aggregateStrength: integer(0, 65535) }),
  DeveloperRosterState: fields({ worldDeveloperAccountId: uuid, coDeveloperAccountIds: array(uuid), frozen: bool }),
  SharedWorldState: fields({ schemaVersion: version, profile, worldId: uuid, mapId: uuid, contentManifestSha256: digest,
    entities: array(reference('SharedEntityRecord')), triggers: array(reference('SharedTriggerRecord')),
    revealedResidueEntityIds: array(uuid), traceTouches: array(reference('TraceTouchAggregate')), developerRoster: reference('DeveloperRosterState') }),
  WorldChangeLogWire: fields({ schemaVersion: version, profile, worldId: uuid, genesisSha256: digest,
    baseCheckpointSha256: nullable(digest), developerClosure: nullable(reference('SharedAuthorityReceipt')), commits: array(reference('AdmittedWorldCommit')) }),
  RelaySettlementSeal: fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, sealRevision: positive,
    policySha256: digest, issuedAtServerEpochMs: nonnegative, sealedThroughEpochMs: nonnegative, admittedCommitCount: nonnegative,
    admittedPrefixSha256: digest, developerClosureSha256: nullable(digest), previousSealSha256: nullable(digest) }),
  CheckpointCoverageEntry: fields({ identity: reference('WorldCommitIdentity'), envelopeSha256: digest,
    appendedAt: reference('SharedAppendedAt'), admissionRevision: positive, applyResult: oneOf(['Applied', 'NoEffect', 'RevertedEdit', 'InvalidChange']),
    finalDiagnostic: nullable(oneOf(['MergeConflict', 'RevertedEdit', 'InvalidChange'])) }),
  WorldCheckpointWire: fields({ schemaVersion: version, profile, worldId: uuid, genesisSha256: digest,
    parentCheckpointSha256: nullable(digest), coveredThroughEpochMs: nonnegative, settlementSeal: reference('SharedAuthorityReceipt'),
    developerClosure: nullable(reference('SharedAuthorityReceipt')), coverage: array(reference('CheckpointCoverageEntry')),
    coverageSha256: digest, state: reference('SharedWorldState'), stateSha256: digest, checkpointSha256: digest }),
  SharedSettlementPolicy: fields({ schemaVersion: version, offlineGraceMs: nonnegative, boundedRelayDelayMs: nonnegative,
    timeUncertaintyAllowanceMs: nonnegative, settleHorizonMs: nonnegative, retentionMs: nonnegative }),
  RelayCursor: fields({ relayGeneration: positive, position: uint64 }),
  RelayPullReply: alternative([
    fields({ kind: literal('Batch'), worldId: uuid, after: reference('RelayCursor'), next: reference('RelayCursor'), commits: array(reference('AdmittedWorldCommit')), retentionFloor: reference('RelayCursor') }),
    fields({ kind: literal('Gap'), worldId: uuid, after: reference('RelayCursor'), retentionFloor: reference('RelayCursor'), reason: oneOf(['RetentionExpired', 'RelayGenerationChanged', 'MissingAdmittedEnvelope']) }),
  ]),
  SharedAuthorityReceipt: fields({ schemaVersion: version, serviceInstanceId: instance,
    purpose: oneOf(['SequenceSegment', 'WorldAppendPermit', 'WorldCommitAdmission', 'WorldCommitRejection', 'AuthorKeyBinding', 'RelaySettlementSeal', 'WorldMembership', 'WorldDeveloperClosure']),
    receiptId: uuid, keyId: fingerprint, requestNonce: nonce, issuedAtServerEpochMs: nonnegative,
    clockGeneration: positive, clockStatus: literal('Trusted'), payload: (): void => {}, signatureBase64Url: signature }),
  WorldKeyAgreementPublicKey: key,
  WorldDeveloperTrustAnchor: fields({ schemaVersion: version, worldId: uuid, worldDeveloperAccountId: uuid,
    developerSigningKeyId: fingerprint, developerPublicKey: key, developerPublicKeyFingerprint: fingerprint }),
  WorldObserverAdmissionFact: fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, observerAccountId: uuid,
    observerAdmissionRevision: positive, accessCodeRevision: positive, admittedAtServerEpochMs: nonnegative, developerTrustAnchorSha256: digest }),
  WorldMemberCredential: fields({ accountId: uuid, observerAdmissionRevision: nullable(positive), deviceId: uuid,
    deviceGeneration: positive, registeredSigningKeyFingerprint: fingerprint, keyAgreementPublicKey: key, keyAgreementKeyFingerprint: fingerprint }),
  WorldRelayKeyDescriptor: fields({ schemaVersion: version, worldId: uuid, membershipEpoch: positive, keyEpoch: positive,
    worldRelayKeyId: uuid, keyCommitmentSha256: digest }),
  WorldMembershipEpoch: fields({ ...membershipFields, activatedAtServerEpochMs: nonnegative }),
  WorldMembershipEpochProposal: fields(membershipFields),
  WorldMembershipChange: fields({ schemaVersion: version, serviceInstanceId: instance, changeId: uuid, requestNonce: nonce,
    worldId: uuid, expectedMembershipEpoch: nullable(positive), reason: oneOf(['Initial', 'MemberAdded', 'MemberRemoved', 'CredentialAdded', 'CredentialRemoved', 'KeyCompromise']), next: reference('WorldMembershipEpochProposal') }),
  WorldRelayKeyPackageContext: fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, packageId: uuid,
    descriptor: reference('WorldRelayKeyDescriptor'), recipient: reference('WorldMemberCredential'), developerTrustAnchorSha256: digest,
    developerSigningKeyId: fingerprint, cipherSuite: literal('AES-256-GCM-HKDF-SHA256-v1') }),
  WorldRelayKeyPackage: fields({ context: reference('WorldRelayKeyPackageContext'), ephemeralKeyAgreementPublicKey: key,
    saltBase64Url: binary(32), nonceBase64Url: binary(12), ciphertextAndTagBase64Url: binary(48), developerSignatureBase64Url: signature }),
  WorldRelayKeyAcceptance: fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, packageId: uuid,
    packageSha256: digest, descriptor: reference('WorldRelayKeyDescriptor'), recipient: reference('WorldMemberCredential'),
    acceptanceNonce: nonce, keyPossessionTagBase64Url: binary(32), recipientSignatureBase64Url: signature }),
};

function receiptPayload(receipt: SharedData, expectedPurpose?: string): SharedData {
  if (expectedPurpose !== undefined) { requireInvariant(receipt.purpose === expectedPurpose, 'Wrong receipt purpose'); }
  return data(receipt.payload);
}

function inspect(kind: SharedSchemaKind, value: unknown): void {
  const rule = schemaRules[kind];
  if (!rule || !Object.prototype.hasOwnProperty.call(schemaRules, kind)) { fail('SchemaInvalid', 'Unknown schema kind'); }
  rule(value);
  if (typeof value !== 'object' || value === null) { return; }
  const object = data(value);
  switch (kind) {
    case 'AuthorSequenceSegment': {
      requireInvariant((object.lastSequence as number) - (object.firstSequence as number) === 1023, 'Segment must contain exactly 1024 numbers');
      requireInvariant((object.expiresAtServerEpochMs as number) - (object.issuedAtServerEpochMs as number) === 3600000, 'Wrong segment lifetime');
      break;
    }
    case 'WorldAppendPermit': {
      requireInvariant((object.expiresAtServerEpochMs as number) - (data(object.appendedAt).epochMs as number) === 30000, 'Wrong permit lifetime');
      requireInvariant(object.membershipEpoch === object.keyEpoch, 'Epochs must match in schema 1');
      break;
    }
    case 'WorldCommitAdmission':
      requireInvariant((object.admittedAtServerEpochMs as number) >= (data(object.appendedAt).epochMs as number), 'Admission predates append'); break;
    case 'WorldCommitRejection':
      requireInvariant((object.rejectedAtServerEpochMs as number) >= (data(object.appendedAt).epochMs as number), 'Rejection predates append'); break;
    case 'WorldCommitAdmissionClaim':
      requireInvariant(object.serviceInstanceId === data(object.header).serviceInstanceId, 'Claim instance mismatch'); break;
    case 'MapEditOperation': {
      if (object.definition !== undefined) {
        const target = data(object.target); const definition = data(object.definition);
        requireInvariant(target.kind === 'Entity' ? target.entityId === definition.entityId : target.triggerId === definition.triggerId, 'Edit target and definition mismatch');
      }
      break;
    }
    case 'SharedMapEntityDefinition':
      requireInvariant(object.normalTrace === null || object.elementType === 'Trace', 'Normal Trace descriptor on non-Trace');
      requireInvariant(object.normalTrace === null || data(object.normalTrace).traceTouchId !== object.entityId,
        'Entity and touch stable identities collide'); break;
    case 'SharedTriggerDefinition':
      requireInvariant(object.triggerId !== object.anchorEntityId && object.triggerId !== data(object.action).targetEntityId,
        'Trigger and entity stable identities collide'); break;
    case 'TraceTouchChange':
      requireInvariant(object.traceTouchId !== object.normalTraceEntityId, 'Trace and touch stable identities collide'); break;
    case 'WorldCommit':
      requireInvariant(object.membershipEpoch === object.keyEpoch, 'Commit epochs mismatch');
      if (SharedCanonicalBytes.encode(object).length > 49152) { fail('LimitExceeded', 'Commit plaintext limit'); }
      break;
    case 'RelayCommitHeader': {
      const pairs: { [key: string]: string } = { MonotonicReveal: 'Monotonic', TraceTouch: 'AddOnly', DeveloperMapChange: 'RestrictedWrite' };
      requireInvariant(object.commitClass === pairs[object.changeClass as string], 'Commit class mismatch');
      requireInvariant((object.changeClass === 'DeveloperMapChange') === (object.restrictedWrite !== null), 'Restricted header mismatch');
      requireInvariant(object.membershipEpoch === object.keyEpoch, 'Header epochs mismatch');
      break;
    }
    case 'RelayCommitEnvelope':
      if (SharedCanonicalBytes.encode(object).length > 65536) { fail('LimitExceeded', 'Relay envelope limit'); } break;
    case 'AdmittedWorldCommit': admittedInvariants(object); break;
    case 'SharedEntityRecord': case 'SharedTriggerRecord':
      requireInvariant(object.createdBy === null || object.lastEditedBy !== null, 'Created record has no edit attribution');
      requireInvariant(object.deletedBy === null || same(object.deletedBy, object.lastEditedBy), 'Deleted record attribution mismatch'); break;
    case 'TraceTouchAggregate': {
      requireInvariant(object.traceTouchId !== object.normalTraceEntityId, 'Trace and touch stable identities collide');
      const total = object.totalTouchUnits as string;
      const strength = total.length > 5 || (total.length === 5 && total > '65535') ? 65535 : Number(total);
      requireInvariant(object.aggregateStrength === strength, 'Touch aggregate mismatch'); break;
    }
    case 'DeveloperRosterState':
      sorted(object.coDeveloperAccountIds as unknown[], (item) => item as string);
      requireInvariant((object.coDeveloperAccountIds as unknown[]).indexOf(object.worldDeveloperAccountId) < 0, 'Root duplicated as CoDeveloper'); break;
    case 'SharedWorldState': stateInvariants(object); break;
    case 'WorldSharedGenesis': genesisInvariants(object); break;
    case 'WorldChangeLogWire': logInvariants(object); break;
    case 'WorldCheckpointWire': checkpointInvariants(object); break;
    case 'CheckpointCoverageEntry': {
      if (object.applyResult === 'RevertedEdit' || object.applyResult === 'InvalidChange') {
        requireInvariant(object.finalDiagnostic === object.applyResult, 'Business rejection diagnostic mismatch');
      } else { requireInvariant(object.finalDiagnostic === null || object.finalDiagnostic === 'MergeConflict', 'Unexpected successful-step diagnostic'); }
      break;
    }
    case 'RelaySettlementSeal':
      requireInvariant((object.sealedThroughEpochMs as number) <= (object.issuedAtServerEpochMs as number), 'Seal predates boundary'); break;
    case 'SharedSettlementPolicy': {
      const sum = (object.offlineGraceMs as number) + (object.boundedRelayDelayMs as number) + (object.timeUncertaintyAllowanceMs as number);
      requireInvariant(Number.isSafeInteger(sum) && (object.settleHorizonMs as number) >= sum && (object.retentionMs as number) >= (object.settleHorizonMs as number), 'Settlement retention inequality'); break;
    }
    case 'SharedAuthorityReceipt': authorityReceiptInvariants(object); break;
    case 'WorldDeveloperTrustAnchor':
      requireInvariant(object.developerSigningKeyId === object.developerPublicKeyFingerprint, 'Developer signing key ID mismatch'); break;
    case 'WorldMemberCredential':
      requireInvariant(object.registeredSigningKeyFingerprint !== object.keyAgreementKeyFingerprint, 'Signing and agreement key purposes must be distinct'); break;
    case 'WorldRelayKeyDescriptor':
      requireInvariant(object.membershipEpoch === object.keyEpoch, 'Key descriptor epochs mismatch'); break;
    case 'WorldMembershipEpoch': case 'WorldMembershipEpochProposal': membershipInvariants(object); break;
    case 'WorldMembershipChange': {
      const next = data(object.next);
      requireInvariant(object.worldId === next.worldId && object.serviceInstanceId === next.serviceInstanceId, 'Membership change context mismatch');
      requireInvariant(object.expectedMembershipEpoch === next.previousMembershipEpoch, 'Membership CAS mismatch');
      requireInvariant((object.reason === 'Initial') === (object.expectedMembershipEpoch === null), 'Initial membership reason mismatch'); break;
    }
    case 'WorldRelayKeyPackageContext':
      requireInvariant(object.worldId === data(object.descriptor).worldId, 'Key package world mismatch'); break;
    case 'WorldRelayKeyAcceptance':
      requireInvariant(object.worldId === data(object.descriptor).worldId, 'Key acceptance world mismatch'); break;
    case 'RelayPullReply': pullInvariants(object); break;
    default: break;
  }
}

function authorityReceiptInvariants(receipt: SharedData): void {
  const purposes: { [purpose: string]: SharedSchemaKind } = {
    SequenceSegment: 'AuthorSequenceSegment', WorldAppendPermit: 'WorldAppendPermit', WorldCommitAdmission: 'WorldCommitAdmission',
    WorldCommitRejection: 'WorldCommitRejection', AuthorKeyBinding: 'WorldAuthorKeyBinding', RelaySettlementSeal: 'RelaySettlementSeal',
    WorldDeveloperClosure: 'WorldDeveloperClosureFact',
  };
  if (receipt.purpose === 'WorldMembership') {
    alternative([reference('WorldMembershipEpoch'), reference('WorldObserverAdmissionFact')])(receipt.payload);
  } else { inspect(purposes[receipt.purpose as string], receipt.payload); }
  const payload = data(receipt.payload);
  requireInvariant(receipt.serviceInstanceId === payload.serviceInstanceId, 'Receipt service mismatch');
  if (payload.requestNonce !== undefined) { requireInvariant(receipt.requestNonce === payload.requestNonce, 'Receipt nonce mismatch'); }
  if (payload.clockGeneration !== undefined) { requireInvariant(receipt.clockGeneration === payload.clockGeneration, 'Receipt clock generation mismatch'); }
  if (receipt.purpose === 'RelaySettlementSeal') { requireInvariant(receipt.issuedAtServerEpochMs === payload.issuedAtServerEpochMs, 'Seal issue time mismatch'); }
  const time = payload.admittedAtServerEpochMs !== undefined ? payload.admittedAtServerEpochMs
    : payload.activatedAtServerEpochMs !== undefined ? payload.activatedAtServerEpochMs
      : payload.registeredAtServerEpochMs !== undefined ? payload.registeredAtServerEpochMs
        : payload.effectiveAtServerEpochMs !== undefined ? payload.effectiveAtServerEpochMs
          : payload.rejectedAtServerEpochMs !== undefined ? payload.rejectedAtServerEpochMs
            : payload.issuedAtServerEpochMs !== undefined ? payload.issuedAtServerEpochMs : data(payload.appendedAt).epochMs;
  requireInvariant((receipt.issuedAtServerEpochMs as number) >= (time as number), 'Receipt predates payload fact');
}

function admittedInvariants(wire: SharedData): void {
  const claim = data(data(wire.admissionClaim).claim);
  const header = data(claim.header);
  const permit = receiptPayload(data(wire.appendPermitReceipt), 'WorldAppendPermit');
  const segment = receiptPayload(data(wire.sequenceSegmentReceipt), 'SequenceSegment');
  const admission = receiptPayload(data(wire.admissionReceipt), 'WorldCommitAdmission');
  const author = receiptPayload(data(wire.authorKeyBindingReceipt), 'AuthorKeyBinding');
  const epoch = receiptPayload(data(wire.membershipEpochReceipt), 'WorldMembership');
  inspect('WorldMembershipEpoch', epoch);
  for (const receiptName of ['appendPermitReceipt', 'sequenceSegmentReceipt', 'admissionReceipt', 'authorKeyBindingReceipt', 'membershipEpochReceipt']) {
    requireInvariant(data(wire[receiptName]).serviceInstanceId === header.serviceInstanceId, 'Wire receipt instance mismatch');
  }
  const identity = data(header.identity);
  for (const item of [permit, admission]) {
    requireInvariant(item.worldId === header.worldId && same(item.identity, header.identity) && same(item.appendedAt, header.appendedAt)
      && item.membershipEpoch === header.membershipEpoch, 'Wire identity, world, time or epoch mismatch');
  }
  requireInvariant(permit.authorDeviceId === header.authorDeviceId && permit.authorDeviceGeneration === header.authorDeviceGeneration
    && permit.permitId === header.permitId && permit.segmentId === header.segmentId && permit.keyEpoch === header.keyEpoch
    && permit.changeClass === header.changeClass, 'Permit header mismatch');
  requireInvariant(segment.segmentId === header.segmentId && segment.authorAccountId === identity.authorAccountId
    && segment.authorDeviceId === header.authorDeviceId && segment.authorDeviceGeneration === header.authorDeviceGeneration
    && segment.worldId === header.worldId && segment.membershipEpoch === header.membershipEpoch, 'Segment header mismatch');
  requireInvariant((identity.authorSequence as number) >= (segment.firstSequence as number)
    && (identity.authorSequence as number) <= (segment.lastSequence as number), 'Author outside segment');
  const appended = data(header.appendedAt).epochMs as number;
  requireInvariant(appended >= (segment.issuedAtServerEpochMs as number) && appended < (segment.expiresAtServerEpochMs as number), 'Append outside segment lifetime');
  requireInvariant((admission.admittedAtServerEpochMs as number) < (permit.expiresAtServerEpochMs as number), 'Admission outside permit lifetime');
  requireInvariant(admission.envelopeSha256 === claim.envelopeSha256, 'Claim and admission digest mismatch');
  requireInvariant(author.authorAccountId === identity.authorAccountId && author.authorDeviceId === header.authorDeviceId
    && author.authorDeviceGeneration === header.authorDeviceGeneration && author.authorSigningKeyFingerprint === header.authorSigningKeyFingerprint
    && (author.registeredAtServerEpochMs as number) <= appended, 'Author registration mismatch');
  const descriptor = data(epoch.key);
  requireInvariant(epoch.worldId === header.worldId && epoch.membershipEpoch === header.membershipEpoch
    && descriptor.keyEpoch === header.keyEpoch && descriptor.worldRelayKeyId === header.worldRelayKeyId
    && (epoch.activatedAtServerEpochMs as number) <= appended, 'Membership epoch mismatch');
  const credentials = epoch.credentials as SharedData[];
  requireInvariant(credentials.some((item) => item.accountId === identity.authorAccountId && item.deviceId === header.authorDeviceId
    && item.deviceGeneration === header.authorDeviceGeneration && item.registeredSigningKeyFingerprint === header.authorSigningKeyFingerprint), 'Author absent from epoch');
  const restricted = header.restrictedWrite === null ? null : data(header.restrictedWrite);
  if (restricted !== null && restricted.subtype === 'DeveloperRosterChange') {
    requireInvariant(wire.rosterObserverAdmissionReceipt !== null, 'Missing roster target admission fact');
    const observer = receiptPayload(data(wire.rosterObserverAdmissionReceipt), 'WorldMembership');
    inspect('WorldObserverAdmissionFact', observer);
    requireInvariant(observer.worldId === header.worldId && observer.observerAccountId === restricted.accountId
      && observer.observerAdmissionRevision === restricted.observerAdmissionRevision
      && observer.serviceInstanceId === header.serviceInstanceId && (observer.admittedAtServerEpochMs as number) <= appended,
    'Roster target source mismatch');
    requireInvariant(restricted.operation === 'AddCoDeveloper' ? typeof admission.rosterTargetObserverActiveAtAppendedAt === 'boolean'
      : admission.rosterTargetObserverActiveAtAppendedAt === null, 'Roster target active flag mismatch');
  } else {
    requireInvariant(wire.rosterObserverAdmissionReceipt === null && admission.rosterTargetObserverActiveAtAppendedAt === null, 'Unexpected roster fact');
  }
}

function membershipInvariants(epoch: SharedData): void {
  const descriptor = data(epoch.key);
  requireInvariant(epoch.worldId === descriptor.worldId && epoch.membershipEpoch === descriptor.membershipEpoch, 'Epoch descriptor mismatch');
  const previous = epoch.previousMembershipEpoch;
  requireInvariant(previous === null ? epoch.membershipEpoch === 1 : (epoch.membershipEpoch as number) - (previous as number) === 1, 'Non-consecutive membership epoch');
  const credentials = epoch.credentials as SharedData[];
  let previousCredential: SharedData | null = null;
  for (const credential of credentials) {
    if (previousCredential !== null) {
      const accountOrder = previousCredential.accountId === credential.accountId ? 0 : (previousCredential.accountId as string) < (credential.accountId as string) ? -1 : 1;
      const deviceOrder = previousCredential.deviceId === credential.deviceId ? 0 : (previousCredential.deviceId as string) < (credential.deviceId as string) ? -1 : 1;
      requireInvariant(accountOrder < 0 || (accountOrder === 0 && deviceOrder < 0), 'Unsorted or duplicate member device');
    }
    previousCredential = credential;
  }
}

function stateInvariants(state: SharedData): void {
  const entities = state.entities as SharedData[];
  const triggers = state.triggers as SharedData[];
  const touches = state.traceTouches as SharedData[];
  sorted(entities, (item) => data(data(item).definition).entityId as string);
  sorted(triggers, (item) => data(data(item).definition).triggerId as string);
  sorted(touches, (item) => data(item).traceTouchId as string);
  sorted(state.revealedResidueEntityIds as unknown[], (item) => item as string);
  const byId: { [id: string]: SharedData } = Object.create(null) as { [id: string]: SharedData };
  const stableIds = new Set<string>([state.mapId as string]);
  const reserveStableId = (id: string): void => {
    requireInvariant(!stableIds.has(id), 'Repeated world-scoped stable identity'); stableIds.add(id);
  };
  for (const entity of entities) {
    const definition = data(entity.definition); byId[definition.entityId as string] = entity;
    reserveStableId(definition.entityId as string);
    if (definition.normalTrace !== null) {
      const id = data(definition.normalTrace).traceTouchId as string;
      reserveStableId(id);
    }
  }
  for (const trigger of triggers) { reserveStableId(data(trigger.definition).triggerId as string); }
  for (const id of state.revealedResidueEntityIds as string[]) {
    requireInvariant(byId[id] !== undefined && data(byId[id].definition).elementType === 'Residue', 'Invalid revealed Residue identity');
  }
  for (const touch of touches) {
    const record = byId[touch.normalTraceEntityId as string];
    requireInvariant(record !== undefined, 'Unknown aggregate Trace entity');
    const definition = data(record.definition);
    requireInvariant(definition.elementType === 'Trace' && definition.normalTrace !== null
      && data(definition.normalTrace).traceTouchId === touch.traceTouchId, 'Aggregate Trace identity mismatch');
  }
  for (const trigger of triggers) {
    const definition = data(trigger.definition); const action = data(definition.action);
    requireInvariant(byId[definition.anchorEntityId as string] !== undefined && byId[action.targetEntityId as string] !== undefined
      && data(byId[action.targetEntityId as string].definition).elementType === 'Residue', 'Unknown or invalid Trigger reference');
  }
}

function genesisInvariants(genesis: SharedData): void {
  const state = data(genesis.initialState); const anchor = data(genesis.developerTrustAnchor);
  requireInvariant(genesis.worldId === state.worldId && genesis.mapId === state.mapId
    && genesis.contentManifestSha256 === state.contentManifestSha256 && genesis.worldId === anchor.worldId
    && genesis.worldDeveloperAccountId === anchor.worldDeveloperAccountId
    && data(state.developerRoster).worldDeveloperAccountId === genesis.worldDeveloperAccountId
    && data(state.developerRoster).frozen === false, 'Genesis context mismatch');
  for (const record of (state.entities as SharedData[]).concat(state.triggers as SharedData[])) {
    requireInvariant(record.createdBy === null && record.lastEditedBy === null && record.deletedBy === null, 'Genesis attribution must be null');
  }
}

function logInvariants(log: SharedData): void {
  const seen = new Set<string>();
  let previous: SharedData | null = null;
  for (const wire of log.commits as SharedData[]) {
    const header = data(data(data(wire.admissionClaim).claim).header);
    requireInvariant(header.worldId === log.worldId, 'Log world mismatch');
    const id = identityKey(header.identity); requireInvariant(!seen.has(id), 'Repeated log identity'); seen.add(id);
    if (previous !== null) { requireInvariant(order(previous, header) < 0, 'Unsorted commit log'); }
    previous = header;
  }
  if (log.developerClosure !== null) {
    const closure = receiptPayload(data(log.developerClosure), 'WorldDeveloperClosure');
    requireInvariant(closure.worldId === log.worldId, 'Log closure world mismatch');
  }
}

function checkpointInvariants(checkpoint: SharedData): void {
  const seal = receiptPayload(data(checkpoint.settlementSeal), 'RelaySettlementSeal');
  requireInvariant(checkpoint.worldId === seal.worldId && checkpoint.worldId === data(checkpoint.state).worldId
    && checkpoint.coveredThroughEpochMs === seal.sealedThroughEpochMs, 'Checkpoint boundary mismatch');
  requireInvariant((checkpoint.coverage as unknown[]).length === seal.admittedCommitCount, 'Coverage count mismatch');
  const seen = new Set<string>(); const revisions = new Set<number>(); let previous: SharedData | null = null;
  for (const entry of checkpoint.coverage as SharedData[]) {
    const id = identityKey(entry.identity); requireInvariant(!seen.has(id), 'Repeated coverage identity'); seen.add(id);
    requireInvariant(!revisions.has(entry.admissionRevision as number), 'Repeated admission revision'); revisions.add(entry.admissionRevision as number);
    requireInvariant((data(entry.appendedAt).epochMs as number) <= (checkpoint.coveredThroughEpochMs as number), 'Coverage exceeds seal');
    if (previous !== null) { requireInvariant(order(previous, entry) < 0, 'Unsorted coverage'); } previous = entry;
  }
  if (checkpoint.developerClosure === null) { requireInvariant(seal.developerClosureSha256 === null, 'Unexpected sealed closure'); }
  else {
    const closure = receiptPayload(data(checkpoint.developerClosure), 'WorldDeveloperClosure');
    requireInvariant(closure.worldId === checkpoint.worldId && (closure.effectiveAtServerEpochMs as number) <= (checkpoint.coveredThroughEpochMs as number)
      && seal.developerClosureSha256 !== null, 'Checkpoint closure mismatch');
  }
}

function pullInvariants(reply: SharedData): void {
  if (reply.kind !== 'Batch') { return; }
  const commits = reply.commits as SharedData[];
  if (commits.length > 256 || SharedCanonicalBytes.encode(reply).length > 1048576) { fail('LimitExceeded', 'Relay batch limit'); }
  const after = data(reply.after); const next = data(reply.next); const floor = data(reply.retentionFloor);
  requireInvariant(after.relayGeneration === next.relayGeneration && next.relayGeneration === floor.relayGeneration, 'Batch generation mismatch');
  const a = after.position as string; const b = next.position as string;
  requireInvariant(a.length < b.length || (a.length === b.length && a <= b), 'Cursor moves backwards');
  for (const commit of commits) {
    requireInvariant(data(data(data(commit.admissionClaim).claim).header).worldId === reply.worldId, 'Batch world mismatch');
  }
}

function immutable(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    for (const keyName of Object.keys(value)) { immutable((value as SharedData)[keyName]); }
    Object.freeze(value);
  }
  return value;
}

/** Shape validation grants no crypto/source/lease capability. Those boundaries remain separate. */
export class SharedCommitCodec {
  validate<K extends SharedSchemaKind>(kind: K, value: unknown): SharedSchemaMap[K] {
    const copy = SharedCanonicalBytes.decode(SharedCanonicalBytes.encode(value));
    inspect(kind, copy);
    return immutable(copy) as SharedSchemaMap[K];
  }

  encode<K extends SharedSchemaKind>(kind: K, value: unknown): Uint8Array {
    return SharedCanonicalBytes.encode(this.validate(kind, value));
  }

  decode<K extends SharedSchemaKind>(kind: K, bytes: Uint8Array): SharedSchemaMap[K] {
    const value = SharedCanonicalBytes.decode(bytes);
    inspect(kind, value);
    return immutable(value) as SharedSchemaMap[K];
  }
}
