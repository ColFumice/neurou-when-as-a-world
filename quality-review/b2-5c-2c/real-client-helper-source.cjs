// Inserted test-only host capabilities; no production crypto/key/cache implementation.
const digestBytes = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const { hkdf: oracleHkdf, cryptoPort: nativeCryptoPort } = require('../b2-5c-1/evidence/fixtures.cjs');
async function oracleEnvelope(header, body, groupKey, signer) {
  const dek = crypto.randomBytes(32), wrapNonce = crypto.randomBytes(12), bodyNonce = crypto.randomBytes(12);
  const wrap = oracleHkdf(groupKey, Buffer.from(sha(header.identity), 'hex'),
    Buffer.from('Neurou/relay-dek/v1\0' + canonical(header)), 32);
  function encrypt(key, iv, aad, plaintext) {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  }
  const wrappedCommitDataKey = { nonceBase64Url: wrapNonce.toString('base64url'),
    ciphertextAndTagBase64Url: encrypt(wrap, wrapNonce, 'Neurou/relay-wrap/v1\0' + canonical(header), dek).toString('base64url') };
  const unsigned = { header, wrappedCommitDataKey, nonceBase64Url: bodyNonce.toString('base64url'),
    ciphertextAndTagBase64Url: encrypt(dek, bodyNonce, 'Neurou/relay-body/v1\0' + canonical({ header, wrappedCommitDataKey }),
      Buffer.from(canonical(body))).toString('base64url') };
  const envelope = { ...unsigned, authorSignatureBase64Url: await signer.signEnvelope(unsigned) };
  dek.fill(0); wrap.fill(0);
  return Buffer.from(canonical(envelope));
}
/** Isolated test WAL: checksum + newline commits one complete record; fsync before success.
 * Windows power-loss durability is not certified here; platform backend remains c-2e.
 * Existing file is opened before cases; partial tail is ignored on restart, never ACKed.
 */
class IsolatedCipherWal {
  constructor(file) {
    this.file = file; this.candidates = new Map(); this.failPersist = false; this.failReadback = false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const fd = fs.openSync(file, 'a'); fs.fsyncSync(fd); fs.closeSync(fd);
    this.justPersisted = false;
  }
  key(identity) { return identity.authorAccountId + ':' + identity.authorSequence; }
  stage(wire) { this.candidates.set(this.key(wire.admissionReceipt.payload.identity), structuredClone(wire)); }
  durableRecords() {
    const result = new Map(), source = fs.readFileSync(this.file, 'utf8'), lines = source.split('\n');
    lines.pop();
    for (const line of lines) {
      const record = JSON.parse(line);
      assert.equal(sha(record.commit), record.commitSha256, 'durable WAL checksum');
      const key = this.key(record.commit.admissionReceipt.payload.identity);
      const prior = result.get(key);
      if (prior) assert.equal(canonical(prior), canonical(record.commit), 'same identity cannot overwrite other bytes');
      result.set(key, record.commit);
    }
    return result;
  }
  async read(identity) {
    if (this.justPersisted && this.failReadback) throw new Error('isolated-readback-failure');
    const value = this.durableRecords().get(this.key(identity)) || this.candidates.get(this.key(identity));
    return value ? structuredClone(value) : null;
  }
  async persistAndVerify(commit) {
    if (this.failPersist) throw new Error('isolated-fsync-failure');
    const line = Buffer.from(canonical({ commit, commitSha256: sha(commit) }) + '\n');
    const fd = fs.openSync(this.file, 'a');
    try { let offset = 0; while (offset < line.length) offset += fs.writeSync(fd, line, offset, line.length - offset); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    this.justPersisted = true;
    const saved = await this.read(commit.admissionReceipt.payload.identity);
    assert.equal(canonical(saved), canonical(commit));
    return { envelopeSha256: digestBytes(Buffer.from(saved.envelopeBytesBase64Url, 'base64url')) };
  }
}
