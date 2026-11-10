"""Emit reviewable unified source diffs from immutable B2.4c source copies."""
from __future__ import annotations

import difflib
import json
from pathlib import Path

evidence = Path(__file__).resolve().parent
root = evidence.parent.parent
report = json.loads((evidence / 'protected-final-audit.json').read_text(encoding='utf-8'))
before = json.loads((evidence / 'baseline-before.json').read_text(encoding='utf-8'))
after = json.loads((evidence / 'baseline-after.json').read_text(encoding='utf-8'))
before_paths = {item['path']: item for item in before['files']}
after_paths = {item['path']: item for item in after['files']}
extensions = {'.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.meta'}
canonical_paths = set()
for relative in report['changed'] + report['added'] + report['removed']:
    item = after_paths.get(relative) or before_paths[relative]
    if Path(item['canonicalPath']).suffix.lower() in extensions:
        canonical_paths.add(item['canonicalPath'])

output = []
records = []
for relative in sorted(canonical_paths):
    saved = evidence / 'original-source' / relative
    current = root / relative
    old = saved.read_bytes().decode('utf-8').splitlines() if saved.exists() else []
    new = current.read_bytes().decode('utf-8').splitlines() if current.exists() else []
    diff = list(difflib.unified_diff(old, new, fromfile='a/' + relative if saved.exists() else '/dev/null',
                                    tofile='b/' + relative if current.exists() else '/dev/null', lineterm=''))
    output.extend(diff)
    if diff:
        output.append('')
    records.append({'path': relative, 'kind': 'changed' if saved.exists() and current.exists() else
                    'added' if current.exists() else 'removed', 'originalLines': len(old), 'finalLines': len(new)})
(evidence / 'code.diff').write_bytes(('\n'.join(output) + '\n').encode('utf-8'))
(evidence / 'change-files.json').write_bytes((json.dumps({'schemaVersion': 1, 'phase': 'B2.4c',
    'diff': 'code.diff', 'canonicalSourceCount': len(records), 'files': records}, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'diff': 'code.diff', 'canonicalSourceCount': len(records)}, ensure_ascii=False))
