"""B2.4e original-byte diffs: source and authorized official-document drift remain separate."""
from __future__ import annotations
import difflib
import json
from pathlib import Path

evidence = Path(__file__).resolve().parent
root = evidence.parent.parent
report = json.loads((evidence / 'protected-final-audit.json').read_text(encoding='utf-8'))
before = json.loads((evidence / 'baseline-before.json').read_text(encoding='utf-8'))
after = json.loads((evidence / 'baseline-after.json').read_text(encoding='utf-8'))
old_records = {item['path']: item for item in before['files']}
new_records = {item['path']: item for item in after['files']}
paths = sorted({(new_records.get(name) or old_records[name])['canonicalPath']
                for name in report['changed'] + report['added'] + report['removed']})
source_diff, document_diff, records = [], [], []
document_paths = set(report['authorizedOfficialDocumentPaths'])
for name in paths:
    original = evidence / 'original-source' / name
    current = root / name
    if current.suffix.lower() not in {'.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.meta', '.md'}:
        records.append({'path': name, 'textDiffAvailable': False, 'reason': 'Binary/reference drift retained in SHA manifest'})
        continue
    if name in old_records and not original.exists():
        records.append({'path': name, 'textDiffAvailable': False, 'reason': 'No original text snapshot for this protected reference'})
        continue
    old = original.read_bytes().decode('utf-8').splitlines() if original.exists() else []
    new = current.read_bytes().decode('utf-8').splitlines() if current.exists() else []
    diff = list(difflib.unified_diff(old, new, fromfile='a/' + name if original.exists() else '/dev/null',
                                  tofile='b/' + name if current.exists() else '/dev/null', lineterm=''))
    target = document_diff if name in document_paths else source_diff
    target.extend(diff)
    if diff:
        target.append('')
    records.append({'path': name, 'kind': 'Changed' if original.exists() and current.exists() else
                    'Added' if current.exists() else 'Removed', 'textDiffAvailable': True,
                    'attribution': 'TraeAuthorized' if name in document_paths else 'UnexpectedProductionChange',
                    'originalLines': len(old), 'finalLines': len(new),
                    'baselineSha256': old_records.get(name, {}).get('sha256'),
                    'finalSha256': new_records.get(name, {}).get('sha256')})
(evidence / 'production-code.diff').write_bytes(('\n'.join(source_diff) + ('\n' if source_diff else '')).encode('utf-8'))
(evidence / 'authorized-docs.diff').write_bytes(('\n'.join(document_diff) + ('\n' if document_diff else '')).encode('utf-8'))
(evidence / 'protected-change-files.json').write_bytes((json.dumps({'schemaVersion': 1, 'phase': 'B2.4e',
    'expectedProductionMutationCount': 0, 'productionFileCount': report['productionFileCount'],
    'productionFiles': report['productionFiles'], 'productionCodeDiff': 'production-code.diff', 'authorizedDocsDiff': 'authorized-docs.diff',
    'files': records}, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'productionFileCount': report['productionFileCount'], 'sourceDiffLines': len(source_diff),
                  'authorizedDocumentDiffLines': len(document_diff)}, ensure_ascii=False))
