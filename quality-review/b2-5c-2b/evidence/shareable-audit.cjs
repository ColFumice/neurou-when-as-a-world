'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const evidence = __dirname, delivery = path.resolve(evidence, '..');
const outputName = process.argv[2] || 'shareable-audit.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use an evidence JSON basename.');
const outputPath = path.join(evidence, outputName);
if (fs.existsSync(outputPath)) throw new Error('Prior shareable audit is immutable.');
const connection = JSON.parse(fs.readFileSync(path.join(evidence, 'runtime/.local/connection.json'), 'utf8').replace(/^\uFEFF/, ''));
const knownPrivateValues = [connection.databaseUrl, connection.historyDatabaseUrl, connection.adminPassword, new URL(connection.databaseUrl).password, new URL(connection.historyDatabaseUrl).password].filter(value => typeof value === 'string' && value.length >= 16);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const excludedDirectories = ['.local', 'node_modules'];
function walk(directory) {
  const checks = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { if (!excludedDirectories.includes(entry.name)) checks.push(...walk(absolute)); }
    else if (entry.isFile() && !/\.(?:pem|key|p12|pfx|exe|dll|zip|gz|png|jpg|pdf)$/i.test(entry.name)) {
      const bytes = fs.readFileSync(absolute), text = bytes.toString('utf8');
      const knownCredentialValueFound = knownPrivateValues.some(value => text.includes(value));
      const privatePemBlockFound = /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/.test(text);
      checks.push({ path: path.relative(delivery, absolute).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes), knownCredentialValueFound, privatePemBlockFound });
    }
  }
  return checks;
}
const checks = walk(delivery), pass = checks.every(check => !check.knownCredentialValueFound && !check.privatePemBlockFound);
const result = { phase: 'B2.5c-2b shareable known-credential audit', auditedUtc: new Date().toISOString(), pass, fileCount: checks.length, checks,
  excludedDirectories, credentialValuesRecorded: false,
  limits: 'Checks known local PG URLs/passwords and complete private PEM blocks in non-private c-2b delivery text. Ephemeral auth/device/ECDH/root/group secrets remain memory-only in harnesses and are not independently enumerated by this scan. Public pins/JWKs/signatures/digests are permitted evidence. This is a scoped leak check, not arbitrary-secret detection.' };
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ pass, fileCount: checks.length, failures: checks.filter(check => check.knownCredentialValueFound || check.privatePemBlockFound).map(check => check.path) }, null, 2)); process.exitCode = pass ? 0 : 1;
