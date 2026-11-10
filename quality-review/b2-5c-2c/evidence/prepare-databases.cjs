'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('../../../server/node_modules/pg');
async function main() {
  const privateRoot = path.join(__dirname, 'runtime/.local');
  const connection = JSON.parse(fs.readFileSync(path.join(privateRoot, 'connection.json'), 'utf8').replace(/^\uFEFF/, ''));
  const admin = new Pool({ host: connection.host, port: connection.port, user: 'c2c_admin',
    password: connection.adminPassword, database: 'postgres' });
  const facts = [];
  try {
    for (const [database, filename] of [['c2c_client_relay', 'connection-client.json'],
      ['c2c_authority_regression', 'connection-authority-regression.json'], ['c2c_adapter_regression', 'connection-adapter-regression.json']]) {
      if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) {
        await admin.query('CREATE DATABASE ' + database + ' OWNER c2c_app');
      }
      const url = new URL(connection.databaseUrl); url.pathname = '/' + database;
      fs.writeFileSync(path.join(privateRoot, filename), JSON.stringify({ databaseUrl: url.href }, null, 2) + '\n');
      facts.push({ database, connectionFile: 'runtime/.local/' + filename, owner: 'c2c_app' });
    }
    const serverVersion = (await admin.query('SHOW server_version_num')).rows[0].server_version_num;
    const role = (await admin.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='c2c_app'")).rows[0];
    const result = { pass: true, serverVersion, listenAddress: '127.0.0.1', port: connection.port, role, facts };
    fs.writeFileSync(path.join(__dirname, 'runtime-readiness.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { await admin.end(); }
}
main().catch(() => { console.error('Private isolated database preparation failed; no connection secrets printed.'); process.exitCode = 1; });
