/** P3 verification only: caller-installed trust, injected cryptography, no platform or transport. */
import type {
  AdmittedWorldCommit, AuthorSequenceSegment, RelayCommitEnvelope, RelayCommitHeader,
  RelaySettlementSeal, SharedAppendedAt, SharedAuthorityReceipt, SharedMapEntityDefinition,
  SharedSettlementPolicy, WorldAuthorKeyBinding, WorldChange, WorldCommit, WorldCommitIdentity,
  WorldAppendPermit, WorldCommitAdmission, WorldCommitRejection, WorldDeveloperClosureFact, WorldDeveloperTrustAnchor,
  WorldKeyAgreementPublicKey, WorldMembershipEpoch, WorldObserverAdmissionFact,
  WorldRelayKeyDescriptor, WorldSharedGenesis,
} from './SharedCommitContracts';
import { SharedCanonicalBytes, SharedSchemaError } from './SharedCanonicalBytes';
import { SharedCommitCodec } from './SharedCommitCodec';

export interface SharedCryptoPort {
  sha256(bytes: Uint8Array): Promise<string>;
  verifyEs256(jwk: WorldKeyAgreementPublicKey, signature: Uint8Array, message: Uint8Array): Promise<boolean>;
  hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array>;
  /** null means a checked authentication failure; backend/host failures must throw. */
  decryptAes256Gcm(key: Uint8Array, nonce: Uint8Array, ciphertextAndTag: Uint8Array, aad: Uint8Array): Promise<Uint8Array | null>;
}

/** Installed by a trusted composition caller; never reconstructed from an incoming file. */
export interface SharedValidationContext {
  readonly serviceInstanceId: string;
  readonly servicePublicKeyJwk: WorldKeyAgreementPublicKey;
  readonly serviceKeyFingerprint: string;
  /** Highest independently trusted service clock generation; historical signed generations remain usable. */
  readonly clockGeneration: number;
  readonly developerTrustAnchor: WorldDeveloperTrustAnchor;
  readonly genesisSha256: string;
  readonly worldId: string;
  readonly mapId: string;
  readonly contentManifestSha256: string;
  /** Must check approved content and the definition's Normal Trace qualification, not only presence. */
  readonly isEntityDefinitionApproved: (definition: SharedMapEntityDefinition) => boolean;
  readonly lookupWorldRelayKey: (descriptor: WorldRelayKeyDescriptor) => Promise<Uint8Array | null>;
}

export type SharedValidationResult<T> = { readonly kind: 'Verified'; readonly value: T }
  | { readonly kind: 'Gap'; readonly reason: string }
  | { readonly kind: 'HostFailure'; readonly reason: string };

export interface TrustedVerifiedGenesis {
  readonly genesis: WorldSharedGenesis;
  readonly genesisSha256: string;
}
export interface ValidatedSharedCommit {
  readonly wire: unknown;
  readonly envelopeBytesBase64Url: string;
  readonly commit: WorldCommit | null;
  readonly identity: WorldCommitIdentity;
  readonly appendedAt: SharedAppendedAt;
  readonly envelopeSha256: string;
  readonly admissionRevision: number;
  readonly change: WorldChange | null;
  readonly invalid: boolean;
  readonly invalidReason: string | null;
  readonly header: RelayCommitHeader;
  readonly sequenceSegment: AuthorSequenceSegment;
  readonly rosterTargetObserverActiveAtAppendedAt: boolean | null;
}
export interface ValidatedSharedSeal {
  readonly wire: SharedAuthorityReceipt<RelaySettlementSeal>;
  readonly seal: RelaySettlementSeal;
  readonly receiptSha256: string;
}
export interface ValidatedSharedClosure {
  readonly wire: SharedAuthorityReceipt<WorldDeveloperClosureFact>;
  readonly closure: WorldDeveloperClosureFact;
  readonly receiptSha256: string;
}
export interface ValidatedSharedRejection {
  readonly wire: SharedAuthorityReceipt<WorldCommitRejection>;
  readonly rejection: WorldCommitRejection;
  readonly receiptSha256: string;
}

class SharedVerificationGap extends Error {}
class SharedCryptoHostFailure extends Error {}

