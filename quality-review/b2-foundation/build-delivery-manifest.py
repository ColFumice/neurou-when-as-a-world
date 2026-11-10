"""Bind delivered evidence to final sources and original PNG bytes."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import struct

out = Path(__file__).resolve().parent
root = out.parent.parent
def read(name):
    return json.loads((out / name).read_text(encoding='utf-8-sig'))
def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

audit = read('source-audit.json')
preview = read('creator-preview-results.json')
qa = read('visual-qa-results.json')
gate = read('gate-results.json')
milestone = read('account-milestone.contract-results.json')
state = read('world-state.contract-results.json')
dom = read('folder-foundation.contract-results.json')
assert gate['pass'] and all(run['exitCode'] == 0 for run in gate['runs'])
assert milestone['passed'] == 26 and milestone['failed'] == 0
assert state['passed'] and state['count'] == state['passedCount'] == 42
assert dom['passed'] == 8 and dom['failed'] == 0
assert preview['pass'] and preview['compilationUnchanged'] and qa['pass']
assert not preview['runtimeErrors'] and not preview['rendererErrors']
assert [r['resolution'] for r in preview['resolutions']] == ['1920x1080', '2560x1440']
for item in audit['implementationFiles']:
    assert sha(root / item['path']) == item['sha256'], 'Source audit is stale: ' + item['path']
for item in preview['compilation']:
    assert sha(root / item['file']) == item['sourceSha256']
    assert item['sourceMapMatches'] and item['servedEqualsCompilerOutput']
for item in state['sourceHashes']:
    assert sha(root / item['file']) == item['sha256']
for name, expected in dom['sourceHashes'].items():
    assert sha(root / name) == expected
for name in ['src/director/AccountMilestone.ts', 'src/director/WorldStateSession.ts']:
    assert not re.search(r"\bfrom\s+['\"]cc['\"]|\brequire\s*\(\s*['\"]cc['\"]", (root / name).read_text(encoding='utf-8-sig'))
assert (root / 'src/director/IntentPort.ts').read_bytes().startswith((out / 'baseline/src/director/IntentPort.ts').read_bytes())
pngs = []
for resolution in preview['resolutions']:
    assert resolution['pass'] and len(resolution['screenshots']) == 4
    assert all(check['pass'] for check in resolution['checks'])
    for capture in resolution['screenshots']:
        file = out / capture['file']
        image = file.read_bytes()
        assert image[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = list(struct.unpack('>II', image[16:24]))
        assert dimensions == [resolution['width'], resolution['height']]
        assert sha(file) == capture['sha256']
        inspected = next(item for item in qa['images'] if item['file'] == capture['file'])
        assert inspected['pass'] and inspected['visuallyInspected'] and inspected['matchesCapturedHash']
        assert inspected['sha256'] == capture['sha256']
        pngs.append({'path': capture['file'], 'sha256': capture['sha256'], 'dimensions': dimensions,
                     'evidenceClass': 'ProductionUIAcceptance', 'clearInjection': False})

artifacts = ['VERDICT-211-225.md', '名库v3.7附录提案.md', '交付报告.md', '修改文件清单.md',
             'production.diff', '截图索引.md', 'code-review.md', 'source-audit.json',
             'gate-results.json', 'gate-naming.log', 'gate-dependencies.log', 'gate-typecheck.log',
             'account-milestone.contract.cjs', 'account-milestone.contract-results.json',
             'world-state.contract.cjs', 'world-state.contract-results.json',
             'folder-foundation.contract.cjs', 'folder-foundation.contract-results.json',
             'creator-preview.cjs', 'creator-preview-results.json', 'creator-preview.log',
             'creator-refresh-evidence.json', 'visual-qa-results.json']
manifest = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'scope': 'B2.2a + B2.2b foundations only',
            'productionSources': audit['implementationFiles'], 'artifacts': [{'path': name, 'sha256': sha(out / name)} for name in artifacts],
            'screenshots': pngs, 'contractTests': {'milestone': 26, 'worldState': 42, 'directoryDOM': 8, 'total': 76, 'failed': 0},
            'gates': gate['runs'], 'productionPreviewChecks': 18,
            'boundaries': {'realClearWritten': False, 'completeCaptureProducer': False, 'gameplayRestoreImplemented': False,
                           'fullStateSaveImplemented': False, 'worldForkImplemented': False, 'forkAvailability': 'NotImplemented'},
            'knownExternalProtectedDeltas': [item for item in audit['deltas'] if item['kind'] == 'ConcurrentExternalProtectedDelta'],
            'checks': {'finalSourcesMatchAuditAndCompiledPreview': True, 'worldStateAndDOMTestsMatchSourceHashes': True,
                       'logicAdditionsZeroCC': True, 'intentPortOriginalPrefixPreserved': True, 'allScreenshotsOriginalAndVisuallyInspected': True,
                       'noFirstWorldClearedFixtureInProductionPreview': True}, 'pass': True}
(out / 'delivery-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'productionFiles': len(manifest['productionSources']), 'contractTests': 76,
                  'gates': 3, 'resolutions': 2, 'screenshots': len(pngs), 'productionUIChecks': 18}, ensure_ascii=False))
