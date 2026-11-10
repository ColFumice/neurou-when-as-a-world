import { SharedServiceProtocolCodec } from '../.shared-kernel/SharedServiceProtocolCodec.js';
import { SharedCanonicalBytes, SharedSchemaError } from '../.shared-kernel/SharedCanonicalBytes.js';
import { SharedServiceFailure } from './SharedSessionVerifier.js';
const operations = [['/status', 16384], ['/world/register', 32768], ['/world/facts', 16384], ['/credential/challenge', 32768], ['/credential/register', 32768], ['/access-code/set', 16384], ['/observer/challenge', 16384], ['/observer/redeem', 16384], ['/membership/publish', 524288], ['/membership/read', 16384], ['/sequence/allocate', 16384], ['/append/permit', 32768], ['/commit/admit', 65536], ['/commit/admission', 16384], ['/settlement/seal', 16384]];
function schemaFailure(error, request) {
    if (error.code === 'CanonicalInvalid')
        return new SharedServiceFailure('CanonicalInvalid', 400, 'InvalidData');
    if (error.code === 'LimitExceeded')
        return new SharedServiceFailure('ResourceLimit', 413, 'InvalidData');
    // Version classification follows a complete strict canonical decode, never JSON.parse or a duplicate-key projection.
    try {
        const value = SharedCanonicalBytes.decode(SharedCanonicalBytes.utf8(request.body));
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const version = value.schemaVersion;
            if (typeof version === 'number' && Number.isSafeInteger(version) && version !== 1)
                return new SharedServiceFailure('VersionUnsupported', 400, 'VersionUnsupported');
        }
    }
    catch { }
    return new SharedServiceFailure('SchemaInvalid', 400, 'InvalidData');
}
/** Encapsulation preserves every old b guard/error route unchanged. Only this child parser retains canonical raw bytes. */
export async function authorityRoutes(app, service) {
    app.removeContentTypeParser('application/json');
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, text, done) => done(null, text));
    app.setErrorHandler((error, request, reply) => {
        const e = error;
        const legacy = e.constructor.name === 'Fault' && ['Forbidden', 'RateLimited', 'InvalidData', 'Unauthenticated', 'AuthorityUnavailable'].includes(String(e.code));
        const fault = error instanceof SharedServiceFailure ? error : error instanceof SharedSchemaError ? schemaFailure(error, request) : legacy && e.code === 'Forbidden' ? new SharedServiceFailure('OriginRejected', 403, 'Forbidden') : legacy && e.code === 'RateLimited' ? new SharedServiceFailure('RateLimitExceeded', 429, 'RateLimited', 'Authority', 60000) : legacy && e.code === 'InvalidData' ? new SharedServiceFailure('SchemaInvalid', 400, 'InvalidData') : new SharedServiceFailure(e.statusCode === 413 ? 'ResourceLimit' : 'ServiceUnavailable', e.statusCode === 413 ? 413 : 503, e.statusCode === 413 ? 'InvalidData' : 'AuthorityUnavailable');
        let nonce = null;
        try {
            const input = SharedServiceProtocolCodec.parseRequest(request.url.slice('/api/v1/shared'.length), request.body);
            nonce = input.requestNonce;
        }
        catch { }
        reply.code(fault.status).type('application/json').send(SharedServiceProtocolCodec.encode({ kind: 'Rejected', fault: { code: fault.code, layer: fault.layer, detail: fault.detail, requestId: request.id, requestNonce: nonce, retryAfterMs: fault.retryAfterMs } }));
    });
    for (const [operation, bodyLimit] of operations)
        app.post('/api/v1/shared' + operation, { bodyLimit }, async (request, reply) => {
            const raw = request.body;
            const input = SharedServiceProtocolCodec.parseRequest(operation, raw);
            const result = await service.handle(operation, input, raw, request);
            return reply.code(result.status).type('application/json').send(result.wire);
        });
}
