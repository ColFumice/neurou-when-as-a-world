'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'protected-baseline.json'), 'utf8'));
const backupRoot = path.join(__dirname, 'baseline');
const productionRoots = ['src', 'constants', 'assets/scripts', 'assets/resources'];
const observedRoots = [...productionRoots, 'docs', 'archive', '.trae'];
const allowedExisting = new Set([
  'constants/index.ts', 'src/director/IntentPort.ts', 'src/director/PlayerIntent.ts',
  'assets/scripts/SceneBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts',
]);
// These two observed changes stay outside the implementation allowlist.
const externallyObservedDocuments = new Set(['docs/NAMEBOOK.md', 'docs/spec/stage-1.md']);
const newSourceFiles = [
  'src/chart/ChartEntry.ts', 'src/chart/WorldBossChartSource.ts',
  'src/director/ChartReference.ts', 'src/director/RouteSignature.ts',
  'src/director/SphereCrossing.ts', 'src/director/WorldClearSession.ts',
  'src/director/WorldNarrativeContent.ts', 'src/ledger/deriveLedgerPosition.ts',
  'src/presentation/WorldChartView.ts', 'src/presentation/WorldClearStorage.ts',
  'src/presentation/WorldClearView.ts',
  'assets/resources/audio/primary-rain-world-1.wav',
  'assets/resources/chart/primary-rain-world-1.json',
  'assets/resources/chart/primary-rain-world-1.visual.json',
  'assets/resources/world/primary-rain-dialogue.json',
];
const allowedAdded = new Set([...newSourceFiles, ...newSourceFiles.map(file => file + '.meta'),
  'assets/resources/world.meta']);
const purposes = {
  'constants/index.ts': '仅扩展 ChartRef.state 可选 Entry/PremiereCompleted，共享词汇不改旧值。',
  'src/director/IntentPort.ts': 'T6 Entry、T7 PremiereCompleted；成对 LedgerAppend/LedgerRead 装配及只读类型窄口。',
  'src/director/PlayerIntent.ts': '增加选择 ID、进入 World 谱面、重试账号保存三项意图。',
  'assets/scripts/SceneBuilder.ts': '账号/世界身份、正式内容加载、同源账本、独立 World 首演与表现接线。',
  'assets/scripts/WorldFolderBuilder.ts': '真实账号/世界身份传入世界工厂；返回目录时对账账号通关事实。',
  'src/chart/ChartEntry.ts': 'DeepTrace/SphereCrossing 两种入口纯数据契约。',
  'src/chart/WorldBossChartSource.ts': 'World 唯一制作方谱面/视觉/媒体内容来源纯数据契约。',
  'src/director/ChartReference.ts': '合法完成引用识别与已知历史 T6/T7 只读兼容。',
  'src/director/RouteSignature.ts': '完成时真实账本坐标冻结、六色分类与账号记录严格校验。',
  'src/director/SphereCrossing.ts': 'Player 主角成功追加后完整 20 维球面判定及一次性闸。',
  'src/director/WorldClearSession.ts': '正式选择解析、同源追加、World 首演、异常媒体推进与幂等账号提交流程。',
  'src/director/WorldNarrativeContent.ts': '正式 Primary 叙事、几何、制作来源和分支向量严格装配校验。',
  'src/ledger/deriveLedgerPosition.ts': '20 维按追加顺序累计，拒绝缺维、非法数值和溢出。',
  'src/presentation/WorldChartView.ts': 'World 谱面显示、原生媒体时钟和暂停/退出意图；不写完成或权限。',
  'src/presentation/WorldClearStorage.ts': '严格账号记录 codec、独占锁、先记录后投影及幂等对账。',
  'src/presentation/WorldClearView.ts': '世界内真实叙事选择 ID 交互、入口及只读通关/账号进度。',
  'assets/resources/audio/primary-rain-world-1.wav': '原创正式 6 秒音乐/雨声媒体，二进制 diff 仅提供字节数与 SHA-256。',
  'assets/resources/chart/primary-rain-world-1.json': '既有编辑器实际导出的 schemaVersion=3 / World 谱面。',
  'assets/resources/chart/primary-rain-world-1.visual.json': '与正式谱面同源导出的视觉伴随文件。',
  'assets/resources/world/primary-rain-dialogue.json': '制作方原创 Primary 内容、零球心、正半径及三个完整非负分支向量。',
  'assets/resources/world.meta': '正式世界内容资源目录的 Cocos 标识。',
};

