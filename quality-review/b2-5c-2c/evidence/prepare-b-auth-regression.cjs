'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const sourcePath = 'quality-review/b2-5c-2b/evidence/run-b-auth-regression.cjs';
const output = path.join(__dirname, 'run-b-auth-regression.cjs');
if (fs.existsSync(output)) throw new Error('Derived historical wrapper is immutable.');
let copy = fs.readFileSync(path.join(root, sourcePath), 'utf8');
function replaceOne(oldText, newText) { if (copy.split(oldText).length !== 2) throw new Error('Historical wrapper anchor is not unique.'); copy = copy.replace(oldText, newText); }
replaceOne("path.join(__dirname, 'protected-baseline.json')", "path.join(root, 'quality-review/b2-5c-2b/evidence/protected-baseline.json')");
replaceOne("parsedUrl.pathname !== '/c2b_history_auth'", "parsedUrl.pathname !== '/c2c_history_auth'");
replaceOne("parsedUrl.port !== '55437'", "parsedUrl.port !== '55438'");
copy = copy.replaceAll('B2.5c-2b', 'B2.5c-2c').replaceAll('new isolated c-2b history DB', 'new isolated c-2c history DB');
fs.writeFileSync(output, copy);
console.log(JSON.stringify({ source: sourcePath, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, sourcePath))).digest('hex'), destination: 'evidence/run-b-auth-regression.cjs', copySha256: crypto.createHash('sha256').update(copy).digest('hex'), requires: 'Private c-2c runtime connection.json.historyDatabaseUrl at exact 127.0.0.1:55438/c2c_history_auth; no PG startup is performed by this preparation.', oldBSourceScope: 'Accepted c-2b before baseline server src/test TS files, not the expanded c-2c baseline.' }, null, 2));
