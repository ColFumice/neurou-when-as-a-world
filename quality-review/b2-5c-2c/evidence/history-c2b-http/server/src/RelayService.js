import { performance } from 'node:perf_hooks';
import { SharedCommitCodec } from '../.shared-kernel/SharedCommitCodec.js';
import { SharedCanonicalBytes } from '../.shared-kernel/SharedCanonicalBytes.js';
import { SharedServiceProtocolCodec } from '../.shared-kernel/SharedServiceProtocolCodec.js';
import { sha256, keyFingerprint } from './crypto.js';
import { sharedCanonical, sharedUnsigned, verifySharedSignature } from './SharedReceiptSigner.js';
import { SharedSessionVerifier, SharedServiceFailure } from './SharedSessionVerifier.js';
import { RelayStorage } from './RelayStorage.js';
const RETENTION_MS = 86400000;
const MAX_CURSOR = 18446744073709551615n;
const RESPONSE_LIMIT = 1048576;
function fail(detail, status = 409, code = 'Conflict') { throw new SharedServiceFailure(detail, status, code, 'Relay'); }
function same(a, b) { return sharedCanonical(a) === sharedCanonical(b); }
function fromBytes(bytes) { return JSON.parse(bytes.toString('utf8')); }
/** Public source verification only: this service has no group key and never decrypts a body. */
export class RelayService {
    storage;
    signer;
    clock;
    codec = new SharedCommitCodec();
    verifier = new SharedSessionVerifier();
    rates = new Map();
    pendingPulls = new Set();
    constructor(storage, signer, clock) {
        this.storage = storage;
        this.signer = signer;
        this.clock = clock;
    }
    async handle(operation, input, raw, request) {
        const payload = input.payload;
        const prepared = operation === '/relay/submit' ? this.prepareCommit(payload.commit) : null;
        const started = performance.now();
        const maximumWait = operation === '/relay/pull' ? payload.maximumWaitMs : 0;
        let pendingKey = null;
        let charged = false;
        const disconnected = () => request.raw.aborted || request.raw.socket.destroyed;
        try {
            for (;;) {
                if (disconnected()) {
                    fail('RelayUnavailable', 503, 'AuthorityUnavailable');
                }
                const final = performance.now() - started >= maximumWait;
                const result = await this.storage.transaction(async (client) => {
                    // Existing auth locks always precede clock/world/stream locks. No lock is held during a wait.
                    const session = await this.verifier.verify(request, client, Date.now());
                    const sample = await this.clock.sample(client);
                    const worldId = operation === '/relay/submit' ? prepared.header.worldId : payload.worldId;
                    const requestSha = sha256(raw);
                    const prior = (await client.query('SELECT * FROM authority_requests WHERE service_instance_id=$1 AND account_id=$2 AND request_nonce=$3', [this.signer.serviceInstanceId, session.accountId, input.requestNonce])).rows[0];
                    if (prior) {
                        if (prior.operation !== operation || prior.world_id !== worldId || prior.device_id !== session.deviceId || Number(prior.device_generation) !== session.deviceGeneration || prior.request_sha256 !== requestSha) {
                            fail('IdempotencyConflict');
                        }
                        if (prior.result_wire === null) {
                            fail('IdempotencyExpired');
                        }
                        if (operation !== '/relay/pull') {
                            return { wire: prior.result_wire.toString('utf8'), status: this.storedStatus(prior.result_wire), empty: false };
                        }
                    }
                    if ((operation === '/relay/pull' || operation === '/relay/submit') && !sample.trusted) {
                        fail('ClockUntrusted', 503, 'TimeUntrusted');
                    }
                    if (!charged) {
                        this.limit(session, operation, worldId);
                        charged = true;
                    }
                    if (operation === '/relay/pull' && pendingKey === null) {
                        const key = session.accountId + ':' + session.deviceId;
                        if (this.pendingPulls.has(key)) {
                            throw new SharedServiceFailure('RateLimitExceeded', 429, 'RateLimited', 'Relay', 1000);
                        }
                        this.pendingPulls.add(key);
                        pendingKey = key;
                    }
                    this.authorization(operation, input, session);
                    const world = (await client.query('SELECT * FROM authority_worlds WHERE world_id=$1 FOR UPDATE', [worldId])).rows[0];
                    if (!world || world.service_instance_id !== this.signer.serviceInstanceId) {
                        fail('FactUnavailable', 503, 'AuthorityUnavailable');
                    }
                    await client.query('SAVEPOINT relay_business');
                    let value;
                    let status = 200;
                    let empty = false;
                    try {
                        const stream = await this.storage.lockStream(client, worldId);
                        await this.storage.expire(client, stream, sample.trusted ? sample.epochMs : null);
                        if (operation === '/relay/submit') {
                            value = await this.submit(client, world, stream, prepared, input.requestNonce, session);
                            // A late first enqueue may commit its immutable receipt/tombstone, never live expired bytes.
                            await this.storage.expire(client, stream, sample.trusted ? sample.epochMs : null);
                        }
                        else if (operation === '/relay/ack') {
                            value = await this.acknowledge(client, world, stream, payload, input.requestNonce, session);
                        }
                        else {
                            const memory = prior ? this.pullMemory(prior.result_wire) : null;
                            const batch = await this.pull(client, world, stream, payload, session);
                            empty = !prior && batch.kind === 'Batch' && batch.commits.length === 0;
                            if (memory !== null && batch.kind === 'Batch') {
                                value = await this.reconstructPull(client, memory);
                            }
                            else if (memory !== null && same(memory.receipt.payload, batch)) {
                                value = await this.reconstructPull(client, memory);
                            }
                            else {
                                value = this.pullReceipt(batch, input.requestNonce);
                            }
                        }
                        const finalSample = await this.clock.sample(client);
                        if (sample.trusted && !finalSample.trusted) {
                            fail('ClockUntrusted', 503, 'TimeUntrusted');
                        }
                    }
                    catch (error) {
                        if (!(error instanceof SharedServiceFailure)) {
                            throw error;
                        }
                        await client.query('ROLLBACK TO SAVEPOINT relay_business');
                        status = error.status;
                        value = { code: error.code, layer: error.layer, detail: error.detail, requestId: request.id, requestNonce: input.requestNonce, retryAfterMs: error.retryAfterMs };
                    }
                    // A latch survives a business savepoint rollback, including an unsafe expiry attempt.
                    await this.clock.sample(client);
                    const reply = status === 200 ? { kind: 'Accepted', value } : { kind: 'Rejected', fault: value };
                    const wire = SharedServiceProtocolCodec.encode(reply);
                    if (Buffer.byteLength(wire) > RESPONSE_LIMIT) {
                        fail('ResourceLimit', 413, 'InvalidData');
                    }
                    SharedServiceProtocolCodec.parseReply(operation, wire, input.requestNonce);
                    if ((status === 200 || status === 409) && (!empty || final || prior)) {
                        const stored = operation === '/relay/pull' && status === 200 ? RelayStorage.bytes(this.rememberPull(value, wire)) : Buffer.from(wire);
                        // P11: only lightweight references live in authority_requests; the queue is the sole ciphertext source.
                        if (!prior) {
                            await client.query('INSERT INTO authority_requests(service_instance_id,account_id,request_nonce,operation,world_id,device_id,device_generation,request_sha256,result_wire,result_kind,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [this.signer.serviceInstanceId, session.accountId, input.requestNonce, operation, worldId, session.deviceId, session.deviceGeneration, requestSha, stored, status === 200 ? 'Accepted' : 'Rejected', Date.now()]);
                        }
                    }
                    return { wire, status, empty };
                });
                if (!result.empty || final || operation !== '/relay/pull') {
                    return result;
                }
                await new Promise(resolve => setTimeout(resolve, Math.min(100, Math.max(1, maximumWait - (performance.now() - started)))));
            }
        }
        catch (error) {
            await this.clock.persistLatch(this.storage.pool);
            throw error;
        }
        finally {
            if (pendingKey !== null) {
                this.pendingPulls.delete(pendingKey);
            }
        }
    }
    storedStatus(bytes) {
        const result = fromBytes(bytes);
        if (result.kind === 'Accepted') {
            return 200;
        }
        const f = result.fault;
        return f.detail === 'ResourceLimit' ? 413 : f.code === 'Unauthenticated' ? 401 : f.code === 'Forbidden' || f.code === 'DeviceUntrusted' ? 403 : f.code === 'RateLimited' ? 429 : f.code === 'Conflict' ? 409 : f.code === 'VersionUnsupported' || f.code === 'InvalidData' ? 400 : 503;
    }
    limit(session, operation, worldId) {
        const now = Date.now();
        const window = Math.floor(now / 60000) * 60000;
        const charge = (key, maximum) => {
            const previous = this.rates.get(key);
            if (!previous || previous.expires !== window + 60000) {
                this.rates.set(key, { count: 1, expires: window + 60000 });
            }
            else if (++previous.count > maximum) {
                throw new SharedServiceFailure('RateLimitExceeded', 429, 'RateLimited', 'Relay', 60000);
            }
        };
        charge(session.accountId + ':' + session.deviceId + ':' + operation, operation === '/relay/ack' ? 240 : 120);
        if (operation === '/relay/submit') {
            charge('world:' + worldId, 600);
        }
        if (this.rates.size > 4096) {
            for (const [key, value] of this.rates) {
                if (value.expires <= now) {
                    this.rates.delete(key);
                }
            }
        }
    }
    authorization(operation, input, session) {
        if (operation === '/relay/pull') {
            if (input.authorization !== null) {
                fail('SchemaInvalid', 400, 'InvalidData');
            }
            return;
        }
        const authorization = input.authorization;
        if (authorization === null || authorization.authorDeviceId !== session.deviceId || authorization.authorDeviceGeneration !== session.deviceGeneration) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        const unsigned = { schemaVersion: 1, serviceInstanceId: this.signer.serviceInstanceId, operation, requestNonce: input.requestNonce, authorDeviceId: authorization.authorDeviceId, authorDeviceGeneration: authorization.authorDeviceGeneration, payload: input.payload };
        if (!verifySharedSignature(session.signingPublicKey, 'Neurou/shared-device-operation/v1\0', unsigned, authorization.deviceSignatureBase64Url)) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
    }
    prepareCommit(input) {
        const wire = this.codec.validate('AdmittedWorldCommit', input);
        const bytes = Buffer.from(SharedCanonicalBytes.base64UrlDecode(wire.envelopeBytesBase64Url));
        const claim = wire.admissionClaim.claim;
        const header = claim.header;
        if (bytes.length > 65536 || sha256(bytes) !== claim.envelopeSha256 || claim.serviceInstanceId !== this.signer.serviceInstanceId || header.serviceInstanceId !== this.signer.serviceInstanceId) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        const receipts = [wire.authorKeyBindingReceipt, wire.sequenceSegmentReceipt, wire.appendPermitReceipt, wire.admissionReceipt, wire.membershipEpochReceipt];
        try {
            for (const receipt of receipts) {
                this.signer.verifyAuthority(receipt);
            }
            if (wire.rosterObserverAdmissionReceipt !== null) {
                this.signer.verifyAuthority(wire.rosterObserverAdmissionReceipt);
            }
        }
        catch {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        if (wire.authorKeyBindingReceipt.purpose !== 'AuthorKeyBinding' || wire.sequenceSegmentReceipt.purpose !== 'SequenceSegment' || wire.appendPermitReceipt.purpose !== 'WorldAppendPermit' || wire.admissionReceipt.purpose !== 'WorldCommitAdmission' || wire.membershipEpochReceipt.purpose !== 'WorldMembership') {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        const binding = wire.authorKeyBindingReceipt.payload;
        if (binding.serviceInstanceId !== this.signer.serviceInstanceId || binding.authorAccountId !== header.identity.authorAccountId || binding.authorDeviceId !== header.authorDeviceId || binding.authorDeviceGeneration !== header.authorDeviceGeneration || binding.assurance !== 'RegisteredCredential' || binding.registeredAtServerEpochMs > header.appendedAt.epochMs || keyFingerprint(binding.authorSigningPublicJwk) !== header.authorSigningKeyFingerprint || binding.authorSigningKeyFingerprint !== header.authorSigningKeyFingerprint || !verifySharedSignature(binding.authorSigningPublicJwk, 'Neurou/commit-admission-claim/v1\0', claim, wire.admissionClaim.authorSignatureBase64Url) || wire.admissionReceipt.requestNonce !== claim.requestNonce) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        const envelope = this.codec.decode('RelayCommitEnvelope', new Uint8Array(bytes));
        if (!same(envelope.header, header) || !verifySharedSignature(binding.authorSigningPublicJwk, 'Neurou/world-commit/v1\0', sharedUnsigned(envelope, 'authorSignatureBase64Url'), envelope.authorSignatureBase64Url)) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        return { wire, bytes, envelope, header };
    }
    async currentMember(client, world, session) {
        if (world.current_epoch === null) {
            fail('MemberNotActive', 403, 'Forbidden');
        }
        const row = (await client.query('SELECT payload FROM authority_membership_epochs WHERE world_id=$1 AND membership_epoch=$2', [world.world_id, world.current_epoch])).rows[0];
        if (!row || !row.payload.credentials.some(c => c.accountId === session.accountId && c.deviceId === session.deviceId && c.deviceGeneration === session.deviceGeneration && c.registeredSigningKeyFingerprint === session.signingKeyFingerprint)) {
            fail('MemberNotActive', 403, 'Forbidden');
        }
        return row.payload;
    }
    async verifyStoredSource(client, world, prepared) {
        const { wire, header } = prepared;
        const admission = (await client.query('SELECT * FROM authority_commit_admissions WHERE account_id=$1 AND author_sequence=$2', [header.identity.authorAccountId, header.identity.authorSequence])).rows[0];
        if (!admission || admission.world_id !== world.world_id || admission.envelope_sha256 !== wire.admissionClaim.claim.envelopeSha256 || !same(admission.public_header, header) || !same(fromBytes(admission.receipt), wire.admissionReceipt)) {
            fail('IdentityConflict');
        }
        const segment = (await client.query('SELECT receipt FROM authority_sequence_segments WHERE segment_id=$1', [header.segmentId])).rows[0];
        const permit = (await client.query('SELECT receipt FROM authority_append_permits WHERE permit_id=$1', [header.permitId])).rows[0];
        const epoch = (await client.query('SELECT receipt FROM authority_membership_epochs WHERE world_id=$1 AND membership_epoch=$2', [world.world_id, header.membershipEpoch])).rows[0];
        const bindings = (await client.query('SELECT binding_receipt FROM authority_agreement_credentials WHERE world_id=$1 AND account_id=$2 AND device_id=$3 AND device_generation=$4', [world.world_id, header.identity.authorAccountId, header.authorDeviceId, header.authorDeviceGeneration])).rows;
        if (!segment || !permit || !epoch || !same(fromBytes(segment.receipt), wire.sequenceSegmentReceipt) || !same(fromBytes(permit.receipt), wire.appendPermitReceipt) || !same(fromBytes(epoch.receipt), wire.membershipEpochReceipt) || !bindings.some(row => same(fromBytes(row.binding_receipt), wire.authorKeyBindingReceipt))) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        const membership = wire.membershipEpochReceipt.payload;
        const anchor = world.root_anchor;
        const unsigned = sharedUnsigned(sharedUnsigned(membership, 'developerSignatureBase64Url'), 'activatedAtServerEpochMs');
        if (membership.worldId !== world.world_id || membership.key.keyEpoch !== header.keyEpoch || membership.key.worldRelayKeyId !== header.worldRelayKeyId || membership.developerTrustAnchorSha256 !== sha256(sharedCanonical(anchor)) || !verifySharedSignature(anchor.developerPublicKey, 'Neurou/world-membership/v1\0', unsigned, membership.developerSignatureBase64Url)) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        const roster = header.restrictedWrite;
        if (roster !== null && roster.subtype === 'DeveloperRosterChange') {
            const observer = (await client.query('SELECT receipt FROM authority_observer_facts WHERE world_id=$1 AND account_id=$2', [world.world_id, roster.accountId])).rows[0];
            if (!observer || wire.rosterObserverAdmissionReceipt === null || !same(fromBytes(observer.receipt), wire.rosterObserverAdmissionReceipt) || wire.rosterObserverAdmissionReceipt.payload.observerAdmissionRevision !== roster.observerAdmissionRevision) {
                fail('CredentialMismatch', 403, 'DeviceUntrusted');
            }
        }
        else if (wire.rosterObserverAdmissionReceipt !== null) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
    }
    async submit(client, world, stream, prepared, nonce, session) {
        const { wire, header } = prepared;
        if (header.identity.authorAccountId !== session.accountId || header.authorDeviceId !== session.deviceId || header.authorDeviceGeneration !== session.deviceGeneration || header.authorSigningKeyFingerprint !== session.signingKeyFingerprint) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        await this.verifyStoredSource(client, world, prepared);
        const prior = (await client.query('SELECT * FROM relay_commit_queue WHERE account_id=$1 AND author_sequence=$2', [header.identity.authorAccountId, header.identity.authorSequence])).rows[0];
        if (prior) {
            if (prior.world_id !== world.world_id || prior.envelope_sha256 !== wire.admissionClaim.claim.envelopeSha256) {
                fail('IdentityConflict');
            }
            // A fresh HTTP nonce gets a fresh wrapper around the original immutable position facts.
            return this.signer.transport('RelaySubmit', nonce, fromBytes(prior.receipt).payload);
        }
        const current = await this.currentMember(client, world, session);
        if (current.membershipEpoch !== header.membershipEpoch) {
            fail('EpochClosed');
        }
        if (BigInt(stream.next_position) >= MAX_CURSOR) {
            fail('ResourceLimit', 413, 'InvalidData');
        }
        const position = stream.next_position;
        const admittedAt = wire.admissionReceipt.payload.admittedAtServerEpochMs;
        const retainedUntil = admittedAt + RETENTION_MS;
        if (!Number.isSafeInteger(retainedUntil)) {
            fail('ResourceLimit', 413, 'InvalidData');
        }
        const fact = { worldId: world.world_id, identity: header.identity, envelopeSha256: wire.admissionClaim.claim.envelopeSha256, cursor: { relayGeneration: Number(stream.generation), position }, admittedAtServerEpochMs: admittedAt, retainedUntilServerEpochMs: retainedUntil };
        const receipt = this.signer.transport('RelaySubmit', nonce, fact);
        const { envelopeBytesBase64Url: omitted, ...proof } = wire;
        await client.query('INSERT INTO relay_commit_queue(world_id,generation,position,account_id,author_sequence,envelope_bytes,public_proof,envelope_sha256,admitted_at,retained_until,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [world.world_id, stream.generation, position, header.identity.authorAccountId, header.identity.authorSequence, prepared.bytes, proof, fact.envelopeSha256, admittedAt, retainedUntil, RelayStorage.bytes(receipt)]);
        const recipients = [...wire.membershipEpochReceipt.payload.credentials].sort((a, b) => a.accountId.localeCompare(b.accountId) || a.deviceId.localeCompare(b.deviceId) || a.deviceGeneration - b.deviceGeneration);
        for (const recipient of recipients) {
            await client.query('INSERT INTO relay_delivery_recipients(world_id,generation,position,account_id,device_id,device_generation) VALUES($1,$2,$3,$4,$5,$6)', [world.world_id, stream.generation, position, recipient.accountId, recipient.deviceId, recipient.deviceGeneration]);
        }
        stream.next_position = String(BigInt(position) + 1n);
        await client.query('UPDATE relay_streams SET next_position=$2 WHERE world_id=$1', [world.world_id, stream.next_position]);
        return receipt;
    }
    async pull(client, world, stream, payload, session) {
        await this.currentMember(client, world, session);
        await this.storage.detectLostRange(client, stream);
        const after = payload.after;
        const floor = { relayGeneration: Number(stream.generation), position: stream.retention_floor };
        const gap = (reason) => ({ kind: 'Gap', worldId: world.world_id, after, retentionFloor: floor, reason });
        if (after.relayGeneration !== Number(stream.generation)) {
            return gap('RelayGenerationChanged');
        }
        if (BigInt(after.position) < BigInt(stream.retention_floor)) {
            return gap('RetentionExpired');
        }
        if (BigInt(after.position) >= BigInt(stream.next_position)) {
            fail('SchemaInvalid', 400, 'InvalidData');
        }
        if (await this.storage.missingAdmission(client, stream)) {
            return gap('MissingAdmittedEnvelope');
        }
        const rows = (await client.query('SELECT * FROM relay_commit_queue WHERE world_id=$1 AND generation=$2 AND position>$3 ORDER BY position LIMIT $4', [world.world_id, stream.generation, after.position, payload.maximumCount])).rows;
        const commits = [];
        let next = after.position;
        for (const row of rows) {
            if (BigInt(row.position) !== BigInt(next) + 1n || row.tombstone || row.envelope_bytes === null || row.public_proof === null || sha256(row.envelope_bytes) !== row.envelope_sha256) {
                return gap('MissingAdmittedEnvelope');
            }
            const commit = RelayStorage.commit(row);
            this.codec.validate('AdmittedWorldCommit', commit);
            commits.push(commit);
            const candidate = { kind: 'Batch', worldId: world.world_id, after, next: { relayGeneration: Number(stream.generation), position: row.position }, commits, retentionFloor: floor };
            if (Buffer.byteLength(SharedServiceProtocolCodec.encode({ kind: 'Accepted', value: this.pullReceipt(candidate, 'A'.repeat(43)) })) > RESPONSE_LIMIT) {
                commits.pop();
                if (commits.length === 0) {
                    fail('ResourceLimit', 413, 'InvalidData');
                }
                break;
            }
            next = row.position;
        }
        return { kind: 'Batch', worldId: world.world_id, after, next: { relayGeneration: Number(stream.generation), position: next }, commits, retentionFloor: floor };
    }
    pullReceipt(batch, nonce) { return this.signer.transport('RelayPull', nonce, batch); }
    rememberPull(receipt, wire) {
        const payload = receipt.payload;
        const entries = payload.kind === 'Batch' ? payload.commits.map((commit, index) => ({ position: String(BigInt(payload.after.position) + BigInt(index + 1)), identity: commit.admissionClaim.claim.header.identity, envelopeSha256: commit.admissionClaim.claim.envelopeSha256 })) : [];
        const skeleton = payload.kind === 'Batch' ? { ...payload, commits: [] } : payload;
        return { schemaVersion: 1, kind: 'RelayPullReferences', wireSha256: sha256(wire), receipt: { ...receipt, payload: skeleton }, entries };
    }
    pullMemory(bytes) {
        const memory = SharedCanonicalBytes.decode(new Uint8Array(bytes));
        const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
        if (!exact(memory, ['schemaVersion', 'kind', 'wireSha256', 'receipt', 'entries']) || memory.schemaVersion !== 1 || memory.kind !== 'RelayPullReferences' || !/^[0-9a-f]{64}$/.test(memory.wireSha256) || !Array.isArray(memory.entries) || memory.entries.length > 256) {
            fail('RelayUnavailable', 503, 'AuthorityUnavailable');
        }
        // Validate the exact public skeleton with the unchanged frozen wire codec; no hidden payload fields.
        const skeletonWire = SharedServiceProtocolCodec.encode({ kind: 'Accepted', value: memory.receipt });
        try {
            SharedServiceProtocolCodec.parseReply('/relay/pull', skeletonWire, memory.receipt.requestNonce);
        }
        catch {
            fail('RelayUnavailable', 503, 'AuthorityUnavailable');
        }
        if (memory.receipt.payload.kind === 'Batch' && memory.receipt.payload.commits.length !== 0 || memory.receipt.payload.kind === 'Gap' && memory.entries.length !== 0) {
            fail('RelayUnavailable', 503, 'AuthorityUnavailable');
        }
        let position = memory.receipt.payload.after.position;
        for (const entry of memory.entries) {
            if (!exact(entry, ['position', 'identity', 'envelopeSha256']) || !exact(entry.identity, ['authorAccountId', 'authorSequence']) || typeof entry.position !== 'string' || !/^[1-9][0-9]{0,19}$/.test(entry.position) || BigInt(entry.position) > MAX_CURSOR || BigInt(entry.position) !== BigInt(position) + 1n || !/^[0-9a-f]{64}$/.test(entry.envelopeSha256) || !/^[0-9a-f-]{36}$/.test(entry.identity.authorAccountId) || !Number.isSafeInteger(entry.identity.authorSequence) || entry.identity.authorSequence < 1) {
                fail('RelayUnavailable', 503, 'AuthorityUnavailable');
            }
            position = entry.position;
        }
        if (memory.receipt.payload.kind === 'Batch' && position !== memory.receipt.payload.next.position) {
            fail('RelayUnavailable', 503, 'AuthorityUnavailable');
        }
        return memory;
    }
    async reconstructPull(client, memory) {
        const skeleton = memory.receipt.payload;
        const commits = [];
        for (const entry of memory.entries) {
            const row = (await client.query('SELECT * FROM relay_commit_queue WHERE world_id=$1 AND generation=$2 AND position=$3', [skeleton.worldId, skeleton.after.relayGeneration, entry.position])).rows[0];
            if (!row || row.tombstone || row.envelope_bytes === null || row.public_proof === null || row.account_id !== entry.identity.authorAccountId || Number(row.author_sequence) !== entry.identity.authorSequence || row.envelope_sha256 !== entry.envelopeSha256 || sha256(row.envelope_bytes) !== entry.envelopeSha256) {
                fail('RelayUnavailable', 503, 'AuthorityUnavailable');
            }
            commits.push(RelayStorage.commit(row));
        }
        const payload = skeleton.kind === 'Batch' ? { ...skeleton, commits } : skeleton;
        const receipt = { ...memory.receipt, payload };
        const wire = SharedServiceProtocolCodec.encode({ kind: 'Accepted', value: receipt });
        if (sha256(wire) !== memory.wireSha256 || !verifySharedSignature(this.signer.jwk, 'Neurou/shared-transport/v1\0', sharedUnsigned(receipt, 'signatureBase64Url'), receipt.signatureBase64Url)) {
            fail('RelayUnavailable', 503, 'AuthorityUnavailable');
        }
        return receipt;
    }
    async acknowledge(client, world, stream, payload, nonce, session) {
        if (payload.authorDeviceId !== session.deviceId || payload.authorDeviceGeneration !== session.deviceGeneration || payload.relayGeneration !== Number(stream.generation)) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        await this.currentMember(client, world, session);
        const unsigned = sharedUnsigned(payload, 'deviceSignatureBase64Url');
        if (!verifySharedSignature(session.signingPublicKey, 'Neurou/relay-ack/v1\0', { serviceInstanceId: this.signer.serviceInstanceId, requestNonce: nonce, payload: unsigned }, payload.deviceSignatureBase64Url)) {
            fail('CredentialMismatch', 403, 'DeviceUntrusted');
        }
        for (const entry of payload.entries) {
            const row = (await client.query('SELECT q.* FROM relay_commit_queue q JOIN relay_delivery_recipients r USING(world_id,generation,position) WHERE q.world_id=$1 AND q.generation=$2 AND q.position=$3 AND r.account_id=$4 AND r.device_id=$5 AND r.device_generation=$6 FOR UPDATE OF q', [world.world_id, stream.generation, entry.position, session.accountId, session.deviceId, session.deviceGeneration])).rows[0];
            if (!row || row.tombstone || BigInt(entry.position) <= BigInt(stream.retention_floor) || row.account_id !== entry.identity.authorAccountId || Number(row.author_sequence) !== entry.identity.authorSequence || row.envelope_sha256 !== entry.envelopeSha256) {
                fail('CredentialMismatch', 403, 'DeviceUntrusted');
            }
        }
        const entriesSha = sha256(sharedCanonical(payload.entries));
        const fact = { worldId: world.world_id, relayGeneration: Number(stream.generation), accountId: session.accountId, deviceId: session.deviceId, deviceGeneration: session.deviceGeneration, entriesSha256: entriesSha, acknowledgedCount: payload.entries.length };
        const receipt = this.signer.transport('RelayAck', nonce, fact);
        for (const entry of payload.entries) {
            await client.query('INSERT INTO relay_acknowledgements(world_id,generation,position,account_id,device_id,device_generation,confirmation_sha256,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING', [world.world_id, stream.generation, entry.position, session.accountId, session.deviceId, session.deviceGeneration, entriesSha, RelayStorage.bytes(receipt)]);
        }
        return receipt;
    }
}
