'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const output = path.join(__dirname, 'source-attribution-closure.json');
if (fs.existsSync(output)) throw new Error('Attribution closure is immutable; a new change needs a new event.');
const baseline = read('protected-baseline.json');
const first = read('protected-first-failure.json');
const detail = read('protected-first-failure-detail.json');
const recheck = read('protected-closure-recheck.json');
const attributedPaths = ['docs/NAMEBOOK.md', 'docs/spec/stage-1.md'];
const exactSet = (actual, expected) => JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
if (first.pass || recheck.pass) throw new Error('Keep the actual raw SHA failures.');
if (!exactSet(first.unauthorizedChanged, attributedPaths) || !exactSet(recheck.unauthorizedChanged, attributedPaths)
  || recheck.unauthorizedAdded.length || recheck.removed.length
  || !exactSet(recheck.added, baseline.allowedProduction)
  || !recheck.intentOriginalPrefixPreserved || !recheck.intentTypeOnlyAppend) throw new Error('New or unresolved protection event.');
const baselineSha256 = hash(fs.readFileSync(path.join(__dirname, 'protected-baseline.json')));
if (first.baselineSha256 !== baselineSha256 || recheck.baselineSha256 !== baselineSha256) throw new Error('Baseline binding mismatch.');
const changes = detail.changes.map(record => {
  const original = baseline.files.find(item => item.path === record.path);
  const currentBytes = fs.readFileSync(path.join(root, record.path));
  const currentSha256 = hash(currentBytes);
  if (!original || original.sha256 !== record.before.sha256 || currentSha256 !== record.after.sha256
    || currentBytes.length !== record.after.bytes) throw new Error('A newly changed hash needs separate attribution: ' + record.path);
  return { path: record.path, beforeBytes: original.bytes, beforeSha256: original.sha256,
    attributedAfterBytes: currentBytes.length, attributedAfterSha256: currentSha256,
    rawHashEquality: original.sha256 === currentSha256, source: 'Trae', userConfirmed: true };
});
const questionText = '本轮 c-1 SHA 基线后，docs/NAMEBOOK.md 与 docs/spec/stage-1.md 再次被外部更新，名库内容包含 v3.17/P3 同步。请确认这次两项修改是否同样由 Trae 按“交 Trae 落盘”授权完成？此次归因独立于上轮确认；原始 SHA FAIL 将保留。';
const exactUserResponse = '确认：Trae 授权同步 v3.17/P3';
const report = { stage: 'B2.5c-1 source attribution', generatedUtc: new Date().toISOString(), baselineCapturedUtc: baseline.capturedUtc,
  baselineSha256, firstFailureSha256: hash(fs.readFileSync(path.join(__dirname, 'protected-first-failure.json'))),
  rawComparisonSha256: hash(fs.readFileSync(path.join(__dirname, 'protected-comparison.json'))),
  recheckSha256: hash(fs.readFileSync(path.join(__dirname, 'protected-closure-recheck.json'))), recheckedUtc: recheck.comparedUtc,
  questionItemId: ['request_user_input_async', 'call_3ceb5cdebb034f7dafc0ea72c3d11894', 0], questionText, exactUserResponse,
  responseEvidence: 'Root agent relayed the new human response and its exact asynchronous question item; this is distinct from the prior P3 confirmation.',
  changes, rawProtectionPass: false, rawHashEquality: false, reviewedClosurePass: true, attributionPending: false,
  remainingUnauthorizedChanged: [], remainingUnauthorizedAdded: [], removed: [],
  authorizedNewSourceFiles: recheck.authorizedAdded, authorizedModified: 'src/director/IntentPort.ts',
  intentOriginalPrefixPreserved: true, intentTypeOnlyAppend: true, intentTailBytes: recheck.intentTailBytes,
  limits: recheck.limits,
  scope: 'Two exact path/hash changes were externally synchronized by Trae under the new user confirmation. Baseline and raw FAIL records are unchanged; the new reviewed closure does not claim unchanged docs and does not cover future mutations. All other protected changes are exactly the authorized five additions plus original-byte-prefix-preserved type-only IntentPort append.' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const markdown = '# B2.5c-1 外部来源归因闭合\n\n'
  + '本次独立问题：' + questionText + '\n\n'
  + '用户本次回复逐字：**' + exactUserResponse + '**。问题项 `' + report.questionItemId.join(' / ') + '`，不沿用旧 P3 回复。\n\n'
  + 'c-1 原基线 `' + baseline.capturedUtc + '` 与 SHA `' + baselineSha256 + '` 保留。第一次与复核的 raw protection 均为 **FAIL**，`rawHashEquality=false`；归因复核为 **闭合**，`attributionPending=false`。\n\n'
  + '| 文件 | 基线 SHA-256 | 本次归因 SHA-256 | 来源 |\n|---|---|---|---|\n'
  + changes.map(change => '| `' + change.path + '` | `' + change.beforeSha256 + '` | `' + change.attributedAfterSha256 + '` | Trae，用户本次确认 |').join('\n')
  + '\n\n原始 [first FAIL](protected-first-failure.json)、[首次判定](protected-comparison.json)、[独立复核](protected-closure-recheck.json) 均保留。其余保护范围无非授权变化、无删除、无额外新增；仅五个允许的新 director 源文件及 IntentPort type-only 尾部追加。不能将此结论表述为 docs 未变或 raw PASS；后续任何新 hash 变化需要新的来源事件。\n';
fs.writeFileSync(path.join(__dirname, 'source-attribution-closure.md'), markdown);
console.log(JSON.stringify({ reviewedClosurePass: report.reviewedClosurePass, rawProtectionPass: report.rawProtectionPass,
  attributionPending: report.attributionPending, changes }, null, 2));
