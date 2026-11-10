/** B2.5c-2b additive data contracts. No runtime, trust or platform capability is conferred by a type. */
import type { AuthenticatedServiceContext, RealWorldAuthorityPort, RealCommitRelayPort } from './RealServiceContracts';
import type { WorldCommit, WorldCommitIdentity, SharedAuthorityReceipt, WorldMembershipEpoch, WorldMembershipChange, AuthorSequenceSegment, WorldAppendPermit, WorldCommitAdmission, WorldCommitRejection, SignedWorldCommitAdmissionClaim, WorldCommitAdmissionClaim, RelayCommitEnvelope, RelayCommitHeader, RelaySettlementSeal, WorldMemberCredential, WorldObserverAdmissionFact, WorldAuthorKeyBinding, SharedSettlementPolicy, WorldKeyAgreementPublicKey, WorldDeveloperTrustAnchor, WorldMembershipEpochProposal, WorldRelayKeyPackage, WorldRelayKeyPackageContext, WorldRelayKeyAcceptance, AdmittedWorldCommit, RelayCursor, RelayPullReply } from './SharedCommitContracts';
export interface SharedHttpRequest<T> {
    readonly schemaVersion: 1;
    readonly requestNonce: string;
    readonly payload: T;
    readonly authorization: SharedOperationAuthorization | null;
}
export type SharedHttpReply<T> = {
    readonly kind: 'Accepted';
    readonly value: T;
} | {
    readonly kind: 'Rejected';
    readonly fault: SharedServiceFault;
};
export interface SharedServiceFault {
    readonly code: 'Unauthenticated' | 'DeviceUntrusted' | 'AuthorityUnavailable' | 'TimeUntrusted' | 'VersionUnsupported' | 'Conflict' | 'RateLimited' | 'InvalidData' | 'Forbidden';
    readonly layer: 'Authority' | 'Relay' | 'Session';
    readonly detail: SharedServiceErrorCode;
    readonly requestId: string;
    readonly requestNonce: string | null;
    readonly retryAfterMs: number | null;
}
export interface SharedTransportReceipt<T> {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly purpose: 'SharedServiceStatus' | 'WorldRegistration' | 'WorldFacts' | 'AgreementCredentialChallenge' | 'AgreementCredential' | 'AccessCodeUpdated' | 'ObserverChallenge' | 'AuthorityResult' | 'MembershipRead' | 'AdmissionRead' | 'RelaySubmit' | 'RelayPull' | 'RelayAck';
    readonly receiptId: string;
    readonly requestNonce: string;
    readonly keyId: string;
    readonly payload: T;
    readonly signatureBase64Url: string;
}
export interface SharedOperationAuthorization {
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly deviceSignatureBase64Url: string;
}
export interface WorldRegistrationProposal {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly mapId: string;
    readonly worldDeveloperAccountId: string;
    readonly developerTrustAnchorSha256: string;
    readonly genesisSha256: string;
    readonly contentManifestSha256: string;
}
export interface WorldRegistrationRequest {
    readonly proposal: WorldRegistrationProposal;
    readonly developerSignatureBase64Url: string;
}
export interface AccessCodeChangeProposal {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly requestNonce: string;
    readonly expectedCodeRevision: number | null;
    readonly accessCode: string;
}
export interface AccessCodeChangeRequest {
    readonly proposal: AccessCodeChangeProposal;
    readonly developerSignatureBase64Url: string;
}
export interface WorldServiceFacts {
    readonly registration: WorldRegistrationProposal;
    readonly currentMembership: SharedAuthorityReceipt<WorldMembershipEpoch> | null;
    readonly requestedObserver: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
    readonly latestSeal: SharedAuthorityReceipt<RelaySettlementSeal> | null;
    readonly developerClosure: null;
    readonly policy: SharedSettlementPolicy;
    readonly policySha256: string;
}
export interface WorldAgreementCredentialFact {
    readonly credential: WorldMemberCredential;
    readonly challengeSha256: string;
    readonly registeredAtServerEpochMs: number;
    readonly clockGeneration: number;
    readonly authorKeyBinding: SharedAuthorityReceipt<WorldAuthorKeyBinding>;
    readonly observerAdmission: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
}
export interface WorldObserverChallenge {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly challengeId: string;
    readonly observerAccountId: string;
    readonly deviceId: string;
    readonly deviceGeneration: number;
    readonly nonceBase64Url: string;
    readonly accessCodeRevision: number;
    readonly developerTrustAnchorSha256: string;
    readonly expiresAtServerEpochMs: number;
}
export interface RelaySubmitFact {
    readonly worldId: string;
    readonly identity: WorldCommitIdentity;
    readonly envelopeSha256: string;
    readonly cursor: RelayCursor;
    readonly admittedAtServerEpochMs: number;
    readonly retainedUntilServerEpochMs: number;
}
export interface RelayAckRequest {
    readonly worldId: string;
    readonly relayGeneration: number;
    readonly entries: readonly {
        readonly position: string;
        readonly identity: WorldCommitIdentity;
        readonly envelopeSha256: string;
    }[];
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly deviceSignatureBase64Url: string;
}
export interface RelayAckFact {
    readonly worldId: string;
    readonly relayGeneration: number;
    readonly accountId: string;
    readonly deviceId: string;
    readonly deviceGeneration: number;
    readonly entriesSha256: string;
    readonly acknowledgedCount: number;
}
export type RelaySubmitReceipt = SharedTransportReceipt<RelaySubmitFact>;
export type RelayAckReceipt = SharedTransportReceipt<RelayAckFact>;
export interface AuthorityProtocolResult<T> {
    readonly operation: '/observer/redeem' | '/membership/publish' | '/sequence/allocate' | '/append/permit' | '/commit/admit' | '/settlement/seal';
    readonly receipt: SharedAuthorityReceipt<T>;
}
export interface WorldMemberCredentialChallengeContext {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly challengeId: string;
    readonly requestNonce: string;
    readonly recipient: WorldMemberCredential;
    readonly developerTrustAnchorSha256: string;
    readonly challengeNonceBase64Url: string;
    readonly expiresAtServerEpochMs: number;
}
export interface WorldMemberCredentialChallenge {
    readonly context: WorldMemberCredentialChallengeContext;
    readonly ephemeralKeyAgreementPublicKey: WorldKeyAgreementPublicKey;
    readonly saltBase64Url: string;
    readonly nonceBase64Url: string;
    readonly ciphertextAndTagBase64Url: string;
}
export interface WorldMemberCredentialProof {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly challengeId: string;
    readonly requestNonce: string;
    readonly challengeSha256: string;
    readonly recipient: WorldMemberCredential;
    readonly proofTagBase64Url: string;
    readonly recipientSignatureBase64Url: string;
}
export interface WorldDeveloperSigningPort {
    readonly trustAnchor: WorldDeveloperTrustAnchor;
    signWorldRegistration(proposal: WorldRegistrationProposal): Promise<string>;
    signAccessCodeChange(proposal: AccessCodeChangeProposal): Promise<string>;
    signMembershipProposal(proposal: Omit<WorldMembershipEpochProposal, 'developerSignatureBase64Url'>): Promise<string>;
    signRelayKeyPackage(keyPackage: Omit<WorldRelayKeyPackage, 'developerSignatureBase64Url'>): Promise<string>;
    release(): void;
}
export type SharedProtocolOperation = keyof SharedProtocolPayloadMap;
export type SharedServiceErrorCode = 'SchemaInvalid' | 'CanonicalInvalid' | 'RequestNonceInvalid' | 'LegacyIdentityUnsupported' | 'OfflineProofUnsupported' | 'VersionUnsupported' | 'SessionMissing' | 'SessionExpired' | 'SessionRevoked' | 'AuthenticationMismatch' | 'OriginRejected' | 'CsrfRejected' | 'CredentialMismatch' | 'RootPinMismatch' | 'MemberNotActive' | 'PermissionDenied' | 'IdentityConflict' | 'IdempotencyConflict' | 'EpochClosed' | 'MembershipConflict' | 'SequenceExhausted' | 'PermitConsumed' | 'PermitExpired' | 'TimeTooLate' | 'SealBoundaryConflict' | 'PackageConflict' | 'IdempotencyExpired' | 'MemberAdmissionRejected' | 'ResourceLimit' | 'RateLimitExceeded' | 'ServiceUnavailable' | 'RelayUnavailable' | 'DatabaseUnavailable' | 'FactUnavailable' | 'KeyPublisherUnavailable' | 'ClockUntrusted';
export interface SharedServiceStatusPayload {
    readonly clockGeneration: number;
    readonly clockStatus: 'Trusted' | 'Untrusted';
    readonly serverEpochMs: number | null;
    readonly lastSignedEpochMs: number | null;
    readonly policy: SharedSettlementPolicy;
    readonly policySha256: string;
}
export interface SharedProtocolPayloadMap {
    readonly '/status': Readonly<Record<string, never>>;
    readonly '/world/register': WorldRegistrationRequest;
    readonly '/world/facts': {
        readonly worldId: string;
        readonly observerAccountId: string | null;
    };
    readonly '/credential/challenge': {
        readonly worldId: string;
        readonly keyAgreementPublicKey: WorldKeyAgreementPublicKey;
        readonly keyAgreementKeyFingerprint: string;
    };
    readonly '/credential/register': {
        readonly challengeReceipt: SharedTransportReceipt<WorldMemberCredentialChallenge>;
        readonly proof: WorldMemberCredentialProof;
    };
    readonly '/access-code/set': AccessCodeChangeRequest;
    readonly '/observer/challenge': {
        readonly worldId: string;
        readonly developerTrustAnchorSha256: string;
    };
    readonly '/observer/redeem': {
        readonly challengeReceipt: SharedTransportReceipt<WorldObserverChallenge>;
        readonly accessCode: string;
    };
    readonly '/membership/publish': {
        readonly change: WorldMembershipChange;
    };
    readonly '/membership/read': {
        readonly worldId: string;
        readonly membershipEpoch: number;
    };
    readonly '/sequence/allocate': {
        readonly worldId: string;
        readonly membershipEpoch: number;
    };
    readonly '/append/permit': {
        readonly worldId: string;
        readonly identity: WorldCommitIdentity;
        readonly segmentId: string;
        readonly membershipEpoch: number;
        readonly keyEpoch: number;
        readonly changeClass: 'MonotonicReveal' | 'TraceTouch' | 'DeveloperMapChange';
    };
    readonly '/commit/admit': {
        readonly admissionClaim: SignedWorldCommitAdmissionClaim;
        readonly appendPermitReceipt: SharedAuthorityReceipt<WorldAppendPermit>;
        readonly sequenceSegmentReceipt: SharedAuthorityReceipt<AuthorSequenceSegment>;
    };
    readonly '/commit/admission': {
        readonly worldId: string;
        readonly identity: WorldCommitIdentity;
        readonly envelopeSha256: string;
    };
    readonly '/settlement/seal': {
        readonly worldId: string;
        readonly sealedThroughEpochMs: number;
        readonly expectedPreviousSealSha256: string | null;
    };
    readonly '/relay/submit': {
        readonly commit: AdmittedWorldCommit;
    };
    readonly '/relay/pull': {
        readonly worldId: string;
        readonly after: RelayCursor;
        readonly maximumCount: number;
        readonly maximumWaitMs: number;
    };
    readonly '/relay/ack': RelayAckRequest;
}
export interface SharedProtocolValueMap {
    readonly '/status': SharedTransportReceipt<SharedServiceStatusPayload>;
    readonly '/world/register': SharedTransportReceipt<WorldRegistrationProposal>;
    readonly '/world/facts': SharedTransportReceipt<WorldServiceFacts>;
    readonly '/credential/challenge': SharedTransportReceipt<WorldMemberCredentialChallenge>;
    readonly '/credential/register': SharedTransportReceipt<WorldAgreementCredentialFact>;
    readonly '/access-code/set': SharedTransportReceipt<{
        readonly worldId: string;
        readonly accessCodeRevision: number;
        readonly changedAtServerEpochMs: number;
        readonly clockGeneration: number;
    }>;
    readonly '/observer/challenge': SharedTransportReceipt<WorldObserverChallenge>;
    readonly '/observer/redeem': SharedTransportReceipt<AuthorityProtocolResult<WorldObserverAdmissionFact>>;
    readonly '/membership/publish': SharedTransportReceipt<AuthorityProtocolResult<WorldMembershipEpoch>>;
    readonly '/membership/read': SharedTransportReceipt<{
        readonly epochReceipt: SharedAuthorityReceipt<WorldMembershipEpoch>;
    }>;
    readonly '/sequence/allocate': SharedTransportReceipt<AuthorityProtocolResult<AuthorSequenceSegment>>;
    readonly '/append/permit': SharedTransportReceipt<AuthorityProtocolResult<WorldAppendPermit>>;
    readonly '/commit/admit': SharedTransportReceipt<AuthorityProtocolResult<WorldCommitAdmission | WorldCommitRejection>>;
    readonly '/commit/admission': SharedTransportReceipt<{
        readonly receipt: SharedAuthorityReceipt<WorldCommitAdmission | WorldCommitRejection>;
    }>;
    readonly '/settlement/seal': SharedTransportReceipt<AuthorityProtocolResult<RelaySettlementSeal>>;
    readonly '/relay/submit': RelaySubmitReceipt;
    readonly '/relay/pull': SharedTransportReceipt<RelayPullReply>;
    readonly '/relay/ack': RelayAckReceipt;
}
export type SharedProtocolReply<O extends SharedProtocolOperation> = SharedHttpReply<SharedProtocolValueMap[O]>;
export interface RealWorldAuthorityProtocolPort extends RealWorldAuthorityPort {
    readServiceStatus(requestNonce?: string): Promise<SharedProtocolReply<'/status'>>;
    registerWorld(payload: SharedProtocolPayloadMap['/world/register'], requestNonce?: string): Promise<SharedProtocolReply<'/world/register'>>;
    readWorldFacts(payload: SharedProtocolPayloadMap['/world/facts'], requestNonce?: string): Promise<SharedProtocolReply<'/world/facts'>>;
    requestCredentialChallenge(payload: SharedProtocolPayloadMap['/credential/challenge'], requestNonce?: string): Promise<SharedProtocolReply<'/credential/challenge'>>;
    registerAgreementCredential(payload: SharedProtocolPayloadMap['/credential/register'], requestNonce?: string): Promise<SharedProtocolReply<'/credential/register'>>;
    setAccessCode(payload: SharedProtocolPayloadMap['/access-code/set'], requestNonce?: string): Promise<SharedProtocolReply<'/access-code/set'>>;
    requestObserverChallenge(payload: SharedProtocolPayloadMap['/observer/challenge'], requestNonce?: string): Promise<SharedProtocolReply<'/observer/challenge'>>;
    redeemObserverChallenge(payload: SharedProtocolPayloadMap['/observer/redeem'], requestNonce?: string): Promise<SharedProtocolReply<'/observer/redeem'>>;
    publishMembershipEpoch(payload: SharedProtocolPayloadMap['/membership/publish'], requestNonce?: string): Promise<SharedProtocolReply<'/membership/publish'>>;
    readMembershipEpoch(payload: SharedProtocolPayloadMap['/membership/read'], requestNonce?: string): Promise<SharedProtocolReply<'/membership/read'>>;
    allocateSegment(payload: SharedProtocolPayloadMap['/sequence/allocate'], requestNonce?: string): Promise<SharedProtocolReply<'/sequence/allocate'>>;
    issueAppendPermit(payload: SharedProtocolPayloadMap['/append/permit'], requestNonce?: string): Promise<SharedProtocolReply<'/append/permit'>>;
    admitCommit(payload: SharedProtocolPayloadMap['/commit/admit'], requestNonce?: string): Promise<SharedProtocolReply<'/commit/admit'>>;
    readAdmission(payload: SharedProtocolPayloadMap['/commit/admission'], requestNonce?: string): Promise<SharedProtocolReply<'/commit/admission'>>;
    sealPrefix(payload: SharedProtocolPayloadMap['/settlement/seal'], requestNonce?: string): Promise<SharedProtocolReply<'/settlement/seal'>>;
}
export interface RealCommitRelayProtocolPort extends RealCommitRelayPort<AdmittedWorldCommit, RelaySubmitReceipt> {
    submit(commit: AdmittedWorldCommit): Promise<SharedHttpReply<RelaySubmitReceipt>>;
    pull(worldId: string, after: RelayCursor, maximumCount: number, maximumWaitMs: number): Promise<SharedProtocolReply<'/relay/pull'>>;
    acknowledge(request: RelayAckRequest): Promise<SharedHttpReply<RelayAckReceipt>>;
}
export interface SharedServiceSessionPort {
    currentContext(): AuthenticatedServiceContext | null;
    createRequestNonce(): string;
    request(operation: SharedProtocolOperation, requestNonce: string, payload: unknown): Promise<SharedHttpReply<unknown>>;
}
export interface RegisteredAuthorSigningPort {
    signAdmissionClaim(claim: WorldCommitAdmissionClaim): Promise<string>;
    signEnvelope(envelope: Omit<RelayCommitEnvelope, 'authorSignatureBase64Url'>): Promise<string>;
    signCredentialProof(proof: Omit<WorldMemberCredentialProof, 'recipientSignatureBase64Url'>): Promise<string>;
    signKeyAcceptance(acceptance: Omit<WorldRelayKeyAcceptance, 'recipientSignatureBase64Url'>): Promise<string>;
    signSharedOperation(operation: SharedProtocolOperation, requestNonce: string, payload: unknown): Promise<string>;
    signRelayAck(requestNonce: string, ack: Omit<RelayAckRequest, 'deviceSignatureBase64Url'>): Promise<string>;
}
export interface SharedCommitSealingPort {
    sealCommit(commit: WorldCommit, header: RelayCommitHeader, worldRelayKey: Uint8Array, signer: RegisteredAuthorSigningPort): Promise<Uint8Array>;
}
export interface SharedRelayDurableCachePort {
    persistAndVerify(commit: AdmittedWorldCommit): Promise<{
        readonly envelopeSha256: string;
    }>;
    read(identity: WorldCommitIdentity): Promise<AdmittedWorldCommit | null>;
}
export type SharedProtocolSignatureKind = 'AdmissionClaim' | 'Envelope' | 'CredentialProof' | 'KeyAcceptance' | 'SharedOperation' | 'RelayAck';
export interface SharedProtocolCodecPort {
    encode(value: unknown): string;
    parseRequest(operation: SharedProtocolOperation, raw: string): SharedHttpRequest<unknown>;
    validatePayload(operation: SharedProtocolOperation, value: unknown): void;
    parseReply(operation: SharedProtocolOperation, raw: string, requestNonce: string): SharedHttpReply<unknown>;
    validateSignatureInput(kind: SharedProtocolSignatureKind, value: unknown): void;
}
export interface WorldKeyAgreementPort {
    readonly publicKey: WorldKeyAgreementPublicKey;
    readonly keyAgreementKeyFingerprint: string;
    proveCredentialChallenge(challenge: WorldMemberCredentialChallenge): Promise<string>;
    unwrapRelayKeyPackage(keyPackage: WorldRelayKeyPackage): Promise<Uint8Array | null>;
    createWorldRelayKey(): Promise<Uint8Array>;
    createChallengeNonce(): Promise<string>;
    prepareRelayKeyPackage(key: Uint8Array, context: WorldRelayKeyPackageContext): Promise<Omit<WorldRelayKeyPackage, 'developerSignatureBase64Url'>>;
    createRelayKeyAcceptanceTag(key: Uint8Array, acceptance: Omit<WorldRelayKeyAcceptance, 'keyPossessionTagBase64Url' | 'recipientSignatureBase64Url'>): Promise<string>;
    release(): void;
}
