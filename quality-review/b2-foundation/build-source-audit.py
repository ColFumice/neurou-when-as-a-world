"""Read-only production audit; writes evidence only beside this script."""
from pathlib import Path
import difflib
import hashlib
import json
from datetime import datetime, timezone

out = Path(__file__).resolve().parent
root = out.parent.parent
baseline = {entry['path']: entry for entry in json.loads((out / 'baseline-files.json').read_text(encoding='utf-8-sig'))}
modified = ['src/director/IntentPort.ts', 'src/presentation/WorldFolderView.ts', 'assets/scripts/WorldFolderBuilder.ts']
added_ts = ['src/director/AccountMilestone.ts', 'src/director/WorldStateSession.ts', 'src/presentation/AccountMilestoneStorage.ts', 'src/presentation/WorldStateStorage.ts']
added = [part for name in added_ts for part in (name, name + '.meta')]
files = modified + added

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def text(file):
    return file.read_text(encoding='utf-8-sig').splitlines(keepends=True)

patch = []
records = []
for name in files:
    target = root / name
    previous = out / 'baseline' / name
    is_new = name in added
    if not is_new:
        assert sha(previous) == baseline[name]['sha256'], 'Baseline copy mismatch: ' + name
    else:
        assert name not in baseline, 'Unexpected existing file: ' + name
    old = [] if is_new else text(previous)
    new = text(target)
    patch.append('diff --git a/' + name + ' b/' + name + '\n')
    if is_new:
        patch.append('new file mode 100644\n')
    patch.extend(difflib.unified_diff(old, new, fromfile='/dev/null' if is_new else 'a/' + name, tofile='b/' + name, n=3))
    records.append({'path': name, 'kind': 'Added' if is_new else 'Modified',
                    'baselineSha256': None if is_new else baseline[name]['sha256'],
                    'sha256': sha(target), 'bytes': target.stat().st_size})
(out / 'production.diff').write_text(''.join(patch), encoding='utf-8', newline='\n')

deltas = []
checked = 0
for name, entry in baseline.items():
    target = root / name
    if not target.is_file():
        deltas.append({'path': name, 'kind': 'Missing', 'baselineSha256': entry['sha256']})
        continue
    current = sha(target)
    checked += 1
    if current != entry['sha256']:
        category = 'Implementation' if name in modified else 'ConcurrentExternalProtectedDelta' if name in ('docs/NAMEBOOK.md', 'docs/spec/stage-1.md') else 'OtherObservedDelta'
        deltas.append({'path': name, 'kind': category, 'baselineSha256': entry['sha256'], 'sha256': current,
                       'observedLastWriteTime': datetime.fromtimestamp(target.stat().st_mtime).astimezone().isoformat()})

report = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'gitRepository': False,
          'comparison': 'Task-start SHA-256 inventory and copied source baseline; no Git history is assumed.',
          'implementationFiles': records, 'baselineExistingCount': len(baseline), 'existingFilesChecked': checked,
          'deltas': deltas,
          'protectedNote': 'This implementation did not write docs/namebook/reference files. Two separately observed concurrent docs deltas are preserved and not attributed to an actor. Do not claim all protected files are byte-unchanged.'}
(out / 'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
lines = ['# B2.2a+b 修改文件与差异', '', '项目无 Git 仓库；差异以本轮起始保存的源码副本及 SHA-256 清单为基线。完整补丁见 [production.diff](production.diff)，审计见 [source-audit.json](source-audit.json)。', '', '| 状态 | 文件 | 用途 |', '| --- | --- | --- |']
purposes = {
    modified[0]: '仅追加 type exports，保持原 IntentPort 前缀',
    modified[1]: '权限/未实施状态分开展示，Incomplete 诊断及拒绝恢复',
    modified[2]: '现有组合根接线，只读里程碑与目录诊断，不加载 gameplay',
    added_ts[0]: '里程碑投影类型、严格领域读取、CopyPermission 派生',
    added_ts[1]: '七项归属契约、Incomplete 捕获、完整恢复拒绝',
    added_ts[2]: '独立 key、严格解析、单向事实/过期检查',
    added_ts[3]: '每账号每世界 key、未知候选读取、完整保存拒绝',
}
for item in records:
    lines.append('| ' + item['kind'] + ' | `' + item['path'] + '` | ' + purposes.get(item['path'], 'Cocos 资源身份 meta') + ' |')
lines += ['', '共 3 个既有 TS 修改、4 个新增 TS、4 个新增 meta。契约测试、预览 harness、截图与交付文书位于 quality-review/b2-foundation，均属于验收产物，未加入生产补丁。', '', '## 受保护文件与并发变化', '', '全起始清单比对结果：']
for delta in deltas:
    lines.append('- `' + delta['path'] + '`：' + delta['kind'] + '。')
lines += ['', report['protectedNote'], '', '未将并发文档变化纳入生产补丁，也未覆盖、恢复或改写这些变化。除上述清单外，起始库存中其他文件 SHA-256 一致；新增文件只对本次明确创建的生产文件作归属声明。']
(out / '修改文件清单.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps({'productionFiles': len(records), 'existingChecked': checked, 'deltas': [(d['path'], d['kind']) for d in deltas]}, ensure_ascii=False, indent=2))
