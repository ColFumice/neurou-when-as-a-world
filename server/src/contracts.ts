export interface P256PublicJwk { readonly kty: 'EC'; readonly crv: 'P-256'; readonly x: string; readonly y: string }
export type ReceiptPurpose = 'DeviceChallenge' | 'Authentication' | 'Logout' | 'ServerTime' | 'AccountFacts' | 'DeviceFacts';
export interface SignedServiceReceipt<T> {
 readonly schemaVersion: 1; readonly serviceInstanceId: string; readonly purpose: ReceiptPurpose;
 readonly receiptId: string; readonly keyId: string; readonly issuedAtServerEpochMs: number;
 readonly payload: T; readonly signatureBase64Url: string;
}
export interface RegisteredDeviceFact {
 readonly deviceId: string; readonly generation: number; readonly keyFingerprint: string;
 readonly assurance: 'RegisteredCredential'; readonly label: string; readonly status: 'Active' | 'Revoked';
}
export interface AccountIdentity { readonly accountId: string; readonly accountName: string }
export interface DeviceChallenge {
 readonly schemaVersion: 1; readonly purpose: 'LoginDevice' | 'RegisterDevice'; readonly challengeId: string;
 readonly nonceBase64Url: string; readonly accountName: string; readonly keyFingerprint: string;
 readonly deviceId: string | null; readonly deviceGeneration: number | null;
 readonly expiresAtServerEpochMs: number; readonly serviceInstanceId: string; readonly requestNonce: string;
}
export interface AuthenticationFact {
 readonly requestNonce: string; readonly sessionId: string; readonly csrfToken: string;
 readonly account: AccountIdentity; readonly device: RegisteredDeviceFact; readonly expiresAtServerEpochMs: number;
}
export interface ServerTimeSample {
 readonly requestNonce: string; readonly serverEpochMs: number; readonly clockGeneration: number;
 readonly clockStatus: 'Trusted' | 'Untrusted';
}
export interface AccountFacts { readonly requestNonce: string; readonly account: AccountIdentity; readonly devices: readonly RegisteredDeviceFact[]; readonly revision: 0 }
export type ServiceFaultCode = 'Unauthenticated' | 'DeviceUntrusted' | 'AuthorityUnavailable' | 'TimeUntrusted' | 'Conflict' | 'RateLimited' | 'InvalidData' | 'Forbidden';
export interface ServiceFault { readonly kind: 'Rejected'; readonly fault: { readonly code: ServiceFaultCode; readonly requestId: string; readonly retryAfterMs: number | null } }