function requireSource(condition: boolean, reason: string): void {
  if (!condition) { throw new SharedVerificationGap(reason); }
}
function sameData(first: unknown, second: unknown): boolean {
  return SharedCanonicalBytes.equalBytes(SharedCanonicalBytes.encode(first), SharedCanonicalBytes.encode(second));
}
function unsigned(value: object, omitted: readonly string[]): { [key: string]: unknown } {
  const result: { [key: string]: unknown } = Object.create(null) as { [key: string]: unknown };
  for (const key of Object.keys(value)) {
    if (omitted.indexOf(key) < 0) { result[key] = (value as { [key: string]: unknown })[key]; }
  }
  return result;
}
function hashBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) { throw new SharedCryptoHostFailure('InvalidCryptoDigest'); }
  const result = new Uint8Array(32);
  for (let index = 0; index < result.length; index += 1) { result[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16); }
  return result;
}
function owns<T extends object>(set: WeakSet<object>, value: unknown): value is T {
  return typeof value === 'object' && value !== null && set.has(value);
}

/** Each instance owns its capabilities. Structural brands and serialized values never confer trust. */
export class SharedCommitValidator {
  private readonly codec = new SharedCommitCodec();
  private readonly genesisCapabilities = new WeakSet<object>();
  private readonly commitCapabilities = new WeakSet<object>();
  private readonly sealCapabilities = new WeakSet<object>();
  private readonly closureCapabilities = new WeakSet<object>();
  private readonly rejectionCapabilities = new WeakSet<object>();
  private readonly context: SharedValidationContext;

  constructor(private readonly crypto: SharedCryptoPort, context: SharedValidationContext) {
    const publicKey = this.codec.validate('WorldKeyAgreementPublicKey', context.servicePublicKeyJwk);
    const anchor = this.codec.validate('WorldDeveloperTrustAnchor', context.developerTrustAnchor);
    requireSource(/^[A-Za-z0-9_.-]{3,128}$/.test(context.serviceInstanceId), 'InvalidInstalledService');
    requireSource(Number.isSafeInteger(context.clockGeneration) && context.clockGeneration >= 1, 'InvalidInstalledClockGeneration');
    requireSource(/^[0-9a-f]{64}$/.test(context.genesisSha256) && /^[0-9a-f]{64}$/.test(context.contentManifestSha256), 'InvalidInstalledDigest');
    requireSource(anchor.worldId === context.worldId, 'InstalledWorldMismatch');
    this.context = Object.freeze({ ...context, servicePublicKeyJwk: publicKey, developerTrustAnchor: anchor });
  }

  ownsGenesis(value: unknown): value is TrustedVerifiedGenesis { return owns(this.genesisCapabilities, value); }
  ownsCommit(value: unknown): value is ValidatedSharedCommit { return owns(this.commitCapabilities, value); }
  ownsSeal(value: unknown): value is ValidatedSharedSeal { return owns(this.sealCapabilities, value); }
  ownsClosure(value: unknown): value is ValidatedSharedClosure { return owns(this.closureCapabilities, value); }
  ownsRejection(value: unknown): value is ValidatedSharedRejection { return owns(this.rejectionCapabilities, value); }

