import type {
  AccountLoginRequest, AuthenticatedServiceContext, DeviceChallenge, RealAccountFact,
  RealAccountFacts, RealAuthServicePort, RealRegisteredDeviceFact, RealServiceEnvironment,
  ServerTimeSample, ServiceAuthenticationPayload, ServiceFault, ServicePublicKey,
  ServiceReceiptPurpose, ServiceReply, SignedServiceReceipt,
} from '../director/IntentPort';

interface MemoryDeviceCredential {
  readonly privateKey: CryptoKey;
  readonly publicKeyJwk: ServicePublicKey;
  readonly keyFingerprint: string;
  deviceId: string | null;
  generation: number | null;
}
type DataObject = { [name: string]: unknown };
const SERVICE_DOMAIN = 'Neurou/service/v1\0';
const DEVICE_DOMAIN = 'Neurou/device/v1\0';
const REQUEST_LIMIT_MS = 12000;

class ServiceClientFault extends Error {
  constructor(readonly code: ServiceFault['code']) { super(code); }
}

/**
 * Independent B2.5b browser HTTP adapter. Secrets and device keys remain in memory;
 * HttpOnly cookies belong to the browser. No world data, fixture fallback or offline grant.
 * The credential proves control of a registered key, not a physical machine.
 */
export class RealAuthServiceAdapter implements RealAuthServicePort {
  readonly mode = 'ExternalService' as const;
  private readonly environment: RealServiceEnvironment;
  private readonly credentials = new Map<string, MemoryDeviceCredential>();
  private context: AuthenticatedServiceContext | null = null;
  private csrfToken: string | null = null;
  private readonly anchor: Promise<CryptoKey>;
  private transport: typeof fetch;
  private busy = false;

  constructor(environment: RealServiceEnvironment) {
    this.environment = parseEnvironment(environment);
    if (typeof crypto === 'undefined' || !crypto.subtle || typeof fetch !== 'function'
      || (typeof isSecureContext === 'boolean' && !isSecureContext)) {
      throw new ServiceClientFault('DeviceUntrusted');
    }
    if (typeof location !== 'undefined' && location.origin !== this.environment.apiOrigin) {
      throw new ServiceClientFault('InvalidData');
    }
    this.transport = fetch.bind(globalThis);
    this.anchor = importAuthorityKey(this.environment);
    // Import failures are still returned by every operation; suppress an unobserved rejection.
    void this.anchor.catch(() => undefined);
  }

  /** Cookie-jar transport for real loopback HTTP evidence only; signature checks stay enabled. */
  static forLoopbackHttpTest(environment: RealServiceEnvironment, transport: typeof fetch): RealAuthServiceAdapter {
    if (!isLoopbackHttp(environment.apiOrigin) || typeof transport !== 'function') {
      throw new ServiceClientFault('InvalidData');
    }
    const adapter = new RealAuthServiceAdapter(environment);
    adapter.transport = transport;
    return adapter;
  }

