/** P3 schema 1 data only. These declarations confer no signature, trust or storage capability. */
export interface WorldCommitIdentity {
    readonly authorAccountId: string;
    readonly authorSequence: number;
}
export interface SharedPosition {
    readonly lateralMilli: number;
    readonly depthMilli: number;
}
export interface SharedContentReference {
    readonly contentId: string;
    readonly contentSha256: string;
}
export interface WorldSharedGenesis {
    readonly schemaVersion: 1;
    readonly profile: 'ExternalSharedOnlineV1';
    readonly worldId: string;
    readonly mapId: string;
    readonly contentRevision: number;
    readonly contentManifestSha256: string;
    readonly worldDeveloperAccountId: string;
    readonly developerTrustAnchor: WorldDeveloperTrustAnchor;
    readonly initialState: SharedWorldState;
}
export interface AuthorSequenceSegment {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly segmentId: string;
    readonly authorAccountId: string;
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly worldId: string;
    readonly membershipEpoch: number;
    readonly firstSequence: number;
    readonly lastSequence: number;
    readonly issuedAtServerEpochMs: number;
    readonly expiresAtServerEpochMs: number;
}
export interface SharedAppendedAt {
    readonly epochMs: number;
}
export interface WorldAppendPermit {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly permitId: string;
    readonly requestNonce: string;
    readonly worldId: string;
    readonly identity: WorldCommitIdentity;
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly segmentId: string;
    readonly membershipEpoch: number;
    readonly keyEpoch: number;
    readonly changeClass: WorldChangeClass;
    readonly appendedAt: SharedAppendedAt;
    readonly expiresAtServerEpochMs: number;
    readonly clockGeneration: number;
    readonly clockStatus: 'Trusted';
}
export interface WorldCommitAdmission {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly identity: WorldCommitIdentity;
    readonly envelopeSha256: string;
    readonly appendedAt: SharedAppendedAt;
    readonly admittedAtServerEpochMs: number;
    readonly admissionRevision: number;
    readonly membershipEpoch: number;
    readonly rosterTargetObserverActiveAtAppendedAt: boolean | null;
}
export interface WorldCommitAdmissionClaim {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly requestNonce: string;
    readonly header: RelayCommitHeader;
    readonly envelopeSha256: string;
}
export interface SignedWorldCommitAdmissionClaim {
    readonly claim: WorldCommitAdmissionClaim;
    readonly authorSignatureBase64Url: string;
}
export interface WorldDeveloperClosureFact {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly worldDeveloperAccountId: string;
    readonly effectiveAtServerEpochMs: number;
    readonly accountFactRevision: number;
}
export interface WorldCommitRejection {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly identity: WorldCommitIdentity;
    readonly envelopeSha256: string;
    readonly appendedAt: SharedAppendedAt;
    readonly rejectedAtServerEpochMs: number;
    readonly reason: 'TimeTooLate' | 'PermitExpired' | 'EpochClosed' | 'IdentityConflict';
    readonly previouslyAdmitted: false;
}
export interface WorldAuthorKeyBinding {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly authorAccountId: string;
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly authorSigningPublicJwk: {
        readonly kty: 'EC';
        readonly crv: 'P-256';
        readonly x: string;
        readonly y: string;
    };
    readonly authorSigningKeyFingerprint: string;
    readonly registeredAtServerEpochMs: number;
    readonly assurance: 'RegisteredCredential';
}
export type WorldChangeClass = 'MonotonicReveal' | 'TraceTouch' | 'DeveloperMapChange';
export type SharedCommitClass = 'Monotonic' | 'AddOnly' | 'RestrictedWrite';
export interface MonotonicRevealChange {
    readonly changeClass: 'MonotonicReveal';
    readonly commitClass: 'Monotonic';
    readonly entityId: string;
    readonly revealed: true;
}
export interface TraceTouchChange {
    readonly changeClass: 'TraceTouch';
    readonly commitClass: 'AddOnly';
    readonly traceTouchId: string;
    readonly normalTraceEntityId: string;
    readonly touchUnits: 1;
}
export type EditTarget = {
    readonly kind: 'Entity';
    readonly entityId: string;
} | {
    readonly kind: 'Trigger';
    readonly triggerId: string;
};
export interface SharedMapEntityDefinition {
    readonly entityId: string;
    readonly elementType: 'Initial' | 'Process' | 'Trace' | 'Residue';
    readonly position: SharedPosition;
    readonly content: SharedContentReference;
    readonly normalTrace: {
        readonly traceTouchId: string;
        readonly tier: 'Common' | 'Deep' | 'Rain';
    } | null;
}
export interface SharedTriggerDefinition {
    readonly triggerId: string;
    readonly anchorEntityId: string;
    readonly activation: {
        readonly kind: 'Proximity';
        readonly radiusMilli: number;
    } | {
        readonly kind: 'Interaction';
    };
    readonly action: {
        readonly kind: 'RevealResidue';
        readonly targetEntityId: string;
    };
}
export type MapEditOperation = {
    readonly operation: 'CreateEntity';
    readonly target: {
        readonly kind: 'Entity';
        readonly entityId: string;
    };
    readonly definition: SharedMapEntityDefinition;
} | {
    readonly operation: 'ReplaceEntity';
    readonly target: {
        readonly kind: 'Entity';
        readonly entityId: string;
    };
    readonly definition: SharedMapEntityDefinition;
} | {
    readonly operation: 'DeleteEntity';
    readonly target: {
        readonly kind: 'Entity';
        readonly entityId: string;
    };
} | {
    readonly operation: 'CreateTrigger';
    readonly target: {
        readonly kind: 'Trigger';
        readonly triggerId: string;
    };
    readonly definition: SharedTriggerDefinition;
} | {
    readonly operation: 'ReplaceTrigger';
    readonly target: {
        readonly kind: 'Trigger';
        readonly triggerId: string;
    };
    readonly definition: SharedTriggerDefinition;
} | {
    readonly operation: 'DeleteTrigger';
    readonly target: {
        readonly kind: 'Trigger';
        readonly triggerId: string;
    };
};
export interface MapEditCommitChange {
    readonly changeClass: 'DeveloperMapChange';
    readonly commitClass: 'RestrictedWrite';
    readonly subtype: 'MapEditCommit';
    readonly edit: MapEditOperation;
}
export interface DeveloperRosterChange {
    readonly changeClass: 'DeveloperMapChange';
    readonly commitClass: 'RestrictedWrite';
    readonly subtype: 'DeveloperRosterChange';
    readonly operation: 'AddCoDeveloper' | 'RemoveCoDeveloper';
    readonly accountId: string;
    readonly observerAdmissionRevision: number;
}
export type WorldChange = MonotonicRevealChange | TraceTouchChange | MapEditCommitChange | DeveloperRosterChange;
export interface WorldCommit {
    readonly schemaVersion: 1;
    readonly profile: 'ExternalSharedOnlineV1';
    readonly worldId: string;
    readonly mapId: string;
    readonly contentManifestSha256: string;
    readonly identity: WorldCommitIdentity;
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly segmentId: string;
    readonly permitId: string;
    readonly membershipEpoch: number;
    readonly keyEpoch: number;
    readonly appendedAt: SharedAppendedAt;
    readonly change: WorldChange;
}
export type RestrictedWriteHeader = null | {
    readonly subtype: 'MapEditCommit';
} | {
    readonly subtype: 'DeveloperRosterChange';
    readonly operation: 'AddCoDeveloper' | 'RemoveCoDeveloper';
    readonly accountId: string;
    readonly observerAdmissionRevision: number;
};
export interface RelayCommitHeader {
    readonly schemaVersion: 1;
    readonly profile: 'ExternalSharedOnlineV1';
    readonly kind: 'RelayWorldCommit';
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly identity: WorldCommitIdentity;
    readonly authorDeviceId: string;
    readonly authorDeviceGeneration: number;
    readonly authorSigningKeyFingerprint: string;
    readonly segmentId: string;
    readonly permitId: string;
    readonly membershipEpoch: number;
    readonly keyEpoch: number;
    readonly worldRelayKeyId: string;
    readonly appendedAt: SharedAppendedAt;
    readonly changeClass: WorldChangeClass;
    readonly commitClass: SharedCommitClass;
    readonly restrictedWrite: RestrictedWriteHeader;
    readonly cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1';
}
export interface WrappedRelayDataKey {
    readonly nonceBase64Url: string;
    readonly ciphertextAndTagBase64Url: string;
}
export interface RelayCommitEnvelope {
    readonly header: RelayCommitHeader;
    readonly wrappedCommitDataKey: WrappedRelayDataKey;
    readonly nonceBase64Url: string;
    readonly ciphertextAndTagBase64Url: string;
    readonly authorSignatureBase64Url: string;
}
export interface AdmittedWorldCommit {
    readonly envelopeBytesBase64Url: string;
    readonly appendPermitReceipt: SharedAuthorityReceipt<WorldAppendPermit>;
    readonly sequenceSegmentReceipt: SharedAuthorityReceipt<AuthorSequenceSegment>;
    readonly admissionReceipt: SharedAuthorityReceipt<WorldCommitAdmission>;
    readonly admissionClaim: SignedWorldCommitAdmissionClaim;
    readonly authorKeyBindingReceipt: SharedAuthorityReceipt<WorldAuthorKeyBinding>;
    readonly membershipEpochReceipt: SharedAuthorityReceipt<WorldMembershipEpoch>;
    readonly rosterObserverAdmissionReceipt: SharedAuthorityReceipt<WorldObserverAdmissionFact> | null;
}
export interface SharedEntityRecord {
    readonly definition: SharedMapEntityDefinition;
    readonly createdBy: WorldCommitIdentity | null;
    readonly lastEditedBy: WorldCommitIdentity | null;
    readonly deletedBy: WorldCommitIdentity | null;
}
export interface SharedTriggerRecord {
    readonly definition: SharedTriggerDefinition;
    readonly createdBy: WorldCommitIdentity | null;
    readonly lastEditedBy: WorldCommitIdentity | null;
    readonly deletedBy: WorldCommitIdentity | null;
}
export interface TraceTouchAggregate {
    readonly traceTouchId: string;
    readonly normalTraceEntityId: string;
    readonly totalTouchUnits: string;
    readonly aggregateStrength: number;
}
export interface DeveloperRosterState {
    readonly worldDeveloperAccountId: string;
    readonly coDeveloperAccountIds: readonly string[];
    readonly frozen: boolean;
}
export interface SharedWorldState {
    readonly schemaVersion: 1;
    readonly profile: 'ExternalSharedOnlineV1';
    readonly worldId: string;
    readonly mapId: string;
    readonly contentManifestSha256: string;
    readonly entities: readonly SharedEntityRecord[];
    readonly triggers: readonly SharedTriggerRecord[];
    readonly revealedResidueEntityIds: readonly string[];
    readonly traceTouches: readonly TraceTouchAggregate[];
    readonly developerRoster: DeveloperRosterState;
}
export interface WorldChangeLogWire {
    readonly schemaVersion: 1;
    readonly profile: 'ExternalSharedOnlineV1';
    readonly worldId: string;
    readonly genesisSha256: string;
    readonly baseCheckpointSha256: string | null;
    readonly developerClosure: SharedAuthorityReceipt<WorldDeveloperClosureFact> | null;
    readonly commits: readonly AdmittedWorldCommit[];
}
export interface RelaySettlementSeal {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly sealRevision: number;
    readonly policySha256: string;
    readonly issuedAtServerEpochMs: number;
    readonly sealedThroughEpochMs: number;
    readonly admittedCommitCount: number;
    readonly admittedPrefixSha256: string;
    readonly developerClosureSha256: string | null;
    readonly previousSealSha256: string | null;
}
export interface CheckpointCoverageEntry {
    readonly identity: WorldCommitIdentity;
    readonly envelopeSha256: string;
    readonly appendedAt: SharedAppendedAt;
    readonly admissionRevision: number;
    readonly applyResult: 'Applied' | 'NoEffect' | 'RevertedEdit' | 'InvalidChange';
    readonly finalDiagnostic: 'MergeConflict' | 'RevertedEdit' | 'InvalidChange' | null;
}
export interface WorldCheckpointWire {
    readonly schemaVersion: 1;
    readonly profile: 'ExternalSharedOnlineV1';
    readonly worldId: string;
    readonly genesisSha256: string;
    readonly parentCheckpointSha256: string | null;
    readonly coveredThroughEpochMs: number;
    readonly settlementSeal: SharedAuthorityReceipt<RelaySettlementSeal>;
    readonly developerClosure: SharedAuthorityReceipt<WorldDeveloperClosureFact> | null;
    readonly coverage: readonly CheckpointCoverageEntry[];
    readonly coverageSha256: string;
    readonly state: SharedWorldState;
    readonly stateSha256: string;
    readonly checkpointSha256: string;
}
export interface SharedSettlementPolicy {
    readonly schemaVersion: 1;
    readonly offlineGraceMs: number;
    readonly boundedRelayDelayMs: number;
    readonly timeUncertaintyAllowanceMs: number;
    readonly settleHorizonMs: number;
    readonly retentionMs: number;
}
export interface RelayCursor {
    readonly relayGeneration: number;
    readonly position: string;
}
export type RelayPullReply = {
    readonly kind: 'Batch';
    readonly worldId: string;
    readonly after: RelayCursor;
    readonly next: RelayCursor;
    readonly commits: readonly AdmittedWorldCommit[];
    readonly retentionFloor: RelayCursor;
} | {
    readonly kind: 'Gap';
    readonly worldId: string;
    readonly after: RelayCursor;
    readonly retentionFloor: RelayCursor;
    readonly reason: 'RetentionExpired' | 'RelayGenerationChanged' | 'MissingAdmittedEnvelope';
};
export interface SharedAuthorityReceipt<T> {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly purpose: 'SequenceSegment' | 'WorldAppendPermit' | 'WorldCommitAdmission' | 'WorldCommitRejection' | 'AuthorKeyBinding' | 'RelaySettlementSeal' | 'WorldMembership' | 'WorldDeveloperClosure';
    readonly receiptId: string;
    readonly keyId: string;
    readonly requestNonce: string;
    readonly issuedAtServerEpochMs: number;
    readonly clockGeneration: number;
    readonly clockStatus: 'Trusted';
    readonly payload: T;
    readonly signatureBase64Url: string;
}
export interface WorldKeyAgreementPublicKey {
    readonly kty: 'EC';
    readonly crv: 'P-256';
    readonly x: string;
    readonly y: string;
}
export interface WorldDeveloperTrustAnchor {
    readonly schemaVersion: 1;
    readonly worldId: string;
    readonly worldDeveloperAccountId: string;
    readonly developerSigningKeyId: string;
    readonly developerPublicKey: WorldKeyAgreementPublicKey;
    readonly developerPublicKeyFingerprint: string;
}
export interface WorldObserverAdmissionFact {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly observerAccountId: string;
    readonly observerAdmissionRevision: number;
    readonly accessCodeRevision: number;
    readonly admittedAtServerEpochMs: number;
    readonly developerTrustAnchorSha256: string;
}
export interface WorldMemberCredential {
    readonly accountId: string;
    readonly observerAdmissionRevision: number | null;
    readonly deviceId: string;
    readonly deviceGeneration: number;
    readonly registeredSigningKeyFingerprint: string;
    readonly keyAgreementPublicKey: WorldKeyAgreementPublicKey;
    readonly keyAgreementKeyFingerprint: string;
}
export interface WorldRelayKeyDescriptor {
    readonly schemaVersion: 1;
    readonly worldId: string;
    readonly membershipEpoch: number;
    readonly keyEpoch: number;
    readonly worldRelayKeyId: string;
    readonly keyCommitmentSha256: string;
}
export interface WorldMembershipEpoch {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly membershipEpoch: number;
    readonly previousMembershipEpoch: number | null;
    readonly key: WorldRelayKeyDescriptor;
    readonly credentials: readonly WorldMemberCredential[];
    readonly developerTrustAnchorSha256: string;
    readonly activatedAtServerEpochMs: number;
    readonly developerSignatureBase64Url: string;
}
export type WorldMembershipEpochProposal = Omit<WorldMembershipEpoch, 'activatedAtServerEpochMs'>;
export interface WorldMembershipChange {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly changeId: string;
    readonly requestNonce: string;
    readonly worldId: string;
    readonly expectedMembershipEpoch: number | null;
    readonly reason: 'Initial' | 'MemberAdded' | 'MemberRemoved' | 'CredentialAdded' | 'CredentialRemoved' | 'KeyCompromise';
    readonly next: WorldMembershipEpochProposal;
}
export interface WorldRelayKeyPackageContext {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly packageId: string;
    readonly descriptor: WorldRelayKeyDescriptor;
    readonly recipient: WorldMemberCredential;
    readonly developerTrustAnchorSha256: string;
    readonly developerSigningKeyId: string;
    readonly cipherSuite: 'AES-256-GCM-HKDF-SHA256-v1';
}
export interface WorldRelayKeyPackage {
    readonly context: WorldRelayKeyPackageContext;
    readonly ephemeralKeyAgreementPublicKey: WorldKeyAgreementPublicKey;
    readonly saltBase64Url: string;
    readonly nonceBase64Url: string;
    readonly ciphertextAndTagBase64Url: string;
    readonly developerSignatureBase64Url: string;
}
export interface WorldRelayKeyAcceptance {
    readonly schemaVersion: 1;
    readonly serviceInstanceId: string;
    readonly worldId: string;
    readonly packageId: string;
    readonly packageSha256: string;
    readonly descriptor: WorldRelayKeyDescriptor;
    readonly recipient: WorldMemberCredential;
    readonly acceptanceNonce: string;
    readonly keyPossessionTagBase64Url: string;
    readonly recipientSignatureBase64Url: string;
}
export type SharedSchemaErrorCode = 'CanonicalInvalid' | 'SchemaInvalid' | 'ValueInvalid' | 'InvariantInvalid' | 'LimitExceeded';
export type SharedAuthorityPayload = AuthorSequenceSegment | WorldAppendPermit | WorldCommitAdmission | WorldCommitRejection | WorldAuthorKeyBinding | RelaySettlementSeal | WorldObserverAdmissionFact | WorldMembershipEpoch | WorldDeveloperClosureFact;
export interface SharedSchemaMap {
    readonly WorldCommitIdentity: WorldCommitIdentity;
    readonly SharedPosition: SharedPosition;
    readonly SharedContentReference: SharedContentReference;
    readonly WorldSharedGenesis: WorldSharedGenesis;
    readonly AuthorSequenceSegment: AuthorSequenceSegment;
    readonly SharedAppendedAt: SharedAppendedAt;
    readonly WorldAppendPermit: WorldAppendPermit;
    readonly WorldCommitAdmission: WorldCommitAdmission;
    readonly WorldCommitAdmissionClaim: WorldCommitAdmissionClaim;
    readonly SignedWorldCommitAdmissionClaim: SignedWorldCommitAdmissionClaim;
    readonly WorldDeveloperClosureFact: WorldDeveloperClosureFact;
    readonly WorldCommitRejection: WorldCommitRejection;
    readonly WorldAuthorKeyBinding: WorldAuthorKeyBinding;
    readonly WorldChangeClass: WorldChangeClass;
    readonly SharedCommitClass: SharedCommitClass;
    readonly MonotonicRevealChange: MonotonicRevealChange;
    readonly TraceTouchChange: TraceTouchChange;
    readonly EditTarget: EditTarget;
    readonly SharedMapEntityDefinition: SharedMapEntityDefinition;
    readonly SharedTriggerDefinition: SharedTriggerDefinition;
    readonly MapEditOperation: MapEditOperation;
    readonly MapEditCommitChange: MapEditCommitChange;
    readonly DeveloperRosterChange: DeveloperRosterChange;
    readonly WorldChange: WorldChange;
    readonly WorldCommit: WorldCommit;
    readonly RestrictedWriteHeader: RestrictedWriteHeader;
    readonly RelayCommitHeader: RelayCommitHeader;
    readonly WrappedRelayDataKey: WrappedRelayDataKey;
    readonly RelayCommitEnvelope: RelayCommitEnvelope;
    readonly AdmittedWorldCommit: AdmittedWorldCommit;
    readonly SharedEntityRecord: SharedEntityRecord;
    readonly SharedTriggerRecord: SharedTriggerRecord;
    readonly TraceTouchAggregate: TraceTouchAggregate;
    readonly DeveloperRosterState: DeveloperRosterState;
    readonly SharedWorldState: SharedWorldState;
    readonly WorldChangeLogWire: WorldChangeLogWire;
    readonly RelaySettlementSeal: RelaySettlementSeal;
    readonly CheckpointCoverageEntry: CheckpointCoverageEntry;
    readonly WorldCheckpointWire: WorldCheckpointWire;
    readonly SharedSettlementPolicy: SharedSettlementPolicy;
    readonly RelayCursor: RelayCursor;
    readonly RelayPullReply: RelayPullReply;
    readonly SharedAuthorityReceipt: SharedAuthorityReceipt<SharedAuthorityPayload>;
    readonly WorldKeyAgreementPublicKey: WorldKeyAgreementPublicKey;
    readonly WorldDeveloperTrustAnchor: WorldDeveloperTrustAnchor;
    readonly WorldObserverAdmissionFact: WorldObserverAdmissionFact;
    readonly WorldMemberCredential: WorldMemberCredential;
    readonly WorldRelayKeyDescriptor: WorldRelayKeyDescriptor;
    readonly WorldMembershipEpoch: WorldMembershipEpoch;
    readonly WorldMembershipEpochProposal: WorldMembershipEpochProposal;
    readonly WorldMembershipChange: WorldMembershipChange;
    readonly WorldRelayKeyPackageContext: WorldRelayKeyPackageContext;
    readonly WorldRelayKeyPackage: WorldRelayKeyPackage;
    readonly WorldRelayKeyAcceptance: WorldRelayKeyAcceptance;
}
export type SharedSchemaKind = keyof SharedSchemaMap;
