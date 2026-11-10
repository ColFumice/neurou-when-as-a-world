'use strict';
// Creates an isolated c-2c harness from the accepted c-2b real-HTTP setup.
// It does not execute or modify the previous harness or any production source.
const fs = require('node:fs');
const path = require('node:path');
const sourcePath = path.resolve(__dirname, '../b2-5c-2b/client-real-http.cjs');
const helperSource = fs.readFileSync(path.join(__dirname, 'real-client-helper-source.cjs'), 'utf8');
const relayCases = fs.readFileSync(path.join(__dirname, 'real-client-relay-cases.txt'), 'utf8');
let source = fs.readFileSync(sourcePath, 'utf8');
function replaceOnce(before, after) {
  if (!source.includes(before)) throw new Error('Accepted harness template changed: ' + before.slice(0, 70));
  source = source.replace(before, after);
}
replaceOnce('// Production independent Builder + real HTTP/Fastify/PG17. No relay, group-key package or UI.',
  '// c-2c real HTTP/Fastify/PG17 + production Relay adapter; test-only native crypto and WAL host cache. No key-delivery/dual-replay/product UI.');
replaceOnce("'src/presentation/RealWorldAuthorityAdapter.ts', 'assets/scripts/SharedRelayPrototypeBuilder.ts'", "'src/presentation/RealWorldAuthorityAdapter.ts', 'src/presentation/RealCommitRelayAdapter.ts',\n  'src/director/SharedCommitValidator.ts', 'assets/scripts/SharedRelayPrototypeBuilder.ts'");
replaceOnce("{ buildSharedServer }", "{ buildRelayServer }");
replaceOnce("load('buildSharedServer')", "load('buildRelayServer')");
replaceOnce('app = await buildSharedServer(', 'app = await buildRelayServer(');
replaceOnce('const response = await fetch(url,', "if (send.relayOffline && url.includes('/relay/')) throw new Error('isolated-network-down');\n      const response = await fetch(url,");
replaceOnce('return response;\n    };', "if (send.dropSubmitReplyOnce && url.endsWith('/relay/submit')) { send.dropSubmitReplyOnce = false; throw new Error('isolated-response-lost-after-commit'); }\n      return response;\n    };");
replaceOnce("const successfulMethods = new Set();", "const successfulMethods = new Set();\n  const groupKey = crypto.randomBytes(32);\n  const relayEvidence = [];");
replaceOnce("keyCommitmentSha256: sha(crypto.randomBytes(32).toString('base64url'))", "keyCommitmentSha256: digestBytes(groupKey)");
replaceOnce('let admitted;', 'let admitted, admittedWire;');
replaceOnce("header, envelopeSha256: sha('public-digest-only-authority-client-admission')", "header, envelopeSha256: digestBytes(envelopeBytes)");
replaceOnce('const requestNonce = root.session.createRequestNonce(), claim =', `const envelopeBytes = await oracleEnvelope(header, {
        schemaVersion: 1, profile: 'ExternalSharedOnlineV1', worldId, mapId,
        contentManifestSha256: pin.contentManifestSha256, identity, authorDeviceId: header.authorDeviceId,
        authorDeviceGeneration: header.authorDeviceGeneration, segmentId: header.segmentId, permitId: header.permitId,
        membershipEpoch: 1, keyEpoch: 1, appendedAt: header.appendedAt,
        change: { changeClass: 'MonotonicReveal', commitClass: 'Monotonic', entityId: crypto.randomUUID(), revealed: true },
      }, groupKey, root.signer);
      const requestNonce = root.session.createRequestNonce(), claim =`);
replaceOnce("assert.equal(admitted.purpose, 'WorldCommitAdmission');", `admittedWire = { envelopeBytesBase64Url: envelopeBytes.toString('base64url'), appendPermitReceipt: permit,
        sequenceSegmentReceipt: segment, admissionReceipt: admitted, admissionClaim: signedClaim,
        authorKeyBindingReceipt: rootAgreement.authorKeyBinding, membershipEpochReceipt: epoch,
        rosterObserverAdmissionReceipt: null };
      assert.equal(admitted.purpose, 'WorldCommitAdmission');`);
replaceOnce("await check('logout rejects further production authority admission and registered signing'", relayCases + "\n    await check('logout rejects further production authority admission and registered signing'");
replaceOnce("kind: 'ProductionClientRealHttp'", "kind: 'ProductionRelayClientRealHttpWithIsolatedCryptoCache'");
replaceOnce("database: 'c2b_client_authority'", "database: 'c2c_client_relay'");
replaceOnce('noRelay: true', 'noRelay: false, relayEvidence, isolatedNativeCryptoOracle: true, isolatedWalHostCache: true, noProductionKeyDelivery: true, noDualClientReplay: true');
replaceOnce("function accepted(result, label)", helperSource + '\nfunction accepted(result, label)');
fs.writeFileSync(path.join(__dirname, 'client-real-http.cjs'), source);
console.log('Isolated real Relay client harness prepared from unchanged accepted setup.');