  async login(request: AccountLoginRequest): Promise<ServiceReply<AuthenticatedServiceContext>> {
    return this.exclusive(async () => {
      const input = dataObject(request, ['accountName', 'password', 'deviceLabel']);
      const accountName = accountNameField(input.accountName);
      const password = textField(input.password, 1024);
      if (password.length < 12) { throw new ServiceClientFault('InvalidData'); }
      const deviceLabel = textField(input.deviceLabel, 128);
      await this.anchor;
      let credential = this.credentials.get(accountName);
      if (!credential) {
        if (this.credentials.size >= 16) { throw new ServiceClientFault('InvalidData'); }
        credential = await createCredential();
        this.credentials.set(accountName, credential);
      }
      const challengeNonce = nonce();
      const challengeReceipt = await this.call('/api/v1/device/challenge', {
        purpose: 'LoginDevice', accountName, publicKeyJwk: credential.publicKeyJwk,
        deviceId: credential.deviceId, requestNonce: challengeNonce,
      }, 'DeviceChallenge', challengeNonce, false);
      const challenge = parseChallenge(challengeReceipt.payload);
      if (challenge.purpose !== 'LoginDevice' || challenge.accountName !== accountName
        || challenge.keyFingerprint !== credential.keyFingerprint
        || challenge.deviceId !== credential.deviceId || challenge.deviceGeneration !== credential.generation
        || challenge.serviceInstanceId !== this.environment.serviceInstanceId
        || challenge.expiresAtServerEpochMs <= challengeReceipt.issuedAtServerEpochMs
        || challenge.expiresAtServerEpochMs - challengeReceipt.issuedAtServerEpochMs > 30000) {
        throw new ServiceClientFault('DeviceUntrusted');
      }
      const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, credential.privateKey,
        utf8(DEVICE_DOMAIN + canonicalJson(challenge)));
      const requestNonce = nonce();
      const receipt = await this.call('/api/v1/auth/login', {
        accountName, password, challengeId: challenge.challengeId,
        signatureBase64Url: base64Url(new Uint8Array(signature)), deviceLabel, requestNonce,
      }, 'Authentication', requestNonce, false);
      const auth = parseAuthentication(receipt.payload, receipt.issuedAtServerEpochMs);
      if (auth.account.accountName !== accountName || auth.device.keyFingerprint !== credential.keyFingerprint
        || (credential.deviceId !== null && (auth.device.deviceId !== credential.deviceId
          || auth.device.generation !== credential.generation))) {
        throw new ServiceClientFault('DeviceUntrusted');
      }
      credential.deviceId = auth.device.deviceId;
      credential.generation = auth.device.generation;
      return this.acceptAuthentication(auth);
    }, true);
  }

  async verify(): Promise<ServiceReply<AuthenticatedServiceContext>> {
    return this.authenticateExisting('/api/v1/auth/verify');
  }

  async refresh(): Promise<ServiceReply<AuthenticatedServiceContext>> {
    return this.authenticateExisting('/api/v1/auth/refresh');
  }

  async logout(): Promise<ServiceReply<{ readonly serverRevoked: true }>> {
    return this.exclusive(async () => {
      const prior = this.requireContext();
      try {
        const requestNonce = nonce();
        const receipt = await this.call('/api/v1/auth/logout', { requestNonce }, 'Logout', requestNonce, true);
        const payload = dataObject(receipt.payload, ['requestNonce', 'sessionId', 'revoked']);
        if (payload.sessionId !== prior.authenticationId || payload.revoked !== true) {
          throw new ServiceClientFault('InvalidData');
        }
        return Object.freeze({ serverRevoked: true as const });
      } finally {
        // Remote revocation failure remains a Rejected result; local admission is always cleared.
        this.context = null;
        this.csrfToken = null;
      }
    });
  }

  async fetchServerTime(): Promise<number> {
    const result = await this.readServerTime();
    if (result.kind === 'Rejected') { throw new ServiceClientFault(result.fault.code); }
    return result.value.payload.serverEpochMs;
  }

  async readServerTime(): Promise<ServiceReply<SignedServiceReceipt<ServerTimeSample>>> {
    return this.exclusive(async () => {
      this.requireContext();
      const requestNonce = nonce();
      const receipt = await this.call('/api/v1/time', { requestNonce }, 'ServerTime', requestNonce, true);
      const payload = dataObject(receipt.payload, ['requestNonce', 'serverEpochMs', 'clockGeneration', 'clockStatus']);
      if (payload.clockStatus !== 'Trusted') { throw new ServiceClientFault('TimeUntrusted'); }
      if (integerField(payload.serverEpochMs) !== receipt.issuedAtServerEpochMs) {
        throw new ServiceClientFault('TimeUntrusted');
      }
      integerField(payload.clockGeneration, 1);
      return freezeTree(receipt) as unknown as SignedServiceReceipt<ServerTimeSample>;
    });
  }

  async readAccountFacts(): Promise<ServiceReply<SignedServiceReceipt<RealAccountFacts>>> {
    return this.exclusive(async () => {
      const current = this.requireContext();
      const requestNonce = nonce();
      const receipt = await this.call('/api/v1/account/facts', { requestNonce }, 'AccountFacts', requestNonce, true);
      const payload = dataObject(receipt.payload, ['requestNonce', 'account', 'devices', 'revision']);
      const account = parseAccount(payload.account);
      if (account.accountId !== current.accountId || account.accountName !== current.accountName
        || !Array.isArray(payload.devices) || payload.devices.length > 256) {
        throw new ServiceClientFault('InvalidData');
      }
      integerField(payload.revision);
      if (payload.revision !== 0) { throw new ServiceClientFault('VersionUnsupported'); }
      const deviceIds = new Set<string>();
      const credential = this.credentials.get(current.accountName);
      let currentFound = false;
      for (const candidate of payload.devices) {
        const device = parseDevice(candidate, false);
        if (deviceIds.has(device.deviceId)) { throw new ServiceClientFault('InvalidData'); }
        deviceIds.add(device.deviceId);
        if (device.deviceId === current.deviceId) {
          if (device.status !== 'Active' || device.generation !== current.deviceGeneration
            || !credential || device.keyFingerprint !== credential.keyFingerprint) {
            throw new ServiceClientFault('DeviceUntrusted');
          }
          currentFound = true;
        }
      }
      if (!currentFound) { throw new ServiceClientFault('DeviceUntrusted'); }
      return freezeTree(receipt) as unknown as SignedServiceReceipt<RealAccountFacts>;
    });
  }

  private async authenticateExisting(path: string): Promise<ServiceReply<AuthenticatedServiceContext>> {
    return this.exclusive(async () => {
      const previous = this.requireContext();
      const requestNonce = nonce();
      const receipt = await this.call(path, { requestNonce }, 'Authentication', requestNonce, true);
      const auth = parseAuthentication(receipt.payload, receipt.issuedAtServerEpochMs);
      const credential = this.credentials.get(previous.accountName);
      if (auth.account.accountId !== previous.accountId || auth.account.accountName !== previous.accountName
        || auth.device.deviceId !== previous.deviceId || auth.device.generation !== previous.deviceGeneration
        || !credential || auth.device.keyFingerprint !== credential.keyFingerprint) {
        throw new ServiceClientFault('DeviceUntrusted');
      }
      return this.acceptAuthentication(auth);
    }, path === '/api/v1/auth/refresh');
  }

  private acceptAuthentication(auth: ServiceAuthenticationPayload): AuthenticatedServiceContext {
    this.csrfToken = auth.csrfToken;
    this.context = Object.freeze({
      accountId: auth.account.accountId, accountName: auth.account.accountName,
      deviceId: auth.device.deviceId, deviceGeneration: auth.device.generation,
      deviceAssurance: 'RegisteredCredential' as const, authenticationId: auth.sessionId,
      expiresAtServerEpochMs: auth.expiresAtServerEpochMs, serviceInstanceId: this.environment.serviceInstanceId,
    });
    return this.context;
  }

  private requireContext(): AuthenticatedServiceContext {
    if (!this.context || !this.csrfToken) { throw new ServiceClientFault('Unauthenticated'); }
    return this.context;
  }

  private async exclusive<T>(operation: () => Promise<T>, revokeOnUnauthenticated = false): Promise<ServiceReply<T>> {
    if (this.busy) { return rejected('Conflict'); }
    this.busy = true;
    try { return Object.freeze({ kind: 'Accepted' as const, value: await operation() }); }
    catch (failure) {
      const code = failure instanceof ServiceClientFault ? failure.code : 'AuthorityUnavailable';
      // Access expiry denies the current operation. Preserve only the memory binding/CSRF
      // needed for server-validated refresh; this cache has no public admission getter.
      if ((code === 'Unauthenticated' && revokeOnUnauthenticated) || code === 'DeviceUntrusted'
        || code === 'InvalidData' || code === 'VersionUnsupported' || code === 'Forbidden') {
        this.context = null; this.csrfToken = null;
      }
      return rejected(code);
    } finally { this.busy = false; }
  }

  private async call(path: string, body: DataObject, purpose: ServiceReceiptPurpose,
    requestNonce: string, authenticated: boolean): Promise<SignedServiceReceipt<unknown>> {
    const anchor = await this.anchor;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_LIMIT_MS);
    const started = performance.now();
    try {
      const headers: { [name: string]: string } = { Accept: 'application/json' };
      headers['Content-Type'] = 'application/json';
      if (authenticated) { this.requireContext(); headers['X-CSRF-Token'] = this.csrfToken as string; }
      const url = this.environment.apiOrigin + path;
      const response = await this.transport(url, {
        method: 'POST', headers, credentials: 'include', mode: 'same-origin',
        cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
        signal: controller.signal, body: canonicalJson(body),
      });
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) {
        throw new ServiceClientFault('InvalidData');
      }
      const responseText = await limitedResponseText(response);
      if (performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {
        throw new ServiceClientFault('AuthorityUnavailable');
      }
      const raw = strictJson(responseText);
      if (!response.ok) { throw parseRejection(raw); }
      const receipt = dataObject(raw, ['schemaVersion', 'serviceInstanceId', 'purpose', 'receiptId',
        'keyId', 'issuedAtServerEpochMs', 'payload', 'signatureBase64Url']);
      if (receipt.schemaVersion !== 1) { throw new ServiceClientFault('VersionUnsupported'); }
      if (receipt.serviceInstanceId !== this.environment.serviceInstanceId || receipt.purpose !== purpose
        || receipt.keyId !== this.environment.authorityTrustAnchor.keyId) {
        throw new ServiceClientFault('InvalidData');
      }
      uuidField(receipt.receiptId);
      integerField(receipt.issuedAtServerEpochMs);
      const payload = dataObject(receipt.payload);
      if (payload.requestNonce !== requestNonce) { throw new ServiceClientFault('InvalidData'); }
      const signature = decodeBase64Url(receipt.signatureBase64Url, 64);
      const unsigned: DataObject = {};
      for (const key of Object.keys(receipt)) { if (key !== 'signatureBase64Url') { unsigned[key] = receipt[key]; } }
      if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, anchor, signature,
        utf8(SERVICE_DOMAIN + canonicalJson(unsigned)))) {
        throw new ServiceClientFault('InvalidData');
      }
      if (performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {
        throw new ServiceClientFault('AuthorityUnavailable');
      }
      return freezeTree(receipt) as unknown as SignedServiceReceipt<unknown>;
    } catch (failure) {
      if (failure instanceof ServiceClientFault) { throw failure; }
      throw new ServiceClientFault('AuthorityUnavailable');
    } finally { clearTimeout(timer); }
  }
}

