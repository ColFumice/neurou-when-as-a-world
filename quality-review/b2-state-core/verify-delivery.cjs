'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const allowedExisting = new Set([
  'assets/scripts/SceneBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts',
  'src/director/IntentPort.ts', 'src/director/WorldClearSession.ts', 'src/director/SphereCrossing.ts',
  'src/director/WorldStateSession.ts', 'src/presentation/DeepTraceRevealSequence.ts',
  'src/trace/PuzzleChain.ts', 'src/trace/PuzzleProgress.ts', 'src/trace/DeepTrace.ts', 'src/world/WorldInstance.ts',
]);
const addedSources = [
  'src/director/LedgerHydration.ts', 'src/director/PuzzleHydration.ts', 'src/director/WorldStateCodec.ts',
  'src/presentation/WorldCoreStateStorage.ts', 'src/presentation/FormatTimeStorage.ts', 'src/presentation/WorldCoreStateView.ts',
];
const allowedAdded = new Set([...addedSources, ...addedSources.map(file => file + '.meta')]);
const productionRoots = ['src', 'constants', 'assets/scripts', 'assets/resources'];
const scanRoots = [...productionRoots, 'docs', 'archive', '.trae', 'scripts'];
function walk(relative, files) {
  for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    if (item.isSymbolicLink()) continue;
    const file = relative + '/' + item.name;
    if (item.isDirectory()) walk(file, files); else if (item.isFile()) files.push(file);
  }
}
function info(file) { const bytes = fs.readFileSync(path.join(root, file)); return { path: file, bytes: bytes.length, sha256: hash(bytes) }; }
const changed = [], missing = [], backupFailures = [];
for (const file of baseline.files) {
  const original = path.join(__dirname, 'baseline', file.path);
  if (!fs.existsSync(original) || hash(fs.readFileSync(original)) !== file.sha256) backupFailures.push(file.path);
  if (!fs.existsSync(path.join(root, file.path))) { missing.push(file.path); continue; }
  const current = info(file.path);
  if (current.sha256 !== file.sha256) changed.push({ ...current, beforeSha256: file.sha256, kind: 'Modified' });
}
const scanned = []; for (const base of scanRoots) walk(base, scanned);
const known = new Set(baseline.files.map(file => file.path));
const added = scanned.filter(file => !known.has(file)).sort();
const unauthorizedChanges = changed.filter(file => !allowedExisting.has(file.path));
const unauthorizedAdded = added.filter(file => !allowedAdded.has(file));
const absentAdded = [...allowedAdded].filter(file => !fs.existsSync(path.join(root, file)));
const production = [...changed.filter(file => productionRoots.some(base => file.path.startsWith(base + '/'))),
  ...added.filter(file => productionRoots.some(base => file.startsWith(base + '/'))).map(file => ({ ...info(file), kind: 'Added' }))];
