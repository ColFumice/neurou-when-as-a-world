import { createPool } from './db.js';
import { loadSigner } from './crypto.js';
import { SharedMigrationRunner } from './SharedMigrationRunner.js';
import { SharedReceiptSigner } from './SharedReceiptSigner.js';
import { sharedEnvironmentConfig } from './SharedServerConfig.js';
import { buildSharedServer } from './buildSharedServer.js';
const config = await sharedEnvironmentConfig();
const pool = createPool(config.auth.databaseUrl);
await new SharedMigrationRunner().migrate(pool);
const authSigner = await loadSigner(config.auth.serviceInstanceId, config.auth.signingKeyPath);
const sharedSigner = await SharedReceiptSigner.load(config.auth.serviceInstanceId, config.auth.signingKeyPath);
const app = await buildSharedServer(config, pool, authSigner, sharedSigner);
await app.listen({ host: config.auth.host, port: config.auth.port });
process.stdout.write('ExternalService shared authority listening on loopback\n');
let closing = false;
async function close() { if (closing)
    return; closing = true; await app.close(); await pool.end(); }
process.once('SIGTERM', () => { void close(); });
process.once('SIGINT', () => { void close(); });