  async validateGenesis(input: unknown): Promise<SharedValidationResult<TrustedVerifiedGenesis>> {
    return this.guard(async () => {
      await this.verifyInstalledPins();
      const genesis = this.codec.validate('WorldSharedGenesis', input);
      const digest = await this.digest(SharedCanonicalBytes.encode(genesis));
      requireSource(digest === this.context.genesisSha256, 'GenesisUnapproved');
      requireSource(genesis.worldId === this.context.worldId && genesis.mapId === this.context.mapId
        && genesis.contentManifestSha256 === this.context.contentManifestSha256, 'GenesisContextMismatch');
      requireSource(sameData(genesis.developerTrustAnchor, this.context.developerTrustAnchor)
        && genesis.worldDeveloperAccountId === this.context.developerTrustAnchor.worldDeveloperAccountId, 'GenesisRootMismatch');
      const state = genesis.initialState;
      requireSource(state.worldId === genesis.worldId && state.mapId === genesis.mapId
        && state.contentManifestSha256 === genesis.contentManifestSha256, 'GenesisStateContextMismatch');
      requireSource(state.developerRoster.worldDeveloperAccountId === genesis.worldDeveloperAccountId
        && !state.developerRoster.frozen, 'GenesisRosterMismatch');
      for (const entity of state.entities) {
        requireSource(entity.createdBy === null && entity.lastEditedBy === null && entity.deletedBy === null, 'GenesisRuntimeAttribution');
        requireSource(this.isApprovedEntityDefinition(entity.definition), 'GenesisContentUnapproved');
      }
      for (const trigger of state.triggers) {
        requireSource(trigger.createdBy === null && trigger.lastEditedBy === null && trigger.deletedBy === null, 'GenesisRuntimeAttribution');
        requireSource(state.entities.some(entity => entity.definition.entityId === trigger.definition.anchorEntityId)
          && state.entities.some(entity => entity.definition.entityId === trigger.definition.action.targetEntityId
            && entity.definition.elementType === 'Residue'), 'GenesisTriggerReferenceInvalid');
      }
      for (const id of state.revealedResidueEntityIds) {
        requireSource(state.entities.some(entity => entity.definition.entityId === id && entity.definition.elementType === 'Residue'), 'GenesisRevealReferenceInvalid');
      }
      for (const aggregate of state.traceTouches) {
        requireSource(state.entities.some(entity => entity.definition.entityId === aggregate.normalTraceEntityId
          && entity.definition.elementType === 'Trace' && entity.definition.normalTrace !== null
          && entity.definition.normalTrace.traceTouchId === aggregate.traceTouchId), 'GenesisTraceReferenceInvalid');
      }
      return this.capability(this.genesisCapabilities, { genesis, genesisSha256: digest });
    });
  }

  /** Policy decisions must not throw or access platform APIs. A throwing producer is a host failure. */
  isApprovedEntityDefinition(input: unknown): boolean {
    const definition = this.codec.validate('SharedMapEntityDefinition', input);
    const result = this.context.isEntityDefinitionApproved(definition);
    if (typeof result !== 'boolean') { throw new SharedCryptoHostFailure('InvalidContentCapabilityResult'); }
    return result;
  }

