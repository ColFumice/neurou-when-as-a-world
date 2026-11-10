'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('../../../server/node_modules/pg');
const sha = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
async function main() {
  const privateRoot = path.join(__dirname, 'runtime/.local');
  const publicReport = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-real-http-results.json'), 'utf8'));
  const connection = JSON.parse(fs.readFileSync(path.join(privateRoot, 'connection-client.json'), 'utf8').replace(/^\uFEFF/, ''));
  const pool = new Pool({ connectionString: connection.databaseUrl });
  try {
    const world = publicReport.publicPin.worldId;
    const queue = (await pool.query('SELECT generation::text,position::text,envelope_sha256,admitted_at::text,retained_until::text,tombstone,envelope_bytes,receipt FROM relay_commit_queue WHERE world_id=$1', [world])).rows;
    const requests = (await pool.query("SELECT operation,result_wire FROM authority_requests WHERE world_id=$1 AND operation LIKE '/relay/%'", [world])).rows;
    const pullMemories = requests.filter(row => row.operation === '/relay/pull').map(row => {
      const text = row.result_wire.toString('utf8'), memory = JSON.parse(text);
      const proofNames = ['envelopeBytesBase64Url', 'ciphertextAndTagBase64Url', 'appendPermitReceipt', 'sequenceSegmentReceipt',
        'admissionReceipt', 'admissionClaim', 'authorKeyBindingReceipt', 'membershipEpochReceipt'];
      const containsPayload = proofNames.some(name => text.includes('"' + name + '"'));
      if (containsPayload) throw new Error('Forbidden pull payload copy in request memory');
      return { kind: memory.kind, schemaVersion: memory.schemaVersion, memorySha256: sha(row.result_wire),
        byteLength: row.result_wire.length, payloadKind: memory.receipt?.payload?.kind,
        referenceCount: memory.entries?.length, containsPayload: false };
    });
    const ack = (await pool.query('SELECT generation::text,position::text,confirmation_sha256,receipt FROM relay_acknowledgements WHERE world_id=$1', [world])).rows;
    const result = { pass: true, evidenceKind: 'RealPostgreSQLReadonlyAudit', database: 'c2c_client_relay', worldId: world,
      queue: queue.map(row => ({ generation: row.generation, position: row.position, envelopeSha256: row.envelope_sha256,
        rawBytesSha256: sha(row.envelope_bytes), rawByteLength: row.envelope_bytes.length,
        originalReceiptSha256: sha(row.receipt), admittedAt: row.admitted_at, retainedUntil: row.retained_until,
        tombstone: row.tombstone })),
      ack: ack.map(row => ({ generation: row.generation, position: row.position,
        confirmationSha256: row.confirmation_sha256, originalReceiptSha256: sha(row.receipt) })), pullMemories,
      noPlaintextOrKeysSelected: true, noHostPhysicalDurabilityClaim: true };
    fs.writeFileSync(path.join(__dirname, 'runtime-readonly-facts.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ pass: true, queueRows: queue.length, ackRows: ack.length, lightweightPullMemories: pullMemories.length }));
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Readonly runtime audit failed; private connection details suppressed.'); process.exitCode = 1; });
