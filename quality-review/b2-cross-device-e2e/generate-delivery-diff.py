"""Review deltas for e acceptance scripts; inherited test code is compared with its accepted parent."""
import difflib
import hashlib
import json
from pathlib import Path

evidence = Path(__file__).resolve().parent
root = evidence.parent.parent
contracts = json.loads((evidence / 'contract-regression-results.json').read_text(encoding='utf-8'))
protection = json.loads((evidence / 'protected-final-audit.json').read_text(encoding='utf-8'))
copied_from = {item['copy']: root / item['source'] for item in contracts['copies']}
scripts = sorted([p for p in evidence.rglob('*') if p.is_file() and p.suffix in {'.cjs', '.py'}
                  and not any(part in {'original-source', 'prior-205-contract-evidence'} for part in p.relative_to(evidence).parts)])
diffs, harness_diffs, records = [], [], []
for script in scripts:
    relative = script.relative_to(root).as_posix()
    comparison = copied_from.get(relative)
    if comparison is None and script.parent == evidence:
        candidate = evidence.parent / 'b2-world-migration' / script.name
        comparison = candidate if candidate.exists() else None
    current_bytes = script.read_bytes()
    old_bytes = comparison.read_bytes() if comparison else b''
    lines = list(difflib.unified_diff(old_bytes.decode('utf-8').splitlines(), current_bytes.decode('utf-8').splitlines(),
        fromfile='a/' + comparison.relative_to(root).as_posix() if comparison else '/dev/null',
        tofile='b/' + relative, lineterm=''))
    if lines:
        diffs.extend(lines + [''])
        if script.name in {'creator-preview.cjs', 'prepare-preview-harness.cjs', 'run-preview.cjs'}:
            harness_diffs.extend(lines + [''])
    records.append({'path': relative, 'kind': 'AddedAcceptanceTest', 'bytes': len(current_bytes),
        'finalSha256': hashlib.sha256(current_bytes).hexdigest(),
        'comparisonBase': comparison.relative_to(root).as_posix() if comparison else None,
        'comparisonSha256': hashlib.sha256(old_bytes).hexdigest() if comparison else None,
        'sameBytesAsAcceptedParent': bool(comparison) and current_bytes == old_bytes,
        'diffLines': len(lines)})
(evidence / 'code.diff').write_bytes(('\n'.join(diffs) + '\n').encode('utf-8'))
(evidence / 'acceptance-harness.diff').write_bytes(('\n'.join(harness_diffs) + '\n').encode('utf-8'))
artifacts = sorted(p.relative_to(root).as_posix() for p in evidence.rglob('*') if p.is_file()
    and not any(part in {'original-source', 'prior-205-contract-evidence'} for part in p.relative_to(evidence).parts)
    and p not in scripts and p.name not in {'change-files.json', 'validation-summary.json'})
manifest = {'schemaVersion': 1, 'phase': 'B2.4e', 'productionFileCount': 0, 'productionFiles': [],
    'productionCodeDiff': 'production-code.diff', 'testCodeDiff': 'code.diff', 'integratedHarnessDiff': 'acceptance-harness.diff',
    'diffMeaning': 'Review comparisons only: e files are newly added. Accepted parent paths expose inherited-test deltas without repeating unchanged source. No Git repository or production patch.',
    'testFiles': records, 'evidenceFiles': artifacts,
    'excludedPreservedMaterial': ['original-source/ (369 immutable protected originals)', 'prior-205-contract-evidence/ (superseded run preserved)'],
    'concurrentOfficialDocs': protection['authorizedDocumentChanges'],
    'authoredScope': 'quality-review/b2-cross-device-e2e/ only; official docs changes attributed to Trae, not this implementation'}
(evidence / 'change-files.json').write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'productionFileCount': 0, 'testFiles': len(records), 'evidenceFiles': len(artifacts),
                  'testDiffLines': len(diffs), 'integratedHarnessDiffLines': len(harness_diffs)}))