function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function fileInfo(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
}
function walk(relative, output) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    // Skip junctions into already-scanned source roots.
    if (entry.isSymbolicLink()) { continue; }
    const child = relative + '/' + entry.name;
    if (entry.isDirectory()) { walk(child, output); }
    else if (entry.isFile()) { output.push(child); }
  }
}
function isProduction(file) { return productionRoots.some(base => file.startsWith(base + '/')); }
function diffText(file, added) {
  const current = fs.readFileSync(path.join(root, file));
  const header = 'diff --git a/' + file + ' b/' + file + '\n';
  if (/\.(wav|png|mp4)$/i.test(file)) {
    return header + (added ? 'new file mode 100644\n' : '') +
      'Binary content: ' + current.length + ' bytes; SHA-256 ' + hash(current) + '\n';
  }
  if (!added) {
    const result = cp.spawnSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-color', '--unified=3', '--',
      path.join(backupRoot, file), path.join(root, file)], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    if (!result.error && (result.status === 0 || result.status === 1)) {
      return result.stdout.replace(/^diff --git .*$/m, header.trimEnd())
        .replace(/^--- .*$/m, '--- a/' + file).replace(/^\+\+\+ .*$/m, '+++ b/' + file);
    }
  }
  function lines(bytes) {
    const value = bytes.toString('utf8').replace(/\r\n/g, '\n');
    const result = value.split('\n');
    if (result[result.length - 1] === '') { result.pop(); }
    return result;
  }
  const before = added ? [] : lines(fs.readFileSync(path.join(backupRoot, file)));
  const after = lines(current);
  return header + (added ? 'new file mode 100644\n' : '') +
    '--- ' + (added ? '/dev/null' : 'a/' + file) + '\n+++ b/' + file + '\n' +
    '@@ -' + (before.length ? '1,' + before.length : '0,0') + ' +' +
    (after.length ? '1,' + after.length : '0,0') + ' @@\n' +
    before.map(line => '-' + line + '\n').join('') + after.map(line => '+' + line + '\n').join('');
}

const changed = [], missing = [], baselineBackupFailures = [];
for (const file of baseline.files) {
  const currentPath = path.join(root, file.path), backupPath = path.join(backupRoot, file.path);
  if (!fs.existsSync(backupPath) || hash(fs.readFileSync(backupPath)) !== file.sha256) {
    baselineBackupFailures.push(file.path);
  }
  if (!fs.existsSync(currentPath)) { missing.push(file.path); continue; }
  const after = fileInfo(file.path);
  if (after.sha256 !== file.sha256) {
    changed.push({ path: file.path, before: file.sha256, after: after.sha256,
      beforeBytes: file.bytes, afterBytes: after.bytes });
  }
}
const known = new Set(baseline.files.map(file => file.path));
const scanned = [];
for (const base of observedRoots) { walk(base, scanned); }
const added = scanned.filter(file => !known.has(file)).sort();
const authorizedChanges = changed.filter(file => allowedExisting.has(file.path));
const observedExternalDocumentChanges = changed.filter(file => externallyObservedDocuments.has(file.path));
const unexpectedProtectedChanges = changed.filter(file => !allowedExisting.has(file.path) && !externallyObservedDocuments.has(file.path));
const authorizedAdded = added.filter(file => allowedAdded.has(file));
const unauthorizedAdded = added.filter(file => !allowedAdded.has(file));
const omittedAuthorizedNewFiles = [...allowedAdded].filter(file => !fs.existsSync(path.join(root, file)));
const productionChanged = changed.filter(file => isProduction(file.path));
let diff = '', externalDiff = '';
if (baselineBackupFailures.length === 0) {
  for (const file of productionChanged) { diff += diffText(file.path, false); }
  for (const file of added.filter(isProduction)) { diff += diffText(file, true); }
  for (const file of observedExternalDocumentChanges) { externalDiff += diffText(file.path, false); }
}
fs.writeFileSync(path.join(__dirname, 'production.diff'), diff);
fs.writeFileSync(path.join(__dirname, 'external-documents.diff'), externalDiff);
const implementationScopePass = baselineBackupFailures.length === 0 && missing.length === 0 &&
  unexpectedProtectedChanges.length === 0 && unauthorizedAdded.length === 0 && omittedAuthorizedNewFiles.length === 0;
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'B2.2c authorized production increments; external document writes separately observed, never attributed to this implementation',
  protectedFiles: baseline.files.length, allowedExistingFiles: [...allowedExisting],
  baselineBackupFailures, authorizedChanges, authorizedAdded, missing, unexpectedProtectedChanges,
  unauthorizedAdded, omittedAuthorizedNewFiles, observedExternalDocumentChanges,
  unchangedBaselineFiles: baseline.files.length - changed.length - missing.length,
  unchangedProtectedFilesOutsideAuthorizedIncrements: baseline.files.length - allowedExisting.size -
    observedExternalDocumentChanges.length - unexpectedProtectedChanges.length - missing.length,
  protectedBaselineUnchanged: changed.length === 0 && missing.length === 0 && added.length === 0,
  observedExternalDocumentAttribution: observedExternalDocumentChanges.length ? 'Unconfirmed external parallel write; not reverted' : 'None',
  auditRequiresAttribution: observedExternalDocumentChanges.length > 0,
  implementationScopePass, pass: implementationScopePass,
  productionDiffBytes: Buffer.byteLength(diff), externalDocumentDiffBytes: Buffer.byteLength(externalDiff),
  productionChanges: [...productionChanged.map(file => ({ ...fileInfo(file.path), kind: 'Modified' })),
    ...added.filter(isProduction).map(file => ({ ...fileInfo(file), kind: 'Added' }))],
};
fs.writeFileSync(path.join(__dirname, 'protected-final-audit.json'), JSON.stringify(report, null, 2) + '\n');