  async validateCommit(input: unknown): Promise<SharedValidationResult<ValidatedSharedCommit>> {
    return this.guard(async () => {
      await this.verifyInstalledPins();
      // Envelope bytes stay opaque until all origin evidence and their exact digest have passed.
      const wire = this.codec.validate('AdmittedWorldCommit', input);
      const claim = wire.admissionClaim.claim;
      const header = claim.header;
      this.requireHeaderContext(header);
      const bindingReceipt = await this.receipt<WorldAuthorKeyBinding>(wire.authorKeyBindingReceipt, 'AuthorKeyBinding');
      const binding = this.codec.validate('WorldAuthorKeyBinding', bindingReceipt.payload);
      requireSource(binding.serviceInstanceId === this.context.serviceInstanceId
        && binding.authorAccountId === header.identity.authorAccountId
        && binding.authorDeviceId === header.authorDeviceId
        && binding.authorDeviceGeneration === header.authorDeviceGeneration
        && binding.assurance === 'RegisteredCredential', 'AuthorBindingMismatch');
      const authorFingerprint = await this.fingerprint(binding.authorSigningPublicJwk);
      requireSource(authorFingerprint === binding.authorSigningKeyFingerprint
        && authorFingerprint === header.authorSigningKeyFingerprint, 'AuthorFingerprintMismatch');
      requireSource(binding.registeredAtServerEpochMs <= header.appendedAt.epochMs, 'AuthorRegisteredAfterAppend');
      requireSource(claim.serviceInstanceId === this.context.serviceInstanceId, 'ClaimServiceMismatch');
      requireSource(await this.verify(binding.authorSigningPublicJwk, wire.admissionClaim.authorSignatureBase64Url,
        SharedCanonicalBytes.domain('Neurou/commit-admission-claim/v1\0', claim)), 'AdmissionClaimSignatureInvalid');

      const segmentReceipt = await this.receipt<AuthorSequenceSegment>(wire.sequenceSegmentReceipt, 'SequenceSegment');
      const segment = this.codec.validate('AuthorSequenceSegment', segmentReceipt.payload);
      const permitReceipt = await this.receipt<WorldAppendPermit>(wire.appendPermitReceipt, 'WorldAppendPermit');
      const permit = this.codec.validate('WorldAppendPermit', permitReceipt.payload);
      const admissionReceipt = await this.receipt<WorldCommitAdmission>(wire.admissionReceipt, 'WorldCommitAdmission');
      const admission = this.codec.validate('WorldCommitAdmission', admissionReceipt.payload);
      requireSource(segment.serviceInstanceId === this.context.serviceInstanceId && segment.worldId === header.worldId
        && segment.segmentId === header.segmentId && segment.authorAccountId === header.identity.authorAccountId
        && segment.authorDeviceId === header.authorDeviceId && segment.authorDeviceGeneration === header.authorDeviceGeneration
        && segment.membershipEpoch === header.membershipEpoch
        && header.identity.authorSequence >= segment.firstSequence && header.identity.authorSequence <= segment.lastSequence,
      'SequenceSegmentMismatch');
      requireSource(segmentReceipt.issuedAtServerEpochMs === segment.issuedAtServerEpochMs, 'SequenceIssueMismatch');
      requireSource(header.appendedAt.epochMs >= segment.issuedAtServerEpochMs
        && header.appendedAt.epochMs < segment.expiresAtServerEpochMs, 'SequenceWindowMismatch');
      requireSource(permit.serviceInstanceId === this.context.serviceInstanceId && permit.worldId === header.worldId
        && sameData(permit.identity, header.identity) && permit.authorDeviceId === header.authorDeviceId
        && permit.authorDeviceGeneration === header.authorDeviceGeneration && permit.segmentId === header.segmentId
        && permit.permitId === header.permitId && permit.membershipEpoch === header.membershipEpoch
        && permit.keyEpoch === header.keyEpoch && permit.changeClass === header.changeClass
        && sameData(permit.appendedAt, header.appendedAt), 'AppendPermitMismatch');
      requireSource(permitReceipt.requestNonce === permit.requestNonce
        && permitReceipt.clockGeneration === permit.clockGeneration
        && permitReceipt.issuedAtServerEpochMs === permit.appendedAt.epochMs, 'PermitReceiptMismatch');
      requireSource(admission.serviceInstanceId === this.context.serviceInstanceId && admission.worldId === header.worldId
        && sameData(admission.identity, header.identity) && sameData(admission.appendedAt, header.appendedAt)
        && admission.membershipEpoch === header.membershipEpoch
        && admission.envelopeSha256 === claim.envelopeSha256
        && admissionReceipt.requestNonce === claim.requestNonce
        && admissionReceipt.issuedAtServerEpochMs === admission.admittedAtServerEpochMs, 'AdmissionReceiptMismatch');
      // Compare expiry with signed acceptance time, never today's wallclock.
      requireSource(admission.admittedAtServerEpochMs >= header.appendedAt.epochMs
        && admission.admittedAtServerEpochMs < permit.expiresAtServerEpochMs
        && admission.admittedAtServerEpochMs < segment.expiresAtServerEpochMs, 'AdmissionWindowMismatch');
      const membership = await this.verifyMembership(wire, header);
      await this.verifyRosterOrigin(wire, header, admission);
      const envelopeBytes = SharedCanonicalBytes.base64UrlDecode(wire.envelopeBytesBase64Url);
      requireSource(await this.digest(envelopeBytes) === claim.envelopeSha256, 'EnvelopeDigestMismatch');
      const relayKey = await this.context.lookupWorldRelayKey(membership.key);
      requireSource(relayKey !== null, 'KeyUnavailable');
      if (!(relayKey instanceof Uint8Array) || relayKey.length !== 32) { throw new SharedCryptoHostFailure('InvalidKeyCapability'); }
      requireSource(await this.digest(relayKey) === membership.key.keyCommitmentSha256, 'KeyCommitmentMismatch');
      const base = { wire, envelopeBytesBase64Url: wire.envelopeBytesBase64Url, identity: header.identity,
        appendedAt: header.appendedAt, envelopeSha256: claim.envelopeSha256, admissionRevision: admission.admissionRevision,
        header, sequenceSegment: segment, rosterTargetObserverActiveAtAppendedAt: admission.rosterTargetObserverActiveAtAppendedAt };
      let envelope: RelayCommitEnvelope;
      try { envelope = this.codec.decode('RelayCommitEnvelope', envelopeBytes); }
      catch (error) {
        if (error instanceof SharedSchemaError) { return this.invalidCommit(base, 'EnvelopeSchemaInvalid'); }
        throw error;
      }
      if (!sameData(envelope.header, header)) { return this.invalidCommit(base, 'EnvelopeHeaderMismatch'); }
      if (!await this.verify(binding.authorSigningPublicJwk, envelope.authorSignatureBase64Url,
        SharedCanonicalBytes.domain('Neurou/world-commit/v1\0', unsigned(envelope, ['authorSignatureBase64Url'])))) {
        return this.invalidCommit(base, 'EnvelopeSignatureInvalid');
      }
      const wrapKey = await this.crypto.hkdfSha256(relayKey.slice(), hashBytes(await this.digest(SharedCanonicalBytes.encode(header.identity))),
        SharedCanonicalBytes.domain('Neurou/relay-dek/v1\0', header), 32);
      if (!(wrapKey instanceof Uint8Array) || wrapKey.length !== 32) { throw new SharedCryptoHostFailure('InvalidHkdfResult'); }
      const dataKey = await this.crypto.decryptAes256Gcm(wrapKey,
        SharedCanonicalBytes.base64UrlDecode(envelope.wrappedCommitDataKey.nonceBase64Url, 12),
        SharedCanonicalBytes.base64UrlDecode(envelope.wrappedCommitDataKey.ciphertextAndTagBase64Url, 48),
        SharedCanonicalBytes.domain('Neurou/relay-wrap/v1\0', header));
      if (dataKey === null) { return this.invalidCommit(base, 'WrappedDataKeyAuthenticationInvalid'); }
      if (!(dataKey instanceof Uint8Array) || dataKey.length !== 32) { throw new SharedCryptoHostFailure('InvalidDataKeyResult'); }
      const plaintext = await this.crypto.decryptAes256Gcm(dataKey,
        SharedCanonicalBytes.base64UrlDecode(envelope.nonceBase64Url, 12),
        SharedCanonicalBytes.base64UrlDecode(envelope.ciphertextAndTagBase64Url),
        SharedCanonicalBytes.domain('Neurou/relay-body/v1\0', { header, wrappedCommitDataKey: envelope.wrappedCommitDataKey }));
      if (plaintext === null) { return this.invalidCommit(base, 'BodyAuthenticationInvalid'); }
      if (!(plaintext instanceof Uint8Array)) { throw new SharedCryptoHostFailure('InvalidDecryptionResult'); }
      if (plaintext.length > 49152) { return this.invalidCommit(base, 'BodyLimitExceeded'); }
      let commit: WorldCommit;
      try { commit = this.codec.decode('WorldCommit', plaintext); }
      catch (error) {
        if (error instanceof SharedSchemaError) { return this.invalidCommit(base, 'BodySchemaInvalid'); }
        throw error;
      }
      if (!this.bodyMatchesHeader(commit, header)) { return this.invalidCommit(base, 'BodyHeaderMismatch'); }
      if (commit.mapId !== this.context.mapId || commit.contentManifestSha256 !== this.context.contentManifestSha256) {
        return this.invalidCommit(base, 'BodyContentContextMismatch');
      }
      if (commit.change.changeClass === 'DeveloperMapChange' && commit.change.subtype === 'MapEditCommit') {
        const edit = commit.change.edit;
        if ((edit.operation === 'CreateEntity' || edit.operation === 'ReplaceEntity') && !this.isApprovedEntityDefinition(edit.definition)) {
          return this.invalidCommit(base, 'EntityContentUnapproved');
        }
      }
      if (commit.change.changeClass === 'DeveloperMapChange' && commit.change.subtype === 'DeveloperRosterChange'
        && commit.change.operation === 'AddCoDeveloper' && admission.rosterTargetObserverActiveAtAppendedAt !== true) {
        return this.invalidCommit(base, 'RosterObserverInactive');
      }
      return this.capability(this.commitCapabilities, { ...base, commit, change: commit.change, invalid: false, invalidReason: null });
    });
  }

