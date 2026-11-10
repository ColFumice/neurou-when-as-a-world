import { SharedCanonicalBytes, SharedSchemaError } from './SharedCanonicalBytes';
import { SharedCommitCodec } from './SharedCommitCodec';
import type { SharedSchemaKind } from './SharedCommitContracts';
import type { SharedHttpReply, SharedHttpRequest, SharedProtocolOperation, SharedProtocolSignatureKind } from './SharedServiceProtocolContracts';

type Data = { [name: string]: unknown };
type Rule = (value: unknown) => void;
const core = new SharedCommitCodec();
function bad(message: string): never { throw new SharedSchemaError('SchemaInvalid', message); }
function object(value: unknown): Data {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) { return bad('Expected exact object'); }
  return value as Data;
}
function fields(shape: { [name: string]: Rule }): Rule {
  return value => {
    const data = object(value); const keys = Object.keys(data); const expected = Object.keys(shape);
    if (keys.length !== expected.length || keys.some(key => !Object.prototype.hasOwnProperty.call(shape, key))) { bad('Unexpected or missing field'); }
    for (const key of expected) { shape[key](data[key]); }
  };
}
function literal(wanted: unknown): Rule { return value => { if (value !== wanted) { bad('Wrong literal'); } }; }
function choice(values: readonly unknown[]): Rule { return value => { if (values.indexOf(value) < 0) { bad('Unknown enum'); } }; }
function pattern(regex: RegExp): Rule { return value => { if (typeof value !== 'string' || !regex.test(value)) { bad('Invalid string'); } }; }
function integer(minimum: number, maximum = Number.MAX_SAFE_INTEGER): Rule {
  return value => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) { bad('Invalid integer'); } };
}
function nullable(rule: Rule): Rule { return value => { if (value !== null) { rule(value); } }; }
function binary(length: number): Rule { return value => { if (typeof value !== 'string') { bad('Expected base64url'); } SharedCanonicalBytes.base64UrlDecode(value, length); }; }
function reference(kind: SharedSchemaKind): Rule { return value => { core.validate(kind, value); }; }
function authority(kind: SharedSchemaKind, purpose: string): Rule {
  return value => { reference('SharedAuthorityReceipt')(value); const receipt = object(value); if (receipt.purpose !== purpose) { bad('Wrong authority purpose'); } reference(kind)(receipt.payload); };
}
function array(rule: Rule, limit: number): Rule { return value => { if (!Array.isArray(value) || value.length > limit) { bad('Array limit'); } for (const item of value) { rule(item); } }; }
const version = literal(1); const uuid = pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const instance = pattern(/^[A-Za-z0-9_.-]{3,128}$/); const sha = pattern(/^[0-9a-f]{64}$/);
const positive = integer(1); const time = integer(0); const signature = binary(64); const nonce = binary(32);
const key = reference('WorldKeyAgreementPublicKey'); const credential = reference('WorldMemberCredential');
const authorization = fields({ authorDeviceId: uuid, authorDeviceGeneration: positive, deviceSignatureBase64Url: signature });
const registration = fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, mapId: uuid, worldDeveloperAccountId: uuid, developerTrustAnchorSha256: sha, genesisSha256: sha, contentManifestSha256: sha });
const accessCodeProposal = fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, requestNonce: nonce, expectedCodeRevision: nullable(positive), accessCode: pattern(/^[0-9]{6}$/) });
const challengeContext = fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, challengeId: uuid, requestNonce: nonce, recipient: credential, developerTrustAnchorSha256: sha, challengeNonceBase64Url: nonce, expiresAtServerEpochMs: time });
const credentialChallenge = fields({ context: challengeContext, ephemeralKeyAgreementPublicKey: key, saltBase64Url: nonce, nonceBase64Url: binary(12), ciphertextAndTagBase64Url: binary(48) });
const proofFields = { schemaVersion: version, serviceInstanceId: instance, worldId: uuid, challengeId: uuid, requestNonce: nonce, challengeSha256: sha, recipient: credential, proofTagBase64Url: nonce };
const proof = fields({ ...proofFields, recipientSignatureBase64Url: signature });
const observerChallenge = fields({ schemaVersion: version, serviceInstanceId: instance, worldId: uuid, challengeId: uuid, observerAccountId: uuid, deviceId: uuid, deviceGeneration: positive, nonceBase64Url: nonce, accessCodeRevision: positive, developerTrustAnchorSha256: sha, expiresAtServerEpochMs: time });
function transport(purpose: string, payload: Rule): Rule {
  return fields({ schemaVersion: version, serviceInstanceId: instance, purpose: literal(purpose), receiptId: uuid, requestNonce: nonce, keyId: nonce, payload, signatureBase64Url: signature });
}
function admissionReceipt(value: unknown): void {
  const receipt = object(value);
  if (receipt.purpose === 'WorldCommitAdmission') { authority('WorldCommitAdmission', 'WorldCommitAdmission')(value); }
  else { authority('WorldCommitRejection', 'WorldCommitRejection')(value); }
}
const ackFields = { worldId: uuid, relayGeneration: positive, entries: array(fields({ position: value => reference('RelayCursor')({ relayGeneration: 1, position: value }), identity: reference('WorldCommitIdentity'), envelopeSha256: sha }), 256), authorDeviceId: uuid, authorDeviceGeneration: positive };
function ackOrder(value: unknown): void {
  const entries = object(value).entries as Data[];
  let previous: string | null = null;
  for (const entry of entries) {
    const position = entry.position as string;
    if (previous !== null && (position.length < previous.length || (position.length === previous.length && position <= previous))) { bad('ACK positions must strictly increase'); }
    previous = position;
  }
}
const requests: { [O in SharedProtocolOperation]: Rule } = {
  '/status': fields({}),
  '/world/register': fields({ proposal: registration, developerSignatureBase64Url: signature }),
  '/world/facts': fields({ worldId: uuid, observerAccountId: nullable(uuid) }),
  '/credential/challenge': fields({ worldId: uuid, keyAgreementPublicKey: key, keyAgreementKeyFingerprint: nonce }),
  '/credential/register': fields({ challengeReceipt: transport('AgreementCredentialChallenge', credentialChallenge), proof }),
  '/access-code/set': fields({ proposal: accessCodeProposal, developerSignatureBase64Url: signature }),
  '/observer/challenge': fields({ worldId: uuid, developerTrustAnchorSha256: sha }),
  '/observer/redeem': fields({ challengeReceipt: transport('ObserverChallenge', observerChallenge), accessCode: pattern(/^[0-9]{6}$/) }),
  '/membership/publish': value => { fields({ change: reference('WorldMembershipChange') })(value); const credentials = object(object(object(value).change).next).credentials as unknown[]; if (credentials.length > 256) { bad('Credential limit'); } },
  '/membership/read': fields({ worldId: uuid, membershipEpoch: positive }),
  '/sequence/allocate': fields({ worldId: uuid, membershipEpoch: positive }),
  '/append/permit': fields({ worldId: uuid, identity: reference('WorldCommitIdentity'), segmentId: uuid, membershipEpoch: positive, keyEpoch: positive, changeClass: reference('WorldChangeClass') }),
  '/commit/admit': fields({ admissionClaim: reference('SignedWorldCommitAdmissionClaim'), appendPermitReceipt: authority('WorldAppendPermit', 'WorldAppendPermit'), sequenceSegmentReceipt: authority('AuthorSequenceSegment', 'SequenceSegment') }),
  '/commit/admission': fields({ worldId: uuid, identity: reference('WorldCommitIdentity'), envelopeSha256: sha }),
  '/settlement/seal': fields({ worldId: uuid, sealedThroughEpochMs: time, expectedPreviousSealSha256: nullable(sha) }),
  '/relay/submit': fields({ commit: reference('AdmittedWorldCommit') }),
  '/relay/pull': fields({ worldId: uuid, after: reference('RelayCursor'), maximumCount: integer(1, 256), maximumWaitMs: integer(0, 25000) }),
  '/relay/ack': value => { fields({ ...ackFields, deviceSignatureBase64Url: signature })(value); ackOrder(value); },
};
const limits: { [O in SharedProtocolOperation]: number } = {
  '/status': 16384, '/world/register': 32768, '/world/facts': 16384, '/credential/challenge': 32768,
  '/credential/register': 32768, '/access-code/set': 16384, '/observer/challenge': 16384, '/observer/redeem': 16384,
  '/membership/publish': 524288, '/membership/read': 16384, '/sequence/allocate': 16384, '/append/permit': 32768,
  '/commit/admit': 65536, '/commit/admission': 16384, '/settlement/seal': 16384,
  '/relay/submit': 524288, '/relay/pull': 16384, '/relay/ack': 65536,
};
const readOperations: readonly SharedProtocolOperation[] = ['/status', '/world/facts', '/credential/challenge', '/observer/challenge', '/membership/read', '/commit/admission', '/relay/pull'];
const result = (operation: string, receipt: Rule): Rule => transport('AuthorityResult', fields({ operation: literal(operation), receipt }));
const responses: { [O in SharedProtocolOperation]: Rule } = {
  '/status': transport('SharedServiceStatus', value => {
    fields({ clockGeneration: positive, clockStatus: choice(['Trusted', 'Untrusted']), serverEpochMs: nullable(time), lastSignedEpochMs: nullable(time), policy: reference('SharedSettlementPolicy'), policySha256: sha })(value);
    const status = object(value);
    if ((status.clockStatus === 'Untrusted' && status.serverEpochMs !== null) || (status.clockStatus === 'Trusted' && status.serverEpochMs === null)) { bad('Clock status/sample mismatch'); }
  }),
  '/world/register': transport('WorldRegistration', registration),
  '/world/facts': transport('WorldFacts', fields({ registration, currentMembership: nullable(authority('WorldMembershipEpoch', 'WorldMembership')), requestedObserver: nullable(authority('WorldObserverAdmissionFact', 'WorldMembership')), latestSeal: nullable(authority('RelaySettlementSeal', 'RelaySettlementSeal')), developerClosure: literal(null), policy: reference('SharedSettlementPolicy'), policySha256: sha })),
  '/credential/challenge': transport('AgreementCredentialChallenge', credentialChallenge),
  '/credential/register': transport('AgreementCredential', fields({ credential, challengeSha256: sha, registeredAtServerEpochMs: time, clockGeneration: positive, authorKeyBinding: authority('WorldAuthorKeyBinding', 'AuthorKeyBinding'), observerAdmission: nullable(authority('WorldObserverAdmissionFact', 'WorldMembership')) })),
  '/access-code/set': transport('AccessCodeUpdated', fields({ worldId: uuid, accessCodeRevision: positive, changedAtServerEpochMs: time, clockGeneration: positive })),
  '/observer/challenge': transport('ObserverChallenge', observerChallenge),
  '/observer/redeem': result('/observer/redeem', authority('WorldObserverAdmissionFact', 'WorldMembership')),
  '/membership/publish': result('/membership/publish', authority('WorldMembershipEpoch', 'WorldMembership')),
  '/membership/read': transport('MembershipRead', fields({ epochReceipt: authority('WorldMembershipEpoch', 'WorldMembership') })),
  '/sequence/allocate': result('/sequence/allocate', authority('AuthorSequenceSegment', 'SequenceSegment')),
  '/append/permit': result('/append/permit', authority('WorldAppendPermit', 'WorldAppendPermit')),
  '/commit/admit': result('/commit/admit', admissionReceipt),
  '/commit/admission': transport('AdmissionRead', fields({ receipt: admissionReceipt })),
  '/settlement/seal': result('/settlement/seal', authority('RelaySettlementSeal', 'RelaySettlementSeal')),
  '/relay/submit': transport('RelaySubmit', fields({ worldId: uuid, identity: reference('WorldCommitIdentity'), envelopeSha256: sha, cursor: reference('RelayCursor'), admittedAtServerEpochMs: time, retainedUntilServerEpochMs: time })),
  '/relay/pull': transport('RelayPull', reference('RelayPullReply')),
  '/relay/ack': transport('RelayAck', fields({ worldId: uuid, relayGeneration: positive, accountId: uuid, deviceId: uuid, deviceGeneration: positive, entriesSha256: sha, acknowledgedCount: integer(0, 256) })),
};
const errorDetails = ['SchemaInvalid', 'CanonicalInvalid', 'RequestNonceInvalid', 'LegacyIdentityUnsupported', 'OfflineProofUnsupported', 'VersionUnsupported', 'SessionMissing', 'SessionExpired', 'SessionRevoked', 'AuthenticationMismatch', 'OriginRejected', 'CsrfRejected', 'CredentialMismatch', 'RootPinMismatch', 'MemberNotActive', 'PermissionDenied', 'IdentityConflict', 'IdempotencyConflict', 'EpochClosed', 'MembershipConflict', 'SequenceExhausted', 'PermitConsumed', 'PermitExpired', 'TimeTooLate', 'SealBoundaryConflict', 'PackageConflict', 'IdempotencyExpired', 'MemberAdmissionRejected', 'ResourceLimit', 'RateLimitExceeded', 'ServiceUnavailable', 'RelayUnavailable', 'DatabaseUnavailable', 'FactUnavailable', 'KeyPublisherUnavailable', 'ClockUntrusted'];
const fault = fields({ code: choice(['Unauthenticated', 'DeviceUntrusted', 'AuthorityUnavailable', 'TimeUntrusted', 'VersionUnsupported', 'Conflict', 'RateLimited', 'InvalidData', 'Forbidden']), layer: choice(['Authority', 'Relay', 'Session']), detail: choice(errorDetails), requestId: pattern(/^[A-Za-z0-9_.:-]{1,128}$/), requestNonce: nullable(nonce), retryAfterMs: nullable(time) });
const signaturePadding = SharedCanonicalBytes.base64UrlEncode(new Uint8Array(64));

