'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const evidence = __dirname;
const root = path.resolve(evidence, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = read('baseline-gates/results.json');
const final = read('final-gates/results.json');
const protection = read('protected-comparison.json');
const files = read('changed-files.json');
const closure = read('source-attribution-closure.json');
const erasure = read('intent-type-erasure.json');
const contractTests = read('test-runs/final-verified/results.json');
const newNames = read('new-names.json');
const acceptanceIndex = read('acceptance-index.json');
const artifactLinks = read('artifact-links.json');
const prior = JSON.parse(fs.readFileSync(path.join(root, 'quality-review/b2-shared-contract-freeze/evidence/final-gates/results.json'), 'utf8'));
const find = (report, name) => report.runs.find(run => run.name === name);
const gates = ['check-naming', 'check-dependencies', 'typecheck'].map(name => {
  const a = find(prior, name), b = find(baseline, name), c = find(final, name);
  const oldWarnings = new Set(b.warningLines || []), newWarnings = new Set(c.warningLines || []);
  return { name, pass: c.pass, exitCode: c.exitCode, errors: c.reportedErrors, warnings: c.reportedWarnings,
    p3FinalRawSha256: a.sha256, baselineRawSha256: b.sha256, finalRawSha256: c.sha256,
    addedWarnings: [...newWarnings].filter(warning => !oldWarnings.has(warning)), removedWarnings: [...oldWarnings].filter(warning => !newWarnings.has(warning)),
    rawMatchesP3: a.sha256 === c.sha256, rawMatchesBaseline: b.sha256 === c.sha256 };
});
const production = files.files.map(file => {
  const bytes = fs.readFileSync(path.join(root, file.path));
  return { ...file, stillMatchesExportedDiff: hash(bytes) === file.sha256 };
});
const warningSemantics = {
  TraceTouchChange: '普通痕的触及变化数据契约，不是日志',
  TraceTouchAggregate: '普通痕的触及聚合强度数据，不是日志',
  traceTouchId: '普通痕触及目标的稳定 ID，不是日志',
  normalTraceEntityId: '普通痕地图实体稳定 ID，不是日志',
  normalTrace: '普通痕定义与触及目标关联，不是日志',
  traceTouches: '普通痕触及聚合状态集合，不是日志',
};
const addedWarningSemanticReview = gates.flatMap(gate => gate.addedWarnings.map(rawWarning => {
  const identifier = rawWarning.match(/—— 命中: ([^（]+)（/)?.[1] || null;
  return { gate: gate.name, rawWarning, identifier, semantic: warningSemantics[identifier] || '需要新的人工语义复核',
    acceptedDomainSemantics: !!warningSemantics[identifier], ruleUnchanged: true };
}));
const contractSourceStillMatches = contractTests.sources.every(source => hash(fs.readFileSync(path.join(root, source.path))) === source.sha256);
const erasureSourceStillMatches = hash(fs.readFileSync(path.join(root, 'src/director/IntentPort.ts'))) === erasure.afterSourceSha256;
const attributionHashesStillMatch = closure.changes.every(change => hash(fs.readFileSync(path.join(root, change.path))) === change.attributedAfterSha256);
const baselineStillMatches = hash(fs.readFileSync(path.join(evidence, 'protected-baseline.json'))) === closure.baselineSha256;
const rawComparisonStillMatches = hash(fs.readFileSync(path.join(evidence, 'protected-comparison.json'))) === closure.rawComparisonSha256;
const namesSourceStillMatches = newNames.files.every(file => hash(fs.readFileSync(path.join(root, file.path))) === file.sha256);
const acceptanceIndexStillMatches = acceptanceIndex.sourceProfilePass && acceptanceIndex.cases.length === 154
  && acceptanceIndex.finalRawSha256 === contractTests.testRun.rawSha256
  && acceptanceIndex.pureProfiles.every(file => hash(fs.readFileSync(path.join(root, file.path))) === file.sha256);
const supplementaryArtifacts = ['evidence/new-names.json', 'namebook-v3.18-appendix-proposal.md',
  'evidence/acceptance-index.json', 'evidence/acceptance-index.md', 'evidence/artifact-links.json',
  'evidence/contract-test-history.md',
  'verdicts-411-425.md', 'contracts-and-acceptance.md', 'stages-and-open-items.md', 'independent-review.md', 'delivery-report.md'].map(name => {
  const bytes = fs.readFileSync(path.join(evidence, '..', name));
  return { path: 'quality-review/b2-5c-1/' + name, bytes: bytes.length, sha256: hash(bytes) };
});
const reviewedAcceptancePass = final.pass && contractTests.pass && erasure.pass && closure.reviewedClosurePass
  && contractSourceStillMatches && erasureSourceStillMatches && attributionHashesStillMatch && baselineStillMatches && rawComparisonStillMatches
  && namesSourceStillMatches && acceptanceIndexStillMatches && artifactLinks.pass
  && production.every(file => file.stillMatchesExportedDiff) && addedWarningSemanticReview.every(review => review.acceptedDomainSemantics);
const report = { generatedUtc: new Date().toISOString(), stage: 'B2.5c-1 shared contract implementation',
  threeGatesPass: final.pass, rawProtectionPass: protection.pass, rawHashEquality: false,
  reviewedClosurePass: closure.reviewedClosurePass, attributionPending: closure.attributionPending, reviewedAcceptancePass,
  gates, addedWarningSemanticReview, protected: protection, sourceAttributionClosure: closure, production, codeDiffSha256: files.codeDiffSha256,
  contractTests: { resultPath: 'test-runs/final-verified/results.json', counts: contractTests.counts, pass: contractTests.pass,
    noDOM: contractTests.isolatedCompiler.noDOM, networkAttempts: contractTests.networkAttempts, noNetwork: contractTests.noNetwork,
    sourceStable: contractTests.sourceStable, testInputsStable: contractTests.testInputsStable, rawSha256: contractTests.testRun.rawSha256 },
  intentErasure: erasure, supplementaryArtifacts,
  acceptanceIndex: { sourceProfilePass: acceptanceIndex.sourceProfilePass, cases: acceptanceIndex.cases.length, finalRawSha256: acceptanceIndex.finalRawSha256 },
  artifactLinks: { pass: artifactLinks.pass, markdownFileCount: artifactLinks.markdownFileCount, localLinkCount: artifactLinks.localLinkCount, missingLinks: artifactLinks.missingLinks },
  finalBindings: { contractSourceStillMatches, erasureSourceStillMatches, attributionHashesStillMatch, baselineStillMatches, rawComparisonStillMatches, namesSourceStillMatches, acceptanceIndexStillMatches },
  scope: 'Three original gates and 154 isolated tests pass. Raw protected SHA comparison remains FAIL; the new human source confirmation closes exactly two external Trae docs hashes without rewriting the baseline or failure. Exactly five new director files plus type-only IntentPort append are exported. No Relay/authority endpoint, network integration, P4 encryption storage or P5 native/offline implementation is implied. Added WARN domain semantics are explicitly reviewed without modifying gates or allowlists.' };
fs.writeFileSync(path.join(evidence, 'evidence-summary.json'), JSON.stringify(report, null, 2) + '\n');
const rows = gates.map(gate => '| `' + gate.name + '` | ' + (gate.pass ? 'PASS' : 'FAIL') + ' | ' + gate.exitCode + ' | ' + (gate.errors ?? '无诊断') + ' | ' + (gate.warnings ?? '未报告') + ' | ' + gate.addedWarnings.length + ' / ' + gate.removedWarnings.length + ' |').join('\n');
const markdown = '# B2.5c-1 门禁、保护与代码差异证据\n\n'
  + '| 既有门禁 | 结果 | exit | ERROR | WARN | WARN 新增 / 消失 |\n|---|---|---:|---|---|---|\n' + rows + '\n\n'
  + '原有三条门禁脚本、规则和白名单未改。原始输出与 SHA、逐条 WARN 差异保留在 [baseline](baseline-gates/results.json)、[final](final-gates/results.json) 和 [机器摘要](evidence-summary.json)。baseline 命名 WARN 为 22 条；新增 WARN 须单列语义复核，不可把启发式告警当新增契约失败，也不可写成零增量。\n\n'
  + '保护基线 `' + protection.baselineCapturedUtc + '`，最终比较 `' + protection.comparedUtc + '`：' + protection.beforeCount + '→' + protection.afterCount + ' 项。原范围修改 ' + protection.changed.length + '、新增 ' + protection.added.length + '、删除 ' + protection.removed.length + '；未授权修改/新增 ' + protection.unauthorizedChanged.length + '/' + protection.unauthorizedAdded.length + '，保护 **' + (protection.pass ? 'PASS' : 'FAIL') + '**。\n\n'
  + '本次 raw **FAIL** 保留，`rawHashEquality=false`。[独立来源闭合](source-attribution-closure.md) 按用户本次“确认：Trae 授权同步 v3.17/P3”逐路径/逐 hash 归因两项 docs 修改；`reviewedClosurePass=true`、`attributionPending=false`，其余保护范围无异常。这不是 docs 未变或 raw PASS。\n\n'
  + 'IntentPort 原始 `' + fs.statSync(path.join(evidence, 'IntentPort.before.ts')).size + '` 字节前缀保全：`' + protection.intentOriginalPrefixPreserved + '`；type-only 纯追加：`' + protection.intentTypeOnlyAppend + '`；尾部新增 `' + protection.intentTailBytes + '` 字节。旧 P3、B2.5b、docs/名库/参照、archive/core/server 文件均在保护范围，排除依赖、缓存/编译产物、私密本机状态/密钥与运行二进制；本轮不覆盖写入既有交付。\n\n'
  + '[保护基线](protected-baseline.json)、[保护比较](protected-comparison.json)、[修改文件与 SHA](changed-files.json)、[完整代码 diff](code.diff)。代码差异仅含准许的五个新增 director 文件以及 IntentPort type-only 导出尾部。\n\n'
  + '最终 [隔离契约测试](test-runs/final-verified/results.json) **154/154 PASS**：validator 47、codec 76、replay 31，零 skip/cancel/todo。严格隔离编译只使用 ES2020，`types=[]`，零 DOM/cc 声明；测试与生产输入前后 SHA 稳定；4 个进程网络尝试均为 0。真实 Node 内存 ES256/AES-GCM/HKDF-SHA256 后端，不落私钥或群密钥，不接 HTTP/DB。零网络是被测执行路径证据，不是 OS sandbox。\n\n'
  + '[IntentPort 编译擦除证据](intent-type-erasure.json)：前缀 47,617 字节完整保全，type-only 尾部 1,425 字节；ES2015 无注释运行时代码前后完全相同（17,548 字节），没有 SharedCommitContracts 运行时依赖。\n\n'
  + '命名 WARN 22→45，新增 23 条逐条语义在机器摘要中核对：均为 `TraceTouchChange` / `TraceTouchAggregate` / `traceTouchId` / `normalTraceEntityId` / `normalTrace` / `traceTouches` 的痕域契约字段，非日志；不改规则或白名单、不写成零增量。\n\n'
  + '新增名称的 TypeScript AST 全量清单及五源码 SHA 见 [new-names.json](new-names.json)；[名库 v3.18 附录提案](../namebook-v3.18-appendix-proposal.md) 交 Trae 落盘，两份 artifact 的 SHA 收入机器摘要。本轮只生成附录提案。\n\n'
  + '[154 项验收索引](acceptance-index.md) 与 [机械索引](acceptance-index.json) 按最终 TAP 逐项对应；五源码 AST 纯逻辑 profile 与测试 SHA 一致。[本轮交付链接检查](artifact-links.json) 无缺失本地目标。正式裁定、验收说明、待裁定清单、独立复审及交付报告 SHA 也收进机器摘要。\n\n'
  + '三门禁与 SHA 来源复核不代替实际产品和真实服务验收。本轮不宣称真实 Relay、成员产品机制、P4/P5 或完整 FileCarry 已实现。历史所有 FAIL/TAP/JUnit 结果保留，正式验收仅用 final-verified。\n';
fs.writeFileSync(path.join(evidence, 'evidence-summary.md'), markdown);
console.log(JSON.stringify({ generatedUtc: report.generatedUtc, reviewedAcceptancePass, threeGatesPass: report.threeGatesPass,
  rawProtectionPass: report.rawProtectionPass, reviewedClosurePass: report.reviewedClosurePass, attributionPending: report.attributionPending,
  gates: gates.map(gate => ({ name: gate.name, pass: gate.pass, errors: gate.errors, warnings: gate.warnings, addedWarnings: gate.addedWarnings.length, removedWarnings: gate.removedWarnings.length })),
  contractTests: report.contractTests, finalBindings: report.finalBindings, sourceFileCount: files.files.length,
  intentOriginalPrefixPreserved: protection.intentOriginalPrefixPreserved, intentTypeOnlyAppend: protection.intentTypeOnlyAppend, codeDiffSha256: files.codeDiffSha256 }, null, 2));
process.exitCode = reviewedAcceptancePass ? 0 : 1;