  async validateSeal(input: unknown, policyInput: SharedSettlementPolicy,
    previous: ValidatedSharedSeal | null = null): Promise<SharedValidationResult<ValidatedSharedSeal>> {
    return this.guard(async () => {
      await this.verifyInstalledPins();
      const wire = await this.receipt<RelaySettlementSeal>(input, 'RelaySettlementSeal');
      const seal = this.codec.validate('RelaySettlementSeal', wire.payload);
      const policy = this.codec.validate('SharedSettlementPolicy', policyInput);
      requireSource(seal.serviceInstanceId === this.context.serviceInstanceId && seal.worldId === this.context.worldId, 'SealContextMismatch');
      requireSource(seal.policySha256 === await this.digest(SharedCanonicalBytes.encode(policy)), 'SealPolicyMismatch');
      requireSource(wire.issuedAtServerEpochMs === seal.issuedAtServerEpochMs
        && seal.issuedAtServerEpochMs >= policy.settleHorizonMs
        && seal.sealedThroughEpochMs <= seal.issuedAtServerEpochMs - policy.settleHorizonMs, 'SealHorizonMismatch');
      if (previous === null) { requireSource(seal.previousSealSha256 === null, 'SealParentMissing'); }
      else {
        requireSource(this.ownsSeal(previous), 'SealParentUntrusted');
        if (seal.sealedThroughEpochMs === previous.seal.sealedThroughEpochMs) {
          requireSource(sameData(wire, previous.wire), 'SealBoundaryChanged');
        } else {
          requireSource(seal.sealedThroughEpochMs > previous.seal.sealedThroughEpochMs
            && seal.previousSealSha256 === previous.receiptSha256
            && seal.sealRevision > previous.seal.sealRevision
            && seal.admittedCommitCount >= previous.seal.admittedCommitCount, 'SealParentMismatch');
        }
      }
      return this.capability(this.sealCapabilities, { wire, seal, receiptSha256: await this.digest(SharedCanonicalBytes.encode(wire)) });
    });
  }

