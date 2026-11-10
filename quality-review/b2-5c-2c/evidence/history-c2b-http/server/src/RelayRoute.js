import { SharedServiceProtocolCodec } from '../.shared-kernel/SharedServiceProtocolCodec.js';
import { SharedCanonicalBytes, SharedSchemaError } from '../.shared-kernel/SharedCanonicalBytes.js';
import { SharedServiceFailure } from './SharedSessionVerifier.js';
const operations = [['/relay/submit', 524288], ['/relay/pull', 16384], ['/relay/ack', 65536]];
function schemaFailure(error, request) {
    if (error.code === 'CanonicalInvalid') {
        return new SharedServiceFailure('CanonicalInvalid', 400, 'InvalidData', 'Relay');
    }
    if (error.code === 'LimitExceeded') {
        return new SharedServiceFailure('ResourceLimit', 413, 'InvalidData', 'Relay');
    }
    try {
        const value = SharedCanonicalBytes.decode(SharedCanonicalBytes.utf8(request.body));
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const version = value.schemaVersion;
            if (typeof version === 'number' && Number.isSafeInteger(version) && version !== 1) {
                return new SharedServiceFailure('VersionUnsupported', 400, 'VersionUnsupported', 'Relay');
            }
        }
    }
    catch { }
    return new SharedServiceFailure('SchemaInvalid', 400, 'InvalidData', 'Relay');
}
/** Child scope retains exact wire without changing the old global auth parser, limit or guards. */
export async function relayRoutes(app, service) {
    app.removeContentTypeParser('application/json');
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, source, done) => done(null, source));
    app.setErrorHandler((error, request, reply) => {
        const legacy = error;
        let fault;
        if (error instanceof SharedServiceFailure) {
            fault = error;
        }
        else if (error instanceof SharedSchemaError) {
            fault = schemaFailure(error, request);
        }
        else if (legacy.constructor.name === 'Fault' && legacy.code === 'Forbidden') {
            fault = new SharedServiceFailure('OriginRejected', 403, 'Forbidden', 'Relay');
        }
        else if (legacy.constructor.name === 'Fault' && legacy.code === 'RateLimited') {
            fault = new SharedServiceFailure('RateLimitExceeded', 429, 'RateLimited', 'Relay', 60000);
        }
        else if (legacy.constructor.name === 'Fault' && legacy.code === 'InvalidData') {
            fault = new SharedServiceFailure('SchemaInvalid', 400, 'InvalidData', 'Relay');
        }
        else if (legacy.statusCode === 413) {
            fault = new SharedServiceFailure('ResourceLimit', 413, 'InvalidData', 'Relay');
        }
        else {
            fault = new SharedServiceFailure('RelayUnavailable', 503, 'AuthorityUnavailable', 'Relay');
        }
        let nonce = null;
        try {
            nonce = SharedServiceProtocolCodec.parseRequest(request.url.slice('/api/v1/shared'.length), request.body).requestNonce;
        }
        catch { }
        return reply.code(fault.status).type('application/json').send(SharedServiceProtocolCodec.encode({ kind: 'Rejected', fault: { code: fault.code, layer: fault.layer, detail: fault.detail, requestId: request.id, requestNonce: nonce, retryAfterMs: fault.retryAfterMs } }));
    });
    for (const [operation, bodyLimit] of operations) {
        app.post('/api/v1/shared' + operation, { bodyLimit }, async (request, reply) => {
            const input = SharedServiceProtocolCodec.parseRequest(operation, request.body);
            const result = await service.handle(operation, input, request.body, request);
            return reply.code(result.status).type('application/json').send(result.wire);
        });
    }
}