let diff = '';
for (const file of production) {
  if (file.kind === 'Modified') {
    const result = cp.spawnSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-color', '--unified=3', '--',
      path.join(__dirname, 'baseline', file.path), path.join(root, file.path)], { encoding: 'utf8', windowsHide: true, maxBuffer: 16e6 });
    if (result.error || ![0, 1].includes(result.status)) throw result.error || new Error(result.stderr);
    // Normalize only Git's platform-specific quoted headers; retain real hunks verbatim.
    diff += result.stdout.replace(/^diff --git .*$/m, 'diff --git a/' + file.path + ' b/' + file.path)
      .replace(/^--- .*$/m, '--- a/' + file.path).replace(/^\+\+\+ .*$/m, '+++ b/' + file.path);
  } else {
    const lines = fs.readFileSync(path.join(root, file.path), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    diff += 'diff --git a/' + file.path + ' b/' + file.path + '\nnew file mode 100644\n--- /dev/null\n+++ b/' + file.path +
      '\n@@ -0,0 +1,' + lines.length + ' @@\n' + lines.map(line => '+' + line + '\n').join('');
  }
}
fs.writeFileSync(path.join(__dirname, 'production.diff'), diff);
const pass = !backupFailures.length && !missing.length && !unauthorizedChanges.length && !unauthorizedAdded.length && !absentAdded.length;
const report = { generatedAt: new Date().toISOString(), pass, baselineCount: baseline.files.length,
  baselineCapturedAt: baseline.capturedAt, unchangedBaselineCount: baseline.files.length - changed.length - missing.length,
  allowedExisting: [...allowedExisting], allowedAdded: [...allowedAdded], backupFailures, missing, unauthorizedChanges,
  unauthorizedAdded, absentAdded, productionChanges: production, productionDiffBytes: Buffer.byteLength(diff),
  docsNamebookReferenceArchiveUnchanged: !changed.some(file => /^(docs|archive|\.trae)\//.test(file.path)) &&
    !added.some(file => /^(docs|archive|\.trae)\//.test(file)),
  sourceRoots: productionRoots, note: 'No Git history is present. Original bytes and hashes are the immutable pre-implementation baseline; actual no-index source diff is generated. Junctions are skipped.' };
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n');
const purpose = {
  'assets/scripts/SceneBuilder.ts': '恢复前校验、未激活组装、同源持久化与稳定检查点、只读状态显示。',
  'assets/scripts/WorldFolderBuilder.ts': '真实新建 FormatTime、世界租约、退出释放、目录严格 Core 读取。',
  'src/director/IntentPort.ts': '完整解谜控制 capture/hydrate、防重与 type-only 窄口。',
  'src/director/WorldClearSession.ts': '候选 Ledger 先持久化、静默 seed、原完成候选恢复。',
  'src/director/SphereCrossing.ts': '既有穿越事实静默 seed；原判定不变。',
  'src/director/WorldStateSession.ts': '三项 ownership 更新、有效 capturedParts；完整恢复仍拒绝。',
  'src/presentation/DeepTraceRevealSequence.ts': 'Idle/Finished 终态 capture/seed，不播放或提交入口。',
  'src/trace/PuzzleChain.ts': '完整私有计时状态 capture/seed 与稳定边界校验。',
  'src/trace/PuzzleProgress.ts': '初始合法阶段 seed。',
  'src/trace/DeepTrace.ts': '初始合法触发事实 seed。',
  'src/world/WorldInstance.ts': 'FormatTime 冻结 readonly epochMs。',
  'src/director/LedgerHydration.ts': '严格账本/来源/控制验证及不可变深拷贝。',
  'src/director/PuzzleHydration.ts': '完整 Puzzle 载荷与 T6/T7 账本关联严格验证。',
  'src/director/WorldStateCodec.ts': '严格 Core 文档聚合，独立于七项品牌。',
  'src/presentation/WorldCoreStateStorage.ts': '单 key 原子保存、租约/保留账号提交、版本与前缀保护。',
  'src/presentation/FormatTimeStorage.ts': '同主 key 的创建时间 section 适配。',
  'src/presentation/WorldCoreStateView.ts': '账本/Puzzle/FormatTime 与部分恢复状态只读视图。',
};
fs.writeFileSync(path.join(__dirname, '修改文件清单.md'), '# B2.2d-1 修改文件清单与真实 diff\n\n' +
  '本工作区无 .git。以 protected-baseline.json 在 ' + baseline.capturedAt + ' 捕获的 ' + baseline.files.length +
  ' 份原始字节为基线；verify-delivery.cjs 生成真实 git diff --no-index 与新增文件完整 diff。\n\n' +
  '原文件修改白名单严格为上述 11 份；新增正式源文件 6 份及各自 .meta。docs、名库、参照文件、archive、旧资源、编辑器核心、' +
  'B2.2a 账号投影与 B2.2b 完整 WorldStateStorage 均保持原字节。T6/T7 只增加必要 seed/capture/防重，原玩法算法和零向量未重写。\n\n' +
  '| 类别 | 文件 | 字节 | SHA-256 | 用途 |\n| --- | --- | ---: | --- | --- |\n' + production.map(file =>
    '| ' + file.kind + ' | ' + file.path + ' | ' + file.bytes + ' | ' + file.sha256 + ' | ' +
    (purpose[file.path] ?? '新脚本独立 Cocos UUID 与导入元数据。') + ' |').join('\n') +
  '\n\n保护核验 pass=' + pass + '；未改原始文件 ' + report.unchangedBaselineCount + '/' + baseline.files.length +
  '；生产变更 ' + production.length + ' 份；实际 diff ' + report.productionDiffBytes + ' 字节。详细项见 protected-final-audit.json。\n');
console.log(JSON.stringify({ pass, changed: changed.map(file => file.path), added, backupFailures, unauthorizedChanges, unauthorizedAdded,
  productionDiffBytes: report.productionDiffBytes }));
process.exitCode = pass ? 0 : 1;
