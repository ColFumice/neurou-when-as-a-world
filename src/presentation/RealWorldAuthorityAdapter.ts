import type {
  AuthenticatedServiceContext, RealAccountFacts, RealAuthServicePort, RealWorldAuthorityProtocolPort,
  ServiceReply, SignedServiceReceipt, SharedServiceSessionPort, SharedProtocolCodecPort,
  SharedProtocolOperation, SharedProtocolPayloadMap, SharedProtocolReply,
} from '../director/IntentPort';

/** HTTP authority only. The injected real session owns cookies, CSRF and registered keys. */
export class RealWorldAuthorityAdapter implements RealWorldAuthorityProtocolPort {
  readonly mode = 'ExternalService' as const;

  constructor(private readonly session: SharedServiceSessionPort,
    private readonly auth: Pick<RealAuthServicePort, 'readAccountFacts'>,
    private readonly codec: SharedProtocolCodecPort) {}

  get context(): AuthenticatedServiceContext {
    const value = this.session.currentContext();
    if (!value) { throw Error('Unauthenticated'); }
    return value;
  }

  readAccountFacts(): Promise<ServiceReply<SignedServiceReceipt<RealAccountFacts>>> {
    return this.auth.readAccountFacts();
  }

  readServiceStatus(requestNonce?: string): Promise<SharedProtocolReply<'/status'>> {
    return this.invoke('/status', {}, requestNonce);
  }
  registerWorld(payload: SharedProtocolPayloadMap['/world/register'], requestNonce?: string): Promise<SharedProtocolReply<'/world/register'>> {
    return this.invoke('/world/register', payload, requestNonce);
  }
  readWorldFacts(payload: SharedProtocolPayloadMap['/world/facts'], requestNonce?: string): Promise<SharedProtocolReply<'/world/facts'>> {
    return this.invoke('/world/facts', payload, requestNonce);
  }
  requestCredentialChallenge(payload: SharedProtocolPayloadMap['/credential/challenge'], requestNonce?: string): Promise<SharedProtocolReply<'/credential/challenge'>> {
    return this.invoke('/credential/challenge', payload, requestNonce);
  }
  registerAgreementCredential(payload: SharedProtocolPayloadMap['/credential/register'], requestNonce?: string): Promise<SharedProtocolReply<'/credential/register'>> {
    return this.invoke('/credential/register', payload, requestNonce);
  }
  setAccessCode(payload: SharedProtocolPayloadMap['/access-code/set'], requestNonce?: string): Promise<SharedProtocolReply<'/access-code/set'>> {
    return this.invoke('/access-code/set', payload, requestNonce);
  }
  requestObserverChallenge(payload: SharedProtocolPayloadMap['/observer/challenge'], requestNonce?: string): Promise<SharedProtocolReply<'/observer/challenge'>> {
    return this.invoke('/observer/challenge', payload, requestNonce);
  }
  redeemObserverChallenge(payload: SharedProtocolPayloadMap['/observer/redeem'], requestNonce?: string): Promise<SharedProtocolReply<'/observer/redeem'>> {
    return this.invoke('/observer/redeem', payload, requestNonce);
  }
  publishMembershipEpoch(payload: SharedProtocolPayloadMap['/membership/publish'], requestNonce?: string): Promise<SharedProtocolReply<'/membership/publish'>> {
    return this.invoke('/membership/publish', payload, requestNonce);
  }
  readMembershipEpoch(payload: SharedProtocolPayloadMap['/membership/read'], requestNonce?: string): Promise<SharedProtocolReply<'/membership/read'>> {
    return this.invoke('/membership/read', payload, requestNonce);
  }
  allocateSegment(payload: SharedProtocolPayloadMap['/sequence/allocate'], requestNonce?: string): Promise<SharedProtocolReply<'/sequence/allocate'>> {
    return this.invoke('/sequence/allocate', payload, requestNonce);
  }
  issueAppendPermit(payload: SharedProtocolPayloadMap['/append/permit'], requestNonce?: string): Promise<SharedProtocolReply<'/append/permit'>> {
    return this.invoke('/append/permit', payload, requestNonce);
  }
  admitCommit(payload: SharedProtocolPayloadMap['/commit/admit'], requestNonce?: string): Promise<SharedProtocolReply<'/commit/admit'>> {
    return this.invoke('/commit/admit', payload, requestNonce);
  }
  readAdmission(payload: SharedProtocolPayloadMap['/commit/admission'], requestNonce?: string): Promise<SharedProtocolReply<'/commit/admission'>> {
    return this.invoke('/commit/admission', payload, requestNonce);
  }
  sealPrefix(payload: SharedProtocolPayloadMap['/settlement/seal'], requestNonce?: string): Promise<SharedProtocolReply<'/settlement/seal'>> {
    return this.invoke('/settlement/seal', payload, requestNonce);
  }

  private async invoke<O extends SharedProtocolOperation>(operation: O,
    payload: SharedProtocolPayloadMap[O], requestNonce?: string): Promise<SharedProtocolReply<O>> {
    let nonce = requestNonce || this.session.createRequestNonce();
    try {
      this.codec.validatePayload(operation, payload);
      // These frozen payloads carry the current request nonce in their signed input.
      // A default call uses that nonce; an explicit conflicting nonce is rejected by codec.
      if (requestNonce === undefined) {
        if (operation === '/access-code/set') { nonce = (payload as SharedProtocolPayloadMap['/access-code/set']).proposal.requestNonce; }
        else if (operation === '/credential/register') { nonce = (payload as SharedProtocolPayloadMap['/credential/register']).proof.requestNonce; }
        else if (operation === '/membership/publish') { nonce = (payload as SharedProtocolPayloadMap['/membership/publish']).change.requestNonce; }
        else if (operation === '/commit/admit') { nonce = (payload as SharedProtocolPayloadMap['/commit/admit']).admissionClaim.claim.requestNonce; }
      }
      if (!this.session.currentContext()) {
        return { kind: 'Rejected', fault: { code: 'Unauthenticated', detail: 'SessionMissing', layer: 'Session',
          requestId: this.session.createRequestNonce(), requestNonce: nonce, retryAfterMs: null } };
      }
      const reply: unknown = await this.session.request(operation, nonce, payload);
      return this.codec.parseReply(operation, this.codec.encode(reply), nonce) as SharedProtocolReply<O>;
    } catch {
      // Invalid unknown input/output is never exposed as a verified fact.
      return { kind: 'Rejected', fault: { code: 'InvalidData', detail: 'SchemaInvalid', layer: 'Authority',
        requestId: this.session.createRequestNonce(), requestNonce: null, retryAfterMs: null } };
    }
  }
}