  async validateClosure(input: unknown): Promise<SharedValidationResult<ValidatedSharedClosure>> {
    return this.guard(async () => {
      await this.verifyInstalledPins();
      const wire = await this.receipt<WorldDeveloperClosureFact>(input, 'WorldDeveloperClosure');
      const closure = this.codec.validate('WorldDeveloperClosureFact', wire.payload);
      requireSource(closure.serviceInstanceId === this.context.serviceInstanceId && closure.worldId === this.context.worldId
        && closure.worldDeveloperAccountId === this.context.developerTrustAnchor.worldDeveloperAccountId, 'ClosureContextMismatch');
      requireSource(wire.issuedAtServerEpochMs >= closure.effectiveAtServerEpochMs, 'ClosureTimeMismatch');
      return this.capability(this.closureCapabilities, { wire, closure, receiptSha256: await this.digest(SharedCanonicalBytes.encode(wire)) });
    });
  }

  async validateRejection(input: unknown): Promise<SharedValidationResult<ValidatedSharedRejection>> {
    return this.guard(async () => {
      await this.verifyInstalledPins();
      const wire = await this.receipt<WorldCommitRejection>(input, 'WorldCommitRejection');
      const rejection = this.codec.validate('WorldCommitRejection', wire.payload);
      requireSource(rejection.serviceInstanceId === this.context.serviceInstanceId && rejection.worldId === this.context.worldId
        && wire.issuedAtServerEpochMs === rejection.rejectedAtServerEpochMs
        && rejection.rejectedAtServerEpochMs >= rejection.appendedAt.epochMs
        && rejection.previouslyAdmitted === false, 'RejectionContextMismatch');
      return this.capability(this.rejectionCapabilities, { wire, rejection, receiptSha256: await this.digest(SharedCanonicalBytes.encode(wire)) });
    });
  }

