'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'independent-final-review.json');
if (fs.existsSync(output)) throw new Error('Independent review evidence is immutable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const serverSources = ['server/src/RelayStorage.ts', 'server/src/RelayService.ts', 'server/src/RelayRoute.ts', 'server/src/buildRelayServer.ts'];
const sourceSnapshot = serverSources.concat(['src/presentation/RealCommitRelayAdapter.ts']).map(name => ({ path: name, sha256: sha(fs.readFileSync(path.join(root, name))) }));
const report = { phase: 'B2.5c-2c final independent read-only review evidence', recordedUtc: new Date().toISOString(), resultSource: 'Completed collaboration.list_agents statuses for /root/c2c_client and /root/c2c_prerequisite_review; no source/tool outputs rewritten.', reviewKind: 'Cross-review by the client implementer of server source and the server implementer of client source, distinct from their own implementation self-tests.', sourceSnapshot,
  serverReview: { reviewer: '/root/c2c_client', scope: serverSources, blockingFindings: [], completedResultVerbatim: '独立只读复审完成，**无新增阻塞缺陷**。\n\nP11引用重建、当前成员及 generation/floor/expiry/缺载检查、原字节SHA与签名核验均符合批准方案；格式错误不消费 nonce，迟到首次提交同事务过期处理。queue/receipt/ACK事务、单 clock组合、限额及长轮询锁边界保持。\n\n未修改源码、旧模块或执行额外广泛测试。' },
  clientReview: { reviewer: '/root/c2c_prerequisite_review', scope: ['src/presentation/RealCommitRelayAdapter.ts'], blockingFindings: [], completedResultExcerptVerbatim: '新客户端 adapter 只读复审：未发现 ACK 安全或范围冲突。', relatedCompletedServerEvidence: ['evidence/server-relay-run-05/results.json', 'evidence/server-relay-concurrency/results.json', 'evidence/relay-pull-metadata-inspection.json'] },
  pass: true, limits: 'This records the completed read-only review conclusions and delivered source hashes. It is not an independent runtime, formal security proof, new test rerun, production crypto/key delivery, hardware cache durability, dual-client replay or LAN deployment certification. Reviewer findings are limited to the authorized c-2c source/contract boundary.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ pass: report.pass, reviewKind: report.reviewKind, blockingFindings: 0, sourceFiles: sourceSnapshot.length }, null, 2));
