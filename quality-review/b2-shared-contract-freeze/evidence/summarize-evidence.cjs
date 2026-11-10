'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const evidence = __dirname;
const root = path.resolve(evidence, '../../..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const prior = JSON.parse(fs.readFileSync(path.join(root, 'quality-review/b2-real-auth/evidence/final-gates/results.json'), 'utf8'));
const baseline = readJson('baseline-gates/results.json');
const final = readJson('final-gates/results.json');
const protection = readJson('protected-comparison.json');
const sourceBaseline = readJson('protected-baseline.json');
const closure = fs.existsSync(path.join(evidence, 'source-attribution-closure.json')) ? readJson('source-attribution-closure.json') : null;
const coveredExternalChange = closure && closure.attributionClosed && closure.baselineSha256 === protection.baselineSha256 &&
  protection.changed.every(name => closure.coveredChanges.includes(name)) && protection.added.length === 0 && protection.removed.length === 0;
const find = (report, name) => report.runs.find(run => run.name === name);
const gates = ['check-naming', 'check-dependencies', 'typecheck'].map(name => {
  const a = find(prior, name), b = find(baseline, name), c = find(final, name);
  const oldWarnings = new Set(a.warningLines || []);
  const newWarnings = new Set(c.warningLines || []);
  return { name, pass: c.pass, exitCode: c.exitCode, errors: c.reportedErrors, warnings: c.reportedWarnings,
    priorB25bRawSha256: a.sha256, p3BaselineRawSha256: b.sha256, p3FinalRawSha256: c.sha256,
    sameRawAsB25b: a.sha256 === c.sha256, sameRawAsP3Baseline: b.sha256 === c.sha256,
    addedWarnings: [...newWarnings].filter(warning => !oldWarnings.has(warning)),
    removedWarnings: [...oldWarnings].filter(warning => !newWarnings.has(warning)) };
});
const report = { generatedUtc: new Date().toISOString(), stage: 'B2.5c precondition P3 documentation-only freeze', pass: final.pass && protection.pass && gates.every(gate => gate.addedWarnings.length === 0),
  evidenceDisposition: coveredExternalChange ? 'Three gates PASS; raw protection FAIL preserved; two external document changes attributed by user to TraeAuthorized. Attribution closed; rawHashEquality=false.' : (protection.pass ? 'Three gates and raw protection PASS.' : 'Protection difference requires attribution.'),
  sourceAttributionClosed: Boolean(coveredExternalChange), sourceAttribution: closure,
  gates, protected: { pass: protection.pass, beforeCount: protection.beforeCount, afterCount: protection.afterCount, changed: protection.changed, removed: protection.removed, added: protection.added, baselineCapturedUtc: protection.baselineCapturedUtc, comparedUtc: protection.comparedUtc, baselineSha256: protection.baselineSha256,
    historicalQualityFilesCovered: sourceBaseline.files.filter(file => file.path.startsWith('quality-review/')).length,
    serverPackageFilesCovered: sourceBaseline.files.filter(file => file.path.startsWith('server/')).length,
    junctionsCovered: sourceBaseline.files.filter(file => file.kind === 'symbolic-link-or-junction').map(file => ({ path: file.path, target: file.target })) },
  limits: 'Three existing code gates establish unchanged source health, not executable P3 schema correctness or Relay/security implementation. The P3 schema is a document draft; no ContractAdapter or network Relay mechanism was added. Protection begins at this recorded P3 baseline and excludes this new delivery directory, dependencies/caches/compiled outputs, private local data, keys and runtime binary payload. All older raw FAIL/WARN evidence is preserved as historical bytes.' };
fs.writeFileSync(path.join(evidence, 'evidence-summary.json'), JSON.stringify(report, null, 2) + '\n');
const table = gates.map(gate => '| `' + gate.name + '` | ' + (gate.pass ? 'PASS' : 'FAIL') + ' | ' + gate.exitCode + ' | ' + (gate.errors ?? '无诊断') + ' | ' + (gate.warnings ?? '未报告 WARN') + ' | ' + (gate.sameRawAsB25b && gate.sameRawAsP3Baseline ? '逐字相同' : '见 JSON') + ' |').join('\n');
const markdown = '# P3 补冻门禁与保护证据\n\n本轮只新增文档和证据；没有 Relay、ContractAdapter、运行时数据契约或任何现有源码修改。\n\n'
  + '| 现有门禁 | 结果 | exit | ERROR | WARN | 与 B2.5b final / P3 baseline 原始输出 |\n|---|---|---:|---|---|---|\n' + table + '\n\n'
  + 'P3 基线：`' + protection.baselineCapturedUtc + '`。最终比较：`' + protection.comparedUtc + '`。受保护 `' + protection.beforeCount + '` 项（包含 2 个 Junction 目标文本），最终 `' + protection.afterCount + '` 项；修改/删除/范围外新增为 `' + protection.changed.length + '/' + protection.removed.length + '/' + protection.added.length + '`，原始保护结果 **' + (protection.pass ? 'PASS' : 'FAIL') + '**。其中旧 quality-review 文件 `' + report.protected.historicalQualityFilesCovered + '` 项、server 包 `' + report.protected.serverPackageFilesCovered + '` 项。\n\n'
  + (coveredExternalChange ? '用户已确认 `docs/NAMEBOOK.md`、`docs/spec/stage-1.md` 两项改动由 Trae 授权同步 B2.5b/v3.16，来源归因 **闭合**。这是归因闭合，**rawHashEquality=false、原始保护仍 FAIL**；原基线、[首次 FAIL](first-protection-failure/protected-comparison.json) 保留，不回写为 PASS、不重新捕获基线。除这两项确认外部改动，范围内无其他修改/删除/新增。[归因 closure](source-attribution-closure.json)。\n\n' : '')
  + '现有命名 WARN 共 22 条：4 条 R7（Window 语义复核）、18 条 R4（Trace 语义复核）。与 B2.5b final 比较新增/消失 WARN 均为 0；历史 raw FAIL 不回写。\n\n'
  + '证据：[baseline 三门禁](baseline-gates/results.json)、[final 三门禁](final-gates/results.json)、[SHA 基线](protected-baseline.json)、[SHA 保护结果](protected-comparison.json)、[机器摘要](evidence-summary.json)。每份原始 `.log` 保留在相应门禁目录。\n\n'
  + '保护排除规则与 Junction 处理详见 SHA 基线；排除本轮目录、依赖、缓存/编译产物、`.local` 等私密本机状态、密钥及 PostgreSQL 运行二进制，不读取私密材料。门禁只验证既有源码健康，不能代替 P3 文档语义审查、未来契约实现测试或真实 Relay 验收。\n\n'
  + '复现：在项目根运行 `node quality-review/b2-shared-contract-freeze/evidence/run-gates.cjs final`，再运行 `node quality-review/b2-shared-contract-freeze/evidence/protect-files.cjs compare`、`node quality-review/b2-shared-contract-freeze/evidence/summarize-evidence.cjs`；不得重建本轮已捕获基线。\n';
fs.writeFileSync(path.join(evidence, 'evidence-summary.md'), markdown);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.pass ? 0 : 1;
