const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const evidenceDir = __dirname;
const projectRoot = path.resolve(evidenceDir, '../..');
const read = name => JSON.parse(fs.readFileSync(path.join(evidenceDir, name), 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const preview = read('creator-preview-results.json');
const compilation = read('creator-compilation.json');
const gates = read('gate-results.json');
const architecture = read('architecture-audit.json');
const changedFiles = read('changed-files.json');
const protectedHashes = read('protected-hashes.json');
const logicRuns = [
  ['账号启动', 'acceptance-results.json'],
  ['B 步', 'b-regression-results.json'],
  ['C 步', 'c-regression-results.json'],
  ['键盘网格', 'pad-grid-regression-results.json'],
  ['引导线编辑器', 'editor-regression-results.json'],
].map(([name, file]) => ({ name, file, result: read(file) }));

assert(preview.pass && preview.resolutions.length === 2, 'Final preview did not pass both resolutions');
assert(!preview.rendererErrors.length && !preview.runtimeErrors.length, 'Preview contains runtime errors');
assert(preview.compilation.unchangedThroughEvidenceCapture, 'Compilation changed during evidence capture');
assert(compilation.entries.every(e => e.servedEqualsCompilerOutput && e.sourceMapMatchesFinalSource), 'Compiler/source-map mismatch');
assert(gates.gates.every(g => g.pass && g.exitCode === 0), 'A gate failed');
assert(architecture.pass && architecture.protectedFilesUnchanged && architecture.existingDirectorBehaviorUnchanged, 'Architecture audit failed');
for (const run of logicRuns) assert(run.result.failed === 0, 'Logic regression failed: ' + run.name);
for (const file of changedFiles) assert(sha(path.join(projectRoot, file.path)) === file.sha256, 'Production source changed after evidence: ' + file.path);
for (const entry of compilation.entries) assert(sha(path.join(projectRoot, entry.source)) === entry.sourceSha256, 'Compiled source changed: ' + entry.source);
for (const [file, expected] of Object.entries(protectedHashes)) assert(sha(path.join(projectRoot, file)) === expected, 'Protected file changed: ' + file);

const markdownRoot = '/' + projectRoot.replace(/\\/g, '/');
const link = (name, label = name) => `[${label}](${markdownRoot}/quality-review/world-folder/${name})`;
const sourceLink = (file, label = file) => `[${label}](${markdownRoot}/${file})`;
const picture = (resolution, name, label = '截图') => link(`${resolution}-${name}.png`, label);
const screenshotPair = (name, label = '查看') => preview.resolutions.map(r => picture(r.resolution, name, `${label} ${r.resolution}`)).join(' · ');
const logicPassed = logicRuns.reduce((sum, run) => sum + run.result.passed, 0);
const screenshotCount = preview.resolutions.reduce((sum, r) => sum + r.evidence.length, 0);
const previewChecks = preview.resolutions.reduce((sum, r) => sum + r.checks.length, 0);

const acceptanceRows = [
  ['登录 → 首次序章 → 世界文件夹', '两档均用实际登录与继续按钮完成首次序章；相同账号重载跳过，另一账号独立首次。存储读失败保留登录、写失败保留序章。', ['01-login', '02-first-prologue', '03-world-folder', '03b-other-account-prologue', '03c-storage-failure-remains-prologue'], 'checks[0..2]；evidence；账号启动 4 项逻辑验证'],
  ['世界文件夹显示两个入口', '当前账号恰好一个 InitialWorld（初始世界）与世界编辑器文件夹入口；选择前没有 gameplay、帧驱动或输入采集器。', ['03-world-folder'], 'checks[3]；evidence[name=03-world-folder].snapshot'],
  ['初始世界进入 A/B/C 完整链路', '实际进入原箱庭并接近深痕，真实输出时钟下完成 T6 八拍、转入默认 C 多线 T7、实际媒体完结后回世界。A/B/C 资源与核心通过现有回归；两档各 P9/G1/M0、1000 分、账本恰 2。', ['04-initial-world', '05-deep-trace-approach', '06-natural-T6-T7-entry', '07-C-multiline-performance', '08-T7-completed-world'], 'fullChain；checks[4]；core-regressions；editor 回归第16项'],
  ['从世界退出返回世界文件夹', '正常完成后退出和 T7 暂停时整体退出均回目录；原帧驱动、键盘、媒体和独立3D根退场，重入创建 fresh 会话。', ['09-return-world', '10-T7-paused-before-world-exit', '11-return-paused-world'], 'lifecycleWorld；freshReentry；pausedWholeWorldExit；checks[5..6]'],
  ['编辑器文件夹展开完整目录', 'VERDICT-151 的15项全部可见，根及父目录可折叠/展开；开发阶段直接访问，无 AccessCode 锁。', ['12-editor-tree'], 'checks[7]；evidence[name=12-editor-tree].snapshot'],
  ['引导线编辑器打开现有界面', '目录按钮打开原 GuidanceEditorBuilder/View；原 mock 资源、视频与独立演奏预览可用，未连接世界会话或账本。', ['15-guidance-editor-open', '16-editor-independent-rehearsal'], 'checks[8]；lifecycleEditor；editor 回归18项'],
  ['占位项反馈暂未实现', '12个 Placeholder 全部逐项点击，显示“名称：暂未实现”，不创建编辑器运行节点；含音乐、地图、剧情及引导线子项。', ['13-placeholder-feedback'], 'placeholders；checks[7]'],
  ['从编辑器退出返回世界文件夹', '演奏期间退出后 DOM 删除、视频暂停且断开、键盘无新增意图、原会话不再推进；同帧与延迟资源回调均不能复活界面。目录自身的返回也通过。', ['14-directory-back-world-folder', '17-return-editor', '18-rapid-editor-return'], 'lifecycleEditor；pendingDestructionEditorExit；rapidEditorExit；checks[9..10]'],
  ['两档分辨率一致', '1920×1080与2560×1440的实际viewport、Canvas及PNG尺寸一致对应；世界页和编辑器目录内容及computed styles相同，无横向溢出。人工复核目录、编辑器打开及退出截图，无截断。', ['03-world-folder', '12-editor-tree', '15-guidance-editor-open', '17-return-editor'], 'resolutionComparison；每张evidence.imageSize与snapshot.dimensions'],
  ['门禁＋真实Cocos＋完整证据', '命名、依赖、类型三门禁exit 0；Creator 3.8.8真实预览双档各11项通过；19个模块的served chunk/编译产物/source-map与最终源码一致，采集前后hash不变。', [], 'gate-results；creator-compilation；creator-preview-results；40张PNG'],
];
const evidenceLines = [
  '# 第30批逐条验收证据', '',
  '结论：本轮已授权的本地灰盒范围内，验收项1～10均通过。真实远程认证、完整序章叙事与原生平台不在此通过结论内。', '',
  `原始结果：${link('creator-preview-results.json', '真实预览JSON')} · ${link('creator-compilation.json', '编译真实性')} · ${link('gate-results.json', '三条门禁')} · ${link('截图索引.md', '40张截图索引')}。`, '',
  '| 序号 | 验收项 | 实际结果 | 证据路径（JSON每档resolutions项内） | 双档截图 |',
  '| --- | --- | --- | --- | --- |',
  ...acceptanceRows.map(([title, result, pictures, fields], i) => `| ${i + 1} | ${title} | PASS：${result} | ${fields} | ${pictures.map(name => screenshotPair(name, name)).join('<br>') || '见日志与JSON'} |`), '',
  '完整自然链路的 fullChain.fixture 为 none，未注入终点或直接写完成账本。T6_ENDPOINT_PLACEHOLDER 和 T7_COMPLETION_PLACEHOLDER 是原工程既有事件ID，原样保留。专门的“暂停时整体退出”生命周期用例使用明确标记的终点夹具快速到达已验证状态；存储拒绝、真实资源回调的同帧/200ms延迟为故障边界注入。这些用例与自然完整链路证据分列。', '',
  '原核心回归的 cc stub 仅用于逻辑/采集器集成测试，不计作真实Cocos截图。最终真实预览在 http://localhost:7457/ 运行。首次诊断失败保留在单独的 *-failure.json / 日志中，修复后双档完整重跑；旧诊断不计入最终PASS。', '',
  '| 分辨率 | T6真实拍数 | T7判定 | 得分 | 世界账本 | 视频呈现采样 | 最大原始音画误差 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...preview.resolutions.map(r => `| ${r.resolution} | ${r.fullChain.beats.length} | P${r.fullChain.completed.perfectCount}/G${r.fullChain.completed.goodCount}/M${r.fullChain.completed.missCount} | ${r.fullChain.completed.totalScore} | ${r.fullChain.ledger.length} | ${r.fullChain.syncSummary.sampleCount} | ${r.fullChain.syncSummary.maxRawPresentedErrorMs.toFixed(3)} ms |`), '',
  '音画数值为本次本机rVFC样本记录，不作为其他设备的普遍性能保证。正式判断仍由未修改的现有规则执行。', '',
  `复现入口：${link('creator-preview.cjs', '真实预览脚本')}、${link('creator-preview.log', '最终运行日志')}；账号测试：node quality-review/world-folder/acceptance.cjs；三门禁命令见交付报告。`, '',
];
fs.writeFileSync(path.join(evidenceDir, '验收证据.md'), evidenceLines.join('\n'));

const captions = {
  '01-login': '本地账号登录', '02-first-prologue': '账号首次序章', '03-world-folder': '世界文件夹与唯一世界入口',
  '03b-other-account-prologue': '另一账号独立首次序章', '03c-storage-failure-remains-prologue': '保存失败不提交序章完成',
  '04-initial-world': '进入现有初始世界', '05-deep-trace-approach': '实际移动接近深痕', '06-natural-T6-T7-entry': '自然T6解谜完成及T7转场',
  '07-C-multiline-performance': 'C多线实际演奏', '08-T7-completed-world': '媒体完结返回世界', '09-return-world': '世界退出返回文件夹',
  '10-T7-paused-before-world-exit': '整体退出前的T7暂停', '11-return-paused-world': '暂停时退出返回文件夹',
  '12-editor-tree': '完整编辑器目录树', '13-placeholder-feedback': '占位项暂未实现反馈', '14-directory-back-world-folder': '目录返回世界文件夹',
  '15-guidance-editor-open': '现有引导线编辑器打开', '16-editor-independent-rehearsal': '编辑器独立演奏预览',
  '17-return-editor': '编辑器退出返回文件夹', '18-rapid-editor-return': '资源回调竞态退出后保持文件夹',
};
const screenshotLines = [
  '# Cocos预览截图索引', '',
  `Creator 3.8.8，实际预览 http://localhost:7457/，${screenshotCount} 张原始PNG。PNG尺寸与真实viewport及Canvas尺寸分别一致；没有拉伸旧截图伪造第二档。`, '',
  '| 画面 | 1920×1080 | 2560×1440 |', '| --- | --- | --- |',
  ...preview.resolutions[0].evidence.map(e => `| ${captions[e.name]} | ${picture('1920x1080', e.name, e.name)} | ${picture('2560x1440', e.name, e.name)} |`), '',
  `原始快照和尺寸见 ${link('creator-preview-results.json')}；逐条映射见 ${link('验收证据.md')}。`, '',
];
fs.writeFileSync(path.join(evidenceDir, '截图索引.md'), screenshotLines.join('\n'));

const reportLines = [
  '# 第30批交付报告：世界文件夹界面与编辑器框架目录', '',
  '交付日期：2026-10-10。状态：实现完成，本轮本地灰盒验收通过；共享名库与规格同步仍待PROTOCOL追认和Trae落盘。', '',
  '统一入口已接通：登录 → 账号首次序章 → 世界文件夹。世界文件夹提供唯一“初始世界”和“世界编辑器文件夹”；初始世界复用原箱庭/深痕/T6/T7/A/B/C，引导线编辑器复用原实现。世界和编辑器退出均返回世界文件夹。开发阶段目录直接开放，未来AccessCode机制保留。', '',
  '## 九项交付索引', '',
  '| 请求项 | 交付文件 | 内容 |', '| --- | --- | --- |',
  `| 1. VERDICT-158～168 | ${link('VERDICT-158-168.md')} | 正式修订062及068默认启动关系、冻结命名/只读结构、目录树、流程、模块和既有系统边界 |`,
  `| 2. 名库v3.1附录提案 | ${link('名库v3.1附录提案.md')} | 公共类型、目录ID、字段和既有名称的复用；交Trae落盘 |`,
  `| 3. 依赖矩阵提案 | ${link('依赖矩阵扩展提案.md')} | 无新增模块和矩阵权限；补充阶段范围与责任说明 |`,
  `| 4. 修改清单及diff | ${link('修改文件清单.md')} · ${link('implementation.diff')} · ${link('changed-files.json')} | 18个生产文件：7个新TS及meta、4个原TS修改；逐文件SHA-256 |`,
  `| 5. 三条门禁 | ${link('gate-results.json')} | 全部exit 0；日志见下表 |`,
  `| 6. 真实Cocos截图 | ${link('截图索引.md')} | 两档各20张，含文件夹、世界、目录、编辑器、退出返回 |`,
  `| 7. 逐条验收证据 | ${link('验收证据.md')} · ${link('creator-preview-results.json')} | 验收1～10逐项对应，真实完整链路及生命周期边界 |`,
  `| 8. 新增命名清单 | ${link('新增命名清单.md')} · ${link('new-names.json')} | AST基线差分179个声明位置，公开领域名与私有/局部名分清；待追认 |`,
  `| 9. 遗留/待裁定 | ${link('PROTOCOL裁定请求.md')} | 服务、完整叙事、存档、其他世界、ShoreHub未来入口、原生适配 |`, '',
  '本轮未改写docs、名库、archive和根部参照文件；提案仅存放在quality-review/world-folder，没有向Trae或其他人发送消息。', '',
  '## 实现与架构', '',
  `WorldFolderView、EditorFolderView、FolderCatalog、FolderStartupView和FolderTheme属于presentation；新增 ${sourceLink('src/director/AccountStartupSession.ts', 'AccountStartupSession')} 仅编排账号启动，零cc、零世界/ledger依赖。presentation只通过既有IntentPort的export type转发读取启动类型。${sourceLink('assets/scripts/WorldFolderBuilder.ts', 'WorldFolderBuilder')} 是外层组合根，负责原运行实例的创建、停用、延迟销毁和返回。`, '',
  '冻结采用WorldFolderView、InitialWorld、EditorFolderView、EditorFolderEntry、EditorCatalog，不新增worldFolder模块，也不新增chart/editor业务接口。世界条目只读，editorCatalog深冻结；完整目录15项＝2文件夹＋1已实现＋12占位。availability与children独立，有子目录的占位父项仍能反馈“暂未实现”。', '',
  'AC-29通过FolderPresentationTheme的颜色、面板、边框和字体配置兑现，UI可替换。SceneBuilder把原UseGuidanceChart和GuideTransparency设置传给世界会话，3D根保持Scene下原渲染层级。', '',
  '为接通整体退出，仅增加必要的表现生命周期防护：GuidanceEditorBuilder的异步回调检查组件/节点有效且活动；GuidanceEditorView避免清理已被Cocos先销毁的子效果。这修复了真实预览发现的退出异常，并通过同帧及延迟回调窗口补验。引导线编辑、判定、计分和A/B/C核心业务均未改动。', '',
  `核验：${link('architecture-audit.json')} 确认chart/editor/world/character/trace/ledger源码与基线相同、既有director业务保持、门禁脚本未放宽；${link('protected-verification.json')} 确认29份受保护文件未改写。当前生产SHA、受保护文件和编译源码在交付汇总时再次复核，全部吻合。`, '',
  '## 三条门禁与回归', '',
  '| 门禁 | 命令 | 结果 | 日志 |', '| --- | --- | --- | --- |',
  `| 命名 | npm run check:naming | PASS，0 ERROR，16 WARN | ${link('gate-naming.log')} |`,
  `| 依赖 | npm run check:dependencies | PASS，0 ERROR | ${link('gate-dependencies.log')} |`,
  `| 类型 | npm run typecheck | PASS，exit 0 | ${link('gate-typecheck.log')} |`, '',
  '16条命名WARN与起始基线语义相同，没有新增WARN：Trace是痕领域名，Window是判定时间窗。命名门禁未通过删改既有名或增加排除规则制造通过。', '',
  '| 验证组 | 通过 | 失败 | 结果 |', '| --- | --- | --- | --- |',
  ...logicRuns.map(run => `| ${run.name} | ${run.result.passed} | ${run.result.failed} | ${link(run.file)} |`),
  `| 合计 | ${logicPassed} | 0 | ${link('core-regressions.json', '核心原回归来源')} |`, '',
  `真实预览另外验证 ${previewChecks} 项（每档11项），${screenshotCount} 张PNG；rendererErrors=0、runtimeErrors=0。${link('creator-compilation.json')} 记录19个被检模块的最终源码、source-map与served chunk一致，采集前后编译哈希保持。详细链路、误差与夹具说明见 ${link('验收证据.md')}。`, '',
  '## 主要画面', '',
  '| 类别 | 双档原图 |', '| --- | --- |',
  `| 世界文件夹 | ${screenshotPair('03-world-folder')} |`,
  `| 初始世界进入 | ${screenshotPair('04-initial-world')} |`,
  `| 编辑器目录树 | ${screenshotPair('12-editor-tree')} |`,
  `| 引导线编辑器打开 | ${screenshotPair('15-guidance-editor-open')} |`,
  `| 世界退出返回 | ${screenshotPair('09-return-world')} |`,
  `| 编辑器退出返回 | ${screenshotPair('17-return-editor')} |`, '',
  '## 遗留边界与待裁定', '',
  '1. 登录为开发阶段本地账号标识，序章为简短灰盒文本。一次性完成事实仅在同一浏览器存储、同一账号下持久化；远程认证、跨设备迁移及完整ShorePrologue/EditorTutorial内容尚未交付。',
  '2. 退出世界销毁会话，重入fresh；没有新增世界进度保存或继续上次世界的承诺。编辑器保留原草稿机制。',
  '3. 本次验证Cocos浏览器预览与DOM界面；原生打包平台的目录UI、账号存储与文件API需后续适配。',
  '4. 原?guidanceEditor=1改为统一登录/序章/目录入口，不再直接绕过流程打开编辑器；这项兼容语义变化已由VERDICT-167明确记录。',
  '5. 公共命名、目录ID、阶段范围同步待PROTOCOL追认及Trae落盘。未来其他世界、世界存档、其他编辑器、ShoreHub入口和编辑权限分别裁定；AccessCode保留原首次加入他人世界语义。', '',
  '没有遗留的已知运行失败，也没有未解决架构冲突需要停工。当前通过结论限定于上述已实现与已验证范围。', '',
];
fs.writeFileSync(path.join(evidenceDir, '交付报告.md'), reportLines.join('\n'));

const deliverySummary = {
  batch: 30, verdicts: [158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168],
  generatedAt: new Date().toISOString(), pass: true,
  scope: 'Local development account, short graybox prologue, browser Cocos preview, one existing InitialWorld',
  acceptance: acceptanceRows.map(([title], index) => ({ id: index + 1, title, pass: true })),
  gates: gates.gates, existingNamingWarnings: gates.naming.warnings, newNamingWarnings: gates.naming.newWarnings,
  logicTests: { passed: logicPassed, failed: 0, runs: logicRuns.map(run => ({ name: run.name, passed: run.result.passed, failed: run.result.failed, file: run.file })) },
  creator: { version: preview.creator, url: preview.url, screenshotCount, checkCount: previewChecks,
    rendererErrors: preview.rendererErrors, runtimeErrors: preview.runtimeErrors,
    compilationEntries: compilation.entries.length, unchangedThroughEvidenceCapture: preview.compilation.unchangedThroughEvidenceCapture,
    resolutions: preview.resolutions.map(r => ({ resolution: r.resolution, pass: r.pass, screenshotCount: r.evidence.length,
      checkCount: r.checks.length, naturalFullChainFixture: r.fullChain.fixture,
      beats: r.fullChain.beats.length, result: r.fullChain.completed, ledgerCount: r.fullChain.ledger.length, sync: r.fullChain.syncSummary })),
    resolutionComparison: preview.resolutionComparison },
  productionFiles: changedFiles.length, newDeclarationLocations: read('new-names.json').length,
  protectedFiles: Object.keys(protectedHashes).length, finalSourceHashVerification: true,
  noNewModule: architecture.noNewModule, noGateChanges: architecture.noGateChanges,
  unchangedCoreModules: architecture.unchangedCoreModules,
  pending: ['PROTOCOL naming ratification', 'Trae spec/namebook proposal adoption', 'Remote authentication and account migration',
    'Full prologue/tutorial narrative', 'World save/resume and additional worlds', 'Future ShoreHub entry', 'Native platform UI/storage/file adaptation'],
  knownRuntimeFailures: [],
};
fs.writeFileSync(path.join(evidenceDir, 'delivery-summary.json'), JSON.stringify(deliverySummary, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, productionFiles: changedFiles.length, protectedFiles: Object.keys(protectedHashes).length,
  logicPassed, previewChecks, screenshotCount, compilationEntries: compilation.entries.length, finalSourceHashVerification: true }, null, 2));
