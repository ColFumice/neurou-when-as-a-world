import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SharedServiceProtocolCodec } from '../.shared-kernel/SharedServiceProtocolCodec.js';
import { SharedCanonicalBytes, SharedSchemaError } from '../.shared-kernel/SharedCanonicalBytes.js';
import type { SharedProtocolOperation } from '../.shared-kernel/SharedServiceProtocolContracts.js';
import { SharedServiceFailure } from './SharedSessionVerifier.js';
import type { RelayService } from './RelayService.js';

const operations = [['/relay/submit', 524288], ['/relay/pull', 16384], ['/relay/ack', 65536]] as const;

function schemaFailure(error: SharedSchemaError, request: FastifyRequest): SharedServiceFailure {
  if (error.code === 'CanonicalInvalid') { return new SharedServiceFailure('CanonicalInvalid', 400, 'InvalidData', 'Relay'); }
  if (error.code === 'LimitExceeded') { return new SharedServiceFailure('ResourceLimit', 413, 'InvalidData', 'Relay'); }
  try {
    const value = SharedCanonicalBytes.decode(SharedCanonicalBytes.utf8(request.body as string));
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const version = (value as Record<string, unknown>).schemaVersion;
      if (typeof version === 'number' && Number.isSafeInteger(version) && version !== 1) { return new SharedServiceFailure('VersionUnsupported', 400, 'VersionUnsupported', 'Relay'); }
    }
  } catch {}
  return new SharedServiceFailure('SchemaInvalid', 400, 'InvalidData', 'Relay');
}

/** Child scope retains exact wire without changing the old global auth parser, limit or guards. */
export async function relayRoutes(app: FastifyInstance, service: RelayService): Promise<void> {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, source, done) => done(null, source));
  app.setErrorHandler((error, request, reply) => {
    const legacy = error as Error & { statusCode?: number; code?: string };
    let fault: SharedServiceFailure;
    if (error instanceof SharedServiceFailure) { fault = error; }
    else if (error instanceof SharedSchemaError) { fault = schemaFailure(error, request); }
    else if (legacy.constructor.name === 'Fault' && legacy.code === 'Forbidden') { fault = new SharedServiceFailure('OriginRejected', 403, 'Forbidden', 'Relay'); }
    else if (legacy.constructor.name === 'Fault' && legacy.code === 'RateLimited') { fault = new SharedServiceFailure('RateLimitExceeded', 429, 'RateLimited', 'Relay', 60000); }
    else if (legacy.constructor.name === 'Fault' && legacy.code === 'InvalidData') { fault = new SharedServiceFailure('SchemaInvalid', 400, 'InvalidData', 'Relay'); }
    else if (legacy.statusCode === 413) { fault = new SharedServiceFailure('ResourceLimit', 413, 'InvalidData', 'Relay'); }
    else { fault = new SharedServiceFailure('RelayUnavailable', 503, 'AuthorityUnavailable', 'Relay'); }
    let nonce: string | null = null;
    try { nonce = SharedServiceProtocolCodec.parseRequest(request.url.slice('/api/v1/shared'.length) as SharedProtocolOperation, request.body as string).requestNonce; } catch {}
    return reply.code(fault.status).type('application/json').send(SharedServiceProtocolCodec.encode({ kind: 'Rejected', fault: { code: fault.code, layer: fault.layer, detail: fault.detail, requestId: request.id, requestNonce: nonce, retryAfterMs: fault.retryAfterMs } }));
  });
  for (const [operation, bodyLimit] of operations) {
    app.post<{ Body: string }>('/api/v1/shared' + operation, { bodyLimit }, async (request, reply) => {
      const input = SharedServiceProtocolCodec.parseRequest(operation, request.body);
      const result = await service.handle(operation, input, request.body, request as FastifyRequest);
      return reply.code(result.status).type('application/json').send(result.wire);
    });
  }
}
