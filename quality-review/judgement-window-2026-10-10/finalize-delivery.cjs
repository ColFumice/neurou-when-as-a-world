const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const assert = (value, message) => { if (!value) throw new Error(message); };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preview = read('creator-preview-results.json');
const compilation = read('creator-compilation.json');
const gates = read('gate-results.json');
const audit = read('change-audit.json');
const logic = read('logic-regression-summary.json');
const boundaries = read('window-boundaries-results.json');
const changed = read('changed-files.json');
const protectedHashes = read('protected-hashes.json');
const oldEvidence = read('prior-evidence-integrity.json');
assert(gates.gates.every(g => g.pass && g.exitCode === 0), 'Gate failed');
assert(logic.allPassed && logic.runs.every(r => r.exitCode === 0 && r.failed === 0), 'Logic regression failed');
assert(boundaries.failed === 0 && audit.pass && audit.judgementLogicUnchanged, 'Boundary/change audit failed');
assert(oldEvidence.allPreserved, 'Prior regression scripts changed');
assert(preview.pass && preview.resolutions.length === 2, 'Both preview resolutions must pass');
assert(preview.rendererErrors.length === 0 && preview.runtimeErrors.length === 0, 'Preview runtime errors');
assert(compilation.entries.every(e => e.servedEqualsCompilerOutput && e.sourceMapMatchesFinalSource), 'Stale compilation');
assert(preview.compilation.unchangedThroughEvidenceCapture, 'Compilation changed during capture');
for (const file of ['constants/index.ts', 'src/trace/RhythmStrike.ts', 'src/trace/PuzzleChain.ts', 'src/chart/ChartScore.ts', 'assets/scripts/SceneBuilder.ts']) {
  assert(compilation.entries.some(e => e.source === file), 'Changed source missing from preview verification: ' + file);
}
for (const r of preview.resolutions) {
  for (const [name, expected] of Object.entries({ RHYTHM_STRIKE_WINDOW_MS:100, PERFECT_WINDOW_MS:100, GOOD_WINDOW_MS:200, SYNC_TOLERANCE_MS:30, HEAD_WINDOW_MS:1000 })) assert(r.runtimeConstants[name] === expected, 'Loaded runtime constant differs: ' + name);
  assert(r.pass && r.fullChain.pass && r.fullChain.completed.completed, 'Incomplete chain');
  assert(r.intentionalMissTrial.pass && r.intentionalMissTrial.completed.missCount === 1, 'Intentional outside-window trial failed');
  assert(r.intentionalMissTrial.syncSummary.sampleCount > 0 && r.intentionalMissTrial.syncSummary.maxRawPresentedErrorMs <= 30, 'Intentional trial AC19 exceeds 30ms');
  assert(r.fullChain.beats.every(b => b.deviationMs > 50 && b.deviationMs <= 100), 'Real T6 widened-window admission was not demonstrated');
  assert(r.fullChain.ledger.length === 2, 'Ledger completion count differs');
  assert(r.fullChain.syncSummary.sampleCount > 0 && r.fullChain.syncSummary.maxRawPresentedErrorMs <= 30, 'AC19 exceeds 30ms');
}
for (const file of changed) assert(hash(path.join(root, file.path)) === file.sha256, 'Source changed after audit: ' + file.path);
for (const entry of compilation.entries) assert(hash(path.join(root, entry.source)) === entry.sourceSha256, 'Source changed after preview: ' + entry.source);
for (const [file, expected] of Object.entries(protectedHashes)) assert(hash(path.join(root, file)) === expected, 'Protected file changed: ' + file);
const prefix = root.replace(/\\/g, '/') + '/quality-review/judgement-window-2026-10-10/';
const link = (file, label = file) => `[${label}](${prefix}${file})`;
const ac18 = boundaries.checks.find(c => c.name.includes('AC18'));
assert(ac18.pass && ac18.evidence.identicalInputAndFeedback, 'AC18 failed');
const total = logic.runs.reduce((sum, run) => sum + run.passed, 0);
const screenshotCount = preview.resolutions.reduce((sum, r) => sum + r.evidence.length, 0);
const performanceTable = [
  '| 分辨率 | T6实拍 | T7判定 | 得分 | 完结时间 | 账本 | 音画样本 | 最大原始音画偏差 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...preview.resolutions.map(r => {
    const c = r.fullChain.completed, s = r.fullChain.syncSummary;
    return `| ${r.resolution} | ${r.fullChain.beats.length} | P${c.perfectCount}/G${c.goodCount}/M${c.missCount} | ${c.totalScore} | ${c.finishedAtMs}ms | ${r.fullChain.ledger.length} | ${s.sampleCount} | ${s.maxRawPresentedErrorMs.toFixed(3)}ms |`;
  }),
];
const pictureRows = preview.resolutions.flatMap(r => r.evidence.map(e => `| ${r.resolution} | ${e.name} | ${link(e.file, '原图')} | ${e.imageSize.width}×${e.imageSize.height} |`));
fs.writeFileSync(path.join(__dirname, '截图索引.md'), [
  '# 新判定窗口 Cocos 实测截图', '',
  `真实Creator ${preview.creator}预览，${screenshotCount}张本轮PNG。每张图片与实际viewport/Canvas尺寸对应；没有把旧截图拉伸用作第二档。完整过程快照见${link('creator-preview-results.json')}。`, '',
  '| 分辨率 | 阶段 | 截图 | 原始PNG尺寸 |', '| --- | --- | --- | --- |', ...pictureRows, '',
].join('\n'));
fs.writeFileSync(path.join(__dirname, '修改文件清单.md'), [
  '# 修改文件清单', '',
  '本轮仅5个生产文件。仓库无.git；完整implementation.diff来自本轮改动前逐文件快照。', '',
  '| 文件 | 差异 |', '| --- | --- |',
  '| constants/index.ts | RHYTHM_STRIKE_WINDOW_MS=100、PERFECT_WINDOW_MS=100、GOOD_WINDOW_MS=200；相关注释 |',
  '| src/trace/RhythmStrike.ts | 旧50ms注释同步为100ms |',
  '| src/trace/PuzzleChain.ts | 旧50ms注释同步为100ms |',
  '| src/chart/ChartScore.ts | 旧50/120ms注释同步为100/200ms |',
  '| assets/scripts/SceneBuilder.ts | 原T6两处提示文字±50ms/≤50同步为±100ms/≤100 |', '',
  `${link('implementation.diff', '完整diff')} · ${link('changed-files.json', '当前源码哈希')} · ${link('change-audit.json', '只改常量/注释/提示的生成JS审计')}。判定、仲裁、计分、7秒持续期、Head、音画同步和账本逻辑未改；无新增命名或模块。`, '',
].join('\n'));
const evidenceLines = [
  '# 验收证据：T6/T7判定窗口放宽', '',
  '结论：三门禁、新窗口精确边界、同输入透明度计分单调性，以及两档真实Cocos完整链路和AC-19同步均通过。', '',
  '| 验收 | 实际证据 | 原始附件/字段 |', '| --- | --- | --- |',
  `| T6 ±100ms及7秒链 | ±100含端点；100.001失败。终点前最后拍不可跳过，+100ms端点仍可成功，严格超窗才归零；真实预览由移动接近、数字键敲击、持续完成进入T7。 | ${link('window-boundaries-results.json')} checks09～12；${link('creator-preview-results.json')} resolutions[].fullChain.beats/puzzleSamples |`,
  `| T7 ±100/±200ms | 旧Note与引导线Tap均覆盖早晚精确端点及±0.001超窗；Head1000不改；重叠候选单消费与严格Good超时通过。真实预览按新窗内偏移输入，实际媒体结束后完成。 | boundary checks01～07；preview fullChain.inputs/completed；${link('logic-regression-summary.json')} |`,
  `| 账本 | 各档自然完整链先T6终点一条，T7完成再一条，总计恰2；没有直接赋值终点/完成账本。 | preview fullChain.ledger与过程snapshot |`,
  `| AC-18 | 同8条输入边沿、同混合5节点与同feedback，6档透明度下P3/G1/M1保持；得分400→440→500→600→700→800。 | boundary check08；${link('逻辑回归说明.md')} |`,
  `| AC-19 | 实际媒体、AudioOutputClock和视频呈现回调；两档最大偏差均≤30ms，阈值未放宽。当前测量见下表。 | preview fullChain.sync/syncSummary；${link('creator-compilation.json')} |`,
  `| 编译真实性 | 所有被检source-map逐字匹配最终TS，served chunk与编译产物一致，采集前后hash不变；本轮5个修改源码全部纳入。 | creator-compilation.entries；preview.compilation.unchangedThroughEvidenceCapture |`,
  `| 保护边界 | 29份docs、名库、归档与参照当前基线哈希不变，四旧回归脚本未改。 | ${link('change-audit.json')}；${link('prior-evidence-integrity.json')} |`, '',
  ...performanceTable, '',
  '独立窗外试验：两档均另开fresh世界、自然完成T6后，对一个Tap约+215ms输入；各恰1个Miss，迟到输入不能补救，实际媒体结束仍按既有规则完成。该试验不混入上表主链的M0分布。', '',
  ...preview.resolutions.map(r => { const trial = r.intentionalMissTrial, tap = trial.taps.find(t => t.tier === 'Miss'); return `${r.resolution} 窗外试验：实际迟按+${tap.actualDeltaMs.toFixed(3)}ms，输入前已为Miss；P${trial.completed.perfectCount}/G${trial.completed.goodCount}/M${trial.completed.missCount}，得分${trial.completed.totalScore}，账本${trial.ledger.length}；${trial.syncSummary.sampleCount}个音画样本，最大偏差${trial.syncSummary.maxRawPresentedErrorMs.toFixed(3)}ms。`; }), '',
  '精确±100/±200端点由实际纯逻辑公开API测试验证，浏览器实际输入记录小数时间及调度误差；不会把定时器期望值当成实际端点。故障/窗外试验与主完整链分列，任何诊断失败不计作最终通过。纯逻辑回归的cc stub不作真实Cocos视觉证据。', '',
  `截图：${link('截图索引.md')}；可复现真实预览：${link('creator-preview.cjs')}；当前运行日志：${link('creator-preview.log')}。`, '',
];
fs.writeFileSync(path.join(__dirname, '验收证据.md'), evidenceLines.join('\n'));
const report = [
  '# 判定窗口放宽交付报告 · 2026-10-10', '',
  '状态：已实施并完成验收。仅三项常量数值调整、相关注释与原T6窗口提示同步；未修改判定逻辑。', '',
  '| 常量 | 原值 | 新值 |', '| --- | --- | --- |',
  '| RHYTHM_STRIKE_WINDOW_MS | 50 | 100 |', '| PERFECT_WINDOW_MS | 50 | 100 |', '| GOOD_WINDOW_MS | 120 | 200 |', '',
  '## 五项确认', '',
  '1. **不变式满足。**三个窗口有限且为正；SYNC_TOLERANCE_MS=30 < PERFECT_WINDOW_MS=100 < GOOD_WINDOW_MS=200。对称窗口含端点，Head独立1000ms，7秒半开持续区间、最后拍归属、节点单消费与账本唯一写入规则保持。',
  '2. **AC数值口径必须一致，当前共享条文已经同步。**本轮实际核对AC-12/13的100ms、AC-17及Note的100/200ms、名库与同步不变式均已更新，不重复写docs。AC-18单调性业务规则无需修改；补本轮版本的验收证据索引。',
  '3. **AC-18需要重跑，已通过。**用实际ChartPremiere混合Tap/Drag/Hold、同输入及同feedback，GuideTransparency为0/10/25/50/75/100%，分数400/440/500/600/700/800，档位P3/G1/M1不变。保持随透明度增加只增不减。',
  '4. **T0历史记录不受影响，不改写。**当前同步常量仍为30ms；旧T0记录中的100ms是当时合格线，不能当成当前容差。本轮另按30ms完成AC-19真实媒体双档复测，旧历史数据不作为新窗口已测证据。',
  '5. **同步误差与判定窗口是不同参数。**扩大窗口不改变音画时钟；对固定目标，原Good中的(50,100]ms变Perfect，原Miss中的(120,200]ms变Good。边界附近即使误差小于30ms仍可能跨档，所以本轮记录实际输入偏差与判定分布，不仅凭同步合格推断档位一致。扩大Good也扩大多候选集合，密集谱面可能改变同一次输入所消费的目标；既有最近目标及平手仲裁规则保持，不承诺所有输入序列的分布逐项不变。Perfect/Good现有基础分相同；转Perfect不会单独增加基础分，Miss转命中会得分。', '',
  `${link('VERDICT修订与AC同步提案.md', '正式修订VERDICT-113第2条、123第5条及093/AC核对说明')}：编号按用户明确授权修订；仓库未找到113/123完整逐条原文，未虚构原条款全文。未改变Drag/Hold到达时按住状态规则或为其新增Good时间窗口。`, '',
  '## 修改与门禁', '',
  `${link('修改文件清单.md')} · ${link('implementation.diff', '代码diff')} · ${link('change-audit.json', '修改边界审计')}。5个生产文件，剔除注释并归一化3个常量与2个提示数值后，生成JS与起始基线一致。`, '',
  '| 门禁 | 结果 | 日志 |', '| --- | --- | --- |',
  `| npm run check:naming | PASS，0 ERROR / 16既有WARN，无新增 | ${link('gate-naming.log')} |`,
  `| npm run check:dependencies | PASS，0 ERROR | ${link('gate-dependencies.log')} |`,
  `| npm run typecheck | PASS，exit 0 | ${link('gate-typecheck.log')} |`, '',
  `${link('gate-results.json')}。命名WARN仍为Trace领域词与时间Window的既有语义提示；没有放宽门禁规则。`, '',
  `逻辑验证共${total}项通过、0失败：B31、C14、pad28、editor18、新窗口12组。${link('logic-regression-summary.json')} · ${link('逻辑回归说明.md')}。旧测试中6项绑定旧分类/截止的断言，在本轮副本按新值更新；12处改动、首次诊断与源码哈希均披露，旧脚本和旧证据保持。AC-18首次测试自身浮点期望误差已用1e-9比较修正，未改产品计分。`, '',
  '## 真实Cocos结果', '',
  `Creator ${preview.creator}，两档新编译实际完整链路通过；rendererErrors=0、runtimeErrors=0。共${screenshotCount}张截图，${compilation.entries.length}个被检TS模块的source-map/chunk与最终源码一致，采集前后hash不变。`, '',
  ...performanceTable, '',
  `${link('验收证据.md', '逐项证据')} · ${link('截图索引.md', 'Cocos截图')} · ${link('creator-preview-results.json', '原始预览结果')} · ${link('creator-compilation.json', '最终编译真实性')}。主完整链没有终点夹具或账本直写；所有实际输入偏移、节点判档和视频呈现采样保存在原始JSON。`, '',
  '## 保留边界', '',
  'docs、名库、参照与旧证据未改。当前共享文档已完成数值同步，本轮交Trae的事项为修订记录核对与新验收证据索引，未发送外部消息。测试结果覆盖当前桌面Cocos浏览器环境，不将本机同步数据推广为其他设备已通过。没有遗留的已知产品运行失败。', '',
];
fs.writeFileSync(path.join(__dirname, '交付报告.md'), report.join('\n'));
const summary = { pass: true, generatedAt: new Date().toISOString(), values: logic.configuration, headWindowMs: 1000,
  gates: gates.gates, logicTests: { passed: total, failed: 0 }, ac18: ac18.evidence.observations.map(o => ({ transparencyPercent: o.actualGuideTransparencyPercent, score: o.result.totalScore, counts: o.counts })),
  creator: { version: preview.creator, screenshotCount, checkedModules: compilation.entries.length, runtimeErrors: [], rendererErrors: [],
    resolutions: preview.resolutions.map(r => ({ resolution: r.resolution, pass: r.pass, result: r.fullChain.completed, beats: r.fullChain.beats.length, ledgerCount: r.fullChain.ledger.length, sync: r.fullChain.syncSummary,
      intentionalMissTrial: { result: r.intentionalMissTrial.completed, ledgerCount: r.intentionalMissTrial.ledger.length, sync: r.intentionalMissTrial.syncSummary } })) },
  protectedFiles: Object.keys(protectedHashes).length, changedProductionFiles: changed.length, judgementLogicUnchanged: true, finalSourceHashVerification: true,
  currentSharedDocsAlreadyUseNewValues: true, noKnownProductRuntimeFailures: true };
fs.writeFileSync(path.join(__dirname, 'delivery-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