function rejected(code: ServiceFault['code']): ServiceReply<never> {
  return Object.freeze({ kind: 'Rejected' as const,
    fault: Object.freeze({ code, requestId: nonce(), retryAfterMs: null }) });
}

function parseEnvironment(raw: unknown): RealServiceEnvironment {
  const value = dataObject(raw, ['mode', 'serviceInstanceId', 'apiOrigin', 'authorityTrustAnchor']);
  if (value.mode !== 'ExternalService') { throw new ServiceClientFault('InvalidData'); }
  textField(value.serviceInstanceId, 256);
  const origin = textField(value.apiOrigin, 2048);
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || (url.protocol !== 'https:' && !isLoopbackHttp(origin))) {
    throw new ServiceClientFault('InvalidData');
  }
  const anchor = dataObject(value.authorityTrustAnchor, ['keyId', 'publicKeyJwk', 'jwkSha256']);
  textField(anchor.keyId, 256);
  parsePublicKey(anchor.publicKeyJwk);
  decodeBase64Url(anchor.jwkSha256, 32);
  // Copy trusted configuration, so mutation after construction cannot change the origin or pin.
  return freezeTree(strictJson(canonicalJson(value))) as unknown as RealServiceEnvironment;
}

function isLoopbackHttp(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === '[::1]')
      && url.origin === origin;
  } catch { return false; }
}

