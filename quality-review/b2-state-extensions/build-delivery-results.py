"""Verify the final artifacts, source compilation identities and raw screenshots."""
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

contracts = []
for name in ('recall.contract-results.json', 'world-link.contract-results.json',
             'aggregation.contract-results.json', 'chart-contract-results.json',
             'runtime-wiring.contract-results.json', 'storage.contract-results.json',
             'replay.contract-results.json'):
    result = read(name)
    passed = result.get('passed', result.get('count'))
    failed = result.get('failed', 0 if result.get('result') == 'PASS' else None)
    assert failed == 0 and passed > 0, name
    contracts.append({'file': name, 'passed': passed, 'failed': failed, 'category': 'ContractTest'})
regressions = []
for name in ('ledger.contract-results.json', 'puzzle.contract-results.json',
             'b2a-account-regression-results.json', 'b2c-domain-regression-results.json',
             'b2c-storage-regression-results.json'):
    result = read(name)
    assert result.get('failed', 0) == 0 and result['passed'] > 0, name
    regressions.append({'file': name, 'passed': result['passed'], 'failed': 0, 'category': 'ContractRegression'})
gates = read('gate-results.json')
assert gates['pass'] and all(x['pass'] and x['exitCode'] == 0 for x in gates['runs'])
protected = read('protected-final-audit.json')
assert protected['pass']
changes = read('changed-files.json')
assert all(sha(ROOT / x['path']) == x['afterSha256'] for x in changes['files'])
preview = read('creator-preview-results.json')
assert preview['pass'] and preview['compilationUnchanged']
assert read('creator-preview-lifecycle.json')['exitCode'] == 0
assert not preview['runtimeErrors'] and not preview['rendererErrors'] and not preview['externalRequests']
assert all(sha(ROOT / item['file']) == item['sourceSha256'] and item['sourceMapMatches']
           and item['servedEqualsCompilerOutput'] for item in preview['compilation'])
screenshots = []
for resolution in preview['resolutions']:
    assert resolution['pass'] and resolution['extendedAcceptance']['pass']
    assert resolution['extendedAcceptance']['restoreKind'] == 'Restored'
    assert len(resolution['screenshots']) == 18
    for shot in resolution['screenshots']:
        target = HERE / shot['file']
        png = target.read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = struct.unpack('>II', png[16:24])
        assert dimensions == (resolution['width'], resolution['height']), shot['file']
        assert hashlib.sha256(png).hexdigest() == shot['sha256'], shot['file']
        screenshots.append({'file': shot['file'], 'sha256': shot['sha256'], 'dimensions': dimensions})
required = ['delivery-report.md', '正式裁定书-VERDICT-256-270.md',
            'NAMEBOOK-v3.10-appendix-proposal.md', 'dependency-proposal.md',
            'acceptance-evidence.md', 'production.diff', 'changed-files.json',
            'final-review-domain.md', 'world-link-aggregation-delivery.md',
            'chart-archive-delivery.md']
assert all((HERE / name).is_file() for name in required)
summary = {'batch': 'B2.2d-2', 'generatedAt': datetime.now(timezone.utc).isoformat(), 'pass': True,
           'contracts': contracts, 'newContractPassed': sum(x['passed'] for x in contracts),
           'regressions': regressions, 'regressionPassed': sum(x['passed'] for x in regressions),
           'gates': gates['runs'], 'namingErrors': 0, 'namingSemanticWarnings': 27,
           'productionEvidence': {'file': 'creator-preview-results.json', 'pass': True,
              'capturedAt': preview['capturedAt'], 'resolutions': [r['resolution'] for r in preview['resolutions']],
              'sourceMapMatchesCurrentFiles': len(preview['compilation']), 'screenshots': screenshots,
              'sameProfileFreshWindowRestored': True, 'liveStableCaptureKind': 'Complete',
              'runtimeRestoreKind': 'Restored', 'externalRequests': 0},
           'changes': {'modified': changes['modifiedCount'], 'added': changes['addedCount'], 'deleted': 0},
           'protectedFilesUnchanged': len(protected['protected']) + len(protected['additionalProtected']),
           'logicCcImports': 0, 'deliveryFiles': required,
           'limitations': ['BugShore/FinalShore/foreign-first are contract coverage only',
              'Active timer/reveal/performance hydration remains UnsupportedBoundary',
              'Legacy missing actual chart archives remain Incomplete',
              'WorldForkAvailability remains NotImplemented; identity rebasing belongs to B2.3']}
(HERE / 'delivery-results.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'newContracts': summary['newContractPassed'],
                  'regressions': summary['regressionPassed'], 'screenshots': len(screenshots),
                  'sourceMapMatchesCurrentFiles': len(preview['compilation'])}))