  private async verifyMembership(wire: AdmittedWorldCommit, header: RelayCommitHeader): Promise<WorldMembershipEpoch> {
    const receipt = await this.receipt<WorldMembershipEpoch>(wire.membershipEpochReceipt, 'WorldMembership');
    const epoch = this.codec.validate('WorldMembershipEpoch', receipt.payload);
    requireSource(epoch.serviceInstanceId === this.context.serviceInstanceId && epoch.worldId === header.worldId
      && epoch.membershipEpoch === header.membershipEpoch && epoch.key.membershipEpoch === header.membershipEpoch
      && epoch.key.worldId === header.worldId && epoch.key.keyEpoch === header.keyEpoch
      && epoch.key.worldRelayKeyId === header.worldRelayKeyId
      && epoch.activatedAtServerEpochMs <= header.appendedAt.epochMs
      && receipt.issuedAtServerEpochMs >= epoch.activatedAtServerEpochMs, 'MembershipEpochMismatch');
    requireSource(epoch.developerTrustAnchorSha256 === await this.digest(SharedCanonicalBytes.encode(this.context.developerTrustAnchor)), 'MembershipRootMismatch');
    requireSource(await this.verify(this.context.developerTrustAnchor.developerPublicKey, epoch.developerSignatureBase64Url,
      SharedCanonicalBytes.domain('Neurou/world-membership/v1\0', unsigned(epoch, ['developerSignatureBase64Url', 'activatedAtServerEpochMs']))),
    'MembershipPublisherSignatureInvalid');
    for (const credential of epoch.credentials) {
      const agreementFingerprint = await this.fingerprint(credential.keyAgreementPublicKey);
      requireSource(credential.keyAgreementKeyFingerprint === agreementFingerprint, 'MemberAgreementFingerprintMismatch');
      requireSource(agreementFingerprint !== credential.registeredSigningKeyFingerprint
        && agreementFingerprint !== this.context.developerTrustAnchor.developerPublicKeyFingerprint
        && agreementFingerprint !== this.context.serviceKeyFingerprint, 'MemberKeyPurposeConflict');
      requireSource(credential.observerAdmissionRevision !== null
        || credential.accountId === this.context.developerTrustAnchor.worldDeveloperAccountId, 'MemberAdmissionMissing');
    }
    requireSource(epoch.credentials.some(credential => credential.accountId === header.identity.authorAccountId
      && credential.deviceId === header.authorDeviceId && credential.deviceGeneration === header.authorDeviceGeneration
      && credential.registeredSigningKeyFingerprint === header.authorSigningKeyFingerprint), 'MemberCredentialMismatch');
    return epoch;
  }

  private async verifyRosterOrigin(wire: AdmittedWorldCommit, header: RelayCommitHeader, admission: WorldCommitAdmission): Promise<void> {
    const roster = header.restrictedWrite;
    if (roster !== null && roster.subtype === 'DeveloperRosterChange') {
      requireSource(wire.rosterObserverAdmissionReceipt !== null, 'RosterObserverFactMissing');
      const receipt = await this.receipt<WorldObserverAdmissionFact>(wire.rosterObserverAdmissionReceipt, 'WorldMembership');
      const fact = this.codec.validate('WorldObserverAdmissionFact', receipt.payload);
      requireSource(fact.serviceInstanceId === this.context.serviceInstanceId && fact.worldId === header.worldId
        && fact.observerAccountId === roster.accountId && fact.observerAdmissionRevision === roster.observerAdmissionRevision
        && fact.admittedAtServerEpochMs <= header.appendedAt.epochMs
        && fact.developerTrustAnchorSha256 === await this.digest(SharedCanonicalBytes.encode(this.context.developerTrustAnchor)),
      'RosterObserverFactMismatch');
      requireSource(roster.operation === 'AddCoDeveloper'
        ? typeof admission.rosterTargetObserverActiveAtAppendedAt === 'boolean'
        : admission.rosterTargetObserverActiveAtAppendedAt === null, 'RosterObserverActivityMismatch');
    } else {
      requireSource(wire.rosterObserverAdmissionReceipt === null
        && admission.rosterTargetObserverActiveAtAppendedAt === null, 'UnexpectedRosterObserverFact');
    }
  }

