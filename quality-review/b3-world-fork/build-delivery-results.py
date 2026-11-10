"""Verify B2.3 artifacts and report contract/production evidence separately."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

def read(name):
    return json.loads((HERE / name).read_text(encoding='utf-8-sig'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def link(label, path):
    return f'[{label}](/{path.resolve().as_posix()})'

contracts = []
for name in ('domain-results.json', 'storage.contract-results.json',
             'inheritance.contract-results.json', 'runtime-wiring.contract-results.json'):
    result = read(name)
    assert result['failed'] == 0 and result['passed'] > 0, name
    contracts.append({'file': name, 'passed': result['passed'], 'failed': 0, 'category': 'ContractTest'})
assert sum(x['passed'] for x in contracts) == 132

regressions = read('regression-summary.json')
assert regressions['unchangedSuitesAllPass']['passed'] == 396
assert regressions['unchangedSuitesAllPass']['failed'] == 0
for suite in regressions['unchangedSuitesAllPass']['results']:
    actual = read('regression-results/' + suite['file'])
    assert actual.get('passed', actual.get('count')) == suite['passed']
    assert actual.get('failed', 0 if actual.get('result') == 'PASS' or actual.get('pass') is True else None) == 0
for suite in regressions['historicalFixtureOrStageExceptions']['results']:
    actual = read('regression-results/' + suite['file'])
    assert actual['passed'] == suite['passed'] and actual['failed'] == suite['failed']
for suite in regressions['derivedCurrentCoverage']:
    actual = read(suite['file'])
    assert actual['passed'] == suite['passed'] and actual['failed'] == 0
assert sum(x['passed'] for x in regressions['derivedCurrentCoverage']) == 23

gates = read('gate-results.json')
assert gates['pass'] and all(x['exitCode'] == 0 and x['pass'] for x in gates['runs'])
assert '0 ERROR / 22 WARN' in (HERE / 'gate-naming.log').read_text(encoding='utf-8-sig')
assert '0 ERROR / 27 WARN' in (HERE / 'gate-naming-baseline.log').read_text(encoding='utf-8-sig')
audit = read('protected-final-audit.json')
receipt = read('protocol-acceptance.json')
accepted = read('accepted-delivery-results.json')
accepted_protected = read('accepted-protected-manifest.json')
subsequent_landings = read('post-acceptance-trae-landings.json')
historical_paths = {item['path']: HERE / item['snapshotPath'] for item in accepted_protected['files']}
assert sha(HERE / accepted_protected['originalReportPath']) == accepted_protected['originalReportSha256']
assert all(sha(historical_paths[item['path']]) == item['sha256'] for item in accepted_protected['files'])
assert all(sha(HERE / item['snapshotPath']) == item['observedSha256'] for item in subsequent_landings['files'])
assert all(sha(HERE / item['path']) == item['sha256'] for item in read('clarification-immutable-evidence.json')['files'])
assert receipt['status'] == 'AcceptedByProtocol'
assert audit['confirmedAttribution'] == receipt['confirmedAttribution']
assert audit['pass'] and not audit['deleted'] and not audit['unexpectedChanges'] and not audit['logicCcImports']
assert all(x['unchanged'] or x.get('concurrentExternalChange') for x in audit['protected'])
assert all(x['matchesObservedExternalBytes'] for x in audit['concurrentExternalChanges'])
changes = read('changed-files.json')
assert changes['modifiedCount'] == 9 and changes['addedCount'] == 8
assert all(sha(ROOT / x['path']) == x['afterSha256'] for x in changes['files'])
assert all(sha(historical_paths[x['path']]) == x['afterSha256'] for x in audit['concurrentExternalChanges'])
assert audit['concurrentExternalChanges'] == accepted['concurrentExternalChangesPreserved']
assert sum(x['unchanged'] for x in audit['protected']) == accepted['protectedFilesUnchanged'] == 30
assert len(audit['protected']) == 32

preview = read('creator-preview-results.json')
assert preview['pass'] and preview['compilationUnchanged']
assert read('creator-preview-lifecycle.json')['exitCode'] == 0
assert sha(HERE / 'creator-preview.cjs') == preview['harnessSha256']
assert not preview['runtimeErrors'] and not preview['rendererErrors'] and not preview['externalRequests']
assert all(sha(ROOT / item['file']) == item['sourceSha256'] and item['sourceMapMatches']
           and item['servedEqualsCompilerOutput'] for item in preview['compilation'])
screenshots = []
for resolution in preview['resolutions']:
    assert resolution['pass'] and resolution['forkAcceptance']['pass']
    assert resolution['forkAcceptance']['targetRestoreKind'] == 'Restored'
    assert resolution['forkAcceptance']['targetCaptureKind'] == 'Complete'
    assert resolution['forkAcceptance']['sourceBytesUnchanged']
    assert resolution['forkAcceptance']['accountBytesUnchanged']
    assert resolution['forkAcceptance']['accountClearRecordCount'] == 1
    assert len(resolution['screenshots']) == 27
    for shot in resolution['screenshots']:
        path = HERE / shot['file']
        png = path.read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = struct.unpack('>II', png[16:24])
        assert dimensions == (resolution['width'], resolution['height'])
        assert sha(path) == shot['sha256']
        screenshots.append({'file': shot['file'], 'dimensions': dimensions, 'sha256': shot['sha256']})
assert len(screenshots) == 54
gallery = ['# B2.3 真实 Cocos 截图索引\n',
           'Creator 3.8.8 实际 localhost 预览；以下都是未加工原始 PNG，各档27张。截图尺寸和SHA256逐张经验证，见 delivery-results.json。contract adapter 的页面不计入此表。\n',
           '| 状态 | 1920×1080 | 2560×1440 |\n| --- | --- | --- |']
for left, right in zip(preview['resolutions'][0]['screenshots'], preview['resolutions'][1]['screenshots']):
    phase = left['file'].removeprefix('1920x1080-').removesuffix('.png')
    assert phase == right['file'].removeprefix('2560x1440-').removesuffix('.png')
    gallery.append(f"| {phase} | {link('原图', HERE / left['file'])} | {link('原图', HERE / right['file'])} |")
(HERE / 'screenshots.md').write_text('\n'.join(gallery) + '\n', encoding='utf-8')

reasons = {
    'assets/scripts/SceneBuilder.ts': '按 forkOrigin 装配继承首演保护子类；沿用未激活七项恢复/发布；普通保存保留 origin；注入 Implemented。',
    'assets/scripts/WorldFolderBuilder.ts': '资源绑定严格 Complete 验证；权限/来源重读；世界租约→目录锁；分叉、日志恢复和独立目标入口；原新建/删除共享目录锁。',
    'src/director/IntentPort.ts': 'type-only 转发 WorldForkOrigin / WorldForkPlan。',
    'src/director/WorldClearSession.ts': '仅 completion status 类型联合增加 Inherited；原类算法不变。',
    'src/director/WorldStateCodec.ts': '可选 forkOrigin 头严格校验；七项认证算法与旧无头格式保留。',
    'src/director/WorldStateSession.ts': '快照增加可选头、availability 类型和构造装配参数；捕获/恢复方法保持。',
    'src/presentation/WorldClearView.ts': '展示继承首演、记录未继承；隐藏首演与保存重试。',
    'src/presentation/WorldCoreStateStorage.ts': '非等待租约、来源头不可变、持租约精确暂存回滚。',
    'src/presentation/WorldFolderView.ts': '只读权限+Complete Primary 门控，异步 pending/错误重试，旧路径兼容。',
    'src/director/ForkWorldClearSession.ts': '继承首演不新增账号事实；未完成副本仍可真实新首演。',
    'src/director/WorldForkOrigin.ts': '不可变永久实例来源及完成见证验证。',
    'src/director/WorldForkSession.ts': '纯权限/源认证、身份工厂、七项精确重键候选。',
    'src/presentation/WorldForkStorage.ts': '短期日志、目录提交点、发布前回滚/发布后清理与恢复。',
}
rows = ['# B2.3 修改文件清单\n',
        '共 9 个既有文件修改、4 个新实现及 4 个配套 .meta；完整新文件与修改上下文见 production.diff。Cocos junction aliases 不重复计数。\n',
        '| 文件 | 操作 | 职责 |\n| --- | --- | --- |']
for item in changes['files']:
    name = item['path']
    reason = '新增实现配套的 Cocos TypeScript asset 元数据。' if name.endswith('.meta') else reasons[name]
    rows.append(f"| {link(name, ROOT / name)} | {item['status']} | {reason} |")
rows.append('\n上述 B2.3 实施之外的两处变更已归因：PROTOCOL 授权 Trae 并发落盘 docs/spec/stage-1.md 的 d-2 证据标签及 scripts/check-naming.js 的 v3.10 痕域白名单。原差异、摘要和文件名保留供历史核验，详见 protocol-acceptance.json / concurrent-external-changes.json / concurrent-external.diff。')
rows.append('\nTrae 随后已落盘 v3.11 名库附录，以及 B2.3 的 stage-1 授权范围和证据标签。后续文档快照、摘要与差异见 post-acceptance-trae-landings.json / post-acceptance-trae.diff；不计入上述原实施清单。原验收保护字节由 accepted-protected-manifest.json 核验，重建来源与时间已注明。')
(HERE / 'changed-files.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')

required = ['delivery-report.md', 'verdicts-271-285.md', 'namebook-v3.11-proposal.md',
            'dependency-proposal.md', 'acceptance-evidence.md', 'changed-files.md', 'screenshots.md',
            'production.diff', 'changed-files.json', 'protected-final-audit.json',
            'domain-delivery.md', 'storage-delivery.md', 'regression-summary.json',
            'concurrent-external-changes.json', 'concurrent-external.diff', 'protocol-acceptance.json',
            'accepted-delivery-results.json', 'accepted-protected-manifest.json',
            'post-acceptance-trae-landings.json', 'post-acceptance-trae.diff', 'clarification-immutable-evidence.json']
assert all((HERE / name).is_file() for name in required)
summary = {'batch': 'B2.3', 'generatedAt': datetime.now(timezone.utc).isoformat(), 'pass': True,
           'evidenceScope': 'OriginalAcceptedB23StateWithProtocolReceipt',
           'originalAcceptedReportGeneratedAt': accepted['generatedAt'],
           'verificationScope': 'Artifact hashes and receipt consistency; no new production or contract test execution',
           'protocolAcceptance': receipt,
           'subsequentTraeLandings': subsequent_landings,
           'contracts': contracts, 'newContractPassed': 132,
           'currentWiringAndFolderRegressionPassed': 23,
           'unchangedValidHistoricalContractPassed': 396,
           'historicalUnadaptedExceptions': regressions['historicalFixtureOrStageExceptions'],
           'gates': gates['runs'], 'namingErrors': 0, 'currentNamingSemanticWarnings': 22,
           'baselineCheckerNamingErrors': 0, 'baselineCheckerNamingSemanticWarnings': 27,
           'productionEvidence': {'file': 'creator-preview-results.json', 'pass': True,
               'capturedAt': preview['capturedAt'], 'sourceMapMatchesCurrentFiles': len(preview['compilation']),
               'resolutions': [r['resolution'] for r in preview['resolutions']],
               'screenshots': screenshots, 'forks': [r['forkAcceptance'] for r in preview['resolutions']],
               'runtimeErrors': 0, 'rendererErrors': 0, 'externalRequests': 0},
           'changes': {'modified': 9, 'added': 8, 'deleted': 0},
           'protectedFilesUnchanged': sum(x['unchanged'] for x in audit['protected']),
           'workspaceProtectedBytesAllUnchanged': audit['workspaceProtectedBytesAllUnchanged'],
           'concurrentExternalChangesPreserved': audit['concurrentExternalChanges'],
           'logicCcImports': 0, 'deliveryFiles': required,
           'limitations': ['Production fork supports stable Complete Primary only; FinalShore prohibited; BugShore unsupported.',
               'Active timer/reveal/performance restoration remains UnsupportedBoundary.',
               'Unfinished-copy genuine new clear and fault recovery are contract evidence only.',
               'FileCarryPayload, WorldRegistry, cross-device, observer sync and service access are excluded.',
               'Four raw historical fixture/stage exceptions remain documented, not marked PASS.',
               'The two concurrent doc/checker changes are confirmed PROTOCOL-authorized Trae landings; original hashes and diffs are preserved.',
               'Protected-file counts describe original acceptance, not later authorized v3.11/stage-1 documentation; separate verified snapshots retain both states.']}
for key in ('contracts', 'newContractPassed', 'currentWiringAndFolderRegressionPassed',
            'unchangedValidHistoricalContractPassed', 'historicalUnadaptedExceptions', 'gates',
            'namingErrors', 'currentNamingSemanticWarnings', 'baselineCheckerNamingErrors',
            'baselineCheckerNamingSemanticWarnings', 'productionEvidence', 'changes',
            'protectedFilesUnchanged', 'workspaceProtectedBytesAllUnchanged',
            'concurrentExternalChangesPreserved', 'logicCcImports'):
    assert json.dumps(summary[key], sort_keys=True) == json.dumps(accepted[key], sort_keys=True), key
(HERE / 'delivery-results.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'newContracts': 132, 'currentWiringRegressions': 23,
                  'validHistoricalRegressions': 396, 'historicalExceptionFails': 12,
                  'screenshots': 54, 'sourceMapMatchesCurrentFiles': len(preview['compilation'])}))
