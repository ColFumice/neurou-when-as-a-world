'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phase = path.resolve(__dirname, '..');
const root = path.resolve(__dirname, '../../..');
const outputName = process.argv[2] || 'shareable-material-final.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use JSON basename.');
const output = path.join(__dirname, outputName);
if (fs.existsSync(output)) throw new Error('Material scan records are immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const knownSecrets = new Set();
let privateConnectionFilesRead = 0;
function addSecret(value) { if (typeof value === 'string' && value.length >= 16) knownSecrets.add(value); }
function readConnection(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); privateConnectionFilesRead++;
  for (const [name, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue;
    if (/^(?:databaseUrl|historyDatabaseUrl|adminPassword|password|csrfToken|accessToken|refreshToken|privateKeyPem|signingKeyPem|accessCodePepper)$/i.test(name)) addSecret(value);
    if (/databaseUrl$/i.test(name)) { const url = new URL(value); addSecret(url.password); addSecret(decodeURIComponent(url.password)); }
  }
}
for (const directory of [path.join(__dirname, 'runtime/.local'), path.join(__dirname, 'history-b-auth/implementation/client/.local'), path.join(root, 'quality-review/b2-5c-2b/evidence/runtime/.local')]) {
  if (!fs.existsSync(directory)) continue;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) if (item.isFile() && /^connection[^/]*\.json$/i.test(item.name)) readConnection(path.join(directory, item.name));
}
const exclusions = { directoryNames: ['.local', '.secret', 'secrets', 'node_modules'], binaryExtensions: ['pem', 'key', 'p12', 'pfx', 'exe', 'dll', 'zip', 'gz', 'png', 'jpg', 'pdf'], symlinkTargetsNotTraversed: true, self: 'evidence/' + outputName };
function privateJwk(value) {
  if (value === null || typeof value !== 'object') return false;
  if (!Array.isArray(value) && (value.kty === 'EC' || value.kty === 'RSA' || value.kty === 'OKP') && typeof value.d === 'string') return true;
  return Object.values(value).some(privateJwk);
}
function walk(directory, prefix = '') {
  const checks = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + item.name : item.name;
    if (name === exclusions.self || item.isSymbolicLink()) continue;
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) { if (!exclusions.directoryNames.includes(item.name)) checks.push(...walk(absolute, name)); }
    else if (item.isFile()) {
      if (item.name === '.env' || item.name.startsWith('.env.') || /\.(?:pem|key|p12|pfx|exe|dll|zip|gz|png|jpg|pdf)$/i.test(item.name)) continue;
      const bytes = fs.readFileSync(absolute), text = bytes.toString('utf8');
      const knownCredentialValueFound = [...knownSecrets].some(value => text.includes(value));
      const privatePemBlockFound = /-----BEGIN (?:EC |RSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA |ENCRYPTED )?PRIVATE KEY-----/.test(text);
      let privateJwkFound = false;
      if (item.name.endsWith('.json')) { try { privateJwkFound = privateJwk(JSON.parse(text.replace(/^\uFEFF/, ''))); } catch (_) { /* JSON parse validity is checked by its owning evidence tool. */ } }
      checks.push({ path: name, bytes: bytes.length, sha256: sha(bytes), knownCredentialValueFound, privatePemBlockFound, privateJwkFound });
    }
  }
  return checks.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
const checks = walk(phase), failures = checks.filter(item => item.knownCredentialValueFound || item.privatePemBlockFound || item.privateJwkFound);
const result = { phase: 'B2.5c-2c shareable credential/material audit', auditedUtc: new Date().toISOString(), pass: failures.length === 0, fileCount: checks.length, checks, privateConnectionFilesRead, knownSecretValueCount: knownSecrets.size, credentialValuesRecorded: false, exclusions,
  limits: 'Checks known local c-2c and accepted c-2b PG URLs/passwords/tokens from explicitly read private connection files, complete private PEM blocks, and parsed private JWK material in non-private delivery JSON/text. No private value or key is printed or stored in this report. Ephemeral account/session/ECDH/root/group secrets are memory-only in harnesses and not independently enumerable by this scan. Public JWK/pins/signatures/ciphertexts/digests are permitted evidence. This is a scoped material check, not arbitrary-secret detection or a full-machine audit.' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ pass: result.pass, fileCount: checks.length, privateConnectionFilesRead, credentialValuesRecorded: false, failures: failures.map(item => item.path) }, null, 2)); process.exitCode = result.pass ? 0 : 1;
