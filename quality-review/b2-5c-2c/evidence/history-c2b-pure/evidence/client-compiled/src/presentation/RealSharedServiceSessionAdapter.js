"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealSharedServiceSessionAdapter = void 0;
const SERVICE_DOMAIN = 'Neurou/service/v1\0';
const DEVICE_DOMAIN = 'Neurou/device/v1\0';
const REQUEST_LIMIT_MS = 12000;
class ServiceClientFault extends Error {
    constructor(code) {
        super(code);
        this.code = code;
    }
}
class SharedRequestConflict extends ServiceClientFault {
    constructor() { super('Conflict'); }
}
/**
 * Independent B2.5c-2b real session owner, using the unchanged B2.5b authentication protocol. Secrets and device keys remain in memory;
 * HttpOnly cookies belong to the browser. No world data, fixture fallback or offline grant.
 * The credential proves control of a registered key, not a physical machine.
 */
class RealSharedServiceSessionAdapter {
    constructor(environment, codec) {
        this.codec = codec;
        this.mode = 'ExternalService';
        this.credentials = new Map();
        this.context = null;
        this.csrfToken = null;
        this.refreshBinding = null;
        this.busy = false;
        this.loggingOut = false;
        this.contextGeneration = 0;
        this.preparedRequests = new Map();
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
    static forLoopbackHttpTest(environment, transport, codec) {
        if (!isLoopbackHttp(environment.apiOrigin) || typeof transport !== 'function') {
            throw new ServiceClientFault('InvalidData');
        }
        const adapter = new RealSharedServiceSessionAdapter(environment, codec);
        adapter.transport = transport;
        return adapter;
    }
    async login(request) {
        if (this.busy || this.loggingOut) {
            return rejected('Conflict');
        }
        this.contextGeneration += 1;
        this.context = null;
        this.csrfToken = null;
        this.refreshBinding = null;
        this.preparedRequests.clear();
        return this.exclusive(async () => {
            const input = dataObject(request, ['accountName', 'password', 'deviceLabel']);
            const accountName = accountNameField(input.accountName);
            const password = textField(input.password, 1024);
            if (password.length < 12) {
                throw new ServiceClientFault('InvalidData');
            }
            const deviceLabel = textField(input.deviceLabel, 128);
            await this.anchor;
            let credential = this.credentials.get(accountName);
            if (!credential) {
                if (this.credentials.size >= 16) {
                    throw new ServiceClientFault('InvalidData');
                }
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
            const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, credential.privateKey, utf8(DEVICE_DOMAIN + canonicalJson(challenge)));
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
    async verify() {
        return this.authenticateExisting('/api/v1/auth/verify');
    }
    async refresh() {
        return this.authenticateExisting('/api/v1/auth/refresh');
    }
    async logout() {
        if (this.loggingOut) {
            return rejected('Conflict');
        }
        this.loggingOut = true;
        const prior = this.context || (this.refreshBinding && this.refreshBinding.context);
        const priorCsrf = this.csrfToken || (this.refreshBinding && this.refreshBinding.csrf);
        this.contextGeneration += 1;
        this.context = null;
        this.csrfToken = null;
        this.refreshBinding = null;
        this.preparedRequests.clear();
        try {
            if (!prior || !priorCsrf) {
                throw new ServiceClientFault('Unauthenticated');
            }
            try {
                const requestNonce = nonce();
                const receipt = await this.call('/api/v1/auth/logout', { requestNonce }, 'Logout', requestNonce, true, priorCsrf);
                const payload = dataObject(receipt.payload, ['requestNonce', 'sessionId', 'revoked']);
                if (payload.sessionId !== prior.authenticationId || payload.revoked !== true) {
                    throw new ServiceClientFault('InvalidData');
                }
                return Object.freeze({ kind: 'Accepted', value: Object.freeze({ serverRevoked: true }) });
            }
            finally {
                // Remote revocation failure remains a Rejected result; local admission is always cleared.
                this.context = null;
                this.csrfToken = null;
            }
        }
        catch (failure) {
            return rejected(failure instanceof ServiceClientFault ? failure.code : 'AuthorityUnavailable');
        }
        finally {
            this.loggingOut = false;
        }
    }
    async fetchServerTime() {
        const result = await this.readServerTime();
        if (result.kind === 'Rejected') {
            throw new ServiceClientFault(result.fault.code);
        }
        return result.value.payload.serverEpochMs;
    }
    async readServerTime() {
        return this.exclusive(async () => {
            this.requireContext();
            const requestNonce = nonce();
            const receipt = await this.call('/api/v1/time', { requestNonce }, 'ServerTime', requestNonce, true);
            const payload = dataObject(receipt.payload, ['requestNonce', 'serverEpochMs', 'clockGeneration', 'clockStatus']);
            if (payload.clockStatus !== 'Trusted') {
                throw new ServiceClientFault('TimeUntrusted');
            }
            if (integerField(payload.serverEpochMs) !== receipt.issuedAtServerEpochMs) {
                throw new ServiceClientFault('TimeUntrusted');
            }
            integerField(payload.clockGeneration, 1);
            return freezeTree(receipt);
        });
    }
    async readAccountFacts() {
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
            if (payload.revision !== 0) {
                throw new ServiceClientFault('VersionUnsupported');
            }
            const deviceIds = new Set();
            const credential = this.credentials.get(current.accountName);
            let currentFound = false;
            for (const candidate of payload.devices) {
                const device = parseDevice(candidate, false);
                if (deviceIds.has(device.deviceId)) {
                    throw new ServiceClientFault('InvalidData');
                }
                deviceIds.add(device.deviceId);
                if (device.deviceId === current.deviceId) {
                    if (device.status !== 'Active' || device.generation !== current.deviceGeneration
                        || !credential || device.keyFingerprint !== credential.keyFingerprint) {
                        throw new ServiceClientFault('DeviceUntrusted');
                    }
                    currentFound = true;
                }
            }
            if (!currentFound) {
                throw new ServiceClientFault('DeviceUntrusted');
            }
            return freezeTree(receipt);
        });
    }
    currentContext() { return this.context; }
    createRequestNonce() { return nonce(); }
    async request(operation, requestNonce, payload) {
        const generation = this.contextGeneration;
        let controller = null;
        let timer = null;
        try {
            const context = this.requireContext();
            const csrf = this.csrfToken;
            this.codec.validatePayload(operation, payload);
            const requestLimitMs = operation === '/relay/pull'
                ? payload.maximumWaitMs + 7000
                : REQUEST_LIMIT_MS;
            decodeBase64Url(requestNonce, 32);
            const body = await this.prepareRequest(operation, requestNonce, payload, context);
            const limit = sharedBodyLimit(operation);
            if (utf8(body).byteLength > limit) {
                throw new ServiceClientFault('InvalidData');
            }
            const anchor = await this.anchor;
            this.assertCurrent(generation, context);
            controller = new AbortController();
            timer = setTimeout(() => { if (controller) {
                controller.abort();
            } }, requestLimitMs);
            const started = performance.now();
            let response = null;
            // A retry preserves every signed byte and nonce. Authentication, parsing and business
            // failures are never retried. No fallback or new-nonce retry is introduced here.
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    response = await this.transport(this.environment.apiOrigin + '/api/v1/shared' + operation, {
                        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                        credentials: 'include', mode: 'same-origin', cache: 'no-store', redirect: 'error',
                        referrerPolicy: 'no-referrer', signal: controller.signal, body,
                    });
                    break;
                }
                catch (failure) {
                    this.assertCurrent(generation, context);
                    if (controller.signal.aborted || attempt === 2) {
                        throw failure;
                    }
                }
            }
            if (!response || performance.now() - started > requestLimitMs || controller.signal.aborted) {
                throw new ServiceClientFault('AuthorityUnavailable');
            }
            if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) {
                throw new ServiceClientFault('InvalidData');
            }
            const source = await limitedResponseText(response);
            const reply = this.codec.parseReply(operation, source, requestNonce);
            this.assertCurrent(generation, context);
            if (performance.now() - started > requestLimitMs || controller.signal.aborted) {
                throw new ServiceClientFault('AuthorityUnavailable');
            }
            if (reply.kind === 'Rejected') {
                if (response.ok) {
                    throw new ServiceClientFault('InvalidData');
                }
                if (reply.fault.code === 'Unauthenticated') {
                    this.refreshBinding = { context, csrf };
                    this.context = null;
                    this.csrfToken = null;
                    this.contextGeneration += 1;
                }
                return freezeTree(reply);
            }
            if (!response.ok) {
                throw new ServiceClientFault('InvalidData');
            }
            await this.verifySharedReceiptTree(reply.value, anchor);
            this.assertCurrent(generation, context);
            return freezeTree(reply);
        }
        catch (failure) {
            const code = failure instanceof ServiceClientFault ? failure.code : isSchemaFault(failure) ? 'InvalidData' : 'AuthorityUnavailable';
            if (code === 'DeviceUntrusted' || code === 'Forbidden' || code === 'InvalidData' || code === 'VersionUnsupported') {
                this.contextGeneration += 1;
                this.context = null;
                this.csrfToken = null;
                this.refreshBinding = null;
            }
            // This is a local result, never a signed authority rejection or a final event.
            return { kind: 'Rejected', fault: { code, layer: 'Session',
                    detail: code === 'Unauthenticated' ? 'SessionMissing' : code === 'AuthorityUnavailable' ? 'ServiceUnavailable'
                        : code === 'Conflict' ? 'IdempotencyConflict' : 'SchemaInvalid',
                    requestId: nonce(), requestNonce: validRequestNonce(requestNonce), retryAfterMs: null } };
        }
        finally {
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    }
    async prepareRequest(operation, requestNonce, payload, context) {
        const encodedPayload = this.codec.encode(payload);
        const stablePayload = freezeTree(JSON.parse(encodedPayload));
        const payloadSha256 = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(encodedPayload))));
        let prepared = this.preparedRequests.get(requestNonce);
        if (!prepared) {
            prepared = (async () => {
                const readOnly = ['/status', '/world/facts', '/credential/challenge', '/observer/challenge',
                    '/membership/read', '/commit/admission', '/relay/pull'].includes(operation);
                const authorization = readOnly ? null : {
                    authorDeviceId: context.deviceId, authorDeviceGeneration: context.deviceGeneration,
                    deviceSignatureBase64Url: await this.signSharedOperation(operation, requestNonce, stablePayload),
                };
                this.codec.parseRequest(operation, this.codec.encode({ schemaVersion: 1, requestNonce, payload: stablePayload, authorization }));
                return { operation, accountId: context.accountId, deviceId: context.deviceId,
                    generation: context.deviceGeneration, payloadSha256, authorization };
            })();
            this.preparedRequests.set(requestNonce, prepared);
            void prepared.catch(() => undefined);
        }
        const value = await prepared;
        if (value.operation !== operation || value.accountId !== context.accountId || value.deviceId !== context.deviceId
            || value.generation !== context.deviceGeneration || value.payloadSha256 !== payloadSha256) {
            throw new SharedRequestConflict();
        }
        return this.codec.encode({ schemaVersion: 1, requestNonce, payload: stablePayload, authorization: value.authorization });
    }
    async signAdmissionClaim(claim) {
        this.assertAuthor(claim.header);
        return this.signFixed('AdmissionClaim', 'Neurou/commit-admission-claim/v1\0', claim);
    }
    async signEnvelope(envelope) {
        this.assertAuthor(envelope.header);
        return this.signFixed('Envelope', 'Neurou/world-commit/v1\0', envelope);
    }
    async signCredentialProof(proof) {
        this.assertRecipient(proof.recipient);
        return this.signFixed('CredentialProof', 'Neurou/world-member-credential-proof-signature/v1\0', proof);
    }
    async signKeyAcceptance(acceptance) {
        this.assertRecipient(acceptance.recipient);
        return this.signFixed('KeyAcceptance', 'Neurou/world-relay-key-acceptance-signature/v1\0', acceptance);
    }
    async signSharedOperation(operation, requestNonce, payload) {
        const context = this.requireContext();
        this.codec.validatePayload(operation, payload);
        const value = { schemaVersion: 1, serviceInstanceId: this.environment.serviceInstanceId,
            operation, requestNonce, authorDeviceId: context.deviceId, authorDeviceGeneration: context.deviceGeneration, payload };
        return this.signFixed('SharedOperation', 'Neurou/shared-device-operation/v1\0', value);
    }
    async signRelayAck(requestNonce, ack) {
        const context = this.requireContext();
        if (ack.authorDeviceId !== context.deviceId || ack.authorDeviceGeneration !== context.deviceGeneration) {
            throw new ServiceClientFault('DeviceUntrusted');
        }
        return this.signFixed('RelayAck', 'Neurou/relay-ack/v1\0', {
            serviceInstanceId: this.environment.serviceInstanceId, requestNonce, payload: ack,
        });
    }
    assertRecipient(recipient) {
        const context = this.requireContext();
        const credential = this.credentials.get(context.accountName);
        if (!credential || recipient.accountId !== context.accountId || recipient.deviceId !== context.deviceId
            || recipient.deviceGeneration !== context.deviceGeneration
            || recipient.registeredSigningKeyFingerprint !== credential.keyFingerprint) {
            throw new ServiceClientFault('DeviceUntrusted');
        }
    }
    assertAuthor(header) {
        if (header.serviceInstanceId !== this.environment.serviceInstanceId) {
            throw new ServiceClientFault('DeviceUntrusted');
        }
        this.assertRecipient({ accountId: header.identity.authorAccountId, deviceId: header.authorDeviceId,
            deviceGeneration: header.authorDeviceGeneration, registeredSigningKeyFingerprint: header.authorSigningKeyFingerprint });
    }
    async signFixed(kind, domain, value) {
        const generation = this.contextGeneration;
        const context = this.requireContext();
        const credential = this.credentials.get(context.accountName);
        if (!credential || credential.deviceId !== context.deviceId || credential.generation !== context.deviceGeneration) {
            throw new ServiceClientFault('DeviceUntrusted');
        }
        const object = dataObject(value);
        if ('serviceInstanceId' in object && object.serviceInstanceId !== this.environment.serviceInstanceId) {
            throw new ServiceClientFault('DeviceUntrusted');
        }
        this.codec.validateSignatureInput(kind, value);
        const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, credential.privateKey, utf8(domain + this.codec.encode(value)));
        this.assertCurrent(generation, context);
        return base64Url(new Uint8Array(signature));
    }
    assertCurrent(generation, context) {
        if (generation !== this.contextGeneration || this.context !== context || !this.csrfToken) {
            throw new ServiceClientFault('Unauthenticated');
        }
    }
    async verifySharedReceiptTree(value, anchor) {
        if (value === null || typeof value !== 'object') {
            return;
        }
        if (Array.isArray(value)) {
            for (const child of value) {
                await this.verifySharedReceiptTree(child, anchor);
            }
            return;
        }
        const object = dataObject(value);
        if ('signatureBase64Url' in object && 'receiptId' in object && 'purpose' in object) {
            const domain = 'clockStatus' in object ? 'Neurou/shared-authority/v1\0' : 'Neurou/shared-transport/v1\0';
            if (object.serviceInstanceId !== this.environment.serviceInstanceId
                || object.keyId !== this.environment.authorityTrustAnchor.keyId) {
                throw new ServiceClientFault('InvalidData');
            }
            const unsigned = {};
            for (const key of Object.keys(object)) {
                if (key !== 'signatureBase64Url') {
                    unsigned[key] = object[key];
                }
            }
            if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, anchor, decodeBase64Url(object.signatureBase64Url, 64), utf8(domain + this.codec.encode(unsigned)))) {
                throw new ServiceClientFault('InvalidData');
            }
        }
        for (const key of Object.keys(object)) {
            await this.verifySharedReceiptTree(object[key], anchor);
        }
    }
    async authenticateExisting(path) {
        return this.exclusive(async () => {
            const refresh = path === '/api/v1/auth/refresh' ? this.refreshBinding : null;
            const previous = refresh ? refresh.context : this.requireContext();
            const requestNonce = nonce();
            const receipt = await this.call(path, { requestNonce }, 'Authentication', requestNonce, true, refresh ? refresh.csrf : undefined);
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
    acceptAuthentication(auth) {
        this.refreshBinding = null;
        this.csrfToken = auth.csrfToken;
        this.context = Object.freeze({
            accountId: auth.account.accountId, accountName: auth.account.accountName,
            deviceId: auth.device.deviceId, deviceGeneration: auth.device.generation,
            deviceAssurance: 'RegisteredCredential', authenticationId: auth.sessionId,
            expiresAtServerEpochMs: auth.expiresAtServerEpochMs, serviceInstanceId: this.environment.serviceInstanceId,
        });
        return this.context;
    }
    requireContext() {
        if (!this.context || !this.csrfToken) {
            throw new ServiceClientFault('Unauthenticated');
        }
        return this.context;
    }
    async exclusive(operation, revokeOnUnauthenticated = false) {
        if (this.busy || this.loggingOut) {
            return rejected('Conflict');
        }
        this.busy = true;
        const generation = this.contextGeneration;
        try {
            const value = await operation();
            if (generation !== this.contextGeneration) {
                this.context = null;
                this.csrfToken = null;
                throw new ServiceClientFault('Unauthenticated');
            }
            return Object.freeze({ kind: 'Accepted', value });
        }
        catch (failure) {
            const code = failure instanceof ServiceClientFault ? failure.code : 'AuthorityUnavailable';
            // Access expiry denies the current operation. Preserve only the memory binding/CSRF
            // needed for server-validated refresh; this cache has no public admission getter.
            if ((code === 'Unauthenticated' && revokeOnUnauthenticated) || code === 'DeviceUntrusted'
                || code === 'InvalidData' || code === 'VersionUnsupported' || code === 'Forbidden') {
                this.context = null;
                this.csrfToken = null;
                this.refreshBinding = null;
            }
            else if (code === 'Unauthenticated' && this.context && this.csrfToken) {
                this.refreshBinding = { context: this.context, csrf: this.csrfToken };
                this.context = null;
                this.csrfToken = null;
            }
            return rejected(code);
        }
        finally {
            this.busy = false;
        }
    }
    async call(path, body, purpose, requestNonce, authenticated, logoutCsrf) {
        const anchor = await this.anchor;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_LIMIT_MS);
        const started = performance.now();
        try {
            const headers = { Accept: 'application/json' };
            headers['Content-Type'] = 'application/json';
            if (authenticated) {
                if (!logoutCsrf) {
                    this.requireContext();
                }
                headers['X-CSRF-Token'] = logoutCsrf || this.csrfToken;
            }
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
            if (!response.ok) {
                throw parseRejection(raw);
            }
            const receipt = dataObject(raw, ['schemaVersion', 'serviceInstanceId', 'purpose', 'receiptId',
                'keyId', 'issuedAtServerEpochMs', 'payload', 'signatureBase64Url']);
            if (receipt.schemaVersion !== 1) {
                throw new ServiceClientFault('VersionUnsupported');
            }
            if (receipt.serviceInstanceId !== this.environment.serviceInstanceId || receipt.purpose !== purpose
                || receipt.keyId !== this.environment.authorityTrustAnchor.keyId) {
                throw new ServiceClientFault('InvalidData');
            }
            uuidField(receipt.receiptId);
            integerField(receipt.issuedAtServerEpochMs);
            const payload = dataObject(receipt.payload);
            if (payload.requestNonce !== requestNonce) {
                throw new ServiceClientFault('InvalidData');
            }
            const signature = decodeBase64Url(receipt.signatureBase64Url, 64);
            const unsigned = {};
            for (const key of Object.keys(receipt)) {
                if (key !== 'signatureBase64Url') {
                    unsigned[key] = receipt[key];
                }
            }
            if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, anchor, signature, utf8(SERVICE_DOMAIN + canonicalJson(unsigned)))) {
                throw new ServiceClientFault('InvalidData');
            }
            if (performance.now() - started > REQUEST_LIMIT_MS || controller.signal.aborted) {
                throw new ServiceClientFault('AuthorityUnavailable');
            }
            return freezeTree(receipt);
        }
        catch (failure) {
            if (failure instanceof ServiceClientFault) {
                throw failure;
            }
            throw new ServiceClientFault('AuthorityUnavailable');
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.RealSharedServiceSessionAdapter = RealSharedServiceSessionAdapter;
function rejected(code) {
    return Object.freeze({ kind: 'Rejected',
        fault: Object.freeze({ code, requestId: nonce(), retryAfterMs: null }) });
}
function sharedBodyLimit(operation) {
    switch (operation) {
        case '/world/register':
        case '/credential/challenge':
        case '/credential/register':
        case '/append/permit': return 32768;
        case '/commit/admit':
        case '/relay/ack': return 65536;
        case '/membership/publish':
        case '/relay/submit': return 524288;
        default: return 16384;
    }
}
function isSchemaFault(failure) {
    if (!failure || typeof failure !== 'object' || !('code' in failure)) {
        return false;
    }
    const code = failure.code;
    return ['CanonicalInvalid', 'SchemaInvalid', 'ValueInvalid', 'InvariantInvalid', 'LimitExceeded'].includes(code);
}
function validRequestNonce(value) {
    try {
        decodeBase64Url(value, 32);
        return value;
    }
    catch {
        return null;
    }
}
function parseEnvironment(raw) {
    const value = dataObject(raw, ['mode', 'serviceInstanceId', 'apiOrigin', 'authorityTrustAnchor']);
    if (value.mode !== 'ExternalService') {
        throw new ServiceClientFault('InvalidData');
    }
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
    return freezeTree(strictJson(canonicalJson(value)));
}
function isLoopbackHttp(origin) {
    try {
        const url = new URL(origin);
        return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === '[::1]')
            && url.origin === origin;
    }
    catch {
        return false;
    }
}
async function importAuthorityKey(environment) {
    const jwk = environment.authorityTrustAnchor.publicKeyJwk;
    if (await keyFingerprint(jwk) !== environment.authorityTrustAnchor.jwkSha256) {
        throw new ServiceClientFault('InvalidData');
    }
    try {
        return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    }
    catch {
        throw new ServiceClientFault('InvalidData');
    }
}
async function createCredential() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const jwk = Object.freeze({ kty: 'EC', crv: 'P-256',
        x: textField(exported.x, 43), y: textField(exported.y, 43) });
    parsePublicKey(jwk);
    return { privateKey: pair.privateKey, publicKeyJwk: jwk, keyFingerprint: await keyFingerprint(jwk),
        deviceId: null, generation: null };
}
async function keyFingerprint(jwk) {
    return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(canonicalJson(jwk)))));
}
function parsePublicKey(raw) {
    const key = dataObject(raw, ['kty', 'crv', 'x', 'y']);
    if (key.kty !== 'EC' || key.crv !== 'P-256') {
        throw new ServiceClientFault('InvalidData');
    }
    decodeBase64Url(key.x, 32);
    decodeBase64Url(key.y, 32);
    return key;
}
function parseChallenge(raw) {
    const payload = dataObject(raw, ['schemaVersion', 'purpose', 'challengeId', 'nonceBase64Url',
        'accountName', 'keyFingerprint', 'deviceId', 'deviceGeneration', 'expiresAtServerEpochMs',
        'serviceInstanceId', 'requestNonce']);
    if (payload.schemaVersion !== 1 || (payload.purpose !== 'LoginDevice' && payload.purpose !== 'RegisterDevice')) {
        throw new ServiceClientFault('InvalidData');
    }
    uuidField(payload.challengeId);
    accountNameField(payload.accountName);
    textField(payload.serviceInstanceId, 256);
    decodeBase64Url(payload.nonceBase64Url, 32);
    decodeBase64Url(payload.keyFingerprint, 32);
    decodeBase64Url(payload.requestNonce, 32);
    integerField(payload.expiresAtServerEpochMs);
    if ((payload.deviceId === null) !== (payload.deviceGeneration === null)) {
        throw new ServiceClientFault('InvalidData');
    }
    if (payload.deviceId !== null) {
        uuidField(payload.deviceId);
        integerField(payload.deviceGeneration, 1);
    }
    return payload;
}
function parseAccount(raw) {
    const account = dataObject(raw, ['accountId', 'accountName']);
    uuidField(account.accountId);
    accountNameField(account.accountName);
    return account;
}
function parseDevice(raw, activeOnly) {
    const device = dataObject(raw, ['deviceId', 'generation', 'keyFingerprint', 'assurance', 'label', 'status']);
    uuidField(device.deviceId);
    integerField(device.generation, 1);
    decodeBase64Url(device.keyFingerprint, 32);
    textField(device.label, 128);
    if (device.assurance !== 'RegisteredCredential' || (device.status !== 'Active' && device.status !== 'Revoked')
        || (activeOnly && device.status !== 'Active')) {
        throw new ServiceClientFault('DeviceUntrusted');
    }
    return device;
}
function parseAuthentication(raw, issuedAt) {
    const auth = dataObject(raw, ['requestNonce', 'sessionId', 'csrfToken', 'account', 'device', 'expiresAtServerEpochMs']);
    decodeBase64Url(auth.requestNonce, 32);
    decodeBase64Url(auth.csrfToken, 32);
    uuidField(auth.sessionId);
    parseAccount(auth.account);
    parseDevice(auth.device, true);
    if (integerField(auth.expiresAtServerEpochMs) <= issuedAt) {
        throw new ServiceClientFault('Unauthenticated');
    }
    return auth;
}
function parseRejection(raw) {
    const result = dataObject(raw, ['kind', 'fault']);
    if (result.kind !== 'Rejected') {
        throw new ServiceClientFault('InvalidData');
    }
    const fault = dataObject(result.fault, ['code', 'requestId', 'retryAfterMs']);
    textField(fault.requestId, 256);
    if (fault.retryAfterMs !== null) {
        integerField(fault.retryAfterMs);
    }
    const codes = ['Unauthenticated', 'DeviceUntrusted', 'AuthorityUnavailable', 'TimeUntrusted',
        'VersionUnsupported', 'Conflict', 'RateLimited', 'InvalidData', 'Forbidden'];
    if (!codes.includes(fault.code)) {
        throw new ServiceClientFault('InvalidData');
    }
    return new ServiceClientFault(fault.code);
}
function dataObject(raw, fields) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
        || (Object.getPrototypeOf(raw) !== null && Object.getPrototypeOf(raw) !== Object.prototype)
        || Object.getOwnPropertySymbols(raw).length !== 0) {
        throw new ServiceClientFault('InvalidData');
    }
    const keys = Object.keys(raw);
    if (Object.getOwnPropertyNames(raw).length !== keys.length
        || (fields && (keys.length !== fields.length || keys.some(key => !fields.includes(key))))) {
        throw new ServiceClientFault('InvalidData');
    }
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(raw, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new ServiceClientFault('InvalidData');
        }
    }
    return raw;
}
function textField(raw, maximum) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > maximum || /[\u0000-\u001f\u007f]/.test(raw)) {
        throw new ServiceClientFault('InvalidData');
    }
    for (let index = 0; index < raw.length; index += 1) {
        const unit = raw.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = raw.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff)) {
                throw new ServiceClientFault('InvalidData');
            }
        }
        else if (unit >= 0xdc00 && unit <= 0xdfff) {
            throw new ServiceClientFault('InvalidData');
        }
    }
    return raw;
}
function integerField(raw, minimum = 0) {
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < minimum || Object.is(raw, -0)) {
        throw new ServiceClientFault('InvalidData');
    }
    return raw;
}
function uuidField(raw) {
    const value = textField(raw, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
        throw new ServiceClientFault('InvalidData');
    }
    return value;
}
function accountNameField(raw) {
    const value = textField(raw, 64);
    if (!/^[A-Za-z0-9_.-]{3,64}$/.test(value)) {
        throw new ServiceClientFault('InvalidData');
    }
    return value;
}
function nonce() { return base64Url(crypto.getRandomValues(new Uint8Array(32))); }
function utf8(text) { return new TextEncoder().encode(text); }
function base64Url(bytes) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeBase64Url(raw, length) {
    if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]+$/.test(raw) || raw.length !== Math.ceil(length * 8 / 6)) {
        throw new ServiceClientFault('InvalidData');
    }
    let binary;
    try {
        binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4));
    }
    catch {
        throw new ServiceClientFault('InvalidData');
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    if (bytes.length !== length || base64Url(bytes) !== raw) {
        throw new ServiceClientFault('InvalidData');
    }
    return bytes;
}
/** JCS subset used by this wire: objects/arrays, scalar strings, booleans and safe integers. */
function canonicalJson(raw) {
    if (raw === null) {
        return 'null';
    }
    if (typeof raw === 'string') {
        if (raw.length) {
            textField(raw, 1048576);
        }
        return JSON.stringify(raw);
    }
    if (typeof raw === 'boolean') {
        return raw ? 'true' : 'false';
    }
    if (typeof raw === 'number') {
        return String(integerField(raw));
    }
    if (Array.isArray(raw)) {
        return '[' + raw.map(canonicalJson).join(',') + ']';
    }
    const object = dataObject(raw);
    return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
}
function freezeTree(raw) {
    if (raw && typeof raw === 'object') {
        for (const value of Object.values(raw)) {
            freezeTree(value);
        }
        Object.freeze(raw);
    }
    return raw;
}
async function limitedResponseText(response) {
    if (!response.body) {
        throw new ServiceClientFault('InvalidData');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0;
    let content = '';
    try {
        for (;;) {
            const part = await reader.read();
            if (part.done) {
                break;
            }
            size += part.value.byteLength;
            if (size > 1048576) {
                await reader.cancel();
                throw new ServiceClientFault('InvalidData');
            }
            content += decoder.decode(part.value, { stream: true });
        }
        return content + decoder.decode();
    }
    finally {
        reader.releaseLock();
    }
}
/** Reject duplicate JSON keys before JSON.parse can overwrite one. No reviver or executable values. */
function strictJson(source) {
    let offset = 0;
    const whitespace = () => { while (/[\x20\x09\x0a\x0d]/.test(source.charAt(offset)) && offset < source.length) {
        offset += 1;
    } };
    const fail = () => { throw new ServiceClientFault('InvalidData'); };
    const parseString = () => {
        const start = offset++;
        while (offset < source.length) {
            const character = source.charAt(offset++);
            if (character === '\\') {
                offset += 1;
            }
            else if (character === '"') {
                try {
                    const value = JSON.parse(source.slice(start, offset));
                    if (typeof value !== 'string') {
                        return fail();
                    }
                    if (value.length) {
                        textField(value, 1048576);
                    }
                    return value;
                }
                catch {
                    return fail();
                }
            }
        }
        return fail();
    };
    const parse = (depth) => {
        if (depth > 32) {
            return fail();
        }
        whitespace();
        const character = source.charAt(offset);
        if (character === '"') {
            return parseString();
        }
        if (character === '{') {
            offset += 1;
            whitespace();
            const object = Object.create(null);
            const names = new Set();
            if (source.charAt(offset) === '}') {
                offset += 1;
                return object;
            }
            for (;;) {
                if (source.charAt(offset) !== '"') {
                    return fail();
                }
                const name = parseString();
                if (names.has(name)) {
                    return fail();
                }
                names.add(name);
                whitespace();
                if (source.charAt(offset++) !== ':') {
                    return fail();
                }
                object[name] = parse(depth + 1);
                whitespace();
                const delimiter = source.charAt(offset++);
                if (delimiter === '}') {
                    return object;
                }
                if (delimiter !== ',') {
                    return fail();
                }
                whitespace();
            }
        }
        if (character === '[') {
            offset += 1;
            whitespace();
            const values = [];
            if (source.charAt(offset) === ']') {
                offset += 1;
                return values;
            }
            for (;;) {
                if (values.length >= 256) {
                    return fail();
                }
                values.push(parse(depth + 1));
                whitespace();
                const delimiter = source.charAt(offset++);
                if (delimiter === ']') {
                    return values;
                }
                if (delimiter !== ',') {
                    return fail();
                }
            }
        }
        for (const literal of ['true', 'false', 'null']) {
            if (source.slice(offset, offset + literal.length) === literal) {
                offset += literal.length;
                return literal === 'null' ? null : literal === 'true';
            }
        }
        const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(offset));
        if (!match) {
            return fail();
        }
        offset += match[0].length;
        return integerField(Number(match[0]));
    };
    const result = parse(0);
    whitespace();
    if (offset !== source.length) {
        return fail();
    }
    return result;
}