/** Strict wire only. Crypto, authorization, time, network and storage remain injected platform responsibilities. */
export class SharedServiceProtocolCodec {
  static encode(value: unknown): string { return SharedCanonicalBytes.text(SharedCanonicalBytes.encode(value)); }
  static validatePayload(operation: SharedProtocolOperation, value: unknown): void {
    if (!Object.prototype.hasOwnProperty.call(requests, operation)) { bad('Unknown shared operation'); }
    const copy = SharedCanonicalBytes.decode(SharedCanonicalBytes.encode(value)); requests[operation](copy);
  }
  static parseRequest(operation: SharedProtocolOperation, raw: string): SharedHttpRequest<unknown> {
    if (!Object.prototype.hasOwnProperty.call(limits, operation)) { bad('Unknown shared operation'); }
    const bytes = SharedCanonicalBytes.utf8(raw);
    if (bytes.length > limits[operation]) { throw new SharedSchemaError('LimitExceeded', 'Request resource limit'); }
    const value = SharedCanonicalBytes.decode(bytes);
    fields({ schemaVersion: version, requestNonce: nonce, payload: requests[operation], authorization: readOperations.indexOf(operation) >= 0 ? literal(null) : authorization })(value);
    const request = object(value); const payload = object(request.payload);
    if (operation === '/access-code/set' && object(payload.proposal).requestNonce !== request.requestNonce) { bad('Access-code nonce mismatch'); }
    if (operation === '/membership/publish' && object(payload.change).requestNonce !== request.requestNonce) { bad('Membership nonce mismatch'); }
    if (operation === '/commit/admit' && object(object(payload.admissionClaim).claim).requestNonce !== request.requestNonce) { bad('Admission nonce mismatch'); }
    if (operation === '/credential/register' && object(payload.proof).requestNonce !== request.requestNonce) { bad('Credential proof nonce mismatch'); }
    return value as SharedHttpRequest<unknown>;
  }
  static parseReply(operation: SharedProtocolOperation, raw: string, requestNonce: string): SharedHttpReply<unknown> {
    nonce(requestNonce); if (!Object.prototype.hasOwnProperty.call(responses, operation)) { bad('Unknown operation'); }
    const bytes = SharedCanonicalBytes.utf8(raw); if (bytes.length > 1048576) { throw new SharedSchemaError('LimitExceeded', 'Response resource limit'); }
    const value = SharedCanonicalBytes.decode(bytes); const reply = object(value);
    if (reply.kind === 'Accepted') {
      fields({ kind: literal('Accepted'), value: responses[operation] })(value);
      if (object(reply.value).requestNonce !== requestNonce) { bad('Response nonce mismatch'); }
    } else {
      fields({ kind: literal('Rejected'), fault })(value);
      const failure = object(reply.fault); if (failure.requestNonce !== null && failure.requestNonce !== requestNonce) { bad('Fault nonce mismatch'); }
    }
    return value as SharedHttpReply<unknown>;
  }
  static validateSignatureInput(kind: SharedProtocolSignatureKind, value: unknown): void {
    const copy = SharedCanonicalBytes.decode(SharedCanonicalBytes.encode(value));
    const data = object(copy);
    switch (kind) {
      case 'AdmissionClaim': reference('WorldCommitAdmissionClaim')(copy); break;
      case 'Envelope': if (Object.prototype.hasOwnProperty.call(data, 'authorSignatureBase64Url')) { bad('Expected unsigned envelope'); } reference('RelayCommitEnvelope')({ ...data, authorSignatureBase64Url: signaturePadding }); break;
      case 'CredentialProof': fields(proofFields)(copy); break;
      case 'KeyAcceptance': if (Object.prototype.hasOwnProperty.call(data, 'recipientSignatureBase64Url')) { bad('Expected unsigned acceptance'); } reference('WorldRelayKeyAcceptance')({ ...data, recipientSignatureBase64Url: signaturePadding }); break;
      case 'RelayAck': fields({ serviceInstanceId: instance, requestNonce: nonce, payload: fields(ackFields) })(copy); ackOrder(data.payload); break;
      case 'SharedOperation': {
        fields({ schemaVersion: version, serviceInstanceId: instance, operation: choice(Object.keys(requests)), requestNonce: nonce, authorDeviceId: uuid, authorDeviceGeneration: positive, payload: value => { SharedServiceProtocolCodec.validatePayload(data.operation as SharedProtocolOperation, value); } })(copy); break;
      }
      default: bad('Unknown signature purpose');
    }
  }
}