async function importAuthorityKey(environment: RealServiceEnvironment): Promise<CryptoKey> {
  const jwk = environment.authorityTrustAnchor.publicKeyJwk;
  if (await keyFingerprint(jwk) !== environment.authorityTrustAnchor.jwkSha256) {
    throw new ServiceClientFault('InvalidData');
  }
  try { return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
  catch { throw new ServiceClientFault('InvalidData'); }
}

async function createCredential(): Promise<MemoryDeviceCredential> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk: ServicePublicKey = Object.freeze({ kty: 'EC', crv: 'P-256',
    x: textField(exported.x, 43), y: textField(exported.y, 43) });
  parsePublicKey(jwk);
  return { privateKey: pair.privateKey, publicKeyJwk: jwk, keyFingerprint: await keyFingerprint(jwk),
    deviceId: null, generation: null };
}

async function keyFingerprint(jwk: ServicePublicKey): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(canonicalJson(jwk)))));
}

function parsePublicKey(raw: unknown): ServicePublicKey {
  const key = dataObject(raw, ['kty', 'crv', 'x', 'y']);
  if (key.kty !== 'EC' || key.crv !== 'P-256') { throw new ServiceClientFault('InvalidData'); }
  decodeBase64Url(key.x, 32); decodeBase64Url(key.y, 32);
  return key as unknown as ServicePublicKey;
}

