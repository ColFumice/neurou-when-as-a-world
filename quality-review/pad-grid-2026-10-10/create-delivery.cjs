const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const changed = [
  'src/chart/KeyboardPadLayout.ts', 'src/chart/GuidanceLineRuntime.ts',
  'src/chart/ChartPremiere.ts', 'src/presentation/ChartPadView.ts',
  'assets/scripts/SceneBuilder.ts', 'assets/resources/chart/guidance_a.json',
  'assets/resources/chart/guidance_b.json', 'assets/resources/chart/chart_placeholder.json',
];
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const link = (label, file) => `[${label}](${path.join(root, file).replace(/\\/g, '/')})`;
let diff = '';
for (const file of changed) {
  const before = path.posix.join('quality-review/pad-grid-2026-10-10/baseline', file);
  const result = cp.spawnSync('git', ['diff', '--no-index', '--ignore-space-at-eol', '--', before, file],
    { cwd: root, encoding: 'utf8' });
  if (result.error || result.status > 1) throw result.error ?? Error(result.stderr);
  diff += result.stdout.replaceAll(`a/${before}`, `a/${file}`);
}
fs.writeFileSync(path.join(__dirname, 'implementation.diff'), diff);
fs.writeFileSync(path.join(__dirname, 'files.json'), JSON.stringify({ changed,
  baselineMethod: 'Direct copies before this user-requested change; workspace has no Git repository',
}, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '新增命名清单.json'), JSON.stringify({
  pendingProtocol: ['GRID_CONTACT_EPSILON', 'isMatchingGridKey', 'hasHeldGridKey', 'rebuildSlotLabels'],
  layoutVersion: 'pad-layout-2',
  authorization: 'User requested full-screen 47-key grid and immediate neighboring-key tolerance including diagonals',
}, null, 2) + '\n');
const priorProtected = JSON.parse(fs.readFileSync(path.join(root,
  'quality-review/guidance-b/protected-verification.json'), 'utf8'));
const protectedFiles = priorProtected.files.map(file => {
  const currentHash = crypto.createHash('sha256').update(fs.readFileSync(file.Path)).digest('hex').toUpperCase();
  const isDocumentation = /[\\/]docs[\\/]/.test(file.Path);
  return { path: file.Path, previousDeliveryHash: file.currentHash, currentHash,
    isDocumentation, unchangedSinceBDelivery: currentHash === file.currentHash,
    status: currentHash === file.currentHash ? 'Matches previous B delivery'
      : isDocumentation ? 'Difference from previous B delivery observed; this implementation remained read-only'
        : 'Reference changed' };
});
const referenceUnchanged = protectedFiles.filter(file => !file.isDocumentation)
  .every(file => file.unchangedSinceBDelivery);
if (!referenceUnchanged) throw Error('Protected reference changed');
fs.writeFileSync(path.join(__dirname, 'protected-verification.json'), JSON.stringify({
  comparison: 'Against previous B delivery; not a current-task start snapshot',
  files: protectedFiles, referenceUnchanged,
  documentationDifferencesObserved: protectedFiles.some(file => file.isDocumentation && !file.unchangedSinceBDelivery),
}, null, 2) + '\n');
const gates = read('gates-results.json');
const checks = read('results.json');
const preview = read('creator-preview-results.json');
if (gates.some(g => g.status !== 'fulfilled' || g.value.exit_code !== 0) ||
    checks.failed || !preview.pass || preview.rendererErrors.length) throw Error('Evidence must pass');
