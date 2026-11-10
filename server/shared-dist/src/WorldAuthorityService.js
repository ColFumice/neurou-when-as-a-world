import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { SharedCommitCodec } from '../.shared-kernel/SharedCommitCodec.js';
import { SharedServiceProtocolCodec } from '../.shared-kernel/SharedServiceProtocolCodec.js';
import { randomToken, sha256, keyFingerprint, validatePublicKey } from './crypto.js';
import { sharedCanonical, sharedUnsigned, verifySharedSignature } from './SharedReceiptSigner.js';
import { SharedSessionVerifier, SharedServiceFailure } from './SharedSessionVerifier.js';
import { WorldAuthorityStorage } from './WorldAuthorityStorage.js';
import { makeCredentialChallenge } from './SharedCryptoProof.js';
const policy = { schemaVersion: 1, offlineGraceMs: 3600000, boundedRelayDelayMs: 300000, timeUncertaintyAllowanceMs: 60000, settleHorizonMs: 3960000, retentionMs: 86400000 };
const policySha256 = sha256(sharedCanonical(policy));
const readOperations = new Set(['/status', '/world/facts', '/credential/challenge', '/observer/challenge', '/membership/read', '/commit/admission']);
function fail(detail, status = 409, code = 'Conflict') { throw new SharedServiceFailure(detail, status, code); }
function identical(a, b) { return sharedCanonical(a) === sharedCanonical(b); }
function requiredTime(sample) { if (!sample.trusted || sample.epochMs === null)
    fail('ClockUntrusted', 503, 'TimeUntrusted'); return sample.epochMs; }
function increment(value) { const result = Number(value) + 1; if (!Number.isSafeInteger(result))
    fail('ResourceLimit', 413, 'InvalidData'); return result; }
function requireInstance(value, instance, world) { if (value.serviceInstanceId !== instance || value.worldId !== world)
    fail('AuthenticationMismatch', 401, 'Unauthenticated'); }
