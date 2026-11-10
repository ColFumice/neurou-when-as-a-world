"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealWorldAuthorityAdapter = void 0;
/** HTTP authority only. The injected real session owns cookies, CSRF and registered keys. */
class RealWorldAuthorityAdapter {
    constructor(session, auth, codec) {
        this.session = session;
        this.auth = auth;
        this.codec = codec;
        this.mode = 'ExternalService';
    }
    get context() {
        const value = this.session.currentContext();
        if (!value) {
            throw Error('Unauthenticated');
        }
        return value;
    }
    readAccountFacts() {
        return this.auth.readAccountFacts();
    }
    readServiceStatus(requestNonce) {
        return this.invoke('/status', {}, requestNonce);
    }
    registerWorld(payload, requestNonce) {
        return this.invoke('/world/register', payload, requestNonce);
    }
    readWorldFacts(payload, requestNonce) {
        return this.invoke('/world/facts', payload, requestNonce);
    }
    requestCredentialChallenge(payload, requestNonce) {
        return this.invoke('/credential/challenge', payload, requestNonce);
    }
    registerAgreementCredential(payload, requestNonce) {
        return this.invoke('/credential/register', payload, requestNonce);
    }
    setAccessCode(payload, requestNonce) {
        return this.invoke('/access-code/set', payload, requestNonce);
    }
    requestObserverChallenge(payload, requestNonce) {
        return this.invoke('/observer/challenge', payload, requestNonce);
    }
    redeemObserverChallenge(payload, requestNonce) {
        return this.invoke('/observer/redeem', payload, requestNonce);
    }
    publishMembershipEpoch(payload, requestNonce) {
        return this.invoke('/membership/publish', payload, requestNonce);
    }
    readMembershipEpoch(payload, requestNonce) {
        return this.invoke('/membership/read', payload, requestNonce);
    }
    allocateSegment(payload, requestNonce) {
        return this.invoke('/sequence/allocate', payload, requestNonce);
    }
    issueAppendPermit(payload, requestNonce) {
        return this.invoke('/append/permit', payload, requestNonce);
    }
    admitCommit(payload, requestNonce) {
        return this.invoke('/commit/admit', payload, requestNonce);
    }
    readAdmission(payload, requestNonce) {
        return this.invoke('/commit/admission', payload, requestNonce);
    }
    sealPrefix(payload, requestNonce) {
        return this.invoke('/settlement/seal', payload, requestNonce);
    }
    async invoke(operation, payload, requestNonce) {
        let nonce = requestNonce || this.session.createRequestNonce();
        try {
            this.codec.validatePayload(operation, payload);
            // These frozen payloads carry the current request nonce in their signed input.
            // A default call uses that nonce; an explicit conflicting nonce is rejected by codec.
            if (requestNonce === undefined) {
                if (operation === '/access-code/set') {
                    nonce = payload.proposal.requestNonce;
                }
                else if (operation === '/credential/register') {
                    nonce = payload.proof.requestNonce;
                }
                else if (operation === '/membership/publish') {
                    nonce = payload.change.requestNonce;
                }
                else if (operation === '/commit/admit') {
                    nonce = payload.admissionClaim.claim.requestNonce;
                }
            }
            if (!this.session.currentContext()) {
                return { kind: 'Rejected', fault: { code: 'Unauthenticated', detail: 'SessionMissing', layer: 'Session',
                        requestId: this.session.createRequestNonce(), requestNonce: nonce, retryAfterMs: null } };
            }
            const reply = await this.session.request(operation, nonce, payload);
            return this.codec.parseReply(operation, this.codec.encode(reply), nonce);
        }
        catch {
            // Invalid unknown input/output is never exposed as a verified fact.
            return { kind: 'Rejected', fault: { code: 'InvalidData', detail: 'SchemaInvalid', layer: 'Authority',
                    requestId: this.session.createRequestNonce(), requestNonce: null, retryAfterMs: null } };
        }
    }
}
exports.RealWorldAuthorityAdapter = RealWorldAuthorityAdapter;
