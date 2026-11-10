import { createPool } from './db.js';
import { environmentConfig } from './config.js';
import { SharedMigrationRunner } from './SharedMigrationRunner.js';
if (process.argv[2] !== 'migrate')
    throw new Error('Only shared migrate command supported');
const config = environmentConfig();
const pool = createPool(config.databaseUrl);
try {
    await new SharedMigrationRunner().migrate(pool);
    process.stdout.write('{"schemaVersion":2,"migration":"SharedAuthority"}\n');
}
finally {
    await pool.end();
}