function parseChallenge(raw: unknown): DeviceChallenge {
  const payload = dataObject(raw, ['schemaVersion', 'purpose', 'challengeId', 'nonceBase64Url',
    'accountName', 'keyFingerprint', 'deviceId', 'deviceGeneration', 'expiresAtServerEpochMs',
    'serviceInstanceId', 'requestNonce']);
  if (payload.schemaVersion !== 1 || (payload.purpose !== 'LoginDevice' && payload.purpose !== 'RegisterDevice')) {
    throw new ServiceClientFault('InvalidData');
  }
  uuidField(payload.challengeId); accountNameField(payload.accountName); textField(payload.serviceInstanceId, 256);
  decodeBase64Url(payload.nonceBase64Url, 32); decodeBase64Url(payload.keyFingerprint, 32);
  decodeBase64Url(payload.requestNonce, 32); integerField(payload.expiresAtServerEpochMs);
  if ((payload.deviceId === null) !== (payload.deviceGeneration === null)) { throw new ServiceClientFault('InvalidData'); }
  if (payload.deviceId !== null) { uuidField(payload.deviceId); integerField(payload.deviceGeneration, 1); }
  return payload as unknown as DeviceChallenge;
}

function parseAccount(raw: unknown): RealAccountFact {
  const account = dataObject(raw, ['accountId', 'accountName']);
  uuidField(account.accountId); accountNameField(account.accountName);
  return account as unknown as RealAccountFact;
}

function parseDevice(raw: unknown, activeOnly: boolean): RealRegisteredDeviceFact {
  const device = dataObject(raw, ['deviceId', 'generation', 'keyFingerprint', 'assurance', 'label', 'status']);
  uuidField(device.deviceId); integerField(device.generation, 1);
  decodeBase64Url(device.keyFingerprint, 32); textField(device.label, 128);
  if (device.assurance !== 'RegisteredCredential' || (device.status !== 'Active' && device.status !== 'Revoked')
    || (activeOnly && device.status !== 'Active')) { throw new ServiceClientFault('DeviceUntrusted'); }
  return device as unknown as RealRegisteredDeviceFact;
}