const screenshots = preview.resolutions.flatMap(resolution => resolution.evidence.map(e => ({
  resolution: resolution.resolution, ...e,
})));
for (const screenshot of screenshots) {
  if (!fs.existsSync(path.join(__dirname, screenshot.file))) throw Error('Screenshot missing: ' + screenshot.file);
}
const report = `# 全屏打击垫与邻键容错

按用户本轮要求完成：显示47个字母、数字、符号键，Space没有网格或标签。顶行与Q行各13键、A行11键、Z行10键；四行各占25%高度，每行独立均分全宽，键少的行每格更宽。引导线与旧T7使用同一逻辑布局的只读副本，容器铺满屏幕。

原差异原因是ChartPadView只对旧Note谱面做显示重排，GuidanceChart分支却显示旧5行错位布局。现已统一真实逻辑/显示几何。布局升级为pad-layout-2，并同步三份演示谱面声明；旧T7的两个Space Note与fallback改为可见KeyG。旧版资源会被明确版本拒绝，避免静默改变目标。

## 判定

- Tap先以输入时间戳的判定点位置解析唯一目标格，再接受本键及与目标格边或角直接接触的一层邻键，包含用户确认的斜向。目标为null仍拒绝，不递归、不按最近键兜底。
- Drag在原到达时刻检查该邻键集合是否已有键按住，沿用时间戳Down/Up边沿和Perfect/Miss。
- Hold要求邻键集合从起点到尾端持续非空；先按新邻键再松旧键可继续，全部有效键松开会永久锁定失败，重新按下不补救。尾端同刻Up有效；暂停冻结时钟，暂停释放继续维护守卫。失败/成功都在完整尾端只计一次，视觉尾端再消失。
- 反馈计入并高亮目标键。一次Down最多消费一个Tap，原时间窗口、弧长、擦除、完成与唯一账本写入接线复用。
- Space不作为节点目标或邻键；仍是Head唯一启动键，HEAD_WINDOW_MS保持1000ms。

## 修改与验证

${changed.map(file => '- ' + link(file, file)).join('\n')}

${link('完整代码diff', 'quality-review/pad-grid-2026-10-10/implementation.diff')}；${link('文件清单', 'quality-review/pad-grid-2026-10-10/files.json')}。

三门禁全部退出0：naming 0 ERROR / 16既有WARN（时间Window、痕Trace语义已复核）、dependencies 0 ERROR、tsc通过。新规则验收${checks.passed}/${checks.passed + checks.failed}通过。旧B“两格严格取键”反例和48槽断言因用户新要求已过时，原证据保留；本轮结果独立保存。

${link('门禁原始结果', 'quality-review/pad-grid-2026-10-10/gates-results.json')}；${link('逐项验收', 'quality-review/pad-grid-2026-10-10/results.json')}；${link('验收脚本', 'quality-review/pad-grid-2026-10-10/acceptance.cjs')}。

Creator3.8.8真实预览已在1920×1080、2560×1440采集。DOM键盘输入刻意使用邻键，通过实际InputCollector、FrameDriver和director链路，截图共${screenshots.length}张，rendererErrors=0。沿用已声明的T6入口夹具；采集时隐藏引擎debug profiler以免遮挡Z/X网格，不替换节点、分数或媒体时钟，不改产品源码。

${link('Creator预览结果与截图索引', 'quality-review/pad-grid-2026-10-10/creator-preview-results.json')}；${link('编译与源码证据', 'quality-review/pad-grid-2026-10-10/creator-compilation.json')}；${link('采集说明', 'quality-review/pad-grid-2026-10-10/creator-preview-notes.md')}。

${screenshots.filter(s => s.resolution === '1920x1080' && /fullscreen-grid|drag-triggered|hold-active|hold-tail-disappeared/.test(s.name))
  .map(s => '- ' + link(s.name, 'quality-review/pad-grid-2026-10-10/' + s.file)).join('\n')}

## 追认与限制

新增技术名称GRID_CONTACT_EPSILON、isMatchingGridKey、hasHeldGridKey、rebuildSlotLabels与pad-layout-2列于${link('命名清单', 'quality-review/pad-grid-2026-10-10/新增命名清单.json')}，供PROTOCOL追认。本轮用户指令直接授权新的布局与邻键口径，没有新增裁定阻断。

本实现未写docs、名库、参照或ColorMusic；${link('受保护文件核对', 'quality-review/pad-grid-2026-10-10/protected-verification.json')}记录与B交付时的对照。参照哈希一致；两份文档与B交付快照已有哈希差异，记录保留，本轮实现操作保持只读。非16:9容器也铺满显示，逻辑弧长仍采用谱面aspectRatio；两档正式验收均为16:9。
`;
fs.writeFileSync(path.join(__dirname, '交付说明.md'), report);
console.log(`Delivery saved: ${changed.length} files, ${checks.passed} checks, ${screenshots.length} screenshots.`);
