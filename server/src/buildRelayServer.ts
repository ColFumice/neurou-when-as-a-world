import type { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { ReceiptSigner } from './crypto.js';
import { SharedReceiptSigner } from './SharedReceiptSigner.js';
import { RealAuthorityClock } from './RealAuthorityClock.js';
import { WorldAuthorityService } from './WorldAuthorityService.js';
import { WorldAuthorityStorage } from './WorldAuthorityStorage.js';
import { authorityRoutes } from './AuthorityRoute.js';
import { RelayService } from './RelayService.js';
import { RelayStorage } from './RelayStorage.js';
import { relayRoutes } from './RelayRoute.js';
import { validateSharedConfig, type SharedServerConfig } from './SharedServerConfig.js';

export async function buildRelayServer(config: SharedServerConfig, pool: Pool, authSigner: ReceiptSigner, sharedSigner: SharedReceiptSigner): Promise<FastifyInstance> {
  return build(config, pool, authSigner, sharedSigner, RealAuthorityClock.production(config));
}

/** Isolated test injection only; no production environment or HTTP time switch. */
export async function buildIsolatedRelayServer(config: SharedServerConfig, pool: Pool, authSigner: ReceiptSigner, sharedSigner: SharedReceiptSigner, clock: RealAuthorityClock): Promise<FastifyInstance> {
  return build(config, pool, authSigner, sharedSigner, clock);
}

async function build(config: SharedServerConfig, pool: Pool, authSigner: ReceiptSigner, sharedSigner: SharedReceiptSigner, clock: RealAuthorityClock): Promise<FastifyInstance> {
  validateSharedConfig(config);
  if (authSigner.serviceInstanceId !== sharedSigner.serviceInstanceId || authSigner.keyId !== sharedSigner.keyId || sharedSigner.serviceInstanceId !== config.auth.serviceInstanceId) { throw new Error('Shared signer/service pin mismatch'); }
  if (config.operatorWorldPins.some(pin => pin.developerTrustAnchor.developerPublicKeyFingerprint === sharedSigner.keyId)) { throw new Error('World root and service signing key must be distinct'); }
  const app = await buildApp(config.auth, pool, authSigner);
  try {
    // One initialized clock capability is shared by unchanged authority and the new finite relay.
    await clock.initialize(pool);
    const authority = new WorldAuthorityService(config, new WorldAuthorityStorage(pool), sharedSigner, clock);
    const relay = new RelayService(new RelayStorage(pool), sharedSigner, clock);
    await app.register(async child => authorityRoutes(child, authority));
    await app.register(async child => relayRoutes(child, relay));
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