function parseAuthentication(raw: unknown, issuedAt: number): ServiceAuthenticationPayload {
  const auth = dataObject(raw, ['requestNonce', 'sessionId', 'csrfToken', 'account', 'device', 'expiresAtServerEpochMs']);
  decodeBase64Url(auth.requestNonce, 32); decodeBase64Url(auth.csrfToken, 32); uuidField(auth.sessionId);
  parseAccount(auth.account); parseDevice(auth.device, true);
  if (integerField(auth.expiresAtServerEpochMs) <= issuedAt) { throw new ServiceClientFault('Unauthenticated'); }
  return auth as unknown as ServiceAuthenticationPayload;
}

function parseRejection(raw: unknown): ServiceClientFault {
  const result = dataObject(raw, ['kind', 'fault']);
  if (result.kind !== 'Rejected') { throw new ServiceClientFault('InvalidData'); }
  const fault = dataObject(result.fault, ['code', 'requestId', 'retryAfterMs']);
  textField(fault.requestId, 256);
  if (fault.retryAfterMs !== null) { integerField(fault.retryAfterMs); }
  const codes: readonly unknown[] = ['Unauthenticated', 'DeviceUntrusted', 'AuthorityUnavailable', 'TimeUntrusted',
    'VersionUnsupported', 'Conflict', 'RateLimited', 'InvalidData', 'Forbidden'];
  if (!codes.includes(fault.code)) { throw new ServiceClientFault('InvalidData'); }
  return new ServiceClientFault(fault.code as ServiceFault['code']);
}

function dataObject(raw: unknown, fields?: readonly string[]): DataObject {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || (Object.getPrototypeOf(raw) !== null && Object.getPrototypeOf(raw) !== Object.prototype)
    || Object.getOwnPropertySymbols(raw).length !== 0) { throw new ServiceClientFault('InvalidData'); }
  const keys = Object.keys(raw);
  if (Object.getOwnPropertyNames(raw).length !== keys.length
    || (fields && (keys.length !== fields.length || keys.some(key => !fields.includes(key))))) {
    throw new ServiceClientFault('InvalidData');
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor || !('value' in descriptor)) { throw new ServiceClientFault('InvalidData'); }
  }
  return raw as DataObject;
}

function textField(raw: unknown, maximum: number): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > maximum || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new ServiceClientFault('InvalidData');
  }
  for (let index = 0; index < raw.length; index += 1) {
    const unit = raw.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = raw.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) { throw new ServiceClientFault('InvalidData'); }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) { throw new ServiceClientFault('InvalidData'); }
  }
  return raw;
}

function integerField(raw: unknown, minimum = 0): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < minimum || Object.is(raw, -0)) {
    throw new ServiceClientFault('InvalidData');
  }
  return raw;
}

function uuidField(raw: unknown): string {
  const value = textField(raw, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new ServiceClientFault('InvalidData');
  }
  return value;
}

function accountNameField(raw: unknown): string {
  const value = textField(raw, 64);
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(value)) { throw new ServiceClientFault('InvalidData'); }
  return value;
}

function nonce(): string { return base64Url(crypto.getRandomValues(new Uint8Array(32))); }
function utf8(text: string): Uint8Array { return new TextEncoder().encode(text); }
function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) { binary += String.fromCharCode(byte); }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeBase64Url(raw: unknown, length: number): Uint8Array {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]+$/.test(raw) || raw.length !== Math.ceil(length * 8 / 6)) {
    throw new ServiceClientFault('InvalidData');
  }
  let binary: string;
  try { binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4)); }
  catch { throw new ServiceClientFault('InvalidData'); }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) { bytes[index] = binary.charCodeAt(index); }
  if (bytes.length !== length || base64Url(bytes) !== raw) { throw new ServiceClientFault('InvalidData'); }
  return bytes;
}

