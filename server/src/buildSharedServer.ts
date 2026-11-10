import type { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { ReceiptSigner } from './crypto.js';
import { SharedReceiptSigner } from './SharedReceiptSigner.js';
import { RealAuthorityClock } from './RealAuthorityClock.js';
import { WorldAuthorityService } from './WorldAuthorityService.js';
import { WorldAuthorityStorage } from './WorldAuthorityStorage.js';
import { authorityRoutes } from './AuthorityRoute.js';
import { validateSharedConfig,type SharedServerConfig } from './SharedServerConfig.js';

export async function buildSharedServer(config:SharedServerConfig,pool:Pool,authSigner:ReceiptSigner,sharedSigner:SharedReceiptSigner):Promise<FastifyInstance>{return build(config,pool,authSigner,sharedSigner,RealAuthorityClock.production(config));}
/** Explicit isolation entry: never used by shared-main or configurable through HTTP/environment. */
export async function buildIsolatedSharedServer(config:SharedServerConfig,pool:Pool,authSigner:ReceiptSigner,sharedSigner:SharedReceiptSigner,clock:RealAuthorityClock):Promise<FastifyInstance>{return build(config,pool,authSigner,sharedSigner,clock);}
async function build(config:SharedServerConfig,pool:Pool,authSigner:ReceiptSigner,sharedSigner:SharedReceiptSigner,clock:RealAuthorityClock):Promise<FastifyInstance>{
 validateSharedConfig(config);if(authSigner.serviceInstanceId!==sharedSigner.serviceInstanceId||authSigner.keyId!==sharedSigner.keyId||sharedSigner.serviceInstanceId!==config.auth.serviceInstanceId)throw new Error('Shared signer/service pin mismatch');
 if(config.operatorWorldPins.some(pin=>pin.developerTrustAnchor.developerPublicKeyFingerprint===sharedSigner.keyId))throw new Error('World root and service signing key must be distinct');
 const app=await buildApp(config.auth,pool,authSigner);await clock.initialize(pool);
 const service=new WorldAuthorityService(config,new WorldAuthorityStorage(pool),sharedSigner,clock);
 await app.register(async child=>authorityRoutes(child,service));return app;
}
