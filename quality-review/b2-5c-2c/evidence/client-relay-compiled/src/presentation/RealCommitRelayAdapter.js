"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealCommitRelayAdapter = void 0;
class RelayClientFault extends Error {
    constructor(code, detail) {
        super(detail);
        this.code = code;
        this.detail = detail;
    }
}
/** Independent HTTP Relay. Full validation and durable ciphertext storage are installed capabilities. */
class RealCommitRelayAdapter {
    constructor(session, signer, codec, validator, cache) {
        this.session = session;
        this.signer = signer;
        this.codec = codec;
        this.validator = validator;
        this.cache = cache;
        this.mode = 'ExternalService';
    }
    relay(commit) {
        return this.submit(commit);
    }
    async submit(commit) {
        const requestNonce = this.session.createRequestNonce();
        try {
            const stable = this.copy(commit);
            this.codec.validatePayload('/relay/submit', { commit: stable });
            const reply = await this.invoke('/relay/submit', { commit: stable }, requestNonce);
            if (reply.kind === 'Accepted') {
                const fact = reply.value.payload;
                const claim = stable.admissionClaim.claim;
                const admission = stable.admissionReceipt.payload;
                if (fact.worldId !== claim.header.worldId || !this.same(fact.identity, claim.header.identity)
                    || fact.envelopeSha256 !== claim.envelopeSha256
                    || fact.admittedAtServerEpochMs !== admission.admittedAtServerEpochMs
                    || fact.retainedUntilServerEpochMs - fact.admittedAtServerEpochMs < 86400000
                    || fact.cursor.position === '0') {
                    throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                }
            }
            return reply;
        }
        catch (error) {
            return this.failure(error, requestNonce);
        }
    }
    async pull(worldId, after, maximumCount = 128, maximumWaitMs = 25000) {
        const requestNonce = this.session.createRequestNonce();
        try {
            const payload = this.copy({ worldId, after, maximumCount, maximumWaitMs });
            this.codec.validatePayload('/relay/pull', payload);
            const reply = await this.invoke('/relay/pull', payload, requestNonce);
            if (reply.kind === 'Accepted') {
                const batch = reply.value.payload;
                if (batch.worldId !== worldId || !this.same(batch.after, payload.after)) {
                    throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                }
                if (batch.kind === 'Batch') {
                    if (batch.next.relayGeneration !== payload.after.relayGeneration
                        || batch.retentionFloor.relayGeneration !== payload.after.relayGeneration
                        || batch.commits.length > maximumCount
                        || batch.next.position !== advancePosition(payload.after.position, batch.commits.length)
                        || comparePosition(batch.retentionFloor.position, payload.after.position) > 0
                        || (batch.commits.length === 0 && batch.next.position !== payload.after.position)
                        || batch.commits.some(commit => commit.admissionClaim.claim.header.worldId !== worldId)) {
                        throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                    }
                }
                // A signed empty batch is not an assertion of global completeness, and Gap never advances a cursor.
            }
            return reply;
        }
        catch (error) {
            return this.failure(error, requestNonce);
        }
    }
    async acknowledge(request) {
        // The adapter owns this nonce and signature. A caller's precomputed signature is never forwarded.
        const requestNonce = this.session.createRequestNonce();
        try {
            const stable = this.copy(request);
            this.codec.validatePayload('/relay/ack', stable);
            const context = this.requireContext();
            if (stable.authorDeviceId !== context.deviceId
                || stable.authorDeviceGeneration !== context.deviceGeneration) {
                throw new RelayClientFault('DeviceUntrusted', 'CredentialMismatch');
            }
            for (const entry of stable.entries) {
                const source = await this.cache.read(entry.identity);
                this.assertCurrent(context);
                if (source === null) {
                    throw new RelayClientFault('AuthorityUnavailable', 'FactUnavailable');
                }
                const candidate = this.copy(source);
                this.codec.validatePayload('/relay/submit', { commit: candidate });
                if (candidate.admissionClaim.claim.header.worldId !== stable.worldId
                    || !this.same(candidate.admissionClaim.claim.header.identity, entry.identity)
                    || candidate.admissionClaim.claim.envelopeSha256 !== entry.envelopeSha256) {
                    throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                }
                const validated = await this.validator.validateCommit(candidate);
                this.assertCurrent(context);
                if (validated.kind === 'Gap') {
                    throw new RelayClientFault('AuthorityUnavailable', 'FactUnavailable');
                }
                if (validated.kind === 'HostFailure') {
                    throw new RelayClientFault('AuthorityUnavailable', 'RelayUnavailable');
                }
                if (!this.validator.ownsCommit(validated.value)
                    || !this.same(validated.value.wire, candidate)
                    || !this.same(validated.value.identity, entry.identity)
                    || validated.value.envelopeBytesBase64Url !== candidate.envelopeBytesBase64Url
                    || validated.value.envelopeSha256 !== entry.envelopeSha256
                    || await envelopeDigest(candidate.envelopeBytesBase64Url) !== entry.envelopeSha256) {
                    throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                }
                const confirmation = await this.cache.persistAndVerify(candidate);
                this.assertCurrent(context);
                const readBack = await this.cache.read(entry.identity);
                this.assertCurrent(context);
                if (!confirmation || confirmation.envelopeSha256 !== entry.envelopeSha256 || readBack === null
                    || !this.same(readBack, candidate)
                    || readBack.envelopeBytesBase64Url !== candidate.envelopeBytesBase64Url
                    || await envelopeDigest(readBack.envelopeBytesBase64Url) !== entry.envelopeSha256) {
                    throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                }
                // Verified bad-body InvalidChange may ACK the preserved wire; its state application is a separate concern.
            }
            this.assertCurrent(context);
            const unsignedAck = { worldId: stable.worldId, relayGeneration: stable.relayGeneration,
                entries: stable.entries, authorDeviceId: context.deviceId, authorDeviceGeneration: context.deviceGeneration };
            const deviceSignatureBase64Url = await this.signer.signRelayAck(requestNonce, unsignedAck);
            this.assertCurrent(context);
            const payload = { ...unsignedAck, deviceSignatureBase64Url };
            this.codec.validatePayload('/relay/ack', payload);
            const reply = await this.invoke('/relay/ack', payload, requestNonce);
            if (reply.kind === 'Accepted') {
                const fact = reply.value.payload;
                const entriesSha256 = await textDigest(this.codec.encode(unsignedAck.entries));
                this.assertCurrent(context);
                if (fact.worldId !== stable.worldId || fact.relayGeneration !== stable.relayGeneration
                    || fact.accountId !== context.accountId || fact.deviceId !== context.deviceId
                    || fact.deviceGeneration !== context.deviceGeneration
                    || fact.entriesSha256 !== entriesSha256 || fact.acknowledgedCount !== stable.entries.length) {
                    throw new RelayClientFault('InvalidData', 'SchemaInvalid');
                }
            }
            return reply;
        }
        catch (error) {
            return this.failure(error, requestNonce);
        }
    }
    async invoke(operation, payload, requestNonce) {
        this.requireContext();
        const reply = await this.session.request(operation, requestNonce, payload);
        const parsed = this.codec.parseReply(operation, this.codec.encode(reply), requestNonce);
        if (parsed.kind === 'Rejected' && parsed.fault.layer === 'Session'
            && parsed.fault.code === 'AuthorityUnavailable' && parsed.fault.detail === 'ServiceUnavailable') {
            return { kind: 'Rejected', fault: { ...parsed.fault, layer: 'Relay', detail: 'RelayUnavailable' } };
        }
        return parsed;
    }
    requireContext() {
        const value = this.session.currentContext();
        if (!value) {
            throw new RelayClientFault('Unauthenticated', 'SessionMissing');
        }
        return value;
    }
    assertCurrent(context) {
        const current = this.requireContext();
        if (current.accountId !== context.accountId || current.deviceId !== context.deviceId
            || current.deviceGeneration !== context.deviceGeneration || current.authenticationId !== context.authenticationId) {
            throw new RelayClientFault('Unauthenticated', 'AuthenticationMismatch');
        }
    }
    same(first, second) {
        return this.codec.encode(first) === this.codec.encode(second);
    }
    copy(value) { return JSON.parse(this.codec.encode(value)); }
    failure(error, requestNonce) {
        const schemaFailure = typeof error === 'object' && error !== null && 'code' in error
            && ['SchemaInvalid', 'CanonicalInvalid', 'LimitExceeded'].includes(String(error.code));
        const code = error instanceof RelayClientFault ? error.code : schemaFailure ? 'InvalidData' : 'AuthorityUnavailable';
        const detail = error instanceof RelayClientFault ? error.detail : schemaFailure ? 'SchemaInvalid' : 'RelayUnavailable';
        // A local capability/transport failure is not a signed server fact and does not imply Auth/authority failure.
        return { kind: 'Rejected', fault: { code, detail, layer: 'Relay', requestId: this.session.createRequestNonce(),
                requestNonce, retryAfterMs: null } };
    }
}
exports.RealCommitRelayAdapter = RealCommitRelayAdapter;
function comparePosition(first, second) {
    if (first.length !== second.length) {
        return first.length < second.length ? -1 : 1;
    }
    return first === second ? 0 : first < second ? -1 : 1;
}
function advancePosition(position, count) {
    const digits = position.split('');
    let carry = count;
    for (let index = digits.length - 1; index >= 0 && carry !== 0; index -= 1) {
        const value = Number(digits[index]) + carry;
        digits[index] = String(value % 10);
        carry = Math.floor(value / 10);
    }
    return (carry === 0 ? '' : String(carry)) + digits.join('');
}
async function envelopeDigest(value) {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return hexDigest(bytes);
}
async function textDigest(value) {
    return hexDigest(new TextEncoder().encode(value));
}
async function hexDigest(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    let result = '';
    for (const byte of digest) {
        result += byte.toString(16).padStart(2, '0');
    }
    return result;
}