/** JCS subset used by this wire: objects/arrays, scalar strings, booleans and safe integers. */
function canonicalJson(raw: unknown): string {
  if (raw === null) { return 'null'; }
  if (typeof raw === 'string') { if (raw.length) { textField(raw, 1048576); } return JSON.stringify(raw); }
  if (typeof raw === 'boolean') { return raw ? 'true' : 'false'; }
  if (typeof raw === 'number') { return String(integerField(raw)); }
  if (Array.isArray(raw)) { return '[' + raw.map(canonicalJson).join(',') + ']'; }
  const object = dataObject(raw);
  return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
}

function freezeTree<T>(raw: T): T {
  if (raw && typeof raw === 'object') {
    for (const value of Object.values(raw)) { freezeTree(value); }
    Object.freeze(raw);
  }
  return raw;
}

async function limitedResponseText(response: Response): Promise<string> {
  if (!response.body) { throw new ServiceClientFault('InvalidData'); }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let content = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) { break; }
      size += part.value.byteLength;
      if (size > 1048576) { await reader.cancel(); throw new ServiceClientFault('InvalidData'); }
      content += decoder.decode(part.value, { stream: true });
    }
    return content + decoder.decode();
  } finally { reader.releaseLock(); }
}

/** Reject duplicate JSON keys before JSON.parse can overwrite one. No reviver or executable values. */
function strictJson(source: string): unknown {
  let offset = 0;
  const whitespace = (): void => { while (/[\x20\x09\x0a\x0d]/.test(source.charAt(offset)) && offset < source.length) { offset += 1; } };
  const fail = (): never => { throw new ServiceClientFault('InvalidData'); };
  const parseString = (): string => {
    const start = offset++;
    while (offset < source.length) {
      const character = source.charAt(offset++);
      if (character === '\\') { offset += 1; }
      else if (character === '"') {
        try { const value: unknown = JSON.parse(source.slice(start, offset));
          if (typeof value !== 'string') { return fail(); }
          if (value.length) { textField(value, 1048576); } return value;
        } catch { return fail(); }
      }
    }
    return fail();
  };
  const parse = (depth: number): unknown => {
    if (depth > 32) { return fail(); }
    whitespace();
    const character = source.charAt(offset);
    if (character === '"') { return parseString(); }
    if (character === '{') {
      offset += 1; whitespace();
      const object: DataObject = Object.create(null) as DataObject;
      const names = new Set<string>();
      if (source.charAt(offset) === '}') { offset += 1; return object; }
      for (;;) {
        if (source.charAt(offset) !== '"') { return fail(); }
        const name = parseString();
        if (names.has(name)) { return fail(); } names.add(name);
        whitespace(); if (source.charAt(offset++) !== ':') { return fail(); }
        object[name] = parse(depth + 1); whitespace();
        const delimiter = source.charAt(offset++);
        if (delimiter === '}') { return object; }
        if (delimiter !== ',') { return fail(); } whitespace();
      }
    }
    if (character === '[') {
      offset += 1; whitespace(); const values: unknown[] = [];
      if (source.charAt(offset) === ']') { offset += 1; return values; }
      for (;;) {
        if (values.length >= 256) { return fail(); }
        values.push(parse(depth + 1)); whitespace(); const delimiter = source.charAt(offset++);
        if (delimiter === ']') { return values; } if (delimiter !== ',') { return fail(); }
      }
    }
    for (const literal of ['true', 'false', 'null']) {
      if (source.slice(offset, offset + literal.length) === literal) {
        offset += literal.length; return literal === 'null' ? null : literal === 'true';
      }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(offset));
    if (!match) { return fail(); } offset += match[0].length; return integerField(Number(match[0]));
  };
  const result = parse(0); whitespace(); if (offset !== source.length) { return fail(); } return result;
}