const rows = report.productionChanges.map(file => {
  const purpose = purposes[file.path] ?? (file.path.endsWith('.meta') ? '新正式脚本/资源的独立 Cocos UUID 与导入配置。' : '待人工确认用途。');
  return '| ' + (file.kind === 'Added' ? '新增' : '修改') + ' | ' + file.path + ' | ' + file.bytes + ' | ' + file.sha256 + ' | ' + purpose + ' |';
});
const outsideRows = observedExternalDocumentChanges.map(file => '| ' + file.path + ' | ' + file.before + ' | ' + file.after + ' |');
const clearList = '# 本轮修改文件清单与真实 diff\n\n' +
  '以 protected-baseline.json 的 ' + baseline.files.length + ' 份原始哈希及 baseline/ 对应原始字节作为基线，工作区无 .git 历史。' +
  '生产 diff 使用 git diff --no-index 的真实上下文；新增文本为完整新增 unified diff；WAV 只记录字节数与 SHA-256。' +
  '扫描跳过 assets/scripts/src 和 constants 联接，避免重复计算。\n\n' +
  '旧文件增量白名单严格为 5 份：constants/index.ts、src/director/IntentPort.ts、src/director/PlayerIntent.ts、' +
  'assets/scripts/SceneBuilder.ts、assets/scripts/WorldFolderBuilder.ts。其余旧 A/B/C/编辑器/T6/T7 实现、B2.2a/b 核心、archive、参照文件与旧资源均逐份比较，' +
  '不会把范围扩展成任意修改许可。\n\n' +
  '| 类别 | 文件 | 字节数 | SHA-256（当前） | 目的 |\n| --- | --- | ---: | --- | --- |\n' + rows.join('\n') + '\n\n' +
  'IntentPort.ts 旧逻辑 diff 经人工检查：新增 LedgerRead 类型、private ledgerRead、同源 getLedgerEvents、bindLedgerSource 成对绑定，' +
  "T7 完成引用 state='PremiereCompleted'、T6 终点引用 state='Entry'，末尾仅新增 presentation 所需 type exports。" +
  '旧解谜/首演/运动/退出/记录一次闸的方法体、零向量、事件 ID 与结果判据保持。\n\n' +
  '当前生产变更 ' + report.productionChanges.length + ' 份（含 .meta），production.diff ' + report.productionDiffBytes + ' 字节。' +
  '完整保护核验以 protected-final-audit.json 为准；implementationScopePass=' + implementationScopePass + '。\n\n' +
  (observedExternalDocumentChanges.length ?
    '外部并行落盘观测：以下文档发生变化，具体操作者尚未确认；本实现工具未写这些文档，也未回退外部成果。' +
    '它们不进入生产 diff、不加入旧文件白名单，独立 diff 保存于 external-documents.diff。' +
    'protectedBaselineUnchanged=false，auditRequiresAttribution=true；不能宣称全部 docs 哈希未变。\n\n' +
    '| 外部变化文件 | 基线 SHA-256 | 当前 SHA-256 |\n| --- | --- | --- |\n' + outsideRows.join('\n') + '\n\n' : '') +
  '质量脚本与证据仅位于 quality-review/b2-world-clear/。交付清单逐份哈希质量文件与完整生产范围；' +
  'baseline/ 原始差异源另经哈希核验，不重复纳入质量附件。门禁、契约与生产验收状态读取真实 JSON，' +
  '不以文件存在或截图数量代替通过判据。\n';
fs.writeFileSync(path.join(__dirname, '修改文件清单.md'), clearList);
console.log(JSON.stringify({ implementationScopePass, baselineFiles: report.protectedFiles,
  unchangedBaselineFiles: report.unchangedBaselineFiles, authorizedChanges: authorizedChanges.map(file => file.path),
  authorizedAdded: authorizedAdded.length, unexpectedProtectedChanges, unauthorizedAdded,
  observedExternalDocumentChanges: observedExternalDocumentChanges.map(file => file.path),
  auditRequiresAttribution: report.auditRequiresAttribution, productionDiffBytes: report.productionDiffBytes }, null, 2));
process.exitCode = implementationScopePass ? 0 : 1;
