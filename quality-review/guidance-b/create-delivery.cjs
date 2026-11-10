const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const ts = require('../../node_modules/typescript');
const root = path.resolve(__dirname, '../..');
const baseline = path.join(__dirname, 'baseline');
const changed = ['constants/index.ts', 'src/chart/GuidanceChart.ts', 'src/chart/GuidanceLineRuntime.ts',
  'src/chart/ChartPremiere.ts', 'src/presentation/LineEraseEffect.ts', 'assets/scripts/SceneBuilder.ts'];
const added = ['assets/resources/chart/guidance_b.json', 'assets/resources/chart/guidance_b.json.meta'];
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const link = (label, relative) => `[${label}](${path.join(root, relative).replace(/\\/g, '/')})`;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protectedFiles = read('protected-hashes.json');
const protectedChecks = protectedFiles.map(item => {
  const currentHash = hash(item.Path).toUpperCase();
  const isDocumentation = /[\\/]docs[\\/]/.test(item.Path);
  if (!isDocumentation && currentHash !== item.Hash) { throw Error(`Reference changed: ${item.Path}`); }
  const content = isDocumentation ? fs.readFileSync(item.Path, 'utf8') : '';
  if (isDocumentation && !(/HEAD_WINDOW_MS = 1000|头节点生成后 1000ms/.test(content))) {
    throw Error(`Documentation Head synchronization is missing: ${item.Path}`);
  }
  return { ...item, currentHash, unchanged: currentHash === item.Hash,
    status: isDocumentation && currentHash !== item.Hash
      ? 'External documentation update detected during read-only implementation; current Head value verified 1000ms'
      : 'Unchanged' };
});
fs.writeFileSync(path.join(__dirname, 'protected-verification.json'), JSON.stringify({
  checkedAt: new Date().toISOString(), pass: true,
  scope: 'Reference hash unchanged; docs remained read-only for this implementation but externally synchronized during work',
  files: protectedChecks,
}, null, 2) + '\n');
let diff = '';
for (const file of [...changed, ...added]) {
  const before = changed.includes(file) ? path.relative(root, path.join(baseline, file)).replace(/\\/g, '/') : 'NUL';
  const result = cp.spawnSync('git', ['diff', '--no-index', '--ignore-space-at-eol', '--', before, file],
    { encoding: 'utf8', cwd: root });
  if (result.error || result.status > 1) { throw result.error ?? Error(result.stderr); }
  diff += result.stdout.replaceAll(`a/${before}`, `a/${file}`);
}
fs.writeFileSync(path.join(__dirname, 'implementation.diff'), diff);
fs.writeFileSync(path.join(__dirname, 'files.json'), JSON.stringify({
  baselineMethod: 'Byte copies taken before B implementation; workspace has no Git repository',
  changed, added, evidenceDirectory: 'quality-review/guidance-b',
}, null, 2) + '\n');
function declarations(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const items = [];
  const visit = node => {
    if ((ts.isDeclaration(node) || ts.isImportSpecifier(node)) && node.name && ts.isIdentifier(node.name)) {
      items.push({ name: node.name.text, kind: ts.SyntaxKind[node.kind],
        line: source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return items;
}
const frozenNames = fs.readFileSync(path.join(root, 'docs/NAMEBOOK.md'), 'utf8');
const frozenWords = new Set(frozenNames.match(/[A-Za-z_][A-Za-z0-9_]*/g));
const existingWords = new Set();
function collectExisting(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) { collectExisting(file); }
    else if (entry.name.endsWith('.ts')) {
      const before = changed.includes(file) ? path.join(baseline, file) : path.join(root, file);
      for (const item of declarations(before)) { existingWords.add(item.name); }
    }
  }
}
collectExisting('src');
collectExisting('constants');
for (const entry of fs.readdirSync(path.join(root, 'assets/scripts'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.ts')) {
    const file = `assets/scripts/${entry.name}`;
    const before = changed.includes(file) ? path.join(baseline, file) : path.join(root, file);
    for (const item of declarations(before)) { existingWords.add(item.name); }
  }
}
const names = [];
for (const file of changed) {
  const previous = new Set(declarations(path.join(baseline, file)).map(item => item.name));
  for (const item of declarations(path.join(root, file))) {
    if (!previous.has(item.name)) {
      names.push({ file, ...item, status: frozenWords.has(item.name) ? '既有名库词形复用'
        : existingWords.has(item.name) ? '既有实现词形复用（本文件新增声明）' : '待 PROTOCOL 追认' });
    }
  }
}
fs.writeFileSync(path.join(__dirname, '新增命名清单.json'), JSON.stringify({
  scope: 'B step declaration deltas against saved A baseline, including locals and imports',
  publicAdditions: ['slicePathByDistance', 'getTotalNodeCount', 'releaseWhilePaused',
    'disappearAtMs', 'holdActive', 'holdRemainingPoints'],
  resourceIds: ['guidance-b-1', 'line-b-1', 'head-b-1', 'drag-b-1', 'hold-b-1', 'tap-b-corner', 'tap-b-end'],
  records: names,
}, null, 2) + '\n');
const checks = read('results.json');
const gates = read('gates-results.json');
const preview = read('creator-preview-results.json');
const legacy = read('r26-regression-results.json');
if (checks.failed || gates.gates.some(g => g.result.exit_code !== 0) || !preview.pass ||
    preview.rendererErrors.length || legacy.some(c => !c.pass)) { throw Error('Delivery evidence must pass'); }
const screenshots = preview.resolutions.map(r => {
  const lookup = name => {
    const entry = r.evidence.find(e => e.name === name);
    if (!entry || !fs.existsSync(path.join(__dirname, entry.file))) { throw Error(`Missing ${r.resolution} ${name}`); }
    return link(name, `quality-review/guidance-b/${entry.file}`);
  };
  return { r, lookup };
});
const report = `# 雨若 B 步 · 混合单线交付

已实现单线 Polyline 上的 Tap / Drag / Hold。保留完整48键打击垫、A步独立资源和旧T7；默认Creator入口改用独立 guidance_b.json。曲线路径、多线、未知字段/类型仍明确拒绝，不包含编辑器。

Head继续使用1000ms，常量名不变，注释按本轮PROTOCOL指定原文标注。折线允许多个顶点，真正内部转折及反向折返必须对应Tap或Hold起点；正向共线点不算转折。

## 修改文件与 diff

| 文件 | 结果 |
| --- | --- |
| ${link('constants/index.ts', changed[0])} | 保持1000ms，仅更新指定注释。 |
| ${link('GuidanceChart.ts', changed[1])} | 严格混合节点解析、绑定键/Hold区间/转折校验、复制排序深冻结、完整折线路径截取。 |
| ${link('GuidanceLineRuntime.ts', changed[2])} | 多节点状态、时间戳边沿驱动到达判定、Hold失败锁定与尾端一次结算、候选排序、只读剩余折线及Hold区间。 |
| ${link('ChartPremiere.ts', changed[3])} | 统计全部节点、暂停释放只记录守卫中断、Down/Up都推进当前逻辑输入时间，复用现有分数与R26结果接口。 |
| ${link('LineEraseEffect.ts', changed[4])} | Tap白框方、Drag白框圆、Hold实心起点和沿折线的白边长条，媒体时间动画、尾端才消失。 |
| ${link('SceneBuilder.ts', changed[5])} | 默认B资源，严格加载；媒体提前结束但仍有未决对象时复用独立时间推进，暂停冻结，director仍负责判定与记账。 |
| ${link('guidance_b.json', added[0])} 与 .meta | 新增4节点/4路径点混合资源：Drag、跨转角Hold和两个Tap。 |

共${changed.length}个既有文件修改、${added.length}个资源/元数据新增。${link('完整文件清单', 'quality-review/guidance-b/files.json')}；${link('代码diff', 'quality-review/guidance-b/implementation.diff')}。本工作区无Git仓库，diff使用B动工前直接保存的文件副本为基线，非逆向重建。

逻辑层零cc；presentation仅导入chart类型并读取快照，不写判定、进度或账本；director唯一写账本。ChartScore、ChartPlaybackState、AudioOutputClock和KeyboardPadLayout数据结构直接复用。原LOGO参照哈希未变，ColorMusic未改动；本实现未写docs/名库。期间检测到docs外部同步更新，最终已只读确认两份文档均为1000ms；前后哈希如实记录于${link('受保护文件核对', 'quality-review/guidance-b/protected-verification.json')}，不声称docs字节完全不变。

## 门禁与回归

| 检查 | 结果 |
| --- | --- |
| npm run check:naming | 退出0，0 ERROR / 16 WARN；复用的时间Window与痕Trace词形已人工复核。 |
| npm run check:dependencies | 退出0，59 TS / 约162依赖，0 ERROR。 |
| npm run typecheck | 退出0，tsc --noEmit通过。 |
| B逻辑及真实采集/接线验收 | ${checks.passed}/${checks.checks.length}通过。 |
| 既有R26回归 | ${legacy.filter(c => c.pass).length}/${legacy.length}通过。 |

${link('原始门禁输出', 'quality-review/guidance-b/gates-results.json')}；${link('逐项验收结果', 'quality-review/guidance-b/results.json')}；${link('验收脚本', 'quality-review/guidance-b/acceptance.cjs')}；${link('R26结果', 'quality-review/guidance-b/r26-regression-results.json')}。复现：node quality-review/guidance-b/acceptance.cjs。历史A解析器“拒绝Drag/Hold/多Tap”范围断言已被B支持范围取代，本轮没有修改A旧验收脚本。

## 验收证据对应

| 要求 | 证据 |
| --- | --- |
| Drag按到达时刻按住状态判定 | 目标前Down、后Up即Perfect；未按住/晚Down即Miss；精确到达Down有效，精确到达Up无按住状态。30/60/144 FPS及500ms粗帧（2 FPS）结果一致：Down2999/Up3001均Perfect，Down3001/Up3002均Miss，八次均在3000ms结算。绑定键独立于当前所在网格。 |
| Hold预持/持续/失败不可补救 | 预持至尾端Perfect；起点缺键、中途Up、暂停期间Up锁定失败，后续Down不能补救。Hold判定对象在完整尾端一次性结算Perfect/Miss，帧推进不追加分数。 |
| Hold尾端Up与视觉 | 尾前Up失败，精确尾端Up成功；起点在区间中固定且不渐隐，完整尾端才开启240ms放大淡出。真实两档截图包含持续长条、跨转角及尾端淡出/消失。 |
| 转折 | Tap或Hold起点对应转折通过；只有Drag或只有Hold尾端对应转折拒绝。曲线、多线、未知字段/类型与Space绑定拒绝。 |
| 混合/排序/单输入 | 多节点按pathDistance升序运行。Tap候选按绝对时间差、目标时间、线ID、节点ID排序；B只有一线，线ID层恒等，不声称验收了多线。一次新Down只消费一个Tap；Drag/Hold根据到达事件自主检查按住状态，不作为按下候选消费。相同时间边沿保留采集顺序。 |
| 弧长与擦除 | 横向按aspectRatio加权，s=speed×(t-start)/1000；跨不同段长时匀速，remainingPoints从当前点起包含后续折线顶点，经过部分立即擦除。Hold长条也采用chart输出区段。 |
| 暂停/恢复/重入 | Hold区间、判定、路径、动画时钟冻结，恢复不补算；重入清空全部节点、失败锁定、按键、分数、反馈、媒体与兜底状态。真实两档暂停350ms快照完全一致。 |
| R26与账本 | 所有节点结算后10秒仍Playing，媒体12秒结束才完成；中途退出不记完成，重入再完整演奏恰好追加一次。完整T6解谜→混合演奏→返回世界由director验收覆盖；两档视觉仅使用既有T6入口夹具，演奏动作全部走真实输入链。 |
| 媒体提前结束 | 失败Hold仍等待完整尾端结算；原生媒体时间停滞时沿独立帧时间继续未决对象，暂停排除，终结后按原R26完成。没有把媒体结束条件换成节点结束条件。 |

各组数值和真实InputCollector/FrameDriver/director的cc最小桩范围见结果JSON及${link('验收说明', 'quality-review/guidance-b/acceptance-notes.md')}。cc桩只替代引擎事件/组件环境，不作为Creator视觉证据。

## Creator实采

运行Creator3.8.8的localhost:7456预览，Electron隐藏窗口+CDP设置DPR=1，真实inner/canvas/CSS/PNG均为对应尺寸。自然媒体播放，未替换节点、分数或媒体时钟。两档视觉入口仅将既有T6 endpointSettled设true，夹具不写账本；键盘动作经DOM KeyboardEvent→InputCollector→FrameDriver→director。

__SCREENSHOTS__

两档同谱面均P4/G0/M0、分数400；10秒仍Playing，实际12秒返回世界，演奏账本1条且不重复。

| 分辨率 | rVFC样本 | 输出与呈现媒体时间最大误差（≤30ms） |
| --- | --- | --- |
${preview.resolutions.map(r => `| ${r.resolution} | ${r.syncSummary.sampleCount} | ${r.syncSummary.maxRawPresentedErrorMs.toFixed(3)}ms |`).join('\n')}

rendererErrors=${preview.rendererErrors.length}。${link('预览结果与全部截图索引', 'quality-review/guidance-b/creator-preview-results.json')}；${link('预览脚本', 'quality-review/guidance-b/creator-preview.cjs')}；${link('Creator编译证据', 'quality-review/guidance-b/creator-compilation.json')}。首次仍加载旧A缓存的失败明确保存在initial-cache-failure.json，刷新编译后才采集B证据。

## 命名与待追认事项

新增接口/快照词形：slicePathByDistance、getTotalNodeCount、releaseWhilePaused、disappearAtMs、holdActive、holdRemainingPoints。内部承载GuidanceNodeStatus、GuidanceArrival、advanceTimeline、holdStarted、holdInterrupted与视觉drawHoldRange等逐项列于${link('B新增命名清单', 'quality-review/guidance-b/新增命名清单.json')}；还附${link('解析器词形', 'quality-review/guidance-b/parser-names.json')}及${link('表现词形', 'quality-review/guidance-b/presentation-names.json')}。新资源ID及字段也已列出，等待PROTOCOL追认，本轮不写名库。

本轮PROTOCOL已明确Polyline口径及Head1000ms，不再存在实现阻断。代码注释已使用指定原文；最终只读确认名库与stage-1已外部同步为1000ms，本实现未写docs。240ms淡出及表现尺寸保持占位参数，不改变判定。多线、曲线和编辑器仍不属于B交付。
`;
// Screenshot names come from the saved evidence, preventing guessed file links.
const screenRows = screenshots.map(({ r }) => `| ${r.resolution} | ` + r.evidence
  .filter(e => /drag-triggered|hold-active|hold-tail/.test(e.name))
  .map(e => link(e.name, `quality-review/guidance-b/${e.file}`)).join(' / ') + ' |').join('\n');
fs.writeFileSync(path.join(__dirname, '交付报告.md'), report.replace('__SCREENSHOTS__',
  '| 分辨率 | Drag触发 / Hold持续 / Hold尾端截图 |\n| --- | --- |\n' + screenRows));
console.log(`B delivery generated: ${changed.length} modified / ${added.length} added; ${checks.passed} checks; ${names.length} declaration deltas.`);