  private bodyMatchesHeader(commit: WorldCommit, header: RelayCommitHeader): boolean {
    if (commit.schemaVersion !== header.schemaVersion || commit.profile !== header.profile || commit.worldId !== header.worldId
      || !sameData(commit.identity, header.identity) || commit.authorDeviceId !== header.authorDeviceId
      || commit.authorDeviceGeneration !== header.authorDeviceGeneration || commit.segmentId !== header.segmentId
      || commit.permitId !== header.permitId || commit.membershipEpoch !== header.membershipEpoch
      || commit.keyEpoch !== header.keyEpoch || !sameData(commit.appendedAt, header.appendedAt)
      || commit.change.changeClass !== header.changeClass || commit.change.commitClass !== header.commitClass) { return false; }
    if (commit.change.changeClass !== 'DeveloperMapChange') { return header.restrictedWrite === null; }
    if (commit.change.subtype === 'MapEditCommit') { return sameData(header.restrictedWrite, { subtype: 'MapEditCommit' }); }
    return sameData(header.restrictedWrite, { subtype: 'DeveloperRosterChange', operation: commit.change.operation,
      accountId: commit.change.accountId, observerAdmissionRevision: commit.change.observerAdmissionRevision });
  }

  private requireHeaderContext(header: RelayCommitHeader): void {
    requireSource(header.serviceInstanceId === this.context.serviceInstanceId && header.worldId === this.context.worldId, 'HeaderContextMismatch');
  }

  private async receipt<T>(input: unknown, purpose: SharedAuthorityReceipt<T>['purpose']): Promise<SharedAuthorityReceipt<T>> {
    const value = this.codec.validate('SharedAuthorityReceipt', input);
    requireSource(value.purpose === purpose && value.serviceInstanceId === this.context.serviceInstanceId
      && value.keyId === this.context.serviceKeyFingerprint && value.clockStatus === 'Trusted'
      && value.clockGeneration >= 1 && value.clockGeneration <= this.context.clockGeneration, 'AuthorityReceiptContextMismatch');
    requireSource(await this.verify(this.context.servicePublicKeyJwk, value.signatureBase64Url,
      SharedCanonicalBytes.domain('Neurou/shared-authority/v1\0', unsigned(value, ['signatureBase64Url']))), 'AuthorityReceiptSignatureInvalid');
    return value as SharedAuthorityReceipt<T>;
  }

  private async verifyInstalledPins(): Promise<void> {
    requireSource(await this.fingerprint(this.context.servicePublicKeyJwk) === this.context.serviceKeyFingerprint, 'InstalledServicePinMismatch');
    const anchor = this.context.developerTrustAnchor;
    const fingerprint = await this.fingerprint(anchor.developerPublicKey);
    requireSource(fingerprint === anchor.developerPublicKeyFingerprint
      && fingerprint === anchor.developerSigningKeyId, 'InstalledDeveloperPinMismatch');
  }

  private async fingerprint(jwk: WorldKeyAgreementPublicKey): Promise<string> {
    const key = this.codec.validate('WorldKeyAgreementPublicKey', jwk);
    return SharedCanonicalBytes.base64UrlEncode(hashBytes(await this.digest(SharedCanonicalBytes.encode(key))));
  }
  private async digest(bytes: Uint8Array): Promise<string> {
    const digest = await this.crypto.sha256(bytes);
    hashBytes(digest);
    return digest;
  }
  private async verify(jwk: WorldKeyAgreementPublicKey, signature: string, message: Uint8Array): Promise<boolean> {
    const result = await this.crypto.verifyEs256(jwk, SharedCanonicalBytes.base64UrlDecode(signature, 64), message);
    if (typeof result !== 'boolean') { throw new SharedCryptoHostFailure('InvalidSignatureResult'); }
    return result;
  }
  private invalidCommit(base: Omit<ValidatedSharedCommit, 'commit' | 'change' | 'invalid' | 'invalidReason'>,
    reason: string): ValidatedSharedCommit {
    return this.capability(this.commitCapabilities, { ...base, commit: null, change: null, invalid: true, invalidReason: reason });
  }
  private capability<T extends object>(set: WeakSet<object>, value: T): T {
    const frozen = Object.freeze(value);
    set.add(frozen);
    return frozen;
  }
  private async guard<T>(action: () => Promise<T>): Promise<SharedValidationResult<T>> {
    try { return Object.freeze({ kind: 'Verified', value: await action() }); }
    catch (error) {
      if (error instanceof SharedVerificationGap || error instanceof SharedSchemaError) {
        return Object.freeze({ kind: 'Gap', reason: error.message });
      }
      // Backend failures are never evidence that an author's authenticated body is invalid.
      return Object.freeze({ kind: 'HostFailure', reason: error instanceof SharedCryptoHostFailure ? error.message : 'CryptoOrProducerUnavailable' });
    }
  }
}