export class WorldAuthorityService {
    config;
    storage;
    signer;
    clock;
    codec = new SharedCommitCodec();
    verifier = new SharedSessionVerifier();
    rate = new Map();
    constructor(config, storage, signer, clock) {
        this.config = config;
        this.storage = storage;
        this.signer = signer;
        this.clock = clock;
    }
    async handle(operation, input, raw, request) {
        try {
            return await this.storage.transaction(async (client) => {
                const targets = operation === '/membership/publish' ? input.payload.change.next.credentials.map(credential => ({ accountId: credential.accountId, deviceId: credential.deviceId })) : [];
                const session = await this.verifier.verify(request, client, Date.now(), targets);
                const sample = await this.clock.sample(client);
                const worldId = typeof input.payload.worldId === 'string' ? input.payload.worldId : input.payload.proposal?.worldId ?? input.payload.change?.worldId ?? input.payload.admissionClaim?.claim?.header?.worldId ?? input.payload.proof?.worldId ?? input.payload.challengeReceipt?.payload?.worldId ?? null;
                const requestSha = sha256(raw);
                const previous = (await client.query('SELECT * FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [this.signer.serviceInstanceId, session.accountId, input.requestNonce])).rows[0];
                if (previous) {
                    if (previous.operation !== operation || previous.world_id !== worldId || previous.device_id !== session.deviceId || Number(previous.device_generation) !== session.deviceGeneration || previous.request_sha256 !== requestSha)
                        fail('IdempotencyConflict');
                    if (previous.result_wire === null)
                        fail('IdempotencyExpired');
                    return { wire: previous.result_wire.toString('utf8'), status: previous.result_kind === 'Accepted' ? 200 : this.statusFromStored(previous.result_wire) };
                }
                this.limit(session, operation, worldId);
                this.checkAuthorization(operation, input, session);
                await client.query('SAVEPOINT shared_business');
                let result;
                let status = 200;
                try {
                    result = { kind: 'Accepted', value: await this.dispatch(client, operation, input, session, sample, request.ip) };
                    const finalSample = await this.clock.sample(client);
                    if (sample.trusted && !finalSample.trusted)
                        fail('ClockUntrusted', 503, 'TimeUntrusted');
                }
                catch (error) {
                    if (!(error instanceof SharedServiceFailure))
                        throw error;
                    if (error.detail === 'ClockUntrusted') {
                        await client.query('ROLLBACK TO SAVEPOINT shared_business');
                        await this.clock.sample(client);
                    }
                    status = error.status;
                    result = { kind: 'Rejected', fault: { code: error.code, layer: error.layer, detail: error.detail, requestId: request.id, requestNonce: input.requestNonce, retryAfterMs: error.retryAfterMs } };
                }
                const wire = SharedServiceProtocolCodec.encode(result);
                if (Buffer.byteLength(wire) > 1048576)
                    fail('ResourceLimit', 413, 'InvalidData');
                SharedServiceProtocolCodec.parseReply(operation, wire, input.requestNonce);
                // Transient clock failures do not consume the business nonce. All terminal business outcomes do.
                if (status !== 503)
                    await client.query('INSERT INTO authority_requests(service_instance_id,account_id,request_nonce,operation,world_id,device_id,device_generation,request_sha256,result_wire,result_kind,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [this.signer.serviceInstanceId, session.accountId, input.requestNonce, operation, worldId, session.deviceId, session.deviceGeneration, requestSha, Buffer.from(wire), result.kind, Date.now()]);
                return { wire, status };
            });
        }
        catch (error) {
            await this.clock.persistLatch(this.storage.pool);
            throw error;
        }
    }
    statusFromStored(bytes) { const detail = WorldAuthorityStorage.value(bytes).fault; const code = String(detail.code); return detail.detail === 'ResourceLimit' ? 413 : code === 'Unauthenticated' ? 401 : code === 'Forbidden' || code === 'DeviceUntrusted' ? 403 : code === 'InvalidData' || code === 'VersionUnsupported' ? 400 : code === 'RateLimited' ? 429 : code === 'Conflict' ? 409 : 503; }
    limit(session, operation, worldId) {
        const kind = operation === '/credential/challenge' ? 'credential' : operation.includes('/membership/') || operation === '/access-code/set' || operation === '/world/register' ? 'admin' : operation === '/observer/challenge' ? 'observer' : 'authority';
        const limit = kind === 'credential' || kind === 'observer' ? 10 : kind === 'admin' ? 30 : 120;
        const key = session.accountId + ':' + (kind === 'observer' ? worldId : session.deviceId) + ':' + kind;
        const now = Date.now(), window = Math.floor(now / 60000) * 60000;
        const previous = this.rate.get(key);
        if (!previous || previous.expires !== window + 60000)
            this.rate.set(key, { count: 1, expires: window + 60000 });
        else if (++previous.count > limit)
            throw new SharedServiceFailure('RateLimitExceeded', 429, 'RateLimited', 'Authority', 60000);
        if (this.rate.size > 4096)
            for (const [k, v] of this.rate)
                if (v.expires <= now)
                    this.rate.delete(k);
    }
    checkAuthorization(operation, input, session) {
        if (readOperations.has(operation)) {
            if (input.authorization !== null)
                fail('SchemaInvalid', 400, 'InvalidData');
            return;
        }
        const auth = input.authorization;
        if (!auth || auth.authorDeviceId !== session.deviceId || auth.authorDeviceGeneration !== session.deviceGeneration)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const unsigned = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, operation, requestNonce: input.requestNonce, authorDeviceId: auth.authorDeviceId, authorDeviceGeneration: auth.authorDeviceGeneration, payload: input.payload };
        if (!verifySharedSignature(session.signingPublicKey, 'Neurou/shared-device-operation/v1\0', unsigned, auth.deviceSignatureBase64Url))
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
    }
    wrap(purpose, nonce, payload) { return this.signer.transport(purpose, nonce, payload); }
    mutation(operation, nonce, receipt) { return this.wrap('AuthorityResult', nonce, { operation, receipt }); }
    root(world, session) { if (world.registration.worldDeveloperAccountId !== session.accountId)
        fail('PermissionDenied', 403, 'Forbidden'); }
    async observer(client, world, account) { return (await client.query('SELECT * FROM authority_observer_facts WHERE world_id=$1 AND account_id=$2', [world, account])).rows[0] ?? null; }
    async epoch(client, world) { return world.current_epoch === null ? null : (await client.query('SELECT * FROM authority_membership_epochs WHERE world_id=$1 AND membership_epoch=$2', [world.world_id, world.current_epoch])).rows[0] ?? null; }
    async member(client, world, session, requestedEpoch) {
        const epoch = await this.epoch(client, world);
        if (!epoch || Number(world.current_epoch) !== requestedEpoch)
            fail('EpochClosed');
        const payload = epoch.payload;
        if (!payload.credentials.some(c => c.accountId === session.accountId && c.deviceId === session.deviceId && c.deviceGeneration === session.deviceGeneration && c.registeredSigningKeyFingerprint === session.signingKeyFingerprint))
            fail('MemberNotActive', 403, 'Forbidden');
        return payload;
    }
    async mayRead(client, world, session) { if (world.registration.worldDeveloperAccountId === session.accountId || await this.observer(client, world.world_id, session.accountId))
        return; const epoch = await this.epoch(client, world); if (epoch?.payload?.credentials.some(c => c.accountId === session.accountId && c.deviceId === session.deviceId && c.deviceGeneration === session.deviceGeneration))
        return; fail('MemberNotActive', 403, 'Forbidden'); }
    async dispatch(client, operation, input, session, sample, sourceIp) {
        const p = input.payload, nonce = input.requestNonce;
        if (operation === '/status')
            return this.wrap('SharedServiceStatus', nonce, { clockGeneration: sample.generation, clockStatus: sample.trusted ? 'Trusted' : 'Untrusted', serverEpochMs: sample.epochMs, lastSignedEpochMs: sample.lastSignedEpochMs, policy, policySha256 });
        if (operation === '/world/register')
            return this.registerWorld(client, p, nonce, session, sample);
        const id = (p.worldId ?? p.proposal?.worldId ?? p.change?.worldId ?? p.admissionClaim?.claim?.header?.worldId ?? p.proof?.worldId ?? p.challengeReceipt?.payload?.worldId);
        const world = await this.storage.lockWorld(client, id);
        if (!world || world.registration.serviceInstanceId !== this.signer.serviceInstanceId)
            fail('FactUnavailable', 503, 'AuthorityUnavailable');
        if (operation === '/world/facts') {
            await this.mayRead(client, world, session);
            const observer = await this.observer(client, id, p.observerAccountId ?? session.accountId);
            const epoch = await this.epoch(client, world);
            const seal = (await client.query('SELECT receipt FROM authority_settlement_seals WHERE world_id=$1 ORDER BY seal_revision DESC LIMIT 1', [id])).rows[0];
            return this.wrap('WorldFacts', nonce, { registration: world.registration, currentMembership: epoch ? WorldAuthorityStorage.value(epoch.receipt) : null, requestedObserver: observer ? WorldAuthorityStorage.value(observer.receipt) : null, latestSeal: seal ? WorldAuthorityStorage.value(seal.receipt) : null, developerClosure: null, policy, policySha256 });
        }
        if (operation === '/credential/challenge')
            return this.credentialChallenge(client, world, p, nonce, session, sample);
        if (operation === '/credential/register')
            return this.registerCredential(client, world, p, nonce, session, sample);
        if (operation === '/access-code/set')
            return this.setCode(client, world, p, nonce, session, sample);
        if (operation === '/observer/challenge')
            return this.observerChallenge(client, world, p, nonce, session, sample);
        if (operation === '/observer/redeem')
            return this.redeemObserver(client, world, p, nonce, session, sample, sourceIp);
        if (operation === '/membership/publish')
            return this.publishEpoch(client, world, p, nonce, session, sample);
        if (operation === '/membership/read') {
            const row = (await client.query('SELECT * FROM authority_membership_epochs WHERE world_id=$1 AND membership_epoch=$2', [id, p.membershipEpoch])).rows[0];
            if (!row)
                fail('FactUnavailable', 503, 'AuthorityUnavailable');
            const value = row.payload;
            if (world.registration.worldDeveloperAccountId !== session.accountId && !value.credentials.some(c => c.accountId === session.accountId && c.deviceId === session.deviceId && c.deviceGeneration === session.deviceGeneration && c.registeredSigningKeyFingerprint === session.signingKeyFingerprint))
                fail('MemberNotActive', 403, 'Forbidden');
            return this.wrap('MembershipRead', nonce, { epochReceipt: WorldAuthorityStorage.value(row.receipt) });
        }
        if (operation === '/sequence/allocate')
            return this.allocateSegment(client, world, p, nonce, session, sample);
        if (operation === '/append/permit')
            return this.issuePermit(client, world, p, nonce, session, sample);
        if (operation === '/commit/admit')
            return this.admit(client, world, p, nonce, session, sample);
        if (operation === '/commit/admission') {
            await this.mayRead(client, world, session);
            let row = (await client.query('SELECT receipt,envelope_sha256,world_id FROM authority_commit_admissions WHERE account_id=$1 AND author_sequence=$2', [p.identity.authorAccountId, p.identity.authorSequence])).rows[0];
            if (row && row.world_id === id && row.envelope_sha256 === p.envelopeSha256)
                return this.wrap('AdmissionRead', nonce, { receipt: WorldAuthorityStorage.value(row.receipt) });
            row = (await client.query('SELECT receipt FROM authority_commit_rejections WHERE account_id=$1 AND author_sequence=$2 AND world_id=$3 AND envelope_sha256=$4', [p.identity.authorAccountId, p.identity.authorSequence, id, p.envelopeSha256])).rows[0];
            if (!row)
                fail('FactUnavailable', 503, 'AuthorityUnavailable');
            return this.wrap('AdmissionRead', nonce, { receipt: WorldAuthorityStorage.value(row.receipt) });
        }
        if (operation === '/settlement/seal')
            return this.seal(client, world, p, nonce, session, sample);
        fail('SchemaInvalid', 400, 'InvalidData');
    }
    async registerWorld(client, p, nonce, session, sample) {
        const proposal = p.proposal;
        const pin = this.config.operatorWorldPins.find(item => item.worldId === proposal.worldId);
        if (!pin)
            fail('RootPinMismatch', 403, 'Forbidden');
        const expected = { schemaVersion: 1, serviceInstanceId: pin.serviceInstanceId, worldId: pin.worldId, mapId: pin.mapId, worldDeveloperAccountId: pin.worldDeveloperAccountId, developerTrustAnchorSha256: pin.developerTrustAnchorSha256, genesisSha256: pin.genesisSha256, contentManifestSha256: pin.contentManifestSha256 };
        if (!identical(proposal, expected) || session.accountId !== pin.worldDeveloperAccountId || pin.developerTrustAnchor.developerPublicKeyFingerprint === session.signingKeyFingerprint || pin.developerTrustAnchor.developerPublicKeyFingerprint === this.signer.keyId || !verifySharedSignature(pin.developerTrustAnchor.developerPublicKey, 'Neurou/world-registration/v1\0', proposal, p.developerSignatureBase64Url))
            fail('RootPinMismatch', 403, 'Forbidden');
        const previous = await this.storage.lockWorld(client, pin.worldId);
        if (previous) {
            if (!identical(previous.registration, proposal))
                fail('RootPinMismatch', 403, 'Forbidden');
            return this.wrap('WorldRegistration', nonce, proposal);
        }
        requiredTime(sample);
        const receipt = this.wrap('WorldRegistration', nonce, proposal);
        await client.query('INSERT INTO authority_worlds(world_id,service_instance_id,registration,root_anchor,registration_receipt) VALUES($1,$2,$3,$4,$5)', [pin.worldId, pin.serviceInstanceId, proposal, pin.developerTrustAnchor, WorldAuthorityStorage.bytes(receipt)]);
        return receipt;
    }
    async credentialChallenge(client, world, p, nonce, session, sample) {
        const time = requiredTime(sample);
        const observer = await this.observer(client, world.world_id, session.accountId);
        const isRoot = world.registration.worldDeveloperAccountId === session.accountId;
        if (!isRoot && !observer)
            fail('MemberNotActive', 403, 'Forbidden');
        try {
            validatePublicKey(p.keyAgreementPublicKey);
        }
        catch {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        if (keyFingerprint(p.keyAgreementPublicKey) !== p.keyAgreementKeyFingerprint || [session.signingKeyFingerprint, this.signer.keyId, world.root_anchor.developerPublicKeyFingerprint].includes(p.keyAgreementKeyFingerprint) || [this.signer.keyId, world.root_anchor.developerPublicKeyFingerprint].includes(session.signingKeyFingerprint))
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const credential = { accountId: session.accountId, observerAdmissionRevision: isRoot ? null : Number(observer.admission_revision), deviceId: session.deviceId, deviceGeneration: session.deviceGeneration, registeredSigningKeyFingerprint: session.signingKeyFingerprint, keyAgreementPublicKey: p.keyAgreementPublicKey, keyAgreementKeyFingerprint: p.keyAgreementKeyFingerprint };
        this.codec.validate('WorldMemberCredential', credential);
        const context = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, worldId: world.world_id, challengeId: randomUUID(), requestNonce: nonce, recipient: credential, developerTrustAnchorSha256: world.registration.developerTrustAnchorSha256, challengeNonceBase64Url: randomToken(), expiresAtServerEpochMs: time + 30000 };
        const made = makeCredentialChallenge(context);
        const receipt = this.wrap('AgreementCredentialChallenge', nonce, made.challenge);
        await client.query('INSERT INTO authority_challenges(challenge_id,kind,world_id,account_id,device_id,device_generation,session_id,challenge_sha256,public_challenge,challenge_receipt,expires_at,expected_tag_sha256) VALUES($1,\'Credential\',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [context.challengeId, world.world_id, session.accountId, session.deviceId, session.deviceGeneration, session.sessionId, sha256(sharedCanonical(made.challenge)), made.challenge, WorldAuthorityStorage.bytes(receipt), context.expiresAtServerEpochMs, made.expectedTagSha256]);
        return receipt;
    }
    async registerCredential(client, world, p, nonce, session, sample) {
        const time = requiredTime(sample), proof = p.proof;
        const row = (await client.query('SELECT * FROM authority_challenges WHERE challenge_id=$1 FOR UPDATE', [proof.challengeId])).rows[0];
        if (!row || row.kind !== 'Credential' || row.world_id !== world.world_id || row.account_id !== session.accountId || row.device_id !== session.deviceId || Number(row.device_generation) !== session.deviceGeneration || row.session_id !== session.sessionId)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        if (row.consumed)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        await client.query('UPDATE authority_challenges SET consumed=true,terminal_request_sha256=$2 WHERE challenge_id=$1', [proof.challengeId, sha256(sharedCanonical(p))]);
        const receipt = WorldAuthorityStorage.value(row.challenge_receipt);
        const challenge = row.public_challenge;
        if (Number(row.expires_at) <= time || proof.requestNonce !== nonce || proof.serviceInstanceId !== this.signer.serviceInstanceId || proof.worldId !== world.world_id || proof.challengeSha256 !== row.challenge_sha256 || !identical(proof.recipient, challenge.context.recipient) || !identical(p.challengeReceipt, receipt) || !timingSafeEqual(Buffer.from(sha256(Buffer.from(proof.proofTagBase64Url, 'base64url'))), Buffer.from(row.expected_tag_sha256)) || !verifySharedSignature(session.signingPublicKey, 'Neurou/world-member-credential-proof-signature/v1\0', sharedUnsigned(proof, 'recipientSignatureBase64Url'), proof.recipientSignatureBase64Url))
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const observer = await this.observer(client, world.world_id, session.accountId);
        const credential = proof.recipient;
        if (world.registration.worldDeveloperAccountId !== session.accountId && (!observer || credential.observerAdmissionRevision !== Number(observer.admission_revision)))
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const prior = (await client.query('SELECT registration_receipt FROM authority_agreement_credentials WHERE world_id=$1 AND account_id=$2 AND device_id=$3 AND device_generation=$4 AND key_fingerprint=$5', [world.world_id, session.accountId, session.deviceId, session.deviceGeneration, credential.keyAgreementKeyFingerprint])).rows[0];
        if (prior) {
            const historical = WorldAuthorityStorage.value(prior.registration_receipt);
            return this.wrap('AgreementCredential', nonce, historical.payload);
        }
        const binding = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, authorAccountId: session.accountId, authorDeviceId: session.deviceId, authorDeviceGeneration: session.deviceGeneration, authorSigningPublicJwk: session.signingPublicKey, authorSigningKeyFingerprint: session.signingKeyFingerprint, registeredAtServerEpochMs: time, assurance: 'RegisteredCredential' };
        const bindingReceipt = this.signer.authority('AuthorKeyBinding', nonce, binding, time, sample.generation);
        const fact = { credential, challengeSha256: proof.challengeSha256, registeredAtServerEpochMs: time, clockGeneration: sample.generation, authorKeyBinding: bindingReceipt, observerAdmission: observer ? WorldAuthorityStorage.value(observer.receipt) : null };
        const result = this.wrap('AgreementCredential', nonce, fact);
        await client.query('INSERT INTO authority_agreement_credentials(world_id,account_id,device_id,device_generation,key_fingerprint,credential,challenge_sha256,registered_at,binding_receipt,registration_receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [world.world_id, session.accountId, session.deviceId, session.deviceGeneration, credential.keyAgreementKeyFingerprint, credential, proof.challengeSha256, time, WorldAuthorityStorage.bytes(bindingReceipt), WorldAuthorityStorage.bytes(result)]);
        return result;
    }
    codeVerifier(world, revision, code) { return createHmac('sha256', this.config.accessCodePepper).update('Neurou/world-access-code-verifier/v1\0' + sharedCanonical({ serviceInstanceId: this.signer.serviceInstanceId, worldId: world, accessCodeRevision: revision, accessCode: code })).digest('hex'); }
    async setCode(client, world, p, nonce, session, sample) {
        this.root(world, session);
        const time = requiredTime(sample), proposal = p.proposal;
        requireInstance(proposal, this.signer.serviceInstanceId, world.world_id);
        if (proposal.requestNonce !== nonce || !verifySharedSignature(world.root_anchor.developerPublicKey, 'Neurou/world-access-code-change/v1\0', proposal, p.developerSignatureBase64Url))
            fail('RootPinMismatch', 403, 'Forbidden');
        const current = (await client.query('SELECT * FROM authority_access_codes WHERE world_id=$1 FOR UPDATE', [world.world_id])).rows[0];
        if ((current ? Number(current.code_revision) : null) !== proposal.expectedCodeRevision)
            fail('MembershipConflict');
        const revision = current ? increment(current.code_revision) : 1;
        await client.query(`INSERT INTO authority_access_codes(world_id,code_revision,verifier,changed_at) VALUES($1,$2,$3,$4) ON CONFLICT(world_id) DO UPDATE SET code_revision=EXCLUDED.code_revision,verifier=EXCLUDED.verifier,changed_at=EXCLUDED.changed_at`, [world.world_id, revision, this.codeVerifier(world.world_id, revision, proposal.accessCode), time]);
        return this.wrap('AccessCodeUpdated', nonce, { worldId: world.world_id, accessCodeRevision: revision, changedAtServerEpochMs: time, clockGeneration: sample.generation });
    }
    async observerChallenge(client, world, p, nonce, session, sample) {
        const time = requiredTime(sample);
        if (p.developerTrustAnchorSha256 !== world.registration.developerTrustAnchorSha256)
            fail('RootPinMismatch', 403, 'Forbidden');
        const code = (await client.query('SELECT * FROM authority_access_codes WHERE world_id=$1 FOR UPDATE', [world.world_id])).rows[0];
        if (!code)
            fail('FactUnavailable', 503, 'AuthorityUnavailable');
        const challenge = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, worldId: world.world_id, challengeId: randomUUID(), observerAccountId: session.accountId, deviceId: session.deviceId, deviceGeneration: session.deviceGeneration, nonceBase64Url: randomToken(), accessCodeRevision: Number(code.code_revision), developerTrustAnchorSha256: world.registration.developerTrustAnchorSha256, expiresAtServerEpochMs: time + 30000 };
        const receipt = this.wrap('ObserverChallenge', nonce, challenge);
        await client.query('INSERT INTO authority_challenges(challenge_id,kind,world_id,account_id,device_id,device_generation,session_id,challenge_sha256,public_challenge,challenge_receipt,expires_at) VALUES($1,\'Observer\',$2,$3,$4,$5,$6,$7,$8,$9,$10)', [challenge.challengeId, world.world_id, session.accountId, session.deviceId, session.deviceGeneration, session.sessionId, sha256(sharedCanonical(challenge)), challenge, WorldAuthorityStorage.bytes(receipt), challenge.expiresAtServerEpochMs]);
        return receipt;
    }
    async redeemObserver(client, world, p, nonce, session, sample, ip) {
        const time = requiredTime(sample);
        const challenge = p.challengeReceipt.payload;
        const code = (await client.query('SELECT * FROM authority_access_codes WHERE world_id=$1 FOR UPDATE', [world.world_id])).rows[0];
        if (!code)
            fail('MemberAdmissionRejected');
        const counters = code.failure_counters;
        // Scope IP is the exact backend peer (never untrusted X-Forwarded-For). The approved future edge adds its own trusted-source budget.
        const scopes = [{ key: 'account:' + session.accountId, window: 900000, maximum: 5 }, { key: 'world', window: 3600000, maximum: 100 }];
        const globalRow = (await client.query('SELECT ip_failure_counters FROM authority_clock_state WHERE service_instance_id=$1', [this.signer.serviceInstanceId])).rows[0];
        const ipCounters = globalRow.ip_failure_counters;
        const ipKey = sha256(ip), ipWindow = Math.floor(time / 900000) * 900000;
        const ipEntry = ipCounters[ipKey];
        if (ipEntry && ipEntry.window === ipWindow && ipEntry.count >= 20)
            fail('MemberAdmissionRejected');
        for (const scope of scopes) {
            const entry = counters[scope.key];
            if (entry && entry.window === Math.floor(time / scope.window) * scope.window && entry.count >= scope.maximum)
                fail('MemberAdmissionRejected');
        }
        const row = (await client.query('SELECT * FROM authority_challenges WHERE challenge_id=$1 FOR UPDATE', [challenge.challengeId])).rows[0];
        const bound = row && row.kind === 'Observer' && row.world_id === world.world_id && row.account_id === session.accountId && row.device_id === session.deviceId && Number(row.device_generation) === session.deviceGeneration && row.session_id === session.sessionId;
        if (bound && !row.consumed)
            await client.query('UPDATE authority_challenges SET consumed=true,terminal_request_sha256=$2 WHERE challenge_id=$1', [challenge.challengeId, sha256(sharedCanonical(p))]);
        const valid = bound && !row.consumed && Number(row.expires_at) > time && challenge.accessCodeRevision === Number(code.code_revision) && identical(p.challengeReceipt, WorldAuthorityStorage.value(row.challenge_receipt)) && timingSafeEqual(Buffer.from(this.codeVerifier(world.world_id, Number(code.code_revision), p.accessCode)), Buffer.from(code.verifier));
        if (!valid) {
            for (const scope of scopes) {
                const window = Math.floor(time / scope.window) * scope.window;
                const entry = counters[scope.key];
                counters[scope.key] = { window, count: entry?.window === window ? entry.count + 1 : 1 };
            }
            ipCounters[ipKey] = { window: ipWindow, count: ipEntry?.window === ipWindow ? ipEntry.count + 1 : 1 };
            for (const [key, entry] of Object.entries(ipCounters))
                if (entry.window + 900000 < time)
                    delete ipCounters[key];
            await client.query('UPDATE authority_clock_state SET ip_failure_counters=$2 WHERE service_instance_id=$1', [this.signer.serviceInstanceId, ipCounters]);
            // Expired counter keys may be removed, but a live budget survives restart and code rotation.
            for (const [key, entry] of Object.entries(counters))
                if (entry.window + 3600000 < time)
                    delete counters[key];
            await client.query('UPDATE authority_access_codes SET failure_counters=$2 WHERE world_id=$1', [world.world_id, counters]);
            fail('MemberAdmissionRejected');
        }
        const previous = await this.observer(client, world.world_id, session.accountId);
        if (previous)
            return this.mutation('/observer/redeem', nonce, WorldAuthorityStorage.value(previous.receipt));
        const revision = increment(world.observer_revision);
        const fact = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, worldId: world.world_id, observerAccountId: session.accountId, observerAdmissionRevision: revision, accessCodeRevision: Number(code.code_revision), admittedAtServerEpochMs: time, developerTrustAnchorSha256: world.registration.developerTrustAnchorSha256 };
        const receipt = this.signer.authority('WorldMembership', nonce, fact, time, sample.generation);
        await client.query('UPDATE authority_worlds SET observer_revision=$2 WHERE world_id=$1', [world.world_id, revision]);
        await client.query('INSERT INTO authority_observer_facts(world_id,account_id,admission_revision,code_revision,admitted_at,payload,receipt) VALUES($1,$2,$3,$4,$5,$6,$7)', [world.world_id, session.accountId, revision, code.code_revision, time, fact, WorldAuthorityStorage.bytes(receipt)]);
        return this.mutation('/observer/redeem', nonce, receipt);
    }
    async publishEpoch(client, world, p, nonce, session, sample) {
        this.root(world, session);
        const change = p.change;
        const proposal = change.next;
        requireInstance(change, this.signer.serviceInstanceId, world.world_id);
        if (change.requestNonce !== nonce)
            fail('AuthenticationMismatch', 401, 'Unauthenticated');
        const oldChange = (await client.query('SELECT change_sha256,receipt FROM authority_membership_epochs WHERE change_id=$1', [change.changeId])).rows[0];
        if (oldChange) {
            if (oldChange.change_sha256 !== sha256(sharedCanonical(change)))
                fail('IdempotencyConflict');
            return this.mutation('/membership/publish', nonce, WorldAuthorityStorage.value(oldChange.receipt));
        }
        const time = requiredTime(sample);
        if ((world.current_epoch === null ? null : Number(world.current_epoch)) !== change.expectedMembershipEpoch)
            fail('MembershipConflict');
        if (proposal.developerTrustAnchorSha256 !== world.registration.developerTrustAnchorSha256 || !verifySharedSignature(world.root_anchor.developerPublicKey, 'Neurou/world-membership/v1\0', sharedUnsigned(proposal, 'developerSignatureBase64Url'), proposal.developerSignatureBase64Url))
            fail('RootPinMismatch', 403, 'Forbidden');
        const next = proposal.credentials;
        if (next.length > 256)
            fail('ResourceLimit', 413, 'InvalidData');
        const current = await this.epoch(client, world);
        const previous = current ? current.payload.credentials : [];
        if (current) {
            const key = current.payload.key;
            if (key.worldRelayKeyId === proposal.key.worldRelayKeyId || key.keyCommitmentSha256 === proposal.key.keyCommitmentSha256)
                fail('MembershipConflict');
        }
        this.checkEpochDifference(change.reason, previous, next);
        // All target account/device rows were locked in sorted order before family/token/clock/world locks.
        for (const credential of next) {
            if ([this.signer.keyId, world.root_anchor.developerPublicKeyFingerprint].includes(credential.registeredSigningKeyFingerprint) || [this.signer.keyId, world.root_anchor.developerPublicKeyFingerprint].includes(credential.keyAgreementKeyFingerprint))
                fail('CredentialMismatch', 403, 'DeviceUntrusted');
            const binding = (await client.query('SELECT credential FROM authority_agreement_credentials WHERE world_id=$1 AND account_id=$2 AND device_id=$3 AND device_generation=$4 AND key_fingerprint=$5', [world.world_id, credential.accountId, credential.deviceId, credential.deviceGeneration, credential.keyAgreementKeyFingerprint])).rows[0];
            const device = (await client.query('SELECT d.status,d.generation,d.key_fingerprint,a.disabled FROM devices d JOIN accounts a USING(account_id) WHERE d.device_id=$1 AND d.account_id=$2', [credential.deviceId, credential.accountId])).rows[0];
            if (!binding || !identical(binding.credential, credential) || !device || device.disabled || device.status !== 'Active' || Number(device.generation) !== credential.deviceGeneration || device.key_fingerprint !== credential.registeredSigningKeyFingerprint)
                fail('CredentialMismatch', 403, 'DeviceUntrusted');
            if (credential.accountId === world.registration.worldDeveloperAccountId) {
                if (credential.observerAdmissionRevision !== null)
                    fail('CredentialMismatch', 403, 'DeviceUntrusted');
            }
            else {
                const observer = await this.observer(client, world.world_id, credential.accountId);
                if (!observer || Number(observer.admission_revision) !== credential.observerAdmissionRevision)
                    fail('MemberNotActive', 403, 'Forbidden');
            }
        }
        const epoch = { ...proposal, activatedAtServerEpochMs: time };
        this.codec.validate('WorldMembershipEpoch', epoch);
        const receipt = this.signer.authority('WorldMembership', nonce, epoch, time, sample.generation);
        await client.query('INSERT INTO authority_membership_epochs(world_id,membership_epoch,change_id,change_sha256,proposal,payload,activated_at,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [world.world_id, epoch.membershipEpoch, change.changeId, sha256(sharedCanonical(change)), proposal, epoch, time, WorldAuthorityStorage.bytes(receipt)]);
        await client.query('UPDATE authority_worlds SET current_epoch=$2 WHERE world_id=$1', [world.world_id, epoch.membershipEpoch]);
        return this.mutation('/membership/publish', nonce, receipt);
    }
    checkEpochDifference(reason, previous, next) {
        const old = new Set(previous.map(sharedCanonical)), fresh = new Set(next.map(sharedCanonical));
        const added = next.filter(c => !old.has(sharedCanonical(c))), removed = previous.filter(c => !fresh.has(sharedCanonical(c)));
        const oldAccounts = new Set(previous.map(c => c.accountId)), newAccounts = new Set(next.map(c => c.accountId));
        const addedAccounts = [...newAccounts].filter(id => !oldAccounts.has(id)), removedAccounts = [...oldAccounts].filter(id => !newAccounts.has(id));
        const valid = reason === 'Initial' ? previous.length === 0 : reason === 'MemberAdded' ? addedAccounts.length > 0 && removed.length === 0 && added.every(c => !oldAccounts.has(c.accountId)) : reason === 'MemberRemoved' ? removedAccounts.length > 0 && added.length === 0 && removed.every(c => !newAccounts.has(c.accountId)) : reason === 'CredentialAdded' ? added.length > 0 && removed.length === 0 && addedAccounts.length === 0 && removedAccounts.length === 0 : reason === 'CredentialRemoved' ? removed.length > 0 && added.length === 0 && addedAccounts.length === 0 && removedAccounts.length === 0 : reason === 'KeyCompromise' ? added.length === 0 && removed.length === 0 : false;
        if (!valid)
            fail('MembershipConflict');
    }
    async allocateSegment(client, world, p, nonce, session, sample) {
        await this.member(client, world, session, p.membershipEpoch);
        const time = requiredTime(sample);
        await client.query('INSERT INTO authority_author_sequences(account_id,next_sequence) VALUES($1,1) ON CONFLICT(account_id) DO NOTHING', [session.accountId]);
        const first = Number((await client.query('SELECT next_sequence FROM authority_author_sequences WHERE account_id=$1 FOR UPDATE', [session.accountId])).rows[0].next_sequence);
        if (!Number.isSafeInteger(first + 1024))
            fail('SequenceExhausted');
        const segment = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, segmentId: randomUUID(), authorAccountId: session.accountId, authorDeviceId: session.deviceId, authorDeviceGeneration: session.deviceGeneration, worldId: world.world_id, membershipEpoch: p.membershipEpoch, firstSequence: first, lastSequence: first + 1023, issuedAtServerEpochMs: time, expiresAtServerEpochMs: time + 3600000 };
        const receipt = this.signer.authority('SequenceSegment', nonce, segment, time, sample.generation);
        await client.query('UPDATE authority_author_sequences SET next_sequence=$2 WHERE account_id=$1', [session.accountId, first + 1024]);
        await client.query('INSERT INTO authority_sequence_segments(segment_id,account_id,device_id,device_generation,world_id,membership_epoch,first_sequence,last_sequence,issued_at,expires_at,payload,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [segment.segmentId, session.accountId, session.deviceId, session.deviceGeneration, world.world_id, p.membershipEpoch, segment.firstSequence, segment.lastSequence, time, segment.expiresAtServerEpochMs, segment, WorldAuthorityStorage.bytes(receipt)]);
        return this.mutation('/sequence/allocate', nonce, receipt);
    }
    async issuePermit(client, world, p, nonce, session, sample) {
        const epoch = await this.member(client, world, session, p.membershipEpoch);
        const time = requiredTime(sample);
        if (p.identity.authorAccountId !== session.accountId || p.keyEpoch !== epoch.key.keyEpoch)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const segmentRow = (await client.query('SELECT * FROM authority_sequence_segments WHERE segment_id=$1 FOR UPDATE', [p.segmentId])).rows[0];
        const segment = segmentRow?.payload;
        if (!segment || segment.authorAccountId !== session.accountId || segment.authorDeviceId !== session.deviceId || segment.authorDeviceGeneration !== session.deviceGeneration || segment.worldId !== world.world_id || segment.membershipEpoch !== p.membershipEpoch || p.identity.authorSequence < segment.firstSequence || p.identity.authorSequence > segment.lastSequence || time < segment.issuedAtServerEpochMs || time >= segment.expiresAtServerEpochMs)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        if (world.sealed_through !== null && time <= Number(world.sealed_through))
            fail('TimeTooLate');
        const previous = (await client.query('SELECT receipt,payload FROM authority_append_permits WHERE account_id=$1 AND author_sequence=$2', [session.accountId, p.identity.authorSequence])).rows[0];
        if (previous) {
            const permit = previous.payload;
            if (permit.worldId === world.world_id && permit.segmentId === p.segmentId && permit.membershipEpoch === p.membershipEpoch && permit.keyEpoch === p.keyEpoch && permit.changeClass === p.changeClass && permit.authorDeviceId === session.deviceId)
                return this.mutation('/append/permit', nonce, WorldAuthorityStorage.value(previous.receipt));
            fail('IdentityConflict');
        }
        const permit = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, permitId: randomUUID(), requestNonce: nonce, worldId: world.world_id, identity: p.identity, authorDeviceId: session.deviceId, authorDeviceGeneration: session.deviceGeneration, segmentId: p.segmentId, membershipEpoch: p.membershipEpoch, keyEpoch: p.keyEpoch, changeClass: p.changeClass, appendedAt: { epochMs: time }, expiresAtServerEpochMs: time + 30000, clockGeneration: sample.generation, clockStatus: 'Trusted' };
        const receipt = this.signer.authority('WorldAppendPermit', nonce, permit, time, sample.generation);
        await client.query('INSERT INTO authority_append_permits(permit_id,world_id,account_id,author_sequence,device_id,device_generation,segment_id,membership_epoch,change_class,appended_at,expires_at,clock_generation,payload,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [permit.permitId, world.world_id, session.accountId, p.identity.authorSequence, session.deviceId, session.deviceGeneration, p.segmentId, p.membershipEpoch, p.changeClass, time, permit.expiresAtServerEpochMs, sample.generation, permit, WorldAuthorityStorage.bytes(receipt)]);
        return this.mutation('/append/permit', nonce, receipt);
    }
    async admit(client, world, p, nonce, session, sample) {
        const signed = p.admissionClaim, claim = signed.claim;
        const header = claim.header;
        if (claim.requestNonce !== nonce || claim.serviceInstanceId !== this.signer.serviceInstanceId || header.worldId !== world.world_id || header.identity.authorAccountId !== session.accountId || header.authorDeviceId !== session.deviceId || header.authorDeviceGeneration !== session.deviceGeneration || header.authorSigningKeyFingerprint !== session.signingKeyFingerprint || !verifySharedSignature(session.signingPublicKey, 'Neurou/commit-admission-claim/v1\0', claim, signed.authorSignatureBase64Url))
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        let permitReceipt;
        let segmentReceipt;
        try {
            permitReceipt = this.signer.verifyAuthority(p.appendPermitReceipt);
            segmentReceipt = this.signer.verifyAuthority(p.sequenceSegmentReceipt);
        }
        catch {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        if (permitReceipt.purpose !== 'WorldAppendPermit' || segmentReceipt.purpose !== 'SequenceSegment')
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const permit = permitReceipt.payload, segment = segmentReceipt.payload;
        const permitRow = (await client.query('SELECT * FROM authority_append_permits WHERE permit_id=$1 FOR UPDATE', [header.permitId])).rows[0];
        const segmentRow = (await client.query('SELECT * FROM authority_sequence_segments WHERE segment_id=$1 FOR UPDATE', [header.segmentId])).rows[0];
        if (!permitRow || !segmentRow || !identical(p.appendPermitReceipt, WorldAuthorityStorage.value(permitRow.receipt)) || !identical(p.sequenceSegmentReceipt, WorldAuthorityStorage.value(segmentRow.receipt)) || permit.worldId !== world.world_id || !identical(permit.identity, header.identity) || permit.authorDeviceId !== header.authorDeviceId || permit.authorDeviceGeneration !== header.authorDeviceGeneration || permit.segmentId !== header.segmentId || permit.membershipEpoch !== header.membershipEpoch || permit.keyEpoch !== header.keyEpoch || permit.changeClass !== header.changeClass || !identical(permit.appendedAt, header.appendedAt) || segment.authorAccountId !== session.accountId || segment.authorDeviceId !== session.deviceId || segment.authorDeviceGeneration !== session.deviceGeneration || segment.worldId !== world.world_id || segment.membershipEpoch !== header.membershipEpoch || header.identity.authorSequence < segment.firstSequence || header.identity.authorSequence > segment.lastSequence || header.appendedAt.epochMs < segment.issuedAtServerEpochMs || header.appendedAt.epochMs >= segment.expiresAtServerEpochMs)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        const admitted = (await client.query('SELECT * FROM authority_commit_admissions WHERE account_id=$1 AND author_sequence=$2', [session.accountId, header.identity.authorSequence])).rows[0];
        if (admitted && admitted.world_id === world.world_id && admitted.envelope_sha256 === claim.envelopeSha256 && identical(admitted.public_header, header))
            return this.mutation('/commit/admit', nonce, WorldAuthorityStorage.value(admitted.receipt));
        const previousRejection = (await client.query('SELECT receipt FROM authority_commit_rejections WHERE account_id=$1 AND author_sequence=$2 AND envelope_sha256=$3', [session.accountId, header.identity.authorSequence, claim.envelopeSha256])).rows[0];
        if (previousRejection)
            return this.mutation('/commit/admit', nonce, WorldAuthorityStorage.value(previousRejection.receipt));
        const time = requiredTime(sample);
        let rejection = null;
        if (admitted || permitRow.consumed_sha256 !== null && permitRow.consumed_sha256 !== claim.envelopeSha256)
            rejection = 'IdentityConflict';
        else if (Number(world.current_epoch) !== header.membershipEpoch)
            rejection = 'EpochClosed';
        else if (time >= permit.expiresAtServerEpochMs || header.appendedAt.epochMs > time)
            rejection = 'PermitExpired';
        else if (world.sealed_through !== null && header.appendedAt.epochMs <= Number(world.sealed_through) || time - header.appendedAt.epochMs > policy.settleHorizonMs)
            rejection = 'TimeTooLate';
        let epoch = null;
        if (rejection === null) {
            try {
                epoch = await this.member(client, world, session, header.membershipEpoch);
            }
            catch (error) {
                if (error instanceof SharedServiceFailure && (error.detail === 'EpochClosed' || error.detail === 'MemberNotActive'))
                    rejection = 'EpochClosed';
                else
                    throw error;
            }
        }
        if (rejection) {
            const payload = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, worldId: world.world_id, identity: header.identity, envelopeSha256: claim.envelopeSha256, appendedAt: header.appendedAt, rejectedAtServerEpochMs: time, reason: rejection, previouslyAdmitted: false };
            const receipt = this.signer.authority('WorldCommitRejection', nonce, payload, time, sample.generation);
            await client.query('INSERT INTO authority_commit_rejections(account_id,author_sequence,world_id,envelope_sha256,reason,payload,receipt) VALUES($1,$2,$3,$4,$5,$6,$7)', [session.accountId, header.identity.authorSequence, world.world_id, claim.envelopeSha256, rejection, payload, WorldAuthorityStorage.bytes(receipt)]);
            if (permitRow.consumed_sha256 === null)
                await client.query('UPDATE authority_append_permits SET consumed_sha256=$2 WHERE permit_id=$1', [permit.permitId, claim.envelopeSha256]);
            return this.mutation('/commit/admit', nonce, receipt);
        }
        if (!epoch || epoch.key.worldRelayKeyId !== header.worldRelayKeyId || epoch.key.keyEpoch !== header.keyEpoch || epoch.activatedAtServerEpochMs > header.appendedAt.epochMs)
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        let rosterTarget = null;
        if (header.restrictedWrite?.subtype === 'DeveloperRosterChange') {
            const observer = await this.observer(client, world.world_id, header.restrictedWrite.accountId);
            if (!observer || Number(observer.admission_revision) !== header.restrictedWrite.observerAdmissionRevision || Number(observer.admitted_at) > header.appendedAt.epochMs)
                fail('CredentialMismatch', 403, 'DeviceUntrusted');
            if (header.restrictedWrite.operation === 'AddCoDeveloper')
                rosterTarget = true;
        }
        // The authority attests source/time/public roster target only. c-1 reducer adjudicates historical map permissions and exact encrypted changes.
        const revision = increment(world.admission_revision);
        const payload = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, worldId: world.world_id, identity: header.identity, envelopeSha256: claim.envelopeSha256, appendedAt: header.appendedAt, admittedAtServerEpochMs: time, admissionRevision: revision, membershipEpoch: header.membershipEpoch, rosterTargetObserverActiveAtAppendedAt: rosterTarget };
        const receipt = this.signer.authority('WorldCommitAdmission', nonce, payload, time, sample.generation);
        await client.query('INSERT INTO authority_commit_admissions(account_id,author_sequence,world_id,admission_revision,envelope_sha256,appended_at,admitted_at,public_header,payload,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [session.accountId, header.identity.authorSequence, world.world_id, revision, claim.envelopeSha256, header.appendedAt.epochMs, time, header, payload, WorldAuthorityStorage.bytes(receipt)]);
        await client.query('UPDATE authority_append_permits SET consumed_sha256=$2 WHERE permit_id=$1', [permit.permitId, claim.envelopeSha256]);
        await client.query('UPDATE authority_worlds SET admission_revision=$2 WHERE world_id=$1', [world.world_id, revision]);
        return this.mutation('/commit/admit', nonce, receipt);
    }
    async seal(client, world, p, nonce, session, sample) {
        await this.mayRead(client, world, session);
        const sameCutoff = (await client.query('SELECT receipt FROM authority_settlement_seals WHERE world_id=$1 AND cutoff=$2', [world.world_id, p.sealedThroughEpochMs])).rows[0];
        if (sameCutoff)
            return this.mutation('/settlement/seal', nonce, WorldAuthorityStorage.value(sameCutoff.receipt));
        const time = requiredTime(sample);
        if (p.sealedThroughEpochMs > time - policy.settleHorizonMs || world.sealed_through !== null && p.sealedThroughEpochMs < Number(world.sealed_through))
            fail('SealBoundaryConflict');
        const previous = (await client.query('SELECT receipt FROM authority_settlement_seals WHERE world_id=$1 ORDER BY seal_revision DESC LIMIT 1', [world.world_id])).rows[0];
        const previousSha = previous ? sha256(previous.receipt) : null;
        if (p.expectedPreviousSealSha256 !== previousSha)
            fail('SealBoundaryConflict');
        const rows = (await client.query('SELECT account_id,author_sequence,envelope_sha256,appended_at FROM authority_commit_admissions WHERE world_id=$1 AND appended_at<=$2 ORDER BY appended_at,account_id,author_sequence', [world.world_id, p.sealedThroughEpochMs])).rows;
        const prefix = rows.map(row => ({ identity: { authorAccountId: row.account_id, authorSequence: Number(row.author_sequence) }, envelopeSha256: row.envelope_sha256, appendedAt: { epochMs: Number(row.appended_at) } }));
        const revision = increment(world.seal_revision);
        const payload = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, worldId: world.world_id, sealRevision: revision, policySha256, issuedAtServerEpochMs: time, sealedThroughEpochMs: p.sealedThroughEpochMs, admittedCommitCount: prefix.length, admittedPrefixSha256: sha256(sharedCanonical(prefix)), developerClosureSha256: null, previousSealSha256: previousSha };
        const receipt = this.signer.authority('RelaySettlementSeal', nonce, payload, time, sample.generation);
        await client.query('INSERT INTO authority_settlement_seals(world_id,seal_revision,cutoff,payload,receipt) VALUES($1,$2,$3,$4,$5)', [world.world_id, revision, p.sealedThroughEpochMs, payload, WorldAuthorityStorage.bytes(receipt)]);
        await client.query('UPDATE authority_worlds SET seal_revision=$2,sealed_through=$3 WHERE world_id=$1', [world.world_id, revision, p.sealedThroughEpochMs]);
        return this.mutation('/settlement/seal', nonce, receipt);
    }
}
