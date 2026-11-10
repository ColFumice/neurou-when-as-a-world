/** B2.5b additive external contracts. No archive signature, gameplay guard or storage changes. */
export type RealServiceMode = 'ExternalService';
export type RegisteredDeviceAssurance = 'RegisteredCredential';

export interface ServicePublicKey {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly x: string;
  readonly y: string;
}
export interface AuthorityTrustAnchor {
  readonly keyId: string;
  readonly publicKeyJwk: ServicePublicKey;
  /** RFC 7638 JWK thumbprint: SHA-256, unpadded base64url. Installed out of band. */
  readonly jwkSha256: string;
}
export interface RealServiceEnvironment {
  readonly mode: RealServiceMode;
  readonly serviceInstanceId: string;
  readonly apiOrigin: string;
  readonly authorityTrustAnchor: AuthorityTrustAnchor;
}
export interface RealAccountFact {
  readonly accountId: string;
  readonly accountName: string;
}
export interface RealRegisteredDeviceFact {
  readonly deviceId: string;
  readonly generation: number;
  readonly keyFingerprint: string;
  readonly assurance: RegisteredDeviceAssurance;
  readonly label: string;
  readonly status: 'Active' | 'Revoked';
}
export interface AuthenticatedServiceContext {
  readonly accountId: string;
  readonly accountName: string;
  readonly deviceId: string;
  readonly deviceGeneration: number;
  readonly deviceAssurance: RegisteredDeviceAssurance;
  readonly authenticationId: string;
  readonly expiresAtServerEpochMs: number;
  readonly serviceInstanceId: string;
}
export interface AccountLoginRequest {
  readonly accountName: string;
  readonly password: string;
  readonly deviceLabel: string;
}
export interface ServiceFault {
  readonly code: 'Unauthenticated' | 'DeviceUntrusted' | 'AuthorityUnavailable'
    | 'TimeUntrusted' | 'VersionUnsupported' | 'Conflict' | 'RateLimited' | 'InvalidData' | 'Forbidden';
  readonly requestId: string;
  readonly retryAfterMs: number | null;
}
export type ServiceReply<T> = { readonly kind: 'Accepted'; readonly value: T }
  | { readonly kind: 'Rejected'; readonly fault: ServiceFault };
export type ServiceReceiptPurpose = 'DeviceChallenge' | 'Authentication' | 'Logout'
  | 'ServerTime' | 'AccountFacts' | 'DeviceFacts';
export interface SignedServiceReceipt<T> {
  readonly schemaVersion: 1;
  readonly serviceInstanceId: string;
  readonly purpose: ServiceReceiptPurpose;
  readonly receiptId: string;
  readonly keyId: string;
  readonly issuedAtServerEpochMs: number;
  readonly payload: T;
  /** ES256 with a 64-byte IEEE-P1363 signature; DER is not accepted. */
  readonly signatureBase64Url: string;
}
export interface DeviceChallenge {
  readonly schemaVersion: 1;
  readonly purpose: 'LoginDevice' | 'RegisterDevice';
  readonly challengeId: string;
  readonly nonceBase64Url: string;
  readonly accountName: string;
  readonly keyFingerprint: string;
  readonly deviceId: string | null;
  readonly deviceGeneration: number | null;
  readonly expiresAtServerEpochMs: number;
  readonly serviceInstanceId: string;
  readonly requestNonce: string;
}
export interface ServiceAuthenticationPayload {
  readonly requestNonce: string;
  readonly sessionId: string;
  readonly csrfToken: string;
  readonly account: RealAccountFact;
  readonly device: RealRegisteredDeviceFact;
  readonly expiresAtServerEpochMs: number;
}
export interface ServerTimeSample {
  readonly requestNonce: string;
  readonly serverEpochMs: number;
  readonly clockGeneration: number;
  readonly clockStatus: 'Trusted';
}
export interface RealAccountFacts {
  readonly requestNonce: string;
  readonly account: RealAccountFact;
  readonly devices: readonly RealRegisteredDeviceFact[];
  /** Account/device metadata only; never clear-state or CopyPermission. */
  readonly revision: number;
}
export interface RealAuthServicePort {
  readonly mode: RealServiceMode;
  login(request: AccountLoginRequest): Promise<ServiceReply<AuthenticatedServiceContext>>;
  logout(): Promise<ServiceReply<{ readonly serverRevoked: true }>>;
  verify(): Promise<ServiceReply<AuthenticatedServiceContext>>;
  refresh(): Promise<ServiceReply<AuthenticatedServiceContext>>;
  fetchServerTime(): Promise<number>;
  readServerTime(): Promise<ServiceReply<SignedServiceReceipt<ServerTimeSample>>>;
  readAccountFacts(): Promise<ServiceReply<SignedServiceReceipt<RealAccountFacts>>>;
}

/** Reserved ports are intentionally unimplemented until their stage-specific freeze. */
export interface RealWorldAuthorityPort {
  readonly mode: RealServiceMode;
  readonly context: AuthenticatedServiceContext;
  readAccountFacts(): Promise<ServiceReply<SignedServiceReceipt<RealAccountFacts>>>;
}
/** Generic transport boundary only; no WorldCommit schema is guessed before P3. */
export interface RealCommitRelayPort<TWorldCommit, TRelayReceipt> {
  readonly mode: RealServiceMode;
  relay(commit: TWorldCommit): Promise<ServiceReply<TRelayReceipt>>;
}
